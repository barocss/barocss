import { validateSurface, surfaceDomain, evaluateSurface } from './math.js';
import { insertCurveKnot } from './curve-knot-insertion.js';
import type { CurveKnotInsertionProvenance } from './curve-knot-insertion.js';
import { compileCadModel } from './model-compiler.js';
import { curveDecimal, requireCurveValue } from './curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Surface, Curve, Model, Point } from './types.js';
import { same as sameData } from './structural-equality.js';

export interface SurfaceKnotInsertionOptions { axis: 'u' | 'v'; knot: number; insertions: number }
export interface SurfaceKnotUnchangedPole {
  originalUIndex: number; originalVIndex: number; refinedUIndex: number; refinedVIndex: number;
}
export interface SurfaceKnotInsertionStrip { fixedPoleIndex: number; curve: CurveKnotInsertionProvenance }
export interface SurfaceKnotInsertionProvenance {
  kind: 'strip-curve-surface-knot-insertion'; surfaceId: string; axis: 'u' | 'v';
  unchangedPoles: SurfaceKnotUnchangedPole[];
  unchangedKnots: { originalKnotIndex: number; refinedKnotIndex: number }[];
  strips: SurfaceKnotInsertionStrip[];
}
export interface SurfaceKnotGridCount { u: number; v: number; total: number }
export interface SurfaceKnotInsertionReport {
  kind: 'surface-knot-insertion'; surfaceId: string; lengthUnit: 'mm'; axis: 'u' | 'v'; knot: number; insertions: number;
  domain: { u: [number, number]; v: [number, number] }; degrees: { u: number; v: number };
  originalGrid: SurfaceKnotGridCount; refinedGrid: SurfaceKnotGridCount; stripCount: number;
  originalMultiplicity: number; refinedMultiplicity: number; unchangedPoleCount: number; generatedPoleCount: number;
  observations: { u: number; v: number; originalPointMM: Point; refinedPointMM: Point; differenceMM: number }[];
  maximumObservedDifferenceMM: number;
  guardedKnots: { original: { u: number[]; v: number[] }; refined: { u: number[]; v: number[] } };
  authority: 'direct-surface-coefficients'; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { maximumGridAxis: 16; maximumPoles: 256; maximumDegree: 3; maximumInsertions: 3;
    authoredIdCharacters: 48; snapshotValues: 4096; snapshotDepth: 8; arrayElements: 64; recordFields: 8; stringCharacters: 128;
    maximumObservations: 128; observationComparisonMM: 1e-7 };
}
export interface SurfaceKnotInsertionResult {
  original: Surface; refined: Surface; source: string; sourceVersion: 0; model: Model;
  provenance: SurfaceKnotInsertionProvenance; report: SurfaceKnotInsertionReport;
}
const LABEL = 'Surface knot insertion';
function check(condition: boolean, detail: string): asserts condition { requireCurveValue(condition, detail, LABEL); }
function snapshot(input: unknown): unknown {
  let remaining = 4096;
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 8, 'input exceeds4096 own values/depth8');
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
function admit(input: unknown): Surface {
  const data = record(input, ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']);
  check(data.kind === 'surface', 'original Surface required'); id(data.id);
  check(typeof data.degreeU === 'number' && Number.isInteger(data.degreeU) && data.degreeU >= 1 && data.degreeU <= 3 && typeof data.degreeV === 'number' && Number.isInteger(data.degreeV) && data.degreeV >= 1 && data.degreeV <= 3, 'original U/V degree1..3 required');
  const surface = data as unknown as Surface; validateSurface(surface);
  check(surface.controlPoints.every(row => row.every(p => p.every(n => Math.abs(n) <= 10000))), 'original XYZ coordinates within±10000mm required');
  return surface;
}

function midpoint(a: number, b: number): number {
  const delta = b - a;
  return Number.isFinite(delta) ? a + delta / 2 : a / 2 + b / 2;
}
function samples(knots: number[], domain: [number, number]): number[] {
  const breaks = [...new Set(knots)].filter(k => k >= domain[0] && k <= domain[1]), values = new Set(breaks);
  for (let i = 0; i + 1 < breaks.length; i++) {
    const mid = midpoint(breaks[i], breaks[i + 1]);
    if (mid > breaks[i] && mid < breaks[i + 1]) values.add(mid);
  }
  return [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}
function guardKnots(surface: Surface): { u: number[]; v: number[] } {
  const domain = surfaceDomain(surface);
  const guards = (knots: number[], degree: number, d: [number, number]) => [...new Set(knots)].filter(k => k > d[0] && k < d[1] && knots.filter(x => x === k).length >= degree);
  return { u: guards(surface.knotsU, surface.degreeU, domain.u), v: guards(surface.knotsV, surface.degreeV, domain.v) };
}
function grid(surface: Surface): SurfaceKnotGridCount {
  const u = surface.controlPoints.length, v = surface.controlPoints[0].length;
  return { u, v, total: u * v };
}
/** Refine one original Surface axis through the existing rational Curve insertion API. */
export function insertSurfaceKnot(input: Surface, options: SurfaceKnotInsertionOptions): SurfaceKnotInsertionResult {
  try {
    const originalData = snapshot(input), optionData = snapshot(options), original = admit(originalData);
    const settings = record(optionData, ['axis', 'knot', 'insertions']);
    check(settings.axis === 'u' || settings.axis === 'v', 'selected axis must be u or v');
    const axis = settings.axis, other = axis === 'u' ? 'v' : 'u', domain = surfaceDomain(original), originalGrid = grid(original);
    const knot = settings.knot, insertions = settings.insertions;
    const selectedKnots = axis === 'u' ? original.knotsU : original.knotsV, degree = axis === 'u' ? original.degreeU : original.degreeV;
    check(typeof knot === 'number' && Number.isFinite(knot) && knot > domain[axis][0] && knot < domain[axis][1], 'finite strictly interior original-axis knot required');
    check(typeof insertions === 'number' && Number.isInteger(insertions) && insertions >= 1 && insertions <= 3, 'explicit insertion count 1..3 required');
    const originalMultiplicity = selectedKnots.filter(k => k === knot).length;
    check(originalMultiplicity + insertions <= degree, 'final numeric multiplicity must not exceed selected degree');
    check(originalGrid[axis] + insertions <= 16 && (originalGrid[axis] + insertions) * originalGrid[other] <= 256, 'final grid exceeds 16 per axis or 256 poles');
    const strips = Array.from({ length: originalGrid[other] }, (_, fixedPoleIndex) => {
      const controlPoints = axis === 'u' ? original.controlPoints.map(row => row[fixedPoleIndex]) : original.controlPoints[fixedPoleIndex];
      const weights = axis === 'u' ? original.weights.map(row => row[fixedPoleIndex]) : original.weights[fixedPoleIndex];
      const curve: Curve = { kind: 'curve', id: 'surface_strip_' + fixedPoleIndex, degree, knots: selectedKnots, controlPoints, weights };
      return { fixedPoleIndex, result: insertCurveKnot(curve, { knot, insertions }) };
    });
    const first = strips[0].result;
    for (const strip of strips) {
      check(sameData(strip.result.refined.knots, first.refined.knots) && sameData(strip.result.provenance.unchangedKnots, first.provenance.unchangedKnots)
        && sameData(strip.result.provenance.unchangedPoles, first.provenance.unchangedPoles) && sameData(strip.result.provenance.steps, first.provenance.steps), 'strip knot bits/order and insertion maps must agree');
    }
    const countU = originalGrid.u + (axis === 'u' ? insertions : 0), countV = originalGrid.v + (axis === 'v' ? insertions : 0);
    const candidate: Surface = {
      kind: 'surface', id: original.id, degreeU: original.degreeU, degreeV: original.degreeV,
      knotsU: copyCadData(axis === 'u' ? first.refined.knots : original.knotsU),
      knotsV: copyCadData(axis === 'v' ? first.refined.knots : original.knotsV),
      controlPoints: Array.from({ length: countU }, (_, u) => Array.from({ length: countV }, (_, v) => copyCadData(axis === 'u' ? strips[v].result.refined.controlPoints[u] : strips[u].result.refined.controlPoints[v]))),
      weights: Array.from({ length: countU }, (_, u) => Array.from({ length: countV }, (_, v) => axis === 'u' ? strips[v].result.refined.weights[u] : strips[u].result.refined.weights[v])),
    };
    admit(candidate);
    check(sameData(surfaceDomain(candidate), domain), 'original U/V domain bits must remain');
    const decimal = (n: number) => curveDecimal(n, LABEL), list = (values: number[]) => '[' + values.map(decimal).join(',') + ']';
    const source = '@model ' + candidate.id + ' { version:0; length-unit:mm; @surface #' + candidate.id + ' { type:nurbs; degree-u:' + decimal(candidate.degreeU) + '; degree-v:' + decimal(candidate.degreeV) + '; knots-u:' + list(candidate.knotsU) + '; knots-v:' + list(candidate.knotsV) + '; control-points:[' + candidate.controlPoints.map(row => '[' + row.map(list).join(',') + ']').join(',') + ']; weights:[' + candidate.weights.map(list).join(',') + ']; } }\n';
    check(source.length <= 262144, 'generated source exceeds compiler bound');
    const compiled = compileCadModel(source, { sourceVersion: 0 });
    check(compiled.ok, 'actual refined source0 compilation required' + (compiled.ok ? '' : ': ' + compiled.diagnostics.map(d => d.message).join('; ')));
    const expected: Model = { name: candidate.id, version: 0, lengthUnit: 'mm', objects: [candidate] };
    check(sameData(compiled.model, expected), 'actual refined source0 must preserve complete net/ID/order/knot/weight bits');
    const refined = compiled.model.objects[0] as Surface;
    check(sameData(surfaceDomain(refined), domain), 'compiled U/V domain bits must remain');
    const unchangedPoles: SurfaceKnotUnchangedPole[] = strips.flatMap(strip => strip.result.provenance.unchangedPoles.map(m => axis === 'u'
      ? { originalUIndex: m.originalPoleIndex, originalVIndex: strip.fixedPoleIndex, refinedUIndex: m.refinedPoleIndex, refinedVIndex: strip.fixedPoleIndex }
      : { originalUIndex: strip.fixedPoleIndex, originalVIndex: m.originalPoleIndex, refinedUIndex: strip.fixedPoleIndex, refinedVIndex: m.refinedPoleIndex }));
    for (const m of unchangedPoles) check(sameData(original.controlPoints[m.originalUIndex][m.originalVIndex], refined.controlPoints[m.refinedUIndex][m.refinedVIndex])
      && Object.is(original.weights[m.originalUIndex][m.originalVIndex], refined.weights[m.refinedUIndex][m.refinedVIndex]), 'directly unaffected original coefficient bits must remain');
    const refinedKnots = axis === 'u' ? refined.knotsU : refined.knotsV;
    for (const m of first.provenance.unchangedKnots) check(Object.is(selectedKnots[m.originalKnotIndex], refinedKnots[m.refinedKnotIndex]), 'original selected knots must retain bits and order');
    check(sameData(axis === 'u' ? original.knotsV : original.knotsU, axis === 'u' ? refined.knotsV : refined.knotsU), 'nonselected knots must retain bits');
    const selectedSamples = [...new Set([...samples(selectedKnots, domain[axis]), ...samples(refinedKnots, domain[axis])])].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
    const [min, max] = domain[other], mid = midpoint(min, max), perpendicular = mid > min && mid < max ? [min, mid, max] : [min, max];
    check(selectedSamples.length * perpendicular.length <= 128, 'native observation bound exceeded');
    const observations = selectedSamples.flatMap(parameter => perpendicular.map(fixed => {
      const u = axis === 'u' ? parameter : fixed, v = axis === 'u' ? fixed : parameter;
      const originalPointMM = evaluateSurface(original, u, v), refinedPointMM = evaluateSurface(refined, u, v), differenceMM = Math.hypot(...refinedPointMM.map((n, i) => n - originalPointMM[i]));
      check(Number.isFinite(differenceMM) && differenceMM <= 1e-7, 'local original/refined point observation exceeds 1e-7 mm');
      return { u, v, originalPointMM, refinedPointMM, differenceMM };
    }));
    const refinedGrid = grid(refined);
    return copyCadData({ original, refined, source, sourceVersion: 0, model: compiled.model,
      provenance: { kind: 'strip-curve-surface-knot-insertion', surfaceId: original.id, axis, unchangedPoles, unchangedKnots: first.provenance.unchangedKnots,
        strips: strips.map(strip => ({ fixedPoleIndex: strip.fixedPoleIndex, curve: strip.result.provenance })) },
      report: { kind: 'surface-knot-insertion', surfaceId: original.id, lengthUnit: 'mm', axis, knot, insertions, domain, degrees: { u: original.degreeU, v: original.degreeV }, originalGrid, refinedGrid,
        stripCount: strips.length, originalMultiplicity, refinedMultiplicity: refinedKnots.filter(k => k === knot).length, unchangedPoleCount: unchangedPoles.length, generatedPoleCount: refinedGrid.total - unchangedPoles.length,
        observations, maximumObservedDifferenceMM: Math.max(...observations.map(o => o.differenceMM)), guardedKnots: { original: guardKnots(original), refined: guardKnots(refined) },
        authority: 'direct-surface-coefficients', geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        limits: { maximumGridAxis: 16, maximumPoles: 256, maximumDegree: 3, maximumInsertions: 3, authoredIdCharacters: 48, snapshotValues: 4096, snapshotDepth: 8, arrayElements: 64, recordFields: 8, stringCharacters: 128, maximumObservations: 128, observationComparisonMM: 1e-7 } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid original Surface/insertion options';
    throw new Error((message.startsWith(LABEL) ? message : LABEL + ': ' + message).slice(0, 1024), { cause: error });
  }
}
