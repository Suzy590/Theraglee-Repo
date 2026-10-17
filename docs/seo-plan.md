# Theraglee — the SEO plan

This is the plan for getting theraglee.com in front of as many people as
possible through search engines, AI assistants and shared links. It is written
for the owner, not for a developer: the first half is what the site now does on
its own, the second half is the short list of things only you can do, with the
exact steps.

`seo.md` is the companion: how the pages are built and checked.

## The idea in one paragraph

Theraglee's advantage is that it already publishes more than almost any
competitor: five articles, two checklists and two challenge themes every day,
360 free tools, 372 journal prompts, a license-verified directory. Search
engines reward exactly that, as long as each piece has a real page with real
words on it, the pages link to each other, and Google has been told they
exist. So the plan is: give every piece a page (done, below), tell Google and
Bing (you, ten minutes), earn links from other sites (ongoing, the only hard
part), and keep writing titles that match what people type.

## What the site now does by itself

Everything in this list is built by `python3 tools/build_seo_pages.py`, which
the daily routines already run, and checked by `node tests/seo-pages/check.mjs`.

| What | Where | Why it matters |
|---|---|---|
| A page for every article | `/articles/<slug>` | Already there; now each one links to its topic hubs and carries breadcrumb data |
| A hub for every topic (43 today) | `/articles/topics/anxiety`, `/articles/topics/sleep`, … and the index at `/articles/topics` | Hubs are what rank for broad phrases like "articles about burnout". Every article is now two clicks from the homepage, which is how Google decides a page is important |
| A page for every challenge theme (64) | `/challenges/fostering-gratitude`, … and the index at `/challenges/themes` | Shows the first week of to-dos and a few from later in the year: real, unique content, with a "Start this challenge free" button |
| A page for every checklist (56) | `/checklists/daily-mental-health-checklist`, … and the index at `/checklists` | Every item is on the page. "Daily mental health checklist" is a phrase people type |
| A page for every Discover topic (18) | `/discover/sleep`, `/discover/anxiety`, … and the index at `/discover/topics` | Names all twenty free tools in the topic with what each does and how long it takes |
| The journal prompts page | `/tools/journal-prompts` | "Journal prompts for mental health" is one of the most searched phrases in this space; the page carries all 372 |
| `llms.txt` | `/llms.txt` | A plain summary for ChatGPT, Claude, Perplexity and Google's AI answers, which increasingly send visitors. It states the facts worth getting right (what is free, what Match Mode is, what Theraglee is not) |
| Share image and tags on every page | `og:image` → `/assets/social-card.png` | A Theraglee link pasted into Facebook, LinkedIn, iMessage, Slack or a text now shows a title, a line and a green card instead of a bare URL. More clicks per share |
| Clean titles and descriptions | Every page | Descriptions now end at a sentence instead of mid-word, and every public page has a canonical address, so Google never sees two copies |
| Breadcrumb data | Every generated page | Search results can show `Theraglee › Articles › Anxiety` under the title |
| Member-only shells marked noindex | `quiz.html`, `worksheet.html`, `checklist.html`, `journal.html`, `goals.html` | Keeps empty JavaScript shells out of the index so the real pages rank instead |
| Footer links to every hub | Every page | The hubs are one click from everywhere, which spreads ranking power across the site |

The sitemap went from 223 addresses to 412, and every new one is a page with
words on it, not a shell.

## What only you can do (about an hour, once)

These need the Google and Microsoft accounts. None of the above is visible to
Google until step 1 is done, so do it first.

### 1. Google Search Console (15 minutes)

This is the single most important step. It is free, and it is how Google
learns the site exists and how you see what people searched for.

1. Go to <https://search.google.com/search-console> and sign in with a Google
   account you will keep.
2. Click **Add property**, choose the **Domain** box on the left, type
   `theraglee.com`, and press Continue.
3. Google shows a line of text that starts with `google-site-verification=`.
   Copy it.
4. Sign in to Network Solutions, where the domain is registered, open the DNS
   settings for `theraglee.com`, and add a **TXT** record: host `@`, value the
   line you copied. Save.
5. Back in Search Console, click **Verify**. If it says it cannot find the
   record, wait an hour and press Verify again; DNS changes take a little time.
6. In the left menu open **Sitemaps**, type `sitemap.xml` in the box, press
   Submit.
7. Open **URL Inspection** (the search bar at the top), paste
   `https://theraglee.com/`, and click **Request indexing**. Do the same for
   these five:
   - `https://theraglee.com/articles/topics`
   - `https://theraglee.com/tools/journal-prompts`
   - `https://theraglee.com/checklists`
   - `https://theraglee.com/challenges/themes`
   - `https://theraglee.com/discover/topics`

