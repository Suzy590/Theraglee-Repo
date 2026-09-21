#!/usr/bin/env python3
"""Print SQL that upserts checklists from data/checklists.json into public.checklists.

    python3 tools/checklists_sql.py                      # every checklist
    python3 tools/checklists_sql.py slug-a slug-b        # only those slugs
    python3 tools/checklists_sql.py --since 2026-09-21   # the ones published on or after a date

Rows are matched on slug. An existing row keeps its id, so favorites, "saved
for later" and every member's ticked items still point at it; only the text is
refreshed. Paste the output into a migration under supabase/migrations/.
"""
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "checklists.json"


def lit(s: str | None) -> str:
    if s is None:
        return "null"
    return "'" + s.replace("'", "''") + "'"


def arr(tags: list[str]) -> str:
    if not tags:
        return "'{}'::text[]"
    return "array[" + ", ".join(lit(t) for t in tags) + "]::text[]"


def jsonb(items: list[str]) -> str:
    return lit(json.dumps(items, ensure_ascii=False)) + "::jsonb"


def row(c: dict) -> str:
    pub = f'{lit(c["published_at"])}::timestamptz' if c.get("published_at") else "null"
    return ("  ({slug}, {title}, {desc}, {cat}, {items}, {cadence}, {tags}, {lvl}, {pub})".format(
        slug=lit(c["slug"]), title=lit(c["title"]), desc=lit(c.get("description")),
        cat=lit(c.get("category")), items=jsonb(c["items"]), cadence=lit(c["cadence"]),
        tags=arr(c.get("tags") or []), lvl=int(c["min_level"]), pub=pub))


def main(argv: list[str]) -> None:
    rows = json.loads(DATA.read_text(encoding="utf-8"))
    if argv and argv[0] == "--since":
        if len(argv) != 2:
            sys.exit("usage: checklists_sql.py --since YYYY-MM-DD")
        rows = [c for c in rows if (c.get("published_at") or "")[:10] >= argv[1]]
    elif argv:
        want = set(argv)
        missing = want - {c["slug"] for c in rows}
        if missing:
            sys.exit(f"not in {DATA.name}: {', '.join(sorted(missing))}")
        rows = [c for c in rows if c["slug"] in want]
    if not rows:
        sys.exit("nothing to emit")
    print("insert into public.checklists")
    print("  (slug, title, description, category, items, cadence, tags, min_level, published_at)")
    print("values")
    print(",\n".join(row(c) for c in rows))
    print("on conflict (slug) do update set")
    print("  title        = excluded.title,")
    print("  description  = excluded.description,")
    print("  category     = excluded.category,")
    print("  items        = excluded.items,")
    print("  cadence      = excluded.cadence,")
    print("  tags         = excluded.tags,")
    print("  min_level    = excluded.min_level,")
    print("  published_at = excluded.published_at;")


if __name__ == "__main__":
    main(sys.argv[1:])
