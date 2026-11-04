import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server.edge';
import { emptyDoc, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { canonical } from '@barocss/cad-model/util/revision';
import { makeVersions, makeBranch, makeVersion } from '@barocss/cad-model/versions/log';
import { useProject, type ProjectActions } from '../src/storage/useProject';
import { handleStore, type DirHandle, type FileHandle } from '../src/storage/handleStore';
import { versionsPath, readVersions, writePart, writeVersions } from '../src/storage/project';

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

/** Actual hook and storage codecs, with controlled adapter awaits. This is not App/browser proof. */
async function project(run: (api: ProjectActions, seen: { doc: StudioDoc; errors: string[] }, dir: Directory, edit: () => void) => Promise<void>) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const dir = directory(), seen = { doc: a, errors: [] as string[] };
  let api!: ProjectActions, scope = {};
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { showDirectoryPicker: async () => dir.root } });
  function Probe() {
    api = useProject({
      onOpenIntent() { return scope = {}; }, currentOpenScope() { return scope; }, isOpenCurrent(owner) { return owner === scope; },
      onOpened(doc) { seen.doc = doc; return scope = {}; },
      onError(title, hint) { seen.errors.push(`${title}: ${hint}`); },
    });
    return null;
  }
  try {
    renderToString(createElement(Probe));
    await writePart(dir.store, 'a.bcad', a); await writePart(dir.store, 'b.bcad', b);
    let log = makeBranch(makeVersions(a, { at: '2026-11-04T00:00:00Z', name: 'A' }), 'other');
    log = makeVersion({ ...log, current: 'other' }, c, { at: '2026-11-04T00:01:00Z', name: 'other head' }).log;
    await writeVersions(dir.store, 'a.bcad', { ...log, current: 'main' });
    await writeVersions(dir.store, 'b.bcad', makeVersions(b, { at: '2026-11-04T00:00:00Z', name: 'B' }));
    await api.openFolder(); assert.equal(await api.openPart('a.bcad'), true);
    await run(api, seen, dir, () => { scope = {}; seen.doc = b; });
  } finally { if (descriptor) Object.defineProperty(globalThis, 'window', descriptor); else Reflect.deleteProperty(globalThis, 'window'); }
}
const operations = {
  switch: (api: ProjectActions) => api.switchBranch('other', a),
  merge: (api: ProjectActions) => api.merge('other', a),
  branch: (api: ProjectActions) => api.makeBranch('late'),
  version: (api: ProjectActions) => api.makeVersion(b, 'a', { versionName: 'late' }),
  chat: async (api: ProjectActions) => { api.chat.back(makeBranch(api.chat.turn()!, 'late'), []); return null; },
};
for (const operation of Object.keys(operations) as (keyof typeof operations)[]) {
  for (const change of ['Open B', 'close', 'detach'] as const) {
    test(`late ${operation} receipt cannot publish A metadata after ${change}`, async () => {
      await project(async (api, seen, dir) => {
        const pause = dir.pauseCommit(versionsPath('a.bcad'));
        const pending = operations[operation](api);
        let expected = '';
        try {
          await (operation === 'chat' ? pause.entered : Promise.race([pause.entered, pending.then(value => assert.fail(`Version action completed before the held receipt (${String(value)}): ${seen.errors.join('; ')}`))]));
          if (change === 'Open B') { assert.equal(await api.openPart('b.bcad'), true); expected = canonical(api.chat.turn()); }
          else api[change]();
        } finally { pause.release(); }
        const result = await pending;
        // chat.back is deliberately fire-and-forget. Wait for its held adapter receipt to settle.
        await new Promise<void>(resolve => setImmediate(resolve));
        if (operation === 'switch' || operation === 'merge') assert.equal(result, null, 'stale result must not reach VersionsPanel onOpen');
        else if (operation !== 'chat') assert.equal(result, false);
        assert.equal(api.chat.turn() ? canonical(api.chat.turn()) : '', expected, 'current log must remain owned by the current project document');
        assert.deepEqual(seen.errors, []);
        if (change === 'Open B') {
          assert.equal(await api.makeBranch('B next'), true, 'B must retain its own expected storage tag');
          const stored = await readVersions(dir.store, 'b.bcad'); assert.ok(stored && 'log' in stored);
          assert.ok(stored.log.branches.some(branch => branch.name === 'B next'));
        }
      });
    });
  }
}
for (const operation of ['switch', 'merge'] as const) {
  test(`late ${operation} cannot return a replacement after an intervening document edit`, async () => {
    await project(async (api, seen, dir, edit) => {
      const pause = dir.pauseCommit(versionsPath('a.bcad')), pending = operations[operation](api);
      try { await pause.entered; edit(); } finally { pause.release(); }
      assert.equal(await pending, null, 'the edited document must not receive an old replacement');
      same(seen.doc, b);
      assert.equal(await api.makeBranch('after edit'), true, 'same-session successful writes must retain their valid storage tag');
      const branch = api.chat.turn()!.current;
      assert.equal(branch, operation === 'switch' ? 'other' : 'main', 'the log reflects the completed persisted operation');
      assert.equal(await api.makeVersion(b, 'a', { versionName: 'edited next' }), true);
      const next = api.chat.turn()!;
      assert.equal(next.versions.at(-1)!.branch, branch, 'the edited document is versioned on the persisted current branch');
      same(next.snapshots[next.versions.at(-1)!.snapshot], b);
      assert.deepEqual(seen.errors, []);
    });
  });
}
for (const operation of ['switch', 'merge'] as const) {
  test(`current ${operation} returns its document and retains a usable log tag`, async () => {
    await project(async (api, seen) => {
      const result = await operations[operation](api); assert.ok(result);
      assert.ok(!('conflicts' in result), 'the unchanged merge control must complete without conflicts');
      const doc = 'doc' in result ? result.doc : result;
      same(doc, c);
      assert.equal(await api.makeBranch('after success'), true); assert.deepEqual(seen.errors, []);
    });
  });
}

