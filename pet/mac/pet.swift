import AppKit
import ImageIO
import UniformTypeIdentifiers

// ───────────────────────────────── palette ─────────────────────────────────

struct Palette {
    let name: String
    let body: NSColor
    let shade: NSColor
    let inner: NSColor
    let cheek: NSColor
    let ink: NSColor
}

/// What a pet is before anyone picks anything. Cat and dog both start here.
let defaultPaletteIndex = 1        // Matcha

let palettes: [Palette] = [
    Palette(name: "Cream",
            body:  NSColor(srgbRed: 0.99, green: 0.86, blue: 0.71, alpha: 1),
            shade: NSColor(srgbRed: 0.88, green: 0.68, blue: 0.49, alpha: 1),
            inner: NSColor(srgbRed: 1.00, green: 0.73, blue: 0.68, alpha: 1),
            cheek: NSColor(srgbRed: 0.99, green: 0.53, blue: 0.51, alpha: 0.45),
            ink:   NSColor(srgbRed: 0.27, green: 0.19, blue: 0.16, alpha: 1)),
    Palette(name: "Matcha",
            body:  NSColor(srgbRed: 0.79, green: 0.90, blue: 0.72, alpha: 1),
            shade: NSColor(srgbRed: 0.58, green: 0.75, blue: 0.52, alpha: 1),
            inner: NSColor(srgbRed: 0.99, green: 0.80, blue: 0.75, alpha: 1),
            cheek: NSColor(srgbRed: 0.95, green: 0.54, blue: 0.51, alpha: 0.40),
            ink:   NSColor(srgbRed: 0.17, green: 0.27, blue: 0.19, alpha: 1)),
    Palette(name: "Blueberry",
            body:  NSColor(srgbRed: 0.75, green: 0.82, blue: 0.98, alpha: 1),
            shade: NSColor(srgbRed: 0.55, green: 0.65, blue: 0.90, alpha: 1),
            inner: NSColor(srgbRed: 0.94, green: 0.81, blue: 0.96, alpha: 1),
            cheek: NSColor(srgbRed: 0.80, green: 0.52, blue: 0.86, alpha: 0.40),
            ink:   NSColor(srgbRed: 0.16, green: 0.19, blue: 0.35, alpha: 1)),
    Palette(name: "Cocoa",
            body:  NSColor(srgbRed: 0.65, green: 0.49, blue: 0.39, alpha: 1),
            shade: NSColor(srgbRed: 0.47, green: 0.34, blue: 0.26, alpha: 1),
            inner: NSColor(srgbRed: 0.95, green: 0.73, blue: 0.67, alpha: 1),
            cheek: NSColor(srgbRed: 0.99, green: 0.58, blue: 0.53, alpha: 0.35),
            ink:   NSColor(srgbRed: 0.15, green: 0.10, blue: 0.08, alpha: 1)),
]

// ───────────────────────────────── model ─────────────────────────────────

enum Species: String, CaseIterable {
    case cat, dog
    var label: String { self == .cat ? "Cat 🐱" : "Dog 🐶" }
}

enum EyeMode { case open, blink, happy, sleepy, wide, dizzy }
enum MouthMode { case neutral, smile, open, snooze, yawn }

struct Particle {
    enum Kind { case heart, zzz, glyph }
    var kind: Kind
    var x: CGFloat
    var y: CGFloat
    var vx: CGFloat
    var vy: CGFloat
    var life: CGFloat
    var maxLife: CGFloat
    var size: CGFloat
    var text: String = ""
}

/// Little bits of furniture the pet can bring on stage.
struct Props: OptionSet {
    let rawValue: Int
    static let desk  = Props(rawValue: 1 << 0)
    static let book  = Props(rawValue: 1 << 1)
    static let glass = Props(rawValue: 1 << 2)
}

/// Each of these is performed with total conviction.
enum SillyAct: CaseIterable {
    case dance, moonwalk, faint, downwardDog, loaf, bow
    var duration: CGFloat {
        switch self {
        case .dance: return 3.2
        case .moonwalk: return 2.8
        case .faint: return 3.0
        case .downwardDog: return 2.6
        case .loaf: return 4.5
        case .bow: return 2.2
        }
    }
}

struct PetLook {
    var palette: Palette
    var species: Species = .cat
    var breath: CGFloat = 0        // -1…1
    var squashX: CGFloat = 1
    var squashY: CGFloat = 1
    var facing: CGFloat = 1        // +1 right, -1 left
    var eyes: EyeMode = .open
    var mouth: MouthMode = .smile
    var pupil: CGPoint = .zero
    var walkPhase: CGFloat = 0
    var isWalking = false
    var isSitting = false
    var tailSway: CGFloat = 0
    var earTilt: CGFloat = 0
    var lift: CGFloat = 0          // vertical offset above ground
    var shadowScale: CGFloat = 1
    var showShadow = true
    var spin: CGFloat = 0          // radians, screen space — the somersault
    var tuck: CGFloat = 1          // curls up a little mid-flip
    var particles: [Particle] = []
    var lean: CGFloat = 0          // whole-body tilt, screen space — curious, peeking, bowing
    var pawUp: CGFloat = 0         // 0…1, near front paw raised — grooming, waving, holding things
    var stretchAmt: CGFloat = 0    // 0…1, the long luxurious stretch
    var sign: String? = nil        // a held-up placard
    var signBob: CGFloat = 0
    var props: Props = []
    var toy: CGPoint? = nil        // laser dot / ball, in view space
    var shoutText: String? = nil
    var shoutAge: CGFloat = 0
    var shoutLife: CGFloat = 2.1
}

// ───────────────────────────────── drawing ─────────────────────────────────

let bodyGlow: NSImage = {
    let s = NSSize(width: 96, height: 96)
    let img = NSImage(size: s)
    img.lockFocus()
    NSGradient(colors: [NSColor(white: 1, alpha: 0.34), NSColor(white: 1, alpha: 0)])?
        .draw(in: NSRect(origin: .zero, size: s), relativeCenterPosition: .zero)
    img.unlockFocus()
    return img
}()

let canvas: CGFloat = 170       // window / view is canvas × canvas
let groundY: CGFloat = 18       // where the feet rest, in view coords
let bodyW: CGFloat = 66
let bodyH: CGFloat = 58

private func blobPath(cx: CGFloat, y0: CGFloat, w: CGFloat, h: CGFloat) -> NSBezierPath {
    let p = NSBezierPath()
    let bw = w / 2, tw = w * 0.41
    p.move(to: CGPoint(x: cx, y: y0))
    p.curve(to: CGPoint(x: cx + bw, y: y0 + h * 0.36),
            controlPoint1: CGPoint(x: cx + bw * 0.62, y: y0),
            controlPoint2: CGPoint(x: cx + bw, y: y0 + h * 0.10))
    p.curve(to: CGPoint(x: cx, y: y0 + h),
            controlPoint1: CGPoint(x: cx + bw, y: y0 + h * 0.80),
            controlPoint2: CGPoint(x: cx + tw, y: y0 + h))
    p.curve(to: CGPoint(x: cx - bw, y: y0 + h * 0.36),
            controlPoint1: CGPoint(x: cx - tw, y: y0 + h),
            controlPoint2: CGPoint(x: cx - bw, y: y0 + h * 0.80))
    p.curve(to: CGPoint(x: cx, y: y0),
            controlPoint1: CGPoint(x: cx - bw, y: y0 + h * 0.10),
            controlPoint2: CGPoint(x: cx - bw * 0.62, y: y0))
    p.close()
    return p
}

private func earPath(cx: CGFloat, y0: CGFloat, w: CGFloat, h: CGFloat,
                     side: CGFloat, tilt: CGFloat, scale: CGFloat) -> NSBezierPath {
    let baseIn  = CGPoint(x: cx + side * w * 0.08, y: y0 + h * 0.80)
    let baseOut = CGPoint(x: cx + side * w * 0.42, y: y0 + h * 0.66)
    let tip     = CGPoint(x: cx + side * (w * 0.34 + tilt * 4), y: y0 + h * (1.12 + tilt * 0.03))
    let mid = CGPoint(x: (baseIn.x + baseOut.x) / 2, y: (baseIn.y + baseOut.y) / 2)
    func s(_ pt: CGPoint) -> CGPoint {
        CGPoint(x: mid.x + (pt.x - mid.x) * scale, y: mid.y + (pt.y - mid.y) * scale)
    }
    let a = s(baseIn), b = s(tip), c = s(baseOut)
    let p = NSBezierPath()
    p.move(to: a)
    p.curve(to: b, controlPoint1: CGPoint(x: a.x, y: a.y + (b.y - a.y) * 0.5),
                   controlPoint2: CGPoint(x: b.x - side * 3, y: b.y - (b.y - a.y) * 0.25))
    p.curve(to: c, controlPoint1: CGPoint(x: b.x + side * 3, y: b.y - (b.y - c.y) * 0.25),
                   controlPoint2: CGPoint(x: c.x + side * 2, y: c.y + (b.y - c.y) * 0.45))
    p.close()
    return p
}

private func heartPath(_ c: CGPoint, _ s: CGFloat) -> NSBezierPath {
    let p = NSBezierPath()
    p.move(to: CGPoint(x: c.x, y: c.y - s * 0.52))
    p.curve(to: CGPoint(x: c.x - s * 0.55, y: c.y + s * 0.22),
            controlPoint1: CGPoint(x: c.x - s * 0.34, y: c.y - s * 0.18),
            controlPoint2: CGPoint(x: c.x - s * 0.55, y: c.y - s * 0.06))
    p.curve(to: CGPoint(x: c.x, y: c.y + s * 0.46),
            controlPoint1: CGPoint(x: c.x - s * 0.55, y: c.y + s * 0.54),
            controlPoint2: CGPoint(x: c.x - s * 0.16, y: c.y + s * 0.58))
    p.curve(to: CGPoint(x: c.x + s * 0.55, y: c.y + s * 0.22),
            controlPoint1: CGPoint(x: c.x + s * 0.16, y: c.y + s * 0.58),
            controlPoint2: CGPoint(x: c.x + s * 0.55, y: c.y + s * 0.54))
    p.curve(to: CGPoint(x: c.x, y: c.y - s * 0.52),
            controlPoint1: CGPoint(x: c.x + s * 0.55, y: c.y - s * 0.06),
            controlPoint2: CGPoint(x: c.x + s * 0.34, y: c.y - s * 0.18))
    p.close()
    return p
}

