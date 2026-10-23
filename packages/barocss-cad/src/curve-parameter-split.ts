import { CadNumericPolicy, linearToleranceMM, geometryScaleMM } from './numeric-policy.js';
import { validateCurve, curveDomain, evaluateCurve } from './math.js';
import { insertCurveKnot } from './curve-knot-insertion.js';
import type { CurveKnotInsertionProvenance, CurveKnotUnchangedPole, CurveKnotUnchangedKnot } from './curve-knot-insertion.js';
import { compileCadModel } from './model-compiler.js';
import { curveDecimal, requireCurveValue } from './curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Model, Point } from './types.js';
import { same as sameData } from './structural-equality.js';
import { guardKnots } from './knot-guard.js';

export interface CurveParameterSplitOptions { parameter: number; lowerCurveId: string; upperCurveId: string }
export interface CurveSplitPoleMapping { refinedPoleIndex: number; childPoleIndex: number }
export interface CurveSplitKnotMapping { childKnotIndex: number; refinedKnotIndex: number | null; value: number; origin: 'refined-copy' | 'requested-clamp' }
export interface CurveSplitChildProvenance { side: 'lower' | 'upper'; curveId: string; poleMappings: CurveSplitPoleMapping[]; knots: CurveSplitKnotMapping[] }
export interface CurveSplitRefinementProvenance {
  kind: 'knot-insertion' | 'direct-copy'; insertions: number; operation: CurveKnotInsertionProvenance | null;
  unchangedPoles: CurveKnotUnchangedPole[]; unchangedKnots: CurveKnotUnchangedKnot[];
}
export interface CurveSplitSharedCoefficient { refinedPoleIndex: number; lowerPoleIndex: number; upperPoleIndex: number; pointMM: Point; weight: number }
export interface CurveParameterSplitProvenance {
  kind: 'curve-parameter-split'; sourceCurveId: string; parameter: number; firstRefinedKnotIndex: number;
  refinement: CurveSplitRefinementProvenance; lower: CurveSplitChildProvenance; upper: CurveSplitChildProvenance; shared: CurveSplitSharedCoefficient;
}
export interface CurveParameterSplitReport {
  kind: 'curve-parameter-split'; curveId: string; lengthUnit: 'mm'; parameter: number; degree: number;
  originalMultiplicity: number; requiredInsertions: number; refinedMultiplicity: number;
  poleCounts: { original: number; refined: number; lower: number; upper: number };
  domains: { original: [number, number]; refined: [number, number]; lower: [number, number]; upper: [number, number] };
  cutEndpoints: { requested: number; lower: number; upper: number; negativeZero: { requested: boolean; lower: boolean; upper: boolean } };
  cutKnotGuards: { original: boolean; refined: boolean; lowerEndpoint: boolean; upperEndpoint: boolean };
  guardedKnots: { original: number[]; refined: number[]; lower: number[]; upper: number[] }; derivativeSemantics: 'native-guards-unchanged';
  shared: CurveSplitSharedCoefficient;
  sharedCutPoints: { originalPointMM: Point; refinedPointMM: Point; lowerPointMM: Point; upperPointMM: Point; maximumObservedDifferenceMM: number };
  observations: { side: 'lower' | 'upper'; curveId: string; parameter: number; originalPointMM: Point; refinedPointMM: Point; childPointMM: Point; originalDifferenceMM: number; refinedDifferenceMM: number }[];
  maximumObservedDifferenceMM: number; authority: 'original-curve-coefficients'; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { maximumPoles: 16; maximumDegree: 3; authoredIdCharacters: 48; snapshotValues: 1024; snapshotDepth: 6;
    arrayElements: 64; recordFields: 8; stringCharacters: 128; maximumObservations: 64; observationComparisonMM: number };
}
export interface CurveParameterSplitResult {
  original: Curve; refined: Curve; lower: Curve; upper: Curve; source: string; sourceVersion: 0; model: Model;
  provenance: CurveParameterSplitProvenance; report: CurveParameterSplitReport;
}
const LABEL = 'Curve parameter split';
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

