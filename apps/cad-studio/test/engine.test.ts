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
