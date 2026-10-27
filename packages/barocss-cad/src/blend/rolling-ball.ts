// R10.2 (D89): the rolling ball between any two faces, and the fillet tool lofted from it. At stations along an edge
// chain the ball of radius r touching both faces is solved (its centre c = S_A + σ_A r n_A = S_B + σ_B r n_B, in the plane
// through the station square to the chain: four equations in the contacts' (u, v), by Newton); each station's section
// — the contacts, the faces' lines grown g outside the corner, their corner and the fillet arc — lies in the ball's
// plane through both contacts. The tool is lofted through the sections: cubic Hermite along the chain (tangents by a
// five-point stencil, so O(h⁴)), the arc rational quadratic in homogeneous coordinates, in patches within the 16-pole
// limit; its deviation from the true rolling-ball sections is measured at the stations between those it passes through.
import { BrepError, buildBrep, type Brep } from '../brep/brep-core.js';
import { faceGeometry } from '../brep/analytic-boolean.js';
import { basis, curveDomain, curveEvaluator, evaluateCurve, surfaceDomain, surfaceEvaluator } from '../core/math.js';
import { add, cross, dot, len, scale, sub, unit } from '../core/vec3.js';
import type { Curve, Point, Surface } from '../types.js';

type XY = [number, number];
/** A face's surface, ready to evaluate: clamped to its domain, its outward side `sense`. */
/** `pu`, `pv`: the surface closes on itself that way (a full turn): there the parameter wraps round its seam. */
export interface Sheet { readonly S: Surface; readonly at: (u: number, v: number) => Point; readonly u0: number; readonly u1: number; readonly v0: number; readonly v1: number; readonly sense: number; readonly hu: number; readonly hv: number; readonly pu: boolean; readonly pv: boolean }
export function sheetOf(S: Surface, sense: 'forward' | 'reversed'): Sheet {
  const { u: [u0, u1], v: [v0, v1] } = surfaceDomain(S), P = S.controlPoints, W = S.weights;
  let size = 1; for (const row of P) for (const q of row) for (const x of q) size = Math.max(size, Math.abs(x));
  const same = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= 1e-9 * size;
  const pu = P[0].every((q, j) => same(q, P[P.length - 1][j]) && W[0][j] === W[P.length - 1][j]), pv = P.every((row, i) => same(row[0], row[row.length - 1]) && W[i][0] === W[i][row.length - 1]);
  const at = surfaceEvaluator(S), wrap = (x: number, a: number, b: number) => a + ((((x - a) % (b - a)) + (b - a)) % (b - a));
  return { S, at: pu || pv ? (u, v) => at(pu ? wrap(u, u0, u1) : u, pv ? wrap(v, v0, v1) : v) : at, u0, u1, v0, v1, sense: sense === 'forward' ? 1 : -1, hu: 1e-6 * (u1 - u0), hv: 1e-6 * (v1 - v0), pu, pv };
}
const clampU = (s: Sheet, u: number) => s.pu ? u : Math.min(s.u1, Math.max(s.u0, u)), clampV = (s: Sheet, v: number) => s.pv ? v : Math.min(s.v1, Math.max(s.v0, v));
export function pointOn(s: Sheet, u: number, v: number): Point { return s.at(clampU(s, u), clampV(s, v)); }
/** ∂S/∂u at (u, v) (in the domain): central differences, second-order one-sided at its edges (none where it wraps). */
function partialU(s: Sheet, u: number, v: number): Point {
  const h = s.hu;
  if (!s.pu && u - h < s.u0) return scale(add(add(scale(s.at(u, v), -3), scale(s.at(u + h, v), 4)), scale(s.at(u + 2 * h, v), -1)), 1 / (2 * h));
  if (!s.pu && u + h > s.u1) return scale(add(add(scale(s.at(u, v), 3), scale(s.at(u - h, v), -4)), s.at(u - 2 * h, v)), 1 / (2 * h));
  return scale(sub(s.at(u + h, v), s.at(u - h, v)), 1 / (2 * h));
}
function partialV(s: Sheet, u: number, v: number): Point {
  const h = s.hv;
  if (!s.pv && v - h < s.v0) return scale(add(add(scale(s.at(u, v), -3), scale(s.at(u, v + h), 4)), scale(s.at(u, v + 2 * h), -1)), 1 / (2 * h));
  if (!s.pv && v + h > s.v1) return scale(add(add(scale(s.at(u, v), 3), scale(s.at(u, v - h), -4)), s.at(u, v - 2 * h)), 1 / (2 * h));
  return scale(sub(s.at(u, v + h), s.at(u, v - h)), 1 / (2 * h));
}
/** The outward unit normal. */
export function normalOn(s: Sheet, u: number, v: number): Point {
  const uu = clampU(s, u), vv = clampV(s, v);
  return scale(unit(cross(partialU(s, uu, vv), partialV(s, uu, vv))), s.sense);
}
/** (u, v) of the surface point nearest x: from `hint`, else the nearest of a 24 × 24 grid; Gauss–Newton. */
export function invertOn(s: Sheet, x: Point, hint?: XY): XY {
  let u = clampU(s, hint?.[0] ?? 0), v = clampV(s, hint?.[1] ?? 0);
  if (!hint) {
    let best = Infinity;
    for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) {
      const uu = s.u0 + (s.u1 - s.u0) * i / 24, vv = s.v0 + (s.v1 - s.v0) * j / 24, d = len(sub(s.at(uu, vv), x));
      if (d < best) { best = d; u = uu; v = vv; }
    }
  }
  for (let k = 0; k < 40; k++) {
    const p = pointOn(s, u, v), su = partialU(s, u, v), sv = partialV(s, u, v), e = sub(x, p);
    const g11 = dot(su, su), g12 = dot(su, sv), g22 = dot(sv, sv), r1 = dot(su, e), r2 = dot(sv, e), det = g11 * g22 - g12 * g12;
    if (!(Math.abs(det) > 0)) break;
    const du = (g22 * r1 - g12 * r2) / det, dv = (g11 * r2 - g12 * r1) / det;
    u = clampU(s, u + du); v = clampV(s, v + dv);
    if (Math.abs(du) <= 1e-15 * (s.u1 - s.u0 + 1) && Math.abs(dv) <= 1e-15 * (s.v1 - s.v0 + 1)) break;
  }
  return [u, v];
}

/** One rolling-ball station: the chain's point X and tangent t, the ball's centre and its contacts on A and B. */
export interface Station { readonly X: Point; readonly t: Point; readonly c: Point; readonly pA: Point; readonly pB: Point; readonly uvA: XY; readonly uvB: XY; readonly nA: Point; readonly nB: Point }
/** The ball's offset point from a face's (u, v): S + σ r n. */
function offsetPoint(s: Sheet, sigma: number, r: number, u: number, v: number): Point { return add(pointOn(s, u, v), scale(normalOn(s, u, v), sigma * r)); }
/** F(q) for q = (uA, vA, uB, vB): the centres' difference and the station plane. */
function residual(A: Sheet, sA: number, B: Sheet, sB: number, r: number, X: Point, t: Point, q: readonly number[]): number[] {
  const ca = offsetPoint(A, sA, r, q[0], q[1]), cb = offsetPoint(B, sB, r, q[2], q[3]);
  return [ca[0] - cb[0], ca[1] - cb[1], ca[2] - cb[2], dot(sub(ca, X), t)];
}
const clampQ = (A: Sheet, B: Sheet, q: readonly number[]) => [clampU(A, q[0]), clampV(A, q[1]), clampU(B, q[2]), clampV(B, q[3])];
/** x with M x = b (4 × 4, partial pivoting), or null when singular. */
function solve4(M: number[][], b: number[]): number[] | null {
  const a = M.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < 4; k++) {
    let p = k; for (let i = k + 1; i < 4; i++) if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i;
    if (!(Math.abs(a[p][k]) > 1e-300)) return null;
    [a[k], a[p]] = [a[p], a[k]];
    for (let i = k + 1; i < 4; i++) { const f = a[i][k] / a[k][k]; for (let j = k; j < 5; j++) a[i][j] -= f * a[k][j]; }
  }
  const x = [0, 0, 0, 0];
  for (let i = 3; i >= 0; i--) { let s = a[i][4]; for (let j = i + 1; j < 4; j++) s -= a[i][j] * x[j]; x[i] = s / a[i][i]; }
  return x;
}
const norm = (f: readonly number[]) => Math.hypot(...f);
/**
 * The ball of radius r touching A and B (σ = −1: inside the material, a convex edge; +1 outside, a concave one) whose
 * centre lies in the plane through X square to t, from the contacts' seeds; null when Newton does not converge.
 */
export function solveStation(A: Sheet, sA: number, B: Sheet, sB: number, r: number, X: Point, t: Point, seedA: XY, seedB: XY, size: number): Station | null {
  let q = clampQ(A, B, [seedA[0], seedA[1], seedB[0], seedB[1]]), f = residual(A, sA, B, sB, r, X, t, q);
  const hs = [10 * A.hu, 10 * A.hv, 10 * B.hu, 10 * B.hv], tol = 1e-12 * size;
  for (let it = 0; it < 40 && norm(f) > tol; it++) {
    const J = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    for (let k = 0; k < 4; k++) {
      // (Clamped to the domains: at an edge the difference is one-sided, over the step actually taken.)
      const qp = clampQ(A, B, [k === 0 ? q[0] + hs[0] : q[0], k === 1 ? q[1] + hs[1] : q[1], k === 2 ? q[2] + hs[2] : q[2], k === 3 ? q[3] + hs[3] : q[3]]);
      const qm = clampQ(A, B, [k === 0 ? q[0] - hs[0] : q[0], k === 1 ? q[1] - hs[1] : q[1], k === 2 ? q[2] - hs[2] : q[2], k === 3 ? q[3] - hs[3] : q[3]]);
      const fp = residual(A, sA, B, sB, r, X, t, qp), fm = residual(A, sA, B, sB, r, X, t, qm);
      for (let i = 0; i < 4; i++) J[i][k] = (fp[i] - fm[i]) / (qp[k] - qm[k]);
    }
    const step = solve4(J, [-f[0], -f[1], -f[2], -f[3]]);
    if (!step) return null;
    // Damped: halve the step until the residual falls.
    let lambda = 1, next = q, fn = f;
    for (let k = 0; k < 20; k++) {
      next = clampQ(A, B, [q[0] + lambda * step[0], q[1] + lambda * step[1], q[2] + lambda * step[2], q[3] + lambda * step[3]]);
      fn = residual(A, sA, B, sB, r, X, t, next);
      if (norm(fn) < norm(f)) break;
      lambda /= 2;
    }
    if (!(norm(fn) < norm(f))) break;
    q = next; f = fn;
  }
  if (!(norm(f) <= 1e-9 * size)) return null;
  const uvA: XY = [q[0], q[1]], uvB: XY = [q[2], q[3]], pA = pointOn(A, ...uvA), pB = pointOn(B, ...uvB), nA = normalOn(A, ...uvA), nB = normalOn(B, ...uvB);
  return { X, t, c: add(pA, scale(nA, sA * r)), pA, pB, uvA, uvB, nA, nB };
}

/** A station's section: its five corners (T1, T1 grown, the grown corner, T2 grown, T2) and the arc's middle pole and weight. */
export interface Section { readonly corners: Point[]; readonly mid: Point; readonly w: number; readonly c: Point; /** The fillet's inner poles, from T2 (corner 4) to T1 (corner 0), weights 1, when it is not a conic of `mid` and `w` (a G2 section, R10.5b). */ readonly poles?: readonly Point[] }
/**
 * The fillet's section shape (R10.5b, D103): the ball's arc (circular, the default); a conic between the same contacts,
 * tangent there to the faces, its shape ρ ∈ (0, 1) (weight ρ/(1 − ρ) at the faces' corner; 0.5 a parabola; a circle at
 * the arc's own ρ); or G2 — a quartic tangent to both faces with their normal curvature across the contact, its inner
 * poles a fraction `tension` of the way to the faces' corner.
 */
export type SectionShape = { readonly kind: 'circular' } | { readonly kind: 'conic'; readonly rho: number } | { readonly kind: 'g2'; readonly tension: number };
/** A station's shape terms: for G2, the faces' normal curvatures across the contacts (along the section, at T1 and T2). */
export type ShapeAt = { readonly kind: 'conic'; readonly w: number } | { readonly kind: 'g2'; readonly tension: number; readonly kA: number; readonly kB: number };
/**
 * The section of a station, grown g outside the corner (σ as for the ball: along −σ n at each contact, or along `growA`,
 * `growB` where given — beside a corner the ball rolls round, into the wedge there, R10.3a); null when it is degenerate.
 */
export function sectionOf(st: Station, sA: number, sB: number, r: number, g: number, growA?: Point, growB?: Point, shape?: ShapeAt): Section | null {
  const T1 = st.pA, T2 = st.pB, c = st.c, a = sub(T1, c), b = sub(T2, c), m = cross(a, b);
  if (!(len(m) > 1e-12 * r * r)) return null;
  const mz = unit(m), T1o = growA ? add(T1, scale(growA, g)) : sub(T1, scale(st.nA, sA * g)), T2o = growB ? add(T2, scale(growB, g)) : sub(T2, scale(st.nB, sB * g));
  // The faces' lines in the section, from the contacts towards the edge.
  let d1 = unit(cross(mz, st.nA)), d2 = unit(cross(mz, st.nB));
  if (dot(d1, sub(T2, T1)) < 0) d1 = scale(d1, -1);
  if (dot(d2, sub(T1, T2)) < 0) d2 = scale(d2, -1);
  // Their corner: T1o + s d1 = T2o + s' d2 (least squares in the plane).
  const w0 = sub(T1o, T2o), A11 = dot(d1, d1), A12 = -dot(d1, d2), A22 = dot(d2, d2), b1 = -dot(d1, w0), b2 = dot(d2, w0), det = A11 * A22 - A12 * A12;
  if (!(Math.abs(det) > 1e-9)) return null;
  const s1 = (b1 * A22 - A12 * b2) / det, O = add(T1o, scale(d1, s1));
  if (!(s1 > 0)) return null;
  const theta = Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))), w = Math.cos(theta / 2);
  // (Q, the faces' corner in the section: where their tangents at the contacts meet — every shape's tangent there.)
  const mid = add(c, scale(unit(add(a, b)), r / w));
  if (shape?.kind === 'conic') return { corners: [T1, T1o, O, T2o, T2], mid, w: shape.w, c };
  if (shape?.kind === 'g2') {
    // (P1, P3 on the tangents; P2 so that the quartic's curvature across each contact is the face's: (P2 − T)·n = 4/3 κ |P1 − T|².
    // P2 = T1 + x d1 + y nA in the section's plane, which holds both normals.)
    const P1 = add(T1, scale(sub(mid, T1), shape.tension)), P3 = add(T2, scale(sub(mid, T2), shape.tension));
    const nA = unit(a), nB = unit(b), e1 = sub(mid, T1), ex = unit(sub(e1, scale(nA, dot(e1, nA))));
    const y = 4 / 3 * shape.kA * dot(sub(P1, T1), sub(P1, T1)), bB = 4 / 3 * shape.kB * dot(sub(P3, T2), sub(P3, T2)), den = dot(nB, ex);
    if (!(Math.abs(den) > 1e-9)) return null;
    const x = (dot(nB, sub(T2, T1)) + bB - y * dot(nA, nB)) / den, P2 = add(T1, add(scale(ex, x), scale(nA, y)));
    return { corners: [T1, T1o, O, T2o, T2], mid, w, c, poles: [P3, P2, P1] };
  }
  return { corners: [T1, T1o, O, T2o, T2], mid, w, c };
}
/** A station's shape terms: a conic's weight, or G2's normal curvatures of the faces across its contacts. */
function shapeAt(shape: Exclude<SectionShape, { kind: 'circular' }>, st: Station, A: Sheet, B: Sheet, r: number): ShapeAt {
  if (shape.kind === 'conic') return { kind: 'conic', w: shape.rho / (1 - shape.rho) };
  const a = sub(st.pA, st.c), b = sub(st.pB, st.c), w = Math.cos(Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) / 2), Q = add(st.c, scale(unit(add(a, b)), r / w));
  const across = (T: Point, n: Point) => { const e = sub(Q, T); return unit(sub(e, scale(n, dot(e, n)))); };
  return { kind: 'g2', tension: shape.tension, kA: normalCurvature(A, st.uvA, unit(a), across(st.pA, unit(a))), kB: normalCurvature(B, st.uvB, unit(b), across(st.pB, unit(b))) };
}
/** The fillet's section curve at t (0 at T2, 1 at T1): the quartic of its poles, or the conic of mid and w. */
function sectionAt(s: Section, t: number): Point {
  if (s.poles) { let pts: Point[] = [s.corners[4], ...s.poles, s.corners[0]]; while (pts.length > 1) pts = pts.slice(1).map((q, i) => add(scale(pts[i], 1 - t), scale(q, t))); return pts[0]; }
  const b0 = (1 - t) * (1 - t), b1 = 2 * t * (1 - t) * s.w, b2 = t * t, d = b0 + b1 + b2;
  return scale(add(add(scale(s.corners[4], b0), scale(s.mid, b1)), scale(s.corners[0], b2)), 1 / d);
}
/**
 * The normal curvature of a sheet at (u, v) along the unit tangent d, against the unit normal n (positive where it
 * curves towards n): its second derivative along d by central differences.
 */
