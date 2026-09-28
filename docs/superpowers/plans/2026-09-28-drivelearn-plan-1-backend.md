# DriveLearn — Plan 1 : Backend Supabase — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire tout le backend de DriveLearn V1 dans Supabase (schéma, sécurité RLS, et fonctions serveur pour les leçons, la série de jours, le classement, les examens blancs et les paiements), entièrement couvert par des tests pgTAP.

**Architecture:** Toute la logique sensible vit dans PostgreSQL sous forme de fonctions RPC `security definer` appelées par l'application (`supabase.rpc(...)`). Les tables ont la RLS activée ; les élèves lisent leurs propres lignes mais n'écrivent jamais directement dans les tables de résultats, de paiements ou de pass. Les fonctions internes (notation, finalisation, confirmation de paiement) ne sont pas exécutables par les élèves.

**Tech Stack:** Supabase CLI 2.x (local via Docker), PostgreSQL 15+, pgTAP (`supabase test db`), npm (Node 24).

**Spec:** `docs/superpowers/specs/2026-09-27-drivelearn-design.md`

## Global Constraints

- Fuseau horaire de référence pour « jour » et « semaine » : `Africa/Lome` (UTC+0, sans heure d'été). La semaine commence le lundi.
- Examen : 20 questions, admis si note ≥ 13, notation **tout ou rien** (l'ensemble des choix cochés doit être exactement l'ensemble des bonnes réponses). Ces valeurs viennent de la table `settings`, jamais codées en dur dans les fonctions.
- Une question a entre 2 et 8 choix et au moins une bonne réponse pour pouvoir être `validee`.
- Statuts de question : `brouillon`, `a_verifier`, `validee`. Seules les questions `validee` sont visibles des élèves.
- 1 examen blanc gratuit par compte ; ensuite Pass Examen requis. Pass = 90 jours (réglable), paiement unique, prix en FCFA entier (`*_xof`).
- XP : 10 par leçon + 5 pour un sans-faute (réglables).
- Le Pass n'est activé que par `confirm_payment`, exécutable uniquement par `service_role`.
- Toutes les fonctions `security definer` déclarent `set search_path = ''` et qualifient les objets par `public.`.
- Les erreurs métier sont levées avec un code court en snake_case (`raise exception 'pass_required'`) ; l'application les traduit en français.
- Réduction et commission : arrondies à l'entier inférieur (`floor`).

## Review Focus

1. **Résultat de leçon renvoyé deux fois** (synchronisation hors ligne relancée après une coupure réseau) → une seule tentative, pas de double XP. Testé dans la Task 4.
2. **Notification de paiement reçue deux fois, ou confirmation arrivée après expiration du paiement** → un seul Pass, et un paiement réellement débité est quand même honoré. Testé dans la Task 7.
3. **Réponse à choix multiples avec des doublons, un choix d'une autre question, ou aucune case cochée** → comptée fausse (sauf les doublons, ignorés). Testé dans la Task 4.
4. **Examen abandonné (application tuée, connexion perdue)** → l'examen est repris s'il n'est pas expiré, sinon noté avec les réponses reçues. L'examen gratuit n'est pas consommé deux fois par un double appui. Testé dans la Task 6.
5. **Admin qui retire la dernière bonne réponse d'une question déjà validée** → refusé. Testé dans la Task 2.

---

## Structure des fichiers

```
drivelearn/
  package.json                       # scripts db:* et dépendance CLI supabase
  .gitignore
  supabase/
    config.toml                      # généré par `supabase init`, auth SMS activée
    migrations/
      20260928000100_content.sql     # admins, settings, unités/leçons/questions/choix, version du contenu, stockage images
      20260928000200_profiles.sql    # profils élèves, auto-écoles, display_name
      20260928000300_lessons.sql     # tentatives de leçon, maîtrise, submit_lesson, série de jours, stats
      20260928000400_leaderboard.sql # classement hebdomadaire
      20260928000500_exams.sql       # pass, examens blancs, tirage, notation, statut examen
      20260928000600_payments.sql    # paiements, code promo, confirmation, rapport des commissions
    tests/
      000_smoke.test.sql
      010_content.test.sql
      020_profiles.test.sql
      030_lessons.test.sql
      040_leaderboard.test.sql
      050_exams.test.sql
      060_payments.test.sql
```

Chaque fichier de test est autonome : il crée ses propres données, et tout est annulé par le `rollback` final.

**Préambule commun des tests.** Chaque fichier de test (sauf `000_smoke`) commence par ce bloc, recopié tel quel :

```sql
begin;
create extension if not exists pgtap with schema extensions;
select * from no_plan();

create function pg_temp.new_user(p_id uuid, p_phone text) returns uuid
language sql as $$
  insert into auth.users (id, aud, role, phone)
  values (p_id, 'authenticated', 'authenticated', p_phone)
  returning id;
$$;

create function pg_temp.claims(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end $$;
```

Pour agir en tant qu'élève : `select pg_temp.claims('<uuid>'); set local role authenticated;` … puis `reset role;` pour redevenir `postgres`. Pour agir en tant que serveur : `set local role service_role;`. Pour passer une valeur d'un rôle à l'autre : `select set_config('test.x', '<valeur>', true);` puis `current_setting('test.x')`.

Chaque fichier se termine par :

```sql
select * from finish();
rollback;
```

**Identifiants fixes utilisés dans les tests :**
- Unités : `a0000000-0000-0000-0000-00000000000N`
- Leçons : `b0000000-0000-0000-0000-00000000000N`
- Questions : `c0000000-0000-0000-0000-00000000000N`
- Choix : `d0000000-0000-0000-0000-0000000000QN` (Q = numéro de question, N = numéro du choix)
- Utilisateurs : `e0000000-0000-0000-0000-00000000000N`
- Auto-écoles : `f0000000-0000-0000-0000-00000000000N`

---

### Task 1 : Initialisation du projet Supabase

**Files:**
- Create: `package.json`, `.gitignore`
- Create (via CLI): `supabase/config.toml`
- Test: `supabase/tests/000_smoke.test.sql`

**Interfaces:**
- Consumes: rien
- Produces: les scripts `npm run db:start`, `npm run db:reset` et `npm run db:test`, utilisés par toutes les tâches suivantes.

- [ ] **Step 1 : Créer `package.json`**

```json
{
  "name": "drivelearn",
  "private": true,
  "scripts": {
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:test": "supabase test db"
  },
  "devDependencies": {
    "supabase": "^2.101.0"
  }
}
```

- [ ] **Step 2 : Créer `.gitignore`**

```
node_modules/
.env
.env.*
supabase/.temp/
supabase/.branches/
```

- [ ] **Step 3 : Installer la CLI et initialiser Supabase**

Run: `npm install` puis `npx supabase init` (répondre non aux questions sur VS Code et Deno).
Expected: le dossier `supabase/` est créé, avec `config.toml`.

- [ ] **Step 4 : Activer l'authentification par SMS en local**

Dans `supabase/config.toml`, section `[auth.sms]`, mettre `enable_signup = true` et `enable_confirmations = true`. Ajouter juste en dessous (le fichier contient déjà cette section en commentaire, la décommenter) :

```toml
[auth.sms.test_otp]
22890000001 = "123456"
22890000002 = "123456"
```

Ces numéros de test permettent de se connecter en local sans vrai SMS (code `123456`).

- [ ] **Step 5 : Écrire le test de fumée**

`supabase/tests/000_smoke.test.sql` :

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);
select ok(true, 'pgTAP fonctionne');
select * from finish();
rollback;
```

- [ ] **Step 6 : Démarrer Supabase et lancer les tests**

Run: `npm run db:start` (Docker doit tourner ; le premier démarrage télécharge les images), puis `npm run db:test`.
Expected: `000_smoke.test.sql .. ok` et `All tests successful.`

- [ ] **Step 7 : Commit**

```bash
git add package.json package-lock.json .gitignore supabase/
git commit -m "chore: initialise le projet Supabase"
```

---

### Task 2 : Contenu, réglages et administrateurs

**Files:**
- Create: `supabase/migrations/20260928000100_content.sql`
- Test: `supabase/tests/010_content.test.sql`

**Interfaces:**
- Consumes: rien
- Produces:
  - Tables : `admins(user_id)`, `settings(key text, value jsonb)`, `units(id, title, position)`, `lessons(id, unit_id, position, title)`, `questions(id, unit_id, lesson_id, position, prompt, image_path, explanation, status, source_page, updated_at)`, `choices(id, question_id, label, is_correct, position)`, `content_version(id, version)`
  - Type : `question_status` (`brouillon`, `a_verifier`, `validee`)
  - Fonctions : `is_admin() returns boolean`, `setting_int(p_key text) returns integer`
  - Bucket de stockage public `question-images`

- [ ] **Step 1 : Écrire le test qui échoue**

`supabase/tests/010_content.test.sql` : le préambule commun, puis :

```sql
-- Données
insert into public.units (id, title, position) values
  ('a0000000-0000-0000-0000-000000000001', 'Panneaux de danger', 1);
insert into public.lessons (id, unit_id, position) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 1);
insert into public.questions (id, unit_id, lesson_id, prompt, status) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Que signifie ce panneau ?', 'validee'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Question en brouillon', 'brouillon');
insert into public.choices (id, question_id, label, is_correct, position) values
  ('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000001', 'Virage dangereux', true, 1),
  ('d0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000001', 'Stop', false, 2),
  ('d0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000001', 'Céder le passage', false, 3),
  ('d0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000002', 'A', true, 1),
  ('d0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000002', 'B', false, 2);

select pg_temp.new_user('e0000000-0000-0000-0000-000000000001', '22890000001');
select pg_temp.new_user('e0000000-0000-0000-0000-000000000002', '22890000002');
insert into public.admins (user_id) values ('e0000000-0000-0000-0000-000000000002');

