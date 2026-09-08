-- =============================================================================
-- Members hold only the four row privileges on public tables.
-- -----------------------------------------------------------------------------
-- Supabase's default privileges for the `postgres` role hand every new table
-- in `public` to `anon` and `authenticated` wholesale: SELECT, INSERT, UPDATE,
-- DELETE, and also TRUNCATE, REFERENCES, TRIGGER and (on Postgres 17)
-- MAINTAIN. Row-level security governs the first four. It does not apply to
-- TRUNCATE at all, so a signed-in member with the TRUNCATE privilege could
-- empty a whole table — journal_entries, favorites, mood_logs, quiz_attempts,
-- therapist_profiles — in one statement, policies or not. REFERENCES, TRIGGER
-- and MAINTAIN are likewise things no browser session should ever hold.
--
-- On 2026-09-08, 49 relations in public granted TRUNCATE to authenticated and
-- 48 to anon. profiles (20260907090000) and trivia_scores (20260908120000) had
-- already been closed one at a time; this closes the rest and changes the
-- default so tables created later start out closed too.
--
-- SELECT, INSERT, UPDATE and DELETE are left exactly as they are, so nothing
-- the site does changes. service_role and postgres are untouched.
-- =============================================================================

-- 1. Every existing table and view in public.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on all tables in schema public from anon, authenticated';
  end if;
end $$;

-- 2. Tables created from now on by postgres (the role migrations run as).
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;

do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'alter default privileges for role postgres in schema public revoke maintain on tables from anon, authenticated';
  end if;
end $$;

-- 3. Prove it. Fails the migration if any public relation still grants one of
--    these to a browser role.
do $$
declare
  n int;
begin
  select count(*) into n
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated')
    and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN');
  if n > 0 then
    raise exception 'member roles still hold % table-level privilege grant(s) in public', n;
  end if;
end $$;
