-- =============================================================================
-- Ages seen: plain terms, plus two optional age-range boxes.
-- -----------------------------------------------------------------------------
-- The Ages seen chips on My profile are now Children, Teens, Young adults,
-- Adults and Senior adults. They are still stored in `age_ranges`; the
-- bracketed values the page used to write ("Adults (26–64)" and the like) are
-- renamed below so nobody's selection is lost.
--
-- Under the chips the page now has two optional boxes for the specific ages a
-- therapist sees ("6–12", "18 and up"), stored in the two columns below and
-- appended to the public directory view. They show on the full profile and in
-- Quick look, not on the collapsed card.
-- =============================================================================

alter table public.therapist_profiles
  add column if not exists age_range_1 text,
  add column if not exists age_range_2 text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'therapist_profiles_age_range_1_len') then
    alter table public.therapist_profiles
      add constraint therapist_profiles_age_range_1_len
      check (age_range_1 is null or char_length(age_range_1) <= 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'therapist_profiles_age_range_2_len') then
    alter table public.therapist_profiles
      add constraint therapist_profiles_age_range_2_len
      check (age_range_2 is null or char_length(age_range_2) <= 40);
  end if;
end $$;

-- Rename the earlier chip values in place, keeping each profile's order.
update public.therapist_profiles
   set age_ranges = array(
     select case v
              when 'Children (under 12)'  then 'Children'
              when 'Teens (13–17)'        then 'Teens'
              when 'Young adults (18–25)' then 'Young adults'
              when 'Adults (26–64)'       then 'Adults'
              when 'Older adults (65+)'   then 'Senior adults'
              else v end
       from unnest(age_ranges) with ordinality as u(v, ord)
      order by ord)
 where age_ranges && array['Children (under 12)','Teens (13–17)','Young adults (18–25)',
                           'Adults (26–64)','Older adults (65+)'];

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
    education_year,
    age_range_1,
    age_range_2
  from public.therapist_profiles t
  where published and verification = 'verified';
