-- Codes d'activation du Pass Examen, vendus hors de l'application (auto-écoles, site web).
-- L'app publiée sur le Play Store ne vend rien : l'élève saisit son code et le Pass démarre.

create table pass_code_batches (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 100),
  driving_school_id uuid references driving_schools (id) on delete set null,
  duration_days integer not null check (duration_days between 1 and 730),
  created_at timestamptz not null default now()
);

create table pass_codes (
  code text primary key check (code ~ '^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$'),
  batch_id uuid not null references pass_code_batches (id) on delete cascade,
  redeemed_by text references profiles (id) on delete set null,
  redeemed_at timestamptz
);
create index pass_codes_batch_idx on pass_codes (batch_id);

alter table passes add column pass_code text unique references pass_codes (code) on delete set null;

-- 12 caractères tirés de gen_random_uuid() (aléatoire cryptographique), sans 0/O ni 1/I pour éviter les
-- confusions à la saisie : 32 symboles, soit 60 bits par code.
create function random_pass_code()
returns text
language sql
volatile
as $$
  with b as (select uuid_send(gen_random_uuid()) as bytes),
  chars as (
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', get_byte(bytes, i) % 32 + 1, 1), '' order by i) as s
    from b, generate_series(0, 11) as i
  )
  select substr(s, 1, 4) || '-' || substr(s, 5, 4) || '-' || substr(s, 9, 4) from chars;
$$;

/** Crée un lot de codes ; renvoie l'identifiant du lot. */
create function create_pass_code_batch(p_label text, p_school_id uuid, p_count integer, p_duration_days integer)
returns uuid
language plpgsql
as $$
declare
  v_batch uuid;
  v_made integer := 0;
begin
  if p_count is null or p_count < 1 or p_count > 1000 then
    raise exception 'invalid_code_count';
  end if;
  insert into pass_code_batches (label, driving_school_id, duration_days)
  values (trim(p_label), p_school_id, coalesce(p_duration_days, setting_int('pass_duration_days')))
  returning id into v_batch;
  while v_made < p_count loop
    insert into pass_codes (code, batch_id) values (random_pass_code(), v_batch) on conflict do nothing;
    if found then
      v_made := v_made + 1;
    end if;
  end loop;
  return v_batch;
end $$;

/** Normalise une saisie : majuscules, sans espaces ni tirets, puis remet les tirets. */
create function normalize_pass_code(p_code text)
returns text
language sql
immutable
as $$
  with c as (select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) as s)
  select case when char_length(s) = 12 then substr(s, 1, 4) || '-' || substr(s, 5, 4) || '-' || substr(s, 9, 4) else s end
  from c;
$$;

/** Active un code pour l'élève : le Pass démarre maintenant, ou à la fin de son Pass en cours. */
create function redeem_pass_code(p_user_id text, p_code text)
returns passes
language plpgsql
as $$
declare
  v_code pass_codes;
  v_days integer;
  v_start timestamptz;
  v_pass passes;
begin
  select * into v_code from pass_codes where code = normalize_pass_code(p_code) for update;
  if not found then
    raise exception 'invalid_pass_code';
  end if;
  if v_code.redeemed_at is not null then
    raise exception 'pass_code_used';
  end if;

  -- Un seul calcul de période à la fois par élève, pour que les Pass s'enchaînent (comme confirm_payment)
  perform 1 from profiles where id = p_user_id for update;
  if not found then
    raise exception 'profile_not_found';
  end if;

  select duration_days into v_days from pass_code_batches where id = v_code.batch_id;
  select greatest(now(), coalesce(max(ends_at), now())) into v_start from passes where user_id = p_user_id;

  update pass_codes set redeemed_by = p_user_id, redeemed_at = now() where code = v_code.code;
  insert into passes (user_id, pass_code, starts_at, ends_at)
  values (p_user_id, v_code.code, v_start, v_start + make_interval(days => v_days))
  returning * into v_pass;
  return v_pass;
end $$;
