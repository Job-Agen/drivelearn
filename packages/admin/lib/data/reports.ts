import { z } from "zod";
import type { Queryable } from "./types";

export type ReportStatus = "nouveau" | "en_cours" | "resolu";
export type ReportRow = {
  id: string;
  question_id: string;
  prompt: string;
  reason: string;
  comment: string | null;
  status: ReportStatus;
  admin_note: string | null;
  created_at: Date;
};

export async function listReports(db: Queryable, status?: ReportStatus): Promise<ReportRow[]> {
  const { rows } = await db.query(
    `select r.id, r.question_id, q.prompt, r.reason::text as reason, r.comment, r.status::text as status,
            r.admin_note, r.created_at
     from question_reports r join questions q on q.id = r.question_id
     where ($1::text is null or r.status::text = $1)
     order by r.created_at desc limit 200`,
    [status ?? null],
  );
  return rows;
}

const ReportUpdate = z.object({
  status: z.enum(["nouveau", "en_cours", "resolu"]),
  admin_note: z.string().trim().max(1000).nullable(),
});

export async function updateReport(db: Queryable, id: string, input: z.input<typeof ReportUpdate>): Promise<void> {
  const r = ReportUpdate.parse(input);
  await db.query("update question_reports set status = $2, admin_note = $3, updated_at = now() where id = $1", [
    id,
    r.status,
    r.admin_note || null,
  ]);
}
