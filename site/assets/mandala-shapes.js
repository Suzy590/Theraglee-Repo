/* The outlines a shaped mandala is drawn inside: animals, plants and a few
   symbols, each on the same 200 x 200 page as the round mandalas.

   A shape is a list of parts, painted in order:
     layer 'back'    a plain colorable shape behind the pattern (legs, a stem)
     layer 'pattern' the mandala pattern fills it (a shell, a wing, a leaf)
     layer 'front'   a plain colorable shape on top (an eye, a beak)
   Parts that share a `g` are one group for "Whole ring". `lines` are strokes
   only (antennae, whiskers) and never take a color. `heart` is where the
   pattern's rings are centered; it must sit inside a pattern part.

   Paths use absolute M, L, C, Q and Z only, so flatten() can read them back
   and mandala.js can tell which pattern shapes land inside the outline.

   Like the seeds, these outlines are a data contract once a mandala uses
   them: a saved coloring points at region indexes, and moving a part or its
   `heart` moves them. Add a new shape rather than reshaping one that ships. */

const f1 = (n) => n.toFixed(1);

/* An ellipse as four cubic curves, optionally turned `rot` degrees. */
function ellipse(cx, cy, rx, ry, rot = 0) {
  const k = 0.5523, t = rot * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  const p = (x, y) => `${f1(cx + x * c - y * s)} ${f1(cy + x * s + y * c)}`;
  return `M${p(rx, 0)} C${p(rx, ry * k)} ${p(rx * k, ry)} ${p(0, ry)} `
       + `C${p(-rx * k, ry)} ${p(-rx, ry * k)} ${p(-rx, 0)} `
       + `C${p(-rx, -ry * k)} ${p(-rx * k, -ry)} ${p(0, -ry)} `
       + `C${p(rx * k, -ry)} ${p(rx, -ry * k)} ${p(rx, 0)} Z`;
}
const circle = (cx, cy, r) => ellipse(cx, cy, r, r);

/* A left-right symmetric outline from its right half: `start` on the center
   line at the top, then cubic segments [c1x,c1y, c2x,c2y, x,y] down the right
   side, ending back on the center line. The left side is the mirror image. */
function sym(start, segs, axis = 100) {
  const m = (x) => f1(2 * axis - x);
  let d = `M${f1(start[0])} ${f1(start[1])} `;
  for (const s of segs) d += `C${s.map(f1).join(' ')} `;
  let prev = [start, ...segs.map(s => [s[4], s[5]])];
  for (let j = segs.length - 1; j >= 0; j--) {
    const [c1x, c1y, c2x, c2y] = segs[j], [px, py] = prev[j];
    d += `C${m(c2x)} ${f1(c2y)} ${m(c1x)} ${f1(c1y)} ${m(px)} ${f1(py)} `;
  }
  return d + 'Z';
}

/* A closed outline through points. */
const poly = (pts) => 'M' + pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(' L') + ' Z';

