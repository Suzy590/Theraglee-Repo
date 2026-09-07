using System;
using System.Collections.Generic;
using SkiaSharp;

namespace Pip;

public static partial class Draw
{
    static void CatMouth(SKCanvas c, PetLook l, float cx, float eyeY, Palette pal)
    {
        float my = eyeY - 9.5f;
        switch (l.Mouth)
        {
            case MouthMode.Smile:
            case MouthMode.Neutral:
            {
                float dip = l.Mouth == MouthMode.Smile ? 3.2f : 1.6f;
                using var p = new SKPath();
                p.MoveTo(cx - 5.5f, my + 1.6f);
                p.CubicTo(cx - 3.4f, my - dip, cx - 1.4f, my - dip, cx, my);
                p.CubicTo(cx + 1.4f, my - dip, cx + 3.4f, my - dip, cx + 5.5f, my + 1.6f);
                using var s = Stroke(pal.Ink, 2.2f, SKStrokeCap.Round);
                c.DrawPath(p, s);
                break;
            }
            case MouthMode.Open:
                using (var f = Fill(pal.Ink)) c.DrawOval(R(cx - 4.2f, my - 4.4f, 8.4f, 8.0f), f);
                using (var f = Fill(pal.Inner)) c.DrawOval(R(cx - 2.2f, my - 3.6f, 4.4f, 3.4f), f);
                break;
            case MouthMode.Snooze:
                using (var f = Fill(pal.Ink)) c.DrawOval(R(cx - 3.0f, my - 3.4f, 6.0f, 6.4f), f);
                break;
            case MouthMode.Yawn:
                using (var f = Fill(pal.Ink)) c.DrawOval(R(cx - 5.6f, my - 9.8f, 11.2f, 14.2f), f);
                using (var f = Fill(Tongue)) c.DrawOval(R(cx - 3.0f, my - 8.2f, 6.0f, 5.6f), f);
                break;
        }
    }

    static void DogMouth(SKCanvas c, PetLook l, float cx, float eyeY, Palette pal)
    {
        float mzY = eyeY - 11.5f;
        // muzzle patch
        using (var f = Fill(Palette.Blend(pal.Body, SKColors.White, 0.55f)))
            c.DrawOval(R(cx - 14, mzY - 8.5f, 28, 17), f);
        // nose, sat at the top of the muzzle
        using (var f = Fill(pal.Ink)) c.DrawOval(R(cx - 4.8f, mzY + 1.0f, 9.6f, 7.0f), f);

        float ny = mzY + 1.0f;
        switch (l.Mouth)
        {
            case MouthMode.Smile:
            case MouthMode.Neutral:
            {
                float dip = l.Mouth == MouthMode.Smile ? 3.0f : 1.5f;
                using var s = Stroke(pal.Ink, 2.0f, SKStrokeCap.Round);
                c.DrawLine(cx, ny, cx, ny - 3.2f, s);
                using var m = new SKPath();
                m.MoveTo(cx - 6.5f, ny - 1.8f);
                m.CubicTo(cx - 4.0f, ny - 3.2f - dip, cx - 1.6f, ny - 3.2f - dip * 0.3f, cx, ny - 3.2f);
                m.CubicTo(cx + 1.6f, ny - 3.2f - dip * 0.3f, cx + 4.0f, ny - 3.2f - dip, cx + 6.5f, ny - 1.8f);
                c.DrawPath(m, s);
                break;
            }
            case MouthMode.Open:
                using (var f = Fill(pal.Ink)) c.DrawOval(R(cx - 5.2f, mzY - 7.2f, 10.4f, 9.0f), f);
                // tongue, lolling out below the muzzle
                using (var f = Fill(Tongue)) c.DrawOval(R(cx - 3.4f, mzY - 11.0f, 6.8f, 7.5f), f);
                break;
            case MouthMode.Snooze:
                using (var f = Fill(pal.Ink)) c.DrawOval(R(cx - 3.0f, mzY - 5.0f, 6.0f, 6.0f), f);
                break;
            case MouthMode.Yawn:
                using (var f = Fill(pal.Ink)) c.DrawOval(R(cx - 6.0f, mzY - 10.8f, 12.0f, 13.8f), f);
                using (var f = Fill(Tongue)) c.DrawOval(R(cx - 3.2f, mzY - 9.2f, 6.4f, 5.8f), f);
                break;
        }
    }