func drawPet(_ l: PetLook, in size: NSSize) {
    guard let ctx = NSGraphicsContext.current?.cgContext else { return }
    let pal = l.palette
    let cx = size.width / 2
    let breathe = 1 + l.breath * 0.022
    let bob = l.isWalking ? abs(sin(l.walkPhase)) * 2.2 : 0
    let sit: CGFloat = l.isSitting ? 0.90 : 1.0

    // ── ground shadow (stays put while the body moves) ──
    let ss = l.showShadow ? max(0.35, l.shadowScale) : 0
    let sw = bodyW * 0.80 * ss, sh = 9 * ss
    if ss > 0 {
        NSColor(white: 0, alpha: 0.13 * ss).setFill()
        NSBezierPath(ovalIn: NSRect(x: cx - sw / 2, y: groundY - sh / 2 - 1, width: sw, height: sh)).fill()
    }

    ctx.saveGState()
    ctx.translateBy(x: 0, y: l.lift + bob)
    if l.spin != 0 || l.tuck != 1 {
        // Spin about the middle of the body, not the feet, or the somersault
        // reads as the pet being swung around on a stick.
        let pivot = groundY + bodyH * 0.45
        ctx.translateBy(x: cx, y: pivot)
        ctx.rotate(by: l.spin)
        ctx.scaleBy(x: l.tuck, y: l.tuck)
        ctx.translateBy(x: -cx, y: -pivot)
    }
    if l.lean != 0 {
        ctx.translateBy(x: cx, y: groundY)
        ctx.rotate(by: l.lean)
        ctx.translateBy(x: -cx, y: -groundY)
    }
    ctx.translateBy(x: cx, y: groundY)
    ctx.scaleBy(x: l.squashX * l.facing, y: l.squashY * breathe * sit)
    ctx.translateBy(x: -cx, y: -groundY)

    let outline = pal.shade

    // ── tail (behind everything) ──
    let tail = NSBezierPath()
    let sway = l.tailSway
    if l.species == .dog {
        // Carried high and perky — a low tail would be swallowed by the floppy
        // ear, which covers x +12..+49 between y 10 and y 49.
        tail.move(to: CGPoint(x: cx + bodyW * 0.22, y: groundY + bodyH * 0.34))
        tail.curve(to: CGPoint(x: cx + bodyW * (0.58 + sway * 0.08), y: groundY + bodyH * (0.94 + sway * 0.03)),
                   controlPoint1: CGPoint(x: cx + bodyW * 0.52, y: groundY + bodyH * 0.40),
                   controlPoint2: CGPoint(x: cx + bodyW * (0.70 + sway * 0.07), y: groundY + bodyH * 0.72))
        tail.lineCapStyle = .round
        outline.setStroke(); tail.lineWidth = 14; tail.stroke()
        pal.body.setStroke(); tail.lineWidth = 10.5; tail.stroke()
    } else {
        tail.move(to: CGPoint(x: cx + bodyW * 0.30, y: groundY + bodyH * 0.16))
        tail.curve(to: CGPoint(x: cx + bodyW * 0.68 + sway * 3, y: groundY + bodyH * (0.56 + sway * 0.05)),
                   controlPoint1: CGPoint(x: cx + bodyW * 0.58, y: groundY + bodyH * 0.08),
                   controlPoint2: CGPoint(x: cx + bodyW * (0.74 + sway * 0.04), y: groundY + bodyH * 0.26))
        tail.lineWidth = 8
        tail.lineCapStyle = .round
        outline.setStroke(); tail.lineWidth = 11; tail.stroke()
        pal.body.setStroke(); tail.lineWidth = 8; tail.stroke()
    }

    // ── ears (behind the body so only the tips show) ──
    if l.species == .dog {
        // Floppy ears, splayed outward from behind the head so they droop past
        // the cheeks. A touch darker than the body, the way a lot of dogs are.
        let earFill = pal.body.blended(withFraction: 0.42, of: pal.shade) ?? pal.body
        for side in [CGFloat(-1), 1] {
            ctx.saveGState()
            ctx.translateBy(x: cx + side * bodyW * 0.34, y: groundY + bodyH * 0.84)
            ctx.rotate(by: side * (0.40 + l.earTilt * 0.10))
            let ew = bodyW * 0.30, eh = bodyH * 0.72
            let e = NSBezierPath(ovalIn: NSRect(x: -ew / 2, y: -eh, width: ew, height: eh))
            outline.setStroke(); e.lineWidth = 5; e.stroke()
            earFill.setFill(); e.fill()
            ctx.restoreGState()
        }
    } else {
        for side in [CGFloat(-1), 1] {
            let e = earPath(cx: cx, y0: groundY, w: bodyW, h: bodyH,
                            side: side, tilt: l.earTilt * side, scale: 1)
            outline.setStroke(); e.lineWidth = 5; e.lineJoinStyle = .round; e.stroke()
            pal.body.setFill(); e.fill()
            let inner = earPath(cx: cx, y0: groundY, w: bodyW, h: bodyH,
                                side: side, tilt: l.earTilt * side, scale: 0.52)
            pal.inner.setFill(); inner.fill()
        }
    }

    // ── body ──
    let body = blobPath(cx: cx, y0: groundY, w: bodyW, h: bodyH)
    outline.setStroke(); body.lineWidth = 4.5; body.stroke()
    pal.body.setFill(); body.fill()

    // soft highlight for volume
    ctx.saveGState()
    body.addClip()
    bodyGlow.draw(in: NSRect(x: cx - bodyW * 0.56, y: groundY + bodyH * 0.34,
                             width: bodyW * 0.74, height: bodyH * 0.66))
    ctx.restoreGState()

    // ── feet ──
    let footLift = l.isWalking ? sin(l.walkPhase) * 3 : 0
    let spread = bodyW * ((l.isSitting ? 0.26 : 0.21) + l.stretchAmt * 0.13)
    for (i, side) in [CGFloat(-1), 1].enumerated() {
        let lift = l.isWalking ? (i == 0 ? max(0, footLift) : max(0, -footLift)) : 0
        let fx = cx + side * spread + (l.isWalking ? lift * side * 0.6 : 0) + l.stretchAmt * 11
        // The raised paw is drawn later, in front of the face — a paw tucked
        // behind the eyes reads as a mistake rather than as grooming.
        if side > 0, l.pawUp > 0.05 { continue }
        let r = NSRect(x: fx - 8, y: groundY - 3.5 + lift, width: 16, height: 9)
        let f = NSBezierPath(ovalIn: r)
        outline.setStroke(); f.lineWidth = 3.5; f.stroke()
        pal.body.setFill(); f.fill()
    }

    // ── face ──
    let eyeY = groundY + bodyH * 0.55
    let eyeDX = bodyW * 0.185
    pal.ink.setFill(); pal.ink.setStroke()

    for side in [CGFloat(-1), 1] {
        let ex = cx + side * eyeDX
        switch l.eyes {
        case .open, .wide:
            let ew: CGFloat = l.eyes == .wide ? 10.5 : 9.5
            let eh: CGFloat = l.eyes == .wide ? 13.0 : 11.5
            NSBezierPath(ovalIn: NSRect(x: ex - ew / 2 + l.pupil.x, y: eyeY - eh / 2 + l.pupil.y,
                                        width: ew, height: eh)).fill()
            NSColor(white: 1, alpha: 0.95).setFill()
            NSBezierPath(ovalIn: NSRect(x: ex - ew / 2 + l.pupil.x + ew * 0.18,
                                        y: eyeY + l.pupil.y + eh * 0.10,
                                        width: 3.4, height: 3.4)).fill()
            pal.ink.setFill()
        case .blink, .sleepy:
            let p = NSBezierPath()
            p.move(to: CGPoint(x: ex - 5.2, y: eyeY + 1.4))
            p.curve(to: CGPoint(x: ex + 5.2, y: eyeY + 1.4),
                    controlPoint1: CGPoint(x: ex - 2.4, y: eyeY - 3.0),
                    controlPoint2: CGPoint(x: ex + 2.4, y: eyeY - 3.0))
            p.lineWidth = 2.6; p.lineCapStyle = .round; p.stroke()
        case .dizzy:
            let p = NSBezierPath()
            let r: CGFloat = 4.6
            p.move(to: CGPoint(x: ex - r, y: eyeY - r)); p.line(to: CGPoint(x: ex + r, y: eyeY + r))
            p.move(to: CGPoint(x: ex - r, y: eyeY + r)); p.line(to: CGPoint(x: ex + r, y: eyeY - r))
            p.lineWidth = 2.6; p.lineCapStyle = .round; p.stroke()
        case .happy:
            let p = NSBezierPath()
            p.move(to: CGPoint(x: ex - 5.2, y: eyeY - 1.8))
            p.curve(to: CGPoint(x: ex + 5.2, y: eyeY - 1.8),
                    controlPoint1: CGPoint(x: ex - 2.4, y: eyeY + 4.2),
                    controlPoint2: CGPoint(x: ex + 2.4, y: eyeY + 4.2))
            p.lineWidth = 2.8; p.lineCapStyle = .round; p.stroke()
        }
    }

    // cheeks
    pal.cheek.setFill()
    for side in [CGFloat(-1), 1] {
        NSBezierPath(ovalIn: NSRect(x: cx + side * bodyW * 0.33 - 6, y: eyeY - 12,
                                    width: 12, height: 7.5)).fill()
    }

    // mouth
    if l.species == .dog {
        let mzY = eyeY - 11.5
        // muzzle patch
        (pal.body.blended(withFraction: 0.55, of: .white) ?? pal.body).setFill()
        NSBezierPath(ovalIn: NSRect(x: cx - 14, y: mzY - 8.5, width: 28, height: 17)).fill()

        // nose, sat at the top of the muzzle
        pal.ink.setFill()
        NSBezierPath(ovalIn: NSRect(x: cx - 4.8, y: mzY + 1.0, width: 9.6, height: 7.0)).fill()

        pal.ink.setStroke()
        let ny = mzY + 1.0
        switch l.mouth {
        case .smile, .neutral:
            let dip: CGFloat = l.mouth == .smile ? 3.0 : 1.5
            let stem = NSBezierPath()
            stem.move(to: CGPoint(x: cx, y: ny))
            stem.line(to: CGPoint(x: cx, y: ny - 3.2))
            stem.lineWidth = 2.0; stem.lineCapStyle = .round; stem.stroke()
            let m = NSBezierPath()
            m.move(to: CGPoint(x: cx - 6.5, y: ny - 1.8))
            m.curve(to: CGPoint(x: cx, y: ny - 3.2), controlPoint1: CGPoint(x: cx - 4.0, y: ny - 3.2 - dip),
                                                     controlPoint2: CGPoint(x: cx - 1.6, y: ny - 3.2 - dip * 0.3))
            m.curve(to: CGPoint(x: cx + 6.5, y: ny - 1.8), controlPoint1: CGPoint(x: cx + 1.6, y: ny - 3.2 - dip * 0.3),
                                                            controlPoint2: CGPoint(x: cx + 4.0, y: ny - 3.2 - dip))
            m.lineWidth = 2.0; m.lineCapStyle = .round; m.stroke()
        case .open:
            pal.ink.setFill()
            NSBezierPath(ovalIn: NSRect(x: cx - 5.2, y: mzY - 7.2, width: 10.4, height: 9.0)).fill()
            // tongue, lolling out below the muzzle
            NSColor(srgbRed: 1.00, green: 0.50, blue: 0.54, alpha: 1).setFill()
            NSBezierPath(ovalIn: NSRect(x: cx - 3.4, y: mzY - 11.0, width: 6.8, height: 7.5)).fill()
        case .snooze:
            pal.ink.setFill()
            NSBezierPath(ovalIn: NSRect(x: cx - 3.0, y: mzY - 5.0, width: 6.0, height: 6.0)).fill()
        case .yawn:
            pal.ink.setFill()
            NSBezierPath(ovalIn: NSRect(x: cx - 6.0, y: mzY - 10.8, width: 12.0, height: 13.8)).fill()
            NSColor(srgbRed: 1.00, green: 0.50, blue: 0.54, alpha: 1).setFill()
            NSBezierPath(ovalIn: NSRect(x: cx - 3.2, y: mzY - 9.2, width: 6.4, height: 5.8)).fill()
        }
    } else {
        pal.ink.setStroke()
        let my = eyeY - 9.5
        switch l.mouth {
        case .smile, .neutral:
            let p = NSBezierPath()
            let dip: CGFloat = l.mouth == .smile ? 3.2 : 1.6
            p.move(to: CGPoint(x: cx - 5.5, y: my + 1.6))
            p.curve(to: CGPoint(x: cx, y: my), controlPoint1: CGPoint(x: cx - 3.4, y: my - dip),
                                              controlPoint2: CGPoint(x: cx - 1.4, y: my - dip))
            p.curve(to: CGPoint(x: cx + 5.5, y: my + 1.6), controlPoint1: CGPoint(x: cx + 1.4, y: my - dip),
                                                           controlPoint2: CGPoint(x: cx + 3.4, y: my - dip))
            p.lineWidth = 2.2; p.lineCapStyle = .round; p.stroke()
        case .open:
            pal.ink.setFill()
            let p = NSBezierPath(ovalIn: NSRect(x: cx - 4.2, y: my - 4.4, width: 8.4, height: 8.0))
            p.fill()
            pal.inner.setFill()
            NSBezierPath(ovalIn: NSRect(x: cx - 2.2, y: my - 3.6, width: 4.4, height: 3.4)).fill()
        case .snooze:
            let p = NSBezierPath(ovalIn: NSRect(x: cx - 3.0, y: my - 3.4, width: 6.0, height: 6.4))
            pal.ink.setFill(); p.fill()
        case .yawn:
            pal.ink.setFill()
            NSBezierPath(ovalIn: NSRect(x: cx - 5.6, y: my - 9.8, width: 11.2, height: 14.2)).fill()
            NSColor(srgbRed: 1.00, green: 0.50, blue: 0.54, alpha: 1).setFill()
            NSBezierPath(ovalIn: NSRect(x: cx - 3.0, y: my - 8.2, width: 6.0, height: 5.6)).fill()
        }

    }
    // ── the raised paw, over the face: grooming, waving, holding a glass up ──
    if l.pawUp > 0.05 {
        let py = groundY - 3.5 + l.pawUp * 20
        let px = (cx + spread) + ((cx + 11) - (cx + spread)) * l.pawUp * 0.8
        let paw = NSBezierPath(ovalIn: NSRect(x: px - 8, y: py, width: 16, height: 9.5))
        outline.setStroke(); paw.lineWidth = 3.5; paw.stroke()
        pal.body.setFill(); paw.fill()
    }

    ctx.restoreGState()

    // ── furniture and hand-props, in front of the pet ──
    if l.props.contains(.desk)  { drawDesk(in: size) }
    // on the desktop if there's a desk under it, otherwise held up in both paws
    if l.props.contains(.book)  { drawBook(in: size, base: l.props.contains(.desk) ? groundY + 26 : groundY + 17) }
    if l.props.contains(.glass) { drawGlass(in: size, facing: l.facing) }
    if let toy = l.toy          { drawToy(toy, species: l.species) }

    // ── particles (drawn in view space, unaffected by squash) ──
    for p in l.particles {
        let a = min(1, p.life / (p.maxLife * 0.55))
        switch p.kind {
        case .heart:
            NSColor(srgbRed: 1.0, green: 0.42, blue: 0.48, alpha: a * 0.95).setFill()
            heartPath(CGPoint(x: p.x, y: p.y), p.size).fill()
        case .glyph:
            let g = NSAttributedString(string: p.text, attributes: [
                .font: NSFont.systemFont(ofSize: p.size, weight: .heavy),
                .foregroundColor: pal.ink.withAlphaComponent(a * 0.80),
            ])
            g.draw(at: CGPoint(x: p.x, y: p.y))
        case .zzz:
            let s = NSAttributedString(string: "z", attributes: [
                .font: NSFont.systemFont(ofSize: p.size, weight: .heavy),
                .foregroundColor: pal.ink.withAlphaComponent(a * 0.75),
            ])
            s.draw(at: CGPoint(x: p.x, y: p.y))
        }
    }

    if let sign = l.sign { drawSign(sign, bob: l.signBob, in: size, pal: pal) }

    if let shout = l.shoutText {
        drawShout(shout, age: l.shoutAge, life: l.shoutLife, in: size)
    }
}

