import { z } from "zod";
import { AdminError } from "../errors";
import type { Queryable } from "./types";

export type ProgramRow = {
  id: string;
  country_code: string;
  license_type: string;
  name: string;
  status: "brouillon" | "en_validation" | "publie";
  exam_question_count: number;
  exam_pass_mark: number;
  exam_seconds_per_question: number;
  exam_distribution: Record<string, number>;
  lessons: number;
  validated_questions: number;
  pending_questions: number;
};

const PROGRAM_SELECT = `
  select p.id, p.country_code, p.license_type, p.name, p.status::text as status,
         p.exam_question_count, p.exam_pass_mark, p.exam_seconds_per_question, p.exam_distribution,
         (select count(*)::int from lessons l join units u on u.id = l.unit_id where u.program_id = p.id) as lessons,
         (select count(*)::int from questions q join units u on u.id = q.unit_id
           where u.program_id = p.id and q.status = 'validee') as validated_questions,
         (select count(*)::int from questions q join units u on u.id = q.unit_id
           where u.program_id = p.id and q.status <> 'validee') as pending_questions
  from programs p`;

export async function listPrograms(db: Queryable): Promise<ProgramRow[]> {
  const { rows } = await db.query(`${PROGRAM_SELECT} order by p.country_code, p.license_type`);
  return rows;
}

export async function getProgram(db: Queryable, id: string): Promise<ProgramRow> {
  const { rows } = await db.query(`${PROGRAM_SELECT} where p.id = $1`, [id]);
  if (!rows[0]) throw new AdminError("Programme introuvable.");
  return rows[0];
}

const NewProgram = z.object({
  country_code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2}$/, "Code pays sur 2 lettres (ex. TG)")),
  license_type: z.string().trim().min(1, "Type de permis obligatoire").max(30),
  name: z.string().trim().min(1, "Nom obligatoire").max(100),
});

export async function createProgram(db: Queryable, input: z.input<typeof NewProgram>): Promise<string> {
  const p = NewProgram.parse(input);
  const { rows } = await db.query(
    "insert into programs (country_code, license_type, name) values ($1, $2, $3) returning id",
    [p.country_code, p.license_type, p.name],
  );
  return rows[0].id;
}
