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
