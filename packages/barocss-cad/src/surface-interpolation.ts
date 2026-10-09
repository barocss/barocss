import { buildInterpolatingCurve, CurveInterpolationError } from './curve-interpolation.js';
import type { CurveInterpolationResult } from './curve-interpolation.js';
import { validateSurface, evaluateSurface, surfaceDomain } from './math.js';
import { adopt } from './own-plane-cylinder-intersection-internal.js';
import { copyCadData } from './data-copy.js';
import type { Surface, Model, Point } from './types.js';

export const SurfaceInterpolationDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', NATIVE: 'NATIVE',
  REPRESENTABILITY: 'REPRESENTABILITY', CONDITIONING: 'CONDITIONING', BINDING: 'BINDING', OWNED: 'OWNED' } as const);
export type SurfaceInterpolationDiagnosticCode = typeof SurfaceInterpolationDiagnosticCode[keyof typeof SurfaceInterpolationDiagnosticCode];
export class SurfaceInterpolationError extends Error {
  readonly code: SurfaceInterpolationDiagnosticCode; readonly axis: 'u' | 'v' | null; readonly index: number | null;
  constructor(code: SurfaceInterpolationDiagnosticCode, detail: string, context: { axis?: 'u' | 'v' | null; index?: number | null; cause?: unknown } = {}) {
    const axis = context.axis === 'u' || context.axis === 'v' ? context.axis : null;
    const index = typeof context.index === 'number' && Number.isInteger(context.index) && context.index >= 0 && context.index < 16 ? context.index : null;
    super(('Surface interpolation: ' + (axis === null ? '' : axis + '[' + index + ']: ') + detail).slice(0, 1024), context.cause === undefined ? undefined : { cause: context.cause });
    this.name = 'SurfaceInterpolationError'; this.code = code; this.axis = axis; this.index = index;
  }
}
export interface SurfaceInterpolationOptions { surfaceId: string; degreeU: number; degreeV: number; maximumBasisEvaluations: number; maximumEliminationSteps: number; maximumSurfaceEvaluations: number }
export interface SurfaceInterpolationObservation { u: number; v: number; inputIndex: [number, number]; inputPointMM: Point; actualPointMM: Point; differenceMM: number }
export interface SurfaceInterpolationReport {
  schema: 'barocss-native-surface-interpolation'; version: 0; surfaceId: string; lengthUnit: 'mm'; sourceFrame: 'authored-xyz-no-axis-conversion';
  degreeU: number; degreeV: number; pointGrid: [number, number]; controlPointGrid: [number, number]; parametersU: number[]; parametersV: number[];
  domains: { u: [number, number]; v: [number, number] }; knotsU: number[]; knotsV: number[];
  axisRoles: { u: 'original-u-grid-parameter'; v: 'original-v-grid-parameter' };
  phaseU: { axis: 'u'; role: 'fixed-v-column'; index: number; curveId: string; evaluation: CurveInterpolationResult }[];
  phaseV: { axis: 'v'; role: 'solved-u-pole-row'; index: number; curveId: string; evaluation: CurveInterpolationResult }[];
  plannedCounts: { basisEvaluations: number; eliminationSteps: number; surfaceEvaluations: number; curveConstructions: number; nestedCurvePointEvaluations: number };
  basisEvaluationCount: number; eliminationStepCount: number; surfaceEvaluationCount: number; curveConstructionCount: number; nestedCurvePointEvaluationCount: number;
  observations: SurfaceInterpolationObservation[]; maximumPointDifferenceMM: number; cornerBitsPreserved: true;
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  quality: { authority: 'actual-public-native-curve-interpolation-in-u-then-v'; ordering: 'u-columns-then-solved-u-pole-v-rows'; weights: 'polynomial-all-one';
    parameters: 'explicit-original-parameters-and-child-knot-bits'; intermediateGeometry: 'temporary-constructor-curves-not-cad-edges-or-topology';
    workScope: 'actual-child-basis-and-elimination-counts-nested-final-curve-checks-separate-from-direct-surface-checks';
    noBasisFactorCacheClaimed: true; cornerEndpointBitsPreserved: true; localGridInterpolationAccuracyOnly: true;
    rationalFit: false; tangentConstraintsSolved: false; periodicCertified: false; leastSquaresFit: false; regularityCertified: false;
    globalShapeErrorCertified: false; globalBinary64ErrorCertified: false; manufacturingToleranceCertified: false;
    source: 'single-native-surface-model-intermediate-curve-sources-retained-as-nested-proofs'; sourceObjectLimitUnchanged: 16;
    ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-no-partial-interpolating-surface';
  limits: { maximumAxisPoints: 16; maximumDegree: 3; maximumSurfacePoles: 256; maximumBasisEvaluations: 8192; maximumEliminationSteps: 3840; maximumSurfaceEvaluations: 256;
    maximumCurveConstructions: 32; authoredIdCharacters: 48; parameterAbs: 10000; coordinateAbsMM: 10000; pointComparisonMM: 1e-7;
    inputValues: 32768; inputDepth: 8; inputArrayElements: 128; inputRecordFields: 16; inputStringCharacters: 128;
    ownValues: 1048576; ownDepth: 40; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144 };
}
export interface SurfaceInterpolationResult { parametersU: number[]; parametersV: number[]; points: Point[][]; options: SurfaceInterpolationOptions;
  surface: Surface; source: string; sourceVersion: 0; model: Model; report: SurfaceInterpolationReport }

const CODE = SurfaceInterpolationDiagnosticCode, TOLERANCE = 1e-7;
type Context = { axis?: 'u' | 'v' | null; index?: number | null; cause?: unknown };
function check(condition: boolean, code: SurfaceInterpolationDiagnosticCode, detail: string, context: Context = {}): asserts condition {
  if (!condition) throw new SurfaceInterpolationError(code, detail, context);
}
function native<T>(action: () => T, detail: string, context: Context = {}): T {
  try { return action(); } catch (cause) {
    if (cause instanceof SurfaceInterpolationError) throw cause;
    const code = cause instanceof CurveInterpolationError ? cause.code : CODE.NATIVE;
    throw new SurfaceInterpolationError(code, detail + ': ' + (cause instanceof Error ? cause.message : 'native operation refused'), { ...context, cause });
  }
}
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT;
  let remaining = owned ? 1048576 : 32768;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= (owned ? 40 : 8), code, 'own-value/depth budget exceeded');
    if (value === null && owned || typeof value === 'boolean' && owned) return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'finite own numbers required'); return value; }
    if (typeof value === 'string') { check(value.length <= (owned ? 262144 : 128), code, 'own/source string budget exceeded'); return value; }
    check(value !== null && typeof value === 'object', code, 'plain own data required'); check(!ancestors.has(value), code, 'ancestor cycles refused');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'foreign own-data prototype refused');
    check(keys.length <= (array ? (owned ? 8193 : 129) : (owned ? 64 : 16)) && keys.every(key => typeof key === 'string' && key.length <= 128
      && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden/excess own fields refused');
    ancestors.add(value);
    try {
      if (array) {
        const n = descriptors.length.value as number;
        check(Number.isInteger(n) && n >= 0 && n <= (owned ? 8192 : 128) && keys.length === n + 1, code, 'dense bounded own array required');
        return Array.from({ length: n }, (_, i) => { check(Object.hasOwn(descriptors, String(i)), code, 'sparse/foreign own array field refused'); return copy(descriptors[String(i)].value, depth + 1); });
      }
      return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    } finally { ancestors.delete(value); }
  }; return copy(input, 0);
}
function record(input: unknown, fields: string[], code: SurfaceInterpolationDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'own record required'); const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'exact fields required: ' + fields.join(',')); return data;
}
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => same(value, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') { const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
    return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(key => Object.hasOwn(y, key) && same(x[key], y[key])); } return Object.is(a, b);
}
function id(value: unknown): string { check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII ID1..48 required'); return value; }
function admitAxis(input: unknown, axis: 'u' | 'v'): number[] {
  check(Array.isArray(input) && input.length >= 2 && input.length <= 16 && input.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000),
    CODE.INPUT, '2..16 explicit finite original parameters within10000 required', { axis });
  const values = input as number[];
  for (let i = 1; i < values.length; i++) check(values[i] > values[i - 1] && Number.isFinite(values[i] - values[i - 1]), CODE.INPUT, 'strictly increasing original parameters required', { axis, index: i });
  check(Number.isFinite(values[values.length - 1] - values[0]) && values[values.length - 1] > values[0], CODE.INPUT, 'finite positive original axis span required', { axis }); return values;
}
function finite(value: number): number { check(Number.isFinite(value), CODE.REPRESENTABILITY, 'finite actual native Surface residual arithmetic required'); return value; }

