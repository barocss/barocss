import { buildXYProfile } from './xy-profile.js';
import type { XYPoint } from './xy-profile.js';
import { compileCadModel } from './model-compiler.js';
import type { CadModelIR1 } from './model-compiler.js';
import { curveDecimal } from './nurbs/curves/curve-source.js';
import { copyCadData } from './data-copy.js';
import type { Model } from './types.js';

interface SketchPoint { id: string; position: XYPoint }
interface SketchSegment { id: string; startPointId: string; endPointId: string }
export type XYLinearSketchConstraint = { id: string; kind: 'horizontal' | 'vertical'; segmentId: string }
  | { id: string; kind: 'coincident'; pointA: string; pointB: string }
  | { id: string; kind: 'fixed'; pointId: string; target: XYPoint };
export interface XYLinearSketchDocumentV0 {
  format: 'barocss-xy-linear-sketch'; version: 0; id: string; lengthUnit: 'mm';
  points: SketchPoint[]; segments: SketchSegment[]; constraints: XYLinearSketchConstraint[];
}
export interface XYLinearSketchDiagnostic {
  code: 'INVALID_DOCUMENT' | 'UNSUPPORTED' | 'LIMIT' | 'REFERENCE' | 'CONFLICT' | 'DEGENERATE_GEOMETRY' | 'COMPILATION';
  message: string; path: string; constraintIds: string[];
}
export type XYLinearSketchResult = { ok: true; document: XYLinearSketchDocumentV0;
  solution: { points: SketchPoint[]; source: string; sourceVersion: 0; model: Model; ir: CadModelIR1 };
  report: { degreesOfFreedom: number; rank: number; fullyConstrained: boolean; redundantConstraintIds: string[] } }
  | { ok: false; diagnostics: XYLinearSketchDiagnostic[] };
export type XYLinearSketchConstraintV1 = XYLinearSketchConstraint
  | { id: string; kind: 'distance-x' | 'distance-y'; pointA: string; pointB: string; distanceMM: number };
export interface XYLinearSketchDocumentV1 extends Omit<XYLinearSketchDocumentV0, 'version' | 'constraints'> {
  version: 1; constraints: XYLinearSketchConstraintV1[];
}
export interface XYLinearSketchDimensionReport { id: string; axis: 'x' | 'y'; pointA: string; pointB: string; requestedMM: number; actualMM: number }
export type XYLinearSketchResultV1 = { ok: true; document: XYLinearSketchDocumentV1;
  solution: Extract<XYLinearSketchResult, { ok: true }>['solution'];
  report: Extract<XYLinearSketchResult, { ok: true }>['report'] & { dimensions: XYLinearSketchDimensionReport[] } }
  | Extract<XYLinearSketchResult, { ok: false }>;
