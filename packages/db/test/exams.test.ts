import { describe, expect, it } from "vitest";
import { createLesson, createPath, createQuestion, createUnit, createUser, expectError, scalar, withTx, type Db } from "./helpers.js";

type Exam = {
  attempt_id: string;
  total: number;
  submitted: boolean;
  score: number | null;
  passed: boolean | null;
  questions: Array<{
    id: string;
    multiple: boolean;
    explanation: string | null;
    is_correct: boolean | null;
    choices: Array<{ id: string; is_correct: boolean | null }>;
  }>;
};

/** Programme à 3 questions, seuil 2, deux unités de deux questions validées. */
async function setup(db: Db) {
  const { programId, unitId: unitA, lessonId: lessonA } = await createPath(db, { examQuestionCount: 3, examPassMark: 2 });
  const unitB = await createUnit(db, programId, 2);
  const lessonB = await createLesson(db, unitB, 1);
  const questions = [
    await createQuestion(db, { unitId: unitA, lessonId: lessonA, status: "validee" }),
    await createQuestion(db, { unitId: unitA, lessonId: lessonA, status: "validee" }),
    await createQuestion(db, { unitId: unitB, lessonId: lessonB, status: "validee" }),
    await createQuestion(db, { unitId: unitB, lessonId: lessonB, status: "validee" }),
  ];
  const correct = new Map(questions.map((q) => [q.id, q.correct]));
  const wrong = new Map(questions.map((q) => [q.id, q.wrong]));
  for (const user of ["user-a", "user-b", "user-c"]) await createUser(db, user);
  return { programId, unitA, questions, correct, wrong };
}

const start = (db: Db, user: string, programId: string) =>
  scalar<Exam>(db, "select start_exam($1, $2)", [user, programId]);
const getExam = (db: Db, user: string, attemptId: string) =>
  scalar<Exam>(db, "select get_exam($1, $2)", [user, attemptId]);
const save = (db: Db, user: string, attemptId: string, questionId: string, choiceIds: string[]) =>
  db.query("select save_exam_answer($1, $2, $3, $4::uuid[])", [user, attemptId, questionId, choiceIds]);
const submitExam = (db: Db, user: string, attemptId: string) =>
  scalar<Exam>(db, "select submit_exam($1, $2)", [user, attemptId]);
const status = (db: Db, user: string) => scalar<Record<string, unknown>>(db, "select get_exam_status($1)", [user]);
const givePass = (db: Db, user: string) =>
  db.query("insert into passes (user_id, starts_at, ends_at) values ($1, now() - interval '1 day', now() + interval '89 days')", [user]);

describe("examen gratuit", () => {
  it("démarre un examen de 3 questions sans révéler les réponses", () =>
    withTx(async (db) => {
      const { programId } = await setup(db);
      expect((await status(db, "user-a")).free_exam_available).toBe(true);
      const exam = await start(db, "user-a", programId);
      expect(exam.total).toBe(3);
      expect(exam.questions).toHaveLength(3);
      for (const q of exam.questions) {
        expect(q.explanation).toBeNull();
        expect(q.is_correct).toBeNull();
        expect(q.multiple).toBe(false);
        expect(q.choices.every((c) => c.is_correct === null)).toBe(true);
      }
    }));

  it("reprend l'examen en cours au lieu d'en consommer un second", () =>
    withTx(async (db) => {
      const { programId } = await setup(db);
      const first = await start(db, "user-a", programId);
      const again = await start(db, "user-a", programId);
      expect(again.attempt_id).toBe(first.attempt_id);
      expect(await scalar<number>(db, "select count(*)::int from exam_attempts where user_id = 'user-a'")).toBe(1);
    }));

  it("note tout ou rien, sans retour en arrière, puis demande un Pass", () =>
    withTx(async (db) => {
      const { programId, correct, wrong } = await setup(db);
      const exam = await start(db, "user-a", programId);
      const [q1, q2, q3] = exam.questions.map((q) => q.id);

      await save(db, "user-a", exam.attempt_id, q1, correct.get(q1)!);
      await save(db, "user-a", exam.attempt_id, q2, correct.get(q2)!);
      await save(db, "user-a", exam.attempt_id, q1, wrong.get(q1)!); // ignorée : première réponse définitive

      const result = await submitExam(db, "user-a", exam.attempt_id);
      expect({ score: result.score, passed: result.passed }).toEqual({ score: 2, passed: true });
      expect((await submitExam(db, "user-a", exam.attempt_id)).score).toBe(2);

      const corrected = await getExam(db, "user-a", exam.attempt_id);
      expect(corrected.questions.find((q) => q.id === q3)!.is_correct).toBe(false);
      expect(corrected.questions.every((q) => q.explanation !== null)).toBe(true);

      await expectError(db, "select save_exam_answer($1, $2, $3, '{}')", ["user-a", exam.attempt_id, q3], "exam_closed");
      await expectError(db, "select start_exam($1, $2)", ["user-a", programId], "pass_required");
    }));

  it("refuse une question qui n'est pas dans l'examen", () =>
    withTx(async (db) => {
      const { programId, questions } = await setup(db);
      const exam = await start(db, "user-a", programId);
      const outside = questions.find((q) => !exam.questions.some((eq) => eq.id === q.id))!;
      await expectError(db, "select save_exam_answer($1, $2, $3, '{}')", ["user-a", exam.attempt_id, outside.id], "question_not_in_exam");
    }));

  it("cache l'examen aux autres élèves", () =>
    withTx(async (db) => {
      const { programId } = await setup(db);
      const exam = await start(db, "user-a", programId);
      await expectError(db, "select get_exam($1, $2)", ["user-b", exam.attempt_id], "exam_not_found");
      await expectError(db, "select submit_exam($1, $2)", ["user-b", exam.attempt_id], "exam_not_found");
    }));
});