-- Réglages par défaut
select is(public.setting_int('exam_question_count'), 20, '20 questions par examen par défaut');
select is(public.setting_int('exam_pass_mark'), 13, 'seuil de réussite 13 par défaut');
select is(public.setting_int('pass_duration_days'), 90, 'pass de 90 jours par défaut');
select ok((select version from public.content_version) > 1, 'la version du contenu augmente quand le contenu change');

-- Élève
select pg_temp.claims('e0000000-0000-0000-0000-000000000001');
set local role authenticated;
select is(public.is_admin(), false, 'un élève n''est pas admin');
select is((select count(*)::int from public.questions), 1, 'un élève ne voit que les questions validées');
select is((select count(*)::int from public.choices), 3, 'un élève ne voit que les choix des questions validées');
select throws_ok($$ insert into public.units (title, position) values ('X', 9) $$, '42501', null, 'un élève ne peut pas créer de contenu');
select is((select count(*)::int from public.settings), 10, 'un élève peut lire les réglages');
reset role;

-- Admin
select pg_temp.claims('e0000000-0000-0000-0000-000000000002');
set local role authenticated;
select is(public.is_admin(), true, 'l''admin est reconnu');
select is((select count(*)::int from public.questions), 2, 'l''admin voit toutes les questions');
update public.questions set prompt = 'Modifié' where id = 'c0000000-0000-0000-0000-000000000002';
select is((select prompt from public.questions where id = 'c0000000-0000-0000-0000-000000000002'), 'Modifié', 'l''admin modifie une question');
reset role;

-- Validation des questions (contraintes différées rendues immédiates pour le test)
insert into public.questions (id, unit_id, lesson_id, prompt) values
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Sans bonne réponse'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', null, 'Sans leçon');
insert into public.choices (question_id, label, is_correct, position) values
  ('c0000000-0000-0000-0000-000000000003', 'A', false, 1),
  ('c0000000-0000-0000-0000-000000000003', 'B', false, 2),
  ('c0000000-0000-0000-0000-000000000004', 'A', true, 1),
  ('c0000000-0000-0000-0000-000000000004', 'B', false, 2);
set constraints all immediate;

select throws_ok($$ update public.questions set status = 'validee' where id = 'c0000000-0000-0000-0000-000000000003' $$,
  'P0001', 'question_invalide: aucune bonne réponse', 'impossible de valider une question sans bonne réponse');
select throws_ok($$ update public.questions set status = 'validee' where id = 'c0000000-0000-0000-0000-000000000004' $$,
  'P0001', 'question_invalide: aucune leçon', 'impossible de valider une question sans leçon');
select throws_ok($$ insert into public.questions (unit_id, lesson_id, prompt, status) values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Sans choix', 'validee') $$,
  'P0001', 'question_invalide: il faut entre 2 et 8 choix', 'impossible de valider une question sans choix');
select throws_ok($$ delete from public.choices where id = 'd0000000-0000-0000-0000-000000000011' $$,
  'P0001', 'question_invalide: aucune bonne réponse', 'impossible de retirer la dernière bonne réponse d''une question validée');
```

Puis la fin commune (`finish` + `rollback`).

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npm run db:test`
Expected: `010_content.test.sql` échoue avec `relation "public.units" does not exist`.

- [ ] **Step 3 : Écrire la migration**

`supabase/migrations/20260928000100_content.sql` :

```sql
-- Administrateurs ---------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create policy admins_read_self on public.admins
  for select to authenticated using (user_id = auth.uid());

-- Réglages -----------------------------------------------------------------
create table public.settings (
  key text primary key,
  value jsonb not null
);
alter table public.settings enable row level security;

create policy settings_read on public.settings
  for select to authenticated using (true);
create policy settings_admin_write on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.settings (key, value) values
  ('exam_question_count', '20'),
  ('exam_pass_mark', '13'),
  ('exam_seconds_per_question', '30'),
  ('exam_unit_weights', '{}'),
  ('ready_after_consecutive_passes', '3'),
  ('pass_price_xof', '3000'),
  ('pass_duration_days', '90'),
  ('xp_per_lesson', '10'),
  ('xp_perfect_bonus', '5'),
  ('lesson_size', '8');

create function public.setting_int(p_key text)
returns integer
language sql stable security definer set search_path = ''
as $$
  select (value #>> '{}')::integer from public.settings where key = p_key;
$$;

-- Contenu ------------------------------------------------------------------
create type public.question_status as enum ('brouillon', 'a_verifier', 'validee');

create table public.units (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  position integer not null
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  position integer not null,
  title text
);
create index lessons_unit_idx on public.lessons (unit_id, position);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  position integer not null default 0,
  prompt text not null,
  image_path text,
  explanation text,
  status public.question_status not null default 'brouillon',
  source_page text,
  updated_at timestamptz not null default now()
);
create index questions_lesson_idx on public.questions (lesson_id, position);
create index questions_unit_status_idx on public.questions (unit_id, status);

create table public.choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  label text not null,
  is_correct boolean not null default false,
  position integer not null default 0
);
create index choices_question_idx on public.choices (question_id, position);

-- Une question validée doit rester cohérente (vérifié en fin de transaction)
create function public.check_question_valid()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_qid uuid;
  v_q public.questions;
  v_choices integer;
  v_correct integer;
begin
  if tg_table_name = 'questions' then
    v_qid := new.id;
  elsif tg_op = 'DELETE' then
    v_qid := old.question_id;
  else
    v_qid := new.question_id;
  end if;

  select * into v_q from public.questions where id = v_qid;
  if not found or v_q.status <> 'validee' then
    return null;
  end if;

  select count(*), count(*) filter (where is_correct)
    into v_choices, v_correct
    from public.choices where question_id = v_qid;

  if v_choices < 2 or v_choices > 8 then
    raise exception 'question_invalide: il faut entre 2 et 8 choix';
  end if;
  if v_correct < 1 then
    raise exception 'question_invalide: aucune bonne réponse';
  end if;
  if v_q.lesson_id is null then
    raise exception 'question_invalide: aucune leçon';
  end if;
  if not exists (select 1 from public.lessons where id = v_q.lesson_id and unit_id = v_q.unit_id) then
    raise exception 'question_invalide: leçon hors unité';
  end if;
  return null;
end $$;

create constraint trigger questions_valid
  after insert or update on public.questions
  deferrable initially deferred
  for each row execute function public.check_question_valid();

create constraint trigger choices_valid
  after insert or update or delete on public.choices
  deferrable initially deferred
  for each row execute function public.check_question_valid();

-- Version du contenu (l'application la compare pour savoir quoi re-télécharger)
create table public.content_version (
  id boolean primary key default true check (id),
  version bigint not null default 1
);
insert into public.content_version default values;
alter table public.content_version enable row level security;
create policy content_version_read on public.content_version
  for select to authenticated using (true);

create function public.bump_content_version()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.content_version set version = version + 1;
  return null;
end $$;

create trigger units_bump after insert or update or delete on public.units
  for each statement execute function public.bump_content_version();
create trigger lessons_bump after insert or update or delete on public.lessons
  for each statement execute function public.bump_content_version();
create trigger questions_bump after insert or update or delete on public.questions
  for each statement execute function public.bump_content_version();
create trigger choices_bump after insert or update or delete on public.choices
  for each statement execute function public.bump_content_version();

-- RLS du contenu -------------------------------------------------------------
alter table public.units enable row level security;
alter table public.lessons enable row level security;
alter table public.questions enable row level security;
alter table public.choices enable row level security;

create policy units_read on public.units for select to authenticated using (true);
create policy units_admin on public.units for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy lessons_read on public.lessons for select to authenticated using (true);
create policy lessons_admin on public.lessons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy questions_read on public.questions for select to authenticated
  using (status = 'validee' or public.is_admin());
create policy questions_admin on public.questions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy choices_read on public.choices for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.questions q where q.id = question_id and q.status = 'validee')
  );
create policy choices_admin on public.choices for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Images des questions (lecture publique, écriture admin) ----------------------
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true);

create policy question_images_admin on storage.objects for all to authenticated
  using (bucket_id = 'question-images' and public.is_admin())
  with check (bucket_id = 'question-images' and public.is_admin());
```

- [ ] **Step 4 : Appliquer et lancer les tests**

Run: `npm run db:reset` puis `npm run db:test`
Expected: `010_content.test.sql .. ok`, `All tests successful.`

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/20260928000100_content.sql supabase/tests/010_content.test.sql
git commit -m "feat(db): contenu, réglages et administrateurs"
```

---

### Task 3 : Profils élèves et auto-écoles

**Files:**
- Create: `supabase/migrations/20260928000200_profiles.sql`
- Test: `supabase/tests/020_profiles.test.sql`

**Interfaces:**
- Consumes: `is_admin()` (Task 2)
- Produces:
  - Tables : `driving_schools(id, name, promo_code, discount_percent, commission_percent, active, created_at)`, `profiles(id, phone, first_name, last_name, pseudo, driving_school_id, push_token, created_at)`
  - Fonction : `display_name(p public.profiles) returns text`
  - Trigger : un profil est créé automatiquement pour chaque nouvel `auth.users`
  - L'élève peut modifier seulement `first_name`, `last_name`, `pseudo` et `push_token` de son propre profil.

- [ ] **Step 1 : Écrire le test qui échoue**

`supabase/tests/020_profiles.test.sql` : le préambule commun, puis :

```sql
select pg_temp.new_user('e0000000-0000-0000-0000-000000000001', '22890000001');
select pg_temp.new_user('e0000000-0000-0000-0000-000000000002', '22890000002');
insert into public.driving_schools (id, name, promo_code) values
  ('f0000000-0000-0000-0000-000000000001', 'Auto-école Le Volant', 'VOLANT');

select is((select phone from public.profiles where id = 'e0000000-0000-0000-0000-000000000001'),
  '22890000001', 'le profil est créé à l''inscription avec le téléphone');
