import type { Curve, CurveSample, Model, Point, Surface, SurfaceSample } from '../types.js';

export const MAX_SAMPLES = 4096;

function requireValue(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function validatePoint(point: Point): void {
  requireValue(Array.isArray(point) && point.length === 3, 'A control point must have three coordinates');
  for (let axis = 0; axis < 3; axis++) {
    requireValue(Number.isFinite(point[axis]) && Math.abs(point[axis]) <= 1e6, 'Coordinates must be finite and within 1e6 mm');
  }
}

function validateWeight(weight: number): void {
  requireValue(Number.isFinite(weight) && weight >= 1e-6 && weight <= 1e6, 'Weights must be in [1e-6, 1e6]');
}

function validateKnots(knots: number[], degree: number, count: number): void {
  requireValue(Number.isInteger(degree) && degree >= 1 && degree <= 5 && degree < count, 'Degree must be in 1..5 and smaller than the control point count');
  requireValue(Array.isArray(knots) && knots.length === count + degree + 1, 'Knot count must equal control point count + degree + 1');
  for (let i = 0; i < knots.length; i++) {
    requireValue(Number.isFinite(knots[i]), 'Knots must be finite');
    if (i > 0) requireValue(knots[i] >= knots[i - 1], 'Knots must be nondecreasing');
  }
  const left = knots[degree];
  const right = knots[count];
  requireValue(left < right, 'The knot domain must have positive length');
  for (let i = 0; i <= degree; i++) {
    requireValue(knots[i] === left && knots[count + i] === right, 'Knots must be open and clamped');
  }
  let repeated = 0;
  let previous = left;
  for (let i = degree + 1; i < count; i++) {
    const value = knots[i];
    requireValue(value > left && value < right, 'Endpoint multiplicity must equal degree + 1');
    repeated = value === previous ? repeated + 1 : 1;
    requireValue(repeated <= degree, 'Interior knot multiplicity must not exceed degree');
    previous = value;
  }
}

function validateId(id: string): void {
  requireValue(typeof id === 'string' && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(id), 'Object ID must be a supported identifier');
}

export function validateCurve(curve: Curve): void {
  requireValue(curve !== null && typeof curve === 'object' && curve.kind === 'curve', 'Expected a curve');
  validateId(curve.id);
  requireValue(Array.isArray(curve.controlPoints) && curve.controlPoints.length >= 2 && curve.controlPoints.length <= 64, 'Curve control point count must be in 2..64');
  validateKnots(curve.knots, curve.degree, curve.controlPoints.length);
  requireValue(Array.isArray(curve.weights) && curve.weights.length === curve.controlPoints.length, 'Curve weights must match control points');
  for (let index = 0; index < curve.controlPoints.length; index++) {
    validatePoint(curve.controlPoints[index]);
    validateWeight(curve.weights[index]);
  }
}

export function validateSurface(surface: Surface): void {
  requireValue(surface !== null && typeof surface === 'object' && surface.kind === 'surface', 'Expected a surface');
  validateId(surface.id);
  requireValue(Array.isArray(surface.controlPoints) && surface.controlPoints.length >= 2 && surface.controlPoints.length <= 16, 'Surface U control point count must be in 2..16');
  const countU = surface.controlPoints.length;
  const firstRow = surface.controlPoints[0];
  requireValue(Array.isArray(firstRow) && firstRow.length >= 2 && firstRow.length <= 16, 'Surface V control point count must be in 2..16');
  const countV = firstRow.length;
  requireValue(countU * countV <= 256, 'Surface must have at most 256 control points');
  validateKnots(surface.knotsU, surface.degreeU, countU);
  validateKnots(surface.knotsV, surface.degreeV, countV);
  requireValue(Array.isArray(surface.weights) && surface.weights.length === countU, 'Surface weight rows must match control points');
  for (let u = 0; u < countU; u++) {
    const points = surface.controlPoints[u];
    const weights = surface.weights[u];
    requireValue(Array.isArray(points) && points.length === countV, 'Surface control point grid must be rectangular');
    requireValue(Array.isArray(weights) && weights.length === countV, 'Surface weights must match control points');
    for (let v = 0; v < countV; v++) {
      validatePoint(points[v]);
      validateWeight(weights[v]);
    }
  }
}

export function validateModel(model: Model): void {
  requireValue(model !== null && typeof model === 'object', 'Expected a model');
  requireValue(typeof model.name === 'string' && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(model.name), 'Model name must be a supported identifier');
  requireValue(model.version === 0 && model.lengthUnit === 'mm', 'Only version 0 and mm units are supported');
  requireValue(Array.isArray(model.objects) && model.objects.length >= 1 && model.objects.length <= 16, 'Model object count must be in 1..16');
  const ids = new Set<string>();
  for (const object of model.objects) {
    if (object?.kind === 'curve') validateCurve(object);
    else if (object?.kind === 'surface') validateSurface(object);
    else throw new Error('Only curves and surfaces are supported');
    requireValue(!ids.has(object.id), 'Object IDs must be unique');
    ids.add(object.id);
  }
}

export function curveDomain(curve: Curve): [number, number] {
  validateCurve(curve);
  return [curve.knots[curve.degree], curve.knots[curve.controlPoints.length]];
}

export function surfaceDomain(surface: Surface): { u: [number, number]; v: [number, number] } {
  validateSurface(surface);
  return {
    u: [surface.knotsU[surface.degreeU], surface.knotsU[surface.controlPoints.length]],
    v: [surface.knotsV[surface.degreeV], surface.knotsV[surface.controlPoints[0].length]],
  };
}

/** Compute the local nonzero basis functions. The right endpoint uses the last span. */
export function basis(knots: number[], degree: number, count: number, parameter: number): { start: number; values: number[] } {
  const values = Array<number>(degree + 1).fill(0);
  const start = basisInto(knots, degree, count, parameter, values, Array<number>(degree + 1).fill(0), Array<number>(degree + 1).fill(0));
  return { start, values };
}

/** basis() into caller-owned buffers (length degree + 1); returns the first pole index. */
function basisInto(knots: number[], degree: number, count: number, parameter: number, values: number[], distancesLeft: number[], distancesRight: number[]): number {
  const left = knots[degree];
  const right = knots[count];
  requireValue(Number.isFinite(parameter) && parameter >= left && parameter <= right, 'Parameter is outside the knot domain');
  let span = count - 1;
  if (parameter !== right) {
    let low = degree;
    let high = count;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (knots[mid] <= parameter) low = mid;
      else high = mid;
    }
    span = low;
  }
  values.fill(0); distancesLeft.fill(0); distancesRight.fill(0);
  values[0] = 1;
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  for (let level = 1; level <= degree; level++) {
    const a = parameter - knots[span + 1 - level], b = knots[span + level] - parameter;
    distancesLeft[level] = Number.isFinite(a) ? a / scale : parameter / scale - knots[span + 1 - level] / scale;
    distancesRight[level] = Number.isFinite(b) ? b / scale : knots[span + level] / scale - parameter / scale;
    let saved = 0;
    for (let index = 0; index < level; index++) {
      const denominator = distancesRight[index + 1] + distancesLeft[level - index];
      const previousValue = values[index];
      const rightFraction = denominator === 0 ? 0 : distancesRight[index + 1] / denominator;
      const leftFraction = denominator === 0 ? 0 : distancesLeft[level - index] / denominator;
      values[index] = saved + rightFraction * previousValue;
      saved = leftFraction * previousValue;
    }
    values[level] = saved;
  }
  for (let i = 0; i <= degree; i++) requireValue(Number.isFinite(values[i]), 'Knot arithmetic exceeded the finite range');
  return span - degree;
}

