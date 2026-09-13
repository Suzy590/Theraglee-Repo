-- The clinician library (therapist_resources) is written in US English like the
-- rest of the site (CLAUDE.md). The rows imported on 2026-09-01 used UK spelling
-- in their titles, notes, client prompts and tags; this brings them in line with
-- data/therapist-resources.json. Slugs are keys and are left alone.
create or replace function pg_temp.us(s text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
         regexp_replace(regexp_replace(regexp_replace(regexp_replace(s,
           '\m([Bb])ehaviour', '\1ehavior', 'g'),
           '\m([Nn])ormalis', '\1ormaliz', 'g'),
           '\m([Pp])ractis', '\1ractic', 'g'),
           '\m([Jj])udgement', '\1udgment', 'g'),
           '\m([Rr])ecognis', '\1ecogniz', 'g'),
           '\m([Ee])xternalis', '\1xternaliz', 'g'),
           '\m([Cc])olour', '\1olor', 'g'),
           '\m([Ll])abelled', '\1abeled', 'g'),
           '\m([Pp])rioritis', '\1rioritiz', 'g')
$$;

update public.therapist_resources set
  title    = pg_temp.us(title),
  summary  = pg_temp.us(summary),
  goal     = pg_temp.us(goal),
  duration = pg_temp.us(duration),
  body_md  = pg_temp.us(body_md),
  fields   = (select coalesce(jsonb_agg(jsonb_set(f, '{label}', to_jsonb(pg_temp.us(f->>'label')))), '[]'::jsonb)
              from jsonb_array_elements(fields) f),
  tags     = (select coalesce(array_agg(pg_temp.us(t) order by ord), '{}'::text[])
              from unnest(tags) with ordinality as u(t, ord))
where created_at < '2026-09-13';
