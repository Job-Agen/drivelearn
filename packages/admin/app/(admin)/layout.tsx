import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
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
  ["/codes", "Codes Pass"],
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
      <Sidebar
        items={NAV.map(([href, label]) => ({ href, label, count: href === "/signalements" ? rows[0].n : undefined }))}
        footer={
          <form action={signOut} className="mt-3 border-t border-white/[.13] px-3 pt-2.5 text-[13px] text-[#b9c8ea] md:mt-auto">
            <p className="truncate">{email}</p>
            <button className="pt-1.5 font-bold text-white">Se déconnecter</button>
          </form>
        }
      />
      <main className="w-full max-w-[1200px] min-w-0 flex-1 px-4 pt-5 pb-16 md:px-8 md:pt-7">{children}</main>
    </div>
  );
}
