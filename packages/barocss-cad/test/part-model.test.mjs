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

test('fillets and chamfers on any straight or circular edge: rolling-ball tools with exact volumes', () => {
  const k = (10 - 3 * pi) / (12 - 3 * pi), corner = r => r * r * (1 - pi / 4); // the corner region and its centroid offset
  const box = [rect('s', 0, 0, 20, 10), extrude('e', 's', 5)];
  const plate = [rect('p', 0, 0, 40, 40), { id: 'e', kind: 'extrude', sketch: 'p', height: 8 }, circle('c', 20, 20, 6)];
  const holed = [...plate, { id: 'h', kind: 'hole', target: 'e', center: [20, 20], radius: 6 }];
  const bossed = [...plate, extrude('b', 'c', 10, 8), { id: 'u', kind: 'union', target: 'e', tool: 'b' }];
  const cases = [
    ['a top edge', D([...box, { id: 'f', kind: 'fillet', target: 'e', edges: ['e.side0|e.top'], radius: 2 }]), 1000 - corner(2) * 20],
    ['a chamfered hole rim (one arc names the whole circle)', D([...holed, { id: 'f', kind: 'chamfer', target: 'h', edges: ['e.top|h.side0#1'], distance: 1 }]), 12800 - 288 * pi - 2 * pi * (6 + 1 / 3) * 0.5],
    ['a filleted hole rim', D([...holed, { id: 'f', kind: 'fillet', target: 'h', edges: ['e.top|h.side0#1'], radius: 2 }]), 12800 - 288 * pi - 2 * pi * (6 + k * 2) * corner(2)],
    ['a boss foot (concave: material added)', D([...bossed, { id: 'f', kind: 'fillet', target: 'u', edges: ['b.side0#1|e.top'], radius: 2 }]), 12800 + 360 * pi + 2 * pi * (6 + k * 2) * corner(2)],
    ['a boss top rim', D([...bossed, { id: 'f', kind: 'fillet', target: 'u', edges: ['b.side0#1|b.top'], radius: 2 }]), 12800 + 360 * pi - 2 * pi * (6 - k * 2) * corner(2)],
    ['a rounded box top: one edge names the chain through the corner arcs', D([rect('s', 0, 0, 30, 20), extrude('e', 's', 8), { id: 'v', kind: 'fillet', target: 'e', edges: ['e.side0|e.side1', 'e.side1|e.side2', 'e.side2|e.side3', 'e.side0|e.side3'], radius: 4 }, { id: 'f', kind: 'fillet', target: 'v', edges: ['e.side0|e.top'], radius: 2 }]),
      4800 - 4 * (16 - 4 * pi) * 8 - corner(2) * (2 * 22 + 2 * 12) - 4 * (pi / 2) * (4 - k * 2) * corner(2)],
  ];
  for (const [name, doc, expected] of cases) {
    const o = evaluateCadPart(doc).outputs[0], report = checkBrep(o.brep);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    assert.equal(o.representation, 'curved', name);
    assert.ok(close(volume(o), expected, 1e-4), `${name}: ${volume(o)} vs ${expected}`);
    assert.ok(o.brep.faces.some(f => f.name.startsWith('f.face')), `${name}: the finishing face is named by its feature`);
  }
  // Two top edges of a box meeting at a corner: the fillets meet in their mitre (the same body as both tools removed).
  const mitre = evaluateCadPart(D([...box, { id: 'f', kind: 'fillet', target: 'e', edges: ['e.side0|e.top', 'e.side1|e.top'], radius: 2 }])).outputs[0];
  assert.equal(checkBrep(mitre.brep).valid, true);
  assert.ok(volume(mitre) < 1000 - corner(2) * 30 + 1 && volume(mitre) > 1000 - corner(2) * 30 - 1, String(volume(mitre)));
});

