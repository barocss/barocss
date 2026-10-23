import test from 'node:test';
import assert from 'node:assert/strict';
import { offerRecovery, readRecovery, settleRecovery, writeRecovery, RECOVERY_LIMIT } from '../src/app/recovery';
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

test('the copy offered at start is set aside until answered: the new session\'s copies do not write over it, Discard (settle) removes it and not the work since; of two, the newer is offered', () => {
  storage.quota = Infinity; storage.map.clear();
  const before = doc([{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [1, 1] }]), since = doc([{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [2, 2] }]);
  assert.equal(writeRecovery('Old', before), 'ok');
  // (The studio starts: the copy is offered and moved aside.)
  const offered = offerRecovery();
  assert.deepEqual([offered?.fileName, offered?.doc], ['Old', before]);
  assert.equal(readRecovery(), null, 'the session\'s key is free');
  // (The person works on a new part before answering: its copy is kept beside the offered one.)
  assert.equal(writeRecovery('Untitled', since), 'ok');
  assert.equal(readRecovery()?.fileName, 'Untitled');
  // (A reload before answering: the newer of the two is offered — the work since.)
  assert.equal(offerRecovery()?.fileName, 'Untitled');
  // (Answered: set aside no more; nothing offered next time.)
  settleRecovery();
  assert.equal(offerRecovery(), null);
  // (Discard after new work: the new work's copy, written after it, is untouched.)
  assert.equal(writeRecovery('Old', before), 'ok'); offerRecovery(); assert.equal(writeRecovery('Untitled', since), 'ok');
  settleRecovery();
  assert.deepEqual(readRecovery()?.doc, since);
});

test('O9 (REVIEW-A1): the blobs are kept before the copy that names them; blobs refused, no copy (the older one removed); an overtaken call writes nothing', async () => {
  const { keepRecovery } = await import('../src/app/recovery');
  storage.map.clear(); storage.quota = Infinity;
  const order: string[] = [];
  const saved = async () => { order.push(`blobs (copy there: ${readRecovery() ? 'yes' : 'no'})`); return true; };
  assert.equal(await keepRecovery('Part', small, saved), 'ok');
  assert.deepEqual(order, ['blobs (copy there: no)'], 'the blobs first, while no copy names them');
  assert.deepEqual(readRecovery()?.doc, small);
  // (The blob store refuses: the copy is not written, and the one before is removed — never offered without its meshes.)
  assert.equal(await keepRecovery('Part', small, async () => false), 'refused');
  assert.equal(readRecovery(), null);
  assert.equal(await keepRecovery('Part', small, async () => { throw new Error('IndexedDB gone'); }), 'refused');
  // (Two calls, the first slower to store its blobs: only the newer writes.)
  const older = doc([{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [1, 1] }]), newer = doc([{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [2, 2] }]);
  let release!: (v: boolean) => void;
  const slow = keepRecovery('Part', older, () => new Promise<boolean>(res => { release = res; }));
  assert.equal(await keepRecovery('Part', newer, async () => true), 'ok');
  release(true);
  assert.equal(await slow, 'overtaken');
  assert.deepEqual(readRecovery()?.doc, newer, 'the newer copy stays');
  // (The work saved while its blobs were stored: no copy written after it.)
  storage.map.clear();
  let savedMeanwhile = false;
  assert.equal(await keepRecovery('Part', newer, async () => { savedMeanwhile = true; return true; }, () => !savedMeanwhile), 'overtaken');
  assert.equal(readRecovery(), null);
});
