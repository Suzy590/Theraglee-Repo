# The goal library: common goals, twenty more a week

`site/assets/quest-goal-library.js` holds the goals people often want to work
on, in the words a member might type on the Goals & tracking page. It started
with a hundred on 2026-10-05 and grows by twenty every week. Three things come
out of it:

| Export | What it feeds |
|---|---|
| `GOAL_LIBRARY` | The **Browse common goals** list on the goal screen (grouped by theme, with a search box), and the test's list of sentences that must match |
| `LIBRARY_WORDS` | Words merged into the matcher's `WORDS` in `quest-goals.js`, so these goals and others put the same way are recognized |
| `LIBRARY_THEME_TAGS` | How strongly each tag points at a theme, added to the matcher's `THEME_TAGS` |
| `LIBRARY_SETS` | Milestone sets keyed by a word tag: a goal whose words carry the tag is offered that set instead of its theme's general one |

`docs/quest-map.md` explains the page and the matcher. Everything in the
library is **general wellness**: nothing names a condition, a symptom, a
treatment, a score or a streak, and `node tests/quest-paths/check.mjs` refuses
the words that would.

## A library entry

```js
{ text: 'Stop lying awake with my thoughts', theme: 'calm_evenings', set: 'sleep', week: '2026-10-05' },
```

- `text`: eight to seventy characters, the way a person would say it, no
  closing period. Varied in shape ("Stop …", "A calmer …", "Feel less …",
  "Make time for …"), never a number to hit.
- `theme`: one of the `VALUES` keys in `quest-paths.js` (calm_evenings,
  steady_routines, connection, energy, time_outdoors, self_kindness,
  creativity, focus, calm). The test checks `detectTheme(text)` lands there,
  so the words that make it land must be in `WORDS` or `LIBRARY_WORDS`.
- `set` (optional): a `LIBRARY_SETS` or `MILESTONE_SETS` key whose theme
  matches. The test checks `setFor(theme, text)` picks it, which means the
  text carries that tag's words more than any other set's.
- `week`: the Monday of the week it was added. The test counts goals per
  week: the first week is a hundred, every later week at least twenty.

## The weekly routine

A scheduled routine ("Theraglee weekly goal library", created 2026-10-04)
starts a fresh session every Monday at 13:41 UTC and adds twenty goals by
these steps, then merges them itself:

1. Read this file, `docs/quest-map.md`, `CLAUDE.md`, and every `text` in
   `GOAL_LIBRARY`, so the twenty are new ground (a goal the library already
   has under other words does not count) and match the voice.
2. Pick twenty goals people commonly want: everyday life, relationships,
   work, home, body, mind, making things. Spread them across themes rather
   than piling onto one. Favor goals a member might type that the matcher
   would currently miss; `detectTheme()` with `theme: null` or the wrong
   theme is the signal.
3. For each, add the words that make it match to `LIBRARY_WORDS` (under an
   existing tag where one fits, or a new tag with a weight in
   `LIBRARY_THEME_TAGS`). Prefer phrases ("lying awake") over single common
   words that would pull unrelated goals the wrong way, and check the
   examples and the whole library still match after each change.
4. If five or more of the twenty share a kind (a new job, a new baby,
   retirement, a move), write a `LIBRARY_SETS` set for it: five milestones a
   person could notice in real life (under sixty characters, no digits, in
   their voice), four stepping stones each from `ACTIONS`. Add stones to
   `quest-paths.js` when the library lacks them, with `values` naming the
   theme, following its writing rules; never change or remove a shipped
   action key. Never add a theme (that is a database change) and never
   change the value, category, minute or scene keys.
5. Append the twenty to `GOAL_LIBRARY` with `week` set to that Monday.
6. Run `node tests/quest-paths/check.mjs` until it passes, then render the
   browse list once in a browser if the page's look changed (the scratch
   preview in `docs/quest-map.md`).
7. Commit ("Add twenty goals to the goal library for the week of <Monday>",
   listing them), push a branch `claude/goal-library-<YYYY-MM-DD>`, open a
   pull request against the default branch, confirm its checks are green,
   and merge it. No database step: the library ships in `site/`.
8. Tell the owner, in plain words, the twenty goals and the merged pull
   request link, and that nothing is needed from them.
