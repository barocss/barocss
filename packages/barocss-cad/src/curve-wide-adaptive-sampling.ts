import { validateCurve, curveDomain, evaluateCurve } from './math.js';
import { evaluateCurveD1 } from './derivatives.js';
import type { CurveD1Result } from './derivatives.js';
import { splitCurveAtParameter } from './curve-parameter-split.js';
import type { CurveParameterSplitReport, CurveSplitSharedCoefficient } from './curve-parameter-split.js';
import { finiteSegmentDistance } from './curve-adaptive-sampling.js';
import { compileCadModel } from './model-compiler.js';
import { curveDecimal } from './curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Model, Point } from './types.js';

export const WideAdaptiveCurveSamplingDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', SPAN: 'SPAN', REPRESENTABILITY: 'REPRESENTABILITY',
  BUDGET: 'BUDGET', NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
} as const);
export type WideAdaptiveCurveSamplingDiagnosticCode =
  typeof WideAdaptiveCurveSamplingDiagnosticCode[keyof typeof WideAdaptiveCurveSamplingDiagnosticCode];
export class WideAdaptiveCurveSamplingError extends Error {
  readonly code: WideAdaptiveCurveSamplingDiagnosticCode;
  constructor(code: WideAdaptiveCurveSamplingDiagnosticCode, detail: string, cause?: unknown) {
    super(('Wide adaptive Curve sampling: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'WideAdaptiveCurveSamplingError';
    this.code = code;
  }
}
export interface WideAdaptiveCurveSamplingOptions {
  chordToleranceMM: number; maxSegments: number; maxDepth: number; resultIdPrefix: string;
}
export interface WideAdaptiveCurveSample {
  id: string; parameter: number; pointMM: Point; adjacentSegmentIds: string[];
  originalSpanIndices: number[]; atOriginalKnot: boolean; originalD1Guarded: boolean;
}
export type WideAdaptiveCurveD1State =
  { status: 'evaluated'; value: CurveD1Result } | { status: 'native-refused'; reason: string };
export interface WideAdaptiveCurveExtractionLevel {
  degree: number; basisIndices: number[]; coefficientMatrix: number[][];
  columnSums: number[]; maximumPartitionResidual: number;
}
export interface WideAdaptiveCurveSpan {
  index: number; knotSpanIndex: number; domain: [number, number];
  activePoleIndices: number[]; activeKnotIndices: number[];
  originalActiveControlPoints: Point[]; originalActiveWeights: number[];
  levels: WideAdaptiveCurveExtractionLevel[]; coefficientMatrix: number[][];
  rowSums: number[]; columnSums: number[]; maximumPartitionResidual: number;
  controlOrigins: { bezierPoleIndex: number; origin: 'original-copy' | 'generated-arithmetic';
    originalPoleIndex: number | null; coefficients: number[]; homogeneous: [number, number, number, number] }[];
  bezier: Curve; nativeSpanSource: string; sourceVersion: 0; nativeSpanModel: Model;
}
export interface WideAdaptiveCurveObservation {
  parameter: number; originalPointMM: Point; extractedPointMM: Point;
  extractionDifferenceMM: number; outputChordDistanceMM: number;
  originalD1: WideAdaptiveCurveD1State; extractedD1: WideAdaptiveCurveD1State;
  derivativeDifferenceMM: number | null; relativeDerivativeDifference: number | null;
}
export interface WideAdaptiveCurveSegment {
  id: string; domain: [number, number]; originalSpanIndex: number;
  originalSpanDomain: [number, number]; depth: number; bezier: Curve;
  controlPolygonBoundMM: number; arithmeticUncertaintyMM: number;
  finiteChord: { startMM: Point; endMM: Point; degenerate: boolean };
  observations: WideAdaptiveCurveObservation[]; maximumExtractionDifferenceMM: number;
  maximumObservedOutputChordDistanceMM: number; maximumRelativeDerivativeDifference: number;
}
export interface WideAdaptiveCurveSplitOperation {
  index: number; purpose: 'adaptive-subdivision'; originalSpanIndex: number; depth: number;
  inputCurveId: string; inputDomain: [number, number]; parameter: number;
  lowerCurveId: string; upperCurveId: string; refinementKind: 'knot-insertion' | 'direct-copy';
  insertions: number; firstRefinedKnotIndex: number; poleCounts: CurveParameterSplitReport['poleCounts'];
  sharedCoefficient: CurveSplitSharedCoefficient; cutEndpoints: CurveParameterSplitReport['cutEndpoints'];
  nativeMaximumObservedDifferenceMM: number;
}
export interface WideAdaptiveCurveSamplingReport {
  family: 'own-wide-adaptive-native-rational-curve-display-samples';
  dto: { schema: 'barocss-native-curve-samples'; version: 1; lengthUnit: 'mm';
    frame: 'authored-xyz-no-axis-conversion'; representation: 'sampled-display-points-not-native-edges-or-fit';
    capacity: { maximumOriginalPoles: 64; maximumOriginalKnots: 70; maximumSegments: 4096; maximumPoints: 4097 } };
  curveId: string; degree: number; originalSpanCount: number; segmentCount: number; pointCount: number;
  operationCount: number; maximumDepthUsed: number; maximumControlPolygonBoundMM: number;
  maximumArithmeticUncertaintyMM: number; maximumExtractionDifferenceMM: number;
  maximumObservedOutputChordDistanceMM: number; maximumRelativeDerivativeDifference: number;
  maximumPartitionResidual: number; originalGuardedParameters: number[];
  geometryAuthority: 'original-evaluateCurve-and-original-source0'; geometricValidity: 'not-certified';
  topologyCertified: false; solid: false;
  inputProfile: { degreeRange: [1, 3]; poleRange: [2, 64]; maximumKnots: 70; weightRange: [1e-6, 1e6];
    coordinateAbsMM: 10000; maximumNonzeroSpans: 64; clamped: true; nonperiodic: true };
  budgetFailure: 'atomic-refusal-no-partial-result';
  quality: { criterion: 'finite-segment-control-hull-estimate-plus-arithmetic-margin';
    extraction: 'local-cox-de-boor-to-bernstein-coefficients'; extractionReference: string;
    globalBinary64ErrorCertified: false; manufacturingToleranceCertified: false; localObservationsOnly: true;
    pointComparisonMM: 1e-7; relativeD1Comparison: 1e-7; partitionComparison: number;
    positiveWeightHullReference: string[]; derivativeSemantics: 'original-native-c0-guards-and-local-one-sided-d1-no-g1-g2-claim';
    ownership: 'copied-cpu-data-gc-no-renderer-resources'; identity: 'display-provenance-roles-not-native-edges-or-fit' };
  limits: { maximumOriginalPoles: 64; maximumOriginalKnots: 70; maximumOriginalSpans: 64;
    maximumSegments: 4096; maximumPoints: 4097; maximumDepth: 16; maximumOperations: 4095;
    maximumReservedRoleIds: 32768; maximumLocalBezierPoles: 4; maximumTemporaryPoles: 7;
    inputValues: 32768; inputDepth: 8; inputArrayElements: 128; inputRecordFields: 16; inputStringCharacters: 128;
    snapshotValues: 2097152; snapshotDepth: 32; arrayElements: 8192; recordFields: 64;
    sourceStringCharacters: 262144; authoredIdCharacters: 48; resultIdPrefixCharacters: 20 };
}
export interface WideAdaptiveCurveSamplingResult {
  curve: Curve; options: WideAdaptiveCurveSamplingOptions; source: string; sourceVersion: 0; model: Model;
  domain: [number, number]; parameters: number[]; pointsMM: Point[]; samples: WideAdaptiveCurveSample[];
  spans: WideAdaptiveCurveSpan[]; segments: WideAdaptiveCurveSegment[];
  operations: WideAdaptiveCurveSplitOperation[]; report: WideAdaptiveCurveSamplingReport;
}

const CODE = WideAdaptiveCurveSamplingDiagnosticCode;
const EPS = 64 * Number.EPSILON, POINT_TOLERANCE = 1e-7, D1_TOLERANCE = 1e-7;
function check(condition: boolean, code: WideAdaptiveCurveSamplingDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new WideAdaptiveCurveSamplingError(code, detail);
}
function finite(value: number, detail: string, code: WideAdaptiveCurveSamplingDiagnosticCode = CODE.REPRESENTABILITY): number {
  check(Number.isFinite(value), code, detail);
  return value;
}
function native<T>(operation: () => T, detail: string, code: WideAdaptiveCurveSamplingDiagnosticCode = CODE.NATIVE): T {
  try { return operation(); } catch (cause) {
    if (cause instanceof WideAdaptiveCurveSamplingError) throw cause;
    throw new WideAdaptiveCurveSamplingError(code, detail + ': '
      + (cause instanceof Error ? cause.message : 'operation refused'), cause);
  }
}
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT;
  let remaining = owned ? 2097152 : 32768;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= (owned ? 32 : 8), code, 'own-value/depth budget exceeded');
    if (value === null && owned) return null;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'finite own numbers required'); return value; }
    if (typeof value === 'string') { check(value.length <= (owned ? 262144 : 128), code, 'own string budget exceeded'); return value; }
    if (typeof value === 'boolean' && owned) return value;
    check(value !== null && typeof value === 'object', code, 'plain own data required');
    check(!ancestors.has(value), code, 'cyclic own data refused');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      code, 'foreign own-data prototype refused');
    const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.length <= (array ? (owned ? 8193 : 129) : (owned ? 64 : 16)), code, 'own field budget exceeded');
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden own data refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= (owned ? 8192 : 128)
        && keys.length === length + 1, code, 'dense bounded own arrays required');
      result = Array.from({ length }, (_, index) => {
        check(Object.hasOwn(descriptors, String(index)), code, 'sparse/extra own array field refused');
        return copy(descriptors[String(index)].value, depth + 1);
      });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value);
    return result;
  };
  return native(() => copy(input, 0), 'own data snapshot', code);
}
function record(value: unknown, fields: string[]): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), CODE.INPUT, 'own record required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    CODE.INPUT, 'exact fields required: ' + fields.join(','));
  return data;
}
function id(value: unknown): string {
  check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),
    CODE.IDENTITY, 'ASCII ID1..48 required');
  return value;
}
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b)
    && a.length === b.length && a.every((value, index) => same(value, b[index]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    return Object.keys(left).length === Object.keys(right).length
      && Object.keys(left).every(key => Object.hasOwn(right, key) && same(left[key], right[key]));
  }
  return Object.is(a, b);
}
function product(a: number, b: number): number {
  const value = finite(a * b, 'coefficient product overflow');
  check(a === 0 || b === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero coefficient product underflow');
  return value;
}
function ratio(a: number, b: number): number {
  const value = finite(a / b, 'coefficient ratio overflow');
  check(value >= 0 && (a === 0 || value !== 0), CODE.REPRESENTABILITY, 'negative/unrepresented coefficient ratio');
  return value;
}
function distance(a: Point, b: Point): number {
  return finite(Math.hypot(...a.map((value, index) => finite(value - b[index], 'binding subtraction overflow', CODE.BINDING))),
    'binding distance overflow', CODE.BINDING);
}
function point(curve: Curve, parameter: number): Point {
  const value = native(() => evaluateCurve(curve, parameter), 'native point evaluation');
  check(value.every(Number.isFinite), CODE.NATIVE, 'native point must be finite');
  return value;
}
function d1(curve: Curve, parameter: number): WideAdaptiveCurveD1State {
  try {
    const value = evaluateCurveD1(curve, parameter);
    check(value.point.every(Number.isFinite) && value.derivative.every(Number.isFinite), CODE.NATIVE, 'finite native D1 required');
    return { status: 'evaluated', value };
  } catch (cause) {
    // Only the established C0 guard is a stored observation. Arithmetic failures remain atomic refusals.
    if (cause instanceof Error && cause.message === 'First derivative is not defined at an exact C0 interior knot')
      return { status: 'native-refused', reason: cause.message };
    if (cause instanceof WideAdaptiveCurveSamplingError) throw cause;
    throw new WideAdaptiveCurveSamplingError(CODE.NATIVE, 'native D1 evaluation refused', cause);
  }
}
function sourceCurve(curve: Curve, name: string): { curve: Curve; source: string; model: Model } {
  const decimal = (value: number) => native(() => curveDecimal(value, 'Wide adaptive Curve sampling'), 'source decimal');
  const list = (values: number[]) => '[' + values.map(decimal).join(',') + ']';
  const source = '@model ' + name + ' { version:0; length-unit:mm; @curve #' + curve.id
    + ' { type:nurbs; degree:' + decimal(curve.degree) + '; knots:' + list(curve.knots)
    + '; control-points:[' + curve.controlPoints.map(list).join(',') + ']; weights:' + list(curve.weights) + '; } }\n';
  check(source.length <= 262144, CODE.BUDGET, 'individual source0 string budget exceeded');
  const compiled = native(() => compileCadModel(source, { sourceVersion: 0 }), 'source0 compilation');
  if (!compiled.ok) throw new WideAdaptiveCurveSamplingError(CODE.NATIVE, 'actual Curve-only source0 must compile', compiled);
  check(same(compiled.model, { name, version: 0, lengthUnit: 'mm', objects: [curve] }), CODE.NATIVE,
    'source0 must adopt full coefficient/ID/domain/order/sign bits');
  return { curve: compiled.model.objects[0] as Curve, source, model: compiled.model };
}

/** Multiply Bernstein degree d-1 coefficients by a linear factor given at both span endpoints. */
function linearProduct(q: number[], left: number, right: number, degree: number): number[] {
  return Array.from({ length: degree + 1 }, (_, j) => {
    const first = j < q.length ? product(product(left, (degree - j) / degree), q[j]) : 0;
    const second = j > 0 ? product(product(right, j / degree), q[j - 1]) : 0;
    const value = finite(first + second, 'Bernstein coefficient sum overflow');
    check(value >= 0, CODE.REPRESENTABILITY, 'negative Bernstein coefficient');
    return value;
  });
}
function extractionLevel(degree: number, basisIndices: number[], coefficientMatrix: number[][]): WideAdaptiveCurveExtractionLevel {
  const columnSums = Array.from({ length: degree + 1 }, (_, column) =>
    coefficientMatrix.reduce((sum, row) => finite(sum + row[column], 'partition sum overflow'), 0));
  const maximumPartitionResidual = Math.max(...columnSums.map(value => Math.abs(finite(value - 1, 'partition residual overflow'))));
  check(maximumPartitionResidual <= EPS, CODE.REPRESENTABILITY, 'local Bernstein partition residual exceeds64epsilon');
  return { degree, basisIndices, coefficientMatrix, columnSums, maximumPartitionResidual };
}
/** Analytic local basis extraction. No original Curve refinement or point fitting occurs here. */
function extractSpan(original: Curve, knotSpanIndex: number, index: number, curveId: string): WideAdaptiveCurveSpan {
  const p = original.degree, a = original.knots[knotSpanIndex], b = original.knots[knotSpanIndex + 1];
  const domain: [number, number] = [a, b];
  const levels = [extractionLevel(0, [knotSpanIndex], [[1]])];
  for (let degree = 1; degree <= p; degree++) {
    const previous = levels[degree - 1], basisIndices = Array.from({ length: degree + 1 }, (_, i) => knotSpanIndex - degree + i);
    const coefficientMatrix = basisIndices.map(basisIndex => {
      const contributions: number[][] = [];
      for (const side of [0, 1]) {
        const previousRow = previous.basisIndices.indexOf(basisIndex + side);
        if (previousRow < 0) continue;
        const start = original.knots[basisIndex + side], end = original.knots[basisIndex + degree + side];
        const denominator = finite(end - start, 'knot-ratio denominator overflow');
        check(denominator >= 0, CODE.REPRESENTABILITY, 'negative knot-ratio denominator');
        if (denominator === 0) {
          check(end === start, CODE.REPRESENTABILITY, 'nonzero knot-ratio denominator collapsed');
          continue;
        }
        const left = finite(side === 0 ? a - start : end - a, 'left knot-ratio numerator overflow');
        const right = finite(side === 0 ? b - start : end - b, 'right knot-ratio numerator overflow');
        check(left >= 0 && right >= 0, CODE.REPRESENTABILITY, 'negative active knot-ratio numerator');
        contributions.push(linearProduct(previous.coefficientMatrix[previousRow], ratio(left, denominator), ratio(right, denominator), degree));
      }
      return Array.from({ length: degree + 1 }, (_, j) =>
        contributions.reduce((sum, row) => finite(sum + row[j], 'native knot-ratio contribution sum overflow'), 0));
    });
    levels.push(extractionLevel(degree, basisIndices, coefficientMatrix));
  }
  const final = levels[p], activePoleIndices = final.basisIndices;
  const coefficientMatrix = final.coefficientMatrix;
  const originalActiveControlPoints = activePoleIndices.map(i => original.controlPoints[i]);
  const originalActiveWeights = activePoleIndices.map(i => original.weights[i]);
  const controlPoints: Point[] = [], weights: number[] = [];
  const controlOrigins: WideAdaptiveCurveSpan['controlOrigins'] = [];
  for (let column = 0; column <= p; column++) {
    const coefficients = coefficientMatrix.map(row => row[column]);
    const copyIndex = coefficients.findIndex((value, i) => value === 1 && coefficients.every((other, j) => j === i || other === 0));
    let homogeneous: [number, number, number, number], control: Point, weight: number;
    if (copyIndex >= 0) {
      control = copyCadData(originalActiveControlPoints[copyIndex]); weight = originalActiveWeights[copyIndex];
      homogeneous = [...control.map(value => product(value, weight)), weight] as [number, number, number, number];
    } else {
      homogeneous = [0, 0, 0, 0];
      for (let row = 0; row <= p; row++) {
        const factor = product(coefficients[row], originalActiveWeights[row]);
        for (let axis = 0; axis < 3; axis++) homogeneous[axis] = finite(homogeneous[axis]
          + product(factor, originalActiveControlPoints[row][axis]), 'homogeneous coordinate sum overflow');
        homogeneous[3] = finite(homogeneous[3] + factor, 'homogeneous weight sum overflow');
      }
      weight = homogeneous[3];
      check(weight > 0, CODE.REPRESENTABILITY, 'positive generated homogeneous weight required');
      control = homogeneous.slice(0, 3).map(value => {
        const projected = finite(value / weight, 'homogeneous projection overflow');
        check(value === 0 || projected !== 0, CODE.REPRESENTABILITY, 'nonzero homogeneous projection underflow');
        return projected;
      }) as Point;
    }
    check(weight >= 1e-6 && weight <= 1e6 && control.every(value => Math.abs(value) <= 10000),
      CODE.NATIVE, 'generated local control/weight outside admitted native profile');
    controlPoints.push(control); weights.push(weight);
    controlOrigins.push({ bezierPoleIndex: column, origin: copyIndex >= 0 ? 'original-copy' : 'generated-arithmetic',
      originalPoleIndex: copyIndex >= 0 ? activePoleIndices[copyIndex] : null, coefficients, homogeneous });
  }
  const bezier: Curve = { kind: 'curve', id: curveId, degree: p,
    knots: [...Array<number>(p + 1).fill(a), ...Array<number>(p + 1).fill(b)], controlPoints, weights };
  native(() => validateCurve(bezier), 'local analytic Curve admission');
  const file = sourceCurve(bezier, curveId);
  check(same(curveDomain(file.curve), domain), CODE.NATIVE, 'local source0 original domain bits changed');
  return { index, knotSpanIndex, domain, activePoleIndices,
    activeKnotIndices: Array.from({ length: 2 * p + 2 }, (_, i) => knotSpanIndex - p + i),
    originalActiveControlPoints, originalActiveWeights, levels, coefficientMatrix,
    rowSums: coefficientMatrix.map(row => row.reduce((sum, value) => finite(sum + value, 'matrix row sum overflow'), 0)),
    columnSums: final.columnSums, maximumPartitionResidual: Math.max(...levels.map(level => level.maximumPartitionResidual)),
    controlOrigins, bezier: file.curve, nativeSpanSource: file.source, sourceVersion: 0, nativeSpanModel: file.model };
}

function midpoint(interval: [number, number]): number {
  const width = finite(interval[1] - interval[0], 'observation/adaptive interval overflow');
  const half = product(width, .5), value = finite(interval[0] + half, 'observation/adaptive midpoint overflow');
  check(width > 0 && value > interval[0] && value < interval[1], CODE.REPRESENTABILITY,
    'observation/adaptive midpoint has no represented interior parameter');
  return value;
}
function chordDistance(pointMM: Point, startMM: Point, endMM: Point): number {
  return native(() => finiteSegmentDistance(pointMM, startMM, endMM), 'finite segment distance', CODE.REPRESENTABILITY);
}

/** Sample a bounded wide Curve. Every returned display point uses the original native evaluator. */
export function sampleCurveWideAdaptive(curveInput: Curve, inputOptions: WideAdaptiveCurveSamplingOptions): WideAdaptiveCurveSamplingResult {
  const original = record(snapshot(curveInput), ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']) as unknown as Curve;
  const o = record(snapshot(inputOptions), ['chordToleranceMM', 'maxSegments', 'maxDepth', 'resultIdPrefix']);
  id(original.id);
  check(original.kind === 'curve' && Number.isInteger(original.degree) && original.degree >= 1 && original.degree <= 3,
    CODE.INPUT, 'native degree1..3 Curve required');
  check(Array.isArray(original.controlPoints) && original.controlPoints.length >= 2 && original.controlPoints.length <= 64
    && original.controlPoints.every(control => Array.isArray(control) && control.length === 3
      && control.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000)),
    CODE.INPUT, '2..64 original poles with authored XYZ±10000mm required');
  check(Array.isArray(original.knots) && original.knots.length <= 70, CODE.INPUT, 'at most70 original knots required');
  native(() => validateCurve(original), 'original positive open-clamped native admission', CODE.INPUT);
  check(typeof o.chordToleranceMM === 'number' && Number.isFinite(o.chordToleranceMM)
    && o.chordToleranceMM >= 1e-7 && o.chordToleranceMM <= 1000, CODE.INPUT, 'chordToleranceMM1e-7..1000 required');
  check(typeof o.maxSegments === 'number' && Number.isInteger(o.maxSegments) && o.maxSegments >= 1 && o.maxSegments <= 4096,
    CODE.BUDGET, 'maxSegments1..4096 required');
  check(typeof o.maxDepth === 'number' && Number.isInteger(o.maxDepth) && o.maxDepth >= 0 && o.maxDepth <= 16,
    CODE.BUDGET, 'maxDepth0..16 required');
  check(typeof o.resultIdPrefix === 'string' && o.resultIdPrefix.length <= 20 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(o.resultIdPrefix),
    CODE.IDENTITY, 'ASCII result prefix1..20 required');
  const options: WideAdaptiveCurveSamplingOptions = { chordToleranceMM: o.chordToleranceMM,
    maxSegments: o.maxSegments, maxDepth: o.maxDepth, resultIdPrefix: o.resultIdPrefix };
  const role = (suffix: string) => id(options.resultIdPrefix + suffix);
  const domain = curveDomain(original), knotSpans: number[] = [];
  for (let k = original.degree; k < original.controlPoints.length; k++) if (original.knots[k] < original.knots[k + 1]) {
    check(finite(original.knots[k + 1] - original.knots[k], 'original span width overflow') > 0,
      CODE.SPAN, 'positive represented original span required');
    knotSpans.push(k);
  }
  const spanCount = knotSpans.length;
  check(spanCount >= 1 && spanCount <= 64, CODE.SPAN, '1..64 nonzero original spans required');
  check(options.maxSegments >= spanCount, CODE.BUDGET, 'segment budget must retain each original span');
  const splitCapacity = options.maxSegments - spanCount;
  const roles = [role('_model')];
  for (let i = 0; i < spanCount; i++) roles.push(role('_span_' + i));
  for (let i = 0; i < splitCapacity; i++) roles.push(role('_split_' + i + '_lo'), role('_split_' + i + '_hi'));
  for (let i = 0; i < options.maxSegments; i++) roles.push(role('_seg_' + i));
  for (let i = 0; i <= options.maxSegments; i++) roles.push(role('_pt_' + i));
  check(roles.length <= 32768 && new Set(roles).size === roles.length && !roles.includes(original.id),
    CODE.IDENTITY, 'bounded original/context/generated identity reservation failed');
  const file = sourceCurve(original, role('_model'));
  const spans = knotSpans.map((k, i) => extractSpan(file.curve, k, i, role('_span_' + i)));
  const segments: WideAdaptiveCurveSegment[] = [], operations: WideAdaptiveCurveSplitOperation[] = [];
  let leafCapacity = spanCount;
  const visit = (bezier: Curve, originalSpanIndex: number, originalSpanDomain: [number, number], depth: number): void => {
    const interval = curveDomain(bezier);
    check(bezier.controlPoints.length === bezier.degree + 1 && bezier.controlPoints.length <= 4
      && bezier.knots.length === 2 * (bezier.degree + 1), CODE.NATIVE, 'local single-span Bezier required');
    check(bezier.controlPoints.every(control => control.every(value => Number.isFinite(value) && Math.abs(value) <= 10000))
      && bezier.weights.every(weight => Number.isFinite(weight) && weight >= 1e-6 && weight <= 1e6),
    CODE.NATIVE, 'subdivided local controls/weights outside admitted native profile');
    const startMM = point(original, interval[0]), endMM = point(original, interval[1]);
    const controlPolygonBoundMM = finite(Math.max(...bezier.controlPoints.map(control => chordDistance(control, startMM, endMM))),
      'local control hull bound overflow');
    const chordLength = distance(endMM, startMM);
    const arithmeticUncertaintyMM = finite(EPS * Math.max(1, chordLength,
      ...bezier.controlPoints.flatMap(control => control.map(Math.abs)), ...startMM.map(Math.abs), ...endMM.map(Math.abs)),
    'arithmetic uncertainty overflow');
    const gap = finite(options.chordToleranceMM - controlPolygonBoundMM, 'chord criterion subtraction overflow');
    check(Math.abs(gap) > arithmeticUncertaintyMM, CODE.REPRESENTABILITY,
      'finite chord acceptance threshold unresolved; no snapped acceptance');
    if (finite(controlPolygonBoundMM + arithmeticUncertaintyMM, 'chord criterion sum overflow') <= options.chordToleranceMM) {
      check(segments.length < options.maxSegments && segments.length < 4096, CODE.BUDGET, 'accepted segment capacity exhausted');
      const observations = [interval[0], midpoint(interval), interval[1]].map((parameter): WideAdaptiveCurveObservation => {
        const originalPointMM = point(original, parameter), extractedPointMM = point(bezier, parameter);
        const extractionDifferenceMM = distance(originalPointMM, extractedPointMM);
        check(extractionDifferenceMM <= POINT_TOLERANCE, CODE.BINDING, 'original/local point residual exceeds1e-7mm');
        const originalD1 = d1(original, parameter), extractedD1 = d1(bezier, parameter);
        const derivativeDifferenceMM = originalD1.status === 'evaluated' && extractedD1.status === 'evaluated'
          ? distance(originalD1.value.derivative, extractedD1.value.derivative) : null;
        const relativeDerivativeDifference = derivativeDifferenceMM === null || originalD1.status !== 'evaluated' ? null
          : finite(derivativeDifferenceMM / Math.max(1, finite(Math.hypot(...originalD1.value.derivative), 'original derivative norm overflow', CODE.BINDING)),
            'relative D1 residual overflow', CODE.BINDING);
        check(relativeDerivativeDifference === null || relativeDerivativeDifference <= D1_TOLERANCE,
          CODE.BINDING, 'original/local D1 residual exceeds relative1e-7 policy');
        return { parameter, originalPointMM, extractedPointMM, extractionDifferenceMM,
          outputChordDistanceMM: chordDistance(originalPointMM, startMM, endMM), originalD1, extractedD1,
          derivativeDifferenceMM, relativeDerivativeDifference };
      });
      segments.push({ id: role('_seg_' + segments.length), domain: interval, originalSpanIndex,
        originalSpanDomain, depth, bezier, controlPolygonBoundMM, arithmeticUncertaintyMM,
        finiteChord: { startMM, endMM, degenerate: startMM.every((value, i) => value === endMM[i]) }, observations,
        maximumExtractionDifferenceMM: Math.max(...observations.map(value => value.extractionDifferenceMM)),
        maximumObservedOutputChordDistanceMM: Math.max(...observations.map(value => value.outputChordDistanceMM)),
        maximumRelativeDerivativeDifference: Math.max(0, ...observations.map(value => value.relativeDerivativeDifference ?? 0)) });
      return;
    }
    check(depth < options.maxDepth, CODE.BUDGET, 'adaptive maxDepth exhausted; no partial result');
    check(leafCapacity < options.maxSegments && leafCapacity < 4096 && operations.length < 4095
      && operations.length < splitCapacity, CODE.BUDGET, 'adaptive segment/split budget exhausted; no partial result');
    const parameter = midpoint(interval), index = operations.length;
    const lowerCurveId = role('_split_' + index + '_lo'), upperCurveId = role('_split_' + index + '_hi');
    const split = native(() => splitCurveAtParameter(bezier, { parameter, lowerCurveId, upperCurveId }), 'local native Bezier subdivision');
    check(split.refined.controlPoints.length <= 2 * bezier.degree + 1 && split.refined.controlPoints.length <= 7
      && split.lower.controlPoints.length === bezier.degree + 1 && split.upper.controlPoints.length === bezier.degree + 1,
    CODE.NATIVE, 'local native subdivision temporary capacity exceeded');
    operations.push({ index, purpose: 'adaptive-subdivision', originalSpanIndex, depth: depth + 1,
      inputCurveId: bezier.id, inputDomain: interval, parameter, lowerCurveId, upperCurveId,
      refinementKind: split.provenance.refinement.kind, insertions: split.provenance.refinement.insertions,
      firstRefinedKnotIndex: split.provenance.firstRefinedKnotIndex, poleCounts: split.report.poleCounts,
      sharedCoefficient: split.provenance.shared, cutEndpoints: split.report.cutEndpoints,
      nativeMaximumObservedDifferenceMM: split.report.maximumObservedDifferenceMM });
    leafCapacity++;
    visit(split.lower, originalSpanIndex, originalSpanDomain, depth + 1);
    visit(split.upper, originalSpanIndex, originalSpanDomain, depth + 1);
  };
  for (const span of spans) visit(span.bezier, span.index, span.domain, 0);
  check(segments.length === leafCapacity && operations.length === segments.length - spanCount,
    CODE.NATIVE, 'local extraction/subdivision work and accepted intervals differ');
  const parameters = [segments[0].domain[0]];
  for (const [index, segment] of segments.entries()) {
    if (index > 0) check(Object.is(segments[index - 1].domain[1], segment.domain[0]), CODE.NATIVE,
      'neighboring intervals lost shared native parameter bits');
    check(segment.domain[0] < segment.domain[1], CODE.SPAN, 'positive ordered native interval required');
    parameters.push(segment.domain[1]);
  }
  check(parameters.length <= 4097 && Object.is(parameters[0], domain[0])
    && Object.is(parameters[parameters.length - 1], domain[1]), CODE.NATIVE, 'original domain endpoints/point capacity changed');
  const pointsMM = parameters.map(parameter => point(original, parameter));
  const guarded = spans.slice(1).map(span => span.domain[0]).filter(parameter =>
    original.knots.filter(knot => knot === parameter).length >= original.degree);
  const samples: WideAdaptiveCurveSample[] = parameters.map((parameter, index) => {
    const adjacent = segments.filter(segment => segment.domain[0] === parameter || segment.domain[1] === parameter);
    const originalSpanIndices = [...new Set(adjacent.map(segment => segment.originalSpanIndex))];
    return { id: role('_pt_' + index), parameter, pointMM: pointsMM[index], adjacentSegmentIds: adjacent.map(segment => segment.id),
      originalSpanIndices, atOriginalKnot: original.knots.some(knot => knot === parameter), originalD1Guarded: guarded.includes(parameter) };
  });
  const report: WideAdaptiveCurveSamplingReport = {
    family: 'own-wide-adaptive-native-rational-curve-display-samples',
    dto: { schema: 'barocss-native-curve-samples', version: 1, lengthUnit: 'mm', frame: 'authored-xyz-no-axis-conversion',
      representation: 'sampled-display-points-not-native-edges-or-fit',
      capacity: { maximumOriginalPoles: 64, maximumOriginalKnots: 70, maximumSegments: 4096, maximumPoints: 4097 } },
    curveId: original.id, degree: original.degree, originalSpanCount: spanCount, segmentCount: segments.length,
    pointCount: pointsMM.length, operationCount: operations.length, maximumDepthUsed: Math.max(...segments.map(segment => segment.depth)),
    maximumControlPolygonBoundMM: Math.max(...segments.map(segment => segment.controlPolygonBoundMM)),
    maximumArithmeticUncertaintyMM: Math.max(...segments.map(segment => segment.arithmeticUncertaintyMM)),
    maximumExtractionDifferenceMM: Math.max(...segments.map(segment => segment.maximumExtractionDifferenceMM)),
    maximumObservedOutputChordDistanceMM: Math.max(...segments.map(segment => segment.maximumObservedOutputChordDistanceMM)),
    maximumRelativeDerivativeDifference: Math.max(...segments.map(segment => segment.maximumRelativeDerivativeDifference)),
    maximumPartitionResidual: Math.max(...spans.map(span => span.maximumPartitionResidual)), originalGuardedParameters: guarded,
    geometryAuthority: 'original-evaluateCurve-and-original-source0', geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    inputProfile: { degreeRange: [1, 3], poleRange: [2, 64], maximumKnots: 70, weightRange: [1e-6, 1e6],
      coordinateAbsMM: 10000, maximumNonzeroSpans: 64, clamped: true, nonperiodic: true },
    budgetFailure: 'atomic-refusal-no-partial-result',
    quality: { criterion: 'finite-segment-control-hull-estimate-plus-arithmetic-margin',
      extraction: 'local-cox-de-boor-to-bernstein-coefficients', extractionReference: 'https://doi.org/10.1002/nme.2968',
      globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, localObservationsOnly: true,
      pointComparisonMM: 1e-7, relativeD1Comparison: 1e-7, partitionComparison: EPS,
      positiveWeightHullReference: ['https://pages.mtu.edu/~shene/COURSES/cs3621/NOTES/spline/NURBS/RB.html',
        'https://pages.mtu.edu/~shene/COURSES/cs3621/NOTES/spline/NURBS/NURBS-property.html'],
      derivativeSemantics: 'original-native-c0-guards-and-local-one-sided-d1-no-g1-g2-claim',
      ownership: 'copied-cpu-data-gc-no-renderer-resources', identity: 'display-provenance-roles-not-native-edges-or-fit' },
    limits: { maximumOriginalPoles: 64, maximumOriginalKnots: 70, maximumOriginalSpans: 64,
      maximumSegments: 4096, maximumPoints: 4097, maximumDepth: 16, maximumOperations: 4095,
      maximumReservedRoleIds: 32768, maximumLocalBezierPoles: 4, maximumTemporaryPoles: 7,
      inputValues: 32768, inputDepth: 8, inputArrayElements: 128, inputRecordFields: 16, inputStringCharacters: 128,
      snapshotValues: 2097152, snapshotDepth: 32, arrayElements: 8192, recordFields: 64,
      sourceStringCharacters: 262144, authoredIdCharacters: 48, resultIdPrefixCharacters: 20 },
  };
  return snapshot({ curve: file.curve, options, source: file.source, sourceVersion: 0, model: file.model, domain,
    parameters, pointsMM, samples, spans, segments, operations, report }, true) as WideAdaptiveCurveSamplingResult;
}

/** Rebuild all original/source/analytic/native-split/point/quality fields before accepting an owned DTO. */
export function validateWideAdaptiveCurveSamples(input: WideAdaptiveCurveSamplingResult): WideAdaptiveCurveSamplingReport {
  const owned = snapshot(input, true) as WideAdaptiveCurveSamplingResult;
  check(owned !== null && typeof owned === 'object' && !Array.isArray(owned), CODE.OWNED, 'owned wide adaptive samples required');
  let expected: WideAdaptiveCurveSamplingResult;
  try { expected = sampleCurveWideAdaptive(owned.curve, owned.options); } catch (cause) {
    throw new WideAdaptiveCurveSamplingError(CODE.OWNED, 'owned original/options deterministic rebuild refused', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'owned source/options/analytic spans/lineage/native splits/points/D1/IDs/quality mismatch');
  return copyCadData(expected.report);
}
