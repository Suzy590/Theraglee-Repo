#!/usr/bin/env python3
"""Keep the challenges in the database in step with data/challenges.json, in
pieces small enough for the Supabase MCP execute_sql tool, and safe to repeat.

    python3 tools/challenges_sync.py check                      # one query: which themes differ
    python3 tools/challenges_sync.py check --since 2026-10-12   # only the ones published since
    python3 tools/challenges_sync.py batches --out DIR slug-a slug-b
    python3 tools/challenges_sync.py batches --out DIR --since 2026-10-12

`check` prints one SQL query. Run it with execute_sql: it returns a row only
for a theme whose template is missing, or whose to-dos in the database are not
exactly the ones in the repo (compared by count and by md5 of the to-dos in day
order). No rows back means the database matches the repo.

`batches` writes 00_templates.sql (the template upsert) and 01.sql, 02.sql, ...
(about 120 to-dos each) into DIR. Every file is an upsert, so any of them can be
run again, in any order after 00, without an error and without a delete. That
is what lets a load that a container restart cut off be finished by simply
running all the files again, and what lets the daily routine repair yesterday's
themes before it writes today's. The files are rebuilt from data/challenges.json,
so nothing depends on a scratch folder surviving a restart.

A theme whose bank grew shorter would keep its old extra days; the bank is always
365, so this never happens in practice, and `check` would report it.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "challenges.json"
ROWS_PER_BATCH = 120

sys.path.insert(0, str(Path(__file__).resolve().parent))
from challenges_sql import lit, template_row  # noqa: E402


def pick(args) -> list[dict]:
    rows = json.loads(DATA.read_text(encoding="utf-8"))
    if args.since:
        rows = [c for c in rows if (c.get("published_at") or "")[:10] >= args.since]
    if args.slugs:
        want = set(args.slugs)
        missing = want - {c["slug"] for c in rows}
        if missing:
            sys.exit(f"not in {DATA.name}: {', '.join(sorted(missing))}")
        rows = [c for c in rows if c["slug"] in want]
    if not rows:
        sys.exit("nothing selected")
    return rows


def digest(tasks: list[str]) -> str:
    return hashlib.md5("\n".join(tasks).encode("utf-8")).hexdigest()


def check_sql(rows: list[dict]) -> str:
    expected = ",\n".join(
        f"  ({lit(c['slug'])}, {len(c['tasks'])}, {lit(digest(c['tasks']))})" for c in rows)
    return f"""-- Themes whose database copy differs from data/challenges.json. No rows: all match.
with expected(slug, days, h) as (values
{expected}
), actual as (
  select t.slug, count(d.id) as days,
         md5(string_agg(d.task, E'\\n' order by d.day)) as h
  from public.challenge_templates t
  left join public.challenge_days d on d.template_id = t.id
  where t.slug in (select slug from expected)
  group by t.slug
)
select e.slug, e.days as want_days, coalesce(a.days, 0) as have_days,
       case when a.slug is null then 'no template'
            when a.days <> e.days then 'wrong count'
            else 'wrong text' end as problem
from expected e left join actual a on a.slug = e.slug
where a.slug is null or a.days <> e.days or a.h is distinct from e.h
order by e.slug;"""


def write_batches(rows: list[dict], out: Path, per: int) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.sql"):
        old.unlink()
    files = []
    head = ["insert into public.challenge_templates",
            "  (slug, title, description, category, total_days, tags, min_level, published_at)",
            "values", ",\n".join(template_row(c) for c in rows),
            "on conflict (slug) do update set",
            "  title = excluded.title, description = excluded.description,",
            "  category = excluded.category, total_days = excluded.total_days,",
            "  tags = excluded.tags, min_level = excluded.min_level,",
            "  published_at = excluded.published_at;"]
    p = out / "00_templates.sql"
    p.write_text("\n".join(head) + "\n", encoding="utf-8")
    files.append(p)
    values = [f"  ({lit(c['slug'])}, {i}, {lit(t)})"
              for c in rows for i, t in enumerate(c["tasks"], start=1)]
    for n, start in enumerate(range(0, len(values), per), start=1):
        chunk = values[start:start + per]
        sql = ("insert into public.challenge_days (template_id, day, title, task)\n"
               "select t.id, v.day, null, v.task\nfrom (values\n" + ",\n".join(chunk) +
               "\n) as v(slug, day, task)\njoin public.challenge_templates t on t.slug = v.slug\n"
               "on conflict (template_id, day) do update set title = null, task = excluded.task;\n")
        p = out / f"{n:02d}.sql"
        p.write_text(sql, encoding="utf-8")
        files.append(p)
    return files


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("check", "batches"):
        s = sub.add_parser(name)
        s.add_argument("slugs", nargs="*")
        s.add_argument("--since", metavar="YYYY-MM-DD")
        if name == "batches":
            s.add_argument("--out", required=True, type=Path)
            s.add_argument("--rows", type=int, default=ROWS_PER_BATCH)
    args = ap.parse_args()
    rows = pick(args)
    if args.cmd == "check":
        print(check_sql(rows))
        return
    files = write_batches(rows, args.out, args.rows)
    print(f"{len(rows)} theme(s), {sum(len(c['tasks']) for c in rows)} to-dos, {len(files)} files in {args.out}:")
    for f in files:
        print(f"  {f.name}")
    print("Run 00_templates.sql first, then the rest in any order. Every file is safe to run again.")


if __name__ == "__main__":
    main()
