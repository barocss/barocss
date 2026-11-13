import assert from 'node:assert/strict';
import test from 'node:test';
import { ELLIPSE_POINTS, ellipseShape } from '@barocss/cad-model/sketch/ellipse';
import { commitDimension, removeConstraint, type Polygon } from '@barocss/cad-model/sketch/rules';
import { activeCircleDistanceRow, circleDistanceConflict, constraintListRows, edgeCircleDistanceConflict, filterConstraintList, fixedPointDistanceConflict, opposingLengthConflict } from '../src/sketch/constraintList';

const rectangle: Polygon = {
  kind: 'polygon', points: [[0, 0], [40, 0], [40, 20], [0, 20]], closed: true, hv: { h: [0, 2], v: [1, 3] },
};
const ids = (rows: ReturnType<typeof constraintListRows>) => rows.map(row => row.id);

test('D1105 attributes a point distance only to the two explicit and unambiguous Fix targets', () => {
  const shape: Polygon = { ...rectangle, rules: [
    { kind: 'fix', point: 1, at: [52, 15] }, { kind: 'fix', point: 3, at: [16, 42] },
  ] };
  for (const [key, value, distance] of [['dist1_3', 55, 45], ['dx1_3', 46, 36], ['dy1_3', 37, 27]] as const) {
    assert.deepEqual(fixedPointDistanceConflict(shape, key, value), { ids: ['rule:0', 'rule:1'], points: [1, 3], distance });
    assert.equal(fixedPointDistanceConflict(shape, key, distance + 7e-7), undefined);
    assert.equal(fixedPointDistanceConflict(shape, key, distance), undefined);
  }
  for (const key of ['len1', 'dist1_1', 'dist0_3', 'dist1_2', 'dist1_4']) assert.equal(fixedPointDistanceConflict(shape, key, 10), undefined);
  for (const value of [0, Infinity, 30000]) assert.equal(fixedPointDistanceConflict(shape, 'dist1_3', value), undefined);
  for (const extra of [
    { kind: 'fix', point: 1, at: [52, 15] }, { kind: 'fix', point: 1, at: [52, 18] },
  ] as const) {
    const rule = { ...extra, at: [...extra.at] as [number, number] };
    assert.equal(fixedPointDistanceConflict({ ...shape, rules: [...shape.rules!, rule] }, 'dist1_3', 55), undefined);
  }
});

test('D1104 proves both sign branches conflict with an opposite distance and a locked span', () => {
  const shape: Polygon = { ...rectangle, points: [[0, 0], [60, 0], [60, 40], [0, 40]], lengths: { 1: 40 },
    circles: [{ c: [30, 22], r: 5 }, { c: [40, 20], r: 4 }],
    rules: [{ kind: 'cedge', edge: 0, circle: 0, axis: 1, value: 22 }] };
  const proof = edgeCircleDistanceConflict(shape, 'cedge2_0', 19);
  assert.deepEqual(proof, { ids: ['len:1', 'rule:0'], span: 40, spanEdge: 1, opposite: 0, oppositeDistance: 22 });
  for (const value of [18, 18 + 1.5e-6, 62, 62 + 1.5e-6, 0, 30000, NaN]) {
    assert.equal(edgeCircleDistanceConflict(shape, 'cedge2_0', value), undefined);
  }
  for (const key of ['cedge2_1', 'cedge2_2', 'cedge0_0', 'cedge1_0']) assert.equal(edgeCircleDistanceConflict(shape, key, 19), undefined);
  for (const other of [
    { ...shape, lengths: {} },
    { ...shape, hv: { h: [0, 2], v: [] } },
    { ...shape, bulges: [0, 0.2, 0, 0] },
    { ...shape, rules: [{ kind: 'cedge', edge: 0, circle: 0, axis: 0, value: 22 }] } satisfies Polygon,
  ]) assert.equal(edgeCircleDistanceConflict(other, 'cedge2_0', 19), undefined);
  const vertical: Polygon = { ...shape, lengths: { 2: 60 },
    rules: [{ kind: 'cedge', edge: 3, circle: 0, axis: 0, value: 30 }] };
  assert.deepEqual(edgeCircleDistanceConflict(vertical, 'cedge1_0', 31)?.ids, ['len:2', 'rule:0']);
});

test('D1103 attributes only a proven same-pair projection that exceeds the requested aligned distance', () => {
  const shape: Polygon = { ...rectangle, circles: [
    { c: [10, 10], r: 2 }, { c: [25, 18], r: 2 }, { c: [36, 10], r: 2 },
  ], rules: [
    { kind: 'ccdist', a: 0, b: 1, value: 17 },
    { kind: 'ccdx', a: 1, b: 0, value: 15 },
    { kind: 'ccdy', a: 0, b: 1, value: 8 },
    { kind: 'ccdx', a: 0, b: 2, value: 26 },
  ] };
  assert.deepEqual(circleDistanceConflict(shape, 'ccdist0_1', 7), { id: 'rule:1', axis: 'horizontal', value: 15 });
  assert.equal(circleDistanceConflict(shape, 'ccdist0_1', 15 - 5e-7), undefined);
  assert.equal(circleDistanceConflict(shape, 'ccdist0_1', 16), undefined);
  for (const key of ['ccdx0_1', 'ccdist0_0', 'ccdist0_3']) assert.equal(circleDistanceConflict(shape, key, 7), undefined);
  for (const value of [0, Infinity, NaN]) assert.equal(circleDistanceConflict(shape, 'ccdist0_1', value), undefined);
  const vertical: Polygon = { ...shape, rules: [shape.rules![2]] };
  assert.deepEqual(circleDistanceConflict(vertical, 'ccdist0_1', 7), { id: 'rule:0', axis: 'vertical', value: 8 });
});

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

test('the opposite length action requires a contradiction from the exact rectangle subset', () => {
  const shape = { ...rectangle, lengths: { 0: 40, 1: 20, 2: 40 } };
  assert.equal(opposingLengthConflict(shape, 'len0', 42), 2);
  assert.equal(opposingLengthConflict(shape, 'len2', 38), 0);
  assert.equal(opposingLengthConflict(shape, 'len0', 40.0000001), undefined);
  assert.equal(opposingLengthConflict(shape, 'len0', 30000), undefined);
  const axisDriver: Polygon = { ...rectangle, lengths: { 2: 40 },
    rules: [{ kind: 'dx', a: 0, b: 1, value: 40 }] };
  const attempt = 40.0000012;
  const result = commitDimension(axisDriver, 'len0', attempt);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, /Conflict/);
  assert.equal(opposingLengthConflict(axisDriver, 'len0', attempt), undefined);
  assert.equal(opposingLengthConflict(shape, 'len1', 21), undefined);
  assert.equal(opposingLengthConflict({ ...shape, hv: { h: [0, 2], v: [1] } }, 'len0', 42), undefined);
  assert.equal(opposingLengthConflict({ ...shape, bulges: [0, 0, 0.2, 0] }, 'len0', 42), undefined);
});