/** Native tensor interpolation by the actual verified Curve constructor in U columns, then solved V rows. */
export function buildInterpolatingSurface(parametersUInput: number[], parametersVInput: number[], pointsInput: Point[][],
  optionsInput: SurfaceInterpolationOptions): SurfaceInterpolationResult {
  const data = record(snapshot({ parametersU: parametersUInput, parametersV: parametersVInput, points: pointsInput, options: optionsInput }), ['parametersU', 'parametersV', 'points', 'options']);
  const parametersU = admitAxis(data.parametersU, 'u'), parametersV = admitAxis(data.parametersV, 'v'), n = parametersU.length, m = parametersV.length;
  check(Array.isArray(data.points) && data.points.length === n && data.points.every(row => Array.isArray(row) && row.length === m && row.every(point => Array.isArray(point)
    && point.length === 3 && point.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000))), CODE.INPUT, 'rectangular authored points[U][V] matching axes with XYZ10000mm required');
  const points = data.points as Point[][], settings = record(data.options, ['surfaceId', 'degreeU', 'degreeV', 'maximumBasisEvaluations', 'maximumEliminationSteps', 'maximumSurfaceEvaluations']);
  const surfaceId = id(settings.surfaceId);
  check(typeof settings.degreeU === 'number' && Number.isInteger(settings.degreeU) && settings.degreeU >= 1 && settings.degreeU <= 3 && n >= settings.degreeU + 1,
    CODE.INPUT, 'U degree1..3/count>=degree+1 required', { axis: 'u' });
  check(typeof settings.degreeV === 'number' && Number.isInteger(settings.degreeV) && settings.degreeV >= 1 && settings.degreeV <= 3 && m >= settings.degreeV + 1,
    CODE.INPUT, 'V degree1..3/count>=degree+1 required', { axis: 'v' });
  for (const [field, maximum] of [['maximumBasisEvaluations', 8192], ['maximumEliminationSteps', 3840], ['maximumSurfaceEvaluations', 256]] as const)
    check(typeof settings[field] === 'number' && Number.isInteger(settings[field]) && (settings[field] as number) >= 0 && (settings[field] as number) <= maximum,
      CODE.BUDGET, 'integer ' + field + ' within complete native work capacity required');
  const options: SurfaceInterpolationOptions = { surfaceId, degreeU: settings.degreeU, degreeV: settings.degreeV,
    maximumBasisEvaluations: settings.maximumBasisEvaluations as number, maximumEliminationSteps: settings.maximumEliminationSteps as number, maximumSurfaceEvaluations: settings.maximumSurfaceEvaluations as number };
  const plannedCounts: SurfaceInterpolationReport['plannedCounts'] = { basisEvaluations: n * m * (n + m), eliminationSteps: n * m * (n + m - 2) / 2,
    surfaceEvaluations: n * m, curveConstructions: n + m, nestedCurvePointEvaluations: 2 * n * m };
  check(plannedCounts.basisEvaluations <= options.maximumBasisEvaluations && plannedCounts.eliminationSteps <= options.maximumEliminationSteps
    && plannedCounts.surfaceEvaluations <= options.maximumSurfaceEvaluations, CODE.BUDGET, 'complete aggregate work budgets required BEFORE any native Curve constructor');
  const workId = (axis: 'u' | 'v', index: number): string => {
    const base = 'surface_interpolation_' + axis + '_' + index;
    return id(base === surfaceId ? 'surface_interpolation_' + axis + '_alt_' + index : base);
  };
  const uIds = Array.from({ length: m }, (_, j) => workId('u', j)), vIds = Array.from({ length: n }, (_, i) => workId('v', i));
  check(new Set([...uIds, ...vIds, surfaceId]).size === n + m + 1, CODE.IDENTITY, 'all bounded work Curve roles and final Surface ID must be distinct');
  const phaseU: SurfaceInterpolationReport['phaseU'] = [], phaseV: SurfaceInterpolationReport['phaseV'] = [];
  let curveConstructionCount = 0;
  for (let j = 0; j < m; j++) {
    curveConstructionCount++;
    const evaluation = native(() => buildInterpolatingCurve(parametersU.map((parameter, i) => ({ parameter, pointMM: points[i][j] })),
      { curveId: uIds[j], degree: options.degreeU, maximumBasisEvaluations: n * n, maximumEliminationSteps: n * (n - 1) / 2 }), 'actual U fixed-V Curve interpolation phase refused', { axis: 'u', index: j });
    phaseU.push({ axis: 'u', role: 'fixed-v-column', index: j, curveId: uIds[j], evaluation });
  }
  const knotsU = copyCadData(phaseU[0].evaluation.curve.knots);
  for (const phase of phaseU) check(phase.evaluation.curve.degree === options.degreeU && phase.evaluation.curve.controlPoints.length === n
    && same(phase.evaluation.curve.knots, knotsU) && phase.evaluation.curve.weights.every(value => Object.is(value, 1)), CODE.BINDING,
    'every actual U child must preserve matching polynomial U basis/weights', { axis: 'u', index: phase.index });
  for (let i = 0; i < n; i++) {
    curveConstructionCount++;
    const evaluation = native(() => buildInterpolatingCurve(parametersV.map((parameter, j) => ({ parameter, pointMM: phaseU[j].evaluation.curve.controlPoints[i] })),
      { curveId: vIds[i], degree: options.degreeV, maximumBasisEvaluations: m * m, maximumEliminationSteps: m * (m - 1) / 2 }), 'actual V solved-U-pole Curve interpolation phase refused', { axis: 'v', index: i });
    phaseV.push({ axis: 'v', role: 'solved-u-pole-row', index: i, curveId: vIds[i], evaluation });
  }
  const knotsV = copyCadData(phaseV[0].evaluation.curve.knots);
  for (const phase of phaseV) check(phase.evaluation.curve.degree === options.degreeV && phase.evaluation.curve.controlPoints.length === m
    && same(phase.evaluation.curve.knots, knotsV) && phase.evaluation.curve.weights.every(value => Object.is(value, 1)), CODE.BINDING,
    'every actual V child must preserve matching polynomial V basis/weights', { axis: 'v', index: phase.index });
  const allPhases = [...phaseU, ...phaseV], basisEvaluationCount = allPhases.reduce((sum, phase) => sum + phase.evaluation.report.basisEvaluationCount, 0);
  const eliminationStepCount = allPhases.reduce((sum, phase) => sum + phase.evaluation.report.eliminationStepCount, 0);
  const nestedCurvePointEvaluationCount = allPhases.reduce((sum, phase) => sum + phase.evaluation.report.pointEvaluationCount, 0);
  check(basisEvaluationCount === plannedCounts.basisEvaluations && eliminationStepCount === plannedCounts.eliminationSteps && curveConstructionCount === plannedCounts.curveConstructions
    && nestedCurvePointEvaluationCount === plannedCounts.nestedCurvePointEvaluations, CODE.BINDING, 'actual child report counts must prove complete planned U/V work');
  const candidate: Surface = { kind: 'surface', id: surfaceId, degreeU: options.degreeU, degreeV: options.degreeV, knotsU, knotsV,
    controlPoints: phaseV.map(phase => copyCadData(phase.evaluation.curve.controlPoints)), weights: Array.from({ length: n }, () => Array<number>(m).fill(1)) };
  for (const i of [0, n - 1]) for (const j of [0, m - 1]) check(same(candidate.controlPoints[i][j], points[i][j]), CODE.BINDING, 'four actual native phase endpoint corner coefficient bits must equal original grid');
  native(() => validateSurface(candidate), 'actual polynomial native tensor Surface validation');
  const expected: Model = { name: surfaceId, version: 0, lengthUnit: 'mm', objects: [candidate] }, file = native(() => adopt(expected), 'actual single-Surface native Source0 adoption');
  check(file.source.length <= 262144, CODE.BUDGET, 'source string capacity exceeded');
  check(same(file.model, expected), CODE.BINDING, 'single native source geometry/IDs/order/basis/weights/poles/signs must match');
  const surface = file.model.objects[0] as Surface, observations: SurfaceInterpolationObservation[] = [];
  let surfaceEvaluationCount = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    surfaceEvaluationCount++;
    const actualPointMM = native(() => evaluateSurface(surface, parametersU[i], parametersV[j]), 'actual final native Surface grid residual');
    const differenceMM = finite(Math.hypot(...actualPointMM.map((value, axis) => finite(value - points[i][j][axis]))));
    check(differenceMM <= TOLERANCE, CODE.BINDING, 'actual native tensor through-grid residual exceeds1e-7mm');
    observations.push({ u: parametersU[i], v: parametersV[j], inputIndex: [i, j], inputPointMM: points[i][j], actualPointMM, differenceMM });
  }
  check(surfaceEvaluationCount === plannedCounts.surfaceEvaluations, CODE.BINDING, 'complete actual direct Surface grid work required');
  const report: SurfaceInterpolationReport = {
    schema: 'barocss-native-surface-interpolation', version: 0, surfaceId, lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion',
    degreeU: options.degreeU, degreeV: options.degreeV, pointGrid: [n, m], controlPointGrid: [n, m], parametersU, parametersV,
    domains: surfaceDomain(surface), knotsU, knotsV, axisRoles: { u: 'original-u-grid-parameter', v: 'original-v-grid-parameter' }, phaseU, phaseV, plannedCounts,
    basisEvaluationCount, eliminationStepCount, surfaceEvaluationCount, curveConstructionCount, nestedCurvePointEvaluationCount,
    observations, maximumPointDifferenceMM: Math.max(...observations.map(observation => observation.differenceMM)), cornerBitsPreserved: true,
    geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    quality: { authority: 'actual-public-native-curve-interpolation-in-u-then-v', ordering: 'u-columns-then-solved-u-pole-v-rows', weights: 'polynomial-all-one',
      parameters: 'explicit-original-parameters-and-child-knot-bits', intermediateGeometry: 'temporary-constructor-curves-not-cad-edges-or-topology',
      workScope: 'actual-child-basis-and-elimination-counts-nested-final-curve-checks-separate-from-direct-surface-checks', noBasisFactorCacheClaimed: true,
      cornerEndpointBitsPreserved: true, localGridInterpolationAccuracyOnly: true, rationalFit: false, tangentConstraintsSolved: false,
      periodicCertified: false, leastSquaresFit: false, regularityCertified: false, globalShapeErrorCertified: false, globalBinary64ErrorCertified: false,
      manufacturingToleranceCertified: false, source: 'single-native-surface-model-intermediate-curve-sources-retained-as-nested-proofs', sourceObjectLimitUnchanged: 16,
      ownership: 'copied-cpu-data-gc-no-renderer-resources' }, budgetFailure: 'atomic-refusal-no-partial-interpolating-surface',
    limits: { maximumAxisPoints: 16, maximumDegree: 3, maximumSurfacePoles: 256, maximumBasisEvaluations: 8192, maximumEliminationSteps: 3840,
      maximumSurfaceEvaluations: 256, maximumCurveConstructions: 32, authoredIdCharacters: 48, parameterAbs: 10000, coordinateAbsMM: 10000,
      pointComparisonMM: TOLERANCE, inputValues: 32768, inputDepth: 8, inputArrayElements: 128, inputRecordFields: 16, inputStringCharacters: 128,
      ownValues: 1048576, ownDepth: 40, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144 },
  };
  return snapshot({ parametersU, parametersV, points, options, surface, source: file.source, sourceVersion: 0, model: file.model, report }, true) as SurfaceInterpolationResult;
}
/** Complete current native U/V child reconstruction and full bit-sensitive Surface/source/report equality. */
export function validateInterpolatingSurface(input: SurfaceInterpolationResult): SurfaceInterpolationReport {
  const owned = record(snapshot(input, true), ['parametersU', 'parametersV', 'points', 'options', 'surface', 'source', 'sourceVersion', 'model', 'report'], CODE.OWNED) as unknown as SurfaceInterpolationResult;
  let expected: SurfaceInterpolationResult;
  try { expected = buildInterpolatingSurface(owned.parametersU, owned.parametersV, owned.points, owned.options); } catch (cause) {
    const context = cause instanceof SurfaceInterpolationError ? { axis: cause.axis, index: cause.index } : {};
    throw new SurfaceInterpolationError(CODE.OWNED, 'owned complete native Surface interpolation reconstruction refused', { ...context, cause });
  }
  check(same(owned, expected), CODE.OWNED, 'owned original grid/params/options/child solver/source/basis/poles/work/observations/report mismatch');
  return snapshot(expected.report, true) as SurfaceInterpolationReport;
}
