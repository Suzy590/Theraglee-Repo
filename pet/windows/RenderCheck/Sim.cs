using System;
using System.Collections.Generic;
using System.Linq;
using SkiaSharp;
using Pip;

/// The behavior engine has no platform in it, so it can be driven here for hours
/// of simulated desktop time and checked for the things that would show up as
/// bugs on someone's screen: a pet that wanders off, sinks through the floor,
/// gets stuck mid-somersault, or leaks particles.
public sealed class FakeStage : IStage
{
    public float X, Y;
    public const float W = 1920, H = 1080, TaskbarH = 48;
    public SKPoint MousePos = new(900, 500);
    public List<Ledge> LedgeList = new();

    public float WindowX => X;
    public float WindowY => Y;
    public void SetOrigin(float x, float y) { X = x; Y = y; }

    public float ScreenMinX => 0;
    public float ScreenMaxX => W;
    public float ScreenMidX => W / 2;
    public float ScreenMaxY => H;
    public float VisibleMinX => 0;
    public float VisibleMaxX => W;
    public float VisibleMinY => TaskbarH;
    public float VisibleMaxY => H;
    public SKPoint Mouse => MousePos;
    public bool IsOnScreen => true;
    public IReadOnlyList<Ledge> Ledges() => LedgeList;
    public int Redraws;
    public void Redraw() => Redraws++;
    public void Quit() { }
}

sealed class MemPrefs : IPrefs
{
    readonly Dictionary<string, string> d = new();
    public string? GetString(string k) => d.TryGetValue(k, out var v) ? v : null;
    public int? GetInt(string k) => d.TryGetValue(k, out var v) && int.TryParse(v, out int n) ? n : null;
    public bool? GetBool(string k) => d.TryGetValue(k, out var v) ? v == "1" : null;
    public void SetString(string k, string v) => d[k] = v;
    public void SetInt(string k, int v) => d[k] = v.ToString();
    public void SetBool(string k, bool v) => d[k] = v ? "1" : "0";
}

public static class Sim
{
    static int failures;
    static void Check(bool ok, string what)
    { if (!ok) { failures++; Console.WriteLine($"  FAIL  {what}"); } }

    static bool Finite(float f) => !float.IsNaN(f) && !float.IsInfinity(f);

