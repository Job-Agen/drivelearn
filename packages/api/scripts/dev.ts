// Serveur de développement local : l'API réelle (createApp) + un faux Neon Auth en mémoire.
// Permet de faire tourner l'app élève sans toucher au projet Neon. Ne jamais déployer.
//   DATABASE_URL=postgres://… npm run dev -w @drivelearn/api
// Puis dans packages/app : EXPO_PUBLIC_API_URL=http://localhost:8787 EXPO_PUBLIC_AUTH_URL=http://localhost:8787/auth
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { migrate } from "../../db/src/migrate.js";
import { createApp } from "../src/app.js";
import { createTokenVerifier } from "../src/auth.js";

const PORT = Number(process.env.PORT ?? 8787);
const ISSUER = `http://localhost:${PORT}`;
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/drivelearn_dev";
const COOKIE = "dev-auth.session_token";

await migrate(DATABASE_URL);
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });

const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
const jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: "dev", alg: "EdDSA" }] });

type User = { id: string; email: string; password: string; name: string };
const users = new Map<string, User>(); // e-mail → utilisateur
const sessions = new Map<string, string>(); // jeton de session → id utilisateur

const api = createApp({
  db: pool,
  verifyToken: createTokenVerifier({ keys: jwks, issuer: ISSUER }),
  authAdmin: {
    async deleteUser(id) {
      for (const [email, u] of users) if (u.id === id) users.delete(email);
    },
  },
  requireVerifiedEmail: false,
  imagesBaseUrl: process.env.IMAGES_BASE_URL ?? `${ISSUER}/images`,
});

const authApp = new Hono();
const error = (code: string, status: 400 | 401 | 422) => ({ body: { code, message: code }, status });

function openSession(c: Context, user: User) {
  const token = randomUUID();
  sessions.set(token, user.id);
  setCookie(c, COOKIE, token, { path: "/", httpOnly: true, sameSite: "Lax" });
  return c.json({ token, user: { id: user.id, email: user.email, name: user.name, emailVerified: true } });
}

authApp.post("/sign-up/email", async (c) => {
  const { email, password, name } = await c.req.json();
  if (users.has(email)) {
    const e = error("USER_ALREADY_EXISTS", 422);
    return c.json(e.body, e.status);
  }
  if (typeof password !== "string" || password.length < 8) {
    const e = error("PASSWORD_TOO_SHORT", 400);
    return c.json(e.body, e.status);
  }
  const user = { id: randomUUID(), email, password, name };
  users.set(email, user);
  return openSession(c, user);
});

authApp.post("/sign-in/email", async (c) => {
  const { email, password } = await c.req.json();
  const user = users.get(email);
  if (!user || user.password !== password) {
    const e = error("INVALID_EMAIL_OR_PASSWORD", 401);
    return c.json(e.body, e.status);
  }
  return openSession(c, user);
});

authApp.get("/token", async (c) => {
  const userId = sessions.get(getCookie(c, COOKIE) ?? "");
  const user = [...users.values()].find((u) => u.id === userId);
  if (!user) return c.json({ code: "UNAUTHORIZED" }, 401);
  const token = await new SignJWT({ email: user.email, emailVerified: true })
    .setProtectedHeader({ alg: "EdDSA", kid: "dev" })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(privateKey);
  return c.json({ token });
});

authApp.post("/sign-out", (c) => {
  sessions.delete(getCookie(c, COOKIE) ?? "");
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ success: true });
});
authApp.post("/send-verification-email", (c) => c.json({ status: true }));
authApp.post("/request-password-reset", (c) => c.json({ status: true }));
authApp.post("/reset-password", (c) => c.json({ status: true }));

const root = new Hono();
// Le navigateur (expo web) envoie le cookie de session : CORS avec identifiants.
root.use("*", cors({ origin: (o) => o, credentials: true, allowHeaders: ["content-type", "authorization"] }));
root.route("/auth", authApp);
// Images du contenu de démonstration (en production : stockage objet Neon, Plan 4).
root.use("/images/*", serveStatic({ root: "../db/seed", rewriteRequestPath: (p) => p }));
root.route("/", api);

serve({ fetch: root.fetch, port: PORT });
console.log(`API de développement sur ${ISSUER} (auth factice : ${ISSUER}/auth)`);
