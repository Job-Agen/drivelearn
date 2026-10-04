import { describe, expect, it } from "vitest";
import { createPath, createQuestion, createUser, withTx } from "../../db/test/helpers.js";
import { listReports, updateReport } from "../lib/data/reports";

describe("signalements", () => {
  it("liste les signalements par statut et enregistre le traitement", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId, status: "validee" });
      await createUser(db, "user-a");
      const { rows } = await db.query("select id from create_report('user-a', $1, 'explication_peu_claire', 'Pas clair')", [q.id]);

      const nouveaux = await listReports(db, "nouveau");
      expect(nouveaux).toHaveLength(1);
      expect(nouveaux[0]).toMatchObject({ question_id: q.id, prompt: "Quel est ce panneau ?", reason: "explication_peu_claire", comment: "Pas clair" });

      await updateReport(db, rows[0].id, { status: "resolu", admin_note: "Explication réécrite." });
      expect(await listReports(db, "nouveau")).toHaveLength(0);
      expect((await listReports(db, "resolu"))[0].admin_note).toBe("Explication réécrite.");
    }));
});
