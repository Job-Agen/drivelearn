import { Button, Card, Field, Flash, inputClass, PageTitle } from "@/components/ui";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/admin";
import { getSettings, updateSettings, type SettingsValues } from "@/lib/data/settings";
import { pool } from "@/lib/db";

const LABELS: Record<keyof SettingsValues, string> = {
  pass_price_xof: "Prix du Pass Examen (FCFA)",
  pass_duration_days: "Durée du Pass (jours)",
  xp_per_session: "XP par séance",
  xp_perfect_bonus: "Bonus XP sans faute",
  ready_after_consecutive_passes: "Réussites consécutives pour « Prêt pour l'examen »",
  max_review_per_lesson: "Erreurs réinjectées par leçon",
};
const KEYS = Object.keys(LABELS) as (keyof SettingsValues)[];

async function save(formData: FormData) {
  "use server";
  await requireAdmin();
  await runAction("/reglages", () =>
    updateSettings(pool, Object.fromEntries(KEYS.map((k) => [k, Number(formData.get(k))])) as SettingsValues),
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const [settings, flash] = await Promise.all([getSettings(pool), searchParams]);
  return (
    <>
      <PageTitle title="Réglages" subtitle="Valeurs communes à tous les programmes." />
      <Flash {...flash} />
      <Card>
        <form action={save} className="grid max-w-2xl grid-cols-2 gap-4">
          {KEYS.map((k) => (
            <Field key={k} label={LABELS[k]}><input name={k} type="number" defaultValue={settings[k]} className={inputClass} /></Field>
          ))}
          <div className="col-span-2"><Button>Enregistrer</Button></div>
        </form>
      </Card>
    </>
  );
}
