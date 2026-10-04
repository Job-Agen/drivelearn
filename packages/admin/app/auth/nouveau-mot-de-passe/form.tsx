"use client";

import { useActionState } from "react";
import { inputClass } from "@/components/ui";
import { resetPassword } from "../mot-de-passe/actions";

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPassword, null);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow">
        <h1 className="text-center text-2xl font-bold text-nuit">Nouveau mot de passe</h1>
        {!token && <p className="text-sm text-red-600">Lien incomplet : ouvre le lien reçu par e-mail.</p>}
        <input type="hidden" name="token" value={token} />
        <input name="password" type="password" required minLength={8} placeholder="Nouveau mot de passe (8 caractères min.)" className={inputClass} />
        <input name="confirm" type="password" required minLength={8} placeholder="Confirmer le mot de passe" className={inputClass} />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button disabled={pending || !token} className="w-full rounded-lg bg-sarcelle py-2 font-semibold text-white">
          {pending ? "Enregistrement…" : "Enregistrer le mot de passe"}
        </button>
      </form>
    </main>
  );
}
