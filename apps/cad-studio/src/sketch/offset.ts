// Offsetting a closed sketch shape, as sketchers do to draw a wall: the same outline a distance outside it
// (or inside, negative), as a shape of its own beside it — the profile then has the ring between them.
// Rectangles, circles and slots keep their kind; a straight-edged outline has each edge moved out along
// its normal and the corners where the moved edges meet.
import type { SketchShape } from '../viewport/Viewport';

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
      if (s.bulges?.some(b => b)) return { error: 'Outlines with arcs are not offset yet: offset straight-edged outlines, rectangles, circles and slots.' };
      const pts = s.points, n = pts.length;
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
