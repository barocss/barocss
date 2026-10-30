import { validateCurve, validateSurface } from './math.js';
import { ownSnapshot, hasExactOwnFields, type OwnSnapshotSpec } from './own-data.js';
import { isFrom, kernelRefusal, type KernelError } from './barocss-error.js';
import { CadNumericPolicy } from '../numeric-policy.js';
import { SectionRationalContext, type SectionFraction, type SectionRational } from '../section-rational-internal.js';
import type { Curve, Point, Surface } from '../types.js';

type R = SectionRational;
export type NativeD0Code = 'INPUT' | 'SUPPORT' | 'BUDGET';
export type NativeD0Error = KernelError & { readonly code: NativeD0Code };
export interface NativeD0Options {
  /** A tighter request limit only. */
  readonly maxOperations?: number;
  /** A positive L1 admission budget no larger than the existing native linear floor. */
  readonly errorBudgetL1?: number;
}
export interface NativeD0Bound { readonly exact: SectionFraction; readonly upper: number }
interface NativeD0Common {
  readonly authority: 'existing-native-basis-ordered-sum-projection';
  readonly axes: readonly [NativeD0Bound, NativeD0Bound, NativeD0Bound];
  readonly l1: NativeD0Bound;
  readonly constantAxes: readonly [boolean, boolean, boolean];
  readonly errorBudgetL1: number;
  readonly fractionBits: 128;
  readonly counts: ReturnType<SectionRationalContext['counts']> & { readonly directOperations: number; readonly totalOperations: number; readonly work: number; readonly maximumDirectBits: number };
  readonly limits: { readonly operations: number; readonly integerBits: 8192; readonly work: 1048576 };
  readonly meaning: {
    readonly nativeD0Certified: true;
    readonly parameterAuthority: 'finite-binary64-inside-exact-stored-domain';
    readonly exactTarget: 'rational-evaluation-of-unchanged-stored-coefficients';
    readonly rounding: 'binary64-nearest-with-absolute-subnormal-allowance';
    readonly boundArithmetic: 'single-ledger-positive-outward-fixed128';
    readonly evaluatorReplacement: false;
    readonly derivatives: false;
    readonly pcurveBinding: false;
    readonly topology: false;
    readonly mass: false;
  };
}
export interface NativeCurveD0Certificate extends NativeD0Common {
  readonly source: Curve;
  readonly template: 'single-clamped-bezier-curve-degree1-to3';
  readonly domain: readonly [number, number];
}
export interface NativeSurfaceD0Certificate extends NativeD0Common {
  readonly source: Surface;
  readonly template: 'single-clamped-bezier-surface-degreeU1-to3-degreeV1';
  readonly domain: { readonly u: readonly [number, number]; readonly v: readonly [number, number] };
}
export interface NativeD0FamilyInput { readonly curves: readonly Curve[]; readonly surfaces: readonly Surface[] }
export interface NativeD0FamilyCurve {
  readonly index: number;
  readonly source: Curve;
  readonly template: NativeCurveD0Certificate['template'] | 'quadratic-two-half-spans-five-poles';
  readonly domain: readonly [number, number];
  readonly spans: readonly (readonly [number, number])[];
}
export interface NativeD0FamilySurface {
  readonly index: number;
  readonly source: Surface;
  readonly template: NativeSurfaceD0Certificate['template'] | 'quadratic-two-half-spans-five-by-two-poles';
  readonly domain: NativeSurfaceD0Certificate['domain'];
  readonly spansU: readonly (readonly [number, number])[];
}
export interface NativeD0FamilyCertificate extends NativeD0Common {
  readonly curves: readonly NativeD0FamilyCurve[];
  readonly surfaces: readonly NativeD0FamilySurface[];
  readonly globalTemplate: 'degree3-by1-count8-no-constant-axis-shortcut';
  readonly envelope: { readonly minimumWeight: number; readonly maximumWeight: number; readonly coordinateAbs: readonly [number, number, number] };
  readonly family: { readonly objects: number; readonly storedPoles: number; readonly maximumObjects: 64; readonly maximumStoredPoles: 512; readonly structuralWork: number };
}
const MAX_OPERATIONS = 200000, MAX_BITS = 8192, MAX_WORK = 1048576;
const SCALE = 1n << 128n;
const CURVE_FIELDS = ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights'];
const SURFACE_FIELDS = ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights'];
const OPTION_FIELDS = ['maxOperations', 'errorBudgetL1'];
function fail(code: NativeD0Code, detail: string): never { throw kernelRefusal('native-d0-bound', code, `Native D0 bound: ${detail}`) as NativeD0Error; }
export function isNativeD0Error(error: unknown): error is NativeD0Error { try { return isFrom<NativeD0Code>(error, 'native-d0-bound'); } catch { return false; } }
function wrap(code: NativeD0Code, detail: string, _cause: unknown): never { return fail(code, detail); }
function exactFailure(code: 'BUDGET' | 'REPRESENTABILITY', detail: string): never { return fail(code === 'BUDGET' ? 'BUDGET' : 'SUPPORT', detail); }
const OWN: OwnSnapshotSpec<NativeD0Code> = { input: 'INPUT', owned: 'INPUT', budget: 'BUDGET', fail, wrap, isRefusal: isNativeD0Error };
function record(input: unknown, fields: readonly string[]): Record<string, unknown> {
  const data = ownSnapshot(input, false, OWN);
  if (!data || typeof data !== 'object' || Array.isArray(data) || !hasExactOwnFields(data as Record<string, unknown>, fields)) fail('INPUT', 'the current record fields are required exactly');
  return data as Record<string, unknown>;
}
function options(input: NativeD0Options): Required<NativeD0Options> {
  const data = ownSnapshot(input, false, OWN);
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('INPUT', 'options must be a plain own record');
  for (const key of Object.keys(data)) if (!OPTION_FIELDS.includes(key)) fail('INPUT', 'an option field is unsupported');
  const value = data as Record<string, unknown>, maximum = Object.hasOwn(value, 'maxOperations') ? value.maxOperations : MAX_OPERATIONS,
    budget = Object.hasOwn(value, 'errorBudgetL1') ? value.errorBudgetL1 : CadNumericPolicy.linearTolerance;
  if (typeof maximum !== 'number' || !Number.isInteger(maximum) || maximum < 1 || maximum > MAX_OPERATIONS) fail('INPUT', 'maxOperations must tighten the existing positive 200000-operation limit');
  if (typeof budget !== 'number' || !Number.isFinite(budget) || budget <= 0 || budget > CadNumericPolicy.linearTolerance) fail('INPUT', 'errorBudgetL1 must be positive and no larger than the native linear floor');
  return { maxOperations: maximum, errorBudgetL1: budget };
}
class Context {
  readonly q = new SectionRationalContext(exactFailure);
  readonly zero = this.q.integer(0);
  readonly one = this.q.integer(1);
  readonly two = this.q.integer(2);
  readonly unit = this.q.rat(1n, 1n << 53n);
  readonly eta = this.q.rat(1n, 1n << 1074n);
  directOperations = 0;
  maximumDirectBits = 0;
  private structuralWork = 0;
  constructor(readonly maximum: number) { this.check(); }
  check(): void {
    const counts = this.q.counts();
    if (counts.operations + this.directOperations > this.maximum) fail('BUDGET', 'the shared exact/direct operation budget was exceeded');
    if (counts.operations + counts.gcdSteps + counts.floatSearchSteps + this.directOperations + this.structuralWork > MAX_WORK) fail('BUDGET', 'the shared arithmetic work budget was exceeded');
  }
  chargeWork(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount < 0) fail('BUDGET', 'a structural work charge must be a bounded nonnegative integer');
    this.structuralWork += amount; this.check();
  }
  integer(value: bigint): bigint {
    this.directOperations++;
    const bits = (value < 0n ? -value : value).toString(2).length;
    if (bits > MAX_BITS) fail('BUDGET', 'a direct integer exceeded the 8192-bit limit');
    this.maximumDirectBits = Math.max(this.maximumDirectBits, bits); this.check(); return value;
  }
  /** All bound values are nonnegative; quantization always goes outward. */
  upper(value: R): R {
    if (value.n < 0n || value.d <= 0n) fail('SUPPORT', 'an error upper bound must be nonnegative');
    const numerator = this.integer(value.n * SCALE), quotient = this.integer(numerator / value.d), remainder = this.integer(numerator % value.d);
    const result = this.q.rat(remainder === 0n ? quotient : this.integer(quotient + 1n), SCALE); this.check(); return result;
  }
  add(a: R, b: R): R { return this.upper(this.q.add(a, b)); }
  mul(a: R, b: R): R { return this.upper(this.q.mul(a, b)); }
  div(a: R, b: R): R {
    if (b.n <= 0n) fail('SUPPORT', 'a certified denominator lower bound must be positive');
    return this.upper(this.q.div(a, b));
  }
  rho(value: R): R { return this.add(this.mul(this.unit, value), this.eta); }
  lowerDifference(a: R, b: R): R {
    const result = this.q.sub(a, b); this.check();
    if (result.n <= 0n) fail('SUPPORT', 'a rounded native denominator cannot be proved positive');
    return result;
  }
  atMost(value: R, maximum: R, detail: string): void { if (this.q.compare(value, maximum) > 0) fail('SUPPORT', detail); this.check(); }
  bound(value: R): NativeD0Bound { const result = this.q.bound(value); this.check(); return result; }
  counts(): NativeD0Common['counts'] {
    this.check(); const value = this.q.counts();
    return { ...value, directOperations: this.directOperations, totalOperations: value.operations + this.directOperations,
      work: value.operations + value.gcdSteps + value.floatSearchSteps + this.directOperations + this.structuralWork, maximumDirectBits: this.maximumDirectBits };
  }
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') { for (const part of Object.values(value)) freeze(part); Object.freeze(value); }
  return value;
}
function domain(knots: number[], degree: number, ctx: Context): [number, number] {
  const left = knots[degree], right = knots[degree + 1];
  if (Math.abs(left) > 1 || Math.abs(right) > 1) fail('SUPPORT', 'the admitted basis scale must be exactly one');
  const q = ctx.q, width = q.sub(q.from(right), q.from(left));
  const half = q.rat(1n, 2n);
  if (q.compare(width, half) !== 0 && q.compare(width, ctx.one) !== 0) fail('SUPPORT', 'the exact stored span width must be 0.5 or 1');
  ctx.check(); return [left, right];
}
function curveSource(input: Curve, ctx: Context): Curve {
  const source = record(input, CURVE_FIELDS) as unknown as Curve;
  try { validateCurve(source); } catch { fail('INPUT', 'the current native Curve data must be valid'); }
  if (source.degree > 3 || source.controlPoints.length !== source.degree + 1) fail('SUPPORT', 'only one clamped Bezier span of degree1..3 is certified');
  domain(source.knots, source.degree, ctx); return source;
}
function surfaceSource(input: Surface, ctx: Context): Surface {
  const source = record(input, SURFACE_FIELDS) as unknown as Surface;
  try { validateSurface(source); } catch { fail('INPUT', 'the current native Surface data must be valid'); }
  if (source.degreeU > 3 || source.degreeV !== 1 || source.controlPoints.length !== source.degreeU + 1 || source.controlPoints[0].length !== 2) fail('SUPPORT', 'only one clamped degreeU1..3 by degreeV1 Bezier patch is certified');
  domain(source.knotsU, source.degreeU, ctx); domain(source.knotsV, source.degreeV, ctx); return source;
}
interface Ranges { minimum: R; maximum: R; axes: readonly [R, R, R]; constant: [boolean, boolean, boolean] }
function ranges(points: readonly Point[], weights: readonly number[], ctx: Context): Ranges {
  let minimum = 1, maximum = 0; const axes = [0, 0, 0], constant: [boolean, boolean, boolean] = [true, true, true];
  for (let i = 0; i < points.length; i++) {
    const weight = weights[i]; if (weight < 0.5 || weight > 1) fail('SUPPORT', 'all stored weights must be in [0.5,1]');
    minimum = Math.min(minimum, weight); maximum = Math.max(maximum, weight);
    for (let axis = 0; axis < 3; axis++) {
      const coordinate = points[i][axis]; if (Math.abs(coordinate) > CadNumericPolicy.coordinateAbs) fail('SUPPORT', 'stored coordinates must stay inside the native 10000-coordinate range');
      axes[axis] = Math.max(axes[axis], Math.abs(coordinate)); if (!Object.is(coordinate, points[0][axis])) constant[axis] = false;
    }
  }
  const q = ctx.q, result = { minimum: q.from(minimum), maximum: q.from(maximum), axes: [q.from(axes[0]), q.from(axes[1]), q.from(axes[2])] as const, constant }; ctx.check(); return result;
}
/** The exact h is 0.5 or1, and every active exact distance is in [0,1]. */
function fractionError(ctx: Context): R {
  const ed = ctx.rho(ctx.one), twice = ctx.mul(ctx.two, ed), sum = ctx.add(twice, ctx.rho(ctx.add(ctx.one, twice)));
  const lower = ctx.lowerDifference(ctx.q.rat(1n, 2n), sum);
  const result = ctx.add(ctx.div(ctx.add(ed, sum), lower), ctx.rho(ctx.div(ctx.add(ctx.one, ed), lower)));
  ctx.atMost(result, ctx.one, 'the native fraction finite-range proof was not established'); return result;
}
/** Matches saved+rightFraction*previousValue and saved=leftFraction*previousValue. */
function basisError(degree: number, fraction: R, ctx: Context): R {
  let error = ctx.zero;
  for (let level = 0; level < degree; level++) {
    const oneError = ctx.add(ctx.one, error), oneFraction = ctx.add(ctx.one, fraction);
    const product = ctx.add(ctx.add(error, ctx.mul(fraction, oneError)), ctx.rho(ctx.mul(oneFraction, oneError)));
    const twice = ctx.mul(ctx.two, product); error = ctx.add(twice, ctx.rho(ctx.add(ctx.two, twice)));
  }
  return error;
}
function tensorError(a: R, b: R, ctx: Context): R {
  return ctx.add(ctx.add(ctx.add(a, b), ctx.mul(a, b)), ctx.rho(ctx.mul(ctx.add(ctx.one, a), ctx.add(ctx.one, b))));
}
/** Exact partial weighted basis sums are <=M; exact coordinate partial sums are <=A*M. */
function accumulated(count: number, term: R, exactMagnitude: R, ctx: Context): R {
  let error = ctx.zero;
  for (let i = 0; i < count; i++) { const input = ctx.add(error, term); error = ctx.add(input, ctx.rho(ctx.add(exactMagnitude, input))); }
  return error;
}
function axisError(count: number, basis: R, range: Ranges, axis: number, ctx: Context): R {
  // core/math restores an authored constant axis only after its normal finite/positive checks.
  const a = range.axes[axis], m = range.minimum, maximum = range.maximum;
  const factor = ctx.add(ctx.mul(maximum, basis), ctx.rho(ctx.mul(maximum, ctx.add(ctx.one, basis))));
  const denominatorError = accumulated(count, factor, maximum, ctx);
  ctx.atMost(denominatorError, ctx.q.div(m, ctx.two), 'the native projected denominator must retain at least half its exact minimum');
  const lower = ctx.lowerDifference(m, denominatorError);
  const term = ctx.add(ctx.mul(a, factor), ctx.rho(ctx.mul(a, ctx.add(maximum, factor))));
  const numeratorError = accumulated(count, term, ctx.mul(a, maximum), ctx);
  const residual = ctx.div(ctx.add(numeratorError, ctx.mul(a, denominatorError)), lower);
  const projection = ctx.rho(ctx.div(ctx.add(ctx.mul(a, maximum), numeratorError), lower));
  const result = ctx.add(residual, projection);
  // Fraction errors<=1 imply computed fractions<=2; degree<=3 bounds the finite
  // recurrence even before the sharper proof. The computed denominator remains>=m/2.
  return range.constant[axis] ? ctx.zero : result;
}
function finish(count: number, basis: R, range: Ranges, settings: Required<NativeD0Options>, ctx: Context): NativeD0Common {
  ctx.atMost(basis, ctx.one, 'the native basis finite-range proof was not established');
  const errors: [R, R, R] = [axisError(count, basis, range, 0, ctx), axisError(count, basis, range, 1, ctx), axisError(count, basis, range, 2, ctx)];
  const l1 = ctx.add(ctx.add(errors[0], errors[1]), errors[2]);
  if (ctx.q.compare(l1, ctx.q.from(settings.errorBudgetL1)) > 0) fail('SUPPORT', 'the rigorous native L1 error exceeds the unchanged requested budget');
  const axes: [NativeD0Bound, NativeD0Bound, NativeD0Bound] = [ctx.bound(errors[0]), ctx.bound(errors[1]), ctx.bound(errors[2])], bound = ctx.bound(l1);
  return { authority: 'existing-native-basis-ordered-sum-projection', axes, l1: bound, constantAxes: range.constant, errorBudgetL1: settings.errorBudgetL1, fractionBits: 128,
    counts: ctx.counts(), limits: { operations: settings.maxOperations, integerBits: MAX_BITS, work: MAX_WORK },
    meaning: { nativeD0Certified: true, parameterAuthority: 'finite-binary64-inside-exact-stored-domain', exactTarget: 'rational-evaluation-of-unchanged-stored-coefficients',
      rounding: 'binary64-nearest-with-absolute-subnormal-allowance', boundArithmetic: 'single-ledger-positive-outward-fixed128', evaluatorReplacement: false, derivatives: false, pcurveBinding: false, topology: false, mass: false } };
}
/** Bounds the unchanged evaluateCurve/curveEvaluator D0 for every admitted binary64 parameter. */
export function certifyNativeCurveD0(input: Curve, given: NativeD0Options = {}): NativeCurveD0Certificate {
  const settings = options(given), ctx = new Context(settings.maxOperations), source = curveSource(input, ctx), fraction = fractionError(ctx);
  const result = finish(source.degree + 1, basisError(source.degree, fraction, ctx), ranges(source.controlPoints, source.weights, ctx), settings, ctx);
  return freeze({ ...result, source, template: 'single-clamped-bezier-curve-degree1-to3', domain: [source.knots[source.degree], source.knots[source.degree + 1]] } as NativeCurveD0Certificate);
}
/** Bounds the unchanged evaluateSurface/surfaceEvaluator D0 on the admitted closed domain. */
export function certifyNativeSurfaceD0(input: Surface, given: NativeD0Options = {}): NativeSurfaceD0Certificate {
  const settings = options(given), ctx = new Context(settings.maxOperations), source = surfaceSource(input, ctx), fraction = fractionError(ctx), points: Point[] = [], weights: number[] = [];
  for (let i = 0; i < source.controlPoints.length; i++) for (let j = 0; j < 2; j++) { points.push(source.controlPoints[i][j]); weights.push(source.weights[i][j]); }
  const basis = tensorError(basisError(source.degreeU, fraction, ctx), basisError(1, fraction, ctx), ctx);
  const result = finish(points.length, basis, ranges(points, weights, ctx), settings, ctx);
  return freeze({ ...result, source, template: 'single-clamped-bezier-surface-degreeU1-to3-degreeV1',
    domain: { u: [source.knotsU[source.degreeU], source.knotsU[source.degreeU + 1]], v: [source.knotsV[1], source.knotsV[2]] } } as NativeSurfaceD0Certificate);
}

