import assert from 'node:assert/strict';
import test from 'node:test';
import { faceProfile } from '../src/app/faceProfile';
import { cylinderPart, rectanglePart, withNode } from '../src/engine/doc';
import { evaluateDoc, partBreps } from '../src/engine/evaluate';
import { bodyMesh, type Vec3 } from '../src/engine/mesh';
import { isDefaultPlane, offsetPlane, orderedVertexPlane, planeLabel, planeOfDisplayFace, planeOfFace, standardPlane, tiltPlane, toLocal, toWorld, xyPlane, yAxisOf } from '../src/sketch/plane';

const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-12, `${actual} != ${expected}`);
const nearPoint = (actual: readonly number[], expected: readonly number[]) => actual.forEach((v, i) => near(v, expected[i]));
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0);

test('signed offsets preserve their exact displacement and keep labels presentation-only', () => {
  const start = xyPlane();
  assert.equal(offsetPlane(start, 0), start);
  assert.equal(isDefaultPlane(start), true);
  for (const amount of [0.0004, 0.0006, -0.0004, 0.00004, 12.5]) {
    const plane = offsetPlane(start, amount);
    assert.deepEqual(plane.origin, [0, 0, amount]);
    assert.equal(isDefaultPlane(plane), false);
    assert.deepEqual(toWorld(plane, [12, 7]), [12, 7, amount]);
  }
  assert.equal(planeLabel(offsetPlane(start, 0.0004)), 'Z 0');
  assert.deepEqual(offsetPlane(standardPlane('xz'), 0.0004).origin, [0, -0.0004, 0]);
  assert.deepEqual(offsetPlane(standardPlane('yz'), -0.0004).origin, [-0.0004, 0, 0]);
});

test('axis-aligned faces retain their exact normal coordinate and right-handed axes', () => {
  const source: Vec3 = [40.0004, -1.0000000005, 8.0004];
  for (const axis of [0, 1, 2]) for (const sign of [-1, 1]) {
    const normal: Vec3 = [0, 0, 0];
    normal[axis] = sign;
    const plane = planeOfFace(normal, source);
    assert.ok(plane);
    assert.deepEqual(plane.normal, normal);
    const origin: Vec3 = [0, 0, 0];
    origin[axis] = source[axis];
    assert.deepEqual(plane.origin, origin);
    nearPoint(toLocal(plane, toWorld(plane, [4, 7])), [4, 7]);
    const offset = offsetPlane(plane, 0.0004);
    near(offset.origin[axis], source[axis] + sign * 0.0004);
    const [a, b, c] = plane.xAxis, [x, y, z] = yAxisOf(plane);
    nearPoint([b * z - c * y, c * x - a * z, a * y - b * x], normal);
  }
  assert.equal(planeOfFace([0, 0, 0], source), null);
});

test('the tilted face origin satisfies the independent plane equation', () => {
  const source: Vec3 = [11.125, -3.75, 8.0004], normal: Vec3 = [2, -3, 6];
  const plane = planeOfFace(normal, source);
  assert.ok(plane);
  const level = 2 * source[0] - 3 * source[1] + 6 * source[2];
  nearPoint(plane.origin, [2 * level / 49, -3 * level / 49, 6 * level / 49]);
  nearPoint(plane.normal, [2 / 7, -3 / 7, 6 / 7]);
  near(dot(normal, toWorld(plane, [-4, 6])), level);
  nearPoint(toLocal(plane, toWorld(plane, [-4, 6])), [-4, 6]);
  const moved = offsetPlane(plane, 0.0004);
  near(dot(normal, moved.origin), level + 7 * 0.0004);
  const tilted = tiltPlane(plane, 15);
  assert.equal(tilted.origin, plane.origin);
  near(dot(tilted.normal, tilted.xAxis), 0);
  near(Math.hypot(...tilted.normal), 1);
});

test('three ordered native vertices set the sketch origin and right-handed axes', () => {
  const a: Vec3 = [2.125, 3.25, 0], b: Vec3 = [14.125, 12.25, 0], c: Vec3 = [2.125, 12.25, 10];
  const plane = orderedVertexPlane([a, b, c]), reversed = orderedVertexPlane([a, c, b]);
  assert.ok(plane && reversed);
  assert.deepEqual(plane.origin, a);
  assert.notEqual(plane.origin, a);
  nearPoint(plane.xAxis, [4 / 5, 3 / 5, 0]);
  nearPoint(plane.normal, [15, -20, 18].map(value => value / Math.sqrt(949)));
  nearPoint(reversed.normal, plane.normal.map(value => -value));
  nearPoint(toLocal(plane, b), [15, 0]);
  nearPoint(toLocal(plane, c), [27 / 5, 2 * Math.sqrt(949) / 5]);
  for (const point of [a, b, c]) nearPoint(toWorld(plane, toLocal(plane, point)), point);
});

