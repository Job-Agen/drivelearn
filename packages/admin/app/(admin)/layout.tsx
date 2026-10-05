import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { NavLink } from "@/components/nav-link";
import { requireAdmin } from "@/lib/admin";
import { auth } from "@/lib/auth/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

const NAV = [
  ["/", "Tableau de bord"],
  ["/programmes", "Programmes et examens"],
  ["/questions", "Contenus"],
  ["/signalements", "Signalements"],
  ["/auto-ecoles", "Auto-écoles"],
  ["/ventes", "Ventes"],
  ["/reglages", "Réglages"],
] as const;

async function signOut() {
  "use server";
  await auth.signOut();
  redirect("/auth/sign-in");
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { email } = await requireAdmin();
  const { rows } = await pool.query<{ n: number }>("select count(*)::int as n from question_reports where status <> 'resolu'");
  return (
    <div className="flex min-h-screen flex-col md:flex-row md:bg-[linear-gradient(to_right,var(--color-nuit)_240px,var(--color-fond)_240px)]">
      <aside className="flex shrink-0 flex-col gap-1 bg-nuit px-[14px] py-5 text-white md:sticky md:top-0 md:h-screen md:w-60">
        <p className="px-2.5 pt-1 pb-[18px] text-2xl font-black tracking-tight">
          Drive<span className="text-[#5fd3cb]">Learn</span>
        </p>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(([href, label]) => (
            <NavLink key={href} href={href} label={label} count={href === "/signalements" ? rows[0].n : undefined} />
          ))}
        </nav>
        <form action={signOut} className="mt-auto border-t border-white/[.13] px-3 pt-2.5 text-[13px] text-[#b9c8ea]">
          <p className="truncate">{email}</p>
          <button className="pt-1.5 font-bold text-white">Se déconnecter</button>
        </form>
      </aside>
      <main className="w-full max-w-[1200px] flex-1 px-8 pt-7 pb-16">{children}</main>
    </div>
  );
}