select is((select discount_percent from public.driving_schools), 10, 'réduction par défaut de 10 %');

select pg_temp.claims('e0000000-0000-0000-0000-000000000001');
set local role authenticated;
select is((select count(*)::int from public.profiles), 1, 'un élève ne voit que son propre profil');
update public.profiles set pseudo = 'Koffi228', first_name = 'Koffi', last_name = 'Mensah'
  where id = 'e0000000-0000-0000-0000-000000000001';
select is((select pseudo from public.profiles where id = 'e0000000-0000-0000-0000-000000000001'),
  'Koffi228', 'l''élève modifie son pseudo');
select throws_ok($$ update public.profiles set driving_school_id = 'f0000000-0000-0000-0000-000000000001' where id = 'e0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'l''élève ne peut pas s''attribuer une auto-école directement');
select is((select count(*)::int from public.driving_schools), 0, 'les auto-écoles ne sont pas lisibles par les élèves');
reset role;

-- Nom affiché
select is((select public.display_name(p) from public.profiles p where id = 'e0000000-0000-0000-0000-000000000001'),
  'Koffi228', 'le pseudo est prioritaire');
update public.profiles set pseudo = null where id = 'e0000000-0000-0000-0000-000000000001';
select is((select public.display_name(p) from public.profiles p where id = 'e0000000-0000-0000-0000-000000000001'),
  'Koffi M.', 'sinon prénom + initiale du nom');
update public.profiles set first_name = null where id = 'e0000000-0000-0000-0000-000000000001';
select is((select public.display_name(p) from public.profiles p where id = 'e0000000-0000-0000-0000-000000000001'),
  'Élève', 'repli si aucun nom');
select throws_ok($$ update public.profiles set pseudo = 'X' where id = 'e0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'pseudo trop court refusé');
```

Puis la fin commune.

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npm run db:test`
Expected: `020_profiles.test.sql` échoue (`relation "public.driving_schools" does not exist`).

- [ ] **Step 3 : Écrire la migration**

`supabase/migrations/20260928000200_profiles.sql` :

```sql
create table public.driving_schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  promo_code text not null unique check (promo_code = upper(promo_code) and char_length(promo_code) between 3 and 20),
  discount_percent integer not null default 10 check (discount_percent between 0 and 100),
  commission_percent integer not null default 10 check (commission_percent between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.driving_schools enable row level security;
create policy driving_schools_admin on public.driving_schools for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text,
  first_name text,
  last_name text,
  pseudo text check (char_length(pseudo) between 2 and 20),
  driving_school_id uuid references public.driving_schools (id) on delete set null,
  push_token text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (first_name, last_name, pseudo, push_token) on public.profiles to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, phone) values (new.id, new.phone);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.display_name(p public.profiles)
returns text
language sql immutable
as $$
  select coalesce(
    nullif(trim(p.pseudo), ''),
    case when nullif(trim(p.first_name), '') is not null then
      trim(p.first_name) || coalesce(' ' || upper(left(nullif(trim(p.last_name), ''), 1)) || '.', '')
    end,
    'Élève'
  );
$$;
```

- [ ] **Step 4 : Appliquer et lancer les tests**

Run: `npm run db:reset` puis `npm run db:test`
Expected: tous les fichiers `ok`.

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/20260928000200_profiles.sql supabase/tests/020_profiles.test.sql
git commit -m "feat(db): profils élèves et auto-écoles"
```

---

### Task 4 : Leçons, révision des erreurs et série de jours

**Files:**
- Create: `supabase/migrations/20260928000300_lessons.sql`
- Test: `supabase/tests/030_lessons.test.sql`

**Interfaces:**
- Consumes: `setting_int`, `questions`, `choices`, `lessons` (Task 2) ; `profiles` (Task 3)
- Produces:
  - Tables : `lesson_attempts(id, user_id, lesson_id, completed_at, activity_date, received_at, correct_count, question_count, xp_earned)`, `lesson_answers(attempt_id, question_id, choice_ids, is_correct)`, `question_mastery(user_id, question_id, consecutive_correct, needs_review, updated_at)`
  - `is_answer_correct(p_question_id uuid, p_choice_ids uuid[]) returns boolean` (interne, non exposée aux élèves)
  - `submit_lesson(p_attempt_id uuid, p_lesson_id uuid, p_completed_at timestamptz, p_answers jsonb) returns public.lesson_attempts`. `p_answers` = `[{"question_id": "<uuid>", "choice_ids": ["<uuid>", ...]}, ...]`. `p_attempt_id` est généré par l'application (idempotence).
  - `compute_streak(p_user_id uuid, p_today date) returns integer` (interne)
  - `get_my_stats() returns jsonb` → `{current_streak, practiced_today, total_xp, weekly_xp}`
  - Les questions à réviser sont les lignes `question_mastery` de l'élève avec `needs_review = true` (lecture directe par l'application).

- [ ] **Step 1 : Écrire le test qui échoue**

`supabase/tests/030_lessons.test.sql` : le préambule commun, puis :

```sql
insert into public.units (id, title, position) values ('a0000000-0000-0000-0000-000000000001', 'Priorités', 1);
insert into public.lessons (id, unit_id, position) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 1);
insert into public.questions (id, unit_id, lesson_id, prompt, status) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Une seule bonne réponse', 'validee'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Deux bonnes réponses', 'validee'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Brouillon', 'brouillon');
insert into public.choices (id, question_id, label, is_correct, position) values
  ('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000001', 'Oui', true, 1),
  ('d0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000001', 'Non', false, 2),
  ('d0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000002', 'A', true, 1),
  ('d0000000-0000-0000-0000-000000000022', 'c0000000-0000-0000-0000-000000000002', 'B', true, 2),
  ('d0000000-0000-0000-0000-000000000023', 'c0000000-0000-0000-0000-000000000002', 'C', false, 3),
  ('d0000000-0000-0000-0000-000000000031', 'c0000000-0000-0000-0000-000000000003', 'A', true, 1),
  ('d0000000-0000-0000-0000-000000000032', 'c0000000-0000-0000-0000-000000000003', 'B', false, 2);
select pg_temp.new_user('e0000000-0000-0000-0000-000000000001', '22890000001');
select pg_temp.new_user('e0000000-0000-0000-0000-000000000002', '22890000002');

-- Notation tout ou rien
select is(public.is_answer_correct('c0000000-0000-0000-0000-000000000002', array['d0000000-0000-0000-0000-000000000021','d0000000-0000-0000-0000-000000000022']::uuid[]), true, 'toutes les bonnes réponses = juste');
select is(public.is_answer_correct('c0000000-0000-0000-0000-000000000002', array['d0000000-0000-0000-0000-000000000022','d0000000-0000-0000-0000-000000000021']::uuid[]), true, 'l''ordre ne compte pas');
select is(public.is_answer_correct('c0000000-0000-0000-0000-000000000002', array['d0000000-0000-0000-0000-000000000021']::uuid[]), false, 'réponse incomplète = faux');
select is(public.is_answer_correct('c0000000-0000-0000-0000-000000000002', array['d0000000-0000-0000-0000-000000000021','d0000000-0000-0000-0000-000000000022','d0000000-0000-0000-0000-000000000023']::uuid[]), false, 'une mauvaise case en plus = faux');
select is(public.is_answer_correct('c0000000-0000-0000-0000-000000000002', '{}'::uuid[]), false, 'aucune case cochée = faux');
select is(public.is_answer_correct('c0000000-0000-0000-0000-000000000002', array['d0000000-0000-0000-0000-000000000021','d0000000-0000-0000-0000-000000000021','d0000000-0000-0000-0000-000000000022']::uuid[]), true, 'les doublons sont ignorés');
select is(public.is_answer_correct('c0000000-0000-0000-0000-000000000001', array['d0000000-0000-0000-0000-000000000011','d0000000-0000-0000-0000-000000000021']::uuid[]), false, 'un choix d''une autre question = faux');

-- Série de jours (dates fixes)
insert into public.lesson_attempts (id, user_id, lesson_id, completed_at, activity_date, correct_count, question_count, xp_earned) values
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', now(), date '2026-06-10', 1, 1, 10),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', now(), date '2026-06-09', 1, 1, 10),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', now(), date '2026-06-08', 1, 1, 10),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', now(), date '2026-06-06', 1, 1, 10);
select is(public.compute_streak('e0000000-0000-0000-0000-000000000002', date '2026-06-10'), 3, 'série de 3 jours consécutifs');
select is(public.compute_streak('e0000000-0000-0000-0000-000000000002', date '2026-06-11'), 3, 'pas encore révisé aujourd''hui : la série d''hier tient encore');
select is(public.compute_streak('e0000000-0000-0000-0000-000000000002', date '2026-06-12'), 0, 'un jour manqué : série à zéro');
select is(public.compute_streak('e0000000-0000-0000-0000-000000000002', date '2026-06-07'), 1, 'série d''un jour');

-- Envoi de leçons par l'élève A
select pg_temp.claims('e0000000-0000-0000-0000-000000000001');
set local role authenticated;

select throws_ok($$ select public.compute_streak('e0000000-0000-0000-0000-000000000001', current_date) $$, '42501', null, 'compute_streak n''est pas exposée');
select throws_ok($$ select public.is_answer_correct('c0000000-0000-0000-0000-000000000001', '{}'::uuid[]) $$, '42501', null, 'is_answer_correct n''est pas exposée');

