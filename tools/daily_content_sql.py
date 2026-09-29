#!/usr/bin/env python3
"""Print SQL that adds the daily cards in data/daily-content.json to public.daily_content.

    python3 tools/daily_content_sql.py                  # every row in the file
    python3 tools/daily_content_sql.py affirmation tip  # only those kinds

The file holds affirmations, quotes, tips and fun facts (the dashboard's
"Did you know"). A row is skipped when the same kind already has the same body,
so re-running the output never duplicates a card. Paste the output into a
migration under supabase/migrations/.
"""
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "daily-content.json"
KINDS = ("affirmation", "quote", "tip", "fun_fact")


def lit(s: str | None) -> str:
    if s is None:
        return "null"
    return "'" + s.replace("'", "''") + "'"


def arr(tags: list[str]) -> str:
    if not tags:
        return "'{}'::text[]"
    return "array[" + ", ".join(lit(t) for t in tags) + "]::text[]"


def row(r: dict) -> str:
    return f"  ({lit(r['kind'])}, {lit(r['body'])}, {lit(r.get('author'))}, {arr(r.get('tags') or [])})"


def main(argv: list[str]) -> None:
    rows = json.loads(DATA.read_text(encoding="utf-8"))
    bad = set(argv) - set(KINDS)
    if bad:
        sys.exit(f"unknown kind: {', '.join(sorted(bad))} (use {', '.join(KINDS)})")
    if argv:
        rows = [r for r in rows if r["kind"] in argv]
    if not rows:
        sys.exit("nothing to emit")
    print("insert into public.daily_content (kind, body, author, tags, min_level)")
    print("select v.kind::public.daily_kind, v.body, v.author, v.tags, 0")
    print("from (values")
    print(",\n".join(row(r) for r in rows))
    print(") as v(kind, body, author, tags)")
    print("where not exists (")
    print("  select 1 from public.daily_content d")
    print("  where d.kind = v.kind::public.daily_kind and d.body = v.body")
    print(");")


if __name__ == "__main__":
    main(sys.argv[1:])
