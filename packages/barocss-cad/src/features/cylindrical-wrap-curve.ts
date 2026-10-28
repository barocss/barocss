import { validateCurve, validateSurface } from '../core/math.js';
import { isFrom, kernelRefusal, type KernelError } from '../core/barocss-error.js';
import { CadNumericPolicy } from '../numeric-policy.js';
import { SectionRationalContext, type SectionFraction, type SectionRational } from '../section-rational-internal.js';
import type { Curve, Point, Surface } from '../types.js';

type R = SectionRational;
type Homogeneous = [R, R, R, R];
type UV = readonly [number, number];
type RationalUV = readonly [R, R];
export type CylindricalWrapCurveCode = 'INPUT' | 'BUDGET' | 'GEOMETRY' | 'BINDING';
export type CylindricalWrapCurveError = KernelError & { readonly code: CylindricalWrapCurveCode };
export interface CylindricalWrapCurveLine { readonly start: UV; readonly end: UV }
export interface CylindricalWrapCurveOptions {
  readonly curveId: string;
  readonly pcurveId: string;
  /** May tighten the existing native binding floor; it may not increase it. */
  readonly errorBudget?: number;
  /** Previously admitted endpoint-table values, in canonical edge parameter direction. */
  readonly endpoints?: readonly [Point | null, Point | null];
  /** A tighter request budget only. The underlying rational context retains its original limits. */
  readonly maxOperations?: number;
}
export interface CylindricalWrapCurveResult {
  readonly original: Surface;
  readonly curve: Curve;
  /** Original native UV, in the same t direction/domain as curve; coedge sense is separate. */
  readonly pcurve: Curve;
  readonly proof: {
    readonly authority: 'stored-homogeneous-bernstein-coefficients';
    readonly sourceId: string;
    readonly originalDegree: readonly [2, 1];
    readonly composedDegree: 3;
    readonly residualDegree: 6;
    readonly exactDenominatorLower: SectionFraction;
    readonly storedDenominatorLower: SectionFraction;
    readonly homogeneousNumeratorResidual: readonly SectionFraction[];
    readonly homogeneousDenominatorResidual: SectionFraction;
    readonly crossResiduals: readonly (readonly SectionFraction[])[];
    readonly axisError: readonly SectionFraction[];
    readonly worldError: { readonly exact: SectionFraction; readonly upper: number };
    readonly errorBudget: number;
    readonly endpointOrigins: readonly ['nearest' | 'table', 'nearest' | 'table'];
    /** World Curve/pcurve t domain; the source U/V domains remain in original knots. */
    readonly parameterDomain: readonly [0, 1];
    readonly coordinateFrame: 'original-surface-world';
    readonly exactStoredModelBound: true;
    readonly globalEvaluatorErrorCertified: false;
    readonly topologyCertified: false;
    readonly counts: ReturnType<SectionRationalContext['counts']>;
    readonly maxOperations: number;
  };
}

