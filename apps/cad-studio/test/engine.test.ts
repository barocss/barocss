import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { cylinderPart, emptyDoc, featureLabel, leafBodies, prefixDoc, rectanglePart, starterDoc, withNode } from '../src/engine/doc';
import type { DisplayMesh } from '../src/engine/mesh';

// Signed volume of a closed, outward-wound triangle mesh.
function signedVolume(mesh: DisplayMesh) {
  let v = 0; const p = mesh.positions, i = mesh.indices;
  for (let t = 0; t < i.length; t += 3) {
    const a = i[t] * 3, b = i[t + 1] * 3, c = i[t + 2] * 3;
    v += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
  }
  return v;
}

test('box part evaluates to one outward mesh with 6 faces and 12 edges', () => {
  const r = evaluateDoc(rectanglePart(64, 32, 8), 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.equal(r.bodies.length, 1);
  const m = r.bodies[0].mesh;
  assert.equal(m.faces.length, 6);
  assert.equal(m.edges.length, 12);
  assert.ok(Math.abs(signedVolume(m) - 64 * 32 * 8) < 1e-6);
  assert.deepEqual(m.bounds, { min: [0, 0, 0], max: [64, 32, 8] });
  assert.ok(m.edges.every(e => e.straight && e.axis));
});

test('starter plate with a hole shows a curved wall and the hole edges', () => {
  const r = evaluateDoc(starterDoc(), 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  const m = r.bodies[0].mesh;
  assert.ok(m.faces.some(f => f.kind === 'curved'));
  const expected = 64 * 32 * 8 - Math.PI * 16 * 8;
  assert.ok(Math.abs(signedVolume(m) - expected) / expected < 0.01, String(signedVolume(m)));
  assert.ok(m.edges.length >= 14);
});

test('cylinder part meshes caps and a smooth side without side seams', () => {
  const r = evaluateDoc(cylinderPart(10, 20), 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  const m = r.bodies[0].mesh;
  assert.equal(m.faces.filter(f => f.kind === 'plane').length, 2);
  assert.equal(m.edges.length, 2);
});

test('union of two boxes meshes the orthogonal result', () => {
  let doc = rectanglePart(40, 10, 6);
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 30] });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 6 });
  assert.equal(leafBodies(doc.nodes).length, 2);
  doc = withNode(doc, { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.equal(r.bodies.length, 1);
  const v = signedVolume(r.bodies[0].mesh);
  assert.ok(Math.abs(v - (40 * 10 * 6 + 10 * 20 * 6)) < 1e-6, String(v));
  // An L-shaped prism: top, bottom and six sides; six edges on each cap and six verticals.
  assert.equal(r.bodies[0].mesh.faces.length, 8);
  assert.equal(r.bodies[0].mesh.edges.length, 18);
});

test('a pattern is one output holding the original and its copies; rollback evaluates a prefix', () => {
  let doc = rectanglePart(20, 10, 5);
  doc = withNode(doc, { kind: 'linear-pattern', parent: { node: 1, side: 'solid' }, axis: 'x', spacing: 30, count: 3 });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.equal(r.bodies.length, 1);
  assert.ok(Math.abs(signedVolume(r.bodies[0].mesh) - 3000) < 1e-6);
  assert.equal(r.bodies[0].mesh.bounds.max[0], 80);
  const rolled = evaluateDoc(prefixDoc(doc, 2), 2);
  assert.ok(rolled.ok);
  assert.equal(rolled.bodies.length, 1);
});

test('kernel refusals come back as plain-language errors', () => {
  // A hole crossing the plate's edge is a notch; one that misses the plate is refused.
  const notch = evaluateDoc(withNode(rectanglePart(100, 60, 5), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [2, 30], radius: 4 }), 1);
  assert.ok(notch.ok && notch.bodies[0].volumeMM3! < 30000);
  const r = evaluateDoc(withNode(rectanglePart(100, 60, 5), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [200, 30], radius: 4 }), 1);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.error.title, /misses the body/);
    assert.match(r.error.detail, /misses the target/);
  }
});

