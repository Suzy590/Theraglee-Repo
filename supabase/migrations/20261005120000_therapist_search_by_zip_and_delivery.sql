-- =============================================================================
-- Find a therapist: a zip code search is shaped by how the visitor wants to meet.
-- -----------------------------------------------------------------------------
-- therapists.html asks a visitor who types a zip code whether they want
-- in-person sessions, telehealth (video), or either, and search_therapists
-- now reads the two together:
--
--   In person            Therapists who offer in-person sessions (delivery
--                        in_person or both) with a practice location in the
--                        visitor's zip code area: every zip code that starts
--                        with the same three digits.
--   Telehealth or Either Therapists who offer telehealth (delivery telehealth
--                        or both) and are licensed in the zip code's state,
--                        anywhere in that state. Video sessions do not depend
--                        on distance, only on where the therapist is licensed.
--
-- Without a zip code nothing changes: Either means any therapist, In person
-- and Telehealth keep matching the therapist's delivery (a therapist offering
-- both appears under each), and the State filter works as before.
--
-- The zip code's state comes from zip_state(text) below, a table of the USPS
-- three-digit prefixes by state. site/assets/zip-state.js holds the same table
-- for the page, and tests/zip-state/check.mjs makes sure the two agree.
--
-- search_therapists was created in the Supabase Dashboard before this
-- repository tracked migrations; this file is now its source. The signature is
-- unchanged, so the generated county landing pages (p_state only) and the
-- directory page keep working.
-- =============================================================================

create or replace function public.zip_state(p_zip text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  with z as (
    select regexp_replace(coalesce(p_zip, ''), '[^0-9]', '', 'g') as digits
  )
  select v.state
    from z, (values
      ('005','005','NY'),
      ('010','027','MA'),
      ('028','029','RI'),
      ('030','038','NH'),
      ('039','049','ME'),
      ('050','054','VT'),
      ('055','055','MA'),
      ('056','059','VT'),
      ('060','069','CT'),
      ('070','089','NJ'),
      ('100','149','NY'),
      ('150','196','PA'),
      ('197','199','DE'),
      ('200','200','DC'),
      ('201','201','VA'),
      ('202','205','DC'),
      ('206','219','MD'),
      ('220','246','VA'),
      ('247','268','WV'),
      ('270','289','NC'),
      ('290','299','SC'),
      ('300','319','GA'),
      ('320','339','FL'),
      ('341','349','FL'),
      ('350','369','AL'),
      ('370','385','TN'),
      ('386','397','MS'),
      ('398','399','GA'),
      ('400','427','KY'),
      ('430','459','OH'),
      ('460','479','IN'),
      ('480','499','MI'),
      ('500','528','IA'),
      ('530','549','WI'),
      ('550','567','MN'),
      ('569','569','DC'),
      ('570','577','SD'),
      ('580','588','ND'),
      ('590','599','MT'),
      ('600','629','IL'),
      ('630','658','MO'),
      ('660','679','KS'),
      ('680','693','NE'),
      ('700','714','LA'),
      ('716','729','AR'),
      ('730','731','OK'),
      ('733','733','TX'),
      ('734','749','OK'),
      ('750','799','TX'),
      ('800','816','CO'),
      ('820','831','WY'),
      ('832','839','ID'),
      ('840','847','UT'),
      ('850','865','AZ'),
      ('870','884','NM'),
      ('885','885','TX'),
      ('889','898','NV'),
      ('900','961','CA'),
      ('967','968','HI'),
      ('970','979','OR'),
      ('980','994','WA'),
      ('995','999','AK')
    ) as v(lo, hi, state)
   where z.digits ~ '^[0-9]{5}'
     and left(z.digits, 3) between v.lo and v.hi
   limit 1;
$$;

comment on function public.zip_state(text) is
  'The state a five-digit US zip code is in, by its first three digits; null for anything else. Same table as site/assets/zip-state.js.';

grant execute on function public.zip_state(text) to anon, authenticated, service_role;

create or replace function public.search_therapists(
  p_q text default null,
  p_zip text default null,
  p_state text default null,
  p_specialty text default null,
  p_insurance text default null,
  p_gender text default null,
  p_delivery text default null,
  p_language text default null,
  p_limit integer default 24,
  p_offset integer default 0)
returns setof public.therapist_directory
language sql
stable
set search_path to 'public'
as $$
  with ask as (
    select nullif(regexp_replace(coalesce(p_zip, ''), '[^0-9]', '', 'g'), '') as digits,
           coalesce(p_delivery, '') as delivery
  ), area as (
    select digits is not null as has_zip,
           left(digits, 5) as zip,
           left(digits, 3) as prefix,
           public.zip_state(digits) as state,
           delivery
      from ask
  )
  select d.*
    from public.therapist_directory d
   cross join area a
   where (p_q is null or p_q = '' or
          (d.first_name || ' ' || d.last_name || ' ' || coalesce(d.bio, '')) ilike '%' || p_q || '%')
     and (p_state is null or p_state = '' or d.license_states @> array[p_state])
     and (p_specialty is null or p_specialty = '' or d.specialties @> array[p_specialty])
     and (p_insurance is null or p_insurance = '' or d.insurances @> array[p_insurance])
     and (p_gender is null or p_gender = '' or d.gender = p_gender)
     and (p_language is null or p_language = '' or d.languages @> array[p_language])
     -- How they meet. With a zip code, Either means by video, like Telehealth.
     and (case
            when a.delivery = 'in_person' then d.delivery in ('in_person', 'both')
            when a.delivery = 'telehealth' or a.has_zip then d.delivery in ('telehealth', 'both')
            else true
          end)
     -- Where. In person: an office in the zip code area. Telehealth or
     -- either: licensed in the zip code's state, anywhere in it.
     and (not a.has_zip
          or (a.delivery = 'in_person' and exists (
                select 1 from jsonb_array_elements(coalesce(d.locations, '[]'::jsonb)) loc
                 where left(regexp_replace(coalesce(loc->>'zip', ''), '[^0-9]', '', 'g'), 3) = a.prefix))
          or (a.delivery <> 'in_person' and a.state is not null and d.license_states @> array[a.state]))
   -- For an in-person search, an office in the very same zip code comes first.
   order by case when a.has_zip and a.delivery = 'in_person' and exists (
              select 1 from jsonb_array_elements(coalesce(d.locations, '[]'::jsonb)) loc
               where left(regexp_replace(coalesce(loc->>'zip', ''), '[^0-9]', '', 'g'), 5) = a.zip)
            then 0 else 1 end,
            array_length(d.top_specialties, 1) desc nulls last,
            d.created_at desc
   limit least(coalesce(p_limit, 24), 100) offset coalesce(p_offset, 0);
$$;

comment on function public.search_therapists(text, text, text, text, text, text, text, text, integer, integer) is
  'The directory search behind therapists.html. With p_zip, p_delivery in_person means an office in the zip code area (same first three digits); telehealth or empty means licensed in the zip code''s state and offering telehealth.';

grant execute on function public.search_therapists(text, text, text, text, text, text, text, text, integer, integer)
  to anon, authenticated, service_role;
