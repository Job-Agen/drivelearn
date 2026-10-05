import Link from "next/link";
import { Card, linkClass, PageTitle, Stat, StatusBadge } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { getDashboard } from "@/lib/data/dashboard";
import { pool } from "@/lib/db";

const STATUSES = ["brouillon", "a_verifier", "en_validation", "validee"] as const;
const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

export default async function Dashboard() {
  await requireAdmin();
  const d = await getDashboard(pool);
  const toCheck = (d.questions.a_verifier ?? 0) + (d.questions.en_validation ?? 0);
  return (
    <>
      <PageTitle title="Tableau de bord" subtitle="Vue d'ensemble de DriveLearn." />
      <div className="mb-4 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        <Stat value={d.students} label="Élèves inscrits" />
        <Stat value={d.questions.validee ?? 0} label="Questions validées" href="/questions?status=validee" />
        <Stat value={d.month.sales} label="Ventes du mois" hint={fcfa(d.month.revenue_xof)} href="/ventes" />
        <Stat value={fcfa(d.month.commission_xof)} label="Commissions du mois" href="/ventes" />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
        <Card title="Questions par statut">
          <table className="w-full text-sm">
            <tbody>
              {STATUSES.map((s) => (
                <tr key={s}>
                  <td className="py-2.5">
                    <Link href={`/questions?status=${s}`}><StatusBadge status={s} /></Link>
                  </td>
                  <td className="py-2.5 text-right font-bold">{d.questions[s] ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="À traiter">
          <p><Link href="/signalements" className={linkClass}>{d.open_reports} signalement{d.open_reports > 1 ? "s" : ""} ouvert{d.open_reports > 1 ? "s" : ""}</Link></p>
          <p className="mt-2"><Link href="/questions?status=en_validation" className={linkClass}>{toCheck} question{toCheck > 1 ? "s" : ""} à valider ou vérifier</Link></p>
        </Card>
      </div>
    </>
  );
}
