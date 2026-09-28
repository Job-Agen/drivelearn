# DriveLearn — Plan 1 : Base de données (Neon Postgres) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le schéma et toute la logique métier de DriveLearn V1 en fonctions SQL Postgres (contenu, profils, séances, série de jours, examens blancs, paiements, signalements, progrès, rappels), testés automatiquement sur une base Postgres locale.

**Architecture:** La base est Neon Postgres (Postgres 17). Personne n'y accède depuis l'application : seule l'API (Plan 2, Neon Functions) et les routes serveur de l'admin l'interrogent, en passant explicitement l'identifiant de l'utilisateur Neon Auth (`p_user_id text`) aux fonctions SQL. Il n'y a donc pas de RLS. Les migrations sont des fichiers SQL numérotés appliqués par un petit script Node, le même en local et sur Neon. Les tests Vitest ouvrent une transaction par test et l'annulent à la fin.

**Tech Stack:** PostgreSQL 17 (Docker en local, Neon en ligne), Node 24, TypeScript, `pg`, Vitest, `tsx`, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-27-drivelearn-design.md`

## Global Constraints

- Fuseau horaire de référence pour « jour » et « semaine » : `Africa/Lome` (UTC+0, sans heure d'été). La semaine commence le lundi.
- Examen par défaut : 20 questions, admis si note ≥ 13, notation **tout ou rien**. Ces valeurs sont des colonnes de `programs`, jamais codées en dur.
- Une question `validee` a 2 à 8 choix, au moins une bonne réponse, une leçon de la même unité, une explication et une source. Modifier une question validée la renvoie en `en_validation`.
- Statuts de question : `brouillon`, `a_verifier`, `en_validation`, `validee`. Seules les questions `validee` sont servies aux élèves.
- 1 examen blanc gratuit par compte, ensuite Pass Examen. Pass = 90 jours (réglable), paiement unique, montants en FCFA entiers (`*_xof`), réduction et commission arrondies à l'entier inférieur.
- XP : 10 par séance + 5 pour un sans-faute (réglables). Séances : `lecon`, `erreurs`, `theme`.
- Objectif quotidien : 5, 10 ou 15 minutes. Rappel : activé par défaut, 19:00 par défaut.
- Les identifiants utilisateur sont des `text` (identifiants Neon Auth), sans clé étrangère vers le schéma `neon_auth`.
- Erreurs métier levées avec un code court en snake_case (`raise exception 'pass_required'`). L'API les traduit en français.
- Aucune fonction ne lit l'identité depuis la session Postgres : l'utilisateur est toujours passé en paramètre.

## Review Focus

1. **Séance hors ligne envoyée deux fois** (synchronisation relancée après une coupure) → une seule séance, pas de double XP. Testé dans la Task 4.
2. **Notification de paiement reçue deux fois, ou confirmation arrivée après expiration** → un seul Pass, et un paiement réellement débité est honoré. Testé dans la Task 6.
3. **Réponse à choix multiples avec doublons, un choix d'une autre question, ou aucune case** → fausse (les doublons sont ignorés). Testé dans la Task 4.
4. **Examen abandonné (application tuée, connexion perdue)** → repris s'il n'est pas expiré, sinon noté avec les réponses reçues ; un double appui ne consomme pas l'examen gratuit deux fois. Testé dans la Task 5.
5. **Rappel dont l'heure tombe juste avant minuit** → la fenêtre qui chevauche minuit l'inclut quand même. Testé dans la Task 8.

---

## Structure des fichiers

```
drivelearn/
  package.json                          # workspaces
  docker-compose.yml                    # Postgres 17 de test (port 54329)
  .gitignore
  packages/db/
    package.json                        # @drivelearn/db
    tsconfig.json
    vitest.config.ts
    migrations/
      0001_content.sql                  # réglages, admins, programmes, unités, leçons, questions, choix, validation, version
      0002_profiles.sql                 # auto-écoles, profils, ensure_profile, delete_account
      0003_sessions.sql                 # séances, réponses, maîtrise, notation, série, questions à revoir
      0004_exams.sql                    # pass, examens blancs, tirage, statut, historique
      0005_payments.sql                 # paiements, code promo, confirmation, commissions
      0006_reports.sql                  # signalements
      0007_progress.sql                 # progrès, plus longue série, cibles des rappels
    src/
      migrate.ts                        # applique les migrations dans l'ordre (local et Neon)
    test/
      global-setup.ts                   # remet la base de test à zéro et migre
      helpers.ts                        # transactions, assertions d'erreur, jeux de données
      migrate.test.ts
      content.test.ts
      profiles.test.ts
      sessions.test.ts
      exams.test.ts
      payments.test.ts
      reports.test.ts
      progress.test.ts
```

**Note sur `pg` :** `count(*)` et les `bigint` reviennent en chaîne, et les `date` en objet `Date`. Les requêtes de test castent donc en `::int` ou en `::text`.

---

### Task 1 : Monorepo, base de test et migrations

**Files:**
- Create: `package.json`, `.gitignore`, `docker-compose.yml`
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/vitest.config.ts`
- Create: `packages/db/src/migrate.ts`
- Create: `packages/db/test/global-setup.ts`, `packages/db/test/helpers.ts`
- Test: `packages/db/test/migrate.test.ts`

**Interfaces:**
- Produces:
  - `migrate(connectionString: string): Promise<string[]>` : applique les fichiers `migrations/*.sql` pas encore appliqués, dans l'ordre alphabétique, chacun dans sa transaction ; trace dans `schema_migrations(name, applied_at)` ; renvoie les noms appliqués.
  - `npm run migrate -w @drivelearn/db` (lit `DATABASE_URL`), `npm test -w @drivelearn/db`, `npm run db:test:up`.
  - Dans `test/helpers.ts` : `TEST_DATABASE_URL`, `withTx(fn)`, `expectError(db, sql, values, message)`, `scalar<T>(db, sql, values?)`, `createPath(db, opts?)`, `createQuestion(db, opts)`, `createUser(db, id, email?)`, type `QuestionFixture`. Les fonctions de jeux de données s'appuient sur les tables des Tasks 2 et 3 ; elles sont écrites ici pour être partagées.

- [ ] **Step 1 : Fichiers racine**

`package.json` :

```json
{
  "name": "drivelearn",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "db:test:up": "docker compose up -d --wait db-test",
    "db:test:down": "docker compose down"
  }
}
```

`.gitignore` :

```
node_modules/
.env
.env.*
.neon
```

`docker-compose.yml` :

```yaml
services:
  db-test:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: drivelearn_test
    ports:
      - "54329:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d drivelearn_test"]
      interval: 2s
      timeout: 3s
      retries: 20
```

- [ ] **Step 2 : Paquet `@drivelearn/db`**

`packages/db/package.json` :

```json
{
  "name": "@drivelearn/db",
  "private": true,
  "type": "module",
  "scripts": {
    "migrate": "tsx src/migrate.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

Run: `npm install -w @drivelearn/db pg` puis `npm install -w @drivelearn/db -D vitest tsx typescript @types/pg @types/node`
Expected: les dépendances sont ajoutées à `packages/db/package.json` et `package-lock.json` est créé.

`packages/db/tsconfig.json` :

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
  "include": ["src", "test", "vitest.config.ts"]
}
```

`packages/db/vitest.config.ts` :

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
```

- [ ] **Step 3 : Écrire le test qui échoue**

`packages/db/test/migrate.test.ts` :

```ts
import { readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { migrate } from "../src/migrate.js";
import { TEST_DATABASE_URL, scalar, withTx } from "./helpers.js";

describe("migrations", () => {
  it("n'applique rien une seconde fois", async () => {
    expect(await migrate(TEST_DATABASE_URL)).toEqual([]);
  });

  it("trace chaque fichier de migration appliqué", () =>
    withTx(async (db) => {
      const files = (await readdir(new URL("../migrations/", import.meta.url))).filter((f) => f.endsWith(".sql"));
      const count = await scalar<number>(db, "select count(*)::int from schema_migrations");
      expect(count).toBe(files.length);
    }));
});
```

- [ ] **Step 4 : Écrire le script de migration**

`packages/db/src/migrate.ts` :

```ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export async function migrate(connectionString: string): Promise<string[]> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(
      "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const { rows } = await client.query<{ name: string }>("select name from schema_migrations");
    const done = new Set(rows.map((r) => r.name));
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

    const applied: string[] = [];
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [file]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`${file} : ${(error as Error).message}`);
      }
      applied.push(file);
    }
    return applied;
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL manquant (utiliser l'URL directe, non poolée, sur Neon)");
    process.exit(1);
  }
  migrate(url)
    .then((applied) => console.log(applied.length ? `Appliquées : ${applied.join(", ")}` : "Base à jour"))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
```

Créer aussi le dossier vide `packages/db/migrations/` (avec un fichier `.gitkeep`, à supprimer à la Task 2).

- [ ] **Step 5 : Écrire la préparation et les aides de test**

`packages/db/test/global-setup.ts` :

```ts
import pg from "pg";
import { migrate } from "../src/migrate.js";
import { TEST_DATABASE_URL } from "./helpers.js";

export default async function setup() {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  await client.query("drop schema if exists public cascade; create schema public;");
  await client.end();
  await migrate(TEST_DATABASE_URL);
}
```

`packages/db/test/helpers.ts` :

```ts
import { randomUUID } from "node:crypto";
import pg from "pg";
import { expect } from "vitest";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:54329/drivelearn_test";

const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });

export type Db = pg.PoolClient;

/** Exécute fn dans une transaction toujours annulée à la fin. */
export async function withTx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("begin");
    return await fn(db);
  } finally {
    await db.query("rollback");
    db.release();
  }
}

/** Vérifie qu'une requête échoue avec un message contenant `message`, sans casser la transaction. */
export async function expectError(db: Db, sql: string, values: unknown[], message: string): Promise<void> {
  await db.query("savepoint expect_error");
  try {
    await db.query(sql, values);
  } catch (error) {
    await db.query("rollback to savepoint expect_error");
    expect((error as Error).message).toContain(message);
    return;
  }
  throw new Error(`Erreur attendue contenant « ${message} », mais la requête a réussi`);
}

/** Renvoie la première colonne de la première ligne. */
export async function scalar<T>(db: Db, sql: string, values: unknown[] = []): Promise<T> {
  const { rows } = await db.query(sql, values);
  return Object.values(rows[0] as Record<string, unknown>)[0] as T;
}

export type Path = { programId: string; unitId: string; lessonId: string };

/** Crée un programme (Togo, voiture), une unité et une leçon. */
export async function createPath(
  db: Db,
  opts: { examQuestionCount?: number; examPassMark?: number; secondsPerQuestion?: number } = {},
): Promise<Path> {
  const programId = await scalar<string>(
    db,
    `insert into programs (country_code, license_type, name, exam_question_count, exam_pass_mark, exam_seconds_per_question)
     values ('TG', 'voiture', 'Togo — Permis voiture', $1, $2, $3) returning id`,
    [opts.examQuestionCount ?? 20, opts.examPassMark ?? 13, opts.secondsPerQuestion ?? 30],
  );
  const unitId = await createUnit(db, programId, 1);
  const lessonId = await createLesson(db, unitId, 1);
  return { programId, unitId, lessonId };
}

export async function createUnit(db: Db, programId: string, position: number): Promise<string> {
  return scalar<string>(db, "insert into units (program_id, title, position) values ($1, $2, $3) returning id", [
    programId,
    `Unité ${position}`,
    position,
  ]);
}

export async function createLesson(db: Db, unitId: string, position: number): Promise<string> {
  return scalar<string>(db, "insert into lessons (unit_id, position, title) values ($1, $2, $3) returning id", [
    unitId,
    position,
    `Leçon ${position}`,
  ]);
}

export type QuestionStatus = "brouillon" | "a_verifier" | "en_validation" | "validee";
export type QuestionFixture = { id: string; correct: string[]; wrong: string[] };