    /// A miniature writing desk. Drawn in front, so the pet reads as sitting at it.
    static void Desk(SKCanvas c, float size)
    {
        float cx = size / 2;
        using (var f = Fill(WoodDark))
            foreach (float side in new[] { -1f, 1f })
                c.DrawRoundRect(R(cx + side * 40 - 3, GroundY - 2, 6, 23), 2, 2, f);

        var top = R(cx - 50, GroundY + 18, 100, 9);
        using (var s = Stroke(WoodDark, 3)) c.DrawRoundRect(top, 3.5f, 3.5f, s);
        using (var f = Fill(Wood)) c.DrawRoundRect(top, 3.5f, 3.5f, f);

        // a mug on the desk — the scene reads as "settled in" without needing a book
        float mx = cx + 32, my = GroundY + 27;
        using (var s = Stroke(new SKColor(89, 89, 89, 230), 2))
            c.DrawOval(R(mx + 3.5f, my + 2.5f, 7, 7), s);
        var mug = R(mx - 5.5f, my, 11, 12);
        using (var s = Stroke(new SKColor(77, 77, 77, 230), 2)) c.DrawRoundRect(mug, 2, 2, s);
        using (var f = Fill(new SKColor(245, 247, 252))) c.DrawRoundRect(mug, 2, 2, f);
        using (var f = Fill(new SKColor(140, 97, 66))) c.DrawRect(R(mx - 4, my + 8, 8, 2.6f), f);
    }

    /// An open book, tented on the desktop.
    static void Book(SKCanvas c, float size, float base_)
    {
        float cx = size / 2;
        var page = new SKColor(252, 250, 240);
        var edge = new SKColor(153, 107, 140);
        foreach (float side in new[] { -1f, 1f })
        {
            using var p = new SKPath();
            p.MoveTo(cx, base_ + 9);
            p.LineTo(cx + side * 21, base_ + 4);
            p.LineTo(cx + side * 19, base_ - 3);
            p.LineTo(cx, base_ + 1);
            p.Close();
            using (var s = Stroke(edge, 2.2f, SKStrokeCap.Butt, SKStrokeJoin.Round)) c.DrawPath(p, s);
            using (var f = Fill(page)) c.DrawPath(p, f);
            // a couple of lines of "text"
            using var ls = Stroke(new SKColor(158, 158, 158, 230), 1.0f);
            for (int k = 0; k < 2; k++)
            {
                float dy = k * 3.0f;
                c.DrawLine(cx + side * 5, base_ + 4.5f - dy, cx + side * 16, base_ + 2.0f - dy, ls);
            }
        }
    }

    /// A miniature glass of water, held out to one side.
    static void Glass(SKCanvas c, float size, float facing)
    {
        float cx = size / 2;
        float gx = cx + facing * 36, by = GroundY + 19;
        const float w = 15, h = 21;
        using var g = new SKPath();
        g.MoveTo(gx - w / 2, by + h);
        g.LineTo(gx - w / 2 + 2.4f, by);
        g.LineTo(gx + w / 2 - 2.4f, by);
        g.LineTo(gx + w / 2, by + h);
        g.Close();

        c.Save();
        c.ClipPath(g, SKClipOperation.Intersect, true);
        using (var f = Fill(new SKColor(115, 194, 245, 204)))
            c.DrawRect(R(gx - w, by, w * 2, h * 0.62f), f);
        c.Restore();

        using (var s = Stroke(new SKColor(82, 82, 82, 140), 2.4f)) c.DrawPath(g, s);
        using (var f = Fill(new SKColor(255, 255, 255, 166)))
            c.DrawRect(R(gx - w / 2 + 3.2f, by + 4, 2.0f, h * 0.5f), f);
    }

