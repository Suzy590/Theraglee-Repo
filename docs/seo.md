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

The script writes:

| Output | Built from | What it is |
|---|---|---|
| `site/tools/<slug>/index.html`, `site/articles/how-to-find-a-therapist/index.html` | `pages` in `data/seo-pages.json` | The hand-written landing pages, one per row |
| `site/articles/<slug>/index.html` | `data/articles.json` | One page per article, with the whole article in the markup (every article is free) |
| `site/articles/topics/<tag>/index.html`, `site/articles/topics/index.html` | The tags in `data/articles.json` | One hub per tag listing every article that carries it, newest first, plus the index of hubs. Every article links to its hubs, so nothing is more than two clicks from the homepage |
| `site/tools/quizzes/index.html`, `site/tools/worksheets/index.html` | `data/quizzes.txt`, `data/worksheets.json` | Catalogs naming every quiz and worksheet by topic, so the library is crawlable even though the tools are for members |
| `site/tools/journal-prompts/index.html` | `data/journal-prompts.txt` | Every journal prompt on one long page, with a how-to and an FAQ |
| `site/challenges/<slug>/index.html`, `site/challenges/themes/index.html` | `data/challenges.json` | One page per challenge theme (the first seven to-dos, five from later in the year, how a challenge works) and the index by category |
| `site/checklists/<slug>/index.html`, `site/checklists/index.html` | `data/checklists.json` | One page per checklist with every item on it, and the index by category |
| `site/discover/<topic>/index.html`, `site/discover/topics/index.html` | `site/assets/discover-tools.js` (read through `node`) | One page per Discover topic naming its twenty free tools, with the kind and minutes of each, and the index |
| `site/therapists/<city-st>/index.html` | `cities` in `data/seo-pages.json` | One directory page per launch metro |
| `site/sitemap.xml` | All of the above | Plus the public pages at the site root |
| `site/llms.txt` | All of the above | A plain summary of the site and its sections for AI assistants and answer engines, which read it the way crawlers read `robots.txt` |
| The FAQ block in `site/index.html` and `site/for-therapists.html` | The questions visible on each page | `FAQPage` structured data |

Never hand-edit the generated HTML, `sitemap.xml` or `llms.txt`. Change the
source row, or the script, and run it again. Running it twice in a row changes
nothing. A folder whose source row is gone (a renamed slug) is removed on the
next run. `node tests/seo-pages/check.mjs` confirms every article, tag,
challenge, checklist and Discover topic has its page, every page is in the
sitemap, every description fits a search result, every page carries the share
image and breadcrumb data, and the structured data parses.

### What every page's head carries

Generated pages get it from `shell()`; the hand-maintained pages at the site
root carry the same tags by hand:

- `<title>` with the search term first and `— Theraglee` last.
- A `<meta name="description">` between 50 and 160 characters. The generator
  trims a long excerpt with `meta_description()`, which ends at a sentence
  when it can and never cuts a word in half.
- `<link rel="canonical">` matching the URL exactly.
- Open Graph and Twitter tags (`og:title`, `og:description`, `og:url`,
  `og:image`, `twitter:card` of `summary_large_image`) so a shared link shows
  a title, a line and a picture. The picture is `site/assets/social-card.png`,
  1200 by 630, drawn by `python3 tools/social_card.py` from the logo and the
  site's typefaces. Re-run that after changing the logo or the tagline.
- `BreadcrumbList` structured data from the `crumbs` passed to `shell()`, so a
  search result can show `Theraglee › Articles › Anxiety` under the title.

Pages that only forward to the dashboard or hold a member tool behind a
`?slug=` (`journal.html`, `goals.html`, `quiz.html`, `worksheet.html`,
`checklist.html`) say `<meta name="robots" content="noindex">`: the crawlable
page for each is the generated one.

### Articles

Every article gets a page automatically. The daily articles routine runs the
build after it appends the day's five to `data/articles.json`, and the article
check refuses an article whose page is missing, so a new article cannot ship
without one. The page carries the full text, `Article` structured data with
the publish date and tags, up to four related articles by shared tag, and the
tool pages the tags point to (`TOOL_FOR_TAG` in the script).

Links across the site (`articles.html`, the explore grid, the dashboard) go to
`/articles/<slug>`. `site/article.html?slug=` still works for old links and
sets a canonical to the clean URL, and a rewrite in `site/vercel.json` sends
`/articles/<slug>` to `article.html` when no generated page exists yet, so a
clean URL never 404s between an article reaching the database and its page
reaching the site.

### City pages

The launch areas are Ventura County and Los Angeles County, so the two rows
in `cities` are counties. A row is an area of any size:

```json
{ "path": "therapists/ventura-county", "name": "Ventura County", "state": "CA",
  "state_name": "California",
  "cities": ["Ventura", "Oxnard", "Thousand Oaks", "..."],
  "zips": ["93001-93012", "93015-93066", "93094", "93099", "91319-91320", "91358-91362", "91377"] }
```

`path`, `name`, `state` and `state_name` are required (`city` still works in
place of `name` for a single city). The page is a headline, an intro naming
the first ten `cities`, a live listing, three blocks on choosing a therapist
and what verified means, links onward, and four questions with `FAQPage`
data. `title`, `description`, `h1`, `intro`, `blocks` and `faq` on the row
override the defaults when an area deserves its own copy. Write the copy in
US English and keep the two rules below.

The listing is decided in the browser. `search_therapists` matches its search
text against names and bios, not addresses, so the page asks the directory
for every therapist licensed in the state (up to 400) and keeps the ones with
a practice location whose city is in `cities` (case-insensitive) or whose zip
falls in one of the `zips` ranges. Below those it shows up to twelve more who
are licensed in the state and see people by video. The zip ranges skip the
codes that belong to neighboring counties (Orange, San Bernardino, Kern and
Santa Barbara), so a Buena Park or Carpinteria practice does not land on the
wrong page.

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

### IndexNow (Bing, without an account)

Bing, Yandex, Seznam and Naver share [IndexNow](https://www.indexnow.org/), an
open protocol that needs no account: the site hosts a key file at its root
(`site/<key>.txt`, holding the key) and posts the URLs it wants crawled. This
repository carries one key file, and

```bash
python3 tools/indexnow_submit.py                      # every URL in the sitemap
python3 tools/indexnow_submit.py /articles/a-slug     # or just the new ones
```

posts them. A `200` or `202` means the batch was accepted, and Bing then
crawls those URLs on its own schedule. This is a nudge, not a replacement for
Bing Webmaster Tools, which is where the reports live; Google does not take
IndexNow at all and needs the Search Console steps above.

## What is not done yet

- **The county pages have no therapists on them yet.** Ventura County and
  Los Angeles County are live at `/therapists/ventura-county` and
  `/therapists/los-angeles-county`, and each shows "no verified therapists
  yet" until the first practices in those counties are verified. The copy
  above the listing is what there is to rank on until then.
- **Search Console and Bing.** Submitting the sitemap needs the Google and
  Microsoft accounts; the steps are above, and `seo-plan.md` walks through
  them.
- **One page per quiz and worksheet.** The catalogs name every tool, but each
  quiz and worksheet is still only reachable through a `?slug=` URL, and every
  one is `min_level = 2`, so a visitor arriving from a search has to pay to use
  it. Making a handful of quizzes free would give a per-quiz page something to
  convert with; until then, per-tool pages would be thin.
- **One page per Discover tool.** The 360 free tools have topic pages, not
  pages of their own. A per-tool page needs more words than a title and two
  sentences to be worth indexing; the plan names the few (the feelings wheel,
  the breathing tools) that deserve a hand-written landing page first.
