import { validateCurve, validateSurface } from './math.js';
import type { Curve, Point, Surface } from '../types.js';

export interface CurveD1Result { point: Point; derivative: Point }
export interface SurfaceD1Result { point: Point; du: Point; dv: Point }

function finite(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Derivative arithmetic exceeded the finite range');
  return value;
}

/** Local basis and analytic derivatives in ORIGINAL knot units. */
function basisD1(knots: number[], degree: number, count: number, parameter: number) {
  const left = knots[degree], right = knots[count];
  if (!Number.isFinite(parameter) || parameter < left || parameter > right) throw new Error('Parameter is outside the knot domain');
  if (parameter > left && parameter < right) {
    let multiplicity = 0;
    for (const knot of knots) if (knot === parameter) multiplicity++;
    if (degree - multiplicity < 1) throw new Error('First derivative is not defined at an exact C0 interior knot');
  }
  let span = count - 1;
  if (parameter !== right) {
    let low = degree, high = count;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (knots[mid] <= parameter) low = mid;
      else high = mid;
    }
    span = low;
  }
  // Match the established point evaluator's stabilized distance arithmetic.
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  const distance = (a: number, b: number) => {
    const delta = a - b;
    const result = finite(Number.isFinite(delta) ? delta / scale : a / scale - b / scale);
    if (a !== b && result === 0) throw new Error('Derivative knot distance is not representable');
    return result;
  };
  const values = Array<number>(degree + 1).fill(0);
  const dl = Array<number>(degree + 1).fill(0), dr = Array<number>(degree + 1).fill(0);
  values[0] = 1;
  let lower = [1];
  for (let level = 1; level <= degree; level++) {
    if (level === degree) lower = values.slice(0, level);
    dl[level] = distance(parameter, knots[span + 1 - level]);
    dr[level] = distance(knots[span + level], parameter);
    let saved = 0;
    for (let index = 0; index < level; index++) {
      const denominator = finite(dr[index + 1] + dl[level - index]);
      const previous = values[index];
      const rf = denominator === 0 ? 0 : finite(dr[index + 1] / denominator);
      const lf = denominator === 0 ? 0 : finite(dl[level - index] / denominator);
      values[index] = finite(saved + rf * previous);
      saved = finite(lf * previous);
    }
    values[level] = saved;
  }
  const start = span - degree;
  const term = (value: number, a: number, b: number) => {
    if (a === b || value === 0) return 0;
    const delta = b - a;
    // Divide in this order: no overflowing reciprocal or normalized derivative.
    return finite(Number.isFinite(delta) ? degree * value / delta :
      (degree * value / scale) / finite(b / scale - a / scale));
  };
  const derivatives = values.map((_, index) => {
    const pole = start + index;
    const first = index === 0 ? 0 : term(lower[index - 1], knots[pole], knots[pole + degree]);
    const second = index === degree ? 0 : term(lower[index], knots[pole + 1], knots[pole + degree + 1]);
    return finite(first - second);
  });
  return { start, values, derivatives };
}

function add(sum: Point, pole: Point, factor: number) {
  finite(factor);
  for (let axis = 0; axis < 3; axis++) sum[axis] = finite(sum[axis] + finite(factor * pole[axis]));
}
function project(sum: Point, weight: number): Point {
  if (!Number.isFinite(weight) || weight <= 0) throw new Error('Rational denominator must be positive and finite');
  return [finite(sum[0] / weight), finite(sum[1] / weight), finite(sum[2] / weight)];
}
function quotient(sum: Point, weightD1: number, point: Point, weight: number): Point {
  return [quotientAxis(sum, weightD1, point, weight, 0), quotientAxis(sum, weightD1, point, weight, 1), quotientAxis(sum, weightD1, point, weight, 2)];
}
function quotientAxis(sum: Point, weightD1: number, point: Point, weight: number, axis: number): number {
  return finite(finite(sum[axis] - finite(weightD1 * point[axis])) / weight);
}

