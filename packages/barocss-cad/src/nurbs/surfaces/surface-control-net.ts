import { validateSurface, surfaceDomain, evaluateSurface } from '../../core/math.js';
import { compileCadModel } from '../../model-compiler.js';
import { curveDecimal, requireCurveValue } from '../curves/curve-source.js';
import { copyCadData } from '../../data-copy.js';
import type { Surface, Model, Point } from '../../types.js';
import { same as sameData } from '../../core/structural-equality.js';

export type SurfacePoleField = 'xMM' | 'yMM' | 'zMM' | 'weight';
export interface SurfacePoleEdit { uIndex: number; vIndex: number; xMM?: number; yMM?: number; zMM?: number; weight?: number }
export interface SurfaceControlNetEdits { poleEdits: SurfacePoleEdit[] }
export interface SurfacePoleEditProvenance {
  uIndex: number; vIndex: number; requestedFields: SurfacePoleField[]; changedFields: SurfacePoleField[];
  before: { pointMM: Point; weight: number }; after: { pointMM: Point; weight: number };
}
export interface SurfaceControlNetReport {
  kind: 'surface-control-net-edit'; surfaceId: string; lengthUnit: 'mm'; domain: { u: [number, number]; v: [number, number] };
  degrees: { u: number; v: number }; controlPointCounts: { u: number; v: number; total: number };
  requestedPoleCount: number; changedPoleCount: number; changedFieldCount: number; untouchedPoleCount: number; untouchedFieldCount: number;
  observations: { u: number; v: number; beforePointMM: Point; afterPointMM: Point; observedChangeMM: number }[]; maximumObservedChangeMM: number;
  authority: 'direct-surface-coefficients'; geometricValidity: 'not-certified'; topologyCertified: false; solid: false;
  limits: { maximumGridAxis: 16; maximumPoles: 256; maximumDegree: 3; maximumEdits: 16; authoredIdCharacters: 48; snapshotValues: 4096; snapshotDepth: 8; arrayElements: 64; recordFields: 8; stringCharacters: 128 };
}
export interface SurfaceControlNetResult { original: Surface; surface: Surface; source: string; sourceVersion: 0; model: Model; provenance: SurfacePoleEditProvenance[]; report: SurfaceControlNetReport }
const LABEL = 'Surface control-net edit';
function check(condition: boolean, detail: string): asserts condition { requireCurveValue(condition, detail, LABEL); }
function snapshot(input: unknown): unknown {
  let remaining = 4096;
  const copy = (value: unknown, depth: number): unknown => {
    check(--remaining >= 0 && depth <= 8, 'input exceeds4096 own values/depth8');
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
function admit(input: unknown): Surface {
  const data = record(input, ['kind', 'id', 'degreeU', 'degreeV', 'knotsU', 'knotsV', 'controlPoints', 'weights']);
  check(data.kind === 'surface', 'original Surface required'); id(data.id);
  check(typeof data.degreeU === 'number' && Number.isInteger(data.degreeU) && data.degreeU >= 1 && data.degreeU <= 3 && typeof data.degreeV === 'number' && Number.isInteger(data.degreeV) && data.degreeV >= 1 && data.degreeV <= 3, 'original U/V degree1..3 required');
  const surface = data as unknown as Surface; validateSurface(surface);
  check(surface.controlPoints.every(row => row.every(p => p.every(n => Math.abs(n) <= 10000))), 'original XYZ coordinates within±10000mm required');
  return surface;
}
function parameters(domain: [number, number]): number[] {
  const [a, b] = domain, delta = b - a, mid = Number.isFinite(delta) ? a + delta / 2 : a / 2 + b / 2;
  return mid > a && mid < b ? [a, mid, b] : [a, b];
}
/** Atomic coefficient editing of a directly authored original rational Surface. */
export function editSurfaceControlNet(input: Surface, edits: SurfaceControlNetEdits): SurfaceControlNetResult {
  try {
    const originalData = snapshot(input), editData = snapshot(edits), original = admit(originalData), data = record(editData, ['poleEdits']);
    check(Array.isArray(data.poleEdits) && data.poleEdits.length >= 1 && data.poleEdits.length <= 16, '1..16 pole edits required');
    const candidate = copyCadData(original), countU = original.controlPoints.length, countV = original.controlPoints[0].length;
    const targets = new Set<string>(), provenance: SurfacePoleEditProvenance[] = [], fields: SurfacePoleField[] = ['xMM', 'yMM', 'zMM', 'weight'];
    for (const input of data.poleEdits) {
      check(input !== null && typeof input === 'object' && !Array.isArray(input), 'pole edit record required');
      const e = input as Record<string, unknown>, keys = Object.keys(e);
      check(Object.hasOwn(e, 'uIndex') && Object.hasOwn(e, 'vIndex') && keys.length >= 3 && keys.length <= 6 && keys.every(k => ['uIndex', 'vIndex', ...fields].includes(k)), 'existing uIndex/vIndex and at least one explicit coordinate/weight field required');
      check(typeof e.uIndex === 'number' && Number.isInteger(e.uIndex) && e.uIndex >= 0 && e.uIndex < countU && typeof e.vIndex === 'number' && Number.isInteger(e.vIndex) && e.vIndex >= 0 && e.vIndex < countV, 'in-range integer U/V pole indices required');
      const u = e.uIndex, v = e.vIndex, key = u + ':' + v; check(!targets.has(key), 'duplicate U/V pole target'); targets.add(key);
      const requestedFields = fields.filter(f => Object.hasOwn(e, f));
      const before = { pointMM: copyCadData(original.controlPoints[u][v]), weight: original.weights[u][v] };
      for (const f of requestedFields) {
        check(typeof e[f] === 'number' && Number.isFinite(e[f]), 'finite authored pole/weight scalar required');
        if (f === 'weight') candidate.weights[u][v] = e[f] as number;
        else candidate.controlPoints[u][v][f === 'xMM' ? 0 : f === 'yMM' ? 1 : 2] = e[f] as number;
      }
      const after = { pointMM: copyCadData(candidate.controlPoints[u][v]), weight: candidate.weights[u][v] };
      const changedFields = requestedFields.filter(f => !Object.is(f === 'weight' ? before.weight : before.pointMM[f === 'xMM' ? 0 : f === 'yMM' ? 1 : 2], f === 'weight' ? after.weight : after.pointMM[f === 'xMM' ? 0 : f === 'yMM' ? 1 : 2]));
      provenance.push({ uIndex: u, vIndex: v, requestedFields, changedFields, before, after });
    }
    // Native range/weight/grid validation applies to the complete staged net.
    admit(candidate);
    const decimal = (n: number) => curveDecimal(n, LABEL), list = (values: number[]) => '[' + values.map(decimal).join(',') + ']';
    const source = '@model ' + candidate.id + ' { version:0; length-unit:mm; @surface #' + candidate.id + ' { type:nurbs; degree-u:' + decimal(candidate.degreeU) + '; degree-v:' + decimal(candidate.degreeV) + '; knots-u:' + list(candidate.knotsU) + '; knots-v:' + list(candidate.knotsV) + '; control-points:[' + candidate.controlPoints.map(row => '[' + row.map(list).join(',') + ']').join(',') + ']; weights:[' + candidate.weights.map(list).join(',') + ']; } }\n';
    check(source.length <= 262144, 'generated source exceeds compiler bound');
    const compiled = compileCadModel(source, { sourceVersion: 0 });
    check(compiled.ok, 'actual source0 compilation required' + (compiled.ok ? '' : ': ' + compiled.diagnostics.map(d => d.message).join('; ')));
    const expected: Model = { name: candidate.id, version: 0, lengthUnit: 'mm', objects: [candidate] };
    check(sameData(compiled.model, expected), 'actual source0 must preserve complete accepted net/ID/order/knots/weights/signed zero');
    const surface = compiled.model.objects[0] as Surface, domain = surfaceDomain(original);
    check(sameData(surfaceDomain(surface), domain), 'original domain endpoint bits must remain');
    for (let u = 0; u < countU; u++) for (let v = 0; v < countV; v++) {
      const changed = provenance.find(p => p.uIndex === u && p.vIndex === v)?.requestedFields ?? [];
      for (const f of fields) if (!changed.includes(f)) check(Object.is(f === 'weight' ? original.weights[u][v] : original.controlPoints[u][v][f === 'xMM' ? 0 : f === 'yMM' ? 1 : 2], f === 'weight' ? surface.weights[u][v] : surface.controlPoints[u][v][f === 'xMM' ? 0 : f === 'yMM' ? 1 : 2]), 'unedited coefficient bits must remain');
    }
    const observations = parameters(domain.u).flatMap(u => parameters(domain.v).map(v => {
      const beforePointMM = evaluateSurface(original, u, v), afterPointMM = evaluateSurface(surface, u, v), observedChangeMM = Math.hypot(...afterPointMM.map((n, i) => n - beforePointMM[i]));
      check(Number.isFinite(observedChangeMM), 'finite native before/after point observation required');
      return { u, v, beforePointMM, afterPointMM, observedChangeMM };
    }));
    const total = countU * countV, changedPoleCount = provenance.filter(p => p.changedFields.length > 0).length, changedFieldCount = provenance.reduce((sum, p) => sum + p.changedFields.length, 0);
    return copyCadData({ original, surface, source, sourceVersion: 0, model: compiled.model, provenance,
      report: { kind: 'surface-control-net-edit', surfaceId: original.id, lengthUnit: 'mm', domain, degrees: { u: original.degreeU, v: original.degreeV }, controlPointCounts: { u: countU, v: countV, total },
        requestedPoleCount: provenance.length, changedPoleCount, changedFieldCount, untouchedPoleCount: total - changedPoleCount, untouchedFieldCount: total * 4 - changedFieldCount, observations,
        maximumObservedChangeMM: Math.max(...observations.map(o => o.observedChangeMM)), authority: 'direct-surface-coefficients', geometricValidity: 'not-certified', topologyCertified: false, solid: false,
        limits: { maximumGridAxis: 16, maximumPoles: 256, maximumDegree: 3, maximumEdits: 16, authoredIdCharacters: 48, snapshotValues: 4096, snapshotDepth: 8, arrayElements: 64, recordFields: 8, stringCharacters: 128 } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid original Surface/pole edits';
    throw new Error((message.startsWith(LABEL) ? message : LABEL + ': ' + message).slice(0, 1024), { cause: error });
  }
}
