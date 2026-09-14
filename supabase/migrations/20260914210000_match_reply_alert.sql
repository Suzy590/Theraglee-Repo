-- =============================================================================
-- Email a therapist when a member answers their Match Mode message.
-- -----------------------------------------------------------------------------
-- Replies from members landed only on the practice dashboard. This wires the
-- database to the match-reply-alert Edge Function
-- (supabase/functions/match-reply-alert) so that every new row in
-- outreach_replies emails the therapist, with the member's name and message
-- and a link back to the Member requests tab.
--
-- The function authenticates the database's call with a shared key in
-- app_secrets, the same way verify-license and the daily digest do, and
-- records the outcome on the reply row.
-- =============================================================================

alter table public.outreach_replies
  add column if not exists notified_at  timestamptz,
  add column if not exists notify_error text;

comment on column public.outreach_replies.notified_at is
  'When the therapist was emailed about this reply. Null until the alert goes out.';
comment on column public.outreach_replies.notify_error is
  'Why the email did not go out, if it did not (for example email_not_configured).';

-- --------------------------------------------------------------- the key --
insert into public.app_secrets (key, value)
values ('match_hook_key', encode(gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- ------------------------------------------------------------ the caller --
-- pg_net runs the request after the transaction commits, so the function
-- sees the committed reply.
create or replace function public.call_match_reply_alert(p_body jsonb)
returns void
language sql security definer set search_path to 'public'
as $$
  select net.http_post(
    url     := 'https://oekqzuguruyqkafsqhos.supabase.co/functions/v1/match-reply-alert',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-match-key', (select value from public.app_secrets where key = 'match_hook_key')),
    body    := p_body,
    timeout_milliseconds := 30000
  );
$$;
revoke all on function public.call_match_reply_alert(jsonb) from public, anon, authenticated;

-- ------------------------------------------------- a member replied --
create or replace function public.notify_match_reply()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  perform public.call_match_reply_alert(jsonb_build_object('reply_id', new.id));
  return new;
end $$;

drop trigger if exists outreach_reply_alert on public.outreach_replies;
create trigger outreach_reply_alert
  after insert on public.outreach_replies
  for each row execute function public.notify_match_reply();
