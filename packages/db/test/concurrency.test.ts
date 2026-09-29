import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, newId } from "./helpers.js";

/**
 * Requêtes simultanées : deux connexions qui valident réellement leurs écritures.
 * Les données créées ici sont supprimées après chaque test.
 */
const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });
const users: string[] = [];
const programs: string[] = [];

afterEach(async () => {
  await pool.query("delete from payments where user_id = any($1)", [users]);
  await pool.query("delete from profiles where id = any($1)", [users]);
  await pool.query("delete from programs where id = any($1)", [programs]);
  users.length = 0;
  programs.length = 0;
});

afterAll(() => pool.end());

async function seed() {
  const user = `conc-${randomUUID()}`;
  users.push(user);
  await pool.query("select ensure_profile($1, null)", [user]);

  const programId: string = (
    await pool.query(
      `insert into programs (country_code, license_type, name, exam_question_count, exam_pass_mark)
       values ('TG', $1, 'Programme de test', 2, 1) returning id`,
      [`test-${randomUUID()}`],
    )
  ).rows[0].id;
  programs.push(programId);
  const unitId: string = (
    await pool.query("insert into units (program_id, title, position) values ($1, 'Unité', 1) returning id", [programId])
  ).rows[0].id;
  const lessonId: string = (
    await pool.query("insert into lessons (unit_id, position, title) values ($1, 1, 'Leçon') returning id", [unitId])
  ).rows[0].id;

  const questions: Array<{ id: string; correct: string }> = [];
  for (let i = 0; i < 2; i++) {
    const id: string = (
      await pool.query(
        `insert into questions (unit_id, lesson_id, prompt, explanation, source)
         values ($1, $2, 'Question', 'Explication', 'Source') returning id`,
        [unitId, lessonId],
      )
    ).rows[0].id;
    const correct: string = (
      await pool.query("insert into choices (question_id, label, is_correct) values ($1, 'Juste', true) returning id", [id])
    ).rows[0].id;
    await pool.query("insert into choices (question_id, label, is_correct) values ($1, 'Faux', false)", [id]);
    await pool.query("update questions set status = 'validee' where id = $1", [id]);
    questions.push({ id, correct });
  }
  return { user, programId, lessonId, questions };
}

/**
 * Lance une requête sur b et attend qu'elle soit terminée ou bloquée sur un verrou,
 * pour que le commit de a arrive vraiment pendant qu'elle s'exécute.
 */
async function startOn<T>(b: pg.PoolClient, bPid: number, run: () => Promise<T>): Promise<{ pending: Promise<T> }> {
  let settled = false;
  const pending = run();
  pending.then(
    () => (settled = true),
    () => (settled = true),
  );
  for (let i = 0; i < 500 && !settled; i++) {
    const { rows } = await pool.query("select wait_event_type from pg_stat_activity where pid = $1", [bPid]);
    if (rows[0]?.wait_event_type === "Lock") break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  // Emballée dans un objet : une fonction async qui renvoie une promesse l'attendrait.
  return { pending };
}

/** Ouvre deux connexions avec chacune une transaction, et les libère à la fin. */
async function twoClients<T>(
  fn: (a: pg.PoolClient, b: pg.PoolClient, start: <R>(run: () => Promise<R>) => Promise<{ pending: Promise<R> }>) => Promise<T>,
): Promise<T> {
  const a = await pool.connect();
  const b = await pool.connect();
  try {
    await a.query("begin");
    await b.query("begin");
    const bPid: number = (await b.query("select pg_backend_pid() as pid")).rows[0].pid;
    return await fn(a, b, (run) => startOn(b, bPid, run));
  } finally {
    await a.query("rollback").catch(() => {});
    await b.query("rollback").catch(() => {});
    a.release();
    b.release();
  }
}

describe("requêtes simultanées", () => {
  it("un double appui sur « commencer l'examen » ne crée qu'un seul examen", async () => {
    const { user, programId } = await seed();
    await twoClients(async (a, b, start) => {
      const first = (await a.query("select start_exam($1, $2) as e", [user, programId])).rows[0].e;
      const { pending } = await start(() => b.query("select start_exam($1, $2) as e", [user, programId]));
      await a.query("commit");
      const second = (await pending).rows[0].e;
      await b.query("commit");
      expect(second.attempt_id).toBe(first.attempt_id);
    });
    const count = (await pool.query("select count(*)::int as n from exam_attempts where user_id = $1", [user])).rows[0].n;
    expect(count).toBe(1);
  });

  it("une même séance envoyée deux fois en même temps est acceptée sans erreur", async () => {
    const { user, lessonId, questions } = await seed();
    const sessionId = newId();
    const answers = JSON.stringify([{ question_id: questions[0].id, choice_ids: [questions[0].correct] }]);
    const SUBMIT = "select * from submit_session($1, $2, 'lecon', $3, null, now(), 60, $4)";
    await twoClients(async (a, b, start) => {
      await a.query(SUBMIT, [user, sessionId, lessonId, answers]);
      const { pending } = await start(() => b.query(SUBMIT, [user, sessionId, lessonId, answers]));
      await a.query("commit");
      const row = (await pending).rows[0];
      await b.query("commit");
      expect(row.id).toBe(sessionId);
    });
    const xp = (await pool.query("select sum(xp_earned)::int as xp from practice_sessions where user_id = $1", [user])).rows[0].xp;
    expect(xp).toBe(15);
  });

  it("deux paiements confirmés en même temps donnent deux Pass qui s'enchaînent", async () => {
    const { user } = await seed();
    const p1: string = (await pool.query("select id from create_payment($1)", [user])).rows[0].id;
    const p2: string = (await pool.query("select id from create_payment($1)", [user])).rows[0].id;
    await twoClients(async (a, b, start) => {
      await a.query("select confirm_payment($1, 'REF-A', 3000)", [p1]);
      const { pending } = await start(() => b.query("select confirm_payment($1, 'REF-B', 3000)", [p2]));
      await a.query("commit");
      await pending;
      await b.query("commit");
    });
    const { rows } = await pool.query(
      "select starts_at, ends_at from passes where user_id = $1 order by starts_at",
      [user],
    );
    expect(rows).toHaveLength(2);
    expect(rows[1].starts_at.getTime()).toBe(rows[0].ends_at.getTime());
  });

  it("une réponse envoyée pendant la notation de l'examen est refusée", async () => {
    const { user, programId, questions } = await seed();
    const exam = (await pool.query("select start_exam($1, $2) as e", [user, programId])).rows[0].e;
    const questionId: string = exam.questions[0].id;
    const correct = questions.find((q) => q.id === questionId)!.correct;
    await twoClients(async (a, b, start) => {
      await a.query("select submit_exam($1, $2)", [user, exam.attempt_id]);
      const { pending } = await start(() =>
        b
          .query("select save_exam_answer($1, $2, $3, $4::uuid[])", [user, exam.attempt_id, questionId, [correct]])
          .then(
            () => "enregistrée",
            (error: Error) => error.message,
          ),
      );
      await a.query("commit");
      expect(await pending).toContain("exam_closed");
    });
  });
});
