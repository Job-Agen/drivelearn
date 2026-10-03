import { describe, expect, it } from "vitest";
import { createPath, createQuestion, createUser, newId, scalar, withTx, type Db } from "../../db/test/helpers";
import * as q from "../lib/queries";

/** La validation d'une question est contrôlée en fin de transaction : on force le contrôle immédiat. */
async function check(db: Db) {
  await db.query("savepoint chk");
  try {
    await db.query("set constraints all immediate");
    await db.query("release savepoint chk");
  } catch (error) {
    await db.query("rollback to savepoint chk");
    throw error;
  }
}

const input = (unitId: string, lessonId: string, over: Partial<q.QuestionInput> = {}): q.QuestionInput => ({
  unitId,
  lessonId,
  prompt: "Que signifie ce panneau ?",
  imagePath: "",
  explanation: "C'est un danger.",
  source: "Livre du code p. 3",
  choices: [
    { label: "Danger", isCorrect: true },
    { label: "Interdiction", isCorrect: false },
  ],
  ...over,
});

describe("questions : édition et validation", () => {
  it("crée une question, la soumet puis la valide", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const id = await q.saveQuestion(db, null, input(unitId, lessonId));
      await q.setQuestionStatus(db, id, "en_validation");
      await q.setQuestionStatus(db, id, "validee");
      await check(db);
      const saved = await q.getQuestion(db, id);
      expect(saved).toMatchObject({ status: "validee", prompt: "Que signifie ce panneau ?" });
      expect(saved!.choices.map((c) => [c.label, c.is_correct])).toEqual([["Danger", true], ["Interdiction", false]]);
    }));

  it("refuse de valider une question sans explication, avec un message lisible", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const id = await q.saveQuestion(db, null, input(unitId, lessonId, { explanation: "" }));
      await q.setQuestionStatus(db, id, "validee");
      const error = await check(db).catch((e) => e);
      expect(q.explainDbError(error)).toBe("Validation impossible : explication manquante.");
    }));

  it("garde l'identifiant des choix modifiés et renvoie la question validée en validation", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const fixture = await createQuestion(db, { unitId, lessonId, status: "validee" });
      const before = await q.getQuestion(db, fixture.id);
      const choices = before!.choices.map((c) => ({ id: c.id, label: c.label + " (corrigé)", isCorrect: c.is_correct }));
      await q.saveQuestion(db, fixture.id, { ...input(unitId, lessonId), prompt: before!.prompt, explanation: before!.explanation ?? "", source: before!.source ?? "", choices });
      const after = await q.getQuestion(db, fixture.id);
      expect(after!.choices.map((c) => c.id)).toEqual(before!.choices.map((c) => c.id));
      expect(after!.status).toBe("en_validation");
    }));

  it("ne touche pas au statut si rien ne change", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const fixture = await createQuestion(db, { unitId, lessonId, status: "validee" });
      const before = (await q.getQuestion(db, fixture.id))!;
      await q.saveQuestion(db, fixture.id, {
        unitId,
        lessonId,
        prompt: before.prompt,
        imagePath: "",
        explanation: before.explanation ?? "",
        source: before.source ?? "",
        choices: before.choices.map((c) => ({ id: c.id, label: c.label, isCorrect: c.is_correct })),
      });
      expect((await q.getQuestion(db, fixture.id))!.status).toBe("validee");
    }));

  it("refuse de supprimer une question déjà jouée", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const fixture = await createQuestion(db, { unitId, lessonId, status: "validee" });
      await createUser(db, "eleve");
      await db.query(
        "select submit_session('eleve', $1, 'lecon', $2, null, now(), 60, $3::jsonb)",
        [newId(), lessonId, JSON.stringify([{ question_id: fixture.id, choice_ids: fixture.correct }])],
      );
      await expect(q.deleteQuestion(db, fixture.id)).rejects.toThrow(/déjà été utilisée/);
    }));
});

