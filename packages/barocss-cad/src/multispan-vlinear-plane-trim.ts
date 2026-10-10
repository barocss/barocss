import { validateMultiSpanVLinearSurfacePlaneSection } from './multispan-vlinear-plane-section.js';
import type { MultiSpanVLinearSurfacePlaneSectionResult } from './multispan-vlinear-plane-section.js';
import { extractSurfaceBoundary } from './boundary.js';
import type { SurfaceBoundary } from './boundary.js';
import { extractCurveInterval } from './curve-interval-extraction.js';
import type { ExtractedCurveIntervalResult } from './curve-interval-extraction.js';
import { SectionRationalContext } from './section-rational-internal.js';
import type { SectionFraction, SectionRational } from './section-rational-internal.js';
import { compileCadModel } from './model-compiler.js';
import { curveDecimal } from './curve-source.js';
import { evaluateCurve, evaluateSurface, validateCurve } from './math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from './derivatives.js';
import type { CurveD1Result, SurfaceD1Result } from './derivatives.js';
import type { Curve, Model, Point, Surface } from './types.js';

export const MultiSpanVLinearSurfacePlaneTrimDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', SECTION: 'SECTION', UV: 'UV', INTERVAL: 'INTERVAL', REPRESENTABILITY: 'REPRESENTABILITY', BINDING: 'BINDING', NATIVE: 'NATIVE', OWNED: 'OWNED' } as const);
export type MultiSpanVLinearSurfacePlaneTrimDiagnosticCode = typeof MultiSpanVLinearSurfacePlaneTrimDiagnosticCode[keyof typeof MultiSpanVLinearSurfacePlaneTrimDiagnosticCode];
export class MultiSpanVLinearSurfacePlaneTrimError extends Error {
  readonly code: MultiSpanVLinearSurfacePlaneTrimDiagnosticCode;
  constructor(code: MultiSpanVLinearSurfacePlaneTrimDiagnosticCode, detail: string, cause?: unknown) {
    super(('Multi-span V-linear Plane trim: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'MultiSpanVLinearSurfacePlaneTrimError'; this.code = code;
  }
}
export interface MultiSpanVLinearSurfacePlaneTrimOptions { evaluationId: string; resultIdPrefix: string; maximumBoundaries: number; maximumIntervals: number; maximumObservations: number }
type Bound = { exact: SectionFraction; upper: number };
type Role = 'bottom' | 'rightLow' | 'rightHigh' | 'top' | 'leftLow' | 'leftHigh' | 'sharedCut';
type Vertex = { id: string; sourceId: string; surfaceId: string; role: 'bottomLeft' | 'bottomRight' | 'topRight' | 'topLeft' | 'cutLeft' | 'cutRight'; uv: Point };
export interface MultiSpanVLinearSurfacePlaneTrimEdge {
  id: string; role: Role; curve: Curve; vertexIds: [string, string];
  pcurve: { coordinateSystem: 'native-surface-uv'; lengthUnit: 'dimensionless'; curve: Curve };
  origin: { kind: 'natural-boundary' | 'interval' | 'section'; index: number };
}
type Use = { id: string; edgeId: string; vertexIds: [string, string]; sense: 'forward' | 'reverse'; interval: [number, number]; pcurveId: string };
type Loop = { id: string; uses: [Use, Use, Use, Use] };
type Face = { id: string; sourceId: string; surfaceId: string; outerLoopId: string; orientation: 'forward'; region: 'below-stored-uv-graph' | 'above-stored-uv-graph' };
type Cut = { boundaryIndex: number; requestedV: number; requestedParameter: SectionFraction; roundedParameter: number; mappedV: SectionFraction; vError: Bound };
type Restriction = { intervalIndex: number; boundaryIndex: number; idealHomogeneous: SectionFraction[][]; storedHomogeneous: SectionFraction[][]; crossDifference: SectionFraction[][];
  minimumIdealWeight: SectionFraction; minimumStoredWeight: SectionFraction; restrictionGap: Bound; uvEndpointErrors: [SectionFraction, SectionFraction]; uvMappingError: Bound; surfaceMappingGap: Bound; modelGap: Bound };
type Proof = {
  uvMonotonicity: { spans: { index: number; domain: [number, number]; poleIndices: number[]; degree: number; coefficients: SectionFraction[]; minimumCoefficient: SectionFraction }[]; nativeParameterDerivative: true; allStrictPositive: true; endpointUExact: true; allVPolesStrictInterior: true };
  naturalBoundaryKnots: { boundaryIndex: number; sourceAxis: 'u' | 'v'; reversed: boolean; originalKnots: number[]; actualKnots: number[]; expectedKnots: SectionFraction[] }[];
  cuts: { left: Cut; right: Cut }; restrictions: Restriction[];
  edgeBounds: { edgeId: string; role: Role; kind: 'exact-native-boundary' | 'restriction-and-uv-map' | 'inherited-section'; bound: Bound }[];
};
type D1State<T> = { status: 'evaluated'; value: T } | { status: 'native-refused'; reason: string; nativeErrorName: string };
type Observation = { edgeId: string; edgeIndex: number; index: number; parameter: number;
  world: { d0: Point; d1: D1State<CurveD1Result> }; pcurve: { d0: Point; d1: D1State<CurveD1Result> }; support: { d0: Point; d1: D1State<SurfaceD1Result> }; chain: Point | null;
  residuals: { pointGapMM: number; worldD0D1PointGapMM: number | null; uvD0D1PointGap: number | null; supportD0D1PointGapMM: number | null; relativeChainGap: number | null } };
export interface MultiSpanVLinearSurfacePlaneTrimReport {
  schema: 'barocss-multispan-vlinear-surface-plane-trim-candidates'; version: 0; evaluationId: string; sourceId: string; surfaceId: string; lengthUnit: 'mm'; uvLengthUnit: 'dimensionless';
  spanCount: number; derivativeCounts: Record<'world' | 'pcurve' | 'support', { evaluated: number; refused: number }>;
  vertexCount: 6; edgeCount: 7; loopCount: 2; faceCount: 2; worldObjectCount: 8; sharedCutEdgeId: string; storedUVSimpleGraphCertified: true; orientedUVCyclesCertified: true; logicalIncidenceClosed: true;
  wholeEdgeModelGapCertified: true; maximumWholeEdgeModelGapMM: number; maximumObservedPointGapMM: number; maximumObservedRelativeChainGap: number;
  edgeModelGaps: Proof['edgeBounds']; rationalCounts: ReturnType<SectionRationalContext['counts']>;
  directCounts: { sectionValidationCount: 1; boundaryExtractionCount: 4; intervalExtractionCount: 4; worldSourceCompilationCount: 1; uvCurveValidationCount: 6; observationCount: number; curvePointEvaluationCount: number; curveDerivativeEvaluationCount: number; surfacePointEvaluationCount: number; surfaceDerivativeEvaluationCount: number };
  numericPolicy: { authority: 'exact-coefficient-models-with-local-native-observations'; uvClosure: 'unchanged-stored-cut-endpoint-poles-and-nominal-linear-sidecars'; reflection: 'exact-natural-knot-reflection-and-actual-affine-inverse-nearest-even-no-snap'; restriction: 'exact-degree2-cross-product-and-positive-denominator-bound'; pointComparisonMM: 1e-7; relativeChainComparison: 1e-7; boundRounding: 'upward-including-positive-subnormal'; planeSide: 'candidate-region-relative-to-stored-uv-graph-no-ideal-plane-side-guarantee' };
  quality: { geometricValidity: 'not-certified'; topologyCertified: false; solid: false; insideOutsideCertified: false; embeddedManifoldCertified: false; globalBinary64EvaluationErrorCertified: false; manufacturingToleranceCertified: false; supportRegularityCertified: false; globalD1ErrorCertified: false; weldingPerformed: false; parentProofsUnchanged: true; ownership: 'independent-copied-cpu-data-gc' };
  limits: { maximumBoundaries: 4; maximumIntervals: 4; maximumObservations: 63; maximumSpans: 4; maximumMonotonicityDegree: 5; maximumGapDegree: 2; maximumWorldObjects: 8; prefixCharacters: 12; ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64; stringCharacters: 262144; rationalOperations: 200000; gcdSteps: 200000; rationalIntegerBits: 8192; fractionIntegerCharacters: 5000; floatSearchStepsPerConversion: 64 };
  workScope: 'direct-root-calls-only-full-inherited-child-work-retained-and-excluded'; budgetFailure: 'atomic-no-partial-trim-candidates';
}
export interface MultiSpanVLinearSurfacePlaneTrimResult {
  section: MultiSpanVLinearSurfacePlaneSectionResult; options: MultiSpanVLinearSurfacePlaneTrimOptions; boundaries: Curve[]; intervals: ExtractedCurveIntervalResult[];
  world: { source: string; sourceVersion: 0; model: Model }; vertices: Vertex[]; edges: MultiSpanVLinearSurfacePlaneTrimEdge[]; loops: [Loop, Loop]; faces: [Face, Face]; proof: Proof; observations: Observation[]; report: MultiSpanVLinearSurfacePlaneTrimReport;
}

const CODE = MultiSpanVLinearSurfacePlaneTrimDiagnosticCode, BOUNDARIES: SurfaceBoundary[] = ['v-min', 'u-max', 'v-max', 'u-min'];
function check(condition: boolean, code: MultiSpanVLinearSurfacePlaneTrimDiagnosticCode, detail: string): asserts condition { if (!condition) throw new MultiSpanVLinearSurfacePlaneTrimError(code, detail); }
function child<T>(action: () => T, code: MultiSpanVLinearSurfacePlaneTrimDiagnosticCode, detail: string): T { try { return action(); } catch (cause) { throw new MultiSpanVLinearSurfacePlaneTrimError(code, detail, cause); } }
function record(input: unknown, fields: string[], code: MultiSpanVLinearSurfacePlaneTrimDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'An own record is required'); const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required'); return data;
}
function id(input: unknown, maximum = 48): string { check(typeof input === 'string' && input.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(input), CODE.IDENTITY, 'A bounded ASCII ID is required'); return input; }
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT; let remaining = 1048576; const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 64, owned ? CODE.OWNED : CODE.BUDGET, 'Own value/depth budget exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'Finite own numbers are required'); return value; }
    if (typeof value === 'string') { check(value.length <= 262144, owned ? CODE.OWNED : CODE.BUDGET, 'Own string budget exceeded'); return value; }
    check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic own data is required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Plain own data is required');
    check(keys.length <= (array ? 8193 : 64) && keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'Bounded fields without getters/symbols/hidden data are required');
    ancestors.add(value); let result: unknown;
    if (array) { const length = descriptors.length.value as number; check(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, code, 'Dense bounded arrays are required');
      result = Array.from({ length }, (_, index) => { check(Object.hasOwn(descriptors, String(index)), code, 'Sparse/extra array fields are refused'); return copy(descriptors[String(index)].value, depth + 1); });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  };
  try { return copy(input, 0); } catch (cause) { if (cause instanceof MultiSpanVLinearSurfacePlaneTrimError) throw cause; throw new MultiSpanVLinearSurfacePlaneTrimError(code, 'Own snapshot failed', cause); }
}
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => same(value, b[index]));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const x = a as Record<string, unknown>, y = b as Record<string, unknown>; return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(key => Object.hasOwn(y, key) && same(x[key], y[key])); } return Object.is(a, b);
}
function domain(curve: Curve): [number, number] { return [curve.knots[curve.degree], curve.knots[curve.controlPoints.length]]; }
function comb(n: number, k: number): number { return [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1], [1, 5, 10, 10, 5, 1]][n][k]; }
function finite(value: number): number { check(Number.isFinite(value), CODE.BINDING, 'Native binding arithmetic is not finite'); return value; }
function gap(a: Point, b: Point): number { return finite(Math.hypot(...a.map((value, index) => finite(value - b[index])))); }
function sourceModel(surface: Surface, edges: MultiSpanVLinearSurfacePlaneTrimEdge[], name: string): { source: string; sourceVersion: 0; model: Model } {
  const decimal = (value: number) => curveDecimal(value, 'V-linear Plane trim'), list = (values: number[]) => '[' + values.map(decimal).join(',') + ']', points = (values: Point[]) => '[' + values.map(list).join(',') + ']';
  const source = '@model ' + name + ' { version:0; length-unit:mm; @surface #' + surface.id + ' { type:nurbs; degree-u:' + decimal(surface.degreeU) + '; degree-v:' + decimal(surface.degreeV) + '; knots-u:' + list(surface.knotsU) + '; knots-v:' + list(surface.knotsV) + '; control-points:[' + surface.controlPoints.map(points).join(',') + ']; weights:[' + surface.weights.map(list).join(',') + ']; } '
    + edges.map(({ curve }) => '@curve #' + curve.id + ' { type:nurbs; degree:' + decimal(curve.degree) + '; knots:' + list(curve.knots) + '; control-points:' + points(curve.controlPoints) + '; weights:' + list(curve.weights) + '; }').join(' ') + ' }\n';
  check(source.length <= 262144, CODE.BUDGET, 'ASCII World Source0 exceeds its byte/code-unit budget');
  const compiled = child(() => compileCadModel(source, { sourceVersion: 0 }), CODE.NATIVE, 'Actual Model8 World source compilation failed');
  if (!compiled.ok) throw new MultiSpanVLinearSurfacePlaneTrimError(CODE.NATIVE, 'Actual World Source0 compiler refused', compiled);
  check(same(compiled.model, { name, version: 0, lengthUnit: 'mm', objects: [surface, ...edges.map(edge => edge.curve)] }), CODE.BINDING, 'Actual Model8 must retain complete Support and seven World Curve bits');
  return { source, sourceVersion: 0, model: compiled.model };
}

