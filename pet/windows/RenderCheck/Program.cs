using System;
using System.Collections.Generic;
using System.IO;
using SkiaSharp;
using Pip;

// Renders the ported artwork on any platform so it can be eyeballed against the
// macOS original without a Windows machine in the loop.
static class RenderCheck
{
    const int Cell = 170;

    static PetLook Look(Species sp, int pal) => new(Palette.All[pal]) { Species = sp };

    static List<(string name, PetLook look)> Poses(Species sp, int pal)
    {
        var o = new List<(string, PetLook)>();
        void Add(string n, Action<PetLook> f) { var l = Look(sp, pal); f(l); o.Add((n, l)); }

        Add("idle",      l => { });
        Add("walking",   l => { l.IsWalking = true; l.WalkPhase = 1.2f; });
        Add("sitting",   l => { l.IsSitting = true; l.Mouth = MouthMode.Neutral; });
        Add("sleeping",  l => { l.IsSitting = true; l.Eyes = EyeMode.Sleepy; l.Mouth = MouthMode.Snooze;
                                l.Particles.Add(new Particle { Kind = ParticleKind.Zzz, X = 101, Y = 73,
                                                               Life = 2.6f, MaxLife = 2.6f, Size = 13 }); });
        Add("happy",     l => { l.Eyes = EyeMode.Happy; l.Mouth = MouthMode.Open;
                                l.Particles.Add(new Particle { Kind = ParticleKind.Heart, X = 78, Y = 82,
                                                               Life = 1.7f, MaxLife = 1.7f, Size = 15 }); });
        Add("held",      l => { l.Eyes = EyeMode.Wide; l.Mouth = MouthMode.Open; l.ShadowScale = 0.4f; });
        Add("yawn",      l => { l.Mouth = MouthMode.Yawn; l.Eyes = EyeMode.Blink; l.Lean = -0.07f; });
        Add("stretch",   l => { l.StretchAmt = 1; l.SquashX = 1.30f; l.SquashY = 0.83f;
                                l.Eyes = EyeMode.Happy; });
        Add("groom",     l => { l.PawUp = 1; l.Eyes = EyeMode.Happy; l.Mouth = MouthMode.Open;
                                l.Lean = 0.05f; l.IsSitting = true; });
        Add("curious",   l => { l.Eyes = EyeMode.Wide; l.Mouth = MouthMode.Neutral; l.Lean = 0.14f;
                                l.EarTilt = 0.95f;
                                l.Particles.Add(new Particle { Kind = ParticleKind.Glyph, X = 105, Y = 75,
                                                               Life = 2f, MaxLife = 2f, Size = 17, Text = "?" }); });
        Add("flip",      l => { l.Spin = -2.2f; l.Tuck = 0.88f; l.Lift = 40; l.Eyes = EyeMode.Happy;
                                l.Mouth = MouthMode.Open; l.ShadowScale = 0.45f; });
        Add("faint",     l => { l.Spin = -1.45f; l.Eyes = EyeMode.Dizzy; l.Mouth = MouthMode.Open;
                                l.ShadowScale = 0.8f; });
        Add("loaf",      l => { l.IsSitting = true; l.SquashX = 1.10f; l.SquashY = 0.86f;
                                l.Eyes = EyeMode.Happy; l.Mouth = MouthMode.Neutral; });
        Add("bow",       l => { l.Lean = 0.44f; l.PawUp = 1; l.Eyes = EyeMode.Happy; });
        Add("downdog",   l => { l.StretchAmt = 1; l.SquashX = 1.34f; l.SquashY = 0.78f; l.Lean = 0.17f;
                                l.Eyes = EyeMode.Happy; l.Mouth = MouthMode.Open; });
        Add("desk",      l => { l.IsSitting = true; l.Props = Props.Desk; });
        Add("reading",   l => { l.IsSitting = true; l.Props = Props.Book; l.Eyes = EyeMode.Sleepy;
                                l.Mouth = MouthMode.Neutral; l.Lean = 0.05f; });
        Add("toy",       l => { l.IsWalking = true; l.Eyes = EyeMode.Wide; l.Mouth = MouthMode.Open;
                                l.Spin = -0.16f; l.Toy = new SKPoint(140, 26); });
        Add("water",     l => { l.Props = Props.Glass; l.PawUp = 0.85f; l.Sign = "Drink water";
                                l.Eyes = EyeMode.Happy; l.IsSitting = true; });
        Add("stretchsign", l => { l.Sign = "Stretch"; l.Eyes = EyeMode.Happy; });
        Add("shout",     l => { l.IsWalking = true; l.Eyes = EyeMode.Wide; l.Mouth = MouthMode.Open;
                                l.Spin = -0.20f; l.ShoutText = "Theragleeeeee!!!"; l.ShoutAge = 0.5f; });
        return o;
    }

