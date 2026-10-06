import { compileCadModel } from './model-compiler.js';
import { validateCurve } from './math.js';
import { copyCadData } from './data-copy.js';
import type { Curve, Model, Point } from './types.js';

export type XYPoint = [number, number];
export type XYProfileRequest = { kind: 'line'; id: string; points: [XYPoint, XYPoint] }
  | { kind: 'polyline'; id: string; points: XYPoint[] }
  | { kind: 'rectangle'; id: string; origin: XYPoint; width: number; height: number };
export interface XYProfileReport {
  kind: XYProfileRequest['kind']; plane: 'xy'; lengthUnit: 'mm';
  vertexCount: number; segmentCount: number; parameterDomain: { min: number; max: number };
  endpointClosed: boolean; regionCertified: false; solid: false;
}
export interface XYProfileResult { source: string; sourceVersion: 0; model: Model; curve: Curve; report: XYProfileReport }
function requireValue(condition: boolean, detail: string): asserts condition {
  if (!condition) throw new Error('XY profile: ' + detail);
}
function snapshot(input: unknown): unknown {
  let remaining = 1024;
  const copy = (value: unknown, depth: number): unknown => {
    requireValue(--remaining >= 0 && depth <= 4, 'input exceeds own-value/depth budget');
    if (typeof value === 'number') { requireValue(Number.isFinite(value), 'finite numeric data required'); return value; }
    if (typeof value === 'string') { requireValue(value.length <= 128, 'string exceeds 128 characters'); return value; }
    requireValue(value !== null && typeof value === 'object', 'plain numeric/string/record data required');
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    requireValue(array ? prototype === Array.prototype : prototype === Object.prototype || prototype === null, 'foreign prototype is unsupported');
    const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
    requireValue(keys.length <= (array ? 65 : 5), 'input record/array exceeds field bound');
    requireValue(keys.every(key => typeof key === 'string' && 'value' in descriptors[key] && (array && key === 'length' || descriptors[key].enumerable === true)), 'getters, symbols or nonenumerable fields are unsupported');
    if (array) {
      const length = descriptors.length.value as number;
      requireValue(Number.isInteger(length) && length <= 64 && keys.length === length + 1, 'dense bounded arrays required');
      const result: unknown[] = [];
      for (let i = 0; i < length; i++) { requireValue(Object.hasOwn(descriptors, String(i)), 'sparse or foreign array fields are unsupported'); result.push(copy(descriptors[String(i)].value, depth + 1)); }
      return result;
    }
    return Object.fromEntries((keys as string[]).map(key => [key, copy(descriptors[key].value, depth + 1)]));
  };
  return copy(input, 0);
}
function xy(value: unknown): XYPoint {
  requireValue(Array.isArray(value) && value.length === 2, 'XY coordinate rank must be two');
  requireValue(value.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 10000), 'XY coordinates must be finite and within 10000 mm');
  return [value[0] as number, value[1] as number];
}
/** Expand the shortest round-trippable binary64 spelling into current decimals. */
function decimal(value: number): string {
  requireValue(Number.isFinite(value), 'finite source literal required');
  if (Object.is(value, -0)) return '-0';
  const text = String(value);
  if (!/[eE]/.test(text)) return text;
  const negative = text.startsWith('-'), unsigned = negative ? text.slice(1) : text;
  const [coefficient, exponent] = unsigned.split(/[eE]/), pieces = coefficient.split('.');
  const digits = pieces.join(''), position = pieces[0].length + Number(exponent);
  requireValue(digits.length <= 17 && Number.isInteger(position) && position >= -324 && position <= 309, 'bounded decimal expansion required');
  const expanded = position <= 0 ? '0.' + '0'.repeat(-position) + digits
    : position >= digits.length ? digits + '0'.repeat(position - digits.length)
      : digits.slice(0, position) + '.' + digits.slice(position);
  const result = (negative ? '-' : '') + expanded;
  requireValue(result.length <= 350 && Object.is(Number(result), value), 'source literal must round-trip binary64');
  return result;
}
function sameNumbers(actual: number[], expected: number[]): boolean {
  return actual.length === expected.length && actual.every((n, i) => Object.is(n, expected[i]));
}

