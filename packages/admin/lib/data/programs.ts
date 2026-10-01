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

export async function examConformity(
  db: Queryable,
  programId: string,
  proposed?: { exam_question_count: number; exam_distribution: Record<string, number> },
) {
  const program = { ...(await getProgram(db, programId)), ...proposed };
  const { rows: units } = await db.query(
    `select u.id as unit_id, u.title,
            (select count(*)::int from questions q where q.unit_id = u.id and q.status = 'validee') as available
     from units u where u.program_id = $1 order by u.position`,
    [programId],
  );
  const distribution = program.exam_distribution ?? {};
  const requested = units
    .filter((u) => distribution[u.unit_id] !== undefined)
    .map((u) => ({ ...u, requested: distribution[u.unit_id] as number }));
  const distributionSum = Object.values(distribution).reduce((a, b) => a + b, 0);
  const validatedTotal = units.reduce((a, u) => a + u.available, 0);

  const problems: string[] = [];
  if (validatedTotal < program.exam_question_count) {
    problems.push(`Banque insuffisante : ${validatedTotal} question(s) validée(s) pour ${program.exam_question_count} demandée(s).`);
  }
  if (Object.keys(distribution).length > 0 && distributionSum !== program.exam_question_count) {
    problems.push(`La répartition totalise ${distributionSum} question(s) au lieu de ${program.exam_question_count}.`);
  }
  for (const u of requested) {
    if (u.available < u.requested) {
      problems.push(`L'unité « ${u.title} » n'a que ${u.available} question(s) validée(s) pour ${u.requested} demandée(s).`);
    }
  }
  return { problems, validated_total: validatedTotal, distribution_sum: distributionSum, units: requested };
}

const ExamSettings = z.object({
  exam_question_count: z.number().int().min(1).max(100),
  exam_pass_mark: z.number().int().min(1),
  exam_seconds_per_question: z.number().int().min(5).max(600),
  exam_distribution: z.record(z.string(), z.number().int().min(0).max(100)),
});

export async function updateExamSettings(db: Queryable, programId: string, input: z.input<typeof ExamSettings>): Promise<void> {
  const s = ExamSettings.parse(input);
  if (s.exam_pass_mark > s.exam_question_count) throw new AdminError("Le seuil ne peut pas dépasser le nombre de questions.");
  const distribution = Object.fromEntries(Object.entries(s.exam_distribution).filter(([, n]) => n > 0));
  const ids = Object.keys(distribution);
  if (ids.length > 0) {
    const { rows } = await db.query("select count(*)::int as n from units where program_id = $1 and id::text = any($2)", [programId, ids]);
    if (rows[0].n !== ids.length) throw new AdminError("Unité inconnue dans la répartition.");
  }
  const current = await getProgram(db, programId);
  if (current.status === "publie") {
    const { problems } = await examConformity(db, programId, {
      exam_question_count: s.exam_question_count,
      exam_distribution: distribution,
    });
    if (problems.length > 0) throw new AdminError(`Programme publié : ces paramètres rendraient l'examen non conforme. ${problems.join(" ")}`);
  }
  await db.query(
    `update programs set exam_question_count = $2, exam_pass_mark = $3, exam_seconds_per_question = $4, exam_distribution = $5
     where id = $1`,
    [programId, s.exam_question_count, s.exam_pass_mark, s.exam_seconds_per_question, JSON.stringify(distribution)],
  );
}

export async function setProgramStatus(db: Queryable, programId: string, status: ProgramRow["status"]): Promise<void> {
  if (status === "publie") {
    const { problems } = await examConformity(db, programId);
    if (problems.length > 0) throw new AdminError(`Publication impossible. ${problems.join(" ")}`);
  }
  await db.query("update programs set status = $2 where id = $1", [programId, status]);
}
