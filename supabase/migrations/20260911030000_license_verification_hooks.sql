-- =============================================================================
-- License verification runs on its own.
-- -----------------------------------------------------------------------------
-- Until now a license was checked only when the therapist pressed the button
-- on their dashboard, and nobody was emailed. This wires the database to the
-- verify-license Edge Function (supabase/functions/verify-license) so that:
--
--   1. Creating a profile, or changing its license number, state or type,
--      queues a check (trigger on therapist_profiles, via pg_net).
--   2. Every check that is recorded emails the therapist the outcome, and the
--      administrator when a person has to confirm against the board
--      (trigger on license_verifications, via pg_net).
--   3. Verified licenses are checked again when next_license_check comes
--      around (pg_cron, daily at 14:00 UTC).
--
-- Also in here:
--   - record_license_check accepts the service role, so the function records
--     through the same path the admin screen uses (status, expiry, re-check
--     date and the publish reset all in one place).
--   - Changing the license details on a verified profile puts it back to
--     pending and unpublishes it, so a verified badge never outlives the
--     license it was earned with.
--   - Washington and Colorado publish their license rosters as open data;
--     their rows get the dataset URL and are marked automatable.
--
-- The function authenticates the database's calls with a shared key in
-- app_secrets, the same way the daily digest does.
-- =============================================================================

