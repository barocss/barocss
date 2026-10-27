import { CadNumericPolicy } from '../../numeric-policy.js';
import { validateCurve, curveDomain, evaluateCurve } from '../../core/math.js';
import { evaluateCurveD1 } from '../../core/derivatives.js';
import type { CurveD1Result } from '../../core/derivatives.js';
import { insertCurveKnotCoefficientsTrusted } from '../curves/curve-knot-insertion.js';
import type { CurveKnotUnchangedPole, CurveKnotUnchangedKnot, CurveKnotInsertionStep, CurveHomogeneousInsertionStep } from '../curves/curve-knot-insertion.js';
import { compileCadModel } from '../../model-compiler.js';
import { curveDecimal } from '../curves/curve-source.js';
import { copyCadData } from '../../data-copy.js';
import type { Curve, Model, Point } from '../../types.js';
import { same } from '../../core/structural-equality.js';
import { KernelError } from '../../core/barocss-error.js';

export const WideCurveRefinementDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', REQUEST: 'REQUEST', IDENTITY: 'IDENTITY', REPRESENTABILITY: 'REPRESENTABILITY',
  NATIVE_CAPACITY: 'NATIVE_CAPACITY', NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
} as const);
export type WideCurveRefinementDiagnosticCode = typeof WideCurveRefinementDiagnosticCode[keyof typeof WideCurveRefinementDiagnosticCode];
export class WideCurveRefinementError extends KernelError {
  readonly code: WideCurveRefinementDiagnosticCode;
  constructor(code: WideCurveRefinementDiagnosticCode, detail: string, cause?: unknown) {
    super(('Wide Curve refinement: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'WideCurveRefinementError';
    this.code = code;
  }
}
export interface WideCurveInsertionRequest { parameter: number; count: number }
export interface WideCurveRefinementOptions { curveId: string; insertions: WideCurveInsertionRequest[]; resultIdPrefix: string }
export type WideCurveRefinementD1State =
  { status: 'evaluated'; value: CurveD1Result } | { status: 'native-refused'; reason: string };
export type WideCurveHomogeneousPole = [number, number, number, number];
export interface WideCurveRefinementOperation {
  index: number; request: WideCurveInsertionRequest; prior: Curve; refined: Curve;
  source: string; sourceVersion: 0; model: Model;
  provenance: { unchangedPoles: CurveKnotUnchangedPole[]; unchangedKnots: CurveKnotUnchangedKnot[];
    steps: CurveKnotInsertionStep[]; homogeneousSteps: CurveHomogeneousInsertionStep[] };
}
export interface WideCurveRefinementProvenance {
  originalCurveId: string; outputCurveId: string; domain: [number, number];
  parameterMap: { kind: 'identity'; formula: 'u=t'; d1Factor: 1 };
  operations: WideCurveRefinementOperation[];
  originalCopiedPoles: CurveKnotUnchangedPole[]; originalCopiedKnots: CurveKnotUnchangedKnot[];
  requestedKnotSlots: { requestIndex: number; insertion: number; refinedKnotIndex: number; value: number }[];
}
export interface WideCurveRefinementObservation {
  parameter: number; originalPointMM: Point; refinedPointMM: Point; pointDifferenceMM: number;
  originalD1: WideCurveRefinementD1State; refinedD1: WideCurveRefinementD1State; derivativeDifferenceMM: number | null;
}
export interface WideCurveRefinementGuardObservation {
  parameter: number; originalMultiplicity: number; refinedMultiplicity: number;
  originalD1: WideCurveRefinementD1State; refinedD1: WideCurveRefinementD1State;
}
export interface WideCurveRefinementReport {
  family: 'own-native-wide-positive-rational-curve-refinement';
  dto: { schema: 'barocss-native-wide-curve-refinement'; version: 0; lengthUnit: 'mm'; frame: 'authored-xyz-no-axis-conversion'; representation: 'native-curve-not-wire-topology' };
  originalCurveId: string; curveId: string; degree: number; domain: [number, number]; poleCounts: { original: number; refined: number };
  knotCounts: { original: number; refined: number }; operationCount: number; insertionCount: number;
  observations: WideCurveRefinementObservation[]; guards: WideCurveRefinementGuardObservation[];
  maximumPointDifferenceMM: number; maximumRelativeDerivativeDifference: number;
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  quality: { pointComparisonMM: 1e-7; relativeD1Comparison: 1e-7; localObservationsOnly: true;
    globalShapeErrorCertified: false; manufacturingToleranceCertified: false;
    derivativeSemantics: 'actual-original-and-refined-native-guards-no-invented-original-discontinuity-or-g1-g2-claim' };
  limits: { maximumDegree: 3; maximumOriginalPoles: 31; maximumRefinedPoles: 64; maximumKnots: 70;
    maximumRequests: 16; maximumObservations: 128; inputValues: 32768; inputDepth: 8; inputArrayElements: 64;
    inputRecordFields: 16; snapshotValues: 262144; snapshotDepth: 32; arrayElements: 4096; recordFields: 64;
    sourceStringCharacters: 262144; authoredIdCharacters: 48; resultIdPrefixCharacters: 20 };
}
export interface WideCurveRefinementResult {
  original: Curve; options: WideCurveRefinementOptions; curve: Curve; source: string; sourceVersion: 0; model: Model;
  originalSource: string; originalModel: Model; provenance: WideCurveRefinementProvenance; report: WideCurveRefinementReport;
}
const POINT_TOLERANCE = CadNumericPolicy.linearTolerance;
const D1_TOLERANCE = CadNumericPolicy.relativeComparison;
const CODE = WideCurveRefinementDiagnosticCode;
function requireValue(condition: boolean, code: WideCurveRefinementDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new WideCurveRefinementError(code, detail);
}
function finite(value: number, code: WideCurveRefinementDiagnosticCode, detail: string): number {
  requireValue(Number.isFinite(value), code, detail);
  return value;
}
function snapshot(input: unknown, result = false, code: WideCurveRefinementDiagnosticCode = CODE.INPUT): unknown {
  let remaining = result ? 262144 : 32768;
  const copy = (value: unknown, depth: number): unknown => {
    requireValue(--remaining >= 0 && depth <= (result ? 32 : 8), code, 'own-value/depth budget exceeded');
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
function native<T>(operation: () => T, detail: string, code: WideCurveRefinementDiagnosticCode = CODE.NATIVE): T {
  try { return operation(); } catch (cause) {
    if (cause instanceof WideCurveRefinementError) throw cause;
    throw new WideCurveRefinementError(code, detail + ': '
      + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
  }
}


function d1(curve: Curve, parameter: number): WideCurveRefinementD1State {
  try { return { status: 'evaluated', value: evaluateCurveD1(curve, parameter) }; } catch (cause) {
    return { status: 'native-refused', reason: (cause instanceof Error ? cause.message : 'native D1 refused').slice(0, 1024) };
  }
}
function point(curve: Curve, parameter: number): Point {
  const result = native(() => evaluateCurve(curve, parameter), 'native Curve point evaluation');
  requireValue(result.every(Number.isFinite), CODE.NATIVE, 'native Curve point must be finite');
  return result;
}
function distance(a: Point, b: Point): number {
  return finite(Math.hypot(...a.map((value, index) => finite(value - b[index], CODE.BINDING,
    'native binding subtraction overflow'))), CODE.BINDING, 'native binding norm overflow');
}
function sourceCurve(curve: Curve, name: string): { curve: Curve; source: string; model: Model } {
  const decimal = (value: number) => native(() => curveDecimal(value, 'Wide Curve refinement'), 'native source decimal');
  const list = (values: number[]) => '[' + values.map(decimal).join(',') + ']';
  const source = '@model ' + name + ' { version:0; length-unit:mm; @curve #' + curve.id
    + ' { type:nurbs; degree:' + decimal(curve.degree) + '; knots:' + list(curve.knots)
    + '; control-points:[' + curve.controlPoints.map(list).join(',') + ']; weights:' + list(curve.weights) + '; } }\n';
  requireValue(source.length <= 262144, CODE.NATIVE, 'native source byte budget exceeded');
  const compiled = native(() => compileCadModel(source, { sourceVersion: 0 }), 'native source0 compilation');
  if (!compiled.ok) throw new WideCurveRefinementError(CODE.NATIVE, 'actual original/stage/final Curve source0 must compile', compiled);
  requireValue(same(compiled.model, { name, version: 0, lengthUnit: 'mm', objects: [curve] }), CODE.NATIVE,
    'native source must adopt full coefficient/ID/domain/sign bits');
  return { curve: compiled.model.objects[0] as Curve, source, model: compiled.model };
}
/** Original endpoints and distinct native knots, plus one strictly represented midpoint per span. */
function observationParameters(knots: number[], domain: [number, number]): number[] {
  const breaks = [domain[0]];
  for (const knot of knots) if (knot > domain[0] && knot < domain[1]
    && !breaks.some(value => value === knot)) breaks.push(knot);
  breaks.push(domain[1]);
  const parameters: number[] = [];
  for (let index = 0; index < breaks.length; index++) {
    parameters.push(breaks[index]);
    if (index + 1 === breaks.length) continue;
    const width = finite(breaks[index + 1] - breaks[index], CODE.REPRESENTABILITY, 'native observation span overflow');
    requireValue(width > 0, CODE.REPRESENTABILITY, 'positive native observation span required');
    const midpoint = finite(breaks[index] + width / 2, CODE.REPRESENTABILITY, 'native midpoint overflow');
    requireValue(midpoint > breaks[index] && midpoint < breaks[index + 1], CODE.REPRESENTABILITY,
      'native span midpoint is not strictly represented');
    parameters.push(midpoint);
  }
  requireValue(parameters.length <= 128, CODE.REPRESENTABILITY, 'native knot/midpoint observation capacity exceeded');
  return parameters;
}

/** Bounded wider admission over the SAME trusted homogeneous coefficient calculation as the old16 API. */
export function refineCurveWide(curveInput: Curve, inputOptions: WideCurveRefinementOptions): WideCurveRefinementResult {
  const curveData = snapshot(curveInput), optionData = snapshot(inputOptions);
  const original = record(curveData, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']) as unknown as Curve;
  const data = record(optionData, ['curveId', 'insertions', 'resultIdPrefix']);
  id(original.id);
  const curveId = id(data.curveId);
  requireValue(original.kind === 'curve' && Number.isInteger(original.degree) && original.degree >= 1
    && original.degree <= 3, CODE.INPUT, 'native degree1..3 Curve required');
  requireValue(Array.isArray(original.controlPoints) && original.controlPoints.length >= 2
    && original.controlPoints.length <= 31 && original.controlPoints.every(point => Array.isArray(point)
      && point.length === 3 && point.every(value => typeof value === 'number'
        && Number.isFinite(value) && Math.abs(value) <= 10000)), CODE.INPUT,
  '2..31 original poles with authored XYZ±10000mm required');
  native(() => validateCurve(original), 'original positive open-clamped Curve admission', CODE.INPUT);
  const domain = curveDomain(original);
  requireValue(Number.isFinite(domain[1] - domain[0]) && domain[1] > domain[0], CODE.REPRESENTABILITY,
    'finite positive original parameter span required');
  requireValue(Array.isArray(data.insertions) && data.insertions.length >= 1 && data.insertions.length <= 16,
    CODE.REQUEST, '1..16 ordered distinct insertion requests required');
  const insertions = data.insertions.map(value => {
    const request = record(value, ['parameter', 'count']);
    requireValue(typeof request.parameter === 'number' && Number.isFinite(request.parameter)
      && request.parameter > domain[0] && request.parameter < domain[1], CODE.REQUEST,
    'finite strictly original-domain interior parameter required');
    requireValue(typeof request.count === 'number' && Number.isInteger(request.count)
      && request.count >= 1 && request.count <= original.degree, CODE.REQUEST,
    'explicit integer insertion count1..degree required');
    return { parameter: request.parameter, count: request.count };
  });
  let insertionCount = 0;
  for (let index = 0; index < insertions.length; index++) {
    const request = insertions[index];
    requireValue(index === 0 || request.parameter > insertions[index - 1].parameter, CODE.REQUEST,
      'requests must be strictly increasing/distinct; no sorting or snapping');
    requireValue(original.knots.filter(knot => knot === request.parameter).length + request.count <= original.degree,
      CODE.REQUEST, 'requested final numeric multiplicity must not exceed native degree');
    insertionCount += request.count;
  }
  requireValue(original.controlPoints.length + insertionCount <= 64 && original.knots.length + insertionCount <= 70,
    CODE.NATIVE_CAPACITY, 'precomputed final/temporary native capacity exceeds64 poles or70 knots');
  requireValue(typeof data.resultIdPrefix === 'string' && data.resultIdPrefix.length <= 20
    && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.resultIdPrefix), CODE.IDENTITY, 'ASCII result prefix1..20 required');
  const options: WideCurveRefinementOptions = { curveId, insertions, resultIdPrefix: data.resultIdPrefix };
  const stepIds = Array.from({ length: 16 }, (_, index) => id(options.resultIdPrefix + '_step_' + index));
  requireValue(new Set([original.id, curveId, ...stepIds]).size === 18, CODE.IDENTITY,
    'original/output/sixteen stage geometry roles must be distinct before staging');
  // Plan only native knot slots, not coefficients. Actual geometry comes solely from the shared calculation.
  const plannedKnots = copyCadData(original.knots);
  for (const request of insertions) {
    let position = -1;
    for (let index = 0; index < plannedKnots.length; index++) if (plannedKnots[index] <= request.parameter) position = index;
    plannedKnots.splice(position + 1, 0, ...Array.from({ length: request.count }, () => request.parameter));
  }
  observationParameters(plannedKnots, domain);

  const operations: WideCurveRefinementOperation[] = [];
  let prior = copyCadData(original);
  let poleLineage: (number | null)[] = original.controlPoints.map((_, index) => index);
  let knotLineage: { originalIndex: number | null; requestIndex: number | null; insertion: number | null }[] =
    original.knots.map((_, index) => ({ originalIndex: index, requestIndex: null, insertion: null }));
  for (const [index, request] of insertions.entries()) {
    requireValue(prior.controlPoints.length + request.count <= 64 && prior.knots.length + request.count <= 70,
      CODE.NATIVE_CAPACITY, 'actual temporary stage exceeds unchanged64/70 native capacity');
    for (let pole = 0; pole < prior.controlPoints.length; pole++) for (const coordinate of prior.controlPoints[pole]) {
      const homogeneous = finite(coordinate * prior.weights[pole], CODE.REPRESENTABILITY, 'native homogeneous lift overflow');
      requireValue(coordinate === 0 || homogeneous !== 0, CODE.REPRESENTABILITY,
        'nonzero stage homogeneous lift underflowed; no coefficient repair');
    }
    const core = native(() => insertCurveKnotCoefficientsTrusted(prior, request.parameter, request.count),
      'shared native homogeneous coefficient insertion');
    const candidate = copyCadData(core.candidate);
    candidate.id = stepIds[index];
    native(() => validateCurve(candidate), 'actual wide stage native admission');
    requireValue(candidate.controlPoints.length <= 64 && candidate.knots.length <= 70
      && same(curveDomain(candidate), domain), CODE.NATIVE_CAPACITY,
    'actual wide native capacity/domain changed');
    const file = sourceCurve(candidate, stepIds[index]);
    const nextPoleLineage: (number | null)[] = Array.from({ length: candidate.controlPoints.length }, () => null);
    for (const mapping of core.unchangedPoles) {
      requireValue(same(prior.controlPoints[mapping.originalPoleIndex], file.curve.controlPoints[mapping.refinedPoleIndex])
        && Object.is(prior.weights[mapping.originalPoleIndex], file.curve.weights[mapping.refinedPoleIndex]), CODE.NATIVE,
      'actual copied stage pole/weight bits changed');
      nextPoleLineage[mapping.refinedPoleIndex] = poleLineage[mapping.originalPoleIndex];
    }
    const nextKnotLineage: typeof knotLineage = Array.from({ length: candidate.knots.length },
      () => ({ originalIndex: null, requestIndex: null, insertion: null }));
    const copiedSlots = new Set<number>();
    for (const mapping of core.unchangedKnots) {
      requireValue(Object.is(prior.knots[mapping.originalKnotIndex], file.curve.knots[mapping.refinedKnotIndex]), CODE.NATIVE,
        'actual copied stage knot bits changed');
      nextKnotLineage[mapping.refinedKnotIndex] = copyCadData(knotLineage[mapping.originalKnotIndex]);
      copiedSlots.add(mapping.refinedKnotIndex);
    }
    let added = 0;
    for (let slot = 0; slot < candidate.knots.length; slot++) if (!copiedSlots.has(slot)) {
      requireValue(Object.is(file.curve.knots[slot], request.parameter), CODE.NATIVE, 'actual requested knot bits changed');
      nextKnotLineage[slot] = { originalIndex: null, requestIndex: index, insertion: ++added };
    }
    requireValue(added === request.count, CODE.NATIVE, 'actual requested knot insertion count changed');
    operations.push({ index, request, prior, refined: file.curve, source: file.source, sourceVersion: 0, model: file.model,
      provenance: { unchangedPoles: core.unchangedPoles, unchangedKnots: core.unchangedKnots,
        steps: core.steps, homogeneousSteps: core.homogeneousSteps } });
    poleLineage = nextPoleLineage;
    knotLineage = nextKnotLineage;
    prior = file.curve;
  }
  const curve = copyCadData(prior);
  curve.id = curveId;
  const originalCopiedPoles: CurveKnotUnchangedPole[] = poleLineage.flatMap((originalPoleIndex, refinedPoleIndex) =>
    originalPoleIndex === null ? [] : [{ originalPoleIndex, refinedPoleIndex }]);
  const originalCopiedKnots: CurveKnotUnchangedKnot[] = knotLineage.flatMap((entry, refinedKnotIndex) =>
    entry.originalIndex === null ? [] : [{ originalKnotIndex: entry.originalIndex, refinedKnotIndex }]);
  requireValue(originalCopiedKnots.length === original.knots.length, CODE.NATIVE,
    'every original knot slot must survive the actual staged chain');
  for (const mapping of originalCopiedPoles) requireValue(
    same(original.controlPoints[mapping.originalPoleIndex], curve.controlPoints[mapping.refinedPoleIndex])
      && Object.is(original.weights[mapping.originalPoleIndex], curve.weights[mapping.refinedPoleIndex]), CODE.NATIVE,
  'original copied pole/weight lineage lost bit identity');
  for (const mapping of originalCopiedKnots) requireValue(
    Object.is(original.knots[mapping.originalKnotIndex], curve.knots[mapping.refinedKnotIndex]), CODE.NATIVE,
  'original copied knot lineage lost bit identity');
  const requestedKnotSlots = knotLineage.flatMap((entry, refinedKnotIndex) => entry.requestIndex === null
    || entry.insertion === null ? [] : [{ requestIndex: entry.requestIndex, insertion: entry.insertion,
      refinedKnotIndex, value: curve.knots[refinedKnotIndex] }]);
  const parameters = observationParameters(curve.knots, domain);
  const observations: WideCurveRefinementObservation[] = parameters.map(parameter => {
    const originalPointMM = point(original, parameter), refinedPointMM = point(curve, parameter);
    const pointDifferenceMM = distance(originalPointMM, refinedPointMM);
    requireValue(pointDifferenceMM <= POINT_TOLERANCE, CODE.BINDING, 'actual original/refined point observation exceeds local policy');
    const originalD1 = d1(original, parameter), refinedD1 = d1(curve, parameter);
    let derivativeDifferenceMM: number | null = null;
    if (originalD1.status === 'evaluated' && refinedD1.status === 'evaluated') {
      derivativeDifferenceMM = distance(originalD1.value.derivative, refinedD1.value.derivative);
      const scale = finite(Math.hypot(...originalD1.value.derivative), CODE.BINDING, 'native derivative magnitude overflow');
      requireValue(derivativeDifferenceMM <= D1_TOLERANCE * Math.max(1, scale), CODE.BINDING,
        'actual original/refined native D1 observation exceeds local policy');
    }
    return { parameter, originalPointMM, refinedPointMM, pointDifferenceMM, originalD1, refinedD1, derivativeDifferenceMM };
  });
  const guards: WideCurveRefinementGuardObservation[] = parameters.filter(parameter => parameter > domain[0]
    && parameter < domain[1] && (original.knots.filter(knot => knot === parameter).length >= original.degree
      || curve.knots.filter(knot => knot === parameter).length >= curve.degree)).map(parameter => ({
    parameter, originalMultiplicity: original.knots.filter(knot => knot === parameter).length,
    refinedMultiplicity: curve.knots.filter(knot => knot === parameter).length,
    originalD1: d1(original, parameter), refinedD1: d1(curve, parameter),
  }));
  const originalFile = sourceCurve(original, 'curve_wide_original'), file = sourceCurve(curve, curveId);
  const provenance: WideCurveRefinementProvenance = { originalCurveId: original.id, outputCurveId: curveId, domain,
    parameterMap: { kind: 'identity', formula: 'u=t', d1Factor: 1 }, operations,
    originalCopiedPoles, originalCopiedKnots, requestedKnotSlots };
  const result: WideCurveRefinementResult = copyCadData({ original: originalFile.curve, options, curve: file.curve,
    source: file.source, sourceVersion: 0, model: file.model, originalSource: originalFile.source,
    originalModel: originalFile.model, provenance, report: {
      family: 'own-native-wide-positive-rational-curve-refinement',
      dto: { schema: 'barocss-native-wide-curve-refinement', version: 0, lengthUnit: 'mm',
        frame: 'authored-xyz-no-axis-conversion', representation: 'native-curve-not-wire-topology' },
      originalCurveId: original.id, curveId, degree: original.degree, domain,
      poleCounts: { original: original.controlPoints.length, refined: curve.controlPoints.length },
      knotCounts: { original: original.knots.length, refined: curve.knots.length },
      operationCount: operations.length, insertionCount, observations, guards,
      maximumPointDifferenceMM: Math.max(...observations.map(value => value.pointDifferenceMM)),
      maximumRelativeDerivativeDifference: Math.max(0, ...observations.map(value => value.derivativeDifferenceMM === null
        || value.originalD1.status !== 'evaluated' ? 0 : value.derivativeDifferenceMM
          / Math.max(1, Math.hypot(...value.originalD1.value.derivative)))),
      geometricValidity: 'not-certified', topologyCertified: false, solid: false,
      quality: { pointComparisonMM: POINT_TOLERANCE, relativeD1Comparison: D1_TOLERANCE,
        localObservationsOnly: true, globalShapeErrorCertified: false, manufacturingToleranceCertified: false,
        derivativeSemantics: 'actual-original-and-refined-native-guards-no-invented-original-discontinuity-or-g1-g2-claim' },
      limits: { maximumDegree: 3, maximumOriginalPoles: 31, maximumRefinedPoles: 64, maximumKnots: 70,
        maximumRequests: 16, maximumObservations: 128, inputValues: 32768, inputDepth: 8,
        inputArrayElements: 64, inputRecordFields: 16, snapshotValues: 262144, snapshotDepth: 32,
        arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144, authoredIdCharacters: 48,
        resultIdPrefixCharacters: 20 },
    } });
  return snapshot(result, true, CODE.OWNED) as WideCurveRefinementResult;
}

/** Rebuild original/options, shared coefficient stages, copied slots and complete source/guard metadata. */
export function validateWideCurveRefinement(input: WideCurveRefinementResult): WideCurveRefinementReport {
  const owned = snapshot(input, true, CODE.OWNED) as WideCurveRefinementResult;
  requireValue(owned !== null && typeof owned === 'object' && !Array.isArray(owned), CODE.OWNED,
    'owned wide native Curve refinement required');
  let expected: WideCurveRefinementResult;
  try { expected = refineCurveWide(owned.original, owned.options); } catch (cause) {
    throw new WideCurveRefinementError(CODE.OWNED, 'owned original/options rebuild refused', cause);
  }
  requireValue(same(owned, expected), CODE.OWNED,
    'owned original/staged homogeneous/source/copied-slot/requested-knot/point/D1/report mismatch');
  return copyCadData(expected.report);
}
