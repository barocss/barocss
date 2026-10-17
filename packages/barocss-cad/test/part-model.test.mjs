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
  // Every edge of an upright box in one fillet: the vertical ones join the rest, corners become spheres.
  const allNames = evaluateCadPart(D(box)).outputs[0].brep.edges.map(e => e.name);
  const roundBox = evaluateCadPart(D([...box, { id: 'f', kind: 'fillet', target: 'e', edges: allNames, radius: 1 }])).outputs[0];
  const rounded = (a, b, c, r) => (a - 2 * r) * (b - 2 * r) * (c - 2 * r) + 2 * r * ((a - 2 * r) * (b - 2 * r) + (b - 2 * r) * (c - 2 * r) + (a - 2 * r) * (c - 2 * r)) + pi * r * r * (a + b + c - 6 * r) + 4 / 3 * pi * r ** 3;
  assert.equal(checkBrep(roundBox.brep).valid, true);
  assert.ok(close(volume(roundBox), rounded(20, 10, 5, 1), 1e-4), String(volume(roundBox)));
  // Two top edges of a box meeting at a corner: the fillets meet in their mitre (the same body as both tools removed).
  const mitre = evaluateCadPart(D([...box, { id: 'f', kind: 'fillet', target: 'e', edges: ['e.side0|e.top', 'e.side1|e.top'], radius: 2 }])).outputs[0];
  assert.equal(checkBrep(mitre.brep).valid, true);
  assert.ok(volume(mitre) < 1000 - corner(2) * 30 + 1 && volume(mitre) > 1000 - corner(2) * 30 - 1, String(volume(mitre)));
});

test('shell: the section eroded exactly, open faces removed, the result still upright', () => {
  const box = [rect('s', 0, 0, 40, 30), extrude('e', 's', 20)];
  const ell = [{ id: 's', kind: 'sketch', profile: 'polygon', points: [[0, 0], [30, 0], [30, 10], [10, 10], [10, 30], [0, 30]] }, extrude('e', 's', 10)];
  const slot = [{ id: 's', kind: 'sketch', profile: 'loop', segments: [{ kind: 'line', start: [0, -4] }, { kind: 'arc', start: [20, -4], center: [20, 0], direction: 'ccw' }, { kind: 'line', start: [20, 4] }, { kind: 'arc', start: [0, 4], center: [0, 0], direction: 'ccw' }] }, extrude('e', 's', 6)];
  const shell = (target, thickness, open) => ({ id: 'sh', kind: 'shell', target, thickness, ...(open ? { open } : {}) });
  const cases = [
    ['an open box', D([...box, shell('e', 2, ['e.top'])]), 24000 - 36 * 26 * 18],
    ['a closed box (a cavity)', D([...box, shell('e', 2)]), 24000 - 36 * 26 * 16],
    ['open top and front', D([...box, shell('e', 2, ['e.top', 'e.side0'])]), 24000 - 36 * 28 * 18],
    ['a tube (top and bottom open)', D([...box, shell('e', 2, ['e.top', 'e.bottom'])]), 24000 - 36 * 26 * 20],
    // The L's inside corner leaves the hollow a round notch: (4 − π) beyond the two arms.
    ['an L (round at its inside corner)', D([...ell, shell('e', 2, ['e.top'])]), 5000 - (26 * 6 + 6 * 20 + 4 - pi) * 8],
    ['a slot (arcs offset)', D([...slot, shell('e', 1.5, ['e.top'])]), (160 + 16 * pi) * 6 - (20 * 5 + pi * 2.5 * 2.5) * 4.5],
    ['a box with a screw hole (a tube stays round it)', D([...box, { id: 'h', kind: 'hole', target: 'e', center: [20, 15], radius: 3 }, shell('h', 2, ['e.top'])]), 24000 - pi * 9 * 20 - (36 * 26 - pi * 25) * 18],
  ];
  for (const [name, doc, expected] of cases) {
    const o = evaluateCadPart(doc).outputs[0];
    assert.equal(o.representation, 'upright', name);
    assert.equal(checkBrep(o.brep).valid, true, name);
    assert.ok(close(volume(o), expected, 1e-12), `${name}: ${volume(o)} vs ${expected}`);
    assert.ok(o.brep.faces.some(f => f.name.startsWith('sh.in.')), `${name}: inner walls are named after the faces they face`);
  }
  refused(D([...box, shell('e', 20, ['e.top'])]), 'PARAMETER', /leaves no hollow/);
  refused(D([...box, shell('e', 2, ['nope'])]), 'SELECTION', /no face named nope/);
  refused(D([...slot, shell('e', 1, ['e.top', 'e.side1'])]), 'CAPABILITY', /only straight walls can be left open/);
});

test('smooth loft through three or more sections: C1 sides through every section, quadrature mass', () => {
  const sq = (id, h) => rect(id, -h, -h, h, h), loft = secs => ({ id: 'L', kind: 'loft', smooth: true, sections: secs.map(([sketch, z]) => ({ sketch, z })) });
  // Sections changing linearly: the smooth sides are the ruled ones — a frustum exactly.
  const frustum = evaluateCadPart(D([sq('a', 10), sq('b', 7.5), sq('c', 5), loft([['a', 0], ['b', 6], ['c', 12]])])).outputs[0];
  assert.ok(close(frustum.massProperties(1000).volumeMM3, 2800, 1e-12));
  for (const [name, f] of [['a circle, a square, a circle', [circle('a', 0, 0, 8), sq('b', 5), circle('c', 0, 0, 4), loft([['a', 0], ['b', 8], ['c', 14]])]],
    ['a vase of four circles', [circle('a', 0, 0, 6), circle('b', 0, 0, 10), circle('c', 0, 0, 5), circle('d', 0, 0, 7), loft([['a', 0], ['b', 6], ['c', 14], ['d', 20]])]]]) {
    const o = evaluateCadPart(D(f)).outputs[0], report = checkBrep(o.brep), m = o.massProperties(1000);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    assert.equal(m.method, 'quadrature');
    // One side per edge from the bottom to the top, through every section.
    assert.equal(o.brep.faces.filter(x => /side/.test(x.name)).length, o.brep.edges.filter(e => /bottom/.test(e.name)).length, name);
    const mesh = brepMassProperties(o.brep, 1000, { segmentsPerQuarter: 64 });
    assert.ok(Math.abs(mesh.volumeMM3 - m.volumeMM3) < 3e-4 * m.volumeMM3, `${name}: ${mesh.volumeMM3} vs ${m.volumeMM3}`);
    assert.ok(Math.hypot(...m.centroidMM.map((c, k) => c - mesh.centroidMM[k])) < 1e-2, `${name}: centroid`);
    const t = tessellateBrep(o.brep, { segmentsPerQuarter: 8 }), p = t.positionsMM, key = i => `${p[3 * i]},${p[3 * i + 1]},${p[3 * i + 2]}`, directed = new Set();
    for (let k = 0; k < t.indices.length; k += 3) for (let e = 0; e < 3; e++) directed.add(key(t.indices[k + e]) + '>' + key(t.indices[k + (e + 1) % 3]));
    for (const d of directed) { const [x, y] = d.split('>'); assert.ok(directed.has(y + '>' + x), `${name}: open ${d}`); }
  }
  // The vase's side is smooth across its middle sections: its radius' slope agrees from below and above.
  const vase = evaluateCadPart(D([circle('a', 0, 0, 6), circle('b', 0, 0, 10), circle('c', 0, 0, 5), loft([['a', 0], ['b', 6], ['c', 14]])])).outputs[0].brep.faces.find(x => x.name === 'L.side0').surface;
  const P = vase.controlPoints[0], W = vase.weights[0], at = k => [P[k][0], P[k][2]];
  // Bézier spans meet at the section (index 3): the control points either side are collinear with it.
  const [a, b, c] = [at(2), at(3), at(4)];
  assert.ok(Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-9 && W[3] === 1);
});

