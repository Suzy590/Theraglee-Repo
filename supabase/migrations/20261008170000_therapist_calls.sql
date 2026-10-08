-- =============================================================================
-- therapist_calls: the connected calls behind "Phone calls" on the Referrals tab
-- -----------------------------------------------------------------------------
-- Each verified therapist is shown a Theraglee tracking number on their profile
-- in place of their own line (`therapist_profiles.proxy_phone`). Taps on that
-- number are already counted as `call` rows in `therapist_events`. This table
-- holds the calls themselves, as the phone network reports them once call
-- forwarding is switched on: one row per connected call, with how long it
-- lasted and whether it was answered. `therapist_stats()` reads it as
-- `verified_calls` (`20261005120000_match_sightings.sql`), and the dashboard
-- shows that figure under the "Phone calls" card.
--
-- The table was first created on the live project by hand. This migration
-- records it here so the repo stays the source of truth, and is safe to run
-- again on a database that already has it.
--
-- Who writes it: nobody from the browser. The telephony provider's status
-- callback (Twilio, in the first instance) will land in an Edge Function that
-- inserts with the service role, keyed on the provider's call id so a repeated
-- callback never counts a call twice. Therapists read their own rows, the
-- administrator reads all, and nothing else touches it.
--
-- What it keeps about the caller: `caller_masked` only, a shortened form such
-- as the last four digits. The full caller number is never stored.
-- =============================================================================

create table if not exists public.therapist_calls (
  id            uuid primary key default gen_random_uuid(),
  therapist_id  uuid not null references public.therapist_profiles(id) on delete cascade,
  caller_masked text,
  duration_secs integer,
  answered      boolean,
  provider      text,
  provider_sid  text unique,
  occurred_at   timestamptz not null default now()
);

comment on table public.therapist_calls is
  'Connected calls to a therapist''s Theraglee tracking number, as reported by the telephony provider. One row per call; the caller is kept masked.';
comment on column public.therapist_calls.caller_masked is
  'A shortened form of the caller''s number (for example the last four digits). Never the full number.';
comment on column public.therapist_calls.duration_secs is
  'How long the forwarded call lasted, in seconds, as the provider reported it.';
comment on column public.therapist_calls.answered is
  'Whether the therapist''s line picked up.';
comment on column public.therapist_calls.provider is
  'Which telephony provider reported the call, such as twilio.';
comment on column public.therapist_calls.provider_sid is
  'The provider''s own id for the call. Unique, so a repeated status callback updates rather than duplicates.';

create index if not exists therapist_calls_idx
  on public.therapist_calls (therapist_id, occurred_at desc);

alter table public.therapist_calls enable row level security;

-- Only the Edge Function that receives the provider's callback writes here,
-- with the service role. The browser roles may read what the policies allow.
revoke insert, update, delete on public.therapist_calls from anon, authenticated;
grant select on public.therapist_calls to authenticated;

drop policy if exists "therapist reads own calls" on public.therapist_calls;
create policy "therapist reads own calls" on public.therapist_calls
  for select using (
    exists (select 1 from public.therapist_profiles t
            where t.id = therapist_calls.therapist_id and t.user_id = auth.uid())
  );

drop policy if exists "admin reads calls" on public.therapist_calls;
create policy "admin reads calls" on public.therapist_calls
  for select using (public.is_admin());
