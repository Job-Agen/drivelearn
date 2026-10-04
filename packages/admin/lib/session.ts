import "server-only";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { pool } from "./db";
import { isAdmin } from "./queries";

function missing(name: string): never {
  throw new Error(`Variable d'environnement manquante : ${name}`);
}

// Connexion des administrateurs : identifiants vérifiés par Neon Auth (comme l'app élève), puis présence
// dans la table `admins`. Le site garde ensuite sa propre session signée, valable 8 heures.

function authUrl(): string {
  const url = process.env.NEON_AUTH_BASE_URL ?? (process.env.NODE_ENV === "production" ? missing("NEON_AUTH_BASE_URL") : "http://localhost:8787/auth");
  return url.replace(/\/$/, "");
}
/** Origine déclarée comme domaine de confiance dans Neon Auth. */
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN ?? "https://admin.drivelearn.tg";
const COOKIE = "dl_admin";
const HOURS = 8;

function secret(): Uint8Array {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value && process.env.NODE_ENV === "production") throw new Error("ADMIN_SESSION_SECRET manquant");
  return new TextEncoder().encode(value ?? "secret-de-developpement-uniquement-0123456789");
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
function keys() {
  jwks ??= createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL ?? `${authUrl()}/.well-known/jwks.json`));
  return jwks;
}

export type Admin = { userId: string; email: string };

async function neonAuth(path: string, init: { body?: unknown; cookie?: string }) {
  const res = await fetch(`${authUrl()}${path}`, {
    method: init.body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", origin: ADMIN_ORIGIN, ...(init.cookie ? { cookie: init.cookie } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .filter((c) => !c.endsWith("="))
    .join("; ");
  return { ok: res.ok, json, cookie };
}

/** Renvoie un message d'erreur, ou null si la connexion a réussi. */
export async function login(email: string, password: string): Promise<string | null> {
  let signIn;
  try {
    signIn = await neonAuth("/sign-in/email", { body: { email: email.trim(), password } });
  } catch {
    return "Service de connexion injoignable.";
  }
  if (!signIn.ok) return "E-mail ou mot de passe incorrect.";
  const token = await neonAuth("/token", { cookie: signIn.cookie });
  if (!token.ok || typeof token.json?.token !== "string") return "Connexion impossible.";

  let userId: string;
  try {
    const { payload } = await jwtVerify(token.json.token, keys(), { issuer: new URL(authUrl()).origin });
    userId = String(payload.sub);
  } catch {
    return "Connexion impossible.";
  }
  if (!(await isAdmin(pool, userId))) return "Ce compte n'a pas accès à l'administration.";

  const session = await new SignJWT({ email: email.trim() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${HOURS}h`)
    .sign(secret());
  (await cookies()).set(COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: HOURS * 3600,
  });
  return null;
}

/** Envoie le lien « choisir un mot de passe » (premier accès ou oubli). Ne révèle pas si le compte existe. */
export async function requestPasswordReset(email: string): Promise<void> {
  await neonAuth("/request-password-reset", {
    body: { email: email.trim(), redirectTo: `${ADMIN_ORIGIN}/nouveau-mot-de-passe` },
  }).catch(() => null);
}

export async function resetPassword(token: string, newPassword: string): Promise<string | null> {
  try {
    const res = await neonAuth("/reset-password", { body: { token, newPassword } });
    return res.ok ? null : "Ce lien n'est plus valable. Demande un nouveau lien.";
  } catch {
    return "Service de connexion injoignable.";
  }
}

export async function logout() {
  (await cookies()).delete(COOKIE);
}

/** À appeler en tête de chaque page et de chaque action : redirige vers la connexion sinon. */
export async function requireAdmin(): Promise<Admin> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (value) {
    try {
      const { payload } = await jwtVerify(value, secret(), { algorithms: ["HS256"] });
      const userId = String(payload.sub);
      // Retrait des droits pris en compte immédiatement
      if (await isAdmin(pool, userId)) return { userId, email: String(payload.email ?? "") };
    } catch {
      // session expirée ou falsifiée
    }
  }
  redirect("/login");
}
