using System.Collections.Generic;
using SkiaSharp;

namespace Pip;

/// The top edge of somebody else's window — somewhere to sit.
public struct Ledge { public float MinX, MaxX, Y; }

/// Everything the behavior layer needs from the outside world. The brain works
/// in AppKit's convention throughout — screen origin bottom-left, y increasing
/// upward — so the state machine could be transcribed from `pet.swift` without
/// re-deriving any of it. The Windows host does the y-flip at this boundary.
public interface IStage
{
    float WindowX { get; }
    float WindowY { get; }
    void SetOrigin(float x, float y);

    float ScreenMinX { get; }
    float ScreenMaxX { get; }
    float VisibleMinX { get; }
    float VisibleMaxX { get; }
    float VisibleMinY { get; }
    float VisibleMaxY { get; }
    float ScreenMidX { get; }
    float ScreenMaxY { get; }

    SKPoint Mouse { get; }
    bool IsOnScreen { get; }
    IReadOnlyList<Ledge> Ledges();

    void Redraw();
    void Quit();
}
