import { Hono } from "hono";
import { z } from "zod";
import { row } from "../db.js";
import { HttpError } from "../errors.js";
import type { AppEnv, Deps } from "../types.js";

const PatchMe = z.strictObject({
  first_name: z.string().trim().max(40).nullable().optional(),
  program_id: z.uuid().nullable().optional(),
  daily_goal_minutes: z.literal([5, 10, 15]).optional(),
  reminder_enabled: z.boolean().optional(),
  reminder_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  push_token: z.string().max(200).nullable().optional(),
});

const PromoCode = z.strictObject({ code: z.string().max(20).nullable() });

export async function getMe(deps: Deps, userId: string) {
  return row(
    deps.db,
    `select p.id, p.email, p.first_name, p.program_id, p.daily_goal_minutes, p.reminder_enabled,
            to_char(p.reminder_time, 'HH24:MI') as reminder_time, s.name as driving_school_name
     from profiles p left join driving_schools s on s.id = p.driving_school_id
     where p.id = $1`,
    [userId],
  );
}

export function meRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();

  r.get("/", async (c) => c.json(await getMe(deps, c.get("userId"))));

  r.patch("/", async (c) => {
    const userId = c.get("userId");
    const body = PatchMe.parse(await c.req.json());

    if (body.program_id) {
      const program = await row(deps.db, "select 1 from programs where id = $1 and status = 'publie'", [body.program_id]);
      if (!program) throw new HttpError(400, "program_not_available", "Ce programme n'est pas encore disponible.");
    }

    // Les clés viennent d'un schéma strict : seules les colonnes ci-dessus peuvent apparaître.
    const entries = Object.entries(body).filter(([, value]) => value !== undefined);
    if (entries.length > 0) {
      const assignments = entries.map(([key], i) => `${key} = $${i + 2}`).join(", ");
      await deps.db.query(`update profiles set ${assignments} where id = $1`, [userId, ...entries.map(([, v]) => v)]);
    }
    return c.json(await getMe(deps, userId));
  });

  r.post("/promo-code", async (c) => {
    const { code } = PromoCode.parse(await c.req.json());
    const result = await row<{ name: string | null }>(deps.db, "select set_promo_code($1, $2) as name", [
      c.get("userId"),
      code,
    ]);
    return c.json({ driving_school_name: result?.name ?? null });
  });

  r.delete("/", async (c) => {
    const userId = c.get("userId");
    // Données d'abord : si Neon Auth échoue ensuite, l'élève peut se reconnecter et recommencer.
    await deps.db.query("select delete_account($1)", [userId]);
    try {
      await deps.authAdmin.deleteUser(userId);
    } catch (error) {
      console.error(error);
      throw new HttpError(502, "auth_delete_failed", "La suppression n'a pas pu aboutir. Réessayez dans un instant.");
    }
    return c.body(null, 204);
  });

  return r;
}
