import { describe, expect, it } from "vitest";
import { scalar, withTx } from "../../db/test/helpers.js";
import { getSettings, updateSettings } from "../lib/data/settings";

describe("réglages", () => {
  it("lit et modifie les réglages globaux", () =>
    withTx(async (db) => {
      expect(await getSettings(db)).toEqual({
        pass_price_xof: 3000,
        pass_duration_days: 90,
        xp_per_session: 10,
        xp_perfect_bonus: 5,
        ready_after_consecutive_passes: 3,
        max_review_per_lesson: 2,
      });
      await updateSettings(db, { pass_price_xof: 2500 });
      expect(await scalar<number>(db, "select setting_int('pass_price_xof')")).toBe(2500);
    }));

  it("refuse un prix négatif", () =>
    withTx(async (db) => {
      await expect(updateSettings(db, { pass_price_xof: -1 })).rejects.toThrow();
    }));
});
