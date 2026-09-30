-- The two checklists for 2026-09-30: Getting Through an Event You Dread
-- (Social Anxiety) and Taking a Day Off Without Earning It (Rest).
--
-- Generated with: python3 tools/checklists_sql.py --since 2026-09-30
-- Source of truth: data/checklists.json. An upsert on slug, so applying it
-- twice is harmless and every member's ticked items survive.

insert into public.checklists
  (slug, title, description, category, items, cadence, tags, min_level, published_at)
values
  ('getting-through-an-event-you-dread', 'Getting Through an Event You Dread', 'For the party, wedding or work thing you already want to get out of. It gives you an exit time, something to do with your hands and your mouth, and a definition of success you can actually meet.', 'Social Anxiety', '["Decide your leaving time before you go — Knowing you can leave at nine is what makes the first hour possible.", "Arrive early rather than late — Walking into six people is far easier than walking into sixty.", "Have two questions ready — People like being asked things, and it takes the talking off you.", "Find the job nobody wants — Pouring drinks or minding the door gives you a reason to be standing there.", "Take the break you need — Five minutes alone outside or in the bathroom resets more than pushing through.", "Let the silences belong to both of you — A pause is shared; it is not evidence about you.", "Skip the replay on the way home — The post-event audit is the worst part of the night and the least accurate.", "Count going as the win — You went; whether you shone is a different and far less important question."]'::jsonb, 'as needed', array['Social Anxiety', 'Anxiety']::text[], 1, '2026-09-30T16:00:00+00:00'::timestamptz),
  ('taking-a-day-off-without-earning-it', 'Taking a Day Off Without Earning It', 'For the rest you keep postponing until you have done enough to deserve it. It protects the day from errands and guilt, and settles what counts as a good one before it starts.', 'Rest', '["Book it before you feel you deserve it — Waiting to earn rest is how people end up never resting.", "Tell one person it is a day off — Said out loud, it is harder to quietly fill with errands.", "Leave the to-do list in another room — A rest day with the list in sight is not a rest day.", "Pick one thing you actually want to do — Not improving, not catching up; wanting it is the whole test.", "Let the day be unproductive on purpose — That is not the day going wrong, that is the day working.", "Notice the guilt and carry on anyway — Guilt on a day off is a habit, not information.", "Keep the phone out of the first hour — The day is more yours if it does not open with other people’s needs.", "Do not make up for it tomorrow — Rest paid back with a double shift was a loan, not a rest."]'::jsonb, 'as needed', array['Self-Care', 'Perfectionism']::text[], 1, '2026-09-30T16:00:00+00:00'::timestamptz)
on conflict (slug) do update set
  title        = excluded.title,
  description  = excluded.description,
  category     = excluded.category,
  items        = excluded.items,
  cadence      = excluded.cadence,
  tags         = excluded.tags,
  min_level    = excluded.min_level,
  published_at = excluded.published_at;
