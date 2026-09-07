using System;
using System.Collections.Generic;
using System.Linq;
using SkiaSharp;

namespace Pip;

public enum PetState
{
    Idle, Walking, Sitting, Sleeping, Held, Falling, Happy, Dashing, Flipping,
    Stretching, Yawning, Grooming, Curious,            // the quiet life
    WalkingTo, HoppingUp, Perching, Peeking,           // getting about the desktop
    ChasingCursor, ChasingToy,                         // play
    AtDesk, Reading,                                   // two separate pastimes
    Silly,                                             // see SillyAct
    CareWater, CareStretch,                            // self-care mode
}

public enum WalkGoal { None, Desk, Ledge, Care }

/// The pet's behavior, ported from `PetView` in the macOS build. Deliberately
/// free of any UI type: it talks to the world through IStage, which is what lets
/// the same logic drive a Windows layered window here and be exercised headlessly.
public sealed class Brain
{
    readonly IStage stage;
    readonly Random rng = new();
    readonly IPrefs prefs;

    /// Color changes ONLY when the user asks. The three writers are the Color
    /// menu, the --color flag, and loading the choice already made. Nothing about
    /// Pip's behavior — state, mood, species, time of day — may ever touch this.
    int paletteIndex = Palette.DefaultIndex;
    Species species = Species.Cat;
    bool loadingPrefs;

    public int PaletteIndex
    {
        get => paletteIndex;
        set { paletteIndex = value; forceRedraw = true; Persist(); }
    }
    public Species Species
    {
        get => species;
        set { species = value; forceRedraw = true; Persist(); }
    }
    public Palette Palette => Palette.All[paletteIndex];

    public bool StayPut;
    public bool ChaseCursor;

    bool selfCareOn;
    public bool SelfCareOn
    {
        get => selfCareOn;
        set { selfCareOn = value; careTimer = CareInterval; Persist(); }
    }

    float t, stateTime, stateLen = 3, facing = 1, walkPhase;
    PetState state = PetState.Idle;
    float blinkIn = 2.5f, blinkFor;
    float squashY = 1, squashVel, lift, vy, throwVX;
    readonly List<Particle> particles = new();
    float spawnTimer;
    int tick;
    bool forceRedraw = true;
    SillyAct sillyAct = SillyAct.Dance;
    WalkGoal walkGoal = WalkGoal.None;
    float walkTargetX;
    PetState pendingCare = PetState.CareWater;
    float hopFromY, hopToY, peekX, peekHomeX;
    float toyScreenX, toyY, toyTimer;
    float careTimer = 1500;
    const float CareInterval = 1500;          // ~25 minutes
    bool careIsWater;
    SKPoint lastMouse;
    float mouseActive;

    // zoomies: sprint, then a tucked somersault
    float flipVY, spin, shoutAge;
    string? shoutText;
    const float ShoutLife = 2.1f;
    const float FlipLaunch = 272;             // px/s of lift-off
    const float FlipGravity = 800;
    static float FlipAirtime => 2 * FlipLaunch / FlipGravity;

    SKPoint dragOrigin, dragMouse;
    float lastDragX;
    bool didDrag;

    public Brain(IStage stage, IPrefs prefs) { this.stage = stage; this.prefs = prefs; }

    float Rand(float lo, float hi) => lo + (float)rng.NextDouble() * (hi - lo);
    bool Coin => rng.Next(2) == 0;

    // ── preferences ──────────────────────────────────────────────────────────
    void Persist() { if (!loadingPrefs) SavePrefs(); }

    public void SavePrefs()
    {
        prefs.SetString("pip.species", species == Species.Dog ? "dog" : "cat");
        prefs.SetInt("pip.palette", paletteIndex);
        prefs.SetBool("pip.selfcare", selfCareOn);
    }

