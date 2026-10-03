"use client";

import { useActionState } from "react";
import { loginAction } from "../(admin)/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="card">
      <div className="brand">
        Drive<span>Learn</span>
      </div>
      <p className="muted" style={{ textAlign: "center" }}>
        Administration · accès réservé
      </p>
      <label className="field">
        E-mail
        <input name="email" type="email" autoComplete="email" defaultValue={state?.email} key={state?.email} required />
      </label>
      <label className="field">
        Mot de passe
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state ? <div className="alert error">{state.error}</div> : null}
      <button className="btn" disabled={pending} style={{ justifyContent: "center" }}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