test('shell after fillets and chamfers: the hollow takes the same finishes, offset by the wall', () => {
  const box = [rect('s', 0, 0, 60, 40), extrude('e', 's', 20)];
  const bottom = [0, 1, 2, 3].map(i => `e.bottom|e.side${i}`), top = [0, 1, 2, 3].map(i => `e.side${i}|e.top`), vertical = ['e.side0|e.side1', 'e.side1|e.side2', 'e.side2|e.side3', 'e.side0|e.side3'];
  // A rounded rectangle's area, and what a fillet r takes along its foot: the corner section r²(1 − π/4)
  // along the straight walls, and about the corners by Pappus (its centroid x̄ in from the walls).
  const rounded = (w, d, R) => w * d - (4 - pi) * R * R;
  const foot = (w, d, R, r) => r * r * (1 - pi / 4) * (2 * (w - 2 * R) + 2 * (d - 2 * R) + 2 * pi * (R - r * (10 - 3 * pi) / (3 * (4 - pi))));
  // A box with every edge rounded r.
  const roundBox = (a, b, c, r) => (a - 2 * r) * (b - 2 * r) * (c - 2 * r) + 2 * r * ((a - 2 * r) * (b - 2 * r) + (a - 2 * r) * (c - 2 * r) + (b - 2 * r) * (c - 2 * r)) + pi * r * r * (a + b + c - 6 * r) + 4 / 3 * pi * r ** 3;
  // Equal chamfers d mitred round a rectangle's foot.
  const chamfered = (w, d, h, c) => w * d * h - (c * c / 2 * 2 * (w + d) - 4 * c ** 3 / 3);
  const c2 = 3 - (2 - Math.SQRT2) * 1.5;
  const cases = [
    ['a tray: corners rounded 6, the foot 4, open at the top', [{ id: 'v', kind: 'fillet', target: 'e', edges: vertical, radius: 6 }, { id: 'f', kind: 'fillet', target: 'v', edges: bottom, radius: 4 }, { id: 'sh', kind: 'shell', target: 'f', thickness: 2, open: ['e.top'] }],
      rounded(60, 40, 6) * 20 - foot(60, 40, 6, 4) - (rounded(56, 36, 4) * 18 - foot(56, 36, 4, 2)), 1, 2e-4],
    ['a closed rounded box (a cavity inside)', [{ id: 'f', kind: 'fillet', target: 'e', edges: [...bottom, ...top, ...vertical], radius: 5 }, { id: 'sh', kind: 'shell', target: 'f', thickness: 2 }],
      roundBox(60, 40, 20, 5) - roundBox(56, 36, 16, 3), 2, 2e-4],
    // A chamfer d on a square corner becomes d − (2 − √2)·t inside.
    ['a chamfered foot, open at the top', [{ id: 'c', kind: 'chamfer', target: 'e', edges: bottom, distance: 3 }, { id: 'sh', kind: 'shell', target: 'c', thickness: 1.5, open: ['e.top'] }],
      chamfered(60, 40, 20, 3) - chamfered(57, 37, 18.5, c2), 1, 1e-9],
  ];
  for (const [name, features, exact, shells, rel] of cases) {
    const o = evaluateCadPart(D([...box, ...features])).outputs.at(-1), report = checkBrep(o.brep);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    assert.deepEqual(report.topology.map(t => t.shells), [shells], name);
    assert.ok(Math.abs(volume(o) - exact) <= rel * exact, `${name}: ${volume(o)} vs ${exact}`);
  }
  // A fillet no larger than the wall leaves the inside sharp; the inner faces are named after the shell.
  const sharp = evaluateCadPart(D([...box, { id: 'f', kind: 'fillet', target: 'e', edges: bottom, radius: 1 }, { id: 'sh', kind: 'shell', target: 'f', thickness: 2, open: ['e.top'] }])).outputs.at(-1);
  assert.equal(checkBrep(sharp.brep).valid, true);
  assert.ok(sharp.brep.faces.some(f => f.name === 'sh.floor') && sharp.brep.faces.some(f => f.name === 'sh.in.e.side0'));
  const named = evaluateCadPart(D([...box, { id: 'f', kind: 'fillet', target: 'e', edges: bottom, radius: 4 }, { id: 'sh', kind: 'shell', target: 'f', thickness: 2, open: ['e.top'] }])).outputs.at(-1);
  assert.ok(named.brep.faces.some(f => /^sh\.in\.f\./.test(f.name)), named.brep.faces.map(f => f.name).join(' '));
  refused(D([...box, { id: 'f', kind: 'fillet', target: 'e', edges: top, radius: 3 }, { id: 'sh', kind: 'shell', target: 'f', thickness: 2, open: ['e.top'] }]), 'CAPABILITY', /borders an open face/);
  // A moved copy is shelled as its original, then moved (a scaled one with the wall scaled back).
  const trayOf = (more, target) => volume(evaluateCadPart(D([...box, { id: 'f', kind: 'fillet', target: 'e', edges: bottom, radius: 4 }, ...more, { id: 'sh', kind: 'shell', target, thickness: 2, open: ['e.top'] }])).outputs.at(-1));
  const still = trayOf([], 'f');
  // (Turned, its mesh differs, and so does the quadrature's small error along the mitred trims.)
  assert.ok(close(trayOf([{ id: 'r', kind: 'rotate', target: 'f', axis: 'y', angleDegrees: 90 }, { id: 't', kind: 'translate', target: 'r', offset: [5, 6, 7] }], 't'), still, 1e-5));
  assert.ok(close(trayOf([{ id: 'm', kind: 'mirror', target: 'f', plane: 'xz' }], 'm'), still, 1e-9));
  const big = evaluateCadPart(D([...box, { id: 'k', kind: 'scale', target: 'e', factor: 2 }, { id: 'sh', kind: 'shell', target: 'k', thickness: 4, open: ['e.top'] }])).outputs.at(-1);
  assert.ok(close(volume(big), 8 * (48000 - 56 * 36 * 18), 1e-12));
  refused(D([...box, rect('t', 70, 0, 80, 10), extrude('b', 't', 5), { id: 'u', kind: 'union', target: 'e', tool: 'b' }, { id: 'f', kind: 'fillet', target: 'u', edges: ['e.side0|e.top'], radius: 3 }, { id: 'sh', kind: 'shell', target: 'f', thickness: 2 }]), 'CAPABILITY', /extruded from one section/);
});

test('shell stepped bodies: a boss on a plate, an overhang; the hollow at z is the sections within the wall of z, eroded', () => {
  const boss = [rect('s', 0, 0, 60, 40), extrude('p', 's', 6), rect('b', 20, 10, 40, 30), extrude('q', 'b', 10, 6), { id: 'u', kind: 'union', target: 'p', tool: 'q' }];
  const tee = [rect('s', 20, 10, 40, 30), extrude('p', 's', 10), rect('b', 0, 0, 60, 40), extrude('q', 'b', 6, 10), { id: 'u', kind: 'union', target: 'p', tool: 'q' }];
  const shell = (body, open) => evaluateCadPart(D([...body, { id: 'sh', kind: 'shell', target: 'u', thickness: 2, ...(open ? { open } : {}) }])).outputs.at(-1);
  // Boss closed: the plate's hollow 56 × 36 from 2 to 4, then the boss's 16 × 16 from 4 (within the wall of the step) to 14.
  const cases = [['a boss, closed', shell(boss), 18400 - (56 * 36 * 2 + 16 * 16 * 10), 2], ['a boss open at its top', shell(boss, ['q.top']), 18400 - (56 * 36 * 2 + 16 * 16 * 12), 1],
    ['an overhang, closed', shell(tee), 18400 - (16 * 16 * 10 + 56 * 36 * 2), 2]];
  for (const [name, o, exact, shells] of cases) {
    const report = checkBrep(o.brep);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    assert.equal(o.representation, 'upright', name);
    assert.deepEqual(report.topology.map(t => t.shells), [shells], name);
    assert.ok(close(volume(o), exact, 1e-12), `${name}: ${volume(o)} vs ${exact}`);
  }
  assert.ok(['sh.floor', 'sh.step1', 'sh.in.q.side0', 'sh.in.p.side0'].every(n => cases[1][1].brep.faces.some(f => f.name === n)));
  refused(D([...boss, { id: 'sh', kind: 'shell', target: 'u', thickness: 2, open: ['p.top'] }]), 'CAPABILITY', /a step between sections/);
});