export function normalCurvature(S: Sheet, uv: XY, n: Point, d: Point): number {
  const hu = 1e-5 * (S.u1 - S.u0), hv = 1e-5 * (S.v1 - S.v0), p = pointOn(S, uv[0], uv[1]);
  const Su = scale(sub(pointOn(S, uv[0] + hu, uv[1]), pointOn(S, uv[0] - hu, uv[1])), 1 / (2 * hu)), Sv = scale(sub(pointOn(S, uv[0], uv[1] + hv), pointOn(S, uv[0], uv[1] - hv)), 1 / (2 * hv));
  // (d = α Su + β Sv, least squares; then the curve (u, v) + s (α, β) has unit speed at s = 0.)
  const E = dot(Su, Su), F = dot(Su, Sv), G = dot(Sv, Sv), du = dot(d, Su), dv = dot(d, Sv), det = E * G - F * F;
  if (!(Math.abs(det) > 1e-300)) return 0;
  // (Unit speed: s is arc length in mm; ±2e-3 mm, far above the rounding of the points' second difference.)
  const al = (G * du - F * dv) / det, be = (E * dv - F * du) / det, k = 2e-3, q = (s: number) => pointOn(S, uv[0] + al * s, uv[1] + be * s);
  return dot(scale(add(sub(q(k), scale(p, 2)), q(-k)), 1 / (k * k)), n);
}

/**
 * The derivative (per station index) of values around a ring at i, within its segment [a, b] (lofted indices between
 * two breaks, where the stations are evenly spaced: a chain vertex changes the spacing): five-point, central inside,
 * one-sided at the segment's ends (both O(h⁴)); three-point where the segment is shorter.
 */
function segmentDerivative(values: readonly (readonly number[])[], i: number, a: number, b: number, closed = true): number[] {
  const n = values.length, at = (k: number) => values[closed ? ((k % n) + n) % n : Math.max(0, Math.min(n - 1, k))], dim = at(i).length, out = Array(dim).fill(0);
  const w = (ks: number[], cs: number[], den: number) => { for (let j = 0; j < dim; j++) { let x = 0; ks.forEach((k, q) => { x += cs[q] * at(k)[j]; }); out[j] = x / den; } return out; };
  if (b - a >= 4) {
    if (i - 2 >= a && i + 2 <= b) return w([i - 2, i - 1, i + 1, i + 2], [1, -8, 8, -1], 12);
    if (i - a < 2) { const k = i - a, base = a; // forward from the segment's start (or one in)
      return k === 0 ? w([base, base + 1, base + 2, base + 3, base + 4], [-25, 48, -36, 16, -3], 12) : w([base, base + 1, base + 2, base + 3, base + 4], [-3, -10, 18, -6, 1], 12); }
    const k = b - i, base = b;
    return k === 0 ? w([base, base - 1, base - 2, base - 3, base - 4], [25, -48, 36, -16, 3], 12) : w([base, base - 1, base - 2, base - 3, base - 4], [3, 10, -18, 6, -1], 12);
  }
  if (b - a >= 2) {
    if (i === a) return w([a, a + 1, a + 2], [-3, 4, -1], 2);
    if (i === b) return w([b, b - 1, b - 2], [3, -4, 1], 2);
    return w([i - 1, i + 1], [-1, 1], 2);
  }
  return w([a, b], [-1, 1], 1);
}
/**
 * A C² cubic B-spline through values[i0..i1] (m = i1 − i0 spans, uniform interior knots, clamped ends), its end
 * tangents d[i0] and d[i1] (per index): its m + 3 poles. Solved by collocation at the knots (at most 16 poles).
 */
function splinePoles(values: readonly (readonly number[])[], d: readonly (readonly number[])[], i0: number, i1: number): number[][] {
  const n = values.length, V = (i: number) => values[i % n], m = i1 - i0, knots = splineKnots(m), dim = V(i0).length;
  const P: number[][] = Array.from({ length: m + 3 }, () => Array(dim).fill(0));
  // Ends: the end points, and the poles next to them from the end tangents (C'(0) = 3 (P1 − P0) / Δ, Δ = 1/m a span).
  P[0] = V(i0).slice(); P[m + 2] = V(i1).slice();
  // (Tangents per index, knots per patch: one index is 1/m of the knot range, so P1 = P0 + D/3 for any m.)
  P[1] = V(i0).map((x, j) => x + d[i0 % n][j] / 3);
  P[m + 1] = V(i1).map((x, j) => x - d[i1 % n][j] / 3);
  if (m === 1) return P.slice(0, 2).concat(P.slice(m + 1));
  // Interior: C(k/m) = V(i0 + k), k = 1 … m − 1, for poles 2 … m.
  const size = m - 1, A = Array.from({ length: size }, () => Array(size).fill(0)), B = Array.from({ length: size }, () => Array(dim).fill(0));
  for (let k = 1; k < m; k++) {
    const b = basis(knots, 3, m + 3, k / m), row = k - 1;
    for (let j = 0; j < dim; j++) B[row][j] = V(i0 + k)[j];
    b.values.forEach((w, q) => {
      const pole = b.start + q;
      if (pole >= 2 && pole <= m) A[row][pole - 2] += w;
      else for (let j = 0; j < dim; j++) B[row][j] -= w * P[pole][j];
    });
  }
  const X = solveDense(A, B);
  for (let k = 0; k < size; k++) P[k + 2] = X[k];
  return P;
}
/** Uniform interior knots on [0, 1], clamped. */
function splineKnots(spans: number): number[] {
  const k = [0, 0, 0, 0];
  for (let i = 1; i < spans; i++) k.push(i / spans);
  k.push(1, 1, 1, 1);
  return k;
}
/** X with A X = B (dense, partial pivoting; A square). */
function solveDense(A: number[][], B: number[][]): number[][] {
  const n = A.length, a = A.map(r => r.slice()), b = B.map(r => r.slice());
  for (let k = 0; k < n; k++) {
    let p = k; for (let i = k + 1; i < n; i++) if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i;
    [a[k], a[p]] = [a[p], a[k]]; [b[k], b[p]] = [b[p], b[k]];
    for (let i = k + 1; i < n; i++) { const f = a[i][k] / a[k][k]; if (!f) continue; for (let j = k; j < n; j++) a[i][j] -= f * a[k][j]; for (let j = 0; j < b[i].length; j++) b[i][j] -= f * b[k][j]; }
  }
  const x = b.map(r => r.map(() => 0));
  for (let i = n - 1; i >= 0; i--) for (let j = 0; j < b[i].length; j++) { let s = b[i][j]; for (let q = i + 1; q < n; q++) s -= a[i][q] * x[q][j]; x[i][j] = s / a[i][i]; }
  return x;
}

/** How closely the lofted sections follow the true ones: their largest distance at the stations between, and the worst contact. */
export interface LoftReport { readonly stations: number; readonly patches: number; readonly maxDeviationMM: number }

/**
 * The fillet tool from its stations (every other one lofted through, the others measure it), around a closed chain
 * (an even count) or along an open one (an odd count, ending at lofted stations, capped there by the end sections'
 * planes): five faces a patch, `${id}.face` the fillet's, `${id}.tool` the rest. `breaks`: lofted indices where the
 * patches break (where the contacts cross seams; an open loft's start is one).
 */
export function loftTool(sections: readonly Section[], id: string, breaks: readonly number[] = [0], closed = true): { brep: Brep; report: LoftReport; contactFaces: string[] } {
  const N = sections.length;
  if (closed ? N % 2 || N < 8 : N % 2 === 0 || N < 5) throw new BrepError('INPUT', `rolling ball: ${closed ? 'an even' : 'an odd'} count of at least ${closed ? 8 : 5} stations`);
  const used = sections.filter((_, i) => i % 2 === 0), between = sections.filter((_, i) => i % 2 === 1), n = used.length;
  // Per corner k (5) and the arc's middle (homogeneous), the values along the chain.
  const rows: number[][][] = [0, 1, 2, 3, 4].map(k => used.map(s => s.corners[k] as number[]));
  const mid = used.map(s => [s.mid[0] * s.w, s.mid[1] * s.w, s.mid[2] * s.w, s.w]);
  // (A G2 section's inner poles, each along the chain: the fillet a quartic across, weights 1, R10.5b.)
  const inner = used[0].poles ? used[0].poles.map((_, j) => used.map(s => s.poles![j] as number[])) : null;
  // Patches: between the breaks, each cut into pieces of at most 13 spans; an open loft ends at its last station.
  const per = 13, cuts = [...new Set(closed ? breaks : [0, ...breaks])].filter(c => closed || (c >= 0 && c < n - 1)).sort((x, y) => x - y), bounds: number[] = [];
  const end = closed ? cuts[0] + n : n - 1;
  for (let k = 0; k < cuts.length; k++) {
    const x = cuts[k], y = k + 1 < cuts.length ? cuts[k + 1] : end, pieces = Math.ceil((y - x) / per);
    for (let q = 0; q < pieces; q++) bounds.push(x + Math.round(q * (y - x) / pieces));
  }
  bounds.push(end);
  const patches = bounds.length - 1, marks = closed ? [...cuts, ...cuts.map(c => c + n), ...cuts.map(c => c - n)] : [...cuts, n - 1];
  // Each patch's end tangents, from its stretch between breaks.
  const segOf = (p: number): [number, number] => { let lo = -Infinity, hi = Infinity; for (const c of marks) { if (c <= bounds[p] && c > lo) lo = c; if (c >= bounds[p + 1] && c < hi) hi = c; } return [lo, hi]; };
  const vertices: { id: string; point: Point }[] = [], edges: { id: string; curve: Curve; vertices: [string, string] }[] = [], faces: { id: string; name: string; surface: Surface; sense: 'forward' | 'reversed'; loops: { kind: 'outer'; uses: { edge: string; sense: 'forward' | 'reversed' }[] }[] }[] = [];
  const nb = closed ? patches : patches + 1, bi = (b: number) => closed ? b % patches : b;
  // (A patch whose contact row stays at one point — the apex of a horn torus, where the ball rolls round an edge standing
  // square on a plane, R10.3a — has no edge there: its two faces meet that row in one vertex, a pole.)
  const same = (a: readonly number[], b: readonly number[]) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
  const pole = Array.from({ length: patches }, (_, p) => { for (let i = bounds[p]; i <= bounds[p + 1]; i++) if (!same(rows[4][i % n], rows[4][bounds[p] % n])) return false; return true; });
  const v4of = Array.from({ length: nb }, (_, b) => b);
  for (let b = 1; b < nb; b++) if (pole[b - 1]) v4of[b] = v4of[b - 1];
  if (closed && pole[patches - 1]) { const root = v4of[0]; for (let b = nb - 1; b >= 0 && (b === nb - 1 || pole[b]); b--) v4of[b] = root; }
  const vid = (k: number, b: number) => k === 4 ? `v4_${v4of[bi(b)]}` : `v${k}_${bi(b)}`;
  for (let b = 0; b < nb; b++) for (let k = 0; k < 5; k++) if (k !== 4 || v4of[b] === b) vertices.push({ id: vid(k, b), point: rows[k][bounds[b] % n] as Point });
  // Section edges at each bound: lines between corners k and k+1 (k < 4), the arc from corner 4 (T2) to 0 (T1).
  for (let b = 0; b < nb; b++) {
    const sc = used[bounds[b] % n];
    for (let k = 0; k < 4; k++) edges.push({ id: `s${k}_${b}`, curve: { kind: 'curve', id: `s${k}_${b}`, degree: 1, knots: [0, 0, 1, 1], controlPoints: [sc.corners[k], sc.corners[k + 1]], weights: [1, 1] }, vertices: [vid(k, b), vid(k + 1, b)] });
    edges.push({ id: `s4_${b}`, curve: sc.poles ? { kind: 'curve', id: `s4_${b}`, degree: sc.poles.length + 1, knots: bezierKnots(sc.poles.length + 1), controlPoints: [sc.corners[4], ...sc.poles, sc.corners[0]], weights: [1, ...sc.poles.map(() => 1), 1] } : { kind: 'curve', id: `s4_${b}`, degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: [sc.corners[4], sc.mid, sc.corners[0]], weights: [1, sc.w, 1] }, vertices: [vid(4, b), vid(0, b)] });
  }
  for (let p = 0; p < patches; p++) {
    const i0 = bounds[p], i1 = bounds[p + 1], spans = i1 - i0, knots = splineKnots(spans);
    const [sa, sb] = segOf(p), ends = (vals: number[][]) => { const d: number[][] = []; d[i0 % n] = segmentDerivative(vals, i0, sa, sb, closed).slice(); d[i1 % n] = segmentDerivative(vals, i1, sa, sb, closed).slice(); return d; };
    const along = [0, 1, 2, 3, 4].map(k => splinePoles(rows[k], ends(rows[k]), i0, i1) as Point[]);
    for (let k = 0; k < 5; k++) if (k !== 4 || !pole[p]) edges.push({ id: `a${k}_${p}`, curve: { kind: 'curve', id: `a${k}_${p}`, degree: 3, knots, controlPoints: along[k], weights: along[k].map(() => 1) }, vertices: [vid(k, p), vid(k, p + 1)] });
    const hm = splinePoles(mid, ends(mid), i0, i1), midPoles = hm.map(h => [h[0] / h[3], h[1] / h[3], h[2] / h[3]] as Point), midW = hm.map(h => h[3]);
    for (let k = 0; k < 5; k++) {
      // Face k: corner k to corner k+1 across (the fillet: corner 4 → mid → corner 0), along the patch.
      const fillet = k === 4, next = (k + 1) % 5;
      const innerRows = fillet && inner ? inner.map(rowsJ => splinePoles(rowsJ, ends(rowsJ), i0, i1) as Point[]) : null;
      const cps = fillet ? (innerRows ? [along[4], ...innerRows, along[0]] : [along[4], midPoles, along[0]]) : [along[k], along[next]];
      const wts = fillet ? (innerRows ? cps.map(r => r.map(() => 1)) : [along[4].map(() => 1), midW, along[0].map(() => 1)]) : [along[k].map(() => 1), along[next].map(() => 1)];
      const du = fillet ? cps.length - 1 : 1;
      const surface: Surface = { kind: 'surface', id: `f${k}_${p}`, degreeU: du, degreeV: 3, knotsU: bezierKnots(du), knotsV: knots, controlPoints: cps, weights: wts };
      // Its loop: along corner k, the section edge at the patch's end, back along corner k+1, the section edge at its
      // start — clockwise in (u, v), so about −(Su × Sv). Facing out along +(Su × Sv) (away from the section's middle),
      // the loop is turned and the face kept forward; otherwise the face is reversed.
      const uses = [{ edge: `a${k}_${p}`, sense: 'forward' as const }, { edge: `s${k}_${closed ? (p + 1) % patches : p + 1}`, sense: 'forward' as const }, { edge: `a${next}_${p}`, sense: 'reversed' as const }, { edge: `s${k}_${p}`, sense: 'reversed' as const }].filter(u => !(pole[p] && u.edge === `a4_${p}`));
      const out = facesOut(surface, used[(i0 + Math.floor(spans / 2)) % n], fillet);
      // (The walls at the contacts are `${id}.wall`: a contact face, found by name after any clip.)
      faces.push({ id: `f${k}_${p}`, name: fillet ? `${id}.face` : k === 0 || k === 3 ? `${id}.wall` : `${id}.tool`, surface, sense: out ? 'forward' : 'reversed', loops: [{ kind: 'outer', uses: out ? turned(uses) : uses }] });
    }
  }
  // An open loft's caps: the end sections, in their planes, facing back at the start and on at the end.
  if (!closed) for (const [b, sign] of [[0, -1], [patches, 1]] as const) {
    const sc = used[bounds[b] % n], other = used[bounds[b] % n + (sign < 0 ? 1 : -1)], out = scale(sub(centroid(sc), centroid(other)), 1);
    let nrm = newell(sc.corners); if (dot(nrm, out) < 0) nrm = scale(nrm, -1);
    const uses = [0, 1, 2, 3, 4].map(k => ({ edge: `s${k}_${b}`, sense: 'forward' as const }));
    // (The loop T1 → … → T2 → arc → T1 runs about `newell(corners)`; turned when that points in.)
    const along = dot(newell(sc.corners), nrm) > 0;
    faces.push({ id: `c${b === 0 ? 0 : 1}`, name: `${id}.tool`, surface: planePatch(sc, nrm), sense: 'forward', loops: [{ kind: 'outer', uses: along ? uses : turned(uses) }] });
  }
  const brep = buildBrep({ source: { family: 'rolling-ball-tool', id }, vertices, edges, bodies: [{ id: `${id}_t`, kind: 'solid', shells: [{ id: `${id}_s`, closed: true, faces }] }] });
  // The deviation: each true section at the in-between stations against the lofted fillet — the distance of its
  // contacts and arc middle to the nearest point of it. (The grown points and corner lie on the tool's inner faces,
  // which the Boolean drops: where they turn into a corner's wedge, R10.3a, they bend more, and say nothing of the
  // fillet, D92.)
  let dev = 0;
  for (let i = 0; i < between.length; i++) {
    const sc = between[i], ii = closed && i < bounds[0] ? i + n : i, p = bounds.findIndex((x, q) => q < patches && ii >= x && ii < bounds[q + 1]);
    if (p < 0) continue;
    const v = (ii - bounds[p] + 0.5) / (bounds[p + 1] - bounds[p]), fillet = faces[p * 5 + 4].surface;
    for (const [S, x, u] of [[fillet, sc.corners[4], 0], [fillet, sc.corners[0], 1], [fillet, arcMiddle(sc), 0.5]] as [Surface, Point, number][])
      dev = Math.max(dev, distanceTo(sheetOf(S, 'forward'), x, [u, v]));
  }
  // The faces that meet the rounded faces along their contacts: the fillet and the walls at both contacts.
  const contactFaces = contactFacesOf(brep, id);
  return { brep, report: { stations: N, patches, maxDeviationMM: dev }, contactFaces };
}
/** Between two junction points (their tangents scaled by the arc between them, signed `span`): cubic Hermite at u. */
function hermiteStation(a: { X: Point; t: Point }, b: { X: Point; t: Point }, u: number, span: number): { X: Point; t: Point } {
  const h00 = 2 * u ** 3 - 3 * u * u + 1, h10 = u ** 3 - 2 * u * u + u, h01 = -2 * u ** 3 + 3 * u * u, h11 = u ** 3 - u * u;
  const d00 = 6 * u * u - 6 * u, d10 = 3 * u * u - 4 * u + 1, d01 = -6 * u * u + 6 * u, d11 = 3 * u * u - 2 * u;
  const ta = scale(a.t, span), tb = scale(b.t, span);
  const X = add(add(scale(a.X, h00), scale(ta, h10)), add(scale(b.X, h01), scale(tb, h11)));
  const d = add(add(scale(a.X, d00), scale(ta, d10)), add(scale(b.X, d01), scale(tb, d11)));
  return { X, t: unit(len(d) > 0 ? scale(d, Math.sign(span) || 1) : a.t) };
}
/** Each end's junction marched past it (R10.2b): its points by length along the chain, beyond 0 and beyond L. */
type Ext = { s: number; X: Point; t: Point }[][];
/** The chain at x — past an open chain's end, along its marched junction (Hermite between the points). */
function pastAt(path: ChainPath, closed: boolean, ext: Ext, x: number): { X: Point; t: Point } {
  const L = path.length;
  if (closed || (x >= 0 && x <= L)) return path.at(x);
  const k = x > L ? 1 : 0, list = ext[k], from = k ? { s: L, ...path.at(L) } : { s: 0, ...path.at(0) }, d = Math.abs(x - from.s);
  let a = from;
  for (const b of list) {
    const db = Math.abs(b.s - from.s);
    if (db >= d) { const span = db - Math.abs(a.s - from.s), u = span > 0 ? (d - Math.abs(a.s - from.s)) / span : 0, sg = k ? 1 : -1; return hermiteStation(a, b, u, span * sg); }
    a = b;
  }
  return { X: add(a.X, scale(a.t, x - a.s)), t: a.t };
}
type FirstStation = { st: Station; a: number; b: number; s: number };
/**
 * An open chain run past end k (R10.2b): on, a step h at a time, along the faces' own junction (their extended
 * surfaces: a ball of radius 0 a step on, on whichever of their faces it falls), until the section lies beyond the end's
 * plane (the body ends there; the Boolean trims the tool). The stations go into `first` (before its start, or after its
 * end); returns where the run stops. Refused where the ball no longer touches both faces first.
 */
