using System;
using System.Collections.Generic;
using SkiaSharp;

namespace Pip;

/// The shareable card and the looping somersault, ported from the macOS build.
/// Nothing here touches Windows, so the render-check harness can exercise it.
public static class ShareArt
{
    public const string Credit = "Theraglee.com";

    public static SKBitmap RenderCard(PetLook look, Palette pal, int size)
    {
        var bm = new SKBitmap(size, size, SKColorType.Bgra8888, SKAlphaType.Premul);
        using var c = new SKCanvas(bm);
        float S = size;

        var top = Palette.Blend(pal.Body, SKColors.White, 0.72f);
        var bot = Palette.Blend(pal.Body, pal.Shade, 0.30f);
        using (var g = new SKPaint { IsAntialias = true })
        {
            g.Shader = SKShader.CreateLinearGradient(
                new SKPoint(0, S), new SKPoint(0, 0),      // bottom → top
                new[] { bot, top }, new[] { 0f, 1f }, SKShaderTileMode.Clamp);
            c.DrawRect(SKRect.Create(0, 0, S, S), g);
        }

        // Frames carrying a shout or a sign need headroom; a plain portrait can
        // fill the card properly instead of floating in the bottom third.
        bool tall = look.ShoutText != null || look.Sign != null;
        float k = tall ? S / 200 : S / 145;
        c.Save();
        c.Translate(0, S);
        c.Scale(1, -1);                                    // AppKit space
        c.Translate(S / 2, S * (tall ? 0.20f : 0.28f));
        c.Scale(k, k);
        c.Translate(-Draw.Canvas / 2, -Draw.GroundY);
        Draw.PetInPlace(c, look, Draw.Canvas);
        c.Restore();

        var ink = new SKColor(61, 51, 51, 217);
        DrawCentered(c, Credit, S * 0.062f, SKFontStyleWeight.Black, ink, S, S * 0.085f);
        DrawCentered(c, "my little desk pet", S * 0.033f, SKFontStyleWeight.Medium,
                     ink.WithAlpha((byte)(217 * 0.55f)), S, S * 0.045f);
        return bm;
    }

#pragma warning disable CS0618
    static void DrawCentered(SKCanvas c, string text, float size, SKFontStyleWeight weight,
                             SKColor color, float S, float yFromBottom)
    {
        SKTypeface? tf = null;
        foreach (var n in new[] { "Segoe UI", "DejaVu Sans", "Liberation Sans", "Arial" })
        {
            tf = SKTypeface.FromFamilyName(n, weight, SKFontStyleWidth.Normal, SKFontStyleSlant.Upright);
            if (tf != null) break;
        }
        using var p = new SKPaint
        {
            IsAntialias = true, Color = color, Typeface = tf ?? SKTypeface.Default,
            TextSize = size, Style = SKPaintStyle.Fill,
        };
        float w = p.MeasureText(text);
        // y is measured up from the bottom of the card, AppKit style
        c.DrawText(text, (S - w) / 2, S - yFromBottom - p.FontMetrics.Descent, p);
    }
#pragma warning restore CS0618

    /// Frames of the somersault, built to loop seamlessly.
    public static List<PetLook> Frames(int count, Species species, Palette pal)
    {
        var o = new List<PetLook>(count);
        for (int i = 0; i < count; i++)
        {
            float prog = (float)i / count;
            var l = new PetLook(pal)
            {
                Species = species,
                Spin = -2 * MathF.PI * prog,
                Tuck = 1 - 0.14f * MathF.Sin(prog * MathF.PI),
                Lift = 95 * MathF.Sin(prog * MathF.PI),
                Eyes = EyeMode.Happy,
                Mouth = MouthMode.Open,
            };
            l.ShadowScale = MathF.Max(0.30f, 1 - l.Lift / 95);
            if (prog > 0.10f && prog < 0.96f)
            {
                l.ShoutText = "Theragleeeeee!!!";
                l.ShoutLife = 3.0f;
                l.ShoutAge = 0.08f + (prog - 0.10f) * 3.1f;
            }
            o.Add(l);
        }
        return o;
    }

    /// Raw BGRA bytes for each frame, which is what the GIF writer wants.
    public static List<byte[]> FrameBytes(int count, int size, Species species, Palette pal)
    {
        var o = new List<byte[]>(count);
        foreach (var look in Frames(count, species, pal))
        {
            using var bm = RenderCard(look, pal, size);
            o.Add(bm.Bytes);
        }
        return o;
    }
}