test('shell revolved and swept bodies: the section eroded and made again, exact with closed-form mass', () => {
  const cup = [{ id: 'p', kind: 'sketch', profile: 'polygon', points: [[0, 0], [20, 0], [20, 30], [0, 30]] }, { id: 'r', kind: 'revolve', sketch: 'p', axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 }];
  const ring = [circle('c', 20, 0, 5), { id: 'r', kind: 'revolve', sketch: 'c', axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 }];
  const pipe = [circle('c', 0, 0, 3), { id: 'w', kind: 'sweep', sketch: 'c', path: [{ kind: 'straight', length: 10 }, { kind: 'bend', radius: 20, angleDegrees: 90, toward: 'x' }, { kind: 'straight', length: 10 }] }];
  const L = 20 + 10 * pi, shell = (body, target, thickness, open) => D([...body, { id: 'sh', kind: 'shell', target, thickness, ...(open ? { open } : {}) }]);
  const cases = [
    // The cup's wall (side1) and floor (side0) 2 thick; open at the top (side2).
    ['a cup open at the top', shell(cup, 'r', 2, ['r.side2']), pi * (400 * 30 - 18 * 18 * 28), [1, 0]],
    ['a closed cup (a cavity)', shell(cup, 'r', 2), pi * (400 * 30 - 18 * 18 * 26), [2, 0]],
    ['a torus hollowed 1 thick', shell(ring, 'r', 1), 2 * pi * pi * 20 * (25 - 16), [2, 2]],
    ['a pipe open at both ends', shell(pipe, 'w', 1, ['w.s0.bottom', 'w.s2.top']), pi * (9 - 4) * L, [1, 1]],
    ['a pipe closed at both ends', shell(pipe, 'w', 1), pi * (9 * L - 4 * (L - 2)), [2, 0]],
  ];
  for (const [name, doc, exact, [shells, genus]] of cases) {
    const o = evaluateCadPart(doc).outputs.at(-1), report = checkBrep(o.brep), m = o.massProperties(1000);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    assert.deepEqual(report.topology.map(t => [t.shells, t.genus]), [[shells, genus]], name);
    assert.equal(m.method, 'closed-form', name);
    assert.ok(close(m.volumeMM3, exact, 1e-10), `${name}: ${m.volumeMM3} vs ${exact}`);
    const mesh = brepMassProperties(o.brep, 1000, { segmentsPerQuarter: 32 });
    assert.ok(Math.abs(mesh.volumeMM3 - m.volumeMM3) < 1e-3 * m.volumeMM3 && Math.hypot(...m.centroidMM.map((c, k) => c - mesh.centroidMM[k])) < 1e-2, `${name}: mesh`);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(m.inertiaCentroidKgM2[i][i] - mesh.inertiaCentroidKgM2[i][i]) < 2e-3 * m.inertiaCentroidKgM2[i][i], `${name}: inertia ${i}`);
  }
  assert.ok(evaluateCadPart(cases[0][1]).outputs.at(-1).brep.faces.some(f => /^sh\.in\d*\.side/.test(f.name)));
  refused(shell([cup[0], { ...cup[1], angleDegrees: 180 }], 'r', 2), 'CAPABILITY', /a full turn/);
  refused(shell(pipe, 'w', 1, ['w.s1.side0']), 'CAPABILITY', /end faces/);
  refused(shell([circle('c', 0, 0, 3), { id: 'w', kind: 'sweep', sketch: 'c', path: [{ kind: 'bend', radius: 20, angleDegrees: 90, toward: 'x' }] }], 'w', 1), 'CAPABILITY', /straight run/);
  refused(shell(cup, 'r', 2, ['r.side7']), 'SELECTION', /no face named r\.side7/);
});

test('shell any body of planes and cylinders: the wall as a slab per face, never thinner than the wall', () => {
  const box = [rect('s', 0, 0, 60, 40), extrude('e', 's', 20)];
  const bracket = [rect('s', 0, 0, 40, 30), extrude('e', 's', 5), rect('w', 0, 0, 40, 20), extrude('f', 'w', 5), { id: 'r', kind: 'rotate', target: 'f', axis: 'x', angleDegrees: 90 }, { id: 't', kind: 'translate', target: 'r', offset: [0, 5, 0] }, { id: 'u', kind: 'union', target: 'e', tool: 't' }];
  const hole = [...box, circle('c', 20, 10, 5), extrude('b', 'c', 80, -10), { id: 'r', kind: 'rotate', target: 'b', axis: 'y', angleDegrees: 90 }, { id: 't', kind: 'translate', target: 'r', offset: [0, 0, 30] }, { id: 'u', kind: 'difference', target: 'e', tool: 't' }];
  const boss = [...box, circle('c', 20, 10, 6), extrude('b', 'c', 20), { id: 'r', kind: 'rotate', target: 'b', axis: 'y', angleDegrees: 90 }, { id: 't', kind: 'translate', target: 'r', offset: [50, 0, 30] }, { id: 'u', kind: 'union', target: 'e', tool: 't' }];
  const shell = (body, t, open) => evaluateCadPart(D([...body, { id: 'sh', kind: 'shell', target: 'u', thickness: t, ...(open ? { open } : {}) }])).outputs.at(-1);
  // An L bracket (two plates joined after a turn about X): its section inset by the wall, corners sharp.
  const cases = [
    ['an L bracket, closed', shell(bracket, 1), 9000 - 38 * (28 * 3 + 3 * 15), 2, 1e-12],
    ['an L bracket open at its plate end', shell(bracket, 1, ['e.side1']), null, 1, null],
    // A box with a hole along X: the hollow is the box inset less the hole grown by the wall.
    ['a box with a hole through it', shell(hole, 1.5), (48000 - 1500 * pi) - (57 * 37 * 17 - pi * 6.5 * 6.5 * 57), 2, 2e-4],
    ['a box with a round boss on its side', shell(boss, 1.5), null, 2, null],
    ['the boss open at its end', shell(boss, 1.5, ['b.top']), null, 1, null],
  ];
  for (const [name, o, exact, shells, rel] of cases) {
    const report = checkBrep(o.brep);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    assert.equal(report.topology.length, 1, name);
    assert.equal(report.topology[0].shells, shells, name);
    if (exact !== null && rel !== null) assert.ok(Math.abs(volume(o) - exact) <= rel * exact, `${name}: ${volume(o)} vs ${exact}`);
  }
  // Opening the plate's end runs the hollow out through it: more taken away than closed.
  assert.ok(volume(cases[1][1]) < volume(cases[0][1]));
  refused(D([...box, rect('a', 10, 10, 30, 30), circle('b', 20, 20, 5), { id: 'L', kind: 'loft', sections: [{ sketch: 'a', z: 20 }, { sketch: 'b', z: 30 }] }, { id: 'u', kind: 'union', target: 'e', tool: 'L' }, { id: 'sh', kind: 'shell', target: 'u', thickness: 2 }]), 'CAPABILITY', /not a plane, a cylinder or a surface of revolution/);
  refused(D([...bracket, { id: 'sh', kind: 'shell', target: 'u', thickness: 1, open: ['nope'] }]), 'SELECTION', /no face named nope/);
});

