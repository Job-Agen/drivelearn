import { describe, expect, it } from "vitest";
import { createPath, createQuestion, createUser, expectError, newId, scalar, withTx, type Db } from "./helpers.js";

type Answer = { question_id: string; choice_ids: string[] };

async function setup(db: Db) {
  const path = await createPath(db);
  const single = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, correct: 1, wrong: 1, status: "validee" });
  const multi = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, correct: 2, wrong: 1, status: "validee" });
  const draft = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId });
  await createUser(db, "user-a");
  await createUser(db, "user-b");
  return { ...path, single, multi, draft };
}

const SUBMIT = `select * from submit_session($1, $2, $3, $4, $5, coalesce($6::timestamptz, now()), $7, $8)`;

async function submit(
  db: Db,
  userId: string,
  sessionId: string,
  answers: Answer[],
  opts: { kind?: string; lessonId?: string | null; unitId?: string | null; completedAt?: string; activeSeconds?: number },
) {
  const { rows } = await db.query(SUBMIT, [
    userId,
    sessionId,
    opts.kind ?? "lecon",
    opts.lessonId ?? null,
    opts.unitId ?? null,
    opts.completedAt ?? null,
    opts.activeSeconds ?? 60,
    JSON.stringify(answers),
  ]);
  return rows[0];
}

const TODAY = "select (now() at time zone 'Africa/Lome')::date::text";

describe("notation tout ou rien", () => {
  it("applique la règle officielle", () =>
    withTx(async (db) => {
      const { single, multi } = await setup(db);
      const check = (qid: string, ids: string[]) =>
        scalar<boolean>(db, "select is_answer_correct($1, $2::uuid[])", [qid, ids]);
      const [a, b] = multi.correct;
      const [c] = multi.wrong;
      expect(await check(multi.id, [a, b])).toBe(true);
      expect(await check(multi.id, [b, a])).toBe(true);
      expect(await check(multi.id, [a])).toBe(false);
      expect(await check(multi.id, [a, b, c])).toBe(false);
      expect(await check(multi.id, [])).toBe(false);
      expect(await check(multi.id, [a, a, b])).toBe(true);
      expect(await check(single.id, [single.correct[0], a])).toBe(false);
    }));
});

