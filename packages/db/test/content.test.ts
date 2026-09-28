import { describe, expect, it } from "vitest";
import { createPath, createQuestion, expectError, scalar, withTx } from "./helpers.js";

describe("contenu", () => {
  it("a les paramètres de l'examen togolais par défaut", () =>
    withTx(async (db) => {
      const { programId } = await createPath(db);
      const { rows } = await db.query(
        "select exam_question_count, exam_pass_mark from programs where id = $1",
        [programId],
      );
      expect(rows[0]).toEqual({ exam_question_count: 20, exam_pass_mark: 13 });
      expect(await scalar<number>(db, "select setting_int('pass_duration_days')")).toBe(90);
      expect(await scalar<number>(db, "select setting_int('pass_price_xof')")).toBe(3000);
    }));

  it("refuse un seuil supérieur au nombre de questions", () =>
    withTx(async (db) => {
      const { programId } = await createPath(db);
      await expectError(db, "update programs set exam_pass_mark = 21 where id = $1", [programId], "programs_pass_mark_check");
    }));

  it("refuse deux programmes pour le même pays et le même permis", () =>
    withTx(async (db) => {
      await createPath(db);
      await expectError(
        db,
        "insert into programs (country_code, license_type, name) values ('TG', 'voiture', 'Doublon')",
        [],
        "programs_country_code_license_type_key",
      );
    }));

  it("incrémente la version du contenu à chaque modification", () =>
    withTx(async (db) => {
      const before = await scalar<number>(db, "select version::int from content_version");
      await createPath(db);
      const after = await scalar<number>(db, "select version::int from content_version");
      expect(after).toBeGreaterThan(before);
    }));
});

describe("validation d'une question", () => {
  type Overrides = { correct?: number; wrong?: number; explanation?: string | null; source?: string | null };
  const cases: Array<[string, Overrides, string]> = [
    ["sans bonne réponse", { correct: 0, wrong: 2 }, "aucune bonne réponse"],
    ["sans choix", { correct: 0, wrong: 0 }, "il faut entre 2 et 8 choix"],
    ["avec 9 choix", { correct: 1, wrong: 8 }, "il faut entre 2 et 8 choix"],
    ["sans explication", { explanation: null }, "explication manquante"],
    ["sans source", { source: "  " }, "source manquante"],
  ];

  it.each(cases)("refuse une question %s", (_label, overrides, message) =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId, ...overrides });
      await db.query("set constraints all immediate");
      await expectError(db, "update questions set status = 'validee' where id = $1", [q.id], message);
    }));

  it("refuse une question sans leçon", () =>
    withTx(async (db) => {
      const { unitId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId: null });
      await db.query("set constraints all immediate");
      await expectError(db, "update questions set status = 'validee' where id = $1", [q.id], "aucune leçon");
    }));

  it("valide une question complète", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId, correct: 2, wrong: 2 });
      await db.query("set constraints all immediate");
      await db.query("update questions set status = 'validee' where id = $1", [q.id]);
      expect(await scalar<string>(db, "select status::text from questions where id = $1", [q.id])).toBe("validee");
    }));

  it("renvoie en validation une question validée dont l'énoncé change", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId, status: "validee" });
      await db.query("update questions set prompt = 'Nouvel énoncé' where id = $1", [q.id]);
      expect(await scalar<string>(db, "select status::text from questions where id = $1", [q.id])).toBe("en_validation");
    }));

  it("renvoie en validation une question validée dont on retire la bonne réponse", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId, correct: 1, wrong: 2, status: "validee" });
      await db.query("delete from choices where id = $1", [q.correct[0]]);
      await db.query("set constraints all immediate");
      expect(await scalar<string>(db, "select status::text from questions where id = $1", [q.id])).toBe("en_validation");
    }));

  it("garde validée une question dont seul l'ordre change", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId, status: "validee" });
      await db.query("update questions set position = 5 where id = $1", [q.id]);
      expect(await scalar<string>(db, "select status::text from questions where id = $1", [q.id])).toBe("validee");
    }));
});
