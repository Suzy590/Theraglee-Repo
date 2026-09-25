-- =============================================================================
-- Six more plant outlines for the shaped mandalas: sunflower, rose, cactus,
-- acorn, pineapple and clover, two mandalas each, for 266 in all.
-- -----------------------------------------------------------------------------
-- The outlines are in site/assets/mandala-shapes.js; the shape column and
-- how a shaped mandala is drawn arrived in 20260924180000_shaped_mandalas.sql.
-- Premium, like the others (min_level defaults to 3). Re-running is harmless.
-- =============================================================================

insert into public.mandalas (slug, title, seed, shape) values
  ('summer-sunflower', 'Summer Sunflower', 12001, 'sunflower'),
  ('sunflower-field', 'Sunflower Field', 12008, 'sunflower'),
  ('garden-rose', 'Garden Rose', 12101, 'rose'),
  ('wild-rose', 'Wild Rose', 12108, 'rose'),
  ('desert-cactus', 'Desert Cactus', 12201, 'cactus'),
  ('little-cactus', 'Little Cactus', 12208, 'cactus'),
  ('tiny-acorn', 'Tiny Acorn', 12301, 'acorn'),
  ('autumn-acorn', 'Autumn Acorn', 12308, 'acorn'),
  ('sweet-pineapple', 'Sweet Pineapple', 12401, 'pineapple'),
  ('tropical-pineapple', 'Tropical Pineapple', 12408, 'pineapple'),
  ('lucky-clover', 'Lucky Clover', 12501, 'clover'),
  ('clover-patch', 'Clover Patch', 12508, 'clover')
on conflict (slug) do nothing;
