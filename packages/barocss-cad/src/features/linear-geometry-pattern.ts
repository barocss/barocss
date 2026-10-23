import { transformNativeGeometryAffine, AffineGeometryTransformError } from './affine-geometry-transform.js';
import type { AffineGeometryTransformResult, CadAffineMatrix3x4 } from './affine-geometry-transform.js';
import { validateCurve, validateSurface, curveDomain, surfaceDomain } from '../core/math.js';
import { adopt } from '../intersect/own-plane-cylinder-intersection-internal.js';
import { copyCadData } from '../data-copy.js';
import type { Curve, Surface, Model, Point } from '../types.js';
import { same } from '../core/structural-equality.js';

export const LinearGeometryPatternDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', NATIVE: 'NATIVE',
  REPRESENTABILITY: 'REPRESENTABILITY', BINDING: 'BINDING', OWNED: 'OWNED' } as const);
export type LinearGeometryPatternDiagnosticCode = typeof LinearGeometryPatternDiagnosticCode[keyof typeof LinearGeometryPatternDiagnosticCode];
export class LinearGeometryPatternError extends Error {
  readonly code: LinearGeometryPatternDiagnosticCode; readonly instanceIndex: number | null;
  constructor(code: LinearGeometryPatternDiagnosticCode, detail: string, context: { instanceIndex?: number | null; cause?: unknown } = {}) {
    super(('Native linear geometry pattern: ' + detail).slice(0, 1024), context.cause === undefined ? undefined : { cause: context.cause });
    this.name = 'LinearGeometryPatternError'; this.code = code; this.instanceIndex = context.instanceIndex ?? null;
  }
}
export interface LinearGeometryPatternOptions { patternId: string; idPrefix: string; count: number; spacingMM: Point; maximumCopyObservations: number }
export interface LinearGeometryPatternInstance { index: number; geometryId: string; translationMM: Point; geometry: Curve | Surface; evaluation: AffineGeometryTransformResult | null }
export interface LinearGeometryPatternReport {
  schema: 'barocss-native-linear-geometry-pattern'; version: 0; originalId: string; patternId: string; kind: 'curve' | 'surface'; lengthUnit: 'mm'; sourceFrame: 'authored-xyz-no-axis-conversion';
  count: number; spacingMM: Point; activeGeometryIds: string[]; plannedCopyCount: number; plannedCopyObservations: number; observationsPerCopy: number; childConstructionCount: number;
  domains: { curve: [number, number] | null; u: [number, number] | null; v: [number, number] | null }; samples: { curve: number[]; u: number[]; v: number[] };
  unrepresentedMidpointIntervals: { curve: { domain: [number, number]; attemptedParameter: number }[]; u: { domain: [number, number]; attemptedParameter: number }[]; v: { domain: [number, number]; attemptedParameter: number }[] };
  copyObservationCount: number; originalD0EvaluationCount: number; targetD0EvaluationCount: number; originalD1AttemptCount: number; targetD1AttemptCount: number;
  derivativeComparisonCount: number; derivativeRefusalCount: number; derivativeSourceRefusalCounts: { original: number; target: number };
  maximumPointDifferenceMM: number; maximumRelativeDerivativeDifference: number | null; maximumRelativeCrossDifference: number | null;
  sourceModelObjectCount: number; members: { index: number; geometryId: string; translationMM: Point; observationCount: number; derivativeComparisonCount: number; derivativeRefusalCount: number; handedness: 'preserved' | null }[];
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  quality: { authority: 'actual-public-native-affine-copy-per-member-from-original-seed'; originalSeedBitsPreserved: true; basisWeightsAndParameterBitsPreserved: true;
    preflight: 'all-active-identities-translations-and-complete-copy-observation-budget-before-any-child';
    translationPolicy: 'index-times-authored-raw-xyz-spacing-no-chained-copies'; seedPolicy: 'actual-original-with-null-evaluation-no-phantom-copy-work';
    nativeProofs: 'complete-individual-affine-results-not-first-member-broadcast'; sourceAuthority: 'one-actual-compiled-native-model-seed-then-copies';
    identityMeaning: 'current-recipe-roles-not-persistent-topological-naming-or-graph-revisions';
    workScope: 'summed-actual-affine-child-point-d1-counts-excludes-seed-validation-source-compiler-and-internal-validation';
    assembly: false; booleanUnion: false; circularPattern: false; topologyCertified: false; globalShapeErrorCertified: false; globalBinary64ErrorCertified: false;
    manufacturingToleranceCertified: false; sourceObjectLimitUnchanged: 16; ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-no-partial-native-pattern';
  limits: { maximumInstances: 5; maximumCopies: 4; maximumCurveDegree: 5; maximumCurvePoles: 64; maximumSurfaceAxisPoles: 16; maximumSurfacePoles: 256;
    maximumCurveSamples: 127; maximumSurfaceSamples: 961; maximumCopyObservations: 3844; coordinateAbsMM: 10000; spacingAbsMM: 10000; translationAbsMM: 10000;
    authoredIdCharacters: 48; prefixCharacters: 32; inputValues: 32768; inputDepth: 8; inputArrayElements: 128; inputRecordFields: 16; inputStringCharacters: 128;
    ownValues: 1048576; ownDepth: 40; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144 };
}
export interface LinearGeometryPatternResult { original: Curve | Surface; options: LinearGeometryPatternOptions; instances: LinearGeometryPatternInstance[];
  source: string; sourceVersion: 0; model: Model; report: LinearGeometryPatternReport }

const CODE = LinearGeometryPatternDiagnosticCode;
type Context = { instanceIndex?: number | null; cause?: unknown };
function check(condition: boolean, code: LinearGeometryPatternDiagnosticCode, detail: string, context: Context = {}): asserts condition {
  if (!condition) throw new LinearGeometryPatternError(code, detail, context);
}
function native<T>(action: () => T, detail: string, context: Context = {}, code: LinearGeometryPatternDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof LinearGeometryPatternError) throw cause;
    const childCode = cause instanceof AffineGeometryTransformError && cause.code !== 'MATRIX' ? cause.code : code;
    throw new LinearGeometryPatternError(childCode, detail + ': ' + (cause instanceof Error ? cause.message : 'native operation refused'), { ...context, cause });
  }
}
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT; let remaining = owned ? 1048576 : 32768;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= (owned ? 40 : 8), code, 'own-value/depth budget exceeded');
    if (owned && (value === null || typeof value === 'boolean')) return value;
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
function record(input: unknown, fields: string[], code: LinearGeometryPatternDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'own record required'); const data = input as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'exact fields required: ' + fields.join(',')); return data;
}
function id(value: unknown, maximum = 48): string {
  check(typeof value === 'string' && value.length <= maximum && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'bounded ASCII ID required'); return value;
}
function admit(input: unknown): Curve | Surface {
  const data = input as Record<string, unknown>; check(data && (data.kind === 'curve' || data.kind === 'surface'), CODE.INPUT, 'original native Curve/Surface required');
  const original = record(input, data.kind === 'curve' ? ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']
    : ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']) as unknown as Curve | Surface; id(original.id);
  native(() => original.kind === 'curve' ? validateCurve(original) : validateSurface(original), 'actual original native positive clamped validation', {}, CODE.INPUT);
  const poles = original.kind === 'curve' ? original.controlPoints : original.controlPoints.flat();
  check(poles.every(point => point.every(value => Math.abs(value) <= 10000)), CODE.INPUT, 'original native XYZ within10000mm required');
  const knots = original.kind === 'curve' ? original.knots : [...original.knotsU, ...original.knotsV];
  check(knots.every(value => Math.abs(value) <= 10000), CODE.INPUT, 'original native knots within10000 required');
  if (original.kind === 'curve') check(original.degree >= 1 && original.degree <= 5 && original.controlPoints.length >= 2 && original.controlPoints.length <= 64,
    CODE.INPUT, 'native degree1..5/poles2..64 Curve required');
  else check(original.degreeU >= 1 && original.degreeU <= 5 && original.degreeV >= 1 && original.degreeV <= 5
    && original.controlPoints.length >= 2 && original.controlPoints.length <= 16 && original.controlPoints[0].length >= 2 && original.controlPoints[0].length <= 16
    && poles.length <= 256, CODE.INPUT, 'native degree1..5/axes2..16 Surface required'); return original;
}
type Schedule = { values: number[]; gaps: { domain: [number, number]; attemptedParameter: number }[] };
/** Count and retain the unchanged native knot/midpoint schedule; this performs no native point queries. */
function schedule(knots: number[], degree: number, count: number, maximum: number): Schedule {
  const domain: [number, number] = [knots[degree], knots[count]];
  check(domain[1] > domain[0] && Number.isFinite(domain[1] - domain[0]), CODE.INPUT, 'finite positive original domain required');
  const breaks = [domain[0]];
  for (const knot of knots) if (knot > domain[0] && knot < domain[1] && knot !== breaks[breaks.length - 1]) breaks.push(knot);
  breaks.push(domain[1]); const values: number[] = [], gaps: Schedule['gaps'] = [];
  for (let i = 0; i < breaks.length; i++) {
    values.push(breaks[i]); if (i + 1 === breaks.length) continue;
    const middle = breaks[i] + (breaks[i + 1] - breaks[i]) / 2;
    check(Number.isFinite(middle), CODE.REPRESENTABILITY, 'finite original sample midpoint required');
    if (middle > breaks[i] && middle < breaks[i + 1]) values.push(middle);
    else gaps.push({ domain: [breaks[i], breaks[i + 1]], attemptedParameter: middle });
  }
  check(values.length <= maximum, CODE.BUDGET, 'complete original parameter sample capacity exceeded'); return { values, gaps };
}

/** One atomic native Model containing the seed and direct, independently evaluated affine copies. */
export function buildLinearGeometryPattern(originalInput: Curve | Surface, optionsInput: LinearGeometryPatternOptions): LinearGeometryPatternResult {
  const data = record(snapshot({ original: originalInput, options: optionsInput }), ['original', 'options']);
  const original = admit(data.original), optionData = record(data.options, ['patternId', 'idPrefix', 'count', 'spacingMM', 'maximumCopyObservations']);
  const patternId = id(optionData.patternId), idPrefix = id(optionData.idPrefix, 32);
  check(typeof optionData.count === 'number' && Number.isInteger(optionData.count) && optionData.count >= 1 && optionData.count <= 5, CODE.INPUT, 'total instance count integer1..5 required');
  check(Array.isArray(optionData.spacingMM) && optionData.spacingMM.length === 3 && optionData.spacingMM.every(value => typeof value === 'number'
    && Number.isFinite(value) && Math.abs(value) <= 10000), CODE.INPUT, 'raw XYZ spacing3 within10000mm required');
  const spacingMM = optionData.spacingMM as Point, count = optionData.count;
  check(count === 1 || Math.hypot(...spacingMM) > 0, CODE.INPUT, 'multiple instances require nonzero spacing');
  check(typeof optionData.maximumCopyObservations === 'number' && Number.isInteger(optionData.maximumCopyObservations)
    && optionData.maximumCopyObservations >= 0 && optionData.maximumCopyObservations <= 3844, CODE.BUDGET, 'maximumCopyObservations integer0..3844 required');
  const options: LinearGeometryPatternOptions = { patternId, idPrefix, count, spacingMM, maximumCopyObservations: optionData.maximumCopyObservations };
  const activeGeometryIds = [original.id];
  for (let index = 1; index < count; index++) activeGeometryIds.push(id(idPrefix + '_' + index));
  check(new Set(activeGeometryIds).size === count && !activeGeometryIds.includes(patternId), CODE.IDENTITY, 'all active seed/copy IDs and pattern ID must differ before child construction');
  const plans: { index: number; geometryId: string; translationMM: Point; matrix: CadAffineMatrix3x4 }[] = [];
  for (let index = 1; index < count; index++) {
    const translationMM = spacingMM.map(value => {
      const translated = index * value;
      check(Number.isFinite(translated) && (value === 0 || translated !== 0) && Math.abs(translated) <= 10000, CODE.REPRESENTABILITY,
        'finite represented index-times-spacing translation within10000mm required before any child', { instanceIndex: index }); return translated;
    }) as Point;
    const matrix: CadAffineMatrix3x4 = [1, 0, 0, translationMM[0], 0, 1, 0, translationMM[1], 0, 0, 1, translationMM[2]];
    plans.push({ index, geometryId: activeGeometryIds[index], translationMM, matrix });
  }
  const empty: Schedule = { values: [], gaps: [] };
  const curve = original.kind === 'curve' ? schedule(original.knots, original.degree, original.controlPoints.length, 127) : empty;
  const u = original.kind === 'surface' ? schedule(original.knotsU, original.degreeU, original.controlPoints.length, 31) : empty;
  const v = original.kind === 'surface' ? schedule(original.knotsV, original.degreeV, original.controlPoints[0].length, 31) : empty;
  const observationsPerCopy = original.kind === 'curve' ? curve.values.length : u.values.length * v.values.length;
  const plannedCopyCount = count - 1, plannedCopyObservations = plannedCopyCount * observationsPerCopy;
  check(observationsPerCopy <= 961 && plannedCopyObservations <= 3844 && plannedCopyObservations <= options.maximumCopyObservations,
    CODE.BUDGET, 'all complete original copy observations must fit caller budget before any child');
  const samples = { curve: curve.values, u: u.values, v: v.values }, unrepresentedMidpointIntervals = { curve: curve.gaps, u: u.gaps, v: v.gaps };
  const domains: LinearGeometryPatternReport['domains'] = { curve: original.kind === 'curve' ? curveDomain(original) : null,
    u: original.kind === 'surface' ? surfaceDomain(original).u : null, v: original.kind === 'surface' ? surfaceDomain(original).v : null };
  const instances: LinearGeometryPatternInstance[] = [{ index: 0, geometryId: original.id, translationMM: [0, 0, 0], geometry: original, evaluation: null }];
  let copyObservationCount = 0, originalD0EvaluationCount = 0, targetD0EvaluationCount = 0, originalD1AttemptCount = 0, targetD1AttemptCount = 0;
  let derivativeComparisonCount = 0, derivativeRefusalCount = 0, originalRefusals = 0, targetRefusals = 0, maximumPointDifferenceMM = 0;
  let maximumRelativeDerivativeDifference: number | null = null, maximumRelativeCrossDifference: number | null = null;
  const members: LinearGeometryPatternReport['members'] = [{ index: 0, geometryId: original.id, translationMM: [0, 0, 0], observationCount: 0,
    derivativeComparisonCount: 0, derivativeRefusalCount: 0, handedness: null }];
  for (const plan of plans) {
    const evaluation = native(() => transformNativeGeometryAffine(original, plan.matrix, { geometryId: plan.geometryId, maximumObservations: observationsPerCopy }),
      'actual public affine copy refused', { instanceIndex: plan.index });
    const report = evaluation.report, geometry = evaluation.geometry;
    check(same(evaluation.original, original) && same(evaluation.matrix, plan.matrix)
      && same(evaluation.options, { geometryId: plan.geometryId, maximumObservations: observationsPerCopy })
      && same({ ...original, id: plan.geometryId, controlPoints: geometry.controlPoints }, geometry)
      && report.originalId === original.id && report.geometryId === plan.geometryId && report.handedness === 'preserved'
      && report.observationCount === observationsPerCopy && same(report.samples, samples) && same(report.domains, domains)
      && same(report.unrepresentedMidpointIntervals, unrepresentedMidpointIntervals), CODE.BINDING,
    'actual individual affine proof must retain original seed basis/weights/parameters and planned roles', { instanceIndex: plan.index });
    instances.push({ index: plan.index, geometryId: plan.geometryId, translationMM: plan.translationMM, geometry, evaluation });
    copyObservationCount += report.observationCount; originalD0EvaluationCount += report.originalD0EvaluationCount; targetD0EvaluationCount += report.targetD0EvaluationCount;
    originalD1AttemptCount += report.originalD1AttemptCount; targetD1AttemptCount += report.targetD1AttemptCount;
    derivativeComparisonCount += report.derivativeComparisonCount; derivativeRefusalCount += report.derivativeRefusalCount;
    originalRefusals += report.derivativeSourceRefusalCounts.original; targetRefusals += report.derivativeSourceRefusalCounts.target;
    maximumPointDifferenceMM = Math.max(maximumPointDifferenceMM, report.maximumPointDifferenceMM);
    if (report.maximumRelativeDerivativeDifference !== null) maximumRelativeDerivativeDifference = Math.max(maximumRelativeDerivativeDifference ?? 0, report.maximumRelativeDerivativeDifference);
    if (report.maximumRelativeCrossDifference !== null) maximumRelativeCrossDifference = Math.max(maximumRelativeCrossDifference ?? 0, report.maximumRelativeCrossDifference);
    members.push({ index: plan.index, geometryId: plan.geometryId, translationMM: plan.translationMM, observationCount: report.observationCount,
      derivativeComparisonCount: report.derivativeComparisonCount, derivativeRefusalCount: report.derivativeRefusalCount, handedness: 'preserved' });
  }
  check(instances.length === count && copyObservationCount === plannedCopyObservations && plans.length === plannedCopyCount,
    CODE.BINDING, 'complete actual native copies and planned aggregate observations required');
  const expectedModel: Model = { name: patternId, version: 0, lengthUnit: 'mm', objects: instances.map(instance => instance.geometry) };
  const adopted = native(() => adopt(expectedModel), 'actual all-member native Source0 serialization/compile binding');
  check(adopted.source.length <= 262144, CODE.BUDGET, 'all-member native source string budget exceeded');
  check(same(adopted.model, expectedModel), CODE.BINDING, 'all-member compiled Model must retain order/identity/all coefficient bits');
  const report: LinearGeometryPatternReport = {
    schema: 'barocss-native-linear-geometry-pattern', version: 0, originalId: original.id, patternId, kind: original.kind, lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion',
    count, spacingMM, activeGeometryIds, plannedCopyCount, plannedCopyObservations, observationsPerCopy, childConstructionCount: plans.length, domains, samples, unrepresentedMidpointIntervals,
    copyObservationCount, originalD0EvaluationCount, targetD0EvaluationCount, originalD1AttemptCount, targetD1AttemptCount, derivativeComparisonCount, derivativeRefusalCount,
    derivativeSourceRefusalCounts: { original: originalRefusals, target: targetRefusals }, maximumPointDifferenceMM, maximumRelativeDerivativeDifference, maximumRelativeCrossDifference,
    sourceModelObjectCount: adopted.model.objects.length, members, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    quality: { authority: 'actual-public-native-affine-copy-per-member-from-original-seed', originalSeedBitsPreserved: true, basisWeightsAndParameterBitsPreserved: true,
      preflight: 'all-active-identities-translations-and-complete-copy-observation-budget-before-any-child', translationPolicy: 'index-times-authored-raw-xyz-spacing-no-chained-copies',
      seedPolicy: 'actual-original-with-null-evaluation-no-phantom-copy-work', nativeProofs: 'complete-individual-affine-results-not-first-member-broadcast',
      sourceAuthority: 'one-actual-compiled-native-model-seed-then-copies', identityMeaning: 'current-recipe-roles-not-persistent-topological-naming-or-graph-revisions',
      workScope: 'summed-actual-affine-child-point-d1-counts-excludes-seed-validation-source-compiler-and-internal-validation', assembly: false, booleanUnion: false,
      circularPattern: false, topologyCertified: false, globalShapeErrorCertified: false, globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false,
      sourceObjectLimitUnchanged: 16, ownership: 'copied-cpu-data-gc-no-renderer-resources' }, budgetFailure: 'atomic-refusal-no-partial-native-pattern',
    limits: { maximumInstances: 5, maximumCopies: 4, maximumCurveDegree: 5, maximumCurvePoles: 64, maximumSurfaceAxisPoles: 16, maximumSurfacePoles: 256,
      maximumCurveSamples: 127, maximumSurfaceSamples: 961, maximumCopyObservations: 3844, coordinateAbsMM: 10000, spacingAbsMM: 10000, translationAbsMM: 10000,
      authoredIdCharacters: 48, prefixCharacters: 32, inputValues: 32768, inputDepth: 8, inputArrayElements: 128, inputRecordFields: 16, inputStringCharacters: 128,
      ownValues: 1048576, ownDepth: 40, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144 }
  };
  return snapshot({ original, options, instances, source: adopted.source, sourceVersion: 0, model: adopted.model, report }, true) as LinearGeometryPatternResult;
}

/** Rebuild the complete recipe and all actual affine/source proofs from safely copied owned inputs. */
export function validateLinearGeometryPattern(input: LinearGeometryPatternResult): LinearGeometryPatternReport {
  const data = record(snapshot(input, true), ['original', 'options', 'instances', 'source', 'sourceVersion', 'model', 'report'], CODE.OWNED);
  let rebuilt: LinearGeometryPatternResult;
  try { rebuilt = buildLinearGeometryPattern(data.original as Curve | Surface, data.options as LinearGeometryPatternOptions); }
  catch (cause) { throw new LinearGeometryPatternError(CODE.OWNED, 'owned native pattern rebuild refused', { cause,
    instanceIndex: cause instanceof LinearGeometryPatternError ? cause.instanceIndex : null }); }
  check(same(data, rebuilt), CODE.OWNED, 'whole owned native pattern differs from actual rebuild'); return copyCadData(rebuilt.report);
}
