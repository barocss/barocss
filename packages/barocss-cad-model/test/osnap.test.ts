import test from 'node:test';
import assert from 'node:assert/strict';
import type { Curve } from '@barocss/cad';
import { movedBody } from '../src/assembly/explode';
import { clipMesh } from '../src/engine/clip';
import { evaluateDoc, partBreps, placeBody } from '../src/engine/evaluate';
import { rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { bodyMesh, type DisplayMesh, type Vec3 } from '../src/engine/mesh';
import { MeshReceiver, MeshSender } from '../src/engine/meshWire';
import { nativeCircleOf } from '../src/engine/nativeCircle';
import { pointAlongSnap, modelSnaps, nearestSnap, shapeSnaps } from '../src/sketch/osnap';
import { offsetPlane, planeOfFace, standardPlane, xyPlane } from '../src/sketch/plane';
import type { SketchShape } from '../src/sketch/types';

test('sketch snaps: a rectangle’s corners, middles and centre; a drafting one only its first corner', () => {
  const r = shapeSnaps({ kind: 'rectangle', a: [0, 0], b: [10, 4] });
  assert.equal(r.length, 9);
  assert.deepEqual(r.filter(p => p.kind === 'centre').map(p => p.at), [[5, 2]]);
  assert.deepEqual(shapeSnaps({ kind: 'rectangle', a: [0, 0], b: [10, 4] }, true).map(p => p.at), [[0, 0]]);
  assert.deepEqual(shapeSnaps({ kind: 'circle', c: [1, 1], r: 2 }).map(p => p.kind), ['centre', 'quadrant', 'quadrant', 'quadrant', 'quadrant']);
});

test('model snaps on a face: its corners, edge middles and a hole’s centre; the nearest on screen wins', () => {
  const doc = withNode(rectanglePart(40, 20, 8), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [12, 9], radius: 3 });
  const r = evaluateDoc(doc, 1); assert.ok(r.ok);
  const plane = planeOfFace([0, 0, 1], [20, 10, 8])!, pts = modelSnaps(r.bodies.map(b => b.mesh), plane);
  const has = (kind: string, at: number[]) => pts.some(p => p.kind === kind && Math.abs(p.at[0] - at[0]) < 1e-3 && Math.abs(p.at[1] - at[1]) < 1e-3);
  assert.ok(has('end', [40, 20]) && has('mid', [20, 0]) && has('centre', [12, 9]), JSON.stringify(pts));
  assert.ok(!pts.some(p => Math.abs(p.at[0] - 40) < 1e-6 && p.kind === 'end' && Math.abs(p.at[1]) > 21), 'only edges in the plane');
  const screen = (p: [number, number]): [number, number] => [p[0] * 10, p[1] * 10];
  assert.deepEqual(nearestSnap(pts, screen, [122, 92])?.at, [12, 9]);
  assert.equal(nearestSnap(pts, screen, [300, 150]), null);
});

const centres = (points: ReturnType<typeof modelSnaps>) => points.filter(point => point.kind === 'centre').map(point => point.at);

test('curved display samples cannot certify a circle centre', () => {
  const ring: Vec3[] = Array.from({ length: 6 }, (_, index) => {
    const angle = index * Math.PI / 3;
    return [20 * Math.cos(angle), 10 * Math.sin(angle), 0];
  });
  const mesh: DisplayMesh = {
    positions: new Float64Array(), normals: new Float32Array(), faceOfVertex: new Float32Array(), indices: new Uint32Array(),
    faces: [], bounds: { min: [-20, -10, 0], max: [20, 10, 0] },
    edgeLines: new Float64Array(ring.flatMap((point, index) => [...point, ...ring[(index + 1) % ring.length]])),
    edgeOfSegment: new Float32Array(12),
    edges: [{ index: 0, faces: [0, 1], a: ring[0], b: ring[0], straight: false, axis: null, names: ['display-only'] }],
  };
  // The previous three picks lie on a circle at (3.75,0). The fourth radius is 23.75, not 16.25.
  assert.deepEqual(centres(modelSnaps([mesh], xyPlane())), []);
});

