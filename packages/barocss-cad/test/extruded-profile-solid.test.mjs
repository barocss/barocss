import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProfileLoop, buildExtrudedProfileSolid, measureExtrudedProfileSolid, tessellateExtrudedProfileSolid,
  exportExtrudedProfileSolidStl, ExtrudedProfileError, evaluateCurve, cad, CadModelError,
} from '../dist/index.js';

const slot = (l = 40, r = 6) => [
  { kind: 'line', start: [0, -r] },
  { kind: 'arc', start: [l, -r], center: [l, 0], direction: 'ccw' },
  { kind: 'line', start: [l, r] },
  { kind: 'arc', start: [0, r], center: [0, 0], direction: 'ccw' },
];
const close = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);

function watertight(mesh) {
  const key = i => `${Math.round(mesh.positionsMM[i * 3] * 1e6)},${Math.round(mesh.positionsMM[i * 3 + 1] * 1e6)},${Math.round(mesh.positionsMM[i * 3 + 2] * 1e6)}`;
  const id = new Map(); const w = i => { const k = key(i); if (!id.has(k)) id.set(k, id.size); return id.get(k); };
  const directed = new Map(); let volume = 0; const p = mesh.positionsMM, I = mesh.indices;
  for (let t = 0; t < I.length; t += 3) {
    const v = [w(I[t]), w(I[t + 1]), w(I[t + 2])];
    for (let e = 0; e < 3; e++) { const k = v[e] + '>' + v[(e + 1) % 3]; directed.set(k, (directed.get(k) ?? 0) + 1); }
    const [a, b, c] = [I[t] * 3, I[t + 1] * 3, I[t + 2] * 3];
    volume += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
  }
  for (const [k, n] of directed) {
    const [a, b] = k.split('>');
    assert.equal(n, 1, `edge ${k} used ${n} times in one direction`);
    assert.equal(directed.get(b + '>' + a), 1, `edge ${k} has no opposite`);
  }
  return volume;
}

test('slot: exact area, centroid, volume and B-rep topology', () => {
  const loop = buildProfileLoop(slot());
  close(loop.areaMM2, 40 * 12 + Math.PI * 36, 1e-9, 'area');
  close(loop.centroidMM[0], 20, 1e-9, 'cx'); close(loop.centroidMM[1], 0, 1e-9, 'cy');
  close(loop.perimeterMM, 80 + Math.PI * 12, 1e-9, 'perimeter');
  const solid = buildExtrudedProfileSolid(loop, { id: 'slot', heightMM: 5, fromMM: 2 });
  assert.equal(solid.report.eulerCharacteristic, 2);
  assert.equal(solid.faces.length, 6); assert.equal(solid.edges.length, 12); assert.equal(solid.vertices.length, 8);
  assert.deepEqual(solid.faces.map(f => f.kind), ['plane', 'plane', 'plane', 'cylinder', 'plane', 'cylinder']);
  close(solid.report.volumeMM3, (480 + Math.PI * 36) * 5, 1e-8, 'volume');
  assert.deepEqual(solid.report.boundsMM, { min: [-6, -6, 2], max: [46, 6, 7] });
  assert.ok(solid.report.maxCurveDeviationMM < 1e-9);
  assert.ok(Object.isFrozen(solid) && Object.isFrozen(solid.faces[3].surface.controlPoints));
});

test('arc curves are exact rational quadratics on the circle', () => {
  const solid = buildExtrudedProfileSolid(buildProfileLoop(slot()), { id: 's', heightMM: 1 });
  const arc = solid.edges.find(e => e.role === 'bottom' && solid.profile.segments[e.segment].kind === 'arc').curve;
  assert.equal(arc.degree, 2); assert.equal(arc.controlPoints.length, 5); // 180° → two 90° spans
  for (let k = 0; k <= 64; k++) { const p = evaluateCurve(arc, k / 64); close(Math.hypot(p[0] - 40, p[1]), 6, 1e-12, 'radius'); }
});

