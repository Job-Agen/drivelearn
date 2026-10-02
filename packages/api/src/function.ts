import { attachDatabasePool } from "@neon/functions";
import { createRemoteJWKSet } from "jose";
import pg from "pg";
import { createApp } from "./app.js";
import { createTokenVerifier } from "./auth.js";
import { createNeonAuthAdmin } from "./neon-auth-admin.js";
import { createPayGate } from "./paygate.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

// Créé une fois par isolate et réutilisé entre les requêtes.
const pool = new pg.Pool({ connectionString: required("DATABASE_URL"), max: 5 });
attachDatabasePool(pool);

const authBaseUrl = required("NEON_AUTH_BASE_URL");
// Neon injecte NEON_AUTH_JWKS_URL ; repli sur l'adresse standard de Neon Auth si elle manque.
const jwksUrl = process.env.NEON_AUTH_JWKS_URL ?? `${authBaseUrl.replace(/\/$/, "")}/.well-known/jwks.json`;

export default createApp({
  db: pool,
  verifyToken: createTokenVerifier({
    keys: createRemoteJWKSet(new URL(jwksUrl)),
    issuer: new URL(authBaseUrl).origin,
  }),
  authAdmin: createNeonAuthAdmin({
    apiKey: required("NEON_API_KEY"),
    projectId: required("NEON_PROJECT_ID"),
    branchId: required("NEON_BRANCH_ID"),
  }),
  requireVerifiedEmail: process.env.REQUIRE_VERIFIED_EMAIL !== "false",
  imagesBaseUrl: process.env.IMAGES_BASE_URL ?? null,
  gateway: createPayGate({ authToken: required("PAYGATE_AUTH_TOKEN") }),
});
