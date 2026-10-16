import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { cylinderPart, emptyDoc, rectanglePart, withNode } from '../src/engine/doc';
import { measureBetween, measureItem } from '../src/app/measure';
import type { DisplayMesh } from '../src/engine/mesh';

const meshOf = (doc: Parameters<typeof evaluateDoc>[0]): DisplayMesh => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies[0].mesh; };
const faceBy = (m: DisplayMesh, pred: (n: [number, number, number]) => boolean) => m.faces.findIndex(f => f.kind === 'plane' && pred(f.normal));
// (Display meshes are float32: about 1e-6 relative.)
const near = (a: number, b: number, eps = 1e-4) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));

test('measure: parallel faces give their gap and normal distance; touching faces 0 at 90°', () => {
  const m = meshOf(rectanglePart(60, 40, 20));
  const top = faceBy(m, n => n[2] > 0.99), bottom = faceBy(m, n => n[2] < -0.99), side = faceBy(m, n => Math.abs(n[0]) > 0.99);
  const gap = measureBetween(m, { body: 0, face: top }, m, { body: 0, face: bottom });
  assert.ok(near(gap.distance, 20) && near(gap.normalDistance!, 20) && near(gap.angle!, 0), JSON.stringify(gap));
  const corner = measureBetween(m, { body: 0, face: top }, m, { body: 0, face: side });
  assert.ok(near(corner.distance, 0) && near(corner.angle!, 90) && corner.normalDistance === undefined, JSON.stringify(corner));
  // An edge alone: its length; a face alone: its area.
  const e = m.edges.findIndex(x => x.axis === 'x');
  const el = measureItem(m, { body: 0, edge: e }); assert.ok(near(el.length!, 60), JSON.stringify(el));
  assert.ok(near(measureItem(m, { body: 0, face: top }).area!, 2400, 1e-3));
});

test('measure: a cylinder face shows its radius, its rim an arc of that radius and length', () => {
  const m = meshOf(cylinderPart(5, 10));
  const wall = m.faces.findIndex(f => f.kind === 'curved');
  assert.ok(near(m.faces[wall].radius!, 5), String(m.faces[wall].radius));
  const rim = m.edges.findIndex(x => !x.straight), it = measureItem(m, { body: 0, edge: rim });
  assert.equal(it.label, 'Arc', JSON.stringify(it));
  assert.ok(near(it.radius!, 5, 1e-3), String(it.radius));
  // The rim's length is the circle's (r·θ over its samples), not the shorter display polyline.
  assert.ok(near(it.length!, 2 * Math.PI * 5, 1e-5), String(it.length));
});

test('errors: a too-steep draft and a zero angle name their cause', async () => {
  const { friendly } = await import('../src/engine/errors');
  assert.equal(friendly('n1: the draft closes a straight wall before the top (steeper than the profile allows)').title, 'The draft is too steep for this height');
  assert.equal(friendly('n1: angleDegrees must be in (0, 360]').title, 'The angle must be between 1° and 360°');
});

test('measure: between two bodies, the closest points span the gap', () => {
  let doc = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] });
  doc = withNode(doc, { kind: 'extrude', sketch: 0, height: 10 });
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [25, 3], max: [35, 13] });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 10 });
  const r = evaluateDoc(doc, 1); assert.ok(r.ok);
  const [a, b] = r.bodies.map(x => x.mesh);
  const right = faceBy(a, n => n[0] > 0.99), left = faceBy(b, n => n[0] < -0.99);
  const d = measureBetween(a, { body: 0, face: right }, b, { body: 1, face: left });
  assert.ok(near(d.distance, 15) && near(d.normalDistance!, 15) && near(d.b[0] - d.a[0], 15), JSON.stringify(d));
});
