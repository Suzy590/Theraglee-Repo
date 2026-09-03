#!/usr/bin/env python3
"""
Build stylized Theraglee documents from the exported content in data/.

    python3 tools/build_documents.py            # write documents/
    python3 tools/build_documents.py --inline   # also emit self-contained copies

Every document is rendered from the same skeleton and the same stylesheet
(brand/theraglee.css); the only thing that varies per category is the body
renderer and the `data-doc` accent hook. That is what keeps the six document
families looking related.

The source rows carry a number of import artifacts (prompt text saved as
titles, run-together words, section/label pairs that are off by one). Nothing
here rewrites the author's words. Two structural repairs are applied and both
are reported in documents/CONTENT-HEALTH.md so they can be fixed upstream.
"""

from __future__ import annotations

import argparse
import base64
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "documents"
BRAND = ROOT / "brand"

TAGLINE = "a little lighter, every day"

CRISIS = ("If you are in crisis, call or text 988 (Suicide &amp; Crisis Lifeline, US) "
          "or your local emergency number. Theraglee is a wellbeing tool, not a "
          "substitute for professional care.")

CATEGORIES = {
    "challenges":      ("Challenge",     "challenge", "Mental Health Challenges"),
    "articles":        ("Article",       "article",   "Articles"),
    "checklists":      ("Checklist",     "checklist", "Checklists"),
    "journal-prompts": ("Journal",       "journal",   "Journal Prompts"),
    "quizzes":         ("Self-Assessment", "quiz",    "Quizzes"),
    "worksheets":      ("Worksheet",     "worksheet", "Worksheets"),
}

notes: list[tuple[str, str, str]] = []          # (category, slug, note)

# Defects found while exporting from Supabase. They cannot be re-detected from
# data/ because the export already worked around them, so they are recorded
# here to keep the health report complete.
EXPORT_NOTES = [
    ("challenges", "30-day-mental-health-challenge-for-veterans",
     "All 30 rows had `title` and `task` split mid-phrase — title `Tactical`, "
     "task `Breathing ResetPractice 4444 breathing for 3 minutes.` The export "
     "restores the intended split (`Tactical Breathing Reset` / `Practice 4444 "
     "breathing for 3 minutes.`). Fix the rows in `challenge_days` to make it "
     "permanent."),
    ("challenges", "30-day-mental-health-challenge-for-veterans",
     "Hyphens were stripped on import throughout: `4444 breathing` (4-4-4-4), "
     "`60second`, `3sentence afteraction`, `7day`. Left verbatim — these are "
     "wording changes for you to make, not formatting."),
    ("journal-prompts", "(source rows)",
     "2 of the 374 `daily_content` rows are not prompts and were left out: one "
     "is corrupted (`What's a piece of advice you` followed by CJK characters), "
     "the other is an editorial note (`March (31 prompts, up to #90): Emphasized "
     "growth and learning.`). 372 prompts were rendered."),
    ("worksheets", "below-ive-created-a-detailed-description-of-how-to-structure-each-of-t",
     "Its 54 fields duplicate the fields of ten other worksheets — it looks like "
     "an import that merged them all into one row rather than a real worksheet."),
    ("worksheets", "managing-depressive-symptoms-a-self-reflection-worksheet",
     "Only 2 fields survive (`Instructions` and `Final Reflection`); the body of "
     "the worksheet appears to have been lost on import."),
]


def flag(category: str, slug: str, note: str) -> None:
    notes.append((category, slug, note))


# --------------------------------------------------------------- helpers --
def e(s) -> str:
    """Escape for HTML text nodes."""
    return html.escape(str(s), quote=True) if s is not None else ""


