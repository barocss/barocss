import { kernelRefusal, isFrom, type KernelError } from '../core/barocss-error.js';
import { ownSnapshot, hasExactOwnFields, type OwnSnapshotSpec } from '../core/own-data.js';
import { solidMassFromIntegrals, type MassProperties } from '../brep/solid-mass.js';
import { transferNativeMassBasis } from '../internal/native-si-mass-state.js';
import { CadNumericPolicy } from '../numeric-policy.js';
import { SectionRationalContext, type SectionRational, type SectionFraction } from '../section-rational-internal.js';
import type { Part } from '../part/part-model.js';
import type { Surface } from '../types.js';
import { buildCylindricalWrapUVSource, type CylindricalWrapUVSource } from './cylindrical-wrap-source.js';

type R = SectionRational;
interface Interval { readonly lo: bigint; readonly hi: bigint }
export interface FormalPadRectangle { readonly u: readonly [number, number]; readonly v: readonly [number, number] }
export interface FormalPadBudgets {
  readonly volume: number; readonly mass: number;
  readonly centroid: readonly [number, number, number];
  /** Diagonal xx, yy, zz, then off-diagonal xy, xz, yz. */
  readonly inertia: readonly [number, number, number, number, number, number];
}
export interface FormalPadMassOptions { readonly id: string; readonly density: number; readonly budgets: FormalPadBudgets; readonly maxOperations?: number }
export interface FormalMassInterval { readonly lower: SectionFraction; readonly upper: SectionFraction }
export interface FormalMassScalar extends FormalMassInterval { readonly estimate: number; readonly error: SectionFraction }
export interface CylindricalWrapFormalPadMass {
  readonly source: CylindricalWrapUVSource; readonly rectangle: FormalPadRectangle; readonly options: FormalPadMassOptions;
  readonly authority: 'formal-native-cylinder-union-ideal-scale2-annular-sector';
  readonly method: 'closed-reference-angle-intervals-and-returned-number-audit';
  readonly order: readonly ['V', 'X', 'Y', 'Z', 'XX', 'YY', 'ZZ', 'XY', 'XZ', 'YZ'];
  readonly frame: { readonly zCenter: SectionFraction; readonly coordinates: 'x-y-z-minus-source-midheight' };
  readonly angles: { readonly alpha: FormalMassInterval; readonly beta: FormalMassInterval; readonly width: FormalMassInterval; readonly pi: FormalMassInterval };
  readonly sourceMoments: readonly FormalMassInterval[]; readonly padMoments: readonly FormalMassInterval[];
  readonly moments: readonly FormalMassScalar[]; readonly positiveAddedVolume: true;
  readonly properties: MassProperties;
  readonly audit: { readonly volume: FormalMassScalar; readonly mass: FormalMassScalar; readonly centroid: readonly FormalMassScalar[]; readonly inertia: readonly FormalMassScalar[] };
  /** D297 radial defects for the selected original quarter and its exact factor2 copy, not all source spans. */
  readonly representation: { readonly selectedQuarterRadial: SectionFraction; readonly selectedQuarterOuterRadial: SectionFraction; readonly includedInMassError: false };
  readonly counts: { readonly sourceOperations: number; readonly rationalOperations: number; readonly directOperations: number; readonly totalOperations: number; readonly gcdSteps: number; readonly maximumBits: number; readonly work: number };
  readonly limits: { readonly operations: 200000; readonly integerBits: 8192; readonly work: 1048576; readonly fractionBits: 128; readonly atanTerms: 24; readonly ratioReductions: 3 };
  readonly meaning: { readonly actualEndpointRays: true; readonly originalSourceUnchanged: true; readonly literalStoredBrepMass: false; readonly wrappedSolid: false; readonly nativeBinding: false; readonly surfaceArea: false; readonly partMassProvider: false; readonly nativeSIAccuracy: false };
  readonly solidQualified: false;
}
export type FormalPadMassCode = 'INPUT' | 'SUPPORT' | 'BUDGET' | 'REPRESENTABILITY';
export type FormalPadMassError = KernelError & { readonly code: FormalPadMassCode };
const SOURCE = 'cylindrical-wrap-formal-mass';
const SCALE = 1n << 128n;
// Exact represented powers of two; the fast path never changes interval precision.
const MIDPOINT_DENOMINATOR = Number(SCALE << 1n);
const MIDPOINT_MINIMUM = 1 / MIDPOINT_DENOMINATOR;
const MIDPOINT_MAXIMUM = Number(1n << 127n);
const ORDER = Object.freeze(['V', 'X', 'Y', 'Z', 'XX', 'YY', 'ZZ', 'XY', 'XZ', 'YZ'] as const);
const LIMITS = Object.freeze({ operations: 200000, integerBits: 8192, work: 1048576, fractionBits: 128, atanTerms: 24, ratioReductions: 3 } as const);
function fail(code: FormalPadMassCode, detail: string): never { throw kernelRefusal(SOURCE, code, `Formal pad mass: ${detail}`) as FormalPadMassError; }
export function isFormalPadMassError(error: unknown): error is FormalPadMassError { try { return isFrom<FormalPadMassCode>(error, SOURCE); } catch { return false; } }
function wrap(code: FormalPadMassCode, detail: string): never { return fail(code, detail); }
function exactFailure(code: 'BUDGET' | 'REPRESENTABILITY', detail: string): never { return fail(code, detail); }
const OWN: OwnSnapshotSpec<FormalPadMassCode> = { input: 'INPUT', owned: 'INPUT', budget: 'BUDGET', fail, wrap, isRefusal: isFormalPadMassError };

