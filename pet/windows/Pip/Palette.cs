using SkiaSharp;

namespace Pip;

/// The five colors a pet is made of. Ported verbatim from the macOS build's
/// `palettes` array — the sRGB values must match or the two look like different pets.
public sealed class Palette
{
    public string Name { get; }
    public SKColor Body { get; }
    public SKColor Shade { get; }
    public SKColor Inner { get; }
    public SKColor Cheek { get; }
    public SKColor Ink { get; }

    public Palette(string name, SKColor body, SKColor shade, SKColor inner, SKColor cheek, SKColor ink)
    { Name = name; Body = body; Shade = shade; Inner = inner; Cheek = cheek; Ink = ink; }

    /// What a pet is before anyone picks anything. Cat and dog both start here.
    public const int DefaultIndex = 1;        // Matcha

    public static readonly Palette[] All =
    {
        new("Cream",
            new SKColor(252, 219, 181), new SKColor(224, 173, 125),
            new SKColor(255, 186, 173), new SKColor(252, 135, 130, 115),
            new SKColor(69, 48, 41)),
        new("Matcha",
            new SKColor(201, 230, 184), new SKColor(148, 191, 133),
            new SKColor(252, 204, 191), new SKColor(242, 138, 130, 102),
            new SKColor(43, 69, 48)),
        new("Blueberry",
            new SKColor(191, 209, 250), new SKColor(140, 166, 230),
            new SKColor(240, 207, 245), new SKColor(204, 133, 219, 102),
            new SKColor(41, 48, 89)),
        new("Cocoa",
            new SKColor(166, 125, 99), new SKColor(120, 87, 66),
            new SKColor(242, 186, 171), new SKColor(252, 148, 135, 89),
            new SKColor(38, 26, 20)),
    };

    /// AppKit's `blended(withFraction:of:)` — self * (1-f) + other * f.
    public static SKColor Blend(SKColor a, SKColor b, float f)
        => new((byte)(a.Red   + (b.Red   - a.Red)   * f),
               (byte)(a.Green + (b.Green - a.Green) * f),
               (byte)(a.Blue  + (b.Blue  - a.Blue)  * f),
               a.Alpha);
}
