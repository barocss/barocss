import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readStudioFile } from '../src/engine/container';
import { withIds } from '../src/engine/ids';
import { idFormOf, indexForm } from '../src/versions/idForm';
import { emptyDoc, withNode, type ModelNode, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { deleteFeature, moveFeature, replaceRange } from '../src/chat/features';
import { canonical, revisionOf } from '../src/util/revision';
import type { Mate } from '../src/assembly/mates';
import {
  applyBranch, applyMerge, changesOf, checkVersions, findBase, headOf, isUnsaved, makeBranch, makeVersion, makeVersions,
  mergeDocs, nameVersion, readVersion, versionsOf, type Conflict, type VersionLog,
} from '../src/versions/index';

// CG6 (DA-1–DA-3): versions, compare and merge. The oracles are independent of the code under test: hand-written
// expected histories and change lists, documents compared as canonical JSON, and — for a merge — the kernel's
// evaluation of the merged document against the document made by running both branches' edits one after the other.

const T0 = '2026-10-24T10:00:00.000Z', at = (k: number) => new Date(Date.parse(T0) + k * 60_000).toISOString();
const box = (doc: StudioDoc, x: number, w: number, h: number) => withNode(withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [x, 0], max: [x + w, w] }), { kind: 'extrude', sketch: doc.nodes.length, height: h });
const fillet = (doc: StudioDoc, body: number, edge: string, radius: number) => withNode(doc, { kind: 'fillet', parent: { node: body, side: 'solid' }, edges: [edge], radius });
const edit = (doc: StudioDoc, id: string, change: Partial<ModelNode>) => { const i = doc.nodes.findIndex(n => n.id === id); return replaceRange(doc, i, 1, [{ ...doc.nodes[i], ...change } as ModelNode]); };
const eq = (a: StudioDoc, b: StudioDoc, why = 'the same document') => assert.equal(canonical(a), canonical(b), why);
const volumes = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies.map(b => Math.round(b.volume! * 1000) / 1000).sort((x, y) => x - y); };
const code = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as { code?: string }).code; } return null; };
const ok = (log: VersionLog) => assert.deepEqual(checkVersions(log), [], 'checkVersions');
const merged = (r: ReturnType<typeof mergeDocs>) => { assert.ok('doc' in r, JSON.stringify('conflicts' in r && r.conflicts.map(c => c.message))); return r; };

const A = box(emptyDoc(), 0, 10, 5);             // n0 sketch, n1 extrude
const AB = box(A, 30, 8, 4);                      // + n2 sketch, n3 extrude

// ——— V1: the log

test('versions: a scripted session — list, names, restore and revisions as written', () => {
  let log = makeVersions(A, { at: at(0), by: 'person', name: 'Start' }); ok(log);
  const filleted = fillet(A, 1, 'n1.side0|n1.top', 1);
  let r = makeVersion(log, filleted, { at: at(1), name: 'Rev A', note: 'rounded' }); log = r.log; ok(log);
  const taller = edit(filleted, 'n1', { height: 9 });
  r = makeVersion(log, taller, { at: at(2) }); log = r.log; ok(log);
  assert.deepEqual(versionsOf(log).map(v => [v.name ?? null, v.at, v.parents.length]), [[null, at(2), 1], ['Rev A', at(1), 1], ['Start', at(0), 0]]);
  // Each version reads back the document made into it, and carries its A7 revision.
  const docs = [A, filleted, taller];
  log.versions.forEach((v, i) => { eq(readVersion(log, v.id), docs[i]); assert.equal(v.revision, revisionOf(docs[i])); });
  eq(readVersion(log, 'Rev A'), filleted, 'by name');
  assert.equal(headOf(log).id, r.version.id);
  // Restoring never rewinds: the old state is the working document, and saving it is a new version on the head.
  const back = readVersion(log, 'Start'), again = makeVersion(log, back, { at: at(3), name: 'Back to start' });
  assert.equal(again.log.versions.length, 4); assert.deepEqual(again.version.parents, [r.version.id]);
  eq(readVersion(again.log, again.version.id), A);
  assert.equal(again.version.snapshot, log.versions[0].snapshot, 'equal documents share one snapshot');
  assert.equal(Object.keys(again.log.snapshots).length, 3);
  ok(again.log);
});

