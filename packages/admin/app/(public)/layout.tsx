import Link from "next/link";
import type { ReactNode } from "react";
import { CONTACT_EMAIL } from "@/components/legal";

// Pages publiques (sans connexion) : liées depuis l'application et la fiche Play Store.

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-fond">
      <header className="bg-nuit px-5 py-4">
        <p className="mx-auto max-w-3xl text-2xl font-black text-white">
          Drive<span className="text-[#5fd3cb]">Learn</span>
        </p>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8 leading-relaxed">{children}</main>
      <footer className="mx-auto flex max-w-3xl flex-wrap gap-x-5 gap-y-1 border-t border-bord px-5 py-6 text-sm text-gris">
        <Link href="/confidentialite" className="font-bold text-bleu hover:underline">Confidentialité</Link>
        <Link href="/conditions" className="font-bold text-bleu hover:underline">Conditions d'utilisation</Link>
        <Link href="/suppression-compte" className="font-bold text-bleu hover:underline">Supprimer mon compte</Link>
        <span>Contact : {CONTACT_EMAIL}</span>
      </footer>
    </div>
  );
}
