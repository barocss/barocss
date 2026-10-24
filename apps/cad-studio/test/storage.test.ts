import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emptyDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { readStudioFile } from '@barocss/cad-model/engine/container';
import { canonical } from '@barocss/cad-model/util/revision';
import { applyBranch, makeBranch, makeVersion, makeVersions, readVersion } from '@barocss/cad-model/versions/log';
import { memoryStore } from '../src/storage/memoryStore';
import { handleStore, type DirHandle, type FileHandle } from '../src/storage/handleStore';
import { checkPath, type ProjectStore } from '../src/storage/store';
import { autosavePath, clearAutosave, partsOf, readAutosave, readPart, readVersions, snapshotPath, versionsPath, writeAutosave, writePart, writeVersions } from '../src/storage/project';

// (Run from apps/cad-studio, as the suite is: its fixtures are read from there.)
// CG6 S1 (DA-4): one contract for every store — the memory store, and the directory-handle store over a stand-in for
// the browser's FileSystemDirectoryHandle (the same calls the folder picker's and the private file system's handles
// answer) — then the project's files on it.

/** A stand-in for a directory handle: a tree in memory; a clock that moves on every write; the browser's error names. */
let clock = 1_000;
const err = (name: string) => Object.assign(new Error(name), { name });
function dir(name: string): DirHandle & { children: Map<string, DirHandle | FileHandle> } {
  const children = new Map<string, DirHandle | FileHandle>();
  return {
    kind: 'directory', name, children,
    async getDirectoryHandle(n, o) { const h = children.get(n); if (h?.kind === 'directory') return h; if (h) throw err('TypeMismatchError'); if (!o?.create) throw err('NotFoundError'); const d = dir(n); children.set(n, d); return d; },
    async getFileHandle(n, o) { const h = children.get(n); if (h?.kind === 'file') return h; if (h) throw err('TypeMismatchError'); if (!o?.create) throw err('NotFoundError'); const f = file(n); children.set(n, f); return f; },
    async removeEntry(n) { if (!children.delete(n)) throw err('NotFoundError'); },
    async *entries() { yield* [...children]; },
  };
}
function file(name: string): FileHandle {
  let bytes = new Uint8Array(0), lastModified = clock++;
  return {
    kind: 'file', name,
    async getFile() { const b = bytes; return { size: b.length, lastModified, arrayBuffer: async () => b.slice().buffer }; },
    async createWritable() { let next = new Uint8Array(0); return { async write(d: Uint8Array) { next = d.slice(); }, async close() { bytes = next; lastModified = clock++; }, async abort() {} }; },
  };
}

const enc = (s: string) => new TextEncoder().encode(s), dec = (b: Uint8Array) => new TextDecoder().decode(b);
const code = async (p: Promise<unknown>) => { try { await p; } catch (e) { return (e as { code?: string }).code; } return null; };
const STORES: [string, () => ProjectStore][] = [['memory', () => memoryStore('P')], ['handle', () => handleStore(dir('P'), 'folder')]];

for (const [kind, make] of STORES) {
  test(`store (${kind}): write, read, list, remove; tags; paths`, async () => {
    const s = make();
    assert.equal(await s.read('a.bcad'), null);
    const t1 = await s.write('a.bcad', enc('one'));
    await s.write('parts/b.bcad', enc('two'));
    await s.write('.barocss/versions/a.bcad.json', enc('{}'));
    const a = await s.read('a.bcad'); assert.equal(dec(a!.bytes), 'one'); assert.equal(a!.tag, t1.tag);
    assert.deepEqual((await s.list()).map(e => [e.path, e.size]), [['.barocss/versions/a.bcad.json', 2], ['a.bcad', 3], ['parts/b.bcad', 3]]);
    assert.deepEqual((await s.list('parts')).map(e => e.path), ['parts/b.bcad']);
    // Compare-and-set: the tag read is the one expected; a change meanwhile is refused, nothing written.
    const t2 = await s.write('a.bcad', enc('three'), { expect: t1.tag });
    assert.notEqual(t2.tag, t1.tag);
    assert.equal(await code(s.write('a.bcad', enc('stale'), { expect: t1.tag })), 'STORAGE_CHANGED');
    assert.equal(dec((await s.read('a.bcad'))!.bytes), 'three');
    assert.equal(await code(s.write('c.bcad', enc('x'), { expect: 'anything' })), 'STORAGE_CHANGED', 'expected a file where there is none');
    await s.write('c.bcad', enc('new'), { expect: null });
    assert.equal(await code(s.write('c.bcad', enc('again'), { expect: null })), 'STORAGE_CHANGED', 'expected none where there is one');
    await s.remove('c.bcad'); await s.remove('c.bcad'); await s.remove('no/such/file');
    assert.equal(await s.read('c.bcad'), null); assert.equal(await s.read('no/such/file'), null);
    for (const bad of ['', '/abs', '../up', 'a/../b', 'a//b', 'x/./y', 'con.bcad', 'a:b', 'trail.']) assert.equal(await code(s.write(bad, enc('x'))), 'STORAGE_PATH', bad);
  });
}