def rays(cls: str = "rays") -> str:
    """The Theraglee sunburst, inlined so documents print without a fetch."""
    paths = [
        "M100 100L168.99 88.10A3.93 3.93 0 0 0 167.22 80.45Z",
        "M100 100L173.42 64.60A3.93 3.93 0 0 0 169.67 57.70Z",
        "M100 100L171.84 36.09A3.93 3.93 0 0 0 166.38 30.44Z",
        "M100 100L136.04 48.71A3.93 3.93 0 0 0 129.34 44.60Z",
        "M100 100L123.44 30.16A3.93 3.93 0 0 0 115.87 28.07Z",
        "M100 100L103.93 7.59A3.93 3.93 0 0 0 96.07 7.59Z",
        "M100 100L85.80 34.12A3.93 3.93 0 0 0 78.24 36.22Z",
        "M100 100L60.09 25.95A3.93 3.93 0 0 0 53.35 29.99Z",
        "M100 100L48.96 46.16A3.93 3.93 0 0 0 43.56 51.85Z",
        "M100 100L19.28 51.71A3.93 3.93 0 0 0 15.54 58.61Z",
        "M100 100L33.29 80.57A3.93 3.93 0 0 0 31.52 88.22Z",
    ]
    body = "".join(f'<path d="{d}"/>' for d in paths)
    return (f'<div class="{cls}" aria-hidden="true">'
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="12.38 -28.30 164.20 164.20">'
            f"{body}</svg></div>")


def level_badge(min_level) -> str:
    label = {0: "Free", 1: "Member", 2: "Premium"}.get(min_level)
    return f'<span class="badge grey">{e(label)}</span>' if label else ""


def tag_badges(tags) -> str:
    return "".join(f'<span class="badge">{e(t)}</span>' for t in (tags or []))


def page(*, title: str, doc: str, kind: str, body: str, depth: int = 2) -> str:
    """The shared document skeleton. `kind` is the brand line in the masthead."""
    up = "../" * depth
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)} — Theraglee</title>
<link rel="icon" href="{up}brand/assets/favicon.png" sizes="48x48">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600&family=Instrument+Serif:ital@0;1&display=swap">
<link rel="stylesheet" href="{up}brand/theraglee.css">
</head>
<body data-doc="{doc}">
<article class="sheet">
  <header class="masthead">
    <img class="logo" src="{up}brand/assets/logo.png" alt="Theraglee">
    <span class="kind">{e(kind)}</span>
  </header>
{body}
  <footer class="colophon">
    <p class="crisis">{CRISIS}</p>
    <span class="wordmark">theraglee</span>
  </footer>
