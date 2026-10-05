import Link from "next/link";
import { Button, Card, Field, Flash, inputClass, PageTitle, StatusBadge, tableClass } from "@/components/ui";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/admin";
import { createProgram, listPrograms } from "@/lib/data/programs";
import { pool } from "@/lib/db";

async function create(formData: FormData) {
  "use server";
  await requireAdmin();
  await runAction("/programmes", async () => {
    const id = await createProgram(pool, {
      country_code: String(formData.get("country_code")),
      license_type: String(formData.get("license_type")),
      name: String(formData.get("name")),
    });
    return `/programmes/${id}`;
  });
}

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const flash = await searchParams;
  const programs = await listPrograms(pool);
  return (
    <>
      <PageTitle title="Programmes pédagogiques" subtitle="Les programmes de code par pays et par permis." />
      <Flash {...flash} />
      <Card>
        <table className={tableClass}>
          <thead>
            <tr><th>Pays</th><th>Permis</th><th>Nom</th><th>État</th><th>Leçons</th><th>Questions validées</th><th>En attente</th><th /></tr>
          </thead>
          <tbody>
            {programs.map((p) => (
              <tr key={p.id}>
                <td>{p.country_code}</td>
                <td>{p.license_type}</td>
                <td>{p.name}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>{p.lessons}</td>
                <td>{p.validated_questions}</td>
                <td>{p.pending_questions}</td>
                <td><Link className="font-bold text-bleu hover:underline" href={`/programmes/${p.id}`}>Ouvrir</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Nouveau programme">
        <form action={create} className="grid grid-cols-4 items-end gap-3">
          <Field label="Code pays"><input name="country_code" required maxLength={2} placeholder="TG" className={inputClass} /></Field>
          <Field label="Permis"><input name="license_type" required defaultValue="voiture" className={inputClass} /></Field>
          <Field label="Nom"><input name="name" required placeholder="Togo — Permis voiture" className={inputClass} /></Field>
          <Button>Créer</Button>
        </form>
      </Card>
    </>
  );
}
