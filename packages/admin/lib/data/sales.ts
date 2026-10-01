import { AdminError } from "../errors";
import type { Queryable } from "./types";

export function monthStart(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new AdminError("Mois invalide (format AAAA-MM).");
  return `${month}-01`;
}

/** Mois en cours à Lomé (UTC). */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export type CommissionRow = { driving_school_id: string; name: string; sales_count: number; revenue_xof: number; commission_xof: number };
export type PaymentRow = {
  id: string;
  created_at: Date;
  confirmed_at: Date | null;
  status: string;
  base_amount_xof: number;
  discount_xof: number;
  amount_xof: number;
  commission_xof: number;
  school_name: string | null;
  email: string | null;
};

export async function commissionReport(db: Queryable, month: string): Promise<CommissionRow[]> {
  const { rows } = await db.query(
    `select driving_school_id, name, sales_count::int, revenue_xof::int, commission_xof::int
     from admin_commission_report($1::date)`,
    [monthStart(month)],
  );
  return rows;
}

export async function listPayments(
  db: Queryable,
  f: { month: string; schoolId?: string; confirmedOnly?: boolean },
): Promise<PaymentRow[]> {
  const { rows } = await db.query(
    `select pay.id, pay.created_at, pay.confirmed_at, pay.status::text as status, pay.base_amount_xof, pay.discount_xof,
            pay.amount_xof, pay.commission_xof, s.name as school_name, p.email
     from payments pay
     left join driving_schools s on s.id = pay.driving_school_id
     left join profiles p on p.id = pay.user_id
     where pay.created_at >= $1::date and pay.created_at < ($1::date + interval '1 month')
       and ($2::uuid is null or pay.driving_school_id = $2)
       and ($3::boolean is not true or pay.status = 'confirmed')
     order by pay.created_at desc`,
    [monthStart(f.month), f.schoolId ?? null, f.confirmedOnly ?? false],
  );
  return rows;
}