    /// The laser dot (cat) or the ball (dog).
    static void Toy(SKCanvas c, SKPoint pt, Species species)
    {
        if (species == Species.Cat)
        {
            foreach (var (r, a) in new[] { (10f, 0.14f), (6.2f, 0.30f), (3.2f, 1.0f) })
            {
                using var f = Fill(new SKColor(255, 41, 51, (byte)(a * 255)));
                c.DrawOval(R(pt.X - r, pt.Y - r, r * 2, r * 2), f);
            }
        }
        else
        {
            const float r = 9;
            var b = R(pt.X - r, pt.Y - r, r * 2, r * 2);
            using (var f = Fill(new SKColor(219, 79, 71))) c.DrawOval(b, f);
            using (var s = Stroke(new SKColor(153, 46, 41), 2.2f)) c.DrawOval(b, s);
            using (var f = Fill(new SKColor(255, 255, 255, 140)))
                c.DrawOval(R(pt.X - r * 0.5f, pt.Y + r * 0.05f, r * 0.6f, r * 0.45f), f);
        }
    }

    static readonly Dictionary<string, float> SignSizes = new();

    /// A little placard held up over the pet's head.
    static void Sign(SKCanvas c, string text, float bob, float size)
    {
        float fit = size - 46;
        string key = $"{text}|{(int)fit}";
        if (!SignSizes.TryGetValue(key, out float pt))
            SignSizes[key] = pt = FitSize(text, Bold, 15, 8, fit);

        using var tp = TextPaint(Bold, pt, new SKColor(51, 46, 56));
        float tw = TextWidth(text, tp), th = TextHeight(tp);
        float cx = size / 2;
        float w = tw + 22, h = th + 13;
        float y = GroundY + BodyH + 28 + bob * 1.6f;

        using (var s2 = Stroke(WoodDark, 4, SKStrokeCap.Round)) c.DrawLine(cx, y + 2, cx, y - 22, s2);

        var board = R(cx - w / 2, y, w, h);
        using (var s2 = Stroke(new SKColor(71, 71, 71), 3)) c.DrawRoundRect(board, 5, 5, s2);
        using (var f = Fill(new SKColor(255, 252, 242))) c.DrawRoundRect(board, 5, 5, f);
        TextUp(c, text, cx - tw / 2, y + 6.5f, tp);
    }

    static readonly Dictionary<string, float> ShoutSizes = new();

    /// A silent shout: no sound is ever played, you just see the word.
    static void Shout(SKCanvas c, string text, float age, float life, float size)
    {
        float grow = MathF.Min(1, age / 0.16f);
        float pop = MathF.Sin(MathF.Min(1, age / 0.34f) * MathF.PI) * 0.14f;
        float scale = 0.55f + 0.45f * grow + pop;
        float alpha = MathF.Min(1, age / 0.06f) * MathF.Min(1, MathF.Max(0, (life - age) / 0.40f));
        if (alpha <= 0.01f) return;

        string key = $"{text}|{(int)size}";
        if (!ShoutSizes.TryGetValue(key, out float pt))
            ShoutSizes[key] = pt = FitSize(text, Heavy, 16, 8, (size - 14) / 1.15f);

        byte a = (byte)(alpha * 255);
        using var fill = TextPaint(Heavy, pt, new SKColor(255, 92, 71, a));
        using var halo = TextHalo(Heavy, pt, new SKColor(255, 255, 255, a), pt * 0.07f);
        float tw = TextWidth(text, fill), th = TextHeight(fill);

        c.Save();
        c.Translate(size / 2, 146 + age * 4);
        c.RotateRadians(-0.05f + MathF.Sin(age * 8) * 0.045f);
        c.Scale(scale, scale);
        // A white casing under hot orange, the way the Mac build's negative
        // strokeWidth paints stroke-then-fill in one pass.
        TextUp(c, text, -tw / 2, -th / 2, halo);
        TextUp(c, text, -tw / 2, -th / 2, fill);
        c.Restore();
    }
}