/** Crée une question en brouillon avec ses choix, puis lui donne le statut demandé. */
export async function createQuestion(
  db: Db,
  opts: {
    unitId: string;
    lessonId: string | null;
    correct?: number;
    wrong?: number;
    status?: QuestionStatus;
    explanation?: string | null;
    source?: string | null;
  },
): Promise<QuestionFixture> {
  const id = await scalar<string>(
    db,
    `insert into questions (unit_id, lesson_id, prompt, explanation, source)
     values ($1, $2, 'Quel est ce panneau ?', $3, $4) returning id`,
    [
      opts.unitId,
      opts.lessonId,
      opts.explanation === undefined ? "Explication de la réponse." : opts.explanation,
      opts.source === undefined ? "Livre du code, p. 12" : opts.source,
    ],
  );
  const correct: string[] = [];
  const wrong: string[] = [];
  let position = 1;
  for (let i = 0; i < (opts.correct ?? 1); i++) {
    correct.push(
      await scalar<string>(
        db,
        "insert into choices (question_id, label, is_correct, position) values ($1, $2, true, $3) returning id",
        [id, `Bonne ${i + 1}`, position++],
      ),
    );
  }
  for (let i = 0; i < (opts.wrong ?? 1); i++) {
    wrong.push(
      await scalar<string>(
        db,
        "insert into choices (question_id, label, is_correct, position) values ($1, $2, false, $3) returning id",
        [id, `Fausse ${i + 1}`, position++],
      ),
    );
  }
  if (opts.status && opts.status !== "brouillon") {
    await db.query("update questions set status = $2 where id = $1", [id, opts.status]);
  }
  return { id, correct, wrong };
}

/** Crée le profil d'un utilisateur Neon Auth. */
export async function createUser(db: Db, id: string, email = `${id}@test.tg`): Promise<string> {
  await db.query("select ensure_profile($1, $2)", [id, email]);
  return id;
}

export const newId = () => randomUUID();
```

- [ ] **Step 6 : Démarrer la base de test et lancer les tests**

Run: `npm run db:test:up` (Docker doit tourner), puis `npm test -w @drivelearn/db`
Expected: `migrate.test.ts` passe (2 tests). Les fonctions de `helpers.ts` qui visent des tables absentes ne sont pas encore appelées.

- [ ] **Step 7 : Commit**

```bash
git add package.json package-lock.json .gitignore docker-compose.yml packages/db
git commit -m "chore(db): monorepo, base de test et migrations"
```

---

### Task 2 : Contenu, programmes et validation

**Files:**
- Create: `packages/db/migrations/0001_content.sql` (supprimer `migrations/.gitkeep`)
- Test: `packages/db/test/content.test.ts`

**Interfaces:**
- Consumes: `migrate`, helpers (Task 1)
- Produces:
  - Tables : `admins(user_id text, created_at)`, `settings(key, value jsonb)`, `programs(id, country_code, license_type, name, status, exam_question_count, exam_pass_mark, exam_seconds_per_question, exam_distribution jsonb)`, `units(id, program_id, title, position)`, `lessons(id, unit_id, position, title, intro_title, intro_text, intro_image_path, mentor_tip)`, `questions(id, unit_id, lesson_id, position, prompt, image_path, explanation, source, status, source_page, updated_at)`, `choices(id, question_id, label, is_correct, position)`, `content_version(id, version)`
  - Types : `program_status` (`brouillon`, `en_validation`, `publie`), `question_status`
  - `setting_int(p_key text) returns integer`
  - `exam_distribution` : objet JSON `{"<unit_id>": <nombre de questions>}`

- [ ] **Step 1 : Écrire le test qui échoue**

`packages/db/test/content.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createPath, createQuestion, expectError, scalar, withTx } from "./helpers.js";

describe("contenu", () => {
  it("a les paramètres de l'examen togolais par défaut", () =>
    withTx(async (db) => {
      const { programId } = await createPath(db);
      const { rows } = await db.query(
        "select exam_question_count, exam_pass_mark from programs where id = $1",
        [programId],
      );
      expect(rows[0]).toEqual({ exam_question_count: 20, exam_pass_mark: 13 });
      expect(await scalar<number>(db, "select setting_int('pass_duration_days')")).toBe(90);
      expect(await scalar<number>(db, "select setting_int('pass_price_xof')")).toBe(3000);
    }));

  it("refuse un seuil supérieur au nombre de questions", () =>
    withTx(async (db) => {
      const { programId } = await createPath(db);
      await expectError(db, "update programs set exam_pass_mark = 21 where id = $1", [programId], "programs_pass_mark_check");
    }));

  it("refuse deux programmes pour le même pays et le même permis", () =>
    withTx(async (db) => {
      await createPath(db);
      await expectError(
        db,
        "insert into programs (country_code, license_type, name) values ('TG', 'voiture', 'Doublon')",
        [],
        "programs_country_code_license_type_key",
      );
    }));

  it("incrémente la version du contenu à chaque modification", () =>
    withTx(async (db) => {
      const before = await scalar<number>(db, "select version::int from content_version");
      await createPath(db);
      const after = await scalar<number>(db, "select version::int from content_version");
      expect(after).toBeGreaterThan(before);
    }));
});

describe("validation d'une question", () => {
  type Overrides = { correct?: number; wrong?: number; explanation?: string | null; source?: string | null };
  const cases: Array<[string, Overrides, string]> = [
    ["sans bonne réponse", { correct: 0, wrong: 2 }, "aucune bonne réponse"],
    ["sans choix", { correct: 0, wrong: 0 }, "il faut entre 2 et 8 choix"],
    ["avec 9 choix", { correct: 1, wrong: 8 }, "il faut entre 2 et 8 choix"],
    ["sans explication", { explanation: null }, "explication manquante"],
    ["sans source", { source: "  " }, "source manquante"],
  ];

  it.each(cases)("refuse une question %s", (_label, overrides, message) =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId, ...overrides });
      await db.query("set constraints all immediate");
      await expectError(db, "update questions set status = 'validee' where id = $1", [q.id], message);
    }));

  it("refuse une question sans leçon", () =>
    withTx(async (db) => {
      const { unitId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId: null });
      await db.query("set constraints all immediate");
      await expectError(db, "update questions set status = 'validee' where id = $1", [q.id], "aucune leçon");
    }));

  it("valide une question complète", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId, correct: 2, wrong: 2 });
      await db.query("set constraints all immediate");
      await db.query("update questions set status = 'validee' where id = $1", [q.id]);
      expect(await scalar<string>(db, "select status::text from questions where id = $1", [q.id])).toBe("validee");
    }));

  it("renvoie en validation une question validée dont l'énoncé change", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId, status: "validee" });
      await db.query("update questions set prompt = 'Nouvel énoncé' where id = $1", [q.id]);
      expect(await scalar<string>(db, "select status::text from questions where id = $1", [q.id])).toBe("en_validation");
    }));

  it("renvoie en validation une question validée dont on retire la bonne réponse", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId, correct: 1, wrong: 2, status: "validee" });
      await db.query("delete from choices where id = $1", [q.correct[0]]);
      await db.query("set constraints all immediate");
      expect(await scalar<string>(db, "select status::text from questions where id = $1", [q.id])).toBe("en_validation");
    }));

  it("garde validée une question dont seul l'ordre change", () =>
    withTx(async (db) => {
      const { unitId, lessonId } = await createPath(db);
      const q = await createQuestion(db, { unitId, lessonId, status: "validee" });
      await db.query("update questions set position = 5 where id = $1", [q.id]);
      expect(await scalar<string>(db, "select status::text from questions where id = $1", [q.id])).toBe("validee");
    }));
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npm test -w @drivelearn/db`
Expected: `content.test.ts` échoue avec `relation "programs" does not exist`.

- [ ] **Step 3 : Écrire la migration**

`packages/db/migrations/0001_content.sql` :

```sql
-- Administrateurs (identifiants Neon Auth) ----------------------------------
create table admins (
  user_id text primary key,
  created_at timestamptz not null default now()
);

-- Réglages globaux -----------------------------------------------------------
create table settings (
  key text primary key,
  value jsonb not null
);

insert into settings (key, value) values
  ('pass_price_xof', '3000'),
  ('pass_duration_days', '90'),
  ('xp_per_session', '10'),
  ('xp_perfect_bonus', '5'),
  ('ready_after_consecutive_passes', '3'),
  ('max_review_per_lesson', '2');

create function setting_int(p_key text)
returns integer
language sql stable
as $$
  select (value #>> '{}')::integer from settings where key = p_key;
$$;

-- Programmes (pays + permis) -------------------------------------------------
create type program_status as enum ('brouillon', 'en_validation', 'publie');

create table programs (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  license_type text not null,
  name text not null,
  status program_status not null default 'brouillon',
  exam_question_count integer not null default 20 check (exam_question_count between 1 and 100),
  exam_pass_mark integer not null default 13,
  exam_seconds_per_question integer not null default 30 check (exam_seconds_per_question between 5 and 600),
  exam_distribution jsonb not null default '{}',
  unique (country_code, license_type),
  constraint programs_pass_mark_check check (exam_pass_mark between 1 and exam_question_count)
);

-- Contenu --------------------------------------------------------------------
create table units (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs (id) on delete cascade,
  title text not null,
  position integer not null
);
create index units_program_idx on units (program_id, position);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units (id) on delete cascade,
  position integer not null,
  title text not null,
  intro_title text,
  intro_text text,
  intro_image_path text,
  mentor_tip text
);
create index lessons_unit_idx on lessons (unit_id, position);

create type question_status as enum ('brouillon', 'a_verifier', 'en_validation', 'validee');

create table questions (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references units (id) on delete cascade,
  lesson_id uuid references lessons (id) on delete set null,
  position integer not null default 0,
  prompt text not null,
  image_path text,
  explanation text,
  source text,
  status question_status not null default 'brouillon',
  source_page text,
  updated_at timestamptz not null default now()
);
create index questions_lesson_idx on questions (lesson_id, position);
create index questions_unit_status_idx on questions (unit_id, status);

create table choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions (id) on delete cascade,
  label text not null,
  is_correct boolean not null default false,
  position integer not null default 0
);
create index choices_question_idx on choices (question_id, position);

-- Une question validée modifiée repasse en validation --------------------------
create function demote_edited_question()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'validee' and new.status = 'validee'
     and (new.prompt, new.image_path, new.explanation, new.source, new.lesson_id, new.unit_id)
         is distinct from (old.prompt, old.image_path, old.explanation, old.source, old.lesson_id, old.unit_id) then
    new.status := 'en_validation';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger questions_demote
  before update on questions
  for each row execute function demote_edited_question();

create function demote_question_on_choice_change()
returns trigger
language plpgsql
as $$
declare
  v_qid uuid;
begin
  if tg_op = 'DELETE' then
    v_qid := old.question_id;
  else
    v_qid := new.question_id;
  end if;
  update questions set status = 'en_validation' where id = v_qid and status = 'validee';
  return null;
end $$;

create trigger choices_demote
  after insert or update or delete on choices
  for each row execute function demote_question_on_choice_change();

-- Une question ne peut être validée que si elle est complète (vérifié en fin de transaction)
create function check_question_valid()
returns trigger
language plpgsql
as $$
declare
  v_q questions;
  v_choices integer;
  v_correct integer;
begin
  select * into v_q from questions where id = new.id;
  if not found or v_q.status <> 'validee' then
    return null;
  end if;

  select count(*), count(*) filter (where is_correct)
    into v_choices, v_correct
    from choices where question_id = v_q.id;

  if v_choices < 2 or v_choices > 8 then
    raise exception 'question_invalide: il faut entre 2 et 8 choix';
  end if;
  if v_correct < 1 then
    raise exception 'question_invalide: aucune bonne réponse';
  end if;
  if v_q.lesson_id is null then
    raise exception 'question_invalide: aucune leçon';
  end if;
  if not exists (select 1 from lessons where id = v_q.lesson_id and unit_id = v_q.unit_id) then
    raise exception 'question_invalide: leçon hors unité';
  end if;
  if nullif(trim(coalesce(v_q.explanation, '')), '') is null then
    raise exception 'question_invalide: explication manquante';
  end if;
  if nullif(trim(coalesce(v_q.source, '')), '') is null then
    raise exception 'question_invalide: source manquante';
  end if;
  return null;
