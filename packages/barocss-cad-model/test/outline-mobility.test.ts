import assert from 'node:assert/strict';
import test from 'node:test';
import { outlineMobility } from '../src/sketch/mobility';
import { solveShape, type Polygon } from '../src/sketch/rules';

const rectangle = (): Polygon => ({
  kind: 'polygon', closed: true, points: [[0, 0], [40, 0], [40, 20], [0, 20]], hv: { h: [0, 2], v: [1, 3] },
  ids: ['e19', 'e4', 'e7', 'e2'],
});

test('the settled rectangle maps point and edge mobility through each width and height lock', () => {
  const outline = rectangle(), before = structuredClone(outline);
  const width = { ...outline, lengths: { 0: 40 } };
  const both = { ...width, lengths: { 0: 40, 1: 20 } };
  const cases = [
    { shape: outline, dof: 2, points: [1, 2, 3], edges: [0, 1, 2, 3] },
    { shape: width, dof: 1, points: [2, 3], edges: [1, 2, 3] },
    { shape: both, dof: 0, points: [], edges: [] },
  ];
  for (const { shape, dof, points, edges } of cases) {
    const solved = solveShape(shape);
    assert.ok(solved.ok);
    assert.equal(solved.dof, dof);
    assert.deepEqual(outlineMobility(shape), { points, edges });
  }
  assert.deepEqual(outline, before);
});

test('axis-distance solver helpers are not exposed as outline points or edges', () => {
  const shape: Polygon = { ...rectangle(), rules: [{ kind: 'dx', a: 0, b: 1, value: 40 }] };
  assert.deepEqual(outlineMobility(shape), { points: [2, 3], edges: [1, 2, 3] });
});

test('unsolved, malformed and unsupported outlines are unavailable', () => {
  const shape = rectangle();
  const failures: Polygon[] = [
    { ...shape, lengths: { 0: 39 } }, { ...shape, lengths: { 0: 39, 2: 40 } },
    { ...shape, closed: false }, { ...shape, pending: true }, { ...shape, construction: true },
    { ...shape, bulges: [0, 0.1, 0, 0] }, { ...shape, circles: [{ c: [5, 5], r: 2 }] },
    { ...shape, fromSpline: true }, { ...shape, fromEllipse: true },
    { ...shape, hv: { h: [0, -1], v: [1, 3] } }, { ...shape, hv: { h: [0, 2], v: [1, 3.5] } },
    { ...shape, hv: { h: [0, 2, 4], v: [1, 3] } },
    { ...shape, rules: [{ kind: 'equal', a: 2, b: 9 }] },
    { ...shape, points: [[0, 0], [40, 0], [40, 0], [0, 20]] },
    { ...shape, points: [[0, 0], [10, 0], [20, 0], [30, 0]] },
    { ...shape, points: Array.from({ length: 17 }, (_, i) => [Math.cos(i / 17 * 2 * Math.PI), Math.sin(i / 17 * 2 * Math.PI)]) },
  ];
  for (const refused of failures) assert.equal(outlineMobility(refused), null, JSON.stringify(refused));
  assert.ok(solveShape(failures[0]).ok, 'ordinary solving still moves a seed into tolerance');
});
