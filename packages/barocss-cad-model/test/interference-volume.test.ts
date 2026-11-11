import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { evaluateVolumes } from '../src/engine/evaluate';
import type { P2 } from '../src/sketch/profile';

function prism(doc: StudioDoc, points: P2[], from: number) {
  const sketch = doc.nodes.length;
  doc = withNode(doc, { kind: 'sketch', profile: 'loop', segments: points.map(start => ({ kind: 'line', start })) });
  return withNode(doc, { kind: 'extrude', sketch, height: 3, from });
}

test('the volume producer explicitly identifies an evaluated terminal empty intersection', () => {
  let doc = prism(emptyDoc(), [[0, 0], [4, 0], [0, 4]], 0);
  doc = prism(doc, [[1, 4], [4, 1], [4, 4]], 1);
  doc = prism(doc, [[20, 20], [24, 20], [20, 24]], 0);
  const node = { kind: 'intersect' as const, left: { node: 1, side: 'solid' as const }, right: { node: 3, side: 'solid' as const } };
  const probe = withNode(doc, node);
  const result = evaluateVolumes(probe, 'probe', 6);
  assert.ok(result.ok);
  assert.equal(result.emptyIntersection, 'b6');
  assert.deepEqual(result.volumes.map(row => row.key), ['b5']);
  assert.ok(Math.abs(result.volumes[0].volume! - 24) < 1e-7);
  for (const other of [
    evaluateVolumes(probe), evaluateVolumes(probe, 'probe', 5),
    evaluateVolumes(doc, 'probe', 5),
    evaluateVolumes(withNode(doc, { ...node, suppressed: true }), 'probe', 6),
  ]) {
    assert.ok(other.ok);
    assert.equal(other.emptyIntersection, undefined);
  }
});

test('a material intersection keeps its volume row and has no empty marker', () => {
  let doc = prism(emptyDoc(), [[0, 0], [4, 0], [0, 4]], 0);
  doc = prism(doc, [[0, 0], [4, 0], [0, 4]], 1);
  const probe = withNode(doc, { kind: 'intersect', left: { node: 1, side: 'solid' }, right: { node: 3, side: 'solid' } });
  const result = evaluateVolumes(probe, 'probe', 4);
  assert.ok(result.ok);
  assert.equal(result.emptyIntersection, undefined);
  assert.equal(result.volumes[0].key, 'b4');
  assert.ok(Math.abs(result.volumes[0].volume! - 16) < 1e-7);
});
