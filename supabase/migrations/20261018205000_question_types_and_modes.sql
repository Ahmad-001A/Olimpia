-- Olympia: multiple question types, text checking and matching-pair questions.
-- Apply AFTER 20261018000000_olympia_core.sql to an existing project.

alter table public.assessment_questions
  add column if not exists question_type text not null default 'choice',
  add column if not exists correct_text text not null default '',
  add column if not exists match_pairs jsonb not null default '[]'::jsonb;

alter table public.assessment_questions alter column correct_index drop not null;

alter table public.assessment_questions drop constraint if exists assessment_questions_options_check;
alter table public.assessment_questions drop constraint if exists assessment_questions_correct_index_check;
alter table public.assessment_questions drop constraint if exists assessment_questions_question_type_check;
alter table public.assessment_questions drop constraint if exists assessment_questions_type_payload_check;

alter table public.assessment_questions add constraint assessment_questions_question_type_check
  check (question_type in ('choice','written','matching'));
alter table public.assessment_questions add constraint assessment_questions_options_check
  check (
    case
      when question_type = 'choice' then jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 8
      when question_type in ('written','matching') then jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 0
      else false
    end
  );
alter table public.assessment_questions add constraint assessment_questions_correct_index_check
  check (
    (question_type = 'choice' and correct_index is not null and correct_index >= 0 and correct_index < jsonb_array_length(options))
    or (question_type in ('written','matching') and correct_index is null)
  );
alter table public.assessment_questions add constraint assessment_questions_type_payload_check
  check (
    (question_type = 'choice' and correct_text = '' and jsonb_typeof(match_pairs) = 'array' and jsonb_array_length(match_pairs) = 0)
    or (question_type = 'written' and length(trim(correct_text)) between 1 and 4000 and jsonb_typeof(match_pairs) = 'array' and jsonb_array_length(match_pairs) = 0)
    or (question_type = 'matching' and correct_text = '' and jsonb_typeof(match_pairs) = 'array' and jsonb_array_length(match_pairs) between 2 and 10)
  );

