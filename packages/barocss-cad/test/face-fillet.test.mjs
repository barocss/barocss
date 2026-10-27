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
  // Two coaxial cylinders a step apart (heights 0–5 and 5–10) do not run side by side; a helical thread face is not taken (a plane and a cylinder are: the disc's bottom rim rounds).
  const stepped = [{ id: 's', kind: 'sketch', profile: 'polygon', plane: XZ, points: [[0, 0], [10, 0], [10, 5], [5, 5], [5, 10], [0, 10]] }, { id: 'b', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' } }];
  refused([...stepped, fillet(['b.side1', 'b.side3'], 1)], 'CAPABILITY', /\[FACE_FILLET_FACES\] b\.side1 and b\.side3 do not run side by side/);
  const rod = [{ id: 'b', kind: 'thread', diameter: 6, pitch: 1, seat: 10, length: 10, form: 'helical' }];
  refused([...rod, fillet(['b.thread', 'b.end'], 0.2)], 'CAPABILITY', /\[FACE_FILLET_FACE\] b\.thread is not a plane, cylinder, cone, sphere or torus/);
  valid(out([...disc, fillet(['b.side0', 'b.bottom'], 1)], 'ff'));
  refused([...disc, fillet(['b.top', 'b.bottom'], 1)], 'CAPABILITY', /\[FACE_FILLET_FACE\] b\.top has a curved edge/);
});

