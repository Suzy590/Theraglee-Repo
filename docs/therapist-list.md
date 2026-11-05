# The therapist outreach list

A spreadsheet of licensed therapists for the outreach plan in
`outreach-email.md`: one row per provider, with name, license, practice
address, phone, and, where a practice website could be found, the email on
it. The scripts live in `tools/therapist_list/`. Nothing here is committed to
the repo: the list is built into a work folder outside it and sent as a file.

## Where the rows come from

The NPI Registry (npiregistry.cms.hhs.gov), the US government's public list of
every healthcare provider. Its API is free and needs no key. `pull_npi.py`
asks it for every individual provider in a set of ZIP prefixes whose taxonomy
is one of the license types on the therapist sign-up form (`CREDENTIALS` in
`site/assets/lists.js`), and `classify.py` sorts them into counties by ZIP
code, using a public ZIP-to-county table, with a city-name fallback.

The registry does **not** say whether someone is currently licensed. A license
number on the row is what the provider reported, not a verification. Rows
without one are usually associates, interns or agency staff.

## Where the emails come from

The registry has no websites or emails. `places_lookup.py` sends each practice
phone number to Google Places (New), which returns the practice's Google
Business Profile listing and its website when the therapist has one.
`extract_emails.py` then reads that site's home and contact pages for an
address. Expect a website for roughly a third to a half of private-practice
rows, and an email on most of those sites.

Google bills the website field at $35 per 1,000 lookups after the first 1,000
free each month (the Text Search Enterprise SKU). One lookup per distinct
phone number, so a county's cost is its unique numbers, not its rows.
`--max` on the lookup script is the spending cap; a run can always be resumed.

The key lives in the cloud environment as `GOOGLE_PLACES_API_KEY`, restricted
on Google's side to Places API (New) only. Never commit it.

## Building the list

```bash
W=/path/to/a/work/folder            # outside the repo
python3 tools/therapist_list/pull_npi.py $W        # ~10 minutes; writes raw/npi_rows.json
python3 tools/therapist_list/classify.py $W        # writes rows/therapists.json and prints counts
python3 tools/therapist_list/places_lookup.py $W --counties "Ventura,Santa Barbara" --max 3000
python3 tools/therapist_list/extract_emails.py $W  # reads each website once
python3 tools/therapist_list/build_xlsx.py $W $W/california-therapists.xlsx
```

`pull_npi.py` is set to the ZIP prefixes of Ventura, Santa Barbara and Los
Angeles counties (`PREFIXES`); `classify.py` carries the county tables. To add
a county, add its prefixes and its ZIP rows or city names there.

## Before anyone is emailed

The three legal rules in `outreach-email.md` apply to every address on the
list: an honest subject line, a working unsubscribe link, and a postal address
in the footer. Never write to a therapist's clients, and never buy a list.