test('B-rep part model: Boolean chains, holes on results, and name-based fillets that survive edits', () => {
  // Plate ∪ boss ∪ second boss, a hole through the result, then the plate's corner rounded by name.
  let doc = rectanglePart(60, 40, 8);
  doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [15, 20], radius: 6 });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 10, from: 8 });
  doc = withNode(doc, { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [35, 10], max: [50, 30] });
  doc = withNode(doc, { kind: 'extrude', sketch: 5, height: 6, from: 8 });
  doc = withNode(doc, { kind: 'union', left: { node: 4, side: 'solid' }, right: { node: 6, side: 'solid' } });
  doc = withNode(doc, { kind: 'hole', parent: { node: 7, side: 'solid' }, center: [15, 20], radius: 3 });
  const before = evaluateDoc(doc, 1);
  assert.ok(before.ok, JSON.stringify(!before.ok && before.error));
  const mesh = before.bodies[0].mesh, corner = mesh.edges.find(e => e.axis === 'z' && e.a[0] === 60 && e.a[1] === 0)!;
  assert.deepEqual(corner.names, ['n1.side0|n1.side1']);
  assert.ok(mesh.faces.some(f => f.name === 'n8.side0' && f.kind === 'curved'), 'the hole wall is one named face');
  doc = withNode(doc, { kind: 'fillet', parent: { node: 8, side: 'solid' }, edges: corner.names, radius: 5 });
  const filleted = evaluateDoc(doc, 2);
  assert.ok(filleted.ok, JSON.stringify(!filleted.ok && filleted.error));
  const exact = 60 * 40 * 8 + Math.PI * 36 * 10 + 15 * 20 * 6 - Math.PI * 9 * 18 - (25 - 25 * Math.PI / 4) * 8;
  assert.ok(Math.abs(filleted.bodies[0].volumeMM3! - exact) < 1e-6, String(filleted.bodies[0].volumeMM3));
  // A wider, thicker plate: the fillet still finds its edge by name.
  const edited = { ...doc, nodes: doc.nodes.map((n, i) => i === 0 ? { ...n, max: [90, 40] } : i === 1 ? { ...n, height: 12 } : n) as typeof doc.nodes };
  const after = evaluateDoc(edited, 3);
  assert.ok(after.ok, JSON.stringify(!after.ok && after.error));
  assert.ok(after.bodies[0].mesh.faces.some(f => f.name === 'n9.face'));
});

test('side holes along X and Y, and a pin along X joined to the plate (plane + cylinder Booleans)', () => {
  let doc = rectanglePart(60, 30, 12);
  doc = withNode(doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [15, 6], radius: 3, axis: 'x' });
  doc = withNode(doc, { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [45, 6], radius: 2, axis: 'y', side: 'min', depth: 10 });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  const [body] = r.bodies, exact = 60 * 30 * 12 - Math.PI * 9 * 60 - Math.PI * 4 * 10;
  assert.equal(body.family, 'curved');
  assert.ok(Math.abs(body.volumeMM3! - exact) < 2e-4 * exact, String(body.volumeMM3));
  assert.ok(Math.abs(signedVolume(body.mesh) - exact) / exact < 5e-3);
  assert.ok(body.mesh.faces.some(f => f.name === 'n2.side0' && f.kind === 'curved'), 'the cross hole wall is one named face');
});

test('a side hole drilled across a round boss (quartic trims) and through a plate turned 30°', () => {
  let doc = rectanglePart(60, 30, 10);
  doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [30, 15], radius: 8 });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 14, from: 10 });
  doc = withNode(doc, { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
  doc = withNode(doc, { kind: 'hole', parent: { node: 4, side: 'solid' }, center: [15, 18], radius: 3, axis: 'x' });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  // Removed: the x-cylinder (r 3) inside the boss (r 8): ∫ 2√(9 − y²) · 2√(64 − y²) dy over |y| ≤ 3.
  let crossed = 0; for (let i = 0, n = 4000; i < n; i++) { const y = -3 + 6 * (i + 0.5) / n; crossed += 2 * Math.sqrt(9 - y * y) * 2 * Math.sqrt(64 - y * y) * 6 / n; }
  const exact = 60 * 30 * 10 + Math.PI * 64 * 14 - crossed;
  assert.ok(Math.abs(r.bodies[0].volumeMM3! - exact) < 3e-4 * exact, String(r.bodies[0].volumeMM3));
  let turned = rectanglePart(40, 20, 10);
  turned = withNode(turned, { kind: 'rotate', parent: { node: 1, side: 'solid' }, axis: 'z', angleDegrees: 30 });
  turned = withNode(turned, { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [10, 5], radius: 2, axis: 'x' });
  const t = evaluateDoc(turned, 2);
  assert.ok(t.ok, JSON.stringify(!t.ok && t.error));
  assert.ok(t.bodies[0].volumeMM3! < 8000);
});

