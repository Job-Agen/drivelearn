import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Flash, PROGRAM_STATUS } from "@/components/ui";
import { pool } from "@/lib/db";
import { examChecks, getProgram } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { examSettingsAction, programStatusAction } from "../../actions";

/** Écran 31 — Paramètres d'examen, répartition par thème et contrôles de conformité. */
export default async function ProgramPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { id } = await props.params;
  const p = await getProgram(pool, id);
  if (!p) notFound();
  const checks = examChecks(
    { count: p.exam_question_count, passMark: p.exam_pass_mark, seconds: p.exam_seconds_per_question, distribution: p.exam_distribution },
    p.units,
  );
  const minutes = Math.round((p.exam_question_count * p.exam_seconds_per_question) / 60);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <Link href="/programmes" className="small">
            ← Programmes
          </Link>
          <h1>
            {p.name} <Badge status={p.status} labels={PROGRAM_STATUS} />
          </h1>
          <p className="muted">
            {p.country_code} · permis {p.license_type}
          </p>
        </div>
        <div className="row">
          <Link className="btn secondary" href={`/contenus?program=${p.id}`}>
            Contenus
          </Link>
          {p.status === "publie" ? (
            <form action={programStatusAction}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="status" value="en_validation" />
              <button className="btn danger">Retirer de la publication</button>
            </form>
          ) : (
            <form action={programStatusAction}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="status" value="publie" />
              <button className="btn" disabled={!checks.ok}>
                Publier
              </button>
            </form>
          )}
        </div>
      </div>
      <Flash searchParams={props.searchParams} />
      {checks.ok ? (
        <div className="alert ok">Conforme : la banque de questions validées permet de composer un examen.</div>
      ) : (
        <div className="alert warn">
          À corriger avant publication :
          <ul style={{ margin: "6px 0 0" }}>
            {checks.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}
      <form action={examSettingsAction} className="two">
        <input type="hidden" name="id" value={p.id} />
        <div className="card stack">
          <h2>Format de l'examen</h2>
          <label className="field">
            Nombre de questions
            <input name="count" type="number" min={1} max={100} defaultValue={p.exam_question_count} />
          </label>
          <label className="field">
            Seuil de réussite (bonnes réponses)
            <input name="passMark" type="number" min={1} max={100} defaultValue={p.exam_pass_mark} />
          </label>
          <label className="field">
            Temps par question (secondes)
            <input name="seconds" type="number" min={5} max={600} defaultValue={p.exam_seconds_per_question} />
          </label>
          <p className="muted small">
            Actuellement : {p.exam_question_count} questions, admis à {p.exam_pass_mark}, environ {minutes} min. Notation tout ou
            rien, pas de retour en arrière.
          </p>
        </div>
        <div className="card stack">
          <h2>Répartition par thème</h2>
          <p className="muted small">Nombre minimal de questions tirées dans chaque unité ; le reste est tiré au hasard.</p>
          <table>
            <thead>
              <tr>
                <th>Unité</th>
                <th className="num">Validées</th>
                <th className="num">Dans l'examen</th>
              </tr>
            </thead>
            <tbody>
              {p.units.map((u) => (
                <tr key={u.id}>
                  <td>{u.title}</td>
                  <td className="num">
                    {u.validated} / {u.total}
                  </td>
                  <td className="num">
                    <input name={`dist_${u.id}`} type="number" min={0} max={100} defaultValue={p.exam_distribution[u.id] ?? 0} style={{ width: 80 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn" style={{ alignSelf: "flex-start" }}>
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
