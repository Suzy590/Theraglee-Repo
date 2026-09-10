# Articles — free for everyone, five new ones a day

Articles are the reading half of Theraglee's open front door (the discovery
tools are the other half). **Every article is free to anyone, registered or
not.** A signed-in member can also favorite an article, save it for later, and
mark it read, and those show up on the dashboard and under the library's member
views like every other activity.

## How access works

| Piece | Where | How |
|---|---|---|
| Reading | `articles` table, `site/article.html`, `site/articles.html` | Reads are gated by `min_level <= user_level()`, a visitor is level 0, and every article is `min_level = 0`. The check constraint `articles_free` (`supabase/migrations/20260909030000_articles_free.sql`) refuses any other value, so an article cannot be published behind a tier by accident. |
| Favorite | `favorites` with `list = 'favorite'`, `item_type = 'article'` | RLS `own rows`; any registered member |
| Save for later | `favorites` with `list = 'later'` | same |
| Mark as read | `item_progress (answered 1, total 1)` → `status = 'completed'` | same |
| Signed-out visitor | the favorite and save buttons open the free sign-up page (`login.html?mode=signup&why=save&next=…`) and return to the article afterward | `signupHref()` in `site/assets/library.js` |
| Morning email | `digest_article()` picks an article the member has not been sent | every article is level 0, so every article is eligible |

`site/articles.html` reads the `articles` table directly (not the level-gated
`content_catalog` view), newest first, with a search box, one chip per tag in
use, and, for members, Favorites / Saved for later / Read / Not read yet.

## Where an article lives

The rows live in the database, and the repo copy is `data/articles.json`. The
two are kept in step the same way as worksheets and quizzes: edit the JSON,
run the check, generate the SQL, apply it, regenerate `documents/`.

```bash
node tests/articles-fixture/check.mjs                 # data checks
python3 tools/articles_sql.py --since 2026-09-10      # SQL for a day's articles (an upsert on slug)
python3 tools/articles_sql.py slug-a slug-b           # or by slug
python3 tools/build_documents.py                      # the print-ready copies in documents/
```

The generated SQL goes in a migration named
`supabase/migrations/<YYYYMMDDHHMMSS>_articles_<YYYY_MM_DD>.sql` and is applied
to the project (`oekqzuguruyqkafsqhos`) with the Supabase CLI or the Supabase
MCP `apply_migration` tool. It is an upsert on `slug`, so applying it twice is
harmless and an edited article keeps its id and every member's favorites and
read marks.

## The daily routine

A scheduled routine ("Theraglee daily articles", created 2026-09-09) starts a
fresh session every day at 14:00 UTC (10 am Eastern) through **January 31,
2027**, and each session publishes five new articles by the steps above. A
one-shot reminder fires on January 31, 2027 asking what to do with articles
after that. Both are listed under Routines in Claude Code; the daily one stops
itself after its last day.

Each day's session:

1. Reads this file, `CLAUDE.md` and the last few articles in `data/articles.json`
   (for voice, and to avoid repeating a topic).
2. Writes five new articles and appends them to `data/articles.json` with
   today's date at 14:00:00+00:00 as `published_at`.
3. Runs `node tests/articles-fixture/check.mjs` and fixes anything it flags.
4. Generates the day's migration with `tools/articles_sql.py --since <today>`
   and applies it to the database.
5. Confirms with a query that the five rows are in `articles` at `min_level 0`.
6. Runs `python3 tools/build_documents.py` and bumps the article counts in
   `README.md` and `docs/site.md`.
7. Commits everything to the branch the session was given (every routine
   session gets its own `claude/...` branch, started fresh from the default
   branch), pushes it, and opens one draft pull request titled
   `Daily articles for <YYYY-MM-DD>`. So each day is its own small pull
   request to review and merge; nothing is shared between days.

If a day is missed the next day does not double up; the site simply gets five
that day.

### Getting the SQL into the database

The session that writes the articles applies the SQL itself when it has a
working Supabase connector. The routine carries that connector, but it only
works while the connector is signed in on the claude.ai account, so there are
two ways to make the daily run hands-off. Either one is enough; both together
are fine.

1. **Keep the Supabase connector signed in.** In claude.ai, under Settings
   → Connectors, make sure Supabase is connected (reconnect it if it asks).
   Then each session applies its own SQL and confirms the rows.
2. **Let GitHub apply it.** `.github/workflows/apply-article-migrations.yml`
   runs on every push to a `claude/...` branch that adds or changes an
   `*_articles_*.sql` file and applies those files with `psql`. It needs one
   repository secret, `SUPABASE_DB_URL`: the project's Postgres connection
   string (Supabase dashboard → Connect → Session pooler URI, with the
   database password filled in), added under Settings → Secrets and
   variables → Actions. Until the secret is set the workflow says so and
   does nothing. It can also be run by hand from the Actions tab with "all"
   checked, which applies every article file (they are upserts on slug, so
   this is safe).

When neither is in place, a day's articles are still written, checked,
committed and pushed; only the database step waits. The daily session says in
its pull request comment whether the rows reached the database, and
`python3 tools/articles_sql.py --since <date>` regenerates the SQL for any
span of days to paste into the Supabase SQL editor.

## Writing an article

The check enforces the shape; this is the intent behind it.

- **Plain language, second person, warm and direct.** Short sentences. No
  jargon without a one-line explanation. The reader is smart and tired.
- **600 to 1300 words**, in sections. A heading is a short line (under 90
  characters) with no closing punctuation, on its own between blank lines; both
  `article.html` and the print build turn those into headings. Everything else
  is a paragraph. Blank lines between paragraphs, never single line breaks, no
  Markdown marks, no HTML.
- **The excerpt is a written summary** of 15 to 45 words, not the first lines
  of the body. It is the description on the tile and in the morning email.
- **Title under 70 characters**, no trailing period, no clickbait numbers
  unless the article really is a list.
- **One to three tags** from the fixed vocabulary in
  `tests/articles-fixture/check.mjs` (the same list the worksheets use). Spread
  a day's five across different tags.
- **No invented evidence.** No "a 2023 study found", no percentages, no
  "science-backed". Say how something works and why it tends to help; that is
  more honest and reads better.
- **Never about the reader's diagnosis.** No "you may have a disorder", no
  labels for people, nothing that reads as screening. The page carries the
  "not medical advice" notice, so the article does not repeat it.
- **The closing paragraph points to a professional** for when things are
  heavier than an article can help with. Articles tagged Grief, Loss, Trauma,
  Panic or Depression end with the exact sentence
  `In the US you can call or text 988 at any time.`
- **US English** (`CLAUDE.md` has the table). The check catches the common
  ones, including "towards", "whilst" and "amongst".
- **Vary the topics day to day.** Look at the last twenty or so before choosing.
  Good ground: anxiety and worry, sleep, stress and burnout, boundaries and
  communication, self-esteem and the inner critic, habits and motivation, grief
  and change, relationships and loneliness, anger, focus, emotions, values and
  meaning, work and school, parenting and caregiving, the body and movement,
  mindfulness and grounding, how therapy works.
