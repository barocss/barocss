import { validateSurface, surfaceDomain, evaluateSurface } from './math.js';
import { insertSurfaceKnot } from './surface-knot-insertion.js';
import type { SurfaceKnotInsertionProvenance, SurfaceKnotUnchangedPole, SurfaceKnotGridCount } from './surface-knot-insertion.js';
import { compileCadModel } from './model-compiler.js';
import { curveDecimal, requireCurveValue } from './curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Surface, Model, Point } from './types.js';
import { same as sameData } from './structural-equality.js';

export interface SurfaceParameterSplitOptions { axis: 'u' | 'v'; parameter: number; lowerSurfaceId: string; upperSurfaceId: string }
export interface SurfaceSplitPoleMapping { refinedUIndex: number; refinedVIndex: number; childUIndex: number; childVIndex: number }
export interface SurfaceSplitKnotMapping { childKnotIndex: number; refinedKnotIndex: number | null; value: number; origin: 'refined-copy' | 'requested-clamp' }
export interface SurfaceSplitChildProvenance {
  side: 'lower' | 'upper'; surfaceId: string; poleMappings: SurfaceSplitPoleMapping[];
  selectedKnots: SurfaceSplitKnotMapping[]; nonselectedKnots: SurfaceSplitKnotMapping[];
}
export interface SurfaceSplitRefinementProvenance {
  kind: 'knot-insertion' | 'direct-copy'; insertions: number; operation: SurfaceKnotInsertionProvenance | null;
  unchangedPoles: SurfaceKnotUnchangedPole[]; unchangedKnots: { originalKnotIndex: number; refinedKnotIndex: number }[];
}
export interface SurfaceSplitSharedCoefficients {
  refinedAxisPoleIndex: number; lowerAxisPoleIndex: number; upperAxisPoleIndex: number;
  coefficients: { varyingPoleIndex: number; pointMM: Point; weight: number }[];
  lowerBoundary: 'u-max' | 'v-max'; upperBoundary: 'u-min' | 'v-min';
  lowerDirection: 'increasing' | 'decreasing'; upperDirection: 'increasing' | 'decreasing';
}
export interface SurfaceParameterSplitProvenance {
  kind: 'surface-parameter-split'; sourceSurfaceId: string; axis: 'u' | 'v'; parameter: number; firstRefinedKnotIndex: number;
  refinement: SurfaceSplitRefinementProvenance; lower: SurfaceSplitChildProvenance; upper: SurfaceSplitChildProvenance; shared: SurfaceSplitSharedCoefficients;
}
export interface SurfaceParameterSplitReport {
  kind: 'surface-parameter-split'; surfaceId: string; lengthUnit: 'mm'; axis: 'u' | 'v'; parameter: number; selectedDegree: number;
  originalMultiplicity: number; requiredInsertions: number; refinedMultiplicity: number;
  grids: { original: SurfaceKnotGridCount; refined: SurfaceKnotGridCount; lower: SurfaceKnotGridCount; upper: SurfaceKnotGridCount };
  domains: { original: SurfaceDomain; refined: SurfaceDomain; lower: SurfaceDomain; upper: SurfaceDomain };
  cutEndpoints: { requested: number; lower: number; upper: number; negativeZero: { requested: boolean; lower: boolean; upper: boolean } };
  selectedAxisKnotGuards: { original: boolean; refined: boolean; lowerEndpoint: boolean; upperEndpoint: boolean };
  derivativeSemantics: 'native-guards-unchanged'; shared: SurfaceSplitSharedCoefficients;
  observations: { side: 'lower' | 'upper'; surfaceId: string; u: number; v: number; originalPointMM: Point; childPointMM: Point; differenceMM: number }[];
  maximumObservedDifferenceMM: number; authority: 'original-surface-coefficients'; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { maximumGridAxis: 16; maximumPoles: 256; maximumDegree: 3; authoredIdCharacters: 48;
    snapshotValues: 4096; snapshotDepth: 8; arrayElements: 64; recordFields: 8; stringCharacters: 128; maximumObservations: 128; observationComparisonMM: 1e-7 };
}
type SurfaceDomain = { u: [number, number]; v: [number, number] };
export interface SurfaceParameterSplitResult {
  original: Surface; refined: Surface; lower: Surface; upper: Surface; source: string; sourceVersion: 0; model: Model;
  provenance: SurfaceParameterSplitProvenance; report: SurfaceParameterSplitReport;
}
const LABEL = 'Surface parameter split';
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

