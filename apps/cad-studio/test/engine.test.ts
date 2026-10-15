import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { cylinderPart, leafBodies, prefixDoc, rectanglePart, starterDoc, withNode } from '../src/engine/doc';
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

test('pattern keeps the parent and adds copies; rollback evaluates a prefix', () => {
  let doc = rectanglePart(20, 10, 5);
  doc = withNode(doc, { kind: 'linear-pattern', parent: { node: 1, side: 'solid' }, axis: 'x', spacing: 30, count: 3 });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  assert.equal(r.bodies.length, 3);
  const rolled = evaluateDoc(prefixDoc(doc, 2), 2);
  assert.ok(rolled.ok);
  assert.equal(rolled.bodies.length, 1);
});

test('kernel refusals come back as plain-language errors', () => {
  const doc = withNode(rectanglePart(100, 60, 5), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [6, 6], radius: 3 });
  const r = evaluateDoc(doc, 1);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.error.title, /size isn’t supported/);
    assert.match(r.error.detail, /pole chart/);
  }
});

test('a slot sketch extrudes as one line + arc body with two curved faces and exact mass', async () => {
  const { slotSegments } = await import('../src/sketch/profile');
  const doc = withNode(withNode(prefixDoc({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: {}, nodes: [], outputs: {} }, 0),
    { kind: 'sketch', profile: 'loop', segments: slotSegments([0, 0], [40, 0], 6) }), { kind: 'extrude', sketch: 0, height: 5 });
  const r = evaluateDoc(doc, 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  const [body] = r.bodies;
  assert.equal(body.family, 'extruded-profile');
  assert.equal(body.mesh.faces.length, 6);
  assert.equal(body.mesh.faces.filter(f => f.kind === 'curved').length, 2);
  const exact = (480 + Math.PI * 36) * 5;
  assert.ok(Math.abs(body.volumeMM3! - exact) < 1e-8);
  assert.ok(Math.abs(signedVolume(body.mesh) - exact) / exact < 5e-3);
  // Tangent line/arc joints draw no seam: only the two cap outlines remain (as straight runs and arc polylines).
  assert.ok(body.mesh.edges.every(e => e.faces.includes(0) || e.faces.includes(1)));
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