// A plane and a cylinder square to it: the section revolved about the axis. Pappus: the r × r square less the quarter
// disc, its centroid off − from the corner along each face, swept round at radius R ± off.
const ring = (R, r, side) => { const A = r * r - Math.PI * r * r / 4, off = (r ** 3 / 2 - Math.PI * r * r / 4 * (r - 4 * r / (3 * Math.PI))) / A; return 2 * Math.PI * (R + side * off) * A; };
const turned = (points) => [{ id: 's', kind: 'sketch', profile: 'polygon', plane: XZ, points }, { id: 'b', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' } }];
const bossPlate = (h) => [{ id: 'ps', kind: 'sketch', profile: 'rectangle', min: [-30, -30], max: [30, 30] }, { id: 'p', kind: 'extrude', sketch: 'ps', height: 5 }, { id: 'cs', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 10 }, { id: 'c', kind: 'extrude', sketch: 'cs', height: h - 4, from: 4 }, { id: 'b', kind: 'union', target: 'p', tool: 'c' }];

test('face fillet: a boss on a plate across its base chamfer — the round revolved, filled', () => {
  const boss = turned([[0, 0], [30, 0], [30, 5], [13, 5], [10, 8], [10, 25], [0, 25]]);
  const o = out([...boss, fillet(['b.side2', 'b.side4'], 6)], 'ff'); valid(o);
  // The chamfer's ring (its triangle 4.5 mm² at radius 11) is replaced by the round's.
  near(massPropertiesOf(o).volume, volume(boss, 'b') + ring(10, 6, 1) - 2 * Math.PI * 11 * 4.5, 'filled');
  assert.ok(o.brep.faces.some(f => /^ff\.round/.test(f.name)) && !o.brep.faces.some(f => /^b\.side3/.test(f.name)), 'the chamfer is replaced');
  near(volume([...boss, fillet(['b.side4', 'b.side2'], 6)], 'ff'), massPropertiesOf(o).volume, 'order');
  // A boss joined to a square plate (adjacent faces: the round in its base edge).
  const sq = out([...bossPlate(25), { id: 'ff', kind: 'face-fillet', target: 'b', faces: ['p.top', 'c.side0'], radius: 4 }], 'ff'); valid(sq);
  near(massPropertiesOf(sq).volume, volume(bossPlate(25), 'b') + ring(10, 4, 1), 'square plate');
});

test('face fillet: a disc\'s rim and a hole\'s edge — outside corners, the round revolved, cut', () => {
  const disc = [{ id: 'ds', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 20 }, { id: 'b', kind: 'extrude', sketch: 'ds', height: 10 }];
  const d = out([...disc, fillet(['b.top', 'b.side0'], 4)], 'ff'); valid(d);
  near(massPropertiesOf(d).volume, Math.PI * 400 * 10 - ring(20, 4, -1), 'rim');
  const holed = [{ id: 'ps', kind: 'sketch', profile: 'rectangle', min: [-30, -30], max: [30, 30] }, { id: 'p', kind: 'extrude', sketch: 'ps', height: 10 }, { id: 'h', kind: 'hole', target: 'p', center: [0, 0], radius: 5 }];
  const h = out([...holed, { id: 'ff', kind: 'face-fillet', target: 'h', faces: ['p.top', 'h.side0'], radius: 2 }], 'ff'); valid(h);
  near(massPropertiesOf(h).volume, 36000 - Math.PI * 25 * 10 - ring(5, 2, 1), 'hole edge');
});

test('face fillet: a plane and a cylinder refused with the reason', () => {
  const tall = bossPlate(45), on = (faces, radius) => [...tall, { id: 'ff', kind: 'face-fillet', target: 'b', faces, radius }];
  // The tangent circle at radius 31 runs off the 60 mm square plate.
  refused(on(['p.top', 'c.side0'], 21), 'GEOMETRY', /\[FACE_FILLET_RADIUS\] a 21 mm round would not meet p\.top tangentially: its tangent point lies off the face/);
  // A boss 10 above the plate: the plate holds a 12 mm round's circle (22 round), the boss does not reach it.
  refused([...bossPlate(15), { id: 'ff', kind: 'face-fillet', target: 'b', faces: ['p.top', 'c.side0'], radius: 12 }], 'GEOMETRY', /\[FACE_FILLET_RADIUS\] a 12 mm round would not meet .*c\.side0.* tangentially/);
  refused([...bossPlate(25), { id: 'ff', kind: 'face-fillet', target: 'b', faces: ['p.top', 'c.side0'], radius: 25 }], 'GEOMETRY', /\[FACE_FILLET_RADIUS\] a 25 mm round would not meet p\.top tangentially/);
  // The plate's side (z 0–5) and the boss (above the plate) run along one axis but not beside each other.
  refused(on(['p.side0', 'c.side0'], 2), 'CAPABILITY', /\[FACE_FILLET_FACES\] p\.side0 and c\.side0 do not run side by side/);
  const disc = [{ id: 'ds', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 }, { id: 'b', kind: 'extrude', sketch: 'ds', height: 10 }];
  // (Wider than the disc's radius 5: the tangent circle on its top would have a negative radius.)
  refused([...disc, fillet(['b.top', 'b.side0'], 6)], 'GEOMETRY', /\[FACE_FILLET_RADIUS\] a 6 mm round would not meet b\.top tangentially/);
});

// Faces along one direction (a plane along a cylinder, two parallel cylinders): the round extruded. The oracle builds
// each corner's section by hand — centre X where the curves pushed off by r meet, the tangent points, the corner where
// the curves meet — and takes its area from a dense polygon (each arc 20000 chords), not the kernel's exact formula.
const arcPts = (P, Q, M, n = 20000) => { const a0 = Math.atan2(P[1] - M[1], P[0] - M[0]); let da = Math.atan2(Q[1] - M[1], Q[0] - M[0]) - a0; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI; const R = Math.hypot(P[0] - M[0], P[1] - M[1]); return Array.from({ length: n }, (_, i) => [M[0] + R * Math.cos(a0 + da * i / n), M[1] + R * Math.sin(a0 + da * i / n)]); };
const polyArea = (pts) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
const towards = (c, X, R) => { const w = [X[0] - c[0], X[1] - c[1]], l = Math.hypot(...w); return [c[0] + w[0] / l * R, c[1] + w[1] / l * R]; };

test('face fillet: two parallel bosses joined — both inside corners filled, extruded', () => {
  const eight = [{ id: 'a0', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 6 }, { id: 'a', kind: 'extrude', sketch: 'a0', height: 10 }, { id: 'b0', kind: 'sketch', profile: 'circle', center: [10, 0], radius: 6 }, { id: 'b', kind: 'extrude', sketch: 'b0', height: 10 }, { id: 'u', kind: 'union', target: 'a', tool: 'b' }];
  const o = out([...eight, { id: 'ff', kind: 'face-fillet', target: 'u', faces: ['a.side0', 'b.side0'], radius: 2 }], 'ff'); valid(o);
  // Centres 8 from both circle centres; corners where the circles cross.
  const X = [5, Math.sqrt(64 - 25)], tA = towards([0, 0], X, 6), tB = towards([10, 0], X, 6), C = [5, Math.sqrt(36 - 25)];
  const Q = polyArea([...arcPts(C, tA, [0, 0]), ...arcPts(tA, tB, X), ...arcPts(tB, C, [10, 0])]);
  assert.ok(Math.abs(massPropertiesOf(o).volume - (volume(eight, 'u') + 2 * 10 * Q)) <= 1e-6 * volume(eight, 'u'), `${massPropertiesOf(o).volume} vs ${volume(eight, 'u') + 20 * Q}`);
  assert.deepEqual(o.brep.faces.map(f => f.name).filter(n => n.startsWith('ff.')).sort(), ['ff.round', 'ff.round1']);
});

test('face fillet: a tube lying on a plate — its two weld corners filled; a D-shaft\'s flat — both edges cut', () => {
  const XZ2 = { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] };
  const tube = [{ id: 'ps', kind: 'sketch', profile: 'rectangle', min: [-20, -30], max: [20, 0] }, { id: 'p', kind: 'extrude', sketch: 'ps', height: 5 }, { id: 'ts', kind: 'sketch', profile: 'circle', plane: XZ2, center: [0, 8], radius: 6 }, { id: 't', kind: 'extrude', sketch: 'ts', height: 30 }, { id: 'u', kind: 'union', target: 'p', tool: 't' }];
  const o = out([...tube, { id: 'ff', kind: 'face-fillet', target: 'u', faces: ['p.top', 't.side0'], radius: 2 }], 'ff'); valid(o);
  // In (x, z): the plate's top z 5, the tube's circle about (0, 8), radius 6.
  const X = [Math.sqrt(64 - 1), 7], tA = [X[0], 5], tB = towards([0, 8], X, 6), C = [Math.sqrt(27), 5];
  const Q = polyArea([C, tA, ...arcPts(tA, tB, X), ...arcPts(tB, C, [0, 8])]);
  assert.ok(Math.abs(massPropertiesOf(o).volume - (volume(tube, 'u') + 2 * 30 * Q)) <= 1e-6 * volume(tube, 'u'), 'tube');
  const dshaft = [{ id: 'cs', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 }, { id: 'c', kind: 'extrude', sketch: 'cs', height: 20 }, { id: 'ks', kind: 'sketch', profile: 'rectangle', min: [3, -10], max: [10, 10] }, { id: 'k', kind: 'extrude', sketch: 'ks', height: 30, from: -5 }, { id: 'd', kind: 'difference', target: 'c', tool: 'k' }];
  const dd = out([...dshaft, { id: 'ff', kind: 'face-fillet', target: 'd', faces: ['k.side3', 'c.side0'], radius: 1 }], 'ff'); valid(dd);
  // The flat x 3 and the circle radius 5: the round's centre 1 inside both.
  const Y = [2, Math.sqrt(16 - 4)], sA = [3, Y[1]], sB = towards([0, 0], Y, 5), D = [3, 4];
  const P = polyArea([D, sA, ...arcPts(sA, sB, Y), ...arcPts(sB, D, [0, 0])]);
  assert.ok(Math.abs(massPropertiesOf(dd).volume - (volume(dshaft, 'd') - 2 * 20 * P)) <= 1e-6 * volume(dshaft, 'd'), 'D-shaft');
  // Too big a round for the flat's 8 mm width (its corners at y ±4).
  refused([...dshaft, { id: 'ff', kind: 'face-fillet', target: 'd', faces: ['k.side3', 'c.side0'], radius: 6 }], 'GEOMETRY', /\[FACE_FILLET_RADIUS\] no 6 mm round is tangent to both/);
});

// Cones (with planes and cylinders, turning about one axis): the round revolved. The oracle builds each section by hand
// in the half-plane (radius, height) — corner C, the faces' directions from it, θ between them, a = r / tan(θ/2), the
// centre on the bisector r / sin(θ/2) out — and revolves a dense polygon of it (Pappus by the polygon's first moment).
const revolvedVolume = (pts) => { let m = 0; pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; m += (p[0] + q[0]) * (p[0] * q[1] - q[0] * p[1]); }); return Math.abs(2 * Math.PI * m / 6); };
const sectionVolume = (C, dA, dB, r) => {
  const th = Math.acos(dA[0] * dB[0] + dA[1] * dB[1]), a = r / Math.tan(th / 2), b = [dA[0] + dB[0], dA[1] + dB[1]], bl = Math.hypot(...b);
  const X = [C[0] + b[0] / bl * r / Math.sin(th / 2), C[1] + b[1] / bl * r / Math.sin(th / 2)], tA = [C[0] + dA[0] * a, C[1] + dA[1] * a], tB = [C[0] + dB[0] * a, C[1] + dB[1] * a];
  return revolvedVolume([C, tA, ...arcPts(tA, tB, X)]);
};
const s2 = Math.SQRT1_2;

