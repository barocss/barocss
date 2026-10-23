import { validateCurve, validateSurface, curveDomain, surfaceDomain, evaluateCurve, evaluateSurface } from './math.js';
import { evaluateCurveD1, evaluateSurfaceD1 } from './derivatives.js';
import type { CurveD1Result, SurfaceD1Result } from './derivatives.js';
import { adopt } from './intersect/own-plane-cylinder-intersection-internal.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Surface, Model, Point } from './types.js';
import { same } from './structural-equality.js';

export const ThreeSectionLoftDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', BASIS: 'BASIS', REPRESENTABILITY: 'REPRESENTABILITY',
  BUDGET: 'BUDGET', NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
} as const);
export type ThreeSectionLoftDiagnosticCode = typeof ThreeSectionLoftDiagnosticCode[keyof typeof ThreeSectionLoftDiagnosticCode];
export class ThreeSectionLoftError extends Error {
  readonly code: ThreeSectionLoftDiagnosticCode;
  constructor(code: ThreeSectionLoftDiagnosticCode, detail: string, cause?: unknown) {
    super(('Three-section loft Surface: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'ThreeSectionLoftError'; this.code = code;
  }
}
export interface ThreeSectionLoftOptions { surfaceId: string }
export interface ThreeSectionLoftObservation {
  u: number; v: number; sectionIndex: number; expectedPointMM: Point; actualPointMM: Point; differenceMM: number;
}
export interface ThreeSectionLoftD1Observation {
  u: number; v: number; sectionIndex: number;
  original: { status: 'evaluated'; value: CurveD1Result } | { status: 'native-refused'; reason: string };
  surface: { status: 'evaluated'; value: SurfaceD1Result } | { status: 'native-refused'; reason: string };
  relativeDuDifference: number | null;
}
type Homogeneous = [number, number, number, number];
export interface ThreeSectionLoftProvenance {
  kind: 'three-section-homogeneous-loft'; surfaceId: string; sectionIds: [string, string, string]; sectionParameters: [0, .5, 1];
  middleFormula: 'H1=2*Hmiddle-0.5*(Hfirst+Hlast)';
  rows: { poleIndex: number; sectionPoleIndices: [number, number, number]; Hfirst: Homogeneous; Hmiddle: Homogeneous; Hlast: Homogeneous;
    doubledMiddle: Homogeneous; averagedEndpoints: Homogeneous; generatedHmiddle: Homogeneous;
    weightContributingMagnitude: number; weightCancellationMargin: number;
    poleMappings: { surfacePole: [number, number]; origin: 'section-bit-copy' | 'generated-homogeneous';
      sectionIndex: number | null; sectionPoleIndex: number | null; sourceSectionIndices: number[]; pointMM: Point }[];
    weightMappings: { surfacePole: [number, number]; origin: 'section-bit-copy' | 'generated-homogeneous';
      sectionIndex: number | null; sectionPoleIndex: number | null; sourceSectionIndices: number[]; weight: number }[];
  }[];
  uKnotMappings: { sectionKnotIndex: number; surfaceKnotIndex: number; sectionValues: [number, number, number];
    surfaceValue: number; origin: 'common-basis-bit-copy' }[];
}
export interface ThreeSectionLoftReport {
  kind: 'three-section-loft-surface';
  dto: { schema: 'barocss-native-three-section-loft'; version: 0; lengthUnit: 'mm';
    frame: 'authored-xyz-no-axis-conversion'; representation: 'native-three-section-surface-not-brep-or-solid' };
  surfaceId: string; sectionIds: [string, string, string]; degreeU: number; degreeV: 2; controlPointGrid: [number, 3];
  domains: { u: [number, number]; v: [0, 1] }; sectionParameters: [0, .5, 1]; originalSpanCount: number;
  observationCount: number; derivativeObservationCount: number; observations: ThreeSectionLoftObservation[];
  derivativeObservations: ThreeSectionLoftD1Observation[]; guardedParameters: number[];
  derivativeComparisonCount: number; derivativeRefusalCount: number; asymmetricDerivativeRefusalCount: number;
  maximumPointDifferenceMM: number; maximumRelativeDuDifference: number | null;
  unrepresentedMidpointIntervals: { domain: [number, number]; attemptedParameter: number }[];
  authority: 'original-three-section-homogeneous-coefficients'; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  quality: { pointComparisonMM: 1e-7; relativeDuComparison: 1e-7; localObservationsOnly: true;
    endpointControlAndWeightBitsPreserved: true; commonUKnotDomainBitsPreserved: true;
    middleInterpolation: 'actual-homogeneous-section-interpolation-at-v-half';
    betweenSections: 'homogeneous-weight-dependent-not-naive-cartesian-interpolation'; sectionWeightScalingInvarianceCertified: false;
    generatedWeightPolicy: 'positive-native-weight-above64-epsilon-absolute-contributing-terms';
    nativeD1Refusals: 'actual-original-and-surface-states-no-inferred-equality';
    globalShapeErrorCertified: false; globalBinary64ErrorCertified: false; manufacturingToleranceCertified: false; g1g2Certified: false;
    sourceText: 'regenerated-from-supplied-native-geometry-not-original-file-formatting';
    ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-no-partial-result';
  limits: { maximumSectionDegree: 3; maximumSectionPoles: 16; maximumSurfacePoles: 48; maximumPointObservations: 96;
    maximumDerivativeObservations: 96; authoredIdCharacters: 48; coordinateAbsMM: 10000; weightRange: [1e-6, 1e6];
    inputValues: 32768; inputDepth: 8; inputArrayElements: 128; inputRecordFields: 16; inputStringCharacters: 128;
    snapshotValues: 524288; snapshotDepth: 32; arrayElements: 4096; recordFields: 64; sourceStringCharacters: 262144 };
}
export interface ThreeSectionLoftResult {
  sections: [Curve, Curve, Curve]; options: ThreeSectionLoftOptions; surface: Surface; source: string; sourceVersion: 0; model: Model;
  provenance: ThreeSectionLoftProvenance; report: ThreeSectionLoftReport;
}

const CODE = ThreeSectionLoftDiagnosticCode, EPS = 64 * Number.EPSILON;
function check(condition: boolean, code: ThreeSectionLoftDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new ThreeSectionLoftError(code, detail);
}
function finite(value: number, detail: string, code: ThreeSectionLoftDiagnosticCode = CODE.REPRESENTABILITY): number {
  check(Number.isFinite(value), code, detail); return value;
}
function native<T>(action: () => T, detail: string, code: ThreeSectionLoftDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof ThreeSectionLoftError) throw cause;
    throw new ThreeSectionLoftError(code, detail + ': ' + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
  }
}
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT;
  let remaining = owned ? 524288 : 32768;
  const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= (owned ? 32 : 8), code, 'own-value/depth budget exceeded');
    if (value === null && owned) return null;
    if (typeof value === 'boolean' && owned) return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'finite own numbers required'); return value; }
    if (typeof value === 'string') { check(value.length <= (owned ? 262144 : 128), code, 'own string budget exceeded'); return value; }
    check(value !== null && typeof value === 'object', code, 'plain own data required');
    check(!ancestors.has(value), code, 'cyclic own data refused');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null,
      code, 'foreign own-data prototype refused');
    const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.length <= (array ? (owned ? 4097 : 129) : (owned ? 64 : 16)), code, 'own field budget exceeded');
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'getter/symbol/hidden own data refused');
    ancestors.add(value);
    let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= (owned ? 4096 : 128)
        && keys.length === length + 1, code, 'dense bounded own arrays required');
      result = Array.from({ length }, (_, index) => {
        check(Object.hasOwn(descriptors, String(index)), code, 'sparse/extra own array field refused');
        return copy(descriptors[String(index)].value, depth + 1);
      });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  };
  return native(() => copy(input, 0), 'own data snapshot', code);
}
function record(value: unknown, fields: string[], code: ThreeSectionLoftDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'own record required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    code, 'exact fields required: ' + fields.join(',')); return data;
}
function id(value: unknown): string {
  check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),
    CODE.IDENTITY, 'ASCII section/Surface ID1..48 required'); return value;
}
function section(input: Curve): Curve {
  const curve = record(snapshot(input), ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']) as unknown as Curve;
  id(curve.id);
  check(curve.kind === 'curve' && Number.isInteger(curve.degree) && curve.degree >= 1 && curve.degree <= 3
    && Array.isArray(curve.controlPoints) && curve.controlPoints.length >= 2 && curve.controlPoints.length <= 16,
    CODE.INPUT, 'positive clamped degree1..3 section with2..16 poles required');
  native(() => validateCurve(curve), 'actual native section admission', CODE.INPUT);
  check(curve.controlPoints.every(point => point.every(value => Math.abs(value) <= 10000)), CODE.INPUT, 'section XYZ±10000mm required');
  const domain = curveDomain(curve);
  check(Number.isFinite(domain[1] - domain[0]) && domain[1] > domain[0], CODE.REPRESENTABILITY, 'finite positive original U domain span required');
  return curve;
}
function homogeneous(curve: Curve, index: number): Homogeneous {
  const weight = curve.weights[index];
  return [finite(weight * curve.controlPoints[index][0], 'section homogeneous X overflow'),
    finite(weight * curve.controlPoints[index][1], 'section homogeneous Y overflow'),
    finite(weight * curve.controlPoints[index][2], 'section homogeneous Z overflow'), weight];
}
function curveD1(curve: Curve, u: number): ThreeSectionLoftD1Observation['original'] {
  try { return { status: 'evaluated', value: evaluateCurveD1(curve, u) }; } catch (cause) {
    check(cause instanceof Error, CODE.NATIVE, 'actual Curve D1 Error required');
    return { status: 'native-refused', reason: cause.message.slice(0, 1024) };
  }
}
function surfaceD1(surface: Surface, u: number, v: number): ThreeSectionLoftD1Observation['surface'] {
  try { return { status: 'evaluated', value: evaluateSurfaceD1(surface, u, v) }; } catch (cause) {
    check(cause instanceof Error, CODE.NATIVE, 'actual Surface D1 Error required');
    return { status: 'native-refused', reason: cause.message.slice(0, 1024) };
  }
}

/** Interpolate three compatible native sections at V=0,.5,1 in homogeneous coefficients. */
export function buildThreeSectionLoftSurface(firstInput: Curve, middleInput: Curve, lastInput: Curve,
  inputOptions: ThreeSectionLoftOptions): ThreeSectionLoftResult {
  const sections: [Curve, Curve, Curve] = [section(firstInput), section(middleInput), section(lastInput)];
  const o = record(snapshot(inputOptions), ['surfaceId']), options: ThreeSectionLoftOptions = { surfaceId: id(o.surfaceId) };
  const sectionIds: [string, string, string] = [sections[0].id, sections[1].id, sections[2].id];
  check(new Set([...sectionIds, options.surfaceId]).size === 4, CODE.IDENTITY, 'three authored section IDs and derived Surface ID must differ');
  const first = sections[0], middle = sections[1], last = sections[2], domain = curveDomain(first);
  check(sections.every(curve => Object.is(curve.degree, first.degree) && curve.controlPoints.length === first.controlPoints.length
    && same(curve.knots, first.knots) && same(curveDomain(curve), domain)), CODE.BASIS, 'all three original degree/count/knot/domain basis bits must match');
  const controlPoints: Point[][] = [], weights: number[][] = [], rows: ThreeSectionLoftProvenance['rows'] = [];
  for (let poleIndex = 0; poleIndex < first.controlPoints.length; poleIndex++) {
    const Hfirst = homogeneous(first, poleIndex), Hmiddle = homogeneous(middle, poleIndex), Hlast = homogeneous(last, poleIndex);
    const doubledMiddle = Hmiddle.map(value => finite(2 * value, 'doubled middle homogeneous coefficient overflow')) as Homogeneous;
    const averagedEndpoints = Hfirst.map((value, axis) => finite(.5 * finite(value + Hlast[axis], 'endpoint homogeneous sum overflow'),
      'averaged endpoint homogeneous coefficient overflow')) as Homogeneous;
    const generatedHmiddle = doubledMiddle.map((value, axis) => finite(value - averagedEndpoints[axis], 'generated middle homogeneous difference overflow')) as Homogeneous;
    const weightContributingMagnitude = finite(Math.abs(doubledMiddle[3]) + Math.abs(averagedEndpoints[3]), 'absolute weight contribution sum overflow');
    const weightCancellationMargin = finite(EPS * weightContributingMagnitude, 'weight cancellation margin overflow'), generatedWeight = generatedHmiddle[3];
    check(generatedWeight > 0 && generatedWeight > weightCancellationMargin, CODE.REPRESENTABILITY, 'generated middle weight is nonpositive or cancellation-uncertain');
    check(generatedWeight >= 1e-6 && generatedWeight <= 1e6, CODE.REPRESENTABILITY, 'generated middle weight outside native positive bounds');
    const generatedPoint = generatedHmiddle.slice(0, 3).map(value => finite(value / generatedWeight, 'generated middle Cartesian projection overflow')) as Point;
    check(generatedPoint.every(value => Math.abs(value) <= 10000), CODE.REPRESENTABILITY, 'generated middle Cartesian pole outside XYZ±10000mm');
    const points: Point[] = [copyCadData(first.controlPoints[poleIndex]), generatedPoint, copyCadData(last.controlPoints[poleIndex])];
    const rowWeights = [first.weights[poleIndex], generatedWeight, last.weights[poleIndex]];
    controlPoints.push(points); weights.push(rowWeights);
    const poleMappings: ThreeSectionLoftProvenance['rows'][number]['poleMappings'] = [0, 1, 2].map((v): ThreeSectionLoftProvenance['rows'][number]['poleMappings'][number] => ({
      surfacePole: [poleIndex, v], origin: v === 1 ? 'generated-homogeneous' : 'section-bit-copy', sectionIndex: v === 1 ? null : v,
      sectionPoleIndex: v === 1 ? null : poleIndex, sourceSectionIndices: v === 1 ? [0, 1, 2] : [v], pointMM: points[v],
    }));
    const weightMappings: ThreeSectionLoftProvenance['rows'][number]['weightMappings'] = [0, 1, 2].map((v): ThreeSectionLoftProvenance['rows'][number]['weightMappings'][number] => ({
      surfacePole: [poleIndex, v], origin: v === 1 ? 'generated-homogeneous' : 'section-bit-copy', sectionIndex: v === 1 ? null : v,
      sectionPoleIndex: v === 1 ? null : poleIndex, sourceSectionIndices: v === 1 ? [0, 1, 2] : [v], weight: rowWeights[v],
    }));
    rows.push({ poleIndex, sectionPoleIndices: [poleIndex, poleIndex, poleIndex], Hfirst, Hmiddle, Hlast,
      doubledMiddle, averagedEndpoints, generatedHmiddle, weightContributingMagnitude, weightCancellationMargin, poleMappings, weightMappings });
  }
  const surface: Surface = { kind: 'surface', id: options.surfaceId, degreeU: first.degree, degreeV: 2,
    knotsU: copyCadData(first.knots), knotsV: [0, 0, 0, 1, 1, 1], controlPoints, weights };
  native(() => validateSurface(surface), 'actual generated native loft Surface admission');
  check(same(surface.knotsU, first.knots) && same(surfaceDomain(surface).u, domain), CODE.BINDING, 'copied original U knot/domain bits changed');
  for (let i = 0; i < first.controlPoints.length; i++) check(same(surface.controlPoints[i][0], first.controlPoints[i])
    && same(surface.controlPoints[i][2], last.controlPoints[i]) && Object.is(surface.weights[i][0], first.weights[i])
    && Object.is(surface.weights[i][2], last.weights[i]), CODE.BINDING, 'endpoint section control/weight bits must be direct copies');
  const expectedModel: Model = { name: options.surfaceId, version: 0, lengthUnit: 'mm', objects: [...sections, surface] };
  const file = native(() => adopt(expectedModel), 'actual four-object original-section/Surface Source0 adoption');
  check(file.source.length <= 262144, CODE.BUDGET, 'actual four-object source string budget exceeded');
  check(same(file.model, expectedModel), CODE.BINDING, 'actual Source0 must preserve all four object IDs/order/coefficient/domain/sign bits');
  const adoptedSections: [Curve, Curve, Curve] = [file.model.objects[0] as Curve, file.model.objects[1] as Curve, file.model.objects[2] as Curve];
  const adoptedSurface = file.model.objects[3] as Surface;
  const breaks: number[] = [domain[0]];
  for (const knot of first.knots) if (knot > domain[0] && knot < domain[1] && !breaks.some(value => value === knot)) breaks.push(knot);
  breaks.push(domain[1]);
  const parameters: number[] = [], unrepresentedMidpointIntervals: ThreeSectionLoftReport['unrepresentedMidpointIntervals'] = [];
  for (let i = 0; i < breaks.length; i++) {
    parameters.push(breaks[i]);
    if (i + 1 < breaks.length) {
      const width = finite(breaks[i + 1] - breaks[i], 'original U span width overflow'), candidate = finite(breaks[i] + width / 2, 'original U midpoint overflow');
      if (candidate > breaks[i] && candidate < breaks[i + 1]) parameters.push(candidate);
      else unrepresentedMidpointIntervals.push({ domain: [breaks[i], breaks[i + 1]], attemptedParameter: candidate });
    }
  }
  check(parameters.length * 3 <= 96, CODE.BUDGET, 'native interpolation observation capacity exceeded');
  const observations: ThreeSectionLoftObservation[] = [], derivativeObservations: ThreeSectionLoftD1Observation[] = [];
  const sectionParameters: [0, .5, 1] = [0, .5, 1];
  for (const u of parameters) for (let sectionIndex = 0; sectionIndex < 3; sectionIndex++) {
    const v = sectionParameters[sectionIndex], curve = adoptedSections[sectionIndex];
    const expectedPointMM = native(() => evaluateCurve(curve, u), 'actual original section point');
    const actualPointMM = native(() => evaluateSurface(adoptedSurface, u, v), 'actual loft Surface interpolation point');
    const differenceMM = finite(Math.hypot(...actualPointMM.map((value, axis) => finite(value - expectedPointMM[axis], 'native point comparison subtraction overflow', CODE.BINDING))),
      'native point comparison norm overflow', CODE.BINDING);
    check(differenceMM <= 1e-7, CODE.BINDING, 'actual native section interpolation exceeds1e-7mm');
    observations.push({ u, v, sectionIndex, expectedPointMM, actualPointMM, differenceMM });
    const original = curveD1(curve, u), evaluatedSurface = surfaceD1(adoptedSurface, u, v);
    let relativeDuDifference: number | null = null;
    if (original.status === 'evaluated' && evaluatedSurface.status === 'evaluated') {
      const norm = finite(Math.hypot(...original.value.derivative), 'original derivative norm overflow', CODE.BINDING);
      const difference = finite(Math.hypot(...evaluatedSurface.value.du.map((value, axis) => finite(value - original.value.derivative[axis],
        'native Du comparison subtraction overflow', CODE.BINDING))), 'native Du difference norm overflow', CODE.BINDING);
      relativeDuDifference = finite(difference / Math.max(1, norm), 'relative native Du comparison overflow', CODE.BINDING);
      check(relativeDuDifference <= 1e-7, CODE.BINDING, 'actual native Surface Du interpolation exceedsrelative1e-7');
    }
    derivativeObservations.push({ u, v, sectionIndex, original, surface: evaluatedSurface, relativeDuDifference });
  }
  const guardedParameters = breaks.slice(1, -1).filter(u => first.knots.filter(knot => knot === u).length >= first.degree);
  const comparisons = derivativeObservations.filter(observation => observation.relativeDuDifference !== null);
  const provenance: ThreeSectionLoftProvenance = { kind: 'three-section-homogeneous-loft', surfaceId: options.surfaceId, sectionIds,
    sectionParameters, middleFormula: 'H1=2*Hmiddle-0.5*(Hfirst+Hlast)', rows,
    uKnotMappings: first.knots.map((value, index): ThreeSectionLoftProvenance['uKnotMappings'][number] => ({ sectionKnotIndex: index, surfaceKnotIndex: index,
      sectionValues: [value, middle.knots[index], last.knots[index]], surfaceValue: adoptedSurface.knotsU[index], origin: 'common-basis-bit-copy' })) };
  const report: ThreeSectionLoftReport = {
    kind: 'three-section-loft-surface',
    dto: { schema: 'barocss-native-three-section-loft', version: 0, lengthUnit: 'mm', frame: 'authored-xyz-no-axis-conversion',
      representation: 'native-three-section-surface-not-brep-or-solid' },
    surfaceId: options.surfaceId, sectionIds, degreeU: adoptedSurface.degreeU, degreeV: 2, controlPointGrid: [first.controlPoints.length, 3],
    domains: { u: domain, v: [0, 1] }, sectionParameters, originalSpanCount: breaks.length - 1,
    observationCount: observations.length, derivativeObservationCount: derivativeObservations.length, observations, derivativeObservations,
    guardedParameters, derivativeComparisonCount: comparisons.length, derivativeRefusalCount: derivativeObservations.length - comparisons.length,
    asymmetricDerivativeRefusalCount: derivativeObservations.filter(observation => observation.original.status !== observation.surface.status).length,
    maximumPointDifferenceMM: Math.max(...observations.map(observation => observation.differenceMM)),
    maximumRelativeDuDifference: comparisons.length ? Math.max(...comparisons.map(observation => observation.relativeDuDifference!)) : null,
    unrepresentedMidpointIntervals, authority: 'original-three-section-homogeneous-coefficients', geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    quality: { pointComparisonMM: 1e-7, relativeDuComparison: 1e-7, localObservationsOnly: true, endpointControlAndWeightBitsPreserved: true,
      commonUKnotDomainBitsPreserved: true, middleInterpolation: 'actual-homogeneous-section-interpolation-at-v-half',
      betweenSections: 'homogeneous-weight-dependent-not-naive-cartesian-interpolation', sectionWeightScalingInvarianceCertified: false,
      generatedWeightPolicy: 'positive-native-weight-above64-epsilon-absolute-contributing-terms', nativeD1Refusals: 'actual-original-and-surface-states-no-inferred-equality',
      globalShapeErrorCertified: false, globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, g1g2Certified: false,
      sourceText: 'regenerated-from-supplied-native-geometry-not-original-file-formatting', ownership: 'copied-cpu-data-gc-no-renderer-resources' },
    budgetFailure: 'atomic-refusal-no-partial-result',
    limits: { maximumSectionDegree: 3, maximumSectionPoles: 16, maximumSurfacePoles: 48, maximumPointObservations: 96,
      maximumDerivativeObservations: 96, authoredIdCharacters: 48, coordinateAbsMM: 10000, weightRange: [1e-6, 1e6],
      inputValues: 32768, inputDepth: 8, inputArrayElements: 128, inputRecordFields: 16, inputStringCharacters: 128,
      snapshotValues: 524288, snapshotDepth: 32, arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144 },
  };
  return snapshot({ sections: adoptedSections, options, surface: adoptedSurface, source: file.source, sourceVersion: 0, model: file.model,
    provenance, report }, true) as ThreeSectionLoftResult;
}
/** Rebuild all original/generated coefficient lineage, four-object sources and native observations. */
export function validateThreeSectionLoftSurface(input: ThreeSectionLoftResult): ThreeSectionLoftReport {
  const owned = snapshot(input, true) as ThreeSectionLoftResult;
  record(owned, ['sections', 'options', 'surface', 'source', 'sourceVersion', 'model', 'provenance', 'report'], CODE.OWNED);
  check(Array.isArray(owned.sections) && owned.sections.length === 3, CODE.OWNED, 'owned exactly-three-section tuple required');
  let expected: ThreeSectionLoftResult;
  try { expected = buildThreeSectionLoftSurface(owned.sections[0], owned.sections[1], owned.sections[2], owned.options); } catch (cause) {
    throw new ThreeSectionLoftError(CODE.OWNED, 'owned three sections/options complete loft rebuild refused', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'owned sections/Surface/source/model/homogeneous lineage/point/D1/guards/report mismatch');
  return copyCadData(expected.report);
}
