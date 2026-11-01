// Independent oracle: rational de Boor, quadrature, nearest points. No kernel imports.
export type P3 = [number, number, number];
export interface C { degree: number; knots: number[]; controlPoints: number[][]; weights: number[] }
export interface S { degreeU: number; degreeV: number; knotsU: number[]; knotsV: number[]; controlPoints: number[][][]; weights: number[][] }

function span(U: number[], p: number, n: number, u: number): number {
  if (u >= U[n + 1]) { let k = n; while (k > p && U[k] >= U[n + 1]) k--; return k; }
  if (u <= U[p]) { let k = p; while (U[k + 1] <= u) k++; return k; }
  let k = p; while (!(U[k] <= u && u < U[k + 1])) k++; return k;
}
/** de Boor on homogeneous 4-vectors. */
function deboor(U: number[], p: number, H: number[][], u: number): number[] {
  const n = H.length - 1, k = span(U, p, n, u);
  const d = Array.from({ length: p + 1 }, (_, j) => [...H[j + k - p]]);
  for (let r = 1; r <= p; r++) for (let j = p; j >= r; j--) {
    const den = U[j + 1 + k - r] - U[j + k - p], a = den === 0 ? 0 : (u - U[j + k - p]) / den;
    for (let c = 0; c < 4; c++) d[j][c] = (1 - a) * d[j - 1][c] + a * d[j][c];
  }
  return d[p];
}
export function cEval(c: C, t: number): P3 {
  const H = c.controlPoints.map((q, i) => [q[0] * c.weights[i], q[1] * c.weights[i], q[2] * c.weights[i], c.weights[i]]);
  const h = deboor(c.knots, c.degree, H, t); return [h[0] / h[3], h[1] / h[3], h[2] / h[3]];
}
export function sEval(s: S, u: number, v: number): P3 {
  const rows = s.controlPoints.map((row, i) => deboor(s.knotsV, s.degreeV, row.map((q, j) => [q[0] * s.weights[i][j], q[1] * s.weights[i][j], q[2] * s.weights[i][j], s.weights[i][j]]), v));
  const h = deboor(s.knotsU, s.degreeU, rows, u); return [h[0] / h[3], h[1] / h[3], h[2] / h[3]];
}
export const sub = (a: number[], b: number[]): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const crs = (a: number[], b: number[]): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const nrm = (a: number[]) => Math.hypot(a[0], a[1], a[2]);
export const dst = (a: number[], b: number[]) => nrm(sub(a, b));
export const dotp = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function legendre(n: number) {
  const x: number[] = [], w: number[] = [];
  for (let i = 0; i < n; i++) {
    let z = Math.cos(Math.PI * (i + 0.75) / (n + 0.5)), dp = 1;
    for (let it = 0; it < 100; it++) { let p0 = 1, p1 = z; for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * z * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; } dp = n * (z * p1 - p0) / (z * z - 1); const dz = p1 / dp; z -= dz; if (Math.abs(dz) < 1e-16) break; }
    x.push(z); w.push(2 / ((1 - z * z) * dp * dp));
  }
  return { x, w };
}
const G = legendre(20);
/** 4th-order central difference (Richardson) derivative of f at t inside [a,b] (one-sided near ends). */
function deriv(f: (t: number) => P3, t: number, a: number, b: number): P3 {
  const h = 1e-4 * (b - a);
  if (t - 2 * h < a) { const f0 = f(t), f1 = f(t + h), f2 = f(t + 2 * h), f3 = f(t + 3 * h); return [0, 1, 2].map(i => (-11 * f0[i] + 18 * f1[i] - 9 * f2[i] + 2 * f3[i]) / (6 * h)) as P3; }
  if (t + 2 * h > b) { const f0 = f(t), f1 = f(t - h), f2 = f(t - 2 * h), f3 = f(t - 3 * h); return [0, 1, 2].map(i => -(-11 * f0[i] + 18 * f1[i] - 9 * f2[i] + 2 * f3[i]) / (6 * h)) as P3; }
  const m2 = f(t - 2 * h), m1 = f(t - h), p1 = f(t + h), p2 = f(t + 2 * h);
  return [0, 1, 2].map(i => (m2[i] - 8 * m1[i] + 8 * p1[i] - p2[i]) / (12 * h)) as P3;
}
const breaks = (U: number[], p: number) => { const u = [...new Set(U)].filter(x => x >= U[p] && x <= U[U.length - 1 - p]); return u.slice(1).map((b, i) => [u[i], b]); };
/** Arc length of a curve by Gauss on each span with differentiated de Boor. */
export function cLength(c: C, t0 = c.knots[0], t1 = c.knots[c.knots.length - 1]): number {
  let L = 0;
  for (const [a, b] of breaks(c.knots, c.degree)) {
    const lo = Math.max(a, t0), hi = Math.min(b, t1); if (hi <= lo) continue;
    for (let i = 0; i < G.x.length; i++) { const t = (lo + hi) / 2 + (hi - lo) / 2 * G.x[i]; L += G.w[i] * (hi - lo) / 2 * nrm(deriv(s => cEval(c, s), t, a, b)); }
  }
  return L;
}
/** Area of a NURBS surface: ∫∫|Su×Sv| over spans, Gauss with finite-difference partials of my de Boor. */
export function sArea(s: S): number {
  let A = 0;
  for (const [u0, u1] of breaks(s.knotsU, s.degreeU)) for (const [v0, v1] of breaks(s.knotsV, s.degreeV)) for (let i = 0; i < G.x.length; i++) for (let j = 0; j < G.x.length; j++) {
    const u = (u0 + u1) / 2 + (u1 - u0) / 2 * G.x[i], v = (v0 + v1) / 2 + (v1 - v0) / 2 * G.x[j];
    const su = deriv(t => sEval(s, t, v), u, u0, u1), sv = deriv(t => sEval(s, u, t), v, v0, v1);
    A += G.w[i] * G.w[j] * (u1 - u0) / 2 * (v1 - v0) / 2 * nrm(crs(su, sv));
  }
  return A;
}
/** Nearest distance from p to curve c (dense sample + golden refinement). */
export function cNear(c: C, p: number[]): { t: number; d: number } {
  const a = c.knots[0], b = c.knots[c.knots.length - 1], N = 400;
  let bt = a, bd = Infinity;
  for (let i = 0; i <= N; i++) { const t = a + (b - a) * i / N, d = dst(cEval(c, t), p); if (d < bd) { bd = d; bt = t; } }
  let lo = Math.max(a, bt - (b - a) / N), hi = Math.min(b, bt + (b - a) / N);
  const g = (Math.sqrt(5) - 1) / 2;
  for (let it = 0; it < 200; it++) { const m1 = hi - g * (hi - lo), m2 = lo + g * (hi - lo); if (dst(cEval(c, m1), p) < dst(cEval(c, m2), p)) hi = m2; else lo = m1; }
  const t = (lo + hi) / 2, d = dst(cEval(c, t), p);
  return d < bd ? { t, d } : { t: bt, d: bd };
}
/** Distance of q from segment ab, and its parameter. */
export function segDist(a: number[], b: number[], q: number[]): { d: number; s: number } {
  const ab = sub(b, a), L2 = dotp(ab, ab), s = L2 === 0 ? 0 : dotp(sub(q, a), ab) / L2;
  const c = [a[0] + s * ab[0], a[1] + s * ab[1], a[2] + s * ab[2]]; return { d: dst(c, q), s };
}
