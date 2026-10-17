import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart, withNode } from '../src/engine/doc';
import { deleteFeature, deleteFeatures, featureDependents } from '../src/chat/features';

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