describe("avec un Pass", () => {
  it("note un examen expiré avec les réponses reçues et en ouvre un nouveau", () =>
    withTx(async (db) => {
      const { programId } = await setup(db);
      await givePass(db, "user-a");
      expect((await status(db, "user-a")).has_pass).toBe(true);
      const first = await start(db, "user-a", programId);
      await db.query("update exam_attempts set expires_at = now() - interval '1 minute' where id = $1", [first.attempt_id]);

      await expectError(
        db,
        "select save_exam_answer($1, $2, $3, '{}')",
        ["user-a", first.attempt_id, first.questions[0].id],
        "exam_closed",
      );
      const second = await start(db, "user-a", programId);
      expect(second.attempt_id).not.toBe(first.attempt_id);
      expect((await getExam(db, "user-a", first.attempt_id)).submitted).toBe(true);
    }));

  it("signale une banque de questions trop petite", () =>
    withTx(async (db) => {
      const { programId } = await setup(db);
      await givePass(db, "user-a");
      await db.query("update programs set exam_question_count = 10 where id = $1", [programId]);
      await expectError(db, "select start_exam($1, $2)", ["user-a", programId], "not_enough_questions");
    }));

  it("respecte la répartition par thème", () =>
    withTx(async (db) => {
      const { programId, unitA } = await setup(db);
      await db.query(
        "update programs set exam_question_count = 2, exam_pass_mark = 1, exam_distribution = jsonb_build_object($2::text, 2) where id = $1",
        [programId, unitA],
      );
      const exam = await start(db, "user-a", programId);
      const units = await scalar<string[]>(
        db,
        "select array_agg(distinct unit_id::text) from questions where id = any($1::uuid[])",
        [exam.questions.map((q) => q.id)],
      );
      expect(units).toEqual([unitA]);
    }));

  it("refuse un programme inconnu", () =>
    withTx(async (db) => {
      await setup(db);
      await expectError(db, "select start_exam($1, $2)", ["user-a", "00000000-0000-0000-0000-000000000000"], "program_not_found");
    }));
});

describe("statut et historique", () => {
  it("devient « prêt » après le nombre de réussites consécutives demandé", () =>
    withTx(async (db) => {
      const { programId } = await setup(db);
      for (const [hoursAgo, passed] of [[3, false], [2, true], [1, true]] as const) {
        await db.query(
          `insert into exam_attempts (user_id, program_id, question_ids, seconds_per_question, pass_mark, started_at, expires_at, submitted_at, score, passed)
           values ('user-c', $1, '{}', 30, 2, now() - make_interval(hours => $2), now(), now() - make_interval(hours => $2), 0, $3)`,
          [programId, hoursAgo, passed],
        );
      }
      const s = await status(db, "user-c");
      expect({ consecutive: s.consecutive_passes, ready: s.ready, free: s.free_exam_available, taken: s.exams_taken })
        .toEqual({ consecutive: 2, ready: false, free: false, taken: 3 });

      await db.query("update settings set value = '2' where key = 'ready_after_consecutive_passes'");
      expect((await status(db, "user-c")).ready).toBe(true);

      const history = await scalar<Array<{ score: number; passed: boolean }>>(db, "select get_exam_history('user-c')");
      expect(history.map((h) => h.passed)).toEqual([true, true, false]);
    }));
});