// The standalone entrypoints above retain their original templates, output and ledger order.
// Family admission/structural charges below are used only by the family entrypoint.
function familyRecord(input: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !hasExactOwnFields(input as Record<string, unknown>, fields)) fail('INPUT', 'family sources must have exactly the current fields');
  return input as Record<string, unknown>;
}
/** Charge the bounded own snapshot, structural walk and native validation conservatively. */
function familyStructure(input: unknown, ctx: Context): number {
  const cost = 4 + (typeof input === 'string' ? input.length : 0);
  ctx.chargeWork(cost); let charged = cost;
  if (input !== null && typeof input === 'object') for (const value of Object.values(input)) charged += familyStructure(value, ctx);
  return charged;
}
function familySpans(knots: number[], degree: number, count: number, ctx: Context): [number, number][] {
  if (count === degree + 1 && degree <= 3) return [domain(knots, degree, ctx)];
  if (degree !== 2 || count !== 5 || knots.length !== 8 || knots[3] !== knots[4]) fail('SUPPORT', 'the family admits one Bezier span or exactly two quadratic half-spans');
  const a = knots[2], middle = knots[3], b = knots[5];
  if (Math.abs(a) > 1 || Math.abs(b) > 1) fail('SUPPORT', 'the family basis scale must stay exactly one');
  const q = ctx.q, half = q.rat(1n, 2n), left = q.sub(q.from(middle), q.from(a)), right = q.sub(q.from(b), q.from(middle));
  if (q.compare(left, half) !== 0 || q.compare(right, half) !== 0) fail('SUPPORT', 'both exact quadratic span widths must be 0.5');
  ctx.check(); return [[a, middle], [middle, b]];
}
function familyCurve(input: unknown, index: number, ctx: Context): NativeD0FamilyCurve {
  const source = familyRecord(input, CURVE_FIELDS) as unknown as Curve;
  try { validateCurve(source); } catch { fail('INPUT', 'a family Curve must contain valid current native data'); }
  const spans = familySpans(source.knots, source.degree, source.controlPoints.length, ctx);
  return { index, source, template: spans.length === 1 ? 'single-clamped-bezier-curve-degree1-to3' : 'quadratic-two-half-spans-five-poles',
    domain: [spans[0][0], spans[spans.length - 1][1]], spans };
}
function familySurface(input: unknown, index: number, ctx: Context): NativeD0FamilySurface {
  const source = familyRecord(input, SURFACE_FIELDS) as unknown as Surface;
  try { validateSurface(source); } catch { fail('INPUT', 'a family Surface must contain valid current native data'); }
  if (source.degreeV !== 1 || source.controlPoints[0].length !== 2) fail('SUPPORT', 'the family surface V direction must be one linear span');
  const spansU = familySpans(source.knotsU, source.degreeU, source.controlPoints.length, ctx), v = domain(source.knotsV, 1, ctx);
  return { index, source, template: spansU.length === 1 ? 'single-clamped-bezier-surface-degreeU1-to3-degreeV1' : 'quadratic-two-half-spans-five-by-two-poles',
    domain: { u: [spansU[0][0], spansU[spansU.length - 1][1]], v }, spansU };
}
function familyPole(point: Point, weight: number, points: Point[], weights: number[]): void {
  if (points.length >= 512) fail('BUDGET', 'the family exceeds 512 stored poles'); points.push(point); weights.push(weight);
}
function familyEnvelope(points: readonly Point[], weights: readonly number[]): NativeD0FamilyCertificate['envelope'] {
  let minimumWeight = 1, maximumWeight = 0; const coordinateAbs: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < points.length; i++) {
    minimumWeight = Math.min(minimumWeight, weights[i]); maximumWeight = Math.max(maximumWeight, weights[i]);
    for (let axis = 0; axis < 3; axis++) coordinateAbs[axis] = Math.max(coordinateAbs[axis], Math.abs(points[i][axis]));
  }
  return { minimumWeight, maximumWeight, coordinateAbs };
}
const FAMILY_FLOAT = new DataView(new ArrayBuffer(8));
const FAMILY_MINIMUM = 2 ** -128;
function familyDirect(ctx: Context, amount: number): void { ctx.directOperations += amount; ctx.check(); }
function familyNextUp(value: number, ctx: Context): number {
  FAMILY_FLOAT.setFloat64(0, value, false); familyDirect(ctx, 1);
  const bits = ctx.integer(FAMILY_FLOAT.getBigUint64(0, false));
  familyDirect(ctx, 2);
  if (!(value > 0) || bits >= 0x7fefffffffffffffn) fail('SUPPORT', 'the family upper-bound successor must remain positive and finite');
  const next = ctx.integer(bits + 1n); FAMILY_FLOAT.setBigUint64(0, next, false); familyDirect(ctx, 1);
  const result = FAMILY_FLOAT.getFloat64(0, false); familyDirect(ctx, 1); return result;
}
/**
 * Family errors are fixed128 dyadics in [0,1e-7]. Number(n) is nearest; Number(d)
 * is an exact power of two, and scaling stays normal. Thus candidate is nearest
 * to n/d. An exact q comparison and at most one positive IEEE successor yield
 * the same least representable upper value as generic SectionRationalContext.bound.
 * The standalone finish/bound path above is deliberately unchanged.
 */