function admit(input: unknown): Curve {
  const data = record(input, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']);
  check(data.kind === 'curve', 'original Curve required'); id(data.id);
  check(typeof data.degree === 'number' && Number.isInteger(data.degree) && data.degree >= 1 && data.degree <= 3, 'degree 1..3 required');
  check(Array.isArray(data.controlPoints) && data.controlPoints.length >= 2 && data.controlPoints.length <= 16, 'original poles 2..16 required');
  const curve = data as unknown as Curve; validateCurve(curve);
  check(curve.controlPoints.every(p => p.every(n => Math.abs(n) <= CadNumericPolicy.geometryCoordinateAbsMM)), 'XYZ coordinates within the geometry range +/-' + CadNumericPolicy.geometryCoordinateAbsMM + ' mm required');
  return curve;
}
function guarded(curve: Curve, parameter: number): boolean {
  const [min, max] = curveDomain(curve);
  return parameter > min && parameter < max && curve.knots.filter(k => k === parameter).length >= curve.degree;
}
/** Observation tolerance of the current split: CadNumericPolicy.linearToleranceMM of the curve (1e-7 mm within the modeling range). */
let observationTolerance = 1e-7;
function difference(a: Point, b: Point): number {
  const d = Math.hypot(...a.map((n, i) => n - b[i])); check(Number.isFinite(d) && d <= observationTolerance, 'local native point observation exceeds ' + observationTolerance + ' mm'); return d;
}
/** Two increasing-parameter native Curves through actual original knot refinement. */
export function splitCurveAtParameter(input: Curve, options: CurveParameterSplitOptions): CurveParameterSplitResult {
  try {
    const originalData = snapshot(input), optionData = snapshot(options), original = admit(originalData);
    observationTolerance = linearToleranceMM(geometryScaleMM(original.controlPoints));
    const settings = record(optionData, ['parameter', 'lowerCurveId', 'upperCurveId']);
    const parameter = settings.parameter, lowerId = id(settings.lowerCurveId), upperId = id(settings.upperCurveId), originalDomain = curveDomain(original);
    check(new Set([original.id, lowerId, upperId]).size === 3, 'original and child Curve IDs must differ');
    check(typeof parameter === 'number' && Number.isFinite(parameter) && parameter > originalDomain[0] && parameter < originalDomain[1], 'finite strictly interior original-domain split parameter required');
    const originalMultiplicity = original.knots.filter(k => k === parameter).length, requiredInsertions = original.degree - originalMultiplicity;
    check(requiredInsertions >= 0 && requiredInsertions <= 3, 'native numeric multiplicity must not exceed degree');
    const inserted = requiredInsertions === 0 ? null : insertCurveKnot(original, { knot: parameter, insertions: requiredInsertions });
    const refined = inserted === null ? copyCadData(original) : inserted.refined, refinedDomain = curveDomain(refined), first = refined.knots.findIndex(k => k === parameter), common = first - 1;
    check(sameData(refinedDomain, originalDomain) && refined.id === original.id && refined.degree === original.degree, 'refinement must retain original ID/degree/domain bits');
    check(first >= refined.degree + 1 && common >= 1 && common < refined.controlPoints.length - 1 && refined.knots.filter(k => k === parameter).length === refined.degree, 'degree-multiplicity interior cut and shared pole required');
    const refinement: CurveSplitRefinementProvenance = {
      kind: inserted === null ? 'direct-copy' : 'knot-insertion', insertions: requiredInsertions, operation: inserted?.provenance ?? null,
      unchangedPoles: inserted?.provenance.unchangedPoles ?? original.controlPoints.map((_, i) => ({ originalPoleIndex: i, refinedPoleIndex: i })),
      unchangedKnots: inserted?.provenance.unchangedKnots ?? original.knots.map((_, i) => ({ originalKnotIndex: i, refinedKnotIndex: i })),
    };
    const makeChild = (side: 'lower' | 'upper', curveId: string): { curve: Curve; provenance: CurveSplitChildProvenance } => {
      const offset = side === 'lower' ? 0 : common, count = side === 'lower' ? common + 1 : refined.controlPoints.length - common;
      const knots: CurveSplitKnotMapping[] = side === 'lower'
        ? [...refined.knots.slice(0, first + refined.degree).map((value, i): CurveSplitKnotMapping => ({ childKnotIndex: i, refinedKnotIndex: i, value, origin: 'refined-copy' })), { childKnotIndex: first + refined.degree, refinedKnotIndex: null, value: parameter, origin: 'requested-clamp' }]
        : [{ childKnotIndex: 0, refinedKnotIndex: null, value: parameter, origin: 'requested-clamp' }, ...refined.knots.slice(first).map((value, i): CurveSplitKnotMapping => ({ childKnotIndex: i + 1, refinedKnotIndex: first + i, value, origin: 'refined-copy' }))];
      const poleMappings = Array.from({ length: count }, (_, i) => ({ refinedPoleIndex: i + offset, childPoleIndex: i }));
      const curve: Curve = { kind: 'curve', id: curveId, degree: refined.degree, knots: knots.map(k => k.value), controlPoints: poleMappings.map(m => copyCadData(refined.controlPoints[m.refinedPoleIndex])), weights: poleMappings.map(m => refined.weights[m.refinedPoleIndex]) };
      admit(curve);
      return { curve, provenance: { side, curveId, poleMappings, knots } };
    };
    const stagedLower = makeChild('lower', lowerId), stagedUpper = makeChild('upper', upperId);
    const decimal = (n: number) => curveDecimal(n, LABEL), list = (values: number[]) => '[' + values.map(decimal).join(',') + ']';
    const literal = (c: Curve) => '@curve #' + c.id + ' { type:nurbs; degree:' + decimal(c.degree) + '; knots:' + list(c.knots) + '; control-points:[' + c.controlPoints.map(list).join(',') + ']; weights:' + list(c.weights) + '; }';
    const source = '@model ' + original.id + ' { version:0; length-unit:mm; ' + literal(stagedLower.curve) + ' ' + literal(stagedUpper.curve) + ' }\n';
    check(source.length <= 262144, 'generated source exceeds compiler bound');
    const compiled = compileCadModel(source, { sourceVersion: 0 });
    check(compiled.ok, 'actual two-Curve source0 compilation required' + (compiled.ok ? '' : ': ' + compiled.diagnostics.map(d => d.message).join('; ')));
    const expected: Model = { name: original.id, version: 0, lengthUnit: 'mm', objects: [stagedLower.curve, stagedUpper.curve] };
    check(sameData(compiled.model, expected), 'actual source0 must preserve complete two-Curve Model/order/IDs/knot/pole/weight bits');
    const [lower, upper] = compiled.model.objects as Curve[], lowerDomain = curveDomain(lower), upperDomain = curveDomain(upper);
    check(Object.is(lowerDomain[0], originalDomain[0]) && Object.is(upperDomain[1], originalDomain[1]) && lowerDomain[1] === parameter && upperDomain[0] === parameter, 'child domains must partition numeric cut and retain original outer endpoint bits');
    for (const child of [{ curve: lower, provenance: stagedLower.provenance }, { curve: upper, provenance: stagedUpper.provenance }]) {
      for (const m of child.provenance.poleMappings) check(sameData(child.curve.controlPoints[m.childPoleIndex], refined.controlPoints[m.refinedPoleIndex]) && Object.is(child.curve.weights[m.childPoleIndex], refined.weights[m.refinedPoleIndex]), 'direct child pole/weight bits must remain');
      for (const m of child.provenance.knots) check(Object.is(child.curve.knots[m.childKnotIndex], m.refinedKnotIndex === null ? parameter : refined.knots[m.refinedKnotIndex]), 'retained knots and new requested clamp signs must remain');
    }
    const shared: CurveSplitSharedCoefficient = { refinedPoleIndex: common, lowerPoleIndex: common, upperPoleIndex: 0, pointMM: copyCadData(refined.controlPoints[common]), weight: refined.weights[common] };
    check(sameData(lower.controlPoints[common], upper.controlPoints[0]) && Object.is(lower.weights[common], upper.weights[0]), 'shared child pole/weight bits must agree');
    const observations = ([{ side: 'lower' as const, curve: lower }, { side: 'upper' as const, curve: upper }]).flatMap(child => samples(child.curve).map(parameter => {
      const originalPointMM = evaluateCurve(original, parameter), refinedPointMM = evaluateCurve(refined, parameter), childPointMM = evaluateCurve(child.curve, parameter);
      return { side: child.side, curveId: child.curve.id, parameter, originalPointMM, refinedPointMM, childPointMM, originalDifferenceMM: difference(originalPointMM, childPointMM), refinedDifferenceMM: difference(refinedPointMM, childPointMM) };
    }));
    check(observations.length <= 64, 'native observation bound exceeded');
    const originalPointMM = evaluateCurve(original, parameter), refinedPointMM = evaluateCurve(refined, parameter), lowerPointMM = evaluateCurve(lower, lowerDomain[1]), upperPointMM = evaluateCurve(upper, upperDomain[0]);
    const sharedCutPoints = { originalPointMM, refinedPointMM, lowerPointMM, upperPointMM,
      maximumObservedDifferenceMM: Math.max(difference(originalPointMM, lowerPointMM), difference(originalPointMM, upperPointMM), difference(refinedPointMM, lowerPointMM), difference(refinedPointMM, upperPointMM), difference(lowerPointMM, upperPointMM)) };
    const guards = (curve: Curve) => guardKnots(curve.knots, curve.degree, ...curveDomain(curve));
    return copyCadData({ original, refined, lower, upper, source, sourceVersion: 0, model: compiled.model,
      provenance: { kind: 'curve-parameter-split', sourceCurveId: original.id, parameter, firstRefinedKnotIndex: first, refinement, lower: stagedLower.provenance, upper: stagedUpper.provenance, shared },
      report: { kind: 'curve-parameter-split', curveId: original.id, lengthUnit: 'mm', parameter, degree: original.degree, originalMultiplicity, requiredInsertions, refinedMultiplicity: refined.degree,
        poleCounts: { original: original.controlPoints.length, refined: refined.controlPoints.length, lower: lower.controlPoints.length, upper: upper.controlPoints.length }, domains: { original: originalDomain, refined: refinedDomain, lower: lowerDomain, upper: upperDomain },
        cutEndpoints: { requested: parameter, lower: lowerDomain[1], upper: upperDomain[0], negativeZero: { requested: Object.is(parameter, -0), lower: Object.is(lowerDomain[1], -0), upper: Object.is(upperDomain[0], -0) } },
        cutKnotGuards: { original: guarded(original, parameter), refined: guarded(refined, parameter), lowerEndpoint: guarded(lower, parameter), upperEndpoint: guarded(upper, parameter) },
        guardedKnots: { original: guards(original), refined: guards(refined), lower: guards(lower), upper: guards(upper) }, derivativeSemantics: 'native-guards-unchanged', shared, sharedCutPoints, observations,
        maximumObservedDifferenceMM: Math.max(sharedCutPoints.maximumObservedDifferenceMM, ...observations.flatMap(o => [o.originalDifferenceMM, o.refinedDifferenceMM])), authority: 'original-curve-coefficients',
        geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        limits: { maximumPoles: 16, maximumDegree: 3, authoredIdCharacters: 48, snapshotValues: 1024, snapshotDepth: 6, arrayElements: 64, recordFields: 8, stringCharacters: 128, maximumObservations: 64, observationComparisonMM: observationTolerance } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid original Curve/split options';
    throw new Error((message.startsWith(LABEL) ? message : LABEL + ': ' + message).slice(0, 1024), { cause: error });
  }
}