    static void Sheet(string path, Species sp, int pal)
    {
        var poses = Poses(sp, pal);
        int cols = 7, rows = (poses.Count + cols - 1) / cols;
        int W = cols * Cell, H = rows * (Cell + 16);
        using var bm = new SKBitmap(W, H);
        using var c = new SKCanvas(bm);
        c.Clear(new SKColor(251, 249, 242));

        using var label = new SKFont(SKTypeface.Default, 11);
        using var lp = new SKPaint { Color = new SKColor(120, 130, 122), IsAntialias = true };

        for (int i = 0; i < poses.Count; i++)
        {
            int cxi = i % cols, cyi = i / cols;
            float ox = cxi * Cell, oy = cyi * (Cell + 16);
            c.Save();
            c.Translate(ox, oy);
            using (var grid = new SKPaint { Color = new SKColor(0, 0, 0, 12), IsAntialias = false,
                                            Style = SKPaintStyle.Stroke, StrokeWidth = 1 })
                c.DrawRect(SKRect.Create(0.5f, 0.5f, Cell - 1, Cell - 1), grid);
            Draw.Pet(c, poses[i].look, Cell);
            c.Restore();
            c.DrawText(poses[i].name, ox + 6, oy + Cell + 12, label, lp);
        }

        using var img = SKImage.FromBitmap(bm);
        using var data = img.Encode(SKEncodedImageFormat.Png, 100);
        using var f = File.OpenWrite(path);
        data.SaveTo(f);
        Console.WriteLine($"{path}  ({W}x{H}, {poses.Count} poses)");
    }

    static int Main(string[] args)
    {
        if (args.Length > 0 && args[0] == "--sim") return Sim.Run(args.Length > 1 ? int.Parse(args[1]) : 30);
        string outDir = args.Length > 0 ? args[0] : ".";
        Directory.CreateDirectory(outDir);
        Sheet(Path.Combine(outDir, "cat-matcha.png"), Species.Cat, 1);
        Sheet(Path.Combine(outDir, "dog-matcha.png"), Species.Dog, 1);
        Sheet(Path.Combine(outDir, "cat-cocoa.png"), Species.Cat, 3);

        Extras.Portrait(Path.Combine(outDir, "pip.png"), Species.Cat, 1, 480);
        Extras.Portrait(Path.Combine(outDir, "pip-dog.png"), Species.Dog, 1, 480);
        Console.WriteLine("portraits rendered");
        Extras.Card(Path.Combine(outDir, "card-cat.png"), Species.Cat, 1);
        Extras.Card(Path.Combine(outDir, "card-dog.png"), Species.Dog, 3);
        Console.WriteLine("share cards rendered");

        Extras.AnimatedGif(Path.Combine(outDir, "loop.gif"), Species.Cat, 1);
        var gi = new FileInfo(Path.Combine(outDir, "loop.gif"));
        Console.WriteLine($"loop.gif  ({gi.Length / 1024} KB)");

        // Read the GIF back through a decoder: a file we cannot decode is a file
        // nobody else can either.
        using (var codec = SKCodec.Create(Path.Combine(outDir, "loop.gif")))
        {
            if (codec == null) { Console.WriteLine("GIF FAILED to decode"); Environment.Exit(1); }
            Console.WriteLine($"GIF decodes: {codec.Info.Width}x{codec.Info.Height}, "
                            + $"{codec.FrameCount} frames, repeat={codec.RepetitionCount}");
        }

        var ico = Path.Combine(outDir, "Pip.ico");
        Extras.WriteIco(ico, 1, new[] { 16, 24, 32, 48, 64, 128, 256 });
        Console.WriteLine($"Pip.ico   ({new FileInfo(ico).Length / 1024} KB)");
        using (var bm = Extras.Icon(256, 1))
        using (var img = SKImage.FromBitmap(bm))
        using (var d = img.Encode(SKEncodedImageFormat.Png, 100))
        using (var f = File.OpenWrite(Path.Combine(outDir, "icon-256.png")))
            d.SaveTo(f);
        return 0;
    }
}
