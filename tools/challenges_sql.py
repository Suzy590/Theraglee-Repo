#!/usr/bin/env python3
"""Print SQL that upserts themed challenges from data/challenges.json into
public.challenge_templates and public.challenge_days.

    python3 tools/challenges_sql.py                      # every challenge
    python3 tools/challenges_sql.py slug-a slug-b        # only those slugs
    python3 tools/challenges_sql.py --since 2026-09-25   # the ones published on or after a date

Templates are matched on slug. An existing template keeps its id, so every
member's runs of it (user_challenges.template_id) and their ticked days still
point at it; only the text and the bank of to-dos are refreshed. The to-dos
are replaced wholesale for each template in the file: the old challenge_days
rows go, the new ones come in as day 1..N with no title. Paste the output into
a migration under supabase/migrations/.
"""
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "challenges.json"


def lit(s: str | None) -> str:
    if s is None:
        return "null"
    return "'" + s.replace("'", "''") + "'"


def arr(tags: list[str]) -> str:
    if not tags:
        return "'{}'::text[]"
    return "array[" + ", ".join(lit(t) for t in tags) + "]::text[]"


def template_row(c: dict) -> str:
    pub = f'{lit(c["published_at"])}::timestamptz' if c.get("published_at") else "null"
    return ("  ({slug}, {title}, {desc}, {cat}, {n}, {tags}, {lvl}, {pub})".format(
        slug=lit(c["slug"]), title=lit(c["title"]), desc=lit(c.get("description")),
        cat=lit(c.get("category")), n=len(c["tasks"]), tags=arr(c.get("tags") or []),
        lvl=int(c["min_level"]), pub=pub))


def main(argv: list[str]) -> None:
    rows = json.loads(DATA.read_text(encoding="utf-8"))
    if argv and argv[0] == "--since":
        if len(argv) != 2:
            sys.exit("usage: challenges_sql.py --since YYYY-MM-DD")
        rows = [c for c in rows if (c.get("published_at") or "")[:10] >= argv[1]]
    elif argv:
        want = set(argv)
        missing = want - {c["slug"] for c in rows}
        if missing:
            sys.exit(f"not in {DATA.name}: {', '.join(sorted(missing))}")
        rows = [c for c in rows if c["slug"] in want]
    if not rows:
        sys.exit("nothing to emit")

    slugs = "(" + ", ".join(lit(c["slug"]) for c in rows) + ")"

    print("-- The templates: an upsert on slug, so a re-run keeps every id.")
    print("insert into public.challenge_templates")
    print("  (slug, title, description, category, total_days, tags, min_level, published_at)")
    print("values")
    print(",\n".join(template_row(c) for c in rows))
    print("on conflict (slug) do update set")
    print("  title        = excluded.title,")
    print("  description  = excluded.description,")
    print("  category     = excluded.category,")
    print("  total_days   = excluded.total_days,")
    print("  tags         = excluded.tags,")
    print("  min_level    = excluded.min_level,")
    print("  published_at = excluded.published_at;")
    print()
    print("-- The bank of to-dos for each of those templates, replaced wholesale.")
    print("delete from public.challenge_days d")
    print("  using public.challenge_templates t")
    print(f"  where d.template_id = t.id and t.slug in {slugs};")
    print()
    print("insert into public.challenge_days (template_id, day, title, task)")
    print("select t.id, v.day, null, v.task")
    print("from (values")
    values = []
    for c in rows:
        for i, task in enumerate(c["tasks"], start=1):
            values.append(f"  ({lit(c['slug'])}, {i}, {lit(task)})")
    print(",\n".join(values))
    print(") as v(slug, day, task)")
    print("join public.challenge_templates t on t.slug = v.slug;")


if __name__ == "__main__":
    main(sys.argv[1:])
