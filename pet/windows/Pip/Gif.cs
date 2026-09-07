using System;
using System.Collections.Generic;
using System.IO;

namespace Pip;

/// A small animated-GIF writer. macOS gets this free from ImageIO; on Windows
/// there is no built-in animated encoder, so the quantizer and the LZW coder
/// are here. Frames are opaque (the share card has a solid background), which
/// keeps this to a global palette and no transparency bookkeeping.
public static class Gif
{
    public static void Write(Stream s, IReadOnlyList<byte[]> framesBgra, int w, int h, int delayCs)
    {
        var (palette, indexed) = Quantize(framesBgra, w, h);

        // ── header ──
        s.Write("GIF89a"u8);
        WriteShort(s, w); WriteShort(s, h);
        s.WriteByte(0xF7);            // global table, 256 entries, 8 bits/pixel
        s.WriteByte(0);               // background index
        s.WriteByte(0);               // pixel aspect ratio
        for (int i = 0; i < 256; i++)
        {
            var c = i < palette.Count ? palette[i] : (r: (byte)0, g: (byte)0, b: (byte)0);
            s.WriteByte(c.r); s.WriteByte(c.g); s.WriteByte(c.b);
        }

        // ── loop forever ──
        s.WriteByte(0x21); s.WriteByte(0xFF); s.WriteByte(11);
        s.Write("NETSCAPE2.0"u8);
        s.WriteByte(3); s.WriteByte(1); WriteShort(s, 0); s.WriteByte(0);

        foreach (var frame in indexed)
        {
            // graphic control: delay, no transparency, leave the frame in place
            s.WriteByte(0x21); s.WriteByte(0xF9); s.WriteByte(4);
            s.WriteByte(0x04);                     // disposal = do not dispose
            WriteShort(s, delayCs);
            s.WriteByte(0); s.WriteByte(0);

            s.WriteByte(0x2C);                     // image descriptor
            WriteShort(s, 0); WriteShort(s, 0);
            WriteShort(s, w); WriteShort(s, h);
            s.WriteByte(0);                        // no local table, not interlaced

            Lzw(s, frame, 8);
        }
        s.WriteByte(0x3B);                         // trailer
    }

    static void WriteShort(Stream s, int v) { s.WriteByte((byte)(v & 0xFF)); s.WriteByte((byte)((v >> 8) & 0xFF)); }

    // ── quantization ─────────────────────────────────────────────────────────
    sealed class Box
    {
        public List<int> Colors = new();          // packed 0xRRGGBB
        public Dictionary<int, int> Counts = null!;
        public int Weight;
    }

