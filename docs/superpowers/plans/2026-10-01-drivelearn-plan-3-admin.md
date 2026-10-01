# DriveLearn — Plan 3 : Site d'administration — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire et déployer le site d'administration de DriveLearn (Next.js) : connexion des administrateurs, programmes, unités et leçons, éditeur et validation des questions, paramètres d'examen et publication, signalements, auto-écoles, ventes et commissions, tableau de bord, réglages.

**Architecture:** Une application Next.js (App Router), `packages/admin`, hébergée sur Vercel. Elle interroge directement la base Neon depuis le serveur (composants serveur et actions serveur), jamais depuis le navigateur. Toute la logique de données vit dans `lib/data/*.ts` : des fonctions qui reçoivent une connexion et sont testées avec Vitest sur le Postgres embarqué du Plan 1. Les pages et les actions sont minces : elles vérifient l'administrateur, appellent ces fonctions, puis redirigent avec un message. La connexion utilise Neon Auth via le SDK Next.js (`@neondatabase/auth`). Les requêtes d'authentification passent par une route du site lui-même, donc l'origine est celle du site. Être administrateur, c'est figurer dans la table `admins` du Plan 1.

**Tech Stack:** Next.js 16 (App Router, actions serveur), React 19, Tailwind CSS 4, `@neondatabase/auth`, `pg`, `zod` 4, Vitest, Vercel.

**Spec:** `docs/superpowers/specs/2026-09-27-drivelearn-design.md` (§7 et écrans 29 à 32 du prototype)
**S'appuie sur :** Plan 1 (schéma et fonctions SQL), Plan 2 (projet Neon `young-river-14219375`, branche `br-flat-lake-b12cfxtb`, Neon Auth actif).

## Global Constraints

- Chaque page et chaque action serveur commence par `await requireAdmin()` : session Neon Auth valide **et** identifiant présent dans `admins`. Sinon : redirection vers `/auth/sign-in` (pas de session) ou vers `/auth/refuse` (pas administrateur).
- La base n'est jamais interrogée depuis le navigateur. `DATABASE_URL` reste côté serveur.
- Les statuts de question suivent la spec : `brouillon` → `en_validation` → `validee` (et `a_verifier`). La validation passe par la contrainte du Plan 1, rendue immédiate pour afficher l'erreur exacte.
- Un programme ne peut passer `publie` que si l'examen est conforme : banque suffisante, répartition qui totalise le nombre de questions, assez de questions dans chaque unité de la répartition.
- Interface entièrement en français. Montants en FCFA entiers. Mois au format `AAAA-MM`, interprétés à l'heure de Lomé (UTC).
- Les secrets (`DATABASE_URL`, `NEON_AUTH_COOKIE_SECRET`) restent dans `.env.local` (ignoré par git) et dans les variables d'environnement Vercel. L'agent ne les saisit jamais dans un service tiers : c'est l'utilisateur qui le fait.
- Couleurs de marque, d'après le prototype : bleu nuit `#0B1F5C`, bleu `#1565E8`, sarcelle `#10A3A3`.

## Review Focus

1. **Un élève connecté (compte Neon Auth valide, absent de `admins`)** ouvre une page ou déclenche une action d'administration → refusé, aucune donnée. Testé dans la Task 1 (`isAdminUser`) ; chaque page et action appelle `requireAdmin`.
2. **Validation d'une question incomplète** (sans bonne réponse, sans source…) → message clair, et la question n'est pas validée. Testé dans la Task 3.
3. **Publication d'un programme dont la banque est insuffisante, ou dont la répartition ne totalise pas le nombre de questions** → refusée, avec la liste des problèmes. Testé dans la Task 4.
4. **Suppression d'une unité ou d'une leçon qui contient des questions** → refusée, au lieu de les effacer en cascade. Testé dans la Task 2.
5. **Export CSV des ventes avec un nom d'auto-école contenant `;`, `"` ou un saut de ligne** → fichier qui s'ouvre correctement dans Excel. Testé dans la Task 6.

---

## Structure des fichiers

```
packages/admin/
  package.json  tsconfig.json  next.config.ts  postcss.config.mjs  vitest.config.ts  next-env.d.ts (généré)
  proxy.ts                               # protection des routes (session Neon Auth)
  app/
    globals.css  layout.tsx
    api/auth/[...path]/route.ts          # proxy Neon Auth
    auth/sign-in/page.tsx  auth/sign-in/actions.ts
    auth/sign-up/page.tsx  auth/sign-up/actions.ts
    auth/refuse/page.tsx
    (admin)/layout.tsx                   # barre latérale
    (admin)/page.tsx                     # tableau de bord
    (admin)/programmes/page.tsx
    (admin)/programmes/[id]/page.tsx     # unités et leçons, statut
    (admin)/programmes/[id]/examen/page.tsx
    (admin)/questions/page.tsx
    (admin)/questions/[id]/page.tsx      # éditeur ("nouvelle" = création)
    (admin)/signalements/page.tsx
    (admin)/auto-ecoles/page.tsx
    (admin)/ventes/page.tsx
    (admin)/ventes/export/route.ts       # CSV
    (admin)/reglages/page.tsx
  components/ui.tsx                      # petits composants d'interface
  lib/
    db.ts                                # pool, inTransaction
    errors.ts                            # AdminError, adminMessage
    actions.ts                           # runAction (redirection avec message)
    admin.ts                             # requireAdmin
    auth/server.ts  auth/client.ts
    data/types.ts  data/admins.ts  data/programs.ts  data/units.ts  data/questions.ts
    data/reports.ts  data/schools.ts  data/sales.ts  data/dashboard.ts  data/settings.ts
    csv.ts
  scripts/make-admin.ts
  test/
    errors.test.ts  admins.test.ts  programs.test.ts  units.test.ts  questions.test.ts
    exam.test.ts  reports.test.ts  schools.test.ts  settings.test.ts  sales.test.ts  csv.test.ts  dashboard.test.ts
```

Commande de test : `npm test -w @drivelearn/admin`. Elle utilise la préparation de base de `packages/db`, donc **ne pas la lancer en même temps** que les tests de `db` ou `api` (même port 54329).

---

### Task 1 : Paquet admin, connexion et contrôle d'accès

**Files:**
- Create: `packages/admin/package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `proxy.ts`
- Create: `packages/admin/app/globals.css`, `app/layout.tsx`, `app/api/auth/[...path]/route.ts`, `app/auth/sign-in/{page,actions}.ts(x)`, `app/auth/sign-up/{page,actions}.ts(x)`, `app/auth/refuse/page.tsx`, `app/(admin)/layout.tsx`, `app/(admin)/page.tsx` (provisoire)
- Create: `packages/admin/components/ui.tsx`, `lib/db.ts`, `lib/errors.ts`, `lib/actions.ts`, `lib/admin.ts`, `lib/auth/server.ts`, `lib/auth/client.ts`, `lib/data/types.ts`, `lib/data/admins.ts`, `scripts/make-admin.ts`
- Test: `packages/admin/test/errors.test.ts`, `packages/admin/test/admins.test.ts`

**Interfaces:**
- Produces:
  - `type Queryable = { query(text: string, values?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }> }` (`lib/data/types.ts`)
  - `pool: pg.Pool` ; `inTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T>` (`lib/db.ts`)
  - `class AdminError extends Error` ; `adminMessage(err: unknown): string` (`lib/errors.ts`)
  - `runAction(backTo: string, fn: () => Promise<string | void>): Promise<never>` : exécute `fn`, puis redirige vers l'URL renvoyée par `fn` (ou `backTo`) avec `?ok=…`, ou vers `backTo?error=…` (`lib/actions.ts`)
  - `isAdminUser(db, userId): Promise<boolean>` ; `makeAdmin(db, email): Promise<string>` (`lib/data/admins.ts`)
  - `requireAdmin(): Promise<{ userId: string; email: string }>` (`lib/admin.ts`)
  - Composants `PageTitle`, `Card`, `Flash`, `Field`, `Button`, `StatusBadge`, et les classes `inputClass`, `tableClass` (`components/ui.tsx`)

- [ ] **Step 1 : Créer le paquet et installer les dépendances**

`packages/admin/package.json` :

```json
{
  "name": "@drivelearn/admin",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "make-admin": "tsx scripts/make-admin.ts"
  }
}
```

Run: `npm install -w @drivelearn/admin next@latest react@latest react-dom@latest @neondatabase/auth@latest pg zod@4` puis `npm install -w @drivelearn/admin -D typescript @types/react @types/react-dom @types/node @types/pg vitest tsx tailwindcss @tailwindcss/postcss`
Expected: dépendances installées sans erreur.

`packages/admin/tsconfig.json` :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`packages/admin/next.config.ts` :

```ts
import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["pg"],
};

export default config;
```

`packages/admin/postcss.config.mjs` :

```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

`packages/admin/vitest.config.ts` :

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["../db/test/global-setup.ts"],
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
```

- [ ] **Step 2 : Écrire les tests qui échouent**

`packages/admin/test/errors.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AdminError, adminMessage } from "../lib/errors";

describe("messages d'erreur de l'administration", () => {
  it("affiche tel quel le message d'une AdminError", () => {
    expect(adminMessage(new AdminError("Banque insuffisante."))).toBe("Banque insuffisante.");
  });

  it("traduit un refus de validation de question", () => {
    expect(adminMessage(new Error("question_invalide: aucune bonne réponse"))).toBe(
      "Validation impossible : aucune bonne réponse.",
    );
  });

  it("signale un doublon", () => {
    expect(adminMessage(Object.assign(new Error("dup"), { code: "23505" }))).toBe("Cette valeur existe déjà.");
  });

  it("résume une erreur de formulaire", () => {
    const parsed = z.object({ name: z.string().min(1, "Nom obligatoire") }).safeParse({ name: "" });
    expect(adminMessage(parsed.error)).toBe("Formulaire invalide : Nom obligatoire");
  });

  it("masque une erreur inattendue", () => {
    expect(adminMessage(new Error("connexion perdue"))).toBe("Erreur inattendue. Réessayez.");
  });
});
```

`packages/admin/test/admins.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { withTx } from "../../db/test/helpers.js";
import { isAdminUser, makeAdmin } from "../lib/data/admins";

describe("administrateurs", () => {
  it("ne reconnaît que les identifiants présents dans admins", () =>
    withTx(async (db) => {
      await db.query("insert into admins (user_id) values ('admin-1')");
      expect(await isAdminUser(db, "admin-1")).toBe(true);
      expect(await isAdminUser(db, "eleve-1")).toBe(false);
    }));

  it("nomme administrateur un compte Neon Auth par son e-mail", () =>
    withTx(async (db) => {
      await db.query("create schema if not exists neon_auth");
      await db.query(`create table if not exists neon_auth."user" (id text primary key, email text not null)`);
      await db.query(`insert into neon_auth."user" (id, email) values ('u-42', 'chef@drivelearn.tg')`);
      expect(await makeAdmin(db, "Chef@DriveLearn.tg")).toBe("u-42");
      expect(await isAdminUser(db, "u-42")).toBe(true);
      expect(await makeAdmin(db, "chef@drivelearn.tg")).toBe("u-42"); // idempotent
    }));

  it("refuse un e-mail inconnu", () =>
    withTx(async (db) => {
      await db.query("create schema if not exists neon_auth");
      await db.query(`create table if not exists neon_auth."user" (id text primary key, email text not null)`);
      await expect(makeAdmin(db, "personne@drivelearn.tg")).rejects.toThrow("Aucun compte");
    }));
});
```

- [ ] **Step 3 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -w @drivelearn/admin`
Expected: échec au chargement (`Cannot find module '../lib/errors'`, `'../lib/data/admins'`).

- [ ] **Step 4 : Écrire la couche serveur**

`packages/admin/lib/data/types.ts` :

```ts
export type Queryable = {
  query(text: string, values?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
};
```

`packages/admin/lib/errors.ts` :

```ts
import { ZodError } from "zod";

/** Erreur métier dont le message (en français) peut être montré tel quel à l'administrateur. */
export class AdminError extends Error {}

export function adminMessage(err: unknown): string {
  if (err instanceof AdminError) return err.message;
  if (err instanceof ZodError) return `Formulaire invalide : ${err.issues.map((i) => i.message).join(", ")}`;
  const e = err as { code?: string; message?: string };
  if (e?.message?.startsWith("question_invalide: ")) {
    return `Validation impossible : ${e.message.slice("question_invalide: ".length)}.`;
  }
  if (e?.code === "23505") return "Cette valeur existe déjà.";
  if (e?.code && ["23514", "23503", "22P02", "22007"].includes(e.code)) return "Valeur invalide.";
  console.error(err);
  return "Erreur inattendue. Réessayez.";
}
```

`packages/admin/lib/data/admins.ts` :

```ts
import { AdminError } from "../errors";
import type { Queryable } from "./types";

export async function isAdminUser(db: Queryable, userId: string): Promise<boolean> {
  const { rows } = await db.query("select 1 from admins where user_id = $1", [userId]);
  return rows.length > 0;
}

/** Ajoute aux administrateurs le compte Neon Auth qui porte cet e-mail. */
export async function makeAdmin(db: Queryable, email: string): Promise<string> {
  const { rows } = await db.query(`select id from neon_auth."user" where lower(email) = lower($1)`, [email.trim()]);
  if (rows.length === 0) throw new AdminError(`Aucun compte Neon Auth pour ${email}. Créez d'abord le compte.`);
  await db.query("insert into admins (user_id) values ($1) on conflict do nothing", [rows[0].id]);
  return rows[0].id as string;
}
```

`packages/admin/lib/db.ts` :

```ts
import pg from "pg";

const globalForPool = globalThis as unknown as { drivelearnPool?: pg.Pool };

export const pool = globalForPool.drivelearnPool ?? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
if (process.env.NODE_ENV !== "production") globalForPool.drivelearnPool = pool;

