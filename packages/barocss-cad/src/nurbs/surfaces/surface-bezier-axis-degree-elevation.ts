import { validateSurface, surfaceDomain, evaluateSurface } from '../../math.js';
import { evaluateSurfaceD1 } from '../../derivatives.js';
import type { SurfaceD1Result } from '../../derivatives.js';
import { elevateBezierCurveDegree } from '../curves/bezier-curve-degree-elevation.js';
import type { BezierCurveDegreeElevationProvenance, BezierCurveDegreeElevationReport, BezierCurveElevationKnot } from '../curves/bezier-curve-degree-elevation.js';
import { compileCadModel } from '../../model-compiler.js';
import { curveDecimal, requireCurveValue } from '../curves/curve-source.js';
import { copyCadData } from '../../data-copy.js';
import type { Surface, Curve, Model, Point } from '../../types.js';
import { same as sameData } from '../../structural-equality.js';

export interface SurfaceBezierAxisDegreeElevationOptions { axis: 'u' | 'v'; targetDegree: 2 | 3 }
export interface SurfaceBezierAxisEndpointMapping { originalUIndex: number; originalVIndex: number; elevatedUIndex: number; elevatedVIndex: number }
export interface SurfaceBezierAxisDegreeStrip { fixedPoleIndex: number; curve: BezierCurveDegreeElevationProvenance; report: BezierCurveDegreeElevationReport }
export interface SurfaceBezierAxisDegreeElevationProvenance {
  kind: 'strip-bezier-surface-axis-degree-elevation'; surfaceId: string; axis: 'u' | 'v'; originalDegree: number; targetDegree: 2 | 3;
  endpointPoles: SurfaceBezierAxisEndpointMapping[]; knots: BezierCurveElevationKnot[]; strips: SurfaceBezierAxisDegreeStrip[];
}
export type SurfaceBezierAxisD1Evaluation = { kind: 'evaluated'; result: SurfaceD1Result } | { kind: 'refused'; message: string };
export interface SurfaceBezierAxisD1Observation { u: number; v: number; original: SurfaceBezierAxisD1Evaluation; elevated: SurfaceBezierAxisD1Evaluation }
export interface SurfaceBezierAxisDegreeElevationReport {
  kind: 'surface-bezier-axis-degree-elevation'; surfaceId: string; lengthUnit: 'mm'; axis: 'u' | 'v'; originalDegree: number; targetDegree: 2 | 3;
  degrees: { original: { u: number; v: number }; elevated: { u: number; v: number } };
  grids: { original: { u: number; v: number; total: number }; elevated: { u: number; v: number; total: number } };
  domain: { u: [number, number]; v: [number, number] }; representedSpans: { u: number; v: number }; stripCount: number;
  endpointBitsRetained: true; nonselectedBitsRetained: true;
  observations: { u: number; v: number; originalPointMM: Point; elevatedPointMM: Point; differenceMM: number }[];
  maximumObservedDifferenceMM: number; derivativeObservations: SurfaceBezierAxisD1Observation[];
  guardedKnots: { original: { u: number[]; v: number[] }; elevated: { u: number[]; v: number[] } };
  stripReports: { fixedPoleIndex: number; report: BezierCurveDegreeElevationReport }[]; derivativeSemantics: 'native-guards-and-arithmetic-refusals-retained';
  authority: 'original-surface-coefficients'; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { maximumOriginalGridAxis: 16; maximumOriginalPoles: 256; maximumSelectedOriginalDegree: 2; maximumTargetDegree: 3; maximumOtherDegree: 3;
    maximumElevationsPerCall: 1; maximumElevatedSelectedPoles: 4; maximumStrips: 16; maximumElevatedPoles: 64; authoredIdCharacters: 48;
    snapshotValues: 4096; snapshotDepth: 8; arrayElements: 64; recordFields: 8; stringCharacters: 128; maximumObservations: 9; maximumDerivativeObservations: 5; observationComparisonMM: 1e-7 };
}
export interface SurfaceBezierAxisDegreeElevationResult {
  original: Surface; elevated: Surface; source: string; sourceVersion: 0; model: Model;
  provenance: SurfaceBezierAxisDegreeElevationProvenance; report: SurfaceBezierAxisDegreeElevationReport;
}
const LABEL = 'Surface Bezier-axis degree elevation';
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