function marchPast(k: 0 | 1, plane: EndPlane, o: { path: ChainPath; ext: Ext; As: readonly Side[]; Bs: readonly Side[]; first: FirstStation[]; solveAt: (x: number, prev: FirstStation | undefined, check: Check) => { st: Station; a: number; b: number } | null; sigma: number; r: number; g: number; h: number; N0: number; scaleMM: number; name: string; leaves: (x: number) => Error }): number {
  const { path, ext, As, Bs, first, sigma, r, g, h, scaleMM } = o, L = path.length;
  // (The plane's side away from the chain: past it the section is clear of the body.)
  const away = dot(plane.n, sub(path.at(L / 2).X, plane.o)) < 0 ? plane.n : scale(plane.n, -1), clear = (sec: Section) => [...sec.corners, sec.mid].every(p => dot(sub(p, plane.o), away) > 1e-9 * scaleMM);
  for (let step = 1; ; step++) {
    if (step > 4 * o.N0) throw o.leaves(k ? L : 0);
    const x = k ? L + step * h : -step * h, prev = k ? first.at(-1)! : first[0], last = ext[k].at(-1) ?? { s: k ? L : 0, ...path.at(k ? L : 0) };
    const sgn = k ? 1 : -1, guess = add(last.X, scale(last.t, sgn * h));
    let j0: Station | null = null;
    for (const A of As) { for (const B of Bs) { j0 = solveStation(A.sheet, 1, B.sheet, 1, 0, guess, last.t, invertOn(A.sheet, guess), invertOn(B.sheet, guess), scaleMM); if (j0) break; } if (j0) break; }
    const tj = j0 && unit(cross(j0.nA, j0.nB)), t1 = tj && (dot(tj, last.t) < 0 ? scale(tj, -1) : tj);
    if (j0 && t1) ext[k].push({ s: x, X: j0.c, t: t1 });
    const got = j0 && o.solveAt(x, prev, false), sec = got && sectionOf(got.st, sigma, sigma, r, g);
    if (!got || !sec) throw new BrepError('INPUT', `PARAMETER: [CONTACT_LEAVES_FACE] edge ${o.name}: past its end the fillet's faces part before its section clears the body's end (near ${pastAt(path, false, ext, x).X.map(q => +q.toFixed(3)).join(', ')}); ending it there arrives with R10.4`);
    if (k) first.push({ ...got, s: x }); else first.unshift({ ...got, s: x });
    if (clear(sec)) return x;
  }
}
/** An end's plane (a point and its normal): an open chain run past that end goes on until its section clears it. */
export interface EndPlane { readonly o: Point; readonly n: Point }
/** A tool's contact faces (ids): its fillet and its walls. */
export function contactFacesOf(tool: Brep, id: string): string[] { return tool.faces.filter(f => f.name === `${id}.face` || f.name === `${id}.wall`).map(f => f.id); }
/** A loop's uses the other way round. */
const turned = (uses: readonly { edge: string; sense: 'forward' | 'reversed' }[]) => uses.slice().reverse().map(x => ({ edge: x.edge, sense: x.sense === 'forward' ? 'reversed' as const : 'forward' as const }));
const centroid = (s: Section): Point => scale(s.corners.reduce((x, y) => add(x, y), [0, 0, 0] as Point), 1 / s.corners.length);
/** A polygon's area normal (Newell). */
function newell(ps: readonly Point[]): Point {
  const n: Point = [0, 0, 0];
  for (let i = 0; i < ps.length; i++) { const a = ps[i], b = ps[(i + 1) % ps.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
  return n;
}
/** A Bézier's clamped knots for degree p: p + 1 zeros, p + 1 ones. */
function bezierKnots(p: number): number[] { return [...Array(p + 1).fill(0), ...Array(p + 1).fill(1)]; }
/** A plane patch through a section, Su × Sv along n, covering it (and its arc) with room. */
function planePatch(s: Section, nrm: Point): Surface {
  const n = unit(nrm), o = s.c, d = sub(s.corners[0], o), e1 = unit(sub(d, scale(n, dot(d, n)))), e2 = cross(n, e1), pts = [...s.corners, s.mid, ...(s.poles ?? [])];
  const reach = 2 * Math.max(...pts.map(p => len(sub(p, o)))) + 1, at = (u: number, v: number): Point => add(o, add(scale(e1, u), scale(e2, v)));
  return { kind: 'surface', id: 'cap', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[at(-reach, -reach), at(-reach, reach)], [at(reach, -reach), at(reach, reach)]], weights: [[1, 1], [1, 1]] };
}
/** The closed tool of a ring (loftTool, closed). */
export function ringTool(sections: readonly Section[], id: string, breaks: readonly number[] = [0]): { brep: Brep; report: LoftReport; contactFaces: string[] } { return loftTool(sections, id, breaks, true); }

/** The true arc's middle: r from the ball's centre towards the middle pole. */
function arcMiddle(s: Section): Point { return sectionAt(s, 0.5); }
/** How far x lies from the surface: Gauss–Newton from (u, v). */
function distanceTo(s: Sheet, x: Point, start: XY): number { const uv = invertOn(s, x, start); return len(sub(pointOn(s, ...uv), x)); }

/** Whether a tool face's Su × Sv at its middle points away from the middle of a section near it. */
function facesOut(S: Surface, near: Section, fillet = false): boolean {
  const at = surfaceEvaluator(S), u0 = S.knotsU[S.degreeU], u1 = S.knotsU[S.controlPoints.length], v0 = S.knotsV[S.degreeV], v1 = S.knotsV[S.controlPoints[0].length];
  const um = (u0 + u1) / 2, vm = (v0 + v1) / 2, h = 1e-6, p0 = at(um, vm), n = cross(sub(at(um + h, vm), at(um - h, vm)), sub(at(um, vm + h), at(um, vm - h)));
  // (The fillet faces out of the tool towards the ball's centre: a G2 or full conic section passes close to the faces'
  // corner, on either side of the corners' centroid, R10.5b.)
  if (fillet) return dot(n, sub(near.c, p0)) > 0;
  const cen = scale(near.corners.reduce((x, y) => add(x, y), [0, 0, 0] as Point), 1 / 5);
  return dot(n, sub(p0, cen)) > 0;
}

/** A closed chain of edge curves by length: its point and unit tangent at s in [0, length). */
/** `starts`: the length along the chain where each of its curves starts. */
export interface ChainPath { readonly length: number; readonly starts: readonly number[]; at(s: number): { X: Point; t: Point } }
export function chainPath(curves: readonly { curve: Curve; reversed: boolean }[], closed = true): ChainPath {
  // (A table of lengths by parameter, 2000 a curve; a point is the curve's own at the interpolated parameter.)
  const K = 2000, rows: { s: number; k: number; t: number }[] = [], starts: number[] = [], evals = curves.map(c => curveEvaluator(c.curve));
  let s = 0;
  for (const [k, c] of curves.entries()) {
    starts.push(s);
    const [t0, t1] = curveDomain(c.curve), par = (i: number) => c.reversed ? t1 - (t1 - t0) * i / K : t0 + (t1 - t0) * i / K;
    const ev = evals[k];
    let prev = ev(par(0));
    for (let i = 0; i < K; i++) { rows.push({ s, k, t: par(i) }); const p = ev(par(i + 1)); s += len(sub(p, prev)); prev = p; }
  }
  const total = s, ends = curves.map(c => { const [t0, t1] = curveDomain(c.curve); return c.reversed ? t0 : t1; });
  const lastPoint = evals[curves.length - 1](ends[ends.length - 1]);
  const pointAt = (x: number): Point => {
    // (An open chain's end is its last curve's own end point, exactly: a cap there lies in the end face's plane.)
    if (!closed && x >= total) return lastPoint;
    // (Wrapped by one remainder, a negative one moved up a turn: (x % L + L) % L sends x an ulp below L to 0 — x + L
    // rounds to 2L — and an open chain's last section went to its start, the tool folding back on itself, D267.)
    const w = x % total, y = w < 0 ? w + total : w;
    let lo = 0, hi = rows.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rows[m].s <= y) lo = m; else hi = m; }
    const a = rows[lo], b = rows[lo + 1] && rows[lo + 1].k === a.k ? rows[lo + 1] : { s: lo + 1 < rows.length ? rows[lo + 1].s : total, k: a.k, t: ends[a.k] };
    const f = b.s > a.s ? (y - a.s) / (b.s - a.s) : 0;
    return evals[a.k](a.t + (b.t - a.t) * f);
  };
  const h = 1e-6 * total;
  if (closed) return { length: total, starts, at: x => ({ X: pointAt(x), t: unit(sub(pointAt(x + h), pointAt(x - h))) }) };
  // Open: one-sided at the ends, and on past them along the end tangents (where a tool runs past the body's end).
  const t0 = unit(sub(pointAt(h), pointAt(0))), t1 = unit(sub(lastPoint, pointAt(total - h))), P0 = pointAt(0), P1 = lastPoint;
  return { length: total, starts, at: x => x <= 0 ? { X: x === 0 ? P0 : add(P0, scale(t0, x)), t: t0 } : x >= total ? { X: x === total ? P1 : add(P1, scale(t1, x - total)), t: t1 } : { X: pointAt(x), t: unit(sub(pointAt(Math.min(total, x + h)), pointAt(Math.max(0, x - h)))) } };
}

// ---- the general fillet of a closed chain (R10.2a, D89) ------------------------------------------------------------
/** Each refinement's measures, for tests and benches (unset in use). */
export let ringTrace: ((step: { stations: number; patches: number; contactMM: number; sectionMM: number }) => void) | null = null;
export function setRingTrace(f: typeof ringTrace): void { ringTrace = f; }
/** A fixed station count (tests and benches: no refinement), or null. */
let fixedStations: number | null = null;
export function setRingStations(n: number | null): void { fixedStations = n; }
/** A fillet's report: its stations and patches, how far its lofted contacts lie off their faces, the arc off the ball. */
export interface FilletReport {
  readonly edges: readonly string[]; readonly stations: number; readonly patches: number;
  /** The lofted contacts' largest distance from their faces, and the fillet's normal against theirs there (degrees). */
  readonly contact: number; readonly normal: number;
  /** The lofted sections against the true ones (at the stations between), and the solved balls' |c − p| − r. */
  readonly section: number; readonly ball: number;
}
type Face = Brep['faces'][number];
/** A face for the solve: its sheet, and its trimmed region in its (u, v) as polygons (outer first). */
interface Side { readonly face: Face; readonly sheet: Sheet; readonly rings: XY[][] }
/** The surface carried on along each straight direction (degree 1, two rows: a plane, an extrusion, a cone's ruling) by k times its length either way — exactly the same surface, room for a tool running past the face. */
export function extendedSurface(S: Surface, k = 2): Surface {
  let P = S.controlPoints.map(r => r.map(q => [...q] as Point));
  if (S.degreeU === 1 && P.length === 2) P = [P[0].map((q, j) => sub(q, scale(sub(P[1][j], q), k))), P[1].map((q, j) => add(q, scale(sub(q, P[0][j]), k)))];
  if (S.degreeV === 1 && P[0].length === 2) P = P.map(r => [sub(r[0], scale(sub(r[1], r[0]), k)), add(r[1], scale(sub(r[1], r[0]), k))]);
  return { ...S, controlPoints: P, weights: S.weights.map(r => [...r]) };
}
/**
 * A face's surface for a tool running past it: a cylinder's whole turn about its axis, long along it (its seam opposite
 * the face's middle, so the face's region stays clear of it), facing out as the face does; else carried on along its
 * straight directions (extendedSurface).
 */
