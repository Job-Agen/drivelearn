import { z } from "zod";
import { AdminError } from "../errors";
import type { Queryable } from "./types";

export type LessonRow = {
  id: string;
  title: string;
  position: number;
  intro_title: string | null;
  intro_text: string | null;
  intro_image_path: string | null;
  mentor_tip: string | null;
  counts: Record<string, number>;
};
export type UnitRow = { id: string; title: string; position: number; lessons: LessonRow[] };

const Title = z.string().trim().min(1, "Titre obligatoire").max(120);

export async function listUnits(db: Queryable, programId: string): Promise<UnitRow[]> {
  const { rows } = await db.query(
    `select u.id, u.title, u.position,
       coalesce((
         select jsonb_agg(jsonb_build_object(
           'id', l.id, 'title', l.title, 'position', l.position,
           'intro_title', l.intro_title, 'intro_text', l.intro_text,
           'intro_image_path', l.intro_image_path, 'mentor_tip', l.mentor_tip,
           'counts', coalesce((
             select jsonb_object_agg(s.status, s.n)
             from (select q.status::text as status, count(*)::int as n
                   from questions q where q.lesson_id = l.id group by q.status) as s
           ), '{}'::jsonb)
         ) order by l.position)
         from lessons l where l.unit_id = u.id
       ), '[]'::jsonb) as lessons
     from units u where u.program_id = $1 order by u.position`,
    [programId],
  );
  return rows;
}

export async function createUnit(db: Queryable, programId: string, title: string): Promise<string> {
  const { rows } = await db.query(
    `insert into units (program_id, title, position)
     values ($1, $2, (select coalesce(max(position), 0) + 1 from units where program_id = $1)) returning id`,
    [programId, Title.parse(title)],
  );
  return rows[0].id;
}

export async function renameUnit(db: Queryable, unitId: string, title: string): Promise<void> {
  await db.query("update units set title = $2 where id = $1", [unitId, Title.parse(title)]);
}

export async function deleteUnit(db: Queryable, unitId: string): Promise<void> {
  const { rows } = await db.query("select count(*)::int as n from questions where unit_id = $1", [unitId]);
  if (rows[0].n > 0) throw new AdminError("Cette unité contient des questions : déplacez-les ou supprimez-les d'abord.");
  await db.query("delete from units where id = $1", [unitId]);
}

export async function createLesson(db: Queryable, unitId: string, title: string): Promise<string> {
  const { rows } = await db.query(
    `insert into lessons (unit_id, title, position)
     values ($1, $2, (select coalesce(max(position), 0) + 1 from lessons where unit_id = $1)) returning id`,
    [unitId, Title.parse(title)],
  );
  return rows[0].id;
}

const LessonInput = z.object({
  title: Title,
  intro_title: z.string().trim().max(120).nullable(),
  intro_text: z.string().trim().max(2000).nullable(),
  intro_image_path: z.string().trim().max(300).nullable(),
  mentor_tip: z.string().trim().max(300).nullable(),
});

export async function updateLesson(db: Queryable, lessonId: string, input: z.input<typeof LessonInput>): Promise<void> {
  const l = LessonInput.parse(input);
  await db.query(
    `update lessons set title = $2, intro_title = $3, intro_text = $4, intro_image_path = $5, mentor_tip = $6
     where id = $1`,
    [lessonId, l.title, l.intro_title || null, l.intro_text || null, l.intro_image_path || null, l.mentor_tip || null],
  );
}

export async function deleteLesson(db: Queryable, lessonId: string): Promise<void> {
  const { rows } = await db.query("select count(*)::int as n from questions where lesson_id = $1", [lessonId]);
  if (rows[0].n > 0) throw new AdminError("Cette leçon contient des questions : déplacez-les ou supprimez-les d'abord.");
  await db.query("delete from lessons where id = $1", [lessonId]);
}

/** Échange la position avec la voisine (unité du même programme, ou leçon de la même unité). */
export async function moveItem(db: Queryable, kind: "unit" | "lesson", id: string, direction: "up" | "down"): Promise<void> {
  const [table, parent] = kind === "unit" ? ["units", "program_id"] : ["lessons", "unit_id"];
  const comparison = direction === "up" ? "<" : ">";
  const order = direction === "up" ? "desc" : "asc";
  await db.query(
    `with me as (select id, position, ${parent} as parent from ${table} where id = $1),
          other as (
            select t.id, t.position from ${table} t, me
            where t.${parent} = me.parent and t.position ${comparison} me.position
            order by t.position ${order} limit 1
          )
     update ${table} t set position = case when t.id = me.id then other.position else me.position end
     from me, other where t.id in (me.id, other.id)`,
    [id],
  );
}