test('versions: refusals are typed', () => {
  const log = makeVersions(A, { at: at(0), name: 'Start' });
  assert.equal(code(() => makeVersion(log, A, { at: at(1) })), 'VERSION_NO_CHANGE');
  assert.equal(code(() => makeVersion(log, AB, { at: at(1), name: 'Start' })), 'VERSION_NAME');
  assert.equal(code(() => makeVersion(log, AB, { at: 'yesterday' })), 'VERSION_INPUT');
  assert.equal(code(() => readVersion(log, 'nope')), 'VERSION_UNKNOWN');
  assert.equal(code(() => makeBranch(log, '')), 'BRANCH_NAME');
  assert.equal(code(() => makeBranch(log, 'main')), 'BRANCH_EXISTS');
  assert.equal(code(() => applyBranch(log, 'other', A)), 'BRANCH_UNKNOWN');
  try { makeVersion(log, A, { at: at(1) }); } catch (e) { assert.match((e as Error).message, /^\[VERSION_NO_CHANGE\] /); }
});

test('versions: ids come from what a version is — two copies of a project make the same ids; another author another', () => {
  const one = makeVersion(makeVersions(A, { at: at(0) }), AB, { at: at(1), by: 'kim' });
  const two = makeVersion(makeVersions(A, { at: at(0) }), AB, { at: at(1), by: 'kim', name: 'named later' });
  assert.equal(one.version.id, two.version.id, 'the name is a label, not part of the id');
  const lee = makeVersion(makeVersions(A, { at: at(0) }), AB, { at: at(1), by: 'lee' });
  assert.notEqual(one.version.id, lee.version.id);
  // Renaming keeps the id; the log stays valid.
  const renamed = nameVersion(one.log, one.version.id, { name: 'Rev B', note: 'two boxes' });
  assert.equal(renamed.versions[1].id, one.version.id); assert.equal(renamed.versions[1].name, 'Rev B'); ok(renamed);
  assert.equal(nameVersion(renamed, 'Rev B', { name: null }).versions[1].name, undefined);
});

test('versions: a log survives a file (JSON) and a tampered one is caught', () => {
  const log = makeVersion(makeVersions(A, { at: at(0) }), AB, { at: at(1) }).log;
  const read = JSON.parse(JSON.stringify(log)) as VersionLog; ok(read);
  eq(readVersion(read, read.versions[1].id), AB);
  const bad1 = JSON.parse(JSON.stringify(log)) as VersionLog; (bad1.snapshots[bad1.versions[1].snapshot].nodes[1] as { height: number }).height = 99;
  assert.deepEqual(checkVersions(bad1).map(p => [p.code, p.where]), [['VERSION_LOG', 'versions.1']]);
  const bad2 = JSON.parse(JSON.stringify(log)) as VersionLog; bad2.versions[1].parents = ['vmissing'];
  assert.deepEqual(checkVersions(bad2).map(p => p.code), ['VERSION_LOG', 'VERSION_LOG'], 'the parent, and the id no longer made from it');
  const bad3 = { ...log, current: 'gone' };
  assert.deepEqual(checkVersions(bad3).map(p => p.code), ['BRANCH_UNKNOWN']);
  assert.deepEqual(checkVersions({ format: 'x' }).map(p => p.code), ['VERSION_LOG']);
});

test('versions: branches — made at a version, switched with the work saved, each with its own history', () => {
  let log = makeVersions(A, { at: at(0), name: 'Start' });
  log = makeVersion(log, AB, { at: at(1), name: 'Two boxes' }).log;
  log = makeBranch(log, 'round', { from: 'Start' });
  assert.equal(log.current, 'main', 'making a branch does not switch to it');
  // Unsaved work refuses a switch, unless discarded.
  const working = edit(AB, 'n3', { height: 6 });
  assert.ok(isUnsaved(log, working));
  assert.equal(code(() => applyBranch(log, 'round', working)), 'BRANCH_UNSAVED');
  let sw = applyBranch(log, 'round', working, { discard: true });
  eq(sw.doc, A, "the branch's head: the version it was made at"); log = sw.log;
  log = makeVersion(log, fillet(A, 1, 'n1.side0|n1.top', 1), { at: at(2), name: 'Round' }).log;
  assert.deepEqual(versionsOf(log).map(v => v.name), ['Round', 'Start']);
  assert.deepEqual(versionsOf(log, { branch: 'main' }).map(v => v.name), ['Two boxes', 'Start']);
  sw = applyBranch(log, 'main', readVersion(log, 'Round')); eq(sw.doc, AB); log = sw.log;
  const start = log.versions.find(v => v.name === 'Start')!.id;
  assert.equal(findBase(log, headOf(log, 'main').id, headOf(log, 'round').id), start);
  ok(log);
});

