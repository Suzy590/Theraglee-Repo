"""Pull every individual provider in the three counties from the NPI Registry.

Queries the public API by search term and ZIP prefix, splitting a prefix into
ten narrower ones whenever a query would hit the API's 1,200-row cap, then
keeps the rows whose taxonomy is one of the license types the Theraglee
sign-up form offers and writes them to raw/npi_rows.json.
"""
import csv, json, os, sys, time, urllib.parse, urllib.request

BASE = "https://npiregistry.cms.hhs.gov/api/"
OUT_DIR = sys.argv[1]
RAW = os.path.join(OUT_DIR, "raw")
os.makedirs(RAW, exist_ok=True)
GEO = os.path.join(RAW, "geo-data.csv")
if not os.path.exists(GEO):
    urllib.request.urlretrieve("https://raw.githubusercontent.com/scpike/us-state-county-zip/master/geo-data.csv", GEO)

TERMS = ["Counselor", "Marriage", "Social Worker", "Psychologist", "Neuropsychologist",
         "Psychiatry", "Psych/Mental Health", "Art Therapist", "Psychoanalyst"]
PREFIXES = ["900","901","902","903","904","905","906","907","908",
            "910","911","912","913","914","915","916","917","918",
            "930","931","932","934","935"]

# Sign-up credential -> NPI taxonomy codes (prefix match).
ALLOWED = {
    "101Y00000X": "Counselor (LPC/LPCC)",
    "101YM0800X": "Mental health counselor (LPCC/LMHC)",
    "101YP2500X": "Professional counselor (LPC/LPCC)",
    "101YA0400X": "Addiction counselor (LADC)",
    "106H00000X": "Marriage & family therapist (LMFT)",
    "1041C0700X": "Clinical social worker (LCSW)",
    "103T": "Psychologist (PsyD/PhD/EdD)",
    "103G00000X": "Clinical neuropsychologist (PsyD/PhD)",
    "2084P": "Psychiatrist (MD/DO)",
    "2084F0202X": "Forensic psychiatrist (MD/DO)",
    "363LP0808X": "Psychiatric nurse practitioner (PMHNP)",
    "221700000X": "Art therapist (LPAT/LCAT)",
    "102L00000X": "Psychoanalyst (Other)",
}

def label(code):
    for k, v in ALLOWED.items():
        if code.startswith(k):
            return v
    return None

def fetch(params, tries=6):
    url = BASE + "?" + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            time.sleep(2 * (i + 1))
    print("GIVING UP", params, flush=True)
    return {"results": [], "result_count": 0}

rows = {}
calls = 0

def pull(term, prefix):
    global calls
    got = []
    for skip in range(0, 1200, 200):
        d = fetch({"version": "2.1", "enumeration_type": "NPI-1", "taxonomy_description": term,
                   "state": "CA", "postal_code": prefix + "*", "limit": 200, "skip": skip})
        calls += 1
        res = d.get("results", [])
        got.extend(res)
        if len(res) < 200:
            break
    if len(got) >= 1200 and len(prefix) < 5:
        print(f"  split {term} {prefix}* ({len(got)} rows)", flush=True)
        for digit in "0123456789":
            pull(term, prefix + digit)
        return
    if len(got) >= 1200:
        print(f"  WARNING cap hit at 5-digit {term} {prefix}", flush=True)
    for r in got:
        if r.get("basic", {}).get("status") != "A":
            continue
        if not any(label(t.get("code", "")) for t in r.get("taxonomies", [])):
            continue
        rows[r["number"]] = r
    print(f"{term} {prefix}*: {len(got)} fetched, {len(rows)} kept so far, {calls} calls", flush=True)

for term in TERMS:
    for p in PREFIXES:
        pull(term, p)
    with open(os.path.join(RAW, "npi_rows.json"), "w") as f:
        json.dump(list(rows.values()), f)
    print(f"== finished {term}: {len(rows)} rows", flush=True)

print("DONE", len(rows), "rows,", calls, "calls", flush=True)