function familyBound(value: R, ctx: Context): NativeD0Bound {
  // Conservatively include both sign guards, four fixed128 guards and the zero test.
  familyDirect(ctx, 7);
  if (value.n < 0n || value.d <= 0n) fail('SUPPORT', 'a family error bound must be nonnegative with a positive denominator');
  ctx.integer(value.n); ctx.integer(value.d);
  const numeratorHigh = ctx.integer(value.n >> 128n), denominatorHigh = ctx.integer(value.d - SCALE), before = ctx.integer(value.d - 1n);
  const mask = ctx.integer(value.d & before), remainder = ctx.integer(SCALE % value.d);
  if (numeratorHigh !== 0n || denominatorHigh > 0n || mask !== 0n || remainder !== 0n) fail('SUPPORT', 'the family converter requires a fixed128 dyadic with a bounded numerator');
  if (ctx.q.compare(value, ctx.q.from(CadNumericPolicy.linearTolerance)) > 0) fail('SUPPORT', 'the family converter may not exceed the existing native error floor');
  const exact = ctx.q.text(value); ctx.check();
  if (value.n === 0n) return { exact, upper: 0 };
  const numerator = Number(value.n), denominator = Number(value.d), candidate = numerator / denominator; familyDirect(ctx, 3);
  familyDirect(ctx, 3);
  if (!Number.isFinite(candidate) || candidate < FAMILY_MINIMUM || candidate > CadNumericPolicy.linearTolerance) fail('SUPPORT', 'the family nearest conversion must remain in its proved normal range');
  const comparison = ctx.q.compare(ctx.q.from(candidate), value); ctx.check();
  const upper = comparison < 0 ? familyNextUp(candidate, ctx) : candidate;
  if (comparison < 0 && ctx.q.compare(ctx.q.from(upper), value) < 0) fail('SUPPORT', 'the family successor did not enclose its exact error bound');
  ctx.check(); return { exact, upper };
}
/** Denominator arithmetic depends only on the common basis and weight envelope. */
function familyErrors(count: number, basis: R, range: Ranges, ctx: Context): [R, R, R] {
  const maximum = range.maximum, m = range.minimum;
  const factor = ctx.add(ctx.mul(maximum, basis), ctx.rho(ctx.mul(maximum, ctx.add(ctx.one, basis))));
  const denominatorError = accumulated(count, factor, maximum, ctx);
  ctx.atMost(denominatorError, ctx.q.div(m, ctx.two), 'the native projected denominator must retain at least half its exact minimum');
  const lower = ctx.lowerDifference(m, denominatorError), errors: [R, R, R] = [ctx.zero, ctx.zero, ctx.zero];
  for (let axis = 0; axis < 3; axis++) {
    let shared = -1;
    for (let prior = 0; prior < axis; prior++) {
      familyDirect(ctx, 1);
      if (range.constant[axis] !== range.constant[prior]) continue;
      const equal = ctx.q.compare(range.axes[axis], range.axes[prior]) === 0; ctx.check();
      if (equal) { shared = prior; break; }
    }
    if (shared >= 0) { errors[axis] = errors[shared]; continue; }
    const a = range.axes[axis];
    const term = ctx.add(ctx.mul(a, factor), ctx.rho(ctx.mul(a, ctx.add(maximum, factor))));
    const numeratorError = accumulated(count, term, ctx.mul(a, maximum), ctx);
    const residual = ctx.div(ctx.add(numeratorError, ctx.mul(a, denominatorError)), lower);
    const projection = ctx.rho(ctx.div(ctx.add(ctx.mul(a, maximum), numeratorError), lower));
    const result = ctx.add(residual, projection);
    errors[axis] = range.constant[axis] ? ctx.zero : result;
  }
  ctx.check(); return errors;
}
/** Same exact recurrence and budget test as finish, with family-only output conversion. */
function finishFamily(count: number, basis: R, range: Ranges, settings: Required<NativeD0Options>, ctx: Context): NativeD0Common {
  ctx.atMost(basis, ctx.one, 'the native basis finite-range proof was not established');
  const errors = familyErrors(count, basis, range, ctx);
  const l1 = ctx.add(ctx.add(errors[0], errors[1]), errors[2]);
  if (ctx.q.compare(l1, ctx.q.from(settings.errorBudgetL1)) > 0) fail('SUPPORT', 'the rigorous native L1 error exceeds the unchanged requested budget');
  const axes: [NativeD0Bound, NativeD0Bound, NativeD0Bound] = [familyBound(errors[0], ctx), familyBound(errors[1], ctx), familyBound(errors[2], ctx)], bound = familyBound(l1, ctx);
  return { authority: 'existing-native-basis-ordered-sum-projection', axes, l1: bound, constantAxes: range.constant, errorBudgetL1: settings.errorBudgetL1, fractionBits: 128,
    counts: ctx.counts(), limits: { operations: settings.maxOperations, integerBits: MAX_BITS, work: MAX_WORK },
    meaning: { nativeD0Certified: true, parameterAuthority: 'finite-binary64-inside-exact-stored-domain', exactTarget: 'rational-evaluation-of-unchanged-stored-coefficients',
      rounding: 'binary64-nearest-with-absolute-subnormal-allowance', boundArithmetic: 'single-ledger-positive-outward-fixed128', evaluatorReplacement: false, derivatives: false, pcurveBinding: false, topology: false, mass: false } };
}
/**
 * One common bound for actual, immutable family snapshots. All recurrences are nonnegative
 * and monotone in degree, term count, maximum weight/coordinate and inverse minimum weight.
 * Degree3x1 with eight terms therefore bounds curves with <=4 active poles and every admitted
 * surface with <=4x2 active poles. Constant-axis restoration can only reduce their D0 errors.
 *
 * For the explicit degree2 two-span template, basisInto selects three active poles on either
 * half-span. At the repeated middle knot its binary span search selects the right span; at the
 * final endpoint it selects that same final span. Every fraction denominator is still 0.5,
 * scale is1, and the same global fraction/basis recurrence covers both endpoint branches.
 */
