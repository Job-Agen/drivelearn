import { describe, expect, it } from "vitest";
import { createUser, expectError, scalar, withTx } from "./helpers.js";

describe("profils", () => {
  it("crée le profil une seule fois et met l'e-mail à jour", () =>
    withTx(async (db) => {
      await createUser(db, "user-1", "a@test.tg");
      await db.query("select ensure_profile($1, $2)", ["user-1", "b@test.tg"]);
      expect(await scalar<number>(db, "select count(*)::int from profiles where id = 'user-1'")).toBe(1);
      expect(await scalar<string>(db, "select email from profiles where id = 'user-1'")).toBe("b@test.tg");
    }));

  it("a les préférences par défaut : 5 min par jour, rappel à 19:00", () =>
    withTx(async (db) => {
      await createUser(db, "user-1");
      const { rows } = await db.query(
        "select daily_goal_minutes, reminder_enabled, reminder_time::text as reminder_time from profiles where id = 'user-1'",
      );
      expect(rows[0]).toEqual({ daily_goal_minutes: 5, reminder_enabled: true, reminder_time: "19:00:00" });
    }));

  it("refuse un objectif autre que 5, 10 ou 15 minutes", () =>
    withTx(async (db) => {
      await createUser(db, "user-1");
      await expectError(
        db,
        "update profiles set daily_goal_minutes = 7 where id = 'user-1'",
        [],
        "profiles_daily_goal_minutes_check",
      );
    }));

  it("met les codes promo en majuscules obligatoirement", () =>
    withTx(async (db) => {
      await expectError(
        db,
        "insert into driving_schools (name, promo_code) values ('Auto-école', 'volant')",
        [],
        "driving_schools_promo_code_check",
      );
      const discount = await scalar<number>(
        db,
        "insert into driving_schools (name, promo_code) values ('Auto-école Le Volant', 'VOLANT') returning discount_percent",
      );
      expect(discount).toBe(10);
    }));

  it("supprime le profil avec delete_account", () =>
    withTx(async (db) => {
      await createUser(db, "user-1");
      await db.query("select delete_account('user-1')");
      expect(await scalar<number>(db, "select count(*)::int from profiles")).toBe(0);
    }));
});
