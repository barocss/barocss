import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { rectanglePart, starterDoc } from '@barocss/cad-model/engine/doc';
import { GROUPS } from '@barocss/cad-model/chat/groups';
import { TOOLSET } from '@barocss/cad-model/chat/toolset';
import { TOOL_CONTRACT_V2, outputSchemaOf, validate } from '@barocss/cad-model/chat/contract';
import { serveMcp, TOOLS_LISTED } from '../server/cadMcp';
import { docStore } from '../server/cadDoc';

// The studio's side of A5.1 (PKG-h, O112): the MCP server listing the v2 tools and returning them — tool-contract.test.ts's
// server test, kept with the server when it moved into @barocss/cad-model.

test('the MCP server: its contract version, the v2 tools with titles and annotations, structured results; a handler\'s own name refused', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-contract-')), statePath = join(dir, 'state.json');
  writeFileSync(statePath, JSON.stringify({ doc: starterDoc(), changed: false }));
  const input = new PassThrough(), output = new PassThrough(), served = serveMcp(statePath, input, output);
  type Rpc = { id?: number; result?: Record<string, any>; error?: { code: number; message?: string } };
  const waiting = new Map<number | null, (m: Rpc) => void>(); let buf = '', id = 0;
  output.on('data', d => { buf += d; let nl; while ((nl = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, nl)) as Rpc; buf = buf.slice(nl + 1); waiting.get(m.id ?? null)?.(m); } });
  const request = (method: string, params?: unknown) => new Promise<Rpc>(res => { const n = ++id; waiting.set(n, res); input.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
  const init = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  assert.deepEqual([init.result!.protocolVersion, init.result!.serverInfo.version, init.result!.capabilities.tools], ['2025-06-18', TOOL_CONTRACT_V2, {}]);
  const list = (await request('tools/list')).result!.tools as { name: string; title: string; annotations: { readOnlyHint: unknown }; inputSchema: { type: string }; outputSchema?: unknown }[];
  assert.deepEqual(list.map(t => t.name), Object.keys(GROUPS));
  for (const t of list) {
    assert.ok(t.title && t.annotations && typeof t.annotations.readOnlyHint === 'boolean' && t.inputSchema.type === 'object', t.name);
    assert.equal(!!t.outputSchema, !!outputSchemaOf(t.name), t.name);
  }
  // A read tool: its result as text and as structured content, the same, matching its schema.
  const read = (await request('tools/call', { name: 'query', arguments: { action: 'mass' } })).result!;
  assert.equal(read.isError, false);
  assert.deepEqual(read.structuredContent, JSON.parse(read.content[0].text));
  assert.deepEqual(validate(outputSchemaOf('mass_properties')!, read.structuredContent), []);
  // A change: no structured content (no output schema); a refused call: isError, none either.
  const change = (await request('tools/call', { name: 'requirements', arguments: { action: 'set', requirements: [{ id: 'R1', source: '64 long', hard: true, check: { op: '==', query: { fn: 'bbox', axis: 'x' }, value: 64, tol: 0.1 } }] } })).result!;
  assert.equal(change.isError, false, change.content[0].text); assert.equal(change.structuredContent, undefined);
  const refused = (await request('tools/call', { name: 'query', arguments: { action: 'section', axis: 'q', at: 1 } })).result!;
  assert.equal(refused.isError, true); assert.equal(refused.structuredContent, undefined);
  // (A handler's own name is not a tool: a JSON-RPC error naming the tools, nothing run.)
  const handler = await request('tools/call', { name: 'mass_properties', arguments: {} });
  assert.equal(handler.error!.code, -32602); assert.match(String(handler.error!.message), /Unknown tool: mass_properties\. The tools are model, features, query/);
  // JSON-RPC errors: an unknown method, a line that is not JSON.
  assert.equal((await request('resources/list')).error!.code, -32601);
  const bad = new Promise<Rpc>(res => waiting.set(null, res)); input.write('not json\n');
  assert.equal((await bad).error!.code, -32700);
  input.end(); await served;
  // The change was saved to the state file.
  assert.ok(JSON.parse(readFileSync(statePath, 'utf8')).changed);
  assert.deepEqual(TOOLS_LISTED.map(t => t.name), TOOLSET.tools.map(t => t.name));
});

test('D580: the native-file MCP preserves an unresolved ID and never qualifies its estimated mass', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-unresolved-material-'));
  const path = join(dir, 'fixture.bcad');
  // This literal matches a v1 tool handler. It remains a material ID in the v2 response.
  const id = 'check_spec';
  const bytes = JSON.stringify({
    ...rectanglePart(10, 10, 10), bodies: { b1: { material: id } },
    requirements: [{ id: 'M', source: 'Mass at most 3 g', hard: true, check: { query: { fn: 'mass' }, op: '<=', value: 3 } }],
  });
  writeFileSync(path, bytes);
  const input = new PassThrough(), output = new PassThrough();
  const lines = createInterface({ input: output });
  const replies = lines[Symbol.asyncIterator]();
  const served = serveMcp(docStore(path), input, output);
  let sequence = 0;
  const call = async (name: string, action: string, handler: string) => {
    const callId = ++sequence;
    input.write(JSON.stringify({ jsonrpc: '2.0', id: callId, method: 'tools/call',
      params: { name, arguments: { action, ...(action === 'summary' ? { response_format: 'concise' } : {}) } } }) + '\n');
    const reply = await replies.next();
    assert.equal(reply.done, false);
    const message = JSON.parse(reply.value);
    assert.equal(message.id, callId);
    assert.equal(message.result?.isError, false, JSON.stringify(message));
    const result = message.result.structuredContent;
    assert.deepEqual(result, JSON.parse(message.result.content[0].text));
    assert.deepEqual(validate(outputSchemaOf(handler)!, result), []);
    return result;
  };
  try {
    const mass = await call('query', 'mass', 'mass_properties');
    assert.deepEqual([mass.bodies[0].body, mass.bodies[0].mass, mass.bodies[0].assumed, mass.bodies[0].unresolved_material], ['b1', 2.7, true, id]);
    assert.match(mass.note, /estimate/);
    const summary = await call('query', 'summary', 'get_part_summary');
    assert.equal(summary.facts.mass_assumed, true);
    assert.equal(summary.facts.materials[0].unresolved_material, id);
    const checked = await call('requirements', 'check', 'check_spec');
    assert.deepEqual(checked.summary, { pass: 0, fail: 0, unknown: 1, hard_failing: 0 });
    assert.equal(checked.policy.best.hard_fulfilled, false);
    assert.match(checked.unknowns[0].why, /b1.*check_spec/);
    assert.equal(readFileSync(path, 'utf8'), bytes);
  } finally {
    input.end();
    await served;
    output.end();
    lines.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
