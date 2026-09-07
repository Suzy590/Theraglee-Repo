using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using SkiaSharp;

namespace Pip;

/// The window Pip lives in: borderless, click-through where it is transparent,
/// always on top, and never taking focus from what you are actually doing.
///
/// The brain works in the macOS build's units — a 170-unit canvas, screen origin
/// bottom-left, y increasing upward. Windows counts physical pixels down from the
/// top-left of the primary monitor. Both conversions live here and nowhere else.
public sealed class PetWindow : IStage
{
    const string ClassName = "TheragleePipWindow";

    readonly Brain brain;
    readonly Native.WndProc wndProcDelegate;    // held so the GC cannot collect it
    IntPtr hwnd;
    IntPtr hBitmap, hdcMem, oldBitmap;
    SKSurface? surface;

    int left, top, pxSize;
    float scale = 1;
    bool dirty = true, dragging;
    int pendingClicks = 1;

    List<Ledge> ledgeCache = new();
    DateTime ledgeStamp = DateTime.MinValue;

    // menu command ids
    const int IdPet = 1, IdFlip = 2, IdNap = 3, IdSilly = 4, IdToy = 5, IdDesk = 6, IdRead = 7,
              IdChase = 8, IdCare = 9, IdCareNow = 10, IdPhoto = 11, IdGif = 12,
              IdStay = 13, IdQuit = 14, IdColor0 = 100, IdSpecies0 = 200;

    public PetWindow(IPrefs prefs, Species? forceSpecies, int? forcePalette)
    {
        brain = new Brain(this, prefs);
        brain.LoadPrefs();
        if (forceSpecies is Species sp) brain.Species = sp;
        if (forcePalette is int pi) brain.PaletteIndex = pi;

        wndProcDelegate = WndProc;
        var inst = Native.GetModuleHandle(null);

        var wc = new Native.WNDCLASSEX
        {
            cbSize = (uint)Marshal.SizeOf<Native.WNDCLASSEX>(),
            style = Native.CS_DBLCLKS,
            lpfnWndProc = wndProcDelegate,
            hInstance = inst,
            hCursor = Native.LoadCursor(IntPtr.Zero, Native.IDC_ARROW),
            lpszClassName = ClassName,
        };
        Native.RegisterClassEx(ref wc);

        hwnd = Native.CreateWindowEx(
            Native.WS_EX_LAYERED | Native.WS_EX_TOOLWINDOW | Native.WS_EX_TOPMOST | Native.WS_EX_NOACTIVATE,
            ClassName, "Pip", Native.WS_POPUP,
            0, 0, (int)Draw.Canvas, (int)Draw.Canvas,
            IntPtr.Zero, IntPtr.Zero, inst, IntPtr.Zero);
        if (hwnd == IntPtr.Zero) throw new InvalidOperationException("could not create Pip's window");

        Rescale();
        var work = WorkArea;
        left = work.Left + (work.Right - work.Left) / 2 - pxSize / 2;
        top  = work.Bottom - pxSize + (int)(Draw.GroundY * scale) - (int)(4 * scale);
        Reposition();

        Native.ShowWindow(hwnd, Native.SW_SHOWNOACTIVATE);
        Native.SetTimer(hwnd, new IntPtr(1), 1000 / 24, IntPtr.Zero);
        Present();
    }

    public void Run()
    {
        while (Native.GetMessage(out var msg, IntPtr.Zero, 0, 0) > 0)
        {
            Native.TranslateMessage(ref msg);
            Native.DispatchMessage(ref msg);
        }
    }

