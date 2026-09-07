using System;
using System.Collections.Generic;
using SkiaSharp;

namespace Pip;

/// A direct port of the macOS build's drawing code. Everything here works in
/// AppKit's coordinate space — origin bottom-left, y increasing upward — so the
/// geometry could be transcribed from `pet.swift` unchanged rather than
/// re-derived. `Pet()` installs the flip; nothing below it worries about it.
public static partial class Draw
{
    public const float Canvas  = 170;      // window / view is canvas × canvas
    public const float GroundY = 18;       // where the feet rest, in view coords
    public const float BodyW   = 66;
    public const float BodyH   = 58;

    static readonly SKColor Wood     = new(184, 135, 92);
    static readonly SKColor WoodDark = new(138, 94, 59);
    static readonly SKColor Tongue   = new(255, 128, 138);

    static SKRect R(float x, float y, float w, float h) => SKRect.Create(x, y, w, h);

    static SKPaint Fill(SKColor c) => new() { Color = c, IsAntialias = true, Style = SKPaintStyle.Fill };
    static SKPaint Stroke(SKColor c, float w, SKStrokeCap cap = SKStrokeCap.Butt,
                          SKStrokeJoin join = SKStrokeJoin.Miter)
        => new() { Color = c, IsAntialias = true, Style = SKPaintStyle.Stroke,
                   StrokeWidth = w, StrokeCap = cap, StrokeJoin = join };

    // ── fonts ────────────────────────────────────────────────────────────────
    // Segoe UI is the Windows system face; the fallbacks keep the render-check
    // harness (which runs on Linux) drawing the same shapes.
    static SKTypeface Face(SKFontStyleWeight weight)
    {
        foreach (var name in new[] { "Segoe UI", "DejaVu Sans", "Liberation Sans", "Arial" })
        {
            var t = SKTypeface.FromFamilyName(name, weight, SKFontStyleWidth.Normal, SKFontStyleSlant.Upright);
            if (t != null && t.FamilyName != null) return t;
        }
        return SKTypeface.Default;
    }
    static readonly SKTypeface Heavy = Face(SKFontStyleWeight.Black);
    static readonly SKTypeface Bold  = Face(SKFontStyleWeight.Bold);

    // SkiaSharp 2.88 only measures glyph spans through SKFont, so text goes
    // through SKPaint's (obsolete but complete) text API instead.
#pragma warning disable CS0618
    static SKPaint TextPaint(SKTypeface tf, float size, SKColor color)
        => new() { IsAntialias = true, Color = color, Typeface = tf, TextSize = size,
                   Style = SKPaintStyle.Fill, SubpixelText = true };

    static SKPaint TextHalo(SKTypeface tf, float size, SKColor color, float w)
        => new() { IsAntialias = true, Color = color, Typeface = tf, TextSize = size,
                   Style = SKPaintStyle.Stroke, StrokeWidth = w, StrokeJoin = SKStrokeJoin.Round,
                   StrokeCap = SKStrokeCap.Round, SubpixelText = true };

    /// Draw text the AppKit way inside our flipped space: `x,y` is the bottom-left
    /// of the line box, and the glyphs come out the right way up.
    static void TextUp(SKCanvas c, string s, float x, float y, SKPaint p)
    {
        c.Save();
        c.Translate(x, y);
        c.Scale(1, -1);
        c.DrawText(s, 0, -p.FontMetrics.Descent, p);   // AppKit's origin sits at the descender
        c.Restore();
    }
    static float TextWidth(string s, SKPaint p) => p.MeasureText(s);
    static float TextHeight(SKPaint p) { var m = p.FontMetrics; return m.Descent - m.Ascent; }

    /// Largest point size at or below `start` whose text fits `fit` wide.
    static float FitSize(string text, SKTypeface tf, float start, float min, float fit)
    {
        using var probe = TextPaint(tf, start, SKColors.Black);
        for (float pt = start; pt > min; pt -= 0.5f)
        {
            probe.TextSize = pt;
            if (probe.MeasureText(text) <= fit) return pt;
        }
        return min;
    }
#pragma warning restore CS0618

