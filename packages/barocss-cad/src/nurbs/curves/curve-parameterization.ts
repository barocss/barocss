import { buildInterpolatingCurve, CurveInterpolationError } from './curve-interpolation.js';
import type { CurveInterpolationResult } from './curve-interpolation.js';
import { curveDomain } from '../../core/math.js';
import type { Point } from '../../types.js';
import { same } from '../../core/structural-equality.js';
import { KernelError } from '../../core/barocss-error.js';

export const CurveParameterizationDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', NATIVE: 'NATIVE',
  REPRESENTABILITY: 'REPRESENTABILITY', CONDITIONING: 'CONDITIONING', BINDING: 'BINDING', OWNED: 'OWNED' } as const);
export type CurveParameterizationDiagnosticCode = typeof CurveParameterizationDiagnosticCode[keyof typeof CurveParameterizationDiagnosticCode];
export class CurveParameterizationError extends KernelError {
  readonly code: CurveParameterizationDiagnosticCode;
  constructor(code: CurveParameterizationDiagnosticCode, detail: string, cause?: unknown) {
    super(('Curve parameterization: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CurveParameterizationError'; this.code = code;
  }
}
export type CurveParameterizationMethod = 'uniform' | 'chord-length' | 'centripetal';
export interface CurveParameterizationOptions { curveId: string; degree: number; method: CurveParameterizationMethod; domain: [number, number];
  maximumMetricEvaluations: number; maximumBasisEvaluations: number; maximumEliminationSteps: number }
export interface CurveParameterizationReport {
  schema: 'barocss-native-curve-parameterization'; version: 0; curveId: string; degree: number; lengthUnit: 'mm'; sourceFrame: 'authored-xyz-no-axis-conversion';
  method: CurveParameterizationMethod; requestedDomain: [number, number]; pointCount: number; distanceUnit: 'mm'; incrementUnit: 'dimensionless' | 'mm' | 'sqrt-mm';
  segments: { index: number; fromPointIndex: number; toPointIndex: number; deltaMM: Point; distanceMM: number; increment: number; cumulative: number }[];
  cumulativeIncrements: number[]; totalIncrement: number; fractions: number[]; generatedParameters: number[];
  metricEvaluationCount: number; childConstructionCount: 1; basisEvaluationCount: number; eliminationStepCount: number; pointEvaluationCount: number; maximumPointDifferenceMM: number;
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  quality: { metricMeaning: 'authored-consecutive-xyz-polyline-chords-not-native-curve-arc-length'; inputPointsAndOrderPreserved: true; requestedEndpointBitsPreserved: true;
    generatedParameters: 'strictly-represented-requested-domain-no-ties-dedup-or-output-normalization'; interpolationAuthority: 'one-actual-public-native-curve-interpolation';
    methodShapePolicy: 'choice-may-change-native-curve-shape'; workScope: 'actual-consecutive-chord-metrics-and-one-native-child-with-separate-actual-child-counts';
    bestFitCertified: false; noLoopCertified: false; regularityCertified: false; rationalFit: false; leastSquaresFit: false; arcLengthCertified: false;
    globalShapeErrorCertified: false; globalBinary64ErrorCertified: false; manufacturingToleranceCertified: false; ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-no-partial-parameterized-curve';
  limits: { maximumPoints: 16; maximumDegree: 3; maximumMetricEvaluations: 15; maximumBasisEvaluations: 256; maximumEliminationSteps: 120; authoredIdCharacters: 48;
    parameterAbs: 10000; coordinateAbsMM: 10000; inputValues: 32768; inputDepth: 8; inputArrayElements: 128; inputRecordFields: 16; inputStringCharacters: 128;
    ownValues: 524288; ownDepth: 32; arrayElements: 4096; recordFields: 64; sourceStringCharacters: 262144 };
}
export interface CurveParameterizationResult { points: Point[]; options: CurveParameterizationOptions; interpolation: CurveInterpolationResult; report: CurveParameterizationReport }

const CODE = CurveParameterizationDiagnosticCode;
function check(condition: boolean, code: CurveParameterizationDiagnosticCode, detail: string): asserts condition { if (!condition) throw new CurveParameterizationError(code, detail); }
function native<T>(action: () => T, detail: string): T {
  try { return action(); } catch (cause) {
    if (cause instanceof CurveParameterizationError) throw cause;
    throw new CurveParameterizationError(cause instanceof CurveInterpolationError ? cause.code : CODE.NATIVE,
      detail + ': ' + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
  }
}
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT;
  let remaining = owned ? 524288 : 32768;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= (owned ? 32 : 8), code, 'own-value/depth budget exceeded');
    if (value === null && owned || typeof value === 'boolean' && owned) return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'finite own numbers required'); return value; }
    if (typeof value === 'string') { check(value.length <= (owned ? 262144 : 128), code, 'own/source string budget exceeded'); return value; }
    check(value !== null && typeof value === 'object', code, 'plain own data required'); check(!ancestors.has(value), code, 'ancestor cycles refused');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'foreign own-data prototype refused');
    check(keys.length <= (array ? (owned ? 4097 : 129) : (owned ? 64 : 16)) && keys.every(key => typeof key === 'string' && key.length <= 128
      && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden/excess own fields refused');
    ancestors.add(value);
    try {
      if (array) {
        const n = descriptors.length.value as number;
        check(Number.isInteger(n) && n >= 0 && n <= (owned ? 4096 : 128) && keys.length === n + 1, code, 'dense bounded own array required');
        return Array.from({ length: n }, (_, i) => { check(Object.hasOwn(descriptors, String(i)), code, 'sparse/foreign own array field refused'); return copy(descriptors[String(i)].value, depth + 1); });
      }
      return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    } finally { ancestors.delete(value); }
  }; return copy(input, 0);
}
function record(input: unknown, fields: string[], code: CurveParameterizationDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'own record required'); const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'exact fields required: ' + fields.join(',')); return data;
}
function id(value: unknown): string { check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII ID1..48 required'); return value; }
function finite(value: number): number { check(Number.isFinite(value), CODE.REPRESENTABILITY, 'finite chord/increment/fraction/mapped-parameter arithmetic required'); return value; }
function product(a: number, b: number): number { const value = finite(a * b); check(a === 0 || b === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero mapped parameter product underflow'); return value; }
function quotient(a: number, b: number): number { const value = finite(a / b); check(a === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero parameter fraction underflow'); return value; }

/** Caller-selected point-polyline parameter rule followed by exactly one actual native interpolation. */
export function buildParameterizedInterpolatingCurve(pointsInput: Point[], optionsInput: CurveParameterizationOptions): CurveParameterizationResult {
  const copied = record(snapshot({ points: pointsInput, options: optionsInput }), ['points', 'options']);
  check(Array.isArray(copied.points) && copied.points.length >= 2 && copied.points.length <= 16 && copied.points.every(point => Array.isArray(point) && point.length === 3
    && point.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000)), CODE.INPUT, '2..16 authored XYZ points within10000mm required');
  const points = copied.points as Point[], data = record(copied.options, ['curveId', 'degree', 'method', 'domain', 'maximumMetricEvaluations', 'maximumBasisEvaluations', 'maximumEliminationSteps']);
  const curveId = id(data.curveId);
  check(typeof data.degree === 'number' && Number.isInteger(data.degree) && data.degree >= 1 && data.degree <= 3 && points.length >= data.degree + 1, CODE.INPUT, 'degree1..3 and pointCount>=degree+1 required');
  check(data.method === 'uniform' || data.method === 'chord-length' || data.method === 'centripetal', CODE.INPUT, 'explicit uniform/chord-length/centripetal method required');
  check(Array.isArray(data.domain) && data.domain.length === 2 && data.domain.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000)
    && data.domain[1] > data.domain[0] && Number.isFinite(data.domain[1] - data.domain[0]), CODE.INPUT, 'explicit increasing finite original requested domain within10000 required');
  for (const [field, maximum] of [['maximumMetricEvaluations', 15], ['maximumBasisEvaluations', 256], ['maximumEliminationSteps', 120]] as const)
    check(typeof data[field] === 'number' && Number.isInteger(data[field]) && (data[field] as number) >= 0 && (data[field] as number) <= maximum, CODE.BUDGET, 'integer ' + field + ' within complete native work capacity required');
  const options: CurveParameterizationOptions = { curveId, degree: data.degree, method: data.method, domain: data.domain as [number, number],
    maximumMetricEvaluations: data.maximumMetricEvaluations as number, maximumBasisEvaluations: data.maximumBasisEvaluations as number, maximumEliminationSteps: data.maximumEliminationSteps as number };
  const count = points.length, expectedMetrics = count - 1, expectedBasis = count * count, expectedEliminations = count * (count - 1) / 2;
  check(expectedMetrics <= options.maximumMetricEvaluations && expectedBasis <= options.maximumBasisEvaluations && expectedEliminations <= options.maximumEliminationSteps,
    CODE.BUDGET, 'complete segment metrics/native basis/row-stage budgets required BEFORE metric work or child construction');
  const segments: CurveParameterizationReport['segments'] = [], cumulativeIncrements = [0];
  let metricEvaluationCount = 0;
  for (let i = 0; i < count - 1; i++) {
    const deltaMM = points[i + 1].map((value, axis) => finite(value - points[i][axis])) as Point;
    check(deltaMM.every((value, axis) => points[i + 1][axis] === points[i][axis] || value !== 0), CODE.REPRESENTABILITY, 'nonzero authored coordinate difference disappeared');
    metricEvaluationCount++; const distanceMM = finite(Math.hypot(...deltaMM));
    if (options.method !== 'uniform') check(distanceMM > 0, CODE.INPUT, 'metric parameterization requires every consecutive authored chord to be positive; no point dropping');
    const increment = options.method === 'uniform' ? 1 : options.method === 'chord-length' ? distanceMM : finite(Math.sqrt(distanceMM));
    check(increment > 0, CODE.REPRESENTABILITY, 'positive represented parameter increment required');
    const previous = cumulativeIncrements[cumulativeIncrements.length - 1], cumulative = finite(previous + increment);
    check(cumulative > previous && (previous === 0 || cumulative > increment), CODE.REPRESENTABILITY, 'positive cumulative contribution disappeared into unchanged total');
    cumulativeIncrements.push(cumulative); segments.push({ index: i, fromPointIndex: i, toPointIndex: i + 1, deltaMM, distanceMM, increment, cumulative });
  }
  const totalIncrement = cumulativeIncrements[count - 1], fractions = [0], generatedParameters = [options.domain[0]], span = finite(options.domain[1] - options.domain[0]);
  check(totalIncrement > 0, CODE.REPRESENTABILITY, 'finite positive complete increment total required');
  for (let i = 1; i < count - 1; i++) {
    const fraction = quotient(cumulativeIncrements[i], totalIncrement);
    check(fraction > fractions[fractions.length - 1] && fraction > 0 && fraction < 1, CODE.REPRESENTABILITY, 'strict represented interior fractions required');
    const offset = product(span, fraction), parameter = finite(options.domain[0] + offset);
    check(parameter !== options.domain[0] && parameter > generatedParameters[generatedParameters.length - 1] && parameter > options.domain[0] && parameter < options.domain[1],
      CODE.REPRESENTABILITY, 'mapped nonzero interior parameter shift disappeared/tied or left requested domain; no repair');
    fractions.push(fraction); generatedParameters.push(parameter);
  }
  fractions.push(1); generatedParameters.push(options.domain[1]);
  const throughPoints = generatedParameters.map((parameter, index) => ({ parameter, pointMM: points[index] }));
  const interpolation = native(() => buildInterpolatingCurve(throughPoints, { curveId, degree: options.degree,
    maximumBasisEvaluations: options.maximumBasisEvaluations, maximumEliminationSteps: options.maximumEliminationSteps }), 'actual public native interpolating Curve construction refused');
  check(metricEvaluationCount === expectedMetrics && interpolation.report.basisEvaluationCount === expectedBasis && interpolation.report.eliminationStepCount === expectedEliminations
    && interpolation.report.pointEvaluationCount === count, CODE.BINDING, 'actual complete metric and child native work counts required');
  check(same(interpolation.points, throughPoints) && same(curveDomain(interpolation.curve), options.domain), CODE.BINDING, 'actual child input parameters/points and native Curve domain bits must match generated requested-domain data');
  const report: CurveParameterizationReport = {
    schema: 'barocss-native-curve-parameterization', version: 0, curveId, degree: options.degree, lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion',
    method: options.method, requestedDomain: options.domain, pointCount: count, distanceUnit: 'mm', incrementUnit: options.method === 'uniform' ? 'dimensionless' : options.method === 'chord-length' ? 'mm' : 'sqrt-mm',
    segments, cumulativeIncrements, totalIncrement, fractions, generatedParameters, metricEvaluationCount, childConstructionCount: 1,
    basisEvaluationCount: interpolation.report.basisEvaluationCount, eliminationStepCount: interpolation.report.eliminationStepCount,
    pointEvaluationCount: interpolation.report.pointEvaluationCount, maximumPointDifferenceMM: interpolation.report.maximumPointDifferenceMM,
    geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    quality: { metricMeaning: 'authored-consecutive-xyz-polyline-chords-not-native-curve-arc-length', inputPointsAndOrderPreserved: true, requestedEndpointBitsPreserved: true,
      generatedParameters: 'strictly-represented-requested-domain-no-ties-dedup-or-output-normalization', interpolationAuthority: 'one-actual-public-native-curve-interpolation',
      methodShapePolicy: 'choice-may-change-native-curve-shape', workScope: 'actual-consecutive-chord-metrics-and-one-native-child-with-separate-actual-child-counts',
      bestFitCertified: false, noLoopCertified: false, regularityCertified: false, rationalFit: false, leastSquaresFit: false, arcLengthCertified: false,
      globalShapeErrorCertified: false, globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, ownership: 'copied-cpu-data-gc-no-renderer-resources' },
    budgetFailure: 'atomic-refusal-no-partial-parameterized-curve', limits: { maximumPoints: 16, maximumDegree: 3, maximumMetricEvaluations: 15,
      maximumBasisEvaluations: 256, maximumEliminationSteps: 120, authoredIdCharacters: 48, parameterAbs: 10000, coordinateAbsMM: 10000,
      inputValues: 32768, inputDepth: 8, inputArrayElements: 128, inputRecordFields: 16, inputStringCharacters: 128, ownValues: 524288, ownDepth: 32,
      arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144 },
  };
  return snapshot({ points, options, interpolation, report }, true) as CurveParameterizationResult;
}
/** Rebuild original chords/parameters and the unchanged native child, with full bit-sensitive equality. */
export function validateParameterizedInterpolatingCurve(input: CurveParameterizationResult): CurveParameterizationReport {
  const owned = record(snapshot(input, true), ['points', 'options', 'interpolation', 'report'], CODE.OWNED) as unknown as CurveParameterizationResult;
  let expected: CurveParameterizationResult;
  try { expected = buildParameterizedInterpolatingCurve(owned.points, owned.options); } catch (cause) { throw new CurveParameterizationError(CODE.OWNED, 'owned complete metric/parameter/native-child reconstruction refused', cause); }
  check(same(owned, expected), CODE.OWNED, 'owned original points/options/chords/increments/fractions/parameters/native source/solver/work/report mismatch');
  return snapshot(expected.report, true) as CurveParameterizationReport;
}
