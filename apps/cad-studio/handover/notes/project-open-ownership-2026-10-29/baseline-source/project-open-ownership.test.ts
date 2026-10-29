import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server.edge';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { canonical } from '@barocss/cad-model/util/revision';
import { makeVersions } from '@barocss/cad-model/versions/log';
import { useProject, type ProjectActions } from '../src/storage/useProject';
import { handleStore, type DirHandle, type FileHandle } from '../src/storage/handleStore';
import { autosavePath, versionsPath, writePart, writeVersions, writeAutosave } from '../src/storage/project';
import { linkSource, type Linked } from '../src/storage/linked';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}
function hold() {
  const entered = deferred(), released = deferred();
  return { entered: entered.promise, release: released.resolve, async wait() { entered.resolve(); await released.promise; } };
}
const missing = () => Object.assign(new Error('Missing'), { name: 'NotFoundError' });

/** Directory-handle stand-in, not native OPFS proof. Pauses happen at real adapter await boundaries. */
function directory() {
  let clock = 1, removes = 0;
  const files = new Map<string, { bytes: Uint8Array; time: number; commits: number }>();
  const reads = new Map<string, () => Promise<void>>();
  let listing: (() => Promise<void>) | null = null;
  function dir(prefix: string): DirHandle {
    return {
      kind: 'directory', name: prefix || 'Project',
      async getDirectoryHandle(name) { return dir(`${prefix}${name}/`); },
      async getFileHandle(name, options): Promise<FileHandle> {
        const path = `${prefix}${name}`;
        if (!files.has(path)) {
          if (!options?.create) throw missing();
          files.set(path, { bytes: new Uint8Array(), time: clock++, commits: 0 });
        }
        return {
          kind: 'file', name,
          async getFile() {
            await reads.get(path)?.();
            const f = files.get(path)!;
            const bytes = f.bytes.slice();
            return { size: bytes.length, lastModified: f.time, arrayBuffer: async () => bytes.buffer };
          },
          async createWritable() {
            let bytes = new Uint8Array();
            return {
              async write(value) { bytes = value.slice(); },
              async close() { const f = files.get(path)!; files.set(path, { bytes, time: clock++, commits: f.commits + 1 }); },
              async abort() {},
            };
          },
        };
      },
      async removeEntry(name) { removes++; if (!files.delete(`${prefix}${name}`)) throw missing(); },
      async *entries() {
        if (!prefix) await listing?.();
        const children = new Map<string, boolean>();
        for (const path of files.keys()) {
          if (!path.startsWith(prefix)) continue;
          const rest = path.slice(prefix.length), slash = rest.indexOf('/');
          children.set(slash < 0 ? rest : rest.slice(0, slash), slash >= 0);
        }
        for (const [name, folder] of children) yield [name, folder ? dir(`${prefix}${name}/`) : await this.getFileHandle(name)];
      },
    };
  }
  const root = dir('');
  return {
    root, files, reads, store: handleStore(root, 'folder'),
    removals: () => removes,
    pauseRead(path: string) {
      const pause = hold(); reads.set(path, async () => { reads.delete(path); await pause.wait(); }); return pause;
    },
    pauseCommit(path: string) {
      const pause = hold(), before = files.get(path)?.commits ?? 0;
      reads.set(path, async () => { if ((files.get(path)?.commits ?? 0) > before) { reads.delete(path); await pause.wait(); } });
      return pause;
    },
    pauseList() { const pause = hold(); listing = async () => { listing = null; await pause.wait(); }; return pause; },
  };
}
type Directory = ReturnType<typeof directory>;
const document = (length: number): StudioDoc => ({ ...emptyDoc(), parameters: { L: length } });
const a = document(10), b = document(20), c = document(30);
const same = (left: StudioDoc, right: StudioDoc) => assert.equal(canonical(left), canonical(right));

interface Observation { current: StudioDoc; opened: string[]; errors: string[]; linked: Linked[] }
/** Real hook actions and codecs; observed callbacks are not App/React view or native browser proof. */
async function project(run: (api: ProjectActions, seen: Observation, select: (dir: Directory) => void) => Promise<void>) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let picked = directory(), api!: ProjectActions;
  const seen: Observation = { current: c, opened: [], errors: [], linked: [] };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { showDirectoryPicker: async () => picked.root } });
  function Probe() {
    api = useProject({
      onOpened(doc, path) { seen.current = doc; seen.opened.push(path); },
      onError(title, hint) { seen.errors.push(`${title}: ${hint}`); },
      onLinked(linked) { seen.linked.push(linked); },
    });
    return null;
  }
  try { renderToString(createElement(Probe)); await run(api, seen, value => { picked = value; }); }
  finally { if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else Reflect.deleteProperty(globalThis, 'window'); }
}
async function reached(entered: Promise<void>, pending: Promise<boolean>) {
  await Promise.race([entered, pending.then(value => assert.fail(`Open completed before the held boundary (${value})`))]);
}
const AT = '2026-10-29T00:00:00.000Z';
async function seed(dir: Directory) {
  await writePart(dir.store, 'a.bcad', a); await writePart(dir.store, 'b.bcad', b);
  const logA = makeVersions(a, { at: AT, name: 'A' }), logB = makeVersions(b, { at: AT, name: 'B' });
  await writeVersions(dir.store, 'a.bcad', logA); await writeVersions(dir.store, 'b.bcad', logB);
  return { logA, logB };
}

