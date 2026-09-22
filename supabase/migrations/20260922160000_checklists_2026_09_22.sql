-- The two checklists for 2026-09-22: Getting Out of Bed on a Heavy Morning
-- (Mornings) and Saying No Without Talking Yourself Out of It (Boundaries).
--
-- Generated with: python3 tools/checklists_sql.py --since 2026-09-22
-- Source of truth: data/checklists.json. An upsert on slug, so applying it
-- twice is harmless and every member's ticked items survive.

insert into public.checklists
  (slug, title, description, category, items, cadence, tags, min_level, published_at)
values
  ('getting-out-of-bed-on-a-heavy-morning', 'Getting Out of Bed on a Heavy Morning', 'For the mornings when getting up feels like more than you have in you. It breaks the first hour into pieces small enough to do one at a time, starting before your feet touch the floor.', 'Mornings', '["Let the first thought be kind — Say “this is a hard morning,” not “what is wrong with me.”", "Sit up before you decide anything — Deciding whether to get up is much harder lying down.", "Put your feet on the floor for ten seconds — That is the whole goal for now; standing can wait.", "Open one curtain — Daylight on your face starts the clock on feeling awake.", "Drink the glass of water first — Thirst makes a heavy morning heavier, and it is one easy win.", "Lower the bar out loud — Name the two things that actually have to happen today, and let the rest go.", "Move for two minutes — A slow stretch or a walk to the door shifts something that thinking about it will not.", "Tell one person you are up — A short message gives the morning a witness and makes tomorrow easier."]'::jsonb, 'as needed', array['Motivation', 'Self-Compassion']::text[], 1, '2026-09-22T16:00:00+00:00'::timestamptz),
  ('saying-no-without-talking-yourself-out-of-it', 'Saying No Without Talking Yourself Out of It', 'For the moment someone asks for something and you can feel yourself about to agree anyway. It takes you from buying a minute through the actual words, so the no comes out short, kind and final.', 'Boundaries', '["Buy yourself a minute — Say “let me check and come back to you” before anything else.", "Name what saying yes would cost — An evening, a weekend, or the thing you already promised someone else.", "Check whose problem you are solving — If it was never yours to carry, that is your answer.", "Write the no in one line — Short is kinder than a paragraph of reasons that invites negotiation.", "Leave the apology out — “I can’t take that on” does not need a sorry in front of it.", "Offer a smaller version only if you mean it — A half-yes you resent costs more than a clean no.", "Send it before you soften it — Rereading a fair no ten times only makes it wobble.", "Expect the discomfort and wait it out — Guilt after a good boundary fades; resentment after a bad yes does not."]'::jsonb, 'as needed', array['Boundaries', 'Assertiveness']::text[], 1, '2026-09-22T16:00:00+00:00'::timestamptz)
on conflict (slug) do update set
  title        = excluded.title,
  description  = excluded.description,
  category     = excluded.category,
  items        = excluded.items,
  cadence      = excluded.cadence,
  tags         = excluded.tags,
  min_level    = excluded.min_level,
  published_at = excluded.published_at;
