import { validateCurve } from '../core/math.js';
import { kernelRefusal, isFrom, type KernelError } from '../core/barocss-error.js';
import { ownSnapshot, hasExactOwnFields, type OwnSnapshotSpec } from '../core/own-data.js';
import { CadNumericPolicy, linearToleranceMM } from '../numeric-policy.js';
import { SectionRationalContext, type SectionFraction, type SectionRational } from '../section-rational-internal.js';
import type { Curve } from '../types.js';

export type CylindricalWrapMapCode = 'INPUT' | 'SUPPORT' | 'BUDGET' | 'REPRESENTABILITY';
export type CylindricalWrapMapError = KernelError & { readonly code: CylindricalWrapMapCode };
export interface CylindricalWrapMapOptions {
  readonly radius: number;
  /** Maximum nominal R*theta error. Source radial/actual-arclength errors are reported separately. */
  readonly tolerance: number;
}
export interface WrapMapBound { readonly exact: SectionFraction; readonly upper: number }
export interface WrapMapNode {
  /** Exact dyadic share of the original full span, not a newly restricted derivative parameter. */
  readonly share: number;
  readonly u: number;
  readonly s: number;
  readonly angle: { readonly lower: SectionFraction; readonly upper: SectionFraction };
  readonly error: SectionFraction;
}
export interface WrapMapInterval {
  readonly first: number;
  readonly last: number;
  readonly interpolation: SectionFraction;
  readonly error: SectionFraction;
}
export interface CylindricalWrapMap {
  readonly source: Curve;
  readonly options: CylindricalWrapMapOptions;
  readonly domain: readonly [number, number];
  readonly chartDomain: readonly [number, number];
  readonly nodes: readonly WrapMapNode[];
  readonly intervals: readonly WrapMapInterval[];
  readonly bounds: {
    readonly nominal: WrapMapBound;
    readonly radial: WrapMapBound;
    readonly arclengthDrift: WrapMapBound;
    readonly basePosition: WrapMapBound;
    readonly actualLengthResidual: WrapMapBound;
    readonly secondDerivative: WrapMapBound;
  };
  readonly proof: {
    readonly denominator: readonly SectionFraction[];
    readonly squaredRadiusNumerator: readonly SectionFraction[];
    readonly angularNumerator: readonly SectionFraction[];
    readonly circleResidual: readonly SectionFraction[];
    readonly secondNumerator: readonly SectionFraction[];
    readonly denominatorMinimum: SectionFraction;
    readonly squaredRadiusMinimum: SectionFraction;
    readonly angularMinimum: SectionFraction;
    readonly radialDerivative: SectionFraction;
    readonly piHalf: { readonly lower: SectionFraction; readonly upper: SectionFraction };
  };
  readonly counts: {
    readonly rational: ReturnType<SectionRationalContext['counts']>;
    readonly integerOperations: number;
    readonly integerMaximumBits: number;
    readonly work: number;
  };
  readonly limits: { readonly intervals: 256; readonly depth: 8; readonly taylorTerms: 24; readonly intervalBits: 128; readonly work: 1048576; readonly rationalOperations: 200000; readonly rationalGcdSteps: 200000; readonly rationalIntegerBits: 8192; readonly fractionCharacters: 5000; readonly floatSearchStepsPerConversion: 64 };
  readonly meaning: {
    readonly chart: 'nominal-radius-times-original-carrier-angle';
    readonly parameter: 'piecewise-affine-inverse-of-stored-nodes';
    readonly derivatives: 'normalized-original-full-span';
    readonly source: 'copied-original-binary64-poles-weights-and-knots';
    readonly guarantee: 'analytic-whole-interval-bound-not-sample-fit';
    readonly family: 'quantified-near-quarter-caller-retains-native-provenance';
    readonly evaluation: 'exact-affine-certificate-no-number-interpolation-bound';
    readonly outerThickness: 'future-homothety-has-error-at-most-height-times-radial-bound-over-radius';
    readonly composition: false;
    readonly surfaceBinding: false;
    readonly trim: false;
    readonly solid: false;
    readonly globalNativeEvaluationError: false;
  };
}