    public void LoadPrefs()
    {
        // Each setter persists all three keys from whatever is in memory at that
        // moment, so restoring the palette would write the *default* species over
        // a saved one if the species read had missed. Suppress writes until done.
        loadingPrefs = true;
        try
        {
            if (prefs.GetString("pip.species") is string raw)
                species = raw.Equals("dog", StringComparison.OrdinalIgnoreCase) ? Species.Dog : Species.Cat;
            // A real choice of Cream is 0, so "absent" has to be distinguishable
            // from it or the user's pick gets silently overridden.
            if (prefs.GetInt("pip.palette") is int stored && stored >= 0 && stored < Palette.All.Length)
                paletteIndex = stored;
            selfCareOn = prefs.GetBool("pip.selfcare") ?? false;
        }
        finally { loadingPrefs = false; }
    }

    // ── ground reference for the screen we're currently on ──
    float ScreenGround => stage.VisibleMinY + 4 - Draw.GroundY;

    public void Step(float dt)
    {
        if (!stage.IsOnScreen && state == PetState.Sleeping) return;
        t += dt;
        stateTime += dt;

        var m = stage.Mouse;
        if (MathF.Abs(m.X - lastMouse.X) + MathF.Abs(m.Y - lastMouse.Y) > 1.5f)
        { lastMouse = m; mouseActive = 0.5f; }
        else mouseActive = MathF.Max(0, mouseActive - dt);

        // blinking
        if (blinkFor > 0) blinkFor -= dt;
        else
        {
            blinkIn -= dt;
            if (blinkIn <= 0) { blinkFor = 0.12f; blinkIn = Rand(2.0f, 6.5f); forceRedraw = true; }
        }

        // squash spring back to 1
        const float k = 190, damp = 14;
        squashVel += (1 - squashY) * k * dt - squashVel * damp * dt;
        squashY += squashVel * dt;

        switch (state)
        {
            case PetState.Walking:
                walkPhase += dt * 8.5f;
                Move(facing * 34 * dt);
                if (stateTime > stateLen) ChooseNext();
                break;

            case PetState.Idle:
            case PetState.Sitting:
                if (stateTime > stateLen) ChooseNext();
                break;

            case PetState.Sleeping:
                spawnTimer -= dt;
                if (spawnTimer <= 0)
                {
                    spawnTimer = 1.1f;
                    particles.Add(new Particle { Kind = ParticleKind.Zzz,
                        X = Draw.Canvas / 2 + 16, Y = Draw.GroundY + Draw.BodyH * 0.95f,
                        VX = 9, VY = 15, Life = 2.6f, MaxLife = 2.6f, Size = 13 });
                }
                if (stateTime > stateLen) ChooseNext();
                break;

            case PetState.Happy:
                if (stateTime > 1.7f) ChooseNext();
                break;

            case PetState.Dashing:
                walkPhase += dt * 21;
                Move(facing * 178 * dt, bounce: false);
                if (stateTime > stateLen) LaunchFlip();
                break;

            case PetState.Flipping:
                flipVY -= FlipGravity * dt;
                lift += flipVY * dt;
                Move(facing * 152 * dt, bounce: false);
                // Drive the rotation off elapsed time rather than accumulating it,
                // so it always comes back round to upright on touchdown.
                spin = -2 * MathF.PI * MathF.Min(1, stateTime / FlipAirtime) * facing;
                if (lift <= 0 && stateTime > 0.1f)
                {
                    lift = 0; spin = 0; flipVY = 0;
                    squashY = 0.66f; squashVel = 0;
                    SetState(PetState.Idle, Rand(0.9f, 1.8f));
                }
                break;

            case PetState.Stretching:
            case PetState.Yawning:
            case PetState.Grooming:
            case PetState.Curious:
            case PetState.CareStretch:
            case PetState.CareWater:
            case PetState.AtDesk:
            case PetState.Reading:
                if (stateTime > stateLen) ChooseNext();
                break;

            case PetState.Silly:
                if (sillyAct == SillyAct.Moonwalk) { Move(-facing * 26 * dt); walkPhase += dt * 7; }
                if (stateTime > stateLen) ChooseNext();
                break;

            case PetState.WalkingTo:
                if (StepToward(walkTargetX, 46, dt) || stateTime > 9)
                {
                    switch (walkGoal)
                    {
                        case WalkGoal.Desk: SetState(PetState.AtDesk, Rand(15, 28)); break;
                        case WalkGoal.Ledge:
                            hopFromY = stage.WindowY;
                            SetState(PetState.HoppingUp, 0.55f);
                            break;
                        case WalkGoal.Care: SetState(pendingCare, 8.0f); break;
                        default: ChooseNext(); break;
                    }
                }
                break;

            case PetState.HoppingUp:
            {
                float p = MathF.Min(1, stateTime / stateLen);
                float arc = MathF.Sin(p * MathF.PI) * 30;
                stage.SetOrigin(stage.WindowX, hopFromY + (hopToY - hopFromY) * p + arc);
                if (p >= 1) SetState(PetState.Perching, Rand(8, 18));
                break;
            }

            case PetState.Perching:
                if (stateTime > stateLen)
                {
                    vy = 150;                      // hop off and let gravity take it home
                    throwVX = facing * 40;
                    SetState(PetState.Falling, 999);
                }
                break;

            case PetState.Peeking:
            {
                bool outbound = stateTime < stateLen;
                float target = outbound ? peekX : peekHomeX;
                float d = target - stage.WindowX;
                if (MathF.Abs(d) > 2.5f) MoveRaw((d > 0 ? 1 : -1) * MathF.Min(95 * dt, MathF.Abs(d)));
                else if (!outbound) ChooseNext();
                break;
            }

            case PetState.ChasingCursor:
            {
                float d = stage.Mouse.X - (stage.WindowX + Draw.Canvas / 2);
                if (MathF.Abs(d) > 16)
                {
                    facing = d > 0 ? 1 : -1;
                    Move(facing * MathF.Min(180, MathF.Abs(d) * 2.4f) * dt);
                    walkPhase += dt * 12;
                }
                if (!ChaseCursor) ChooseNext();
                break;
            }

            case PetState.ChasingToy:
            {
                toyTimer -= dt;
                if (toyTimer <= 0) PickToySpot();
                float d = toyScreenX - (stage.WindowX + Draw.Canvas / 2);
                if (MathF.Abs(d) > 10)
                {
                    facing = d > 0 ? 1 : -1;
                    Move(facing * MathF.Min(210, MathF.Abs(d) * 2.8f) * dt);
                    walkPhase += dt * 13;
                }
                if (stateTime > stateLen) ChooseNext();
                break;
            }

            case PetState.Held:
                break;

            case PetState.Falling:
                vy -= 1750 * dt;
                MoveWindowY(vy * dt);
                if (throwVX != 0) { Move(throwVX * dt); throwVX *= 0.94f; }
                if (stage.WindowY <= ScreenGround)
                {
                    stage.SetOrigin(stage.WindowX, ScreenGround);
                    float impact = MathF.Min(1, MathF.Abs(vy) / 900);
                    squashY = 1 - 0.30f * impact; squashVel = 0;
                    vy = 0; throwVX = 0;
                    SetState(PetState.Idle, Rand(1.0f, 2.0f));
                }
                break;
        }

        if (shoutText != null)
        {
            shoutAge += dt;
            if (shoutAge > ShoutLife) shoutText = null;
        }

        // self-care nudges, only when it wouldn't interrupt something
        if (selfCareOn)
        {
            careTimer -= dt;
            if (careTimer <= 0)
            {
                careTimer = CareInterval;
                switch (state)
                {
                    case PetState.Idle:
                    case PetState.Walking:
                    case PetState.Sitting:
                    case PetState.Sleeping: StartCare(); break;
                    default: break;             // try again on the next tick
                }
            }
        }

        // particles
        for (int i = 0; i < particles.Count; i++)
        {
            var p = particles[i];
            p.Life -= dt;
            p.X += p.VX * dt;
            p.Y += p.VY * dt;
            p.VX += MathF.Sin(t * 3 + p.Y * 0.1f) * 6 * dt;
            particles[i] = p;
        }
        particles.RemoveAll(p => p.Life <= 0);

        // Only repaint as often as the current behavior actually needs. Walking and
        // being held get every frame; a dozing pet needs far fewer.
        tick++;
        int every = state switch
        {
            // Walking still moves the window every tick, so the glide stays smooth —
            // only the gait itself animates at half rate, which is plenty for two feet.
            PetState.Walking => 2,
            PetState.Happy or PetState.Held or PetState.Falling => 1,
            PetState.Dashing or PetState.Flipping => 1,
            PetState.ChasingCursor or PetState.ChasingToy => 1,
            PetState.HoppingUp or PetState.Peeking => 1,
            PetState.Silly or PetState.Stretching or PetState.Yawning
                or PetState.Grooming or PetState.CareStretch => 2,
            PetState.WalkingTo => 2,
            PetState.Curious or PetState.Perching or PetState.AtDesk
                or PetState.Reading or PetState.CareWater => 3,
            PetState.Sleeping => 6,
            // A standing pet only needs to breathe. Go up to full rate while the
            // cursor is moving so the eyes track it without lag.
            _ => (particles.Count > 0 || mouseActive > 0) ? 1 : 3,
        };
        int rate = shoutText == null ? every : 1;
        if (forceRedraw || tick % rate == 0 || blinkFor > 0)
        {
            forceRedraw = false;
            stage.Redraw();
        }
    }

