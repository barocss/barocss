import { validateCurve, validateSurface, curveDomain } from '../../core/math.js';
import { extractCurveBezierSpans, CurveBezierSpanExtractionError } from '../curves/curve-bezier-spans.js';
import type { CurveBezierSpanExtractionResult } from '../curves/curve-bezier-spans.js';
import { intersectCubicBezierCurveWithAffinePlaneSurface, CubicCurveAffinePlaneIntersectionError } from '../../intersect/own-cubic-curve-plane-intersection.js';
import type { CubicCurveAffinePlaneIntersectionResult } from '../../intersect/own-cubic-curve-plane-intersection.js';
import { assembleCurvePlaneEventsTrusted } from '../../intersect/own-multispan-curve-plane.js';
import type { CurvePlanePointEvent, CurveAffinePlaneIntersectionReport, CurveAffinePlaneIntersectionResult } from '../../intersect/own-multispan-curve-plane.js';
import type { CurveAffinePlaneAxes } from '../../intersect/own-curve-plane-intersection.js';
import { adopt } from '../../intersect/own-plane-cylinder-intersection-internal.js';
import { copyCadData } from '../../data-copy.js';
import type { Curve, Surface, Model } from '../../types.js';
import { same } from '../../core/structural-equality.js';
import { KernelError } from '../../core/barocss-error.js';

export const WideCubicCurveAffinePlaneIntersectionDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', SPAN: 'SPAN', REPRESENTABILITY: 'REPRESENTABILITY',
  BUDGET: 'BUDGET', NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
} as const);
export type WideCubicCurveAffinePlaneIntersectionDiagnosticCode =
  typeof WideCubicCurveAffinePlaneIntersectionDiagnosticCode[keyof typeof WideCubicCurveAffinePlaneIntersectionDiagnosticCode];
