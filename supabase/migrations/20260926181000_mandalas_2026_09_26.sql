-- =============================================================================
-- Daily mandalas for 2026-09-26: two new shaped mandalas, a lion and a
-- strawberry, for 282 in all.
-- -----------------------------------------------------------------------------
-- The outlines are in site/assets/mandala-shapes.js (docs/mandalas.md has the
-- daily routine). Premium, like the others (min_level defaults to 3).
-- Re-running is harmless.
-- =============================================================================

insert into public.mandalas (slug, title, seed, shape) values
  ('sunny-lion', 'Sunny Lion', 2024, 'lion'),
  ('sweet-strawberry', 'Sweet Strawberry', 74363, 'strawberry')
on conflict (slug) do nothing;