test('refusals name the feature and the reason', () => {
  const plate = [rect('s', 0, 0, 10, 10), extrude('a', 's', 5)];
  refused(D([extrude('a', 's', 5), rect('s', 0, 0, 10, 10)]), 'REFERENCE', /^a: sketch: no earlier feature s/);
  refused(D([...plate, { id: 'f', kind: 'fillet', target: 'a', edges: ['nope'], radius: 1 }]), 'SELECTION', /no edge named nope; edges: a\.bottom\|a\.side0/);
  refused(D([...plate, { id: 'h', kind: 'hole', target: 'a', center: [50, 50], radius: 1 }]), 'SELECTION', /misses the target/);
  refused(D([...plate, { id: 'f', kind: 'fillet', target: 'a', edges: ['a.side0|a.side1'], radius: 20 }]), 'PARAMETER', /too large/);
  const ell = [{ id: 'l', kind: 'sketch', profile: 'polygon', points: [[0, 0], [30, 0], [30, 5], [5, 5], [5, 20], [0, 20]] }, extrude('a', 'l', 4)];
  refused(D([...ell, { id: 'f', kind: 'fillet', target: 'a', edges: ['a.side2|a.top', 'a.side3|a.top'], radius: 1 }]), 'CAPABILITY', /inside corner of their face/);
  refused(D([...plate, circle('c', 5, 5, 3), extrude('b', 'c', 4, 5), { id: 'u', kind: 'union', target: 'a', tool: 'b' }, { id: 'f', kind: 'fillet', target: 'u', edges: ['b.side0#1|b.top'], radius: 3 }]), 'PARAMETER', /full round/);
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

test('planes and cylinders of any axis: cross holes, side holes, pins and bars (brep-core step 7)', () => {
  const plate = [rect('s', 0, 0, 40, 20), extrude('e', 's', 10)];
  const cases = [
    // A hole along X through the plate's side, and one along Y; blind from either side.
    ['cross hole along x', D([...plate, { id: 'h', kind: 'hole', target: 'e', axis: 'x', center: [10, 5], radius: 3 }]), 8000 - 9 * pi * 40],
    ['cross hole along y', D([...plate, { id: 'h', kind: 'hole', target: 'e', axis: 'y', center: [20, 5], radius: 3 }]), 8000 - 9 * pi * 20],
    ['blind side hole from x min', D([...plate, { id: 'h', kind: 'hole', target: 'e', axis: 'x', side: 'min', center: [10, 5], radius: 2, depth: 15 }]), 8000 - 4 * pi * 15],
    ['vertical and side holes that miss each other', D([...plate, { id: 'v', kind: 'hole', target: 'e', center: [30, 10], radius: 3 }, { id: 'h', kind: 'hole', target: 'v', axis: 'x', center: [4, 5], radius: 2 }]), 8000 - 9 * pi * 10 - 4 * pi * 40],
    // A pin along X half sunk into the top face, and a rotated bar through an upright cylinder.
    ['pin along x on the top', D([...plate, circle('c', 10, 10, 3), extrude('p', 'c', 50, -5), { id: 'r', kind: 'rotate', target: 'p', axis: 'y', angleDegrees: 90, pivot: [10, 10, 10] }, { id: 'u', kind: 'union', target: 'e', tool: 'r' }]), 8000 + 9 * pi * 50 - 9 * pi / 2 * 40],
    ['bar through a cylinder wall', D([circle('c', 0, 0, 10), extrude('k', 'c', 20), rect('b', -20, -3, 20, 3), extrude('bar', 'b', 4, 5), { id: 'u', kind: 'union', target: 'k', tool: 'bar' }]),
      2000 * pi + 960 - 4 * 2 * (3 * Math.sqrt(91) + 100 * Math.asin(0.3))],
  ];
  for (const [name, doc, expected] of cases) {
    const o = evaluateCadPart(doc).outputs[0], m = o.massProperties(1), report = checkBrep(o.brep);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    assert.equal(m.method, o.representation === 'upright' ? 'closed-form' : 'tessellated', name);
    assert.ok(Math.abs(m.volumeMM3 - expected) < 3e-4 * expected, `${name}: ${m.volumeMM3} vs ${expected}`);
    assert.ok(o.brep.faces.every(f => f.name) && o.brep.edges.every(e => e.name), name);
    assert.ok(o.brep.faces.some(f => f.name.startsWith(name.includes('pin') ? 'p.side0' : name.includes('bar') ? 'k.side0' : 'h.side0')), `${name}: the cylinder wall keeps its feature name`);
  }
  // The cross hole's wall goes along X: its surface's extrusion direction is the X axis.
  const cross = evaluateCadPart(cases[0][1]).outputs[0].brep.faces.find(f => f.name.startsWith('h.side0'));
  const [[p0, p1]] = cross.surface.controlPoints; assert.ok(Math.abs(Math.abs(p1[0] - p0[0]) - Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2])) < 1e-9);
  // A top-edge chamfer on a body with a hole, away from it and cutting into it (the slanted chamfer
  // plane meets the hole wall in an ellipse).
  const holed = x => D([...plate, { id: 'h', kind: 'hole', target: 'e', center: [x, 10], radius: 2 }, { id: 'c', kind: 'chamfer', target: 'h', edges: ['e.side3|e.top'], distance: 2 }]);
  const chamfered = evaluateCadPart(holed(30)).outputs[0];
  assert.equal(checkBrep(chamfered.brep).valid, true);
  assert.ok(Math.abs(chamfered.massProperties(1).volumeMM3 - (8000 - 40 * pi - 40)) < 3e-4 * 8000);
  // Next to the hole the wedge (legs 2, along y) and the hole overlap: ∫ (2 − x)·2√(4 − (x − 3)²) over 1 ≤ x ≤ 2.
  let overlap = 0; for (let i = 0, n = 4000; i < n; i++) { const x = 1 + (i + 0.5) / n; overlap += (2 - x) * 2 * Math.sqrt(Math.max(0, 4 - (x - 3) ** 2)) / n; }
  const near = evaluateCadPart(holed(3)).outputs[0];
  assert.equal(checkBrep(near.brep).valid, true);
  assert.ok(Math.abs(near.massProperties(1).volumeMM3 - (8000 - 40 * pi - 40 + overlap)) < 3e-4 * 8000, String(near.massProperties(1).volumeMM3));
  // A missed side hole is refused by name.
  refused(D([...plate, { id: 'h', kind: 'hole', target: 'e', axis: 'x', center: [50, 5], radius: 2 }]), 'SELECTION', /along x misses the target/);
});