test('fillets and chamfers on any edge: a box top edge, a hole rim picked by one arc, a chamfered rim', () => {
  const corner = (r: number) => r * r * (1 - Math.PI / 4), k = (10 - 3 * Math.PI) / (12 - 3 * Math.PI);
  const box = rectanglePart(20, 10, 5);
  const top = evaluateDoc(withNode(box, { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], radius: 2 }), 1);
  assert.ok(top.ok, JSON.stringify(!top.ok && top.error));
  assert.ok(Math.abs(top.bodies[0].volumeMM3! - (1000 - corner(2) * 20)) < 1e-4 * 1000, String(top.bodies[0].volumeMM3));
  assert.ok(top.bodies[0].mesh.faces.some(f => f.kind === 'curved' && /n2\.face/.test(f.name)), 'the fillet face is named by its feature');
  // The starter plate's hole: its rim is two arcs; either one names the whole circle.
  const plate = starterDoc(), probe = evaluateDoc(plate, 2);
  assert.ok(probe.ok);
  const rim = probe.ok && probe.bodies[0].mesh.edges.find(e => !e.straight && e.names.some(n => /n1\.top/.test(n) && /n2\./.test(n)))!;
  assert.ok(rim, 'a rim arc');
  const base = 64 * 32 * 8 - Math.PI * 16 * 8;
  const filleted = evaluateDoc(withNode(plate, { kind: 'fillet', parent: { node: 2, side: 'solid' }, edges: rim.names, radius: 1 }), 3);
  assert.ok(filleted.ok, JSON.stringify(!filleted.ok && filleted.error));
  assert.ok(Math.abs(filleted.bodies[0].volumeMM3! - (base - 2 * Math.PI * (4 + k) * corner(1))) < 1e-4 * base, String(filleted.bodies[0].volumeMM3));
  const chamfered = evaluateDoc(withNode(plate, { kind: 'chamfer', parent: { node: 2, side: 'solid' }, edges: rim.names, distance: 1 }), 4);
  assert.ok(chamfered.ok, JSON.stringify(!chamfered.ok && chamfered.error));
  assert.ok(Math.abs(chamfered.bodies[0].volumeMM3! - (base - 2 * Math.PI * (4 + 1 / 3) * 0.5)) < 1e-4 * base, String(chamfered.bodies[0].volumeMM3));
  // A fillet as large as a boss is refused in plain words.
  let boss = withNode(rectanglePart(20, 20, 4), { kind: 'sketch', profile: 'circle', center: [10, 10], radius: 3 });
  boss = withNode(boss, { kind: 'extrude', sketch: 2, height: 5, from: 4 });
  boss = withNode(boss, { kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
  const bossRim = (() => { const r = evaluateDoc(boss, 5); return r.ok ? r.bodies[0].mesh.edges.find(e => !e.straight && e.names.some(n => /n3\.top/.test(n)))!.names : []; })();
  const full = evaluateDoc(withNode(boss, { kind: 'fillet', parent: { node: 4, side: 'solid' }, edges: bossRim, radius: 3 }), 6);
  assert.equal(full.ok, false);
  if (!full.ok) assert.match(full.error.title, /as large as the circle/);
});

test('revolve: a circle sketch turns into a torus, cut by a box; a profile along the axis is solid, one across it refused', () => {
  let doc = withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [20, 10], radius: 4 });
  doc = withNode(doc, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  const torus = 2 * Math.PI ** 2 * 20 * 16;
  assert.ok(Math.abs(r.bodies[0].volumeMM3! - torus) < 1e-9 * torus, String(r.bodies[0].volumeMM3));
  assert.equal(r.bodies[0].family, 'curved');
  assert.ok(r.bodies[0].mesh.faces.every(f => f.kind === 'curved'));
  // The display mesh (8 segments per quarter) is a regular grid inscribed in the torus.
  assert.ok(Math.abs(signedVolume(r.bodies[0].mesh) - torus) < 2e-2 * torus, String(signedVolume(r.bodies[0].mesh)));
  // Cut away everything above z = 0 with a box: half the torus stays.
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [-40, -20], max: [40, 40] });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 30 });
  doc = withNode(doc, { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } });
  const cut = evaluateDoc(doc, 2);
  assert.ok(cut.ok, JSON.stringify(!cut.ok && cut.error));
  assert.equal(cut.bodies.length, 1);
  assert.ok(Math.abs(cut.bodies[0].volumeMM3! - torus / 2) < 3e-3 * torus, String(cut.bodies[0].volumeMM3));
  assert.ok(cut.bodies[0].mesh.faces.some(f => f.kind === 'plane'), 'the cut leaves flat faces');
  assert.equal(featureLabel(doc.nodes[1], 1, doc.nodes), 'Revolve 360°');
  // A half disc beside the axis turns into a sphere (poles), which a box then cuts.
  let ball = withNode(emptyDoc(), { kind: 'sketch', profile: 'loop', segments: [{ kind: 'arc', start: [0, -6], center: [0, 0], direction: 'ccw' }, { kind: 'line', start: [0, 6] }] });
  ball = withNode(ball, { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 });
  const sphere = evaluateDoc(ball, 5);
  assert.ok(sphere.ok && Math.abs(sphere.bodies[0].volumeMM3! - 288 * Math.PI) < 1e-9 * 288 * Math.PI, JSON.stringify(sphere.ok ? sphere.bodies[0].volumeMM3 : sphere.error));
  ball = withNode(ball, { kind: 'sketch', profile: 'rectangle', min: [-10, -10], max: [10, 10] });
  ball = withNode(ball, { kind: 'extrude', sketch: 2, height: 10, from: 3 });
  ball = withNode(ball, { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } });
  const capped = evaluateDoc(ball, 6), cap = Math.PI * 9 * (18 - 3) / 3;
  assert.ok(capped.ok && Math.abs(capped.bodies[0].volumeMM3! - (288 * Math.PI - cap)) < 3e-3 * 288 * Math.PI, JSON.stringify(capped.ok ? capped.bodies[0].volumeMM3 : capped.error));
  // A profile along the axis turns into a solid (a cylinder with disc ends); one across it is refused.
  const onAxis = evaluateDoc(withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [5, 5] }), { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 }), 3);
  assert.ok(onAxis.ok && Math.abs(onAxis.bodies[0].volumeMM3! - Math.PI * 125) < 1e-9 * Math.PI * 125, JSON.stringify(onAxis.ok ? onAxis.bodies[0].volumeMM3 : onAxis.error));
  const across = evaluateDoc(withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [-2, 0], max: [5, 5] }), { kind: 'revolve', sketch: 0, axis: 'y', angleDegrees: 360 }), 4);
  assert.equal(across.ok, false);
  if (!across.ok) assert.match(across.error.title, /can’t turn about this axis/);
});

