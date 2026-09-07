using System;
using System.Runtime.InteropServices;

namespace Pip;

/// The Win32 surface Pip needs. There is no WinForms here on purpose: it cannot
/// be trimmed, and bundling it drags the whole WPF/WinForms runtime into the
/// download for a window that is one layered rectangle and a popup menu.
internal static class Native
{
    // ── window styles ──
    public const int WS_POPUP = unchecked((int)0x80000000);
    public const int WS_EX_LAYERED = 0x00080000;
    public const int WS_EX_TOOLWINDOW = 0x00000080;
    public const int WS_EX_TOPMOST = 0x00000008;
    public const int WS_EX_NOACTIVATE = 0x08000000;

    public const int CS_DBLCLKS = 0x0008;

    public const int SW_SHOWNOACTIVATE = 4;
    public const int ULW_ALPHA = 0x00000002;
    public const byte AC_SRC_OVER = 0x00;
    public const byte AC_SRC_ALPHA = 0x01;

    // ── messages ──
    public const int WM_DESTROY = 0x0002;
    public const int WM_CLOSE = 0x0010;
    public const int WM_QUIT = 0x0012;
    public const int WM_TIMER = 0x0113;
    public const int WM_MOUSEMOVE = 0x0200;
    public const int WM_LBUTTONDOWN = 0x0201;
    public const int WM_LBUTTONUP = 0x0202;
    public const int WM_LBUTTONDBLCLK = 0x0203;
    public const int WM_RBUTTONUP = 0x0205;
    public const int WM_DPICHANGED = 0x02E0;
    public const int WM_DISPLAYCHANGE = 0x007E;

    public const uint SWP_NOSIZE = 0x0001, SWP_NOZORDER = 0x0004, SWP_NOACTIVATE = 0x0010;
    public const int HWND_TOPMOST = -1;

