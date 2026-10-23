// K7b (D147): plain B-spline fitting (The NURBS Book, ch. 9 and A5.8) — moved down from the studio's direct geometry
// (`engine/fit.ts`), where it fills, extends, refits and simplifies curves and surfaces. Global interpolation with
// chord-length parameters and averaged knots, for any number of points; least-squares approximation with fewer poles,
// its ends kept; the surface through a grid as the tensor of curve interpolations; one interior knot removed within a
// tolerance. Non-rational results (all weights 1), but knot removal keeps a rational curve's weights.
//
// UNCERTIFIED: these produce no report and no certificate — no basis matrix, pivots or through-point observations, no
// bounds on size or count beyond what the arithmetic needs. Documents that need those take the certified path,
// `buildInterpolatingCurve` / `buildInterpolatingSurface`, which these equal to rounding where both apply (D146).
import { dist } from './vec3.js';

export type PlainPoint = [number, number, number];
export interface PlainFitCurve { degree: number; knots: number[]; points: PlainPoint[]; weights: number[] }
export interface PlainFitSurface { degreeU: number; degreeV: number; knotsU: number[]; knotsV: number[]; points: PlainPoint[][]; weights: number[][] }

/** The B-spline basis functions N_{span−p..span, p}(u) (Cox–de Boor). */
export function plainBasis(span: number, u: number, p: number, U: readonly number[]): number[] {
  const N = [1], left: number[] = [], right: number[] = [];
  for (let j = 1; j <= p; j++) {
    left[j] = u - U[span + 1 - j]; right[j] = U[span + j] - u;
    let saved = 0;
    for (let r = 0; r < j; r++) { const d = right[r + 1] + left[j - r], t = d === 0 ? 0 : N[r] / d; N[r] = saved + right[r + 1] * t; saved = left[j - r] * t; }
    N[j] = saved;
  }
  return N;
}
/** The knot span holding u (n + 1 poles, degree p). */
export function plainFindSpan(n: number, p: number, u: number, U: readonly number[]): number {
  if (u >= U[n + 1]) return n;
  if (u <= U[p]) return p;
  let lo = p, hi = n + 1, mid = (lo + hi) >> 1;
  while (u < U[mid] || u >= U[mid + 1]) { if (u < U[mid]) hi = mid; else lo = mid; mid = (lo + hi) >> 1; }
  return mid;
}
/** Chord-length parameters of points in [0, 1] (equal spacing when they all coincide). */
export function chordParameters(points: readonly (readonly number[])[]): number[] {
  const d: number[] = []; for (let k = 1; k < points.length; k++) d.push(dist(points[k], points[k - 1]));
  let total = 0; for (const x of d) total += x;
  if (!(total > 0)) return points.map((_, k) => k / (points.length - 1));
  const out = [0]; let s = 0; for (const x of d) { s += x; out.push(s / total); }
  out[out.length - 1] = 1; return out;
}
/** Knots by averaging the parameters (clamped, degree p). */
export function averagedKnots(params: readonly number[], p: number): number[] {
  const n = params.length - 1, U = Array(p + 1).fill(0);
  for (let j = 1; j <= n - p; j++) { let s = 0; for (let i = j; i < j + p; i++) s += params[i]; U.push(s / p); }
  return [...U, ...Array(p + 1).fill(1)];
}
/** Solves A x = b for each column of b (Gaussian elimination with partial pivoting); refused when a pivot vanishes. */
function solve(A: number[][], B: number[][]): number[][] {
  const n = A.length, M = A.map((r, i) => [...r, ...B[i]]), w = B[0].length;
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-14) throw new RangeError('the points cannot be fitted (they repeat or line up badly)');
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / M[c][c]; if (f) for (let k = c; k < n + w; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r.slice(n).map(x => x / M[i][i]));
}
/** One row of the collocation matrix: the n + 1 basis functions of degree p at u. */
function basisRow(n: number, p: number, U: readonly number[], u: number): number[] {
  const row = Array(n + 1).fill(0), s = plainFindSpan(n, p, u, U), N = plainBasis(s, u, p, U);
  for (let k = 0; k <= p; k++) row[s - p + k] = N[k];
  return row;
}

