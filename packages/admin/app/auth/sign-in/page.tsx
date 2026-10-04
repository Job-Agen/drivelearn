"use client";

import Link from "next/link";
import { useActionState } from "react";
import { inputClass } from "@/components/ui";
import { signInWithEmail } from "./actions";

export default function SignInPage() {
  const [state, formAction, pending] = useActionState(signInWithEmail, null);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow">
        <h1 className="text-center text-2xl font-bold text-nuit">
          Drive<span className="text-sarcelle">Learn</span> Admin
        </h1>
        <input name="email" type="email" required placeholder="Adresse e-mail" className={inputClass} />
        <input name="password" type="password" required placeholder="Mot de passe" className={inputClass} />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button disabled={pending} className="w-full rounded-lg bg-sarcelle py-2 font-semibold text-white">
          {pending ? "Connexion…" : "Se connecter"}
        </button>
        <p className="text-center text-sm text-slate-500">
          Pas encore de compte ? <Link href="/auth/sign-up" className="text-bleu underline">Créer un compte</Link>
        </p>
      </form>
    </main>
  );
}
