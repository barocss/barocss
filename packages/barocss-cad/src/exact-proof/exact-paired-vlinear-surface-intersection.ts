import { compileCadModel } from '../model-compiler.js';
import { compileCurveSource } from '../nurbs/curves/curve-source.js';
import { validateSurface, surfaceDomain, validateCurve, evaluateCurve, evaluateSurface } from '../math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from '../derivatives.js';
import { SectionRationalContext } from '../section-rational-internal.js';
import { deriveExactPairedVLinearPolynomialsTrusted, ExactPairedVLinearPolynomialError } from './exact-paired-vlinear-polynomial-internal.js';
import type { ExactPairedVLinearProof, ExactPairedVLinearDerived } from './exact-paired-vlinear-polynomial-internal.js';

import type { Curve, Surface, Model, Point } from '../types.js';
import type { CurveD1Result, SurfaceD1Result } from '../derivatives.js';
import { same } from '../structural-equality.js';

type Asset = { sourceId: string; source: string; surface: Surface };
export interface ExactPairedVLinearSurfaceIntersectionOptions {
  evaluationId: string; worldCurveId: string; pcurveAId: string; pcurveBId: string;
  maximumObservations: 5;
}
export interface ExactPairedVLinearSurfaceIntersectionRequest {
  assets: [Asset, Asset]; uAInterval: [number, number];
  options: ExactPairedVLinearSurfaceIntersectionOptions;
}
type Selection = { assetIndex: 0 | 1; sourceId: string; sourceField: string;
  modelField: string; modelName: string; objectIndex: number; surfaceId: string;
  nativeDomains: { u: [number, number]; v: [number, number] } };
type UV = { coordinateSystem: 'original-native-uv'; lengthUnit: 'dimensionless';
  embeddedZ: 0; parameterFrame: 'original-a-u'; curve: Curve; support: Selection };
type Proof = ExactPairedVLinearProof;
type Observation = {
  index: number; parameter: number;
  world: { d0: Point; d1: CurveD1Result };
  pcurveA: { d0: Point; d1: CurveD1Result };
  pcurveB: { d0: Point; d1: CurveD1Result };
  surfaceA: { d0: Point; d1: SurfaceD1Result };
  surfaceB: { d0: Point; d1: SurfaceD1Result };
  chainA: Point; chainB: Point;
  residuals: { worldToA: number; worldToB: number; aToB: number;
    relativeWorldChainA: number; relativeWorldChainB: number;
    d0ToD1Point: [number, number, number, number, number] };
};
export interface ExactPairedVLinearSurfaceIntersectionResult { // EXACT7
  request: ExactPairedVLinearSurfaceIntersectionRequest;
  originalModels: [Model, Model];
  world: { curve: Curve; source: string; sourceVersion: 0; model: Model };
  pcurves: { a: UV; b: UV };
  proof: Proof; observations: Observation[]; report: ExactPairedVLinearSurfaceIntersectionReport;
}
export interface ExactPairedVLinearSurfaceIntersectionReport {
  schema: 'barocss-exact-paired-vlinear-surface-intersection-report'; version: 0;
  evaluationId: string; selections: [Selection, Selection];
  parameterDomain: [number, number]; parameterFrame: 'original-a-u';
  worldCurveId: string; pcurveAId: string; pcurveBId: string;
  curveDegree: 4; curvePoleCount: 5; curveKnotCount: 10;
  worldLengthUnit: 'mm'; uvLengthUnit: 'dimensionless';
  sourceFrame: 'authored-xyz-no-axis-conversion';
  worldSourceBinding: { sourceField: 'world.source'; modelField: 'world.model';
    modelName: string; objectIndex: 0; curveId: string };
  wholeCoefficientResidualZero: true;
  uniqueCompleteBranchOnDeclaredInterval: true;
  maximumObservedPointGapMM: number; maximumObservedRelativeChainGap: number;
  directCounts: { originalSourceCompileCount: 2; selectedSurfaceValidationCount: 2;
    surfaceDomainCount: 2; newCurveValidationCount: 3; worldSourceAdoptionCount: 1;
    uvSourceCompilationCount: 0; observationCount: 5;
    curveD0Count: 15; curveD1AttemptCount: 15; surfaceD0Count: 10; surfaceD1AttemptCount: 10;
    traceCallCount: 0; fittingCallCount: 0; rootSolveCount: 0; originalSourceEditCount: 0 };
  rationalCounts: ReturnType<SectionRationalContext['counts']>;
  quality: { exactStoredCoefficientBinding: true; bothOriginalUVPreserved: true;
    completeOriginalSourcesRetained: true; uniqueOnAdmittedInterval: true;
    exactWholeModelGapZero: true; nativeObservationsSeparate: true;
    uvCurvesEmittedAsWorldSource: false; genericIntersection: false;
    allBranchesOutsideInterval: false; trimFaceProduced: false; topologyCertified: false;
    solid: false; globalBinary64EvaluationErrorCertified: false;
    manufacturingToleranceCertified: false; publication: false;
    ownership: 'independent-copied-cpu-data-gc' };
  sourceSizes: { a: Size; b: Size; world: Size };
  fileSizes: { request: Size; result: Size }; ownValues: number;
  limits: { maximumSelectedUDegree: 2; selectedVDegree: 1; maximumSelectedUPoles: 3;
    selectedVPoles: 2; maximumSpans: 1; maximumCurveDegree: 4; maximumCurvePoles: 5;
    maximumCurveKnots: 10; maximumObservations: 5; maximumNativeObservationAttempts: 50;
    maximumFinalCoordinateConversions: 45;
    sourceCharacters: 262144; sourceUTF8Bytes: 262144; maximumOriginalModelObjects: 16;
    coordinateAbs: 10000; parameterAbs: 10000; minimumSpan: 0.000001;
    minimumWeight: 0.000001; maximumWeight: 1000000;
    rationalOperations: 200000; gcdSteps: 200000; rationalIntegerBits: 8192;
    fractionIntegerCharacters: 5000; requestBytes: 2097152; resultBytes: 4194304;
    ownValues: 1048576; ownDepth: 64; arrayElements: 8192; recordFields: 64;
    stringCharacters: 262144; identityCharacters: 48; maximumSettlePasses: 8 };
  workScope: 'exact-private-profile-composition-and-direct-native-observations';
  budgetFailure: 'atomic-no-partial-exact-paired-section';
}
type Size = { utf16: number; utf8: number };