test('a slot sketch extrudes as one line + arc body with two curved faces and exact mass', async () => {
  const { slotSegments } = await import('../src/sketch/profile');
  const doc = withNode(withNode(prefixDoc({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {} }, 0),
    { kind: 'sketch', profile: 'loop', segments: slotSegments([0, 0], [40, 0], 6) }), { kind: 'extrude', sketch: 0, height: 5 });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  const [body] = r.bodies;
  assert.equal(body.family, 'upright');
  assert.equal(body.mesh.faces.length, 6);
  assert.equal(body.mesh.faces.filter(f => f.kind === 'curved').length, 2);
  const exact = (480 + Math.PI * 36) * 5;
  assert.ok(Math.abs(body.volumeMM3! - exact) < 1e-8);
  assert.ok(Math.abs(signedVolume(body.mesh) - exact) / exact < 5e-3);
  // Tangent line/arc joints draw no seam: only the two cap outlines remain (as straight runs and arc polylines).
  const cap = (f: number) => body.mesh.faces[f].kind === 'plane' && Math.abs(body.mesh.faces[f].normal[2]) > 0.99;
  assert.ok(body.mesh.edges.every(e => e.faces.some(cap)));
});

test('a concave outline with an arc notch becomes a loop body; straight convex outlines stay polygons', async () => {
  const { outlineSegments, bulgeThrough } = await import('../src/sketch/profile');
  const points: [number, number][] = [[0, 0], [40, 0], [40, 20], [25, 20], [15, 20], [0, 20]];
  const bulges = [0, 0, 0, bulgeThrough([25, 20], [15, 20], [20, 15]), 0, 0];
  const segments = outlineSegments(points, bulges);
  assert.deepEqual(segments[3], { kind: 'arc', start: [25, 20], center: [20, 20], direction: 'cw' });
  const doc = withNode(withNode(prefixDoc({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {} }, 0),
    { kind: 'sketch', profile: 'loop', segments }), { kind: 'extrude', sketch: 0, height: 4 });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.ok(Math.abs(r.bodies[0].volumeMM3! - (800 - Math.PI * 12.5) * 4) < 1e-8);
});

