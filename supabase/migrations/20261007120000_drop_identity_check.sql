-- =============================================================================
-- The therapist identity check is gone.
-- -----------------------------------------------------------------------------
-- A therapist no longer photographs a government ID for Stripe Identity as
-- part of setting up a membership and a listing: checking the license with the
-- state board is the industry standard, and that check stays exactly as it is.
--
-- A listing is now derived from two facts instead of three:
--
--   1. the license is verified,
--   2. the membership is active (`sub_active`: active, trialing or comped).
--
-- The `identity_required` switch and its trigger go away, and the functions
-- that read a therapist's `identity_status` stop doing so. The identity
-- columns on `therapist_profiles` (and `identity_verified` on the directory
-- view) are left in place: nothing writes them any more, the `stripe-identity`
-- function is deleted, and dropping the view column would mean recreating the
-- directory search function that returns rows of that view, for no gain.
-- =============================================================================

-- ------------------------------------------------------------- the rule --
drop function if exists public.listing_can_go_live(uuid, public.verification_status, text);

create or replace function public.listing_can_go_live(
  p_user_id uuid, p_verification public.verification_status)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select p_verification = 'verified'::public.verification_status
     and coalesce((select public.sub_active(p.subscription_status)
                     from public.profiles p where p.id = p_user_id), false);
$$;
revoke all on function public.listing_can_go_live(uuid, public.verification_status)
  from public, anon, authenticated;

-- --------------------------------------- 1. the profile row itself changes --
create or replace function public.set_listing_live()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  new.published := public.listing_can_go_live(new.user_id, new.verification);
  return new;
end $$;

-- ------------------------------------------------ 2. the membership changes --
create or replace function public.sync_listing_live_for_user(p_user_id uuid)
returns void
language sql security definer set search_path to 'public'
as $$
  update public.therapist_profiles t
     set published = public.listing_can_go_live(t.user_id, t.verification)
   where t.user_id = p_user_id
     and t.published is distinct from
         public.listing_can_go_live(t.user_id, t.verification);
$$;
revoke all on function public.sync_listing_live_for_user(uuid) from public, anon, authenticated;

-- ------------------------------------- 3. the identity_required switch is gone --
drop trigger if exists app_config_listing_live on public.app_config;
drop function if exists public.sync_listing_live_on_config();
delete from public.app_config where key = 'identity_required';

-- ------------------------------------------------- the member-side guard --
-- Same as before, minus the identity condition on `published`. (The
-- therapist_listing_live trigger derives `published` afterwards anyway; the
-- check here is kept so the guard stays self-contained.)
create or replace function public.guard_therapist_verification()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  paid boolean;
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
    if new.verification <> 'verified' or not coalesce(paid, false) then
      new.published := false;
    end if;
  end if;
  return new;
end $$;

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
declare t record; v_id uuid; v_verification public.verification_status;
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

  v_verification := case
    when p_status = 'verified' then 'verified'::public.verification_status
    when p_status in ('rejected','expired') then 'rejected'::public.verification_status
    else 'pending'::public.verification_status end;

  update public.therapist_profiles
     set verification = v_verification,
         verified_at = case when p_status = 'verified' then now() else null end,
         license_expires_on = coalesce(p_expires_on, license_expires_on),
         -- re-check a year out, or a month before the license lapses
         next_license_check = least(
           coalesce(p_expires_on, current_date + interval '1 year')::date - 30,
           (current_date + interval '1 year')::date),
         -- live the moment it is verified, as long as the membership is active
         published = public.listing_can_go_live(t.user_id, v_verification)
   where id = p_therapist_id;

  return jsonb_build_object('verification_id', v_id, 'status', p_status,
    'live', public.listing_can_go_live(t.user_id, v_verification));
end $$;

-- ------------------------------------------------------------ existing rows --
-- A verified, paying therapist whose listing was held back only by the
-- identity check goes live now.
update public.therapist_profiles t
   set published = public.listing_can_go_live(t.user_id, t.verification)
 where t.published is distinct from
       public.listing_can_go_live(t.user_id, t.verification);