    void SetState(PetState s, float len)
    { state = s; stateTime = 0; stateLen = len; forceRedraw = true; }

    /// Sprint across the screen and somersault, hollering silently.
    public void StartZoomies()
    {
        if (state == PetState.Held) return;
        // Run toward whichever side has more runway.
        float mid = stage.WindowX + Draw.Canvas / 2;
        facing = (stage.ScreenMaxX - mid) >= (mid - stage.ScreenMinX) ? 1 : -1;
        shoutText = "Theragleeeeee!!!";
        shoutAge = 0;
        SetState(PetState.Dashing, Rand(0.55f, 0.95f));
    }

    void LaunchFlip()
    { flipVY = FlipLaunch; lift = 0; spin = 0; SetState(PetState.Flipping, 99); }

    void PickToySpot()
    {
        toyTimer = Rand(0.7f, 1.3f);
        float next = stage.WindowX + Draw.Canvas / 2 + Rand(-80, 80);
        next = MathF.Min(MathF.Max(next, stage.VisibleMinX + 40), stage.VisibleMaxX - 40);
        toyScreenX = next;
        toyY = species == Species.Cat ? Draw.GroundY + Rand(2, 12) : Draw.GroundY + Rand(6, 18);
    }

    public void StartToyChase() { PickToySpot(); SetState(PetState.ChasingToy, Rand(7, 12)); }

