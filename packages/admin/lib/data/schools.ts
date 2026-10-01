import { z } from "zod";
import type { Queryable } from "./types";

const Percent = z.number().int().min(0, "Pourcentage entre 0 et 100").max(100, "Pourcentage entre 0 et 100");
const NewSchool = z.object({
  name: z.string().trim().min(1, "Nom obligatoire").max(120),
  promo_code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{3,20}$/, "Code promo : 3 à 20 lettres ou chiffres")),
  discount_percent: Percent,
  commission_percent: Percent,
});
const SchoolUpdate = z.object({
  name: z.string().trim().min(1, "Nom obligatoire").max(120),
  discount_percent: Percent,
  commission_percent: Percent,
  active: z.boolean(),
});

export type SchoolRow = {
  id: string;
  name: string;
  promo_code: string;
  discount_percent: number;
  commission_percent: number;
  active: boolean;
  students: number;
  confirmed_sales: number;
};

export async function listSchools(db: Queryable): Promise<SchoolRow[]> {
  const { rows } = await db.query(
    `select s.id, s.name, s.promo_code, s.discount_percent, s.commission_percent, s.active,
            (select count(*)::int from profiles p where p.driving_school_id = s.id) as students,
            (select count(*)::int from payments pay where pay.driving_school_id = s.id and pay.status = 'confirmed') as confirmed_sales
     from driving_schools s order by s.name`,
  );
  return rows;
}

export async function createSchool(db: Queryable, input: z.input<typeof NewSchool>): Promise<string> {
  const s = NewSchool.parse(input);
  const { rows } = await db.query(
    "insert into driving_schools (name, promo_code, discount_percent, commission_percent) values ($1, $2, $3, $4) returning id",
    [s.name, s.promo_code, s.discount_percent, s.commission_percent],
  );
  return rows[0].id;
}

export async function updateSchool(db: Queryable, id: string, input: z.input<typeof SchoolUpdate>): Promise<void> {
  const s = SchoolUpdate.parse(input);
  await db.query(
    "update driving_schools set name = $2, discount_percent = $3, commission_percent = $4, active = $5 where id = $1",
    [id, s.name, s.discount_percent, s.commission_percent, s.active],
  );
}
