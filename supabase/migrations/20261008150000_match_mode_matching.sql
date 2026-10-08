-- =============================================================================
-- Theraglee Match Mode: members are matched to therapists, not listed to all.
-- -----------------------------------------------------------------------------
-- Until now every therapist with a live listing saw every member who had
-- switched Match Mode on. From here on a member appears on a therapist's
-- dashboard only when the two fit, on six things:
--
--   age          the member's age range and the Ages seen on the listing
--                (18-24 is Young adults; 25-34 to 55-64 are Adults; 65+ is
--                Senior adults)
--   gender       the member's gender and the new Genders seen on the listing
--                (genders_seen below). "Prefer not to answer" fits everyone.
--   topics       the member's topics, now picked from the same specialties
--                list therapists use (up to three), and the listing's
--                specialties
--   who it's for the member's new answer to "Who are the sessions for?"
--                (match_session_for: individual, couple or family) and the
--                listing's Who you see (Individuals, Couples, Families)
--   insurance    the member's plan and the plans the listing accepts. A
--                member paying out of pocket, or not sure yet, fits every
--                therapist: everyone is assumed to take cash.
--   where        in person: an office in the member's zip code area (same
--                first three digits). Video or either: licensed in the
--                member's state, anywhere in it (zip_state(), from
--                20261005120000_therapist_search_by_zip_and_delivery.sql).
--
-- A listing that leaves Ages seen, Genders seen, specialties or Who you see
-- empty has said nothing to match against, so it is not ruled out on that
-- point. Insurance is the exception: a member with a named plan is shown only
-- to therapists who list it. A member the therapist has already written to
-- stays on the dashboard whether or not they still fit, so the conversation
-- keeps its line.
--
-- Life Coaching is no longer a specialty; it is removed from every listing.
-- =============================================================================

-- 1. Genders a therapist works with --------------------------------------------
-- The same keys as profiles.match_gender, minus prefer_not.

alter table public.therapist_profiles
  add column if not exists genders_seen text[];

alter table public.therapist_profiles
  drop constraint if exists therapist_profiles_genders_seen_check;
alter table public.therapist_profiles
  add constraint therapist_profiles_genders_seen_check
    check (genders_seen is null
           or genders_seen <@ array['male','female','non_binary']::text[]);

comment on column public.therapist_profiles.genders_seen is
  'Genders the therapist works with, for Match Mode: male, female, non_binary. Empty means no preference.';

-- 2. Who the member's sessions are for ------------------------------------------

alter table public.profiles
  add column if not exists match_session_for text;

alter table public.profiles
  drop constraint if exists profiles_match_session_for_check;
alter table public.profiles
  add constraint profiles_match_session_for_check
    check (match_session_for is null
           or match_session_for in ('individual','couple','family'));

comment on column public.profiles.match_session_for is
  'Shown to therapists in Match Mode: who the sessions are for, individual, couple or family.';

grant update (match_session_for) on public.profiles to authenticated;

-- 3. Topics come from the specialties list, up to three -------------------------
-- The names live in SPECIALTIES in site/assets/lists.js and grow over time, so
-- the check keeps each value short and plain rather than repeating the list.
-- The short list the window used to offer is folded into the specialty names,
-- once the check that only allowed the short list is out of the way.

alter table public.profiles
  drop constraint if exists profiles_match_topics_check;

update public.profiles
   set match_topics = (
     select array_agg(v order by ord)
       from (
         select distinct on (v) v, ord
           from (
             select case topic
                      when 'Panic'               then 'Panic Attacks'
                      when 'Life transition'     then 'Life Transitions'
                      when 'Grief/loss'          then 'Grief'
                      when 'Relationship issues' then 'Relationship Issues'
                      when 'Family issues'       then 'Family Conflict'
                      when 'Trauma'              then 'Trauma and PTSD'
                      when 'Personal growth'     then null
                      when 'Other'               then null
                      else topic
                    end as v, ord
               from unnest(match_topics) with ordinality as u(topic, ord)
           ) m
          where v is not null
          order by v, ord
       ) d
   )
 where match_topics && array['Panic','Life transition','Grief/loss','Relationship issues',
                             'Family issues','Trauma','Personal growth','Other'];

