-- Every article is free to anyone, signed in or not.
--
-- Articles are the open front door to the library alongside the discovery
-- tools: a visitor reads them without an account, and a registered member can
-- also favorite them, save them for later and mark them read (the `favorites`
-- and `item_progress` tables, own-rows policies, unchanged here).
--
-- Reads on `articles` are gated by `min_level <= user_level()`, and a visitor
-- is level 0, so "free" means min_level 0. One article was published at level
-- 1; this lowers it and stops any article from being published above 0 again.
-- The morning email (`digest_article`) already respects the level, so it is
-- unaffected except that every article is now eligible for every member.

update public.articles set min_level = 0 where min_level <> 0;

alter table public.articles drop constraint if exists articles_free;
alter table public.articles
  add constraint articles_free check (min_level = 0);

comment on constraint articles_free on public.articles is
  'Every article is free to anyone, registered or not. Lift this only if the site decides to gate articles again.';
