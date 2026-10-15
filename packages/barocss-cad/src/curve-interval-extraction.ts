import { CadNumericPolicy } from './numeric-policy.js';
import { validateCurve, curveDomain, evaluateCurve } from './math.js';
import { evaluateCurveD1 } from './derivatives.js';
import type { CurveD1Result } from './derivatives.js';
import { splitCurveAtParameter } from './curve-parameter-split.js';
import type { CurveParameterSplitResult } from './curve-parameter-split.js';
import { compileCadModel } from './model-compiler.js';
import { curveDecimal } from './curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Model, Point } from './types.js';

export const CurveIntervalExtractionDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', INTERVAL: 'INTERVAL', IDENTITY: 'IDENTITY',
  REPRESENTABILITY: 'REPRESENTABILITY', NATIVE_CAPACITY: 'NATIVE_CAPACITY',
  NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
} as const);
export type CurveIntervalExtractionDiagnosticCode =
  typeof CurveIntervalExtractionDiagnosticCode[keyof typeof CurveIntervalExtractionDiagnosticCode];

export class CurveIntervalExtractionError extends Error {
  readonly code: CurveIntervalExtractionDiagnosticCode;
  constructor(code: CurveIntervalExtractionDiagnosticCode, detail: string, cause?: unknown) {
    super(('Curve interval extraction: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CurveIntervalExtractionError';
    this.code = code;
  }
}
export interface CurveIntervalExtractionOptions {
  curveId: string;
  interval: [number, number];
  resultIdPrefix: string;
}
export type CurveIntervalExtractionD1State =
  { status: 'evaluated'; value: CurveD1Result } | { status: 'native-refused'; reason: string };
export interface CurveIntervalBoundaryChoice {
  boundary: 'start' | 'end';
  requested: number;
  effective: number;
  origin: 'original-domain-endpoint' | 'interior-request';
  adoptedOriginalEndpointBits: boolean;
}
export interface CurveIntervalSplitOperation {
  index: number;
  boundary: 'start' | 'end';
  retainedSide: 'upper' | 'lower';
  result: CurveParameterSplitResult;
}
export interface CurveIntervalExtractionProvenance {
  originalCurveId: string;
  outputCurveId: string;
  originalDomain: [number, number];
  requestedInterval: [number, number];
  effectiveInterval: [number, number];
  parameterMap: { kind: 'identity'; formula: 'u=t'; d1Factor: 1 };
  boundaries: [CurveIntervalBoundaryChoice, CurveIntervalBoundaryChoice];
  fullDomainCopy: boolean;
  operations: CurveIntervalSplitOperation[];
}
export interface CurveIntervalExtractionObservation {
  parameter: number;
  originalPointMM: Point;
  extractedPointMM: Point;
  pointDifferenceMM: number;
  originalD1: CurveIntervalExtractionD1State;
  extractedD1: CurveIntervalExtractionD1State;
  derivativeDifferenceMM: number | null;
}
export interface CurveIntervalExtractionGuardObservation {
  originalParameter: number;
  extractedParameter: number;
  outputLocation: 'interior' | 'start-endpoint' | 'end-endpoint';
  originalAtOriginalKnot: CurveIntervalExtractionD1State;
  extractedAtRetainedParameter: CurveIntervalExtractionD1State;
}
export interface ExtractedCurveIntervalReport {
  family: 'own-native-original-parameter-curve-interval';
  dto: { schema: 'barocss-native-curve-interval'; version: 0; lengthUnit: 'mm';
    frame: 'authored-xyz-no-axis-conversion'; representation: 'native-curve-not-wire-topology' };
  originalCurveId: string;
  curveId: string;
  degree: number;
  poleCounts: { original: number; extracted: number };
  originalDomain: [number, number];
  domain: [number, number];
  operationCount: number;
  observations: CurveIntervalExtractionObservation[];
  guards: CurveIntervalExtractionGuardObservation[];
  maximumPointDifferenceMM: number;
  maximumRelativeDerivativeDifference: number;
  geometricValidity: 'not-certified';
  topologyCertified: false;
  solid: false;
  quality: { pointComparisonMM: 1e-7; relativeD1Comparison: 1e-7; localObservationsOnly: true;
    globalShapeErrorCertified: false; manufacturingToleranceCertified: false;
    derivativeSemantics: 'original-c0-guards-and-extracted-endpoint-d1-distinct-no-g1-g2-claim' };
  limits: { maximumDegree: 3; maximumOriginalPoles: 16; maximumTemporaryPoles: 16;
    maximumOperations: 2; maximumObservations: 128; inputValues: 4096; inputDepth: 8;
    inputArrayElements: 64; inputRecordFields: 16; snapshotValues: 131072; snapshotDepth: 24;
    arrayElements: 4096; recordFields: 64; sourceStringCharacters: 262144; authoredIdCharacters: 48;
    resultIdPrefixCharacters: 20 };
}
export interface ExtractedCurveIntervalResult {
  original: Curve;
  options: CurveIntervalExtractionOptions;
  curve: Curve;
  source: string;
  sourceVersion: 0;
  model: Model;
  originalSource: string;
  originalModel: Model;
  provenance: CurveIntervalExtractionProvenance;
  report: ExtractedCurveIntervalReport;
}

const POINT_TOLERANCE = CadNumericPolicy.linearToleranceMM;
const D1_TOLERANCE = CadNumericPolicy.relativeComparison;
const CODE = CurveIntervalExtractionDiagnosticCode;
function requireValue(condition: boolean, code: CurveIntervalExtractionDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new CurveIntervalExtractionError(code, detail);
}
function finite(value: number, code: CurveIntervalExtractionDiagnosticCode, detail: string): number {
  requireValue(Number.isFinite(value), code, detail);
  return value;
}
function snapshot(input: unknown, result = false, code: CurveIntervalExtractionDiagnosticCode = CODE.INPUT): unknown {
  let remaining = result ? 131072 : 4096;
  const copy = (value: unknown, depth: number): unknown => {
    requireValue(--remaining >= 0 && depth <= (result ? 24 : 8), code, 'own-value/depth budget exceeded');
    if (value === null && result) return null;
    if (typeof value === 'number') {
      requireValue(Number.isFinite(value), code, 'finite own numbers required');
      return value;
    }
    if (typeof value === 'string') {
      requireValue(value.length <= (result ? 262144 : 128), code, 'own string budget exceeded');
      return value;
    }
    if (typeof value === 'boolean' && result) return value;
    requireValue(value !== null && typeof value === 'object', code, 'plain own data required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    requireValue(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      code, 'foreign own-data prototype refused');
    const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    requireValue(keys.length <= (array ? (result ? 4097 : 65) : (result ? 64 : 16)), code, 'own field budget exceeded');
    requireValue(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code,
    'getters, symbols and hidden fields refused');
    if (array) {
      const length = descriptors.length.value as number;
      requireValue(Number.isInteger(length) && length >= 0 && length <= (result ? 4096 : 64)
        && keys.length === length + 1, code, 'dense bounded own array required');
      return Array.from({ length }, (_, index) => {
        requireValue(Object.hasOwn(descriptors, String(index)), code, 'sparse or foreign array field refused');
        return copy(descriptors[String(index)].value, depth + 1);
      });
    }
    return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
  };
  return copy(input, 0);
}
function record(value: unknown, fields: string[]): Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value), CODE.INPUT, 'own record required');
  const data = value as Record<string, unknown>;
  requireValue(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    CODE.INPUT, 'exact fields required: ' + fields.join(','));
  return data;
}
function id(value: unknown): string {
  requireValue(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),
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
function native<T>(operation: () => T, detail: string, code: CurveIntervalExtractionDiagnosticCode = CODE.NATIVE): T {
  try { return operation(); } catch (cause) {
    if (cause instanceof CurveIntervalExtractionError) throw cause;
    throw new CurveIntervalExtractionError(code, detail + ': '
      + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
  }
}
function d1(curve: Curve, parameter: number): CurveIntervalExtractionD1State {
  try { return { status: 'evaluated', value: evaluateCurveD1(curve, parameter) }; } catch (cause) {
    return { status: 'native-refused', reason: (cause instanceof Error ? cause.message : 'native D1 refused').slice(0, 1024) };
  }
}
function point(curve: Curve, parameter: number): Point {
  const value = native(() => evaluateCurve(curve, parameter), 'native Curve point evaluation');
  requireValue(value.every(Number.isFinite), CODE.NATIVE, 'native Curve point must be finite');
  return value;
}
function distance(a: Point, b: Point): number {
  return finite(Math.hypot(...a.map((value, index) => finite(value - b[index], CODE.BINDING,
    'native binding subtraction overflow'))), CODE.BINDING, 'native binding norm overflow');
}
function sourceCurve(curve: Curve, name: string): { curve: Curve; source: string; model: Model } {
  const decimal = (value: number) => native(() => curveDecimal(value, 'Curve interval extraction'), 'native source decimal');
  const list = (values: number[]) => '[' + values.map(decimal).join(',') + ']';
  const source = '@model ' + name + ' { version:0; length-unit:mm; @curve #' + curve.id
    + ' { type:nurbs; degree:' + decimal(curve.degree) + '; knots:' + list(curve.knots)
    + '; control-points:[' + curve.controlPoints.map(list).join(',') + ']; weights:' + list(curve.weights) + '; } }\n';
  requireValue(source.length <= 262144, CODE.NATIVE, 'native source byte budget exceeded');
  const compiled = native(() => compileCadModel(source, { sourceVersion: 0 }), 'native source0 compilation');
  if (!compiled.ok) throw new CurveIntervalExtractionError(CODE.NATIVE, 'actual Curve source0 must compile', compiled);
  requireValue(same(compiled.model, { name, version: 0, lengthUnit: 'mm', objects: [curve] }), CODE.NATIVE,
    'actual native source must adopt complete coefficient/ID/domain/sign bits');
  return { curve: compiled.model.objects[0] as Curve, source, model: compiled.model };
}
/** Precheck both requested boundaries and retained native spans before any real split. */
function observationParameters(curve: Curve, interval: [number, number]): number[] {
  const breaks = [interval[0]];
  for (const knot of curve.knots) if (knot > interval[0] && knot < interval[1]
    && !breaks.some(value => value === knot)) breaks.push(knot);
  breaks.push(interval[1]);
  const parameters: number[] = [];
  for (let index = 0; index < breaks.length; index++) {
    parameters.push(breaks[index]);
    if (index + 1 === breaks.length) continue;
    const width = finite(breaks[index + 1] - breaks[index], CODE.REPRESENTABILITY, 'retained native span overflow');
    requireValue(width > 0, CODE.REPRESENTABILITY, 'positive retained native span required');
    for (const fraction of [.25, .5, .75]) {
      const parameter = finite(breaks[index] + width * fraction, CODE.REPRESENTABILITY, 'observation parameter overflow');
      requireValue(parameter > breaks[index] && parameter < breaks[index + 1]
        && parameter > parameters[parameters.length - 1], CODE.REPRESENTABILITY,
      'quarter/midpoint native observation parameter not represented');
      parameters.push(parameter);
    }
  }
  requireValue(parameters.length <= 128, CODE.REPRESENTABILITY, 'retained native observation budget exceeded');
  return parameters;
}

/** Original-parameter restriction using at most two actual native624 splits. */
export function extractCurveInterval(
  curveInput: Curve, inputOptions: CurveIntervalExtractionOptions,
): ExtractedCurveIntervalResult {
  const curveData = snapshot(curveInput), optionData = snapshot(inputOptions);
  const original = record(curveData, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']) as unknown as Curve;
  const data = record(optionData, ['curveId', 'interval', 'resultIdPrefix']);
  id(original.id);
  const curveId = id(data.curveId);
  requireValue(original.kind === 'curve' && Number.isInteger(original.degree)
    && original.degree >= 1 && original.degree <= 3, CODE.INPUT, 'native degree1..3 Curve required');
  requireValue(Array.isArray(original.controlPoints) && original.controlPoints.length >= 2
    && original.controlPoints.length <= 16 && original.controlPoints.every(value => Array.isArray(value)
      && value.length === 3 && value.every(component => typeof component === 'number'
        && Number.isFinite(component) && Math.abs(component) <= 10000)), CODE.INPUT,
  '2..16 original poles with authored XYZ±10000mm required');
  native(() => validateCurve(original), 'original positive open-clamped Curve admission', CODE.INPUT);
  requireValue(Array.isArray(data.interval) && data.interval.length === 2
    && data.interval.every(value => typeof value === 'number' && Number.isFinite(value)), CODE.INTERVAL,
  'finite ordered [start,end] interval required');
  requireValue(typeof data.resultIdPrefix === 'string' && data.resultIdPrefix.length <= 20
    && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.resultIdPrefix), CODE.IDENTITY, 'ASCII result prefix1..20 required');
  const options: CurveIntervalExtractionOptions = {
    curveId, interval: data.interval as [number, number], resultIdPrefix: data.resultIdPrefix,
  };
  const originalDomain = curveDomain(original);
  requireValue(Number.isFinite(originalDomain[1] - originalDomain[0])
    && originalDomain[1] > originalDomain[0], CODE.REPRESENTABILITY, 'finite positive original domain span required');
  requireValue(options.interval[0] < options.interval[1] && options.interval[0] >= originalDomain[0]
    && options.interval[1] <= originalDomain[1], CODE.INTERVAL,
  'interval must be increasing and inside the original closed domain; no sorting or clamping');
  const choices: [CurveIntervalBoundaryChoice, CurveIntervalBoundaryChoice] = [0, 1].map(index => {
    const requested = options.interval[index], endpoint = originalDomain[index];
    const adoptedOriginalEndpointBits = requested === endpoint;
    return {
      boundary: index === 0 ? 'start' : 'end', requested,
      effective: adoptedOriginalEndpointBits ? endpoint : requested,
      origin: adoptedOriginalEndpointBits ? 'original-domain-endpoint' : 'interior-request',
      adoptedOriginalEndpointBits,
    };
  }) as [CurveIntervalBoundaryChoice, CurveIntervalBoundaryChoice];
  const effectiveInterval: [number, number] = [choices[0].effective, choices[1].effective];
  const helperIds = [0, 1].flatMap(index => [
    id(options.resultIdPrefix + '_cut_' + index + '_lo'),
    id(options.resultIdPrefix + '_cut_' + index + '_hi'),
  ]);
  requireValue(new Set([original.id, curveId, ...helperIds]).size === 6, CODE.IDENTITY,
    'original/output/helper geometry identities must be distinct before staging');
  // This also applies to a full-domain copy. Refuse unsafe quarter parameters before native insertion.
  observationParameters(original, effectiveInterval);

  const operations: CurveIntervalSplitOperation[] = [];
  let retained = copyCadData(original);
  const cut = (boundary: 'start' | 'end', parameter: number): void => {
    requireValue(operations.length < 2, CODE.NATIVE_CAPACITY, 'at mosttwo actual native splits allowed');
    const multiplicity = retained.knots.filter(knot => knot === parameter).length;
    const refinedPoleCount = retained.controlPoints.length + retained.degree - multiplicity;
    requireValue(refinedPoleCount <= 16, CODE.NATIVE_CAPACITY,
      'actual staged count+degree−numeric multiplicity exceeds native temporary16-pole capacity');
    const index = operations.length;
    const result = native(() => splitCurveAtParameter(retained, {
      parameter, lowerCurveId: helperIds[2 * index], upperCurveId: helperIds[2 * index + 1],
    }), 'actual native Curve split');
    requireValue(result.refined.controlPoints.length <= 16, CODE.NATIVE_CAPACITY,
      'actual native refined Curve exceeds unchanged16-pole capacity');
    const retainedSide = boundary === 'start' ? 'upper' : 'lower';
    operations.push({ index, boundary, retainedSide, result });
    retained = copyCadData(result[retainedSide]);
  };
  if (effectiveInterval[0] > originalDomain[0]) cut('start', effectiveInterval[0]);
  if (effectiveInterval[1] < originalDomain[1]) cut('end', effectiveInterval[1]);
  retained.id = curveId;
  native(() => validateCurve(retained), 'retained native Curve admission');
  requireValue(same(curveDomain(retained), effectiveInterval), CODE.REPRESENTABILITY,
    'native restriction must retain exact effective endpoint bits without rebasing');
  const fullDomainCopy = Object.is(effectiveInterval[0], originalDomain[0])
    && Object.is(effectiveInterval[1], originalDomain[1]);
  if (fullDomainCopy) {
    requireValue(operations.length === 0 && same(retained, { ...original, id: curveId }), CODE.NATIVE,
      'full-domain extraction must copy all coefficient bits under the new ID with zero operations');
  }
  const parameters = observationParameters(retained, effectiveInterval);
  const observations: CurveIntervalExtractionObservation[] = parameters.map(parameter => {
    const originalPointMM = point(original, parameter), extractedPointMM = point(retained, parameter);
    const pointDifferenceMM = distance(originalPointMM, extractedPointMM);
    requireValue(pointDifferenceMM <= POINT_TOLERANCE, CODE.BINDING,
      'original/extracted native point observation exceeds local policy');
    const originalD1 = d1(original, parameter), extractedD1 = d1(retained, parameter);
    let derivativeDifferenceMM: number | null = null;
    if (originalD1.status === 'evaluated' && extractedD1.status === 'evaluated') {
      derivativeDifferenceMM = distance(originalD1.value.derivative, extractedD1.value.derivative);
      const scale = finite(Math.hypot(...originalD1.value.derivative), CODE.BINDING, 'native D1 magnitude overflow');
      requireValue(derivativeDifferenceMM <= D1_TOLERANCE * Math.max(1, scale), CODE.BINDING,
        'original/extracted native D1 observation exceeds local policy');
    }
    return { parameter, originalPointMM, extractedPointMM, pointDifferenceMM,
      originalD1, extractedD1, derivativeDifferenceMM };
  });
  const originalGuarded: number[] = [];
  for (const knot of original.knots) {
    if (knot > originalDomain[0] && knot < originalDomain[1] && knot >= effectiveInterval[0]
      && knot <= effectiveInterval[1] && !originalGuarded.some(value => value === knot)
      && original.knots.filter(value => value === knot).length >= original.degree) originalGuarded.push(knot);
  }
  const guards: CurveIntervalExtractionGuardObservation[] = originalGuarded.map(originalParameter => {
    const atStart = originalParameter === effectiveInterval[0], atEnd = originalParameter === effectiveInterval[1];
    const extractedParameter = atStart ? effectiveInterval[0] : atEnd ? effectiveInterval[1] : originalParameter;
    return {
      originalParameter, extractedParameter,
      outputLocation: atStart ? 'start-endpoint' : atEnd ? 'end-endpoint' : 'interior',
      originalAtOriginalKnot: d1(original, originalParameter),
      extractedAtRetainedParameter: d1(retained, extractedParameter),
    };
  });
  const originalFile = sourceCurve(original, 'curve_interval_original'), file = sourceCurve(retained, curveId);
  const provenance: CurveIntervalExtractionProvenance = {
    originalCurveId: original.id, outputCurveId: curveId, originalDomain,
    requestedInterval: options.interval, effectiveInterval,
    parameterMap: { kind: 'identity', formula: 'u=t', d1Factor: 1 },
    boundaries: choices, fullDomainCopy, operations,
  };
  const result: ExtractedCurveIntervalResult = copyCadData({
    original: originalFile.curve, options, curve: file.curve, source: file.source, sourceVersion: 0,
    model: file.model, originalSource: originalFile.source, originalModel: originalFile.model, provenance,
    report: {
      family: 'own-native-original-parameter-curve-interval',
      dto: { schema: 'barocss-native-curve-interval', version: 0, lengthUnit: 'mm',
        frame: 'authored-xyz-no-axis-conversion', representation: 'native-curve-not-wire-topology' },
      originalCurveId: original.id, curveId, degree: original.degree,
      poleCounts: { original: original.controlPoints.length, extracted: retained.controlPoints.length },
      originalDomain, domain: effectiveInterval, operationCount: operations.length, observations, guards,
      maximumPointDifferenceMM: Math.max(...observations.map(value => value.pointDifferenceMM)),
      maximumRelativeDerivativeDifference: Math.max(0, ...observations.map(value =>
        value.derivativeDifferenceMM === null || value.originalD1.status !== 'evaluated' ? 0
          : value.derivativeDifferenceMM / Math.max(1, Math.hypot(...value.originalD1.value.derivative)))),
      geometricValidity: 'not-certified', topologyCertified: false, solid: false,
      quality: { pointComparisonMM: POINT_TOLERANCE, relativeD1Comparison: D1_TOLERANCE,
        localObservationsOnly: true, globalShapeErrorCertified: false, manufacturingToleranceCertified: false,
        derivativeSemantics: 'original-c0-guards-and-extracted-endpoint-d1-distinct-no-g1-g2-claim' },
      limits: { maximumDegree: 3, maximumOriginalPoles: 16, maximumTemporaryPoles: 16,
        maximumOperations: 2, maximumObservations: 128, inputValues: 4096, inputDepth: 8,
        inputArrayElements: 64, inputRecordFields: 16, snapshotValues: 131072, snapshotDepth: 24,
        arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144, authoredIdCharacters: 48,
        resultIdPrefixCharacters: 20 },
    },
  });
  return snapshot(result, true, CODE.OWNED) as ExtractedCurveIntervalResult;
}

/** Rebuild originals/options and complete actual split/source/guard lineage, without trusting cached reports. */
export function validateExtractedCurveInterval(input: ExtractedCurveIntervalResult): ExtractedCurveIntervalReport {
  const owned = snapshot(input, true, CODE.OWNED) as ExtractedCurveIntervalResult;
  requireValue(owned !== null && typeof owned === 'object' && !Array.isArray(owned), CODE.OWNED,
    'owned extracted native Curve interval required');
  let expected: ExtractedCurveIntervalResult;
  try { expected = extractCurveInterval(owned.original, owned.options); } catch (cause) {
    throw new CurveIntervalExtractionError(CODE.OWNED, 'owned original/options rebuild refused', cause);
  }
  requireValue(same(owned, expected), CODE.OWNED,
    'owned original/source/interval/bit-choice/native split/guard/identity/report mismatch');
  return copyCadData(expected.report);
}
