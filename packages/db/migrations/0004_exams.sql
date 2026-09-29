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

-- Note les examens expirés avec les réponses reçues
create function finalize_expired_exams(p_user_id text)
returns void
language plpgsql
as $$
declare
  v_expired uuid;
begin
  for v_expired in
    select id from exam_attempts
    where user_id = p_user_id and submitted_at is null and expires_at <= now()
  loop
    perform finalize_exam(v_expired);
  end loop;
end $$;

create function start_exam(p_user_id text, p_program_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_program programs;
  v_open_id uuid;
  v_ids uuid[];
  v_id uuid;
begin
  select * into v_program from programs where id = p_program_id;
  if not found then
    raise exception 'program_not_found';
  end if;

  -- Un seul démarrage à la fois par élève (double appui)
  perform 1 from profiles where id = p_user_id for update;

  perform finalize_expired_exams(p_user_id);

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
  -- Verrou : attend une notation en cours, puis voit l'examen comme soumis
  select * into v_a from exam_attempts where id = p_attempt_id and user_id = p_user_id for update;
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
  perform finalize_expired_exams(p_user_id);

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
language plpgsql
as $$
begin
  perform finalize_expired_exams(p_user_id);

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'attempt_id', id,
      'submitted_at', submitted_at,
      'score', score,
      'total', coalesce(array_length(question_ids, 1), 0),
      'passed', passed
    ) order by submitted_at desc), '[]'::jsonb)
    from exam_attempts
    where user_id = p_user_id and submitted_at is not null
  );
end $$;
