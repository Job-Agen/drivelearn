import { NavLink } from "@/components/nav-link";
import { pool } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { logoutAction } from "./actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const { rows } = await pool.query("select count(*)::int as n from question_reports where status <> 'resolu'");
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">
          Drive<span>Learn</span>
        </div>
        <nav className="nav">
          <NavLink href="/" label="Tableau de bord" />
          <NavLink href="/programmes" label="Programmes et examens" />
          <NavLink href="/contenus" label="Contenus" />
          <NavLink href="/signalements" label="Signalements" count={rows[0].n} />
          <NavLink href="/auto-ecoles" label="Auto-écoles" />
          <NavLink href="/ventes" label="Ventes" />
          <NavLink href="/reglages" label="Réglages" />
        </nav>
        <div className="me">
          {admin.email}
          <form action={logoutAction}>
            <button>Se déconnecter</button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
