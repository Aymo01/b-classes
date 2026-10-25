create or replace function public.submit_quiz(_quiz_id uuid, _answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  total numeric := 0;
  score numeric := 0;
  result jsonb;
  q record;
  ans int;
begin
  if auth.uid() is null then
    raise exception 'authenticated session required';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', qq.id, 'question_text', qq.question_text, 'options', qq.options, 'correct_index', qq.correct_index, 'points', qq.points) order by qq.order_index), '[]'::jsonb)
  into result from public.quiz_questions qq where qq.quiz_id = _quiz_id;
  for q in select * from public.quiz_questions where quiz_id = _quiz_id order by order_index loop
    total := total + q.points;
    ans := (_answers ->> q.id::text)::int;
    if ans is not null and ans = q.correct_index then
      score := score + q.points;
    end if;
  end loop;
  insert into public.quiz_attempts (quiz_id, student_id, answers, score, total_points)
  values (_quiz_id, auth.uid(), _answers, score, total);
  return jsonb_build_object('score', score, 'total', total, 'questions', result);
end;
$$;

grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;

create or replace function public.get_quiz_review(_quiz_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
begin
  select * into a from public.quiz_attempts
  where quiz_id = _quiz_id and student_id = auth.uid()
  order by submitted_at desc limit 1;
  if not found then
    raise exception 'no attempt';
  end if;
  return jsonb_build_object(
    'attempt', to_jsonb(a),
    'questions', (select coalesce(jsonb_agg(jsonb_build_object('id', qq.id, 'question_text', qq.question_text, 'options', qq.options, 'correct_index', qq.correct_index, 'points', qq.points) order by qq.order_index), '[]'::jsonb) from public.quiz_questions qq where qq.quiz_id = _quiz_id)
  );
end;
$$;

grant execute on function public.get_quiz_review(uuid) to authenticated;