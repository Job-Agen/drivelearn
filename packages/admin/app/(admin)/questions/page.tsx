import Link from "next/link";
import { Card, Flash, inputClass, PageTitle, StatusBadge, tableClass, buttonClass } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { listPrograms } from "@/lib/data/programs";
import { listQuestions, type QuestionStatus } from "@/lib/data/questions";
import { listUnits } from "@/lib/data/units";
import { pool } from "@/lib/db";

const STATUSES: [QuestionStatus, string][] = [
  ["brouillon", "Brouillon"],
  ["a_verifier", "À vérifier"],
  ["en_validation", "En validation"],
  ["validee", "Validée"],
];

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; unit?: string; status?: QuestionStatus; q?: string; page?: string; ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const programs = await listPrograms(pool);
  const programId = sp.program ?? programs[0]?.id;
  if (!programId) {
    return <PageTitle title="Contenus" subtitle="Créez d'abord un programme." />;
  }
  const page = Math.max(1, Number(sp.page ?? 1));
  const [units, list] = await Promise.all([
    listUnits(pool, programId),
    listQuestions(pool, { programId, unitId: sp.unit || undefined, status: sp.status || undefined, search: sp.q, limit: 50, offset: (page - 1) * 50 }),
  ]);
  const pageLink = (n: number) => `?program=${programId}&unit=${sp.unit ?? ""}&status=${sp.status ?? ""}&q=${encodeURIComponent(sp.q ?? "")}&page=${n}`;
  return (
    <>
      <PageTitle
        title="Contenus"
        subtitle={`${list.total} question(s)`}
        actions={<Link href={`/questions/nouvelle?program=${programId}`} className={buttonClass()}>Nouvelle question</Link>}
      />
      <Flash ok={sp.ok} error={sp.error} />
      <form className="mb-4 grid grid-cols-5 gap-3">
        <select name="program" defaultValue={programId} className={inputClass}>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="unit" defaultValue={sp.unit ?? ""} className={inputClass}>
          <option value="">Toutes les unités</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className={inputClass}>
          <option value="">Tous les statuts</option>
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Rechercher dans l'énoncé" className={inputClass} />
        <button className={buttonClass("secondary")}>Filtrer</button>
      </form>
      <Card>
        <table className={tableClass}>
          <thead><tr><th>Énoncé</th><th>Unité</th><th>Leçon</th><th>Statut</th><th>Signalements</th></tr></thead>
          <tbody>
            {list.rows.map((q) => (
              <tr key={q.id}>
                <td><Link href={`/questions/${q.id}`} className="font-bold text-bleu hover:underline">{q.prompt.slice(0, 90)}</Link></td>
                <td>{q.unit_title}</td>
                <td>{q.lesson_title ?? "—"}</td>
                <td><StatusBadge status={q.status} /></td>
                <td>{q.open_reports || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex gap-3 text-sm">
          {page > 1 && <Link className="font-bold text-bleu hover:underline" href={pageLink(page - 1)}>Précédent</Link>}
          {page * 50 < list.total && <Link className="font-bold text-bleu hover:underline" href={pageLink(page + 1)}>Suivant</Link>}
        </div>
      </Card>
    </>
  );
}
