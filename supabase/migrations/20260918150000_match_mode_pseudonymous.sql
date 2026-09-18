-- =============================================================================
-- Theraglee Match Mode: pseudonymous by design.
-- -----------------------------------------------------------------------------
-- Therapists no longer see a member's gender, exact age or zip code. They see
-- a pseudonymous profile: an age range, the broad topics the member picked,
-- whether they prefer in-person or video sessions, and a general area (the
-- first three digits of the zip code) so they know the member is nearby. The
-- member's real name still travels only in a reply the member chooses to send.
--
-- A member can also block a therapist with one tap. A blocked therapist stops
-- seeing that member and can no longer write to them, even after a reply.
-- =============================================================================

-- 1. An age range instead of an exact age ------------------------------------

alter table public.profiles
  add column if not exists match_age_range text;

alter table public.profiles
  drop constraint if exists profiles_match_age_range_check;
alter table public.profiles
  add constraint profiles_match_age_range_check
    check (match_age_range is null
           or match_age_range in ('18-24','25-34','35-44','45-54','55-64','65+'));

comment on column public.profiles.match_age_range is
  'Shown to therapists in Match Mode in place of an exact age. The member picks it when switching the mode on.';
comment on column public.profiles.match_age is
  'No longer shown to therapists. Kept for members who typed an age before age ranges existed.';
comment on column public.profiles.match_gender is
  'No longer shown to therapists or asked for. Kept so older rows still load.';

grant update (match_age_range) on public.profiles to authenticated;

-- Members who already typed an exact age keep Match Mode working: derive the range.
update public.profiles
set match_age_range = case
  when match_age < 25 then '18-24'
  when match_age < 35 then '25-34'
  when match_age < 45 then '35-44'
  when match_age < 55 then '45-54'
  when match_age < 65 then '55-64'
  else '65+' end
where match_age is not null and match_age_range is null;

-- 2. Blocking a therapist -----------------------------------------------------

create table if not exists public.member_blocks (
  member_id    uuid not null references public.profiles(id) on delete cascade,
  therapist_id uuid not null references public.therapist_profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (member_id, therapist_id)
);

comment on table public.member_blocks is
  'A member blocking a therapist in Match Mode: the therapist no longer sees them and cannot write to them.';

alter table public.member_blocks enable row level security;

revoke all on public.member_blocks from anon, authenticated;
grant select, delete on public.member_blocks to authenticated;
grant insert (member_id, therapist_id) on public.member_blocks to authenticated;

drop policy if exists "member manages own blocks" on public.member_blocks;
create policy "member manages own blocks" on public.member_blocks
  for all to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid());

create or replace function public.member_blocked(p_therapist uuid, p_member uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.member_blocks b
    where b.therapist_id = p_therapist and b.member_id = p_member
  )
$$;

revoke all on function public.member_blocked(uuid, uuid) from public, anon;
grant execute on function public.member_blocked(uuid, uuid) to authenticated, service_role;

-- 3. What a therapist can see: the pseudonymous profile ----------------------
-- A view cannot drop columns in place, so it is rebuilt without gender, age
-- and zip. Members who blocked the viewing therapist are left out.

drop view if exists public.member_discovery;

create view public.member_discovery
with (security_invoker = off) as
select
  p.id,
  p.match_age_range as age_range,
  p.match_delivery  as delivery,
  p.issues,
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
  ) as has_replied
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

-- 4. A blocked therapist cannot write, even after a reply --------------------

drop policy if exists "therapist sends outreach" on public.therapist_outreach;
create policy "therapist sends outreach" on public.therapist_outreach
  for insert to authenticated
  with check (
    exists (
      select 1 from public.therapist_profiles t
      where t.id = therapist_outreach.therapist_id
        and t.user_id = auth.uid()
        and t.published
        and t.verification = 'verified'
    )
    and not public.member_blocked(therapist_id, member_id)
    and (public.member_opted_in(member_id)
         or public.member_replied_to(therapist_id, member_id))
  );