    public void StartSilly(SillyAct? act = null)
    {
        sillyAct = act ?? (SillyAct)rng.Next(Enum.GetValues<SillyAct>().Length);
        SetState(PetState.Silly, sillyAct.Duration());
    }

    /// A self-care nudge: bring water over, or model a stretch.
    public void StartCare()
    {
        careIsWater = !careIsWater;
        if (careIsWater)
        {
            pendingCare = PetState.CareWater;
            walkGoal = WalkGoal.Care;
            walkTargetX = stage.Mouse.X;
            SetState(PetState.WalkingTo, 999);
        }
        else SetState(PetState.CareStretch, 8.0f);
    }

    /// Head for the top edge of one of your windows and sit on it.
    public bool TryPerch()
    {
        // The pet needs ~95px of headroom above a ledge or its ears are cut off by
        // the top of the screen — most window tops sit right up there.
        float lo = stage.VisibleMinY + 70, hi = stage.VisibleMaxY - 95;
        float mid = stage.WindowX + Draw.Canvas / 2;
        var usable = stage.Ledges()
            .Where(g => g.Y > lo && g.Y < hi && (g.MaxX - g.MinX) > Draw.Canvas + 40)
            .ToList();
        if (usable.Count == 0) return false;
        var pick = usable.OrderBy(g => MathF.Abs((g.MinX + g.MaxX) / 2 - mid)).First();
        walkTargetX = MathF.Min(MathF.Max(mid, pick.MinX + Draw.Canvas * 0.6f), pick.MaxX - Draw.Canvas * 0.6f);
        hopToY = pick.Y - Draw.GroundY;
        walkGoal = WalkGoal.Ledge;
        SetState(PetState.WalkingTo, 999);
        return true;
    }

