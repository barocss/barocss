import { validateCurve, curveDomain, evaluateCurve } from '../../math.js';
import { evaluateCurveD1 } from '../../derivatives.js';
import { applyCurvePoleEditsTrusted } from '../curves/curve-control-polygon.js';
import type { CurveControlPolygonEdits, CurvePoleEditProvenance, CurvePoleField, CurveControlPolygonD1Evaluation, CurveControlPolygonD1Observation } from '../curves/curve-control-polygon.js';
import { compileCurveSource } from '../curves/curve-source.js';
import { copyCadData } from '../../data-copy.js';
import type { Curve, Model, Point } from '../../types.js';
import { same } from '../../structural-equality.js';

export const WideCurveControlPolygonEditDiagnosticCode = Object.freeze({
  INPUT: 'INPUT', IDENTITY: 'IDENTITY', BUDGET: 'BUDGET', NATIVE: 'NATIVE', BINDING: 'BINDING', OWNED: 'OWNED',
} as const);
export type WideCurveControlPolygonEditDiagnosticCode =
  typeof WideCurveControlPolygonEditDiagnosticCode[keyof typeof WideCurveControlPolygonEditDiagnosticCode];
export class WideCurveControlPolygonEditError extends Error {
  readonly code: WideCurveControlPolygonEditDiagnosticCode;
  constructor(code: WideCurveControlPolygonEditDiagnosticCode, detail: string, cause?: unknown) {
    super(('Wide Curve control-polygon edit: ' + detail).slice(0, 1024), cause === undefined ? undefined : { cause });
    this.name = 'WideCurveControlPolygonEditError'; this.code = code;
  }
}
export interface WideCurveControlPolygonEditReport {
  kind: 'wide-curve-control-polygon-edit';
  dto: { schema: 'barocss-native-wide-curve-control-polygon-edit'; version: 0; lengthUnit: 'mm';
    frame: 'authored-xyz-no-axis-conversion'; representation: 'native-curve-coefficient-edit-not-topology-or-fit' };
  curveId: string; lengthUnit: 'mm'; domain: [number, number]; degree: number; controlPointCount: number; originalSpanCount: number;
  requestedPoleCount: number; requestedFieldCount: number; changedPoleCount: number; changedFieldCount: number;
  untouchedPoleCount: number; untouchedFieldCount: number; unrequestedPoleCount: number; unrequestedFieldCount: number; noOp: boolean;
  observations: { parameter: number; beforePointMM: Point; afterPointMM: Point; observedChangeMM: number }[];
  maximumObservedChangeMM: number; derivativeObservations: CurveControlPolygonD1Observation[]; guardedKnots: number[];
  unrepresentedMidpointIntervals: { domain: [number, number]; attemptedParameter: number;
    reason: 'no-represented-interior-midpoint' }[];
  derivativeSemantics: 'native-c0-guards-unchanged-other-arithmetic-refuses'; authority: 'direct-original-and-edited-curve-coefficients';
  geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  inputProfile: { degreeRange: [1, 3]; poleRange: [2, 64]; maximumKnots: 70; maximumNonzeroSpans: 64;
    coordinateAbsMM: 10000; weightRange: [1e-6, 1e6]; positive: true; clamped: true; nonperiodic: true };
  quality: { editSemantics: 'absolute-requested-cartesian-and-weight-replacements'; unrequestedCoefficientBitsPreserved: true;
    idDegreeKnotDomainAndControlOrderPreserved: true; parameterization: 'original-degree-and-knot-domain-retained';
    sourceText: 'regenerated-from-supplied-native-curve-not-original-file-formatting';
    pointAndDerivativeEffects: 'actual-native-before-and-after-observations'; globalShapeErrorCertified: false;
    globalBinary64ErrorCertified: false; manufacturingToleranceCertified: false; g1g2Certified: false;
    ownership: 'copied-cpu-data-gc-no-renderer-resources' };
  budgetFailure: 'atomic-refusal-no-partial-result';
  limits: { maximumPoles: 64; maximumKnots: 70; maximumDegree: 3; maximumEdits: 64; maximumSpans: 64;
    maximumObservations: 129; maximumDerivativeObservations: 129; authoredIdCharacters: 48;
    inputValues: 32768; inputDepth: 8; inputArrayElements: 128; inputRecordFields: 16; inputStringCharacters: 128;
    snapshotValues: 524288; snapshotDepth: 32; arrayElements: 4096; recordFields: 64; sourceStringCharacters: 262144 };
}
export interface WideCurveControlPolygonEditResult {
  original: Curve; edits: CurveControlPolygonEdits; curve: Curve; source: string; sourceVersion: 0; model: Model;
  originalSource: string; originalModel: Model; provenance: CurvePoleEditProvenance[]; report: WideCurveControlPolygonEditReport;
}