export async function inTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
```

`packages/admin/lib/auth/server.ts` :

```ts
import { createNeonAuth } from "@neondatabase/auth/next/server";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
});
```

`packages/admin/lib/auth/client.ts` :

```ts
"use client";

import { createAuthClient } from "@neondatabase/auth/next";

export const authClient = createAuthClient();
```

`packages/admin/lib/admin.ts` :

```ts
import { redirect } from "next/navigation";
import { auth } from "./auth/server";
import { isAdminUser } from "./data/admins";
import { pool } from "./db";

/** À appeler en tête de chaque page et de chaque action serveur de l'administration. */
export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in");
  if (!(await isAdminUser(pool, session.user.id))) redirect("/auth/refuse");
  return { userId: session.user.id, email: session.user.email };
}
```

`packages/admin/lib/actions.ts` :

```ts
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminMessage } from "./errors";

function withFlash(url: string, kind: "ok" | "error", message: string): string {
  const [path, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  params.delete("ok");
  params.delete("error");
  params.set(kind, message);
  return `${path}?${params.toString()}`;
}

/** Exécute une action serveur puis redirige avec un message de réussite ou d'erreur. */
export async function runAction(backTo: string, fn: () => Promise<string | void>): Promise<never> {
  let target: string;
  try {
    const next = await fn();
    target = withFlash(next ?? backTo, "ok", "Enregistré.");
  } catch (error) {
    target = withFlash(backTo, "error", adminMessage(error));
  }
  revalidatePath("/", "layout");
  redirect(target);
}
```

`packages/admin/scripts/make-admin.ts` :

```ts
// Usage : npm run make-admin -w @drivelearn/admin -- email@exemple.tg   (lit DATABASE_URL dans ../../.env.local)
import { readFileSync } from "node:fs";
import pg from "pg";
import { makeAdmin } from "../lib/data/admins";

const email = process.argv[2];
if (!email) {
  console.error("Indiquez l'e-mail du compte à nommer administrateur.");
  process.exit(1);
}
const line = readFileSync(new URL("../../../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="));
const client = new pg.Client({ connectionString: line?.slice("DATABASE_URL=".length).replace(/^"|"$/g, "") });
await client.connect();
try {
  const id = await makeAdmin(client, email);
  console.log(`${email} est administrateur (${id}).`);
} finally {
  await client.end();
}
```

- [ ] **Step 5 : Lancer les tests**

Run: `npm test -w @drivelearn/admin`
Expected: `errors.test.ts` et `admins.test.ts` passent.

- [ ] **Step 6 : Écrire l'interface de base et la connexion**

`packages/admin/app/globals.css` :

```css
@import "tailwindcss";

@theme {
  --color-nuit: #0b1f5c;
  --color-bleu: #1565e8;
  --color-sarcelle: #10a3a3;
}

body {
  @apply bg-slate-50 text-slate-900;
}
```

`packages/admin/app/layout.tsx` :

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = { title: "DriveLearn Admin" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
```

`packages/admin/app/api/auth/[...path]/route.ts` :

```ts
import { auth } from "@/lib/auth/server";

export const { GET, POST } = auth.handler();
```

`packages/admin/proxy.ts` :

```ts
import { auth } from "@/lib/auth/server";

export default auth.middleware({ loginUrl: "/auth/sign-in" });

export const config = {
  // Tout sauf les pages de connexion, l'API d'authentification et les fichiers statiques.
  matcher: ["/((?!auth|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

`packages/admin/components/ui.tsx` :

```tsx
import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-bleu focus:outline-none";
export const tableClass = "w-full text-left text-sm [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2 [&_th]:text-slate-500";

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-nuit">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {title && <h2 className="mb-4 font-semibold text-nuit">{title}</h2>}
      {children}
    </section>
  );
}

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (error) return <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  if (ok) return <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{ok}</p>;
  return null;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Button({
  children,
  variant = "primary",
  name,
  value,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  name?: string;
  value?: string;
}) {
  const styles = {
    primary: "bg-sarcelle text-white hover:opacity-90",
    secondary: "border border-slate-300 bg-white text-nuit hover:bg-slate-50",
    danger: "border border-red-200 bg-white text-red-600 hover:bg-red-50",
  }[variant];
  return (
    <button type="submit" name={name} value={value} className={`rounded-lg px-4 py-2 text-sm font-semibold ${styles}`}>
      {children}
    </button>
  );
}

const STATUS_LABELS: Record<string, [string, string]> = {
  brouillon: ["Brouillon", "bg-slate-100 text-slate-700"],
  a_verifier: ["À vérifier", "bg-amber-100 text-amber-800"],
  en_validation: ["En validation", "bg-blue-100 text-blue-800"],
  validee: ["Validée", "bg-emerald-100 text-emerald-800"],
  publie: ["Publié", "bg-emerald-100 text-emerald-800"],
  nouveau: ["Nouveau", "bg-blue-100 text-blue-800"],
  en_cours: ["En cours", "bg-amber-100 text-amber-800"],
  resolu: ["Résolu", "bg-emerald-100 text-emerald-800"],
  pending: ["En attente", "bg-amber-100 text-amber-800"],
  confirmed: ["Confirmé", "bg-emerald-100 text-emerald-800"],
  failed: ["Échoué", "bg-red-100 text-red-700"],
};

export function StatusBadge({ status }: { status: string }) {
  const [label, style] = STATUS_LABELS[status] ?? [status, "bg-slate-100 text-slate-700"];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{label}</span>;
}
```

`packages/admin/app/auth/sign-in/actions.ts` :

```ts
"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

export async function signInWithEmail(_prev: { error: string } | null, formData: FormData) {
  const { error } = await auth.signIn.email({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) return { error: "E-mail ou mot de passe incorrect." };
  redirect("/");
}
```

`packages/admin/app/auth/sign-in/page.tsx` :

```tsx
"use client";

import Link from "next/link";
import { useActionState } from "react";
import { inputClass } from "@/components/ui";
import { signInWithEmail } from "./actions";

export default function SignInPage() {
  const [state, formAction, pending] = useActionState(signInWithEmail, null);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow">
        <h1 className="text-center text-2xl font-bold text-nuit">
          Drive<span className="text-sarcelle">Learn</span> Admin
        </h1>
        <input name="email" type="email" required placeholder="Adresse e-mail" className={inputClass} />
        <input name="password" type="password" required placeholder="Mot de passe" className={inputClass} />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button disabled={pending} className="w-full rounded-lg bg-sarcelle py-2 font-semibold text-white">
          {pending ? "Connexion…" : "Se connecter"}
        </button>
        <p className="text-center text-sm text-slate-500">
          Pas encore de compte ? <Link href="/auth/sign-up" className="text-bleu underline">Créer un compte</Link>
        </p>
      </form>
    </main>
  );
}
```

`packages/admin/app/auth/sign-up/actions.ts` :

```ts
"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

export async function signUpWithEmail(_prev: { error: string } | null, formData: FormData) {
  const { error } = await auth.signUp.email({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) return { error: error.message || "Création du compte impossible." };
  redirect("/");
}
```

`packages/admin/app/auth/sign-up/page.tsx` :

```tsx
"use client";

import { useActionState } from "react";
import { inputClass } from "@/components/ui";
import { signUpWithEmail } from "./actions";

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(signUpWithEmail, null);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow">
        <h1 className="text-center text-xl font-bold text-nuit">Créer un compte administrateur</h1>
        <p className="text-sm text-slate-500">
          Le compte n'aura accès à l'administration qu'une fois nommé administrateur.
        </p>
        <input name="name" required placeholder="Nom" className={inputClass} />
        <input name="email" type="email" required placeholder="Adresse e-mail" className={inputClass} />
        <input name="password" type="password" required minLength={8} placeholder="Mot de passe" className={inputClass} />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button disabled={pending} className="w-full rounded-lg bg-sarcelle py-2 font-semibold text-white">
          {pending ? "Création…" : "Créer le compte"}
        </button>
      </form>
    </main>
  );
}
```

`packages/admin/app/auth/refuse/page.tsx` :

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";

async function signOut() {
  "use server";
  await auth.signOut();
  redirect("/auth/sign-in");
}

export default function RefusePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-sm space-y-4 rounded-2xl bg-white p-8 text-center shadow">
        <h1 className="text-xl font-bold text-nuit">Accès réservé</h1>
        <p className="text-sm text-slate-600">Ce compte n'est pas administrateur de DriveLearn.</p>
        <form action={signOut}>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Se déconnecter</button>
        </form>
      </div>
    </main>
  );
}
```

`packages/admin/app/(admin)/layout.tsx` :

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const NAV = [
  ["/", "Tableau de bord"],
  ["/programmes", "Programmes"],
  ["/questions", "Contenus"],
  ["/signalements", "Signalements"],
  ["/auto-ecoles", "Auto-écoles"],
  ["/ventes", "Ventes"],
  ["/reglages", "Réglages"],
] as const;

