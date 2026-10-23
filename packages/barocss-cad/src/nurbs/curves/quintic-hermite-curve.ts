import { compileCurveSource } from './curve-source.js';
import { evaluateCurveD2 } from '../../core/second-derivatives.js';
import type { CurveD2Result } from '../../core/second-derivatives.js';
import { copyCadData } from '../../data-copy.js';
import type { Curve, Model, Point } from '../../types.js';
import { same } from '../../core/structural-equality.js';

export const QuinticHermiteDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', REPRESENTABILITY: 'REPRESENTABILITY', NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
} as const);
export type QuinticHermiteDiagnosticCode = typeof QuinticHermiteDiagnosticCode[keyof typeof QuinticHermiteDiagnosticCode];
export class QuinticHermiteError extends Error {
  readonly code: QuinticHermiteDiagnosticCode;
  constructor(code: QuinticHermiteDiagnosticCode, detail: string, cause?: unknown) {
    super(('Quintic Hermite Curve: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'QuinticHermiteError'; this.code = code;
  }
}
export interface QuinticHermiteEndpoint {
  parameter: number; pointMM: Point; derivativeMMPerParameter: Point; secondDerivativeMMPerParameterSquared: Point;
}
export interface QuinticHermiteOptions { curveId: string; maximumEndpointEvaluations: number }
type PoleDerivation = { poleIndex: number; endpointIndex: number; basePointMM: Point; translationStepsMM: Point[]; pointMM: Point };
type EndpointObservation = { endpointIndex: number; parameter: number; authored: QuinticHermiteEndpoint; actual: CurveD2Result;
  pointDifferenceMM: number; derivativeDifferenceMMPerParameter: number; secondDerivativeDifferenceMMPerParameterSquared: number;
  derivativeRelativeDifference: number; secondDerivativeRelativeDifference: number;
  inputDerivativeNormMMPerParameter: number; inputSecondDerivativeNormMMPerParameterSquared: number };
export interface QuinticHermiteReport {
  schema: 'barocss-quintic-hermite-curve'; version: 0; curveId: string; lengthUnit: 'mm'; parameterFrame: 'original-native-knot-units';
  domain: [number, number]; span: number; firstDerivativeOffsetsMM: [Point, Point]; secondDerivativeOffsetsMM: [Point, Point];
  poleDerivation: PoleDerivation[]; observations: [EndpointObservation, EndpointObservation]; sourceAdoptionCount: 1; endpointEvaluationCount: 2; sourceModelName: string;
  numericPolicy: { firstOffset: '(h*T)/5'; secondOffset: '((h*Asecond)*h)/20';
    poles: 'P0=A,P1=A+d0,P2=(A+2d0)+s0,P3=(B-2d1)+s1,P4=B-d1,P5=B';
    arithmetic: 'finite-nonzero-products-quotients-and-each-nonzero-translated-offset-preserved';
    separateSpanSquaredRequired: false; interiorZeroSigns: 'disclosed-ieee-translation-arithmetic';
    pointToleranceMM: 1e-7; derivativeRelativeTolerance: 1e-7; secondDerivativeRelativeTolerance: 1e-7;
    relativeDenominator: 'max-one-and-authored-vector-norm'; nonzeroAuthoredDerivativeObservedZero: 'refused';
    evaluationCounts: 'two-direct-native-d2-calls-internal-native-d1-work-excluded' };
  quality: { authoredEndpointPointPoleBitsPreserved: true; authoredConstraintDataPreserved: true; actualEndpointResidualsMatched: true;
    geometricValidity: 'not-certified'; topologyCertified: false; solid: false; regularityCertified: false; scalarCurvatureConstraintsSolved: false;
    g2Certified: false; periodicSupported: false; multiSegmentContinuitySolved: false; globalShapeErrorCertified: false;
    globalBinary64ErrorCertified: false; manufacturingToleranceCertified: false; ownership: 'independent-copied-cpu-data-gc' };
  budgetFailure: 'complete-two-endpoint-budget-before-construction-atomic-no-partial-curve';
  limits: { degree: 5; poles: 6; weights: 'all-one'; maximumEndpointEvaluations: 2; parameterAndInputComponentAbs: 10000; generatedPoleAbsMM: 10000;
    inputValues: 1024; inputDepth: 8; inputArrayElements: 64; inputRecordFields: 16; inputStringCharacters: 128;
    ownedValues: 131072; ownedDepth: 24; ownedArrayElements: 1024; ownedRecordFields: 64; sourceStringCharacters: 262144; curveIdCharacters: 48 };
}
export interface QuinticHermiteResult {
  endpoints: [QuinticHermiteEndpoint, QuinticHermiteEndpoint]; options: QuinticHermiteOptions; curve: Curve;
  source: string; sourceVersion: 0; model: Model; report: QuinticHermiteReport;
}

const CODE = QuinticHermiteDiagnosticCode;
function check(condition: boolean, code: QuinticHermiteDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new QuinticHermiteError(code, detail);
}
function native<T>(action: () => T, detail: string): T {
  try { return action(); } catch (cause) { throw new QuinticHermiteError(CODE.NATIVE, detail, cause); }
}
function finite(value: number): number { check(Number.isFinite(value), CODE.REPRESENTABILITY, 'Finite endpoint pole arithmetic range exceeded'); return value; }
function product(a: number, b: number): number {
  const value = finite(a * b); check(a === 0 || b === 0 || value !== 0, CODE.REPRESENTABILITY, 'Nonzero endpoint offset product underflowed'); return value;
}
function quotient(a: number, b: number): number {
  check(Number.isFinite(b) && b !== 0, CODE.REPRESENTABILITY, 'A finite nonzero offset divisor is required');
  const value = finite(a / b); check(a === 0 || value !== 0, CODE.REPRESENTABILITY, 'Nonzero endpoint offset quotient underflowed'); return value;
}
function translated(origin: number, offset: number): number {
  const value = finite(origin + offset);
  check(offset === 0 || !Object.is(value, origin) && value !== origin, CODE.REPRESENTABILITY, 'A nonzero endpoint offset disappeared when added to a coordinate'); return value;
}
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT; let remaining = owned ? 131072 : 1024; const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= (owned ? 24 : 8), code, 'Own value or depth limit exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'Finite own numbers are required'); return value; }
    if (typeof value === 'string') { check(value.length <= (owned ? 262144 : 128), code, 'Own string limit exceeded'); return value; }
    check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic plain own data is required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Plain own-data prototypes are required');
    check(keys.length <= (array ? (owned ? 1025 : 65) : (owned ? 64 : 16)), code, 'Own field limit exceeded');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'Getter, symbol, or hidden fields are refused');
    ancestors.add(value); let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= (owned ? 1024 : 64) && keys.length === length + 1, code, 'Dense bounded own arrays are required');
      result = Array.from({ length }, (_, index) => { check(Object.hasOwn(descriptors, String(index)), code, 'Sparse or extra own array fields are refused'); return copy(descriptors[String(index)].value, depth + 1); });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  };
  try { return copy(input, 0); } catch (cause) {
    if (cause instanceof QuinticHermiteError) throw cause; throw new QuinticHermiteError(code, 'Own-data snapshot failed', cause);
  }
}
function record(value: unknown, fields: string[], code: QuinticHermiteDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'An own record is required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required'); return data;
}
function bounded(value: unknown): number {
  check(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000, CODE.INPUT, 'Finite endpoint parameters and vector components within10000 are required'); return value;
}
function vector(value: unknown): Point {
  check(Array.isArray(value) && value.length === 3, CODE.INPUT, 'An authored three-component endpoint vector is required'); return value.map(bounded) as Point;
}
function endpoint(value: unknown): QuinticHermiteEndpoint {
  const data = record(value, ['parameter', 'pointMM', 'derivativeMMPerParameter', 'secondDerivativeMMPerParameterSquared']);
  return { parameter: bounded(data.parameter), pointMM: vector(data.pointMM), derivativeMMPerParameter: vector(data.derivativeMMPerParameter),
    secondDerivativeMMPerParameterSquared: vector(data.secondDerivativeMMPerParameterSquared) };
}
function difference(a: Point, b: Point): number {
  const value = Math.hypot(...a.map((component, axis) => component - b[axis]));
  check(Number.isFinite(value), CODE.BINDING, 'Actual endpoint vector difference is not finite'); return value;
}