private let wood     = NSColor(srgbRed: 0.72, green: 0.53, blue: 0.36, alpha: 1)
private let woodDark = NSColor(srgbRed: 0.54, green: 0.37, blue: 0.23, alpha: 1)

/// A miniature writing desk. Drawn in front, so the pet reads as sitting at it.
func drawDesk(in size: NSSize) {
    let cx = size.width / 2
    woodDark.setFill()
    for side in [CGFloat(-1), 1] {
        NSBezierPath(roundedRect: NSRect(x: cx + side * 40 - 3, y: groundY - 2, width: 6, height: 23),
                     xRadius: 2, yRadius: 2).fill()
    }
    let top = NSBezierPath(roundedRect: NSRect(x: cx - 50, y: groundY + 18, width: 100, height: 9),
                           xRadius: 3.5, yRadius: 3.5)
    woodDark.setStroke(); top.lineWidth = 3; top.stroke()
    wood.setFill(); top.fill()

    // a mug on the desk — the scene reads as "settled in" without needing a book
    let mx = cx + 32, my = groundY + 27
    let handle = NSBezierPath(ovalIn: NSRect(x: mx + 3.5, y: my + 2.5, width: 7, height: 7))
    NSColor(white: 0.35, alpha: 0.9).setStroke(); handle.lineWidth = 2; handle.stroke()
    let mug = NSBezierPath(roundedRect: NSRect(x: mx - 5.5, y: my, width: 11, height: 12),
                           xRadius: 2, yRadius: 2)
    NSColor(white: 0.30, alpha: 0.9).setStroke(); mug.lineWidth = 2; mug.stroke()
    NSColor(srgbRed: 0.96, green: 0.97, blue: 0.99, alpha: 1).setFill(); mug.fill()
    NSColor(srgbRed: 0.55, green: 0.38, blue: 0.26, alpha: 1).setFill()
    NSRect(x: mx - 4, y: my + 8, width: 8, height: 2.6).fill()
}

/// An open book, tented on the desktop.
func drawBook(in size: NSSize, base: CGFloat) {
    let cx = size.width / 2
    let page = NSColor(srgbRed: 0.99, green: 0.98, blue: 0.94, alpha: 1)
    let edge = NSColor(srgbRed: 0.60, green: 0.42, blue: 0.55, alpha: 1)
    for side in [CGFloat(-1), 1] {
        let p = NSBezierPath()
        p.move(to: CGPoint(x: cx, y: base + 9))
        p.line(to: CGPoint(x: cx + side * 21, y: base + 4))
        p.line(to: CGPoint(x: cx + side * 19, y: base - 3))
        p.line(to: CGPoint(x: cx, y: base + 1))
        p.close()
        edge.setStroke(); p.lineWidth = 2.2; p.lineJoinStyle = .round; p.stroke()
        page.setFill(); p.fill()
        // a couple of lines of "text"
        NSColor(white: 0.62, alpha: 0.9).setStroke()
        for k in 0..<2 {
            let ln = NSBezierPath()
            let dy = CGFloat(k) * 3.0
            ln.move(to: CGPoint(x: cx + side * 5, y: base + 4.5 - dy))
            ln.line(to: CGPoint(x: cx + side * 16, y: base + 2.0 - dy))
            ln.lineWidth = 1.0; ln.stroke()
        }
    }
}

/// A miniature glass of water, held out to one side.
func drawGlass(in size: NSSize, facing: CGFloat) {
    guard let ctx = NSGraphicsContext.current?.cgContext else { return }
    let cx = size.width / 2
    let gx = cx + facing * 36, by = groundY + 19
    let w: CGFloat = 15, h: CGFloat = 21
    let g = NSBezierPath()
    g.move(to: CGPoint(x: gx - w / 2, y: by + h))
    g.line(to: CGPoint(x: gx - w / 2 + 2.4, y: by))
    g.line(to: CGPoint(x: gx + w / 2 - 2.4, y: by))
    g.line(to: CGPoint(x: gx + w / 2, y: by + h))
    g.close()
    ctx.saveGState()
    g.addClip()
    NSColor(srgbRed: 0.45, green: 0.76, blue: 0.96, alpha: 0.80).setFill()
    NSRect(x: gx - w, y: by, width: w * 2, height: h * 0.62).fill()
    ctx.restoreGState()
    NSColor(white: 0.32, alpha: 0.55).setStroke(); g.lineWidth = 2.4; g.stroke()
    NSColor(white: 1, alpha: 0.65).setFill()
    NSRect(x: gx - w / 2 + 3.2, y: by + 4, width: 2.0, height: h * 0.5).fill()
}

/// The laser dot (cat) or the ball (dog).
func drawToy(_ pt: CGPoint, species: Species) {
    if species == .cat {
        let rings: [(CGFloat, CGFloat)] = [(10, 0.14), (6.2, 0.30), (3.2, 1.0)]
        for (r, a) in rings {
            NSColor(srgbRed: 1.0, green: 0.16, blue: 0.20, alpha: a).setFill()
            NSBezierPath(ovalIn: NSRect(x: pt.x - r, y: pt.y - r, width: r * 2, height: r * 2)).fill()
        }
    } else {
        let r: CGFloat = 9
        let b = NSBezierPath(ovalIn: NSRect(x: pt.x - r, y: pt.y - r, width: r * 2, height: r * 2))
        NSColor(srgbRed: 0.86, green: 0.31, blue: 0.28, alpha: 1).setFill(); b.fill()
        NSColor(srgbRed: 0.60, green: 0.18, blue: 0.16, alpha: 1).setStroke(); b.lineWidth = 2.2; b.stroke()
        NSColor(white: 1, alpha: 0.55).setFill()
        NSBezierPath(ovalIn: NSRect(x: pt.x - r * 0.5, y: pt.y + r * 0.05, width: r * 0.6, height: r * 0.45)).fill()
    }
}

private var signCache: [String: NSAttributedString] = [:]

private func signString(_ text: String, fitting width: CGFloat) -> NSAttributedString {
    let key = "\(text)|\(Int(width))"
    if let hit = signCache[key] { return hit }
    var pt: CGFloat = 15
    func make(_ p: CGFloat) -> NSAttributedString {
        NSAttributedString(string: text, attributes: [
            .font: NSFont.systemFont(ofSize: p, weight: .bold),
            .foregroundColor: NSColor(srgbRed: 0.20, green: 0.18, blue: 0.22, alpha: 1),
        ])
    }
    while pt > 8, make(pt).size().width > width { pt -= 0.5 }
    let s = make(pt)
    signCache[key] = s
    return s
}

/// A little placard held up over the pet's head.
func drawSign(_ text: String, bob: CGFloat, in size: NSSize, pal: Palette) {
    let cx = size.width / 2
    let str = signString(text, fitting: size.width - 46)
    let sz = str.size()
    let w = sz.width + 22, h = sz.height + 13
    let y = groundY + bodyH + 28 + bob * 1.6

    woodDark.setStroke()
    let stick = NSBezierPath()
    stick.move(to: CGPoint(x: cx, y: y + 2)); stick.line(to: CGPoint(x: cx, y: y - 22))
    stick.lineWidth = 4; stick.lineCapStyle = .round; stick.stroke()

    let board = NSBezierPath(roundedRect: NSRect(x: cx - w / 2, y: y, width: w, height: h),
                             xRadius: 5, yRadius: 5)
    NSColor(white: 0.28, alpha: 1).setStroke(); board.lineWidth = 3; board.stroke()
    NSColor(srgbRed: 1.0, green: 0.99, blue: 0.95, alpha: 1).setFill(); board.fill()
    str.draw(at: CGPoint(x: cx - sz.width / 2, y: y + 6.5))
}

// A silent shout: no sound is ever played, you just see the word.
let shoutFont: NSFont = {
    let base = NSFont.systemFont(ofSize: 16, weight: .black)
    if let d = base.fontDescriptor.withDesign(.rounded), let f = NSFont(descriptor: d, size: 16) {
        return f
    }
    return base
}()