select lives_ok($$ select public.submit_lesson('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', now(),
  '[{"question_id":"c0000000-0000-0000-0000-000000000001","choice_ids":["d0000000-0000-0000-0000-000000000011"]},
    {"question_id":"c0000000-0000-0000-0000-000000000002","choice_ids":["d0000000-0000-0000-0000-000000000021"]}]') $$, 'envoi d''une leçon');
select results_eq($$ select correct_count, question_count, xp_earned from public.lesson_attempts where id = '10000000-0000-0000-0000-000000000001' $$,
  $$ values (1, 2, 10) $$, '1 bonne réponse sur 2, 10 XP');
select lives_ok($$ select public.submit_lesson('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', now(),
  '[{"question_id":"c0000000-0000-0000-0000-000000000001","choice_ids":["d0000000-0000-0000-0000-000000000011"]}]') $$, 'renvoi de la même tentative accepté');
select is((select count(*)::int from public.lesson_attempts), 1, 'renvoi : pas de doublon ni de double XP');
select results_eq($$ select question_id, consecutive_correct, needs_review from public.question_mastery order by question_id $$,
  $$ values ('c0000000-0000-0000-0000-000000000001'::uuid, 1, false), ('c0000000-0000-0000-0000-000000000002'::uuid, 0, true) $$,
  'la question ratée est marquée à réviser');

select lives_ok($$ select public.submit_lesson('10000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', now(),
  '[{"question_id":"c0000000-0000-0000-0000-000000000001","choice_ids":["d0000000-0000-0000-0000-000000000011"]},
    {"question_id":"c0000000-0000-0000-0000-000000000002","choice_ids":["d0000000-0000-0000-0000-000000000021","d0000000-0000-0000-0000-000000000022"]}]') $$, 'leçon sans faute');
select is((select xp_earned from public.lesson_attempts where id = '10000000-0000-0000-0000-000000000002'), 15, 'sans-faute : 10 + 5 XP');
select results_eq($$ select consecutive_correct, needs_review from public.question_mastery where question_id = 'c0000000-0000-0000-0000-000000000002' $$,
  $$ values (1, true) $$, 'une seule réussite : toujours à réviser');

select lives_ok($$ select public.submit_lesson('10000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', now(),
  '[{"question_id":"c0000000-0000-0000-0000-000000000002","choice_ids":["d0000000-0000-0000-0000-000000000021","d0000000-0000-0000-0000-000000000022"]}]') $$, 'deuxième réussite');
select results_eq($$ select consecutive_correct, needs_review from public.question_mastery where question_id = 'c0000000-0000-0000-0000-000000000002' $$,
  $$ values (2, false) $$, 'deux réussites consécutives : la question sort de la révision');

select lives_ok($$ select public.submit_lesson('10000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', now(),
  '[{"question_id":"c0000000-0000-0000-0000-000000000001","choice_ids":["d0000000-0000-0000-0000-000000000011"]},
    {"question_id":"c0000000-0000-0000-0000-000000000001","choice_ids":["d0000000-0000-0000-0000-000000000012"]}]') $$, 'question en double dans une leçon');
select is((select question_count from public.lesson_attempts where id = '10000000-0000-0000-0000-000000000004'), 1, 'une question en double ne compte qu''une fois');

select lives_ok($$ select public.submit_lesson('10000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000001', now() + interval '2 days',
  '[{"question_id":"c0000000-0000-0000-0000-000000000001","choice_ids":["d0000000-0000-0000-0000-000000000011"]}]') $$, 'date dans le futur');
select is((select activity_date from public.lesson_attempts where id = '10000000-0000-0000-0000-000000000005'),
  (now() at time zone 'Africa/Lome')::date, 'une date future est ramenée à aujourd''hui');

select throws_ok($$ select public.submit_lesson('10000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000001', now(),
  '[{"question_id":"c0000000-0000-0000-0000-000000000003","choice_ids":["d0000000-0000-0000-0000-000000000031"]}]') $$,
  'P0001', 'unknown_question', 'une question en brouillon est refusée');
select throws_ok($$ select public.submit_lesson('10000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000001', now(), '[]') $$,
  'P0001', 'invalid_answers', 'une leçon vide est refusée');
select throws_ok($$ insert into public.lesson_attempts (id, user_id, lesson_id, completed_at, activity_date, correct_count, question_count, xp_earned)
  values (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', now(), current_date, 99, 99, 9999) $$,
  '42501', null, 'insertion directe de résultat interdite');

select is((public.get_my_stats() ->> 'practiced_today')::boolean, true, 'stats : révisé aujourd''hui');
select is((public.get_my_stats() ->> 'current_streak')::int, 1, 'stats : série d''un jour');
select is((public.get_my_stats() ->> 'total_xp')::int, 70, 'stats : total des XP (10 + 15 + 15 + 15 + 15)');
reset role;

-- Un autre élève ne peut pas réutiliser l'identifiant de tentative
select pg_temp.claims('e0000000-0000-0000-0000-000000000002');
set local role authenticated;
select throws_ok($$ select public.submit_lesson('10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', now(),
  '[{"question_id":"c0000000-0000-0000-0000-000000000001","choice_ids":["d0000000-0000-0000-0000-000000000011"]}]') $$,
  'P0001', 'attempt_conflict', 'identifiant de tentative d''un autre élève refusé');
select is((select count(*)::int from public.lesson_attempts), 4, 'un élève ne voit que ses tentatives');
reset role;
```

Détail des 70 XP de A : tentative 1 = 10 (1/2) ; tentative 2 = 15 (sans faute) ; tentative 3 = 15 (1/1) ; tentative 4 = 15 (la seconde occurrence de la question est ignorée, la première est juste) ; tentative 5 = 15 (1/1). Les tentatives 6 et 7 sont refusées et annulées.

Puis la fin commune.

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npm run db:test`
Expected: `030_lessons.test.sql` échoue (`function public.is_answer_correct(...) does not exist`).

- [ ] **Step 3 : Écrire la migration**

`supabase/migrations/20260928000300_lessons.sql` :

```sql
create table public.lesson_attempts (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  completed_at timestamptz not null,
  activity_date date not null,
  received_at timestamptz not null default now(),
  correct_count integer not null,
  question_count integer not null,
  xp_earned integer not null
);
create index lesson_attempts_user_day_idx on public.lesson_attempts (user_id, activity_date);
create index lesson_attempts_received_idx on public.lesson_attempts (received_at);

create table public.lesson_answers (
  attempt_id uuid not null references public.lesson_attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  choice_ids uuid[] not null,
  is_correct boolean not null,
  primary key (attempt_id, question_id)
);

create table public.question_mastery (
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  consecutive_correct integer not null default 0,
  needs_review boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

alter table public.lesson_attempts enable row level security;
alter table public.lesson_answers enable row level security;
alter table public.question_mastery enable row level security;

create policy lesson_attempts_read on public.lesson_attempts for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy lesson_answers_read on public.lesson_answers for select to authenticated
  using (exists (select 1 from public.lesson_attempts a where a.id = attempt_id and a.user_id = auth.uid()));
create policy question_mastery_read on public.question_mastery for select to authenticated
  using (user_id = auth.uid());

-- Notation tout ou rien
create function public.is_answer_correct(p_question_id uuid, p_choice_ids uuid[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select array_agg(id order by id) from public.choices where question_id = p_question_id and is_correct)
    = (select array_agg(distinct c order by c) from unnest(p_choice_ids) as c),
    false
  );
$$;
revoke execute on function public.is_answer_correct(uuid, uuid[]) from public, anon, authenticated;

-- Enregistrement d'une leçon (idempotent)
create function public.submit_lesson(
  p_attempt_id uuid,
  p_lesson_id uuid,
  p_completed_at timestamptz,
  p_answers jsonb
)
returns public.lesson_attempts
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.lesson_attempts;
  v_completed timestamptz;
  v_answer jsonb;
  v_qid uuid;
  v_choices uuid[];
  v_ok boolean;
  v_total integer := 0;
  v_correct integer := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_row from public.lesson_attempts where id = p_attempt_id;
  if found then
    if v_row.user_id <> v_uid then
      raise exception 'attempt_conflict';
    end if;
    return v_row;
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) = 0 then
    raise exception 'invalid_answers';
  end if;

  v_completed := least(coalesce(p_completed_at, now()), now());
  insert into public.lesson_attempts
    (id, user_id, lesson_id, completed_at, activity_date, correct_count, question_count, xp_earned)
  values
    (p_attempt_id, v_uid, p_lesson_id, v_completed, (v_completed at time zone 'Africa/Lome')::date, 0, 0, 0);

  for v_answer in select value from jsonb_array_elements(p_answers) loop
    v_qid := (v_answer ->> 'question_id')::uuid;
    if not exists (select 1 from public.questions where id = v_qid and status = 'validee') then
      raise exception 'unknown_question';
    end if;
    v_choices := array(
      select jsonb_array_elements_text(coalesce(v_answer -> 'choice_ids', '[]'::jsonb))::uuid
    );
    v_ok := public.is_answer_correct(v_qid, v_choices);

    insert into public.lesson_answers (attempt_id, question_id, choice_ids, is_correct)
    values (p_attempt_id, v_qid, v_choices, v_ok)
    on conflict (attempt_id, question_id) do nothing;
    continue when not found;

    v_total := v_total + 1;
    if v_ok then
      v_correct := v_correct + 1;
    end if;

    insert into public.question_mastery as m (user_id, question_id, consecutive_correct, needs_review, updated_at)
    values (v_uid, v_qid, case when v_ok then 1 else 0 end, not v_ok, now())
    on conflict (user_id, question_id) do update set
      consecutive_correct = case when v_ok then m.consecutive_correct + 1 else 0 end,
      needs_review = case
        when not v_ok then true
        when m.consecutive_correct + 1 >= 2 then false
        else m.needs_review
      end,
      updated_at = now();
  end loop;

  update public.lesson_attempts set
    correct_count = v_correct,
    question_count = v_total,
    xp_earned = public.setting_int('xp_per_lesson')
      + case when v_correct = v_total then public.setting_int('xp_perfect_bonus') else 0 end
  where id = p_attempt_id
  returning * into v_row;

  return v_row;
end $$;

-- Série de jours : jours consécutifs se terminant aujourd'hui (ou hier si pas encore révisé)
create function public.compute_streak(p_user_id uuid, p_today date)
returns integer
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_day date;
  v_streak integer := 0;
begin
  if exists (select 1 from public.lesson_attempts where user_id = p_user_id and activity_date = p_today) then
    v_day := p_today;
  else
    v_day := p_today - 1;
  end if;
  while exists (select 1 from public.lesson_attempts where user_id = p_user_id and activity_date = v_day) loop
    v_streak := v_streak + 1;
    v_day := v_day - 1;
  end loop;
  return v_streak;
end $$;
revoke execute on function public.compute_streak(uuid, date) from public, anon, authenticated;

create function public.get_my_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Africa/Lome')::date;
  v_week_start timestamp := date_trunc('week', now() at time zone 'Africa/Lome');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  return jsonb_build_object(
    'current_streak', public.compute_streak(v_uid, v_today),
    'practiced_today', exists (select 1 from public.lesson_attempts where user_id = v_uid and activity_date = v_today),
    'total_xp', (select coalesce(sum(xp_earned), 0) from public.lesson_attempts where user_id = v_uid),
    'weekly_xp', (select coalesce(sum(xp_earned), 0) from public.lesson_attempts
                  where user_id = v_uid and (received_at at time zone 'Africa/Lome') >= v_week_start)
  );
end $$;
```

Note : la série utilise la date de la leçon (`activity_date`, pour que les leçons faites hors ligne comptent), mais les XP de la semaine utilisent la date de réception par le serveur (`received_at`), pour qu'on ne puisse pas antidater des leçons dans le classement.

- [ ] **Step 4 : Appliquer et lancer les tests**

Run: `npm run db:reset` puis `npm run db:test`
Expected: tous les fichiers `ok`.

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/20260928000300_lessons.sql supabase/tests/030_lessons.test.sql
git commit -m "feat(db): leçons, révision des erreurs et série de jours"
```

---

### Task 5 : Classement hebdomadaire

**Files:**
- Create: `supabase/migrations/20260928000400_leaderboard.sql`
- Test: `supabase/tests/040_leaderboard.test.sql`

**Interfaces:**
- Consumes: `lesson_attempts` (Task 4), `profiles`, `display_name` (Task 3)
- Produces: `get_weekly_leaderboard(p_limit integer default 50) returns table (rank bigint, display_name text, xp bigint, is_me boolean)`. Le nombre de lignes est plafonné à 100 ; aucun identifiant ni numéro de téléphone d'élève n'est exposé.

- [ ] **Step 1 : Écrire le test qui échoue**

`supabase/tests/040_leaderboard.test.sql` : le préambule commun, puis :

```sql
insert into public.units (id, title, position) values ('a0000000-0000-0000-0000-000000000001', 'Priorités', 1);
insert into public.lessons (id, unit_id, position) values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 1);
select pg_temp.new_user('e0000000-0000-0000-0000-000000000001', '22890000001');
select pg_temp.new_user('e0000000-0000-0000-0000-000000000002', '22890000002');
select pg_temp.new_user('e0000000-0000-0000-0000-000000000003', '22890000003');
update public.profiles set pseudo = 'Ama' where id = 'e0000000-0000-0000-0000-000000000001';
update public.profiles set first_name = 'Koffi', last_name = 'Mensah' where id = 'e0000000-0000-0000-0000-000000000002';

insert into public.lesson_attempts (id, user_id, lesson_id, completed_at, activity_date, received_at, correct_count, question_count, xp_earned) values
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', now(), current_date, now(), 1, 1, 10),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', now(), current_date, now(), 1, 1, 15),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', now(), current_date, now(), 1, 1, 10),
  (gen_random_uuid(), 'e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', now() - interval '8 days', current_date - 8, now() - interval '8 days', 1, 1, 50);

select pg_temp.claims('e0000000-0000-0000-0000-000000000001');
set local role authenticated;
select results_eq($$ select rank, display_name, xp, is_me from public.get_weekly_leaderboard() $$,
  $$ values (1::bigint, 'Ama'::text, 25::bigint, true), (2::bigint, 'Koffi M.'::text, 10::bigint, false) $$,
  'classement de la semaine : XP de la semaine seulement, élèves sans XP absents');
select is((select count(*)::int from public.get_weekly_leaderboard(1)), 1, 'la limite est respectée');
select is((public.get_my_stats() ->> 'weekly_xp')::int, 25, 'XP de la semaine de l''élève');
reset role;

select pg_temp.claims('e0000000-0000-0000-0000-000000000002');
set local role authenticated;
select is((public.get_my_stats() ->> 'total_xp')::int, 60, 'le total inclut les semaines précédentes');
select is((public.get_my_stats() ->> 'weekly_xp')::int, 10, 'la semaine précédente est exclue');
reset role;
```

Puis la fin commune.

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npm run db:test`
Expected: `040_leaderboard.test.sql` échoue (`function public.get_weekly_leaderboard() does not exist`).

- [ ] **Step 3 : Écrire la migration**

`supabase/migrations/20260928000400_leaderboard.sql` :

```sql
create function public.get_weekly_leaderboard(p_limit integer default 50)
returns table (rank bigint, display_name text, xp bigint, is_me boolean)
language sql stable security definer set search_path = ''
as $$
  with totals as (
    select a.user_id, sum(a.xp_earned)::bigint as xp
    from public.lesson_attempts a
    where (a.received_at at time zone 'Africa/Lome') >= date_trunc('week', now() at time zone 'Africa/Lome')
    group by a.user_id
  )
  select
    rank() over (order by t.xp desc),
    public.display_name(p),
    t.xp,
    t.user_id = auth.uid()
  from totals t
  join public.profiles p on p.id = t.user_id
  order by t.xp desc, t.user_id
  limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;
```

- [ ] **Step 4 : Appliquer et lancer les tests**

Run: `npm run db:reset` puis `npm run db:test`
Expected: tous les fichiers `ok`.

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/20260928000400_leaderboard.sql supabase/tests/040_leaderboard.test.sql
git commit -m "feat(db): classement hebdomadaire"
```

---

### Task 6 : Pass et examens blancs

**Files:**
- Create: `supabase/migrations/20260928000500_exams.sql`
- Test: `supabase/tests/050_exams.test.sql`

**Interfaces:**
- Consumes: `setting_int`, `settings`, `questions`, `choices` (Task 2) ; `profiles` (Task 3) ; `is_answer_correct` (Task 4)
- Produces:
  - Tables : `passes(id, user_id, payment_id, starts_at, ends_at, created_at)` (la clé étrangère `payment_id` est ajoutée en Task 7), `exam_attempts(id, user_id, question_ids, seconds_per_question, pass_mark, started_at, expires_at, submitted_at, score, passed)`, `exam_answers(attempt_id, question_id, choice_ids, answered_at)`
  - `has_active_pass(p_user_id uuid) returns boolean`
  - `draw_exam_questions(p_n integer) returns uuid[]` (interne)
  - `finalize_exam(p_attempt_id uuid) returns void` (interne)
  - `start_exam() returns jsonb` : reprend l'examen en cours s'il existe, sinon en crée un (erreurs : `pass_required`, `not_enough_questions`)
  - `get_exam(p_attempt_id uuid) returns jsonb` : `{attempt_id, started_at, expires_at, seconds_per_question, pass_mark, total, submitted, score, passed, questions: [{id, prompt, image_path, explanation, selected, is_correct, choices: [{id, label, is_correct}]}]}`. Les champs `explanation` et `is_correct` valent `null` tant que l'examen n'est pas soumis (erreur : `exam_not_found`).
  - `save_exam_answer(p_attempt_id uuid, p_question_id uuid, p_choice_ids uuid[]) returns void` : la première réponse est définitive (erreurs : `exam_not_found`, `exam_closed`, `question_not_in_exam`)
  - `submit_exam(p_attempt_id uuid) returns jsonb` : idempotent, renvoie `get_exam`
  - `get_exam_status() returns jsonb` : `{has_pass, pass_ends_at, free_exam_available, exams_taken, consecutive_passes, required_passes, ready}`

- [ ] **Step 1 : Écrire le test qui échoue**

`supabase/tests/050_exams.test.sql` : le préambule commun, puis :

```sql
update public.settings set value = '3' where key = 'exam_question_count';
update public.settings set value = '2' where key = 'exam_pass_mark';

insert into public.units (id, title, position) values
  ('a0000000-0000-0000-0000-000000000001', 'Panneaux', 1),
  ('a0000000-0000-0000-0000-000000000002', 'Priorités', 2);
insert into public.lessons (id, unit_id, position) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 1),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 1);
insert into public.questions (id, unit_id, lesson_id, prompt, status) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Q1', 'validee'),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Q2', 'validee'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Q3', 'validee'),
  ('c0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Q4', 'validee');