    IntPtr WndProc(IntPtr h, uint msg, IntPtr w, IntPtr l)
    {
        switch (msg)
        {
            case Native.WM_TIMER:
                brain.Step(1f / 24f);
                if (dirty) { Present(); dirty = false; }
                return IntPtr.Zero;

            case Native.WM_LBUTTONDOWN:
                pendingClicks = 1;
                dragging = true;
                brain.MouseDown();
                Native.SetCapture(h);
                return IntPtr.Zero;

            case Native.WM_LBUTTONDBLCLK:
                pendingClicks = 2;
                dragging = true;
                brain.MouseDown();
                Native.SetCapture(h);
                return IntPtr.Zero;

            case Native.WM_MOUSEMOVE:
                if (dragging) brain.MouseDragged();
                return IntPtr.Zero;

            case Native.WM_LBUTTONUP:
                if (dragging)
                {
                    dragging = false;
                    Native.ReleaseCapture();
                    brain.MouseUp(pendingClicks);
                    pendingClicks = 1;
                }
                return IntPtr.Zero;

            case Native.WM_RBUTTONUP:
                ShowMenu();
                return IntPtr.Zero;

            case Native.WM_DPICHANGED:
            case Native.WM_DISPLAYCHANGE:
                Rescale();
                dirty = true;
                return IntPtr.Zero;

            case Native.WM_CLOSE:
                Native.DestroyWindow(h);
                return IntPtr.Zero;

            case Native.WM_DESTROY:
                Release();
                Native.PostQuitMessage(0);
                return IntPtr.Zero;
        }
        return Native.DefWindowProc(h, msg, w, l);
    }

    // ── surface ──────────────────────────────────────────────────────────────
    /// A 150%-scaled laptop is the common case on Windows, so the pet is rendered
    /// at the monitor's real pixel density rather than blown up from 96dpi.
    void Rescale()
    {
        uint dpi = Native.GetDpiForWindow(hwnd);
        float want = dpi == 0 ? 1 : dpi / 96f;
        int px = (int)MathF.Round(Draw.Canvas * want);
        if (surface != null && px == pxSize) return;
        scale = want;
        pxSize = px;
        MakeSurface();
        Reposition();
    }

    void MakeSurface()
    {
        Release();
        var bmi = new Native.BITMAPINFOHEADER
        {
            biSize = (uint)Marshal.SizeOf<Native.BITMAPINFOHEADER>(),
            biWidth = pxSize,
            biHeight = -pxSize,        // negative: top-down, which is what Skia hands us
            biPlanes = 1,
            biBitCount = 32,
            biCompression = 0,         // BI_RGB
        };
        var screenDC = Native.GetDC(IntPtr.Zero);
        hdcMem = Native.CreateCompatibleDC(screenDC);
        hBitmap = Native.CreateDIBSection(screenDC, ref bmi, 0, out var bits, IntPtr.Zero, 0);
        oldBitmap = Native.SelectObject(hdcMem, hBitmap);
        Native.ReleaseDC(IntPtr.Zero, screenDC);

        // Render straight into the DIB's memory — no copy between Skia and GDI.
        var info = new SKImageInfo(pxSize, pxSize, SKColorType.Bgra8888, SKAlphaType.Premul);
        surface = SKSurface.Create(info, bits, info.RowBytes);
    }

    void Release()
    {
        surface?.Dispose(); surface = null;
        if (hdcMem != IntPtr.Zero) { Native.SelectObject(hdcMem, oldBitmap); Native.DeleteDC(hdcMem); hdcMem = IntPtr.Zero; }
        if (hBitmap != IntPtr.Zero) { Native.DeleteObject(hBitmap); hBitmap = IntPtr.Zero; }
    }

    void Reposition() => Native.SetWindowPos(hwnd, new IntPtr(Native.HWND_TOPMOST),
        left, top, pxSize, pxSize, Native.SWP_NOACTIVATE);

    void Present()
    {
        if (surface == null) return;
        var c = surface.Canvas;
        c.Clear(SKColors.Transparent);
        c.Save();
        c.Scale(scale, scale);
        Draw.Pet(c, brain.CurrentLook(), Draw.Canvas);
        c.Restore();
        c.Flush();

        var src = new Native.POINT { X = 0, Y = 0 };
        var dst = new Native.POINT { X = left, Y = top };
        var size = new Native.SIZE { cx = pxSize, cy = pxSize };
        var blend = new Native.BLENDFUNCTION
        {
            BlendOp = Native.AC_SRC_OVER,
            BlendFlags = 0,
            SourceConstantAlpha = 255,
            AlphaFormat = Native.AC_SRC_ALPHA,
        };
        var screenDC = Native.GetDC(IntPtr.Zero);
        Native.UpdateLayeredWindow(hwnd, screenDC, ref dst, ref size, hdcMem, ref src, 0,
                                   ref blend, Native.ULW_ALPHA);
        Native.ReleaseDC(IntPtr.Zero, screenDC);
    }

