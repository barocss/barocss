// Private D419 admission: direct analytic offsets only. No general offset construction or repair.
import { BrepError } from '../brep/brep-core.js';
import { SectionRationalContext, type SectionRational } from '../section-rational-internal.js';
import type { Curve, Point, Surface } from '../types.js';

export interface OffsetFrame { o: Point; x: Point; y: Point; z: Point }
interface OffsetInput { origin: Point; axis: Point; distance: number; radius?: number }
type ReducedOffsetSupport = ({ kind: 'plane'; f: OffsetFrame } | { kind: 'cylinder'; f: OffsetFrame; r: number }) & { input?: OffsetInput };
type SphereOffsetSupport = { kind: 'sphere'; f: OffsetFrame; r: number; input: OffsetInput & { radius: number } };
export type OffsetSupport = ReducedOffsetSupport | SphereOffsetSupport;
type Q = SectionRational;
type QV = [Q, Q, Q];
function unavailable(_kind: 'BUDGET' | 'REPRESENTABILITY', detail: string): never { throw new BrepError('INPUT', `STEP: OFFSET_SURFACE boundary proof is not supported yet (${detail})`); }
function minus(q: SectionRationalContext, a: readonly number[], b: readonly number[]): QV { return [q.sub(q.from(a[0]), q.from(b[0])), q.sub(q.from(a[1]), q.from(b[1])), q.sub(q.from(a[2]), q.from(b[2]))]; }
function vector(q: SectionRationalContext, a: readonly number[]): QV { return [q.from(a[0]), q.from(a[1]), q.from(a[2])]; }
function dot(q: SectionRationalContext, a: QV, b: QV): Q { return q.add(q.add(q.mul(a[0], b[0]), q.mul(a[1], b[1])), q.mul(a[2], b[2])); }
function radial(q: SectionRationalContext, p: QV, n: QV, nn: Q): QV {
  const k = q.div(dot(q, p, n), nn);
  return [q.sub(p[0], q.mul(k, n[0])), q.sub(p[1], q.mul(k, n[1])), q.sub(p[2], q.mul(k, n[2]))];
}
const CHOOSE = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1]];
function mismatch(face: string, edge: string): never { throw new BrepError('GEOMETRY', `STEP: OFFSET_SURFACE edge ${edge} is separated from its surface (${face})`); }
function uncertain(face: string, edge: string): never { throw new BrepError('INPUT', `STEP: OFFSET_SURFACE boundary ${edge} is not supported yet (analytic containment not certified for ${face})`); }
/**
 * A=literal raw axis, N=stored normalized axis, k=(N.A)/(A.A)>0, e=N-kA.
 * ||N-unit(A)|| <= L1(e)+|k²(A.A)-1| (the omitted denominator k||A||+1>=1).
 * Unit(N) adds at most |N.N-1|. Triangle bounds cover reduction and local axis error.
 * All budgets remain exact rationals and are subtracted ONCE from the declared edge tolerance.
 */
