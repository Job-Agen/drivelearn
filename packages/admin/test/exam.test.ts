import { describe, expect, it } from "vitest";
import { createPath, createQuestion, createUnit, withTx } from "../../db/test/helpers.js";
import { examConformity, getProgram, setProgramStatus, updateExamSettings } from "../lib/data/programs";

describe("examen et publication", () => {
  it("signale une banque insuffisante et refuse la publication", () =>
    withTx(async (db) => {
      const { programId, unitId, lessonId } = await createPath(db, { examQuestionCount: 3, examPassMark: 2 });
      await createQuestion(db, { unitId, lessonId, status: "validee" });
      const c = await examConformity(db, programId);
      expect(c.problems).toEqual(["Banque insuffisante : 1 question(s) validée(s) pour 3 demandée(s)."]);
      await expect(setProgramStatus(db, programId, "publie")).rejects.toThrow("Banque insuffisante");
    }));

  it("vérifie la répartition par unité", () =>
    withTx(async (db) => {
      const { programId, unitId, lessonId } = await createPath(db, { examQuestionCount: 2, examPassMark: 1 });
      const other = await createUnit(db, programId, 2);
      await createQuestion(db, { unitId, lessonId, status: "validee" });
      await createQuestion(db, { unitId, lessonId, status: "validee" });
      await updateExamSettings(db, programId, {
        exam_question_count: 2,
        exam_pass_mark: 1,
        exam_seconds_per_question: 30,
        exam_distribution: { [unitId]: 1, [other]: 2 },
      });
      const c = await examConformity(db, programId);
      expect(c.problems).toEqual([
        "La répartition totalise 3 question(s) au lieu de 2.",
        "L'unité « Unité 2 » n'a que 0 question(s) validée(s) pour 2 demandée(s).",
      ]);
    }));

  it("publie un programme conforme", () =>
    withTx(async (db) => {
      const { programId, unitId, lessonId } = await createPath(db, { examQuestionCount: 1, examPassMark: 1 });
      await createQuestion(db, { unitId, lessonId, status: "validee" });
      expect((await examConformity(db, programId)).problems).toEqual([]);
      await setProgramStatus(db, programId, "publie");
      expect((await getProgram(db, programId)).status).toBe("publie");
    }));

  it("enregistre les paramètres et retire les unités à zéro", () =>
    withTx(async (db) => {
      const { programId, unitId } = await createPath(db);
      const other = await createUnit(db, programId, 2);
      await updateExamSettings(db, programId, {
        exam_question_count: 20,
        exam_pass_mark: 13,
        exam_seconds_per_question: 25,
        exam_distribution: { [unitId]: 20, [other]: 0 },
      });
      const p = await getProgram(db, programId);
      expect({ seconds: p.exam_seconds_per_question, distribution: p.exam_distribution }).toEqual({ seconds: 25, distribution: { [unitId]: 20 } });
    }));

  it("refuse une unité d'un autre programme et un seuil impossible", () =>
    withTx(async (db) => {
      const a = await createPath(db);
      await db.query("update programs set license_type = 'moto' where id = $1", [a.programId]);
      const b = await createPath(db);
      const settings = { exam_question_count: 20, exam_pass_mark: 13, exam_seconds_per_question: 30 };
      await expect(updateExamSettings(db, b.programId, { ...settings, exam_distribution: { [a.unitId]: 5 } })).rejects.toThrow("Unité inconnue");
      await expect(updateExamSettings(db, b.programId, { ...settings, exam_pass_mark: 25, exam_distribution: {} })).rejects.toThrow();
    }));
});
