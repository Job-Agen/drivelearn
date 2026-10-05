import { Button, Card, Field, Flash, inputClass, PageTitle } from "@/components/ui";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/admin";
import { createSchool, listSchools, updateSchool } from "@/lib/data/schools";
import { pool } from "@/lib/db";

async function create(formData: FormData) {
  "use server";
  await requireAdmin();
  await runAction("/auto-ecoles", async () => {
    await createSchool(pool, {
      name: String(formData.get("name")),
      promo_code: String(formData.get("promo_code")),
      discount_percent: Number(formData.get("discount_percent")),
      commission_percent: Number(formData.get("commission_percent")),
    });
  });
}

async function update(formData: FormData) {
  "use server";
  await requireAdmin();
  await runAction("/auto-ecoles", () =>
    updateSchool(pool, String(formData.get("id")), {
      name: String(formData.get("name")),
      discount_percent: Number(formData.get("discount_percent")),
      commission_percent: Number(formData.get("commission_percent")),
      active: formData.get("active") === "on",
    }),
  );
}

export default async function SchoolsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const [schools, flash] = await Promise.all([listSchools(pool), searchParams]);
  return (
    <>
      <PageTitle title="Auto-écoles partenaires" subtitle="Codes promo, réductions et commissions." />
      <Flash {...flash} />
      <Card>
        <div className="mb-2 grid grid-cols-8 gap-2 px-1 text-xs font-extrabold uppercase tracking-wide text-gris">
          <span>Nom</span><span>Code</span><span>Réduction %</span><span>Commission %</span><span>Active</span><span>Élèves</span><span>Ventes</span><span />
        </div>
        {schools.map((s) => (
          <form key={s.id} action={update} className="mb-2 grid grid-cols-8 items-center gap-2 border-t border-bord pt-2 text-sm">
            <input type="hidden" name="id" value={s.id} />
            <input name="name" defaultValue={s.name} className={inputClass} />
            <span className="font-mono">{s.promo_code}</span>
            <input name="discount_percent" type="number" min={0} max={100} defaultValue={s.discount_percent} className={inputClass} />
            <input name="commission_percent" type="number" min={0} max={100} defaultValue={s.commission_percent} className={inputClass} />
            <input name="active" type="checkbox" defaultChecked={s.active} />
            <span>{s.students}</span>
            <span>{s.confirmed_sales}</span>
            <Button variant="secondary">Enregistrer</Button>
          </form>
        ))}
        {schools.length === 0 && <p className="text-sm text-gris">Aucune auto-école pour l'instant.</p>}
      </Card>
      <Card title="Nouvelle auto-école">
        <form action={create} className="grid grid-cols-5 items-end gap-3">
          <Field label="Nom"><input name="name" required className={inputClass} /></Field>
          <Field label="Code promo"><input name="promo_code" required placeholder="VOLANT" className={inputClass} /></Field>
          <Field label="Réduction %"><input name="discount_percent" type="number" min={0} max={100} defaultValue={10} className={inputClass} /></Field>
          <Field label="Commission %"><input name="commission_percent" type="number" min={0} max={100} defaultValue={10} className={inputClass} /></Field>
          <Button>Créer</Button>
        </form>
      </Card>
    </>
  );
}