</article>
</body>
</html>
"""


def cover(*, eyebrow: str, title: str, standfirst: str = "", deck: str = "",
          meta: str = "") -> str:
    bits = [f'  <header class="cover">', f"    {rays()}",
            f'    <span class="eyebrow">{e(eyebrow)}</span>',
            f'    <h1 class="title">{e(title)}</h1>']
    if standfirst:
        bits.append(f'    <p class="standfirst">{e(standfirst)}</p>')
    if deck:
        bits.append(f'    <p class="deck">{e(deck)}</p>')
    if meta:
        bits.append(f'    <div class="metabar">{meta}</div>')
    bits.append("  </header>")
    return "\n".join(bits)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


# ------------------------------------------------------------ challenges --
def render_challenge(c: dict) -> str:
    days = c.get("days") or []
    meta = " <span class='dot'></span> ".join(filter(None, [
        tag_badges(c.get("tags")),
        level_badge(c.get("min_level")),
    ]))

    items = []
    for d in days:
        name = f'<p class="dayname">{e(d["title"])}</p>' if d.get("title") else ""
        items.append(
            '    <li>\n'
            f'      <span class="daynum">{d["day"]}</span>\n'
            '      <div class="daybody">\n'
            f'        <div class="txt">{name}<p class="daytask">{e(d["task"])}</p></div>\n'
            '        <span class="tickbox"></span>\n'
            "      </div>\n"
            "    </li>"
        )

    body = cover(
        eyebrow=f'{c["total_days"]}-Day Challenge',
        title=c["title"],
        standfirst=c.get("description") or "One small thing a day. That is the whole method.",
        meta=meta,
    )
    body += ('\n  <section class="section">\n'
             '    <h2 class="sec">Your days</h2>\n'
             f'    <ol class="days">\n' + "\n".join(items) + "\n    </ol>\n  </section>\n")
    body += ('  <section class="section">\n'
             '    <div class="note">Missing a day is part of it. Pick the next number up '
             'and keep going — the streak is not the point, the returning is.</div>\n'
             "  </section>\n")
    return body


# -------------------------------------------------------------- articles --
LABELS = ("Why it works", "How to do it", "Pro tip", "Impact", "Instructions")
LABEL_RE = re.compile(r"(?<=\S)(?=(?:%s):)" % "|".join(LABELS))
# Split before a) b) c) d). The first option follows a space ("you think: a)");
# the rest follow the closing quote of the option before them ("…right.”b)").
OPTION_RE = re.compile(r"(?<=[\s”\"'.,;:!?])(?=[a-d]\)\s*[“\"A-Z])")
LABEL_START = re.compile(r"^(?:%s):" % "|".join(LABELS))
HEAD_NUM_RE = re.compile(r"^\d+\.\s+[A-Z]")


def render_prose(text: str) -> str:
    """Turn the stored plain text into readable HTML.

    Only structural: paragraphs, headings, the run-together `Why it works:` /
    `a) b) c)` sequences that lost their line breaks on import. No wording is
    changed.
    """
    out = []
    blocks = [b.strip() for b in re.split(r"\n\s*\n", text) if b.strip()]
    for i, b in enumerate(blocks):
        one_line = "\n" not in b

        # a) b) c) d) run together on one line -> a lettered list. This has to
        # be tested before the heading rule: a numbered scenario opens with
        # "1. You make a small mistake…" and would otherwise read as a heading.
        if OPTION_RE.search(b):
            head, *rest = OPTION_RE.split(b)
            if head.strip():
                out.append(f'<p class="scenario">{e(head.strip())}</p>')
            # Keep the author's own a)/b)/c) labels rather than renumbering.
            lis = "".join(f"<li>{e(o.strip())}</li>" for o in rest if o.strip())
            out.append(f'<ul class="choices">{lis}</ul>')
            continue

        # Headings: "1. Practice Deep Breathing" or a short title-ish line.
        if one_line and len(b) <= 92 and (
                HEAD_NUM_RE.match(b) or not b.endswith((".", "?", "!", ":", "”"))):
            tag = "h3" if re.match(r"^Question \d+$", b) else "h2"
            out.append(f"<{tag}>{e(b)}</{tag}>")
            continue

        # "Why it works: ... How to do it: ..." run together -> callout rows.
        # A label opening a block counts too, except in block 0 which is the lede.
        if LABEL_RE.search(b) or (i and LABEL_START.match(b)):
            parts = [p.strip() for p in LABEL_RE.split(b) if p.strip()]
            rows = []
            for p in parts:
                m = re.match(r"^(%s):\s*(.*)$" % "|".join(LABELS), p, re.S)
                if m:
                    rows.append(f'<div class="callout"><span class="k">{e(m.group(1))}</span>'
                                f"{e(m.group(2).strip())}</div>")
                else:
                    rows.append(f"<p>{e(p)}</p>")
            out.extend(rows)
            continue

        cls = ' class="lede"' if i == 0 else ""
        out.append(f"<p{cls}>{e(b)}</p>")
    return "\n".join(out)


def render_article(a: dict) -> str:
    meta = " <span class='dot'></span> ".join(filter(None, [
        tag_badges(a.get("tags")),
        level_badge(a.get("min_level")),
        f'<span>{len(a["body_md"].split())} words</span>',
    ]))
    mins = max(1, round(len(a["body_md"].split()) / 220))
    excerpt = (a.get("excerpt") or "").strip()
    # Several excerpts are a blunt 200-character cut of the opening paragraph.
    # Repeating that above the lede reads as a mistake, so only use an excerpt
    # that was actually written as a summary.
    if excerpt and a["body_md"].lstrip().startswith(excerpt[:60]):
        excerpt = ""
    body = cover(eyebrow=f"Article \u00b7 {mins} min read", title=a["title"],
                 standfirst=excerpt, meta=meta)
    body += f'\n  <div class="prose">\n{render_prose(a["body_md"])}\n  </div>\n'
    return body


# ------------------------------------------------------------ checklists --
DASH_SPLIT = re.compile(r"\s+[—–]\s+")


def split_item(text: str) -> tuple[str, str]:
    """Split "Action — explanation" into its two halves.

    Guards against the source's lost hyphens: "Check — in with your emotions"
    was "Check-in with your emotions" before import. A single word before the
    dash followed by a lowercase word is always that bug, never a real split.
    """
    parts = DASH_SPLIT.split(text, maxsplit=1)
    if len(parts) == 2 and " " not in parts[0].strip() and parts[1][:1].islower():
        text = f"{parts[0].strip()}-{parts[1]}"
        parts = DASH_SPLIT.split(text, maxsplit=1)
    if len(parts) == 2:
        return parts[0].strip(), parts[1].strip()
    return text.strip(), ""


def render_checklist(c: dict) -> str:
    meta = " <span class='dot'></span> ".join(filter(None, [
        f'<span class="badge">{len(c["items"])} items</span>',
        tag_badges(c.get("tags")),
        level_badge(c.get("min_level")),
    ]))
    rows = []
    for item in c["items"]:
        act, why = split_item(item)
        why_html = f'<span class="why">{e(why)}</span>' if why else ""
        rows.append('    <li><span class="tickbox"></span>'
                    f'<span class="txt"><span class="act">{e(act)}</span>{why_html}</span></li>')

    cad = (c.get("cadence") or "").title()
    body = cover(eyebrow=f"{cad} Checklist".strip(), title=c["title"],
                 standfirst=c.get("description") or "Tick what is true today. Leave the rest.",
                 meta=meta)
    body += ('\n  <section class="section">\n'
             '    <ul class="checks">\n' + "\n".join(rows) + "\n    </ul>\n  </section>\n")
    body += ('  <section class="section">\n    <h2 class="sec">Notes</h2>\n'
             '    <div class="lines" data-rows="4"></div>\n  </section>\n')
    return body


# ------------------------------------------------------- journal prompts --
THEMES = [
    ("gratitude-and-appreciation", "Gratitude &amp; Appreciation",
     "The practice of noticing what is already here.",
     ("grateful", "gratitude", "thankful", "thank", "appreciat", "blessing")),
    ("courage-and-fear", "Courage &amp; Fear",
     "For the days that ask something of you.",
     ("fear", "brave", "courage", "bold", "afraid", "fearless", "risk", "stand up", "vulnerab")),
    ("growth-and-change", "Growth &amp; Change",
     "On becoming someone slightly different.",
     ("change", "grow", "growth", "transition", "lesson", "learn", "mistake",
      "setback", "overcame", "overcome", "reinvent", "adapt", "resilien")),
    ("connection-and-relationships", "Connection &amp; Relationships",
     "The people who make the days lighter.",
     ("friend", "relationship", "connect", "someone", "loved one", "family",
      "kindness", "love", "trust", "support", "together", "unity", "community")),
    ("creativity-and-imagination", "Creativity &amp; Imagination",
     "Prompts for the part of you that makes things.",
     ("creativ", "imagine", "write a story", "write a short story", "write a poem",
      "write a letter", "write a scene", "story", "art", "poem", "design",
      "dialogue", "scene", "novel", "movie", "song", "music", "paint")),
    ("dreams-and-direction", "Dreams &amp; Direction",
     "Where you are pointed, and why.",
     ("dream", "goal", "future", "purpose", "vision", "legacy", "aspir",
      "career", "achiev", "accomplish", "ambition", "success")),
    ("stillness-and-presence", "Stillness &amp; Presence",
     "Slow prompts for a quiet hour.",
     ("calm", "peace", "present", "mindful", "breath", "still", "quiet",
      "silence", "ground", "relax", "savor", "slow down", "content")),
    ("self-kindness", "Self-Kindness",
     "How you speak to yourself when no one is listening.",
     ("self-compassion", "kind to yourself", "yourself", "self-care",
      "self-doubt", "self-aware", "accept", "forgive", "boundary", "let go")),
    ("adventure-and-curiosity", "Adventure &amp; Curiosity",
     "For restlessness, in the good sense.",
     ("adventure", "explore", "travel", "curious", "new", "discover",
      "journey", "visit", "outdoor", "place", "spontane")),
    ("looking-back", "Looking Back",
     "The year, the season, the week just gone.",
     ("2025", "this year", "last year", "next year", "the year", "memory",
      "remember", "milestone", "reflect on a time", "past")),
]
FALLBACK = ("reflection-and-self-discovery", "Reflection &amp; Self-Discovery",
            "Open questions, for whenever they land.")


def theme_of(prompt: str) -> str:
    low = prompt.lower()
    for slug, _t, _s, keys in THEMES:
        if any(k in low for k in keys):
            return slug
    return FALLBACK[0]


def render_journal(coll: dict) -> str:
    items = []
    for i, p in enumerate(coll["prompts"], 1):
        items.append(
            '    <li class="prompt">\n'
            f'      <span class="n">{i:02d}</span>\n'
            f'      <p class="q">{e(p)}</p>\n'
            '      <div class="lines" data-rows="4"></div>\n'
            "    </li>"
        )
    meta = ""
    body = cover(eyebrow=f'Journal \u00b7 {len(coll["prompts"])} prompts',
                 title=coll["title"].replace("&amp;", "&"),
                 standfirst=coll["standfirst"], meta=meta)
    body += ('\n  <section class="section">\n'
             '    <ol class="prompts" style="list-style:none;padding:0;margin:0">\n'
             + "\n".join(items) + "\n    </ol>\n  </section>\n")
    return body


# -------------------------------------------------------------- quizzes ---
def render_quiz(q: dict) -> str:
    qs = q["questions"]
    bands = q["bands"]
    maximum = sum(max(int(o["value"]) for o in x["options"]) for x in qs)
    meta = " <span class='dot'></span> ".join(filter(None, [
        f'<span class="badge">Max score {maximum}</span>',
        tag_badges(q.get("tags")),
        level_badge(q.get("min_level")),
    ]))

    q_html = []
    for i, x in enumerate(qs, 1):
        opts = "".join(
            '<li><span class="pick"></span>'
            f'<span class="lbl">{e(o["label"])}</span>'
            f'<span class="pts">{e(o["value"])}</span></li>'
            for o in x["options"]
        )
        q_html.append(
            "    <li>\n"
            f'      <div class="qhead"><span class="qnum">{i}</span>'
            f'<p class="qtext">{e(x["prompt"])}</p></div>\n'
            f'      <ul class="opts">{opts}</ul>\n'
            "    </li>"
        )

    band_html = "".join(
        '    <div class="band">\n'
        f'      <div class="range">{b["min"]}&#8239;–&#8239;{b["max"]}</div>\n'
        f'      <div><p class="lbl">{e(b["label"])}</p>'
        f'<p class="txt">{e(b.get("interp") or "")}</p></div>\n'
        "    </div>\n"
        for b in bands
    )

    body = cover(eyebrow=f"Self-Assessment \u00b7 {len(qs)} questions", title=q["title"],
                 standfirst=q.get("description") or
                 "A short check-in. There is no pass mark.", meta=meta)
    body += ('\n  <section class="section">\n'
             '    <h2 class="sec">Questions</h2>\n'
             '    <ol class="qs">\n' + "\n".join(q_html) + "\n    </ol>\n  </section>\n")
    body += ('  <section class="section">\n'
             '    <div class="scorebox">\n'
             '      <div><span class="lab">Add up the numbers you circled</span></div>\n'
             f'      <div class="tot"><span class="box"></span><span>/ {maximum}</span></div>\n'
             "    </div>\n"
             f'    <h2 class="sec">What your score suggests</h2>\n'
             f'    <div class="bands">\n{band_html}    </div>\n  </section>\n')
    body += ('  <section class="section">\n'
             '    <div class="note warn">A self-assessment is a mirror, not a diagnosis. '
             'If anything here worries you, bring it to a licensed professional.</div>\n'
             "  </section>\n")
    return body


# ------------------------------------------------------------ worksheets --
PLACEHOLDER_RE = re.compile(r"\[_+\]")


def render_worksheet(w: dict) -> str:
    meta = " <span class='dot'></span> ".join(filter(None, [
        f'<span class="badge">{len(w["fields"])} fields</span>',
        tag_badges(w.get("tags")),
        level_badge(w.get("min_level")),
    ]))

    # Group consecutive fields under their section. Section strings that are
    # really placeholder lines ("- ... [_____]") are demoted to field hints —
    # an import artifact, flagged in the health report.
    groups: list[tuple[str | None, list[dict]]] = []
    for f in w["fields"]:
        sec = f.get("section")
        if sec and (PLACEHOLDER_RE.search(sec) or sec.startswith("- ")):
            f = {**f, "_hint": PLACEHOLDER_RE.sub("", sec).lstrip("- ").strip()}
            sec = None
        if groups and groups[-1][0] == sec:
            groups[-1][1].append(f)
        else:
            groups.append((sec, [f]))

    out, n = [], 0
    for sec, fields in groups:
        head = ""
        if sec:
            n += 1
            head = ('    <div class="wsec-head">'
                    f'<span class="wsec-n">{n}</span>'
                    f'<h2 class="wsec-t">{e(sec)}</h2></div>\n')
        rows = []
        for f in fields:
            hint = f.get("_hint")
            hint_html = f'<span class="hint">{e(hint)}</span>' if hint else ""
            label = f'<span class="flabel">{e(f["label"])}{hint_html}</span>'
            if f.get("type") == "table":
                cols = f.get("columns") or []
                thead = "".join(f"<th>{e(c)}</th>" for c in cols)
                trow = "".join("<td></td>" for _ in cols)
                tbody = "".join(f"<tr>{trow}</tr>" for _ in range(int(f.get("rows") or 4)))
                rows.append(f'      <div class="field">{label}'
                            f'<table class="grid"><thead><tr>{thead}</tr></thead>'
                            f"<tbody>{tbody}</tbody></table></div>")
            else:
                rows.append(f'      <div class="field">{label}'
                            '<div class="lines" data-rows="3"></div></div>')
        out.append(f'    <section class="wsec">\n{head}' + "\n".join(rows) + "\n    </section>")

    body = cover(eyebrow="Worksheet", title=w["title"],
                 standfirst=w.get("description") or
                 "Take it slowly. Blank space is an acceptable answer.", meta=meta)
    if w.get("intro_md"):
        body += f'\n  <div class="note">{e(w["intro_md"])}</div>\n'
    body += "\n  <div class='section'>\n" + "\n".join(out) + "\n  </div>\n"
    return body


# ----------------------------------------------------------------- index --
def render_index(groups: dict[str, list[tuple[str, str, str]]]) -> str:
    cards = []
    for folder, (_kind, doc, heading) in CATEGORIES.items():
        rows = groups.get(folder, [])
        if not rows:
            continue
        links = "".join(
            f'<li><a href="{folder}/{slug}.html">'
            f'<span class="t">{e(title)}</span>'
            f'<span class="sub">{e(sub)}</span></a></li>'
            for slug, title, sub in rows
        )
        cards.append(
            f'  <section class="cat" data-doc="{doc}">\n'
            f'    <h2><span class="pip"></span>{heading}'
            f'<span class="ct">{len(rows)}</span></h2>\n'
            f"    <ul>{links}</ul>\n  </section>"
        )

    total = sum(len(v) for v in groups.values())
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Document Library — Theraglee</title>
<link rel="icon" href="../brand/assets/favicon.png" sizes="48x48">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600&family=Instrument+Serif:ital@0;1&display=swap">
<link rel="stylesheet" href="../brand/theraglee.css">
<style>
  .sheet{{max-width:1080px}}
  .cat{{margin:34px 0 0}}
  .cat h2{{
    display:flex;align-items:center;gap:11px;font-size:1.1rem;font-weight:500;
    letter-spacing:-.02em;margin:0 0 14px;padding-bottom:11px;border-bottom:1px solid var(--hair);
  }}
  .cat .pip{{width:9px;height:9px;border-radius:50%;background:var(--accent);flex:none}}
  .cat .ct{{
    margin-left:auto;font-size:.72rem;font-weight:600;color:var(--green-deep);
    background:var(--soft);border:1px solid var(--mist);padding:2px 10px;border-radius:var(--r-pill);
  }}
  .cat ul{{list-style:none;margin:0;padding:0;display:grid;gap:9px;
    grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}}
  .cat li{{margin:0;display:flex}}
  .cat a{{
    display:flex;flex-direction:column;width:100%;
    padding:13px 16px;border:1px solid var(--hair);border-radius:var(--r);
    background:var(--paper);color:var(--ink);font-size:.93rem;font-weight:500;
    letter-spacing:-.01em;line-height:1.35;transition:transform .25s cubic-bezier(.22,1,.36,1),
    box-shadow .25s ease,border-color .2s;
  }}
  .cat a:hover{{transform:translateY(-3px);box-shadow:var(--shadow-1);border-color:var(--mist)}}
  .cat .sub{{
    margin-top:auto;padding-top:8px;
    font-size:.78rem;color:var(--faint);font-weight:400;
  }}
</style>
</head>
<body>
<article class="sheet">
  <header class="masthead">
    <img class="logo" src="../brand/assets/logo.png" alt="Theraglee">
    <span class="kind">{TAGLINE}</span>
  </header>
  <header class="cover">
    {rays()}
    <span class="eyebrow">Library</span>
    <h1 class="title">Every Theraglee document, in one place</h1>
    <p class="standfirst">Six families, one voice — {total} documents built from the
      live content library.</p>
    <div class="metabar"><span class="badge">{total} documents</span>
      <span class="dot"></span><span>Print-ready</span></div>
  </header>
{chr(10).join(cards)}
  <footer class="colophon">
    <p class="crisis">{CRISIS}</p>
    <span class="wordmark">theraglee</span>
  </footer>
</article>
</body>
</html>
"""