insert into public.choices (question_id, label, is_correct, position)
select q.id, v.label, v.ok, v.pos
from public.questions q
cross join (values ('Juste', true, 1), ('Faux', false, 2)) as v(label, ok, pos);

select pg_temp.new_user('e0000000-0000-0000-0000-000000000001', '22890000001');
select pg_temp.new_user('e0000000-0000-0000-0000-000000000002', '22890000002');
select pg_temp.new_user('e0000000-0000-0000-0000-000000000003', '22890000003');

-- Élève A : examen gratuit
select pg_temp.claims('e0000000-0000-0000-0000-000000000001');
set local role authenticated;
select is((public.get_exam_status() ->> 'free_exam_available')::boolean, true, 'un examen gratuit est disponible');
select lives_ok($$ select public.start_exam() $$, 'l''examen gratuit démarre');
select is((select count(*)::int from public.exam_attempts), 1, 'une tentative créée');
select is((select array_length(question_ids, 1) from public.exam_attempts), 3, '3 questions tirées');
select is((public.start_exam() ->> 'attempt_id')::uuid, (select id from public.exam_attempts), 'relancer reprend l''examen en cours');
select is((select count(*)::int from public.exam_attempts), 1, 'un double appui ne consomme pas un second examen');
select ok(not (public.get_exam((select id from public.exam_attempts)) @? '$.questions[*].choices[*] ? (@.is_correct != null)'),
  'les bonnes réponses sont cachées avant la soumission');

