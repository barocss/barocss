import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server.edge';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { canonical } from '@barocss/cad-model/util/revision';
import { useProject, type ProjectActions } from '../src/storage/useProject';
import { handleStore, type DirHandle, type FileHandle } from '../src/storage/handleStore';
import { autosavePath, readAutosave, writeAutosave, writePart } from '../src/storage/project';

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
  const writes = new Map<string, () => Promise<void>>();
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
              async close() { await writes.get(path)?.(); const f = files.get(path)!; files.set(path, { bytes, time: clock++, commits: f.commits + 1 }); },
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
    root, files, reads, writes, store: handleStore(root, 'folder'),
    removals: () => removes,
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

/** Real hook and native-adapter stand-in; callback checks do not prove App rendering or dirty/history state. */
async function project(run: (api: ProjectActions, seen: { doc: StudioDoc; errors: string[]; ready: number }, dir: Directory, edit: () => void) => Promise<void>) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const dir = directory(), seen = { doc: a, errors: [] as string[], ready: 0 };
  let api!: ProjectActions, scope = {};
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { showDirectoryPicker: async () => dir.root } });
  function Probe() {
    api = useProject({
      onOpenIntent() { return scope = {}; }, currentOpenScope() { return scope; }, isOpenCurrent(owner) { return owner === scope; },
      onOpened(doc) { seen.doc = doc; return scope = {}; },
      onError(title, hint) { seen.errors.push(`${title}: ${hint}`); }, onOpenReady() { seen.ready++; },
    });
    return null;
  }
  try {
    renderToString(createElement(Probe));
    await writePart(dir.store, 'a.bcad', a); await writePart(dir.store, 'b.bcad', b);
    await api.openFolder(); assert.equal(await api.openPart('a.bcad'), true);
    seen.ready = 0;
    await run(api, seen, dir, () => { scope = {}; seen.doc = b; });
  } finally { if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else Reflect.deleteProperty(globalThis, 'window'); }
}
const denied = (name = 'NotAllowedError') => Object.assign(new Error(`${name}: recovery write refused`), { name });
for (const reason of ['NotAllowedError', 'QuotaExceededError']) {
  test(`current ${reason} autosave failure warns once, preserves prior copy, and resets after success`, async () => {
    await project(async (api, seen, dir, edit) => {
      const path = autosavePath('a.bcad'); await writeAutosave(dir.store, 'a.bcad', c);
      const prior = dir.files.get(path)!.bytes.slice();
      dir.writes.set(path, async () => { throw denied(reason); });
      await api.autosave(b); await api.autosave(b); edit(); await api.autosave(b);
      assert.equal(seen.errors.length, 1, 'one notice per current project document outage, including later edits');
      assert.match(seen.errors[0], /recovery|autosav/i); assert.match(seen.errors[0], reason === 'NotAllowedError' ? /does not allow.*writing/ : /QuotaExceededError/);
      assert.deepEqual(dir.files.get(path)!.bytes, prior); assert.equal(dir.removals(), 0);
      dir.writes.delete(path); await api.autosave(b);
      const recovery = await readAutosave(dir.store, 'a.bcad'); assert.ok(recovery && 'doc' in recovery); same(recovery.doc, b);
      dir.writes.set(path, async () => { throw denied(reason); }); await api.autosave(c);
      assert.equal(seen.errors.length, 2, 'a later outage must warn again after successful recovery');
    });
  });
}
for (const change of ['edit', 'Open B', 'folder', 'close', 'detach'] as const) {
  test(`late autosave rejection after ${change} cannot report into the new owner`, async () => {
    await project(async (api, seen, dir, edit) => {
      const path = autosavePath('a.bcad'), pause = hold();
      dir.writes.set(path, async () => { dir.writes.delete(path); await pause.wait(); throw denied(); });
      const pending = api.autosave(c);
      try {
        await pause.entered;
        if (change === 'edit') edit();
        else if (change === 'Open B') { assert.equal(await api.openPart('b.bcad'), true); await api.autosave(c); }
        else if (change === 'folder') await api.openFolder();
        else api[change]();
      } finally { pause.release(); }
      await pending; assert.deepEqual(seen.errors, []);
      if (change === 'edit') {
        dir.writes.set(path, async () => { throw denied(); }); await api.autosave(b);
        assert.equal(seen.errors.length, 1, 'a stale failure must not consume the current document warning');
      }
    });
  });
}
for (const kind of ['malformed', 'permission'] as const) {
  test(`Open reports ${kind} recovery, retains the accepted file, and completes ready`, async () => {
    await project(async (api, seen, dir) => {
      const path = autosavePath('a.bcad');
      if (kind === 'malformed') await dir.store.write(path, new TextEncoder().encode('not a Studio recovery document'));
      else { await dir.store.write(path, new Uint8Array([1])); dir.reads.set(path, async () => { throw denied(); }); }
      const prior = dir.files.get(path)!.bytes.slice();
      assert.equal(await api.openPart('a.bcad'), true, 'recovery alone must not classify the valid project file as unopened');
      same(seen.doc, a); assert.equal(seen.ready, 1); assert.equal(await api.settleOffered(true), null);
      assert.equal(seen.errors.length, 1); assert.match(seen.errors[0], /recovery|autosav/i);
      assert.deepEqual(dir.files.get(path)!.bytes, prior); assert.equal(dir.removals(), 0);
    });
  });
}

test('valid recovery is still offered without replacing the loaded project document', async () => {
  await project(async (api, seen, dir) => {
    await writeAutosave(dir.store, 'a.bcad', c);
    assert.equal(await api.openPart('a.bcad'), true); same(seen.doc, a);
    const offered = await api.settleOffered(true); assert.ok(offered); same(offered, c);
    assert.equal(seen.ready, 1); assert.deepEqual(seen.errors, []);
  });
});

for (const kind of ['malformed', 'permission'] as const) {
  test(`stale ${kind} recovery read cannot replace B or report an A error`, async () => {
    await project(async (api, seen, dir) => {
      const path = autosavePath('a.bcad'), pause = hold();
      await dir.store.write(path, new TextEncoder().encode('invalid recovery'));
      dir.reads.set(path, async () => { dir.reads.delete(path); await pause.wait(); if (kind === 'permission') throw denied(); });
      const pending = api.openPart('a.bcad');
      try { await pause.entered; assert.equal(await api.openPart('b.bcad'), true); } finally { pause.release(); }
      assert.equal(await pending, false); same(seen.doc, b); assert.equal(seen.ready, 1);
      assert.deepEqual(seen.errors, []); assert.equal(await api.settleOffered(true), null);
    });
  });
}

test('a fresh Open of the same path owns a new autosave outage notice', async () => {
  await project(async (api, seen, dir) => {
    const path = autosavePath('a.bcad'); await writeAutosave(dir.store, 'a.bcad', c);
    dir.writes.set(path, async () => { throw denied(); });
    await api.autosave(b); assert.equal(seen.errors.length, 1);
    assert.equal(await api.openPart('a.bcad'), true);
    await api.autosave(b); assert.equal(seen.errors.length, 2);
    const offered = await api.settleOffered(true); assert.ok(offered); same(offered, c);
  });
});
