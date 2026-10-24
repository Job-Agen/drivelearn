import { describe, expect, it } from "vitest";
import { createUser, withTx } from "../../db/test/helpers.js";
import { createBatch, getBatch, listBatches } from "../lib/data/pass-codes";
import { createSchool } from "../lib/data/schools";

describe("codes d'activation", () => {
  it("crée un lot pour une auto-école et compte les codes utilisés", () =>
    withTx(async (db) => {
      const schoolId = await createSchool(db, { name: "Le Volant", promo_code: "VOLANT", discount_percent: 0, commission_percent: 0 });
      const id = await createBatch(db, { label: " Novembre ", driving_school_id: schoolId, count: 5, duration_days: 90 });
      await createUser(db, "user-a");
      const batch = await getBatch(db, id);
      expect(batch?.codes).toHaveLength(5);
      await db.query("select redeem_pass_code('user-a', $1)", [batch!.codes[0].code]);

      const [row] = await listBatches(db);
      expect(row).toMatchObject({ id, label: "Novembre", school_name: "Le Volant", duration_days: 90, total: 5, redeemed: 1 });
      const used = (await getBatch(db, id))!.codes.find((c) => c.redeemed_at);
      expect(used?.email).toBe("user-a@test.tg");
    }));

  it("refuse un lot vide, trop gros ou sans nom", () =>
    withTx(async (db) => {
      await expect(createBatch(db, { label: "A", driving_school_id: null, count: 0, duration_days: 90 })).rejects.toThrow();
      await expect(createBatch(db, { label: "A", driving_school_id: null, count: 1001, duration_days: 90 })).rejects.toThrow();
      await expect(createBatch(db, { label: " ", driving_school_id: null, count: 1, duration_days: 90 })).rejects.toThrow();
      expect(await getBatch(db, "00000000-0000-0000-0000-000000000000")).toBeNull();
    }));
});
