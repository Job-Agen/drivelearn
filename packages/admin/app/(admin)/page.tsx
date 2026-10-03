import Link from "next/link";
import { QUESTION_STATUS, fcfa } from "@/components/ui";
import { pool } from "@/lib/db";
import { dashboard } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";

export default async function DashboardPage() {
  await requireAdmin();
  const d = (await dashboard(pool))!;
  const toReview = d.questions.en_validation + d.questions.a_verifier;
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Tableau de bord</h1>
          <p className="muted">Vue d'ensemble de DriveLearn.</p>
        </div>
      </div>
      <div className="grid">
        <Stat value={d.students} label="Élèves inscrits" detail={`+${d.students_week} cette semaine`} />
        <Stat value={d.active_passes} label="Pass Examen actifs" />
        <Stat value={d.month_sales} label="Ventes du mois" detail={fcfa(d.month_revenue)} />
        <Stat value={fcfa(d.month_commission)} label="Commissions du mois" href="/ventes" />
      </div>
      <div className="two">
        <div className="card">
          <h2>Questions par statut</h2>
          <table>
            <tbody>
              {Object.entries(QUESTION_STATUS).map(([status, label]) => (
                <tr key={status}>
                  <td>
                    <span className={`badge b-${status}`}>{label}</span>
                  </td>
                  <td className="num">
                    <strong>{d.questions[status as keyof typeof d.questions] ?? 0}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="stack">
          <div className="card">
            <h2>À traiter</h2>
            <div className="stack">
              <Link href="/signalements?status=nouveau">
                <strong>{d.open_reports}</strong> signalement{d.open_reports > 1 ? "s" : ""} ouvert{d.open_reports > 1 ? "s" : ""}
              </Link>
              <Link href="/contenus?status=en_validation">
                <strong>{toReview}</strong> question{toReview > 1 ? "s" : ""} à valider ou vérifier
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, detail, href }: { value: number | string; label: string; detail?: string; href?: string }) {
  const body = (
    <div className="card stat">
      <span className="value">{value}</span>
      <span className="label">{label}</span>
      {detail ? <span className="muted small">{detail}</span> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
