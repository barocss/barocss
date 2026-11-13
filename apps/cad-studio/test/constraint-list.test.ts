import assert from 'node:assert/strict';
import test from 'node:test';
import { ELLIPSE_POINTS, ellipseShape } from '@barocss/cad-model/sketch/ellipse';
import { removeConstraint, type Polygon } from '@barocss/cad-model/sketch/rules';
import { activeCircleDistanceRow, constraintListRows, filterConstraintList } from '../src/sketch/constraintList';

const rectangle: Polygon = {
  kind: 'polygon', points: [[0, 0], [40, 0], [40, 20], [0, 20]], closed: true, hv: { h: [0, 2], v: [1, 3] },
};
const ids = (rows: ReturnType<typeof constraintListRows>) => rows.map(row => row.id);

test('the default order and exact picked kinds keep anchor, point and edge identities distinct', () => {
  const rows = constraintListRows(rectangle);
  assert.deepEqual(ids(filterConstraintList(rows, '', false, [])), ['anchor', 'h:0', 'h:2', 'v:1', 'v:3']);
  assert.deepEqual(ids(filterConstraintList(rows, 'Horizontal', false, [])), ['h:0', 'h:2']);
  assert.deepEqual(ids(filterConstraintList(rows, 'Horizontal', true, [{ kind: 'edge', i: 0 }])), ['h:0']);
  assert.deepEqual(ids(filterConstraintList(rows, '', true, [{ kind: 'point', i: 0 }])), ['anchor']);
  assert.deepEqual(ids(filterConstraintList(rows, 'Horizontal', true, [{ kind: 'point', i: 0 }])), []);
  assert.deepEqual(ids(filterConstraintList(rows, '', true, [{ kind: 'edge', i: 0, done: true }])), []);
  assert.deepEqual(ids(filterConstraintList(rows, '', true, [])), []);
  assert.equal(rows[0].removable, false);
});

test('a relationship matches either endpoint without duplicates and the label matches the exact constraint kind', () => {
  const shape: Polygon = { ...rectangle, rules: [
    { kind: 'parallel', a: 0, b: 2 },
    { kind: 'dx', a: 0, b: 1, value: 40 },
  ] };
  const rows = constraintListRows(shape);
  const edges = [{ kind: 'edge', i: 0 }, { kind: 'edge', i: 2 }] as const;
  assert.deepEqual(ids(filterConstraintList(rows, 'Parallel', true, edges)), ['rule:0']);
  for (const edge of edges) assert.deepEqual(ids(filterConstraintList(rows, 'Parallel', true, [edge])), ['rule:0']);
  assert.deepEqual(ids(filterConstraintList(rows, 'Horizontal', false, [])), ['h:0', 'h:2']);
  assert.deepEqual(ids(filterConstraintList(rows, 'Horizontal distance', false, [])), ['rule:1']);
});

test('a removal uses the current producer ID after an earlier filtered rule is deleted', () => {
  const shape: Polygon = { ...rectangle, rules: [
    { kind: 'parallel', a: 0, b: 2 },
    { kind: 'equal', a: 0, b: 1 },
    { kind: 'fix', point: 2, at: [40, 20] },
  ] };
  const [equal] = filterConstraintList(constraintListRows(shape), 'Equal length', false, []);
  const changed = removeConstraint(shape, equal.id);
  const [fixed] = filterConstraintList(constraintListRows(changed), 'Fixed', false, []);
  assert.equal(equal.id, fixed.id);
  assert.deepEqual(removeConstraint(changed, fixed.id).rules, [shape.rules![0]]);
});

test('the ellipse summary represents its arc picks and keeps distinct Tangent rows', () => {
  const ellipse = ellipseShape({ center: [20, 20], rx: 12, ry: 6, angle: 0 });
  assert.equal(ellipse.kind, 'polygon');
  const shape: Polygon = { ...ellipse, tangents: [0] };
  const rows = constraintListRows(shape);
  const [summary] = filterConstraintList(rows, 'Ellipse', true, [{ kind: 'edge', i: 20 }]);
  assert.equal(summary.id, 'ellipse');
  assert.equal(summary.removable, false);
  assert.equal(summary.involves.length, 2 * ELLIPSE_POINTS);
  assert.deepEqual(ids(filterConstraintList(rows, 'Ellipse', true, [{ kind: 'point', i: 20 }])), []);
  assert.deepEqual(ids(filterConstraintList(rows, 'Tangent', false, [])), ['tan:0']);
  assert.deepEqual(ids(filterConstraintList(rows, 'Arc', false, [])), []);
  const changed: Polygon = { ...shape, points: shape.points.map(([x, y], i) => [x + (i === 0 ? 0.01 : 0), y]) };
  assert.equal(constraintListRows(changed).some(row => row.label === 'Ellipse'), false);
  assert.equal(constraintListRows(changed).find(row => row.label === 'Arc')?.removable, false);
});

test('an active circle distance keeps its exact row visible without selecting other rules', () => {
  const shape: Polygon = { ...rectangle,
    circles: [{ c: [10, 10], r: 2 }, { c: [20, 10], r: 2 }],
    rules: [{ kind: 'cedge', edge: 0, circle: 0, axis: 1, value: 10 },
      { kind: 'ccdist', a: 0, b: 1, value: 10 }] };
  const rows = constraintListRows(shape);
  const active = activeCircleDistanceRow(shape, 'ccdist0_1');
  assert.deepEqual(ids(filterConstraintList(rows, 'Distance', true, [], active)), ['rule:1']);
  assert.deepEqual(ids(filterConstraintList(rows, 'Horizontal', true, [], active)), []);
  assert.equal(activeCircleDistanceRow(shape, 'ccdx0_1'), undefined);
  assert.equal(activeCircleDistanceRow(shape, null), undefined);
});
