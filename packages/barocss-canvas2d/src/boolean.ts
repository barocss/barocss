import { Canvas2DError } from './schema.js';
import type { Point } from './schema.js';

export type PolygonContour = { id: string; points: Point[] };
export type PolygonOperand = { contours: PolygonContour[] };
export type PolygonOperation = 'union' | 'intersection' | 'difference';
export type PolygonBooleanResult = {
  operation: PolygonOperation;
  inputIds: { left: string[]; right: string[] };
  contours: { id: string; orientation: 'outer' | 'hole'; sourceIds: string[]; points: Point[] }[];
};

type Edge = { a: Point; b: Point; sourceId: string };
type DirectedEdge = { a: Point; b: Point };
type Operand = { contours: PolygonContour[]; edges: Edge[] };
const idPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

function refuse(message: string): never { throw new Canvas2DError('UNSUPPORTED_FEATURE', message); }
function limit(message: string): never { throw new Canvas2DError('SCENE_LIMIT', message); }
function pointKey(p: Point): string { return `${p.x},${p.y}`; }
function same(a: Point, b: Point): boolean { return a.x === b.x && a.y === b.y; }
function horizontal(e: Edge): boolean { return e.a.y === e.b.y; }
function between(value: number, a: number, b: number, strict = false): boolean {
  return strict ? value > Math.min(a, b) && value < Math.max(a, b) :
    value >= Math.min(a, b) && value <= Math.max(a, b);
}
function signedArea(points: Point[]): number {
  let twice = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    twice += a.x * b.y - b.x * a.y;
  }
  return twice / 2;
}
function pointInRing(p: Point, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (a.y !== b.y && (a.y > p.y) !== (b.y > p.y) &&
        p.x < a.x + (p.y - a.y) * (b.x - a.x) / (b.y - a.y)) inside = !inside;
  }
  return inside;
}
function pointInOperand(p: Point, contours: PolygonContour[]): boolean {
  return contours.reduce((inside, contour) => inside !== pointInRing(p, contour.points), false);
}

