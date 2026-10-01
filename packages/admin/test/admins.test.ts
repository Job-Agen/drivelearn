import { describe, expect, it } from "vitest";
import { withTx } from "../../db/test/helpers.js";
import { isAdminUser, makeAdmin } from "../lib/data/admins";

describe("administrateurs", () => {
  it("ne reconnaît que les identifiants présents dans admins", () =>
    withTx(async (db) => {
      await db.query("insert into admins (user_id) values ('admin-1')");
      expect(await isAdminUser(db, "admin-1")).toBe(true);
      expect(await isAdminUser(db, "eleve-1")).toBe(false);
    }));

  it("nomme administrateur un compte Neon Auth par son e-mail", () =>
    withTx(async (db) => {
      await db.query("create schema if not exists neon_auth");
      await db.query(`create table if not exists neon_auth."user" (id text primary key, email text not null)`);
      await db.query(`insert into neon_auth."user" (id, email) values ('u-42', 'chef@drivelearn.tg')`);
      expect(await makeAdmin(db, "Chef@DriveLearn.tg")).toBe("u-42");
      expect(await isAdminUser(db, "u-42")).toBe(true);
      expect(await makeAdmin(db, "chef@drivelearn.tg")).toBe("u-42"); // idempotent
    }));

  it("refuse un e-mail inconnu", () =>
    withTx(async (db) => {
      await db.query("create schema if not exists neon_auth");
      await db.query(`create table if not exists neon_auth."user" (id text primary key, email text not null)`);
      await expect(makeAdmin(db, "personne@drivelearn.tg")).rejects.toThrow("Aucun compte");
    }));
});
