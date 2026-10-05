"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthShell, Brand, buttonClass, inputClass } from "@/components/ui";
import { requestReset } from "./actions";

export default function RequestResetPage() {
  const [state, formAction, pending] = useActionState(requestReset, null);
  return (
    <AuthShell action={formAction}>
      <Brand />
      <h1 className="text-center text-xl font-black text-nuit">Choisir mon mot de passe</h1>
      <p className="text-center text-sm text-gris">Premier accès ou mot de passe oublié : reçois un lien par e-mail.</p>
      <input name="email" type="email" required placeholder="Adresse e-mail" className={inputClass} />
      {state?.message && <p className="rounded-xl bg-sarcelle-doux px-3 py-2.5 text-sm font-bold text-sarcelle-fonce">{state.message}</p>}
      <button disabled={pending} className={`${buttonClass()} w-full`}>
        {pending ? "Envoi…" : "Envoyer le lien"}
      </button>
      <p className="text-center text-sm">
        <Link href="/auth/sign-in" className="font-bold text-bleu hover:underline">Retour à la connexion</Link>
      </p>
    </AuthShell>
  );
}
