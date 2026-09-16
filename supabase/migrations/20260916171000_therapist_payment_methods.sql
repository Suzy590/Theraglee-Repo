-- =============================================================================
-- A therapist lists the payment methods their practice accepts.
-- -----------------------------------------------------------------------------
-- The My profile tab gains a Payment section: a multi-select of the ways the
-- practice takes payment (ACH bank transfer, American Express, Apple Cash,
-- Cash, Check, Discover, Health Savings Account, Mastercard, PayPal, Venmo,
-- Visa, Wire, Zelle — the list is PAYMENT_METHODS in site/assets/lists.js).
-- This is about paying the practice directly; it is separate from "Get paid
-- through Theraglee", which is Stripe session payments through the site.
--
-- The choices are stored as text[] like insurances, and the public directory
-- view carries the column so therapist.html can show them. create or replace
-- can only append columns to a view, which is why payment_methods sits last.
-- authenticated already holds INSERT and UPDATE on the whole table, so the
-- browser can write the new column with no further grant.
-- =============================================================================

alter table public.therapist_profiles
  add column if not exists payment_methods text[] not null default '{}';

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
    payment_methods
  from public.therapist_profiles t
  where published and verification = 'verified';
