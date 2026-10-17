// B-spline fitting for the direct geometry (The NURBS Book, ch. 9): curves and surfaces through sampled
// points — global interpolation with chord-length parameters and averaged knots — and least-squares
// approximation with fewer poles. Non-rational (all weights 1); used to fill, extend and fit.
type P3 = [number, number, number];

/** The B-spline basis functions N_{span−p..span, p}(u) (Cox–de Boor). */
export function basis(span: number, u: number, p: number, U: readonly number[]): number[] {
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
export function findSpan(n: number, p: number, u: number, U: readonly number[]): number {
  if (u >= U[n + 1]) return n;
  if (u <= U[p]) return p;
  let lo = p, hi = n + 1, mid = (lo + hi) >> 1;
  while (u < U[mid] || u >= U[mid + 1]) { if (u < U[mid]) hi = mid; else lo = mid; mid = (lo + hi) >> 1; }
  return mid;
}
const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Chord-length parameters of points in [0, 1] (equal spacing when they all coincide). */
export function chordParameters(points: readonly (readonly number[])[]): number[] {
  const d = points.slice(1).map((p, k) => dist(p, points[k])), total = d.reduce((s, x) => s + x, 0);
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
/** Solves A x = b for each column of b (Gaussian elimination with partial pivoting). */
function solve(A: number[][], B: number[][]): number[][] {
  const n = A.length, M = A.map((r, i) => [...r, ...B[i]]), w = B[0].length;
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-14) throw new Error('the points cannot be fitted (they repeat or line up badly)');
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / M[c][c]; if (f) for (let k = c; k < n + w; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r.slice(n).map(x => x / M[i][i]));
}

export interface FitCurve { degree: number; knots: number[]; points: P3[]; weights: number[] }

/** The curve of degree p through every point (at the given parameters, else chord-length ones). */
export function interpolateCurve(points: readonly P3[], p = 3, params?: readonly number[], knots?: readonly number[]): FitCurve {
  const n = points.length - 1, deg = Math.min(p, n);
  if (n < 1) throw new Error('a curve needs two or more points');
  const t = params ?? chordParameters(points), U = knots ? [...knots] : averagedKnots(t, deg);
  const A = t.map(u => { const row = Array(n + 1).fill(0), s = findSpan(n, deg, u, U), N = basis(s, u, deg, U); for (let k = 0; k <= deg; k++) row[s - deg + k] = N[k]; return row; });
  const P = solve(A, points.map(q => [...q])) as P3[];
  return { degree: deg, knots: U, points: P, weights: P.map(() => 1) };
}

/**
 * The curve of degree p with `count` poles nearest (least squares) to the points, its ends on the first
 * and last point (The NURBS Book A9.7); fewer poles than points smooth them.
 */
export function approximateCurve(points: readonly P3[], count: number, p = 3): FitCurve {
  const m = points.length - 1, n = count - 1, deg = Math.min(p, n);
  if (count < deg + 1 || count > points.length) throw new Error(`a fit needs ${deg + 1} to ${points.length} poles`);
  if (count === points.length) return interpolateCurve(points, p);
  const t = chordParameters(points), d = (m + 1) / (n - deg + 1), U = Array(deg + 1).fill(0);
  for (let j = 1; j <= n - deg; j++) { const i = Math.floor(j * d), a = j * d - i; U.push((1 - a) * t[i - 1] + a * t[i]); }
  U.push(...Array(deg + 1).fill(1));
  const Nrow = (u: number) => { const row = Array(n + 1).fill(0), s = findSpan(n, deg, u, U), N = basis(s, u, deg, U); for (let k = 0; k <= deg; k++) row[s - deg + k] = N[k]; return row; };
  const rows = t.slice(1, m).map(Nrow), Q0 = points[0], Qm = points[m];
  const R = t.slice(1, m).map((u, k) => { const r = rows[k]; return [0, 1, 2].map(c => points[k + 1][c] - r[0] * Q0[c] - r[n] * Qm[c]); });
  // Normal equations for the inner poles 1 … n − 1.
  const inner = n - 1, NtN = Array.from({ length: inner }, () => Array(inner).fill(0)), NtR = Array.from({ length: inner }, () => [0, 0, 0]);
  rows.forEach((r, k) => { for (let i = 0; i < inner; i++) { const a = r[i + 1]; if (!a) continue; for (let j = 0; j < inner; j++) NtN[i][j] += a * r[j + 1]; for (let c = 0; c < 3; c++) NtR[i][c] += a * R[k][c]; } });
  const mid = inner > 0 ? solve(NtN, NtR) : [];
  const P = [[...Q0], ...mid, [...Qm]] as P3[];
  return { degree: deg, knots: U, points: P, weights: P.map(() => 1) };
}

export interface FitSurface { degreeU: number; degreeV: number; knotsU: number[]; knotsV: number[]; points: P3[][]; weights: number[][] }

/** The surface through a grid of points (rows along u: grid[i][j] at u_i, v_j), degree p each way. */
export function interpolateSurface(grid: readonly (readonly P3[])[], p = 3, q = 3): FitSurface {
  const nu = grid.length, nv = grid[0].length;
  // Parameters averaged over the rows and the columns.
  const avg = (lists: number[][]) => lists[0].map((_, k) => lists.reduce((s, l) => s + l[k], 0) / lists.length);
  const ub = avg(Array.from({ length: nv }, (_, j) => chordParameters(grid.map(r => r[j])))), vb = avg(grid.map(r => chordParameters(r)));
  const pu = Math.min(p, nu - 1), qv = Math.min(q, nv - 1), U = averagedKnots(ub, pu), V = averagedKnots(vb, qv);
  // Each column interpolated along u, then each row of those poles along v.
  const R = Array.from({ length: nv }, (_, j) => interpolateCurve(grid.map(r => r[j]), pu, ub, U).points);
  const P = Array.from({ length: nu }, (_, i) => interpolateCurve(R.map(col => col[i]), qv, vb, V).points);
  return { degreeU: pu, degreeV: qv, knotsU: U, knotsV: V, points: P, weights: P.map(r => r.map(() => 1)) };
}
