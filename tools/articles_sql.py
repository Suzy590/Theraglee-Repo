#!/usr/bin/env python3
"""Print SQL that upserts articles from data/articles.json into public.articles.

    python3 tools/articles_sql.py                  # every article
    python3 tools/articles_sql.py slug-a slug-b    # only those slugs
    python3 tools/articles_sql.py --since 2026-09-09   # articles published on or after a date
    python3 tools/articles_sql.py --photos             # only the photo columns, for every article

Rows are matched on slug. An existing row keeps its id, so favorites,
"saved for later", read marks and morning-email history that point at it are
untouched; only the text is refreshed. Every article is free (min_level 0) —
the database enforces that with a check constraint, and this tool writes 0
whatever the JSON says. The photo columns (photo_url, photo_alt, photo_credit,
photo_source) come from each article's `photo`, written by
tools/article_photos.py; --photos emits a compact update of just those, for
giving photos to articles already in the database. Paste the output into a
migration under supabase/migrations/.
"""
import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "articles.json"


def lit(s: str | None) -> str:
    if s is None:
        return "null"
    return "'" + s.replace("'", "''") + "'"


def arr(tags: list[str]) -> str:
    if not tags:
        return "'{}'::text[]"
    return "array[" + ", ".join(lit(t) for t in tags) + "]::text[]"


def photo(a: dict) -> tuple[str, str, str, str]:
    """The four photo literals for a row; nulls for an article without one."""
    ph = a.get("photo") or {}
    return (lit("/" + ph["file"]) if ph.get("file") else "null",
            lit(ph.get("alt")), lit(ph.get("credit")), lit(ph.get("source")))


def row(a: dict) -> str:
    url, alt, cred, src = photo(a)
    return ("  ({slug}, {title}, {excerpt}, {body}, {tags}, 0, {pub}::timestamptz, "
            "{url}, {alt}, {cred}, {src})").format(
        slug=lit(a["slug"]), title=lit(a["title"]), excerpt=lit(a.get("excerpt")),
        body=lit(a["body_md"]), tags=arr(a.get("tags") or []), pub=lit(a["published_at"]),
        url=url, alt=alt, cred=cred, src=src)


def photo_row(a: dict) -> str:
    url, alt, cred, src = photo(a)
    return f"  ({lit(a['slug'])}, {url}, {alt}, {cred}, {src})"


def main(argv: list[str]) -> None:
    rows = json.loads(DATA.read_text(encoding="utf-8"))
    if argv == ["--photos"]:
        rows = [a for a in rows if a.get("photo")]
        if not rows:
            sys.exit("no article has a photo yet")
        print("update public.articles as a set")
        print("  photo_url    = v.photo_url,")
        print("  photo_alt    = v.photo_alt,")
        print("  photo_credit = v.photo_credit,")
        print("  photo_source = v.photo_source")
        print("from (values")
        print(",\n".join(photo_row(a) for a in rows))
        print(") as v(slug, photo_url, photo_alt, photo_credit, photo_source)")
        print("where a.slug = v.slug;")
        return
    if argv and argv[0] == "--since":
        if len(argv) != 2:
            sys.exit("usage: articles_sql.py --since YYYY-MM-DD")
        rows = [a for a in rows if a["published_at"][:10] >= argv[1]]
    elif argv:
        want = set(argv)
        missing = want - {a["slug"] for a in rows}
        if missing:
            sys.exit(f"not in {DATA.name}: {', '.join(sorted(missing))}")
        rows = [a for a in rows if a["slug"] in want]
    if not rows:
        sys.exit("nothing to emit")
    print("insert into public.articles (slug, title, excerpt, body_md, tags, min_level, published_at,")
    print("  photo_url, photo_alt, photo_credit, photo_source)")
    print("values")
    print(",\n".join(row(a) for a in rows))
    print("on conflict (slug) do update set")
    print("  title        = excluded.title,")
    print("  excerpt      = excluded.excerpt,")
    print("  body_md      = excluded.body_md,")
    print("  tags         = excluded.tags,")
    print("  min_level    = 0,")
    print("  published_at = excluded.published_at,")
    print("  photo_url    = excluded.photo_url,")
    print("  photo_alt    = excluded.photo_alt,")
    print("  photo_credit = excluded.photo_credit,")
    print("  photo_source = excluded.photo_source;")


if __name__ == "__main__":
    main(sys.argv[1:])
