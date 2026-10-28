import { validateSurface } from '../core/math.js';
import { ownSnapshot, hasExactOwnFields, type OwnSnapshotSpec } from '../core/own-data.js';
import { kernelRefusal, isFrom, type KernelError } from '../core/barocss-error.js';
import { CadNumericPolicy } from '../numeric-policy.js';
import { SectionRationalContext, type SectionRational, type SectionFraction } from '../section-rational-internal.js';
import type { Surface } from '../types.js';

type R = SectionRational;
type Polynomial = R[];
interface Interval { lo: bigint; hi: bigint }
export interface WrapMomentRectangle { readonly u: readonly [number, number]; readonly v: readonly [number, number] }
export interface WrapMomentOptions { readonly panels?: number; readonly maxOperations?: number; readonly errorBudgets?: readonly number[] }
export interface WrapMomentValue {
  readonly estimate: number; readonly lower: SectionFraction; readonly upper: SectionFraction;
  readonly estimateError: { readonly exact: SectionFraction; readonly upper: number };
  readonly roundingWidth: SectionFraction; readonly remainderRadius: SectionFraction;
}
export interface CylindricalWrapMoments {
  readonly source: Surface; readonly rectangles: readonly WrapMomentRectangle[];
  readonly authority: 'original-stored-quarter-parameter-rectangles';
  readonly method: 'exact-simpson-with-fourth-derivative-bound';
  readonly order: readonly ['V', 'X', 'Y', 'Z', 'XX', 'YY', 'ZZ', 'XY', 'XZ', 'YZ'];
  readonly radialScale: 2; readonly panels: number; readonly fractionBits: 128;
  readonly moments: readonly WrapMomentValue[]; readonly positiveAddedVolume: boolean; readonly solidQualified: false;
  readonly counts: ReturnType<SectionRationalContext['counts']> & { readonly directWork: number; readonly totalOperations: number; readonly nodes: number };
}
export type WrapMomentCode = 'INPUT' | 'SUPPORT' | 'BUDGET' | 'REPRESENTABILITY';
export type WrapMomentError = KernelError & { readonly code: WrapMomentCode };
const SCALE = 1n << 128n, MAX_WORK = 200000, MAX_BITS = 8192, MAX_TILES = 8, MAX_PANELS = 32;
const ORDER = ['V', 'X', 'Y', 'Z', 'XX', 'YY', 'ZZ', 'XY', 'XZ', 'YZ'] as const;
const NODE_POWERS = [[0, 0], [1, 0], [0, 1], [2, 0], [0, 2], [1, 1]] as const;
const XY_INDEX = [0, 1, 2, 0, 3, 4, 0, 5, 1, 2], Z_POWER = [0, 0, 0, 1, 0, 0, 2, 0, 1, 1];
const RADIAL_POWER = [2, 3, 3, 2, 4, 4, 2, 4, 3, 3];
function fail(code: WrapMomentCode, detail: string): never { throw kernelRefusal('cylindrical-wrap-moments', code, `Wrap moments: ${detail}`) as WrapMomentError; }
export function isWrapMomentError(error: unknown): error is WrapMomentError { try { return isFrom<WrapMomentCode>(error, 'cylindrical-wrap-moments'); } catch { return false; } }
function wrap(code: WrapMomentCode, detail: string, _cause: unknown): never { return fail(code, detail); }
function exactFailure(kind: 'BUDGET' | 'REPRESENTABILITY', detail: string): never { return fail(kind, detail); }
const OWN: OwnSnapshotSpec<WrapMomentCode> = { input: 'INPUT', owned: 'INPUT', budget: 'BUDGET', fail, wrap, isRefusal: isWrapMomentError };
class Context {
  readonly q = new SectionRationalContext(exactFailure);
  readonly nodes = new Map<string, readonly Interval[]>();
  directWork = 0;
  constructor(readonly maximum: number) {}
  check(): void { if (this.q.counts().operations + this.directWork > this.maximum) fail('BUDGET', 'the global exact/direct operation budget was exceeded'); }
  integer(value: bigint): bigint {
    this.directWork++; if ((value < 0n ? -value : value).toString(2).length > MAX_BITS) fail('BUDGET', 'direct integer bit budget exceeded');
    this.check(); return value;
  }
  add(a: bigint, b: bigint): bigint { return this.integer(a + b); }
  multiply(a: bigint, b: bigint): bigint { return this.integer(a * b); }
  divide(a: bigint, b: bigint): bigint { return this.integer(a / b); }
  round(value: R): Interval { return this.roundRatio(value.n, value.d); }
  roundRatio(numerator: bigint, denominator: bigint): Interval {
    if (denominator <= 0n) fail('REPRESENTABILITY', 'outward division needs a positive denominator');
    const scaled = this.multiply(numerator, SCALE), quotient = this.divide(scaled, denominator), remainder = this.integer(scaled % denominator);
    const lo = scaled < 0n && remainder !== 0n ? this.add(quotient, -1n) : quotient;
    return { lo, hi: remainder === 0n ? lo : this.add(lo, 1n) };
  }
  addInterval(a: Interval, b: Interval): Interval { return { lo: this.add(a.lo, b.lo), hi: this.add(a.hi, b.hi) }; }
  scale(value: Interval, factor: R): Interval {
    const q = this.q, a = q.mul(q.rat(value.lo, SCALE), factor), b = q.mul(q.rat(value.hi, SCALE), factor);
    const left = this.round(factor.n < 0n ? b : a), right = this.round(factor.n < 0n ? a : b);
    return { lo: left.lo, hi: right.hi };
  }
}
function record(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !hasExactOwnFields(value as Record<string, unknown>, fields)) fail('INPUT', 'exact own record fields are required');
  return value as Record<string, unknown>;
}
function choose(n: number, k: number): number { let value = 1; for (let i = 1; i <= k; i++) value = value * (n - i + 1) / i; return value; }
function zero(q: SectionRationalContext): R { return q.integer(0); }
function polynomialProduct(a: Polynomial, b: Polynomial, ctx: Context): Polynomial {
  const q = ctx.q, p = a.length - 1, r = b.length - 1, out: R[] = [];
  for (let k = 0; k <= p + r; k++) out.push(zero(q));
  for (let i = 0; i <= p; i++) for (let j = 0; j <= r; j++) {
    const coefficient = q.rat(BigInt(choose(p, i) * choose(r, j)), BigInt(choose(p + r, i + j)));
    out[i + j] = q.add(out[i + j], q.mul(coefficient, q.mul(a[i], b[j]))); ctx.check();
  }
  return out;
}
function derivative(a: Polynomial, q: SectionRationalContext): Polynomial {
  if (a.length === 1) return [zero(q)];
  const degree = q.integer(a.length - 1), out: R[] = [];
  for (let i = 0; i + 1 < a.length; i++) out.push(q.mul(degree, q.sub(a[i + 1], a[i])));
  return out;
}
function maximum(a: Polynomial, q: SectionRationalContext): R { let out = zero(q); for (const value of a) out = q.max(out, q.abs(value)); return out; }
function minimum(a: Polynomial, q: SectionRationalContext): R { let out = a[0]; for (const value of a) if (q.compare(value, out) < 0) out = value; return out; }
function rationalPower(value: R, exponent: number, q: SectionRationalContext): R { let out = q.integer(1); for (let i = 0; i < exponent; i++) out = q.mul(out, value); return out; }
function upperDyadic(value: R, ctx: Context): R { return ctx.q.rat(ctx.round(value).hi, SCALE); }
function primitiveBounds(polynomial: Polynomial, ctx: Context): R[] {
  const q = ctx.q, out: R[] = [];
  let current = polynomial;
  for (let r = 0; r <= 4; r++) {
    out.push(upperDyadic(maximum(current, q), ctx));
    if (r < 4) current = derivative(current, q);
    ctx.check();
  }
  return out;
}
function productBounds(a: readonly R[], b: readonly R[], ctx: Context): R[] {
  const q = ctx.q, out: R[] = [];
  // Leibniz and the triangle inequality bound derivatives without constructing high-degree products.
  for (let r = 0; r <= 4; r++) {
    let value = q.integer(0);
    for (let k = 0; k <= r; k++) if (a[k].n !== 0n && b[r - k].n !== 0n) {
      value = q.add(value, q.mul(q.integer(choose(r, k)), q.mul(a[k], b[r - k])));
    }
    out.push(upperDyadic(value, ctx)); ctx.check();
  }
  return out;
}
function denominatorLower(minimumWeight: R, exponent: number, ctx: Context): R {
  const lower = ctx.q.rat(ctx.round(rationalPower(minimumWeight, exponent, ctx.q)).lo, SCALE);
  if (lower.n <= 0n) fail('SUPPORT', 'the outward dyadic denominator floor must remain positive');
  return lower;
}
function fourthDerivative(pBounds: readonly R[], qBounds: readonly R[], lower: R, ctx: Context): R {
  const q = ctx.q, bounds: R[] = [];
  // Q*f=P. All derivative hulls are upper bounds, and 0<lower<=min(Q).
  // Rounding each M_r upward keeps the quotient recurrence conservative without accumulating denominators.
  bounds.push(upperDyadic(q.div(pBounds[0], lower), ctx));
  for (let r = 1; r <= 4; r++) {
    let value = pBounds[r];
    for (let l = 1; l <= r; l++) if (qBounds[l].n !== 0n && bounds[r - l].n !== 0n) {
      value = q.add(value, q.mul(q.integer(choose(r, l)), q.mul(qBounds[l], bounds[r - l])));
    }
    bounds.push(upperDyadic(q.div(value, lower), ctx)); ctx.check();
  }
  return bounds[4];
}
interface Basis { x: Polynomial; y: Polynomial; d: Polynomial; dx: Polynomial; dy: Polynomial; jacobian: Polynomial; fourth: R[] }
function prepare(source: Surface, ctx: Context): Basis {
  const q = ctx.q, x: R[] = [], y: R[] = [], d: R[] = [];
  for (let i = 0; i < 3; i++) { const w = q.from(source.weights[i][0]); d.push(w); x.push(q.mul(q.from(source.controlPoints[i][0][0]), w)); y.push(q.mul(q.from(source.controlPoints[i][0][1]), w)); }
  const dx = derivative(x, q), dy = derivative(y, q), a = polynomialProduct(x, dy, ctx), b = polynomialProduct(y, dx, ctx), jacobian: R[] = [];
  for (let i = 0; i < a.length; i++) jacobian.push(q.sub(a[i], b[i]));
  if (minimum(jacobian, q).n <= 0n) fail('SUPPORT', 'positive radial orientation must be proved by the source coefficients');
  const minD = minimum(d, q);
  if (minD.n <= 0n) fail('SUPPORT', 'a positive whole-interval source denominator is required');
  const bx = primitiveBounds(x, ctx), by = primitiveBounds(y, ctx), bj = primitiveBounds(jacobian, ctx), bd = primitiveBounds(d, ctx);
  const d2 = productBounds(bd, bd, ctx), d3 = productBounds(d2, bd, ctx), d4 = productBounds(d3, bd, ctx);
  const jx = productBounds(bj, bx, ctx), jy = productBounds(bj, by, ctx);
  const numerators = [bj, jx, jy, productBounds(jx, bx, ctx), productBounds(jy, by, ctx), productBounds(jx, by, ctx)];
  const denominators = [d2, d3, d3, d4, d4, d4];
  const l2 = denominatorLower(minD, 2, ctx), l3 = denominatorLower(minD, 3, ctx), l4 = denominatorLower(minD, 4, ctx), lowers = [l2, l3, l3, l4, l4, l4], fourth: R[] = [];
  for (let i = 0; i < numerators.length; i++) fourth.push(fourthDerivative(numerators[i], denominators[i], lowers[i], ctx));
  return { x, y, d, dx, dy, jacobian, fourth };
}
function evaluate(a: Polynomial, t: R, q: SectionRationalContext): R {
  const out = a.slice(), complement = q.sub(q.integer(1), t);
  for (let level = a.length - 1; level > 0; level--) for (let i = 0; i < level; i++) out[i] = q.add(q.mul(complement, out[i]), q.mul(t, out[i + 1]));
  return out[0];
}
function integerPower(value: bigint, exponent: number, ctx: Context): bigint {
  let out = 1n;
  for (let i = 0; i < exponent; i++) out = ctx.multiply(out, value);
  return out;
}
function homogeneousMoment(x: R, y: R, k: R, w: R, a: number, b: number, ctx: Context): Interval {
  // x_world^a*y_world^b*J = Nx^a*Ny^b*K/W^(a+b+2).
  // The unreduced integer ratio is exact. One signed outward division avoids odd-denominator GCD growth.
  const m = a + b + 2;
  const numerator = ctx.multiply(ctx.multiply(integerPower(x.n, a, ctx), integerPower(y.n, b, ctx)), ctx.multiply(k.n, integerPower(w.d, m, ctx)));
  const denominator = ctx.multiply(ctx.multiply(integerPower(x.d, a, ctx), integerPower(y.d, b, ctx)), ctx.multiply(k.d, integerPower(w.n, m, ctx)));
  return ctx.roundRatio(numerator, denominator);
}
function node(t: R, basis: Basis, ctx: Context): readonly Interval[] {
  const key = `${t.n}/${t.d}`, hit = ctx.nodes.get(key); if (hit) return hit;
  if (ctx.nodes.size >= MAX_TILES * (MAX_PANELS + 1)) fail('BUDGET', 'node cache limit exceeded');
  const q = ctx.q, nx = evaluate(basis.x, t, q), ny = evaluate(basis.y, t, q), d = evaluate(basis.d, t, q);
  if (d.n <= 0n) fail('SUPPORT', 'a node denominator is not positive');
  const k = q.sub(q.mul(nx, evaluate(basis.dy, t, q)), q.mul(ny, evaluate(basis.dx, t, q))), intervals: Interval[] = [];
  for (const [a, b] of NODE_POWERS) intervals.push(homogeneousMoment(nx, ny, k, d, a, b, ctx));
  ctx.nodes.set(key, intervals); ctx.check(); return intervals;
}
function simpson(left: R, right: R, panels: number, basis: Basis, ctx: Context): { intervals: Interval[]; remainder: R[] } {
  const q = ctx.q, width = q.sub(right, left), intervals: Interval[] = [];
  for (let i = 0; i < 6; i++) intervals.push({ lo: 0n, hi: 0n });
  for (let i = 0; i <= panels; i++) {
    const t = q.add(left, q.mul(width, q.rat(BigInt(i), BigInt(panels)))), values = node(t, basis, ctx), weight = BigInt(i === 0 || i === panels ? 1 : i % 2 ? 4 : 2);
    for (let k = 0; k < 6; k++) intervals[k] = ctx.addInterval(intervals[k], { lo: ctx.multiply(values[k].lo, weight), hi: ctx.multiply(values[k].hi, weight) });
    ctx.check();
  }
  const factor = q.div(width, q.integer(3 * panels)), remainder: R[] = [], power = rationalPower(width, 5, q), divisor = q.integer(180 * panels ** 4);
  for (let k = 0; k < 6; k++) { intervals[k] = ctx.scale(intervals[k], factor); remainder.push(q.div(q.mul(power, basis.fourth[k]), divisor)); }
  ctx.check(); return { intervals, remainder };
}
function admitSource(input: unknown): Surface {
  const source = record(input, ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']) as unknown as Surface;
  validateSurface(source);
  if (source.degreeU !== 2 || source.degreeV !== 1 || source.controlPoints.length !== 3 || source.controlPoints[0].length !== 2) fail('SUPPORT', 'one degree(2,1) 3x2 Bezier source is required');
  const u = source.knotsU, v = source.knotsV;
  if (u.length !== 6 || v.length !== 4 || u[0] !== u[1] || u[1] !== u[2] || u[3] !== u[4] || u[4] !== u[5] || v[0] !== v[1] || v[2] !== v[3]) fail('SUPPORT', 'single clamped source domains are required');
  const z0 = source.controlPoints[0][0][2], z1 = source.controlPoints[0][1][2];
  if (!(z1 > z0)) fail('SUPPORT', 'positive linear source height is required');
  for (let i = 0; i < 3; i++) {
    if (source.weights[i][0] < 0.7 || source.weights[i][0] > 1 || !Object.is(source.weights[i][0], source.weights[i][1])) fail('SUPPORT', 'source weights must be V-independent within [0.7,1]');
    for (let j = 0; j < 2; j++) for (let axis = 0; axis < 3; axis++) if (Math.abs(source.controlPoints[i][j][axis]) > (axis === 2 ? CadNumericPolicy.coordinateAbs : CadNumericPolicy.coordinateAbs / 2)) fail('SUPPORT', 'source or scale2 output exceeds the modeling range');
    if (!Object.is(source.controlPoints[i][0][0], source.controlPoints[i][1][0]) || !Object.is(source.controlPoints[i][0][1], source.controlPoints[i][1][1]) || !Object.is(source.controlPoints[i][0][2], z0) || !Object.is(source.controlPoints[i][1][2], z1)) fail('SUPPORT', 'an exact XY x linear-Z product source is required');
  }
  return source;
}
function admitRectangles(input: unknown, source: Surface): WrapMomentRectangle[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_TILES) fail('INPUT', 'one to eight explicit UV rectangles are required');
  const out: WrapMomentRectangle[] = [];
  for (const value of input) {
    const data = record(value, ['u', 'v']);
    if (!Array.isArray(data.u) || data.u.length !== 2 || !Array.isArray(data.v) || data.v.length !== 2) fail('INPUT', 'rectangle axes require two endpoints');
    const u = data.u as number[], v = data.v as number[];
    for (const endpoint of [...u, ...v]) if (typeof endpoint !== 'number' || !Number.isFinite(endpoint)) fail('INPUT', 'native rectangle endpoints must be finite numbers');
    if (!(u[1] > u[0] && v[1] > v[0]) || u[0] < source.knotsU[2] || u[1] > source.knotsU[3] || v[0] < source.knotsV[1] || v[1] > source.knotsV[2]) fail('INPUT', 'positive rectangles must lie inside original native domains');
    for (const prior of out) if (u[0] < prior.u[1] && u[1] > prior.u[0] && v[0] < prior.v[1] && v[1] > prior.v[0]) fail('INPUT', 'rectangle interiors must be disjoint');
    out.push({ u: [u[0], u[1]], v: [v[0], v[1]] });
  }
  return out;
}
function normalize(value: number, left: R, width: R, q: SectionRationalContext): R { return q.div(q.sub(q.from(value), left), width); }
function valueReceipt(interval: Interval, radius: bigint, budget: number | undefined, ctx: Context): WrapMomentValue {
  const q = ctx.q, lo = q.rat(ctx.add(interval.lo, -radius), SCALE), hi = q.rat(ctx.add(interval.hi, radius), SCALE), middle = q.rat(ctx.add(interval.lo, interval.hi), 2n * SCALE);
  const estimate = q.nearest(middle), error = q.add(q.div(q.sub(hi, lo), q.integer(2)), q.abs(q.sub(q.from(estimate), middle)));
  if (budget !== undefined && q.compare(error, q.from(budget)) > 0) fail('BUDGET', 'the requested moment error budget was not met');
  const result = { estimate, lower: q.text(lo), upper: q.text(hi), estimateError: q.bound(error), roundingWidth: q.text(q.rat(ctx.add(interval.hi, -interval.lo), SCALE)), remainderRadius: q.text(q.rat(radius, SCALE)) };
  ctx.check(); return result;
}