end $$;

create constraint trigger questions_valid
  after insert or update on questions
  deferrable initially deferred
  for each row execute function check_question_valid();

-- Version du contenu (l'application re-télécharge quand elle change) -----------
create table content_version (
  id boolean primary key default true check (id),
  version bigint not null default 1
);
insert into content_version default values;

create function bump_content_version()
returns trigger
language plpgsql
as $$
begin
  update content_version set version = version + 1;
  return null;
end $$;

create trigger programs_bump after insert or update or delete on programs
  for each statement execute function bump_content_version();
create trigger units_bump after insert or update or delete on units
  for each statement execute function bump_content_version();
create trigger lessons_bump after insert or update or delete on lessons
  for each statement execute function bump_content_version();
create trigger questions_bump after insert or update or delete on questions
  for each statement execute function bump_content_version();
create trigger choices_bump after insert or update or delete on choices
  for each statement execute function bump_content_version();
```

- [ ] **Step 4 : Lancer les tests**

Run: `npm test -w @drivelearn/db`
Expected: `migrate.test.ts` et `content.test.ts` passent.

- [ ] **Step 5 : Commit**

```bash
git add packages/db/migrations packages/db/test/content.test.ts
git commit -m "feat(db): contenu, programmes et validation des questions"
```

---

### Task 3 : Profils et auto-écoles

**Files:**
- Create: `packages/db/migrations/0002_profiles.sql`
- Test: `packages/db/test/profiles.test.ts`

**Interfaces:**
- Consumes: `programs` (Task 2)
- Produces:
  - Tables : `driving_schools(id, name, promo_code, discount_percent, commission_percent, active, created_at)`, `profiles(id text, email, first_name, program_id, daily_goal_minutes, reminder_enabled, reminder_time, push_token, driving_school_id, created_at)`
  - `ensure_profile(p_user_id text, p_email text) returns profiles` : crée le profil au premier appel, met l'e-mail à jour ensuite
  - `delete_account(p_user_id text) returns void` : supprime le profil et, en cascade, toute la progression ; les paiements sont conservés et anonymisés (vérifié en Task 6)

- [ ] **Step 1 : Écrire le test qui échoue**

`packages/db/test/profiles.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createUser, expectError, scalar, withTx } from "./helpers.js";

describe("profils", () => {
  it("crée le profil une seule fois et met l'e-mail à jour", () =>
    withTx(async (db) => {
      await createUser(db, "user-1", "a@test.tg");
      await db.query("select ensure_profile($1, $2)", ["user-1", "b@test.tg"]);
      expect(await scalar<number>(db, "select count(*)::int from profiles where id = 'user-1'")).toBe(1);
      expect(await scalar<string>(db, "select email from profiles where id = 'user-1'")).toBe("b@test.tg");
    }));

  it("a les préférences par défaut : 5 min par jour, rappel à 19:00", () =>
    withTx(async (db) => {
      await createUser(db, "user-1");
      const { rows } = await db.query(
        "select daily_goal_minutes, reminder_enabled, reminder_time::text as reminder_time from profiles where id = 'user-1'",
      );
      expect(rows[0]).toEqual({ daily_goal_minutes: 5, reminder_enabled: true, reminder_time: "19:00:00" });
    }));

  it("refuse un objectif autre que 5, 10 ou 15 minutes", () =>
    withTx(async (db) => {
      await createUser(db, "user-1");
      await expectError(
        db,
        "update profiles set daily_goal_minutes = 7 where id = 'user-1'",
        [],
        "profiles_daily_goal_minutes_check",
      );
    }));

  it("met les codes promo en majuscules obligatoirement", () =>
    withTx(async (db) => {
      await expectError(
        db,
        "insert into driving_schools (name, promo_code) values ('Auto-école', 'volant')",
        [],
        "driving_schools_promo_code_check",
      );
      const discount = await scalar<number>(
        db,
        "insert into driving_schools (name, promo_code) values ('Auto-école Le Volant', 'VOLANT') returning discount_percent",
      );
      expect(discount).toBe(10);
    }));

  it("supprime le profil avec delete_account", () =>
    withTx(async (db) => {
      await createUser(db, "user-1");
      await db.query("select delete_account('user-1')");
      expect(await scalar<number>(db, "select count(*)::int from profiles")).toBe(0);
    }));
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npm test -w @drivelearn/db`
Expected: `profiles.test.ts` échoue avec `function ensure_profile(unknown, unknown) does not exist`.

- [ ] **Step 3 : Écrire la migration**

`packages/db/migrations/0002_profiles.sql` :

```sql
create table driving_schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  promo_code text not null unique check (promo_code = upper(promo_code) and char_length(promo_code) between 3 and 20),
  discount_percent integer not null default 10 check (discount_percent between 0 and 100),
  commission_percent integer not null default 10 check (commission_percent between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table profiles (
  id text primary key,
  email text,
  first_name text check (char_length(first_name) <= 40),
  program_id uuid references programs (id) on delete set null,
  daily_goal_minutes integer not null default 5 check (daily_goal_minutes in (5, 10, 15)),
  reminder_enabled boolean not null default true,
  reminder_time time not null default '19:00',
  push_token text,
  driving_school_id uuid references driving_schools (id) on delete set null,
  created_at timestamptz not null default now()
);

create function ensure_profile(p_user_id text, p_email text)
returns profiles
language sql
as $$
  insert into profiles (id, email) values (p_user_id, p_email)
  on conflict (id) do update set email = coalesce(excluded.email, profiles.email)
  returning *;
$$;

create function delete_account(p_user_id text)
returns void
language sql
as $$
  delete from profiles where id = p_user_id;
$$;
```

- [ ] **Step 4 : Lancer les tests**

Run: `npm test -w @drivelearn/db`
Expected: tous les fichiers passent.

- [ ] **Step 5 : Commit**

```bash
git add packages/db/migrations/0002_profiles.sql packages/db/test/profiles.test.ts
git commit -m "feat(db): profils et auto-écoles"
```

---

### Task 4 : Séances, notation, révision des erreurs et série de jours

**Files:**
- Create: `packages/db/migrations/0003_sessions.sql`
- Test: `packages/db/test/sessions.test.ts`

**Interfaces:**
- Consumes: `setting_int`, `questions`, `choices`, `lessons`, `units` (Task 2) ; `profiles` (Task 3)
- Produces:
  - Type `session_kind` (`lecon`, `erreurs`, `theme`)
  - Tables : `practice_sessions(id, user_id, kind, lesson_id, unit_id, completed_at, activity_date, received_at, active_seconds, correct_count, question_count, xp_earned)`, `session_answers(session_id, question_id, choice_ids, is_correct)`, `question_mastery(user_id, question_id, consecutive_correct, needs_review, updated_at)`
  - `is_answer_correct(p_question_id uuid, p_choice_ids uuid[]) returns boolean`
  - `submit_session(p_user_id text, p_session_id uuid, p_kind session_kind, p_lesson_id uuid, p_unit_id uuid, p_completed_at timestamptz, p_active_seconds integer, p_answers jsonb) returns practice_sessions` : idempotent sur `p_session_id` (généré par l'application). `p_answers` = `[{"question_id": "<uuid>", "choice_ids": ["<uuid>", ...]}]`. Erreurs : `session_conflict`, `invalid_session`, `invalid_answers`, `unknown_question`.
  - `get_review_questions(p_user_id text, p_program_id uuid, p_limit integer) returns uuid[]` : questions à revoir, les plus anciennes d'abord
  - `compute_streak(p_user_id text, p_today date) returns integer`

- [ ] **Step 1 : Écrire le test qui échoue**

`packages/db/test/sessions.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createPath, createQuestion, createUser, expectError, newId, scalar, withTx, type Db } from "./helpers.js";

type Answer = { question_id: string; choice_ids: string[] };

async function setup(db: Db) {
  const path = await createPath(db);
  const single = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, correct: 1, wrong: 1, status: "validee" });
  const multi = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, correct: 2, wrong: 1, status: "validee" });
  const draft = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId });
  await createUser(db, "user-a");
  await createUser(db, "user-b");
  return { ...path, single, multi, draft };
}

const SUBMIT = `select * from submit_session($1, $2, $3, $4, $5, coalesce($6::timestamptz, now()), $7, $8)`;

async function submit(
  db: Db,
  userId: string,
  sessionId: string,
  answers: Answer[],
  opts: { kind?: string; lessonId?: string | null; unitId?: string | null; completedAt?: string; activeSeconds?: number },
) {
  const { rows } = await db.query(SUBMIT, [
    userId,
    sessionId,
    opts.kind ?? "lecon",
    opts.lessonId ?? null,
    opts.unitId ?? null,
    opts.completedAt ?? null,
    opts.activeSeconds ?? 60,
    JSON.stringify(answers),
  ]);
  return rows[0];
}

const TODAY = "select (now() at time zone 'Africa/Lome')::date::text";

describe("notation tout ou rien", () => {
  it("applique la règle officielle", () =>
    withTx(async (db) => {
      const { single, multi } = await setup(db);
      const check = (qid: string, ids: string[]) =>
        scalar<boolean>(db, "select is_answer_correct($1, $2::uuid[])", [qid, ids]);
      const [a, b] = multi.correct;
      const [c] = multi.wrong;
      expect(await check(multi.id, [a, b])).toBe(true);
      expect(await check(multi.id, [b, a])).toBe(true);
      expect(await check(multi.id, [a])).toBe(false);
      expect(await check(multi.id, [a, b, c])).toBe(false);
      expect(await check(multi.id, [])).toBe(false);
      expect(await check(multi.id, [a, a, b])).toBe(true);
      expect(await check(single.id, [single.correct[0], a])).toBe(false);
    }));
});

describe("séances", () => {
  it("note une leçon et donne 10 XP", () =>
    withTx(async (db) => {
      const { lessonId, single, multi } = await setup(db);
      const row = await submit(db, "user-a", newId(), [
        { question_id: single.id, choice_ids: single.correct },
        { question_id: multi.id, choice_ids: [multi.correct[0]] },
      ], { lessonId });
      expect({ c: row.correct_count, n: row.question_count, xp: row.xp_earned }).toEqual({ c: 1, n: 2, xp: 10 });
    }));

  it("donne 15 XP pour un sans-faute", () =>
    withTx(async (db) => {
      const { lessonId, single, multi } = await setup(db);
      const row = await submit(db, "user-a", newId(), [
        { question_id: single.id, choice_ids: single.correct },
        { question_id: multi.id, choice_ids: multi.correct },
      ], { lessonId });
      expect(row.xp_earned).toBe(15);
    }));

  it("ignore un renvoi de la même séance (synchronisation hors ligne)", () =>
    withTx(async (db) => {
      const { lessonId, single } = await setup(db);
      const id = newId();
      const answers = [{ question_id: single.id, choice_ids: single.correct }];
      await submit(db, "user-a", id, answers, { lessonId });
      await submit(db, "user-a", id, answers, { lessonId });
      expect(await scalar<number>(db, "select count(*)::int from practice_sessions")).toBe(1);
      expect(await scalar<number>(db, "select sum(xp_earned)::int from practice_sessions")).toBe(15);
    }));

  it("refuse l'identifiant de séance d'un autre élève", () =>
    withTx(async (db) => {
      const { lessonId, single } = await setup(db);
      const id = newId();
      const answers = [{ question_id: single.id, choice_ids: single.correct }];
      await submit(db, "user-a", id, answers, { lessonId });
      await expectError(db, SUBMIT, ["user-b", id, "lecon", lessonId, null, null, 60, JSON.stringify(answers)], "session_conflict");
    }));

  it("compte une seule fois une question envoyée en double", () =>
    withTx(async (db) => {
      const { lessonId, single } = await setup(db);
      const row = await submit(db, "user-a", newId(), [
        { question_id: single.id, choice_ids: single.correct },
        { question_id: single.id, choice_ids: single.wrong },
      ], { lessonId });
      expect(row.question_count).toBe(1);
    }));

  it("ramène une date future à aujourd'hui et plafonne la durée à une heure", () =>
    withTx(async (db) => {
      const { lessonId, single } = await setup(db);
      const id = newId();
      await submit(db, "user-a", id, [{ question_id: single.id, choice_ids: single.correct }], {
        lessonId,
        completedAt: "2099-01-01T00:00:00Z",
        activeSeconds: 99_999,
      });
      const { rows } = await db.query(
        "select activity_date::text as d, active_seconds from practice_sessions where id = $1",
        [id],
      );
      expect(rows[0]).toEqual({ d: await scalar<string>(db, TODAY), active_seconds: 3600 });
    }));

  it("refuse une question non validée, une séance vide ou incomplète", () =>
    withTx(async (db) => {
      const { lessonId, draft, single } = await setup(db);
      const ok = JSON.stringify([{ question_id: single.id, choice_ids: single.correct }]);
      await expectError(db, SUBMIT, ["user-a", newId(), "lecon", lessonId, null, null, 60,
        JSON.stringify([{ question_id: draft.id, choice_ids: draft.correct }])], "unknown_question");
      await expectError(db, SUBMIT, ["user-a", newId(), "lecon", lessonId, null, null, 60, "[]"], "invalid_answers");
      await expectError(db, SUBMIT, ["user-a", newId(), "lecon", null, null, null, 60, ok], "invalid_session");
      await expectError(db, SUBMIT, ["user-a", newId(), "theme", null, null, null, 60, ok], "invalid_session");
    }));

  it("accepte une révision par thème", () =>
    withTx(async (db) => {
      const { unitId, single } = await setup(db);
      const row = await submit(db, "user-a", newId(), [{ question_id: single.id, choice_ids: single.correct }], {
        kind: "theme",
        unitId,
      });
      expect(row.kind).toBe("theme");
    }));
});