// ——— V2: compare

test('compare: the same document has no changes; each edit is listed as written', () => {
  assert.deepEqual(changesOf(AB, AB), { same: true, features: [], parameters: [], configurations: [], mates: [], instances: [], fields: [] });
  const f = fillet(AB, 3, 'n3.side0|n3.top', 1);
  assert.deepEqual(changesOf(AB, f).features, [{ id: 'n4', kind: 'added', feature: 'fillet' }]);
  assert.deepEqual(changesOf(f, edit(f, 'n3', { height: 6 })).features, [{ id: 'n3', kind: 'edited', feature: 'extrude', fields: [{ path: 'height', from: 4, to: 6 }] }]);
  const del = deleteFeature(f, 4); assert.ok('doc' in del);
  assert.deepEqual(changesOf(f, del.doc).features, [{ id: 'n4', kind: 'removed', feature: 'fillet' }]);
  // Parameters, configurations, a placed part moved, a mate added, and other fields by name.
  const a: StudioDoc = { ...AB, parameters: { w: 10, h: 5 }, configurations: { small: { w: 8 } } };
  const inst: PartInstance = { id: 'inst1', name: 'A', doc: A, position: [0, 0, 0], rotation: [0, 0, 0] };
  const mate: Mate = { id: 'm1', kind: 'coincident', a: { part: 'base', face: 'n1.top' }, b: { part: 'inst1', face: 'n1.bottom' } };
  const b: StudioDoc = { ...AB, parameters: { w: 12, d: 3 }, configurations: { small: { w: 8 }, big: { w: 20 } }, instances: [{ ...inst, position: [5, 0, 0] }], mates: [mate], drawing: { sheets: [] } as unknown as StudioDoc['drawing'] };
  const c = changesOf({ ...a, instances: [inst] }, b);
  assert.deepEqual(c.parameters, [{ name: 'd', kind: 'added', to: 3 }, { name: 'h', kind: 'removed', from: 5 }, { name: 'w', kind: 'edited', from: 10, to: 12 }]);
  assert.deepEqual(c.configurations, [{ name: 'big', kind: 'added', to: { w: 20 } }]);
  assert.deepEqual(c.instances, [{ id: 'inst1', kind: 'edited', fields: [{ path: 'position.0', from: 0, to: 5 }] }]);
  assert.deepEqual(c.mates, [{ id: 'm1', kind: 'added' }]);
  assert.deepEqual(c.fields, ['drawing']);
  assert.equal(c.same, false);
});

test('compare: a feature inserted early is the one change — the later ones, their indices moved, are not edited', () => {
  // A fillet on the second box; then a third box appended and moved before the fillet and the second box.
  const f = fillet(AB, 3, 'n3.side0|n3.top', 1);                                   // n0..n4
  let g = box(f, 60, 6, 6);                                                         // + n5 sketch, n6 extrude
  // (moveFeature moves a history step: the box's sketch and extrude together.)
  for (let k = 0; k < 2; k++) { const m = moveFeature(g, g.nodes.findIndex(n => n.id === 'n6'), -1); assert.ok('doc' in m, JSON.stringify(m)); g = m.doc; }
  assert.deepEqual(g.nodes.map(n => n.id), ['n0', 'n1', 'n5', 'n6', 'n2', 'n3', 'n4']);
  assert.notDeepEqual((g.nodes[6] as { parent: unknown }).parent, (f.nodes[4] as { parent: unknown }).parent, 'the fillet\'s index reference did move');
  assert.deepEqual(changesOf(f, g).features, [{ id: 'n5', kind: 'added', feature: 'sketch' }, { id: 'n6', kind: 'added', feature: 'extrude' }]);
  // Two independent boxes swapped: one of them is moved, nothing edited.
  const sw = moveFeature(AB, 3, -1); assert.ok('doc' in sw); const s = sw.doc;
  assert.deepEqual(s.nodes.map(n => n.id), ['n2', 'n3', 'n0', 'n1']);
  // (Which of two swapped steps "moved" is a tie; either one, never an edit.)
  const moved = changesOf(AB, s).features;
  assert.ok([['n0', 'n1'], ['n2', 'n3']].some(ids => canonical(moved) === canonical(ids.map((id, k) => ({ id, kind: 'moved', feature: k ? 'extrude' : 'sketch' })))), JSON.stringify(moved));
  assert.deepEqual(volumes(s), volumes(AB));
});

