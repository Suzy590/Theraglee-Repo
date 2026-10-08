-- Below the weather picker on the mood check-in, a member now rates how the
-- weather affected them that day, 1 (terrible) to 10 (fantastic), the same
-- scale as the nine factors. The kind of weather says what it was like
-- outside; this says how it landed. Both feed "Your mood patterns": the kind
-- through the correlation ratio, this rating through Pearson's r like any
-- factor. docs/mood.md is the guide.
--
-- The column is nullable: days logged before today simply have no rating.
-- The lock on a submitted day now covers it too.

alter table public.mood_logs
  add column if not exists weather_feel smallint check (weather_feel between 1 and 10);

comment on column public.mood_logs.weather_feel is
  'How the day''s weather affected the member, 1 (terrible) to 10 (fantastic).';

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
    or new.weather_feel is distinct from old.weather_feel
    or new.submitted_at is distinct from old.submitted_at
    or new.logged_on    is distinct from old.logged_on
  ) then
    raise exception 'Today''s check-in is already submitted. You can check in again tomorrow.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
