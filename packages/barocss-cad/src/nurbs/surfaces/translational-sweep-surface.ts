import { CadNumericPolicy } from '../../numeric-policy.js';
import { validateCurve, validateSurface, curveDomain, surfaceDomain, evaluateCurve, evaluateSurface } from '../../math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from '../../derivatives.js';
import type { CurveD1Result, SurfaceD1Result } from '../../derivatives.js';
import { adopt } from '../../intersect/own-plane-cylinder-intersection-internal.js';
import { copyCadData } from '../../data-copy.js';
import type { Curve, Surface, Model, Point } from '../../types.js';
import { same } from '../../structural-equality.js';

export const TranslationalSweepDiagnosticCode = Object.freeze({ INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', NATIVE: 'NATIVE',
  REPRESENTABILITY: 'REPRESENTABILITY', BINDING: 'BINDING', OWNED: 'OWNED' } as const);
export type TranslationalSweepDiagnosticCode = typeof TranslationalSweepDiagnosticCode[keyof typeof TranslationalSweepDiagnosticCode];
export class TranslationalSweepError extends Error {
  readonly code: TranslationalSweepDiagnosticCode;
  constructor(code: TranslationalSweepDiagnosticCode, detail: string, cause?: unknown) {
    super(('Translational sweep Surface: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'TranslationalSweepError'; this.code = code;
  }
}
export interface TranslationalSweepOptions { surfaceId: string; maximumObservations: number }
type D1State<T> = { status: 'evaluated'; value: T } | { status: 'native-refused'; reason: string; nativeErrorName: string };
export interface TranslationalSweepObservation {
  u: number; v: number; profilePointMM: Point; railPointMM: Point; expectedPointMM: Point; actualPointMM: Point; differenceMM: number;
  profileD1: D1State<CurveD1Result>; railD1: D1State<CurveD1Result>; surfaceD1: D1State<SurfaceD1Result>;
  relativeDuDifference: number | null; relativeDvDifference: number | null;
}
export interface TranslationalSweepProvenance {
  kind: 'independent-rational-profile-rail-translational-tensor'; profileId: string; railId: string; surfaceId: string;
  formula: 'Qij=Pi+(Rj-nativeAnchor);Wij=profileWeight_i*railWeight_j'; anchorParameter: number; anchorMM: Point;
  profileDomain: [number, number]; railDomain: [number, number]; poleGrid: [number, number];
  poles: { surfacePole: [number, number]; profilePoleIndex: number; railPoleIndex: number; profilePointMM: Point; railPointMM: Point;
    anchorMM: Point; translationMM: Point; profileWeight: number; railWeight: number; pointMM: Point; weight: number }[];
  uKnotMappings: { profileKnotIndex: number; surfaceKnotIndex: number; originalValue: number; surfaceValue: number }[];
  vKnotMappings: { railKnotIndex: number; surfaceKnotIndex: number; originalValue: number; surfaceValue: number }[];
}
export interface TranslationalSweepReport {
  kind: 'translational-sweep-surface'; dto: { schema: 'barocss-native-translational-sweep-surface'; version: 0; lengthUnit: 'mm'; frame: 'authored-xyz-no-axis-conversion';
    representation: 'native-independent-profile-rail-tensor-surface-not-moving-frame-or-solid' };
  surfaceId: string; profileId: string; railId: string; degreeU: number; degreeV: number; controlPointGrid: [number, number];
  domains: { u: [number, number]; v: [number, number] }; axisRoles: { u: 'original-profile-parameter'; v: 'original-rail-parameter' };
  anchorParameter: number; anchorMM: Point; profileSamples: number[]; railSamples: number[]; observationCount: number; observations: TranslationalSweepObservation[];
  unrepresentedMidpointIntervals: { profile: { domain: [number, number]; attemptedParameter: number }[]; rail: { domain: [number, number]; attemptedParameter: number }[] };
  guardedParameters: { u: number[]; v: number[] }; anchorD0EvaluationCount: 1; curveD0EvaluationCount: number; surfaceD0EvaluationCount: number;
  profileD1AttemptCount: number; railD1AttemptCount: number; surfaceD1AttemptCount: number; derivativeComparisonCount: number; derivativeRefusalCount: number;
  derivativeSourceRefusalCounts: { profile: number; rail: number; surface: number };
  maximumPointDifferenceMM: number; maximumRelativeDuDifference: number | null; maximumRelativeDvDifference: number | null;
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  quality: { relation: 'actual-profile-point-plus-actual-rail-point-minus-actual-native-anchor'; independentRationalBasesPreserved: true;
    knotDomainBitsPreserved: true; productWeights: 'actual-input-weight-products-no-normalization';
    zeroShiftPolicy: 'exact-zero-rail-delta-copies-original-profile-coordinate'; localObservationsOnly: true;
    nativeD1Refusals: 'actual-surface-refusal-iff-either-original-curve-refuses-no-inferred-du-dv';
    workScope: 'new-anchor-d0-and-complete-point-d1-pairs-excludes-native-source-compiler-and-internal-validation';
    globalShapeErrorCertified: false; globalBinary64ErrorCertified: false; manufacturingToleranceCertified: false; g1g2Certified: false;
    manifoldCertified: false; regularityCertified: false; movingFrameCertified: false; sourceObjectLimitUnchanged: 16;
    ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-no-partial-sweep-surface';
  limits: { maximumCurveDegree: 3; maximumCurvePoles: 16; maximumSurfacePoles: 256; maximumAxisSamples: 31; maximumObservations: 961;
    inputValues: 32768; inputDepth: 8; inputArrayElements: 128; inputRecordFields: 16; inputStringCharacters: 128;
    ownValues: 524288; ownDepth: 32; arrayElements: 4096; recordFields: 64; sourceStringCharacters: 262144;
    authoredIdCharacters: 48; coordinateAbsMM: 10000; weightRange: [1e-6, 1e6]; pointComparisonMM: 1e-7; relativeD1Comparison: 1e-7 };
}
export interface TranslationalSweepResult { profile: Curve; rail: Curve; options: TranslationalSweepOptions; surface: Surface;
  source: string; sourceVersion: 0; model: Model; provenance: TranslationalSweepProvenance; report: TranslationalSweepReport }

const CODE = TranslationalSweepDiagnosticCode, TOLERANCE = CadNumericPolicy.linearToleranceMM;
function check(condition: boolean, code: TranslationalSweepDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new TranslationalSweepError(code, detail);
}
function native<T>(action: () => T, detail: string, code: TranslationalSweepDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof TranslationalSweepError) throw cause;
    throw new TranslationalSweepError(code, detail + ': ' + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
  }
}
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT;
  let remaining = owned ? 524288 : 32768;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= (owned ? 32 : 8), code, 'own-value/depth budget exceeded');
    if (value === null && owned || typeof value === 'boolean' && owned) return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'finite own numbers required'); return value; }
    if (typeof value === 'string') { check(value.length <= (owned ? 262144 : 128), code, 'own/source string budget exceeded'); return value; }
    check(value !== null && typeof value === 'object', code, 'plain own data required');
    check(!ancestors.has(value), code, 'ancestor cycles refused');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'foreign own-data prototype refused');
    check(keys.length <= (array ? (owned ? 4097 : 129) : (owned ? 64 : 16)) && keys.every(key => typeof key === 'string' && key.length <= 128
      && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden/excess own fields refused');
    ancestors.add(value);
    try {
      if (array) {
        const n = descriptors.length.value as number;
        check(Number.isInteger(n) && n >= 0 && n <= (owned ? 4096 : 128) && keys.length === n + 1, code, 'dense bounded own array required');
        return Array.from({ length: n }, (_, i) => { check(Object.hasOwn(descriptors, String(i)), code, 'sparse/foreign own array field refused'); return copy(descriptors[String(i)].value, depth + 1); });
      }
      return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    } finally { ancestors.delete(value); }
  }; return copy(input, 0);
}
function record(input: unknown, fields: string[], code: TranslationalSweepDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), code, 'own record required');
  const data = input as Record<string, unknown>; check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'exact fields required: ' + fields.join(',')); return data;
}
function id(value: unknown): string { check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII ID1..48 required'); return value; }
function admitCurve(input: unknown, label: string): Curve {
  const curve = record(input, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']) as unknown as Curve; id(curve.id);
  check(curve.kind === 'curve' && Number.isInteger(curve.degree) && curve.degree >= 1 && curve.degree <= 3, CODE.INPUT, label + ' degree1..3 native Curve required');
  check(Array.isArray(curve.controlPoints) && curve.controlPoints.length >= 2 && curve.controlPoints.length <= 16 && curve.controlPoints.every(point => Array.isArray(point)
    && point.length === 3 && point.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000)), CODE.INPUT, label + ' poles2..16/XYZ10000mm required');
  native(() => validateCurve(curve), 'actual positive clamped ' + label + ' Curve validation', CODE.INPUT); return curve;
}
function finite(value: number): number { check(Number.isFinite(value), CODE.REPRESENTABILITY, 'finite tensor/translation/observation arithmetic required'); return value; }
function product(a: number, b: number): number { const value = finite(a * b); check(a === 0 || b === 0 || value !== 0, CODE.REPRESENTABILITY, 'nonzero tensor product underflow'); return value; }
function translated(origin: Point, delta: Point): Point {
  return origin.map((value, axis) => {
    if (delta[axis] === 0) return value;
    const result = finite(value + delta[axis]); check(result !== value, CODE.REPRESENTABILITY, 'nonzero rail translation disappeared into unchanged profile coordinate'); return result;
  }) as Point;
}
function distance(a: Point, b: Point): number { return finite(Math.hypot(...a.map((value, i) => finite(value - b[i])))); }
function relative(a: Point, b: Point): number { const difference = distance(a, b), result = finite(difference / Math.max(1, finite(Math.hypot(...a)), finite(Math.hypot(...b))));
  check(difference === 0 || result !== 0, CODE.REPRESENTABILITY, 'nonzero local relative derivative residual underflow'); return result; }
function axisSamples(curve: Curve): { domain: [number, number]; samples: number[]; gaps: { domain: [number, number]; attemptedParameter: number }[]; guards: number[] } {
  const domain = curveDomain(curve), width = finite(domain[1] - domain[0]); check(width > 0, CODE.REPRESENTABILITY, 'positive finite original knot span required');
  // Numeric equality deduplicates active knots while retaining their first actual value, including -0.
  const breaks = [domain[0]];
  for (const knot of curve.knots) if (knot > domain[0] && knot < domain[1] && knot !== breaks[breaks.length - 1]) breaks.push(knot);
  breaks.push(domain[1]);
  const samples: number[] = [], gaps: { domain: [number, number]; attemptedParameter: number }[] = [];
  for (let i = 0; i < breaks.length; i++) {
    samples.push(breaks[i]); if (i + 1 === breaks.length) continue;
    const middle = finite(breaks[i] + finite(breaks[i + 1] - breaks[i]) / 2);
    if (middle > breaks[i] && middle < breaks[i + 1]) samples.push(middle);
    else gaps.push({ domain: [breaks[i], breaks[i + 1]], attemptedParameter: middle });
  }
  check(samples.length <= 31, CODE.BUDGET, 'original native axis sample bound31 exceeded');
  const guards = breaks.filter(value => value > domain[0] && value < domain[1] && curve.knots.filter(knot => knot === value).length >= curve.degree);
  return { domain, samples, gaps, guards };
}
function attempt<T>(action: () => T, refused: (cause: Error) => void): D1State<T> {
  try { return { status: 'evaluated', value: action() }; } catch (cause) {
    check(cause instanceof Error, CODE.NATIVE, 'actual native derivative refusal must carry an Error'); refused(cause);
    return { status: 'native-refused', reason: cause.message.slice(0, 1024), nativeErrorName: cause.name.slice(0, 128) };
  }
}

/** Exact independent homogeneous tensor construction in original native profile/rail parameter units. */
export function buildTranslationalSweepSurface(profileInput: Curve, railInput: Curve, optionsInput: TranslationalSweepOptions): TranslationalSweepResult {
  const copied = record(snapshot({ profile: profileInput, rail: railInput, options: optionsInput }), ['profile', 'rail', 'options']);
  const profile = admitCurve(copied.profile, 'profile'), rail = admitCurve(copied.rail, 'rail'), settings = record(copied.options, ['surfaceId', 'maximumObservations']);
  const surfaceId = id(settings.surfaceId);
  check(new Set([profile.id, rail.id, surfaceId]).size === 3, CODE.IDENTITY, 'profile/rail/derived Surface IDs must be distinct');
  check(typeof settings.maximumObservations === 'number' && Number.isInteger(settings.maximumObservations) && settings.maximumObservations >= 0 && settings.maximumObservations <= 961,
    CODE.BUDGET, 'integer maximumObservations0..961 required');
  const options: TranslationalSweepOptions = { surfaceId, maximumObservations: settings.maximumObservations };
  const profileAxis = axisSamples(profile), railAxis = axisSamples(rail), completeCount = profileAxis.samples.length * railAxis.samples.length;
  check(completeCount <= options.maximumObservations && completeCount <= 961, CODE.BUDGET, 'complete original sample Cartesian product exceeds caller budget before anchor/geometry staging');
  const anchorParameter = railAxis.domain[0], anchorMM = native(() => evaluateCurve(rail, anchorParameter), 'actual original rail-minimum D0 anchor');
  const poles: TranslationalSweepProvenance['poles'] = [], controlPoints: Point[][] = [], weights: number[][] = [];
  for (let i = 0; i < profile.controlPoints.length; i++) {
    const row: Point[] = [], weightRow: number[] = [];
    for (let j = 0; j < rail.controlPoints.length; j++) {
      const translationMM = rail.controlPoints[j].map((value, axis) => finite(value - anchorMM[axis])) as Point;
      const pointMM = translated(profile.controlPoints[i], translationMM), weight = product(profile.weights[i], rail.weights[j]);
      check(pointMM.every(value => Math.abs(value) <= 10000) && weight >= 1e-6 && weight <= 1e6, CODE.REPRESENTABILITY, 'generated tensor XYZ/weight product exceeds unchanged native construction bounds');
      row.push(pointMM); weightRow.push(weight);
      poles.push({ surfacePole: [i, j], profilePoleIndex: i, railPoleIndex: j, profilePointMM: profile.controlPoints[i], railPointMM: rail.controlPoints[j],
        anchorMM, translationMM, profileWeight: profile.weights[i], railWeight: rail.weights[j], pointMM, weight });
    }
    controlPoints.push(row); weights.push(weightRow);
  }
  const surface: Surface = { kind: 'surface', id: surfaceId, degreeU: profile.degree, degreeV: rail.degree, knotsU: copyCadData(profile.knots), knotsV: copyCadData(rail.knots), controlPoints, weights };
  native(() => validateSurface(surface), 'actual independent rational native tensor Surface validation');
  const expectedModel: Model = { name: surfaceId, version: 0, lengthUnit: 'mm', objects: [profile, rail, surface] };
  const file = native(() => adopt(expectedModel), 'actual original3-object Source0 compiler adoption');
  check(file.source.length <= 262144, CODE.BUDGET, 'source string capacity exceeded');
  check(same(file.model, expectedModel), CODE.BINDING, 'actual compiled model must preserve complete original/tensor IDs/order/coefficients/knots/weights/sign bits');
  const observations: TranslationalSweepObservation[] = [];
  let curveD0EvaluationCount = 0, surfaceD0EvaluationCount = 0, profileD1AttemptCount = 0, railD1AttemptCount = 0, surfaceD1AttemptCount = 0;
  let derivativeComparisonCount = 0, derivativeRefusalCount = 0;
  const derivativeSourceRefusalCounts = { profile: 0, rail: 0, surface: 0 };
  for (const u of profileAxis.samples) for (const v of railAxis.samples) {
    curveD0EvaluationCount += 2; surfaceD0EvaluationCount++;
    const profilePointMM = native(() => evaluateCurve(profile, u), 'actual original profile D0 observation');
    const railPointMM = native(() => evaluateCurve(rail, v), 'actual original rail D0 observation');
    const expectedPointMM = translated(profilePointMM, railPointMM.map((value, axis) => finite(value - anchorMM[axis])) as Point);
    const actualPointMM = native(() => evaluateSurface(surface, u, v), 'actual native tensor Surface D0 observation'), differenceMM = distance(expectedPointMM, actualPointMM);
    check(differenceMM <= TOLERANCE, CODE.BINDING, 'actual native profile+rail-anchor point relation exceeds1e-7mm');
    let profileRefusal: Error | undefined, railRefusal: Error | undefined, surfaceRefusal: Error | undefined;
    profileD1AttemptCount++; const profileD1 = attempt(() => evaluateCurveD1(profile, u), cause => { profileRefusal = cause; });
    railD1AttemptCount++; const railD1 = attempt(() => evaluateCurveD1(rail, v), cause => { railRefusal = cause; });
    surfaceD1AttemptCount++; const surfaceD1 = attempt(() => evaluateSurfaceD1(surface, u, v), cause => { surfaceRefusal = cause; });
    if (profileD1.status === 'native-refused') derivativeSourceRefusalCounts.profile++;
    if (railD1.status === 'native-refused') derivativeSourceRefusalCounts.rail++;
    if (surfaceD1.status === 'native-refused') derivativeSourceRefusalCounts.surface++;
    const originalRefused = profileD1.status === 'native-refused' || railD1.status === 'native-refused';
    if ((surfaceD1.status === 'native-refused') !== originalRefused) throw new TranslationalSweepError(CODE.BINDING,
      'actual Surface D1 must refuse iff either actual original Curve D1 refuses; no inferred derivative allowed', surfaceRefusal ?? profileRefusal ?? railRefusal);
    let relativeDuDifference: number | null = null, relativeDvDifference: number | null = null;
    if (profileD1.status === 'evaluated' && railD1.status === 'evaluated' && surfaceD1.status === 'evaluated') {
      derivativeComparisonCount++; relativeDuDifference = relative(surfaceD1.value.du, profileD1.value.derivative); relativeDvDifference = relative(surfaceD1.value.dv, railD1.value.derivative);
      check(relativeDuDifference <= TOLERANCE && relativeDvDifference <= TOLERANCE, CODE.BINDING, 'actual native du/profileD1 or dv/railD1 relation exceeds1e-7 relative');
    } else derivativeRefusalCount++;
    observations.push({ u, v, profilePointMM, railPointMM, expectedPointMM, actualPointMM, differenceMM, profileD1, railD1, surfaceD1, relativeDuDifference, relativeDvDifference });
  }
  check(observations.length === completeCount && profileD1AttemptCount === completeCount && railD1AttemptCount === completeCount && surfaceD1AttemptCount === completeCount,
    CODE.BINDING, 'complete actual point/D1 pair counts required');
  const provenance: TranslationalSweepProvenance = { kind: 'independent-rational-profile-rail-translational-tensor', profileId: profile.id, railId: rail.id, surfaceId,
    formula: 'Qij=Pi+(Rj-nativeAnchor);Wij=profileWeight_i*railWeight_j', anchorParameter, anchorMM, profileDomain: profileAxis.domain, railDomain: railAxis.domain,
    poleGrid: [profile.controlPoints.length, rail.controlPoints.length], poles,
    uKnotMappings: profile.knots.map((value, index) => ({ profileKnotIndex: index, surfaceKnotIndex: index, originalValue: value, surfaceValue: surface.knotsU[index] })),
    vKnotMappings: rail.knots.map((value, index) => ({ railKnotIndex: index, surfaceKnotIndex: index, originalValue: value, surfaceValue: surface.knotsV[index] })) };
  const compared = observations.filter(observation => observation.relativeDuDifference !== null && observation.relativeDvDifference !== null);
  const report: TranslationalSweepReport = {
    kind: 'translational-sweep-surface', dto: { schema: 'barocss-native-translational-sweep-surface', version: 0, lengthUnit: 'mm', frame: 'authored-xyz-no-axis-conversion',
      representation: 'native-independent-profile-rail-tensor-surface-not-moving-frame-or-solid' }, surfaceId, profileId: profile.id, railId: rail.id,
    degreeU: surface.degreeU, degreeV: surface.degreeV, controlPointGrid: [profile.controlPoints.length, rail.controlPoints.length], domains: surfaceDomain(surface),
    axisRoles: { u: 'original-profile-parameter', v: 'original-rail-parameter' }, anchorParameter, anchorMM, profileSamples: profileAxis.samples, railSamples: railAxis.samples,
    observationCount: observations.length, observations, unrepresentedMidpointIntervals: { profile: profileAxis.gaps, rail: railAxis.gaps }, guardedParameters: { u: profileAxis.guards, v: railAxis.guards },
    anchorD0EvaluationCount: 1, curveD0EvaluationCount, surfaceD0EvaluationCount, profileD1AttemptCount, railD1AttemptCount, surfaceD1AttemptCount,
    derivativeComparisonCount, derivativeRefusalCount, derivativeSourceRefusalCounts, maximumPointDifferenceMM: Math.max(...observations.map(observation => observation.differenceMM)),
    maximumRelativeDuDifference: compared.length === 0 ? null : Math.max(...compared.map(observation => observation.relativeDuDifference!)),
    maximumRelativeDvDifference: compared.length === 0 ? null : Math.max(...compared.map(observation => observation.relativeDvDifference!)),
    geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    quality: { relation: 'actual-profile-point-plus-actual-rail-point-minus-actual-native-anchor', independentRationalBasesPreserved: true, knotDomainBitsPreserved: true,
      productWeights: 'actual-input-weight-products-no-normalization', zeroShiftPolicy: 'exact-zero-rail-delta-copies-original-profile-coordinate', localObservationsOnly: true,
      nativeD1Refusals: 'actual-surface-refusal-iff-either-original-curve-refuses-no-inferred-du-dv',
      workScope: 'new-anchor-d0-and-complete-point-d1-pairs-excludes-native-source-compiler-and-internal-validation', globalShapeErrorCertified: false,
      globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, g1g2Certified: false, manifoldCertified: false, regularityCertified: false,
      movingFrameCertified: false, sourceObjectLimitUnchanged: 16, ownership: 'copied-cpu-data-gc-no-renderer-resources' }, budgetFailure: 'atomic-refusal-no-partial-sweep-surface',
    limits: { maximumCurveDegree: 3, maximumCurvePoles: 16, maximumSurfacePoles: 256, maximumAxisSamples: 31, maximumObservations: 961,
      inputValues: 32768, inputDepth: 8, inputArrayElements: 128, inputRecordFields: 16, inputStringCharacters: 128, ownValues: 524288, ownDepth: 32,
      arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144, authoredIdCharacters: 48, coordinateAbsMM: 10000, weightRange: [1e-6, 1e6],
      pointComparisonMM: TOLERANCE, relativeD1Comparison: TOLERANCE },
  };
  return snapshot({ profile, rail, options, surface, source: file.source, sourceVersion: 0, model: file.model, provenance, report }, true) as TranslationalSweepResult;
}
/** Rebuild original curves, actual anchor, native tensor/source, all point/D1 states and complete pair work. */
export function validateTranslationalSweepSurface(input: TranslationalSweepResult): TranslationalSweepReport {
  const owned = record(snapshot(input, true), ['profile', 'rail', 'options', 'surface', 'source', 'sourceVersion', 'model', 'provenance', 'report'], CODE.OWNED) as unknown as TranslationalSweepResult;
  let expected: TranslationalSweepResult;
  try { expected = buildTranslationalSweepSurface(owned.profile, owned.rail, owned.options); } catch (cause) {
    throw new TranslationalSweepError(CODE.OWNED, 'owned complete native translational sweep reconstruction refused', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'owned original/anchor/tensor/knots/weights/source/provenance/point/D1/count/report mismatch');
  return snapshot(expected.report, true) as TranslationalSweepReport;
}
