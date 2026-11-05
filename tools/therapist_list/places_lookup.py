"""Look up each practice phone number in Google Places (New) and record the
practice website. Reads rows/therapists.json, writes sites/places.json.

  GOOGLE_PLACES_API_KEY=... python3 tools/therapist_list/places_lookup.py WORK_DIR --counties "Ventura,Santa Barbara" --max 3000

Only private-practice rows (sole proprietor) in the listed counties with a
license number on file are looked up, one call per distinct phone number,
most recently updated NPI record first. Each call bills Google's Text Search
Enterprise SKU (the website field), $35 per 1,000 after the first 1,000 free
each month, so --max is the spending cap. Re-running skips numbers already done.
"""
import argparse, json, os, re, sys, time, urllib.request

ap = argparse.ArgumentParser()
ap.add_argument("work_dir")
ap.add_argument("--counties", default="Ventura,Santa Barbara")
ap.add_argument("--max", type=int, default=1000, help="most lookups to make in this run")
ap.add_argument("--everyone", action="store_true", help="include agency staff too, not only sole proprietors")
args = ap.parse_args()

KEY = os.environ.get("GOOGLE_PLACES_API_KEY")
if not KEY:
    sys.exit("GOOGLE_PLACES_API_KEY is not set")
counties = [c.strip() for c in args.counties.split(",")]
PRIVATE = ("Marriage", "Clinical social", "Mental health counselor", "Professional counselor", "Counselor (LPC",
           "Psychologist", "neuropsych", "Psychiatrist", "Psychiatric nurse", "Art therapist", "Psychoanalyst")

rows = json.load(open(os.path.join(args.work_dir, "rows", "therapists.json")))
sel = [r for r in rows if r["county"] in counties and r["phone"] and r["license_numbers"] and not r["flag"]
       and any(p in r["primary_license"] for p in PRIVATE) and (args.everyone or r["sole_proprietor"] == "YES")]
sel.sort(key=lambda r: r["npi_updated"], reverse=True)

os.makedirs(os.path.join(args.work_dir, "sites"), exist_ok=True)
out_path = os.path.join(args.work_dir, "sites", "places.json")
done = json.load(open(out_path)) if os.path.exists(out_path) else {}   # phone digits -> result

def digits(s):
    return re.sub(r"\D", "", s or "")[-10:]

def lookup(phone10):
    body = json.dumps({"textQuery": "+1 " + phone10, "regionCode": "US", "pageSize": 3}).encode()
    req = urllib.request.Request("https://places.googleapis.com/v1/places:searchText", data=body, method="POST",
                                 headers={"Content-Type": "application/json", "X-Goog-Api-Key": KEY,
                                          "X-Goog-FieldMask": "places.id,places.displayName,places.websiteUri,places.nationalPhoneNumber,places.formattedAddress"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode()).get("places", [])
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:300]
            if e.code in (400, 403):
                sys.exit(f"Google refused the request ({e.code}): {msg}")
            time.sleep(2 ** attempt)
        except Exception:
            time.sleep(2 ** attempt)
    return None

phones = []
for r in sel:
    d = digits(r["phone"])
    if len(d) == 10 and d not in done and d not in phones:
        phones.append(d)
print(f"{len(sel)} rows, {len(phones)} phone numbers still to look up, capped at {args.max}", flush=True)

made = 0
for d in phones[: args.max]:
    places = lookup(d)
    made += 1
    if places is None:
        done[d] = {"error": "no answer after retries"}
    else:
        match = next((p for p in places if digits(p.get("nationalPhoneNumber")) == d), None)
        if match:
            done[d] = {"website": match.get("websiteUri", ""), "place": match.get("displayName", {}).get("text", ""),
                       "address": match.get("formattedAddress", "")}
        else:
            done[d] = {"website": "", "place": "", "note": "no listing with this number"}
    if made % 25 == 0:
        json.dump(done, open(out_path, "w"), indent=0)
        print(made, "done,", sum(1 for v in done.values() if v.get("website")), "websites so far", flush=True)
json.dump(done, open(out_path, "w"), indent=0)

# Hand every row that shares a number the website, for extract_emails.py.
by_phone = {}
for r in sel:
    by_phone.setdefault(digits(r["phone"]), []).append(r)
items = []
for d, v in done.items():
    for r in by_phone.get(d, []):
        items.append({"npi": r["npi"], "first_name": r["first_name"], "last_name": r["last_name"],
                      "website": v.get("website", ""), "place": v.get("place", ""), "note": v.get("note", "")})
json.dump(items, open(os.path.join(args.work_dir, "sites", "places-rows.json"), "w"), indent=0)
print(f"DONE: {made} lookups this run, {sum(1 for v in done.values() if v.get('website'))} numbers with a website, {sum(1 for i in items if i['website'])} rows with a website", flush=True)
