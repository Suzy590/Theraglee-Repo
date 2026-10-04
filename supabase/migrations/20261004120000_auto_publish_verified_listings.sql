-- =============================================================================
-- A verified listing goes live on its own.
-- -----------------------------------------------------------------------------
-- Until now a therapist had to press Publish on their dashboard after their
-- license was verified and their membership was active, and many never did.
-- The public page already promises "once both are in place, your listing
-- publishes", so this makes the database keep that promise.
--
-- A listing is published the moment the last of its gates opens:
--   - the license becomes verified (record_license_check, from the
--     verify-license function or the admin queue);
--   - the membership becomes active (the Stripe webhook, a complimentary
--     membership granted by an admin);
--   - the Stripe Identity check passes, where the admin has made it required.
--
-- The existing guard (guard_therapist_verification) still runs first and
-- still refuses a publish that the gates do not allow, so nothing here can
-- put an unverified or unpaid listing in the directory. Unpublish keeps
-- working: a therapist who takes their listing down stays down until they
-- publish again or one of the gates re-opens (a lapsed membership that is
-- renewed, for instance, brings the listing back as before).
-- =============================================================================

-- --------------------------------------------- can this listing be public? --
create or replace function public.therapist_can_publish(
  p_user_id uuid, p_verification public.verification_status, p_identity_status text)
returns boolean
language sql stable set search_path to 'public'
as $$
  select p_verification = 'verified'
     and coalesce((select public.sub_active(p.subscription_status)
                     from public.profiles p where p.id = p_user_id), false)
     and (not coalesce((select c.value = 'true' from public.app_config c
                          where c.key = 'identity_required'), false)
          or p_identity_status = 'verified')
$$;

-- ------------------------------------- a gate on the listing itself opens --
-- Runs after therapist_guard (before-update triggers fire in name order), so
-- it sees the row as the guard left it.
create or replace function public.therapist_publish_when_ready()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not new.published
     and ((new.verification = 'verified' and old.verification is distinct from 'verified')
          or (new.identity_status = 'verified' and old.identity_status is distinct from 'verified'))
     and public.therapist_can_publish(new.user_id, new.verification, new.identity_status) then
    new.published := true;
  end if;
  return new;
end $$;

drop trigger if exists therapist_publish_when_ready on public.therapist_profiles;
create trigger therapist_publish_when_ready
  before update on public.therapist_profiles
  for each row execute function public.therapist_publish_when_ready();

-- ----------------------------------------------- the membership gate opens --
create or replace function public.publish_therapist_on_membership()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  if public.sub_active(new.subscription_status)
     and not public.sub_active(old.subscription_status) then
    update public.therapist_profiles t
       set published = true
     where t.user_id = new.id
       and not t.published
       and public.therapist_can_publish(t.user_id, t.verification, t.identity_status);
  end if;
  return new;
end $$;

drop trigger if exists profiles_publish_therapist on public.profiles;
create trigger profiles_publish_therapist
  after update of subscription_status on public.profiles
  for each row execute function public.publish_therapist_on_membership();
