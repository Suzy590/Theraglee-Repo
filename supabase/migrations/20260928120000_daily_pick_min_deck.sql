-- =============================================================================
-- Daily cards stopped changing for some members
-- -----------------------------------------------------------------------------
-- daily_pick_for() narrows each kind to the rows that share a tag with the
-- member's recent topics. When that narrowed deck holds a single row (only one
-- affirmation, one quote and one fun fact carry the `anxiety` tag, say) the
-- member is shown that same row every day, and a deck of two or three repeats
-- within days.
--
-- The personalized deck is now used only when it holds at least a week of
-- rows. Smaller matches fall through to the full deck, which rotates daily.
-- =============================================================================

create or replace function public.daily_pick_for(p_user uuid, p_kind text, p_seed integer default 0)
returns setof public.daily_content
language plpgsql stable security definer
set search_path = public
as $function$
declare
  min_deck  constant int := 7;
  lvl       smallint := public.level_for(p_user);
  day_seed  int := ((current_date - date '2000-01-01') + p_seed);
  fav       text[];
  n         int;
  cycle     int;
  idx       int;
begin
  if p_user is not null then
    select array_agg(tag) into fav from (
      select unnest(tags) tag, count(*) c
      from public.activity_log
      where user_id = p_user and created_at > now() - interval '60 days'
      group by 1 order by c desc limit 5
    ) t;

    -- No history yet: the topics the member picked on their profile stand in.
    if fav is null then
      select nullif(array_agg(lower(i)), '{}') into fav
      from public.profiles p, unnest(p.issues) i
      where p.id = p_user;
    end if;
  end if;

  -- personalized deck, when there is something to personalize on and enough
  -- of it to change every day
  if fav is not null and array_length(fav, 1) > 0 then
    select count(*) into n from public.daily_content d
    where d.kind = p_kind::public.daily_kind and d.active
      and d.min_level <= lvl and d.tags && fav;

    if n >= min_deck then
      cycle := day_seed / n;
      idx   := day_seed % n;
      return query
        select * from public.daily_content d
        where d.kind = p_kind::public.daily_kind and d.active
          and d.min_level <= lvl and d.tags && fav
        order by md5(d.id::text || cycle::text)
        offset idx limit 1;
      return;
    end if;
  end if;

  -- the full deck for this kind and access level
  select count(*) into n from public.daily_content d
  where d.kind = p_kind::public.daily_kind and d.active and d.min_level <= lvl;

  if n = 0 then return; end if;

  cycle := day_seed / n;
  idx   := day_seed % n;

  return query
    select * from public.daily_content d
    where d.kind = p_kind::public.daily_kind and d.active and d.min_level <= lvl
    order by md5(d.id::text || cycle::text)
    offset idx limit 1;
end $function$;
revoke execute on function public.daily_pick_for(uuid, text, integer) from public, anon, authenticated;
grant  execute on function public.daily_pick_for(uuid, text, integer) to service_role;
