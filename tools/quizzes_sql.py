#!/usr/bin/env python3
"""Print SQL that upserts quizzes from data/quizzes.txt into the quiz tables.

    python3 tools/quizzes_sql.py                  # every quiz
    python3 tools/quizzes_sql.py slug-a slug-b    # only those slugs
    python3 tools/quizzes_sql.py --except slug-a  # every quiz but those

A quiz is three tables: `quizzes` (one row), `quiz_questions` (one per
question, options as JSON) and `quiz_bands` (one per score band). Quiz rows
are matched on slug, so an existing quiz keeps its id — and with it every
member's favorites, progress and past attempts. Its questions and bands are
replaced wholesale: a past attempt keeps its stored score and band label, so
history on the account page is unaffected. Paste the output into a migration
under supabase/migrations/.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_documents import load_quizzes  # noqa: E402

DATA = Path(__file__).resolve().parent.parent / "data" / "quizzes.txt"


def lit(s: str | None) -> str:
    if s is None:
        return "null"
    return "'" + s.replace("'", "''") + "'"


def arr(tags: list[str]) -> str:
    if not tags:
        return "'{}'::text[]"
    return "array[" + ", ".join(lit(t) for t in tags) + "]::text[]"


def quiz_row(q: dict) -> str:
    return "  ({slug}, {title}, {desc}, {cat}, {tags}, {lvl})".format(
        slug=lit(q["slug"]), title=lit(q["title"]), desc=lit(q.get("description")),
        cat=lit(q.get("category") or "Self-Assessment"), tags=arr(q.get("tags") or []),
        lvl=int(q.get("min_level", 2)))


def question_rows(q: dict) -> list[str]:
    rows = []
    for i, x in enumerate(q["questions"], 1):
        options = json.dumps([{"label": o["label"], "value": int(o["value"])} for o in x["options"]],
                             ensure_ascii=False, separators=(",", ":"))
        rows.append(f"  ({lit(q['slug'])}, {i}, {lit(x['prompt'])}, {lit(options)})")
    return rows


def band_rows(q: dict) -> list[str]:
    return [f"  ({lit(q['slug'])}, {int(b['min'])}, {int(b['max'])}, {lit(b['label'])}, {lit(b.get('interp'))})"
            for b in q["bands"]]


def main(argv: list[str]) -> None:
    quizzes = load_quizzes(DATA)
    if argv and argv[0] == "--except":
        skip = set(argv[1:])
        quizzes = [q for q in quizzes if q["slug"] not in skip]
    elif argv:
        want = set(argv)
        missing = want - {q["slug"] for q in quizzes}
        if missing:
            sys.exit(f"not in {DATA.name}: {', '.join(sorted(missing))}")
        quizzes = [q for q in quizzes if q["slug"] in want]
    if not quizzes:
        sys.exit("nothing to emit")

    slugs = ", ".join(lit(q["slug"]) for q in quizzes)

    print("insert into public.quizzes (slug, title, description, category, tags, min_level)")
    print("values")
    print(",\n".join(quiz_row(q) for q in quizzes))
    print("on conflict (slug) do update set")
    print("  title       = excluded.title,")
    print("  description = excluded.description,")
    print("  category    = excluded.category,")
    print("  tags        = excluded.tags,")
    print("  min_level   = excluded.min_level;")
    print()
    print("-- Questions and bands are replaced in full; the quiz row (and its id) stays.")
    print("delete from public.quiz_questions q using public.quizzes z")
    print(f"where q.quiz_id = z.id and z.slug in ({slugs});")
    print("delete from public.quiz_bands b using public.quizzes z")
    print(f"where b.quiz_id = z.id and z.slug in ({slugs});")
    print()
    print("insert into public.quiz_questions (quiz_id, position, prompt, options)")
    print("select z.id, v.position, v.prompt, v.options::jsonb")
    print("from (values")
    print(",\n".join(r for q in quizzes for r in question_rows(q)))
    print(") as v(slug, position, prompt, options)")
    print("join public.quizzes z on z.slug = v.slug;")
    print()
    print("insert into public.quiz_bands (quiz_id, min_score, max_score, label, interpretation)")
    print("select z.id, v.min_score, v.max_score, v.label, v.interpretation")
    print("from (values")
    print(",\n".join(r for q in quizzes for r in band_rows(q)))
    print(") as v(slug, min_score, max_score, label, interpretation)")
    print("join public.quizzes z on z.slug = v.slug;")


if __name__ == "__main__":
    main(sys.argv[1:])
