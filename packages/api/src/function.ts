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

const authBaseUrl = required("NEON_AUTH_BASE_URL");
// Neon injecte NEON_AUTH_JWKS_URL ; repli sur l'adresse standard de Neon Auth si elle manque.
const jwksUrl = process.env.NEON_AUTH_JWKS_URL ?? `${authBaseUrl.replace(/\/$/, "")}/.well-known/jwks.json`;

export default createApp({
  db: pool,
  verifyToken: createTokenVerifier({
    keys: createRemoteJWKSet(new URL(jwksUrl)),
    issuer: new URL(authBaseUrl).origin,
  }),
  // Sans clé d'API, tout fonctionne sauf la suppression de compte (502 « réessayez »).
  authAdmin: process.env.NEON_API_KEY
    ? createNeonAuthAdmin({
        apiKey: process.env.NEON_API_KEY,
        projectId: required("NEON_PROJECT_ID"),
        branchId: required("NEON_BRANCH_ID"),
      })
    : {
        async deleteUser() {
          throw new Error("NEON_API_KEY non configurée : suppression de compte indisponible");
        },
      },
  requireVerifiedEmail: process.env.REQUIRE_VERIFIED_EMAIL !== "false",
  imagesBaseUrl: process.env.IMAGES_BASE_URL ?? null,
});