test('compare: the other way round is the mirror', () => {
  const f = edit(fillet(AB, 3, 'n3.side0|n3.top', 1), 'n1', { height: 7 });
  const there = changesOf(AB, f), back = changesOf(f, AB);
  const flip = { added: 'removed', removed: 'added', edited: 'edited', moved: 'moved' } as const;
  assert.deepEqual(back.features.map(c => [c.id, c.kind]).sort(), there.features.map(c => [c.id, flip[c.kind]]).sort());
  const e = there.features.find(c => c.kind === 'edited')!, e2 = back.features.find(c => c.kind === 'edited')!;
  assert.deepEqual(e2.fields, e.fields!.map(x => ({ path: x.path, from: x.to, to: x.from })));
});

// ——— V3: merge

test('merge: one side unchanged gives the other, exactly', () => {
  const X = fillet(AB, 3, 'n3.side0|n3.top', 1), Y = edit(AB, 'n1', { height: 8 });
  eq(merged(mergeDocs(AB, X, AB)).doc, X);
  eq(merged(mergeDocs(AB, AB, Y)).doc, Y);
  eq(merged(mergeDocs(AB, X, X)).doc, X);
});

test('merge: disjoint edits on two branches build what both scripts, run one after the other, build (the kernel as oracle)', () => {
  // Ours: a fillet on box A (n4). Theirs: box B taller, and a third box (its own n4, n5 — clashing with ours' n4).
  const ours = fillet(AB, 1, 'n1.side0|n1.top', 1);
  const theirs = box(edit(AB, 'n3', { height: 7 }), 60, 6, 3);
  const r = merged(mergeDocs(AB, ours, theirs));
  // The sequence: ours, then theirs' edits made on it by the same commands.
  const sequence = box(edit(ours, 'n3', { height: 7 }), 60, 6, 3);
  assert.deepEqual(volumes(r.doc), volumes(sequence));
  const ids = r.doc.nodes.map(n => n.id);
  assert.equal(new Set(ids).size, ids.length, `ids unique: ${ids}`);
  assert.deepEqual(ids, ['n0', 'n1', 'n2', 'n3', 'n5', 'n6', 'n4'], "theirs' new box renamed past ours' n4, placed after the box before it in theirs");
  assert.ok(r.doc.nextId! >= 7);
  // What the merge brought onto ours is theirs' change list, its new ids renamed.
  assert.deepEqual(changesOf(ours, r.doc).features.map(c => [c.id, c.kind]), [['n3', 'edited'], ['n5', 'added'], ['n6', 'added']]);
  assert.deepEqual(r.dropped, []);
});