/// Laying the phrase out is identical every frame — only the alpha and the
/// transform change — so build it once and reuse it. Rebuilding it per frame
/// meant up to eighteen text measurements on every tick of a shout.
private var shoutCache: [String: NSAttributedString] = [:]

private func shoutString(_ text: String, fitting width: CGFloat) -> NSAttributedString {
    let key = "\(text)|\(Int(width))"
    if let hit = shoutCache[key] { return hit }

    var pt: CGFloat = 16
    let budget = (width - 14) / 1.15          // headroom for the pop overshoot
    while pt > 8,
          NSAttributedString(string: text, attributes: [.font: NSFont(descriptor: shoutFont.fontDescriptor, size: pt)!])
              .size().width > budget {
        pt -= 0.5
    }

    let str = NSAttributedString(string: text, attributes: [
        .font: NSFont(descriptor: shoutFont.fontDescriptor, size: pt)!,
        .foregroundColor: NSColor(srgbRed: 1.00, green: 0.36, blue: 0.28, alpha: 1),
        .strokeColor: NSColor(white: 1, alpha: 1),
        .strokeWidth: -7.0,
    ])
    shoutCache[key] = str
    return str
}

func drawShout(_ text: String, age: CGFloat, life: CGFloat, in size: NSSize) {
    guard let ctx = NSGraphicsContext.current?.cgContext else { return }

    let grow = min(1, age / 0.16)
    let pop  = sin(min(1, age / 0.34) * .pi) * 0.14
    let scale = 0.55 + 0.45 * grow + pop
    let alpha = min(1, age / 0.06) * min(1, max(0, (life - age) / 0.40))
    guard alpha > 0.01 else { return }

    let str = shoutString(text, fitting: size.width)
    let sz = str.size()

    ctx.saveGState()
    ctx.setAlpha(alpha)                        // fade without rebuilding the string
    let sh = NSShadow()
    sh.shadowColor = NSColor(white: 0, alpha: 0.22)
    sh.shadowBlurRadius = 3
    sh.shadowOffset = NSSize(width: 0, height: -1)
    sh.set()
    ctx.translateBy(x: size.width / 2, y: 146 + age * 4)
    ctx.rotate(by: -0.05 + sin(age * 8) * 0.045)
    ctx.scaleBy(x: scale, y: scale)
    str.draw(at: CGPoint(x: -sz.width / 2, y: -sz.height / 2))
    ctx.restoreGState()
}

// ───────────────────────────────── behavior ─────────────────────────────────

enum PetState {
    case idle, walking, sitting, sleeping, held, falling, happy, dashing, flipping
    case stretching, yawning, grooming, curious          // the quiet life
    case walkingTo, hoppingUp, perching, peeking          // getting about the desktop
    case chasingCursor, chasingToy                        // play
    case atDesk, reading                                  // two separate pastimes
    case silly                                            // see SillyAct
    case careWater, careStretch                           // self-care mode
}

enum WalkGoal { case none, desk, ledge, care }

/// The top edge of somebody else's window — somewhere to sit.
struct Ledge { var minX: CGFloat; var maxX: CGFloat; var y: CGFloat }

/// Window tops the pet can perch on. Geometry and owner names are readable
/// without Screen Recording permission; only titles and images would need it.
func findLedges() -> [Ledge] {
    guard let main = NSScreen.screens.first else { return [] }
    let flip = main.frame.maxY
    let info = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements],
                                          kCGNullWindowID) as? [[String: Any]] ?? []
    var out: [Ledge] = []
    for w in info {
        guard let layer = w[kCGWindowLayer as String] as? Int, layer == 0,
              let owner = w[kCGWindowOwnerName as String] as? String,
              owner != "Pip", owner != "Dock", owner != "Window Server",
              let b = w[kCGWindowBounds as String] as? [String: CGFloat],
              let x = b["X"], let y = b["Y"], let ww = b["Width"], let hh = b["Height"],
              ww >= 240, hh >= 140 else { continue }
        out.append(Ledge(minX: x, maxX: x + ww, y: flip - y))
    }
    return out
}

final class PetView: NSView {
    /// Color changes ONLY when the user asks. The three writers below are the
    /// complete set: the Color menu, the --color flag, and loading the choice
    /// the user already made. Nothing about Pip's behavior — state, mood,
    /// species, time of day — may ever touch this.
    var paletteIndex = defaultPaletteIndex { didSet { needsDisplay = true; persist() } }
    var species: Species = .cat { didSet { needsDisplay = true; persist() } }
    /// Set while loadPrefs() is populating these, so restoring a saved choice
    /// never writes back over the other saved choices on the way through.
    private var loadingPrefs = false
    private func persist() { if !loadingPrefs { savePrefs() } }
    var palette: Palette { palettes[paletteIndex] }
    var stayPut = false

    private var t: CGFloat = 0
    private var state: PetState = .idle
    private var stateTime: CGFloat = 0
    private var stateLen: CGFloat = 3
    private var facing: CGFloat = 1
    private var walkPhase: CGFloat = 0
    private var blinkIn: CGFloat = 2.5
    private var blinkFor: CGFloat = 0
    private var squashY: CGFloat = 1
    private var squashVel: CGFloat = 0
    private var lift: CGFloat = 0
    private var vy: CGFloat = 0
    private var throwVX: CGFloat = 0
    private var particles: [Particle] = []
    private var spawnTimer: CGFloat = 0
    private var tick = 0
    private var forceRedraw = true
    private var sillyAct: SillyAct = .dance
    private var walkGoal: WalkGoal = .none
    private var walkTargetX: CGFloat = 0
    private var pendingCare: PetState = .careWater
    private var hopFromY: CGFloat = 0
    private var hopToY: CGFloat = 0
    private var peekX: CGFloat = 0
    private var peekHomeX: CGFloat = 0
    private var toyScreenX: CGFloat = 0
    private var toyY: CGFloat = 0
    private var toyTimer: CGFloat = 0
    var chaseCursor = false
    var selfCareOn = false { didSet { careTimer = careInterval; persist() } }
    private var careTimer: CGFloat = 1500
    private let careInterval: CGFloat = 1500      // ~25 minutes
    private var careIsWater = false
    private var lastMouse = NSPoint.zero
    private var mouseActive: CGFloat = 0

    // zoomies: sprint, then a tucked somersault
    private var flipVY: CGFloat = 0
    private var spin: CGFloat = 0
    private var shoutText: String?
    private var shoutAge: CGFloat = 0
    private let shoutLife: CGFloat = 2.1
    private let flipLaunch: CGFloat = 272     // px/s of lift-off
    private let flipGravity: CGFloat = 800
    private var flipAirtime: CGFloat { 2 * flipLaunch / flipGravity }

    private var dragOrigin: CGPoint = .zero
    private var dragMouse: CGPoint = .zero
    private var lastDragX: CGFloat = 0
    private var didDrag = false

    override var isFlipped: Bool { false }
    override var acceptsFirstResponder: Bool { true }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    /// Remember the animal and color so the choice survives a relaunch —
    /// otherwise picking "Dog" only lasts until the next login.
    func savePrefs() {
        let d = UserDefaults.standard
        d.set(species.rawValue, forKey: "pip.species")
        d.set(paletteIndex, forKey: "pip.palette")
        d.set(selfCareOn, forKey: "pip.selfcare")
    }

    func loadPrefs() {
        // Each assignment below fires didSet, and savePrefs() writes all three
        // keys from whatever is in memory at that moment. Restoring the palette
        // would therefore persist the *default* species over a saved one if the
        // species read had missed. Suppress writes until the load is finished.
        loadingPrefs = true
        defer { loadingPrefs = false }

        let d = UserDefaults.standard

        // v1 wrote pip.palette on every save, even when the user had never picked
        // a color — so a stored 0 from that era is indistinguishable from the old
        // default and is almost certainly an artifact. Drop just that value once,
        // so the new default applies; a deliberate pick of any other color stays.
        if d.integer(forKey: "pip.prefsVersion") < 2 {
            if d.object(forKey: "pip.palette") as? Int == 0 { d.removeObject(forKey: "pip.palette") }
            d.set(2, forKey: "pip.prefsVersion")
        }

        if let raw = d.string(forKey: "pip.species"), let sp = Species(rawValue: raw) { species = sp }
        // `object(forKey:)`, not `integer(forKey:)` — a real choice of Cream is 0,
        // and integer(forKey:) returns 0 for "absent" too, which would silently
        // override the user and change the color on them.
        if let stored = d.object(forKey: "pip.palette") as? Int,
           stored >= 0, stored < palettes.count {
            paletteIndex = stored
        }
        selfCareOn = d.bool(forKey: "pip.selfcare")
    }

    // ── ground reference for the screen we're currently on ──
    private var screenGround: CGFloat {
        let scr = window?.screen ?? NSScreen.main
        return (scr?.visibleFrame.minY ?? 0) + 4 - groundY
    }

