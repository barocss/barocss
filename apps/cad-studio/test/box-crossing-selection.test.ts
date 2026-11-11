import assert from 'node:assert/strict';
import test from 'node:test';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { meshCrossesBox, type ScreenBox } from '../src/viewport/boxSelectionCrossing';

const screen = (p: Vec3) => p;
const box = (left: number, right: number, top: number, bottom: number): ScreenBox => ({ left, right, top, bottom });
const mesh = (points: Vec3[], indices: number[]) => ({ positions: Float64Array.from(points.flat()), indices: Uint32Array.from(indices) });
const triangle = mesh([[0, 0, 0], [10, 0, 0], [0, 10, 0]], [0, 1, 2]);
const touches = (m: ReturnType<typeof mesh>, rect: ScreenBox) => meshCrossesBox(m, rect, screen);

test('crossing includes edge, face interior and closed boundary, without requiring a vertex', () => {
  assert.equal(touches(triangle, box(4, 6, -1, 1)), true, 'long edge crosses the box');
  assert.equal(touches(triangle, box(2, 3, 2, 3)), true, 'box is entirely within the triangle');
  assert.equal(touches(triangle, box(5, 6, 5, 6)), true, 'one corner exactly touches the diagonal');
  assert.equal(touches(triangle, box(5, 6, 5.001, 6)), false, 'a nearby diagonal miss stays out');
  assert.equal(touches(triangle, box(7, 8, 7, 8)), false, 'overlapping AABBs are insufficient');
  assert.equal(touches(triangle, box(-1, 0, -1, 0)), true, 'closed corner contact');
});

test('edge-on triangles project to segments or points with the same closed boundary', () => {
  const line = mesh([[0, 0, 0], [10, 10, 0], [4, 4, 6]], [0, 1, 2]);
  const point = mesh([[4, 4, 0], [4, 4, 1], [4, 4, 2]], [0, 1, 2]);
  assert.equal(touches(line, box(4, 6, 4, 6)), true);
  assert.equal(touches(line, box(4, 6, 7, 9)), false);
  assert.equal(touches(point, box(1, 4, 1, 4)), true);
  assert.equal(touches(point, box(1, 3, 1, 5)), false);
});

function strip(cells: number, targetVertices = cells * 6) {
  const points: Vec3[] = [], indices: number[] = [];
  for (let i = 0; i < cells; i++) {
    const start = 100 * i / cells, end = 100 * (i + 1) / cells;
    const a: Vec3 = [start, 0, 0], b: Vec3 = [end, 0, 0], c: Vec3 = [end, 0.1, 0], d: Vec3 = [start, 0.1, 0];
    const index = points.length;
    points.push(a, b, c, a, c, d);
    indices.unshift(index + 5, index + 4, index + 3, index + 2, index + 1, index);
  }
  while (points.length < targetVertices) points.push([50, 50, 0]);
  return mesh(points, indices);
}

test('crossing follows the same narrow surface across density, winding, order and duplicate vertices', () => {
  const shared = mesh([[0, 0, 0], [100, 0, 0], [100, 0.1, 0], [0, 0.1, 0]], [0, 1, 2, 0, 2, 3]);
  const dense = [strip(66, 399), strip(66, 400), strip(66, 401), strip(67), strip(133, 799),
    strip(133, 800), strip(133, 801), strip(134)];
  for (const m of [shared, ...dense]) {
    assert.equal(touches(m, box(45, 55, -0.01, 0.02)), true);
    assert.equal(touches(m, box(45, 55, 0.11, 0.2)), false);
    assert.equal(touches(m, box(49, 51, 49, 51)), false, 'unused vertices do not count');
  }
});

test('crossing ignores incomplete or nonfinite triangles and preserves screen transforms', () => {
  const malformed = mesh([[5, 5, 0], [NaN, 5, 0], [6, 6, 0]], [0, 1, 2, 0, 2, 9, 0]);
  assert.equal(touches(malformed, box(4, 7, 4, 7)), false);
  assert.equal(meshCrossesBox(triangle, box(-5, -4, 25, 26), ([x, y, z]) => [-x, y + 20, z]), true);
});
