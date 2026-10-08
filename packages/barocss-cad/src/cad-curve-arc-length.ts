import { resolveCadGeometryReference, CadReferenceError } from './cad-document-reference.js';
import type { CadGeometryReferenceV0 } from './cad-document-reference.js';
import type { CadDocumentResult } from './cad-document.js';
import { validateCurve, curveDomain, evaluateCurve } from './math.js';
import { evaluateCurveD1 } from './derivatives.js';
import type { Curve, Point } from './types.js';

export const CadCurveArcLengthDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', REFERENCE: 'REFERENCE', STALE: 'STALE', INTERVAL: 'INTERVAL', REPRESENTABILITY: 'REPRESENTABILITY',
  BUDGET: 'BUDGET', NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
} as const);
export type CadCurveArcLengthDiagnosticCode = typeof CadCurveArcLengthDiagnosticCode[keyof typeof CadCurveArcLengthDiagnosticCode];
export class CadCurveArcLengthError extends Error {
  readonly code: CadCurveArcLengthDiagnosticCode;
  constructor(code: CadCurveArcLengthDiagnosticCode, detail: string, cause?: unknown) {
    super(('CAD Curve arc length: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CadCurveArcLengthError'; this.code = code;
  }
}
export interface CadCurveArcLengthOptions {
  interval: [number, number] | null; absoluteToleranceMM: number; relativeTolerance: number;
  maximumEvaluations: number; maximumSubdivisions: number; maximumDepth: number;
}
export interface CadCurveArcLengthPanel {
  panelIndex: number; domain: [number, number]; depth: number; originalSpanIndex: number;
  Q3: number; Q5: number; gaussDifferenceMM: number; roundoffFloorMM: number; chordShortfallMM: number;
  nativeChordSumMM: number; errorEstimateMM: number;
  nodes: { parameter: number; speed: number; pointMM: Point }[]; endpointPointsMM: [Point, Point];
}
export interface CadCurveArcLengthReport {
  schema: 'barocss-cad-curve-arc-length'; version: 0; reference: CadGeometryReferenceV0;
  documentVersion: 1; sourceVersion: 0; lengthUnit: 'mm'; sourceFrame: 'authored-xyz-no-axis-conversion';
  originalDomain: [number, number]; requestedInterval: [number, number] | null; interval: [number, number];
  originalBreaks: number[]; initialBreaks: number[]; initialPanelCount: number; finalPanelCount: number;
  panelMeasurementCount: number; evaluationCount: number; pointEvaluationCount: number; guardEvaluationCount: number; subdivisionCount: number;
  guards: { parameter: number; multiplicity: number; status: 'native-refused'; nativeErrorName: string;
    nativeErrorCode: string | null; message: string }[];
  subdivisions: { index: number; parent: CadCurveArcLengthPanel; midpoint: number; lower: CadCurveArcLengthPanel; upper: CadCurveArcLengthPanel;
    evaluationCountAfterSubdivision: number; pointEvaluationCountAfterSubdivision: number }[];
  estimatedLengthMM: number; errorEstimateMM: number; requestedAbsoluteToleranceMM: number; requestedRelativeTolerance: number;
  achievedToleranceMM: number; criterion: 'aggregate-panel-estimator-not-certified-upper-bound'; criterionSatisfied: true;
  rule: { family: 'own-closed-form-three-and-five-point-gauss-legendre'; normalizedNodes: number[];
    G3Weights: [number, number, number]; G5Weights: [number, number, number, number, number]; sharedCentreEvaluatedOnce: true;
    derivativeCallsPerPanel: 7; endpointPointCallsPerPanel: 2 };
  geometryAuthority: 'actual-original-source0-curve-and-native-d1'; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  quality: { lengthEstimate: 'five-point-rule-only-no-chord-substitution';
    estimator: 'maximum-gauss-difference64-epsilon-floor-and-native-chord-shortfall';
    nativeChordSanity: 'ordered-native-point-polyline-heuristic-not-certified-bound';
    derivativeNodes: 'seven-distinct-strict-interior-native-parameters';
    knotGuards: 'separate-genuine-native-c0-refusals-not-quadrature-samples';
    panelIdentity: 'measurement-order-id-including-discarded-parents-final-array-is-u-order';
    discardedParentWorkCounted: true; zeroNativeSpeedSupported: true; globalErrorCertified: false;
    globalBinary64ErrorCertified: false; manufacturingToleranceCertified: false; g1g2Certified: false;
    ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-no-partial-result';
  limits: { maximumDegree: 3; maximumCurvePoles: 64; maximumKnots: 70; coordinateAbsMM: 10000; weightRange: [1e-6, 1e6];
    maximumEvaluations: 16384; maximumSubdivisions: 512; maximumDepth: 16; maximumGuards: 64;
    ownedValues: 262144; ownedDepth: 32; arrayElements: 4096; recordFields: 64; sourceStringCharacters: 262144;
    optionValues: 32768; optionDepth: 8; optionArrayElements: 128; optionRecordFields: 16; optionStringCharacters: 128 };
}
export interface CadCurveArcLengthResult {
  reference: CadGeometryReferenceV0; geometry: Curve; source: string; options: CadCurveArcLengthOptions;
  estimatedLengthMM: number; errorEstimateMM: number; panels: CadCurveArcLengthPanel[]; report: CadCurveArcLengthReport;
}

const CODE = CadCurveArcLengthDiagnosticCode, EPS = 64 * Number.EPSILON;
function check(condition: boolean, code: CadCurveArcLengthDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new CadCurveArcLengthError(code, detail);
}
function finite(value: number, detail: string, code: CadCurveArcLengthDiagnosticCode = CODE.REPRESENTABILITY): number {
  check(Number.isFinite(value), code, detail); return value;
}
function product(a: number, b: number): number {
  const value = finite(a * b, 'derived quadrature product overflow');
  check(a === 0 || b === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero derived quadrature product underflow'); return value;
}
function native<T>(action: () => T, detail: string, code: CadCurveArcLengthDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof CadCurveArcLengthError) throw cause;
    const actualCode = cause instanceof CadReferenceError
      ? cause.code === 'STALE' ? CODE.STALE : cause.code === 'INPUT' ? CODE.INPUT : CODE.REFERENCE : code;
    throw new CadCurveArcLengthError(actualCode, detail + ': ' + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
  }
}
function snapshot(input: unknown, mode: 'input' | 'options' | 'owned'): unknown {
  const options = mode === 'options', code = mode === 'owned' ? CODE.OWNED : CODE.INPUT;
  let remaining = options ? 32768 : 262144;
  const depthLimit = options ? 8 : 32, arrayLimit = options ? 128 : 4096;
  const fieldLimit = options ? 16 : 64, stringLimit = options ? 128 : 262144;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= depthLimit, code, 'own-value/depth budget exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'finite own numbers required'); return value; }
    if (typeof value === 'string') { check(value.length <= stringLimit, code, 'own string budget exceeded'); return value; }
    check(typeof value === 'object', code, 'plain own data required');
    check(!ancestors.has(value), code, 'cyclic own data refused');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      code, 'foreign own-data prototype refused');
    const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.length <= (array ? arrayLimit + 1 : fieldLimit), code, 'own field budget exceeded');
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden own data refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= arrayLimit && keys.length === length + 1, code, 'dense bounded own arrays required');
      result = Array.from({ length }, (_, index) => {
        check(Object.hasOwn(descriptors, String(index)), code, 'sparse/extra own array field refused');
        return copy(descriptors[String(index)].value, depth + 1);
      });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  };
  return native(() => copy(input, 0), 'own data snapshot', code);
}
function record(value: unknown, fields: string[], code: CadCurveArcLengthDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'own record required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    code, 'exact fields required: ' + fields.join(',')); return data;
}
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b)
    && a.length === b.length && a.every((value, index) => same(value, b[index]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    return Object.keys(left).length === Object.keys(right).length
      && Object.keys(left).every(key => Object.hasOwn(right, key) && same(left[key], right[key]));
  }
  return Object.is(a, b);
}
function options(input: CadCurveArcLengthOptions, domain: [number, number]): CadCurveArcLengthOptions {
  const o = record(snapshot(input, 'options'), ['interval', 'absoluteToleranceMM', 'relativeTolerance', 'maximumEvaluations', 'maximumSubdivisions', 'maximumDepth']);
  check(o.interval === null || Array.isArray(o.interval) && o.interval.length === 2
    && o.interval.every(value => typeof value === 'number' && Number.isFinite(value))
    && o.interval[0] < o.interval[1] && o.interval[0] >= domain[0] && o.interval[1] <= domain[1],
    CODE.INTERVAL, 'null or finite increasing interval inside original domain required');
  check(typeof o.absoluteToleranceMM === 'number' && o.absoluteToleranceMM >= 1e-9 && o.absoluteToleranceMM <= 1,
    CODE.INPUT, 'absoluteToleranceMM1e-9..1 required');
  check(typeof o.relativeTolerance === 'number' && o.relativeTolerance >= 0 && o.relativeTolerance <= 1e-2,
    CODE.INPUT, 'relativeTolerance0..1e-2 required');
  check(typeof o.maximumEvaluations === 'number' && Number.isInteger(o.maximumEvaluations) && o.maximumEvaluations >= 7 && o.maximumEvaluations <= 16384,
    CODE.BUDGET, 'maximumEvaluations7..16384 required');
  check(typeof o.maximumSubdivisions === 'number' && Number.isInteger(o.maximumSubdivisions) && o.maximumSubdivisions >= 0 && o.maximumSubdivisions <= 512,
    CODE.BUDGET, 'maximumSubdivisions0..512 required');
  check(typeof o.maximumDepth === 'number' && Number.isInteger(o.maximumDepth) && o.maximumDepth >= 0 && o.maximumDepth <= 16,
    CODE.BUDGET, 'maximumDepth0..16 required');
  return { interval: o.interval === null ? null : [o.interval[0], o.interval[1]], absoluteToleranceMM: o.absoluteToleranceMM,
    relativeTolerance: o.relativeTolerance, maximumEvaluations: o.maximumEvaluations, maximumSubdivisions: o.maximumSubdivisions, maximumDepth: o.maximumDepth };
}

