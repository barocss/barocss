import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { starterDoc } from '@barocss/cad-model/engine/doc';
import { TOOLS } from '@barocss/cad-model/chat/tools';
import { v2Result } from '@barocss/cad-model/chat/groups';
import { SYSTEM_PROMPT_V2, TOOLS_V2, TOOLSET } from '@barocss/cad-model/chat/toolset';
import { TOOL_CONTRACT_V2, outputSchemaOf, validate } from '@barocss/cad-model/chat/contract';
import { serveMcp } from '../server/cadMcp';
import { claudeArgs } from '../server/chatServer';

// The studio's side of A5.3/O105/O105b (PKG-h, O112): the v2 tools as the MCP server and the chat server serve them —
// toolset.test.ts's server tests, kept with the servers when it moved into @barocss/cad-model.

const UNDERSCORED = TOOLS.map(t => t.name).filter(n => n.includes('_')), ONE_WORD = TOOLS.map(t => t.name).filter(n => !n.includes('_'));
/** The handler names a text still writes as tools: underscored ones not already an action's, one-word ones as "(name)" or "with name,". */
function handlerNamesIn(text: string): string[] {
  const words = new Set(text.match(/(?<![.\w])[a-z]+(?:_[a-z]+)+\b/g) ?? []);
  return [...UNDERSCORED.filter(n => words.has(n)), ...ONE_WORD.filter(n => text.includes(`(${n})`) || text.includes(`with ${n},`))];
}

test('the MCP server: the v2 contract, 13 tools, v2 calls, structured results for read actions; a handler\'s name refused', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-v2-')), statePath = join(dir, 'state.json');
  writeFileSync(statePath, JSON.stringify({ doc: starterDoc(), changed: false }));
  const input = new PassThrough(), output = new PassThrough(), served = serveMcp(statePath, input, output);
  type Rpc = { id?: number; result?: Record<string, any>; error?: { code: number; message: string } };
  const waiting = new Map<number, (m: Rpc) => void>(); let buf = '', id = 0;
  output.on('data', d => { buf += d; let nl; while ((nl = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, nl)) as Rpc; buf = buf.slice(nl + 1); waiting.get(m.id!)?.(m); } });
  const request = (method: string, params?: unknown) => new Promise<Rpc>(res => { const n = ++id; waiting.set(n, res); input.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
  assert.equal((await request('initialize', { protocolVersion: '2025-06-18' })).result!.serverInfo.version, TOOL_CONTRACT_V2);
  const list = (await request('tools/list')).result!.tools as { name: string }[];
  assert.deepEqual(list.map(t => t.name), TOOLS_V2.map(t => t.name));
  const mass = (await request('tools/call', { name: 'query', arguments: { action: 'mass' } })).result!;
  assert.equal(mass.isError, false); assert.deepEqual(mass.structuredContent, JSON.parse(mass.content[0].text));
  assert.deepEqual(validate(outputSchemaOf('mass_properties')!, mass.structuredContent), []);
  const old = await request('tools/call', { name: 'mass_properties', arguments: {} });
  assert.equal(old.error?.code, -32602, 'a handler\'s name is not a tool'); assert.equal(old.result, undefined);
  const edit = (await request('tools/call', { name: 'features', arguments: { action: 'edit', index: 1, values: { h: 12 } } })).result!;
  assert.equal(edit.isError, false, edit.content[0].text); assert.equal(edit.structuredContent, undefined);
  // (query.select is select: the selection is saved for the studio.)
  const sel = (await request('tools/call', { name: 'query', arguments: { action: 'select', faces: ['n1.top'] } })).result!;
  assert.equal(sel.isError, false, sel.content[0].text);
  input.end(); await served;
  const saved = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.ok(saved.changed); assert.ok(saved.selection?.faces?.length === 1, JSON.stringify(saved.selection));
});

test('the chat server lists the v2 tools it serves, with their prompt', () => {
  const args = claudeArgs({ mcpConfig: '{}', model: 'm' }), allowed = args[args.indexOf('--allowedTools') + 1].split(','), prompt = args[args.indexOf('--system-prompt') + 1];
  assert.deepEqual(allowed, TOOLSET.tools.map(t => `mcp__cad__${t.name}`));
  assert.equal(prompt, SYSTEM_PROMPT_V2);
});

test('O105b through MCP: refusals and hints name v2 tools — no requirements, no snapshot, L2\'s proposal; a stored call in a result read as its v2 call', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-v2-text-')), statePath = join(dir, 'state.json');
  writeFileSync(statePath, JSON.stringify({ doc: starterDoc(), changed: false }));
  const input = new PassThrough(), output = new PassThrough(), served = serveMcp(statePath, input, output);
  type Rpc = { id?: number; result?: { isError: boolean; content: { text: string }[] } };
  const waiting = new Map<number, (m: Rpc) => void>(); let buf = '', id = 0;
  output.on('data', d => { buf += d; let nl; while ((nl = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, nl)) as Rpc; buf = buf.slice(nl + 1); waiting.get(m.id!)?.(m); } });
  const call = async (name: string, args: object) => { const n = ++id; const m = await new Promise<Rpc>(res => { waiting.set(n, res); input.write(JSON.stringify({ jsonrpc: '2.0', id: n, method: 'tools/call', params: { name, arguments: args } }) + '\n'); }); return { isError: m.result!.isError, text: m.result!.content[0].text }; };
  const peg = { action: 'command', command: 'cylinder', values: { r: 2, h: 5, x: 90, y: 0 } };
  const said = [
    [await call('requirements', { action: 'check' }), /requirements\.set first/],
    [await call('history', { action: 'best' }), /run requirements\.check first/],
    [await call('features', peg), /\(proposals\.propose\)/],
  ] as const;
  for (const [r, re] of said) { assert.ok(r.isError, r.text); assert.match(r.text, re); assert.deepEqual(handlerNamesIn(r.text), [], r.text); }
  assert.ok(!(await call('proposals', { action: 'propose', title: 'a peg', ops: [{ tool: 'features', args: peg }] })).isError);
  const listedOps = await call('proposals', { action: 'list' });
  assert.deepEqual(handlerNamesIn(listedOps.text), [], listedOps.text);
  assert.equal(JSON.parse(listedOps.text).proposals.at(-1).ops, 1);
  input.end(); await served;
  // (A stored call a result carries — a proposal's op — reads as its v2 call; keys and other values as they are.)
  assert.deepEqual(JSON.parse(v2Result(JSON.stringify({ ops: [{ tool: 'run_command', args: { command: 'box' } }, { tool: 'nope', args: {} }], wall_thickness: 2, note: 'see get_part_summary' }))),
    { ops: [{ tool: 'features', args: { command: 'box', action: 'command' } }, { tool: 'nope', args: {} }], wall_thickness: 2, note: 'see query.summary' });
  assert.equal(v2Result('not JSON: run check_spec first'), 'not JSON: run requirements.check first');
});