/** Endpoints use the interior span; exact C0 knots reject. Zero tangents are valid. */
export function evaluateCurveD1(curve: Curve, parameter: number): CurveD1Result {
  validateCurve(curve);
  return curveD1(curve, parameter, constantAxes(curve));
}
/** `evaluateCurveD1` for one curve, validated once: the same arithmetic, bit for bit. */
export function curveD1Evaluator(curve: Curve): (parameter: number) => CurveD1Result {
  validateCurve(curve);
  const constant = constantAxes(curve);
  return parameter => curveD1(curve, parameter, constant);
}
/** Which coordinates every pole shares (restored exactly, with no derivative). */
function constantAxes(curve: Curve): boolean[] {
  return [0, 1, 2].map(axis => curve.controlPoints.every(pole => Object.is(pole[axis], curve.controlPoints[0][axis])));
}
function curveD1(curve: Curve, parameter: number, constant: readonly boolean[]): CurveD1Result {
  const basis = basisD1(curve.knots, curve.degree, curve.controlPoints.length, parameter);
  const sum: Point = [0, 0, 0], sumD1: Point = [0, 0, 0];
  let weight = 0, weightD1 = 0;
  for (let i = 0; i < basis.values.length; i++) {
    const pole = basis.start + i;
    const factor = finite(basis.values[i] * curve.weights[pole]);
    const dFactor = finite(basis.derivatives[i] * curve.weights[pole]);
    weight = finite(weight + factor); weightD1 = finite(weightD1 + dFactor);
    add(sum, curve.controlPoints[pole], factor); add(sumD1, curve.controlPoints[pole], dFactor);
  }
  const point = project(sum, weight), derivative = quotient(sumD1, weightD1, point, weight);
  // Finish every legacy quotient with its legacy point before restoring constants.
  for (let axis = 0; axis < 3; axis++) if (constant[axis]) { point[axis] = curve.controlPoints[0][axis]; derivative[axis] = 0; }
  return { point, derivative };
}

/** Original U/V partials, without normalization or a surface regularity claim. */
export function evaluateSurfaceD1(surface: Surface, u: number, v: number): SurfaceD1Result {
  validateSurface(surface);
  return surfaceD1(surface, u, v, surfaceConstantAxes(surface));
}
/** `evaluateSurfaceD1` for one surface, validated once: the same arithmetic, bit for bit (K8, D185). */
export function surfaceD1Evaluator(surface: Surface): (u: number, v: number) => SurfaceD1Result {
  validateSurface(surface);
  const constant = surfaceConstantAxes(surface);
  return (u, v) => surfaceD1(surface, u, v, constant);
}
/** Which coordinates every pole shares (restored exactly, with no derivative). */
function surfaceConstantAxes(surface: Surface): boolean[] {
  return [0, 1, 2].map(axis => { const coordinate = surface.controlPoints[0][0][axis]; return surface.controlPoints.every(row => row.every(pole => Object.is(pole[axis], coordinate))); });
}
function surfaceD1(surface: Surface, u: number, v: number, constant: readonly boolean[]): SurfaceD1Result {
  const bu = basisD1(surface.knotsU, surface.degreeU, surface.controlPoints.length, u);
  const bv = basisD1(surface.knotsV, surface.degreeV, surface.controlPoints[0].length, v);
  const sum: Point = [0, 0, 0], su: Point = [0, 0, 0], sv: Point = [0, 0, 0];
  let weight = 0, wu = 0, wv = 0;
  for (let i = 0; i < bu.values.length; i++) for (let j = 0; j < bv.values.length; j++) {
    const row = bu.start + i, column = bv.start + j, w = surface.weights[row][column];
    const f = finite(bu.values[i] * bv.values[j] * w);
    const fu = finite(bu.derivatives[i] * bv.values[j] * w);
    const fv = finite(bu.values[i] * bv.derivatives[j] * w);
    weight = finite(weight + f); wu = finite(wu + fu); wv = finite(wv + fv);
    const pole = surface.controlPoints[row][column];
    add(sum, pole, f); add(su, pole, fu); add(sv, pole, fv);
  }
  const point = project(sum, weight), du = quotient(su, wu, point, weight), dv = quotient(sv, wv, point, weight);
  for (let axis = 0; axis < 3; axis++) if (constant[axis]) { const coordinate = surface.controlPoints[0][0][axis]; point[axis] = coordinate; du[axis] = 0; dv[axis] = 0; }
  return { point, du, dv };
}
