// Requêtes du site d'administration. Pures (aucune dépendance à Next.js) pour être testées sur la base de test.
import type { Queryable } from "./db";

export type QuestionStatus = "brouillon" | "a_verifier" | "en_validation" | "validee";
export type ProgramStatus = "brouillon" | "en_validation" | "publie";
export type ReportStatus = "nouveau" | "en_cours" | "resolu";

/** Erreur à afficher telle quelle à l'administrateur. */
export class AdminError extends Error {}

async function one<T = any>(db: Queryable, sql: string, values: unknown[] = []): Promise<T | undefined> {
  return (await db.query(sql, values)).rows[0] as T | undefined;
}
async function all<T = any>(db: Queryable, sql: string, values: unknown[] = []): Promise<T[]> {
  return (await db.query(sql, values)).rows as T[];
}

// Tableau de bord --------------------------------------------------------------------------------

export async function dashboard(db: Queryable) {
  return one<{
    students: number;
    students_week: number;
    questions: Record<QuestionStatus, number>;
    open_reports: number;
    month_sales: number;
    month_revenue: number;
    month_commission: number;
    active_passes: number;
  }>(
    db,
    `select
       (select count(*)::int from profiles) as students,
       (select count(*)::int from profiles where created_at > now() - interval '7 days') as students_week,
       (select jsonb_object_agg(s, coalesce(n, 0)) from unnest(enum_range(null::question_status)) s
          left join (select status, count(*)::int n from questions group by status) q on q.status = s) as questions,
       (select count(*)::int from question_reports where status <> 'resolu') as open_reports,
       (select count(*)::int from payments where status = 'confirmed' and confirmed_at >= date_trunc('month', now() at time zone 'Africa/Lome') at time zone 'Africa/Lome') as month_sales,
       (select coalesce(sum(amount_xof), 0)::int from payments where status = 'confirmed' and confirmed_at >= date_trunc('month', now() at time zone 'Africa/Lome') at time zone 'Africa/Lome') as month_revenue,
       (select coalesce(sum(commission_xof), 0)::int from payments where status = 'confirmed' and confirmed_at >= date_trunc('month', now() at time zone 'Africa/Lome') at time zone 'Africa/Lome') as month_commission,
       (select count(distinct user_id)::int from passes where ends_at > now()) as active_passes`,
  );
}

// Programmes et examens (écrans 29 et 31) ----------------------------------------------------------

export async function listPrograms(db: Queryable) {
  return all(
    db,
    `select p.id, p.country_code, p.license_type, p.name, p.status, p.exam_question_count,
            (select count(*)::int from lessons l join units u on u.id = l.unit_id where u.program_id = p.id) as lessons,
            (select count(*)::int from questions q join units u on u.id = q.unit_id where u.program_id = p.id) as questions,
            (select count(*)::int from questions q join units u on u.id = q.unit_id where u.program_id = p.id and q.status = 'validee') as validated
     from programs p order by p.status = 'publie' desc, p.country_code, p.license_type`,
  );
}

export type ProgramDetail = {
  id: string;
  country_code: string;
  license_type: string;
  name: string;
  status: ProgramStatus;
  exam_question_count: number;
  exam_pass_mark: number;
  exam_seconds_per_question: number;
  exam_distribution: Record<string, number>;
  units: { id: string; title: string; position: number; validated: number; total: number }[];
};

export async function getProgram(db: Queryable, id: string): Promise<ProgramDetail | null> {
  const program = await one<Omit<ProgramDetail, "units">>(
    db,
    `select id, country_code, license_type, name, status, exam_question_count, exam_pass_mark,
            exam_seconds_per_question, exam_distribution
     from programs where id = $1`,
    [id],
  );
  if (!program) return null;
  const units = await all<{ id: string; title: string; position: number; validated: number; total: number }>(
    db,
    `select u.id, u.title, u.position,
            count(q.id) filter (where q.status = 'validee')::int as validated, count(q.id)::int as total
     from units u left join questions q on q.unit_id = u.id
     where u.program_id = $1 group by u.id order by u.position`,
    [id],
  );
  return { ...program, units };
}

export type ExamSettings = { count: number; passMark: number; seconds: number; distribution: Record<string, number> };

