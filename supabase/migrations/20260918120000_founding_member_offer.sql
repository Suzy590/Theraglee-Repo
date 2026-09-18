-- Therapist founding-member offer.
--
-- A discounted monthly therapist rate sold only while the offer is open. The
-- offer is entirely configuration: a Stripe price id, the dollar amount shown
-- on the site, an optional cap on spots, an optional last day to join, and the
-- switch. All are edited from /admin.html (Stripe setup tab) and read by
-- site/for-therapists.html, site/therapist-dashboard.html and the
-- stripe-checkout function. Nothing else changes; the webhook recognizes the
-- founding price as the therapist plan through supabase/functions/_shared/billing.ts.
insert into public.app_config (key, value) values
  ('founding_enabled',           'false'),       -- the switch: offer shown and sold
  ('price_therapist_founding',   ''),            -- Stripe price id (monthly) for the founding rate
  ('display_therapist_founding', '20'),          -- dollars a month, as shown on the site
  ('founding_spots',             '150'),         -- how many therapists may take it; blank = no cap
  ('founding_deadline',          '2026-12-31')   -- last day to join, YYYY-MM-DD; blank = no deadline
on conflict (key) do nothing;
