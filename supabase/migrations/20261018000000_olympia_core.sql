-- Olympia — production-oriented schema
-- Run in Supabase SQL Editor with a project-owner account.
-- This migration does not create fake students, rankings, assessments or results.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Ученик',
  grade smallint check (grade is null or grade between 1 and 11),
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 3 and 140),
  description text not null default '' check (length(description) <= 4000),
  subject text not null check (subject in ('Математика','Биология','Физика','История','Русский язык','Информатика','Химия','География','Английский язык')),
  kind text not null check (kind in ('Олимпиада','Тест')),
  grade_min smallint not null check (grade_min between 1 and 11),
  grade_max smallint not null check (grade_max between 1 and 11 and grade_max >= grade_min),
  duration_minutes smallint not null check (duration_minutes between 1 and 300),
  difficulty text not null check (difficulty in ('Лёгкая','Средняя','Сложная')),
  status text not null default 'draft' check (status in ('draft','pending','published','rejected','archived')),
  creator_id uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_note text check (review_note is null or length(review_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint assessment_grade_range check (grade_min <= grade_max)
);

create table if not exists public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  position integer not null check (position between 1 and 200),
  prompt text not null check (length(trim(prompt)) between 3 and 4000),
  options jsonb not null check (case when jsonb_typeof(options) = 'array' then jsonb_array_length(options) between 2 and 8 else false end),
  correct_index smallint not null check (case when jsonb_typeof(options) = 'array' then correct_index >= 0 and correct_index < jsonb_array_length(options) else false end),
  explanation text not null default '' check (length(explanation) <= 4000),
  points smallint not null default 1 check (points between 1 and 100),
  created_at timestamptz not null default now(),
  unique (assessment_id, position)
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  state text not null default 'in_progress' check (state in ('in_progress','submitted','timed_out')),
  score integer,
  max_score integer not null check (max_score >= 0),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  created_at timestamptz not null default now(),
  constraint attempt_submission_state check (
    (submitted_at is null and state = 'in_progress' and score is null)
    or (submitted_at is not null and state in ('submitted','timed_out') and score is not null)
  )
);

