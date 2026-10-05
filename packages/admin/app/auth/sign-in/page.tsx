"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthShell, Brand, buttonClass, inputClass } from "@/components/ui";
import { signInWithEmail } from "./actions";

export default function SignInPage() {
  const [state, formAction, pending] = useActionState(signInWithEmail, null);
  return (
    <AuthShell action={formAction}>
      <Brand subtitle="Administration" />
      <input name="email" type="email" required placeholder="Adresse e-mail" className={inputClass} />
      <input name="password" type="password" required placeholder="Mot de passe" className={inputClass} />
      {state?.error && <p className="rounded-xl bg-rouge-doux px-3 py-2.5 text-sm font-bold text-rouge">{state.error}</p>}
      <button disabled={pending} className={`${buttonClass()} w-full`}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
      <p className="text-center text-sm">
        <Link href="/auth/mot-de-passe" className="font-bold text-bleu hover:underline">Premier accès ou mot de passe oublié ?</Link>
      </p>
      <p className="text-center text-sm text-gris">
        Pas encore de compte ? <Link href="/auth/sign-up" className="font-bold text-bleu hover:underline">Créer un compte</Link>
      </p>
    </AuthShell>
  );
}
