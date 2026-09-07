using System;
using System.Runtime.InteropServices;

namespace Pip;

static class Program
{
    [STAThread]
    static int Main(string[] args)
    {
        // One pet at a time. A stray second launch quietly steps aside rather
        // than putting two creatures on the desktop.
        var only = Native.CreateMutex(IntPtr.Zero, true, @"Local\Theraglee.Pip.SingleInstance");
        if (only == IntPtr.Zero || Marshal.GetLastWin32Error() == Native.ERROR_ALREADY_EXISTS) return 0;

        // Ask for real pixels before any window exists, so a 125%/150% display
        // gets a crisp pet instead of a stretched one.
        try { Native.SetProcessDpiAwarenessContext(Native.DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2); }
        catch { /* older Windows: the 96dpi path still works */ }

        Species? species = null;
        int? palette = null;
        for (int i = 0; i < args.Length - 1; i++)
        {
            if (args[i] == "--species")
                species = args[i + 1].Equals("dog", StringComparison.OrdinalIgnoreCase)
                    ? Species.Dog : Species.Cat;
            if (args[i] is "--color" or "--colour")
            {
                int n = Array.FindIndex(Palette.All,
                    p => p.Name.Equals(args[i + 1], StringComparison.OrdinalIgnoreCase));
                if (n >= 0) palette = n;
            }
        }

        var win = new PetWindow(new JsonPrefs(), species, palette);
        win.Run();
        return 0;
    }
}
