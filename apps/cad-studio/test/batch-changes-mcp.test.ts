import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { emptyDoc } from '@barocss/cad-model/engine/doc';
import { encodeStudioFile } from '@barocss/cad-model/engine/container';
import { docStore, openModel } from '../server/cadDoc';
import { serveMcp, stateFileStore, type McpStore, type StateFile } from '../server/cadMcp';

type Call = { name: string; arguments: Record<string, unknown> };
type Reply = { result: { isError: boolean; content: { text: string }[] }; error?: unknown };
async function exchange(store: McpStore, calls: Call[]): Promise<Reply[]> {
  const input = new PassThrough(), output = new PassThrough(), replies: Reply[] = [];
  let buffer = '';
  output.on('data', data => {
    buffer += data; let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) { replies.push(JSON.parse(buffer.slice(0, nl)) as Reply); buffer = buffer.slice(nl + 1); }
  });
  const served = serveMcp(store, input, output);
  calls.forEach((params, i) => input.write(JSON.stringify({ jsonrpc: '2.0', id: i + 1, method: 'tools/call', params }) + '\n'));
  input.end(); await served;
  assert.equal(replies.length, calls.length); assert.ok(replies.every(r => !r.error));
  return replies;
}
const fields = { purpose: { value: 'A shaft support', basis: 'stated', source: 'A shaft support' } };
const batch: Call = { name: 'features', arguments: { action: 'batch', ops: [{ tool: 'requirements', args: { action: 'brief', fields }, opId: 'purpose' }] } };
const source = 'brief({finish: {value: "matte", basis: "assumed", why: "test finish"}})';
const script: Call = { name: 'model', arguments: { source } };
const refused: Call = { name: 'features', arguments: { action: 'batch', ops: [{ tool: 'assembly', args: { action: 'add_part', name: 'Shaft' } }] } };

test('MCP captures and versions document-only batches/scripts, and does not save dry runs, failures or no-ops', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-batch-state-')), path = join(dir, 'state.json');
  try {
    writeFileSync(path, JSON.stringify({ doc: emptyDoc(), changed: false, version: 0 }));
    const store = stateFileStore(path), saved: Parameters<McpStore['save']>[0][] = [];
    const tracked: McpStore = { open: store.open, save(s, why) { saved.push(s); return store.save(s, why); } };
    const replies = await exchange(tracked, [batch, script, batch, script,
      { name: 'model', arguments: { source: 'const x = 1' } },
      { ...batch, arguments: { ...batch.arguments, dryRun: true } },
      { name: 'model', arguments: { source: 'brief({quantity: {value: 4, basis: "assumed", why: "test"}})', dryRun: true } },
      refused,
      { name: 'model', arguments: { source: `${source}\nbox({w: -1})` } },
    ]);
    assert.deepEqual(replies.map(r => r.result.isError), [false, false, false, false, false, false, false, true, true]);
    assert.equal(JSON.parse(replies[7].result.content[0].text).code, 'needs_approval');
    assert.deepEqual(saved.map(s => s.version), [1, 2]);
    const back = JSON.parse(readFileSync(path, 'utf8')) as StateFile;
    assert.equal(back.changed, true); assert.equal(back.version, 2); assert.equal(back.ops?.length, 2);
    assert.equal(back.ops?.[0].tool, 'apply_ops'); assert.deepEqual(back.ops?.[0].effect.fields.brief, back.doc.brief && { version: back.doc.brief.version, purpose: back.doc.brief.purpose });
    assert.equal(back.ops?.[1].tool, 'run_script'); assert.deepEqual(back.ops?.[1].effect.fields.brief, back.doc.brief);
    assert.equal(back.doc.brief?.purpose?.value, 'A shaft support'); assert.equal(back.doc.brief?.finish?.value, 'matte');
    assert.equal(back.doc.instances?.length ?? 0, 0);
    const bytes = readFileSync(path);
    // A new MCP session reads the saved document. A repeated value makes no new save or version.
    await exchange(tracked, [script]);
    assert.equal(saved.length, 2); assert.deepEqual(readFileSync(path), bytes);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('MCP .bcad saves document-only batch/script changes and reopens them in a fresh session', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-batch-doc-')), path = join(dir, 'part.bcad');
  try {
    writeFileSync(path, encodeStudioFile(emptyDoc()));
    const replies = await exchange(docStore(path), [batch, script]);
    for (const r of replies) assert.equal(r.result.isError, false, r.result.content[0].text);
    const back = await openModel(path); assert.ok('doc' in back);
    assert.equal(back.doc.brief?.purpose?.value, 'A shaft support'); assert.equal(back.doc.brief?.finish?.value, 'matte');
    const bytes = readFileSync(path);
    const again = await exchange(docStore(path), [script, refused, { ...script, arguments: { source: `${source}\nbox({w: -1})` } }]);
    assert.deepEqual(again.map(r => r.result.isError), [false, true, true]);
    assert.deepEqual(readFileSync(path), bytes, 'fresh-session no-op and refusals preserve the saved file');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
