-- =============================================================================
-- Theraglee Match Mode: a pseudonym, and its own list of topics.
-- -----------------------------------------------------------------------------
-- When a member switches Match Mode on they now pick a pseudonym, the name a
-- therapist knows them by until they reply with their real one. It must not be
-- their real name; the window that asks for it suggests one and says so.
--
-- The broad topics a therapist reads now come from a short list of their own
-- (match_topics), separate from profiles.issues, which keeps shaping the
-- member's daily content. A member who switched Match Mode on before this
-- still shows their old topics to therapists until they pick new ones.
-- =============================================================================

alter table public.profiles
  add column if not exists match_pseudonym text,
  add column if not exists match_topics text[];

alter table public.profiles
  drop constraint if exists profiles_match_pseudonym_check;
alter table public.profiles
  add constraint profiles_match_pseudonym_check
    check (match_pseudonym is null
           or match_pseudonym ~ '^[A-Za-z0-9][A-Za-z0-9 .''_-]{1,29}$');

alter table public.profiles
  drop constraint if exists profiles_match_topics_check;
alter table public.profiles
  add constraint profiles_match_topics_check
    check (match_topics is null
           or match_topics <@ array['Anxiety','Panic','Depression','Stress','Life transition',
                                    'Grief/loss','Relationship issues','Family issues','Trauma',
                                    'Personal growth','Other']::text[]);

comment on column public.profiles.match_pseudonym is
  'The name therapists see in Match Mode until the member replies with their real one. Never the real name.';
comment on column public.profiles.match_topics is
  'The broad topics therapists see in Match Mode. Separate from issues, which shapes daily content.';

grant update (match_pseudonym, match_topics) on public.profiles to authenticated;

-- What a therapist can see: the same view, with the pseudonym added at the end
-- and the topics taken from match_topics once the member has picked them.

create or replace view public.member_discovery
with (security_invoker = off) as
select
  p.id,
  p.match_age_range as age_range,
  p.match_delivery  as delivery,
  coalesce(nullif(p.match_topics, '{}'), p.issues) as issues,
  case when p.zip ~ '^[0-9]{5}' then left(p.zip, 3) || 'xx' end as area,
  p.created_at,
  exists (
    select 1
    from public.therapist_outreach o
    join public.therapist_profiles t on t.id = o.therapist_id
    where o.member_id = p.id and t.user_id = auth.uid()
  ) as already_contacted,
  exists (
    select 1
    from public.outreach_replies r
    join public.therapist_profiles t on t.id = r.therapist_id
    where r.member_id = p.id and t.user_id = auth.uid()
  ) as has_replied,
  p.match_pseudonym as pseudonym
from public.profiles p
where p.visible_to_therapists
  and p.role = 'member'
  and (public.is_active_therapist() or public.is_admin())
  and not exists (
    select 1
    from public.member_blocks b
    join public.therapist_profiles t on t.id = b.therapist_id
    where b.member_id = p.id and t.user_id = auth.uid()
  );

revoke all on public.member_discovery from anon;
grant select on public.member_discovery to authenticated;