    /// Slink to a screen edge and lean back in.
    public void StartPeek()
    {
        peekHomeX = stage.WindowX;
        bool left = stage.WindowX + Draw.Canvas / 2 < stage.ScreenMidX;
        peekX = left ? stage.ScreenMinX - Draw.Canvas * 0.42f : stage.ScreenMaxX - Draw.Canvas * 0.58f;
        facing = left ? 1 : -1;
        SetState(PetState.Peeking, Rand(3.5f, 6.5f));
    }

    public void StartReading() => SetState(PetState.Reading, Rand(12, 24));

    public void GoToDesk()
    {
        walkGoal = WalkGoal.Desk;
        walkTargetX = stage.WindowX + Draw.Canvas / 2 + Rand(-120, 120);
        SetState(PetState.WalkingTo, 999);
    }

    public void TakeNap() => SetState(PetState.Sleeping, Rand(15, 30));

    void ChooseNext()
    {
        if (StayPut)
        {
            SetState(Coin ? PetState.Idle : PetState.Sitting, Rand(3, 7));
            return;
        }
        float r = (float)rng.NextDouble();
        if      (r < 0.05f) StartZoomies();
        else if (r < 0.11f) SetState(PetState.Stretching, 2.6f);
        else if (r < 0.15f) SetState(PetState.Yawning, 1.9f);
        else if (r < 0.20f) SetState(PetState.Grooming, Rand(3.0f, 4.5f));
        else if (r < 0.24f)
        {
            SetState(PetState.Curious, Rand(2.2f, 3.4f));
            particles.Add(new Particle { Kind = ParticleKind.Glyph,
                X = Draw.Canvas / 2 + 20, Y = Draw.GroundY + Draw.BodyH * 0.98f,
                VX = 5, VY = 12, Life = 2.0f, MaxLife = 2.0f, Size = 17, Text = "?" });
        }
        else if (r < 0.28f) StartSilly();
        else if (r < 0.31f) StartToyChase();
        else if (r < 0.34f) { if (!TryPerch()) SetState(PetState.Walking, Rand(2.5f, 6)); }
        else if (r < 0.37f) StartPeek();
        else if (r < 0.40f) GoToDesk();
        else if (r < 0.43f) StartReading();
        else if (r < 0.64f) { facing = Coin ? 1 : -1; SetState(PetState.Walking, Rand(2.5f, 6)); }
        else if (r < 0.79f) SetState(PetState.Idle, Rand(2.5f, 5));
        else if (r < 0.91f) SetState(PetState.Sitting, Rand(4, 9));
        else                SetState(PetState.Sleeping, Rand(9, 22));
    }

    // ── window motion ────────────────────────────────────────────────────────
    void Move(float dx, bool bounce = true)
    {
        float x = stage.WindowX + dx;
        float minX = stage.ScreenMinX - 14;
        float maxX = stage.ScreenMaxX - Draw.Canvas + 14;
        if (x < minX) { x = minX; if (bounce) facing = 1; }
        if (x > maxX) { x = maxX; if (bounce) facing = -1; }
        stage.SetOrigin(x, stage.WindowY);
    }

    void MoveRaw(float dx) => stage.SetOrigin(stage.WindowX + dx, stage.WindowY);

    /// Walk toward a screen x. Returns true once we're there.
    bool StepToward(float targetX, float speed, float dt)
    {
        float d = targetX - (stage.WindowX + Draw.Canvas / 2);
        if (MathF.Abs(d) < 8) return true;
        facing = d > 0 ? 1 : -1;
        Move(facing * speed * dt);
        walkPhase += dt * 9;
        return false;
    }

    void MoveWindowY(float dy)
        => stage.SetOrigin(stage.WindowX, MathF.Max(ScreenGround, stage.WindowY + dy));

    // ── mouse ────────────────────────────────────────────────────────────────
    public void MouseDown()
    {
        dragOrigin = new SKPoint(stage.WindowX, stage.WindowY);
        dragMouse = stage.Mouse;
        lastDragX = dragMouse.X;
        didDrag = false;
    }

