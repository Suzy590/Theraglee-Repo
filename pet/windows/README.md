# Pip for Windows

A port of the macOS pet in `../mac/pet.swift`. Same artwork, same behavior, same
odds — transcribed rather than rewritten, so the two stay recognizably one pet.

## How it is put together

| File | What it holds |
|---|---|
| `Pip/Palette.cs` | The four palettes, as the exact sRGB values the Mac build uses |
| `Pip/Model.cs` | `PetLook` — everything one frame needs, and nothing about how to draw it |
| `Pip/Draw.cs`, `Draw.Props.cs` | The drawing, in SkiaSharp |
| `Pip/Brain.cs` | The state machine: what Pip does and how often |
| `Pip/Stage.cs` | The single seam between the pet and the operating system |
| `Pip/PetWindow.cs` | The Win32 layered window, input, and the right-click menu |
| `Pip/Gif.cs` | An animated-GIF writer (Windows has no built-in one) |
| `Pip/ShareArt.cs` | The shareable card and the looping somersault |
| `RenderCheck/` | Renders and simulates all of the above on any platform |

Two decisions are worth knowing about:

**Coordinates.** AppKit puts the origin at the bottom-left with y increasing
upward; Windows counts down from the top-left. Rather than re-derive several
hundred coordinates, the drawing installs a flip and the behavior works in the
Mac's units throughout. Every conversion lives in `PetWindow.cs` — if something
is upside-down or off by a screen height, it is in that file.

**No WinForms.** WinForms cannot be trimmed, and bundling it made a 77 MB
download for what is one layered rectangle and a popup menu. Plain Win32 through
P/Invoke brings that to a single 14 MB `.exe` with no runtime to install.

## Building

Needs the .NET 8 SDK. Works from Windows, macOS or Linux.

```
dotnet publish -c Release -r win-x64 --self-contained true \
  -p:PublishSingleFile=true -p:EnableCompressionInSingleFile=true \
  -p:IncludeNativeLibrariesForSelfExtract=true -p:DebugType=none -o out
```

`Pip.ico` is checked in; regenerate it from Pip's own artwork with
`RenderCheck` if the drawing ever changes.

## Checking it

```
cd RenderCheck
dotnet run -- ./out      # contact sheets per species and palette, card, GIF, icon
dotnet run -- --sim 45   # 45 minutes of simulated desktop time, with assertions
```

`--sim` drives the real `Brain` against a fake screen and fails on a pet that
walks off the display, falls through the floor, emits a non-finite number into a
frame, accumulates particles, or loses a saved animal or color. It knows that
"peek round a corner" deliberately goes off-screen and allows exactly that much.

## What is not ported

The Mac build's `--acts`, `--snapshot` and `--card` command line flags are
development tools; `RenderCheck` covers the same ground. `--species` and
`--color` work as they do on the Mac.
