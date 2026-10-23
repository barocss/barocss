import { CadNumericPolicy } from '../numeric-policy.js';
import { buildInterpolatingCurve, CurveInterpolationError } from '../nurbs/curves/curve-interpolation.js';
import type { CurveInterpolationResult } from '../nurbs/curves/curve-interpolation.js';
import { validateCurve, validateSurface, curveDomain, surfaceDomain, evaluateCurve, evaluateSurface } from '../core/math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from '../core/derivatives.js';
import type { CurveD1Result, SurfaceD1Result } from '../core/derivatives.js';
import { adopt } from '../intersect/own-plane-cylinder-intersection-internal.js';
import { copyCadData } from '../data-copy.js';
import type { Curve, Surface, Model, Point } from '../types.js';
import { same } from '../core/structural-equality.js';

export const MultiSectionLoftDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BASIS: 'BASIS', BUDGET: 'BUDGET', NATIVE: 'NATIVE',
  REPRESENTABILITY: 'REPRESENTABILITY', CONDITIONING: 'CONDITIONING', BINDING: 'BINDING', OWNED: 'OWNED' } as const);
export type MultiSectionLoftDiagnosticCode = typeof MultiSectionLoftDiagnosticCode[keyof typeof MultiSectionLoftDiagnosticCode];
export class MultiSectionLoftError extends Error {
  readonly code: MultiSectionLoftDiagnosticCode; readonly poleIndex: number | null;
  constructor(code: MultiSectionLoftDiagnosticCode, detail: string, context: { poleIndex?: number | null; cause?: unknown } = {}) {
    const poleIndex = typeof context.poleIndex === 'number' && Number.isInteger(context.poleIndex) && context.poleIndex >= 0 && context.poleIndex < 16 ? context.poleIndex : null;
    super(('Multi-section loft Surface: ' + (poleIndex === null ? '' : 'pole[' + poleIndex + ']: ') + detail).slice(0, 1024), context.cause === undefined ? undefined : { cause: context.cause });
    this.name = 'MultiSectionLoftError'; this.code = code; this.poleIndex = poleIndex;
  }
}
export interface MultiSectionLoftOptions { surfaceId: string; degreeV: number; maximumBasisEvaluations: number; maximumEliminationSteps: number; maximumObservations: number }
type D1State<T> = { status: 'evaluated'; value: T } | { status: 'native-refused'; reason: string; nativeErrorName: string };
export interface MultiSectionLoftObservation {
  u: number; v: number; sectionIndex: number; originalPointMM: Point; actualPointMM: Point; differenceMM: number;
  originalD1: D1State<CurveD1Result>; surfaceD1: D1State<SurfaceD1Result>; representativeVStateIndex: number; relativeDuDifference: number | null;
}
export interface MultiSectionLoftProvenance {
  kind: 'compatible-rational-u-polynomial-v-section-interpolation'; sectionIds: string[]; surfaceId: string; originalUKnots: number[]; originalUWeights: number[]; parametersV: number[];
  rowCurves: { poleIndex: number; curveId: string; evaluation: CurveInterpolationResult }[];
  poleMappings: { surfacePole: [number, number]; rowCurveId: string; rowCurvePoleIndex: number; origin: 'original-endpoint-bit-copy' | 'row-interpolation-solved';
    originalSectionIndex: number | null; originalPoleIndex: number | null; pointMM: Point }[];
  weightMappings: { surfacePole: [number, number]; origin: 'common-u-weight-bit-copy'; originalSectionIndex: 0; originalPoleIndex: number; weight: number }[];
  uKnotMappings: { originalKnotIndex: number; surfaceKnotIndex: number; originalValue: number; surfaceValue: number }[];
  vKnotMappings: { rowCurveKnotIndex: number; surfaceKnotIndex: number; rowCurveValue: number; surfaceValue: number }[];
  endpointBitsPreserved: true;
}
export interface MultiSectionLoftReport {
  schema: 'barocss-native-multi-section-loft'; version: 0; surfaceId: string; sectionIds: string[]; lengthUnit: 'mm'; sourceFrame: 'authored-xyz-no-axis-conversion';
  degreeU: number; degreeV: number; controlPointGrid: [number, number]; sectionCount: number; domains: { u: [number, number]; v: [number, number] };
  axisRoles: { u: 'original-common-section-parameter'; v: 'original-section-interpolation-parameter' }; parametersV: number[]; uSamples: number[];
  unrepresentedMidpointIntervals: { domain: [number, number]; attemptedParameter: number }[];
  plannedCounts: { basisEvaluations: number; eliminationSteps: number; observations: number; rowCurveConstructions: number; nestedCurvePointEvaluations: number; representativeVD1Evaluations: number };
  basisEvaluationCount: number; eliminationStepCount: number; rowCurveConstructionCount: number; nestedCurvePointEvaluationCount: number;
  observationCount: number; originalCurveD0EvaluationCount: number; surfaceD0EvaluationCount: number; originalCurveD1AttemptCount: number; surfaceD1AttemptCount: number; representativeVD1AttemptCount: number;
  representativeVStates: { sectionIndex: number; parameter: number; curveId: string; state: D1State<CurveD1Result> }[];
  guardedParameters: { u: number[]; v: number[] }; observations: MultiSectionLoftObservation[]; derivativeComparisonCount: number; derivativeRefusalCount: number;
  derivativeSourceRefusalCounts: { originalU: number; representativeV: number; surface: number };
  maximumPointDifferenceMM: number; maximumRelativeDuDifference: number | null; sourceModelObjectCount: number;
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  quality: { authority: 'actual-original-compatible-sections-and-public-native-row-interpolation'; uBasisAndWeightBitsPreserved: true;
    vBasis: 'actual-polynomial-row-interpolation-original-parameters'; endpointPoleAndWeightBitsPreserved: true;
    intermediateRows: 'temporary-native-control-curves-not-cad-edges'; nativeD1Refusals: 'actual-surface-refusal-iff-original-u-or-representative-v-refuses-no-inferred-du';
    representativeVMeaning: 'actual-first-row-guard-state-not-surface-dv-comparison'; localObservationsOnly: true;
    workScope: 'actual-child-basis-row-work-and-throughpoint-checks-separate-from-section-observations-and-representative-v-d1';
    globalShapeErrorCertified: false; globalBinary64ErrorCertified: false; manufacturingToleranceCertified: false; g1g2Certified: false;
    regularityCertified: false; sewingCertified: false; sourceObjectLimitUnchanged: 16; ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-no-partial-multi-section-loft';
  limits: { maximumSections: 15; maximumUPoles: 16; maximumDegree: 3; maximumSurfacePoles: 240; maximumUSamples: 31;
    maximumBasisEvaluations: 3600; maximumEliminationSteps: 1680; maximumObservations: 465; maximumSourceObjects: 16; authoredIdCharacters: 48;
    coordinateAbsMM: 10000; parameterAbs: 10000; weightRange: [1e-6, 1e6]; pointComparisonMM: 1e-7; relativeDuComparison: 1e-7;
    inputValues: 32768; inputDepth: 8; inputArrayElements: 128; inputRecordFields: 16; inputStringCharacters: 128;
    ownValues: 1048576; ownDepth: 40; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144 };
}
export interface MultiSectionLoftResult { sections: Curve[]; parametersV: number[]; options: MultiSectionLoftOptions; surface: Surface;
  source: string; sourceVersion: 0; model: Model; provenance: MultiSectionLoftProvenance; report: MultiSectionLoftReport }

const CODE = MultiSectionLoftDiagnosticCode, TOLERANCE = CadNumericPolicy.linearToleranceMM;
type Context = { poleIndex?: number | null; cause?: unknown };
function check(condition: boolean, code: MultiSectionLoftDiagnosticCode, detail: string, context: Context = {}): asserts condition {
  if (!condition) throw new MultiSectionLoftError(code, detail, context);
}
function native<T>(action: () => T, detail: string, context: Context = {}, code: MultiSectionLoftDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof MultiSectionLoftError) throw cause;
    throw new MultiSectionLoftError(cause instanceof CurveInterpolationError ? cause.code : code,
      detail + ': ' + (cause instanceof Error ? cause.message : 'native operation refused'), { ...context, cause });
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
function record(input: unknown, fields: string[], code: MultiSectionLoftDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'own record required'); const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'exact fields required: ' + fields.join(',')); return data;
}
function id(value: unknown): string { check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII ID1..48 required'); return value; }
function finite(value: number): number { check(Number.isFinite(value), CODE.REPRESENTABILITY, 'finite native parameter/observation arithmetic required'); return value; }
function distance(a: Point, b: Point): number { return finite(Math.hypot(...a.map((value, i) => finite(value - b[i])))); }
function relative(a: Point, b: Point): number { const difference = distance(a, b), value = finite(difference / Math.max(1, finite(Math.hypot(...a)), finite(Math.hypot(...b))));
  check(difference === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero local du residual underflow'); return value; }
function attempt<T>(action: () => T, refused: (cause: Error) => void): D1State<T> {
  try { return { status: 'evaluated', value: action() }; } catch (cause) {
    check(cause instanceof Error, CODE.NATIVE, 'actual native D1 refusal must carry an Error'); refused(cause);
    return { status: 'native-refused', reason: cause.message.slice(0, 1024), nativeErrorName: cause.name.slice(0, 128) };
  }
}
function uSamples(curve: Curve): { values: number[]; gaps: { domain: [number, number]; attemptedParameter: number }[]; guards: number[] } {
  const domain = curveDomain(curve); check(Number.isFinite(domain[1] - domain[0]) && domain[1] > domain[0], CODE.REPRESENTABILITY, 'finite positive common original U span required');
  const breaks = [domain[0]];
  for (const knot of curve.knots) if (knot > domain[0] && knot < domain[1] && knot !== breaks[breaks.length - 1]) breaks.push(knot);
  breaks.push(domain[1]);
  const values: number[] = [], gaps: { domain: [number, number]; attemptedParameter: number }[] = [];
  for (let i = 0; i < breaks.length; i++) { values.push(breaks[i]); if (i + 1 === breaks.length) continue;
    const middle = finite(breaks[i] + finite(breaks[i + 1] - breaks[i]) / 2);
    if (middle > breaks[i] && middle < breaks[i + 1]) values.push(middle); else gaps.push({ domain: [breaks[i], breaks[i + 1]], attemptedParameter: middle }); }
  check(values.length <= 31, CODE.BUDGET, 'common native U sample bound31 exceeded');
  return { values, gaps, guards: breaks.filter(value => value > domain[0] && value < domain[1] && curve.knots.filter(knot => knot === value).length >= curve.degree) };
}

/** Compatible rational-U sections interpolated in original V units by actual public native row Curves. */
export function buildMultiSectionLoftSurface(sectionsInput: Curve[], parametersVInput: number[], optionsInput: MultiSectionLoftOptions): MultiSectionLoftResult {
  const data = record(snapshot({ sections: sectionsInput, parametersV: parametersVInput, options: optionsInput }), ['sections', 'parametersV', 'options']);
  check(Array.isArray(data.sections) && data.sections.length >= 2 && data.sections.length <= 15, CODE.INPUT, '2..15 original compatible native sections required');
  const sections: Curve[] = data.sections.map(input => {
    const curve = record(input, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']) as unknown as Curve; id(curve.id);
    check(curve.kind === 'curve' && Number.isInteger(curve.degree) && curve.degree >= 1 && curve.degree <= 3 && Array.isArray(curve.controlPoints)
      && curve.controlPoints.length >= 2 && curve.controlPoints.length <= 16 && curve.controlPoints.every(point => Array.isArray(point) && point.length === 3
        && point.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000)), CODE.INPUT, 'native degree1..3/poles2..16/XYZ10000mm section required');
    native(() => validateCurve(curve), 'actual original positive clamped section validation', {}, CODE.INPUT);
    check(curve.knots.every(value => Math.abs(value) <= 10000) && Number.isFinite(curve.knots[curve.controlPoints.length] - curve.knots[curve.degree]),
      CODE.INPUT, 'common active U knots within10000 and finite positive span required'); return curve;
  });
  const first = sections[0], m = first.controlPoints.length, n = sections.length;
  for (const section of sections) check(section.degree === first.degree && section.controlPoints.length === m && same(section.knots, first.knots) && same(section.weights, first.weights),
    CODE.BASIS, 'all original U degrees/pole counts/knot and weight bits must match without repair');
  check(Array.isArray(data.parametersV) && data.parametersV.length === n && data.parametersV.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000),
    CODE.INPUT, 'one explicit finite original V parameter within10000 per section required');
  const parametersV = data.parametersV as number[];
  for (let j = 1; j < n; j++) check(parametersV[j] > parametersV[j - 1] && Number.isFinite(parametersV[j] - parametersV[j - 1]), CODE.INPUT, 'strictly increasing original V parameters required');
  check(Number.isFinite(parametersV[n - 1] - parametersV[0]) && parametersV[n - 1] > parametersV[0], CODE.INPUT, 'positive finite original V span required');
  const settings = record(data.options, ['surfaceId', 'degreeV', 'maximumBasisEvaluations', 'maximumEliminationSteps', 'maximumObservations']), surfaceId = id(settings.surfaceId);
  check(new Set([...sections.map(section => section.id), surfaceId]).size === n + 1, CODE.IDENTITY, 'all original section and final Surface IDs must be distinct');
  check(typeof settings.degreeV === 'number' && Number.isInteger(settings.degreeV) && settings.degreeV >= 1 && settings.degreeV <= 3 && n >= settings.degreeV + 1,
    CODE.INPUT, 'V degree1..3/sectionCount>=degree+1 required');
  for (const [field, maximum] of [['maximumBasisEvaluations', 3600], ['maximumEliminationSteps', 1680], ['maximumObservations', 465]] as const)
    check(typeof settings[field] === 'number' && Number.isInteger(settings[field]) && (settings[field] as number) >= 0 && (settings[field] as number) <= maximum,
      CODE.BUDGET, 'integer ' + field + ' within complete native work capacity required');
  const options: MultiSectionLoftOptions = { surfaceId, degreeV: settings.degreeV, maximumBasisEvaluations: settings.maximumBasisEvaluations as number,
    maximumEliminationSteps: settings.maximumEliminationSteps as number, maximumObservations: settings.maximumObservations as number };
  const samples = uSamples(first), plannedCounts: MultiSectionLoftReport['plannedCounts'] = { basisEvaluations: m * n * n, eliminationSteps: m * n * (n - 1) / 2,
    observations: samples.values.length * n, rowCurveConstructions: m, nestedCurvePointEvaluations: m * n, representativeVD1Evaluations: n };
  check(plannedCounts.basisEvaluations <= options.maximumBasisEvaluations && plannedCounts.eliminationSteps <= options.maximumEliminationSteps && plannedCounts.observations <= options.maximumObservations,
    CODE.BUDGET, 'complete basis/row-stage/section-observation budgets required BEFORE any native row Curve constructor');
  const reserved = new Set([...sections.map(section => section.id), surfaceId]), rowIds: string[] = [];
  for (let i = 0; i < m; i++) {
    let selected: string | null = null;
    for (let attempt = 0; attempt < 33; attempt++) { const value = id('multi_section_loft_row_' + i + '_' + attempt);
      if (!reserved.has(value)) { selected = value; break; } }
    check(selected !== null, CODE.IDENTITY, 'bounded unique temporary row Curve allocation exhausted', { poleIndex: i }); reserved.add(selected); rowIds.push(selected);
  }
  const rowCurves: MultiSectionLoftProvenance['rowCurves'] = [];
  let rowCurveConstructionCount = 0;
  for (let i = 0; i < m; i++) {
    rowCurveConstructionCount++;
    const evaluation = native(() => buildInterpolatingCurve(parametersV.map((parameter, section) => ({ parameter, pointMM: sections[section].controlPoints[i] })),
      { curveId: rowIds[i], degree: options.degreeV, maximumBasisEvaluations: n * n, maximumEliminationSteps: n * (n - 1) / 2 }), 'actual native V row interpolation refused', { poleIndex: i });
    rowCurves.push({ poleIndex: i, curveId: rowIds[i], evaluation });
  }
  const knotsV = copyCadData(rowCurves[0].evaluation.curve.knots);
  for (const row of rowCurves) check(row.evaluation.curve.degree === options.degreeV && row.evaluation.curve.controlPoints.length === n && same(row.evaluation.curve.knots, knotsV)
    && row.evaluation.curve.weights.every(weight => Object.is(weight, 1)), CODE.BINDING, 'every actual V child must retain common polynomial basis/weights', { poleIndex: row.poleIndex });
  const basisEvaluationCount = rowCurves.reduce((sum, row) => sum + row.evaluation.report.basisEvaluationCount, 0);
  const eliminationStepCount = rowCurves.reduce((sum, row) => sum + row.evaluation.report.eliminationStepCount, 0);
  const nestedCurvePointEvaluationCount = rowCurves.reduce((sum, row) => sum + row.evaluation.report.pointEvaluationCount, 0);
  check(basisEvaluationCount === plannedCounts.basisEvaluations && eliminationStepCount === plannedCounts.eliminationSteps && rowCurveConstructionCount === m
    && nestedCurvePointEvaluationCount === plannedCounts.nestedCurvePointEvaluations, CODE.BINDING, 'actual complete row Curve work must match preplanned counts');
  const candidate: Surface = { kind: 'surface', id: surfaceId, degreeU: first.degree, degreeV: options.degreeV, knotsU: copyCadData(first.knots), knotsV,
    controlPoints: rowCurves.map(row => copyCadData(row.evaluation.curve.controlPoints)), weights: first.weights.map(weight => Array<number>(n).fill(weight)) };
  const poleMappings: MultiSectionLoftProvenance['poleMappings'] = [], weightMappings: MultiSectionLoftProvenance['weightMappings'] = [];
  for (let i = 0; i < m; i++) for (let k = 0; k < n; k++) {
    const endpoint = k === 0 || k === n - 1;
    if (endpoint) check(same(candidate.controlPoints[i][k], sections[k].controlPoints[i]) && Object.is(candidate.weights[i][k], sections[k].weights[i]),
      CODE.BINDING, 'first/last original section pole and weight bits must be exactly preserved', { poleIndex: i });
    poleMappings.push({ surfacePole: [i, k], rowCurveId: rowIds[i], rowCurvePoleIndex: k, origin: endpoint ? 'original-endpoint-bit-copy' : 'row-interpolation-solved',
      originalSectionIndex: endpoint ? k : null, originalPoleIndex: endpoint ? i : null, pointMM: candidate.controlPoints[i][k] });
    weightMappings.push({ surfacePole: [i, k], origin: 'common-u-weight-bit-copy', originalSectionIndex: 0, originalPoleIndex: i, weight: candidate.weights[i][k] });
  }
  native(() => validateSurface(candidate), 'actual compatible rational-U/polynomial-V Surface validation');
  const expected: Model = { name: surfaceId, version: 0, lengthUnit: 'mm', objects: [...sections, candidate] }, file = native(() => adopt(expected), 'actual ALL-sections-plus-Surface native Source0 adoption');
  check(file.source.length <= 262144 && file.model.objects.length === n + 1 && n + 1 <= 16, CODE.BUDGET, 'source string/original Model16 capacity required');
  check(same(file.model, expected), CODE.BINDING, 'complete original section and generated Surface source IDs/order/basis/weights/poles/sign bits must match');
  const surface = file.model.objects[n] as Surface;
  const representativeVErrors: (Error | undefined)[] = [];
  let representativeVD1AttemptCount = 0;
  const representativeVStates: MultiSectionLoftReport['representativeVStates'] = parametersV.map((parameter, sectionIndex) => {
    representativeVD1AttemptCount++;
    const state = attempt(() => evaluateCurveD1(rowCurves[0].evaluation.curve, parameter), cause => { representativeVErrors[sectionIndex] = cause; });
    return { sectionIndex, parameter, curveId: rowIds[0], state };
  });
  const observations: MultiSectionLoftObservation[] = [];
  let originalCurveD0EvaluationCount = 0, surfaceD0EvaluationCount = 0, originalCurveD1AttemptCount = 0, surfaceD1AttemptCount = 0, derivativeComparisonCount = 0, derivativeRefusalCount = 0;
  const derivativeSourceRefusalCounts = { originalU: 0, representativeV: representativeVStates.filter(entry => entry.state.status === 'native-refused').length, surface: 0 };
  for (const u of samples.values) for (let sectionIndex = 0; sectionIndex < n; sectionIndex++) {
    const v = parametersV[sectionIndex]; originalCurveD0EvaluationCount++; surfaceD0EvaluationCount++;
    const originalPointMM = native(() => evaluateCurve(sections[sectionIndex], u), 'actual original section D0 observation'), actualPointMM = native(() => evaluateSurface(surface, u, v), 'actual generated Surface section D0 observation');
    const differenceMM = distance(originalPointMM, actualPointMM); check(differenceMM <= TOLERANCE, CODE.BINDING, 'actual original section/Surface point residual exceeds1e-7mm');
    let originalError: Error | undefined, surfaceError: Error | undefined;
    originalCurveD1AttemptCount++; const originalD1 = attempt(() => evaluateCurveD1(sections[sectionIndex], u), cause => { originalError = cause; });
    surfaceD1AttemptCount++; const surfaceD1 = attempt(() => evaluateSurfaceD1(surface, u, v), cause => { surfaceError = cause; });
    if (originalD1.status === 'native-refused') derivativeSourceRefusalCounts.originalU++;
    if (surfaceD1.status === 'native-refused') derivativeSourceRefusalCounts.surface++;
    const vState = representativeVStates[sectionIndex].state, originalRefused = originalD1.status === 'native-refused' || vState.status === 'native-refused';
    if ((surfaceD1.status === 'native-refused') !== originalRefused) throw new MultiSectionLoftError(CODE.BINDING,
      'actual Surface D1 must refuse iff original U or representative V D1 refuses; no inferred du', { cause: surfaceError ?? originalError ?? representativeVErrors[sectionIndex] });
    let relativeDuDifference: number | null = null;
    if (originalD1.status === 'evaluated' && surfaceD1.status === 'evaluated' && vState.status === 'evaluated') {
      derivativeComparisonCount++; relativeDuDifference = relative(surfaceD1.value.du, originalD1.value.derivative);
      check(relativeDuDifference <= TOLERANCE, CODE.BINDING, 'actual Surface du/original section D1 residual exceeds1e-7 relative');
    } else derivativeRefusalCount++;
    observations.push({ u, v, sectionIndex, originalPointMM, actualPointMM, differenceMM, originalD1, surfaceD1, representativeVStateIndex: sectionIndex, relativeDuDifference });
  }
  check(observations.length === plannedCounts.observations && originalCurveD0EvaluationCount === observations.length && surfaceD0EvaluationCount === observations.length
    && originalCurveD1AttemptCount === observations.length && surfaceD1AttemptCount === observations.length && representativeVD1AttemptCount === n,
    CODE.BINDING, 'complete actual section point/D1 and separately sampled representative V work required');
  const provenance: MultiSectionLoftProvenance = { kind: 'compatible-rational-u-polynomial-v-section-interpolation', sectionIds: sections.map(section => section.id), surfaceId,
    originalUKnots: first.knots, originalUWeights: first.weights, parametersV, rowCurves, poleMappings, weightMappings,
    uKnotMappings: first.knots.map((value, i) => ({ originalKnotIndex: i, surfaceKnotIndex: i, originalValue: value, surfaceValue: surface.knotsU[i] })),
    vKnotMappings: knotsV.map((value, k) => ({ rowCurveKnotIndex: k, surfaceKnotIndex: k, rowCurveValue: value, surfaceValue: surface.knotsV[k] })), endpointBitsPreserved: true };
  const compared = observations.filter(observation => observation.relativeDuDifference !== null);
  const report: MultiSectionLoftReport = {
    schema: 'barocss-native-multi-section-loft', version: 0, surfaceId, sectionIds: sections.map(section => section.id), lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion',
    degreeU: first.degree, degreeV: options.degreeV, controlPointGrid: [m, n], sectionCount: n, domains: surfaceDomain(surface),
    axisRoles: { u: 'original-common-section-parameter', v: 'original-section-interpolation-parameter' }, parametersV, uSamples: samples.values,
    unrepresentedMidpointIntervals: samples.gaps, plannedCounts, basisEvaluationCount, eliminationStepCount, rowCurveConstructionCount, nestedCurvePointEvaluationCount,
    observationCount: observations.length, originalCurveD0EvaluationCount, surfaceD0EvaluationCount, originalCurveD1AttemptCount, surfaceD1AttemptCount, representativeVD1AttemptCount,
    representativeVStates, guardedParameters: { u: samples.guards, v: representativeVStates.filter(entry => entry.state.status === 'native-refused').map(entry => entry.parameter) },
    observations, derivativeComparisonCount, derivativeRefusalCount, derivativeSourceRefusalCounts, maximumPointDifferenceMM: Math.max(...observations.map(observation => observation.differenceMM)),
    maximumRelativeDuDifference: compared.length === 0 ? null : Math.max(...compared.map(observation => observation.relativeDuDifference!)), sourceModelObjectCount: file.model.objects.length,
    geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    quality: { authority: 'actual-original-compatible-sections-and-public-native-row-interpolation', uBasisAndWeightBitsPreserved: true,
      vBasis: 'actual-polynomial-row-interpolation-original-parameters', endpointPoleAndWeightBitsPreserved: true, intermediateRows: 'temporary-native-control-curves-not-cad-edges',
      nativeD1Refusals: 'actual-surface-refusal-iff-original-u-or-representative-v-refuses-no-inferred-du', representativeVMeaning: 'actual-first-row-guard-state-not-surface-dv-comparison',
      localObservationsOnly: true, workScope: 'actual-child-basis-row-work-and-throughpoint-checks-separate-from-section-observations-and-representative-v-d1',
      globalShapeErrorCertified: false, globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, g1g2Certified: false, regularityCertified: false,
      sewingCertified: false, sourceObjectLimitUnchanged: 16, ownership: 'copied-cpu-data-gc-no-renderer-resources' }, budgetFailure: 'atomic-refusal-no-partial-multi-section-loft',
    limits: { maximumSections: 15, maximumUPoles: 16, maximumDegree: 3, maximumSurfacePoles: 240, maximumUSamples: 31, maximumBasisEvaluations: 3600,
      maximumEliminationSteps: 1680, maximumObservations: 465, maximumSourceObjects: 16, authoredIdCharacters: 48, coordinateAbsMM: 10000, parameterAbs: 10000,
      weightRange: [1e-6, 1e6], pointComparisonMM: TOLERANCE, relativeDuComparison: TOLERANCE, inputValues: 32768, inputDepth: 8, inputArrayElements: 128,
      inputRecordFields: 16, inputStringCharacters: 128, ownValues: 1048576, ownDepth: 40, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144 },
  };
  return snapshot({ sections, parametersV, options, surface, source: file.source, sourceVersion: 0, model: file.model, provenance, report }, true) as MultiSectionLoftResult;
}
/** Rebuild every actual native row interpolation, source, mapping and original/Surface D1 state bit-for-bit. */
export function validateMultiSectionLoftSurface(input: MultiSectionLoftResult): MultiSectionLoftReport {
  const owned = record(snapshot(input, true), ['sections', 'parametersV', 'options', 'surface', 'source', 'sourceVersion', 'model', 'provenance', 'report'], CODE.OWNED) as unknown as MultiSectionLoftResult;
  let expected: MultiSectionLoftResult;
  try { expected = buildMultiSectionLoftSurface(owned.sections, owned.parametersV, owned.options); } catch (cause) {
    throw new MultiSectionLoftError(CODE.OWNED, 'owned complete compatible multi-section loft reconstruction refused', { poleIndex: cause instanceof MultiSectionLoftError ? cause.poleIndex : null, cause });
  }
  check(same(owned, expected), CODE.OWNED, 'owned original sections/V/options/rows/knots/weights/poles/source/native states/counts/quality report mismatch');
  return snapshot(expected.report, true) as MultiSectionLoftReport;
}