class Context {
  readonly q = new SectionRationalContext(exactFailure);
  direct = 0; structural = 0; maximumBits = 0;
  sourceOperations = 0; sourceGcd = 0; totalImportedSourceWork = 0; sourceBits = 0;
  constructor(readonly maximum: number) {}
  importSource(source: CylindricalWrapUVSource): void {
    const c = source.carrier.counts;
    this.sourceOperations = c.rational.operations + c.integerOperations;
    this.sourceGcd = c.rational.gcdSteps;
    // Carrier work already includes its direct integer work. Normalize its separate
    // rational ledger once, without adding integerOperations a second time here.
    this.totalImportedSourceWork = c.work + c.rational.operations + c.rational.gcdSteps + c.rational.floatSearchSteps;
    this.sourceBits = Math.max(c.rational.maximumObservedBits, c.integerMaximumBits); this.check();
  }
  totalWork(): number {
    const c = this.q.counts();
    return this.totalImportedSourceWork + this.structural + c.operations + c.gcdSteps + c.floatSearchSteps + this.direct;
  }
  check(): void {
    const c = this.q.counts(), total = this.sourceOperations + c.operations + this.direct;
    if (total > this.maximum || this.sourceGcd + c.gcdSteps > LIMITS.operations || this.totalWork() > LIMITS.work) fail('BUDGET', 'the aggregate source, rational, direct, or work limit was exceeded');
  }
  charge(amount = 1): void { this.structural += amount; this.check(); }
  integer(value: bigint): bigint {
    this.direct++; const bits = (value < 0n ? -value : value).toString(2).length;
    if (bits > LIMITS.integerBits) fail('BUDGET', 'an exact direct integer exceeded 8192 bits');
    this.maximumBits = Math.max(this.maximumBits, bits); this.check(); return value;
  }
  addInteger(a: bigint, b: bigint): bigint { return this.integer(a + b); }
  mulInteger(a: bigint, b: bigint): bigint { return this.integer(a * b); }
  floor(n: bigint, d: bigint): bigint {
    if (d <= 0n) fail('REPRESENTABILITY', 'positive exact interval denominators are required');
    const value = this.integer(n / d), remainder = this.integer(n % d);
    return n < 0n && remainder !== 0n ? this.addInteger(value, -1n) : value;
  }
  ceil(n: bigint, d: bigint): bigint { return this.integer(-this.floor(this.integer(-n), d)); }
  rat(n: bigint, d = 1n): R { const r = this.q.rat(n, d); this.check(); return r; }
  from(value: number): R { const r = this.q.from(value); this.check(); return r; }
  add(a: R, b: R): R { const r = this.q.add(a, b); this.check(); return r; }
  sub(a: R, b: R): R { const r = this.q.sub(a, b); this.check(); return r; }
  mul(a: R, b: R): R { const r = this.q.mul(a, b); this.check(); return r; }
  div(a: R, b: R): R { const r = this.q.div(a, b); this.check(); return r; }
  compare(a: R, b: R): number { const r = this.q.compare(a, b); this.check(); return r; }
  nearest(value: R): number { const r = this.q.nearest(value); this.check(); return r; }
  text(value: R): SectionFraction { const r = this.q.text(value); this.check(); return r; }
  round(value: R): Interval { const n = this.mulInteger(value.n, SCALE); return { lo: this.floor(n, value.d), hi: this.ceil(n, value.d) }; }
}
function exactRecord(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !hasExactOwnFields(value as Record<string, unknown>, fields)) fail('INPUT', 'exact plain own fields are required');
  return value as Record<string, unknown>;
}
function positive(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value) || !(value > 0)) fail('INPUT', 'positive finite density and absolute budgets are required'); return value; }
function numbers(value: unknown, count: number, positiveOnly: boolean): number[] {
  if (!Array.isArray(value) || value.length !== count) fail('INPUT', 'the exact number of scalar values is required');
  const out: number[] = [];
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isFinite(item) || positiveOnly && !(item > 0)) fail('INPUT', 'finite scalar values and positive budgets are required');
    out.push(item);
  }
  return out;
}
function optionsSnapshot(value: FormalPadMassOptions): FormalPadMassOptions {
  const copy = ownSnapshot(value, false, OWN) as Record<string, unknown>;
  if (!copy || typeof copy !== 'object' || Array.isArray(copy)) fail('INPUT', 'plain own mass options are required');
  const fields = Object.hasOwn(copy, 'maxOperations') ? ['id', 'density', 'budgets', 'maxOperations'] : ['id', 'density', 'budgets'];
  exactRecord(copy, fields);
  if (typeof copy.id !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,31}$/.test(copy.id)) fail('INPUT', 'a bounded native extraction id is required');
  positive(copy.density);
  // The retained native SI basis uses this existing Number intermediate before scaling.
  if (!Number.isFinite((copy.density as number) * 1000)) fail('SUPPORT', 'the existing native SI density intermediate must remain finite');
  const b = exactRecord(copy.budgets, ['volume', 'mass', 'centroid', 'inertia']);
  positive(b.volume); positive(b.mass); numbers(b.centroid, 3, true); numbers(b.inertia, 6, true);
  if (Object.hasOwn(copy, 'maxOperations') && !(typeof copy.maxOperations === 'number' && Number.isSafeInteger(copy.maxOperations) && copy.maxOperations >= 1 && copy.maxOperations <= LIMITS.operations)) fail('INPUT', 'maxOperations may only tighten 200000');
  return copy as unknown as FormalPadMassOptions;
}
function rectangleSnapshot(value: FormalPadRectangle): FormalPadRectangle {
  const copy = exactRecord(ownSnapshot(value, false, OWN), ['u', 'v']); numbers(copy.u, 2, false); numbers(copy.v, 2, false); return copy as unknown as FormalPadRectangle;
}
/** Charge bounded owned data; this is structural work, not an exact-geometry predicate. */
function countData(value: unknown, ctx: Context): void {
  ctx.charge();
  if (value !== null && typeof value === 'object') for (const key of Object.keys(value)) { ctx.charge(); countData((value as Record<string, unknown>)[key], ctx); }
}
function freezeData(value: unknown, ctx: Context): void {
  ctx.charge();
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.keys(value)) freezeData((value as Record<string, unknown>)[key], ctx);
    Object.freeze(value);
  }
}
function point(value: bigint): Interval { return { lo: value, hi: value }; }
function plus(a: Interval, b: Interval, ctx: Context): Interval { return { lo: ctx.addInteger(a.lo, b.lo), hi: ctx.addInteger(a.hi, b.hi) }; }
function minus(a: Interval, b: Interval, ctx: Context): Interval { return { lo: ctx.addInteger(a.lo, -b.hi), hi: ctx.addInteger(a.hi, -b.lo) }; }
function times(a: Interval, b: Interval, ctx: Context): Interval {
  const products = [ctx.mulInteger(a.lo, b.lo), ctx.mulInteger(a.lo, b.hi), ctx.mulInteger(a.hi, b.lo), ctx.mulInteger(a.hi, b.hi)];
  let lo = products[0], hi = products[0];
  for (const value of products) { ctx.charge(); if (value < lo) lo = value; if (value > hi) hi = value; }
  return { lo: ctx.floor(lo, SCALE), hi: ctx.ceil(hi, SCALE) };
}
function quotient(a: Interval, b: Interval, ctx: Context): Interval {
  if (b.lo <= 0n) fail('REPRESENTABILITY', 'a positive interval denominator lower bound is required');
  const numerators = [ctx.mulInteger(a.lo, SCALE), ctx.mulInteger(a.hi, SCALE)], denominators = [b.lo, b.hi];
  let lo: bigint | undefined, hi: bigint | undefined;
  for (const n of numerators) for (const d of denominators) {
    const lower = ctx.floor(n, d), upper = ctx.ceil(n, d);
    if (lo === undefined || lower < lo) lo = lower;
    if (hi === undefined || upper > hi) hi = upper;
  }
  return { lo: lo!, hi: hi! };
}
function scale(a: Interval, b: R, ctx: Context): Interval {
  const left = b.n < 0n ? a.hi : a.lo, right = b.n < 0n ? a.lo : a.hi;
  return { lo: ctx.floor(ctx.mulInteger(left, b.n), b.d), hi: ctx.ceil(ctx.mulInteger(right, b.n), b.d) };
}
function square(a: Interval, ctx: Context): Interval {
  const aa = ctx.mulInteger(a.lo, a.lo), bb = ctx.mulInteger(a.hi, a.hi);
  return { lo: a.lo <= 0n && a.hi >= 0n ? 0n : ctx.floor(aa < bb ? aa : bb, SCALE), hi: ctx.ceil(aa > bb ? aa : bb, SCALE) };
}
function power(value: R, exponent: number, ctx: Context): R { let out = ctx.rat(1n); for (let i = 0; i < exponent; i++) out = ctx.mul(out, value); return out; }
function intervalReceipt(value: Interval, ctx: Context): FormalMassInterval { return { lower: ctx.text(ctx.rat(value.lo, SCALE)), upper: ctx.text(ctx.rat(value.hi, SCALE)) }; }
function distance(value: number, interval: Interval, ctx: Context): R {
  if (!Number.isFinite(value)) fail('REPRESENTABILITY', 'public mass properties must be finite');
  const represented = ctx.from(value), left = ctx.sub(represented, ctx.rat(interval.lo, SCALE)), right = ctx.sub(represented, ctx.rat(interval.hi, SCALE));
  const a = left.n < 0n ? ctx.rat(-left.n, left.d) : left, b = right.n < 0n ? ctx.rat(-right.n, right.d) : right;
  return ctx.compare(a, b) > 0 ? a : b;
}
function audit(value: number, target: Interval, budget: number | undefined, ctx: Context): FormalMassScalar {
  const error = distance(value, target, ctx);
  if (budget !== undefined && ctx.compare(error, ctx.from(budget)) > 0) fail('REPRESENTABILITY', 'an absolute public mass-property budget was exceeded');
  return { estimate: value, ...intervalReceipt(target, ctx), error: ctx.text(error) };
}
function midpointDirect(ctx: Context, amount: number): void { ctx.direct += amount; ctx.check(); }
/**
 * For 0<abs(n)<2^256 and d=2^129, Number(n)/d stays normal and finite.
 * Exact power-of-two scaling preserves the nearest/ties-to-even rounding lattice.
 * Only the ten raw fixed128 interval midpoints use this path; zCenter stays generic.
 */