export function certifyNativeD0Family(input: NativeD0FamilyInput, given: NativeD0Options = {}): NativeD0FamilyCertificate {
  const settings = options(given), ctx = new Context(settings.maxOperations), data = record(input, ['curves', 'surfaces']);
  if (!Array.isArray(data.curves) || !Array.isArray(data.surfaces)) fail('INPUT', 'family curves and surfaces must be dense own arrays');
  const count = data.curves.length + data.surfaces.length;
  if (count === 0) fail('INPUT', 'a native D0 family must contain at least one object');
  if (count > 64) fail('BUDGET', 'the family exceeds 64 source objects');
  const structuralWork = familyStructure(data, ctx), curves: NativeD0FamilyCurve[] = [], surfaces: NativeD0FamilySurface[] = [], points: Point[] = [], weights: number[] = [];
  for (let index = 0; index < data.curves.length; index++) {
    const item = familyCurve(data.curves[index], index, ctx); curves.push(item);
    for (let i = 0; i < item.source.controlPoints.length; i++) familyPole(item.source.controlPoints[i], item.source.weights[i], points, weights);
  }
  for (let index = 0; index < data.surfaces.length; index++) {
    const item = familySurface(data.surfaces[index], index, ctx); surfaces.push(item);
    for (let i = 0; i < item.source.controlPoints.length; i++) for (let j = 0; j < 2; j++) familyPole(item.source.controlPoints[i][j], item.source.weights[i][j], points, weights);
  }
  const range = ranges(points, weights, ctx); range.constant = [false, false, false];
  const fraction = fractionError(ctx), basis = tensorError(basisError(3, fraction, ctx), basisError(1, fraction, ctx), ctx), envelope = familyEnvelope(points, weights);
  const result = finishFamily(8, basis, range, settings, ctx);
  return freeze({ ...result, curves, surfaces, globalTemplate: 'degree3-by1-count8-no-constant-axis-shortcut', envelope,
    family: { objects: count, storedPoles: points.length, maximumObjects: 64, maximumStoredPoles: 512, structuralWork } } as NativeD0FamilyCertificate);
}
