import { Canvas2DError } from './schema.js';
import type { PathNode, PathNodeV2, PathNodeV5, PathNodeV18, Point, View } from './schema.js';

export type Matrix = [number, number, number, number, number, number];
export type PathSample = { commandIndex: number; t: number; x: number; y: number };
export type PathObservation = {
  id: string; segments: number; vertices: number; maxObservedDeviationDevicePx: number;
  subpaths: { closed: boolean; points: PathSample[] }[];
};
export type FillObservation = {
  id: string; contours: { points: PathSample[] }[]; segments: number;
  maskVertices: number; coverVertices: number; maxObservedDeviationDevicePx: number;
};
export type FillGeometry = { maskVertices: Float32Array; coverVertices: Float32Array;
  contours: Float32Array[]; observation: FillObservation };
export type PathGeometry = { vertices: Float32Array; observation: PathObservation; fill?: FillGeometry };

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
function onSegment(a: LocalPoint, b: LocalPoint, p: LocalPoint): boolean {
  return triangleArea(a.x, a.y, b.x, b.y, p.x, p.y) === 0 &&
    p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) &&
    p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);
}
function edgesMeet(a: LocalPoint, b: LocalPoint, c: LocalPoint, d: LocalPoint): boolean {
  const abC = triangleArea(a.x, a.y, b.x, b.y, c.x, c.y);
  const abD = triangleArea(a.x, a.y, b.x, b.y, d.x, d.y);
  const cdA = triangleArea(c.x, c.y, d.x, d.y, a.x, a.y);
  const cdB = triangleArea(c.x, c.y, d.x, d.y, b.x, b.y);
  return (abC === 0 && onSegment(a, b, c)) || (abD === 0 && onSegment(a, b, d)) ||
    (cdA === 0 && onSegment(c, d, a)) || (cdB === 0 && onSegment(c, d, b)) ||
    (abC * abD < 0 && cdA * cdB < 0);
}
function checkNonzeroTopology(contours: Float32Array[]): void {
  const points = contours.map(contour => Array.from({ length: contour.length / 2 }, (_, i) =>
    ({ x: contour[i * 2], y: contour[i * 2 + 1] })));
  for (let c = 0; c < points.length; c++) {
    const ring = points[c];
    let signedArea = 0;
    const origin = ring[0];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (same(a, b)) fail('nonzero contour has a collapsed Float32 edge');
      if (i > 0 && i + 1 < ring.length) {
        signedArea += triangleArea(origin.x, origin.y, a.x, a.y, b.x, b.y);
      }
      const previous = ring[(i + ring.length - 1) % ring.length];
      if (triangleArea(previous.x, previous.y, a.x, a.y, b.x, b.y) === 0 &&
          (previous.x - a.x) * (b.x - a.x) + (previous.y - a.y) * (b.y - a.y) > 0) {
        throw new Canvas2DError('UNSUPPORTED_FEATURE', 'nonzero contour backtracks');
      }
      for (let j = i + 1; j < ring.length; j++) {
        if (j === i + 1 || (i === 0 && j === ring.length - 1)) continue;
        if (edgesMeet(a, b, ring[j], ring[(j + 1) % ring.length])) {
          throw new Canvas2DError('UNSUPPORTED_FEATURE', 'nonzero contour self-intersects or touches');
        }
      }
      for (let other = 0; other < c; other++) {
        const prior = points[other];
        for (let j = 0; j < prior.length; j++) {
          if (edgesMeet(a, b, prior[j], prior[(j + 1) % prior.length])) {
            throw new Canvas2DError('UNSUPPORTED_FEATURE', 'nonzero contours intersect or touch');
          }
        }
      }
    }
    if (!Number.isFinite(signedArea) || signedArea === 0) fail('nonzero contour has no signed area');
  }
}

