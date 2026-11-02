#!/usr/bin/env python3
"""Draw the 1200x630 share image for one generated page.

A link pasted into Facebook, LinkedIn, Pinterest, iMessage or Slack shows the
page's `og:image`. Until now every page showed the same site card; with this
module `tools/build_seo_pages.py` gives every article, topic hub, checklist,
challenge, Discover topic and hand-written landing page a card of its own that
carries the page's title, so a shared link reads like the page and not like an
advertisement. Pinterest's "save" button and the RSS auto-publish feeds use
the same picture.

The cards live at `site/assets/cards/<path>.jpg`, mirroring the page's URL
(`/articles/a-slug` -> `site/assets/cards/articles/a-slug.jpg`). The builder
calls `card_for()` for each page; a card is drawn only when it is missing or
its words changed (the inputs are hashed into `site/assets/cards/manifest.json`),
so a rebuild changes nothing when nothing moved, and the daily routines never
redraw hundreds of pictures.

The typefaces are the site's own, Outfit and Instrument Serif, bundled in
`tools/fonts/` (SIL Open Font License) so the build needs no network. If the
Pillow image library is missing, `card_for()` returns None and the builder
falls back to the site card; the page still has a share image either way.

    python3 tools/share_cards.py "Article · Anxiety" "Five ways to come back when anxiety spikes" out.jpg

draws one card to look at.
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
CARDS = SITE / "assets" / "cards"
MANIFEST = CARDS / "manifest.json"
FONTS = ROOT / "tools" / "fonts"
LOGO = SITE / "assets" / "logo.png"

W, H = 1200, 630
CREAM, INK, GREEN, MUTED, FAINT = "#FBF9F2", "#16241C", "#187C1A", "#5A6760", "#8B978E"
LIME = (141, 198, 29)
JPEG_QUALITY = 84
VERSION = 1  # bump to redraw every card after a design change

try:
    from PIL import Image, ImageDraw, ImageFont
    HAVE_PIL = True
except ImportError:  # pragma: no cover - depends on the machine
    HAVE_PIL = False

_fonts: dict[tuple[str, int], "ImageFont.FreeTypeFont"] = {}
_manifest: dict[str, str] | None = None
TOUCHED: set[str] = set()  # the pages that asked for a card in this run


def font(name: str, size: int):
    key = (name, size)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(str(FONTS / f"{name}.ttf"), size)
    return _fonts[key]


def wrap(draw, text: str, f, width: int, max_lines: int) -> list[str]:
    """Greedy word wrap; the last line gets an ellipsis if the text runs on."""
    words = text.split()
    lines: list[str] = []
    line = ""
    for w in words:
        trial = f"{line} {w}".strip()
        if draw.textlength(trial, font=f) <= width or not line:
            line = trial
        else:
            lines.append(line)
            line = w
    if line:
        lines.append(line)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        last = lines[-1]
        while last and draw.textlength(last + "…", font=f) > width:
            last = last.rsplit(" ", 1)[0] if " " in last else last[:-1]
        lines[-1] = last + "…"
    return lines


def draw_card(kicker: str, title: str, out: pathlib.Path, footer: str = "theraglee.com") -> None:
    im = Image.new("RGBA", (W, H), CREAM)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i in range(14):
        r = 300 + i * 32
        gd.ellipse([W - 260 - r * 1.6, H - 60 - r * 0.6, W - 260 + r * 1.6, H - 60 + r * 0.6],
                   fill=(*LIME, 13 - i // 2))
    im = Image.alpha_composite(im, glow)
    d = ImageDraw.Draw(im)

    # Logo, top left.
    logo = Image.open(LOGO).convert("RGBA")
    lw = 220
    lh = round(logo.height * lw / logo.width)
    im.paste(logo.resize((lw, lh), Image.LANCZOS), (72, 64), logo.resize((lw, lh), Image.LANCZOS))

    # Kicker: small green capitals.
    kf = font("outfit-600", 26)
    d.text((72, 190), kicker.upper(), font=kf, fill=GREEN)

    # Title: as large as fits in four lines.
    for size in (72, 64, 56, 50, 44):
        tf = font("outfit-300", size)
        lines = wrap(d, title, tf, W - 144, 4)
        line_h = round(size * 1.14)
        if len(lines) * line_h <= 300 and len(lines) <= 4:
            break
    y = 240
    for line in lines:
        d.text((72, y), line, font=tf, fill=INK)
        y += line_h

    # Footer: a green rule, the site, the promise.
    d.rectangle([72, H - 86, 172, H - 82], fill=GREEN)
    ff = font("outfit-500", 26)
    d.text((72, H - 66), footer, font=ff, fill=MUTED)
    sf = font("instrument-serif-italic", 30)
    tail = "Free tools, free articles, verified therapists."
    d.text((W - 72 - d.textlength(tail, font=sf), H - 70), tail, font=sf, fill=GREEN)

    out.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(out, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)


def _load_manifest() -> dict[str, str]:
    global _manifest
    if _manifest is None:
        try:
            _manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            _manifest = {}
    return _manifest


def card_for(path: str, kicker: str, title: str) -> str | None:
    """The site-relative URL of the card for the page at `path`, drawing it if
    it is missing or its words changed. None when Pillow is not installed and
    no card exists yet."""
    TOUCHED.add(path)
    rel = f"assets/cards/{path}.jpg"
    out = SITE / rel
    digest = hashlib.sha1(f"{VERSION}|{kicker}|{title}".encode()).hexdigest()[:16]
    manifest = _load_manifest()
    if out.exists() and manifest.get(path) == digest:
        return "/" + rel
    if not HAVE_PIL:
        return "/" + rel if out.exists() else None
    draw_card(kicker, title, out)
    manifest[path] = digest
    return "/" + rel


def finish(wanted: set[str]) -> int:
    """Write the manifest and remove cards whose page is gone. Returns how
    many stale cards were removed."""
    manifest = _load_manifest()
    removed = 0
    for key in [k for k in manifest if k not in wanted]:
        del manifest[key]
    if CARDS.is_dir():
        for file in sorted(CARDS.rglob("*.jpg")):
            key = str(file.relative_to(CARDS).with_suffix("")).replace("\\", "/")
            if key not in wanted:
                file.unlink()
                removed += 1
        for folder in sorted((p for p in CARDS.rglob("*") if p.is_dir()), reverse=True):
            if not any(folder.iterdir()):
                folder.rmdir()
    CARDS.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(dict(sorted(manifest.items())), indent=0) + "\n", encoding="utf-8")
    return removed


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__.strip())
    if not HAVE_PIL:
        sys.exit("error: Pillow is not installed (pip install pillow)")
    draw_card(sys.argv[1], sys.argv[2], pathlib.Path(sys.argv[3]))
    print(f"wrote {sys.argv[3]}")