test('shell bodies with cones and tori joined to others: slabs turned about their axes', () => {
  const plate = [rect('s', 0, 0, 60, 40), extrude('e', 's', 8)];
  const cases = [
    // A cone frustum stood on a plate; a drafted round boss; a torus ring half sunk in a plate.
    ['a cone on a plate', [...plate, { id: 'p', kind: 'sketch', profile: 'polygon', points: [[0, 0], [12, 0], [7, 14], [0, 14]] }, { id: 'v', kind: 'revolve', sketch: 'p', axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 }, { id: 'r', kind: 'rotate', target: 'v', axis: 'x', angleDegrees: 90 }, { id: 't', kind: 'translate', target: 'r', offset: [30, 20, 6] }, { id: 'u', kind: 'union', target: 'e', tool: 't' }], 1.5],
    ['a drafted boss', [...plate, circle('c', 30, 20, 8), { ...extrude('b', 'c', 10, 8), draft: 10 }, { id: 'u', kind: 'union', target: 'e', tool: 'b' }], 1.5],
    ['a torus ring in a plate', [...plate, circle('c', 12, 0, 3), { id: 'v', kind: 'revolve', sketch: 'c', axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 }, { id: 'r', kind: 'rotate', target: 'v', axis: 'x', angleDegrees: 90 }, { id: 't', kind: 'translate', target: 'r', offset: [30, 20, 8] }, { id: 'u', kind: 'union', target: 'e', tool: 't' }], 1],
  ];
  for (const [name, features, t] of cases) {
    const body = evaluateCadPart(D(features)).outputs.at(-1), o = evaluateCadPart(D([...features, { id: 'sh', kind: 'shell', target: 'u', thickness: t }])).outputs.at(-1), report = checkBrep(o.brep);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    // One cavity throughout (the plate's hollow runs up into the cone, the boss, the ring).
    assert.deepEqual(report.topology.map(x => x.shells), [2], name);
    assert.ok(volume(o) > 0.2 * volume(body) && volume(o) < 0.6 * volume(body), `${name}: ${volume(o)} of ${volume(body)}`);
  }
});

test('moved parts keep their exact mass: a loft turned about X and scaled', () => {
  const loft = [rect('a', 0, 0, 20, 10), circle('b', 10, 5, 3), { id: 'L', kind: 'loft', sections: [{ sketch: 'a', z: 0 }, { sketch: 'b', z: 12 }] }];
  const at = evaluateCadPart(D(loft)).outputs[0].massProperties(1000);
  const o = evaluateCadPart(D([...loft, { id: 'r', kind: 'rotate', target: 'L', axis: 'x', angleDegrees: 90, pivot: [1, 2, 3] }, { id: 'k', kind: 'scale', target: 'r', factor: 1.5 }])).outputs[0], m = o.massProperties(1000);
  assert.equal(m.method, 'quadrature');
  assert.ok(close(m.volumeMM3, at.volumeMM3 * 1.5 ** 3, 1e-12));
  // x ↦ 1.5·(R(x − p) + p): the centroid moves so, the inertia turns (y and z swap) and grows 1.5⁵.
  const p = [1, 2, 3], c = at.centroidMM, turned = [c[0] - p[0], -(c[2] - p[2]), c[1] - p[1]].map((x, i) => 1.5 * (x + p[i]));
  assert.ok(Math.hypot(...m.centroidMM.map((x, i) => x - turned[i])) < 1e-9);
  assert.ok(close(m.inertiaCentroidKgM2[1][1], at.inertiaCentroidKgM2[2][2] * 1.5 ** 5, 1e-9) && close(m.inertiaCentroidKgM2[2][2], at.inertiaCentroidKgM2[1][1] * 1.5 ** 5, 1e-9));
  const mesh = brepMassProperties(o.brep, 1000, { segmentsPerQuarter: 64 });
  assert.ok(Math.abs(mesh.volumeMM3 - m.volumeMM3) < 3e-4 * m.volumeMM3);
});

test('box edges filleted in loops at any size and place: mitres where two meet, a clear refusal where they cannot fit', () => {
  for (const [w, d, h] of [[60, 40, 20], [100, 37, 13], [20, 20, 20]]) for (const r of [0.5, 2, 3]) {
    const box = [rect('s', 0, 0, w, d), extrude('e', 's', h)];
    for (const edges of [['e.bottom|e.side0', 'e.bottom|e.side1'], [0, 1, 2, 3].map(i => `e.side${i}|e.top`)]) {
      const o = evaluateCadPart(D([...box, { id: 'f', kind: 'fillet', target: 'e', edges, radius: r }])).outputs[0];
      assert.equal(checkBrep(o.brep).valid, true, `${w}×${d}×${h} r${r} ${edges}`);
    }
  }
  const small = [rect('s', 0, 0, 10, 10), extrude('e', 's', 5)], all = evaluateCadPart(D(small)).outputs[0].brep.edges.map(e => e.name);
  refused(D([...small, { id: 'f', kind: 'fillet', target: 'e', edges: all, radius: 3 }]), 'PARAMETER', /too large/);
});

test('sweep: a profile along straight runs and bends, exact mass, joined into one solid', () => {
  const tube = circle('s', 0, 0, 2), bar = { id: 's', kind: 'sketch', profile: 'rectangle', min: [-1, -2], max: [3, 2] }, A = 4 * pi;
  const sweep = (sketch, path) => D([sketch, { id: 'w', kind: 'sweep', sketch: 's', path }]);
  const straight = length => ({ kind: 'straight', length }), bend = (radius, angleDegrees, toward) => ({ kind: 'bend', radius, angleDegrees, toward });
  const cases = [
    ['a pipe with a 90° bend', sweep(tube, [straight(10), bend(8, 90, 'x'), straight(10)]), A * (20 + 4 * pi), 0],
    ['a U bend', sweep(tube, [straight(5), bend(6, 180, '-y'), straight(5)]), A * (10 + 6 * pi), 0],
    ['bends in two planes', sweep(tube, [straight(4), bend(6, 90, 'x'), bend(6, 90, 'y'), straight(4)]), A * (8 + 6 * pi), 0],
    // The path runs through the section's centroid wherever the section is drawn.
    ['a bar drawn off the origin', sweep(bar, [straight(3), bend(6, 90, 'x')]), 16 * (3 + 6 * pi / 2), 0],
    ['a ring of four bends (it closes on itself)', sweep(tube, [1, 2, 3, 4].map(() => bend(8, 90, 'x'))), A * 16 * pi, 1],
  ];
  for (const [name, doc, expected, genus] of cases) {
    const o = evaluateCadPart(doc).outputs[0], report = checkBrep(o.brep);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    assert.deepEqual(report.topology.map(t => t.genus), [genus], name);
    const m = o.massProperties(1000);
    assert.equal(m.method, 'closed-form', name);
    assert.ok(close(m.volumeMM3, expected, 1e-12), `${name}: ${m.volumeMM3} vs ${expected}`);
    // The closed form agrees with the body's own fine mesh.
    const mesh = brepMassProperties(o.brep, 1000, { segmentsPerQuarter: 64 });
    assert.ok(Math.hypot(...m.centroidMM.map((c, k) => c - mesh.centroidMM[k])) < 1e-3, `${name}: centroid`);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) assert.ok(Math.abs(m.inertiaCentroidKgM2[i][j] - mesh.inertiaCentroidKgM2[i][j]) < 1e-3 * m.inertiaCentroidKgM2[i][i] + 1e-14, `${name}: inertia ${i}${j}`);
  }
  // Consecutive pieces are glued in their shared section (a seam named by the sides it parts); a
  // section off the origin that a Boolean union of the pieces could not join.
  const off = evaluateCadPart(sweep(circle('s', 3.2, -1.7, 6), [straight(8), bend(20, 90, 'x'), bend(15, 45, 'y'), straight(8)])).outputs[0];
  assert.equal(checkBrep(off.brep).valid, true);
  assert.ok(off.brep.edges.some(e => e.name === 'w.s0.side0#1|w.s1.side1'), off.brep.edges.map(e => e.name).join(' '));
  // A glued pipe takes further Booleans: united with a mounting plate it stands on.
  const plated = evaluateCadPart(D([circle('s', 0, 0, 3), { id: 'w', kind: 'sweep', sketch: 's', path: [straight(8), bend(20, 90, 'x'), straight(8)] }, rect('r', -10, -10, 10, 10), extrude('p', 'r', 4, -4), { id: 'u', kind: 'union', target: 'w', tool: 'p' }])).outputs.at(-1);
  assert.equal(checkBrep(plated.brep).valid, true);
  assert.ok(close(plated.massProperties(1000).volumeMM3, 9 * pi * (16 + 10 * pi) + 1600, 1e-3));
  refused(sweep(tube, [bend(1, 90, 'x')]), 'PARAMETER', /reaches the bend's axis/);
  refused(sweep(tube, [{ kind: 'twist' }]), 'INPUT', /straight or bend/);
});