export interface CylindricalWrapCarrierOptions { readonly radius: number }
/** Original-coefficient certificate only. No nominal chart, arclength nodes or inverse is constructed. */
export interface CylindricalWrapCarrierCertificate {
  readonly source: Curve;
  readonly options: CylindricalWrapCarrierOptions;
  readonly domain: readonly [number, number];
  readonly bounds: { readonly radial: WrapMapBound };
  readonly proof: Pick<CylindricalWrapMap['proof'], 'denominator' | 'squaredRadiusNumerator' | 'angularNumerator' | 'circleResidual' | 'denominatorMinimum' | 'squaredRadiusMinimum' | 'angularMinimum'>;
  readonly counts: CylindricalWrapMap['counts'];
  readonly limits: Pick<CylindricalWrapMap['limits'], 'work' | 'rationalOperations' | 'rationalGcdSteps' | 'rationalIntegerBits' | 'fractionCharacters' | 'floatSearchStepsPerConversion'>;
  readonly meaning: {
    readonly guarantee: 'analytic-original-carrier-coefficients-only';
    readonly parameter: 'original-native-domain-no-inverse-map';
    readonly derivatives: 'normalized-original-full-span';
    readonly source: 'copied-original-binary64-poles-weights-and-knots';
    readonly family: 'quantified-near-quarter-caller-retains-native-provenance';
    readonly chart: false;
    readonly inverse: false;
    readonly nodes: false;
    readonly composition: false;
    readonly surfaceBinding: false;
    readonly trim: false;
    readonly solid: false;
    readonly globalNativeEvaluationError: false;
  };
}

type R = SectionRational;
type Polynomial = R[];
interface FixedInterval { lo: bigint; hi: bigint }
interface InternalNode { share: number; u: number; s: number; angle: FixedInterval; error: R }
interface SourceGeometry { x: Polynomial; y: Polynomial; w: Polynomial; d: Polynomial; k: Polynomial; residual: Polynomial; radius: number; r: R; r2: R }
interface CarrierProof extends SourceGeometry { mW: R; mD: R; mK: R; residualMax: R; mW2: R; radial: R }
interface SourceProof { x: Polynomial; y: Polynomial; w: Polynomial; d: Polynomial; k: Polynomial; residual: Polynomial; second: Polynomial; mW: R; mD: R; mK: R; radial: R; radialDerivative: R; arclength: R; secondBound: R }
const SCALE = 1n << 128n;
const TERMS = 24, MAX_INTERVALS = 256, MAX_WORK = 1048576;
const LIMITS = Object.freeze({ intervals: 256, depth: 8, taylorTerms: 24, intervalBits: 128, work: 1048576, rationalOperations: 200000, rationalGcdSteps: 200000, rationalIntegerBits: 8192, fractionCharacters: 5000, floatSearchStepsPerConversion: 64 } as const);
const CARRIER_LIMITS = Object.freeze({ work: LIMITS.work, rationalOperations: LIMITS.rationalOperations, rationalGcdSteps: LIMITS.rationalGcdSteps, rationalIntegerBits: LIMITS.rationalIntegerBits, fractionCharacters: LIMITS.fractionCharacters, floatSearchStepsPerConversion: LIMITS.floatSearchStepsPerConversion });
const CURVE_FIELDS = ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights'];
const OPTION_FIELDS = ['radius', 'tolerance'];
function fail(code: CylindricalWrapMapCode, detail: string): never { throw kernelRefusal('cylindrical-wrap-map', code, ('Cylindrical wrap map: ' + detail).slice(0, 1024)) as CylindricalWrapMapError; }
export function isCylindricalWrapMapError(error: unknown): error is CylindricalWrapMapError { return isFrom<CylindricalWrapMapCode>(error, 'cylindrical-wrap-map'); }
function wrapInput(code: CylindricalWrapMapCode, detail: string, _cause: unknown): never { return fail(code, detail); }
function exactFailure(kind: 'BUDGET' | 'REPRESENTABILITY', detail: string): never { return fail(kind, detail); }
const OWN: OwnSnapshotSpec<CylindricalWrapMapCode> = { input: 'INPUT', owned: 'INPUT', budget: 'BUDGET', fail, wrap: wrapInput, isRefusal: isCylindricalWrapMapError };
function record(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !hasExactOwnFields(value as Record<string, unknown>, fields)) fail('INPUT', 'Exact plain own fields are required');
  return value as Record<string, unknown>;
}
class CoefficientContext {
  readonly q = new SectionRationalContext(exactFailure);
  work = 0; integerOperations = 0; integerMaximumBits = 0;
  charge(amount = 1): void { if (!Number.isSafeInteger(amount) || amount < 0 || (this.work += amount) > MAX_WORK) fail('BUDGET', 'Fixed interval/coefficient work budget exceeded'); }
}
class Context extends CoefficientContext {
  readonly nodes = new Map<number, InternalNode>();
  readonly atanHalf: FixedInterval;
  readonly piHalf: FixedInterval;
  constructor() {
    super();
    this.atanHalf = atanSmall(1n, 2n, this);
    const third = atanSmall(1n, 3n, this);
    this.piHalf = { lo: checked(2n * (this.atanHalf.lo + third.lo), this), hi: checked(2n * (this.atanHalf.hi + third.hi), this) };
  }
}