test('project Open unchanged control publishes the requested document, log and autosave offer', async () => {
  await project(async (api, seen, select) => {
    const dir = directory(), { logA } = await seed(dir); select(dir); await api.openFolder();
    await writeAutosave(dir.store, 'a.bcad', c);
    assert.equal(await api.openPart('a.bcad'), true);
    same(seen.current, a); assert.deepEqual(seen.opened, ['a.bcad']);
    assert.equal(api.chat.turn()!.versions[0].id, logA.versions[0].id);
    same((await api.settleOffered(true))!, c); assert.deepEqual(seen.errors, []);
  });
});

for (const action of ['close', 'New', 'Open B'] as const) {
  test(`delayed project Open A cannot replace a newer ${action} owner`, async t => {
    await project(async (api, seen, select) => {
      const dir = directory(); await seed(dir); select(dir); await api.openFolder();
      const pause = dir.pauseRead('a.bcad'), pending = api.openPart('a.bcad');
      try {
        await reached(pause.entered, pending);
        if (action === 'close') api.close();
        else if (action === 'New') { api.detach(); seen.current = c; }
        else assert.equal(await api.openPart('b.bcad'), true);
      } finally { pause.release(); }
      const accepted = await pending;
      t.diagnostic(JSON.stringify({ action, oldOpenAccepted: accepted, callbacks: seen.opened, current: seen.current.parameters, errors: seen.errors }));
      assert.equal(accepted, false, 'a superseded Open must not report current acceptance');
      same(seen.current, action === 'Open B' ? b : c);
      assert.deepEqual(seen.opened, action === 'Open B' ? ['b.bcad'] : []);
      if (action !== 'Open B') assert.equal(api.chat.turn(), null);
      assert.equal(await api.settleOffered(true), null);
      assert.deepEqual(seen.errors, []);
      // New uses App's existing detach path. This callback fixture does not claim App Undo/dirty/recovery proof.
      if (action === 'New') { await api.autosave(c); assert.equal(await dir.store.read(autosavePath('a.bcad')), null); }
    });
  });
}

for (const stage of ['versions', 'autosave', 'linked'] as const) {
  test(`Open B retains current metadata after superseded A finishes its ${stage} await`, async t => {
    await project(async (api, seen, select) => {
      const dir = directory(), { logB } = await seed(dir);
      const autoA = document(101), autoB = document(202);
      await writeAutosave(dir.store, 'a.bcad', autoA); await writeAutosave(dir.store, 'b.bcad', autoB);
      if (stage === 'linked') {
        const child = document(1), updated = document(2);
        const assembly: StudioDoc = { ...a, instances: [{ id: 'inst1', name: 'child', doc: child, position: [0, 0, 0], rotation: [0, 0, 0], part: { id: 'part1', rev: 'A', source: linkSource('child.bcad') } }] };
        await writePart(dir.store, 'a.bcad', assembly); await writePart(dir.store, 'child.bcad', updated);
        await dir.store.remove(autosavePath('a.bcad'));
      }
      select(dir); await api.openFolder();
      const pause = stage === 'linked' ? dir.pauseList() : dir.pauseRead(stage === 'versions' ? versionsPath('a.bcad') : autosavePath('a.bcad'));
      const pending = api.openPart('a.bcad');
      let currentCallbacks: string[] = [];
      try { await reached(pause.entered, pending); assert.equal(await api.openPart('b.bcad'), true); currentCallbacks = [...seen.opened]; }
      finally { pause.release(); }
      const accepted = await pending, log = api.chat.turn(), offered = await api.settleOffered(true);
      t.diagnostic(JSON.stringify({ stage, oldOpenAccepted: accepted, callbacks: seen.opened, head: log?.versions[0].name, offered: offered?.parameters, linked: seen.linked.map(item => item.offered), errors: seen.errors }));
      assert.equal(accepted, false);
      same(seen.current, b);
      assert.deepEqual(seen.opened, currentCallbacks, 'no superseded callback may follow B acceptance');
      assert.equal(seen.opened.at(-1), 'b.bcad');
      assert.equal(log!.versions[0].id, logB.versions[0].id);
      assert.ok(offered); same(offered, autoB);
      assert.deepEqual(seen.linked, [], 'a stale linked revision offer must not reach the current document');
      assert.deepEqual(seen.errors, []);
    });
  });
}
