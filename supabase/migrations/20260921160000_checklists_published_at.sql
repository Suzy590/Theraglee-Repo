-- Checklists gain a published_at, so the two that arrive each day can be told
-- apart from the ones already in the library (and so tools/checklists_sql.py
-- can emit a single day with --since). Null for the four imported at launch.
-- See docs/checklists.md.

alter table public.checklists
  add column if not exists published_at timestamptz;

comment on column public.checklists.published_at is
  'When the checklist joined the library. Null for the four imported from the original Word documents.';
