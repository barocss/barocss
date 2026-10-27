import { compileCadModel } from '../../model-compiler.js';
import { curveDomain } from '../../core/math.js';
import { evaluateCurveCurvature, NativeCurvatureError } from '../surfaces/local-curvature.js';
import type { CurveCurvatureResult } from '../surfaces/local-curvature.js';
import { copyCadData } from '../../data-copy.js';
import type { Curve, Model, Point } from '../../types.js';
import { same } from '../../core/structural-equality.js';
import { KernelError } from '../../core/barocss-error.js';

export const CurveEndpointContinuityDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', SOURCE: 'SOURCE', BINDING: 'BINDING', NATIVE: 'NATIVE',
  REGULARITY: 'REGULARITY', ARITHMETIC: 'ARITHMETIC', OWNED: 'OWNED',
} as const);
export type CurveEndpointContinuityDiagnosticCode = typeof CurveEndpointContinuityDiagnosticCode[keyof typeof CurveEndpointContinuityDiagnosticCode];
export class CurveEndpointContinuityError extends KernelError {
  readonly code: CurveEndpointContinuityDiagnosticCode;
  constructor(code: CurveEndpointContinuityDiagnosticCode, detail: string, cause?: unknown) {
    super(('Curve endpoint continuity: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'CurveEndpointContinuityError'; this.code = code;
  }
}
export interface CurveEndpointContinuityInput { sourceId: string; source: string; curve: Curve; endpoint: 'start' | 'end' }
export interface CurveEndpointContinuityOptions { evaluationId: string; maximumCurvatureEvaluations: number }
type EndpointReference = { sourceId: string; modelName: string; curveId: string; endpoint: 'start' | 'end'; parameter: number;
  domain: [number, number]; traversal: 'incoming' | 'outgoing'; derivativeFactor: 1 | -1 };
type Analysis = {
  pointDifferenceMM: number; firstDerivativeRelativeDifference: number; secondDerivativeRelativeDifference: number;
  unitTangentDifference: number; unitTangentDot: number; curvatureVectorRelativeDifference: number;
  c0: boolean; c1: boolean; c2: boolean; g1: boolean; g2: boolean;
  incomingDerivativeMMPerParameter: Point; outgoingDerivativeMMPerParameter: Point; incomingUnitTangent: Point; outgoingUnitTangent: Point;
};
export interface CurveEndpointContinuityReport {
  schema: 'barocss-curve-endpoint-continuity'; version: 0; evaluationId: string; lengthUnit: 'mm'; curvatureUnit: '1/mm';
  derivativeUnits: 'original-native-parameter-units'; sourceFrame: 'authored-xyz-no-axis-conversion';
  firstReference: EndpointReference; secondReference: EndpointReference; sourceCompilationCount: 2; curvatureEvaluationCount: 2;
  numericPolicy: { pointToleranceMM: 1e-7; derivativeRelativeTolerance: 1e-7; secondDerivativeRelativeTolerance: 1e-7;
    unitTangentTolerance: 1e-7; curvatureVectorRelativeTolerance: 1e-7;
    jetRelativeDenominator: 'max-one-and-both-original-vector-norms'; curvatureRelativeDenominator: 'max-one-inverse-mm-and-both-curvature-vector-norms';
    g1Dot: 'strictly-positive-no-clamp'; traversal: 'incoming-end-positive-start-negative-outgoing-start-positive-end-negative';
    evenOrder: 'second-derivative-and-curvature-vector-unchanged'; workCounts: 'direct-source-compile-and-curvature-calls-internal-d2-d1-excluded' };
  quality: { originalSourcesAndGeometryBitsPreserved: true; localObservedEndpointConditionsOnly: true; formalJoinedCurveContinuityUpgraded: false;
    weldedGeometryCreated: false; topologyCertified: false; solid: false; globalG2Certified: false; supportRegularityCertified: false;
    manufacturingToleranceCertified: false; globalBinary64ErrorCertified: false; ownership: 'independent-copied-cpu-data-gc' };
  budgetFailure: 'complete-two-curvature-budget-before-source-or-native-child-work-atomic-no-partial-analysis';
  limits: { maximumCurveDegree: 5; maximumCurvePoles: 64; maximumKnots: 70; maximumCurvatureEvaluations: 2;
    coordinateAndKnotAbs: 10000; nativePositiveWeights: [0.000001, 1000000]; sourceModelObjects: 1; authoredIdCharacters: 48;
    inputValues: 16384; inputDepth: 12; inputArrayElements: 256; inputRecordFields: 16;
    ownedValues: 262144; ownedDepth: 32; ownedArrayElements: 1024; ownedRecordFields: 64; sourceStringCharacters: 262144 };
}
export interface CurveEndpointContinuityResult {
  first: CurveEndpointContinuityInput; second: CurveEndpointContinuityInput; options: CurveEndpointContinuityOptions;
  models: [Model, Model]; native: [CurveCurvatureResult, CurveCurvatureResult]; analysis: Analysis; report: CurveEndpointContinuityReport;
}

const CODE = CurveEndpointContinuityDiagnosticCode;
function check(condition: boolean, code: CurveEndpointContinuityDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new CurveEndpointContinuityError(code, detail);
}
function finite(value: number): number { check(Number.isFinite(value), CODE.ARITHMETIC, 'Finite diagnostic IEEE arithmetic is required'); return value; }
function norm(vector: Point): number { return finite(Math.hypot(...vector)); }
function difference(a: Point, b: Point): number { return norm(a.map((value, axis) => finite(value - b[axis])) as Point); }
function relative(a: Point, b: Point): number { return finite(difference(a, b) / Math.max(1, norm(a), norm(b))); }
function dot(a: Point, b: Point): number {
  return a.reduce((total, value, axis) => finite(total + finite(value * b[axis])), 0);
}
function snapshot(input: unknown, owned = false): unknown {
  const code = owned ? CODE.OWNED : CODE.INPUT; let remaining = owned ? 262144 : 16384; const ancestors = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= (owned ? 32 : 12), code, 'Own value or depth limit exceeded');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), code, 'Finite own numbers are required'); return value; }
    if (typeof value === 'string') { check(value.length <= 262144, code, 'Own source string limit exceeded'); return value; }
    check(typeof value === 'object' && !ancestors.has(value), code, 'Acyclic plain own data is required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, code, 'Plain own-data prototypes are required');
    check(keys.length <= (array ? (owned ? 1025 : 257) : (owned ? 64 : 16)), code, 'Own field limit exceeded');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key]
      && (array && key === 'length' || descriptors[key].enumerable === true)), code, 'Getter, symbol, or hidden fields are refused');
    ancestors.add(value); let result: unknown;
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= (owned ? 1024 : 256) && keys.length === length + 1, code, 'Dense bounded own arrays are required');
      result = Array.from({ length }, (_, index) => { check(Object.hasOwn(descriptors, String(index)), code, 'Sparse or extra own array fields are refused'); return copy(descriptors[String(index)].value, depth + 1); });
    } else result = Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
    ancestors.delete(value); return result;
  };
  try { return copy(input, 0); } catch (cause) {
    if (cause instanceof CurveEndpointContinuityError) throw cause; throw new CurveEndpointContinuityError(code, 'Own-data snapshot failed', cause);
  }
}
function record(value: unknown, fields: string[], code: CurveEndpointContinuityDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'An own record is required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)), code, 'Exact own fields are required'); return data;
}
function id(value: unknown): string {
  check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), CODE.IDENTITY, 'ASCII qualified endpoint ID1..48 required'); return value;
}
function admitInput(value: unknown): CurveEndpointContinuityInput {
  const data = record(value, ['sourceId', 'source', 'curve', 'endpoint']), curve = record(data.curve, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']) as unknown as Curve;
  id(data.sourceId); id(curve.id);
  check(typeof data.source === 'string', CODE.INPUT, 'The complete original source string is required');
  check(data.endpoint === 'start' || data.endpoint === 'end', CODE.INPUT, 'An actual original start or end selector is required');
  check(curve.kind === 'curve' && Number.isInteger(curve.degree) && curve.degree >= 1 && curve.degree <= 5,
    CODE.INPUT, 'A native degree1..5 Curve is required');
  check(Array.isArray(curve.controlPoints) && curve.controlPoints.length >= 2 && curve.controlPoints.length <= 64
    && curve.controlPoints.every(point => Array.isArray(point) && point.length === 3 && point.every(component => typeof component === 'number' && Math.abs(component) <= 10000)),
    CODE.INPUT, 'Original2..64 poles with XYZ within10000 are required');
  check(Array.isArray(curve.knots) && curve.knots.length <= 70 && curve.knots.every(knot => typeof knot === 'number' && Math.abs(knot) <= 10000),
    CODE.INPUT, 'Original finite native knots within10000 are required');
  check(Array.isArray(curve.weights) && curve.weights.length === curve.controlPoints.length && curve.weights.every(weight => typeof weight === 'number' && weight >= 1e-6 && weight <= 1e6),
    CODE.INPUT, 'Original positive native weights in1e-6..1e6 are required');
  return data as unknown as CurveEndpointContinuityInput;
}

/** Compare observed regular one-sided endpoint jets; this does not create or repair a joined Curve. */
export function inspectCurveEndpointContinuity(firstInput: CurveEndpointContinuityInput, secondInput: CurveEndpointContinuityInput,
  optionsInput: CurveEndpointContinuityOptions): CurveEndpointContinuityResult {
  const firstData = snapshot(firstInput), secondData = snapshot(secondInput), settings = record(snapshot(optionsInput), ['evaluationId', 'maximumCurvatureEvaluations']);
  const evaluationId = id(settings.evaluationId);
  check(typeof settings.maximumCurvatureEvaluations === 'number' && Number.isInteger(settings.maximumCurvatureEvaluations)
    && settings.maximumCurvatureEvaluations >= 0 && settings.maximumCurvatureEvaluations <= 2, CODE.BUDGET, 'An integer curvature budget in0..2 is required');
  check(settings.maximumCurvatureEvaluations >= 2, CODE.BUDGET, 'Complete two-endpoint curvature work must be admitted before source compilation');
  const options: CurveEndpointContinuityOptions = { evaluationId, maximumCurvatureEvaluations: settings.maximumCurvatureEvaluations };
  const first = admitInput(firstData), second = admitInput(secondData);
  check(first.sourceId !== second.sourceId, CODE.IDENTITY, 'Two distinct qualified source contexts are required');
  let sourceCompilationCount = 0, curvatureEvaluationCount = 0;
  const models = [first, second].map(input => {
    let compiled: ReturnType<typeof compileCadModel>;
    try { compiled = compileCadModel(input.source, { sourceVersion: 0 }); } catch (cause) { throw new CurveEndpointContinuityError(CODE.SOURCE, 'Actual Source0 compilation failed for ' + input.sourceId, cause); }
    sourceCompilationCount++;
    if (!compiled.ok) throw new CurveEndpointContinuityError(CODE.SOURCE, 'Actual Source0 compiler refused ' + input.sourceId, compiled);
    check(compiled.model.version === 0 && compiled.model.lengthUnit === 'mm' && compiled.model.objects.length === 1 && compiled.model.objects[0].kind === 'curve',
      CODE.SOURCE, 'Each source must prove exactly one original native Model0/mm Curve');
    check(same(compiled.model.objects[0], input.curve), CODE.BINDING, 'Whole source Curve ID, degree, knot, pole, weight, order or sign bits differ from authored input');
    return compiled.model;
  }) as [Model, Model];
  const references = [first, second].map((input, index): EndpointReference => {
    const curve = models[index].objects[0] as Curve, domain = curveDomain(curve), parameter = domain[input.endpoint === 'start' ? 0 : 1];
    return { sourceId: input.sourceId, modelName: models[index].name, curveId: curve.id, endpoint: input.endpoint, parameter, domain,
      traversal: index === 0 ? 'incoming' : 'outgoing', derivativeFactor: index === 0 ? input.endpoint === 'end' ? 1 : -1 : input.endpoint === 'start' ? 1 : -1 };
  }) as [EndpointReference, EndpointReference];
  const nativeResults = references.map((reference, index) => {
    try {
      const value = evaluateCurveCurvature(models[index].objects[0] as Curve, reference.parameter); curvatureEvaluationCount++; return value;
    } catch (cause) {
      const code = cause instanceof NativeCurvatureError && cause.code === 'REGULARITY' ? CODE.REGULARITY : CODE.NATIVE;
      throw new CurveEndpointContinuityError(code, 'Actual regular endpoint curvature query failed for ' + reference.sourceId, cause);
    }
  }) as [CurveCurvatureResult, CurveCurvatureResult];
  const oriented = (vector: Point, factor: number): Point => vector.map(component => finite(component * factor)) as Point;
  const incomingDerivativeMMPerParameter = oriented(nativeResults[0].derivatives.derivative, references[0].derivativeFactor);
  const outgoingDerivativeMMPerParameter = oriented(nativeResults[1].derivatives.derivative, references[1].derivativeFactor);
  const incomingUnitTangent = oriented(nativeResults[0].unitTangent, references[0].derivativeFactor), outgoingUnitTangent = oriented(nativeResults[1].unitTangent, references[1].derivativeFactor);
  const pointDifferenceMM = difference(nativeResults[0].derivatives.point, nativeResults[1].derivatives.point);
  const firstDerivativeRelativeDifference = relative(incomingDerivativeMMPerParameter, outgoingDerivativeMMPerParameter);
  const secondDerivativeRelativeDifference = relative(nativeResults[0].derivatives.secondDerivative, nativeResults[1].derivatives.secondDerivative);
  const unitTangentDifference = difference(incomingUnitTangent, outgoingUnitTangent), unitTangentDot = dot(incomingUnitTangent, outgoingUnitTangent);
  const curvatureVectorRelativeDifference = relative(nativeResults[0].curvatureVectorPer, nativeResults[1].curvatureVectorPer);
  const c0 = pointDifferenceMM <= 1e-7, c1 = c0 && firstDerivativeRelativeDifference <= 1e-7, c2 = c1 && secondDerivativeRelativeDifference <= 1e-7;
  const g1 = c0 && unitTangentDifference <= 1e-7 && unitTangentDot > 0, g2 = g1 && curvatureVectorRelativeDifference <= 1e-7;
  const analysis: Analysis = { pointDifferenceMM, firstDerivativeRelativeDifference, secondDerivativeRelativeDifference, unitTangentDifference, unitTangentDot,
    curvatureVectorRelativeDifference, c0, c1, c2, g1, g2, incomingDerivativeMMPerParameter, outgoingDerivativeMMPerParameter, incomingUnitTangent, outgoingUnitTangent };
  check(sourceCompilationCount === 2 && curvatureEvaluationCount === 2, CODE.BINDING, 'Exactly two actual source compilations and curvature evaluations are required');
  const report: CurveEndpointContinuityReport = { schema: 'barocss-curve-endpoint-continuity', version: 0, evaluationId,
    lengthUnit: 'mm', curvatureUnit: '1/mm', derivativeUnits: 'original-native-parameter-units', sourceFrame: 'authored-xyz-no-axis-conversion',
    firstReference: references[0], secondReference: references[1], sourceCompilationCount: 2, curvatureEvaluationCount: 2,
    numericPolicy: { pointToleranceMM: 1e-7, derivativeRelativeTolerance: 1e-7, secondDerivativeRelativeTolerance: 1e-7,
      unitTangentTolerance: 1e-7, curvatureVectorRelativeTolerance: 1e-7, jetRelativeDenominator: 'max-one-and-both-original-vector-norms',
      curvatureRelativeDenominator: 'max-one-inverse-mm-and-both-curvature-vector-norms', g1Dot: 'strictly-positive-no-clamp',
      traversal: 'incoming-end-positive-start-negative-outgoing-start-positive-end-negative', evenOrder: 'second-derivative-and-curvature-vector-unchanged',
      workCounts: 'direct-source-compile-and-curvature-calls-internal-d2-d1-excluded' },
    quality: { originalSourcesAndGeometryBitsPreserved: true, localObservedEndpointConditionsOnly: true, formalJoinedCurveContinuityUpgraded: false,
      weldedGeometryCreated: false, topologyCertified: false, solid: false, globalG2Certified: false, supportRegularityCertified: false,
      manufacturingToleranceCertified: false, globalBinary64ErrorCertified: false, ownership: 'independent-copied-cpu-data-gc' },
    budgetFailure: 'complete-two-curvature-budget-before-source-or-native-child-work-atomic-no-partial-analysis',
    limits: { maximumCurveDegree: 5, maximumCurvePoles: 64, maximumKnots: 70, maximumCurvatureEvaluations: 2, coordinateAndKnotAbs: 10000,
      nativePositiveWeights: [1e-6, 1e6], sourceModelObjects: 1, authoredIdCharacters: 48, inputValues: 16384, inputDepth: 12, inputArrayElements: 256, inputRecordFields: 16,
      ownedValues: 262144, ownedDepth: 32, ownedArrayElements: 1024, ownedRecordFields: 64, sourceStringCharacters: 262144 } };
  return snapshot({ first, second, options, models, native: nativeResults, analysis, report }, true) as CurveEndpointContinuityResult;
}

/** Rebuild the complete source-qualified inspection once and bit-check original sources and actual endpoint data. */
export function validateCurveEndpointContinuity(input: CurveEndpointContinuityResult): CurveEndpointContinuityReport {
  const owned = record(snapshot(input, true), ['first', 'second', 'options', 'models', 'native', 'analysis', 'report'], CODE.OWNED) as unknown as CurveEndpointContinuityResult;
  let expected: CurveEndpointContinuityResult;
  try { expected = inspectCurveEndpointContinuity(owned.first, owned.second, owned.options); } catch (cause) { throw new CurveEndpointContinuityError(CODE.OWNED, 'Whole owned endpoint inspection rebuild failed', cause); }
  check(same(owned, expected), CODE.OWNED, 'Owned source, model, curvature, endpoint traversal, jet, analysis or counter bits changed'); return copyCadData(expected.report);
}
