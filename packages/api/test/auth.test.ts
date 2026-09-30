import { generateKeyPair } from "jose";
import { describe, expect, it } from "vitest";
import { scalar } from "../../db/test/helpers.js";
import { signToken, withApp } from "./helpers.js";

describe("authentification", () => {
  it("laisse /health public", () =>
    withApp(async (api) => {
      expect(await api.request("GET", "/health")).toEqual({ status: 200, body: { ok: true } });
    }));

  it("refuse une requête sans jeton", () =>
    withApp(async (api) => {
      const res = await api.request("GET", "/v1/me");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("unauthorized");
    }));

  it("refuse un jeton signé par une autre clé", () =>
    withApp(async (api) => {
      const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
      const token = await signToken("user-a", { key: privateKey });
      expect((await api.request("GET", "/v1/me", { token })).status).toBe(401);
    }));

  it("refuse un jeton expiré ou d'un autre émetteur", () =>
    withApp(async (api) => {
      const expired = await signToken("user-a", { expiresAt: Math.floor(Date.now() / 1000) - 60 });
      const foreign = await signToken("user-a", { issuer: "https://ailleurs.test" });
      expect((await api.request("GET", "/v1/me", { token: expired })).status).toBe(401);
      expect((await api.request("GET", "/v1/me", { token: foreign })).status).toBe(401);
    }));

  it("exige une adresse e-mail vérifiée quand c'est demandé", () =>
    withApp(async (api) => {
      const token = await signToken("user-a", { emailVerified: false });
      const res = await api.request("GET", "/v1/me", { token });
      expect({ status: res.status, error: res.body.error }).toEqual({ status: 403, error: "email_not_verified" });
    }));

  it("accepte une adresse non vérifiée quand ce n'est pas demandé", () =>
    withApp(
      async (api) => {
        const token = await signToken("user-a", { emailVerified: false });
        expect((await api.request("GET", "/v1/me", { token })).status).toBe(200);
      },
      { requireVerifiedEmail: false },
    ));

  it("crée le profil à la première requête authentifiée", () =>
    withApp(async (api, db) => {
      const res = await api.request("GET", "/v1/me", { user: "user-a" });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe("user-a@test.tg");
      expect(await scalar<number>(db, "select count(*)::int from profiles where id = 'user-a'")).toBe(1);
    }));

  it("répond 400 (et non 500) à un corps JSON mal formé ou vide", () =>
    withApp(async (api) => {
      const token = await signToken("user-a");
      for (const [path, body] of [["/v1/me", "{bad"], ["/v1/sessions", "pas du json"], ["/v1/reports", ""]] as const) {
        const res = await api.raw(path.startsWith("/v1/me") ? "PATCH" : "POST", path, body, token);
        expect({ path, status: res.status, error: res.body.error }).toEqual({ path, status: 400, error: "invalid_input" });
      }
    }));

  it("répond 404 en JSON sur une route inconnue", () =>
    withApp(async (api) => {
      const res = await api.request("GET", "/v1/inexistant", { user: "user-a" });
      expect({ status: res.status, error: res.body.error }).toEqual({ status: 404, error: "not_found" });
    }));
});
