-- =============================================================================
-- Stream profile changes to the admin screen.
-- -----------------------------------------------------------------------------
-- The Memberships tab on admin.html shows how many members have Theraglee
-- Match Mode switched on, and keeps the number current as members flip the
-- switch. Supabase Realtime only sends changes for tables in the
-- `supabase_realtime` publication, which held none; this adds `profiles`.
--
-- Who hears what is still decided by the table's row-level security: Realtime
-- checks every change against the listener's policies, so an administrator
-- ("admin reads all profiles") hears about every row and a member hears only
-- about their own. Nobody who could not already select a row is told about it.
-- The admin page does not read the change itself; it re-counts.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
