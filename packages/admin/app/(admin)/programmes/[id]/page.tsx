import Link from "next/link";
import { Button, Card, Field, Flash, inputClass, PageTitle, StatusBadge, buttonClass } from "@/components/ui";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/admin";
import { examConformity, getProgram } from "@/lib/data/programs";
import { createLesson, createUnit, deleteLesson, deleteUnit, listUnits, moveItem, renameUnit, updateLesson } from "@/lib/data/units";
import { pool } from "@/lib/db";

const text = (f: FormData, k: string) => String(f.get(k) ?? "");

async function unitAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const programId = text(formData, "program_id");
  await runAction(`/programmes/${programId}`, async () => {
    const op = text(formData, "op");
    const unitId = text(formData, "unit_id");
    if (op === "create") await createUnit(pool, programId, text(formData, "title"));
    if (op === "rename") await renameUnit(pool, unitId, text(formData, "title"));
    if (op === "delete") await deleteUnit(pool, unitId);
    if (op === "up" || op === "down") await moveItem(pool, "unit", unitId, op);
    if (op === "add_lesson") await createLesson(pool, unitId, text(formData, "title"));
  });
}

async function lessonAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const programId = text(formData, "program_id");
  await runAction(`/programmes/${programId}`, async () => {
    const op = text(formData, "op");
    const lessonId = text(formData, "lesson_id");
    if (op === "save")
      await updateLesson(pool, lessonId, {
        title: text(formData, "title"),
        intro_title: text(formData, "intro_title") || null,
        intro_text: text(formData, "intro_text") || null,
        intro_image_path: text(formData, "intro_image_path") || null,
        mentor_tip: text(formData, "mentor_tip") || null,
      });
    if (op === "delete") await deleteLesson(pool, lessonId);
    if (op === "up" || op === "down") await moveItem(pool, "lesson", lessonId, op);
  });
}

export default async function ProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [program, units, flash, conformity] = await Promise.all([
    getProgram(pool, id),
    listUnits(pool, id),
    searchParams,
    examConformity(pool, id),
  ]);
  return (
    <>
      <PageTitle
        title={program.name}
        subtitle={`${program.country_code} · ${program.license_type}`}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={program.status} />
            <Link href={`/programmes/${id}/examen`} className={buttonClass("secondary")}>Examen et publication</Link>
            <Link href={`/questions?program=${id}`} className={buttonClass()}>Questions</Link>
          </div>
        }
      />
      <Flash {...flash} />
      {program.status === "publie" && conformity.problems.length > 0 && (
        <p className="mb-4 rounded-xl bg-ambre-doux font-bold px-4 py-3 text-sm text-ambre">
          Attention : ce programme publié n'est plus conforme. {conformity.problems.join(" ")}
        </p>
      )}
      {units.map((unit) => (
        <Card key={unit.id}>
          <form action={unitAction} className="mb-4 flex items-end gap-2">
            <input type="hidden" name="program_id" value={id} />
            <input type="hidden" name="unit_id" value={unit.id} />
            <Field label={`Unité ${unit.position}`}><input name="title" defaultValue={unit.title} className={inputClass} /></Field>
            <Button variant="secondary" name="op" value="rename">Renommer</Button>
            <Button variant="secondary" name="op" value="up">↑</Button>
            <Button variant="secondary" name="op" value="down">↓</Button>
            <Button variant="danger" name="op" value="delete">Supprimer</Button>
          </form>
          {unit.lessons.map((lesson) => (
            <form key={lesson.id} action={lessonAction} className="mb-3 grid grid-cols-2 gap-3 rounded-xl border border-bord p-4">
              <input type="hidden" name="program_id" value={id} />
              <input type="hidden" name="lesson_id" value={lesson.id} />
              <Field label={`Leçon ${lesson.position}`}><input name="title" defaultValue={lesson.title} className={inputClass} /></Field>
              <Field label="Titre de l'écran d'explication"><input name="intro_title" defaultValue={lesson.intro_title ?? ""} className={inputClass} /></Field>
              <Field label="Texte d'explication"><textarea name="intro_text" rows={3} defaultValue={lesson.intro_text ?? ""} className={inputClass} /></Field>
              <div className="space-y-3">
                <Field label="Conseil du mentor"><input name="mentor_tip" defaultValue={lesson.mentor_tip ?? ""} className={inputClass} /></Field>
                <Field label="Image (chemin)"><input name="intro_image_path" defaultValue={lesson.intro_image_path ?? ""} className={inputClass} /></Field>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Button name="op" value="save">Enregistrer</Button>
                <Button variant="secondary" name="op" value="up">↑</Button>
                <Button variant="secondary" name="op" value="down">↓</Button>
                <Button variant="danger" name="op" value="delete">Supprimer</Button>
                <span className="ml-auto text-xs text-gris">
                  {Object.entries(lesson.counts).map(([s, n]) => `${n} ${s}`).join(" · ") || "aucune question"}
                </span>
              </div>
            </form>
          ))}
          <form action={unitAction} className="flex items-end gap-2">
            <input type="hidden" name="program_id" value={id} />
            <input type="hidden" name="unit_id" value={unit.id} />
            <Field label="Nouvelle leçon"><input name="title" required className={inputClass} /></Field>
            <Button variant="secondary" name="op" value="add_lesson">Ajouter la leçon</Button>
          </form>
        </Card>
      ))}
      <Card title="Nouvelle unité">
        <form action={unitAction} className="flex items-end gap-2">
          <input type="hidden" name="program_id" value={id} />
          <Field label="Titre"><input name="title" required placeholder="Signalisation" className={inputClass} /></Field>
          <Button name="op" value="create">Ajouter l'unité</Button>
        </form>
      </Card>
    </>
  );
}