/** Private added-band moments only. Cell-cover/cylinder/embedding/topology and full source mass remain external. */
export function cylindricalWrapMoments(sourceInput: Surface, rectanglesInput: readonly WrapMomentRectangle[], optionsInput: WrapMomentOptions = {}): CylindricalWrapMoments {
  try {
    const copied = record(ownSnapshot({ source: sourceInput, rectangles: rectanglesInput, options: optionsInput }, false, OWN), ['source', 'rectangles', 'options']);
    const source = admitSource(copied.source), rectangles = admitRectangles(copied.rectangles, source), options = copied.options as Record<string, unknown>;
    if (!options || typeof options !== 'object' || Array.isArray(options)) fail('INPUT', 'own options are required');
    for (const key of Object.keys(options)) if (key !== 'panels' && key !== 'maxOperations' && key !== 'errorBudgets') fail('INPUT', 'unknown moment option');
    const panels = options.panels === undefined ? 8 : options.panels as number, maximumWork = options.maxOperations === undefined ? MAX_WORK : options.maxOperations as number;
    if (!Number.isSafeInteger(panels) || panels < 2 || panels > MAX_PANELS || panels % 2 || !Number.isSafeInteger(maximumWork) || maximumWork < 1 || maximumWork > MAX_WORK) fail('INPUT', 'panels must be even2..32 and work may only tighten the existing limit');
    const budgets = options.errorBudgets as number[] | undefined;
    if (budgets !== undefined) { if (!Array.isArray(budgets) || budgets.length !== 10) fail('INPUT', 'ten absolute raw-moment budgets are required'); for (const budget of budgets) if (!(budget > 0 && Number.isFinite(budget))) fail('INPUT', 'moment budgets must be finite and positive'); }
    const ctx = new Context(maximumWork), q = ctx.q, u0 = q.from(source.knotsU[2]), du = q.sub(q.from(source.knotsU[3]), u0), v0 = q.from(source.knotsV[1]), dv = q.sub(q.from(source.knotsV[2]), v0), finite = q.from(Number.MAX_VALUE);
    if (du.n <= 0n || dv.n <= 0n || q.compare(du, finite) > 0 || q.compare(dv, finite) > 0) fail('INPUT', 'source spans must be positive within finite binary64 range');
    const basis = prepare(source, ctx), z0 = q.from(source.controlPoints[0][0][2]), dz = q.sub(q.from(source.controlPoints[0][1][2]), z0), sums: Interval[] = [], radii: bigint[] = [];
    for (let i = 0; i < 10; i++) { sums.push({ lo: 0n, hi: 0n }); radii.push(0n); }
    for (const rectangle of rectangles) {
      const left = normalize(rectangle.u[0], u0, du, q), right = normalize(rectangle.u[1], u0, du, q), bottom = q.add(z0, q.mul(dz, normalize(rectangle.v[0], v0, dv, q))), top = q.add(z0, q.mul(dz, normalize(rectangle.v[1], v0, dv, q)));
      const integrated = simpson(left, right, panels, basis, ctx);
      for (let i = 0; i < 10; i++) {
        const r = RADIAL_POWER[i], c = Z_POWER[i] + 1, radial = q.rat((1n << BigInt(r)) - 1n, BigInt(r)), height = q.div(q.sub(rationalPower(top, c, q), rationalPower(bottom, c, q)), q.integer(c)), factor = q.mul(radial, height);
        sums[i] = ctx.addInterval(sums[i], ctx.scale(integrated.intervals[XY_INDEX[i]], factor));
        const remainder = ctx.round(q.mul(integrated.remainder[XY_INDEX[i]], q.abs(factor)));
        radii[i] = ctx.add(radii[i], remainder.hi); ctx.check();
      }
    }
    const moments: WrapMomentValue[] = []; for (let i = 0; i < 10; i++) moments.push(valueReceipt(sums[i], radii[i], budgets?.[i], ctx));
    return { source, rectangles, authority: 'original-stored-quarter-parameter-rectangles', method: 'exact-simpson-with-fourth-derivative-bound', order: ORDER, radialScale: 2, panels, fractionBits: 128,
      moments, positiveAddedVolume: sums[0].lo > radii[0], solidQualified: false, counts: { ...q.counts(), directWork: ctx.directWork, totalOperations: q.counts().operations + ctx.directWork, nodes: ctx.nodes.size } };
  } catch (error) { if (isWrapMomentError(error)) throw error; fail('INPUT', 'the supplied source/cells could not be copied and admitted'); }
}
