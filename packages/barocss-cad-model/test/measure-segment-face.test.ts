import assert from 'node:assert/strict';
import test from 'node:test';
import { measureBetween } from '../src/app/measure';
import { emptyDoc, withNode } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import type { DisplayMesh, Vec3 } from '../src/engine/mesh';

type Triangle = [Vec3, Vec3, Vec3];
type Segment = [Vec3, Vec3];
const face = { body: 0, face: 0 }, edge = { body: 1, edge: 0 };
const triangle: Triangle = [[0, 0, 0], [4, 0, 0], [0, 4, 0]];
const crossing: Segment = [[1, 1, -1], [1, 1, 1]];
const baseline = process.env.D742_BASELINE === '1';
const active = { skip: baseline };

function emptyMesh(): DisplayMesh {
  return {
    positions: new Float64Array(), normals: new Float32Array(), faceOfVertex: new Float32Array(),
    indices: new Uint32Array(), faces: [], edgeLines: new Float64Array(), edgeOfSegment: new Float32Array(),
    edges: [], bounds: { min: [0, 0, 0], max: [0, 0, 0] },
  };
}
function faceMesh(points: Triangle, normal: Vec3 = [0, 0, 1]): DisplayMesh {
  const centroid = [0, 1, 2].map(k => points.reduce((sum, p) => sum + p[k], 0) / 3) as Vec3;
  return {
    ...emptyMesh(), positions: Float64Array.from(points.flat()), faceOfVertex: Float32Array.of(0, 0, 0),
    indices: Uint32Array.of(0, 1, 2),
    faces: [{ id: 'f', index: 0, name: 'face', kind: 'plane', normal, centroid, area: 8 }],
  };
}
function edgeMesh([a, b]: Segment): DisplayMesh {
  return {
    ...emptyMesh(), edgeLines: Float64Array.from([...a, ...b]), edgeOfSegment: Float32Array.of(0, 0),
    edges: [{ index: 0, faces: [0, 1], a, b, straight: true, axis: null, names: ['edge'] }],
  };
}
function both(tri: Triangle, seg: Segment) {
  const a = faceMesh(tri), b = edgeMesh(seg);
  return [measureBetween(a, face, b, edge), measureBetween(b, edge, a, face)];
}
function checkHit(tri: Triangle, seg: Segment, witness: Vec3, tolerance = 0) {
  for (const directed of [seg, [seg[1], seg[0]] as Segment]) {
    for (const result of both(tri, directed)) {
      assert.equal(result.distance, 0);
      assert.deepEqual(result.a, result.b);
      result.a.forEach((value, k) => assert.ok(Math.abs(value - witness[k]) <= tolerance, JSON.stringify(result)));
    }
  }
}

test('measure: a finite segment pierces the strict triangle interior in either pick order', () => {
  if (baseline) for (const result of both(triangle, crossing)) assert.equal(result.distance, 1);
  else checkHit(triangle, crossing, [1, 1, 0]);
  for (const result of both(triangle, crossing)) assert.equal(result.angle, 90);
});

test('measure: the real two-prism display producer retains the selected crossing', () => {
  let doc = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] });
  doc = withNode(doc, { kind: 'extrude', sketch: 0, height: 10 });
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [2, 4], max: [3, 5] });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 2, from: 9 });
  const evaluated = evaluateDoc(doc, 1);
  assert.ok(evaluated.ok);
  const [plate, pin] = evaluated.bodies.map(body => body.mesh);
  const top = plate.faces.find(f => f.name === 'n1.top')!;
  const upright = pin.edges.find(e => e.names.includes('n3.side0|n3.side3'))!;
  assert.ok(top && upright);
  assert.deepEqual([upright.a, upright.b].sort((p, q) => p[2] - q[2]), [[2, 4, 9], [2, 4, 11]]);
  for (const reversed of [false, true]) {
    const a = { body: 0, face: top.index }, b = { body: 1, edge: upright.index };
    const result = reversed ? measureBetween(pin, b, plate, a) : measureBetween(plate, a, pin, b);
    assert.equal(result.distance, baseline ? 1 : 0);
    assert.equal(result.angle, 90);
    if (!baseline) {
      assert.deepEqual(result.a, [2, 4, 10]);
      assert.deepEqual(result.b, result.a);
    }
  }
});

