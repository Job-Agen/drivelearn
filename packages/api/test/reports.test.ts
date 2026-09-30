import { describe, expect, it } from "vitest";
import { createPath, createQuestion } from "../../db/test/helpers.js";
import { withApp } from "./helpers.js";

describe("signalements", () => {
  it("enregistre un signalement", () =>
    withApp(async (api, db) => {
      const { unitId, lessonId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId, status: "validee" });
      const res = await api.request("POST", "/v1/reports", {
        user: "user-a",
        body: { question_id: q.id, reason: "explication_peu_claire", comment: "Pas clair" },
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    }));

  it("refuse une question indisponible ou une raison inconnue", () =>
    withApp(async (api, db) => {
      const { unitId, lessonId } = await createPath(db);
      const draft = await createQuestion(db, { unitId, lessonId });
      const unknown = await api.request("POST", "/v1/reports", {
        user: "user-a",
        body: { question_id: draft.id, reason: "reponse_incorrecte" },
      });
      expect({ status: unknown.status, error: unknown.body.error }).toEqual({ status: 422, error: "unknown_question" });
      const badReason = await api.request("POST", "/v1/reports", {
        user: "user-a",
        body: { question_id: draft.id, reason: "autre" },
      });
      expect(badReason.status).toBe(400);
    }));
});