// Proper perpendicular crossings are the only admitted edge intersections between operands.
function edgeMeeting(a: Edge, b: Edge): 'none' | 'cross' | 'contact' {
  const ah = horizontal(a), bh = horizontal(b);
  if (ah === bh) {
    const axis = ah ? 'y' : 'x', varying = ah ? 'x' : 'y';
    if (a.a[axis] !== b.a[axis]) return 'none';
    return Math.max(Math.min(a.a[varying], a.b[varying]), Math.min(b.a[varying], b.b[varying])) <=
      Math.min(Math.max(a.a[varying], a.b[varying]), Math.max(b.a[varying], b.b[varying])) ?
      'contact' : 'none';
  }
  const h = ah ? a : b, v = ah ? b : a;
  if (!between(v.a.x, h.a.x, h.b.x) || !between(h.a.y, v.a.y, v.b.y)) return 'none';
  return between(v.a.x, h.a.x, h.b.x, true) && between(h.a.y, v.a.y, v.b.y, true) ?
    'cross' : 'contact';
}
function exactObject(value: unknown, keys: string[], location: string): Record<string, unknown> {
  const ownKeys = value && typeof value === 'object' ? Reflect.ownKeys(value) : [];
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      ownKeys.some(key => typeof key !== 'string') ||
      ownKeys.sort().join(',') !== [...keys].sort().join(',') ||
      Object.values(Object.getOwnPropertyDescriptors(value)).some(descriptor => !('value' in descriptor))) {
    refuse(`${location} must have exact plain fields ${keys.join(',')}`);
  }
  return value as Record<string, unknown>;
}
function denseArray(value: unknown, min: number, max: number, location: string): asserts value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype ||
      value.length < min || value.length > max ||
      Reflect.ownKeys(value).some(key => key !== 'length' &&
        (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length)) ||
      Object.values(Object.getOwnPropertyDescriptors(value)).some(descriptor => !('value' in descriptor))) {
    limit(`${location} needs ${min}–${max} dense entries`);
  }
  for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) {
    limit(`${location} must be dense`);
  }
}
function readOperand(value: unknown, label: string, ids: Set<string>): Operand {
  const object = exactObject(value, ['contours'], label);
  denseArray(object.contours, 1, 8, `${label}.contours`);
  const contours: PolygonContour[] = [], edges: Edge[] = [];
  for (const [index, raw] of object.contours.entries()) {
    const contour = exactObject(raw, ['id', 'points'], `${label}.contours[${index}]`);
    if (typeof contour.id !== 'string' || !idPattern.test(contour.id) || ids.has(contour.id)) {
      refuse(`${label}.contours[${index}] has invalid or duplicate id`);
    }
    ids.add(contour.id);
    denseArray(contour.points, 4, 128, `${contour.id}.points`);
    const points = contour.points.map((rawPoint, pointIndex) => {
      const point = exactObject(rawPoint, ['x', 'y'], `${contour.id}.points[${pointIndex}]`);
      if (!Number.isInteger(point.x) || !Number.isInteger(point.y) ||
          Math.abs(point.x as number) > 4096 || Math.abs(point.y as number) > 4096 ||
          Object.is(point.x, -0) || Object.is(point.y, -0)) {
        refuse(`${contour.id} needs integer coordinates in [-4096,4096]`);
      }
      return { x: point.x as number, y: point.y as number };
    });
    if (same(points[0], points.at(-1)!)) refuse(`${contour.id} repeats the closing vertex`);
    const ringEdges: Edge[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const prior = points[(i + points.length - 1) % points.length];
      if ((a.x === b.x) === (a.y === b.y) ||
          (prior.x === a.x) === (a.x === b.x)) {
        refuse(`${contour.id} needs nonzero alternating horizontal/vertical edges`);
      }
      ringEdges.push({ a, b, sourceId: contour.id as string });
    }
    for (let i = 0; i < ringEdges.length; i++) {
      for (let j = i + 1; j < ringEdges.length; j++) {
        if (j === i + 1 || (i === 0 && j === ringEdges.length - 1)) continue;
        if (edgeMeeting(ringEdges[i], ringEdges[j]) !== 'none') refuse(`${contour.id} self-intersects or touches`);
      }
    }
    if (signedArea(points) === 0) refuse(`${contour.id} has zero area`);
    contours.push({ id: contour.id as string, points });
    edges.push(...ringEdges);
  }
  for (let i = 0; i < contours.length; i++) {
    for (let j = i + 1; j < contours.length; j++) {
      const first = edges.filter(e => e.sourceId === contours[i].id);
      const second = edges.filter(e => e.sourceId === contours[j].id);
      for (const a of first) for (const b of second) {
        if (edgeMeeting(a, b) !== 'none') refuse(`${a.sourceId} and ${b.sourceId} intersect or touch`);
      }
    }
    const depth = contours.reduce((count, other, j) =>
      count + (j !== i && pointInRing(contours[i].points[0], other.points) ? 1 : 0), 0);
    if ((signedArea(contours[i].points) > 0) !== (depth % 2 === 0)) {
      refuse(`${contours[i].id} has orientation inconsistent with nesting`);
    }
  }
  return { contours, edges };
}
function boundaryEdges(xs: number[], ys: number[], filled: boolean[][]): DirectedEdge[] {
  const edges: DirectedEdge[] = [];
  const has = (x: number, y: number): boolean => filled[y]?.[x] ?? false;
  for (let y = 0; y < ys.length - 1; y++) for (let x = 0; x < xs.length - 1; x++) {
    if (!has(x, y)) continue;
    const tl = { x: xs[x], y: ys[y] }, tr = { x: xs[x + 1], y: ys[y] };
    const br = { x: xs[x + 1], y: ys[y + 1] }, bl = { x: xs[x], y: ys[y + 1] };
    if (!has(x, y - 1)) edges.push({ a: tl, b: tr });
    if (!has(x + 1, y)) edges.push({ a: tr, b: br });
    if (!has(x, y + 1)) edges.push({ a: br, b: bl });
    if (!has(x - 1, y)) edges.push({ a: bl, b: tl });
  }
  for (let y = 1; y < ys.length - 1; y++) for (let x = 1; x < xs.length - 1; x++) {
    const nw = has(x - 1, y - 1), ne = has(x, y - 1), sw = has(x - 1, y), se = has(x, y);
    if (nw === se && ne === sw && nw !== ne) refuse('result has an ambiguous point contact');
  }
  if (edges.length > 4096) limit('result exceeds 4096 boundary edges');
  return edges;
}
function simplify(points: Point[]): Point[] {
  return points.filter((p, i) => {
    const a = points[(i + points.length - 1) % points.length], b = points[(i + 1) % points.length];
    return (a.x === p.x) !== (p.x === b.x);
  });
}
function sourceIds(points: Point[], edges: Edge[]): string[] {
  const ids = new Set<string>();
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const matching = edges.filter(edge => horizontal(edge) === (a.y === b.y) &&
      (horizontal(edge) ? edge.a.y === middle.y && between(middle.x, edge.a.x, edge.b.x) :
        edge.a.x === middle.x && between(middle.y, edge.a.y, edge.b.y)));
    if (matching.length !== 1) refuse('result boundary has ambiguous source lineage');
    ids.add(matching[0].sourceId);
  }
  return [...ids].sort();
}

