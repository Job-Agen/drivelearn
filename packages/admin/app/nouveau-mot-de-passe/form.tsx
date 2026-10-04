"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "../(admin)/actions";

export function ResetForm({ token }: { token: string }) {
  const [error, action, pending] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="card">
      <div className="brand">
        Drive<span>Learn</span>
      </div>
      <h2 style={{ textAlign: "center", margin: 0 }}>Nouveau mot de passe</h2>
      {!token ? <div className="alert error">Lien incomplet : ouvre le lien reçu par e-mail.</div> : null}
      <input type="hidden" name="token" value={token} />
      <label className="field">
        Nouveau mot de passe (8 caractères minimum)
        <input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <label className="field">
        Confirmer le mot de passe
        <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      {error ? <div className="alert error">{error}</div> : null}
      <button className="btn" disabled={pending || !token} style={{ justifyContent: "center" }}>
        {pending ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </button>
    </form>
  );
}
