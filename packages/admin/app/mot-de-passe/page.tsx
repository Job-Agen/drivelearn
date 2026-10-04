"use client";

import { useActionState } from "react";
import { requestResetAction } from "../(admin)/actions";

/** Premier accès ou mot de passe oublié : envoi d'un lien par e-mail (Neon Auth). */
export default function RequestResetPage() {
  const [message, action, pending] = useActionState(requestResetAction, null);
  return (
    <main className="login">
      <form action={action} className="card">
        <div className="brand">
          Drive<span>Learn</span>
        </div>
        <h2 style={{ textAlign: "center", margin: 0 }}>Choisir mon mot de passe</h2>
        <p className="muted" style={{ textAlign: "center" }}>
          Premier accès ou mot de passe oublié : reçois un lien pour choisir ton mot de passe.
        </p>
        <label className="field">
          E-mail
          <input name="email" type="email" autoComplete="email" required />
        </label>
        {message ? <div className="alert ok">{message}</div> : null}
        <button className="btn" disabled={pending} style={{ justifyContent: "center" }}>
          {pending ? "Envoi…" : "Envoyer le lien"}
        </button>
        <a href="/login" className="small" style={{ textAlign: "center" }}>
          Retour à la connexion
        </a>
      </form>
    </main>
  );
}