test('ellipse and quartic trims: slanted bodies, cross-drilled bosses, partial piercings (brep-core step 8)', () => {
  const plate = [rect('s', 0, 0, 40, 20), extrude('e', 's', 10)];
  // A boss on the plate, cross-drilled along x right through its axis (a quartic on both walls).
  const boss = D([...plate, circle('c', 20, 10, 6), extrude('b', 'c', 12, 10), { id: 'u', kind: 'union', target: 'e', tool: 'b' }, { id: 'x', kind: 'hole', target: 'u', axis: 'x', center: [10, 16], radius: 2 }]);
  const o = evaluateCadPart(boss).outputs[0];
  assert.equal(checkBrep(o.brep).valid, true);
  // Removed: the x-cylinder (r 2) inside the boss (r 6): ∫ 2√(4 − y²) · 2√(36 − y²) dy over |y| ≤ 2.
  let crossed = 0; for (let i = 0, n = 4000; i < n; i++) { const y = -2 + 4 * (i + 0.5) / n; crossed += 2 * Math.sqrt(4 - y * y) * 2 * Math.sqrt(36 - y * y) * 4 / n; }
  const expected = 8000 + 36 * pi * 12 - crossed;
  assert.ok(Math.abs(o.massProperties(1).volumeMM3 - expected) < 3e-4 * expected, `${o.massProperties(1).volumeMM3} vs ${expected}`);
  assert.ok(o.brep.faces.some(f => f.name === 'x.side0#1' || f.name === 'x.side0') && o.brep.faces.some(f => f.name.startsWith('b.side0')));
  // A plate turned 30° about z with a hole along x through it (ellipses on the hole wall).
  const turned = evaluateCadPart(D([...plate, { id: 'r', kind: 'rotate', target: 'e', axis: 'z', angleDegrees: 30, pivot: [20, 10, 0] }, { id: 'h', kind: 'hole', target: 'r', axis: 'x', center: [10, 5], radius: 2 }])).outputs[0];
  assert.equal(checkBrep(turned.brep).valid, true);
  assert.ok(turned.massProperties(1).volumeMM3 < 8000 && turned.massProperties(1).volumeMM3 > 8000 - 4 * pi * 60);
});
