import { Canvas2DError } from './schema.js';
import type { PathNode, Point, View } from './schema.js';

export type Matrix = [number, number, number, number, number, number];
export type PathSample = { commandIndex: number; t: number; x: number; y: number };
export type PathObservation = {
  id: string; segments: number; vertices: number; maxObservedDeviationDevicePx: number;
  subpaths: { closed: boolean; points: PathSample[] }[];
};
export type PathGeometry = { vertices: Float32Array; observation: PathObservation };

type LocalPoint = { x: number; y: number };
type MutableSubpath = { closed: boolean; points: PathSample[]; locals: LocalPoint[] };

function fail(message: string): never { throw new Canvas2DError('SCENE_LIMIT', message); }
function midpoint(a: LocalPoint, b: LocalPoint): LocalPoint {
  return { x: a.x + (b.x - a.x) / 2, y: a.y + (b.y - a.y) / 2 };
}
function same(a: LocalPoint, b: LocalPoint): boolean { return a.x === b.x && a.y === b.y; }
function world(m: Matrix, p: LocalPoint): Point {
  const x = m[0] * p.x + m[2] * p.y + m[4];
  const y = m[1] * p.x + m[3] * p.y + m[5];
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e9 || Math.abs(y) > 1e9) {
    fail('composed path geometry exceeds world limit');
  }
  return { x, y };
}
function device(m: Matrix, view: View, dpr: number, p: LocalPoint): Point {
  const w = world(m, p);
  return { x: (w.x * view.zoom + view.panX) * dpr, y: (w.y * view.zoom + view.panY) * dpr };
}
function distanceToChord(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function triangleArea(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

export function tessellatePath(node: PathNode, matrix: Matrix, view: View, dpr: number,
  tolerance: number): PathGeometry {
  const subpaths: MutableSubpath[] = [];
  let active: MutableSubpath | null = null;
  let current: LocalPoint = { x: 0, y: 0 }, start: LocalPoint = { x: 0, y: 0 };
  let segments = 0, maxObservedDeviationDevicePx = 0;

  function append(end: LocalPoint, commandIndex: number, t: number): void {
    if (!active) fail('path has no active subpath');
    const w = world(matrix, end);
    const last = active.points.at(-1);
    if (last && last.x === w.x && last.y === w.y) return;
    if (++segments > 1024) fail('path exceeds 1024 segments');
    active.points.push({ commandIndex, t, x: w.x, y: w.y });
    active.locals.push(end);
  }

  function flatten(points: LocalPoint[], commandIndex: number, t0: number, t1: number, depth: number): void {
    const a = device(matrix, view, dpr, points[0]);
    const b = device(matrix, view, dpr, points.at(-1)!);
    const flatness = Math.max(...points.slice(1, -1)
      .map(p => distanceToChord(device(matrix, view, dpr, p), a, b)));
    if (!Number.isFinite(flatness)) fail('path flatness is not finite');
    if (flatness <= tolerance) {
      maxObservedDeviationDevicePx = Math.max(maxObservedDeviationDevicePx, flatness);
      append(points.at(-1)!, commandIndex, t1);
      return;
    }
    if (depth >= 16) fail('path flattening depth exceeds 16');
    const midT = t0 + (t1 - t0) / 2;
    if (midT === t0 || midT === t1) fail('path parameter midpoint is unrepresentable');
    const levels: LocalPoint[][] = [points];
    while (levels.at(-1)!.length > 1) {
      const prior = levels.at(-1)!;
      levels.push(prior.slice(0, -1).map((p, i) => midpoint(p, prior[i + 1])));
    }
    const left = levels.map(level => level[0]);
    const right = levels.map(level => level.at(-1)!).reverse();
    if (same(left[0], left.at(-1)!) || same(right[0], right.at(-1)!)) {
      fail('path midpoint collapses before flatness is met');
    }
    flatten(left, commandIndex, t0, midT, depth + 1);
    flatten(right, commandIndex, midT, t1, depth + 1);
  }

  for (let index = 0; index < node.commands.length; index++) {
    const command = node.commands[index];
    if (command.kind === 'M') {
      current = { x: command.x, y: command.y }; start = current;
      const w = world(matrix, current);
      active = { closed: false, points: [{ commandIndex: index, t: 0, x: w.x, y: w.y }], locals: [current] };
      subpaths.push(active);
    } else if (command.kind === 'Z') {
      append(start, index, 1);
      if (active) active.closed = true;
      current = start; active = null;
    } else {
      const end = { x: command.x, y: command.y };
      if (command.kind === 'L') append(end, index, 1);
      else if (command.kind === 'Q') flatten([current, { x: command.cx, y: command.cy }, end], index, 0, 1, 0);
      else flatten([current, { x: command.c1x, y: command.c1y },
        { x: command.c2x, y: command.c2y }, end], index, 0, 1, 0);
      current = end;
    }
  }

  const output: number[] = [];
  function emitTriangle(a: Point, b: Point, c: Point, required: boolean): void {
    const coordinates = new Float32Array([a.x, a.y, b.x, b.y, c.x, c.y]);
    const area = triangleArea(coordinates[0], coordinates[1], coordinates[2],
      coordinates[3], coordinates[4], coordinates[5]);
    if (!Number.isFinite(area) || area === 0) {
      if (required) fail('path stroke collapses in Float32');
      return;
    }
    for (const value of coordinates) {
      if (!Number.isFinite(value) || Math.abs(value) > 1e9) fail('path stroke exceeds Float32 display limit');
      output.push(value);
    }
    if (output.length / 2 > 16384) fail('path exceeds scene vertex budget');
  }

  for (const subpath of subpaths) {
    const points = subpath.locals;
    if (points.length < 2) fail('path subpath collapses after sampling');
    const edges: { a: Point; b: Point; nx: number; ny: number; dx: number; dy: number }[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
      if (!Number.isFinite(length) || length === 0) fail('sampled path segment is unsafe');
      edges.push({ a, b, dx, dy, nx: -dy / length * node.width / 2, ny: dx / length * node.width / 2 });
    }
    for (const edge of edges) {
      const a = world(matrix, { x: edge.a.x + edge.nx, y: edge.a.y + edge.ny });
      const b = world(matrix, { x: edge.b.x + edge.nx, y: edge.b.y + edge.ny });
      const c = world(matrix, { x: edge.b.x - edge.nx, y: edge.b.y - edge.ny });
      const d = world(matrix, { x: edge.a.x - edge.nx, y: edge.a.y - edge.ny });
      emitTriangle(a, b, c, true); emitTriangle(a, c, d, true);
    }
    const joinCount = subpath.closed ? edges.length : edges.length - 1;
    for (let i = 0; i < joinCount; i++) {
      const previous = edges[i], next = edges[(i + 1) % edges.length];
      const cross = previous.dx * next.dy - previous.dy * next.dx;
      if (cross === 0) continue;
      const side = cross > 0 ? -1 : 1;
      const center = previous.b;
      emitTriangle(world(matrix, center),
        world(matrix, { x: center.x + previous.nx * side, y: center.y + previous.ny * side }),
        world(matrix, { x: center.x + next.nx * side, y: center.y + next.ny * side }), false);
    }
  }
  const observation: PathObservation = { id: node.id, segments, vertices: output.length / 2,
    maxObservedDeviationDevicePx,
    subpaths: subpaths.map(({ closed, points }) => ({ closed, points })) };
  return { vertices: new Float32Array(output), observation };
}
