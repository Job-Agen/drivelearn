import { describe, expect, it } from "vitest";
import { createPath, createQuestion, type Db } from "../../db/test/helpers.js";
import { withApp, type TestApi } from "./helpers.js";

/** Programme publié, examen de 2 questions avec un seuil de 1. */
async function setup(api: TestApi, db: Db) {
  const path = await createPath(db, { examQuestionCount: 2, examPassMark: 1 });
  await db.query("update programs set status = 'publie' where id = $1", [path.programId]);
  const q1 = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, status: "validee" });
  const q2 = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, status: "validee" });
  await api.request("PATCH", "/v1/me", { user: "user-a", body: { program_id: path.programId } });
  return { correct: new Map([[q1.id, q1.correct], [q2.id, q2.correct]]) };
}

describe("examens blancs", () => {
  it("demande de choisir un programme d'abord", () =>
    withApp(async (api) => {
      const res = await api.request("POST", "/v1/exams", { user: "user-a" });
      expect({ status: res.status, error: res.body.error }).toEqual({ status: 409, error: "program_not_selected" });
    }));

  it("déroule un examen complet : démarrage, reprise, réponses, correction, historique", () =>
    withApp(async (api, db) => {
      const { correct } = await setup(api, db);
      const exam = (await api.request("POST", "/v1/exams", { user: "user-a" })).body;
      expect(exam.total).toBe(2);
      expect(exam.questions[0].choices[0].is_correct).toBeNull();
      expect((await api.request("POST", "/v1/exams", { user: "user-a" })).body.attempt_id).toBe(exam.attempt_id);

      const first = exam.questions[0].id;
      const put = await api.request("PUT", `/v1/exams/${exam.attempt_id}/answers/${first}`, {
        user: "user-a",
        body: { choice_ids: correct.get(first) },
      });
      expect(put.status).toBe(204);

      const result = (await api.request("POST", `/v1/exams/${exam.attempt_id}/submit`, { user: "user-a" })).body;
      expect({ score: result.score, passed: result.passed }).toEqual({ score: 1, passed: true });

      expect((await api.request("GET", "/v1/exams/status", { user: "user-a" })).body).toMatchObject({ exams_taken: 1, free_exam_available: false });
      expect((await api.request("GET", "/v1/exams/history", { user: "user-a" })).body).toHaveLength(1);
      expect((await api.request("GET", `/v1/exams/${exam.attempt_id}`, { user: "user-a" })).body.submitted).toBe(true);
    }));

  it("demande un Pass pour un second examen", () =>
    withApp(async (api, db) => {
      await setup(api, db);
      const exam = (await api.request("POST", "/v1/exams", { user: "user-a" })).body;
      await api.request("POST", `/v1/exams/${exam.attempt_id}/submit`, { user: "user-a" });
      const res = await api.request("POST", "/v1/exams", { user: "user-a" });
      expect({ status: res.status, error: res.body.error }).toEqual({ status: 402, error: "pass_required" });
    }));

  it("cache l'examen aux autres élèves et refuse un identifiant mal formé", () =>
    withApp(async (api, db) => {
      await setup(api, db);
      const exam = (await api.request("POST", "/v1/exams", { user: "user-a" })).body;
      expect((await api.request("GET", `/v1/exams/${exam.attempt_id}`, { user: "user-b" })).status).toBe(404);
      const bad = await api.request("GET", "/v1/exams/abc", { user: "user-a" });
      expect({ status: bad.status, error: bad.body.error }).toEqual({ status: 400, error: "invalid_input" });
    }));
});
