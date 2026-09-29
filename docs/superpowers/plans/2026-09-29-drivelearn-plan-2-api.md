# DriveLearn — Plan 2 : API élève sur Neon Functions — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire et déployer l'API HTTP de l'application élève (profil, contenu hors ligne, séances, révision, progrès, examens blancs, signalements, suppression de compte) sur Neon Functions, sécurisée par les jetons Neon Auth.

**Architecture:** Une application Hono (`packages/api`) construite par une fabrique `createApp(deps)` : base de données, vérificateur de jeton et suppression de compte Neon Auth sont injectés. En test, on injecte une transaction Postgres annulée à la fin et des clés de signature locales. En production, `src/function.ts` injecte un `pg.Pool`, la JWKS de Neon Auth et l'API de gestion Neon. Toute la logique métier reste dans les fonctions SQL du Plan 1 ; l'API authentifie, valide les entrées, appelle ces fonctions et traduit leurs erreurs en réponses HTTP en français.

**Tech Stack:** Node 24, TypeScript, Hono, `pg`, `jose` (EdDSA), `zod` 4, Vitest, Neon Functions (`@neon/functions`, `@neon/config`), Neon Auth (Managed Better Auth).

**Spec:** `docs/superpowers/specs/2026-09-27-drivelearn-design.md`
**S'appuie sur :** Plan 1 (`packages/db`, migrations 0001–0007).

## Constats du test préalable (29/09/2026)

Projet Neon créé : **DriveLearn**, id `young-river-14219375`, région `aws-eu-central-1`, Postgres 17, branche `main` = `br-flat-lake-b12cfxtb`. Neon Auth activé :
- `NEON_AUTH_BASE_URL` = `https://ep-small-glade-b1t7owsk.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth`
- Émetteur des jetons (`iss`) = origine de cette URL. Jetons EdDSA, valables 15 minutes. `sub` = identifiant utilisateur, avec les champs `email` et `emailVerified`.

Résultats, depuis un client qui n'est pas un navigateur (Node) :
- **Sans en-tête `Origin` : refusé** (`MISSING_OR_NULL_ORIGIN`).
- **Avec une origine absente des domaines de confiance : refusé** (`INVALID_ORIGIN`).
- **Avec une origine de confiance : tout fonctionne** : inscription, connexion, `GET /token`, vérification du JWT. **L'application mobile enverra donc `Origin: https://app.drivelearn.tg`** (constante `APP_ORIGIN`), déclarée comme domaine de confiance.
- **L'élève ne peut pas supprimer son compte lui-même** : `POST /delete-user` répond 404. La suppression passe par l'API de gestion Neon, `DELETE /api/v2/projects/{project}/branches/{branch}/auth/users/{id}`, avec une clé d'API, et fonctionne (utilisateur et sessions supprimés).
- Réglages par défaut constatés :
  - vérification d'e-mail désactivée ;
  - localhost autorisé ;
  - domaine de test `https://app.drivelearn.test` encore présent (à retirer à la Task 6) ;
  - fournisseur Google partagé présent (hors spec, laissé pour le Plan 7).

## Global Constraints

- L'identité de l'élève vient **uniquement** du `sub` d'un JWT vérifié. Vérification : signature par la JWKS, émetteur égal à l'origine de `NEON_AUTH_BASE_URL`, expiration.
- Si `requireVerifiedEmail` est vrai (production : `REQUIRE_VERIFIED_EMAIL=true`), un jeton dont `emailVerified` n'est pas `true` reçoit `403 email_not_verified`.
- Réponses d'erreur toujours au format JSON `{ "error": "<code>", "message": "<phrase en français>" }`. Aucune trace de pile ni de message SQL n'est renvoyée au client.
- Aucune transaction explicite dans l'API : chaque requête SQL est atomique d'elle-même. Les fonctions SQL du Plan 1 portent la cohérence.
- `pg.Pool` avec `max: 5`, créé une seule fois par isolate, suivi d'`attachDatabasePool(pool)`. On n'utilise pas `@neondatabase/serverless`.
- Pas de CORS : le client est une application native.
- Function : slug `api`, Node 24, projet `young-river-14219375`, branche `br-flat-lake-b12cfxtb`.
- Les secrets (`NEON_API_KEY`, chaînes de connexion) restent dans des fichiers `.env*` ignorés par git. Aucune commande ne les affiche.
- Toutes les routes élève sont sous `/v1`. `GET /health` est publique.

## Review Focus

1. **Jeton expiré, signé par une autre clé ou d'un autre émetteur** → `401`, jamais de données. Testé dans la Task 1.
2. **Lot de séances hors ligne dont une porte sur une question retirée entre-temps** → les autres sont enregistrées ; celle-là est marquée `rejected` pour que l'app arrête de la renvoyer (pas de `500`). Testé dans la Task 4.
3. **Suppression de compte quand l'appel à Neon Auth échoue** → `502` avec un message « réessayez » ; un nouvel essai après reconnexion aboutit. Testé dans la Task 2.
4. **Élève qui n'a pas encore choisi son pays ou son permis** et demande le contenu ou un examen → `409 program_not_selected` explicite. Testé dans les Tasks 3 et 5.
5. **Identifiant mal formé dans l'URL** (`/v1/exams/abc`) → `400 invalid_input`, pas `500`. Testé dans la Task 5.

---

## Structure des fichiers

```
drivelearn/
  neon.ts                                  # Task 6 : services Neon (auth, function api)
  packages/db/migrations/0008_content_export.sql   # Task 3 : get_program_content
  packages/api/
    package.json                           # @drivelearn/api
    tsconfig.json
    vitest.config.ts                       # réutilise la préparation de base de packages/db
    src/
      types.ts                             # Deps, Queryable, AppEnv
      errors.ts                            # HttpError, traduction des erreurs SQL
      auth.ts                              # vérificateur de jeton, middleware
      neon-auth-admin.ts                   # suppression d'utilisateur via l'API Neon
      db.ts                                # aides de requête (row, requireProgram)
      app.ts                               # createApp(deps)
      routes/me.ts                         # profil, code promo, suppression de compte
      routes/content.ts                    # programmes, contenu hors ligne
      routes/practice.ts                   # séances, révision, progrès
      routes/exams.ts                      # examens blancs
      routes/reports.ts                    # signalements
      function.ts                          # point d'entrée Neon Functions (production)
    scripts/smoke.ts                       # Task 6 : essai de bout en bout sur l'API déployée
    test/
      helpers.ts                           # jetons de test, application de test dans une transaction
      errors.test.ts
      auth.test.ts
      me.test.ts
      neon-auth-admin.test.ts
      content.test.ts
      practice.test.ts
      exams.test.ts
      reports.test.ts
```

**Commande de test de la tâche :** `npm test -w @drivelearn/api`. Elle démarre le Postgres embarqué du Plan 1 via sa préparation, et applique toutes les migrations, y compris 0008.

---

### Task 1 : Paquet API, erreurs et authentification

**Files:**
- Create: `packages/api/package.json`, `packages/api/tsconfig.json`, `packages/api/vitest.config.ts`
- Create: `packages/api/src/types.ts`, `src/errors.ts`, `src/auth.ts`, `src/db.ts`, `src/app.ts`, `src/routes/me.ts` (route `GET /` seulement)
- Test: `packages/api/test/helpers.ts`, `test/errors.test.ts`, `test/auth.test.ts`

**Interfaces:**
- Consumes: `ensure_profile(p_user_id text, p_email text)` (Plan 1) ; `withTx`, type `Db` de `packages/db/test/helpers.ts`
- Produces:
  - `type Queryable = { query(text: string, values?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }> }`
  - `type Identity = { userId: string; email: string | null; emailVerified: boolean }`
  - `type TokenVerifier = (token: string) => Promise<Identity>`
  - `type AuthAdmin = { deleteUser(userId: string): Promise<void> }`
  - `type Deps = { db: Queryable; verifyToken: TokenVerifier; authAdmin: AuthAdmin; requireVerifiedEmail: boolean; imagesBaseUrl: string | null }`
  - `type AppEnv = { Variables: { userId: string } }`
  - `class HttpError(status, code, message)` ; `toHttpError(err: unknown): HttpError`
  - `createTokenVerifier({ keys: JWTVerifyGetKey, issuer: string }): TokenVerifier` ; `authMiddleware(deps)`
  - `row<T>(db, sql, values?): Promise<T | undefined>` ; `requireProgram(db, userId): Promise<string>`
  - `createApp(deps: Deps): Hono<AppEnv>`
  - Test : `withApp(fn, opts?)`, `signToken(userId, opts?)`, `TestApi.request(method, path, { user?, token?, body? })` qui renvoie `{ status, body }`, et `TestApi.deleted: string[]`

