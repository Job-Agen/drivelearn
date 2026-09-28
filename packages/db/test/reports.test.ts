import { describe, expect, it } from "vitest";
import { createPath, createQuestion, createUser, expectError, scalar, withTx, type Db } from "./helpers.js";

async function setup(db: Db) {
  const { unitId, lessonId } = await createPath(db);
  const validated = await createQuestion(db, { unitId, lessonId, status: "validee" });
  const draft = await createQuestion(db, { unitId, lessonId });
  await createUser(db, "user-a");
  return { validated, draft };
}

const REPORT = "select * from create_report($1, $2, $3, $4)";

describe("signalements", () => {
  it("enregistre un signalement au statut « nouveau »", () =>
    withTx(async (db) => {
      const { validated } = await setup(db);
      const { rows } = await db.query(REPORT, ["user-a", validated.id, "explication_peu_claire", "Pas clair"]);
      expect({ status: rows[0].status, reason: rows[0].reason }).toEqual({ status: "nouveau", reason: "explication_peu_claire" });
    }));

  it("refuse une question non publiée", () =>
    withTx(async (db) => {
      const { draft } = await setup(db);
      await expectError(db, REPORT, ["user-a", draft.id, "reponse_incorrecte", null], "unknown_question");
    }));

  it("refuse un commentaire de plus de 500 caractères", () =>
    withTx(async (db) => {
      const { validated } = await setup(db);
      await expectError(db, REPORT, ["user-a", validated.id, "probleme_image", "x".repeat(501)], "question_reports_comment_check");
    }));

  it("limite à 20 signalements par jour", () =>
    withTx(async (db) => {
      const { validated } = await setup(db);
      for (let i = 0; i < 20; i++) await db.query(REPORT, ["user-a", validated.id, "reponse_incorrecte", null]);
      await expectError(db, REPORT, ["user-a", validated.id, "reponse_incorrecte", null], "too_many_reports");
      expect(await scalar<number>(db, "select count(*)::int from question_reports")).toBe(20);
    }));
});