test('full circle loop, clockwise input and a concave arc notch', () => {
  const circle = buildProfileLoop([{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }]);
  close(circle.areaMM2, Math.PI * 100, 1e-9, 'circle area');
  const solid = buildExtrudedProfileSolid(circle, { id: 'c', heightMM: 3 });
  assert.equal(solid.report.eulerCharacteristic, 2); assert.equal(solid.faces.length, 3);
  const cw = buildProfileLoop([...slot()].reverse().map((s, i, all) => {
    // Reverse traversal: each segment now starts where the original ended.
    const orig = slot(); const j = orig.length - 1 - i; const end = orig[(j + 1) % orig.length].start;
    return orig[j].kind === 'line' ? { kind: 'line', start: end } : { kind: 'arc', start: end, center: orig[j].center, direction: 'cw' };
  }));
  assert.equal(cw.reversed, true); close(cw.areaMM2, 480 + Math.PI * 36, 1e-9, 'cw area');
  // 40 × 20 plate with a semicircular notch of radius 5 cut into the top edge (concave, cw arc).
  const notch = buildProfileLoop([
    { kind: 'line', start: [0, 0] }, { kind: 'line', start: [40, 0] }, { kind: 'line', start: [40, 20] },
    { kind: 'arc', start: [25, 20], center: [20, 20], direction: 'cw' }, { kind: 'line', start: [15, 20] }, { kind: 'line', start: [0, 20] },
  ]);
  close(notch.areaMM2, 800 - Math.PI * 25 / 2, 1e-9, 'notch area');
  const m = tessellateExtrudedProfileSolid(buildExtrudedProfileSolid(notch, { id: 'n', heightMM: 4 }), { segmentsPerQuarter: 16 });
  const v = watertight(m); assert.ok(Math.abs(v - (800 - Math.PI * 12.5) * 4) / v < 2e-3, String(v));
});

test('refusals are typed: self-intersection, off-circle arc, degenerate input', () => {
  const code = f => { try { f(); return 'none'; } catch (e) { assert.ok(e instanceof ExtrudedProfileError, String(e)); return e.code; } };
  assert.equal(code(() => buildProfileLoop([{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [10, 10] }, { kind: 'line', start: [10, 0] }, { kind: 'line', start: [0, 10] }])), 'SELF_INTERSECTION');
  assert.equal(code(() => buildProfileLoop([{ kind: 'line', start: [0, 0] }, { kind: 'arc', start: [10, 0], center: [10, 5], direction: 'ccw' }, { kind: 'line', start: [10, 12] }])), 'GEOMETRY');
  assert.equal(code(() => buildProfileLoop([{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [0, 0] }, { kind: 'line', start: [5, 5] }])), 'GEOMETRY');
  assert.equal(code(() => buildProfileLoop([{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [1e6, 0] }, { kind: 'line', start: [0, 5] }])), 'INPUT');
  assert.equal(code(() => buildProfileLoop([])), 'BUDGET');
});

test('mass matches the analytic box and a watertight mesh matches the volume', () => {
  const box = buildProfileLoop([{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [30, 0] }, { kind: 'line', start: [30, 20] }, { kind: 'line', start: [0, 20] }]);
  const solid = buildExtrudedProfileSolid(box, { id: 'b', heightMM: 10 });
  const m = measureExtrudedProfileSolid(solid, { densityKgPerM3: 2700 });
  const mass = 2700 * 6000e-9; close(m.massKG, mass, 1e-15, 'mass');
  assert.deepEqual(m.centroidMM.map(v => Math.round(v * 1e9) / 1e9), [15, 10, 5]);
  const I = (a, b) => mass * (a * a + b * b) / 12 * 1e-6;
  close(m.inertiaCentroidKgM2[0][0], I(20, 10), 1e-15, 'Ixx'); close(m.inertiaCentroidKgM2[1][1], I(30, 10), 1e-15, 'Iyy');
  close(m.inertiaCentroidKgM2[2][2], I(30, 20), 1e-15, 'Izz'); close(m.inertiaCentroidKgM2[0][1], 0, 1e-18, 'Ixy');
  const slotSolid = buildExtrudedProfileSolid(buildProfileLoop(slot()), { id: 's', heightMM: 5 });
  const v = watertight(tessellateExtrudedProfileSolid(slotSolid, { segmentsPerQuarter: 32 }));
  assert.ok(Math.abs(v - slotSolid.report.volumeMM3) / v < 1e-3, `${v} vs ${slotSolid.report.volumeMM3}`);
  const stl = exportExtrudedProfileSolidStl(slotSolid);
  assert.equal(stl.length, 84 + 50 * new DataView(stl.buffer).getUint32(80, true));
});

