// K4 (D143): the point of a NURBS surface nearest a given point — Gauss–Newton on the surface's exact first derivatives,
// from a seed (given, or the nearest node of a parameter grid), each step clamped to the domain. It replaces the studio's
// three projections (the draft field's, IM2; the trim loops', and the display mesh's chord measure, both on central
// differences). Gauss–Newton drops the second-derivative term of the distance's Hessian: it converges quadratically on
// the surface (a display mesh's vertex, a curve lying on it) and linearly off it, at a rate of about the distance times
// the curvature; a step that would take the surface farther is halved (beyond the radius of curvature the whole step
// overshoots). Exactly on a C0 knot (a circle's quadrant joins, G1 in space) the derivatives are taken just off it.
import { evaluateSurface, surfaceDomain } from './math.js';
import { evaluateSurfaceD1, type SurfaceD1Result } from './derivatives.js';
import { evaluateSurfaceD2, type SurfaceD2Result } from './second-derivatives.js';
import type { Point, Surface } from './types.js';

/** A surface's points on an (n + 1) × (n + 1) grid of its domain, for seeds: build once per surface, pass to every query. */
export interface SurfaceSeedGrid { readonly n: number; readonly u: readonly [number, number]; readonly v: readonly [number, number]; readonly points: Float64Array }
export function surfaceSeedGrid(surface: Surface, n = 24): SurfaceSeedGrid {
  const D = surfaceDomain(surface), points = new Float64Array(3 * (n + 1) * (n + 1));
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    const p = evaluateSurface(surface, D.u[0] + (D.u[1] - D.u[0]) * i / n, D.v[0] + (D.v[1] - D.v[0]) * j / n), k = 3 * (i * (n + 1) + j);
    points[k] = p[0]; points[k + 1] = p[1]; points[k + 2] = p[2];
  }
  return { n, u: D.u, v: D.v, points };
}

export interface SurfaceClosestPoint {
  readonly u: number; readonly v: number;
  /** The surface's point there, and its distance from the query point. */
  readonly point: Point; readonly distance: number;
  /** The unit normal du × dv there ([0, 0, 0] where the surface is degenerate, a pole). */
  readonly normal: Point;
  readonly iterations: number;
}
export interface SurfaceClosestOptions {
  /** Where to start; else the nearest node of `grid`. */
  readonly seed?: readonly [number, number];
  /** The seed grid (prebuilt, or its n; default 24) when no seed is given. */
  readonly grid?: SurfaceSeedGrid | number;
  /** At most this many steps (default 30). */
  readonly iterations?: number;
}

const NUDGE: readonly (readonly [number, number])[] = [[1e-11, 0], [-1e-11, 0], [0, 1e-11], [0, -1e-11], [1e-11, 1e-11], [-1e-11, -1e-11], [1e-11, -1e-11], [-1e-11, 1e-11]];
/** First derivatives at (u, v); exactly on a C0 knot, just off it inside the domain (the first nudge that evaluates). */
export function surfaceD1Near(surface: Surface, u: number, v: number, U: readonly [number, number], V: readonly [number, number]): SurfaceD1Result {
  try { return evaluateSurfaceD1(surface, u, v); } catch { /* on a C0 knot */ }
  for (const [eu, ev] of NUDGE) {
    const uu = Math.min(U[1], Math.max(U[0], u + eu * (U[1] - U[0]))), vv = Math.min(V[1], Math.max(V[0], v + ev * (V[1] - V[0])));
    try { return evaluateSurfaceD1(surface, uu, vv); } catch { /* the next */ }
  }
  throw new RangeError(`closestPointOnSurface: no first derivative near (${u}, ${v})`);
}