    public static int Run(int minutes)
    {
        Console.WriteLine($"Simulating {minutes} minutes of desktop time at 24fps…");
        var stage = new FakeStage();
        var prefs = new MemPrefs();
        var brain = new Brain(stage, prefs);

        float ground = stage.VisibleMinY + 4 - Draw.GroundY;
        stage.X = FakeStage.W / 2 - Draw.Canvas / 2;
        stage.Y = ground;
        // a couple of plausible window tops to perch on
        stage.LedgeList.Add(new Ledge { MinX = 200, MaxX = 1100, Y = 700 });
        stage.LedgeList.Add(new Ledge { MinX = 900, MaxX = 1800, Y = 520 });

        var rng = new Random(20260907);
        int frames = minutes * 60 * 24;
        float minX = float.MaxValue, maxX = float.MinValue, minY = float.MaxValue, maxY = float.MinValue;
        int maxParticles = 0;
        var poses = new HashSet<string>();

        for (int i = 0; i < frames; i++)
        {
            // a cursor that wanders, so the eye tracking and chase paths run
            if (i % 37 == 0)
                stage.MousePos = new SKPoint(rng.Next(0, (int)FakeStage.W), rng.Next(0, (int)FakeStage.H));

            brain.Step(1f / 24f);
            var look = brain.CurrentLook();

            // every number the renderer will consume must be usable
            Check(Finite(look.Breath) && Finite(look.SquashX) && Finite(look.SquashY)
                  && Finite(look.Lift) && Finite(look.Spin) && Finite(look.Tuck)
                  && Finite(look.Lean) && Finite(look.PawUp) && Finite(look.StretchAmt)
                  && Finite(look.ShadowScale) && Finite(look.Pupil.X) && Finite(look.Pupil.Y),
                  $"frame {i}: PetLook carries a non-finite number");
            Check(look.SquashX > 0 && look.SquashY > 0, $"frame {i}: squash collapsed to zero or negative");
            Check(MathF.Abs(look.Facing) == 1, $"frame {i}: facing is not ±1");

            minX = MathF.Min(minX, stage.X); maxX = MathF.Max(maxX, stage.X);
            minY = MathF.Min(minY, stage.Y); maxY = MathF.Max(maxY, stage.Y);
            maxParticles = Math.Max(maxParticles, look.Particles.Count);

            poses.Add(Describe(look));

            // occasional interaction, the way a person actually pokes at it
            if (i % 2000 == 1999) brain.Pet();
            if (i % 5000 == 4999) brain.StartZoomies();
            if (i % 7000 == 6999) brain.StartSilly();
            if (i % 9000 == 8999) brain.ToggleChase();
        }

        // Walking is clamped to the screen, but "peek round a corner" deliberately
        // slinks most of the way off an edge and leans back in — so the bound is
        // the peek target, not the walking clamp.
        float peekLeft = stage.ScreenMinX - Draw.Canvas * 0.42f;
        float peekRight = stage.ScreenMaxX - Draw.Canvas * 0.58f;
        Check(minX >= peekLeft - 2, $"went further left than a peek (min x {minX:F1}, peek {peekLeft:F1})");
        Check(maxX <= peekRight + 2, $"went further right than a peek (max x {maxX:F1}, peek {peekRight:F1})");
        Check(minX < stage.ScreenMaxX - Draw.Canvas && maxX > stage.ScreenMinX,
              "never moved anywhere useful");
        Check(minY >= ground - 0.5f, $"sank below the floor (min y {minY:F1}, floor {ground:F1})");
        Check(maxY < stage.ScreenMaxY, $"floated above the screen (max y {maxY:F1})");
        Check(maxParticles < 60, $"particles piled up ({maxParticles} at once)");
        Check(stage.Redraws > frames / 8, $"barely repainted ({stage.Redraws} in {frames} frames)");

        Console.WriteLine($"  x range      {minX:F0} … {maxX:F0}  (screen 0…{FakeStage.W})");
        Console.WriteLine($"  y range      {minY:F0} … {maxY:F0}  (floor {ground:F0})");
        Console.WriteLine($"  particles    {maxParticles} at peak");
        Console.WriteLine($"  repaints     {stage.Redraws} of {frames} frames ({100.0 * stage.Redraws / frames:F0}%)");
        Console.WriteLine($"  distinct looks reached: {poses.Count}");

        // Drag it somewhere silly and let go — it has to come home to the floor.
        stage.MousePos = new SKPoint(400, 900);
        brain.MouseDown();
        stage.MousePos = new SKPoint(500, 950);
        brain.MouseDragged();
        stage.MousePos = new SKPoint(1500, 980);
        brain.MouseDragged();
        brain.MouseUp(1);
        for (int i = 0; i < 24 * 12; i++) brain.Step(1f / 24f);
        Check(MathF.Abs(stage.Y - ground) < 1.5f, $"did not land after being dropped (y {stage.Y:F1})");
        Console.WriteLine($"  dropped from height, landed at y {stage.Y:F1} (floor {ground:F0})");

        // Preferences must survive a restart, including Cream, which is index 0.
        brain.Species = Species.Dog;
        brain.PaletteIndex = 0;
        var again = new Brain(new FakeStage(), prefs);
        again.LoadPrefs();
        Check(again.Species == Species.Dog, "species did not survive a reload");
        Check(again.PaletteIndex == 0, "a deliberate choice of Cream was lost on reload");
        Console.WriteLine($"  reload kept: {again.Species}, palette {again.PaletteIndex} " +
                          $"({Palette.All[again.PaletteIndex].Name})");

        Console.WriteLine(failures == 0 ? "  all simulation checks passed" : $"  {failures} FAILED");
        return failures;
    }

    static string Describe(PetLook l) =>
        $"{l.Species}/{l.Eyes}/{l.Mouth}/{(l.IsWalking ? "w" : "")}{(l.IsSitting ? "s" : "")}" +
        $"{(l.Props != Props.None ? l.Props.ToString() : "")}{(l.Sign ?? "")}" +
        $"{(l.Toy != null ? "toy" : "")}{(l.ShoutText != null ? "shout" : "")}" +
        $"{(l.Spin != 0 ? "spin" : "")}{(l.PawUp > 0.05f ? "paw" : "")}{(l.Lean != 0 ? "lean" : "")}";
}