export function booleanOrthogonalPolygons(leftInput: PolygonOperand, rightInput: PolygonOperand,
  operation: PolygonOperation): PolygonBooleanResult {
  if (operation !== 'union' && operation !== 'intersection' && operation !== 'difference') {
    refuse('operation must be union, intersection or difference');
  }
  const ids = new Set<string>();
  const left = readOperand(leftInput, 'left', ids), right = readOperand(rightInput, 'right', ids);
  if (left.edges.length + right.edges.length > 240) limit('inputs exceed 240 vertices');
  for (const a of left.edges) for (const b of right.edges) {
    if (edgeMeeting(a, b) === 'contact') refuse(`${a.sourceId} and ${b.sourceId} touch or overlap`);
  }
  const xs = [...new Set([...left.edges, ...right.edges].flatMap(e => [e.a.x, e.b.x]))].sort((a, b) => a - b);
  const ys = [...new Set([...left.edges, ...right.edges].flatMap(e => [e.a.y, e.b.y]))].sort((a, b) => a - b);
  if ((xs.length - 1) * (ys.length - 1) > 16384) limit('operation exceeds 16384 cells');
  const filled = Array.from({ length: ys.length - 1 }, (_, y) =>
    Array.from({ length: xs.length - 1 }, (_, x) => {
      const p = { x: (xs[x] + xs[x + 1]) / 2, y: (ys[y] + ys[y + 1]) / 2 };
      const l = pointInOperand(p, left.contours), r = pointInOperand(p, right.contours);
      return operation === 'union' ? l || r : operation === 'intersection' ? l && r : l && !r;
    }));
  const edges = boundaryEdges(xs, ys, filled), outgoing = new Map<string, DirectedEdge>();
  for (const edge of edges) {
    const key = pointKey(edge.a);
    if (outgoing.has(key)) refuse('result has an ambiguous boundary vertex');
    outgoing.set(key, edge);
  }
  const allSources = [...left.edges, ...right.edges];
  const contours: PolygonBooleanResult['contours'] = [];
  let resultIndex = 1;
  while (outgoing.size) {
    const start = [...outgoing.keys()].sort((a, b) => {
      const [ax, ay] = a.split(',').map(Number), [bx, by] = b.split(',').map(Number);
      return ay - by || ax - bx;
    })[0];
    const points: Point[] = [];
    let cursor = start;
    do {
      const edge = outgoing.get(cursor);
      if (!edge) refuse('result boundary is open');
      outgoing.delete(cursor);
      points.push(edge.a);
      cursor = pointKey(edge.b);
      if (points.length > 4096) limit('result boundary exceeds 4096 edges');
    } while (cursor !== start);
    const ring = simplify(points), area = signedArea(ring);
    if (ring.length < 4 || ring.length > 128 || area === 0) limit('result contour exceeds supported shape');
    let resultId: string;
    do { resultId = `Result${resultIndex++}`; } while (ids.has(resultId));
    contours.push({ id: resultId, orientation: area > 0 ? 'outer' : 'hole',
      sourceIds: sourceIds(ring, allSources), points: ring });
    if (contours.length > 8 || contours.reduce((total, c) => total + c.points.length, 0) > 240) {
      limit('result exceeds 8 contours or 240 vertices');
    }
  }
  return { operation, inputIds: { left: left.contours.map(c => c.id), right: right.contours.map(c => c.id) },
    contours };
}