-- No more than three, keeping the first three picked.
update public.profiles
   set match_topics = match_topics[1:3]
 where cardinality(match_topics) > 3;

-- A check cannot hold a sub-select, so the rule is a function.
create or replace function public.match_topics_ok(p_topics text[])
returns boolean
language sql
immutable
as $$
  select p_topics is null
      or (cardinality(p_topics) <= 3
          and not exists (
            select 1 from unnest(p_topics) t
             where length(t) not between 2 and 60 or t ~ '[<>]'))
$$;

grant execute on function public.match_topics_ok(text[]) to anon, authenticated, service_role;

alter table public.profiles
  add constraint profiles_match_topics_check
    check (public.match_topics_ok(match_topics));

comment on column public.profiles.match_topics is
  'Up to three topics therapists see in Match Mode, from SPECIALTIES in site/assets/lists.js. Separate from issues, which shapes daily content.';

-- 4. Life Coaching is no longer a specialty ------------------------------------

update public.therapist_profiles
   set specialties     = array_remove(specialties, 'Life Coaching'),
       top_specialties = array_remove(top_specialties, 'Life Coaching')
 where specialties @> array['Life Coaching'] or top_specialties @> array['Life Coaching'];

-- 5. Read the new answer back with the rest of the member's own profile --------
-- Written from the latest copy (20261008120000_my_access_match_gender.sql) so
-- no match_* column is dropped; see docs/match-mode-consent.md.

create or replace function public.my_access()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'level', public.user_level(),
    'authenticated', auth.uid() is not null,
    'profile', (
      select to_jsonb(x) from (
        select p.id, p.email, p.full_name, p.role, p.tier, p.subscription_status,
               p.current_period_end, p.cancel_at_period_end, p.visible_to_therapists,
               p.issues, p.zip, p.daily_email, p.daily_email_kinds, p.onboarded,
               p.match_pseudonym, p.match_age_range, p.match_topics, p.match_delivery,
               p.match_insurance, p.match_gender, p.deletion_requested_at,
               p.match_session_for
        from public.profiles p where p.id = auth.uid()
      ) x
    ),
    'therapist', (
      select to_jsonb(t) from public.therapist_profiles t where t.user_id = auth.uid()
    )
  )
$function$;

-- 6. Does this member fit this therapist? --------------------------------------
-- True with no therapist (an administrator looking at the list).

-- An office whose zip code starts with the same three digits.
create or replace function public.match_nearby(p_locations jsonb, p_zip text)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce(p_locations, '[]'::jsonb)) loc
     where left(regexp_replace(coalesce(loc->>'zip', ''), '[^0-9]', '', 'g'), 3)
           = left(regexp_replace(coalesce(p_zip, ''), '[^0-9]', '', 'g'), 3)
  )
$$;

-- Licensed in the state the zip code is in.
create or replace function public.match_in_state(p_states text[], p_zip text)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select public.zip_state(p_zip) is not null
     and coalesce(p_states, '{}') @> array[public.zip_state(p_zip)]
$$;

