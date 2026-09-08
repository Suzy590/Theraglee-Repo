-- =============================================================================
-- Mandala colorings: one row per member per mandala.
-- -----------------------------------------------------------------------------
-- site/mandalas.html lets a Premium member color a mandala online: every
-- closed shape in the figure is a numbered region (site/assets/mandala.js),
-- and a tap fills it. What the database keeps is which region got which color,
-- as a JSON object { "<region index>": "#rrggbb" }, so a half-finished
-- coloring follows the member across devices instead of living in one
-- browser's localStorage. The page always keeps a browser copy as well and
-- shows whichever of the two is newer.
--
-- Mandalas are a Premium feature, so writes require user_level() >= 3. Reads
-- are allowed to any signed-in member on their own rows, so a member whose
-- membership lapses can still see what they colored.
-- =============================================================================

create table if not exists public.mandala_colorings (
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  mandala_id  uuid        not null references public.mandalas(id) on delete cascade,
  fills       jsonb       not null default '{}'::jsonb check (jsonb_typeof(fills) = 'object'),
  updated_at  timestamptz not null default now(),
  primary key (user_id, mandala_id)
);

comment on table public.mandala_colorings is
  'Which region of a mandala a member colored which color (Premium). fills is { "<region index>": "#rrggbb" }; indexes come from site/assets/mandala.js.';

alter table public.mandala_colorings enable row level security;

drop policy if exists "own mandala colorings read"   on public.mandala_colorings;
drop policy if exists "own mandala colorings insert" on public.mandala_colorings;
drop policy if exists "own mandala colorings update" on public.mandala_colorings;
drop policy if exists "own mandala colorings delete" on public.mandala_colorings;

create policy "own mandala colorings read" on public.mandala_colorings
  for select to authenticated
  using (user_id = auth.uid());

create policy "own mandala colorings insert" on public.mandala_colorings
  for insert to authenticated
  with check (user_id = auth.uid() and public.user_level() >= 3);

create policy "own mandala colorings update" on public.mandala_colorings
  for update to authenticated
  using (user_id = auth.uid() and public.user_level() >= 3)
  with check (user_id = auth.uid() and public.user_level() >= 3);

create policy "own mandala colorings delete" on public.mandala_colorings
  for delete to authenticated
  using (user_id = auth.uid());

-- Members hold only the four row privileges (see 20260908130000).
revoke all on public.mandala_colorings from anon;
revoke all on public.mandala_colorings from authenticated;
grant select, insert, update, delete on public.mandala_colorings to authenticated;