/** Contrôles de conformité de l'écran 31 : la banque de questions validées suffit-elle à composer un examen ? */
export function examChecks(
  settings: ExamSettings,
  units: { id: string; title: string; validated: number }[],
): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const total = units.reduce((n, u) => n + u.validated, 0);
  const planned = Object.values(settings.distribution).reduce((n, v) => n + v, 0);
  if (settings.passMark > settings.count) problems.push("Le seuil dépasse le nombre de questions.");
  if (planned > settings.count) problems.push(`La répartition prévoit ${planned} questions pour un examen de ${settings.count}.`);
  if (total < settings.count) problems.push(`Seulement ${total} questions validées pour un examen de ${settings.count}.`);
  for (const u of units) {
    const wanted = settings.distribution[u.id] ?? 0;
    if (wanted > u.validated) problems.push(`« ${u.title} » : ${wanted} questions prévues, ${u.validated} validées.`);
  }
  return { ok: problems.length === 0, problems };
}

export async function updateExamSettings(db: Queryable, id: string, s: ExamSettings) {
  const distribution = Object.fromEntries(Object.entries(s.distribution).filter(([, n]) => n > 0));
  await db.query(
    `update programs set exam_question_count = $2, exam_pass_mark = $3, exam_seconds_per_question = $4, exam_distribution = $5
     where id = $1`,
    [id, s.count, s.passMark, s.seconds, JSON.stringify(distribution)],
  );
}

/** Seul un programme dont la banque d'examen est conforme peut être publié. */
export async function setProgramStatus(db: Queryable, id: string, status: ProgramStatus) {
  if (status === "publie") {
    const p = await getProgram(db, id);
    if (!p) throw new AdminError("Programme introuvable.");
    const checks = examChecks(
      { count: p.exam_question_count, passMark: p.exam_pass_mark, seconds: p.exam_seconds_per_question, distribution: p.exam_distribution },
      p.units,
    );
    if (!checks.ok) throw new AdminError(`Publication impossible : ${checks.problems.join(" ")}`);
  }
  await db.query("update programs set status = $2 where id = $1", [id, status]);
}

export async function createProgram(db: Queryable, p: { country: string; license: string; name: string }) {
  const country = p.country.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new AdminError("Code pays à deux lettres, par exemple TG.");
  if (!p.name.trim()) throw new AdminError("Nom obligatoire.");
  const exists = await one(db, "select 1 from programs where country_code = $1 and license_type = $2", [country, p.license]);
  if (exists) throw new AdminError("Ce programme existe déjà.");
  return one<{ id: string }>(db, "insert into programs (country_code, license_type, name) values ($1, $2, $3) returning id", [
    country,
    p.license,
    p.name.trim(),
  ]);
}

// Contenus (écran 30) ---------------------------------------------------------------------------------

export async function contentTree(db: Queryable, programId: string) {
  const units = await all<{ id: string; title: string; position: number }>(
    db,
    "select id, title, position from units where program_id = $1 order by position",
    [programId],
  );
  const lessons = await all<{ id: string; unit_id: string; title: string; position: number; counts: Record<string, number> }>(
    db,
    `select l.id, l.unit_id, l.title, l.position,
            coalesce((select jsonb_object_agg(status, n) from (select status, count(*)::int n from questions where lesson_id = l.id group by status) s), '{}') as counts
     from lessons l join units u on u.id = l.unit_id where u.program_id = $1 order by l.position`,
    [programId],
  );
  const orphans = await all<{ unit_id: string; n: number }>(
    db,
    `select q.unit_id, count(*)::int n from questions q join units u on u.id = q.unit_id
     where u.program_id = $1 and q.lesson_id is null group by q.unit_id`,
    [programId],
  );
  return units.map((u) => ({
    ...u,
    lessons: lessons.filter((l) => l.unit_id === u.id),
    withoutLesson: orphans.find((o) => o.unit_id === u.id)?.n ?? 0,
  }));
}

export async function createUnit(db: Queryable, programId: string, title: string) {
  if (!title.trim()) throw new AdminError("Titre obligatoire.");
  return one<{ id: string }>(
    db,
    `insert into units (program_id, title, position)
     values ($1, $2, coalesce((select max(position) + 1 from units where program_id = $1), 1)) returning id`,
    [programId, title.trim()],
  );
}

export async function renameUnit(db: Queryable, id: string, title: string) {
  if (!title.trim()) throw new AdminError("Titre obligatoire.");
  await db.query("update units set title = $2 where id = $1", [id, title.trim()]);
}

export async function createLesson(db: Queryable, unitId: string, title: string) {
  if (!title.trim()) throw new AdminError("Titre obligatoire.");
  return one<{ id: string }>(
    db,
    `insert into lessons (unit_id, title, position)
     values ($1, $2, coalesce((select max(position) + 1 from lessons where unit_id = $1), 1)) returning id`,
    [unitId, title.trim()],
  );
}

