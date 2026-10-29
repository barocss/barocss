import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { handleStore, type DirHandle, type FileHandle } from '../src/storage/handleStore';

const enc = (text: string) => new TextEncoder().encode(text);
const dec = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
function latch() { let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; }); return { wait, release }; }
type Hooks = { create?(path: string): Promise<void>; write?(path: string): Promise<void>; close?(path: string): Promise<void>; read?(path: string): Promise<void>; abort?(): Promise<void> };
function directory(hooks: Hooks = {}) {
  const files = new Map<string, { bytes: Uint8Array; time: number }>(), events: string[] = [], commits: { path: string; tag: string; text: string }[] = [];
  let clock = 1;
  const root: DirHandle = {
    kind: 'directory', name: 'P',
    async getDirectoryHandle() { return root; },
    async getFileHandle(path, options = {}) {
      if (!files.has(path)) {
        if (!options.create) throw Object.assign(new Error('missing'), { name: 'NotFoundError' });
        files.set(path, { bytes: enc(''), time: clock++ });
      }
      const handle: FileHandle = {
        kind: 'file', name: path,
        async getFile() {
          await hooks.read?.(path);
          const file = files.get(path)!;
          return { size: file.bytes.length, lastModified: file.time, async arrayBuffer() { return file.bytes.slice().buffer; } };
        },
        async createWritable() {
          events.push(`create:${path}`); await hooks.create?.(path);
          let staged = enc('');
          return {
            async write(bytes) { events.push(`write:${path}`); await hooks.write?.(path); staged = bytes.slice(); },
            async close() { events.push(`close:${path}`); await hooks.close?.(path); const time = clock++; files.set(path, { bytes: staged, time }); commits.push({ path, tag: `${staged.length}-${time}`, text: dec(staged) }); },
            async abort() { events.push(`abort:${path}`); await hooks.abort?.(); },
          };
        },
      };
      return handle;
    },
    async removeEntry(path) { files.delete(path); },
    async *entries() { /* Listing is outside these write-ownership tests. */ },
  };
  return { root, events, commits, seed(path: string, text: string) { files.set(path, { bytes: enc(text), time: clock++ }); } };
}
const admissions = (events: string[], path: string) => events.filter(event => event === `create:${path}`).length;

test('same-path stale writers validate only after the preceding native stream and tag read finish', async () => {
  const entered = latch(), release = latch(), closed = latch(); let first = true;
  const fs = directory({ async create() { if (first) { first = false; entered.release(); await release.wait; } else await closed.wait; }, async close() { closed.release(); } });
  fs.seed('a', 'seed'); const store = handleStore(fs.root, 'browser'), tag = (await store.read('a'))!.tag;
  const a = store.write('a', enc('first-longer'), { expect: tag }); await entered.wait;
  const b = store.write('a', enc('second-even-longer'), { expect: tag });
  // A correct queue never admits stream B here. Do not wait for a both-admitted barrier.
  let result: PromiseSettledResult<{ tag: string }>[];
  try { await turn(); assert.equal(admissions(fs.events, 'a'), 1); }
  finally { release.release(); result = await Promise.allSettled([a, b]); }
  assert.equal(result[0].status, 'fulfilled'); assert.equal(result[1].status, 'rejected');
  if (result[1].status === 'rejected') assert.equal(result[1].reason.code, 'STORAGE_CHANGED');
  assert.equal(dec((await store.read('a'))!.bytes), 'first-longer');
});

test('two expected-absent creates admit one owner; stale serial writes refuse and a fresh returned tag remains usable', async () => {
  const fs = directory(), store = handleStore(fs.root, 'browser');
  const created = await Promise.allSettled([store.write('a', enc('first'), { expect: null }), store.write('a', enc('second'), { expect: null })]);
  assert.equal(created[0].status, 'fulfilled'); assert.equal(created[1].status, 'rejected');
  if (created[1].status === 'rejected') assert.equal(created[1].reason.code, 'STORAGE_CHANGED');
  const first = (await store.read('a'))!;
  const next = await store.write('a', enc('fresh-longer'), { expect: first.tag });
  await assert.rejects(store.write('a', enc('stale'), { expect: first.tag }), { code: 'STORAGE_CHANGED' });
  assert.equal(dec((await store.read('a'))!.bytes), 'fresh-longer');
  const final = await store.write('a', enc('fresh-again'), { expect: next.tag });
  assert.equal(final.tag, (await store.read('a'))!.tag);
});

for (const conditionalFirst of [true, false]) test(`unconditional writes share the same exclusion (${conditionalFirst ? 'conditional first' : 'unconditional first'})`, async () => {
  const entered = latch(), release = latch(); let first = true;
  const fs = directory({ async create() { if (first) { first = false; entered.release(); await release.wait; } } });
  fs.seed('a', 'seed'); const store = handleStore(fs.root, 'folder'), tag = (await store.read('a'))!.tag;
  const a = store.write('a', enc('first-longer'), conditionalFirst ? { expect: tag } : {}); await entered.wait;
  const b = store.write('a', enc('second-longer'), conditionalFirst ? {} : { expect: tag });
  let result: PromiseSettledResult<{ tag: string }>[];
  try { await turn(); assert.equal(admissions(fs.events, 'a'), 1); }
  finally { release.release(); result = await Promise.allSettled([a, b]); }
  assert.equal(result[0].status, 'fulfilled'); assert.equal(result[1].status, conditionalFirst ? 'fulfilled' : 'rejected');
  if (result[1].status === 'rejected') assert.equal(result[1].reason.code, 'STORAGE_CHANGED');
  assert.equal(dec((await store.read('a'))!.bytes), conditionalFirst ? 'second-longer' : 'first-longer');
});

