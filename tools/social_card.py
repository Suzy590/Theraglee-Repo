#!/usr/bin/env python3
"""Draw site/assets/social-card.png, the 1200x630 picture a Theraglee link shows
when it is shared on social media or pasted into a chat app. Every page points
at it through its og:image and twitter:image tags (the generated pages through
tools/build_seo_pages.py, the hand-maintained ones in their own <head>).

    python3 tools/social_card.py

Uses the site's own typefaces, Outfit and Instrument Serif, fetched from Google
Fonts into a cache folder the first time, and the colors in
site/assets/styles.css. Re-run it after changing the logo or the tagline.
"""
from __future__ import annotations

import pathlib
import re
import urllib.request

from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "assets" / "social-card.png"
CACHE = pathlib.Path.home() / ".cache" / "theraglee-fonts"
W, H = 1200, 630
CREAM, INK, GREEN, MUTED, FAINT = "#FBF9F2", "#16241C", "#187C1A", "#5A6760", "#8B978E"
LIME = (141, 198, 29)
UA = {"User-Agent": "Mozilla/5.0"}


def font(family: str, name: str, size: int) -> ImageFont.FreeTypeFont:
    """A TrueType file from Google Fonts, cached as `name`."""
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{name}.ttf"
    if not path.exists():
        css_url = f"https://fonts.googleapis.com/css2?family={family}&display=swap"
        css = urllib.request.urlopen(urllib.request.Request(css_url, headers=UA)).read().decode()
        ttf = re.search(r"https://[^)]+\.ttf", css).group(0)
        path.write_bytes(urllib.request.urlopen(urllib.request.Request(ttf, headers=UA)).read())
    return ImageFont.truetype(str(path), size)


def main() -> None:
    im = Image.new("RGBA", (W, H), CREAM)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i in range(15):
        r = 330 + i * 30
        gd.ellipse([W / 2 - r * 1.9, H - 40 - r * 0.55, W / 2 + r * 1.9, H - 40 + r * 0.55],
                   fill=(*LIME, 14 - i // 2))
    im = Image.alpha_composite(im, glow)
    logo = Image.open(ROOT / "site" / "assets" / "logo.png").convert("RGBA")
    lw = 400
    lh = round(logo.height * lw / logo.width)
    logo = logo.resize((lw, lh), Image.LANCZOS)
    im.paste(logo, ((W - lw) // 2, 96), logo)
    d = ImageDraw.Draw(im)
    light = font("Outfit:wght@300", "outfit-300", 52)
    serif = font("Instrument+Serif:ital@1", "instrument-serif-italic", 56)
    med = font("Outfit:wght@500", "outfit-500", 26)

    def center(text: str, f: ImageFont.FreeTypeFont, y: int, fill: str) -> None:
        d.text(((W - d.textlength(text, font=f)) / 2, y), text, font=f, fill=fill)

    center("Small, steady tools for your mental health", light, 300, INK)
    center("and the site where the right therapist finds you.", serif, 366, GREEN)
    center("Free articles  ·  Self-discovery tools  ·  Verified therapist directory", med, 470, MUTED)
    center("theraglee.com", med, 540, FAINT)
    im.convert("RGB").save(OUT, optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
