-- Olympia management controls. Run once in Supabase SQL Editor.
create or replace function public.manage_assessment_delete(_assessment_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_role text; v_creator uuid;
begin
  if auth.uid() is null then raise exception 'Требуется вход в аккаунт'; end if;
  select role into v_role from public.profiles where id=auth.uid();
  select creator_id into v_creator from public.assessments where id=_assessment_id;
  if v_creator is null then raise exception 'Задание не найдено'; end if;
  if v_role <> 'admin' and not (v_role='teacher' and v_creator=auth.uid()) then raise exception 'Недостаточно прав'; end if;
  delete from public.attempts where assessment_id=_assessment_id;
  delete from public.assessments where id=_assessment_id;
end; $$;

create or replace function public.admin_update_attempt_score(_attempt_id uuid, _score integer)
returns void language plpgsql security definer set search_path = public
as $$
declare v_role text; v_max integer;
begin
  select role into v_role from public.profiles where id=auth.uid();
  if auth.uid() is null or v_role <> 'admin' then raise exception 'Только администратор может менять баллы'; end if;
  select max_score into v_max from public.attempts where id=_attempt_id and submitted_at is not null for update;
  if v_max is null then raise exception 'Завершённый результат не найден'; end if;
  if _score < 0 or _score > v_max then raise exception 'Баллы должны быть от 0 до %', v_max; end if;
  update public.attempts set score=_score where id=_attempt_id;
end; $$;

create or replace function public.admin_delete_attempt(_attempt_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_role text;
begin
  select role into v_role from public.profiles where id=auth.uid();
  if auth.uid() is null or v_role <> 'admin' then raise exception 'Только администратор может удалять результаты'; end if;
  delete from public.attempts where id=_attempt_id and submitted_at is not null;
end; $$;

create or replace function public.admin_clear_leaderboard()
returns integer language plpgsql security definer set search_path = public
as $$
declare v_role text; v_count integer;
begin
  select role into v_role from public.profiles where id=auth.uid();
  if auth.uid() is null or v_role <> 'admin' then raise exception 'Только администратор может очищать рейтинг'; end if;
  delete from public.attempts where submitted_at is not null;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

revoke all on function public.manage_assessment_delete(uuid) from public;
revoke all on function public.admin_update_attempt_score(uuid, integer) from public;
revoke all on function public.admin_delete_attempt(uuid) from public;
revoke all on function public.admin_clear_leaderboard() from public;
grant execute on function public.manage_assessment_delete(uuid) to authenticated;
grant execute on function public.admin_update_attempt_score(uuid, integer) to authenticated;
grant execute on function public.admin_delete_attempt(uuid) to authenticated;
grant execute on function public.admin_clear_leaderboard() to authenticated;
