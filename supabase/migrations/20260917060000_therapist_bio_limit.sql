-- =============================================================================
-- Short bio: 1,400 characters at most.
-- -----------------------------------------------------------------------------
-- The Short bio box on My profile stops at 1,400 characters and the page
-- refuses to save a longer one. This check keeps the same limit on the column
-- so it holds however the value arrives. No saved bio was longer when it was
-- added.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'therapist_profiles_bio_len') then
    alter table public.therapist_profiles
      add constraint therapist_profiles_bio_len
      check (bio is null or char_length(bio) <= 1400);
  end if;
end $$;
