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
