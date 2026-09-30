// Essai de bout en bout sur l'API déployée, avec un vrai compte Neon Auth jetable.
// Lit API_URL, NEON_AUTH_BASE_URL et DATABASE_URL_UNPOOLED dans .env.local ; n'affiche aucun secret.
import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(new URL("../../../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);
const API_URL = env.API_URL;
const AUTH = env.NEON_AUTH_BASE_URL ?? "https://ep-small-glade-b1t7owsk.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth";
const ORIGIN = "https://app.drivelearn.tg";
const email = `smoke-${Date.now()}@drivelearn.test`;
const password = `Smoke-${Date.now()}-Pw!`;

let cookie = "";
async function auth(path: string, body?: unknown) {
  const res = await fetch(`${AUTH}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", origin: ORIGIN, ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.getSetCookie();
  if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
  return { status: res.status, json: await res.json().catch(() => null) };
}
async function api(method: string, path: string, token: string) {
  const res = await fetch(`${API_URL}${path}`, { method, headers: { authorization: `Bearer ${token}` } });
  return { status: res.status, json: await res.json().catch(() => null) };
}
function check(label: string, ok: boolean, detail: unknown) {
  console.log(`${ok ? "OK " : "ÉCHEC"}  ${label}${ok ? "" : ` → ${JSON.stringify(detail)}`}`);
  if (!ok) process.exitCode = 1;
}

check("GET /health", (await fetch(`${API_URL}/health`)).status === 200, null);

const signUp = await auth("/sign-up/email", { email, password, name: "Smoke" });
check("inscription Neon Auth", signUp.status === 200, signUp);

// Compte de test jetable : on marque l'e-mail comme vérifié directement en base.
const db = new pg.Client({ connectionString: env.DATABASE_URL_UNPOOLED });
await db.connect();
await db.query(`update neon_auth."user" set "emailVerified" = true where email = $1`, [email]);
await db.end();

cookie = "";
const signIn = await auth("/sign-in/email", { email, password });
check("connexion Neon Auth", signIn.status === 200, signIn);
const token = (await auth("/token")).json?.token as string;
check("jeton obtenu", typeof token === "string", null);

const me = await api("GET", "/v1/me", token);
check("GET /v1/me crée le profil", me.status === 200 && me.json?.email === email, me);
check("GET /v1/programs", (await api("GET", "/v1/programs", token)).status === 200, null);
const noToken = await fetch(`${API_URL}/v1/me`);
check("sans jeton → 401", noToken.status === 401, noToken.status);

const del = await api("DELETE", "/v1/me", token);
check("DELETE /v1/me", del.status === 204, del);
cookie = "";
const after = await auth("/sign-in/email", { email, password });
check("le compte supprimé ne peut plus se connecter", after.status !== 200, after.status);
