-- The two checklists for 2026-10-01: When Worry Wakes You in the Night (Worry)
-- and Before You Ask for a Raise (Confidence).
--
-- Generated with: python3 tools/checklists_sql.py --since 2026-10-01
-- Source of truth: data/checklists.json. An upsert on slug, so applying it
-- twice is harmless and every member's ticked items survive.

insert into public.checklists
  (slug, title, description, category, items, cadence, tags, min_level, published_at)
values
  ('when-worry-wakes-you-in-the-night', 'When Worry Wakes You in the Night', 'For the small hours, when one thought has you wide awake and everything looks unfixable. It gets the worry out of your head, decides nothing until daylight, and stops the night turning into a second problem.', 'Worry', '["Blame the hour, not yourself — At three in the morning everything looks unsolvable; that is the hour talking.", "Write the worry on paper by the bed — On the page it stops needing to be held in your head.", "Ask whether anything can be done now — If the answer is no, this is rumination rather than problem-solving.", "Promise it a hearing in daylight — The worry will keep until morning, when you will be better equipped for it.", "Get up if twenty minutes pass — Lying there awake teaches your body that bed is a place for worrying.", "Keep the lights low and the screen off — Bright light tells your body it is morning when it is not.", "Do something dull on purpose — A boring book or a slow stretch beats lying still and thinking.", "Skip the clock arithmetic — Working out how little sleep is left only adds a second worry to the first."]'::jsonb, 'as needed', array['Worry', 'Sleep']::text[], 1, '2026-10-01T16:00:00+00:00'::timestamptz),
  ('before-you-ask-for-a-raise', 'Before You Ask for a Raise', 'For the week before you finally bring up pay. It gets your case onto one page, settles the number before you are in the room, and decides ahead of time what a no will mean.', 'Confidence', '["Write down what you have actually done — Specific wins carry further than a general sense of working hard.", "Find out what the work pays elsewhere — A number with a source behind it is harder to wave away.", "Name your figure before the meeting — Deciding in the room means deciding under pressure.", "Say the number out loud a few times — The first time should not be in front of your manager.", "Ask for the meeting in writing — A booked conversation is harder for either of you to keep postponing.", "Lead with the work, not your costs — Rent going up is true, but it is not the case for your value.", "Let the silence sit after you ask — The pause is uncomfortable and it is not your job to fill it.", "Decide in advance what a no means — Ask again in six months, or start looking; know which before you go in."]'::jsonb, 'as needed', array['Assertiveness', 'Work']::text[], 1, '2026-10-01T16:00:00+00:00'::timestamptz)
on conflict (slug) do update set
  title        = excluded.title,
  description  = excluded.description,
  category     = excluded.category,
  items        = excluded.items,
  cadence      = excluded.cadence,
  tags         = excluded.tags,
  min_level    = excluded.min_level,
  published_at = excluded.published_at;
