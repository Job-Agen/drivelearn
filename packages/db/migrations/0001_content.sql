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
