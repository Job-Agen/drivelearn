import Link from "next/link";
import { Flash, fcfa, one } from "@/components/ui";
import { pool } from "@/lib/db";
import { listSchools } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";
import { saveSchoolAction } from "../actions";

/** Auto-écoles partenaires : code promo, réduction pour l'élève, commission. */
export default async function SchoolsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const editId = one((await searchParams).edit);
  const schools = await listSchools(pool);
  const editing = schools.find((s) => s.id === editId);
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Auto-écoles</h1>
          <p className="muted">Chaque auto-école diffuse son code promo : l'élève obtient une réduction, l'auto-école une commission sur la vente.</p>
        </div>
      </div>
      <Flash searchParams={searchParams} />
      <table>
        <thead>
          <tr>
            <th>Auto-école</th>
            <th>Code promo</th>
            <th className="num">Réduction</th>
            <th className="num">Commission</th>
            <th className="num">Élèves</th>
            <th className="num">Ventes</th>
            <th className="num">Commissions</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {schools.map((s) => (
            <tr key={s.id}>
              <td>
                <strong>{s.name}</strong> {s.active ? null : <span className="badge b-inactif">Inactive</span>}
              </td>
              <td>
                <code>{s.promo_code}</code>
              </td>
              <td className="num">{s.discount_percent} %</td>
              <td className="num">{s.commission_percent} %</td>
              <td className="num">{s.students}</td>
              <td className="num">{s.sales}</td>
              <td className="num">{fcfa(s.commission)}</td>
              <td className="num">
                <Link className="btn secondary small" href={`/auto-ecoles?edit=${s.id}`}>
                  Modifier
                </Link>
              </td>
            </tr>
          ))}
          {schools.length === 0 ? (
            <tr>
              <td colSpan={8} className="muted">
                Aucune auto-école pour l'instant.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <form action={saveSchoolAction} className="card stack" key={editing?.id ?? "new"}>
        <h2>{editing ? `Modifier « ${editing.name} »` : "Nouvelle auto-école"}</h2>
        <input type="hidden" name="id" value={editing?.id ?? ""} />
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="field" style={{ flex: 2, minWidth: 200 }}>
            Nom
            <input name="name" defaultValue={editing?.name ?? ""} required />
          </label>
          <label className="field">
            Code promo
            <input name="promoCode" defaultValue={editing?.promo_code ?? ""} placeholder="LOME10" style={{ textTransform: "uppercase" }} required />
          </label>
          <label className="field">
            Réduction (%)
            <input name="discount" type="number" min={0} max={100} defaultValue={editing?.discount_percent ?? 10} />
          </label>
          <label className="field">
            Commission (%)
            <input name="commission" type="number" min={0} max={100} defaultValue={editing?.commission_percent ?? 10} />
          </label>
          <label className="row" style={{ gap: 6, fontWeight: 700 }}>
            <input type="checkbox" name="active" defaultChecked={editing?.active ?? true} /> Active
          </label>
        </div>
        <div className="row">
          <button className="btn">{editing ? "Enregistrer" : "Créer"}</button>
          {editing ? (
            <Link href="/auto-ecoles" className="btn secondary">
              Annuler
            </Link>
          ) : null}
        </div>
      </form>
    </div>
  );
}
