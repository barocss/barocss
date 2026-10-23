import { validateCurve, curveDomain, evaluateCurve } from '../../math.js';
import { evaluateCurveD1 } from '../../derivatives.js';
import type { CurveD1Result } from '../../derivatives.js';
import { compileCurveSource, requireCurveValue } from './curve-source.js';
import { copyCadData } from '../../data-copy.js';
import type { Curve, Model, Point } from '../../types.js';
import { same as sameData } from '../../structural-equality.js';

export interface BezierCurveDegreeElevationOptions { targetDegree: 2 | 3 }
export interface BezierCurveElevatedInteriorPole {
  elevatedPoleIndex: number; leftOriginalPoleIndex: number; rightOriginalPoleIndex: number; alpha: number;
  leftHomogeneous: [number, number, number, number]; rightHomogeneous: [number, number, number, number];
  leftContribution: [number, number, number, number]; rightContribution: [number, number, number, number];
  homogeneous: [number, number, number, number]; pointMM: Point; weight: number;
}
export interface BezierCurveElevationKnot {
  elevatedKnotIndex: number; originalKnotIndex: number | null; value: number; origin: 'original-copy' | 'start-clamp' | 'end-clamp';
}
export interface BezierCurveDegreeElevationProvenance {
  kind: 'one-step-rational-bezier-degree-elevation'; curveId: string; originalDegree: number; targetDegree: 2 | 3;
  endpoints: { originalPoleIndex: number; elevatedPoleIndex: number; pointMM: Point; weight: number }[];
  interior: BezierCurveElevatedInteriorPole[]; knots: BezierCurveElevationKnot[];
}
export type BezierCurveDegreeD1Evaluation = { kind: 'evaluated'; result: CurveD1Result } | { kind: 'refused'; message: string };
export interface BezierCurveDegreeD1Observation { parameter: number; original: BezierCurveDegreeD1Evaluation; elevated: BezierCurveDegreeD1Evaluation }
export interface BezierCurveDegreeElevationReport {
  kind: 'bezier-curve-degree-elevation'; curveId: string; lengthUnit: 'mm'; originalDegree: number; targetDegree: 2 | 3;
  originalPoleCount: number; elevatedPoleCount: number; domain: [number, number]; representedSpan: number; endpointBitsRetained: true;
  observations: { parameter: number; originalPointMM: Point; elevatedPointMM: Point; differenceMM: number }[];
  maximumObservedDifferenceMM: number; derivativeObservations: BezierCurveDegreeD1Observation[]; derivativeSemantics: 'native-arithmetic-refusals-retained';
  authority: 'original-single-span-bezier-coefficients'; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { maximumOriginalDegree: 2; maximumTargetDegree: 3; maximumElevationsPerCall: 1; maximumElevatedPoles: 4;
    authoredIdCharacters: 48; snapshotValues: 1024; snapshotDepth: 6; arrayElements: 64; recordFields: 8; stringCharacters: 128;
    maximumObservations: 5; maximumDerivativeObservations: 3; observationComparisonMM: 1e-7 };
}
export interface BezierCurveDegreeElevationResult {
  original: Curve; elevated: Curve; source: string; sourceVersion: 0; model: Model;
  provenance: BezierCurveDegreeElevationProvenance; report: BezierCurveDegreeElevationReport;
}
const LABEL = 'Bezier Curve degree elevation';
function check(condition: boolean, detail: string): asserts condition { requireCurveValue(condition, detail, LABEL); }
function snapshot(input: unknown): unknown {
  let remaining = 1024;
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 6, 'input exceeds1024 own values/depth6');
    if (typeof value === 'number') { check(Number.isFinite(value), 'finite numeric data required'); return value; }
    if (typeof value === 'string') { check(value.length <= 128, 'string exceeds128'); return value; }
    check(value !== null && typeof value === 'object', 'plain numeric/string/record data required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'foreign prototype unsupported');
    check(keys.length <= (array ? 65 : 8), 'own field bound exceeded');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable)), 'getters, symbols or hidden fields unsupported');
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 64 && keys.length === length + 1, 'bounded dense arrays required');
      const result: unknown[] = [];
      for (let i = 0; i < length; i++) { check(Object.hasOwn(descriptors, String(i)), 'sparse/extra array field'); result.push(copy(descriptors[String(i)].value, depth + 1)); }
      return result;
    }
    return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
  };
  return copy(input, 0);
}
function record(input: unknown, fields: string[]): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), 'record required');
  const value = input as Record<string, unknown>; check(Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key)), 'exact fields required: ' + fields.join(',')); return value;
}
function id(input: unknown): string { check(typeof input === 'string' && input.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(input), 'ASCII ID1..48 required'); return input; }