create or replace function public.save_assessment(_assessment_id uuid, _data jsonb, _questions jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := public.current_app_role();
  v_id uuid;
  v_existing public.assessments%rowtype;
  v_title text;
  v_description text;
  v_subject text;
  v_kind text;
  v_grade_min integer;
  v_grade_max integer;
  v_duration integer;
  v_difficulty text;
  v_q jsonb;
  v_options jsonb;
  v_pairs jsonb;
  v_prompt text;
  v_type text;
  v_correct integer;
  v_correct_text text;
  v_points integer;
  v_position integer := 0;
  v_pair jsonb;
begin
  if v_uid is null then raise exception 'Требуется войти в аккаунт.'; end if;
  if coalesce(v_role,'') not in ('teacher','admin') then raise exception 'Создавать задания могут только учителя.'; end if;
  if jsonb_typeof(_data) is distinct from 'object' or jsonb_typeof(_questions) is distinct from 'array' then
    raise exception 'Форма задания заполнена некорректно.';
  end if;

  v_title := trim(coalesce(_data ->> 'title',''));
  v_description := trim(coalesce(_data ->> 'description',''));
  v_subject := _data ->> 'subject';
  v_kind := _data ->> 'kind';
  v_grade_min := (_data ->> 'gradeMin')::integer;
  v_grade_max := (_data ->> 'gradeMax')::integer;
  v_duration := (_data ->> 'durationMinutes')::integer;
  v_difficulty := _data ->> 'difficulty';

  if length(v_title) < 3 or length(v_title) > 140 then raise exception 'Название должно содержать от 3 до 140 символов.'; end if;
  if length(v_description) > 4000 then raise exception 'Описание слишком длинное.'; end if;
  if v_subject not in ('Математика','Биология','Физика','История','Русский язык','Информатика','Химия','География','Английский язык') then raise exception 'Выбран неизвестный предмет.'; end if;
  if v_kind not in ('Олимпиада','Тест') then raise exception 'Выбран неизвестный тип задания.'; end if;
  if v_grade_min < 1 or v_grade_min > 11 or v_grade_max < v_grade_min or v_grade_max > 11 then raise exception 'Проверь диапазон классов.'; end if;
  if v_duration < 1 or v_duration > 300 then raise exception 'Продолжительность должна быть от 1 до 300 минут.'; end if;
  if v_difficulty not in ('Лёгкая','Средняя','Сложная') then raise exception 'Указана неизвестная сложность.'; end if;
  if jsonb_array_length(_questions) < 1 or jsonb_array_length(_questions) > 200 then raise exception 'Добавь от 1 до 200 вопросов.'; end if;

  if _assessment_id is null then
    insert into public.assessments(title, description, subject, kind, grade_min, grade_max, duration_minutes, difficulty, status, creator_id)
    values (v_title, v_description, v_subject, v_kind, v_grade_min, v_grade_max, v_duration, v_difficulty, 'draft', v_uid)
    returning id into v_id;
  else
    select * into v_existing from public.assessments where id = _assessment_id for update;
    if not found then raise exception 'Задание не найдено.'; end if;
    if coalesce(v_role,'') <> 'admin' and v_existing.creator_id <> v_uid then raise exception 'Нет доступа к этому заданию.'; end if;
    if v_role <> 'admin' and v_existing.status not in ('draft','rejected') then raise exception 'Редактировать можно только черновик или отклонённое задание.'; end if;
    update public.assessments set title=v_title, description=v_description, subject=v_subject, kind=v_kind,
      grade_min=v_grade_min, grade_max=v_grade_max, duration_minutes=v_duration, difficulty=v_difficulty,
      status='draft', reviewed_by=null, review_note=null, published_at=null
    where id = _assessment_id returning id into v_id;
    delete from public.assessment_questions where assessment_id = v_id;
  end if;

  for v_q in select value from jsonb_array_elements(_questions) loop
    v_position := v_position + 1;
    v_prompt := trim(coalesce(v_q ->> 'prompt',''));
    v_type := coalesce(v_q ->> 'type','choice');
    v_options := coalesce(v_q -> 'options','[]'::jsonb);
    v_pairs := coalesce(v_q -> 'pairs','[]'::jsonb);
    v_correct_text := trim(coalesce(v_q ->> 'correctText',''));
    v_correct := case when coalesce(v_q ->> 'correctIndex','') ~ '^[0-9]+$' then (v_q ->> 'correctIndex')::integer else null end;
    v_points := coalesce((v_q ->> 'points')::integer, 1);

    if length(v_prompt) < 3 or length(v_prompt) > 4000 then raise exception 'Вопрос №% должен содержать от 3 до 4000 символов.', v_position; end if;
    if v_type not in ('choice','written','matching') then raise exception 'В вопросе №% указан неизвестный тип.', v_position; end if;
    if v_points < 1 or v_points > 100 then raise exception 'Баллы в вопросе №% должны быть от 1 до 100.', v_position; end if;

    if v_type = 'choice' then
      if jsonb_typeof(v_options) is distinct from 'array' or jsonb_array_length(v_options) not between 2 and 8 then raise exception 'В вопросе №% должно быть от 2 до 8 вариантов.', v_position; end if;
      if exists (select 1 from jsonb_array_elements(v_options) as opt(value) where jsonb_typeof(opt.value) <> 'string' or length(trim(opt.value #>> '{}')) = 0 or length(opt.value #>> '{}') > 500) then raise exception 'Проверь варианты ответа в вопросе №%.', v_position; end if;
      if v_correct is null or v_correct < 0 or v_correct >= jsonb_array_length(v_options) then raise exception 'Выбери правильный вариант в вопросе №%.', v_position; end if;
      v_correct_text := '';
      v_pairs := '[]'::jsonb;
    elsif v_type = 'written' then
      if length(v_correct_text) < 1 or length(v_correct_text) > 4000 then raise exception 'Укажи эталонный письменный ответ в вопросе №%.', v_position; end if;
      v_options := '[]'::jsonb; v_correct := null; v_pairs := '[]'::jsonb;
    else
      if jsonb_typeof(v_pairs) is distinct from 'array' or jsonb_array_length(v_pairs) not between 2 and 10 then raise exception 'В вопросе №% должно быть от 2 до 10 пар.', v_position; end if;
      if exists (select 1 from jsonb_array_elements(v_pairs) as p(value) where jsonb_typeof(p.value) <> 'object' or length(trim(coalesce(p.value ->> 'left',''))) = 0 or length(trim(coalesce(p.value ->> 'left',''))) > 500 or length(trim(coalesce(p.value ->> 'right',''))) = 0 or length(trim(coalesce(p.value ->> 'right',''))) > 500) then raise exception 'Проверь элементы сопоставления в вопросе №%.', v_position; end if;
      if (select count(*) from jsonb_array_elements(v_pairs)) <> (select count(distinct lower(trim(p.value ->> 'right'))) from jsonb_array_elements(v_pairs) as p(value)) then raise exception 'Значения правой стороны в вопросе №% должны отличаться.', v_position; end if;
      v_options := '[]'::jsonb; v_correct := null; v_correct_text := '';
    end if;

    insert into public.assessment_questions(assessment_id, position, prompt, options, correct_index, explanation, points, question_type, correct_text, match_pairs)
    values (v_id, v_position, v_prompt, v_options, v_correct, left(trim(coalesce(v_q ->> 'explanation','')),4000), v_points, v_type, v_correct_text, v_pairs);
  end loop;
  return v_id;
end;
$$;

create or replace function public.start_assessment_attempt(_assessment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid(); v_role text := public.current_app_role(); v_profile public.profiles%rowtype;
  v_assessment public.assessments%rowtype; v_attempt public.attempts%rowtype; v_total_questions integer; v_max_score integer; v_questions jsonb;
begin
  if v_uid is null or coalesce(v_role,'') not in ('student','teacher','admin') then raise exception 'Требуется активный аккаунт.'; end if;
  select * into v_assessment from public.assessments where id=_assessment_id and status='published';
  if not found then raise exception 'Задание не опубликовано или больше недоступно.'; end if;
  select * into v_profile from public.profiles where id=v_uid;
  if v_role='student' and (v_profile.grade is null or v_profile.grade < v_assessment.grade_min or v_profile.grade > v_assessment.grade_max) then raise exception 'Это задание предназначено для классов %–%.', v_assessment.grade_min, v_assessment.grade_max; end if;
  select count(*), coalesce(sum(points),0) into v_total_questions, v_max_score from public.assessment_questions where assessment_id=_assessment_id;
  if v_total_questions < 1 then raise exception 'В задании пока нет вопросов.'; end if;
  insert into public.attempts(assessment_id,user_id,max_score) values(_assessment_id,v_uid,v_max_score) returning * into v_attempt;
  select jsonb_agg(jsonb_build_object(
    'id',q.id,'position',q.position,'prompt',q.prompt,'question_type',q.question_type,
    'options',case when q.question_type='choice' then q.options else '[]'::jsonb end,'points',q.points,
    'match_items',case when q.question_type='matching' then (select coalesce(jsonb_agg(p.value -> 'left' order by p.ordinality),'[]'::jsonb) from jsonb_array_elements(q.match_pairs) with ordinality p(value,ordinality)) else '[]'::jsonb end,
    'match_options',case when q.question_type='matching' then (select coalesce(jsonb_agg(p.value -> 'right' order by random()),'[]'::jsonb) from jsonb_array_elements(q.match_pairs) with ordinality p(value,ordinality)) else '[]'::jsonb end
  ) order by q.position) into v_questions from public.assessment_questions q where q.assessment_id=_assessment_id;
  return jsonb_build_object('attempt_id',v_attempt.id,'assessment_id',_assessment_id,'assessment_title',v_assessment.title,'kind',v_assessment.kind,
    'duration_minutes',v_assessment.duration_minutes,'started_at',v_attempt.started_at,'ends_at',v_attempt.started_at + make_interval(mins => v_assessment.duration_minutes),
    'questions',v_questions,'answers',v_attempt.answers);
end;
$$;

create or replace function public.resume_assessment_attempt(_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid(); v_attempt public.attempts%rowtype; v_assessment public.assessments%rowtype; v_questions jsonb;
begin
  if v_uid is null or coalesce(public.current_app_role(),'') not in ('student','teacher','admin') then raise exception 'Требуется активный аккаунт.'; end if;
  select * into v_attempt from public.attempts where id=_attempt_id and user_id=v_uid for update;
  if not found then raise exception 'Попытка не найдена.'; end if;
  if v_attempt.submitted_at is not null then raise exception 'Эта попытка уже завершена.'; end if;
  select * into v_assessment from public.assessments where id=v_attempt.assessment_id;
  select jsonb_agg(jsonb_build_object(
    'id',q.id,'position',q.position,'prompt',q.prompt,'question_type',q.question_type,
    'options',case when q.question_type='choice' then q.options else '[]'::jsonb end,'points',q.points,
    'match_items',case when q.question_type='matching' then (select coalesce(jsonb_agg(p.value -> 'left' order by p.ordinality),'[]'::jsonb) from jsonb_array_elements(q.match_pairs) with ordinality p(value,ordinality)) else '[]'::jsonb end,
    'match_options',case when q.question_type='matching' then (select coalesce(jsonb_agg(p.value -> 'right' order by random()),'[]'::jsonb) from jsonb_array_elements(q.match_pairs) with ordinality p(value,ordinality)) else '[]'::jsonb end
  ) order by q.position) into v_questions from public.assessment_questions q where q.assessment_id=v_attempt.assessment_id;
  return jsonb_build_object('attempt_id',v_attempt.id,'assessment_id',v_attempt.assessment_id,'assessment_title',v_assessment.title,'kind',v_assessment.kind,
    'duration_minutes',v_assessment.duration_minutes,'started_at',v_attempt.started_at,'ends_at',v_attempt.started_at + make_interval(mins => v_assessment.duration_minutes),
    'questions',v_questions,'answers',v_attempt.answers);
end;
$$;

create or replace function public.save_assessment_attempt_answers(_attempt_id uuid, _answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid(); v_attempt public.attempts%rowtype; v_duration integer; v_question record;
  v_answer jsonb; v_value jsonb; v_raw text; v_index integer; v_key text; v_text text; v_clean jsonb := '{}'::jsonb; v_clean_question jsonb; v_entry record;
begin
  if v_uid is null or coalesce(public.current_app_role(),'') not in ('student','teacher','admin') then raise exception 'Требуется активный аккаунт.'; end if;
  if jsonb_typeof(_answers) <> 'object' then raise exception 'Ответы имеют неверный формат.'; end if;
  select * into v_attempt from public.attempts where id=_attempt_id and user_id=v_uid for update;
  if not found then raise exception 'Попытка не найдена.'; end if;
  if v_attempt.submitted_at is not null then raise exception 'Попытка уже завершена.'; end if;
  select duration_minutes into v_duration from public.assessments where id=v_attempt.assessment_id;
  if now() > v_attempt.started_at + make_interval(mins => v_duration) then raise exception 'Время на выполнение закончилось.'; end if;
  for v_question in select id, question_type, options, match_pairs from public.assessment_questions where assessment_id=v_attempt.assessment_id loop
    v_answer := _answers -> v_question.id::text;
    if v_question.question_type='choice' then
      v_raw := v_answer #>> '{}';
      if v_raw ~ '^[0-9]+$' then v_index := v_raw::integer; if v_index >= 0 and v_index < jsonb_array_length(v_question.options) then v_clean := v_clean || jsonb_build_object(v_question.id::text,v_index); end if; end if;
    elsif v_question.question_type='written' then
      if jsonb_typeof(v_answer)='string' then v_text := left(trim(v_answer #>> '{}'),4000); if v_text <> '' then v_clean := v_clean || jsonb_build_object(v_question.id::text,v_text); end if; end if;
    elsif v_question.question_type='matching' and jsonb_typeof(v_answer)='object' then
      v_clean_question := '{}'::jsonb;
      for v_entry in select key,value from jsonb_each(v_answer) loop
        if v_entry.key ~ '^[0-9]+$' and jsonb_typeof(v_entry.value)='string' then
          v_index := v_entry.key::integer; v_text := v_entry.value #>> '{}';
          if v_index >= 0 and v_index < jsonb_array_length(v_question.match_pairs) and exists (select 1 from jsonb_array_elements(v_question.match_pairs) as p(value) where p.value ->> 'right' = v_text) then v_clean_question := v_clean_question || jsonb_build_object(v_entry.key,v_text); end if;
        end if;
      end loop;
      if v_clean_question <> '{}'::jsonb then v_clean := v_clean || jsonb_build_object(v_question.id::text,v_clean_question); end if;
    end if;
  end loop;
  update public.attempts set answers=v_clean where id=_attempt_id;
end;
$$;

create or replace function public.submit_assessment_attempt(_attempt_id uuid, _answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid(); v_attempt public.attempts%rowtype; v_duration integer; v_question record; v_pair record; v_entry record;
  v_answer jsonb; v_clean jsonb := '{}'::jsonb; v_clean_question jsonb; v_raw text; v_index integer; v_text text; v_key text;
  v_score integer := 0; v_earned integer; v_correct_count integer; v_state text;
begin
  if v_uid is null or coalesce(public.current_app_role(),'') not in ('student','teacher','admin') then raise exception 'Требуется активный аккаунт.'; end if;
  if jsonb_typeof(_answers) <> 'object' then raise exception 'Ответы имеют неверный формат.'; end if;
  select * into v_attempt from public.attempts where id=_attempt_id and user_id=v_uid for update;
  if not found then raise exception 'Попытка не найдена.'; end if;
  if v_attempt.submitted_at is not null then raise exception 'Эта попытка уже была отправлена.'; end if;
  select duration_minutes into v_duration from public.assessments where id=v_attempt.assessment_id;
  v_state := case when now() > v_attempt.started_at + make_interval(mins => v_duration) then 'timed_out' else 'submitted' end;

  for v_question in select id, question_type, options, correct_index, correct_text, match_pairs, points from public.assessment_questions where assessment_id=v_attempt.assessment_id loop
    v_answer := _answers -> v_question.id::text;
    if v_question.question_type='choice' then
      v_raw := v_answer #>> '{}';
      if v_raw ~ '^[0-9]+$' then
        v_index := v_raw::integer;
        if v_index >= 0 and v_index < jsonb_array_length(v_question.options) then
          v_clean := v_clean || jsonb_build_object(v_question.id::text,v_index);
          if v_index = v_question.correct_index then v_score := v_score + v_question.points; end if;
        end if;
      end if;
    elsif v_question.question_type='written' then
      if jsonb_typeof(v_answer)='string' then
        v_text := left(trim(v_answer #>> '{}'),4000);
        if v_text <> '' then
          v_clean := v_clean || jsonb_build_object(v_question.id::text,v_text);
          if lower(regexp_replace(v_text,'[[:space:]]+',' ','g')) = lower(regexp_replace(trim(v_question.correct_text),'[[:space:]]+',' ','g')) then v_score := v_score + v_question.points; end if;
        end if;
      end if;
    elsif v_question.question_type='matching' and jsonb_typeof(v_answer)='object' then
      v_clean_question := '{}'::jsonb; v_correct_count := 0;
      for v_pair in select value, ordinality from jsonb_array_elements(v_question.match_pairs) with ordinality loop
        v_raw := v_answer ->> ((v_pair.ordinality - 1)::text);
        if v_raw is not null and exists (select 1 from jsonb_array_elements(v_question.match_pairs) as p(value) where p.value ->> 'right' = v_raw) then
          v_clean_question := v_clean_question || jsonb_build_object((v_pair.ordinality - 1)::text,v_raw);
          if v_raw = (v_pair.value ->> 'right') then v_correct_count := v_correct_count + 1; end if;
        end if;
      end loop;
      if v_clean_question <> '{}'::jsonb then v_clean := v_clean || jsonb_build_object(v_question.id::text,v_clean_question); end if;
      if jsonb_array_length(v_question.match_pairs) > 0 then v_score := v_score + floor(v_question.points::numeric * v_correct_count / jsonb_array_length(v_question.match_pairs))::integer; end if;
    end if;
  end loop;

  update public.attempts set answers=v_clean, score=v_score, state=v_state, submitted_at=now() where id=_attempt_id;
  return jsonb_build_object('attempt_id',_attempt_id,'score',v_score,'max_score',v_attempt.max_score,'state',v_state,'submitted_at',now());
end;
$$;

create or replace function public.get_attempt_review(_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid(); v_attempt public.attempts%rowtype; v_assessment public.assessments%rowtype; v_role text := public.current_app_role();
  v_question record; v_pair record; v_questions jsonb := '[]'::jsonb; v_answer jsonb; v_chosen_index integer; v_earned integer; v_correct_count integer; v_is_correct boolean;
begin
  if v_uid is null or coalesce(v_role,'') not in ('student','teacher','admin') then raise exception 'Требуется активный аккаунт.'; end if;
  select * into v_attempt from public.attempts where id=_attempt_id;
  if not found then raise exception 'Результат не найден.'; end if;
  select * into v_assessment from public.assessments where id=v_attempt.assessment_id;
  if v_attempt.user_id <> v_uid and coalesce(v_role,'') <> 'admin' and not (v_role='teacher' and v_assessment.creator_id=v_uid) then raise exception 'Нет доступа к этому результату.'; end if;
  if v_attempt.submitted_at is null then raise exception 'Результат ещё не завершён.'; end if;
  for v_question in select * from public.assessment_questions where assessment_id=v_attempt.assessment_id order by position loop
    v_answer := v_attempt.answers -> v_question.id::text; v_chosen_index := null; v_earned := 0; v_correct_count := 0; v_is_correct := false;
    if v_question.question_type='choice' then
      if (v_answer #>> '{}') ~ '^[0-9]+$' then v_chosen_index := (v_answer #>> '{}')::integer; if v_chosen_index = v_question.correct_index then v_earned := v_question.points; v_is_correct := true; end if; end if;
    elsif v_question.question_type='written' then
      if jsonb_typeof(v_answer)='string' and lower(regexp_replace(trim(v_answer #>> '{}'),'[[:space:]]+',' ','g')) = lower(regexp_replace(trim(v_question.correct_text),'[[:space:]]+',' ','g')) then v_earned := v_question.points; v_is_correct := true; end if;
    elsif v_question.question_type='matching' then
      for v_pair in select value, ordinality from jsonb_array_elements(v_question.match_pairs) with ordinality loop
        if (v_answer ->> ((v_pair.ordinality - 1)::text)) = (v_pair.value ->> 'right') then v_correct_count := v_correct_count + 1; end if;
      end loop;
      if jsonb_array_length(v_question.match_pairs)>0 then v_earned := floor(v_question.points::numeric * v_correct_count / jsonb_array_length(v_question.match_pairs))::integer; v_is_correct := v_correct_count = jsonb_array_length(v_question.match_pairs); end if;
    end if;
    v_questions := v_questions || jsonb_build_array(jsonb_build_object(
      'id',v_question.id,'position',v_question.position,'prompt',v_question.prompt,'question_type',v_question.question_type,'options',v_question.options,
      'chosen_index',v_chosen_index,'chosen_answer',v_answer,'correct_index',v_question.correct_index,'correct_text',v_question.correct_text,
      'match_pairs',v_question.match_pairs,'explanation',v_question.explanation,'points',v_question.points,'earned_points',v_earned,'is_correct',v_is_correct
    ));
  end loop;
  return jsonb_build_object('attempt_id',v_attempt.id,'assessment_id',v_assessment.id,'assessment_title',v_assessment.title,
    'subject',v_assessment.subject,'kind',v_assessment.kind,'score',v_attempt.score,'max_score',v_attempt.max_score,
    'state',v_attempt.state,'started_at',v_attempt.started_at,'submitted_at',v_attempt.submitted_at,'questions',v_questions);
end;
$$;

revoke all on function public.save_assessment(uuid,jsonb,jsonb) from public;
grant execute on function public.save_assessment(uuid,jsonb,jsonb) to authenticated;
revoke all on function public.start_assessment_attempt(uuid) from public;
grant execute on function public.start_assessment_attempt(uuid) to authenticated;
revoke all on function public.resume_assessment_attempt(uuid) from public;
grant execute on function public.resume_assessment_attempt(uuid) to authenticated;
revoke all on function public.save_assessment_attempt_answers(uuid,jsonb) from public;
grant execute on function public.save_assessment_attempt_answers(uuid,jsonb) to authenticated;
revoke all on function public.submit_assessment_attempt(uuid,jsonb) from public;
grant execute on function public.submit_assessment_attempt(uuid,jsonb) to authenticated;
revoke all on function public.get_attempt_review(uuid) from public;
grant execute on function public.get_attempt_review(uuid) to authenticated;