describe("révision des erreurs", () => {
  it("garde une question à revoir jusqu'à deux réussites consécutives", () =>
    withTx(async (db) => {
      const { programId, lessonId, multi } = await setup(db);
      const review = () => scalar<string[]>(db, "select get_review_questions('user-a', $1, 10)", [programId]);

      await submit(db, "user-a", newId(), [{ question_id: multi.id, choice_ids: [multi.correct[0]] }], { lessonId });
      expect(await review()).toEqual([multi.id]);

      await submit(db, "user-a", newId(), [{ question_id: multi.id, choice_ids: multi.correct }], { kind: "erreurs" });
      expect(await review()).toEqual([multi.id]);

      await submit(db, "user-a", newId(), [{ question_id: multi.id, choice_ids: multi.correct }], { kind: "erreurs" });
      expect(await review()).toEqual([]);
    }));

  it("n'ajoute pas à la révision une question réussie du premier coup", () =>
    withTx(async (db) => {
      const { programId, lessonId, single } = await setup(db);
      await submit(db, "user-a", newId(), [{ question_id: single.id, choice_ids: single.correct }], { lessonId });
      expect(await scalar<string[]>(db, "select get_review_questions('user-a', $1, 10)", [programId])).toEqual([]);
    }));
});

describe("série de jours", () => {
  it("compte les jours consécutifs", () =>
    withTx(async (db) => {
      const { lessonId } = await setup(db);
      for (const day of ["2026-06-10", "2026-06-09", "2026-06-08", "2026-06-06"]) {
        await db.query(
          `insert into practice_sessions (id, user_id, kind, lesson_id, completed_at, activity_date)
           values (gen_random_uuid(), 'user-a', 'lecon', $1, now(), $2)`,
          [lessonId, day],
        );
      }
      const streak = (today: string) => scalar<number>(db, "select compute_streak('user-a', $1::date)", [today]);
      expect(await streak("2026-06-10")).toBe(3);
      expect(await streak("2026-06-11")).toBe(3); // pas encore révisé aujourd'hui : la série d'hier tient
      expect(await streak("2026-06-12")).toBe(0); // un jour manqué
      expect(await streak("2026-06-07")).toBe(1);
    }));
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npm test -w @drivelearn/db`
Expected: `sessions.test.ts` échoue avec `function is_answer_correct(unknown, uuid[]) does not exist`.

- [ ] **Step 3 : Écrire la migration**

`packages/db/migrations/0003_sessions.sql` :

```sql
create type session_kind as enum ('lecon', 'erreurs', 'theme');

create table practice_sessions (
  id uuid primary key,
  user_id text not null references profiles (id) on delete cascade,
  kind session_kind not null,
  lesson_id uuid references lessons (id) on delete set null,
  unit_id uuid references units (id) on delete set null,
  completed_at timestamptz not null,
  activity_date date not null,
  received_at timestamptz not null default now(),
  active_seconds integer not null default 0 check (active_seconds between 0 and 3600),
  correct_count integer not null default 0,
  question_count integer not null default 0,
  xp_earned integer not null default 0
);
create index practice_sessions_user_day_idx on practice_sessions (user_id, activity_date);

create table session_answers (
  session_id uuid not null references practice_sessions (id) on delete cascade,
  question_id uuid not null references questions (id) on delete cascade,
  choice_ids uuid[] not null,
  is_correct boolean not null,
  primary key (session_id, question_id)
);

create table question_mastery (
  user_id text not null references profiles (id) on delete cascade,
  question_id uuid not null references questions (id) on delete cascade,
  consecutive_correct integer not null default 0,
  needs_review boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

-- Notation tout ou rien : les choix cochés sont exactement les bonnes réponses
create function is_answer_correct(p_question_id uuid, p_choice_ids uuid[])
returns boolean
language sql stable
as $$
  select coalesce(
    (select array_agg(id order by id) from choices where question_id = p_question_id and is_correct)
    = (select array_agg(distinct c order by c) from unnest(p_choice_ids) as c),
    false
  );
$$;

create function submit_session(
  p_user_id text,
  p_session_id uuid,
  p_kind session_kind,
  p_lesson_id uuid,
  p_unit_id uuid,
  p_completed_at timestamptz,
  p_active_seconds integer,
  p_answers jsonb
)
returns practice_sessions
language plpgsql
as $$
declare
  v_row practice_sessions;
  v_completed timestamptz;
  v_answer jsonb;
  v_qid uuid;
  v_choices uuid[];
  v_ok boolean;
  v_total integer := 0;
  v_correct integer := 0;
begin
  select * into v_row from practice_sessions where id = p_session_id;
  if found then
    if v_row.user_id <> p_user_id then
      raise exception 'session_conflict';
    end if;
    return v_row;
  end if;

  if (p_kind = 'lecon' and p_lesson_id is null) or (p_kind = 'theme' and p_unit_id is null) then
    raise exception 'invalid_session';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) = 0 then
    raise exception 'invalid_answers';
  end if;

  v_completed := least(coalesce(p_completed_at, now()), now());
  insert into practice_sessions (id, user_id, kind, lesson_id, unit_id, completed_at, activity_date, active_seconds)
  values (
    p_session_id, p_user_id, p_kind, p_lesson_id, p_unit_id, v_completed,
    (v_completed at time zone 'Africa/Lome')::date,
    greatest(0, least(coalesce(p_active_seconds, 0), 3600))
  );

  for v_answer in select value from jsonb_array_elements(p_answers) loop
    v_qid := (v_answer ->> 'question_id')::uuid;
    if not exists (select 1 from questions where id = v_qid and status = 'validee') then
      raise exception 'unknown_question';
    end if;
    v_choices := array(
      select jsonb_array_elements_text(coalesce(v_answer -> 'choice_ids', '[]'::jsonb))::uuid
    );
    v_ok := is_answer_correct(v_qid, v_choices);

    insert into session_answers (session_id, question_id, choice_ids, is_correct)
    values (p_session_id, v_qid, v_choices, v_ok)
    on conflict (session_id, question_id) do nothing;
    continue when not found;

    v_total := v_total + 1;
    if v_ok then
      v_correct := v_correct + 1;
    end if;

    insert into question_mastery as m (user_id, question_id, consecutive_correct, needs_review, updated_at)
    values (p_user_id, v_qid, case when v_ok then 1 else 0 end, not v_ok, now())
    on conflict (user_id, question_id) do update set
      consecutive_correct = case when v_ok then m.consecutive_correct + 1 else 0 end,
      needs_review = case
        when not v_ok then true
        when m.consecutive_correct + 1 >= 2 then false
        else m.needs_review
      end,
      updated_at = now();
  end loop;

  update practice_sessions set
    correct_count = v_correct,
    question_count = v_total,
    xp_earned = setting_int('xp_per_session')
      + case when v_correct = v_total then setting_int('xp_perfect_bonus') else 0 end
  where id = p_session_id
  returning * into v_row;

  return v_row;
end $$;

create function get_review_questions(p_user_id text, p_program_id uuid, p_limit integer)
returns uuid[]
language sql stable
as $$
  select coalesce(array_agg(id), '{}')
  from (
    select q.id
    from question_mastery m
    join questions q on q.id = m.question_id
    join units u on u.id = q.unit_id
    where m.user_id = p_user_id and m.needs_review and q.status = 'validee' and u.program_id = p_program_id
    order by m.updated_at
    limit greatest(p_limit, 0)
  ) as s;
$$;

-- Jours consécutifs se terminant aujourd'hui, ou hier si pas encore de séance aujourd'hui
create function compute_streak(p_user_id text, p_today date)
returns integer
language plpgsql stable
as $$
declare
  v_day date;
  v_streak integer := 0;
begin
  if exists (select 1 from practice_sessions where user_id = p_user_id and activity_date = p_today) then
    v_day := p_today;
  else
    v_day := p_today - 1;
  end if;
  while exists (select 1 from practice_sessions where user_id = p_user_id and activity_date = v_day) loop
    v_streak := v_streak + 1;
    v_day := v_day - 1;
  end loop;
  return v_streak;
end $$;
```

- [ ] **Step 4 : Lancer les tests**

Run: `npm test -w @drivelearn/db`
Expected: tous les fichiers passent.

- [ ] **Step 5 : Commit**

```bash
git add packages/db/migrations/0003_sessions.sql packages/db/test/sessions.test.ts
git commit -m "feat(db): séances, notation, révision des erreurs et série de jours"
```

---

### Task 5 : Pass et examens blancs

**Files:**
- Create: `packages/db/migrations/0004_exams.sql`
- Test: `packages/db/test/exams.test.ts`

**Interfaces:**
- Consumes: `programs`, `units`, `questions`, `choices`, `setting_int` (Task 2) ; `profiles` (Task 3) ; `is_answer_correct` (Task 4)
- Produces:
  - Tables : `passes(id, user_id, payment_id, starts_at, ends_at, created_at)` (clé étrangère vers `payments` ajoutée en Task 6), `exam_attempts(id, user_id, program_id, question_ids, seconds_per_question, pass_mark, started_at, expires_at, submitted_at, score, passed, active_seconds)`, `exam_answers(attempt_id, question_id, choice_ids, answered_at)`
  - `has_active_pass(p_user_id text) returns boolean`
  - `draw_exam_questions(p_program_id uuid) returns uuid[]`
  - `start_exam(p_user_id text, p_program_id uuid) returns jsonb` : reprend l'examen ouvert s'il existe, sinon en crée un. Erreurs : `program_not_found`, `pass_required`, `not_enough_questions`.
  - `get_exam(p_user_id text, p_attempt_id uuid) returns jsonb` : `{attempt_id, started_at, expires_at, seconds_per_question, pass_mark, total, submitted, score, passed, questions: [{id, prompt, image_path, multiple, explanation, selected, is_correct, choices: [{id, label, is_correct}]}]}`. `explanation` et `is_correct` valent `null` avant la soumission. Erreur : `exam_not_found`.
  - `save_exam_answer(p_user_id text, p_attempt_id uuid, p_question_id uuid, p_choice_ids uuid[]) returns void` : la première réponse est définitive. Erreurs : `exam_not_found`, `exam_closed`, `question_not_in_exam`.
  - `submit_exam(p_user_id text, p_attempt_id uuid) returns jsonb` : idempotent, renvoie `get_exam`
  - `finalize_exam(p_attempt_id uuid) returns void` : usage interne (API et tâches), sans contrôle de propriétaire
  - `get_exam_status(p_user_id text) returns jsonb` : `{has_pass, pass_ends_at, free_exam_available, exams_taken, consecutive_passes, required_passes, ready}`
  - `get_exam_history(p_user_id text) returns jsonb` : `[{attempt_id, submitted_at, score, total, passed}]`, du plus récent au plus ancien

- [ ] **Step 1 : Écrire le test qui échoue**

`packages/db/test/exams.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createLesson, createPath, createQuestion, createUnit, createUser, expectError, scalar, withTx, type Db } from "./helpers.js";

type Exam = {
  attempt_id: string;
  total: number;
  submitted: boolean;
  score: number | null;
  passed: boolean | null;
  questions: Array<{
    id: string;
    multiple: boolean;
    explanation: string | null;
    is_correct: boolean | null;
    choices: Array<{ id: string; is_correct: boolean | null }>;
  }>;
};

/** Programme à 3 questions, seuil 2, deux unités de deux questions validées. */
async function setup(db: Db) {
  const { programId, unitId: unitA, lessonId: lessonA } = await createPath(db, { examQuestionCount: 3, examPassMark: 2 });
  const unitB = await createUnit(db, programId, 2);
  const lessonB = await createLesson(db, unitB, 1);
  const questions = [
    await createQuestion(db, { unitId: unitA, lessonId: lessonA, status: "validee" }),
    await createQuestion(db, { unitId: unitA, lessonId: lessonA, status: "validee" }),
    await createQuestion(db, { unitId: unitB, lessonId: lessonB, status: "validee" }),
    await createQuestion(db, { unitId: unitB, lessonId: lessonB, status: "validee" }),
  ];
  const correct = new Map(questions.map((q) => [q.id, q.correct]));
  const wrong = new Map(questions.map((q) => [q.id, q.wrong]));
  for (const user of ["user-a", "user-b", "user-c"]) await createUser(db, user);
  return { programId, unitA, questions, correct, wrong };
}

const start = (db: Db, user: string, programId: string) =>
  scalar<Exam>(db, "select start_exam($1, $2)", [user, programId]);
const getExam = (db: Db, user: string, attemptId: string) =>
  scalar<Exam>(db, "select get_exam($1, $2)", [user, attemptId]);
const save = (db: Db, user: string, attemptId: string, questionId: string, choiceIds: string[]) =>
  db.query("select save_exam_answer($1, $2, $3, $4::uuid[])", [user, attemptId, questionId, choiceIds]);
const submitExam = (db: Db, user: string, attemptId: string) =>
  scalar<Exam>(db, "select submit_exam($1, $2)", [user, attemptId]);
const status = (db: Db, user: string) => scalar<Record<string, unknown>>(db, "select get_exam_status($1)", [user]);
const givePass = (db: Db, user: string) =>
  db.query("insert into passes (user_id, starts_at, ends_at) values ($1, now() - interval '1 day', now() + interval '89 days')", [user]);

describe("examen gratuit", () => {
  it("démarre un examen de 3 questions sans révéler les réponses", () =>
    withTx(async (db) => {
      const { programId } = await setup(db);
      expect((await status(db, "user-a")).free_exam_available).toBe(true);
      const exam = await start(db, "user-a", programId);
      expect(exam.total).toBe(3);
      expect(exam.questions).toHaveLength(3);
      for (const q of exam.questions) {
        expect(q.explanation).toBeNull();
        expect(q.is_correct).toBeNull();
        expect(q.multiple).toBe(false);
        expect(q.choices.every((c) => c.is_correct === null)).toBe(true);
      }
    }));

  it("reprend l'examen en cours au lieu d'en consommer un second", () =>
    withTx(async (db) => {
      const { programId } = await setup(db);
      const first = await start(db, "user-a", programId);
      const again = await start(db, "user-a", programId);
      expect(again.attempt_id).toBe(first.attempt_id);
      expect(await scalar<number>(db, "select count(*)::int from exam_attempts where user_id = 'user-a'")).toBe(1);
    }));

  it("note tout ou rien, sans retour en arrière, puis demande un Pass", () =>
    withTx(async (db) => {
      const { programId, correct, wrong } = await setup(db);
      const exam = await start(db, "user-a", programId);
      const [q1, q2, q3] = exam.questions.map((q) => q.id);

      await save(db, "user-a", exam.attempt_id, q1, correct.get(q1)!);
      await save(db, "user-a", exam.attempt_id, q2, correct.get(q2)!);
      await save(db, "user-a", exam.attempt_id, q1, wrong.get(q1)!); // ignorée : première réponse définitive

      const result = await submitExam(db, "user-a", exam.attempt_id);
      expect({ score: result.score, passed: result.passed }).toEqual({ score: 2, passed: true });
      expect((await submitExam(db, "user-a", exam.attempt_id)).score).toBe(2);

      const corrected = await getExam(db, "user-a", exam.attempt_id);
      expect(corrected.questions.find((q) => q.id === q3)!.is_correct).toBe(false);
      expect(corrected.questions.every((q) => q.explanation !== null)).toBe(true);

      await expectError(db, "select save_exam_answer($1, $2, $3, '{}')", ["user-a", exam.attempt_id, q3], "exam_closed");
      await expectError(db, "select start_exam($1, $2)", ["user-a", programId], "pass_required");
    }));

  it("refuse une question qui n'est pas dans l'examen", () =>
    withTx(async (db) => {
      const { programId, questions } = await setup(db);
      const exam = await start(db, "user-a", programId);
      const outside = questions.find((q) => !exam.questions.some((eq) => eq.id === q.id))!;
      await expectError(db, "select save_exam_answer($1, $2, $3, '{}')", ["user-a", exam.attempt_id, outside.id], "question_not_in_exam");
    }));

  it("cache l'examen aux autres élèves", () =>
    withTx(async (db) => {
      const { programId } = await setup(db);
      const exam = await start(db, "user-a", programId);
      await expectError(db, "select get_exam($1, $2)", ["user-b", exam.attempt_id], "exam_not_found");
      await expectError(db, "select submit_exam($1, $2)", ["user-b", exam.attempt_id], "exam_not_found");
    }));
});

describe("avec un Pass", () => {
  it("note un examen expiré avec les réponses reçues et en ouvre un nouveau", () =>
    withTx(async (db) => {
      const { programId } = await setup(db);
      await givePass(db, "user-a");
      expect((await status(db, "user-a")).has_pass).toBe(true);
      const first = await start(db, "user-a", programId);
      await db.query("update exam_attempts set expires_at = now() - interval '1 minute' where id = $1", [first.attempt_id]);

      await expectError(
        db,
        "select save_exam_answer($1, $2, $3, '{}')",
        ["user-a", first.attempt_id, first.questions[0].id],
        "exam_closed",
      );
      const second = await start(db, "user-a", programId);
      expect(second.attempt_id).not.toBe(first.attempt_id);
      expect((await getExam(db, "user-a", first.attempt_id)).submitted).toBe(true);
    }));

  it("signale une banque de questions trop petite", () =>
    withTx(async (db) => {
      const { programId } = await setup(db);
      await givePass(db, "user-a");
      await db.query("update programs set exam_question_count = 10 where id = $1", [programId]);
      await expectError(db, "select start_exam($1, $2)", ["user-a", programId], "not_enough_questions");
    }));

  it("respecte la répartition par thème", () =>
    withTx(async (db) => {
      const { programId, unitA } = await setup(db);
      await db.query(
        "update programs set exam_question_count = 2, exam_pass_mark = 1, exam_distribution = jsonb_build_object($2::text, 2) where id = $1",
        [programId, unitA],
      );
      const exam = await start(db, "user-a", programId);
      const units = await scalar<string[]>(
        db,
        "select array_agg(distinct unit_id::text) from questions where id = any($1::uuid[])",
        [exam.questions.map((q) => q.id)],
      );
      expect(units).toEqual([unitA]);
    }));

  it("refuse un programme inconnu", () =>
    withTx(async (db) => {
      await setup(db);
      await expectError(db, "select start_exam($1, $2)", ["user-a", "00000000-0000-0000-0000-000000000000"], "program_not_found");
    }));
});

describe("statut et historique", () => {
  it("devient « prêt » après le nombre de réussites consécutives demandé", () =>
    withTx(async (db) => {
      const { programId } = await setup(db);
      for (const [hoursAgo, passed] of [[3, false], [2, true], [1, true]] as const) {
        await db.query(
          `insert into exam_attempts (user_id, program_id, question_ids, seconds_per_question, pass_mark, started_at, expires_at, submitted_at, score, passed)
           values ('user-c', $1, '{}', 30, 2, now() - make_interval(hours => $2), now(), now() - make_interval(hours => $2), 0, $3)`,
          [programId, hoursAgo, passed],
        );
      }
      const s = await status(db, "user-c");
      expect({ consecutive: s.consecutive_passes, ready: s.ready, free: s.free_exam_available, taken: s.exams_taken })
        .toEqual({ consecutive: 2, ready: false, free: false, taken: 3 });

      await db.query("update settings set value = '2' where key = 'ready_after_consecutive_passes'");
      expect((await status(db, "user-c")).ready).toBe(true);

      const history = await scalar<Array<{ score: number; passed: boolean }>>(db, "select get_exam_history('user-c')");
      expect(history.map((h) => h.passed)).toEqual([true, true, false]);
    }));
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npm test -w @drivelearn/db`
Expected: `exams.test.ts` échoue avec `function get_exam_status(unknown) does not exist`.

- [ ] **Step 3 : Écrire la migration**

`packages/db/migrations/0004_exams.sql` :

```sql
create table passes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references profiles (id) on delete cascade,
  payment_id uuid unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index passes_user_idx on passes (user_id, ends_at);

create table exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references profiles (id) on delete cascade,
  program_id uuid not null references programs (id) on delete cascade,
  question_ids uuid[] not null,
  seconds_per_question integer not null,
  pass_mark integer not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  score integer,
  passed boolean,
  active_seconds integer not null default 0
);
create index exam_attempts_user_idx on exam_attempts (user_id, started_at desc);

create table exam_answers (
  attempt_id uuid not null references exam_attempts (id) on delete cascade,
  question_id uuid not null,
  choice_ids uuid[] not null,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create function has_active_pass(p_user_id text)
returns boolean
language sql stable
as $$
  select exists (
    select 1 from passes where user_id = p_user_id and starts_at <= now() and ends_at > now()
  );
$$;

-- Tirage : d'abord la répartition par unité, puis complément aléatoire sur tout le programme
create function draw_exam_questions(p_program_id uuid)
returns uuid[]
language plpgsql volatile
as $$
declare
  v_program programs;
  v_ids uuid[] := '{}';
  v_part record;
begin
  select * into v_program from programs where id = p_program_id;

  for v_part in
    select key::uuid as unit_id, (value #>> '{}')::integer as n
    from jsonb_each(v_program.exam_distribution)
  loop
    v_ids := v_ids || array(
      select q.id from questions q
      join units u on u.id = q.unit_id
      where q.unit_id = v_part.unit_id and u.program_id = p_program_id
        and q.status = 'validee' and not (q.id = any(v_ids))
      order by random()
      limit greatest(v_part.n, 0)
    );
  end loop;

  v_ids := v_ids || array(
    select q.id from questions q
    join units u on u.id = q.unit_id
    where u.program_id = p_program_id and q.status = 'validee' and not (q.id = any(v_ids))
    order by random()
    limit greatest(v_program.exam_question_count - coalesce(array_length(v_ids, 1), 0), 0)
  );

  return (array(select x from unnest(v_ids) as x order by random()))[1:v_program.exam_question_count];
end $$;

create function get_exam(p_user_id text, p_attempt_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_a exam_attempts;
  v_done boolean;
begin
  select * into v_a from exam_attempts where id = p_attempt_id and user_id = p_user_id;
  if not found then
    raise exception 'exam_not_found';
  end if;
  v_done := v_a.submitted_at is not null;

  return jsonb_build_object(
    'attempt_id', v_a.id,
    'started_at', v_a.started_at,
    'expires_at', v_a.expires_at,
    'seconds_per_question', v_a.seconds_per_question,
    'pass_mark', v_a.pass_mark,
    'total', coalesce(array_length(v_a.question_ids, 1), 0),
    'submitted', v_done,
    'score', v_a.score,
    'passed', v_a.passed,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'prompt', q.prompt,
        'image_path', q.image_path,
        'multiple', (select count(*) from choices c where c.question_id = q.id and c.is_correct) > 1,
        'explanation', case when v_done then q.explanation end,
        'selected', to_jsonb(ea.choice_ids),
        'is_correct', case when v_done then is_answer_correct(q.id, coalesce(ea.choice_ids, '{}')) end,
        'choices', (
          select jsonb_agg(jsonb_build_object(
            'id', c.id,
            'label', c.label,
            'is_correct', case when v_done then c.is_correct end
          ) order by c.position)
          from choices c where c.question_id = q.id
        )
      ) order by t.ord)
      from unnest(v_a.question_ids) with ordinality as t(qid, ord)
      join questions q on q.id = t.qid
      left join exam_answers ea on ea.attempt_id = v_a.id and ea.question_id = q.id
    ), '[]'::jsonb)
  );
end $$;

create function finalize_exam(p_attempt_id uuid)
returns void
language plpgsql
as $$
declare
  v_a exam_attempts;
  v_score integer;
begin
  select * into v_a from exam_attempts where id = p_attempt_id for update;
  if not found or v_a.submitted_at is not null then
    return;
  end if;

  select count(*) into v_score
  from unnest(v_a.question_ids) as t(q)
  left join exam_answers ea on ea.attempt_id = v_a.id and ea.question_id = t.q
  where is_answer_correct(t.q, coalesce(ea.choice_ids, '{}'));

  update exam_attempts set
    submitted_at = now(),
    score = v_score,
    passed = v_score >= v_a.pass_mark,
    active_seconds = least(
      extract(epoch from now() - v_a.started_at)::integer,
      coalesce(array_length(v_a.question_ids, 1), 0) * v_a.seconds_per_question
    )
  where id = v_a.id;
end $$;

create function start_exam(p_user_id text, p_program_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_program programs;
  v_expired uuid;
  v_open_id uuid;
  v_ids uuid[];
  v_id uuid;
begin
  select * into v_program from programs where id = p_program_id;
  if not found then
    raise exception 'program_not_found';
  end if;

  for v_expired in
    select id from exam_attempts
    where user_id = p_user_id and submitted_at is null and expires_at <= now()
  loop
    perform finalize_exam(v_expired);
  end loop;

  select id into v_open_id from exam_attempts
  where user_id = p_user_id and submitted_at is null
  order by started_at desc limit 1;
  if v_open_id is not null then
    return get_exam(p_user_id, v_open_id);
  end if;

  if not has_active_pass(p_user_id)
     and exists (select 1 from exam_attempts where user_id = p_user_id) then
    raise exception 'pass_required';
  end if;

  v_ids := draw_exam_questions(p_program_id);
  if coalesce(array_length(v_ids, 1), 0) < v_program.exam_question_count then
    raise exception 'not_enough_questions';
  end if;

  insert into exam_attempts (user_id, program_id, question_ids, seconds_per_question, pass_mark, expires_at)
  values (
    p_user_id, p_program_id, v_ids, v_program.exam_seconds_per_question, v_program.exam_pass_mark,
    now() + make_interval(secs => v_program.exam_question_count * v_program.exam_seconds_per_question + 120)
  )
  returning id into v_id;

  return get_exam(p_user_id, v_id);
end $$;

create function save_exam_answer(p_user_id text, p_attempt_id uuid, p_question_id uuid, p_choice_ids uuid[])
returns void
language plpgsql
as $$
declare
  v_a exam_attempts;
begin
  select * into v_a from exam_attempts where id = p_attempt_id and user_id = p_user_id;
  if not found then
    raise exception 'exam_not_found';
  end if;
  if v_a.submitted_at is not null or v_a.expires_at <= now() then
    raise exception 'exam_closed';
  end if;
  if not (p_question_id = any(v_a.question_ids)) then
    raise exception 'question_not_in_exam';
  end if;

  insert into exam_answers (attempt_id, question_id, choice_ids)
  values (p_attempt_id, p_question_id, coalesce(p_choice_ids, '{}'))
  on conflict (attempt_id, question_id) do nothing;
end $$;

create function submit_exam(p_user_id text, p_attempt_id uuid)
returns jsonb
language plpgsql
as $$
begin
  if not exists (select 1 from exam_attempts where id = p_attempt_id and user_id = p_user_id) then
    raise exception 'exam_not_found';
  end if;
  perform finalize_exam(p_attempt_id);
  return get_exam(p_user_id, p_attempt_id);
end $$;

create function get_exam_status(p_user_id text)
returns jsonb
language plpgsql
as $$
declare
  v_required integer := setting_int('ready_after_consecutive_passes');
  v_consecutive integer;
begin
  select count(*) into v_consecutive
  from (
    select sum(case when passed then 0 else 1 end) over (order by submitted_at desc) as fails
    from exam_attempts
    where user_id = p_user_id and submitted_at is not null
  ) as s
  where s.fails = 0;

  return jsonb_build_object(
    'has_pass', has_active_pass(p_user_id),
    'pass_ends_at', (select max(ends_at) from passes where user_id = p_user_id and ends_at > now()),
    'free_exam_available', not exists (select 1 from exam_attempts where user_id = p_user_id),
    'exams_taken', (select count(*) from exam_attempts where user_id = p_user_id and submitted_at is not null),
    'consecutive_passes', v_consecutive,
    'required_passes', v_required,
    'ready', v_consecutive >= v_required
  );
end $$;

create function get_exam_history(p_user_id text)
returns jsonb
language sql stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'attempt_id', id,
    'submitted_at', submitted_at,
    'score', score,
    'total', coalesce(array_length(question_ids, 1), 0),
    'passed', passed
  ) order by submitted_at desc), '[]'::jsonb)
  from exam_attempts
  where user_id = p_user_id and submitted_at is not null;