test('face fillet: cones — a tapered boss\'s base filled, a chamfered shaft end and a countersink\'s rim cut', () => {
  const g = Math.hypot(4, 20), taper = turned([[0, 0], [30, 0], [30, 5], [10, 5], [6, 25], [0, 25]]);
  const o = out([...taper, fillet(['b.side2', 'b.side3'], 3)], 'ff'); valid(o);
  near(massPropertiesOf(o).volume, volume(taper, 'b') + sectionVolume([10, 5], [1, 0], [-4 / g, 20 / g], 3), 'tapered boss (101°)');
  // A shaft's end chamfered 1 × 45°: the chamfer's cone and the shaft (135°).
  const shaft = turned([[0, 0], [5, 0], [5, 19], [4, 20], [0, 20]]);
  const sh = out([...shaft, fillet(['b.side1', 'b.side2'], 2)], 'ff'); valid(sh);
  near(massPropertiesOf(sh).volume, volume(shaft, 'b') - sectionVolume([5, 19], [0, -1], [-s2, s2], 2), 'chamfer to shaft');
  // A countersunk Ø6 hole (Ø12 at the top, 90°) in a 10 mm plate: the plate's top and the countersink's cone.
  const cs = [{ id: 'ps', kind: 'sketch', profile: 'rectangle', min: [-30, -30], max: [30, 30] }, { id: 'p', kind: 'extrude', sketch: 'ps', height: 10 }, { id: 'h', kind: 'hole', target: 'p', center: [0, 0], radius: 3, countersink: 12 }];
  const c = out([...cs, { id: 'ff', kind: 'face-fillet', target: 'h', faces: ['p.top', 'h.countersink-side1'], radius: 1 }], 'ff'); valid(c);
  near(massPropertiesOf(c).volume, volume(cs, 'h') - sectionVolume([6, 10], [1, 0], [-s2, -s2], 1), 'countersink rim');
  // …and where the countersink meets the bore.
  const cb = out([...cs, { id: 'ff', kind: 'face-fillet', target: 'h', faces: ['h.countersink-side1', 'h.side0'], radius: 0.5 }], 'ff'); valid(cb);
  near(massPropertiesOf(cb).volume, volume(cs, 'h') - sectionVolume([3, 7], [s2, s2], [0, -1], 0.5), 'countersink to bore');
  // The chamfer's 1.41 mm generator is too short for a round meeting it 3.4 mm from the corner.
  refused([...shaft, fillet(['b.side1', 'b.side2'], 8)], 'GEOMETRY', /\[FACE_FILLET_RADIUS\] a 8 mm round would not meet .*b\.side2.* tangentially/);
});