function project(sum: Point, weight: number): Point {
  requireValue(Number.isFinite(weight) && weight > 0, 'Rational denominator must be positive and finite');
  const point: Point = [sum[0] / weight, sum[1] / weight, sum[2] / weight];
  requireValue(point.every(Number.isFinite), 'Evaluated coordinates must be finite');
  return point;
}

function curvePoint(curve: Curve, parameter: number): Point {
  const local = basis(curve.knots, curve.degree, curve.controlPoints.length, parameter);
  const sum: Point = [0, 0, 0];
  let weight = 0;
  for (let index = 0; index < local.values.length; index++) {
    const pole = local.start + index;
    const factor = local.values[index] * curve.weights[pole];
    weight += factor;
    for (let axis = 0; axis < 3; axis++) sum[axis] += factor * curve.controlPoints[pole][axis];
  }
  const point = project(sum, weight);
  // Restore only a full authored coefficient invariant after existing checks.
  for (let axis = 0; axis < 3; axis++) {
    const coordinate = curve.controlPoints[0][axis];
    if (curve.controlPoints.every(pole => Object.is(pole[axis], coordinate))) point[axis] = coordinate;
  }
  return point;
}

function surfacePoint(surface: Surface, u: number, v: number): Point {
  const basisU = basis(surface.knotsU, surface.degreeU, surface.controlPoints.length, u);
  const basisV = basis(surface.knotsV, surface.degreeV, surface.controlPoints[0].length, v);
  const sum: Point = [0, 0, 0];
  let weight = 0;
  for (let i = 0; i < basisU.values.length; i++) {
    for (let j = 0; j < basisV.values.length; j++) {
      const row = basisU.start + i;
      const column = basisV.start + j;
      const factor = basisU.values[i] * basisV.values[j] * surface.weights[row][column];
      weight += factor;
      for (let axis = 0; axis < 3; axis++) sum[axis] += factor * surface.controlPoints[row][column][axis];
    }
  }
  const point = project(sum, weight);
  for (let axis = 0; axis < 3; axis++) {
    const coordinate = surface.controlPoints[0][0][axis];
    if (surface.controlPoints.every(row => row.every(pole => Object.is(pole[axis], coordinate)))) point[axis] = coordinate;
  }
  return point;
}