- [ ] **Step 1 : Créer le paquet**

`packages/api/package.json` :

```json
{
  "name": "@drivelearn/api",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "smoke": "tsx scripts/smoke.ts"
  }
}
```

Run: `npm install -w @drivelearn/api hono pg jose zod@4 @neon/functions` puis `npm install -w @drivelearn/api -D vitest typescript tsx @types/pg @types/node`
Expected: dépendances ajoutées, aucune erreur.

`packages/api/tsconfig.json` :

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src", "test", "scripts", "vitest.config.ts"]
}
```

`packages/api/vitest.config.ts` :

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Même base de test que packages/db : Postgres embarqué, schéma remis à zéro, migrations appliquées.
    globalSetup: ["../db/test/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
```

- [ ] **Step 2 : Écrire les aides de test**

`packages/api/test/helpers.ts` :

```ts
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { withTx, type Db } from "../../db/test/helpers.js";
import { createApp } from "../src/app.js";
import { createTokenVerifier } from "../src/auth.js";
import type { Queryable } from "../src/types.js";

export const TEST_ISSUER = "https://auth.drivelearn.test";

const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
const jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: "test", alg: "EdDSA" }] });

export async function signToken(
  userId: string,
  opts: { emailVerified?: boolean; expiresAt?: number; issuer?: string; key?: CryptoKey } = {},
): Promise<string> {
  return new SignJWT({ email: `${userId}@test.tg`, emailVerified: opts.emailVerified ?? true })
    .setProtectedHeader({ alg: "EdDSA", kid: "test" })
    .setSubject(userId)
    .setIssuer(opts.issuer ?? TEST_ISSUER)
    .setIssuedAt()
    .setExpirationTime(opts.expiresAt ?? "15m")
    .sign(opts.key ?? privateKey);
}

/** Chaque requête dans son point de sauvegarde : une erreur SQL n'empoisonne pas la transaction de test,
 *  comme en production où chaque requête est atomique d'elle-même. */
function statementAtomic(db: Db): Queryable {
  return {
    async query(text, values) {
      await db.query("savepoint api_stmt");
      try {
        const result = await db.query(text, values);
        await db.query("release savepoint api_stmt");
        return result;
      } catch (error) {
        await db.query("rollback to savepoint api_stmt");
        throw error;
      }
    },
  };
}

export type TestResponse = { status: number; body: any };
export type TestApi = {
  request(
    method: string,
    path: string,
    opts?: { user?: string; token?: string; body?: unknown },
  ): Promise<TestResponse>;
  deleted: string[];
};

/** Application complète branchée sur une transaction annulée à la fin du test. */
export function withApp<T>(
  fn: (api: TestApi, db: Db) => Promise<T>,
  opts: { requireVerifiedEmail?: boolean; failAuthDelete?: boolean } = {},
): Promise<T> {
  return withTx(async (db) => {
    const deleted: string[] = [];
    const app = createApp({
      db: statementAtomic(db),
      verifyToken: createTokenVerifier({ keys: jwks, issuer: TEST_ISSUER }),
      authAdmin: {
        async deleteUser(userId) {
          if (opts.failAuthDelete) throw new Error("Neon Auth indisponible");
          deleted.push(userId);
        },
      },
      requireVerifiedEmail: opts.requireVerifiedEmail ?? true,
      imagesBaseUrl: "https://images.drivelearn.test",
    });
    const request: TestApi["request"] = async (method, path, o = {}) => {
      const headers: Record<string, string> = { "content-type": "application/json" };
      const token = o.token ?? (o.user ? await signToken(o.user) : undefined);
      if (token) headers.authorization = `Bearer ${token}`;
      const res = await app.request(path, {
        method,
        headers,
        body: o.body === undefined ? undefined : JSON.stringify(o.body),
      });
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) : null };
    };
    return fn({ request, deleted }, db);
  });
}
```

- [ ] **Step 3 : Écrire les tests qui échouent**

`packages/api/test/errors.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { HttpError, toHttpError } from "../src/errors.js";

describe("traduction des erreurs", () => {
  it("traduit une erreur métier SQL en statut et message français", () => {
    const e = toHttpError(Object.assign(new Error("pass_required"), { code: "P0001" }));
    expect({ status: e.status, code: e.code }).toEqual({ status: 402, code: "pass_required" });
    expect(e.message).toMatch(/Pass Examen/);
  });

  it("masque une erreur métier inconnue derrière une erreur interne", () => {
    const e = toHttpError(Object.assign(new Error("question_invalide: aucune leçon"), { code: "P0001" }));
    expect({ status: e.status, code: e.code }).toEqual({ status: 500, code: "internal_error" });
  });

  it("traduit une contrainte ou un format SQL invalide en 400", () => {
    for (const code of ["23514", "23503", "22P02", "22007"]) {
      expect(toHttpError(Object.assign(new Error("x"), { code })).status).toBe(400);
    }
  });

  it("traduit une erreur de validation zod en 400 invalid_input", () => {
    const result = z.object({ a: z.number() }).safeParse({ a: "x" });
    const e = toHttpError(result.error);
    expect({ status: e.status, code: e.code }).toEqual({ status: 400, code: "invalid_input" });
  });

  it("laisse passer une HttpError telle quelle", () => {
    const original = new HttpError(409, "program_not_selected", "Choisissez votre programme.");
    expect(toHttpError(original)).toBe(original);
  });
});
```

`packages/api/test/auth.test.ts` :

```ts
import { generateKeyPair } from "jose";
import { describe, expect, it } from "vitest";
import { scalar } from "../../db/test/helpers.js";
import { signToken, withApp } from "./helpers.js";

describe("authentification", () => {
  it("laisse /health public", () =>
    withApp(async (api) => {
      expect(await api.request("GET", "/health")).toEqual({ status: 200, body: { ok: true } });
    }));

  it("refuse une requête sans jeton", () =>
    withApp(async (api) => {
      const res = await api.request("GET", "/v1/me");
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("unauthorized");
    }));

  it("refuse un jeton signé par une autre clé", () =>
    withApp(async (api) => {
      const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
      const token = await signToken("user-a", { key: privateKey });
      expect((await api.request("GET", "/v1/me", { token })).status).toBe(401);
    }));

  it("refuse un jeton expiré ou d'un autre émetteur", () =>
    withApp(async (api) => {
      const expired = await signToken("user-a", { expiresAt: Math.floor(Date.now() / 1000) - 60 });
      const foreign = await signToken("user-a", { issuer: "https://ailleurs.test" });
      expect((await api.request("GET", "/v1/me", { token: expired })).status).toBe(401);
      expect((await api.request("GET", "/v1/me", { token: foreign })).status).toBe(401);
    }));

  it("exige une adresse e-mail vérifiée quand c'est demandé", () =>
    withApp(async (api) => {
      const token = await signToken("user-a", { emailVerified: false });
      const res = await api.request("GET", "/v1/me", { token });
      expect({ status: res.status, error: res.body.error }).toEqual({ status: 403, error: "email_not_verified" });
    }));

  it("accepte une adresse non vérifiée quand ce n'est pas demandé", () =>
    withApp(
      async (api) => {
        const token = await signToken("user-a", { emailVerified: false });
        expect((await api.request("GET", "/v1/me", { token })).status).toBe(200);
      },
      { requireVerifiedEmail: false },
    ));

  it("crée le profil à la première requête authentifiée", () =>
    withApp(async (api, db) => {
      const res = await api.request("GET", "/v1/me", { user: "user-a" });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe("user-a@test.tg");
      expect(await scalar<number>(db, "select count(*)::int from profiles where id = 'user-a'")).toBe(1);
    }));

  it("répond 404 en JSON sur une route inconnue", () =>
    withApp(async (api) => {
      const res = await api.request("GET", "/v1/inexistant", { user: "user-a" });
      expect({ status: res.status, error: res.body.error }).toEqual({ status: 404, error: "not_found" });
    }));
});
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -w @drivelearn/api`
Expected: échec au chargement, `Cannot find module '../src/errors.js'` (et `../src/app.js`).

