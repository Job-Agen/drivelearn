import { Platform } from "react-native";
import { APP_ORIGIN, AUTH_URL } from "./config";
import { AppError, OFFLINE, cookieFromSetCookie, jwtExpiry } from "./http";
import { secure } from "./storage";

// Client minimal de Neon Auth (Better Auth géré) : session par cookie, gardée dans le trousseau,
// échangée contre un JWT de 15 minutes pour appeler l'API.
// Sur le web (développement), le navigateur gère lui-même le cookie et l'origine.

const WEB = Platform.OS === "web";
const WEB_SESSION = "navigateur";

const SESSION_KEY = "neon_auth_session";
let session: string | null | undefined;
let cachedToken: { token: string; expiresAt: number } | null = null;

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou mot de passe incorrect.",
  USER_ALREADY_EXISTS: "Un compte existe déjà avec cet e-mail.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Un compte existe déjà avec cet e-mail.",
  PASSWORD_TOO_SHORT: "Le mot de passe doit contenir au moins 8 caractères.",
  PASSWORD_TOO_LONG: "Le mot de passe est trop long.",
  INVALID_EMAIL: "Adresse e-mail invalide.",
  EMAIL_NOT_VERIFIED: "Vérifie ton adresse e-mail pour continuer.",
};

async function loadSession(): Promise<string | null> {
  if (session === undefined) session = await secure.get(SESSION_KEY);
  return session;
}

async function saveSession(value: string | null) {
  session = value;
  cachedToken = null;
  await secure.set(SESSION_KEY, value);
}

async function call(path: string, body?: unknown): Promise<{ status: number; json: any; headers: Headers }> {
  const current = await loadSession();
  let res: Response;
  try {
    res = await fetch(`${AUTH_URL}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: WEB
        ? { "content-type": "application/json" }
        : { "content-type": "application/json", origin: APP_ORIGIN, ...(current ? { cookie: current } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: WEB ? "include" : "omit",
    });
  } catch {
    throw OFFLINE;
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const code = String(json?.code ?? "auth_error");
    throw new AppError(code, MESSAGES[code] ?? json?.message ?? "La connexion a échoué. Réessaie.", res.status);
  }
  return { status: res.status, json, headers: res.headers };
}

async function keepSessionFrom(headers: Headers) {
  if (WEB) {
    if (session !== WEB_SESSION) await saveSession(WEB_SESSION);
    return;
  }
  const cookie = cookieFromSetCookie(headers.get("set-cookie"));
  if (cookie) await saveSession(cookie);
}

export const auth = {
  async hasSession(): Promise<boolean> {
    return (await loadSession()) !== null;
  },

  async signUp(email: string, password: string, name: string): Promise<void> {
    const { headers } = await call("/sign-up/email", { email, password, name });
    await keepSessionFrom(headers);
  },

  async signIn(email: string, password: string): Promise<void> {
    await saveSession(null);
    const { headers } = await call("/sign-in/email", { email, password });
    await keepSessionFrom(headers);
  },

  async sendVerificationEmail(email: string): Promise<void> {
    await call("/send-verification-email", { email });
  },

  async requestPasswordReset(email: string): Promise<void> {
    await call("/request-password-reset", { email });
  },

  async signOut(): Promise<void> {
    try {
      await call("/sign-out", {});
    } catch {
      // Déconnexion locale même hors ligne
    }
    await saveSession(null);
  },

  /** Oublie la session sans prévenir le serveur (compte supprimé, session révoquée). */
  async forget(): Promise<void> {
    await saveSession(null);
  },

  /** JWT pour l'API, renouvelé une minute avant son expiration. */
  async token(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.token;
    if (!(await loadSession())) throw new AppError("unauthorized", "Connexion requise.", 401);
    const { json, headers } = await call("/token");
    await keepSessionFrom(headers);
    if (typeof json?.token !== "string") throw new AppError("unauthorized", "Session expirée. Reconnecte-toi.", 401);
    cachedToken = { token: json.token, expiresAt: jwtExpiry(json.token) };
    return json.token;
  },
};
