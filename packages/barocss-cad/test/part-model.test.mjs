import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, loadCadPart, emptyCadPart, CadPartError, checkBrep, brepMassProperties, tessellateBrep } from '../dist/index.js';

const D = (features, parameters = {}) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters, features });
const rect = (id, x0, y0, x1, y1) => ({ id, kind: 'sketch', profile: 'rectangle', min: [x0, y0], max: [x1, y1] });
const circle = (id, cx, cy, r) => ({ id, kind: 'sketch', profile: 'circle', center: [cx, cy], radius: r });
const extrude = (id, sketch, height, from) => ({ id, kind: 'extrude', sketch, height, ...(from === undefined ? {} : { from }) });
const pi = Math.PI;
const volume = o => o.massProperties(1).volumeMM3;
const close = (a, b, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(b));
const refused = (doc, code, pattern) => assert.throws(() => evaluateCadPart(doc), e => e instanceof CadPartError && e.code === code && pattern.test(e.message), pattern.source);

test('features evaluate on the B-rep with exact volumes; every output is valid with unique names', () => {
  const cases = [
    ['plate with a through hole', D([rect('s', 0, 0, 60, 40), extrude('e', 's', 8), { id: 'h', kind: 'hole', target: 'e', center: [15, 20], radius: 4 }]), 19200 - 128 * pi, 'upright'],
    ['blind hole', D([rect('s', 0, 0, 20, 10), extrude('e', 's', 5), { id: 'h', kind: 'hole', target: 'e', center: [10, 5], radius: 2, depth: 3 }]), 1000 - 12 * pi, 'upright'],
    ['boss union', D([rect('s', 0, 0, 60, 40), extrude('e', 's', 8), circle('c', 40, 20, 6), extrude('b', 'c', 10, 8), { id: 'u', kind: 'union', target: 'e', tool: 'b' }]), 19200 + 360 * pi, 'upright'],
    ['downward extrude', D([rect('s', 0, 0, 10, 10), extrude('e', 's', -4, 2)]), 400, 'upright'],
    ['fillet of a convex corner', D([rect('s', 0, 0, 20, 10), extrude('e', 's', 5), { id: 'f', kind: 'fillet', target: 'e', edges: ['e.side0|e.side1'], radius: 3 }]), 1000 - (9 - 9 * pi / 4) * 5, 'upright'],
    ['fillet of a concave corner', D([{ id: 's', kind: 'sketch', profile: 'polygon', points: [[0, 0], [20, 0], [20, 5], [5, 5], [5, 20], [0, 20]] }, extrude('e', 's', 3), { id: 'f', kind: 'fillet', target: 'e', edges: ['e.side2|e.side3'], radius: 2 }]), 525 + (4 - pi) * 3, 'upright'],
    ['chamfers: two vertical edges and a top edge', D([rect('s', 0, 0, 20, 10), extrude('e', 's', 5), { id: 'c', kind: 'chamfer', target: 'e', edges: ['e.side0|e.side1', 'e.side1|e.side2', 'e.side3|e.top'], distance: 1 }]), 990, 'planar'],
    ['rotated about X, then a Boolean (exact polyhedral)', D([rect('s', 0, 0, 10, 10), extrude('a', 's', 30), { id: 'r', kind: 'rotate', target: 'a', axis: 'x', angleDegrees: 90 }, rect('t', -5, -40, 15, 5), extrude('b', 't', 5), { id: 'u', kind: 'union', target: 'b', tool: 'r' }]), 6000, 'planar'],
    ['scale, move, rotate about Z by 30°', D([rect('s', 0, 0, 10, 10), extrude('a', 's', 5), { id: 'k', kind: 'scale', target: 'a', factor: 2 }, { id: 't', kind: 'translate', target: 'k', offset: [1, 2, 3] }, { id: 'r', kind: 'rotate', target: 't', axis: 'z', angleDegrees: 30 }]), 4000, 'upright'],
    ['mirror kept: one body', D([{ id: 's', kind: 'sketch', profile: 'polygon', points: [[0, 0], [10, 0], [10, 5], [5, 10], [0, 10]] }, extrude('a', 's', 3), { id: 'm', kind: 'mirror', target: 'a', plane: 'yz', keep: true }]), 525, 'upright'],
    ['circular pattern of bosses', D([circle('c', 20, 0, 3), extrude('p', 'c', 4), { id: 'cp', kind: 'circular-pattern', target: 'p', axis: 'z', angleDegrees: 60, count: 6 }]), 216 * pi, 'upright'],
    ['linear pattern of a holed plate', D([rect('s', 0, 0, 10, 10), extrude('e', 's', 2), { id: 'h', kind: 'hole', target: 'e', center: [5, 5], radius: 1 }, { id: 'p', kind: 'linear-pattern', target: 'h', axis: 'x', spacing: 10, count: 3 }]), 3 * (200 - 2 * pi), 'upright'],
    ['slot outline (lines and arcs)', D([{ id: 's', kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: [0, -2] }, { kind: 'arc', start: [10, -2], center: [10, 0], direction: 'ccw' }, { kind: 'line', start: [10, 2] }, { kind: 'arc', start: [0, 2], center: [0, 0], direction: 'ccw' }] }, extrude('e', 's', 3)]), (40 + 4 * pi) * 3, 'upright'],
  ];
  for (const [name, doc, expected, representation] of cases) {
    const snapshot = evaluateCadPart(doc);
    assert.equal(snapshot.outputs.length, 1, name);
    const o = snapshot.outputs[0];
    assert.equal(o.representation, representation, name);
    assert.ok(close(volume(o), expected, representation === 'upright' ? 1e-9 : 1e-9), `${name}: ${volume(o)} vs ${expected}`);
    const report = checkBrep(o.brep);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    assert.ok(o.brep.faces.every(f => f.name) && o.brep.edges.every(e => e.name), `${name}: every face and edge is named`);
  }
});

