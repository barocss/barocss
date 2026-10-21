import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, rectanglePart, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { bodyName, lastFeature, lookKey, lookOf, rootOf, withLook } from '@barocss/cad-model/app/bodies';
import { deleteFeature } from '@barocss/cad-model/chat/features';

const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok); return r.bodies; };

test('a body’s look stays with it as features are added, and as features before it are deleted (A1.1b)', () => {
  let doc = rectanglePart(40, 20, 8);
  const [plate] = bodiesOf(doc);
  doc = withLook(doc, plate, { color: '#4a90d9', name: 'Base plate' });
  assert.deepEqual(doc.bodies, { b1: { color: '#4a90d9', name: 'Base plate' } });
  doc = withNode(doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 10], radius: 3 });
  const [holed] = bodiesOf(doc);
  assert.equal(holed.key, 'b2');
  assert.equal(rootOf(doc.nodes, 2), 1);
  assert.equal(lookKey(doc.nodes, holed), 'b1');
  assert.deepEqual([lookOf(doc, holed).color, bodyName(doc, holed), lastFeature(doc, holed)], ['#4a90d9', 'Base plate', 'Hole Ø6']);
  // A box before the plate, then deleted: the look stays keyed by the plate's stable id (A1.1b), with the plate.
  let two = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [80, 0], radius: 4 }), { kind: 'extrude', sketch: 0, height: 4 });
  two = withNode(withNode(two, { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [40, 20] }), { kind: 'extrude', sketch: 2, height: 8 });
  two = withLook(two, bodiesOf(two).find(b => b.key === 'b3')!, { color: '#4a90d9', name: 'Base plate' });
  const r = deleteFeature(two, 1);
  assert.ok(!('error' in r));
  assert.deepEqual(r.doc.bodies, { b3: { color: '#4a90d9', name: 'Base plate' } });
  const [kept] = bodiesOf(r.doc);
  assert.deepEqual([kept.key, bodyName(r.doc, kept)], ['b3', 'Base plate']);
  // Cleared fields go; an empty look leaves no entry.
  const plain = withLook(withLook(doc, holed, { color: undefined }), holed, { name: '' });
  assert.equal(plain.bodies, undefined);
});

test('a body’s steps: its features from first to last, a several-step shape as one', async () => {
  const { bodySteps } = await import('@barocss/cad-model/app/bodies');
  const { commands } = await import('@barocss/cad-model/app/commands');
  let doc = withNode(withNode(rectanglePart(40, 20, 8), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 10], radius: 3 }), { kind: 'translate', parent: { node: 2, side: 'solid' }, offset: [1, 0, 0] });
  assert.deepEqual(bodySteps(doc.nodes, 3), [1, 2, 3]);
  const f = commands.find(c => c.id === 'fastener')!, blank = { doc: { ...doc, nodes: [] }, bodies: [], selection: { faces: [], edges: [], bodies: [] } };
  doc = f.build!(blank, { ...f.defaults!(blank), x: 0, y: 0, z: 0 });
  assert.deepEqual(bodySteps(doc.nodes, doc.nodes.length - 1), [doc.nodes.length - 1], 'a bolt is one step');
});
