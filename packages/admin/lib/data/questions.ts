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
  // Une ligne vide est ignorée ; une ligne existante (id) vidée est supprimée.
  choices: z
    .array(z.object({ id: z.uuid().optional(), label: z.string().trim().max(300), is_correct: z.boolean() }))
    .refine((cs) => cs.filter((c) => c.label.length > 0).length <= 8, "8 choix au maximum"),
});
export type QuestionInput = z.input<typeof QuestionInput>;

/** À appeler dans une transaction. Les réponses existantes sont modifiées sur place (leurs identifiants
 *  restent ceux enregistrés dans l'historique des élèves) ; seules les réponses modifiées sont réécrites. */
export async function saveQuestion(client: Queryable, input: QuestionInput): Promise<string> {
  const q = QuestionInput.parse(input);
  const fields = [q.unit_id, q.lesson_id, q.prompt, q.image_path || null, q.explanation || null, q.source || null];
  const kept = q.choices.filter((c) => c.label.length > 0);
  let id = q.id;
  let existing: { id: string; label: string; is_correct: boolean; position: number }[] = [];
  if (id) {
    const res = await client.query(
      `update questions set unit_id = $2, lesson_id = $3, prompt = $4, image_path = $5, explanation = $6, source = $7
       where id = $1`,
      [id, ...fields],
    );
    if (res.rowCount === 0) throw new AdminError("Question introuvable.");
    existing = (await client.query("select id, label, is_correct, position from choices where question_id = $1", [id])).rows;
  } else {
    const { rows } = await client.query(
      `insert into questions (unit_id, lesson_id, prompt, image_path, explanation, source)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      fields,
    );
    id = rows[0].id as string;
  }

  const keptIds = new Set(kept.map((c) => c.id).filter(Boolean));
  for (const old of existing) {
    if (!keptIds.has(old.id)) await client.query("delete from choices where id = $1", [old.id]);
  }
  for (const [i, c] of kept.entries()) {
    const position = i + 1;
    const old = existing.find((e) => e.id === c.id);
    if (!old) {
      await client.query("insert into choices (question_id, label, is_correct, position) values ($1, $2, $3, $4)", [
        id,
        c.label,
        c.is_correct,
        position,
      ]);
    } else if (old.label !== c.label || old.is_correct !== c.is_correct || old.position !== position) {
      await client.query("update choices set label = $2, is_correct = $3, position = $4 where id = $1", [
        old.id,
        c.label,
        c.is_correct,
        position,
      ]);
    }
  }
  return id;
}

/** À appeler dans une transaction. La validation est contrôlée immédiatement pour afficher l'erreur exacte. */
export async function setQuestionStatus(client: Queryable, id: string, status: QuestionStatus): Promise<void> {
  if (status === "validee") await client.query("set constraints questions_valid immediate");
  const res = await client.query("update questions set status = $2 where id = $1", [id, status]);
  if (res.rowCount === 0) throw new AdminError("Question introuvable.");
}

/** Seule une question jamais validée et jamais travaillée par un élève peut être supprimée. */
export async function deleteQuestion(db: Queryable, id: string): Promise<void> {
  const { rows } = await db.query(
    `select q.status::text as status,
            exists (select 1 from session_answers a where a.question_id = q.id)
              or exists (select 1 from exam_answers e where e.question_id = q.id) as answered
     from questions q where q.id = $1`,
    [id],
  );
  if (!rows[0]) throw new AdminError("Question introuvable.");
  if (rows[0].status === "validee") {
    throw new AdminError("Une question validée ne peut pas être supprimée : repassez-la d'abord en brouillon.");
  }
  if (rows[0].answered) {
    throw new AdminError("Des élèves ont déjà répondu à cette question : laissez-la en brouillon plutôt que de la supprimer.");
  }
  await db.query("delete from questions where id = $1", [id]);
}
