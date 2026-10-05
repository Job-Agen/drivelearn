import { Button, Card, Field, Flash, inputClass, PageTitle, StatusBadge } from "@/components/ui";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/admin";
import { deleteQuestion, getQuestion, saveQuestion, setQuestionStatus, type QuestionDetail, type QuestionStatus } from "@/lib/data/questions";
import { examConformity, getProgram } from "@/lib/data/programs";
import { listUnits } from "@/lib/data/units";
import { inTransaction, pool } from "@/lib/db";

const text = (f: FormData, k: string) => String(f.get(k) ?? "");

const STATUS_ACTIONS: [QuestionStatus, string][] = [
  ["validee", "Valider"],
  ["en_validation", "Mettre en validation"],
  ["a_verifier", "Marquer à vérifier"],
  ["brouillon", "Repasser en brouillon"],
];

async function save(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = text(formData, "id") || undefined;
  const programId = text(formData, "program_id");
  const back = id ? `/questions/${id}` : `/questions/nouvelle?program=${programId}`;
  await runAction(back, async () => {
    const [unitId, lessonId] = text(formData, "placement").split(":");
    const choices = Array.from({ length: 8 }, (_, i) => ({
      id: text(formData, `choice_id_${i}`) || undefined,
      label: text(formData, `choice_${i}`),
      is_correct: formData.get(`correct_${i}`) === "on",
    }));
    const intent = text(formData, "intent");
    const savedId = await inTransaction(async (client) => {
      const qid = await saveQuestion(client, {
        id,
        unit_id: unitId,
        lesson_id: lessonId || null,
        prompt: text(formData, "prompt"),
        image_path: text(formData, "image_path") || null,
        explanation: text(formData, "explanation") || null,
        source: text(formData, "source") || null,
        choices,
      });
      if (intent === "submit") await setQuestionStatus(client, qid, "en_validation");
      return qid;
    });
    return `/questions/${savedId}`;
  });
}

async function changeStatus(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = text(formData, "id");
  await runAction(`/questions/${id}`, async () => {
    await inTransaction((client) => setQuestionStatus(client, id, text(formData, "status") as QuestionStatus));
  });
}

async function remove(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = text(formData, "id");
  const programId = text(formData, "program_id");
  await runAction(`/questions/${id}`, async () => {
    await deleteQuestion(pool, id);
    return `/questions?program=${programId}`;
  });
}