test('measure: finite oblique and boundary hits keep the same witness when reversed, scaled or translated', active, () => {
  const oblique: Segment = [[0, 1, -1], [3, 1, 2]];
  for (const [scale, offset] of [[1, 0], [2 ** -20, 0], [2 ** -400, 0], [2 ** 15, 2 ** 30]]) {
    const map = (p: Vec3): Vec3 => p.map(v => offset + v * scale) as Vec3;
    checkHit(triangle.map(map) as Triangle, oblique.map(map) as Segment, map([1, 1, 0]));
  }
  checkHit(triangle, [[1, 1, 0], [1, 1, 2]], [1, 1, 0]);
  checkHit(triangle, [[0, 0, -1], [0, 0, 1]], [0, 0, 0]);
  checkHit(triangle, [[1, 0, -1], [1, 0, 1]], [1, 0, 0]);
  const unit: Triangle = [[0, 0, 0], [1, 0, 0], [0, 1, 0]];
  checkHit(unit, [[0, 4, -1], [1, -15, 5]], [1 / 6, 5 / 6, 0], 2e-15);
  const x = -(2 ** -60), nearSide: Triangle = [[-1, 0, 0], [0, 0, 0], [0, 1, 0]];
  checkHit(nearSide, [[x, 0.25, -1], [x, 0.25, 1]], [x, 0.25, 0]);
  const ulp = Number.EPSILON;
  checkHit(triangle, [[1, 1, -1], [1 + ulp, 1, 1]], [1, 1, 0]);
  checkHit(triangle, [[1 + ulp, 1, -1], [1 + 2 * ulp, 1, 1]], [1 + 2 * ulp, 1, 0]);
});

test('measure: finite misses, tiny gaps and degenerate inputs do not acquire a zero witness', active, () => {
  const parallel = 2 ** -45, outside = 2 ** -40;
  const cases: [Segment, number][] = [
    [[[1, 1, parallel], [1, 1, 1]], parallel],
    [[[1, 1, parallel], [2, 1, parallel]], parallel],
    [[[1, 3 + outside, -1], [1, 3 + outside, 1]], outside / Math.SQRT2],
    [[[5, 0, -1], [5, 0, 1]], 1],
    [[[5, 0, 0], [6, 0, 0]], 1],
    [[[1, 1, 1], [1, 1, 1]], 1],
  ];
  for (const [seg, expected] of cases) for (const result of both(triangle, seg)) {
    assert.ok(result.distance > 0 && Math.abs(result.distance - expected) < expected * 3e-4, JSON.stringify(result));
  }
  const unit: Triangle = [[0, 0, 0], [1, 0, 0], [0, 1, 0]];
  for (const result of both(unit, [[2 ** -55, 1, -1], [2 ** -55, 1, 1]])) assert.ok(result.distance > 0);
  const tilted: Triangle = [[0, 0, 0], [1, -1, 0], [1, 1, -2]];
  const lostByRounding = 2 ** -56;
  for (const result of both(tilted, [[0.5, lostByRounding, -0.5], [0.5, lostByRounding, -0.25]])) {
    assert.ok(result.distance > 0, 'plane-side cancellation must not turn a positive gap into contact');
  }
  const degenerate: Triangle = [[0, 0, 0], [0, 0, 0], [4, 0, 0]];
  for (const result of both(degenerate, crossing)) assert.equal(result.distance, 1);
  for (const result of both(triangle, [[1, 1, 0], [2, 1, 0]])) assert.equal(result.distance, 0);
});

test('measure: triangle sides cross finite face interiors without changing angle metadata', active, () => {
  const a = faceMesh([[-4, -4, 0], [4, -4, 0], [0, 4, 0]]);
  const b = faceMesh([[-2, 0, -1], [2, 0, -1], [0, 0, 1]], [0, -1, 0]);
  const tilt = 2 ** -28;
  const shallow = faceMesh([[-1, -1, -tilt], [1, -1, tilt], [1, 1, tilt]], [-tilt, 0, 1]);
  for (const [other, angle] of [[b, 90], [shallow, 0]] as const) for (const pair of [[a, other], [other, a]]) {
    const result = measureBetween(pair[0], face, pair[1], face);
    assert.equal(result.distance, 0);
    assert.equal(result.angle, angle);
    assert.deepEqual(result.a, result.b);
    assert.equal(result.a[2], 0);
    if (angle === 90) assert.ok(result.a[1] === 0 && Math.abs(result.a[0]) <= 1);
    else assert.ok(result.a[0] === 0 && result.normalDistance !== undefined);
  }
  const endpoint = faceMesh([[-1, -1, 0], [1, -1, tilt], [1, 1, -2 * tilt]], [-tilt / 2, 3 * tilt / 2, 1]);
  for (const [first, second] of [[a, endpoint], [endpoint, a]]) {
    const result = measureBetween(first, face, second, face);
    assert.equal(result.distance, 0);
    assert.deepEqual(result.a, result.b);
    assert.equal(result.a[2], 0);
    assert.equal(result.angle, 0);
  }
});
