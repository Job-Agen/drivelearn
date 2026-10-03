import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Flash, QUESTION_STATUS, REPORT_REASON, REPORT_STATUS, date, one } from "@/components/ui";
import { pool } from "@/lib/db";
import { imageUrl } from "@/lib/images";
import { contentTree, getQuestion } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { deleteQuestionAction, questionStatusAction, reportAction, saveQuestionAction } from "../../../actions";

const LETTERS = "ABCDEFGH";

/** Éditeur de question avec aperçu élève et circuit de validation. */
export default async function QuestionPage(props: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const isNew = id === "nouvelle";
  const q = isNew ? null : await getQuestion(pool, id);
  if (!isNew && !q) notFound();
  const programId = q?.program_id ?? one(sp.program);
  if (!programId) notFound();
  const tree = await contentTree(pool, programId);
  const placement = q ? `${q.unit_id}|${q.lesson_id ?? ""}` : (() => {
    const lessonId = one(sp.lesson);
    const unit = tree.find((u) => u.lessons.some((l) => l.id === lessonId)) ?? tree[0];
    return unit ? `${unit.id}|${lessonId ?? unit.lessons[0]?.id ?? ""}` : "";
  })();
  const choices = Array.from({ length: 8 }, (_, i) => q?.choices[i] ?? null);
  const correct = q?.choices.filter((c) => c.is_correct).length ?? 0;
  const img = imageUrl(q?.image_path);
  const status = q?.status as string | undefined;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <Link className="small" href={`/contenus?program=${programId}${q?.lesson_id ? `&lesson=${q.lesson_id}` : ""}`}>
            ← Contenus
          </Link>
          <h1>
            {isNew ? "Nouvelle question" : "Question"} {status ? <Badge status={status} labels={QUESTION_STATUS} /> : null}
          </h1>
          {q ? (
            <p className="muted small">
              Modifiée le {date(q.updated_at, true)}
              {q.source ? ` · source : ${q.source}` : ""}
            </p>
          ) : null}
        </div>
        {q ? (
          <div className="row">
            {status === "brouillon" || status === "a_verifier" ? (
              <StatusButton id={q.id} status="en_validation" label="Soumettre à validation" />
            ) : null}
            {status === "en_validation" ? <StatusButton id={q.id} status="validee" label="Valider" /> : null}
            {status === "en_validation" ? <StatusButton id={q.id} status="brouillon" label="Renvoyer en brouillon" secondary /> : null}
            {status === "validee" ? <StatusButton id={q.id} status="brouillon" label="Retirer (brouillon)" secondary /> : null}
            {status === "brouillon" ? <StatusButton id={q.id} status="a_verifier" label="Marquer à vérifier" secondary /> : null}
          </div>
        ) : null}
      </div>
      <Flash searchParams={props.searchParams} />
      {status === "validee" ? (
        <div className="alert warn">Cette question est servie aux élèves. Toute modification la renverra en validation.</div>
      ) : null}

      <div className="two">
        <form action={saveQuestionAction} className="card stack">
          <input type="hidden" name="id" value={q?.id ?? ""} />
          <label className="field">
            Leçon
            <select name="placement" defaultValue={placement} required>
              {tree.map((u) => (
                <optgroup key={u.id} label={u.title}>
                  {u.lessons.map((l) => (
                    <option key={l.id} value={`${u.id}|${l.id}`}>
                      {l.title}
                    </option>
                  ))}
                  <option value={`${u.id}|`}>{u.title} · sans leçon</option>
                </optgroup>
              ))}
            </select>
          </label>
          <label className="field">
            Énoncé
            <textarea name="prompt" defaultValue={q?.prompt ?? ""} required />
          </label>
          <label className="field">
            Image (chemin dans le stockage)
            <input name="imagePath" defaultValue={q?.image_path ?? ""} placeholder="ex. panneau-stop.png" />
          </label>
          <div className="stack" style={{ gap: 8 }}>
            <strong style={{ color: "var(--navy)" }}>Choix (2 à 8) — cocher la ou les bonnes réponses</strong>
            {choices.map((c, i) => (
              <div key={i} className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                <span className="badge b-en_validation">{LETTERS[i]}</span>
                <input type="hidden" name={`choice_id_${i}`} value={c?.id ?? ""} />
                <input name={`label_${i}`} defaultValue={c?.label ?? ""} placeholder={i < 2 ? "Choix" : "Choix facultatif"} style={{ flex: 1 }} />
                <label className="row small" style={{ gap: 4, flexWrap: "nowrap" }}>
                  <input type="checkbox" name={`correct_${i}`} defaultChecked={c?.is_correct ?? false} /> Bonne
                </label>
              </div>
            ))}
            <p className="muted small">Pour retirer un choix, vide son texte. Notation tout ou rien : il faut cocher exactement les bonnes réponses.</p>
          </div>
          <label className="field">
            Explication (affichée après la réponse)
            <textarea name="explanation" defaultValue={q?.explanation ?? ""} />
          </label>
          <label className="field">
            Source
            <input name="source" defaultValue={q?.source ?? ""} placeholder="Livre du code, p. 12" />
          </label>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button className="btn">Enregistrer</button>
          </div>
        </form>

        <div className="stack">
          <h3>Aperçu élève</h3>
          {q ? (
            <div className="phone">
              <div className="hint">{q.lesson_title ?? q.unit_title}</div>
              {img ? <img src={img} alt="" /> : null}
              <div className="prompt">{q.prompt}</div>
              <div className="hint">{correct > 1 ? "Plusieurs réponses possibles" : "Une seule réponse"}</div>
              {q.choices.map((c, i) => (
                <div key={c.id} className={`choice${c.is_correct ? " ok" : ""}`}>
                  <span className="letter">{LETTERS[i]}</span>
                  {c.label}
                </div>
              ))}
              {q.explanation ? <div className="bubble">🧑🏾‍🏫 {q.explanation}</div> : null}
            </div>
          ) : (
            <p className="muted">L'aperçu apparaît après le premier enregistrement.</p>
          )}
          {q ? (
            <form action={deleteQuestionAction}>
              <input type="hidden" name="id" value={q.id} />
              <input type="hidden" name="program" value={programId} />
              <button className="btn danger small">Supprimer la question</button>
            </form>
          ) : null}
        </div>
      </div>

      {q && q.reports.length > 0 ? (
        <div className="stack">
          <h2>Signalements</h2>
          {q.reports.map((r) => (
            <form key={r.id} action={reportAction} className="card row" style={{ alignItems: "flex-end" }}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="from" value={`/contenus/questions/${q.id}`} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <strong>{REPORT_REASON[r.reason]}</strong> <Badge status={r.status} labels={REPORT_STATUS} />
                <p className="muted small">
                  {date(r.created_at, true)}
                  {r.comment ? ` · « ${r.comment} »` : ""}
                </p>
              </div>
              <select name="status" defaultValue={r.status}>
                {Object.entries(REPORT_STATUS).map(([s, label]) => (
                  <option key={s} value={s}>
                    {label}
                  </option>
                ))}
              </select>
              <input name="note" defaultValue={r.admin_note ?? ""} placeholder="Note de traitement" />
              <button className="btn secondary small">Mettre à jour</button>
            </form>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatusButton({ id, status, label, secondary }: { id: string; status: string; label: string; secondary?: boolean }) {
  return (
    <form action={questionStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`btn${secondary ? " secondary" : ""}`}>{label}</button>
    </form>
  );
}
