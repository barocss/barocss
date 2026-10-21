import test from 'node:test';
import assert from 'node:assert/strict';
import { readRecovery, writeRecovery, RECOVERY_LIMIT } from '../src/app/recovery';
import type { ModelNode, StudioDoc } from '@barocss/cad-model/engine/doc';

// A browser's local storage, with a quota (in characters, as the browsers count) or refusing everything.
class Storage {
  map = new Map<string, string>(); quota = Infinity;
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { if (v.length > this.quota) throw new Error('QuotaExceededError'); this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}
const storage = new Storage();
(globalThis as unknown as { localStorage: Storage }).localStorage = storage;
const doc = (nodes: unknown[]) => ({ format: 'barocss-cad-model', version: 3, nodes: nodes as ModelNode[] } as unknown as StudioDoc);
const small = doc([{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }]);

test('recovery (D82 B13 follow-up): a copy past the limit, or one the browser refuses, removes the older copy instead of leaving it to be offered back as the latest', () => {
  assert.equal(writeRecovery('Part', small), 'ok');
  assert.deepEqual(readRecovery()?.doc, small);
  // The document grows past the limit: nothing kept — not the small copy of before.
  const big = doc([{ kind: 'mesh', name: 'm', unit: 'mm', positions: Array.from({ length: Math.ceil(RECOVERY_LIMIT / 2) }, (_, i) => i % 10), indices: [0, 1, 2] }]);
  assert.equal(writeRecovery('Part', big), 'too-large');
  assert.equal(readRecovery(), null);
  // Small again: kept again.
  assert.equal(writeRecovery('Part', small), 'ok');
  assert.ok(readRecovery());
  // The browser refuses (storage full): the older copy goes too.
  storage.quota = 10;
  assert.equal(writeRecovery('Part', doc([{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [11, 10] }])), 'refused');
  assert.equal(readRecovery(), null);
});
