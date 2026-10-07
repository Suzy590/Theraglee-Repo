-- Blocking a therapist now covers every conversation, not only Match Mode.
--
-- Until now member_blocks only stopped a therapist from seeing a member in
-- Match Mode and writing to them through therapist_outreach. A conversation
-- the member started from the therapist's profile (therapist_messages, with
-- therapist_message_replies for every later turn) had no block at all. The
-- member's inbox now offers Block this therapist on those threads too, and a
-- blocked therapist can no longer write back on one. They keep what was
-- already said, and the member can unblock from the same place.

comment on table public.member_blocks is
  'A member blocking a therapist: the therapist no longer sees them in Match Mode and cannot write to them, in Match Mode or on a conversation the member started from the therapist''s profile.';

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
    and not public.member_blocked(therapist_id, member_id)
  );