function runSheet(body: Brep, face: Face, scaleMM: number): Sheet {
  const g = faceGeometry(face, scaleMM);
  if (g.kind !== 'cylinder') return sheetOf(extendedSurface(face.surface as Surface), face.sense);
  const own = sheetOf(face.surface as Surface, face.sense), mid = pointOn(own, (own.u0 + own.u1) / 2, (own.v0 + own.v1) / 2), a = unit(g.a);
  const d = sub(mid, g.c), radial = sub(d, scale(a, dot(d, a))), e1 = scale(unit(radial), -1), e2 = cross(a, e1), H = 8 * scaleMM + 10, w = Math.SQRT1_2;
  const ring: Point[] = [], wts: number[] = [];
  for (let k = 0; k < 8; k++) { const th = k * Math.PI / 4, rr = k % 2 ? g.r / w : g.r; ring.push(add(scale(e1, rr * Math.cos(th)), scale(e2, rr * Math.sin(th)))); wts.push(k % 2 ? w : 1); }
  ring.push(ring[0]); wts.push(1);
  const lo = sub(g.c, scale(a, H)), hi = add(g.c, scale(a, H));
  const S: Surface = { kind: 'surface', id: 'turn', degreeU: 2, degreeV: 1, knotsU: [0, 0, 0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: ring.map(q => [add(lo, q), add(hi, q)]), weights: wts.map(x => [x, x]) };
  const fwd = sheetOf(S, 'forward'), n = normalOn(fwd, ...invertOn(fwd, mid)), outward = normalOn(own, (own.u0 + own.u1) / 2, (own.v0 + own.v1) / 2);
  return sheetOf(S, dot(n, outward) > 0 ? 'forward' : 'reversed');
}
function sideOf(body: Brep, face: Face, extend = false, scaleMM = 1): Side {
  const sheet = extend ? runSheet(body, face, scaleMM) : sheetOf(face.surface as Surface, face.sense), loops = new Map(body.loops.map(l => [l.id, l])), coedges = new Map(body.coedges.map(c => [c.id, c])), edges = new Map(body.edges.map(e => [e.id, e]));
  const rings: XY[][] = [];
  for (const lid of face.loops) {
    const ring: XY[] = []; let hint: XY | undefined;
    for (const cid of loops.get(lid)!.coedges) {
      const c = coedges.get(cid)!, e = edges.get(c.edge)!, [t0, t1] = curveDomain(e.curve);
      for (let i = 0; i < 48; i++) { const t = c.sense === 'forward' ? t0 + (t1 - t0) * i / 48 : t1 - (t1 - t0) * i / 48, uv = invertOn(sheet, evaluateCurve(e.curve, t), hint); ring.push(uv); hint = uv; }
    }
    rings.push(ring);
  }
  return { face, sheet, rings };
}
/** Whether (u, v) lies inside the face's region: inside its rings an odd number of times (even-odd), off them by a margin. */
function insideFace(side: Side, uv: XY): boolean {
  const s = side.sheet, margin = 1e-7 * Math.max(s.u1 - s.u0, s.v1 - s.v0);
  let inside = false, near = Infinity;
  for (const ring of side.rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > uv[1]) !== (yj > uv[1]) && uv[0] < (xj - xi) * (uv[1] - yi) / (yj - yi) + xi) inside = !inside;
    near = Math.min(near, segmentDistance(uv, ring[j], ring[i]));
  }
  // (On a ring — a contact on the seam between two halves — counts as inside both.)
  return inside || near <= margin;
}
function segmentDistance(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
/** An end the chain runs past, its normal pointing past it (away from the chain): beyond it the body has ended. */
interface PastEnd { readonly o: Point; readonly n: Point; readonly tol: number }
/**
 * Which contacts a station checks: all of them (true), none (false), or — within reach of an end run past — all but
 * those lying past such an end (there a contact may run off its face across the end, where the body ends, but not off
 * across the face's side: a contact on the extended surface beside the face is off it, R10.4a fix, D97).
 */
type Check = boolean | readonly PastEnd[];
/** The open chain's ends run past, oriented away from its middle `mid`. */
function pastEnds(past: readonly (EndPlane | null)[] | undefined, mid: Point, scaleMM: number): PastEnd[] {
  const out: PastEnd[] = [];
  for (const pl of past ?? []) if (pl) { const n = unit(pl.n), m = dot(sub(mid, pl.o), n); out.push({ o: pl.o, n: m > 0 ? scale(n, -1) : n, tol: 1e-7 * scaleMM }); }
  return out;
}
/**
 * A break at s moved on, a quarter step at a time (at most 64), until its section lies wholly beyond an end plane it
 * straddles; s itself where its section does not straddle one (or where it never clears).
 */
function breakBeyond(ends: readonly PastEnd[], s: number, h: number, sectionAt: (x: number) => Section | null): number {
  const sec = sectionAt(s); if (!sec) return s;
  const pts = (q: Section) => [...q.corners, q.mid];
  for (const e of ends) {
    const d = pts(sec).map(x => dot(sub(x, e.o), e.n)), lo = Math.min(...d), hi = Math.max(...d);
    // (Straddling it — not in it to rounding: a square end's section lies in the end plane, and its patch edge is the
    // face's edge there exactly.)
    if (!(lo < e.tol && hi > -e.tol && hi - lo > 1e3 * e.tol)) continue;
    // (Towards the side past the plane: the way the chain runs out through it.)
    const ahead = sectionAt(s + h / 4), dir = ahead && Math.min(...pts(ahead).map(x => dot(sub(x, e.o), e.n))) > lo ? 1 : -1;
    for (let k = 1; k <= 64; k++) { const x = s + dir * k * h / 4, q = sectionAt(x); if (q && pts(q).every(y => dot(sub(y, e.o), e.n) > e.tol)) return x; }
    return s;
  }
  return s;
}
/**
 * A break at s (found between s0 and s1) moved to where one of its contacts lies exactly in an end plane run past, when
 * that contact crosses the plane between s0 and s1 and lies within 1e-4 × scale of it at s; else s.
 */
function breakOnEnd(ends: readonly PastEnd[], s: number, s0: number, s1: number, solve: (x: number) => Station | null, scaleMM: number): number {
  const at = solve(s); if (!at) return s;
  for (const e of ends) for (const side of ['pA', 'pB'] as const) {
    const f = (st: Station | null) => st ? dot(sub(st[side], e.o), e.n) : NaN;
    if (Math.abs(f(at)) > 1e-4 * scaleMM) continue;
    let lo = s0, hi = s1, flo = f(solve(lo));
    if (!(flo * f(solve(hi)) < 0)) continue;
    for (let k = 0; k < 100 && hi - lo > 1e-15 * Math.max(1, Math.abs(hi)); k++) { const m = (lo + hi) / 2, fm = f(solve(m)); if (!Number.isFinite(fm)) break; if ((fm < 0) === (flo < 0)) { lo = m; flo = fm; } else hi = m; }
    return (lo + hi) / 2;
  }
  return s;
}
/**
 * Whether the contact (u, v) at p passes the check: inside its face, or beyond an end run past (by more than rounding:
 * a contact in that end's plane is checked — there it would be off its face across the side, not the end).
 */
function contactOk(side: Side, uv: XY, p: Point, check: Check): boolean {
  if (check === false || insideFace(side, uv)) return true;
  if (check === true) return false;
  for (const e of check) if (dot(sub(p, e.o), e.n) > e.tol) return true;
  return false;
}
/** Solves a station on any pair of the sides' faces (the last pair first), its contacts inside the faces they lie on. */
function stationOn(As: Side[], Bs: Side[], last: [number, number], sigma: number, r: number, X: Point, t: Point, gA: Point, gB: Point, hintA: XY | undefined, hintB: XY | undefined, size: number, check: Check = true): { st: Station; a: number; b: number } | null {
  for (let i = 0; i < As.length; i++) for (let j = 0; j < Bs.length; j++) {
    const a = (last[0] + i) % As.length, b = (last[1] + j) % Bs.length, A = As[a], B = Bs[b];
    const st = solveStation(A.sheet, sigma, B.sheet, sigma, r, X, t, invertOn(A.sheet, gA, i === 0 ? hintA : undefined), invertOn(B.sheet, gB, j === 0 ? hintB : undefined), size);
    if (st && contactOk(A, st.uvA, st.pA, check) && contactOk(B, st.uvB, st.pB, check)) return { st, a, b };
  }
  return null;
}
/**
 * The fillet tool of a chain between the faces on its two sides: stations from about one per r/4 of its length, refined
 * until the lofted contacts lie within `tolMM` of their faces (refused past 4096), each solved on the face it falls on
 * (refused when it falls off them all: the fillet would run off its faces). A closed chain makes a ring; an open one a
 * capped tool, run on past an end by `past` (the body ends there: the Boolean trims it) or stopped at it.
 */
/** The radius at a point of a chain (R10.5, D100). */
export interface RadiusAt { readonly at: Point; readonly radius: number }
/** A radius along a chain by arc length: knots and values, their slopes (C¹ cubic Hermite), the chain's length. */
interface RadiusProfile { readonly x: number[]; readonly y: number[]; readonly m: number[]; readonly L: number; readonly closed: boolean; readonly min: number; readonly max: number }
/**
 * The radius profile through the given points, each placed at the chain's nearest point (it must lie on the chain, to
 * within 1e-6 of the model's size): shape-preserving (Fritsch–Carlson) cubic Hermite in arc length, so the radius never
 * overshoots the values given; on an open chain constant before the first point and after the last, on a closed one
 * periodic. Two points: linear between them.
 */
function radiusProfile(path: ChainPath, closed: boolean, radii: readonly RadiusAt[], scaleMM: number, name: string): RadiusProfile {
  const L = path.length, N = 1024, pts: { x: number; y: number }[] = [];
  for (const { at, radius } of radii) {
    let x0 = 0, d0 = Infinity;
    for (let i = 0; i <= N; i++) { const x = L * i / N, d = len(sub(path.at(x).X, at)); if (d < d0) { d0 = d; x0 = x; } }
    let lo = Math.max(0, x0 - L / N), hi = Math.min(L, x0 + L / N);
    for (let k = 0; k < 80; k++) { const m1 = lo + (hi - lo) * 0.382, m2 = lo + (hi - lo) * 0.618; if (len(sub(path.at(m1).X, at)) < len(sub(path.at(m2).X, at))) hi = m2; else lo = m1; }
    const x = (lo + hi) / 2, d = len(sub(path.at(x).X, at));
    if (d > 1e-6 * scaleMM) throw new BrepError('INPUT', `SELECTION: edge ${name}: the radius point (${at.map(q => +q.toFixed(6)).join(', ')}) is ${+d.toFixed(6)} mm off the chain; a variable radius is given at points of the edges it rounds`);
    pts.push({ x: closed && x >= L - 1e-9 * L ? 0 : x, y: radius });
  }
  pts.sort((p, q) => p.x - q.x);
  for (let k = 1; k < pts.length; k++) if (pts[k].x - pts[k - 1].x <= 1e-9 * L) throw new BrepError('INPUT', `SELECTION: edge ${name}: two radius points lie at one place on the chain`);
  // (Closed: one period, the last point repeated a period before the first and the first a period after the last.)
  const x = closed ? [pts[pts.length - 1].x - L, ...pts.map(p => p.x), pts[0].x + L] : pts.map(p => p.x), y = closed ? [pts[pts.length - 1].y, ...pts.map(p => p.y), pts[0].y] : pts.map(p => p.y);
  const n = x.length, d = Array.from({ length: n - 1 }, (_, k) => (y[k + 1] - y[k]) / (x[k + 1] - x[k])), m = new Array<number>(n).fill(0);
  // (One point on this chain — the others on another: the radius there, constant.)
  if (n === 1) return { x, y, m, L, closed, min: y[0], max: y[0] };
  // (Closed: the secants on either side of a knot are its neighbours' round the loop, so the repeated end knots get the
  // slopes of the points they repeat.)
  for (let k = 0; k < n; k++) {
    const a = k > 0 ? d[k - 1] : closed ? d[n - 3] : d[0], b = k < n - 1 ? d[k] : closed ? d[1] : d[n - 2];
    m[k] = n === 2 ? d[0] : a * b <= 0 ? 0 : !closed && (k === 0 || k === n - 1) ? (k === 0 ? b : a) : (a + b) / 2;
  }
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) { m[k] = 0; m[k + 1] = 0; continue; }
    const al = m[k] / d[k], be = m[k + 1] / d[k], t = al * al + be * be;
    if (t > 9) { const tau = 3 / Math.sqrt(t); m[k] = tau * al * d[k]; m[k + 1] = tau * be * d[k]; }
  }
  // (A repeated knot keeps one slope, the smaller — still monotone on both its segments — so the loop is C¹ there too.)
  if (closed) for (const [i, j] of [[0, n - 2], [1, n - 1]]) { const v = Math.abs(m[i]) < Math.abs(m[j]) ? m[i] : m[j]; m[i] = v; m[j] = v; }
  const prof = { x, y, m, L, closed, min: Math.min(...y), max: Math.max(...y) };
  // (Carried on at its end slopes to the chain's ends, it must stay positive there, and within the radii given.)
  if (!closed) for (const e of [0, L]) { const v = radiusOn(prof, e); if (!(v > 0.5 * prof.min + 1e-12)) throw new BrepError('INPUT', `PARAMETER: edge ${name}: the radius, carried on past its outer points at their slope, falls to ${+v.toFixed(6)} mm by the chain's end; give the radius at its ends`); }
  return { ...prof, min: Math.min(prof.min, ...(closed ? [] : [radiusOn(prof, 0), radiusOn(prof, L)])), max: Math.max(prof.max, ...(closed ? [] : [radiusOn(prof, 0), radiusOn(prof, L)])) };
}
/**
 * The profile's radius at arc length s along the chain. Beyond an open chain's outer points it goes on at its end slope
 * (C¹: held flat there, the slope's jump would sit in a patch of the loft), but no lower than half its least value —
 * past the chain's ends, where the tool runs on to be trimmed.
 */
function radiusOn(p: RadiusProfile, s: number): number {
  let u = s;
  if (p.closed) { u = ((s % p.L) + p.L) % p.L; if (u < p.x[0]) u += p.L; }
  const n = p.x.length;
  if (u <= p.x[0]) return Math.max(0.5 * p.min, p.y[0] + p.m[0] * (u - p.x[0]));
  if (u >= p.x[n - 1]) return Math.max(0.5 * p.min, p.y[n - 1] + p.m[n - 1] * (u - p.x[n - 1]));
  let k = 0; while (k < n - 2 && u > p.x[k + 1]) k++;
  const h = p.x[k + 1] - p.x[k], t = (u - p.x[k]) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p.y[k] + (t3 - 2 * t2 + t) * h * p.m[k] + (-2 * t3 + 3 * t2) * p.y[k + 1] + (t3 - t2) * h * p.m[k + 1];
}
/**
 * Where the ball leaves a face at one of its edges and rolls round that edge onto the next face (R10.3a, D92): between
 * the loop's curve `after` and the next, which meet at an inside corner of the face they share. The edge (`edge`, not
 * finished) joins the faces `before` and `next` on side `side`; the ball keeps touching `shared`, on the other side.
 */
