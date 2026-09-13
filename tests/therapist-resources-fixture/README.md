# Clinician library data checks

`check.mjs` reads `data/therapist-resources.json` (the repo copy of the
`therapist_resources` table behind the therapist dashboard's Library tab) and
fails if a resource is malformed: a repeated slug or title, an unknown kind or
audience, a client prompt out of sequence, notes with markup in them, UK
spelling, or copy that labels a person by a diagnosis.

```bash
node tests/therapist-resources-fixture/check.mjs
```

The list of kinds lives in the check itself (`KINDS`) and mirrors the
`resource_kind` enum in the database. Add a kind there, and to the chips in
`site/therapist-dashboard.html`, before using it in the data.
