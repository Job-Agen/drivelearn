-- Contenu validé d'un programme, pour le téléchargement hors ligne par l'application
create function get_program_content(p_program_id uuid)
returns jsonb
language sql stable
as $$
  select jsonb_build_object(
    'program', jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'exam_question_count', p.exam_question_count,
      'exam_pass_mark', p.exam_pass_mark,
      'exam_seconds_per_question', p.exam_seconds_per_question
    ),
    'units', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id,
        'title', u.title,
        'position', u.position,
        'lessons', (
          select jsonb_agg(jsonb_build_object(
            'id', l.id,
            'title', l.title,
            'position', l.position,
            'intro_title', l.intro_title,
            'intro_text', l.intro_text,
            'intro_image_path', l.intro_image_path,
            'mentor_tip', l.mentor_tip,
            'questions', (
              select jsonb_agg(jsonb_build_object(
                'id', q.id,
                'prompt', q.prompt,
                'image_path', q.image_path,
                'explanation', q.explanation,
                'multiple', (select count(*) from choices c2 where c2.question_id = q.id and c2.is_correct) > 1,
                'choices', (
                  select jsonb_agg(jsonb_build_object('id', c.id, 'label', c.label, 'is_correct', c.is_correct)
                    order by c.position)
                  from choices c where c.question_id = q.id
                )
              ) order by q.position, q.id)
              from questions q
              where q.lesson_id = l.id and q.status = 'validee'
            )
          ) order by l.position)
          from lessons l
          where l.unit_id = u.id
            and exists (select 1 from questions q where q.lesson_id = l.id and q.status = 'validee')
        )
      ) order by u.position)
      from units u
      where u.program_id = p.id
        and exists (
          select 1 from lessons l join questions q on q.lesson_id = l.id
          where l.unit_id = u.id and q.status = 'validee'
        )
    ), '[]'::jsonb)
  )
  from programs p
  where p.id = p_program_id;
$$;