export const ExactPairedVLinearSurfaceIntersectionDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', SOURCE: 'SOURCE', REFERENCE: 'REFERENCE',
  SUPPORT: 'SUPPORT', DOMAIN: 'DOMAIN', REPRESENTABILITY: 'REPRESENTABILITY', BUDGET: 'BUDGET',
  BINDING: 'BINDING', NATIVE: 'NATIVE', FILE: 'FILE', OWNED: 'OWNED',
} as const);
type DiagnosticCode = typeof ExactPairedVLinearSurfaceIntersectionDiagnosticCode[keyof typeof ExactPairedVLinearSurfaceIntersectionDiagnosticCode];
type DirectAttempts = { [K in keyof ExactPairedVLinearSurfaceIntersectionReport['directCounts']]: number };
type ErrorContext = {
  phase: 'input' | 'source' | 'reference' | 'support' | 'polynomial' |
    'curve-validation' | 'world-adoption' | 'observation' | 'file' | 'owned';
  assetIndex: 0 | 1 | null; stationIndex: number | null; directCounts: DirectAttempts;
};
export class ExactPairedVLinearSurfaceIntersectionError extends Error {
  readonly code: DiagnosticCode;
  readonly context: ErrorContext;
  constructor(code: DiagnosticCode, detail: string, state: ErrorContext, cause?: unknown) {
    super(('Exact paired V-linear intersection: ' + detail).slice(0, 1024),
      cause === undefined ? undefined : { cause });
    this.name = 'ExactPairedVLinearSurfaceIntersectionError';
    this.code = code;
    this.context = { ...state, directCounts: { ...state.directCounts } };
  }
}
const CODE = ExactPairedVLinearSurfaceIntersectionDiagnosticCode;
const REQUEST_LIMIT = 2097152, RESULT_LIMIT = 4194304;
function context(): ErrorContext {
  return { phase: 'input', assetIndex: null, stationIndex: null, directCounts: {
    originalSourceCompileCount: 0, selectedSurfaceValidationCount: 0,
    surfaceDomainCount: 0, newCurveValidationCount: 0, worldSourceAdoptionCount: 0,
    uvSourceCompilationCount: 0, observationCount: 0, curveD0Count: 0,
    curveD1AttemptCount: 0, surfaceD0Count: 0, surfaceD1AttemptCount: 0,
    traceCallCount: 0, fittingCallCount: 0, rootSolveCount: 0, originalSourceEditCount: 0,
  } };
}