test('loft: ruled sections at heights, exact volumes, quadrature mass, watertight meshes', () => {
  const poly = (id, points) => ({ id, kind: 'sketch', profile: 'polygon', points });
  const loft = (...sections) => ({ id: 'L', kind: 'loft', sections: sections.map(([sketch, z]) => ({ sketch, z })) });
  const a = 10 * Math.SQRT2 - 10;
  const cases = [
    ['a square frustum', [rect('a', -10, -10, 10, 10), rect('b', -5, -5, 5, 5), loft(['a', 0], ['b', 12])], 4 * (400 + 100 + 200)],
    ['a cone frustum', [circle('a', 0, 0, 10), circle('b', 0, 0, 4), loft(['a', 0], ['b', 6])], 2 * pi * (100 + 16 + 40)],
    ['an oblique cylinder', [circle('a', 0, 0, 5), circle('b', 7, 3, 5), loft(['a', 0], ['b', 10])], 250 * pi],
    // Corners to corners of a square turned 45°: twisted sides; the section at λ is a square on (10 + aλ, 10 − 10λ).
    ['a twisted square', [rect('a', -10, -10, 10, 10), poly('b', [[10 * Math.SQRT2, 0], [0, 10 * Math.SQRT2], [-10 * Math.SQRT2, 0], [0, -10 * Math.SQRT2]]), loft(['a', 0], ['b', 10])], 20 * (100 + 10 * a + a * a / 3 + 100 / 3)],
    ['a square to a circle', [rect('a', -10, -10, 10, 10), circle('b', 0, 0, 6), loft(['a', 0], ['b', 15])], null],
    ['three sections', [circle('a', 0, 0, 8), rect('b', -6, -6, 6, 6), circle('c', 0, 0, 3), loft(['a', 0], ['b', 10], ['c', 18])], null],
    ['a triangle to a hexagon (edges halved to match)', [poly('a', [[10, 0], [-5, 8.66], [-5, -8.66]]), poly('b', [0, 1, 2, 3, 4, 5].map(k => [6 * Math.cos(k * pi / 3), 6 * Math.sin(k * pi / 3)])), loft(['a', 0], ['b', 8])], null],
  ];
  for (const [name, features, exact] of cases) {
    const o = evaluateCadPart(D(features)).outputs.at(-1), report = checkBrep(o.brep);
    assert.equal(report.valid, true, `${name}: ${report.issues}`);
    assert.deepEqual(report.topology.map(t => t.genus), [0], name);
    const m = o.massProperties(1000);
    assert.equal(m.method, 'quadrature', name);
    if (exact !== null) assert.ok(close(m.volumeMM3, exact, 1e-12), `${name}: ${m.volumeMM3} vs ${exact}`);
    // The quadrature agrees with the body's own fine mesh, which is watertight.
    const mesh = brepMassProperties(o.brep, 1000, { segmentsPerQuarter: 64 });
    assert.ok(Math.abs(mesh.volumeMM3 - m.volumeMM3) < 3e-4 * m.volumeMM3, `${name}: mesh ${mesh.volumeMM3} vs ${m.volumeMM3}`);
    assert.ok(Math.hypot(...m.centroidMM.map((c, k) => c - mesh.centroidMM[k])) < 1e-3 * Math.cbrt(m.volumeMM3), `${name}: centroid`);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(m.inertiaCentroidKgM2[i][i] - mesh.inertiaCentroidKgM2[i][i]) < 1e-3 * m.inertiaCentroidKgM2[i][i], `${name}: inertia ${i}`);
    const t = tessellateBrep(o.brep, { segmentsPerQuarter: 8 }), p = t.positionsMM, key = i => `${p[3 * i]},${p[3 * i + 1]},${p[3 * i + 2]}`, directed = new Set();
    for (let k = 0; k < t.indices.length; k += 3) for (let e = 0; e < 3; e++) directed.add(key(t.indices[k + e]) + '>' + key(t.indices[k + (e + 1) % 3]));
    for (const d of directed) { const [x, y] = d.split('>'); assert.ok(directed.has(y + '>' + x), `${name}: open ${d}`); }
  }
  // Names: the caps, the sides by section span, the seams by the faces they part.
  const named = evaluateCadPart(D(cases[5][1])).outputs[0].brep;
  assert.deepEqual(named.faces.map(f => f.name).filter(n => !/side/.test(n)), ['L.bottom', 'L.top']);
  assert.ok(named.edges.some(e => e.name === 'L.s0.side0|L.s1.side0'));
  // A loft takes Booleans: a hole down a cone whose circles start at one point (not a cylinder).
  const holed = evaluateCadPart(D([circle('a', 0, 0, 10), circle('b', 6, 0, 4), loft(['a', 0], ['b', 6]), { id: 'h', kind: 'hole', target: 'L', center: [5, 0], radius: 1.5 }])).outputs.at(-1);
  assert.equal(checkBrep(holed.brep).valid, true);
  assert.ok(Math.abs(volume(holed) - (2 * pi * (100 + 16 + 40) - 2.25 * pi * 6)) < 2e-3 * volume(holed), String(volume(holed)));
  refused(D([circle('a', 0, 0, 5), loft(['a', 0])]), 'INPUT', /2 to 64 sections/);
  refused(D([circle('a', 0, 0, 5), circle('b', 0, 0, 3), loft(['a', 4], ['b', 4])]), 'PARAMETER', /must lie above/);
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
  // Any angle about X or Y: the plate leaves the upright family and keeps its volume.
  const tipped = evaluateCadPart(D([...plate, { id: 'r', kind: 'rotate', target: 'a', axis: 'x', angleDegrees: 45, pivot: [5, 5, 2.5] }])).outputs[0];
  assert.notEqual(tipped.representation, 'upright'); assert.ok(close(tipped.massProperties(1000).volumeMM3, 500));
  assert.ok(close(tipped.brep.vertices.reduce((m, v) => Math.max(m, v.point[2]), -Infinity), 2.5 + Math.hypot(5, 2.5) * Math.sin(Math.PI / 4 + Math.atan2(2.5, 5))), 'its top corner where a 45° turn puts it');
  refused(D([...plate, { id: 'x', kind: 'split', target: 'a', axis: 'z', at: 9 }]), 'SELECTION', /does not cross/);
  refused(D([rect('s', 0, 0, { parameter: 'w' }, 10)]), 'PARAMETER', /unknown parameter w/);
  refused(D([rect('s', 0, 0, 10, 10), rect('s', 0, 0, 5, 5)]), 'FORMAT', /duplicate feature id/);
  assert.throws(() => loadCadPart('{'), e => e instanceof CadPartError && e.code === 'FORMAT');
});

