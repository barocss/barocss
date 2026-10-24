import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '../src/engine/evaluate';
import { starterDoc, type StudioDoc } from '../src/engine/doc';
import { dispatchTool, type ChatState } from '../src/chat/tools';
import { canonical } from '../src/util/revision';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readStudioFile } from '../src/engine/container';
import { wantedOf } from '../src/versions/tools';
import { checkVersions, makeBranch, makeVersion, makeVersions, readVersion, turnLog, withTurnLog } from '../src/versions/log';

// CG6 VA-1 (DA-8): the agent's version actions, called as the agent calls them (the history tool's actions, v2). The
// oracle: each result read against the version model's own verbs on the same log, and the part's volumes from the
// kernel after a restore, a switch and a merge.

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok); return { doc, bodies: r.bodies }; }
const call = async (s: ChatState, action: string, args: Record<string, unknown> = {}) => {
  const out = await dispatchTool(s, 'history', { action, ...args }, evaluate);
  return { ...out, body: JSON.parse(out.content) as Record<string, unknown> };
};
const cmd = async (s: ChatState, values: Record<string, unknown>) => { const out = await dispatchTool(s, 'features', { action: 'command', command: 'box', values }, evaluate); assert.ok(!out.isError, out.content); return out.state; };
const volume = (s: ChatState) => Math.round(s.bodies.reduce((v, b) => v + (b.volume ?? 0), 0));

test('version actions: make, list, compare, restore — through the history tool, the log kept in the state', async () => {
  let s = await stateOf(starterDoc());
  // No log yet: the list says so, compare and restore refuse.
  const none = await call(s, 'versions');
  assert.deepEqual([none.body.current, none.body.versions], [null, []]); assert.match(String(none.body.note), /history\.version makes the first/);
  assert.equal((await call(s, 'restore_version', { id: 'x' })).isError, true);
  const v1 = await call(s, 'version', { name: 'Start' });
  assert.ok(!v1.isError && !v1.changed, v1.content); s = v1.state;
  assert.equal(s.versions!.versions.length, 1); assert.equal((v1.body.version as { by: string }).by, 'agent');
  assert.match((await call(s, 'version')).content, /\[VERSION_NO_CHANGE\]/, 'nothing changed since');
  const start = volume(s);
  s = await cmd(s, { w: 10, d: 10, h: 10, x: 100 });
  const v2 = await call(s, 'version', { name: 'Block', note: 'a 10 mm block' }); s = v2.state;
  const list = await call(s, 'versions');
  assert.deepEqual((list.body.versions as { name: string }[]).map(v => v.name), ['Block', 'Start']);
  assert.deepEqual(list.body.branches, [{ name: 'main', head: s.versions!.branches[0].head, from: s.versions!.versions[0].id }]);
  // Compare: Start → current is the block's two features, added.
  const c = await call(s, 'compare', { from: 'Start' });
  assert.equal(c.isError, false, c.content);
  assert.deepEqual((c.body.features as { kind: string; feature: string }[]).map(f => [f.kind, f.feature]), [['added', 'sketch'], ['added', 'extrude']]);
  // Restore Start: the part as it was (the kernel's volume), the log unchanged.
  const r = await call(s, 'restore_version', { id: 'Start' });
  assert.ok(!r.isError && r.changed, r.content);
  assert.equal(volume(r.state), start);
  assert.equal(canonical(r.state.versions), canonical(s.versions), 'restoring rewinds nothing');
  assert.deepEqual(checkVersions(r.state.versions), []);
});