test('persistent names follow the authored features and survive parameter edits', () => {
  const doc = D([rect('s', 0, 0, { parameter: 'w' }, 40), extrude('plate', 's', { parameter: 't' }), { id: 'bore', kind: 'hole', target: 'plate', center: [{ parameter: 'x' }, 20], radius: 4 },
    { id: 'round', kind: 'fillet', target: 'bore', edges: ['plate.side0|plate.side1'], radius: 5 }], { w: 60, t: 8, x: 15 });
  const a = evaluateCadPart(doc), names = o => o.brep.faces.map(f => f.name).sort();
  const faces = names(a.outputs[0]);
  for (const expected of ['plate.top', 'plate.bottom', 'plate.side0', 'plate.side1', 'plate.side2', 'plate.side3', 'round.face']) assert.ok(faces.includes(expected), expected);
  assert.ok(faces.some(n => n.startsWith('bore.side0')), 'the hole wall is named by the hole');
  // Width, thickness and hole position change; the topology and so every name stays.
  const b = a.withParameters({ w: 90, t: 12, x: 40 });
  assert.deepEqual(names(b.outputs[0]), faces);
  assert.deepEqual(b.outputs[0].brep.edges.map(e => e.name).sort(), a.outputs[0].brep.edges.map(e => e.name).sort());
  assert.ok(close(volume(b.outputs[0]), 90 * 40 * 12 - 16 * pi * 12 - (25 - 25 * pi / 4) * 12));
  // Only the features downstream of the edit are recomputed.
  const c = a.withParameters({ x: 30 });
  assert.deepEqual(c.recomputation.reused, ['plate']);
  assert.deepEqual(c.recomputation.evaluated, ['bore', 'round']);
  // Names stay unique and appear in the checker's naming check.
  const dup = structuredClone(a.outputs[0].brep); dup.faces[1] = { ...dup.faces[1], name: dup.faces[0].name };
  assert.ok(checkBrep(dup).issues.some(i => i.startsWith('naming')));
});

test('references, parts and outputs', () => {
  const s = evaluateCadPart(D([rect('s', 0, 0, 10, 10), extrude('a', 's', 5), { id: 'sp', kind: 'split', target: 'a', axis: 'x', at: 4 }, { id: 'h', kind: 'hole', target: 'sp/1', center: [7, 5], radius: 1 }]));
  assert.deepEqual(s.outputs.map(o => o.id), ['sp/0', 'h']);
  assert.ok(close(volume(s.output('sp/0')), 200) && close(volume(s.output('h')), 300 - 5 * pi));
  assert.deepEqual(s.features.find(f => f.id === 'h').dependencies, ['sp']);
  // A difference that cuts a bar in two keeps both bodies in one output; removing everything leaves none.
  const two = evaluateCadPart(D([rect('s', 0, 0, 30, 10), extrude('a', 's', 5), rect('t', 10, -5, 20, 15), extrude('b', 't', 7, -1), { id: 'd', kind: 'difference', target: 'a', tool: 'b' }]));
  assert.equal(two.outputs[0].bodyCount, 2);
  const none = evaluateCadPart(D([rect('s', 0, 0, 20, 10), extrude('a', 's', 5), rect('t', -1, -1, 21, 11), extrude('b', 't', 7, -1), { id: 'd', kind: 'difference', target: 'a', tool: 'b' }]));
  assert.equal(none.outputs.length, 0);
  // Save and load give the same document and results.
  const again = loadCadPart(s.save());
  assert.deepEqual(again.document, s.document);
  assert.deepEqual(again.outputs.map(o => [o.id, volume(o)]), s.outputs.map(o => [o.id, volume(o)]));
  assert.deepEqual(evaluateCadPart(emptyCadPart()).outputs, []);
});

