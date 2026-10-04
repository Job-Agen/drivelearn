import { describe, expect, it } from "vitest";
import { createPath, createQuestion, withTx } from "../../db/test/helpers.js";
import {
  createLesson,
  createUnit,
  deleteLesson,
  deleteUnit,
  listUnits,
  moveItem,
  renameUnit,
  updateLesson,
} from "../lib/data/units";

describe("unités et leçons", () => {
  it("ajoute les unités et leçons à la fin, dans l'ordre", () =>
    withTx(async (db) => {
      const { programId, unitId } = await createPath(db);
      const unit2 = await createUnit(db, programId, "Priorités");
      await createLesson(db, unitId, "Les formes");
      const units = await listUnits(db, programId);
      expect(units.map((u) => [u.title, u.position])).toEqual([["Unité 1", 1], ["Priorités", 2]]);
      expect(units[0].lessons.map((l) => l.title)).toEqual(["Leçon 1", "Les formes"]);
      expect(units[1].id).toBe(unit2);
    }));

  it("déplace une unité vers le haut en échangeant les positions", () =>
    withTx(async (db) => {
      const { programId } = await createPath(db);
      const unit2 = await createUnit(db, programId, "Priorités");
      await moveItem(db, "unit", unit2, "up");
      expect((await listUnits(db, programId)).map((u) => u.title)).toEqual(["Priorités", "Unité 1"]);
      await moveItem(db, "unit", unit2, "up"); // déjà en tête : rien ne change
      expect((await listUnits(db, programId)).map((u) => u.title)).toEqual(["Priorités", "Unité 1"]);
    }));

  it("met à jour l'écran d'explication d'une leçon et renomme une unité", () =>
    withTx(async (db) => {
      const { programId, unitId, lessonId } = await createPath(db);
      await renameUnit(db, unitId, "Signalisation");
      await updateLesson(db, lessonId, {
        title: "Reconnaître les formes",
        intro_title: "La forme compte",
        intro_text: "La forme et la couleur donnent des indices.",
        intro_image_path: null,
        mentor_tip: "Observe avant de répondre.",
      });
      const [unit] = await listUnits(db, programId);
      expect(unit.title).toBe("Signalisation");
      expect(unit.lessons[0]).toMatchObject({ title: "Reconnaître les formes", mentor_tip: "Observe avant de répondre." });
    }));

  it("compte les questions de chaque leçon par statut", () =>
    withTx(async (db) => {
      const { programId, unitId, lessonId } = await createPath(db);
      await createQuestion(db, { unitId, lessonId, status: "validee" });
      await createQuestion(db, { unitId, lessonId });
      const [unit] = await listUnits(db, programId);
      expect(unit.lessons[0].counts).toEqual({ validee: 1, brouillon: 1 });
    }));

  it("refuse de supprimer une unité ou une leçon qui contient des questions", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      await createQuestion(db, { unitId, lessonId });
      await expect(deleteLesson(db, lessonId)).rejects.toThrow("contient des questions");
      await expect(deleteUnit(db, unitId)).rejects.toThrow("contient des questions");
    }));

  it("supprime une leçon vide", () =>
    withTx(async (db) => {
      const { programId, lessonId } = await createPath(db);
      await deleteLesson(db, lessonId);
      expect((await listUnits(db, programId))[0].lessons).toEqual([]);
    }));
});
