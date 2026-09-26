-- The two checklists for 2026-09-26: Coming Down From a Panic Wave (Grounding)
-- and Starting When You Cannot Focus (Focus).
--
-- Generated with: python3 tools/checklists_sql.py --since 2026-09-26
-- Source of truth: data/checklists.json. An upsert on slug, so applying it
-- twice is harmless and every member's ticked items survive.

insert into public.checklists
  (slug, title, description, category, items, cadence, tags, min_level, published_at)
values
  ('coming-down-from-a-panic-wave', 'Coming Down From a Panic Wave', 'For the twenty minutes after panic crests, when your body is still racing and you feel wrung out. It sees you through the tail end without fighting it, and says what to do with the rest of the day.', 'Grounding', '["Tell yourself it is cresting, not building — Panic climbs, peaks and falls on its own; this is the falling part.", "Stop trying to stop it — Fighting the feeling adds a second alarm on top of the first.", "Breathe out slowly, longer than you breathe in — The long exhale is what brings your heart rate back down.", "Put your back against something solid — A wall or a chair gives your body a fixed edge to find.", "Name what is around you out loud — Five things you see, four you hear; it pulls attention out of your chest.", "Let your hands warm up — Warm water or pockets; cold hands are the adrenaline leaving, not danger.", "Eat and drink something afterward — A wave burns through you, and the shakiness afterward is partly empty fuel.", "Lower the bar for the rest of the day — You have just been through something; nothing more is owed today.", "Know where the extra help is — If panic is shaping your week, a professional helps; if you ever feel unsafe, call or text 988."]'::jsonb, 'as needed', array['Panic', 'Grounding']::text[], 1, '2026-09-26T16:00:00+00:00'::timestamptz),
  ('starting-when-you-cannot-focus', 'Starting When You Cannot Focus', 'For the afternoon you have read the same paragraph four times and opened nothing. It shrinks the job until starting is easy, then removes the things pulling your attention away.', 'Focus', '["Write down the one thing that matters today — A list of nine competing jobs is why nothing has started.", "Cut it down to ten minutes’ worth — Not the whole report, just the first paragraph, small enough to feel boring.", "Put the phone in another room — Willpower loses to a screen within reach every time.", "Close every tab but one — Each open tab is a small ongoing decision about where to look.", "Set a timer and work badly on purpose — A rough first pass beats a perfect one you never begin.", "Write down the distracting thought — On a scrap of paper it stops circling and waits its turn.", "Stand up and move at the timer — Focus comes back faster after two minutes away than after an hour of pushing.", "Note where you stopped — A half-finished sentence is the easiest place in the world to start again."]'::jsonb, 'as needed', array['Motivation', 'Perfectionism']::text[], 1, '2026-09-26T16:00:00+00:00'::timestamptz)
on conflict (slug) do update set
  title        = excluded.title,
  description  = excluded.description,
  category     = excluded.category,
  items        = excluded.items,
  cadence      = excluded.cadence,
  tags         = excluded.tags,
  min_level    = excluded.min_level,
  published_at = excluded.published_at;
