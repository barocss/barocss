import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart, withNode } from '@barocss/cad-model/engine/doc';
import { deleteFeature, deleteFeatures, featureDependents } from '@barocss/cad-model/chat/features';

test('dependents: what is built on a feature, directly, through others and by naming its edges', () => {
  let doc = rectanglePart(32, 32, 8);
  doc = withNode(doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [16, 16], radius: 3 });
  doc = withNode(doc, { kind: 'chamfer', parent: { node: 2, side: 'solid' }, edges: ['n1.side0|n1.top'], distance: 1 });
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [40, 0], max: [50, 10] });
  doc = withNode(doc, { kind: 'extrude', sketch: 4, height: 5 });
  assert.deepEqual(featureDependents(doc, 1), [2, 3]);
  assert.deepEqual(featureDependents(doc, 2), [3]);
  assert.deepEqual(featureDependents(doc, 5), []);
  assert.ok('error' in deleteFeature(doc, 1), 'refused alone');
  const r = deleteFeatures(doc, [1, ...featureDependents(doc, 1)]);
  assert.ok('doc' in r);
  assert.deepEqual(r.doc.nodes.map(n => n.kind), ['sketch', 'extrude'], 'the other block stays');
});

test('reorder: a step moves past one it does not depend on, names kept (A1); not before what it is built on', async () => {
  const { moveFeature } = await import('@barocss/cad-model/chat/features');
  const { evaluateDoc } = await import('@barocss/cad-model/engine/evaluate');
  let doc = rectanglePart(32, 32, 8);                                                                              // 0, 1
  doc = withNode(doc, { kind: 'chamfer', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], distance: 1 }); // 2
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [40, 0], max: [50, 10] });                      // 3
  doc = withNode(doc, { kind: 'extrude', sketch: 3, height: 5 });                                                   // 4
  const vols = (d: typeof doc) => { const r = evaluateDoc(d, 1); assert.ok(r.ok); return r.bodies.map(b => Math.round(b.volumeMM3!)).sort((a, b) => a - b); };
  const before = vols(doc);
  const once = moveFeature(doc, 4, -1);
  assert.ok('doc' in once);
  assert.deepEqual(once.doc.nodes.map(n => n.kind), ['sketch', 'extrude', 'sketch', 'extrude', 'chamfer'], 'the block with its sketch before the chamfer');
  const twice = moveFeature(once.doc, 3, -1);
  assert.ok('doc' in twice);
  const ch = twice.doc.nodes[4] as { parent: { node: number }; edges: string[] };
  assert.deepEqual([ch.parent.node, ch.edges[0]], [3, 'n1.side0|n1.top'], 'the chamfer follows its plate by its new number; the edge keeps its name');
  assert.deepEqual(twice.doc.nodes.map(n => n.id), ['n3', 'n4', 'n0', 'n1', 'n2'], 'each feature keeps its id');
  assert.deepEqual(vols(twice.doc), before);
  assert.match((moveFeature(doc, 2, -1) as { error: string }).error, /built on/);
  assert.match((moveFeature(doc, 1, 1) as { error: string }).error, /built on/);
});
