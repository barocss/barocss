import { validateCurve, validateSurface, curveDomain } from '../../math.js';
import { extractCurveBezierSpans, CurveBezierSpanExtractionError } from '../curves/curve-bezier-spans.js';
import type { CurveBezierSpanExtractionResult } from '../curves/curve-bezier-spans.js';
import { intersectBezierCurveWithAffinePlaneSurface } from '../../intersect/own-curve-plane-intersection.js';
import type { CurveAffinePlaneAxes } from '../../intersect/own-curve-plane-intersection.js';
import { assembleCurvePlaneEventsTrusted } from '../../intersect/own-multispan-curve-plane.js';
import type { CurveAffinePlaneSpan, CurvePlanePointEvent, CurveAffinePlaneIntersectionReport, CurveAffinePlaneIntersectionResult } from '../../intersect/own-multispan-curve-plane.js';
import { adopt } from '../../intersect/own-plane-cylinder-intersection-internal.js';
import { copyCadData } from '../../data-copy.js';
import type { Curve, Surface, Model } from '../../types.js';
import { same } from '../../structural-equality.js';

export const WideCurveAffinePlaneIntersectionDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', SPAN: 'SPAN', REPRESENTABILITY: 'REPRESENTABILITY',
  BUDGET: 'BUDGET', NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
} as const);
export type WideCurveAffinePlaneIntersectionDiagnosticCode =
  typeof WideCurveAffinePlaneIntersectionDiagnosticCode[keyof typeof WideCurveAffinePlaneIntersectionDiagnosticCode];
