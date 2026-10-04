import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const NAV = [
  ["/", "Tableau de bord"],
  ["/programmes", "Programmes"],
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
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white p-5">
        <p className="mb-8 text-xl font-bold text-nuit">
          Drive<span className="text-sarcelle">Learn</span>
          <span className="block text-sm font-medium text-slate-500">Admin</span>
        </p>
        <nav className="space-y-1">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
              {label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="mt-10 text-xs text-slate-500">
          <p className="mb-2 truncate">{email}</p>
          <button className="underline">Se déconnecter</button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
