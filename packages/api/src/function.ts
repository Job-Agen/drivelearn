import { attachDatabasePool } from "@neon/functions";
import { createRemoteJWKSet } from "jose";
import pg from "pg";
import { createApp } from "./app.js";
import { createTokenVerifier } from "./auth.js";
import { createNeonAuthAdmin } from "./neon-auth-admin.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

// Créé une fois par isolate et réutilisé entre les requêtes.
const pool = new pg.Pool({ connectionString: required("DATABASE_URL"), max: 5 });
attachDatabasePool(pool);

export default createApp({
  db: pool,
  verifyToken: createTokenVerifier({
    keys: createRemoteJWKSet(new URL(required("NEON_AUTH_JWKS_URL"))),
    issuer: new URL(required("NEON_AUTH_BASE_URL")).origin,
  }),
  authAdmin: createNeonAuthAdmin({
    apiKey: required("NEON_API_KEY"),
    projectId: required("NEON_PROJECT_ID"),
    branchId: required("NEON_BRANCH_ID"),
  }),
  requireVerifiedEmail: process.env.REQUIRE_VERIFIED_EMAIL !== "false",
  imagesBaseUrl: process.env.IMAGES_BASE_URL ?? null,
});