test('mass properties: closed form for upright bodies agrees with mesh integration; STL is well formed', () => {
  const s = evaluateCadPart(D([rect('s', 0, 0, 60, 40), extrude('e', 's', 8), { id: 'h', kind: 'hole', target: 'e', center: [15, 20], radius: 4 }, circle('c', 40, 20, 6), extrude('b', 'c', 10, 8), { id: 'u', kind: 'union', target: 'h', tool: 'b' }]));
  const o = s.outputs[0], exact = o.massProperties(2700), mesh = brepMassProperties(o.brep, 2700, { segmentsPerQuarter: 64 });
  assert.equal(exact.method, 'closed-form'); assert.equal(mesh.method, 'quadrature');
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
    assert.equal(m.method, o.representation === 'upright' ? 'closed-form' : 'quadrature', name);
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

test('sketch planes: profiles drawn on a face, a vertical plane at any heading or a tilted plane grow along its normal', () => {
  const box = [rect('s', 0, 0, 40, 20), extrude('e', 's', 10)];
  const bounds = o => { const b = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }; for (const v of o.brep.vertices) for (let k = 0; k < 3; k++) { b.min[k] = Math.min(b.min[k], v.point[k]); b.max[k] = Math.max(b.max[k], v.point[k]); } return b; };
  // A boss on the +X side face (x = 40): sketch X along +Y, Y up, grown 5 mm outward.
  const side = { origin: [40, 0, 0], normal: [1, 0, 0], xAxis: [0, 1, 0] };
  let snap = evaluateCadPart(D([...box, { ...circle('c', 10, 5, 3), plane: side }, extrude('b', 'c', 5), { id: 'u', kind: 'union', target: 'e', tool: 'b' }]));
  let out = snap.output('u'), b = bounds(out);
  assert.ok(close(volume(out), 8000 + 45 * pi, 1e-4), String(volume(out)));
  assert.ok(close(b.max[0], 45) && close(b.min[1], 0) && close(b.max[2], 10), JSON.stringify(b));
  assert.deepEqual(checkBrep(out.brep).problems ?? [], []);
  // A cut through the front face (y = 0, normal −Y): a negative height goes into the material.
  const front = { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] };
  snap = evaluateCadPart(D([...box, { ...rect('r', 15, 2, 25, 8), plane: front }, extrude('t', 'r', -20), { id: 'd', kind: 'difference', target: 'e', tool: 't' }]));
  out = snap.output('d');
  assert.ok(close(volume(out), 8000 - 10 * 6 * 20, 1e-9), String(volume(out)));
  // The top face with a 30° spin: still upright, exact.
  const top = { origin: [20, 10, 10], normal: [0, 0, 1], xAxis: [Math.cos(pi / 6), Math.sin(pi / 6), 0] };
  snap = evaluateCadPart(D([...box, { ...rect('p', -5, -2, 5, 2), plane: top }, extrude('k', 'p', 3), { id: 'u', kind: 'union', target: 'e', tool: 'k' }]));
  out = snap.output('u');
  assert.equal(out.representation, 'upright');
  assert.ok(close(volume(out), 8000 + 120, 1e-9) && close(bounds(out).max[2], 13));
  // A vertical plane facing 30° from +X; a revolve and a loft on a side plane.
  const heading = { origin: [0, 0, 0], normal: [Math.cos(pi / 6), Math.sin(pi / 6), 0], xAxis: [-Math.sin(pi / 6), Math.cos(pi / 6), 0] };
  out = evaluateCadPart(D([{ ...rect('q', 0, 0, 4, 2), plane: heading }, extrude('w', 'q', 6)])).output('w');
  assert.ok(close(volume(out), 48, 1e-9) && close(bounds(out).max[2], 2, 1e-9));
  out = evaluateCadPart(D([{ ...rect('v', 2, 0, 4, 3), plane: side }, { id: 'rv', kind: 'revolve', sketch: 'v', axis: { origin: [0, 0], direction: 'y' }, angleDegrees: 360 }])).output('rv');
  assert.ok(close(volume(out), pi * (16 - 4) * 3, 1e-6), String(volume(out)));
  assert.ok(close(bounds(out).min[2], 0, 1e-9) && close(bounds(out).max[2], 3, 1e-9), JSON.stringify(bounds(out)));
  out = evaluateCadPart(D([{ ...rect('l0', 0, 0, 4, 4), plane: side }, { ...rect('l1', 1, 1, 3, 3), plane: side },
    { id: 'lf', kind: 'loft', sections: [{ sketch: 'l0', z: 0 }, { sketch: 'l1', z: 6 }] }])).output('lf');
  assert.ok(close(bounds(out).min[0], 40) && close(bounds(out).max[0], 46), JSON.stringify(bounds(out)));
  // A plane tilted 30° about X: Booleans, finishes and shells stay exact (planar B-rep).
  const c30 = Math.cos(pi / 6), s30 = Math.sin(pi / 6), tilt = z => ({ origin: [0, 0, z], normal: [0, -s30, c30], xAxis: [1, 0, 0] });
  const big = [rect('pl', -20, -20, 40, 40), extrude('pe', 'pl', 40)], tilted = z => [{ ...rect('ts', 0, 0, 20, 10), plane: tilt(z) }, extrude('te', 'ts', 5)];
  out = evaluateCadPart(D([...big, ...tilted(15), { id: 'td', kind: 'difference', target: 'pe', tool: 'te' }])).output('td');
  assert.equal(out.representation, 'planar');
  assert.ok(close(volume(out), 144000 - 1000, 1e-12), String(volume(out)));
  out = evaluateCadPart(D([...tilted(15), { id: 'tc', kind: 'chamfer', target: 'te', edges: ['te.side0|te.top'], distance: 1 }])).output('tc');
  assert.ok(close(volume(out), 990, 1e-12));
  out = evaluateCadPart(D([...tilted(15), { id: 'ts2', kind: 'shell', target: 'te', thickness: 1, open: ['te.top'] }])).output('ts2');
  assert.ok(close(volume(out), 424, 1e-12));
  assert.ok(close(bounds(evaluateCadPart(D(tilted(15))).output('te')).max[2], 15 + 10 * s30 + 5 * c30, 1e-9));
  // Mixed loft planes and a non-perpendicular axis are refused.
  refused(D([{ ...rect('x', 0, 0, 1, 1), plane: { origin: [0, 0, 0], normal: [0, 0, 1], xAxis: [0, 1, 1] } }]), 'INPUT', /perpendicular/);
  refused(D([{ ...rect('a', 0, 0, 4, 4), plane: side }, rect('b', 1, 1, 3, 3), { id: 'lf', kind: 'loft', sections: [{ sketch: 'a', z: 0 }, { sketch: 'b', z: 6 }] }]), 'INPUT', /same plane/);
});