    public void MouseDragged()
    {
        var m = stage.Mouse;
        if (!didDrag && MathF.Sqrt((m.X - dragMouse.X) * (m.X - dragMouse.X) +
                                   (m.Y - dragMouse.Y) * (m.Y - dragMouse.Y)) < 4) return;
        if (!didDrag)
        {
            didDrag = true;
            SetState(PetState.Held, 999);
            squashY = 1.06f; squashVel = 0;
        }
        throwVX = (m.X - lastDragX) * 12;
        lastDragX = m.X;
        float px = dragOrigin.X + (m.X - dragMouse.X);
        float py = dragOrigin.Y + (m.Y - dragMouse.Y);
        // Keep the pet grabbable: it can hang a little past a screen edge, but it
        // can't be pushed through the floor or dropped somewhere unreachable.
        px = MathF.Min(MathF.Max(px, stage.ScreenMinX - Draw.Canvas * 0.35f), stage.ScreenMaxX - Draw.Canvas * 0.65f);
        py = MathF.Min(MathF.Max(py, ScreenGround), stage.ScreenMaxY - Draw.Canvas * 0.55f);
        stage.SetOrigin(px, py);
    }

    public void MouseUp(int clickCount)
    {
        if (didDrag) { vy = 0; SetState(PetState.Falling, 999); }
        else if (clickCount >= 2) StartZoomies();
        else Pet();
        didDrag = false;
    }

    public void Pet()
    {
        ChaseCursor = false;          // a click always calls off the chase
        SetState(PetState.Happy, 1.7f);
        squashY = 0.86f; squashVel = 0;
        for (int i = 0; i < 5; i++)
            particles.Add(new Particle { Kind = ParticleKind.Heart,
                X = Draw.Canvas / 2 + Rand(-18, 18),
                Y = Draw.GroundY + Draw.BodyH * Rand(0.85f, 1.05f),
                VX = Rand(-14, 14), VY = Rand(32, 52),
                Life = Rand(1.0f, 1.7f), MaxLife = 1.7f, Size = Rand(11, 17) });
    }

    public void ToggleChase()
    {
        ChaseCursor = !ChaseCursor;
        if (ChaseCursor) SetState(PetState.ChasingCursor, 99999);
    }

    public void ToggleStayPut()
    {
        StayPut = !StayPut;
        if (StayPut && state == PetState.Walking) SetState(PetState.Idle, 4);
    }