function reductionError(q: SectionRationalContext, s: ReducedOffsetSupport, c: Curve, n: QV, nn: Q): Q {
  const input = s.input; if (!input) return q.rat(0n);
  const a = vector(q, input.axis), aa = dot(q, a, a), one = q.rat(1n);
  if (aa.n === 0n) unavailable('REPRESENTABILITY', 'zero raw offset axis');
  const k = q.div(dot(q, n, a), aa);
  if (k.n <= 0n) unavailable('REPRESENTABILITY', 'offset axis orientation is not represented');
  let normalError = q.rat(0n);
  for (let i = 0; i < 3; i++) normalError = q.add(normalError, q.abs(q.sub(n[i], q.mul(k, a[i]))));
  normalError = q.add(normalError, q.abs(q.sub(q.mul(q.mul(k, k), aa), one)));
  const axisError = q.add(normalError, q.abs(q.sub(nn, one))); let size = q.rat(0n);
  for (const point of c.controlPoints) {
    const v = minus(q, point, s.f.o); let bound = q.rat(0n);
    for (const value of v) bound = q.add(bound, q.abs(value));
    size = q.max(size, bound);
  }
  const distance = q.from(input.distance); let error = q.mul(size, axisError);
  if (s.kind === 'plane') {
    error = q.add(error, q.mul(q.abs(distance), normalError));
    for (let i = 0; i < 3; i++) {
      const ideal = q.add(q.from(input.origin[i]), q.mul(distance, n[i]));
      error = q.add(error, q.abs(q.sub(q.from(s.f.o[i]), ideal)));
    }
  } else error = q.add(error, q.abs(q.sub(q.from(s.r), q.add(q.from(input.radius!), distance))));
  return error;
}
/** Raw LINE support/direction or generated conic endpoints, checked before endpoint pinning is accepted. */
export function checkOffsetSourceEndpoints(source: { kind: 'line'; o: Point; z: Point; same: boolean } | { kind: 'conic'; start: Point; end: Point }, a: readonly number[], b: readonly number[], tolerance: number, face: string, edge: string): void {
  const q = new SectionRationalContext(unavailable), t = q.from(tolerance), tt = q.mul(t, t);
  if (source.kind === 'line') {
    const n = vector(q, source.z), nn = dot(q, n, n);
    if (nn.n === 0n) uncertain(face, edge);
    for (const p of [a, b]) {
      const r = radial(q, minus(q, p, source.o), n, nn);
      if (q.compare(dot(q, r, r), tt) > 0) mismatch(face, edge);
    }
    const along = dot(q, minus(q, b, a), n).n;
    if (source.same ? along <= 0n : along >= 0n) mismatch(face, edge);
  } else {
    for (const [p, generated] of [[a, source.start], [b, source.end]]) {
      const d = minus(q, p, generated);
      if (q.compare(dot(q, d, d), tt) > 0) mismatch(face, edge);
    }
  }
}