/** Bounded XY curves through actual source0 compilation; no region/solid proof. */
export function buildXYProfile(request: XYProfileRequest): XYProfileResult {
  const owned = snapshot(request);
  requireValue(owned !== null && typeof owned === 'object' && !Array.isArray(owned), 'request record required');
  const data = owned as Record<string, unknown>, kind = data.kind;
  requireValue(kind === 'line' || kind === 'polyline' || kind === 'rectangle', 'unsupported profile kind');
  const fields = kind === 'rectangle' ? ['kind', 'id', 'origin', 'width', 'height'] : ['kind', 'id', 'points'];
  requireValue(Object.keys(data).length === fields.length && fields.every(key => Object.hasOwn(data, key)), 'exact request fields required');
  requireValue(typeof data.id === 'string' && data.id.length <= 128 && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(data.id), 'supported ASCII ID within 128 characters required');
  let vertices: XYPoint[];
  if (kind === 'rectangle') {
    const origin = xy(data.origin), width = data.width, height = data.height;
    requireValue(typeof width === 'number' && width >= .001 && width <= 10000 && typeof height === 'number' && height >= .001 && height <= 10000, 'rectangle dimensions must be in 0.001..10000 mm');
    const [x, y] = origin;
    vertices = [xy([x, y]), xy([x + width, y]), xy([x + width, y + height]), xy([x, y + height]), xy([x, y])];
  } else {
    requireValue(Array.isArray(data.points) && data.points.length >= 2 && data.points.length <= 64 && (kind !== 'line' || data.points.length === 2), 'line requires two points; polyline requires 2..64');
    vertices = data.points.map(xy);
    const first = vertices[0], last = vertices.at(-1)!;
    requireValue(first[0] !== last[0] || first[1] !== last[1], 'polyline/line endpoints must remain open');
  }
  for (let i = 1; i < vertices.length; i++) {
    const length = Math.hypot(vertices[i][0] - vertices[i - 1][0], vertices[i][1] - vertices[i - 1][1]);
    requireValue(Number.isFinite(length) && length >= .001, 'actual adjacent segment must be at least 0.001 mm');
  }
  const controlPoints: Point[] = vertices.map(([x, y]) => [x, y, 0]), count = controlPoints.length;
  const knots = [0, 0, ...Array.from({ length: count - 2 }, (_, i) => i + 1), count - 1, count - 1], weights = Array<number>(count).fill(1);
  const source = '@model profile { version:0; length-unit:mm; @curve #' + data.id + ' { type:nurbs; degree:1; knots:[' + knots.map(decimal).join(',') + ']; control-points:[' + controlPoints.map(point => '[' + point.map(decimal).join(',') + ']').join(',') + ']; weights:[' + weights.map(decimal).join(',') + ']; } }\n';
  requireValue(source.length <= 262144, 'generated source exceeds compiler byte bound');
  const compiled = compileCadModel(source, { sourceVersion: 0 });
  requireValue(compiled.ok, 'generated source must compile through the actual source0 compiler');
  requireValue(compiled.model.objects.length === 1 && compiled.model.objects[0].kind === 'curve', 'one actual compiled curve required');
  const curve = compiled.model.objects[0]; validateCurve(curve);
  requireValue(curve.id === data.id && curve.degree === 1 && sameNumbers(curve.knots, knots) && sameNumbers(curve.weights, weights)
    && curve.controlPoints.length === count && curve.controlPoints.every((point, i) => sameNumbers(point, controlPoints[i])), 'compiled source must preserve exact native values/order/identity');
  return { source, sourceVersion: 0, model: copyCadData(compiled.model), curve: copyCadData(curve), report: {
    kind, plane: 'xy', lengthUnit: 'mm', vertexCount: count, segmentCount: count - 1,
    parameterDomain: { min: 0, max: count - 1 }, endpointClosed: kind === 'rectangle', regionCertified: false, solid: false,
  } };
}
