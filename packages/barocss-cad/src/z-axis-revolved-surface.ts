import { buildXYArc } from './xy-arc.js';
import { curveDecimal, requireCurveValue } from './curve-source.js';
import { compileCadModel } from './model-compiler.js';
import { validateCurve, validateSurface, curveDomain, surfaceDomain, evaluateCurve, evaluateSurface } from './math.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Surface, Model, Point } from './types.js';

export interface ZAxisRevolvedSurfaceOptions { surfaceId: string }
export interface ZAxisRevolvedSurfaceConstruction {
  kind: 'z-axis-full-turn-revolve'; meridianId: string; surfaceId: string; lengthUnit: 'mm';
  axis: { originMM: Point; direction: Point }; turnDegrees: 360; uRole: 'meridian'; vRole: 'angle'; angularBasis: 'original-xy-circle';
}
export interface ZAxisRevolveBoundaryObservation {
  boundary: 'meridian-start' | 'meridian-end' | 'angle-start' | 'angle-end'; u: number; v: number;
  pointMM: Point; expectedPointMM: Point; differenceMM: number;
}
export interface ZAxisRevolvedSurfaceReport {
  kind: 'z-axis-revolved-surface'; meridianId: string; surfaceId: string; lengthUnit: 'mm';
  domains: { meridian: [number, number]; surface: { u: [number, number]; v: [number, number] } };
  degrees: { u: number; v: 2 }; controlPointCounts: { u: number; v: 9; total: number };
  meridianEndpoints: { parameter: number; pointMM: Point }[];
  angularSeam: { coefficientClosed: true; sampledU: number[]; maximumDifferenceMM: number; periodic: false };
  boundaryObservations: ZAxisRevolveBoundaryObservation[]; maximumBoundaryDifferenceMM: number;
  derivativeGuardKnots: { u: number[]; v: number[] }; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { maximumMeridianPoles: 16; maximumMeridianDegree: 3; authoredIdCharacters: 48; snapshotValues: 1024; snapshotDepth: 6; arrayElements: 64; recordFields: 8; stringCharacters: 128 };
}
export interface ZAxisRevolvedSurfaceResult {
  meridian: Curve; source: string; sourceVersion: 0; model: Model; surface: Surface;
  construction: ZAxisRevolvedSurfaceConstruction; report: ZAxisRevolvedSurfaceReport;
}
const LABEL = 'Z-axis revolved surface';
const OBSERVATION_MM = 1e-7;
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
/** Full global +Z revolution from actual original meridian and circle bases. */
export function buildZAxisRevolvedSurface(meridianInput: Curve, options: ZAxisRevolvedSurfaceOptions): ZAxisRevolvedSurfaceResult {
  try {
    const data = record(snapshot(meridianInput), ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']);
    const settings = record(snapshot(options), ['surfaceId']), surfaceId = id(settings.surfaceId);
    check(data.kind === 'curve', 'original Curve required'); id(data.id);
    check(data.id !== surfaceId, 'meridian and surface IDs must be distinct');
    check(typeof data.degree === 'number' && Number.isInteger(data.degree) && data.degree >= 1 && data.degree <= 3, 'meridian degree1..3 required');
    check(Array.isArray(data.controlPoints) && data.controlPoints.length >= 2 && data.controlPoints.length <= 16, 'meridian poles2..16 required');
    const meridian = data as unknown as Curve; validateCurve(meridian);
    for (const p of meridian.controlPoints) check(p[0] >= 0.001 && p[0] <= 10000 && p[1] === 0 && Math.abs(p[2]) <= 10000, 'XZ meridian poles require positive radius0.001..10000mm, y0 and z within±10000mm');
    check(meridian.controlPoints.some(p => p.some((value, axis) => value !== meridian.controlPoints[0][axis])), 'constant meridian unsupported');
    const angular = buildXYArc({ kind: 'circle', id: '__revolve_unit_circle', center: [0, 0], radius: 1 }).curve;
    const surface: Surface = { kind: 'surface', id: surfaceId, degreeU: meridian.degree, degreeV: angular.degree,
      knotsU: [...meridian.knots], knotsV: [...angular.knots],
      controlPoints: meridian.controlPoints.map(p => angular.controlPoints.map((a): Point => [p[0] * a[0], p[0] * a[1], p[2]])),
      weights: meridian.weights.map(w => angular.weights.map(q => w * q)) };
    // Product weights must meet actual native limits; do not normalize or heal.
    validateSurface(surface);
    const decimal = (n: number) => curveDecimal(n, LABEL), list = (values: number[]) => '[' + values.map(decimal).join(',') + ']';
    const poles = (points: Point[]) => '[' + points.map(list).join(',') + ']';
    const source = '@model ' + surfaceId + ' { version:0; length-unit:mm; @curve #' + meridian.id + ' { type:nurbs; degree:' + decimal(meridian.degree) + '; knots:' + list(meridian.knots) + '; control-points:' + poles(meridian.controlPoints) + '; weights:' + list(meridian.weights) + '; } @surface #' + surfaceId + ' { type:nurbs; degree-u:' + decimal(surface.degreeU) + '; degree-v:' + decimal(surface.degreeV) + '; knots-u:' + list(surface.knotsU) + '; knots-v:' + list(surface.knotsV) + '; control-points:[' + surface.controlPoints.map(poles).join(',') + ']; weights:[' + surface.weights.map(list).join(',') + ']; } }\n';
    check(source.length <= 262144, 'generated source exceeds compiler bound');
    const compiled = compileCadModel(source, { sourceVersion: 0 });
    check(compiled.ok, 'actual source0 compilation required' + (compiled.ok ? '' : ': ' + compiled.diagnostics.map(d => d.message).join('; ')));
    const expected: Model = { name: surfaceId, version: 0, lengthUnit: 'mm', objects: [meridian, surface] };
    check(sameData(compiled.model, expected), 'actual source0 must preserve complete original IDs/coefficients/knots/weights/order/signed zero');
    const adoptedMeridian = compiled.model.objects[0] as Curve, adoptedSurface = compiled.model.objects[1] as Surface;
    const domain = surfaceDomain(adoptedSurface), us = samples(adoptedMeridian), vs = samples(angular);
    const expectedPoint = (u: number, v: number): Point => { const p = evaluateCurve(adoptedMeridian, u), a = evaluateCurve(angular, v); return [p[0] * a[0], p[0] * a[1], p[2]]; };
    const boundaryObservations: ZAxisRevolveBoundaryObservation[] = [];
    const observe = (boundary: ZAxisRevolveBoundaryObservation['boundary'], u: number, v: number): void => {
      const pointMM = evaluateSurface(adoptedSurface, u, v), expectedPointMM = expectedPoint(u, v), differenceMM = Math.hypot(...pointMM.map((n, i) => n - expectedPointMM[i]));
      check(differenceMM <= OBSERVATION_MM, 'sampled original boundary correspondence exceeds1e-7mm'); boundaryObservations.push({ boundary, u, v, pointMM, expectedPointMM, differenceMM });
    };
    for (const v of vs) { observe('meridian-start', domain.u[0], v); observe('meridian-end', domain.u[1], v); }
    let maximumSeamDifferenceMM = 0;
    for (const u of us) {
      observe('angle-start', u, domain.v[0]); observe('angle-end', u, domain.v[1]);
      const first = evaluateSurface(adoptedSurface, u, domain.v[0]), last = evaluateSurface(adoptedSurface, u, domain.v[1]);
      maximumSeamDifferenceMM = Math.max(maximumSeamDifferenceMM, Math.hypot(...first.map((n, i) => n - last[i])));
    }
    check(maximumSeamDifferenceMM <= OBSERVATION_MM && adoptedSurface.controlPoints.every(row => sameData(row[0], row[8])) && adoptedSurface.weights.every(row => Object.is(row[0], row[8])), 'actual full angular seam must close');
    return copyCadData({ meridian: adoptedMeridian, source, sourceVersion: 0, model: compiled.model, surface: adoptedSurface,
      construction: { kind: 'z-axis-full-turn-revolve', meridianId: meridian.id, surfaceId, lengthUnit: 'mm', axis: { originMM: [0, 0, 0], direction: [0, 0, 1] }, turnDegrees: 360, uRole: 'meridian', vRole: 'angle', angularBasis: 'original-xy-circle' },
      report: { kind: 'z-axis-revolved-surface', meridianId: meridian.id, surfaceId, lengthUnit: 'mm', domains: { meridian: curveDomain(adoptedMeridian), surface: domain },
        degrees: { u: adoptedSurface.degreeU, v: 2 }, controlPointCounts: { u: adoptedSurface.controlPoints.length, v: 9, total: adoptedSurface.controlPoints.length * 9 },
        meridianEndpoints: domain.u.map(parameter => ({ parameter, pointMM: evaluateCurve(adoptedMeridian, parameter) })),
        angularSeam: { coefficientClosed: true, sampledU: us, maximumDifferenceMM: maximumSeamDifferenceMM, periodic: false },
        boundaryObservations, maximumBoundaryDifferenceMM: Math.max(...boundaryObservations.map(o => o.differenceMM)),
        derivativeGuardKnots: { u: guardKnots(adoptedSurface.knotsU, adoptedSurface.degreeU, ...domain.u), v: guardKnots(adoptedSurface.knotsV, adoptedSurface.degreeV, ...domain.v) },
        geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        limits: { maximumMeridianPoles: 16, maximumMeridianDegree: 3, authoredIdCharacters: 48, snapshotValues: 1024, snapshotDepth: 6, arrayElements: 64, recordFields: 8, stringCharacters: 128 } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid original curve/options';
    throw new Error((message.startsWith(LABEL) ? message : LABEL + ': ' + message).slice(0, 1024), { cause: error });
  }
}