- [ ] **Step 5 : Écrire le code**

`packages/api/src/types.ts` :

```ts
export type Queryable = {
  query(text: string, values?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
};

export type Identity = { userId: string; email: string | null; emailVerified: boolean };
export type TokenVerifier = (token: string) => Promise<Identity>;
export type AuthAdmin = { deleteUser(userId: string): Promise<void> };

export type Deps = {
  db: Queryable;
  verifyToken: TokenVerifier;
  authAdmin: AuthAdmin;
  requireVerifiedEmail: boolean;
  imagesBaseUrl: string | null;
};

export type AppEnv = { Variables: { userId: string } };
```

`packages/api/src/errors.ts` :

```ts
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// Erreurs levées par les fonctions SQL du Plan 1 (raise exception '<code>')
const BUSINESS_ERRORS: Record<string, [number, string]> = {
  profile_not_found: [404, "Profil introuvable."],
  program_not_found: [404, "Programme introuvable."],
  exam_not_found: [404, "Examen introuvable."],
  pass_required: [402, "Un Pass Examen est nécessaire pour passer un autre examen blanc."],
  not_enough_questions: [409, "Pas encore assez de questions pour composer un examen blanc."],
  exam_closed: [409, "Cet examen est terminé."],
  question_not_in_exam: [400, "Cette question ne fait pas partie de l'examen."],
  session_conflict: [409, "Cette séance appartient à un autre compte."],
  invalid_session: [400, "Séance incomplète."],
  invalid_answers: [400, "La séance ne contient aucune réponse."],
  unknown_question: [422, "Cette question n'est plus disponible."],
  invalid_promo_code: [400, "Code promo invalide."],
  promo_locked: [409, "Le code promo ne peut plus être modifié après un achat."],
  too_many_reports: [429, "Trop de signalements aujourd'hui. Réessayez demain."],
};

const INVALID_INPUT_SQLSTATES = new Set(["23514", "23503", "22P02", "22007", "22008"]);

export function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (err instanceof ZodError) return new HttpError(400, "invalid_input", "Données invalides.");
  const pgError = err as { code?: string; message?: string };
  if (pgError?.code === "P0001" && pgError.message && pgError.message in BUSINESS_ERRORS) {
    const [status, message] = BUSINESS_ERRORS[pgError.message];
    return new HttpError(status, pgError.message, message);
  }
  if (pgError?.code && INVALID_INPUT_SQLSTATES.has(pgError.code)) {
    return new HttpError(400, "invalid_input", "Données invalides.");
  }
  return new HttpError(500, "internal_error", "Erreur interne. Réessayez plus tard.");
}
```

`packages/api/src/auth.ts` :

```ts
import type { MiddlewareHandler } from "hono";
import { jwtVerify, type JWTVerifyGetKey } from "jose";
import { HttpError } from "./errors.js";
import type { AppEnv, Deps, Identity, TokenVerifier } from "./types.js";

export function createTokenVerifier(opts: { keys: JWTVerifyGetKey; issuer: string }): TokenVerifier {
  return async (token) => {
    const { payload } = await jwtVerify(token, opts.keys, { issuer: opts.issuer });
    if (!payload.sub) throw new Error("Jeton sans sujet");
    return {
      userId: payload.sub,
      email: typeof payload.email === "string" ? payload.email : null,
      emailVerified: payload.emailVerified === true,
    };
  };
}

export function authMiddleware(deps: Deps): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const header = c.req.header("authorization");
    if (!header?.toLowerCase().startsWith("bearer ")) {
      throw new HttpError(401, "unauthorized", "Connexion requise.");
    }
    let identity: Identity;
    try {
      identity = await deps.verifyToken(header.slice(7).trim());
    } catch {
      throw new HttpError(401, "unauthorized", "Session expirée. Reconnectez-vous.");
    }
    if (deps.requireVerifiedEmail && !identity.emailVerified) {
      throw new HttpError(403, "email_not_verified", "Vérifiez votre adresse e-mail pour continuer.");
    }
    await deps.db.query("select ensure_profile($1, $2)", [identity.userId, identity.email]);
    c.set("userId", identity.userId);
    await next();
  };
}
```

`packages/api/src/db.ts` :

```ts
import { HttpError } from "./errors.js";
import type { Queryable } from "./types.js";

export async function row<T = any>(db: Queryable, sql: string, values: unknown[] = []): Promise<T | undefined> {
  const { rows } = await db.query(sql, values);
  return rows[0] as T | undefined;
}

/** Programme choisi par l'élève (pays + permis), obligatoire pour le contenu et les examens. */
export async function requireProgram(db: Queryable, userId: string): Promise<string> {
  const profile = await row<{ program_id: string | null }>(db, "select program_id from profiles where id = $1", [userId]);
  if (!profile?.program_id) {
    throw new HttpError(409, "program_not_selected", "Choisissez d'abord votre pays et votre permis.");
  }
  return profile.program_id;
}
```

`packages/api/src/routes/me.ts` :

```ts
import { Hono } from "hono";
import { row } from "../db.js";
import type { AppEnv, Deps } from "../types.js";

export async function getMe(deps: Deps, userId: string) {
  return row(
    deps.db,
    `select p.id, p.email, p.first_name, p.program_id, p.daily_goal_minutes, p.reminder_enabled,
            to_char(p.reminder_time, 'HH24:MI') as reminder_time, s.name as driving_school_name
     from profiles p left join driving_schools s on s.id = p.driving_school_id
     where p.id = $1`,
    [userId],
  );
}

export function meRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();
  r.get("/", async (c) => c.json(await getMe(deps, c.get("userId"))));
  return r;
}
```

`packages/api/src/app.ts` :

```ts
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware } from "./auth.js";
import { toHttpError } from "./errors.js";
import { meRoutes } from "./routes/me.js";
import type { AppEnv, Deps } from "./types.js";

export function createApp(deps: Deps) {
  const app = new Hono<AppEnv>();

  app.get("/health", (c) => c.json({ ok: true }));

  const v1 = new Hono<AppEnv>();
  v1.use("*", authMiddleware(deps));
  v1.route("/me", meRoutes(deps));
  app.route("/v1", v1);

  app.notFound((c) => c.json({ error: "not_found", message: "Ressource introuvable." }, 404));
  app.onError((err, c) => {
    const e = toHttpError(err);
    if (e.status >= 500) console.error(err);
    return c.json({ error: e.code, message: e.message }, e.status as ContentfulStatusCode);
  });

  return app;
}
```

- [ ] **Step 6 : Lancer les tests**

Run: `npm test -w @drivelearn/api` puis `npm run typecheck -w @drivelearn/api`
Expected: `errors.test.ts` et `auth.test.ts` passent, aucune erreur TypeScript.

- [ ] **Step 7 : Commit**

```bash
git add package-lock.json packages/api
git commit -m "feat(api): paquet API, erreurs et authentification par jeton Neon Auth"
```

---

### Task 2 : Profil, code promo et suppression de compte

**Files:**
- Modify: `packages/api/src/routes/me.ts`
- Create: `packages/api/src/neon-auth-admin.ts`
- Test: `packages/api/test/me.test.ts`, `packages/api/test/neon-auth-admin.test.ts`

**Interfaces:**
- Consumes: `set_promo_code`, `delete_account` (Plan 1) ; `getMe`, `row`, `HttpError` (Task 1)
- Produces:
  - `GET /v1/me` → `{ id, email, first_name, program_id, daily_goal_minutes, reminder_enabled, reminder_time: "HH:MM", driving_school_name }`
  - `PATCH /v1/me`, corps partiel strict `{ first_name?, program_id?, daily_goal_minutes?: 5|10|15, reminder_enabled?, reminder_time?: "HH:MM", push_token? }` → profil mis à jour. Un programme non publié donne `400 program_not_available`.
  - `POST /v1/me/promo-code` `{ code: string | null }` → `{ driving_school_name }`
  - `DELETE /v1/me` → `204`. Supprime les données, puis l'utilisateur Neon Auth ; si Neon Auth échoue : `502 auth_delete_failed`.
  - `createNeonAuthAdmin({ apiKey, projectId, branchId, fetch? }): AuthAdmin`

