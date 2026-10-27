import { transformNativeGeometryAffine, AffineGeometryTransformError } from './affine-geometry-transform.js';
import type { AffineGeometryTransformResult, CadAffineMatrix3x4 } from './affine-geometry-transform.js';
import { validateCurve, validateSurface, curveDomain, surfaceDomain } from '../core/math.js';
import { adopt } from '../intersect/own-plane-cylinder-intersection-internal.js';
import { copyCadData } from '../data-copy.js';
import type { Curve, Surface, Model, Point } from '../types.js';
import { same } from '../core/structural-equality.js';
import { KernelError } from '../core/barocss-error.js';

export const CircularGeometryPatternDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', NATIVE: 'NATIVE',
  REPRESENTABILITY: 'REPRESENTABILITY', BINDING: 'BINDING', OWNED: 'OWNED' } as const);
export type CircularGeometryPatternDiagnosticCode = typeof CircularGeometryPatternDiagnosticCode[keyof typeof CircularGeometryPatternDiagnosticCode];
export class CircularGeometryPatternError extends KernelError {
  readonly code: CircularGeometryPatternDiagnosticCode; readonly instanceIndex: number | null;
  constructor(code: CircularGeometryPatternDiagnosticCode, detail: string, context: { instanceIndex?: number | null; cause?: unknown } = {}) {
    super(('Native circular geometry pattern: ' + detail).slice(0, 1024), context.cause === undefined ? undefined : { cause: context.cause });
    this.name = 'CircularGeometryPatternError'; this.code = code; this.instanceIndex = context.instanceIndex ?? null;
  }
}
export interface CircularGeometryPatternOptions { patternId: string; idPrefix: string; count: number; axisOriginMM: Point; axisDirection: Point; angleStepDegrees: number; maximumCopyObservations: number }
export interface CircularGeometryPatternInstance { index: number; geometryId: string; angleDegrees: number; matrix: CadAffineMatrix3x4; geometry: Curve | Surface; evaluation: AffineGeometryTransformResult | null }
export interface CircularGeometryPatternReport {
  schema: 'barocss-native-circular-geometry-pattern'; version: 0; originalId: string; patternId: string; kind: 'curve' | 'surface'; lengthUnit: 'mm'; sourceFrame: 'authored-xyz-no-axis-conversion';
  count: number; axisOriginMM: Point; axisDirection: Point; axisNorm: number; normalizedAxis: Point; normalizationResidual: number; angleStepDegrees: number;
  activeGeometryIds: string[]; anglesDegrees: number[]; matrices: CadAffineMatrix3x4[];
  rotations: { index: number; angleDegrees: number; radians: number; sine: number; cosine: number; oneMinusCosine: number;
    trigonometry: 'exact-integral-quarter-turn-table' | 'native-sin-cos-stable-half-angle'; matrix: CadAffineMatrix3x4;
    determinant: number; orthogonalityResidual: number; determinantResidual: number; axisResidual: number; anchorResidual: number }[];
  plannedCopyCount: number; plannedCopyObservations: number; observationsPerCopy: number; childConstructionCount: number;
  domains: { curve: [number, number] | null; u: [number, number] | null; v: [number, number] | null }; samples: { curve: number[]; u: number[]; v: number[] };
  unrepresentedMidpointIntervals: { curve: { domain: [number, number]; attemptedParameter: number }[]; u: { domain: [number, number]; attemptedParameter: number }[]; v: { domain: [number, number]; attemptedParameter: number }[] };
  copyObservationCount: number; originalD0EvaluationCount: number; targetD0EvaluationCount: number; originalD1AttemptCount: number; targetD1AttemptCount: number;
  derivativeComparisonCount: number; derivativeRefusalCount: number; derivativeSourceRefusalCounts: { original: number; target: number };
  maximumPointDifferenceMM: number; maximumRelativeDerivativeDifference: number | null; maximumRelativeCrossDifference: number | null;
  sourceModelObjectCount: number; members: { index: number; geometryId: string; angleDegrees: number; observationCount: number; derivativeComparisonCount: number; derivativeRefusalCount: number; handedness: 'preserved' | null }[];
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  quality: { authority: 'actual-public-native-affine-copy-per-member-from-original-seed'; originalSeedBitsPreserved: true; basisWeightsAndParameterBitsPreserved: true;
    preflight: 'all-active-identities-angles-rodrigues-matrices-residuals-and-complete-copy-observation-budget-before-any-child';
    rotationPolicy: 'normalized-authored-axis-right-hand-rodrigues-no-modulo-or-angle-snapping';
    trigonometryPolicy: 'exact-integral-quarter-turn-table-otherwise-native-sin-cos-and-two-sin-half-angle-squared';
    residualScales: { orthogonality: 'max-absolute-rt-r-minus-identity'; determinant: 'absolute-det-minus-one'; axis: 'euclidean-r-axis-minus-axis';
      anchor: 'euclidean-r-c-plus-t-minus-c-over-max-one-c-r-c-t-norms' };
    seedPolicy: 'actual-original-identity-matrix-null-evaluation-no-phantom-copy-work'; nativeProofs: 'complete-individual-affine-results-not-first-member-broadcast';
    sourceAuthority: 'one-actual-compiled-native-model-seed-then-copies'; identityMeaning: 'current-recipe-roles-not-persistent-topological-naming-or-graph-revisions';
    workScope: 'per-copy-matrix-preflight-and-summed-actual-affine-child-point-d1-counts-excludes-seed-validation-source-compiler-and-internal-validation';
    assembly: false; booleanUnion: false; topologyCertified: false; globalMetricPreservationCertified: false; globalShapeErrorCertified: false; globalBinary64ErrorCertified: false;
    manufacturingToleranceCertified: false; sourceObjectLimitUnchanged: 16; ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-no-partial-native-pattern';
  limits: { maximumInstances: 5; maximumCopies: 4; maximumCurveDegree: 5; maximumCurvePoles: 64; maximumSurfaceAxisPoles: 16; maximumSurfacePoles: 256;
    maximumCurveSamples: 127; maximumSurfaceSamples: 961; maximumCopyObservations: 3844; coordinateAbsMM: 10000; axisOriginAbsMM: 10000; axisDirectionAbs: 1000;
    minimumAxisNorm: 1e-6; minimumNormalizedNonzeroAxisComponent: 1e-12; minimumMultiMemberAngleDegrees: 1e-6; exclusiveMaximumTotalAngleDegrees: 360;
    rotationResidualThreshold: number; translationAbsMM: 10000; authoredIdCharacters: 48; prefixCharacters: 32;
    inputValues: 32768; inputDepth: 8; inputArrayElements: 128; inputRecordFields: 16; inputStringCharacters: 128;
    ownValues: 1048576; ownDepth: 40; arrayElements: 8192; recordFields: 64; sourceStringCharacters: 262144 };
}
export interface CircularGeometryPatternResult { original: Curve | Surface; options: CircularGeometryPatternOptions; instances: CircularGeometryPatternInstance[];
  source: string; sourceVersion: 0; model: Model; report: CircularGeometryPatternReport }

const CODE = CircularGeometryPatternDiagnosticCode;
type Context = { instanceIndex?: number | null; cause?: unknown };
function check(condition: boolean, code: CircularGeometryPatternDiagnosticCode, detail: string, context: Context = {}): asserts condition {
  if (!condition) throw new CircularGeometryPatternError(code, detail, context);
}
function native<T>(action: () => T, detail: string, context: Context = {}, code: CircularGeometryPatternDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof CircularGeometryPatternError) throw cause;
    const childCode = cause instanceof AffineGeometryTransformError && cause.code !== 'MATRIX' ? cause.code : code;
    throw new CircularGeometryPatternError(childCode, detail + ': ' + (cause instanceof Error ? cause.message : 'native operation refused'), { ...context, cause });
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
function record(input: unknown, fields: string[], code: CircularGeometryPatternDiagnosticCode = CODE.INPUT): Record<string, unknown> {
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


const ROTATION_TOLERANCE = 512 * Number.EPSILON;
const IDENTITY: CadAffineMatrix3x4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
type Rotation = CircularGeometryPatternReport['rotations'][number];
function rotation(index: number, angleDegrees: number, axis: Point, origin: Point): Rotation {
  const context = { instanceIndex: index };
  const finite = (value: number): number => { check(Number.isFinite(value), CODE.REPRESENTABILITY, 'finite Rodrigues arithmetic required', context); return value; };
  const multiply = (a: number, b: number): number => {
    const value = finite(a * b); check(a === 0 || b === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero Rodrigues product underflow', context); return value;
  };
  const radians = finite(multiply(angleDegrees, Math.PI) / 180);
  check(angleDegrees === 0 || radians !== 0, CODE.REPRESENTABILITY, 'nonzero angle radians disappeared', context);
  const quarter = angleDegrees / 90, exactQuarter = Number.isInteger(quarter) && angleDegrees === quarter * 90;
  let sine: number, cosine: number, oneMinusCosine: number;
  if (exactQuarter) {
    const q = ((quarter % 4) + 4) % 4; sine = [0, 1, 0, -1][q]; cosine = [1, 0, -1, 0][q]; oneMinusCosine = 1 - cosine;
  } else {
    sine = finite(Math.sin(radians)); cosine = finite(Math.cos(radians)); const halfSine = finite(Math.sin(radians / 2));
    oneMinusCosine = multiply(2, multiply(halfSine, halfSine));
    check(angleDegrees === 0 || oneMinusCosine > 0, CODE.REPRESENTABILITY, 'nonzero half-angle contribution disappeared', context);
  }
  const skew = [0, -axis[2], axis[1], axis[2], 0, -axis[0], -axis[1], axis[0], 0];
  const r = Array.from({ length: 9 }, (_, k) => {
    const row = Math.floor(k / 3), column = k % 3;
    return finite(finite((row === column ? cosine : 0) + multiply(oneMinusCosine, multiply(axis[row], axis[column]))) + multiply(sine, skew[k]));
  });
  const apply = (point: Point): Point => [0, 1, 2].map(row => {
    let value = 0; for (let column = 0; column < 3; column++) value = finite(value + multiply(r[row * 3 + column], point[column])); return value;
  }) as Point;
  const rotatedOrigin = apply(origin), translation = origin.map((value, i) => finite(value - rotatedOrigin[i])) as Point;
  check(translation.every(value => Math.abs(value) <= 10000), CODE.REPRESENTABILITY, 'Rodrigues affine translation exceeds10000mm before any child', context);
  const matrix: CadAffineMatrix3x4 = [r[0], r[1], r[2], translation[0], r[3], r[4], r[5], translation[1], r[6], r[7], r[8], translation[2]];
  let orthogonalityResidual = 0;
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
    let dot = 0; for (let k = 0; k < 3; k++) dot = finite(dot + multiply(r[k * 3 + a], r[k * 3 + b]));
    orthogonalityResidual = Math.max(orthogonalityResidual, Math.abs(finite(dot - (a === b ? 1 : 0))));
  }
  const triple = (a: number, b: number, c: number) => multiply(multiply(a, b), c);
  const terms = [triple(r[0], r[4], r[8]), triple(r[1], r[5], r[6]), triple(r[2], r[3], r[7]),
    -triple(r[2], r[4], r[6]), -triple(r[1], r[3], r[8]), -triple(r[0], r[5], r[7])];
  const determinant = terms.reduce((sum, value) => finite(sum + value), 0), determinantResidual = Math.abs(finite(determinant - 1));
  const rotatedAxis = apply(axis), axisResidual = finite(Math.hypot(...rotatedAxis.map((value, i) => finite(value - axis[i]))));
  const anchorDifference = finite(Math.hypot(...rotatedOrigin.map((value, i) => finite(finite(value + translation[i]) - origin[i]))));
  const anchorScale = Math.max(1, finite(Math.hypot(...origin)), finite(Math.hypot(...rotatedOrigin)), finite(Math.hypot(...translation)));
  const anchorResidual = finite(anchorDifference / anchorScale);
  check(determinant > 0 && orthogonalityResidual <= ROTATION_TOLERANCE && determinantResidual <= ROTATION_TOLERANCE
    && axisResidual <= ROTATION_TOLERANCE && anchorResidual <= ROTATION_TOLERANCE, CODE.REPRESENTABILITY, 'Rodrigues rotation/axis/anchor residual guard refused', context);
  return { index, angleDegrees, radians, sine, cosine, oneMinusCosine, trigonometry: exactQuarter ? 'exact-integral-quarter-turn-table' : 'native-sin-cos-stable-half-angle',
    matrix, determinant, orthogonalityResidual, determinantResidual, axisResidual, anchorResidual };
}

/** One atomic native Model containing a seed and direct right-hand axis-angle copies. */
export function buildCircularGeometryPattern(originalInput: Curve | Surface, optionsInput: CircularGeometryPatternOptions): CircularGeometryPatternResult {
  const data = record(snapshot({ original: originalInput, options: optionsInput }), ['original', 'options']);
  const original = admit(data.original), optionData = record(data.options, ['patternId', 'idPrefix', 'count', 'axisOriginMM', 'axisDirection', 'angleStepDegrees', 'maximumCopyObservations']);
  const patternId = id(optionData.patternId), idPrefix = id(optionData.idPrefix, 32);
  check(typeof optionData.count === 'number' && Number.isInteger(optionData.count) && optionData.count >= 1 && optionData.count <= 5, CODE.INPUT, 'total instance count integer1..5 required');
  const point = (input: unknown, maximum: number): Point => {
    check(Array.isArray(input) && input.length === 3 && input.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= maximum),
      CODE.INPUT, 'bounded finite authored axis point3 required'); return input as Point;
  };
  const axisOriginMM = point(optionData.axisOriginMM, 10000), axisDirection = point(optionData.axisDirection, 1000), count = optionData.count;
  const axisNorm = Math.hypot(...axisDirection); check(Number.isFinite(axisNorm) && axisNorm >= 1e-6, CODE.INPUT, 'authored axis norm must be at least1e-6');
  const normalizedAxis = axisDirection.map(value => value / axisNorm) as Point;
  check(normalizedAxis.every((value, i) => Number.isFinite(value) && (axisDirection[i] === 0 || value !== 0 && Math.abs(value) >= 1e-12)),
    CODE.REPRESENTABILITY, 'nonzero normalized axis components must be represented and at least1e-12');
  const normalizationResidual = Math.abs(Math.hypot(...normalizedAxis) - 1);
  check(Number.isFinite(normalizationResidual) && normalizationResidual <= ROTATION_TOLERANCE, CODE.REPRESENTABILITY, 'normalized axis unit-length residual refused');
  check(typeof optionData.angleStepDegrees === 'number' && Number.isFinite(optionData.angleStepDegrees) && Math.abs(optionData.angleStepDegrees) < 360,
    CODE.INPUT, 'finite angle step magnitude below360degrees required');
  const angleStepDegrees = optionData.angleStepDegrees;
  check(count === 1 || Math.abs(angleStepDegrees) >= 1e-6 && Math.abs((count - 1) * angleStepDegrees) < 360,
    CODE.INPUT, 'multi-member step at least1e-6degrees and total angle strictly below360 required');
  check(typeof optionData.maximumCopyObservations === 'number' && Number.isInteger(optionData.maximumCopyObservations)
    && optionData.maximumCopyObservations >= 0 && optionData.maximumCopyObservations <= 3844, CODE.BUDGET, 'maximumCopyObservations integer0..3844 required');
  const options: CircularGeometryPatternOptions = { patternId, idPrefix, count, axisOriginMM, axisDirection, angleStepDegrees, maximumCopyObservations: optionData.maximumCopyObservations };
  const activeGeometryIds = [original.id]; for (let index = 1; index < count; index++) activeGeometryIds.push(id(idPrefix + '_' + index));
  check(new Set(activeGeometryIds).size === count && !activeGeometryIds.includes(patternId), CODE.IDENTITY, 'all active seed/copy IDs and pattern ID must differ before child construction');
  const rotations: Rotation[] = [], anglesDegrees = [0], matrices: CadAffineMatrix3x4[] = [IDENTITY];
  for (let index = 1; index < count; index++) {
    const angleDegrees = index * angleStepDegrees;
    check(Number.isFinite(angleDegrees) && angleDegrees !== 0 && Math.abs(angleDegrees) < 360 && angleDegrees !== anglesDegrees[index - 1],
      CODE.REPRESENTABILITY, 'finite distinct nonzero index-times-step angle below360 required', { instanceIndex: index });
    const evidence = rotation(index, angleDegrees, normalizedAxis, axisOriginMM); rotations.push(evidence); anglesDegrees.push(angleDegrees); matrices.push(evidence.matrix);
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
  const domains: CircularGeometryPatternReport['domains'] = { curve: original.kind === 'curve' ? curveDomain(original) : null,
    u: original.kind === 'surface' ? surfaceDomain(original).u : null, v: original.kind === 'surface' ? surfaceDomain(original).v : null };
  const instances: CircularGeometryPatternInstance[] = [{ index: 0, geometryId: original.id, angleDegrees: 0, matrix: IDENTITY, geometry: original, evaluation: null }];
  let copyObservationCount = 0, originalD0EvaluationCount = 0, targetD0EvaluationCount = 0, originalD1AttemptCount = 0, targetD1AttemptCount = 0;
  let derivativeComparisonCount = 0, derivativeRefusalCount = 0, originalRefusals = 0, targetRefusals = 0, maximumPointDifferenceMM = 0;
  let maximumRelativeDerivativeDifference: number | null = null, maximumRelativeCrossDifference: number | null = null;
  const members: CircularGeometryPatternReport['members'] = [{ index: 0, geometryId: original.id, angleDegrees: 0, observationCount: 0,
    derivativeComparisonCount: 0, derivativeRefusalCount: 0, handedness: null }];
  for (const plan of rotations) {
    const geometryId = activeGeometryIds[plan.index];
    const evaluation = native(() => transformNativeGeometryAffine(original, plan.matrix, { geometryId, maximumObservations: observationsPerCopy }),
      'actual public affine rotation copy refused', { instanceIndex: plan.index });
    const report = evaluation.report, geometry = evaluation.geometry;
    check(same(evaluation.original, original) && same(evaluation.matrix, plan.matrix)
      && same(evaluation.options, { geometryId, maximumObservations: observationsPerCopy })
      && same({ ...original, id: geometryId, controlPoints: geometry.controlPoints }, geometry)
      && report.originalId === original.id && report.geometryId === geometryId && report.handedness === 'preserved'
      && report.observationCount === observationsPerCopy && same(report.samples, samples) && same(report.domains, domains)
      && same(report.unrepresentedMidpointIntervals, unrepresentedMidpointIntervals), CODE.BINDING,
      'actual individual affine rotation proof must retain original basis/weights/parameters and planned roles', { instanceIndex: plan.index });
    instances.push({ index: plan.index, geometryId, angleDegrees: plan.angleDegrees, matrix: plan.matrix, geometry, evaluation });
    copyObservationCount += report.observationCount; originalD0EvaluationCount += report.originalD0EvaluationCount; targetD0EvaluationCount += report.targetD0EvaluationCount;
    originalD1AttemptCount += report.originalD1AttemptCount; targetD1AttemptCount += report.targetD1AttemptCount;
    derivativeComparisonCount += report.derivativeComparisonCount; derivativeRefusalCount += report.derivativeRefusalCount;
    originalRefusals += report.derivativeSourceRefusalCounts.original; targetRefusals += report.derivativeSourceRefusalCounts.target;
    maximumPointDifferenceMM = Math.max(maximumPointDifferenceMM, report.maximumPointDifference);
    if (report.maximumRelativeDerivativeDifference !== null) maximumRelativeDerivativeDifference = Math.max(maximumRelativeDerivativeDifference ?? 0, report.maximumRelativeDerivativeDifference);
    if (report.maximumRelativeCrossDifference !== null) maximumRelativeCrossDifference = Math.max(maximumRelativeCrossDifference ?? 0, report.maximumRelativeCrossDifference);
    members.push({ index: plan.index, geometryId, angleDegrees: plan.angleDegrees, observationCount: report.observationCount,
      derivativeComparisonCount: report.derivativeComparisonCount, derivativeRefusalCount: report.derivativeRefusalCount, handedness: 'preserved' });
  }
  check(instances.length === count && copyObservationCount === plannedCopyObservations && rotations.length === plannedCopyCount,
    CODE.BINDING, 'complete actual native copies and planned aggregate observations required');
  const expectedModel: Model = { name: patternId, version: 0, lengthUnit: 'mm', objects: instances.map(instance => instance.geometry) };
  const adopted = native(() => adopt(expectedModel), 'actual all-member native Source0 serialization/compile binding');
  check(adopted.source.length <= 262144, CODE.BUDGET, 'all-member native source string budget exceeded');
  check(same(adopted.model, expectedModel), CODE.BINDING, 'all-member compiled Model must retain order/identity/all coefficient bits');
  const report: CircularGeometryPatternReport = {
    schema: 'barocss-native-circular-geometry-pattern', version: 0, originalId: original.id, patternId, kind: original.kind, lengthUnit: 'mm', sourceFrame: 'authored-xyz-no-axis-conversion',
    count, axisOriginMM, axisDirection, axisNorm, normalizedAxis, normalizationResidual, angleStepDegrees, activeGeometryIds, anglesDegrees, matrices, rotations,
    plannedCopyCount, plannedCopyObservations, observationsPerCopy, childConstructionCount: rotations.length, domains, samples, unrepresentedMidpointIntervals,
    copyObservationCount, originalD0EvaluationCount, targetD0EvaluationCount, originalD1AttemptCount, targetD1AttemptCount, derivativeComparisonCount, derivativeRefusalCount,
    derivativeSourceRefusalCounts: { original: originalRefusals, target: targetRefusals }, maximumPointDifferenceMM, maximumRelativeDerivativeDifference, maximumRelativeCrossDifference,
    sourceModelObjectCount: adopted.model.objects.length, members, geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    quality: { authority: 'actual-public-native-affine-copy-per-member-from-original-seed', originalSeedBitsPreserved: true, basisWeightsAndParameterBitsPreserved: true,
      preflight: 'all-active-identities-angles-rodrigues-matrices-residuals-and-complete-copy-observation-budget-before-any-child',
      rotationPolicy: 'normalized-authored-axis-right-hand-rodrigues-no-modulo-or-angle-snapping',
      trigonometryPolicy: 'exact-integral-quarter-turn-table-otherwise-native-sin-cos-and-two-sin-half-angle-squared',
      residualScales: { orthogonality: 'max-absolute-rt-r-minus-identity', determinant: 'absolute-det-minus-one', axis: 'euclidean-r-axis-minus-axis',
        anchor: 'euclidean-r-c-plus-t-minus-c-over-max-one-c-r-c-t-norms' },
      seedPolicy: 'actual-original-identity-matrix-null-evaluation-no-phantom-copy-work', nativeProofs: 'complete-individual-affine-results-not-first-member-broadcast',
      sourceAuthority: 'one-actual-compiled-native-model-seed-then-copies', identityMeaning: 'current-recipe-roles-not-persistent-topological-naming-or-graph-revisions',
      workScope: 'per-copy-matrix-preflight-and-summed-actual-affine-child-point-d1-counts-excludes-seed-validation-source-compiler-and-internal-validation', assembly: false,
      booleanUnion: false, topologyCertified: false, globalMetricPreservationCertified: false, globalShapeErrorCertified: false, globalBinary64ErrorCertified: false,
      manufacturingToleranceCertified: false, sourceObjectLimitUnchanged: 16, ownership: 'copied-cpu-data-gc-no-renderer-resources' }, budgetFailure: 'atomic-refusal-no-partial-native-pattern',
    limits: { maximumInstances: 5, maximumCopies: 4, maximumCurveDegree: 5, maximumCurvePoles: 64, maximumSurfaceAxisPoles: 16, maximumSurfacePoles: 256,
      maximumCurveSamples: 127, maximumSurfaceSamples: 961, maximumCopyObservations: 3844, coordinateAbsMM: 10000, axisOriginAbsMM: 10000, axisDirectionAbs: 1000,
      minimumAxisNorm: 1e-6, minimumNormalizedNonzeroAxisComponent: 1e-12, minimumMultiMemberAngleDegrees: 1e-6, exclusiveMaximumTotalAngleDegrees: 360,
      rotationResidualThreshold: ROTATION_TOLERANCE, translationAbsMM: 10000, authoredIdCharacters: 48, prefixCharacters: 32,
      inputValues: 32768, inputDepth: 8, inputArrayElements: 128, inputRecordFields: 16, inputStringCharacters: 128,
      ownValues: 1048576, ownDepth: 40, arrayElements: 8192, recordFields: 64, sourceStringCharacters: 262144 }
  };
  return snapshot({ original, options, instances, source: adopted.source, sourceVersion: 0, model: adopted.model, report }, true) as CircularGeometryPatternResult;
}

/** Rebuild the complete axis-angle recipe and all actual affine/source proofs from copied owned inputs. */
export function validateCircularGeometryPattern(input: CircularGeometryPatternResult): CircularGeometryPatternReport {
  const data = record(snapshot(input, true), ['original', 'options', 'instances', 'source', 'sourceVersion', 'model', 'report'], CODE.OWNED);
  let rebuilt: CircularGeometryPatternResult;
  try { rebuilt = buildCircularGeometryPattern(data.original as Curve | Surface, data.options as CircularGeometryPatternOptions); }
  catch (cause) { throw new CircularGeometryPatternError(CODE.OWNED, 'owned native circular pattern rebuild refused', { cause,
    instanceIndex: cause instanceof CircularGeometryPatternError ? cause.instanceIndex : null }); }
  check(same(data, rebuilt), CODE.OWNED, 'whole owned native circular pattern differs from actual rebuild'); return copyCadData(rebuilt.report);
}
