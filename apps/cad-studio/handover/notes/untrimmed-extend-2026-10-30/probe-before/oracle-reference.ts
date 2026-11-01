// Exact rational oracle for an extended affine plane (all weights 1).
export type Q = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
export const q = (n: bigint, d = 1n): Q => { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return { n: n / g, d: d / g }; };
export const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
export const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
export const abs = (a: Q) => (a.n < 0n ? q(-a.n, a.d) : a);
export const le = (a: Q, b: Q) => a.n * b.d <= b.n * a.d;
export const lt = (a: Q, b: Q) => a.n * b.d < b.n * a.d;
export const toNum = (a: Q) => Number(a.n) / Number(a.d);
/** The binary64 value exactly, as a rational. */
export function exact(x: number): Q {
  if (!Number.isFinite(x)) throw new RangeError('not finite');
  if (x === 0) return q(0n);
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, x);
  const bits = view.getBigUint64(0), sign = bits >> 63n ? -1n : 1n, e = Number((bits >> 52n) & 0x7ffn), f = bits & ((1n << 52n) - 1n);
  const m = e === 0 ? f : f | (1n << 52n), p = (e === 0 ? 1 : e) - 1075;
  return p >= 0 ? q(sign * m * (1n << BigInt(p))) : q(sign * m, 1n << BigInt(-p));
}
export const dec = (s: string): Q => { const [i, f = ''] = s.split('.'); return q(BigInt(i + f), 10n ** BigInt(f.length)); };
export type V3 = [Q, Q, Q];
const vadd = (a: V3, b: V3): V3 => [add(a[0], b[0]), add(a[1], b[1]), add(a[2], b[2])];
const vscale = (a: V3, k: Q): V3 => [mul(a[0], k), mul(a[1], k), mul(a[2], k)];
const vsub = (a: V3, b: V3): V3 => [sub(a[0], b[0]), sub(a[1], b[1]), sub(a[2], b[2])];
const l1 = (a: V3) => add(add(abs(a[0]), abs(a[1])), abs(a[2]));
const maxQ = (a: Q, b: Q) => (lt(a, b) ? b : a);
/** Greville abscissae of a clamped knot vector, degree p. */
function greville(U: readonly Q[], p: number): Q[] {
  const out: Q[] = [];
  for (let i = 0; i + p + 1 < U.length; i++) { let s = q(0n); for (let k = 1; k <= p; k++) s = add(s, U[i + k]); out.push(div(s, q(BigInt(p)))); }
  return out;
}
export interface Affine { origin: V3; ds: V3; dt: V3 }
export interface Bound { position: Q; derivS: Q; derivT: Q; knotsOk: boolean }
/**
 * Max L1 pole residuals against the affine T(s,t) = origin + s·ds + t·dt, and of the derivative nets against ds/dt
 * (partition of unity turns each into a bound over the whole surface).
 */
export function affineBound(g: { degreeU: number; degreeV: number; knotsU: number[]; knotsV: number[]; controlPoints: number[][][]; weights: number[][] }, T: Affine): Bound {
  const p = g.degreeU, r = g.degreeV, U = g.knotsU.map(exact), V = g.knotsV.map(exact), P = g.controlPoints.map(row => row.map(c => c.map(exact) as V3));
  const n = P.length, m = P[0].length;
  const clamped = (K: Q[], deg: number, count: number) => K.length === count + deg + 1 && K.every((k, i) => i === 0 || le(K[i - 1], k))
    && K.slice(0, deg + 1).every(k => k.n === 0n) && K.slice(-deg - 1).every(k => k.n === k.d)
    && K.slice(1, -1).every((k, i, a) => i + deg >= a.length || lt(k, a[i + deg] ?? q(2n)) || true);
  const knotsOk = clamped(U, p, n) && clamped(V, r, m) && g.weights.every(row => row.every(w => w === 1));
  const gu = greville(U, p), gv = greville(V, r);
  const Tat = (s: Q, t: Q) => vadd(vadd(T.origin, vscale(T.ds, s)), vscale(T.dt, t));
  let position = q(0n), derivS = q(0n), derivT = q(0n);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) position = maxQ(position, l1(vsub(P[i][j], Tat(gu[i], gv[j]))));
  for (let i = 0; i + 1 < n; i++) for (let j = 0; j < m; j++) {
    const span = sub(U[i + p + 1], U[i + 1]);
    if (span.n === 0n) { derivS = q(10n ** 30n); continue; }
    derivS = maxQ(derivS, l1(vsub(vscale(vsub(P[i + 1][j], P[i][j]), div(q(BigInt(p)), span)), T.ds)));
  }
  for (let i = 0; i < n; i++) for (let j = 0; j + 1 < m; j++) {
    const span = sub(V[j + r + 1], V[j + 1]);
    if (span.n === 0n) { derivT = q(10n ** 30n); continue; }
    derivT = maxQ(derivT, l1(vsub(vscale(vsub(P[i][j + 1], P[i][j]), div(q(BigInt(r)), span)), T.dt)));
  }
  return { position, derivS, derivT, knotsOk };
}
