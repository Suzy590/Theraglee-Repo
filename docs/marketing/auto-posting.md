# Auto-posting: new pages that announce themselves

Theraglee publishes nine new pages a day. Nobody should type nine posts a day,
so the site publishes three RSS feeds and the posting tools do it. Set each
one up once; after that every new article, checklist and challenge is posted
with its picture, title and link the hour it goes live.

## The feeds

| Feed | What is in it | Picture |
|---|---|---|
| `https://theraglee.com/feed.xml` | The newest fifty articles | The article's own share card |
| `https://theraglee.com/feed-checklists.xml` | The newest fifty checklists, with the items in the summary | The checklist's card |
| `https://theraglee.com/feed-challenges.xml` | The newest fifty challenge themes | The theme's card |

Each item carries the title, the link, the date, a one- or two-sentence
summary, a category, and the page's 1200 by 630 picture as an `enclosure`
and as `media:content`, which is what the tools below look for. Paste a feed
address into any browser to see it.

## Pinterest (the one that matters most for this site)

Checklists, journal prompts, affirmations and quotes are exactly what people
save on Pinterest, and Pinterest sends steady traffic to pages like these for
years. It can pin a feed on its own.

1. Make sure the Theraglee Pinterest account is a **business** account
   (Settings → Account management → Convert to business; free).
2. **Claim the website.** Settings → Claimed accounts → Websites → Claim.
   Pinterest shows a line of HTML that begins `<meta name="p:domain_verify"`.
   Send that line to Claude ("add this Pinterest verification tag to the
   homepage") and it goes into `site/index.html`; or add it to the `<head>`
   of `site/index.html` yourself and push. Then press Verify.
3. **Auto-publish from RSS.** Settings → Bulk create Pins → *Auto-publish*
   (Pinterest moves this around; search its help for "auto-publish RSS").
   Add `https://theraglee.com/feed-checklists.xml` and choose or create a
   board called *Mental health checklists*. Add `feed.xml` to a board called
   *Mental health articles* and `feed-challenges.xml` to *Daily wellbeing
   challenges*. Pinterest pulls new items every day or so.
4. Pin the evergreen pages by hand once, using the Pinterest button at the
   foot of each: `/tools/journal-prompts`, `/tools/positive-affirmations`,
   `/tools/mental-health-quotes`, `/tools/feelings-wheel`,
   `/tools/breathing-exercises`, `/tools/grounding-techniques`, `/checklists`.
   The pin copy is in `social-posts.md`.

## Facebook, LinkedIn, Instagram and X

Any of these tools reads a feed and posts each new item. They all have a free
tier that covers three feeds and a few accounts.

| Tool | Free tier | Good for | Setup |
|---|---|---|---|
| **dlvr.it** | 3 feeds, 1 post an hour, 3 social accounts | The simplest "feed in, posts out" | Add feed → connect the Facebook Page, LinkedIn Page and X → done |
| **Buffer** | 3 channels, 10 queued posts each | Posting at good times of day, light editing before each goes out | Settings → Feeds (on some plans) or use Zapier below to fill Buffer's queue |
| **Zapier** | 100 tasks a month | Anything custom: feed → Buffer, feed → Facebook Page, feed → a Google Sheet | Trigger *RSS by Zapier: New Item in Feed* → action *Create Post* on the channel |
| **IFTTT** | 2 applets | Feed → Facebook Page, feed → X | Applet: *RSS Feed → New feed item* then *Facebook Pages → Create a link post* |

Recommended: dlvr.it for the three feeds to the Facebook Page and the LinkedIn
Page, and Buffer for the hand-written posts from `social-posts.md`. Instagram
does not take link posts from a feed (links do not work in captions); post
there by hand with the picture and "link in bio", or let Buffer post the
picture with the title.

Settings that matter in any of these tools:

- **Post text**: `{title} — {summary}` with the link. The summary is written
  to be read, so it reads as a sentence, not as a teaser.
- **Picture**: use the item's enclosure or media image, not a page scrape.
- **Pace**: at most one post an hour and no more than three a day per
  account; the tools can space them. Nine a day on one account looks like a
  bot and gets muted.
- **Which feed where**: articles to LinkedIn and Facebook; checklists and
  challenges to Facebook and Pinterest; X takes all three if you like.

## LinkedIn, for the therapist side

Therapists are on LinkedIn. The articles feed is fine there, but the posts
that bring therapists in are the hand-written ones in `social-posts.md` about
the flat rate, the founding offer, Match Mode and the guides at
`/for-therapists/guides`. Post those from the Theraglee Page and from your own
profile, where people actually see them.

## Checking it works

- Open the account the day after: a new post should show the card picture,
  the title and the link. If the picture is missing, the tool is scraping
  the page instead of reading the enclosure; switch that setting.
- The practice dashboard's **Stats** tab shows therapists their referrals;
  for the site as a whole, once the Google Analytics tab is allowed on
  (`../google-analytics.md`), *Acquisition* shows how many visitors each
  network sends.

## When the pictures or feeds need changing

The cards are drawn by `tools/share_cards.py` and the feeds by
`tools/build_seo_pages.py`; both are described in `../seo.md`. Changing the
look of every card means bumping `VERSION` in `share_cards.py` and running
the build; the feeds carry the newest fifty of each kind and need nothing.