test('merge: conflicts are data, resolved per where', () => {
  const ours = edit(AB, 'n3', { height: 6 }), theirs = edit(AB, 'n3', { height: 9 });
  const r = mergeDocs(AB, ours, theirs);
  assert.ok('conflicts' in r);
  assert.deepEqual(r.conflicts.map((c: Conflict) => [c.code, c.where]), [['FEATURE_EDITED_BOTH', 'feature:n3']]);
  assert.match(r.conflicts[0].message, /^\[FEATURE_EDITED_BOTH\] /);
  eq(merged(mergeDocs(AB, ours, theirs, { resolve: { 'feature:n3': 'theirs' } })).doc, theirs);
  eq(merged(mergeDocs(AB, ours, theirs, { resolve: { 'feature:n3': 'ours' } })).doc, ours);
  // Deleted on one side, changed on the other.
  const f = fillet(AB, 3, 'n3.side0|n3.top', 1), del = deleteFeature(f, 4); assert.ok('doc' in del);
  const d = mergeDocs(f, del.doc, edit(f, 'n4', { radius: 2 }));
  assert.ok('conflicts' in d); assert.deepEqual(d.conflicts.map(c => [c.code, c.where]), [['FEATURE_DELETED_EDITED', 'feature:n4']]);
  assert.deepEqual(volumes(merged(mergeDocs(f, del.doc, edit(f, 'n4', { radius: 2 }), { resolve: { 'feature:n4': 'ours' } })).doc), volumes(del.doc));
  // Parameters, other fields and mates' ids.
  const p0 = { ...AB, parameters: { w: 1 } };
  const p = mergeDocs(p0, { ...p0, parameters: { w: 2 }, render: { a: 1 } as never }, { ...p0, parameters: { w: 3 }, render: { a: 2 } as never });
  assert.ok('conflicts' in p); assert.deepEqual(p.conflicts.map(c => [c.code, c.where]), [['PARAMETER_BOTH', 'parameter:w'], ['FIELD_BOTH', 'field:render']]);
  const m = (face: string): Mate => ({ id: 'm1', kind: 'coincident', a: { part: 'base', face }, b: { part: 'inst1', face: 'n1.bottom' } });
  const q = mergeDocs(AB, { ...AB, mates: [m('n1.top')] }, { ...AB, mates: [m('n3.top')] });
  assert.ok('conflicts' in q); assert.deepEqual(q.conflicts.map(c => [c.code, c.where]), [['ID_CLASH', 'mates:m1']]);
  // Disjoint parameter edits merge.
  const p2 = merged(mergeDocs({ ...AB, parameters: { w: 1, h: 1 } }, { ...AB, parameters: { w: 2, h: 1 } }, { ...AB, parameters: { w: 1, h: 3 } }));
  assert.deepEqual(p2.doc.parameters, { w: 2, h: 3 });
});

test('merge: a feature kept that uses one the other branch deleted — keep it, or drop what uses it', () => {
  // Ours deletes box B (n2, n3); theirs fillets B (n4 on n3, through n3's sketch n2).
  const del = deleteFeature(AB, 3); assert.ok('doc' in del); assert.deepEqual(del.doc.nodes.map(n => n.id), ['n0', 'n1']);
  const theirs = fillet(AB, 3, 'n3.side0|n3.top', 1);
  const r = mergeDocs(AB, del.doc, theirs);
  assert.ok('conflicts' in r); assert.deepEqual(r.conflicts.map(c => [c.code, c.where]), [['MERGE_DANGLING', 'feature:n3']]);
  // Keep it: B comes back with what it is built on, and the fillet.
  const keep = merged(mergeDocs(AB, del.doc, theirs, { resolve: { 'feature:n3': 'theirs' } }));
  assert.deepEqual(keep.doc.nodes.map(n => n.id), ['n0', 'n1', 'n2', 'n3', 'n4']);
  assert.deepEqual(volumes(keep.doc), volumes(theirs));
  // Drop: ours as it was, the fillet dropped.
  const drop = merged(mergeDocs(AB, del.doc, theirs, { resolve: { 'feature:n3': 'ours' } }));
  assert.deepEqual(drop.dropped, ['n4']); assert.deepEqual(volumes(drop.doc), volumes(del.doc));
});