    // ── menu ──
    public const uint MF_STRING = 0x0000, MF_POPUP = 0x0010, MF_SEPARATOR = 0x0800,
                      MF_CHECKED = 0x0008, MF_UNCHECKED = 0x0000;
    public const uint TPM_RETURNCMD = 0x0100, TPM_RIGHTBUTTON = 0x0002, TPM_NONOTIFY = 0x0080;

    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] public struct SIZE { public int cx, cy; }
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSG
    {
        public IntPtr hwnd; public uint message; public IntPtr wParam, lParam;
        public uint time; public POINT pt;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    public struct BLENDFUNCTION
    { public byte BlendOp, BlendFlags, SourceConstantAlpha, AlphaFormat; }

    [StructLayout(LayoutKind.Sequential)]
    public struct BITMAPINFOHEADER
    {
        public uint biSize;
        public int biWidth, biHeight;
        public ushort biPlanes, biBitCount;
        public uint biCompression, biSizeImage;
        public int biXPelsPerMeter, biYPelsPerMeter;
        public uint biClrUsed, biClrImportant;
    }

    public delegate IntPtr WndProc(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct WNDCLASSEX
    {
        public uint cbSize, style;
        [MarshalAs(UnmanagedType.FunctionPtr)] public WndProc lpfnWndProc;
        public int cbClsExtra, cbWndExtra;
        public IntPtr hInstance, hIcon, hCursor, hbrBackground;
        [MarshalAs(UnmanagedType.LPWStr)] public string? lpszMenuName;
        [MarshalAs(UnmanagedType.LPWStr)] public string lpszClassName;
        public IntPtr hIconSm;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MONITORINFO
    { public uint cbSize; public RECT rcMonitor, rcWork; public uint dwFlags; }

    const string U = "user32.dll";
    const string G = "gdi32.dll";
    const string K = "kernel32.dll";

    [DllImport(U, CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern ushort RegisterClassEx(ref WNDCLASSEX c);
    [DllImport(U, CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr CreateWindowEx(int exStyle, string cls, string? name, int style,
        int x, int y, int w, int h, IntPtr parent, IntPtr menu, IntPtr inst, IntPtr param);
    [DllImport(U)] public static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport(U)] public static extern bool DestroyWindow(IntPtr h);
    [DllImport(U, CharSet = CharSet.Unicode)]
    public static extern IntPtr DefWindowProc(IntPtr h, uint msg, IntPtr w, IntPtr l);
    [DllImport(U, CharSet = CharSet.Unicode)]
    public static extern int GetMessage(out MSG m, IntPtr h, uint min, uint max);
    [DllImport(U)] public static extern bool TranslateMessage(ref MSG m);
    [DllImport(U, CharSet = CharSet.Unicode)] public static extern IntPtr DispatchMessage(ref MSG m);
    [DllImport(U)] public static extern void PostQuitMessage(int code);
    [DllImport(U, CharSet = CharSet.Unicode)]
    public static extern bool PostMessage(IntPtr h, uint msg, IntPtr w, IntPtr l);
    [DllImport(U)] public static extern IntPtr SetTimer(IntPtr h, IntPtr id, uint ms, IntPtr proc);
    [DllImport(U)] public static extern bool KillTimer(IntPtr h, IntPtr id);
    [DllImport(U)] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y,
        int cx, int cy, uint flags);
    [DllImport(U)] public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport(U)] public static extern IntPtr SetCapture(IntPtr h);
    [DllImport(U)] public static extern bool ReleaseCapture();
    [DllImport(U)] public static extern bool GetCursorPos(out POINT p);
    [DllImport(U)] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport(U)] public static extern IntPtr LoadCursor(IntPtr inst, int name);
    public const int IDC_ARROW = 32512;

    [DllImport(U)] public static extern IntPtr GetDC(IntPtr h);
    [DllImport(U)] public static extern int ReleaseDC(IntPtr h, IntPtr dc);
    [DllImport(U, SetLastError = true)]
    public static extern bool UpdateLayeredWindow(IntPtr hwnd, IntPtr hdcDst, ref POINT pptDst,
        ref SIZE psize, IntPtr hdcSrc, ref POINT pptSrc, int crKey, ref BLENDFUNCTION pblend, int flags);

    [DllImport(U)] public static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
    public const uint MONITOR_DEFAULTTOPRIMARY = 1, MONITOR_DEFAULTTONEAREST = 2;
    [DllImport(U)] public static extern bool GetMonitorInfo(IntPtr mon, ref MONITORINFO mi);
    [DllImport(U)] public static extern int GetSystemMetrics(int index);
    public const int SM_CYSCREEN = 1;

    [DllImport(U)] public static extern uint GetDpiForWindow(IntPtr h);
    [DllImport(U)] public static extern bool SetProcessDpiAwarenessContext(IntPtr ctx);
    public static readonly IntPtr DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = new(-4);

    [DllImport(U)] public static extern IntPtr CreatePopupMenu();
    [DllImport(U)] public static extern bool DestroyMenu(IntPtr m);
    [DllImport(U, CharSet = CharSet.Unicode)]
    public static extern bool AppendMenu(IntPtr m, uint flags, IntPtr idOrSubmenu, string? item);
    [DllImport(U)] public static extern int TrackPopupMenu(IntPtr m, uint flags, int x, int y,
        int reserved, IntPtr h, IntPtr rect);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport(U)] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
    [DllImport(U)] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport(U, CharSet = CharSet.Unicode)] public static extern int GetWindowTextLength(IntPtr h);
    [DllImport(U)] public static extern bool IsIconic(IntPtr h);

    [DllImport(G)] public static extern IntPtr CreateCompatibleDC(IntPtr dc);
    [DllImport(G)] public static extern bool DeleteDC(IntPtr dc);
    [DllImport(G)] public static extern IntPtr SelectObject(IntPtr dc, IntPtr h);
    [DllImport(G)] public static extern bool DeleteObject(IntPtr h);
    [DllImport(G)]
    public static extern IntPtr CreateDIBSection(IntPtr dc, ref BITMAPINFOHEADER bmi, uint usage,
        out IntPtr bits, IntPtr section, uint offset);

    [DllImport(K, CharSet = CharSet.Unicode)] public static extern IntPtr GetModuleHandle(string? name);
    [DllImport(K, CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr CreateMutex(IntPtr attr, bool initialOwner, string name);
    public const int ERROR_ALREADY_EXISTS = 183;

    [DllImport("dwmapi.dll")]
    public static extern int DwmGetWindowAttribute(IntPtr h, int attr, out int value, int size);
    public const int DWMWA_CLOAKED = 14;

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr ShellExecute(IntPtr h, string? op, string file, string? args,
        string? dir, int show);

    public static int LoWord(IntPtr v) => unchecked((short)(long)v);
    public static int HiWord(IntPtr v) => unchecked((short)((long)v >> 16));
}
