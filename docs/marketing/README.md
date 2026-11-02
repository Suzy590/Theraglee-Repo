# Promoting Theraglee: what runs by itself, and the one hour that is yours

This folder is the marketing side of the site, written for the owner. The
search side is in `../seo-plan.md` and the build in `../seo.md`; this is
everything that gets Theraglee in front of members and therapists beyond a
search result, and it is arranged by how much of your time each piece takes.

## What now runs with no one touching it

| Every day | What happens | Where it is |
|---|---|---|
| Five articles, two checklists, two challenge themes, clinician-library tools | Written, checked, merged and loaded into the database by the daily routines | `../articles.md`, `../checklists.md`, `../challenges.md`, `../therapist-resources.md` |
| A page, a share image and share buttons for each of them | The build draws a 1200 by 630 card with the title on it and puts Facebook, X, LinkedIn, Pinterest, email and copy-link buttons at the foot of every page | `tools/build_seo_pages.py`, `tools/share_cards.py` |
| The RSS feeds update | `/feed.xml` (articles), `/feed-checklists.xml`, `/feed-challenges.xml`, each item with its picture | `../seo.md`, *RSS feeds* |
| Bing hears about the new pages | A GitHub workflow submits the changed sitemap URLs through IndexNow after each deploy | `.github/workflows/indexnow.yml` |
| Every Tuesday | Three new search landing pages (two for members, one for therapists) and the next week's social posts, opened as a pull request for you to merge with one click | The *Theraglee weekly growth* scheduled task, below |

Once you connect a posting tool to the feeds (ten minutes, `auto-posting.md`),
every new article, checklist and challenge is also posted to your social
accounts and pinned on Pinterest on its own, with its picture, forever.

## The one hour that only you can do

None of the automation can sign in as you. These are the steps, in the order
that matters, with how long each takes. Tick them off once.

- [ ] **Google Search Console** (15 minutes). The single most important step;
      until it is done Google does not know the site exists. Exact steps in
      `../seo-plan.md`, section 1.
- [ ] **Bing Webmaster Tools** (5 minutes). Import from Search Console.
      `../seo-plan.md`, section 2.
- [ ] **Claim `theraglee` on Pinterest, Instagram, Facebook, LinkedIn, X,
      TikTok, YouTube and Reddit** (20 minutes). Put `https://theraglee.com`
      in every bio, upload `site/assets/logo.png` as the picture and
      `site/assets/social-card.png` as the banner. Pinterest matters most for
      this site: make it a *business* account.
- [ ] **Connect the feeds to a posting tool** (10 minutes). `auto-posting.md`.
      After this, new pages post themselves.
- [ ] **Tell Pinterest to pin the feeds** (5 minutes). Also in `auto-posting.md`.
- [ ] **Sign up to be quotable** (10 minutes). Connectively (formerly HARO),
      Qwoted and Featured send journalists' questions by email; answering one
      a week earns links from news sites. Template in `outreach.md`.

## The weekly fifteen minutes

Monday morning, with coffee:

1. Merge Tuesday's "Weekly growth" pull request (one click; its summary
   message tells you what is in it). Then open `social-posts.md`, copy the
   week's posts into your scheduling tool, or post one a day by hand from the
   summary message.
2. Send the week's ten outreach emails from `outreach.md` (counseling centers,
   libraries, school districts, EAPs). Keep the tracking table at the foot of
   that file.
3. Spend ten minutes in one community from `communities.md`: answer two
   questions fully, link once if a page truly answers it.
4. Glance at Search Console → Performance for any phrase in positions 8 to 20
   and note it for the weekly routine (reply to its summary with the phrase,
   and the next run writes the page).

## The files

| File | What it is |
|---|---|
| `auto-posting.md` | Connecting the RSS feeds to Pinterest, Buffer, Zapier, IFTTT or dlvr.it so new pages post themselves |
| `social-posts.md` | Four weeks of ready-to-post text for members and therapists, Pinterest pin copy, Instagram one-liners, and the rules |
| `outreach.md` | Email templates that earn links and listings, who gets which, and the tracking table |
| `communities.md` | Reddit, Facebook groups, LinkedIn and Quora: where to show up, what to say, what never to do |
| `press-kit.md` | The boilerplate, facts and files to send a journalist or podcast host |

## What the therapists do for you

Every live listing now shows the therapist a **License verified on Theraglee**
badge with the code to paste into their own website (`../therapist-pages.md`).
Each badge is a link from a therapist's site back to their Theraglee listing:
a hundred therapists is a hundred relevant links, which is the strongest
signal a search engine reads. Mention the badge in the welcome email to a
newly verified therapist and in any therapist newsletter.

## What is deliberately not done

- **No paid ads.** A new site should earn its first thousand visitors from
  search, shares and links so it knows which pages convert before paying for
  traffic. Revisit after Search Console shows a month of clicks.
- **No bought links, no directory-submission services, no link exchanges.**
  They get a site penalized.
- **No testimonials or member counts in copy** until there are real ones to
  quote with permission.
- **No posting on your behalf.** The routines write the words; a person
  presses post or connects the tool that does. That keeps every public
  account in your hands.
