# Theraglee — repo conventions

## Write in US English

Theraglee is a US site. Everything written here — page copy, UI labels, code
comments, CSS class names, docs — uses US spelling:

| Use | Not |
| --- | --- |
| color, coloring | colour, colouring |
| behavior, behavioral | behaviour, behavioural |
| license (noun and verb) | licence |
| favorite, favorites | favourite, favourites |
| counseling | counselling |
| personalized | personalised |
| judgment | judgement |
| center, centered | centre, centred |
| canceled, canceling | cancelled, cancelling |
| gray | grey |
| labeled | labelled |
| program | programme |
| practice (noun and verb) | practise |

Two deliberate exceptions, both stored values rather than words on a page:

- `ar_assignments.state` is `'cancelled'`, with a `cancelled_at` column, and
  Stripe returns `?checkout=cancelled`. These are a data contract — do not
  rename them. Only the labels a member reads use `Canceled`.
- `.badge.grey` remains in `site/assets/styles.css` and `brand/theraglee.css`
  as an alias of `.badge.gray`, so markup published before the switch still
  renders. Write `.gray` in new markup.

## `documents/` is generated

Never hand-edit `documents/`. It is built from `data/` by the generator:

```bash
python3 tools/build_documents.py
```

Change `tools/build_documents.py` (or the source rows in `data/`), then re-run
it and commit the regenerated output.

## `site/` is deployed verbatim

A push to the default branch deploys `site/` via Vercel, and every file in it is
publicly readable. Documentation belongs in `docs/`, never in `site/`.

## `supabase/` is the source of truth for the backend

The Stripe Edge Functions live in `supabase/functions/` and their schema changes
in `supabase/migrations/`. Change them here, run
`node tests/billing-logic/check.mjs`, and deploy with the Supabase CLI — never
edit a function in the Supabase Dashboard, or the next deploy will overwrite it.
`docs/stripe.md` is the guide.
