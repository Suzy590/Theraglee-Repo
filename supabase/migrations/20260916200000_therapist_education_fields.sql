-- =============================================================================
-- Education on the therapist profile: school, degree and year, not one line.
-- -----------------------------------------------------------------------------
-- The My profile tab asked for education as a single free-text line. It now
-- has an Education section with three fields — school most recently graduated
-- (100 characters), degree or diploma, and the year graduated — stored in the
-- three columns below.
--
-- The old `education` column stays and is written by the page on every save
-- as the one-line form of the three ("Master of Science, CSU Northridge,
-- 2007"), so therapist.html, the directory's Quick look and anything else that
-- shows `education` keep working unchanged. The three columns are appended to
-- the public directory view for anything that wants them structured.
-- =============================================================================

alter table public.therapist_profiles
  add column if not exists education_school text,
  add column if not exists education_degree text,
  add column if not exists education_year   smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'therapist_profiles_education_school_len') then
    alter table public.therapist_profiles
      add constraint therapist_profiles_education_school_len
      check (education_school is null or char_length(education_school) <= 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'therapist_profiles_education_degree_len') then
    alter table public.therapist_profiles
      add constraint therapist_profiles_education_degree_len
      check (education_degree is null or char_length(education_degree) <= 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'therapist_profiles_education_year_sane') then
    alter table public.therapist_profiles
      add constraint therapist_profiles_education_year_sane
      check (education_year is null or education_year between 1900 and 2100);
  end if;
end $$;

create or replace view public.therapist_directory as
  select id,
    slug,
    first_name,
    last_name,
    credentials,
    gender,
    bio,
    photo_url,
    practice_photos,
    license_states,
    insurances,
    delivery,
    locations,
    website,
    fees,
    education,
    specialties,
    top_specialties,
    age_ranges,
    participants,
    treatment_modalities,
    languages,
    verified_at,
    created_at,
    proxy_phone as tracking_phone,
    contact_email is not null as accepts_messages,
    (accepts_payments and charges_enabled and session_fee_cents is not null) as accepts_payments,
    case when accepts_payments and charges_enabled then session_fee_cents end as session_fee_cents,
    identity_status = 'verified' as identity_verified,
    payment_methods,
    education_school,
    education_degree,
    education_year
  from public.therapist_profiles t
  where published and verification = 'verified';