class SketchFailure extends Error {
  constructor(readonly code: XYLinearSketchDiagnostic['code'], message: string, readonly path: string, readonly constraintIds: string[] = []) { super(message); }
}
function fail(code: XYLinearSketchDiagnostic['code'], message: string, path: string, constraintIds: string[] = []): never { throw new SketchFailure(code, message, path, constraintIds); }
function check(condition: boolean, code: XYLinearSketchDiagnostic['code'], message: string, path: string): asserts condition { if (!condition) fail(code, message, path); }
function snapshot(input: unknown): unknown {
  let remaining = 512;
  const copy = (value: unknown, depth: number, path: string): unknown => {
    check(--remaining >= 0 && depth <= 4, 'LIMIT', 'Snapshot exceeds 512 own values/depth 4', path);
    if (typeof value === 'number') { check(Number.isFinite(value), 'INVALID_DOCUMENT', 'Finite numeric data required', path); return value; }
    if (typeof value === 'string') { check(value.length <= 128, 'LIMIT', 'String exceeds 128 characters', path); return value; }
    check(value !== null && typeof value === 'object', 'INVALID_DOCUMENT', 'Ordinary numeric/string/record data required', path);
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'INVALID_DOCUMENT', 'Foreign prototype is unsupported', path);
    const keys = Reflect.ownKeys(value);
    check(keys.length <= (array ? 33 : 8), 'LIMIT', 'Array exceeds 32 elements or record exceeds 8 fields', path);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), 'INVALID_DOCUMENT', 'Accessors, symbols or hidden fields are unsupported', path);
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 32 && keys.length === length + 1, 'INVALID_DOCUMENT', 'Ordinary dense bounded array required', path);
      const result: unknown[] = [];
      for (let i = 0; i < length; i++) {
        check(Object.hasOwn(descriptors, String(i)), 'INVALID_DOCUMENT', 'Sparse or extra array fields are unsupported', path);
        result.push(copy(descriptors[String(i)].value, depth + 1, path + '[' + i + ']'));
      }
      return result;
    }
    return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1, path + '.' + key)]));
  };
  return copy(input, 0, '$');
}
function record(value: unknown, fields: string[], path: string): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), 'INVALID_DOCUMENT', 'Own-data record required', path);
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(key => Object.hasOwn(data, key)), 'INVALID_DOCUMENT', 'Exact fields required: ' + fields.join(','), path); return data;
}
function identifier(value: unknown, bound: number, path: string): string {
  check(typeof value === 'string', 'INVALID_DOCUMENT', 'ASCII identifier required', path);
  check(value.length <= bound, 'LIMIT', 'Identifier exceeds ' + bound + ' characters', path);
  check(/^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), 'INVALID_DOCUMENT', 'Supported nonempty ASCII identifier required', path); return value;
}
function xy(value: unknown, path: string): XYPoint {
  check(Array.isArray(value) && value.length === 2 && value.every(n => typeof n === 'number'), 'INVALID_DOCUMENT', 'Two numeric XY coordinates required', path);
  check(value.every(n => Math.abs(n) <= 10000), 'UNSUPPORTED', 'XY coordinates must remain within +/-10000 mm', path); return [value[0], value[1]];
}
function admit(input: unknown): XYLinearSketchDocumentV0 | XYLinearSketchDocumentV1 {
  const data = record(snapshot(input), ['format', 'version', 'id', 'lengthUnit', 'points', 'segments', 'constraints'], '$');
  check(data.format === 'barocss-xy-linear-sketch' && (data.version === 0 || data.version === 1) && data.lengthUnit === 'mm', 'UNSUPPORTED', 'XY linear sketch v0 and mm required', '$.format/version/lengthUnit');
  const version = data.version as 0 | 1;
  const id = identifier(data.id, 80, '$.id'), ids = new Set([id]);
  const unique = (value: unknown, path: string) => { const name = identifier(value, 128, path); check(!ids.has(name), 'INVALID_DOCUMENT', 'Duplicate global ID #' + name, path); ids.add(name); return name; };
  const list = (value: unknown, min: number, max: number, path: string): unknown[] => {
    check(Array.isArray(value), 'INVALID_DOCUMENT', 'Array required', path);
    check(value.length <= max, 'LIMIT', 'At most ' + max + ' records supported', path);
    check(value.length >= min, 'INVALID_DOCUMENT', 'At least ' + min + ' records required', path); return value;
  };
  const points = list(data.points, 2, 16, '$.points').map((value, i) => { const path = '$.points[' + i + ']', p = record(value, ['id', 'position'], path); return { id: unique(p.id, path + '.id'), position: xy(p.position, path + '.position') }; });
  const pointIds = new Set(points.map(point => point.id)), used = new Set<string>();
  const reference = (value: unknown, targets: Set<string>, path: string): string => { const name = identifier(value, 128, path); check(targets.has(name), 'REFERENCE', 'Unresolved reference #' + name, path); return name; };
  const segments = list(data.segments, 1, 8, '$.segments').map((value, i) => {
    const path = '$.segments[' + i + ']', s = record(value, ['id', 'startPointId', 'endPointId'], path), name = unique(s.id, path + '.id');
    const startPointId = reference(s.startPointId, pointIds, path + '.startPointId'), endPointId = reference(s.endPointId, pointIds, path + '.endPointId');
    check(startPointId !== endPointId, 'REFERENCE', 'Segment #' + name + ' requires distinct point IDs', path); used.add(startPointId); used.add(endPointId); return { id: name, startPointId, endPointId };
  });
  points.forEach((point, i) => check(used.has(point.id), 'REFERENCE', 'Point #' + point.id + ' does not participate in a segment', '$.points[' + i + ']'));
  const segmentIds = new Set(segments.map(segment => segment.id));
  const constraints = list(data.constraints, 0, 32, '$.constraints').map((value, i): XYLinearSketchConstraintV1 => {
    const path = '$.constraints[' + i + ']'; check(value !== null && typeof value === 'object' && !Array.isArray(value), 'INVALID_DOCUMENT', 'Constraint record required', path);
    const kind = (value as Record<string, unknown>).kind;
    check(kind === 'horizontal' || kind === 'vertical' || kind === 'coincident' || kind === 'fixed' || version === 1 && (kind === 'distance-x' || kind === 'distance-y'), 'UNSUPPORTED', 'Supported linear constraint kind required', path + '.kind');
    const c = record(value, kind === 'distance-x' || kind === 'distance-y' ? ['id', 'kind', 'pointA', 'pointB', 'distanceMM'] : kind === 'fixed' ? ['id', 'kind', 'pointId', 'target'] : kind === 'coincident' ? ['id', 'kind', 'pointA', 'pointB'] : ['id', 'kind', 'segmentId'], path), name = unique(c.id, path + '.id');
    if (kind === 'horizontal' || kind === 'vertical') return { id: name, kind, segmentId: reference(c.segmentId, segmentIds, path + '.segmentId') };
    if (kind === 'fixed') return { id: name, kind, pointId: reference(c.pointId, pointIds, path + '.pointId'), target: xy(c.target, path + '.target') };
    const pointA = reference(c.pointA, pointIds, path + '.pointA'), pointB = reference(c.pointB, pointIds, path + '.pointB');
    check(pointA !== pointB, 'REFERENCE', kind === 'coincident' ? 'Coincidence requires distinct point IDs' : 'Distance #' + name + ' requires distinct point IDs', path);
    if (kind === 'distance-x' || kind === 'distance-y') {
      check(typeof c.distanceMM === 'number', 'INVALID_DOCUMENT', 'Numeric signed distanceMM required', path + '.distanceMM');
      if (!Number.isInteger(c.distanceMM) || Math.abs(c.distanceMM) > 10000) fail('UNSUPPORTED', 'Distance #' + name + ' requires integer mm within +/-10000', path + '.distanceMM', [name]);
      return { id: name, kind, pointA, pointB, distanceMM: c.distanceMM };
    }
    return { id: name, kind, pointA, pointB };
  });
  return version === 0 ? { format: 'barocss-xy-linear-sketch', version: 0, id, lengthUnit: 'mm', points, segments, constraints: constraints as XYLinearSketchConstraint[] }
    : { format: 'barocss-xy-linear-sketch', version: 1, id, lengthUnit: 'mm', points, segments, constraints };
}
function exact(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual) && Array.isArray(expected)) return actual.length === expected.length && actual.every((value, i) => exact(value, expected[i]));
  if (actual && expected && typeof actual === 'object' && typeof expected === 'object') { const a = actual as Record<string, unknown>, b = expected as Record<string, unknown>; return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => Object.hasOwn(b, key) && exact(a[key], b[key])); }
  return Object.is(actual, expected);
}
function solve(document: XYLinearSketchDocumentV0): XYLinearSketchResult {
  const n = document.points.length * 2, parents = Array.from({ length: n }, (_, i) => i);
  const anchors: ({ value: number; order: number } | undefined)[] = Array(n).fill(undefined);
  const provenance = Array.from({ length: n }, () => new Set<string>()), indices = new Map(document.points.map((point, i) => [point.id, i * 2]));
  const root = (index: number): number => { while (parents[index] !== index) index = parents[index]; return index; };
  const conflict = (a: number, b: number, id: string, path: string): never => {
    const involved = new Set([...provenance[a], ...provenance[b], id]);
    return fail('CONFLICT', 'Different exact anchors connected by constraint #' + id, path, document.constraints.filter(c => involved.has(c.id)).map(c => c.id));
  };
  const equal = (a: number, b: number, id: string, path: string): number => {
    a = root(a); b = root(b); if (a === b) { provenance[a].add(id); return 0; }
    const left = anchors[a], right = anchors[b]; if (left && right && left.value !== right.value) conflict(a, b, id, path);
    parents[b] = a; for (const name of provenance[b]) provenance[a].add(name); provenance[a].add(id);
    anchors[a] = left && right ? (left.order <= right.order ? left : right) : left ?? right;
    return left && right ? 0 : 1;
  };
  const pin = (index: number, value: number, id: string, order: number, path: string): number => {
    const r = root(index), anchor = anchors[r]; if (anchor && anchor.value !== value) conflict(r, r, id, path);
    provenance[r].add(id); if (anchor) return 0; anchors[r] = { value, order }; return 1;
  };
  const redundantConstraintIds: string[] = [];
  document.constraints.forEach((constraint, i) => {
    const path = '$.constraints[' + i + ']', coordinate = (id: string) => indices.get(id)!; let increase: number;
    if (constraint.kind === 'fixed') { const p = coordinate(constraint.pointId); increase = pin(p, constraint.target[0], constraint.id, i, path) + pin(p + 1, constraint.target[1], constraint.id, i, path); }
    else if (constraint.kind === 'coincident') { const a = coordinate(constraint.pointA), b = coordinate(constraint.pointB); increase = equal(a, b, constraint.id, path) + equal(a + 1, b + 1, constraint.id, path); }
    else { const segment = document.segments.find(s => s.id === constraint.segmentId)!, axis = constraint.kind === 'horizontal' ? 1 : 0; increase = equal(coordinate(segment.startPointId) + axis, coordinate(segment.endPointId) + axis, constraint.id, path); }
    if (increase === 0) redundantConstraintIds.push(constraint.id);
  });
  const components = new Map<number, number[]>();
  for (let i = 0; i < n; i++) { const r = root(i); if (!components.has(r)) components.set(r, []); components.get(r)!.push(i); }
  const seeds = document.points.flatMap(point => point.position), values: number[] = Array(n), degreesOfFreedom = [...components.keys()].filter(r => !anchors[r]).length;
  for (const [r, members] of components) {
    const anchor = anchors[r]; let value: number;
    if (anchor) value = anchor.value;
    else { let sum = seeds[members[0]]; for (let i = 1; i < members.length; i++) sum += seeds[members[i]]; value = members.length === 1 ? sum : sum / members.length; }
    check(Number.isFinite(value) && Math.abs(value) <= 10000, 'UNSUPPORTED', 'Solved coordinates must remain finite and bounded', '$.points');
    for (const member of members) values[member] = value;
  }
  const points: SketchPoint[] = document.points.map((point, i) => ({ id: point.id, position: [values[i * 2], values[i * 2 + 1]] }));
  return { ok: true, document: copyCadData(document), solution: buildLineSolution(document, points),
    report: { degreesOfFreedom, rank: n - degreesOfFreedom, fullyConstrained: degreesOfFreedom === 0, redundantConstraintIds: [...redundantConstraintIds] } };
}
function solveV1(document: XYLinearSketchDocumentV1): XYLinearSketchResultV1 {
  const dimensions = document.constraints.filter((c): c is Extract<XYLinearSketchConstraintV1, { distanceMM: number }> => c.kind === 'distance-x' || c.kind === 'distance-y');
  if (!dimensions.length) {
    const result = solve({ ...document, version: 0, constraints: document.constraints as XYLinearSketchConstraint[] });
    return result.ok ? { ok: true, document: copyCadData(document), solution: result.solution, report: { ...result.report, dimensions: [] } } : result;
  }
  const n = document.points.length * 2, parents = Array.from({ length: n }, (_, i) => i), offsets = Array(n).fill(0) as number[];
  const provenance = Array.from({ length: n }, () => new Set<string>()), distanceIds = Array.from({ length: n }, () => new Set<string>());
  const indices = new Map(document.points.map((p, i) => [p.id, i * 2])), coordinate = (id: string) => indices.get(id)!;
  const ordered = (ids: Set<string>): string[] => document.constraints.filter(c => ids.has(c.id)).map(c => c.id);
  const find = (index: number): { root: number; potential: number } => {
    let potential = 0;
    while (parents[index] !== index) { potential += offsets[index]; index = parents[index]; }
    check(Number.isSafeInteger(potential) && Math.abs(potential) <= 310000, 'UNSUPPORTED', 'Relative potential exceeds bounded integer family', '$.constraints');
    return { root: index, potential };
  };
  const relations = (c: XYLinearSketchConstraintV1): [number, number, number][] => {
    if (c.kind === 'fixed') return [];
    if (c.kind === 'coincident') { const a = coordinate(c.pointA), b = coordinate(c.pointB); return [[a, b, 0], [a + 1, b + 1, 0]]; }
    if ('distanceMM' in c) { const axis = c.kind === 'distance-x' ? 0 : 1; return [[coordinate(c.pointA) + axis, coordinate(c.pointB) + axis, c.distanceMM]]; }
    const segment = document.segments.find(s => s.id === c.segmentId)!, axis = c.kind === 'horizontal' ? 1 : 0;
    return [[coordinate(segment.startPointId) + axis, coordinate(segment.endPointId) + axis, 0]];
  };
  // Complete relative graph consistency precedes family/anchor checks.
  document.constraints.forEach((c, i) => {
    for (const [a, b, distance] of relations(c)) {
      const left = find(a), right = find(b), r = left.root, q = right.root;
      if (r === q && right.potential - left.potential !== distance) fail('CONFLICT', 'Inconsistent signed relation cycle at #' + c.id, '$.constraints[' + i + ']', ordered(new Set([...provenance[r], c.id])));
      if (r !== q) {
        parents[q] = r; offsets[q] = distance + left.potential - right.potential;
        check(Number.isSafeInteger(offsets[q]) && Math.abs(offsets[q]) <= 310000, 'UNSUPPORTED', 'Relative potential exceeds bounded integer family', '$.constraints[' + i + ']');
        for (const id of provenance[q]) provenance[r].add(id);
        for (const id of distanceIds[q]) distanceIds[r].add(id);
      }
      provenance[r].add(c.id);
      if (c.kind === 'distance-x' || c.kind === 'distance-y') distanceIds[r].add(c.id);
    }
  });
  const components = new Map<number, number[]>();
  for (let i = 0; i < n; i++) { const r = find(i).root; if (!components.has(r)) components.set(r, []); components.get(r)!.push(i); }
  interface Pin { member: number; value: number; id: string; order: number }
  const pins = new Map<number, Pin[]>();
  document.constraints.forEach((c, order) => {
    if (c.kind !== 'fixed') return;
    for (let axis = 0; axis < 2; axis++) { const member = coordinate(c.pointId) + axis, r = find(member).root; if (!pins.has(r)) pins.set(r, []); pins.get(r)!.push({ member, value: c.target[axis], id: c.id, order }); }
  });
  for (const [r] of components) {
    if (!distanceIds[r].size) continue;
    const ids = ordered(distanceIds[r]), first = document.constraints.findIndex(c => c.id === ids[0]), anchors = pins.get(r) ?? [];
    if (!anchors.length) fail('UNSUPPORTED', 'Distance component #' + ids[0] + ' requires a fixed integer axis target', '$.constraints[' + first + ']', ids);
    const fractional = anchors.find(pin => !Number.isInteger(pin.value));
    if (fractional) fail('UNSUPPORTED', 'Distance #' + ids[0] + ' has fractional fixed-axis target #' + fractional.id, '$.constraints[' + first + ']', ordered(new Set([...ids, fractional.id])));
  }
  const anchors = new Map<number, Pin>();
  for (const [r, componentPins] of pins) {
    const first = componentPins[0], used = new Set([...provenance[r], first.id]); anchors.set(r, first);
    for (const pin of componentPins.slice(1)) {
      const delta = find(pin.member).potential - find(first.member).potential, expected = delta === 0 ? first.value : first.value + delta;
      used.add(pin.id);
      if (expected !== pin.value) fail('CONFLICT', 'Different exact anchors connected by constraint #' + pin.id, '$.constraints[' + pin.order + ']', ordered(used));
    }
  }
  const values: number[] = Array(n), seeds = document.points.flatMap(p => p.position), degreesOfFreedom = [...components.keys()].filter(r => !anchors.has(r)).length;
  for (const [r, members] of components) {
    const anchor = anchors.get(r);
    if (anchor) {
      const base = find(anchor.member).potential;
      for (const member of members) { const delta = find(member).potential - base; values[member] = delta === 0 ? anchor.value : anchor.value + delta; }
    } else {
      let sum = seeds[members[0]]; for (let i = 1; i < members.length; i++) sum += seeds[members[i]];
      const value = members.length === 1 ? sum : sum / members.length; for (const member of members) values[member] = value;
    }
    const invalid = members.find(member => !Number.isFinite(values[member]) || Math.abs(values[member]) > 10000 || distanceIds[r].size > 0 && !Number.isSafeInteger(values[member]));
    if (invalid !== undefined) fail('UNSUPPORTED', 'Solved coordinates outside supported distance/bound family', '$.points[' + Math.floor(invalid / 2) + ']', ordered(distanceIds[r]));
  }
  // Independent chronological condition counting includes pins at their authored position.
  const rankParents = Array.from({ length: n }, (_, i) => i), rankAnchored = Array(n).fill(false) as boolean[];
  const rankRoot = (index: number): number => { while (rankParents[index] !== index) index = rankParents[index]; return index; };
  const join = (a: number, b: number): number => { a = rankRoot(a); b = rankRoot(b); if (a === b) return 0; const increase = rankAnchored[a] && rankAnchored[b] ? 0 : 1; rankParents[b] = a; rankAnchored[a] ||= rankAnchored[b]; return increase; };
  const redundantConstraintIds: string[] = []; let rank = 0;
  for (const c of document.constraints) {
    let increase = 0;
    if (c.kind === 'fixed') { const p = coordinate(c.pointId); for (const member of [p, p + 1]) { const r = rankRoot(member); if (!rankAnchored[r]) { rankAnchored[r] = true; increase++; } } }
    else for (const [a, b] of relations(c)) increase += join(a, b);
    rank += increase; if (increase === 0) redundantConstraintIds.push(c.id);
  }
  check(rank === n - degreesOfFreedom, 'COMPILATION', 'Chronological rank and final scalar DOF differ', '$.report');
  const points: SketchPoint[] = document.points.map((p, i) => ({ id: p.id, position: [values[i * 2], values[i * 2 + 1]] })), solved = new Map(points.map(p => [p.id, p.position]));
  const reports: XYLinearSketchDimensionReport[] = dimensions.map(c => {
    const axis = c.kind === 'distance-x' ? 0 : 1, actualMM = solved.get(c.pointB)![axis] - solved.get(c.pointA)![axis];
    check(actualMM === c.distanceMM, 'COMPILATION', 'Actual solved driving distance differs from authored #' + c.id, '$.report.dimensions');
    return { id: c.id, axis: axis === 0 ? 'x' : 'y', pointA: c.pointA, pointB: c.pointB, requestedMM: c.distanceMM, actualMM };
  });
  return { ok: true, document: copyCadData(document), solution: buildLineSolution(document, points), report: { degreesOfFreedom, rank, fullyConstrained: degreesOfFreedom === 0, redundantConstraintIds, dimensions: copyCadData(reports) } };
}
function buildLineSolution(document: Pick<XYLinearSketchDocumentV0, 'id' | 'segments'>, points: SketchPoint[]): Extract<XYLinearSketchResult, { ok: true }>['solution'] {
  const solved = new Map(points.map(point => [point.id, point.position]));
  const curves = document.segments.map((segment, i) => {
    const a = solved.get(segment.startPointId)!, b = solved.get(segment.endPointId)!;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < .001) fail('DEGENERATE_GEOMETRY', 'Solved segment #' + segment.id + ' is collapsed or shorter than 0.001 mm', '$.segments[' + i + ']');
    return buildXYProfile({ kind: 'line', id: segment.id, points: [[...a], [...b]] }).curve;
  });
  const source = '@model ' + document.id + ' { version:0; length-unit:mm; ' + curves.map(curve => '@curve #' + curve.id + ' { type:nurbs; degree:1; knots:[0,0,1,1]; control-points:[' + curve.controlPoints.map(point => '[' + point.map(value => curveDecimal(value, 'XY linear sketch')).join(',') + ']').join(',') + ']; weights:[1,1]; }').join(' ') + ' }\n';
  const compiled = compileCadModel(source, { sourceVersion: 0 });
  if (!compiled.ok) fail('COMPILATION', 'Actual complete line source failed: ' + compiled.diagnostics[0].message, '$.solution.source');
  check(compiled.ir.schemaVersion === 1 && exact(compiled.model.objects, curves), 'COMPILATION', 'Compiled native line identities/coefficients differ from actual profiles', '$.solution.model');
  return { points: copyCadData(points), source, sourceVersion: 0, model: copyCadData(compiled.model), ir: copyCadData(compiled.ir) };
}
/** One bounded own snapshot, exact scalar equalities/anchors and original compiled lines. */
export function solveXYLinearSketch(document: XYLinearSketchDocumentV0): XYLinearSketchResult;
export function solveXYLinearSketch(document: XYLinearSketchDocumentV1): XYLinearSketchResultV1;
export function solveXYLinearSketch(document: XYLinearSketchDocumentV0 | XYLinearSketchDocumentV1): XYLinearSketchResult | XYLinearSketchResultV1;
export function solveXYLinearSketch(document: XYLinearSketchDocumentV0 | XYLinearSketchDocumentV1): XYLinearSketchResult | XYLinearSketchResultV1 {
  let label = '?', phase: XYLinearSketchDiagnostic['code'] = 'INVALID_DOCUMENT';
  try {
    if (document !== null && typeof document === 'object') { const descriptor = Object.getOwnPropertyDescriptor(document, 'id'); if (descriptor && 'value' in descriptor && typeof descriptor.value === 'string' && descriptor.value.length <= 80 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(descriptor.value)) label = descriptor.value; }
    const admitted = admit(document); label = admitted.id; phase = 'COMPILATION'; return admitted.version === 0 ? solve(admitted) : solveV1(admitted);
  } catch (error) {
    const failure = error instanceof SketchFailure ? error : new SketchFailure(phase, error instanceof Error ? error.message : 'Rejected sketch data/native computation', '$');
    return { ok: false, diagnostics: [{ code: failure.code, message: ('XY linear sketch #' + label + ': ' + failure.message).slice(0, 512), path: failure.path.slice(0, 256), constraintIds: [...failure.constraintIds] }] };
  }
}