function midpoint(value: Interval, ctx: Context): number {
  const numerator = ctx.addInteger(value.lo, value.hi);
  midpointDirect(ctx, 1);
  if (numerator === 0n) return 0;
  midpointDirect(ctx, 1);
  const negative = numerator < 0n, magnitude = ctx.integer(negative ? -numerator : numerator);
  const high = ctx.integer(magnitude >> 256n);
  midpointDirect(ctx, 1);
  if (high !== 0n) fail('REPRESENTABILITY', 'the raw midpoint numerator exceeds the proved 256-bit conversion range');
  const result = Number(numerator) / MIDPOINT_DENOMINATOR;
  midpointDirect(ctx, 2);
  const absolute = Math.abs(result); midpointDirect(ctx, 1);
  midpointDirect(ctx, 3);
  if (!Number.isFinite(result) || absolute < MIDPOINT_MINIMUM || absolute > MIDPOINT_MAXIMUM) fail('REPRESENTABILITY', 'the raw midpoint conversion must remain in its proved finite normal range');
  return result;
}

/** Exact24 alternating terms plus a positive x^49/49 remainder, with signed outward rounding. */
function atanSmall(value: R, ctx: Context): Interval {
  if (value.n < 0n || ctx.compare(value, ctx.rat(1n, 5n)) > 0) fail('SUPPORT', 'the angle series requires an exact argument in [0,1/5]');
  if (value.n === 0n) return point(0n);
  const x = ctx.round(value), x2 = times(x, x, ctx); let term = x, sum = point(0n);
  for (let k = 0; k < LIMITS.atanTerms; k++) {
    const fraction = scale(term, ctx.rat(1n, BigInt(2 * k + 1)), ctx);
    sum = k % 2 === 0 ? plus(sum, fraction, ctx) : minus(sum, fraction, ctx); term = times(term, x2, ctx);
  }
  const remainder = scale(term, ctx.rat(1n, 49n), ctx);
  return { lo: sum.lo < 0n ? 0n : sum.lo, hi: ctx.addInteger(sum.hi, remainder.hi) };
}
interface Angles { readonly fifth: Interval; readonly piHalf: Interval; readonly pi: Interval }
function angleConstants(ctx: Context): Angles {
  const fifth = atanSmall(ctx.rat(1n, 5n), ctx), small = atanSmall(ctx.rat(1n, 239n), ctx);
  const piHalf = minus(scale(fifth, ctx.rat(8n), ctx), scale(small, ctx.rat(2n), ctx), ctx);
  if (piHalf.lo <= 0n) fail('REPRESENTABILITY', 'a positive pi interval is required');
  return { fifth, piHalf, pi: scale(piHalf, ctx.rat(2n), ctx) };
}
function atanRatio(value: R, constants: Angles, ctx: Context): Interval {
  const one = ctx.rat(1n), fifth = ctx.rat(1n, 5n);
  if (value.n < 0n || ctx.compare(value, one) > 0) fail('SUPPORT', 'an exact first-quadrant ratio in [0,1] is required');
  let reduced = value, count = 0;
  while (ctx.compare(reduced, fifth) > 0) {
    if (++count > LIMITS.ratioReductions) fail('BUDGET', 'the exact angle ratio exceeded three reductions');
    reduced = ctx.div(ctx.sub(reduced, fifth), ctx.add(one, ctx.mul(reduced, fifth)));
  }
  return plus(scale(constants.fifth, ctx.rat(BigInt(count)), ctx), atanSmall(reduced, ctx), ctx);
}
function angle(x: R, y: R, constants: Angles, ctx: Context): Interval {
  if (x.n < 0n || y.n < 0n || x.n === 0n && y.n === 0n) fail('SUPPORT', 'actual first-quadrant nonzero endpoint rays are required');
  if (x.n === 0n) return constants.piHalf;
  if (y.n === 0n) return point(0n);
  return ctx.compare(x, y) >= 0 ? atanRatio(ctx.div(y, x), constants, ctx) : minus(constants.piHalf, atanRatio(ctx.div(x, y), constants, ctx), ctx);
}
function integerSqrt(value: bigint, ctx: Context): bigint {
  if (value < 0n) fail('REPRESENTABILITY', 'a square-root radicand must be nonnegative');
  if (value === 0n) return 0n;
  const bits = value.toString(2).length; ctx.charge(); let root = ctx.integer(1n << BigInt(Math.ceil(bits / 2)));
  for (let i = 0; i < LIMITS.integerBits; i++) {
    const next = ctx.integer(ctx.addInteger(root, ctx.integer(value / root)) >> 1n);
    if (next >= root) {
      const squareRoot = ctx.mulInteger(root, root), upper = ctx.addInteger(root, 1n);
      if (squareRoot > value || ctx.mulInteger(upper, upper) <= value) fail('REPRESENTABILITY', 'integer square-root guards failed');
      return root;
    }
    root = next;
  }
  return fail('BUDGET', 'the integer square-root iteration cap was exceeded');
}
interface Endpoint { readonly x: R; readonly y: R; readonly angle: Interval; readonly cosine: Interval; readonly sine: Interval }
function evaluate(values: readonly R[], share: R, ctx: Context): R {
  const other = ctx.sub(ctx.rat(1n), share); let row = [...values];
  while (row.length > 1) { const next: R[] = []; for (let i = 0; i + 1 < row.length; i++) next.push(ctx.add(ctx.mul(row[i], other), ctx.mul(row[i + 1], share))); row = next; }
  return row[0];
}
function endpoint(surface: Surface, u: number, constants: Angles, ctx: Context): Endpoint {
  const a = ctx.from(surface.knotsU[2]), span = ctx.sub(ctx.from(surface.knotsU[3]), a), t = ctx.div(ctx.sub(ctx.from(u), a), span);
  const xs: R[] = [], ys: R[] = [];
  for (let i = 0; i < 3; i++) { const w = ctx.from(surface.weights[i][0]); xs.push(ctx.mul(ctx.from(surface.controlPoints[i][0][0]), w)); ys.push(ctx.mul(ctx.from(surface.controlPoints[i][0][1]), w)); }
  const x = evaluate(xs, t, ctx), y = evaluate(ys, t, ctx);
  if (x.n <= 0n || y.n <= 0n) fail('SUPPORT', 'strictly interior positive endpoint rays are required');
  const ix = ctx.mulInteger(x.n, y.d), iy = ctx.mulInteger(y.n, x.d), norm = ctx.addInteger(ctx.mulInteger(ix, ix), ctx.mulInteger(iy, iy));
  const scaledNorm = ctx.mulInteger(ctx.mulInteger(norm, SCALE), SCALE), lower = integerSqrt(scaledNorm, ctx);
  if (lower <= 0n) fail('REPRESENTABILITY', 'endpoint direction normalization lost its positive lower bound');
  const upper = ctx.mulInteger(lower, lower) === scaledNorm ? lower : ctx.addInteger(lower, 1n);
  const nx = ctx.mulInteger(ctx.mulInteger(ix, SCALE), SCALE), ny = ctx.mulInteger(ctx.mulInteger(iy, SCALE), SCALE);
  return { x, y, angle: angle(x, y, constants, ctx), cosine: { lo: ctx.floor(nx, upper), hi: ctx.ceil(nx, lower) }, sine: { lo: ctx.floor(ny, upper), hi: ctx.ceil(ny, lower) } };
}
function axial(surface: Surface, v: number, ctx: Context): R {
  const lower = ctx.from(surface.knotsV[1]), span = ctx.sub(ctx.from(surface.knotsV[2]), lower), share = ctx.div(ctx.sub(ctx.from(v), lower), span);
  const z0 = ctx.from(surface.controlPoints[0][0][2]), dz = ctx.sub(ctx.from(surface.controlPoints[0][1][2]), z0); return ctx.add(z0, ctx.mul(share, dz));
}
function sourceChecks(source: CylindricalWrapUVSource, rectangle: FormalPadRectangle, ctx: Context): void {
  const s = source.quarter, r = ctx.from(source.radius), limit = ctx.from(CadNumericPolicy.coordinateAbs);
  if (r.n <= 0n || ctx.compare(ctx.mul(r, ctx.rat(2n)), limit) > 0) fail('SUPPORT', 'source and twice-source radii must remain in the native coordinate range');
  if (s.degreeU !== 2 || s.degreeV !== 1 || s.controlPoints.length !== 3 || s.weights.length !== 3 || s.knotsU.length !== 6 || s.knotsV.length !== 4) fail('SUPPORT', 'one native quadratic by linear quarter is required');
  for (let i = 0; i < 3; i++) {
    const p = s.controlPoints[i], w = s.weights[i];
    if (p.length !== 2 || w.length !== 2 || !(w[0] > 0) || !Object.is(w[0], w[1]) || !Object.is(p[0][0], p[1][0]) || !Object.is(p[0][1], p[1][1]) || !Object.is(p[0][2], source.z[0]) || !Object.is(p[1][2], source.z[1])) fail('SUPPORT', 'actual XY and weights must be V-independent with common affine source Z');
    ctx.charge();
  }
  if (!(rectangle.u[0] > s.knotsU[2] && rectangle.u[1] < s.knotsU[3] && rectangle.u[1] > rectangle.u[0] && rectangle.v[0] > s.knotsV[1] && rectangle.v[1] < s.knotsV[2] && rectangle.v[1] > rectangle.v[0])) fail('INPUT', 'one strict interior original-UV rectangle is required');
}
interface MomentData { readonly source: Interval[]; readonly pad: Interval[]; readonly total: Interval[]; readonly zCenter: R; readonly first: Endpoint; readonly last: Endpoint; readonly width: Interval; readonly pi: Interval }
function moments(source: CylindricalWrapUVSource, rectangle: FormalPadRectangle, ctx: Context): MomentData {
  const constants = angleConstants(ctx), first = endpoint(source.quarter, rectangle.u[0], constants, ctx), last = endpoint(source.quarter, rectangle.u[1], constants, ctx);
  // Exact orientation and an outward positive width both hold before the closed forms are used.
  if (ctx.compare(ctx.mul(first.x, last.y), ctx.mul(first.y, last.x)) <= 0) fail('REPRESENTABILITY', 'endpoint rays do not have strict positive angular order');
  const width = minus(last.angle, first.angle, ctx); if (width.lo <= 0n) fail('REPRESENTABILITY', 'the positive angle width is unresolved at fixed precision');
  const r = ctx.from(source.radius), r2 = power(r, 2, ctx), r3 = ctx.mul(r2, r), r4 = ctx.mul(r2, r2);
  const z0 = ctx.from(source.z[0]), z1 = ctx.from(source.z[1]), height = ctx.sub(z1, z0), zCenter = ctx.div(ctx.add(z0, z1), ctx.rat(2n));
  const zL = axial(source.quarter, rectangle.v[0], ctx), zU = axial(source.quarter, rectangle.v[1], ctx), h = ctx.sub(zU, zL), zBar = ctx.sub(ctx.div(ctx.add(zL, zU), ctx.rat(2n)), zCenter);
  if (height.n <= 0n || h.n <= 0n) fail('SUPPORT', 'strict positive exact source and pad axial heights are required');
  const l = [h, ctx.mul(h, zBar), ctx.mul(h, ctx.add(ctx.mul(zBar, zBar), ctx.div(ctx.mul(h, h), ctx.rat(12n))))];
  const sin2First = scale(times(first.sine, first.cosine, ctx), ctx.rat(2n), ctx), sin2Last = scale(times(last.sine, last.cosine, ctx), ctx.rat(2n), ctx);
  const correction = scale(minus(sin2Last, sin2First, ctx), ctx.rat(1n, 4n), ctx), half = scale(width, ctx.rat(1n, 2n), ctx);
  const angular = [width, minus(last.sine, first.sine, ctx), minus(first.cosine, last.cosine, ctx), plus(half, correction, ctx), minus(half, correction, ctx), scale(minus(square(last.sine, ctx), square(first.sine, ctx), ctx), ctx.rat(1n, 2n), ctx)];
  const radial = [ctx.mul(ctx.rat(3n, 2n), r2), ctx.mul(ctx.rat(7n, 3n), r3), ctx.mul(ctx.rat(15n, 4n), r4)];
  const ai = [0, 1, 2, 0, 3, 4, 0, 5, 1, 2], ri = [0, 1, 1, 0, 2, 2, 0, 2, 1, 1], zi = [0, 0, 0, 1, 0, 0, 2, 0, 1, 1], pad: Interval[] = [];
  for (let i = 0; i < 10; i++) pad.push(scale(angular[ai[i]], ctx.mul(radial[ri[i]], l[zi[i]]), ctx));
  if (pad[0].lo <= 0n) fail('REPRESENTABILITY', 'positive added formal volume was not resolved');
  const base: Interval[] = [];
  for (let i = 0; i < 10; i++) base.push(point(0n));
  base[0] = scale(constants.pi, ctx.mul(r2, height), ctx);
  base[4] = scale(constants.pi, ctx.div(ctx.mul(r4, height), ctx.rat(4n)), ctx); base[5] = base[4];
  base[6] = scale(constants.pi, ctx.div(ctx.mul(r2, power(height, 3, ctx)), ctx.rat(12n)), ctx);
  const total: Interval[] = []; for (let i = 0; i < 10; i++) total.push(plus(base[i], pad[i], ctx));
  return { source: base, pad, total, zCenter, first, last, width, pi: constants.pi };
}
function publicProperties(data: MomentData, density: number, ctx: Context): { properties: MassProperties; centroid: Interval[]; inertia: Interval[]; mass: Interval; estimates: number[] } {
  const I = data.total, estimates: number[] = [];
  for (const value of I) estimates.push(midpoint(value, ctx));
  if (!(estimates[0] > 0)) fail('REPRESENTABILITY', 'the public volume estimate is not positive');
  // Fixed-size public arithmetic and basis bookkeeping are work, not exact-operation credits.
  ctx.charge(256);
  const local = solidMassFromIntegrals(estimates, density, 'closed-form'), shift = ctx.nearest(data.zCenter);
  const worldZ = local.centroid[2] + shift;
  const properties: MassProperties = { ...local, centroid: [local.centroid[0], local.centroid[1], worldZ] };
  transferNativeMassBasis(local, properties);
  const center = [quotient(I[1], I[0], ctx), quotient(I[2], I[0], ctx), quotient(I[3], I[0], ctx)];
  const centroid = [center[0], center[1], plus(center[2], ctx.round(data.zCenter), ctx)];
  const qxx = minus(I[4], quotient(square(I[1], ctx), I[0], ctx), ctx), qyy = minus(I[5], quotient(square(I[2], ctx), I[0], ctx), ctx), qzz = minus(I[6], quotient(square(I[3], ctx), I[0], ctx), ctx);
  const qxy = minus(I[7], quotient(times(I[1], I[2], ctx), I[0], ctx), ctx), qxz = minus(I[8], quotient(times(I[1], I[3], ctx), I[0], ctx), ctx), qyz = minus(I[9], quotient(times(I[2], I[3], ctx), I[0], ctx), ctx);
  const factor = ctx.div(ctx.from(density), ctx.rat(1000n));
  const inertia = [scale(plus(qyy, qzz, ctx), factor, ctx), scale(plus(qxx, qzz, ctx), factor, ctx), scale(plus(qxx, qyy, ctx), factor, ctx), scale(qxy, ctx.mul(factor, ctx.rat(-1n)), ctx), scale(qxz, ctx.mul(factor, ctx.rat(-1n)), ctx), scale(qyz, ctx.mul(factor, ctx.rat(-1n)), ctx)];
  const mass = scale(I[0], factor, ctx);
  if (!(properties.mass > 0) || !Number.isFinite(properties.mass)) fail('REPRESENTABILITY', 'positive finite public mass is required without underflow');
  for (let i = 0; i < 3; i++) if (!(properties.inertia[i][i] > 0) || !Number.isFinite(properties.inertia[i][i])) fail('REPRESENTABILITY', 'positive finite diagonal inertia is required without underflow');
  return { properties, centroid, inertia, mass, estimates };
}
/** Formal reference mathematics only. This function does not construct or qualify a wrapped physical solid. */
export function certifyCylindricalWrapFormalPadMass(part: Part, rectangleInput: FormalPadRectangle, optionsInput: FormalPadMassOptions): CylindricalWrapFormalPadMass {
  const options = optionsSnapshot(optionsInput), rectangle = rectangleSnapshot(rectangleInput), ctx = new Context(options.maxOperations ?? LIMITS.operations);
  countData(options, ctx); countData(rectangle, ctx);
  // Source has no caller-supplied radius/certificate and no maxOperations option. Its actual reported cost is imported, never reset.
  const source = buildCylindricalWrapUVSource(part, { id: options.id }); ctx.importSource(source); countData(source, ctx);
  sourceChecks(source, rectangle, ctx);
  const data = moments(source, rectangle, ctx), converted = publicProperties(data, options.density, ctx), properties = converted.properties;
  const volume = audit(properties.volume, data.total[0], options.budgets.volume, ctx), mass = audit(properties.mass, converted.mass, options.budgets.mass, ctx);
  const centroid: FormalMassScalar[] = [], inertia: FormalMassScalar[] = [], raw: FormalMassScalar[] = [], base: FormalMassInterval[] = [], pad: FormalMassInterval[] = [];
  const components = [properties.inertia[0][0], properties.inertia[1][1], properties.inertia[2][2], properties.inertia[0][1], properties.inertia[0][2], properties.inertia[1][2]];
  for (let i = 0; i < 3; i++) centroid.push(audit(properties.centroid[i], converted.centroid[i], options.budgets.centroid[i], ctx));
  for (let i = 0; i < 6; i++) inertia.push(audit(components[i], converted.inertia[i], options.budgets.inertia[i], ctx));
  for (let i = 0; i < 10; i++) { raw.push(audit(converted.estimates[i], data.total[i], undefined, ctx)); base.push(intervalReceipt(data.source[i], ctx)); pad.push(intervalReceipt(data.pad[i], ctx)); }
  const radial = source.carrier.bounds.radial.exact, delta = ctx.rat(BigInt(radial.numerator), BigInt(radial.denominator));
  const result = { source, rectangle, options, authority: 'formal-native-cylinder-union-ideal-scale2-annular-sector', method: 'closed-reference-angle-intervals-and-returned-number-audit', order: ORDER,
    frame: { zCenter: ctx.text(data.zCenter), coordinates: 'x-y-z-minus-source-midheight' }, angles: { alpha: intervalReceipt(data.first.angle, ctx), beta: intervalReceipt(data.last.angle, ctx), width: intervalReceipt(data.width, ctx), pi: intervalReceipt(data.pi, ctx) },
    sourceMoments: base, padMoments: pad, moments: raw, positiveAddedVolume: true, properties, audit: { volume, mass, centroid, inertia },
    representation: { selectedQuarterRadial: ctx.text(delta), selectedQuarterOuterRadial: ctx.text(ctx.mul(delta, ctx.rat(2n))), includedInMassError: false },
    limits: LIMITS, meaning: { actualEndpointRays: true, originalSourceUnchanged: true, literalStoredBrepMass: false, wrappedSolid: false, nativeBinding: false, surfaceArea: false, partMassProvider: false, nativeSIAccuracy: false }, solidQualified: false };
  freezeData(result, ctx); ctx.charge(16); ctx.check(); const q = ctx.q.counts();
  const counts = { sourceOperations: ctx.sourceOperations, rationalOperations: q.operations, directOperations: ctx.direct, totalOperations: ctx.sourceOperations + q.operations + ctx.direct, gcdSteps: ctx.sourceGcd + q.gcdSteps, maximumBits: Math.max(ctx.sourceBits, ctx.maximumBits, q.maximumObservedBits), work: ctx.totalWork() };
  Object.freeze(counts);
  return Object.freeze({ ...result, counts }) as CylindricalWrapFormalPadMass;
}