/** Bounded native D1 quadrature with separately recorded original C0 guards and chord sanity. */
export function queryCadDocumentCurveArcLength(documentInput: CadDocumentResult, referenceInput: CadGeometryReferenceV0,
  optionInput: CadCurveArcLengthOptions): CadCurveArcLengthResult {
  const copiedDocument = snapshot(documentInput, 'input') as CadDocumentResult;
  const copiedReference = snapshot(referenceInput, 'input') as CadGeometryReferenceV0;
  const selected = native(() => resolveCadGeometryReference(copiedDocument, copiedReference), 'resolve actual current native Curve');
  check(selected.geometry.kind === 'curve', CODE.REFERENCE, 'arc length requires selected native Curve geometry');
  const geometry = selected.geometry;
  native(() => validateCurve(geometry), 'actual positive native Curve admission');
  check(geometry.degree >= 1 && geometry.degree <= 3 && geometry.controlPoints.length >= 2 && geometry.controlPoints.length <= 64
    && geometry.knots.length <= 70 && geometry.controlPoints.every(point => point.every(value => Math.abs(value) <= 10000)),
    CODE.INPUT, 'original degree1..3/64-pole/70-knot Curve with XYZ±10000mm required');
  const originalDomain = curveDomain(geometry);
  check(finite(originalDomain[1] - originalDomain[0], 'original domain span overflow') > 0, CODE.REPRESENTABILITY, 'positive represented original domain required');
  const settings = options(optionInput, originalDomain), interval: [number, number] = settings.interval === null
    ? [originalDomain[0], originalDomain[1]] : [settings.interval[0], settings.interval[1]];
  check(finite(interval[1] - interval[0], 'requested interval width overflow') > 0, CODE.REPRESENTABILITY, 'positive represented requested interval required');
  const originalBreaks = [originalDomain[0]];
  for (const knot of geometry.knots) if (knot > originalDomain[0] && knot < originalDomain[1] && !originalBreaks.some(value => value === knot)) originalBreaks.push(knot);
  originalBreaks.push(originalDomain[1]);
  const initialBreaks = [interval[0], ...originalBreaks.filter(value => value > interval[0] && value < interval[1]), interval[1]];
  const guards: CadCurveArcLengthReport['guards'] = [];
  for (const parameter of originalBreaks.slice(1, -1)) {
    const multiplicity = geometry.knots.filter(knot => knot === parameter).length;
    if (parameter < interval[0] || parameter > interval[1] || multiplicity < geometry.degree) continue;
    check(guards.length < 64, CODE.BUDGET, 'original C0 guard budget exceeded');
    try {
      evaluateCurveD1(geometry, parameter);
      throw new CadCurveArcLengthError(CODE.BINDING, 'actual original C0 native guard unexpectedly admitted D1');
    } catch (cause) {
      if (cause instanceof CadCurveArcLengthError) throw cause;
      if (!(cause instanceof Error && cause.message === 'First derivative is not defined at an exact C0 interior knot'))
        throw new CadCurveArcLengthError(CODE.NATIVE, 'actual original C0 derivative refusal required', cause);
      const code = Object.getOwnPropertyDescriptor(cause, 'code');
      guards.push({ parameter, multiplicity, status: 'native-refused', nativeErrorName: cause.name,
        nativeErrorCode: code && 'value' in code && typeof code.value === 'string' ? code.value : null, message: cause.message });
    }
  }
  const g3 = Math.sqrt(3 / 5), outer = Math.sqrt(5 + 2 * Math.sqrt(10 / 7)) / 3, inner = Math.sqrt(5 - 2 * Math.sqrt(10 / 7)) / 3;
  const normalizedNodes = [-outer, -g3, -inner, 0, inner, g3, outer];
  const G3Weights: [number, number, number] = [5 / 9, 8 / 9, 5 / 9];
  const outerWeight = (322 - 13 * Math.sqrt(70)) / 900, innerWeight = (322 + 13 * Math.sqrt(70)) / 900;
  const G5Weights: [number, number, number, number, number] = [outerWeight, innerWeight, 128 / 225, innerWeight, outerWeight];
  let panelMeasurementCount = 0, evaluationCount = 0, pointEvaluationCount = 0;
  const distance = (a: Point, b: Point): number => finite(Math.hypot(...a.map((value, axis) => finite(value - b[axis], 'native chord subtraction overflow'))), 'native chord norm overflow');
  const measure = (domain: [number, number], depth: number, originalSpanIndex: number): CadCurveArcLengthPanel => {
    const width = finite(domain[1] - domain[0], 'panel width overflow');
    check(width > 0, CODE.REPRESENTABILITY, 'positive represented panel width required');
    const half = product(width, .5), centre = finite(domain[0] + half, 'panel centre overflow');
    const parameters = normalizedNodes.map(node => node === 0 ? centre : finite(centre + product(half, node), 'native node mapping overflow'));
    check(parameters.every((parameter, index) => parameter > domain[0] && parameter < domain[1]
      && (index === 0 || parameter > parameters[index - 1])), CODE.REPRESENTABILITY, 'seven distinct strict-interior native nodes required');
    check(evaluationCount + 7 <= settings.maximumEvaluations, CODE.BUDGET, 'actual quadrature D1 evaluation budget exhausted');
    const panelIndex = panelMeasurementCount++;
    const nodes = parameters.map(parameter => {
      evaluationCount++;
      const result = native(() => evaluateCurveD1(geometry, parameter), 'actual interior native Curve D1');
      check(result.point.every(Number.isFinite) && result.derivative.every(Number.isFinite), CODE.NATIVE, 'finite original native D1 point/derivative required');
      const speed = finite(Math.hypot(...result.derivative), 'native derivative norm overflow');
      return { parameter, speed, pointMM: result.point };
    });
    const weighted = (indices: number[], weights: number[]): number => weights.reduce((sum, weight, i) =>
      finite(sum + product(weight, nodes[indices[i]].speed), 'positive quadrature sum overflow'), 0);
    const Q3 = product(half, weighted([1, 3, 5], G3Weights)), Q5 = product(half, weighted([0, 2, 3, 4, 6], G5Weights));
    const endpointPointsMM: [Point, Point] = [domain[0], domain[1]].map(parameter => {
      pointEvaluationCount++;
      const point = native(() => evaluateCurve(geometry, parameter), 'actual panel endpoint native Curve point');
      check(point.every(Number.isFinite), CODE.NATIVE, 'finite original endpoint point required'); return point;
    }) as [Point, Point];
    const points = [endpointPointsMM[0], ...nodes.map(node => node.pointMM), endpointPointsMM[1]];
    let nativeChordSumMM = 0;
    for (let i = 1; i < points.length; i++) nativeChordSumMM = finite(nativeChordSumMM + distance(points[i], points[i - 1]), 'native chord sum overflow');
    const gaussDifferenceMM = Math.abs(finite(Q5 - Q3, 'quadrature difference overflow'));
    const roundoffFloorMM = Q5 === 0 ? 0 : product(EPS, Math.abs(Q5));
    const chordShortfallMM = Math.max(0, finite(nativeChordSumMM - Q5, 'native chord shortfall overflow'));
    return { panelIndex, domain, depth, originalSpanIndex, Q3, Q5, gaussDifferenceMM, roundoffFloorMM, chordShortfallMM,
      nativeChordSumMM, errorEstimateMM: Math.max(gaussDifferenceMM, roundoffFloorMM, chordShortfallMM), nodes, endpointPointsMM };
  };
  const panels: CadCurveArcLengthPanel[] = [];
  for (let i = 1; i < initialBreaks.length; i++) {
    const domain: [number, number] = [initialBreaks[i - 1], initialBreaks[i]];
    const originalSpanIndex = originalBreaks.findIndex((low, index) => index + 1 < originalBreaks.length
      && domain[0] >= low && domain[1] <= originalBreaks[index + 1]);
    check(originalSpanIndex >= 0, CODE.BINDING, 'initial panel must bind one actual original native span');
    panels.push(measure(domain, 0, originalSpanIndex));
  }
  const initialPanelCount = panels.length, subdivisions: CadCurveArcLengthReport['subdivisions'] = [];
  const aggregate = (): { estimatedLengthMM: number; errorEstimateMM: number; achievedToleranceMM: number } => {
    const estimatedLengthMM = panels.reduce((sum, panel) => finite(sum + panel.Q5, 'aggregate Q5 sum overflow'), 0);
    const errorEstimateMM = panels.reduce((sum, panel) => finite(sum + panel.errorEstimateMM, 'aggregate estimator sum overflow'), 0);
    return { estimatedLengthMM, errorEstimateMM,
      achievedToleranceMM: Math.max(settings.absoluteToleranceMM, product(settings.relativeTolerance, estimatedLengthMM)) };
  };
  let totals = aggregate();
  while (totals.errorEstimateMM > totals.achievedToleranceMM) {
    let selectedIndex = 0;
    for (let i = 1; i < panels.length; i++) if (panels[i].errorEstimateMM > panels[selectedIndex].errorEstimateMM) selectedIndex = i;
    const parent = panels[selectedIndex];
    check(subdivisions.length < settings.maximumSubdivisions && parent.depth < settings.maximumDepth,
      CODE.BUDGET, 'selected worst panel subdivision/depth budget exhausted');
    check(evaluationCount + 14 <= settings.maximumEvaluations, CODE.BUDGET, 'both child panels exceed remaining D1 evaluation budget');
    const midpoint = finite(parent.domain[0] + product(parent.domain[1] - parent.domain[0], .5), 'subdivision midpoint overflow');
    check(midpoint > parent.domain[0] && midpoint < parent.domain[1], CODE.REPRESENTABILITY, 'strict subdivision midpoint not represented');
    const lower = measure([parent.domain[0], midpoint], parent.depth + 1, parent.originalSpanIndex);
    const upper = measure([midpoint, parent.domain[1]], parent.depth + 1, parent.originalSpanIndex);
    panels.splice(selectedIndex, 1, lower, upper);
    subdivisions.push({ index: subdivisions.length, parent, midpoint, lower, upper,
      evaluationCountAfterSubdivision: evaluationCount, pointEvaluationCountAfterSubdivision: pointEvaluationCount });
    totals = aggregate();
  }
  check(evaluationCount === 7 * panelMeasurementCount && pointEvaluationCount === 2 * panelMeasurementCount,
    CODE.BINDING, 'actual native panel call counts differ from declared work');
  const report: CadCurveArcLengthReport = {
    schema: 'barocss-cad-curve-arc-length', version: 0, reference: selected.reference, documentVersion: 1, sourceVersion: 0,
    lengthUnit: 'mm', sourceFrame: selected.reference.sourceFrame, originalDomain, requestedInterval: settings.interval, interval,
    originalBreaks, initialBreaks, initialPanelCount, finalPanelCount: panels.length,
    panelMeasurementCount, evaluationCount, pointEvaluationCount, guardEvaluationCount: guards.length, subdivisionCount: subdivisions.length,
    guards, subdivisions, estimatedLengthMM: totals.estimatedLengthMM, errorEstimateMM: totals.errorEstimateMM,
    requestedAbsoluteToleranceMM: settings.absoluteToleranceMM, requestedRelativeTolerance: settings.relativeTolerance,
    achievedToleranceMM: totals.achievedToleranceMM, criterion: 'aggregate-panel-estimator-not-certified-upper-bound', criterionSatisfied: true,
    rule: { family: 'own-closed-form-three-and-five-point-gauss-legendre', normalizedNodes, G3Weights, G5Weights,
      sharedCentreEvaluatedOnce: true, derivativeCallsPerPanel: 7, endpointPointCallsPerPanel: 2 },
    geometryAuthority: 'actual-original-source0-curve-and-native-d1', geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    quality: { lengthEstimate: 'five-point-rule-only-no-chord-substitution', estimator: 'maximum-gauss-difference64-epsilon-floor-and-native-chord-shortfall',
      nativeChordSanity: 'ordered-native-point-polyline-heuristic-not-certified-bound', derivativeNodes: 'seven-distinct-strict-interior-native-parameters',
      knotGuards: 'separate-genuine-native-c0-refusals-not-quadrature-samples', discardedParentWorkCounted: true, zeroNativeSpeedSupported: true,
      panelIdentity: 'measurement-order-id-including-discarded-parents-final-array-is-u-order',
      globalErrorCertified: false, globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, g1g2Certified: false,
      ownership: 'copied-cpu-data-gc-no-renderer-resources' }, budgetFailure: 'atomic-refusal-no-partial-result',
    limits: { maximumDegree: 3, maximumCurvePoles: 64, maximumKnots: 70, coordinateAbsMM: 10000, weightRange: [1e-6, 1e6],
      maximumEvaluations: 16384, maximumSubdivisions: 512, maximumDepth: 16, maximumGuards: 64,
      ownedValues: 262144, ownedDepth: 32, arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144,
      optionValues: 32768, optionDepth: 8, optionArrayElements: 128, optionRecordFields: 16, optionStringCharacters: 128 },
  };
  return snapshot({ reference: selected.reference, geometry, source: selected.source, options: settings, estimatedLengthMM: totals.estimatedLengthMM,
    errorEstimateMM: totals.errorEstimateMM, panels, report }, 'owned') as CadCurveArcLengthResult;
}
/** Re-resolve and reproduce all actual native nodes, chord sanity, discarded work and estimator data. */
export function validateCadDocumentCurveArcLength(document: CadDocumentResult, input: CadCurveArcLengthResult): CadCurveArcLengthReport {
  const owned = snapshot(input, 'owned') as CadCurveArcLengthResult;
  record(owned, ['reference', 'geometry', 'source', 'options', 'estimatedLengthMM', 'errorEstimateMM', 'panels', 'report'], CODE.OWNED);
  let expected: CadCurveArcLengthResult;
  try { expected = queryCadDocumentCurveArcLength(document, owned.reference, owned.options); } catch (cause) {
    if (cause instanceof CadCurveArcLengthError && cause.code === 'STALE') throw cause;
    throw new CadCurveArcLengthError(CODE.OWNED, 'owned reference/options complete native quadrature rebuild refused', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'owned original/source/options/panels/nodes/chords/estimator/trace/guards/report mismatch');
  return snapshot(expected.report, 'owned') as CadCurveArcLengthReport;
}
