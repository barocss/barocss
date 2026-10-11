import { Canvas2DError } from './schema.js';
import type { Point } from './schema.js';
import type { PolygonContour, PolygonBooleanResult } from './boolean.js';

type Rational = { n: bigint; d: bigint };
type Vertex = { x: Rational; y: Rational };
function unsupported(message: string): never { throw new Canvas2DError('UNSUPPORTED_FEATURE', message); }
function limit(message: string): never { throw new Canvas2DError('SCENE_LIMIT', message); }
function bounded(value: bigint): bigint {
  if ((value < 0n ? -value : value).toString(2).length > 512) limit('convex arithmetic exceeds 512 bits');
  return value;
}
function rational(n: bigint, d = 1n): Rational {
  bounded(n); bounded(d);
  if (d === 0n) unsupported('convex intersection has a zero denominator');
  if (d < 0n) { n = -n; d = -d; }
  let a = n < 0n ? -n : n, b = d;
  while (b) { const next = a % b; a = b; b = next; }
  return { n: n / a, d: d / a };
}
const add = (a: Rational, b: Rational): Rational => rational(bounded(bounded(a.n * b.d) + bounded(b.n * a.d)), bounded(a.d * b.d));
const subtract = (a: Rational, b: Rational): Rational => rational(bounded(bounded(a.n * b.d) - bounded(b.n * a.d)), bounded(a.d * b.d));
const multiply = (a: Rational, b: Rational): Rational => rational(bounded(a.n * b.n), bounded(a.d * b.d));
const divide = (a: Rational, b: Rational): Rational => rational(bounded(a.n * b.d), bounded(a.d * b.n));
const compare = (a: Rational, b: Rational): bigint => bounded(bounded(a.n * b.d) - bounded(b.n * a.d));
const equal = (a: Vertex, b: Vertex): boolean => compare(a.x, b.x) === 0n && compare(a.y, b.y) === 0n;
function turn(a: Vertex, b: Vertex, c: Vertex): Rational {
  return subtract(multiply(subtract(b.x, a.x), subtract(c.y, a.y)),
    multiply(subtract(b.y, a.y), subtract(c.x, a.x)));
}
function exact(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    unsupported('convex inputs must use ordinary records');
  }
  const keys = Reflect.ownKeys(value), descriptors = Object.getOwnPropertyDescriptors(value);
  if (keys.length !== fields.length || keys.some(key => typeof key !== 'string' || !fields.includes(key)) ||
      fields.some(key => !descriptors[key]?.enumerable || !('value' in descriptors[key]))) {
    unsupported('convex inputs require exact own data fields');
  }
  return Object.fromEntries(fields.map(key => [key, descriptors[key].value]));
}
function copied(input: PolygonContour): PolygonContour {
  const object = exact(input, ['id', 'points']);
  if (typeof object.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(object.id)) unsupported('convex ID is invalid');
  const array = object.points;
  if (!Array.isArray(array) || Object.getPrototypeOf(array) !== Array.prototype) unsupported('convex points need an ordinary array');
  const count = Object.getOwnPropertyDescriptor(array, 'length')?.value;
  if (!Number.isInteger(count) || count < 3) unsupported('convex input needs at least 3 vertices');
  if (count > 32) limit('convex input exceeds 32 vertices');
  if (Reflect.ownKeys(array).length !== count + 1) unsupported('convex points need dense entries without extras');
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(array, String(i));
    if (!descriptor?.enumerable || !('value' in descriptor)) unsupported('convex points must be data entries');
    const point = exact(descriptor.value, ['x', 'y']);
    for (const key of ['x', 'y']) {
      if (typeof point[key] !== 'number' || !Number.isInteger(point[key]) || Object.is(point[key], -0) ||
          Math.abs(point[key]) > 4096) unsupported('convex coordinates must be integers within [-4096,4096]');
    }
    points.push({ x: point.x as number, y: point.y as number });
  }
  return { id: object.id, points };
}
const vertex = (p: Point): Vertex => ({ x: rational(BigInt(p.x)), y: rational(BigInt(p.y)) });
function onSegment(a: Vertex, b: Vertex, p: Vertex): boolean {
  return turn(a, b, p).n === 0n &&
    ((compare(p.x, a.x) <= 0n && compare(p.x, b.x) >= 0n) || (compare(p.x, a.x) >= 0n && compare(p.x, b.x) <= 0n)) &&
    ((compare(p.y, a.y) <= 0n && compare(p.y, b.y) >= 0n) || (compare(p.y, a.y) >= 0n && compare(p.y, b.y) <= 0n));
}
function meets(a: Vertex, b: Vertex, c: Vertex, d: Vertex): boolean {
  const u = turn(a, b, c).n, v = turn(a, b, d).n, w = turn(c, d, a).n, z = turn(c, d, b).n;
  return onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b) ||
    (u !== 0n && v !== 0n && w !== 0n && z !== 0n && (u < 0n) !== (v < 0n) && (w < 0n) !== (z < 0n));
}
function ring(points: Point[]): Vertex[] {
  const result = points.map(vertex);
  let sign = 0;
  for (let i = 0; i < result.length; i++) {
    const a = result[i], b = result[(i + 1) % result.length], c = result[(i + 2) % result.length];
    if (result.some((p, j) => j !== i && equal(a, p))) unsupported('convex vertices must be distinct');
    const cross = turn(a, b, c).n, nextSign = cross > 0n ? 1 : cross < 0n ? -1 : 0;
    if (!nextSign || (sign && sign !== nextSign)) unsupported('convex ring must be strictly convex without collinear vertices');
    sign = nextSign;
    for (let j = i + 1; j < result.length; j++) {
      if (j === i + 1 || (i === 0 && j === result.length - 1)) continue;
      if (meets(a, b, result[j], result[(j + 1) % result.length])) unsupported('convex ring must be simple');
    }
  }
  return sign > 0 ? result : result.reverse();
}
function cleaned(points: Vertex[]): Vertex[] {
  const result = points.filter((point, i) => !equal(point, points[(i + points.length - 1) % points.length]));
  let changed = true;
  while (changed && result.length >= 3) {
    changed = false;
    for (let i = 0; i < result.length; i++) {
      if (turn(result[(i + result.length - 1) % result.length], result[i], result[(i + 1) % result.length]).n === 0n) {
        result.splice(i, 1); changed = true; break;
      }
    }
  }
  return result;
}

