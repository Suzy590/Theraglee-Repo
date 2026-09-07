# Pip 🐾 — the downloadable desktop pet

A small companion that lives at the bottom of your screen, wanders about, dozes
off, and watches your cursor while you work. Pip is what Basic and Premium
members download from [/pet](https://theraglee.com/pet).

There are two builds of the same pet, and they behave identically:

| | Source | Runs on | Download size |
|---|---|---|---|
| **Mac** | [`mac/`](mac) — Swift + AppKit, one file | macOS 12+ | 568 KB |
| **Windows** | [`windows/`](windows) — C# + SkiaSharp + Win32 | Windows 10/11, 64-bit | 8.9 MB |

The Mac build came first. The Windows build is a port of it, not a
reimagining: the drawing code, the palettes, the behavior odds and the state
machine were transcribed from `mac/pet.swift` so the two look and act the same.
[`mac/README.md`](mac/README.md) is the guide to what Pip actually does, and it
describes both.

## Shipping a new version

The files members download live in `site/downloads/`, and Vercel publishes them
with the rest of the site.

**Mac.** On a Mac with the Xcode command line tools:

```
cd pet/mac && ./build.sh
cp Pip.app.zip ../../site/downloads/Pip-mac.zip
```

`build.sh` compiles for Apple Silicon *and* Intel and welds the two into one
universal binary, so a single `Pip.app` runs on every Mac from the last decade.
It prints `lipo -info` so you can see both slices went in.

**Windows.** From anywhere with the .NET 8 SDK — including a Mac or Linux
machine, no Windows needed:

```
cd pet/windows/Pip
dotnet publish -c Release -r win-x64 --self-contained true \
  -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true \
  -p:IncludeNativeLibrariesForSelfExtract=true -p:DebugType=none -o out
zip -9 ../../../site/downloads/Pip-windows.zip out/Pip.exe
```

That produces one self-contained `Pip.exe` — nobody needs to install .NET.

Then update the sizes quoted on `site/pet.html`, which are shown to members
before they click.

## Neither build is signed

Both are ad-hoc signed, so the first launch is met with a warning: Gatekeeper on
macOS ("cannot check it for malicious software"), SmartScreen on Windows
("Windows protected your PC"). Nothing is wrong with the app — the warning is
what an operating system says about a small program it has not seen before.
`site/pet.html` walks members through it in three steps on each platform.

Making the warnings go away entirely means paying for certificates: an Apple
Developer account (~$99/year) to notarize the Mac build, and a code-signing
certificate for the Windows one. Worth doing if downloads stall on that step.

## Checking a change without a Mac or a PC

`windows/RenderCheck` builds the pet's drawing and behavior for the machine
you're on, so both can be exercised without the real thing:

```
cd pet/windows/RenderCheck
dotnet run -- ./out          # contact sheets, share card, GIF, icon
dotnet run -- --sim 45       # 45 minutes of simulated desktop time
```

The contact sheets show every pose side by side, which is the quickest way to
see whether a drawing change did what you meant. `--sim` runs the behavior
engine headlessly and fails if the pet wanders off screen, sinks through the
floor, produces an unusable frame, piles up particles, or forgets a saved
choice.
