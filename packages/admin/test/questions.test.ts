import { describe, expect, it } from "vitest";
import { createPath, createQuestion, createUser, withTx } from "../../db/test/helpers.js";
import { adminMessage } from "../lib/errors";
import { deleteQuestion, getQuestion, listQuestions, saveQuestion, setQuestionStatus } from "../lib/data/questions";

const base = (unitId: string, lessonId: string | null) => ({
  unit_id: unitId,
  lesson_id: lessonId,
  prompt: "Quel est ce panneau ?",
  image_path: null,
  explanation: "Le mot STOP identifie ce panneau.",
  source: "Livre du code, p. 12",
  choices: [
    { label: "Stop", is_correct: true },
    { label: "Stationnement", is_correct: false },
    { label: "  ", is_correct: false }, // ligne vide du formulaire : ignorée
  ],
});

describe("questions", () => {
  it("crée une question en brouillon en ignorant les choix vides", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const id = await saveQuestion(db, base(unitId, lessonId));
      const q = await getQuestion(db, id);
      expect(q.status).toBe("brouillon");
      expect(q.choices.map((c) => [c.label, c.is_correct, c.position])).toEqual([["Stop", true, 1], ["Stationnement", false, 2]]);
    }));

  it("valide une question complète, puis la renvoie en validation si on la modifie", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const id = await saveQuestion(db, base(unitId, lessonId));
      await setQuestionStatus(db, id, "validee");
      expect((await getQuestion(db, id)).status).toBe("validee");
      await saveQuestion(db, { ...base(unitId, lessonId), id, prompt: "Que signifie ce panneau ?" });
      expect((await getQuestion(db, id)).status).toBe("en_validation");
    }));

  it("refuse de valider une question sans bonne réponse, avec un message clair", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const id = await saveQuestion(db, {
        ...base(unitId, lessonId),
        choices: [{ label: "A", is_correct: false }, { label: "B", is_correct: false }],
      });
      const error = await setQuestionStatus(db, id, "validee").catch((e) => e);
      expect(adminMessage(error)).toBe("Validation impossible : aucune bonne réponse.");
    }));

  it("refuse plus de 8 choix", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const choices = Array.from({ length: 9 }, (_, i) => ({ label: `Choix ${i}`, is_correct: i === 0 }));
      await expect(saveQuestion(db, { ...base(unitId, lessonId), choices })).rejects.toThrow();
    }));

  it("filtre par statut, cherche dans l'énoncé et compte les signalements ouverts", () =>
    withTx(async (db) => {
      const { programId, unitId, lessonId } = await createPath(db);
      const validated = await createQuestion(db, { unitId, lessonId, status: "validee" });
      await createQuestion(db, { unitId, lessonId });
      await createUser(db, "user-a");
      await db.query("select create_report('user-a', $1, 'probleme_image', null)", [validated.id]);

      const onlyValidated = await listQuestions(db, { programId, status: "validee" });
      expect(onlyValidated.total).toBe(1);
      expect(onlyValidated.rows[0]).toMatchObject({ id: validated.id, open_reports: 1, unit_title: "Unité 1", lesson_title: "Leçon 1" });
      expect((await listQuestions(db, { programId, search: "panneau" })).total).toBe(2);
      expect((await listQuestions(db, { programId, search: "introuvable" })).total).toBe(0);
    }));

  it("supprime une question", () =>
    withTx(async (db) => {
      const { programId, unitId, lessonId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId });
      await deleteQuestion(db, q.id);
      expect((await listQuestions(db, { programId })).total).toBe(0);
    }));
});
