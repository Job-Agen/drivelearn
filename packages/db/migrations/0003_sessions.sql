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