# ------------------------------------------------------------------ main --
def load_quizzes(path: Path) -> list[dict]:
    """Parse the compact pipe-delimited quiz export."""
    quizzes: list[dict] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        if not raw.strip():
            continue
        tag, _, rest = raw.partition("|")
        if tag == "Q":
            slug, title, desc, tags, lvl = rest.split("|")
            quizzes.append({"slug": slug, "title": title, "description": desc or None,
                            "category": "Self-Assessment",
                            "tags": [t for t in tags.split(",") if t],
                            "min_level": int(lvl), "questions": [], "bands": []})
        elif tag == "P":
            quizzes[-1]["questions"].append({"prompt": rest, "options": []})
        elif tag == "O":
            value, _, label = rest.partition("|")
            quizzes[-1]["questions"][-1]["options"].append(
                {"value": int(value), "label": label})
        elif tag == "B":
            lo, hi, label, interp = rest.split("|", 3)
            quizzes[-1]["bands"].append({"min": int(lo), "max": int(hi),
                                         "label": label, "interp": interp})
    return quizzes


def build_journal_collections(prompts: list[str]) -> list[dict]:
    buckets: dict[str, list[str]] = {}
    for p in prompts:
        buckets.setdefault(theme_of(p), []).append(p)
    order = [(s, t, sf) for s, t, sf, _k in THEMES] + [FALLBACK]
    return [{"slug": s, "title": t, "standfirst": sf, "prompts": buckets[s]}
            for s, t, sf in order if buckets.get(s)]


