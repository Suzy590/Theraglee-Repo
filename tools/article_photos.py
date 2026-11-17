#!/usr/bin/env python3
"""Give an article a free public domain photo.

Every article in data/articles.json carries a `photo`: a 1200x630 JPEG under
site/assets/articles/<slug>.jpg (the page's hero and its social share image),
an alt text, a credit line, and the page the photo came from. This tool finds
the photo, through Openverse (https://openverse.org), which indexes openly
licensed images; it asks only for CC0 and Public Domain Mark photographs, from
StockSnap, rawpixel and Flickr, the three whose files download cleanly.

    python3 tools/article_photos.py --missing
        List the articles that have no photo yet.

    python3 tools/article_photos.py <slug> "<search words>" "<alt text>"
        Find a photo for one article, save it, and record it in articles.json.
        Add --pick N to take the Nth candidate instead of the first, or --list
        to see the candidates without saving anything.

    python3 tools/article_photos.py --plan plan.json
        Many at once: a JSON list of {"slug", "query", "alt"}, where "query"
        is the search words or a list of them to try in turn. Articles that
        share a query share its pool of candidates, and no photo is used twice.

The search words describe the picture, not the article ("forest path morning
light", "two mugs of tea"); keep to calm scenes and objects, never a face. The
alt text says what is in the picture in one short sentence. Openverse allows
an anonymous client 20 searches a minute and 200 a day, so responses are
cached under --cache (the system temp folder by default) and the tool pauses
between searches.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "articles.json"
OUT_DIR = ROOT / "site" / "assets" / "articles"
API = "https://api.openverse.org/v1/images/"
SOURCES = "stocksnap,rawpixel,flickr"
PREFER = {"stocksnap": 0, "rawpixel": 1, "flickr": 2}
SOURCE_NAMES = {"stocksnap": "StockSnap", "rawpixel": "rawpixel", "flickr": "Flickr"}
LICENSES = {"cc0": "CC0", "pdm": "Public domain"}
WIDTH, HEIGHT = 1200, 630
UA = "TheragleePhotoFetch/1.0 (+https://theraglee.com)"
PAUSE = 3.2  # seconds between searches: under 20 a minute

_last_search = 0.0


def load() -> list[dict]:
    return json.loads(DATA.read_text(encoding="utf-8"))


def save(rows: list[dict]) -> None:
    DATA.write_text(json.dumps(rows, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def fetch(url: str, timeout: int = 60) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def search(query: str, cache: Path) -> list[dict]:
    """Up to twenty public domain photographs matching the words, cached."""
    global _last_search
    key = hashlib.sha1(query.lower().strip().encode()).hexdigest()[:16]
    hit = cache / f"{key}.json"
    if hit.exists():
        return json.loads(hit.read_text(encoding="utf-8"))["results"]
    params = {"q": query, "license": "cc0,pdm", "category": "photograph",
              "source": SOURCES, "page_size": "20", "mature": "false"}
    wait = PAUSE - (time.monotonic() - _last_search)
    if wait > 0:
        time.sleep(wait)
    _last_search = time.monotonic()
    body = fetch(API + "?" + urllib.parse.urlencode(params))
    cache.mkdir(parents=True, exist_ok=True)
    hit.write_bytes(body)
    return json.loads(body)["results"]


def candidates(results: list[dict]) -> list[dict]:
    """Landscape photographs wide enough to crop to 1200x630, best source first."""
    good = []
    for r in results:
        w, h = r.get("width") or 0, r.get("height") or 0
        if r.get("mature") or r.get("source") not in PREFER:
            continue
        if w < 900 or h < 500 or w / h < 1.2:
            continue
        if r["source"] == "rawpixel" and "photo" not in (r.get("foreign_landing_url") or ""):
            continue  # rawpixel also indexes scans of old artwork
        good.append(r)
    good.sort(key=lambda r: (PREFER[r["source"]], -(r.get("width") or 0)))
    return good


def credit(r: dict) -> str:
    who = (r.get("creator") or "").strip()
    by = f"Photo by {who} " if who else "Photo "
    return f"{by}via {SOURCE_NAMES[r['source']]}, {LICENSES[r['license']]}"


def to_jpeg(raw: bytes) -> bytes:
    im = Image.open(io.BytesIO(raw))
    im = ImageOps.exif_transpose(im).convert("RGB")
    im = ImageOps.fit(im, (WIDTH, HEIGHT), method=Image.Resampling.LANCZOS, centering=(0.5, 0.45))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=80, optimize=True, progressive=True)
    return buf.getvalue()


def used_sources(rows: list[dict]) -> set[str]:
    return {a["photo"]["source"] for a in rows if a.get("photo")}


def choose(query: str | list[str], cache: Path, taken: set[str], pick: int | None = None) -> dict | None:
    """The first unused candidate for the words; a list of queries is tried in
    order, so a plan can name a fallback for a narrow search."""
    for words in [query] if isinstance(query, str) else query:
        pool = [c for c in candidates(search(words, cache)) if c["foreign_landing_url"] not in taken]
        if pick is not None:
            return pool[pick - 1] if 0 < pick <= len(pool) else None
        if pool:
            return pool[0]
    return None


def assign(article: dict, r: dict, alt: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{article['slug']}.jpg"
    out.write_bytes(to_jpeg(fetch(r["url"])))
    article["photo"] = {
        "file": f"assets/articles/{article['slug']}.jpg",
        "alt": alt.strip(),
        "credit": credit(r),
        "source": r["foreign_landing_url"],
        "license": r["license"],
    }
    print(f"{article['slug']}: {r['source']} {r['width']}x{r['height']} — {r['title'][:50]!r} -> {out.relative_to(ROOT)}")


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("slug", nargs="?")
    p.add_argument("query", nargs="?")
    p.add_argument("alt", nargs="?")
    p.add_argument("--plan", type=Path, help="JSON list of {slug, query, alt}")
    p.add_argument("--missing", action="store_true", help="list articles without a photo")
    p.add_argument("--list", action="store_true", help="show the candidates for the words, save nothing")
    p.add_argument("--pick", type=int, help="take the Nth candidate (1-based)")
    p.add_argument("--replace", action="store_true", help="give an article that has a photo a new one")
    p.add_argument("--cache", type=Path, default=Path(tempfile.gettempdir()) / "theraglee-article-photos")
    a = p.parse_args(argv)

    rows = load()
    by_slug = {r["slug"]: r for r in rows}

    if a.missing:
        missing = [r["slug"] for r in rows if not r.get("photo")]
        print("\n".join(missing) if missing else "every article has a photo")
        return 0

    if a.list:
        words = a.query or a.slug
        if not words:
            p.error("--list needs the search words")
        taken = used_sources(rows)
        for i, c in enumerate(candidates(search(words, a.cache)), 1):
            flag = " (used)" if c["foreign_landing_url"] in taken else ""
            print(f"{i:2}. {c['source']:9} {c['license']:3} {c['width']}x{c['height']} {c['title'][:60]!r} {c['foreign_landing_url']}{flag}")
        return 0

    if a.plan:
        plan = json.loads(a.plan.read_text(encoding="utf-8"))
    elif a.slug and a.query and a.alt:
        plan = [{"slug": a.slug, "query": a.query, "alt": a.alt}]
    else:
        p.error("give a slug, search words and alt text, or --plan, --missing or --list")

    taken = used_sources(rows)
    failed = []
    for item in plan:
        art = by_slug.get(item["slug"])
        if not art:
            sys.exit(f"not in {DATA.name}: {item['slug']}")
        if art.get("photo") and not a.replace:
            continue
        if art.get("photo"):
            taken.discard(art["photo"]["source"])
        try:
            r = choose(item["query"], a.cache, taken, a.pick if len(plan) == 1 else None)
            if not r:
                failed.append(f"{item['slug']}: nothing left for {item['query']!r}")
                continue
            assign(art, r, item["alt"])
            taken.add(r["foreign_landing_url"])
        except Exception as e:  # keep going; the rest of the plan still runs
            failed.append(f"{item['slug']}: {e}")
            continue
        save(rows)
    if failed:
        print("\n".join(failed), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
