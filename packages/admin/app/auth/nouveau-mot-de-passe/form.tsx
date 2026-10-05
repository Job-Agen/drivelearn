"use client";

import { useActionState } from "react";
import { AuthShell, Brand, buttonClass, inputClass } from "@/components/ui";
import { resetPassword } from "../mot-de-passe/actions";

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, null);
  return (
    <AuthShell action={formAction}>
      <Brand />
      <h1 className="text-center text-xl font-black text-nuit">Nouveau mot de passe</h1>
      {!token && <p className="rounded-xl bg-rouge-doux px-3 py-2.5 text-sm font-bold text-rouge">Lien incomplet : ouvre le lien reçu par e-mail.</p>}
      <input type="hidden" name="token" value={token} />
      <input name="password" type="password" required minLength={8} placeholder="Nouveau mot de passe (8 caractères min.)" className={inputClass} />
      <input name="confirm" type="password" required minLength={8} placeholder="Confirmer le mot de passe" className={inputClass} />
      {state?.error && <p className="rounded-xl bg-rouge-doux px-3 py-2.5 text-sm font-bold text-rouge">{state.error}</p>}
      <button disabled={pending || !token} className={`${buttonClass()} w-full`}>
        {pending ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </button>
    </AuthShell>
  );
}