- [ ] **Step 1 : Écrire les tests qui échouent**

`packages/api/test/me.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createPath, scalar } from "../../db/test/helpers.js";
import { withApp } from "./helpers.js";

describe("profil", () => {
  it("renvoie le profil avec les préférences par défaut", () =>
    withApp(async (api) => {
      const res = await api.request("GET", "/v1/me", { user: "user-a" });
      expect(res.body).toMatchObject({
        id: "user-a",
        first_name: null,
        program_id: null,
        daily_goal_minutes: 5,
        reminder_enabled: true,
        reminder_time: "19:00",
        driving_school_name: null,
      });
    }));

  it("met à jour les préférences", () =>
    withApp(async (api) => {
      const res = await api.request("PATCH", "/v1/me", {
        user: "user-a",
        body: { first_name: "Ama", daily_goal_minutes: 10, reminder_enabled: false, reminder_time: "20:30" },
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ first_name: "Ama", daily_goal_minutes: 10, reminder_enabled: false, reminder_time: "20:30" });
    }));

  it("refuse un objectif invalide, une heure invalide ou un champ inconnu", () =>
    withApp(async (api) => {
      for (const body of [{ daily_goal_minutes: 7 }, { reminder_time: "25:00" }, { is_admin: true }]) {
        const res = await api.request("PATCH", "/v1/me", { user: "user-a", body });
        expect({ status: res.status, error: res.body.error }).toEqual({ status: 400, error: "invalid_input" });
      }
    }));

  it("n'accepte qu'un programme publié", () =>
    withApp(async (api, db) => {
      const { programId } = await createPath(db);
      const refused = await api.request("PATCH", "/v1/me", { user: "user-a", body: { program_id: programId } });
      expect({ status: refused.status, error: refused.body.error }).toEqual({ status: 400, error: "program_not_available" });

      await db.query("update programs set status = 'publie' where id = $1", [programId]);
      const accepted = await api.request("PATCH", "/v1/me", { user: "user-a", body: { program_id: programId } });
      expect(accepted.body.program_id).toBe(programId);
    }));
});

describe("code promo", () => {
  it("rattache l'élève à une auto-école", () =>
    withApp(async (api, db) => {
      await db.query("insert into driving_schools (name, promo_code) values ('Auto-école Le Volant', 'VOLANT')");
      const res = await api.request("POST", "/v1/me/promo-code", { user: "user-a", body: { code: "volant" } });
      expect(res.body).toEqual({ driving_school_name: "Auto-école Le Volant" });
      expect((await api.request("GET", "/v1/me", { user: "user-a" })).body.driving_school_name).toBe("Auto-école Le Volant");
    }));

  it("refuse un code inconnu", () =>
    withApp(async (api) => {
      const res = await api.request("POST", "/v1/me/promo-code", { user: "user-a", body: { code: "INCONNU" } });
      expect({ status: res.status, error: res.body.error }).toEqual({ status: 400, error: "invalid_promo_code" });
    }));
});

describe("suppression de compte", () => {
  it("supprime les données puis le compte Neon Auth", () =>
    withApp(async (api, db) => {
      await api.request("GET", "/v1/me", { user: "user-a" });
      const res = await api.request("DELETE", "/v1/me", { user: "user-a" });
      expect(res.status).toBe(204);
      expect(api.deleted).toEqual(["user-a"]);
      expect(await scalar<number>(db, "select count(*)::int from profiles where id = 'user-a'")).toBe(0);
    }));

  it("demande de réessayer si Neon Auth ne répond pas, et l'essai suivant aboutit", async () => {
    await withApp(
      async (api) => {
        const res = await api.request("DELETE", "/v1/me", { user: "user-a" });
        expect({ status: res.status, error: res.body.error }).toEqual({ status: 502, error: "auth_delete_failed" });
        expect(res.body.message).toMatch(/Réessayez/);
      },
      { failAuthDelete: true },
    );
    await withApp(async (api) => {
      expect((await api.request("DELETE", "/v1/me", { user: "user-a" })).status).toBe(204);
    });
  });
});
```

`packages/api/test/neon-auth-admin.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createNeonAuthAdmin } from "../src/neon-auth-admin.js";

function fakeFetch(status: number) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(null, { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

describe("suppression d'un utilisateur Neon Auth", () => {
  it("appelle l'API de gestion Neon avec la clé", async () => {
    const f = fakeFetch(200);
    await createNeonAuthAdmin({ apiKey: "cle", projectId: "proj", branchId: "br-1", fetch: f.fn }).deleteUser("u 1");
    expect(f.calls[0].url).toBe("https://console.neon.tech/api/v2/projects/proj/branches/br-1/auth/users/u%201");
    expect(f.calls[0].init.method).toBe("DELETE");
    expect((f.calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer cle");
  });

  it("considère un utilisateur déjà absent comme supprimé", async () => {
    const f = fakeFetch(404);
    await expect(createNeonAuthAdmin({ apiKey: "k", projectId: "p", branchId: "b", fetch: f.fn }).deleteUser("u")).resolves.toBeUndefined();
  });

  it("signale un refus de Neon", async () => {
    const f = fakeFetch(500);
    await expect(createNeonAuthAdmin({ apiKey: "k", projectId: "p", branchId: "b", fetch: f.fn }).deleteUser("u")).rejects.toThrow("500");
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -w @drivelearn/api`
Expected: `neon-auth-admin.test.ts` échoue au chargement (`Cannot find module '../src/neon-auth-admin.js'`) ; `me.test.ts` échoue sur `PATCH /v1/me` (404) et les routes manquantes.

- [ ] **Step 3 : Écrire le code**

`packages/api/src/neon-auth-admin.ts` :

```ts
import type { AuthAdmin } from "./types.js";

/** Suppression d'un compte via l'API de gestion Neon (l'élève ne peut pas le faire lui-même avec Neon Auth). */
export function createNeonAuthAdmin(opts: {
  apiKey: string;
  projectId: string;
  branchId: string;
  fetch?: typeof fetch;
}): AuthAdmin {
  const doFetch = opts.fetch ?? fetch;
  return {
    async deleteUser(userId) {
      const url = `https://console.neon.tech/api/v2/projects/${opts.projectId}/branches/${opts.branchId}/auth/users/${encodeURIComponent(userId)}`;
      const res = await doFetch(url, {
        method: "DELETE",
        headers: { authorization: `Bearer ${opts.apiKey}`, accept: "application/json" },
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(`Neon Auth a refusé la suppression (${res.status})`);
      }
    },
  };
}
```

`packages/api/src/routes/me.ts` (remplace le fichier) :

```ts
import { Hono } from "hono";
import { z } from "zod";
import { row } from "../db.js";
import { HttpError } from "../errors.js";
import type { AppEnv, Deps } from "../types.js";

const PatchMe = z.strictObject({
  first_name: z.string().trim().max(40).nullable().optional(),
  program_id: z.uuid().nullable().optional(),
  daily_goal_minutes: z.literal([5, 10, 15]).optional(),
  reminder_enabled: z.boolean().optional(),
  reminder_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  push_token: z.string().max(200).nullable().optional(),
});

const PromoCode = z.strictObject({ code: z.string().max(20).nullable() });

export async function getMe(deps: Deps, userId: string) {
  return row(
    deps.db,
    `select p.id, p.email, p.first_name, p.program_id, p.daily_goal_minutes, p.reminder_enabled,
            to_char(p.reminder_time, 'HH24:MI') as reminder_time, s.name as driving_school_name
     from profiles p left join driving_schools s on s.id = p.driving_school_id
     where p.id = $1`,
    [userId],
  );
}

