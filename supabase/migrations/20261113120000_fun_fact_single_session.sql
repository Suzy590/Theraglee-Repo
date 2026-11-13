-- The exercise "Did you know" card read "even single sessions can ease
-- tension"; it now reads "even a single session can ease tension", matching
-- data/daily-content.json.
update public.daily_content
set body = 'Regular exercise is linked to fewer anxiety symptoms, and even a single session can ease tension.'
where kind = 'fun_fact'
  and body = 'Regular exercise is linked to fewer anxiety symptoms, and even single sessions can ease tension.';
