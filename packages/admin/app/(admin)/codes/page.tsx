import Link from "next/link";
import { Button, Card, Field, Flash, inputClass, linkClass, PageTitle, tableClass } from "@/components/ui";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/admin";
import { createBatch, listBatches } from "@/lib/data/pass-codes";
import { listSchools } from "@/lib/data/schools";
import { getSettings } from "@/lib/data/settings";
import { pool } from "@/lib/db";

async function create(formData: FormData) {
  "use server";
  await requireAdmin();
  await runAction("/codes", async () => {
    await createBatch(pool, {
      label: String(formData.get("label") ?? ""),
      driving_school_id: String(formData.get("school") ?? "") || null,
      count: Number(formData.get("count")),
      duration_days: Number(formData.get("duration_days")),
    });
  });
}

export default async function CodesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const [batches, schools, settings, flash] = await Promise.all([listBatches(pool), listSchools(pool), getSettings(pool), searchParams]);
  return (
    <>
      <PageTitle
        title="Codes Pass Examen"
        subtitle="Le Pass se vend hors de l'application : chaque code, saisi une seule fois dans l'app, active un Pass."
      />
      <Flash {...flash} />
      <Card>
        <table className={tableClass}>
          <thead>
            <tr><th>Lot</th><th>Auto-école</th><th>Durée</th><th>Créé le</th><th>Utilisés</th><th /></tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td className="font-bold">{b.label}</td>
                <td>{b.school_name ?? "—"}</td>
                <td>{b.duration_days} jours</td>
                <td>{new Date(b.created_at).toLocaleDateString("fr-FR", { timeZone: "Africa/Lome" })}</td>
                <td>{b.redeemed} / {b.total}</td>
                <td><Link className={linkClass} href={`/codes/${b.id}/export`}>Télécharger (CSV)</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
        {batches.length === 0 && <p className="mt-3 text-gris">Aucun code pour l'instant.</p>}
      </Card>
      <Card title="Nouveau lot de codes">
        <form action={create} className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] items-end gap-3">
          <Field label="Nom du lot"><input name="label" required placeholder="Auto-école Le Volant – novembre" className={inputClass} /></Field>
          <Field label="Auto-école (facultatif)">
            <select name="school" defaultValue="" className={inputClass}>
              <option value="">Aucune (vente directe)</option>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Nombre de codes"><input name="count" type="number" min={1} max={1000} defaultValue={20} className={inputClass} /></Field>
          <Field label="Durée (jours)"><input name="duration_days" type="number" min={1} max={730} defaultValue={settings.pass_duration_days} className={inputClass} /></Field>
          <Button>Créer</Button>
        </form>
      </Card>
    </>
  );
}
