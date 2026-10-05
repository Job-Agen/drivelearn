"use client";

import { useActionState } from "react";
import { AuthShell, Brand, buttonClass, inputClass } from "@/components/ui";
import { signUpWithEmail } from "./actions";

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(signUpWithEmail, null);
  return (
    <AuthShell action={formAction}>
      <Brand />
      <h1 className="text-center text-xl font-black text-nuit">Créer un compte administrateur</h1>
      <p className="text-sm text-gris">
        Le compte n'aura accès à l'administration qu'une fois nommé administrateur.
      </p>
      <input name="name" required placeholder="Nom" className={inputClass} />
      <input name="email" type="email" required placeholder="Adresse e-mail" className={inputClass} />
      <input name="password" type="password" required minLength={8} placeholder="Mot de passe" className={inputClass} />
      {state?.error && <p className="rounded-xl bg-rouge-doux px-3 py-2.5 text-sm font-bold text-rouge">{state.error}</p>}
      <button disabled={pending} className={`${buttonClass()} w-full`}>
        {pending ? "Création…" : "Créer le compte"}
      </button>
    </AuthShell>
  );
}
