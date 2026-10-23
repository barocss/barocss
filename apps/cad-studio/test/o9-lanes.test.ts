import test from 'node:test';
import assert from 'node:assert/strict';
import { isStale, Lanes } from '../src/engine/lanes';

// O9: a reply overtaken on its lane comes back stale, never as a result, whatever order the replies arrive in; lanes
// apart do not supersede each other; a request not overtaken comes back as it is (a stopped worker's refusal too).

const later = <T>(value: T, ms: number) => new Promise<T>(res => setTimeout(() => res(value), ms));

test('O9 lanes: the slow older preview comes back stale after the fast newer one; a lone request is its own result', async () => {
  const lanes = new Lanes();
  const slow = lanes.run('preview', () => later('old', 30)), fast = lanes.run('preview', () => later('new', 5));
  const [a, b] = await Promise.all([slow, fast]);
  assert.ok(isStale(a)); assert.equal((a as { lane: string }).lane, 'preview'); assert.equal(b, 'new');
  assert.equal(await lanes.run('preview', () => later('alone', 1)), 'alone');
});

test('O9 lanes: one placed part\'s bodies do not supersede another\'s; the same part\'s newer request does', async () => {
  const lanes = new Lanes();
  const p1 = lanes.run('placed:inst1', () => later('i1', 20)), p2 = lanes.run('placed:inst2', () => later('i2', 5)), p1b = lanes.run('placed:inst1', () => later('i1b', 10));
  const [r1, r2, r1b] = await Promise.all([p1, p2, p1b]);
  assert.ok(isStale(r1)); assert.equal(r2, 'i2'); assert.equal(r1b, 'i1b');
});

test('O9 lanes: an older reply arriving first is still stale once a newer request was sent', async () => {
  const lanes = new Lanes();
  let release!: (v: string) => void;
  const old = lanes.run('drawing', () => new Promise<string>(res => { release = res; }));
  const newer = lanes.run('drawing', () => later('views v2', 20));
  release('views v1');
  assert.ok(isStale(await old)); assert.equal(await newer, 'views v2');
  // (A request whose worker stopped still comes back, as the worker's refusal: the lane is its own until overtaken.)
  assert.equal(await lanes.run('section', () => later('Stopped', 5)), 'Stopped');
});