export type LessonInput = { title: string; introTitle: string; introText: string; introImagePath: string; mentorTip: string };

export async function getLesson(db: Queryable, id: string) {
  return one(
    db,
    `select l.*, u.title as unit_title, u.program_id from lessons l join units u on u.id = l.unit_id where l.id = $1`,
    [id],
  );
}

export async function updateLesson(db: Queryable, id: string, l: LessonInput) {
  if (!l.title.trim()) throw new AdminError("Titre obligatoire.");
  const n = (v: string) => (v.trim() ? v.trim() : null);
  await db.query(
    `update lessons set title = $2, intro_title = $3, intro_text = $4, intro_image_path = $5, mentor_tip = $6 where id = $1`,
    [id, l.title.trim(), n(l.introTitle), n(l.introText), n(l.introImagePath), n(l.mentorTip)],
  );
}

export async function listQuestions(db: Queryable, f: { programId: string; status?: string; lessonId?: string; search?: string }) {
  return all(
    db,
    `select q.id, q.prompt, q.status, q.position, q.image_path, q.updated_at, l.title as lesson_title, u.title as unit_title,
            (select count(*)::int from question_reports r where r.question_id = q.id and r.status <> 'resolu') as open_reports
     from questions q join units u on u.id = q.unit_id left join lessons l on l.id = q.lesson_id
     where u.program_id = $1
       and ($2::question_status is null or q.status = $2)
       and ($3::uuid is null or q.lesson_id = $3)
       and ($4::text is null or q.prompt ilike '%' || $4 || '%')
     order by u.position, l.position nulls last, q.position, q.id
     limit 300`,
    [f.programId, f.status || null, f.lessonId || null, f.search?.trim() || null],
  );
}

export type ChoiceInput = { id?: string; label: string; isCorrect: boolean };
export type QuestionInput = {
  unitId: string;
  lessonId: string | null;
  prompt: string;
  imagePath: string;
  explanation: string;
  source: string;
  choices: ChoiceInput[];
};

export type QuestionDetail = {
  id: string;
  unit_id: string;
  lesson_id: string | null;
  program_id: string;
  unit_title: string;
  lesson_title: string | null;
  prompt: string;
  image_path: string | null;
  explanation: string | null;
  source: string | null;
  status: QuestionStatus;
  updated_at: string;
  choices: { id: string; label: string; is_correct: boolean; position: number }[];
  reports: { id: string; reason: string; comment: string | null; status: ReportStatus; admin_note: string | null; created_at: string }[];
};

export async function getQuestion(db: Queryable, id: string): Promise<QuestionDetail | null> {
  const q = await one<Omit<QuestionDetail, "choices" | "reports">>(
    db,
    `select q.*, u.program_id, u.title as unit_title, l.title as lesson_title
     from questions q join units u on u.id = q.unit_id left join lessons l on l.id = q.lesson_id where q.id = $1`,
    [id],
  );
  if (!q) return null;
  const choices = await all<{ id: string; label: string; is_correct: boolean; position: number }>(
    db,
    "select id, label, is_correct, position from choices where question_id = $1 order by position",
    [id],
  );
  const reports = await all<QuestionDetail["reports"][number]>(
    db,
    "select id, reason, comment, status, admin_note, created_at from question_reports where question_id = $1 order by created_at desc",
    [id],
  );
  return { ...q, choices, reports };
}

/**
 * Enregistre une question et ses choix (à appeler dans une transaction). Les choix gardent leur identifiant
 * quand ils sont modifiés, pour que les corrections déjà passées restent lisibles.
 * Une question validée qui change repasse automatiquement en validation (règle de la base).
 */