export function meRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();

  r.get("/", async (c) => c.json(await getMe(deps, c.get("userId"))));

  r.patch("/", async (c) => {
    const userId = c.get("userId");
    const body = PatchMe.parse(await c.req.json());

    if (body.program_id) {
      const program = await row(deps.db, "select 1 from programs where id = $1 and status = 'publie'", [body.program_id]);
      if (!program) throw new HttpError(400, "program_not_available", "Ce programme n'est pas encore disponible.");
    }

    // Les clés viennent d'un schéma strict : seules les colonnes ci-dessus peuvent apparaître.
    const entries = Object.entries(body).filter(([, value]) => value !== undefined);
    if (entries.length > 0) {
      const assignments = entries.map(([key], i) => `${key} = $${i + 2}`).join(", ");
      await deps.db.query(`update profiles set ${assignments} where id = $1`, [userId, ...entries.map(([, v]) => v)]);
    }
    return c.json(await getMe(deps, userId));
  });

  r.post("/promo-code", async (c) => {
    const { code } = PromoCode.parse(await c.req.json());
    const result = await row<{ name: string | null }>(deps.db, "select set_promo_code($1, $2) as name", [
      c.get("userId"),
      code,
    ]);
    return c.json({ driving_school_name: result?.name ?? null });
  });

  r.delete("/", async (c) => {
    const userId = c.get("userId");
    // Données d'abord : si Neon Auth échoue ensuite, l'élève peut se reconnecter et recommencer.
    await deps.db.query("select delete_account($1)", [userId]);
    try {
      await deps.authAdmin.deleteUser(userId);
    } catch (error) {
      console.error(error);
      throw new HttpError(502, "auth_delete_failed", "La suppression n'a pas pu aboutir. Réessayez dans un instant.");
    }
    return c.body(null, 204);
  });

  return r;
}
```

- [ ] **Step 4 : Lancer les tests**

Run: `npm test -w @drivelearn/api` puis `npm run typecheck -w @drivelearn/api`
Expected: tous les fichiers passent.

- [ ] **Step 5 : Commit**

```bash
git add packages/api
git commit -m "feat(api): profil, code promo et suppression de compte"
```

---

### Task 3 : Programmes et contenu hors ligne

**Files:**
- Create: `packages/db/migrations/0008_content_export.sql`
- Create: `packages/api/src/routes/content.ts`
- Modify: `packages/api/src/app.ts` (monter les routes)
- Test: `packages/api/test/content.test.ts`

**Interfaces:**
- Consumes: tables du contenu, `content_version`, `setting_int` (Plan 1) ; `requireProgram` (Task 1)
- Produces:
  - SQL `get_program_content(p_program_id uuid) returns jsonb` : `{ program: { id, name, exam_question_count, exam_pass_mark, exam_seconds_per_question }, units: [{ id, title, position, lessons: [{ id, title, position, intro_title, intro_text, intro_image_path, mentor_tip, questions: [{ id, prompt, image_path, explanation, multiple, choices: [{ id, label, is_correct }] }] }] }] }`. Seules les questions `validee` sont incluses, ainsi que les leçons et unités qui en contiennent.
  - `GET /v1/programs` → `[{ id, country_code, license_type, name, available }]`, où `available` correspond au statut `publie`
  - `GET /v1/content?version=<n>` → `{ changed: false, version }` si l'app est à jour, sinon `{ changed: true, version, images_base_url, max_review_per_lesson, content }`

- [ ] **Step 1 : Écrire le test qui échoue**

`packages/api/test/content.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createLesson, createPath, createQuestion, type Db } from "../../db/test/helpers.js";
import { withApp } from "./helpers.js";

async function publishedProgram(db: Db) {
  const path = await createPath(db);
  await db.query("update programs set status = 'publie' where id = $1", [path.programId]);
  const single = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, status: "validee" });
  const multi = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, correct: 2, wrong: 1, status: "validee" });
  await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId }); // brouillon : invisible
  const emptyLesson = await createLesson(db, path.unitId, 2); // aucune question validée : invisible
  await createQuestion(db, { unitId: path.unitId, lessonId: emptyLesson });
  return { ...path, single, multi };
}

describe("programmes", () => {
  it("liste les programmes et indique ceux qui sont disponibles", () =>
    withApp(async (api, db) => {
      const { programId } = await createPath(db);
      const before = await api.request("GET", "/v1/programs", { user: "user-a" });
      expect(before.body).toEqual([
        { id: programId, country_code: "TG", license_type: "voiture", name: "Togo — Permis voiture", available: false },
      ]);
      await db.query("update programs set status = 'publie' where id = $1", [programId]);
      expect((await api.request("GET", "/v1/programs", { user: "user-a" })).body[0].available).toBe(true);
    }));
});

describe("contenu hors ligne", () => {
  it("demande de choisir un programme d'abord", () =>
    withApp(async (api) => {
      const res = await api.request("GET", "/v1/content", { user: "user-a" });
      expect({ status: res.status, error: res.body.error }).toEqual({ status: 409, error: "program_not_selected" });
    }));

  it("renvoie uniquement le contenu validé, avec les bonnes réponses pour le mode hors ligne", () =>
    withApp(async (api, db) => {
      const { programId, lessonId, single, multi } = await publishedProgram(db);
      await api.request("PATCH", "/v1/me", { user: "user-a", body: { program_id: programId } });

      const res = await api.request("GET", "/v1/content", { user: "user-a" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ changed: true, images_base_url: "https://images.drivelearn.test", max_review_per_lesson: 2 });
      expect(res.body.content.program).toMatchObject({ id: programId, exam_question_count: 20, exam_pass_mark: 13 });

      const units = res.body.content.units;
      expect(units).toHaveLength(1);
      expect(units[0].lessons.map((l: { id: string }) => l.id)).toEqual([lessonId]);
      const questions = units[0].lessons[0].questions;
      expect(questions.map((q: { id: string }) => q.id).sort()).toEqual([single.id, multi.id].sort());
      const multiQ = questions.find((q: { id: string }) => q.id === multi.id);
      expect(multiQ.multiple).toBe(true);
      expect(multiQ.choices.filter((c: { is_correct: boolean }) => c.is_correct)).toHaveLength(2);
    }));

  it("répond « rien de nouveau » quand l'app a déjà la dernière version", () =>
    withApp(async (api, db) => {
      const { programId } = await publishedProgram(db);
      await api.request("PATCH", "/v1/me", { user: "user-a", body: { program_id: programId } });
      const first = await api.request("GET", "/v1/content", { user: "user-a" });
      const again = await api.request("GET", `/v1/content?version=${first.body.version}`, { user: "user-a" });
      expect(again.body).toEqual({ changed: false, version: first.body.version });
    }));
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npm test -w @drivelearn/api`
Expected: `content.test.ts` échoue (`GET /v1/programs` → 404).

- [ ] **Step 3 : Écrire la migration et les routes**

`packages/db/migrations/0008_content_export.sql` :

```sql
-- Contenu validé d'un programme, pour le téléchargement hors ligne par l'application
create function get_program_content(p_program_id uuid)
returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'program', jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'exam_question_count', p.exam_question_count,
      'exam_pass_mark', p.exam_pass_mark,
      'exam_seconds_per_question', p.exam_seconds_per_question
    ),
    'units', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id,
        'title', u.title,
        'position', u.position,
        'lessons', (
          select jsonb_agg(jsonb_build_object(
            'id', l.id,
            'title', l.title,
            'position', l.position,
            'intro_title', l.intro_title,
            'intro_text', l.intro_text,
            'intro_image_path', l.intro_image_path,
            'mentor_tip', l.mentor_tip,
            'questions', (
              select jsonb_agg(jsonb_build_object(
                'id', q.id,
                'prompt', q.prompt,
                'image_path', q.image_path,
                'explanation', q.explanation,
                'multiple', (select count(*) from choices c2 where c2.question_id = q.id and c2.is_correct) > 1,
                'choices', (
                  select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.label, 'is_correct', c.is_correct)
                    order by c.position)
                  from choices c where c.question_id = q.id
                )
              ) order by q.position, q.id)
              from questions q
              where q.lesson_id = l.id and q.status = 'validee'
            )
          ) order by l.position)
          from lessons l
          where l.unit_id = u.id
            and exists (select 1 from questions q where q.lesson_id = l.id and q.status = 'validee')
        )
      ) order by u.position)
      from units u
      where u.program_id = p.id
        and exists (
          select 1 from lessons l join questions q on q.lesson_id = l.id
          where l.unit_id = u.id and q.status = 'validee'
        )
    ), '[]'::jsonb)
  )
  from programs p
  where p.id = p_program_id;
$$;
```

`packages/api/src/routes/content.ts` :

```ts
import { Hono } from "hono";
import { z } from "zod";
import { requireProgram, row } from "../db.js";
import type { AppEnv, Deps } from "../types.js";

const ContentQuery = z.object({ version: z.coerce.number().int().nonnegative().optional() });

