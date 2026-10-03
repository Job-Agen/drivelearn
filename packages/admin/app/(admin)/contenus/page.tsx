import Link from "next/link";
import { Badge, Flash, QUESTION_STATUS, one } from "@/components/ui";
import { pool } from "@/lib/db";
import { contentTree, listPrograms, listQuestions } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { createLessonAction, createUnitAction, renameUnitAction } from "../actions";

/** Écran 30 — Contenus : unités, leçons, questions et leur statut de validation. */
export default async function ContentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const programs = await listPrograms(pool);
  const programId = one(sp.program) ?? programs[0]?.id;
  if (!programId) return <p>Crée d'abord un programme.</p>;
  const status = one(sp.status);
  const lesson = one(sp.lesson);
  const search = one(sp.q);
  const [tree, questions] = await Promise.all([
    contentTree(pool, programId),
    listQuestions(pool, { programId, status, lessonId: lesson, search }),
  ]);
  const link = (over: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { program: programId, status, lesson, q: search, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return `/contenus?${params}`;
  };
  const lessonTitle = tree.flatMap((u) => u.lessons).find((l) => l.id === lesson)?.title;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Contenus</h1>
          <p className="muted">Seules les questions validées sont servies aux élèves. Toute modification d'une question validée la renvoie en validation.</p>
        </div>
        <Link className="btn" href={`/contenus/questions/nouvelle?program=${programId}${lesson ? `&lesson=${lesson}` : ""}`}>
          Nouvelle question
        </Link>
      </div>
      <div className="tabs">
        {programs.map((p) => (
          <Link key={p.id} href={`/contenus?program=${p.id}`} className={p.id === programId ? "on" : undefined}>
            {p.name}
          </Link>
        ))}
      </div>
      <Flash searchParams={searchParams} />
      <div className="two" style={{ gridTemplateColumns: "minmax(280px, 1fr) minmax(0, 2fr)" }}>
        <div className="stack">
          {tree.map((u) => (
            <div key={u.id} className="card stack" style={{ gap: 8 }}>
              <form action={renameUnitAction} className="row" style={{ gap: 6 }}>
                <input type="hidden" name="program" value={programId} />
                <input type="hidden" name="id" value={u.id} />
                <input name="title" defaultValue={u.title} style={{ flex: 1, fontWeight: 800, color: "var(--navy)" }} aria-label="Titre de l'unité" />
                <button className="btn secondary small">Renommer</button>
              </form>
              {u.lessons.map((l) => {
                const total = Object.values(l.counts).reduce((a, b) => a + b, 0);
                return (
                  <div key={l.id} className="row" style={{ justifyContent: "space-between", gap: 6 }}>
                    <Link href={link({ lesson: l.id })} style={{ fontWeight: l.id === lesson ? 900 : 700 }}>
                      {l.title}
                    </Link>
                    <span className="row" style={{ gap: 4 }}>
                      <span className="badge b-validee" title="Validées">
                        {l.counts.validee ?? 0}/{total}
                      </span>
                      <Link className="small" href={`/contenus/lecons/${l.id}`}>
                        Écran
                      </Link>
                    </span>
                  </div>
                );
              })}
              {u.withoutLesson ? <p className="small muted">{u.withoutLesson} question(s) sans leçon</p> : null}
              <form action={createLessonAction} className="row" style={{ gap: 6 }}>
                <input type="hidden" name="program" value={programId} />
                <input type="hidden" name="unit" value={u.id} />
                <input name="title" placeholder="Nouvelle leçon" style={{ flex: 1 }} required />
                <button className="btn secondary small">Ajouter</button>
              </form>
            </div>
          ))}
          <form action={createUnitAction} className="card row" style={{ gap: 6 }}>
            <input type="hidden" name="program" value={programId} />
            <input name="title" placeholder="Nouvelle unité (thème)" style={{ flex: 1 }} required />
            <button className="btn small">Créer</button>
          </form>
        </div>

        <div className="stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="tabs">
              <Link href={link({ status: undefined })} className={!status ? "on" : undefined}>
                Toutes
              </Link>
              {Object.entries(QUESTION_STATUS).map(([s, label]) => (
                <Link key={s} href={link({ status: s })} className={status === s ? "on" : undefined}>
                  {label}
                </Link>
              ))}
            </div>
            <form className="row" style={{ gap: 6 }}>
              <input type="hidden" name="program" value={programId} />
              {status ? <input type="hidden" name="status" value={status} /> : null}
              {lesson ? <input type="hidden" name="lesson" value={lesson} /> : null}
              <input name="q" defaultValue={search} placeholder="Rechercher un énoncé" />
            </form>
          </div>
          {lessonTitle ? (
            <p className="muted">
              Leçon « {lessonTitle} » · <Link href={link({ lesson: undefined })}>toutes les leçons</Link>
            </p>
          ) : null}
          <table>
            <thead>
              <tr>
                <th>Question</th>
                <th>Leçon</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id}>
                  <td>
                    <Link href={`/contenus/questions/${q.id}`} style={{ fontWeight: 700 }}>
                      {q.prompt}
                    </Link>
                    {q.image_path ? <span className="muted small"> · image</span> : null}
                    {q.open_reports ? <span className="badge b-failed" style={{ marginLeft: 6 }}>{q.open_reports} signalement(s)</span> : null}
                  </td>
                  <td className="small">
                    {q.unit_title}
                    <div className="muted">{q.lesson_title ?? "Sans leçon"}</div>
                  </td>
                  <td>
                    <Badge status={q.status} labels={QUESTION_STATUS} />
                  </td>
                </tr>
              ))}
              {questions.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    Aucune question.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