That is it. Within a few days the **Pages** report shows what is indexed and
the **Performance** report shows what people searched for.

### 2. Bing Webmaster Tools (5 minutes)

Bing powers Bing, DuckDuckGo, Yahoo and parts of ChatGPT's browsing, so it is
worth the five minutes.

1. Go to <https://www.bing.com/webmasters> and sign in.
2. Choose **Import from Google Search Console** and follow the prompts. It
   copies the verification and the sitemap across; nothing else to do.

### 3. Tell Bing about new pages after each deploy (1 minute, repeatable)

The repo already holds an IndexNow key. From the repo folder:

```bash
python3 tools/indexnow_submit.py
```

A `200` or `202` back means Bing has the list. Run it after this change
deploys, and any time a batch of new pages goes live. Google does not take
IndexNow; it reads the sitemap on its own once step 1 is done.

### 4. Claim the name everywhere (20 minutes)

Make sure `theraglee` is yours on Instagram, Facebook, LinkedIn, Pinterest,
TikTok, YouTube and Reddit even if you never post. Put `https://theraglee.com`
in every bio. These links do not move rankings much on their own, but they
make the brand name unambiguous to Google, and Pinterest in particular sends
steady traffic to free printable and journaling content.

## What to do every week (15 minutes)

1. Open Search Console → **Performance**. Sort by impressions. Any phrase the
   site shows up for in positions 8 to 20 is a phrase it is nearly ranking
   for. Note the top three.
2. For each, find the page Google is showing (the report lists it) and make
   it better: a clearer title that uses the exact phrase, a sentence that
   answers the question in the first paragraph, a link to it from one of the
   hubs. Small edits to a nearly-ranking page beat a new page almost every
   time.
3. Run `python3 tools/indexnow_submit.py` if anything new went live.
4. Glance at **Pages** for anything marked "Crawled, currently not indexed" and
   growing. A few is normal for a new site. Hundreds means a kind of page is
   too thin and should be looked at.

## Writing for search (the daily routines, one small change)

The articles, checklists and challenges already arrive every day. The one
change that makes them rank: **write the title as the phrase someone types.**
"When Your Child Does Not Want to Go to School" is a good title; "Child refuses
to go to school: what is usually going on" is a good title that also matches a
search. The rules in `articles.md` still apply; this is about the first six
words.

The phrases below are the ones Theraglee already has content for and should
aim to own. Each is a title, a hub, or a page to write.

**For members (people looking for help)**

| Phrase | Page that should rank for it | Status |
|---|---|---|
| journal prompts for mental health | `/tools/journal-prompts` | Live |
| daily mental health checklist | `/checklists/daily-mental-health-checklist` | Live |
| mental health checklists | `/checklists` | Live |
| free anxiety quiz / anxiety self check | `/tools/anxiety-quiz` | Live |
| cbt thought record | `/tools/cbt-thought-record` | Live |
| gratitude challenge | `/challenges/fostering-gratitude` | Live |
| how to find a therapist | `/articles/how-to-find-a-therapist` | Live |
| feelings wheel | A hand-written page at `/tools/feelings-wheel` pointing at the Discover "wheel" tools | **Write next.** Very high volume, and the site already has the tool |
| box breathing / breathing exercise for anxiety | `/tools/breathing-exercises` pointing at the Discover "breathe" tools | Write next |
| grounding techniques | `/articles/topics/grounding` today; a hand page at `/tools/grounding-techniques` later | Hub live |
| burnout journal prompts | `/tools/journal-prompts-burnout` | Live |
| free mental health tools | `/discover/topics` | Live |
| mood tracker | A hand page at `/tools/mood-tracker` describing the Mood tab | Write when the Mood tab is open to free accounts |
| therapist near me + a county name | `/therapists/ventura-county`, `/therapists/los-angeles-county` | Live, empty until the first local therapists are verified |

**For therapists (the paying side)**

| Phrase | Page | Status |
|---|---|---|
| therapist directory listing / list my practice | `/for-therapists.html` | Live |
| psychology today alternative for therapists | `/for-therapists/compare` | Live, and the title already names Psychology Today. This is the highest-value phrase on the therapist side |
| how to get therapy clients | An article on the therapist side, linking to Match Mode | Write |
| therapist directory no per-session fee | `/for-therapists.html` | Live |

Adding a hand-written page means adding a row to `pages` in
`data/seo-pages.json` and running the build; `seo.md` lists the fields.

## Getting other sites to link to Theraglee

Links from other websites are still the strongest ranking signal, and the one
thing the code cannot do. In rough order of effort to payoff:

