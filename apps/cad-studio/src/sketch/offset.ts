// Offsetting a closed sketch shape, as sketchers do to draw a wall: the same outline a distance outside it
// (or inside, negative), as a shape of its own beside it — the profile then has the ring between them.
// Rectangles, circles and slots keep their kind; an outline has each edge moved out along its normal — a
// line parallel, an arc about its centre — with new corners where moved lines meet; where an arc joins its
// neighbour tangentially (a rounded corner) the moved pieces still meet there.
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

/** An outline with arcs offset by `d`: each piece along its own normals; joints tangent, or line meeting line. */
function offsetArcs(pts: P2[], bulges: number[], d: number): { shape: SketchShape } | { error: string } {
  const n = pts.length;
  const area = pts.reduce((t, p, i) => { const q = pts[(i + 1) % n]; return t + p[0] * q[1] - q[0] * p[1]; }, 0) / 2, out = area > 0 ? 1 : -1;
  // Each piece's tangent where it starts and where it ends.
  const tangents = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    if (!bulges[i]) { const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, t: P2 = [(q[0] - p[0]) / l, (q[1] - p[1]) / l]; return { a: t, b: t }; }
    const arc = arcOf(p, q, bulges[i]), sg = Math.sign(arc.sweep), at = (ang: number): P2 => [-Math.sin(ang) * sg, Math.cos(ang) * sg];
    return { a: at(arc.start), b: at(arc.start + arc.sweep), arc };
  });
  const normal = (t: P2): P2 => [t[1] * out, -t[0] * out];
  const corners: P2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = tangents[(i - 1 + n) % n], cur = tangents[i], tIn = prev.b, tOut = cur.a, cross = tIn[0] * tOut[1] - tIn[1] * tOut[0], dotp = tIn[0] * tOut[0] + tIn[1] * tOut[1];
    const p = pts[i];
    if (Math.abs(cross) < 1e-6 && dotp > 0) { const m = normal(tOut); corners.push([r6(p[0] + m[0] * d), r6(p[1] + m[1] * d)]); continue; }
    if (bulges[(i - 1 + n) % n] || bulges[i]) return { error: 'An arc in this outline meets its neighbour at a corner: only rounded (tangent) arc joints are offset yet.' };
    // Two lines: where the moved lines meet.
    const m0 = normal(tIn), m1 = normal(tOut), a0: P2 = [p[0] + m0[0] * d, p[1] + m0[1] * d], b0: P2 = [p[0] + m1[0] * d, p[1] + m1[1] * d];
    const den = tIn[0] * tOut[1] - tIn[1] * tOut[0], t = ((b0[0] - a0[0]) * tOut[1] - (b0[1] - a0[1]) * tOut[0]) / den;
    corners.push([r6(a0[0] + tIn[0] * t), r6(a0[1] + tIn[1] * t)]);
  }
  // An arc offset past its centre (inside its radius) closes up.
  for (let i = 0; i < n; i++) {
    const arc = tangents[i].arc; if (!arc) continue;
    const c = arc.center, before = [pts[i][0] - c[0], pts[i][1] - c[1]], after = [corners[i][0] - c[0], corners[i][1] - c[1]];
    if (before[0] * after[0] + before[1] * after[1] <= 0 || Math.hypot(after[0], after[1]) < 0.01) return { error: 'That offset is more than an arc’s radius: use a smaller one.' };
  }
  const area2 = corners.reduce((t, p, i) => { const q = corners[(i + 1) % n]; return t + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
  if (Math.sign(area2) !== Math.sign(area)) return { error: 'That offset turns the outline inside out: use a smaller one.' };
  return { shape: { kind: 'polygon', points: corners, closed: true, bulges: [...bulges] } };
}