    // ── shapes ───────────────────────────────────────────────────────────────
    static SKPath BlobPath(float cx, float y0, float w, float h)
    {
        float bw = w / 2, tw = w * 0.41f;
        var p = new SKPath();
        p.MoveTo(cx, y0);
        p.CubicTo(cx + bw * 0.62f, y0, cx + bw, y0 + h * 0.10f, cx + bw, y0 + h * 0.36f);
        p.CubicTo(cx + bw, y0 + h * 0.80f, cx + tw, y0 + h, cx, y0 + h);
        p.CubicTo(cx - tw, y0 + h, cx - bw, y0 + h * 0.80f, cx - bw, y0 + h * 0.36f);
        p.CubicTo(cx - bw, y0 + h * 0.10f, cx - bw * 0.62f, y0, cx, y0);
        p.Close();
        return p;
    }

    static SKPath EarPath(float cx, float y0, float w, float h, float side, float tilt, float scale)
    {
        var baseIn  = new SKPoint(cx + side * w * 0.08f, y0 + h * 0.80f);
        var baseOut = new SKPoint(cx + side * w * 0.42f, y0 + h * 0.66f);
        var tip     = new SKPoint(cx + side * (w * 0.34f + tilt * 4), y0 + h * (1.12f + tilt * 0.03f));
        var mid = new SKPoint((baseIn.X + baseOut.X) / 2, (baseIn.Y + baseOut.Y) / 2);
        SKPoint S(SKPoint pt) => new(mid.X + (pt.X - mid.X) * scale, mid.Y + (pt.Y - mid.Y) * scale);
        SKPoint a = S(baseIn), b = S(tip), c = S(baseOut);
        var p = new SKPath();
        p.MoveTo(a);
        p.CubicTo(a.X, a.Y + (b.Y - a.Y) * 0.5f, b.X - side * 3, b.Y - (b.Y - a.Y) * 0.25f, b.X, b.Y);
        p.CubicTo(b.X + side * 3, b.Y - (b.Y - c.Y) * 0.25f, c.X + side * 2, c.Y + (b.Y - c.Y) * 0.45f, c.X, c.Y);
        p.Close();
        return p;
    }

    static SKPath HeartPath(SKPoint c, float s)
    {
        var p = new SKPath();
        p.MoveTo(c.X, c.Y - s * 0.52f);
        p.CubicTo(c.X - s * 0.34f, c.Y - s * 0.18f, c.X - s * 0.55f, c.Y - s * 0.06f, c.X - s * 0.55f, c.Y + s * 0.22f);
        p.CubicTo(c.X - s * 0.55f, c.Y + s * 0.54f, c.X - s * 0.16f, c.Y + s * 0.58f, c.X, c.Y + s * 0.46f);
        p.CubicTo(c.X + s * 0.16f, c.Y + s * 0.58f, c.X + s * 0.55f, c.Y + s * 0.54f, c.X + s * 0.55f, c.Y + s * 0.22f);
        p.CubicTo(c.X + s * 0.55f, c.Y - s * 0.06f, c.X + s * 0.34f, c.Y - s * 0.18f, c.X, c.Y - s * 0.52f);
        p.Close();
        return p;
    }

    // ── entry points ─────────────────────────────────────────────────────────
    /// Draw into a normal top-down canvas of `size` × `size`.
    public static void Pet(SKCanvas c, PetLook l, float size)
    {
        c.Save();
        c.Translate(0, size);
        c.Scale(1, -1);              // AppKit space from here down
        Body(c, l, size);
        c.Restore();
    }

    /// Draw into a canvas whose transform is already y-up, the way the macOS
    /// build's `drawPet` is called from inside the share-card renderer.
    public static void PetInPlace(SKCanvas c, PetLook l, float size) => Body(c, l, size);