1. **A "Verified on Theraglee" badge for therapists.** Every verified
   therapist has a website. Give them a small badge that links back to their
   Theraglee profile and they will put it on their site, because it says
   "license verified" to their own visitors. A hundred therapists is a hundred
   relevant links. This is the single best link idea Theraglee has, and it is
   a small build: an image and a snippet on the practice dashboard.
2. **Give the free tools away as resources.** University counseling centers,
   school districts, employee assistance programs, libraries and nonprofits
   keep "mental health resources" pages and are glad to add a free,
   no-account, no-ads tool list. Send a short email with the link to
   `/discover/topics` and the `/tools/journal-prompts` page. Ten emails a week.
3. **Answer questions where people ask them.** Reddit (r/therapists for the
   therapist side; r/mentalhealth and r/selfimprovement for members), Quora,
   and Facebook groups for therapists. Answer honestly, link only when the
   page genuinely answers the question. The therapist communities are where
   the paying members are.
4. **Be quotable.** Sign up at Connectively (formerly HARO), Qwoted and
   Featured. Journalists ask for a mental health professional or a founder
   most days; each answer that lands is a link from a news site.
5. **Guest posts and podcasts on the therapist side.** Therapist-practice
   blogs and podcasts (private practice marketing, "how I got clients") take
   guests constantly, and their audience is the customer.
6. **Pinterest for the free content.** The checklists, journal prompts and
   challenge pages are made for it. One pin per new checklist, pointing at its
   page.

Do not buy links, join link exchanges, or let anyone "submit the site to 500
directories". Those get a site penalized.

## Measuring it

Search Console is the only measurement needed for the first few months. Three
numbers, checked weekly:

- **Indexed pages** (Pages report): should climb to most of the 412 within six
  to eight weeks of step 1, and keep climbing with the daily content.
- **Impressions** (Performance report): how often Theraglee appeared in a
  search. This grows first, before clicks, and is the sign the plan is working.
- **Clicks**: the visits. Expect these to lag impressions by a month or two,
  because new pages start on page three and move up.

A brand-new domain takes three to six months to rank for anything
competitive. The daily content, the hubs and the links above are what shorten
that. If after eight weeks indexed pages are not climbing, something is wrong
with step 1 and it is worth a look before anything else.

The privacy policy promises no third-party analytics on the site, which is a
real selling point for a mental health site and worth keeping. Search Console
is not on-site analytics (it reports Google's side), so it does not break
that promise. If on-site numbers are ever wanted, Vercel's own cookieless Web
Analytics is the option that comes closest to keeping it, but that is a
decision for the owner and a change to the policy text, so it is not switched
on here.

## The first ninety days

| When | Do |
|---|---|
| Week 1 | Steps 1 to 4 above. Run `indexnow_submit.py` after this deploys. Claim the social handles. |
| Weeks 2 to 4 | Write the feelings-wheel and breathing landing pages. Build the therapist badge. Start the weekly 15 minutes. Send the first ten resource-page emails. |
| Weeks 5 to 8 | Check indexed pages are climbing. Pick the three nearly-ranking phrases each week and improve those pages. Sign up for Connectively and Qwoted. First Reddit answers. |
| Weeks 9 to 12 | Pitch two therapist podcasts or blogs. Add a city page for the next metro once local therapists are verified. Review which article titles earned impressions and steer the daily routine toward those phrasings. |

## What is deliberately not done here

- **Changing addresses from `/pricing.html` to `/pricing`.** Cleaner, but
  every existing link and canonical would move, and a new site should not
  change its addresses twice. Revisit in a year if ever.
- **A page for each of the 360 free tools.** A title and two sentences is not
  enough to earn a search result; the topic pages carry them well for now. The
  handful with real search demand (feelings wheel, breathing) get hand-written
  pages instead.
- **Pages for each quiz and worksheet.** They are part of the paid Basic
  membership, so a visitor from a search would hit a paywall. If a few quizzes
  are ever made free, give those pages.
- **Author pages and credentials.** Google weighs who wrote health content.
  The honest version needs real names and real credentials from the owner; a
  made-up "reviewed by" would do more harm than good. When there is a clinical
  advisor, add an About page naming them and link the articles to it.

## About "Falcon SEO"

There is no single product called Falcon SEO. The name turns up as a hosting
company's SEO service, a Spanish agency's package, and most often as **Local
Falcon**, a paid tool that tracks where a business ranks on the Google map for
"near me" searches. Local Falcon is built for businesses with a physical
address and a Google Business Profile (a dentist, a plumber). Theraglee is an
online service, so there is no map listing to track, and the tool would have
nothing to measure. If the day comes that Theraglee has an office and wants to
appear on the map for "therapist directory near me", a Google Business Profile
comes first and Local Falcon could measure it after; until then, nothing above
needs it.
