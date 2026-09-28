import { describe, expect, it } from "vitest";
import { createUser, expectError, scalar, withTx, type Db } from "./helpers.js";

async function setup(db: Db) {
  await createUser(db, "user-a");
  await createUser(db, "user-b");
  const schoolId = await scalar<string>(
    db,
    `insert into driving_schools (name, promo_code, discount_percent, commission_percent)
     values ('Auto-école Le Volant', 'VOLANT', 10, 15) returning id`,
  );
  await db.query("insert into driving_schools (name, promo_code, active) values ('Auto-école Fermée', 'FERME', false)");
  return { schoolId };
}

const createPayment = (db: Db, user: string) =>
  db.query("select * from create_payment($1)", [user]).then((r) => r.rows[0]);
const confirm = (db: Db, paymentId: string, ref: string, amount: number) =>
  db.query("select * from confirm_payment($1, $2, $3)", [paymentId, ref, amount]).then((r) => r.rows[0]);

describe("code promo", () => {
  it("accepte un code sans tenir compte de la casse ni des espaces", () =>
    withTx(async (db) => {
      await setup(db);
      expect(await scalar<string>(db, "select set_promo_code('user-a', ' volant ')")).toBe("Auto-école Le Volant");
    }));

  it("refuse un code inconnu ou désactivé", () =>
    withTx(async (db) => {
      await setup(db);
      await expectError(db, "select set_promo_code('user-a', 'INCONNU')", [], "invalid_promo_code");
      await expectError(db, "select set_promo_code('user-a', 'FERME')", [], "invalid_promo_code");
    }));
});

describe("paiement", () => {
  it("calcule la réduction et la commission côté serveur", () =>
    withTx(async (db) => {
      await setup(db);
      await db.query("select set_promo_code('user-a', 'VOLANT')");
      const p = await createPayment(db, "user-a");
      expect({ base: p.base_amount_xof, discount: p.discount_xof, amount: p.amount_xof, commission: p.commission_xof, status: p.status })
        .toEqual({ base: 3000, discount: 300, amount: 2700, commission: 405, status: "pending" });
    }));

  it("applique le plein tarif sans commission sans code promo", () =>
    withTx(async (db) => {
      await setup(db);
      const p = await createPayment(db, "user-b");
      expect({ amount: p.amount_xof, commission: p.commission_xof, school: p.driving_school_id })
        .toEqual({ amount: 3000, commission: 0, school: null });
    }));

  it("crée un seul Pass de 90 jours même si la notification arrive deux fois", () =>
    withTx(async (db) => {
      await setup(db);
      const p = await createPayment(db, "user-a");
      await expectError(db, "select confirm_payment($1, 'REF1', 1000)", [p.id], "amount_mismatch");
      await confirm(db, p.id, "REF1", 3000);
      await confirm(db, p.id, "REF1", 3000);
      expect(await scalar<number>(db, "select count(*)::int from passes where user_id = 'user-a'")).toBe(1);
      expect(await scalar<string>(db, "select (ends_at - starts_at)::text from passes where user_id = 'user-a'")).toBe("90 days");
      expect(await scalar<string>(db, "select status::text from payments where id = $1", [p.id])).toBe("confirmed");
    }));

  it("enchaîne le second Pass à la fin du premier et verrouille le code promo", () =>
    withTx(async (db) => {
      await setup(db);
      await db.query("select set_promo_code('user-a', 'VOLANT')");
      const p1 = await createPayment(db, "user-a");
      await confirm(db, p1.id, "REF1", 2700);
      await expectError(db, "select set_promo_code('user-a', 'VOLANT')", [], "promo_locked");
      const p2 = await createPayment(db, "user-a");
      const pass2 = await confirm(db, p2.id, "REF2", 2700);
      const firstEnd = await scalar<Date>(db, "select ends_at from passes where payment_id = $1", [p1.id]);
      expect(pass2.starts_at.getTime()).toBe(firstEnd.getTime());
    }));

  it("honore une confirmation arrivée après l'échec", () =>
    withTx(async (db) => {
      await setup(db);
      const p = await createPayment(db, "user-b");
      await db.query("select fail_payment($1, 'délai dépassé')", [p.id]);
      expect(await scalar<string>(db, "select status::text from payments where id = $1", [p.id])).toBe("failed");
      await confirm(db, p.id, "REF3", 3000);
      expect(await scalar<string>(db, "select status::text from payments where id = $1", [p.id])).toBe("confirmed");
    }));

  it("expire les paiements en attente depuis plus de 30 minutes", () =>
    withTx(async (db) => {
      await setup(db);
      const old = await createPayment(db, "user-b");
      await createPayment(db, "user-b");
      await db.query("update payments set created_at = now() - interval '31 minutes' where id = $1", [old.id]);
      expect(await scalar<number>(db, "select expire_stale_payments()")).toBe(1);
      expect(await scalar<number>(db, "select count(*)::int from payments where status = 'pending'")).toBe(1);
    }));

  it("conserve les paiements anonymisés quand l'élève supprime son compte", () =>
    withTx(async (db) => {
      await setup(db);
      const p = await createPayment(db, "user-a");
      await confirm(db, p.id, "REF1", 3000);
      await db.query("select delete_account('user-a')");
      expect(await scalar<string | null>(db, "select user_id from payments where id = $1", [p.id])).toBeNull();
      expect(await scalar<number>(db, "select count(*)::int from passes")).toBe(0);
    }));
});

describe("rapport des commissions", () => {
  it("totalise les ventes confirmées du mois par auto-école", () =>
    withTx(async (db) => {
      const { schoolId } = await setup(db);
      await db.query("select set_promo_code('user-a', 'VOLANT')");
      for (const ref of ["REF1", "REF2"]) {
        const p = await createPayment(db, "user-a");
        await confirm(db, p.id, ref, 2700);
      }
      await createPayment(db, "user-a"); // en attente : non compté
      const { rows } = await db.query(
        `select name, sales_count::int, revenue_xof::int, commission_xof::int
         from admin_commission_report((now() at time zone 'Africa/Lome')::date)
         where driving_school_id = $1`,
        [schoolId],
      );
      expect(rows[0]).toEqual({ name: "Auto-école Le Volant", sales_count: 2, revenue_xof: 5400, commission_xof: 810 });
    }));
});
