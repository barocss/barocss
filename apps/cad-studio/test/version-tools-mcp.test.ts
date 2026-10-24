import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { starterDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { checkVersions, makeVersion, makeVersions, turnLog, withTurnLog } from '@barocss/cad-model/versions/log';
import { serveMcp, stateFileStore, type StateFile } from '../server/cadMcp';

// CG6 VA-2 (DA-9): the agent's version actions over the chat server's turn: the state file carries the project's log as
// a turn does (its index, the documents it needs); a call that moves the log — even without changing the part — is
// written back with `versionsChanged`; a version whose document did not come is asked for (`versionsWanted`); the
// studio folds the turn's log into the project's.

type Reply = { result: { isError: boolean; content: { text: string }[] }; error?: unknown };
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
    writeFileSync(path, JSON.stringify({ doc: working, changed: false, version: 0, versions: sent } satisfies StateFile));
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
