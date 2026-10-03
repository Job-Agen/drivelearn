import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/ui";
import { pool } from "@/lib/db";
import { getLesson } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { imageUrl } from "@/lib/images";
import { saveLessonAction } from "../../../actions";

/** Écran d'explication d'une leçon (écran 09 de l'application), avec aperçu. */
export default async function LessonPage(props: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { id } = await props.params;
  const l = await getLesson(pool, id);
  if (!l) notFound();
  const img = imageUrl(l.intro_image_path);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <Link className="small" href={`/contenus?program=${l.program_id}&lesson=${l.id}`}>
            ← {l.unit_title}
          </Link>
          <h1>{l.title}</h1>
          <p className="muted">Écran d'explication affiché avant le quiz.</p>
        </div>
        <Link className="btn" href={`/contenus/questions/nouvelle?program=${l.program_id}&lesson=${l.id}`}>
          Ajouter une question à cette leçon
        </Link>
      </div>
      <Flash searchParams={props.searchParams} />
      <div className="two">
        <form action={saveLessonAction} className="card stack">
          <input type="hidden" name="id" value={l.id} />
          <label className="field">
            Titre dans le parcours
            <input name="title" defaultValue={l.title} required />
          </label>
          <label className="field">
            Titre de l'écran d'explication
            <input name="introTitle" defaultValue={l.intro_title ?? ""} placeholder="Reconnaître les formes" />
          </label>
          <label className="field">
            Texte court
            <textarea name="introText" defaultValue={l.intro_text ?? ""} placeholder="La forme et la couleur donnent des indices." />
          </label>
          <label className="field">
            Image (chemin dans le stockage)
            <input name="introImagePath" defaultValue={l.intro_image_path ?? ""} placeholder="ex. panneaux-formes.png" />
          </label>
          <label className="field">
            Conseil du moniteur
            <input name="mentorTip" defaultValue={l.mentor_tip ?? ""} placeholder="Observe avant de répondre." />
          </label>
          <button className="btn" style={{ alignSelf: "flex-start" }}>
            Enregistrer
          </button>
        </form>
        <div className="phone">
          <div className="hint">{l.unit_title}</div>
          {img ? <img src={img} alt="" /> : null}
          <div className="prompt">{l.intro_title ?? l.title}</div>
          {l.intro_text ? <div className="hint" style={{ color: "var(--text)" }}>{l.intro_text}</div> : null}
          {l.mentor_tip ? <div className="bubble">🧑🏾‍🏫 {l.mentor_tip}</div> : null}
        </div>
      </div>
    </div>
  );
}