function grid(surface: Surface): SurfaceKnotGridCount {
  const u = surface.controlPoints.length, v = surface.controlPoints[0].length; return { u, v, total: u * v };
}
function midpoint(a: number, b: number): number { const delta = b - a; return Number.isFinite(delta) ? a + delta / 2 : a / 2 + b / 2; }
function samples(knots: number[], domain: [number, number]): number[] {
  const breaks = [...new Set(knots)].filter(k => k >= domain[0] && k <= domain[1]), values = new Set(breaks);
  for (let i = 0; i + 1 < breaks.length; i++) { const mid = midpoint(breaks[i], breaks[i + 1]); if (mid > breaks[i] && mid < breaks[i + 1]) values.add(mid); }
  return [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}
function guarded(knots: number[], degree: number, domain: [number, number], parameter: number): boolean {
  return parameter > domain[0] && parameter < domain[1] && knots.filter(k => k === parameter).length >= degree;
}
/** Two increasing-parameter native patches, split through existing Surface refinement. */
export function splitSurfaceAtParameter(input: Surface, options: SurfaceParameterSplitOptions): SurfaceParameterSplitResult {
  try {
    const originalData = snapshot(input), optionData = snapshot(options), original = admit(originalData);
    const settings = record(optionData, ['axis', 'parameter', 'lowerSurfaceId', 'upperSurfaceId']);
    check(settings.axis === 'u' || settings.axis === 'v', 'selected axis must be u or v');
    const axis = settings.axis, other = axis === 'u' ? 'v' : 'u', parameter = settings.parameter;
    const lowerId = id(settings.lowerSurfaceId), upperId = id(settings.upperSurfaceId);
    check(new Set([original.id, lowerId, upperId]).size === 3, 'original and two child Surface IDs must differ');
    const originalDomain = surfaceDomain(original), originalKnots = axis === 'u' ? original.knotsU : original.knotsV, degree = axis === 'u' ? original.degreeU : original.degreeV;
    check(typeof parameter === 'number' && Number.isFinite(parameter) && parameter > originalDomain[axis][0] && parameter < originalDomain[axis][1], 'finite strictly interior original-axis split parameter required');
    const originalMultiplicity = originalKnots.filter(k => k === parameter).length, requiredInsertions = degree - originalMultiplicity;
    check(requiredInsertions >= 0 && requiredInsertions <= 3, 'native selected multiplicity must not exceed degree');
    const inserted = requiredInsertions === 0 ? null : insertSurfaceKnot(original, { axis, knot: parameter, insertions: requiredInsertions });
    const refined = inserted === null ? copyCadData(original) : inserted.refined, refinedDomain = surfaceDomain(refined), refinedGrid = grid(refined);
    check(sameData(refinedDomain, originalDomain), 'refinement must preserve original U/V domain bits');
    const knots = axis === 'u' ? refined.knotsU : refined.knotsV, nonselected = axis === 'u' ? refined.knotsV : refined.knotsU;
    const first = knots.findIndex(k => k === parameter), common = first - 1;
    check(first >= degree + 1 && common >= 1 && common < refinedGrid[axis] - 1 && knots.filter(k => k === parameter).length === degree, 'refined interior degree-multiplicity cut and common pole required');
    const refinement: SurfaceSplitRefinementProvenance = {
      kind: inserted === null ? 'direct-copy' : 'knot-insertion', insertions: requiredInsertions, operation: inserted?.provenance ?? null,
      unchangedPoles: inserted?.provenance.unchangedPoles ?? original.controlPoints.flatMap((row, u) => row.map((_, v) => ({ originalUIndex: u, originalVIndex: v, refinedUIndex: u, refinedVIndex: v }))),
      unchangedKnots: inserted?.provenance.unchangedKnots ?? originalKnots.map((_, i) => ({ originalKnotIndex: i, refinedKnotIndex: i })),
    };
    const makeChild = (side: 'lower' | 'upper', surfaceId: string): { surface: Surface; provenance: SurfaceSplitChildProvenance } => {
      const offset = side === 'lower' ? 0 : common, count = side === 'lower' ? common + 1 : refinedGrid[axis] - common;
      const selectedKnots: SurfaceSplitKnotMapping[] = side === 'lower'
        ? [...knots.slice(0, first + degree).map((value, i): SurfaceSplitKnotMapping => ({ childKnotIndex: i, refinedKnotIndex: i, value, origin: 'refined-copy' })), { childKnotIndex: first + degree, refinedKnotIndex: null, value: parameter, origin: 'requested-clamp' }]
        : [{ childKnotIndex: 0, refinedKnotIndex: null, value: parameter, origin: 'requested-clamp' }, ...knots.slice(first).map((value, i): SurfaceSplitKnotMapping => ({ childKnotIndex: i + 1, refinedKnotIndex: first + i, value, origin: 'refined-copy' }))];
      const countU = axis === 'u' ? count : refinedGrid.u, countV = axis === 'v' ? count : refinedGrid.v, poleMappings: SurfaceSplitPoleMapping[] = [];
      const controlPoints = Array.from({ length: countU }, (_, u) => Array.from({ length: countV }, (_, v) => {
        const refinedUIndex = axis === 'u' ? u + offset : u, refinedVIndex = axis === 'v' ? v + offset : v;
        poleMappings.push({ refinedUIndex, refinedVIndex, childUIndex: u, childVIndex: v });
        return copyCadData(refined.controlPoints[refinedUIndex][refinedVIndex]);
      }));
      const weights = Array.from({ length: countU }, (_, u) => Array.from({ length: countV }, (_, v) => refined.weights[axis === 'u' ? u + offset : u][axis === 'v' ? v + offset : v]));
      const surface: Surface = { kind: 'surface', id: surfaceId, degreeU: refined.degreeU, degreeV: refined.degreeV,
        knotsU: copyCadData(axis === 'u' ? selectedKnots.map(k => k.value) : nonselected), knotsV: copyCadData(axis === 'v' ? selectedKnots.map(k => k.value) : nonselected), controlPoints, weights };
      admit(surface);
      return { surface, provenance: { side, surfaceId, poleMappings, selectedKnots, nonselectedKnots: nonselected.map((value, i) => ({ childKnotIndex: i, refinedKnotIndex: i, value, origin: 'refined-copy' })) } };
    };
    const stagedLower = makeChild('lower', lowerId), stagedUpper = makeChild('upper', upperId);
    const decimal = (n: number) => curveDecimal(n, LABEL), list = (values: number[]) => '[' + values.map(decimal).join(',') + ']';
    const literal = (s: Surface) => '@surface #' + s.id + ' { type:nurbs; degree-u:' + decimal(s.degreeU) + '; degree-v:' + decimal(s.degreeV) + '; knots-u:' + list(s.knotsU) + '; knots-v:' + list(s.knotsV) + '; control-points:[' + s.controlPoints.map(row => '[' + row.map(list).join(',') + ']').join(',') + ']; weights:[' + s.weights.map(list).join(',') + ']; }';
    const source = '@model ' + original.id + ' { version:0; length-unit:mm; ' + literal(stagedLower.surface) + ' ' + literal(stagedUpper.surface) + ' }\n';
    check(source.length <= 262144, 'generated source exceeds compiler bound');
    const compiled = compileCadModel(source, { sourceVersion: 0 });
    check(compiled.ok, 'actual two-Surface source0 compilation required' + (compiled.ok ? '' : ': ' + compiled.diagnostics.map(d => d.message).join('; ')));
    const expected: Model = { name: original.id, version: 0, lengthUnit: 'mm', objects: [stagedLower.surface, stagedUpper.surface] };
    check(sameData(compiled.model, expected), 'actual source0 must preserve complete two-Surface Model/order/IDs/knot/weight/coordinate bits');
    const [lower, upper] = compiled.model.objects as Surface[], lowerDomain = surfaceDomain(lower), upperDomain = surfaceDomain(upper);
    check(Object.is(lowerDomain[axis][0], originalDomain[axis][0]) && Object.is(upperDomain[axis][1], originalDomain[axis][1]) && lowerDomain[axis][1] === parameter && upperDomain[axis][0] === parameter
      && sameData(lowerDomain[other], originalDomain[other]) && sameData(upperDomain[other], originalDomain[other]), 'actual child domains must partition original numeric parameter and retain outer/nonselected endpoint bits');
    for (const child of [{ surface: lower, provenance: stagedLower.provenance }, { surface: upper, provenance: stagedUpper.provenance }]) {
      for (const m of child.provenance.poleMappings) check(sameData(child.surface.controlPoints[m.childUIndex][m.childVIndex], refined.controlPoints[m.refinedUIndex][m.refinedVIndex]) && Object.is(child.surface.weights[m.childUIndex][m.childVIndex], refined.weights[m.refinedUIndex][m.refinedVIndex]), 'direct child pole/weight bits must remain');
      const childKnots = axis === 'u' ? child.surface.knotsU : child.surface.knotsV;
      for (const m of child.provenance.selectedKnots) check(Object.is(childKnots[m.childKnotIndex], m.refinedKnotIndex === null ? parameter : knots[m.refinedKnotIndex]), 'copied selected knots and requested new clamp signs must remain');
      check(sameData(axis === 'u' ? child.surface.knotsV : child.surface.knotsU, nonselected), 'nonselected knot bits must remain');
    }
    const shared: SurfaceSplitSharedCoefficients = { refinedAxisPoleIndex: common, lowerAxisPoleIndex: common, upperAxisPoleIndex: 0,
      coefficients: Array.from({ length: refinedGrid[other] }, (_, varyingPoleIndex) => ({ varyingPoleIndex, pointMM: copyCadData(axis === 'u' ? refined.controlPoints[common][varyingPoleIndex] : refined.controlPoints[varyingPoleIndex][common]), weight: axis === 'u' ? refined.weights[common][varyingPoleIndex] : refined.weights[varyingPoleIndex][common] })),
      lowerBoundary: axis === 'u' ? 'u-max' : 'v-max', upperBoundary: axis === 'u' ? 'u-min' : 'v-min', lowerDirection: axis === 'u' ? 'increasing' : 'decreasing', upperDirection: axis === 'u' ? 'decreasing' : 'increasing' };
    const [min, max] = originalDomain[other], mid = midpoint(min, max), perpendicular = mid > min && mid < max ? [min, mid, max] : [min, max];
    const observations = ([{ side: 'lower' as const, surface: lower, domain: lowerDomain }, { side: 'upper' as const, surface: upper, domain: upperDomain }]).flatMap(child =>
      samples(axis === 'u' ? child.surface.knotsU : child.surface.knotsV, child.domain[axis]).flatMap(parameter => perpendicular.map(fixed => {
        const u = axis === 'u' ? parameter : fixed, v = axis === 'u' ? fixed : parameter, originalPointMM = evaluateSurface(original, u, v), childPointMM = evaluateSurface(child.surface, u, v), differenceMM = Math.hypot(...childPointMM.map((n, i) => n - originalPointMM[i]));
        check(Number.isFinite(differenceMM) && differenceMM <= 1e-7, 'local original/child point observation exceeds 1e-7 mm');
        return { side: child.side, surfaceId: child.surface.id, u, v, originalPointMM, childPointMM, differenceMM };
      })));
    check(observations.length <= 128, 'native observation bound exceeded');
    const lowerCut = lowerDomain[axis][1], upperCut = upperDomain[axis][0];
    return copyCadData({ original, refined, lower, upper, source, sourceVersion: 0, model: compiled.model,
      provenance: { kind: 'surface-parameter-split', sourceSurfaceId: original.id, axis, parameter, firstRefinedKnotIndex: first, refinement, lower: stagedLower.provenance, upper: stagedUpper.provenance, shared },
      report: { kind: 'surface-parameter-split', surfaceId: original.id, lengthUnit: 'mm', axis, parameter, selectedDegree: degree, originalMultiplicity, requiredInsertions, refinedMultiplicity: degree,
        grids: { original: grid(original), refined: refinedGrid, lower: grid(lower), upper: grid(upper) }, domains: { original: originalDomain, refined: refinedDomain, lower: lowerDomain, upper: upperDomain },
        cutEndpoints: { requested: parameter, lower: lowerCut, upper: upperCut, negativeZero: { requested: Object.is(parameter, -0), lower: Object.is(lowerCut, -0), upper: Object.is(upperCut, -0) } },
        selectedAxisKnotGuards: { original: guarded(originalKnots, degree, originalDomain[axis], parameter), refined: guarded(knots, degree, refinedDomain[axis], parameter), lowerEndpoint: guarded(axis === 'u' ? lower.knotsU : lower.knotsV, degree, lowerDomain[axis], parameter), upperEndpoint: guarded(axis === 'u' ? upper.knotsU : upper.knotsV, degree, upperDomain[axis], parameter) },
        derivativeSemantics: 'native-guards-unchanged', shared, observations, maximumObservedDifferenceMM: Math.max(...observations.map(o => o.differenceMM)), authority: 'original-surface-coefficients',
        geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        limits: { maximumGridAxis: 16, maximumPoles: 256, maximumDegree: 3, authoredIdCharacters: 48, snapshotValues: 4096, snapshotDepth: 8, arrayElements: 64, recordFields: 8, stringCharacters: 128, maximumObservations: 128, observationComparisonMM: 1e-7 } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid original Surface/split options';
    throw new Error((message.startsWith(LABEL) ? message : LABEL + ': ' + message).slice(0, 1024), { cause: error });
  }
}