    func step(_ dt: CGFloat) {
        if let win = window, !win.occlusionState.contains(.visible), state == .sleeping { return }
        t += dt
        stateTime += dt

        let m = NSEvent.mouseLocation
        if abs(m.x - lastMouse.x) + abs(m.y - lastMouse.y) > 1.5 {
            lastMouse = m
            mouseActive = 0.5
        } else {
            mouseActive = max(0, mouseActive - dt)
        }

        // blinking
        if blinkFor > 0 {
            blinkFor -= dt
        } else {
            blinkIn -= dt
            if blinkIn <= 0 { blinkFor = 0.12; blinkIn = .random(in: 2.0...6.5); forceRedraw = true }
        }

        // squash spring back to 1
        let k: CGFloat = 190, damp: CGFloat = 14
        squashVel += (1 - squashY) * k * dt - squashVel * damp * dt
        squashY += squashVel * dt

        switch state {
        case .walking:
            walkPhase += dt * 8.5
            move(dx: facing * 34 * dt)
            if stateTime > stateLen { chooseNext() }
        case .idle, .sitting:
            if stateTime > stateLen { chooseNext() }
        case .sleeping:
            spawnTimer -= dt
            if spawnTimer <= 0 {
                spawnTimer = 1.1
                particles.append(Particle(kind: .zzz,
                                          x: canvas / 2 + 16, y: groundY + bodyH * 0.95,
                                          vx: 9, vy: 15, life: 2.6, maxLife: 2.6, size: 13))
            }
            if stateTime > stateLen { chooseNext() }
        case .happy:
            if stateTime > 1.7 { chooseNext() }
        case .dashing:
            walkPhase += dt * 21
            move(dx: facing * 178 * dt, bounce: false)
            if stateTime > stateLen { launchFlip() }
        case .flipping:
            flipVY -= flipGravity * dt
            lift += flipVY * dt
            move(dx: facing * 152 * dt, bounce: false)
            // Drive the rotation off elapsed time rather than accumulating it,
            // so it always comes back round to upright on touchdown.
            spin = -2 * .pi * min(1, stateTime / flipAirtime) * facing
            if lift <= 0, stateTime > 0.1 {
                lift = 0; spin = 0; flipVY = 0
                squashY = 0.66; squashVel = 0
                setState(.idle, len: .random(in: 0.9...1.8))
            }
        case .stretching, .yawning, .grooming, .curious, .careStretch, .careWater, .atDesk, .reading:
            if stateTime > stateLen { chooseNext() }

        case .silly:
            if sillyAct == .moonwalk { move(dx: -facing * 26 * dt); walkPhase += dt * 7 }
            if stateTime > stateLen { chooseNext() }

        case .walkingTo:
            if stepToward(walkTargetX, speed: 46, dt: dt) || stateTime > 9 {
                switch walkGoal {
                case .desk:  setState(.atDesk, len: .random(in: 15...28))
                case .ledge:
                    hopFromY = window?.frame.origin.y ?? 0
                    setState(.hoppingUp, len: 0.55)
                case .care:  setState(pendingCare, len: 8.0)
                case .none:  chooseNext()
                }
            }

        case .hoppingUp:
            if let win = window {
                let p = min(1, stateTime / stateLen)
                let arc = sin(p * .pi) * 30
                win.setFrameOrigin(CGPoint(x: win.frame.origin.x,
                                           y: hopFromY + (hopToY - hopFromY) * p + arc))
                if p >= 1 { setState(.perching, len: .random(in: 8...18)) }
            }

        case .perching:
            if stateTime > stateLen {
                vy = 150                      // hop off and let gravity take it home
                throwVX = facing * 40
                setState(.falling, len: 999)
            }

        case .peeking:
            let out = stateTime < stateLen
            let target = out ? peekX : peekHomeX
            if let win = window {
                let d = target - win.frame.origin.x
                if abs(d) > 2.5 { moveRaw(dx: (d > 0 ? 1 : -1) * min(95 * dt, abs(d))) }
                else if !out { chooseNext() }
            }

        case .chasingCursor:
            let m = NSEvent.mouseLocation
            if let win = window {
                let d = m.x - win.frame.midX
                if abs(d) > 16 {
                    facing = d > 0 ? 1 : -1
                    move(dx: facing * min(180, abs(d) * 2.4) * dt)
                    walkPhase += dt * 12
                }
            }
            if !chaseCursor { chooseNext() }

        case .chasingToy:
            toyTimer -= dt
            if toyTimer <= 0 { pickToySpot() }
            if let win = window {
                let d = toyScreenX - win.frame.midX
                if abs(d) > 10 {
                    facing = d > 0 ? 1 : -1
                    move(dx: facing * min(210, abs(d) * 2.8) * dt)
                    walkPhase += dt * 13
                }
            }
            if stateTime > stateLen { chooseNext() }

        case .held:
            break
        case .falling:
            vy -= 1750 * dt
            moveWindowY(by: vy * dt)
            if throwVX != 0 { move(dx: throwVX * dt); throwVX *= 0.94 }
            if let win = window, win.frame.origin.y <= screenGround {
                var f = win.frame; f.origin.y = screenGround; win.setFrameOrigin(f.origin)
                let impact = min(1, abs(vy) / 900)
                squashY = 1 - 0.30 * impact; squashVel = 0
                vy = 0; throwVX = 0
                setState(.idle, len: .random(in: 1.0...2.0))
            }
        }

        if shoutText != nil {
            shoutAge += dt
            if shoutAge > shoutLife { shoutText = nil }
        }

        // self-care nudges, only when it wouldn't interrupt something
        if selfCareOn {
            careTimer -= dt
            if careTimer <= 0 {
                careTimer = careInterval
                switch state {
                case .idle, .walking, .sitting, .sleeping: startCare()
                default: break                 // try again on the next tick
                }
            }
        }

        // particles
        for i in particles.indices {
            particles[i].life -= dt
            particles[i].x += particles[i].vx * dt
            particles[i].y += particles[i].vy * dt
            particles[i].vx += sin(t * 3 + particles[i].y * 0.1) * 6 * dt
        }
        particles.removeAll { $0.life <= 0 }

        // Only repaint as often as the current behavior actually needs. Walking and
        // being held get every frame; a dozing pet needs far fewer.
        tick += 1
        let every: Int
        switch state {
        // Walking still moves the window every tick, so the glide stays smooth —
        // only the gait itself animates at half rate, which is plenty for two feet.
        case .walking:                          every = 2
        case .happy, .held, .falling:           every = 1
        case .dashing, .flipping:               every = 1
        case .chasingCursor, .chasingToy:       every = 1
        case .hoppingUp, .peeking:              every = 1
        case .silly, .stretching, .yawning,
             .grooming, .careStretch:           every = 2
        case .walkingTo:                        every = 2
        case .curious, .perching, .atDesk,
             .reading, .careWater:              every = 3
        case .sleeping:                         every = 6
        case .idle, .sitting:
            // A standing pet only needs to breathe. Go up to full rate while the
            // cursor is moving so the eyes track it without lag.
            every = (!particles.isEmpty || mouseActive > 0) ? 1 : 3
        }
        let rate = shoutText == nil ? every : 1
        if forceRedraw || tick % rate == 0 || blinkFor > 0 {
            forceRedraw = false
            needsDisplay = true
        }
    }

    private func setState(_ s: PetState, len: CGFloat) {
        state = s; stateTime = 0; stateLen = len; forceRedraw = true
    }

    /// Sprint across the screen and somersault, hollering silently.
    func startZoomies() {
        guard state != .held else { return }
        // Run toward whichever side has more runway.
        if let win = window, let scr = win.screen ?? NSScreen.main {
            facing = (scr.frame.maxX - win.frame.midX) >= (win.frame.midX - scr.frame.minX) ? 1 : -1
        }
        shoutText = "Theragleeeeee!!!"
        shoutAge = 0
        setState(.dashing, len: .random(in: 0.55...0.95))
    }

    private func launchFlip() {
        flipVY = flipLaunch
        lift = 0
        spin = 0
        setState(.flipping, len: 99)
    }

    private func pickToySpot() {
        guard let win = window, let scr = win.screen ?? NSScreen.main else { return }
        toyTimer = .random(in: 0.7...1.3)
        var next = win.frame.midX + .random(in: -80...80)
        next = min(max(next, scr.visibleFrame.minX + 40), scr.visibleFrame.maxX - 40)
        toyScreenX = next
        toyY = species == .cat ? groundY + .random(in: 2...12) : groundY + .random(in: 6...18)
    }

    func startToyChase() {
        pickToySpot()
        setState(.chasingToy, len: .random(in: 7...12))
    }

    func startSilly(_ act: SillyAct? = nil) {
        sillyAct = act ?? SillyAct.allCases.randomElement()!
        setState(.silly, len: sillyAct.duration)
    }

    /// A self-care nudge: bring water over, or model a stretch.
    func startCare() {
        careIsWater.toggle()
        if careIsWater {
            pendingCare = .careWater
            walkGoal = .care
            walkTargetX = NSEvent.mouseLocation.x
            setState(.walkingTo, len: 999)
        } else {
            setState(.careStretch, len: 8.0)
        }
    }

    /// Head for the top edge of one of your windows and sit on it.
    @discardableResult
    func tryPerch() -> Bool {
        guard let win = window, let scr = win.screen ?? NSScreen.main else { return false }
        // The pet needs ~95pt of headroom above a ledge or its ears are cut off by
        // the top of the screen — most window tops sit right up there.
        let lo = scr.visibleFrame.minY + 70, hi = scr.visibleFrame.maxY - 95
        let usable = findLedges().filter { $0.y > lo && $0.y < hi && ($0.maxX - $0.minX) > canvas + 40 }
        guard let pick = usable.min(by: {
            abs(($0.minX + $0.maxX) / 2 - win.frame.midX) < abs(($1.minX + $1.maxX) / 2 - win.frame.midX)
        }) else { return false }
        walkTargetX = min(max(win.frame.midX, pick.minX + canvas * 0.6), pick.maxX - canvas * 0.6)
        hopToY = pick.y - groundY
        walkGoal = .ledge
        setState(.walkingTo, len: 999)
        return true
    }

    /// Slink to a screen edge and lean back in.
    func startPeek() {
        guard let win = window, let scr = win.screen ?? NSScreen.main else { return }
        peekHomeX = win.frame.origin.x
        let left = win.frame.midX < scr.frame.midX
        peekX = left ? scr.frame.minX - canvas * 0.42 : scr.frame.maxX - canvas * 0.58
        facing = left ? 1 : -1
        setState(.peeking, len: .random(in: 3.5...6.5))
    }

    func startReading() {
        setState(.reading, len: .random(in: 12...24))
    }

    func goToDesk() {
        walkGoal = .desk
        walkTargetX = (window?.frame.midX ?? 0) + .random(in: -120...120)
        setState(.walkingTo, len: 999)
    }

    private func chooseNext() {
        if stayPut {
            setState(Bool.random() ? .idle : .sitting, len: .random(in: 3...7))
            return
        }
        switch CGFloat.random(in: 0..<1) {
        case ..<0.05:
            startZoomies()
        case ..<0.11:
            setState(.stretching, len: 2.6)
        case ..<0.15:
            setState(.yawning, len: 1.9)
        case ..<0.20:
            setState(.grooming, len: .random(in: 3.0...4.5))
        case ..<0.24:
            setState(.curious, len: .random(in: 2.2...3.4))
            particles.append(Particle(kind: .glyph, x: canvas / 2 + 20, y: groundY + bodyH * 0.98,
                                      vx: 5, vy: 12, life: 2.0, maxLife: 2.0, size: 17, text: "?"))
        case ..<0.28:
            startSilly()
        case ..<0.31:
            startToyChase()
        case ..<0.34:
            if !tryPerch() { setState(.walking, len: .random(in: 2.5...6)) }
        case ..<0.37:
            startPeek()
        case ..<0.40:
            goToDesk()
        case ..<0.43:
            startReading()
        case ..<0.64:
            facing = Bool.random() ? 1 : -1
            setState(.walking, len: .random(in: 2.5...6))
        case ..<0.79:
            setState(.idle, len: .random(in: 2.5...5))
        case ..<0.91:
            setState(.sitting, len: .random(in: 4...9))
        default:
            setState(.sleeping, len: .random(in: 9...22))
        }
    }

    // ── window motion ──
    private func move(dx: CGFloat, bounce: Bool = true) {
        guard let win = window, let scr = win.screen ?? NSScreen.main else { return }
        var f = win.frame
        f.origin.x += dx
        let minX = scr.frame.minX - 14
        let maxX = scr.frame.maxX - f.width + 14
        if f.origin.x < minX { f.origin.x = minX; if bounce { facing = 1 } }
        if f.origin.x > maxX { f.origin.x = maxX; if bounce { facing = -1 } }
        win.setFrameOrigin(f.origin)
    }

    private func moveRaw(dx: CGFloat) {
        guard let win = window else { return }
        win.setFrameOrigin(CGPoint(x: win.frame.origin.x + dx, y: win.frame.origin.y))
    }

    /// Walk toward a screen x. Returns true once we're there.
    @discardableResult
    private func stepToward(_ targetX: CGFloat, speed: CGFloat, dt: CGFloat) -> Bool {
        guard let win = window else { return true }
        let d = targetX - win.frame.midX
        if abs(d) < 8 { return true }
        facing = d > 0 ? 1 : -1
        move(dx: facing * speed * dt)
        walkPhase += dt * 9
        return false
    }

    private func moveWindowY(by dy: CGFloat) {
        guard let win = window else { return }
        var f = win.frame
        f.origin.y = max(screenGround, f.origin.y + dy)
        win.setFrameOrigin(f.origin)
    }

    // ── mouse ──
    override func mouseDown(with event: NSEvent) {
        guard let win = window else { return }
        dragOrigin = win.frame.origin
        dragMouse = NSEvent.mouseLocation
        lastDragX = dragMouse.x
        didDrag = false
    }

