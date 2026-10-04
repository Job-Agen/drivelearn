import type { Queryable } from "./types";

export type Dashboard = {
  students: number;
  questions: Record<string, number>;
  open_reports: number;
  month: { sales: number; revenue_xof: number; commission_xof: number };
};

export async function getDashboard(db: Queryable): Promise<Dashboard> {
  const { rows } = await db.query(
    `select
       (select count(*)::int from profiles where id not in (select user_id from admins)) as students,
       coalesce((select jsonb_object_agg(status, n)
                 from (select status::text as status, count(*)::int as n from questions group by status) s), '{}'::jsonb) as questions,
       (select count(*)::int from question_reports where status <> 'resolu') as open_reports,
       (select jsonb_build_object('sales', count(*)::int, 'revenue_xof', coalesce(sum(amount_xof), 0)::int,
                                  'commission_xof', coalesce(sum(commission_xof), 0)::int)
        from payments where status = 'confirmed'
          and confirmed_at >= date_trunc('month', now() at time zone 'Africa/Lome') at time zone 'Africa/Lome') as month`,
  );
  return rows[0];
}