export function contentRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();

  r.get("/programs", async (c) => {
    const { rows } = await deps.db.query(
      `select id, country_code, license_type, name, status = 'publie' as available
       from programs order by country_code, license_type`,
    );
    return c.json(rows);
  });

  r.get("/content", async (c) => {
    const { version } = ContentQuery.parse(c.req.query());
    const programId = await requireProgram(deps.db, c.get("userId"));
    const current = await row<{ version: number }>(deps.db, "select version::int as version from content_version");
    if (version !== undefined && version === current?.version) {
      return c.json({ changed: false, version });
    }
    const data = await row<{ content: unknown; max_review: number }>(
      deps.db,
      "select get_program_content($1) as content, setting_int('max_review_per_lesson') as max_review",
      [programId],
    );
    return c.json({
      changed: true,
      version: current?.version,
      images_base_url: deps.imagesBaseUrl,
      max_review_per_lesson: data?.max_review,
      content: data?.content,
    });
  });

  return r;
}
```

Dans `packages/api/src/app.ts`, ajouter l'import `import { contentRoutes } from "./routes/content.js";` et, après `v1.route("/me", meRoutes(deps));`, la ligne :

```ts
  v1.route("/", contentRoutes(deps));
```

- [ ] **Step 4 : Lancer les tests des deux paquets**

Run: `npm test -w @drivelearn/db` puis `npm test -w @drivelearn/api` puis `npm run typecheck -w @drivelearn/api`
Expected: les deux suites passent (le test `migrate.test.ts` du Plan 1 compte désormais 8 migrations).

- [ ] **Step 5 : Commit**

```bash
git add packages/db/migrations/0008_content_export.sql packages/api
git commit -m "feat(api): programmes et contenu hors ligne"
```

---

### Task 4 : Séances, révision et progrès

**Files:**
- Create: `packages/api/src/routes/practice.ts`
- Modify: `packages/api/src/app.ts`
- Test: `packages/api/test/practice.test.ts`

**Interfaces:**
- Consumes: `submit_session`, `get_review_questions`, `get_progress` (Plan 1) ; `toHttpError`, `requireProgram` (Task 1)
- Produces:
  - `POST /v1/sessions` `{ sessions: [{ id, kind: "lecon"|"erreurs"|"theme", lesson_id?, unit_id?, completed_at (ISO 8601), active_seconds, answers: [{ question_id, choice_ids }] }] }` (1 à 50 séances) → `200 { results: [{ id, status: "ok", xp_earned, correct_count, question_count } | { id, status: "rejected", error }] }`. Une erreur métier ou une donnée invalide rejette seulement la séance concernée ; une panne de base fait échouer toute la requête (`500`), et l'app réessaie.
  - `GET /v1/review?limit=<1..50>` → `{ question_ids: string[] }`
  - `GET /v1/progress` → objet `get_progress`

- [ ] **Step 1 : Écrire le test qui échoue**

`packages/api/test/practice.test.ts` :

```ts
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPath, createQuestion, type Db } from "../../db/test/helpers.js";
import { withApp, type TestApi } from "./helpers.js";

async function setup(api: TestApi, db: Db) {
  const path = await createPath(db);
  await db.query("update programs set status = 'publie' where id = $1", [path.programId]);
  const ok = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, status: "validee" });
  const retired = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, status: "en_validation" });
  await api.request("PATCH", "/v1/me", { user: "user-a", body: { program_id: path.programId } });
  return { ...path, ok, retired };
}

const session = (lessonId: string, questionId: string, choiceIds: string[], id = randomUUID()) => ({
  id,
  kind: "lecon",
  lesson_id: lessonId,
  completed_at: new Date().toISOString(),
  active_seconds: 120,
  answers: [{ question_id: questionId, choice_ids: choiceIds }],
});

describe("séances hors ligne", () => {
  it("enregistre les séances valides et rejette seulement celle qui porte sur une question retirée", () =>
    withApp(async (api, db) => {
      const { lessonId, ok, retired } = await setup(api, db);
      const good = session(lessonId, ok.id, ok.correct);
      const bad = session(lessonId, retired.id, retired.correct);
      const res = await api.request("POST", "/v1/sessions", { user: "user-a", body: { sessions: [good, bad] } });
      expect(res.status).toBe(200);
      expect(res.body.results).toEqual([
        { id: good.id, status: "ok", xp_earned: 15, correct_count: 1, question_count: 1 },
        { id: bad.id, status: "rejected", error: "unknown_question" },
      ]);
    }));

  it("accepte un renvoi du même lot sans double XP", () =>
    withApp(async (api, db) => {
      const { lessonId, ok } = await setup(api, db);
      const body = { sessions: [session(lessonId, ok.id, ok.correct)] };
      await api.request("POST", "/v1/sessions", { user: "user-a", body });
      const again = await api.request("POST", "/v1/sessions", { user: "user-a", body });
      expect(again.body.results[0].status).toBe("ok");
      expect((await api.request("GET", "/v1/progress", { user: "user-a" })).body.total_xp).toBe(15);
    }));

  it("refuse un lot mal formé", () =>
    withApp(async (api, db) => {
      const { lessonId, ok } = await setup(api, db);
      const tooMany = Array.from({ length: 51 }, () => session(lessonId, ok.id, ok.correct));
      for (const body of [{ sessions: [] }, { sessions: tooMany }, { sessions: [{ ...session(lessonId, ok.id, ok.correct), id: "abc" }] }]) {
        const res = await api.request("POST", "/v1/sessions", { user: "user-a", body });
        expect({ status: res.status, error: res.body.error }).toEqual({ status: 400, error: "invalid_input" });
      }
    }));
});

describe("révision et progrès", () => {
  it("renvoie les questions à revoir après une erreur", () =>
    withApp(async (api, db) => {
      const { lessonId, ok } = await setup(api, db);
      await api.request("POST", "/v1/sessions", { user: "user-a", body: { sessions: [session(lessonId, ok.id, ok.wrong)] } });
      const res = await api.request("GET", "/v1/review?limit=10", { user: "user-a" });
      expect(res.body).toEqual({ question_ids: [ok.id] });
    }));

  it("renvoie les progrès de l'élève", () =>
    withApp(async (api, db) => {
      const { lessonId, ok } = await setup(api, db);
      await api.request("POST", "/v1/sessions", { user: "user-a", body: { sessions: [session(lessonId, ok.id, ok.correct)] } });
      const res = await api.request("GET", "/v1/progress", { user: "user-a" });
      expect(res.body).toMatchObject({ current_streak: 1, practiced_today: true, total_xp: 15, today_minutes: 2 });
    }));
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npm test -w @drivelearn/api`
Expected: `practice.test.ts` échoue (`POST /v1/sessions` → 404).

- [ ] **Step 3 : Écrire les routes**

`packages/api/src/routes/practice.ts` :

```ts
import { Hono } from "hono";
import { z } from "zod";
import { requireProgram, row } from "../db.js";
import { toHttpError } from "../errors.js";
import type { AppEnv, Deps } from "../types.js";

const Session = z.object({
  id: z.uuid(),
  kind: z.enum(["lecon", "erreurs", "theme"]),
  lesson_id: z.uuid().nullable().optional(),
  unit_id: z.uuid().nullable().optional(),
  completed_at: z.iso.datetime({ offset: true }),
  active_seconds: z.number().int().nonnegative(),
  answers: z
    .array(z.object({ question_id: z.uuid(), choice_ids: z.array(z.uuid()).max(8) }))
    .min(1)
    .max(100),
});
const SessionBatch = z.object({ sessions: z.array(Session).min(1).max(50) });
const ReviewQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) });

