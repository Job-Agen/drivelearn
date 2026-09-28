import { describe, expect, it } from "vitest";
import { createPath, createQuestion, createUser, expectError, newId, scalar, withTx, type Db } from "./helpers.js";

type Progress = {
  current_streak: number;
  practiced_today: boolean;
  total_xp: number;
  daily_goal_minutes: number;
  today_minutes: number;
  week_days: boolean[];
  lessons_completed: number;
  lessons_total: number;
  themes: Array<{ unit_id: string; title: string; answers: number; correct_rate: number }>;
  milestones: Record<string, boolean>;
};

async function setup(db: Db) {
  const path = await createPath(db);
  const q1 = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, status: "validee" });
  const q2 = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, status: "validee" });
  await createUser(db, "user-a");
  await db.query("update profiles set program_id = $1, daily_goal_minutes = 10 where id = 'user-a'", [path.programId]);
  return { ...path, q1, q2 };
}

const progress = (db: Db, user: string) => scalar<Progress>(db, "select get_progress($1)", [user]);

describe("progrès", () => {
  it("résume la journée, la semaine, les leçons et les thèmes", () =>
    withTx(async (db) => {
      const { lessonId, q1, q2 } = await setup(db);
      await db.query("select submit_session('user-a', $1, 'lecon', $2, null, now(), 240, $3)", [
        newId(),
        lessonId,
        JSON.stringify([
          { question_id: q1.id, choice_ids: q1.correct },
          { question_id: q2.id, choice_ids: q2.wrong },
        ]),
      ]);
      const todayIndex = await scalar<number>(db, "select extract(isodow from now() at time zone 'Africa/Lome')::int - 1");

      const p = await progress(db, "user-a");
      expect(p.current_streak).toBe(1);
      expect(p.practiced_today).toBe(true);
      expect(p.total_xp).toBe(10);
      expect(p.daily_goal_minutes).toBe(10);
      expect(p.today_minutes).toBe(4);
      expect(p.week_days).toHaveLength(7);
      expect(p.week_days[todayIndex]).toBe(true);
      expect(p.week_days.filter(Boolean)).toHaveLength(1);
      expect({ done: p.lessons_completed, total: p.lessons_total }).toEqual({ done: 1, total: 1 });
      expect(p.themes).toHaveLength(1);
      expect({ answers: p.themes[0].answers, rate: p.themes[0].correct_rate }).toEqual({ answers: 2, rate: 50 });
      expect(p.milestones).toEqual({
        first_lesson: true,
        streak_3: false,
        streak_7: false,
        streak_30: false,
        first_exam_passed: false,
      });
    }));

  it("compte le temps des examens dans l'objectif du jour", () =>
    withTx(async (db) => {
      const { programId } = await setup(db);
      await db.query(
        `insert into exam_attempts (user_id, program_id, question_ids, seconds_per_question, pass_mark, expires_at, submitted_at, score, passed, active_seconds)
         values ('user-a', $1, '{}', 30, 13, now(), now(), 15, true, 600)`,
        [programId],
      );
      const p = await progress(db, "user-a");
      expect(p.today_minutes).toBe(10);
      expect(p.milestones.first_exam_passed).toBe(true);
    }));

  it("mesure la plus longue série jamais atteinte", () =>
    withTx(async (db) => {
      const { lessonId } = await setup(db);
      for (const day of ["2026-01-01", "2026-01-02", "2026-01-03", "2026-02-10"]) {
        await db.query(
          `insert into practice_sessions (id, user_id, kind, lesson_id, completed_at, activity_date)
           values (gen_random_uuid(), 'user-a', 'lecon', $1, now(), $2)`,
          [lessonId, day],
        );
      }
      expect(await scalar<number>(db, "select max_streak('user-a')")).toBe(3);
      expect((await progress(db, "user-a")).milestones.streak_3).toBe(true);
    }));

  it("refuse un profil inconnu", () =>
    withTx(async (db) => {
      await expectError(db, "select get_progress('personne')", [], "profile_not_found");
    }));
});

describe("cibles des rappels", () => {
  async function addReminderUser(db: Db, id: string, time: string, enabled = true) {
    await createUser(db, id);
    await db.query(
      "update profiles set reminder_time = $2, reminder_enabled = $3, push_token = $4 where id = $1",
      [id, time, enabled, `token-${id}`],
    );
  }

  const targets = (db: Db, now: string) =>
    db
      .query("select user_id from get_reminder_targets($1::timestamptz, 15) order by user_id", [now])
      .then((r) => r.rows.map((row) => row.user_id as string));

  it("vise les élèves dont l'heure tombe dans la fenêtre et qui n'ont pas pratiqué", () =>
    withTx(async (db) => {
      const { lessonId } = await setup(db);
      await addReminderUser(db, "r-19h00", "19:00");
      await addReminderUser(db, "r-19h10", "19:10");
      await addReminderUser(db, "r-off", "19:00", false);
      await addReminderUser(db, "r-deja", "19:00");
      await db.query(
        `insert into practice_sessions (id, user_id, kind, lesson_id, completed_at, activity_date)
         values (gen_random_uuid(), 'r-deja', 'lecon', $1, '2026-06-10T08:00:00Z', '2026-06-10')`,
        [lessonId],
      );
      expect(await targets(db, "2026-06-10T18:50:00Z")).toEqual(["r-19h00"]);
    }));

  it("gère une fenêtre qui chevauche minuit", () =>
    withTx(async (db) => {
      await setup(db);
      await addReminderUser(db, "r-23h55", "23:55");
      await addReminderUser(db, "r-00h02", "00:02");
      await addReminderUser(db, "r-00h10", "00:10");
      expect(await targets(db, "2026-06-10T23:50:00Z")).toEqual(["r-00h02", "r-23h55"]);
    }));
});