const SOURCE = 'cylindrical-wrap-curve';
const CUBIC = [1, 3, 3, 1];
const SEXTIC = [1, 6, 15, 20, 15, 6, 1];
const SURFACE_FIELDS = ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights'];
const OPTION_FIELDS = ['curveId', 'pcurveId', 'errorBudget', 'endpoints', 'maxOperations'];
function fail(code: CylindricalWrapCurveCode, detail: string): never {
  throw kernelRefusal(SOURCE, code, `Cylindrical wrap curve: ${detail}`) as CylindricalWrapCurveError;
}
export function isCylindricalWrapCurveError(error: unknown): error is CylindricalWrapCurveError {
  try { return isFrom<CylindricalWrapCurveCode>(error, SOURCE); }
  catch { return false; }
}
function rationalFailure(kind: 'BUDGET' | 'REPRESENTABILITY', detail: string): never {
  fail(kind === 'BUDGET' ? 'BUDGET' : 'BINDING', detail);
}
class Context {
  readonly q = new SectionRationalContext(rationalFailure);
  constructor(readonly maxOperations: number) {}
  check(): void { if (this.q.counts().operations > this.maxOperations) fail('BUDGET', 'the caller exact-operation budget was exceeded'); }
}
function record(value: unknown, allowed: readonly string[], required: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INPUT', 'plain own data records are required');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) fail('INPUT', 'foreign record prototypes are unsupported');
  const keys = Reflect.ownKeys(value);
  if (keys.length > allowed.length) fail('INPUT', 'the input has extra fields');
  const out: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    if (typeof key !== 'string' || !allowed.includes(key)) fail('INPUT', 'the input has an unsupported field');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail('INPUT', 'getters or hidden fields are unsupported');
    out[key] = descriptor.value;
  }
  for (const key of required) if (!Object.hasOwn(out, key)) fail('INPUT', 'a required field is missing');
  return out;
}
function array(value: unknown, count: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) fail('INPUT', 'bounded own arrays are required');
  const length = Object.getOwnPropertyDescriptor(value, 'length');
  if (!length || length.value !== count || Reflect.ownKeys(value).length !== count + 1) fail('INPUT', 'an array has the wrong shape or extra fields');
  const out: unknown[] = [];
  for (let i = 0; i < count; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail('INPUT', 'sparse arrays and getters are unsupported');
    out.push(descriptor.value);
  }
  return out;
}
function number(value: unknown, bound: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > bound) fail('INPUT', 'finite bounded numeric coordinates are required');
  return value;
}
function point(value: unknown): Point {
  const values = array(value, 3);
  return [number(values[0], CadNumericPolicy.coordinateAbs), number(values[1], CadNumericPolicy.coordinateAbs), number(values[2], CadNumericPolicy.coordinateAbs)];
}
function uv(value: unknown): [number, number] {
  const values = array(value, 2);
  // A pcurve is still a native Curve: retain its existing Point-coordinate bound.
  return [number(values[0], CadNumericPolicy.geometryCoordinateAbs), number(values[1], CadNumericPolicy.geometryCoordinateAbs)];
}
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(value)) fail('INPUT', 'a bounded native identifier is required');
  return value;
}
function knots(value: unknown, count: number, degree: number): number[] {
  const values = array(value, count), out: number[] = [];
  const left = number(values[0], Number.MAX_VALUE), right = number(values[degree + 1], Number.MAX_VALUE);
  if (!(right > left)) fail('INPUT', 'a positive original native Bezier domain is required');
  for (let i = 0; i < count; i++) {
    const knot = number(values[i], Number.MAX_VALUE);
    if (knot !== (i <= degree ? left : right)) fail('INPUT', 'only one clamped original native Bezier span is supported');
    out.push(knot);
  }
  return out;
}
function surfaceSnapshot(input: unknown): Surface {
  const data = record(input, SURFACE_FIELDS, SURFACE_FIELDS);
  if (data.kind !== 'surface' || data.degreeU !== 2 || data.degreeV !== 1) fail('INPUT', 'an original degree(2,1) rational Bezier Surface is required');
  const poles = array(data.controlPoints, 3), rows = array(data.weights, 3), controlPoints: Point[][] = [], weights: number[][] = [];
  for (let i = 0; i < 3; i++) {
    const row = array(poles[i], 2), ownWeights = array(rows[i], 2), points: Point[] = [], values: number[] = [];
    for (let j = 0; j < 2; j++) {
      points.push(point(row[j]));
      const weight = number(ownWeights[j], 1e6);
      if (weight < 1e-6) fail('INPUT', 'source weights must stay inside the positive native weight range');
      values.push(weight);
    }
    controlPoints.push(points); weights.push(values);
  }
  const original: Surface = { kind: 'surface', id: identifier(data.id), degreeU: 2, degreeV: 1,
    knotsU: knots(data.knotsU, 6, 2), knotsV: knots(data.knotsV, 4, 1), controlPoints, weights };
  validateSurface(original);
  return original;
}
function zeroes(q: SectionRationalContext, count: number): R[] {
  const out: R[] = []; for (let i = 0; i < count; i++) out.push(q.integer(0)); return out;
}
function quadraticBasis(q: SectionRationalContext, a: R, b: R): R[][] {
  const one = q.integer(1), two = q.integer(2), x = q.sub(one, a), y = q.sub(one, b);
  return [[q.mul(x, x), q.mul(x, y), q.mul(y, y)],
    [q.mul(two, q.mul(a, x)), q.add(q.mul(a, y), q.mul(b, x)), q.mul(two, q.mul(b, y))],
    [q.mul(a, a), q.mul(a, b), q.mul(b, b)]];
}
function product21(q: SectionRationalContext, a: readonly R[], b: readonly R[]): R[] {
  const two = q.integer(2), three = q.integer(3);
  return [q.mul(a[0], b[0]), q.div(q.add(q.mul(a[0], b[1]), q.mul(two, q.mul(a[1], b[0]))), three),
    q.div(q.add(q.mul(two, q.mul(a[1], b[1])), q.mul(a[2], b[0])), three), q.mul(a[2], b[1])];
}
function normalizeNativeLine(original: Surface, start: UV, end: UV, ctx: Context): { start: RationalUV; end: RationalUV } {
  const q = ctx.q, u0 = q.from(original.knotsU[2]), u1 = q.from(original.knotsU[3]), v0 = q.from(original.knotsV[1]), v1 = q.from(original.knotsV[2]);
  const du = q.sub(u1, u0), dv = q.sub(v1, v0), maximum = q.from(Number.MAX_VALUE), one = q.integer(1);
  if (du.n <= 0n || dv.n <= 0n || q.compare(du, maximum) > 0 || q.compare(dv, maximum) > 0) fail('INPUT', 'original native parameter spans must be positive and inside the finite binary64 range');
  const normalizedStart: [R, R] = [q.div(q.sub(q.from(start[0]), u0), du), q.div(q.sub(q.from(start[1]), v0), dv)];
  const normalizedEnd: [R, R] = [q.div(q.sub(q.from(end[0]), u0), du), q.div(q.sub(q.from(end[1]), v0), dv)];
  for (let axis = 0; axis < 2; axis++) if (normalizedStart[axis].n < 0n || normalizedEnd[axis].n < 0n || q.compare(normalizedStart[axis], one) > 0 || q.compare(normalizedEnd[axis], one) > 0) fail('INPUT', 'UV endpoints must stay inside the original native Surface domain');
  ctx.check();
  return { start: normalizedStart, end: normalizedEnd };
}
function compose(original: Surface, start: UV, end: UV, ctx: Context): Homogeneous[] {
  const normalized = normalizeNativeLine(original, start, end, ctx), q = ctx.q;
  const u = quadraticBasis(q, normalized.start[0], normalized.end[0]), one = q.integer(1), v0 = normalized.start[1], v1 = normalized.end[1];
  const v = [[q.sub(one, v0), q.sub(one, v1)], [v0, v1]], partition = zeroes(q, 4), out: Homogeneous[] = [];
  for (let k = 0; k < 4; k++) out.push(zeroes(q, 4) as Homogeneous);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const coefficients = product21(q, u[i], v[j]), weight = q.from(original.weights[i][j]);
    const source: Homogeneous = [q.mul(q.from(original.controlPoints[i][j][0]), weight), q.mul(q.from(original.controlPoints[i][j][1]), weight), q.mul(q.from(original.controlPoints[i][j][2]), weight), weight];
    for (let k = 0; k < 4; k++) {
      if (coefficients[k].n < 0n) fail('BINDING', 'the normalized native-domain composition has a negative basis coefficient');
      partition[k] = q.add(partition[k], coefficients[k]);
      for (let axis = 0; axis < 4; axis++) out[k][axis] = q.add(out[k][axis], q.mul(coefficients[k], source[axis]));
      ctx.check();
    }
  }
  for (let k = 0; k < 4; k++) if (q.compare(partition[k], one) !== 0 || out[k][3].n <= 0n) fail('BINDING', 'positive partition/denominator proof failed');
  ctx.check(); return out;
}
function storedCurve(ideal: readonly Homogeneous[], id: string, endpoints: readonly [Point | null, Point | null], ctx: Context): Curve {
  const q = ctx.q, controlPoints: Point[] = [], weights: number[] = [];
  for (let k = 0; k < 4; k++) {
    const weight = q.nearest(ideal[k][3]), pole: Point = [0, 0, 0];
    if (!Number.isFinite(weight) || weight < 1e-6 || weight > 1e6) fail('BINDING', 'the stored denominator leaves the positive native weight range');
    for (let axis = 0; axis < 3; axis++) {
      const supplied = k === 0 ? endpoints[0] : k === 3 ? endpoints[1] : null;
      pole[axis] = supplied ? supplied[axis] : q.nearest(q.div(ideal[k][axis], ideal[k][3]));
      if (!Number.isFinite(pole[axis]) || Math.abs(pole[axis]) > CadNumericPolicy.coordinateAbs) fail('BINDING', 'a stored Cartesian coefficient exceeds the CAD range');
      ctx.check();
    }
    controlPoints.push(pole); weights.push(weight); ctx.check();
  }
  if (controlPoints[0][0] === controlPoints[3][0] && controlPoints[0][1] === controlPoints[3][1] && controlPoints[0][2] === controlPoints[3][2]) fail('GEOMETRY', 'the requested edge collapses at its stored endpoints');
  const curve: Curve = { kind: 'curve', id, degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints, weights };
  validateCurve(curve); return curve;
}
function readStored(curve: Curve, q: SectionRationalContext): Homogeneous[] {
  const out: Homogeneous[] = [];
  for (let k = 0; k < 4; k++) {
    const w = q.from(curve.weights[k]);
    out.push([q.mul(q.from(curve.controlPoints[k][0]), w), q.mul(q.from(curve.controlPoints[k][1]), w), q.mul(q.from(curve.controlPoints[k][2]), w), w]);
  }
  return out;
}
function minimumDenominator(values: readonly Homogeneous[], q: SectionRationalContext): R {
  let min = values[0][3];
  for (let i = 0; i < values.length; i++) {
    if (values[i][3].n <= 0n) fail('BINDING', 'both whole-interval denominator lower bounds must be positive');
    if (q.compare(values[i][3], min) < 0) min = values[i][3];
  }
  return min;
}
function crossResidual(ideal: readonly Homogeneous[], stored: readonly Homogeneous[], axis: number, ctx: Context): R[] {
  const q = ctx.q, out = zeroes(q, 7);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const factor = q.rat(BigInt(CUBIC[i] * CUBIC[j]), BigInt(SEXTIC[i + j]));
    const term = q.sub(q.mul(stored[i][axis], ideal[j][3]), q.mul(ideal[i][axis], stored[j][3]));
    out[i + j] = q.add(out[i + j], q.mul(factor, term)); ctx.check();
  }
  return out;
}
function fractions(q: SectionRationalContext, values: readonly R[]): SectionFraction[] {
  const out: SectionFraction[] = []; for (const value of values) out.push(q.text(value)); return out;
}
function bound(original: Surface, ideal: readonly Homogeneous[], curve: Curve, endpoints: readonly [Point | null, Point | null], errorBudget: number, ctx: Context): CylindricalWrapCurveResult['proof'] {
  const q = ctx.q, stored = readStored(curve, q), exactLower = minimumDenominator(ideal, q), storedLower = minimumDenominator(stored, q), divisor = q.mul(exactLower, storedLower);
  const numeratorError = zeroes(q, 3), residuals: SectionFraction[][] = [], axisError: R[] = [];
  let denominatorError = q.integer(0), total = q.integer(0);
  for (let k = 0; k < 4; k++) {
    denominatorError = q.max(denominatorError, q.abs(q.sub(stored[k][3], ideal[k][3])));
    for (let axis = 0; axis < 3; axis++) numeratorError[axis] = q.max(numeratorError[axis], q.abs(q.sub(stored[k][axis], ideal[k][axis])));
    ctx.check();
  }
  for (let axis = 0; axis < 3; axis++) {
    const residual = crossResidual(ideal, stored, axis, ctx);
    let maximum = q.integer(0);
    for (const coefficient of residual) maximum = q.max(maximum, q.abs(coefficient));
    const error = q.div(maximum, divisor); axisError.push(error); total = q.add(total, error);
    residuals.push(fractions(q, residual)); ctx.check();
  }
  if (q.compare(total, q.from(errorBudget)) > 0) fail('BINDING', 'the whole-interval stored-model error exceeds the binding budget');
  const worldError = q.bound(total), exactDenominatorLower = q.text(exactLower), storedDenominatorLower = q.text(storedLower);
  const homogeneousNumeratorResidual = fractions(q, numeratorError), homogeneousDenominatorResidual = q.text(denominatorError), axes = fractions(q, axisError);
  ctx.check();
  return { authority: 'stored-homogeneous-bernstein-coefficients', sourceId: original.id, originalDegree: [2, 1], composedDegree: 3, residualDegree: 6,
    exactDenominatorLower, storedDenominatorLower, homogeneousNumeratorResidual, homogeneousDenominatorResidual,
    crossResiduals: residuals, axisError: axes, worldError, errorBudget, endpointOrigins: [endpoints[0] ? 'table' : 'nearest', endpoints[1] ? 'table' : 'nearest'],
    parameterDomain: [0, 1], coordinateFrame: 'original-surface-world', exactStoredModelBound: true, globalEvaluatorErrorCertified: false, topologyCertified: false,
    counts: q.counts(), maxOperations: ctx.maxOperations };
}