    override func mouseDragged(with event: NSEvent) {
        guard let win = window else { return }
        let m = NSEvent.mouseLocation
        if !didDrag && hypot(m.x - dragMouse.x, m.y - dragMouse.y) < 4 { return }
        if !didDrag {
            didDrag = true
            setState(.held, len: 999)
            squashY = 1.06; squashVel = 0
        }
        throwVX = (m.x - lastDragX) * 12
        lastDragX = m.x
        var p = CGPoint(x: dragOrigin.x + (m.x - dragMouse.x),
                        y: dragOrigin.y + (m.y - dragMouse.y))
        // Keep the pet grabbable: it can hang a little past a screen edge, but it
        // can't be pushed through the floor or dropped somewhere unreachable.
        if let scr = win.screen ?? NSScreen.main {
            p.x = min(max(p.x, scr.frame.minX - canvas * 0.35), scr.frame.maxX - canvas * 0.65)
            p.y = min(max(p.y, screenGround), scr.frame.maxY - canvas * 0.55)
        }
        win.setFrameOrigin(p)
    }

    override func mouseUp(with event: NSEvent) {
        if didDrag {
            vy = 0
            setState(.falling, len: 999)
        } else if event.clickCount >= 2 {
            startZoomies()
        } else {
            pet()
        }
        didDrag = false
    }

    func pet() {
        chaseCursor = false          // a click always calls off the chase
        setState(.happy, len: 1.7)
        squashY = 0.86; squashVel = 0
        for _ in 0..<5 {
            particles.append(Particle(kind: .heart,
                                      x: canvas / 2 + .random(in: -18...18),
                                      y: groundY + bodyH * .random(in: 0.85...1.05),
                                      vx: .random(in: -14...14), vy: .random(in: 32...52),
                                      life: .random(in: 1.0...1.7), maxLife: 1.7,
                                      size: .random(in: 11...17)))
        }
    }

