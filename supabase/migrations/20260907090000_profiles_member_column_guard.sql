-- =============================================================================
-- Members may edit their own profile, never their own membership.
-- -----------------------------------------------------------------------------
-- The `own profile update` policy lets a signed-in member update their own
-- row, and until now the `authenticated` role held UPDATE on every column of
-- profiles. That meant a member could set tier = 'premium' and
-- subscription_status = 'active' from the browser and user_level() would
-- hand them Premium; or set role = 'admin' and is_admin() would believe it.
--
-- Access is supposed to be decided by the database, so this closes it at the
-- privilege layer: the browser may change only the fields the site actually
-- edits (name, zip, topics, the morning-email switches, onboarding, and the
-- therapist reach-out switch). Tier, role, billing columns and the unsubscribe
-- token can be written only by the service role — the Stripe webhook and the
-- daily digest — and by the owner in the Supabase dashboard.
--
-- profiles rows are created by the handle_new_user trigger on auth.users, so
-- the client never needs INSERT, and nothing in the site deletes a profile.
-- =============================================================================

revoke all on public.profiles from anon;
revoke insert, update, delete, truncate, references, trigger on public.profiles from authenticated;

grant update (full_name, zip, issues, daily_email, daily_email_kinds, onboarded, visible_to_therapists)
  on public.profiles to authenticated;
