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
        <div className="mb-2 hidden grid-cols-8 gap-2 px-1 text-xs font-extrabold tracking-wide text-gris uppercase lg:grid">
          <span>Nom</span><span>Code</span><span>Réduction %</span><span>Commission %</span><span>Active</span><span>Élèves</span><span>Ventes</span><span />
        </div>
        {schools.map((s) => (
          <form key={s.id} action={update} className="mb-2 grid grid-cols-2 items-center gap-2 border-t border-bord pt-3 text-sm lg:grid-cols-8 lg:pt-2">
            <input type="hidden" name="id" value={s.id} />
            <Cell label="Nom" wide className="lg:order-1"><input name="name" defaultValue={s.name} className={inputClass} /></Cell>
            <Cell label="Code promo" className="lg:order-2"><span className="font-mono">{s.promo_code}</span></Cell>
            <Cell label="Active" className="lg:order-5"><input name="active" type="checkbox" defaultChecked={s.active} /></Cell>
            <Cell label="Réduction %" className="lg:order-3"><input name="discount_percent" type="number" min={0} max={100} defaultValue={s.discount_percent} className={inputClass} /></Cell>
            <Cell label="Commission %" className="lg:order-4"><input name="commission_percent" type="number" min={0} max={100} defaultValue={s.commission_percent} className={inputClass} /></Cell>
            <Cell label="Élèves" className="lg:order-6"><span>{s.students}</span></Cell>
            <Cell label="Ventes" className="lg:order-7"><span>{s.confirmed_sales}</span></Cell>
            <div className="col-span-2 lg:order-8 lg:col-span-1"><Button variant="secondary">Enregistrer</Button></div>
          </form>
        ))}
        {schools.length === 0 && <p className="text-sm text-gris">Aucune auto-école pour l'instant.</p>}
      </Card>
      <Card title="Nouvelle auto-école">
        <form action={create} className="grid grid-cols-2 items-end gap-3 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-1"><Field label="Nom"><input name="name" required className={inputClass} /></Field></div>
          <Field label="Code promo"><input name="promo_code" required placeholder="VOLANT" className={inputClass} /></Field>
          <Field label="Réduction %"><input name="discount_percent" type="number" min={0} max={100} defaultValue={10} className={inputClass} /></Field>
          <Field label="Commission %"><input name="commission_percent" type="number" min={0} max={100} defaultValue={10} className={inputClass} /></Field>
          <Button>Créer</Button>
        </form>
      </Card>
    </>
  );
}

/** Case d'une ligne d'auto-école : libellé visible seulement sur téléphone (l'en-tête du tableau le donne ailleurs). */
function Cell({ label, wide, className = "", children }: { label: string; wide?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 ${wide ? "col-span-2 lg:col-span-1" : ""} ${className}`}>
      <span className="text-xs font-extrabold text-gris lg:hidden">{label}</span>
      {children}
    </label>
  );
}
