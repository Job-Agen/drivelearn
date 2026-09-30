import { describe, expect, it } from "vitest";
import { createPath, scalar } from "../../db/test/helpers.js";
import { withApp } from "./helpers.js";

describe("profil", () => {
  it("renvoie le profil avec les préférences par défaut", () =>
    withApp(async (api) => {
      const res = await api.request("GET", "/v1/me", { user: "user-a" });
      expect(res.body).toMatchObject({
        id: "user-a",
        first_name: null,
        program_id: null,
        daily_goal_minutes: 5,
        reminder_enabled: true,
        reminder_time: "19:00",
        driving_school_name: null,
      });
    }));

  it("met à jour les préférences", () =>
    withApp(async (api) => {
      const res = await api.request("PATCH", "/v1/me", {
        user: "user-a",
        body: { first_name: "Ama", daily_goal_minutes: 10, reminder_enabled: false, reminder_time: "20:30" },
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ first_name: "Ama", daily_goal_minutes: 10, reminder_enabled: false, reminder_time: "20:30" });
    }));

  it("refuse un objectif invalide, une heure invalide ou un champ inconnu", () =>
    withApp(async (api) => {
      for (const body of [{ daily_goal_minutes: 7 }, { reminder_time: "25:00" }, { is_admin: true }]) {
        const res = await api.request("PATCH", "/v1/me", { user: "user-a", body });
        expect({ status: res.status, error: res.body.error }).toEqual({ status: 400, error: "invalid_input" });
      }
    }));

  it("n'accepte qu'un programme publié", () =>
    withApp(async (api, db) => {
      const { programId } = await createPath(db);
      const refused = await api.request("PATCH", "/v1/me", { user: "user-a", body: { program_id: programId } });
      expect({ status: refused.status, error: refused.body.error }).toEqual({ status: 400, error: "program_not_available" });

      await db.query("update programs set status = 'publie' where id = $1", [programId]);
      const accepted = await api.request("PATCH", "/v1/me", { user: "user-a", body: { program_id: programId } });
      expect(accepted.body.program_id).toBe(programId);
    }));
});

describe("code promo", () => {
  it("rattache l'élève à une auto-école", () =>
    withApp(async (api, db) => {
      await db.query("insert into driving_schools (name, promo_code) values ('Auto-école Le Volant', 'VOLANT')");
      const res = await api.request("POST", "/v1/me/promo-code", { user: "user-a", body: { code: "volant" } });
      expect(res.body).toEqual({ driving_school_name: "Auto-école Le Volant" });
      expect((await api.request("GET", "/v1/me", { user: "user-a" })).body.driving_school_name).toBe("Auto-école Le Volant");
    }));

  it("refuse un code inconnu", () =>
    withApp(async (api) => {
      const res = await api.request("POST", "/v1/me/promo-code", { user: "user-a", body: { code: "INCONNU" } });
      expect({ status: res.status, error: res.body.error }).toEqual({ status: 400, error: "invalid_promo_code" });
    }));
});

describe("suppression de compte", () => {
  it("supprime les données puis le compte Neon Auth", () =>
    withApp(async (api, db) => {
      await api.request("GET", "/v1/me", { user: "user-a" });
      const res = await api.request("DELETE", "/v1/me", { user: "user-a" });
      expect(res.status).toBe(204);
      expect(api.deleted).toEqual(["user-a"]);
      expect(await scalar<number>(db, "select count(*)::int from profiles where id = 'user-a'")).toBe(0);
    }));

  it("demande de réessayer si Neon Auth ne répond pas, et l'essai suivant aboutit", async () => {
    await withApp(
      async (api) => {
        const res = await api.request("DELETE", "/v1/me", { user: "user-a" });
        expect({ status: res.status, error: res.body.error }).toEqual({ status: 502, error: "auth_delete_failed" });
        expect(res.body.message).toMatch(/Réessayez/);
      },
      { failAuthDelete: true },
    );
    await withApp(async (api) => {
      expect((await api.request("DELETE", "/v1/me", { user: "user-a" })).status).toBe(204);
    });
  });
});