/** Copied convex intersection. sourceIds records both operands, not edge lineage. */
export function intersectConvexPolygons(left: PolygonContour, right: PolygonContour): PolygonBooleanResult {
  const l = copied(left), r = copied(right);
  if (l.id === r.id) unsupported('convex operand IDs must be unique');
  const a = ring(l.points), b = ring(r.points);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    const p = a[i], q = a[(i + 1) % a.length], u = b[j], v = b[(j + 1) % b.length];
    if (onSegment(p, q, u) || onSegment(p, q, v) || onSegment(u, v, p) || onSegment(u, v, q)) {
      unsupported('convex operands touch or overlap');
    }
  }
  let output = a, visits = 0;
  for (let i = 0; i < b.length && output.length; i++) {
    const next: Vertex[] = [], p = b[i], q = b[(i + 1) % b.length];
    let prior = output[output.length - 1], priorDistance = turn(p, q, prior);
    for (const current of output) {
      if (++visits > 2048) limit('convex clipping exceeds 2048 visits');
      const distance = turn(p, q, current);
      if ((priorDistance.n >= 0n) !== (distance.n >= 0n)) {
        const t = divide(priorDistance, subtract(priorDistance, distance));
        next.push({ x: add(prior.x, multiply(t, subtract(current.x, prior.x))),
          y: add(prior.y, multiply(t, subtract(current.y, prior.y))) });
      }
      if (distance.n >= 0n) next.push(current);
      if (next.length > 64) limit('convex output exceeds 64 vertices');
      prior = current; priorDistance = distance;
    }
    output = cleaned(next);
  }
  if (output.length < 3) return { operation: 'intersection', inputIds: { left: [l.id], right: [r.id] }, contours: [] };
  let first = 0;
  for (let i = 1; i < output.length; i++) {
    const dx = compare(output[i].x, output[first].x);
    if (dx < 0n || (dx === 0n && compare(output[i].y, output[first].y) < 0n)) first = i;
  }
  output = [...output.slice(first), ...output.slice(0, first)];
  const points = output.map(p => ({ x: Number(p.x.n) / Number(p.x.d), y: Number(p.y.n) / Number(p.y.d) }));
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length], r = points[(i + 2) % points.length];
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x) <= 0) {
      unsupported('convex output collapses after Number conversion');
    }
    // Exact rational zero is serialized as the ordinary Scene zero.
    if (Object.is(p.x, -0)) p.x = 0;
    if (Object.is(p.y, -0)) p.y = 0;
  }
  return { operation: 'intersection', inputIds: { left: [l.id], right: [r.id] },
    contours: [{ id: 'ResultContour1', orientation: 'outer', sourceIds: [l.id, r.id], points }] };
}