function checked(value: bigint, ctx: Context): bigint {
  ctx.charge(); ctx.integerOperations++;
  const bits = (value < 0n ? -value : value).toString(2).length;
  if (bits > 8192) fail('BUDGET', 'Exact integer bit budget exceeded');
  ctx.integerMaximumBits = Math.max(ctx.integerMaximumBits, bits); return value;
}
function ceilPositive(n: bigint, d: bigint, ctx: Context): bigint { return checked((n + d - 1n) / d, ctx); }
function fixedProduct(a: FixedInterval, b: FixedInterval, ctx: Context): FixedInterval {
  return { lo: checked(checked(a.lo * b.lo, ctx) / SCALE, ctx), hi: ceilPositive(checked(a.hi * b.hi, ctx), SCALE, ctx) };
}
/** Fixed128 outward dyadic arithmetic encloses the exact24-term rational series and its signed remainder. */
function atanSmall(a: bigint, b: bigint, ctx: Context): FixedInterval {
  if (a < 0n || b <= 0n || 2n * a > b) fail('SUPPORT', 'The atan series requires an exact argument in [0,1/2]');
  if (a === 0n) return { lo: 0n, hi: 0n };
  const scaled = checked(a * SCALE, ctx), x: FixedInterval = { lo: checked(scaled / b, ctx), hi: ceilPositive(scaled, b, ctx) }, square = fixedProduct(x, x, ctx);
  let power = x, lo = 0n, hi = 0n;
  for (let k = 0; k < TERMS; k++) {
    const divisor = BigInt(2 * k + 1), lower = checked(power.lo / divisor, ctx), upper = ceilPositive(power.hi, divisor, ctx);
    if (k % 2 === 0) { lo = checked(lo + lower, ctx); hi = checked(hi + upper, ctx); }
    else { lo = checked(lo - upper, ctx); hi = checked(hi - lower, ctx); }
    power = fixedProduct(power, square, ctx);
  }
  // A24 ends negative: the exact remainder is positive and at most x^49/49.
  hi = checked(hi + ceilPositive(power.hi, 49n, ctx), ctx);
  return { lo: lo < 0n ? 0n : lo, hi };
}
function atanRatio(value: R, ctx: Context): FixedInterval {
  const q = ctx.q, zero = q.integer(0), one = q.integer(1), half = q.rat(1n, 2n);
  if (q.compare(value, zero) < 0 || q.compare(value, one) > 0) fail('SUPPORT', 'An exact first-quadrant ratio in [0,1] is required');
  if (q.compare(value, half) <= 0) return atanSmall(value.n, value.d, ctx);
  const reduced = q.div(q.sub(value, half), q.add(one, q.mul(half, value))), tail = atanSmall(reduced.n, reduced.d, ctx);
  return { lo: checked(ctx.atanHalf.lo + tail.lo, ctx), hi: checked(ctx.atanHalf.hi + tail.hi, ctx) };
}
function angle(x: R, y: R, ctx: Context): FixedInterval {
  if (x.n < 0n || y.n < 0n || x.n === 0n && y.n === 0n) fail('SUPPORT', 'A nonzero original first-quadrant carrier is required');
  if (x.n === 0n) return ctx.piHalf;
  if (y.n === 0n) return { lo: 0n, hi: 0n };
  const q = ctx.q;
  if (q.compare(x, y) >= 0) return atanRatio(q.div(y, x), ctx);
  const reversed = atanRatio(q.div(x, y), ctx);
  return { lo: checked(ctx.piHalf.lo - reversed.hi, ctx), hi: checked(ctx.piHalf.hi - reversed.lo, ctx) };
}
function choose(n: number, k: number): number { let value = 1; for (let i = 1; i <= k; i++) value = value * (n - i + 1) / i; return value; }
function product(a: Polynomial, b: Polynomial, ctx: CoefficientContext): Polynomial {
  const q = ctx.q, m = a.length - 1, n = b.length - 1, result: R[] = [];
  if (m + n > 8) fail('BUDGET', 'Private polynomial degree exceeds8');
  for (let k = 0; k <= m + n; k++) {
    let sum = q.integer(0); ctx.charge();
    for (let i = Math.max(0, k - n); i <= Math.min(m, k); i++) sum = q.add(sum, q.mul(q.rat(BigInt(choose(m, i) * choose(n, k - i)), BigInt(choose(m + n, k))), q.mul(a[i], b[k - i])));
    result.push(sum);
  }
  return result;
}
function elevate(input: Polynomial, degree: number, ctx: CoefficientContext): Polynomial {
  const q = ctx.q; let result = input;
  while (result.length - 1 < degree) {
    const n = result.length, next: R[] = [result[0]];
    for (let i = 1; i < n; i++) { ctx.charge(); next.push(q.div(q.add(q.mul(q.integer(i), result[i - 1]), q.mul(q.integer(n - i), result[i])), q.integer(n))); }
    next.push(result[n - 1]); result = next;
  }
  return result;
}
function add(a: Polynomial, b: Polynomial, subtract: boolean, ctx: CoefficientContext): Polynomial {
  const q = ctx.q, degree = Math.max(a.length, b.length) - 1, x = elevate(a, degree, ctx), y = elevate(b, degree, ctx), result: R[] = [];
  for (let i = 0; i <= degree; i++) result.push(subtract ? q.sub(x[i], y[i]) : q.add(x[i], y[i]));
  return result;
}
function derivative(a: Polynomial, ctx: CoefficientContext): Polynomial {
  const q = ctx.q, n = a.length - 1, result: R[] = [];
  for (let i = 0; i < n; i++) result.push(q.mul(q.integer(n), q.sub(a[i + 1], a[i])));
  return result.length ? result : [q.integer(0)];
}
function scaled(a: Polynomial, value: R, ctx: CoefficientContext): Polynomial { const result: R[] = []; for (const item of a) result.push(ctx.q.mul(item, value)); return result; }
function minimum(a: Polynomial, ctx: CoefficientContext): R { let result = a[0]; for (const item of a) if (ctx.q.compare(item, result) < 0) result = item; return result; }
function maximumAbs(a: Polynomial, ctx: CoefficientContext): R { let result = ctx.q.integer(0); for (const item of a) result = ctx.q.max(result, ctx.q.abs(item)); return result; }
function evaluate(a: Polynomial, share: R, ctx: CoefficientContext): R {
  const q = ctx.q, other = q.sub(q.integer(1), share); let row = a;
  while (row.length > 1) {
    const next: R[] = []; for (let i = 0; i + 1 < row.length; i++) next.push(q.add(q.mul(other, row[i]), q.mul(share, row[i + 1]))); row = next;
  }
  return row[0];
}
function fractions(a: Polynomial, q: SectionRationalContext): SectionFraction[] { const result: SectionFraction[] = []; for (const item of a) result.push(q.text(item)); return result; }
function freezeData(value: unknown): void {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
  Object.freeze(value); for (const item of Object.values(value)) freezeData(item);
}
function admit(source: Curve, options: CylindricalWrapMapOptions, ctx: CoefficientContext): void {
  if (typeof options.radius !== 'number' || !Number.isFinite(options.radius) || options.radius < 0.01 || options.radius > CadNumericPolicy.coordinateAbs || typeof options.tolerance !== 'number' || !Number.isFinite(options.tolerance) || options.tolerance <= 0 || options.tolerance > CadNumericPolicy.coordinateAbs) fail('INPUT', 'Radius0.01..10000 and positive chart tolerance at most10000 are required');
  try { validateCurve(source); } catch (error) { fail('SUPPORT', error instanceof Error ? error.message : 'Invalid native source curve'); }
  if (source.id.length > 64 || source.degree !== 2 || source.controlPoints.length !== 3 || source.knots.length !== 6 || source.weights[0] !== 1 || source.weights[1] !== Math.SQRT1_2 || source.weights[2] !== 1) fail('SUPPORT', 'One rational quadratic quarter with native weight bits[1,sqrt(1/2),1] is required');
  if (!(Number.isFinite(source.knots[5] - source.knots[0]) && source.knots[5] > source.knots[0])) fail('REPRESENTABILITY', 'The original knot span must have a finite positive width');
  const q = ctx.q, radius = q.from(options.radius), tolerance = q.from(linearToleranceMM(options.radius)), zero = q.integer(0), points = source.controlPoints;
  const expected = [[options.radius, 0], [options.radius, options.radius], [0, options.radius]];
  if (points[0][1] !== 0) fail('SUPPORT', 'The centered quarter must begin exactly on +X so nominal angle and source arclength share their origin');
  for (let i = 0; i < 3; i++) {
    if (points[i][2] !== points[0][2]) fail('SUPPORT', 'The original quarter must stay in one XY plane');
    for (let k = 0; k < 2; k++) if (points[i][k] < 0 || Math.abs(points[i][k]) > CadNumericPolicy.coordinateAbs || q.compare(q.abs(q.sub(q.from(points[i][k]), q.from(expected[i][k]))), tolerance) > 0) fail('SUPPORT', 'Only a centered first-quadrant near-quarter within native policy is admitted; original coefficients are retained');
  }
  if (q.compare(radius, zero) <= 0 || Math.abs(points[0][2]) > CadNumericPolicy.coordinateAbs) fail('SUPPORT', 'The original quarter exceeds the authored coordinate range');
}
function sourceGeometry(source: Curve, radius: number, ctx: CoefficientContext): SourceGeometry {
  const q = ctx.q, x: R[] = [], y: R[] = [], w: R[] = [];
  for (let i = 0; i < 3; i++) { const weight = q.from(source.weights[i]); w.push(weight); x.push(q.mul(q.from(source.controlPoints[i][0]), weight)); y.push(q.mul(q.from(source.controlPoints[i][1]), weight)); }
  const d = add(product(x, x, ctx), product(y, y, ctx), false, ctx), k = add(product(x, derivative(y, ctx), ctx), product(y, derivative(x, ctx), ctx), true, ctx);
  const r = q.from(radius), r2 = q.mul(r, r), residual = add(d, scaled(product(w, w, ctx), r2, ctx), true, ctx);
  return { x, y, w, d, k, residual, radius, r, r2 };
}
function admittedCarrier(geometry: SourceGeometry, ctx: CoefficientContext): CarrierProof {
  const q = ctx.q, { w, d, k, residual, radius, r, r2 } = geometry;
  const mW = minimum(w, ctx), mD = minimum(d, ctx), mK = minimum(k, ctx);
  if (mW.n <= 0n || mD.n <= 0n || mK.n <= 0n) fail('SUPPORT', 'Global positive denominator, radius and increasing angle must follow from original Bernstein coefficients');
  const residualMax = maximumAbs(residual, ctx), mW2 = q.mul(mW, mW), radial = q.div(residualMax, q.mul(r, mW2));
  if (q.compare(radial, q.from(linearToleranceMM(radius))) > 0 || q.compare(q.div(residualMax, mW2), q.mul(q.rat(3n, 4n), r2)) > 0) fail('SUPPORT', 'Original coefficient circle defect exceeds native policy or cannot prove radius at least R/2');
  return { ...geometry, mW, mD, mK, residualMax, mW2, radial };
}
function sourceProof(source: Curve, radius: number, ctx: Context): SourceProof {
  const q = ctx.q, geometry = sourceGeometry(source, radius, ctx), { x, y, w, d, k, residual, r } = geometry;
  // Keep the full-map proof's original operation order: second numerator precedes source admission.
  const second = add(product(derivative(k, ctx), d, ctx), product(k, derivative(d, ctx), ctx), true, ctx);
  const { mW, mD, mK, residualMax, mW2, radial } = admittedCarrier(geometry, ctx);
  const radialDerivative = q.div(q.add(q.div(maximumAbs(derivative(residual, ctx), ctx), mW2), q.div(q.mul(q.integer(2), q.mul(residualMax, maximumAbs(derivative(w, ctx), ctx))), q.mul(mW2, mW))), r);
  const arclength = q.add(radialDerivative, q.mul(radial, q.rat(ctx.piHalf.hi, SCALE))), secondBound = q.div(maximumAbs(second, ctx), q.mul(mD, mD));
  return { x, y, w, d, k, residual, second, mW, mD, mK, radial, radialDerivative, arclength, secondBound };
}