export interface CornerInput { readonly after: number; readonly side: 'A' | 'B'; readonly shared: Face; readonly edge: Curve; readonly before: Face; readonly next: Face }
export interface RingInput { readonly loop: readonly { curve: Curve; reversed: boolean }[]; readonly facesOf?: readonly (readonly string[])[]; readonly noCliffs?: boolean; readonly names: readonly string[]; readonly sideA: readonly Face[]; readonly sideB: readonly Face[]; readonly start: { wA: Point; wB: Point }; readonly convex: boolean; readonly r: number; readonly id: string; readonly scaleMM: number; readonly tolMM: number; readonly closed?: boolean; readonly past?: readonly (EndPlane | null)[]; readonly corners?: readonly CornerInput[]; /** A variable radius (R10.5, D100): the radius at points of the chain, `r` their largest. */ readonly radii?: readonly RadiusAt[]; /** The section's shape (R10.5b, D103): circular when absent. */ readonly shape?: SectionShape; /** Which ends run past are cut by their plane (a clipped tool), not trimmed by the Boolean. */ readonly clipped?: readonly [boolean, boolean] }
export function ringFillet(body: Brep, input: RingInput): { brep: Brep; report: FilletReport; contactFaces: string[]; sides: string[] } {
  // (A variable radius — R10.5, D100 — along plain chains for now: not where the ball rolls round an edge or onto one.)
  if (input.corners?.length && input.radii) throw new BrepError('GEOMETRY', `CAPABILITY: edge ${input.names[0]}: a variable-radius fillet where the ball rolls round an edge at a corner is not supported yet`);
  const shaped = input.shape && input.shape.kind !== 'circular' ? input.shape : null;
  if (input.corners?.length && shaped) throw new BrepError('GEOMETRY', `CAPABILITY: edge ${input.names[0]}: a ${shaped.kind === 'conic' ? 'conic' : 'G2'} fillet where the ball rolls round an edge at a corner is not supported yet`);
  if (input.corners?.length) return cornerFillet(body, input);
  const { r, id, scaleMM, tolMM } = input, closed = input.closed !== false, sigma = input.convex ? -1 : 1, name = input.names[0];
  const As = input.sideA.map(f => sideOf(body, f, !closed, scaleMM)), Bs = input.sideB.map(f => sideOf(body, f, !closed, scaleMM));
  const alpha = Math.acos(Math.max(-1, Math.min(1, dot(input.start.wA, input.start.wB))));
  if (alpha > Math.PI - 1e-6) throw new BrepError('GEOMETRY', `SELECTION: [TANGENT_FACES] edge ${name}: its faces meet tangentially; there is no corner to finish`);
  const path = chainPath(input.loop, closed), L = path.length, prof = input.radii ? radiusProfile(path, closed, input.radii, scaleMM, name) : null;
  // (The radius at arc length x along the chain: the profile's, or the one radius.)
  const rAt = (x: number) => prof ? radiusOn(prof, x) : r, back = rAt(0) / Math.tan(alpha / 2), rMin = prof ? prof.min : r;
  // Past an end the chain goes on along the faces' own junction (their extended surfaces), marched a step at a time:
  // a straight run would leave it where it bends (an ellipse's tip) and the tool would miss the corner there.
  const ext: Ext = [[], []], at = (x: number) => pastAt(path, closed, ext, x);
  const leaves = (x: number) => new BrepError('INPUT', `PARAMETER: [CONTACT_LEAVES_FACE] edge ${name}: a fillet of ${r} mm runs off its faces near (${at(x).X.map(q => +q.toFixed(3)).join(', ')}); rolling over the next face arrives with R10.4`);
  // 1. Along the chain: on which faces the contacts fall, and where they cross from one face to the next — found by
  //    bisection to rounding, so the tool's patches break there with the contacts on the seam. An open chain run past
  //    an end goes on, a step at a time, until the section there lies beyond that end's plane (the body ends there; the
  //    Boolean trims the tool), refused where the ball no longer touches both faces first.
  const g = 0.5 * r, N0 = Math.max(64, 2 * Math.ceil(L / (rMin / 4) / 2)), h = L / N0, first: { st: Station; a: number; b: number; s: number }[] = [];
  const solveAt = (x: number, prev: { st: Station; a: number; b: number } | undefined, check: Check) => {
    const { X, t } = at(x);
    return stationOn(As, Bs, prev ? [prev.a, prev.b] : [0, 0], sigma, rAt(x), X, t, prev ? prev.st.pA : add(X, scale(input.start.wA, back)), prev ? prev.st.pB : add(X, scale(input.start.wB, back)), prev?.st.uvA, prev?.st.uvB, scaleMM, check);
  };
  // (Within reach of an end run past, a contact may run off its face across that end — beyond it, it is not checked —
  // but not off across the face's side, D97.)
  // (The ends the tool is cut at by their plane: there a break where a contact crosses it is put in the plane, R10.B; where
  // the Boolean trims the run past, a tool vertex in the body's end face would be a touch at a point, D100.)
  const clippedEnds = closed ? [] : pastEnds((input.past ?? []).map((pl, k) => input.clipped?.[k] ? pl : null), path.at(L / 2).X, scaleMM);
  const trimmedEnds = closed ? [] : pastEnds((input.past ?? []).map((pl, k) => input.clipped?.[k] ? null : pl), path.at(L / 2).X, scaleMM);
  const reach = back + 2 * g, endsPast = closed ? [] : pastEnds(input.past, path.at(L / 2).X, scaleMM), beside = (x: number): Check => closed || (x >= (input.past?.[0] ? reach : 0) && x <= L - (input.past?.[1] ? reach : 0)) || endsPast;
  for (let j = 0; j < (closed ? N0 : N0 + 1); j++) {
    const x = L * j / N0;
    let got = solveAt(x, first.at(-1), beside(x));
    // (Off its faces: where the last contact's face goes on smoothly across an edge — a round already made — the ball
    // rolls on over it, R10.4a, D95.)
    for (let k = 0; !got && k < 3 && growSides(body, As, Bs, first.at(-1) ?? { a: 0, b: 0 }, !closed, scaleMM); k++) got = solveAt(x, first.at(-1), beside(x));
    // (Still off them: perhaps at a sharp edge of a face, where the ball rolls on along that edge — the span machinery's,
    // R10.4b, D96.)
    if (!got && input.facesOf && !input.noCliffs && !prof && !shaped) return cornerFillet(body, { ...input, corners: [], noCliffs: true });
    if (!got) throw leaves(x);
    first.push({ ...got, s: x });
  }
  let s0 = 0, s1 = L;
  if (!closed) for (const [k, plane] of (input.past ?? []).entries()) if (plane) {
    const x = marchPast(k as 0 | 1, plane, { path, ext, As, Bs, first, solveAt, sigma, r: rAt(k ? L : 0), g, h, N0, scaleMM, name, leaves });
    if (k) s1 = x; else s0 = x;
  }
  const span = s1 - s0, M0 = first.length, N1 = closed ? N0 : M0 - 1;
  // (Also, on an open chain run past an end, where a contact leaves its face: there it crosses the face's own edge.)
  const state = (f: { st: Station; a: number; b: number }) => `${f.a},${f.b},${strictlyInside(As[f.a], f.st.uvA)},${strictlyInside(Bs[f.b], f.st.uvB)}`;
  const breaks: { s: number; a: number; b: number }[] = [];
  for (let j = 0; j < N1; j++) {
    const p = first[j], q = first[(j + 1) % M0], key = state(p);
    if (closed ? p.a === q.a && p.b === q.b : key === state(q)) continue;
    let lo = p.s, hi = closed && j + 1 === M0 ? L : q.s;
    for (let k = 0; k < 60; k++) {
      const m = (lo + hi) / 2, { X, t } = at(m), st = solveStation(As[p.a].sheet, sigma, Bs[p.b].sheet, sigma, rAt(m), X, t, p.st.uvA, p.st.uvB, scaleMM);
      if (st && (closed ? strictlyInside(As[p.a], st.uvA) && strictlyInside(Bs[p.b], st.uvB) : state({ st, a: p.a, b: p.b }) === key)) lo = m; else hi = m;
    }
    // (Where a contact leaves its face across an end run past — the face's edge in that end's plane — the break is put
    // in the plane itself: found on the face's sampled outline it lay up to 1e-5 off, and the plane that clips the tool
    // there then passed a hair beside the tool's vertex, cutting a corner of 1e-4 off a patch, R10.B, D99.)
    if (!closed) hi = breakOnEnd(clippedEnds, hi, p.s, q.s, x => solveStation(As[p.a].sheet, sigma, Bs[p.b].sheet, sigma, rAt(x), at(x).X, at(x).t, p.st.uvA, p.st.uvB, scaleMM), scaleMM);
    // (Near an end the Boolean trims, the break's section is moved on until it lies wholly beyond that end's plane: where
    // the chain meets the end face nearly square, a section across it lies a hair beside the face, and the cut leaves a
    // lens of the patch beyond — a two-vertex face, D102.)
    if (!closed && trimmedEnds.length) hi = breakBeyond(trimmedEnds, hi, h, x => { const st = solveStation(As[q.a].sheet, sigma, Bs[q.b].sheet, sigma, rAt(x), at(x).X, at(x).t, q.st.uvA, q.st.uvB, scaleMM); return st && sectionOf(st, sigma, sigma, rAt(x), g); });
    breaks.push({ s: hi, a: q.a, b: q.b });
  }
  // (An open chain's first stretch starts at its start, on the first station's faces; where it runs past an end, the
  // path turns from the edge to a straight run there — a jump in its curvature: a break too.)
  if (!closed) {
    // (Not within two steps of another break: a stretch that short would be a sliver patch; the jump then sits in a
    // patch, where refinement takes it.)
    for (const [x, on] of [[0, input.past?.[0]], [L, input.past?.[1]]] as const) if (on && !breaks.some(b => Math.abs(b.s - x) < 2 * h)) {
      const f = first.reduce((best, c) => Math.abs(c.s - x) < Math.abs(best.s - x) ? c : best);
      // (Moved on past a trimmed end's plane as the breaks above are, where its section lies a hair beside it, D102.)
      const at1 = trimmedEnds.length ? breakBeyond(trimmedEnds, x, h, y => { const st = solveStation(As[f.a].sheet, sigma, Bs[f.b].sheet, sigma, rAt(y), at(y).X, at(y).t, f.st.uvA, f.st.uvB, scaleMM); return st && sectionOf(st, sigma, sigma, rAt(y), g); }) : x;
      breaks.push({ s: at1, a: f.a, b: f.b });
    }
    breaks.sort((p, q) => p.s - q.s);
    breaks.unshift({ s: s0, a: first[0].a, b: first[0].b });
  }
  // (A variable radius: a break at each of its inner points too — there its cubic's second derivative jumps: inside a
  // patch the loft's error would fall more slowly there, D100. Not within two steps of another break, as above.)
  if (prof) {
    const knots = closed ? prof.x.slice(1, -1).map(x => ((x % L) + L) % L) : prof.x.slice(1, -1);
    for (const x of knots) if (x > s0 + 2 * h && x < s1 - 2 * h && !breaks.some(b => Math.abs(b.s - x) < 2 * h)) {
      const f = first.reduce((best, c) => Math.abs(c.s - x) < Math.abs(best.s - x) ? c : best);
      breaks.push({ s: x, a: f.a, b: f.b });
    }
    breaks.sort((p, q) => p.s - q.s);
  }
  if (!breaks.length) breaks.push({ s: 0, a: first[0].a, b: first[0].b });
  // (Breaks at one place — both contacts leaving their faces where a chain ends square — are one: the later's faces.)
  for (let k = breaks.length - 1; k > 0; k--) if (breaks[k].s - breaks[k - 1].s < 1e-6 * L) { breaks[k - 1] = { ...breaks[k], s: breaks[k - 1].s }; breaks.splice(k, 1); }
  // 2. Stations evenly within each stretch between breaks (an even count, about N in all by length; an open chain ends
  //    with one more at its end), each solved on its stretch's faces; refined as the h⁴ rate predicts.
  for (let N = fixedStations ?? N0, tries = 0; ; tries++) {
    if (N > 4096) throw new BrepError('GEOMETRY', `CAPABILITY: [APPROX_TOLERANCE_NOT_MET] edge ${name}: the fillet's lofted contacts stay over ${tolMM} mm off their faces (or its sections over ${4 * tolMM} mm off the true ones) at 4096 stations`);
    const sols: Station[] = [], cuts: number[] = [], radiusOf: number[] = [], sheetsOf: [Sheet, Sheet][] = [];
    for (let k = 0; k < breaks.length; k++) {
      const a0 = breaks[k].s, a1 = k + 1 < breaks.length ? breaks[k + 1].s : closed ? breaks[0].s + L : s1, n = Math.max(4, 2 * Math.round(N * (a1 - a0) / span / 2));
      const A = As[breaks[k].a], B = Bs[breaks[k].b], last = !closed && k === breaks.length - 1;
      cuts.push(sols.length / 2);
      for (let j = 0; j < n + (last ? 1 : 0); j++) {
        const x = a0 + (a1 - a0) * j / n, { X, t } = at(x), prev = sols.at(-1);
        // (Seeded by the last station in the stretch; its first by the previous contact, inverted afresh on this face —
        // the last one's (u, v) belong to the face across the seam.)
        const near = prev ?? first.reduce((best, c) => Math.abs(c.s - x) < Math.abs(best.s - x) ? c : best).st, seedA = j ? invertOn(A.sheet, near.pA, near.uvA) : invertOn(A.sheet, near.pA), seedB = j ? invertOn(B.sheet, near.pB, near.uvB) : invertOn(B.sheet, near.pB);
        const st = solveStation(A.sheet, sigma, B.sheet, sigma, rAt(x), X, t, seedA, seedB, scaleMM);
        if (!st || !contactOk(A, st.uvA, st.pA, beside(x)) || !contactOk(B, st.uvB, st.pB, beside(x))) throw leaves(x);
        sols.push(st); radiusOf.push(rAt(x)); sheetsOf.push([A.sheet, B.sheet]);
      }
    }
    const sections = sols.map((st, j) => sectionOf(st, sigma, sigma, radiusOf[j], g, undefined, undefined, shaped ? shapeAt(shaped, st, sheetsOf[j][0], sheetsOf[j][1], radiusOf[j]) : undefined));
    if (sections.some(x => !x)) throw new BrepError('GEOMETRY', `SELECTION: [TANGENT_FACES] edge ${name}: the fillet's section degenerates (its faces nearly tangent)`);
    const { brep, report, contactFaces } = loftTool(sections as Section[], id, cuts, closed);
    const { contact, turn } = contactsOf(brep, id, As, Bs, []);
    ringTrace?.({ stations: sols.length, patches: report.patches, contactMM: contact, sectionMM: report.maxDeviationMM });
    let ball = 0; sols.forEach((st, j) => { ball = Math.max(ball, Math.abs(len(sub(st.c, st.pA)) - radiusOf[j]), Math.abs(len(sub(st.c, st.pB)) - radiusOf[j])); });
    // (Done when the contacts lie within tolMM of their faces and the fillet within 4 tolMM of the true sections — on
    // planes the contacts are exact at any count, and the sections round a corner, R10.3a, then set it.)
    const worst = Math.max(contact / tolMM, report.maxDeviationMM / (4 * tolMM));
    if (worst <= 1 || fixedStations) return { brep, contactFaces, sides: [...As, ...Bs].map(sd => sd.face.name ?? sd.face.id), report: { edges: input.names, stations: sols.length, patches: report.patches, contact: contact, section: report.maxDeviationMM, ball: ball, normal: turn * 180 / Math.PI } };
    if (tries >= 6) N = 8192;
    else N = 2 * Math.ceil(N * Math.max(tries ? 1.25 : 2, 1.15 * worst ** 0.25) / 2);
  }
}
/**
 * The lofted contacts against their faces, halfway between lofted stations: the distance to the nearest face, and the
 * angle between the fillet's normal and that face's there (G1 to within it). A contact on one of `edges` (where the ball
 * rolls round an edge, R10.3) has no face to be tangent to: its distance counts, its angle does not.
 */
function contactsOf(brep: Brep, id: string, As: readonly Side[], Bs: readonly Side[], edges: readonly Curve[]): { contact: number; turn: number } {
  let contact = 0, turn = 0;
  for (const f of brep.faces) if (f.name === `${id}.face`) {
    const sheet = sheetOf(f.surface as Surface, 'forward'), spans = (f.surface as Surface).controlPoints[0].length - 3;
    for (let k = 0; k < spans; k++) for (const [u, sides] of [[0, Bs], [1, As]] as [number, readonly Side[]][]) {
      const v = (k + 0.5) / spans, x = pointOn(sheet, u, v), near = sides.map(sd => { const q = invertOn(sd.sheet, x); return { d: len(sub(pointOn(sd.sheet, ...q), x)), n: normalOn(sd.sheet, ...q) }; }).sort((a, b) => a.d - b.d)[0];
      contact = Math.max(contact, near.d);
      if (edges.some(c => curveDistance(c, x) <= 1e-6)) continue;
      turn = Math.max(turn, Math.acos(Math.min(1, Math.abs(dot(normalOn(sheet, u, v), near.n)))));
    }
  }
  return { contact, turn };
}
/** How far x lies from a curve (its nearest point by a coarse search and Newton). */
function curveDistance(c: Curve, x: Point): number { const t = footOn(c, x); return len(sub(evaluateCurve(c, t), x)); }
/** The parameter of the curve's point nearest x: the best of 32 samples, then Newton on (C − x)·C′ (clamped). */
function footOn(c: Curve, x: Point, hint?: number): number {
  const [t0, t1] = curveDomain(c);
  let t = hint ?? t0;
  if (hint === undefined) { let best = Infinity; for (let i = 0; i <= 32; i++) { const s = t0 + (t1 - t0) * i / 32, d = len(sub(evaluateCurve(c, s), x)); if (d < best) { best = d; t = s; } } }
  for (let k = 0; k < 30; k++) {
    const p = evaluateCurve(c, t), d1 = curveTangent(c, t), f = dot(sub(p, x), d1), g = dot(d1, d1);
    if (!(g > 0)) break;
    const next = Math.min(t1, Math.max(t0, t - f / g));
    if (Math.abs(next - t) <= 1e-15 * (t1 - t0 + 1)) { t = next; break; }
    t = next;
  }
  return t;
}
/** C′(t) by differences (central, one-sided at the domain's ends). */
function curveTangent(c: Curve, t: number): Point {
  const [t0, t1] = curveDomain(c), h = 1e-6 * (t1 - t0), a = Math.max(t0, t - h), b = Math.min(t1, t + h);
  return scale(sub(evaluateCurve(c, b), evaluateCurve(c, a)), 1 / (b - a));
}
/**
 * The sides grown by the faces that go on smoothly from the last contacts' faces (R10.4a, D95): across an edge of that
 * face whose two faces share their normal there (a round already made, its tangent faces), the face beyond — not yet on
 * either side. Returns whether any was added.
 */