describe("programme et examen", () => {
  it("signale une banque insuffisante et bloque la publication", () =>
    withTx(async (db) => {
      const { programId, unitId, lessonId } = await createPath(db, { examQuestionCount: 2, examPassMark: 1 });
      await createQuestion(db, { unitId, lessonId, status: "validee" });
      await expect(q.setProgramStatus(db, programId, "publie")).rejects.toThrow(/Seulement 1 questions validées/);
      await createQuestion(db, { unitId, lessonId, status: "validee" });
      await q.updateExamSettings(db, programId, { count: 2, passMark: 1, seconds: 30, distribution: { [unitId]: 3 } });
      await expect(q.setProgramStatus(db, programId, "publie")).rejects.toThrow(/3 questions prévues, 2 validées/);
      await q.updateExamSettings(db, programId, { count: 2, passMark: 1, seconds: 30, distribution: { [unitId]: 2 } });
      await q.setProgramStatus(db, programId, "publie");
      expect(await scalar(db, "select status from programs where id = $1", [programId])).toBe("publie");
    }));
});

describe("auto-écoles et ventes", () => {
  it("crée une auto-école et calcule ses commissions du mois", () =>
    withTx(async (db) => {
      const schoolId = await q.saveSchool(db, null, { name: "Auto-école du Lac", promoCode: "lac10", discount: 10, commission: 15, active: true });
      await createUser(db, "eleve");
      await db.query("select set_promo_code('eleve', 'LAC10')");
      const pay = await scalar<string>(db, "select id from create_payment('eleve')");
      await db.query("select confirm_payment($1, 'TX1', 2700)", [pay]);
      const month = (await scalar<string>(db, "select to_char(now() at time zone 'Africa/Lome', 'YYYY-MM')"));
      const report = await q.commissionReport(db, month);
      expect(report.find((r) => r.driving_school_id === schoolId)).toMatchObject({ sales_count: 1, revenue_xof: 2700, commission_xof: 405 });
      const rows = await q.listPayments(db, { month, schoolId });
      expect(rows).toHaveLength(1);
      expect(q.paymentsCsv(rows)).toContain(";confirmed;eleve@test.tg;Auto-école du Lac;3000;300;2700;405;TX1");
    }));

  it("refuse un code promo mal formé ou des taux hors limites", () =>
    withTx(async (db) => {
      await expect(q.saveSchool(db, null, { name: "X", promoCode: "a", discount: 10, commission: 10, active: true })).rejects.toThrow(/Code promo/);
      await expect(q.saveSchool(db, null, { name: "X", promoCode: "ABC", discount: 120, commission: 10, active: true })).rejects.toThrow(/pourcentages/);
      await q.saveSchool(db, null, { name: "A", promoCode: "DOUBLE", discount: 10, commission: 10, active: true });
      await expect(q.saveSchool(db, null, { name: "B", promoCode: "double", discount: 10, commission: 10, active: true })).rejects.toThrow(/déjà utilisé/);
    }));
});

describe("réglages et tableau de bord", () => {
  it("met à jour le prix du Pass dans les limites", () =>
    withTx(async (db) => {
      await q.updateSettings(db, { pass_price_xof: 2500 });
      expect((await q.getSettings(db)).pass_price_xof).toBe(2500);
      await expect(q.updateSettings(db, { pass_duration_days: 0 })).rejects.toThrow(/Durée du Pass/);
    }));

  it("compte les questions par statut et les signalements ouverts", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const v = await createQuestion(db, { unitId, lessonId, status: "validee" });
      await createQuestion(db, { unitId, lessonId });
      await createUser(db, "eleve");
      await db.query("select create_report('eleve', $1, 'reponse_incorrecte', null)", [v.id]);
      const d = (await q.dashboard(db))!;
      expect(d.questions.validee).toBeGreaterThanOrEqual(1);
      expect(d.questions.brouillon).toBeGreaterThanOrEqual(1);
      expect(d.open_reports).toBeGreaterThanOrEqual(1);
      const [report] = await q.listReports(db, "nouveau");
      await q.updateReport(db, report.id, "resolu", "Réponse corrigée");
      expect((await q.listReports(db, "resolu"))[0]).toMatchObject({ status: "resolu", admin_note: "Réponse corrigée" });
    }));
});
