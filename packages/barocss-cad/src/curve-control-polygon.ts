import { validateCurve, curveDomain, evaluateCurve } from './math.js';
import { evaluateCurveD1 } from './derivatives.js';
import type { CurveD1Result } from './derivatives.js';
import { compileCurveSource, requireCurveValue } from './curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Model, Point } from './types.js';

export type CurvePoleField = 'xMM' | 'yMM' | 'zMM' | 'weight';
export interface CurvePoleEdit { index: number; xMM?: number; yMM?: number; zMM?: number; weight?: number }
export interface CurveControlPolygonEdits { poleEdits: CurvePoleEdit[] }
export interface CurvePoleEditProvenance {
  index: number; requestedFields: CurvePoleField[]; changedFields: CurvePoleField[];
  before: { pointMM: Point; weight: number }; after: { pointMM: Point; weight: number };
}
export type CurveControlPolygonD1Evaluation = { kind: 'evaluated'; result: CurveD1Result } | { kind: 'refused'; message: string };
export interface CurveControlPolygonD1Observation { parameter: number; before: CurveControlPolygonD1Evaluation; after: CurveControlPolygonD1Evaluation }
export interface CurveControlPolygonReport {
  kind: 'curve-control-polygon-edit'; curveId: string; lengthUnit: 'mm'; domain: [number, number]; degree: number; controlPointCount: number;
  requestedPoleCount: number; changedPoleCount: number; changedFieldCount: number; untouchedPoleCount: number; untouchedFieldCount: number;
  observations: { parameter: number; beforePointMM: Point; afterPointMM: Point; observedChangeMM: number }[];
  maximumObservedChangeMM: number; derivativeObservations: CurveControlPolygonD1Observation[]; guardedKnots: number[]; derivativeSemantics: 'native-guards-unchanged';
  authority: 'direct-curve-coefficients'; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { maximumPoles: 16; maximumDegree: 3; maximumEdits: 16; authoredIdCharacters: 48; snapshotValues: 1024;
    snapshotDepth: 6; arrayElements: 64; recordFields: 8; stringCharacters: 128; maximumObservations: 32; maximumDerivativeObservations: 3 };
}
export interface CurveControlPolygonResult { original: Curve; curve: Curve; source: string; sourceVersion: 0; model: Model; provenance: CurvePoleEditProvenance[]; report: CurveControlPolygonReport }
const LABEL = 'Curve control-polygon edit';
function check(condition: boolean, detail: string): asserts condition { requireCurveValue(condition, detail, LABEL); }
function snapshot(input: unknown): unknown {
  let remaining = 1024;
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 6, 'input exceeds1024 own values/depth6');
    if (typeof value === 'number') { check(Number.isFinite(value), 'finite numeric data required'); return value; }
    if (typeof value === 'string') { check(value.length <= 128, 'string exceeds128'); return value; }
    check(value !== null && typeof value === 'object', 'plain numeric/string/record data required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value), keys = Reflect.ownKeys(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'foreign prototype unsupported');
    check(keys.length <= (array ? 65 : 8), 'own field bound exceeded');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && key.length <= 128 && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable)), 'getters, symbols or hidden fields unsupported');
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 64 && keys.length === length + 1, 'bounded dense arrays required');
      const result: unknown[] = [];
      for (let i = 0; i < length; i++) { check(Object.hasOwn(descriptors, String(i)), 'sparse/extra array field'); result.push(copy(descriptors[String(i)].value, depth + 1)); }
      return result;
    }
    return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
  };
  return copy(input, 0);
}
function record(input: unknown, fields: string[]): Record<string, unknown> {
  check(input !== null && typeof input === 'object' && !Array.isArray(input), 'record required');
  const value = input as Record<string, unknown>; check(Object.keys(value).length === fields.length && fields.every(key => Object.hasOwn(value, key)), 'exact fields required: ' + fields.join(',')); return value;
}
function id(input: unknown): string { check(typeof input === 'string' && input.length <= 48 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(input), 'ASCII ID1..48 required'); return input; }
function sameData(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => sameData(value, b[i]));
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
    return Object.keys(left).length === Object.keys(right).length && Object.keys(left).every(key => Object.hasOwn(right, key) && sameData(left[key], right[key]));
  }
  return Object.is(a, b);
}
function samples(curve: Curve): number[] {
  const [min, max] = curveDomain(curve), values = new Set<number>([min, max]);
  const breaks = [...new Set(curve.knots)].filter(k => k >= min && k <= max);
  for (let i = 0; i < breaks.length; i++) {
    values.add(breaks[i]);
    if (i + 1 < breaks.length) {
      const a = breaks[i], b = breaks[i + 1], delta = b - a, mid = Number.isFinite(delta) ? a + delta / 2 : a / 2 + b / 2;
      // Adjacent binary64 knots may have no representable interior sample.
      if (mid > a && mid < b) values.add(mid);
    }
  }
  return [...values].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
}
function guardKnots(knots: number[], degree: number, min: number, max: number): number[] {
  return [...new Set(knots)].filter(k => k > min && k < max && knots.filter(x => x === k).length >= degree);
}
function admit(input: unknown): Curve {
  const data = record(input, ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights']);
  check(data.kind === 'curve', 'original Curve required'); id(data.id);
  check(typeof data.degree === 'number' && Number.isInteger(data.degree) && data.degree >= 1 && data.degree <= 3, 'degree 1..3 required');
  check(Array.isArray(data.controlPoints) && data.controlPoints.length >= 2 && data.controlPoints.length <= 16, 'original poles 2..16 required');
  const curve = data as unknown as Curve; validateCurve(curve);
  check(curve.controlPoints.every(p => p.every(n => Math.abs(n) <= 10000)), 'XYZ coordinates within +/-10000 mm required');
  return curve;
}
function guarded(curve: Curve, parameter: number): boolean {
  const [min, max] = curveDomain(curve);
  return parameter > min && parameter < max && curve.knots.filter(k => k === parameter).length >= curve.degree;
}

function derivative(curve: Curve, parameter: number): CurveControlPolygonD1Evaluation {
  try { return { kind: 'evaluated', result: evaluateCurveD1(curve, parameter) }; }
  catch (error) { return { kind: 'refused', message: (error instanceof Error ? error.message : 'native D1 refused').slice(0, 512) }; }
}
/** Atomic Cartesian/weight coefficient edits on a directly authored original Curve. */
export function editCurveControlPolygon(input: Curve, edits: CurveControlPolygonEdits): CurveControlPolygonResult {
  try {
    const originalData = snapshot(input), editData = snapshot(edits), original = admit(originalData), data = record(editData, ['poleEdits']);
    check(Array.isArray(data.poleEdits) && data.poleEdits.length >= 1 && data.poleEdits.length <= 16, '1..16 explicit pole edits required');
    const fields: CurvePoleField[] = ['xMM', 'yMM', 'zMM', 'weight'], indices = new Set<number>();
    // Admit every requested record before applying any patch to the owned net.
    const patches = data.poleEdits.map(input => {
      check(input !== null && typeof input === 'object' && !Array.isArray(input), 'pole edit record required');
      const e = input as Record<string, unknown>, keys = Object.keys(e);
      check(Object.hasOwn(e, 'index') && keys.length >= 2 && keys.length <= 5 && keys.every(k => ['index', ...fields].includes(k)), 'existing index and at least one explicit coordinate/weight field required');
      check(typeof e.index === 'number' && Number.isInteger(e.index) && e.index >= 0 && e.index < original.controlPoints.length, 'in-range integer pole index required');
      check(!indices.has(e.index), 'duplicate pole index'); indices.add(e.index);
      const requestedFields = fields.filter(f => Object.hasOwn(e, f));
      for (const f of requestedFields) check(typeof e[f] === 'number' && Number.isFinite(e[f]), 'finite authored coordinate/weight scalar required');
      return { index: e.index, values: e, requestedFields };
    });
    const candidate = copyCadData(original), provenance: CurvePoleEditProvenance[] = [];
    const component = (field: CurvePoleField) => field === 'xMM' ? 0 : field === 'yMM' ? 1 : 2;
    for (const patch of patches) {
      const before = { pointMM: copyCadData(original.controlPoints[patch.index]), weight: original.weights[patch.index] };
      for (const f of patch.requestedFields) {
        if (f === 'weight') candidate.weights[patch.index] = patch.values[f] as number;
        else candidate.controlPoints[patch.index][component(f)] = patch.values[f] as number;
      }
      const after = { pointMM: copyCadData(candidate.controlPoints[patch.index]), weight: candidate.weights[patch.index] };
      const changedFields = patch.requestedFields.filter(f => !Object.is(f === 'weight' ? before.weight : before.pointMM[component(f)], f === 'weight' ? after.weight : after.pointMM[component(f)]));
      provenance.push({ index: patch.index, requestedFields: patch.requestedFields, changedFields, before, after });
    }
    admit(candidate);
    const compiled = compileCurveSource(candidate.id, candidate.degree, candidate.controlPoints, candidate.knots, candidate.weights, LABEL);
    const expected: Model = { name: 'profile', version: 0, lengthUnit: 'mm', objects: [candidate] };
    check(sameData(compiled.model, expected), 'actual source0 must preserve complete Curve/Model/ID/degree/knot/pole/weight bits');
    const curve = compiled.curve, domain = curveDomain(original);
    check(sameData(curveDomain(curve), domain), 'original domain endpoint bits must remain');
    for (let index = 0; index < original.controlPoints.length; index++) {
      const requested = provenance.find(p => p.index === index)?.requestedFields ?? [];
      for (const f of fields) if (!requested.includes(f)) check(Object.is(f === 'weight' ? original.weights[index] : original.controlPoints[index][component(f)], f === 'weight' ? curve.weights[index] : curve.controlPoints[index][component(f)]), 'unrequested coefficient bits must remain');
    }
    const parameters = samples(original); check(parameters.length <= 32, 'native point observation bound exceeded');
    const observations = parameters.map(parameter => {
      const beforePointMM = evaluateCurve(original, parameter), afterPointMM = evaluateCurve(curve, parameter), observedChangeMM = Math.hypot(...afterPointMM.map((n, i) => n - beforePointMM[i]));
      check(Number.isFinite(observedChangeMM), 'finite native before/after point effect required');
      return { parameter, beforePointMM, afterPointMM, observedChangeMM };
    });
    const interior = parameters.find(p => p > domain[0] && p < domain[1] && !guarded(original, p));
    const queries = [domain[0], ...(interior === undefined ? [] : [interior]), domain[1]];
    const derivativeObservations = queries.map(parameter => ({ parameter, before: derivative(original, parameter), after: derivative(curve, parameter) }));
    const count = original.controlPoints.length, changedPoleCount = provenance.filter(p => p.changedFields.length > 0).length, changedFieldCount = provenance.reduce((sum, p) => sum + p.changedFields.length, 0);
    return copyCadData({ original, curve, source: compiled.source, sourceVersion: 0, model: compiled.model, provenance,
      report: { kind: 'curve-control-polygon-edit', curveId: original.id, lengthUnit: 'mm', domain, degree: original.degree, controlPointCount: count,
        requestedPoleCount: provenance.length, changedPoleCount, changedFieldCount, untouchedPoleCount: count - changedPoleCount, untouchedFieldCount: count * 4 - changedFieldCount,
        observations, maximumObservedChangeMM: Math.max(...observations.map(o => o.observedChangeMM)), derivativeObservations,
        guardedKnots: guardKnots(original.knots, original.degree, ...domain), derivativeSemantics: 'native-guards-unchanged', authority: 'direct-curve-coefficients',
        geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        limits: { maximumPoles: 16, maximumDegree: 3, maximumEdits: 16, authoredIdCharacters: 48, snapshotValues: 1024, snapshotDepth: 6, arrayElements: 64, recordFields: 8, stringCharacters: 128, maximumObservations: 32, maximumDerivativeObservations: 3 } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid original Curve/pole edits';
    throw new Error((message.startsWith(LABEL) ? message : LABEL + ': ' + message).slice(0, 1024), { cause: error });
  }
}
