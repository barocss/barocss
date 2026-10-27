import { curveDomain, evaluateCurve, validateCurve } from '../../core/math.js';
import { evaluateCurveD1 } from '../../core/derivatives.js';
import type { CurveD1Result } from '../../core/derivatives.js';
import { elevateBezierCurveDegree } from '../curves/bezier-curve-degree-elevation.js';
import type { BezierCurveDegreeElevationResult, BezierCurveDegreeElevationProvenance } from '../curves/bezier-curve-degree-elevation.js';
import { buildRationalRuledSurface } from './rational-ruled-surface.js';
import type { RationalRuledSurfaceResult, RationalRuledSurfaceReport } from './rational-ruled-surface.js';
import { requireCurveValue } from '../curves/curve-source.js';
import { copyCadData } from '../../data-copy.js';
import type { Curve, Surface, Model, Point } from '../../types.js';
import { same as sameData } from '../../core/structural-equality.js';

export interface DegreeMatchedBezierRuledOptions { surfaceId: string; targetDegree: 2 | 3 }
export interface DegreeMatchedBezierSectionProvenance {
  curveId: string; mode: 'direct-copy' | 'degree-elevation'; originalDomain: [number, number]; matchedDomain: [number, number];
  endpoints: { originalPoleIndex: number; matchedPoleIndex: number }[];
  retainedKnots: { originalKnotIndex: number; matchedKnotIndex: number; value: number }[];
  elevations: BezierCurveDegreeElevationProvenance[];
}
export interface DegreeMatchedBezierRuledProvenance {
  kind: 'explicit-degree-matched-bezier-ruled'; surfaceId: string; targetDegree: 2 | 3;
  first: DegreeMatchedBezierSectionProvenance; second: DegreeMatchedBezierSectionProvenance;
}
export type DegreeMatchedBezierPointObservation = { kind: 'evaluated'; parameter: number; originalPointMM: Point; matchedPointMM: Point; differenceMM: number } | { kind: 'refused'; parameter: number; message: string };
export type DegreeMatchedBezierD1Evaluation = { kind: 'evaluated'; result: CurveD1Result } | { kind: 'refused'; message: string };
export interface DegreeMatchedBezierD1Observation { parameter: number; original: DegreeMatchedBezierD1Evaluation; matched: DegreeMatchedBezierD1Evaluation }
export interface DegreeMatchedBezierSectionReport {
  curveId: string; originalDegree: number; matchedDegree: 2 | 3; originalPoleCount: number; matchedPoleCount: number; stepCount: number;
  domains: { original: [number, number]; matched: [number, number] }; endpointBitsRetained: true;
  observations: DegreeMatchedBezierPointObservation[]; maximumObservedDifferenceMM: number | null; derivativeObservations: DegreeMatchedBezierD1Observation[];
}
export interface DegreeMatchedBezierRuledReport {
  kind: 'degree-matched-bezier-ruled'; surfaceId: string; lengthUnit: 'mm'; targetDegree: 2 | 3;
  first: DegreeMatchedBezierSectionReport; second: DegreeMatchedBezierSectionReport; totalElevationSteps: number;
  ruled: RationalRuledSurfaceReport; parameterMeaning: 'denominator-weighted-section-interpolation'; authority: 'original-bezier-sections-with-explicit-degree-matching';
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { maximumOriginalDegree: 3; maximumTargetDegree: 3; maximumOriginalPoles: 4; maximumElevationStepsPerSection: 2;
    authoredIdCharacters: 48; snapshotValues: 1024; snapshotDepth: 6; arrayElements: 64; recordFields: 8; stringCharacters: 128;
    maximumPointObservationsPerSection: 5; maximumDerivativeObservationsPerSection: 3; observationComparisonMM: 1e-7 };
}
export interface DegreeMatchedBezierRuledResult {
  originalFirst: Curve; originalSecond: Curve; matchedFirst: Curve; matchedSecond: Curve;
  steps: { first: BezierCurveDegreeElevationResult[]; second: BezierCurveDegreeElevationResult[] };
  ruled: RationalRuledSurfaceResult; surface: Surface; source: string; sourceVersion: 0; model: Model;
  provenance: DegreeMatchedBezierRuledProvenance; report: DegreeMatchedBezierRuledReport;
}
const LABEL = 'Degree-matched Bezier ruled Surface';
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
function admitCurve(input: unknown): Curve {
  const data = record(input, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']);
  check(data.kind === 'curve', 'original Curve required'); id(data.id);
  check(typeof data.degree === 'number' && Number.isInteger(data.degree) && data.degree >= 1 && data.degree <= 3, 'section degree1..3 required');
  check(Array.isArray(data.controlPoints) && data.controlPoints.length >= 2 && data.controlPoints.length <= 16, 'section poles2..16 required');
  const curve = data as unknown as Curve; validateCurve(curve);
  check(curve.controlPoints.every(p => p.every(n => Math.abs(n) <= 10000)), 'section XYZ coordinates must stay within±10000mm');
  return curve;
}


function admitBezier(input: unknown): Curve {
  const curve = admitCurve(input), domain = curveDomain(curve), span = domain[1] - domain[0];
  check(curve.controlPoints.length === curve.degree + 1 && curve.knots.length === 2 * (curve.degree + 1), 'original single-span Bezier sections required');
  check(Number.isFinite(span) && span > 0 && curve.knots.slice(0, curve.degree + 1).every(k => k === domain[0]) && curve.knots.slice(curve.degree + 1).every(k => k === domain[1]), 'finite positive represented original clamped span required');
  return curve;
}
function match(original: Curve, targetDegree: 2 | 3): { curve: Curve; steps: BezierCurveDegreeElevationResult[] } {
  let curve = copyCadData(original); const steps: BezierCurveDegreeElevationResult[] = [];
  while (curve.degree < targetDegree) {
    check(steps.length < 2, 'at most two actual elevation steps per section');
    const next = curve.degree + 1; check(next === 2 || next === 3, 'one-step Bezier elevation only');
    const step = elevateBezierCurveDegree(curve, { targetDegree: next });
    check(step.elevated.degree === next && step.elevated.id === original.id && sameData(curveDomain(step.elevated), curveDomain(original)), 'actual elevation must retain original ID/domain and explicit step');
    steps.push(step); curve = step.elevated;
  }
  check(curve.degree === targetDegree && curve.controlPoints.length === targetDegree + 1, 'explicit target matching required');
  return { curve, steps };
}
function sectionProvenance(original: Curve, matched: Curve, steps: BezierCurveDegreeElevationResult[]): DegreeMatchedBezierSectionProvenance {
  let retainedKnots = original.knots.map((value, i) => ({ originalKnotIndex: i, matchedKnotIndex: i, value }));
  for (const step of steps) retainedKnots = retainedKnots.map(m => {
    const entry = step.provenance.knots.find(k => k.originalKnotIndex === m.matchedKnotIndex);
    check(entry !== undefined && Object.is(entry.value, m.value), 'actual step retained knot mapping required');
    return { ...m, matchedKnotIndex: entry.elevatedKnotIndex };
  });
  for (const m of retainedKnots) check(Object.is(matched.knots[m.matchedKnotIndex], original.knots[m.originalKnotIndex]), 'original knot bits must remain through actual steps');
  const endpoints = [{ originalPoleIndex: 0, matchedPoleIndex: 0 }, { originalPoleIndex: original.controlPoints.length - 1, matchedPoleIndex: matched.controlPoints.length - 1 }];
  for (const m of endpoints) check(sameData(original.controlPoints[m.originalPoleIndex], matched.controlPoints[m.matchedPoleIndex]) && Object.is(original.weights[m.originalPoleIndex], matched.weights[m.matchedPoleIndex]), 'original endpoint pole/weight bits must remain');
  if (steps.length === 0) check(sameData(original, matched), 'already-target section must remain complete unchanged owned data');
  return { curveId: original.id, mode: steps.length === 0 ? 'direct-copy' : 'degree-elevation', originalDomain: curveDomain(original), matchedDomain: curveDomain(matched), endpoints, retainedKnots, elevations: steps.map(step => step.provenance) };
}
function detail(error: unknown): string { return (error instanceof Error ? error.message : 'native section observation refused').slice(0, 512); }
function derivative(curve: Curve, parameter: number): DegreeMatchedBezierD1Evaluation {
  try { return { kind: 'evaluated', result: evaluateCurveD1(curve, parameter) }; } catch (error) { return { kind: 'refused', message: detail(error) }; }
}
function sectionReport(original: Curve, matched: Curve, stepCount: number, targetDegree: 2 | 3): DegreeMatchedBezierSectionReport {
  const domain = curveDomain(original), span = domain[1] - domain[0];
  const interiors = [0.25, 0.5, 0.75].map(f => domain[0] + span * f).filter((n, i, values) => n > domain[0] && n < domain[1] && values.indexOf(n) === i);
  const parameters = [domain[0], ...interiors, domain[1]];
  const observations: DegreeMatchedBezierPointObservation[] = parameters.map(parameter => {
    try {
      const originalPointMM = evaluateCurve(original, parameter), matchedPointMM = evaluateCurve(matched, parameter), differenceMM = Math.hypot(...matchedPointMM.map((n, i) => n - originalPointMM[i]));
      check(Number.isFinite(differenceMM), 'finite section point comparison required');
      return { kind: 'evaluated', parameter, originalPointMM, matchedPointMM, differenceMM };
    } catch (error) { return { kind: 'refused', parameter, message: detail(error) }; }
  });
  const evaluated = observations.filter((o): o is Extract<DegreeMatchedBezierPointObservation, { kind: 'evaluated' }> => o.kind === 'evaluated');
  for (const o of evaluated) check(o.differenceMM <= 1e-7, 'local original/matched section point observation exceeds 1e-7 mm');
  const middle = interiors.find(n => n === domain[0] + span / 2) ?? interiors[0];
  const derivativeObservations = [domain[0], ...(middle === undefined ? [] : [middle]), domain[1]].map(parameter => ({ parameter, original: derivative(original, parameter), matched: derivative(matched, parameter) }));
  return { curveId: original.id, originalDegree: original.degree, matchedDegree: targetDegree, originalPoleCount: original.controlPoints.length, matchedPoleCount: matched.controlPoints.length, stepCount,
    domains: { original: domain, matched: curveDomain(matched) }, endpointBitsRetained: true, observations, maximumObservedDifferenceMM: evaluated.length === 0 ? null : Math.max(...evaluated.map(o => o.differenceMM)), derivativeObservations };
}
/** Explicit original Bezier section matching through actual one-step and ruled operations. */
export function buildDegreeMatchedBezierRuledSurface(firstInput: Curve, secondInput: Curve, options: DegreeMatchedBezierRuledOptions): DegreeMatchedBezierRuledResult {
  try {
    const firstData = snapshot(firstInput), secondData = snapshot(secondInput), optionData = snapshot(options);
    const originalFirst = admitBezier(firstData), originalSecond = admitBezier(secondData), settings = record(optionData, ['surfaceId', 'targetDegree']);
    const surfaceId = id(settings.surfaceId), targetDegree = settings.targetDegree;
    check(new Set([originalFirst.id, originalSecond.id, surfaceId]).size === 3, 'original sections and Surface IDs must differ');
    check((targetDegree === 2 || targetDegree === 3) && targetDegree >= originalFirst.degree && targetDegree >= originalSecond.degree, 'explicit target 2 or 3 must be at least both original degrees');
    check(sameData(curveDomain(originalFirst), curveDomain(originalSecond)), 'original domain endpoint bits must agree');
    const first = match(originalFirst, targetDegree), second = match(originalSecond, targetDegree);
    // Actual630 remains the final knot-basis/source authority, including mixed-zero refusals.
    const ruled = buildRationalRuledSurface(first.curve, second.curve, { surfaceId });
    check(sameData(ruled.first, first.curve) && sameData(ruled.second, second.curve), 'actual ruled adoption must retain complete matched section coefficients');
    const matchedFirst = ruled.first, matchedSecond = ruled.second;
    const firstProvenance = sectionProvenance(originalFirst, matchedFirst, first.steps), secondProvenance = sectionProvenance(originalSecond, matchedSecond, second.steps);
    return copyCadData({ originalFirst, originalSecond, matchedFirst, matchedSecond, steps: { first: first.steps, second: second.steps }, ruled,
      surface: ruled.surface, source: ruled.source, sourceVersion: 0, model: ruled.model,
      provenance: { kind: 'explicit-degree-matched-bezier-ruled', surfaceId, targetDegree, first: firstProvenance, second: secondProvenance },
      report: { kind: 'degree-matched-bezier-ruled', surfaceId, lengthUnit: 'mm', targetDegree,
        first: sectionReport(originalFirst, matchedFirst, first.steps.length, targetDegree), second: sectionReport(originalSecond, matchedSecond, second.steps.length, targetDegree), totalElevationSteps: first.steps.length + second.steps.length,
        ruled: ruled.report, parameterMeaning: 'denominator-weighted-section-interpolation', authority: 'original-bezier-sections-with-explicit-degree-matching', geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        limits: { maximumOriginalDegree: 3, maximumTargetDegree: 3, maximumOriginalPoles: 4, maximumElevationStepsPerSection: 2, authoredIdCharacters: 48, snapshotValues: 1024, snapshotDepth: 6, arrayElements: 64, recordFields: 8, stringCharacters: 128, maximumPointObservationsPerSection: 5, maximumDerivativeObservationsPerSection: 3, observationComparisonMM: 1e-7 } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid original Bezier sections/explicit target';
    throw new Error((message.startsWith(LABEL) ? message : LABEL + ': ' + message).slice(0, 1024), { cause: error });
  }
}
