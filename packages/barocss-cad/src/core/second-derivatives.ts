import { CadNumericPolicy } from '../numeric-policy.js';
import { basis, validateCurve, validateSurface } from './math.js';
import { evaluateCurveD1, surfaceD1Evaluator } from './derivatives.js';
import type { Curve, Surface, Point } from '../types.js';
import { KernelError } from './barocss-error.js';

export const NativeSecondDerivativeDiagnosticCode = Object.freeze({ INPUT: 'INPUT', CONTINUITY: 'CONTINUITY', ARITHMETIC: 'ARITHMETIC', NATIVE: 'NATIVE' } as const);
export type NativeSecondDerivativeDiagnosticCode = typeof NativeSecondDerivativeDiagnosticCode[keyof typeof NativeSecondDerivativeDiagnosticCode];
export class NativeSecondDerivativeError extends KernelError {
  readonly code: NativeSecondDerivativeDiagnosticCode;
  constructor(code: NativeSecondDerivativeDiagnosticCode, detail: string, cause?: unknown) {
    super(('Native second derivative: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'NativeSecondDerivativeError'; this.code = code;
  }
}
export interface CurveD2Result { point: Point; derivative: Point; secondDerivative: Point }
export interface SurfaceD2Result { point: Point; du: Point; dv: Point; duu: Point; duv: Point; dvv: Point }

const CODE = NativeSecondDerivativeDiagnosticCode;
type Homogeneous = [number, number, number, number];
type LocalBasis = ReturnType<typeof basis>;

function check(condition: boolean, code: NativeSecondDerivativeDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new NativeSecondDerivativeError(code, detail);
}
function native<T>(action: () => T, detail: string, code: NativeSecondDerivativeDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof NativeSecondDerivativeError) throw cause;
    throw new NativeSecondDerivativeError(code, detail, cause);
  }
}
function finite(value: number): number {
  check(Number.isFinite(value), CODE.ARITHMETIC, 'Finite arithmetic range exceeded');
  return value;
}
function product(a: number, b: number): number {
  const result = finite(a * b);
  check(a === 0 || b === 0 || result !== 0, CODE.ARITHMETIC, 'Nonzero product is not representable');
  return result;
}
function quotient(a: number, b: number): number {
  check(Number.isFinite(b) && b !== 0, CODE.ARITHMETIC, 'A finite nonzero denominator is required');
  const result = finite(a / b);
  check(a === 0 || result !== 0, CODE.ARITHMETIC, 'Nonzero quotient is not representable');
  return result;
}

