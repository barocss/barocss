import { reverseCurveGeometryTrusted, CurveReversalError } from './curve-reversal.js';
import type { CurveReversalOptions, CurveReversalProvenance, CurveReversalObservation, CurveReversalGuardObservation } from './curve-reversal.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Model } from './types.js';

export const WideCurveReversalDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', DOMAIN: 'DOMAIN', REPRESENTABILITY: 'REPRESENTABILITY',
  BUDGET: 'BUDGET', NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
} as const);
export type WideCurveReversalDiagnosticCode = typeof WideCurveReversalDiagnosticCode[keyof typeof WideCurveReversalDiagnosticCode];
export class WideCurveReversalError extends Error {
  readonly code: WideCurveReversalDiagnosticCode;
  constructor(code: WideCurveReversalDiagnosticCode, detail: string, cause?: unknown) {
    super(('Wide Curve reversal: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'WideCurveReversalError'; this.code = code;
  }
}
export interface WideReversedCurveReport {
  family: 'own-native-wide-positive-rational-curve-reversal';
  dto: { schema: 'barocss-native-wide-reversed-curve'; version: 0; lengthUnit: 'mm';
    frame: 'authored-xyz-no-axis-conversion'; representation: 'native-curve-not-wire-topology' };
  originalCurveId: string; curveId: string; degree: number; poleCount: number; knotCount: number; domain: [number, number];
  observationCount: number; guardCount: number; observations: CurveReversalObservation[]; guards: CurveReversalGuardObservation[];
  maximumPointDifferenceMM: number; maximumRelativeDerivativeDifference: number;
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  inputProfile: { degreeRange: [1, 3]; poleRange: [2, 64]; maximumKnots: 70; coordinateAbsMM: 10000;
    weightRange: [1e-6, 1e6]; positive: true; clamped: true; nonperiodic: true };
  quality: { pointComparisonMM: 1e-7; relativeD1Comparison: 1e-7; localObservationsOnly: true;
    globalShapeErrorCertified: false; globalBinary64ErrorCertified: false; manufacturingToleranceCertified: false;
    controlAndWeightBitsPreserved: true; generatedInteriorKnotBitsCertified: false; doubleReversalBitsCertified: false;
    derivativeSemantics: 'native-c0-guards-unchanged-no-g1-g2-claim';
    nativeGuardStates: 'original-knot-mapped-original-parameter-and-reversed-knot-observed-separately';
    arithmetic: '64-epsilon-nonzero-cancellation-and-order-refusal';
    sourceText: 'regenerated-from-supplied-native-curve-not-original-file-formatting';
    ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-no-partial-result';
  limits: { maximumDegree: 3; maximumPoles: 64; nativeMathPoles: 64; nativeSourceKnots: 70;
    maximumObservations: 256; maximumGuards: 64; inputValues: 32768; inputDepth: 8; inputArrayElements: 128;
    inputRecordFields: 16; inputStringCharacters: 128; snapshotValues: 524288; snapshotDepth: 32;
    arrayElements: 4096; recordFields: 64; sourceStringCharacters: 262144; authoredIdCharacters: 48 };
}
export interface WideReversedCurveResult {
  original: Curve; options: CurveReversalOptions; curve: Curve; source: string; sourceVersion: 0; model: Model;
  originalSource: string; originalModel: Model; provenance: CurveReversalProvenance; report: WideReversedCurveReport;
}

const CODE = WideCurveReversalDiagnosticCode;
function check(condition: boolean, code: WideCurveReversalDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new WideCurveReversalError(code, detail);
}
function native<T>(action: () => T, detail: string, code: WideCurveReversalDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof WideCurveReversalError) throw cause;
    const actualCode = cause instanceof CurveReversalError ? cause.code : code;
    throw new WideCurveReversalError(actualCode, detail + ': ' + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
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
function record(value: unknown, fields: string[], code: WideCurveReversalDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'own record required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    code, 'exact fields required: ' + fields.join(','));
  return data;
}
function id(value: unknown): string {
  check(typeof value === 'string' && value.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value),
    CODE.IDENTITY, 'ASCII original/derived Curve ID1..48 required');
  return value;
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

/** Wide admission around the unchanged trusted reflection, coefficient and native source operation. */
export function reverseCurveWide(curveInput: Curve, inputOptions: CurveReversalOptions): WideReversedCurveResult {
  const original = record(snapshot(curveInput), ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']) as unknown as Curve;
  const o = record(snapshot(inputOptions), ['curveId']);
  id(original.id); const curveId = id(o.curveId);
  check(curveId !== original.id, CODE.IDENTITY, 'new reversed Curve ID must differ from original');
  const options: CurveReversalOptions = { curveId };
  check(original.kind === 'curve' && Number.isInteger(original.degree) && original.degree >= 1 && original.degree <= 3,
    CODE.INPUT, 'native degree1..3 Curve required');
  check(Array.isArray(original.controlPoints) && original.controlPoints.length >= 2 && original.controlPoints.length <= 64
    && original.controlPoints.every(point => Array.isArray(point) && point.length === 3
      && point.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10000)),
    CODE.INPUT, '2..64 original poles with authored XYZ±10000mm required');
  check(Array.isArray(original.knots) && original.knots.length <= 70
    && original.knots.length === original.controlPoints.length + original.degree + 1 && original.knots.every(Number.isFinite),
    CODE.INPUT, 'finite native knot array of correct length and at most70 values required');
  check(original.degree < original.controlPoints.length, CODE.INPUT, 'native degree must be below the original pole count');
  const geometry = native(() => reverseCurveGeometryTrusted(original, options, 256), 'actual trusted native wide Curve reversal');
  check(geometry.observations.length <= 256 && geometry.guards.length <= 64, CODE.BUDGET, 'wide native observation/guard capacity exceeded');
  check(geometry.source.length <= 262144 && geometry.originalSource.length <= 262144, CODE.BUDGET, 'individual actual source0 string budget exceeded');
  check(same(geometry.original, original), CODE.BINDING, 'actual original source0 changed original geometry coefficient/ID/domain/sign bits');
  const report: WideReversedCurveReport = {
    family: 'own-native-wide-positive-rational-curve-reversal',
    dto: { schema: 'barocss-native-wide-reversed-curve', version: 0, lengthUnit: 'mm',
      frame: 'authored-xyz-no-axis-conversion', representation: 'native-curve-not-wire-topology' },
    originalCurveId: original.id, curveId, degree: original.degree, poleCount: geometry.curve.controlPoints.length,
    knotCount: geometry.curve.knots.length, domain: geometry.domain, observationCount: geometry.observations.length, guardCount: geometry.guards.length,
    observations: geometry.observations, guards: geometry.guards, maximumPointDifferenceMM: geometry.maximumPointDifferenceMM,
    maximumRelativeDerivativeDifference: geometry.maximumRelativeDerivativeDifference,
    geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    inputProfile: { degreeRange: [1, 3], poleRange: [2, 64], maximumKnots: 70, coordinateAbsMM: 10000,
      weightRange: [1e-6, 1e6], positive: true, clamped: true, nonperiodic: true },
    quality: { pointComparisonMM: 1e-7, relativeD1Comparison: 1e-7, localObservationsOnly: true,
      globalShapeErrorCertified: false, globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false,
      controlAndWeightBitsPreserved: true, generatedInteriorKnotBitsCertified: false, doubleReversalBitsCertified: false,
      derivativeSemantics: 'native-c0-guards-unchanged-no-g1-g2-claim',
      nativeGuardStates: 'original-knot-mapped-original-parameter-and-reversed-knot-observed-separately',
      arithmetic: '64-epsilon-nonzero-cancellation-and-order-refusal',
      sourceText: 'regenerated-from-supplied-native-curve-not-original-file-formatting', ownership: 'copied-cpu-data-gc-no-renderer-resources' },
    budgetFailure: 'atomic-refusal-no-partial-result',
    limits: { maximumDegree: 3, maximumPoles: 64, nativeMathPoles: 64, nativeSourceKnots: 70,
      maximumObservations: 256, maximumGuards: 64, inputValues: 32768, inputDepth: 8, inputArrayElements: 128,
      inputRecordFields: 16, inputStringCharacters: 128, snapshotValues: 524288, snapshotDepth: 32,
      arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144, authoredIdCharacters: 48 },
  };
  return snapshot({ original: geometry.original, options, curve: geometry.curve, source: geometry.source, sourceVersion: 0,
    model: geometry.model, originalSource: geometry.originalSource, originalModel: geometry.originalModel,
    provenance: geometry.provenance, report }, true) as WideReversedCurveResult;
}
/** Rebuild all actual original/reversed sources, coefficient maps, point/D1 guards and report data. */
export function validateWideReversedCurveResult(input: WideReversedCurveResult): WideReversedCurveReport {
  const owned = snapshot(input, true) as WideReversedCurveResult;
  record(owned, ['original', 'options', 'curve', 'source', 'sourceVersion', 'model', 'originalSource', 'originalModel', 'provenance', 'report'], CODE.OWNED);
  let expected: WideReversedCurveResult;
  try { expected = reverseCurveWide(owned.original, owned.options); } catch (cause) {
    throw new WideCurveReversalError(CODE.OWNED, 'owned original/options full native reversal rebuild refused', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'owned original/source/control-weight bits/reflected knots/maps/point/D1/guards/report mismatch');
  return copyCadData(expected.report);
}
