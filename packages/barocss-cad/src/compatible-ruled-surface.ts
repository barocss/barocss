import { validateCurve, validateSurface, curveDomain, surfaceDomain, evaluateCurve, evaluateSurface } from './math.js';
import { compileCadModel } from './model-compiler.js';
import { curveDecimal, requireCurveValue } from './curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Surface, Model, Point } from './types.js';

export interface CompatibleRuledSurfaceOptions { surfaceId: string }
export interface CompatibleRuledSurfaceConstruction {
  kind: 'compatible-two-curve-ruled'; firstCurveId: string; secondCurveId: string; surfaceId: string; lengthUnit: 'mm';
  uRole: 'common-section-parameter'; vRole: 'section-interpolation';
  rows: { surfaceRowIndex: number; firstCurveId: string; firstPoleIndex: number; firstColumn: 0; secondCurveId: string; secondPoleIndex: number; secondColumn: 1 }[];
}
export interface CompatibleRuledSurfaceObservation {
  u: number; v: number; firstPointMM: Point; secondPointMM: Point; expectedPointMM: Point; actualPointMM: Point; differenceMM: number;
}
export interface CompatibleRuledSurfaceReport {
  kind: 'compatible-ruled-surface'; firstCurveId: string; secondCurveId: string; surfaceId: string; lengthUnit: 'mm';
  domains: { first: [number, number]; second: [number, number]; surface: { u: [number, number]; v: [number, number] } };
  degrees: { u: number; v: 1 }; controlPointCounts: { u: number; v: 2; total: number };
  observations: CompatibleRuledSurfaceObservation[]; maximumObservedDifferenceMM: number; guardedUKnots: number[]; identicalSectionPoleCoefficients: boolean;
  parameterBoundarySemantics: 'original-extractSurfaceBoundary-convention'; periodic: false; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { maximumSectionPoles: 16; maximumSectionDegree: 3; authoredIdCharacters: 48; snapshotValues: 1024; snapshotDepth: 6; arrayElements: 64; recordFields: 8; stringCharacters: 128; observationComparisonMM: 1e-7 };
}
export interface CompatibleRuledSurfaceResult {
  first: Curve; second: Curve; source: string; sourceVersion: 0; model: Model; surface: Surface;
  construction: CompatibleRuledSurfaceConstruction; report: CompatibleRuledSurfaceReport;
}
const LABEL = 'Compatible ruled surface';
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
function admitCurve(input: unknown): Curve {
  const data = record(input, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']);
  check(data.kind === 'curve', 'original Curve required'); id(data.id);
  check(typeof data.degree === 'number' && Number.isInteger(data.degree) && data.degree >= 1 && data.degree <= 3, 'section degree1..3 required');
  check(Array.isArray(data.controlPoints) && data.controlPoints.length >= 2 && data.controlPoints.length <= 16, 'section poles2..16 required');
  const curve = data as unknown as Curve; validateCurve(curve);
  check(curve.controlPoints.every(p => p.every(n => Math.abs(n) <= 10000)), 'section XYZ coordinates must stay within±10000mm');
  return curve;
}
/** Two original compatible section bases, no resampling or compatibility repair. */
export function buildCompatibleRuledSurface(firstInput: Curve, secondInput: Curve, options: CompatibleRuledSurfaceOptions): CompatibleRuledSurfaceResult {
  try {
    // Complete owned snapshots precede any native validation or construction.
    const firstData = snapshot(firstInput), secondData = snapshot(secondInput), settingsData = snapshot(options);
    const first = admitCurve(firstData), second = admitCurve(secondData), settings = record(settingsData, ['surfaceId']), surfaceId = id(settings.surfaceId);
    check(new Set([first.id, second.id, surfaceId]).size === 3, 'first/second/surface IDs must be distinct');
    check(first.degree === second.degree && first.controlPoints.length === second.controlPoints.length && sameData(first.knots, second.knots) && sameData(first.weights, second.weights), 'exact degree/pole-count/Object.is knot/weight compatibility required');
    const surface: Surface = { kind: 'surface', id: surfaceId, degreeU: first.degree, degreeV: 1, knotsU: [...first.knots], knotsV: [0, 0, 1, 1],
      controlPoints: first.controlPoints.map((p, i) => [copyCadData(p), copyCadData(second.controlPoints[i])]),
      weights: first.weights.map((w, i) => [w, second.weights[i]]) };
    validateSurface(surface);
    const decimal = (n: number) => curveDecimal(n, LABEL), list = (values: number[]) => '[' + values.map(decimal).join(',') + ']';
    const poles = (points: Point[]) => '[' + points.map(list).join(',') + ']';
    const curveSource = (c: Curve) => '@curve #' + c.id + ' { type:nurbs; degree:' + decimal(c.degree) + '; knots:' + list(c.knots) + '; control-points:' + poles(c.controlPoints) + '; weights:' + list(c.weights) + '; } ';
    const source = '@model ' + surfaceId + ' { version:0; length-unit:mm; ' + curveSource(first) + curveSource(second) + '@surface #' + surfaceId + ' { type:nurbs; degree-u:' + decimal(surface.degreeU) + '; degree-v:1; knots-u:' + list(surface.knotsU) + '; knots-v:' + list(surface.knotsV) + '; control-points:[' + surface.controlPoints.map(poles).join(',') + ']; weights:[' + surface.weights.map(list).join(',') + ']; } }\n';
    check(source.length <= 262144, 'generated source exceeds compiler bound');
    const compiled = compileCadModel(source, { sourceVersion: 0 });
    check(compiled.ok, 'actual source0 compilation required' + (compiled.ok ? '' : ': ' + compiled.diagnostics.map(d => d.message).join('; ')));
    const expected: Model = { name: surfaceId, version: 0, lengthUnit: 'mm', objects: [first, second, surface] };
    check(sameData(compiled.model, expected), 'actual source0 must preserve complete native coefficients/IDs/order/knots/weights/signed zero');
    const adoptedFirst = compiled.model.objects[0] as Curve, adoptedSecond = compiled.model.objects[1] as Curve, adoptedSurface = compiled.model.objects[2] as Surface;
    const observations: CompatibleRuledSurfaceObservation[] = [];
    for (const u of samples(adoptedFirst)) for (const v of [0, 0.5, 1]) {
      const firstPointMM = evaluateCurve(adoptedFirst, u), secondPointMM = evaluateCurve(adoptedSecond, u);
      const expectedPointMM = firstPointMM.map((n, i) => (1 - v) * n + v * secondPointMM[i]) as Point, actualPointMM = evaluateSurface(adoptedSurface, u, v);
      const differenceMM = Math.hypot(...actualPointMM.map((n, i) => n - expectedPointMM[i]));
      check(Number.isFinite(differenceMM) && differenceMM <= 1e-7, 'local original section/blend observation exceeds1e-7mm');
      observations.push({ u, v, firstPointMM, secondPointMM, expectedPointMM, actualPointMM, differenceMM });
    }
    const firstDomain = curveDomain(adoptedFirst), domains = { first: firstDomain, second: curveDomain(adoptedSecond), surface: surfaceDomain(adoptedSurface) };
    return copyCadData({ first: adoptedFirst, second: adoptedSecond, source, sourceVersion: 0, model: compiled.model, surface: adoptedSurface,
      construction: { kind: 'compatible-two-curve-ruled', firstCurveId: first.id, secondCurveId: second.id, surfaceId, lengthUnit: 'mm', uRole: 'common-section-parameter', vRole: 'section-interpolation',
        rows: first.controlPoints.map((_, i) => ({ surfaceRowIndex: i, firstCurveId: first.id, firstPoleIndex: i, firstColumn: 0, secondCurveId: second.id, secondPoleIndex: i, secondColumn: 1 })) },
      report: { kind: 'compatible-ruled-surface', firstCurveId: first.id, secondCurveId: second.id, surfaceId, lengthUnit: 'mm', domains,
        degrees: { u: first.degree, v: 1 }, controlPointCounts: { u: first.controlPoints.length, v: 2, total: first.controlPoints.length * 2 }, observations,
        maximumObservedDifferenceMM: Math.max(...observations.map(o => o.differenceMM)), guardedUKnots: guardKnots(adoptedFirst.knots, adoptedFirst.degree, ...firstDomain),
        identicalSectionPoleCoefficients: sameData(adoptedFirst.controlPoints, adoptedSecond.controlPoints), parameterBoundarySemantics: 'original-extractSurfaceBoundary-convention',
        periodic: false, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        limits: { maximumSectionPoles: 16, maximumSectionDegree: 3, authoredIdCharacters: 48, snapshotValues: 1024, snapshotDepth: 6, arrayElements: 64, recordFields: 8, stringCharacters: 128, observationComparisonMM: 1e-7 } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid original sections/options';
    throw new Error((message.startsWith(LABEL) ? message : LABEL + ': ' + message).slice(0, 1024), { cause: error });
  }
}
