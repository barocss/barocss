import { validateCurve, validateSurface, curveDomain } from './math.js';
import { prepareCurvePlaneAxesTrusted, curvePlaneCoefficientsTrusted, bindCurvePlaneRootsTrusted, classifyCurvePlaneSupportTrusted } from './own-curve-plane-intersection.js';
import type { BezierCurvePlanePointEvent, BezierCurveAffinePlaneIntersectionResult, CurveAffinePlaneAxes } from './own-curve-plane-intersection.js';
import { solveCubicBernsteinRoots, CubicBernsteinRootError } from './own-cubic-bernstein-roots.js';
import type { CubicBernsteinRootEvidence } from './own-cubic-bernstein-roots.js';
import { adopt } from './own-plane-cylinder-intersection-internal.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Surface, Model, Point } from './types.js';

export const CubicCurveAffinePlaneIntersectionDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', REPRESENTABILITY: 'REPRESENTABILITY', BUDGET: 'BUDGET',
  NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
} as const);
export type CubicCurveAffinePlaneIntersectionDiagnosticCode =
  typeof CubicCurveAffinePlaneIntersectionDiagnosticCode[keyof typeof CubicCurveAffinePlaneIntersectionDiagnosticCode];
export class CubicCurveAffinePlaneIntersectionError extends Error {
  readonly code: CubicCurveAffinePlaneIntersectionDiagnosticCode;
  constructor(code: CubicCurveAffinePlaneIntersectionDiagnosticCode, detail: string, cause?: unknown) {
    super(('Cubic Curve-plane intersection: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CubicCurveAffinePlaneIntersectionError'; this.code = code;
  }
}
export interface CubicCurveAffinePlaneIntersectionOptions { evaluationId: string; pointEventIds: string[] }
export type CubicCurvePlaneRootEvidence = CubicBernsteinRootEvidence;
export interface CubicCurveAffinePlaneIntersectionReport {
  family: 'own-cubic-bezier-curve-affine-plane-surface';
  dto: { schema: 'barocss-native-cubic-curve-plane-intersection'; version: 0; lengthUnit: 'mm';
    frame: 'raw-authored-xyz-no-axis-conversion'; representation: 'original-cubic-curve-plane-events-not-sewn-topology' };
  kind: CubicCurveAffinePlaneIntersectionResult['kind']; evaluationId: string; curveId: string; planeId: string;
  curveDomain: [number, number]; curveDegree: 3; planeAxes: CurveAffinePlaneAxes; rootEvidence: CubicCurvePlaneRootEvidence;
  supportEventCount: number; finiteEventCount: number; outsideEventCount: number;
  coincident: { support: boolean; finiteContainment: 'control-hull-contained' | 'not-proven' | 'not-applicable'; controlPoleUV: Point[] };
  authority: 'original-cubic-homogeneous-coefficients-and-original-native-geometry';
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  inputProfile: { curveDegree: 3; originalCurvePoles: 4; originalCurveKnots: 8; originalNonzeroSpans: 1;
    planeDegree: [1, 1]; planeControlGrid: [2, 2]; planeEqualWeights: true; coordinateAbsMM: 10000;
    weightRange: [1e-6, 1e6]; positive: true; clamped: true; nonperiodic: true };
  numericPolicy: { parameterWidthTarget: 1e-12; normalizedParameterWidthTarget: number; maximumRootSteps: 64;
    maximumScalarEvaluations: 1024; pointBindingComparisonMM: 1e-7;
    criticalBracketPolicy: 'derivative-control-hull-lipschitz-plus64-epsilon-exclusion';
    nearZeroMidpointPolicy: 'represented-quarter-points-with-safely-opposite-ordered-signs-or-refusal';
    uvBoundaryPolicy: 'original-estimate-and-bracket-domain-agreement-no-clamp';
    gramPolicy: '64-epsilon-scaled-determinant-refusal'; exactParameterDedupOnly: true };
  quality: { scalarScaleDerivedOnly: true; originalGeometryBitsPreserved: true;
    derivativeSolver: 'actual-existing-quadratic-bernstein-root-solver'; simpleCrossingsOnlyInInterior: true;
    interiorTangentOrStationaryAmbiguity: 'atomic-refusal'; localNumericalEvidenceOnly: true;
    globalBinary64ErrorCertified: false; manufacturingToleranceCertified: false; coincidenceClippingCertified: false;
    ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-no-partial-result';
  limits: { maximumEvents: 3; maximumDerivativeRoots: 2; maximumMonotoneIntervals: 3; maximumCriticalBrackets: 2;
    maximumRootSteps: 64; maximumScalarEvaluations: 1024; inputValues: 4096; inputDepth: 8; inputArrayElements: 64;
    inputRecordFields: 16; inputStringCharacters: 128; snapshotValues: 262144; snapshotDepth: 32;
    arrayElements: 4096; recordFields: 64; sourceStringCharacters: 262144; authoredIdCharacters: 48 };
}
export interface CubicCurveAffinePlaneIntersectionResult {
  kind: BezierCurveAffinePlaneIntersectionResult['kind']; curve: Curve; plane: Surface;
  options: CubicCurveAffinePlaneIntersectionOptions; source: string; sourceVersion: 0; model: Model;
  events: BezierCurvePlanePointEvent[]; report: CubicCurveAffinePlaneIntersectionReport;
}

const CODE = CubicCurveAffinePlaneIntersectionDiagnosticCode;
function check(condition: boolean, code: CubicCurveAffinePlaneIntersectionDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new CubicCurveAffinePlaneIntersectionError(code, detail);
}
function native<T>(action: () => T, detail: string, code: CubicCurveAffinePlaneIntersectionDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof CubicCurveAffinePlaneIntersectionError) throw cause;
    const actualCode = cause instanceof CubicBernsteinRootError ? cause.code : code;
    throw new CubicCurveAffinePlaneIntersectionError(actualCode, detail + ': '
      + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
  }
}
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT;
  let remaining = owned ? 262144 : 4096;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= (owned ? 32 : 8), code, 'own-value/depth budget exceeded');
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
    check(keys.length <= (array ? (owned ? 4097 : 65) : (owned ? 64 : 16)), code, 'own field budget exceeded');
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden own data refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= (owned ? 4096 : 64)
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
function record(value: unknown, fields: string[], code: CubicCurveAffinePlaneIntersectionDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'own record required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    code, 'exact fields required: ' + fields.join(','));
  return data;
}
function id(value: unknown): string {
  check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),
    CODE.IDENTITY, 'ASCII original/context/event ID1..48 required');
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