test('sketch regions and holes: one extrude makes a windowed plate and a separate boss', () => {
  const square = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(start => ({ kind: 'line', start }));
  const ring = (cx, cy, r) => [{ kind: 'arc', start: [cx + r, cy], center: [cx, cy], direction: 'ccw' }];
  const plate = { ...rect('s', 0, 0, 60, 40), regions: [square(70, 0, 80, 10)], holes: [square(10, 10, 20, 30), ring(40, 20, 5)] };
  const out = evaluateCadPart(D([plate, extrude('e', 's', 4)])).output('e');
  assert.equal(out.representation, 'upright');
  assert.ok(close(volume(out), (2400 + 100 - 200 - 25 * pi) * 4, 1e-9), String(volume(out)));
  const names = out.brep.faces.map(f => f.name);
  assert.equal(new Set(names).size, names.length, 'unique face names');
  for (const n of ['e.side0', 'e.region0.side0', 'e.hole0.side0', 'e.hole1.side0', 'e.top', 'e.bottom']) assert.ok(names.some(x => x === n || x.startsWith(n + '#')), n);
  assert.equal(out.bodyCount, 2, 'the plate and the boss');
  // On a side plane too; other features take one loop.
  const side = { origin: [0, 0, 0], normal: [0, -1, 0], xAxis: [1, 0, 0] };
  const onSide = evaluateCadPart(D([{ ...rect('t', 0, 0, 20, 10), plane: side, holes: [ring(10, 5, 2)] }, extrude('w', 't', 3)])).output('w');
  assert.ok(close(volume(onSide), (200 - 4 * pi) * 3, 1e-9));
  refused(D([plate, { id: 'd', kind: 'extrude', sketch: 's', height: 4, draft: 5 }]), 'CAPABILITY', /drafted extrude takes one loop/);
  refused(D([plate, { id: 'r', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: 'y' } }]), 'CAPABILITY', /revolve takes a sketch of one loop/);
  refused(D([{ ...rect('x', 0, 0, 1, 1), holes: 'no' }]), 'INPUT', /holes must list/);
});

test('fillet volume is exact at any radius, up to the wall height (quadrature over the round)', () => {
  for (const r of [4, 15, 16]) {
    const o = evaluateCadPart(D([rect('s', 0, 0, 32, 32), extrude('e', 's', 16), { id: 'f', kind: 'fillet', target: 'e', edges: ['e.side0|e.top'], radius: r }])).outputs.at(-1);
    const m = o.massProperties(1000), exact = 32 * 32 * 16 - (r * r - pi * r * r / 4) * 32;
    assert.equal(m.method, 'quadrature');
    assert.ok(close(m.volumeMM3, exact, 1e-9), `R${r}: ${m.volumeMM3} vs ${exact}`);
  }
});

test('revolve about any axis in the sketch plane: a square turned about a 45° line through its corner', () => {
  const sq = { id: 's', kind: 'sketch', profile: 'polygon', points: [[2, 0], [4, 2], [2, 4], [0, 2]] };
  // The square's centre (2, 2) lies √2·2 from the line y = x − 0 … here the axis runs along (1, −1) through (0, 0).
  const o = evaluateCadPart(D([sq, { id: 'r', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: [1, -1] }, angleDegrees: 360 }])).outputs[0];
  // Pappus: area 8 × 2π × the centroid's distance from the axis (|2 + 2| / √2 = 2√2).
  assert.ok(close(o.massProperties(1000).volumeMM3, 8 * 2 * pi * 2 * Math.SQRT2, 1e-6), String(o.massProperties(1000).volumeMM3));
  assert.throws(() => evaluateCadPart(D([sq, { id: 'r', kind: 'revolve', sketch: 's', axis: { origin: [0, 0], direction: [0, 0] } }])), /axis must be/);
});

test('separate: a bar cut in two becomes two parts, each a body; a body in one piece is refused', () => {
  const doc = [rect('s', 0, 0, 30, 10), extrude('a', 's', 5), rect('t', 10, -5, 20, 15), extrude('b', 't', 7, -1), { id: 'd', kind: 'difference', target: 'a', tool: 'b' }];
  const r = evaluateCadPart(D([...doc, { id: 'p', kind: 'separate', target: 'd' }]));
  assert.deepEqual(r.outputs.map(o => [o.id, o.bodyCount]), [['p/0', 1], ['p/1', 1]]);
  assert.ok(close(volume(r.output('p/0')) + volume(r.output('p/1')), 2 * 10 * 10 * 5));
  // Each piece goes on on its own: a hole in one of them.
  const h = evaluateCadPart(D([...doc, { id: 'p', kind: 'separate', target: 'd' }, { id: 'h', kind: 'hole', target: 'p/1', center: [25, 5], radius: 1 }]));
  assert.deepEqual(h.outputs.map(o => o.id), ['p/0', 'h']);
  assert.throws(() => evaluateCadPart(D([rect('s', 0, 0, 30, 10), extrude('a', 's', 5), { id: 'p', kind: 'separate', target: 'a' }])), /one piece/);
});

test('split across an oblique plane: a mitre x + y = at, a tilted cut through a holed plate, a normal along one axis', () => {
  // A 20 × 10 × 5 bar mitred across x + y = 15: a triangle-ended piece each side, the volumes summing.
  const bar = [rect('s', 0, 0, 20, 10), extrude('a', 's', 5)];
  const m = evaluateCadPart(D([...bar, { id: 'm', kind: 'split', target: 'a', normal: [1, 1, 0], at: 15 }]));
  assert.deepEqual(m.outputs.map(o => o.id), ['m/0', 'm/1']);
  const v0 = volume(m.output('m/0')), v1 = volume(m.output('m/1'));
  assert.ok(close(v0 + v1, 1000, 1e-9), `${v0} + ${v1}`);
  // Past the line from (5, 10) to (15, 0): the quadrilateral (15, 0) (20, 0) (20, 10) (5, 10), area 100.
  assert.ok(close(v1, 100 * 5, 1e-9), String(v1));
  for (const o of m.outputs) assert.deepEqual(checkBrep(o.brep).issues, []);
  // Tilted about Y through a plate with a hole (cylinder and planes, analytic Boolean): still two exact halves.
  const plate = [rect('s', 0, 0, 40, 20), extrude('a', 's', 10), { id: 'h', kind: 'hole', target: 'a', center: [20, 10], radius: 3 }];
  const t = evaluateCadPart(D([...plate, { id: 't', kind: 'split', target: 'h', normal: [1, 0, 1], at: 25 }]));
  assert.ok(close(volume(t.output('t/0')) + volume(t.output('t/1')), 8000 - 90 * pi, 1e-6));
  // A normal along one axis is that axis: −2x = −8 is x = 4, and /0 (−2x below −8) is the side past it.
  const x = evaluateCadPart(D([...bar, { id: 'x', kind: 'split', target: 'a', normal: [-2, 0, 0], at: -8 }]));
  assert.ok(close(volume(x.output('x/0')), 800) && close(volume(x.output('x/1')), 200));
  refused(D([...bar, { id: 'n', kind: 'split', target: 'a', normal: [1, 1, 0], at: 40 }]), 'SELECTION', /does not cross/);
  refused(D([...bar, { id: 'z', kind: 'split', target: 'a', normal: [0, 0, 0], at: 1 }]), 'INPUT', /must not be zero/);
});

test('a long chain of features evaluates and is reused: no key spells out what is upstream of it', () => {
  // (Keys that embedded their inputs' keys grew with each level and failed near 22 chained holes.)
  const F = [rect('s', 0, 0, 400, 40), extrude('e', 's', 10)];
  let last = 'e';
  for (let k = 0; k < 120; k++) { F.push({ id: 'h' + k, kind: 'hole', target: last, center: [3 + k * 3.2, 20], radius: 1 }); last = 'h' + k; }
  const snap = evaluateCadPart(D(F));
  assert.ok(close(volume(snap.output(last)), 400 * 40 * 10 - 120 * pi * 10, 1e-9));
  const same = snap.withDocument(D(F));
  assert.equal(same.recomputation.evaluated.length, 0);
  const edited = snap.withDocument(D(F.map((f, i) => i === F.length - 1 ? { ...f, radius: 1.2 } : f)));
  assert.deepEqual(edited.recomputation.evaluated, [last]);
  // An input that changed is not reused through: editing the plate rebuilds every hole on it.
  const plate = snap.withDocument(D(F.map(f => f.id === 'e' ? { ...f, height: 12 } : f)));
  assert.equal(plate.recomputation.evaluated.length, 121);
});