    // ── screen geometry ──────────────────────────────────────────────────────
    Native.MONITORINFO Monitor
    {
        get
        {
            var mi = new Native.MONITORINFO { cbSize = (uint)Marshal.SizeOf<Native.MONITORINFO>() };
            var mon = Native.MonitorFromWindow(hwnd, Native.MONITOR_DEFAULTTONEAREST);
            Native.GetMonitorInfo(mon, ref mi);
            return mi;
        }
    }
    Native.RECT Bounds => Monitor.rcMonitor;
    Native.RECT WorkArea => Monitor.rcWork;

    /// AppKit measures up from the bottom of the primary display; Windows measures
    /// down from its top. This is the one number that ties the two together.
    static int PrimaryH => Native.GetSystemMetrics(Native.SM_CYSCREEN);

    float ToUnits(float px) => px / scale;
    float FromUnits(float u) => u * scale;

    // ── IStage ───────────────────────────────────────────────────────────────
    public float WindowX => ToUnits(left);
    public float WindowY => ToUnits(PrimaryH - top - pxSize);

    public void SetOrigin(float x, float y)
    {
        int nx = (int)MathF.Round(FromUnits(x));
        int ny = (int)MathF.Round(PrimaryH - FromUnits(y) - pxSize);
        if (nx != left || ny != top) { left = nx; top = ny; Reposition(); dirty = true; }
    }

    public float ScreenMinX => ToUnits(Bounds.Left);
    public float ScreenMaxX => ToUnits(Bounds.Right);
    public float ScreenMidX => ToUnits((Bounds.Left + Bounds.Right) / 2f);
    public float ScreenMaxY => ToUnits(PrimaryH - Bounds.Top);
    public float VisibleMinX => ToUnits(WorkArea.Left);
    public float VisibleMaxX => ToUnits(WorkArea.Right);
    public float VisibleMinY => ToUnits(PrimaryH - WorkArea.Bottom);
    public float VisibleMaxY => ToUnits(PrimaryH - WorkArea.Top);

    public SKPoint Mouse
    {
        get
        {
            Native.GetCursorPos(out var p);
            return new SKPoint(ToUnits(p.X), ToUnits(PrimaryH - p.Y));
        }
    }

    public bool IsOnScreen => !Native.IsIconic(hwnd);
    public void Redraw() => dirty = true;
    public void Quit() => Native.PostMessage(hwnd, Native.WM_CLOSE, IntPtr.Zero, IntPtr.Zero);

    public IReadOnlyList<Ledge> Ledges()
    {
        if ((DateTime.UtcNow - ledgeStamp).TotalMilliseconds < 500) return ledgeCache;
        ledgeStamp = DateTime.UtcNow;
        var found = new List<Ledge>();
        Native.EnumWindows((h, _) =>
        {
            if (h == hwnd || !Native.IsWindowVisible(h) || Native.IsIconic(h)) return true;
            if (Native.GetWindowTextLength(h) == 0) return true;
            // A window parked on another virtual desktop is still "visible" here.
            if (Native.DwmGetWindowAttribute(h, Native.DWMWA_CLOAKED, out int cloaked, sizeof(int)) == 0
                && cloaked != 0) return true;
            if (!Native.GetWindowRect(h, out var r)) return true;
            if (ToUnits(r.Right - r.Left) < 240 || ToUnits(r.Bottom - r.Top) < 140) return true;
            found.Add(new Ledge
            {
                MinX = ToUnits(r.Left),
                MaxX = ToUnits(r.Right),
                Y = ToUnits(PrimaryH - r.Top),
            });
            return true;
        }, IntPtr.Zero);
        ledgeCache = found;
        return ledgeCache;
    }

