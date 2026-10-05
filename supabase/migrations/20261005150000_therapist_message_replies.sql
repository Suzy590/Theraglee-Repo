-- A message sent through a therapist's profile ("Send a message" on
-- therapist.html) lands in the therapist's Theraglee inbox: the Messages tab
-- of the practice dashboard. Until now the therapist answered it by email.
-- From here on the answer stays inside Theraglee too: the therapist writes
-- back from that tab, the member reads it on the Messages tab of their
-- dashboard (the Inbox tab of the account page shows the same), and the
-- member can write back from there. Neither side sees the other's email
-- address, the same arrangement Match Mode conversations already use.
--
-- The opening message stays in therapist_messages (written only by the
-- contact-therapist Edge Function, which now requires the sender to be signed
-- in so there is an inbox to answer to). Every later turn of the conversation
-- is a row here, marked with who wrote it.

create table if not exists public.therapist_message_replies (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references public.therapist_messages(id) on delete cascade,
  therapist_id uuid not null references public.therapist_profiles(id) on delete cascade,
  member_id    uuid not null references auth.users(id) on delete cascade,
  sender       text not null check (sender in ('therapist', 'member')),
  message      text not null check (length(btrim(message)) between 2 and 4000),
  -- Stamped by the reader: the member for a therapist's reply, the therapist
  -- for a member's. Empty means unread, and the dashboards count those.
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists therapist_message_replies_thread_idx
  on public.therapist_message_replies (message_id, created_at);
create index if not exists therapist_message_replies_member_unread_idx
  on public.therapist_message_replies (member_id) where read_at is null;
create index if not exists therapist_message_replies_therapist_unread_idx
  on public.therapist_message_replies (therapist_id) where read_at is null;

alter table public.therapist_message_replies enable row level security;

revoke all on public.therapist_message_replies from public, anon, authenticated;
grant select on public.therapist_message_replies to authenticated;
grant insert (message_id, therapist_id, member_id, sender, message)
  on public.therapist_message_replies to authenticated;
grant update (read_at) on public.therapist_message_replies to authenticated;

-- The therapist answers a message sent to their own listing, and only one
-- that came from a signed-in member, so the reply has an inbox to land in.
drop policy if exists "therapist replies to own messages" on public.therapist_message_replies;
create policy "therapist replies to own messages" on public.therapist_message_replies
  for insert to authenticated
  with check (
    sender = 'therapist'
    and exists (
      select 1 from public.therapist_profiles t
      where t.id = therapist_id and t.user_id = auth.uid())
    and exists (
      select 1 from public.therapist_messages m
      where m.id = message_id
        and m.therapist_id = therapist_message_replies.therapist_id
        and m.sender_user_id is not null
        and m.sender_user_id = therapist_message_replies.member_id)
  );

-- The member writes back on a conversation they started.
drop policy if exists "member writes back on own message" on public.therapist_message_replies;
create policy "member writes back on own message" on public.therapist_message_replies
  for insert to authenticated
  with check (
    sender = 'member'
    and member_id = auth.uid()
    and exists (
      select 1 from public.therapist_messages m
      where m.id = message_id
        and m.therapist_id = therapist_message_replies.therapist_id
        and m.sender_user_id = auth.uid())
  );

drop policy if exists "therapist reads own message replies" on public.therapist_message_replies;
create policy "therapist reads own message replies" on public.therapist_message_replies
  for select using (
    exists (select 1 from public.therapist_profiles t
            where t.id = therapist_id and t.user_id = auth.uid()));

drop policy if exists "member reads own message replies" on public.therapist_message_replies;
create policy "member reads own message replies" on public.therapist_message_replies
  for select using (member_id = auth.uid());

-- Each side marks the other's turns read; nobody marks their own.
drop policy if exists "therapist marks member replies read" on public.therapist_message_replies;
create policy "therapist marks member replies read" on public.therapist_message_replies
  for update using (
    sender = 'member'
    and exists (select 1 from public.therapist_profiles t
                where t.id = therapist_id and t.user_id = auth.uid()))
  with check (
    sender = 'member'
    and exists (select 1 from public.therapist_profiles t
                where t.id = therapist_id and t.user_id = auth.uid()));

drop policy if exists "member marks therapist replies read" on public.therapist_message_replies;
create policy "member marks therapist replies read" on public.therapist_message_replies
  for update using (sender = 'therapist' and member_id = auth.uid())
  with check (sender = 'therapist' and member_id = auth.uid());

drop policy if exists "admin reads message replies" on public.therapist_message_replies;
create policy "admin reads message replies" on public.therapist_message_replies
  for select using (public.is_admin());