export default async function QuestionEditor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ program?: string; ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "nouvelle";
  const question: QuestionDetail | null = isNew ? null : await getQuestion(pool, id);
  const programId = question?.program_id ?? sp.program ?? "";
  const units = await listUnits(pool, programId);
  const program = programId ? await getProgram(pool, programId) : null;
  const problems = program?.status === "publie" ? (await examConformity(pool, programId)).problems : [];
  const choices = Array.from({ length: 8 }, (_, i) => question?.choices[i] ?? { id: "", label: "", is_correct: false });
  const placement = question ? `${question.unit_id}:${question.lesson_id ?? ""}` : "";
  const multiple = (question?.choices.filter((c) => c.is_correct).length ?? 0) > 1;

  return (
    <>
      <PageTitle
        title={isNew ? "Nouvelle question" : "Modifier la question"}
        actions={question && <StatusBadge status={question.status} />}
      />
      <Flash ok={sp.ok} error={sp.error} />
      {problems.length > 0 && (
        <p className="mb-4 rounded-xl bg-ambre-doux px-4 py-3 font-bold text-ambre">
          Attention : le programme publié n'est plus conforme. {problems.join(" ")}
        </p>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <Card>
            <form action={save} className="space-y-4">
              <input type="hidden" name="id" value={question?.id ?? ""} />
              <input type="hidden" name="program_id" value={programId} />
              <Field label="Leçon">
                <select name="placement" defaultValue={placement} required className={inputClass}>
                  <option value="" disabled>Choisir une leçon</option>
                  {units.map((u) => (
                    <optgroup key={u.id} label={u.title}>
                      <option value={`${u.id}:`}>{u.title} — sans leçon</option>
                      {u.lessons.map((l) => <option key={l.id} value={`${u.id}:${l.id}`}>{l.title}</option>)}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="Énoncé"><textarea name="prompt" required rows={2} defaultValue={question?.prompt ?? ""} className={inputClass} /></Field>
              <Field label="Image (chemin)" hint="L'envoi d'images arrive avec le plan 4."><input name="image_path" defaultValue={question?.image_path ?? ""} className={inputClass} /></Field>
              <div>
                <p className="mb-2 font-bold text-nuit">Réponses (cochez la ou les bonnes réponses)</p>
                {choices.map((c, i) => (
                  <div key={i} className="mb-2 flex items-center gap-3">
                    <input type="hidden" name={`choice_id_${i}`} value={c.id} />
                    <span className="grid size-6 flex-none place-items-center rounded-full bg-bleu-doux text-xs font-black text-nuit">{String.fromCharCode(65 + i)}</span>
                    <input name={`choice_${i}`} defaultValue={c.label} className={inputClass} />
                    <label className="flex shrink-0 items-center gap-1 text-sm">
                      <input type="checkbox" name={`correct_${i}`} defaultChecked={c.is_correct} /> Correcte
                    </label>
                  </div>
                ))}
              </div>
              <Field label="Explication"><textarea name="explanation" rows={2} defaultValue={question?.explanation ?? ""} className={inputClass} /></Field>
              <Field label="Source"><input name="source" defaultValue={question?.source ?? ""} placeholder="Livre du code, page…" className={inputClass} /></Field>
              <div className="flex gap-2">
                <Button variant="secondary" name="intent" value="save">Enregistrer</Button>
                <Button name="intent" value="submit">Soumettre à validation</Button>
              </div>
            </form>
          </Card>
          {question && (
            <Card title="Statut">
              <div className="flex flex-wrap gap-2">
                {STATUS_ACTIONS.map(([s, label]) => (
                  <form key={s} action={changeStatus}>
                    <input type="hidden" name="id" value={question.id} />
                    <input type="hidden" name="status" value={s} />
                    <Button variant={s === "validee" ? "primary" : "secondary"}>{label}</Button>
                  </form>
                ))}
                <form action={remove} className="ml-auto">
                  <input type="hidden" name="id" value={question.id} />
                  <input type="hidden" name="program_id" value={programId} />
                  <Button variant="danger">Supprimer</Button>
                </form>
              </div>
            </Card>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-[19px] font-extrabold text-nuit">Aperçu élève</h2>
          <div className="flex w-[340px] max-w-full flex-col gap-2.5 rounded-[34px] border-8 border-[#10223f] bg-fond px-[14px] py-[18px]">
            {question?.image_path && <p className="text-center text-xs text-gris">Image : {question.image_path}</p>}
            <p className="text-center text-[19px] font-black text-nuit">{question?.prompt ?? "L'énoncé apparaîtra ici."}</p>
            <p className="text-center text-[13px] font-semibold text-gris">{multiple ? "Plusieurs réponses possibles" : "Une seule réponse"}</p>
            {question?.choices.map((c, i) => (
              <div
                key={c.id}
                className={`flex items-center gap-3 rounded-[14px] border-2 px-3 py-2.5 font-bold text-nuit ${c.is_correct ? "border-sarcelle bg-sarcelle-doux" : "border-bord bg-white"}`}
              >
                <span className={`grid size-[30px] flex-none place-items-center rounded-full font-black ${c.is_correct ? "bg-sarcelle text-white" : "bg-bleu-doux"}`}>
                  {String.fromCharCode(65 + i)}
                </span>
                {c.label}
              </div>
            ))}
            {question?.explanation && <p className="rounded-[14px] bg-sarcelle-doux px-3 py-2.5 font-semibold text-nuit">{question.explanation}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