function grid(surface: Surface): { u: number; v: number; total: number } { const u = surface.controlPoints.length, v = surface.controlPoints[0].length; return { u, v, total: u * v }; }
function midpoint(d: [number, number]): number | undefined { const mid = d[0] + (d[1] - d[0]) / 2; return mid > d[0] && mid < d[1] ? mid : undefined; }
function parameters(d: [number, number]): number[] { const mid = midpoint(d); return [d[0], ...(mid === undefined ? [] : [mid]), d[1]]; }
function guards(surface: Surface): { u: number[]; v: number[] } {
  const d = surfaceDomain(surface), g = (knots: number[], degree: number, domain: [number, number]) => [...new Set(knots)].filter(k => k > domain[0] && k < domain[1] && knots.filter(n => n === k).length >= degree);
  return { u: g(surface.knotsU, surface.degreeU, d.u), v: g(surface.knotsV, surface.degreeV, d.v) };
}
function derivative(surface: Surface, u: number, v: number): SurfaceBezierAxisD1Evaluation {
  try { return { kind: 'evaluated', result: evaluateSurfaceD1(surface, u, v) }; }
  catch (error) { return { kind: 'refused', message: (error instanceof Error ? error.message : 'native Surface D1 refused').slice(0, 512) }; }
}
/** One selected Bezier axis elevated through actual original Curve strip operations. */
export function elevateSurfaceBezierAxisDegree(input: Surface, options: SurfaceBezierAxisDegreeElevationOptions): SurfaceBezierAxisDegreeElevationResult {
  try {
    const originalData = snapshot(input), optionData = snapshot(options), original = admit(originalData), settings = record(optionData, ['axis', 'targetDegree']);
    check(settings.axis === 'u' || settings.axis === 'v', 'selected axis must be u or v');
    const axis = settings.axis, other = axis === 'u' ? 'v' : 'u', targetDegree = settings.targetDegree;
    const originalGrid = grid(original), domain = surfaceDomain(original), selectedDegree = axis === 'u' ? original.degreeU : original.degreeV, selectedKnots = axis === 'u' ? original.knotsU : original.knotsV;
    check(selectedDegree === 1 || selectedDegree === 2, 'selected original Bezier degree must be 1 or 2');
    check((targetDegree === 2 || targetDegree === 3) && targetDegree === selectedDegree + 1, 'explicit selected degree step 1->2 or 2->3 required');
    check(originalGrid[axis] === selectedDegree + 1 && selectedKnots.length === 2 * (selectedDegree + 1), 'selected single-span Bezier coefficients required; general multi-span elevation unsupported');
    const representedSpans = { u: domain.u[1] - domain.u[0], v: domain.v[1] - domain.v[0] };
    check(Number.isFinite(representedSpans.u) && representedSpans.u > 0 && Number.isFinite(representedSpans.v) && representedSpans.v > 0, 'both original represented domain spans must be finite and positive');
    check(selectedKnots.slice(0, selectedDegree + 1).every(k => k === domain[axis][0]) && selectedKnots.slice(selectedDegree + 1).every(k => k === domain[axis][1]), 'selected original clamped span required');
    const strips = Array.from({ length: originalGrid[other] }, (_, fixedPoleIndex) => {
      const curve: Curve = { kind: 'curve', id: 'surface_strip_' + fixedPoleIndex, degree: selectedDegree, knots: selectedKnots,
        controlPoints: axis === 'u' ? original.controlPoints.map(row => row[fixedPoleIndex]) : original.controlPoints[fixedPoleIndex],
        weights: axis === 'u' ? original.weights.map(row => row[fixedPoleIndex]) : original.weights[fixedPoleIndex] };
      return { fixedPoleIndex, result: elevateBezierCurveDegree(curve, { targetDegree }) };
    });
    const first = strips[0].result;
    for (const strip of strips) check(strip.result.elevated.degree === targetDegree && sameData(strip.result.elevated.knots, first.elevated.knots) && sameData(strip.result.provenance.knots, first.provenance.knots), 'actual selected strip elevated knot bits/order/origin maps must agree');
    const countU = axis === 'u' ? targetDegree + 1 : originalGrid.u, countV = axis === 'v' ? targetDegree + 1 : originalGrid.v;
    const candidate: Surface = { kind: 'surface', id: original.id, degreeU: axis === 'u' ? targetDegree : original.degreeU, degreeV: axis === 'v' ? targetDegree : original.degreeV,
      knotsU: copyCadData(axis === 'u' ? first.elevated.knots : original.knotsU), knotsV: copyCadData(axis === 'v' ? first.elevated.knots : original.knotsV),
      controlPoints: Array.from({ length: countU }, (_, u) => Array.from({ length: countV }, (_, v) => copyCadData(axis === 'u' ? strips[v].result.elevated.controlPoints[u] : strips[u].result.elevated.controlPoints[v]))),
      weights: Array.from({ length: countU }, (_, u) => Array.from({ length: countV }, (_, v) => axis === 'u' ? strips[v].result.elevated.weights[u] : strips[u].result.elevated.weights[v])) };
    admit(candidate);
    check(countU * countV <= 64 && sameData(surfaceDomain(candidate), domain), 'bounded elevated grid and original U/V domain bits required');
    const decimal = (n: number) => curveDecimal(n, LABEL), list = (values: number[]) => '[' + values.map(decimal).join(',') + ']';
    const source = '@model ' + candidate.id + ' { version:0; length-unit:mm; @surface #' + candidate.id + ' { type:nurbs; degree-u:' + decimal(candidate.degreeU) + '; degree-v:' + decimal(candidate.degreeV) + '; knots-u:' + list(candidate.knotsU) + '; knots-v:' + list(candidate.knotsV) + '; control-points:[' + candidate.controlPoints.map(row => '[' + row.map(list).join(',') + ']').join(',') + ']; weights:[' + candidate.weights.map(list).join(',') + ']; } }\n';
    check(source.length <= 262144, 'generated source exceeds compiler bound');
    const compiled = compileCadModel(source, { sourceVersion: 0 });
    check(compiled.ok, 'actual source0 Surface compilation required' + (compiled.ok ? '' : ': ' + compiled.diagnostics.map(d => d.message).join('; ')));
    const expected: Model = { name: candidate.id, version: 0, lengthUnit: 'mm', objects: [candidate] };
    check(sameData(compiled.model, expected), 'actual source0 must preserve complete Surface Model/name/ID/degrees/net/weights/knots bits');
    const elevated = compiled.model.objects[0] as Surface;
    check(sameData(surfaceDomain(elevated), domain), 'actual original U/V domain bits must remain');
    check((axis === 'u' ? elevated.degreeV === original.degreeV : elevated.degreeU === original.degreeU) && sameData(axis === 'u' ? elevated.knotsV : elevated.knotsU, axis === 'u' ? original.knotsV : original.knotsU), 'nonselected degree and knot bits must remain');
    const endpointPoles: SurfaceBezierAxisEndpointMapping[] = strips.flatMap(strip => strip.result.provenance.endpoints.map(m => axis === 'u'
      ? { originalUIndex: m.originalPoleIndex, originalVIndex: strip.fixedPoleIndex, elevatedUIndex: m.elevatedPoleIndex, elevatedVIndex: strip.fixedPoleIndex }
      : { originalUIndex: strip.fixedPoleIndex, originalVIndex: m.originalPoleIndex, elevatedUIndex: strip.fixedPoleIndex, elevatedVIndex: m.elevatedPoleIndex }));
    for (const m of endpointPoles) check(sameData(original.controlPoints[m.originalUIndex][m.originalVIndex], elevated.controlPoints[m.elevatedUIndex][m.elevatedVIndex]) && Object.is(original.weights[m.originalUIndex][m.originalVIndex], elevated.weights[m.elevatedUIndex][m.elevatedVIndex]), 'selected endpoint row/column coefficient bits must remain');
    const elevatedKnots = axis === 'u' ? elevated.knotsU : elevated.knotsV;
    for (const m of first.provenance.knots) check(Object.is(elevatedKnots[m.elevatedKnotIndex], m.originalKnotIndex === null ? m.origin === 'start-clamp' ? domain[axis][0] : domain[axis][1] : selectedKnots[m.originalKnotIndex]), 'retained selected knots and original actual-domain clamp signs must remain');
    const observations = parameters(domain.u).flatMap(u => parameters(domain.v).map(v => {
      const originalPointMM = evaluateSurface(original, u, v), elevatedPointMM = evaluateSurface(elevated, u, v), differenceMM = Math.hypot(...elevatedPointMM.map((n, i) => n - originalPointMM[i]));
      check(Number.isFinite(differenceMM) && differenceMM <= 1e-7, 'local original/elevated Surface point observation exceeds 1e-7 mm');
      return { u, v, originalPointMM, elevatedPointMM, differenceMM };
    }));
    check(observations.length <= 9, 'native Surface point observation cap exceeded');
    const queries: [number, number][] = [[domain.u[0], domain.v[0]], [domain.u[0], domain.v[1]], [domain.u[1], domain.v[0]], [domain.u[1], domain.v[1]]], midU = midpoint(domain.u), midV = midpoint(domain.v);
    if (midU !== undefined && midV !== undefined) queries.push([midU, midV]);
    const derivativeObservations = queries.map(([u, v]) => ({ u, v, original: derivative(original, u, v), elevated: derivative(elevated, u, v) }));
    const ownedStrips = strips.map(strip => ({ fixedPoleIndex: strip.fixedPoleIndex, curve: strip.result.provenance, report: strip.result.report }));
    return copyCadData({ original, elevated, source, sourceVersion: 0, model: compiled.model,
      provenance: { kind: 'strip-bezier-surface-axis-degree-elevation', surfaceId: original.id, axis, originalDegree: selectedDegree, targetDegree, endpointPoles, knots: first.provenance.knots, strips: ownedStrips },
      report: { kind: 'surface-bezier-axis-degree-elevation', surfaceId: original.id, lengthUnit: 'mm', axis, originalDegree: selectedDegree, targetDegree,
        degrees: { original: { u: original.degreeU, v: original.degreeV }, elevated: { u: elevated.degreeU, v: elevated.degreeV } }, grids: { original: originalGrid, elevated: grid(elevated) }, domain, representedSpans,
        stripCount: strips.length, endpointBitsRetained: true, nonselectedBitsRetained: true, observations, maximumObservedDifferenceMM: Math.max(...observations.map(o => o.differenceMM)), derivativeObservations,
        guardedKnots: { original: guards(original), elevated: guards(elevated) }, stripReports: strips.map(strip => ({ fixedPoleIndex: strip.fixedPoleIndex, report: strip.result.report })), derivativeSemantics: 'native-guards-and-arithmetic-refusals-retained',
        authority: 'original-surface-coefficients', geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        limits: { maximumOriginalGridAxis: 16, maximumOriginalPoles: 256, maximumSelectedOriginalDegree: 2, maximumTargetDegree: 3, maximumOtherDegree: 3, maximumElevationsPerCall: 1, maximumElevatedSelectedPoles: 4, maximumStrips: 16, maximumElevatedPoles: 64,
          authoredIdCharacters: 48, snapshotValues: 4096, snapshotDepth: 8, arrayElements: 64, recordFields: 8, stringCharacters: 128, maximumObservations: 9, maximumDerivativeObservations: 5, observationComparisonMM: 1e-7 } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid original Surface/Bezier-axis target degree';
    throw new Error((message.startsWith(LABEL) ? message : LABEL + ': ' + message).slice(0, 1024), { cause: error });
  }
}