test('merge: branches in a log — a merge version with two parents; up to date after; fast-forward when only one side moved', () => {
  let log = makeVersions(AB, { at: at(0), name: 'Start' });
  log = makeBranch(log, 'taller');
  log = applyBranch(log, 'taller', AB).log;
  log = makeVersion(log, edit(AB, 'n3', { height: 7 }), { at: at(1), name: 'Taller' }).log;
  log = applyBranch(log, 'main', readVersion(log, 'Taller')).log;
  const ours = fillet(AB, 1, 'n1.side0|n1.top', 1);
  log = makeVersion(log, ours, { at: at(2), name: 'Round' }).log;
  assert.equal(code(() => applyMerge(log, { from: 'main', working: ours, at: at(3) })), 'MERGE_SAME');
  assert.equal(code(() => applyMerge(log, { from: 'taller', working: AB, at: at(3) })), 'BRANCH_UNSAVED');
  const r = applyMerge(log, { from: 'taller', working: ours, at: at(3), name: 'Merged' });
  assert.ok('log' in r); ok(r.log);
  assert.equal(r.fastForward, false);
  assert.deepEqual(r.version!.parents, [log.branches[0].head, log.branches[1].head]);
  assert.deepEqual(volumes(r.doc), volumes(edit(ours, 'n3', { height: 7 })));
  eq(readVersion(r.log, 'Merged'), r.doc);
  assert.equal(code(() => applyMerge(r.log, { from: 'taller', working: r.doc, at: at(4) })), 'MERGE_UP_TO_DATE');
  // Fast-forward: a branch from main's head with one more version, merged back.
  let l2 = makeBranch(r.log, 'hole'); l2 = applyBranch(l2, 'hole', r.doc).log;
  const more = box(r.doc, 90, 4, 4);
  l2 = makeVersion(l2, more, { at: at(5) }).log;
  l2 = applyBranch(l2, 'main', more).log;
  const ff = applyMerge(l2, { from: 'hole', working: r.doc, at: at(6) });
  assert.ok('log' in ff); assert.equal(ff.fastForward, true); assert.equal(ff.version, null);
  eq(ff.doc, more); assert.equal(headOf(ff.log).id, headOf(ff.log, 'hole').id); ok(ff.log);
});

// ——— every shipped sample and model fixture


const FILES = [join(import.meta.dirname, '../samples/robots'), join(import.meta.dirname, 'fixtures'), join(import.meta.dirname, 'fixtures/o7-legacy')]
  .flatMap(dir => readdirSync(dir).filter(f => f.endsWith('.bcad')).map(f => join(dir, f)));

test('versions on real documents: the id form turns back into the same nodes; compare and merge of a document with itself change nothing', async () => {
  assert.ok(FILES.length >= 15, `${FILES.length} files`);
  for (const file of FILES) {
    const read = await readStudioFile(new Uint8Array(readFileSync(file)));
    assert.ok(!('error' in read), `${file}: ${'error' in read ? read.error : ''}`);
    const doc = read.doc, F = idFormOf(doc);
    assert.equal(canonical(indexForm(F.order, F.nodes).nodes), canonical(withIds(doc).nodes), `${file}: id form round trip`);
    assert.equal(changesOf(doc, doc).same, true, file);
    eq(merged(mergeDocs(doc, doc, doc)).doc, doc, file);
  }
});

test('merge on an assembly: one branch renames a placed part, the other moves another and adds a parameter', async () => {
  const read = await readStudioFile(new Uint8Array(readFileSync(join(import.meta.dirname, '../samples/robots/arm-6r.bcad'))));
  assert.ok(!('error' in read)); const doc = read.doc, insts = doc.instances ?? [];
  assert.ok(insts.length >= 2, 'the arm places its links');
  const ours: StudioDoc = { ...doc, instances: insts.map((x, i) => i === 0 ? { ...x, name: 'Base link' } : x) };
  const theirs: StudioDoc = { ...doc, parameters: { ...doc.parameters, reach: 400 }, instances: insts.map((x, i) => i === 1 ? { ...x, hidden: true } : x) };
  const r = merged(mergeDocs(doc, ours, theirs));
  assert.equal(r.doc.instances![0].name, 'Base link'); assert.equal(r.doc.instances![1].hidden, true);
  assert.equal(r.doc.parameters.reach, 400);
  const c = changesOf(doc, r.doc);
  assert.deepEqual(c.instances.map(x => [x.id, x.kind, x.fields!.map(f => f.path)]), [[insts[0].id, 'edited', ['name']], [insts[1].id, 'edited', ['hidden']]]);
  assert.deepEqual(c.parameters, [{ name: 'reach', kind: 'added', to: 400 }]);
  assert.deepEqual(c.features, []);
  // Both renaming the same part differently is a conflict on that part.
  const both = mergeDocs(doc, ours, { ...doc, instances: insts.map((x, i) => i === 0 ? { ...x, name: 'Pedestal' } : x) });
  assert.ok('conflicts' in both); assert.deepEqual(both.conflicts.map(x => [x.code, x.where]), [['ITEM_EDITED_BOTH', `instances:${insts[0].id}`]]);
});
