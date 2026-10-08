-- =============================================================================
-- A Theraglee number is issued the moment a listing goes live
-- -----------------------------------------------------------------------------
-- Until now an administrator bought a Twilio number by hand and pasted it in.
-- Now the database asks the twilio-numbers Edge Function to buy one, the way
-- the license check is asked for (20260911030000_license_verification_hooks):
-- a shared key in app_secrets, posted by pg_net after the row commits.
--
-- When: the first time a listing is live (verified and the membership active,
-- so `published` turns true) and it has no number yet. Nothing happens when a
-- number is later cleared while the listing stays live; the administrator
-- issues or releases by hand from /admin.html for those. A listing that goes
-- down keeps its number, so a lapse and renewal does not change what the
-- profile showed; release it by hand to stop its billing.
-- =============================================================================

insert into public.app_secrets (key, value)
values ('twilio_hook_key', encode(gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

create or replace function public.call_twilio_numbers(p_body jsonb)
returns void
language sql security definer set search_path to 'public'
as $$
  select net.http_post(
    url     := 'https://oekqzuguruyqkafsqhos.supabase.co/functions/v1/twilio-numbers',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-hook-key', (select value from public.app_secrets where key = 'twilio_hook_key')),
    body    := p_body,
    timeout_milliseconds := 60000
  );
$$;
revoke all on function public.call_twilio_numbers(jsonb) from public, anon, authenticated;

create or replace function public.issue_number_when_live()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.published and new.proxy_phone is null
     and (tg_op = 'INSERT' or not coalesce(old.published, false)) then
    perform public.call_twilio_numbers(
      jsonb_build_object('action', 'issue', 'therapist_id', new.id));
  end if;
  return new;
end $$;

drop trigger if exists therapist_number_issue on public.therapist_profiles;
create trigger therapist_number_issue
  after insert or update on public.therapist_profiles
  for each row execute function public.issue_number_when_live();
