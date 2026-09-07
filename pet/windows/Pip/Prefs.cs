using System;
using System.Collections.Generic;
using System.IO;

namespace Pip;

/// The Windows stand-in for UserDefaults: three keys in a plain text file under
/// %APPDATA%. Deliberately not JSON — a reflection-based serializer is the one
/// thing in this app that would not survive trimming, and this needs no schema.
public sealed class JsonPrefs : IPrefs
{
    readonly string path;
    readonly Dictionary<string, string> data = new(StringComparer.Ordinal);

    public JsonPrefs()
    {
        var dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Pip");
        try { Directory.CreateDirectory(dir); } catch { }
        path = Path.Combine(dir, "prefs.txt");
        try
        {
            if (File.Exists(path))
                foreach (var line in File.ReadAllLines(path))
                {
                    int eq = line.IndexOf('=');
                    if (eq > 0) data[line[..eq]] = line[(eq + 1)..];
                }
        }
        catch { data.Clear(); }        // an unreadable file just means "no choices yet"
    }

    public string? GetString(string key) => data.TryGetValue(key, out var v) ? v : null;

    public int? GetInt(string key)
        => data.TryGetValue(key, out var v) && int.TryParse(v, out int n) ? n : null;

    public bool? GetBool(string key)
        => data.TryGetValue(key, out var v) ? v == "1" : null;

    public void SetString(string key, string value) => Set(key, value);
    public void SetInt(string key, int value) => Set(key, value.ToString());
    public void SetBool(string key, bool value) => Set(key, value ? "1" : "0");

    void Set(string key, string value)
    {
        data[key] = value;
        try
        {
            var lines = new List<string>(data.Count);
            foreach (var kv in data) lines.Add(kv.Key + "=" + kv.Value);
            File.WriteAllLines(path, lines);
        }
        catch { /* a pet that can't save its color is still a pet */ }
    }
}
