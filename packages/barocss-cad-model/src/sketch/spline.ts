import { r6Signed as r6 } from '../util/round';
// Splines in a sketch: a smooth curve through the clicked points, kept as the outline the kernel builds
// on — tangent arcs (biarcs): between each two points two arcs meet tangentially, the first leaving the
// point along the curve's tangent there and the second arriving along the next. Tangents are the chords
// round each point (Catmull–Rom), and the ends' follow the end chords. The result is a polygon outline
// with bulges, so it extrudes, dimensions and trims like any line-and-arc outline.
type P2 = [number, number];

const unit = (v: P2): P2 => { const l = Math.hypot(v[0], v[1]); return l > 0 ? [v[0] / l, v[1] / l] : [1, 0]; };
const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const dot = (a: P2, b: P2) => a[0] * b[0] + a[1] * b[1];
const cross = (a: P2, b: P2) => a[0] * b[1] - a[1] * b[0];

/** The arc from a to b leaving a along t, as a bulge (tan of a quarter of its sweep; 0 when straight). */
function bulgeLeaving(a: P2, t: P2, b: P2): number {
  const ch = sub(b, a); if (!(Math.hypot(ch[0], ch[1]) > 1e-12)) return 0;
  // The tangent turned to the chord: half the arc's sweep (anticlockwise positive).
  const half = Math.atan2(cross(t, ch), dot(t, ch));
  return Math.abs(half) < 1e-9 ? 0 : Math.tan(half / 2);
}

/** The points' tangents: along the chord through the neighbours; at an open curve's end, the next tangent reflected in the end chord. */
export function splineTangents(points: readonly P2[], closed: boolean): P2[] {
  const n = points.length;
  const inner = (i: number) => unit(sub(points[(i + 1) % n], points[(i - 1 + n) % n]));
  const reflect = (t: P2, chord: P2): P2 => { const c = unit(chord), k = 2 * dot(c, t); return unit([k * c[0] - t[0], k * c[1] - t[1]]); };
  return points.map((_, i) => {
    if (closed) return inner(i);
    if (n === 2) return unit(sub(points[1], points[0]));
    if (i === 0) return reflect(inner(1), sub(points[1], points[0]));
    if (i === n - 1) return reflect(inner(n - 2), sub(points[n - 1], points[n - 2]));
    return inner(i);
  });
}

/** Two tangent arcs from p1 (along t1) to p2 (arriving along t2), meeting at a joint: [joint, bulge1, bulge2]. */
function biarc(p1: P2, t1: P2, p2: P2, t2: P2): [P2, number, number] | null {
  const v = sub(p2, p1), t: P2 = [t1[0] + t2[0], t1[1] + t2[1]], vt = dot(v, t), vv = dot(v, v), c = 1 - dot(t1, t2);
  if (!(vv > 1e-18)) return null;
  // Equal tangent lengths d at both ends (Ryan Juckett's biarc).
  const d = c > 1e-12 ? (-vt + Math.sqrt(vt * vt + 2 * c * vv)) / (2 * c) : Math.abs(dot(v, t2)) > 1e-12 ? vv / (4 * dot(v, t2)) : NaN;
  if (!(d > 0) || !Number.isFinite(d)) return null;
  const q1: P2 = [p1[0] + d * t1[0], p1[1] + d * t1[1]], q2: P2 = [p2[0] - d * t2[0], p2[1] - d * t2[1]], joint: P2 = [(q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2];
  const tm = unit(sub(q2, q1));
  return [joint, bulgeLeaving(p1, t1, joint), bulgeLeaving(joint, tm, p2)];
}

/** The spline through the points as a polygon outline of tangent arcs (two per span; a straight span stays a line). */
export function splineOutline(points: readonly P2[], closed: boolean): { points: P2[]; bulges: number[] } {
  const pts = points.filter((p, i) => i === 0 || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 1e-9);
  if (closed && pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-9) pts.pop();
  if (pts.length < 2) return { points: [...pts], bulges: pts.map(() => 0) };
  const T = splineTangents(pts, closed), out: P2[] = [], bulges: number[] = [], spans = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < spans; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ba = biarc(a, T[i], b, T[(i + 1) % pts.length]);
    out.push(a);
    if (!ba || (Math.abs(ba[1]) < 1e-9 && Math.abs(ba[2]) < 1e-9)) { bulges.push(0); continue; }
    out.push([r6(ba[0][0]), r6(ba[0][1])]); bulges.push(ba[1], ba[2]);
  }
  if (!closed) { out.push(pts[pts.length - 1]); bulges.push(0); }
  return { points: out, bulges };
}
