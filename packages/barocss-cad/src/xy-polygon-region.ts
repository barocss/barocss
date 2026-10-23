import { compileCurveSource } from './nurbs/curves/curve-source.js';
import { validateCurve } from './math.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Model, Point } from './types.js';
import type { XYPoint } from './xy-profile.js';

export interface XYPolygonRegionRequest { id: string; points: XYPoint[] }
export interface XYPolygonRegionReport {
  valid: true; geometryFamily: 'exact-simple-integer-xy-polygon-v0'; lengthUnit: 'mm';
  regionCertified: true; topologicalWire: false; face: false; solid: false;
  orientation: 'ccw' | 'cw'; vertexCount: number; segmentCount: number;
  parameterDomain: { min: number; max: number }; signedAreaMM2: number; areaMM2: number;
  boundsMM: { min: Point; max: Point };
  edges: { segmentIndex: number; parameterRange: [number, number]; startVertexIndex: number; endVertexIndex: number }[];
}
export interface XYPolygonRegionResult { source: string; sourceVersion: 0; model: Model; curve: Curve; region: XYPolygonRegionReport }
function label(input: unknown): string {
  if (input !== null && typeof input === 'object') {
    const descriptor = Object.getOwnPropertyDescriptor(input, 'id');
    if (descriptor && 'value' in descriptor && typeof descriptor.value === 'string' && descriptor.value.length <= 128 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(descriptor.value)) return 'XY polygon region #' + descriptor.value;
  }
  return 'XY polygon region';
}
function check(condition: boolean, context: string, path: string, detail: string): asserts condition {
  if (!condition) throw new Error((context + ': ' + path.slice(0, 256) + ': ' + detail).slice(0, 512));
}
/** This local bound admits native Curves without changing parent snapshot contracts. */
function snapshot(input: unknown, context: string): unknown {
  let remaining = 4096;
  const copy = (value: unknown, depth: number, path: string): unknown => {
    check(--remaining >= 0 && depth <= 4, context, path, 'input exceeds 4096 own values/depth 4');
    if (typeof value === 'number') { check(Number.isFinite(value), context, path, 'finite numeric data required'); return value; }
    if (typeof value === 'string') { check(value.length <= 128, context, path, 'string exceeds 128 characters'); return value; }
    check(value !== null && typeof value === 'object', context, path, 'ordinary numeric/string/record data required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    check(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, context, path, 'foreign prototype is unsupported');
    const keys = Reflect.ownKeys(value);
    check(keys.length <= (array ? 71 : 8) && keys.every(key => typeof key === 'string' && key.length <= 128), context, path, 'bounded own fields/strings required; records8/arrays70');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    check(keys.every(key => typeof key === 'string' && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), context, path, 'accessors, symbols and hidden fields are unsupported');
    if (array) {
      const length = descriptors.length.value as number;
      check(Number.isInteger(length) && length >= 0 && length <= 70 && keys.length === length + 1, context, path, 'ordinary dense bounded arrays required');
      const result: unknown[] = [];
      for (let i = 0; i < length; i++) { check(Object.hasOwn(descriptors, String(i)), context, path, 'sparse or extra array fields are unsupported'); result.push(copy(descriptors[String(i)].value, depth + 1, path + '[' + i + ']')); }
      return result;
    }
    return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1, path + '.' + key)]));
  };
  return copy(input, 0, '$');
}
function record(value: unknown, fields: string[], context: string): Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value), context, '$', 'own-data record required');
  const data = value as Record<string, unknown>;
  check(Object.keys(data).length === fields.length && fields.every(key => Object.hasOwn(data, key)), context, '$', 'exact fields required: ' + fields.join(',')); return data;
}
function identifier(value: unknown, context: string): string {
  check(typeof value === 'string' && value.length <= 128 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value), context, '$.id', 'ASCII identifier of length 1..128 required'); return value;
}
function xy(value: unknown, rank: 2 | 3, context: string, path: string): XYPoint {
  check(Array.isArray(value) && value.length === rank && value.every(n => typeof n === 'number'), context, path, 'coordinate tuple rank must be ' + rank);
  check(value.slice(0, 2).every(n => Number.isInteger(n) && Math.abs(n) <= 10000) && (rank === 2 || value[2] === 0), context, path, 'integer XY within +/-10000 and numeric Z0 required');
  return [value[0], value[1]];
}
function canonicalKnots(n: number): number[] { return [0, 0, ...Array.from({ length: n - 1 }, (_, i) => i + 1), n, n]; }
function classify(points: XYPoint[], context: string, path: string): XYPolygonRegionReport {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) check(points[i][0] !== points[j][0] || points[i][1] !== points[j][1], context, path + '[' + j + ']', 'duplicate vertex location at indices ' + i + '/' + j);
    const next = points[(i + 1) % n]; check(points[i][0] !== next[0] || points[i][1] !== next[1], context, path + '[' + i + ']', 'nonzero segment required');
  }
  const orientation = (a: XYPoint, b: XYPoint, c: XYPoint): number => {
    const dx = b[0] - a[0], dy = b[1] - a[1], ex = c[0] - a[0], ey = c[1] - a[1];
    check([dx, dy, ex, ey].every(value => Number.isSafeInteger(value) && Math.abs(value) <= 20000), context, path, 'unsafe coordinate difference');
    const left = dx * ey, right = dy * ex, determinant = left - right;
    check(Number.isSafeInteger(left) && Number.isSafeInteger(right) && Math.abs(left) <= 4e8 && Math.abs(right) <= 4e8 && Number.isSafeInteger(determinant) && Math.abs(determinant) <= 8e8, context, path, 'unsafe exact orientation arithmetic');
    return determinant;
  };
  const on = (a: XYPoint, b: XYPoint, p: XYPoint): boolean => orientation(a, b, p) === 0 && p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
  const opposite = (a: number, b: number): boolean => a < 0 && b > 0 || a > 0 && b < 0;
  let pairs = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    check(++pairs <= 1953, context, path, 'pair budget exceeded');
    const a = points[i], b = points[(i + 1) % n], c = points[j], d = points[(j + 1) % n];
    const o1 = orientation(a, b, c), o2 = orientation(a, b, d), o3 = orientation(c, d, a), o4 = orientation(c, d, b);
    const meets = opposite(o1, o2) && opposite(o3, o4) || on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b);
    if (!meets) continue;
    const adjacent = j === i + 1 || i === 0 && j === n - 1;
    const detail = 'segments ' + i + ' [' + i + ',' + (i + 1) + '] and ' + j + ' [' + j + ',' + (j + 1) + ']';
    check(adjacent, context, path, 'nonadjacent crossing/touch/overlap: ' + detail);
    const common = j === i + 1 ? b : a, first = j === i + 1 ? a : b, second = j === i + 1 ? d : c;
    check(orientation(first, common, second) !== 0 || !(on(first, common, second) || on(common, second, first)), context, path, 'adjacent backtracking/overlap: ' + detail);
  }
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n], left = a[0] * b[1], right = a[1] * b[0];
    check(Number.isSafeInteger(left) && Number.isSafeInteger(right) && Math.abs(left) <= 1e8 && Math.abs(right) <= 1e8, context, path, 'unsafe exact area product');
    sum += left - right; check(Number.isSafeInteger(sum) && Math.abs(sum) <= 1.26e10, context, path, 'unsafe aggregate signed double area');
  }
  check(sum !== 0, context, path, 'zero-area polygon has no certified region');
  return { valid: true, geometryFamily: 'exact-simple-integer-xy-polygon-v0', lengthUnit: 'mm', regionCertified: true, topologicalWire: false, face: false, solid: false,
    orientation: sum > 0 ? 'ccw' : 'cw', vertexCount: n, segmentCount: n, parameterDomain: { min: 0, max: n }, signedAreaMM2: sum / 2, areaMM2: Math.abs(sum) / 2,
    boundsMM: { min: [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), 0], max: [Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1])), 0] },
    edges: points.map((_, i) => ({ segmentIndex: i, parameterRange: [i, i + 1], startVertexIndex: i, endVertexIndex: (i + 1) % n })) };
}
/** A mathematical simple-region certificate, not a topological wire/face/solid. */
export function validateXYPolygonRegion(curve: Curve): XYPolygonRegionReport {
  const context = label(curve), data = record(snapshot(curve, context), ['kind', 'id', 'degree', 'knots', 'controlPoints', 'weights'], context);
  identifier(data.id, context); check(data.kind === 'curve' && data.degree === 1, context, '$.kind/degree', 'canonical degree1 Curve required');
  check(Array.isArray(data.controlPoints) && data.controlPoints.length >= 4 && data.controlPoints.length <= 64, context, '$.controlPoints', '4..64 canonical poles required');
  const points = data.controlPoints.map((point, i) => xy(point, 3, context, '$.controlPoints[' + i + ']')), n = points.length - 1;
  check(points[0][0] === points[n][0] && points[0][1] === points[n][1], context, '$.controlPoints', 'exact repeated first/last coordinates required');
  const knots = canonicalKnots(n);
  check(Array.isArray(data.knots) && data.knots.length === knots.length && data.knots.every((value, i) => value === knots[i]), context, '$.knots', 'exact canonical uniform clamped knots required');
  check(Array.isArray(data.weights) && data.weights.length === n + 1 && data.weights.every(value => value === 1), context, '$.weights', 'unit weights required');
  validateCurve(data as unknown as Curve);
  return classify(points.slice(0, n), context, '$.controlPoints');
}
/** Preserve authored order and adopt only actual source0/native coefficients. */
export function buildXYPolygonRegion(request: XYPolygonRegionRequest): XYPolygonRegionResult {
  const context = label(request), data = record(snapshot(request, context), ['id', 'points'], context), id = identifier(data.id, context);
  check(Array.isArray(data.points) && data.points.length >= 3 && data.points.length <= 63, context, '$.points', '3..63 distinct authored vertices without repeated endpoint required');
  const points = data.points.map((point, i) => xy(point, 2, context, '$.points[' + i + ']'));
  classify(points, context, '$.points');
  const poles: Point[] = points.map(([x, y]) => [x, y, 0]); poles.push([...poles[0]]);
  const compiled = compileCurveSource(id, 1, poles, canonicalKnots(points.length), Array(poles.length).fill(1), context), region = validateXYPolygonRegion(compiled.curve);
  return { source: compiled.source, sourceVersion: 0, model: copyCadData(compiled.model), curve: copyCadData(compiled.curve), region: copyCadData(region) };
}
