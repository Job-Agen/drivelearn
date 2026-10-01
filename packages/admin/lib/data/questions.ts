import { z } from "zod";
import { AdminError } from "../errors";
import type { Queryable } from "./types";

export type QuestionStatus = "brouillon" | "a_verifier" | "en_validation" | "validee";
export type QuestionListRow = {
  id: string;
  prompt: string;
  status: QuestionStatus;
  unit_title: string;
  lesson_title: string | null;
  open_reports: number;
  updated_at: Date;
};
export type QuestionDetail = {
  id: string;
  program_id: string;
  unit_id: string;
  lesson_id: string | null;
  prompt: string;
  image_path: string | null;
  explanation: string | null;
  source: string | null;
  source_page: string | null;
  status: QuestionStatus;
  choices: { id: string; label: string; is_correct: boolean; position: number }[];
};

export async function listQuestions(
  db: Queryable,
  f: { programId: string; unitId?: string; status?: QuestionStatus; search?: string; limit?: number; offset?: number },
): Promise<{ rows: QuestionListRow[]; total: number }> {
  const where = ["u.program_id = $1"];
  const values: unknown[] = [f.programId];
  if (f.unitId) where.push(`q.unit_id = $${values.push(f.unitId)}`);
  if (f.status) where.push(`q.status = $${values.push(f.status)}`);
  if (f.search?.trim()) where.push(`q.prompt ilike $${values.push(`%${f.search.trim()}%`)}`);
  const from = `from questions q join units u on u.id = q.unit_id left join lessons l on l.id = q.lesson_id where ${where.join(" and ")}`;
  const total = (await db.query(`select count(*)::int as n ${from}`, values)).rows[0].n;
  const { rows } = await db.query(
    `select q.id, q.prompt, q.status::text as status, u.title as unit_title, l.title as lesson_title, q.updated_at,
            (select count(*)::int from question_reports r where r.question_id = q.id and r.status <> 'resolu') as open_reports
     ${from}
     order by u.position, l.position nulls last, q.position, q.updated_at
     limit $${values.push(f.limit ?? 50)} offset $${values.push(f.offset ?? 0)}`,
    values,
  );
  return { rows, total };
}

export async function getQuestion(db: Queryable, id: string): Promise<QuestionDetail> {
  const { rows } = await db.query(
    `select q.id, u.program_id, q.unit_id, q.lesson_id, q.prompt, q.image_path, q.explanation, q.source, q.source_page,
            q.status::text as status,
            coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.label, 'is_correct', c.is_correct,
                                                          'position', c.position) order by c.position)
                      from choices c where c.question_id = q.id), '[]'::jsonb) as choices
     from questions q join units u on u.id = q.unit_id where q.id = $1`,
    [id],
  );
  if (!rows[0]) throw new AdminError("Question introuvable.");
  return rows[0];
}

const QuestionInput = z.object({
  id: z.uuid().optional(),
  unit_id: z.uuid(),
  lesson_id: z.uuid().nullable(),
  prompt: z.string().trim().min(1, "Énoncé obligatoire").max(1000),
  image_path: z.string().trim().max(300).nullable(),
  explanation: z.string().trim().max(2000).nullable(),
  source: z.string().trim().max(300).nullable(),
  choices: z
    .array(z.object({ label: z.string().trim().max(300), is_correct: z.boolean() }))
    .transform((cs) => cs.filter((c) => c.label.length > 0))
    .pipe(z.array(z.object({ label: z.string(), is_correct: z.boolean() })).max(8, "8 choix au maximum")),
});
export type QuestionInput = z.input<typeof QuestionInput>;

/** À appeler dans une transaction : met à jour la question et remplace tous ses choix. */
export async function saveQuestion(client: Queryable, input: QuestionInput): Promise<string> {
  const q = QuestionInput.parse(input);
  const fields = [q.unit_id, q.lesson_id, q.prompt, q.image_path || null, q.explanation || null, q.source || null];
  let id = q.id;
  if (id) {
    const res = await client.query(
      `update questions set unit_id = $2, lesson_id = $3, prompt = $4, image_path = $5, explanation = $6, source = $7
       where id = $1`,
      [id, ...fields],
    );
    if (res.rowCount === 0) throw new AdminError("Question introuvable.");
    await client.query("delete from choices where question_id = $1", [id]);
  } else {
    const { rows } = await client.query(
      `insert into questions (unit_id, lesson_id, prompt, image_path, explanation, source)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      fields,
    );
    id = rows[0].id as string;
  }
  for (const [i, c] of q.choices.entries()) {
    await client.query("insert into choices (question_id, label, is_correct, position) values ($1, $2, $3, $4)", [
      id,
      c.label,
      c.is_correct,
      i + 1,
    ]);
  }
  return id;
}

/** À appeler dans une transaction. La validation est contrôlée immédiatement pour afficher l'erreur exacte. */
export async function setQuestionStatus(client: Queryable, id: string, status: QuestionStatus): Promise<void> {
  if (status === "validee") await client.query("set constraints questions_valid immediate");
  const res = await client.query("update questions set status = $2 where id = $1", [id, status]);
  if (res.rowCount === 0) throw new AdminError("Question introuvable.");
}

export async function deleteQuestion(db: Queryable, id: string): Promise<void> {
  await db.query("delete from questions where id = $1", [id]);
}