export function evaluateCurve(curve: Curve, parameter: number): Point {
  validateCurve(curve);
  return curvePoint(curve, parameter);
}

export function evaluateSurface(surface: Surface, u: number, v: number): Point {
  validateSurface(surface);
  return surfacePoint(surface, u, v);
}

/** An evaluator for one curve, validated once (the same points as evaluateCurve). */
export function curveEvaluator(curve: Curve): (t: number) => Point {
  validateCurve(curve);
  const P = curve.controlPoints, W = curve.weights, p = curve.degree, n = P.length;
  const constant = [0, 1, 2].map(axis => P.every(pole => Object.is(pole[axis], P[0][axis])));
  const b = Array<number>(p + 1).fill(0), l = b.slice(), r = b.slice();
  // The same arithmetic as evaluateCurve (bit-identical points), without its per-call allocation and
  // its per-call look at every pole for a constant coordinate.
  return t => {
    const s = basisInto(curve.knots, p, n, t, b, l, r), sum: Point = [0, 0, 0];
    let weight = 0;
    for (let i = 0; i <= p; i++) { const factor = b[i] * W[s + i], pole = P[s + i]; weight += factor; sum[0] += factor * pole[0]; sum[1] += factor * pole[1]; sum[2] += factor * pole[2]; }
    const point = project(sum, weight);
    for (let axis = 0; axis < 3; axis++) if (constant[axis]) point[axis] = P[0][axis];
    return point;
  };
}

/** An evaluator for one surface, validated once (for callers that evaluate it many times). */
export function surfaceEvaluator(surface: Surface): (u: number, v: number) => Point {
  validateSurface(surface);
  const P = surface.controlPoints, W = surface.weights, du = surface.degreeU, dv = surface.degreeV, nu = P.length, nv = P[0].length;
  const constant = [0, 1, 2].map(axis => P.every(row => row.every(pole => Object.is(pole[axis], P[0][0][axis]))));
  const bu = Array<number>(du + 1).fill(0), lu = bu.slice(), ru = bu.slice(), bv = Array<number>(dv + 1).fill(0), lv = bv.slice(), rv = bv.slice();
  // The same arithmetic as evaluateSurface (bit-identical points), without its per-call allocation.
  return (u, v) => {
    const su = basisInto(surface.knotsU, du, nu, u, bu, lu, ru), sv = basisInto(surface.knotsV, dv, nv, v, bv, lv, rv);
    const sum: Point = [0, 0, 0];
    let weight = 0;
    for (let i = 0; i <= du; i++) for (let j = 0; j <= dv; j++) {
      const row = su + i, column = sv + j, factor = bu[i] * bv[j] * W[row][column], pole = P[row][column];
      weight += factor;
      sum[0] += factor * pole[0]; sum[1] += factor * pole[1]; sum[2] += factor * pole[2];
    }
    const point = project(sum, weight);
    for (let axis = 0; axis < 3; axis++) if (constant[axis]) point[axis] = P[0][0][axis];
    return point;
  };
}

function sampleCount(count: number): void {
  requireValue(Number.isInteger(count) && count >= 2 && count <= MAX_SAMPLES, 'Sample count must be an integer in 2..4096');
}

function parameterAt(left: number, right: number, index: number, count: number): number {
  if (index === 0) return left;
  if (index === count - 1) return right;
  const fraction = index / (count - 1);
  return (1 - fraction) * left + fraction * right;
}

/** Uniform parameter samples include both domain boundaries. */
export function sampleCurve(curve: Curve, count: number): CurveSample[] {
  sampleCount(count);
  const [left, right] = curveDomain(curve);
  return Array.from({ length: count }, (_, index) => {
    const parameter = parameterAt(left, right, index, count);
    return { parameter, point: curvePoint(curve, parameter) };
  });
}

/** Rows follow U and columns follow V. The product of counts is at most 4096. */
export function sampleSurface(surface: Surface, countU: number, countV: number): SurfaceSample[][] {
  sampleCount(countU);
  sampleCount(countV);
  requireValue(countU * countV <= MAX_SAMPLES, 'Surface sample count must not exceed 4096');
  const domain = surfaceDomain(surface);
  return Array.from({ length: countU }, (_, i) => {
    const u = parameterAt(domain.u[0], domain.u[1], i, countU);
    return Array.from({ length: countV }, (_, j) => {
      const v = parameterAt(domain.v[0], domain.v[1], j, countV);
      return { u, v, point: surfacePoint(surface, u, v) };
    });
  });
}
