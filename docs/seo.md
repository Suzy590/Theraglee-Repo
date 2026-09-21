# Theraglee — search

## The problem this solves

Every tool, quiz, worksheet and article lives in the database and is drawn by
JavaScript from a `?slug=` query string. A crawler arriving at
`quiz.html?slug=low-mood-check-in` is handed an empty shell: no headline, no
copy, nothing to index. That is why the site had no pages in search results.

The fix is a readable front door. Each landing page is real HTML at a
descriptive URL, with the headline, the intro and the links already in the
markup, and it points at the interactive tool behind it.

## Building the pages

```bash
python3 tools/build_seo_pages.py
```

Source rows are in `data/seo-pages.json`. The script writes:

| Output | What it is |
|---|---|
| `site/<path>/index.html` | One landing page per row, served at `/<path>` |
| `site/sitemap.xml` | Those pages plus the public pages at the site root |
| The FAQ block in `site/index.html` and `site/for-therapists.html` | `FAQPage` structured data, rebuilt from the questions visible on each page |

Never hand-edit the generated HTML or `sitemap.xml`. Change the source row, or
the script, and run it again. Running it twice in a row changes nothing.

A folder holding an `index.html` is served at the folder's own path, so
`site/tools/anxiety-quiz/index.html` answers to `/tools/anxiety-quiz` with no
redirect and no entry in `vercel.json`.

### Adding a page

Add an object to `pages` in `data/seo-pages.json` and re-run the script:

| Field | What it holds |
|---|---|
| `path` | The URL, lowercase and hyphenated, no leading slash (`tools/anxiety-quiz`) |
| `title` | The `<title>`. Put the search term first, `— Theraglee` last |
| `description` | The meta description. Aim for 140–180 characters |
| `h1` | The headline a reader sees. One per page |
| `intro` | Two or three sentences directly under the headline |
| `blocks` | `{ "h2": ..., "html": ... }` sections, in order |
| `related` | Links on to other tools, so no page is a dead end |
| `faq` | `{ "q": ..., "a": ... }` pairs. These also become `FAQPage` data |

Two rules the script cannot check for you. Structured data has to describe what
a visitor can actually read, so never put a question in `faq` that is not on the
page. And Theraglee does not diagnose, screen for or treat anything, so a page
about a quiz says so plainly.

## Why the pages carry `<base href="/">`

`chrome()` in `site/assets/app.js` writes the header and footer with relative
links (`href="pricing.html"`). From a page one folder down, those would resolve
to `/tools/pricing.html`. The `<base>` tag makes every relative URL on the page
resolve from the site root instead, including the redirects the sign-out button
performs. Keep it on any page that is not at the site root.

## Structured data

| Page | Types |
|---|---|
| Homepage | `Organization`, `WebSite`, `FAQPage` |
| For Therapists | `Organization`, `FAQPage` |
| Every landing page | `Article`, `FAQPage` |

The two `FAQPage` blocks on the hand-maintained pages sit between
`<!-- faq-jsonld:start -->` and `<!-- faq-jsonld:end -->`. **Edit the questions
on the page, then re-run the script**, and the markup follows. Do not write the
JSON by hand: markup that does not match the visible page can earn a manual
penalty from Google.

## Submitting the sitemap

`site/robots.txt` points crawlers at `https://theraglee.com/sitemap.xml`, which
is enough for them to find it. To get pages indexed faster, add the property in
[Google Search Console](https://search.google.com/search-console):

1. Add a property for `theraglee.com` (the domain option, verified by DNS at
   Network Solutions, covers every subdomain).
2. Open **Sitemaps**, enter `sitemap.xml`, and submit.
3. Use **URL Inspection → Request indexing** on the homepage and each landing
   page. That is the fastest route for a site with no history.
4. Do the same at [Bing Webmaster Tools](https://www.bing.com/webmasters),
   which can import the Search Console property directly.

Re-submitting after each deploy is not necessary. Crawlers re-read the sitemap
on their own.

## What is not done yet

- **The city pages.** One directory page per launch metro is still to come.
  They need two things this repository does not have: the list of launch metros,
  and therapists published in them. As of this writing no therapist listing is
  live, so a city page would be an empty result with nothing to rank for.
- **The rest of the library.** 67 articles, 312 quizzes and 186 worksheets still
  exist only behind a `?slug=` URL. The generator is built to cover them; the
  open question is the paywall below.
- **Paywalled tools rank badly.** Every quiz and worksheet is `min_level = 2`,
  so a visitor arriving from a search for "anxiety quiz" has to pay to take one.
  Articles are the only free content. Making a handful of quizzes free would
  give the landing pages something to convert with.