test('version actions: a branch, a switch refused with unsaved work, a clean merge, then conflicts as data answered', async () => {
  let s = (await call(await stateOf(starterDoc()), 'version', { name: 'Base' })).state;
  const base = volume(s);
  s = (await call(s, 'branch', { name: 'wide' })).state;
  assert.equal(s.versions!.current, 'main', 'a branch is not switched to');
  // Unsaved work refuses a switch; discard drops it.
  const edited = await cmd(s, { w: 5, d: 5, h: 5, x: -50 });
  const refused = await call(edited, 'switch', { branch: 'wide' });
  assert.ok(refused.isError); assert.match(refused.content, /\[BRANCH_UNSAVED\]/);
  let sw = await call(edited, 'switch', { branch: 'wide', discard: true });
  assert.ok(!sw.isError && sw.changed, sw.content); s = sw.state;
  assert.equal(s.versions!.current, 'wide'); assert.equal(volume(s), base);
  // wide: a block along X; main: a block along Y; merged: both.
  s = await cmd(s, { w: 10, d: 10, h: 10, x: 100 }); s = (await call(s, 'version', { name: 'Wide' })).state;
  sw = await call(s, 'switch', { branch: 'main' }); s = sw.state;
  s = await cmd(s, { w: 10, d: 10, h: 10, y: 100 }); s = (await call(s, 'version', { name: 'Deep' })).state;
  const m = await call(s, 'merge', { from: 'wide' });
  assert.ok(!m.isError && m.changed, m.content); s = m.state;
  assert.equal(volume(s), base + 2000);
  assert.equal((m.body.version as { merge: boolean }).merge, true);
  assert.equal(canonical(readVersion(s.versions!, s.versions!.branches[0].head)), canonical(s.versions!.snapshots[s.versions!.versions.at(-1)!.snapshot]));
  assert.match((await call(s, 'merge', { from: 'wide' })).content, /\[MERGE_UP_TO_DATE\]/);
  // The same parameter set two ways: conflicts come back as data, nothing merged; answered, merged.
  s = (await call(s, 'branch', { name: 'thick' })).state;
  s = (await call(s, 'switch', { branch: 'thick' })).state;
  const setT = async (st: ChatState, v: number) => { const o = await dispatchTool(st, 'features', { action: 'parameters', add: { T: v } }, evaluate); assert.ok(!o.isError, o.content); return o.state; };
  s = (await call(await setT(s, 5), 'version', { name: 'T5' })).state;
  s = (await call(s, 'switch', { branch: 'main' })).state;
  s = (await call(await setT(s, 3), 'version', { name: 'T3' })).state;
  const c = await call(s, 'merge', { from: 'thick' });
  assert.equal(c.isError, false); assert.equal(c.changed, false); assert.equal(c.body.ok, false);
  assert.deepEqual(c.body.conflicts, [{ code: 'PARAMETER_BOTH', where: 'parameter:T', message: '[PARAMETER_BOTH] parameter “T” was changed on both branches', ours: 3, theirs: 5 }]);
  assert.equal(c.state, s, 'nothing merged');
  assert.equal((await call(s, 'merge', { from: 'thick', resolve: { 'parameter:T': 'maybe' } })).isError, true);
  const done = await call(s, 'merge', { from: 'thick', resolve: { 'parameter:T': 'theirs' } });
  assert.ok(!done.isError && done.changed, done.content);
  assert.equal(done.state.doc.parameters.T, 5);
  assert.deepEqual(checkVersions(done.state.versions), []);
});

// ——— VA-2: a turn carries the index and only the documents it needs

test('a turn\'s log: the index whole, documents for the heads and merge bases; others refused NOT_LOADED and asked for, then sent', async () => {
  let s = (await call(await stateOf(starterDoc()), 'version', { name: 'A' })).state;
  s = await cmd(s, { w: 10, d: 10, h: 10, x: 100 }); s = (await call(s, 'version', { name: 'B' })).state;
  s = (await call(s, 'branch', { name: 'side', from: 'A' })).state;
  s = await cmd(s, { w: 10, d: 10, h: 10, y: 100 }); s = (await call(s, 'version', { name: 'C' })).state;
  const full = s.versions!, byName = (n: string) => full.versions.find(v => v.name === n)!;
  const t = turnLog(full);
  assert.deepEqual(t.log.versions, full.versions, 'the index whole');
  assert.deepEqual(Object.keys(t.log.snapshots).sort(), [byName('C').snapshot, byName('A').snapshot].sort(), "main's head C, side's head A — also their shared version");
  // B's document is not with the turn: compare from it is refused and asked for; sent with the next turn, it compares.
  const turn = { ...s, versions: t.log };
  const r = await call(turn, 'compare', { from: 'B' });
  assert.ok(r.isError); assert.match(r.content, /\[VERSION_NOT_LOADED\]/); assert.deepEqual(wantedOf(r.content), [byName('B').id]);
  const next = turnLog(full, { wanted: wantedOf(r.content) });
  const ok = await call({ ...s, versions: next.log }, 'compare', { from: 'B' });
  assert.equal(ok.isError, false, ok.content);
  // A cap: only the current head goes, the rest named omitted.
  const tiny = turnLog(full, { cap: 1 });
  assert.deepEqual(Object.keys(tiny.log.snapshots), [byName('C').snapshot]); assert.equal(tiny.omitted.length, 1);
});