test('draft: side faces turned about their line on the bottom, in (material off) or out (added), by volume', () => {
  const box = [rect('s', 0, 0, 20, 20), extrude('e', 's', 10)], t = Math.tan(10 * pi / 180);
  const one = evaluateCadPart(D([...box, { id: 'd', kind: 'draft', target: 'e', faces: ['e.side0'], angleDegrees: 10 }])).output('d');
  assert.ok(close(volume(one), 4000 - 0.5 * 10 * (10 * t) * 20, 1e-6), String(volume(one)));
  assert.deepEqual(checkBrep(one.brep).issues, []);
  // Two opposite sides: twice the wedge. Two that meet are refused (their wedges would need a mitre).
  const two = evaluateCadPart(D([...box, { id: 'd', kind: 'draft', target: 'e', faces: ['e.side0', 'e.side2'], angleDegrees: 10 }])).output('d');
  assert.ok(close(volume(two), 4000 - 2 * 0.5 * 10 * (10 * t) * 20, 1e-6), String(volume(two)));
  refused(D([...box, { id: 'd', kind: 'draft', target: 'e', faces: ['e.side0', 'e.side1'], angleDegrees: 10 }]), 'CAPABILITY', /meet along an edge/);
  // Out: the same wedge added.
  const out = evaluateCadPart(D([...box, { id: 'd', kind: 'draft', target: 'e', faces: ['e.side0'], angleDegrees: -10 }])).output('d');
  assert.ok(close(volume(out), 4000 + 0.5 * 10 * (10 * t) * 20, 1e-6), String(volume(out)));
  refused(D([...box, { id: 'd', kind: 'draft', target: 'e', faces: ['e.top'], angleDegrees: 5 }]), 'CAPABILITY', /square to the pull/);
  refused(D([...box, { id: 'd', kind: 'draft', target: 'e', faces: ['e.nope'], angleDegrees: 5 }]), 'REFERENCE', /no face e\.nope/);
});

test('hole: a 90° countersink is cut with the hole, along any axis and from either side', () => {
  const cube = [rect('s', 0, 0, 40, 40), { id: 'b', kind: 'extrude', sketch: 's', height: 40 }];
  // The frustum beyond the cylinder: π t/3 (R² + R r + r²) − π r² t, t = R − r.
  const R = 6, r = 3, t = 3, extra = Math.PI * t / 3 * (R * R + R * r + r * r) - Math.PI * r * r * t;
  for (const axis of ['x', 'y', 'z']) for (const side of ['min', 'max']) {
    const hole = { id: 'h', kind: 'hole', target: 'b', center: [20, 20], radius: r, axis, side };
    const plain = evaluateCadPart(D([...cube, hole])).outputs[0], csk = evaluateCadPart(D([...cube, { ...hole, countersink: 2 * R }])).outputs[0];
    assert.ok(Math.abs(plain.massProperties(1).volumeMM3 - csk.massProperties(1).volumeMM3 - extra) < 1e-3, `${axis} ${side}`);
    assert.equal(checkBrep(csk.brep).issues.length, 0);
    assert.ok(csk.brep.faces.some(f => /^h\.countersink-/.test(f.name ?? '')), 'the cone faces are the hole’s');
  }
  assert.throws(() => evaluateCadPart(D([...cube, { id: 'h', kind: 'hole', target: 'b', center: [20, 20], radius: 3, countersink: 6 }])), e => e instanceof CadPartError && e.code === 'INPUT');
});

test('cylinder walls touching at a point from inside: built in either order, the volume the exact one', () => {
  // A smaller cylinder touching a larger one's wall from inside: the intersection's two loops meet at the
  // touch, the crossing quadratic's discriminant has a double zero there. The exact volume: the box less
  // both holes plus their overlap, integrated across the smaller hole's disc.
  const overlap = (xs, rs, xl, rl) => { let v = 0; const n = 20000; for (let i = 0; i < n; i++) { const x = xs - rs + 2 * rs * (i + 0.5) / n; v += 4 * Math.sqrt(Math.max(0, rs * rs - (x - xs) ** 2)) * Math.sqrt(Math.max(0, rl * rl - (x - xl) ** 2)) * 2 * rs / n; } return v; };
  const plate = [rect('s', 0, 0, 100, 40), { id: 'e', kind: 'extrude', sketch: 's', height: 12 }];
  const cube = [rect('s', 0, 0, 20, 20), { id: 'e', kind: 'extrude', sketch: 's', height: 20 }];
  // The studio's plate (Ø4 across at x = 42, Ø6 down at x = 43: touching at 40, 30, 6) and a 20 mm cube
  // (Ø2 across at x = 8, Ø6 down at x = 10: touching at 7, 10, 10).
  const cases = [
    { base: plate, box: 48000, across: { kind: 'hole', center: [42, 6], radius: 2, axis: 'y' }, down: { kind: 'hole', center: [43, 30], radius: 3 }, exact: 48000 - Math.PI * 9 * 12 - Math.PI * 4 * 40 + overlap(42, 2, 43, 3) },
    { base: cube, box: 8000, across: { kind: 'hole', center: [8, 10], radius: 1, axis: 'y' }, down: { kind: 'hole', center: [10, 10], radius: 3 }, exact: 8000 - Math.PI * 9 * 20 - Math.PI * 20 + overlap(8, 1, 10, 3) },
  ];
  for (const c of cases) for (const [a, b] of [[c.across, c.down], [c.down, c.across]]) {
    const out = evaluateCadPart(D([...c.base, { ...a, id: 'h1', target: 'e' }, { ...b, id: 'h2', target: 'h1' }])).outputs[0];
    assert.equal(checkBrep(out.brep).issues.length, 0);
    const v = out.massProperties(1).volumeMM3;
    assert.ok(Math.abs(v - c.exact) <= 1e-5 * c.exact, `${v} vs ${c.exact}`);
  }
  // The larger cylinder turned about its own axis (its seams moved off the touch) and subtracted as a body.
  const tube = deg => [{ id: 'c', kind: 'sketch', profile: 'circle', center: [10, 10], radius: 3 }, { id: 'v0', kind: 'extrude', sketch: 'c', height: 22, from: -1 }, { id: 'v', kind: 'rotate', target: 'v0', axis: 'z', angleDegrees: deg, pivot: [10, 10, 0] }];
  for (const deg of [30, 90]) for (const across of [cases[1].across, { kind: 'hole', center: [12, 10], radius: 1, axis: 'x' }]) for (const first of ['hole', 'tube']) {
    const f = first === 'hole' ? [...cube, ...tube(deg), { ...across, id: 'h', target: 'e' }, { id: 'd', kind: 'difference', target: 'h', tool: 'v' }]
      : [...cube, ...tube(deg), { id: 'd', kind: 'difference', target: 'e', tool: 'v' }, { ...across, id: 'h', target: 'd' }];
    const out = evaluateCadPart(D(f)).outputs.at(-1);
    assert.equal(checkBrep(out.brep).issues.length, 0);
    assert.ok(Math.abs(out.massProperties(1).volumeMM3 - cases[1].exact) <= 1e-5 * cases[1].exact, `${deg}° ${first} first: ${out.massProperties(1).volumeMM3}`);
  }
  // Equal radii with meeting axes (the mitre the fillets make) still join.
  const big = cases[1].down;
  assert.ok(evaluateCadPart(D([...cube, { ...big, id: 'h1', target: 'e', axis: 'y' }, { ...big, id: 'h2', target: 'h1' }])).outputs[0]);
  // Touching from outside (two cavities meeting at a point) is not a manifold solid.
  refused(D([...cube, { kind: 'hole', center: [5, 10], radius: 2, axis: 'y', id: 'h1', target: 'e' }, { ...big, id: 'h2', target: 'h1' }]), 'GEOMETRY', /touch along an edge or at a vertex/);
});
