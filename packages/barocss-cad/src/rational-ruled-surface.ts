import { basis, validateCurve, validateSurface, curveDomain, surfaceDomain, evaluateCurve, evaluateSurface } from './math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from './derivatives.js';
import type { CurveD1Result, SurfaceD1Result } from './derivatives.js';
import { compileCadModel } from './model-compiler.js';
import { curveDecimal, requireCurveValue } from './curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Surface, Model, Point } from './types.js';
import { same as sameData } from './structural-equality.js';

export interface RationalRuledSurfaceOptions { surfaceId: string }
export interface RationalRuledSurfaceConstruction {
  kind: 'independent-weight-two-curve-ruled'; firstCurveId: string; secondCurveId: string; surfaceId: string; lengthUnit: 'mm';
  uRole: 'common-section-parameter'; vRole: 'rational-section-interpolation';
  rows: { surfaceRowIndex: number; firstCurveId: string; firstPoleIndex: number; firstColumn: 0; firstWeight: number;
    secondCurveId: string; secondPoleIndex: number; secondColumn: 1; secondWeight: number }[];
  knotsU: { surfaceKnotIndex: number; firstKnotIndex: number; secondKnotIndex: number; value: number }[];
  knotsV: { surfaceKnotIndex: number; value: number; origin: 'cross-section-clamp' }[];
}
export type RationalRuledSurfaceObservation = {
  kind: 'evaluated'; u: number; v: number; firstPointMM: Point; secondPointMM: Point;
  firstDenominator: number; secondDenominator: number; surfaceDenominator: number; secondFraction: number;
  expectedPointMM: Point; actualPointMM: Point; differenceMM: number; naiveCartesianPointMM: Point; naiveCartesianDifferenceMM: number;
} | { kind: 'refused'; u: number; v: number; message: string };
export type RationalRuledCurveD1Evaluation = { kind: 'evaluated'; result: CurveD1Result } | { kind: 'refused'; message: string };
export type RationalRuledSurfaceD1Evaluation = { kind: 'evaluated'; result: SurfaceD1Result } | { kind: 'refused'; message: string };
export interface RationalRuledSurfaceD1Observation {
  u: number; v: number; first: RationalRuledCurveD1Evaluation; second: RationalRuledCurveD1Evaluation; surface: RationalRuledSurfaceD1Evaluation;
}
export interface RationalRuledSurfaceReport {
  kind: 'rational-ruled-surface'; firstCurveId: string; secondCurveId: string; surfaceId: string; lengthUnit: 'mm';
  domains: { first: [number, number]; second: [number, number]; surface: { u: [number, number]; v: [number, number] } };
  degrees: { u: number; v: 1 }; controlPointCounts: { u: number; v: 2; total: number }; representedUSpan: number;
  sectionWeightsIdentical: boolean; parameterMeaning: 'denominator-weighted-section-interpolation';
  observations: RationalRuledSurfaceObservation[]; successfulPointObservations: number; refusedPointObservations: number;
  maximumObservedDifferenceMM: number | null; maximumObservedNaiveCartesianDifferenceMM: number | null;
  derivativeObservations: RationalRuledSurfaceD1Observation[]; guardedUKnots: number[]; derivativeSemantics: 'native-guards-and-arithmetic-refusals-retained';
  parameterBoundarySemantics: 'original-extractSurfaceBoundary-convention'; periodic: false; authority: 'original-section-coefficients';
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { maximumSectionPoles: 16; maximumSectionDegree: 3; maximumSurfacePoles: 32; authoredIdCharacters: 48;
    snapshotValues: 1024; snapshotDepth: 6; arrayElements: 64; recordFields: 8; stringCharacters: 128; maximumObservations: 15; maximumSurfaceDerivativeObservations: 5; observationComparisonMM: 1e-7 };
}
export interface RationalRuledSurfaceResult {
  first: Curve; second: Curve; surface: Surface; source: string; sourceVersion: 0; model: Model;
  construction: RationalRuledSurfaceConstruction; report: RationalRuledSurfaceReport;
}
const LABEL = 'Rational ruled Surface';
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