async function signOut() {
  "use server";
  await auth.signOut();
  redirect("/auth/sign-in");
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { email } = await requireAdmin();
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white p-5">
        <p className="mb-8 text-xl font-bold text-nuit">
          Drive<span className="text-sarcelle">Learn</span>
          <span className="block text-sm font-medium text-slate-500">Admin</span>
        </p>
        <nav className="space-y-1">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
              {label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="mt-10 text-xs text-slate-500">
          <p className="mb-2 truncate">{email}</p>
          <button className="underline">Se déconnecter</button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

`packages/admin/app/(admin)/page.tsx` (provisoire, remplacé à la Task 6) :

```tsx
import { PageTitle } from "@/components/ui";

export default function Home() {
  return <PageTitle title="Tableau de bord" subtitle="Bienvenue dans l'administration de DriveLearn." />;
}
```

- [ ] **Step 7 : Configurer l'environnement local et construire**

Le fichier `packages/admin/.env.local` (ignoré par git via `.env.*`) est créé par l'agent. Il recopie `DATABASE_URL` et `NEON_AUTH_BASE_URL` depuis le `.env.local` racine, sans les afficher, et génère le secret de cookie :

Run: `grep -E '^(DATABASE_URL|NEON_AUTH_BASE_URL)=' .env.local > packages/admin/.env.local && echo "NEON_AUTH_COOKIE_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")" >> packages/admin/.env.local && grep -c = packages/admin/.env.local`
Expected: `3`.

Run: `npm run typecheck -w @drivelearn/admin` puis `npm run build -w @drivelearn/admin`
Expected: aucune erreur TypeScript ; `next build` se termine par la liste des routes.

- [ ] **Step 8 : Commit**

```bash
git add package-lock.json packages/admin
git commit -m "feat(admin): paquet Next.js, connexion Neon Auth et contrôle d'accès"
```

---

### Task 2 : Programmes, unités et leçons

**Files:**
- Create: `packages/admin/lib/data/programs.ts` (liste et création), `lib/data/units.ts`
- Create: `packages/admin/app/(admin)/programmes/page.tsx`, `app/(admin)/programmes/[id]/page.tsx`
- Test: `packages/admin/test/programs.test.ts`, `packages/admin/test/units.test.ts`

**Interfaces:**
- Consumes: `Queryable`, `AdminError`, `runAction`, `requireAdmin`, composants d'interface (Task 1) ; `createPath`, `createQuestion`, `withTx` (tests du Plan 1)
- Produces:
  - `type ProgramRow = { id, country_code, license_type, name, status, exam_question_count, exam_pass_mark, exam_seconds_per_question, exam_distribution: Record<string, number>, lessons: number, validated_questions: number, pending_questions: number }`
  - `listPrograms(db): Promise<ProgramRow[]>` ; `getProgram(db, id): Promise<ProgramRow>` (lève une `AdminError` si le programme est introuvable) ; `createProgram(db, input: { country_code, license_type, name }): Promise<string>`
  - `type LessonRow = { id, title, position, intro_title, intro_text, intro_image_path, mentor_tip, counts: Record<string, number> }` ; `type UnitRow = { id, title, position, lessons: LessonRow[] }`
  - `listUnits(db, programId): Promise<UnitRow[]>` ; `createUnit(db, programId, title)` ; `renameUnit(db, unitId, title)` ; `deleteUnit(db, unitId)` ; `createLesson(db, unitId, title)` ; `updateLesson(db, lessonId, input)` ; `deleteLesson(db, lessonId)` ; `moveItem(db, kind: "unit" | "lesson", id, direction: "up" | "down")`

- [ ] **Step 1 : Écrire les tests qui échouent**

`packages/admin/test/programs.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createPath, createQuestion, withTx } from "../../db/test/helpers.js";
import { createProgram, getProgram, listPrograms } from "../lib/data/programs";

describe("programmes", () => {
  it("crée un programme en brouillon avec l'examen togolais par défaut", () =>
    withTx(async (db) => {
      const id = await createProgram(db, { country_code: "bj", license_type: "voiture", name: "Bénin — Permis voiture" });
      const program = await getProgram(db, id);
      expect(program).toMatchObject({ country_code: "BJ", status: "brouillon", exam_question_count: 20, exam_pass_mark: 13 });
    }));

  it("refuse un code pays invalide", () =>
    withTx(async (db) => {
      await expect(createProgram(db, { country_code: "Togo", license_type: "voiture", name: "X" })).rejects.toThrow();
    }));

  it("compte les leçons et les questions validées ou en attente", () =>
    withTx(async (db) => {
      const { programId, unitId, lessonId } = await createPath(db);
      await createQuestion(db, { unitId, lessonId, status: "validee" });
      await createQuestion(db, { unitId, lessonId });
      const [row] = (await listPrograms(db)).filter((p) => p.id === programId);
      expect({ lessons: row.lessons, validated: row.validated_questions, pending: row.pending_questions }).toEqual({
        lessons: 1,
        validated: 1,
        pending: 1,
      });
    }));
});
```

`packages/admin/test/units.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createPath, createQuestion, withTx } from "../../db/test/helpers.js";
import {
  createLesson,
  createUnit,
  deleteLesson,
  deleteUnit,
  listUnits,
  moveItem,
  renameUnit,
  updateLesson,
} from "../lib/data/units";

describe("unités et leçons", () => {
  it("ajoute les unités et leçons à la fin, dans l'ordre", () =>
    withTx(async (db) => {
      const { programId, unitId } = await createPath(db);
      const unit2 = await createUnit(db, programId, "Priorités");
      await createLesson(db, unitId, "Les formes");
      const units = await listUnits(db, programId);
      expect(units.map((u) => [u.title, u.position])).toEqual([["Unité 1", 1], ["Priorités", 2]]);
      expect(units[0].lessons.map((l) => l.title)).toEqual(["Leçon 1", "Les formes"]);
      expect(units[1].id).toBe(unit2);
    }));

  it("déplace une unité vers le haut en échangeant les positions", () =>
    withTx(async (db) => {
      const { programId } = await createPath(db);
      const unit2 = await createUnit(db, programId, "Priorités");
      await moveItem(db, "unit", unit2, "up");
      expect((await listUnits(db, programId)).map((u) => u.title)).toEqual(["Priorités", "Unité 1"]);
      await moveItem(db, "unit", unit2, "up"); // déjà en tête : rien ne change
      expect((await listUnits(db, programId)).map((u) => u.title)).toEqual(["Priorités", "Unité 1"]);
    }));

  it("met à jour l'écran d'explication d'une leçon et renomme une unité", () =>
    withTx(async (db) => {
      const { programId, unitId, lessonId } = await createPath(db);
      await renameUnit(db, unitId, "Signalisation");
      await updateLesson(db, lessonId, {
        title: "Reconnaître les formes",
        intro_title: "La forme compte",
        intro_text: "La forme et la couleur donnent des indices.",
        intro_image_path: null,
        mentor_tip: "Observe avant de répondre.",
      });
      const [unit] = await listUnits(db, programId);
      expect(unit.title).toBe("Signalisation");
      expect(unit.lessons[0]).toMatchObject({ title: "Reconnaître les formes", mentor_tip: "Observe avant de répondre." });
    }));

  it("compte les questions de chaque leçon par statut", () =>
    withTx(async (db) => {
      const { programId, unitId, lessonId } = await createPath(db);
      await createQuestion(db, { unitId, lessonId, status: "validee" });
      await createQuestion(db, { unitId, lessonId });
      const [unit] = await listUnits(db, programId);
      expect(unit.lessons[0].counts).toEqual({ validee: 1, brouillon: 1 });
    }));

  it("refuse de supprimer une unité ou une leçon qui contient des questions", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      await createQuestion(db, { unitId, lessonId });
      await expect(deleteLesson(db, lessonId)).rejects.toThrow("contient des questions");
      await expect(deleteUnit(db, unitId)).rejects.toThrow("contient des questions");
    }));

  it("supprime une leçon vide", () =>
    withTx(async (db) => {
      const { programId, lessonId } = await createPath(db);
      await deleteLesson(db, lessonId);
      expect((await listUnits(db, programId))[0].lessons).toEqual([]);
    }));
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -w @drivelearn/admin`
Expected: échec au chargement (`Cannot find module '../lib/data/programs'`, `'../lib/data/units'`).

- [ ] **Step 3 : Écrire la couche de données**

`packages/admin/lib/data/programs.ts` :

```ts
import { z } from "zod";
import { AdminError } from "../errors";
import type { Queryable } from "./types";

export type ProgramRow = {
  id: string;
  country_code: string;
  license_type: string;
  name: string;
  status: "brouillon" | "en_validation" | "publie";
  exam_question_count: number;
  exam_pass_mark: number;
  exam_seconds_per_question: number;
  exam_distribution: Record<string, number>;
  lessons: number;
  validated_questions: number;
  pending_questions: number;
};

const PROGRAM_SELECT = `
  select p.id, p.country_code, p.license_type, p.name, p.status::text as status,
         p.exam_question_count, p.exam_pass_mark, p.exam_seconds_per_question, p.exam_distribution,
         (select count(*)::int from lessons l join units u on u.id = l.unit_id where u.program_id = p.id) as lessons,
         (select count(*)::int from questions q join units u on u.id = q.unit_id
           where u.program_id = p.id and q.status = 'validee') as validated_questions,
         (select count(*)::int from questions q join units u on u.id = q.unit_id
           where u.program_id = p.id and q.status <> 'validee') as pending_questions
  from programs p`;

export async function listPrograms(db: Queryable): Promise<ProgramRow[]> {
  const { rows } = await db.query(`${PROGRAM_SELECT} order by p.country_code, p.license_type`);
  return rows;
}

export async function getProgram(db: Queryable, id: string): Promise<ProgramRow> {
  const { rows } = await db.query(`${PROGRAM_SELECT} where p.id = $1`, [id]);
  if (!rows[0]) throw new AdminError("Programme introuvable.");
  return rows[0];
}

const NewProgram = z.object({
  country_code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2}$/, "Code pays sur 2 lettres (ex. TG)")),
  license_type: z.string().trim().min(1, "Type de permis obligatoire").max(30),
  name: z.string().trim().min(1, "Nom obligatoire").max(100),
});

export async function createProgram(db: Queryable, input: z.input<typeof NewProgram>): Promise<string> {
  const p = NewProgram.parse(input);
  const { rows } = await db.query(
    "insert into programs (country_code, license_type, name) values ($1, $2, $3) returning id",
    [p.country_code, p.license_type, p.name],
  );
  return rows[0].id;
}
```

`packages/admin/lib/data/units.ts` :

```ts
import { z } from "zod";
import { AdminError } from "../errors";
import type { Queryable } from "./types";

export type LessonRow = {
  id: string;
  title: string;
  position: number;
  intro_title: string | null;
  intro_text: string | null;
  intro_image_path: string | null;
  mentor_tip: string | null;
  counts: Record<string, number>;
};
export type UnitRow = { id: string; title: string; position: number; lessons: LessonRow[] };

const Title = z.string().trim().min(1, "Titre obligatoire").max(120);

export async function listUnits(db: Queryable, programId: string): Promise<UnitRow[]> {
  const { rows } = await db.query(
    `select u.id, u.title, u.position,
       coalesce((
         select jsonb_agg(jsonb_build_object(
           'id', l.id, 'title', l.title, 'position', l.position,
           'intro_title', l.intro_title, 'intro_text', l.intro_text,
           'intro_image_path', l.intro_image_path, 'mentor_tip', l.mentor_tip,
           'counts', coalesce((
             select jsonb_object_agg(s.status, s.n)
             from (select q.status::text as status, count(*)::int as n
                   from questions q where q.lesson_id = l.id group by q.status) as s
           ), '{}'::jsonb)
         ) order by l.position)
         from lessons l where l.unit_id = u.id
       ), '[]'::jsonb) as lessons
     from units u where u.program_id = $1 order by u.position`,
    [programId],
  );
  return rows;
}

export async function createUnit(db: Queryable, programId: string, title: string): Promise<string> {
  const { rows } = await db.query(
    `insert into units (program_id, title, position)
     values ($1, $2, (select coalesce(max(position), 0) + 1 from units where program_id = $1)) returning id`,
    [programId, Title.parse(title)],
  );
  return rows[0].id;
}

export async function renameUnit(db: Queryable, unitId: string, title: string): Promise<void> {
  await db.query("update units set title = $2 where id = $1", [unitId, Title.parse(title)]);
}

export async function deleteUnit(db: Queryable, unitId: string): Promise<void> {
  const { rows } = await db.query("select count(*)::int as n from questions where unit_id = $1", [unitId]);
  if (rows[0].n > 0) throw new AdminError("Cette unité contient des questions : déplacez-les ou supprimez-les d'abord.");
  await db.query("delete from units where id = $1", [unitId]);
}

export async function createLesson(db: Queryable, unitId: string, title: string): Promise<string> {
  const { rows } = await db.query(
    `insert into lessons (unit_id, title, position)
     values ($1, $2, (select coalesce(max(position), 0) + 1 from lessons where unit_id = $1)) returning id`,
    [unitId, Title.parse(title)],
  );
  return rows[0].id;
}

const LessonInput = z.object({
  title: Title,
  intro_title: z.string().trim().max(120).nullable(),
  intro_text: z.string().trim().max(2000).nullable(),
  intro_image_path: z.string().trim().max(300).nullable(),
  mentor_tip: z.string().trim().max(300).nullable(),
});

export async function updateLesson(db: Queryable, lessonId: string, input: z.input<typeof LessonInput>): Promise<void> {
  const l = LessonInput.parse(input);
  await db.query(
    `update lessons set title = $2, intro_title = $3, intro_text = $4, intro_image_path = $5, mentor_tip = $6
     where id = $1`,
    [lessonId, l.title, l.intro_title || null, l.intro_text || null, l.intro_image_path || null, l.mentor_tip || null],
  );
}

export async function deleteLesson(db: Queryable, lessonId: string): Promise<void> {
  const { rows } = await db.query("select count(*)::int as n from questions where lesson_id = $1", [lessonId]);
  if (rows[0].n > 0) throw new AdminError("Cette leçon contient des questions : déplacez-les ou supprimez-les d'abord.");
  await db.query("delete from lessons where id = $1", [lessonId]);
}

/** Échange la position avec la voisine (unité du même programme, ou leçon de la même unité). */
export async function moveItem(db: Queryable, kind: "unit" | "lesson", id: string, direction: "up" | "down"): Promise<void> {
  const [table, parent] = kind === "unit" ? ["units", "program_id"] : ["lessons", "unit_id"];
  const comparison = direction === "up" ? "<" : ">";
  const order = direction === "up" ? "desc" : "asc";
  await db.query(
    `with me as (select id, position, ${parent} as parent from ${table} where id = $1),
          other as (
            select t.id, t.position from ${table} t, me
            where t.${parent} = me.parent and t.position ${comparison} me.position
            order by t.position ${order} limit 1
          )
     update ${table} t set position = case when t.id = me.id then other.position else me.position end
     from me, other where t.id in (me.id, other.id)`,
    [id],
  );
}
```

- [ ] **Step 4 : Lancer les tests**

Run: `npm test -w @drivelearn/admin`
Expected: tous les fichiers passent.

- [ ] **Step 5 : Écrire les pages**

`packages/admin/app/(admin)/programmes/page.tsx` :

```tsx
import Link from "next/link";
import { Button, Card, Field, Flash, inputClass, PageTitle, StatusBadge, tableClass } from "@/components/ui";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/admin";
import { createProgram, listPrograms } from "@/lib/data/programs";
import { pool } from "@/lib/db";

async function create(formData: FormData) {
  "use server";
  await requireAdmin();
  await runAction("/programmes", async () => {
    const id = await createProgram(pool, {
      country_code: String(formData.get("country_code")),
      license_type: String(formData.get("license_type")),
      name: String(formData.get("name")),
    });
    return `/programmes/${id}`;
  });
}

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const flash = await searchParams;
  const programs = await listPrograms(pool);
  return (
    <>
      <PageTitle title="Programmes pédagogiques" subtitle="Les programmes de code par pays et par permis." />
      <Flash {...flash} />
      <Card>
        <table className={tableClass}>
          <thead>
            <tr><th>Pays</th><th>Permis</th><th>Nom</th><th>État</th><th>Leçons</th><th>Questions validées</th><th>En attente</th><th /></tr>
          </thead>
          <tbody>
            {programs.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td>{p.country_code}</td>
                <td>{p.license_type}</td>
                <td>{p.name}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>{p.lessons}</td>
                <td>{p.validated_questions}</td>
                <td>{p.pending_questions}</td>
                <td><Link className="text-bleu underline" href={`/programmes/${p.id}`}>Ouvrir</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Nouveau programme">
        <form action={create} className="grid grid-cols-4 items-end gap-3">
          <Field label="Code pays"><input name="country_code" required maxLength={2} placeholder="TG" className={inputClass} /></Field>
          <Field label="Permis"><input name="license_type" required defaultValue="voiture" className={inputClass} /></Field>
          <Field label="Nom"><input name="name" required placeholder="Togo — Permis voiture" className={inputClass} /></Field>
          <Button>Créer</Button>
        </form>
      </Card>
    </>
  );
}
```

`packages/admin/app/(admin)/programmes/[id]/page.tsx` :

```tsx
import Link from "next/link";
import { Button, Card, Field, Flash, inputClass, PageTitle, StatusBadge } from "@/components/ui";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/admin";
import { getProgram } from "@/lib/data/programs";
import { createLesson, createUnit, deleteLesson, deleteUnit, listUnits, moveItem, renameUnit, updateLesson } from "@/lib/data/units";
import { pool } from "@/lib/db";

const text = (f: FormData, k: string) => String(f.get(k) ?? "");

async function unitAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const programId = text(formData, "program_id");
  await runAction(`/programmes/${programId}`, async () => {
    const op = text(formData, "op");
    const unitId = text(formData, "unit_id");
    if (op === "create") await createUnit(pool, programId, text(formData, "title"));
    if (op === "rename") await renameUnit(pool, unitId, text(formData, "title"));
    if (op === "delete") await deleteUnit(pool, unitId);
    if (op === "up" || op === "down") await moveItem(pool, "unit", unitId, op);
    if (op === "add_lesson") await createLesson(pool, unitId, text(formData, "title"));
  });
}

async function lessonAction(formData: FormData) {
  "use server";
  await requireAdmin();
  const programId = text(formData, "program_id");
  await runAction(`/programmes/${programId}`, async () => {
    const op = text(formData, "op");
    const lessonId = text(formData, "lesson_id");
    if (op === "save")
      await updateLesson(pool, lessonId, {
        title: text(formData, "title"),
        intro_title: text(formData, "intro_title") || null,
        intro_text: text(formData, "intro_text") || null,
        intro_image_path: text(formData, "intro_image_path") || null,
        mentor_tip: text(formData, "mentor_tip") || null,
      });
    if (op === "delete") await deleteLesson(pool, lessonId);
    if (op === "up" || op === "down") await moveItem(pool, "lesson", lessonId, op);
  });
}

export default async function ProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [program, units, flash] = await Promise.all([getProgram(pool, id), listUnits(pool, id), searchParams]);
  return (
    <>
      <PageTitle
        title={program.name}
        subtitle={`${program.country_code} · ${program.license_type}`}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={program.status} />
            <Link href={`/programmes/${id}/examen`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">Examen et publication</Link>
            <Link href={`/questions?program=${id}`} className="rounded-lg bg-sarcelle px-4 py-2 text-sm font-semibold text-white">Questions</Link>
          </div>
        }
      />
      <Flash {...flash} />
      {units.map((unit) => (
        <Card key={unit.id}>
          <form action={unitAction} className="mb-4 flex items-end gap-2">
            <input type="hidden" name="program_id" value={id} />
            <input type="hidden" name="unit_id" value={unit.id} />
            <Field label={`Unité ${unit.position}`}><input name="title" defaultValue={unit.title} className={inputClass} /></Field>
            <Button variant="secondary" name="op" value="rename">Renommer</Button>
            <Button variant="secondary" name="op" value="up">↑</Button>
            <Button variant="secondary" name="op" value="down">↓</Button>
            <Button variant="danger" name="op" value="delete">Supprimer</Button>
          </form>
          {unit.lessons.map((lesson) => (
            <form key={lesson.id} action={lessonAction} className="mb-3 grid grid-cols-2 gap-3 rounded-xl border border-slate-100 p-4">
              <input type="hidden" name="program_id" value={id} />
              <input type="hidden" name="lesson_id" value={lesson.id} />
              <Field label={`Leçon ${lesson.position}`}><input name="title" defaultValue={lesson.title} className={inputClass} /></Field>
              <Field label="Titre de l'écran d'explication"><input name="intro_title" defaultValue={lesson.intro_title ?? ""} className={inputClass} /></Field>
              <Field label="Texte d'explication"><textarea name="intro_text" rows={3} defaultValue={lesson.intro_text ?? ""} className={inputClass} /></Field>
              <div className="space-y-3">
                <Field label="Conseil du mentor"><input name="mentor_tip" defaultValue={lesson.mentor_tip ?? ""} className={inputClass} /></Field>
                <Field label="Image (chemin)"><input name="intro_image_path" defaultValue={lesson.intro_image_path ?? ""} className={inputClass} /></Field>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Button name="op" value="save">Enregistrer</Button>
                <Button variant="secondary" name="op" value="up">↑</Button>
                <Button variant="secondary" name="op" value="down">↓</Button>
                <Button variant="danger" name="op" value="delete">Supprimer</Button>
                <span className="ml-auto text-xs text-slate-500">
                  {Object.entries(lesson.counts).map(([s, n]) => `${n} ${s}`).join(" · ") || "aucune question"}
                </span>
              </div>
            </form>
          ))}
          <form action={unitAction} className="flex items-end gap-2">
            <input type="hidden" name="program_id" value={id} />
            <input type="hidden" name="unit_id" value={unit.id} />
            <Field label="Nouvelle leçon"><input name="title" required className={inputClass} /></Field>
            <Button variant="secondary" name="op" value="add_lesson">Ajouter la leçon</Button>
          </form>
        </Card>
      ))}
      <Card title="Nouvelle unité">
        <form action={unitAction} className="flex items-end gap-2">
          <input type="hidden" name="program_id" value={id} />
          <Field label="Titre"><input name="title" required placeholder="Signalisation" className={inputClass} /></Field>
          <Button name="op" value="create">Ajouter l'unité</Button>
        </form>
      </Card>
    </>
  );
}
```

- [ ] **Step 6 : Vérifier et commiter**

Run: `npm run typecheck -w @drivelearn/admin` puis `npm run build -w @drivelearn/admin`
Expected: aucune erreur.

```bash
git add packages/admin
git commit -m "feat(admin): programmes, unités et leçons"
```

---

### Task 3 : Questions, éditeur et validation

**Files:**
- Create: `packages/admin/lib/data/questions.ts`
- Create: `packages/admin/app/(admin)/questions/page.tsx`, `app/(admin)/questions/[id]/page.tsx`
- Test: `packages/admin/test/questions.test.ts`

**Interfaces:**
- Consumes: Task 1 et Task 2 (`listUnits`, `listPrograms`)
- Produces:
  - `type QuestionStatus = "brouillon" | "a_verifier" | "en_validation" | "validee"`
  - `listQuestions(db, filter: { programId, unitId?, status?, search?, limit?, offset? }): Promise<{ rows: QuestionListRow[]; total: number }>`, avec `QuestionListRow = { id, prompt, status, unit_title, lesson_title, open_reports, updated_at }`
  - `getQuestion(db, id): Promise<QuestionDetail>`, avec `QuestionDetail = { id, unit_id, lesson_id, prompt, image_path, explanation, source, source_page, status, program_id, choices: { id, label, is_correct, position }[] }`
  - `saveQuestion(client, input: QuestionInput): Promise<string>`, **dans une transaction**. Crée la question en brouillon, ou la met à jour en remplaçant ses choix. `QuestionInput = { id?, unit_id, lesson_id, prompt, image_path, explanation, source, choices: { label, is_correct }[] }`
  - `setQuestionStatus(client, id, status): Promise<void>`, **dans une transaction** : `validee` déclenche immédiatement le contrôle du Plan 1
  - `deleteQuestion(db, id): Promise<void>`

- [ ] **Step 1 : Écrire le test qui échoue**

`packages/admin/test/questions.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createPath, createQuestion, createUser, withTx } from "../../db/test/helpers.js";
import { adminMessage } from "../lib/errors";
import { deleteQuestion, getQuestion, listQuestions, saveQuestion, setQuestionStatus } from "../lib/data/questions";

const base = (unitId: string, lessonId: string | null) => ({
  unit_id: unitId,
  lesson_id: lessonId,
  prompt: "Quel est ce panneau ?",
  image_path: null,
  explanation: "Le mot STOP identifie ce panneau.",
  source: "Livre du code, p. 12",
  choices: [
    { label: "Stop", is_correct: true },
    { label: "Stationnement", is_correct: false },
    { label: "  ", is_correct: false }, // ligne vide du formulaire : ignorée
  ],
});

describe("questions", () => {
  it("crée une question en brouillon en ignorant les choix vides", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const id = await saveQuestion(db, base(unitId, lessonId));
      const q = await getQuestion(db, id);
      expect(q.status).toBe("brouillon");
      expect(q.choices.map((c) => [c.label, c.is_correct, c.position])).toEqual([["Stop", true, 1], ["Stationnement", false, 2]]);
    }));

  it("valide une question complète, puis la renvoie en validation si on la modifie", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const id = await saveQuestion(db, base(unitId, lessonId));
      await setQuestionStatus(db, id, "validee");
      expect((await getQuestion(db, id)).status).toBe("validee");
      await saveQuestion(db, { ...base(unitId, lessonId), id, prompt: "Que signifie ce panneau ?" });
      expect((await getQuestion(db, id)).status).toBe("en_validation");
    }));

  it("refuse de valider une question sans bonne réponse, avec un message clair", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const id = await saveQuestion(db, {
        ...base(unitId, lessonId),
        choices: [{ label: "A", is_correct: false }, { label: "B", is_correct: false }],
      });
      const error = await setQuestionStatus(db, id, "validee").catch((e) => e);
      expect(adminMessage(error)).toBe("Validation impossible : aucune bonne réponse.");
    }));

  it("refuse plus de 8 choix", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const choices = Array.from({ length: 9 }, (_, i) => ({ label: `Choix ${i}`, is_correct: i === 0 }));
      await expect(saveQuestion(db, { ...base(unitId, lessonId), choices })).rejects.toThrow();
    }));

  it("filtre par statut, cherche dans l'énoncé et compte les signalements ouverts", () =>
    withTx(async (db) => {
      const { programId, unitId, lessonId } = await createPath(db);
      const validated = await createQuestion(db, { unitId, lessonId, status: "validee" });
      await createQuestion(db, { unitId, lessonId });
      await createUser(db, "user-a");
      await db.query("select create_report('user-a', $1, 'probleme_image', null)", [validated.id]);

      const onlyValidated = await listQuestions(db, { programId, status: "validee" });
      expect(onlyValidated.total).toBe(1);
      expect(onlyValidated.rows[0]).toMatchObject({ id: validated.id, open_reports: 1, unit_title: "Unité 1", lesson_title: "Leçon 1" });
      expect((await listQuestions(db, { programId, search: "panneau" })).total).toBe(2);
      expect((await listQuestions(db, { programId, search: "introuvable" })).total).toBe(0);
    }));

  it("supprime une question", () =>
    withTx(async (db) => {
      const { programId, unitId, lessonId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId });
      await deleteQuestion(db, q.id);
      expect((await listQuestions(db, { programId })).total).toBe(0);
    }));
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npm test -w @drivelearn/admin`
Expected: `questions.test.ts` échoue (`Cannot find module '../lib/data/questions'`).

- [ ] **Step 3 : Écrire la couche de données**

`packages/admin/lib/data/questions.ts` :

```ts
import { z } from "zod";
import { AdminError } from "../errors";
import type { Queryable } from "./types";

export type QuestionStatus = "brouillon" | "a_verifier" | "en_validation" | "validee";
export type QuestionListRow = {
  id: string;
  prompt: string;
  status: QuestionStatus;
  unit_title: string;
  lesson_title: string | null;
  open_reports: number;
  updated_at: Date;
};
export type QuestionDetail = {
  id: string;
  program_id: string;
  unit_id: string;
  lesson_id: string | null;
  prompt: string;
  image_path: string | null;
  explanation: string | null;
  source: string | null;
  source_page: string | null;
  status: QuestionStatus;
  choices: { id: string; label: string; is_correct: boolean; position: number }[];
};

export async function listQuestions(
  db: Queryable,
  f: { programId: string; unitId?: string; status?: QuestionStatus; search?: string; limit?: number; offset?: number },
): Promise<{ rows: QuestionListRow[]; total: number }> {
  const where = ["u.program_id = $1"];
  const values: unknown[] = [f.programId];
  if (f.unitId) where.push(`q.unit_id = $${values.push(f.unitId)}`);
  if (f.status) where.push(`q.status = $${values.push(f.status)}`);
  if (f.search?.trim()) where.push(`q.prompt ilike $${values.push(`%${f.search.trim()}%`)}`);
  const from = `from questions q join units u on u.id = q.unit_id left join lessons l on l.id = q.lesson_id where ${where.join(" and ")}`;
  const total = (await db.query(`select count(*)::int as n ${from}`, values)).rows[0].n;
  const { rows } = await db.query(
    `select q.id, q.prompt, q.status::text as status, u.title as unit_title, l.title as lesson_title, q.updated_at,
            (select count(*)::int from question_reports r where r.question_id = q.id and r.status <> 'resolu') as open_reports
     ${from}
     order by u.position, l.position nulls last, q.position, q.updated_at
     limit $${values.push(f.limit ?? 50)} offset $${values.push(f.offset ?? 0)}`,
    values,
  );
  return { rows, total };
}

export async function getQuestion(db: Queryable, id: string): Promise<QuestionDetail> {
  const { rows } = await db.query(
    `select q.id, u.program_id, q.unit_id, q.lesson_id, q.prompt, q.image_path, q.explanation, q.source, q.source_page,
            q.status::text as status,
            coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.label, 'is_correct', c.is_correct,
                                                          'position', c.position) order by c.position)
                      from choices c where c.question_id = q.id), '[]'::jsonb) as choices
     from questions q join units u on u.id = q.unit_id where q.id = $1`,
    [id],
  );
  if (!rows[0]) throw new AdminError("Question introuvable.");
  return rows[0];
}

const QuestionInput = z.object({
  id: z.uuid().optional(),
  unit_id: z.uuid(),
  lesson_id: z.uuid().nullable(),
  prompt: z.string().trim().min(1, "Énoncé obligatoire").max(1000),
  image_path: z.string().trim().max(300).nullable(),
  explanation: z.string().trim().max(2000).nullable(),
  source: z.string().trim().max(300).nullable(),
  choices: z
    .array(z.object({ label: z.string().trim().max(300), is_correct: z.boolean() }))
    .transform((cs) => cs.filter((c) => c.label.length > 0))
    .pipe(z.array(z.object({ label: z.string(), is_correct: z.boolean() })).max(8, "8 choix au maximum")),
});
export type QuestionInput = z.input<typeof QuestionInput>;

/** À appeler dans une transaction : met à jour la question et remplace tous ses choix. */
export async function saveQuestion(client: Queryable, input: QuestionInput): Promise<string> {
  const q = QuestionInput.parse(input);
  const fields = [q.unit_id, q.lesson_id, q.prompt, q.image_path || null, q.explanation || null, q.source || null];
  let id = q.id;
  if (id) {
    const res = await client.query(
      `update questions set unit_id = $2, lesson_id = $3, prompt = $4, image_path = $5, explanation = $6, source = $7
       where id = $1`,
      [id, ...fields],
    );
    if (res.rowCount === 0) throw new AdminError("Question introuvable.");
    await client.query("delete from choices where question_id = $1", [id]);
  } else {
    const { rows } = await client.query(
      `insert into questions (unit_id, lesson_id, prompt, image_path, explanation, source)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      fields,
    );
    id = rows[0].id as string;
  }
  for (const [i, c] of q.choices.entries()) {
    await client.query("insert into choices (question_id, label, is_correct, position) values ($1, $2, $3, $4)", [
      id,
      c.label,
      c.is_correct,
      i + 1,
    ]);
  }
  return id;
}

