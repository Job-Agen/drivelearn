"use client";

import Link from "next/link";
import { useActionState } from "react";
import { inputClass } from "@/components/ui";
import { requestReset } from "./actions";

export default function RequestResetPage() {
  const [state, formAction, pending] = useActionState(requestReset, null);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow">
        <h1 className="text-center text-2xl font-bold text-nuit">Choisir mon mot de passe</h1>
        <p className="text-center text-sm text-slate-500">Premier accès ou mot de passe oublié : reçois un lien par e-mail.</p>
        <input name="email" type="email" required placeholder="Adresse e-mail" className={inputClass} />
        {state?.message && <p className="text-sm text-slate-700">{state.message}</p>}
        <button disabled={pending} className="w-full rounded-lg bg-sarcelle py-2 font-semibold text-white">
          {pending ? "Envoi…" : "Envoyer le lien"}
        </button>
        <p className="text-center text-sm">
          <Link href="/auth/sign-in" className="text-bleu underline">Retour à la connexion</Link>
        </p>
      </form>
    </main>
  );
}
