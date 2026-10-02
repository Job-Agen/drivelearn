import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPath, createQuestion, type Db } from "../../db/test/helpers.js";
import { withApp, type TestApi } from "./helpers.js";

async function setup(api: TestApi, db: Db) {
  const path = await createPath(db);
  await db.query("update programs set status = 'publie' where id = $1", [path.programId]);
  const ok = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, status: "validee" });
  const retired = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, status: "en_validation" });
  await api.request("PATCH", "/v1/me", { user: "user-a", body: { program_id: path.programId } });
  return { ...path, ok, retired };
}

const session = (lessonId: string, questionId: string, choiceIds: string[], id = randomUUID()) => ({
  id,
  kind: "lecon",
  lesson_id: lessonId,
  completed_at: new Date().toISOString(),
  active_seconds: 120,
  answers: [{ question_id: questionId, choice_ids: choiceIds }],
});

describe("séances hors ligne", () => {
  it("enregistre les séances valides et rejette seulement celle qui porte sur une question retirée", () =>
    withApp(async (api, db) => {
      const { lessonId, ok, retired } = await setup(api, db);
      const good = session(lessonId, ok.id, ok.correct);
      const bad = session(lessonId, retired.id, retired.correct);
      const res = await api.request("POST", "/v1/sessions", { user: "user-a", body: { sessions: [good, bad] } });
      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([
        { id: good.id, status: "ok", xp_earned: 15, correct_count: 1, question_count: 1 },
        { id: bad.id, status: "rejected", error: "unknown_question" },
      ]);
    }));

  it("accepte un renvoi du même lot sans double XP", () =>
    withApp(async (api, db) => {
      const { lessonId, ok } = await setup(api, db);
      const body = { sessions: [session(lessonId, ok.id, ok.correct)] };
      await api.request("POST", "/v1/sessions", { user: "user-a", body });
      const again = await api.request("POST", "/v1/sessions", { user: "user-a", body });
      expect(again.body.results[0].status).toBe("ok");
      expect((await api.request("GET", "/v1/progress", { user: "user-a" })).body.total_xp).toBe(15);
    }));

  it("refuse un lot mal formé", () =>
    withApp(async (api, db) => {
      const { lessonId, ok } = await setup(api, db);
      const tooMany = Array.from({ length: 51 }, () => session(lessonId, ok.id, ok.correct));
      for (const body of [{ sessions: [] }, { sessions: tooMany }, { sessions: [{ ...session(lessonId, ok.id, ok.correct), id: "abc" }] }]) {
        const res = await api.request("POST", "/v1/sessions", { user: "user-a", body });
        expect({ status: res.status, error: res.body.error }).toEqual({ status: 400, error: "invalid_input" });
      }
    }));
});

describe("révision et progrès", () => {
  it("renvoie les questions à revoir après une erreur", () =>
    withApp(async (api, db) => {
      const { lessonId, ok } = await setup(api, db);
      await api.request("POST", "/v1/sessions", { user: "user-a", body: { sessions: [session(lessonId, ok.id, ok.wrong)] } });
      const res = await api.request("GET", "/v1/review?limit=10", { user: "user-a" });
      expect(res.body).toEqual({ question_ids: [ok.id] });
    }));

  it("renvoie les progrès de l'élève", () =>
    withApp(async (api, db) => {
      const { lessonId, ok } = await setup(api, db);
      await api.request("POST", "/v1/sessions", { user: "user-a", body: { sessions: [session(lessonId, ok.id, ok.correct)] } });
      const res = await api.request("GET", "/v1/progress", { user: "user-a" });
      expect(res.body).toMatchObject({ current_streak: 1, practiced_today: true, total_xp: 15, today_minutes: 2 });
      expect(res.body.completed_lesson_ids).toEqual([lessonId]);
    }));
});
