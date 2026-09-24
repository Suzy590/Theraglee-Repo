#!/usr/bin/env python3
"""Tell Bing (and every other IndexNow search engine) which pages to crawl.

    python3 tools/indexnow_submit.py            # every URL in site/sitemap.xml
    python3 tools/indexnow_submit.py /articles/a-slug /tools/quizzes

IndexNow is the open protocol Bing, Yandex, Seznam and Naver share. The site
proves it owns the submission with a key file at the site root
(`site/<key>.txt`, holding the key), and this script posts the URLs to the
shared endpoint, which passes them to every participating engine. It is not
a substitute for Google Search Console: Google does not take IndexNow, and
reads the sitemap on its own once the property is verified there.

Nothing here needs an account. A 200 or 202 means the batch was accepted.
"""

from __future__ import annotations

import json
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
SITEMAP = SITE / "sitemap.xml"
ENDPOINT = "https://api.indexnow.org/indexnow"
HOST = "theraglee.com"


def key() -> str:
    files = [p for p in SITE.glob("*.txt") if re.fullmatch(r"[a-f0-9]{32}", p.stem)
             and p.read_text().strip() == p.stem]
    if len(files) != 1:
        sys.exit("error: expected exactly one IndexNow key file site/<32 hex>.txt")
    return files[0].stem


def main(argv: list[str]) -> int:
    if any(a.startswith("-") for a in argv):
        print(__doc__.strip())
        return 2
    k = key()
    if argv:
        urls = [f"https://{HOST}{u if u.startswith('/') else '/' + u}" for u in argv]
    else:
        urls = re.findall(r"<loc>([^<]+)</loc>", SITEMAP.read_text(encoding="utf-8"))
    body = json.dumps({
        "host": HOST,
        "key": k,
        "keyLocation": f"https://{HOST}/{k}.txt",
        "urlList": urls,
    }).encode()
    req = urllib.request.Request(
        ENDPOINT, data=body, method="POST",
        headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            status = res.status
    except urllib.error.HTTPError as e:
        status = e.code
        print(e.read().decode(errors="replace")[:500], file=sys.stderr)
    print(f"IndexNow: {status} for {len(urls)} urls")
    return 0 if status in (200, 202) else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
