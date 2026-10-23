// A profile swept along a curve (a path in 3D) as a faceted solid: the profile's middle starts on the
// path's start, square to it, and is carried along with a rotation-minimising frame (double reflection),
// so it does not twist about the path; the ends are capped flat. Holes in the profile run through as
// bores (a tube). Built as one closed mesh, sampled every so often along the path and round each loop.
import { brepFromTriangles } from './mesh/mesh-brep.js';
import { triangulatePolygonWithHoles } from './brep-tessellate.js';
import { curveDomain, evaluateCurve } from './math.js';
import { evaluateCurveD1 } from './derivatives.js';
import type { Brep } from './brep-core.js';
import type { Curve, Point } from './types.js';
import { cross, dot, sub } from './vec3.js';

type XY = [number, number];
export interface SweepSolidRequest {
  readonly id?: string;
  /** The profile in its plane's coordinates: an outer loop and holes (points in order, either way round). */
  readonly outer: readonly XY[]; readonly holes?: readonly (readonly XY[])[];
  /** The profile's plane in the world: its X and Y axes (unit, square) — X is carried along the path. */
  readonly xAxis: Point; readonly yAxis: Point;
  /** The path. */
  readonly path: Curve;
  /** Positions along the path (default from its length and the profile's size, 32 to 512). */
  readonly samples?: number;
}

const unit = (a: readonly number[]): Point => { const l = Math.hypot(a[0], a[1], a[2]); if (!(l > 0)) throw new RangeError('the path stops (a zero tangent)'); return [a[0] / l, a[1] / l, a[2] / l]; };
const along = (a: readonly number[], k: number, b: readonly number[]): Point => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];
const area = (r: readonly XY[]) => r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;

export function sweepSolid(req: SweepSolidRequest): Brep {
  if (req.outer.length < 3) throw new RangeError('the profile needs three or more points');
  // Outer loop anticlockwise, holes clockwise, all about the outer loop's middle.
  const outer0 = area(req.outer) > 0 ? [...req.outer] : [...req.outer].reverse();
  let cx = 0, cy = 0; for (const p of outer0) { cx += p[0]; cy += p[1]; } cx /= outer0.length; cy /= outer0.length;
  const shift = (r: readonly XY[]): XY[] => r.map(p => [p[0] - cx, p[1] - cy]);
  const loops = [shift(outer0), ...(req.holes ?? []).map(h => shift(area(h) < 0 ? h : [...h].reverse()))];
  const size = Math.max(...loops[0].map(p => Math.hypot(p[0], p[1])));
  // The path, sampled.
  const [t0, t1] = curveDomain(req.path), probe = Array.from({ length: 65 }, (_, k) => evaluateCurve(req.path, t0 + (t1 - t0) * k / 64));
  let length = 0; for (let k = 1; k < probe.length; k++) length += Math.hypot(...sub(probe[k], probe[k - 1]));
  if (!(length > 1e-9)) throw new RangeError('the path has no length');
  if (Math.hypot(...sub(probe[0], probe[64])) < 1e-9 * Math.max(1, length)) throw new RangeError('the path is closed: a closed sweep is not supported yet (open the path)');
  const N = req.samples ?? Math.max(32, Math.min(512, Math.ceil(length / Math.max(size / 3, length / 512))));
  const P = Array.from({ length: N + 1 }, (_, k) => evaluateCurve(req.path, t0 + (t1 - t0) * k / N));
  // Tangents: the curve's derivative; at a corner (a C0 knot, where it has none) the samples' difference.
  const T = P.map((_, k) => { try { return unit(evaluateCurveD1(req.path, t0 + (t1 - t0) * k / N).derivative); } catch { return unit(sub(P[Math.min(N, k + 1)], P[Math.max(0, k - 1)])); } });
  // The frames: X square to the start tangent (the profile's X, else its Y), then carried by double reflection.
  let x0 = sub(req.xAxis, along([0, 0, 0], dot(req.xAxis, T[0]), T[0]));
  if (Math.hypot(...x0) < 1e-6) x0 = sub(req.yAxis, along([0, 0, 0], dot(req.yAxis, T[0]), T[0]));
  const X: Point[] = [unit(x0)];
  for (let k = 0; k < N; k++) {
    const v1 = sub(P[k + 1], P[k]), c1 = dot(v1, v1);
    if (!(c1 > 0)) { X.push(X[k]); continue; }
    const rL = along(X[k], -2 / c1 * dot(v1, X[k]), v1), tL = along(T[k], -2 / c1 * dot(v1, T[k]), v1), v2 = sub(T[k + 1], tL), c2 = dot(v2, v2);
    X.push(unit(c2 > 1e-30 ? along(rL, -2 / c2 * dot(v2, rL), v2) : rL));
  }
  // Rings: every loop's points placed in each frame (Y = T × X).
  const pos: number[] = [], idx: number[] = [];
  const rings = P.map((p, k) => { const x = X[k], y = cross(T[k], x); return loops.map(l => l.map(([u, v]) => { pos.push(p[0] + u * x[0] + v * y[0], p[1] + u * x[1] + v * y[1], p[2] + u * x[2] + v * y[2]); return pos.length / 3 - 1; })); });
  for (let k = 0; k < N; k++) loops.forEach((l, li) => {
    const a = rings[k][li], b = rings[k + 1][li];
    for (let j = 0; j < l.length; j++) { const j1 = (j + 1) % l.length; idx.push(a[j], a[j1], b[j1], a[j], b[j1], b[j]); }
  });
  // Caps: the profile triangulated (holes cut out), facing back at the start and forward at the end.
  const tris = triangulatePolygonWithHoles(loops[0], loops.slice(1)), flat = loops.flat();
  const ccw = (t: readonly number[]) => (flat[t[1]][0] - flat[t[0]][0]) * (flat[t[2]][1] - flat[t[0]][1]) - (flat[t[2]][0] - flat[t[0]][0]) * (flat[t[1]][1] - flat[t[0]][1]) > 0;
  const at = (k: number) => rings[k].flat();
  for (const t of tris) {
    const [a, b, c] = ccw(t) ? t : [t[0], t[2], t[1]], s = at(0), e = at(N);
    idx.push(e[a], e[b], e[c], s[a], s[c], s[b]);
  }
  return brepFromTriangles(pos, idx, { id: req.id ?? 'sweep', maximumTriangles: 400_000 });
}