describe("séances", () => {
  it("note une leçon et donne 10 XP", () =>
    withTx(async (db) => {
      const { lessonId, single, multi } = await setup(db);
      const row = await submit(db, "user-a", newId(), [
        { question_id: single.id, choice_ids: single.correct },
        { question_id: multi.id, choice_ids: [multi.correct[0]] },
      ], { lessonId });
      expect({ c: row.correct_count, n: row.question_count, xp: row.xp_earned }).toEqual({ c: 1, n: 2, xp: 10 });
    }));

  it("donne 15 XP pour un sans-faute", () =>
    withTx(async (db) => {
      const { lessonId, single, multi } = await setup(db);
      const row = await submit(db, "user-a", newId(), [
        { question_id: single.id, choice_ids: single.correct },
        { question_id: multi.id, choice_ids: multi.correct },
      ], { lessonId });
      expect(row.xp_earned).toBe(15);
    }));

  it("ignore un renvoi de la même séance (synchronisation hors ligne)", () =>
    withTx(async (db) => {
      const { lessonId, single } = await setup(db);
      const id = newId();
      const answers = [{ question_id: single.id, choice_ids: single.correct }];
      await submit(db, "user-a", id, answers, { lessonId });
      await submit(db, "user-a", id, answers, { lessonId });
      expect(await scalar<number>(db, "select count(*)::int from practice_sessions")).toBe(1);
      expect(await scalar<number>(db, "select sum(xp_earned)::int from practice_sessions")).toBe(15);
    }));

  it("refuse l'identifiant de séance d'un autre élève", () =>
    withTx(async (db) => {
      const { lessonId, single } = await setup(db);
      const id = newId();
      const answers = [{ question_id: single.id, choice_ids: single.correct }];
      await submit(db, "user-a", id, answers, { lessonId });
      await expectError(db, SUBMIT, ["user-b", id, "lecon", lessonId, null, null, 60, JSON.stringify(answers)], "session_conflict");
    }));

  it("compte une seule fois une question envoyée en double", () =>
    withTx(async (db) => {
      const { lessonId, single } = await setup(db);
      const row = await submit(db, "user-a", newId(), [
        { question_id: single.id, choice_ids: single.correct },
        { question_id: single.id, choice_ids: single.wrong },
      ], { lessonId });
      expect(row.question_count).toBe(1);
    }));

  it("ramène une date future à aujourd'hui et plafonne la durée à une heure", () =>
    withTx(async (db) => {
      const { lessonId, single } = await setup(db);
      const id = newId();
      await submit(db, "user-a", id, [{ question_id: single.id, choice_ids: single.correct }], {
        lessonId,
        completedAt: "2099-01-01T00:00:00Z",
        activeSeconds: 99_999,
      });
      const { rows } = await db.query(
        "select activity_date::text as d, active_seconds from practice_sessions where id = $1",
        [id],
      );
      expect(rows[0]).toEqual({ d: await scalar<string>(db, TODAY), active_seconds: 3600 });
    }));

  it("refuse une question non validée, une séance vide ou incomplète", () =>
    withTx(async (db) => {
      const { lessonId, draft, single } = await setup(db);
      const ok = JSON.stringify([{ question_id: single.id, choice_ids: single.correct }]);
      await expectError(db, SUBMIT, ["user-a", newId(), "lecon", lessonId, null, null, 60,
        JSON.stringify([{ question_id: draft.id, choice_ids: draft.correct }])], "unknown_question");
      await expectError(db, SUBMIT, ["user-a", newId(), "lecon", lessonId, null, null, 60, "[]"], "invalid_answers");
      await expectError(db, SUBMIT, ["user-a", newId(), "lecon", null, null, null, 60, ok], "invalid_session");
      await expectError(db, SUBMIT, ["user-a", newId(), "theme", null, null, null, 60, ok], "invalid_session");
    }));

  it("accepte une révision par thème", () =>
    withTx(async (db) => {
      const { unitId, single } = await setup(db);
      const row = await submit(db, "user-a", newId(), [{ question_id: single.id, choice_ids: single.correct }], {
        kind: "theme",
        unitId,
      });
      expect(row.kind).toBe("theme");
    }));
});

describe("révision des erreurs", () => {
  it("garde une question à revoir jusqu'à deux réussites consécutives", () =>
    withTx(async (db) => {
      const { programId, lessonId, multi } = await setup(db);
      const review = () => scalar<string[]>(db, "select get_review_questions('user-a', $1, 10)", [programId]);

      await submit(db, "user-a", newId(), [{ question_id: multi.id, choice_ids: [multi.correct[0]] }], { lessonId });
      expect(await review()).toEqual([multi.id]);

      await submit(db, "user-a", newId(), [{ question_id: multi.id, choice_ids: multi.correct }], { kind: "erreurs" });
      expect(await review()).toEqual([multi.id]);

      await submit(db, "user-a", newId(), [{ question_id: multi.id, choice_ids: multi.correct }], { kind: "erreurs" });
      expect(await review()).toEqual([]);
    }));

  it("n'ajoute pas à la révision une question réussie du premier coup", () =>
    withTx(async (db) => {
      const { programId, lessonId, single } = await setup(db);
      await submit(db, "user-a", newId(), [{ question_id: single.id, choice_ids: single.correct }], { lessonId });
      expect(await scalar<string[]>(db, "select get_review_questions('user-a', $1, 10)", [programId])).toEqual([]);
    }));
});

describe("série de jours", () => {
  it("compte les jours consécutifs", () =>
    withTx(async (db) => {
      const { lessonId } = await setup(db);
      for (const day of ["2026-06-10", "2026-06-09", "2026-06-08", "2026-06-06"]) {
        await db.query(
          `insert into practice_sessions (id, user_id, kind, lesson_id, completed_at, activity_date)
           values (gen_random_uuid(), 'user-a', 'lecon', $1, now(), $2)`,
          [lessonId, day],
        );
      }
      const streak = (today: string) => scalar<number>(db, "select compute_streak('user-a', $1::date)", [today]);
      expect(await streak("2026-06-10")).toBe(3);
      expect(await streak("2026-06-11")).toBe(3); // pas encore révisé aujourd'hui : la série d'hier tient
      expect(await streak("2026-06-12")).toBe(0); // un jour manqué
      expect(await streak("2026-06-07")).toBe(1);
    }));
});