$$;
```

- [ ] **Step 4 : Lancer les tests**

Run: `npm test -w @drivelearn/db`
Expected: tous les fichiers passent.

- [ ] **Step 5 : Commit**

```bash
git add packages/db/migrations/0004_exams.sql packages/db/test/exams.test.ts
git commit -m "feat(db): pass et examens blancs"
```

---

### Task 6 : Paiements, code promo et commissions

**Files:**
- Create: `packages/db/migrations/0005_payments.sql`
- Test: `packages/db/test/payments.test.ts`

**Interfaces:**
- Consumes: `setting_int` (Task 2) ; `profiles`, `driving_schools`, `delete_account` (Task 3) ; `passes` (Task 5)
- Produces:
  - Type `payment_status` (`pending`, `confirmed`, `failed`) ; table `payments(id, user_id, driving_school_id, base_amount_xof, discount_xof, amount_xof, commission_xof, status, gateway_ref, failure_reason, created_at, confirmed_at)`
  - `set_promo_code(p_user_id text, p_code text) returns text` : nom de l'auto-école, ou `null` si le code est vidé. Erreurs : `invalid_promo_code`, `promo_locked`.
  - `create_payment(p_user_id text) returns payments`
  - `confirm_payment(p_payment_id uuid, p_gateway_ref text, p_amount_xof integer) returns passes` : idempotent. Erreurs : `payment_not_found`, `amount_mismatch`. À appeler **uniquement** depuis le webhook vérifié.
  - `fail_payment(p_payment_id uuid, p_reason text) returns void`
  - `expire_stale_payments() returns integer`
  - `admin_commission_report(p_month date) returns table (driving_school_id uuid, name text, sales_count bigint, revenue_xof bigint, commission_xof bigint)` : l'appelant (admin) vérifie le rôle.

- [ ] **Step 1 : Écrire le test qui échoue**

`packages/db/test/payments.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createUser, expectError, scalar, withTx, type Db } from "./helpers.js";

