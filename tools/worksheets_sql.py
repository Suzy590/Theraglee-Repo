#!/usr/bin/env python3
"""Print SQL that upserts worksheets from data/worksheets.json into public.worksheets.

    python3 tools/worksheets_sql.py                  # every worksheet
    python3 tools/worksheets_sql.py slug-a slug-b    # only those slugs
    python3 tools/worksheets_sql.py --except slug-a  # every worksheet but those

Rows are matched on slug. An existing row keeps its id, so favorites, progress
and saved answers that point at it are untouched; only the text and fields are
refreshed. Paste the output into a migration under supabase/migrations/.
"""
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "worksheets.json"


def lit(s: str | None) -> str:
    if s is None:
        return "null"
    return "'" + s.replace("'", "''") + "'"


def arr(tags: list[str]) -> str:
    if not tags:
        return "'{}'::text[]"
    return "array[" + ", ".join(lit(t) for t in tags) + "]::text[]"


def row(w: dict) -> str:
    fields = json.dumps(w["fields"], ensure_ascii=False, separators=(",", ":"))
    return "  ({slug}, {title}, {desc}, {cat}, {intro}, {fields}::jsonb, {tags}, {lvl})".format(
        slug=lit(w["slug"]), title=lit(w["title"]), desc=lit(w.get("description")),
        cat=lit(w.get("category") or "Worksheet"), intro=lit(w.get("intro_md")),
        fields=lit(fields), tags=arr(w.get("tags") or []), lvl=int(w.get("min_level", 2)))


def main(argv: list[str]) -> None:
    rows = json.loads(DATA.read_text(encoding="utf-8"))
    if argv and argv[0] == "--except":
        skip = set(argv[1:])
        rows = [w for w in rows if w["slug"] not in skip]
    elif argv:
        want = set(argv)
        missing = want - {w["slug"] for w in rows}
        if missing:
            sys.exit(f"not in {DATA.name}: {', '.join(sorted(missing))}")
        rows = [w for w in rows if w["slug"] in want]
    if not rows:
        sys.exit("nothing to emit")
    print("insert into public.worksheets (slug, title, description, category, intro_md, fields, tags, min_level)")
    print("values")
    print(",\n".join(row(w) for w in rows))
    print("on conflict (slug) do update set")
    print("  title       = excluded.title,")
    print("  description = excluded.description,")
    print("  category    = excluded.category,")
    print("  intro_md    = excluded.intro_md,")
    print("  fields      = excluded.fields,")
    print("  tags        = excluded.tags,")
    print("  min_level   = excluded.min_level;")


if __name__ == "__main__":
    main(sys.argv[1:])