test('ordered vertices refuse missing precision, degeneracy and points outside modeling range', () => {
  const a: Vec3 = [0, 0, 0], b: Vec3 = [10000, 0, 0];
  assert.equal(orderedVertexPlane([a, a, [0, 1, 0]]), null);
  assert.equal(orderedVertexPlane([a, b, [1, 0, 0]]), null);
  assert.equal(orderedVertexPlane([a, b, [1, 1e-8, 0]]), null);
  assert.equal(orderedVertexPlane([a, b, [0, 10000, 1e-6]]), null);
  assert.equal(orderedVertexPlane([a, b, [0, 10001, 0]]), null);
  assert.equal(orderedVertexPlane([a, b, [0, 1, NaN]]), null);
  const nearXY = orderedVertexPlane([a, [1, 0, 0], [0, 1, 1e-10]]);
  assert.ok(nearXY);
  assert.equal(isDefaultPlane(nearXY), false);
});

test('only single straight display edges retain their ordered native prism vertex IDs', () => {
  const box = rectanglePart(12, 9, 10), [source] = partBreps(box);
  const byName = new Map(source.brep.edges.map(edge => [edge.name ?? edge.id, edge]));
  const byId = new Map(source.brep.vertices.map(vertex => [vertex.id, vertex.point]));
  const mesh = bodyMesh(source.brep, 1);
  assert.equal(mesh.edges.length, 12);
  for (const edge of mesh.edges) {
    const native = byName.get(edge.names[0]);
    assert.ok(native && edge.nativeVertices);
    assert.deepEqual(edge.nativeVertices, native.vertices);
    assert.deepEqual([edge.a, edge.b], native.vertices.map(id => byId.get(id)));
  }

  const adjacent = withNode(box, { kind: 'sketch', profile: 'rectangle', min: [12, 0], max: [24, 9] });
  const second = withNode(adjacent, { kind: 'extrude', sketch: 2, height: 10 });
  const joined = withNode(second, { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
  const grouped = bodyMesh(partBreps(joined)[0].brep, 2).edges.filter(edge => edge.names.length > 1);
  assert.ok(grouped.some(edge => edge.straight));
  assert.ok(grouped.every(edge => edge.nativeVertices === undefined));
  const curved = bodyMesh(partBreps(cylinderPart(5, 10))[0].brep, 3).edges.filter(edge => !edge.straight);
  assert.ok(curved.length && curved.every(edge => edge.nativeVertices === undefined));
});

test('face profiles prefer the native plane and keep its origin finer than local outline precision', () => {
  const evaluated = evaluateDoc(rectanglePart(40, 20, 8.00041), 1);
  assert.ok(evaluated.ok);
  const mesh = evaluated.bodies[0].mesh, index = mesh.faces.findIndex(face => face.normal[2] === 1);
  const face = mesh.faces[index];
  assert.equal(face.exact?.kind, 'plane');
  const centroid: Vec3 = [face.centroid[0], face.centroid[1], 8.003];
  const displaced = { ...mesh, faces: mesh.faces.map((f, i) => i === index ? { ...f, centroid } : f) };
  const profile = faceProfile(displaced, index);
  assert.ok(profile?.plane);
  assert.equal(profile.plane.origin[2], 8.00041);
  assert.deepEqual(profile.plane.normal, [0, 0, 1]);
  assert.deepEqual(planeOfDisplayFace({ ...face, centroid, exact: undefined })?.origin, [0, 0, 8.003]);
  assert.equal(planeOfDisplayFace({ ...face, kind: 'curved' }), null);
});

test('the precise face plane retains contact for an ordinary join and cut', () => {
  const base = rectanglePart(40, 20, 8.00041);
  const evaluated = evaluateDoc(base, 1);
  assert.ok(evaluated.ok);
  const face = evaluated.bodies[0].mesh.faces.find(face => face.normal[2] === 1);
  assert.ok(face);
  const plane = planeOfDisplayFace(face);
  assert.ok(plane);
  const sketch = withNode(base, { kind: 'sketch', profile: 'rectangle', min: [4, 4], max: [16, 11], plane });
  const outside = withNode(sketch, { kind: 'extrude', sketch: 2, height: 3 });
  const inside = withNode(sketch, { kind: 'extrude', sketch: 2, from: -3, height: 3 });
  const parent = { node: 1, side: 'solid' } as const, tool = { node: 3, side: 'solid' } as const;
  const joined = withNode(outside, { kind: 'union', left: parent, right: tool });
  const cut = withNode(inside, { kind: 'difference', parent, tool });
  for (const [doc, sign] of [[joined, 1], [cut, -1]] as const) {
    const result = evaluateDoc(doc, 1);
    assert.ok(result.ok, JSON.stringify(result));
    assert.equal(result.bodies.length, 1);
    assert.ok(Math.abs((result.bodies[0].volume ?? 0) - (40 * 20 * 8.00041 + sign * 12 * 7 * 3)) < 1e-7);
  }
});