function finite(n: number): number { check(Number.isFinite(n), 'finite observation arithmetic required'); return n; }
function message(error: unknown): string { return (error instanceof Error ? error.message : 'native observation refused').slice(0, 512); }
function denominator(curve: Curve, parameter: number): number {
  const local = basis(curve.knots, curve.degree, curve.controlPoints.length, parameter);
  let sum = 0;
  for (let i = 0; i < local.values.length; i++) sum = finite(sum + finite(local.values[i] * curve.weights[local.start + i]));
  check(sum > 0, 'native section denominator must be positive'); return sum;
}
function parameters(curve: Curve): number[] {
  const [min, max] = curveDomain(curve), breaks = [...new Set(curve.knots)].filter(k => k >= min && k <= max);
  const interior = (a: number, b: number) => { const n = a + (b - a) / 2; return n > a && n < b ? n : undefined; };
  const first = interior(breaks[0], breaks[1]), last = interior(breaks[breaks.length - 2], breaks[breaks.length - 1]), mid = interior(min, max);
  return [min, ...(first === undefined ? [] : [first]), ...(mid === undefined || curve.knots.some(k => k === mid) ? [] : [mid]), ...(last === undefined ? [] : [last]), max].filter((n, i, values) => values.indexOf(n) === i);
}
function observe(first: Curve, second: Curve, surface: Surface, u: number, v: number): RationalRuledSurfaceObservation {
  try {
    const firstPointMM = evaluateCurve(first, u), secondPointMM = evaluateCurve(second, u), firstDenominator = denominator(first, u), secondDenominator = denominator(second, u);
    const firstFactor = finite((1 - v) * firstDenominator), secondFactor = finite(v * secondDenominator), surfaceDenominator = finite(firstFactor + secondFactor);
    check(surfaceDenominator > 0, 'positive rational Surface observation denominator required');
    const secondFraction = finite(secondFactor / surfaceDenominator); check(secondFraction >= 0 && secondFraction <= 1, 'native rational segment fraction must be within 0..1');
    const expectedPointMM = firstPointMM.map((n, i) => finite(finite(finite(firstFactor * n) + finite(secondFactor * secondPointMM[i])) / surfaceDenominator)) as Point;
    const actualPointMM = evaluateSurface(surface, u, v), differenceMM = finite(Math.hypot(...actualPointMM.map((n, i) => n - expectedPointMM[i])));
    const naiveCartesianPointMM = firstPointMM.map((n, i) => finite((1 - v) * n + v * secondPointMM[i])) as Point;
    const naiveCartesianDifferenceMM = finite(Math.hypot(...actualPointMM.map((n, i) => n - naiveCartesianPointMM[i])));
    return { kind: 'evaluated', u, v, firstPointMM, secondPointMM, firstDenominator, secondDenominator, surfaceDenominator, secondFraction, expectedPointMM, actualPointMM, differenceMM, naiveCartesianPointMM, naiveCartesianDifferenceMM };
  } catch (error) { return { kind: 'refused', u, v, message: message(error) }; }
}
function curveDerivative(curve: Curve, parameter: number): RationalRuledCurveD1Evaluation {
  try { return { kind: 'evaluated', result: evaluateCurveD1(curve, parameter) }; } catch (error) { return { kind: 'refused', message: message(error) }; }
}
function surfaceDerivative(surface: Surface, u: number, v: number): RationalRuledSurfaceD1Evaluation {
  try { return { kind: 'evaluated', result: evaluateSurfaceD1(surface, u, v) }; } catch (error) { return { kind: 'refused', message: message(error) }; }
}
/** Native rational ruled tensor Surface from equal-basis, independently weighted sections. */
export function buildRationalRuledSurface(firstInput: Curve, secondInput: Curve, options: RationalRuledSurfaceOptions): RationalRuledSurfaceResult {
  try {
    const firstData = snapshot(firstInput), secondData = snapshot(secondInput), settingsData = snapshot(options);
    const first = admitCurve(firstData), second = admitCurve(secondData), settings = record(settingsData, ['surfaceId']), surfaceId = id(settings.surfaceId);
    check(new Set([first.id, second.id, surfaceId]).size === 3, 'first/second/Surface IDs must be distinct');
    check(first.degree === second.degree && first.controlPoints.length === second.controlPoints.length && sameData(first.knots, second.knots), 'equal degree/count and Object.is original knot basis required; automatic compatibility repair unsupported');
    const domain = curveDomain(first), span = domain[1] - domain[0];
    check(Number.isFinite(span) && span > 0 && sameData(curveDomain(second), domain), 'finite positive represented common domain with retained endpoint bits required');
    const candidate: Surface = { kind: 'surface', id: surfaceId, degreeU: first.degree, degreeV: 1, knotsU: copyCadData(first.knots), knotsV: [0, 0, 1, 1],
      controlPoints: first.controlPoints.map((point, i) => [copyCadData(point), copyCadData(second.controlPoints[i])]), weights: first.weights.map((w, i) => [w, second.weights[i]]) };
    validateSurface(candidate);
    const decimal = (n: number) => curveDecimal(n, LABEL), list = (values: number[]) => '[' + values.map(decimal).join(',') + ']', poles = (points: Point[]) => '[' + points.map(list).join(',') + ']';
    const curveSource = (c: Curve) => '@curve #' + c.id + ' { type:nurbs; degree:' + decimal(c.degree) + '; knots:' + list(c.knots) + '; control-points:' + poles(c.controlPoints) + '; weights:' + list(c.weights) + '; } ';
    const source = '@model ' + surfaceId + ' { version:0; length-unit:mm; ' + curveSource(first) + curveSource(second) + '@surface #' + surfaceId + ' { type:nurbs; degree-u:' + decimal(candidate.degreeU) + '; degree-v:1; knots-u:' + list(candidate.knotsU) + '; knots-v:' + list(candidate.knotsV) + '; control-points:[' + candidate.controlPoints.map(poles).join(',') + ']; weights:[' + candidate.weights.map(list).join(',') + ']; } }\n';
    check(source.length <= 262144, 'generated source exceeds compiler bound');
    const compiled = compileCadModel(source, { sourceVersion: 0 });
    check(compiled.ok, 'actual three-object source0 compilation required' + (compiled.ok ? '' : ': ' + compiled.diagnostics.map(d => d.message).join('; ')));
    const expected: Model = { name: surfaceId, version: 0, lengthUnit: 'mm', objects: [first, second, candidate] };
    check(sameData(compiled.model, expected), 'actual source0 must preserve complete three-object Model/IDs/degrees/order/knots/poles/weights/signed zero');
    const adoptedFirst = compiled.model.objects[0] as Curve, adoptedSecond = compiled.model.objects[1] as Curve, surface = compiled.model.objects[2] as Surface;
    const domains = { first: curveDomain(adoptedFirst), second: curveDomain(adoptedSecond), surface: surfaceDomain(surface) };
    check(sameData(domains.first, domain) && sameData(domains.second, domain) && sameData(domains.surface, { u: domain, v: [0, 1] }), 'actual section and Surface domain bits must remain');
    const samples = parameters(adoptedFirst), observations = samples.flatMap(u => [0, 0.5, 1].map(v => observe(adoptedFirst, adoptedSecond, surface, u, v)));
    check(observations.length <= 15, 'native point observation cap exceeded');
    const evaluated = observations.filter((o): o is Extract<RationalRuledSurfaceObservation, { kind: 'evaluated' }> => o.kind === 'evaluated');
    for (const o of evaluated) check(o.differenceMM <= 1e-7, 'successfully evaluated rational blend comparison exceeds local 1e-7 mm');
    const guardedUKnots = [...new Set(adoptedFirst.knots)].filter(k => k > domain[0] && k < domain[1] && adoptedFirst.knots.filter(n => n === k).length >= adoptedFirst.degree);
    const interior = guardedUKnots[0] ?? samples.find(u => u > domain[0] && u < domain[1]);
    const queries: [number, number][] = [[domain[0], 0], [domain[0], 1], [domain[1], 0], [domain[1], 1]];
    if (interior !== undefined) queries.push([interior, 0.5]);
    const derivativeObservations = queries.map(([u, v]) => ({ u, v, first: curveDerivative(adoptedFirst, u), second: curveDerivative(adoptedSecond, u), surface: surfaceDerivative(surface, u, v) }));
    return copyCadData({ first: adoptedFirst, second: adoptedSecond, surface, source, sourceVersion: 0, model: compiled.model,
      construction: { kind: 'independent-weight-two-curve-ruled', firstCurveId: first.id, secondCurveId: second.id, surfaceId, lengthUnit: 'mm', uRole: 'common-section-parameter', vRole: 'rational-section-interpolation',
        rows: first.controlPoints.map((_, i) => ({ surfaceRowIndex: i, firstCurveId: first.id, firstPoleIndex: i, firstColumn: 0, firstWeight: first.weights[i], secondCurveId: second.id, secondPoleIndex: i, secondColumn: 1, secondWeight: second.weights[i] })),
        knotsU: first.knots.map((value, i) => ({ surfaceKnotIndex: i, firstKnotIndex: i, secondKnotIndex: i, value })), knotsV: [0, 0, 1, 1].map((value, i) => ({ surfaceKnotIndex: i, value, origin: 'cross-section-clamp' })) },
      report: { kind: 'rational-ruled-surface', firstCurveId: first.id, secondCurveId: second.id, surfaceId, lengthUnit: 'mm', domains, degrees: { u: first.degree, v: 1 }, controlPointCounts: { u: first.controlPoints.length, v: 2, total: first.controlPoints.length * 2 }, representedUSpan: span,
        sectionWeightsIdentical: sameData(first.weights, second.weights), parameterMeaning: 'denominator-weighted-section-interpolation', observations, successfulPointObservations: evaluated.length, refusedPointObservations: observations.length - evaluated.length,
        maximumObservedDifferenceMM: evaluated.length === 0 ? null : Math.max(...evaluated.map(o => o.differenceMM)), maximumObservedNaiveCartesianDifferenceMM: evaluated.length === 0 ? null : Math.max(...evaluated.map(o => o.naiveCartesianDifferenceMM)),
        derivativeObservations, guardedUKnots, derivativeSemantics: 'native-guards-and-arithmetic-refusals-retained', parameterBoundarySemantics: 'original-extractSurfaceBoundary-convention', periodic: false, authority: 'original-section-coefficients',
        geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        limits: { maximumSectionPoles: 16, maximumSectionDegree: 3, maximumSurfacePoles: 32, authoredIdCharacters: 48, snapshotValues: 1024, snapshotDepth: 6, arrayElements: 64, recordFields: 8, stringCharacters: 128, maximumObservations: 15, maximumSurfaceDerivativeObservations: 5, observationComparisonMM: 1e-7 } } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'invalid original sections/options';
    throw new Error((detail.startsWith(LABEL) ? detail : LABEL + ': ' + detail).slice(0, 1024), { cause: error });
  }
}
