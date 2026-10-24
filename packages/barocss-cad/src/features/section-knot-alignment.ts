import { validateCurve, curveDomain } from '../core/math.js';
import { refineCurveWide } from '../nurbs/source-wide/curve-wide-refinement.js';
import type { WideCurveInsertionRequest, WideCurveRefinementResult, WideCurveRefinementReport } from '../nurbs/source-wide/curve-wide-refinement.js';
import { buildRationalRuledSurface } from '../nurbs/surfaces/rational-ruled-surface.js';
import type { RationalRuledSurfaceResult, RationalRuledSurfaceReport } from '../nurbs/surfaces/rational-ruled-surface.js';
import { adopt } from '../intersect/own-plane-cylinder-intersection-internal.js';
import { copyCadData } from '../data-copy.js';
import type { Curve, Model } from '../types.js';
import { same } from '../core/structural-equality.js';
import { KernelError } from '../core/barocss-error.js';

export const SectionKnotAlignmentDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', BASIS: 'BASIS', BUDGET: 'BUDGET', NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
} as const);
export type SectionKnotAlignmentDiagnosticCode = typeof SectionKnotAlignmentDiagnosticCode[keyof typeof SectionKnotAlignmentDiagnosticCode];
export class SectionKnotAlignmentError extends KernelError {
  readonly code: SectionKnotAlignmentDiagnosticCode;
  constructor(code: SectionKnotAlignmentDiagnosticCode, detail: string, cause?: unknown) {
    super(('Section knot alignment: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'SectionKnotAlignmentError'; this.code = code;
  }
}
export interface SectionKnotAlignmentOptions {
  surfaceId: string; firstAlignedId: string; secondAlignedId: string; resultIdPrefix: string;
  maximumInsertedKnots: number; maximumRefinementOperations: number;
}
export interface SectionKnotAlignmentSection { index: number; originalId: string; curve: Curve; refinement: WideCurveRefinementResult | null }
type Multiplicity = { value: number; firstMultiplicity: number; secondMultiplicity: number; targetMultiplicity: number; firstDeficit: number; secondDeficit: number };
type SectionWork = { index: number; refinementCallCount: 0 | 1; operationCount: number; insertionCount: number;
  originalPoleCount: number; alignedPoleCount: number; originalKnotCount: number; alignedKnotCount: number };
export interface SectionKnotAlignmentReport {
  schema: 'barocss-native-section-knot-alignment'; version: 0; lengthUnit: 'mm'; sourceFrame: 'authored-xyz-no-axis-conversion';
  parameterFrame: 'common-original-u-and-native-rational-v'; surfaceId: string; originalIds: [string, string]; activeIds: [string, string]; originalModelId: string;
  degree: number; originalDomains: [[number, number], [number, number]]; commonDomain: [number, number]; commonKnots: number[]; targetPoleCount: number;
  multiplicities: Multiplicity[]; requestPlan: [WideCurveInsertionRequest[], WideCurveInsertionRequest[]]; sectionModes: ['refined' | 'untouched', 'refined' | 'untouched'];
  refinementCallCount: number; refinementOperationCount: number; insertedKnotCount: number; ruledCallCount: 1; sectionWork: [SectionWork, SectionWork];
  sourceOwnership: 'separate-original-pair-two-object-refinement-one-object-ruled-three-object-source0-models';
  sourceIds: { originalPair: string; refinementOriginalContexts: [string | null, string | null]; refinementFinalContexts: [string | null, string | null];
    refinementStageContexts: [string[], string[]]; ruledContext: string };
  inheritedObservations: { refinementReports: [WideCurveRefinementReport | null, WideCurveRefinementReport | null]; ruledReport: RationalRuledSurfaceReport };
  numericPolicy: { basis: 'object-is-knot-bits-with-numeric-sorted-max-multiplicity-union'; signedZero: 'numeric-equality-with-bit-disagreement-refuses';
    parameters: 'identity-original-domain-no-remapping'; untouched: 'original-id-and-coefficients-zero-refinement-work';
    weightInterpolation: 'actual630-denominator-weighted-independent-section-weights'; derivatives: 'actual-original-aligned-and-surface-states-no-invented-original-c0';
    endpointPolicy: 'all-original-clamp-slot-bits-must-agree'; pointComparisonMM: 1e-7; relativeD1Comparison: 1e-7 };
  profile: { maximumSectionDegree: 3; maximumOriginalPoles: 16; maximumAlignedPoles: 16; maximumAlignedKnots: 20;
    maximumSurfacePoles: 32; coordinateAbsMM: 10000; positiveWeights: [0.000001, 1000000]; degreeSpecificMaximumInsertedKnots: number };
  quality: { constructionOnly: true; globalShapeErrorCertified: false; globalBinary64ErrorCertified: false; continuityCertified: false;
    solidCertified: false; manufacturingToleranceCertified: false; weightRepairSupported: false; ownership: 'independent-copied-cpu-data-gc' };
  budgetFailure: 'complete-preflight-and-atomic-no-partial-surface';
  limits: { maximumInsertedKnots: 14; maximumRefinementOperations: 14; maximumRequestsPerSection: 16; reservedStageIdsPerSection: 16;
    ownedValues: 1048576; ownedDepth: 64; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144 };
}
export interface SectionKnotAlignmentResult {
  originals: [Curve, Curve]; options: SectionKnotAlignmentOptions; sections: [SectionKnotAlignmentSection, SectionKnotAlignmentSection];
  ruled: RationalRuledSurfaceResult; originalSource: string; originalModel: Model; report: SectionKnotAlignmentReport;
}

const CODE = SectionKnotAlignmentDiagnosticCode;
function check(condition: boolean, code: SectionKnotAlignmentDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new SectionKnotAlignmentError(code, detail);
}
function native<T>(action: () => T, detail: string): T {
  try { return action(); } catch (cause) { throw new SectionKnotAlignmentError(CODE.NATIVE, detail, cause); }
}
function snapshot(input: unknown, code: SectionKnotAlignmentDiagnosticCode): unknown {
  let remaining = 1048576; const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 64, code, 'Own value or depth limit exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'Finite own numbers are required'); return value; }
    if (typeof value === 'string') { check(value.length <= 262144, code, 'Own source string limit exceeded'); return value; }
    check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic plain own data is required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Plain own-data prototypes are required');
    check(keys.length <= (array ? 8193 : 64), code, 'Own field limit exceeded');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'Getter, symbol, or hidden fields are refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 8192 && keys.length === length + 1, code, 'Dense bounded own arrays are required');
      result = Array.from({ length }, (_, index) => {
        check(Object.hasOwn(descriptors, String(index)), code, 'Sparse or extra own array fields are refused'); return copy(descriptors[String(index)].value, depth + 1);
      });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  };
  try { return copy(input, 0); } catch (cause) {
    if (cause instanceof SectionKnotAlignmentError) throw cause;
    throw new SectionKnotAlignmentError(code, 'Own-data snapshot failed', cause);
  }
}
function record(value: unknown, fields: string[], code: SectionKnotAlignmentDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'An own record is required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required'); return data;
}
function id(value: unknown, maximum = 48): string {
  check(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'A bounded ASCII identifier is required'); return value;
}
function admitCurve(input: unknown): Curve {
  const data = record(snapshot(input, CODE.INPUT), ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']);
  id(data.id);
  check(data.kind === 'curve' && typeof data.degree === 'number' && Number.isInteger(data.degree) && data.degree >= 1 && data.degree <= 3,
    CODE.INPUT, 'A native degree1..3 section is required');
  check(Array.isArray(data.controlPoints) && data.controlPoints.length >= data.degree + 1 && data.controlPoints.length <= 16
    && data.controlPoints.every(point => Array.isArray(point) && point.length === 3 && point.every(value => typeof value === 'number' && Math.abs(value) <= 10000)),
    CODE.INPUT, 'Original section poles must retain degree+1..16 count and XYZ within10000 mm');
  const curve = data as unknown as Curve;
  native(() => validateCurve(curve), 'Actual native section validation failed'); return curve;
}

/** Align only missing original knot multiplicities, then construct the actual independently weighted ruled Surface. */
export function buildAlignedRationalRuledSurface(firstInput: Curve, secondInput: Curve, optionsInput: SectionKnotAlignmentOptions): SectionKnotAlignmentResult {
  const originals: [Curve, Curve] = [admitCurve(firstInput), admitCurve(secondInput)];
  const data = record(snapshot(optionsInput, CODE.INPUT), ['surfaceId', 'firstAlignedId', 'secondAlignedId', 'resultIdPrefix', 'maximumInsertedKnots', 'maximumRefinementOperations']);
  const surfaceId = id(data.surfaceId), firstAlignedId = id(data.firstAlignedId), secondAlignedId = id(data.secondAlignedId), resultIdPrefix = id(data.resultIdPrefix, 8);
  for (const field of ['maximumInsertedKnots', 'maximumRefinementOperations'] as const)
    check(typeof data[field] === 'number' && Number.isInteger(data[field]) && data[field] >= 0 && data[field] <= 14, CODE.BUDGET, 'Complete both-section budgets must be integers in0..14');
  const options: SectionKnotAlignmentOptions = { surfaceId, firstAlignedId, secondAlignedId, resultIdPrefix,
    maximumInsertedKnots: data.maximumInsertedKnots as number, maximumRefinementOperations: data.maximumRefinementOperations as number };
  const [first, second] = originals;
  check(first.id !== second.id, CODE.IDENTITY, 'Original section IDs must be distinct');
  check(first.degree === second.degree, CODE.BASIS, 'Original section degrees must be equal');
  const degree = first.degree, originalDomains: [[number, number], [number, number]] = [curveDomain(first), curveDomain(second)];
  check(same(originalDomains[0], originalDomains[1]), CODE.BASIS, 'Original domain endpoint bits must agree');
  const commonDomain = originalDomains[0], span = commonDomain[1] - commonDomain[0];
  check(Number.isFinite(span) && span > 0, CODE.BASIS, 'A positive represented finite original common domain is required');
  for (let index = 0; index <= degree; index++) {
    check(Object.is(first.knots[index], second.knots[index])
      && Object.is(first.knots[first.controlPoints.length + index], second.knots[second.controlPoints.length + index]),
    CODE.BASIS, 'Every original endpoint clamp slot must retain matching bits');
  }
  // Numeric equality groups values, but every original occurrence must also agree bitwise.
  // Do not let Map/Set SameValueZero silently merge negative and positive zero.
  const values: { value: number; counts: [number, number] }[] = [];
  for (const [sectionIndex, curve] of originals.entries()) for (const knot of curve.knots) {
    const entry = values.find(value => value.value === knot);
    if (entry) { check(Object.is(entry.value, knot), CODE.BASIS, 'Numerically equal original knots have ambiguous signed-zero bits'); entry.counts[sectionIndex]++; }
    else { const counts: [number, number] = [0, 0]; counts[sectionIndex] = 1; values.push({ value: knot, counts }); }
  }
  values.sort((a, b) => a.value < b.value ? -1 : a.value > b.value ? 1 : 0);
  const multiplicities: Multiplicity[] = values.filter(value => value.value > commonDomain[0] && value.value < commonDomain[1]).map(entry => {
    const targetMultiplicity = Math.max(...entry.counts);
    check(targetMultiplicity <= degree, CODE.BASIS, 'Common interior knot multiplicity must not exceed section degree');
    return { value: entry.value, firstMultiplicity: entry.counts[0], secondMultiplicity: entry.counts[1], targetMultiplicity,
      firstDeficit: targetMultiplicity - entry.counts[0], secondDeficit: targetMultiplicity - entry.counts[1] };
  });
  const commonKnots = [...first.knots.slice(0, degree + 1),
    ...multiplicities.flatMap(entry => Array<number>(entry.targetMultiplicity).fill(entry.value)), ...first.knots.slice(first.controlPoints.length)];
  const targetPoleCount = commonKnots.length - degree - 1;
  check(targetPoleCount <= 16 && commonKnots.length <= 20, CODE.BUDGET, 'Complete common basis exceeds actual630 Surface16-row/20-knot capacity');
  const requestPlan: [WideCurveInsertionRequest[], WideCurveInsertionRequest[]] = [
    multiplicities.filter(entry => entry.firstDeficit > 0).map(entry => ({ parameter: entry.value, count: entry.firstDeficit })),
    multiplicities.filter(entry => entry.secondDeficit > 0).map(entry => ({ parameter: entry.value, count: entry.secondDeficit })),
  ];
  const plannedInsertions = requestPlan.reduce((total, requests) => total + requests.reduce((count, request) => count + request.count, 0), 0);
  const plannedOperations = requestPlan.reduce((total, requests) => total + requests.length, 0);
  check(plannedInsertions <= 15 - degree && plannedInsertions <= options.maximumInsertedKnots && plannedOperations <= options.maximumRefinementOperations,
    CODE.BUDGET, 'Complete actual both-section insertion or request-operation budget is insufficient');
  const activeIds: [string, string] = [firstAlignedId, secondAlignedId], prefixes: [string, string] = [resultIdPrefix + '_a', resultIdPrefix + '_b'];
  const sectionModes: SectionKnotAlignmentReport['sectionModes'] = [requestPlan[0].length ? 'refined' : 'untouched', requestPlan[1].length ? 'refined' : 'untouched'];
  for (const [index, requests] of requestPlan.entries()) {
    check(requests.length <= 16, CODE.BUDGET, 'Actual686 request count exceeds16');
    check(requests.length > 0 ? activeIds[index] !== first.id && activeIds[index] !== second.id : activeIds[index] === originals[index].id,
      CODE.IDENTITY, 'Changed sections need distinct explicit output IDs; untouched sections must retain their original IDs');
    const planned = copyCadData(originals[index].knots);
    for (const request of requests) {
      let position = -1; for (let slot = 0; slot < planned.length; slot++) if (planned[slot] <= request.parameter) position = slot;
      planned.splice(position + 1, 0, ...Array<number>(request.count).fill(request.parameter));
    }
    check(same(planned, commonKnots) && originals[index].controlPoints.length + requests.reduce((count, request) => count + request.count, 0) === targetPoleCount,
      CODE.BASIS, 'Both full planned output knot vectors and pole counts must agree with the frozen common basis');
  }
  const originalModelId = id(resultIdPrefix + '_original');
  const roles = [first.id, second.id, surfaceId, originalModelId, ...prefixes,
    ...requestPlan.flatMap((requests, index) => requests.length ? [activeIds[index]] : []),
    ...prefixes.flatMap(prefix => Array.from({ length: 16 }, (_, index) => id(prefix + '_step_' + index)))];
  // The two unchanged686 original source models intentionally share their fixed native context name.
  roles.push('curve_wide_original');
  check(new Set(roles).size === roles.length && activeIds[0] !== activeIds[1] && surfaceId !== activeIds[0] && surfaceId !== activeIds[1],
    CODE.IDENTITY, 'All original, active, Surface, source, refinement context and sixteen-stage roles must be distinct before child work');
  const originalExpected: Model = { name: originalModelId, version: 0, lengthUnit: 'mm', objects: originals };
  const originalFile = native(() => adopt(originalExpected), 'Actual original two-section Source0 adoption failed');
  check(originalFile.source.length <= 262144 && same(originalFile.model, originalExpected), CODE.BINDING, 'Actual original pair source must preserve full order, IDs, coefficients and sign bits');
  const refinements: [WideCurveRefinementResult | null, WideCurveRefinementResult | null] = [null, null];
  const aligned: [Curve, Curve] = [copyCadData(first), copyCadData(second)];
  const sectionWork: [SectionWork, SectionWork] = [0, 1].map(index => {
    const requests = requestPlan[index], original = originals[index];
    let operationCount = 0, insertionCount = 0;
    if (requests.length > 0) {
      const refinement = native(() => refineCurveWide(original, { curveId: activeIds[index], insertions: requests, resultIdPrefix: prefixes[index] }),
        'Actual686 refinement failed for section ' + index);
      refinements[index] = refinement; aligned[index] = refinement.curve;
      operationCount = refinement.provenance.operations.length;
      insertionCount = refinement.curve.knots.length - original.knots.length;
      check(same(refinement.original, original) && same(refinement.options.insertions, requests) && same(refinement.options.curveId, activeIds[index])
        && operationCount === requests.length && operationCount === refinement.report.operationCount
        && insertionCount === refinement.report.insertionCount && insertionCount === refinement.curve.controlPoints.length - original.controlPoints.length,
      CODE.BINDING, 'Actual686 original geometry, request plan, IDs or work counts changed');
    }
    check(aligned[index].id === activeIds[index] && aligned[index].degree === degree && aligned[index].controlPoints.length === targetPoleCount
      && same(aligned[index].knots, commonKnots) && same(curveDomain(aligned[index]), commonDomain), CODE.BINDING, 'Actual aligned section does not retain the frozen common basis and original domain');
    if (requests.length === 0) check(same(aligned[index], original), CODE.BINDING, 'Untouched section changed its original ID or coefficient bits');
    return { index, refinementCallCount: requests.length ? 1 : 0, operationCount, insertionCount,
      originalPoleCount: original.controlPoints.length, alignedPoleCount: aligned[index].controlPoints.length,
      originalKnotCount: original.knots.length, alignedKnotCount: aligned[index].knots.length };
  }) as [SectionWork, SectionWork];
  const refinementCallCount = sectionWork.reduce((total, work) => total + work.refinementCallCount, 0);
  const refinementOperationCount = sectionWork.reduce((total, work) => total + work.operationCount, 0);
  const insertedKnotCount = sectionWork.reduce((total, work) => total + work.insertionCount, 0);
  check(refinementOperationCount === plannedOperations && insertedKnotCount === plannedInsertions, CODE.BINDING, 'Actual both-section refinement work differs from admitted full plan');
  const ruled = native(() => buildRationalRuledSurface(aligned[0], aligned[1], { surfaceId }), 'Actual630 rational ruled Surface construction failed');
  check(same(ruled.first, aligned[0]) && same(ruled.second, aligned[1]) && ruled.surface.id === surfaceId
    && ruled.surface.degreeU === degree && ruled.surface.degreeV === 1 && same(ruled.surface.knotsU, commonKnots)
    && same(ruled.surface.knotsV, [0, 0, 1, 1]) && ruled.surface.controlPoints.length === targetPoleCount
    && ruled.surface.controlPoints.every((row, index) => same(row, [aligned[0].controlPoints[index], aligned[1].controlPoints[index]]))
    && ruled.surface.weights.every((row, index) => same(row, [aligned[0].weights[index], aligned[1].weights[index]]))
    && ruled.model.objects.length === 3 && same(ruled.model.objects, [ruled.first, ruled.second, ruled.surface]),
  CODE.BINDING, 'Actual630 section adoption, Surface basis, row capacity or three-object Model changed');
  const sections: [SectionKnotAlignmentSection, SectionKnotAlignmentSection] = [
    { index: 0, originalId: first.id, curve: ruled.first, refinement: refinements[0] },
    { index: 1, originalId: second.id, curve: ruled.second, refinement: refinements[1] },
  ];
  const report: SectionKnotAlignmentReport = { schema: 'barocss-native-section-knot-alignment', version: 0, lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion',
    parameterFrame: 'common-original-u-and-native-rational-v', surfaceId, originalIds: [first.id, second.id], activeIds, originalModelId, degree, originalDomains,
    commonDomain, commonKnots, targetPoleCount, multiplicities, requestPlan, sectionModes, refinementCallCount, refinementOperationCount, insertedKnotCount, ruledCallCount: 1, sectionWork,
    sourceOwnership: 'separate-original-pair-two-object-refinement-one-object-ruled-three-object-source0-models',
    sourceIds: { originalPair: originalFile.model.name, refinementOriginalContexts: [refinements[0]?.originalModel.name ?? null, refinements[1]?.originalModel.name ?? null],
      refinementFinalContexts: [refinements[0]?.model.name ?? null, refinements[1]?.model.name ?? null],
      refinementStageContexts: [refinements[0]?.provenance.operations.map(operation => operation.model.name) ?? [], refinements[1]?.provenance.operations.map(operation => operation.model.name) ?? []],
      ruledContext: ruled.model.name },
    inheritedObservations: { refinementReports: [refinements[0]?.report ?? null, refinements[1]?.report ?? null], ruledReport: ruled.report },
    numericPolicy: { basis: 'object-is-knot-bits-with-numeric-sorted-max-multiplicity-union', signedZero: 'numeric-equality-with-bit-disagreement-refuses',
      parameters: 'identity-original-domain-no-remapping', untouched: 'original-id-and-coefficients-zero-refinement-work',
      weightInterpolation: 'actual630-denominator-weighted-independent-section-weights', derivatives: 'actual-original-aligned-and-surface-states-no-invented-original-c0',
      endpointPolicy: 'all-original-clamp-slot-bits-must-agree', pointComparisonMM: 1e-7, relativeD1Comparison: 1e-7 },
    profile: { maximumSectionDegree: 3, maximumOriginalPoles: 16, maximumAlignedPoles: 16, maximumAlignedKnots: 20, maximumSurfacePoles: 32,
      coordinateAbsMM: 10000, positiveWeights: [1e-6, 1e6], degreeSpecificMaximumInsertedKnots: 15 - degree },
    quality: { constructionOnly: true, globalShapeErrorCertified: false, globalBinary64ErrorCertified: false, continuityCertified: false,
      solidCertified: false, manufacturingToleranceCertified: false, weightRepairSupported: false, ownership: 'independent-copied-cpu-data-gc' },
    budgetFailure: 'complete-preflight-and-atomic-no-partial-surface',
    limits: { maximumInsertedKnots: 14, maximumRefinementOperations: 14, maximumRequestsPerSection: 16, reservedStageIdsPerSection: 16,
      ownedValues: 1048576, ownedDepth: 64, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144 } };
  return snapshot({ originals, options, sections, ruled, originalSource: originalFile.source, originalModel: originalFile.model, report }, CODE.BUDGET) as SectionKnotAlignmentResult;
}

/** Rebuild the complete actual alignment operation and bit-check all owned child sources and work evidence. */
export function validateAlignedRationalRuledSurface(input: SectionKnotAlignmentResult): SectionKnotAlignmentReport {
  const owned = record(snapshot(input, CODE.OWNED), ['originals', 'options', 'sections', 'ruled', 'originalSource', 'originalModel', 'report'], CODE.OWNED) as unknown as SectionKnotAlignmentResult;
  check(Array.isArray(owned.originals) && owned.originals.length === 2, CODE.OWNED, 'Exactly two owned originals are required');
  let expected: SectionKnotAlignmentResult;
  try { expected = buildAlignedRationalRuledSurface(owned.originals[0], owned.originals[1], owned.options); } catch (cause) {
    throw new SectionKnotAlignmentError(CODE.OWNED, 'Whole owned section alignment rebuild failed', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'Owned original, refinement, ruled Surface, source, knot plan, status or counter bits changed');
  return copyCadData(expected.report);
}
