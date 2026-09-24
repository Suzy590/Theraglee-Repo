-- The two checklists for 2026-09-23: Taking the Edge Off Sunday Night (Work)
-- and When Anger Arrives Fast (Anger).
--
-- Generated with: python3 tools/checklists_sql.py --since 2026-09-23
-- Source of truth: data/checklists.json. An upsert on slug, so applying it
-- twice is harmless and every member's ticked items survive.

insert into public.checklists
  (slug, title, description, category, items, cadence, tags, min_level, published_at)
values
  ('taking-the-edge-off-sunday-night', 'Taking the Edge Off Sunday Night', 'For the Sunday-evening slump, when the week ahead starts pressing in before it has even begun. It gives the dread something concrete to do with itself, so the evening belongs to you rather than to Monday.', 'Work', '["Call it dread, not a warning — Sunday nerves are a mood, not a forecast of how the week will go.", "Ask what you are actually dreading — It is usually one meeting or one person, not the whole week.", "Look at the real calendar — Ten seconds of facts beats an hour of imagining what is on it.", "Write Monday’s first task on paper — One known starting point takes the vagueness out of the morning.", "Sort one small thing out tonight — Lay out clothes, pack the bag, find the train fare; that is one less thing to carry.", "Close the work apps on your phone — A notification on Sunday evening is Monday arriving early.", "Put something you like in the evening — A show, a bath, a phone call; the hours left are still yours.", "Set a bedtime and keep it — A late Sunday is what makes Monday as rough as you feared it would be."]'::jsonb, 'weekly', array['Work', 'Worry']::text[], 1, '2026-09-23T16:00:00+00:00'::timestamptz),
  ('when-anger-arrives-fast', 'When Anger Arrives Fast', 'For the moments anger lands before you have had a chance to think — a rude message, a plan wrecked, someone talking over you. It buys back the minute your body needs before you say something you cannot take back.', 'Anger', '["Say nothing for sixty seconds — Nothing you say in the first minute beats what you would say later.", "Put the phone down — A reply typed in this state is a message you will be apologizing for.", "Leave the room if you can — Distance brings the volume down faster than arguing your way to calm.", "Breathe out longer than you breathe in — The long exhale is what tells your body the fight is off.", "Unclench your hands and your jaw — Anger holds on in the body, and letting go there reaches the rest of you.", "Name the line that got crossed — Anger usually means one thing: disrespect, unfairness, or being ignored.", "Decide what you actually want — An apology, a change, to be heard; aim at that rather than at winning.", "Go back to it when your hands are steady — The conversation will keep; the damage from having it now will not."]'::jsonb, 'as needed', array['Anger', 'Grounding']::text[], 1, '2026-09-23T16:00:00+00:00'::timestamptz)
on conflict (slug) do update set
  title        = excluded.title,
  description  = excluded.description,
  category     = excluded.category,
  items        = excluded.items,
  cadence      = excluded.cadence,
  tags         = excluded.tags,
  min_level    = excluded.min_level,
  published_at = excluded.published_at;
