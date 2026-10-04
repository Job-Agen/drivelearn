import { describe, expect, it } from "vitest";
import { createPath, createQuestion, withTx } from "../../db/test/helpers.js";
import { createProgram, getProgram, listPrograms } from "../lib/data/programs";

describe("programmes", () => {
  it("crée un programme en brouillon avec l'examen togolais par défaut", () =>
    withTx(async (db) => {
      const id = await createProgram(db, { country_code: "bj", license_type: "voiture", name: "Bénin — Permis voiture" });
      const program = await getProgram(db, id);
      expect(program).toMatchObject({ country_code: "BJ", status: "brouillon", exam_question_count: 20, exam_pass_mark: 13 });
    }));

  it("refuse un code pays invalide", () =>
    withTx(async (db) => {
      await expect(createProgram(db, { country_code: "Togo", license_type: "voiture", name: "X" })).rejects.toThrow();
    }));

  it("compte les leçons et les questions validées ou en attente", () =>
    withTx(async (db) => {
      const { programId, unitId, lessonId } = await createPath(db);
      await createQuestion(db, { unitId, lessonId, status: "validee" });
      await createQuestion(db, { unitId, lessonId });
      const [row] = (await listPrograms(db)).filter((p) => p.id === programId);
      expect({ lessons: row.lessons, validated: row.validated_questions, pending: row.pending_questions }).toEqual({
        lessons: 1,
        validated: 1,
        pending: 1,
      });
    }));
});
