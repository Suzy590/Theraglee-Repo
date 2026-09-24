-- =============================================================================
-- Six more animal outlines for the shaped mandalas: fox, horse, bear, deer,
-- penguin and hedgehog, two mandalas each, for 254 in all.
-- -----------------------------------------------------------------------------
-- The outlines are in site/assets/mandala-shapes.js; the shape column and
-- how a shaped mandala is drawn arrived in 20260924180000_shaped_mandalas.sql.
-- Premium, like the others (min_level defaults to 3). Re-running is harmless.
-- =============================================================================

insert into public.mandalas (slug, title, seed, shape) values
  ('clever-fox', 'Clever Fox', 11101, 'fox'),
  ('autumn-fox', 'Autumn Fox', 11108, 'fox'),
  ('wild-horse', 'Wild Horse', 11201, 'horse'),
  ('gentle-horse', 'Gentle Horse', 11208, 'horse'),
  ('brave-bear', 'Brave Bear', 11301, 'bear'),
  ('honey-bear', 'Honey Bear', 11308, 'bear'),
  ('forest-deer', 'Forest Deer', 11408, 'deer'),
  ('quiet-deer', 'Quiet Deer', 11429, 'deer'),
  ('little-penguin', 'Little Penguin', 11522, 'penguin'),
  ('snow-penguin', 'Snow Penguin', 11550, 'penguin'),
  ('sleepy-hedgehog', 'Sleepy Hedgehog', 11601, 'hedgehog'),
  ('garden-hedgehog', 'Garden Hedgehog', 11608, 'hedgehog')
on conflict (slug) do nothing;
