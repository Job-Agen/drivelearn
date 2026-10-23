import { describe, expect, it } from "vitest";
import { createUser, expectError, scalar, withTx, type Db } from "./helpers.js";

const batch = (db: Db, count: number, days: number | null = 90) =>
  scalar<string>(db, "select create_pass_code_batch('Lot de test', null, $1, $2)", [count, days]);
const codesOf = (db: Db, batchId: string) =>
  db.query<{ code: string }>("select code from pass_codes where batch_id = $1", [batchId]).then((r) => r.rows.map((x) => x.code));
const redeem = (db: Db, user: string, code: string) =>
  db.query("select * from redeem_pass_code($1, $2)", [user, code]).then((r) => r.rows[0]);

describe("codes d'activation du Pass", () => {
  it("crée des codes uniques, lisibles et sans caractères ambigus", () =>
    withTx(async (db) => {
      const codes = await codesOf(db, await batch(db, 200));
      expect(codes).toHaveLength(200);
      expect(new Set(codes).size).toBe(200);
      for (const c of codes) expect(c).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    }));

  it("prend la durée des réglages si aucune n'est donnée, et refuse un nombre de codes invalide", () =>
    withTx(async (db) => {
      const id = await batch(db, 1, null);
      expect(await scalar<number>(db, "select duration_days from pass_code_batches where id = $1", [id])).toBe(
        await scalar<number>(db, "select setting_int('pass_duration_days')"),
      );
      await expectError(db, "select create_pass_code_batch('x', null, 0, 90)", [], "invalid_code_count");
      await expectError(db, "select create_pass_code_batch('x', null, 1001, 90)", [], "invalid_code_count");
    }));

  it("active un Pass de la durée du lot, une seule fois, en acceptant minuscules, espaces et tirets oubliés", () =>
    withTx(async (db) => {
      await createUser(db, "user-a");
      await createUser(db, "user-b");
      const [code] = await codesOf(db, await batch(db, 1, 30));
      const typed = ` ${code.replace(/-/g, "").toLowerCase()} `;
      const pass = await redeem(db, "user-a", typed);
      expect(pass.pass_code).toBe(code);
      const days = (new Date(pass.ends_at).getTime() - new Date(pass.starts_at).getTime()) / 86_400_000;
      expect(days).toBe(30);
      expect(await scalar<boolean>(db, "select has_active_pass('user-a')")).toBe(true);
      await expectError(db, "select redeem_pass_code('user-b', $1)", [code], "pass_code_used");
      await expectError(db, "select redeem_pass_code('user-a', $1)", [code], "pass_code_used");
    }));

  it("refuse un code inconnu", () =>
    withTx(async (db) => {
      await createUser(db, "user-a");
      await expectError(db, "select redeem_pass_code('user-a', 'ABCD-EFGH-JKLM')", [], "invalid_pass_code");
      await expectError(db, "select redeem_pass_code('user-a', '')", [], "invalid_pass_code");
    }));

  it("enchaîne un deuxième Pass à la fin du premier", () =>
    withTx(async (db) => {
      await createUser(db, "user-a");
      const [c1, c2] = await codesOf(db, await batch(db, 2, 90));
      const first = await redeem(db, "user-a", c1);
      const second = await redeem(db, "user-a", c2);
      expect(new Date(second.starts_at).getTime()).toBe(new Date(first.ends_at).getTime());
    }));

  it("garde le code utilisé quand le compte est supprimé", () =>
    withTx(async (db) => {
      await createUser(db, "user-a");
      const [code] = await codesOf(db, await batch(db, 1));
      await redeem(db, "user-a", code);
      await db.query("select delete_account('user-a')");
      const row = (await db.query("select redeemed_by, redeemed_at from pass_codes where code = $1", [code])).rows[0];
      expect(row.redeemed_by).toBeNull();
      expect(row.redeemed_at).not.toBeNull();
    }));
});
