// Offsetting a closed sketch shape, as sketchers do to draw a wall: the same outline a distance outside it
// (or inside, negative), as a shape of its own beside it — the profile then has the ring between them.
// Rectangles, circles and slots keep their kind; an outline has each edge moved out along its normal — a
// line parallel, an arc about its centre — with new corners where the moved pieces meet (cut back, or run on
// to meet across the gap); where an arc joins its neighbour tangentially (a rounded corner) they still meet there.
import type { SketchShape } from '../viewport/Viewport';
import { arcOf } from './profile';

type P2 = [number, number];
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** The shape offset by `d` mm (outward when positive), or why it cannot be. */
export function offsetShape(s: SketchShape, d: number): { shape: SketchShape } | { error: string } {
  if (!Number.isFinite(d) || d === 0) return { error: 'Give the offset a distance (negative goes inside).' };
  switch (s.kind) {
    case 'rectangle': {
      const lo: P2 = [Math.min(s.a[0], s.b[0]) - d, Math.min(s.a[1], s.b[1]) - d], hi: P2 = [Math.max(s.a[0], s.b[0]) + d, Math.max(s.a[1], s.b[1]) + d];
      if (!(hi[0] - lo[0] > 0.01 && hi[1] - lo[1] > 0.01)) return { error: 'That offset closes the rectangle up.' };
      return { shape: { kind: 'rectangle', a: [r6(lo[0]), r6(lo[1])], b: [r6(hi[0]), r6(hi[1])] } };
    }
    case 'circle': return s.r + d > 0.01 ? { shape: { kind: 'circle', c: s.c, r: r6(s.r + d) } } : { error: 'That offset closes the circle up.' };
    case 'slot': return s.r + d > 0.01 ? { shape: { kind: 'slot', a: s.a, b: s.b, r: r6(s.r + d) } } : { error: 'That offset closes the slot up.' };
    case 'polygon': {
      if (!s.closed) return { error: 'Close the outline first: only closed shapes are offset.' };
      const pts = s.points, n = pts.length;
      if (s.bulges?.some(b => b)) return offsetArcs(pts, s.bulges, d);
      const area = pts.reduce((t, p, i) => { const q = pts[(i + 1) % n]; return t + p[0] * q[1] - q[0] * p[1]; }, 0) / 2, out = area > 0 ? 1 : -1;
      // Each edge moved out (right-hand normal of a clockwise run, left of a counter-clockwise one).
      const lines = pts.map((p, i) => {
        const q = pts[(i + 1) % n], l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, nx = (q[1] - p[1]) / l * out, ny = -(q[0] - p[0]) / l * out;
        return { p: [p[0] + nx * d, p[1] + ny * d] as P2, dir: [(q[0] - p[0]) / l, (q[1] - p[1]) / l] as P2 };
      });
      const corners: P2[] = [];
      for (let i = 0; i < n; i++) {
        const a = lines[(i - 1 + n) % n], b = lines[i], den = a.dir[0] * b.dir[1] - a.dir[1] * b.dir[0];
        if (Math.abs(den) < 1e-9) { corners.push(b.p); continue; } // straight on: no corner
        const t = ((b.p[0] - a.p[0]) * b.dir[1] - (b.p[1] - a.p[1]) * b.dir[0]) / den;
        corners.push([r6(a.p[0] + a.dir[0] * t), r6(a.p[1] + a.dir[1] * t)]);
      }
      // An offset that turns an edge round (inside too far) is refused.
      const area2 = corners.reduce((t, p, i) => { const q = corners[(i + 1) % n]; return t + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
      if (Math.sign(area2) !== Math.sign(area) || Math.abs(area2) < 0.01) return { error: 'That offset turns the outline inside out: use a smaller one.' };
      for (let i = 0; i < n; i++) {
        const e0 = [pts[(i + 1) % n][0] - pts[i][0], pts[(i + 1) % n][1] - pts[i][1]], e1 = [corners[(i + 1) % n][0] - corners[i][0], corners[(i + 1) % n][1] - corners[i][1]];
        if (e0[0] * e1[0] + e0[1] * e1[1] <= 0) return { error: 'That offset turns an edge of the outline round: use a smaller one.' };
      }
      return { shape: { kind: 'polygon', points: corners, closed: true, bulges: corners.map(() => 0) } };
    }
  }
}

/** An outline with arcs offset by `d`: each piece along its own normals (a line parallel, an arc about its
 * centre); at a tangent joint the moved pieces still meet, at a corner they are cut or run on to meet. */
function offsetArcs(pts: P2[], bulges: number[], d: number): { shape: SketchShape } | { error: string } {
  const n = pts.length;
  const area = pts.reduce((t, p, i) => { const q = pts[(i + 1) % n]; return t + p[0] * q[1] - q[0] * p[1]; }, 0) / 2, out = area > 0 ? 1 : -1;
  const normal = (t: P2): P2 => [t[1] * out, -t[0] * out];
  // Each piece's tangent where it starts and where it ends, and the piece moved: a line, or a circle.
  type Moved = { kind: 'line'; p: P2; dir: P2 } | { kind: 'circle'; c: P2; r: number };
  const pieces = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    if (!bulges[i]) {
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, t: P2 = [(q[0] - p[0]) / l, (q[1] - p[1]) / l], m = normal(t);
      return { a: t, b: t, moved: { kind: 'line', p: [p[0] + m[0] * d, p[1] + m[1] * d], dir: t } as Moved };
    }
    const arc = arcOf(p, q, bulges[i]), sg = Math.sign(arc.sweep), at = (ang: number): P2 => [-Math.sin(ang) * sg, Math.cos(ang) * sg];
    const a = at(arc.start), m = normal(a), c = arc.center, moved: P2 = [p[0] + m[0] * d, p[1] + m[1] * d];
    // An arc offset past its centre (inside its radius) closes up.
    if ((p[0] - c[0]) * (moved[0] - c[0]) + (p[1] - c[1]) * (moved[1] - c[1]) <= 0 || Math.hypot(moved[0] - c[0], moved[1] - c[1]) < 0.01) return null;
    return { a, b: at(arc.start + arc.sweep), arc, moved: { kind: 'circle', c, r: Math.hypot(moved[0] - c[0], moved[1] - c[1]) } as Moved };
  });
  if (pieces.some(x => !x)) return { error: 'That offset is more than an arc’s radius: use a smaller one.' };
  const P = pieces as NonNullable<(typeof pieces)[number]>[];
  const corners: P2[] = [], tangentAt: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const prev = P[(i - 1 + n) % n], cur = P[i], tIn = prev.b, tOut = cur.a, cross = tIn[0] * tOut[1] - tIn[1] * tOut[0], dotp = tIn[0] * tOut[0] + tIn[1] * tOut[1];
    const p = pts[i];
    tangentAt.push(Math.abs(cross) < 1e-6 && dotp > 0);
    if (tangentAt[i]) { const m = normal(tOut); corners.push([r6(p[0] + m[0] * d), r6(p[1] + m[1] * d)]); continue; }
    // A corner: where the two moved pieces meet (the meeting nearest the corner).
    const hits = meet(prev.moved, cur.moved);
    if (!hits.length) return { error: 'At a corner of this outline the offset pieces no longer meet: use a smaller offset.' };
    const best = hits.reduce((x, y) => Math.hypot(y[0] - p[0], y[1] - p[1]) < Math.hypot(x[0] - p[0], x[1] - p[1]) ? y : x);
    corners.push([r6(best[0]), r6(best[1])]);
  }
  // Each piece between its new corners: a line runs the same way; an arc, cut or run on, keeps its turn.
  const out2: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = corners[i], b = corners[(i + 1) % n], piece = P[i];
    if (!piece.arc) {
      const e0 = [pts[(i + 1) % n][0] - pts[i][0], pts[(i + 1) % n][1] - pts[i][1]];
      if (e0[0] * (b[0] - a[0]) + e0[1] * (b[1] - a[1]) <= 0) return { error: 'That offset turns an edge of the outline round: use a smaller one.' };
      out2.push(0); continue;
    }
    if (tangentAt[i] && tangentAt[(i + 1) % n]) { out2.push(bulges[i]); continue; }
    const c = piece.arc.center, sw0 = piece.arc.sweep, TAU = 2 * Math.PI;
    let sw = Math.atan2(b[1] - c[1], b[0] - c[0]) - Math.atan2(a[1] - c[1], a[0] - c[0]);
    sw = sw0 > 0 ? ((sw % TAU) + TAU) % TAU : -((((-sw) % TAU) + TAU) % TAU);
    if (Math.abs(sw) < 1e-6 || Math.abs(sw) > Math.abs(sw0) + Math.PI) return { error: 'That offset cuts an arc of the outline away: use a smaller one.' };
    out2.push(Math.round(Math.tan(sw / 4) * 1e9) / 1e9);
  }
  const area2 = corners.reduce((t, p, i) => { const q = corners[(i + 1) % n]; return t + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
  if (Math.sign(area2) !== Math.sign(area)) return { error: 'That offset turns the outline inside out: use a smaller one.' };
  return { shape: { kind: 'polygon', points: corners, closed: true, bulges: out2 } };
}

/** Where two moved pieces (lines and circles, unbounded) meet. */
function meet(a: { kind: 'line'; p: P2; dir: P2 } | { kind: 'circle'; c: P2; r: number }, b: typeof a): P2[] {
  if (a.kind === 'line' && b.kind === 'line') {
    const den = a.dir[0] * b.dir[1] - a.dir[1] * b.dir[0]; if (Math.abs(den) < 1e-12) return [];
    const t = ((b.p[0] - a.p[0]) * b.dir[1] - (b.p[1] - a.p[1]) * b.dir[0]) / den;
    return [[a.p[0] + a.dir[0] * t, a.p[1] + a.dir[1] * t]];
  }
  if (a.kind === 'circle' && b.kind === 'circle') {
    const dx = b.c[0] - a.c[0], dy = b.c[1] - a.c[1], D = Math.hypot(dx, dy); if (D < 1e-12) return [];
    const x = (a.r * a.r - b.r * b.r + D * D) / (2 * D), h2 = a.r * a.r - x * x; if (h2 < -1e-12) return [];
    const h = Math.sqrt(Math.max(0, h2)), mx = a.c[0] + x * dx / D, my = a.c[1] + x * dy / D;
    return [[mx + h * dy / D, my - h * dx / D], [mx - h * dy / D, my + h * dx / D]];
  }
  const L = (a.kind === 'line' ? a : b) as { p: P2; dir: P2 }, C = (a.kind === 'circle' ? a : b) as { c: P2; r: number };
  const f = [L.p[0] - C.c[0], L.p[1] - C.c[1]], B = f[0] * L.dir[0] + f[1] * L.dir[1], disc = B * B - (f[0] * f[0] + f[1] * f[1] - C.r * C.r);
  if (disc < -1e-12) return [];
  const s = Math.sqrt(Math.max(0, disc));
  return [-B - s, -B + s].map(t => [L.p[0] + L.dir[0] * t, L.p[1] + L.dir[1] * t] as P2);
}