select lives_ok($$
  select public.save_exam_answer(a.id, t.q, array(select c.id from public.choices c where c.question_id = t.q and c.is_correct))
  from public.exam_attempts a, unnest(a.question_ids) with ordinality as t(q, n)
  where t.n <= 2
$$, 'deux bonnes réponses enregistrées');
select lives_ok($$
  select public.save_exam_answer(a.id, a.question_ids[1], array(select c.id from public.choices c where c.question_id = a.question_ids[1] and not c.is_correct))
  from public.exam_attempts a
$$, 'tentative de modifier une réponse');
select is((select count(*)::int from public.exam_answers ea join public.choices c on c.id = any(ea.choice_ids) where not c.is_correct), 0,
  'la première réponse est définitive (pas de retour en arrière)');
select throws_ok($$ select public.save_exam_answer((select id from public.exam_attempts),
  (select q.id from public.questions q where not (q.id = any((select question_ids from public.exam_attempts))) limit 1), '{}') $$,
  'P0001', 'question_not_in_exam', 'une question hors examen est refusée');

update public.exam_attempts set score = 20, passed = true;
select is((select score from public.exam_attempts), null, 'l''élève ne peut pas écrire sa note directement');

select is((public.submit_exam((select id from public.exam_attempts)) ->> 'score')::int, 2, 'note = 2 (question sans réponse = 0)');
select is((select passed from public.exam_attempts), true, 'admis avec 2/3 et un seuil de 2');
select is((public.submit_exam((select id from public.exam_attempts)) ->> 'score')::int, 2, 'soumettre deux fois ne change rien');
select ok(public.get_exam((select id from public.exam_attempts)) @? '$.questions[*].choices[*] ? (@.is_correct == true)',
  'la correction est visible après la soumission');
select throws_ok($$ select public.save_exam_answer((select id from public.exam_attempts), (select question_ids[3] from public.exam_attempts), '{}') $$,
  'P0001', 'exam_closed', 'pas de réponse après la soumission');
select throws_ok($$ select public.start_exam() $$, 'P0001', 'pass_required', 'le second examen demande un Pass');
reset role;

select set_config('test.a_attempt', (select id::text from public.exam_attempts where user_id = 'e0000000-0000-0000-0000-000000000001'), true);

-- Élève B ne voit pas l'examen de A
select pg_temp.claims('e0000000-0000-0000-0000-000000000002');
set local role authenticated;
select throws_ok($$ select public.get_exam(current_setting('test.a_attempt')::uuid) $$, 'P0001', 'exam_not_found', 'examen d''un autre élève introuvable');
reset role;

-- Avec un Pass actif
insert into public.passes (user_id, starts_at, ends_at)
values ('e0000000-0000-0000-0000-000000000001', now() - interval '1 day', now() + interval '89 days');
select pg_temp.claims('e0000000-0000-0000-0000-000000000001');
set local role authenticated;
select is((public.get_exam_status() ->> 'has_pass')::boolean, true, 'le Pass est reconnu');
select lives_ok($$ select public.start_exam() $$, 'avec un Pass, un nouvel examen démarre');
reset role;

-- Examen expiré : fermé aux réponses, puis noté au démarrage suivant
update public.exam_attempts set expires_at = now() - interval '1 minute'
where user_id = 'e0000000-0000-0000-0000-000000000001' and submitted_at is null;
select pg_temp.claims('e0000000-0000-0000-0000-000000000001');
set local role authenticated;
select throws_ok($$ select public.save_exam_answer(a.id, a.question_ids[1], '{}') from public.exam_attempts a where a.submitted_at is null $$,
  'P0001', 'exam_closed', 'pas de réponse après expiration');
select lives_ok($$ select public.start_exam() $$, 'redémarrer après expiration');
select is((select count(*)::int from public.exam_attempts where submitted_at is not null), 2, 'l''examen expiré a été noté avec les réponses reçues');
select is((select count(*)::int from public.exam_attempts where submitted_at is null), 1, 'un nouvel examen est ouvert');
reset role;

-- Indicateur « prêt pour l'examen » (élève C)
insert into public.exam_attempts (user_id, question_ids, seconds_per_question, pass_mark, started_at, expires_at, submitted_at, score, passed) values
  ('e0000000-0000-0000-0000-000000000003', '{}', 30, 2, now() - interval '3 hours', now(), now() - interval '3 hours', 1, false),
  ('e0000000-0000-0000-0000-000000000003', '{}', 30, 2, now() - interval '2 hours', now(), now() - interval '2 hours', 3, true),
  ('e0000000-0000-0000-0000-000000000003', '{}', 30, 2, now() - interval '1 hour', now(), now() - interval '1 hour', 3, true);
select pg_temp.claims('e0000000-0000-0000-0000-000000000003');
set local role authenticated;
select is((public.get_exam_status() ->> 'consecutive_passes')::int, 2, 'deux réussites consécutives');
select is((public.get_exam_status() ->> 'ready')::boolean, false, 'pas encore prêt (3 réussites requises)');
reset role;
update public.settings set value = '2' where key = 'ready_after_consecutive_passes';
select pg_temp.claims('e0000000-0000-0000-0000-000000000003');
set local role authenticated;
select is((public.get_exam_status() ->> 'ready')::boolean, true, 'prêt quand le seuil est atteint');
reset role;

-- Pas assez de questions
insert into public.passes (user_id, starts_at, ends_at)
values ('e0000000-0000-0000-0000-000000000003', now() - interval '1 day', now() + interval '89 days');
update public.settings set value = '10' where key = 'exam_question_count';
select pg_temp.claims('e0000000-0000-0000-0000-000000000003');
set local role authenticated;
select throws_ok($$ select public.start_exam() $$, 'P0001', 'not_enough_questions', 'erreur claire si la banque est trop petite');
reset role;

-- Répartition par unité
update public.settings set value = '2' where key = 'exam_question_count';
update public.settings set value = '{"a0000000-0000-0000-0000-000000000001": 1}' where key = 'exam_unit_weights';
select pg_temp.claims('e0000000-0000-0000-0000-000000000003');
set local role authenticated;
select lives_ok($$ select public.start_exam() $$, 'examen avec pondération');
select is((select count(*)::int from public.exam_attempts a
           cross join lateral unnest(a.question_ids) as t(q)
           join public.questions qq on qq.id = t.q
           where a.submitted_at is null and qq.unit_id = 'a0000000-0000-0000-0000-000000000001'), 2,
  'toutes les questions viennent de l''unité pondérée');
reset role;
```

Puis la fin commune.

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npm run db:test`
Expected: `050_exams.test.sql` échoue (`function public.get_exam_status() does not exist`).

- [ ] **Step 3 : Écrire la migration**

`supabase/migrations/20260928000500_exams.sql` :