test('refusals name the feature and the reason', () => {
  const plate = [rect('s', 0, 0, 10, 10), extrude('a', 's', 5)];
  refused(D([extrude('a', 's', 5), rect('s', 0, 0, 10, 10)]), 'REFERENCE', /^a: sketch: no earlier feature s/);
  refused(D([...plate, { id: 'f', kind: 'fillet', target: 'a', edges: ['nope'], radius: 1 }]), 'SELECTION', /no edge named nope; edges: a\.bottom\|a\.side0/);
  refused(D([...plate, { id: 'h', kind: 'hole', target: 'a', center: [50, 50], radius: 1 }]), 'SELECTION', /misses the target/);
  refused(D([...plate, { id: 'f', kind: 'fillet', target: 'a', edges: ['a.side0|a.side1'], radius: 20 }]), 'PARAMETER', /too large/);
  refused(D([...plate, { id: 'f', kind: 'fillet', target: 'a', edges: ['a.side0|a.top'], radius: 1 }]), 'CAPABILITY', /only vertical edges can be filleted/);
  refused(D([circle('c', 0, 0, 3), extrude('p', 'c', 20), { id: 'r', kind: 'rotate', target: 'p', axis: 'y', angleDegrees: 90 }, rect('s', -5, -5, 5, 5), extrude('a', 's', 5), { id: 'd', kind: 'difference', target: 'a', tool: 'r' }]),
    'CAPABILITY', /curved body and a body that is not upright/);
  refused(D([...plate, { id: 'r', kind: 'rotate', target: 'a', axis: 'x', angleDegrees: 45 }]), 'CAPABILITY', /multiples of 90/);
  refused(D([...plate, { id: 'x', kind: 'split', target: 'a', axis: 'z', at: 9 }]), 'SELECTION', /does not cross/);
  refused(D([rect('s', 0, 0, { parameter: 'w' }, 10)]), 'PARAMETER', /unknown parameter w/);
  refused(D([rect('s', 0, 0, 10, 10), rect('s', 0, 0, 5, 5)]), 'FORMAT', /duplicate feature id/);
  assert.throws(() => loadCadPart('{'), e => e instanceof CadPartError && e.code === 'FORMAT');
});

test('mass properties: closed form for upright bodies agrees with mesh integration; STL is well formed', () => {
  const s = evaluateCadPart(D([rect('s', 0, 0, 60, 40), extrude('e', 's', 8), { id: 'h', kind: 'hole', target: 'e', center: [15, 20], radius: 4 }, circle('c', 40, 20, 6), extrude('b', 'c', 10, 8), { id: 'u', kind: 'union', target: 'h', tool: 'b' }]));
  const o = s.outputs[0], exact = o.massProperties(2700), mesh = brepMassProperties(o.brep, 2700, { segmentsPerQuarter: 64 });
  assert.equal(exact.method, 'closed-form'); assert.equal(mesh.method, 'tessellated');
  assert.ok(close(exact.volumeMM3, 19200 - 128 * pi + 360 * pi));
  assert.ok(close(mesh.volumeMM3, exact.volumeMM3, 1e-4));
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(mesh.centroidMM[k] - exact.centroidMM[k]) < 1e-3, `centroid ${k}`);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) assert.ok(Math.abs(mesh.inertiaCentroidKgM2[i][j] - exact.inertiaCentroidKgM2[i][j]) <= 1e-4 * exact.inertiaCentroidKgM2[0][0], `inertia ${i}${j}`);
  // A box's inertia in closed form: m(b² + c²)/12.
  const box = evaluateCadPart(D([rect('s', 0, 0, 20, 10), extrude('e', 's', 5)])).outputs[0].massProperties(1000), m = 1000 * 1000e-9;
  assert.ok(close(box.inertiaCentroidKgM2[0][0], m * (100 + 25) / 12 * 1e-6) && close(box.inertiaCentroidKgM2[2][2], m * (400 + 100) / 12 * 1e-6) && Math.abs(box.inertiaCentroidKgM2[0][1]) < 1e-18);
  const stl = o.exportStl({ segmentsPerQuarter: 8 }), view = new DataView(stl.buffer, stl.byteOffset), n = view.getUint32(80, true);
  assert.equal(stl.length, 84 + 50 * n);
  assert.equal(n, tessellateBrep(o.brep, { segmentsPerQuarter: 8 }).indices.length / 3);
});
