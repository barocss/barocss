import assert from 'node:assert/strict';
import { booleanOrthogonalPolygons, parseSceneJSON, stringifySceneJSON } from
  '../../packages/barocss-canvas2d/dist/index.js';
import { left, right, sceneFromResult } from './boolean-v5.mjs';

function inside(point, contours) {
  let result = false;
  for (const contour of contours) {
    const ring = contour.points;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if ((a.y > point.y) !== (b.y > point.y) &&
          point.x < a.x + (point.y - a.y) * (b.x - a.x) / (b.y - a.y)) result = !result;
    }
  }
  return result;
}
const samples = [
  { p: { x: 30, y: 30 }, l: true, r: false },
  { p: { x: 60, y: 120 }, l: false, r: false },
  { p: { x: 105, y: 60 }, l: true, r: true },
  { p: { x: 200, y: 80 }, l: false, r: true },
  { p: { x: 150, y: 120 }, l: false, r: true },
  { p: { x: 105, y: 120 }, l: true, r: true },
  { p: { x: 230, y: 210 }, l: false, r: false },
];
for (const { p, l, r } of samples) {
  assert.equal(inside(p, left.contours), l);
  assert.equal(inside(p, right.contours), r);
}
const before = JSON.stringify({ left, right });
for (const op of ['union', 'intersection', 'difference']) {
  const result = booleanOrthogonalPolygons(left, right, op);
  assert.equal(result.operation, op);
  assert.deepEqual(result.inputIds, { left: ['LeftOuter', 'LeftHole'], right: ['RightOuter'] });
  assert.deepEqual(result.contours.map(c => c.orientation),
    op === 'intersection' ? ['outer'] : ['outer', 'hole']);
  assert.deepEqual(result.contours.map(c => c.sourceIds), op === 'intersection' ?
    [['LeftOuter', 'RightOuter']] : [['LeftOuter', 'RightOuter'], ['LeftHole']]);
  for (const { p, l, r } of samples) {
    assert.equal(inside(p, result.contours), op === 'union' ? l || r :
      op === 'intersection' ? l && r : l && !r, `${op} at ${JSON.stringify(p)}`);
  }
  assert.deepEqual(parseSceneJSON(stringifySceneJSON(sceneFromResult(result))), sceneFromResult(result));
  assert.deepEqual(booleanOrthogonalPolygons(left, right, op), result);
}
assert.equal(JSON.stringify({ left, right }), before, 'operands remain unchanged');
const collidingId = structuredClone(left);
collidingId.contours[0].id = 'Result1';
assert.equal(booleanOrthogonalPolygons(collidingId, right, 'intersection').contours[0].id, 'Result2');
const contained = { contours: [{ id: 'Contained', points: [
  { x: 95, y: 95 }, { x: 115, y: 95 }, { x: 115, y: 115 }, { x: 95, y: 115 },
] }] };
assert.deepEqual(booleanOrthogonalPolygons(left, contained, 'difference').contours
  .map(c => c.orientation), ['outer', 'hole', 'hole']);
const touching = { contours: [{ id: 'Touching', points: [
  { x: 180, y: 80 }, { x: 220, y: 80 }, { x: 220, y: 120 }, { x: 180, y: 120 },
] }] };
assert.throws(() => booleanOrthogonalPolygons(left, touching, 'union'),
  error => error.code === 'UNSUPPORTED_FEATURE');
const diagonal = { contours: [{ id: 'Diagonal', points: [
  { x: 0, y: 0 }, { x: 40, y: 20 }, { x: 40, y: 40 }, { x: 0, y: 40 },
] }] };
assert.throws(() => booleanOrthogonalPolygons(diagonal, right, 'union'),
  error => error.code === 'UNSUPPORTED_FEATURE');
assert.throws(() => booleanOrthogonalPolygons(left, right, 'xor'),
  error => error.code === 'UNSUPPORTED_FEATURE');
const sparse = structuredClone(left);
delete sparse.contours[0].points[1];
assert.throws(() => booleanOrthogonalPolygons(sparse, right, 'union'),
  error => error.code === 'SCENE_LIMIT');
console.log('orthogonal Boolean: union/intersection/difference, hole, lineage, Scene v5 and refusal OK');
