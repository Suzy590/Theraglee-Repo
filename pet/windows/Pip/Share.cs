using System;
using System.Diagnostics;
using System.IO;
using SkiaSharp;

namespace Pip;

/// Save a shareable card to the Desktop and reveal it in Explorer. Nothing is
/// uploaded anywhere — posting it is the user's call.
public static class Share
{
    static string Target(string ext)
    {
        var dir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
        if (string.IsNullOrEmpty(dir)) dir = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        return Path.Combine(dir, $"Pip-{DateTime.Now:yyyy-MM-dd-HHmmss}.{ext}");
    }

    static void Reveal(string path)
    {
        try { Process.Start(new ProcessStartInfo("explorer.exe", $"/select,\"{path}\"") { UseShellExecute = true }); }
        catch { /* the file is still on the Desktop either way */ }
    }

    public static void SavePhoto(Brain brain)
    {
        var look = brain.CurrentLook();
        look.Lift = MathF.Min(look.Lift, 60);
        string path = Target("png");
        try
        {
            using var bm = ShareArt.RenderCard(look, brain.Palette, 700);
            using var img = SKImage.FromBitmap(bm);
            using var data = img.Encode(SKEncodedImageFormat.Png, 100);
            using var f = File.OpenWrite(path);
            data.SaveTo(f);
        }
        catch { return; }
        Reveal(path);
    }

    public static void SaveGif(Brain brain)
    {
        string path = Target("gif");
        try
        {
            var frames = ShareArt.FrameBytes(30, 400, brain.Species, brain.Palette);
            using var f = File.Create(path);
            Gif.Write(f, frames, 400, 400, 6);      // ~0.055s per frame, as on macOS
        }
        catch { return; }
        Reveal(path);
    }
}