```sql
create table public.passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  payment_id uuid unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index passes_user_idx on public.passes (user_id, ends_at);
alter table public.passes enable row level security;
create policy passes_read on public.passes for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_ids uuid[] not null,
  seconds_per_question integer not null,
  pass_mark integer not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  score integer,
  passed boolean
);
create index exam_attempts_user_idx on public.exam_attempts (user_id, started_at desc);

create table public.exam_answers (
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  question_id uuid not null,
  choice_ids uuid[] not null,
  answered_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

alter table public.exam_attempts enable row level security;
alter table public.exam_answers enable row level security;
create policy exam_attempts_read on public.exam_attempts for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy exam_answers_read on public.exam_answers for select to authenticated
  using (exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.user_id = auth.uid()));

create function public.has_active_pass(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.passes
    where user_id = p_user_id and starts_at <= now() and ends_at > now()
  );
$$;

-- Tirage : aléatoire uniforme, ou réparti par unité selon settings.exam_unit_weights
create function public.draw_exam_questions(p_n integer)
returns uuid[]
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_weights jsonb;
  v_ids uuid[];
begin
  select value into v_weights from public.settings where key = 'exam_unit_weights';

  if v_weights is null or v_weights = '{}'::jsonb then
    return array(select id from public.questions where status = 'validee' order by random() limit p_n);
  end if;

  with w as (
    select key::uuid as unit_id, value::numeric as weight
    from jsonb_each_text(v_weights)
    where value::numeric > 0
  ), shares as (
    select unit_id, p_n * weight / sum(weight) over () as share from w
  ), base as (
    select unit_id, floor(share)::integer as quota, share - floor(share) as remainder from shares
  ), quotas as (
    select unit_id,
      quota + case
        when row_number() over (order by remainder desc, unit_id) <= p_n - sum(quota) over () then 1
        else 0
      end as quota
    from base
  )
  select array_agg(picked.id) into v_ids
  from quotas
  cross join lateral (
    select q.id from public.questions q
    where q.unit_id = quotas.unit_id and q.status = 'validee'
    order by random()
    limit quotas.quota
  ) as picked;

  v_ids := coalesce(v_ids, '{}');
  -- Compléter si une unité n'a pas assez de questions
  v_ids := v_ids || array(
    select id from public.questions
    where status = 'validee' and not (id = any(v_ids))
    order by random()
    limit greatest(p_n - coalesce(array_length(v_ids, 1), 0), 0)
  );
  return array(select x from unnest(v_ids) as x order by random());
end $$;
revoke execute on function public.draw_exam_questions(integer) from public, anon, authenticated;

create function public.get_exam(p_attempt_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_a public.exam_attempts;
  v_done boolean;
begin
  select * into v_a from public.exam_attempts where id = p_attempt_id and user_id = auth.uid();
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
        'explanation', case when v_done then q.explanation end,
        'selected', to_jsonb(ea.choice_ids),
        'is_correct', case when v_done then public.is_answer_correct(q.id, coalesce(ea.choice_ids, '{}')) end,
        'choices', (
          select jsonb_agg(jsonb_build_object(
            'id', c.id,
            'label', c.label,
            'is_correct', case when v_done then c.is_correct end
          ) order by c.position)
          from public.choices c where c.question_id = q.id
        )
      ) order by t.ord)
      from unnest(v_a.question_ids) with ordinality as t(qid, ord)
      join public.questions q on q.id = t.qid
      left join public.exam_answers ea on ea.attempt_id = v_a.id and ea.question_id = q.id
    ), '[]'::jsonb)
  );
end $$;

create function public.finalize_exam(p_attempt_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_a public.exam_attempts;
  v_score integer;
begin
  select * into v_a from public.exam_attempts where id = p_attempt_id for update;
  if not found or v_a.submitted_at is not null then
    return;
  end if;

  select count(*) into v_score
  from unnest(v_a.question_ids) as t(q)
  left join public.exam_answers ea on ea.attempt_id = v_a.id and ea.question_id = t.q
  where public.is_answer_correct(t.q, coalesce(ea.choice_ids, '{}'));

  update public.exam_attempts
  set submitted_at = now(), score = v_score, passed = v_score >= v_a.pass_mark
  where id = v_a.id;
end $$;
revoke execute on function public.finalize_exam(uuid) from public, anon, authenticated;

create function public.start_exam()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_expired uuid;
  v_open_id uuid;
  v_n integer := public.setting_int('exam_question_count');
  v_seconds integer := public.setting_int('exam_seconds_per_question');
  v_ids uuid[];
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  for v_expired in
    select id from public.exam_attempts
    where user_id = v_uid and submitted_at is null and expires_at <= now()
  loop
    perform public.finalize_exam(v_expired);
  end loop;

  select id into v_open_id from public.exam_attempts
  where user_id = v_uid and submitted_at is null
  order by started_at desc limit 1;
  if v_open_id is not null then
    return public.get_exam(v_open_id);
  end if;

  if not public.has_active_pass(v_uid)
     and exists (select 1 from public.exam_attempts where user_id = v_uid) then
    raise exception 'pass_required';
  end if;

  v_ids := public.draw_exam_questions(v_n);
  if coalesce(array_length(v_ids, 1), 0) < v_n then
    raise exception 'not_enough_questions';
  end if;

  insert into public.exam_attempts (user_id, question_ids, seconds_per_question, pass_mark, expires_at)
  values (
    v_uid, v_ids, v_seconds, public.setting_int('exam_pass_mark'),
    now() + make_interval(secs => v_n * v_seconds + 120)
  )
  returning id into v_id;

  return public.get_exam(v_id);
end $$;

create function public.save_exam_answer(p_attempt_id uuid, p_question_id uuid, p_choice_ids uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_a public.exam_attempts;
begin
  select * into v_a from public.exam_attempts where id = p_attempt_id and user_id = auth.uid();
  if not found then
    raise exception 'exam_not_found';
  end if;
  if v_a.submitted_at is not null or v_a.expires_at <= now() then
    raise exception 'exam_closed';
  end if;
  if not (p_question_id = any(v_a.question_ids)) then
    raise exception 'question_not_in_exam';
  end if;

  insert into public.exam_answers (attempt_id, question_id, choice_ids)
  values (p_attempt_id, p_question_id, coalesce(p_choice_ids, '{}'))
  on conflict (attempt_id, question_id) do nothing;
end $$;

create function public.submit_exam(p_attempt_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.exam_attempts where id = p_attempt_id and user_id = auth.uid()) then
    raise exception 'exam_not_found';
  end if;
  perform public.finalize_exam(p_attempt_id);
  return public.get_exam(p_attempt_id);
end $$;

create function public.get_exam_status()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_required integer := public.setting_int('ready_after_consecutive_passes');
  v_consecutive integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select count(*) into v_consecutive
  from (
    select sum(case when passed then 0 else 1 end) over (order by submitted_at desc) as fails
    from public.exam_attempts
    where user_id = v_uid and submitted_at is not null
  ) as s
  where s.fails = 0;

  return jsonb_build_object(
    'has_pass', public.has_active_pass(v_uid),
    'pass_ends_at', (select max(ends_at) from public.passes where user_id = v_uid and ends_at > now()),
    'free_exam_available', not exists (select 1 from public.exam_attempts where user_id = v_uid),
    'exams_taken', (select count(*) from public.exam_attempts where user_id = v_uid and submitted_at is not null),
    'consecutive_passes', v_consecutive,
    'required_passes', v_required,
    'ready', v_consecutive >= v_required
  );
end $$;
```

- [ ] **Step 4 : Appliquer et lancer les tests**

Run: `npm run db:reset` puis `npm run db:test`
Expected: tous les fichiers `ok`.

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/20260928000500_exams.sql supabase/tests/050_exams.test.sql
git commit -m "feat(db): pass et examens blancs"
```

---

### Task 7 : Paiements, code promo et commissions

**Files:**
- Create: `supabase/migrations/20260928000600_payments.sql`
- Test: `supabase/tests/060_payments.test.sql`

**Interfaces:**
- Consumes: `setting_int`, `is_admin` (Task 2) ; `profiles`, `driving_schools` (Task 3) ; `passes` (Task 6)
- Produces:
  - Type `payment_status` (`pending`, `confirmed`, `failed`) ; table `payments(id, user_id, driving_school_id, base_amount_xof, discount_xof, amount_xof, commission_xof, status, gateway_ref, failure_reason, created_at, confirmed_at)`
  - `set_promo_code(p_code text) returns text` (nom de l'auto-école, ou `null` si le code est vidé ; erreurs : `invalid_promo_code`, `promo_locked`)
  - `create_payment() returns public.payments` (statut `pending`, montant calculé côté serveur)
  - `confirm_payment(p_payment_id uuid, p_gateway_ref text, p_amount_xof integer) returns public.passes`, **service_role uniquement**, idempotent (erreurs : `payment_not_found`, `amount_mismatch`)
  - `fail_payment(p_payment_id uuid, p_reason text) returns void`, service_role uniquement
  - `expire_stale_payments() returns integer`, service_role uniquement (paiements `pending` de plus de 30 min → `failed`)
  - `admin_commission_report(p_month date) returns table (driving_school_id uuid, name text, sales_count bigint, revenue_xof bigint, commission_xof bigint)`, admin uniquement (erreur : `forbidden`)

- [ ] **Step 1 : Écrire le test qui échoue**

`supabase/tests/060_payments.test.sql` : le préambule commun, puis :

```sql
select pg_temp.new_user('e0000000-0000-0000-0000-000000000001', '22890000001');
select pg_temp.new_user('e0000000-0000-0000-0000-000000000002', '22890000002');
select pg_temp.new_user('e0000000-0000-0000-0000-000000000004', '22890000004');
insert into public.admins (user_id) values ('e0000000-0000-0000-0000-000000000004');
insert into public.driving_schools (id, name, promo_code, discount_percent, commission_percent, active) values
  ('f0000000-0000-0000-0000-000000000001', 'Auto-école Le Volant', 'VOLANT', 10, 15, true),
  ('f0000000-0000-0000-0000-000000000002', 'Auto-école Fermée', 'FERME', 10, 10, false);

-- Élève A : code promo et paiement
select pg_temp.claims('e0000000-0000-0000-0000-000000000001');
set local role authenticated;
select is(public.set_promo_code(' volant '), 'Auto-école Le Volant', 'code promo accepté sans tenir compte de la casse ni des espaces');
select throws_ok($$ select public.set_promo_code('INCONNU') $$, 'P0001', 'invalid_promo_code', 'code inconnu refusé');
select throws_ok($$ select public.set_promo_code('FERME') $$, 'P0001', 'invalid_promo_code', 'auto-école désactivée refusée');
select lives_ok($$ select public.create_payment() $$, 'création d''un paiement');
select results_eq($$ select base_amount_xof, discount_xof, amount_xof, commission_xof, status::text from public.payments $$,
  $$ values (3000, 300, 2700, 405, 'pending') $$, '10 % de réduction, 15 % de commission sur le montant payé');
select throws_ok($$ select public.confirm_payment((select id from public.payments), 'REF1', 2700) $$, '42501', null,
  'un élève ne peut pas confirmer son paiement lui-même');
select throws_ok($$ select public.admin_commission_report(current_date) $$, 'P0001', 'forbidden', 'rapport réservé à l''admin');
reset role;

select set_config('test.p1', (select id::text from public.payments where user_id = 'e0000000-0000-0000-0000-000000000001'), true);

-- Serveur : confirmation
set local role service_role;
select throws_ok($$ select public.confirm_payment(current_setting('test.p1')::uuid, 'REF1', 1000) $$, 'P0001', 'amount_mismatch', 'montant incorrect refusé');
select lives_ok($$ select public.confirm_payment(current_setting('test.p1')::uuid, 'REF1', 2700) $$, 'paiement confirmé');
select lives_ok($$ select public.confirm_payment(current_setting('test.p1')::uuid, 'REF1', 2700) $$, 'notification reçue une seconde fois');
reset role;
select is((select count(*)::int from public.passes where user_id = 'e0000000-0000-0000-0000-000000000001'), 1, 'un seul Pass malgré deux notifications');
select is((select ends_at - starts_at from public.passes where user_id = 'e0000000-0000-0000-0000-000000000001'), interval '90 days', 'Pass de 90 jours');
select is((select status::text from public.payments where id = current_setting('test.p1')::uuid), 'confirmed', 'statut confirmé');