// Spheres and tori with planes and cylinders about one axis: circles in the half-plane, the round revolved. The oracle
// builds each section by hand (the round's centre where the curves pushed off by r meet, its tangent points, the corner)
// and revolves a dense polygon of it.
const turnedLoop = (segments) => [{ id: 's', kind: 'sketch', profile: 'loop', plane: XZ, segments }, { id: 'b', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' } }];
const linePts = (P, Q) => [P, Q];
const towards2 = (c, X, R) => { const w = [X[0] - c[0], X[1] - c[1]], l = Math.hypot(...w); return [c[0] + w[0] / l * R, c[1] + w[1] / l * R]; };

test('face fillet: a ball on a stem and a dome on a plate — spheres, the inside corner filled', () => {
  // A stem of radius 3 into a ball of radius 6 about (0, 25): they meet at height 25 − √27.
  const j = 25 - Math.sqrt(27), ball = turnedLoop([{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [3, 0] }, { kind: 'arc', start: [3, j], center: [0, 25], direction: 'ccw' }, { kind: 'line', start: [0, 31] }]);
  const o = out([...ball, fillet(['b.side1', 'b.side2'], 1.5)], 'ff'); valid(o);
  // The round's centre 4.5 off the axis and 7.5 from the ball's centre: (4.5, 19).
  const X = [4.5, 19], tA = [3, 19], tB = towards2([0, 25], X, 6), C = [3, j];
  near(massPropertiesOf(o).volume, volume(ball, 'b') + revolvedVolume([...linePts(C, tA), ...arcPts(tA, tB, X), ...arcPts(tB, C, [0, 25])]), 'ball on a stem');
  // A dome (a sphere of radius 10 about (0, 1)) on a disc 5 thick and 30 round: they meet at radius √84.
  const k = Math.sqrt(84), dome = turnedLoop([{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [30, 0] }, { kind: 'line', start: [30, 5] }, { kind: 'arc', start: [k, 5], center: [0, 1], direction: 'ccw' }, { kind: 'line', start: [0, 11] }]);
  const d = out([...dome, fillet(['b.side2', 'b.side3'], 2)], 'ff'); valid(d);
  const Y = [Math.sqrt(108), 7], sA = [Y[0], 5], sB = towards2([0, 1], Y, 10), D = [k, 5];
  near(massPropertiesOf(d).volume, volume(dome, 'b') + revolvedVolume([...linePts(D, sA), ...arcPts(sA, sB, Y), ...arcPts(sB, D, [0, 1])]), 'dome on a plate');
});

test('face fillet: a bead (a torus) on a plate — its outer and inner feet filled, each by its own plate face', () => {
  // A half-round bead of radius 3 about (15, 5) on a disc 5 thick: the top's outer ring (side2), the bead (side3), the inner disc (side4).
  const bead = turnedLoop([{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [30, 0] }, { kind: 'line', start: [30, 5] }, { kind: 'arc', start: [18, 5], center: [15, 5], direction: 'ccw' }, { kind: 'line', start: [12, 5] }, { kind: 'line', start: [0, 5] }]);
  const before = volume(bead, 'b'), w = Math.sqrt(15);
  const o = out([...bead, fillet(['b.side2', 'b.side3'], 1)], 'ff'); valid(o);
  const X = [15 + w, 6], tA = [X[0], 5], tB = towards2([15, 5], X, 3), C = [18, 5];
  near(massPropertiesOf(o).volume, before + revolvedVolume([...linePts(C, tA), ...arcPts(tA, tB, X), ...arcPts(tB, C, [15, 5])]), 'outer foot');
  const i = out([...bead, fillet(['b.side4', 'b.side3'], 1)], 'ff'); valid(i);
  const Y = [15 - w, 6], sA = [Y[0], 5], sB = towards2([15, 5], Y, 3), D = [12, 5];
  near(massPropertiesOf(i).volume, before + revolvedVolume([...linePts(D, sA), ...arcPts(sA, sB, Y), ...arcPts(sB, D, [15, 5])]), 'inner foot');
});

// Tilted cylinders: no section to extrude or revolve, so the rolling ball. A main pipe Ø20 along X and a branch Ø12,
// square to it and at 60°. Faces that meet (F0) take the edge fillet of every edge they share: the oracle is the
// `fillet` feature on those same edges.
const teeOf = (tilt) => {
  const t = tilt * Math.PI / 180, n = [Math.cos(t), 0, Math.sin(t)];
  return [{ id: 'ms', kind: 'sketch', profile: 'circle', plane: { origin: [-30, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] }, center: [0, 0], radius: 10 }, { id: 'm', kind: 'extrude', sketch: 'ms', height: 60 },
    { id: 'bs', kind: 'sketch', profile: 'circle', plane: { origin: [0, 0, 0], normal: n, xAxis: [0, 1, 0] }, center: [0, 0], radius: 6 }, { id: 'b', kind: 'extrude', sketch: 'bs', height: 25 }, { id: 'u', kind: 'union', target: 'm', tool: 'b' }];
};
const junctionOf = (tee) => out(tee, 'u').brep.edges.map(e => e.name).filter(x => x && /m\.side0/.test(x) && /b\.side0/.test(x));

test('face fillet: tilted cylinders that meet — a pipe tee at 90° and 60°, by the rolling ball on their shared edges', () => {
  for (const tilt of [90, 60]) {
    const tee = teeOf(tilt), o = out([...tee, { id: 'ff', kind: 'face-fillet', target: 'u', faces: ['m.side0', 'b.side0'], radius: 2 }], 'ff'); valid(o);
    const oracle = volume([...tee, { id: 'ff', kind: 'fillet', target: 'u', edges: junctionOf(tee), radius: 2 }], 'ff');
    near(massPropertiesOf(o).volume, oracle, `${tilt}°`);
    assert.ok(massPropertiesOf(o).volume > volume(tee, 'u'), 'an inside corner: filled');
  }
  // Too big a round for the branch's 6 mm radius: the rolling ball's own refusal comes through.
  assert.throws(() => evaluateCadPart(doc([...teeOf(90), { id: 'ff', kind: 'face-fillet', target: 'u', faces: ['m.side0', 'b.side0'], radius: 30 }])), e => e instanceof CadPartError);
});

// Tilted faces apart (F1): the corner between them restored, then the rolling ball. The oracle: the same round on the
// bare body (F0, whose own oracle is the edge fillet) — a round across a smaller round makes the same solid.
const tilted = (n) => [Math.cos(n * Math.PI / 180), 0, Math.sin(n * Math.PI / 180)];
const pinOn = () => { const n = tilted(60); return [{ id: 'ps', kind: 'sketch', profile: 'rectangle', min: [-25, -25], max: [25, 25] }, { id: 'p', kind: 'extrude', sketch: 'ps', height: 5 }, { id: 'cs', kind: 'sketch', profile: 'circle', plane: { origin: [0, 0, 3], normal: n, xAxis: [0, 1, 0] }, center: [0, 0], radius: 4 }, { id: 'c', kind: 'extrude', sketch: 'cs', height: 20 }, { id: 'u', kind: 'union', target: 'p', tool: 'c' }]; };
const holeIn = () => { const n = tilted(60); return [{ id: 'ps', kind: 'sketch', profile: 'rectangle', min: [-25, -25], max: [25, 25] }, { id: 'p', kind: 'extrude', sketch: 'ps', height: 10 }, { id: 'cs', kind: 'sketch', profile: 'circle', plane: { origin: [-6 * n[0], 0, -6 * n[2]], normal: n, xAxis: [0, 1, 0] }, center: [0, 0], radius: 4 }, { id: 'c', kind: 'extrude', sketch: 'cs', height: 30 }, { id: 'u', kind: 'difference', target: 'p', tool: 'c' }]; };
const ff = (id, target, faces, radius) => ({ id, kind: 'face-fillet', target, faces, radius });

test('face fillet: tilted faces apart — a pin at 60° rounded across its smaller round (inside), a tilted hole\'s edge (outside)', () => {
  const pin = pinOn(), bare = volume([...pin, ff('ff', 'u', ['p.top', 'c.side0'], 2)], 'ff');
  const across = out([...pin, ff('f1', 'u', ['p.top', 'c.side0'], 1), ff('ff', 'f1', ['p.top', 'c.side0'], 2)], 'ff'); valid(across);
  near(massPropertiesOf(across).volume, bare, 'pin: r2 across r1 = r2 on the bare pin');
  near(bare, volume([...pin, { id: 'ff', kind: 'fillet', target: 'u', edges: out(pin, 'u').brep.edges.map(e => e.name).filter(x => x && /p\.top/.test(x) && /c\.side0/.test(x)), radius: 2 }], 'ff'), 'pin: F0 = the edge fillet');
  const hole = holeIn(), bareH = volume([...hole, ff('ff', 'u', ['p.top', 'c.side0'], 1.5)], 'ff');
  const acrossH = out([...hole, ff('f1', 'u', ['p.top', 'c.side0'], 0.5), ff('ff', 'f1', ['p.top', 'c.side0'], 1.5)], 'ff'); valid(acrossH);
  near(massPropertiesOf(acrossH).volume, bareH, 'tilted hole: r1.5 across r0.5');
  assert.ok(bareH < volume(hole, 'u'), 'an outside corner: cut');
});

test('face fillet: a 60° pipe tee rounded across its smaller round — two tilted cylinders apart', () => {
  const tee = teeOf(60), bare = volume([...tee, ff('ff', 'u', ['m.side0', 'b.side0'], 4)], 'ff');
  const across = out([...tee, ff('f2', 'u', ['m.side0', 'b.side0'], 2), ff('ff', 'f2', ['m.side0', 'b.side0'], 4)], 'ff'); valid(across);
  near(massPropertiesOf(across).volume, bare, 'r4 across r2 = r4 on the bare tee');
});