async function setup(db: Db) {
  await createUser(db, "user-a");
  await createUser(db, "user-b");
  const schoolId = await scalar<string>(
    db,
    `insert into driving_schools (name, promo_code, discount_percent, commission_percent)
     values ('Auto-école Le Volant', 'VOLANT', 10, 15) returning id`,
  );
  await db.query("insert into driving_schools (name, promo_code, active) values ('Auto-école Fermée', 'FERME', false)");
  return { schoolId };
}

const createPayment = (db: Db, user: string) =>
  db.query("select * from create_payment($1)", [user]).then((r) => r.rows[0]);
const confirm = (db: Db, paymentId: string, ref: string, amount: number) =>
  db.query("select * from confirm_payment($1, $2, $3)", [paymentId, ref, amount]).then((r) => r.rows[0]);

describe("code promo", () => {
  it("accepte un code sans tenir compte de la casse ni des espaces", () =>
    withTx(async (db) => {
      await setup(db);
      expect(await scalar<string>(db, "select set_promo_code('user-a', ' volant ')")).toBe("Auto-école Le Volant");
    }));

  it("refuse un code inconnu ou désactivé", () =>
    withTx(async (db) => {
      await setup(db);
      await expectError(db, "select set_promo_code('user-a', 'INCONNU')", [], "invalid_promo_code");
      await expectError(db, "select set_promo_code('user-a', 'FERME')", [], "invalid_promo_code");
    }));
});

describe("paiement", () => {
  it("calcule la réduction et la commission côté serveur", () =>
    withTx(async (db) => {
      await setup(db);
      await db.query("select set_promo_code('user-a', 'VOLANT')");
      const p = await createPayment(db, "user-a");
      expect({ base: p.base_amount_xof, discount: p.discount_xof, amount: p.amount_xof, commission: p.commission_xof, status: p.status })
        .toEqual({ base: 3000, discount: 300, amount: 2700, commission: 405, status: "pending" });
    }));

  it("applique le plein tarif sans commission sans code promo", () =>
    withTx(async (db) => {
      await setup(db);
      const p = await createPayment(db, "user-b");
      expect({ amount: p.amount_xof, commission: p.commission_xof, school: p.driving_school_id })
        .toEqual({ amount: 3000, commission: 0, school: null });
    }));

  it("crée un seul Pass de 90 jours même si la notification arrive deux fois", () =>
    withTx(async (db) => {
      await setup(db);
      const p = await createPayment(db, "user-a");
      await expectError(db, "select confirm_payment($1, 'REF1', 1000)", [p.id], "amount_mismatch");
      await confirm(db, p.id, "REF1", 3000);
      await confirm(db, p.id, "REF1", 3000);
      expect(await scalar<number>(db, "select count(*)::int from passes where user_id = 'user-a'")).toBe(1);
      expect(await scalar<string>(db, "select (ends_at - starts_at)::text from passes where user_id = 'user-a'")).toBe("90 days");
      expect(await scalar<string>(db, "select status::text from payments where id = $1", [p.id])).toBe("confirmed");
    }));

  it("enchaîne le second Pass à la fin du premier et verrouille le code promo", () =>
    withTx(async (db) => {
      await setup(db);
      await db.query("select set_promo_code('user-a', 'VOLANT')");
      const p1 = await createPayment(db, "user-a");
      await confirm(db, p1.id, "REF1", 2700);
      await expectError(db, "select set_promo_code('user-a', 'VOLANT')", [], "promo_locked");
      const p2 = await createPayment(db, "user-a");
      const pass2 = await confirm(db, p2.id, "REF2", 2700);
      const firstEnd = await scalar<Date>(db, "select ends_at from passes where payment_id = $1", [p1.id]);
      expect(pass2.starts_at.getTime()).toBe(firstEnd.getTime());
    }));

  it("honore une confirmation arrivée après l'échec", () =>
    withTx(async (db) => {
      await setup(db);
      const p = await createPayment(db, "user-b");
      await db.query("select fail_payment($1, 'délai dépassé')", [p.id]);
      expect(await scalar<string>(db, "select status::text from payments where id = $1", [p.id])).toBe("failed");
      await confirm(db, p.id, "REF3", 3000);
      expect(await scalar<string>(db, "select status::text from payments where id = $1", [p.id])).toBe("confirmed");
    }));

  it("expire les paiements en attente depuis plus de 30 minutes", () =>
    withTx(async (db) => {
      await setup(db);
      const old = await createPayment(db, "user-b");
      await createPayment(db, "user-b");
      await db.query("update payments set created_at = now() - interval '31 minutes' where id = $1", [old.id]);
      expect(await scalar<number>(db, "select expire_stale_payments()")).toBe(1);
      expect(await scalar<number>(db, "select count(*)::int from payments where status = 'pending'")).toBe(1);
    }));

  it("conserve les paiements anonymisés quand l'élève supprime son compte", () =>
    withTx(async (db) => {
      await setup(db);
      const p = await createPayment(db, "user-a");
      await confirm(db, p.id, "REF1", 3000);
      await db.query("select delete_account('user-a')");
      expect(await scalar<string | null>(db, "select user_id from payments where id = $1", [p.id])).toBeNull();
      expect(await scalar<number>(db, "select count(*)::int from passes")).toBe(0);
    }));
});