/** Private coefficient composition in original native UV; caller separately proves carrier/face provenance. */
export function composeCylindricalWrapCurve(surface: Surface, line: CylindricalWrapCurveLine, options: CylindricalWrapCurveOptions): CylindricalWrapCurveResult {
  try {
    const original = surfaceSnapshot(surface), inputLine = record(line, ['start', 'end'], ['start', 'end']), start = uv(inputLine.start), end = uv(inputLine.end);
    if (start[0] === end[0] && start[1] === end[1]) fail('GEOMETRY', 'distinct original native UV endpoints are required');
    const data = record(options, OPTION_FIELDS, ['curveId', 'pcurveId']), curveId = identifier(data.curveId), pcurveId = identifier(data.pcurveId);
    if (curveId === pcurveId || curveId === original.id || pcurveId === original.id) fail('INPUT', 'source, world Curve and pcurve identifiers must differ');
    const errorBudget = data.errorBudget === undefined ? CadNumericPolicy.linearTolerance : number(data.errorBudget, CadNumericPolicy.linearTolerance);
    if (errorBudget <= 0) fail('INPUT', 'the binding budget must be positive and no larger than native policy');
    const maxOperations = data.maxOperations === undefined ? 200000 : number(data.maxOperations, 200000);
    if (!Number.isSafeInteger(maxOperations) || maxOperations < 1) fail('INPUT', 'a tighter positive exact-operation budget is required');
    const provided = data.endpoints === undefined ? [null, null] : array(data.endpoints, 2), endpoints: [Point | null, Point | null] = [provided[0] === null ? null : point(provided[0]), provided[1] === null ? null : point(provided[1])];
    const ctx = new Context(maxOperations), ideal = compose(original, start, end, ctx), curve = storedCurve(ideal, curveId, endpoints, ctx);
    const pcurve: Curve = { kind: 'curve', id: pcurveId, degree: 1, knots: [0, 0, 1, 1], controlPoints: [[start[0], start[1], 0], [end[0], end[1], 0]], weights: [1, 1] };
    validateCurve(pcurve);
    return { original, curve, pcurve, proof: bound(original, ideal, curve, endpoints, errorBudget, ctx) };
  } catch (error) {
    if (isCylindricalWrapCurveError(error)) throw error;
    fail('INPUT', 'the supplied data could not be copied and admitted');
  }
}
