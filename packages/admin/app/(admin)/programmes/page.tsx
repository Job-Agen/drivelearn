import Link from "next/link";
import { Badge, Flash, PROGRAM_STATUS } from "@/components/ui";
import { pool } from "@/lib/db";
import { listPrograms } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { createProgramAction } from "../actions";

/** Écran 29 — Programmes par pays et permis. */
export default async function ProgramsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const programs = await listPrograms(pool);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Programmes et examens</h1>
          <p className="muted">Un programme = un pays et un type de permis, avec ses propres règles d'examen.</p>
        </div>
      </div>
      <Flash searchParams={searchParams} />
      <table>
        <thead>
          <tr>
            <th>Programme</th>
            <th>Statut</th>
            <th className="num">Leçons</th>
            <th className="num">Questions validées</th>
            <th className="num">Examen</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {programs.map((p) => (
            <tr key={p.id}>
              <td>
                <strong>{p.name}</strong>
                <div className="muted small">
                  {p.country_code} · permis {p.license_type}
                </div>
              </td>
              <td>
                <Badge status={p.status} labels={PROGRAM_STATUS} />
              </td>
              <td className="num">{p.lessons}</td>
              <td className="num">
                {p.validated} / {p.questions}
              </td>
              <td className="num">{p.exam_question_count} questions</td>
              <td className="num">
                <Link className="btn secondary small" href={`/programmes/${p.id}`}>
                  Gérer
                </Link>{" "}
                <Link className="btn secondary small" href={`/contenus?program=${p.id}`}>
                  Contenus
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form action={createProgramAction} className="card row" style={{ alignItems: "flex-end" }}>
        <label className="field">
          Code pays
          <input name="country" placeholder="BJ" maxLength={2} size={4} required />
        </label>
        <label className="field">
          Nom
          <input name="name" placeholder="Bénin" required />
        </label>
        <label className="field">
          Permis
          <select name="license" defaultValue="B">
            <option value="B">Voiture (B)</option>
          </select>
        </label>
        <button className="btn">Ajouter un programme</button>
      </form>
    </div>
  );
}
