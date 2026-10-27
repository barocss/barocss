import test from 'node:test';
import assert from 'node:assert/strict';
import { Lanes, type LaneReply } from '../src/engine/lanes';

// O9: a reply overtaken on its lane comes back stale, never as a result, whatever order the replies arrive in; lanes
// apart do not supersede each other; a request not overtaken comes back as it is (a stopped worker's refusal too). The
// reply is a discriminated union: the result is reachable only after `stale` is looked at.

const later = <T>(value: T, ms: number) => new Promise<T>(res => setTimeout(() => res(value), ms));
const asked = (revision: number) => ({ revision, source: `key-${revision}` });
const resultOf = <T>(r: LaneReply<T>) => r.stale ? 'stale' : r.result;

test('O9 lanes: the slow older preview comes back stale after the fast newer one; a lone request is its own result, with what it was asked of', async () => {
  const lanes = new Lanes();
  const slow = lanes.run('preview', asked(1), () => later('old', 30)), fast = lanes.run('preview', asked(2), () => later('new', 5));
  const [a, b] = await Promise.all([slow, fast]);
  assert.deepEqual(a, { stale: true, lane: 'preview', revision: 1 });
  assert.deepEqual(b, { stale: false, lane: 'preview', revision: 2, source: 'key-2', result: 'new' });
  assert.equal(resultOf(await lanes.run('preview', asked(3), () => later('alone', 1))), 'alone');
});

test('O9 lanes: one placed part\'s bodies do not supersede another\'s; the same part\'s newer request does', async () => {
  const lanes = new Lanes();
  const p1 = lanes.run('placed:inst1', asked(1), () => later('i1', 20)), p2 = lanes.run('placed:inst2', asked(2), () => later('i2', 5)), p1b = lanes.run('placed:inst1', asked(3), () => later('i1b', 10));
  assert.deepEqual((await Promise.all([p1, p2, p1b])).map(resultOf), ['stale', 'i2', 'i1b']);
});

test('O9 lanes: an older reply arriving first is still stale once a newer request was sent; two parts\' drawings apart', async () => {
  const lanes = new Lanes();
  let release!: (v: string) => void;
  const old = lanes.run('drawing:base', asked(1), () => new Promise<string>(res => { release = res; }));
  const newer = lanes.run('drawing:base', asked(2), () => later('views v2', 20)), other = lanes.run('drawing:inst1', asked(3), () => later('its views', 5));
  release('views v1');
  assert.deepEqual([resultOf(await old), resultOf(await newer), resultOf(await other)], ['stale', 'views v2', 'its views']);
  // (A request whose worker stopped still comes back, as the worker's refusal: the lane is its own until overtaken.)
  assert.equal(resultOf(await lanes.run('section:view', asked(4), () => later('Stopped', 5))), 'Stopped');
});

test('R4b lanes: cancel makes every request waiting on its lane come back stale, others untouched; a later request is current', async () => {
  const lanes = new Lanes();
  const a = lanes.run('cage', asked(1), () => later('a', 10)), b = lanes.run('section:front', asked(1), () => later('b', 10));
  lanes.cancel('cage');
  assert.deepEqual([resultOf(await a), resultOf(await b)], ['stale', 'b']);
  assert.equal(resultOf(await lanes.run('cage', asked(2), () => later('c', 1))), 'c');
  lanes.cancel('nothing waiting'); // (a lane with no request: nothing to make stale)
});
