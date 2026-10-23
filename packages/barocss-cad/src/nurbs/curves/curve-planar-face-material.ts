import { intersectCurveWideWithAffinePlaneSurface } from '../source-wide/curve-wide-plane-intersection.js';
import type { WideCurveAffinePlaneIntersectionResult } from '../source-wide/curve-wide-plane-intersection.js';
import { intersectCubicCurveWideWithAffinePlaneSurface } from '../source-wide/curve-wide-cubic-plane-intersection.js';
import type { WideCubicCurveAffinePlaneIntersectionResult } from '../source-wide/curve-wide-cubic-plane-intersection.js';
import { validateConvexPlanarFaceWithHoles, classifyConvexPlanarFaceWithHolesUV } from '../../intersect/own-convex-planar-face-holes.js';
import type { ConvexPlanarFaceWithHolesResult, ConvexPlanarFaceWithHolesUVClassification } from '../../intersect/own-convex-planar-face-holes.js';
import { extractCurveInterval } from './curve-interval-extraction.js';
import type { ExtractedCurveIntervalResult } from './curve-interval-extraction.js';
import { buildAffinePlaneAxes, mapAffinePlanePointToUV, directedUVDeterminant } from '../../intersect/own-affine-plane-loop-internal.js';
import type { CurveAffinePlaneAxes } from '../../intersect/own-curve-plane-intersection.js';
import type { CurvePlanePointEvent } from '../../intersect/own-multispan-curve-plane.js';
import { evaluateCurve } from '../../math.js';
import { copyCadData } from '../../data-copy.js';
import type { Curve, Point } from '../../types.js';
import { same } from '../../structural-equality.js';

export const CurvePlanarFaceMaterialDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', BUDGET: 'BUDGET', UNSUPPORTED: 'UNSUPPORTED', NATIVE: 'NATIVE',
  UNCERTAINTY: 'UNCERTAINTY', BINDING: 'BINDING', OWNED: 'OWNED',
} as const);
export type CurvePlanarFaceMaterialDiagnosticCode = typeof CurvePlanarFaceMaterialDiagnosticCode[keyof typeof CurvePlanarFaceMaterialDiagnosticCode];
export class CurvePlanarFaceMaterialError extends Error {
  readonly code: CurvePlanarFaceMaterialDiagnosticCode;
  constructor(code: CurvePlanarFaceMaterialDiagnosticCode, detail: string, cause?: unknown) {
    super(('Curve planar Face material: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CurvePlanarFaceMaterialError'; this.code = code;
  }
}
export interface CurvePlanarFaceMaterialOptions {
  evaluationId: string; resultIdPrefix: string; pointEventIds: string[];
  maximumBracketRestrictions: number; maximumClassifications: number;
}
type Classification = ConvexPlanarFaceWithHolesUVClassification['classification'];
type Sign = 'positive' | 'negative' | 'zero';
type BoundaryIdentity = { loopId: string; loopRole: 'outer' | 'inner'; edgeId: string; curveId: string; useId: string; pcurveId: string };
type Decision = { classification: Classification; material: boolean; holeId: string | null; boundaryContributors: BoundaryIdentity[] };
type ChartBound = { axis: 'u' | 'v'; side: 'lower' | 'upper'; limit: number; values: number[]; thresholds: number[]; sign: Sign };
type LoopBound = BoundaryIdentity & { edgeIndex: number; authoredOrientation: 'ccw' | 'cw'; values: number[]; thresholds: number[]; sign: Sign };
type Bracket = {
  spanId: string; spanIndex: number; contributionEventId: string; interval: [number, number];
  extraction: ExtractedCurveIntervalResult | null; projectedControlHullUV: Point[]; positiveWeights: number[];
  chartBounds: ChartBound[]; loopBounds: LoopBound[]; decision: Decision;
};
type Transversality = {
  eventId: string; normalDerivativeMM: number; normalDerivativeGuardMM: number;
  lower: { parameter: number; signedDistanceMM: number; guardMM: number }[];
  upper: { parameter: number; signedDistanceMM: number; guardMM: number }[];
};
export interface CurvePlanarFaceMaterialEvent {
  eventId: string; parameter: number; classification: Classification; material: boolean;
  faceClassification: ConvexPlanarFaceWithHolesUVClassification; brackets: Bracket[];
}
export interface CurvePlanarFaceMaterialReport {
  schema: 'barocss-curve-planar-face-material'; version: 0; lengthUnit: 'mm'; frame: 'authored-xyz-mm-native-uv-dimensionless';
  curveId: string; faceId: string; planeId: string; evaluationId: string; parentFamily: string; parentEvaluationId: string; curveDegree: number;
  spanCount: number; parentMaximumContributions: number; rootEventCount: number; contributionCount: number; nonSingletonContributionCount: number;
  bracketRestrictionCount: number; nativeSplitCount: number; classificationCount: number;
  classificationCounts: Record<Classification, number>; transversality: Transversality[];
  identities: { nativeObjectIds: string[]; loopIds: string[]; pcurveIds: string[]; useIds: string[] };
  numericPolicy: { hullGuardFactor: 512; transversalityGuardFactor: 64; inheritedExtractionBindingMM: 1e-7;
    evidence: 'local-constructed-positive-control-hulls-not-original-global-binary64-enclosures';
    boundary: 'exact-singleton-or-identically-zero-applicable-whole-hull-halfspace';
    projection: 'orthogonal-affine-native-uv-not-coplanarity-of-bracket-points' };
  workPolicy: { rootWorkBeforeTrimAdmission: true; completeTrimAdmissionBeforeExtractionOrClassification: true;
    counters: 'direct-operation-calls-not-internal-validator-work'; failure: 'atomic-no-partial-result' };
  sourceOwnership: 'separate-original-face-parent-curve-plane-and-interval-source0-models-independent-cpu-data';
  limits: { maximumCurvePoles: 64; maximumKnots: 70; maximumDegree: 3; maximumContributions: 192;
    maximumBracketRestrictions: number; maximumClassifications: number; maximumFaceLines: 15; maximumFaceSourceObjects: 16;
    coordinateAbsMM: 10000; ownedValues: 1048576; ownedDepth: 64; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144 };
}
export interface CurvePlanarFaceMaterialResult {
  curve: Curve; face: ConvexPlanarFaceWithHolesResult; options: CurvePlanarFaceMaterialOptions;
  intersection: WideCurveAffinePlaneIntersectionResult | WideCubicCurveAffinePlaneIntersectionResult;
  events: CurvePlanarFaceMaterialEvent[]; report: CurvePlanarFaceMaterialReport;
}

const CODE = CurvePlanarFaceMaterialDiagnosticCode, HULL_EPS = 512 * Number.EPSILON, SIDE_EPS = 64 * Number.EPSILON;
function check(condition: boolean, code: CurvePlanarFaceMaterialDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new CurvePlanarFaceMaterialError(code, detail);
}
function native<T>(action: () => T, detail: string): T {
  try { return action(); } catch (cause) { throw new CurvePlanarFaceMaterialError(CODE.NATIVE, detail, cause); }
}
function finite(value: number): number { check(Number.isFinite(value), CODE.UNCERTAINTY, 'Finite bound arithmetic range exceeded'); return value; }
function product(a: number, b: number): number {
  const value = finite(a * b);
  check(a === 0 || b === 0 || value !== 0, CODE.UNCERTAINTY, 'Nonzero bound product is not representable');
  return value;
}
function snapshot(input: unknown, code: CurvePlanarFaceMaterialDiagnosticCode): unknown {
  let remaining = 1048576;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 64, code, 'Own value or depth limit exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'Finite own numbers are required'); return value; }
    if (typeof value === 'string') { check(value.length <= 262144, code, 'Own string limit exceeded'); return value; }
    check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic plain own data is required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Plain own-data prototypes are required');
    check(keys.length <= (array ? 8193 : 64), code, 'Own field limit exceeded');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'Getter, symbol, or hidden own fields are refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, code, 'Dense bounded own arrays are required');
      result = Array.from({ length }, (_, index) => {
        check(Object.hasOwn(descriptors, String(index)), code, 'Sparse or extra array fields are refused');
        return copy(descriptors[String(index)].value, depth + 1);
      });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  };
  try { return copy(input, 0); } catch (cause) {
    if (cause instanceof CurvePlanarFaceMaterialError) throw cause;
    throw new CurvePlanarFaceMaterialError(code, 'Own-data snapshot failed', cause);
  }
}
function record(value: unknown, fields: string[], code: CurvePlanarFaceMaterialDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'An own record is required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required');
  return data;
}
function id(value: unknown, maximum = 48): string {
  check(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.INPUT, 'A bounded ASCII native identifier is required');
  return value;
}
function boundedPoints(points: unknown): void {
  check(Array.isArray(points) && points.every(point => Array.isArray(point) && point.length === 3
    && point.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000)), CODE.INPUT, 'Original XYZ must be finite and within 10000 mm');
}
function sign(values: number[], thresholds: number[], context: string): Sign {
  if (values.every(value => value === 0)) return 'zero';
  if (values.every((value, index) => value > thresholds[index])) return 'positive';
  if (values.every((value, index) => value < -thresholds[index])) return 'negative';
  throw new CurvePlanarFaceMaterialError(CODE.UNCERTAINTY, context + ': control-hull signs are mixed or too near zero');
}
function measuredDot(a: Point, b: Point): { value: number; guard: number } {
  const terms = a.map((value, index) => product(value, b[index]));
  return { value: terms.reduce((sum, value) => finite(sum + value), 0),
    guard: product(SIDE_EPS, terms.reduce((sum, value) => finite(sum + Math.abs(value)), 0)) };
}
function transverse(event: CurvePlanePointEvent, axes: CurveAffinePlaneAxes, domain: [number, number]): Transversality {
  const context = 'Event ' + event.eventId;
  check(event.parameter > domain[0] && event.parameter < domain[1], CODE.UNSUPPORTED, context + ': full-Curve endpoints are unsupported');
  check(event.originalCurveD1.status === 'evaluated', CODE.UNSUPPORTED, context + ': actual original D1 is unavailable');
  const derivative = measuredDot(axes.unitNormal, event.originalCurveD1.value.derivative);
  check(Math.abs(derivative.value) > derivative.guard, CODE.UNSUPPORTED, context + ': safely nonzero normal derivative is required');
  const observations = event.sideObservations.map(observation => {
    const relative = observation.pointMM.map((value, axis) => finite(value - axes.originMM[axis])) as Point;
    const distance = measuredDot(axes.unitNormal, relative);
    check(Object.is(distance.value, observation.signedDistanceMM), CODE.BINDING, context + ': actual side signed-distance binding changed');
    check(Math.abs(distance.value) > distance.guard, CODE.UNCERTAINTY, context + ': safely nonzero side distance is required');
    return { side: observation.side, parameter: observation.parameter, signedDistanceMM: distance.value, guardMM: distance.guard };
  });
  const lower = observations.filter(value => value.side === 'lower').map(({ side: _side, ...value }) => value);
  const upper = observations.filter(value => value.side === 'upper').map(({ side: _side, ...value }) => value);
  check(lower.length > 0 && upper.length > 0 && lower.every(value => value.parameter < event.parameter)
    && upper.every(value => value.parameter > event.parameter), CODE.UNSUPPORTED, context + ': separated actual lower and upper observations are required');
  check(lower.every(value => Math.sign(value.signedDistanceMM) === -Math.sign(derivative.value))
    && upper.every(value => Math.sign(value.signedDistanceMM) === Math.sign(derivative.value)), CODE.UNSUPPORTED, context + ': actual opposite transverse sides are required');
  return { eventId: event.eventId, normalDerivativeMM: derivative.value, normalDerivativeGuardMM: derivative.guard, lower, upper };
}
function hullProof(hull: Point[], weights: number[], face: ConvexPlanarFaceWithHolesResult,
  axes: CurveAffinePlaneAxes, context: string): Pick<Bracket, 'projectedControlHullUV' | 'positiveWeights' | 'chartBounds' | 'loopBounds' | 'decision'> {
  check(hull.length > 0 && weights.length === hull.length && weights.every(weight => Number.isFinite(weight) && weight > 0), CODE.BINDING, context + ': positive control weights are required');
  const projectedControlHullUV = hull.map(point => native(() => mapAffinePlanePointToUV(point, axes), context + ': native control UV projection failed'));
  const chartBounds: ChartBound[] = [];
  for (const axis of [0, 1] as const) for (const side of ['lower', 'upper'] as const) {
    const limit = axes.domains[axis === 0 ? 'u' : 'v'][side === 'lower' ? 0 : 1];
    const values = projectedControlHullUV.map(point => finite(side === 'lower' ? point[axis] - limit : limit - point[axis]));
    const thresholds = projectedControlHullUV.map(point => product(HULL_EPS, finite(Math.abs(point[axis]) + Math.abs(limit))));
    chartBounds.push({ axis: axis === 0 ? 'u' : 'v', side, limit, values, thresholds, sign: sign(values, thresholds, context + ': native chart') });
  }
  const loopBounds: LoopBound[] = [];
  if (chartBounds.some(bound => bound.sign === 'negative')) return { projectedControlHullUV, positiveWeights: weights, chartBounds, loopBounds,
    decision: { classification: 'outside-domain', material: false, holeId: null, boundaryContributors: [] } };
  const memberships: { inside: boolean; boundaries: BoundaryIdentity[]; loopId: string }[] = [];
  for (const [loopIndex, loop] of [face.outerLoop, ...face.holeLoops].entries()) {
    const topology = face.topology.loops.find(value => value.id === loop.id);
    check(topology !== undefined, CODE.BINDING, context + ': original loop topology is required');
    const pcurves = loop.edges.map(edge => face.pcurves.find(pcurve => pcurve.loopId === loop.id && pcurve.curveId === edge.id));
    check(pcurves.every(pcurve => pcurve !== undefined), CODE.BINDING, context + ': actual authored pcurve endpoints are required');
    const signs: Sign[] = [], boundaries: BoundaryIdentity[] = [];
    for (let index = 0; index < loop.edges.length; index++) {
      const pcurve = pcurves[index]!, next = pcurves[(index + 1) % pcurves.length]!;
      const use = topology.uses.find(value => value.curveId === loop.edges[index].id);
      check(use !== undefined, CODE.BINDING, context + ': actual authored edge use is required');
      const anchor = pcurve.curve.controlPoints[0], direction = next.curve.controlPoints[0].map((value, axis) => finite(value - anchor[axis])) as Point;
      const measures = projectedControlHullUV.map(point => native(() => directedUVDeterminant(direction,
        point.map((value, axis) => finite(value - anchor[axis])) as Point), context + ': native loop determinant failed'));
      const values = measures.map(measure => finite((topology.authoredOrientation === 'ccw' ? 1 : -1) * measure.value));
      const thresholds = measures.map(measure => {
        check(measure.value === 0 || measure.threshold > 0, CODE.UNCERTAINTY, context + ': nonzero determinant guard is not representable');
        return product(8, measure.threshold);
      });
      const identity: BoundaryIdentity = { loopId: loop.id, loopRole: loopIndex === 0 ? 'outer' : 'inner',
        edgeId: use.edgeId, curveId: use.curveId, useId: use.id, pcurveId: pcurve.id };
      const constantSign = sign(values, thresholds, context + ': loop ' + loop.id + ' edge ' + index);
      loopBounds.push({ ...identity, edgeIndex: index, authoredOrientation: topology.authoredOrientation, values, thresholds, sign: constantSign });
      signs.push(constantSign); if (constantSign === 'zero') boundaries.push(identity);
    }
    memberships.push({ inside: signs.every(value => value !== 'negative'), boundaries, loopId: loop.id });
  }
  let decision: Decision = { classification: 'inside', material: true, holeId: null, boundaryContributors: [] };
  if (!memberships[0].inside) decision = { classification: 'outside', material: false, holeId: null, boundaryContributors: [] };
  else if (memberships[0].boundaries.length) decision = { classification: 'boundary', material: true, holeId: null, boundaryContributors: memberships[0].boundaries };
  else for (const hole of memberships.slice(1)) if (hole.inside) {
    check(decision.holeId === null, CODE.BINDING, context + ': separated hole membership overlapped');
    decision = { classification: hole.boundaries.length ? 'boundary' : 'inside-hole', material: hole.boundaries.length > 0,
      holeId: hole.loopId, boundaryContributors: hole.boundaries };
  }
  return { projectedControlHullUV, positiveWeights: weights, chartBounds, loopBounds, decision };
}