def inline_assets(doc_html: str, depth: int) -> str:
    """Produce a self-contained copy: CSS and logo embedded."""
    css = (BRAND / "theraglee.css").read_text(encoding="utf-8")
    logo = base64.b64encode((BRAND / "assets" / "logo.png").read_bytes()).decode()
    up = "../" * depth
    doc_html = doc_html.replace(
        f'<link rel="stylesheet" href="{up}brand/theraglee.css">',
        f"<style>\n{css}\n</style>")
    doc_html = doc_html.replace(f'{up}brand/assets/logo.png',
                                f"data:image/png;base64,{logo}")
    doc_html = re.sub(r'\s*<link rel="icon"[^>]*>', "", doc_html)
    return doc_html


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--inline", action="store_true",
                    help="also write self-contained copies to documents/_standalone/")
    args = ap.parse_args()

    groups: dict[str, list[tuple[str, str, str]]] = {}

    def emit(folder: str, slug: str, title: str, sub: str, body: str) -> None:
        _kind, doc, _heading = CATEGORIES[folder]
        markup = page(title=title, doc=doc, kind=TAGLINE, body=body, depth=2)
        write(OUT / folder / f"{slug}.html", markup)
        groups.setdefault(folder, []).append((slug, title, sub))
        if args.inline:
            write(OUT / "_standalone" / folder / f"{slug}.html",
                  inline_assets(markup, 2))

    # Challenges
    for c in json.loads((DATA / "challenges.json").read_text(encoding="utf-8")):
        emit("challenges", c["slug"], c["title"], f'{c["total_days"]} days',
             render_challenge(c))
        if len(c.get("days") or []) != c["total_days"]:
            flag("challenges", c["slug"],
                 f'total_days is {c["total_days"]} but {len(c.get("days") or [])} day rows exist.')

    # Articles
    for a in json.loads((DATA / "articles.json").read_text(encoding="utf-8")):
        emit("articles", a["slug"], a["title"],
             f'{len(a["body_md"].split())} words', render_article(a))

    # Checklists
    for c in json.loads((DATA / "checklists.json").read_text(encoding="utf-8")):
        emit("checklists", c["slug"], c["title"], f'{len(c["items"])} items',
             render_checklist(c))
        for item in c["items"]:
            parts = DASH_SPLIT.split(item, maxsplit=1)
            if len(parts) == 2 and " " not in parts[0].strip() and parts[1][:1].islower():
                flag("checklists", c["slug"],
                     f'Lost hyphen rejoined for display: "{parts[0].strip()} — {parts[1][:28]}…"')

    # Journal prompts
    prompts = [p.strip() for p in
               (DATA / "journal-prompts.txt").read_text(encoding="utf-8").splitlines()
               if p.strip()]
    for coll in build_journal_collections(prompts):
        emit("journal-prompts", coll["slug"], coll["title"].replace("&amp;", "&"),
             f'{len(coll["prompts"])} prompts', render_journal(coll))

    # Quizzes
    for q in load_quizzes(DATA / "quizzes.txt"):
        emit("quizzes", q["slug"], q["title"], f'{len(q["questions"])} questions',
             render_quiz(q))
        if len(q["bands"]) < 4:
            flag("quizzes", q["slug"],
                 f'Only {len(q["bands"])} score bands — the lowest range is missing.')
        low = min(b["min"] for b in q["bands"])
        if low > 0:
            flag("quizzes", q["slug"],
                 f"Score bands start at {low}; scores below that fall through.")
        for x in q["questions"]:
            if x["prompt"].rstrip().endswith("("):
                flag("quizzes", q["slug"],
                     f'Question text truncated mid-parenthesis: "{x["prompt"][:52]}…"')

    # Worksheets
    for w in json.loads((DATA / "worksheets.json").read_text(encoding="utf-8")):
        emit("worksheets", w["slug"], w["title"], f'{len(w["fields"])} fields',
             render_worksheet(w))
        if w["title"].startswith(("INPUT WAS", "Below, I")) or len(w["title"]) > 110:
            flag("worksheets", w["slug"], "Title holds authoring prompt text, not a title.")
        if any((f.get("section") or "").find("[_") >= 0 for f in w["fields"]):
            flag("worksheets", w["slug"],
                 "section/label pairs are off by one; sections hold the previous field's "
                 "placeholder line.")

    for v in groups.values():
        v.sort(key=lambda r: r[1].lower())
    write(OUT / "index.html", render_index(groups))

    # Health report
    notes.extend(EXPORT_NOTES)
    lines = ["# Content health report", "",
             "Generated by `tools/build_documents.py`. Every document listed below was "
             "still rendered — these are defects in the **source rows**, carried over "
             "from whatever imported them. Fixing them in Supabase and re-running the "
             "build is all that is needed.", ""]
    if notes:
        current = None
        for cat, slug, note in sorted(notes):
            if cat != current:
                lines += ["", f"## {CATEGORIES[cat][2]}", ""]
                current = cat
            lines.append(f"- **`{slug}`** — {note}")
        lines.append("")
    else:
        lines.append("No issues found.\n")
    write(OUT / "CONTENT-HEALTH.md", "\n".join(lines))

    total = sum(len(v) for v in groups.values())
    for folder in CATEGORIES:
        print(f"  {folder:<16} {len(groups.get(folder, [])):>3}")
    print(f"  {'TOTAL':<16} {total:>3} documents, {len(notes)} content notes")


if __name__ == "__main__":
    main()
