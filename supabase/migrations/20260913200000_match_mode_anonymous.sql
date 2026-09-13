-- =============================================================================
-- Theraglee Match Mode without names.
-- -----------------------------------------------------------------------------
-- Until now a member who switched on Match Mode showed therapists their name,
-- topics and zip code. From here on therapists see a short anonymous line
-- instead: gender, age, the broad topics the member picked, whether they want
-- in-person or telehealth sessions, and the zip code. A member is asked for
-- those details the moment they switch Match Mode on.
--
-- The member's real name reaches a therapist only when the member chooses to
-- answer that therapist's message. The reply carries the name, and the
-- database refuses a reply without one.
-- =============================================================================

-- 1. What a member shares when Match Mode is on -------------------------------

alter table public.profiles
  add column if not exists match_gender   text,
  add column if not exists match_age      smallint,
  add column if not exists match_delivery public.delivery_mode;

alter table public.profiles
  drop constraint if exists profiles_match_gender_check,
  drop constraint if exists profiles_match_age_check;
alter table public.profiles
  add constraint profiles_match_gender_check
    check (match_gender is null or match_gender in ('female','male','non_binary','prefer_not')),
  add constraint profiles_match_age_check
    check (match_age is null or match_age between 18 and 120);

comment on column public.profiles.match_gender is
  'Shown to therapists in Match Mode: female, male, non_binary or prefer_not.';
comment on column public.profiles.match_age is
  'Shown to therapists in Match Mode. The member types it when switching the mode on.';
comment on column public.profiles.match_delivery is
  'Shown to therapists in Match Mode: in_person, telehealth or both.';

grant update (match_gender, match_age, match_delivery) on public.profiles to authenticated;

-- 2. Replies from members, each carrying the member's real name ---------------

create table if not exists public.outreach_replies (
  id           uuid primary key default gen_random_uuid(),
  outreach_id  uuid not null references public.therapist_outreach(id) on delete cascade,
  therapist_id uuid not null references public.therapist_profiles(id) on delete cascade,
  member_id    uuid not null references public.profiles(id) on delete cascade,
  member_name  text not null,
  message      text not null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  constraint outreach_replies_name_check    check (length(trim(member_name)) between 2 and 120),
  constraint outreach_replies_message_check check (length(trim(message)) between 1 and 4000)
);

comment on table public.outreach_replies is
  'A member answering a therapist''s Match Mode message. The real name is required here and nowhere else.';

create index if not exists outreach_replies_therapist_idx on public.outreach_replies (therapist_id, created_at desc);
create index if not exists outreach_replies_member_idx    on public.outreach_replies (member_id, created_at desc);

alter table public.outreach_replies enable row level security;

revoke all on public.outreach_replies from anon, authenticated;
grant select on public.outreach_replies to authenticated;
grant insert (outreach_id, therapist_id, member_id, member_name, message) on public.outreach_replies to authenticated;
grant update (read_at) on public.outreach_replies to authenticated;

-- A member may answer a message that was sent to them, and only as themselves.
drop policy if exists "member replies to outreach" on public.outreach_replies;
create policy "member replies to outreach" on public.outreach_replies
  for insert to authenticated
  with check (
    member_id = auth.uid()
    and exists (
      select 1 from public.therapist_outreach o
      where o.id = outreach_replies.outreach_id
        and o.member_id = auth.uid()
        and o.therapist_id = outreach_replies.therapist_id
    )
  );

drop policy if exists "member reads own replies" on public.outreach_replies;
create policy "member reads own replies" on public.outreach_replies
  for select using (member_id = auth.uid());

drop policy if exists "therapist reads replies" on public.outreach_replies;
create policy "therapist reads replies" on public.outreach_replies
  for select using (exists (
    select 1 from public.therapist_profiles t
    where t.id = outreach_replies.therapist_id and t.user_id = auth.uid()));

drop policy if exists "therapist marks replies read" on public.outreach_replies;
create policy "therapist marks replies read" on public.outreach_replies
  for update using (exists (
    select 1 from public.therapist_profiles t
    where t.id = outreach_replies.therapist_id and t.user_id = auth.uid()))
  with check (exists (
    select 1 from public.therapist_profiles t
    where t.id = outreach_replies.therapist_id and t.user_id = auth.uid()));

drop policy if exists "admin reads replies" on public.outreach_replies;
create policy "admin reads replies" on public.outreach_replies
  for select using (public.is_admin());

-- 3. A therapist may keep a conversation going once the member has replied ----
-- Even if the member later switches Match Mode off, they chose to talk to this
-- therapist, so a follow-up to that conversation is still allowed. New members
-- still need the switch on.

create or replace function public.member_replied_to(p_therapist uuid, p_member uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.outreach_replies r
    where r.therapist_id = p_therapist and r.member_id = p_member
  )
$$;

revoke all on function public.member_replied_to(uuid, uuid) from public, anon;
grant execute on function public.member_replied_to(uuid, uuid) to authenticated, service_role;

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
    and (public.member_opted_in(member_id)
         or public.member_replied_to(therapist_id, member_id))
  );

-- 4. What a therapist can see: no name any more -------------------------------
-- The old view had a display_name column. A view cannot drop a column in
-- place, so it is rebuilt.

drop view if exists public.member_discovery;

create view public.member_discovery
with (security_invoker = off) as
select
  p.id,
  p.match_gender   as gender,
  p.match_age      as age,
  p.match_delivery as delivery,
  p.issues,
  p.zip,
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
  and (public.is_active_therapist() or public.is_admin());

revoke all on public.member_discovery from anon;
grant select on public.member_discovery to authenticated;