    // ── menu ─────────────────────────────────────────────────────────────────
    void ShowMenu()
    {
        var m = Native.CreatePopupMenu();
        void Add(int id, string text, bool? check = null)
            => Native.AppendMenu(m, Native.MF_STRING | (check == true ? Native.MF_CHECKED : Native.MF_UNCHECKED),
                                 new IntPtr(id), text);
        void Sep() => Native.AppendMenu(m, Native.MF_SEPARATOR, IntPtr.Zero, null);

        Add(IdPet, "Pet me!");
        Add(IdFlip, "Do a flip! \U0001F938");
        Add(IdNap, "Take a nap");
        Add(IdSilly, "Do something silly \U0001F92A");
        Add(IdToy, brain.Species == Species.Cat ? "Chase the laser \U0001F534" : "Chase the ball \U0001F3BE");
        Add(IdDesk, "Sit at your desk \U0001FA91");
        Add(IdRead, "Read a book \U0001F4D6");
        Sep();
        Add(IdChase, brain.ChaseCursor ? "Stop chasing my cursor" : "Chase my cursor", brain.ChaseCursor);
        Add(IdCare, "Self-care mode", brain.SelfCareOn);
        if (brain.SelfCareOn) Add(IdCareNow, "Nudge me now");
        Sep();

        var share = Native.CreatePopupMenu();
        Native.AppendMenu(share, Native.MF_STRING, new IntPtr(IdPhoto), "Save photo (PNG)");
        Native.AppendMenu(share, Native.MF_STRING, new IntPtr(IdGif), "Save animation (GIF)");
        Native.AppendMenu(m, Native.MF_POPUP, share, "Share…");
        Sep();

        var colors = Native.CreatePopupMenu();
        for (int i = 0; i < Palette.All.Length; i++)
            Native.AppendMenu(colors,
                Native.MF_STRING | (i == brain.PaletteIndex ? Native.MF_CHECKED : Native.MF_UNCHECKED),
                new IntPtr(IdColor0 + i), Palette.All[i].Name);
        Native.AppendMenu(m, Native.MF_POPUP, colors, "Color");

        var kinds = Native.CreatePopupMenu();
        Native.AppendMenu(kinds,
            Native.MF_STRING | (brain.Species == Species.Cat ? Native.MF_CHECKED : Native.MF_UNCHECKED),
            new IntPtr(IdSpecies0 + 0), "Cat \U0001F431");
        Native.AppendMenu(kinds,
            Native.MF_STRING | (brain.Species == Species.Dog ? Native.MF_CHECKED : Native.MF_UNCHECKED),
            new IntPtr(IdSpecies0 + 1), "Dog \U0001F436");
        Native.AppendMenu(m, Native.MF_POPUP, kinds, "Animal");

        Add(IdStay, "Stay put", brain.StayPut);
        Sep();
        Add(IdQuit, "Goodbye \U0001F43E");

        Native.GetCursorPos(out var pt);
        // A WS_EX_NOACTIVATE window is never foreground on its own, and a menu owned
        // by a background window will not dismiss when you click elsewhere. The
        // trailing WM_NULL is the documented companion to that.
        Native.SetForegroundWindow(hwnd);
        int cmd = Native.TrackPopupMenu(m, Native.TPM_RETURNCMD | Native.TPM_RIGHTBUTTON | Native.TPM_NONOTIFY,
                                        pt.X, pt.Y, 0, hwnd, IntPtr.Zero);
        Native.PostMessage(hwnd, 0x0000, IntPtr.Zero, IntPtr.Zero);   // WM_NULL
        Native.DestroyMenu(m);

        if (cmd >= IdColor0 && cmd < IdColor0 + Palette.All.Length) { brain.PaletteIndex = cmd - IdColor0; return; }
        if (cmd == IdSpecies0) { brain.Species = Species.Cat; return; }
        if (cmd == IdSpecies0 + 1) { brain.Species = Species.Dog; return; }

        switch (cmd)
        {
            case IdPet: brain.Pet(); break;
            case IdFlip: brain.StartZoomies(); break;
            case IdNap: brain.TakeNap(); break;
            case IdSilly: brain.StartSilly(); break;
            case IdToy: brain.StartToyChase(); break;
            case IdDesk: brain.GoToDesk(); break;
            case IdRead: brain.StartReading(); break;
            case IdChase: brain.ToggleChase(); break;
            case IdCare: brain.SelfCareOn = !brain.SelfCareOn; break;
            case IdCareNow: brain.StartCare(); break;
            case IdPhoto: Share.SavePhoto(brain); break;
            case IdGif: Share.SaveGif(brain); break;
            case IdStay: brain.ToggleStayPut(); break;
            case IdQuit: Quit(); break;
        }
    }
}