test('a turn\'s log brought back: its versions added, the person\'s made meanwhile kept, a branch both moved left the person\'s', async () => {
  let s = (await call(await stateOf(starterDoc()), 'version', { name: 'A' })).state;
  const sent = turnLog(s.versions!).log;
  // The turn: a version on main, a branch.
  let turn: ChatState = { ...(await cmd({ ...s, versions: sent }, { w: 10, d: 10, h: 10, x: 100 })) };
  turn = (await call(turn, 'version', { name: 'Agent' })).state; turn = (await call(turn, 'branch', { name: 'try' })).state;
  const back = withTurnLog(s.versions!, turn.versions!);
  assert.deepEqual(back.kept, []); assert.deepEqual(back.log.versions.map(v => v.name), ['A', 'Agent']);
  assert.deepEqual(back.log.branches.map(b => b.name), ['main', 'try']); assert.equal(back.log.branches[0].head, turn.versions!.branches[0].head);
  assert.deepEqual(checkVersions(back.log), []);
  // Meanwhile the person made a version on main too: both versions kept, main stays the person's, named.
  s = await cmd(s, { w: 5, d: 5, h: 5, y: -50 });
  const person = (await call(s, 'version', { name: 'Person' })).state.versions!;
  const both = withTurnLog(person, turn.versions!);
  assert.deepEqual(both.kept, ['main']); assert.deepEqual(both.log.versions.map(v => v.name), ['A', 'Person', 'Agent']);
  assert.equal(both.log.branches.find(b => b.name === 'main')!.head, person.branches[0].head);
  assert.deepEqual(checkVersions(both.log), []);
});

test('a turn\'s payload on a 20-version project (the arm-6r assembly): the index and two documents, not twenty', async () => {
  const read = await readStudioFile(new Uint8Array(readFileSync(join(import.meta.dirname, '../samples/robots/arm-6r.bcad'))));
  assert.ok(!('error' in read)); let doc = read.doc;
  let log = makeVersions(doc, { at: '2026-10-24T00:00:00Z', name: 'v1' });
  for (let k = 2; k <= 20; k++) {
    // (Each version moves a placed part a little and changes a parameter: what a working day's versions look like.)
    doc = { ...doc, parameters: { ...doc.parameters, step: k }, instances: doc.instances!.map((i, j) => j === k % doc.instances!.length ? { ...i, position: [i.position[0] + 1, i.position[1], i.position[2]] as [number, number, number] } : i) };
    log = makeVersion(log, doc, { at: `2026-10-24T00:${String(k).padStart(2, '0')}:00Z`, name: `v${k}` }).log;
  }
  log = makeBranch(log, 'side', { from: 'v10' });
  const whole = JSON.stringify(log).length, turn = JSON.stringify(turnLog(log).log).length, one = JSON.stringify(doc).length, index = JSON.stringify({ ...log, snapshots: {} }).length;
  console.log(`20 versions of arm-6r: the whole log ${whole} characters; a turn's ${turn} (index ${index}, one document ${one}); ${(100 * turn / whole).toFixed(1)}%`);
  assert.ok(turn <= index + 3 * one, 'the index and at most three documents (main\'s head, side\'s head, their shared version)');
  assert.ok(turn < whole / 5);
});
