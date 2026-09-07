# Pip 🐾

A little desktop pet — **a cat or a dog, your choice**. Pip lives in a
transparent, always-on-top window at the bottom of your screen, wanders around,
dozes off, and watches your cursor while you work.

## Running

Double-click **Pip.app**.

Pip has no Dock icon and no menu-bar icon — it's just the creature on your
screen. To put it away, right-click Pip and choose *Goodbye 🐾*. If you ever
can't reach it, `pkill -f Pip.app` from a terminal also works.

**One pet at a time.** Pip holds an exclusive lock while it runs, so a second
launch — a stray double-click, `open -n`, or the raw binary — quietly steps aside
rather than putting two creatures on your desktop. To swap animals, use the
menu: right-click → Animal → Cat or Dog.

### Start Pip automatically at login

System Settings → General → Login Items & Extensions → **+** under
"Open at Login" → choose `Pip.app`.

## Playing with Pip

| Do this | Pip does this |
| --- | --- |
| Left-click | Gets petted — happy eyes, hearts, a little bounce |
| Drag | Gets picked up. Let go and it falls, lands with a squash |
| Fling sideways | Sails a little before landing |
| Double-click | **Zoomies** — a sprint, a tucked somersault, and a silent "Theragleeeeee!!!" |
| Right-click | The full menu — see below |
| Move your cursor | Its eyes follow you |
| Leave it alone | Wanders, sits, does the occasional flip, eventually falls asleep (💤) |

## A day in the life

Left to itself, Pip works through a repertoire. Roughly two thirds of the time
it does the ordinary things — wandering, sitting, dozing. The rest of the time:

| It does this | Looks like |
| --- | --- |
| **Stretches** | Long and low, front paws forward, eyes shut |
| **Yawns** | Wide open, tongue out, eyes squeezed |
| **Grooms** | Lifts a paw to its face and works at it |
| **Gets curious** | Leans in, ears up, a `?` floating overhead |
| **Sits on your windows** | Finds the top edge of a real window, walks over, hops up, and perches there |
| **Jumps off** | Hops off the ledge and falls back to the floor with a squash |
| **Peeks round a corner** | Slinks to a screen edge, mostly off-screen, and leans back in at you |
| **Settles in at a desk** | A miniature writing desk appears, with a mug on it, and Pip sits down behind it |
| **Reads a book** | Separately: sits down and holds an open book up in both paws, eyes on the page |
| **Chases a toy** | The cat gets a laser dot, the dog gets a ball. It darts, they pounce |
| **Does something silly** | See below |

### Confidently ridiculous

Six of them, each with its own animation, each performed with total conviction:

- **Interpretive dance** — bobbing, leaning, one paw raised throughout
- **Moonwalk** — strolls backwards while facing proudly forwards
- **Dramatic faint** — keels over onto its side, `✕` for eyes
- **Downward dog** — a yoga pose, held with real commitment
- **Loaf** — tucks everything in and becomes bread
- **A bow** — deep, theatrical, one paw extended

Right-click → *Do something silly 🤪* if you can't wait for one.

### Chasing your cursor

Right-click → **Chase my cursor** and Pip follows it around the screen. To call
it off: click the pet, or pick *Stop chasing my cursor*. Any click stops it —
that was the point.

## Self-care mode

Right-click → **Self-care mode**. Every 25 minutes or so, when Pip isn't in the
middle of something, it will nudge you — alternating between:

- **Water** — walks over to wherever your cursor is, holds up a miniature glass
  and a sign reading **"Drink water"**
- **Stretch** — does the stretch itself, then holds up a sign reading
  **"Stretch"**

The setting is remembered. *Nudge me now* triggers one immediately if you'd
rather not wait.

## Sharing Pip

Right-click → **Share…**

- **Save photo (PNG)** — a 700×700 card of Pip exactly as it is right now
- **Save animation (GIF)** — a 30-frame looping somersault, about 700 KB

Both land on your Desktop and open in Finder, credited to **Theraglee.com** so
anyone who sees it knows where Pip came from. Nothing is uploaded anywhere —
posting it is entirely your call.

## The menu

```
Pet me!                     Color ▸
Do a flip! 🤸               Animal ▸
Take a nap                  Stay put
Do something silly 🤪
Chase the laser 🔴 / ball 🎾    Share… ▸
Sit at your desk 🪑
Read a book 📖
                            Goodbye 🐾
Chase my cursor
Self-care mode
Nudge me now
```

### Cat or dog

Right-click → **Animal** → *Cat 🐱* or *Dog 🐶*. One or the other — never both at
once. Switching is instant and remembered. The dog has floppy ears, a
muzzle and black nose, a perky wagging tail, and a tongue that lolls out when
it's excited. Everything else is shared: same walking, sitting, napping,
petting, dragging, falling, and the same zoomies-and-somersault.