    static void Body(SKCanvas c, PetLook l, float size)
    {
        var pal = l.Palette;
        float cx = size / 2;
        float breathe = 1 + l.Breath * 0.022f;
        float bob = l.IsWalking ? MathF.Abs(MathF.Sin(l.WalkPhase)) * 2.2f : 0;
        float sit = l.IsSitting ? 0.90f : 1.0f;

        // ── ground shadow (stays put while the body moves) ──
        float ss = l.ShowShadow ? MathF.Max(0.35f, l.ShadowScale) : 0;
        float sw = BodyW * 0.80f * ss, sh = 9 * ss;
        if (ss > 0)
        {
            using var p = Fill(new SKColor(0, 0, 0, (byte)(0.13f * ss * 255)));
            c.DrawOval(R(cx - sw / 2, GroundY - sh / 2 - 1, sw, sh), p);
        }

        c.Save();
        c.Translate(0, l.Lift + bob);
        if (l.Spin != 0 || l.Tuck != 1)
        {
            // Spin about the middle of the body, not the feet, or the somersault
            // reads as the pet being swung around on a stick.
            float pivot = GroundY + BodyH * 0.45f;
            c.Translate(cx, pivot);
            c.RotateRadians(l.Spin);
            c.Scale(l.Tuck, l.Tuck);
            c.Translate(-cx, -pivot);
        }
        if (l.Lean != 0)
        {
            c.Translate(cx, GroundY);
            c.RotateRadians(l.Lean);
            c.Translate(-cx, -GroundY);
        }
        c.Translate(cx, GroundY);
        c.Scale(l.SquashX * l.Facing, l.SquashY * breathe * sit);
        c.Translate(-cx, -GroundY);

        var outline = pal.Shade;

        // ── tail (behind everything) ──
        float sway = l.TailSway;
        using (var tail = new SKPath())
        {
            if (l.Species == Species.Dog)
            {
                // Carried high and perky — a low tail would be swallowed by the
                // floppy ear, which covers x +12..+49 between y 10 and y 49.
                tail.MoveTo(cx + BodyW * 0.22f, GroundY + BodyH * 0.34f);
                tail.CubicTo(cx + BodyW * 0.52f, GroundY + BodyH * 0.40f,
                             cx + BodyW * (0.70f + sway * 0.07f), GroundY + BodyH * 0.72f,
                             cx + BodyW * (0.58f + sway * 0.08f), GroundY + BodyH * (0.94f + sway * 0.03f));
                using (var s1 = Stroke(outline, 14, SKStrokeCap.Round)) c.DrawPath(tail, s1);
                using (var s2 = Stroke(pal.Body, 10.5f, SKStrokeCap.Round)) c.DrawPath(tail, s2);
            }
            else
            {
                tail.MoveTo(cx + BodyW * 0.30f, GroundY + BodyH * 0.16f);
                tail.CubicTo(cx + BodyW * 0.58f, GroundY + BodyH * 0.08f,
                             cx + BodyW * (0.74f + sway * 0.04f), GroundY + BodyH * 0.26f,
                             cx + BodyW * 0.68f + sway * 3, GroundY + BodyH * (0.56f + sway * 0.05f));
                using (var s1 = Stroke(outline, 11, SKStrokeCap.Round)) c.DrawPath(tail, s1);
                using (var s2 = Stroke(pal.Body, 8, SKStrokeCap.Round)) c.DrawPath(tail, s2);
            }
        }

        // ── ears (behind the body so only the tips show) ──
        if (l.Species == Species.Dog)
        {
            // Floppy ears, splayed outward from behind the head so they droop past
            // the cheeks. A touch darker than the body, the way a lot of dogs are.
            var earFill = Palette.Blend(pal.Body, pal.Shade, 0.42f);
            foreach (float side in new[] { -1f, 1f })
            {
                c.Save();
                c.Translate(cx + side * BodyW * 0.34f, GroundY + BodyH * 0.84f);
                c.RotateRadians(side * (0.40f + l.EarTilt * 0.10f));
                float ew = BodyW * 0.30f, eh = BodyH * 0.72f;
                var e = R(-ew / 2, -eh, ew, eh);
                using (var s = Stroke(outline, 5)) c.DrawOval(e, s);
                using (var f = Fill(earFill)) c.DrawOval(e, f);
                c.Restore();
            }
        }
        else
        {
            foreach (float side in new[] { -1f, 1f })
            {
                using var e = EarPath(cx, GroundY, BodyW, BodyH, side, l.EarTilt * side, 1);
                using (var s = Stroke(outline, 5, SKStrokeCap.Butt, SKStrokeJoin.Round)) c.DrawPath(e, s);
                using (var f = Fill(pal.Body)) c.DrawPath(e, f);
                using var inner = EarPath(cx, GroundY, BodyW, BodyH, side, l.EarTilt * side, 0.52f);
                using (var f = Fill(pal.Inner)) c.DrawPath(inner, f);
            }
        }

        // ── body ──
        using (var body = BlobPath(cx, GroundY, BodyW, BodyH))
        {
            using (var s = Stroke(outline, 4.5f)) c.DrawPath(body, s);
            using (var f = Fill(pal.Body)) c.DrawPath(body, f);

            // soft highlight for volume
            c.Save();
            c.ClipPath(body, SKClipOperation.Intersect, true);
            var gr = R(cx - BodyW * 0.56f, GroundY + BodyH * 0.34f, BodyW * 0.74f, BodyH * 0.66f);
            using (var glow = new SKPaint { IsAntialias = true })
            {
                var mid = new SKPoint(gr.MidX, gr.MidY);
                float rad = MathF.Max(gr.Width, gr.Height) / 2;
                var lm = SKMatrix.CreateScale(gr.Width / (rad * 2), gr.Height / (rad * 2), mid.X, mid.Y);
                glow.Shader = SKShader.CreateRadialGradient(mid, rad,
                    new[] { new SKColor(255, 255, 255, 87), new SKColor(255, 255, 255, 0) },
                    new[] { 0f, 1f }, SKShaderTileMode.Clamp, lm);
                c.DrawRect(gr, glow);
            }
            c.Restore();
        }

        // ── feet ──
        float footLift = l.IsWalking ? MathF.Sin(l.WalkPhase) * 3 : 0;
        float spread = BodyW * ((l.IsSitting ? 0.26f : 0.21f) + l.StretchAmt * 0.13f);
        for (int i = 0; i < 2; i++)
        {
            float side = i == 0 ? -1f : 1f;
            float lift = l.IsWalking ? (i == 0 ? MathF.Max(0, footLift) : MathF.Max(0, -footLift)) : 0;
            float fx = cx + side * spread + (l.IsWalking ? lift * side * 0.6f : 0) + l.StretchAmt * 11;
            // The raised paw is drawn later, in front of the face — a paw tucked
            // behind the eyes reads as a mistake rather than as grooming.
            if (side > 0 && l.PawUp > 0.05f) continue;
            var r = R(fx - 8, GroundY - 3.5f + lift, 16, 9);
            using (var s = Stroke(outline, 3.5f)) c.DrawOval(r, s);
            using (var f = Fill(pal.Body)) c.DrawOval(r, f);
        }

        // ── face ──
        float eyeY = GroundY + BodyH * 0.55f;
        float eyeDX = BodyW * 0.185f;

        foreach (float side in new[] { -1f, 1f })
        {
            float ex = cx + side * eyeDX;
            switch (l.Eyes)
            {
                case EyeMode.Open:
                case EyeMode.Wide:
                {
                    float ew = l.Eyes == EyeMode.Wide ? 10.5f : 9.5f;
                    float eh = l.Eyes == EyeMode.Wide ? 13.0f : 11.5f;
                    using (var f = Fill(pal.Ink))
                        c.DrawOval(R(ex - ew / 2 + l.Pupil.X, eyeY - eh / 2 + l.Pupil.Y, ew, eh), f);
                    using (var f = Fill(new SKColor(255, 255, 255, 242)))
                        c.DrawOval(R(ex - ew / 2 + l.Pupil.X + ew * 0.18f, eyeY + l.Pupil.Y + eh * 0.10f, 3.4f, 3.4f), f);
                    break;
                }
                case EyeMode.Blink:
                case EyeMode.Sleepy:
                {
                    using var p = new SKPath();
                    p.MoveTo(ex - 5.2f, eyeY + 1.4f);
                    p.CubicTo(ex - 2.4f, eyeY - 3.0f, ex + 2.4f, eyeY - 3.0f, ex + 5.2f, eyeY + 1.4f);
                    using var s = Stroke(pal.Ink, 2.6f, SKStrokeCap.Round);
                    c.DrawPath(p, s);
                    break;
                }
                case EyeMode.Dizzy:
                {
                    const float r = 4.6f;
                    using var s = Stroke(pal.Ink, 2.6f, SKStrokeCap.Round);
                    c.DrawLine(ex - r, eyeY - r, ex + r, eyeY + r, s);
                    c.DrawLine(ex - r, eyeY + r, ex + r, eyeY - r, s);
                    break;
                }
                case EyeMode.Happy:
                {
                    using var p = new SKPath();
                    p.MoveTo(ex - 5.2f, eyeY - 1.8f);
                    p.CubicTo(ex - 2.4f, eyeY + 4.2f, ex + 2.4f, eyeY + 4.2f, ex + 5.2f, eyeY - 1.8f);
                    using var s = Stroke(pal.Ink, 2.8f, SKStrokeCap.Round);
                    c.DrawPath(p, s);
                    break;
                }
            }
        }

        // cheeks
        using (var f = Fill(pal.Cheek))
            foreach (float side in new[] { -1f, 1f })
                c.DrawOval(R(cx + side * BodyW * 0.33f - 6, eyeY - 12, 12, 7.5f), f);

        // mouth
        if (l.Species == Species.Dog) DogMouth(c, l, cx, eyeY, pal);
        else                          CatMouth(c, l, cx, eyeY, pal);

        // ── the raised paw, over the face: grooming, waving, holding a glass up ──
        if (l.PawUp > 0.05f)
        {
            float py = GroundY - 3.5f + l.PawUp * 20;
            float px = (cx + spread) + ((cx + 11) - (cx + spread)) * l.PawUp * 0.8f;
            var paw = R(px - 8, py, 16, 9.5f);
            using (var s = Stroke(outline, 3.5f)) c.DrawOval(paw, s);
            using (var f = Fill(pal.Body)) c.DrawOval(paw, f);
        }

        c.Restore();

        // ── furniture and hand-props, in front of the pet ──
        if (l.Props.HasFlag(Props.Desk)) Desk(c, size);
        // on the desktop if there's a desk under it, otherwise held up in both paws
        if (l.Props.HasFlag(Props.Book)) Book(c, size, l.Props.HasFlag(Props.Desk) ? GroundY + 26 : GroundY + 17);
        if (l.Props.HasFlag(Props.Glass)) Glass(c, size, l.Facing);
        if (l.Toy is SKPoint toy) Toy(c, toy, l.Species);

        // ── particles (drawn in view space, unaffected by squash) ──
        foreach (var p in l.Particles)
        {
            float a = MathF.Min(1, p.Life / (p.MaxLife * 0.55f));
            switch (p.Kind)
            {
                case ParticleKind.Heart:
                    using (var f = Fill(new SKColor(255, 107, 122, (byte)(a * 0.95f * 255))))
                    using (var hp = HeartPath(new SKPoint(p.X, p.Y), p.Size))
                        c.DrawPath(hp, f);
                    break;
                case ParticleKind.Glyph:
                    using (var f = TextPaint(Heavy, p.Size, pal.Ink.WithAlpha((byte)(a * 0.80f * 255))))
                        TextUp(c, p.Text ?? "", p.X, p.Y, f);
                    break;
                case ParticleKind.Zzz:
                    using (var f = TextPaint(Heavy, p.Size, pal.Ink.WithAlpha((byte)(a * 0.75f * 255))))
                        TextUp(c, "z", p.X, p.Y, f);
                    break;
            }
        }

        if (l.Sign != null) Sign(c, l.Sign, l.SignBob, size);
        if (l.ShoutText != null) Shout(c, l.ShoutText, l.ShoutAge, l.ShoutLife, size);
    }
}