export class WideCubicCurveAffinePlaneIntersectionError extends KernelError {
  readonly code: WideCubicCurveAffinePlaneIntersectionDiagnosticCode;
  constructor(code: WideCubicCurveAffinePlaneIntersectionDiagnosticCode, detail: string, cause?: unknown) {
    super(('Wide cubic Curve-plane intersection: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'WideCubicCurveAffinePlaneIntersectionError'; this.code = code;
  }
}
export interface WideCubicCurveAffinePlaneIntersectionOptions {
  evaluationId: string; resultIdPrefix: string; pointEventIds: string[];
}
export interface WideCubicCurveAffinePlaneSpan {
  spanId: string; spanIndex: number; domain: [number, number]; curve: Curve;
  intersection: CubicCurveAffinePlaneIntersectionResult; source: string; sourceVersion: 0; model: Model;
}
export interface WideCubicCurveAffinePlaneIntersectionReport {
  family: 'own-wide-cubic-curve-affine-plane-surface';
  dto: { schema: 'barocss-native-wide-cubic-curve-plane-intersection'; version: 0; lengthUnit: 'mm';
    frame: 'raw-authored-xyz-no-axis-conversion'; representation: 'original-wide-cubic-curve-plane-events-not-sewn-topology' };
  kind: WideCubicCurveAffinePlaneIntersectionResult['kind']; evaluationId: string; curveId: string; planeId: string;
  curveDomain: [number, number]; curveDegree: 3; planeAxes: CurveAffinePlaneAxes;
  spanCount: number; primitiveCallCount: number; cubicScalarEvaluationCount: number;
  contributionCount: number; supportEventCount: number; finiteEventCount: number; outsideEventCount: number;
  derivativeSearchCounts: { executed: number; notRequiredCoincident: number; notRequiredStrictCubicSignExclusion: number };
  strictSignExcludedSpanIds: string[]; coincidentSpans: CurveAffinePlaneIntersectionReport['coincidentSpans'];
  supportDisjointSpanIds: string[]; originalGuardedParameters: number[]; privateIdAllocationAttempts: number;
  authority: 'original-complete-cubic-curve-coefficients'; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  inputProfile: { curveDegree: 3; poleRange: [4, 64]; maximumKnots: 70; maximumNonzeroSpans: 64;
    weightRange: [1e-6, 1e6]; coordinateAbsMM: 10000; clamped: true; nonperiodic: true;
    planeDegree: [1, 1]; planeControlGrid: [2, 2]; planeEqualWeights: true; planeAffine: true };
  numericPolicy: CurveAffinePlaneIntersectionReport['numericPolicy'];
  quality: { extraction: 'actual-public-native-bezier-span-extraction'; primitive: 'actual-public-cubic-bezier-curve-plane-intersection';
    assembly: 'shared-whole-original-curve-event-uv-bracket-assembly'; localUncertainty: 'atomic-refusal';
    derivativeSearchEvidence: 'per-span-executed-or-explicitly-not-required'; globalBinary64ErrorCertified: false;
    manufacturingToleranceCertified: false; coincidenceClippingCertified: false;
    ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-no-partial-result';
  limits: { maximumOriginalPoles: 64; maximumOriginalKnots: 70; maximumSpans: 64; maximumLocalBezierPoles: 4;
    maximumContributions: 192; maximumEvents: 192; maximumPrimitiveCalls: 64; maximumScalarEvaluations: 65536;
    maximumEventsPerPrimitive: 3; maximumDerivativeRootsPerPrimitive: 2; maximumRootSteps: 64;
    maximumScalarEvaluationsPerPrimitive: 1024; maximumPrivateIdAllocationAttempts: 1024; privateRolesPerSpan: 4;
    reservedExtractionRoleIds: 65; inputValues: 32768; inputDepth: 8; inputArrayElements: 256;
    inputRecordFields: 16; inputStringCharacters: 128; snapshotValues: 4194304; snapshotDepth: 48;
    arrayElements: 4096; recordFields: 64; sourceStringCharacters: 262144; authoredIdCharacters: 48; resultIdPrefixCharacters: 20 };
}
export interface WideCubicCurveAffinePlaneIntersectionResult {
  kind: CurveAffinePlaneIntersectionResult['kind']; curve: Curve; plane: Surface;
  options: WideCubicCurveAffinePlaneIntersectionOptions; source: string; sourceVersion: 0; model: Model;
  extraction: CurveBezierSpanExtractionResult; spans: WideCubicCurveAffinePlaneSpan[]; events: CurvePlanePointEvent[];
  report: WideCubicCurveAffinePlaneIntersectionReport;
}

const CODE = WideCubicCurveAffinePlaneIntersectionDiagnosticCode;
function check(condition: boolean, code: WideCubicCurveAffinePlaneIntersectionDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new WideCubicCurveAffinePlaneIntersectionError(code, detail);
}
function native<T>(action: () => T, detail: string, code: WideCubicCurveAffinePlaneIntersectionDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof WideCubicCurveAffinePlaneIntersectionError) throw cause;
    const actualCode = cause instanceof CurveBezierSpanExtractionError || cause instanceof CubicCurveAffinePlaneIntersectionError ? cause.code : code;
    throw new WideCubicCurveAffinePlaneIntersectionError(actualCode, detail + ': '
      + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
  }
}
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT;
  let remaining = owned ? 4194304 : 32768;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= (owned ? 48 : 8), code, 'own-value/depth budget exceeded');
    if (value === null && owned) return null;
    if (typeof value === 'boolean' && owned) return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'finite own numbers required'); return value; }
    if (typeof value === 'string') { check(value.length <= (owned ? 262144 : 128), code, 'own string budget exceeded'); return value; }
    check(value !== null && typeof value === 'object', code, 'plain own data required');
    check(!ancestors.has(value), code, 'cyclic own data refused');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      code, 'foreign own-data prototype refused');
    const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.length <= (array ? (owned ? 4097 : 257) : (owned ? 64 : 16)), code, 'own field budget exceeded');
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden own data refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= (owned ? 4096 : 256)
        && keys.length === length + 1, code, 'dense bounded own arrays required');
      result = Array.from({ length }, (_, index) => {
        check(Object.hasOwn(descriptors, String(index)), code, 'sparse/extra own array field refused');
        return copy(descriptors[String(index)].value, depth + 1);
      });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  };
  return native(() => copy(input, 0), 'own data snapshot', code);
}
function record(value: unknown, fields: string[], code: WideCubicCurveAffinePlaneIntersectionDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'own record required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    code, 'exact fields required: ' + fields.join(','));
  return data;
}
function id(value: unknown): string {
  check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),
    CODE.IDENTITY, 'ASCII ID1..48 required');
  return value;
}

