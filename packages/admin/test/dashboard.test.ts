import { describe, expect, it } from "vitest";
import { createPath, createQuestion, createUser, withTx } from "../../db/test/helpers.js";
import { getDashboard } from "../lib/data/dashboard";

describe("tableau de bord", () => {
  it("résume élèves, questions, signalements et ventes du mois", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId, status: "validee" });
      await createQuestion(db, { unitId, lessonId });
      await createUser(db, "user-a");
      await db.query("select create_report('user-a', $1, 'probleme_image', null)", [q.id]);
      const p = (await db.query("select id from create_payment('user-a')")).rows[0].id;
      await db.query("select confirm_payment($1, 'REF1', 3000)", [p]);

      const d = await getDashboard(db);
      expect(d.students).toBeGreaterThanOrEqual(1);
      expect(d.questions).toMatchObject({ validee: 1, brouillon: 1 });
      expect(d.open_reports).toBeGreaterThanOrEqual(1);
      expect(d.month.sales).toBeGreaterThanOrEqual(1);
      expect(d.month.revenue_xof).toBeGreaterThanOrEqual(3000);
    }));
});
