import { z } from "zod";
import type { Queryable } from "./types";

// Codes d'activation du Pass Examen, vendus hors de l'application (voir migration 0009).

const NewBatch = z.object({
  label: z.string().trim().min(1, "Nom du lot obligatoire").max(100),
  driving_school_id: z.string().uuid().nullable(),
  count: z.number().int().min(1, "Entre 1 et 1000 codes").max(1000, "Entre 1 et 1000 codes"),
  duration_days: z.number().int().min(1, "Durée entre 1 et 730 jours").max(730, "Durée entre 1 et 730 jours"),
});

export type BatchRow = {
  id: string;
  label: string;
  school_name: string | null;
  duration_days: number;
  created_at: string;
  total: number;
  redeemed: number;
};

export type CodeRow = { code: string; redeemed_at: string | null; email: string | null };

export async function createBatch(db: Queryable, input: z.input<typeof NewBatch>): Promise<string> {
  const b = NewBatch.parse(input);
  const { rows } = await db.query("select create_pass_code_batch($1, $2, $3, $4) as id", [
    b.label,
    b.driving_school_id,
    b.count,
    b.duration_days,
  ]);
  return rows[0].id;
}

export async function listBatches(db: Queryable): Promise<BatchRow[]> {
  const { rows } = await db.query(
    `select b.id, b.label, s.name as school_name, b.duration_days, b.created_at,
            count(c.code)::int as total, count(c.redeemed_at)::int as redeemed
     from pass_code_batches b
     left join driving_schools s on s.id = b.driving_school_id
     left join pass_codes c on c.batch_id = b.id
     group by b.id, s.name
     order by b.created_at desc`,
  );
  return rows;
}

export async function getBatch(db: Queryable, batchId: string): Promise<{ label: string; codes: CodeRow[] } | null> {
  const { rows } = await db.query("select label from pass_code_batches where id = $1", [batchId]);
  if (!rows[0]) return null;
  const codes = await db.query(
    `select c.code, c.redeemed_at, p.email
     from pass_codes c left join profiles p on p.id = c.redeemed_by
     where c.batch_id = $1 order by c.code`,
    [batchId],
  );
  return { label: rows[0].label, codes: codes.rows };
}
