import { Button, Card, Field, Flash, inputClass, PageTitle, StatusBadge } from "@/components/ui";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/admin";
import { examConformity, getProgram, setProgramStatus, updateExamSettings, type ProgramRow } from "@/lib/data/programs";
import { listUnits } from "@/lib/data/units";
import { pool } from "@/lib/db";

const STATUS_ACTIONS: [ProgramRow["status"], string][] = [
  ["publie", "Publier"],
  ["en_validation", "Mettre en validation"],
  ["brouillon", "Repasser en brouillon"],
];

async function saveSettings(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("program_id"));
  await runAction(`/programmes/${id}/examen`, async () => {
    const distribution: Record<string, number> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("unit_") && String(value).trim() !== "") distribution[key.slice(5)] = Number(value);
    }
    await updateExamSettings(pool, id, {
      exam_question_count: Number(formData.get("exam_question_count")),
      exam_pass_mark: Number(formData.get("exam_pass_mark")),
      exam_seconds_per_question: Number(formData.get("exam_seconds_per_question")),
      exam_distribution: distribution,
    });
  });
}

async function changeStatus(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("program_id"));
  await runAction(`/programmes/${id}/examen`, () => setProgramStatus(pool, id, String(formData.get("status")) as ProgramRow["status"]));
}

export default async function ExamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [program, units, conformity, flash] = await Promise.all([getProgram(pool, id), listUnits(pool, id), examConformity(pool, id), searchParams]);
  return (
    <>
      <PageTitle title="Configurer l'examen blanc" subtitle={program.name} actions={<StatusBadge status={program.status} />} />
      <Flash {...flash} />
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card title="Paramètres généraux">
            <form action={saveSettings} className="space-y-4">
              <input type="hidden" name="program_id" value={id} />
              <div className="grid grid-cols-3 gap-3">
                <Field label="Nombre de questions"><input name="exam_question_count" type="number" min={1} max={100} defaultValue={program.exam_question_count} className={inputClass} /></Field>
                <Field label="Seuil de réussite"><input name="exam_pass_mark" type="number" min={1} defaultValue={program.exam_pass_mark} className={inputClass} /></Field>
                <Field label="Secondes par question"><input name="exam_seconds_per_question" type="number" min={5} max={600} defaultValue={program.exam_seconds_per_question} className={inputClass} /></Field>
              </div>
              <p className="text-sm font-medium text-slate-700">Répartition par thème (vide = tirage libre sur tout le programme)</p>
              {units.map((u) => (
                <Field key={u.id} label={u.title}>
                  <input name={`unit_${u.id}`} type="number" min={0} max={100} defaultValue={program.exam_distribution[u.id] ?? ""} className={inputClass} />
                </Field>
              ))}
              <Button>Enregistrer</Button>
            </form>
          </Card>
        </div>
        <div>
          <Card title="Validation et conformité">
            <p className="mb-2 text-sm">{conformity.validated_total} question(s) validée(s) dans le programme.</p>
            {conformity.problems.length === 0 ? (
              <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">L'examen est conforme.</p>
            ) : (
              <ul className="list-disc space-y-1 rounded-lg bg-amber-50 p-3 pl-6 text-sm text-amber-800">
                {conformity.problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            )}
          </Card>
          <Card title="Publication">
            <div className="flex flex-col gap-2">
              {STATUS_ACTIONS.map(([s, label]) => (
                <form key={s} action={changeStatus}>
                  <input type="hidden" name="program_id" value={id} />
                  <input type="hidden" name="status" value={s} />
                  <Button variant={s === "publie" ? "primary" : "secondary"}>{label}</Button>
                </form>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
