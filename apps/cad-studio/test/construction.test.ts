import test from 'node:test';
import assert from 'node:assert/strict';
import { profileOf } from '@barocss/cad-model/sketch/loops';
import { sketchShapes } from '@barocss/cad-model/sketch/reopen';
import { toPartDocument } from '@barocss/cad-model/engine/part';
import { emptyDoc, withNode, type SketchNode } from '@barocss/cad-model/engine/doc';

test('construction shapes are no part of the profile, are kept with the sketch and come back on reopen', () => {
  const rect = { kind: 'rectangle' as const, a: [0, 0] as [number, number], b: [20, 10] as [number, number] };
  const ref = { kind: 'polygon' as const, points: [[0, 0], [20, 10]] as [number, number][], closed: false, construction: true as const };
  const p = profileOf([ref, rect]); assert.ok(!('error' in p));
  assert.equal(p.node.profile, 'rectangle');
  assert.ok('error' in profileOf([ref]), 'references alone are no profile');
  const node = { ...p.node, construction: [ref] } as SketchNode;
  assert.deepEqual(sketchShapes(node).done, [ref]);
  // The kernel never sees them.
  const part = toPartDocument(withNode(emptyDoc(), node)) as unknown as { features: Record<string, unknown>[] };
  assert.ok(part.features.every(f => !('construction' in f)));
});
