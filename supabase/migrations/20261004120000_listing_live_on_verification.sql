-- =============================================================================
-- A listing goes live on its own the moment the license is verified.
-- -----------------------------------------------------------------------------
-- Until now a therapist had to press Publish on their dashboard after their
-- license was verified and their membership was active. Nobody should have to:
-- the flow is now sign up, start the membership, fill in the profile, and the
-- listing appears in the directory the moment the license clears.
--
-- `published` stays as the column the directory view, Match Mode and the
-- session checkout already read, but it is no longer something a person sets.
-- It is derived, in one place, from three facts:
--
--   1. the license is verified,
--   2. the membership is active (`sub_active`: active, trialing or comped),
--   3. the identity check has passed, when `app_config.identity_required` is on.
--
-- Every path that changes one of those facts keeps `published` in step:
--
--   - therapist_profiles  BEFORE INSERT OR UPDATE  (verification, identity)
--   - profiles            AFTER UPDATE OF subscription_status (the webhook,
--                         a complimentary membership granted or ended)
--   - app_config          when the identity_required switch is flipped
--
-- record_license_check also sets it directly, so the result of a check is
-- explicit in the function that records it. Existing rows are brought up to
-- date at the end, so a therapist who was verified and paying but never
-- pressed Publish goes live when this is applied.
-- =============================================================================

-- ------------------------------------------------------------- the rule --
create or replace function public.listing_can_go_live(
  p_user_id uuid, p_verification public.verification_status, p_identity_status text)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select p_verification = 'verified'::public.verification_status
     and coalesce((select public.sub_active(p.subscription_status)
                     from public.profiles p where p.id = p_user_id), false)
     and (not coalesce((select c.value = 'true'
                          from public.app_config c where c.key = 'identity_required'), false)
          or coalesce(p_identity_status, '') = 'verified');
$$;
revoke all on function public.listing_can_go_live(uuid, public.verification_status, text)
  from public, anon, authenticated;

-- --------------------------------------- 1. the profile row itself changes --
-- Runs after therapist_guard / therapist_guard_ins (triggers fire in name
-- order), so it sees the verification and identity values the guards allow.
create or replace function public.set_listing_live()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  new.published := public.listing_can_go_live(new.user_id, new.verification, new.identity_status);
  return new;
end $$;

drop trigger if exists therapist_listing_live on public.therapist_profiles;
create trigger therapist_listing_live
  before insert or update on public.therapist_profiles
  for each row execute function public.set_listing_live();

-- ------------------------------------------------ 2. the membership changes --
create or replace function public.sync_listing_live_for_user(p_user_id uuid)
returns void
language sql security definer set search_path to 'public'
as $$
  update public.therapist_profiles t
     set published = public.listing_can_go_live(t.user_id, t.verification, t.identity_status)
   where t.user_id = p_user_id
     and t.published is distinct from
         public.listing_can_go_live(t.user_id, t.verification, t.identity_status);
$$;
revoke all on function public.sync_listing_live_for_user(uuid) from public, anon, authenticated;

create or replace function public.sync_listing_live_on_subscription()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.subscription_status is distinct from old.subscription_status then
    perform public.sync_listing_live_for_user(new.id);
  end if;
  return new;
end $$;

drop trigger if exists profiles_listing_live on public.profiles;
create trigger profiles_listing_live
  after update of subscription_status on public.profiles
  for each row execute function public.sync_listing_live_on_subscription();

-- --------------------------------- 3. the identity_required switch is flipped --
create or replace function public.sync_listing_live_on_config()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  update public.therapist_profiles t
     set published = public.listing_can_go_live(t.user_id, t.verification, t.identity_status)
   where t.published is distinct from
         public.listing_can_go_live(t.user_id, t.verification, t.identity_status);
  return new;
end $$;

drop trigger if exists app_config_listing_live on public.app_config;
create trigger app_config_listing_live
  after insert or update on public.app_config
  for each row when (new.key = 'identity_required')
  execute function public.sync_listing_live_on_config();

-- ----------------------------------------------------- record_license_check --
-- Same as before, except the listing's live state comes from the rule above
-- instead of "keep whatever it was" on a verified result.
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
         published = public.listing_can_go_live(t.user_id, v_verification, t.identity_status)
   where id = p_therapist_id;

  return jsonb_build_object('verification_id', v_id, 'status', p_status,
    'live', public.listing_can_go_live(t.user_id, v_verification, t.identity_status));
end $$;

-- ------------------------------------------------------------ existing rows --
update public.therapist_profiles t
   set published = public.listing_can_go_live(t.user_id, t.verification, t.identity_status)
 where t.published is distinct from
       public.listing_can_go_live(t.user_id, t.verification, t.identity_status);