test('different paths remain independent while one native write is held', async () => {
  const entered = latch(), release = latch();
  const fs = directory({ async create(path) { if (path === 'a') { entered.release(); await release.wait; } } }), store = handleStore(fs.root, 'browser');
  const a = store.write('a', enc('held')); await entered.wait;
  let finished = false; const b = store.write('b', enc('independent')).then(value => { finished = true; return value; });
  try { await turn(); assert.equal(finished, true); }
  finally { release.release(); await Promise.all([a, b]); }
  assert.equal(dec((await store.read('b'))!.bytes), 'independent');
});

test('the returned tag belongs to its own commit even when an unconditional writer is already waiting', async () => {
  const tagRead = latch(), release = latch(); let hold = true;
  const fs = directory({ async read() { if (fs.commits.length === 1 && hold) { hold = false; tagRead.release(); await release.wait; } } }), store = handleStore(fs.root, 'browser');
  const a = store.write('a', enc('first')); await tagRead.wait;
  const b = store.write('a', enc('second-longer'));
  let results: { tag: string }[];
  try { await turn(); assert.equal(admissions(fs.events, 'a'), 1); }
  finally { release.release(); results = await Promise.all([a, b]); }
  assert.equal(results[0].tag, fs.commits[0].tag); assert.equal(results[1].tag, fs.commits[1].tag);
});

test('an earlier completion does not remove a newer same-path queue tail', async () => {
  const enteredA = latch(), enteredB = latch(), releaseA = latch(), releaseB = latch(); let created = 0;
  const fs = directory({ async create() { created++; if (created === 1) { enteredA.release(); await releaseA.wait; } else if (created === 2) { enteredB.release(); await releaseB.wait; } } }), store = handleStore(fs.root, 'browser');
  const a = store.write('a', enc('first')); await enteredA.wait;
  const b = store.write('a', enc('second')); releaseA.release(); await a; await enteredB.wait;
  const c = store.write('a', enc('third'));
  try { await turn(); assert.equal(admissions(fs.events, 'a'), 2); }
  finally { releaseB.release(); await Promise.all([b, c]); }
  assert.deepEqual(fs.commits.map(commit => commit.text), ['first', 'second', 'third']);
});

for (const stage of ['write', 'close'] as const) test(`${stage} failure aborts its stream and releases later requests`, async () => {
  let fail = true; const failure = Object.assign(new Error(`${stage} failed`), { name: stage === 'write' ? 'AbortError' : 'Error' });
  const fs = directory({ async [stage]() { if (fail) { fail = false; throw failure; } }, async abort() { if (stage === 'write') throw new Error('abort also failed'); } });
  fs.seed('a', 'seed'); const store = handleStore(fs.root, 'browser'), tag = (await store.read('a'))!.tag;
  const results = await Promise.allSettled([store.write('a', enc('failed-value'), { expect: tag }), store.write('a', enc('succeeded-longer'), { expect: tag })]);
  assert.equal(results[0].status, 'rejected'); if (results[0].status === 'rejected') assert.equal(results[0].reason, failure);
  assert.equal(results[1].status, 'fulfilled'); assert.equal(fs.events.filter(event => event === 'abort:a').length, 1);
  assert.equal(dec((await store.read('a'))!.bytes), 'succeeded-longer');
});

test('post-commit tag-read failure releases ownership without claiming rollback', async () => {
  let fail = true;
  const fs = directory({ async read() { if (fs.commits.length === 1 && fail) { fail = false; throw new Error('tag read failed'); } } });
  fs.seed('a', 'seed'); const store = handleStore(fs.root, 'browser'), tag = (await store.read('a'))!.tag;
  const result = await Promise.allSettled([store.write('a', enc('committed-longer'), { expect: tag }), store.write('a', enc('stale'), { expect: tag })]);
  assert.equal(result[0].status, 'rejected'); if (result[0].status === 'rejected') assert.match(result[0].reason.message, /tag read failed/);
  assert.equal(result[1].status, 'rejected'); if (result[1].status === 'rejected') assert.equal(result[1].reason.code, 'STORAGE_CHANGED');
  const committed = (await store.read('a'))!; assert.equal(dec(committed.bytes), 'committed-longer'); assert.equal(fs.commits.length, 1);
  assert.equal(fs.events.includes('abort:a'), false, 'close already committed before tag read failed');
  await store.write('a', enc('recovered'), { expect: committed.tag }); assert.equal(dec((await store.read('a'))!.bytes), 'recovered');
});