/** Compose actual analytic cubic spans and actual cubic primitives with whole-original event binding. */
export function intersectCubicCurveWideWithAffinePlaneSurface(curveInput: Curve, planeInput: Surface,
  optionInput: WideCubicCurveAffinePlaneIntersectionOptions): WideCubicCurveAffinePlaneIntersectionResult {
  const c = record(snapshot(curveInput), ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']) as unknown as Curve;
  const p = record(snapshot(planeInput), ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']) as unknown as Surface;
  const o = record(snapshot(optionInput), ['evaluationId', 'resultIdPrefix', 'pointEventIds']);
  id(c.id); id(p.id);
  check(c.kind === 'curve' && c.degree === 3, CODE.INPUT, 'original positive degree3 Curve required');
  native(() => validateCurve(c), 'original positive open-clamped native cubic Curve admission', CODE.INPUT);
  check(c.controlPoints.length >= 4 && c.controlPoints.length <= 64 && c.knots.length <= 70
    && c.controlPoints.every(point => point.every(value => Math.abs(value) <= 10000)), CODE.INPUT,
  'original cubic must retain4..64 poles/70 knots/authored XYZ±10000mm');
  check(p.kind === 'surface' && p.degreeU === 1 && p.degreeV === 1, CODE.INPUT, 'original degree1x1 affine Plane required');
  native(() => validateSurface(p), 'original positive native Plane admission', CODE.INPUT);
  check(p.controlPoints.length === 2 && p.controlPoints.every(row => row.length === 2 && row.every(point => point.every(value => Math.abs(value) <= 10000)))
    && p.weights.every(row => row.every(weight => Object.is(weight, p.weights[0][0]))), CODE.INPUT,
  'original four-pole equal-weight Plane XYZ±10000mm required');
  check(typeof o.resultIdPrefix === 'string' && o.resultIdPrefix.length <= 20 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(o.resultIdPrefix),
    CODE.IDENTITY, 'ASCII result prefix1..20 required');
  check(Array.isArray(o.pointEventIds) && o.pointEventIds.length >= 1 && o.pointEventIds.length <= 192,
    CODE.BUDGET, '1..192 explicit original event slots required');
  const options: WideCubicCurveAffinePlaneIntersectionOptions = {
    evaluationId: id(o.evaluationId), resultIdPrefix: o.resultIdPrefix, pointEventIds: o.pointEventIds.map(value => id(value)),
  };
  const domain = curveDomain(c);
  let spanCount = 0;
  for (let k = c.degree; k < c.controlPoints.length; k++) if (c.knots[k] < c.knots[k + 1]) {
    check(Number.isFinite(c.knots[k + 1] - c.knots[k]), CODE.REPRESENTABILITY, 'original span width overflow'); spanCount++;
  }
  check(spanCount >= 1 && spanCount <= 64, CODE.SPAN, '1..64 original nonzero cubic spans required');
  const extractionRoles = [id(options.resultIdPrefix + '_model'),
    ...Array.from({ length: 64 }, (_, index) => id(options.resultIdPrefix + '_span_' + index))];
  const roles = [c.id, p.id, options.evaluationId, ...options.pointEventIds, ...extractionRoles], reserved = new Set(roles);
  check(reserved.size === roles.length, CODE.IDENTITY, 'original/context/caller event/all65 extraction roles must be distinct');
  let privateIdAllocationAttempts = 0;
  const privateId = (): string => {
    for (;;) {
      check(++privateIdAllocationAttempts <= 1024, CODE.BUDGET, 'private identity allocation attempt budget exhausted');
      const candidate = '__wide_cubic_plane_tmp_' + privateIdAllocationAttempts;
      if (reserved.has(candidate)) continue;
      reserved.add(candidate); return candidate;
    }
  };
  const privateOptions = Array.from({ length: spanCount }, () => ({ evaluationId: privateId(), pointEventIds: [privateId(), privateId(), privateId()] }));
  const original: Model = { name: options.evaluationId, version: 0, lengthUnit: 'mm', objects: [c, p] };
  const file = native(() => adopt(original), 'actual original wide cubic Curve/Plane source0 adoption');
  check(file.source.length <= 262144, CODE.BUDGET, 'original compound source0 string budget exceeded');
  check(same(file.model, original), CODE.BINDING, 'original source0 geometry/IDs/order/domain/coefficient/sign bits changed');
  const curve = file.model.objects[0] as Curve, plane = file.model.objects[1] as Surface;
  const extraction = native(() => extractCurveBezierSpans(curve, { resultIdPrefix: options.resultIdPrefix }), 'actual public native cubic span extraction');
  check(extraction.spans.length === spanCount && same(extraction.curve, curve), CODE.BINDING, 'actual extraction changed original cubic or span count');
  let primitiveCallCount = 0, cubicScalarEvaluationCount = 0;
  const derivativeSearchCounts = { executed: 0, notRequiredCoincident: 0, notRequiredStrictCubicSignExclusion: 0 };
  const spans: WideCubicCurveAffinePlaneSpan[] = extraction.spans.map((span, index) => {
    check(++primitiveCallCount <= 64 && span.bezier.degree === 3 && span.bezier.controlPoints.length === 4,
      CODE.BUDGET, 'actual local cubic primitive/pole capacity exceeded');
    const intersection = native(() => intersectCubicBezierCurveWithAffinePlaneSurface(span.bezier, plane, privateOptions[index]),
      'actual public cubic Bezier/Plane primitive');
    check(intersection.events.length <= 3 && same(intersection.curve, span.bezier) && same(intersection.plane, plane),
      CODE.BINDING, 'actual cubic primitive changed geometry or exceeded root capacity');
    const evidence = intersection.report.rootEvidence;
    cubicScalarEvaluationCount += evidence.scalarEvaluationCount;
    check(evidence.scalarEvaluationCount <= 1024 && cubicScalarEvaluationCount <= 65536, CODE.BUDGET, 'actual cubic scalar evaluation budget exceeded');
    if (evidence.derivativeSearchStatus === 'executed') derivativeSearchCounts.executed++;
    else if (evidence.derivativeSearchStatus === 'not-required-coincident') derivativeSearchCounts.notRequiredCoincident++;
    else derivativeSearchCounts.notRequiredStrictCubicSignExclusion++;
    return { spanId: span.bezier.id, spanIndex: span.index, domain: span.domain, curve: intersection.curve,
      intersection, source: intersection.source, sourceVersion: 0, model: intersection.model };
  });
  const parameters = spans.flatMap(span => span.intersection.events.map(event => event.parameter)), uniqueParameterCount = new Set(parameters).size;
  check(parameters.length <= 192 && uniqueParameterCount <= 192 && uniqueParameterCount <= options.pointEventIds.length,
    CODE.BUDGET, 'actual isolated contribution/consolidated caller event capacity exhausted');
  const assembled = native(() => assembleCurvePlaneEventsTrusted(curve, plane, spans, options.pointEventIds, 192, 192),
    'exact shared whole-original cubic event/UV/bracket assembly', CODE.REPRESENTABILITY);
  const report: WideCubicCurveAffinePlaneIntersectionReport = {
    family: 'own-wide-cubic-curve-affine-plane-surface',
    dto: { schema: 'barocss-native-wide-cubic-curve-plane-intersection', version: 0, lengthUnit: 'mm',
      frame: 'raw-authored-xyz-no-axis-conversion', representation: 'original-wide-cubic-curve-plane-events-not-sewn-topology' },
    kind: assembled.kind, evaluationId: options.evaluationId, curveId: curve.id, planeId: plane.id,
    curveDomain: domain, curveDegree: 3, planeAxes: assembled.axes, spanCount, primitiveCallCount, cubicScalarEvaluationCount,
    contributionCount: assembled.contributionCount, supportEventCount: assembled.events.length,
    finiteEventCount: assembled.finiteCount, outsideEventCount: assembled.events.length - assembled.finiteCount, derivativeSearchCounts,
    strictSignExcludedSpanIds: spans.filter(span => span.intersection.report.rootEvidence.controlHullExclusion !== null).map(span => span.spanId),
    coincidentSpans: assembled.coincidentSpans,
    supportDisjointSpanIds: spans.filter(span => span.intersection.kind === 'support-disjoint').map(span => span.spanId),
    originalGuardedParameters: assembled.originalGuardedParameters, privateIdAllocationAttempts,
    authority: 'original-complete-cubic-curve-coefficients', geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    inputProfile: { curveDegree: 3, poleRange: [4, 64], maximumKnots: 70, maximumNonzeroSpans: 64,
      weightRange: [1e-6, 1e6], coordinateAbsMM: 10000, clamped: true, nonperiodic: true,
      planeDegree: [1, 1], planeControlGrid: [2, 2], planeEqualWeights: true, planeAffine: true },
    numericPolicy: { parameterWidthTarget: 1e-12, maximumRootSteps: 64, pointBindingComparisonMM: 1e-7, exactParameterDedupOnly: true,
      sideSampling: 'represented-midpoint-between-event-and-nearest-span-root-or-boundary',
      uvBoundaryPolicy: 'original-estimate-and-bracket-domain-agreement-no-clamp' },
    quality: { extraction: 'actual-public-native-bezier-span-extraction', primitive: 'actual-public-cubic-bezier-curve-plane-intersection',
      assembly: 'shared-whole-original-curve-event-uv-bracket-assembly', localUncertainty: 'atomic-refusal',
      derivativeSearchEvidence: 'per-span-executed-or-explicitly-not-required', globalBinary64ErrorCertified: false,
      manufacturingToleranceCertified: false, coincidenceClippingCertified: false, ownership: 'copied-cpu-data-gc-no-renderer-resources' },
    budgetFailure: 'atomic-refusal-no-partial-result',
    limits: { maximumOriginalPoles: 64, maximumOriginalKnots: 70, maximumSpans: 64, maximumLocalBezierPoles: 4,
      maximumContributions: 192, maximumEvents: 192, maximumPrimitiveCalls: 64, maximumScalarEvaluations: 65536,
      maximumEventsPerPrimitive: 3, maximumDerivativeRootsPerPrimitive: 2, maximumRootSteps: 64,
      maximumScalarEvaluationsPerPrimitive: 1024, maximumPrivateIdAllocationAttempts: 1024, privateRolesPerSpan: 4,
      reservedExtractionRoleIds: 65, inputValues: 32768, inputDepth: 8, inputArrayElements: 256,
      inputRecordFields: 16, inputStringCharacters: 128, snapshotValues: 4194304, snapshotDepth: 48,
      arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144, authoredIdCharacters: 48, resultIdPrefixCharacters: 20 },
  };
  return snapshot({ kind: assembled.kind, curve, plane, options, source: file.source, sourceVersion: 0, model: file.model,
    extraction, spans, events: assembled.events, report }, true) as WideCubicCurveAffinePlaneIntersectionResult;
}
/** Rebuild original geometry, actual analytic/cubic spans and all whole-original event and work evidence. */
export function validateWideCubicCurveAffinePlaneIntersection(input: WideCubicCurveAffinePlaneIntersectionResult): WideCubicCurveAffinePlaneIntersectionReport {
  const owned = snapshot(input, true) as WideCubicCurveAffinePlaneIntersectionResult;
  record(owned, ['kind', 'curve', 'plane', 'options', 'source', 'sourceVersion', 'model', 'extraction', 'spans', 'events', 'report'], CODE.OWNED);
  let expected: WideCubicCurveAffinePlaneIntersectionResult;
  try { expected = intersectCubicCurveWideWithAffinePlaneSurface(owned.curve, owned.plane, owned.options); } catch (cause) {
    throw new WideCubicCurveAffinePlaneIntersectionError(CODE.OWNED, 'owned original cubic/options full composition rebuild refused', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'owned original/source/analytic spans/cubic scalar evidence/contributions/UV/brackets/IDs/report mismatch');
  return copyCadData(expected.report);
}