/** Degree5 polynomial interpolation of two complete endpoint D2 constraints in their original parameter units. */
export function buildQuinticHermiteCurve(endpointsInput: [QuinticHermiteEndpoint, QuinticHermiteEndpoint], optionsInput: QuinticHermiteOptions): QuinticHermiteResult {
  const copied = snapshot(endpointsInput); check(Array.isArray(copied) && copied.length === 2, CODE.INPUT, 'Exactly two ordered authored endpoints are required');
  const endpoints: [QuinticHermiteEndpoint, QuinticHermiteEndpoint] = [endpoint(copied[0]), endpoint(copied[1])];
  const settings = record(snapshot(optionsInput), ['curveId', 'maximumEndpointEvaluations']);
  check(typeof settings.curveId === 'string' && settings.curveId.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(settings.curveId), CODE.IDENTITY, 'ASCII Curve ID1..48 is required');
  check(typeof settings.maximumEndpointEvaluations === 'number' && Number.isInteger(settings.maximumEndpointEvaluations)
    && settings.maximumEndpointEvaluations >= 0 && settings.maximumEndpointEvaluations <= 2, CODE.BUDGET, 'An integer endpoint-evaluation budget in0..2 is required');
  check(settings.maximumEndpointEvaluations >= 2, CODE.BUDGET, 'Complete two-endpoint native D2 work must be admitted before construction');
  const options: QuinticHermiteOptions = { curveId: settings.curveId, maximumEndpointEvaluations: settings.maximumEndpointEvaluations };
  const domain: [number, number] = [endpoints[0].parameter, endpoints[1].parameter], span = finite(domain[1] - domain[0]);
  check(span > 0, CODE.REPRESENTABILITY, 'The original endpoint parameter domain must be strictly increasing');
  const firstDerivativeOffsetsMM = endpoints.map(value => value.derivativeMMPerParameter.map(component => quotient(product(span, component), 5)) as Point) as [Point, Point];
  // Scale the authored vector before the second span multiplication; no standalone h² factor is required.
  const secondDerivativeOffsetsMM = endpoints.map(value => value.secondDerivativeMMPerParameterSquared.map(component => quotient(product(product(span, component), span), 20)) as Point) as [Point, Point];
  const twiceFirst = firstDerivativeOffsetsMM.map(value => value.map(component => product(2, component)) as Point) as [Point, Point];
  const negate = (value: Point): Point => value.map(component => -component) as Point;
  const plans: { endpointIndex: number; steps: Point[] }[] = [
    { endpointIndex: 0, steps: [] }, { endpointIndex: 0, steps: [firstDerivativeOffsetsMM[0]] },
    { endpointIndex: 0, steps: [twiceFirst[0], secondDerivativeOffsetsMM[0]] },
    { endpointIndex: 1, steps: [negate(twiceFirst[1]), secondDerivativeOffsetsMM[1]] },
    { endpointIndex: 1, steps: [negate(firstDerivativeOffsetsMM[1])] }, { endpointIndex: 1, steps: [] },
  ];
  const poleDerivation: PoleDerivation[] = plans.map((plan, poleIndex) => {
    const basePointMM = endpoints[plan.endpointIndex].pointMM;
    let pointMM = copyCadData(basePointMM);
    for (const offset of plan.steps) pointMM = pointMM.map((component, axis) => translated(component, offset[axis])) as Point;
    check(pointMM.every(component => Math.abs(component) <= 10000), CODE.REPRESENTABILITY, 'A generated Hermite pole exceeds10000 mm');
    return { poleIndex, endpointIndex: plan.endpointIndex, basePointMM, translationStepsMM: plan.steps, pointMM };
  });
  const controlPoints = poleDerivation.map(value => value.pointMM), knots = [...Array<number>(6).fill(domain[0]), ...Array<number>(6).fill(domain[1])], weights = Array<number>(6).fill(1);
  const adopted = native(() => compileCurveSource(options.curveId, 5, controlPoints, knots, weights, 'Quintic Hermite Curve'), 'Actual native Source0 Curve adoption failed');
  const expected: Curve = { kind: 'curve', id: options.curveId, degree: 5, knots, controlPoints, weights };
  check(same(adopted.curve, expected) && same(adopted.model, { name: adopted.model.name, version: 0, lengthUnit: 'mm', objects: [expected] })
    && same(adopted.curve.controlPoints[0], endpoints[0].pointMM) && same(adopted.curve.controlPoints[5], endpoints[1].pointMM), CODE.BINDING, 'Actual source and native Curve must preserve complete generated coefficients and authored endpoint pole bits');
  let endpointEvaluationCount = 0;
  const observations = endpoints.map((authored, endpointIndex): EndpointObservation => {
    const actual = native(() => evaluateCurveD2(adopted.curve, authored.parameter), 'Actual native D2 failed at endpoint ' + endpointIndex); endpointEvaluationCount++;
    check(authored.derivativeMMPerParameter.every((component, axis) => component === 0 || actual.derivative[axis] !== 0)
      && authored.secondDerivativeMMPerParameterSquared.every((component, axis) => component === 0 || actual.secondDerivative[axis] !== 0),
    CODE.BINDING, 'An authored nonzero endpoint derivative component was silently returned as zero');
    const pointDifferenceMM = difference(actual.point, authored.pointMM), derivativeDifferenceMMPerParameter = difference(actual.derivative, authored.derivativeMMPerParameter);
    const secondDerivativeDifferenceMMPerParameterSquared = difference(actual.secondDerivative, authored.secondDerivativeMMPerParameterSquared);
    const inputDerivativeNormMMPerParameter = Math.hypot(...authored.derivativeMMPerParameter), inputSecondDerivativeNormMMPerParameterSquared = Math.hypot(...authored.secondDerivativeMMPerParameterSquared);
    const derivativeRelativeDifference = quotient(derivativeDifferenceMMPerParameter, Math.max(1, inputDerivativeNormMMPerParameter));
    const secondDerivativeRelativeDifference = quotient(secondDerivativeDifferenceMMPerParameterSquared, Math.max(1, inputSecondDerivativeNormMMPerParameterSquared));
    check(pointDifferenceMM <= 1e-7 && derivativeRelativeDifference <= 1e-7 && secondDerivativeRelativeDifference <= 1e-7,
      CODE.BINDING, 'Actual original-domain endpoint point/D1/D2 residual exceeds the declared local policy');
    return { endpointIndex, parameter: authored.parameter, authored, actual, pointDifferenceMM, derivativeDifferenceMMPerParameter,
      secondDerivativeDifferenceMMPerParameterSquared, derivativeRelativeDifference, secondDerivativeRelativeDifference,
      inputDerivativeNormMMPerParameter, inputSecondDerivativeNormMMPerParameterSquared };
  }) as [EndpointObservation, EndpointObservation];
  check(endpointEvaluationCount === 2, CODE.BINDING, 'Exactly two actual endpoint D2 calls are required');
  const report: QuinticHermiteReport = { schema: 'barocss-quintic-hermite-curve', version: 0, curveId: options.curveId, lengthUnit: 'mm', parameterFrame: 'original-native-knot-units',
    domain, span, firstDerivativeOffsetsMM, secondDerivativeOffsetsMM, poleDerivation, observations, sourceAdoptionCount: 1, endpointEvaluationCount: 2, sourceModelName: adopted.model.name,
    numericPolicy: { firstOffset: '(h*T)/5', secondOffset: '((h*Asecond)*h)/20', poles: 'P0=A,P1=A+d0,P2=(A+2d0)+s0,P3=(B-2d1)+s1,P4=B-d1,P5=B',
      arithmetic: 'finite-nonzero-products-quotients-and-each-nonzero-translated-offset-preserved', separateSpanSquaredRequired: false,
      interiorZeroSigns: 'disclosed-ieee-translation-arithmetic', pointToleranceMM: 1e-7, derivativeRelativeTolerance: 1e-7, secondDerivativeRelativeTolerance: 1e-7,
      relativeDenominator: 'max-one-and-authored-vector-norm', nonzeroAuthoredDerivativeObservedZero: 'refused', evaluationCounts: 'two-direct-native-d2-calls-internal-native-d1-work-excluded' },
    quality: { authoredEndpointPointPoleBitsPreserved: true, authoredConstraintDataPreserved: true, actualEndpointResidualsMatched: true,
      geometricValidity: 'not-certified', topologyCertified: false, solid: false, regularityCertified: false, scalarCurvatureConstraintsSolved: false,
      g2Certified: false, periodicSupported: false, multiSegmentContinuitySolved: false, globalShapeErrorCertified: false,
      globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, ownership: 'independent-copied-cpu-data-gc' },
    budgetFailure: 'complete-two-endpoint-budget-before-construction-atomic-no-partial-curve',
    limits: { degree: 5, poles: 6, weights: 'all-one', maximumEndpointEvaluations: 2, parameterAndInputComponentAbs: 10000, generatedPoleAbsMM: 10000,
      inputValues: 1024, inputDepth: 8, inputArrayElements: 64, inputRecordFields: 16, inputStringCharacters: 128,
      ownedValues: 131072, ownedDepth: 24, ownedArrayElements: 1024, ownedRecordFields: 64, sourceStringCharacters: 262144, curveIdCharacters: 48 } };
  return snapshot({ endpoints, options, curve: adopted.curve, source: adopted.source, sourceVersion: 0, model: adopted.model, report }, true) as QuinticHermiteResult;
}

/** Rebuild the full endpoint constructor and bit-check authored constraints, source, derivation and native observations. */
export function validateQuinticHermiteCurve(input: QuinticHermiteResult): QuinticHermiteReport {
  const owned = record(snapshot(input, true), ['endpoints', 'options', 'curve', 'source', 'sourceVersion', 'model', 'report'], CODE.OWNED) as unknown as QuinticHermiteResult;
  let expected: QuinticHermiteResult;
  try { expected = buildQuinticHermiteCurve(owned.endpoints, owned.options); } catch (cause) { throw new QuinticHermiteError(CODE.OWNED, 'Whole owned endpoint construction rebuild failed', cause); }
  check(same(owned, expected), CODE.OWNED, 'Owned constraints, source, model, offsets, poles, observations or call counts changed');
  return copyCadData(expected.report);
}
