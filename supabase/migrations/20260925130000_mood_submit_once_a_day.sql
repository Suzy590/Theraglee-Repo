-- The Mood tab's factors are now sent with a Submit button, which only works
-- once every factor and the weather are answered. Once a day's check-in is
-- submitted it is final: the member can check in again the next day, on a new
-- row. submitted_at records when, and the trigger below refuses any later
-- change to that day's mood, factors, weather or submitted_at, whichever page
-- or session it comes from. The note on the Goals & tracking page stays
-- editable. docs/mood.md is the guide.

alter table public.mood_logs
  add column if not exists submitted_at timestamptz;

comment on column public.mood_logs.submitted_at is
  'When the member submitted the day''s check-in on the Mood tab. After this the day''s mood, factors and weather are final.';

create or replace function public.mood_logs_lock_submitted()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.submitted_at is not null and (
       new.mood         is distinct from old.mood
    or new.sleep        is distinct from old.sleep
    or new.home_stress  is distinct from old.home_stress
    or new.work_stress  is distinct from old.work_stress
    or new.nutrition    is distinct from old.nutrition
    or new.hunger       is distinct from old.hunger
    or new.loneliness   is distinct from old.loneliness
    or new.thoughts     is distinct from old.thoughts
    or new.activity     is distinct from old.activity
    or new.social       is distinct from old.social
    or new.weather      is distinct from old.weather
    or new.submitted_at is distinct from old.submitted_at
    or new.logged_on    is distinct from old.logged_on
  ) then
    raise exception 'Today''s check-in is already submitted. You can check in again tomorrow.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists mood_logs_lock_submitted on public.mood_logs;
create trigger mood_logs_lock_submitted
  before update on public.mood_logs
  for each row execute function public.mood_logs_lock_submitted();

revoke all on function public.mood_logs_lock_submitted() from public, anon, authenticated;