/** Second derivatives at (u, v), or null where they are not defined (a knot of too little continuity). */
function secondDerivatives(surface: Surface, u: number, v: number): SurfaceD2Result | null { try { return evaluateSurfaceD2(surface, u, v); } catch { return null; } }
const dist2 = (q: Point, x: number, y: number, z: number) => (q[0] - x) ** 2 + (q[1] - y) ** 2 + (q[2] - z) ** 2;
/** The point of `surface` nearest `p`, by Gauss–Newton from a seed (see the options). */
export function closestPointOnSurface(surface: Surface, p: ArrayLike<number>, options: SurfaceClosestOptions = {}): SurfaceClosestPoint {
  const x = p[0], y = p[1], z = p[2];
  let U: readonly [number, number], V: readonly [number, number], u: number, v: number;
  if (options.seed) { const D = surfaceDomain(surface); U = D.u; V = D.v; u = options.seed[0]; v = options.seed[1]; }
  else {
    const G = typeof options.grid === 'object' ? options.grid : surfaceSeedGrid(surface, options.grid ?? 24), P = G.points;
    U = G.u; V = G.v;
    let best = 0, bd = Infinity;
    for (let k = 0; k < P.length; k += 3) { const dx = P[k] - x, dy = P[k + 1] - y, dz = P[k + 2] - z, d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = k / 3; } }
    u = U[0] + (U[1] - U[0]) * Math.floor(best / (G.n + 1)) / G.n; v = V[0] + (V[1] - V[0]) * (best % (G.n + 1)) / G.n;
  }
  const steps = options.iterations ?? 30, scale = 1 + x * x + y * y + z * z;
  let it = 0, e = surfaceD1Near(surface, u, v, U, V), f2 = dist2(e.point, x, y, z), last = Infinity, lastRatio = 0;
  for (; it < steps; it++) {
    const rx = e.point[0] - x, ry = e.point[1] - y, rz = e.point[2] - z;
    const a = e.du[0] * e.du[0] + e.du[1] * e.du[1] + e.du[2] * e.du[2], b = e.du[0] * e.dv[0] + e.du[1] * e.dv[1] + e.du[2] * e.dv[2], c = e.dv[0] * e.dv[0] + e.dv[1] * e.dv[1] + e.dv[2] * e.dv[2];
    const gu = rx * e.du[0] + ry * e.du[1] + rz * e.du[2], gv = rx * e.dv[0] + ry * e.dv[1] + rz * e.dv[2], det = a * c - b * b;
    if (!(Math.abs(det) > 1e-300)) break;
    const du = -(c * gu - b * gv) / det, dv = -(a * gv - b * gu) / det;
    // The step taken whole when it brings the surface nearer (always, near the surface: Gauss–Newton's own iteration);
    // else halved until it does. Far from a convex surface — farther than its radius of curvature — the whole step
    // overshoots by about 1 + distance × curvature and would swing round the surface without converging.
    let t = 1, nu = u, nv = v, next = e, n2 = f2;
    for (let half = 0; half < 40; half++, t /= 2) {
      nu = Math.min(U[1], Math.max(U[0], u + t * du)); nv = Math.min(V[1], Math.max(V[0], v + t * dv));
      next = surfaceD1Near(surface, nu, nv, U, V); n2 = dist2(next.point, x, y, z);
      if (n2 <= f2 * (1 + 1e-12) + 1e-28 * scale) break;
    }
    // (The step as taken, clamped: at a domain edge the foot is on the edge and the raw step keeps pointing out.)
    let su = nu - u, sv = nv - v;
    const size = Math.abs(su) + Math.abs(sv);
    // Slow (two steps running shrinking by less than 3⅓: linear convergence — a point far off the surface, or near its centre of
    // curvature on the concave side, where Gauss–Newton's rate is about distance × curvature): Newton's step with the second derivatives
    // is tried too, where the full Hessian is positive definite, and kept when it ends nearer. (Second derivatives cost
    // some 30 first ones: only when needed.)
    const ratio = size / last;
    if (ratio > 0.3 && lastRatio > 0.3 && size > 1e-12 * (U[1] - U[0] + V[1] - V[0])) {
      const h = secondDerivatives(surface, u, v);
      if (h) {
        const A = a + rx * h.duu[0] + ry * h.duu[1] + rz * h.duu[2], B = b + rx * h.duv[0] + ry * h.duv[1] + rz * h.duv[2], C = c + rx * h.dvv[0] + ry * h.dvv[1] + rz * h.dvv[2], D = A * C - B * B;
        if (A > 0 && D > 0) {
          const wu = Math.min(U[1], Math.max(U[0], u - (C * gu - B * gv) / D)), wv = Math.min(V[1], Math.max(V[0], v - (A * gv - B * gu) / D)), w = surfaceD1Near(surface, wu, wv, U, V), w2 = dist2(w.point, x, y, z);
          if (w2 < n2) { su = wu - u; sv = wv - v; nu = wu; nv = wv; next = w; n2 = w2; }
        }
      }
    }
    last = size; lastRatio = ratio;
    u = nu; v = nv; e = next; f2 = n2;
    // (Done when the step is below rounding: 1e-15 of the parameters' own size.)
    if (Math.abs(su) + Math.abs(sv) < 1e-15 * (1 + Math.abs(u) + Math.abs(v))) { it++; break; }
  }
  const nx = e.du[1] * e.dv[2] - e.du[2] * e.dv[1], ny = e.du[2] * e.dv[0] - e.du[0] * e.dv[2], nz = e.du[0] * e.dv[1] - e.du[1] * e.dv[0], l = Math.hypot(nx, ny, nz);
  const normal: Point = l > 0 ? [nx / l, ny / l, nz / l] : [0, 0, 0];
  return { u, v, point: e.point, distance: Math.hypot(e.point[0] - x, e.point[1] - y, e.point[2] - z), normal, iterations: it };
}
