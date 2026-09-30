import { describe, expect, it } from "vitest";
import { createLesson, createPath, createQuestion, type Db } from "../../db/test/helpers.js";
import { withApp } from "./helpers.js";

async function publishedProgram(db: Db) {
  const path = await createPath(db);
  await db.query("update programs set status = 'publie' where id = $1", [path.programId]);
  const single = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, status: "validee" });
  const multi = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, correct: 2, wrong: 1, status: "validee" });
  await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId }); // brouillon : invisible
  const emptyLesson = await createLesson(db, path.unitId, 2); // aucune question validée : invisible
  await createQuestion(db, { unitId: path.unitId, lessonId: emptyLesson });
  return { ...path, single, multi };
}

describe("programmes", () => {
  it("liste les programmes et indique ceux qui sont disponibles", () =>
    withApp(async (api, db) => {
      const { programId } = await createPath(db);
      const before = await api.request("GET", "/v1/programs", { user: "user-a" });
      expect(before.body).toEqual([
        { id: programId, country_code: "TG", license_type: "voiture", name: "Togo — Permis voiture", available: false },
      ]);
      await db.query("update programs set status = 'publie' where id = $1", [programId]);
      expect((await api.request("GET", "/v1/programs", { user: "user-a" })).body[0].available).toBe(true);
    }));
});

describe("contenu hors ligne", () => {
  it("demande de choisir un programme d'abord", () =>
    withApp(async (api) => {
      const res = await api.request("GET", "/v1/content", { user: "user-a" });
      expect({ status: res.status, error: res.body.error }).toEqual({ status: 409, error: "program_not_selected" });
    }));

  it("renvoie uniquement le contenu validé, avec les bonnes réponses pour le mode hors ligne", () =>
    withApp(async (api, db) => {
      const { programId, lessonId, single, multi } = await publishedProgram(db);
      await api.request("PATCH", "/v1/me", { user: "user-a", body: { program_id: programId } });

      const res = await api.request("GET", "/v1/content", { user: "user-a" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ changed: true, images_base_url: "https://images.drivelearn.test", max_review_per_lesson: 2 });
      expect(res.body.content.program).toMatchObject({ id: programId, exam_question_count: 20, exam_pass_mark: 13 });

      const units = res.body.content.units;
      expect(units).toHaveLength(1);
      expect(units[0].lessons.map((l: { id: string }) => l.id)).toEqual([lessonId]);
      const questions = units[0].lessons[0].questions;
      expect(questions.map((q: { id: string }) => q.id).sort()).toEqual([single.id, multi.id].sort());
      const multiQ = questions.find((q: { id: string }) => q.id === multi.id);
      expect(multiQ.multiple).toBe(true);
      expect(multiQ.choices.filter((c: { is_correct: boolean }) => c.is_correct)).toHaveLength(2);
    }));

  it("répond « rien de nouveau » quand l'app a déjà la dernière version", () =>
    withApp(async (api, db) => {
      const { programId } = await publishedProgram(db);
      await api.request("PATCH", "/v1/me", { user: "user-a", body: { program_id: programId } });
      const first = await api.request("GET", "/v1/content", { user: "user-a" });
      const again = await api.request("GET", `/v1/content?version=${first.body.version}`, { user: "user-a" });
      expect(again.body).toEqual({ changed: false, version: first.body.version });
    }));
});
