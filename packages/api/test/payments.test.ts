import { describe, expect, it } from "vitest";
import { withApp, type TestApi } from "./helpers.js";
import type { Db } from "../../db/test/helpers.js";

const PAY = { network: "FLOOZ", phone_number: "96123456" };

async function school(db: Db, code = "ECOLE10") {
  await db.query(
    "insert into driving_schools (name, promo_code, discount_percent, commission_percent) values ('Auto-école Lomé', $1, 10, 10)",
    [code],
  );
}

async function hasPass(api: TestApi, user = "user-a") {
  return (await api.request("GET", "/v1/exams/status", { user })).body.has_pass;
}

describe("Pass Examen : paiement", () => {
  it("donne le prix, réduction de l'auto-école comprise", () =>
    withApp(async (api, db) => {
      expect((await api.request("GET", "/v1/payments/quote", { user: "user-a" })).body).toMatchObject({ base: 3000, discount: 0, amount: 3000, duration_days: 90 });
      await school(db);
      await api.request("POST", "/v1/me/promo-code", { user: "user-a", body: { code: "ecole10" } });
      expect((await api.request("GET", "/v1/payments/quote", { user: "user-a" })).body).toMatchObject({ discount: 300, amount: 2700, school: "Auto-école Lomé" });
    }));

  it("lance le paiement chez PayGate avec le montant calculé par le serveur", () =>
    withApp(async (api) => {
      const res = await api.request("POST", "/v1/payments", { user: "user-a", body: PAY });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: "pending", amount_xof: 3000 });
      expect(api.gateway.initiated).toEqual([{ identifier: res.body.id, amount: 3000, phone: "96123456", network: "FLOOZ", description: "DriveLearn - Pass Examen" }]);
      expect(await hasPass(api)).toBe(false);
    }));

  it("refuse un numéro mal formé et reprend un paiement déjà en cours", () =>
    withApp(async (api) => {
      const bad = await api.request("POST", "/v1/payments", { user: "user-a", body: { network: "FLOOZ", phone_number: "+22896123456" } });
      expect(bad.status).toBe(400);
      const first = await api.request("POST", "/v1/payments", { user: "user-a", body: PAY });
      const again = await api.request("POST", "/v1/payments", { user: "user-a", body: PAY });
      expect(again.body.id).toBe(first.body.id);
      expect(api.gateway.initiated).toHaveLength(1);
    }));

  it("marque le paiement échoué si PayGate le refuse", () =>
    withApp(async (api) => {
      api.gateway.failNext = "invalid_phone";
      const res = await api.request("POST", "/v1/payments", { user: "user-a", body: PAY });
      expect({ status: res.status, error: res.body.error }).toEqual({ status: 400, error: "invalid_phone" });
      const history = await api.request("GET", "/v1/payments", { user: "user-a" });
      expect(history.body[0]).toMatchObject({ status: "failed", failure_reason: "invalid_phone" });
    }));

  it("active le Pass quand PayGate confirme, à l'interrogation de l'application", () =>
    withApp(async (api) => {
      const { body } = await api.request("POST", "/v1/payments", { user: "user-a", body: PAY });
      expect((await api.request("GET", `/v1/payments/${body.id}`, { user: "user-a" })).body.status).toBe("pending");
      api.gateway.remote.set(body.id, "paid");
      expect((await api.request("GET", `/v1/payments/${body.id}`, { user: "user-a" })).body.status).toBe("confirmed");
      expect(await hasPass(api)).toBe(true);
    }));

  it("un autre élève ne voit pas le paiement", () =>
    withApp(async (api) => {
      const { body } = await api.request("POST", "/v1/payments", { user: "user-a", body: PAY });
      expect((await api.request("GET", `/v1/payments/${body.id}`, { user: "user-b" })).status).toBe(404);
    }));
});

describe("notification de PayGate", () => {
  it("n'active rien sur une notification que PayGate ne confirme pas", () =>
    withApp(async (api) => {
      const { body } = await api.request("POST", "/v1/payments", { user: "user-a", body: PAY });
      const hook = await api.request("POST", "/webhooks/paygate", { body: { identifier: body.id, tx_reference: "FAUX", amount: 3000 } });
      expect(hook.status).toBe(200);
      expect(await hasPass(api)).toBe(false);
    }));

  it("confirme une seule fois, même notifiée deux fois", () =>
    withApp(async (api, db) => {
      const { body } = await api.request("POST", "/v1/payments", { user: "user-a", body: PAY });
      api.gateway.remote.set(body.id, "paid");
      for (let i = 0; i < 2; i++) {
        const hook = await api.request("POST", "/webhooks/paygate", { body: { identifier: body.id, tx_reference: 1234, amount: "3000" } });
        expect(hook.status).toBe(200);
      }
      const { rows } = await db.query("select count(*)::int as n from passes where payment_id = $1", [body.id]);
      expect(rows[0].n).toBe(1);
    }));

  it("refuse un montant qui ne correspond pas", () =>
    withApp(async (api) => {
      const { body } = await api.request("POST", "/v1/payments", { user: "user-a", body: PAY });
      api.gateway.remote.set(body.id, "paid");
      const hook = await api.request("POST", "/webhooks/paygate", { body: { identifier: body.id, amount: 100 } });
      expect(hook.status).toBe(409);
      expect(await hasPass(api)).toBe(false);
    }));

  it("honore un paiement confirmé après expiration du délai", () =>
    withApp(async (api, db) => {
      const { body } = await api.request("POST", "/v1/payments", { user: "user-a", body: PAY });
      await db.query("update payments set created_at = now() - interval '1 hour' where id = $1", [body.id]);
      await api.request("POST", "/internal/expire-payments");
      expect((await api.request("GET", "/v1/payments", { user: "user-a" })).body[0].status).toBe("failed");
      api.gateway.remote.set(body.id, "paid");
      await api.request("POST", "/webhooks/paygate", { body: { identifier: body.id, amount: 3000 } });
      expect(await hasPass(api)).toBe(true);
    }));

  it("ignore une notification mal formée ou inconnue", () =>
    withApp(async (api) => {
      expect((await api.request("POST", "/webhooks/paygate", { body: { identifier: "abc" } })).status).toBe(400);
      expect((await api.request("POST", "/webhooks/paygate", { body: { identifier: "00000000-0000-4000-8000-000000000000" } })).status).toBe(404);
    }));
});