    // ── context menu ──
    override func rightMouseDown(with event: NSEvent) {
        let menu = NSMenu()

        let petItem = NSMenuItem(title: "Pet me!", action: #selector(menuPet), keyEquivalent: "")
        petItem.target = self
        menu.addItem(petItem)

        let flip = NSMenuItem(title: "Do a flip! 🤸", action: #selector(menuFlip), keyEquivalent: "")
        flip.target = self
        menu.addItem(flip)

        let nap = NSMenuItem(title: "Take a nap", action: #selector(menuNap), keyEquivalent: "")
        nap.target = self
        menu.addItem(nap)

        let silly = NSMenuItem(title: "Do something silly 🤪", action: #selector(menuSilly), keyEquivalent: "")
        silly.target = self
        menu.addItem(silly)

        let toy = NSMenuItem(title: species == .cat ? "Chase the laser 🔴" : "Chase the ball 🎾",
                             action: #selector(menuToy), keyEquivalent: "")
        toy.target = self
        menu.addItem(toy)

        let desk = NSMenuItem(title: "Sit at your desk 🪑", action: #selector(menuDesk), keyEquivalent: "")
        desk.target = self
        menu.addItem(desk)

        let read = NSMenuItem(title: "Read a book 📖", action: #selector(menuRead), keyEquivalent: "")
        read.target = self
        menu.addItem(read)

        menu.addItem(.separator())

        let chase = NSMenuItem(title: chaseCursor ? "Stop chasing my cursor" : "Chase my cursor",
                               action: #selector(menuChase), keyEquivalent: "")
        chase.target = self; chase.state = chaseCursor ? .on : .off
        menu.addItem(chase)

        let care = NSMenuItem(title: "Self-care mode", action: #selector(menuSelfCare), keyEquivalent: "")
        care.target = self; care.state = selfCareOn ? .on : .off
        menu.addItem(care)

        if selfCareOn {
            let now = NSMenuItem(title: "Nudge me now", action: #selector(menuCareNow), keyEquivalent: "")
            now.target = self
            menu.addItem(now)
        }

        menu.addItem(.separator())

        let share = NSMenu()
        let photo = NSMenuItem(title: "Save photo (PNG)", action: #selector(menuSavePhoto), keyEquivalent: "")
        photo.target = self; share.addItem(photo)
        let gif = NSMenuItem(title: "Save animation (GIF)", action: #selector(menuSaveGIF), keyEquivalent: "")
        gif.target = self; share.addItem(gif)
        let shareItem = NSMenuItem(title: "Share…", action: nil, keyEquivalent: "")
        shareItem.submenu = share
        menu.addItem(shareItem)

        menu.addItem(.separator())

        let colors = NSMenu()
        for (i, p) in palettes.enumerated() {
            let it = NSMenuItem(title: p.name, action: #selector(menuColor(_:)), keyEquivalent: "")
            it.target = self; it.tag = i
            it.state = (i == paletteIndex) ? .on : .off
            colors.addItem(it)
        }
        let colorItem = NSMenuItem(title: "Color", action: nil, keyEquivalent: "")
        colorItem.submenu = colors
        menu.addItem(colorItem)

        let kinds = NSMenu()
        for (i, sp) in Species.allCases.enumerated() {
            let it = NSMenuItem(title: sp.label, action: #selector(menuSpecies(_:)), keyEquivalent: "")
            it.target = self; it.tag = i
            it.state = (sp == species) ? .on : .off
            kinds.addItem(it)
        }
        let kindItem = NSMenuItem(title: "Animal", action: nil, keyEquivalent: "")
        kindItem.submenu = kinds
        menu.addItem(kindItem)

        let stay = NSMenuItem(title: "Stay put", action: #selector(menuStay), keyEquivalent: "")
        stay.target = self; stay.state = stayPut ? .on : .off
        menu.addItem(stay)

        menu.addItem(.separator())
        let quit = NSMenuItem(title: "Goodbye 🐾", action: #selector(menuQuit), keyEquivalent: "")
        quit.target = self
        menu.addItem(quit)

        NSMenu.popUpContextMenu(menu, with: event, for: self)
    }

    @objc private func menuPet() { pet() }
    @objc private func menuFlip() { startZoomies() }
    @objc private func menuNap() { setState(.sleeping, len: .random(in: 15...30)) }
    @objc private func menuColor(_ sender: NSMenuItem) { paletteIndex = sender.tag }
    @objc private func menuSpecies(_ sender: NSMenuItem) { species = Species.allCases[sender.tag] }
    @objc private func menuSilly()   { startSilly() }
    @objc private func menuToy()     { startToyChase() }
    @objc private func menuDesk()    { goToDesk() }
    @objc private func menuRead()    { startReading() }
    @objc private func menuCareNow() { startCare() }
    @objc private func menuSelfCare() { selfCareOn.toggle() }
    @objc private func menuChase() {
        chaseCursor.toggle()
        if chaseCursor { setState(.chasingCursor, len: 99999) }
    }
    /// Save a shareable card to the Desktop and reveal it in Finder. Nothing is
    /// uploaded anywhere — posting it is the user's call.
    func saveShare(animated: Bool) {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd-HHmmss"
        let stamp = fmt.string(from: Date())
        let dir = FileManager.default.urls(for: .desktopDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSHomeDirectory())
        let url = dir.appendingPathComponent("Pip-\(stamp).\(animated ? "gif" : "png")")

        if animated {
            let frames = shareFrames(count: 30, size: 400, species: species, pal: palette)
            guard writeGIF(frames, to: url, delay: 0.055) else { return }
        } else {
            var l = currentLook()
            l.lift = min(l.lift, 60)
            let card = renderShareCard(size: 700, look: l, pal: palette)
            guard let tiff = card.tiffRepresentation,
                  let rep = NSBitmapImageRep(data: tiff),
                  let png = rep.representation(using: .png, properties: [:]) else { return }
            try? png.write(to: url)
        }
        NSWorkspace.shared.activateFileViewerSelecting([url])
    }

    @objc private func menuSavePhoto() { saveShare(animated: false) }
    @objc private func menuSaveGIF()   { saveShare(animated: true) }
    @objc private func menuStay() {
        stayPut.toggle()
        if stayPut, state == .walking { setState(.idle, len: 4) }
    }
    @objc private func menuQuit() { NSApp.terminate(nil) }

    // ── render ──
    private func currentLook() -> PetLook {
        var l = PetLook(palette: palette)
        l.breath = sin(t * 2.1)
        l.facing = facing
        l.squashY = squashY
        l.squashX = 1 + (1 - squashY) * 0.55
        l.walkPhase = walkPhase
        l.species = species
        l.tailSway = species == .dog
            ? sin(t * (state == .walking ? 7.5 : 2.8))
            : sin(t * (state == .walking ? 4.5 : 1.6))
        l.earTilt = sin(t * 1.3) * 0.3
        l.particles = particles
        l.shoutText = shoutText
        l.shoutAge = shoutAge
        l.shoutLife = shoutLife

        switch state {
        case .walking:  l.isWalking = true;  l.mouth = .smile
        case .sitting:  l.isSitting = true;  l.mouth = .neutral
        case .sleeping: l.isSitting = true;  l.eyes = .sleepy; l.mouth = .snooze
        case .happy:    l.eyes = .happy;     l.mouth = .open
        case .held:     l.eyes = .wide;      l.mouth = .open
        case .falling:  l.eyes = .wide;      l.mouth = .open
        case .idle:     l.mouth = .smile
        case .dashing:
            l.isWalking = true
            l.eyes = .wide
            l.mouth = .open
            l.spin = -0.20 * facing          // leaning into the sprint
            l.tailSway = sin(t * 11)
        case .flipping:
            let p = min(1, stateTime / flipAirtime)
            l.spin = spin
            l.tuck = 1 - 0.14 * sin(p * .pi)
            l.lift = lift
            l.eyes = .happy
            l.mouth = .open
            l.tailSway = sin(t * 9)
            l.shadowScale = max(0.30, 1 - lift / 95)

        // ── the quiet life ──
        case .stretching:
            let a = sin(min(1, stateTime / stateLen) * .pi)
            l.stretchAmt = a
            l.squashX = 1 + a * 0.30
            l.squashY = 1 - a * 0.17
            l.eyes = .happy; l.mouth = .smile
            l.tailSway = sin(t * 3) * 0.7

        case .yawning:
            let p = stateTime / stateLen
            l.mouth = (p > 0.22 && p < 0.80) ? .yawn : .smile
            l.eyes  = (p > 0.16 && p < 0.88) ? .blink : .open
            l.lean = -0.07 * facing * sin(min(1, p) * .pi)

        case .grooming:
            l.pawUp = min(1, 0.62 + 0.42 * sin(stateTime * 3.6))
            l.eyes = .happy
            l.mouth = .open
            l.lean = 0.05 * facing
            l.isSitting = true

        case .curious:
            l.eyes = .wide
            l.mouth = .neutral
            l.lean = 0.14 * facing
            l.earTilt = 0.95

        // ── getting about ──
        case .walkingTo:
            l.isWalking = true
            l.mouth = .smile

        case .hoppingUp:
            l.eyes = .wide; l.mouth = .open
            l.lean = 0.10 * facing
            l.shadowScale = 0.45

        case .perching:
            l.isSitting = true
            l.mouth = .smile
            l.tailSway = sin(t * 1.4)
            l.shadowScale = 0.55

        case .peeking:
            l.lean = 0.26 * facing
            l.eyes = .wide
            l.mouth = .neutral
            l.earTilt = 0.8

        // ── play ──
        case .chasingCursor:
            l.isWalking = true
            l.eyes = .wide
            l.mouth = .open
            l.spin = -0.14 * facing
            l.tailSway = sin(t * 10)

        case .chasingToy:
            l.isWalking = true
            l.eyes = .wide
            l.mouth = .open
            l.spin = -0.16 * facing
            l.tailSway = sin(t * 11)
            if let win = window {
                let vx = toyScreenX - win.frame.minX
                if vx > -20, vx < canvas + 20 { l.toy = CGPoint(x: vx, y: toyY) }
            }

        // ── settling in ──
        case .atDesk:
            l.isSitting = true
            l.props = [.desk]
            l.mouth = .smile
            l.tailSway = sin(t * 1.2) * 0.5

        case .reading:
            l.isSitting = true
            l.props = [.book]
            l.eyes = .sleepy                        // eyes down on the page
            l.mouth = .neutral
            l.lean = 0.05 * facing
            l.tailSway = sin(t * 0.9) * 0.4

        // ── confidently ridiculous ──
        case .silly:
            let p = min(1, stateTime / stateLen)
            switch sillyAct {
            case .dance:
                l.lean = sin(t * 7) * 0.30
                l.pawUp = 0.5 + 0.5 * sin(t * 7)
                l.lift = abs(sin(t * 7)) * 7
                l.eyes = .happy; l.mouth = .open
                l.tailSway = sin(t * 8)
            case .moonwalk:
                l.isWalking = true
                l.lean = -0.12 * facing
                l.eyes = .wide; l.mouth = .smile
            case .faint:
                l.spin = -1.45 * facing * min(1, p / 0.30)
                l.eyes = .dizzy; l.mouth = .open
                l.shadowScale = 0.8
            case .downwardDog:
                let a = sin(p * .pi)
                l.stretchAmt = a
                l.squashX = 1 + a * 0.34
                l.squashY = 1 - a * 0.22
                l.lean = 0.17 * facing * a
                l.eyes = .happy; l.mouth = .open
            case .loaf:
                l.isSitting = true
                l.squashX = 1.10; l.squashY = 0.86
                l.eyes = .happy; l.mouth = .neutral
            case .bow:
                let a = sin(p * .pi)
                l.lean = 0.44 * facing * a
                l.pawUp = a
                l.eyes = .happy; l.mouth = .smile
            }

        // ── self-care ──
        case .careWater:
            l.props = [.glass]
            l.pawUp = 0.85
            l.sign = "Drink water"
            l.signBob = sin(t * 3)
            l.eyes = .happy; l.mouth = .smile
            l.isSitting = true

        case .careStretch:
            let p = stateTime / stateLen
            if p < 0.42 {
                let a = sin(p / 0.42 * .pi)
                l.stretchAmt = a
                l.squashX = 1 + a * 0.30
                l.squashY = 1 - a * 0.17
                l.eyes = .happy; l.mouth = .smile
            } else {
                l.sign = "Stretch"
                l.signBob = sin(t * 3)
                l.eyes = .happy; l.mouth = .smile
            }
        }

        if blinkFor > 0, l.eyes == .open { l.eyes = .blink }

        // eyes follow the cursor
        if l.eyes == .open || l.eyes == .wide, let win = window {
            let eye = CGPoint(x: win.frame.minX + canvas / 2,
                              y: win.frame.minY + groundY + bodyH * 0.55)
            let m = NSEvent.mouseLocation
            let dx = max(-1, min(1, (m.x - eye.x) / 150))
            let dy = max(-1, min(1, (m.y - eye.y) / 150))
            l.pupil = CGPoint(x: dx * 2.3 * facing, y: dy * 2.0)
        }

        if state == .falling || state == .held {
            let h = max(0, (window?.frame.origin.y ?? 0) - screenGround)
            l.lift = 0
            l.shadowScale = max(0.35, 1 - h / 260)
        }
        return l
    }

    override func draw(_ dirtyRect: NSRect) {
        drawPet(currentLook(), in: bounds.size)
    }
}

// ───────────────────────────────── window ─────────────────────────────────

final class PetPanel: NSPanel {
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

// ───────────────────────────────── snapshot mode ─────────────────────────────────

func renderContactSheet(to path: String, species: Species = .cat, palette: Int = defaultPaletteIndex) {
    let cell = NSSize(width: canvas, height: canvas)
    let cols = 4, rows = 3
    let sheet = NSImage(size: NSSize(width: cell.width * CGFloat(cols),
                                     height: cell.height * CGFloat(rows)))

    var looks: [(String, PetLook)] = []
    var a = PetLook(palette: palettes[palette]); a.mouth = .smile
    looks.append(("idle", a))
    var b = PetLook(palette: palettes[palette]); b.isWalking = true; b.walkPhase = 1.1; b.tailSway = 0.9
    looks.append(("walking", b))
    var c = PetLook(palette: palettes[palette]); c.eyes = .happy; c.mouth = .open
    c.particles = [Particle(kind: .heart, x: canvas/2 - 20, y: groundY + 70, vx: 0, vy: 0, life: 2, maxLife: 2, size: 15),
                   Particle(kind: .heart, x: canvas/2 + 16, y: groundY + 82, vx: 0, vy: 0, life: 2, maxLife: 2, size: 12)]
    looks.append(("petted", c))
    var d = PetLook(palette: palettes[palette]); d.isSitting = true; d.eyes = .sleepy; d.mouth = .snooze
    d.particles = [Particle(kind: .zzz, x: canvas/2 + 18, y: groundY + 56, vx: 0, vy: 0, life: 2, maxLife: 2, size: 13),
                   Particle(kind: .zzz, x: canvas/2 + 30, y: groundY + 72, vx: 0, vy: 0, life: 2, maxLife: 2, size: 16)]
    looks.append(("sleeping", d))
    var e = PetLook(palette: palettes[palette]); e.eyes = .blink
    looks.append(("blink", e))
    var f = PetLook(palette: palettes[palette]); f.facing = -1; f.isWalking = true; f.walkPhase = 2.6
    looks.append(("facing left", f))
    var g = PetLook(palette: palettes[palette]); g.eyes = .wide; g.mouth = .open; g.squashY = 1.08; g.squashX = 0.96; g.shadowScale = 0.5
    looks.append(("held", g))
    var h = PetLook(palette: palettes[palette]); h.squashY = 0.74; h.squashX = 1.14
    looks.append(("landing", h))

    var i1 = PetLook(palette: palettes[palette])
    i1.isWalking = true; i1.walkPhase = 1.6; i1.eyes = .wide; i1.mouth = .open
    i1.spin = -0.20; i1.tailSway = 0.8
    looks.append(("dashing", i1))

    let air: (CGFloat, CGFloat) -> PetLook = { prog, age in
        var f = PetLook(palette: palettes[palette])
        f.spin = -2 * .pi * prog
        f.tuck = 1 - 0.14 * sin(prog * .pi)
        f.lift = 272 * (prog * 0.68) - 0.5 * 800 * pow(prog * 0.68, 2)
        f.eyes = .happy; f.mouth = .open
        f.shadowScale = max(0.30, 1 - f.lift / 95)
        f.shoutText = "Theragleeeeee!!!"
        f.shoutAge = age
        return f
    }
    looks.append(("flip ¼", air(0.25, 0.17)))
    looks.append(("flip ½ (apex)", air(0.50, 0.34)))
    looks.append(("flip ¾", air(0.75, 0.60)))

    // Every cell is the same animal in the same color on purpose. Pip never
    // recolors itself, so a sheet that showed each pose in a different palette
    // implied behavior the app does not have.
    for i in looks.indices {
        looks[i].1.species = species
        looks[i].1.palette = palettes[palette]
    }

    sheet.lockFocus()
    NSColor(white: 0.93, alpha: 1).setFill()
    NSRect(origin: .zero, size: sheet.size).fill()
    for (i, item) in looks.enumerated() {
        let col = i % cols, row = rows - 1 - i / cols
        let ox = CGFloat(col) * cell.width, oy = CGFloat(row) * cell.height
        NSColor(white: CGFloat(0.99 - Double((col + row) % 2) * 0.06), alpha: 1).setFill()
        NSRect(x: ox, y: oy, width: cell.width, height: cell.height).fill()
        let xf = NSAffineTransform()
        xf.translateX(by: ox, yBy: oy)
        xf.concat()
        drawPet(item.1, in: cell)
        NSAttributedString(string: item.0, attributes: [
            .font: NSFont.systemFont(ofSize: 11, weight: .medium),
            .foregroundColor: NSColor(white: 0.45, alpha: 1),
        ]).draw(at: CGPoint(x: 8, y: 6))
        xf.invert(); xf.concat()
    }
    sheet.unlockFocus()

    guard let tiff = sheet.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let png = rep.representation(using: .png, properties: [:]) else { return }
    try? png.write(to: URL(fileURLWithPath: path))
    FileHandle.standardError.write("wrote \(path)\n".data(using: .utf8)!)
}

// ─────────────────────── sharing ───────────────────────

let shareCredit = "Theraglee.com"

/// One frame of a shareable card: the pet on a soft ground, credited.
func renderShareCard(size S: CGFloat, look: PetLook, pal: Palette) -> NSImage {
    let img = NSImage(size: NSSize(width: S, height: S))
    img.lockFocus()

    let top = pal.body.blended(withFraction: 0.72, of: .white) ?? pal.body
    let bot = pal.body.blended(withFraction: 0.30, of: pal.shade) ?? pal.body
    NSGradient(starting: bot, ending: top)?.draw(in: NSRect(x: 0, y: 0, width: S, height: S), angle: 90)

    if let ctx = NSGraphicsContext.current?.cgContext {
        ctx.saveGState()
        // Frames carrying a shout or a sign need headroom; a plain portrait can
        // fill the card properly instead of floating in the bottom third.
        let tall = look.shoutText != nil || look.sign != nil
        let k = tall ? S / 200 : S / 145
        ctx.translateBy(x: S / 2, y: S * (tall ? 0.20 : 0.28))
        ctx.scaleBy(x: k, y: k)
        ctx.translateBy(x: -canvas / 2, y: -groundY)
        drawPet(look, in: NSSize(width: canvas, height: canvas))
        ctx.restoreGState()
    }

    let ink = NSColor(srgbRed: 0.24, green: 0.20, blue: 0.20, alpha: 0.85)
    let credit = NSAttributedString(string: shareCredit, attributes: [
        .font: NSFont.systemFont(ofSize: S * 0.062, weight: .heavy),
        .foregroundColor: ink,
    ])
    let sub = NSAttributedString(string: "my little desk pet", attributes: [
        .font: NSFont.systemFont(ofSize: S * 0.033, weight: .medium),
        .foregroundColor: ink.withAlphaComponent(0.55),
    ])
    let cs = credit.size(), ss = sub.size()
    credit.draw(at: CGPoint(x: (S - cs.width) / 2, y: S * 0.085))
    sub.draw(at: CGPoint(x: (S - ss.width) / 2, y: S * 0.045))

    img.unlockFocus()
    return img
}

/// Frames of the somersault, built to loop seamlessly.
func shareFrames(count: Int, size: CGFloat, species: Species, pal: Palette) -> [NSImage] {
    (0..<count).map { i in
        let prog = CGFloat(i) / CGFloat(count)
        var l = PetLook(palette: pal)
        l.species = species
        l.spin = -2 * .pi * prog
        l.tuck = 1 - 0.14 * sin(prog * .pi)
        l.lift = 95 * sin(prog * .pi)
        l.eyes = .happy
        l.mouth = .open
        l.shadowScale = max(0.30, 1 - l.lift / 95)
        if prog > 0.10, prog < 0.96 {
            l.shoutText = "Theragleeeeee!!!"
            l.shoutLife = 3.0
            l.shoutAge = 0.08 + (prog - 0.10) * 3.1
        }
        return renderShareCard(size: size, look: l, pal: pal)
    }
}

@discardableResult
func writeGIF(_ frames: [NSImage], to url: URL, delay: Double) -> Bool {
    guard let dest = CGImageDestinationCreateWithURL(url as CFURL,
                                                     UTType.gif.identifier as CFString,
                                                     frames.count, nil) else { return false }
    CGImageDestinationSetProperties(dest, [
        kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]
    ] as CFDictionary)
    let frameProps = [
        kCGImagePropertyGIFDictionary: [
            kCGImagePropertyGIFDelayTime: delay,
            kCGImagePropertyGIFUnclampedDelayTime: delay,
        ]
    ] as CFDictionary
    for f in frames {
        guard let cg = f.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
        CGImageDestinationAddImage(dest, cg, frameProps)
    }
    return CGImageDestinationFinalize(dest)
}

/// A contact sheet of everything the pet learned to do.
func renderActSheet(to path: String, species: Species = .cat, palette: Int = defaultPaletteIndex) {
    let cell = NSSize(width: canvas, height: canvas)
    let cols = 4, rows = 4
    let sheet = NSImage(size: NSSize(width: cell.width * CGFloat(cols),
                                     height: cell.height * CGFloat(rows)))
    func base() -> PetLook {
        var l = PetLook(palette: palettes[palette]); l.species = species; return l
    }
    var looks: [(String, PetLook)] = []

    var a = base(); a.stretchAmt = 1; a.squashX = 1.30; a.squashY = 0.83; a.eyes = .happy
    looks.append(("stretch", a))
    var b = base(); b.mouth = .yawn; b.eyes = .blink; b.lean = -0.07
    looks.append(("yawn", b))
    var c = base(); c.pawUp = 0.95; c.eyes = .happy; c.mouth = .open; c.isSitting = true; c.lean = 0.05
    looks.append(("groom", c))
    var d = base(); d.eyes = .wide; d.lean = 0.14; d.earTilt = 0.95
    d.particles = [Particle(kind: .glyph, x: canvas/2 + 24, y: groundY + 62, vx: 0, vy: 0, life: 2, maxLife: 2, size: 18, text: "?")]
    looks.append(("curious", d))

    var e = base(); e.isSitting = true; e.shadowScale = 0.55; e.tailSway = 0.6
    looks.append(("perching", e))
    var f = base(); f.lean = 0.26; f.eyes = .wide; f.earTilt = 0.8
    looks.append(("peeking", f))
    var g = base(); g.isSitting = true; g.props = [.desk]; g.mouth = .smile
    looks.append(("at the desk", g))
    var h = base(); h.isSitting = true; h.props = [.book]; h.eyes = .sleepy; h.lean = 0.05
    looks.append(("reading a book", h))

    var i = base(); i.isWalking = true; i.walkPhase = 1.2; i.eyes = .wide; i.mouth = .open; i.spin = -0.16
    i.toy = CGPoint(x: canvas/2 + 46, y: groundY + 8)
    looks.append((species == .cat ? "laser!" : "ball!", i))
    var j = base(); j.lean = 0.28; j.pawUp = 1; j.lift = 6; j.eyes = .happy; j.mouth = .open
    looks.append(("dance", j))
    var k = base(); k.spin = -1.45; k.eyes = .dizzy; k.mouth = .open; k.shadowScale = 0.8
    looks.append(("dramatic faint", k))
    var m = base(); m.lean = 0.44; m.pawUp = 1; m.eyes = .happy
    looks.append(("a bow", m))

    var n = base(); n.isSitting = true; n.squashX = 1.10; n.squashY = 0.86; n.eyes = .happy
    looks.append(("loaf", n))
    var o = base(); o.stretchAmt = 1; o.squashX = 1.34; o.squashY = 0.78; o.lean = 0.17; o.eyes = .happy; o.mouth = .open
    looks.append(("downward dog", o))
    var q = base(); q.props = [.glass]; q.pawUp = 0.85; q.sign = "Drink water"; q.eyes = .happy; q.isSitting = true
    looks.append(("self-care: water", q))
    var r = base(); r.sign = "Stretch"; r.eyes = .happy
    looks.append(("self-care: stretch", r))

    sheet.lockFocus()
    NSColor(white: 0.93, alpha: 1).setFill()
    NSRect(origin: .zero, size: sheet.size).fill()
    for (i, item) in looks.enumerated() {
        let col = i % cols, row = rows - 1 - i / cols
        let ox = CGFloat(col) * cell.width, oy = CGFloat(row) * cell.height
        NSColor(white: CGFloat(0.99 - Double((col + row) % 2) * 0.06), alpha: 1).setFill()
        NSRect(x: ox, y: oy, width: cell.width, height: cell.height).fill()
        let xf = NSAffineTransform(); xf.translateX(by: ox, yBy: oy); xf.concat()
        if item.0 == "perching" {          // hint the window top it is sat on
            NSColor(white: 0.55, alpha: 1).setFill()
            NSRect(x: 12, y: groundY - 5, width: cell.width - 24, height: 4).fill()
            NSColor(white: 0.80, alpha: 1).setFill()
            NSRect(x: 12, y: groundY - 22, width: cell.width - 24, height: 17).fill()
        }
        drawPet(item.1, in: cell)
        NSAttributedString(string: item.0, attributes: [
            .font: NSFont.systemFont(ofSize: 11, weight: .medium),
            .foregroundColor: NSColor(white: 0.45, alpha: 1),
        ]).draw(at: CGPoint(x: 8, y: 6))
        xf.invert(); xf.concat()
    }
    sheet.unlockFocus()
    guard let tiff = sheet.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
          let png = rep.representation(using: .png, properties: [:]) else { return }
    try? png.write(to: URL(fileURLWithPath: path))
    FileHandle.standardError.write("wrote \(path)\n".data(using: .utf8)!)
}

func renderIcon(size S: CGFloat, palette: Int, to path: String) {
    let img = NSImage(size: NSSize(width: S, height: S))
    img.lockFocus()
    if let ctx = NSGraphicsContext.current?.cgContext {
        let k = S / 122
        ctx.translateBy(x: S / 2, y: S / 2)
        ctx.scaleBy(x: k, y: k)
        ctx.translateBy(x: -(canvas / 2 + 4), y: -(groundY + 40))
        var l = PetLook(palette: palettes[palette])
        l.showShadow = false
        l.mouth = .smile
        drawPet(l, in: NSSize(width: canvas, height: canvas))
    }
    img.unlockFocus()
    guard let tiff = img.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let png = rep.representation(using: .png, properties: [:]) else { return }
    try? png.write(to: URL(fileURLWithPath: path))
}

// ───────────────────────────────── main ─────────────────────────────────

let app = NSApplication.shared

if let idx = CommandLine.arguments.firstIndex(of: "--snapshot") {
    let out = CommandLine.arguments.count > idx + 1 ? CommandLine.arguments[idx + 1] : "pet-preview.png"
    var sp = Species.cat
    var pal = defaultPaletteIndex
    for extra in CommandLine.arguments.dropFirst(idx + 2) {
        if let s = Species(rawValue: extra.lowercased()) { sp = s }
        if let n = palettes.firstIndex(where: { $0.name.lowercased() == extra.lowercased() }) { pal = n }
    }
    renderContactSheet(to: out, species: sp, palette: pal)
    exit(0)
}

if let idx = CommandLine.arguments.firstIndex(of: "--icon"), CommandLine.arguments.count > idx + 2 {
    let size = CGFloat(Double(CommandLine.arguments[idx + 1]) ?? 512)
    renderIcon(size: size, palette: 0, to: CommandLine.arguments[idx + 2])
    exit(0)
}

if let idx = CommandLine.arguments.firstIndex(of: "--acts") {
    let out = CommandLine.arguments.count > idx + 1 ? CommandLine.arguments[idx + 1] : "pet-acts.png"
    var sp = Species.cat
    for extra in CommandLine.arguments.dropFirst(idx + 2) {
        if let x = Species(rawValue: extra.lowercased()) { sp = x }
    }
    renderActSheet(to: out, species: sp)
    exit(0)
}

// Shareable card / animation, straight from the command line too.
if let idx = CommandLine.arguments.firstIndex(of: "--card") ?? CommandLine.arguments.firstIndex(of: "--gif") {
    let animated = CommandLine.arguments[idx] == "--gif"
    let out = CommandLine.arguments.count > idx + 1
        ? CommandLine.arguments[idx + 1] : (animated ? "pip.gif" : "pip.png")
    var sp = Species.cat, pal = defaultPaletteIndex
    for extra in CommandLine.arguments.dropFirst(idx + 2) {
        if let x = Species(rawValue: extra.lowercased()) { sp = x }
        if let n = palettes.firstIndex(where: { $0.name.lowercased() == extra.lowercased() }) { pal = n }
    }
    let url = URL(fileURLWithPath: out)
    if animated {
        writeGIF(shareFrames(count: 30, size: 400, species: sp, pal: palettes[pal]), to: url, delay: 0.055)
    } else {
        var l = PetLook(palette: palettes[pal])
        l.species = sp; l.eyes = .happy; l.mouth = .open
        let card = renderShareCard(size: 700, look: l, pal: palettes[pal])
        if let tiff = card.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
           let png = rep.representation(using: .png, properties: [:]) { try? png.write(to: url) }
    }
    FileHandle.standardError.write("wrote \(out)\n".data(using: .utf8)!)
    exit(0)
}

// ── one pet at a time ──
// An exclusive lock held for the life of the process. A second launch — a stray
// double-click, `open -n`, or the bare binary — steps aside quietly rather than
// putting a second creature on the desktop. All the render modes above have
// already exited by this point, so they are never blocked by a running pet.
let lockPath = (NSHomeDirectory() as NSString)
    .appendingPathComponent("Library/Caches/local.desktoppet.pip.lock")
let petLock = open(lockPath, O_CREAT | O_RDWR, 0o644)
if petLock < 0 || flock(petLock, LOCK_EX | LOCK_NB) != 0 {
    exit(0)                       // somebody is already out there
}

app.setActivationPolicy(.accessory)

let screen = NSScreen.main!
let startX = screen.visibleFrame.midX - canvas / 2
let startY = screen.visibleFrame.minY + 4 - groundY

let panel = PetPanel(contentRect: NSRect(x: startX, y: startY, width: canvas, height: canvas),
                     styleMask: [.borderless, .nonactivatingPanel],
                     backing: .buffered, defer: false)
panel.isFloatingPanel = true
panel.level = .floating
panel.backgroundColor = .clear
panel.isOpaque = false
panel.hasShadow = false
panel.hidesOnDeactivate = false
panel.isMovableByWindowBackground = false
panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]
// Pin the backing store to 8-bit sRGB. Left to itself AppKit gives this window a
// half-float (EDR) backing store on a wide-gamut display, and compositing every
// frame in f16 costs several times more CPU for artwork that is flat color anyway.
panel.colorSpace = .sRGB

let view = PetView(frame: NSRect(x: 0, y: 0, width: canvas, height: canvas))
view.loadPrefs()
if let i = CommandLine.arguments.firstIndex(of: "--species"), CommandLine.arguments.count > i + 1,
   let sp = Species(rawValue: CommandLine.arguments[i + 1].lowercased()) {
    view.species = sp
}
if let i = CommandLine.arguments.firstIndex(of: "--color") ?? CommandLine.arguments.firstIndex(of: "--colour"),
   CommandLine.arguments.count > i + 1,
   let n = palettes.firstIndex(where: { $0.name.lowercased() == CommandLine.arguments[i + 1].lowercased() }) {
    view.paletteIndex = n
}
view.wantsLayer = true
view.layer?.contentsFormat = .RGBA8Uint
panel.contentView = view
panel.orderFrontRegardless()

let fps: CGFloat = 24
let timer = Timer(timeInterval: 1.0 / Double(fps), repeats: true) { _ in view.step(1 / fps) }
RunLoop.main.add(timer, forMode: .common)

app.run()