/** Transverse original finite-Curve roots with complete guarded local bracket material decisions. */
export function intersectCurveWithPlanarFaceMaterial(curveInput: Curve, faceInput: ConvexPlanarFaceWithHolesResult,
  optionInput: CurvePlanarFaceMaterialOptions): CurvePlanarFaceMaterialResult {
  const curve = record(snapshot(curveInput, CODE.INPUT), ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']) as unknown as Curve;
  const face = snapshot(faceInput, CODE.INPUT) as ConvexPlanarFaceWithHolesResult;
  const data = record(snapshot(optionInput, CODE.INPUT), ['evaluationId', 'resultIdPrefix', 'pointEventIds', 'maximumBracketRestrictions', 'maximumClassifications']);
  native(() => validateConvexPlanarFaceWithHoles(face), 'Actual owned Face validation failed');
  check(curve.kind === 'curve' && (curve.degree === 1 || curve.degree === 2 || curve.degree === 3)
    && Array.isArray(curve.controlPoints) && curve.controlPoints.length >= curve.degree + 1 && curve.controlPoints.length <= 64,
  CODE.INPUT, 'A native degree1..3 Curve with at most64 poles is required');
  boundedPoints(curve.controlPoints);
  for (const object of face.model.objects) {
    if (object.kind === 'curve') boundedPoints(object.controlPoints);
    else for (const row of object.controlPoints) boundedPoints(row);
  }
  check(curve.id !== face.options.faceId && face.model.objects.every(object => curve.id !== object.id), CODE.INPUT, 'Curve ID must differ from original Face and native source object IDs');
  check(Array.isArray(data.pointEventIds), CODE.INPUT, 'Explicit point-event IDs are required');
  for (const key of ['maximumBracketRestrictions', 'maximumClassifications'] as const)
    check(typeof data[key] === 'number' && Number.isInteger(data[key]) && data[key] >= 0 && data[key] <= 192, CODE.BUDGET, 'Trim-stage budgets must be integers in0..192');
  const options: CurvePlanarFaceMaterialOptions = { evaluationId: id(data.evaluationId), resultIdPrefix: id(data.resultIdPrefix, 8),
    pointEventIds: data.pointEventIds.map(value => id(value)), maximumBracketRestrictions: data.maximumBracketRestrictions as number,
    maximumClassifications: data.maximumClassifications as number };
  const rootOptions = { evaluationId: options.evaluationId, resultIdPrefix: options.resultIdPrefix, pointEventIds: options.pointEventIds };
  const intersection = native(() => curve.degree === 3 ? intersectCubicCurveWideWithAffinePlaneSurface(curve, face.plane, rootOptions)
    : intersectCurveWideWithAffinePlaneSurface(curve, face.plane, rootOptions), 'Actual wide Curve/Plane root operation failed');
  check(intersection.report.coincidentSpans.length === 0, CODE.UNSUPPORTED, 'Coincident or mixed native spans are unsupported');
  const axes = native(() => buildAffinePlaneAxes(face.plane), 'Actual Face affine axes failed');
  check(same(axes, intersection.report.planeAxes), CODE.BINDING, 'Face and actual root parent must use the same original Plane axes');
  const transversality = intersection.events.map(event => transverse(event, axes, intersection.report.curveDomain));
  const contributionCount = intersection.events.reduce((sum, event) => sum + event.contributions.length, 0);
  const nonSingletonContributionCount = intersection.events.reduce((sum, event) => sum
    + event.contributions.filter(contribution => contribution.event.bracket[0] !== contribution.event.bracket[1]).length, 0);
  check(nonSingletonContributionCount <= options.maximumBracketRestrictions && intersection.events.length <= options.maximumClassifications,
    CODE.BUDGET, 'Complete trim-stage restriction or classification budget is insufficient after actual parent root work');
  const reserved = new Set([curve.id, face.options.faceId, face.options.evaluationId, face.model.name,
    ...face.model.objects.map(object => object.id), ...face.topology.loops.map(loop => loop.id),
    ...face.topology.vertices.map(vertex => vertex.id), ...face.topology.edges.map(edge => edge.id),
    ...face.topology.loops.flatMap(loop => loop.uses.map(use => use.id)), ...face.pcurves.map(pcurve => pcurve.id),
    ...intersection.spans.flatMap(span => [span.spanId, span.model.name, span.intersection.options.evaluationId, ...span.intersection.options.pointEventIds]),
    options.evaluationId, ...options.pointEventIds, options.resultIdPrefix + '_model',
    ...Array.from({ length: 64 }, (_, index) => options.resultIdPrefix + '_span_' + index)]);
  const plans = intersection.events.map(event => event.contributions.map(contribution => {
    const span = intersection.spans.find(value => value.spanId === contribution.spanId && value.spanIndex === contribution.spanIndex);
    const interval = contribution.event.bracket;
    check(span !== undefined && interval[0] <= event.parameter && event.parameter <= interval[1]
      && interval[0] >= span.domain[0] && interval[1] <= span.domain[1], CODE.BINDING, 'Actual contribution bracket and local Bezier identity must bind');
    return { contribution, span, interval };
  }));
  let serial = 0;
  const intervalRoles = plans.map(eventPlans => eventPlans.map(plan => {
    if (plan.interval[0] === plan.interval[1]) return null;
    const prefix = id(options.resultIdPrefix + '_b' + serial++, 20), curveId = id(prefix + '_curve');
    const roles = [curveId, ...[0, 1].flatMap(index => [prefix + '_cut_' + index + '_lo', prefix + '_cut_' + index + '_hi'])];
    for (const role of roles) { id(role); check(!reserved.has(role), CODE.INPUT, 'All interval output and helper roles must be reserved without source/context collisions'); reserved.add(role); }
    return { curveId, interval: plan.interval, resultIdPrefix: prefix };
  }));
  let bracketRestrictionCount = 0, nativeSplitCount = 0, classificationCount = 0;
  const classificationCounts: Record<Classification, number> = { inside: 0, 'inside-hole': 0, boundary: 0, outside: 0, 'outside-domain': 0 };
  const events: CurvePlanarFaceMaterialEvent[] = intersection.events.map((event, eventIndex) => {
    const brackets: Bracket[] = plans[eventIndex].map((plan, index) => {
      const context = 'Event ' + event.eventId + ' contribution ' + plan.contribution.event.eventId;
      const roles = intervalRoles[eventIndex][index];
      let extraction: ExtractedCurveIntervalResult | null = null, hull: Point[], weights: number[];
      if (roles) {
        bracketRestrictionCount++;
        extraction = native(() => extractCurveInterval(plan.span.curve, roles), context + ': actual local Bezier bracket restriction failed');
        nativeSplitCount += extraction.provenance.operations.length;
        hull = extraction.curve.controlPoints; weights = extraction.curve.weights;
      } else {
        hull = [native(() => evaluateCurve(intersection.curve, plan.interval[0]), context + ': actual original singleton D0 failed')]; weights = [1];
      }
      return { spanId: plan.span.spanId, spanIndex: plan.span.spanIndex, contributionEventId: plan.contribution.event.eventId,
        interval: plan.interval, extraction, ...hullProof(hull, weights, face, axes, context) };
    });
    check(brackets.length > 0 && brackets.every(bracket => same(bracket.decision, brackets[0].decision)), CODE.UNCERTAINTY,
      'Event ' + event.eventId + ': complete contribution hull decisions disagree');
    classificationCount++;
    const faceClassification = native(() => classifyConvexPlanarFaceWithHolesUV(face, [event.planeUV[0], event.planeUV[1]]),
      'Event ' + event.eventId + ': actual Face classifier failed after whole-hull proof');
    const decision = brackets[0].decision;
    const boundaryContributors = faceClassification.boundaries.map(boundary => ({ loopId: boundary.loopId, loopRole: boundary.loopRole,
      edgeId: boundary.edgeId, curveId: boundary.curveId, useId: boundary.useId, pcurveId: boundary.pcurveId }));
    check(decision.classification === faceClassification.classification && decision.material === faceClassification.material
      && decision.holeId === faceClassification.holeId && same(decision.boundaryContributors, boundaryContributors), CODE.BINDING,
    'Event ' + event.eventId + ': actual classifier disagrees with complete contribution hull decisions');
    classificationCounts[faceClassification.classification]++;
    return { eventId: event.eventId, parameter: event.parameter, classification: faceClassification.classification,
      material: faceClassification.material, faceClassification, brackets };
  });
  const report: CurvePlanarFaceMaterialReport = { schema: 'barocss-curve-planar-face-material', version: 0, lengthUnit: 'mm', frame: 'authored-xyz-mm-native-uv-dimensionless',
    curveId: intersection.curve.id, faceId: face.options.faceId, planeId: face.plane.id, evaluationId: options.evaluationId,
    parentFamily: intersection.report.family, parentEvaluationId: intersection.options.evaluationId, curveDegree: curve.degree,
    spanCount: intersection.report.spanCount, parentMaximumContributions: intersection.report.limits.maximumContributions,
    rootEventCount: intersection.events.length, contributionCount, nonSingletonContributionCount, bracketRestrictionCount, nativeSplitCount, classificationCount,
    classificationCounts, transversality, identities: { nativeObjectIds: face.model.objects.map(object => object.id), loopIds: face.topology.loops.map(loop => loop.id),
      pcurveIds: face.pcurves.map(pcurve => pcurve.id), useIds: face.topology.loops.flatMap(loop => loop.uses.map(use => use.id)) },
    numericPolicy: { hullGuardFactor: 512, transversalityGuardFactor: 64, inheritedExtractionBindingMM: 1e-7,
      evidence: 'local-constructed-positive-control-hulls-not-original-global-binary64-enclosures',
      boundary: 'exact-singleton-or-identically-zero-applicable-whole-hull-halfspace', projection: 'orthogonal-affine-native-uv-not-coplanarity-of-bracket-points' },
    workPolicy: { rootWorkBeforeTrimAdmission: true, completeTrimAdmissionBeforeExtractionOrClassification: true,
      counters: 'direct-operation-calls-not-internal-validator-work', failure: 'atomic-no-partial-result' },
    sourceOwnership: 'separate-original-face-parent-curve-plane-and-interval-source0-models-independent-cpu-data',
    limits: { maximumCurvePoles: 64, maximumKnots: 70, maximumDegree: 3, maximumContributions: 192,
      maximumBracketRestrictions: options.maximumBracketRestrictions, maximumClassifications: options.maximumClassifications,
      maximumFaceLines: 15, maximumFaceSourceObjects: 16, coordinateAbsMM: 10000, ownedValues: 1048576, ownedDepth: 64,
      arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144 } };
  return snapshot({ curve: intersection.curve, face, options, intersection, events, report }, CODE.BUDGET) as CurvePlanarFaceMaterialResult;
}

/** Rebuild the complete actual public operation and compare every owned occurrence and bit. */
export function validateCurvePlanarFaceMaterialIntersection(input: CurvePlanarFaceMaterialResult): CurvePlanarFaceMaterialReport {
  const owned = record(snapshot(input, CODE.OWNED), ['curve', 'face', 'options', 'intersection', 'events', 'report'], CODE.OWNED) as unknown as CurvePlanarFaceMaterialResult;
  let expected: CurvePlanarFaceMaterialResult;
  try { expected = intersectCurveWithPlanarFaceMaterial(owned.curve, owned.face, owned.options); } catch (cause) {
    throw new CurvePlanarFaceMaterialError(CODE.OWNED, 'Whole owned operation rebuild failed', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'Owned source, Face, roots, brackets, hulls, contributors, counters, or result bits changed');
  return copyCadData(expected.report);
}
