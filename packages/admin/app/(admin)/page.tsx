import Link from "next/link";
import { Card, PageTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { getDashboard } from "@/lib/data/dashboard";
import { pool } from "@/lib/db";

const STATUS_LABELS = [
  ["brouillon", "Brouillon"],
  ["a_verifier", "À vérifier"],
  ["en_validation", "En validation"],
  ["validee", "Validée"],
] as const;

function Stat({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const body = (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-nuit">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function Dashboard() {
  await requireAdmin();
  const d = await getDashboard(pool);
  return (
    <>
      <PageTitle title="Tableau de bord" />
      <div className="mb-6 grid grid-cols-4 gap-4">
        <Stat label="Élèves inscrits" value={d.students} />
        <Stat label="Questions validées" value={d.questions.validee ?? 0} href="/questions?status=validee" />
        <Stat label="Signalements ouverts" value={d.open_reports} href="/signalements" />
        <Stat label="Ventes du mois" value={d.month.sales} href="/ventes" />
      </div>
      <Card title="Questions par statut">
        <div className="flex gap-6 text-sm">
          {STATUS_LABELS.map(([s, label]) => (
            <Link key={s} href={`/questions?status=${s}`} className="text-bleu underline">
              {label} : {d.questions[s] ?? 0}
            </Link>
          ))}
        </div>
      </Card>
      <Card title="Ce mois-ci">
        <p className="text-sm">
          Chiffre d'affaires : <b>{d.month.revenue_xof.toLocaleString("fr-FR")} FCFA</b> · Commissions dues :{" "}
          <b>{d.month.commission_xof.toLocaleString("fr-FR")} FCFA</b>
        </p>
      </Card>
    </>
  );
}
