import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, outputOf, massPropertiesOf, checkOutput, reevaluate, saveCadPart, loadCadPart, CadPartError } from '../dist/index.js';

// A face fillet between two planar faces that need not touch. Expectations from the inputs: the round of radius r
// in a corner of angle θ meets each face a = r / tan(θ/2) from the corner, and its section between the corner and the
// arc is a·r − r²(π − θ)/2; at an inside corner that much is filled (less what is there), at an outside one cut.
const doc = (features, parameters = {}) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters, features });
const out = (features, id, parameters) => outputOf(evaluateCadPart(doc(features, parameters)), id);
const volume = (features, id, parameters) => massPropertiesOf(out(features, id, parameters)).volume;
const near = (a, b, what) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
const refused = (features, code, pattern) => assert.throws(() => evaluateCadPart(doc(features)), e => e instanceof CadPartError && e.code === code && pattern.test(e.message), String(pattern));
const section = (r, theta) => { const a = r / Math.tan(theta / 2); return a * r - r * r * (Math.PI - theta) / 2; };
const XZ = { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] }; // sketch (x, y) = world (x, z), 20 deep along −Y
const prism = (points) => [{ id: 's', kind: 'sketch', profile: 'polygon', plane: XZ, points }, { id: 'b', kind: 'extrude', sketch: 's', height: 20 }];
const fillet = (faces, radius) => ({ id: 'ff', kind: 'face-fillet', target: 'b', faces, radius });
const valid = (o) => { const c = checkOutput(o); assert.equal(c.valid, true, JSON.stringify(c.issues)); assert.equal(c.counts.bodies, 1); };
// An L whose inside corner (5, 5) has a 3 mm chamfer: the floor's top (side2) and the wall (side4) do not touch.
const L = prism([[0, 0], [30, 0], [30, 5], [8, 5], [5, 8], [5, 30], [0, 30]]);
// A block whose outside corner (30, 20) has a 3 mm chamfer: its side (side1) and top (side3) do not touch.
const block = prism([[0, 0], [30, 0], [30, 17], [27, 20], [0, 20]]);

test('face fillet: an inside corner across a chamfer is filled to the round, the chamfer gone', () => {
  const o = out([...L, fillet(['b.side2', 'b.side4'], 6)], 'ff'); valid(o);
  near(massPropertiesOf(o).volume, volume(L, 'b') + 20 * (section(6, Math.PI / 2) - 4.5), 'filled');
  const names = o.brep.faces.map(f => f.name); assert.ok(names.includes('ff.round')); assert.ok(!names.includes('b.side3'), 'the chamfer is replaced');
  // Either order of the faces.
  near(volume([...L, fillet(['b.side4', 'b.side2'], 6)], 'ff'), massPropertiesOf(o).volume, 'order');
});

test('face fillet: an outside corner across a chamfer is cut to the round; adjacent faces work as an edge fillet', () => {
  const o = out([...block, fillet(['b.side3', 'b.side1'], 8)], 'ff'); valid(o);
  near(massPropertiesOf(o).volume, volume(block, 'b') - 20 * (section(8, Math.PI / 2) - 4.5), 'cut');
  assert.ok(!o.brep.faces.some(f => f.name === 'b.side2'));
  near(volume([...block, fillet(['b.side3', 'b.side4'], 5)], 'ff'), volume(block, 'b') - 20 * section(5, Math.PI / 2), 'adjacent top and back');
});

test('face fillet: corners other than square — a 120° inside corner, a 60° outside one', () => {
  const s3 = Math.sqrt(3);
  // A floor at z 5 from x 10, and a wall leaning back at 120° from it.
  const ramp = prism([[0, 0], [40, 0], [40, 5], [10, 5], [0, 5 + 10 * s3]]);
  const o = out([...ramp, fillet(['b.side2', 'b.side3'], 3)], 'ff'); valid(o);
  near(massPropertiesOf(o).volume, volume(ramp, 'b') + 20 * section(3, 2 * Math.PI / 3), '120° inside');
  // A wedge's 60° tip at (30, 0).
  const wedge = prism([[0, 0], [30, 0], [15, 15 * s3]]);
  const w = out([...wedge, fillet(['b.side0', 'b.side1'], 2)], 'ff'); valid(w);
  near(massPropertiesOf(w).volume, volume(wedge, 'b') - 20 * section(2, Math.PI / 3), '60° outside');
});

test('face fillet: follows an upstream edit, and survives save and open', () => {
  const tall = (h) => prism([[0, 0], [30, 0], [30, 5], [8, 5], [5, 8], [5, h], [0, h]]);
  const features = [...tall({ parameter: 'H' }), fillet(['b.side2', 'b.side4'], 6)];
  const snap = evaluateCadPart(doc(features, { H: 30 })), taller = reevaluate(snap, { parameters: { H: 40 } });
  near(massPropertiesOf(outputOf(taller, 'ff')).volume, volume(tall(40), 'b') + 20 * (section(6, Math.PI / 2) - 4.5), 'a taller wall');
  const reopened = loadCadPart(saveCadPart(snap));
  assert.deepEqual(reopened.document, snap.document); assert.equal(massPropertiesOf(outputOf(reopened, 'ff')).volume, massPropertiesOf(outputOf(snap, 'ff')).volume);
});

test('face fillet: refused with the reason', () => {
  // The floor runs 25 from the corner: a 26 round would meet it past its end.
  refused([...L, fillet(['b.side2', 'b.side4'], 26)], 'GEOMETRY', /\[FACE_FILLET_RADIUS\] a 26 mm round would not meet b\.side2 tangentially/);
  refused([...block, fillet(['b.side1', 'b.side4'], 4)], 'CAPABILITY', /\[FACE_FILLET_PARALLEL\]/);
  // A T: the plane of the stem's side (x 17) cuts through the bottom face.
  const T = prism([[0, 0], [30, 0], [30, 5], [17, 5], [17, 20], [13, 20], [13, 5], [0, 5]]);
  refused([...T, fillet(['b.side3', 'b.side0'], 2)], 'CAPABILITY', /\[FACE_FILLET_FACES\] b\.side0 crosses the line/);
  // The stem's side and the floor to its right make the T's inside corner: that one is filled.
  near(volume([...T, fillet(['b.side3', 'b.side2'], 2)], 'ff'), volume(T, 'b') + 20 * section(2, Math.PI / 2), 'T corner');
  refused([...block, fillet(['b.side1', 'nope'], 4)], 'REFERENCE', /no face nope/);
  refused([...block, fillet(['b.side1', 'b.side1'], 4)], 'INPUT', /two different faces/);
  const disc = [{ id: 'c', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 }, { id: 'b', kind: 'extrude', sketch: 'c', height: 10 }];
  refused([...disc, fillet(['b.side0', 'b.bottom'], 1)], 'CAPABILITY', /\[FACE_FILLET_FACE\] b\.side0 is not a planar face/);
  refused([...disc, fillet(['b.top', 'b.bottom'], 1)], 'CAPABILITY', /\[FACE_FILLET_FACE\] b\.top has a curved edge/);
});