/** Existing conic construction: clamped quadratic Bezier spans joined at double knots. */
function quadraticBezierLayout(degree: number, knots: readonly number[], count: number): boolean {
  if (degree !== 2 || count < 3 || count % 2 !== 1 || knots.length !== count + 3) return false;
  for (const k of knots) if (!Number.isFinite(k)) return false;
  const end = knots.length - 3;
  if (knots[0] !== knots[1] || knots[1] !== knots[2] || knots[end] !== knots[end + 1] || knots[end + 1] !== knots[end + 2]) return false;
  let previous = knots[2];
  for (let i = 3; i < end; i += 2) {
    if (knots[i] !== knots[i + 1] || !(knots[i] > previous)) return false;
    previous = knots[i];
  }
  return knots[end] > previous;
}
function cross(q: SectionRationalContext, a: QV, b: QV): QV {
  return [q.sub(q.mul(a[1], b[2]), q.mul(a[2], b[1])), q.sub(q.mul(a[2], b[0]), q.mul(a[0], b[2])), q.sub(q.mul(a[0], b[1]), q.mul(a[1], b[0]))];
}
function difference(q: SectionRationalContext, a: QV, b: QV): QV { return [q.sub(a[0], b[0]), q.sub(a[1], b[1]), q.sub(a[2], b[2])]; }
function zeroVector(a: QV): boolean { return a[0].n === 0n && a[1].n === 0n && a[2].n === 0n; }
/** Final stored circle spans against exact represented-input R+d; no axis reduction. */
function checkSphereBoundary(s: SphereOffsetSupport, c: Curve, tolerance: number, face: string, edge: string): void {
  if (!quadraticBezierLayout(c.degree, c.knots, c.controlPoints.length) || c.weights.length !== c.controlPoints.length) uncertain(face, edge);
  const q = new SectionRationalContext(unavailable), t = q.from(tolerance), r = q.add(q.from(s.input.radius), q.from(s.input.distance));
  if (r.n <= 0n) uncertain(face, edge);
  const low = q.compare(r, t) > 0 ? q.sub(r, t) : q.rat(0n), high = q.add(r, t), lo2 = q.mul(low, low), hi2 = q.mul(high, high);
  for (const i of [0, c.controlPoints.length - 1]) {
    const p = minus(q, c.controlPoints[i], s.input.origin), d2 = dot(q, p, p);
    if (q.compare(d2, lo2) < 0 || q.compare(d2, hi2) > 0) mismatch(face, edge);
  }
  for (let start = 0; start + 2 < c.controlPoints.length; start += 2) {
    const p: QV[] = [], v: QV[] = [], w: Q[] = [];
    for (let i = 0; i <= 2; i++) {
      const point = minus(q, c.controlPoints[start + i], s.input.origin), weight = q.from(c.weights[start + i]);
      v.push(point); p.push([q.mul(point[0], weight), q.mul(point[1], weight), q.mul(point[2], weight)]); w.push(weight);
    }
    if (zeroVector(cross(q, difference(q, v[1], v[0]), difference(q, v[2], v[1])))) uncertain(face, edge);
    for (let k = 0; k <= 4; k++) {
      let rr = q.rat(0n), ww = q.rat(0n);
      for (let i = Math.max(0, k - 2); i <= Math.min(2, k); i++) {
        const j = k - i, factor = q.rat(BigInt(CHOOSE[2][i] * CHOOSE[2][j]), BigInt(CHOOSE[4][k]));
        rr = q.add(rr, q.mul(factor, dot(q, p[i], p[j]))); ww = q.add(ww, q.mul(factor, q.mul(w[i], w[j])));
      }
      if (q.compare(rr, q.mul(lo2, ww)) < 0 || q.compare(rr, q.mul(hi2, ww)) > 0) uncertain(face, edge);
    }
  }
}
/** One exact interior rank witness in the first generated Bezier cell, not global regularity. */
export function checkSphereOffsetPatch(s: SphereOffsetSupport, surface: Surface, face: string): void {
  const rows = surface.controlPoints.length, columns = surface.controlPoints[0]?.length ?? 0;
  if (!quadraticBezierLayout(surface.degreeU, surface.knotsU, rows) || !quadraticBezierLayout(surface.degreeV, surface.knotsV, columns) || surface.weights.length !== rows) uncertain(face, 'surface');
  for (let i = 0; i < rows; i++) {
    if (surface.controlPoints[i].length !== columns || surface.weights[i].length !== columns) uncertain(face, 'surface');
    for (const w of surface.weights[i]) if (!(w > 0) || !Number.isFinite(w)) uncertain(face, 'surface');
  }
  const q = new SectionRationalContext(unavailable), b = [q.rat(1n, 4n), q.rat(1n, 2n), q.rat(1n, 4n)], d = [q.rat(-1n), q.rat(0n), q.rat(1n)];
  const h: QV[] = [[q.rat(0n), q.rat(0n), q.rat(0n)], [q.rat(0n), q.rat(0n), q.rat(0n)], [q.rat(0n), q.rat(0n), q.rat(0n)]], w = [q.rat(0n), q.rat(0n), q.rat(0n)];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const p = minus(q, surface.controlPoints[i][j], s.input.origin), weight = q.from(surface.weights[i][j]);
    const factors = [q.mul(b[i], b[j]), q.mul(d[i], b[j]), q.mul(b[i], d[j])];
    for (let k = 0; k < 3; k++) {
      const f = q.mul(weight, factors[k]); w[k] = q.add(w[k], f);
      for (let a = 0; a < 3; a++) h[k][a] = q.add(h[k][a], q.mul(f, p[a]));
    }
  }
  const u: QV = [q.sub(q.mul(h[1][0], w[0]), q.mul(h[0][0], w[1])), q.sub(q.mul(h[1][1], w[0]), q.mul(h[0][1], w[1])), q.sub(q.mul(h[1][2], w[0]), q.mul(h[0][2], w[1]))];
  const v: QV = [q.sub(q.mul(h[2][0], w[0]), q.mul(h[0][0], w[2])), q.sub(q.mul(h[2][1], w[0]), q.mul(h[0][1], w[2])), q.sub(q.mul(h[2][2], w[0]), q.mul(h[0][2], w[2]))];
  if (w[0].n <= 0n || zeroVector(cross(q, u, v))) uncertain(face, 'surface');
}