/** The curve of degree p (lowered to n for n + 1 points) through every point, at the given parameters, else chord-length ones. */
export function interpolateCurvePlain(points: readonly PlainPoint[], p = 3, params?: readonly number[], knots?: readonly number[]): PlainFitCurve {
  const n = points.length - 1, deg = Math.min(p, n);
  if (n < 1) throw new RangeError('a curve needs two or more points');
  const t = params ?? chordParameters(points), U = knots ? [...knots] : averagedKnots(t, deg);
  const A = t.map(u => basisRow(n, deg, U, u));
  const P = solve(A, points.map(q => [...q])) as PlainPoint[];
  return { degree: deg, knots: U, points: P, weights: P.map(() => 1) };
}

/**
 * The curve of degree p with `count` poles nearest (least squares) to the points, its ends on the first and last point
 * (The NURBS Book A9.7); fewer poles than points smooth them; as many is the interpolation.
 */
export function approximateCurvePlain(points: readonly PlainPoint[], count: number, p = 3): PlainFitCurve {
  const m = points.length - 1, n = count - 1, deg = Math.min(p, n);
  if (count < deg + 1 || count > points.length) throw new RangeError(`a fit needs ${deg + 1} to ${points.length} poles`);
  if (count === points.length) return interpolateCurvePlain(points, p);
  const t = chordParameters(points), d = (m + 1) / (n - deg + 1), U = Array(deg + 1).fill(0);
  for (let j = 1; j <= n - deg; j++) { const i = Math.floor(j * d), a = j * d - i; U.push((1 - a) * t[i - 1] + a * t[i]); }
  U.push(...Array(deg + 1).fill(1));
  const rows: number[][] = [], R: number[][] = [], Q0 = points[0], Qm = points[m];
  for (let k = 1; k < m; k++) { const r = basisRow(n, deg, U, t[k]); rows.push(r); R.push([points[k][0] - r[0] * Q0[0] - r[n] * Qm[0], points[k][1] - r[0] * Q0[1] - r[n] * Qm[1], points[k][2] - r[0] * Q0[2] - r[n] * Qm[2]]); }
  // Normal equations for the inner poles 1 … n − 1.
  const inner = n - 1, NtN = Array.from({ length: inner }, () => Array(inner).fill(0)), NtR = Array.from({ length: inner }, () => [0, 0, 0]);
  for (let k = 0; k < rows.length; k++) { const r = rows[k]; for (let i = 0; i < inner; i++) { const a = r[i + 1]; if (!a) continue; for (let j = 0; j < inner; j++) NtN[i][j] += a * r[j + 1]; for (let c = 0; c < 3; c++) NtR[i][c] += a * R[k][c]; } }
  const mid = inner > 0 ? solve(NtN, NtR) : [];
  const P = [[...Q0], ...mid, [...Qm]] as PlainPoint[];
  return { degree: deg, knots: U, points: P, weights: P.map(() => 1) };
}

/** The mean over lists of each position. */
function averaged(lists: readonly number[][]): number[] {
  const out: number[] = [];
  for (let k = 0; k < lists[0].length; k++) { let s = 0; for (const l of lists) s += l[k]; out.push(s / lists.length); }
  return out;
}
/** The surface through a grid of points (rows along u: grid[i][j] at u_i, v_j), degree p and q (lowered to the counts). */
export function interpolateSurfacePlain(grid: readonly (readonly PlainPoint[])[], p = 3, q = 3): PlainFitSurface {
  const nu = grid.length, nv = grid[0].length;
  // Parameters averaged over the rows and the columns.
  const ub = averaged(Array.from({ length: nv }, (_, j) => chordParameters(grid.map(r => r[j])))), vb = averaged(grid.map(r => chordParameters(r)));
  const pu = Math.min(p, nu - 1), qv = Math.min(q, nv - 1), U = averagedKnots(ub, pu), V = averagedKnots(vb, qv);
  // Each column interpolated along u, then each row of those poles along v.
  const R = Array.from({ length: nv }, (_, j) => interpolateCurvePlain(grid.map(r => r[j]), pu, ub, U).points);
  const P = Array.from({ length: nu }, (_, i) => interpolateCurvePlain(R.map(col => col[i]), qv, vb, V).points);
  return { degreeU: pu, degreeV: qv, knotsU: U, knotsV: V, points: P, weights: P.map(r => r.map(() => 1)) };
}

