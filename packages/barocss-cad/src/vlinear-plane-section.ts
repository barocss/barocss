import { compileCadModel } from './model-compiler.js';
import { compileCurveSource } from './curve-source.js';
import { evaluateCurve, evaluateSurface, validateCurve } from './math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from './derivatives.js';
import type { CurveD1Result, SurfaceD1Result } from './derivatives.js';
import { prepareCurvePlaneAxesTrusted } from './own-curve-plane-intersection.js';
import { SectionRationalContext } from './section-rational-internal.js';
import type { SectionRational, SectionFraction } from './section-rational-internal.js';
import type { Curve, Surface, Point, Model } from './types.js';

export const VLinearSurfacePlaneSectionDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', SOURCE: 'SOURCE', SUPPORT: 'SUPPORT', CROSSING: 'CROSSING', CHART: 'CHART', REPRESENTABILITY: 'REPRESENTABILITY', BINDING: 'BINDING', NATIVE: 'NATIVE', OWNED: 'OWNED' } as const);
export type VLinearSurfacePlaneSectionDiagnosticCode = typeof VLinearSurfacePlaneSectionDiagnosticCode[keyof typeof VLinearSurfacePlaneSectionDiagnosticCode];
export class VLinearSurfacePlaneSectionError extends Error {
  readonly code: VLinearSurfacePlaneSectionDiagnosticCode;
  constructor(code: VLinearSurfacePlaneSectionDiagnosticCode, detail: string, cause?: unknown) {
    super(('V-linear Plane section: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause }); this.name = 'VLinearSurfacePlaneSectionError'; this.code = code;
  }
}
export interface VLinearSurfacePlaneSectionAsset { sourceId: string; source: string; surface: Surface }
export interface VLinearSurfacePlaneSectionOptions { evaluationId: string; curveId: string; surfacePcurveId: string; planePcurveId: string; maximumObservations: number }
type Fraction = SectionFraction;
type Bound = { exact: Fraction; upper: number };
type Domains = { u: [number, number]; v: [number, number] };
type UVSidecar = { coordinateSystem: 'native-surface-uv' | 'native-plane-uv'; lengthUnit: 'dimensionless'; curve: Curve };
type PoleProof = { index: number; homogeneous: Fraction[]; idealCartesian: Fraction[]; storedCartesian: Point; coordinateErrors: Fraction[]; l1Error: Fraction };
type ProductContribution = { firstIndex: number; secondIndex: number; factor: Fraction; f1H0: Fraction[]; negativeF0H1: Fraction[]; contribution: Fraction[] };
type SectionProof = {
  plane: { origin: Fraction[]; uDirection: Fraction[]; vDirection: Fraction[]; rawNormal: Fraction[]; d: Fraction; gram: { uu: Fraction; uv: Fraction; vv: Fraction; determinant: Fraction } };
  columns: { index: number; h0: Fraction[]; h1: Fraction[]; rawF0: Fraction; rawF1: Fraction; f0: Fraction; f1: Fraction; denominator: Fraction }[];
  world: { degree: number; homogeneousScale: number; coefficients: { index: number; unscaledHomogeneous: Fraction[]; scaledHomogeneous: Fraction[]; contributions: ProductContribution[] }[]; poles: PoleProof[] };
  surfaceUV: { degree: number; homogeneousScale: number; denominatorCoefficients: Fraction[]; uNumeratorCoefficients: Fraction[]; vNumeratorCoefficients: Fraction[]; poles: PoleProof[] };
  planeUV: { degree: number; weights: number[]; poles: PoleProof[] };
  lipschitz: { surfaceU: Bound; surfaceV: Bound; planeU: Bound; planeV: Bound };
  bounds: { worldCartesian: Bound; surfaceU: Bound; surfaceV: Bound; planeU: Bound; planeV: Bound; worldToSurface: Bound; worldToPlane: Bound };
};
type Observation = {
  index: number; parameter: number;
  world: { d0: Point; d1: CurveD1Result }; surfacePcurve: { d0: Point; d1: CurveD1Result }; planePcurve: { d0: Point; d1: CurveD1Result };
  surface: { d0: Point; d1: SurfaceD1Result }; plane: { d0: Point; d1: SurfaceD1Result };
  surfaceChain: Point; planeChain: Point;
  residuals: { worldToSurfaceMM: number; worldToPlaneMM: number; d0ToD1Point: [number, number, number, number, number]; surfaceChainRelative: number; planeChainRelative: number };
};
export interface VLinearSurfacePlaneSectionReport {
  schema: 'barocss-vlinear-surface-plane-section'; version: 0; evaluationId: string;
  surfaceSourceId: string; planeSourceId: string; surfaceId: string; planeId: string; curveId: string;
  lengthUnit: 'mm'; pcurveLengthUnit: 'dimensionless'; sourceFrame: 'authored-xyz-no-axis-conversion'; parameterFrame: 'original-native-u-v-domains';
  surfaceDomains: Domains; planeDomains: Domains; polarity: 1 | -1; inputUDegree: number; worldDegree: number; surfacePcurveDegree: number; planePcurveDegree: number;
  sourceOwnership: 'whole-original-source-models-and-one-world-source-model1-uv-json-only';
  wholeModelGapBounds: SectionProof['bounds']; maximumObservedPointGapMM: number; maximumObservedRelativeChainGap: number;
  directCounts: { sourceCompilationCount: 2; worldAdoptionCount: 1; planeHelperCount: 1; uvNativeValidationCount: 2; observationCount: 5; curvePointEvaluationCount: 15; curveDerivativeEvaluationCount: 15; surfacePointEvaluationCount: 10; surfaceDerivativeEvaluationCount: 10 };
  rationalCounts: ReturnType<SectionRationalContext['counts']>;
  numericPolicy: { coefficientAuthority: 'exact-rational-IEEE64-input-values'; poleRounding: 'nearest-even-generated-exact-zero-positive-zero'; boundRounding: 'upward-including-positive-subnormal'; derivedWeights: 'exact-binary64-in-native-range-no-normalization'; planeChart: 'ideal-and-stored-positive-weight-whole-control-hulls'; modelComparisonMM: 1e-7; observationComparisonMM: 1e-7; relativeChainComparison: 1e-7; observationAuthority: 'local-native-values-separate-from-whole-model-proof' };
  quality: { geometricValidity: 'not-certified'; topologyCertified: false; solid: false; globalCoefficientModelGapCertified: true; globalBinary64EvaluationErrorCertified: false; regularityCertified: false; embeddedManifoldCertified: false; manufacturingToleranceCertified: false; originalBitsPreserved: true; ownership: 'independent-copied-cpu-data-gc' };
  limits: { maximumUDegree: 2; vDegree: 1; maximumWorldDegree: 4; maximumWorldPoles: 5; maximumObservations: 5; coordinateAbs: 10000; knotAbs: 10000; minimumParameterSpan: 1e-6; rationalOperations: 200000; gcdSteps: 200000; rationalIntegerBits: 8192; fractionIntegerCharacters: 5000; floatSearchStepsPerConversion: 64; ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144 };
  workScope: 'direct-new-calls-parent-internal-work-excluded'; budgetFailure: 'atomic-no-partial-section';
}
export interface VLinearSurfacePlaneSectionResult {
  surfaceAsset: VLinearSurfacePlaneSectionAsset; planeAsset: VLinearSurfacePlaneSectionAsset; options: VLinearSurfacePlaneSectionOptions; originalModels: [Model, Model];
  world: { curve: Curve; source: string; sourceVersion: 0; model: Model }; pcurves: { surface: UVSidecar; plane: UVSidecar };
  proof: SectionProof; observations: Observation[]; report: VLinearSurfacePlaneSectionReport;
}

const CODE = VLinearSurfacePlaneSectionDiagnosticCode;
function check(condition: boolean, code: VLinearSurfacePlaneSectionDiagnosticCode, detail: string): asserts condition { if (!condition) throw new VLinearSurfacePlaneSectionError(code, detail); }
function native<T>(action: () => T, detail: string): T { try { return action(); } catch (cause) { throw new VLinearSurfacePlaneSectionError(CODE.NATIVE, detail, cause); } }
function record(input: unknown, fields: string[], code: VLinearSurfacePlaneSectionDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'An own record is required'); const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required'); return data;
}
function id(input: unknown): string { check(typeof input === 'string' && input.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(input), CODE.IDENTITY, 'ASCII ID1..48 is required'); return input; }
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT; let remaining = 1048576; const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 64, code, 'Own value or depth budget exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'Finite own numeric data is required'); return value; }
    if (typeof value === 'string') { check(value.length <= 262144, code, 'Own string budget exceeded'); return value; }
    check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic own data is required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Plain own data is required');
    check(keys.length <= (array ? 8193 : 64) && keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'Bounded own fields without getters/symbols/hidden data are required');
    ancestors.add(value); let result: unknown;
    if (array) { const length = descriptors.length.value as number; check(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, code, 'Dense bounded arrays are required');
      result = Array.from({ length }, (_, index) => { check(Object.hasOwn(descriptors, String(index)), code, 'Sparse or extra array fields are refused'); return copy(descriptors[String(index)].value, depth + 1); });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  };
  try { return copy(input, 0); } catch (cause) { if (cause instanceof VLinearSurfacePlaneSectionError) throw cause; throw new VLinearSurfacePlaneSectionError(code, 'Own snapshot failed', cause); }
}
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => same(value, b[index]));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const x = a as Record<string, unknown>, y = b as Record<string, unknown>; return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(key => Object.hasOwn(y, key) && same(x[key], y[key])); }
  return Object.is(a, b);
}
function asset(input: unknown): VLinearSurfacePlaneSectionAsset {
  const data = record(input, ['sourceId', 'source', 'surface']); id(data.sourceId); check(typeof data.source === 'string', CODE.INPUT, 'An actual original Source0 string is required');
  const surface = record(data.surface, ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']); id(surface.id);
  check(surface.kind === 'surface', CODE.INPUT, 'An original Surface is required'); return data as unknown as VLinearSurfacePlaneSectionAsset;
}
function source(asset: VLinearSurfacePlaneSectionAsset): Model {
  const compiled = native(() => compileCadModel(asset.source, { sourceVersion: 0 }), 'Actual original Source0 compilation failed');
  if (!compiled.ok) throw new VLinearSurfacePlaneSectionError(CODE.SOURCE, 'Actual original Source0 compilation refused', compiled);
  const selected = compiled.model.objects.find(object => object.id === asset.surface.id);
  check(selected?.kind === 'surface' && same(selected, asset.surface), CODE.SOURCE, 'Selected original Surface whole coefficient bits do not match actual Source0'); return compiled.model;
}
function profile(surface: Surface, plane = false): Domains {
  check(surface.degreeV === 1 && (plane ? surface.degreeU === 1 : surface.degreeU === 1 || surface.degreeU === 2), CODE.SUPPORT, 'Only UBezierdegree1..2/Vdegree1 and affine degree1x1 Plane are admitted');
  check(surface.controlPoints.length === surface.degreeU + 1 && surface.controlPoints.every(row => row.length === 2), CODE.SUPPORT, 'One original clamped UBezier span and two V columns are required');
  check(surface.knotsU.length === 2 * (surface.degreeU + 1) && surface.knotsV.length === 4, CODE.SUPPORT, 'No original interior knots are supported');
  check(surface.controlPoints.every(row => row.every(point => point.every(value => Math.abs(value) <= 10000))) && [...surface.knotsU, ...surface.knotsV].every(value => Math.abs(value) <= 10000), CODE.INPUT, 'Original coordinates and knots must be within10000');
  const domains: Domains = { u: [surface.knotsU[surface.degreeU], surface.knotsU[surface.controlPoints.length]], v: [surface.knotsV[1], surface.knotsV[2]] };
  return domains;
}
function finite(value: number): number { check(Number.isFinite(value), CODE.BINDING, 'Native observation arithmetic is not finite'); return value; }
function difference(a: Point, b: Point): number { return finite(Math.hypot(...a.map((value, index) => finite(value - b[index])))); }
function chain(surface: SurfaceD1Result, uv: CurveD1Result): Point { return surface.du.map((value, index) => finite(finite(value * uv.derivative[0]) + finite(surface.dv[index] * uv.derivative[1]))) as Point; }
function comb(n: number, k: number): number { const table = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1], [1, 4, 6, 4, 1]]; return table[n][k]; }