/** Copy only bounded, dense, getter-free plain data before native admission. */
function snapshot(input: unknown): unknown {
  let remaining = 32768;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 8, CODE.INPUT, 'Input value or depth limit exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      check(Number.isFinite(value), CODE.INPUT, 'Finite input numbers are required');
      return value;
    }
    if (typeof value === 'string') {
      check(value.length <= 128, CODE.INPUT, 'Input string limit exceeded');
      return value;
    }
    check(typeof value === 'object', CODE.INPUT, 'Plain input data is required');
    check(!ancestors.has(value), CODE.INPUT, 'Cyclic input is refused');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      CODE.INPUT, 'Plain input prototypes are required');
    const keys = Reflect.ownKeys(value);
    check(keys.length <= (array ? 129 : 16), CODE.INPUT, 'Input field limit exceeded');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)),
    CODE.INPUT, 'Getter, symbol, or hidden input fields are refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 128 && keys.length === length + 1,
        CODE.INPUT, 'Dense arrays with at most 128 elements are required');
      result = Array.from({ length }, (_, index) => {
        check(Object.hasOwn(descriptors, String(index)), CODE.INPUT, 'Sparse or extra array fields are refused');
        return copy(descriptors[String(index)].value, depth + 1);
      });
    } else {
      result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    }
    ancestors.delete(value);
    return result;
  };
  return native(() => copy(input, 0), 'Input snapshot failed', CODE.INPUT);
}
function exactRecord(value: unknown, fields: string[]): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), CODE.INPUT, 'A native data record is required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    CODE.INPUT, 'Exact native data fields are required');
  return data;
}
function boundedDegree(value: unknown): void {
  check(typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5,
    CODE.INPUT, 'Degree must be an integer in 1..5');
}
function boundedArray(value: unknown, minimum: number, maximum: number): asserts value is unknown[] {
  check(Array.isArray(value) && value.length >= minimum && value.length <= maximum,
    CODE.INPUT, 'Native array size is outside the supported range');
}
function boundedNumbers(value: unknown, limit = 10000, what = 'knots'): void {
  check(Array.isArray(value) && value.every(number => typeof number === 'number' && Math.abs(number) <= limit),
    CODE.INPUT, `Original ${what} must be finite and within ${limit}`);
}
/** Coordinates use the geometry range (CadNumericPolicy); knots and parameters stay within 10000. */
const coordinates = (value: unknown) => boundedNumbers(value, CadNumericPolicy.geometryCoordinateAbsMM, 'coordinates (mm)');
function admittedCurve(input: Curve): Curve {
  const data = exactRecord(snapshot(input), ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']);
  boundedDegree(data.degree);
  boundedArray(data.controlPoints, 2, 64);
  for (const point of data.controlPoints) coordinates(point);
  boundedNumbers(data.knots);
  const curve = data as unknown as Curve;
  native(() => validateCurve(curve), 'Native Curve validation failed');
  return curve;
}
function admittedSurface(input: Surface): Surface {
  const data = exactRecord(snapshot(input), ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']);
  boundedDegree(data.degreeU); boundedDegree(data.degreeV);
  boundedArray(data.controlPoints, 2, 16);
  for (const row of data.controlPoints) {
    boundedArray(row, 2, 16);
    for (const point of row) coordinates(point);
  }
  boundedNumbers(data.knotsU); boundedNumbers(data.knotsV);
  const surface = data as unknown as Surface;
  native(() => validateSurface(surface), 'Native Surface validation failed');
  return surface;
}
function admitParameter(knots: number[], degree: number, count: number, parameter: number): void {
  const left = knots[degree], right = knots[count];
  check(typeof parameter === 'number' && Number.isFinite(parameter) && Math.abs(parameter) <= 10000
    && parameter >= left && parameter <= right, CODE.INPUT, 'Parameter must be inside the closed original knot domain and within 10000');
  if (parameter > left && parameter < right) {
    const multiplicity = knots.reduce((count, knot) => count + (knot === parameter ? 1 : 0), 0);
    check(multiplicity === 0 || degree - multiplicity >= 2, CODE.CONTINUITY,
      'Second derivatives require C2 continuity at an exact interior knot');
  }
}

/** Reuse the native basis on trimmed knots, including degree zero. */
function derivativeBasis(knots: number[], degree: number, count: number, parameter: number, order: number): LocalBasis | null {
  if (order > degree) return null;
  const trimmed = knots.slice(order, knots.length - order), reducedDegree = degree - order;
  const local = native(() => basis(trimmed, reducedDegree, count - order, parameter), 'Native basis evaluation failed');
  const span = local.start + reducedDegree;
  const scale = Math.max(1, Math.abs(trimmed[reducedDegree]), Math.abs(trimmed[count - order]));
  // Check the distances used by the unchanged stabilized basis arithmetic.
  for (let level = 1; level <= reducedDegree; level++) {
    quotient(finite(parameter - trimmed[span + 1 - level]), scale);
    quotient(finite(trimmed[span + level] - parameter), scale);
  }
  for (let index = 0; index < local.values.length; index++) {
    const value = local.values[index], pole = local.start + index;
    finite(value);
    check(value !== 0 || !(parameter > trimmed[pole] && parameter < trimmed[pole + reducedDegree + 1]),
      CODE.ARITHMETIC, 'An active basis value is not representable');
  }
  return local;
}
function zero(): Homogeneous { return [0, 0, 0, 0]; }
function homogeneous(point: Point, weight: number): Homogeneous {
  return [product(weight, point[0]), product(weight, point[1]), product(weight, point[2]), weight];
}
function difference(high: Homogeneous, low: Homogeneous, degree: number, distance: number): Homogeneous {
  return high.map((value, axis) => quotient(product(degree, finite(value - low[axis])), distance)) as Homogeneous;
}
function accumulate(sum: Homogeneous, coefficient: Homogeneous, factor: number): void {
  for (let axis = 0; axis < 4; axis++) sum[axis] = finite(sum[axis] + product(factor, coefficient[axis]));
}
function curveCoefficients(curve: Curve): (order: number, index: number, active?: boolean) => Homogeneous {
  const cache = new Map<string, Homogeneous>();
  const get = (order: number, index: number, active = false): Homogeneous => {
    const key = `${order}:${index}`, saved = cache.get(key);
    if (saved) return saved;
    let value: Homogeneous;
    if (order === 0) value = homogeneous(curve.controlPoints[index], curve.weights[index]);
    else {
      const left = curve.knots[index + order], right = curve.knots[index + curve.degree + 1];
      const distance = finite(right - left);
      if (distance === 0) {
        // Equal support endpoints prove that this derivative basis is identically zero.
        check(!active && left === right, CODE.ARITHMETIC, 'An active derivative control span has zero support');
        value = zero();
      } else value = difference(get(order - 1, index + 1), get(order - 1, index), curve.degree - order + 1, distance);
    }
    cache.set(key, value);
    return value;
  };
  return get;
}
function curveSum(local: LocalBasis | null, order: number, get: ReturnType<typeof curveCoefficients>): Homogeneous {
  const sum = zero();
  if (local) for (let index = 0; index < local.values.length; index++) {
    const factor = local.values[index];
    if (factor !== 0) accumulate(sum, get(order, local.start + index, true), factor);
  }
  return sum;
}
function surfaceCoefficients(surface: Surface): (orderU: number, orderV: number, row: number, column: number, active?: boolean) => Homogeneous {
  const cache = new Map<string, Homogeneous>();
  const get = (orderU: number, orderV: number, row: number, column: number, active = false): Homogeneous => {
    const key = `${orderU}:${orderV}:${row}:${column}`, saved = cache.get(key);
    if (saved) return saved;
    let value: Homogeneous;
    if (orderU === 0 && orderV === 0) value = homogeneous(surface.controlPoints[row][column], surface.weights[row][column]);
    else {
      const alongU = orderU > 0, order = alongU ? orderU : orderV;
      const index = alongU ? row : column, degree = alongU ? surface.degreeU : surface.degreeV;
      const knots = alongU ? surface.knotsU : surface.knotsV;
      const left = knots[index + order], right = knots[index + degree + 1], distance = finite(right - left);
      if (distance === 0) {
        check(!active && left === right, CODE.ARITHMETIC, 'An active tensor derivative control span has zero support');
        value = zero();
      } else {
        const high = alongU ? get(orderU - 1, orderV, row + 1, column) : get(orderU, orderV - 1, row, column + 1);
        const low = alongU ? get(orderU - 1, orderV, row, column) : get(orderU, orderV - 1, row, column);
        value = difference(high, low, degree - order + 1, distance);
      }
    }
    cache.set(key, value);
    return value;
  };
  return get;
}
function surfaceSum(bu: LocalBasis | null, bv: LocalBasis | null, orderU: number, orderV: number,
  get: ReturnType<typeof surfaceCoefficients>): Homogeneous {
  const sum = zero();
  if (bu && bv) for (let i = 0; i < bu.values.length; i++) for (let j = 0; j < bv.values.length; j++) {
    const factor = product(bu.values[i], bv.values[j]);
    if (factor !== 0) accumulate(sum, get(orderU, orderV, bu.start + i, bv.start + j, true), factor);
  }
  return sum;
}
function secondPartial(second: Homogeneous, firstWeight: number, otherWeight: number,
  first: Point, other: Point, point: Point, weight: number): Point {
  check(weight > 0, CODE.ARITHMETIC, 'The homogeneous weight must be positive');
  return [0, 1, 2].map(axis => quotient(finite(finite(finite(second[axis]
    - product(firstWeight, other[axis])) - product(otherWeight, first[axis]))
    - product(second[3], point[axis])), weight)) as Point;
}
function copyPoint(point: Point): Point { return [point[0], point[1], point[2]]; }

/** Analytic second derivative in original knot units. Endpoints use the interior span. */
export function evaluateCurveD2(curveInput: Curve, parameter: number): CurveD2Result {
  const curve = admittedCurve(curveInput), count = curve.controlPoints.length;
  admitParameter(curve.knots, curve.degree, count, parameter);
  const d1 = native(() => evaluateCurveD1(curve, parameter), 'Native Curve D1 evaluation failed');
  const get = curveCoefficients(curve);
  const locals = [0, 1, 2].map(order => derivativeBasis(curve.knots, curve.degree, count, parameter, order));
  const h = curveSum(locals[0], 0, get), first = curveSum(locals[1], 1, get), second = curveSum(locals[2], 2, get);
  return { point: copyPoint(d1.point), derivative: copyPoint(d1.derivative),
    secondDerivative: secondPartial(second, first[3], first[3], d1.derivative, d1.derivative, d1.point, h[3]) };
}

/** Analytic tensor partials in original U/V knot units. Zero tangents remain valid. */
export function evaluateSurfaceD2(surfaceInput: Surface, u: number, v: number): SurfaceD2Result {
  return surfaceD2Evaluator(surfaceInput)(u, v);
}
/**
 * `evaluateSurfaceD2` for one surface, admitted once (its snapshot and validation): each call admits only its
 * parameters, the same arithmetic bit for bit (K8, D185: a point's foot asks for second derivatives some 12 times).
 */
export function surfaceD2Evaluator(surfaceInput: Surface): (u: number, v: number) => SurfaceD2Result {
  const surface = admittedSurface(surfaceInput), countU = surface.controlPoints.length, countV = surface.controlPoints[0].length;
  const get = surfaceCoefficients(surface), d1Of = surfaceD1Evaluator(surface);
  return (u, v) => {
    admitParameter(surface.knotsU, surface.degreeU, countU, u);
    admitParameter(surface.knotsV, surface.degreeV, countV, v);
    const d1 = native(() => d1Of(u, v), 'Native Surface D1 evaluation failed');
    const bu = [0, 1, 2].map(order => derivativeBasis(surface.knotsU, surface.degreeU, countU, u, order));
    const bv = [0, 1, 2].map(order => derivativeBasis(surface.knotsV, surface.degreeV, countV, v, order));
    const h = surfaceSum(bu[0], bv[0], 0, 0, get);
    const hu = surfaceSum(bu[1], bv[0], 1, 0, get), hv = surfaceSum(bu[0], bv[1], 0, 1, get);
    const huu = surfaceSum(bu[2], bv[0], 2, 0, get), huv = surfaceSum(bu[1], bv[1], 1, 1, get);
    const hvv = surfaceSum(bu[0], bv[2], 0, 2, get);
    return { point: copyPoint(d1.point), du: copyPoint(d1.du), dv: copyPoint(d1.dv),
      duu: secondPartial(huu, hu[3], hu[3], d1.du, d1.du, d1.point, h[3]),
      duv: secondPartial(huv, hu[3], hv[3], d1.du, d1.dv, d1.point, h[3]),
      dvv: secondPartial(hvv, hv[3], hv[3], d1.dv, d1.dv, d1.point, h[3]) };
  };
}
