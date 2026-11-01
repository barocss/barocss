// Bézier curves of the sketcher (D354): a quadratic (3 control points) or cubic (4) curve of the sketch plane. The curve
// leaves the first control point along the first leg and arrives along the last, and does not pass through the middle ones.
import type { SketchPlane } from './plane';
import { toWorld } from './plane';
import type { NurbsCurve } from '../engine/curveSource';
import type { Vec3 } from '../engine/mesh';

type P2 = [number, number];

/** The point of the curve at t in [0, 1] (de Casteljau). */
export function bezierPoint(poles: readonly P2[], t: number): P2 {
  let q = poles.map(p => [p[0], p[1]] as P2);
  while (q.length > 1) q = q.slice(1).map((b, i) => [q[i][0] + (b[0] - q[i][0]) * t, q[i][1] + (b[1] - q[i][1]) * t] as P2);
  return q[0];
}

/** The derivative at t: n · de Casteljau of the leg vectors (n = degree). */
export function bezierTangent(poles: readonly P2[], t: number): P2 {
  const legs = poles.slice(1).map((b, i) => [b[0] - poles[i][0], b[1] - poles[i][1]] as P2);
  const d = bezierPoint(legs, t), n = poles.length - 1;
  return [n * d[0], n * d[1]];
}

/** n + 1 points along the curve at equal steps of t (display). */
export function bezierSamples(poles: readonly P2[], n = 32): P2[] {
  return Array.from({ length: n + 1 }, (_, k) => bezierPoint(poles, k / n));
}

/** The curve as one polynomial NURBS span in 3D: degree = poles − 1, knots 0…0 1…1, the poles on the plane, weights 1. Throws the `bezierError` reason for poles that make no curve. */
export function bezierCurve(plane: SketchPlane, poles: readonly P2[]): NurbsCurve {
  const why = bezierError(poles); if (why) throw new Error(why);
  const d = poles.length - 1;
  return { degree: d, knots: [...Array(d + 1).fill(0), ...Array(d + 1).fill(1)], points: poles.map(p => toWorld(plane, p) as Vec3), weights: poles.map(() => 1) };
}

const EPS = 1e-9;
const isP2 = (p: unknown): p is P2 => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);

/** A stored Bézier shape: kind 'bezier', 3 or 4 finite [x, y] poles (anything else is ignored on reopen and never drawn). */
export function wellFormedBezier(x: unknown): x is { kind: 'bezier'; poles: P2[] } {
  const s = x as { kind?: unknown; poles?: unknown } | null;
  return !!s && typeof s === 'object' && s.kind === 'bezier' && Array.isArray(s.poles) && (s.poles.length === 3 || s.poles.length === 4) && s.poles.every(isP2);
}

/** Why these poles make no usable curve, or null: not 3 or 4 points, all coincident, or end points that coincide with every pole on one line. */
export function bezierError(poles: unknown): string | null {
  if (!Array.isArray(poles) || !(poles.length === 3 || poles.length === 4) || !poles.every(isP2)) return 'A Bézier curve needs three or four finite control points.';
  const p = poles as P2[], d = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const far = p.reduce((m, q) => d(q, p[0]) > d(m, p[0]) ? q : m, p[0]), reach = d(far, p[0]);
  if (reach < EPS) return 'The control points all coincide: that is a point, not a curve.';
  if (d(p[0], p[p.length - 1]) < EPS) {
    const ux = (far[0] - p[0][0]) / reach, uy = (far[1] - p[0][1]) / reach;
    if (p.every(q => Math.abs((q[0] - p[0][0]) * uy - (q[1] - p[0][1]) * ux) < EPS)) return 'The end points coincide and the control points lie on a line: the curve doubles back on itself.';
  }
  return null;
}
