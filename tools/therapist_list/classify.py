"""Turn raw/npi_rows.json into rows/therapists.json: one row per provider,
with county, license label, practice address, phone, and flags."""
import csv, json, os, re, sys, collections

OUT_DIR = sys.argv[1]
RAW = os.path.join(OUT_DIR, "raw")
_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "pull_npi.py")).read()
exec(_src[_src.index("# Sign-up credential"):_src.index("def fetch(")])  # defines ALLOWED and label()

# ZIP -> county from the public table, for the three counties only.
zip_county = {}
with open(os.path.join(RAW, "geo-data.csv"), newline="") as f:
    for r in csv.DictReader(f):
        if r["state_abbr"] == "CA" and r["county"] in ("Los Angeles", "Santa Barbara", "Ventura") and r["zipcode"].isdigit():
            zip_county[r["zipcode"]] = r["county"]

CITY_COUNTY = {}
for c in """Los Angeles|Long Beach|Glendale|Santa Clarita|Lancaster|Palmdale|Pomona|Torrance|Pasadena|El Monte|Downey|Inglewood|West Covina|Norwalk|Burbank|Compton|South Gate|Carson|Santa Monica|Hawthorne|Whittier|Alhambra|Lakewood|Bellflower|Baldwin Park|Lynwood|Redondo Beach|Pico Rivera|Montebello|Monterey Park|Gardena|Huntington Park|Arcadia|Diamond Bar|Paramount|Glendora|Rosemead|Covina|Azusa|Cerritos|La Mirada|Rancho Palos Verdes|Culver City|Bell Gardens|Monrovia|Temple City|Claremont|Manhattan Beach|Beverly Hills|San Gabriel|West Hollywood|La Puente|San Dimas|Lawndale|Bell|Calabasas|Maywood|La Verne|Duarte|Lomita|South Pasadena|Cudahy|Agoura Hills|San Fernando|Hermosa Beach|El Segundo|Malibu|Artesia|Walnut|San Marino|Commerce|Palos Verdes Estates|La Canada Flintridge|La Canada|South El Monte|Signal Hill|Hawaiian Gardens|Sierra Madre|La Habra Heights|Rolling Hills Estates|Avalon|Irwindale|Bradbury|Hidden Hills|City of Industry|Industry|Vernon|Rolling Hills|Hollywood|North Hollywood|West Hollywood|Van Nuys|Sherman Oaks|Encino|Tarzana|Woodland Hills|Studio City|Reseda|Northridge|Canoga Park|Chatsworth|Granada Hills|Panorama City|Sun Valley|Sylmar|Valley Village|Winnetka|West Hills|Porter Ranch|Pacoima|Arleta|Lake Balboa|Toluca Lake|Venice|Playa Del Rey|Playa Vista|Marina Del Rey|Pacific Palisades|Brentwood|Westwood|Century City|Mar Vista|Eagle Rock|Highland Park|Silver Lake|Los Feliz|Echo Park|San Pedro|Wilmington|Harbor City|Sunland|Tujunga|Altadena|Valencia|Newhall|Canyon Country|Stevenson Ranch|Castaic|Saugus|Acton|Agua Dulce|Topanga|Rowland Heights|Hacienda Heights|East Los Angeles|Willowbrook|Ladera Heights|View Park|Lennox|West Carson|La Crescenta|Montrose|Quartz Hill|Littlerock|Lake Los Angeles|Pearblossom|Llano|Leona Valley|Lake Hughes|Valinda|Charter Oak|Universal City|Verdugo City|Sherman Oaks|Santa Fe Springs|South Whittier|East Rancho Dominguez|Walnut Park|Florence|Mission Hills|Northridge|Harbor City|Terminal Island|Dockweiler|Westchester|Boyle Heights|Koreatown|Downtown Los Angeles|Mt Washington|Atwater Village|Glassell Park|Cypress Park|Lincoln Heights|El Sereno|Mid City|Culver City|Baldwin Hills|Crenshaw|Leimert Park|Watts|Hyde Park|Westmont|Athens|Vermont Vista|Florence-Graham|Monterey Hills|Castellammare|Topanga Canyon""".split("|"):
    CITY_COUNTY[c.upper()] = "Los Angeles"
for c in """Ventura|San Buenaventura|Oxnard|Thousand Oaks|Simi Valley|Camarillo|Moorpark|Santa Paula|Port Hueneme|Fillmore|Ojai|Newbury Park|Oak Park|Somis|Piru|Oak View|Casitas Springs|Meiners Oaks|Mira Monte|Channel Islands Beach|El Rio|Saticoy|Bell Canyon|Lake Sherwood|Point Mugu|Westlake Village|Westlake|Santa Rosa Valley|Camarillo Springs|Hollywood Beach|Silver Strand|Oxnard Shores|Ojai Valley""".split("|"):
    CITY_COUNTY[c.upper()] = "Ventura"
