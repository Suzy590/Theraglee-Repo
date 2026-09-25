-- =============================================================================
-- Admin membership management and discount codes.
-- -----------------------------------------------------------------------------
-- From /admin.html (Memberships and Discount codes tabs) an admin can now add
-- members and therapists, move them between plans, end a membership, and make
-- discount codes. The work is done by the `admin-membership` Edge Function
-- with the service role; this migration adds what it stores.
--
-- 1. Complimentary memberships. An account with no Stripe subscription can be
--    put on a plan by an admin. It is marked subscription_status = 'comped',
--    and sub_active() counts that as active, so user_level(),
--    is_active_therapist() and everything built on them treat it as paid.
--    supabase/functions/_shared/billing.ts `isActive` mirrors this list.
--
-- 2. discount_codes: one row per code an admin made. The code itself lives in
--    Stripe (a coupon plus a promotion code); this row is the admin screen's
--    list, and what the `stripe-redeem` function checks a code against when
--    a paying member enters it on their account page. Admins read it; only
--    the Edge Functions (service role) write it.
-- =============================================================================

create or replace function public.sub_active(p_status text)
returns boolean
language sql
immutable
set search_path to 'public'
as $$
  select coalesce(p_status in ('active', 'trialing', 'comped'), false)
$$;

create table if not exists public.discount_codes (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null,
  stripe_coupon_id    text not null,
  stripe_promotion_id text not null unique,
  percent_off         smallint check (percent_off between 1 and 100),
  amount_off_cents    integer  check (amount_off_cents > 0),
  duration            text not null check (duration in ('once', 'repeating', 'forever')),
  duration_in_months  smallint check (duration_in_months between 1 and 36),
  audience            text not null default 'all' check (audience in ('all', 'member', 'therapist')),
  max_redemptions     integer check (max_redemptions > 0),
  expires_at          timestamptz,
  active              boolean not null default true,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  check ((percent_off is null) <> (amount_off_cents is null)),
  check ((duration = 'repeating') = (duration_in_months is not null))
);

-- Stripe treats codes case-insensitively, and so do we.
create unique index if not exists discount_codes_code_key on public.discount_codes (upper(code));

alter table public.discount_codes enable row level security;

drop policy if exists discount_codes_admin_read on public.discount_codes;
create policy discount_codes_admin_read on public.discount_codes
  for select to authenticated
  using (public.is_admin());

revoke all on public.discount_codes from anon;
revoke insert, update, delete, truncate, references, trigger on public.discount_codes from authenticated;
grant select on public.discount_codes to authenticated;