export class WideCurveAffinePlaneIntersectionError extends Error {
  readonly code: WideCurveAffinePlaneIntersectionDiagnosticCode;
  constructor(code: WideCurveAffinePlaneIntersectionDiagnosticCode, detail: string, cause?: unknown) {
    super(('Wide Curve-plane intersection: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'WideCurveAffinePlaneIntersectionError'; this.code = code;
  }
}
export interface WideCurveAffinePlaneIntersectionOptions {
  evaluationId: string; resultIdPrefix: string; pointEventIds: string[];
}
export interface WideCurveAffinePlaneIntersectionReport {
  family: 'own-wide-multispan-curve-affine-plane-surface';
  dto: { schema: 'barocss-native-wide-curve-plane-intersection'; version: 0; lengthUnit: 'mm';
    frame: 'authored-xyz-no-axis-conversion'; representation: 'native-curve-plane-events-not-sewn-topology' };
  kind: WideCurveAffinePlaneIntersectionResult['kind']; evaluationId: string; curveId: string; planeId: string;
  curveDomain: [number, number]; curveDegree: 1 | 2; planeAxes: CurveAffinePlaneAxes;
  spanCount: number; contributionCount: number; supportEventCount: number; finiteEventCount: number; outsideEventCount: number;
  coincidentSpans: CurveAffinePlaneIntersectionReport['coincidentSpans']; supportDisjointSpanIds: string[];
  originalGuardedParameters: number[]; privateIdAllocationAttempts: number;
  authority: 'original-complete-curve-coefficients'; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  inputProfile: { degreeRange: [1, 2]; poleRange: [2, 64]; maximumKnots: 70; maximumNonzeroSpans: 64;
    weightRange: [1e-6, 1e6]; coordinateAbsMM: 10000; clamped: true; nonperiodic: true;
    planeDegree: [1, 1]; planeControlGrid: [2, 2]; planeEqualWeights: true; planeAffine: true };
  numericPolicy: CurveAffinePlaneIntersectionReport['numericPolicy'];
  quality: { extraction: 'actual-public-native-bezier-span-extraction'; primitive: 'actual-public-bezier-curve-affine-plane-intersection';
    assembly: 'shared-whole-original-curve-event-uv-bracket-assembly'; globalBinary64ErrorCertified: false;
    manufacturingToleranceCertified: false; coincidenceClippingCertified: false;
    ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-no-partial-result';
  limits: { maximumOriginalPoles: 64; maximumOriginalKnots: 70; maximumSpans: 64; maximumLocalBezierPoles: 3;
    maximumContributions: 128; maximumEvents: 128; maximumRootSteps: 64; maximumPrivateIdAllocationAttempts: 512;
    reservedExtractionRoleIds: 65; inputValues: 32768; inputDepth: 8; inputArrayElements: 128;
    inputRecordFields: 16; inputStringCharacters: 128; snapshotValues: 1048576; snapshotDepth: 40;
    arrayElements: 4096; recordFields: 64; sourceStringCharacters: 262144; authoredIdCharacters: 48; resultIdPrefixCharacters: 20 };
}
export interface WideCurveAffinePlaneIntersectionResult {
  kind: CurveAffinePlaneIntersectionResult['kind']; curve: Curve; plane: Surface;
  options: WideCurveAffinePlaneIntersectionOptions; source: string; sourceVersion: 0; model: Model;
  extraction: CurveBezierSpanExtractionResult; spans: CurveAffinePlaneSpan[]; events: CurvePlanePointEvent[];
  report: WideCurveAffinePlaneIntersectionReport;
}

const CODE = WideCurveAffinePlaneIntersectionDiagnosticCode;
function check(condition: boolean, code: WideCurveAffinePlaneIntersectionDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new WideCurveAffinePlaneIntersectionError(code, detail);
}
function native<T>(action: () => T, detail: string, code: WideCurveAffinePlaneIntersectionDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof WideCurveAffinePlaneIntersectionError) throw cause;
    const actualCode = cause instanceof CurveBezierSpanExtractionError ? cause.code : code;
    throw new WideCurveAffinePlaneIntersectionError(actualCode, detail + ': '
      + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
  }
}
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT;
  let remaining = owned ? 1048576 : 32768;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= (owned ? 40 : 8), code, 'own-value/depth budget exceeded');
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
    ancestors.delete(value); return result;
  };
  return native(() => copy(input, 0), 'own data snapshot', code);
}
function record(value: unknown, fields: string[], code: WideCurveAffinePlaneIntersectionDiagnosticCode = CODE.INPUT): Record<string, unknown> {
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

/** Intersect actual analytic Bezier spans while retaining the whole original wide Curve as authority. */
export function intersectCurveWideWithAffinePlaneSurface(curveInput: Curve, planeInput: Surface,
  optionInput: WideCurveAffinePlaneIntersectionOptions): WideCurveAffinePlaneIntersectionResult {
  const c = record(snapshot(curveInput), ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']) as unknown as Curve;
  const p = record(snapshot(planeInput), ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']) as unknown as Surface;
  const o = record(snapshot(optionInput), ['evaluationId', 'resultIdPrefix', 'pointEventIds']);
  id(c.id); id(p.id);
  check(c.kind === 'curve' && (c.degree === 1 || c.degree === 2), CODE.INPUT, 'original degree1/2 native Curve required');
  native(() => validateCurve(c), 'original native Curve admission', CODE.INPUT);
  check(c.controlPoints.length <= 64 && c.knots.length <= 70
    && c.controlPoints.every(point => point.every(value => Math.abs(value) <= 10000)), CODE.INPUT,
  'original Curve must retain the bounded64/70/authored XYZ±10000mm extraction profile');
  check(p.kind === 'surface' && p.degreeU === 1 && p.degreeV === 1, CODE.INPUT, 'original degree1x1 affine Plane Surface required');
  native(() => validateSurface(p), 'original native Plane admission', CODE.INPUT);
  check(p.controlPoints.length === 2 && p.controlPoints.every(row => row.length === 2)
    && p.weights.every(row => row.every(weight => Object.is(weight, p.weights[0][0]))), CODE.INPUT,
  'original four-pole equal represented-weight Plane required');
  check(typeof o.resultIdPrefix === 'string' && o.resultIdPrefix.length <= 20 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(o.resultIdPrefix),
    CODE.IDENTITY, 'ASCII result prefix1..20 required');
  check(Array.isArray(o.pointEventIds) && o.pointEventIds.length >= 1 && o.pointEventIds.length <= 128,
    CODE.BUDGET, '1..128 explicit point-event IDs required');
  const options: WideCurveAffinePlaneIntersectionOptions = {
    evaluationId: id(o.evaluationId), resultIdPrefix: o.resultIdPrefix, pointEventIds: o.pointEventIds.map(value => id(value)),
  };
  const domain = curveDomain(c);
  let spanCount = 0;
  for (let k = c.degree; k < c.controlPoints.length; k++) if (c.knots[k] < c.knots[k + 1]) {
    check(Number.isFinite(c.knots[k + 1] - c.knots[k]), CODE.REPRESENTABILITY, 'original span width overflow'); spanCount++;
  }
  check(spanCount >= 1 && spanCount <= 64, CODE.SPAN, '1..64 original nonzero spans required');
  const extractionRoles = [id(options.resultIdPrefix + '_model'),
    ...Array.from({ length: 64 }, (_, index) => id(options.resultIdPrefix + '_span_' + index))];
  const roles = [c.id, p.id, options.evaluationId, ...options.pointEventIds, ...extractionRoles];
  const reserved = new Set(roles);
  check(reserved.size === roles.length, CODE.IDENTITY, 'original/evaluation/event/all65 extraction roles must be distinct');
  let privateIdAllocationAttempts = 0;
  const privateId = (): string => {
    for (;;) {
      check(++privateIdAllocationAttempts <= 512, CODE.BUDGET, 'private identity allocation attempt budget exhausted');
      const candidate = '__wide_plane_tmp_' + privateIdAllocationAttempts;
      if (reserved.has(candidate)) continue;
      reserved.add(candidate); return candidate;
    }
  };
  // Reserve all actual private solver roles before any geometry/source staging.
  const privateOptions = Array.from({ length: spanCount }, () => ({ evaluationId: privateId(), pointEventIds: [privateId(), privateId()] }));
  const originalModel: Model = { name: options.evaluationId, version: 0, lengthUnit: 'mm', objects: [c, p] };
  const file = native(() => adopt(originalModel), 'actual original Curve/Plane source0 adoption');
  check(file.source.length <= 262144, CODE.BUDGET, 'original Curve/Plane source0 string budget exceeded');
  check(same(file.model, originalModel), CODE.BINDING, 'original source0 geometry IDs/order/domain/coefficient/sign bits changed');
  const curve = file.model.objects[0] as Curve, plane = file.model.objects[1] as Surface;
  const extraction = native(() => extractCurveBezierSpans(curve, { resultIdPrefix: options.resultIdPrefix }), 'actual public native Bezier span extraction');
  check(extraction.spans.length === spanCount && same(extraction.curve, curve), CODE.BINDING, 'actual extraction changed original Curve or span count');
  const spans: CurveAffinePlaneSpan[] = extraction.spans.map((span, index) => {
    check(span.bezier.controlPoints.length === c.degree + 1 && span.bezier.controlPoints.length <= 3,
      CODE.NATIVE, 'actual local degree1/2 Bezier capacity exceeded');
    const intersection = native(() => intersectBezierCurveWithAffinePlaneSurface(span.bezier, plane, privateOptions[index]),
      'actual public Bezier Curve/Plane primitive', CODE.REPRESENTABILITY);
    check(intersection.events.length <= 2 && same(intersection.curve, span.bezier) && same(intersection.plane, plane),
      CODE.BINDING, 'actual local primitive changed geometry or exceeded quadratic root capacity');
    return { spanId: span.bezier.id, spanIndex: span.index, domain: span.domain, curve: intersection.curve,
      intersection, source: intersection.source, sourceVersion: 0, model: intersection.model };
  });
  const parameters = spans.flatMap(span => span.intersection.events.map(event => event.parameter));
  check(parameters.length <= 128 && new Set(parameters).size <= 128 && new Set(parameters).size <= options.pointEventIds.length,
    CODE.BUDGET, 'isolated contribution/consolidated explicit event capacity exhausted');
  const assembled = native(() => assembleCurvePlaneEventsTrusted(curve, plane, spans, options.pointEventIds, 128, 128),
    'shared whole-original Curve/Plane event assembly', CODE.REPRESENTABILITY);
  const report: WideCurveAffinePlaneIntersectionReport = {
    family: 'own-wide-multispan-curve-affine-plane-surface',
    dto: { schema: 'barocss-native-wide-curve-plane-intersection', version: 0, lengthUnit: 'mm',
      frame: 'authored-xyz-no-axis-conversion', representation: 'native-curve-plane-events-not-sewn-topology' },
    kind: assembled.kind, evaluationId: options.evaluationId, curveId: curve.id, planeId: plane.id,
    curveDomain: domain, curveDegree: c.degree as 1 | 2, planeAxes: assembled.axes, spanCount,
    contributionCount: assembled.contributionCount, supportEventCount: assembled.events.length,
    finiteEventCount: assembled.finiteCount, outsideEventCount: assembled.events.length - assembled.finiteCount,
    coincidentSpans: assembled.coincidentSpans,
    supportDisjointSpanIds: spans.filter(span => span.intersection.kind === 'support-disjoint').map(span => span.spanId),
    originalGuardedParameters: assembled.originalGuardedParameters, privateIdAllocationAttempts,
    authority: 'original-complete-curve-coefficients', geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    inputProfile: { degreeRange: [1, 2], poleRange: [2, 64], maximumKnots: 70, maximumNonzeroSpans: 64,
      weightRange: [1e-6, 1e6], coordinateAbsMM: 10000, clamped: true, nonperiodic: true,
      planeDegree: [1, 1], planeControlGrid: [2, 2], planeEqualWeights: true, planeAffine: true },
    numericPolicy: { parameterWidthTarget: 1e-12, maximumRootSteps: 64, pointBindingComparisonMM: 1e-7, exactParameterDedupOnly: true,
      sideSampling: 'represented-midpoint-between-event-and-nearest-span-root-or-boundary',
      uvBoundaryPolicy: 'original-estimate-and-bracket-domain-agreement-no-clamp' },
    quality: { extraction: 'actual-public-native-bezier-span-extraction', primitive: 'actual-public-bezier-curve-affine-plane-intersection',
      assembly: 'shared-whole-original-curve-event-uv-bracket-assembly', globalBinary64ErrorCertified: false,
      manufacturingToleranceCertified: false, coincidenceClippingCertified: false, ownership: 'copied-cpu-data-gc-no-renderer-resources' },
    budgetFailure: 'atomic-refusal-no-partial-result',
    limits: { maximumOriginalPoles: 64, maximumOriginalKnots: 70, maximumSpans: 64, maximumLocalBezierPoles: 3,
      maximumContributions: 128, maximumEvents: 128, maximumRootSteps: 64, maximumPrivateIdAllocationAttempts: 512,
      reservedExtractionRoleIds: 65, inputValues: 32768, inputDepth: 8, inputArrayElements: 128,
      inputRecordFields: 16, inputStringCharacters: 128, snapshotValues: 1048576, snapshotDepth: 40,
      arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144, authoredIdCharacters: 48, resultIdPrefixCharacters: 20 },
  };
  return snapshot({ kind: assembled.kind, curve, plane, options, source: file.source, sourceVersion: 0, model: file.model,
    extraction, spans, events: assembled.events, report }, true) as WideCurveAffinePlaneIntersectionResult;
}
/** Rebuild original sources, analytic extraction, all actual primitive spans and whole-original events. */
export function validateWideCurveAffinePlaneIntersection(input: WideCurveAffinePlaneIntersectionResult): WideCurveAffinePlaneIntersectionReport {
  const owned = snapshot(input, true) as WideCurveAffinePlaneIntersectionResult;
  record(owned, ['kind', 'curve', 'plane', 'options', 'source', 'sourceVersion', 'model', 'extraction', 'spans', 'events', 'report'], CODE.OWNED);
  let expected: WideCurveAffinePlaneIntersectionResult;
  try { expected = intersectCurveWideWithAffinePlaneSurface(owned.curve, owned.plane, owned.options); } catch (cause) {
    throw new WideCurveAffinePlaneIntersectionError(CODE.OWNED, 'owned original geometry/options complete rebuild refused', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'owned original source/analytic spans/native primitive/events/UV/brackets/IDs/report mismatch');
  return copyCadData(expected.report);
}
