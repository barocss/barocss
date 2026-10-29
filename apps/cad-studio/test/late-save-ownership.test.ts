import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server.edge';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { canonical } from '@barocss/cad-model/util/revision';
import { currentDocumentSave, acceptSaveReceipt } from '../src/state/saveOwnership';
import { useProject, type ProjectActions } from '../src/storage/useProject';
import { handleStore, type DirHandle, type FileHandle } from '../src/storage/handleStore';
import { autosavePath, readAutosave, readPart, versionsPath, writePart } from '../src/storage/project';

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

/** Capture the real hook's actions. This exercises its synchronous live ref, not React view rendering or App wiring. */
async function project(run: (api: ProjectActions, errors: string[], select: (dir: Directory) => void) => Promise<void>) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  let picked = directory(), api!: ProjectActions;
  const errors: string[] = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { showDirectoryPicker: async () => picked.root } });
  function Probe() {
    api = useProject({ onOpened() {}, onError(title, hint) { errors.push(`${title}: ${hint}`); } });
    return null;
  }
  try { renderToString(createElement(Probe)); await run(api, errors, value => { picked = value; }); }
  finally { if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else Reflect.deleteProperty(globalThis, 'window'); }
}

test('document receipts preserve dirty/recovery for ABA, old render, mismatched document and renamed file', () => {
  const token = {}, owner = { token, doc: a, name: 'part' };
  function finish(currentToken: object, doc: StudioDoc, name: string) {
    let dirty = true, recovery: StudioDoc | null = b;
    if (currentDocumentSave(owner, currentToken, doc, name)) { dirty = false; recovery = null; }
    return { dirty, recovery };
  }
  const retained = { dirty: true, recovery: b };
  assert.deepEqual(finish(token, b, 'part'), retained, 'matching token cannot accept an old render document');
  assert.deepEqual(finish({}, a, 'part'), retained, 'A to B to A retains a new dispatch token');
  assert.deepEqual(finish({}, b, 'part'), retained, 'old render closure cannot borrow a new dispatch token');
  assert.deepEqual(finish(token, a, 'renamed'), retained);
  assert.deepEqual(finish(token, a, 'part'), { dirty: false, recovery: null });
});

test('out-of-order success cannot move a current file tag backwards', () => {
  const owner = { success: 0 };
  let tag = 'opened';
  if (acceptSaveReceipt(owner, 2)) tag = 'newer';
  if (acceptSaveReceipt(owner, 1)) tag = 'older';
  assert.equal(tag, 'newer');
  assert.equal(owner.success, 2);
});

test('actual hook: late Save retains newer recovery, advances its tag, and keeps saved-equal checkpoint hidden', async () => {
  await project(async (api, errors, select) => {
    const dir = directory(); select(dir); await api.openFolder();
    assert.equal(await api.save(c, 'part'), true);
    const pause = dir.pauseCommit('part.bcad');
    let token = {}, doc = a, dirty = true, recovery: StudioDoc | null = a;
    const owner = { token, doc, name: 'part' };
    const pending = api.save(a, 'part', () => {
      if (currentDocumentSave(owner, token, doc, 'part')) { dirty = false; recovery = null; }
    });
    try {
      await pause.entered;
      token = {}; doc = b; recovery = b;
      await api.autosave(b);
    } finally { pause.release(); }
    assert.equal(await pending, true, 'file receipt remains valid after an independent document edit');
    assert.equal(dirty, true); assert.equal(recovery, b);
    const saved = await readPart(dir.store, 'part.bcad'); assert.ok('doc' in saved); same(saved.doc, a);
    const checkpoint = await readAutosave(dir.store, 'part.bcad'); assert.ok(checkpoint && 'doc' in checkpoint); same(checkpoint.doc, b);
    assert.equal(await api.save(b, 'part'), true, 'own previous successful tag must advance despite the edit');
    assert.ok(await dir.store.read(autosavePath('part.bcad')), 'Save does not physically remove a checkpoint');
    assert.equal(await readAutosave(dir.store, 'part.bcad'), null, 'saved bytes hide the equal checkpoint');
    assert.equal(dir.removals(), 0); assert.deepEqual(errors, []);
  });
});

for (const action of ['close', 'detach', 'use', 'openPart'] as const) {
  test(`actual hook: ${action} invalidates a held Save receipt and preserves the next file binding`, async () => {
    await project(async (api, errors, select) => {
      const dir = directory(), other = directory(); select(dir); await api.openFolder();
      if (action !== 'detach') assert.equal(await api.save(a, 'first'), true);
      if (action === 'openPart') await writePart(dir.store, 'second.bcad', b);
      const pause = dir.pauseCommit('first.bcad');
      let completed = 0;
      const pending = api.save(a, 'first', () => { completed++; });
      try {
        await pause.entered;
        if (action === 'close') api.close();
        else if (action === 'detach') api.detach(); // part and log are both still null.
        else if (action === 'use') { select(other); await api.openFolder(); }
        else assert.equal(await api.openPart('second.bcad'), true);
      } finally { pause.release(); }
      assert.equal(await pending, false); assert.equal(completed, 0);
      if (action === 'close') { select(other); await api.openFolder(); }
      assert.equal(await api.save(c, 'next'), true);
      const target = action === 'close' || action === 'use' ? other : dir;
      const path = action === 'openPart' ? 'second.bcad' : 'next.bcad';
      const saved = await readPart(target.store, path); assert.ok('doc' in saved); same(saved.doc, c);
      assert.deepEqual(errors, []);
    });
  });
}

test('actual hook: session change during versions read suppresses stale log errors and completion', async () => {
  await project(async (api, errors, select) => {
    const dir = directory(); select(dir); await api.openFolder();
    const path = versionsPath('part.bcad');
    await dir.store.write(path, new TextEncoder().encode('{invalid'));
    const pause = hold(); dir.reads.set(path, async () => { dir.reads.delete(path); await pause.wait(); });
    let completed = 0;
    const pending = api.save(a, 'part', () => { completed++; });
    try { await pause.entered; api.close(); } finally { pause.release(); }
    assert.equal(await pending, false); assert.equal(completed, 0);
    assert.equal(api.chat.turn(), null); assert.deepEqual(errors, []);
  });
});

test('actual hook: detach during parts refresh suppresses stale completion and permits the next Save', async () => {
  await project(async (api, errors, select) => {
    const dir = directory(); select(dir); await api.openFolder();
    assert.equal(await api.save(a, 'part'), true);
    const pause = dir.pauseList();
    let completed = 0;
    const pending = api.save(b, 'part', () => { completed++; });
    try { await pause.entered; api.detach(); } finally { pause.release(); }
    assert.equal(await pending, false); assert.equal(completed, 0);
    assert.equal(await api.save(c, 'next'), true);
    const saved = await readPart(dir.store, 'next.bcad'); assert.ok('doc' in saved); same(saved.doc, c);
    assert.deepEqual(errors, []);
  });
});