/**
 * Certifies the actual stored binary64 rational curve against the literal analytic offset support,
 * with conservative exact normalization/reduction budgets; not samples of the source conic.
 * Plane: its positive-weight control hull stays in the tolerance slab.
 * Cylinder: homogeneous squared radial distance is bounded using Bernstein coefficients on each
 * line/quadratic Bezier span; positive W makes [max(0,R-tol)^2 W^2,(R+tol)^2 W^2] sufficient.
 * Failure to certify is capability, unless an endpoint itself proves separation. No tolerance slack.
 */
export function checkOffsetBoundary(s: OffsetSupport, c: Curve, tolerance: number, face: string, edge: string): void {
  if (!Number.isFinite(tolerance) || tolerance < 0 || !c.controlPoints.length) uncertain(face, edge);
  for (const w of c.weights) if (!(w > 0) || !Number.isFinite(w)) uncertain(face, edge);
  if (s.kind === 'sphere') { checkSphereBoundary(s, c, tolerance, face, edge); return; }
  const q = new SectionRationalContext(unavailable), n = vector(q, s.f.z), nn = dot(q, n, n), raw = q.from(tolerance);
  if (nn.n === 0n) uncertain(face, edge);
  const error = reductionError(q, s, c, n, nn), t = q.sub(raw, error), far = q.add(raw, error);
  if (t.n < 0n) unavailable('REPRESENTABILITY', `OFFSET_SURFACE reduction precision exceeds declared tolerance (${face})`);
  const tt = q.mul(t, t);
  if (s.kind === 'plane') {
    const limit = q.mul(tt, nn);
    for (let i = 0; i < c.controlPoints.length; i++) {
      const d = dot(q, minus(q, c.controlPoints[i], s.f.o), n);
      if (q.compare(q.mul(d, d), limit) > 0) {
        if ((i === 0 || i === c.controlPoints.length - 1) && q.compare(q.mul(d, d), q.mul(q.mul(far, far), nn)) > 0) mismatch(face, edge);
        uncertain(face, edge);
      }
    }
    return;
  }
  const degree = c.degree;
  if (degree !== 1 && degree !== 2 || degree === 1 && c.controlPoints.length !== 2 || degree === 2 && c.controlPoints.length % 2 !== 1) uncertain(face, edge);
  const r = q.from(s.r), low = q.compare(r, t) > 0 ? q.sub(r, t) : q.rat(0n), high = q.add(r, t), lo2 = q.mul(low, low), hi2 = q.mul(high, high);
  const farLow = q.compare(r, far) > 0 ? q.sub(r, far) : q.rat(0n), farHigh = q.add(r, far), farLo2 = q.mul(farLow, farLow), farHi2 = q.mul(farHigh, farHigh);
  for (const i of [0, c.controlPoints.length - 1]) {
    const p = radial(q, minus(q, c.controlPoints[i], s.f.o), n, nn), d2 = dot(q, p, p);
    if (q.compare(d2, farLo2) < 0 || q.compare(d2, farHi2) > 0) mismatch(face, edge);
    if (q.compare(d2, lo2) < 0 || q.compare(d2, hi2) > 0) uncertain(face, edge);
  }
  for (let start = 0; start + degree < c.controlPoints.length; start += degree) {
    const p: QV[] = [], w: Q[] = [];
    for (let i = 0; i <= degree; i++) {
      const weight = q.from(c.weights[start + i]), v = radial(q, minus(q, c.controlPoints[start + i], s.f.o), n, nn);
      p.push([q.mul(v[0], weight), q.mul(v[1], weight), q.mul(v[2], weight)]); w.push(weight);
    }
    for (let k = 0; k <= 2 * degree; k++) {
      let rr = q.rat(0n), ww = q.rat(0n);
      for (let i = Math.max(0, k - degree); i <= Math.min(degree, k); i++) {
        const j = k - i, factor = q.rat(BigInt(CHOOSE[degree][i] * CHOOSE[degree][j]), BigInt(CHOOSE[2 * degree][k]));
        rr = q.add(rr, q.mul(factor, dot(q, p[i], p[j]))); ww = q.add(ww, q.mul(factor, q.mul(w[i], w[j])));
      }
      if (q.compare(rr, q.mul(lo2, ww)) < 0 || q.compare(rr, q.mul(hi2, ww)) > 0) uncertain(face, edge);
    }
  }
}
