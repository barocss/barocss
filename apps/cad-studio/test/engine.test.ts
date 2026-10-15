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
  const locked = solveOutline(rect, { 0: 50, 1: 25 });
  assert.ok(locked.ok); assert.equal(locked.dof, 0);
  assert.deepEqual(locked.points, [[0, 0], [50, 0], [50, 25], [0, 25]]);
  const conflict = solveOutline(rect, { 0: 50, 2: 30 });
  assert.equal(conflict.ok, false);
});