-- ----------------------------------------------------- record_license_check --
create or replace function public.record_license_check(
  p_therapist_id uuid, p_status text, p_method text default 'manual',
  p_licensee_name text default null, p_license_status text default null,
  p_expires_on date default null, p_disciplinary boolean default null,
  p_board_name text default null, p_source_url text default null,
  p_notes text default null, p_raw jsonb default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare t record; v_id uuid;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select * into t from public.therapist_profiles where id = p_therapist_id;
  if t is null then raise exception 'listing not found'; end if;

  insert into public.license_verifications (
    therapist_id, license_number, license_state, license_type, method, status,
    licensee_name, license_status, expires_on, disciplinary, board_name,
    source_url, reviewer_id, notes, raw)
  values (
    p_therapist_id, t.license_number, coalesce(t.license_states[1], '--'), t.license_type,
    p_method, p_status, p_licensee_name, p_license_status, p_expires_on,
    p_disciplinary, p_board_name, p_source_url, auth.uid(), p_notes, p_raw)
  returning id into v_id;

  update public.therapist_profiles
     set verification = case
           when p_status = 'verified' then 'verified'::public.verification_status
           when p_status in ('rejected','expired') then 'rejected'::public.verification_status
           else 'pending'::public.verification_status end,
         verified_at = case when p_status = 'verified' then now() else null end,
         license_expires_on = coalesce(p_expires_on, license_expires_on),
         -- re-check a year out, or a month before the license lapses
         next_license_check = least(
           coalesce(p_expires_on, current_date + interval '1 year')::date - 30,
           (current_date + interval '1 year')::date),
         published = case when p_status = 'verified' then published else false end
   where id = p_therapist_id;

  return jsonb_build_object('verification_id', v_id, 'status', p_status);
end $$;

-- ------------------------------------------------- guard: license changed --
-- Same guard as before, plus: a therapist who edits the license details on a
-- verified profile goes back to pending (and off the directory) until the new
-- details are checked. Administrators and the service role are exempt.
create or replace function public.guard_therapist_verification()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  paid    boolean;
  need_id boolean;
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  new.verification  := old.verification;
  new.verified_at   := old.verified_at;
  new.proxy_phone   := old.proxy_phone;
  new.proxy_email   := old.proxy_email;
  new.proxy_phone_provider    := old.proxy_phone_provider;
  new.proxy_phone_sid         := old.proxy_phone_sid;
  new.proxy_phone_assigned_at := old.proxy_phone_assigned_at;

  -- Stripe-managed: only the webhook and the Stripe functions may change these.
  new.identity_status       := old.identity_status;
  new.identity_session_id   := old.identity_session_id;
  new.identity_verified_at  := old.identity_verified_at;
  new.identity_last_error   := old.identity_last_error;
  new.stripe_account_id     := old.stripe_account_id;
  new.stripe_account_status := old.stripe_account_status;
  new.charges_enabled       := old.charges_enabled;
  new.payouts_enabled       := old.payouts_enabled;

  -- New license details need a new check.
  if new.license_number is distinct from old.license_number
     or new.license_states is distinct from old.license_states
     or new.license_type is distinct from old.license_type then
    new.verification := 'pending';
    new.verified_at  := null;
    new.published    := false;
  end if;

  if new.published then
    select public.sub_active(p.subscription_status) into paid
    from public.profiles p where p.id = new.user_id;
    select coalesce(c.value = 'true', false) into need_id
    from public.app_config c where c.key = 'identity_required';
    if new.verification <> 'verified'
       or not coalesce(paid, false)
       or (coalesce(need_id, false) and new.identity_status <> 'verified') then
      new.published := false;
    end if;
  end if;
  return new;
end $$;

-- --------------------------------------------------------------- the key --
insert into public.app_secrets (key, value)
values ('license_hook_key', encode(gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- ------------------------------------------------------------ the caller --
-- One helper posts to the function with the key. pg_net runs the request
-- after the transaction commits, so the function sees the committed row.
create or replace function public.call_verify_license(p_body jsonb)
returns void
language sql security definer set search_path to 'public'
as $$
  select net.http_post(
    url     := 'https://oekqzuguruyqkafsqhos.supabase.co/functions/v1/verify-license',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-license-key', (select value from public.app_secrets where key = 'license_hook_key')),
    body    := p_body,
    timeout_milliseconds := 120000
  );
$$;
revoke all on function public.call_verify_license(jsonb) from public, anon, authenticated;

-- ------------------------------------------- 1. a profile needs checking --
create or replace function public.queue_license_check()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.license_number is null or coalesce(array_length(new.license_states, 1), 0) = 0 then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and new.license_number is not distinct from old.license_number
     and new.license_states is not distinct from old.license_states
     and new.license_type is not distinct from old.license_type then
    return new;
  end if;
  perform public.call_verify_license(
    jsonb_build_object('event', 'check', 'therapist_id', new.id));
  return new;
end $$;

drop trigger if exists therapist_license_check on public.therapist_profiles;
create trigger therapist_license_check
  after insert or update of license_number, license_states, license_type
  on public.therapist_profiles
  for each row execute function public.queue_license_check();

-- ------------------------------------------- 2. a result was recorded --
create or replace function public.notify_license_check()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  perform public.call_verify_license(
    jsonb_build_object('event', 'notify', 'verification_id', new.id));
  return new;
end $$;

drop trigger if exists license_check_notify on public.license_verifications;
create trigger license_check_notify
  after insert on public.license_verifications
  for each row execute function public.notify_license_check();

-- --------------------------------------------- 3. re-check before expiry --
do $$
begin
  if exists (select 1 from cron.job where jobname = 'license-recheck') then
    perform cron.unschedule('license-recheck');
  end if;
end $$;

select cron.schedule(
  'license-recheck',
  '0 14 * * *',
  $cron$ select public.call_verify_license('{"event":"recheck"}'::jsonb); $cron$
);

-- ------------------------------------------------ boards with open data --
-- Washington's Department of Health and Colorado's DORA publish every license
-- as a dataset the function can query directly (see _shared/license.ts).
update public.state_boards
   set api_url = 'https://data.wa.gov/resource/qxh8-f4bd.json',
       automatable = true,
       notes = coalesce(notes, '') || ' Checked automatically against the DOH open dataset (data.wa.gov, qxh8-f4bd).'
 where state = 'WA' and profession = 'behavioral_health' and api_url is null;

update public.state_boards
   set api_url = 'https://data.colorado.gov/resource/7s5z-vewr.json',
       automatable = true,
       notes = coalesce(notes, '') || ' Checked automatically against the DORA open dataset (data.colorado.gov, 7s5z-vewr).'
 where state = 'CO' and profession = 'behavioral_health' and api_url is null;
