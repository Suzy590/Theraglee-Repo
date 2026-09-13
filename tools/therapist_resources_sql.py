#!/usr/bin/env python3
"""Print SQL that upserts clinician-library resources from
data/therapist-resources.json into public.therapist_resources.

    python3 tools/therapist_resources_sql.py                     # every resource
    python3 tools/therapist_resources_sql.py slug-a slug-b       # only those slugs
    python3 tools/therapist_resources_sql.py --since 2026-09-13  # resources created on or after a date

Rows are matched on slug. An existing row keeps its id, so Assign Remind
assignments that point at it are untouched; only the text is refreshed. Paste
the output into a migration under supabase/migrations/.
"""
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "therapist-resources.json"


def lit(s: str | None) -> str:
    if s is None:
        return "null"
    return "'" + s.replace("'", "''") + "'"


def arr(items: list[str]) -> str:
    if not items:
        return "'{}'::text[]"
    return "array[" + ", ".join(lit(t) for t in items) + "]::text[]"


def row(r: dict) -> str:
    return ("  ({slug}, {title}, {kind}::resource_kind, {summary}, {goal}, {audience}, {duration}, "
            "{body}, {fields}::jsonb, {tags}, {created}::timestamptz)").format(
        slug=lit(r["slug"]), title=lit(r["title"]), kind=lit(r["kind"]), summary=lit(r.get("summary")),
        goal=lit(r.get("goal")), audience=arr(r.get("audience") or []), duration=lit(r.get("duration")),
        body=lit(r.get("body_md")), fields=lit(json.dumps(r.get("fields") or [], ensure_ascii=False)),
        tags=arr(r.get("tags") or []), created=lit(r["created_at"]))


def main(argv: list[str]) -> None:
    rows = json.loads(DATA.read_text(encoding="utf-8"))
    if argv and argv[0] == "--since":
        if len(argv) != 2:
            sys.exit("usage: therapist_resources_sql.py --since YYYY-MM-DD")
        rows = [r for r in rows if r["created_at"][:10] >= argv[1]]
    elif argv:
        want = set(argv)
        missing = want - {r["slug"] for r in rows}
        if missing:
            sys.exit(f"not in {DATA.name}: {', '.join(sorted(missing))}")
        rows = [r for r in rows if r["slug"] in want]
    if not rows:
        sys.exit("nothing to emit")
    print("insert into public.therapist_resources "
          "(slug, title, kind, summary, goal, audience, duration, body_md, fields, tags, created_at)")
    print("values")
    print(",\n".join(row(r) for r in rows))
    print("on conflict (slug) do update set")
    print("  title      = excluded.title,")
    print("  kind       = excluded.kind,")
    print("  summary    = excluded.summary,")
    print("  goal       = excluded.goal,")
    print("  audience   = excluded.audience,")
    print("  duration   = excluded.duration,")
    print("  body_md    = excluded.body_md,")
    print("  fields     = excluded.fields,")
    print("  tags       = excluded.tags,")
    print("  created_at = excluded.created_at;")


if __name__ == "__main__":
    main(sys.argv[1:])
