import { CadNumericPolicy } from '../../numeric-policy.js';
import { validateCurve, curveDomain, evaluateCurve } from '../../math.js';
import { evaluateCurveD1 } from '../../derivatives.js';
import { extractCurveBezierSpanTrusted, WideAdaptiveCurveSamplingError } from '../source-wide/curve-wide-adaptive-sampling.js';
import type { WideAdaptiveCurveSpan, WideAdaptiveCurveD1State } from '../source-wide/curve-wide-adaptive-sampling.js';
import { compileCadModel } from '../../model-compiler.js';
import { curveDecimal } from './curve-source.js';
import { copyCadData } from '../../data-copy.js';
import type { Curve, Model, Point } from '../../types.js';
import { same } from '../../structural-equality.js';

export const CurveBezierSpanExtractionDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', SPAN: 'SPAN', REPRESENTABILITY: 'REPRESENTABILITY',
  NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
} as const);
export type CurveBezierSpanExtractionDiagnosticCode =
  typeof CurveBezierSpanExtractionDiagnosticCode[keyof typeof CurveBezierSpanExtractionDiagnosticCode];
export class CurveBezierSpanExtractionError extends Error {
  readonly code: CurveBezierSpanExtractionDiagnosticCode;
  constructor(code: CurveBezierSpanExtractionDiagnosticCode, detail: string, cause?: unknown) {
    super(('Curve Bezier span extraction: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CurveBezierSpanExtractionError';
    this.code = code;
  }
}
export interface CurveBezierSpanExtractionOptions { resultIdPrefix: string }
export type CurveBezierSpan = WideAdaptiveCurveSpan;
export type CurveBezierSpanD1State = WideAdaptiveCurveD1State;
export interface CurveBezierSpanObservation {
  spanIndex: number; bezierCurveId: string; location: 'start' | 'midpoint' | 'end'; parameter: number;
  originalPointMM: Point; extractedPointMM: Point; extractionDifferenceMM: number;
  originalD1: CurveBezierSpanD1State; extractedD1: CurveBezierSpanD1State;
  derivativeDifferenceMM: number | null; relativeDerivativeDifference: number | null;
}
export interface CurveBezierSpanEndpoint {
  parameter: number; originalPointMM: Point; adjacentSpanIndices: number[]; adjacentBezierCurveIds: string[];
  atOriginalKnot: boolean; originalMultiplicity: number; originalD1Guarded: boolean; originalD1: CurveBezierSpanD1State;
  localSides: { spanIndex: number; bezierCurveId: string; side: 'start' | 'end'; pointMM: Point;
    pointDifferenceMM: number; d1: CurveBezierSpanD1State;
    derivativeDifferenceMM: number | null; relativeDerivativeDifference: number | null }[];
}
export interface CurveBezierSpanExtractionReport {
  family: 'own-native-positive-rational-curve-bezier-spans';
  dto: { schema: 'barocss-native-curve-bezier-spans'; version: 0; lengthUnit: 'mm';
    frame: 'authored-xyz-no-axis-conversion'; representation: 'native-coefficient-spans-not-wire-or-fit' };
  curveId: string; degree: number; domain: [number, number]; originalPoleCount: number; originalKnotCount: number;
  spanCount: number; observationCount: number; endpointCount: number;
  maximumExtractionDifferenceMM: number; maximumRelativeDerivativeDifference: number; maximumPartitionResidual: number;
  originalGuardedParameters: number[]; geometryAuthority: 'original-curve-coefficients-and-original-source0';
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  inputProfile: { degreeRange: [1, 3]; poleRange: [2, 64]; maximumKnots: 70; weightRange: [1e-6, 1e6];
    coordinateAbsMM: 10000; maximumNonzeroSpans: 64; clamped: true; nonperiodic: true };
  budgetFailure: 'atomic-refusal-no-partial-result';
  quality: { extraction: 'existing-local-cox-de-boor-to-bernstein-coefficients'; extractionReference: string;
    pointComparisonMM: 1e-7; relativeD1Comparison: 1e-7; partitionComparison: number;
    localObservationsOnly: true; globalBinary64ErrorCertified: false; manufacturingToleranceCertified: false;
    derivativeSemantics: 'original-native-c0-guards-and-local-one-sided-d1-no-g1-g2-claim';
    adjacencySemantics: 'native-parameter-and-point-observations-not-sewn-wire-topology';
    ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  limits: { maximumDegree: 3; maximumOriginalPoles: 64; maximumOriginalKnots: 70; maximumSpans: 64;
    maximumLocalBezierPoles: 4; maximumObservations: 192; maximumEndpoints: 65; maximumReservedRoleIds: 65;
    inputValues: 32768; inputDepth: 8; inputArrayElements: 128; inputRecordFields: 16; inputStringCharacters: 128;
    snapshotValues: 262144; snapshotDepth: 32; arrayElements: 4096; recordFields: 64;
    sourceStringCharacters: 262144; authoredIdCharacters: 48; resultIdPrefixCharacters: 20 };
}
export interface CurveBezierSpanExtractionResult {
  curve: Curve; options: CurveBezierSpanExtractionOptions; source: string; sourceVersion: 0; model: Model;
  domain: [number, number]; spans: CurveBezierSpan[]; observations: CurveBezierSpanObservation[];
  endpoints: CurveBezierSpanEndpoint[]; report: CurveBezierSpanExtractionReport;
}

const CODE = CurveBezierSpanExtractionDiagnosticCode;
const EPS = 64 * Number.EPSILON, POINT_TOLERANCE = CadNumericPolicy.linearToleranceMM, D1_TOLERANCE = CadNumericPolicy.relativeComparison;
function check(condition: boolean, code: CurveBezierSpanExtractionDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new CurveBezierSpanExtractionError(code, detail);
}
function finite(value: number, detail: string, code: CurveBezierSpanExtractionDiagnosticCode = CODE.REPRESENTABILITY): number {
  check(Number.isFinite(value), code, detail);
  return value;
}
function native<T>(operation: () => T, detail: string, code: CurveBezierSpanExtractionDiagnosticCode = CODE.NATIVE): T {
  try { return operation(); } catch (cause) {
    if (cause instanceof CurveBezierSpanExtractionError) throw cause;
    const actualCode = cause instanceof WideAdaptiveCurveSamplingError
      ? cause.code === 'BUDGET' ? CODE.NATIVE : cause.code : code;
    throw new CurveBezierSpanExtractionError(actualCode, detail + ': '
      + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
  }
}
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT;
  let remaining = owned ? 262144 : 32768;
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
    check(keys.length <= (array ? (owned ? 4097 : 129) : (owned ? 64 : 16)), code, 'own field budget exceeded');
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden own data refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= (owned ? 4096 : 128)
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
function sourceCurve(curve: Curve, name: string): { curve: Curve; source: string; model: Model } {
  const decimal = (value: number) => native(() => curveDecimal(value, 'Curve Bezier span extraction'), 'source decimal');
  const list = (values: number[]) => '[' + values.map(decimal).join(',') + ']';
  const source = '@model ' + name + ' { version:0; length-unit:mm; @curve #' + curve.id
    + ' { type:nurbs; degree:' + decimal(curve.degree) + '; knots:' + list(curve.knots)
    + '; control-points:[' + curve.controlPoints.map(list).join(',') + ']; weights:' + list(curve.weights) + '; } }\n';
  check(source.length <= 262144, CODE.NATIVE, 'individual source0 string budget exceeded');
  const compiled = native(() => compileCadModel(source, { sourceVersion: 0 }), 'original source0 compilation');
  if (!compiled.ok) throw new CurveBezierSpanExtractionError(CODE.NATIVE, 'actual original Curve-only source0 must compile', compiled);
  check(same(compiled.model, { name, version: 0, lengthUnit: 'mm', objects: [curve] }), CODE.NATIVE,
    'original source0 must adopt complete coefficient/ID/domain/order/sign bits');
  return { curve: compiled.model.objects[0] as Curve, source, model: compiled.model };
}
function point(curve: Curve, parameter: number): Point {
  const value = native(() => evaluateCurve(curve, parameter), 'native point evaluation');
  check(value.every(Number.isFinite), CODE.NATIVE, 'finite native point required');
  return value;
}
function d1(curve: Curve, parameter: number): CurveBezierSpanD1State {
  try {
    const value = evaluateCurveD1(curve, parameter);
    check(value.point.every(Number.isFinite) && value.derivative.every(Number.isFinite), CODE.NATIVE, 'finite native D1 required');
    return { status: 'evaluated', value };
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'First derivative is not defined at an exact C0 interior knot')
      return { status: 'native-refused', reason: cause.message };
    if (cause instanceof CurveBezierSpanExtractionError) throw cause;
    throw new CurveBezierSpanExtractionError(CODE.NATIVE, 'native D1 arithmetic refused', cause);
  }
}
function distance(a: Point, b: Point): number {
  return finite(Math.hypot(...a.map((value, axis) => finite(value - b[axis], 'native binding subtraction overflow', CODE.BINDING))),
    'native binding distance overflow', CODE.BINDING);
}
function midpoint(domain: [number, number]): number {
  const width = finite(domain[1] - domain[0], 'span width overflow'), half = finite(width / 2, 'span half-width overflow');
  check(width > 0 && half > 0, CODE.REPRESENTABILITY, 'positive represented span half-width required');
  const value = finite(domain[0] + half, 'span midpoint overflow');
  check(value > domain[0] && value < domain[1], CODE.REPRESENTABILITY, 'span midpoint has no represented interior parameter');
  return value;
}
function observation(original: Curve, span: CurveBezierSpan, parameter: number,
  location: CurveBezierSpanObservation['location']): CurveBezierSpanObservation {
  const originalPointMM = point(original, parameter), extractedPointMM = point(span.bezier, parameter);
  const extractionDifferenceMM = distance(originalPointMM, extractedPointMM);
  check(extractionDifferenceMM <= POINT_TOLERANCE, CODE.BINDING, 'original/local point residual exceeds1e-7mm');
  const originalD1 = d1(original, parameter), extractedD1 = d1(span.bezier, parameter);
  check(extractedD1.status === 'evaluated', CODE.NATIVE, 'local endpoint/interior D1 must evaluate');
  const derivativeDifferenceMM = originalD1.status === 'evaluated'
    ? distance(originalD1.value.derivative, extractedD1.value.derivative) : null;
  const relativeDerivativeDifference = derivativeDifferenceMM === null || originalD1.status !== 'evaluated' ? null
    : finite(derivativeDifferenceMM / Math.max(1, finite(Math.hypot(...originalD1.value.derivative), 'original derivative norm overflow', CODE.BINDING)),
      'relative D1 residual overflow', CODE.BINDING);
  check(relativeDerivativeDifference === null || relativeDerivativeDifference <= D1_TOLERANCE,
    CODE.BINDING, 'original/local D1 residual exceeds relative1e-7 policy');
  return { spanIndex: span.index, bezierCurveId: span.bezier.id, location, parameter, originalPointMM,
    extractedPointMM, extractionDifferenceMM, originalD1, extractedD1, derivativeDifferenceMM, relativeDerivativeDifference };
}

/** Extract native coefficient spans without a display tolerance or global original Curve refinement. */
export function extractCurveBezierSpans(curveInput: Curve, inputOptions: CurveBezierSpanExtractionOptions): CurveBezierSpanExtractionResult {
  const original = record(snapshot(curveInput), ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']) as unknown as Curve;
  const o = record(snapshot(inputOptions), ['resultIdPrefix']);
  id(original.id);
  check(original.kind === 'curve' && Number.isInteger(original.degree) && original.degree >= 1 && original.degree <= 3,
    CODE.INPUT, 'native degree1..3 Curve required');
  check(Array.isArray(original.controlPoints) && original.controlPoints.length >= 2 && original.controlPoints.length <= 64
    && original.controlPoints.every(control => Array.isArray(control) && control.length === 3
      && control.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000)),
    CODE.INPUT, '2..64 original poles with authored XYZ±10000mm required');
  check(Array.isArray(original.knots) && original.knots.length <= 70, CODE.INPUT, 'at most70 original knots required');
  native(() => validateCurve(original), 'original positive open-clamped native Curve admission', CODE.INPUT);
  check(typeof o.resultIdPrefix === 'string' && o.resultIdPrefix.length <= 20 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(o.resultIdPrefix),
    CODE.IDENTITY, 'ASCII result prefix1..20 required');
  const options: CurveBezierSpanExtractionOptions = { resultIdPrefix: o.resultIdPrefix };
  const role = (suffix: string) => id(options.resultIdPrefix + suffix);
  const roles = [role('_model'), ...Array.from({ length: 64 }, (_, i) => role('_span_' + i))];
  check(new Set(roles).size === roles.length && !roles.includes(original.id), CODE.IDENTITY,
    'original/context/all64 generated span identity reservation failed');
  const domain = curveDomain(original), knotSpans: number[] = [];
  for (let k = original.degree; k < original.controlPoints.length; k++) if (original.knots[k] < original.knots[k + 1]) {
    check(finite(original.knots[k + 1] - original.knots[k], 'original nonzero span width overflow') > 0,
      CODE.SPAN, 'positive represented original span required');
    knotSpans.push(k);
  }
  check(knotSpans.length >= 1 && knotSpans.length <= 64, CODE.SPAN, '1..64 nonzero original spans required');
  const file = sourceCurve(original, role('_model'));
  const spans = knotSpans.map((k, index) => native(() =>
    extractCurveBezierSpanTrusted(file.curve, k, index, role('_span_' + index)), 'existing trusted analytic span extraction'));
  check(Object.is(spans[0].domain[0], domain[0]) && Object.is(spans[spans.length - 1].domain[1], domain[1]),
    CODE.REPRESENTABILITY, 'original domain endpoint bits changed');
  for (let index = 1; index < spans.length; index++) check(Object.is(spans[index - 1].domain[1], spans[index].domain[0]),
    CODE.REPRESENTABILITY, 'neighboring original span shared parameter bits disagree');
  const observations: CurveBezierSpanObservation[] = [];
  for (const span of spans) {
    check(observations.length + 3 <= 192, CODE.SPAN, 'native observation capacity exceeded');
    const middle = midpoint(span.domain);
    observations.push(observation(file.curve, span, span.domain[0], 'start'),
      observation(file.curve, span, middle, 'midpoint'), observation(file.curve, span, span.domain[1], 'end'));
  }
  const endpointParameters = [spans[0].domain[0], ...spans.map(span => span.domain[1])];
  const endpoints: CurveBezierSpanEndpoint[] = endpointParameters.map(parameter => {
    const adjacent = observations.filter(value => value.location !== 'midpoint' && Object.is(value.parameter, parameter));
    check(adjacent.length >= 1 && adjacent.length <= 2, CODE.SPAN, 'one/two adjacent native span endpoints required');
    const first = adjacent[0], originalMultiplicity = original.knots.filter(knot => knot === parameter).length;
    const originalD1Guarded = parameter > domain[0] && parameter < domain[1] && originalMultiplicity >= original.degree;
    check(originalD1Guarded === (first.originalD1.status === 'native-refused'), CODE.NATIVE, 'original C0 guard facts disagree');
    check(adjacent.every(value => same(value.originalPointMM, first.originalPointMM) && same(value.originalD1, first.originalD1)),
      CODE.BINDING, 'adjacent original native point/D1 observations disagree');
    return { parameter, originalPointMM: first.originalPointMM, adjacentSpanIndices: adjacent.map(value => value.spanIndex),
      adjacentBezierCurveIds: adjacent.map(value => value.bezierCurveId), atOriginalKnot: originalMultiplicity > 0,
      originalMultiplicity, originalD1Guarded, originalD1: first.originalD1,
      localSides: adjacent.map(value => ({ spanIndex: value.spanIndex, bezierCurveId: value.bezierCurveId,
        side: value.location as 'start' | 'end', pointMM: value.extractedPointMM, pointDifferenceMM: value.extractionDifferenceMM,
        d1: value.extractedD1, derivativeDifferenceMM: value.derivativeDifferenceMM,
        relativeDerivativeDifference: value.relativeDerivativeDifference })) };
  });
  const report: CurveBezierSpanExtractionReport = {
    family: 'own-native-positive-rational-curve-bezier-spans',
    dto: { schema: 'barocss-native-curve-bezier-spans', version: 0, lengthUnit: 'mm', frame: 'authored-xyz-no-axis-conversion',
      representation: 'native-coefficient-spans-not-wire-or-fit' },
    curveId: original.id, degree: original.degree, domain, originalPoleCount: original.controlPoints.length,
    originalKnotCount: original.knots.length, spanCount: spans.length, observationCount: observations.length, endpointCount: endpoints.length,
    maximumExtractionDifferenceMM: Math.max(...observations.map(value => value.extractionDifferenceMM)),
    maximumRelativeDerivativeDifference: Math.max(0, ...observations.map(value => value.relativeDerivativeDifference ?? 0)),
    maximumPartitionResidual: Math.max(...spans.map(span => span.maximumPartitionResidual)),
    originalGuardedParameters: endpoints.filter(endpoint => endpoint.originalD1Guarded).map(endpoint => endpoint.parameter),
    geometryAuthority: 'original-curve-coefficients-and-original-source0', geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    inputProfile: { degreeRange: [1, 3], poleRange: [2, 64], maximumKnots: 70, weightRange: [1e-6, 1e6],
      coordinateAbsMM: 10000, maximumNonzeroSpans: 64, clamped: true, nonperiodic: true },
    budgetFailure: 'atomic-refusal-no-partial-result',
    quality: { extraction: 'existing-local-cox-de-boor-to-bernstein-coefficients', extractionReference: 'https://doi.org/10.1002/nme.2968',
      pointComparisonMM: 1e-7, relativeD1Comparison: 1e-7, partitionComparison: EPS, localObservationsOnly: true,
      globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false,
      derivativeSemantics: 'original-native-c0-guards-and-local-one-sided-d1-no-g1-g2-claim',
      adjacencySemantics: 'native-parameter-and-point-observations-not-sewn-wire-topology', ownership: 'copied-cpu-data-gc-no-renderer-resources' },
    limits: { maximumDegree: 3, maximumOriginalPoles: 64, maximumOriginalKnots: 70, maximumSpans: 64,
      maximumLocalBezierPoles: 4, maximumObservations: 192, maximumEndpoints: 65, maximumReservedRoleIds: 65,
      inputValues: 32768, inputDepth: 8, inputArrayElements: 128, inputRecordFields: 16, inputStringCharacters: 128,
      snapshotValues: 262144, snapshotDepth: 32, arrayElements: 4096, recordFields: 64,
      sourceStringCharacters: 262144, authoredIdCharacters: 48, resultIdPrefixCharacters: 20 },
  };
  return snapshot({ curve: file.curve, options, source: file.source, sourceVersion: 0, model: file.model, domain,
    spans, observations, endpoints, report }, true) as CurveBezierSpanExtractionResult;
}

/** Rebuild native original/span sources, analytic lineage and all original/local observations. */
export function validateCurveBezierSpans(input: CurveBezierSpanExtractionResult): CurveBezierSpanExtractionReport {
  const owned = snapshot(input, true) as CurveBezierSpanExtractionResult;
  check(owned !== null && typeof owned === 'object' && !Array.isArray(owned), CODE.OWNED, 'owned Bezier span extraction required');
  let expected: CurveBezierSpanExtractionResult;
  try { expected = extractCurveBezierSpans(owned.curve, owned.options); } catch (cause) {
    throw new CurveBezierSpanExtractionError(CODE.OWNED, 'owned original/options deterministic rebuild refused', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'owned original/source/span Models/matrices/lineage/native point/D1/endpoints/report mismatch');
  return copyCadData(expected.report);
}
