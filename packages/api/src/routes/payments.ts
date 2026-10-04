import { Hono } from "hono";
import { z } from "zod";
import { row } from "../db.js";
import { HttpError } from "../errors.js";
import { GatewayError } from "../paygate.js";
import type { AppEnv, Deps } from "../types.js";

const Id = z.uuid();
const NewPayment = z.strictObject({
  network: z.enum(["FLOOZ", "TMONEY"]),
  // Numéro togolais à 8 chiffres, sans indicatif (format attendu par PayGate)
  phone_number: z.string().regex(/^[79]\d{7}$/),
});

const PUBLIC_FIELDS = `id, status, base_amount_xof, discount_xof, amount_xof, failure_reason, created_at, confirmed_at`;

/**
 * Rapproche un paiement de la passerelle : PayGate fait foi, jamais l'application ni la notification seule.
 * Un paiement déjà marqué échoué (délai dépassé) mais payé chez PayGate est tout de même honoré.
 */
export async function settlePayment(deps: Deps, paymentId: string, notifiedAmount?: number): Promise<void> {
  const pay = await row<{ status: string; amount_xof: number; gateway_ref: string | null }>(
    deps.db,
    "select status, amount_xof, gateway_ref from payments where id = $1",
    [paymentId],
  );
  if (!pay || pay.status === "confirmed") return;
  const remote = await deps.gateway.status(paymentId);
  if (remote.status === "paid") {
    await deps.db.query("select confirm_payment($1, $2, $3)", [
      paymentId,
      remote.txReference ?? pay.gateway_ref,
      notifiedAmount ?? pay.amount_xof,
    ]);
  } else if (remote.status === "expired" || remote.status === "cancelled") {
    await deps.db.query("select fail_payment($1, $2)", [paymentId, remote.status]);
  }
}

/** Routes élève (jeton Neon Auth requis). */
export function paymentRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();

  // Prix du Pass pour cet élève, réduction de son auto-école comprise (écran 23)
  r.get("/quote", async (c) => {
    const quote = await row(
      deps.db,
      `select base, discount, base - discount as amount, school, setting_int('pass_duration_days') as duration_days
       from (
         select setting_int('pass_price_xof') as base,
                coalesce(floor(setting_int('pass_price_xof') * s.discount_percent / 100.0), 0)::int as discount,
                s.name as school
         from profiles p
         left join driving_schools s on s.id = p.driving_school_id and s.active
         where p.id = $1
       ) q`,
      [c.get("userId")],
    );
    return c.json(quote);
  });

  r.get("/", async (c) => {
    const { rows } = await deps.db.query(
      `select ${PUBLIC_FIELDS} from payments where user_id = $1 order by created_at desc limit 20`,
      [c.get("userId")],
    );
    return c.json(rows);
  });

  r.post("/", async (c) => {
    const userId = c.get("userId");
    const body = NewPayment.parse(await c.req.json());
    await deps.db.query("select expire_stale_payments()");

    // Double appui ou relance rapide : on reprend le paiement en attente au lieu d'en créer un second.
    const recent = await row(
      deps.db,
      `select ${PUBLIC_FIELDS} from payments
       where user_id = $1 and status = 'pending' and created_at > now() - interval '2 minutes'
       order by created_at desc limit 1`,
      [userId],
    );
    if (recent) return c.json(recent);

    const pay = await row<{ id: string; amount_xof: number }>(deps.db, "select id, amount_xof from create_payment($1)", [userId]);
    if (!pay) throw new HttpError(500, "internal_error", "Erreur interne. Réessayez plus tard.");

    if (pay.amount_xof === 0) {
      // Réduction de 100 % : rien à encaisser
      await deps.db.query("select confirm_payment($1, $2, 0)", [pay.id, `gratuit-${pay.id}`]);
    } else {
      try {
        const { txReference } = await deps.gateway.initiate({
          identifier: pay.id,
          amount: pay.amount_xof,
          phone: body.phone_number,
          network: body.network,
          description: "DriveLearn - Pass Examen",
        });
        if (txReference) await deps.db.query("update payments set gateway_ref = $2 where id = $1", [pay.id, txReference]);
      } catch (error) {
        const reason = error instanceof GatewayError ? error.code : "gateway_error";
        await deps.db.query("select fail_payment($1, $2)", [pay.id, reason]);
        if (error instanceof GatewayError) {
          throw new HttpError(error.code === "invalid_phone" ? 400 : 502, error.code, error.message);
        }
        throw error;
      }
    }
    return c.json(await row(deps.db, `select ${PUBLIC_FIELDS} from payments where id = $1`, [pay.id]), 201);
  });

  // Interrogé par l'application toutes les quelques secondes pendant « Paiement en cours »
  r.get("/:id", async (c) => {
    const id = Id.parse(c.req.param("id"));
    const userId = c.get("userId");
    const mine = await row<{ status: string }>(deps.db, "select status from payments where id = $1 and user_id = $2", [id, userId]);
    if (!mine) throw new HttpError(404, "payment_not_found", "Paiement introuvable.");
    if (mine.status === "pending") {
      try {
        await settlePayment(deps, id);
      } catch (error) {
        // Passerelle injoignable : on renvoie l'état connu, l'application réessaiera.
        if (!(error instanceof GatewayError)) throw error;
      }
    }
    return c.json(await row(deps.db, `select ${PUBLIC_FIELDS} from payments where id = $1`, [id]));
  });

  return r;
}

const Notification = z.object({
  identifier: z.string(),
  tx_reference: z.union([z.string(), z.number()]).optional(),
  amount: z.coerce.number().optional(),
});

/** Notification de PayGate (sans jeton). Toujours vérifiée auprès de PayGate avant d'activer quoi que ce soit. */
export function paymentWebhook(deps: Deps) {
  const r = new Hono();
  r.post("/", async (c) => {
    const parsed = Notification.safeParse(await c.req.json().catch(() => null));
    const id = parsed.success ? Id.safeParse(parsed.data.identifier) : null;
    if (!parsed.success || !id?.success) return c.json({ ok: false }, 400);
    const exists = await row(deps.db, "select 1 from payments where id = $1", [id.data]);
    if (!exists) return c.json({ ok: false }, 404);
    await settlePayment(deps, id.data, parsed.data.amount);
    return c.json({ ok: true });
  });
  return r;
}