export function practiceRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();

  r.post("/sessions", async (c) => {
    const userId = c.get("userId");
    const { sessions } = SessionBatch.parse(await c.req.json());
    const results = [];
    for (const s of sessions) {
      try {
        const saved = await row(
          deps.db,
          `select xp_earned, correct_count, question_count
           from submit_session($1, $2, $3, $4, $5, $6, $7, $8)`,
          [userId, s.id, s.kind, s.lesson_id ?? null, s.unit_id ?? null, s.completed_at, s.active_seconds, JSON.stringify(s.answers)],
        );
        results.push({ id: s.id, status: "ok", ...saved });
      } catch (error) {
        const e = toHttpError(error);
        if (e.status >= 500) throw error; // panne : l'app réessaiera tout le lot
        results.push({ id: s.id, status: "rejected", error: e.code });
      }
    }
    return c.json({ results });
  });

  r.get("/review", async (c) => {
    const { limit } = ReviewQuery.parse(c.req.query());
    const userId = c.get("userId");
    const programId = await requireProgram(deps.db, userId);
    const result = await row<{ ids: string[] }>(deps.db, "select get_review_questions($1, $2, $3) as ids", [userId, programId, limit]);
    return c.json({ question_ids: result?.ids ?? [] });
  });

  r.get("/progress", async (c) => {
    const result = await row<{ progress: unknown }>(deps.db, "select get_progress($1) as progress", [c.get("userId")]);
    return c.json(result?.progress);
  });

  return r;
}
```

Dans `packages/api/src/app.ts`, ajouter l'import `import { practiceRoutes } from "./routes/practice.js";` et la ligne suivante après les routes de contenu :

```ts
  v1.route("/", practiceRoutes(deps));
```

- [ ] **Step 4 : Lancer les tests**

Run: `npm test -w @drivelearn/api` puis `npm run typecheck -w @drivelearn/api`
Expected: tous les fichiers passent.

- [ ] **Step 5 : Commit**

```bash
git add packages/api
git commit -m "feat(api): séances hors ligne, révision et progrès"
```

---

### Task 5 : Examens blancs et signalements

**Files:**
- Create: `packages/api/src/routes/exams.ts`, `packages/api/src/routes/reports.ts`
- Modify: `packages/api/src/app.ts`
- Test: `packages/api/test/exams.test.ts`, `packages/api/test/reports.test.ts`

**Interfaces:**
- Consumes: `start_exam`, `get_exam`, `save_exam_answer`, `submit_exam`, `get_exam_status`, `get_exam_history`, `create_report` (Plan 1) ; `requireProgram` (Task 1)
- Produces:
  - `POST /v1/exams` → objet `get_exam` (reprend l'examen ouvert s'il existe)
  - `GET /v1/exams/status` → objet `get_exam_status` ; `GET /v1/exams/history` → tableau `get_exam_history`
  - `GET /v1/exams/:id` → objet `get_exam`
  - `PUT /v1/exams/:id/answers/:questionId` `{ choice_ids: uuid[] }` → `204`
  - `POST /v1/exams/:id/submit` → objet `get_exam` corrigé
  - `POST /v1/reports` `{ question_id, reason: "reponse_incorrecte"|"explication_peu_claire"|"probleme_image", comment? }` → `201 { id }`

- [ ] **Step 1 : Écrire les tests qui échouent**

`packages/api/test/exams.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createPath, createQuestion, type Db } from "../../db/test/helpers.js";
import { withApp, type TestApi } from "./helpers.js";

/** Programme publié, examen de 2 questions avec un seuil de 1. */
async function setup(api: TestApi, db: Db) {
  const path = await createPath(db, { examQuestionCount: 2, examPassMark: 1 });
  await db.query("update programs set status = 'publie' where id = $1", [path.programId]);
  const q1 = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, status: "validee" });
  const q2 = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, status: "validee" });
  await api.request("PATCH", "/v1/me", { user: "user-a", body: { program_id: path.programId } });
  return { correct: new Map([[q1.id, q1.correct], [q2.id, q2.correct]]) };
}

describe("examens blancs", () => {
  it("demande de choisir un programme d'abord", () =>
    withApp(async (api) => {
      const res = await api.request("POST", "/v1/exams", { user: "user-a" });
      expect({ status: res.status, error: res.body.error }).toEqual({ status: 409, error: "program_not_selected" });
    }));

  it("déroule un examen complet : démarrage, reprise, réponses, correction, historique", () =>
    withApp(async (api, db) => {
      const { correct } = await setup(api, db);
      const exam = (await api.request("POST", "/v1/exams", { user: "user-a" })).body;
      expect(exam.total).toBe(2);
      expect(exam.questions[0].choices[0].is_correct).toBeNull();
      expect((await api.request("POST", "/v1/exams", { user: "user-a" })).body.attempt_id).toBe(exam.attempt_id);

      const first = exam.questions[0].id;
      const put = await api.request("PUT", `/v1/exams/${exam.attempt_id}/answers/${first}`, {
        user: "user-a",
        body: { choice_ids: correct.get(first) },
      });
      expect(put.status).toBe(204);

      const result = (await api.request("POST", `/v1/exams/${exam.attempt_id}/submit`, { user: "user-a" })).body;
      expect({ score: result.score, passed: result.passed }).toEqual({ score: 1, passed: true });

      expect((await api.request("GET", "/v1/exams/status", { user: "user-a" })).body).toMatchObject({ exams_taken: 1, free_exam_available: false });
      expect((await api.request("GET", "/v1/exams/history", { user: "user-a" })).body).toHaveLength(1);
      expect((await api.request("GET", `/v1/exams/${exam.attempt_id}`, { user: "user-a" })).body.submitted).toBe(true);
    }));

  it("demande un Pass pour un second examen", () =>
    withApp(async (api, db) => {
      await setup(api, db);
      const exam = (await api.request("POST", "/v1/exams", { user: "user-a" })).body;
      await api.request("POST", `/v1/exams/${exam.attempt_id}/submit`, { user: "user-a" });
      const res = await api.request("POST", "/v1/exams", { user: "user-a" });
      expect({ status: res.status, error: res.body.error }).toEqual({ status: 402, error: "pass_required" });
    }));

  it("cache l'examen aux autres élèves et refuse un identifiant mal formé", () =>
    withApp(async (api, db) => {
      await setup(api, db);
      const exam = (await api.request("POST", "/v1/exams", { user: "user-a" })).body;
      expect((await api.request("GET", `/v1/exams/${exam.attempt_id}`, { user: "user-b" })).status).toBe(404);
      const bad = await api.request("GET", "/v1/exams/abc", { user: "user-a" });
      expect({ status: bad.status, error: bad.body.error }).toEqual({ status: 400, error: "invalid_input" });
    }));
});
```

`packages/api/test/reports.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createPath, createQuestion } from "../../db/test/helpers.js";
import { withApp } from "./helpers.js";

