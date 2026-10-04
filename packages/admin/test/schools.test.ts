import { describe, expect, it } from "vitest";
import { createUser, withTx } from "../../db/test/helpers.js";
import { createSchool, listSchools, updateSchool } from "../lib/data/schools";

describe("auto-écoles", () => {
  it("crée une auto-école avec un code promo en majuscules et compte ses élèves", () =>
    withTx(async (db) => {
      const id = await createSchool(db, { name: "Auto-école Le Volant", promo_code: " volant ", discount_percent: 10, commission_percent: 15 });
      await createUser(db, "user-a");
      await db.query("select set_promo_code('user-a', 'VOLANT')");
      const [school] = await listSchools(db);
      expect(school).toMatchObject({ id, promo_code: "VOLANT", discount_percent: 10, commission_percent: 15, active: true, students: 1, confirmed_sales: 0 });
    }));

  it("refuse un code promo déjà pris ou un taux hors limites", () =>
    withTx(async (db) => {
      await createSchool(db, { name: "A", promo_code: "VOLANT", discount_percent: 10, commission_percent: 10 });
      await db.query("savepoint dup");
      await expect(createSchool(db, { name: "B", promo_code: "volant", discount_percent: 10, commission_percent: 10 })).rejects.toMatchObject({ code: "23505" });
      await db.query("rollback to savepoint dup");
      await expect(createSchool(db, { name: "C", promo_code: "AUTRE", discount_percent: 150, commission_percent: 10 })).rejects.toThrow();
    }));

  it("modifie les taux et désactive", () =>
    withTx(async (db) => {
      const id = await createSchool(db, { name: "A", promo_code: "VOLANT", discount_percent: 10, commission_percent: 10 });
      await updateSchool(db, id, { name: "A bis", discount_percent: 5, commission_percent: 20, active: false });
      expect((await listSchools(db))[0]).toMatchObject({ name: "A bis", discount_percent: 5, commission_percent: 20, active: false });
    }));
});
