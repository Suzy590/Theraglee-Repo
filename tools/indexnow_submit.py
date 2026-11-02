#!/usr/bin/env python3
"""Tell Bing (and every other IndexNow search engine) which pages to crawl.

    python3 tools/indexnow_submit.py            # every URL in site/sitemap.xml
    python3 tools/indexnow_submit.py /articles/a-slug /tools/quizzes
    python3 tools/indexnow_submit.py --changed origin/main   # the sitemap URLs added or changed since that commit

IndexNow is the open protocol Bing, Yandex, Seznam and Naver share. The site
proves it owns the submission with a key file at the site root
(`site/<key>.txt`, holding the key), and this script posts the URLs to the
shared endpoint, which passes them to every participating engine. It is not
a substitute for Google Search Console: Google does not take IndexNow, and
reads the sitemap on its own once the property is verified there.

Nothing here needs an account. A 200 or 202 means the batch was accepted. A
403 means the engine could not read the key file at the live site (it was not
deployed yet, or its cached verdict on an older key is stale): deploy, wait,
and run it again, or make a new key file and retire the old one.

The GitHub workflow .github/workflows/indexnow.yml runs the `--changed` form
after every push to the default branch, once the deploy is live, so new pages
are announced without anyone remembering to.
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


def locs(text: str) -> list[str]:
    return re.findall(r"<loc>([^<]+)</loc>", text)


def changed_since(ref: str) -> list[str]:
    """The sitemap URLs that are new, or whose <lastmod> moved, since `ref`."""
    import subprocess
    try:
        before = subprocess.run(["git", "show", f"{ref}:site/sitemap.xml"], capture_output=True,
                                text=True, check=True, cwd=ROOT).stdout
    except subprocess.CalledProcessError:
        before = ""
    entry = re.compile(r"<url>\s*<loc>([^<]+)</loc>(?:\s*<lastmod>([^<]+)</lastmod>)?", re.S)
    old = {loc: mod for loc, mod in entry.findall(before)}
    now = SITEMAP.read_text(encoding="utf-8")
    return [loc for loc, mod in entry.findall(now) if loc not in old or old[loc] != mod]


def main(argv: list[str]) -> int:
    if argv[:1] == ["--changed"]:
        if len(argv) != 2:
            print(__doc__.strip())
            return 2
        urls = changed_since(argv[1])
        if not urls:
            print("IndexNow: nothing changed in the sitemap, nothing to submit")
            return 0
    elif any(a.startswith("-") for a in argv):
        print(__doc__.strip())
        return 2
    elif argv:
        urls = [u if u.startswith("http") else f"https://{HOST}{u if u.startswith('/') else '/' + u}"
                for u in argv]
    else:
        urls = locs(SITEMAP.read_text(encoding="utf-8"))
    k = key()
    urls = urls[:10000]  # the protocol's limit for one submission
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
