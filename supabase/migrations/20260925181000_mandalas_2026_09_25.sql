-- =============================================================================
-- Daily mandalas for 2026-09-25: two new shaped mandalas, an octopus and a
-- maple leaf, for 280 in all.
-- -----------------------------------------------------------------------------
-- The outlines are in site/assets/mandala-shapes.js (docs/mandalas.md has the
-- daily routine). Premium, like the others (min_level defaults to 3).
-- Re-running is harmless.
-- =============================================================================

insert into public.mandalas (slug, title, seed, shape) values
  ('gentle-octopus', 'Gentle Octopus', 299497, 'octopus'),
  ('autumn-maple', 'Autumn Maple', 223484, 'maple')
on conflict (slug) do nothing;
