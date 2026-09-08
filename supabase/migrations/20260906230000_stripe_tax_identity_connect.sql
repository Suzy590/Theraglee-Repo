-- Stripe: Tax, Identity, Connect and Radar support.
--
-- Adds the columns and tables the Stripe Edge Functions in supabase/functions/
-- write to, seeds the admin switches in app_config, and teaches the publish
-- guard about identity verification. Everything here is additive.

-- ------------------------------------------------------------- switches
insert into public.app_config (key, value) values
  ('stripe_tax_enabled',     'false'),  -- Stripe Tax on membership checkouts (needs Tax set up in the Dashboard first)
  ('identity_required',      'false'),  -- listing cannot publish until Stripe Identity passes
  ('connect_enabled',        'false'),  -- therapists can set up payouts and take session payments
  ('platform_fee_percent',   '10'),     -- Theraglee's cut of a session payment
  ('platform_fee_min_cents', '100')     -- ...never less than this
on conflict (key) do nothing;

-- ------------------------------------------------------ therapist_profiles
alter table public.therapist_profiles
  add column if not exists identity_status       text not null default 'unverified',
  add column if not exists identity_session_id   text,
  add column if not exists identity_verified_at  timestamptz,
  add column if not exists identity_last_error   text,
  add column if not exists stripe_account_id     text,
  add column if not exists stripe_account_status text not null default 'none',
  add column if not exists charges_enabled       boolean not null default false,
  add column if not exists payouts_enabled       boolean not null default false,
  add column if not exists accepts_payments      boolean not null default false,
  add column if not exists session_fee_cents     integer;

alter table public.therapist_profiles
  drop constraint if exists therapist_identity_status_check,
  add  constraint therapist_identity_status_check
    check (identity_status in ('unverified','pending','verified','requires_input','canceled')),
  drop constraint if exists therapist_stripe_account_status_check,
  add  constraint therapist_stripe_account_status_check
    check (stripe_account_status in ('none','onboarding','enabled','restricted')),
  drop constraint if exists therapist_session_fee_check,
  add  constraint therapist_session_fee_check
    check (session_fee_cents is null or session_fee_cents between 500 and 100000);

create unique index if not exists therapist_profiles_stripe_account_id_key
  on public.therapist_profiles (stripe_account_id) where stripe_account_id is not null;

-- ------------------------------------------------------------ stripe_events
alter table public.stripe_events
  add column if not exists processed_at timestamptz,
  add column if not exists error        text,
  add column if not exists account      text;   -- connected account id for Connect events

-- Events received before this migration were applied on arrival.
update public.stripe_events set processed_at = received_at where processed_at is null;

-- --------------------------------------------------------- session_payments
create table if not exists public.session_payments (
  id                  uuid primary key default gen_random_uuid(),
  checkout_session_id text not null unique,
  payment_intent_id   text,
  therapist_id        uuid not null references public.therapist_profiles(id) on delete restrict,
  payer_user_id       uuid references public.profiles(id) on delete set null,
  payer_email         text,
  amount_cents        integer not null,
  fee_cents           integer not null default 0,
  refunded_cents      integer not null default 0,
  currency            text not null default 'usd',
  status              text not null default 'pending'
                      check (status in ('pending','paid','refunded','partially_refunded','disputed')),
  created_at          timestamptz not null default now(),
  paid_at             timestamptz,
  refunded_at         timestamptz
);
create index if not exists session_payments_therapist_idx on public.session_payments (therapist_id, created_at desc);
create index if not exists session_payments_payer_idx     on public.session_payments (payer_user_id, created_at desc);
create index if not exists session_payments_pi_idx        on public.session_payments (payment_intent_id);

alter table public.session_payments enable row level security;

drop policy if exists session_payments_therapist_read on public.session_payments;
create policy session_payments_therapist_read on public.session_payments
  for select to authenticated
  using (therapist_id in (select t.id from public.therapist_profiles t where t.user_id = auth.uid()));

