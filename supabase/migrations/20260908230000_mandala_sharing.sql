-- =============================================================================
-- Sharing a colored mandala.
-- -----------------------------------------------------------------------------
-- A member who has colored a mandala can hand out a link that shows it to
-- anyone, signed in or not: site/mandalas.html?share=<token>. The token lives
-- on the member's mandala_colorings row and is minted on demand; clearing it
-- makes every copy of the link stop working.
--
-- The public read goes through shared_mandala_coloring(), which runs as the
-- definer so a visitor can see the figure (the mandalas table is Premium-only)
-- and returns nothing personal: the mandala's title, how it is drawn, and the
-- colors. Nothing about who colored it.
-- =============================================================================

alter table public.mandala_colorings
  add column if not exists share_token text unique
    check (share_token is null or share_token ~ '^[0-9a-f]{24}$');

comment on column public.mandala_colorings.share_token is
  'Set while the member is sharing this coloring; null otherwise. 12 random bytes as hex.';

-- Mint (or return the existing) share token for one of the caller's colorings.
-- Runs as the caller, so the update policy (own row, Premium) applies.
create or replace function public.share_mandala_coloring(p_mandala_id uuid)
returns text
language sql
security invoker
set search_path = public
as $$
  update public.mandala_colorings
     set share_token = coalesce(share_token, encode(gen_random_bytes(12), 'hex'))
   where user_id = auth.uid() and mandala_id = p_mandala_id
  returning share_token;
$$;

-- Stop sharing. Every link handed out so far stops working.
create or replace function public.unshare_mandala_coloring(p_mandala_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.mandala_colorings
     set share_token = null
   where user_id = auth.uid() and mandala_id = p_mandala_id;
$$;

revoke all on function public.share_mandala_coloring(uuid)   from public, anon;
revoke all on function public.unshare_mandala_coloring(uuid) from public, anon;
grant execute on function public.share_mandala_coloring(uuid)   to authenticated;
grant execute on function public.unshare_mandala_coloring(uuid) to authenticated;

-- What a link shows. Anyone may call it; it only answers for a live token.
create or replace function public.shared_mandala_coloring(p_token text)
returns table (title text, slug text, seed integer, svg text, fills jsonb, updated_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select m.title, m.slug, m.seed, m.svg, c.fills, c.updated_at
    from public.mandala_colorings c
    join public.mandalas m on m.id = c.mandala_id
   where c.share_token = p_token
     and p_token ~ '^[0-9a-f]{24}$';
$$;

revoke all on function public.shared_mandala_coloring(text) from public;
grant execute on function public.shared_mandala_coloring(text) to anon, authenticated;
