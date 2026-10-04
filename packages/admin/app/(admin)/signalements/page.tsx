import Link from "next/link";
import { Button, Card, Flash, inputClass, PageTitle, StatusBadge } from "@/components/ui";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/admin";
import { listReports, updateReport, type ReportStatus } from "@/lib/data/reports";
import { pool } from "@/lib/db";

const REASONS: Record<string, string> = {
  reponse_incorrecte: "Réponse incorrecte",
  explication_peu_claire: "Explication peu claire",
  probleme_image: "Problème d'image",
};

async function save(formData: FormData) {
  "use server";
  await requireAdmin();
  const back = String(formData.get("back"));
  await runAction(back, () =>
    updateReport(pool, String(formData.get("id")), {
      status: String(formData.get("status")) as ReportStatus,
      admin_note: String(formData.get("admin_note") ?? "") || null,
    }),
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ status?: ReportStatus; ok?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = sp.status ?? "nouveau";
  const reports = await listReports(pool, status);
  return (
    <>
      <PageTitle title="Qualité des questions" subtitle="Signalements envoyés par les élèves." />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="mb-4 flex gap-2">
        {(["nouveau", "en_cours", "resolu"] as const).map((s) => (
          <Link key={s} href={`?status=${s}`} className={`rounded-full px-3 py-1 ${s === status ? "ring-2 ring-bleu" : ""}`}>
            <StatusBadge status={s} />
          </Link>
        ))}
      </div>
      {reports.length === 0 && <p className="text-sm text-slate-500">Aucun signalement.</p>}
      {reports.map((r) => (
        <Card key={r.id}>
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold text-nuit">{REASONS[r.reason] ?? r.reason}</p>
            <span className="text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
          </div>
          <p className="mb-1 text-sm">
            Question : <Link href={`/questions/${r.question_id}`} className="text-bleu underline">{r.prompt.slice(0, 100)}</Link>
          </p>
          {r.comment && <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm">{r.comment}</p>}
          <form action={save} className="flex items-end gap-3">
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="back" value={`/signalements?status=${status}`} />
            <textarea name="admin_note" defaultValue={r.admin_note ?? ""} placeholder="Note de traitement" rows={1} className={inputClass} />
            <select name="status" defaultValue={r.status} className={`${inputClass} w-40`}>
              <option value="nouveau">Nouveau</option>
              <option value="en_cours">En cours</option>
              <option value="resolu">Résolu</option>
            </select>
            <Button>Enregistrer</Button>
          </form>
        </Card>
      ))}
    </>
  );
}
