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