test('the numerical solver keeps H/V edges, honours locked lengths and reports DOF', async () => {
  const { solveOutline } = await import('../src/sketch/profile');
  const rect: [number, number][] = [[0, 0], [40, 0], [40, 20], [0, 20]];
  const free = solveOutline(rect, {});
  assert.ok(free.ok); assert.equal(free.dof, 2);
  const locked = solveOutline(rect, { lengths: { 0: 50, 1: 25 } });
  assert.ok(locked.ok); assert.equal(locked.dof, 0);
  assert.deepEqual(locked.points, [[0, 0], [50, 0], [50, 25], [0, 25]]);
  const conflict = solveOutline(rect, { lengths: { 0: 50, 2: 30 } });
  assert.equal(conflict.ok, false);
});

test('arcs in the solver: tangent joints snap exact, a radius lock holds, DOF counts the centre', async () => {
  const { solveOutline, bulgeThrough, arcOf, inferTangents } = await import('../src/sketch/profile');
  // A 40 x 20 plate whose right side is a rough bulging arc drawn by hand (not tangent to anything).
  const points: [number, number][] = [[0, 0], [40, 0], [40, 20], [0, 20]];
  const bulges = [0, bulgeThrough([40, 0], [40, 20], [47, 10]), 0, 0];
  const free = solveOutline(points, {}, bulges);
  assert.ok(free.ok);
  // 4 points + 1 centre = 10 unknowns; anchor 2, H 2, V 1, equal radii 1 → 4 DOF.
  assert.equal(free.dof, 4);
  // Lock the radius to 10 and make both joints tangent: the arc becomes a semicircle bulging +x.
  assert.deepEqual(inferTangents(points, bulges), []);
  const locked = solveOutline(points, { radii: { 1: 10 }, tangents: [1, 2], lengths: { 0: 40 } }, bulges);
  assert.ok(locked.ok, !locked.ok ? locked.reason : '');
  const arc = arcOf(locked.points[1], locked.points[2], locked.bulges[1]);
  assert.ok(Math.abs(arc.radius - 10) < 1e-6, String(arc.radius));
  assert.ok(Math.abs(Math.abs(arc.sweep) - Math.PI) < 1e-6, String(arc.sweep));
  assert.deepEqual(locked.points, [[0, 0], [40, 0], [40, 20], [0, 20]]);
  // anchor 2 + H 2 + V 1 + equal radii 1 + radius 1 + tangents 2 + length 1 = 10 = unknowns.
  assert.equal(locked.dof, 0);
});

test('closing an outline infers near-tangent arc joints and settles them exact', async () => {
  const { settleShape } = await import('../src/sketch/settle');
  const { arcOf } = await import('../src/sketch/profile');
  // Arc from (40,0) to (40,20) nearly tangent to the bottom and top edges (bulge ≈ 1 = semicircle).
  const open = { kind: 'polygon' as const, points: [[0, 0], [40, 0], [40, 20], [0, 20]] as [number, number][], closed: false, bulges: [0, 0.97, 0, 0] };
  const r = settleShape({ ...open, closed: true }, open);
  assert.equal(r.error, null);
  const s = r.shape as typeof open & { tangents: number[] };
  assert.deepEqual(s.tangents, [1, 2]);
  const arc = arcOf(s.points[1], s.points[2], s.bulges[1]);
  assert.ok(Math.abs(Math.abs(arc.sweep) - Math.PI) < 1e-6);
  // An edit that cannot hold is undone: lock the bottom edge at 40 and the arc radius at 3 (chord is 20).
  const bad = settleShape({ ...s, lengths: { 0: 40, 3: 20 }, radii: { 1: 3 } }, s);
  assert.ok(bad.error); assert.equal(bad.shape, s);
});