-- Code promo verrouillé après achat, et second Pass enchaîné
select pg_temp.claims('e0000000-0000-0000-0000-000000000001');
set local role authenticated;
select throws_ok($$ select public.set_promo_code('VOLANT') $$, 'P0001', 'promo_locked', 'code promo non modifiable après un achat');
select lives_ok($$ select public.create_payment() $$, 'second paiement');
reset role;
select set_config('test.p2', (select id::text from public.payments
  where user_id = 'e0000000-0000-0000-0000-000000000001' and status = 'pending'), true);
set local role service_role;
select lives_ok($$ select public.confirm_payment(current_setting('test.p2')::uuid, 'REF2', 2700) $$, 'second paiement confirmé');
reset role;
select is((select starts_at from public.passes where payment_id = current_setting('test.p2')::uuid),
  (select ends_at from public.passes where payment_id = current_setting('test.p1')::uuid),
  'le nouveau Pass commence à la fin du précédent');

-- Élève B sans code promo : paiement échoué puis confirmation tardive
select pg_temp.claims('e0000000-0000-0000-0000-000000000002');
set local role authenticated;
select lives_ok($$ select public.create_payment() $$, 'paiement sans code promo');
select results_eq($$ select amount_xof, commission_xof, driving_school_id from public.payments $$,
  $$ values (3000, 0, null::uuid) $$, 'plein tarif, aucune commission');
reset role;
select set_config('test.p3', (select id::text from public.payments where user_id = 'e0000000-0000-0000-0000-000000000002'), true);
set local role service_role;
select lives_ok($$ select public.fail_payment(current_setting('test.p3')::uuid, 'refusé par l''opérateur') $$, 'paiement marqué échoué');
select lives_ok($$ select public.confirm_payment(current_setting('test.p3')::uuid, 'REF3', 3000) $$, 'confirmation arrivée après l''échec');
reset role;
select is((select status::text from public.payments where id = current_setting('test.p3')::uuid), 'confirmed',
  'un paiement réellement débité est honoré même après un échec');

-- Expiration des paiements en attente
select pg_temp.claims('e0000000-0000-0000-0000-000000000002');
set local role authenticated;
select lives_ok($$ select public.create_payment() $$, 'paiement abandonné');
reset role;
update public.payments set created_at = now() - interval '31 minutes'
where user_id = 'e0000000-0000-0000-0000-000000000002' and status = 'pending';
set local role service_role;
select is(public.expire_stale_payments(), 1, 'un paiement en attente expiré');
reset role;
select is((select count(*)::int from public.payments where status = 'pending'), 0, 'plus aucun paiement en attente');

-- Rapport des commissions (admin)
select pg_temp.claims('e0000000-0000-0000-0000-000000000004');
set local role authenticated;
select results_eq($$ select name, sales_count, revenue_xof, commission_xof
                     from public.admin_commission_report((now() at time zone 'Africa/Lome')::date)
                     where driving_school_id = 'f0000000-0000-0000-0000-000000000001' $$,
  $$ values ('Auto-école Le Volant'::text, 2::bigint, 5400::bigint, 810::bigint) $$,
  'ventes et commissions du mois pour l''auto-école');
select is((select count(*)::int from public.payments), 4, 'l''admin voit tous les paiements');
reset role;
```

Puis la fin commune.

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npm run db:test`
Expected: `060_payments.test.sql` échoue (`function public.set_promo_code(unknown) does not exist`).

- [ ] **Step 3 : Écrire la migration**

`supabase/migrations/20260928000600_payments.sql` :

```sql
create type public.payment_status as enum ('pending', 'confirmed', 'failed');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  driving_school_id uuid references public.driving_schools (id) on delete set null,
  base_amount_xof integer not null check (base_amount_xof >= 0),
  discount_xof integer not null default 0 check (discount_xof >= 0),
  amount_xof integer not null check (amount_xof >= 0),
  commission_xof integer not null default 0 check (commission_xof >= 0),
  status public.payment_status not null default 'pending',
  gateway_ref text unique,
  failure_reason text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create index payments_user_idx on public.payments (user_id, created_at desc);
create index payments_school_idx on public.payments (driving_school_id, confirmed_at);

alter table public.payments enable row level security;
create policy payments_read on public.payments for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

alter table public.passes
  add constraint passes_payment_fk foreign key (payment_id) references public.payments (id) on delete set null;

create function public.set_promo_code(p_code text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_school public.driving_schools;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.payments where user_id = v_uid and status = 'confirmed') then
    raise exception 'promo_locked';
  end if;
  if nullif(trim(p_code), '') is null then
    update public.profiles set driving_school_id = null where id = v_uid;
    return null;
  end if;

  select * into v_school from public.driving_schools
  where promo_code = upper(trim(p_code)) and active;
  if not found then
    raise exception 'invalid_promo_code';
  end if;

  update public.profiles set driving_school_id = v_school.id where id = v_uid;
  return v_school.name;
end $$;

create function public.create_payment()
returns public.payments
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_school public.driving_schools;
  v_base integer := public.setting_int('pass_price_xof');
  v_discount integer := 0;
  v_commission integer := 0;
  v_row public.payments;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select s.* into v_school
  from public.driving_schools s
  join public.profiles p on p.driving_school_id = s.id
  where p.id = v_uid and s.active;

  if found then
    v_discount := floor(v_base * v_school.discount_percent / 100.0);
    v_commission := floor((v_base - v_discount) * v_school.commission_percent / 100.0);
  end if;

  insert into public.payments (user_id, driving_school_id, base_amount_xof, discount_xof, amount_xof, commission_xof)
  values (v_uid, v_school.id, v_base, v_discount, v_base - v_discount, v_commission)
  returning * into v_row;
  return v_row;
end $$;

create function public.confirm_payment(p_payment_id uuid, p_gateway_ref text, p_amount_xof integer)
returns public.passes
language plpgsql security definer set search_path = ''
as $$
declare
  v_pay public.payments;
  v_pass public.passes;
  v_start timestamptz;
begin
  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment_not_found';
  end if;

  if v_pay.status = 'confirmed' then
    select * into v_pass from public.passes where payment_id = p_payment_id;
    return v_pass;
  end if;

  if p_amount_xof is distinct from v_pay.amount_xof then
    raise exception 'amount_mismatch';
  end if;

  update public.payments
  set status = 'confirmed', gateway_ref = p_gateway_ref, confirmed_at = now(), failure_reason = null
  where id = p_payment_id;

  select greatest(now(), coalesce(max(ends_at), now())) into v_start
  from public.passes where user_id = v_pay.user_id;

  insert into public.passes (user_id, payment_id, starts_at, ends_at)
  values (
    v_pay.user_id, p_payment_id, v_start,
    v_start + make_interval(days => public.setting_int('pass_duration_days'))
  )
  returning * into v_pass;
  return v_pass;
end $$;

create function public.fail_payment(p_payment_id uuid, p_reason text)
returns void
language sql security definer set search_path = ''
as $$
  update public.payments
  set status = 'failed', failure_reason = p_reason
  where id = p_payment_id and status = 'pending';
$$;

create function public.expire_stale_payments()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.payments
  set status = 'failed', failure_reason = 'timeout'
  where status = 'pending' and created_at < now() - interval '30 minutes';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.confirm_payment(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.fail_payment(uuid, text) from public, anon, authenticated;
revoke execute on function public.expire_stale_payments() from public, anon, authenticated;
grant execute on function public.confirm_payment(uuid, text, integer) to service_role;
grant execute on function public.fail_payment(uuid, text) to service_role;
grant execute on function public.expire_stale_payments() to service_role;

create function public.admin_commission_report(p_month date)
returns table (driving_school_id uuid, name text, sales_count bigint, revenue_xof bigint, commission_xof bigint)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_start timestamptz := make_timestamptz(
    extract(year from p_month)::integer, extract(month from p_month)::integer, 1, 0, 0, 0, 'Africa/Lome');
  v_end timestamptz := v_start + interval '1 month';
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  return query
    select s.id, s.name, count(p.id), coalesce(sum(p.amount_xof), 0)::bigint, coalesce(sum(p.commission_xof), 0)::bigint
    from public.driving_schools s
    left join public.payments p
      on p.driving_school_id = s.id
      and p.status = 'confirmed'
      and p.confirmed_at >= v_start and p.confirmed_at < v_end
    group by s.id, s.name
    order by s.name;
end $$;
```

- [ ] **Step 4 : Appliquer et lancer toute la suite**

Run: `npm run db:reset` puis `npm run db:test`
Expected: les 7 fichiers `ok`, `All tests successful.`

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/20260928000600_payments.sql supabase/tests/060_payments.test.sql
git commit -m "feat(db): paiements, code promo et commissions"
```

---

## Suite : les plans suivants

Ce plan couvre le backend. Chacun des blocs ci-dessous fera l'objet de son propre plan, rédigé une fois le précédent terminé, car chacun s'appuie sur les fonctions produites ici :

1. **Plan 2 — Site d'administration (Next.js)** : connexion admin, gestion des questions (liste, édition, images, validation), unités et leçons (découpage automatique selon `lesson_size`), réglages, auto-écoles, ventes et export CSV.
2. **Plan 3 — Numérisation du contenu** : extraction des scans en JSON, recadrage des images, script d'import en `brouillon`, propositions d'explications. **Nécessite les scans.**
3. **Plan 4 — Application élève : parcours** (Expo, Android) : connexion par SMS, profil et code promo, téléchargement du contenu hors ligne, parcours, leçons avec révision des erreurs, série de jours, XP et classement.
4. **Plan 5 — Application élève : examens et paiement** : examens blancs chronométrés, résultats et indicateur « prêt », Edge Functions de paiement (initiation et webhook de la passerelle, appel de `confirm_payment`), tâche planifiée `expire_stale_payments`.
5. **Plan 6 — Notifications et publication** : rappel quotidien à 19 h (Expo Push), mise en production Supabase, publication sur le Play Store.
