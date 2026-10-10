import { validateCurve, validateSurface, curveDomain, surfaceDomain, evaluateCurve, evaluateSurface } from './math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from './derivatives.js';
import type { CurveD1Result, SurfaceD1Result } from './derivatives.js';
import { adopt } from './own-plane-cylinder-intersection-internal.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Surface, Model, Point } from './types.js';

export const AffineGeometryTransformDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', MATRIX: 'MATRIX', BUDGET: 'BUDGET',
  NATIVE: 'NATIVE', REPRESENTABILITY: 'REPRESENTABILITY', BINDING: 'BINDING', OWNED: 'OWNED' } as const);
export type AffineGeometryTransformDiagnosticCode = typeof AffineGeometryTransformDiagnosticCode[keyof typeof AffineGeometryTransformDiagnosticCode];
export class AffineGeometryTransformError extends Error {
  readonly code: AffineGeometryTransformDiagnosticCode;
  constructor(code: AffineGeometryTransformDiagnosticCode, detail: string, cause?: unknown) {
    super(('Affine native geometry transform: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'AffineGeometryTransformError'; this.code = code;
  }
}
export type CadAffineMatrix3x4 = [number, number, number, number, number, number, number, number, number, number, number, number];
export interface AffineGeometryTransformOptions { geometryId: string; maximumObservations: number }
type D1State<T> = { status: 'evaluated'; value: T } | { status: 'native-refused'; reason: string; nativeErrorName: string };
type PointObservation = { originalPointMM: Point; expectedPointMM: Point; actualPointMM: Point; differenceMM: number };
export type AffineGeometryTransformObservation =
  PointObservation & { kind: 'curve'; parameter: number; originalD1: D1State<CurveD1Result>; targetD1: D1State<CurveD1Result>;
    expectedDerivativeMM: Point | null; relativeDerivativeDifference: number | null }
  | PointObservation & { kind: 'surface'; u: number; v: number; originalD1: D1State<SurfaceD1Result>; targetD1: D1State<SurfaceD1Result>;
    expectedDuMM: Point | null; expectedDvMM: Point | null; relativeDuDifference: number | null; relativeDvDifference: number | null;
    expectedCrossMM2: Point | null; actualCrossMM2: Point | null; relativeCrossDifference: number | null; crossDegenerate: boolean | null };
export interface AffineGeometryTransformReport {
  schema: 'barocss-native-affine-geometry-transform'; version: 0; originalId: string; geometryId: string; kind: 'curve' | 'surface'; lengthUnit: 'mm'; sourceFrame: 'authored-xyz-no-axis-conversion';
  matrixRoles: { order: 'row-major-three-by-four-column-vector'; linearUnit: 'dimensionless'; translationUnit: 'mm' };
  determinant: number; signedTripleTerms: [number, number, number, number, number, number]; absoluteTripleSum: number; determinantThreshold: number; handedness: 'preserved' | 'reversed';
  domains: { curve: [number, number] | null; u: [number, number] | null; v: [number, number] | null };
  samples: { curve: number[]; u: number[]; v: number[] };
  unrepresentedMidpointIntervals: { curve: { domain: [number, number]; attemptedParameter: number }[]; u: { domain: [number, number]; attemptedParameter: number }[]; v: { domain: [number, number]; attemptedParameter: number }[] };
  coefficientMappings: { controlPoint: [number] | [number, number]; originalPointMM: Point; targetPointMM: Point;
    axes: { axis: number; row: [number, number, number, number]; terms: [number, number, number, number]; value: number; policy: 'identity-axis-bit-copy' | 'guarded-affine-dot' }[] }[];
  observationCount: number; observations: AffineGeometryTransformObservation[]; originalD0EvaluationCount: number; targetD0EvaluationCount: number;
  originalD1AttemptCount: number; targetD1AttemptCount: number; derivativeComparisonCount: number; derivativeRefusalCount: number; derivativeSourceRefusalCounts: { original: number; target: number };
  maximumPointDifferenceMM: number; maximumRelativeDerivativeDifference: number | null; maximumRelativeCrossDifference: number | null; degenerateCrossObservationCount: number;
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  quality: { authority: 'actual-native-control-coefficients-and-original-parameter-evaluators'; basisWeightsAndParameterBitsPreserved: true;
    coefficientPolicy: 'guarded-affine-dot-with-unit-axis-zero-translation-bit-copy'; parameterOrderPreserved: true;
    handednessMeaning: 'linear-map-parity-not-native-face-or-topology-orientation'; nativeD1Refusals: 'actual-original-target-states-must-match-no-inferred-derivatives';
    crossMeaning: 'local-nonunit-derivative-cross-vectors-not-certified-normal-or-face-orientation'; localObservationsOnly: true;
    workScope: 'actual-original-and-target-point-d1-observations-excludes-native-source-compiler-and-internal-validation';
    matrixInverseCertified: false; matrixConditionCertified: false; regularityCertified: false; topologyOrientationCertified: false;
    globalShapeErrorCertified: false; globalBinary64ErrorCertified: false; manufacturingToleranceCertified: false; sourceObjectLimitUnchanged: 16;
    ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-no-partial-transformed-native-geometry';
  limits: { maximumCurveDegree: 5; maximumCurvePoles: 64; maximumSurfaceAxisPoles: 16; maximumSurfacePoles: 256; maximumCurveSamples: 127;
    maximumSurfaceAxisSamples: 31; maximumObservations: 961; linearCoefficientAbs: 1000; translationAbsMM: 10000; coordinateAbsMM: 10000; parameterAbs: 10000;
    authoredIdCharacters: 48; pointComparisonMM: 1e-7; relativeD1Comparison: 1e-7; determinantRelativeThreshold: number;
    inputValues: 32768; inputDepth: 8; inputArrayElements: 128; inputRecordFields: 16; inputStringCharacters: 128;
    ownValues: 1048576; ownDepth: 40; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144 };
}
export interface AffineGeometryTransformResult { original: Curve | Surface; matrix: CadAffineMatrix3x4; options: AffineGeometryTransformOptions; geometry: Curve | Surface;
  source: string; sourceVersion: 0; model: Model; report: AffineGeometryTransformReport }

const CODE = AffineGeometryTransformDiagnosticCode, TOLERANCE = 1e-7;
function check(condition: boolean, code: AffineGeometryTransformDiagnosticCode, detail: string, cause?: unknown): asserts condition {
  if (!condition) throw new AffineGeometryTransformError(code, detail, cause);
}
function native<T>(action: () => T, detail: string, code: AffineGeometryTransformDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof AffineGeometryTransformError) throw cause;
    throw new AffineGeometryTransformError(code, detail + ': ' + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
  }
}
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT; let remaining = owned ? 1048576 : 32768;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= (owned ? 40 : 8), code, 'own-value/depth budget exceeded');
    if (owned && (value === null || typeof value === 'boolean')) return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'finite own numbers required'); return value; }
    if (typeof value === 'string') { check(value.length <= (owned ? 262144 : 128), code, 'own/source string budget exceeded'); return value; }
    check(value !== null && typeof value === 'object', code, 'plain own data required'); check(!ancestors.has(value), code, 'ancestor cycles refused');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'foreign own-data prototype refused');
    check(keys.length <= (array ? (owned ? 8193 : 129) : (owned ? 64 : 16)) && keys.every(key => typeof key === 'string' && key.length <= 128
      && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden/excess own fields refused');
    ancestors.add(value);
    try {
      if (array) {
        const n = descriptors.length.value as number;
        check(Number.isInteger(n) && n >= 0 && n <= (owned ? 8192 : 128) && keys.length === n + 1, code, 'dense bounded own array required');
        return Array.from({ length: n }, (_, i) => { check(Object.hasOwn(descriptors, String(i)), code, 'sparse/foreign own array field refused'); return copy(descriptors[String(i)].value, depth + 1); });
      }
      return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    } finally { ancestors.delete(value); }
  }; return copy(input, 0);
}
function record(input: unknown, fields: string[], code: AffineGeometryTransformDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'own record required'); const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'exact fields required: ' + fields.join(',')); return data;
}
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => same(value, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
    return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(key => Object.hasOwn(y, key) && same(x[key], y[key])); } return Object.is(a, b);
}
function id(value: unknown): string { check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII ID1..48 required'); return value; }
function finite(value: number, code: AffineGeometryTransformDiagnosticCode = CODE.REPRESENTABILITY): number {
  check(Number.isFinite(value), code, 'finite arithmetic required'); return value;
}
function product(a: number, b: number, code: AffineGeometryTransformDiagnosticCode = CODE.REPRESENTABILITY): number {
  const value = finite(a * b, code); check(a === 0 || b === 0 || value !== 0, code, 'nonzero product underflow'); return value;
}
function addContribution(a: number, b: number): number {
  const value = finite(a + b);
  check(b === 0 || value !== a, CODE.REPRESENTABILITY, 'nonzero affine contribution disappeared');
  check(a === 0 || b === 0 || value !== b, CODE.REPRESENTABILITY, 'prior nonzero affine contribution disappeared'); return value;
}
function distance(a: Point, b: Point): number { return finite(Math.hypot(...a.map((value, i) => finite(value - b[i])))); }
function relative(a: Point, b: Point): number {
  const difference = distance(a, b), value = finite(difference / Math.max(1, finite(Math.hypot(...a)), finite(Math.hypot(...b))));
  check(difference === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero local residual underflow'); return value;
}
function cross(a: Point, b: Point): Point { return [finite(product(a[1], b[2]) - product(a[2], b[1])),
  finite(product(a[2], b[0]) - product(a[0], b[2])), finite(product(a[0], b[1]) - product(a[1], b[0]))]; }
function attempt<T>(action: () => T, refused: (cause: Error) => void): D1State<T> {
  try { return { status: 'evaluated', value: action() }; } catch (cause) {
    check(cause instanceof Error, CODE.NATIVE, 'actual native D1 refusal must carry an Error'); refused(cause);
    return { status: 'native-refused', reason: cause.message.slice(0, 1024), nativeErrorName: cause.name.slice(0, 128) };
  }
}
type AxisMapping = AffineGeometryTransformReport['coefficientMappings'][number]['axes'][number];
export function mapPoint(matrix: CadAffineMatrix3x4, point: Point, translation: boolean): { point: Point; axes: AxisMapping[] } {
  const axes: AxisMapping[] = [];
  const values = [0, 1, 2].map(axis => {
    const offset = axis * 4, row: [number, number, number, number] = [matrix[offset], matrix[offset + 1], matrix[offset + 2], translation ? matrix[offset + 3] : 0];
    const terms: [number, number, number, number] = [product(row[0], point[0]), product(row[1], point[1]), product(row[2], point[2]), row[3]];
    const copied = row[axis] === 1 && row.slice(0, 3).every((value, i) => i === axis || value === 0) && row[3] === 0;
    let value = point[axis];
    if (!copied) { value = 0; for (const term of terms) if (term !== 0) value = addContribution(value, term); }
    axes.push({ axis, row, terms, value, policy: copied ? 'identity-axis-bit-copy' : 'guarded-affine-dot' }); return value;
  }); return { point: values as Point, axes };
}
type Schedule = { values: number[]; gaps: { domain: [number, number]; attemptedParameter: number }[] };
function schedule(knots: number[], degree: number, count: number, maximum: number): Schedule {
  const domain: [number, number] = [knots[degree], knots[count]];
  check(domain[1] > domain[0] && Number.isFinite(domain[1] - domain[0]), CODE.INPUT, 'finite positive original domain required');
  const breaks = [domain[0]];
  for (const knot of knots) if (knot > domain[0] && knot < domain[1] && knot !== breaks[breaks.length - 1]) breaks.push(knot);
  breaks.push(domain[1]); const values: number[] = [], gaps: Schedule['gaps'] = [];
  for (let i = 0; i < breaks.length; i++) {
    values.push(breaks[i]); if (i + 1 === breaks.length) continue;
    const middle = finite(breaks[i] + finite(breaks[i + 1] - breaks[i]) / 2);
    if (middle > breaks[i] && middle < breaks[i + 1]) values.push(middle);
    else gaps.push({ domain: [breaks[i], breaks[i + 1]], attemptedParameter: middle });
  }
  check(values.length <= maximum, CODE.BUDGET, 'complete original parameter sample capacity exceeded'); return { values, gaps };
}
function admit(input: unknown): Curve | Surface {
  const data = input as Record<string, unknown>; check(data && (data.kind === 'curve' || data.kind === 'surface'), CODE.INPUT, 'original native Curve/Surface required');
  const original = record(input, data.kind === 'curve' ? ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']
    : ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']) as unknown as Curve | Surface; id(original.id);
  native(() => original.kind === 'curve' ? validateCurve(original) : validateSurface(original), 'actual original native positive clamped validation', CODE.INPUT);
  const poles = original.kind === 'curve' ? original.controlPoints : original.controlPoints.flat();
  check(poles.every(point => point.every(value => Math.abs(value) <= 10000)), CODE.INPUT, 'original native XYZ within10000mm required');
  const knots = original.kind === 'curve' ? original.knots : [...original.knotsU, ...original.knotsV];
  check(knots.every(value => Math.abs(value) <= 10000), CODE.INPUT, 'original native knots within10000 required');
  if (original.kind === 'curve') check(original.degree >= 1 && original.degree <= 5 && original.controlPoints.length >= 2 && original.controlPoints.length <= 64,
    CODE.INPUT, 'native degree1..5/poles2..64 Curve required');
  else check(original.degreeU >= 1 && original.degreeU <= 5 && original.degreeV >= 1 && original.degreeV <= 5
    && original.controlPoints.length >= 2 && original.controlPoints.length <= 16 && original.controlPoints[0].length >= 2 && original.controlPoints[0].length <= 16
    && poles.length <= 256, CODE.INPUT, 'native degree1..5/axes2..16 Surface required'); return original;
}

/** Affine native coefficient copy in the unchanged original parameter basis. */
export function transformNativeGeometryAffine(originalInput: Curve | Surface, matrixInput: CadAffineMatrix3x4, optionsInput: AffineGeometryTransformOptions): AffineGeometryTransformResult {
  const data = record(snapshot({ original: originalInput, matrix: matrixInput, options: optionsInput }), ['original', 'matrix', 'options']);
  const original = admit(data.original), optionData = record(data.options, ['geometryId', 'maximumObservations']);
  const geometryId = id(optionData.geometryId); check(geometryId !== original.id, CODE.IDENTITY, 'original and target IDs must differ');
  check(typeof optionData.maximumObservations === 'number' && Number.isInteger(optionData.maximumObservations) && optionData.maximumObservations >= 0 && optionData.maximumObservations <= 961,
    CODE.BUDGET, 'maximumObservations integer0..961 required');
  const options: AffineGeometryTransformOptions = { geometryId, maximumObservations: optionData.maximumObservations };
  check(Array.isArray(data.matrix) && data.matrix.length === 12 && data.matrix.every((value, i) => typeof value === 'number'
    && Number.isFinite(value) && Math.abs(value) <= (i % 4 === 3 ? 10000 : 1000)), CODE.MATRIX, 'finite row-major matrix12 with bounded linear/translation coefficients required');
  const matrix = data.matrix as CadAffineMatrix3x4;
  const triple = (a: number, b: number, c: number) => product(product(a, b, CODE.MATRIX), c, CODE.MATRIX);
  const signedTripleTerms: AffineGeometryTransformReport['signedTripleTerms'] = [triple(matrix[0], matrix[5], matrix[10]), triple(matrix[1], matrix[6], matrix[8]),
    triple(matrix[2], matrix[4], matrix[9]), -triple(matrix[2], matrix[5], matrix[8]), -triple(matrix[1], matrix[4], matrix[10]), -triple(matrix[0], matrix[6], matrix[9])];
  let determinant = 0, absoluteTripleSum = 0;
  for (const term of signedTripleTerms) { determinant = finite(determinant + term, CODE.MATRIX); absoluteTripleSum = finite(absoluteTripleSum + Math.abs(term), CODE.MATRIX); }
  const determinantThreshold = product(128 * Number.EPSILON, absoluteTripleSum, CODE.MATRIX);
  check(absoluteTripleSum > 0 && Math.abs(determinant) > determinantThreshold, CODE.MATRIX, 'singular or cancellation-uncertain linear determinant refused');
  const emptySchedule: Schedule = { values: [], gaps: [] };
  const curveSamples = original.kind === 'curve' ? schedule(original.knots, original.degree, original.controlPoints.length, 127) : emptySchedule;
  const uSamples = original.kind === 'surface' ? schedule(original.knotsU, original.degreeU, original.controlPoints.length, 31) : emptySchedule;
  const vSamples = original.kind === 'surface' ? schedule(original.knotsV, original.degreeV, original.controlPoints[0].length, 31) : emptySchedule;
  const observationCount = original.kind === 'curve' ? curveSamples.values.length : uSamples.values.length * vSamples.values.length;
  check(observationCount <= options.maximumObservations && observationCount <= 961, CODE.BUDGET, 'complete original parameter observations exceed caller budget before coefficient/source work');
  const coefficientMappings: AffineGeometryTransformReport['coefficientMappings'] = [];
  const mapCoefficient = (point: Point, controlPoint: [number] | [number, number]): Point => {
    const mapped = mapPoint(matrix, point, true); check(mapped.point.every(value => Math.abs(value) <= 10000), CODE.REPRESENTABILITY, 'generated native XYZ exceeds10000mm');
    coefficientMappings.push({ controlPoint, originalPointMM: point, targetPointMM: mapped.point, axes: mapped.axes }); return mapped.point;
  };
  const geometry = copyCadData(original); geometry.id = geometryId;
  if (geometry.kind === 'curve' && original.kind === 'curve') geometry.controlPoints = original.controlPoints.map((point, i) => mapCoefficient(point, [i]));
  else if (geometry.kind === 'surface' && original.kind === 'surface') geometry.controlPoints = original.controlPoints.map((row, i) => row.map((point, j) => mapCoefficient(point, [i, j])));
  check(same({ ...original, id: geometryId, controlPoints: geometry.controlPoints }, geometry), CODE.BINDING, 'only native ID and control points may change');
  native(() => geometry.kind === 'curve' ? validateCurve(geometry) : validateSurface(geometry), 'actual transformed native validation');
  const expectedModel: Model = { name: geometryId, version: 0, lengthUnit: 'mm', objects: [original, geometry] };
  const adopted = native(() => adopt(expectedModel), 'actual original+target Source0 serialization/compile binding');
  check(adopted.source.length <= 262144 && same(adopted.model, expectedModel), CODE.BINDING, 'bounded compiled original+target Model must preserve every coefficient bit');
  const observations: AffineGeometryTransformObservation[] = [];
  let originalD0EvaluationCount = 0, targetD0EvaluationCount = 0, originalD1AttemptCount = 0, targetD1AttemptCount = 0;
  let derivativeComparisonCount = 0, derivativeRefusalCount = 0, originalRefusalCount = 0, targetRefusalCount = 0;
  let maximumPointDifferenceMM = 0, maximumRelativeDerivativeDifference: number | null = null, maximumRelativeCrossDifference: number | null = null, degenerateCrossObservationCount = 0;
  const pointBinding = (sourcePoint: Point, targetPoint: Point): PointObservation => {
    const expectedPointMM = mapPoint(matrix, sourcePoint, true).point, differenceMM = distance(expectedPointMM, targetPoint);
    check(differenceMM <= TOLERANCE, CODE.BINDING, 'actual native target point does not match affine original point');
    maximumPointDifferenceMM = Math.max(maximumPointDifferenceMM, differenceMM); return { originalPointMM: sourcePoint, expectedPointMM, actualPointMM: targetPoint, differenceMM };
  };
  const recordRelative = (actual: Point, expected: Point): number => {
    const value = relative(actual, expected); check(value <= TOLERANCE, CODE.BINDING, 'actual native transformed derivative does not match linear original derivative');
    maximumRelativeDerivativeDifference = Math.max(maximumRelativeDerivativeDifference ?? 0, value); return value;
  };
  const matchStates = <T>(source: D1State<T>, target: D1State<T>, sourceCause: Error | undefined, targetCause: Error | undefined): void => {
    check(source.status === target.status, CODE.BINDING, 'original/target actual native D1 refusal asymmetry', sourceCause ?? targetCause);
    if (source.status === 'native-refused' && target.status === 'native-refused') {
      check(source.reason === target.reason && source.nativeErrorName === target.nativeErrorName, CODE.BINDING, 'original/target actual native D1 refusal states differ', sourceCause ?? targetCause);
      derivativeRefusalCount++;
    } else derivativeComparisonCount++;
  };
  if (original.kind === 'curve' && geometry.kind === 'curve') for (const parameter of curveSamples.values) {
    originalD0EvaluationCount++; const sourcePoint = native(() => evaluateCurve(original, parameter), 'actual original Curve point');
    targetD0EvaluationCount++; const targetPoint = native(() => evaluateCurve(geometry, parameter), 'actual target Curve point');
    let sourceCause: Error | undefined, targetCause: Error | undefined;
    originalD1AttemptCount++; const originalD1 = attempt(() => evaluateCurveD1(original, parameter), cause => { sourceCause = cause; originalRefusalCount++; });
    targetD1AttemptCount++; const targetD1 = attempt(() => evaluateCurveD1(geometry, parameter), cause => { targetCause = cause; targetRefusalCount++; });
    matchStates(originalD1, targetD1, sourceCause, targetCause); let expectedDerivativeMM: Point | null = null, relativeDerivativeDifference: number | null = null;
    if (originalD1.status === 'evaluated' && targetD1.status === 'evaluated') { expectedDerivativeMM = mapPoint(matrix, originalD1.value.derivative, false).point;
      relativeDerivativeDifference = recordRelative(targetD1.value.derivative, expectedDerivativeMM); }
    observations.push({ kind: 'curve', parameter, ...pointBinding(sourcePoint, targetPoint), originalD1, targetD1, expectedDerivativeMM, relativeDerivativeDifference });
  }
  if (original.kind === 'surface' && geometry.kind === 'surface') for (const u of uSamples.values) for (const v of vSamples.values) {
    originalD0EvaluationCount++; const sourcePoint = native(() => evaluateSurface(original, u, v), 'actual original Surface point');
    targetD0EvaluationCount++; const targetPoint = native(() => evaluateSurface(geometry, u, v), 'actual target Surface point');
    let sourceCause: Error | undefined, targetCause: Error | undefined;
    originalD1AttemptCount++; const originalD1 = attempt(() => evaluateSurfaceD1(original, u, v), cause => { sourceCause = cause; originalRefusalCount++; });
    targetD1AttemptCount++; const targetD1 = attempt(() => evaluateSurfaceD1(geometry, u, v), cause => { targetCause = cause; targetRefusalCount++; });
    matchStates(originalD1, targetD1, sourceCause, targetCause);
    let expectedDuMM: Point | null = null, expectedDvMM: Point | null = null, relativeDuDifference: number | null = null, relativeDvDifference: number | null = null;
    let expectedCrossMM2: Point | null = null, actualCrossMM2: Point | null = null, relativeCrossDifference: number | null = null, crossDegenerate: boolean | null = null;
    if (originalD1.status === 'evaluated' && targetD1.status === 'evaluated') {
      expectedDuMM = mapPoint(matrix, originalD1.value.du, false).point; expectedDvMM = mapPoint(matrix, originalD1.value.dv, false).point;
      relativeDuDifference = recordRelative(targetD1.value.du, expectedDuMM); relativeDvDifference = recordRelative(targetD1.value.dv, expectedDvMM);
      expectedCrossMM2 = cross(expectedDuMM, expectedDvMM); actualCrossMM2 = cross(targetD1.value.du, targetD1.value.dv);
      relativeCrossDifference = relative(actualCrossMM2, expectedCrossMM2); check(relativeCrossDifference <= TOLERANCE, CODE.BINDING, 'actual transformed Surface local cross mismatch');
      maximumRelativeCrossDifference = Math.max(maximumRelativeCrossDifference ?? 0, relativeCrossDifference);
      crossDegenerate = Math.hypot(...actualCrossMM2) === 0 || Math.hypot(...expectedCrossMM2) === 0; if (crossDegenerate) degenerateCrossObservationCount++;
    }
    observations.push({ kind: 'surface', u, v, ...pointBinding(sourcePoint, targetPoint), originalD1, targetD1, expectedDuMM, expectedDvMM, relativeDuDifference, relativeDvDifference,
      expectedCrossMM2, actualCrossMM2, relativeCrossDifference, crossDegenerate });
  }
  const report: AffineGeometryTransformReport = {
    schema: 'barocss-native-affine-geometry-transform', version: 0, originalId: original.id, geometryId, kind: original.kind, lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion',
    matrixRoles: { order: 'row-major-three-by-four-column-vector', linearUnit: 'dimensionless', translationUnit: 'mm' }, determinant, signedTripleTerms, absoluteTripleSum, determinantThreshold,
    handedness: determinant > 0 ? 'preserved' : 'reversed', domains: { curve: original.kind === 'curve' ? curveDomain(original) : null,
      u: original.kind === 'surface' ? surfaceDomain(original).u : null, v: original.kind === 'surface' ? surfaceDomain(original).v : null },
    samples: { curve: curveSamples.values, u: uSamples.values, v: vSamples.values }, unrepresentedMidpointIntervals: { curve: curveSamples.gaps, u: uSamples.gaps, v: vSamples.gaps },
    coefficientMappings, observationCount, observations, originalD0EvaluationCount, targetD0EvaluationCount, originalD1AttemptCount, targetD1AttemptCount,
    derivativeComparisonCount, derivativeRefusalCount, derivativeSourceRefusalCounts: { original: originalRefusalCount, target: targetRefusalCount },
    maximumPointDifferenceMM, maximumRelativeDerivativeDifference, maximumRelativeCrossDifference, degenerateCrossObservationCount,
    geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    quality: { authority: 'actual-native-control-coefficients-and-original-parameter-evaluators', basisWeightsAndParameterBitsPreserved: true,
      coefficientPolicy: 'guarded-affine-dot-with-unit-axis-zero-translation-bit-copy', parameterOrderPreserved: true,
      handednessMeaning: 'linear-map-parity-not-native-face-or-topology-orientation', nativeD1Refusals: 'actual-original-target-states-must-match-no-inferred-derivatives',
      crossMeaning: 'local-nonunit-derivative-cross-vectors-not-certified-normal-or-face-orientation', localObservationsOnly: true,
      workScope: 'actual-original-and-target-point-d1-observations-excludes-native-source-compiler-and-internal-validation', matrixInverseCertified: false, matrixConditionCertified: false,
      regularityCertified: false, topologyOrientationCertified: false, globalShapeErrorCertified: false, globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false,
      sourceObjectLimitUnchanged: 16, ownership: 'copied-cpu-data-gc-no-renderer-resources' }, budgetFailure: 'atomic-refusal-no-partial-transformed-native-geometry',
    limits: { maximumCurveDegree: 5, maximumCurvePoles: 64, maximumSurfaceAxisPoles: 16, maximumSurfacePoles: 256, maximumCurveSamples: 127, maximumSurfaceAxisSamples: 31,
      maximumObservations: 961, linearCoefficientAbs: 1000, translationAbsMM: 10000, coordinateAbsMM: 10000, parameterAbs: 10000, authoredIdCharacters: 48, pointComparisonMM: 1e-7,
      relativeD1Comparison: 1e-7, determinantRelativeThreshold: 128 * Number.EPSILON, inputValues: 32768, inputDepth: 8, inputArrayElements: 128, inputRecordFields: 16, inputStringCharacters: 128,
      ownValues: 1048576, ownDepth: 40, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144 }
  };
  check(observations.length === observationCount, CODE.BINDING, 'complete scheduled native observations required');
  return snapshot({ original, matrix, options, geometry, source: adopted.source, sourceVersion: 0, model: adopted.model, report }, true) as AffineGeometryTransformResult;
}

/** Rebuild every native coefficient, source binding and observation from copied owned inputs. */
export function validateAffineGeometryTransform(input: AffineGeometryTransformResult): AffineGeometryTransformReport {
  const data = record(snapshot(input, true), ['original', 'matrix', 'options', 'geometry', 'source', 'sourceVersion', 'model', 'report'], CODE.OWNED);
  let rebuilt: AffineGeometryTransformResult;
  try { rebuilt = transformNativeGeometryAffine(data.original as Curve | Surface, data.matrix as CadAffineMatrix3x4,
    data.options as AffineGeometryTransformOptions); }
  catch (cause) { throw new AffineGeometryTransformError(CODE.OWNED, 'owned native affine rebuild refused', cause); }
  check(same(data, rebuilt), CODE.OWNED, 'whole owned native affine result differs from actual rebuild'); return copyCadData(rebuilt.report);
}