function fail(state: ErrorContext, code: DiagnosticCode, detail: string, cause?: unknown): never {
  throw new ExactPairedVLinearSurfaceIntersectionError(code, detail, state, cause);
}
function check(state: ErrorContext, value: boolean, code: DiagnosticCode, detail: string): asserts value {
  if (!value) fail(state, code, detail);
}
function record(state: ErrorContext, value: unknown, fields: string[], code: DiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(state, value !== null && typeof value === 'object' && !Array.isArray(value), code, 'An own record is required');
  const data = value as Record<string, unknown>;
  check(state, Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    code, 'Exact own fields are required');
  return data;
}
function snapshot(state: ErrorContext, input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT, budget = owned ? CODE.OWNED : CODE.BUDGET;
  let remaining = 1048576;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(state, --remaining >= 0 && depth <= 64, budget, 'Own value or depth cap exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(state, Number.isFinite(value), code, 'Finite own numbers are required'); return value; }
    if (typeof value === 'string') { check(state, value.length <= 262144, budget, 'Own source string cap exceeded'); return value; }
    check(state, typeof value === 'object' && !ancestors.has(value), code, 'Acyclic own data is required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(state, array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      code, 'Plain own-data prototypes are required');
    const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(state, keys.length <= (array ? 8193 : 64), budget, 'Own field cap exceeded');
    check(state, keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key] &&
      (array && key === 'length' || descriptors[key].enumerable)), code, 'Getters, symbols and hidden fields are refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(state, Number.isInteger(length) && length >= 0 && length <= 8192, budget, 'Own array element cap exceeded');
      check(state, keys.length === length + 1, code, 'Dense arrays without extra fields are required');
      result = Array.from({ length }, (_, index) => {
        check(state, Object.hasOwn(descriptors, String(index)), code, 'Sparse arrays are refused');
        return copy(descriptors[String(index)].value, depth + 1);
      });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value);
    return result;
  };
  return copy(input, 0);
}
function id(state: ErrorContext, value: unknown, maximum = 48): asserts value is string {
  check(state, typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),
    CODE.IDENTITY, 'A bounded supported ASCII identity is required');
}
function size(state: ErrorContext, value: string, limit = 262144): Size {
  const measured = { utf16: value.length, utf8: new TextEncoder().encode(value).length };
  check(state, measured.utf16 <= limit && measured.utf8 <= limit, CODE.BUDGET, 'Complete source exceeds its UTF16 or UTF8 cap');
  return measured;
}
function json(state: ErrorContext, input: unknown, limit: number, retain = false): { text: string; size: Size } {
  const previousPhase = state.phase;
  const previousAsset = state.assetIndex;
  state.phase = 'file'; state.assetIndex = null;
  let utf16 = 0, utf8 = 0;
  const parts: string[] = [], encoder = new TextEncoder();
  const append = (text: string): void => {
    utf16 += text.length; utf8 += encoder.encode(text).length;
    check(state, utf16 <= limit && utf8 <= limit, CODE.FILE, 'Complete JSON exceeds its full UTF16 or UTF8 envelope');
    if (retain) parts.push(text);
  };
  const visit = (value: unknown): void => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') append(JSON.stringify(value));
    else if (typeof value === 'number') { check(state, Number.isFinite(value), CODE.FILE, 'Finite JSON numbers are required'); append(Object.is(value, -0) ? '-0' : String(value)); }
    else if (Array.isArray(value)) { append('['); value.forEach((item, index) => { if (index) append(','); visit(item); }); append(']'); }
    else {
      check(state, value !== null && typeof value === 'object', CODE.FILE, 'Complete own JSON data is required');
      append('{'); Object.entries(value).forEach(([key, item], index) => { if (index) append(','); append(JSON.stringify(key)); append(':'); visit(item); }); append('}');
    }
  };
  visit(input); append('\n');
  state.phase = previousPhase; state.assetIndex = previousAsset;
  return { text: retain ? parts.join('') : '', size: { utf16, utf8 } };
}
function delegated<T>(state: ErrorContext, code: DiagnosticCode, detail: string, action: () => T): T {
  try { return action(); } catch (cause) {
    if (cause instanceof ExactPairedVLinearSurfaceIntersectionError) throw cause;
    fail(state, code, detail, cause);
  }
}
function finite(state: ErrorContext, value: number, detail: string,
  code: DiagnosticCode = CODE.REPRESENTABILITY): number {
  check(state, Number.isFinite(value), code, detail); return value;
}
function ownValues(state: ErrorContext, input: unknown): number {
  let count = 0;
  const visit = (value: unknown, depth: number): void => {
    check(state, ++count <= 1048576 && depth <= 64, CODE.BUDGET, 'Complete retained own-value/depth budget exceeded');
    if (value !== null && typeof value === 'object') Object.values(value).forEach(item => visit(item, depth + 1));
  };
  visit(input, 0); return count;
}
function profile(state: ErrorContext, surface: Surface): void {
  check(state, surface.kind === 'surface' && Number.isInteger(surface.degreeU) &&
    surface.degreeU >= 1 && surface.degreeU <= 2 && surface.degreeV === 1,
  CODE.SUPPORT, 'Selected Udegree1..2/V1 support required');
  check(state, surface.controlPoints.length === surface.degreeU + 1 &&
    surface.controlPoints.every(row => row.length === 2) && surface.weights.length === surface.degreeU + 1 &&
    surface.weights.every(row => row.length === 2) &&
    surface.knotsU.length === 2 * (surface.degreeU + 1) && surface.knotsV.length === 4,
  CODE.SUPPORT, 'One complete selected Bezier tensor span required');
  const weight = surface.weights[0][0];
  check(state, Number.isFinite(weight) && weight >= 1e-6 && weight <= 1e6 &&
    surface.weights.every(row => row.every(value => Object.is(value, weight))),
  CODE.SUPPORT, 'Globally constant positive native weights required');
  check(state, surface.controlPoints.every(row => row.every(point => point.length === 3 &&
    point.every(value => Number.isFinite(value) && Math.abs(value) <= 10000))) &&
    [...surface.knotsU, ...surface.knotsV].every(value => Number.isFinite(value) && Math.abs(value) <= 10000),
  CODE.SUPPORT, 'Bounded finite original Cartesian coordinates and knots required');
}
function properDomain(state: ErrorContext, domains: Selection['nativeDomains']): void {
  for (const domain of [domains.u, domains.v]) {
    const width = finite(state, domain[1] - domain[0], 'Original parameter width overflow');
    check(state, Math.abs(domain[0]) <= 10000 && Math.abs(domain[1]) <= 10000 &&
      width >= 1e-6 && width <= 20000, CODE.DOMAIN, 'Finite bounded positive original domain required');
  }
}
function stations(state: ErrorContext, interval: [number, number]): [number, number, number, number, number] {
  const width = finite(state, interval[1] - interval[0], 'Selected interval width overflow');
  check(state, width > 0, CODE.DOMAIN, 'Ordered nonzero original-UA interval required');
  const inner = [.25, .5, .75].map(factor => finite(state,
    interval[0] + finite(state, width * factor, 'Station multiplication overflow'), 'Station addition overflow'));
  const result: [number, number, number, number, number] = [interval[0], inner[0], inner[1], inner[2], interval[1]];
  check(state, result.every((value, index) => index === 0 || value > result[index - 1]),
    CODE.REPRESENTABILITY, 'Five strictly ordered represented stations required');
  return result;
}
function distance(state: ErrorContext, a: Point, b: Point): number {
  return finite(state, Math.hypot(...a.map((value, axis) =>
    finite(state, value - b[axis], 'Native point/vector subtraction overflow', CODE.BINDING))),
  'Native point/vector norm overflow', CODE.BINDING);
}
function chain(state: ErrorContext, support: SurfaceD1Result, uv: CurveD1Result): Point {
  return support.du.map((value, axis) => finite(state,
    finite(state, value * uv.derivative[0], 'Surface-U chain product overflow', CODE.BINDING) +
    finite(state, support.dv[axis] * uv.derivative[1], 'Surface-V chain product overflow', CODE.BINDING),
  'Surface chain sum overflow', CODE.BINDING)) as Point;
}
function relative(state: ErrorContext, a: Point, b: Point): number {
  const difference = distance(state, a, b);
  const firstNorm = finite(state, Math.hypot(...a), 'First chain norm overflow', CODE.BINDING);
  const secondNorm = finite(state, Math.hypot(...b), 'Second chain norm overflow', CODE.BINDING);
  const scale = finite(state, Math.max(1, firstNorm, secondNorm), 'Relative chain scale overflow', CODE.BINDING);
  const value = finite(state, difference / scale, 'Relative chain division overflow', CODE.BINDING);
  check(state, value <= 1e-7, CODE.BINDING, 'Native relative chain residual exceeds1e-7');
  return value;
}
function limits(): ExactPairedVLinearSurfaceIntersectionReport['limits'] {
  return { maximumSelectedUDegree: 2, selectedVDegree: 1, maximumSelectedUPoles: 3,
    selectedVPoles: 2, maximumSpans: 1, maximumCurveDegree: 4, maximumCurvePoles: 5,
    maximumCurveKnots: 10, maximumObservations: 5, maximumNativeObservationAttempts: 50,
    maximumFinalCoordinateConversions: 45, sourceCharacters: 262144, sourceUTF8Bytes: 262144,
    maximumOriginalModelObjects: 16, coordinateAbs: 10000, parameterAbs: 10000, minimumSpan: 1e-6,
    minimumWeight: 1e-6, maximumWeight: 1e6, rationalOperations: 200000, gcdSteps: 200000,
    rationalIntegerBits: 8192, fractionIntegerCharacters: 5000,
    requestBytes: 2097152, resultBytes: 4194304, ownValues: 1048576, ownDepth: 64,
    arrayElements: 8192, recordFields: 64, stringCharacters: 262144, identityCharacters: 48,
    maximumSettlePasses: 8 };
}
/** Construct exact stored-model World and both original-UV Curves before native observations. */
export function buildExactPairedVLinearSurfaceIntersection(input: ExactPairedVLinearSurfaceIntersectionRequest):
  ExactPairedVLinearSurfaceIntersectionResult {
  const state = context();
  const data = record(state, snapshot(state, input), ['assets', 'uAInterval', 'options']);
  check(state, Array.isArray(data.assets) && data.assets.length === 2, CODE.INPUT, 'Exactly two complete source assets required');
  const assets = data.assets.map(value => {
    const a = record(state, value, ['sourceId', 'source', 'surface']);
    id(state, a.sourceId);
    check(state, typeof a.source === 'string', CODE.INPUT, 'Complete original Source0 string required');
    size(state, a.source);
    const surface = record(state, a.surface, ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']);
    id(state, surface.id);
    return a as unknown as Asset;
  }) as [Asset, Asset];
  check(state, assets[0].sourceId !== assets[1].sourceId, CODE.IDENTITY, 'Original source namespaces must differ');
  check(state, Array.isArray(data.uAInterval) && data.uAInterval.length === 2 &&
    data.uAInterval.every(value => typeof value === 'number' && Number.isFinite(value)),
  CODE.INPUT, 'Exact two-value original-UA interval required');
  const interval = data.uAInterval as [number, number];
  const o = record(state, data.options, ['evaluationId', 'worldCurveId', 'pcurveAId', 'pcurveBId', 'maximumObservations']);
  for (const key of ['evaluationId', 'worldCurveId', 'pcurveAId', 'pcurveBId']) id(state, o[key]);
  check(state, o.maximumObservations === 5, CODE.BUDGET, 'Fixed maximumObservations5 required');
  const options = o as unknown as ExactPairedVLinearSurfaceIntersectionOptions;
  const outputIds = [options.evaluationId, options.worldCurveId, options.pcurveAId, options.pcurveBId];
  check(state, new Set(outputIds).size === 4, CODE.IDENTITY, 'Four distinct output identities required');
  const request: ExactPairedVLinearSurfaceIntersectionRequest = { assets, uAInterval: interval, options };
  const requestSize = json(state, request, REQUEST_LIMIT).size;
  const observations: Observation[] = [], models: Model[] = [], selected: Selection[] = [];
  let derived: ExactPairedVLinearDerived | null = null;
  let world: ExactPairedVLinearSurfaceIntersectionResult['world'] | null = null;
  const prefix = (): void => {
    const previousPhase = state.phase;
    const previousAsset = state.assetIndex;
    state.phase = 'file'; state.assetIndex = null;
    const retained = { request, originalModels: models, selections: selected, derived, world, observations };
    snapshot(state, retained); json(state, retained, RESULT_LIMIT);
    state.phase = previousPhase; state.assetIndex = previousAsset;
  };
  prefix();
  for (const [index, asset] of assets.entries()) {
    state.assetIndex = index as 0 | 1; state.phase = 'source'; prefix();
    state.directCounts.originalSourceCompileCount++;
    const compiled = delegated(state, CODE.SOURCE, 'Original complete Source0 compilation failed',
      () => compileCadModel(asset.source, { sourceVersion: 0 }));
    if (!compiled.ok) fail(state, CODE.SOURCE, 'Original complete Source0 compilation refused', compiled);
    check(state, compiled.model.objects.length <= 16, CODE.BUDGET, 'Original Model16 cap exceeded');
    models.push(compiled.model);
    state.phase = 'reference';
    const objectIndex = compiled.model.objects.findIndex(object => object.id === asset.surface.id);
    check(state, objectIndex >= 0 && compiled.model.objects[objectIndex].kind === 'surface',
      CODE.REFERENCE, 'Selected original Surface must resolve in its complete Model');
    check(state, same(compiled.model.objects[objectIndex], asset.surface), CODE.BINDING,
      'Selected source/Surface coefficient or metadata bits differ');
    state.phase = 'support'; profile(state, asset.surface);
    state.directCounts.selectedSurfaceValidationCount++;
    delegated(state, CODE.NATIVE, 'Actual selected Surface validation refused', () => validateSurface(asset.surface));
    state.directCounts.surfaceDomainCount++;
    const domain = delegated(state, CODE.NATIVE, 'Actual original Surface domain refused', () => surfaceDomain(asset.surface));
    properDomain(state, domain);
    const p = asset.surface.degreeU;
    check(state, asset.surface.knotsU.slice(0, p + 1).every(value => Object.is(value, domain.u[0])) &&
      asset.surface.knotsU.slice(p + 1).every(value => Object.is(value, domain.u[1])) &&
      asset.surface.knotsV.slice(0, 2).every(value => Object.is(value, domain.v[0])) &&
      asset.surface.knotsV.slice(2).every(value => Object.is(value, domain.v[1])), CODE.SUPPORT,
    'Complete original one-span clamp bits required');
    selected.push({ assetIndex: index as 0 | 1, sourceId: asset.sourceId,
      sourceField: 'request.assets[' + index + '].source', modelField: 'originalModels[' + index + ']',
      modelName: compiled.model.name, objectIndex, surfaceId: asset.surface.id, nativeDomains: domain });
    prefix();
  }
  state.assetIndex = null; state.phase = 'input';
  const originalIds = new Set([...assets.map(asset => asset.sourceId), ...models.flatMap(model => model.objects.map(object => object.id))]);
  check(state, outputIds.every(value => !originalIds.has(value)), CODE.IDENTITY,
    'New output roles must not repurpose original source/native object identities');
  check(state, interval[0] >= selected[0].nativeDomains.u[0] && interval[1] <= selected[0].nativeDomains.u[1],
    CODE.DOMAIN, 'Selected interval must lie within original A.u');
  const parameters = stations(state, interval);
  state.phase = 'polynomial';
  const q = new SectionRationalContext((kind, detail) => fail(state, CODE[kind], detail));
  prefix();
  try {
    derived = deriveExactPairedVLinearPolynomialsTrusted([assets[0].surface, assets[1].surface],
      [selected[0].nativeDomains, selected[1].nativeDomains], interval,
      { worldCurveId: options.worldCurveId, pcurveAId: options.pcurveAId, pcurveBId: options.pcurveBId }, q);
  } catch (cause) {
    if (cause instanceof ExactPairedVLinearSurfaceIntersectionError) throw cause;
    if (cause instanceof ExactPairedVLinearPolynomialError) {
      state.assetIndex = cause.assetIndex;
      fail(state, cause.code, 'Exact paired polynomial profile/composition refused', cause);
    }
    fail(state, CODE.REPRESENTABILITY, 'Exact paired polynomial construction refused', cause);
  }
  const candidate = derived;
  check(state, q.counts().floatConversions <= 45, CODE.BUDGET, 'Final coordinate conversion budget exceeded');
  check(state, candidate.proof.storedWorldEqualsBothCompositions &&
    candidate.proof.uniqueCompleteBranchOnDeclaredInterval, CODE.BINDING,
  'Complete exact paired source composition certificate required');
  prefix();
  for (const [index, curve] of [candidate.world, candidate.pcurveA, candidate.pcurveB].entries()) {
    state.phase = 'curve-validation'; state.assetIndex = index === 0 ? null : index === 1 ? 0 : 1;
    check(state, curve.degree === 4 && curve.controlPoints.length === 5 && curve.knots.length === 10 &&
      curve.weights.every(value => Object.is(value, 1)) &&
      same(curve.knots, [...Array(5).fill(interval[0]), ...Array(5).fill(interval[1])]) &&
      curve.controlPoints.every(point => point.every(value => Number.isFinite(value) && Math.abs(value) <= 10000)),
    CODE.BINDING, 'Actual common degree4 native Curve profile required');
    if (index > 0) check(state, curve.controlPoints.every(point => Object.is(point[2], 0)), CODE.BINDING,
      'Native UV Curve third coordinate must remain positive zero');
    state.directCounts.newCurveValidationCount++;
    delegated(state, CODE.NATIVE, 'Actual new Curve DTO admission refused', () => validateCurve(curve));
    prefix();
  }
  state.phase = 'world-adoption'; state.assetIndex = null;
  state.directCounts.worldSourceAdoptionCount++;
  const adopted = delegated(state, CODE.NATIVE, 'Actual World Curve Source0 adoption refused',
    () => compileCurveSource(candidate.world.id, candidate.world.degree, candidate.world.controlPoints,
      candidate.world.knots, candidate.world.weights, 'Exact paired V-linear intersection'));
  check(state, same(adopted.curve, candidate.world) && adopted.model.objects.length === 1 &&
    same(adopted.model.objects[0], candidate.world), CODE.BINDING, 'Whole actual World Model1 coefficient binding required');
  size(state, adopted.source);
  world = { curve: adopted.curve, source: adopted.source, sourceVersion: 0, model: adopted.model };
  prefix();
  const actualWorld = world;
  const curvePoint = (curve: Curve, parameter: number, assetIndex: 0 | 1 | null): Point => {
    state.assetIndex = assetIndex;
    state.directCounts.curveD0Count++;
    const point = delegated(state, CODE.NATIVE, 'Actual native Curve D0 refused', () => evaluateCurve(curve, parameter));
    check(state, point.every(Number.isFinite), CODE.NATIVE, 'Finite native Curve D0 required'); return point;
  };
  const curveD1 = (curve: Curve, parameter: number, assetIndex: 0 | 1 | null): CurveD1Result => {
    state.assetIndex = assetIndex;
    state.directCounts.curveD1AttemptCount++;
    const value = delegated(state, CODE.NATIVE, 'Actual native Curve D1 refused', () => evaluateCurveD1(curve, parameter));
    check(state, value.point.every(Number.isFinite) && value.derivative.every(Number.isFinite), CODE.NATIVE,
      'Finite native Curve D1 required'); return value;
  };
  const surfacePoint = (assetIndex: 0 | 1, uv: Point): Point => {
    state.assetIndex = assetIndex;
    state.directCounts.surfaceD0Count++;
    const value = delegated(state, CODE.NATIVE, 'Actual original Surface D0 refused',
      () => evaluateSurface(assets[assetIndex].surface, uv[0], uv[1]));
    check(state, value.every(Number.isFinite), CODE.NATIVE, 'Finite native Surface D0 required'); return value;
  };
  const surfaceD1 = (assetIndex: 0 | 1, uv: Point): SurfaceD1Result => {
    state.assetIndex = assetIndex;
    state.directCounts.surfaceD1AttemptCount++;
    const value = delegated(state, CODE.NATIVE, 'Actual original Surface D1 refused',
      () => evaluateSurfaceD1(assets[assetIndex].surface, uv[0], uv[1]));
    check(state, value.point.every(Number.isFinite) && value.du.every(Number.isFinite) && value.dv.every(Number.isFinite),
      CODE.NATIVE, 'Finite complete native Surface D1 required'); return value;
  };
  for (const [index, parameter] of parameters.entries()) {
    state.phase = 'observation'; state.stationIndex = index; state.assetIndex = null;
    prefix(); state.directCounts.observationCount++;
    const wd0 = curvePoint(actualWorld.curve, parameter, null), wd1 = curveD1(actualWorld.curve, parameter, null);
    const ad0 = curvePoint(candidate.pcurveA, parameter, 0), ad1 = curveD1(candidate.pcurveA, parameter, 0);
    const bd0 = curvePoint(candidate.pcurveB, parameter, 1), bd1 = curveD1(candidate.pcurveB, parameter, 1);
    check(state, Object.is(ad0[2], 0) && Object.is(bd0[2], 0) &&
      Object.is(ad1.derivative[2], 0) && Object.is(bd1.derivative[2], 0), CODE.BINDING,
    'Actual native UV embedding must retain zero third coordinate and derivative');
    const sad0 = surfacePoint(0, ad0), sad1 = surfaceD1(0, ad0);
    const sbd0 = surfacePoint(1, bd0), sbd1 = surfaceD1(1, bd0);
    state.assetIndex = null;
    const chainA = chain(state, sad1, ad1), chainB = chain(state, sbd1, bd1);
    const worldToA = distance(state, wd0, sad0), worldToB = distance(state, wd0, sbd0),
      aToB = distance(state, sad0, sbd0);
    const d0ToD1Point: [number, number, number, number, number] = [
      distance(state, wd0, wd1.point), distance(state, ad0, ad1.point), distance(state, bd0, bd1.point),
      distance(state, sad0, sad1.point), distance(state, sbd0, sbd1.point),
    ];
    check(state, [worldToA, worldToB, aToB, ...d0ToD1Point].every(value => value <= 1e-7),
      CODE.BINDING, 'Actual native paired point/D0-D1 residual exceeds1e-7 in its own coordinate units');
    const relativeWorldChainA = relative(state, wd1.derivative, chainA),
      relativeWorldChainB = relative(state, wd1.derivative, chainB);
    observations.push({ index, parameter,
      world: { d0: wd0, d1: wd1 }, pcurveA: { d0: ad0, d1: ad1 }, pcurveB: { d0: bd0, d1: bd1 },
      surfaceA: { d0: sad0, d1: sad1 }, surfaceB: { d0: sbd0, d1: sbd1 }, chainA, chainB,
      residuals: { worldToA, worldToB, aToB, relativeWorldChainA, relativeWorldChainB, d0ToD1Point } });
    prefix();
  }
  state.phase = 'file'; state.assetIndex = null; state.stationIndex = null;
  const counts = state.directCounts;
  check(state, counts.originalSourceCompileCount === 2 && counts.selectedSurfaceValidationCount === 2 &&
    counts.surfaceDomainCount === 2 && counts.newCurveValidationCount === 3 && counts.worldSourceAdoptionCount === 1 &&
    counts.uvSourceCompilationCount === 0 && counts.observationCount === 5 && counts.curveD0Count === 15 &&
    counts.curveD1AttemptCount === 15 && counts.surfaceD0Count === 10 && counts.surfaceD1AttemptCount === 10 &&
    counts.traceCallCount === 0 && counts.fittingCallCount === 0 && counts.rootSolveCount === 0 &&
    counts.originalSourceEditCount === 0, CODE.BINDING, 'Actual successful direct attempt counts disagree');
  const selections: [Selection, Selection] = [selected[0], selected[1]];
  const report: ExactPairedVLinearSurfaceIntersectionReport = {
    schema: 'barocss-exact-paired-vlinear-surface-intersection-report', version: 0,
    evaluationId: options.evaluationId, selections, parameterDomain: interval, parameterFrame: 'original-a-u',
    worldCurveId: options.worldCurveId, pcurveAId: options.pcurveAId, pcurveBId: options.pcurveBId,
    curveDegree: 4, curvePoleCount: 5, curveKnotCount: 10, worldLengthUnit: 'mm', uvLengthUnit: 'dimensionless',
    sourceFrame: 'authored-xyz-no-axis-conversion',
    worldSourceBinding: { sourceField: 'world.source', modelField: 'world.model', modelName: actualWorld.model.name,
      objectIndex: 0, curveId: actualWorld.curve.id },
    wholeCoefficientResidualZero: true, uniqueCompleteBranchOnDeclaredInterval: true,
    maximumObservedPointGapMM: Math.max(...observations.flatMap(observation => [observation.residuals.worldToA,
      observation.residuals.worldToB, observation.residuals.aToB,
      observation.residuals.d0ToD1Point[0], observation.residuals.d0ToD1Point[3],
      observation.residuals.d0ToD1Point[4]])),
    maximumObservedRelativeChainGap: Math.max(...observations.flatMap(observation => [
      observation.residuals.relativeWorldChainA, observation.residuals.relativeWorldChainB])),
    directCounts: { ...counts } as ExactPairedVLinearSurfaceIntersectionReport['directCounts'], rationalCounts: q.counts(),
    quality: { exactStoredCoefficientBinding: true, bothOriginalUVPreserved: true,
      completeOriginalSourcesRetained: true, uniqueOnAdmittedInterval: true, exactWholeModelGapZero: true,
      nativeObservationsSeparate: true, uvCurvesEmittedAsWorldSource: false, genericIntersection: false,
      allBranchesOutsideInterval: false, trimFaceProduced: false, topologyCertified: false, solid: false,
      globalBinary64EvaluationErrorCertified: false, manufacturingToleranceCertified: false, publication: false,
      ownership: 'independent-copied-cpu-data-gc' },
    sourceSizes: { a: size(state, assets[0].source), b: size(state, assets[1].source), world: size(state, actualWorld.source) },
    fileSizes: { request: requestSize, result: { utf16: 0, utf8: 0 } }, ownValues: 0,
    limits: limits(), workScope: 'exact-private-profile-composition-and-direct-native-observations',
    budgetFailure: 'atomic-no-partial-exact-paired-section',
  };
  const result: ExactPairedVLinearSurfaceIntersectionResult = {
    request, originalModels: [models[0], models[1]], world: actualWorld,
    pcurves: {
      a: { coordinateSystem: 'original-native-uv', lengthUnit: 'dimensionless', embeddedZ: 0,
        parameterFrame: 'original-a-u', curve: candidate.pcurveA, support: selections[0] },
      b: { coordinateSystem: 'original-native-uv', lengthUnit: 'dimensionless', embeddedZ: 0,
        parameterFrame: 'original-a-u', curve: candidate.pcurveB, support: selections[1] },
    }, proof: candidate.proof, observations, report,
  };
  let settled = false;
  for (let pass = 0; pass < 8; pass++) {
    const count = ownValues(state, result), measured = json(state, result, RESULT_LIMIT).size;
    if (report.ownValues === count && same(report.fileSizes.result, measured)) { settled = true; break; }
    report.ownValues = count; report.fileSizes.result = measured;
  }
  check(state, settled && report.ownValues === ownValues(state, result) &&
    same(report.fileSizes.result, json(state, result, RESULT_LIMIT).size), CODE.FILE,
  'Complete exact-pair result own/file measurements did not settle in8 passes');
  return snapshot(state, result) as ExactPairedVLinearSurfaceIntersectionResult;
}
/** Reconstruct the full exact pair once and return an independent complete Report. */
export function validateExactPairedVLinearSurfaceIntersection(input: unknown): ExactPairedVLinearSurfaceIntersectionReport {
  const state = context(); state.phase = 'owned';
  try {
    const result = record(state, snapshot(state, input, true), ['request', 'originalModels', 'world',
      'pcurves', 'proof', 'observations', 'report'], CODE.OWNED) as unknown as ExactPairedVLinearSurfaceIntersectionResult;
    json(state, result, RESULT_LIMIT);
    const expected = buildExactPairedVLinearSurfaceIntersection(result.request);
    state.directCounts = { ...expected.report.directCounts };
    check(state, same(result, expected), CODE.OWNED,
      'Complete original sources/Models/World/UVs/coefficients/observations/counts/report differ from reconstruction');
    return snapshot(state, expected.report, true) as ExactPairedVLinearSurfaceIntersectionReport;
  } catch (cause) {
    if (cause instanceof ExactPairedVLinearSurfaceIntersectionError && cause.code === CODE.OWNED) throw cause;
    const failed = cause instanceof ExactPairedVLinearSurfaceIntersectionError ? cause.context : state;
    throw new ExactPairedVLinearSurfaceIntersectionError(CODE.OWNED,
      'Whole exact paired result reconstruction refused', { ...failed, phase: 'owned' }, cause);
  }
}