for (const change of ['edit', 'Open B', 'detach'] as const) {
  test(`makeVersion cannot start its log write after preliminary Save crosses ${change}`, async () => {
    await project(async (api, seen, dir, edit) => {
      const before = await readVersions(dir.store, 'a.bcad'); assert.ok(before && 'log' in before);
      const pause = dir.pauseCommit('a.bcad'), pending = api.makeVersion(b, 'a', { versionName: 'late save' });
      try {
        await pause.entered;
        if (change === 'edit') edit();
        else if (change === 'Open B') assert.equal(await api.openPart('b.bcad'), true);
        else api.detach();
      } finally { pause.release(); }
      assert.equal(await pending, false);
      const after = await readVersions(dir.store, 'a.bcad'); assert.ok(after && 'log' in after);
      assert.equal(canonical(after.log), canonical(before.log), 'old Save must not create a version in a newer scope');
      assert.deepEqual(seen.errors, []);
    });
  });
}

test('current storage conflict reloads the external log and its tag for the next action', async () => {
  await project(async (api, seen, dir) => {
    await writeVersions(dir.store, 'a.bcad', makeBranch(api.chat.turn()!, 'external'));
    assert.equal(await api.makeBranch('refused'), false);
    assert.ok(api.chat.turn()!.branches.some(branch => branch.name === 'external'));
    assert.ok(!api.chat.turn()!.branches.some(branch => branch.name === 'refused'));
    assert.equal(seen.errors.length, 1); assert.match(seen.errors[0], /The versions changed elsewhere/);
    assert.equal(await api.makeBranch('after reload'), true);
  });
});

for (const change of ['Open B', 'close', 'detach'] as const) {
  test(`conflict reload cannot publish A log or error after ${change}`, async () => {
    await project(async (api, seen, dir) => {
      await writeVersions(dir.store, 'a.bcad', makeBranch(api.chat.turn()!, 'external'));
      const path = versionsPath('a.bcad'), pause = hold(); let reads = 0;
      // Snapshot listing walks all files (read 1); the write checks its tag (read 2); read 3 starts the conflict reload.
      dir.reads.set(path, async () => { if (++reads === 3) { dir.reads.delete(path); await pause.wait(); } });
      const pending = api.makeBranch('refused'); let expected = '';
      try {
        await pause.entered;
        if (change === 'Open B') { assert.equal(await api.openPart('b.bcad'), true); expected = canonical(api.chat.turn()); }
        else api[change]();
      } finally { pause.release(); }
      assert.equal(await pending, false);
      assert.equal(api.chat.turn() ? canonical(api.chat.turn()) : '', expected);
      assert.deepEqual(seen.errors, []);
      if (change === 'Open B') assert.equal(await api.makeBranch('after stale reload'), true);
    });
  });
}

test('late storage failure cannot report an A version error into B', async () => {
  await project(async (api, seen, dir) => {
    const path = versionsPath('a.bcad'), pause = hold();
    dir.reads.set(path, async () => { dir.reads.delete(path); await pause.wait(); throw new Error('A permission was revoked'); });
    const pending = api.makeBranch('refused');
    try { await pause.entered; assert.equal(await api.openPart('b.bcad'), true); } finally { pause.release(); }
    assert.equal(await pending, false); assert.deepEqual(seen.errors, []);
    assert.equal(await api.makeBranch('B after error'), true);
  });
});

for (const change of ['unchanged', 'Open B'] as const) {
  test(`conflict reload rejection is handled for ${change} ownership`, async () => {
    await project(async (api, seen, dir) => {
      await writeVersions(dir.store, 'a.bcad', makeBranch(api.chat.turn()!, 'external'));
      const path = versionsPath('a.bcad'), pause = hold(); let reads = 0;
      dir.reads.set(path, async () => {
        if (++reads === 3) { dir.reads.delete(path); await pause.wait(); throw new Error('Reload permission was revoked'); }
      });
      // Exercise the fire-and-forget consumer: a reload rejection must not escape keepLog.
      api.chat.back(makeBranch(api.chat.turn()!, 'agent pending'), []);
      try { await pause.entered; if (change === 'Open B') assert.equal(await api.openPart('b.bcad'), true); }
      finally { pause.release(); }
      await new Promise<void>(resolve => setImmediate(resolve));
      if (change === 'Open B') {
        assert.deepEqual(seen.errors, []); assert.equal(await api.makeBranch('B after rejected reload'), true);
      } else {
        assert.equal(seen.errors.length, 1); assert.match(seen.errors[0], /The versions could not be read.*Reload permission was revoked/);
      }
    });
  });
}
