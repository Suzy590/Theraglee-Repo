-- =============================================================================
-- Shaped mandalas: animals, plants and symbols, 42 more for 242 in all.
-- -----------------------------------------------------------------------------
-- Until now every mandala was a circle. A row with a `shape` is drawn inside
-- that outline instead (a butterfly, an owl, a tulip, a heart...): the same
-- rings of petals, dots and scallops from its seed, clipped to the shape, with
-- plain parts such as legs, a stem or eyes around them. The outlines live in
-- site/assets/mandala-shapes.js; a null shape is the round mandala, so the
-- first 200 are untouched.
--
-- shared_mandala_coloring() gains the shape so a share link draws the right
-- figure. Its return type changes, so it is dropped and created again.
--
-- Premium, like the others (min_level defaults to 3). Re-running is harmless.
-- =============================================================================

alter table public.mandalas
  add column if not exists shape text
    check (shape is null or shape ~ '^[a-z][a-z-]*$');

comment on column public.mandalas.shape is
  'Outline the mandala is drawn inside (a key of SHAPES in site/assets/mandala-shapes.js); null for a round mandala.';

drop function if exists public.shared_mandala_coloring(text);

create function public.shared_mandala_coloring(p_token text)
returns table (title text, slug text, seed integer, svg text, shape text, fills jsonb, updated_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select m.title, m.slug, m.seed, m.svg, m.shape, c.fills, c.updated_at
    from public.mandala_colorings c
    join public.mandalas m on m.id = c.mandala_id
   where c.share_token = p_token
     and p_token ~ '^[0-9a-f]{24}$';
$$;

revoke all on function public.shared_mandala_coloring(text) from public;
grant execute on function public.shared_mandala_coloring(text) to anon, authenticated;

insert into public.mandalas (slug, title, seed, shape) values
  ('garden-butterfly', 'Garden Butterfly', 9001, 'butterfly'),
  ('butterfly-at-rest', 'Butterfly at Rest', 9008, 'butterfly'),
  ('wise-owl', 'Wise Owl', 9101, 'owl'),
  ('night-owl', 'Night Owl', 9108, 'owl'),
  ('curious-cat', 'Curious Cat', 9201, 'cat'),
  ('cozy-cat', 'Cozy Cat', 9208, 'cat'),
  ('little-fish', 'Little Fish', 9315, 'fish'),
  ('coral-fish', 'Coral Fish', 9329, 'fish'),
  ('patient-turtle', 'Patient Turtle', 9401, 'turtle'),
  ('sea-turtle', 'Sea Turtle', 9408, 'turtle'),
  ('morning-songbird', 'Morning Songbird', 9543, 'bird'),
  ('garden-songbird', 'Garden Songbird', 9571, 'bird'),
  ('slow-snail', 'Slow Snail', 9601, 'snail'),
  ('garden-snail', 'Garden Snail', 9608, 'snail'),
  ('gentle-whale', 'Gentle Whale', 9701, 'whale'),
  ('singing-whale', 'Singing Whale', 9729, 'whale'),
  ('kind-elephant', 'Kind Elephant', 9801, 'elephant'),
  ('elephant-walk', 'Elephant Walk', 9808, 'elephant'),
  ('soft-rabbit', 'Soft Rabbit', 9901, 'rabbit'),
  ('meadow-rabbit', 'Meadow Rabbit', 9908, 'rabbit'),
  ('falling-leaf', 'Falling Leaf', 10001, 'leaf'),
  ('green-leaf', 'Green Leaf', 10008, 'leaf'),
  ('spring-tulip', 'Spring Tulip', 10108, 'tulip'),
  ('tulip-field', 'Tulip Field', 10262, 'tulip'),
  ('shade-tree', 'Shade Tree', 10201, 'tree'),
  ('old-oak', 'Old Oak', 10208, 'tree'),
  ('lotus-flower', 'Lotus Flower', 10301, 'lotus'),
  ('lotus-pond', 'Lotus Pond', 10308, 'lotus'),
  ('forest-mushroom', 'Forest Mushroom', 10401, 'mushroom'),
  ('toadstool', 'Toadstool', 10408, 'mushroom'),
  ('orchard-apple', 'Orchard Apple', 10501, 'apple'),
  ('red-apple', 'Red Apple', 10508, 'apple'),
  ('open-heart', 'Open Heart', 10601, 'heart'),
  ('full-heart', 'Full Heart', 10608, 'heart'),
  ('evening-star', 'Evening Star', 10701, 'star'),
  ('wishing-star', 'Wishing Star', 10708, 'star'),
  ('crescent-moon', 'Crescent Moon', 10808, 'moon'),
  ('moon-and-stars', 'Moon and Stars', 10822, 'moon'),
  ('raindrop', 'Raindrop', 10901, 'drop'),
  ('dewdrop', 'Dewdrop', 10950, 'drop'),
  ('open-hand', 'Open Hand', 11001, 'hamsa'),
  ('helping-hand', 'Helping Hand', 11008, 'hamsa')
on conflict (slug) do nothing;