describe("signalements", () => {
  it("enregistre un signalement", () =>
    withApp(async (api, db) => {
      const { unitId, lessonId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId, status: "validee" });
      const res = await api.request("POST", "/v1/reports", {
        user: "user-a",
        body: { question_id: q.id, reason: "explication_peu_claire", comment: "Pas clair" },
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    }));

  it("refuse une question indisponible ou une raison inconnue", () =>
    withApp(async (api, db) => {
      const { unitId, lessonId } = await createPath(db);
      const draft = await createQuestion(db, { unitId, lessonId });
      const unknown = await api.request("POST", "/v1/reports", {
        user: "user-a",
        body: { question_id: draft.id, reason: "reponse_incorrecte" },
      });
      expect({ status: unknown.status, error: unknown.body.error }).toEqual({ status: 422, error: "unknown_question" });
      const badReason = await api.request("POST", "/v1/reports", {
        user: "user-a",
        body: { question_id: draft.id, reason: "autre" },
      });
      expect(badReason.status).toBe(400);
    }));
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -w @drivelearn/api`
Expected: `exams.test.ts` et `reports.test.ts` échouent (404 sur les routes).

- [ ] **Step 3 : Écrire les routes**

`packages/api/src/routes/exams.ts` :

```ts
import { Hono } from "hono";
import { z } from "zod";
import { requireProgram, row } from "../db.js";
import type { AppEnv, Deps } from "../types.js";

const Id = z.uuid();
const Answer = z.strictObject({ choice_ids: z.array(z.uuid()).max(8) });

export function examRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();
  const value = async (sql: string, values: unknown[]) => (await row<{ v: unknown }>(deps.db, sql, values))?.v;

  r.post("/", async (c) => {
    const userId = c.get("userId");
    const programId = await requireProgram(deps.db, userId);
    return c.json(await value("select start_exam($1, $2) as v", [userId, programId]));
  });

  r.get("/status", async (c) => c.json(await value("select get_exam_status($1) as v", [c.get("userId")])));
  r.get("/history", async (c) => c.json(await value("select get_exam_history($1) as v", [c.get("userId")])));

  r.get("/:id", async (c) => {
    const id = Id.parse(c.req.param("id"));
    return c.json(await value("select get_exam($1, $2) as v", [c.get("userId"), id]));
  });

  r.put("/:id/answers/:questionId", async (c) => {
    const id = Id.parse(c.req.param("id"));
    const questionId = Id.parse(c.req.param("questionId"));
    const { choice_ids } = Answer.parse(await c.req.json());
    await deps.db.query("select save_exam_answer($1, $2, $3, $4::uuid[])", [c.get("userId"), id, questionId, choice_ids]);
    return c.body(null, 204);
  });

  r.post("/:id/submit", async (c) => {
    const id = Id.parse(c.req.param("id"));
    return c.json(await value("select submit_exam($1, $2) as v", [c.get("userId"), id]));
  });

  return r;
}
```

`packages/api/src/routes/reports.ts` :

```ts
import { Hono } from "hono";
import { z } from "zod";
import { row } from "../db.js";
import type { AppEnv, Deps } from "../types.js";

const Report = z.strictObject({
  question_id: z.uuid(),
  reason: z.enum(["reponse_incorrecte", "explication_peu_claire", "probleme_image"]),
  comment: z.string().max(500).nullable().optional(),
});

export function reportRoutes(deps: Deps) {
  const r = new Hono<AppEnv>();
  r.post("/", async (c) => {
    const body = Report.parse(await c.req.json());
    const created = await row<{ id: string }>(deps.db, "select id from create_report($1, $2, $3, $4)", [
      c.get("userId"),
      body.question_id,
      body.reason,
      body.comment ?? null,
    ]);
    return c.json({ id: created?.id }, 201);
  });
  return r;
}
```

Dans `packages/api/src/app.ts`, ajouter les imports `import { examRoutes } from "./routes/exams.js";` et `import { reportRoutes } from "./routes/reports.js";`, puis ces lignes après les routes de séances :

```ts
  v1.route("/exams", examRoutes(deps));
  v1.route("/reports", reportRoutes(deps));
```

- [ ] **Step 4 : Lancer les tests**

Run: `npm test -w @drivelearn/api` puis `npm run typecheck -w @drivelearn/api`
Expected: tous les fichiers passent.

- [ ] **Step 5 : Commit**

```bash
git add packages/api
git commit -m "feat(api): examens blancs et signalements"
```

---

### Task 6 : Déploiement sur Neon et essai de bout en bout

**Files:**
- Create: `neon.ts` (racine), `packages/api/src/function.ts`, `packages/api/scripts/smoke.ts`
- Modify: `package.json` racine (dépendance `@neon/config`)

**Interfaces:**
- Consumes: `createApp`, `createTokenVerifier`, `createNeonAuthAdmin` (Tasks 1–2) ; `migrate` (Plan 1)
- Produces:
  - Function `api` déployée, URL publique `https://br-flat-lake-b12cfxtb-api.compute.<cell>.eu-central-1.aws.neon.tech/` (URL exacte relevée par `neon functions get api`)
  - Base Neon migrée (0001–0008)
  - Domaine de confiance Neon Auth `https://app.drivelearn.tg` (le domaine de test est retiré)
  - `npm run smoke -w @drivelearn/api`

Les étapes marquées **(vous)** demandent une action humaine : connexion par navigateur, ou manipulation d'une clé secrète que l'agent ne doit pas voir.

- [ ] **Step 1 (vous) : Installer et connecter la CLI Neon**

```bash
npm install -g neon@latest
```

```bash
neon login
```

Expected: `neon me` affiche votre compte.

- [ ] **Step 2 : Lier le dépôt au projet et récupérer les variables**

Run: `neon link --project-id young-river-14219375 --branch main -y`
Expected: un fichier `.neon` est créé (ignoré par git) et `.env.local` contient `DATABASE_URL`, `DATABASE_URL_UNPOOLED` et `NEON_BRANCH`. Vérifier sans afficher les valeurs : `grep -c "^DATABASE_URL" .env.local` doit donner `2`.

- [ ] **Step 3 : Appliquer les migrations sur Neon**

Run (la chaîne n'est pas affichée) : `DATABASE_URL="$(grep '^DATABASE_URL_UNPOOLED=' .env.local | cut -d= -f2- | tr -d '"')" npm run migrate -w @drivelearn/db`
Expected: `Appliquées : 0001_content.sql, …, 0008_content_export.sql`. Relancer la même commande doit afficher `Base à jour`.

- [ ] **Step 4 (vous) : Créer la clé d'API pour la suppression de comptes**

Dans la console Neon : **Organization settings → API keys → Create key**. Choisir une clé **limitée au projet DriveLearn** si l'option est proposée ; sinon, une clé d'organisation. Collez-la dans un nouveau fichier `.env.production`, à la racine du dépôt (déjà ignoré par git via `.env.*`) :

```
NEON_API_KEY=<collez la clé ici>
```

Expected: `grep -c "^NEON_API_KEY=" .env.production` donne `1`.

- [ ] **Step 5 : Écrire le point d'entrée et la configuration Neon**

`packages/api/src/function.ts` :

```ts
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
```

Run: `npm install -D @neon/config@latest` (à la racine)

`neon.ts` (racine du dépôt) :

```ts
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  functions: {
    api: {
      name: "DriveLearn API",
      source: "./packages/api/src/function.ts",
      env: {
        NEON_API_KEY: process.env.NEON_API_KEY!,
        NEON_PROJECT_ID: "young-river-14219375",
        NEON_BRANCH_ID: "br-flat-lake-b12cfxtb",
        REQUIRE_VERIFIED_EMAIL: "true",
      },
    },
  },
});
```

Run: `npm run typecheck -w @drivelearn/api`
Expected: aucune erreur.

- [ ] **Step 6 : Déployer**

Run: `neon config plan --env .env.production` puis `neon deploy --env .env.production`
Expected: le plan annonce l'ajout de la Function `api` et aucune suppression de service. Le déploiement se termine par un statut `completed`. Ensuite, `neon functions get api` affiche l'`invocation_url` : la noter dans `.env.local` sous la forme `API_URL=<invocation_url sans / final>`.

Vérification : `curl -s "$(grep '^API_URL=' .env.local | cut -d= -f2-)/health"` doit répondre `{"ok":true}`.

- [ ] **Step 7 : Configurer Neon Auth**

Avec les outils MCP Neon (projet `young-river-14219375`, branche `br-flat-lake-b12cfxtb`, fournisseur `better_auth`) :
1. `delete_auth_trusted_domain` avec le domaine `https://app.drivelearn.test` ;
2. `add_auth_trusted_domain` avec le domaine `https://app.drivelearn.tg` ;
3. `get_neon_auth_config` : `trusted_origins` doit valoir `["https://app.drivelearn.tg"]`.

**(vous)** Dans la console Neon, **Auth → Settings → Email & password** : activer **Verify email on sign-up** et **Require email verification**. Laisser la méthode par code (OTP). Vérifier avec `get_neon_auth_config` que `verify_email_on_sign_up` et `require_email_verification` valent `true`.

- [ ] **Step 8 : Écrire et lancer l'essai de bout en bout**

`packages/api/scripts/smoke.ts` :

```ts
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
```

Run: `npm run smoke -w @drivelearn/api`
Expected: 9 lignes `OK`, aucune `ÉCHEC`, code de sortie 0.

- [ ] **Step 9 : Commit**

```bash
git add neon.ts package.json package-lock.json packages/api/src/function.ts packages/api/scripts/smoke.ts
git commit -m "feat(api): déploiement sur Neon Functions et essai de bout en bout"
```

---

## Suite

- **Plan 3 — Site d'administration** (Next.js) : programmes, contenus et validation, paramètres d'examen, signalements, auto-écoles, ventes.
- **Plan 4 — Numérisation du contenu et images** : bucket `question-images` (lecture publique), `IMAGES_BASE_URL`, import des scans. **Nécessite les scans.**
- **Plans 5 et 6 — Application élève** (Expo) : elle enverra `Origin: https://app.drivelearn.tg` à Neon Auth et `Authorization: Bearer <jeton>` à l'API. Le plan 6 comprendra aussi l'intégration de la passerelle mobile money (création de paiement, webhook, expiration planifiée).
- **Plan 7 — Notifications et mise en production** : rappels push (tâche planifiée qui appelle `get_reminder_targets`), SMTP personnalisé, désactivation de localhost et du fournisseur Google partagé, Play Store.