/** ka·a + kb·b, coordinate by coordinate. */
function comb(a: readonly number[], ka: number, b: readonly number[], kb: number): number[] { const o: number[] = []; for (let k = 0; k < a.length; k++) o.push(ka * a[k] + kb * b[k]); return o; }
function gap(a: readonly number[], b: readonly number[]): number { const d: number[] = []; for (let k = 0; k < a.length; k++) d.push(a[k] - b[k]); return Math.hypot(...d); }
/**
 * The curve with one interior knot taken out (The NURBS Book A5.8), when the curve it leaves stays within `tol` mm of
 * the original; null when it does not (the knot carries shape). The knot is the one nearest `u`.
 */
export function removeCurveKnotPlain(c: PlainFitCurve, u: number, tol: number): PlainFitCurve | null {
  const p = c.degree, U = [...c.knots], n = c.points.length - 1, m = n + p + 1;
  // The interior knot nearest u, its last index and multiplicity.
  const inner = U.slice(p + 1, m - p); if (!inner.length) return null;
  let knot = inner[0]; for (const x of inner) if (Math.abs(x - u) < Math.abs(knot - u)) knot = x;
  let s = 0; for (const x of U) if (x === knot) s++;
  const r = U.lastIndexOf(knot);
  // Homogeneous poles (w·P, w).
  const Pw = c.points.map((q, i) => [q[0] * c.weights[i], q[1] * c.weights[i], q[2] * c.weights[i], c.weights[i]]);
  const ord = p + 1, fout = Math.floor((2 * r - s - p) / 2), last = r - s, first = r - p, off = first - 1;
  if (first < 1 || last + 1 > n) return null;
  const temp: number[][] = []; temp[0] = Pw[off]; temp[last + 1 - off] = Pw[last + 1];
  let i = first, j = last, ii = 1, jj = last - off;
  while (j - i > 0) {
    const ai = (knot - U[i]) / (U[i + ord] - U[i]), aj = (knot - U[j]) / (U[j + ord] - U[j]);
    temp[ii] = comb(Pw[i], 1 / ai, temp[ii - 1], -(1 - ai) / ai);
    temp[jj] = comb(Pw[j], 1 / (1 - aj), temp[jj + 1], -aj / (1 - aj));
    i++; ii++; j--; jj--;
  }
  // (The tolerance on homogeneous poles, scaled as the book does for weights and the curve's reach.)
  let wmin = Infinity, pmax = -Infinity; for (const w of c.weights) wmin = Math.min(wmin, w); for (const q of c.points) pmax = Math.max(pmax, Math.hypot(q[0], q[1], q[2]));
  const TOL = tol * wmin / (1 + pmax);
  let ok: boolean;
  if (j - i < 0) ok = gap(temp[ii - 1], temp[jj + 1]) <= TOL;
  else { const ai = (knot - U[i]) / (U[i + ord] - U[i]); ok = gap(Pw[i], comb(temp[ii + 1], ai, temp[ii - 1], 1 - ai)) <= TOL; }
  if (!ok) return null;
  for (i = first, j = last; j - i > 0; i++, j--) { Pw[i] = temp[i - off]; Pw[j] = temp[j - off]; }
  U.splice(r, 1); Pw.splice(fout, 1);
  return { degree: p, knots: U, points: Pw.map(q => [q[0] / q[3], q[1] / q[3], q[2] / q[3]] as PlainPoint), weights: Pw.map(q => q[3]) };
}