describe("rapport des commissions", () => {
  it("totalise les ventes confirmées du mois par auto-école", () =>
    withTx(async (db) => {
      const { schoolId } = await setup(db);
      await db.query("select set_promo_code('user-a', 'VOLANT')");
      for (const ref of ["REF1", "REF2"]) {
        const p = await createPayment(db, "user-a");
        await confirm(db, p.id, ref, 2700);
      }
      await createPayment(db, "user-a"); // en attente : non compté
      const { rows } = await db.query(
        `select name, sales_count::int, revenue_xof::int, commission_xof::int
         from admin_commission_report((now() at time zone 'Africa/Lome')::date)
         where driving_school_id = $1`,
        [schoolId],
      );
      expect(rows[0]).toEqual({ name: "Auto-école Le Volant", sales_count: 2, revenue_xof: 5400, commission_xof: 810 });
    }));
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npm test -w @drivelearn/db`
Expected: `payments.test.ts` échoue avec `function set_promo_code(unknown, unknown) does not exist`.

- [ ] **Step 3 : Écrire la migration**

`packages/db/migrations/0005_payments.sql` :

```sql
create type payment_status as enum ('pending', 'confirmed', 'failed');

create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id text references profiles (id) on delete set null,
  driving_school_id uuid references driving_schools (id) on delete set null,
  base_amount_xof integer not null check (base_amount_xof >= 0),
  discount_xof integer not null default 0 check (discount_xof >= 0),
  amount_xof integer not null check (amount_xof >= 0),
  commission_xof integer not null default 0 check (commission_xof >= 0),
  status payment_status not null default 'pending',
  gateway_ref text unique,
  failure_reason text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create index payments_user_idx on payments (user_id, created_at desc);
create index payments_school_idx on payments (driving_school_id, confirmed_at);

alter table passes
  add constraint passes_payment_fk foreign key (payment_id) references payments (id) on delete set null;

create function set_promo_code(p_user_id text, p_code text)
returns text
language plpgsql
as $$
declare
  v_school driving_schools;
begin
  if exists (select 1 from payments where user_id = p_user_id and status = 'confirmed') then
    raise exception 'promo_locked';
  end if;
  if nullif(trim(p_code), '') is null then
    update profiles set driving_school_id = null where id = p_user_id;
    return null;
  end if;

  select * into v_school from driving_schools where promo_code = upper(trim(p_code)) and active;
  if not found then
    raise exception 'invalid_promo_code';
  end if;

  update profiles set driving_school_id = v_school.id where id = p_user_id;
  return v_school.name;
end $$;

create function create_payment(p_user_id text)
returns payments
language plpgsql
as $$
declare
  v_school driving_schools;
  v_base integer := setting_int('pass_price_xof');
  v_discount integer := 0;
  v_commission integer := 0;
  v_row payments;
begin
  select s.* into v_school
  from driving_schools s
  join profiles p on p.driving_school_id = s.id
  where p.id = p_user_id and s.active;

  if found then
    v_discount := floor(v_base * v_school.discount_percent / 100.0);
    v_commission := floor((v_base - v_discount) * v_school.commission_percent / 100.0);
  end if;

  insert into payments (user_id, driving_school_id, base_amount_xof, discount_xof, amount_xof, commission_xof)
  values (p_user_id, v_school.id, v_base, v_discount, v_base - v_discount, v_commission)
  returning * into v_row;
  return v_row;
end $$;

create function confirm_payment(p_payment_id uuid, p_gateway_ref text, p_amount_xof integer)
returns passes
language plpgsql
as $$
declare
  v_pay payments;
  v_pass passes;
  v_start timestamptz;
begin
  select * into v_pay from payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment_not_found';
  end if;

  if v_pay.status = 'confirmed' then
    select * into v_pass from passes where payment_id = p_payment_id;
    return v_pass;
  end if;

  if p_amount_xof is distinct from v_pay.amount_xof then
    raise exception 'amount_mismatch';
  end if;

  update payments
  set status = 'confirmed', gateway_ref = p_gateway_ref, confirmed_at = now(), failure_reason = null
  where id = p_payment_id;

  select greatest(now(), coalesce(max(ends_at), now())) into v_start
  from passes where user_id = v_pay.user_id;

  insert into passes (user_id, payment_id, starts_at, ends_at)
  values (v_pay.user_id, p_payment_id, v_start, v_start + make_interval(days => setting_int('pass_duration_days')))
  returning * into v_pass;
  return v_pass;
end $$;

create function fail_payment(p_payment_id uuid, p_reason text)
returns void
language sql
as $$
  update payments set status = 'failed', failure_reason = p_reason
  where id = p_payment_id and status = 'pending';
$$;

create function expire_stale_payments()
returns integer
language plpgsql
as $$
declare
  v_count integer;
begin
  update payments set status = 'failed', failure_reason = 'timeout'
  where status = 'pending' and created_at < now() - interval '30 minutes';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create function admin_commission_report(p_month date)
returns table (driving_school_id uuid, name text, sales_count bigint, revenue_xof bigint, commission_xof bigint)
language sql stable
as $$
  with bounds as (
    select make_timestamptz(extract(year from p_month)::integer, extract(month from p_month)::integer, 1, 0, 0, 0, 'Africa/Lome') as start_at
  )
  select s.id, s.name, count(p.id), coalesce(sum(p.amount_xof), 0)::bigint, coalesce(sum(p.commission_xof), 0)::bigint
  from driving_schools s
  cross join bounds b
  left join payments p
    on p.driving_school_id = s.id
    and p.status = 'confirmed'
    and p.confirmed_at >= b.start_at
    and p.confirmed_at < b.start_at + interval '1 month'
  group by s.id, s.name
  order by s.name;
$$;
```

- [ ] **Step 4 : Lancer les tests**

Run: `npm test -w @drivelearn/db`
Expected: tous les fichiers passent.

- [ ] **Step 5 : Commit**

```bash
git add packages/db/migrations/0005_payments.sql packages/db/test/payments.test.ts
git commit -m "feat(db): paiements, code promo et commissions"
```

---

### Task 7 : Signalements

**Files:**
- Create: `packages/db/migrations/0006_reports.sql`
- Test: `packages/db/test/reports.test.ts`

**Interfaces:**
- Consumes: `questions` (Task 2) ; `profiles` (Task 3)
- Produces:
  - Types `report_reason` (`reponse_incorrecte`, `explication_peu_claire`, `probleme_image`), `report_status` (`nouveau`, `en_cours`, `resolu`)
  - Table `question_reports(id, question_id, user_id, reason, comment, status, admin_note, created_at, updated_at)`
  - `create_report(p_user_id text, p_question_id uuid, p_reason report_reason, p_comment text) returns question_reports`. Erreurs : `unknown_question`, `too_many_reports` (plus de 20 signalements le même jour).

- [ ] **Step 1 : Écrire le test qui échoue**

`packages/db/test/reports.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createPath, createQuestion, createUser, expectError, scalar, withTx, type Db } from "./helpers.js";

async function setup(db: Db) {
  const { unitId, lessonId } = await createPath(db);
  const validated = await createQuestion(db, { unitId, lessonId, status: "validee" });
  const draft = await createQuestion(db, { unitId, lessonId });
  await createUser(db, "user-a");
  return { validated, draft };
}

const REPORT = "select * from create_report($1, $2, $3, $4)";

describe("signalements", () => {
  it("enregistre un signalement au statut « nouveau »", () =>
    withTx(async (db) => {
      const { validated } = await setup(db);
      const { rows } = await db.query(REPORT, ["user-a", validated.id, "explication_peu_claire", "Pas clair"]);
      expect({ status: rows[0].status, reason: rows[0].reason }).toEqual({ status: "nouveau", reason: "explication_peu_claire" });
    }));

  it("refuse une question non publiée", () =>
    withTx(async (db) => {
      const { draft } = await setup(db);
      await expectError(db, REPORT, ["user-a", draft.id, "reponse_incorrecte", null], "unknown_question");
    }));

  it("refuse un commentaire de plus de 500 caractères", () =>
    withTx(async (db) => {
      const { validated } = await setup(db);
      await expectError(db, REPORT, ["user-a", validated.id, "probleme_image", "x".repeat(501)], "question_reports_comment_check");
    }));

  it("limite à 20 signalements par jour", () =>
    withTx(async (db) => {
      const { validated } = await setup(db);
      for (let i = 0; i < 20; i++) await db.query(REPORT, ["user-a", validated.id, "reponse_incorrecte", null]);
      await expectError(db, REPORT, ["user-a", validated.id, "reponse_incorrecte", null], "too_many_reports");
      expect(await scalar<number>(db, "select count(*)::int from question_reports")).toBe(20);
    }));
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npm test -w @drivelearn/db`
Expected: `reports.test.ts` échoue avec `function create_report(unknown, uuid, unknown, unknown) does not exist`.

- [ ] **Step 3 : Écrire la migration**

`packages/db/migrations/0006_reports.sql` :

```sql
create type report_reason as enum ('reponse_incorrecte', 'explication_peu_claire', 'probleme_image');
create type report_status as enum ('nouveau', 'en_cours', 'resolu');

create table question_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions (id) on delete cascade,
  user_id text references profiles (id) on delete set null,
  reason report_reason not null,
  comment text check (char_length(comment) <= 500),
  status report_status not null default 'nouveau',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index question_reports_status_idx on question_reports (status, created_at desc);
create index question_reports_user_idx on question_reports (user_id, created_at);

create function create_report(p_user_id text, p_question_id uuid, p_reason report_reason, p_comment text)
returns question_reports
language plpgsql
as $$
declare
  v_row question_reports;
begin
  if not exists (select 1 from questions where id = p_question_id and status = 'validee') then
    raise exception 'unknown_question';
  end if;
  if (select count(*) from question_reports
      where user_id = p_user_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too_many_reports';
  end if;

  insert into question_reports (question_id, user_id, reason, comment)
  values (p_question_id, p_user_id, p_reason, nullif(trim(p_comment), ''))
  returning * into v_row;
  return v_row;
end $$;
```

- [ ] **Step 4 : Lancer les tests**

Run: `npm test -w @drivelearn/db`
Expected: tous les fichiers passent.

- [ ] **Step 5 : Commit**

```bash
git add packages/db/migrations/0006_reports.sql packages/db/test/reports.test.ts
git commit -m "feat(db): signalements de questions"
```

---

### Task 8 : Progrès et cibles des rappels

**Files:**
- Create: `packages/db/migrations/0007_progress.sql`
- Test: `packages/db/test/progress.test.ts`

**Interfaces:**
- Consumes: `practice_sessions`, `session_answers`, `compute_streak` (Task 4) ; `exam_attempts` (Task 5) ; `profiles`, `lessons`, `units`, `questions`
- Produces:
  - `max_streak(p_user_id text) returns integer` : plus longue série jamais atteinte
  - `get_progress(p_user_id text) returns jsonb` : `{current_streak, practiced_today, total_xp, daily_goal_minutes, today_minutes, week_days: boolean[7] (lundi → dimanche), lessons_completed, lessons_total, themes: [{unit_id, title, answers, correct_rate}], milestones: {first_lesson, streak_3, streak_7, streak_30, first_exam_passed}}`. Erreur : `profile_not_found`.
  - `get_reminder_targets(p_now timestamptz, p_window_minutes integer) returns table (user_id text, push_token text)` : élèves avec rappel activé et jeton push, dont l'heure de rappel tombe dans `[p_now, p_now + fenêtre[` (heure de Lomé, chevauchement de minuit géré), et qui n'ont pas fait de séance ce jour-là.

- [ ] **Step 1 : Écrire le test qui échoue**

`packages/db/test/progress.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { createPath, createQuestion, createUser, expectError, newId, scalar, withTx, type Db } from "./helpers.js";

type Progress = {
  current_streak: number;
  practiced_today: boolean;
  total_xp: number;
  daily_goal_minutes: number;
  today_minutes: number;
  week_days: boolean[];
  lessons_completed: number;
  lessons_total: number;
  themes: Array<{ unit_id: string; title: string; answers: number; correct_rate: number }>;
  milestones: Record<string, boolean>;
};

async function setup(db: Db) {
  const path = await createPath(db);
  const q1 = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, status: "validee" });
  const q2 = await createQuestion(db, { unitId: path.unitId, lessonId: path.lessonId, status: "validee" });
  await createUser(db, "user-a");
  await db.query("update profiles set program_id = $1, daily_goal_minutes = 10 where id = 'user-a'", [path.programId]);
  return { ...path, q1, q2 };
}

const progress = (db: Db, user: string) => scalar<Progress>(db, "select get_progress($1)", [user]);

describe("progrès", () => {
  it("résume la journée, la semaine, les leçons et les thèmes", () =>
    withTx(async (db) => {
      const { lessonId, q1, q2 } = await setup(db);
      await db.query("select submit_session('user-a', $1, 'lecon', $2, null, now(), 240, $3)", [
        newId(),
        lessonId,
        JSON.stringify([
          { question_id: q1.id, choice_ids: q1.correct },
          { question_id: q2.id, choice_ids: q2.wrong },
        ]),
      ]);
      const todayIndex = await scalar<number>(db, "select extract(isodow from now() at time zone 'Africa/Lome')::int - 1");

      const p = await progress(db, "user-a");
      expect(p.current_streak).toBe(1);
      expect(p.practiced_today).toBe(true);
      expect(p.total_xp).toBe(10);
      expect(p.daily_goal_minutes).toBe(10);
      expect(p.today_minutes).toBe(4);
      expect(p.week_days).toHaveLength(7);
      expect(p.week_days[todayIndex]).toBe(true);
      expect(p.week_days.filter(Boolean)).toHaveLength(1);
      expect({ done: p.lessons_completed, total: p.lessons_total }).toEqual({ done: 1, total: 1 });
      expect(p.themes).toHaveLength(1);
      expect({ answers: p.themes[0].answers, rate: p.themes[0].correct_rate }).toEqual({ answers: 2, rate: 50 });
      expect(p.milestones).toEqual({
        first_lesson: true,
        streak_3: false,
        streak_7: false,
        streak_30: false,
        first_exam_passed: false,
      });
    }));

  it("compte le temps des examens dans l'objectif du jour", () =>
    withTx(async (db) => {
      const { programId } = await setup(db);
      await db.query(
        `insert into exam_attempts (user_id, program_id, question_ids, seconds_per_question, pass_mark, expires_at, submitted_at, score, passed, active_seconds)
         values ('user-a', $1, '{}', 30, 13, now(), now(), 15, true, 600)`,
        [programId],
      );
      const p = await progress(db, "user-a");
      expect(p.today_minutes).toBe(10);
      expect(p.milestones.first_exam_passed).toBe(true);
    }));

  it("mesure la plus longue série jamais atteinte", () =>
    withTx(async (db) => {
      const { lessonId } = await setup(db);
      for (const day of ["2026-01-01", "2026-01-02", "2026-01-03", "2026-02-10"]) {
        await db.query(
          `insert into practice_sessions (id, user_id, kind, lesson_id, completed_at, activity_date)
           values (gen_random_uuid(), 'user-a', 'lecon', $1, now(), $2)`,
          [lessonId, day],
        );
      }
      expect(await scalar<number>(db, "select max_streak('user-a')")).toBe(3);
      expect((await progress(db, "user-a")).milestones.streak_3).toBe(true);
    }));

  it("refuse un profil inconnu", () =>
    withTx(async (db) => {
      await expectError(db, "select get_progress('personne')", [], "profile_not_found");
    }));
});

describe("cibles des rappels", () => {
  async function addReminderUser(db: Db, id: string, time: string, enabled = true) {
    await createUser(db, id);
    await db.query(
      "update profiles set reminder_time = $2, reminder_enabled = $3, push_token = $4 where id = $1",
      [id, time, enabled, `token-${id}`],
    );
  }

  const targets = (db: Db, now: string) =>
    db
      .query("select user_id from get_reminder_targets($1::timestamptz, 15) order by user_id", [now])
      .then((r) => r.rows.map((row) => row.user_id as string));

  it("vise les élèves dont l'heure tombe dans la fenêtre et qui n'ont pas pratiqué", () =>
    withTx(async (db) => {
      const { lessonId } = await setup(db);
      await addReminderUser(db, "r-19h00", "19:00");
      await addReminderUser(db, "r-19h10", "19:10");
      await addReminderUser(db, "r-off", "19:00", false);
      await addReminderUser(db, "r-deja", "19:00");
      await db.query(
        `insert into practice_sessions (id, user_id, kind, lesson_id, completed_at, activity_date)
         values (gen_random_uuid(), 'r-deja', 'lecon', $1, '2026-06-10T08:00:00Z', '2026-06-10')`,
        [lessonId],
      );
      expect(await targets(db, "2026-06-10T18:50:00Z")).toEqual(["r-19h00"]);
    }));

  it("gère une fenêtre qui chevauche minuit", () =>
    withTx(async (db) => {
      await setup(db);
      await addReminderUser(db, "r-23h55", "23:55");
      await addReminderUser(db, "r-00h02", "00:02");
      await addReminderUser(db, "r-00h10", "00:10");
      expect(await targets(db, "2026-06-10T23:50:00Z")).toEqual(["r-00h02", "r-23h55"]);
    }));
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npm test -w @drivelearn/db`
Expected: `progress.test.ts` échoue avec `function get_progress(unknown) does not exist`.

- [ ] **Step 3 : Écrire la migration**

`packages/db/migrations/0007_progress.sql` :

```sql
create function max_streak(p_user_id text)
returns integer
language sql stable
as $$
  select coalesce(max(len), 0)::integer
  from (
    select count(*) as len
    from (
      select d, d - (row_number() over (order by d))::integer as grp
      from (select distinct activity_date as d from practice_sessions where user_id = p_user_id) as days
    ) as numbered
    group by grp
  ) as islands;
$$;

create function get_progress(p_user_id text)
returns jsonb
language plpgsql stable
as $$
declare
  v_today date := (now() at time zone 'Africa/Lome')::date;
  v_monday date := date_trunc('week', now() at time zone 'Africa/Lome')::date;
  v_program uuid;
  v_goal integer;
  v_best integer;
begin
  select program_id, daily_goal_minutes into v_program, v_goal from profiles where id = p_user_id;
  if not found then
    raise exception 'profile_not_found';
  end if;
  v_best := max_streak(p_user_id);

  return jsonb_build_object(
    'current_streak', compute_streak(p_user_id, v_today),
    'practiced_today', exists (select 1 from practice_sessions where user_id = p_user_id and activity_date = v_today),
    'total_xp', (select coalesce(sum(xp_earned), 0) from practice_sessions where user_id = p_user_id),
    'daily_goal_minutes', v_goal,
    'today_minutes', (
      (select coalesce(sum(active_seconds), 0) from practice_sessions
        where user_id = p_user_id and activity_date = v_today)
      + (select coalesce(sum(active_seconds), 0) from exam_attempts
        where user_id = p_user_id and submitted_at is not null
          and (submitted_at at time zone 'Africa/Lome')::date = v_today)
    ) / 60,
    'week_days', (
      select jsonb_agg(
        exists (select 1 from practice_sessions where user_id = p_user_id and activity_date = v_monday + i)
        order by i)
      from generate_series(0, 6) as i
    ),
    'lessons_completed', (
      select count(distinct s.lesson_id)
      from practice_sessions s
      join lessons l on l.id = s.lesson_id
      join units u on u.id = l.unit_id
      where s.user_id = p_user_id and s.kind = 'lecon' and u.program_id = v_program
    ),
    'lessons_total', (
      select count(*)
      from lessons l
      join units u on u.id = l.unit_id
      where u.program_id = v_program
        and exists (select 1 from questions q where q.lesson_id = l.id and q.status = 'validee')
    ),
    'themes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'unit_id', u.id,
        'title', u.title,
        'answers', t.answers,
        'correct_rate', t.rate
      ) order by u.position), '[]'::jsonb)
      from units u
      join lateral (
        select count(*) as answers,
               round(100.0 * count(*) filter (where a.is_correct) / nullif(count(*), 0)) as rate
        from session_answers a
        join practice_sessions s on s.id = a.session_id
        join questions q on q.id = a.question_id
        where s.user_id = p_user_id and q.unit_id = u.id
      ) as t on t.answers > 0
      where u.program_id = v_program
    ),
    'milestones', jsonb_build_object(
      'first_lesson', exists (select 1 from practice_sessions where user_id = p_user_id and kind = 'lecon'),
      'streak_3', v_best >= 3,
      'streak_7', v_best >= 7,
      'streak_30', v_best >= 30,
      'first_exam_passed', exists (select 1 from exam_attempts where user_id = p_user_id and passed)
    )
  );
end $$;

create function get_reminder_targets(p_now timestamptz, p_window_minutes integer)
returns table (user_id text, push_token text)
language sql stable
as $$
  with w as (
    select
      (p_now at time zone 'Africa/Lome')::time as t0,
      ((p_now at time zone 'Africa/Lome') + make_interval(mins => p_window_minutes))::time as t1,
      (p_now at time zone 'Africa/Lome')::date as d
  )
  select p.id, p.push_token
  from profiles p
  cross join w
  where p.reminder_enabled
    and p.push_token is not null
    and case
      when w.t0 <= w.t1 then p.reminder_time >= w.t0 and p.reminder_time < w.t1
      else p.reminder_time >= w.t0 or p.reminder_time < w.t1
    end
    and not exists (
      select 1 from practice_sessions s where s.user_id = p.id and s.activity_date = w.d
    );
$$;
```

- [ ] **Step 4 : Lancer toute la suite**

Run: `npm test -w @drivelearn/db` puis `npm run typecheck -w @drivelearn/db`
Expected: les 8 fichiers de test passent, aucune erreur TypeScript.

- [ ] **Step 5 : Commit**

```bash
git add packages/db/migrations/0007_progress.sql packages/db/test/progress.test.ts
git commit -m "feat(db): progrès et cibles des rappels"
```

---

## Suite : les plans suivants

Chacun sera rédigé une fois le précédent terminé :

1. **Plan 2 — API Neon** : création du projet Neon (région aws-eu-central-1, `neon.ts` avec Auth, Functions, Object Storage), application des migrations sur Neon, API Hono sur Neon Functions (vérification des jetons Neon Auth, routes élève, suppression de compte côté Neon Auth), webhook de paiement, Function Triggers (rappels toutes les 15 minutes, expiration des paiements). **Nécessite que vous vous connectiez à Neon.**
2. **Plan 3 — Site d'administration** (Next.js sur Vercel) : programmes, contenus et validation, examens, signalements, auto-écoles, ventes.
3. **Plan 4 — Numérisation du contenu** : extraction des scans, images, import en brouillon. **Nécessite les scans.**
4. **Plan 5 — Application élève : parcours** (Expo) : accueil et comptes, contenu hors ligne, parcours, leçons, révision, progrès, profil.
5. **Plan 6 — Application élève : examens et Pass** : examens blancs, correction, historique, Pass Examen et paiement mobile money, signalements.
6. **Plan 7 — Notifications et publication** : rappels push, mise en production, Play Store.