function finite(n: number): number { check(Number.isFinite(n), 'finite homogeneous coefficient arithmetic required'); return n; }
function derivative(curve: Curve, parameter: number): BezierCurveDegreeD1Evaluation {
  try { return { kind: 'evaluated', result: evaluateCurveD1(curve, parameter) }; }
  catch (error) { return { kind: 'refused', message: (error instanceof Error ? error.message : 'native D1 refused').slice(0, 512) }; }
}
/** One-step homogeneous Bernstein elevation of an original rational Bezier Curve. */
export function elevateBezierCurveDegree(input: Curve, options: BezierCurveDegreeElevationOptions): BezierCurveDegreeElevationResult {
  try {
    const originalData = snapshot(input), optionData = snapshot(options), data = record(originalData, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']), settings = record(optionData, ['targetDegree']);
    check(data.kind === 'curve', 'original Curve required'); id(data.id);
    check(data.degree === 1 || data.degree === 2, 'original Bezier degree must be 1 or 2');
    const original = data as unknown as Curve; validateCurve(original);
    check(original.controlPoints.length === original.degree + 1 && original.knots.length === 2 * (original.degree + 1), 'original single-span Bezier coefficients required; multi-span elevation unsupported');
    check(original.controlPoints.every(p => p.every(n => Math.abs(n) <= 10000)), 'original XYZ within +/-10000 mm required');
    const targetDegree = settings.targetDegree;
    check((targetDegree === 2 || targetDegree === 3) && targetDegree === original.degree + 1, 'explicit one-step target degree 1->2 or 2->3 required');
    const domain = curveDomain(original), span = domain[1] - domain[0], p = original.degree;
    check(Number.isFinite(span) && span > 0, 'finite positive represented original span required');
    check(original.knots.slice(0, p + 1).every(k => k === domain[0]) && original.knots.slice(p + 1).every(k => k === domain[1]), 'single original clamped span required');
    const lifted = original.controlPoints.map((point, i) => [...point.map(n => finite(n * original.weights[i])), original.weights[i]] as [number, number, number, number]);
    const interior: BezierCurveElevatedInteriorPole[] = Array.from({ length: p }, (_, offset) => {
      const i = offset + 1, alpha = i / targetDegree, leftHomogeneous = lifted[i - 1], rightHomogeneous = lifted[i];
      const leftContribution = leftHomogeneous.map(n => finite(alpha * n)) as [number, number, number, number];
      const rightContribution = rightHomogeneous.map(n => finite((1 - alpha) * n)) as [number, number, number, number];
      const homogeneous = leftContribution.map((n, axis) => finite(n + rightContribution[axis])) as [number, number, number, number], weight = homogeneous[3];
      check(weight > 0, 'positive elevated homogeneous denominator required');
      const pointMM: Point = [finite(homogeneous[0] / weight), finite(homogeneous[1] / weight), finite(homogeneous[2] / weight)];
      return { elevatedPoleIndex: i, leftOriginalPoleIndex: i - 1, rightOriginalPoleIndex: i, alpha, leftHomogeneous, rightHomogeneous, leftContribution, rightContribution, homogeneous, pointMM, weight };
    });
    const knots: BezierCurveElevationKnot[] = [
      ...original.knots.slice(0, p + 1).map((value, i): BezierCurveElevationKnot => ({ elevatedKnotIndex: i, originalKnotIndex: i, value, origin: 'original-copy' })),
      { elevatedKnotIndex: p + 1, originalKnotIndex: null, value: domain[0], origin: 'start-clamp' },
      { elevatedKnotIndex: p + 2, originalKnotIndex: null, value: domain[1], origin: 'end-clamp' },
      ...original.knots.slice(p + 1).map((value, i): BezierCurveElevationKnot => ({ elevatedKnotIndex: p + 3 + i, originalKnotIndex: p + 1 + i, value, origin: 'original-copy' })),
    ];
    const candidate: Curve = { kind: 'curve', id: original.id, degree: targetDegree, knots: knots.map(k => k.value),
      controlPoints: [copyCadData(original.controlPoints[0]), ...interior.map(x => x.pointMM), copyCadData(original.controlPoints[p])],
      weights: [original.weights[0], ...interior.map(x => x.weight), original.weights[p]] };
    validateCurve(candidate);
    check(candidate.controlPoints.length === targetDegree + 1 && candidate.controlPoints.every(point => point.every(n => Math.abs(n) <= 10000)), 'complete elevated Bezier coefficient admission required');
    check(sameData(curveDomain(candidate), domain), 'original parameter domain bits must remain');
    const compiled = compileCurveSource(candidate.id, candidate.degree, candidate.controlPoints, candidate.knots, candidate.weights, LABEL);
    const expected: Model = { name: 'profile', version: 0, lengthUnit: 'mm', objects: [candidate] };
    check(sameData(compiled.model, expected), 'actual source0 must preserve complete Model/ID/degree/knot/pole/weight bits');
    const elevated = compiled.curve;
    check(sameData(curveDomain(elevated), domain), 'compiled original domain bits must remain');
    const endpoints = [{ originalPoleIndex: 0, elevatedPoleIndex: 0, pointMM: copyCadData(original.controlPoints[0]), weight: original.weights[0] },
      { originalPoleIndex: p, elevatedPoleIndex: targetDegree, pointMM: copyCadData(original.controlPoints[p]), weight: original.weights[p] }];
    for (const m of endpoints) check(sameData(elevated.controlPoints[m.elevatedPoleIndex], original.controlPoints[m.originalPoleIndex]) && Object.is(elevated.weights[m.elevatedPoleIndex], original.weights[m.originalPoleIndex]), 'direct endpoint pole/weight bits must remain');
    for (const m of knots) check(Object.is(elevated.knots[m.elevatedKnotIndex], m.originalKnotIndex === null ? m.origin === 'start-clamp' ? domain[0] : domain[1] : original.knots[m.originalKnotIndex]), 'original retained knots and actual domain clamp bits must remain');
    const interiors = [0.25, 0.5, 0.75].map(f => domain[0] + span * f).filter((n, i, values) => n > domain[0] && n < domain[1] && values.indexOf(n) === i);
    const parameters = [domain[0], ...interiors, domain[1]];
    const observations = parameters.map(parameter => {
      const originalPointMM = evaluateCurve(original, parameter), elevatedPointMM = evaluateCurve(elevated, parameter), differenceMM = Math.hypot(...elevatedPointMM.map((n, i) => n - originalPointMM[i]));
      check(Number.isFinite(differenceMM) && differenceMM <= 1e-7, 'local original/elevated point observation exceeds 1e-7 mm');
      return { parameter, originalPointMM, elevatedPointMM, differenceMM };
    });
    const middle = interiors.find(n => n === domain[0] + span / 2) ?? interiors[0];
    const derivativeObservations = [domain[0], ...(middle === undefined ? [] : [middle]), domain[1]].map(parameter => ({ parameter, original: derivative(original, parameter), elevated: derivative(elevated, parameter) }));
    return copyCadData({ original, elevated, source: compiled.source, sourceVersion: 0, model: compiled.model,
      provenance: { kind: 'one-step-rational-bezier-degree-elevation', curveId: original.id, originalDegree: p, targetDegree, endpoints, interior, knots },
      report: { kind: 'bezier-curve-degree-elevation', curveId: original.id, lengthUnit: 'mm', originalDegree: p, targetDegree, originalPoleCount: original.controlPoints.length, elevatedPoleCount: elevated.controlPoints.length,
        domain, representedSpan: span, endpointBitsRetained: true, observations, maximumObservedDifferenceMM: Math.max(...observations.map(o => o.differenceMM)), derivativeObservations, derivativeSemantics: 'native-arithmetic-refusals-retained',
        authority: 'original-single-span-bezier-coefficients', geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        limits: { maximumOriginalDegree: 2, maximumTargetDegree: 3, maximumElevationsPerCall: 1, maximumElevatedPoles: 4, authoredIdCharacters: 48, snapshotValues: 1024, snapshotDepth: 6, arrayElements: 64, recordFields: 8, stringCharacters: 128, maximumObservations: 5, maximumDerivativeObservations: 3, observationComparisonMM: 1e-7 } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid original Bezier Curve/target degree';
    throw new Error((message.startsWith(LABEL) ? message : LABEL + ': ' + message).slice(0, 1024), { cause: error });
  }
}
