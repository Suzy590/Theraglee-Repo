#!/usr/bin/env python3
"""Check that the email DNS for theraglee.com is complete and correct.

Setting up email means adding a handful of records that have to agree with
each other: one says where mail is delivered, the others say who is allowed
to send as the domain. Getting one wrong is quiet — mail keeps flowing until
the day a big provider decides it doesn't trust you.

    python3 tools/check_email_dns.py

It reads live DNS rather than any file in this repo, so it tells you what the
rest of the world actually sees. Records can take up to an hour to appear
after you add them; a MISS line right after an edit usually just means
"not yet".

Nothing here is specific to a machine — it asks Google's public resolver over
HTTPS, so it needs no `dig` and no local mail tooling.

`docs/email.md` explains every record and where its value comes from.
"""

from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request

RESOLVER = "https://dns.google/resolve"
DEFAULT_DOMAIN = "theraglee.com"


def is_dkim(value: str) -> bool:
    """A live DKIM record carries a public key, so `p=` with something after it.

    A revoked key is published as a bare `p=`, which is why the length matters
    rather than just the presence of the tag.
    """
    return "p=" in value and len(value) > 40


# Each check is (label, host prefix, record type, test for one value, hint).
# The prefix is joined to the domain; "" means the domain itself. The test
# runs against each value separately so the report can name the record that
# actually matched — an apex carries several TXT records and printing the
# wrong one sends you looking for a problem that isn't there.
CHECKS = [
    (
        "Receiving (MX)",
        "",
        "MX",
        lambda v: "google.com" in v.lower(),
        "No mail can arrive without this. Add MX '@' -> smtp.google.com, priority 1.",
    ),
    (
        "Sender policy (SPF)",
        "",
        "TXT",
        lambda v: v.startswith("v=spf1") and "_spf.google.com" in v,
        "Add TXT '@' -> v=spf1 include:_spf.google.com ~all (exactly one SPF record).",
    ),
    (
        "Google signature (DKIM)",
        "google._domainkey",
        "TXT",
        is_dkim,
        "Generate it in the Workspace admin console, then add it as TXT 'google._domainkey'.",
    ),
    (
        "Policy (DMARC)",
        "_dmarc",
        "TXT",
        lambda v: v.startswith("v=DMARC1"),
        "Add TXT '_dmarc' -> v=DMARC1; p=none; rua=mailto:hello@theraglee.com",
    ),
    (
        "App signature (Resend DKIM)",
        "resend._domainkey",
        "TXT",
        is_dkim,
        "Copy it from the Resend dashboard. Without it the site's own email is unsigned.",
    ),
    (
        "App return path (Resend MX)",
        "send",
        "MX",
        lambda v: "amazonses.com" in v.lower(),
        "Copy it from Resend. The region in the value must match your Resend region.",
    ),
    (
        "App sender policy (Resend SPF)",
        "send",
        "TXT",
        lambda v: v.startswith("v=spf1") and "amazonses.com" in v,
        "Add TXT 'send' -> v=spf1 include:amazonses.com ~all",
    ),
]


def lookup(host: str, rtype: str) -> list[str]:
    """Return the record values for a name, or [] if there are none."""
    query = urllib.parse.urlencode({"name": host, "type": rtype})
    request = urllib.request.Request(
        f"{RESOLVER}?{query}", headers={"Accept": "application/dns-json"}
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.load(response)
    # A TXT value arrives wrapped in quotes, and a long one arrives split into
    # several quoted chunks that are meant to be read as one string.
    values = []
    for answer in payload.get("Answer", []):
        data = answer.get("data", "")
        if rtype == "TXT":
            data = "".join(part.strip('"') for part in data.split('" "'))
            data = data.strip('"')
        values.append(data)
    return values


def main(argv: list[str]) -> int:
    domain = argv[1] if len(argv) > 1 else DEFAULT_DOMAIN
    print(f"Email DNS for {domain}\n")

    failures = []
    for label, prefix, rtype, passes, hint in CHECKS:
        host = f"{prefix}.{domain}" if prefix else domain
        try:
            values = lookup(host, rtype)
        except Exception as error:  # a resolver that is down is not a verdict
            print(f"  ????  {label:<31} could not be checked ({error})")
            continue

        found = next((v for v in values if passes(v)), None)
        if found is not None:
            shown = found if len(found) <= 58 else f"{found[:55]}..."
            print(f"  ok    {label:<31} {shown}")
        else:
            print(f"  MISS  {label:<31} {host} has no usable {rtype} record")
            failures.append((label, hint))

    if not failures:
        print("\nEverything is in place. Send a test message both ways to confirm.")
        return 0

    print(f"\n{len(failures)} record(s) still to add:\n")
    for label, hint in failures:
        print(f"  {label}\n    {hint}\n")
    print("Full walkthrough: docs/email.md")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