/** Construct two original-support trim candidates with simple UV cycles and seven whole coefficient-model position bounds. */
export function buildMultiSpanVLinearSurfacePlaneTrimCandidates(sectionInput: MultiSpanVLinearSurfacePlaneSectionResult, optionsInput: MultiSpanVLinearSurfacePlaneTrimOptions): MultiSpanVLinearSurfacePlaneTrimResult {
  const data = record(snapshot({ section: sectionInput, options: optionsInput }), ['section', 'options']), settings = record(data.options, ['evaluationId', 'resultIdPrefix', 'maximumBoundaries', 'maximumIntervals', 'maximumObservations']);
  const options: MultiSpanVLinearSurfacePlaneTrimOptions = { evaluationId: id(settings.evaluationId), resultIdPrefix: id(settings.resultIdPrefix, 12), maximumBoundaries: settings.maximumBoundaries as number, maximumIntervals: settings.maximumIntervals as number, maximumObservations: settings.maximumObservations as number };
  check(settings.maximumBoundaries === 4 && settings.maximumIntervals === 4 && settings.maximumObservations === 63, CODE.BUDGET, 'Exact complete fixed work budgets4/4/63 are required before child calls');
  const section = data.section as MultiSpanVLinearSurfacePlaneSectionResult;
  child(() => validateMultiSpanVLinearSurfacePlaneSection(section), CODE.SECTION, 'Actual whole1201 section validation refused');
  const support = section.surfaceAsset.surface, domains = section.report.surfaceDomains, cutCurve = section.pcurves.surface.curve;
  const contexts = new Set([section.surfaceAsset.sourceId, section.planeAsset.sourceId, ...Object.values(section.options).filter(value => typeof value === 'string') as string[], ...section.originalModels.flatMap(model => [model.name, ...model.objects.map(object => object.id)]), section.world.model.name, ...section.world.model.objects.map(object => object.id), section.pcurves.surface.curve.id, section.pcurves.plane.curve.id, 'curve_interval_original']);
  const reserve = (value: string) => { id(value); check(!contexts.has(value), CODE.IDENTITY, 'All generated identities must be unique against complete section/source/model contexts'); contexts.add(value); return value; };
  reserve(options.evaluationId); const prefix = options.resultIdPrefix;
  const boundaryIds = BOUNDARIES.map((_, index) => reserve(prefix + '_b' + index)), intervalIds = Array.from({ length: 4 }, (_, index) => reserve(prefix + '_c' + index));
  const intervalPrefixes = Array.from({ length: 4 }, (_, index) => { const value = reserve(prefix + '_i' + index); for (let cut = 0; cut < 2; cut++) for (const side of ['lo', 'hi']) reserve(value + '_cut_' + cut + '_' + side); return value; });
  const vertexIds = Array.from({ length: 6 }, (_, index) => reserve(prefix + '_v' + index)), edgeIds = Array.from({ length: 7 }, (_, index) => reserve(prefix + '_e' + index));
  const uvIds = Array.from({ length: 6 }, (_, index) => reserve(prefix + '_uv' + index)), loopIds = [reserve(prefix + '_l0'), reserve(prefix + '_l1')], faceIds = [reserve(prefix + '_f0'), reserve(prefix + '_f1')], useIds = Array.from({ length: 8 }, (_, index) => reserve(prefix + '_use' + index));
  const q = new SectionRationalContext((kind, detail) => { throw new MultiSpanVLinearSurfacePlaneTrimError(CODE[kind], detail); }), zero = q.integer(0), rv = (values: number[]) => values.map(value => q.from(value)), text = (values: SectionRational[]) => values.map(value => q.text(value));
  const read = (value: SectionFraction) => q.rat(BigInt(value.numerator), BigInt(value.denominator));
  const homogeneous = (curve: Curve) => curve.controlPoints.map((point, index) => { const weight = q.from(curve.weights[index]); return [...point.map(value => q.mul(q.from(value), weight)), weight]; });
  const multiply = (a: SectionRational[], b: SectionRational[]): SectionRational[] => {
    const m = a.length - 1, n = b.length - 1; check(m + n <= 5, CODE.BINDING, 'Bounded exact Bernstein product degree exceeded');
    return Array.from({ length: m + n + 1 }, (_, k) => q.sum(a.flatMap((value, i) => { const j = k - i; return j < 0 || j > n ? [] : [q.mul(q.div(q.integer(comb(m, i) * comb(n, j)), q.integer(comb(m + n, k))), q.mul(value, b[j]))]; })));
  };
  const minimum = (values: SectionRational[]) => values.reduce((a, b) => q.compare(a, b) <= 0 ? a : b), maxAbs = (values: SectionRational[]) => values.reduce((maximum, value) => q.max(maximum, q.abs(value)), zero);
  check(cutCurve.controlPoints.every(point => point[2] === 0 && q.compare(q.from(point[1]), q.from(domains.v[0])) > 0 && q.compare(q.from(point[1]), q.from(domains.v[1])) < 0), CODE.UV, 'Every stored cut V pole must be strictly inside the original V chart');
  // A global piecewise curve is not one Bernstein polynomial. Prove each actual span.
  const monotoneSpans = section.proof.spans.map(original => {
    const poleIndices = original.surfacePcurvePoleIndices, local: Curve = { ...cutCurve, controlPoints: poleIndices.map(index => cutCurve.controlPoints[index]), weights: poleIndices.map(index => cutCurve.weights[index]) };
    const h = homogeneous(local), d = cutCurve.degree, span = q.sub(q.from(original.domain[1]), q.from(original.domain[0])), uN = h.map(pole => pole[0]), weights = h.map(pole => pole[3]);
    check(h.length === d + 1 && weights.every(weight => q.compare(weight, zero) > 0) && q.compare(q.from(local.controlPoints[0][0]), q.from(original.domain[0])) === 0 && q.compare(q.from(local.controlPoints.at(-1)![0]), q.from(original.domain[1])) === 0, CODE.UV, 'Each stored UV span requires positive weights and exact original U endpoints');
    const derivative = (values: SectionRational[]) => values.slice(0, -1).map((value, index) => q.div(q.mul(q.integer(d), q.sub(values[index + 1], value)), span));
    const first = multiply(derivative(uN), weights), second = multiply(uN, derivative(weights)), coefficients = first.map((value, index) => q.sub(value, second[index]));
    check(coefficients.every(value => q.compare(value, zero) > 0), CODE.UV, 'Every actual stored UV span U-derivative numerator must have strictly positive Bernstein coefficients');
    return { index: original.index, domain: original.domain, poleIndices, degree: 2 * d - 1, coefficients: text(coefficients), minimumCoefficient: q.text(minimum(coefficients)) };
  });
  const uvMonotonicity: Proof['uvMonotonicity'] = { spans: monotoneSpans, nativeParameterDerivative: true, allStrictPositive: true, endpointUExact: true, allVPolesStrictInterior: true };
  const boundaries = BOUNDARIES.map((boundary, index) => child(() => extractSurfaceBoundary(support, { boundary, id: boundaryIds[index] }), CODE.NATIVE, 'Actual natural boundary extraction failed at ' + boundary));
  // Copied coefficients imply a zero boundary gap only with the exact reflected basis.
  const naturalBoundaryKnots: Proof['naturalBoundaryKnots'] = boundaries.map((boundary, boundaryIndex) => {
    const sourceAxis = boundaryIndex === 0 || boundaryIndex === 2 ? 'u' as const : 'v' as const;
    const originalKnots = sourceAxis === 'u' ? support.knotsU : support.knotsV, originalDomain = domains[sourceAxis], reversed = boundaryIndex >= 2;
    const sum = q.add(q.from(originalDomain[0]), q.from(originalDomain[1]));
    const expected = (reversed ? [...originalKnots].reverse() : originalKnots).map(knot => reversed ? q.sub(sum, q.from(knot)) : q.from(knot));
    check(boundary.knots.length === expected.length && boundary.knots.every((knot, index) => q.compare(q.from(knot), expected[index]) === 0), CODE.REPRESENTABILITY, 'Actual natural boundary knot reflection must equal the exact original affine reflection');
    return { boundaryIndex, sourceAxis, reversed, originalKnots, actualKnots: boundary.knots, expectedKnots: text(expected) };
  });
  const nominalLeft = cutCurve.controlPoints[0][1], nominalRight = cutCurve.controlPoints.at(-1)![1];
  const map = (boundaryIndex: number, parameter: SectionRational): SectionRational[] => {
    const actual = rv(domain(boundaries[boundaryIndex])), fraction = q.div(q.sub(parameter, actual[0]), q.sub(actual[1], actual[0]));
    if (boundaryIndex === 0) return [q.add(q.from(domains.u[0]), q.mul(q.sub(q.from(domains.u[1]), q.from(domains.u[0])), fraction)), q.from(domains.v[0]), zero];
    if (boundaryIndex === 2) return [q.sub(q.from(domains.u[1]), q.mul(q.sub(q.from(domains.u[1]), q.from(domains.u[0])), fraction)), q.from(domains.v[1]), zero];
    return [q.from(domains.u[boundaryIndex === 1 ? 1 : 0]), boundaryIndex === 1 ? q.add(q.from(domains.v[0]), q.mul(q.sub(q.from(domains.v[1]), q.from(domains.v[0])), fraction)) : q.sub(q.from(domains.v[1]), q.mul(q.sub(q.from(domains.v[1]), q.from(domains.v[0])), fraction)), zero];
  };
  const inverse = (boundaryIndex: number, requestedV: number): Cut => {
    const actual = rv(domain(boundaries[boundaryIndex])), v0 = q.from(domains.v[0]), v1 = q.from(domains.v[1]), fraction = boundaryIndex === 1 ? q.div(q.sub(q.from(requestedV), v0), q.sub(v1, v0)) : q.div(q.sub(v1, q.from(requestedV)), q.sub(v1, v0));
    const requestedParameter = q.add(actual[0], q.mul(q.sub(actual[1], actual[0]), fraction)), roundedParameter = q.nearest(requestedParameter), rounded = q.from(roundedParameter);
    check(q.compare(rounded, actual[0]) > 0 && q.compare(rounded, actual[1]) < 0, CODE.INTERVAL, 'The rounded exact affine inverse must remain strictly inside its actual natural boundary domain');
    const mapped = map(boundaryIndex, rounded)[1]; return { boundaryIndex, requestedV, requestedParameter: q.text(requestedParameter), roundedParameter, mappedV: q.text(mapped), vError: q.bound(q.abs(q.sub(mapped, q.from(requestedV)))) };
  };
  const cuts = { left: inverse(3, nominalLeft), right: inverse(1, nominalRight) }, leftDomain = domain(boundaries[3]), rightDomain = domain(boundaries[1]);
  const definitions: { boundaryIndex: number; interval: [number, number] }[] = [{ boundaryIndex: 1, interval: [rightDomain[0], cuts.right.roundedParameter] }, { boundaryIndex: 1, interval: [cuts.right.roundedParameter, rightDomain[1]] }, { boundaryIndex: 3, interval: [cuts.left.roundedParameter, leftDomain[1]] }, { boundaryIndex: 3, interval: [leftDomain[0], cuts.left.roundedParameter] }];
  const intervals = definitions.map((definition, index) => child(() => extractCurveInterval(boundaries[definition.boundaryIndex], { curveId: intervalIds[index], interval: definition.interval, resultIdPrefix: intervalPrefixes[index] }), CODE.INTERVAL, 'Actual original-parameter interval extraction failed at ' + index));
  const vertexRoles: Vertex['role'][] = ['bottomLeft', 'bottomRight', 'topRight', 'topLeft', 'cutLeft', 'cutRight'];
  const nominalUV: Point[] = [[domains.u[0], domains.v[0], 0], [domains.u[1], domains.v[0], 0], [domains.u[1], domains.v[1], 0], [domains.u[0], domains.v[1], 0], [...cutCurve.controlPoints[0]], [...cutCurve.controlPoints.at(-1)!]];
  const vertices: Vertex[] = nominalUV.map((uv, index) => ({ id: vertexIds[index], sourceId: section.surfaceAsset.sourceId, surfaceId: support.id, role: vertexRoles[index], uv }));
  const edgeDefinitions: { role: Role; curve: Curve; vertexIndices: [number, number]; origin: MultiSpanVLinearSurfacePlaneTrimEdge['origin'] }[] = [
    { role: 'bottom', curve: boundaries[0], vertexIndices: [0, 1], origin: { kind: 'natural-boundary', index: 0 } }, { role: 'rightLow', curve: intervals[0].curve, vertexIndices: [1, 5], origin: { kind: 'interval', index: 0 } },
    { role: 'rightHigh', curve: intervals[1].curve, vertexIndices: [5, 2], origin: { kind: 'interval', index: 1 } }, { role: 'top', curve: boundaries[2], vertexIndices: [2, 3], origin: { kind: 'natural-boundary', index: 2 } },
    { role: 'leftLow', curve: intervals[2].curve, vertexIndices: [4, 0], origin: { kind: 'interval', index: 2 } }, { role: 'leftHigh', curve: intervals[3].curve, vertexIndices: [3, 4], origin: { kind: 'interval', index: 3 } },
    { role: 'sharedCut', curve: section.world.curve, vertexIndices: [4, 5], origin: { kind: 'section', index: 0 } },
  ];
  const edges: MultiSpanVLinearSurfacePlaneTrimEdge[] = edgeDefinitions.map((definition, index) => {
    const endpoints = definition.vertexIndices.map(vertex => nominalUV[vertex]), actualDomain = domain(definition.curve);
    const pcurve = index === 6 ? { coordinateSystem: 'native-surface-uv' as const, lengthUnit: section.pcurves.surface.lengthUnit, curve: section.pcurves.surface.curve } : { coordinateSystem: 'native-surface-uv' as const, lengthUnit: 'dimensionless' as const, curve: { kind: 'curve' as const, id: uvIds[index], degree: 1, knots: [actualDomain[0], actualDomain[0], actualDomain[1], actualDomain[1]], controlPoints: endpoints, weights: [1, 1] } };
    if (index !== 6) child(() => validateCurve(pcurve.curve), CODE.NATIVE, 'Actual dimensionless linear UV Curve validation failed');
    check(same(pcurve.curve.controlPoints[0], endpoints[0]) && same(pcurve.curve.controlPoints.at(-1), endpoints[1]), CODE.BINDING, 'Every UV model endpoint must equal its unchanged nominal logical vertex');
    return { id: edgeIds[index], role: definition.role, curve: definition.curve, vertexIds: definition.vertexIndices.map(vertex => vertexIds[vertex]) as [string, string], pcurve, origin: definition.origin };
  });
  const lv = section.proof.spans.reduce((maximum, span) => q.max(maximum, read(span.lipschitz.surfaceV.exact)), zero), tolerance = q.from(1e-7), restrictions: Restriction[] = [];
  for (const [intervalIndex, result] of intervals.entries()) {
    const boundaryIndex = definitions[intervalIndex].boundaryIndex, original = boundaries[boundaryIndex], h = homogeneous(original), actualDomain = rv(domain(original));
    check(original.degree === 1 && h.length === 2 && result.curve.degree === 1 && result.curve.controlPoints.length === 2 && same(result.original, original) && same(result.provenance.effectiveInterval, domain(result.curve)), CODE.BINDING, 'Actual V1 interval proof must retain the complete original boundary and effective native interval');
    const ideal = domain(result.curve).map(parameter => { const alpha = q.div(q.sub(q.from(parameter), actualDomain[0]), q.sub(actualDomain[1], actualDomain[0])); return h[0].map((value, component) => q.add(value, q.mul(alpha, q.sub(h[1][component], value)))); }), stored = homogeneous(result.curve);
    const wi = ideal.map(value => value[3]), ws = stored.map(value => value[3]), minimumIdealWeight = minimum(wi), minimumStoredWeight = minimum(ws);
    check(q.compare(minimumIdealWeight, zero) > 0 && q.compare(minimumStoredWeight, zero) > 0, CODE.BINDING, 'Exact restriction and actual child denominator weights must remain positive');
    const crossByAxis = [0, 1, 2].map(axis => { const first = multiply(ideal.map(value => value[axis]), ws), second = multiply(stored.map(value => value[axis]), wi); return first.map((value, index) => q.sub(value, second[index])); });
    const restrictionGap = q.div(q.sum(crossByAxis.map(maxAbs)), q.mul(minimumIdealWeight, minimumStoredWeight));
    const edge = edges.find(value => value.origin.kind === 'interval' && value.origin.index === intervalIndex)!;
    const errors = domain(result.curve).map((parameter, index) => { const actualUV = map(boundaryIndex, q.from(parameter)), nominal = edge.pcurve.curve.controlPoints[index];
      check(q.compare(actualUV[0], q.from(nominal[0])) === 0, CODE.BINDING, 'Vertical interval nominal U must retain the exact original boundary U'); return q.abs(q.sub(actualUV[1], q.from(nominal[1]))); }) as [SectionRational, SectionRational];
    const uvMappingError = q.max(errors[0], errors[1]), surfaceMappingGap = q.mul(lv, uvMappingError), modelGap = q.add(restrictionGap, surfaceMappingGap);
    check(q.compare(modelGap, tolerance) <= 0, CODE.REPRESENTABILITY, 'Whole clipped-edge coefficient-model gap exceeds1e-7mm');
    restrictions.push({ intervalIndex, boundaryIndex, idealHomogeneous: ideal.map(text), storedHomogeneous: stored.map(text), crossDifference: [0, 1, 2].map(index => text(crossByAxis.map(axis => axis[index]))), minimumIdealWeight: q.text(minimumIdealWeight), minimumStoredWeight: q.text(minimumStoredWeight), restrictionGap: q.bound(restrictionGap), uvEndpointErrors: errors.map(error => q.text(error)) as [SectionFraction, SectionFraction], uvMappingError: q.bound(uvMappingError), surfaceMappingGap: q.bound(surfaceMappingGap), modelGap: q.bound(modelGap) });
  }
  const edgeBounds: Proof['edgeBounds'] = edges.map(edge => {
    const value = edge.origin.kind === 'section' ? read(section.proof.bounds.worldToSurface.exact) : edge.origin.kind === 'interval' ? read(restrictions[edge.origin.index].modelGap.exact) : zero;
    check(q.compare(value, tolerance) <= 0, CODE.REPRESENTABILITY, 'Every whole edge model gap must fit1e-7mm');
    return { edgeId: edge.id, role: edge.role, kind: edge.origin.kind === 'section' ? 'inherited-section' : edge.origin.kind === 'interval' ? 'restriction-and-uv-map' : 'exact-native-boundary', bound: q.bound(value) };
  });
  const proof: Proof = { uvMonotonicity, naturalBoundaryKnots, cuts, restrictions, edgeBounds };
  const loopDefinitions: [number, 'forward' | 'reverse'][][] = [[[0, 'forward'], [1, 'forward'], [6, 'reverse'], [4, 'forward']], [[6, 'forward'], [2, 'forward'], [3, 'forward'], [5, 'forward']]];
  const loops = loopDefinitions.map((definitions, loopIndex): Loop => {
    const uses = definitions.map(([index, sense], useIndex): Use => { const edge = edges[index], d = domain(edge.curve), reverse = sense === 'reverse'; return { id: useIds[4 * loopIndex + useIndex], edgeId: edge.id, vertexIds: reverse ? [edge.vertexIds[1], edge.vertexIds[0]] : edge.vertexIds, sense, interval: reverse ? [d[1], d[0]] : d, pcurveId: edge.pcurve.curve.id }; }) as [Use, Use, Use, Use];
    check(uses.every((use, index) => use.vertexIds[1] === uses[(index + 1) % 4].vertexIds[0]) && new Set(uses.map(use => use.vertexIds[0])).size === 4, CODE.BINDING, 'Each oriented four-use UV cycle must close on four distinct logical vertices'); return { id: loopIds[loopIndex], uses };
  }) as [Loop, Loop];
  const faces: [Face, Face] = [{ id: faceIds[0], sourceId: section.surfaceAsset.sourceId, surfaceId: support.id, outerLoopId: loops[0].id, orientation: 'forward', region: 'below-stored-uv-graph' }, { id: faceIds[1], sourceId: section.surfaceAsset.sourceId, surfaceId: support.id, outerLoopId: loops[1].id, orientation: 'forward', region: 'above-stored-uv-graph' }];
  const world = sourceModel(support, edges, options.evaluationId);
  const derivativeCounts: MultiSpanVLinearSurfacePlaneTrimReport['derivativeCounts'] = { world: { evaluated: 0, refused: 0 }, pcurve: { evaluated: 0, refused: 0 }, support: { evaluated: 0, refused: 0 } };
  const d1state = <T>(key: keyof typeof derivativeCounts, action: () => T): D1State<T> => {
    try { const value = action(); derivativeCounts[key].evaluated++; return { status: 'evaluated', value }; }
    catch (cause) {
      if (!(cause instanceof Error) || !/exact C0 interior knot/.test(cause.message)) throw new MultiSpanVLinearSurfacePlaneTrimError(CODE.NATIVE, 'Actual native D1 failed for ' + key, cause);
      derivativeCounts[key].refused++; return { status: 'native-refused', reason: cause.message, nativeErrorName: cause.name };
    }
  };
  const observations: Observation[] = edges.flatMap((edge, edgeIndex) => {
    const d = domain(edge.curve), parameters: number[] = [];
    if (edge.origin.kind === 'interval') {
      const midpoint = q.nearest(q.div(q.add(q.from(d[0]), q.from(d[1])), q.integer(2)));
      check(midpoint > d[0] && midpoint < d[1], CODE.REPRESENTABILITY, 'Each actual vertical edge midpoint must be distinctly represented'); parameters.push(d[0], midpoint, d[1]);
    } else {
      const breaks = edge.curve.knots.slice(edge.curve.degree, edge.curve.controlPoints.length + 1).filter((value, index, values) => index === 0 || !Object.is(value, values[index - 1]));
      for (let i = 0; i < breaks.length - 1; i++) {
        const a = q.from(breaks[i]), b = q.from(breaks[i + 1]), slots = Array.from({ length: 5 }, (_, j) => j === 0 ? breaks[i] : j === 4 ? breaks[i + 1] : q.nearest(q.add(a, q.mul(q.sub(b, a), q.div(q.integer(j), q.integer(4))))));
        check(slots.every((value, index) => index === 0 || value > slots[index - 1]), CODE.REPRESENTABILITY, 'Distinct actual edge-span quartile observation slots required'); parameters.push(...slots.slice(i === 0 ? 0 : 1));
      }
      check(parameters.length === 4 * section.report.spanCount + 1, CODE.BINDING, 'Long edge observations must retain every actual original span');
    }
    return parameters.map((parameter, index) => {
      const world = { d0: child(() => evaluateCurve(edge.curve, parameter), CODE.NATIVE, 'World edge D0 refused'), d1: d1state('world', () => evaluateCurveD1(edge.curve, parameter)) };
      const pcurve = { d0: child(() => evaluateCurve(edge.pcurve.curve, parameter), CODE.NATIVE, 'UV edge D0 refused'), d1: d1state('pcurve', () => evaluateCurveD1(edge.pcurve.curve, parameter)) };
      const original = { d0: child(() => evaluateSurface(support, pcurve.d0[0], pcurve.d0[1]), CODE.NATIVE, 'Original Support D0 refused at edge ' + edge.id + ', parameter ' + parameter + ', UV [' + pcurve.d0[0] + ',' + pcurve.d0[1] + ']'), d1: d1state('support', () => evaluateSurfaceD1(support, pcurve.d0[0], pcurve.d0[1])) };
      let chain: Point | null = null;
      if (original.d1.status === 'evaluated' && pcurve.d1.status === 'evaluated') {
        const surfaceD1 = original.d1.value, uvD1 = pcurve.d1.value;
        chain = surfaceD1.du.map((value, axis) => finite(finite(value * uvD1.derivative[0]) + finite(surfaceD1.dv[axis] * uvD1.derivative[1]))) as Point;
      }
      const pointGap = <T extends { point: Point }>(point: Point, state: D1State<T>) => state.status === 'evaluated' ? gap(point, state.value.point) : null;
      const residuals = { pointGapMM: gap(world.d0, original.d0), worldD0D1PointGapMM: pointGap(world.d0, world.d1), uvD0D1PointGap: pointGap(pcurve.d0, pcurve.d1), supportD0D1PointGapMM: pointGap(original.d0, original.d1), relativeChainGap: world.d1.status === 'evaluated' && chain ? finite(gap(world.d1.value.derivative, chain) / Math.max(1, finite(Math.hypot(...world.d1.value.derivative)))) : null };
      check([residuals.pointGapMM, residuals.worldD0D1PointGapMM, residuals.uvD0D1PointGap, residuals.supportD0D1PointGapMM, residuals.relativeChainGap].every(value => value === null || value <= 1e-7), CODE.BINDING, 'Actual available native edge/UV/Support points or tangent chains exceed comparisons');
      return { edgeId: edge.id, edgeIndex, index, parameter, world, pcurve, support: original, chain, residuals };
    });
  });
  check(observations.length === 3 * (4 * section.report.spanCount + 1) + 12 && observations.length <= options.maximumObservations, CODE.BINDING, 'Actual complete observation count must fit the frozen maximum');
  const report: MultiSpanVLinearSurfacePlaneTrimReport = {
    schema: 'barocss-multispan-vlinear-surface-plane-trim-candidates', version: 0, evaluationId: options.evaluationId, sourceId: section.surfaceAsset.sourceId, surfaceId: support.id, lengthUnit: 'mm', uvLengthUnit: 'dimensionless', spanCount: section.report.spanCount, derivativeCounts, vertexCount: 6, edgeCount: 7, loopCount: 2, faceCount: 2, worldObjectCount: 8, sharedCutEdgeId: edges[6].id,
    storedUVSimpleGraphCertified: true, orientedUVCyclesCertified: true, logicalIncidenceClosed: true, wholeEdgeModelGapCertified: true, maximumWholeEdgeModelGapMM: Math.max(...edgeBounds.map(edge => edge.bound.upper)), maximumObservedPointGapMM: Math.max(...observations.map(observation => observation.residuals.pointGapMM)), maximumObservedRelativeChainGap: Math.max(...observations.map(observation => (observation.residuals.relativeChainGap ?? 0))), edgeModelGaps: edgeBounds, rationalCounts: q.counts(),
    directCounts: { sectionValidationCount: 1, boundaryExtractionCount: 4, intervalExtractionCount: 4, worldSourceCompilationCount: 1, uvCurveValidationCount: 6, observationCount: observations.length, curvePointEvaluationCount: 2 * observations.length, curveDerivativeEvaluationCount: 2 * observations.length, surfacePointEvaluationCount: observations.length, surfaceDerivativeEvaluationCount: observations.length },
    numericPolicy: { authority: 'exact-coefficient-models-with-local-native-observations', uvClosure: 'unchanged-stored-cut-endpoint-poles-and-nominal-linear-sidecars', reflection: 'exact-natural-knot-reflection-and-actual-affine-inverse-nearest-even-no-snap', restriction: 'exact-degree2-cross-product-and-positive-denominator-bound', pointComparisonMM: 1e-7, relativeChainComparison: 1e-7, boundRounding: 'upward-including-positive-subnormal', planeSide: 'candidate-region-relative-to-stored-uv-graph-no-ideal-plane-side-guarantee' },
    quality: { geometricValidity: 'not-certified', topologyCertified: false, solid: false, insideOutsideCertified: false, embeddedManifoldCertified: false, globalBinary64EvaluationErrorCertified: false, manufacturingToleranceCertified: false, supportRegularityCertified: false, globalD1ErrorCertified: false, weldingPerformed: false, parentProofsUnchanged: true, ownership: 'independent-copied-cpu-data-gc' },
    limits: { maximumBoundaries: 4, maximumIntervals: 4, maximumObservations: 63, maximumSpans: 4, maximumMonotonicityDegree: 5, maximumGapDegree: 2, maximumWorldObjects: 8, prefixCharacters: 12, ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, stringCharacters: 262144, rationalOperations: 200000, gcdSteps: 200000, rationalIntegerBits: 8192, fractionIntegerCharacters: 5000, floatSearchStepsPerConversion: 64 }, workScope: 'direct-root-calls-only-full-inherited-child-work-retained-and-excluded', budgetFailure: 'atomic-no-partial-trim-candidates',
  };
  return snapshot({ section, options, boundaries, intervals, world, vertices, edges, loops, faces, proof, observations, report }, true) as MultiSpanVLinearSurfacePlaneTrimResult;
}
/** Rebuild the actual section/interval receipts, exact proofs, World source and every native observation before whole-result comparison. */
export function validateMultiSpanVLinearSurfacePlaneTrimCandidates(input: MultiSpanVLinearSurfacePlaneTrimResult): MultiSpanVLinearSurfacePlaneTrimReport {
  const owned = record(snapshot(input, true), ['section', 'options', 'boundaries', 'intervals', 'world', 'vertices', 'edges', 'loops', 'faces', 'proof', 'observations', 'report'], CODE.OWNED) as unknown as MultiSpanVLinearSurfacePlaneTrimResult;
  let expected: MultiSpanVLinearSurfacePlaneTrimResult;
  try { expected = buildMultiSpanVLinearSurfacePlaneTrimCandidates(owned.section, owned.options); } catch (cause) { throw new MultiSpanVLinearSurfacePlaneTrimError(CODE.OWNED, 'Whole owned trim candidate reconstruction failed', cause); }
  check(same(owned, expected), CODE.OWNED, 'Owned section/children/source/UV/logical loops/exact proofs/observations/counters changed'); return snapshot(expected.report, true) as MultiSpanVLinearSurfacePlaneTrimReport;
}