test('native circle support requires the weights, tangent poles and all span bindings', () => {
  const w = Math.SQRT1_2;
  const arc: Curve = { kind: 'curve', id: 'arc', degree: 2,
    knots: [0, 0, 0, 0.5, 0.5, 1, 1, 1], weights: [1, w, 1, w, 1],
    controlPoints: [[5, 0, 2], [5, 5, 2], [0, 5, 2], [-5, 5, 2], [-5, 0, 2]] };
  const support = nativeCircleOf(arc);
  assert.ok(support);
  assert.ok(Math.hypot(support.centre[0], support.centre[1], support.centre[2] - 2) < 1e-10);
  assert.ok(Math.abs(support.radius - 5) < 1e-10 && Math.abs(support.normal[2] - 1) < 1e-10);
  for (const candidate of [
    { ...arc, controlPoints: [arc.controlPoints[0], [6, 5, 2], ...arc.controlPoints.slice(2)] },
    { ...arc, controlPoints: [...arc.controlPoints.slice(0, 3), [-5, 5, 2.1], arc.controlPoints[4]] },
    { ...arc, controlPoints: [...arc.controlPoints.slice(0, 3), [5, 5, 2], [5, 10, 2]] },
    { ...arc, controlPoints: [arc.controlPoints[0], arc.controlPoints[0], ...arc.controlPoints.slice(2)] },
    { ...arc, controlPoints: [[NaN, 0, 2], ...arc.controlPoints.slice(1)] },
    { ...arc, weights: [1, 1, 1, 1, 1] },
    { ...arc, weights: [1, NaN, 1, w, 1] },
    { ...arc, knots: [0, 0, 0, 0.4, 0.6, 1, 1, 1] },
  ] satisfies Curve[]) assert.equal(nativeCircleOf(candidate), undefined);
  const small: Curve = { ...arc, controlPoints: arc.controlPoints.map(point => [point[0] / 1000, point[1] / 1000, point[2]]) };
  assert.ok(Math.abs(nativeCircleOf(small)!.radius - 0.005) < 1e-10);
  const shallowWeight = Math.sqrt(1 - 1e-8);
  const shallowHeight = 100 * (1 - shallowWeight) * (1 + shallowWeight) / shallowWeight;
  const shallow: Curve = { ...arc, knots: [0, 0, 0, 1, 1, 1], weights: [1, shallowWeight, 1],
    controlPoints: [[-0.01, 0, 0], [0, shallowHeight, 0], [0.01, 0, 0]] };
  assert.ok(nativeCircleOf(shallow));
  const perturbed: Curve = { ...shallow, controlPoints: [shallow.controlPoints[0], [0, shallowHeight + 5e-8, 0], shallow.controlPoints[2]] };
  assert.equal(nativeCircleOf(perturbed), undefined);
  const skewed: Curve = { ...shallow, controlPoints: [shallow.controlPoints[0], [2e-12, shallowHeight, 0], shallow.controlPoints[2]] };
  assert.equal(nativeCircleOf(skewed), undefined);
});

test('polynomial Loft keeps End and Middle snaps at every declared tessellation quality', () => {
  const doc: StudioDoc = { format: 'barocss-cad-model', schema: 3, units: 'mm', parameters: {}, nextId: 2, nodes: [
    { kind: 'sketch', id: 'n0', profile: 'rectangle', min: [0, 0], max: [10, 10] },
    { kind: 'loft', id: 'n1', from: [0, 0], sections: [{ sketch: 0, z: 0 }, { sketch: 0, z: 20 }],
      guide: { kind: 'nurbs', degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: [[0, 0, 0], [10, 0, 10], [0, 0, 20]] } },
  ], outputs: { b1: { node: 1, side: 'solid' } } };
  const [native] = partBreps(doc);
  for (const quality of [2, 8, 32]) {
    const mesh = bodyMesh(native.brep, 0, quality), plane = standardPlane('xz');
    assert.ok(mesh.edges.some(edge => !edge.straight && edge.names.includes('n1.side0|n1.side3')));
    const points = modelSnaps([mesh], plane);
    assert.deepEqual(centres(points), []);
    assert.ok(points.some(point => point.kind === 'end' && point.at[0] === 0 && point.at[1] === 20));
    assert.ok(points.some(point => point.kind === 'mid' && point.at[0] === 5 && point.at[1] === 20));
    const reversed = { ...mesh, edgeOfSegment: mesh.edgeOfSegment.slice().reverse() };
    assert.deepEqual(modelSnaps([reversed], plane), points);
  }
});

test('verified hole centres survive mesh transport and move in the current body frame', () => {
  const doc = withNode(rectanglePart(40, 20, 8), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [12.25, 9.25], radius: 3 });
  const evaluated = evaluateDoc(doc, 0);
  assert.ok(evaluated.ok);
  const sender = new MeshSender(), receiver = new MeshReceiver();
  const wire = sender.pack('evaluate', evaluated);
  const copied = receiver.unpack('evaluate', structuredClone(wire.result, { transfer: wire.transfer }));
  assert.ok(copied.ok);
  const [body] = copied.bodies, plane = xyPlane(8);
  assert.deepEqual(centres(modelSnaps([body.mesh], plane)), [[12.25, 9.25]]);
  assert.deepEqual(centres(modelSnaps([{ ...body.mesh, edgeOfSegment: new Float32Array() }], plane)), []);
  assert.deepEqual(centres(modelSnaps([{ ...body.mesh, edgeLines: new Float64Array(body.mesh.edgeLines.length) }], plane)), []);
  const partialRim = clipMesh(body.mesh, 0, 15.15, 'positive', 'section');
  const tangentRim = clipMesh(body.mesh, 0, 15.25, 'positive', 'section');
  assert.ok(partialRim && tangentRim);
  assert.deepEqual(centres(modelSnaps([partialRim], plane)), [[12.25, 9.25]]);
  assert.deepEqual(centres(modelSnaps([tangentRim], plane)), []);
  assert.deepEqual(centres(modelSnaps([body.mesh], xyPlane(8.01))), []);
  const moved = movedBody(body, [3, -2, 4]);
  assert.deepEqual(centres(modelSnaps([moved.mesh], xyPlane(12))), [[15.25, 7.25]]);
  const placed = placeBody(body, [1, 0, 0, 0, 0, -1, 0, 1, 0], [4, 5, 6]);
  assert.deepEqual(centres(modelSnaps([placed.mesh], offsetPlane(standardPlane('xz'), 3))), [[16.25, 15.25]]);
  assert.deepEqual(centres(modelSnaps([placed.mesh], xyPlane(15.25))), []);
});