function growSides(body: Brep, As: Side[], Bs: Side[], last: { a: number; b: number }, extend: boolean, scaleMM: number): boolean {
  const loops = new Map(body.loops.map(l => [l.id, l])), faceOfLoop = new Map(body.loops.map(l => [l.id, l.face])), byId = new Map(body.faces.map(f => [f.id, f]));
  const facesOfEdge = new Map<string, string[]>();
  for (const c of body.coedges) facesOfEdge.set(c.edge, [...(facesOfEdge.get(c.edge) ?? []), faceOfLoop.get(c.loop)!]);
  const known = new Set([...As, ...Bs].map(sd => sd.face.id)), coedges = new Map(body.coedges.map(c => [c.id, c])), edges = new Map(body.edges.map(e => [e.id, e]));
  let added = false;
  // (From the last contacts' faces first; at the chain's start, or where that adds nothing, from every face of the side.)
  for (const [list, idx] of [[As, last.a], [Bs, last.b]] as const) for (const face of [list[idx].face, ...list.map(sd => sd.face)]) {
    if (added && face !== list[idx].face) break;
    for (const lid of face.loops) for (const cid of loops.get(lid)!.coedges) {
      const e = edges.get(coedges.get(cid)!.edge)!, other = (facesOfEdge.get(e.id) ?? []).find(f => f !== face.id);
      if (!other || known.has(other)) continue;
      const [t0, t1] = curveDomain(e.curve), x = evaluateCurve(e.curve, (t0 + t1) / 2), g = byId.get(other)!;
      const s1 = sheetOf(face.surface as Surface, face.sense), s2 = sheetOf(g.surface as Surface, g.sense);
      if (len(sub(normalOn(s1, ...invertOn(s1, x)), normalOn(s2, ...invertOn(s2, x)))) > 1e-6) continue;
      list.push(sideOf(body, g, extend, scaleMM)); known.add(other); added = true;
    }
  }
  return added;
}
/** Inside the face's region with no margin (the bisection's test: on the seam counts as off). */
function strictlyInside(side: Side, uv: XY): boolean {
  let inside = false;
  for (const ring of side.rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > uv[1]) !== (yj > uv[1]) && uv[0] < (xj - xi) * (uv[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---- the ball rolling round an edge (R10.3a, D92) -------------------------------------------------------------------
/** Each corner ring's stations, before the loft (tests: unset in use). */
export let cornerTrace: ((x: { sols: readonly Station[]; cuts: readonly number[]; spans: readonly unknown[]; breaks: readonly unknown[] }) => void) | null = null;
export function setCornerTrace(f: typeof cornerTrace): void { cornerTrace = f; }
/** 0 at 0, 1 at 1, flat at both (C¹): 3x² − 2x³. */
function smooth(x: number): number { const y = Math.max(0, Math.min(1, x)); return y * y * (3 - 2 * y); }
/** The unit part of x square to the unit e. */
function across(x: Point, e: Point): Point { return unit(sub(x, scale(e, dot(x, e)))); }
/** From a to b (unit, square to the edge) by the fraction θ of the angle between them, the short way round. */
function slerpUnit(a: Point, b: Point, theta: number): Point {
  const om = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  if (!(om > 1e-12)) return a;
  return unit(add(scale(a, Math.sin((1 - theta) * om)), scale(b, Math.sin(theta * om))));
}
/** F(q) for q = (u, v, t): the ball on S (its centre c) r from the edge C(t), the foot square to C there, at the angle θ round it. */
function cornerResidual(S: Sheet, sigma: number, r: number, C: Curve, n1: Point, n2: Point, theta: number, q: readonly number[]): number[] {
  const c = offsetPoint(S, sigma, r, q[0], q[1]), [t0, t1] = curveDomain(C), t = Math.min(t1, Math.max(t0, q[2]));
  const e = unit(curveTangent(C, t)), d = sub(c, evaluateCurve(C, t)), m = slerpUnit(across(scale(n1, sigma), e), across(scale(n2, sigma), e), theta);
  return [dot(d, e), len(d) - r, dot(d, cross(e, m))];
}
/** The faces' outward normals at a point of the edge between them. */
function edgeNormals(before: Sheet, next: Sheet, p: Point, hints: [XY | undefined, XY | undefined]): { n1: Point; n2: Point; hints: [XY, XY] } {
  const q1 = invertOn(before, p, hints[0]), q2 = invertOn(next, p, hints[1]);
  return { n1: normalOn(before, ...q1), n2: normalOn(next, ...q2), hints: [q1, q2] };
}
/**
 * The ball of radius r touching S and the edge C between the faces `before` and `next`, its foot's direction from the
 * edge the fraction θ of the way from the first face's normal to the second's (σ as for the ball): Newton in (u, v, t)
 * with the faces' normals at the foot held, then updated, until the foot settles. Null when it does not converge, or
 * the ball lies on the wrong side of the edge.
 */
export function solveCorner(S: Sheet, sigma: number, r: number, C: Curve, before: Sheet, next: Sheet, theta: number, seedS: XY, seedT: number, size: number): { c: Point; pS: Point; uvS: XY; nS: Point; foot: Point; t: number; m: Point } | null {
  const [t0, t1] = curveDomain(C), clampT = (t: number) => Math.min(t1, Math.max(t0, t)), tol = 1e-12 * size;
  let q = [clampU(S, seedS[0]), clampV(S, seedS[1]), clampT(seedT)], frame = edgeNormals(before, next, evaluateCurve(C, q[2]), [undefined, undefined]);
  const hs = [10 * S.hu, 10 * S.hv, 1e-7 * (t1 - t0)];
  for (let outer = 0; outer < 4; outer++) {
    let f = cornerResidual(S, sigma, r, C, frame.n1, frame.n2, theta, q);
    for (let it = 0; it < 40 && norm(f) > tol; it++) {
      const J = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (let k = 0; k < 3; k++) {
        const qp = [k === 0 ? q[0] + hs[0] : q[0], k === 1 ? q[1] + hs[1] : q[1], k === 2 ? q[2] + hs[2] : q[2]], qm = [k === 0 ? q[0] - hs[0] : q[0], k === 1 ? q[1] - hs[1] : q[1], k === 2 ? q[2] - hs[2] : q[2]];
        qp[0] = clampU(S, qp[0]); qp[1] = clampV(S, qp[1]); qp[2] = clampT(qp[2]); qm[0] = clampU(S, qm[0]); qm[1] = clampV(S, qm[1]); qm[2] = clampT(qm[2]);
        const fp = cornerResidual(S, sigma, r, C, frame.n1, frame.n2, theta, qp), fm = cornerResidual(S, sigma, r, C, frame.n1, frame.n2, theta, qm);
        for (let i = 0; i < 3; i++) J[i][k] = (fp[i] - fm[i]) / (qp[k] - qm[k]);
      }
      let step: number[];
      try { const x = solveDense(J, [[-f[0]], [-f[1]], [-f[2]]]); step = [x[0][0], x[1][0], x[2][0]]; } catch { return null; }
      if (!step.every(Number.isFinite)) return null;
      let lambda = 1, nextQ = q, fn = f;
      for (let k = 0; k < 20; k++) {
        nextQ = [clampU(S, q[0] + lambda * step[0]), clampV(S, q[1] + lambda * step[1]), clampT(q[2] + lambda * step[2])];
        fn = cornerResidual(S, sigma, r, C, frame.n1, frame.n2, theta, nextQ);
        if (norm(fn) < norm(f)) break;
        lambda /= 2;
      }
      if (!(norm(fn) < norm(f))) break;
      q = nextQ; f = fn;
    }
    if (!(norm(f) <= 1e-9 * size)) return null;
    const moved = edgeNormals(before, next, evaluateCurve(C, q[2]), frame.hints), settled = len(sub(moved.n1, frame.n1)) + len(sub(moved.n2, frame.n2)) <= 1e-13;
    frame = moved;
    if (settled) break;
  }
  const uvS: XY = [q[0], q[1]], pS = pointOn(S, ...uvS), nS = normalOn(S, ...uvS), c = add(pS, scale(nS, sigma * r)), foot = evaluateCurve(C, q[2]);
  const e = unit(curveTangent(C, q[2])), m = slerpUnit(across(scale(frame.n1, sigma), e), across(scale(frame.n2, sigma), e), theta);
  if (!(dot(sub(c, foot), m) > 0) || Math.abs(len(sub(c, foot)) - r) > 1e-9 * size) return null;
  return { c, pS, uvS, nS, foot, t: q[2], m };
}
/** F(q) for q = (u, v, t): the ball on S (its centre c) r from the edge C(t), the foot square to C there, its centre in the station's plane. */
function cliffResidual(S: Sheet, sigma: number, r: number, C: Curve, X: Point, tn: Point, q: readonly number[]): number[] {
  const c = offsetPoint(S, sigma, r, q[0], q[1]), [t0, t1] = curveDomain(C), t = Math.min(t1, Math.max(t0, q[2]));
  const e = unit(curveTangent(C, t)), d = sub(c, evaluateCurve(C, t));
  return [dot(d, e), len(d) - r, dot(sub(c, X), tn)];
}
/**
 * The ball of radius r touching S and the edge C — rolling on along that edge where the face beside it ends (a cliff
 * edge, R10.4b, D96) — its centre in the plane through X square to tn: Newton in (u, v, t). Null when it does not
 * converge; `m` the unit way from the foot to the centre.
 */
export function solveCliff(S: Sheet, sigma: number, r: number, C: Curve, X: Point, tn: Point, seedS: XY, seedT: number, size: number): { c: Point; pS: Point; uvS: XY; nS: Point; foot: Point; t: number; m: Point } | null {
  const [t0, t1] = curveDomain(C), clampT = (t: number) => Math.min(t1, Math.max(t0, t)), tol = 1e-12 * size, hs = [10 * S.hu, 10 * S.hv, 1e-7 * (t1 - t0)];
  let q = [clampU(S, seedS[0]), clampV(S, seedS[1]), clampT(seedT)], f = cliffResidual(S, sigma, r, C, X, tn, q);
  for (let it = 0; it < 40 && norm(f) > tol; it++) {
    const J = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let k = 0; k < 3; k++) {
      const qp = [k === 0 ? q[0] + hs[0] : q[0], k === 1 ? q[1] + hs[1] : q[1], k === 2 ? q[2] + hs[2] : q[2]], qm = [k === 0 ? q[0] - hs[0] : q[0], k === 1 ? q[1] - hs[1] : q[1], k === 2 ? q[2] - hs[2] : q[2]];
      qp[0] = clampU(S, qp[0]); qp[1] = clampV(S, qp[1]); qp[2] = clampT(qp[2]); qm[0] = clampU(S, qm[0]); qm[1] = clampV(S, qm[1]); qm[2] = clampT(qm[2]);
      const fp = cliffResidual(S, sigma, r, C, X, tn, qp), fm = cliffResidual(S, sigma, r, C, X, tn, qm);
      for (let i = 0; i < 3; i++) J[i][k] = (fp[i] - fm[i]) / (qp[k] - qm[k]);
    }
    let step: number[];
    try { const x = solveDense(J, [[-f[0]], [-f[1]], [-f[2]]]); step = [x[0][0], x[1][0], x[2][0]]; } catch { return null; }
    if (!step.every(Number.isFinite)) return null;
    let lambda = 1, nextQ = q, fn = f;
    for (let k = 0; k < 20; k++) {
      nextQ = [clampU(S, q[0] + lambda * step[0]), clampV(S, q[1] + lambda * step[1]), clampT(q[2] + lambda * step[2])];
      fn = cliffResidual(S, sigma, r, C, X, tn, nextQ);
      if (norm(fn) < norm(f)) break;
      lambda /= 2;
    }
    if (!(norm(fn) < norm(f))) break;
    q = nextQ; f = fn;
  }
  if (!(norm(f) <= 1e-9 * size)) return null;
  const uvS: XY = [q[0], q[1]], pS = pointOn(S, ...uvS), nS = normalOn(S, ...uvS), c = add(pS, scale(nS, sigma * r)), foot = evaluateCurve(C, q[2]);
  return { c, pS, uvS, nS, foot, t: q[2], m: unit(sub(c, foot)) };
}
/** Whether a ball's way from its foot on an edge (`m`) lies within the wedge outside the edge's two faces (normals n1, n2, σ as for the ball), off both. */
function withinWedge(m: Point, n1: Point, n2: Point, sigma: number, slack = 1e-9): boolean {
  const a = scale(n1, sigma), b = scale(n2, sigma), w = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  const ta = Math.acos(Math.max(-1, Math.min(1, dot(m, a)))), tb = Math.acos(Math.max(-1, Math.min(1, dot(m, b))));
  return ta < w - slack && tb < w - slack && Math.abs(ta + tb - w) < 1e-6;
}
/** A corner ball as a station: its contacts on sides A and B (the foot standing for the edge's side, its normal from the foot to the centre). */
function cornerStation(b: NonNullable<ReturnType<typeof solveCorner>>, side: 'A' | 'B', sigma: number, r: number, X: Point, t: Point): Station {
  const nE = scale(sub(b.c, b.foot), 1 / (sigma * r)), uvE: XY = [b.t, 0];
  return side === 'B' ? { X, t, c: b.c, pA: b.pS, pB: b.foot, uvA: b.uvS, uvB: uvE, nA: b.nS, nB: nE } : { X, t, c: b.c, pA: b.foot, pB: b.pS, uvA: uvE, uvB: b.uvS, nA: nE, nB: b.nS };
}
/**
 * The chain's point and tangent at x within [lo, hi] (between the corners about it: a corner is not smoothed over),
 * central, second-order one-sided within a step of lo or hi.
 */
function spanAt(P: (x: number) => Point, h: number, x: number, lo: number, hi: number): { X: Point; t: Point } {
  const X = P(x);
  if (x - h < lo) return { X, t: unit(add(add(scale(X, -3), scale(P(x + h), 4)), scale(P(x + 2 * h), -1))) };
  if (x + h > hi) return { X, t: unit(add(add(scale(X, 3), scale(P(x - h), -4)), P(x - 2 * h))) };
  return { X, t: unit(sub(P(x + h), P(x - h))) };
}
/** The x in [lo, hi] where (c − X(x))·t(x) changes sign (bisection), the span's tangents one-sided within [lo, hi]. */
function planeThrough(P: (x: number) => Point, h: number, c: Point, lo: number, hi: number, spanLo: number, spanHi: number): number {
  const f = (x: number) => { const { X, t } = spanAt(P, h, x, spanLo, spanHi); return dot(sub(c, X), t); };
  let a = lo, b = hi, fa = f(a);
  for (let k = 0; k < 80; k++) { const m = (a + b) / 2, fm = f(m); if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m; }
  return (a + b) / 2;
}
/** A cliff (R10.4b, D96): where a face of a side ends at a sharp edge, the ball rolls on touching the other side's face and that edge. */
interface Cliff { readonly side: 'A' | 'B'; readonly S: Side; readonly edge: Curve; readonly F: Sheet; readonly F2: Sheet; readonly F2face: Face }
type CliffBall = NonNullable<ReturnType<typeof solveCliff>>;
type Span = { kind: 'edge'; x0: number; x1: number; lo: number; hi: number; rho: number; length: number; extra?: Face[] } | { kind: 'corner'; k: number; rho: number; length: number }
  | { kind: 'cliff'; x0: number; x1: number; lo: number; hi: number; rho: number; length: number; c: Cliff; first: CliffBall; last: CliffBall };
/**
 * The fillet tool of a closed loop whose ball rolls round edges at some of its corners (R10.3a, D92): the loop in spans
 * — along an edge (stations square to the chain, on the faces) and round a corner (stations at a fraction of the turn
 * from one face's normal to the next's, the ball on the shared face and the edge) — each span's ends where the balls
 * meet (a corner's first ball touches the face before at the edge: the span before ends at the station through its
 * centre). Then as the plain ring: refined until the lofted contacts lie within `tolMM` of their faces.
 */
function cornerFillet(body: Brep, input: RingInput): { brep: Brep; report: FilletReport; contactFaces: string[]; sides: string[] } {
  const { r, id, scaleMM, tolMM } = input, sigma = input.convex ? -1 : 1, name = input.names[0], n = input.loop.length;
  const unsupported = (why: string) => new BrepError('GEOMETRY', `CAPABILITY: [VERTEX_BLEND_UNSUPPORTED] edge ${name}: ${why}`), closed = input.closed !== false;
  if (!input.facesOf) throw new BrepError('INPUT', 'rolling ball: a chain with corners needs its edges\' faces');
  const As = input.sideA.map(f => sideOf(body, f, !closed, scaleMM)), Bs = input.sideB.map(f => sideOf(body, f, !closed, scaleMM));
  const alpha = Math.acos(Math.max(-1, Math.min(1, dot(input.start.wA, input.start.wB))));
  if (alpha > Math.PI - 1e-6) throw new BrepError('GEOMETRY', `SELECTION: [TANGENT_FACES] edge ${name}: its faces meet tangentially; there is no corner to finish`);
  const back = r / Math.tan(alpha / 2), path = chainPath(input.loop, closed), L = path.length, g = 0.5 * r, ext: Ext = [[], []], P = (x: number) => pastAt(path, closed, ext, x).X;
  const corners = [...(input.corners ?? [])].sort((a, b) => a.after - b.after);
  // Each corner: the faces, its first and last balls, and where the chain's stations reach them.
  const rolls = corners.map(k => {
    const list = k.side === 'A' ? Bs : As, si = list.findIndex(sd => sd.face.id === k.shared.id);
    if (si < 0) throw unsupported('the face it rolls on is not one of the fillet\'s');
    const S = list[si], before = sheetOf(k.before.surface as Surface, k.before.sense), next = sheetOf(k.next.surface as Surface, k.next.sense);
    if (!closed && k.after >= n - 1) throw unsupported('a corner past the chain\'s end');
    const sV = k.after + 1 < n ? path.starts[k.after + 1] : L, lo = path.starts[k.after], hi = k.after + 2 < n ? path.starts[k.after + 2] : k.after + 1 < n ? L : L + path.starts[1];
    // (Seeded at the vertex: the foot about r up the edge, the shared face's contact under the centre.)
    const V = path.at(sV).X, tV = footOn(k.edge, V), nV = normalOn(S.sheet, ...invertOn(S.sheet, V));
    const at = (theta: number, prev?: { uvS: XY; t: number }) => {
      if (prev) return solveCorner(S.sheet, sigma, r, k.edge, before, next, theta, prev.uvS, prev.t, scaleMM);
      const e = unit(curveTangent(k.edge, tV)), fr = edgeNormals(before, next, V, [undefined, undefined]), m = slerpUnit(across(scale(fr.n1, sigma), e), across(scale(fr.n2, sigma), e), theta);
      const guess = add(V, add(scale(m, r), scale(nV, sigma * r)));
      return solveCorner(S.sheet, sigma, r, k.edge, before, next, theta, invertOn(S.sheet, sub(guess, scale(nV, sigma * r))), footOn(k.edge, guess, tV), scaleMM);
    };
    // (The last ball stepped to from the first: Newton from across the turn need not find it.)
    const b0 = at(0);
    let b1 = b0;
    for (let j = 1; j <= 8 && b1; j++) b1 = at(j / 8, b1);
    if (!b0 || !b1) throw unsupported(`the ball does not roll round the edge at the corner near (${V.map(x => +x.toFixed(3)).join(', ')})`);
    // The span before ends where its station plane passes through b0's centre; the span after starts at b1's.
    const hh = 1e-6 * L, reachMM = back + 2 * g + 2 * r, f0 = dot(sub(b0.c, V), spanAt(P, hh, sV, lo, sV).t), f1 = dot(sub(b1.c, V), spanAt(P, hh, sV, sV, hi).t), eps = 1e-9 * scaleMM;
    if (f0 > eps || f1 < -eps) throw unsupported(`the ball meets the edge past the corner near (${V.map(x => +x.toFixed(3)).join(', ')}); a setback there is not supported yet`);
    const s1 = f0 >= -eps ? sV : planeThrough(P, hh, b0.c, Math.max(lo, sV - reachMM), sV, lo, sV);
    const s2 = f1 <= eps ? sV : planeThrough(P, hh, b1.c, sV, Math.min(hi, sV + reachMM), sV, hi);
    const om = Math.acos(Math.max(-1, Math.min(1, dot(sub(b0.c, b0.foot), sub(b1.c, b1.foot)) / (r * r))));
    // (The tool grows from the edge into the wedge between its faces, along their bisector — away from both, so none of
    // its faces lies along one; σ as for the ball: into the material behind a concave fillet's contact, out of it for a
    // convex one.)
    // (It turns as the ball does, from halfway between the bisector and the first face's inward normal to halfway towards
    // the second's: where the feet are one point — a plane square to the edge — the grown points still sweep an arc, so
    // the tool's wall there is a fan, not a line.)
    const fr = edgeNormals(before, next, b0.foot, [undefined, undefined]), wedge = scale(unit(add(fr.n1, fr.n2)), -sigma);
    const w0 = unit(add(wedge, scale(fr.n1, -sigma))), w1 = unit(add(wedge, scale(fr.n2, -sigma)));
    return { k, S, si, before, next, b0, b1, s1, s2, sV, lo, hi, w0, w1, length: Math.max(r * om, 1e-3 * r) };
  });
  // The spans in order. A loop: from the end of the last corner round, an edge span (wrapped below 0) and its corner, and
  // so on. An open chain: from its start, edge span, corner, …, edge span to its end (run past either end, R10.2b).
  const spans: Span[] = [], R = rolls.length;
  // (No corner — a ring or a chain the plain ring sent here for its cliffs, R10.4b: one edge span.)
  if (!R) spans.push({ kind: 'edge', x0: 0, x1: L, lo: -Infinity, hi: Infinity, rho: 0, length: L });
  for (let j = 0; R && j <= R; j++) {
    if (closed && j === R) break;
    const prev = j > 0 ? rolls[j - 1] : closed ? rolls[R - 1] : null, next = j < R ? rolls[j] : null;
    const x0 = prev ? (j === 0 ? prev.s2 - L : prev.s2) : 0, x1 = next ? next.s1 : L;
    if (!(x1 - x0 > 1e-6 * L)) throw unsupported('the corners at the ends of an edge leave none of it between them');
    spans.push({ kind: 'edge', x0, x1, lo: prev ? (j === 0 ? prev.sV - L : prev.sV) : -Infinity, hi: next ? next.sV : Infinity, rho: 0, length: x1 - x0 });
    if (next) spans.push({ kind: 'corner', k: j, rho: 0, length: next.length });
  }
  const leaves = (X: Point) => new BrepError('INPUT', `PARAMETER: [CONTACT_LEAVES_FACE] edge ${name}: a fillet of ${r} mm runs off its faces near (${X.map(q => +q.toFixed(3)).join(', ')}); rolling over the next face arrives with R10.4`);
  // Each edge span's own faces (only those of its edges: a station's plane can meet another face of the side in a ball as
  // well — a lug's far end face, parallel to the near one), and its stations' solve on them.
  const facesIn = (sp: Extract<Span, { kind: 'edge' }>) => {
    const own = new Set<string>();
    for (let c = 0; c < n; c++) {
      const c0 = path.starts[c], c1 = c + 1 < n ? path.starts[c + 1] : L, lo0 = closed ? [-L, 0, L] : [0];
      for (const shift of lo0) if (Math.min(c1 + shift, sp.x1) - Math.max(c0 + shift, sp.x0) > 1e-9 * L || (!closed && ((c === 0 && sp.x0 < 0) || (c === n - 1 && sp.x1 > L)))) for (const f of input.facesOf![c]) own.add(f);
    }
    for (const f of sp.extra ?? []) own.add(f.id);
    const ia = As.map((_, i) => i).filter(i => own.has(As[i].face.id)), ib = Bs.map((_, i) => i).filter(i => own.has(Bs[i].face.id));
    return { ia, ib, Asp: ia.map(i => As[i]), Bsp: ib.map(i => Bs[i]) };
  };
  const N0 = Math.max(64, 2 * Math.ceil((L + rolls.reduce((a, x) => a + x.length, 0)) / (r / 4) / 2)), h = L / N0, hd = 1e-6 * L;
  // (Within reach of an end run past, a contact may run off its face across that end — beyond it, it is not checked —
  // but not off across the face's side, D97.)
  const reach = back + 2 * g, endsPast = closed ? [] : pastEnds(input.past, path.at(L / 2).X, scaleMM), beside = (x: number): Check => closed || (x >= (input.past?.[0] ? reach : 0) && x <= L - (input.past?.[1] ? reach : 0)) || endsPast;
  const solverOn = (sp: Extract<Span, { kind: 'edge' }>, seed: { pA: Point; pB: Point }) => {
    const { ia, ib, Asp, Bsp } = facesIn(sp);
    return { Asp, Bsp, ia, ib, solve: (x: number, prev: { st: Station; a: number; b: number } | undefined, check: Check) => {
      const { X, t } = spanAt(P, hd, x, sp.lo, sp.hi);
      const got = stationOn(Asp, Bsp, prev ? [Math.max(0, ia.indexOf(prev.a)), Math.max(0, ib.indexOf(prev.b))] : [0, 0], sigma, r, X, t, prev ? prev.st.pA : seed.pA, prev ? prev.st.pB : seed.pB, prev?.st.uvA, prev?.st.uvB, scaleMM, check);
      return got && { st: got.st, a: ia[got.a], b: ib[got.b] };
    } };
  };
  // The ball at a span's start: the last of the corner before it; at an open chain's start, from the faces' corner.
  const neighbour = (si: number, d: -1 | 1): Span | null => { const k = si + d; return k >= 0 && k < spans.length ? spans[k] : closed && spans.length > 1 ? spans[(k + spans.length) % spans.length] : null; };
  const seedOf = (si: number, x: number) => {
    const prev = neighbour(si, -1), X = path.at(Math.max(0, Math.min(L, x))).X;
    if (prev?.kind === 'corner') { const roll = rolls[prev.k], st = cornerStation(roll.b1, roll.k.side, sigma, r, X, X); return { pA: st.pA, pB: st.pB }; }
    if (prev?.kind === 'cliff') { const st = cornerStation(prev.last, prev.c.side, sigma, r, X, X); return { pA: st.pA, pB: st.pB }; }
    return { pA: add(X, scale(input.start.wA, back)), pB: add(X, scale(input.start.wB, back)) };
  };
  // (Into the wedge at a cliff's foot: −σ along the bisector of its two faces' normals.)
  const cliffWedge = (c: Cliff, foot: Point) => { const fr = edgeNormals(c.F, c.F2, foot, [undefined, undefined]); return scale(unit(add(fr.n1, fr.n2)), -sigma); };
  // An open chain's ends run past (R10.2b): marched on along the faces' junction until the section clears the end.
  if (!closed) for (const [k, plane] of (input.past ?? []).entries()) if (plane) {
    const si = k ? spans.length - 1 : 0, sp = spans[si] as Extract<Span, { kind: 'edge' }>, x = k ? L : 0, { Asp, Bsp, solve } = solverOn(sp, seedOf(si, x));
    const got = solve(x, undefined, false);
    if (!got) throw leaves(path.at(x).X);
    const first: FirstStation[] = [{ ...got, s: x }];
    const stop = marchPast(k as 0 | 1, plane, { path, ext, As: Asp, Bs: Bsp, first, solveAt: (y, prev, check) => solve(y, prev, check), sigma, r, g, h, N0, scaleMM, name, leaves: y => leaves(path.at(y < 0 ? 0 : L).X) });
    if (k) { sp.x1 = stop; sp.hi = Infinity; } else { sp.x0 = stop; sp.lo = -Infinity; }
    sp.length = sp.x1 - sp.x0;
  }
  // R10.4b (D96): cliffs. Each edge span walked: where a station no longer solves on its faces and the last contact on
  // one side lies at a sharp edge of its face, the ball rolls on along that edge, touching the other side's face, until
  // it can touch a face again — that face, or the one beyond the edge; the span is cut where it starts and ends
  // (bisection: where the face ball's contact reaches the edge; where the edge ball leaves the wedge outside it).
  const byId = new Map(body.faces.map(f => [f.id, f])), loopsById = new Map(body.loops.map(l => [l.id, l])), coById = new Map(body.coedges.map(c => [c.id, c])), edgesById = new Map(body.edges.map(e => [e.id, e]));
  const facesOfEdge = new Map<string, string[]>(); for (const c of body.coedges) facesOfEdge.set(c.edge, [...(facesOfEdge.get(c.edge) ?? []), loopsById.get(c.loop)!.face]);
  const own = new Set(input.loop.map(l => l.curve));
  const findCliff = (face: { st: Station; a: number; b: number }, X: Point, t: Point): { c: Cliff; ball: CliffBall } | null => {
    // (The side whose contact runs off its face: the ball on the last faces, unchecked, here.)
    // (On the faces' surfaces carried on along their straight directions: past a face's end its own patch stops.)
    const ext = (sd: Side) => sheetOf(extendedSurface(sd.face.surface as Surface), sd.face.sense), eA = ext(As[face.a]), eB = ext(Bs[face.b]);
    const off = solveStation(eA, sigma, eB, sigma, r, X, t, invertOn(eA, face.st.pA), invertOn(eB, face.st.pB), scaleMM);
    if (!off) return null;
    const outA = !insideFace(As[face.a], invertOn(As[face.a].sheet, off.pA)) || len(sub(pointOn(As[face.a].sheet, ...invertOn(As[face.a].sheet, off.pA)), off.pA)) > 1e-6 * scaleMM;
    const outB = !insideFace(Bs[face.b], invertOn(Bs[face.b].sheet, off.pB)) || len(sub(pointOn(Bs[face.b].sheet, ...invertOn(Bs[face.b].sheet, off.pB)), off.pB)) > 1e-6 * scaleMM;
    if (outA === outB) return null;
    for (const side of [outB ? 'B' : 'A'] as const) {
      const F = side === 'B' ? Bs[face.b] : As[face.a], S = side === 'B' ? As[face.a] : Bs[face.b], q = side === 'B' ? off.pB : off.pA, uvS = invertOn(S.sheet, side === 'B' ? off.pA : off.pB);
      // (The face's edge nearest where the contact runs off — not one of the chain's own edges.)
      let best: { e: Brep['edges'][number]; d: number } | null = null;
      for (const lid of F.face.loops) for (const cid of loopsById.get(lid)!.coedges) { const e = edgesById.get(coById.get(cid)!.edge)!; if (own.has(e.curve)) continue; const d = curveDistance(e.curve, q); if (!best || d < best.d) best = { e, d }; }
      if (!best || best.d > r) continue;
      const otherId = (facesOfEdge.get(best.e.id) ?? []).find(f => f !== F.face.id), other = otherId ? byId.get(otherId) : undefined;
      if (!other) continue;
      const F2 = sheetOf(other.surface as Surface, other.sense), ball = solveCliff(S.sheet, sigma, r, best.e.curve, X, t, uvS, footOn(best.e.curve, q), scaleMM);
      if (!ball) continue;
      const fr = edgeNormals(F.sheet, F2, ball.foot, [undefined, undefined]);
      if (len(sub(fr.n1, fr.n2)) < 1e-6 || !withinWedge(ball.m, fr.n1, fr.n2, sigma)) continue;
      return { c: { side, S, edge: best.e.curve, F: F.sheet, F2, F2face: other }, ball };
    }
    return null;
  };
  const cliffsIn = (sp: Extract<Span, { kind: 'edge' }>, si: number): Span[] => {
    const m = Math.max(16, 2 * Math.ceil(N0 * sp.length / (L + rolls.reduce((a, x) => a + x.length, 0)) / 2)), parts: Span[] = [];
    let solver = solverOn(sp, seedOf(si, sp.x0)), cur: Extract<Span, { kind: 'edge' }> = { ...sp };
    let face: { st: Station; a: number; b: number; x: number } | null = null, cl: { c: Cliff; first: CliffBall; last: CliffBall; x0: number; xLast: number } | null = null;
    for (let j = 0; j <= m; j++) {
      const x = sp.x0 + sp.length * j / m, { X, t } = spanAt(P, hd, x, sp.lo, sp.hi);
      if (!cl) {
        const got = solver.solve(x, face ?? undefined, beside(x));
        if (got) { face = { ...got, x }; continue; }
        // (At the span's start already off its faces — a ring wholly on a cliff: from the ball on its faces unchecked.)
        if (!face && j === 0) {
          const seed = seedOf(si, x);
          for (const a of solver.ia) for (const b of solver.ib) {
            const eA = sheetOf(extendedSurface(As[a].face.surface as Surface), As[a].face.sense), eB = sheetOf(extendedSurface(Bs[b].face.surface as Surface), Bs[b].face.sense);
            const st = solveStation(eA, sigma, eB, sigma, r, X, t, invertOn(eA, seed.pA), invertOn(eB, seed.pB), scaleMM), found0 = st && findCliff({ st, a, b }, X, t);
            if (found0) { cl = { c: found0.c, first: found0.ball, last: found0.ball, x0: x, xLast: x }; break; }
          }
          if (cl) continue;
        }
        const fc = face as { st: Station; a: number; b: number; x: number } | null, found: { c: Cliff; ball: CliffBall } | null = fc ? findCliff(fc, X, t) : null;
        if (!fc || !found) return [sp];
        face = fc;
        // (Where the face ball's contact reaches the edge: its last station strictly on the face, by bisection.)
        const F = found.c.side === 'B' ? Bs[face.b] : As[face.a];
        let lo = face.x, hi = x;
        for (let k = 0; k < 60; k++) {
          const mid = (lo + hi) / 2, at = spanAt(P, hd, mid, sp.lo, sp.hi), st = solveStation(As[face.a].sheet, sigma, Bs[face.b].sheet, sigma, r, at.X, at.t, face.st.uvA, face.st.uvB, scaleMM);
          if (st && strictlyInside(F, found.c.side === 'B' ? st.uvB : st.uvA)) lo = mid; else hi = mid;
        }
        const at0 = spanAt(P, hd, hi, sp.lo, sp.hi), q0 = found.c.side === 'B' ? face.st.pB : face.st.pA, uv0 = found.c.side === 'B' ? face.st.uvA : face.st.uvB;
        const first = solveCliff(found.c.S.sheet, sigma, r, found.c.edge, at0.X, at0.t, uv0, footOn(found.c.edge, q0), scaleMM) ?? found.ball;
        if (hi - cur.x0 > 1e-6 * L) { cur.x1 = hi; cur.length = hi - cur.x0; parts.push(cur); }
        cl = { c: found.c, first, last: found.ball, x0: hi, xLast: x };
        continue;
      }
      const b = solveCliff(cl.c.S.sheet, sigma, r, cl.c.edge, X, t, cl.last.uvS, cl.last.t, scaleMM), fr = b && edgeNormals(cl.c.F, cl.c.F2, b.foot, [undefined, undefined]);
      if (b && fr && withinWedge(b.m, fr.n1, fr.n2, sigma) && insideFace(cl.c.S, b.uvS)) { cl.last = b; cl.xLast = x; continue; }
      // (Across a seam — the other contact onto the next face of its side, or the foot off the end of its edge onto the
      // edge going on from there (a rim's halves) with their faces: a new cliff span from where the old one stops holding,
      // by bisection.)
      const holds = (c: Cliff, bb: CliffBall | null) => { if (!bb) return false; const f2 = edgeNormals(c.F, c.F2, bb.foot, [undefined, undefined]); const [t0, t1] = curveDomain(c.edge), span = t1 - t0; return withinWedge(bb.m, f2.n1, f2.n2, sigma) && insideFace(c.S, bb.uvS) && bb.t > t0 + 1e-9 * span && bb.t < t1 - 1e-9 * span; };
      const nextCfg = (): { c: Cliff; ball: CliffBall } | null => {
        // (The edge itself — the other contact across a seam — or one going on from an end of it.)
        const list = cl!.c.side === 'B' ? As : Bs, [ta, tb] = curveDomain(cl!.c.edge), ends = [evaluateCurve(cl!.c.edge, ta), evaluateCurve(cl!.c.edge, tb)], pts = [b?.foot ?? cl!.last.foot];
        const endOf = (e: Brep['edges'][number]) => { const [u0, u1] = curveDomain(e.curve); return [evaluateCurve(e.curve, u0), evaluateCurve(e.curve, u1)]; };
        const edgesHere = body.edges.filter(e => !own.has(e.curve) && (e.curve === cl!.c.edge || endOf(e).some(q => ends.some(w => len(sub(q, w)) < 1e-6 * scaleMM))));
        for (const e of edgesHere) {
          const fs = (facesOfEdge.get(e.id) ?? []).map(id => byId.get(id)!);
          if (fs.length !== 2) continue;
          // (Compared where the two edges meet — or, the same edge, at the foot.)
          const q = e.curve === cl!.c.edge ? pts[0] : endOf(e).find(w => ends.some(z => len(sub(w, z)) < 1e-6 * scaleMM))!;
          for (const [f1, f2] of [[fs[0], fs[1]], [fs[1], fs[0]]]) {
            // (The face standing for the old F: the one whose normal there is the old F's.)
            const s1 = sheetOf(f1.surface as Surface, f1.sense), s2 = sheetOf(f2.surface as Surface, f2.sense);
            if (len(sub(normalOn(s1, ...invertOn(s1, q)), normalOn(cl!.c.F, ...invertOn(cl!.c.F, q)))) > 1e-6) continue;
            for (const S of list) for (const dx of [0, 0.01 * sp.length / m]) {
              // (Just past where the edges meet too: there the foot sits at the end of both, and neither holds it inside.)
              const at = dx ? spanAt(P, hd, x + dx, sp.lo, sp.hi) : { X, t };
              const bb = solveCliff(S.sheet, sigma, r, e.curve, at.X, at.t, invertOn(S.sheet, (b ?? cl!.last).pS), footOn(e.curve, (b ?? cl!.last).foot), scaleMM), c: Cliff = { side: cl!.c.side, S, edge: e.curve, F: s1, F2: s2, F2face: f2 };
              if (holds(c, bb)) return { c, ball: bb! };
            }
          }
        }
        return null;
      };
      const nx = nextCfg();
      if (nx) {
        let lo: number = cl.xLast, hi: number = x, keep: CliffBall = cl.last;
        for (let k = 0; k < 60; k++) {
          const mid = (lo + hi) / 2, at = spanAt(P, hd, mid, sp.lo, sp.hi), bm = solveCliff(cl.c.S.sheet, sigma, r, cl.c.edge, at.X, at.t, keep.uvS, keep.t, scaleMM);
          if (holds(cl.c, bm)) { lo = mid; keep = bm!; } else hi = mid;
        }
        parts.push({ kind: 'cliff', x0: cl.x0, x1: lo, lo: sp.lo, hi: sp.hi, rho: 0, length: lo - cl.x0, c: cl.c, first: cl.first, last: keep });
        // (The new span starts with the old one's last ball — where the edges meet, it is on both — on the new faces' terms.)
        const first: CliffBall = { ...keep, uvS: invertOn(nx.c.S.sheet, keep.pS), t: footOn(nx.c.edge, keep.foot) };
        cl = { c: nx.c, first, last: nx.ball, x0: lo, xLast: x };
        continue;
      }
      // (Back onto a face: where the edge ball leaves the wedge, by bisection; on from there on the faces, the one beyond
      // the edge among them.)
      let lo = cl.xLast, hi = x, keep = cl.last;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2, at = spanAt(P, hd, mid, sp.lo, sp.hi), bm = solveCliff(cl.c.S.sheet, sigma, r, cl.c.edge, at.X, at.t, keep.uvS, keep.t, scaleMM), fm = bm && edgeNormals(cl.c.F, cl.c.F2, bm.foot, [undefined, undefined]);
        if (bm && fm && withinWedge(bm.m, fm.n1, fm.n2, sigma, 0)) { lo = mid; keep = bm; } else hi = mid;
      }
      parts.push({ kind: 'cliff', x0: cl.x0, x1: lo, lo: sp.lo, hi: sp.hi, rho: 0, length: lo - cl.x0, c: cl.c, first: cl.first, last: keep });
      if (!Bs.some(sd => sd.face.id === cl!.c.F2face.id) && !As.some(sd => sd.face.id === cl!.c.F2face.id)) (cl.c.side === 'B' ? Bs : As).push(sideOf(body, cl.c.F2face, !closed, scaleMM));
      cur = { kind: 'edge', x0: lo, x1: sp.x1, lo: sp.lo, hi: sp.hi, rho: 0, length: sp.x1 - lo, extra: [...(sp.extra ?? []), cl.c.F2face] };
      const st0 = cornerStation(keep, cl.c.side, sigma, r, X, t);
      solver = solverOn(cur, { pA: st0.pA, pB: st0.pB }); cl = null;
      const got = solver.solve(x, undefined, beside(x));
      if (!got) throw leaves(X);
      face = { ...got, x };
    }
    const end = cl as { c: Cliff; first: CliffBall; last: CliffBall; x0: number; xLast: number } | null;
    if (end && closed && !R && end.x0 === sp.x0 && !parts.length) return [{ kind: 'cliff', x0: sp.x0, x1: sp.x1, lo: sp.lo, hi: sp.hi, rho: 0, length: sp.length, c: end.c, first: end.first, last: end.last }];
    if (end && closed && !R) { parts.push({ kind: 'cliff', x0: end.x0, x1: sp.x1, lo: sp.lo, hi: sp.hi, rho: 0, length: sp.x1 - end.x0, c: end.c, first: end.first, last: end.last }); return parts; }
    if (end) throw new BrepError('GEOMETRY', `CAPABILITY: [CONTACT_LEAVES_FACE] edge ${name}: the fillet of ${r} mm rolls along a sharp edge to the end of its run there; that is not supported yet`);
    if (!parts.length) return [sp];
    parts.push(cur);
    return parts;
  };
  // (A ring with no corner starting where its ball is off its faces — on a cliff — starts instead at the first place it
  // touches them.)
  if (!R && closed) {
    const sp = spans[0] as Extract<Span, { kind: 'edge' }>, { solve } = solverOn(sp, seedOf(0, 0));
    if (!solve(0, undefined, true)) {
      let found = false;
      for (let j = 1; j < 64 && !found; j++) { const x = L * j / 64; if (solve(x, undefined, true)) { sp.x0 = x; sp.x1 = x + L; found = true; } }
      // (Nowhere on them — wholly on a cliff: from off the chain's vertices, where the edge it rolls on may be in pieces.)
      if (!found) { sp.x0 = L / 128; sp.x1 = sp.x0 + L; }
    }
  }
  for (let si = 0; si < spans.length; si++) {
    const sp = spans[si]; if (sp.kind !== 'edge') continue;
    const parts = cliffsIn(sp, si); if (parts.length > 1) { spans.splice(si, 1, ...parts); si += parts.length - 1; }
  }
  let rho = 0; for (const sp of spans) { sp.rho = rho; rho += sp.length; }
  const total = rho;
  // 1. Along each edge span: on which faces the contacts fall, breaks where they cross from one face to the next (as
  //    the plain ring; past an open chain's end, also where a contact leaves its face). Round each corner: the shared
  //    face's contact stays on that face.
  const breaks: { rho: number; a: number; b: number; span: number }[] = [], firsts: { rho: number; st: Station }[] = [];
  const state = (f: { st: Station; a: number; b: number }) => `${f.a},${f.b},${strictlyInside(As[f.a], f.st.uvA)},${strictlyInside(Bs[f.b], f.st.uvB)}`;
  const key = (f: { st: Station; a: number; b: number }, x: number) => x < 0 || x > L ? state(f) : `${f.a},${f.b}`;
  for (const [si, sp] of spans.entries()) {
    if (sp.kind === 'corner') {
      const roll = rolls[sp.k];
      let prev: { uvS: XY; t: number } = roll.b0;
      for (let j = 0; j <= 8; j++) {
        const b = solveCorner(roll.S.sheet, sigma, r, roll.k.edge, roll.before, roll.next, j / 8, prev.uvS, prev.t, scaleMM);
        if (!b || !insideFace(roll.S, b.uvS)) throw leaves(b?.pS ?? path.at(Math.max(0, Math.min(L, roll.sV))).X);
        prev = b;
      }
      breaks.push({ rho: sp.rho, a: -1, b: -1, span: si });
      continue;
    }
    if (sp.kind === 'cliff') { breaks.push({ rho: sp.rho, a: -1, b: -1, span: si }); continue; }
    const { solve } = solverOn(sp, seedOf(si, sp.x0)), m = Math.max(8, 2 * Math.ceil(N0 * sp.length / total / 2)), first: { st: Station; a: number; b: number; x: number }[] = [];
    for (let j = 0; j <= m; j++) {
      const x = sp.x0 + sp.length * j / m, got = solve(x, first.at(-1), beside(x));
      if (!got) throw leaves(P(x));
      first.push({ ...got, x }); firsts.push({ rho: sp.rho + (x - sp.x0), st: got.st });
    }
    breaks.push({ rho: sp.rho, a: first[0].a, b: first[0].b, span: si });
    const inner: { rho: number; a: number; b: number; span: number }[] = [];
    for (let j = 0; j < m; j++) {
      const p = first[j], q = first[j + 1];
      if (key(p, p.x) === key(q, q.x)) continue;
      // (Past an end — either station beyond it — the state with where each contact lies (as R10.2b); else the faces.)
      const past = p.x < 0 || p.x > L || q.x < 0 || q.x > L, sp0 = state(p);
      let lo = p.x, hi = q.x;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2, { X, t } = spanAt(P, hd, mid, sp.lo, sp.hi), st = solveStation(As[p.a].sheet, sigma, Bs[p.b].sheet, sigma, r, X, t, p.st.uvA, p.st.uvB, scaleMM);
        if (st && (past ? state({ st, a: p.a, b: p.b }) === sp0 : strictlyInside(As[p.a], st.uvA) && strictlyInside(Bs[p.b], st.uvB))) lo = mid; else hi = mid;
      }
      inner.push({ rho: sp.rho + (hi - sp.x0), a: q.a, b: q.b, span: si });
    }
    // (An open chain run past an end: where the path turns from the edge to the run — a jump in its curvature — a break
    // too, unless within two steps of another, D90.)
    for (const x of [0, L]) if (!closed && x > sp.x0 && x < sp.x1 && !inner.some(b => Math.abs(b.rho - (sp.rho + x - sp.x0)) < 2 * h)) {
      const f = first.reduce((best, c) => Math.abs(c.x - x) < Math.abs(best.x - x) ? c : best);
      inner.push({ rho: sp.rho + (x - sp.x0), a: f.a, b: f.b, span: si });
    }
    inner.sort((a, b) => a.rho - b.rho);
    breaks.push(...inner);
  }
  // (Breaks at one place are one: the later's faces.)
  for (let k = breaks.length - 1; k > 0; k--) if (breaks[k].rho - breaks[k - 1].rho < 1e-6 * total && breaks[k].span === breaks[k - 1].span) { breaks[k - 1] = { ...breaks[k], rho: breaks[k - 1].rho }; breaks.splice(k, 1); }
  // 2. Stations evenly within each stretch between breaks, refined as the h⁴ rate predicts.
  const edgesRolled = [...rolls.map(x => x.k.edge), ...spans.flatMap(sp => sp.kind === 'cliff' ? [sp.c.edge] : [])];
  for (let N = fixedStations ?? N0, tries = 0; ; tries++) {
    if (N > 4096) throw new BrepError('GEOMETRY', `CAPABILITY: [APPROX_TOLERANCE_NOT_MET] edge ${name}: the fillet's lofted contacts stay over ${tolMM} mm off their faces (or its sections over ${4 * tolMM} mm off the true ones) at 4096 stations`);
    const sols: Station[] = [], cuts: number[] = [], grows: [Point | undefined, Point | undefined][] = [];
    for (let k = 0; k < breaks.length; k++) {
      const br = breaks[k], a0 = br.rho, a1 = k + 1 < breaks.length ? breaks[k + 1].rho : total, cnt = Math.max(4, 2 * Math.round(N * (a1 - a0) / total / 2)), sp = spans[br.span], last = !closed && k === breaks.length - 1;
      cuts.push(sols.length / 2);
      if (sp.kind === 'corner') {
        const roll = rolls[sp.k];
        let prev: { uvS: XY; t: number } = roll.b0;
        for (let j = 0; j < cnt; j++) {
          const b = solveCorner(roll.S.sheet, sigma, r, roll.k.edge, roll.before, roll.next, (a0 + (a1 - a0) * j / cnt - sp.rho) / sp.length, prev.uvS, prev.t, scaleMM);
          if (!b) throw unsupported('the ball does not roll round the edge all the way');
          sols.push(cornerStation(b, roll.k.side, sigma, r, b.foot, unit(curveTangent(roll.k.edge, b.t)))); prev = b;
          const w = slerpUnit(roll.w0, roll.w1, (a0 + (a1 - a0) * j / cnt - sp.rho) / sp.length);
          grows.push(roll.k.side === 'A' ? [w, undefined] : [undefined, w]);
        }
        continue;
      }
      if (sp.kind === 'cliff') {
        let prev: CliffBall = sp.first;
        for (let j = 0; j < cnt + (last ? 1 : 0); j++) {
          const x = sp.x0 + (a0 + (a1 - a0) * j / cnt - sp.rho), { X, t } = spanAt(P, hd, x, sp.lo, sp.hi);
          const b = j === 0 ? sp.first : solveCliff(sp.c.S.sheet, sigma, r, sp.c.edge, X, t, prev.uvS, prev.t, scaleMM);
          if (!b) throw leaves(X);
          sols.push(cornerStation(b, sp.c.side, sigma, r, X, t)); prev = b;
          const w = cliffWedge(sp.c, b.foot);
          grows.push(sp.c.side === 'A' ? [w, undefined] : [undefined, w]);
        }
        continue;
      }
      // (Beside a corner or a cliff, within 2r of the span's end, the contact's growth turns smoothly into its wedge.)
      const target = (nb: Span | null, atStart: boolean): { side: 'A' | 'B'; w: Point } | null => nb?.kind === 'corner' ? { side: rolls[nb.k].k.side, w: atStart ? rolls[nb.k].w0 : rolls[nb.k].w1 } : nb?.kind === 'cliff' ? { side: nb.c.side, w: cliffWedge(nb.c, atStart ? nb.first.foot : nb.last.foot) } : null;
      const tIn = target(neighbour(br.span, -1), false), tOut = target(neighbour(br.span, 1), true), blend = Math.min(2 * r, sp.length / 3);
      const A = As[br.a], B = Bs[br.b];
      for (let j = 0; j < cnt + (last ? 1 : 0); j++) {
        const x = sp.x0 + (a0 + (a1 - a0) * j / cnt - sp.rho), { X, t } = spanAt(P, hd, x, sp.lo, sp.hi), prev = sols.at(-1);
        // (A stretch's first station seeded afresh on its faces from the last contact — or, the chain's first, from the
        // first pass's nearest.)
        const near = prev ?? firsts.reduce((best, c) => Math.abs(c.rho - a0) < Math.abs(best.rho - a0) ? c : best).st;
        const seedA = j ? invertOn(A.sheet, near.pA, near.uvA) : invertOn(A.sheet, near.pA), seedB = j ? invertOn(B.sheet, near.pB, near.uvB) : invertOn(B.sheet, near.pB);
        const st = solveStation(A.sheet, sigma, B.sheet, sigma, r, X, t, seedA, seedB, scaleMM);
        if (!st || !contactOk(A, st.uvA, st.pA, beside(x)) || !contactOk(B, st.uvB, st.pB, beside(x))) throw leaves(X);
        sols.push(st);
        const grow: [Point | undefined, Point | undefined] = [undefined, undefined];
        for (const [tg, d] of [[tIn, x - sp.x0], [tOut, sp.x1 - x]] as const) if (tg && d < blend) {
          const kk = tg.side === 'A' ? 0 : 1, own = scale(kk ? st.nB : st.nA, -sigma), w = smooth(1 - d / blend);
          grow[kk] = unit(add(scale(grow[kk] ?? own, 1 - w), scale(tg.w, w)));
        }
        grows.push(grow);
      }
    }
    // (A contact at a corner's first or last foot, to rounding, is that foot: where the shared face is a plane square
    // to the edge the feet are one point — a horn torus's apex — which every face there must share exactly.)
    const feet = rolls.flatMap(x => [x.b0.foot, x.b1.foot]), snapTo = (q: Point) => feet.find(f => len(sub(f, q)) <= 1e-9 * scaleMM) ?? q;
    for (let i = 0; i < sols.length; i++) { const st = sols[i]; sols[i] = { ...st, pA: snapTo(st.pA), pB: snapTo(st.pB) }; }
    const sections = sols.map((st, i) => sectionOf(st, sigma, sigma, r, g, grows[i][0], grows[i][1]));
    if (sections.some(x => !x)) throw new BrepError('GEOMETRY', `SELECTION: [TANGENT_FACES] edge ${name}: the fillet's section degenerates (its faces nearly tangent)`);
    cornerTrace?.({ sols, cuts, spans, breaks });
    const { brep, report, contactFaces } = loftTool(sections as Section[], id, cuts, closed);
    const { contact, turn } = contactsOf(brep, id, As, Bs, edgesRolled);
    ringTrace?.({ stations: sols.length, patches: report.patches, contactMM: contact, sectionMM: report.maxDeviationMM });
    let ball = 0; for (const st of sols) ball = Math.max(ball, Math.abs(len(sub(st.c, st.pA)) - r), Math.abs(len(sub(st.c, st.pB)) - r));
    // (Done when the contacts lie within tolMM of their faces and the fillet within 4 tolMM of the true sections — on
    // planes the contacts are exact at any count, and the sections round a corner, R10.3a, then set it.)
    const worst = Math.max(contact / tolMM, report.maxDeviationMM / (4 * tolMM));
    if (worst <= 1 || fixedStations) return { brep, contactFaces, sides: [...As, ...Bs].map(sd => sd.face.name ?? sd.face.id), report: { edges: input.names, stations: sols.length, patches: report.patches, contact: contact, section: report.maxDeviationMM, ball: ball, normal: turn * 180 / Math.PI } };
    if (tries >= 6) N = 8192;
    else N = 2 * Math.ceil(N * Math.max(tries ? 1.25 : 2, 1.15 * worst ** 0.25) / 2);
  }
}
