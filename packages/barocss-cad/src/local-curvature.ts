import { evaluateCurveD2, evaluateSurfaceD2 } from './second-derivatives.js';
import type { CurveD2Result, SurfaceD2Result } from './second-derivatives.js';
import type { Curve, Surface, Point } from './types.js';

export const NativeCurvatureDiagnosticCode = Object.freeze({
  DERIVATIVE: 'DERIVATIVE', REGULARITY: 'REGULARITY', ARITHMETIC: 'ARITHMETIC',
} as const);
export type NativeCurvatureDiagnosticCode = typeof NativeCurvatureDiagnosticCode[keyof typeof NativeCurvatureDiagnosticCode];
export class NativeCurvatureError extends Error {
  readonly code: NativeCurvatureDiagnosticCode;
  constructor(code: NativeCurvatureDiagnosticCode, detail: string, cause?: unknown) {
    super(('Native curvature: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'NativeCurvatureError';
    this.code = code;
  }
}
export interface CurveCurvatureResult {
  derivatives: CurveD2Result;
  speedMM: number;
  unitTangent: Point;
  curvaturePerMM: number;
  curvatureVectorPerMM: Point;
  radiusMM: number | null;
}
export interface SurfaceCurvatureResult {
  derivatives: SurfaceD2Result;
  unitNormal: Point;
  normalizedMetric: { cosineUV: number; determinant: number; tangentNormsMM: [number, number] };
  normalizedSecondFormPerMM: { uu: number; uv: number; vv: number };
  meanCurvaturePerMM: number;
  gaussianCurvaturePerMM2: number;
  principalCurvaturesPerMM: [number, number];
  umbilicDiscriminant: { scalePerMM: number; rawScaled: number; roundoffBoundScaled: number; clampedToZero: boolean };
}

const CODE = NativeCurvatureDiagnosticCode;
const ROUNDING = 512 * Number.EPSILON;
function check(condition: boolean, code: NativeCurvatureDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new NativeCurvatureError(code, detail);
}
function derivative<T>(evaluate: () => T): T {
  try { return evaluate(); } catch (cause) {
    // Preserve the actual D2 error and its admission code without reading caller data.
    throw new NativeCurvatureError(CODE.DERIVATIVE, 'Native D2 evaluation failed', cause);
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
function dot(a: Point, b: Point): number {
  return finite(finite(product(a[0], b[0]) + product(a[1], b[1])) + product(a[2], b[2]));
}
function cross(a: Point, b: Point): Point {
  return [finite(product(a[1], b[2]) - product(a[2], b[1])),
    finite(product(a[2], b[0]) - product(a[0], b[2])),
    finite(product(a[0], b[1]) - product(a[1], b[0]))];
}
function tangentNorm(tangent: Point): number {
  const norm = Math.hypot(...tangent);
  check(Number.isFinite(norm) && norm > 0, CODE.REGULARITY, 'A positive finite tangent norm is required');
  return norm;
}
function unit(vector: Point, norm: number): Point {
  const result: Point = [quotient(vector[0], norm), quotient(vector[1], norm), quotient(vector[2], norm)];
  check(Math.abs(finite(Math.hypot(...result) - 1)) <= ROUNDING,
    CODE.ARITHMETIC, 'Unit-vector normalization residual exceeded its rounding bound');
  return result;
}

/** Local geometric curvature in inverse millimetres; a straight regular Curve is valid. */
export function evaluateCurveCurvature(curve: Curve, parameter: number): CurveCurvatureResult {
  const derivatives = derivative(() => evaluateCurveD2(curve, parameter));
  const speedMM = tangentNorm(derivatives.derivative), unitTangent = unit(derivatives.derivative, speedMM);
  const tangential = dot(unitTangent, derivatives.secondDerivative);
  const curvatureVectorPerMM = [0, 1, 2].map(axis => quotient(quotient(finite(derivatives.secondDerivative[axis]
    - product(unitTangent[axis], tangential)), speedMM), speedMM)) as Point;
  const curvaturePerMM = finite(Math.hypot(...curvatureVectorPerMM));
  const radiusMM = curvaturePerMM === 0 ? null : quotient(1, curvaturePerMM);
  return { derivatives, speedMM, unitTangent, curvaturePerMM, curvatureVectorPerMM, radiusMM };
}

/** Native U/V-oriented local surface curvature with a disclosed discriminant rounding policy. */
export function evaluateSurfaceCurvature(surface: Surface, u: number, v: number): SurfaceCurvatureResult {
  const derivatives = derivative(() => evaluateSurfaceD2(surface, u, v));
  const normU = tangentNorm(derivatives.du), normV = tangentNorm(derivatives.dv);
  const tu = unit(derivatives.du, normU), tv = unit(derivatives.dv, normV);
  const cosineUV = dot(tu, tv), squaredCosine = product(cosineUV, cosineUV);
  const determinant = finite(1 - squaredCosine);
  const metricBound = product(ROUNDING, finite(1 + Math.abs(squaredCosine)));
  check(determinant > metricBound, CODE.REGULARITY, 'Native tangent directions are collinear or too nearly parallel');
  const normal = cross(tu, tv), normalNorm = Math.hypot(...normal);
  check(Number.isFinite(normalNorm) && normalNorm > 0, CODE.REGULARITY, 'A positive finite native cross-product norm is required');
  check(Math.abs(finite(product(normalNorm, normalNorm) - determinant)) <= metricBound,
    CODE.ARITHMETIC, 'Native cross-product metric residual exceeded its rounding bound');
  const unitNormal = unit(normal, normalNorm), perpendicularBound = quotient(ROUNDING, normalNorm);
  check(Math.abs(dot(unitNormal, tu)) <= perpendicularBound && Math.abs(dot(unitNormal, tv)) <= perpendicularBound,
    CODE.ARITHMETIC, 'Native normal orthogonality residual exceeded its rounding bound');
  const uu = quotient(quotient(dot(unitNormal, derivatives.duu), normU), normU);
  const uv = quotient(quotient(dot(unitNormal, derivatives.duv), normU), normV);
  const vv = quotient(quotient(dot(unitNormal, derivatives.dvv), normV), normV);
  const normalizedMetric = { cosineUV, determinant, tangentNormsMM: [normU, normV] as [number, number] };
  const normalizedSecondFormPerMM = { uu, uv, vv };
  const scalePerMM = Math.max(Math.abs(uu), Math.abs(uv), Math.abs(vv));
  if (scalePerMM === 0) {
    return { derivatives, unitNormal, normalizedMetric, normalizedSecondFormPerMM,
      meanCurvaturePerMM: 0, gaussianCurvaturePerMM2: 0, principalCurvaturesPerMM: [0, 0],
      umbilicDiscriminant: { scalePerMM: 0, rawScaled: 0, roundoffBoundScaled: 0, clampedToZero: false } };
  }
  const e = quotient(uu, scalePerMM), f = quotient(uv, scalePerMM), g = quotient(vv, scalePerMM);
  const h = quotient(finite(finite(e - product(2, product(cosineUV, f))) + g), product(2, determinant));
  const k = quotient(finite(product(e, g) - product(f, f)), determinant);
  const meanCurvaturePerMM = product(scalePerMM, h);
  const gaussianCurvaturePerMM2 = product(scalePerMM, product(scalePerMM, k));
  const squaredH = product(h, h), rawScaled = finite(squaredH - k);
  const roundoffBoundScaled = product(ROUNDING, finite(Math.abs(squaredH) + Math.abs(k)));
  const clampedToZero = rawScaled < 0;
  check(!clampedToZero || Math.abs(rawScaled) <= roundoffBoundScaled,
    CODE.ARITHMETIC, 'Negative principal-curvature discriminant exceeded its declared rounding bound');
  const root = finite(Math.sqrt(clampedToZero ? 0 : rawScaled));
  const principalCurvaturesPerMM: [number, number] = [product(scalePerMM, finite(h - root)), product(scalePerMM, finite(h + root))];
  return { derivatives, unitNormal, normalizedMetric, normalizedSecondFormPerMM,
    meanCurvaturePerMM, gaussianCurvaturePerMM2, principalCurvaturesPerMM,
    umbilicDiscriminant: { scalePerMM, rawScaled, roundoffBoundScaled, clampedToZero } };
}
