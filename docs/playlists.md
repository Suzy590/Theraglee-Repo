# Playlists

The **Playlists** tab on the member dashboard (`dashboard.html#playlists`) is
a Premium feature. A member picks a genre, then a mood, and gets forty songs
curated for that pair, played right on the page in Spotify's embedded player
(a free Spotify account plays previews; a paid one plays it all), with an
**Open in Spotify** button to save it. Nothing about the member's listening
comes back to Theraglee.

Each list is a public playlist in Theraglee's own Spotify account, made by
`tools/spotify_playlists.mjs` (below). A list whose playlist has not been made
yet (its `spotify` field is `''`) falls back to a link per song, to search for
it on Spotify and Apple Music, and a **Copy the list** button.

| What | Where |
|---|---|
| The lists (genres, moods, songs, Spotify ids) | `site/assets/playlists.js` |
| The tab itself | `site/assets/playlists-ui.js`, mounted from `site/dashboard.html` |
| Making the Spotify playlists | `node tools/spotify_playlists.mjs` |
| Data check | `node tests/playlists-fixture/check.mjs` |
| Gate | Premium (level 3), through `lockNotice` in `site/assets/app.js` |

## Making the playlists on Spotify

Done once, and again only for a new or changed list. It needs a Spotify
account for Theraglee (a free one is fine) and a Spotify developer app, which
is free and takes two minutes:

1. Signed in to Theraglee's Spotify account, open
   [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
   and press **Create app**. Any name and description; for **Redirect URIs**
   enter exactly `http://127.0.0.1:8888/callback`; tick **Web API**; save.
2. Open the app's **Settings** and copy its **Client ID** (not the secret; the
   script never needs it).
3. From the repo root:

```bash
SPOTIFY_CLIENT_ID=<the Client ID> node tools/spotify_playlists.mjs auth
```

   It prints a link. Open it in the browser that is signed in to Theraglee's
   Spotify account and press **Agree**. The browser then lands on an address
   starting `http://127.0.0.1:8888/callback?code=` that will not load; that is
   expected. Copy that whole address and run:

```bash
node tools/spotify_playlists.mjs token "<the address>"
node tools/spotify_playlists.mjs build
node tests/playlists-fixture/check.mjs
```

`build` finds every song, makes a public playlist per list, named
`Theraglee · <genre> · <mood>`, adds the songs, and writes each playlist's id
into `site/assets/playlists.js`. Commit that file and the tab shows the
players. The sign-in is kept in `~/.theraglee-spotify.json`, outside the repo,
and renews itself, so later runs need only `build`.

`build` lists any song it could not find on Spotify. Swap that song in
`playlists.js` for one that is there, clear the list's `spotify` id, and run
`build pop/low` (the genre and mood keys) to remake just that list.
`verify` reads every playlist back and reports how many songs it holds.

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
PLAYLISTS  { [genre.key]: { [mood.key]: { title, blurb, spotify, songs } } }
spotify    the public playlist's id on Spotify, or '' until it is made
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
   `GENRES` or `MOODS` and give every pair a list with `spotify: ''`; the
   check fails on a missing one. Changing the songs of a list that already
   has a playlist does not change the playlist on Spotify: clear its
   `spotify` id and remake it (the old playlist stays in the account until
   it is deleted there).
2. Run `node tests/playlists-fixture/check.mjs` and fix anything it flags.
3. Run `node tools/spotify_playlists.mjs build <genre>/<mood>` for the new
   or remade pairs, then the check again.
4. Open the dashboard's Playlists tab and click through the new pair.