/** Own bounded cubic support roots with the exact shared original Curve/Plane binding policy. */
export function intersectCubicBezierCurveWithAffinePlaneSurface(curveInput: Curve, planeInput: Surface,
  inputOptions: CubicCurveAffinePlaneIntersectionOptions): CubicCurveAffinePlaneIntersectionResult {
  const c = record(snapshot(curveInput), ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']) as unknown as Curve;
  const p = record(snapshot(planeInput), ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']) as unknown as Surface;
  const o = record(snapshot(inputOptions), ['evaluationId', 'pointEventIds']);
  id(c.id); id(p.id);
  check(c.kind === 'curve' && c.degree === 3 && Array.isArray(c.controlPoints) && c.controlPoints.length === 4
    && Array.isArray(c.knots) && c.knots.length === 8, CODE.INPUT, 'original single degree3/four-pole/eight-knot Bezier required');
  native(() => validateCurve(c), 'original positive open-clamped cubic Curve admission', CODE.INPUT);
  check(c.controlPoints.every(point => point.every(value => Math.abs(value) <= 10000)), CODE.INPUT, 'original cubic XYZ±10000mm required');
  check(p.kind === 'surface' && p.degreeU === 1 && p.degreeV === 1, CODE.INPUT, 'original degree1x1 affine Plane required');
  native(() => validateSurface(p), 'original positive Plane admission', CODE.INPUT);
  check(p.controlPoints.length === 2 && p.controlPoints.every(row => row.length === 2 && row.every(point => point.every(value => Math.abs(value) <= 10000)))
    && p.weights.every(row => row.every(weight => Object.is(weight, p.weights[0][0]))), CODE.INPUT,
  'original four-pole/equal-weight affine Plane XYZ±10000mm required');
  check(Array.isArray(o.pointEventIds) && o.pointEventIds.length >= 1 && o.pointEventIds.length <= 3,
    CODE.BUDGET, '1..3 explicit cubic event slots required');
  const options: CubicCurveAffinePlaneIntersectionOptions = { evaluationId: id(o.evaluationId), pointEventIds: o.pointEventIds.map(value => id(value)) };
  const roles = [c.id, p.id, options.evaluationId, ...options.pointEventIds];
  check(new Set(roles).size === roles.length, CODE.IDENTITY, 'original/context/event IDs must be distinct');
  const domain = curveDomain(c), span = domain[1] - domain[0];
  check(Number.isFinite(span) && span > 0, CODE.REPRESENTABILITY, 'positive represented original cubic domain span required');
  const normalizedTarget = Math.min(1e-12, 1e-12 / span);
  check(Number.isFinite(normalizedTarget) && normalizedTarget > 0, CODE.REPRESENTABILITY, 'normalized root target not represented');
  const axes = native(() => prepareCurvePlaneAxesTrusted(p), 'actual shared original Plane axes', CODE.REPRESENTABILITY);
  const coefficients = native(() => curvePlaneCoefficientsTrusted(c, axes), 'actual shared original homogeneous plane projection', CODE.REPRESENTABILITY);
  const solved = native(() => solveCubicBernsteinRoots(coefficients, normalizedTarget), 'own cubic Bernstein scalar root isolation', CODE.REPRESENTABILITY);
  check(solved.roots.length <= 3 && solved.roots.length <= options.pointEventIds.length, CODE.BUDGET, 'actual cubic roots exceed declared event slots');
  const events = native(() => bindCurvePlaneRootsTrusted(c, p, domain, axes, solved.roots, options.pointEventIds),
    'actual shared original root/point/UV/bracket binding', CODE.REPRESENTABILITY);
  const support = native(() => classifyCurvePlaneSupportTrusted(c, axes, solved.evidence.coincident, events),
    'actual shared support/coincident finite classification', CODE.REPRESENTABILITY);
  const original: Model = { name: options.evaluationId, version: 0, lengthUnit: 'mm', objects: [c, p] };
  const file = native(() => adopt(original), 'actual original cubic Curve/Plane source0 adoption');
  check(file.source.length <= 262144, CODE.BUDGET, 'actual original source0 string budget exceeded');
  check(same(file.model, original), CODE.BINDING, 'actual original source0 geometry/IDs/order/coefficient/domain/sign bits changed');
  const report: CubicCurveAffinePlaneIntersectionReport = {
    family: 'own-cubic-bezier-curve-affine-plane-surface',
    dto: { schema: 'barocss-native-cubic-curve-plane-intersection', version: 0, lengthUnit: 'mm',
      frame: 'raw-authored-xyz-no-axis-conversion', representation: 'original-cubic-curve-plane-events-not-sewn-topology' },
    kind: support.kind, evaluationId: options.evaluationId, curveId: c.id, planeId: p.id, curveDomain: domain,
    curveDegree: 3, planeAxes: axes, rootEvidence: solved.evidence, supportEventCount: events.length,
    finiteEventCount: support.finiteCount, outsideEventCount: events.length - support.finiteCount,
    coincident: { support: solved.evidence.coincident, finiteContainment: solved.evidence.coincident
      ? support.contained ? 'control-hull-contained' : 'not-proven' : 'not-applicable', controlPoleUV: support.controlPoleUV },
    authority: 'original-cubic-homogeneous-coefficients-and-original-native-geometry',
    geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    inputProfile: { curveDegree: 3, originalCurvePoles: 4, originalCurveKnots: 8, originalNonzeroSpans: 1,
      planeDegree: [1, 1], planeControlGrid: [2, 2], planeEqualWeights: true, coordinateAbsMM: 10000,
      weightRange: [1e-6, 1e6], positive: true, clamped: true, nonperiodic: true },
    numericPolicy: { parameterWidthTarget: 1e-12, normalizedParameterWidthTarget: normalizedTarget, maximumRootSteps: 64,
      maximumScalarEvaluations: 1024, pointBindingComparisonMM: 1e-7,
      criticalBracketPolicy: 'derivative-control-hull-lipschitz-plus64-epsilon-exclusion',
      nearZeroMidpointPolicy: 'represented-quarter-points-with-safely-opposite-ordered-signs-or-refusal',
      uvBoundaryPolicy: 'original-estimate-and-bracket-domain-agreement-no-clamp', gramPolicy: '64-epsilon-scaled-determinant-refusal', exactParameterDedupOnly: true },
    quality: { scalarScaleDerivedOnly: true, originalGeometryBitsPreserved: true, derivativeSolver: 'actual-existing-quadratic-bernstein-root-solver',
      simpleCrossingsOnlyInInterior: true, interiorTangentOrStationaryAmbiguity: 'atomic-refusal', localNumericalEvidenceOnly: true,
      globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, coincidenceClippingCertified: false,
      ownership: 'copied-cpu-data-gc-no-renderer-resources' }, budgetFailure: 'atomic-refusal-no-partial-result',
    limits: { maximumEvents: 3, maximumDerivativeRoots: 2, maximumMonotoneIntervals: 3, maximumCriticalBrackets: 2,
      maximumRootSteps: 64, maximumScalarEvaluations: 1024, inputValues: 4096, inputDepth: 8, inputArrayElements: 64,
      inputRecordFields: 16, inputStringCharacters: 128, snapshotValues: 262144, snapshotDepth: 32,
      arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144, authoredIdCharacters: 48 },
  };
  return snapshot({ kind: support.kind, curve: file.model.objects[0] as Curve, plane: file.model.objects[1] as Surface, options,
    source: file.source, sourceVersion: 0, model: file.model, events, report }, true) as CubicCurveAffinePlaneIntersectionResult;
}
/** Rebuild every original source/coefficient/scalar/root/point/UV/bracket/ID/report field. */
export function validateCubicBezierCurveAffinePlaneIntersection(input: CubicCurveAffinePlaneIntersectionResult): CubicCurveAffinePlaneIntersectionReport {
  const owned = snapshot(input, true) as CubicCurveAffinePlaneIntersectionResult;
  record(owned, ['kind', 'curve', 'plane', 'options', 'source', 'sourceVersion', 'model', 'events', 'report'], CODE.OWNED);
  let expected: CubicCurveAffinePlaneIntersectionResult;
  try { expected = intersectCubicBezierCurveWithAffinePlaneSurface(owned.curve, owned.plane, owned.options); } catch (cause) {
    throw new CubicCurveAffinePlaneIntersectionError(CODE.OWNED, 'owned original cubic geometry/options complete rebuild refused', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'owned original source/coefficient/scalar evidence/root/point/UV/bracket/ID/report mismatch');
  return copyCadData(expected.report);
}