test('equal radius and concentric arc pairs', async () => {
  const { solveOutline, bulgeThrough, arcOf, inferArcRelations } = await import('../src/sketch/profile');
  // Two hand-drawn end arcs of different radius (≈10.64 and ≈10.42).
  const points: [number, number][] = [[0, 0], [40, 0], [40, 20], [0, 20]];
  const bulges = [0, bulgeThrough([40, 0], [40, 20], [47, 10]), 0, bulgeThrough([0, 20], [0, 0], [-7.5, 10])];
  const free = solveOutline(points, {}, bulges), equal = solveOutline(points, { equalRadii: [[1, 3]] }, bulges);
  assert.ok(free.ok && equal.ok);
  assert.equal(equal.dof, free.dof - 1);
  const r = (s: typeof equal, i: number) => s.ok ? arcOf(s.points[i], s.points[(i + 1) % 4], s.bulges[i]).radius : NaN;
  assert.ok(Math.abs(r(equal, 1) - r(equal, 3)) < 1e-6, `${r(equal, 1)} vs ${r(equal, 3)}`);
  assert.deepEqual(inferArcRelations(points, bulges).equalRadii, [[1, 3]]);

  // An annular sector drawn with the inner arc's centre 1.3 mm off the outer one.
  const ring: [number, number][] = [[30, 0], [0, 30], [0, 15], [15, 0]];
  const ringBulges = [bulgeThrough([30, 0], [0, 30], [21.2132, 21.2132]), 0, bulgeThrough([0, 15], [15, 0], [10.9, 10.9]), 0];
  const before = [0, 2].map(i => arcOf(ring[i], ring[(i + 1) % 4], ringBulges[i]).center);
  assert.ok(Math.hypot(before[0][0] - before[1][0], before[0][1] - before[1][1]) > 0.5);
  assert.deepEqual(inferArcRelations(ring, ringBulges).concentric, [[0, 2]]);
  const solved = solveOutline(ring, { concentric: [[0, 2]] }, ringBulges);
  assert.ok(solved.ok, !solved.ok ? solved.reason : '');
  const after = [0, 2].map(i => arcOf(solved.points[i], solved.points[(i + 1) % 4], solved.bulges[i]).center);
  assert.ok(Math.hypot(after[0][0] - after[1][0], after[0][1] - after[1][1]) < 1e-5, JSON.stringify(after));
  // Concentric and equal radius together collapse the ring: the solver refuses instead of producing it.
  assert.equal(solveOutline(ring, { concentric: [[0, 2]], equalRadii: [[0, 2]] }, ringBulges).ok, false);
});

test('closing infers equal radii and shared centres; a loop with them still extrudes', async () => {
  const { settleShape } = await import('../src/sketch/settle');
  const { outlineSegments, bulgeThrough } = await import('../src/sketch/profile');
  const open = { kind: 'polygon' as const, points: [[30, 0], [0, 30], [0, 15], [15, 0]] as [number, number][], closed: false,
    bulges: [bulgeThrough([30, 0], [0, 30], [21.2132, 21.2132]), 0, bulgeThrough([0, 15], [15, 0], [10.9, 10.9]), 0] };
  const r = settleShape({ ...open, closed: true }, open);
  assert.equal(r.error, null);
  const s = r.shape as typeof open & { concentric: [number, number][] };
  assert.deepEqual(s.concentric, [[0, 2]]);
  const doc = withNode(withNode(prefixDoc({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {} }, 0),
    { kind: 'sketch', profile: 'loop', segments: outlineSegments(s.points, s.bulges) }), { kind: 'extrude', sketch: 0, height: 6 });
  const e = evaluateDoc(doc, 1);
  assert.ok(e.ok, JSON.stringify(!e.ok && e.error));
  assert.equal(e.bodies[0].mesh.faces.filter(f => f.kind === 'curved').length, 2);
});

test('sketch framing fits the rectangle into the free band between the panels', async () => {
  const { OrbitCamera } = await import('../src/viewport/camera');
  const W = 1440, H = 900, left = 64, right = 272;
  for (const [min, max] of [[[-20, -20], [100, 60]], [[0, 0], [400, 30]], [[5, 5], [6, 6]]] as [[number, number], [number, number]][]) {
    const cam = new OrbitCamera(); cam.distance = 5000; cam.target = [999, 999, 0];
    cam.aspect = W / H; cam.setView('top'); cam.frameRect(min, max, 8, left / W, right / W);
    const corners = [[min[0], min[1]], [max[0], min[1]], [max[0], max[1]], [min[0], max[1]]].map(([x, y]) => cam.project([x, y, 8], W, H));
    for (const [x, y] of corners) { assert.ok(x >= left - 1 && x <= W - right + 1, `x ${x}`); assert.ok(y >= 0 && y <= H, `y ${y}`); }
    const cx = cam.project([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, 8], W, H)[0];
    assert.ok(Math.abs(cx - (left + (W - right)) / 2) < 1, `centre ${cx}`);
  }
});
