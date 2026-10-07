import { validateCurve, curveDomain, evaluateCurve } from './math.js';
import { compileCurveSource, requireCurveValue } from './curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Model, Point } from './types.js';

export interface CurveKnotInsertionOptions { knot: number; insertions: number }
export interface CurveKnotUnchangedPole { originalPoleIndex: number; refinedPoleIndex: number }
export interface CurveKnotUnchangedKnot { originalKnotIndex: number; refinedKnotIndex: number }
export interface CurveKnotInsertionStep {
  insertion: number; spanIndex: number; priorMultiplicity: number;
  generatedPoles: { refinedPoleIndex: number; leftPriorPoleIndex: number; rightPriorPoleIndex: number; alpha: number }[];
}
export interface CurveKnotInsertionProvenance {
  kind: 'homogeneous-curve-knot-insertion'; curveId: string; degree: number; knot: number; insertions: number;
  unchangedPoles: CurveKnotUnchangedPole[]; unchangedKnots: CurveKnotUnchangedKnot[]; steps: CurveKnotInsertionStep[];
}
export interface CurveKnotInsertionReport {
  kind: 'curve-knot-insertion'; curveId: string; knot: number; insertions: number; degree: number; domain: [number, number];
  originalPoleCount: number; refinedPoleCount: number; originalMultiplicity: number; refinedMultiplicity: number;
  observations: { parameter: number; originalPointMM: Point; refinedPointMM: Point; differenceMM: number }[];
  maximumObservedDifferenceMM: number; guardedKnots: { original: number[]; refined: number[] };
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { maximumPoles: 16; maximumDegree: 3; maximumInsertions: 3; authoredIdCharacters: 48; snapshotValues: 1024; snapshotDepth: 6; arrayElements: 64; recordFields: 8; stringCharacters: 128; observationComparisonMM: 1e-7 };
}
export interface CurveKnotInsertionResult { original: Curve; refined: Curve; source: string; sourceVersion: 0; model: Model; provenance: CurveKnotInsertionProvenance; report: CurveKnotInsertionReport }
const LABEL = 'Curve knot insertion';
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
function sameData(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => sameData(value, b[i]));
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => Object.hasOwn(right, key) && sameData(left[key], right[key]));
  }
  return Object.is(a, b);
}
function samples(curve: Curve): number[] {
  const [min, max] = curveDomain(curve), values = new Set<number>([min, max]);
  const breaks = [...new Set(curve.knots)].filter(k => k >= min && k <= max);
  for (let i = 0; i < breaks.length; i++) {
    values.add(breaks[i]);
    if (i + 1 < breaks.length) {
      const a = breaks[i], b = breaks[i + 1], delta = b - a, mid = Number.isFinite(delta) ? a + delta / 2 : a / 2 + b / 2;
      // Adjacent binary64 knots may have no representable interior sample.
      if (mid > a && mid < b) values.add(mid);
    }
  }
  return [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}
function guardKnots(knots: number[], degree: number, min: number, max: number): number[] {
  return [...new Set(knots)].filter(k => k > min && k < max && knots.filter(x => x === k).length >= degree);
}
type HomogeneousPoint = [number, number, number, number];
interface Pole { h: HomogeneousPoint; originalIndex: number | null }
/** Local homogeneous convex knot insertion; original evaluator remains authority. */
export function insertCurveKnot(input: Curve, options: CurveKnotInsertionOptions): CurveKnotInsertionResult {
  try {
    const originalData = snapshot(input), optionData = snapshot(options);
    const data = record(originalData, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']), settings = record(optionData, ['knot', 'insertions']);
    check(data.kind === 'curve', 'original Curve required'); id(data.id);
    check(typeof data.degree === 'number' && Number.isInteger(data.degree) && data.degree >= 1 && data.degree <= 3, 'degree1..3 required');
    check(Array.isArray(data.controlPoints) && data.controlPoints.length >= 2 && data.controlPoints.length <= 16, 'initial poles2..16 required');
    const original = data as unknown as Curve; validateCurve(original);
    check(original.controlPoints.every(p => p.every(n => Math.abs(n) <= 10000)), 'original XYZ coordinates within±10000mm required');
    const domain = curveDomain(original), knot = settings.knot, insertions = settings.insertions;
    check(typeof knot === 'number' && Number.isFinite(knot) && knot > domain[0] && knot < domain[1], 'finite strictly interior knot in original units required');
    check(typeof insertions === 'number' && Number.isInteger(insertions) && insertions >= 1 && insertions <= 3, 'explicit integer insertion count1..3 required');
    const originalMultiplicity = original.knots.filter(k => k === knot).length;
    check(originalMultiplicity + insertions <= original.degree, 'final numeric knot multiplicity must not exceed degree');
    check(original.controlPoints.length + insertions <= 16, 'final pole count must not exceed16');
    let poles: Pole[] = original.controlPoints.map((p, i) => ({ originalIndex: i, h: [p[0] * original.weights[i], p[1] * original.weights[i], p[2] * original.weights[i], original.weights[i]] }));
    let knots = original.knots.map((value, i) => ({ value, originalIndex: i as number | null }));
    const steps: CurveKnotInsertionStep[] = [];
    for (let insertion = 0; insertion < insertions; insertion++) {
      const p = original.degree, n = poles.length - 1, values = knots.map(k => k.value), s = values.filter(k => k === knot).length;
      let span = -1;
      for (let i = p; i <= n; i++) if (values[i] <= knot && knot < values[i + 1]) span = i;
      check(span >= p, 'actual original knot span required');
      const next: Pole[] = Array(poles.length + 1), generatedPoles: CurveKnotInsertionStep['generatedPoles'] = [];
      // Copy unchanged original entries without homogeneous reprojection.
      for (let i = 0; i <= span - p; i++) next[i] = poles[i];
      for (let i = span - s; i <= n; i++) next[i + 1] = poles[i];
      for (let i = span - p + 1; i <= span - s; i++) {
        const denominator = values[i + p] - values[i], numerator = knot - values[i];
        check(Number.isFinite(denominator) && denominator > 0 && Number.isFinite(numerator) && numerator > 0 && numerator < denominator, 'insertion span/denominator is not safely representable');
        const alpha = numerator / denominator;
        check(Number.isFinite(alpha) && alpha > 0 && alpha < 1, 'strict convex insertion coefficient is not representable');
        const left = poles[i - 1].h, right = poles[i].h;
        const h = right.map((value, axis) => alpha * value + (1 - alpha) * left[axis]) as HomogeneousPoint;
        check(h.every(Number.isFinite) && h[3] > 0, 'generated homogeneous coefficients must be finite with positive weight');
        next[i] = { h, originalIndex: null }; generatedPoles.push({ refinedPoleIndex: i, leftPriorPoleIndex: i - 1, rightPriorPoleIndex: i, alpha });
      }
      check(Array.from(next).every(entry => entry !== undefined), 'complete local insertion control polygon required');
      poles = next; knots = [...knots.slice(0, span + 1), { value: knot, originalIndex: null }, ...knots.slice(span + 1)];
      steps.push({ insertion: insertion + 1, spanIndex: span, priorMultiplicity: s, generatedPoles });
    }
    const candidate: Curve = { kind: 'curve', id: original.id, degree: original.degree, knots: knots.map(k => k.value),
      controlPoints: poles.map(entry => entry.originalIndex !== null ? copyCadData(original.controlPoints[entry.originalIndex]) : [entry.h[0] / entry.h[3], entry.h[1] / entry.h[3], entry.h[2] / entry.h[3]] as Point),
      weights: poles.map(entry => entry.originalIndex !== null ? original.weights[entry.originalIndex] : entry.h[3]) };
    check(candidate.controlPoints.every(p => p.every(n => Number.isFinite(n) && Math.abs(n) <= 10000)), 'generated Cartesian coefficients exceed native family range');
    validateCurve(candidate); check(sameData(curveDomain(candidate), domain), 'original parameter endpoint bits must remain');
    const compiled = compileCurveSource(candidate.id, candidate.degree, candidate.controlPoints, candidate.knots, candidate.weights, LABEL), refined = compiled.curve;
    check(sameData(refined, candidate), 'actual refined source0 must preserve complete native coefficients/ID/order/domain bits');
    const unchangedPoles = poles.flatMap((entry, i) => entry.originalIndex === null ? [] : [{ originalPoleIndex: entry.originalIndex, refinedPoleIndex: i }]);
    const unchangedKnots = knots.flatMap((entry, i) => entry.originalIndex === null ? [] : [{ originalKnotIndex: entry.originalIndex, refinedKnotIndex: i }]);
    for (const m of unchangedPoles) check(sameData(original.controlPoints[m.originalPoleIndex], refined.controlPoints[m.refinedPoleIndex]) && Object.is(original.weights[m.originalPoleIndex], refined.weights[m.refinedPoleIndex]), 'unaffected pole/weight bits must remain');
    for (const m of unchangedKnots) check(Object.is(original.knots[m.originalKnotIndex], refined.knots[m.refinedKnotIndex]), 'original knot bits/order must remain');
    const parameters = [...new Set([...samples(original), ...samples(refined)])].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    const observations = parameters.map(parameter => {
      const originalPointMM = evaluateCurve(original, parameter), refinedPointMM = evaluateCurve(refined, parameter), differenceMM = Math.hypot(...refinedPointMM.map((n, i) => n - originalPointMM[i]));
      check(Number.isFinite(differenceMM) && differenceMM <= 1e-7, 'local original/refined point observation exceeds1e-7mm');
      return { parameter, originalPointMM, refinedPointMM, differenceMM };
    });
    return copyCadData({ original, refined, source: compiled.source, sourceVersion: 0, model: compiled.model,
      provenance: { kind: 'homogeneous-curve-knot-insertion', curveId: original.id, degree: original.degree, knot, insertions, unchangedPoles, unchangedKnots, steps },
      report: { kind: 'curve-knot-insertion', curveId: original.id, knot, insertions, degree: original.degree, domain, originalPoleCount: original.controlPoints.length, refinedPoleCount: refined.controlPoints.length,
        originalMultiplicity, refinedMultiplicity: refined.knots.filter(k => k === knot).length, observations, maximumObservedDifferenceMM: Math.max(...observations.map(o => o.differenceMM)),
        guardedKnots: { original: guardKnots(original.knots, original.degree, ...domain), refined: guardKnots(refined.knots, refined.degree, ...domain) },
        geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        limits: { maximumPoles: 16, maximumDegree: 3, maximumInsertions: 3, authoredIdCharacters: 48, snapshotValues: 1024, snapshotDepth: 6, arrayElements: 64, recordFields: 8, stringCharacters: 128, observationComparisonMM: 1e-7 } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid original curve/insertion options';
    throw new Error((message.startsWith(LABEL) ? message : LABEL + ': ' + message).slice(0, 1024), { cause: error });
  }
}