export async function saveQuestion(db: Queryable, id: string | null, input: QuestionInput): Promise<string> {
  const choices = input.choices.filter((c) => c.label.trim());
  if (!input.prompt.trim()) throw new AdminError("L'énoncé est obligatoire.");
  if (choices.length > 8) throw new AdminError("8 choix au maximum.");
  const n = (v: string) => (v.trim() ? v.trim() : null);
  const values = [input.unitId, input.lessonId || null, input.prompt.trim(), n(input.imagePath), n(input.explanation), n(input.source)];

  let questionId = id;
  if (questionId) {
    await db.query(
      `update questions set unit_id = $2, lesson_id = $3, prompt = $4, image_path = $5, explanation = $6, source = $7 where id = $1`,
      [questionId, ...values],
    );
  } else {
    const created = await one<{ id: string }>(
      db,
      `insert into questions (unit_id, lesson_id, prompt, image_path, explanation, source, position)
       values ($1, $2, $3, $4, $5, $6, coalesce((select max(position) + 1 from questions where lesson_id = $2), 0)) returning id`,
      values,
    );
    questionId = created!.id;
  }

  const kept = choices.filter((c) => c.id).map((c) => c.id!);
  await db.query("delete from choices where question_id = $1 and not (id = any($2::uuid[]))", [questionId, kept]);
  for (const [index, c] of choices.entries()) {
    const i = index + 1; // positions à partir de 1, comme à l'import
    if (c.id) {
      await db.query(
        `update choices set label = $3, is_correct = $4, position = $5
         where id = $1 and question_id = $2 and (label, is_correct, position) is distinct from ($3, $4, $5)`,
        [c.id, questionId, c.label.trim(), c.isCorrect, i],
      );
    } else {
      await db.query("insert into choices (question_id, label, is_correct, position) values ($1, $2, $3, $4)", [
        questionId,
        c.label.trim(),
        c.isCorrect,
        i,
      ]);
    }
  }
  return questionId;
}

/** Circuit de validation : brouillon → en_validation → validee. La base refuse une question incomplète. */
export async function setQuestionStatus(db: Queryable, id: string, status: QuestionStatus) {
  await db.query("update questions set status = $2 where id = $1", [id, status]);
}

export async function deleteQuestion(db: Queryable, id: string) {
  const used = await one(db, "select 1 from session_answers where question_id = $1 union all select 1 from exam_answers where question_id = $1 limit 1", [id]);
  if (used) throw new AdminError("Cette question a déjà été utilisée par des élèves : repasse-la en brouillon au lieu de la supprimer.");
  await db.query("delete from questions where id = $1", [id]);
}

/** Message lisible pour les refus de la base (validation d'une question incomplète…). */
export function explainDbError(error: unknown): string {
  if (error instanceof AdminError) return error.message;
  const message = (error as { message?: string })?.message ?? "";
  const m = /^question_invalide: (.*)$/.exec(message);
  if (m) return `Validation impossible : ${m[1]}.`;
  const code = (error as { code?: string })?.code;
  if (code === "23505") return "Cette valeur existe déjà.";
  if (code === "23514" || code === "22P02") return "Valeur invalide.";
  console.error(error);
  return "Erreur inattendue. Réessaie.";
}

// Signalements (écran 32) ---------------------------------------------------------------------------

export async function listReports(db: Queryable, status?: string) {
  return all(
    db,
    `select r.id, r.reason, r.comment, r.status, r.admin_note, r.created_at, r.question_id, q.prompt, q.status as question_status,
            u.title as unit_title
     from question_reports r join questions q on q.id = r.question_id join units u on u.id = q.unit_id
     where ($1::report_status is null or r.status = $1)
     order by r.status = 'resolu', r.created_at desc limit 300`,
    [status || null],
  );
}

export async function updateReport(db: Queryable, id: string, status: ReportStatus, note: string) {
  await db.query("update question_reports set status = $2, admin_note = $3, updated_at = now() where id = $1", [
    id,
    status,
    note.trim() || null,
  ]);
}

// Auto-écoles --------------------------------------------------------------------------------------------

export type SchoolInput = { name: string; promoCode: string; discount: number; commission: number; active: boolean };

export async function listSchools(db: Queryable) {
  return all(
    db,
    `select s.*,
            (select count(*)::int from profiles p where p.driving_school_id = s.id) as students,
            (select count(*)::int from payments p where p.driving_school_id = s.id and p.status = 'confirmed') as sales,
            (select coalesce(sum(commission_xof), 0)::int from payments p where p.driving_school_id = s.id and p.status = 'confirmed') as commission
     from driving_schools s order by s.active desc, s.name`,
  );
}

function checkSchool(s: SchoolInput) {
  if (!s.name.trim()) throw new AdminError("Nom obligatoire.");
  if (!/^[A-Z0-9]{3,20}$/.test(s.promoCode.trim().toUpperCase())) throw new AdminError("Code promo : 3 à 20 lettres ou chiffres.");
  for (const v of [s.discount, s.commission]) {
    if (!Number.isInteger(v) || v < 0 || v > 100) throw new AdminError("Les taux sont des pourcentages entiers entre 0 et 100.");
  }
}