    static (List<(byte r, byte g, byte b)>, List<byte[]>) Quantize(
        IReadOnlyList<byte[]> frames, int w, int h)
    {
        // Histogram over all frames, at 5 bits per channel — plenty for flat art
        // with a gradient behind it, and it keeps the box splitting quick.
        var counts = new Dictionary<int, int>();
        foreach (var f in frames)
            for (int i = 0; i < w * h; i++)
            {
                int b = f[i * 4], g = f[i * 4 + 1], r = f[i * 4 + 2];
                int key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
                counts[key] = counts.TryGetValue(key, out int c) ? c + 1 : 1;
            }

        var root = new Box { Colors = new List<int>(counts.Keys), Counts = counts };
        foreach (var kv in counts) root.Weight += kv.Value;
        var boxes = new List<Box> { root };

        while (boxes.Count < 256)
        {
            // split the heaviest box that still has room to split
            Box? pick = null;
            foreach (var b in boxes)
                if (b.Colors.Count > 1 && (pick == null || b.Weight > pick.Weight)) pick = b;
            if (pick == null) break;

            // longest axis
            int rMin = 32, rMax = -1, gMin = 32, gMax = -1, bMin = 32, bMax = -1;
            foreach (int k in pick.Colors)
            {
                int r = (k >> 10) & 31, g = (k >> 5) & 31, bl = k & 31;
                rMin = Math.Min(rMin, r); rMax = Math.Max(rMax, r);
                gMin = Math.Min(gMin, g); gMax = Math.Max(gMax, g);
                bMin = Math.Min(bMin, bl); bMax = Math.Max(bMax, bl);
            }
            int shift = (rMax - rMin) >= (gMax - gMin) && (rMax - rMin) >= (bMax - bMin) ? 10
                      : (gMax - gMin) >= (bMax - bMin) ? 5 : 0;
            pick.Colors.Sort((a, b) => (((a >> shift) & 31)).CompareTo(((b >> shift) & 31)));

            int half = pick.Weight / 2, run = 0, cut = 0;
            for (; cut < pick.Colors.Count - 1; cut++)
            {
                run += counts[pick.Colors[cut]];
                if (run >= half) break;
            }

            var left = new Box { Counts = counts };
            var right = new Box { Counts = counts };
            for (int i = 0; i < pick.Colors.Count; i++)
                (i <= cut ? left : right).Colors.Add(pick.Colors[i]);
            if (left.Colors.Count == 0 || right.Colors.Count == 0) { pick.Colors.RemoveAt(0); continue; }
            foreach (int k in left.Colors) left.Weight += counts[k];
            foreach (int k in right.Colors) right.Weight += counts[k];

            boxes.Remove(pick); boxes.Add(left); boxes.Add(right);
        }

        var palette = new List<(byte r, byte g, byte b)>();
        foreach (var box in boxes)
        {
            long r = 0, g = 0, b = 0, n = 0;
            foreach (int k in box.Colors)
            {
                int cnt = counts[k];
                r += (((k >> 10) & 31) << 3) * (long)cnt;
                g += (((k >> 5) & 31) << 3) * (long)cnt;
                b += ((k & 31) << 3) * (long)cnt;
                n += cnt;
            }
            if (n == 0) { palette.Add((0, 0, 0)); continue; }
            palette.Add(((byte)(r / n), (byte)(g / n), (byte)(b / n)));
        }
        while (palette.Count < 2) palette.Add((0, 0, 0));

        // map pixels, caching by exact color — the art repeats colors heavily
        var cache = new Dictionary<int, byte>();
        var outFrames = new List<byte[]>(frames.Count);
        foreach (var f in frames)
        {
            var idx = new byte[w * h];
            for (int i = 0; i < w * h; i++)
            {
                int b = f[i * 4], g = f[i * 4 + 1], r = f[i * 4 + 2];
                int key = (r << 16) | (g << 8) | b;
                if (!cache.TryGetValue(key, out byte best))
                {
                    int bestD = int.MaxValue; best = 0;
                    for (int p = 0; p < palette.Count; p++)
                    {
                        int dr = r - palette[p].r, dg = g - palette[p].g, db = b - palette[p].b;
                        int d = dr * dr + dg * dg + db * db;
                        if (d < bestD) { bestD = d; best = (byte)p; }
                    }
                    cache[key] = best;
                }
                idx[i] = best;
            }
            outFrames.Add(idx);
        }
        return (palette, outFrames);
    }

    // ── LZW ──────────────────────────────────────────────────────────────────
    static void Lzw(Stream s, byte[] pixels, int minCodeSize)
    {
        s.WriteByte((byte)minCodeSize);
        var block = new List<byte>(255);
        int clear = 1 << minCodeSize, eoi = clear + 1;
        int codeSize = minCodeSize + 1, next = eoi + 1;
        var table = new Dictionary<long, int>();

        int bitBuf = 0, bitCount = 0;
        void Emit(int code)
        {
            bitBuf |= code << bitCount;
            bitCount += codeSize;
            while (bitCount >= 8)
            {
                block.Add((byte)(bitBuf & 0xFF));
                bitBuf >>= 8; bitCount -= 8;
                if (block.Count == 255) { s.WriteByte(255); s.Write(block.ToArray()); block.Clear(); }
            }
        }

        Emit(clear);
        int prefix = pixels[0];
        for (int i = 1; i < pixels.Length; i++)
        {
            int k = pixels[i];
            long key = ((long)prefix << 8) | (uint)k;
            if (table.TryGetValue(key, out int code)) { prefix = code; continue; }
            Emit(prefix);
            table[key] = next++;
            if (next > (1 << codeSize))
            {
                if (codeSize < 12) codeSize++;
                else { Emit(clear); table.Clear(); codeSize = minCodeSize + 1; next = eoi + 1; }
            }
            prefix = k;
        }
        Emit(prefix);
        Emit(eoi);
        if (bitCount > 0) block.Add((byte)(bitBuf & 0xFF));
        if (block.Count > 0) { s.WriteByte((byte)block.Count); s.Write(block.ToArray()); }
        s.WriteByte(0);
    }
}