for c in """Santa Barbara|Santa Maria|Lompoc|Goleta|Carpinteria|Buellton|Solvang|Guadalupe|Isla Vista|Montecito|Summerland|Orcutt|Los Alamos|Los Olivos|Santa Ynez|Ballard|Vandenberg Village|Vandenberg AFB|Vandenberg SFB|Vandenberg Air Force Base|Vandenberg Space Force Base|New Cuyama|Cuyama|Casmalia|Sisquoc|Garey|Hope Ranch|Gaviota|Toro Canyon|Mission Canyon|Nipomo""".split("|"):
    CITY_COUNTY[c.upper()] = "Santa Barbara"
CITY_COUNTY["NIPOMO"] = None  # San Luis Obispo County; keep the entry out
CITY_COUNTY["WESTLAKE VILLAGE"] = "Ventura"  # 91361 straddles the line; the table decides when the ZIP is known

def county_of(addr):
    z = (addr.get("postal_code") or "")[:5]
    if z in zip_county:
        return zip_county[z], "zip"
    c = (addr.get("city") or "").upper().strip()
    if c in CITY_COUNTY and CITY_COUNTY[c]:
        return CITY_COUNTY[c], "city"
    return None, None

def title(s):
    return re.sub(r"\b([a-z])", lambda m: m.group(1).upper(), (s or "").lower()).replace("'S", "'s") if s else ""

def fmt_addr(a):
    line = a.get("address_1", "")
    if a.get("address_2"):
        line += ", " + a["address_2"]
    return title(line)

with open(os.path.join(RAW, "npi_rows.json")) as f:
    raw = json.load(f)

out = []
stats = collections.Counter()
for r in raw:
    b = r["basic"]
    if not b.get("first_name"):
        stats["no_name"] += 1
        continue
    # Practice locations, in order: primary location, then extra practice locations, then mailing.
    locs = [a for a in r["addresses"] if a["address_purpose"] == "LOCATION" and a.get("state") == "CA"]
    locs += [a for a in r.get("practiceLocations", []) if a.get("state") == "CA"]
    mail = [a for a in r["addresses"] if a["address_purpose"] == "MAILING" and a.get("state") == "CA"]
    chosen, how, source = None, None, None
    for a in locs:
        c, how = county_of(a)
        if c:
            chosen, source = a, "practice"
            break
    if not chosen:
        for a in mail:
            c, how = county_of(a)
            if c:
                chosen, source = a, "mailing"
                break
    if not chosen:
        stats["outside_counties"] += 1
        continue
    county = county_of(chosen)[0]
    # License types: every allowed taxonomy, CA license numbers where given.
    labels, licenses, states = [], [], set()
    primary = None
    for t in r["taxonomies"]:
        lb = label(t.get("code", ""))
        if not lb:
            continue
        if lb not in labels:
            labels.append(lb)
        if t.get("license"):
            licenses.append(f"{t['license']} ({t.get('state') or '?'})")
        if t.get("state"):
            states.add(t["state"])
        if t.get("primary") and not primary:
            primary = lb
    primary = primary or labels[0]
    if states and "CA" not in states:
        stats["licensed_elsewhere_only"] += 1
        flag = "License on file is from " + ", ".join(sorted(states)) + ", not CA"
    else:
        flag = ""
    if source == "mailing":
        flag = (flag + "; " if flag else "") + "Mailing address only (no practice address in these counties)"
    out.append({
        "npi": r["number"],
        "first_name": title(b.get("first_name")),
        "last_name": title(b.get("last_name")),
        "credential": (b.get("credential") or "").replace(".", ""),
        "primary_license": primary,
        "all_licenses": "; ".join(labels),
        "license_numbers": "; ".join(licenses),
        "county": county,
        "city": title(chosen.get("city")),
        "zip": (chosen.get("postal_code") or "")[:5],
        "address": fmt_addr(chosen),
        "phone": chosen.get("telephone_number") or next((a.get("telephone_number") for a in r["addresses"] if a.get("telephone_number")), ""),
        "sole_proprietor": b.get("sole_proprietor", ""),
        "npi_updated": b.get("last_updated", ""),
        "flag": flag,
    })
    stats[county] += 1
    stats[f"{county}/{primary}"] += 1
    stats[f"{county}/sole={b.get('sole_proprietor')}"] += 1

os.makedirs(os.path.join(OUT_DIR, "rows"), exist_ok=True)
with open(os.path.join(OUT_DIR, "rows", "therapists.json"), "w") as f:
    json.dump(out, f, indent=0)
for k, v in sorted(stats.items()):
    print(f"{v:6d}  {k}")
print("total rows", len(out))