export async function saveSchool(db: Queryable, id: string | null, s: SchoolInput) {
  checkSchool(s);
  const taken = await one(db, "select 1 from driving_schools where promo_code = $1 and id is distinct from $2", [
    s.promoCode.trim().toUpperCase(),
    id,
  ]);
  if (taken) throw new AdminError("Ce code promo est déjà utilisé par une autre auto-école.");
  const values = [s.name.trim(), s.promoCode.trim().toUpperCase(), s.discount, s.commission, s.active];
  if (id) {
    await db.query(
      "update driving_schools set name = $2, promo_code = $3, discount_percent = $4, commission_percent = $5, active = $6 where id = $1",
      [id, ...values],
    );
    return id;
  }
  const row = await one<{ id: string }>(
    db,
    "insert into driving_schools (name, promo_code, discount_percent, commission_percent, active) values ($1, $2, $3, $4, $5) returning id",
    values,
  );
  return row!.id;
}

// Ventes ---------------------------------------------------------------------------------------------------

/** `month` au format AAAA-MM (heure de Lomé). */
export async function listPayments(db: Queryable, f: { month: string; schoolId?: string; status?: string }) {
  return all(
    db,
    `with bounds as (select ($1 || '-01')::date as d)
     select p.id, p.status, p.base_amount_xof, p.discount_xof, p.amount_xof, p.commission_xof, p.gateway_ref,
            p.failure_reason, p.created_at, p.confirmed_at, s.name as school, pr.email
     from payments p cross join bounds b
     left join driving_schools s on s.id = p.driving_school_id
     left join profiles pr on pr.id = p.user_id
     where p.created_at >= b.d::timestamp at time zone 'Africa/Lome'
       and p.created_at < (b.d + interval '1 month')::timestamp at time zone 'Africa/Lome'
       and ($2::uuid is null or p.driving_school_id = $2)
       and ($3::payment_status is null or p.status = $3)
     order by p.created_at desc`,
    [f.month, f.schoolId || null, f.status || null],
  );
}

export async function commissionReport(db: Queryable, month: string) {
  return all<{ driving_school_id: string; name: string; sales_count: number; revenue_xof: number; commission_xof: number }>(
    db,
    "select driving_school_id, name, sales_count::int, revenue_xof::int, commission_xof::int from admin_commission_report(($1 || '-01')::date)",
    [month],
  );
}

export function paymentsCsv(rows: Awaited<ReturnType<typeof listPayments>>): string {
  const head = ["date", "statut", "eleve", "auto_ecole", "prix", "reduction", "montant", "commission", "reference"];
  const cell = (v: unknown) => {
    const s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((r) =>
    [r.created_at, r.status, r.email, r.school, r.base_amount_xof, r.discount_xof, r.amount_xof, r.commission_xof, r.gateway_ref]
      .map(cell)
      .join(";"),
  );
  // Point-virgule et BOM : s'ouvre correctement dans Excel en français
  return "﻿" + [head.join(";"), ...lines].join("\r\n") + "\r\n";
}

// Réglages globaux ------------------------------------------------------------------------------------------

export const SETTINGS: Record<string, { label: string; min: number; max: number; unit: string }> = {
  pass_price_xof: { label: "Prix du Pass Examen", min: 0, max: 1_000_000, unit: "FCFA" },
  pass_duration_days: { label: "Durée du Pass Examen", min: 1, max: 730, unit: "jours" },
  xp_per_session: { label: "XP par séance", min: 0, max: 1000, unit: "XP" },
  xp_perfect_bonus: { label: "Bonus sans-faute", min: 0, max: 1000, unit: "XP" },
  ready_after_consecutive_passes: { label: "Examens réussis d'affilée pour être « prêt »", min: 1, max: 20, unit: "examens" },
  max_review_per_lesson: { label: "Erreurs revues glissées dans une leçon", min: 0, max: 10, unit: "questions" },
};

export async function getSettings(db: Queryable) {
  const rows = await all<{ key: string; value: number }>(db, "select key, (value #>> '{}')::int as value from settings");
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, number>;
}

export async function updateSettings(db: Queryable, values: Record<string, number>) {
  for (const [key, value] of Object.entries(values)) {
    const def = SETTINGS[key];
    if (!def) continue;
    if (!Number.isInteger(value) || value < def.min || value > def.max) {
      throw new AdminError(`${def.label} : valeur entre ${def.min} et ${def.max}.`);
    }
    await db.query("update settings set value = to_jsonb($2::int) where key = $1", [key, value]);
  }
}

// Administrateurs ----------------------------------------------------------------------------------------------

export async function isAdmin(db: Queryable, userId: string): Promise<boolean> {
  return Boolean(await one(db, "select 1 from admins where user_id = $1", [userId]));
}
