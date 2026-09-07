using System.Collections.Generic;
using SkiaSharp;

namespace Pip;

public enum Species { Cat, Dog }
public enum EyeMode { Open, Blink, Happy, Sleepy, Wide, Dizzy }
public enum MouthMode { Neutral, Smile, Open, Snooze, Yawn }
public enum ParticleKind { Heart, Zzz, Glyph }

public struct Particle
{
    public ParticleKind Kind;
    public float X, Y, VX, VY, Life, MaxLife, Size;
    public string Text;
}

/// Little bits of furniture the pet can bring on stage.
[System.Flags]
public enum Props { None = 0, Desk = 1, Book = 2, Glass = 4 }

/// Each of these is performed with total conviction.
public enum SillyAct { Dance, Moonwalk, Faint, DownwardDog, Loaf, Bow }

public static class SillyActExt
{
    public static float Duration(this SillyAct a) => a switch
    {
        SillyAct.Dance => 3.2f,
        SillyAct.Moonwalk => 2.8f,
        SillyAct.Faint => 3.0f,
        SillyAct.DownwardDog => 2.6f,
        SillyAct.Loaf => 4.5f,
        _ => 2.2f,                      // bow
    };
}

/// Everything the renderer needs to know for one frame. The behavior layer
/// fills this in; `Draw` reads it and nothing else.
public sealed class PetLook
{
    public Palette Palette;
    public Species Species = Species.Cat;
    public float Breath;                // -1…1
    public float SquashX = 1, SquashY = 1;
    public float Facing = 1;            // +1 right, -1 left
    public EyeMode Eyes = EyeMode.Open;
    public MouthMode Mouth = MouthMode.Smile;
    public SKPoint Pupil;
    public float WalkPhase;
    public bool IsWalking, IsSitting;
    public float TailSway, EarTilt;
    public float Lift;                  // vertical offset above ground
    public float ShadowScale = 1;
    public bool ShowShadow = true;
    public float Spin;                  // radians, screen space — the somersault
    public float Tuck = 1;              // curls up a little mid-flip
    public List<Particle> Particles = new();
    public float Lean;                  // whole-body tilt — curious, peeking, bowing
    public float PawUp;                 // 0…1, near front paw raised
    public float StretchAmt;            // 0…1, the long luxurious stretch
    public string? Sign;                // a held-up placard
    public float SignBob;
    public Props Props = Props.None;
    public SKPoint? Toy;                // laser dot / ball, in view space
    public string? ShoutText;
    public float ShoutAge;
    public float ShoutLife = 2.1f;

    public PetLook(Palette p) { Palette = p; }
}
