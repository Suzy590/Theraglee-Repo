"""Given sites/*.json ({npi, website, ...}), fetch each practice website's
home page and a few likely contact pages, pull out email addresses, and
write rows/emails.json: {npi: {website, email, email_source}}.
Only public pages on the therapist's own site are read, once each."""
import glob, json, os, re, sys, time, urllib.parse, urllib.request, html, concurrent.futures

OUT_DIR = sys.argv[1]
UA = "Mozilla/5.0 (compatible; TheragleeListBuilder/1.0; +https://theraglee.com)"
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
BAD_DOMAINS = ("sentry", "wixpress", "wix.com", "squarespace", "example.", "domain.com", "email.com",
               "yourdomain", "godaddy", "wordpress", "w3.org", "schema.org", "googleapis", "cloudflare",
               "jquery", "github", "facebook", "instagram", "twitter", "linkedin", "mailchimp", "sentry.io",
               "psychologytoday", "yelp", "google.com", "apple.com", "microsoft", "adobe", "elementor",
               "2x.png", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", "bootstrap", "fontawesome")
CONTACT_PATHS = ["", "/contact", "/contact-us", "/contact.html", "/about", "/about-me", "/about-us", "/connect", "/get-started", "/reach-out"]

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*"})
    with urllib.request.urlopen(req, timeout=20) as r:
        if "html" not in (r.headers.get("Content-Type") or "html"):
            return ""
        return r.read(1_500_000).decode("utf-8", "replace")

def emails_in(text):
    text = html.unescape(text)
    found = set()
    for m in EMAIL_RE.findall(text):
        e = m.strip(".").lower()
        if any(b in e for b in BAD_DOMAINS):
            continue
        if len(e) > 60 or e.count("@") != 1:
            continue
        found.add(e)
    # mailto: links, which may carry subject params
    for m in re.findall(r'mailto:([^"\'?> ]+)', text, flags=re.I):
        e = urllib.parse.unquote(m).strip().lower()
        if EMAIL_RE.fullmatch(e) and not any(b in e for b in BAD_DOMAINS):
            found.add(e)
    # Cloudflare-obfuscated addresses
    for m in re.findall(r'data-cfemail="([0-9a-f]+)"', text):
        try:
            k = int(m[:2], 16)
            e = "".join(chr(int(m[i:i+2], 16) ^ k) for i in range(2, len(m), 2)).lower()
            if EMAIL_RE.fullmatch(e):
                found.add(e)
        except Exception:
            pass
    return found

def rank(emails, site_host, last_name):
    def score(e):
        s = 0
        d = e.split("@")[1]
        if site_host.endswith(d) or d.endswith(site_host.replace("www.", "")):
            s += 5
        if last_name and last_name.lower() in e:
            s += 3
        if e.startswith(("info@", "hello@", "contact@", "office@", "admin@")):
            s += 1
        if e.startswith(("noreply", "no-reply", "support@", "webmaster", "privacy@", "press@", "billing@", "jobs@", "careers@")):
            s -= 4
        if d.endswith(("gmail.com", "yahoo.com", "hotmail.com", "aol.com", "icloud.com", "outlook.com", "me.com")):
            s += 1
        return -s
    return sorted(emails, key=score)

def work(item):
    site = item["website"].strip()
    if not site.startswith("http"):
        site = "https://" + site
    host = urllib.parse.urlparse(site).netloc.lower()
    base = f"{urllib.parse.urlparse(site).scheme}://{host}"
    found, source, pages = set(), "", 0
    tried = []
    first_pages = [site] + [base + p for p in CONTACT_PATHS[1:]]
    for url in first_pages:
        if url in tried:
            continue
        tried.append(url)
        try:
            body = get(url)
        except Exception:
            continue
        pages += 1
        got = emails_in(body)
        if got and not found:
            source = url
        found |= got
        if url == site:
            # follow the site's own contact-ish links, whatever they are called
            for href in re.findall(r'href="([^"#]+)"', body)[:200]:
                if re.search(r"contact|about|connect|reach|appointment|consult", href, re.I):
                    full = urllib.parse.urljoin(url, href)
                    if urllib.parse.urlparse(full).netloc.lower() == host and full not in first_pages and full not in tried and len(tried) < 8:
                        first_pages.append(full)
        if found and pages >= 2:
            break
    ranked = rank(found, host, item.get("last_name", ""))
    return item["npi"], {"website": site, "email": ranked[0] if ranked else "", "other_emails": "; ".join(ranked[1:4]), "email_source": source, "pages_read": pages}

items = {}
for fn in glob.glob(os.path.join(OUT_DIR, "sites", "*-rows.json")):
    for it in json.load(open(fn)):
        if it.get("website"):
            items[it["npi"]] = it
done_path = os.path.join(OUT_DIR, "rows", "emails.json")
done = json.load(open(done_path)) if os.path.exists(done_path) else {}
todo = [it for n, it in items.items() if n not in done]
print(len(items), "sites,", len(todo), "to fetch", flush=True)
with concurrent.futures.ThreadPoolExecutor(8) as ex:
    for i, (npi, res) in enumerate(ex.map(work, todo)):
        done[npi] = res
        if i % 25 == 0:
            json.dump(done, open(done_path, "w"), indent=0)
            print(i, "done", flush=True)
json.dump(done, open(done_path, "w"), indent=0)
have = sum(1 for v in done.values() if v["email"])
print("DONE:", len(done), "sites read,", have, "with an email", flush=True)
