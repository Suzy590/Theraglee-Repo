-- =============================================================================
-- Six more symbol outlines for the shaped mandalas: snowflake, sun, feather,
-- rain cloud, rainbow and gem, two mandalas each, for 278 in all.
-- -----------------------------------------------------------------------------
-- The outlines are in site/assets/mandala-shapes.js; the shape column and
-- how a shaped mandala is drawn arrived in 20260924180000_shaped_mandalas.sql.
-- Premium, like the others (min_level defaults to 3). Re-running is harmless.
-- =============================================================================

insert into public.mandalas (slug, title, seed, shape) values
  ('first-snowflake', 'First Snowflake', 13001, 'snowflake'),
  ('winter-snowflake', 'Winter Snowflake', 13008, 'snowflake'),
  ('bright-sun', 'Bright Sun', 13108, 'sun'),
  ('morning-sun', 'Morning Sun', 13115, 'sun'),
  ('light-feather', 'Light Feather', 13201, 'feather'),
  ('floating-feather', 'Floating Feather', 13208, 'feather'),
  ('rain-cloud', 'Rain Cloud', 13301, 'cloud'),
  ('passing-cloud', 'Passing Cloud', 13308, 'cloud'),
  ('after-the-rain', 'After the Rain', 13429, 'rainbow'),
  ('little-rainbow', 'Little Rainbow', 13443, 'rainbow'),
  ('hidden-gem', 'Hidden Gem', 13501, 'gem'),
  ('bright-gem', 'Bright Gem', 13508, 'gem')
on conflict (slug) do nothing;
