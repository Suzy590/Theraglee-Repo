-- The administrator can open the practice dashboard as well as the member one.
-- Everything on it already lets an admin through (listings, messages and the
-- clinician library all carry an is_admin() clause), except the list of members
-- who switched on Theraglee Match Mode, which only an active therapist could
-- read. Let the admin read it too, so the Member requests tab works for them.

create or replace view public.member_discovery
with (security_invoker = off) as
select
  p.id,
  coalesce(nullif(trim(p.full_name), ''), 'Theraglee member') as display_name,
  p.issues,
  p.zip,
  p.created_at,
  exists (
    select 1
    from public.therapist_outreach o
    join public.therapist_profiles t on t.id = o.therapist_id
    where o.member_id = p.id and t.user_id = auth.uid()
  ) as already_contacted
from public.profiles p
where p.visible_to_therapists
  and p.role = 'member'
  and (public.is_active_therapist() or public.is_admin());
