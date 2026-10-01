"use client";

import { useActionState } from "react";
import { inputClass } from "@/components/ui";
import { signUpWithEmail } from "./actions";

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(signUpWithEmail, null);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow">
        <h1 className="text-center text-xl font-bold text-nuit">Créer un compte administrateur</h1>
        <p className="text-sm text-slate-500">
          Le compte n'aura accès à l'administration qu'une fois nommé administrateur.
        </p>
        <input name="name" required placeholder="Nom" className={inputClass} />
        <input name="email" type="email" required placeholder="Adresse e-mail" className={inputClass} />
        <input name="password" type="password" required minLength={8} placeholder="Mot de passe" className={inputClass} />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button disabled={pending} className="w-full rounded-lg bg-sarcelle py-2 font-semibold text-white">
          {pending ? "Création…" : "Créer le compte"}
        </button>
      </form>
    </main>
  );
}
