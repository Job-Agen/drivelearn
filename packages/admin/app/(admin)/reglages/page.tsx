import { Flash } from "@/components/ui";
import { pool } from "@/lib/db";
import { SETTINGS, getSettings } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { settingsAction } from "../actions";

/** Réglages globaux : prix et durée du Pass, XP, critère « prêt pour l'examen ». */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const values = await getSettings(pool);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Réglages</h1>
          <p className="muted">Pris en compte immédiatement : le prix s'applique aux prochains paiements.</p>
        </div>
      </div>
      <Flash searchParams={searchParams} />
      <form action={settingsAction} className="card stack" style={{ maxWidth: 560 }}>
        {Object.entries(SETTINGS).map(([key, def]) => (
          <label key={key} className="field">
            {def.label}
            <span className="row" style={{ gap: 8 }}>
              <input name={key} type="number" min={def.min} max={def.max} defaultValue={values[key]} style={{ width: 160 }} />
              <span className="muted">{def.unit}</span>
            </span>
          </label>
        ))}
        <button className="btn" style={{ alignSelf: "flex-start" }}>
          Enregistrer
        </button>
      </form>
    </div>
  );
}