drop policy if exists session_payments_payer_read on public.session_payments;
create policy session_payments_payer_read on public.session_payments
  for select to authenticated
  using (payer_user_id = auth.uid());

drop policy if exists session_payments_admin_read on public.session_payments;
create policy session_payments_admin_read on public.session_payments
  for select to authenticated
  using (public.is_admin());
-- Writes come only from the Edge Functions (service role bypasses RLS).

-- ------------------------------------------------------------ billing_alerts
-- Disputes and Radar early-fraud warnings, for the admin screen.
create table if not exists public.billing_alerts (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,
  stripe_id   text not null,
  customer_id text,
  user_id     uuid references public.profiles(id) on delete set null,
  summary     text not null,
  raw         jsonb,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists billing_alerts_open_idx on public.billing_alerts (created_at desc) where resolved_at is null;

alter table public.billing_alerts enable row level security;

drop policy if exists billing_alerts_admin on public.billing_alerts;
create policy billing_alerts_admin on public.billing_alerts
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------- guards
-- The Edge Functions write with the service role, which has no auth.uid() and
-- so previously counted as "not admin": that froze the very columns the
-- webhook and the license checker exist to update. The service role is server
-- side only, so let it through; keep freezing Stripe-managed columns for
-- everyone else, and require an identity check before publishing when the
-- admin has switched that on.
create or replace function public.guard_therapist_verification()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  paid    boolean;
  need_id boolean;
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  new.verification  := old.verification;
  new.verified_at   := old.verified_at;
  new.proxy_phone   := old.proxy_phone;
  new.proxy_email   := old.proxy_email;
  new.proxy_phone_provider    := old.proxy_phone_provider;
  new.proxy_phone_sid         := old.proxy_phone_sid;
  new.proxy_phone_assigned_at := old.proxy_phone_assigned_at;

  -- Stripe-managed: only the webhook and the Stripe functions may change these.
  new.identity_status       := old.identity_status;
  new.identity_session_id   := old.identity_session_id;
  new.identity_verified_at  := old.identity_verified_at;
  new.identity_last_error   := old.identity_last_error;
  new.stripe_account_id     := old.stripe_account_id;
  new.stripe_account_status := old.stripe_account_status;
  new.charges_enabled       := old.charges_enabled;
  new.payouts_enabled       := old.payouts_enabled;

  if new.published then
    select public.sub_active(p.subscription_status) into paid
    from public.profiles p where p.id = new.user_id;
    select coalesce(c.value = 'true', false) into need_id
    from public.app_config c where c.key = 'identity_required';
    if new.verification <> 'verified'
       or not coalesce(paid, false)
       or (coalesce(need_id, false) and new.identity_status <> 'verified') then
      new.published := false;
    end if;
  end if;
  return new;
end $function$;

create or replace function public.guard_therapist_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    new.verification := 'pending';
    new.verified_at  := null;
    new.published    := false;
    new.proxy_phone  := null;      -- issued by Theraglee after verification
    new.proxy_email  := null;
    new.proxy_phone_provider := null;
    new.proxy_phone_sid := null;
    new.proxy_phone_assigned_at := null;
    new.identity_status       := 'unverified';
    new.identity_session_id   := null;
    new.identity_verified_at  := null;
    new.identity_last_error   := null;
    new.stripe_account_id     := null;
    new.stripe_account_status := 'none';
    new.charges_enabled       := false;
    new.payouts_enabled       := false;
  end if;
  if new.slug is null then
    new.slug := regexp_replace(
      lower(new.first_name || '-' || new.last_name || '-' || substr(new.id::text, 1, 6)),
      '[^a-z0-9]+', '-', 'g');
  end if;
  return new;
end $function$;

-- -------------------------------------------------------------- directory
-- The public view gains what therapist.html needs to offer "Pay for a session".
-- (create or replace can only append columns, which is why they sit last.)
-- The view stays security definer, as it was created: that is how visitors
-- without an account read published listings past the table's row security.
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
    identity_status = 'verified' as identity_verified
  from public.therapist_profiles t
  where published and verification = 'verified'::verification_status;
