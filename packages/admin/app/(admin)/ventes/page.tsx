import Link from "next/link";
import { Card, inputClass, PageTitle, StatusBadge, tableClass } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { commissionReport, currentMonth, listPayments } from "@/lib/data/sales";
import { listSchools } from "@/lib/data/schools";
import { pool } from "@/lib/db";

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ month?: string; school?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const month = sp.month || currentMonth();
  const [report, payments, schools] = await Promise.all([
    commissionReport(pool, month),
    listPayments(pool, { month, schoolId: sp.school || undefined }),
    listSchools(pool),
  ]);
  const query = `month=${month}&school=${sp.school ?? ""}`;
  return (
    <>
      <PageTitle
        title="Ventes et commissions"
        subtitle={`Mois ${month}`}
        actions={<Link href={`/ventes/export?${query}`} className="rounded-lg bg-sarcelle px-4 py-2 text-sm font-semibold text-white">Exporter (CSV)</Link>}
      />
      <form className="mb-4 flex gap-3">
        <input name="month" type="month" defaultValue={month} className={`${inputClass} w-48`} />
        <select name="school" defaultValue={sp.school ?? ""} className={`${inputClass} w-64`}>
          <option value="">Toutes les auto-écoles</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">Afficher</button>
      </form>
      <Card title="Commissions dues">
        <table className={tableClass}>
          <thead><tr><th>Auto-école</th><th>Ventes</th><th>Chiffre d'affaires</th><th>Commission due</th></tr></thead>
          <tbody>
            {report.map((r) => (
              <tr key={r.driving_school_id} className="border-t border-slate-100">
                <td>{r.name}</td>
                <td>{r.sales_count}</td>
                <td>{fcfa(r.revenue_xof)}</td>
                <td className="font-semibold">{fcfa(r.commission_xof)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Paiements du mois">
        <table className={tableClass}>
          <thead><tr><th>Date</th><th>Élève</th><th>Auto-école</th><th>Montant</th><th>Commission</th><th>Statut</th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td>{new Date(p.created_at).toLocaleString("fr-FR")}</td>
                <td>{p.email ?? "compte supprimé"}</td>
                <td>{p.school_name ?? "—"}</td>
                <td>{fcfa(p.amount_xof)}</td>
                <td>{fcfa(p.commission_xof)}</td>
                <td><StatusBadge status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