/** Exact coefficient construction plus bounded model-representation gaps; native evaluations are separate local observations. */
export function buildVLinearSurfacePlaneSection(surfaceInput: VLinearSurfacePlaneSectionAsset, planeInput: VLinearSurfacePlaneSectionAsset, optionsInput: VLinearSurfacePlaneSectionOptions): VLinearSurfacePlaneSectionResult {
  const input = record(snapshot({ surfaceAsset: surfaceInput, planeAsset: planeInput, options: optionsInput }), ['surfaceAsset', 'planeAsset', 'options']);
  const surfaceAsset = asset(input.surfaceAsset), planeAsset = asset(input.planeAsset), settings = record(input.options, ['evaluationId', 'curveId', 'surfacePcurveId', 'planePcurveId', 'maximumObservations']);
  check(surfaceAsset.sourceId !== planeAsset.sourceId, CODE.IDENTITY, 'Original asset source IDs must differ');
  const options: VLinearSurfacePlaneSectionOptions = { evaluationId: id(settings.evaluationId), curveId: id(settings.curveId), surfacePcurveId: id(settings.surfacePcurveId), planePcurveId: id(settings.planePcurveId), maximumObservations: settings.maximumObservations as number };
  check(typeof settings.maximumObservations === 'number' && Number.isInteger(settings.maximumObservations) && settings.maximumObservations >= 0 && settings.maximumObservations <= 5 && settings.maximumObservations >= 5, CODE.BUDGET, 'All five observations must fit the complete integer budget before native/source work');
  const outputIds = [options.evaluationId, options.curveId, options.surfacePcurveId, options.planePcurveId];
  check(new Set(outputIds).size === 4 && outputIds.every(value => ![surfaceAsset.sourceId, planeAsset.sourceId, surfaceAsset.surface.id, planeAsset.surface.id].includes(value)), CODE.IDENTITY, 'Four distinct output IDs must differ from original identities');
  const originalModels: [Model, Model] = [source(surfaceAsset), source(planeAsset)], originals = new Set([surfaceAsset.sourceId, planeAsset.sourceId, ...originalModels.flatMap(model => [model.name, ...model.objects.map(object => object.id)])]);
  check(outputIds.every(value => !originals.has(value)), CODE.IDENTITY, 'All output IDs must be reserved against every whole original source/model/object context');
  const surface = surfaceAsset.surface, plane = planeAsset.surface, surfaceDomains = profile(surface), planeDomains = profile(plane, true), p = surface.degreeU;
  const q = new SectionRationalContext((kind, detail) => { throw new VLinearSurfacePlaneSectionError(CODE[kind], detail); });
  const zero = q.integer(0), rv = (values: number[]) => values.map(value => q.from(value)), text = (values: SectionRational[]) => values.map(value => q.text(value));
  const sub = (a: SectionRational[], b: SectionRational[]) => a.map((value, index) => q.sub(value, b[index]));
  const dot = (a: SectionRational[], b: SectionRational[]) => q.sum(a.map((value, index) => q.mul(value, b[index])));
  const cross = (a: SectionRational[], b: SectionRational[]) => [q.sub(q.mul(a[1], b[2]), q.mul(a[2], b[1])), q.sub(q.mul(a[2], b[0]), q.mul(a[0], b[2])), q.sub(q.mul(a[0], b[1]), q.mul(a[1], b[0]))];
  const l1 = (values: SectionRational[]) => q.sum(values.map(value => q.abs(value)));
  const domainR = (domains: Domains) => ({ u: rv(domains.u), v: rv(domains.v) });
  const sd = domainR(surfaceDomains), pd = domainR(planeDomains);
  for (const domain of [sd.u, sd.v, pd.u, pd.v]) check(q.compare(q.sub(domain[1], domain[0]), q.from(1e-6)) >= 0, CODE.SUPPORT, 'Every exact original native parameter span must be at least1e-6');
  check(plane.weights.every(row => row.every(weight => Object.is(weight, plane.weights[0][0]))), CODE.SUPPORT, 'The original affine Plane must retain four equal represented weights');
  const origin = rv(plane.controlPoints[0][0]), a = sub(rv(plane.controlPoints[1][0]), origin), b = sub(rv(plane.controlPoints[0][1]), origin);
  check(rv(plane.controlPoints[1][1]).every((value, index) => q.compare(value, q.add(q.add(origin[index], a[index]), b[index])) === 0), CODE.SUPPORT, 'Original Plane fourth corner must satisfy the exact rational affine relation');
  const normal = cross(a, b), d = q.neg(dot(normal, origin)), uu = dot(a, a), uv = dot(a, b), vv = dot(b, b), determinant = q.sub(q.mul(uu, vv), q.mul(uv, uv));
  check(normal.some(value => q.compare(value, zero) !== 0) && q.compare(determinant, zero) > 0, CODE.SUPPORT, 'Original Plane exact raw normal and Gram determinant must be nondegenerate');
  native(() => prepareCurvePlaneAxesTrusted(plane), 'Actual unchanged affine Plane helper refused');
  const homogeneous = surface.controlPoints.map((row, index) => row.map((point, column) => { const weight = q.from(surface.weights[index][column]); return [...point.map(value => q.mul(q.from(value), weight)), weight]; }));
  const rawF0 = homogeneous.map(row => q.add(dot(normal, row[0].slice(0, 3)), q.mul(d, row[0][3]))), rawF1 = homogeneous.map(row => q.add(dot(normal, row[1].slice(0, 3)), q.mul(d, row[1][3])));
  const positive = rawF0.every(value => q.compare(value, zero) < 0) && rawF1.every(value => q.compare(value, zero) > 0);
  const negative = rawF0.every(value => q.compare(value, zero) > 0) && rawF1.every(value => q.compare(value, zero) < 0);
  check(positive || negative, CODE.CROSSING, 'Exact whole Bernstein columns must have strict opposite signs; partial/tangent/coincident cases are unsupported');
  const polarity: 1 | -1 = positive ? 1 : -1, f0 = rawF0.map(value => positive ? value : q.neg(value)), f1 = rawF1.map(value => positive ? value : q.neg(value)), denominator = f1.map((value, index) => q.sub(value, f0[index]));
  const worldDegree = 2 * p, worldScale = p === 1 ? 2 : 12, coefficients: SectionProof['world']['coefficients'] = [], worldH: SectionRational[][] = [];
  for (let k = 0; k <= worldDegree; k++) {
    const sums = [zero, zero, zero, zero], contributions: ProductContribution[] = [];
    for (let i = 0; i <= p; i++) { const j = k - i; if (j < 0 || j > p) continue;
      const factor = q.div(q.integer(comb(p, i) * comb(p, j)), q.integer(comb(worldDegree, k)));
      const first = homogeneous[j][0].map(value => q.mul(f1[i], value)), second = homogeneous[j][1].map(value => q.mul(q.neg(f0[i]), value)), contribution = first.map((value, axis) => q.mul(factor, q.add(value, second[axis])));
      for (let axis = 0; axis < 4; axis++) sums[axis] = q.add(sums[axis], contribution[axis]);
      contributions.push({ firstIndex: i, secondIndex: j, factor: q.text(factor), f1H0: text(first), negativeF0H1: text(second), contribution: text(contribution) });
    }
    const scaled = sums.map(value => q.mul(value, q.integer(worldScale))); worldH.push(scaled); coefficients.push({ index: k, unscaledHomogeneous: text(sums), scaledHomogeneous: text(scaled), contributions });
  }
  const spanV = q.sub(sd.v[1], sd.v[0]), surfaceVNumerator = denominator.map((value, index) => q.add(q.mul(sd.v[0], value), q.mul(spanV, q.neg(f0[index]))));
  const surfaceUVH: SectionRational[][] = [], uvDegree = p + 1, uvScale = p === 1 ? 2 : 3;
  for (let k = 0; k <= uvDegree; k++) {
    const leftFactor = q.div(q.integer(uvDegree - k), q.integer(uvDegree)), rightFactor = q.div(q.integer(k), q.integer(uvDegree));
    const leftD = k <= p ? q.mul(leftFactor, denominator[k]) : zero, rightD = k > 0 ? q.mul(rightFactor, denominator[k - 1]) : zero;
    const weight = q.add(leftD, rightD), un = q.add(q.mul(sd.u[0], leftD), q.mul(sd.u[1], rightD));
    const vn = q.add(k <= p ? q.mul(leftFactor, surfaceVNumerator[k]) : zero, k > 0 ? q.mul(rightFactor, surfaceVNumerator[k - 1]) : zero);
    surfaceUVH.push([un, vn, zero, weight].map(value => q.mul(value, q.integer(uvScale))));
  }
  const planeUVH = worldH.map(h => {
    const point = h.slice(0, 3).map(value => q.div(value, h[3])), displacement = sub(point, origin), da = dot(displacement, a), db = dot(displacement, b);
    const alpha = q.div(q.sub(q.mul(da, vv), q.mul(db, uv)), determinant), beta = q.div(q.sub(q.mul(db, uu), q.mul(da, uv)), determinant);
    const u = q.add(pd.u[0], q.mul(q.sub(pd.u[1], pd.u[0]), alpha)), v = q.add(pd.v[0], q.mul(q.sub(pd.v[1], pd.v[0]), beta));
    return [q.mul(u, h[3]), q.mul(v, h[3]), zero, h[3]];
  });
  const makeCurve = (id: string, degree: number, h: SectionRational[][], domains?: Domains) => {
    const ideals: SectionRational[][] = [], errors: SectionRational[][] = [], poles: PoleProof[] = [], weights: number[] = [];
    const controlPoints = h.map((homogeneous, index): Point => {
      check(q.compare(homogeneous[3], zero) > 0, CODE.REPRESENTABILITY, 'Every derived homogeneous weight must be positive');
      const weight = q.exactFloat(homogeneous[3]); check(weight >= 1e-6 && weight <= 1e6, CODE.REPRESENTABILITY, 'Exactly represented derived weights must remain in the unchanged native range'); weights.push(weight);
      const ideal = homogeneous.slice(0, 3).map(value => q.div(value, homogeneous[3])), stored = ideal.map(value => q.nearest(value)) as Point;
      check(stored.every(value => Math.abs(value) <= 10000), CODE.REPRESENTABILITY, 'Derived Cartesian poles must remain within10000');
      if (domains) for (let axis = 0; axis < 2; axis++) { const domain = axis === 0 ? domains.u : domains.v;
        check(q.compare(ideal[axis], q.from(domain[0])) >= 0 && q.compare(ideal[axis], q.from(domain[1])) <= 0 && stored[axis] >= domain[0] && stored[axis] <= domain[1], CODE.CHART, 'Both ideal and stored whole positive-weight UV control hulls must remain in the original finite chart'); }
      const error = ideal.map((value, axis) => q.abs(q.sub(value, q.from(stored[axis])))); ideals.push(ideal); errors.push(error);
      poles.push({ index, homogeneous: text(homogeneous), idealCartesian: text(ideal), storedCartesian: stored, coordinateErrors: text(error), l1Error: q.text(l1(error)) }); return stored;
    });
    const curve: Curve = { kind: 'curve', id, degree, knots: [...Array(degree + 1).fill(surfaceDomains.u[0]), ...Array(degree + 1).fill(surfaceDomains.u[1])], controlPoints, weights };
    return { curve, ideals, errors, poles };
  };
  const worldData = makeCurve(options.curveId, worldDegree, worldH), surfaceUVData = makeCurve(options.surfacePcurveId, uvDegree, surfaceUVH, surfaceDomains), planeUVData = makeCurve(options.planePcurveId, worldDegree, planeUVH, planeDomains);
  check(same(worldData.curve.weights, planeUVData.curve.weights), CODE.BINDING, 'Plane UV curve must retain the exact same positive World weights');
  const minimumWeight = homogeneous.flat().map(h => h[3]).reduce((a, b) => q.compare(a, b) <= 0 ? a : b);
  const maximumP = [0, 1, 2].map(axis => surface.controlPoints.flat().reduce((maximum, point) => q.max(maximum, q.abs(q.from(point[axis]))), zero));
  const lipschitz = (axis: 'u' | 'v'): SectionRational => {
    const degree = axis === 'u' ? p : 1, span = q.sub(sd[axis][1], sd[axis][0]), maxima = [zero, zero, zero, zero];
    for (let u = 0; u < (axis === 'u' ? p : p + 1); u++) for (let v = 0; v < (axis === 'u' ? 2 : 1); v++) {
      const first = homogeneous[u][v], second = axis === 'u' ? homogeneous[u + 1][v] : homogeneous[u][v + 1];
      for (let component = 0; component < 4; component++) maxima[component] = q.max(maxima[component], q.abs(q.div(q.mul(q.integer(degree), q.sub(second[component], first[component])), span)));
    }
    return q.div(q.sum([0, 1, 2].map(component => q.add(maxima[component], q.mul(maximumP[component], maxima[3])))), minimumWeight);
  };
  const lu = lipschitz('u'), lv = lipschitz('v'), lpu = q.div(l1(a), q.sub(pd.u[1], pd.u[0])), lpv = q.div(l1(b), q.sub(pd.v[1], pd.v[0]));
  const maximumError = (errors: SectionRational[][], axis?: number) => errors.reduce((maximum, error) => q.max(maximum, axis === undefined ? l1(error) : error[axis]), zero);
  const ew = maximumError(worldData.errors), eu = maximumError(surfaceUVData.errors, 0), ev = maximumError(surfaceUVData.errors, 1), epu = maximumError(planeUVData.errors, 0), epv = maximumError(planeUVData.errors, 1);
  const surfaceGap = q.sum([ew, q.mul(lu, eu), q.mul(lv, ev)]), planeGap = q.sum([ew, q.mul(lpu, epu), q.mul(lpv, epv)]), tolerance = q.from(1e-7);
  check([ew, surfaceGap, planeGap].every(bound => q.compare(bound, tolerance) <= 0), CODE.REPRESENTABILITY, 'Whole exact coefficient-model representation gaps exceed1e-7mm');
  const bounds: SectionProof['bounds'] = { worldCartesian: q.bound(ew), surfaceU: q.bound(eu), surfaceV: q.bound(ev), planeU: q.bound(epu), planeV: q.bound(epv), worldToSurface: q.bound(surfaceGap), worldToPlane: q.bound(planeGap) };
  const proof: SectionProof = {
    plane: { origin: text(origin), uDirection: text(a), vDirection: text(b), rawNormal: text(normal), d: q.text(d), gram: { uu: q.text(uu), uv: q.text(uv), vv: q.text(vv), determinant: q.text(determinant) } },
    columns: homogeneous.map((row, index) => ({ index, h0: text(row[0]), h1: text(row[1]), rawF0: q.text(rawF0[index]), rawF1: q.text(rawF1[index]), f0: q.text(f0[index]), f1: q.text(f1[index]), denominator: q.text(denominator[index]) })),
    world: { degree: worldDegree, homogeneousScale: worldScale, coefficients, poles: worldData.poles },
    surfaceUV: { degree: uvDegree, homogeneousScale: uvScale, denominatorCoefficients: text(surfaceUVH.map(h => h[3])), uNumeratorCoefficients: text(surfaceUVH.map(h => h[0])), vNumeratorCoefficients: text(surfaceUVH.map(h => h[1])), poles: surfaceUVData.poles },
    planeUV: { degree: worldDegree, weights: planeUVData.curve.weights, poles: planeUVData.poles }, lipschitz: { surfaceU: q.bound(lu), surfaceV: q.bound(lv), planeU: q.bound(lpu), planeV: q.bound(lpv) }, bounds,
  };
  const parameters = Array.from({ length: 5 }, (_, index) => index === 0 ? surfaceDomains.u[0] : index === 4 ? surfaceDomains.u[1] : q.nearest(q.add(sd.u[0], q.mul(q.sub(sd.u[1], sd.u[0]), q.div(q.integer(index), q.integer(4))))));
  check(Object.is(parameters[0], surfaceDomains.u[0]) && Object.is(parameters[4], surfaceDomains.u[1]) && parameters.every((value, index) => index === 0 || value > parameters[index - 1]), CODE.REPRESENTABILITY, 'All five distinct original-domain observation slots must be represented without collapsed endpoints');
  const compiled = native(() => compileCurveSource(worldData.curve.id, worldData.curve.degree, worldData.curve.controlPoints, worldData.curve.knots, worldData.curve.weights, 'V-linear Plane section'), 'Actual World Source0 Curve adoption failed');
  check(same(compiled.curve, worldData.curve) && same(compiled.model, { name: 'profile', version: 0, lengthUnit: 'mm', objects: [worldData.curve] }), CODE.BINDING, 'Actual World source/model must retain all constructed coefficient bits');
  native(() => validateCurve(surfaceUVData.curve), 'Actual native Surface UV DTO validation failed'); native(() => validateCurve(planeUVData.curve), 'Actual native Plane UV DTO validation failed');
  const world = { curve: compiled.curve, source: compiled.source, sourceVersion: 0 as const, model: compiled.model }, pcurves = { surface: { coordinateSystem: 'native-surface-uv' as const, lengthUnit: 'dimensionless' as const, curve: surfaceUVData.curve }, plane: { coordinateSystem: 'native-plane-uv' as const, lengthUnit: 'dimensionless' as const, curve: planeUVData.curve } };
  const observations: Observation[] = parameters.map((parameter, index) => {
    const { w, s, t, original, affine } = native(() => {
      const w = { d0: evaluateCurve(world.curve, parameter), d1: evaluateCurveD1(world.curve, parameter) }, s = { d0: evaluateCurve(pcurves.surface.curve, parameter), d1: evaluateCurveD1(pcurves.surface.curve, parameter) }, t = { d0: evaluateCurve(pcurves.plane.curve, parameter), d1: evaluateCurveD1(pcurves.plane.curve, parameter) };
      const original = { d0: evaluateSurface(surface, s.d0[0], s.d0[1]), d1: evaluateSurfaceD1(surface, s.d0[0], s.d0[1]) }, affine = { d0: evaluateSurface(plane, t.d0[0], t.d0[1]), d1: evaluateSurfaceD1(plane, t.d0[0], t.d0[1]) };
      return { w, s, t, original, affine };
    }, 'Actual original/constructed native D0/D1 observation failed at slot ' + index);
    const surfaceChain = chain(original.d1, s.d1), planeChain = chain(affine.d1, t.d1), scale = Math.max(1, finite(Math.hypot(...w.d1.derivative)));
    const residuals = { worldToSurfaceMM: difference(w.d0, original.d0), worldToPlaneMM: difference(w.d0, affine.d0), d0ToD1Point: [difference(w.d0, w.d1.point), difference(s.d0, s.d1.point), difference(t.d0, t.d1.point), difference(original.d0, original.d1.point), difference(affine.d0, affine.d1.point)] as [number, number, number, number, number], surfaceChainRelative: finite(difference(w.d1.derivative, surfaceChain) / scale), planeChainRelative: finite(difference(w.d1.derivative, planeChain) / scale) };
    check(residuals.worldToSurfaceMM <= 1e-7 && residuals.worldToPlaneMM <= 1e-7 && residuals.d0ToD1Point.every(value => value <= 1e-7) && residuals.surfaceChainRelative <= 1e-7 && residuals.planeChainRelative <= 1e-7, CODE.BINDING, 'Actual local native points or dual UV D1 chains exceed the declared comparisons');
    return { index, parameter, world: w, surfacePcurve: s, planePcurve: t, surface: original, plane: affine, surfaceChain, planeChain, residuals };
  });
  const report: VLinearSurfacePlaneSectionReport = {
    schema: 'barocss-vlinear-surface-plane-section', version: 0, evaluationId: options.evaluationId, surfaceSourceId: surfaceAsset.sourceId, planeSourceId: planeAsset.sourceId, surfaceId: surface.id, planeId: plane.id, curveId: world.curve.id,
    lengthUnit: 'mm', pcurveLengthUnit: 'dimensionless', sourceFrame: 'authored-xyz-no-axis-conversion', parameterFrame: 'original-native-u-v-domains', surfaceDomains, planeDomains, polarity, inputUDegree: p, worldDegree, surfacePcurveDegree: uvDegree, planePcurveDegree: worldDegree,
    sourceOwnership: 'whole-original-source-models-and-one-world-source-model1-uv-json-only', wholeModelGapBounds: bounds,
    maximumObservedPointGapMM: Math.max(...observations.flatMap(observation => [observation.residuals.worldToSurfaceMM, observation.residuals.worldToPlaneMM, ...observation.residuals.d0ToD1Point])), maximumObservedRelativeChainGap: Math.max(...observations.flatMap(observation => [observation.residuals.surfaceChainRelative, observation.residuals.planeChainRelative])),
    directCounts: { sourceCompilationCount: 2, worldAdoptionCount: 1, planeHelperCount: 1, uvNativeValidationCount: 2, observationCount: 5, curvePointEvaluationCount: 15, curveDerivativeEvaluationCount: 15, surfacePointEvaluationCount: 10, surfaceDerivativeEvaluationCount: 10 }, rationalCounts: q.counts(),
    numericPolicy: { coefficientAuthority: 'exact-rational-IEEE64-input-values', poleRounding: 'nearest-even-generated-exact-zero-positive-zero', boundRounding: 'upward-including-positive-subnormal', derivedWeights: 'exact-binary64-in-native-range-no-normalization', planeChart: 'ideal-and-stored-positive-weight-whole-control-hulls', modelComparisonMM: 1e-7, observationComparisonMM: 1e-7, relativeChainComparison: 1e-7, observationAuthority: 'local-native-values-separate-from-whole-model-proof' },
    quality: { geometricValidity: 'not-certified', topologyCertified: false, solid: false, globalCoefficientModelGapCertified: true, globalBinary64EvaluationErrorCertified: false, regularityCertified: false, embeddedManifoldCertified: false, manufacturingToleranceCertified: false, originalBitsPreserved: true, ownership: 'independent-copied-cpu-data-gc' },
    limits: { maximumUDegree: 2, vDegree: 1, maximumWorldDegree: 4, maximumWorldPoles: 5, maximumObservations: 5, coordinateAbs: 10000, knotAbs: 10000, minimumParameterSpan: 1e-6, rationalOperations: 200000, gcdSteps: 200000, rationalIntegerBits: 8192, fractionIntegerCharacters: 5000, floatSearchStepsPerConversion: 64, ownValues: 1048576, ownDepth: 64, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144 },
    workScope: 'direct-new-calls-parent-internal-work-excluded', budgetFailure: 'atomic-no-partial-section',
  };
  return snapshot({ surfaceAsset, planeAsset, options, originalModels, world, pcurves, proof, observations, report }, true) as VLinearSurfacePlaneSectionResult;
}
/** Reconstruct exact arithmetic, actual sources, all sidecars, bounds and native observations before whole-result comparison. */
export function validateVLinearSurfacePlaneSection(input: VLinearSurfacePlaneSectionResult): VLinearSurfacePlaneSectionReport {
  const owned = record(snapshot(input, true), ['surfaceAsset', 'planeAsset', 'options', 'originalModels', 'world', 'pcurves', 'proof', 'observations', 'report'], CODE.OWNED) as unknown as VLinearSurfacePlaneSectionResult;
  let expected: VLinearSurfacePlaneSectionResult;
  try { expected = buildVLinearSurfacePlaneSection(owned.surfaceAsset, owned.planeAsset, owned.options); } catch (cause) { throw new VLinearSurfacePlaneSectionError(CODE.OWNED, 'Whole owned section reconstruction failed', cause); }
  check(same(owned, expected), CODE.OWNED, 'Owned original sources, exact coefficients, sidecars, fractions, bounds, observations or counters changed'); return snapshot(expected.report, true) as VLinearSurfacePlaneSectionReport;
}
