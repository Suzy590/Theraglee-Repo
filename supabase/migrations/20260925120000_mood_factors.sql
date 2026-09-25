-- Mood gets its own tab on the member dashboard. After tapping the emoji for
-- the day, a member rates nine things that may be shaping it (1 = terrible,
-- 10 = fantastic, for how each feels today) and picks the day's weather. Once
-- there are seven days of entries, the tab looks for which of these move with
-- the mood. docs/mood.md is the guide.
--
-- Every new column is nullable: rows logged before today, and days where the
-- member tapped only the emoji, simply have no factors. The existing "own rows"
-- policy on mood_logs already covers the new columns.

alter table public.mood_logs
  add column if not exists sleep       smallint check (sleep       between 1 and 10),
  add column if not exists home_stress smallint check (home_stress between 1 and 10),
  add column if not exists work_stress smallint check (work_stress between 1 and 10),
  add column if not exists nutrition   smallint check (nutrition   between 1 and 10),
  add column if not exists hunger      smallint check (hunger      between 1 and 10),
  add column if not exists loneliness  smallint check (loneliness  between 1 and 10),
  add column if not exists thoughts    smallint check (thoughts    between 1 and 10),
  add column if not exists activity    smallint check (activity    between 1 and 10),
  add column if not exists social      smallint check (social      between 1 and 10),
  add column if not exists weather     text check (weather in (
    'sunny', 'partly_cloudy', 'cloudy', 'rainy', 'stormy',
    'snowy', 'foggy', 'windy', 'hot', 'cold'));

comment on column public.mood_logs.sleep is 'How sleep feels today, 1 (terrible) to 10 (fantastic).';
comment on column public.mood_logs.home_stress is 'Home life stress today, 1 (terrible) to 10 (fantastic, no stress).';
comment on column public.mood_logs.work_stress is 'School or work stress today, 1 (terrible) to 10 (fantastic, no stress).';
comment on column public.mood_logs.nutrition is 'How eating feels today, 1 (terrible) to 10 (fantastic).';
comment on column public.mood_logs.hunger is 'Hunger at the moment of logging, 1 (terrible) to 10 (fantastic, just right).';
comment on column public.mood_logs.loneliness is 'Loneliness today, 1 (terrible, very lonely) to 10 (fantastic, connected).';
comment on column public.mood_logs.thoughts is 'Overall thoughts today, 1 (terrible) to 10 (fantastic).';
comment on column public.mood_logs.activity is 'Level of physical activity today, 1 (terrible) to 10 (fantastic).';
comment on column public.mood_logs.social is 'Social interaction today, 1 (terrible) to 10 (fantastic).';
comment on column public.mood_logs.weather is 'The day''s weather, one of the keys in WEATHER in site/assets/mood-patterns.js.';
