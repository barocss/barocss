import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { emptyDoc, rectanglePart, starterDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { acceptProposal, runTool } from '@barocss/cad-model/chat/tools';
import { checkVersions, makeVersion, makeVersions, turnLog, withTurnLog } from '@barocss/cad-model/versions/log';
import { serveMcp, stateFileStore, type StateFile } from '../server/cadMcp';

// CG6 VA-2 (DA-9): the agent's version actions over the chat server's turn: the state file carries the project's log as
// a turn does (its index, the documents it needs); a call that moves the log — even without changing the part — is
// written back with `versionsChanged`; a version whose document did not come is asked for (`versionsWanted`); the
// studio folds the turn's log into the project's.

type Reply = { result: { isError: boolean; content: { text: string }[]; structuredContent?: unknown }; error?: unknown };
async function exchange(path: string, calls: { name: string; arguments: Record<string, unknown> }[]): Promise<Reply[]> {
  const input = new PassThrough(), output = new PassThrough(), replies: Reply[] = [];
  let buffer = '';
  output.on('data', data => { buffer += data; let nl: number; while ((nl = buffer.indexOf('\n')) >= 0) { replies.push(JSON.parse(buffer.slice(0, nl)) as Reply); buffer = buffer.slice(nl + 1); } });
  const served = serveMcp(stateFileStore(path), input, output);
  calls.forEach((params, i) => input.write(JSON.stringify({ jsonrpc: '2.0', id: i + 1, method: 'tools/call', params }) + '\n'));
  input.end(); await served;
  assert.equal(replies.length, calls.length); assert.ok(replies.every(r => !r.error));
  return replies;
}
const block = (d: StudioDoc, x: number): StudioDoc => withNode(withNode(d, { kind: 'sketch', profile: 'rectangle', min: [x, 0], max: [x + 10, 10] }), { kind: 'extrude', sketch: d.nodes.length, height: 10 });

test('MCP: a turn\'s version log — a version made without changing the part is written back; an old version asked for; folded into the project\'s', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-versions-state-')), path = join(dir, 'state.json');
  try {
    const a = starterDoc(), b = block(a, 100), c = block(b, 200);
    let full = makeVersions(a, { at: '2026-10-24T10:00:00Z', name: 'A' });
    full = makeVersion(full, b, { at: '2026-10-24T10:01:00Z', name: 'B' }).log;
    full = makeVersion(full, c, { at: '2026-10-24T10:02:00Z', name: 'C' }).log;
    const sent = turnLog(full).log;
    assert.equal(Object.keys(sent.snapshots).length, 1, 'only the head (C) goes with the turn');
    const working = block(c, 300);
    const initial = JSON.stringify({ doc: working, changed: false, version: 0, versions: sent } satisfies StateFile);
    writeFileSync(path, initial);
    const [requested] = await exchange(path, [{
      name: 'history', arguments: { action: 'approval_evidence', from: full.versions[0].id, to: full.versions[1].id, part: 'p1/p1' },
    }]);
    assert.equal(requested.result.isError, true);
    const ask = JSON.parse(readFileSync(path, 'utf8')) as StateFile;
    assert.equal(ask.versionsChanged, undefined);
    assert.equal(ask.changed, false);
    assert.deepEqual(ask.versions, sent);
    assert.deepEqual(ask.versionsWanted, full.versions.slice(0, 2).map(v => v.id));

    writeFileSync(path, initial);
    const replies = await exchange(path, [
      { name: 'history', arguments: { action: 'version', name: 'D' } },
      { name: 'history', arguments: { action: 'compare', from: 'A' } },
      { name: 'history', arguments: { action: 'versions' } },
    ]);
    assert.equal(replies[0].result.isError, false, replies[0].result.content[0].text);
    assert.equal(replies[1].result.isError, true); assert.match(replies[1].result.content[0].text, /\[VERSION_NOT_LOADED\]/);
    assert.deepEqual(JSON.parse(replies[2].result.content[0].text).versions.map((v: { name: string }) => v.name), ['D', 'C', 'B', 'A']);
    const file = JSON.parse(readFileSync(path, 'utf8')) as StateFile;
    assert.equal(file.changed, false, 'the part did not change'); assert.equal(file.versionsChanged, true);
    assert.deepEqual(file.versionsWanted, [full.versions[0].id], 'A asked for');
    // Folded into the project's: D added on main, every document there, the log whole.
    const back = withTurnLog(full, file.versions!);
    assert.deepEqual(back.kept, []); assert.deepEqual(back.log.versions.map(v => v.name), ['A', 'B', 'C', 'D']);
    assert.deepEqual(checkVersions(back.log), []);
    // The next turn carries A: compare from it now answers.
    writeFileSync(path, JSON.stringify({ doc: working, changed: false, version: 0, versions: turnLog(back.log, { wanted: file.versionsWanted }).log } satisfies StateFile));
    const [cmp] = await exchange(path, [{ name: 'history', arguments: { action: 'compare', from: 'A' } }]);
    assert.equal(cmp.result.isError, false, cmp.result.content[0].text);
    assert.deepEqual(JSON.parse(cmp.result.content[0].text).features.map((f: { kind: string }) => f.kind), Array(6).fill('added'), 'three blocks since A');
    assert.equal((JSON.parse(readFileSync(path, 'utf8')) as StateFile).versionsChanged, undefined, 'a read moves nothing');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('MCP saved approval preserves an opaque occurrence path that resembles a tool name', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-approval-state-')), path = join(dir, 'state.json');
  try {
    const plate: StudioDoc = rectanglePart(20, 10, 6);
    plate.parameters = { H: 6 };
    plate.nodes = plate.nodes.map(node => node.kind === 'extrude' ? { ...node, height: { parameter: 'H' } } : node);
    plate.requirements = [{ id: 'HEIGHT', source: '5 mm maximum', hard: true, check: { query: { fn: 'bbox', axis: 'z' }, op: '<=', value: 5, unit: 'mm' } }];
    const leaf = { id: 'set_parameters', name: 'Plate', doc: plate, position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] };
    const root: StudioDoc = { ...emptyDoc(), instances: [{ ...leaf, id: 'p1', doc: { ...emptyDoc(), instances: [leaf] } }] };
    const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
    const part = 'p1/set_parameters';
    const pending = await runTool({ doc: root, bodies: [] }, 'proposals', { action: 'propose', title: 'Correction',
      ops: [{ tool: 'features', args: { action: 'parameters', part, set: { H: 4 } } }] }, evaluate);
    assert.equal(pending.isError, false, pending.content);
    const approval = await acceptProposal(pending.state, 'P1', evaluate);
    if ('error' in approval) assert.fail(approval.error);
    const old = makeVersions(pending.state.doc, { at: '2026-11-11T01:00:00Z' });
    const current = makeVersion(old, approval.state.doc, { at: '2026-11-11T01:01:00Z' });
    const bytes = JSON.stringify({ doc: root, changed: false, version: 0, versions: current.log } satisfies StateFile);
    writeFileSync(path, bytes);
    const [response] = await exchange(path, [{ name: 'history', arguments: { action: 'approval_evidence', from: old.versions[0].id, to: current.version.id, part } }]);
    assert.equal(response.result.isError, false, response.result.content[0].text);
    const reply = JSON.parse(response.result.content[0].text);
    assert.deepEqual(response.result.structuredContent, reply);
    assert.equal(reply.part, part);
    assert.equal(JSON.parse(reply.files[0].text).part, part);
    assert.equal(readFileSync(path, 'utf8'), bytes);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
