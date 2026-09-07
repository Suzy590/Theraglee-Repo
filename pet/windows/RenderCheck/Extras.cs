using System;
using System.Collections.Generic;
using System.IO;
using SkiaSharp;
using Pip;

/// The icon artwork and the shareable card/GIF, rendered here so they can be
/// checked without a Windows machine. Ported from `renderIcon` / `renderShareCard`.
public static class Extras
{
    public static SKBitmap Icon(int size, int paletteIndex)
    {
        var bm = new SKBitmap(size, size, SKColorType.Bgra8888, SKAlphaType.Premul);
        using var c = new SKCanvas(bm);
        c.Clear(SKColors.Transparent);
        float S = size, k = S / 122f;
        c.Save();
        c.Translate(0, S);
        c.Scale(1, -1);                                  // AppKit space
        c.Translate(S / 2, S / 2);
        c.Scale(k, k);
        c.Translate(-(Draw.Canvas / 2 + 4), -(Draw.GroundY + 40));
        var l = new PetLook(Palette.All[paletteIndex]) { ShowShadow = false, Mouth = MouthMode.Smile };
        Draw.PetInPlace(c, l, Draw.Canvas);
        c.Restore();
        return bm;
    }

    /// A Windows .ico holding every size the shell asks for, each as a PNG.
    public static void WriteIco(string path, int paletteIndex, int[] sizes)
    {
        using var fs = File.Create(path);
        using var w = new BinaryWriter(fs);
        w.Write((short)0); w.Write((short)1); w.Write((short)sizes.Length);
        var blobs = new List<byte[]>();
        foreach (int s in sizes)
        {
            using var bm = Icon(s, paletteIndex);
            using var img = SKImage.FromBitmap(bm);
            using var d = img.Encode(SKEncodedImageFormat.Png, 100);
            blobs.Add(d.ToArray());
        }
        int offset = 6 + 16 * sizes.Length;
        for (int i = 0; i < sizes.Length; i++)
        {
            w.Write((byte)(sizes[i] >= 256 ? 0 : sizes[i]));
            w.Write((byte)(sizes[i] >= 256 ? 0 : sizes[i]));
            w.Write((byte)0); w.Write((byte)0);
            w.Write((short)1); w.Write((short)32);
            w.Write(blobs[i].Length);
            w.Write(offset);
            offset += blobs[i].Length;
        }
        foreach (var b in blobs) w.Write(b);
    }

    /// A transparent portrait for the website, drawn by the same code as the app.
    public static void Portrait(string path, Species sp, int paletteIndex, int size)
    {
        var bm = new SKBitmap(size, size, SKColorType.Bgra8888, SKAlphaType.Premul);
        using (var c = new SKCanvas(bm))
        {
            c.Clear(SKColors.Transparent);
            c.Scale(size / Draw.Canvas, size / Draw.Canvas);
            var l = new PetLook(Palette.All[paletteIndex])
            { Species = sp, Eyes = EyeMode.Happy, Mouth = MouthMode.Open, ShowShadow = false };
            Draw.Pet(c, l, Draw.Canvas);
        }
        // Trim to what was actually drawn — the 170-unit canvas leaves the pet
        // sitting in its bottom third, which reads as a layout bug on a web page.
        int x0 = size, y0 = size, x1 = -1, y1 = -1;
        for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
                if (bm.GetPixel(x, y).Alpha > 8)
                {
                    if (x < x0) x0 = x; if (x > x1) x1 = x;
                    if (y < y0) y0 = y; if (y > y1) y1 = y;
                }
        int pad = Math.Max(2, size / 60);
        x0 = Math.Max(0, x0 - pad); y0 = Math.Max(0, y0 - pad);
        x1 = Math.Min(size - 1, x1 + pad); y1 = Math.Min(size - 1, y1 + pad);

        using var cropped = new SKBitmap(x1 - x0 + 1, y1 - y0 + 1, SKColorType.Bgra8888, SKAlphaType.Premul);
        using (var cc = new SKCanvas(cropped))
        {
            cc.Clear(SKColors.Transparent);
            cc.DrawBitmap(bm, -x0, -y0);
        }
        using var img = SKImage.FromBitmap(cropped);
        using var d = img.Encode(SKEncodedImageFormat.Png, 100);
        using var f = File.OpenWrite(path);
        d.SaveTo(f);
        bm.Dispose();
    }

    public static void Card(string path, Species sp, int paletteIndex)
    {
        var look = new PetLook(Palette.All[paletteIndex])
        { Species = sp, Eyes = EyeMode.Happy, Mouth = MouthMode.Open };
        using var bm = ShareArt.RenderCard(look, Palette.All[paletteIndex], 700);
        using var img = SKImage.FromBitmap(bm);
        using var d = img.Encode(SKEncodedImageFormat.Png, 100);
        using var f = File.OpenWrite(path);
        d.SaveTo(f);
    }

    public static void AnimatedGif(string path, Species sp, int paletteIndex)
    {
        var frames = ShareArt.FrameBytes(30, 400, sp, Palette.All[paletteIndex]);
        using var f = File.Create(path);
        Gif.Write(f, frames, 400, 400, 6);
    }
}
