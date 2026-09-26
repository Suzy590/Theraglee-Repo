# Playlists

The **Playlists** tab on the member dashboard (`dashboard.html#playlists`) is
a Premium feature. A member picks a genre, then a mood, and gets forty songs
curated for that pair. Every song is on both Apple Music and Spotify, and each
one links to a search for it on each service, so nothing about the member's
listening comes back to Theraglee. A **Copy the list** button puts the forty
songs on the clipboard to paste into a new playlist in either app.

| What | Where |
|---|---|
| The lists (genres, moods, songs) | `site/assets/playlists.js` |
| The tab itself | `site/assets/playlists-ui.js`, mounted from `site/dashboard.html` |
| Data check | `node tests/playlists-fixture/check.mjs` |
| Gate | Premium (level 3), through `lockNotice` in `site/assets/app.js` |

The last genre and mood picked are kept in the browser (`localStorage`, key
`tg.playlists`), so the tab reopens where the member left it. Nothing is
stored on the server.

Until 2026-09-26 the tab lived on the Goals & tracking page
(`goals.html#music`) and offered six moods, each opening a search on the two
services. That address now redirects to `dashboard.html#playlists`.

## The shape of the data

```js
GENRES     [{ key, name, blurb }]              six, in the order shown
MOODS      [{ key, name, blurb, wants }]       six, in the order shown
PLAYLISTS  { [genre.key]: { [mood.key]: { title, blurb, songs } } }
songs      [[title, artist], ...]              exactly forty
```

The genres are Pop, Rock, Hip-hop & R&B, Country, Indie & folk, and
Electronic & chill. The moods are the six the old tab used: Low and heavy,
Anxious, Flat or unmotivated, Angry, Restless, and Okay, keeping it there.

## Writing rules

- **Forty songs a list, none repeated within a genre.** A cover counts as a
  repeat (the check compares titles), so the same song does not turn up on
  two of one genre's lists. Across genres a song may appear twice.
- **Well-known releases only**, so both services carry them. No live-only
  cuts, no bootlegs, no remixes credited to the remixer alone, nothing that
  was ever pulled from streaming. Title and artist are written the way the
  services list them, so the search link lands.
- **A mood is a place to start from, never a diagnosis.** "Low and heavy" is
  music that keeps someone company, not music about being low, and the copy
  never tells the member how they should feel afterward.
- **"Angry" gives the feeling somewhere to go.** Loud is fine; nothing on it
  glorifies harm to anyone.
- **US spelling** everywhere, as in the rest of the repo.

## Adding or changing a list

1. Edit `site/assets/playlists.js`. To add a genre or a mood, add it to
   `GENRES` or `MOODS` and give every pair a list; the check fails on a
   missing one.
2. Run `node tests/playlists-fixture/check.mjs` and fix anything it flags.
3. Open the dashboard's Playlists tab and click through the new pair.