test('paths: what a project path may be', () => {
  assert.deepEqual(checkPath('parts/arm link.bcad'), ['parts', 'arm link.bcad']);
  assert.throws(() => checkPath('a\\b'), /\[STORAGE_PATH\]/);
});

const doc1 = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }), { kind: 'extrude', sketch: 0, height: 5 });
const doc2 = withNode(doc1, { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], radius: 1 });
const eq = (a: StudioDoc, b: StudioDoc, why = 'the same document') => assert.equal(canonical(a), canonical(b), why);
const T = (k: number) => new Date(Date.UTC(2026, 9, 24, 10, k)).toISOString();

for (const [kind, make] of STORES) {
  test(`project (${kind}): parts as Save writes them, version logs with write-once documents, autosave`, async () => {
    const s = make();
    await writePart(s, 'bracket.bcad', doc1);
    await writePart(s, 'parts/arm.bcad', doc2);
    await s.write('notes.txt', enc('not a part'));
    assert.equal(await code(Promise.resolve().then(() => writePart(s, '.barocss/x.bcad', doc1))), 'STORAGE_PATH');
    assert.deepEqual((await partsOf(s)).map(e => e.path), ['bracket.bcad', 'parts/arm.bcad']);
    const r = await readPart(s, 'parts/arm.bcad'); assert.ok('doc' in r); eq(r.doc, doc2);
    assert.equal(await code(readPart(s, 'gone.bcad')), 'STORAGE_MISSING');
    // Saved over with the tag it was read with; a second writer holding the old tag is refused.
    const again = await writePart(s, 'parts/arm.bcad', doc1, { expect: r.tag });
    assert.equal(await code(writePart(s, 'parts/arm.bcad', doc2, { expect: r.tag })), 'STORAGE_CHANGED');
    assert.ok(again.tag);

    // Versions: two on main, one on a branch; the documents are files of their own, one per distinct document.
    let log = makeVersions(doc1, { at: T(0), name: 'Start' });
    log = makeVersion(log, doc2, { at: T(1), name: 'Round' }).log;
    log = makeBranch(log, 'tall', { from: 'Start' }); log = applyBranch(log, 'tall', doc2).log;
    const tall = withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 4 });
    log = makeVersion(log, tall, { at: T(2) }).log;
    assert.equal(await readVersions(s, 'bracket.bcad'), null);
    const w = await writeVersions(s, 'bracket.bcad', log, { expect: null });
    const snaps = (await s.list('.barocss/snapshots')).map(e => e.path);
    assert.deepEqual(snaps, Object.keys(log.snapshots).map(snapshotPath).sort());
    const back = await readVersions(s, 'bracket.bcad'); assert.ok(back && 'log' in back, JSON.stringify(back));
    assert.equal(canonical(back.log), canonical(log), 'the log read back is the log written');
    eq(readVersion(back.log, 'Round'), doc2);
    // The log's own file holds no document; written again, the documents already kept are not written again.
    assert.equal(JSON.parse(dec((await s.read(versionsPath('bracket.bcad')))!.bytes)).snapshots, undefined);
    const tags = new Map((await s.list('.barocss/snapshots')).map(e => [e.path, e.tag]));
    const log2 = makeVersion(back.log, doc1, { at: T(3), name: 'Back' }).log;
    await writeVersions(s, 'bracket.bcad', log2, { expect: w.tag });
    for (const e of await s.list('.barocss/snapshots')) assert.equal(e.tag, tags.get(e.path) ?? e.tag, `${e.path} written once`);
    assert.equal(await code(writeVersions(s, 'bracket.bcad', log2, { expect: w.tag })), 'STORAGE_CHANGED', 'another writer of the log');
    // A log whose document went missing is refused when read, not shown half.
    await s.remove(snapshotPath(log.versions[2].snapshot));
    const broken = await readVersions(s, 'bracket.bcad'); assert.ok(broken && 'error' in broken); assert.match(broken.error, /\[VERSION_LOG\]/);

    // Autosave: offered while it differs from the saved document, not once saved; cleared.
    assert.equal(await readAutosave(s, 'bracket.bcad'), null);
    await writeAutosave(s, 'bracket.bcad', doc2);
    const a = await readAutosave(s, 'bracket.bcad'); assert.ok(a && 'doc' in a); eq(a.doc, doc2);
    await writePart(s, 'bracket.bcad', doc2);
    assert.equal(await readAutosave(s, 'bracket.bcad'), null, 'saved since');
    await clearAutosave(s, 'bracket.bcad'); assert.equal(await s.read(autosavePath('bracket.bcad')), null);
  });
}

test('project: a document with mesh data keeps it — the container written and read back with its arrays', async () => {
  const bytes = new Uint8Array(readFileSync(join(process.cwd(), '../../packages/barocss-cad-model/test/fixtures/block-container.bcad')));
  const read = await readStudioFile(bytes); assert.ok(!('error' in read), JSON.stringify(read));
  const s = handleStore(dir('P'), 'browser');
  await writePart(s, 'block.bcad', read.doc);
  const f = await s.read('block.bcad');
  assert.equal(new TextDecoder().decode(f!.bytes.subarray(0, 8)), 'BCADPACK', 'the container, as Save writes it');
  const back = await readPart(s, 'block.bcad'); assert.ok('doc' in back); eq(back.doc, read.doc);
});