test('two-point snaps preserve direction, extrapolation, and coordinate limits', () => {
  assert.deepEqual(pointAlongSnap([0, 0], [12, 0], 'ratio', 1 / 3), [4, 0]);
  assert.deepEqual(pointAlongSnap([0, 0], [12, 0], 'ratio', 1.5), [18, 0]);
  assert.deepEqual(pointAlongSnap([0, 0], [12, 0], 'ratio', -0.5), [-6, 0]);
  assert.deepEqual(pointAlongSnap([0, 0], [6, 8], 'distance', 5), [3, 4]);
  assert.deepEqual(pointAlongSnap([0, 0], [6, 8], 'distance', -5), [-3, -4]);
  assert.deepEqual(pointAlongSnap([6, 8], [0, 0], 'distance', 2.5), [4.5, 6]);
  assert.deepEqual(pointAlongSnap([0, 0], [10, 4], 'ratio', 0.25), [2.5, 1]);
  assert.equal(pointAlongSnap([1, 2], [1, 2], 'ratio', 0.5), null);
  assert.equal(pointAlongSnap([0, 0], [1e-9, 0], 'distance', 5), null);
  assert.equal(pointAlongSnap([0, 0], [6, 8], 'ratio', Infinity), null);
  assert.equal(pointAlongSnap([0, 0], [6, 8], 'ratio', Number.MAX_VALUE), null);
  assert.equal(pointAlongSnap([10000, 0], [9999, 0], 'distance', -1), null);
});

const middles = (shape: SketchShape) => shapeSnaps(shape).filter(point => point.kind === 'mid').map(point => point.at);
const arc = (a: [number, number], b: [number, number], bulge: number): Extract<SketchShape, { kind: 'polygon' }> =>
  ({ kind: 'polygon', points: [a, b], closed: false, bulges: [bulge] });

test('authored arc middles bisect signed sweeps, including a major arc', () => {
  assert.deepEqual(middles(arc([-10, 0], [10, 0], 1)), [[0, -10]]);
  assert.deepEqual(middles(arc([-10, 0], [10, 0], -1)), [[0, 10]]);
  const quarter = 5 * Math.SQRT2;
  for (const [bulge, expected] of [[Math.SQRT2 - 1, quarter], [1 + Math.SQRT2, 10 + quarter]]) {
    const [[x, y]] = middles(arc([10, 0], [0, 10], bulge));
    assert.ok(Math.hypot(x - expected, y - expected) < 1e-12);
    assert.deepEqual(middles(arc([0, 10], [10, 0], -bulge)), [[x, y]]);
  }
  assert.deepEqual(middles(arc([3, 2], [3, 12], 1)), [[8, 7]]);
  assert.deepEqual(middles(arc([-10, 0], [10, 0], 1e-12)), [[0, -1e-11]]);
});

test('arc snap admission keeps existing endpoints and straight middles', () => {
  const shape: Extract<SketchShape, { kind: 'polygon' }> = {
    kind: 'polygon', points: [[-10, 0], [10, 0], [10, 20]], closed: true, bulges: [1, 0, -1],
  };
  const open = { ...shape, closed: false, bulges: [1, -1] };
  assert.deepEqual(middles(shape), [[0, -10], [10, 10], [10, 0]]);
  assert.deepEqual(middles({ ...shape, pending: true }), [[0, -10], [10, 10]]);
  assert.deepEqual(middles(open), [[0, -10], [0, 10]]);
  assert.deepEqual(middles({ ...open, pending: true }), [[0, -10]]);
  assert.deepEqual(middles({ ...open, pending: true, bulges: [1, 0] }), [[0, -10]]);
  const spline: typeof shape = { ...shape, fromSpline: true, spline: { fit: shape.points, closed: true } };
  const ellipse: typeof shape = { ...shape, fromEllipse: true };
  assert.deepEqual(middles(spline), [[10, 10]]);
  assert.deepEqual(middles(ellipse), [[10, 10]]);
  assert.deepEqual(middles(arc([-10, 0], [10, 0], 0)), [[0, 0]]);
  for (const bulge of [NaN, Infinity, Number.MIN_VALUE, Number.MAX_VALUE, 1001]) {
    const points = shapeSnaps(arc([-10, 0], [10, 0], bulge));
    assert.deepEqual(points.map(point => point.kind), ['end', 'end']);
  }
  assert.deepEqual(middles(arc([1, 2], [1, 2], 1)), []);
  assert.deepEqual(middles(arc([0, 0], [1e-8, 0], 1)), []);
  assert.deepEqual(middles(arc([0, 0], [10001, 0], 1)), []);
});