create or replace function public.match_fits(p_member uuid, p_therapist uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select p_therapist is null or exists (
    select 1
      from public.profiles p
      join public.therapist_profiles t on t.id = p_therapist
     where p.id = p_member
       -- Age: the member's range falls in one of the Ages seen.
       and (p.match_age_range is null
            or coalesce(t.age_ranges, '{}') = '{}'
            or t.age_ranges @> array[case p.match_age_range
                                       when '18-24' then 'Young adults'
                                       when '65+'   then 'Senior adults'
                                       else 'Adults' end])
       -- Gender: one the therapist works with, or not answered.
       and (p.match_gender is null
            or p.match_gender = 'prefer_not'
            or coalesce(t.genders_seen, '{}') = '{}'
            or t.genders_seen @> array[p.match_gender])
       -- Topics: at least one is a specialty of the listing.
       and (coalesce(nullif(p.match_topics, '{}'), p.issues, '{}') = '{}'
            or coalesce(t.specialties, '{}') = '{}'
            or exists (
              select 1
                from unnest(coalesce(nullif(p.match_topics, '{}'), p.issues)) m(topic)
                join unnest(t.specialties) s(name) on lower(s.name) = lower(m.topic)))
       -- Who the sessions are for: someone the therapist sees.
       and (p.match_session_for is null
            or coalesce(t.participants, '{}') = '{}'
            or t.participants @> array[case p.match_session_for
                                         when 'couple' then 'Couples'
                                         when 'family' then 'Families'
                                         else 'Individuals' end])
       -- Insurance: a plan the listing accepts. Cash fits everyone.
       and (p.match_insurance is null
            or p.match_insurance in ('self_pay', 'unsure')
            or exists (
              select 1 from unnest(coalesce(t.insurances, '{}')) i(name)
               where lower(i.name) = lower(p.match_insurance)))
       -- Where: in person means an office in the zip code area; video means
       -- licensed in the member's state; either means one or the other.
       and (case
              when p.zip !~ '^[0-9]{5}' or p.match_delivery is null then true
              when p.match_delivery = 'in_person' then
                t.delivery in ('in_person', 'both') and public.match_nearby(t.locations, p.zip)
              when p.match_delivery = 'telehealth' then
                t.delivery in ('telehealth', 'both') and public.match_in_state(t.license_states, p.zip)
              else
                (t.delivery in ('telehealth', 'both') and public.match_in_state(t.license_states, p.zip))
                or (t.delivery in ('in_person', 'both') and public.match_nearby(t.locations, p.zip))
            end)
  )
$$;

comment on function public.match_fits(uuid, uuid) is
  'Whether a Match Mode member fits a therapist on age, gender, topics, who the sessions are for, insurance and location. True with no therapist.';

revoke all on function public.match_fits(uuid, uuid) from public, anon;
grant execute on function public.match_fits(uuid, uuid) to authenticated, service_role;
grant execute on function public.match_nearby(jsonb, text) to anon, authenticated, service_role;
grant execute on function public.match_in_state(text[], text) to anon, authenticated, service_role;

-- 7. What a therapist can see: only members who fit, plus who the sessions are for

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
  p.match_pseudonym   as pseudonym,
  p.match_insurance   as insurance,
  p.match_gender      as gender,
  p.match_session_for as session_for
from public.profiles p
where p.visible_to_therapists
  and p.role = 'member'
  and (public.is_active_therapist() or public.is_admin())
  and not exists (
    select 1
    from public.member_blocks b
    join public.therapist_profiles t on t.id = b.therapist_id
    where b.member_id = p.id and t.user_id = auth.uid()
  )
  and (
    public.match_fits(p.id, (select t.id from public.therapist_profiles t
                              where t.user_id = auth.uid() limit 1))
    or exists (
      select 1
      from public.therapist_outreach o
      join public.therapist_profiles t on t.id = o.therapist_id
      where o.member_id = p.id and t.user_id = auth.uid()
    )
  );

revoke all on public.member_discovery from anon;
grant select on public.member_discovery to authenticated;

-- 8. The public listing shows the genders seen, added at the end of the view --

create or replace view public.therapist_directory as
  select id,
    slug,
    first_name,
    last_name,
    credentials,
    gender,
    bio,
    photo_url,
    practice_photos,
    license_states,
    insurances,
    delivery,
    locations,
    website,
    fees,
    education,
    specialties,
    top_specialties,
    age_ranges,
    participants,
    treatment_modalities,
    languages,
    verified_at,
    created_at,
    proxy_phone as tracking_phone,
    contact_email is not null as accepts_messages,
    (accepts_payments and charges_enabled and session_fee_cents is not null) as accepts_payments,
    case when accepts_payments and charges_enabled then session_fee_cents end as session_fee_cents,
    identity_status = 'verified' as identity_verified,
    payment_methods,
    education_school,
    education_degree,
    education_year,
    age_range_1,
    age_range_2,
    genders_seen
  from public.therapist_profiles t
  where published and verification = 'verified';