create table if not exists public.teacher_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (subject in ('Математика','Биология','Физика','История','Русский язык','Информатика','Химия','География','Английский язык')),
  experience text not null check (length(trim(experience)) between 20 and 2500),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_note text check (reviewer_note is null or length(reviewer_note) <= 2000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create unique index if not exists teacher_applications_one_pending_per_user
  on public.teacher_applications(user_id) where status = 'pending';
create index if not exists assessments_status_created_idx on public.assessments(status, created_at desc);
create index if not exists assessments_creator_created_idx on public.assessments(creator_id, created_at desc);
create index if not exists questions_assessment_position_idx on public.assessment_questions(assessment_id, position);
create index if not exists attempts_user_submitted_idx on public.attempts(user_id, submitted_at desc);
create index if not exists attempts_assessment_submitted_idx on public.attempts(assessment_id, submitted_at desc);
create index if not exists teacher_applications_status_created_idx on public.teacher_applications(status, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists assessments_set_updated_at on public.assessments;
create trigger assessments_set_updated_at before update on public.assessments
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_grade smallint;
begin
  v_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Ученик');
  if coalesce(new.raw_user_meta_data ->> 'grade', '') ~ '^(1[01]|[1-9])$' then
    v_grade := (new.raw_user_meta_data ->> 'grade')::smallint;
  else
    v_grade := null;
  end if;
  insert into public.profiles(id, display_name, grade, role)
  values (new.id, left(v_name, 100), v_grade, 'student')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.is_active
$$;

create or replace function public.save_assessment(
  _assessment_id uuid,
  _data jsonb,
  _questions jsonb
)
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
  v_prompt text;
  v_correct integer;
  v_points integer;
  v_position integer := 0;
  v_count integer := 0;
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
    v_options := v_q -> 'options';
    v_correct := (v_q ->> 'correctIndex')::integer;
    v_points := coalesce((v_q ->> 'points')::integer, 1);
    if length(v_prompt) < 3 or length(v_prompt) > 4000 then raise exception 'Вопрос №% должен содержать от 3 до 4000 символов.', v_position; end if;
    if jsonb_typeof(v_options) is distinct from 'array' then raise exception 'В вопросе №% должен содержать список вариантов.', v_position; end if;
    if jsonb_array_length(v_options) < 2 or jsonb_array_length(v_options) > 8 then raise exception 'В вопросе №% должно быть от 2 до 8 вариантов.', v_position; end if;
    if exists (select 1 from jsonb_array_elements(v_options) as opt(value) where jsonb_typeof(opt.value) <> 'string' or length(trim(opt.value #>> '{}')) = 0 or length(opt.value #>> '{}') > 500) then
      raise exception 'Проверь варианты ответа в вопросе №%.', v_position;
    end if;
    if v_correct < 0 or v_correct >= jsonb_array_length(v_options) then raise exception 'Выбери правильный ответ в вопросе №%.', v_position; end if;
    if v_points < 1 or v_points > 100 then raise exception 'Баллы в вопросе №% должны быть от 1 до 100.', v_position; end if;
    insert into public.assessment_questions(assessment_id, position, prompt, options, correct_index, explanation, points)
    values (v_id, v_position, v_prompt, v_options, v_correct, left(trim(coalesce(v_q ->> 'explanation','')),4000), v_points);
    v_count := v_count + 1;
  end loop;
  return v_id;
end;
$$;

create or replace function public.submit_assessment_for_review(_assessment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := public.current_app_role();
  v_assessment public.assessments%rowtype;
begin
  if v_uid is null then raise exception 'Требуется войти в аккаунт.'; end if;
  if coalesce(v_role,'') not in ('teacher','admin') then raise exception 'Недостаточно прав.'; end if;
  select * into v_assessment from public.assessments where id = _assessment_id for update;
  if not found then raise exception 'Задание не найдено.'; end if;
  if coalesce(v_role,'') <> 'admin' and v_assessment.creator_id <> v_uid then raise exception 'Нет доступа к этому заданию.'; end if;
  if v_assessment.status not in ('draft','rejected') then raise exception 'Это задание нельзя отправить на проверку.'; end if;
  if not exists (select 1 from public.assessment_questions q where q.assessment_id = _assessment_id) then raise exception 'Добавь хотя бы один вопрос.'; end if;
  update public.assessments set status='pending', review_note=null, reviewed_by=null where id = _assessment_id;
end;
$$;

create or replace function public.moderate_assessment(_assessment_id uuid, _decision text, _note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_app_role();
begin
  if auth.uid() is null or coalesce(v_role,'') <> 'admin' then raise exception 'Только администратор может проверять задания.'; end if;
  if _decision not in ('published','rejected','archived') then raise exception 'Неизвестное решение модерации.'; end if;
  if _note is not null and length(_note) > 2000 then raise exception 'Комментарий слишком длинный.'; end if;
  update public.assessments set status=_decision, reviewed_by=auth.uid(), review_note=nullif(trim(coalesce(_note,'')),''),
    published_at=case when _decision='published' then now() else null end
  where id=_assessment_id and (_decision <> 'published' or exists (select 1 from public.assessment_questions q where q.assessment_id=_assessment_id));
  if not found then raise exception 'Задание не найдено или в нём нет вопросов.'; end if;
end;
$$;

create or replace function public.apply_for_teacher(_subject text, _experience text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := public.current_app_role();
  v_id uuid;
begin
  if v_uid is null then raise exception 'Войди в аккаунт, чтобы отправить заявку.'; end if;
  if coalesce(v_role,'') <> 'student' then raise exception 'Подавать заявку могут только аккаунты учеников.'; end if;
  if _subject not in ('Математика','Биология','Физика','История','Русский язык','Информатика','Химия','География','Английский язык') then raise exception 'Выбери предмет.'; end if;
  if length(trim(coalesce(_experience,''))) < 20 or length(_experience) > 2500 then raise exception 'Расскажи об опыте в 20–2500 символах.'; end if;
  if exists(select 1 from public.teacher_applications where user_id=v_uid and status='pending') then raise exception 'У тебя уже есть заявка на рассмотрении.'; end if;
  insert into public.teacher_applications(user_id, subject, experience) values(v_uid,_subject,trim(_experience)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.review_teacher_application(_application_id uuid, _decision text, _note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_app_role();
  v_application public.teacher_applications%rowtype;
begin
  if auth.uid() is null or coalesce(v_role,'') <> 'admin' then raise exception 'Только администратор может проверять заявки.'; end if;
  if _decision not in ('approved','rejected') then raise exception 'Неизвестное решение.'; end if;
  if _note is not null and length(_note)>2000 then raise exception 'Комментарий слишком длинный.'; end if;
  select * into v_application from public.teacher_applications where id=_application_id for update;
  if not found or v_application.status <> 'pending' then raise exception 'Заявка не найдена или уже рассмотрена.'; end if;
  update public.teacher_applications set status=_decision, reviewer_id=auth.uid(), reviewer_note=nullif(trim(coalesce(_note,'')),''), reviewed_at=now() where id=_application_id;
  if _decision='approved' then update public.profiles set role='teacher' where id=v_application.user_id; end if;
end;
$$;

create or replace function public.start_assessment_attempt(_assessment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := public.current_app_role();
  v_profile public.profiles%rowtype;
  v_assessment public.assessments%rowtype;
  v_attempt public.attempts%rowtype;
  v_total_questions integer;
  v_max_score integer;
  v_questions jsonb;
begin
  if v_uid is null or coalesce(v_role,'') not in ('student','teacher','admin') then raise exception 'Требуется активный аккаунт.'; end if;
  select * into v_assessment from public.assessments where id=_assessment_id and status='published';
  if not found then raise exception 'Задание не опубликовано или больше недоступно.'; end if;
  select * into v_profile from public.profiles where id=v_uid;
  if v_role='student' and (v_profile.grade is null or v_profile.grade < v_assessment.grade_min or v_profile.grade > v_assessment.grade_max) then
    raise exception 'Это задание предназначено для классов %–%.', v_assessment.grade_min, v_assessment.grade_max;
  end if;
  select count(*), coalesce(sum(points),0) into v_total_questions, v_max_score from public.assessment_questions where assessment_id=_assessment_id;
  if v_total_questions < 1 then raise exception 'В задании пока нет вопросов.'; end if;
  insert into public.attempts(assessment_id,user_id,max_score) values(_assessment_id,v_uid,v_max_score) returning * into v_attempt;
  select jsonb_agg(jsonb_build_object('id',q.id,'position',q.position,'prompt',q.prompt,'options',q.options,'points',q.points) order by q.position)
    into v_questions from public.assessment_questions q where q.assessment_id=_assessment_id;
  return jsonb_build_object('attempt_id',v_attempt.id,'assessment_id',_assessment_id,'assessment_title',v_assessment.title,
    'duration_minutes',v_assessment.duration_minutes,'started_at',v_attempt.started_at,
    'ends_at',v_attempt.started_at + make_interval(mins => v_assessment.duration_minutes),
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
  v_uid uuid := auth.uid();
  v_attempt public.attempts%rowtype;
  v_assessment public.assessments%rowtype;
  v_questions jsonb;
begin
  if v_uid is null or coalesce(public.current_app_role(),'') not in ('student','teacher','admin') then raise exception 'Требуется активный аккаунт.'; end if;
  select * into v_attempt from public.attempts where id=_attempt_id and user_id=v_uid for update;
  if not found then raise exception 'Попытка не найдена.'; end if;
  if v_attempt.submitted_at is not null then raise exception 'Эта попытка уже завершена.'; end if;
  select * into v_assessment from public.assessments where id=v_attempt.assessment_id;
  select jsonb_agg(jsonb_build_object('id',q.id,'position',q.position,'prompt',q.prompt,'options',q.options,'points',q.points) order by q.position)
    into v_questions from public.assessment_questions q where q.assessment_id=v_attempt.assessment_id;
  return jsonb_build_object('attempt_id',v_attempt.id,'assessment_id',v_attempt.assessment_id,'assessment_title',v_assessment.title,
    'duration_minutes',v_assessment.duration_minutes,'started_at',v_attempt.started_at,
    'ends_at',v_attempt.started_at + make_interval(mins => v_assessment.duration_minutes),
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
  v_uid uuid := auth.uid();
  v_attempt public.attempts%rowtype;
  v_duration integer;
  v_question record;
  v_raw text;
  v_index integer;
  v_clean jsonb := '{}'::jsonb;
begin
  if v_uid is null or coalesce(public.current_app_role(),'') not in ('student','teacher','admin') then raise exception 'Требуется активный аккаунт.'; end if;
  if jsonb_typeof(_answers) <> 'object' then raise exception 'Ответы имеют неверный формат.'; end if;
  select * into v_attempt from public.attempts where id=_attempt_id and user_id=v_uid for update;
  if not found then raise exception 'Попытка не найдена.'; end if;
  if v_attempt.submitted_at is not null then raise exception 'Попытка уже завершена.'; end if;
  select duration_minutes into v_duration from public.assessments where id=v_attempt.assessment_id;
  if now() > v_attempt.started_at + make_interval(mins => v_duration) then raise exception 'Время на выполнение закончилось.'; end if;
  for v_question in select id, options from public.assessment_questions where assessment_id=v_attempt.assessment_id loop
    v_raw := _answers ->> v_question.id::text;
    if v_raw ~ '^[0-9]+$' then
      v_index := v_raw::integer;
      if v_index >= 0 and v_index < jsonb_array_length(v_question.options) then
        v_clean := v_clean || jsonb_build_object(v_question.id::text,v_index);
      end if;
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
  v_uid uuid := auth.uid();
  v_attempt public.attempts%rowtype;
  v_duration integer;
  v_question record;
  v_raw text;
  v_index integer;
  v_clean jsonb := '{}'::jsonb;
  v_score integer := 0;
  v_state text;
begin
  if v_uid is null or coalesce(public.current_app_role(),'') not in ('student','teacher','admin') then raise exception 'Требуется активный аккаунт.'; end if;
  if jsonb_typeof(_answers) <> 'object' then raise exception 'Ответы имеют неверный формат.'; end if;
  select * into v_attempt from public.attempts where id=_attempt_id and user_id=v_uid for update;
  if not found then raise exception 'Попытка не найдена.'; end if;
  if v_attempt.submitted_at is not null then raise exception 'Эта попытка уже была отправлена.'; end if;
  select duration_minutes into v_duration from public.assessments where id=v_attempt.assessment_id;
  v_state := case when now() > v_attempt.started_at + make_interval(mins => v_duration) then 'timed_out' else 'submitted' end;
  for v_question in select id, options, correct_index, points from public.assessment_questions where assessment_id=v_attempt.assessment_id loop
    v_raw := _answers ->> v_question.id::text;
    if v_raw ~ '^[0-9]+$' then
      v_index := v_raw::integer;
      if v_index >= 0 and v_index < jsonb_array_length(v_question.options) then
        v_clean := v_clean || jsonb_build_object(v_question.id::text,v_index);
        if v_index = v_question.correct_index then v_score := v_score + v_question.points; end if;
      end if;
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
  v_uid uuid := auth.uid();
  v_attempt public.attempts%rowtype;
  v_assessment public.assessments%rowtype;
  v_role text := public.current_app_role();
  v_questions jsonb;
begin
  if v_uid is null or coalesce(v_role,'') not in ('student','teacher','admin') then raise exception 'Требуется активный аккаунт.'; end if;
  select * into v_attempt from public.attempts where id=_attempt_id;
  if not found then raise exception 'Результат не найден.'; end if;
  select * into v_assessment from public.assessments where id=v_attempt.assessment_id;
  if v_attempt.user_id <> v_uid and coalesce(v_role,'') <> 'admin' and not (v_role='teacher' and v_assessment.creator_id=v_uid) then
    raise exception 'Нет доступа к этому результату.';
  end if;
  if v_attempt.submitted_at is null then raise exception 'Результат ещё не завершён.'; end if;
  select jsonb_agg(jsonb_build_object(
    'id',q.id,'position',q.position,'prompt',q.prompt,'options',q.options,
    'chosen_index',case when (v_attempt.answers ->> q.id::text) ~ '^[0-9]+$' then (v_attempt.answers ->> q.id::text)::integer else null end,
    'correct_index',q.correct_index,'explanation',q.explanation,'points',q.points,
    'earned_points',case when (v_attempt.answers ->> q.id::text) ~ '^[0-9]+$' and (v_attempt.answers ->> q.id::text)::integer=q.correct_index then q.points else 0 end
  ) order by q.position) into v_questions
  from public.assessment_questions q where q.assessment_id=v_attempt.assessment_id;
  return jsonb_build_object('attempt_id',v_attempt.id,'assessment_id',v_assessment.id,'assessment_title',v_assessment.title,
    'subject',v_assessment.subject,'kind',v_assessment.kind,'score',v_attempt.score,'max_score',v_attempt.max_score,
    'state',v_attempt.state,'started_at',v_attempt.started_at,'submitted_at',v_attempt.submitted_at,'questions',coalesce(v_questions,'[]'::jsonb));
end;
$$;

create or replace function public.set_user_active(_user_id uuid, _is_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or coalesce(public.current_app_role(),'') <> 'admin' then raise exception 'Только администратор может менять статус аккаунта.'; end if;
  if _user_id = auth.uid() then raise exception 'Нельзя заблокировать свой собственный аккаунт.'; end if;
  if exists (select 1 from public.profiles p where p.id=_user_id and p.role='admin') then raise exception 'Статус администратора нельзя менять из этой панели.'; end if;
  update public.profiles set is_active=_is_active where id=_user_id;
  if not found then raise exception 'Пользователь не найден.'; end if;
end;
$$;

create or replace function public.get_my_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_completed bigint;
  v_points bigint;
  v_unique bigint;
  v_average numeric;
begin
  if v_uid is null or coalesce(public.current_app_role(),'') not in ('student','teacher','admin') then raise exception 'Требуется активный аккаунт.'; end if;
  select count(*)::bigint,
         coalesce(sum(a.score),0)::bigint,
         count(distinct a.assessment_id)::bigint,
         coalesce(round(avg(100.0 * a.score / nullif(a.max_score,0)),1),0)
    into v_completed, v_points, v_unique, v_average
    from public.attempts a
   where a.user_id=v_uid and a.submitted_at is not null;
  return jsonb_build_object('completed_attempts',v_completed,'total_points',v_points,
    'unique_assessments',v_unique,'average_percent',v_average);
end;
$$;

create or replace function public.get_leaderboard()
returns table(display_name text, grade smallint, total_points bigint, completed_attempts bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.display_name, p.grade, coalesce(sum(a.score),0)::bigint as total_points, count(a.id)::bigint as completed_attempts
  from public.profiles p
  join public.attempts a on a.user_id=p.id and a.submitted_at is not null
  where p.is_active
  group by p.id, p.display_name, p.grade
  order by coalesce(sum(a.score),0) desc, count(a.id) desc, p.display_name asc
  limit 100
$$;

-- Row Level Security: all browser-accessible tables are read-only. Writes happen in
-- authenticated database functions, which validate the user, role, owner and state.
alter table public.profiles enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.attempts enable row level security;
alter table public.teacher_applications enable row level security;

drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles for select to authenticated
  using (id=(select auth.uid()) or (select public.current_app_role())='admin');
drop policy if exists profiles_read_teacher_participants on public.profiles;
create policy profiles_read_teacher_participants on public.profiles for select to authenticated
  using ((select public.current_app_role())='teacher' and exists (
    select 1 from public.attempts att join public.assessments a on a.id=att.assessment_id
    where att.user_id=profiles.id and a.creator_id=(select auth.uid())
  ));
drop policy if exists assessments_read_published_owner_admin on public.assessments;
create policy assessments_read_published_owner_admin on public.assessments for select to anon, authenticated
  using (status='published' or creator_id=(select auth.uid()) or (select public.current_app_role())='admin');
drop policy if exists questions_read_creator_admin on public.assessment_questions;
create policy questions_read_creator_admin on public.assessment_questions for select to authenticated
  using (exists (select 1 from public.assessments a where a.id=assessment_id and (a.creator_id=(select auth.uid()) or (select public.current_app_role())='admin')));
drop policy if exists attempts_read_owner_teacher_admin on public.attempts;
create policy attempts_read_owner_teacher_admin on public.attempts for select to authenticated
  using (user_id=(select auth.uid()) or (select public.current_app_role())='admin' or exists (
    select 1 from public.assessments a where a.id=assessment_id and a.creator_id=(select auth.uid())
  ));
drop policy if exists teacher_applications_read_owner_admin on public.teacher_applications;
create policy teacher_applications_read_owner_admin on public.teacher_applications for select to authenticated
  using (user_id=(select auth.uid()) or (select public.current_app_role())='admin');

revoke all on public.profiles, public.assessments, public.assessment_questions, public.attempts, public.teacher_applications from anon, authenticated;
grant select on public.assessments to anon, authenticated;
grant select on public.profiles, public.assessment_questions, public.attempts, public.teacher_applications to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to anon, authenticated;
revoke all on function public.save_assessment(uuid,jsonb,jsonb) from public;
grant execute on function public.save_assessment(uuid,jsonb,jsonb) to authenticated;
revoke all on function public.submit_assessment_for_review(uuid) from public;
grant execute on function public.submit_assessment_for_review(uuid) to authenticated;
revoke all on function public.moderate_assessment(uuid,text,text) from public;
grant execute on function public.moderate_assessment(uuid,text,text) to authenticated;
revoke all on function public.apply_for_teacher(text,text) from public;
grant execute on function public.apply_for_teacher(text,text) to authenticated;
revoke all on function public.review_teacher_application(uuid,text,text) from public;
grant execute on function public.review_teacher_application(uuid,text,text) to authenticated;
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
revoke all on function public.get_leaderboard() from public;
grant execute on function public.get_leaderboard() to anon, authenticated;
revoke all on function public.get_my_dashboard_stats() from public;
grant execute on function public.get_my_dashboard_stats() to authenticated;
revoke all on function public.set_user_active(uuid,boolean) from public;
grant execute on function public.set_user_active(uuid,boolean) to authenticated;

-- After registering your own account, make exactly that account administrator in SQL Editor:
-- update public.profiles set role='admin' where id=(select id from auth.users where email='YOUR_EMAIL');
