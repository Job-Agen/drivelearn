import { randomUUID } from "node:crypto";
import pg from "pg";
import { expect } from "vitest";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/drivelearn_test";

const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });

export type Db = pg.PoolClient;

/** Exécute fn dans une transaction toujours annulée à la fin. */
export async function withTx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("begin");
    return await fn(db);
  } finally {
    await db.query("rollback");
    db.release();
  }
}

/** Vérifie qu'une requête échoue avec un message contenant `message`, sans casser la transaction. */
export async function expectError(db: Db, sql: string, values: unknown[], message: string): Promise<void> {
  await db.query("savepoint expect_error");
  try {
    await db.query(sql, values);
  } catch (error) {
    await db.query("rollback to savepoint expect_error");
    expect((error as Error).message).toContain(message);
    return;
  }
  throw new Error(`Erreur attendue contenant « ${message} », mais la requête a réussi`);
}

/** Renvoie la première colonne de la première ligne. */
export async function scalar<T>(db: Db, sql: string, values: unknown[] = []): Promise<T> {
  const { rows } = await db.query(sql, values);
  return Object.values(rows[0] as Record<string, unknown>)[0] as T;
}

export type Path = { programId: string; unitId: string; lessonId: string };

/** Crée un programme (Togo, voiture), une unité et une leçon. */
export async function createPath(
  db: Db,
  opts: { examQuestionCount?: number; examPassMark?: number; secondsPerQuestion?: number } = {},
): Promise<Path> {
  const programId = await scalar<string>(
    db,
    `insert into programs (country_code, license_type, name, exam_question_count, exam_pass_mark, exam_seconds_per_question)
     values ('TG', 'voiture', 'Togo — Permis voiture', $1, $2, $3) returning id`,
    [opts.examQuestionCount ?? 20, opts.examPassMark ?? 13, opts.secondsPerQuestion ?? 30],
  );
  const unitId = await createUnit(db, programId, 1);
  const lessonId = await createLesson(db, unitId, 1);
  return { programId, unitId, lessonId };
}

export async function createUnit(db: Db, programId: string, position: number): Promise<string> {
  return scalar<string>(db, "insert into units (program_id, title, position) values ($1, $2, $3) returning id", [
    programId,
    `Unité ${position}`,
    position,
  ]);
}

export async function createLesson(db: Db, unitId: string, position: number): Promise<string> {
  return scalar<string>(db, "insert into lessons (unit_id, position, title) values ($1, $2, $3) returning id", [
    unitId,
    position,
    `Leçon ${position}`,
  ]);
}

export type QuestionStatus = "brouillon" | "a_verifier" | "en_validation" | "validee";
export type QuestionFixture = { id: string; correct: string[]; wrong: string[] };

/** Crée une question en brouillon avec ses choix, puis lui donne le statut demandé. */
export async function createQuestion(
  db: Db,
  opts: {
    unitId: string;
    lessonId: string | null;
    correct?: number;
    wrong?: number;
    status?: QuestionStatus;
    explanation?: string | null;
    source?: string | null;
  },
): Promise<QuestionFixture> {
  const id = await scalar<string>(
    db,
    `insert into questions (unit_id, lesson_id, prompt, explanation, source)
     values ($1, $2, 'Quel est ce panneau ?', $3, $4) returning id`,
    [
      opts.unitId,
      opts.lessonId,
      opts.explanation === undefined ? "Explication de la réponse." : opts.explanation,
      opts.source === undefined ? "Livre du code, p. 12" : opts.source,
    ],
  );
  const correct: string[] = [];
  const wrong: string[] = [];
  let position = 1;
  for (let i = 0; i < (opts.correct ?? 1); i++) {
    correct.push(
      await scalar<string>(
        db,
        "insert into choices (question_id, label, is_correct, position) values ($1, $2, true, $3) returning id",
        [id, `Bonne ${i + 1}`, position++],
      ),
    );
  }
  for (let i = 0; i < (opts.wrong ?? 1); i++) {
    wrong.push(
      await scalar<string>(
        db,
        "insert into choices (question_id, label, is_correct, position) values ($1, $2, false, $3) returning id",
        [id, `Fausse ${i + 1}`, position++],
      ),
    );
  }
  if (opts.status && opts.status !== "brouillon") {
    await db.query("update questions set status = $2 where id = $1", [id, opts.status]);
  }
  return { id, correct, wrong };
}

/** Crée le profil d'un utilisateur Neon Auth. */
export async function createUser(db: Db, id: string, email = `${id}@test.tg`): Promise<string> {
  await db.query("select ensure_profile($1, $2)", [id, email]);
  return id;
}

export const newId = () => randomUUID();