test('model graph: a parametric slot loop loads, measures, exports, saves and refuses convex-only operations', () => {
  const at = (x, y) => [x, y];
  const doc = { format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { length: 40, r: 6 }, nodes: [
    { kind: 'sketch', profile: 'loop', segments: [
      { kind: 'line', start: at(0, -6) }, { kind: 'arc', start: [{ parameter: 'length' }, -6], center: [{ parameter: 'length' }, 0], direction: 'ccw' },
      { kind: 'line', start: [{ parameter: 'length' }, 6] }, { kind: 'arc', start: at(0, 6), center: at(0, 0), direction: 'ccw' }] },
    { kind: 'extrude', sketch: 0, height: 5, from: 2 }], outputs: { slot: { node: 1, side: 'solid' } } };
  const snap = cad.load(JSON.stringify(doc));
  assert.equal(snap.bodies.slot.family, 'extruded-profile');
  assert.deepEqual(snap.evidence.map(e => [e.kind, e.profile]), [['sketch', 'loop'], ['extrude', 'loop']]);
  close(snap.bodies.slot.native.report.volumeMM3, (480 + Math.PI * 36) * 5, 1e-8, 'volume');
  const longer = snap.withParameters({ length: 60 });
  close(longer.bodies.slot.native.report.volumeMM3, (720 + Math.PI * 36) * 5, 1e-8, 'edited volume');
  assert.deepEqual(longer.recomputation.evaluatedFeatures, [0, 1]);
  const mass = snap.massProperties('slot', { densityKgPerM3: 2700 });
  assert.equal(mass.family, 'extruded-profile'); close(mass.massKG, 2700 * (480 + Math.PI * 36) * 5e-9, 1e-15, 'mass');
  close(mass.centroidMM[2], 4.5, 1e-12, 'cz');
  const stl = snap.exportStl('slot');
  assert.equal(stl.family, 'extruded-profile'); assert.equal(stl.byteLength, 84 + 50 * stl.triangleCount);
  assert.ok(stl.maximumVertexDisplacementMM > 0 && stl.maximumVertexDisplacementMM < 0.01);
  assert.deepEqual(JSON.parse(cad.load(snap.save()).save()), JSON.parse(snap.save()));
  const refuse = (nodes, outputs = doc.outputs) => { try { cad.load(JSON.stringify({ ...doc, nodes, outputs })); return 'none'; } catch (e) { assert.ok(e instanceof CadModelError, String(e)); return e.code + ' ' + e.operation; } };
  assert.equal(refuse([{ ...doc.nodes[0], segments: [{ kind: 'line', start: [0, 0] }, { kind: 'line', start: [10, 10] }, { kind: 'line', start: [10, 0] }, { kind: 'line', start: [0, 10] }] }, doc.nodes[1]]), 'CAPABILITY loop');
  assert.equal(refuse([{ ...doc.nodes[0], segments: [{ kind: 'spline', start: [0, 0] }] }, doc.nodes[1]]), 'CAPABILITY loop');
  assert.equal(refuse([...doc.nodes, { kind: 'chamfer', parent: { node: 1, side: 'solid' }, edge: { parallelTo: 'x' }, distance: 1 }]), 'CAPABILITY chamfer');
  assert.equal(refuse([...doc.nodes, { kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [1, 0, 0] }], { slot: { node: 2, side: 'solid' } }), 'CAPABILITY translate');
});

test('model builder: sketch.loop authors the same node and a full-circle loop extrudes', () => {
  const m = cad.model();
  const snap = m.build({ disc: m.sketch.loop([{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }]).extrude(3, { from: -1 }) });
  assert.equal(snap.bodies.disc.family, 'extruded-profile'); assert.equal(snap.bodies.disc.native.faces.length, 3);
  assert.deepEqual(snap.bodies.disc.native.report.boundsMM.min.map(v => Math.round(v * 1e9) / 1e9), [-10, -10, -1]);
  assert.deepEqual(JSON.parse(snap.save()).nodes[0], { kind: 'sketch', profile: 'loop', segments: [{ kind: 'arc', start: [10, 0], center: [0, 0], direction: 'ccw' }] });
  assert.throws(() => cad.model().sketch.loop([{ kind: 'arc', start: [10, 0], center: [0, 1], direction: 'up' }]), e => e instanceof CadModelError && e.code === 'INPUT');
});
