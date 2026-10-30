import test from 'node:test';
import assert from 'node:assert/strict';
import { skeletonSessionNode } from '../src/skeleton/useSkeletonEditor';

test('3D sketch Apply preserves the existing feature identity and metadata while replacing geometry', () => {
  const previous = { kind: 'skeleton' as const, id: 'n7', name: 'datum', suppressed: true as const, bought: false, points: [[0, 0, 0]] as [number, number, number][], segments: [] as [number, number][], constraints: [{ kind: 'fixed' as const, point: 0 }] };
  const session = { node: 2, name: 'datum', draft: { points: [[1, 2, 3]] as [number, number, number][], segments: [] as [number, number][], constraints: [] } };
  const before = structuredClone(previous), draft = structuredClone(session);
  const next = skeletonSessionNode(session, previous);
  assert.equal(next.id, 'n7'); assert.equal(next.name, 'datum'); assert.equal(next.suppressed, true); assert.equal(next.bought, false);
  assert.deepEqual(next.points, [[1, 2, 3]]); assert.deepEqual(next.segments, []);
  assert.equal(Object.hasOwn(next, 'constraints'), false, 'removing all constraints does not keep the old list');
  assert.notEqual(next.points, session.draft.points); assert.notEqual(next.points[0], session.draft.points[0]);
  assert.deepEqual(previous, before); assert.deepEqual(session, draft);
});