/* An outline traced around a center by a radius function. */
function polar(cx, cy, radius, steps = 144) {
  const pts = [];
  for (let j = 0; j < steps; j++) {
    const a = 2 * Math.PI * j / steps - Math.PI / 2;
    const rr = radius(a);
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return poly(pts);
}

/* A crescent: one circle less another. */
function crescent(cx, cy, r, ox, oy, or) {
  const pts = [];
  const inOther = (x, y) => (x - ox) ** 2 + (y - oy) ** 2 < or * or;
  // Walk the outer circle where it is not covered, then the inner one back.
  const outer = [], inner = [];
  for (let j = 0; j < 720; j++) {
    const a = 2 * Math.PI * j / 720;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    outer.push([x, y, !inOther(x, y)]);
  }
  const start = outer.findIndex((p, j) => p[2] && !outer[(j + 719) % 720][2]);
  for (let j = 0; j < 720; j++) {
    const p = outer[(start + j) % 720];
    if (!p[2]) break;
    if (j % 6 === 0) pts.push([p[0], p[1]]);
  }
  const [ex, ey] = pts[pts.length - 1], [sx, sy] = pts[0];
  let a0 = Math.atan2(ey - oy, ex - ox), a1 = Math.atan2(sy - oy, sx - ox);
  while (a1 > a0) a1 -= 2 * Math.PI;             // back round the inner circle, clockwise
  for (let j = 1; j < 60; j++) {
    const a = a0 + (a1 - a0) * j / 60;
    inner.push([ox + or * Math.cos(a), oy + or * Math.sin(a)]);
  }
  return poly([...pts, ...inner]);
}

function star(cx, cy, R, r, n = 5) {
  const pts = [];
  for (let j = 0; j < 2 * n; j++) {
    const a = Math.PI * j / n - Math.PI / 2, rr = j % 2 ? r : R;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return poly(pts);
}

export const SHAPES = {
  /* ---------------------------------------------------------------- animals */
  butterfly: {
    label: 'Butterfly', kind: 'animal', heart: [100, 104],
    parts: [
      { layer: 'pattern', d: sym([100, 96], [
        [112, 58, 140, 18, 172, 20], [196, 22, 196, 64, 176, 86],
        [166, 96, 146, 102, 132, 106], [156, 114, 176, 134, 168, 160],
        [160, 186, 124, 184, 110, 156], [106, 146, 102, 134, 100, 128]]) },
      { layer: 'front', g: 'body', d: ellipse(100, 116, 7, 40) },
      { layer: 'front', g: 'body', d: circle(100, 70, 9) },
    ],
    lines: ['M96 63 C90 46 84 36 72 30', 'M104 63 C110 46 116 36 128 30'],
    dots: [[72, 30, 3], [128, 30, 3]],
  },
  owl: {
    label: 'Owl', kind: 'animal', heart: [100, 126],
    parts: [
      { layer: 'back', g: 'feet', d: ellipse(84, 184, 10, 6) },
      { layer: 'back', g: 'feet', d: ellipse(116, 184, 10, 6) },
      { layer: 'pattern', d: sym([100, 40], [
        [118, 40, 134, 34, 150, 14], [156, 34, 158, 50, 158, 62],
        [176, 92, 176, 138, 160, 162], [146, 182, 124, 186, 100, 186]]) },
      { layer: 'front', g: 'eyes', d: circle(76, 78, 19) },
      { layer: 'front', g: 'eyes', d: circle(124, 78, 19) },
      { layer: 'front', g: 'pupils', d: circle(78, 80, 7) },
      { layer: 'front', g: 'pupils', d: circle(122, 80, 7) },
      { layer: 'front', g: 'beak', d: 'M100 92 L109 102 L100 116 L91 102 Z' },
    ],
  },
  cat: {
    label: 'Cat', kind: 'animal', heart: [100, 122],
    parts: [
      { layer: 'pattern', d: sym([100, 44], [
        [114, 44, 128, 46, 140, 52], [148, 42, 158, 28, 166, 18],
        [172, 40, 172, 60, 168, 76], [182, 100, 182, 136, 162, 158],
        [146, 176, 124, 184, 100, 184]]) },
      { layer: 'front', g: 'eyes', d: ellipse(74, 108, 14, 10) },
      { layer: 'front', g: 'eyes', d: ellipse(126, 108, 14, 10) },
      { layer: 'front', g: 'pupils', d: ellipse(74, 108, 3.5, 9) },
      { layer: 'front', g: 'pupils', d: ellipse(126, 108, 3.5, 9) },
      { layer: 'front', g: 'nose', d: 'M92 130 L108 130 L100 140 Z' },
    ],
    lines: ['M100 140 L100 148 M100 148 C94 154 86 154 82 148 M100 148 C106 154 114 154 118 148',
            'M70 136 L28 128 M70 142 L26 146 M130 136 L172 128 M130 142 L174 146'],
  },
  fish: {
    label: 'Fish', kind: 'animal', heart: [84, 100],
    parts: [
      { layer: 'back', g: 'fins', d: 'M78 60 C88 36 110 28 124 30 C120 44 118 56 116 66 Z' },
      { layer: 'back', g: 'fins', d: 'M84 140 C92 158 104 166 116 168 C114 156 112 146 110 136 Z' },
      { layer: 'pattern', d: 'M14 100 C34 58 96 44 134 76 L182 40 C170 74 170 126 182 160 '
          + 'L134 124 C96 156 34 142 14 100 Z' },
      { layer: 'front', g: 'eye', d: circle(42, 92, 8) },
      { layer: 'front', g: 'pupil', d: circle(43, 92, 3.5) },
    ],
  },
  turtle: {
    label: 'Turtle', kind: 'animal', heart: [100, 106],
    parts: [
      { layer: 'back', g: 'head', d: ellipse(100, 30, 17, 22) },
      { layer: 'back', g: 'legs', d: ellipse(50, 60, 24, 12, -35) },
      { layer: 'back', g: 'legs', d: ellipse(150, 60, 24, 12, 35) },
      { layer: 'back', g: 'legs', d: ellipse(54, 156, 22, 11, 40) },
      { layer: 'back', g: 'legs', d: ellipse(146, 156, 22, 11, -40) },
      { layer: 'back', g: 'tail', d: 'M92 166 L100 192 L108 166 Z' },
      { layer: 'pattern', d: ellipse(100, 106, 58, 66) },
    ],
    dots: [[93, 24, 2.5], [107, 24, 2.5]],
  },
  bird: {
    label: 'Songbird', kind: 'animal', heart: [112, 112],
    parts: [
      { layer: 'back', g: 'beak', d: 'M160 64 L188 74 L162 84 Z' },
      { layer: 'pattern', d: 'M164 74 C162 50 140 38 122 46 C108 52 104 66 100 76 '
          + 'C92 90 72 92 56 102 L12 116 L22 134 L52 132 '
          + 'C62 158 100 172 132 160 C158 150 168 124 166 100 C166 90 166 82 164 74 Z' },
      { layer: 'front', g: 'eye', d: circle(142, 66, 6) },
      { layer: 'front', g: 'pupil', d: circle(143, 66, 2.5) },
    ],
    lines: ['M104 166 L100 188 M100 188 L90 192 M100 188 L106 194',
            'M124 162 L122 188 M122 188 L112 192 M122 188 L128 194'],
  },
  snail: {
    label: 'Snail', kind: 'animal', heart: [118, 96],
    parts: [
      { layer: 'back', g: 'body', d: 'M14 172 C12 150 22 128 38 120 C52 114 62 124 64 146 '
          + 'L170 150 C188 152 194 172 178 176 L22 178 C16 178 14 176 14 172 Z' },
      { layer: 'pattern', d: circle(118, 96, 62) },
      { layer: 'front', g: 'eyes', d: circle(22, 88, 5) },
      { layer: 'front', g: 'eyes', d: circle(44, 84, 5) },
    ],
    lines: ['M34 122 L22 93 M44 120 L44 89', 'M28 146 C32 150 38 150 42 146'],
    dots: [[42, 134, 2.5]],
  },
  whale: {
    label: 'Whale', kind: 'animal', heart: [86, 110],
    parts: [
      { layer: 'back', g: 'fin', d: 'M78 146 C84 164 96 176 114 180 C110 164 106 152 104 142 Z' },
      { layer: 'pattern', d: 'M12 118 C12 78 58 62 100 64 C136 66 156 84 164 100 '
          + 'C168 86 168 72 166 62 C156 58 146 50 140 38 C152 40 164 44 172 54 '
          + 'C178 44 188 38 198 38 C192 52 184 62 176 66 C174 84 172 104 166 118 '
          + 'C150 148 110 160 70 156 C34 152 12 140 12 118 Z' },
      { layer: 'front', g: 'eye', d: circle(40, 112, 5) },
    ],
    lines: ['M24 134 C42 144 64 146 86 142',
            'M60 58 C58 46 52 38 44 34 M60 58 C62 46 68 38 76 34'],
  },
  elephant: {
    label: 'Elephant', kind: 'animal', heart: [140, 100],
    parts: [
      { layer: 'pattern', d: 'M70 40 C100 30 150 36 172 60 C188 78 190 110 180 128 '
          + 'L178 176 C178 182 158 182 156 176 L154 142 C140 146 120 146 108 142 '
          + 'L106 176 C106 182 86 182 84 176 L80 130 C70 126 62 120 58 112 '
          + 'C56 130 56 150 60 166 C62 174 52 178 46 172 C40 154 38 132 40 112 '
          + 'C36 80 46 52 70 40 Z' },
      { layer: 'front', g: 'ear', d: 'M76 58 C96 48 122 56 122 82 C122 104 106 118 90 118 '
          + 'C80 108 74 90 76 58 Z' },
      { layer: 'front', g: 'eye', d: circle(60, 74, 4) },
    ],
    lines: ['M184 100 C194 108 194 120 190 128'],
  },
  rabbit: {
    label: 'Rabbit', kind: 'animal', heart: [100, 126],
    parts: [
      { layer: 'back', g: 'ears', d: ellipse(76, 52, 16, 44, -10) },
      { layer: 'back', g: 'ears', d: ellipse(124, 52, 16, 44, 10) },
      { layer: 'back', g: 'inner-ears', d: ellipse(77, 54, 7, 32, -10) },
      { layer: 'back', g: 'inner-ears', d: ellipse(123, 54, 7, 32, 10) },
      { layer: 'pattern', d: ellipse(100, 128, 60, 56) },
      { layer: 'front', g: 'eyes', d: circle(78, 118, 8) },
      { layer: 'front', g: 'eyes', d: circle(122, 118, 8) },
      { layer: 'front', g: 'nose', d: ellipse(100, 140, 8, 5) },
    ],
    lines: ['M100 145 L100 152 M100 152 C95 157 89 157 86 153 M100 152 C105 157 111 157 114 153',
            'M76 146 L36 140 M76 152 L38 160 M124 146 L164 140 M124 152 L162 160'],
  },
  fox: {
    label: 'Fox', kind: 'animal', heart: [100, 110],
    parts: [
      { layer: 'pattern', d: sym([100, 58], [
        [112, 56, 124, 54, 136, 50], [148, 38, 160, 24, 172, 12],
        [176, 36, 174, 58, 166, 76], [178, 92, 188, 106, 194, 118],
        [168, 126, 142, 140, 114, 170], [110, 176, 105, 180, 100, 180]]) },
      { layer: 'front', g: 'eyes', d: ellipse(76, 106, 11, 7, 20) },
      { layer: 'front', g: 'eyes', d: ellipse(124, 106, 11, 7, -20) },
      { layer: 'front', g: 'pupils', d: circle(77, 106, 3.5) },
      { layer: 'front', g: 'pupils', d: circle(123, 106, 3.5) },
      { layer: 'front', g: 'nose', d: ellipse(100, 172, 9, 6) },
    ],
  },
  horse: {
    label: 'Horse', kind: 'animal', heart: [128, 124],
    parts: [
      { layer: 'back', g: 'mane', d: 'M112 26 C146 28 174 52 186 84 C194 114 194 156 194 192 '
          + 'L176 192 C176 150 172 110 162 86 C152 64 136 50 116 44 Z' },
      { layer: 'pattern', d: 'M108 10 L122 40 C142 46 160 62 170 86 C180 112 184 150 186 192 '
          + 'L96 192 C100 172 98 152 90 136 C78 130 60 134 42 138 C26 140 14 130 16 116 '
          + 'C18 102 32 88 48 74 C64 58 82 40 100 34 Z' },
      { layer: 'front', g: 'eye', d: ellipse(88, 70, 8, 6, -20) },
      { layer: 'front', g: 'pupil', d: circle(89, 70, 3) },
      { layer: 'front', g: 'nostril', d: ellipse(30, 118, 5, 7, 20) },
    ],
    lines: ['M22 132 C30 136 38 136 44 134'],
  },
  bear: {
    label: 'Bear', kind: 'animal', heart: [100, 100],
    parts: [
      { layer: 'back', g: 'ears', d: circle(50, 56, 24) },
      { layer: 'back', g: 'ears', d: circle(150, 56, 24) },
      { layer: 'back', g: 'inner-ears', d: circle(52, 58, 12) },
      { layer: 'back', g: 'inner-ears', d: circle(148, 58, 12) },
      { layer: 'pattern', d: ellipse(100, 114, 70, 64) },
      { layer: 'front', g: 'muzzle', d: ellipse(100, 146, 26, 20) },
      { layer: 'front', g: 'nose', d: ellipse(100, 138, 10, 7) },
      { layer: 'front', g: 'eyes', d: circle(74, 106, 6) },
      { layer: 'front', g: 'eyes', d: circle(126, 106, 6) },
    ],
    lines: ['M100 145 L100 154 M100 154 C95 160 89 160 86 156 M100 154 C105 160 111 160 114 156'],
  },
  deer: {
    label: 'Deer', kind: 'animal', heart: [100, 104],
    parts: [
      { layer: 'back', g: 'ears', d: ellipse(50, 74, 28, 12, 20) },
      { layer: 'back', g: 'ears', d: ellipse(150, 74, 28, 12, -20) },
      { layer: 'pattern', d: sym([100, 46], [
        [122, 46, 142, 54, 150, 72], [160, 94, 154, 120, 140, 140],
        [128, 156, 118, 170, 112, 180], [108, 186, 104, 188, 100, 188]]) },
      { layer: 'front', g: 'eyes', d: ellipse(80, 104, 7, 9) },
      { layer: 'front', g: 'eyes', d: ellipse(120, 104, 7, 9) },
      { layer: 'front', g: 'nose', d: ellipse(100, 176, 12, 9) },
    ],
    lines: ['M116 52 C122 36 132 22 148 10 M126 34 C136 32 146 28 154 22 M136 20 C136 12 134 6 130 2',
            'M84 52 C78 36 68 22 52 10 M74 34 C64 32 54 28 46 22 M64 20 C64 12 66 6 70 2'],
  },
  penguin: {
    label: 'Penguin', kind: 'animal', heart: [100, 126],
    parts: [
      { layer: 'back', g: 'feet', d: ellipse(80, 186, 16, 7) },
      { layer: 'back', g: 'feet', d: ellipse(120, 186, 16, 7) },
      { layer: 'back', g: 'wings', d: ellipse(48, 120, 12, 40, 18) },
      { layer: 'back', g: 'wings', d: ellipse(152, 120, 12, 40, -18) },
      { layer: 'back', g: 'body', d: sym([100, 14], [
        [130, 14, 146, 42, 148, 70], [164, 102, 164, 150, 150, 174],
        [138, 190, 118, 192, 100, 192]]) },
      { layer: 'pattern', d: ellipse(100, 126, 40, 58) },
      { layer: 'front', g: 'eyes', d: circle(84, 42, 7) },
      { layer: 'front', g: 'eyes', d: circle(116, 42, 7) },
      { layer: 'front', g: 'beak', d: 'M90 54 L110 54 L100 66 Z' },
    ],
    dots: [[85, 43, 3], [115, 43, 3]],
  },
  hedgehog: {
    label: 'Hedgehog', kind: 'animal', heart: [112, 128],
    parts: [
      { layer: 'back', g: 'feet', d: ellipse(80, 170, 12, 7) },
      { layer: 'back', g: 'feet', d: ellipse(150, 170, 12, 7) },
      { layer: 'pattern', d: (() => {
        const pts = [];
        for (let j = 0; j <= 36; j++) {
          const a = Math.PI + Math.PI * j / 36, rr = j % 2 ? 72 : 86;
          pts.push([112 + rr * Math.cos(a) * .96, 150 + rr * Math.sin(a) * 1.1]);
        }
        pts.push([186, 166], [44, 166]);
        return poly(pts);
      })() },
      { layer: 'front', g: 'face', d: 'M66 104 C50 108 24 130 10 150 C28 164 56 168 78 162 C86 144 82 120 66 104 Z' },
      { layer: 'front', g: 'nose', d: circle(12, 150, 5) },
      { layer: 'front', g: 'eye', d: circle(46, 136, 4) },
    ],
  },

  /* ----------------------------------------------------------------- plants */
  leaf: {
    label: 'Leaf', kind: 'plant', heart: [100, 100],
    parts: [
      { layer: 'back', g: 'stem', d: 'M36 160 L14 186 L20 190 L42 166 Z' },
      { layer: 'pattern', d: 'M34 166 C18 110 60 36 180 18 C168 132 96 184 34 166 Z' },
    ],
  },
  tulip: {
    label: 'Tulip', kind: 'plant', heart: [100, 78],
    parts: [
      { layer: 'back', g: 'stem', d: 'M96 118 L95 192 L105 192 L104 118 Z' },
      { layer: 'back', g: 'leaves', d: 'M97 184 C70 178 50 160 42 128 C68 136 88 154 97 184 Z' },
      { layer: 'back', g: 'leaves', d: 'M103 168 C124 162 144 144 152 116 C128 124 110 142 103 168 Z' },
      { layer: 'pattern', d: sym([100, 18], [
        [110, 30, 116, 42, 118, 52], [128, 36, 138, 26, 150, 18],
        [158, 50, 156, 90, 140, 108], [128, 120, 114, 124, 100, 124]]) },
    ],
  },
  tree: {
    label: 'Tree', kind: 'plant', heart: [100, 86],
    parts: [
      { layer: 'back', g: 'trunk', d: 'M88 140 C90 160 86 178 72 190 L128 190 C114 178 110 160 112 140 Z' },
      { layer: 'pattern', d: polar(100, 86, a => 74 + 5 * Math.cos(9 * (a + Math.PI / 2))) },
    ],
    lines: ['M60 190 L140 190'],
  },
  lotus: {
    label: 'Lotus', kind: 'plant', heart: [100, 110],
    parts: [
      { layer: 'back', g: 'pad', d: ellipse(100, 166, 84, 16) },
      { layer: 'pattern', d: sym([100, 22], [
        [114, 40, 120, 62, 118, 84], [128, 64, 144, 48, 164, 40],
        [166, 64, 158, 86, 144, 100], [162, 96, 180, 98, 194, 104],
        [180, 130, 150, 150, 100, 152]]) },
    ],
  },
  mushroom: {
    label: 'Mushroom', kind: 'plant', heart: [100, 80],
    parts: [
      { layer: 'back', g: 'stem', d: 'M76 112 C72 144 70 170 66 188 L134 188 C130 170 128 144 124 112 Z' },
      { layer: 'pattern', d: sym([100, 20], [
        [146, 20, 188, 56, 192, 104], [192, 118, 176, 120, 160, 118],
        [140, 116, 120, 114, 100, 114]]) },
    ],
  },
  apple: {
    label: 'Apple', kind: 'plant', heart: [100, 112],
    parts: [
      { layer: 'back', g: 'stem', d: 'M97 56 C96 44 94 34 88 24 L94 21 C101 32 103 44 104 56 Z' },
      { layer: 'back', g: 'leaf', d: 'M100 38 C112 20 136 14 150 20 C140 38 118 44 100 38 Z' },
      { layer: 'pattern', d: sym([100, 54], [
        [118, 40, 164, 36, 176, 76], [186, 110, 170, 156, 142, 176],
        [126, 188, 112, 184, 100, 178]]) },
    ],
  },
  sunflower: {
    label: 'Sunflower', kind: 'plant', heart: [100, 78],
    parts: [
      { layer: 'back', g: 'stem', d: 'M96 140 L95 196 L105 196 L104 140 Z' },
      { layer: 'back', g: 'leaves', d: 'M97 178 C76 178 56 166 44 146 C68 146 86 158 97 178 Z' },
      { layer: 'back', g: 'leaves', d: 'M103 166 C124 166 144 154 156 134 C132 134 114 146 103 166 Z' },
      { layer: 'pattern', d: polar(100, 78, a => 50 + 28 * Math.abs(Math.cos(10 * (a + Math.PI / 2))) ** .6, 360) },
    ],
  },
  rose: {
    label: 'Rose', kind: 'plant', heart: [100, 70],
    parts: [
      { layer: 'back', g: 'stem', d: 'M96 112 C94 140 96 170 94 196 L104 196 C106 170 104 140 104 112 Z' },
      { layer: 'back', g: 'thorns', d: 'M104 146 L114 140 L104 138 Z' },
      { layer: 'back', g: 'thorns', d: 'M96 170 L86 164 L96 162 Z' },
      { layer: 'back', g: 'leaves', d: 'M98 150 C82 136 60 132 42 140 C56 156 80 162 98 150 Z' },
      { layer: 'back', g: 'leaves', d: 'M102 128 C118 112 140 108 158 116 C144 132 120 138 102 128 Z' },
      { layer: 'back', g: 'sepals', d: 'M70 104 C82 118 118 118 130 104 L100 124 Z' },
      { layer: 'pattern', d: sym([100, 26], [
        [116, 18, 134, 24, 136, 40], [148, 30, 164, 32, 172, 44],
        [172, 72, 150, 96, 126, 106], [118, 110, 108, 112, 100, 112]]) },
      { layer: 'front', g: 'bud', d: 'M74 46 C70 26 90 14 110 18 C128 22 136 40 126 52 '
          + 'C118 62 100 60 98 50 C96 42 106 36 112 42 C110 32 96 30 88 38 C82 44 84 54 90 60 '
          + 'C82 58 76 52 74 46 Z' },
    ],
  },
  cactus: {
    label: 'Cactus', kind: 'plant', heart: [100, 96],
    parts: [
      { layer: 'pattern', d: 'M100 14 C112 14 120 22 120 34 L120 92 L140 92 C144 92 146 90 146 86 '
          + 'L146 54 C146 44 152 40 158 40 C164 40 170 44 170 54 L170 94 C170 108 160 116 146 116 '
          + 'L120 116 L120 168 L80 168 L80 130 L54 130 C40 130 30 122 30 108 L30 68 '
          + 'C30 58 36 54 42 54 C48 54 54 58 54 68 L54 106 L80 106 L80 34 C80 22 88 14 100 14 Z' },
      { layer: 'front', g: 'pot', d: 'M64 170 L136 170 L128 196 L72 196 Z' },
      { layer: 'front', g: 'rim', d: 'M58 158 L142 158 L142 172 L58 172 Z' },
    ],
  },
  acorn: {
    label: 'Acorn', kind: 'plant', heart: [100, 122],
    parts: [
      { layer: 'pattern', d: sym([100, 60], [
        [132, 60, 152, 84, 152, 116], [152, 152, 126, 178, 100, 194]]) },
      { layer: 'front', g: 'cap', d: 'M40 74 C40 42 68 26 100 26 C132 26 160 42 160 74 '
          + 'C140 86 60 86 40 74 Z' },
      { layer: 'front', g: 'stem', d: 'M95 28 C95 18 99 10 107 5 L112 9 C106 14 104 20 104 28 Z' },
    ],
  },
  pineapple: {
    label: 'Pineapple', kind: 'plant', heart: [100, 130],
    parts: [
      { layer: 'back', g: 'crown', d: poly([[70, 78], [44, 38], [78, 60], [70, 14], [90, 50],
        [100, 4], [110, 50], [130, 14], [122, 60], [156, 38], [130, 78]]) },
      { layer: 'pattern', d: ellipse(100, 132, 50, 62) },
    ],
  },
  clover: {
    label: 'Clover', kind: 'plant', heart: [100, 88],
    parts: [
      { layer: 'back', g: 'stem', d: 'M97 120 C98 150 110 176 132 194 L140 188 C118 172 106 148 105 120 Z' },
      { layer: 'pattern', d: polar(100, 88, a => {
        const t = Math.abs(Math.cos(1.5 * (a + Math.PI / 2)));
        return 18 + 70 * Math.sqrt(t) * (1 - .18 * (1 - Math.abs(Math.cos(3 * (a + Math.PI / 2 + Math.PI / 3)))) ** 8);
      }, 288) },
    ],
  },

  /* ---------------------------------------------------------------- symbols */
  heart: {
    label: 'Heart', kind: 'symbol', heart: [100, 102],
    parts: [{ layer: 'pattern', d: sym([100, 56], [
      [114, 30, 152, 20, 176, 40], [198, 60, 192, 104, 164, 132],
      [144, 152, 118, 168, 100, 184]]) }],
  },
  star: {
    label: 'Star', kind: 'symbol', heart: [100, 108],
    parts: [{ layer: 'pattern', d: star(100, 108, 94, 44) }],
  },
  moon: {
    label: 'Crescent Moon', kind: 'symbol', heart: [52, 116],
    parts: [{ layer: 'pattern', d: crescent(100, 100, 88, 138, 76, 70) }],
    dots: [[150, 92, 4], [128, 58, 3], [170, 130, 3]],
  },
  drop: {
    label: 'Raindrop', kind: 'symbol', heart: [100, 126],
    parts: [{ layer: 'pattern', d: sym([100, 10], [
      [112, 42, 162, 88, 162, 126], [162, 162, 134, 190, 100, 190]]) }],
  },
  hamsa: {
    label: 'Open Hand', kind: 'symbol', heart: [100, 128],
    parts: [{ layer: 'pattern', d: sym([100, 12], [
      [108, 12, 114, 17, 114, 26], [114, 40, 114, 56, 114, 70],
      [115, 58, 115, 46, 116, 36], [116, 27, 122, 22, 128, 22],
      [134, 22, 140, 27, 140, 36], [140, 52, 140, 66, 140, 82],
      [148, 74, 158, 66, 166, 68], [176, 70, 178, 82, 172, 92],
      [162, 108, 160, 122, 160, 138], [160, 160, 146, 174, 128, 178],
      [126, 182, 124, 186, 124, 190], [116, 190, 108, 190, 100, 190]]) }],
  },
};

/* ------------------------------------------------------------- geometry */
/* A path (M L C Q Z, absolute) as polygons, for inside() tests. */
export function flatten(d) {
  const nums = d.match(/[MLCQZ]|-?\d*\.?\d+/g);
  const polys = [];
  let cur = null, x = 0, y = 0, cmd = null, j = 0;
  const num = () => parseFloat(nums[j++]);
  while (j < nums.length) {
    if (/[MLCQZ]/.test(nums[j])) cmd = nums[j++];
    if (cmd === 'M') { x = num(); y = num(); cur = [[x, y]]; polys.push(cur); cmd = 'L'; }
    else if (cmd === 'L') { x = num(); y = num(); cur.push([x, y]); }
    else if (cmd === 'C' || cmd === 'Q') {
      const p = cmd === 'C' ? [num(), num(), num(), num(), num(), num()] : [num(), num(), num(), num()];
      const [x0, y0] = [x, y];
      for (let t = 1; t <= 12; t++) {
        const u = t / 12, v = 1 - u;
        if (cmd === 'C') cur.push([
          v*v*v*x0 + 3*v*v*u*p[0] + 3*v*u*u*p[2] + u*u*u*p[4],
          v*v*v*y0 + 3*v*v*u*p[1] + 3*v*u*u*p[3] + u*u*u*p[5]]);
        else cur.push([v*v*x0 + 2*v*u*p[0] + u*u*p[2], v*v*y0 + 2*v*u*p[1] + u*u*p[3]]);
      }
      [x, y] = cmd === 'C' ? [p[4], p[5]] : [p[2], p[3]];
    } else if (cmd === 'Z') { cmd = null; }
    else j++;
  }
  return polys;
}

/* Even-odd point-in-polygon over every subpath. */
export function inside(polys, px, py) {
  let hit = false;
  for (const pts of polys)
    for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
      const [xa, ya] = pts[a], [xb, yb] = pts[b];
      if ((ya > py) !== (yb > py) && px < (xb - xa) * (py - ya) / (yb - ya) + xa) hit = !hit;
    }
  return hit;
}
