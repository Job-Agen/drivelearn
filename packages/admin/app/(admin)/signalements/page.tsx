import Link from "next/link";
import { Badge, Flash, QUESTION_STATUS, REPORT_REASON, REPORT_STATUS, date, one } from "@/components/ui";
import { pool } from "@/lib/db";
import { listReports } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { reportAction } from "../actions";

/** Écran 32 — Signalements des élèves : nouveau → en cours → résolu. */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const status = one((await searchParams).status);
  const reports = await listReports(pool, status);
  const from = `/signalements${status ? `?status=${status}` : ""}`;
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Signalements</h1>
          <p className="muted">Questions signalées par les élèves depuis la correction.</p>
        </div>
      </div>
      <div className="tabs">
        <Link href="/signalements" className={!status ? "on" : undefined}>
          Tous
        </Link>
        {Object.entries(REPORT_STATUS).map(([s, label]) => (
          <Link key={s} href={`/signalements?status=${s}`} className={status === s ? "on" : undefined}>
            {label}
          </Link>
        ))}
      </div>
      <Flash searchParams={searchParams} />
      {reports.length === 0 ? <p className="muted">Aucun signalement.</p> : null}
      {reports.map((r) => (
        <form key={r.id} action={reportAction} className="card stack" style={{ gap: 10 }}>
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="from" value={from} />
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="row">
              <strong>{REPORT_REASON[r.reason]}</strong>
              <Badge status={r.status} labels={REPORT_STATUS} />
              <span className="muted small">{date(r.created_at, true)}</span>
            </div>
            <Link href={`/contenus/questions/${r.question_id}`} className="btn secondary small">
              Ouvrir la question
            </Link>
          </div>
          <div>
            <span className="muted small">{r.unit_title} · </span>
            <strong>{r.prompt}</strong> <Badge status={r.question_status} labels={QUESTION_STATUS} />
          </div>
          {r.comment ? <p>« {r.comment} »</p> : <p className="muted small">Sans commentaire.</p>}
          <div className="row">
            <select name="status" defaultValue={r.status} aria-label="Statut">
              {Object.entries(REPORT_STATUS).map(([s, label]) => (
                <option key={s} value={s}>
                  {label}
                </option>
              ))}
            </select>
            <input name="note" defaultValue={r.admin_note ?? ""} placeholder="Note de traitement" style={{ flex: 1, minWidth: 200 }} />
            <button className="btn small">Enregistrer</button>
          </div>
        </form>
      ))}
    </div>
  );
}