const CODE = WideCurveControlPolygonEditDiagnosticCode;
const LABEL = 'Wide Curve control-polygon edit';
function check(condition: boolean, code: WideCurveControlPolygonEditDiagnosticCode, detail: string): asserts condition {
  if (!condition) throw new WideCurveControlPolygonEditError(code, detail);
}
function native<T>(action: () => T, detail: string, code: WideCurveControlPolygonEditDiagnosticCode = CODE.NATIVE): T {
  try { return action(); } catch (cause) {
    if (cause instanceof WideCurveControlPolygonEditError) throw cause;
    throw new WideCurveControlPolygonEditError(code, detail + ': ' + (cause instanceof Error ? cause.message : 'native operation refused'), cause);
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
function record(value: unknown, fields: string[], code: WideCurveControlPolygonEditDiagnosticCode = CODE.INPUT): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), code, 'own record required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(field => Object.hasOwn(data, field)),
    code, 'exact fields required: ' + fields.join(','));
  return data;
}
function admit(input: unknown): Curve {
  const data = record(input, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']);
  check(typeof data.id === 'string' && data.id.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.id),
    CODE.IDENTITY, 'ASCII original Curve ID1..48 required');
  check(data.kind === 'curve' && typeof data.degree === 'number' && Number.isInteger(data.degree)
    && data.degree >= 1 && data.degree <= 3, CODE.INPUT, 'native degree1..3 Curve required');
  check(Array.isArray(data.controlPoints) && data.controlPoints.length >= 2 && data.controlPoints.length <= 64
    && Array.isArray(data.knots) && data.knots.length <= 70, CODE.INPUT, '2..64 poles/70 knots required');
  const curve = data as unknown as Curve;
  native(() => validateCurve(curve), 'actual entire original/candidate native Curve admission', CODE.INPUT);
  check(curve.controlPoints.every(point => point.every(value => Math.abs(value) <= 10000)), CODE.INPUT, 'authored XYZ±10000mm required');
  return curve;
}
function source(curve: Curve): ReturnType<typeof compileCurveSource> {
  const compiled = native(() => compileCurveSource(curve.id, curve.degree, curve.controlPoints, curve.knots, curve.weights, LABEL),
    'actual native Curve source0 compilation');
  check(compiled.source.length <= 262144, CODE.BUDGET, 'individual actual source0 string budget exceeded');
  const expected: Model = { name: 'profile', version: 0, lengthUnit: 'mm', objects: [curve] };
  check(same(compiled.model, expected) && same(compiled.curve, curve), CODE.BINDING,
    'actual Curve-only source0 must preserve full Model/Curve/ID/order/domain/coefficient/sign bits');
  return compiled;
}
function derivative(curve: Curve, parameter: number): CurveControlPolygonD1Evaluation {
  try {
    const result = evaluateCurveD1(curve, parameter);
    check(result.point.every(Number.isFinite) && result.derivative.every(Number.isFinite), CODE.NATIVE, 'finite native D1 required');
    return { kind: 'evaluated', result };
  } catch (cause) {
    if (cause instanceof Error && cause.message === 'First derivative is not defined at an exact C0 interior knot')
      return { kind: 'refused', message: cause.message };
    if (cause instanceof WideCurveControlPolygonEditError) throw cause;
    throw new WideCurveControlPolygonEditError(CODE.NATIVE, 'actual native D1 arithmetic refused', cause);
  }
}
function point(curve: Curve, parameter: number): Point {
  const value = native(() => evaluateCurve(curve, parameter), 'actual native before/after Curve point');
  check(value.every(Number.isFinite), CODE.NATIVE, 'finite native point required'); return value;
}