function node(share: number, source: Curve, radius: number, proof: SourceProof, ctx: Context): InternalNode {
  const cached = ctx.nodes.get(share); if (cached) return cached;
  ctx.charge();
  const q = ctx.q, t = q.from(share), interval = angle(evaluate(proof.x, t, ctx), evaluate(proof.y, t, ctx), ctx);
  const lower = q.mul(q.from(radius), q.rat(interval.lo, SCALE)), upper = q.mul(q.from(radius), q.rat(interval.hi, SCALE));
  const s = q.nearest(q.div(q.add(lower, upper), q.integer(2))), error = q.max(q.abs(q.sub(q.from(s), lower)), q.abs(q.sub(q.from(s), upper)));
  const a = source.knots[0], b = source.knots[5], exact = q.add(q.from(a), q.mul(q.sub(q.from(b), q.from(a)), t));
  const candidate = a + (b - a) * share;
  const u = share === 0 ? a : share === 1 ? b : Number.isFinite(candidate) && q.compare(q.from(candidate), exact) === 0 ? candidate : q.exactFloat(exact);
  const result: InternalNode = { share, u, s, angle: interval, error }; ctx.nodes.set(share, result); return result;
}

/** Private original-carrier proof for native-UV consumers; no arclength/inverse work is requested. */
export function certifyCylindricalWrapCarrier(sourceInput: Curve, optionsInput: CylindricalWrapCarrierOptions): CylindricalWrapCarrierCertificate {
  const copied = record(ownSnapshot({ source: sourceInput, options: optionsInput }, false, OWN), ['source', 'options']);
  const source = record(copied.source, CURVE_FIELDS) as unknown as Curve, options = record(copied.options, ['radius']) as unknown as CylindricalWrapCarrierOptions, ctx = new CoefficientContext(), q = ctx.q;
  // The source admission is unchanged. Its chart-tolerance field is unused by this coefficient-only request.
  admit(source, { radius: options.radius, tolerance: CadNumericPolicy.linearTolerance }, ctx);
  const proof = admittedCarrier(sourceGeometry(source, options.radius, ctx), ctx);
  const bounds = { radial: q.bound(proof.radial) };
  const recorded = { denominator: fractions(proof.w, q), squaredRadiusNumerator: fractions(proof.d, q), angularNumerator: fractions(proof.k, q), circleResidual: fractions(proof.residual, q), denominatorMinimum: q.text(proof.mW), squaredRadiusMinimum: q.text(proof.mD), angularMinimum: q.text(proof.mK) };
  const result: CylindricalWrapCarrierCertificate = { source, options, domain: [source.knots[0], source.knots[5]], bounds, proof: recorded,
    counts: { rational: q.counts(), integerOperations: ctx.integerOperations, integerMaximumBits: ctx.integerMaximumBits, work: ctx.work }, limits: CARRIER_LIMITS,
    meaning: { guarantee: 'analytic-original-carrier-coefficients-only', parameter: 'original-native-domain-no-inverse-map', derivatives: 'normalized-original-full-span', source: 'copied-original-binary64-poles-weights-and-knots', family: 'quantified-near-quarter-caller-retains-native-provenance', chart: false, inverse: false, nodes: false, composition: false, surfaceBinding: false, trim: false, solid: false, globalNativeEvaluationError: false } };
  freezeData(result); return result;
}