export function tessellatePath(node: PathNode | PathNodeV2 | PathNodeV5 | PathNodeV18, matrix: Matrix, view: View, dpr: number,
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

  const output: number[] = [], maskOutput: number[] = [], coverOutput: number[] = [];
  let totalVertices = 0;
  function emitTriangle(target: number[], a: Point, b: Point, c: Point, required: boolean): boolean {
    const coordinates = new Float32Array([a.x, a.y, b.x, b.y, c.x, c.y]);
    const area = triangleArea(coordinates[0], coordinates[1], coordinates[2],
      coordinates[3], coordinates[4], coordinates[5]);
    if (!Number.isFinite(area) || area === 0) {
      if (required) fail('path stroke collapses in Float32');
      return false;
    }
    for (const value of coordinates) {
      if (!Number.isFinite(value) || Math.abs(value) > 1e9) fail('path stroke exceeds Float32 display limit');
      target.push(value);
    }
    totalVertices += 3;
    if (totalVertices > 16384) fail('path exceeds scene vertex budget');
    return true;
  }

  const strokeWidth = 'width' in node ? node.width : node.stroke?.width;
  const cap = 'width' in node || !node.stroke || !('cap' in node.stroke) ? 'butt' : node.stroke.cap;
  if (strokeWidth !== undefined) for (const subpath of subpaths) {
    const points = subpath.locals;
    if (points.length < 2) fail('path subpath collapses after sampling');
    const edges: { a: Point; b: Point; nx: number; ny: number; dx: number; dy: number }[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
      if (!Number.isFinite(length) || length === 0) fail('sampled path segment is unsafe');
      edges.push({ a, b, dx, dy, nx: -dy / length * strokeWidth / 2, ny: dx / length * strokeWidth / 2 });
    }
    for (const edge of edges) {
      const a = world(matrix, { x: edge.a.x + edge.nx, y: edge.a.y + edge.ny });
      const b = world(matrix, { x: edge.b.x + edge.nx, y: edge.b.y + edge.ny });
      const c = world(matrix, { x: edge.b.x - edge.nx, y: edge.b.y - edge.ny });
      const d = world(matrix, { x: edge.a.x - edge.nx, y: edge.a.y - edge.ny });
      emitTriangle(output, a, b, c, true); emitTriangle(output, a, c, d, true);
    }
    if (!subpath.closed && cap !== 'butt') {
      const radius = strokeWidth / 2;
      const limit = Math.hypot(matrix[0], matrix[1], matrix[2], matrix[3]) * view.zoom * dpr * radius;
      if (!Number.isFinite(limit)) fail('path cap exceeds device limit');
      let capSegments = 4;
      if (cap === 'round') {
        while (capSegments <= 64 &&
            limit * (1 - Math.cos(Math.PI / (2 * capSegments))) > tolerance) capSegments++;
        if (capSegments > 64) fail('path cap exceeds 64 segments');
      }
      for (const [endpoint, edge, direction] of [
        [edges[0].a, edges[0], -1], [edges.at(-1)!.b, edges.at(-1)!, 1],
      ] as const) {
        const length = Math.hypot(edge.dx, edge.dy);
        const outward = { x: direction * edge.dx / length * radius,
          y: direction * edge.dy / length * radius };
        const normal = { x: edge.nx, y: edge.ny };
        if (cap === 'square') {
          const nearPlus = world(matrix, { x: endpoint.x + normal.x, y: endpoint.y + normal.y });
          const nearMinus = world(matrix, { x: endpoint.x - normal.x, y: endpoint.y - normal.y });
          const farPlus = world(matrix, { x: endpoint.x + normal.x + outward.x,
            y: endpoint.y + normal.y + outward.y });
          const farMinus = world(matrix, { x: endpoint.x - normal.x + outward.x,
            y: endpoint.y - normal.y + outward.y });
          emitTriangle(output, nearPlus, farPlus, farMinus, true);
          emitTriangle(output, nearPlus, farMinus, nearMinus, true);
        } else {
          const center = world(matrix, endpoint);
          let prior = world(matrix, { x: endpoint.x + normal.x, y: endpoint.y + normal.y });
          for (let index = 1; index <= capSegments; index++) {
            const angle = Math.PI * index / capSegments;
            const next = world(matrix, { x: endpoint.x + normal.x * Math.cos(angle) + outward.x * Math.sin(angle),
              y: endpoint.y + normal.y * Math.cos(angle) + outward.y * Math.sin(angle) });
            emitTriangle(output, center, prior, next, true);
            prior = next;
          }
        }
      }
    }
    const joinCount = subpath.closed ? edges.length : edges.length - 1;
    for (let i = 0; i < joinCount; i++) {
      const previous = edges[i], next = edges[(i + 1) % edges.length];
      const cross = previous.dx * next.dy - previous.dy * next.dx;
      if (cross === 0) continue;
      const side = cross > 0 ? -1 : 1;
      const center = previous.b;
      emitTriangle(output, world(matrix, center),
        world(matrix, { x: center.x + previous.nx * side, y: center.y + previous.ny * side }),
        world(matrix, { x: center.x + next.nx * side, y: center.y + next.ny * side }), false);
    }
  }
  const observation: PathObservation = { id: node.id, segments, vertices: output.length / 2,
    maxObservedDeviationDevicePx,
    subpaths: subpaths.map(({ closed, points }) => ({ closed, points })) };
  if (!('fill' in node) || !node.fill) return { vertices: new Float32Array(output), observation };

  const contours: Float32Array[] = [];
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const subpath of subpaths) {
    if (!subpath.closed) fail('filled path has an open contour');
    const points = subpath.points.map(sample => ({
      x: Math.fround(sample.x), y: Math.fround(sample.y),
    }));
    if (same(points[0], points.at(-1)!)) points.pop();
    if (points.length < 3 || new Set(points.map(p => `${p.x},${p.y}`)).size < 3) {
      fail('filled contour collapses in Float32');
    }
    const contour = new Float32Array(points.flatMap(p => [p.x, p.y]));
    let triangles = 0;
    for (let i = 1; i < points.length - 1; i++) {
      if (emitTriangle(maskOutput, points[0], points[i], points[i + 1], false)) triangles++;
    }
    if (!triangles) fail('filled contour has no Float32 area');
    for (const p of points) {
      left = Math.min(left, p.x); top = Math.min(top, p.y);
      right = Math.max(right, p.x); bottom = Math.max(bottom, p.y);
    }
    contours.push(contour);
  }
  if (node.fill.rule === 'nonzero') checkNonzeroTopology(contours);
  if (!(right > left && bottom > top)) fail('filled path cover collapses');
  const a = { x: left, y: top }, b = { x: right, y: top };
  const c = { x: right, y: bottom }, d = { x: left, y: bottom };
  emitTriangle(coverOutput, a, b, c, true); emitTriangle(coverOutput, a, c, d, true);
  const fill: FillGeometry = {
    maskVertices: new Float32Array(maskOutput), coverVertices: new Float32Array(coverOutput), contours,
    observation: { id: node.id, contours: subpaths.map(({ points }) => ({ points })), segments,
      maskVertices: maskOutput.length / 2, coverVertices: coverOutput.length / 2,
      maxObservedDeviationDevicePx },
  };
  return { vertices: new Float32Array(output), observation, fill };
}