/** Absolute pole edits using the unchanged shared patch kernel and actual wide native geometry. */
export function editCurveControlPolygonWide(curveInput: Curve, editInput: CurveControlPolygonEdits): WideCurveControlPolygonEditResult {
  const original = admit(snapshot(curveInput)), data = record(snapshot(editInput), ['poleEdits']);
  check(Array.isArray(data.poleEdits) && data.poleEdits.length >= 1 && data.poleEdits.length <= 64,
    CODE.BUDGET, '1..64 distinct explicit pole edits required');
  const edits = data as unknown as CurveControlPolygonEdits;
  const patched = native(() => applyCurvePoleEditsTrusted(original, data.poleEdits as unknown[]), 'actual shared pole edit admission/application', CODE.INPUT);
  const candidate = admit(patched.candidate), provenance = patched.provenance;
  check(candidate.kind === original.kind && candidate.id === original.id && candidate.degree === original.degree
    && same(candidate.knots, original.knots) && candidate.controlPoints.length === original.controlPoints.length
    && candidate.weights.length === original.weights.length, CODE.BINDING, 'native identity/degree/knot/order/capacity must remain');
  const originalFile = source(original), file = source(candidate), curve = file.curve, domain = curveDomain(original);
  check(same(curveDomain(curve), domain), CODE.BINDING, 'original domain endpoint bits must remain');
  const fields: CurvePoleField[] = ['xMM', 'yMM', 'zMM', 'weight'];
  const component = (field: CurvePoleField): number => field === 'xMM' ? 0 : field === 'yMM' ? 1 : 2;
  for (let index = 0; index < original.controlPoints.length; index++) {
    const requested = provenance.find(pole => pole.index === index)?.requestedFields ?? [];
    for (const field of fields) if (!requested.includes(field)) check(Object.is(field === 'weight' ? original.weights[index]
      : original.controlPoints[index][component(field)], field === 'weight' ? curve.weights[index] : curve.controlPoints[index][component(field)]),
    CODE.BINDING, 'unrequested coefficient bits must remain unchanged');
  }
  const breaks: number[] = [domain[0]];
  for (const knot of original.knots) if (knot > domain[0] && knot < domain[1] && !breaks.some(value => value === knot)) breaks.push(knot);
  breaks.push(domain[1]);
  const spanCount = breaks.length - 1;
  check(spanCount >= 1 && spanCount <= 64, CODE.BUDGET, 'original nonzero span capacity exceeded');
  const parameters: number[] = [], unrepresentedMidpointIntervals: WideCurveControlPolygonEditReport['unrepresentedMidpointIntervals'] = [];
  for (let index = 0; index < breaks.length; index++) {
    parameters.push(breaks[index]);
    if (index + 1 < breaks.length) {
      const low = breaks[index], high = breaks[index + 1], width = high - low;
      const middle = Number.isFinite(width) ? low + width / 2 : low / 2 + high / 2;
      check(Number.isFinite(middle), CODE.NATIVE, 'native observation midpoint arithmetic must be finite');
      if (middle > low && middle < high) parameters.push(middle);
      else unrepresentedMidpointIntervals.push({ domain: [low, high], attemptedParameter: middle, reason: 'no-represented-interior-midpoint' });
    }
  }
  check(parameters.length <= 129, CODE.BUDGET, 'native before/after observation capacity exceeded');
  const observations = parameters.map(parameter => {
    const beforePointMM = point(originalFile.curve, parameter), afterPointMM = point(curve, parameter);
    const differences = afterPointMM.map((value, axis) => value - beforePointMM[axis]);
    check(differences.every(Number.isFinite), CODE.NATIVE, 'finite native point effect difference required');
    const observedChangeMM = Math.hypot(...differences);
    check(Number.isFinite(observedChangeMM), CODE.NATIVE, 'finite native point effect norm required');
    return { parameter, beforePointMM, afterPointMM, observedChangeMM };
  });
  const derivativeObservations: CurveControlPolygonD1Observation[] = parameters.map(parameter =>
    ({ parameter, before: derivative(originalFile.curve, parameter), after: derivative(curve, parameter) }));
  const guardedKnots = breaks.slice(1, -1).filter(parameter => original.knots.filter(knot => knot === parameter).length >= original.degree);
  const requestedFieldCount = provenance.reduce((sum, pole) => sum + pole.requestedFields.length, 0);
  const changedPoleCount = provenance.filter(pole => pole.changedFields.length > 0).length;
  const changedFieldCount = provenance.reduce((sum, pole) => sum + pole.changedFields.length, 0), count = original.controlPoints.length;
  const report: WideCurveControlPolygonEditReport = {
    kind: 'wide-curve-control-polygon-edit',
    dto: { schema: 'barocss-native-wide-curve-control-polygon-edit', version: 0, lengthUnit: 'mm',
      frame: 'authored-xyz-no-axis-conversion', representation: 'native-curve-coefficient-edit-not-topology-or-fit' },
    curveId: original.id, lengthUnit: 'mm', domain, degree: original.degree, controlPointCount: count, originalSpanCount: spanCount,
    requestedPoleCount: provenance.length, requestedFieldCount, changedPoleCount, changedFieldCount,
    untouchedPoleCount: count - changedPoleCount, untouchedFieldCount: count * 4 - changedFieldCount,
    unrequestedPoleCount: count - provenance.length, unrequestedFieldCount: count * 4 - requestedFieldCount, noOp: changedFieldCount === 0,
    observations, maximumObservedChangeMM: Math.max(...observations.map(observation => observation.observedChangeMM)), derivativeObservations,
    guardedKnots, unrepresentedMidpointIntervals, derivativeSemantics: 'native-c0-guards-unchanged-other-arithmetic-refuses',
    authority: 'direct-original-and-edited-curve-coefficients', geometricValidity: 'not-certified', topologyCertified: false, solid: false,
    inputProfile: { degreeRange: [1, 3], poleRange: [2, 64], maximumKnots: 70, maximumNonzeroSpans: 64,
      coordinateAbsMM: 10000, weightRange: [1e-6, 1e6], positive: true, clamped: true, nonperiodic: true },
    quality: { editSemantics: 'absolute-requested-cartesian-and-weight-replacements', unrequestedCoefficientBitsPreserved: true,
      idDegreeKnotDomainAndControlOrderPreserved: true, parameterization: 'original-degree-and-knot-domain-retained',
      sourceText: 'regenerated-from-supplied-native-curve-not-original-file-formatting',
      pointAndDerivativeEffects: 'actual-native-before-and-after-observations', globalShapeErrorCertified: false,
      globalBinary64ErrorCertified: false, manufacturingToleranceCertified: false, g1g2Certified: false,
      ownership: 'copied-cpu-data-gc-no-renderer-resources' }, budgetFailure: 'atomic-refusal-no-partial-result',
    limits: { maximumPoles: 64, maximumKnots: 70, maximumDegree: 3, maximumEdits: 64, maximumSpans: 64,
      maximumObservations: 129, maximumDerivativeObservations: 129, authoredIdCharacters: 48,
      inputValues: 32768, inputDepth: 8, inputArrayElements: 128, inputRecordFields: 16, inputStringCharacters: 128,
      snapshotValues: 524288, snapshotDepth: 32, arrayElements: 4096, recordFields: 64, sourceStringCharacters: 262144 },
  };
  return snapshot({ original: originalFile.curve, edits, curve, source: file.source, sourceVersion: 0, model: file.model,
    originalSource: originalFile.source, originalModel: originalFile.model, provenance, report }, true) as WideCurveControlPolygonEditResult;
}
/** Rebuild original and edited native curves, source Models, exact patches/provenance and observed effects. */
export function validateWideCurveControlPolygonEdit(input: WideCurveControlPolygonEditResult): WideCurveControlPolygonEditReport {
  const owned = snapshot(input, true) as WideCurveControlPolygonEditResult;
  record(owned, ['original', 'edits', 'curve', 'source', 'sourceVersion', 'model', 'originalSource', 'originalModel', 'provenance', 'report'], CODE.OWNED);
  let expected: WideCurveControlPolygonEditResult;
  try { expected = editCurveControlPolygonWide(owned.original, owned.edits); } catch (cause) {
    throw new WideCurveControlPolygonEditError(CODE.OWNED, 'owned original/edits full native reconstruction refused', cause);
  }
  check(same(owned, expected), CODE.OWNED, 'owned original/edits/candidate/source Models/provenance/native observations/guards/report mismatch');
  return copyCadData(expected.report);
}