/** Private proof/data for a later cubic composition. No Curve, Surface, glyph, B-rep or part is generated. */
export function buildCylindricalWrapMap(sourceInput: Curve, optionsInput: CylindricalWrapMapOptions): CylindricalWrapMap {
  const copied = record(ownSnapshot({ source: sourceInput, options: optionsInput }, false, OWN), ['source', 'options']);
  const source = record(copied.source, CURVE_FIELDS) as unknown as Curve, options = record(copied.options, OPTION_FIELDS) as unknown as CylindricalWrapMapOptions, ctx = new Context(), q = ctx.q;
  admit(source, options, ctx);
  const proof = sourceProof(source, options.radius, ctx), radius = q.from(options.radius), tolerance = q.from(options.tolerance), eighth = q.rat(1n, 8n), numerator = q.mul(q.mul(radius, proof.secondBound), eighth);
  if (q.compare(q.div(numerator, q.integer(MAX_INTERVALS * MAX_INTERVALS)), tolerance) > 0) fail('BUDGET', 'The fixed256-interval inverse cannot prove the requested chart tolerance');
  let count = 1;
  while (count < MAX_INTERVALS && q.compare(q.div(numerator, q.integer(count * count)), tolerance) > 0) count *= 2;
  let accepted: InternalNode[] = [], maximum = q.integer(0), interpolation = q.integer(0);
  while (!accepted.length) {
    const nodes: InternalNode[] = []; let fits = true; maximum = q.integer(0);
    interpolation = q.div(numerator, q.integer(count * count));
    for (let i = 0; i <= count; i++) nodes.push(node(i / count, source, options.radius, proof, ctx));
    for (let i = 0; i < count; i++) {
      const a = nodes[i], b = nodes[i + 1];
      if (!(Number.isFinite(a.s) && Number.isFinite(b.s) && Number.isFinite(a.u) && Number.isFinite(b.u) && a.s < b.s && a.u < b.u && Number.isFinite(b.u - a.u) && b.u - a.u > 0 && Number.isFinite(b.s - a.s) && b.s - a.s > 0)) fail('REPRESENTABILITY', 'Stored original-U/chart nodes must be finite and strictly monotone');
      const error = q.add(q.max(a.error, b.error), interpolation); maximum = q.max(maximum, error);
      if (q.compare(error, tolerance) > 0) fits = false;
    }
    if (fits) accepted = nodes;
    else { if (count === MAX_INTERVALS) fail('BUDGET', 'Node rounding and the global secant bound exceed the fixed inverse budget'); count *= 2; }
  }
  const nodes: WrapMapNode[] = [], intervals: WrapMapInterval[] = [];
  for (const item of accepted) nodes.push({ share: item.share, u: item.u, s: item.s, angle: { lower: q.text(q.rat(item.angle.lo, SCALE)), upper: q.text(q.rat(item.angle.hi, SCALE)) }, error: q.text(item.error) });
  for (let i = 0; i < count; i++) intervals.push({ first: i, last: i + 1, interpolation: q.text(interpolation), error: q.text(q.add(q.max(accepted[i].error, accepted[i + 1].error), interpolation)) });
  const bounds = { nominal: q.bound(maximum), radial: q.bound(proof.radial), arclengthDrift: q.bound(proof.arclength), basePosition: q.bound(q.add(maximum, proof.radial)), actualLengthResidual: q.bound(q.add(maximum, proof.arclength)), secondDerivative: q.bound(proof.secondBound) };
  const recorded = { denominator: fractions(proof.w, q), squaredRadiusNumerator: fractions(proof.d, q), angularNumerator: fractions(proof.k, q), circleResidual: fractions(proof.residual, q), secondNumerator: fractions(proof.second, q), denominatorMinimum: q.text(proof.mW), squaredRadiusMinimum: q.text(proof.mD), angularMinimum: q.text(proof.mK), radialDerivative: q.text(proof.radialDerivative), piHalf: { lower: q.text(q.rat(ctx.piHalf.lo, SCALE)), upper: q.text(q.rat(ctx.piHalf.hi, SCALE)) } };
  const result: CylindricalWrapMap = { source, options, domain: [source.knots[0], source.knots[5]], chartDomain: [accepted[0].s, accepted[accepted.length - 1].s], nodes, intervals, bounds, proof: recorded,
    counts: { rational: q.counts(), integerOperations: ctx.integerOperations, integerMaximumBits: ctx.integerMaximumBits, work: ctx.work }, limits: LIMITS,
    meaning: { chart: 'nominal-radius-times-original-carrier-angle', parameter: 'piecewise-affine-inverse-of-stored-nodes', derivatives: 'normalized-original-full-span', source: 'copied-original-binary64-poles-weights-and-knots', guarantee: 'analytic-whole-interval-bound-not-sample-fit', family: 'quantified-near-quarter-caller-retains-native-provenance', evaluation: 'exact-affine-certificate-no-number-interpolation-bound', outerThickness: 'future-homothety-has-error-at-most-height-times-radial-bound-over-radius', composition: false, surfaceBinding: false, trim: false, solid: false, globalNativeEvaluationError: false } };
  freezeData(result); return result;
}
