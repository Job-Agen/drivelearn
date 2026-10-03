import Link from "next/link";
import { Badge, PAYMENT_STATUS, date, fcfa, one } from "@/components/ui";
import { pool } from "@/lib/db";
import { commissionReport, listPayments, listSchools } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";

function currentMonth(): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Africa/Lome", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
}

/** Ventes du Pass Examen, filtrables par mois et auto-école ; commissions dues ; export CSV. */
export default async function SalesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(one(sp.month) ?? "") ? one(sp.month)! : currentMonth();
  const school = one(sp.school);
  const status = one(sp.status);
  const [payments, report, schools] = await Promise.all([
    listPayments(pool, { month, schoolId: school, status }),
    commissionReport(pool, month),
    listSchools(pool),
  ]);
  const confirmed = payments.filter((p) => p.status === "confirmed");
  const revenue = confirmed.reduce((n, p) => n + p.amount_xof, 0);
  const commission = confirmed.reduce((n, p) => n + p.commission_xof, 0);
  const query = new URLSearchParams({ month, ...(school ? { school } : {}), ...(status ? { status } : {}) });
  const monthLabel = new Date(`${month}-15`).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Ventes</h1>
          <p className="muted">Pass Examen vendus en {monthLabel} (heure de Lomé).</p>
        </div>
        <Link className="btn secondary" href={`/ventes/export?${query}`}>
          Exporter en CSV
        </Link>
      </div>
      <form className="card row" style={{ alignItems: "flex-end" }}>
        <label className="field">
          Mois
          <input type="month" name="month" defaultValue={month} />
        </label>
        <label className="field">
          Auto-école
          <select name="school" defaultValue={school ?? ""}>
            <option value="">Toutes</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Statut
          <select name="status" defaultValue={status ?? ""}>
            <option value="">Tous</option>
            {Object.entries(PAYMENT_STATUS).map(([s, label]) => (
              <option key={s} value={s}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn">Filtrer</button>
      </form>
      <div className="grid">
        <div className="card stat">
          <span className="value">{confirmed.length}</span>
          <span className="label">Pass vendus</span>
        </div>
        <div className="card stat">
          <span className="value">{fcfa(revenue)}</span>
          <span className="label">Encaissé</span>
        </div>
        <div className="card stat">
          <span className="value">{fcfa(commission)}</span>
          <span className="label">Commissions dues</span>
        </div>
      </div>
      <div className="card">
        <h2>Commissions dues par auto-école</h2>
        <table>
          <thead>
            <tr>
              <th>Auto-école</th>
              <th className="num">Ventes</th>
              <th className="num">Encaissé</th>
              <th className="num">Commission due</th>
            </tr>
          </thead>
          <tbody>
            {report.map((r) => (
              <tr key={r.driving_school_id}>
                <td>{r.name}</td>
                <td className="num">{r.sales_count}</td>
                <td className="num">{fcfa(r.revenue_xof)}</td>
                <td className="num">
                  <strong>{fcfa(r.commission_xof)}</strong>
                </td>
              </tr>
            ))}
            {report.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  Aucune auto-école.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Élève</th>
            <th>Auto-école</th>
            <th className="num">Montant</th>
            <th className="num">Commission</th>
            <th>Statut</th>
            <th>Référence</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td>{date(p.created_at, true)}</td>
              <td>{p.email ?? <span className="muted">Compte supprimé</span>}</td>
              <td>{p.school ?? "—"}</td>
              <td className="num">
                {fcfa(p.amount_xof)}
                {p.discount_xof ? <div className="muted small">−{fcfa(p.discount_xof)}</div> : null}
              </td>
              <td className="num">{fcfa(p.commission_xof)}</td>
              <td>
                <Badge status={p.status} labels={PAYMENT_STATUS} />
                {p.failure_reason ? <div className="muted small">{p.failure_reason}</div> : null}
              </td>
              <td className="small">{p.gateway_ref ?? "—"}</td>
            </tr>
          ))}
          {payments.length === 0 ? (
            <tr>
              <td colSpan={7} className="muted">
                Aucun paiement sur cette période.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
