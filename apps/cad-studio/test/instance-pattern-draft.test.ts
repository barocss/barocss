import test from 'node:test';
import assert from 'node:assert/strict';
import type { InstancePattern } from '@barocss/cad-model/engine/doc';
import { axisOf, draftOf, patternEdit } from '../src/ui/InstancePattern';

// Row 10 ③ audit 1 (#9): the pattern panel's Apply sends a direction or an axis only when the choice changed; one a chat
// or a file made (-X, a diagonal) shows as Custom and stays as it is.
const linear = (dir: [number, number, number]): InstancePattern => ({ id: 'pat1', seed: 'p1', kind: 'linear', count: 4, dir, spacing: 20 });

test('axisOf: exactly +X, +Y or +Z is that axis, anything else Custom', () => {
  assert.deepEqual([[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, 3, 4], [2, 0, 0]].map(v => axisOf(v)), ['X', 'Y', 'Z', 'Custom', 'Custom', 'Custom']);
});

test('Apply: a count change alone sends no dir or axis, so a chat-made direction survives; choosing an axis sends it', () => {
  for (const dir of [[-1, 0, 0], [0, 3, 4]] as [number, number, number][]) {
    const p = linear(dir), draft = { ...draftOf(p), count: '6' };
    assert.deepEqual(patternEdit(p, draft), { id: 'pat1', count: 6, spacing: 20 });
    assert.deepEqual(patternEdit(p, { ...draft, axis: 'Z' }), { id: 'pat1', count: 6, spacing: 20, dir: [0, 0, 1] });
  }
  const x = linear([1, 0, 0]);
  assert.deepEqual(patternEdit(x, { ...draftOf(x), axis: 'Y' }), { id: 'pat1', count: 4, spacing: 20, dir: [0, 1, 0] });
  const c: InstancePattern = { id: 'pat2', seed: 'p1', kind: 'circular', count: 3, angle: 90, axis: [0, 0, 1], origin: [5, 0, 0] };
  assert.deepEqual(patternEdit(c, draftOf(c)), { id: 'pat2', count: 3, angle: 90 }, 'the origin and the axis are left as they are');
  assert.deepEqual(patternEdit(c, { ...draftOf(c), axis: 'X' }), { id: 'pat2', count: 3, angle: 90, axis: [1, 0, 0] });
});