    // ── render ───────────────────────────────────────────────────────────────
    public PetLook CurrentLook()
    {
        var l = new PetLook(Palette)
        {
            Breath = MathF.Sin(t * 2.1f),
            Facing = facing,
            SquashY = squashY,
            SquashX = 1 + (1 - squashY) * 0.55f,
            WalkPhase = walkPhase,
            Species = species,
            TailSway = species == Species.Dog
                ? MathF.Sin(t * (state == PetState.Walking ? 7.5f : 2.8f))
                : MathF.Sin(t * (state == PetState.Walking ? 4.5f : 1.6f)),
            EarTilt = MathF.Sin(t * 1.3f) * 0.3f,
            Particles = new List<Particle>(particles),
            ShoutText = shoutText,
            ShoutAge = shoutAge,
            ShoutLife = ShoutLife,
        };

        switch (state)
        {
            case PetState.Walking:  l.IsWalking = true; l.Mouth = MouthMode.Smile; break;
            case PetState.Sitting:  l.IsSitting = true; l.Mouth = MouthMode.Neutral; break;
            case PetState.Sleeping: l.IsSitting = true; l.Eyes = EyeMode.Sleepy; l.Mouth = MouthMode.Snooze; break;
            case PetState.Happy:    l.Eyes = EyeMode.Happy; l.Mouth = MouthMode.Open; break;
            case PetState.Held:     l.Eyes = EyeMode.Wide; l.Mouth = MouthMode.Open; break;
            case PetState.Falling:  l.Eyes = EyeMode.Wide; l.Mouth = MouthMode.Open; break;
            case PetState.Idle:     l.Mouth = MouthMode.Smile; break;

            case PetState.Dashing:
                l.IsWalking = true;
                l.Eyes = EyeMode.Wide;
                l.Mouth = MouthMode.Open;
                l.Spin = -0.20f * facing;          // leaning into the sprint
                l.TailSway = MathF.Sin(t * 11);
                break;

            case PetState.Flipping:
            {
                float p = MathF.Min(1, stateTime / FlipAirtime);
                l.Spin = spin;
                l.Tuck = 1 - 0.14f * MathF.Sin(p * MathF.PI);
                l.Lift = lift;
                l.Eyes = EyeMode.Happy;
                l.Mouth = MouthMode.Open;
                l.TailSway = MathF.Sin(t * 9);
                l.ShadowScale = MathF.Max(0.30f, 1 - lift / 95);
                break;
            }

            // ── the quiet life ──
            case PetState.Stretching:
            {
                float a = MathF.Sin(MathF.Min(1, stateTime / stateLen) * MathF.PI);
                l.StretchAmt = a;
                l.SquashX = 1 + a * 0.30f;
                l.SquashY = 1 - a * 0.17f;
                l.Eyes = EyeMode.Happy; l.Mouth = MouthMode.Smile;
                l.TailSway = MathF.Sin(t * 3) * 0.7f;
                break;
            }

            case PetState.Yawning:
            {
                float p = stateTime / stateLen;
                l.Mouth = (p > 0.22f && p < 0.80f) ? MouthMode.Yawn : MouthMode.Smile;
                l.Eyes  = (p > 0.16f && p < 0.88f) ? EyeMode.Blink : EyeMode.Open;
                l.Lean = -0.07f * facing * MathF.Sin(MathF.Min(1, p) * MathF.PI);
                break;
            }

            case PetState.Grooming:
                l.PawUp = MathF.Min(1, 0.62f + 0.42f * MathF.Sin(stateTime * 3.6f));
                l.Eyes = EyeMode.Happy;
                l.Mouth = MouthMode.Open;
                l.Lean = 0.05f * facing;
                l.IsSitting = true;
                break;

            case PetState.Curious:
                l.Eyes = EyeMode.Wide;
                l.Mouth = MouthMode.Neutral;
                l.Lean = 0.14f * facing;
                l.EarTilt = 0.95f;
                break;

            // ── getting about ──
            case PetState.WalkingTo: l.IsWalking = true; l.Mouth = MouthMode.Smile; break;

            case PetState.HoppingUp:
                l.Eyes = EyeMode.Wide; l.Mouth = MouthMode.Open;
                l.Lean = 0.10f * facing;
                l.ShadowScale = 0.45f;
                break;

            case PetState.Perching:
                l.IsSitting = true;
                l.Mouth = MouthMode.Smile;
                l.TailSway = MathF.Sin(t * 1.4f);
                l.ShadowScale = 0.55f;
                break;

            case PetState.Peeking:
                l.Lean = 0.26f * facing;
                l.Eyes = EyeMode.Wide;
                l.Mouth = MouthMode.Neutral;
                l.EarTilt = 0.8f;
                break;

            // ── play ──
            case PetState.ChasingCursor:
                l.IsWalking = true;
                l.Eyes = EyeMode.Wide;
                l.Mouth = MouthMode.Open;
                l.Spin = -0.14f * facing;
                l.TailSway = MathF.Sin(t * 10);
                break;

            case PetState.ChasingToy:
            {
                l.IsWalking = true;
                l.Eyes = EyeMode.Wide;
                l.Mouth = MouthMode.Open;
                l.Spin = -0.16f * facing;
                l.TailSway = MathF.Sin(t * 11);
                float vx = toyScreenX - stage.WindowX;
                if (vx > -20 && vx < Draw.Canvas + 20) l.Toy = new SKPoint(vx, toyY);
                break;
            }

            // ── settling in ──
            case PetState.AtDesk:
                l.IsSitting = true;
                l.Props = Props.Desk;
                l.Mouth = MouthMode.Smile;
                l.TailSway = MathF.Sin(t * 1.2f) * 0.5f;
                break;

            case PetState.Reading:
                l.IsSitting = true;
                l.Props = Props.Book;
                l.Eyes = EyeMode.Sleepy;                   // eyes down on the page
                l.Mouth = MouthMode.Neutral;
                l.Lean = 0.05f * facing;
                l.TailSway = MathF.Sin(t * 0.9f) * 0.4f;
                break;

            // ── confidently ridiculous ──
            case PetState.Silly:
            {
                float p = MathF.Min(1, stateTime / stateLen);
                switch (sillyAct)
                {
                    case SillyAct.Dance:
                        l.Lean = MathF.Sin(t * 7) * 0.30f;
                        l.PawUp = 0.5f + 0.5f * MathF.Sin(t * 7);
                        l.Lift = MathF.Abs(MathF.Sin(t * 7)) * 7;
                        l.Eyes = EyeMode.Happy; l.Mouth = MouthMode.Open;
                        l.TailSway = MathF.Sin(t * 8);
                        break;
                    case SillyAct.Moonwalk:
                        l.IsWalking = true;
                        l.Lean = -0.12f * facing;
                        l.Eyes = EyeMode.Wide; l.Mouth = MouthMode.Smile;
                        break;
                    case SillyAct.Faint:
                        l.Spin = -1.45f * facing * MathF.Min(1, p / 0.30f);
                        l.Eyes = EyeMode.Dizzy; l.Mouth = MouthMode.Open;
                        l.ShadowScale = 0.8f;
                        break;
                    case SillyAct.DownwardDog:
                    {
                        float a = MathF.Sin(p * MathF.PI);
                        l.StretchAmt = a;
                        l.SquashX = 1 + a * 0.34f;
                        l.SquashY = 1 - a * 0.22f;
                        l.Lean = 0.17f * facing * a;
                        l.Eyes = EyeMode.Happy; l.Mouth = MouthMode.Open;
                        break;
                    }
                    case SillyAct.Loaf:
                        l.IsSitting = true;
                        l.SquashX = 1.10f; l.SquashY = 0.86f;
                        l.Eyes = EyeMode.Happy; l.Mouth = MouthMode.Neutral;
                        break;
                    case SillyAct.Bow:
                    {
                        float a = MathF.Sin(p * MathF.PI);
                        l.Lean = 0.44f * facing * a;
                        l.PawUp = a;
                        l.Eyes = EyeMode.Happy; l.Mouth = MouthMode.Smile;
                        break;
                    }
                }
                break;
            }

            // ── self-care ──
            case PetState.CareWater:
                l.Props = Props.Glass;
                l.PawUp = 0.85f;
                l.Sign = "Drink water";
                l.SignBob = MathF.Sin(t * 3);
                l.Eyes = EyeMode.Happy; l.Mouth = MouthMode.Smile;
                l.IsSitting = true;
                break;

            case PetState.CareStretch:
            {
                float p = stateTime / stateLen;
                if (p < 0.42f)
                {
                    float a = MathF.Sin(p / 0.42f * MathF.PI);
                    l.StretchAmt = a;
                    l.SquashX = 1 + a * 0.30f;
                    l.SquashY = 1 - a * 0.17f;
                    l.Eyes = EyeMode.Happy; l.Mouth = MouthMode.Smile;
                }
                else
                {
                    l.Sign = "Stretch";
                    l.SignBob = MathF.Sin(t * 3);
                    l.Eyes = EyeMode.Happy; l.Mouth = MouthMode.Smile;
                }
                break;
            }
        }

        if (blinkFor > 0 && l.Eyes == EyeMode.Open) l.Eyes = EyeMode.Blink;

        // eyes follow the cursor
        if (l.Eyes == EyeMode.Open || l.Eyes == EyeMode.Wide)
        {
            float ex = stage.WindowX + Draw.Canvas / 2;
            float ey = stage.WindowY + Draw.GroundY + Draw.BodyH * 0.55f;
            var m = stage.Mouse;
            float dx = MathF.Max(-1, MathF.Min(1, (m.X - ex) / 150));
            float dy = MathF.Max(-1, MathF.Min(1, (m.Y - ey) / 150));
            l.Pupil = new SKPoint(dx * 2.3f * facing, dy * 2.0f);
        }

        if (state == PetState.Falling || state == PetState.Held)
        {
            float h = MathF.Max(0, stage.WindowY - ScreenGround);
            l.Lift = 0;
            l.ShadowScale = MathF.Max(0.35f, 1 - h / 260);
        }
        return l;
    }
}

/// Where the animal and color choices live between runs.
public interface IPrefs
{
    string? GetString(string key);
    int? GetInt(string key);
    bool? GetBool(string key);
    void SetString(string key, string value);
    void SetInt(string key, int value);
    void SetBool(string key, bool value);
}
