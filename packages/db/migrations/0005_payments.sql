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

  -- Compte supprimé entre le paiement et la confirmation : rien à activer
  if v_pay.user_id is null then
    return null;
  end if;

  -- Un seul calcul de période à la fois par élève, pour que les Pass s'enchaînent
  perform 1 from profiles where id = v_pay.user_id for update;

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