Your choice is remembered, so Pip comes back as whichever animal you picked.

Four colors either way: Cream, **Matcha** (the default), Blueberry, Cocoa —
right-click → **Color**.

**Pip's color only ever changes when you change it.** Nothing it does recolors
it: not sleeping, not the zoomies, not switching between cat and dog. New pets
start **Matcha**, and after that Pip stays whatever you picked, across
relaunches — including if you pick Cream, which earlier versions would have
quietly discarded.

### Zoomies

Every so often — about one behavior change in fourteen, which in practice works
out to once every minute or two — Pip gets the zoomies: it picks whichever side
of the screen has more runway, sprints, launches into a tucked 360° somersault,
and hollers **"Theragleeeeee!!!"** — which is purely visual. Pip makes no sound
at all, ever; you just see the word. Double-click it, or use *Do a flip! 🤸*, to
set one off on demand.

The rotation is driven off elapsed time rather than accumulated per-frame
deltas, so Pip always comes back round to upright on touchdown no matter how the
frames fall.

**Stay put** stops the wandering if you'd rather it sat in one corner while you
work. You can still drag it wherever you like.

## Good neighbor behavior

- Clicking Pip **never steals focus** from your editor — it's a non-activating
  panel, so your cursor stays where it was.
- Follows you across Spaces and sits above full-screen apps.
- No Dock icon, no menu-bar clutter, no network access, no permissions
  requested. The only thing it writes anywhere is two preference keys
  (`pip.species`, `pip.palette`) so your choice of animal and color survives a
  relaunch.
- Repaints only as often as the moment deserves. The clock ticks at 24fps, but
  Pip only redraws every tick while you're holding it, mid-zoomies, or your
  cursor is moving (so the eyes keep up); every 2nd tick while walking (the
  window still slides every tick, so the glide stays smooth); every 3rd while
  just standing there; every 6th while asleep.
- The window is pinned to an 8-bit sRGB backing store. Left to itself AppKit
  hands it a half-float (EDR) one on a wide-gamut display; profiling showed
  compositing going through the `ARGB16F` path for artwork that is flat color
  anyway, and pinning sRGB moved it off that path.

### What it actually costs

Roughly **3.5–4.5% of one core** standing still, more while walking, on an
M-series Mac. Memory sits around 21 MB and doesn't grow.

Be careful measuring this. Pip's cost depends heavily on which behaviors happen
to fall inside your sampling window — asleep is 4fps, standing is 8fps, walking
is 12fps — so single samples of the live pet swing between about 4% and 8% with
no code change at all. The machine itself also drifts by ~1 point over a couple
of minutes. Anything smaller than that is unmeasurable this way.

To compare two builds, pin the behavior and interleave the runs: replace the
roll in `chooseNext()` with a constant so the pet holds one state, then run
A/B/A/B for 60s each. Two builds that differ only in a draw call should land
within ~0.05 points of each other, and if they don't, the difference is real.

## Building from source

Everything is in the single file `pet.swift` (no dependencies, no Xcode project).

```
swiftc -O pet.swift -o pet
```

Handy flags:

```
./pet                          # run it
./pet --color matcha           # start in a given color
./pet --species dog            # start as the dog (overrides the saved choice)
./pet --acts sheet.png [dog]          # contact sheet of the whole repertoire
./pet --card card.png [dog] [cocoa]   # a shareable Theraglee.com card
./pet --gif  loop.gif [dog] [cocoa]   # the looping somersault
./pet --snapshot sheet.png            # contact sheet of every pose (cat, Cream)
./pet --snapshot sheet.png dog        # ... the dog
./pet --snapshot sheet.png dog matcha # ... in a given color
./pet --icon 512 icon.png      # render the app icon artwork
```

`build.sh` does the whole thing — compiles, regenerates the icon from Pip's own
artwork, and rebuilds `Pip.app`.

### Making Pip your own

Sizes and shapes are constants near the top of `pet.swift` (`canvas`, `bodyW`,
`bodyH`). The `palettes` array holds the colors — add a fifth and it appears in
the right-click menu automatically. `drawPet` is where the creature is drawn,
and `chooseNext()` holds the odds of walking vs. sitting vs. napping.

Cat and dog share one body, one set of eyes, and every scrap of behavior. They
differ in exactly three places inside `drawPet` — the tail, the ears, and the
mouth — each an `if l.species == .dog { … } else { … }`. The `else` branches
hold the cat's original drawing code untouched, so adding a third animal means
adding a case in those same three spots and nothing else.

Note the dog's tail is carried high on purpose: the floppy ear covers x +12..+49
between y 10 and y 49, and a low tail disappears behind it.