/** À appeler dans une transaction. La validation est contrôlée immédiatement pour afficher l'erreur exacte. */
export async function setQuestionStatus(client: Queryable, id: string, status: QuestionStatus): Promise<void> {
  if (status === "validee") await client.query("set constraints questions_valid immediate");
  const res = await client.query("update questions set status = $2 where id = $1", [id, status]);
  if (res.rowCount === 0) throw new AdminError("Question introuvable.");
}

export async function deleteQuestion(db: Queryable, id: string): Promise<void> {
  await db.query("delete from questions where id = $1", [id]);
}
```

- [ ] **Step 4 : Lancer les tests**

Run: `npm test -w @drivelearn/admin`
Expected: tous les fichiers passent.

- [ ] **Step 5 : Écrire les pages**

`packages/admin/app/(admin)/questions/page.tsx` :

```tsx
import Link from "next/link";
import { Card, Flash, inputClass, PageTitle, StatusBadge, tableClass } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { listPrograms } from "@/lib/data/programs";
import { listQuestions, type QuestionStatus } from "@/lib/data/questions";
import { listUnits } from "@/lib/data/units";
import { pool } from "@/lib/db";

const STATUSES: [QuestionStatus, string][] = [
  ["brouillon", "Brouillon"],
  ["a_verifier", "À vérifier"],
  ["en_validation", "En validation"],
  ["validee", "Validée"],
];

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; unit?: string; status?: QuestionStatus; q?: string; page?: string; ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const programs = await listPrograms(pool);
  const programId = sp.program ?? programs[0]?.id;
  if (!programId) {
    return <PageTitle title="Contenus" subtitle="Créez d'abord un programme." />;
  }
  const page = Math.max(1, Number(sp.page ?? 1));
  const [units, list] = await Promise.all([
    listUnits(pool, programId),
    listQuestions(pool, { programId, unitId: sp.unit || undefined, status: sp.status || undefined, search: sp.q, limit: 50, offset: (page - 1) * 50 }),
  ]);
  return (
    <>
      <PageTitle
        title="Contenus"
        subtitle={`${list.total} question(s)`}
        actions={<Link href={`/questions/nouvelle?program=${programId}`} className="rounded-lg bg-sarcelle px-4 py-2 text-sm font-semibold text-white">Nouvelle question</Link>}
      />
      <Flash ok={sp.ok} error={sp.error} />
      <form className="mb-4 grid grid-cols-5 gap-3">
        <select name="program" defaultValue={programId} className={inputClass}>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="unit" defaultValue={sp.unit ?? ""} className={inputClass}>
          <option value="">Toutes les unités</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className={inputClass}>
          <option value="">Tous les statuts</option>
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Rechercher dans l'énoncé" className={inputClass} />
        <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">Filtrer</button>
      </form>
      <Card>
        <table className={tableClass}>
          <thead><tr><th>Énoncé</th><th>Unité</th><th>Leçon</th><th>Statut</th><th>Signalements</th></tr></thead>
          <tbody>
            {list.rows.map((q) => (
              <tr key={q.id} className="border-t border-slate-100">
                <td><Link href={`/questions/${q.id}`} className="text-bleu underline">{q.prompt.slice(0, 90)}</Link></td>
                <td>{q.unit_title}</td>
                <td>{q.lesson_title ?? "—"}</td>
                <td><StatusBadge status={q.status} /></td>
                <td>{q.open_reports || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex gap-3 text-sm">
          {page > 1 && <Link className="text-bleu underline" href={`?program=${programId}&unit=${sp.unit ?? ""}&status=${sp.status ?? ""}&q=${sp.q ?? ""}&page=${page - 1}`}>Précédent</Link>}
          {page * 50 < list.total && <Link className="text-bleu underline" href={`?program=${programId}&unit=${sp.unit ?? ""}&status=${sp.status ?? ""}&q=${sp.q ?? ""}&page=${page + 1}`}>Suivant</Link>}
        </div>
      </Card>
    </>
  );
}
```

`packages/admin/app/(admin)/questions/[id]/page.tsx` :

```tsx
import { Button, Card, Field, Flash, inputClass, PageTitle, StatusBadge } from "@/components/ui";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/admin";
import { deleteQuestion, getQuestion, saveQuestion, setQuestionStatus, type QuestionDetail, type QuestionStatus } from "@/lib/data/questions";
import { listUnits } from "@/lib/data/units";
import { inTransaction, pool } from "@/lib/db";

const text = (f: FormData, k: string) => String(f.get(k) ?? "");

async function save(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = text(formData, "id") || undefined;
  const programId = text(formData, "program_id");
  const back = id ? `/questions/${id}` : `/questions/nouvelle?program=${programId}`;
  await runAction(back, async () => {
    const [unitId, lessonId] = text(formData, "placement").split(":");
    const choices = Array.from({ length: 8 }, (_, i) => ({
      label: text(formData, `choice_${i}`),
      is_correct: formData.get(`correct_${i}`) === "on",
    }));
    const intent = text(formData, "intent");
    const savedId = await inTransaction(async (client) => {
      const qid = await saveQuestion(client, {
        id,
        unit_id: unitId,
        lesson_id: lessonId || null,
        prompt: text(formData, "prompt"),
        image_path: text(formData, "image_path") || null,
        explanation: text(formData, "explanation") || null,
        source: text(formData, "source") || null,
        choices,
      });
      if (intent === "submit") await setQuestionStatus(client, qid, "en_validation");
      return qid;
    });
    return `/questions/${savedId}`;
  });
}

async function changeStatus(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = text(formData, "id");
  await runAction(`/questions/${id}`, async () => {
    await inTransaction((client) => setQuestionStatus(client, id, text(formData, "status") as QuestionStatus));
  });
}

async function remove(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = text(formData, "id");
  const programId = text(formData, "program_id");
  await runAction(`/questions/${id}`, async () => {
    await deleteQuestion(pool, id);
    return `/questions?program=${programId}`;
  });
}

export default async function QuestionEditor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ program?: string; ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "nouvelle";
  const question: QuestionDetail | null = isNew ? null : await getQuestion(pool, id);
  const programId = question?.program_id ?? sp.program ?? "";
  const units = await listUnits(pool, programId);
  const choices = Array.from({ length: 8 }, (_, i) => question?.choices[i] ?? { label: "", is_correct: false });
  const placement = question ? `${question.unit_id}:${question.lesson_id ?? ""}` : "";

  return (
    <>
      <PageTitle
        title={isNew ? "Nouvelle question" : "Modifier la question"}
        actions={question && <StatusBadge status={question.status} />}
      />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card>
            <form action={save} className="space-y-4">
              <input type="hidden" name="id" value={question?.id ?? ""} />
              <input type="hidden" name="program_id" value={programId} />
              <Field label="Leçon">
                <select name="placement" defaultValue={placement} required className={inputClass}>
                  <option value="" disabled>Choisir une leçon</option>
                  {units.map((u) => (
                    <optgroup key={u.id} label={u.title}>
                      <option value={`${u.id}:`}>{u.title} — sans leçon</option>
                      {u.lessons.map((l) => <option key={l.id} value={`${u.id}:${l.id}`}>{l.title}</option>)}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label="Énoncé"><textarea name="prompt" required rows={2} defaultValue={question?.prompt ?? ""} className={inputClass} /></Field>
              <Field label="Image (chemin)" hint="L'envoi d'images arrive avec le plan 4."><input name="image_path" defaultValue={question?.image_path ?? ""} className={inputClass} /></Field>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Réponses (cochez la ou les bonnes réponses)</p>
                {choices.map((c, i) => (
                  <div key={i} className="mb-2 flex items-center gap-3">
                    <span className="w-6 text-sm font-semibold text-slate-500">{String.fromCharCode(65 + i)}</span>
                    <input name={`choice_${i}`} defaultValue={c.label} className={inputClass} />
                    <label className="flex shrink-0 items-center gap-1 text-sm">
                      <input type="checkbox" name={`correct_${i}`} defaultChecked={c.is_correct} /> Correcte
                    </label>
                  </div>
                ))}
              </div>
              <Field label="Explication"><textarea name="explanation" rows={2} defaultValue={question?.explanation ?? ""} className={inputClass} /></Field>
              <Field label="Source"><input name="source" defaultValue={question?.source ?? ""} placeholder="Livre du code, page…" className={inputClass} /></Field>
              <div className="flex gap-2">
                <Button variant="secondary" name="intent" value="save">Enregistrer</Button>
                <Button name="intent" value="submit">Soumettre à validation</Button>
              </div>
            </form>
          </Card>
          {question && (
            <Card title="Statut">
              <div className="flex flex-wrap gap-2">
                {(["validee", "en_validation", "a_verifier", "brouillon"] as const).map((s) => (
                  <form key={s} action={changeStatus}>
                    <input type="hidden" name="id" value={question.id} />
                    <input type="hidden" name="status" value={s} />
                    <Button variant={s === "validee" ? "primary" : "secondary"}>
                      {{ validee: "Valider", en_validation: "Mettre en validation", a_verifier: "Marquer à vérifier", brouillon: "Repasser en brouillon" }[s]}
                    </Button>
                  </form>
                ))}
                <form action={remove} className="ml-auto">
                  <input type="hidden" name="id" value={question.id} />
                  <input type="hidden" name="program_id" value={programId} />
                  <Button variant="danger">Supprimer</Button>
                </form>
              </div>
            </Card>
          )}
        </div>
        <Card title="Aperçu élève">
          {question?.image_path && <p className="mb-2 text-xs text-slate-500">Image : {question.image_path}</p>}
          <p className="mb-3 font-semibold text-nuit">{question?.prompt ?? "L'énoncé apparaîtra ici."}</p>
          <p className="mb-3 text-xs text-slate-500">
            {(question?.choices.filter((c) => c.is_correct).length ?? 0) > 1 ? "Plusieurs réponses possibles" : "Une seule réponse"}
          </p>
          {question?.choices.map((c, i) => (
            <div key={c.id} className="mb-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
              <b className="mr-2">{String.fromCharCode(65 + i)}</b>{c.label}
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
```

- [ ] **Step 6 : Vérifier et commiter**

Run: `npm run typecheck -w @drivelearn/admin` puis `npm run build -w @drivelearn/admin`
Expected: aucune erreur.

```bash
git add packages/admin
git commit -m "feat(admin): éditeur de questions et circuit de validation"
```

---

### Task 4 : Paramètres d'examen, conformité et publication

**Files:**
- Modify: `packages/admin/lib/data/programs.ts` (ajouter les trois fonctions)
- Create: `packages/admin/app/(admin)/programmes/[id]/examen/page.tsx`
- Test: `packages/admin/test/exam.test.ts`

**Interfaces:**
- Consumes: `getProgram`, `listUnits` (Task 2)
- Produces:
  - `examConformity(db, programId): Promise<{ problems: string[]; validated_total: number; distribution_sum: number; units: { unit_id, title, requested, available }[] }>`
  - `updateExamSettings(db, programId, input: { exam_question_count, exam_pass_mark, exam_seconds_per_question, exam_distribution: Record<string, number> }): Promise<void>`. Les unités à 0 sont retirées de la répartition. Une unité d'un autre programme est refusée.
  - `setProgramStatus(db, programId, status): Promise<void>` : `publie` est refusé tant que `problems` n'est pas vide.

- [ ] **Step 1 : Écrire le test qui échoue**

`packages/admin/test/exam.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createPath, createQuestion, createUnit, withTx } from "../../db/test/helpers.js";
import { examConformity, getProgram, setProgramStatus, updateExamSettings } from "../lib/data/programs";

describe("examen et publication", () => {
  it("signale une banque insuffisante et refuse la publication", () =>
    withTx(async (db) => {
      const { programId, unitId, lessonId } = await createPath(db, { examQuestionCount: 3, examPassMark: 2 });
      await createQuestion(db, { unitId, lessonId, status: "validee" });
      const c = await examConformity(db, programId);
      expect(c.problems).toEqual(["Banque insuffisante : 1 question(s) validée(s) pour 3 demandée(s)."]);
      await expect(setProgramStatus(db, programId, "publie")).rejects.toThrow("Banque insuffisante");
    }));

  it("vérifie la répartition par unité", () =>
    withTx(async (db) => {
      const { programId, unitId, lessonId } = await createPath(db, { examQuestionCount: 2, examPassMark: 1 });
      const other = await createUnit(db, programId, 2);
      await createQuestion(db, { unitId, lessonId, status: "validee" });
      await createQuestion(db, { unitId, lessonId, status: "validee" });
      await updateExamSettings(db, programId, {
        exam_question_count: 2,
        exam_pass_mark: 1,
        exam_seconds_per_question: 30,
        exam_distribution: { [unitId]: 1, [other]: 2 },
      });
      const c = await examConformity(db, programId);
      expect(c.problems).toEqual([
        "La répartition totalise 3 question(s) au lieu de 2.",
        "L'unité « Unité 2 » n'a que 0 question(s) validée(s) pour 2 demandée(s).",
      ]);
    }));

  it("publie un programme conforme", () =>
    withTx(async (db) => {
      const { programId, unitId, lessonId } = await createPath(db, { examQuestionCount: 1, examPassMark: 1 });
      await createQuestion(db, { unitId, lessonId, status: "validee" });
      expect((await examConformity(db, programId)).problems).toEqual([]);
      await setProgramStatus(db, programId, "publie");
      expect((await getProgram(db, programId)).status).toBe("publie");
    }));

  it("enregistre les paramètres et retire les unités à zéro", () =>
    withTx(async (db) => {
      const { programId, unitId } = await createPath(db);
      const other = await createUnit(db, programId, 2);
      await updateExamSettings(db, programId, {
        exam_question_count: 20,
        exam_pass_mark: 13,
        exam_seconds_per_question: 25,
        exam_distribution: { [unitId]: 20, [other]: 0 },
      });
      const p = await getProgram(db, programId);
      expect({ seconds: p.exam_seconds_per_question, distribution: p.exam_distribution }).toEqual({ seconds: 25, distribution: { [unitId]: 20 } });
    }));

  it("refuse une unité d'un autre programme et un seuil impossible", () =>
    withTx(async (db) => {
      const a = await createPath(db);
      await db.query("update programs set license_type = 'moto' where id = $1", [a.programId]);
      const b = await createPath(db);
      const settings = { exam_question_count: 20, exam_pass_mark: 13, exam_seconds_per_question: 30 };
      await expect(updateExamSettings(db, b.programId, { ...settings, exam_distribution: { [a.unitId]: 5 } })).rejects.toThrow("Unité inconnue");
      await expect(updateExamSettings(db, b.programId, { ...settings, exam_pass_mark: 25, exam_distribution: {} })).rejects.toThrow();
    }));
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npm test -w @drivelearn/admin`
Expected: `exam.test.ts` échoue (`examConformity` n'est pas exporté).

- [ ] **Step 3 : Ajouter les fonctions à `lib/data/programs.ts`**

À la fin de `packages/admin/lib/data/programs.ts` :

```ts
export async function examConformity(db: Queryable, programId: string) {
  const program = await getProgram(db, programId);
  const { rows: units } = await db.query(
    `select u.id as unit_id, u.title,
            (select count(*)::int from questions q where q.unit_id = u.id and q.status = 'validee') as available
     from units u where u.program_id = $1 order by u.position`,
    [programId],
  );
  const distribution = program.exam_distribution ?? {};
  const requested = units
    .filter((u) => distribution[u.unit_id] !== undefined)
    .map((u) => ({ ...u, requested: distribution[u.unit_id] as number }));
  const distributionSum = Object.values(distribution).reduce((a, b) => a + b, 0);
  const validatedTotal = units.reduce((a, u) => a + u.available, 0);

  const problems: string[] = [];
  if (validatedTotal < program.exam_question_count) {
    problems.push(`Banque insuffisante : ${validatedTotal} question(s) validée(s) pour ${program.exam_question_count} demandée(s).`);
  }
  if (Object.keys(distribution).length > 0 && distributionSum !== program.exam_question_count) {
    problems.push(`La répartition totalise ${distributionSum} question(s) au lieu de ${program.exam_question_count}.`);
  }
  for (const u of requested) {
    if (u.available < u.requested) {
      problems.push(`L'unité « ${u.title} » n'a que ${u.available} question(s) validée(s) pour ${u.requested} demandée(s).`);
    }
  }
  return { problems, validated_total: validatedTotal, distribution_sum: distributionSum, units: requested };
}

const ExamSettings = z.object({
  exam_question_count: z.number().int().min(1).max(100),
  exam_pass_mark: z.number().int().min(1),
  exam_seconds_per_question: z.number().int().min(5).max(600),
  exam_distribution: z.record(z.string(), z.number().int().min(0).max(100)),
});

export async function updateExamSettings(db: Queryable, programId: string, input: z.input<typeof ExamSettings>): Promise<void> {
  const s = ExamSettings.parse(input);
  if (s.exam_pass_mark > s.exam_question_count) throw new AdminError("Le seuil ne peut pas dépasser le nombre de questions.");
  const distribution = Object.fromEntries(Object.entries(s.exam_distribution).filter(([, n]) => n > 0));
  const ids = Object.keys(distribution);
  if (ids.length > 0) {
    const { rows } = await db.query("select count(*)::int as n from units where program_id = $1 and id::text = any($2)", [programId, ids]);
    if (rows[0].n !== ids.length) throw new AdminError("Unité inconnue dans la répartition.");
  }
  await db.query(
    `update programs set exam_question_count = $2, exam_pass_mark = $3, exam_seconds_per_question = $4, exam_distribution = $5
     where id = $1`,
    [programId, s.exam_question_count, s.exam_pass_mark, s.exam_seconds_per_question, JSON.stringify(distribution)],
  );
}

export async function setProgramStatus(db: Queryable, programId: string, status: ProgramRow["status"]): Promise<void> {
  if (status === "publie") {
    const { problems } = await examConformity(db, programId);
    if (problems.length > 0) throw new AdminError(`Publication impossible. ${problems.join(" ")}`);
  }
  await db.query("update programs set status = $2 where id = $1", [programId, status]);
}
```

- [ ] **Step 4 : Lancer les tests**

Run: `npm test -w @drivelearn/admin`
Expected: tous les fichiers passent.

- [ ] **Step 5 : Écrire la page**

`packages/admin/app/(admin)/programmes/[id]/examen/page.tsx` :

```tsx
import { Button, Card, Field, Flash, inputClass, PageTitle, StatusBadge } from "@/components/ui";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/admin";
import { examConformity, getProgram, setProgramStatus, updateExamSettings, type ProgramRow } from "@/lib/data/programs";
import { listUnits } from "@/lib/data/units";
import { pool } from "@/lib/db";

async function saveSettings(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("program_id"));
  await runAction(`/programmes/${id}/examen`, async () => {
    const distribution: Record<string, number> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("unit_") && String(value).trim() !== "") distribution[key.slice(5)] = Number(value);
    }
    await updateExamSettings(pool, id, {
      exam_question_count: Number(formData.get("exam_question_count")),
      exam_pass_mark: Number(formData.get("exam_pass_mark")),
      exam_seconds_per_question: Number(formData.get("exam_seconds_per_question")),
      exam_distribution: distribution,
    });
  });
}

async function changeStatus(formData: FormData) {
  "use server";
  await requireAdmin();
  const id = String(formData.get("program_id"));
  await runAction(`/programmes/${id}/examen`, () => setProgramStatus(pool, id, String(formData.get("status")) as ProgramRow["status"]));
}

export default async function ExamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [program, units, conformity, flash] = await Promise.all([getProgram(pool, id), listUnits(pool, id), examConformity(pool, id), searchParams]);
  return (
    <>
      <PageTitle title="Configurer l'examen blanc" subtitle={program.name} actions={<StatusBadge status={program.status} />} />
      <Flash {...flash} />
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <Card title="Paramètres généraux">
            <form action={saveSettings} className="space-y-4">
              <input type="hidden" name="program_id" value={id} />
              <div className="grid grid-cols-3 gap-3">
                <Field label="Nombre de questions"><input name="exam_question_count" type="number" min={1} max={100} defaultValue={program.exam_question_count} className={inputClass} /></Field>
                <Field label="Seuil de réussite"><input name="exam_pass_mark" type="number" min={1} defaultValue={program.exam_pass_mark} className={inputClass} /></Field>
                <Field label="Secondes par question"><input name="exam_seconds_per_question" type="number" min={5} max={600} defaultValue={program.exam_seconds_per_question} className={inputClass} /></Field>
              </div>
              <p className="text-sm font-medium text-slate-700">Répartition par thème (vide = tirage libre sur tout le programme)</p>
              {units.map((u) => (
                <Field key={u.id} label={u.title}>
                  <input name={`unit_${u.id}`} type="number" min={0} max={100} defaultValue={program.exam_distribution[u.id] ?? ""} className={inputClass} />
                </Field>
              ))}
              <Button>Enregistrer</Button>
            </form>
          </Card>
        </div>
        <div>
          <Card title="Validation et conformité">
            <p className="mb-2 text-sm">{conformity.validated_total} question(s) validée(s) dans le programme.</p>
            {conformity.problems.length === 0 ? (
              <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">L'examen est conforme.</p>
            ) : (
              <ul className="list-disc space-y-1 rounded-lg bg-amber-50 p-3 pl-6 text-sm text-amber-800">
                {conformity.problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            )}
          </Card>
          <Card title="Publication">
            <div className="flex flex-col gap-2">
              {(["publie", "en_validation", "brouillon"] as const).map((s) => (
                <form key={s} action={changeStatus}>
                  <input type="hidden" name="program_id" value={id} />
                  <input type="hidden" name="status" value={s} />
                  <Button variant={s === "publie" ? "primary" : "secondary"}>
                    {{ publie: "Publier", en_validation: "Mettre en validation", brouillon: "Repasser en brouillon" }[s]}
                  </Button>
                </form>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 6 : Vérifier et commiter**

Run: `npm run typecheck -w @drivelearn/admin` puis `npm run build -w @drivelearn/admin`
Expected: aucune erreur.

```bash
git add packages/admin
git commit -m "feat(admin): paramètres d'examen, conformité et publication"
```

---

### Task 5 : Signalements, auto-écoles et réglages

**Files:**
- Create: `packages/admin/lib/data/reports.ts`, `lib/data/schools.ts`, `lib/data/settings.ts`
- Create: `packages/admin/app/(admin)/signalements/page.tsx`, `app/(admin)/auto-ecoles/page.tsx`, `app/(admin)/reglages/page.tsx`
- Test: `packages/admin/test/reports.test.ts`, `test/schools.test.ts`, `test/settings.test.ts`

**Interfaces:**
- Produces:
  - `listReports(db, status?: "nouveau" | "en_cours" | "resolu")` → `{ id, question_id, prompt, reason, comment, status, admin_note, created_at }[]` (les plus récents d'abord) ; `updateReport(db, id, { status, admin_note })`
  - `listSchools(db)` → `{ id, name, promo_code, discount_percent, commission_percent, active, students, confirmed_sales }[]` ; `createSchool(db, { name, promo_code, discount_percent, commission_percent })` ; `updateSchool(db, id, { name, discount_percent, commission_percent, active })`
  - `getSettings(db)` → `{ pass_price_xof, pass_duration_days, xp_per_session, xp_perfect_bonus, ready_after_consecutive_passes, max_review_per_lesson }` ; `updateSettings(db, partial)`

- [ ] **Step 1 : Écrire les tests qui échouent**

`packages/admin/test/reports.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createPath, createQuestion, createUser, withTx } from "../../db/test/helpers.js";
import { listReports, updateReport } from "../lib/data/reports";

describe("signalements", () => {
  it("liste les signalements par statut et enregistre le traitement", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId, status: "validee" });
      await createUser(db, "user-a");
      const { rows } = await db.query("select id from create_report('user-a', $1, 'explication_peu_claire', 'Pas clair')", [q.id]);

      const nouveaux = await listReports(db, "nouveau");
      expect(nouveaux).toHaveLength(1);
      expect(nouveaux[0]).toMatchObject({ question_id: q.id, prompt: "Quel est ce panneau ?", reason: "explication_peu_claire", comment: "Pas clair" });

      await updateReport(db, rows[0].id, { status: "resolu", admin_note: "Explication réécrite." });
      expect(await listReports(db, "nouveau")).toHaveLength(0);
      expect((await listReports(db, "resolu"))[0].admin_note).toBe("Explication réécrite.");
    }));
});
```

`packages/admin/test/schools.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createUser, withTx } from "../../db/test/helpers.js";
import { createSchool, listSchools, updateSchool } from "../lib/data/schools";

describe("auto-écoles", () => {
  it("crée une auto-école avec un code promo en majuscules et compte ses élèves", () =>
    withTx(async (db) => {
      const id = await createSchool(db, { name: "Auto-école Le Volant", promo_code: " volant ", discount_percent: 10, commission_percent: 15 });
      await createUser(db, "user-a");
      await db.query("select set_promo_code('user-a', 'VOLANT')");
      const [school] = await listSchools(db);
      expect(school).toMatchObject({ id, promo_code: "VOLANT", discount_percent: 10, commission_percent: 15, active: true, students: 1, confirmed_sales: 0 });
    }));

  it("refuse un code promo déjà pris ou un taux hors limites", () =>
    withTx(async (db) => {
      await createSchool(db, { name: "A", promo_code: "VOLANT", discount_percent: 10, commission_percent: 10 });
      await expect(createSchool(db, { name: "B", promo_code: "volant", discount_percent: 10, commission_percent: 10 })).rejects.toMatchObject({ code: "23505" });
      await expect(createSchool(db, { name: "C", promo_code: "AUTRE", discount_percent: 150, commission_percent: 10 })).rejects.toThrow();
    }));

  it("modifie les taux et désactive", () =>
    withTx(async (db) => {
      const id = await createSchool(db, { name: "A", promo_code: "VOLANT", discount_percent: 10, commission_percent: 10 });
      await updateSchool(db, id, { name: "A bis", discount_percent: 5, commission_percent: 20, active: false });
      expect((await listSchools(db))[0]).toMatchObject({ name: "A bis", discount_percent: 5, commission_percent: 20, active: false });
    }));
});
```

`packages/admin/test/settings.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { scalar, withTx } from "../../db/test/helpers.js";
import { getSettings, updateSettings } from "../lib/data/settings";

describe("réglages", () => {
  it("lit et modifie les réglages globaux", () =>
    withTx(async (db) => {
      expect(await getSettings(db)).toEqual({
        pass_price_xof: 3000,
        pass_duration_days: 90,
        xp_per_session: 10,
        xp_perfect_bonus: 5,
        ready_after_consecutive_passes: 3,
        max_review_per_lesson: 2,
      });
      await updateSettings(db, { pass_price_xof: 2500 });
      expect(await scalar<number>(db, "select setting_int('pass_price_xof')")).toBe(2500);
    }));

  it("refuse un prix négatif", () =>
    withTx(async (db) => {
      await expect(updateSettings(db, { pass_price_xof: -1 })).rejects.toThrow();
    }));
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -w @drivelearn/admin`
Expected: les trois fichiers échouent au chargement.

- [ ] **Step 3 : Écrire la couche de données**

`packages/admin/lib/data/reports.ts` :

```ts
import { z } from "zod";
import type { Queryable } from "./types";

export type ReportStatus = "nouveau" | "en_cours" | "resolu";

export async function listReports(db: Queryable, status?: ReportStatus) {
  const { rows } = await db.query(
    `select r.id, r.question_id, q.prompt, r.reason::text as reason, r.comment, r.status::text as status,
            r.admin_note, r.created_at
     from question_reports r join questions q on q.id = r.question_id
     where ($1::text is null or r.status::text = $1)
     order by r.created_at desc limit 200`,
    [status ?? null],
  );
  return rows as { id: string; question_id: string; prompt: string; reason: string; comment: string | null; status: ReportStatus; admin_note: string | null; created_at: Date }[];
}

const ReportUpdate = z.object({
  status: z.enum(["nouveau", "en_cours", "resolu"]),
  admin_note: z.string().trim().max(1000).nullable(),
});

export async function updateReport(db: Queryable, id: string, input: z.input<typeof ReportUpdate>): Promise<void> {
  const r = ReportUpdate.parse(input);
  await db.query("update question_reports set status = $2, admin_note = $3, updated_at = now() where id = $1", [
    id,
    r.status,
    r.admin_note || null,
  ]);
}
```

`packages/admin/lib/data/schools.ts` :

```ts
import { z } from "zod";
import type { Queryable } from "./types";

const Percent = z.number().int().min(0, "Pourcentage entre 0 et 100").max(100, "Pourcentage entre 0 et 100");
const NewSchool = z.object({
  name: z.string().trim().min(1, "Nom obligatoire").max(120),
  promo_code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{3,20}$/, "Code promo : 3 à 20 lettres ou chiffres")),
  discount_percent: Percent,
  commission_percent: Percent,
});
const SchoolUpdate = z.object({
  name: z.string().trim().min(1).max(120),
  discount_percent: Percent,
  commission_percent: Percent,
  active: z.boolean(),
});

export async function listSchools(db: Queryable) {
  const { rows } = await db.query(
    `select s.id, s.name, s.promo_code, s.discount_percent, s.commission_percent, s.active,
            (select count(*)::int from profiles p where p.driving_school_id = s.id) as students,
            (select count(*)::int from payments pay where pay.driving_school_id = s.id and pay.status = 'confirmed') as confirmed_sales
     from driving_schools s order by s.name`,
  );
  return rows as { id: string; name: string; promo_code: string; discount_percent: number; commission_percent: number; active: boolean; students: number; confirmed_sales: number }[];
}

export async function createSchool(db: Queryable, input: z.input<typeof NewSchool>): Promise<string> {
  const s = NewSchool.parse(input);
  const { rows } = await db.query(
    "insert into driving_schools (name, promo_code, discount_percent, commission_percent) values ($1, $2, $3, $4) returning id",
    [s.name, s.promo_code, s.discount_percent, s.commission_percent],
  );
  return rows[0].id;
}

export async function updateSchool(db: Queryable, id: string, input: z.input<typeof SchoolUpdate>): Promise<void> {
  const s = SchoolUpdate.parse(input);
  await db.query(
    "update driving_schools set name = $2, discount_percent = $3, commission_percent = $4, active = $5 where id = $1",
    [id, s.name, s.discount_percent, s.commission_percent, s.active],
  );
}
```

`packages/admin/lib/data/settings.ts` :

```ts
import { z } from "zod";
import type { Queryable } from "./types";

const Settings = z.object({
  pass_price_xof: z.number().int().min(0).max(1_000_000),
  pass_duration_days: z.number().int().min(1).max(365),
  xp_per_session: z.number().int().min(0).max(1000),
  xp_perfect_bonus: z.number().int().min(0).max(1000),
  ready_after_consecutive_passes: z.number().int().min(1).max(20),
  max_review_per_lesson: z.number().int().min(0).max(8),
});
export type SettingsValues = z.infer<typeof Settings>;

export async function getSettings(db: Queryable): Promise<SettingsValues> {
  const { rows } = await db.query("select key, (value #>> '{}')::int as value from settings where key = any($1)", [
    Object.keys(Settings.shape),
  ]);
  return Settings.parse(Object.fromEntries(rows.map((r) => [r.key, r.value])));
}

export async function updateSettings(db: Queryable, input: Partial<SettingsValues>): Promise<void> {
  const values = Settings.partial().parse(input);
  for (const [key, value] of Object.entries(values)) {
    await db.query("update settings set value = to_jsonb($2::int) where key = $1", [key, value]);
  }
}
```

- [ ] **Step 4 : Lancer les tests**

Run: `npm test -w @drivelearn/admin`
Expected: tous les fichiers passent.

- [ ] **Step 5 : Écrire les pages**

`packages/admin/app/(admin)/signalements/page.tsx` :

```tsx
import Link from "next/link";
import { Button, Card, Flash, inputClass, PageTitle, StatusBadge } from "@/components/ui";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/admin";
import { listReports, updateReport, type ReportStatus } from "@/lib/data/reports";
import { pool } from "@/lib/db";

const REASONS: Record<string, string> = {
  reponse_incorrecte: "Réponse incorrecte",
  explication_peu_claire: "Explication peu claire",
  probleme_image: "Problème d'image",
};

async function save(formData: FormData) {
  "use server";
  await requireAdmin();
  const back = String(formData.get("back"));
  await runAction(back, () =>
    updateReport(pool, String(formData.get("id")), {
      status: String(formData.get("status")) as ReportStatus,
      admin_note: String(formData.get("admin_note") ?? "") || null,
    }),
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ status?: ReportStatus; ok?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = sp.status ?? "nouveau";
  const reports = await listReports(pool, status);
  return (
    <>
      <PageTitle title="Qualité des questions" subtitle="Signalements envoyés par les élèves." />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="mb-4 flex gap-2">
        {(["nouveau", "en_cours", "resolu"] as const).map((s) => (
          <Link key={s} href={`?status=${s}`} className={`rounded-full px-4 py-1.5 text-sm ${s === status ? "bg-bleu text-white" : "bg-white text-slate-700"}`}>
            <StatusBadge status={s} />
          </Link>
        ))}
      </div>
      {reports.length === 0 && <p className="text-sm text-slate-500">Aucun signalement.</p>}
      {reports.map((r) => (
        <Card key={r.id}>
          <div className="mb-3 flex items-center justify-between">
            <p className="font-semibold text-nuit">{REASONS[r.reason] ?? r.reason}</p>
            <span className="text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
          </div>
          <p className="mb-1 text-sm">Question : <Link href={`/questions/${r.question_id}`} className="text-bleu underline">{r.prompt.slice(0, 100)}</Link></p>
          {r.comment && <p className="mb-3 rounded-lg bg-slate-50 p-3 text-sm">{r.comment}</p>}
          <form action={save} className="flex items-end gap-3">
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="back" value={`/signalements?status=${status}`} />
            <textarea name="admin_note" defaultValue={r.admin_note ?? ""} placeholder="Note de traitement" rows={1} className={inputClass} />
            <select name="status" defaultValue={r.status} className={`${inputClass} w-40`}>
              <option value="nouveau">Nouveau</option>
              <option value="en_cours">En cours</option>
              <option value="resolu">Résolu</option>
            </select>
            <Button>Enregistrer</Button>
          </form>
        </Card>
      ))}
    </>
  );
}
```

`packages/admin/app/(admin)/auto-ecoles/page.tsx` :

```tsx
import { Button, Card, Field, Flash, inputClass, PageTitle, tableClass } from "@/components/ui";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/admin";
import { createSchool, listSchools, updateSchool } from "@/lib/data/schools";
import { pool } from "@/lib/db";

async function create(formData: FormData) {
  "use server";
  await requireAdmin();
  await runAction("/auto-ecoles", async () => {
    await createSchool(pool, {
      name: String(formData.get("name")),
      promo_code: String(formData.get("promo_code")),
      discount_percent: Number(formData.get("discount_percent")),
      commission_percent: Number(formData.get("commission_percent")),
    });
  });
}

async function update(formData: FormData) {
  "use server";
  await requireAdmin();
  await runAction("/auto-ecoles", () =>
    updateSchool(pool, String(formData.get("id")), {
      name: String(formData.get("name")),
      discount_percent: Number(formData.get("discount_percent")),
      commission_percent: Number(formData.get("commission_percent")),
      active: formData.get("active") === "on",
    }),
  );
}

export default async function SchoolsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const [schools, flash] = await Promise.all([listSchools(pool), searchParams]);
  return (
    <>
      <PageTitle title="Auto-écoles partenaires" subtitle="Codes promo, réductions et commissions." />
      <Flash {...flash} />
      <Card>
        <table className={tableClass}>
          <thead><tr><th>Nom</th><th>Code</th><th>Réduction %</th><th>Commission %</th><th>Active</th><th>Élèves</th><th>Ventes</th><th /></tr></thead>
          <tbody>
            {schools.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td colSpan={8}>
                  <form action={update} className="grid grid-cols-8 items-center gap-2">
                    <input type="hidden" name="id" value={s.id} />
                    <input name="name" defaultValue={s.name} className={inputClass} />
                    <span className="font-mono text-sm">{s.promo_code}</span>
                    <input name="discount_percent" type="number" min={0} max={100} defaultValue={s.discount_percent} className={inputClass} />
                    <input name="commission_percent" type="number" min={0} max={100} defaultValue={s.commission_percent} className={inputClass} />
                    <input name="active" type="checkbox" defaultChecked={s.active} />
                    <span>{s.students}</span>
                    <span>{s.confirmed_sales}</span>
                    <Button variant="secondary">Enregistrer</Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Nouvelle auto-école">
        <form action={create} className="grid grid-cols-5 items-end gap-3">
          <Field label="Nom"><input name="name" required className={inputClass} /></Field>
          <Field label="Code promo"><input name="promo_code" required placeholder="VOLANT" className={inputClass} /></Field>
          <Field label="Réduction %"><input name="discount_percent" type="number" min={0} max={100} defaultValue={10} className={inputClass} /></Field>
          <Field label="Commission %"><input name="commission_percent" type="number" min={0} max={100} defaultValue={10} className={inputClass} /></Field>
          <Button>Créer</Button>
        </form>
      </Card>
    </>
  );
}
```

`packages/admin/app/(admin)/reglages/page.tsx` :

```tsx
import { Button, Card, Field, Flash, inputClass, PageTitle } from "@/components/ui";
import { runAction } from "@/lib/actions";
import { requireAdmin } from "@/lib/admin";
import { getSettings, updateSettings, type SettingsValues } from "@/lib/data/settings";
import { pool } from "@/lib/db";

const LABELS: Record<keyof SettingsValues, string> = {
  pass_price_xof: "Prix du Pass Examen (FCFA)",
  pass_duration_days: "Durée du Pass (jours)",
  xp_per_session: "XP par séance",
  xp_perfect_bonus: "Bonus XP sans faute",
  ready_after_consecutive_passes: "Réussites consécutives pour « Prêt pour l'examen »",
  max_review_per_lesson: "Erreurs réinjectées par leçon",
};

async function save(formData: FormData) {
  "use server";
  await requireAdmin();
  await runAction("/reglages", () =>
    updateSettings(pool, Object.fromEntries(Object.keys(LABELS).map((k) => [k, Number(formData.get(k))])) as SettingsValues),
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireAdmin();
  const [settings, flash] = await Promise.all([getSettings(pool), searchParams]);
  return (
    <>
      <PageTitle title="Réglages" subtitle="Valeurs communes à tous les programmes." />
      <Flash {...flash} />
      <Card>
        <form action={save} className="grid max-w-2xl grid-cols-2 gap-4">
          {(Object.keys(LABELS) as (keyof SettingsValues)[]).map((k) => (
            <Field key={k} label={LABELS[k]}><input name={k} type="number" defaultValue={settings[k]} className={inputClass} /></Field>
          ))}
          <div className="col-span-2"><Button>Enregistrer</Button></div>
        </form>
      </Card>
    </>
  );
}
```

- [ ] **Step 6 : Vérifier et commiter**

Run: `npm run typecheck -w @drivelearn/admin` puis `npm run build -w @drivelearn/admin`
Expected: aucune erreur.

```bash
git add packages/admin
git commit -m "feat(admin): signalements, auto-écoles et réglages"
```

---

### Task 6 : Ventes, export CSV et tableau de bord

**Files:**
- Create: `packages/admin/lib/data/sales.ts`, `lib/data/dashboard.ts`, `lib/csv.ts`
- Create: `packages/admin/app/(admin)/ventes/page.tsx`, `app/(admin)/ventes/export/route.ts`
- Modify: `packages/admin/app/(admin)/page.tsx` (tableau de bord réel)
- Test: `packages/admin/test/sales.test.ts`, `test/csv.test.ts`, `test/dashboard.test.ts`

**Interfaces:**
- Consumes: `admin_commission_report`, `create_payment`, `confirm_payment` (Plan 1)
- Produces:
  - `monthStart(month: string): string` (valide `AAAA-MM` et renvoie `AAAA-MM-01`) ; `currentMonth(): string`
  - `commissionReport(db, month)` → `{ driving_school_id, name, sales_count, revenue_xof, commission_xof }[]`, avec des nombres
  - `listPayments(db, { month, schoolId? })` → `{ id, created_at, confirmed_at, status, base_amount_xof, discount_xof, amount_xof, commission_xof, school_name, email }[]`
  - `toCsv(rows: Record<string, unknown>[], columns: [key, label][]): string` : séparateur `;`, BOM UTF-8, champs entre guillemets si besoin
  - `getDashboard(db)` → `{ students, questions: Record<status, number>, open_reports, month: { sales, revenue_xof, commission_xof } }`

- [ ] **Step 1 : Écrire les tests qui échouent**

`packages/admin/test/csv.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { toCsv } from "../lib/csv";

describe("export CSV", () => {
  it("produit un fichier lisible par Excel : BOM, point-virgule, guillemets si besoin", () => {
    const csv = toCsv(
      [
        { name: 'Auto-école "Le Volant"; Lomé', total: 5400 },
        { name: "Ligne\nmultiple", total: 0 },
        { name: null, total: 10 },
      ],
      [["name", "Auto-école"], ["total", "Total (FCFA)"]],
    );
    expect(csv).toBe(
      '﻿Auto-école;Total (FCFA)\r\n"Auto-école ""Le Volant""; Lomé";5400\r\n"Ligne\nmultiple";0\r\n;10\r\n',
    );
  });
});
```

`packages/admin/test/sales.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createUser, withTx } from "../../db/test/helpers.js";
import { commissionReport, currentMonth, listPayments, monthStart } from "../lib/data/sales";

describe("ventes", () => {
  it("valide le mois demandé", () => {
    expect(monthStart("2026-10")).toBe("2026-10-01");
    expect(() => monthStart("octobre")).toThrow("Mois invalide");
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/);
  });

  it("totalise les commissions du mois et liste les paiements", () =>
    withTx(async (db) => {
      await createUser(db, "user-a");
      const school = (await db.query(
        "insert into driving_schools (name, promo_code, discount_percent, commission_percent) values ('Le Volant', 'VOLANT', 10, 15) returning id",
      )).rows[0].id;
      await db.query("select set_promo_code('user-a', 'VOLANT')");
      const p = (await db.query("select id from create_payment('user-a')")).rows[0].id;
      await db.query("select confirm_payment($1, 'REF1', 2700)", [p]);
      await db.query("select create_payment('user-a')"); // en attente

      const month = currentMonth();
      const report = await commissionReport(db, month);
      expect(report.find((r) => r.driving_school_id === school)).toMatchObject({ name: "Le Volant", sales_count: 1, revenue_xof: 2700, commission_xof: 405 });

      const payments = await listPayments(db, { month, schoolId: school });
      expect(payments.map((x) => x.status).sort()).toEqual(["confirmed", "pending"]);
      expect(payments[0]).toMatchObject({ school_name: "Le Volant", email: "user-a@test.tg" });
    }));
});
```

`packages/admin/test/dashboard.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createPath, createQuestion, createUser, withTx } from "../../db/test/helpers.js";
import { getDashboard } from "../lib/data/dashboard";

describe("tableau de bord", () => {
  it("résume élèves, questions, signalements et ventes du mois", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId, status: "validee" });
      await createQuestion(db, { unitId, lessonId });
      await createUser(db, "user-a");
      await db.query("select create_report('user-a', $1, 'probleme_image', null)", [q.id]);
      const p = (await db.query("select id from create_payment('user-a')")).rows[0].id;
      await db.query("select confirm_payment($1, 'REF1', 3000)", [p]);

      const d = await getDashboard(db);
      expect(d.students).toBeGreaterThanOrEqual(1);
      expect(d.questions).toMatchObject({ validee: 1, brouillon: 1 });
      expect(d.open_reports).toBeGreaterThanOrEqual(1);
      expect(d.month.sales).toBeGreaterThanOrEqual(1);
      expect(d.month.revenue_xof).toBeGreaterThanOrEqual(3000);
    }));
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test -w @drivelearn/admin`
Expected: les trois fichiers échouent au chargement.

- [ ] **Step 3 : Écrire le code**

`packages/admin/lib/csv.ts` :

```ts
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV pour Excel en français : BOM UTF-8, séparateur point-virgule, fins de ligne CRLF. */
export function toCsv(rows: Record<string, unknown>[], columns: [string, string][]): string {
  const lines = [columns.map(([, label]) => cell(label)).join(";")];
  for (const row of rows) lines.push(columns.map(([key]) => cell(row[key])).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}
```

`packages/admin/lib/data/sales.ts` :

```ts
import { AdminError } from "../errors";
import type { Queryable } from "./types";

export function monthStart(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new AdminError("Mois invalide (format AAAA-MM).");
  return `${month}-01`;
}

/** Mois en cours à Lomé (UTC). */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function commissionReport(db: Queryable, month: string) {
  const { rows } = await db.query(
    `select driving_school_id, name, sales_count::int, revenue_xof::int, commission_xof::int
     from admin_commission_report($1::date)`,
    [monthStart(month)],
  );
  return rows as { driving_school_id: string; name: string; sales_count: number; revenue_xof: number; commission_xof: number }[];
}

export async function listPayments(db: Queryable, f: { month: string; schoolId?: string }) {
  const { rows } = await db.query(
    `select pay.id, pay.created_at, pay.confirmed_at, pay.status::text as status, pay.base_amount_xof, pay.discount_xof,
            pay.amount_xof, pay.commission_xof, s.name as school_name, p.email
     from payments pay
     left join driving_schools s on s.id = pay.driving_school_id
     left join profiles p on p.id = pay.user_id
     where pay.created_at >= $1::date and pay.created_at < ($1::date + interval '1 month')
       and ($2::uuid is null or pay.driving_school_id = $2)
     order by pay.created_at desc`,
    [monthStart(f.month), f.schoolId ?? null],
  );
  return rows as { id: string; created_at: Date; confirmed_at: Date | null; status: string; base_amount_xof: number; discount_xof: number; amount_xof: number; commission_xof: number; school_name: string | null; email: string | null }[];
}
```

`packages/admin/lib/data/dashboard.ts` :

```ts
import type { Queryable } from "./types";

export async function getDashboard(db: Queryable) {
  const { rows } = await db.query(
    `select
       (select count(*)::int from profiles where id not in (select user_id from admins)) as students,
       coalesce((select jsonb_object_agg(status, n) from (select status::text, count(*)::int as n from questions group by status) s), '{}'::jsonb) as questions,
       (select count(*)::int from question_reports where status <> 'resolu') as open_reports,
       (select jsonb_build_object('sales', count(*)::int, 'revenue_xof', coalesce(sum(amount_xof), 0)::int,
                                  'commission_xof', coalesce(sum(commission_xof), 0)::int)
        from payments where status = 'confirmed' and confirmed_at >= date_trunc('month', now() at time zone 'Africa/Lome')) as month`,
  );
  return rows[0] as {
    students: number;
    questions: Record<string, number>;
    open_reports: number;
    month: { sales: number; revenue_xof: number; commission_xof: number };
  };
}
```

- [ ] **Step 4 : Lancer les tests**

Run: `npm test -w @drivelearn/admin`
Expected: tous les fichiers passent.

- [ ] **Step 5 : Écrire les pages et l'export**

`packages/admin/app/(admin)/ventes/page.tsx` :

```tsx
import Link from "next/link";
import { Card, inputClass, PageTitle, StatusBadge, tableClass } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { commissionReport, currentMonth, listPayments } from "@/lib/data/sales";
import { listSchools } from "@/lib/data/schools";
import { pool } from "@/lib/db";

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ month?: string; school?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const month = sp.month || currentMonth();
  const [report, payments, schools] = await Promise.all([
    commissionReport(pool, month),
    listPayments(pool, { month, schoolId: sp.school || undefined }),
    listSchools(pool),
  ]);
  const query = `month=${month}&school=${sp.school ?? ""}`;
  return (
    <>
      <PageTitle
        title="Ventes et commissions"
        subtitle={`Mois ${month}`}
        actions={<Link href={`/ventes/export?${query}`} className="rounded-lg bg-sarcelle px-4 py-2 text-sm font-semibold text-white">Exporter (CSV)</Link>}
      />
      <form className="mb-4 flex gap-3">
        <input name="month" type="month" defaultValue={month} className={`${inputClass} w-48`} />
        <select name="school" defaultValue={sp.school ?? ""} className={`${inputClass} w-64`}>
          <option value="">Toutes les auto-écoles</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">Afficher</button>
      </form>
      <Card title="Commissions dues">
        <table className={tableClass}>
          <thead><tr><th>Auto-école</th><th>Ventes</th><th>Chiffre d'affaires</th><th>Commission due</th></tr></thead>
          <tbody>
            {report.map((r) => (
              <tr key={r.driving_school_id} className="border-t border-slate-100">
                <td>{r.name}</td><td>{r.sales_count}</td><td>{fcfa(r.revenue_xof)}</td><td className="font-semibold">{fcfa(r.commission_xof)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Paiements du mois">
        <table className={tableClass}>
          <thead><tr><th>Date</th><th>Élève</th><th>Auto-école</th><th>Montant</th><th>Commission</th><th>Statut</th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td>{new Date(p.created_at).toLocaleString("fr-FR")}</td>
                <td>{p.email ?? "compte supprimé"}</td>
                <td>{p.school_name ?? "—"}</td>
                <td>{fcfa(p.amount_xof)}</td>
                <td>{fcfa(p.commission_xof)}</td>
                <td><StatusBadge status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
```

`packages/admin/app/(admin)/ventes/export/route.ts` :

```ts
import { requireAdmin } from "@/lib/admin";
import { toCsv } from "@/lib/csv";
import { currentMonth, listPayments } from "@/lib/data/sales";
import { pool } from "@/lib/db";

export async function GET(request: Request) {
  await requireAdmin();
  const url = new URL(request.url);
  const month = url.searchParams.get("month") || currentMonth();
  const payments = await listPayments(pool, { month, schoolId: url.searchParams.get("school") || undefined });
  const csv = toCsv(payments, [
    ["created_at", "Date"],
    ["confirmed_at", "Confirmé le"],
    ["status", "Statut"],
    ["email", "Élève"],
    ["school_name", "Auto-école"],
    ["base_amount_xof", "Prix (FCFA)"],
    ["discount_xof", "Réduction (FCFA)"],
    ["amount_xof", "Payé (FCFA)"],
    ["commission_xof", "Commission (FCFA)"],
  ]);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="drivelearn-ventes-${month}.csv"`,
    },
  });
}
```

`packages/admin/app/(admin)/page.tsx` (remplace la version provisoire) :

```tsx
import Link from "next/link";
import { Card, PageTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { getDashboard } from "@/lib/data/dashboard";
import { pool } from "@/lib/db";

function Stat({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const body = (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-nuit">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function Dashboard() {
  await requireAdmin();
  const d = await getDashboard(pool);
  return (
    <>
      <PageTitle title="Tableau de bord" />
      <div className="mb-6 grid grid-cols-4 gap-4">
        <Stat label="Élèves inscrits" value={d.students} />
        <Stat label="Questions validées" value={d.questions.validee ?? 0} href="/questions?status=validee" />
        <Stat label="Signalements ouverts" value={d.open_reports} href="/signalements" />
        <Stat label="Ventes du mois" value={d.month.sales} href="/ventes" />
      </div>
      <Card title="Questions par statut">
        <div className="flex gap-6 text-sm">
          {(["brouillon", "a_verifier", "en_validation", "validee"] as const).map((s) => (
            <Link key={s} href={`/questions?status=${s}`} className="text-bleu underline">{s.replace("_", " ")} : {d.questions[s] ?? 0}</Link>
          ))}
        </div>
      </Card>
      <Card title="Ce mois-ci">
        <p className="text-sm">Chiffre d'affaires : <b>{d.month.revenue_xof.toLocaleString("fr-FR")} FCFA</b> · Commissions dues : <b>{d.month.commission_xof.toLocaleString("fr-FR")} FCFA</b></p>
      </Card>
    </>
  );
}
```

- [ ] **Step 6 : Vérifier et commiter**

Run: `npm test -w @drivelearn/admin` puis `npm run typecheck -w @drivelearn/admin` puis `npm run build -w @drivelearn/admin`
Expected: tous les tests passent, aucune erreur de type, build réussi.

```bash
git add packages/admin
git commit -m "feat(admin): ventes, export CSV et tableau de bord"
```

---

### Task 7 : Premier administrateur, essai en local et déploiement sur Vercel

**Files:**
- Aucun nouveau fichier de code. Configuration : variables d'environnement Vercel, domaine de confiance Neon Auth.

Les étapes **(vous)** sont faites par l'utilisateur : création de mot de passe, connexion par navigateur, saisie de secrets dans Vercel.

- [ ] **Step 1 (vous) : Créer votre compte administrateur en local**

Run (vous) : `npm run dev -w @drivelearn/admin` puis ouvrir `http://localhost:3000/auth/sign-up`. Créez votre compte (localhost est autorisé par Neon Auth pendant le développement).
Expected: après création, redirection vers `/auth/refuse` (« Accès réservé »). C'est normal : le compte n'est pas encore administrateur.

- [ ] **Step 2 : Nommer le compte administrateur**

Run: `npm run make-admin -w @drivelearn/admin -- <votre e-mail>`
Expected: `<e-mail> est administrateur (<id>).`

- [ ] **Step 3 (vous) : Vérifier le site en local**

Rechargez `http://localhost:3000`, puis vérifiez :
1. le tableau de bord ;
2. **Programmes** : créer « TG / voiture / Togo — Permis voiture », ajouter une unité et une leçon ;
3. **Contenus** : créer une question complète et la valider ; une question sans bonne réponse doit afficher « Validation impossible : aucune bonne réponse. » ;
4. **Examen et publication** : la conformité doit signaler une banque insuffisante ;
5. **Auto-écoles**, **Réglages**, **Ventes** et l'export CSV.

Expected: chaque écran s'affiche ; les actions affichent « Enregistré. » ou un message d'erreur en français.

- [ ] **Step 4 (vous) : Déployer sur Vercel**

```bash
npx vercel login
```

```bash
cd packages/admin && npx vercel link
```

Dans le tableau de bord Vercel, projet lié : **Settings → Environment Variables**. Ajoutez pour **Production** les trois valeurs de `packages/admin/.env.local` : `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`. Réglez **Settings → General → Root Directory** sur `packages/admin`. Puis :

```bash
npx vercel --prod
```

Expected: une URL de production `https://<projet>.vercel.app`.

- [ ] **Step 5 : Autoriser le domaine de l'administration dans Neon Auth**

Avec l'outil MCP `add_auth_trusted_domain` (projet `young-river-14219375`, branche `br-flat-lake-b12cfxtb`, fournisseur `better_auth`) : ajouter l'URL de production Vercel. Vérifier avec `get_neon_auth_config` que `trusted_origins` contient `https://app.drivelearn.tg` et cette URL.

- [ ] **Step 6 (vous) : Vérifier en production**

Ouvrez l'URL Vercel et connectez-vous.
Expected: le tableau de bord s'affiche. Un compte non administrateur voit « Accès réservé ».

- [ ] **Step 7 : Envoyer sur GitHub**

```bash
git push origin master
```

---

## Suite

- **Plan 4 — Numérisation du contenu et images** : bucket `question-images` (lecture publique), envoi d'images depuis l'éditeur, `IMAGES_BASE_URL` côté API, import des scans en brouillon. **Nécessite les scans.**
- **Plans 5 et 6 — Application élève** (Expo).
- **Plan 7 — Notifications et mise en production** (rappels, SMTP, vérification d'e-mail, clé d'API Neon, Play Store).
