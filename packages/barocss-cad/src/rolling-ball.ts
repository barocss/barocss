// R10.2 (D89): the rolling ball between any two faces, and the fillet tool lofted from it. At stations along an edge
// chain the ball of radius r touching both faces is solved (its centre c = S_A + σ_A r n_A = S_B + σ_B r n_B, in the plane
// through the station square to the chain: four equations in the contacts' (u, v), by Newton); each station's section
// — the contacts, the faces' lines grown g outside the corner, their corner and the fillet arc — lies in the ball's
// plane through both contacts. The tool is lofted through the sections: cubic Hermite along the chain (tangents by a
// five-point stencil, so O(h⁴)), the arc rational quadratic in homogeneous coordinates, in patches within the 16-pole
// limit; its deviation from the true rolling-ball sections is measured at the stations between those it passes through.
import { BrepError, buildBrep, type Brep } from './brep-core.js';
import { faceGeometry } from './analytic-boolean.js';
import { basis, curveDomain, evaluateCurve, surfaceDomain, surfaceEvaluator } from './math.js';
import { add, cross, dot, len, scale, sub, unit } from './vec3.js';
import type { Curve, Point, Surface } from './types.js';

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
  const hs = [A.hu, A.hv, B.hu, B.hv].map(h => 10 * h), tol = 1e-12 * size;
  for (let it = 0; it < 40 && norm(f) > tol; it++) {
    const J = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
    for (let k = 0; k < 4; k++) {
      // (Clamped to the domains: at an edge the difference is one-sided, over the step actually taken.)
      const qp = clampQ(A, B, q.map((x, i) => i === k ? x + hs[k] : x)), qm = clampQ(A, B, q.map((x, i) => i === k ? x - hs[k] : x));
      const fp = residual(A, sA, B, sB, r, X, t, qp), fm = residual(A, sA, B, sB, r, X, t, qm);
      for (let i = 0; i < 4; i++) J[i][k] = (fp[i] - fm[i]) / (qp[k] - qm[k]);
    }
    const step = solve4(J, f.map(x => -x));
    if (!step) return null;
    // Damped: halve the step until the residual falls.
    let lambda = 1, next = q, fn = f;
    for (let k = 0; k < 20; k++) {
      next = clampQ(A, B, q.map((x, i) => x + lambda * step[i]));
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
export interface Section { readonly corners: Point[]; readonly mid: Point; readonly w: number; readonly c: Point }
/** The section of a station, grown g outside the corner (σ as for the ball); null when it is degenerate. */
export function sectionOf(st: Station, sA: number, sB: number, r: number, g: number): Section | null {
  const T1 = st.pA, T2 = st.pB, c = st.c, a = sub(T1, c), b = sub(T2, c), m = cross(a, b);
  if (!(len(m) > 1e-12 * r * r)) return null;
  const mz = unit(m), T1o = sub(T1, scale(st.nA, sA * g)), T2o = sub(T2, scale(st.nB, sB * g));
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
  const mid = add(c, scale(unit(add(a, b)), r / w));
  return { corners: [T1, T1o, O, T2o, T2], mid, w, c };
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
  const nb = closed ? patches : patches + 1, bi = (b: number) => closed ? b % patches : b, vid = (k: number, b: number) => `v${k}_${bi(b)}`;
  for (let b = 0; b < nb; b++) for (let k = 0; k < 5; k++) vertices.push({ id: vid(k, b), point: rows[k][bounds[b] % n] as Point });
  // Section edges at each bound: lines between corners k and k+1 (k < 4), the arc from corner 4 (T2) to 0 (T1).
  for (let b = 0; b < nb; b++) {
    const sc = used[bounds[b] % n];
    for (let k = 0; k < 4; k++) edges.push({ id: `s${k}_${b}`, curve: { kind: 'curve', id: `s${k}_${b}`, degree: 1, knots: [0, 0, 1, 1], controlPoints: [sc.corners[k], sc.corners[k + 1]], weights: [1, 1] }, vertices: [vid(k, b), vid(k + 1, b)] });
    edges.push({ id: `s4_${b}`, curve: { kind: 'curve', id: `s4_${b}`, degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: [sc.corners[4], sc.mid, sc.corners[0]], weights: [1, sc.w, 1] }, vertices: [vid(4, b), vid(0, b)] });
  }
  for (let p = 0; p < patches; p++) {
    const i0 = bounds[p], i1 = bounds[p + 1], spans = i1 - i0, knots = splineKnots(spans);
    const [sa, sb] = segOf(p), ends = (vals: number[][]) => { const d: number[][] = []; d[i0 % n] = segmentDerivative(vals, i0, sa, sb, closed).slice(); d[i1 % n] = segmentDerivative(vals, i1, sa, sb, closed).slice(); return d; };
    const along = [0, 1, 2, 3, 4].map(k => splinePoles(rows[k], ends(rows[k]), i0, i1) as Point[]);
    for (let k = 0; k < 5; k++) edges.push({ id: `a${k}_${p}`, curve: { kind: 'curve', id: `a${k}_${p}`, degree: 3, knots, controlPoints: along[k], weights: along[k].map(() => 1) }, vertices: [vid(k, p), vid(k, p + 1)] });
    const hm = splinePoles(mid, ends(mid), i0, i1), midPoles = hm.map(h => [h[0] / h[3], h[1] / h[3], h[2] / h[3]] as Point), midW = hm.map(h => h[3]);
    for (let k = 0; k < 5; k++) {
      // Face k: corner k to corner k+1 across (the fillet: corner 4 → mid → corner 0), along the patch.
      const fillet = k === 4, next = (k + 1) % 5;
      const cps = fillet ? [along[4], midPoles, along[0]] : [along[k], along[next]], wts = fillet ? [along[4].map(() => 1), midW, along[0].map(() => 1)] : [along[k].map(() => 1), along[next].map(() => 1)];
      const surface: Surface = { kind: 'surface', id: `f${k}_${p}`, degreeU: fillet ? 2 : 1, degreeV: 3, knotsU: fillet ? [0, 0, 0, 1, 1, 1] : [0, 0, 1, 1], knotsV: knots, controlPoints: cps, weights: wts };
      // Its loop: along corner k, the section edge at the patch's end, back along corner k+1, the section edge at its
      // start — clockwise in (u, v), so about −(Su × Sv). Facing out along +(Su × Sv) (away from the section's middle),
      // the loop is turned and the face kept forward; otherwise the face is reversed.
      const uses = [{ edge: `a${k}_${p}`, sense: 'forward' as const }, { edge: `s${k}_${closed ? (p + 1) % patches : p + 1}`, sense: 'forward' as const }, { edge: `a${next}_${p}`, sense: 'reversed' as const }, { edge: `s${k}_${p}`, sense: 'reversed' as const }];
      const out = facesOut(surface, used[(i0 + Math.floor(spans / 2)) % n]);
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
  // The deviation: each true section at the in-between stations against the lofted surfaces — the distance of its
  // contacts, grown points, corner and arc middle to the nearest point of the face they should lie on.
  let dev = 0;
  for (let i = 0; i < between.length; i++) {
    const sc = between[i], ii = closed && i < bounds[0] ? i + n : i, p = bounds.findIndex((x, q) => q < patches && ii >= x && ii < bounds[q + 1]);
    if (p < 0) continue;
    const v = (ii - bounds[p] + 0.5) / (bounds[p + 1] - bounds[p]), fillet = faces[p * 5 + 4].surface, side = faces[p * 5 + 1].surface;
    for (const [S, x, u] of [[fillet, sc.corners[4], 0], [fillet, sc.corners[0], 1], [fillet, arcMiddle(sc), 0.5], [side, sc.corners[1], 0], [side, sc.corners[2], 1]] as [Surface, Point, number][])
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
/** A plane patch through a section, Su × Sv along n, covering it (and its arc) with room. */
function planePatch(s: Section, nrm: Point): Surface {
  const n = unit(nrm), o = s.c, d = sub(s.corners[0], o), e1 = unit(sub(d, scale(n, dot(d, n)))), e2 = cross(n, e1), pts = [...s.corners, s.mid];
  const reach = 2 * Math.max(...pts.map(p => len(sub(p, o)))) + 1, at = (u: number, v: number): Point => add(o, add(scale(e1, u), scale(e2, v)));
  return { kind: 'surface', id: 'cap', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[at(-reach, -reach), at(-reach, reach)], [at(reach, -reach), at(reach, reach)]], weights: [[1, 1], [1, 1]] };
}
/** The closed tool of a ring (loftTool, closed). */
export function ringTool(sections: readonly Section[], id: string, breaks: readonly number[] = [0]): { brep: Brep; report: LoftReport; contactFaces: string[] } { return loftTool(sections, id, breaks, true); }

/** The true arc's middle: r from the ball's centre towards the middle pole. */
function arcMiddle(s: Section): Point {
  const r = len(sub(s.corners[0], s.c));
  return add(s.c, scale(unit(sub(s.mid, s.c)), r));
}
/** How far x lies from the surface: Gauss–Newton from (u, v). */
function distanceTo(s: Sheet, x: Point, start: XY): number { const uv = invertOn(s, x, start); return len(sub(pointOn(s, ...uv), x)); }

/** Whether a tool face's Su × Sv at its middle points away from the middle of a section near it. */
function facesOut(S: Surface, near: Section): boolean {
  const at = surfaceEvaluator(S), u0 = S.knotsU[S.degreeU], u1 = S.knotsU[S.controlPoints.length], v0 = S.knotsV[S.degreeV], v1 = S.knotsV[S.controlPoints[0].length];
  const um = (u0 + u1) / 2, vm = (v0 + v1) / 2, h = 1e-6, p0 = at(um, vm), n = cross(sub(at(um + h, vm), at(um - h, vm)), sub(at(um, vm + h), at(um, vm - h)));
  const cen = scale(near.corners.reduce((x, y) => add(x, y), [0, 0, 0] as Point), 1 / 5);
  return dot(n, sub(p0, cen)) > 0;
}

/** A closed chain of edge curves by length: its point and unit tangent at s in [0, length). */
export interface ChainPath { readonly length: number; at(s: number): { X: Point; t: Point } }
export function chainPath(curves: readonly { curve: Curve; reversed: boolean }[], closed = true): ChainPath {
  // (A table of lengths by parameter, 2000 a curve; a point is the curve's own at the interpolated parameter.)
  const K = 2000, rows: { s: number; k: number; t: number }[] = [];
  let s = 0;
  for (const [k, c] of curves.entries()) {
    const [t0, t1] = curveDomain(c.curve), par = (i: number) => c.reversed ? t1 - (t1 - t0) * i / K : t0 + (t1 - t0) * i / K;
    let prev = evaluateCurve(c.curve, par(0));
    for (let i = 0; i < K; i++) { rows.push({ s, k, t: par(i) }); const p = evaluateCurve(c.curve, par(i + 1)); s += len(sub(p, prev)); prev = p; }
  }
  const total = s, ends = curves.map(c => { const [t0, t1] = curveDomain(c.curve); return c.reversed ? t0 : t1; });
  const lastPoint = evaluateCurve(curves[curves.length - 1].curve, ends[ends.length - 1]);
  const pointAt = (x: number): Point => {
    // (An open chain's end is its last curve's own end point, exactly: a cap there lies in the end face's plane.)
    if (!closed && x >= total) return lastPoint;
    const y = ((x % total) + total) % total;
    let lo = 0, hi = rows.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rows[m].s <= y) lo = m; else hi = m; }
    const a = rows[lo], b = rows[lo + 1] && rows[lo + 1].k === a.k ? rows[lo + 1] : { s: lo + 1 < rows.length ? rows[lo + 1].s : total, k: a.k, t: ends[a.k] };
    const f = b.s > a.s ? (y - a.s) / (b.s - a.s) : 0;
    return evaluateCurve(curves[a.k].curve, a.t + (b.t - a.t) * f);
  };
  const h = 1e-6 * total;
  if (closed) return { length: total, at: x => ({ X: pointAt(x), t: unit(sub(pointAt(x + h), pointAt(x - h))) }) };
  // Open: one-sided at the ends, and on past them along the end tangents (where a tool runs past the body's end).
  const t0 = unit(sub(pointAt(h), pointAt(0))), t1 = unit(sub(lastPoint, pointAt(total - h))), P0 = pointAt(0), P1 = lastPoint;
  return { length: total, at: x => x <= 0 ? { X: x === 0 ? P0 : add(P0, scale(t0, x)), t: t0 } : x >= total ? { X: x === total ? P1 : add(P1, scale(t1, x - total)), t: t1 } : { X: pointAt(x), t: unit(sub(pointAt(Math.min(total, x + h)), pointAt(Math.max(0, x - h)))) } };
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
  readonly contactMM: number; readonly normalDeg: number;
  /** The lofted sections against the true ones (at the stations between), and the solved balls' |c − p| − r. */
  readonly sectionMM: number; readonly ballMM: number;
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
/** Solves a station on any pair of the sides' faces (the last pair first), its contacts inside the faces they lie on. */
function stationOn(As: Side[], Bs: Side[], last: [number, number], sigma: number, r: number, X: Point, t: Point, gA: Point, gB: Point, hintA: XY | undefined, hintB: XY | undefined, size: number, check = true): { st: Station; a: number; b: number } | null {
  for (let i = 0; i < As.length; i++) for (let j = 0; j < Bs.length; j++) {
    const a = (last[0] + i) % As.length, b = (last[1] + j) % Bs.length, A = As[a], B = Bs[b];
    const st = solveStation(A.sheet, sigma, B.sheet, sigma, r, X, t, invertOn(A.sheet, gA, i === 0 ? hintA : undefined), invertOn(B.sheet, gB, j === 0 ? hintB : undefined), size);
    if (st && (!check || (insideFace(A, st.uvA) && insideFace(B, st.uvB)))) return { st, a, b };
  }
  return null;
}
/**
 * The fillet tool of a chain between the faces on its two sides: stations from about one per r/4 of its length, refined
 * until the lofted contacts lie within `tolMM` of their faces (refused past 4096), each solved on the face it falls on
 * (refused when it falls off them all: the fillet would run off its faces). A closed chain makes a ring; an open one a
 * capped tool, run on past an end by `past` (the body ends there: the Boolean trims it) or stopped at it.
 */
export function ringFillet(body: Brep, input: { readonly loop: readonly { curve: Curve; reversed: boolean }[]; readonly names: readonly string[]; readonly sideA: readonly Face[]; readonly sideB: readonly Face[]; readonly start: { wA: Point; wB: Point }; readonly convex: boolean; readonly r: number; readonly id: string; readonly scaleMM: number; readonly tolMM: number; readonly closed?: boolean; readonly past?: readonly (EndPlane | null)[] }): { brep: Brep; report: FilletReport; contactFaces: string[] } {
  const { r, id, scaleMM, tolMM } = input, closed = input.closed !== false, sigma = input.convex ? -1 : 1, name = input.names[0];
  const As = input.sideA.map(f => sideOf(body, f, !closed, scaleMM)), Bs = input.sideB.map(f => sideOf(body, f, !closed, scaleMM));
  const alpha = Math.acos(Math.max(-1, Math.min(1, dot(input.start.wA, input.start.wB))));
  if (alpha > Math.PI - 1e-6) throw new BrepError('GEOMETRY', `SELECTION: [TANGENT_FACES] edge ${name}: its faces meet tangentially; there is no corner to finish`);
  const back = r / Math.tan(alpha / 2), path = chainPath(input.loop, closed), L = path.length;
  // Past an end the chain goes on along the faces' own junction (their extended surfaces), marched a step at a time:
  // a straight run would leave it where it bends (an ellipse's tip) and the tool would miss the corner there.
  const ext: { s: number; X: Point; t: Point }[][] = [[], []];
  const at = (x: number): { X: Point; t: Point } => {
    if (closed || (x >= 0 && x <= L)) return path.at(x);
    const k = x > L ? 1 : 0, list = ext[k], from = k ? { s: L, ...path.at(L) } : { s: 0, ...path.at(0) }, d = Math.abs(x - from.s);
    let a = from;
    for (const b of list) {
      const db = Math.abs(b.s - from.s);
      if (db >= d) { const span = db - Math.abs(a.s - from.s), u = span > 0 ? (d - Math.abs(a.s - from.s)) / span : 0, sg = k ? 1 : -1; return hermiteStation(a, b, u, span * sg); }
      a = b;
    }
    return { X: add(a.X, scale(a.t, x - a.s)), t: a.t };
  };
  const leaves = (x: number) => new BrepError('INPUT', `PARAMETER: [CONTACT_LEAVES_FACE] edge ${name}: a fillet of ${r} mm runs off its faces near (${at(x).X.map(q => +q.toFixed(3)).join(', ')}); rolling over the next face arrives with R10.4`);
  // 1. Along the chain: on which faces the contacts fall, and where they cross from one face to the next — found by
  //    bisection to rounding, so the tool's patches break there with the contacts on the seam. An open chain run past
  //    an end goes on, a step at a time, until the section there lies beyond that end's plane (the body ends there; the
  //    Boolean trims the tool), refused where the ball no longer touches both faces first.
  const g = 0.5 * r, N0 = Math.max(64, 2 * Math.ceil(L / (r / 4) / 2)), h = L / N0, first: { st: Station; a: number; b: number; s: number }[] = [];
  const solveAt = (x: number, prev: { st: Station; a: number; b: number } | undefined, check: boolean) => {
    const { X, t } = at(x);
    return stationOn(As, Bs, prev ? [prev.a, prev.b] : [0, 0], sigma, r, X, t, prev ? prev.st.pA : add(X, scale(input.start.wA, back)), prev ? prev.st.pB : add(X, scale(input.start.wB, back)), prev?.st.uvA, prev?.st.uvB, scaleMM, check);
  };
  // (Within reach of an end run past, a contact may run off its face across that end: it is not checked there.)
  const reach = back + 2 * g, beside = (x: number) => closed || (x >= (input.past?.[0] ? reach : 0) && x <= L - (input.past?.[1] ? reach : 0));
  for (let j = 0; j < (closed ? N0 : N0 + 1); j++) {
    const x = L * j / N0, got = solveAt(x, first.at(-1), beside(x));
    if (!got) throw leaves(x);
    first.push({ ...got, s: x });
  }
  let s0 = 0, s1 = L;
  if (!closed) for (const [k, plane] of (input.past ?? []).entries()) if (plane) {
    // (The plane's side away from the chain: past it the section is clear of the body.)
    const away = dot(plane.n, sub(path.at(L / 2).X, plane.o)) < 0 ? plane.n : scale(plane.n, -1), clear = (sec: Section) => [...sec.corners, sec.mid].every(p => dot(sub(p, plane.o), away) > 1e-9 * scaleMM);
    for (let step = 1; ; step++) {
      if (step > 4 * N0) throw leaves(k ? L : 0);
      const x = k ? L + step * h : -step * h, prev = k ? first.at(-1)! : first[0], last = ext[k].at(-1) ?? { s: k ? L : 0, ...path.at(k ? L : 0) };
      // The junction's next point: where the two faces meet in the plane a step on (a ball of radius 0).
      // (On whichever of the sides' faces it falls: the junction can lie on another half than the ball's contact.)
      const sgn = k ? 1 : -1, guess = add(last.X, scale(last.t, sgn * h));
      let j0: Station | null = null;
      for (const A of As) { for (const B of Bs) { j0 = solveStation(A.sheet, 1, B.sheet, 1, 0, guess, last.t, invertOn(A.sheet, guess), invertOn(B.sheet, guess), scaleMM); if (j0) break; } if (j0) break; }
      const tj = j0 && unit(cross(j0.nA, j0.nB)), t1 = tj && (dot(tj, last.t) < 0 ? scale(tj, -1) : tj);
      if (j0 && t1) ext[k].push({ s: x, X: j0.c, t: t1 });
      const got = j0 && solveAt(x, prev, false), sec = got && sectionOf(got.st, sigma, sigma, r, g);
      if (!got || !sec) throw new BrepError('INPUT', `PARAMETER: [CONTACT_LEAVES_FACE] edge ${name}: past its end the fillet's faces part before its section clears the body's end (near ${at(x).X.map(q => +q.toFixed(3)).join(', ')}); ending it there arrives with R10.4`);
      if (k) first.push({ ...got, s: x }); else first.unshift({ ...got, s: x });
      if (clear(sec)) { if (k) s1 = x; else s0 = x; break; }
    }
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
      const m = (lo + hi) / 2, { X, t } = at(m), st = solveStation(As[p.a].sheet, sigma, Bs[p.b].sheet, sigma, r, X, t, p.st.uvA, p.st.uvB, scaleMM);
      if (st && (closed ? strictlyInside(As[p.a], st.uvA) && strictlyInside(Bs[p.b], st.uvB) : state({ st, a: p.a, b: p.b }) === key)) lo = m; else hi = m;
    }
    breaks.push({ s: hi, a: q.a, b: q.b });
  }
  // (An open chain's first stretch starts at its start, on the first station's faces; where it runs past an end, the
  // path turns from the edge to a straight run there — a jump in its curvature: a break too.)
  if (!closed) {
    // (Not within two steps of another break: a stretch that short would be a sliver patch; the jump then sits in a
    // patch, where refinement takes it.)
    for (const [x, on] of [[0, input.past?.[0]], [L, input.past?.[1]]] as const) if (on && !breaks.some(b => Math.abs(b.s - x) < 2 * h)) {
      const f = first.reduce((best, c) => Math.abs(c.s - x) < Math.abs(best.s - x) ? c : best);
      breaks.push({ s: x, a: f.a, b: f.b });
    }
    breaks.sort((p, q) => p.s - q.s);
    breaks.unshift({ s: s0, a: first[0].a, b: first[0].b });
  }
  if (!breaks.length) breaks.push({ s: 0, a: first[0].a, b: first[0].b });
  // (Breaks at one place — both contacts leaving their faces where a chain ends square — are one: the later's faces.)
  for (let k = breaks.length - 1; k > 0; k--) if (breaks[k].s - breaks[k - 1].s < 1e-6 * L) { breaks[k - 1] = { ...breaks[k], s: breaks[k - 1].s }; breaks.splice(k, 1); }
  // 2. Stations evenly within each stretch between breaks (an even count, about N in all by length; an open chain ends
  //    with one more at its end), each solved on its stretch's faces; refined as the h⁴ rate predicts.
  for (let N = fixedStations ?? N0, tries = 0; ; tries++) {
    if (N > 4096) throw new BrepError('GEOMETRY', `CAPABILITY: [APPROX_TOLERANCE_NOT_MET] edge ${name}: the fillet's lofted contacts stay over ${tolMM} mm off their faces at 4096 stations`);
    const sols: Station[] = [], cuts: number[] = [];
    for (let k = 0; k < breaks.length; k++) {
      const a0 = breaks[k].s, a1 = k + 1 < breaks.length ? breaks[k + 1].s : closed ? breaks[0].s + L : s1, n = Math.max(4, 2 * Math.round(N * (a1 - a0) / span / 2));
      const A = As[breaks[k].a], B = Bs[breaks[k].b], last = !closed && k === breaks.length - 1;
      cuts.push(sols.length / 2);
      for (let j = 0; j < n + (last ? 1 : 0); j++) {
        const x = a0 + (a1 - a0) * j / n, { X, t } = at(x), prev = sols.at(-1);
        // (Seeded by the last station in the stretch; its first by the previous contact, inverted afresh on this face —
        // the last one's (u, v) belong to the face across the seam.)
        const near = prev ?? first.reduce((best, c) => Math.abs(c.s - x) < Math.abs(best.s - x) ? c : best).st, seedA = j ? invertOn(A.sheet, near.pA, near.uvA) : invertOn(A.sheet, near.pA), seedB = j ? invertOn(B.sheet, near.pB, near.uvB) : invertOn(B.sheet, near.pB);
        const st = solveStation(A.sheet, sigma, B.sheet, sigma, r, X, t, seedA, seedB, scaleMM);
        if (!st || (beside(x) && (!insideFace(A, st.uvA) || !insideFace(B, st.uvB)))) throw leaves(x);
        sols.push(st);
      }
    }
    const sections = sols.map(st => sectionOf(st, sigma, sigma, r, g));
    if (sections.some(x => !x)) throw new BrepError('GEOMETRY', `SELECTION: [TANGENT_FACES] edge ${name}: the fillet's section degenerates (its faces nearly tangent)`);
    const { brep, report, contactFaces } = loftTool(sections as Section[], id, cuts, closed);
    // The lofted contacts against their faces, halfway between lofted stations: the distance to the nearest face, and
    // the angle between the fillet's normal and that face's there (G1 to within it).
    let contact = 0, turn = 0;
    for (const f of brep.faces) if (f.name === `${id}.face`) {
      const sheet = sheetOf(f.surface as Surface, 'forward'), spans = (f.surface as Surface).controlPoints[0].length - 3;
      for (let k = 0; k < spans; k++) for (const [u, sides] of [[0, Bs], [1, As]] as [number, Side[]][]) {
        const v = (k + 0.5) / spans, x = pointOn(sheet, u, v), near = sides.map(sd => { const q = invertOn(sd.sheet, x); return { d: len(sub(pointOn(sd.sheet, ...q), x)), n: normalOn(sd.sheet, ...q) }; }).sort((a, b) => a.d - b.d)[0];
        contact = Math.max(contact, near.d);
        turn = Math.max(turn, Math.acos(Math.min(1, Math.abs(dot(normalOn(sheet, u, v), near.n)))));
      }
    }
    ringTrace?.({ stations: sols.length, patches: report.patches, contactMM: contact, sectionMM: report.maxDeviationMM });
    let ball = 0; for (const st of sols) ball = Math.max(ball, Math.abs(len(sub(st.c, st.pA)) - r), Math.abs(len(sub(st.c, st.pB)) - r));
    if (contact <= tolMM || fixedStations) return { brep, contactFaces, report: { edges: input.names, stations: sols.length, patches: report.patches, contactMM: contact, sectionMM: report.maxDeviationMM, ballMM: ball, normalDeg: turn * 180 / Math.PI } };
    if (tries >= 6) N = 8192;
    else N = 2 * Math.ceil(N * Math.max(tries ? 1.25 : 2, 1.15 * (contact / tolMM) ** 0.25) / 2);
  }
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
