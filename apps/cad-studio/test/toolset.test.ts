import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, starterDoc, type StudioDoc } from '../src/engine/doc';
import { acceptProposal, dispatchTool, runTool, SYSTEM_PROMPT, TOOLS, type ChatState } from '../src/chat/tools';
import { GROUPS, V1_OF, V2_OF, v1Call, viaV2 } from '../src/chat/groups';
import { listed, SYSTEM_PROMPT_V2, TOOLS_V2, toolsetOf } from '../src/chat/toolset';
import { TOOL_CONTRACT_V2, breakingChanges, contractOf, validate, outputSchemaOf, type ContractEntry } from '../src/chat/contract';
import { serveMcp, TOOLS_LISTED } from '../server/cadMcp';
import { claudeArgs } from '../server/chatServer';

// A5.3 (O11): the consolidated tools (`barocss-cad-tools-v2`) — 13 tools whose actions are the v1 tools, listed in at
// most 15k characters; `describe` for the detail; the same gates; ops kept as v1 calls; the MCP and chat servers
// switched by CAD_TOOLSET; frozen in tools-v2.json. (The whole suite also replays through v2: CAD_TOOLS_VIA_V2=1.)

const FROZEN = resolve(process.cwd(), 'src/chat/tools-v2.json');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const read = (content: string) => JSON.parse(content) as Record<string, any>;
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok); return { doc, bodies: r.bodies }; }

test('what a model reads every turn: v2 at most 15k characters, against v1; both system prompts', () => {
  const v1 = JSON.stringify(TOOLS_LISTED).length, v2 = JSON.stringify(TOOLS_V2.map(listed)).length;
  console.log(`v1: ${TOOLS.length} tools, tools/list ${v1} characters, system prompt ${SYSTEM_PROMPT.length}; v2: ${TOOLS_V2.length} tools, tools/list ${v2} characters, system prompt ${SYSTEM_PROMPT_V2.length}; per turn ${v1 + SYSTEM_PROMPT.length} → ${v2 + SYSTEM_PROMPT_V2.length}`);
  assert.equal(TOOLS_V2.length, 13);
  assert.ok(v2 <= 15000, `${v2} characters`);
  assert.ok(SYSTEM_PROMPT_V2.length < SYSTEM_PROMPT.length + 400, 'the v2 prompt only renames and adds one line');
});

test('every v1 tool is exactly one v2 action, and the v2 prompt names only v2 tools', () => {
  assert.deepEqual([...V2_OF.keys()].sort(), TOOLS.map(t => t.name).sort());
  assert.equal(V1_OF.size, TOOLS.length);
  for (const name of Object.keys(GROUPS)) assert.ok(!TOOLS.some(t => t.name === name), `${name} is not also a v1 name`);
  // (No v1 name with an underscore is left in the v2 prompt, and every group.action it names exists.)
  assert.deepEqual(SYSTEM_PROMPT_V2.match(/(?<![.\w])[a-z]+(?:_[a-z]+)+\b/g)?.filter(w => V2_OF.has(w)) ?? [], []);
  for (const m of SYSTEM_PROMPT_V2.matchAll(/\b([a-z]+)\.([a-z_]+)\b/g)) if (m[1] in GROUPS) assert.ok(V1_OF.has(`${m[1]}.${m[2]}`), m[0]);
  assert.match(SYSTEM_PROMPT_V2, /query\.mass, query\.interference \(overlap and clearance\), query\.section, query\.wall and query\.draft/);
  assert.match(SYSTEM_PROMPT_V2, /propose it \(proposals\.propose\)/);
  assert.match(SYSTEM_PROMPT_V2, /When the user asks for options or a review, or a change is risky, propose it/, 'the English word stays');
  // The model tool's description names v2 tools too.
  assert.ok(!/apply_ops|run_command/.test(TOOLS_V2.find(t => t.name === 'model')!.description));
});

test('the v2 contract is frozen in tools-v2.json; a breaking change needs v3', () => {
  const now = contractOf(TOOLS_V2);
  if (process.env.UPDATE_TOOL_CONTRACT) {
    let before: ContractEntry[] = []; try { before = JSON.parse(readFileSync(FROZEN, 'utf8')).tools; } catch { /* first record */ }
    assert.deepEqual(breakingChanges(before, now), [], 'breaking changes need barocss-cad-tools-v3, not a rewrite');
    writeFileSync(FROZEN, JSON.stringify({ contract: TOOL_CONTRACT_V2, tools: now }, null, 1) + '\n');
  }
  const frozen = JSON.parse(readFileSync(FROZEN, 'utf8')) as { contract: string; tools: ContractEntry[] };
  assert.equal(frozen.contract, TOOL_CONTRACT_V2);
  assert.deepEqual(breakingChanges(frozen.tools, now), []);
  assert.deepEqual(now, frozen.tools, 'a compatible change: record it (UPDATE_TOOL_CONTRACT=1)');
  // (Removing an action narrows its enum: breaking.)
  const fewer = JSON.parse(JSON.stringify(now)) as ContractEntry[];
  (fewer.find(e => e.name === 'query')!.input as { properties: { action: { enum: string[] } } }).properties.action.enum.pop();
  assert.match(breakingChanges(now, fewer).join(), /query input\.action: enum narrowed/);
  // The annotations: query and describe read only; a group with any destructive action is destructive.
  const by = new Map(now.map(e => [e.name, e.annotations]));
  assert.deepEqual([by.get('query')!.readOnlyHint, by.get('describe')!.readOnlyHint, by.get('features')!.destructiveHint, by.get('library')!.destructiveHint], [true, true, true, false]);
});

test('a v2 call is the v1 call: the same result; an unknown or missing action refused with the actions', async () => {
  const s = await stateOf(starterDoc());
  for (const [v2, args, v1] of [['query', { action: 'measure', a: 'n1.top' }, 'measure'], ['query', { action: 'mass' }, 'mass_properties'], ['query', { action: 'summary' }, 'get_part_summary'], ['drawing', { action: 'issues' }, 'drawing_issues']] as const) {
    const rest = Object.fromEntries(Object.entries(args).filter(([k]) => k !== 'action'));
    const a = await dispatchTool(s, v2, args, evaluate), b = await dispatchTool(s, v1, rest, evaluate);
    assert.equal(a.content, b.content, `${v2}.${String(args.action)}`);
  }
  const edited = await dispatchTool(s, 'features', { action: 'edit', index: 1, values: { h: 12 } }, evaluate), direct = await dispatchTool(s, 'edit_feature', { index: 1, values: { h: 12 } }, evaluate);
  assert.ok(edited.changed); assert.deepEqual(edited.state.doc.nodes, direct.state.doc.nodes);
  // model takes its one action unsaid.
  const built = await dispatchTool({ doc: emptyDoc(), bodies: [] }, 'model', { source: 'box({w: 10, d: 10, h: 10})' }, evaluate);
  assert.ok(!built.isError && built.state.doc.nodes.length === 2, built.content);
  assert.match(read((await dispatchTool(s, 'query', { action: 'weigh' }, evaluate)).content).error, /query takes "action": one of summary, inspect, measure/);
  assert.match(read((await dispatchTool(s, 'subd', {}, evaluate)).content).error, /subd takes "action"/);
  assert.deepEqual(v1Call('history', { action: 'best' }), { name: 'restore_best', args: {} });
  assert.equal(v1Call('measure', {}), null, 'a v1 name is not translated');
});

test('describe: the tools, a tool\'s actions, an action\'s v1 schema, a command\'s values, a feature kind\'s JSON', async () => {
  const s = await stateOf(starterDoc());
  const d = async (args: object) => { const r = await dispatchTool(s, 'describe', args, evaluate); return { ...read(r.content), isError: r.isError, changed: r.changed } as Record<string, any>; };
  const all = await d({});
  assert.deepEqual(Object.keys(all.tools).sort(), Object.keys(GROUPS).filter(n => n !== 'describe').sort());
  assert.equal(all.changed, false);
  assert.equal((await d({ tool: 'subd' })).actions.insert_loop, 'index, edge, t?');
  const m = await d({ tool: 'query', action: 'measure' });
  assert.deepEqual([m.description, m.input], [TOOLS.find(t => t.name === 'measure')!.description, TOOLS.find(t => t.name === 'measure')!.input_schema]);
  const hole = await d({ command: 'hole' });
  assert.ok(hole.selection && /d:/.test(Object.entries(hole.values).map(([k, v]) => `${k}: ${v}`).join('; ')), JSON.stringify(hole));
  assert.equal((await d({ command: 'linear_pattern' })).command, 'linear-pattern');
  const ex = await d({ feature: 'extrude' });
  assert.ok(ex.nodes.some((l: string) => l.includes('"kind":"extrude"')));
  for (const bad of [{ tool: 'nope' }, { tool: 'query', action: 'nope' }, { command: 'nope' }, { feature: 'nope' }]) assert.ok((await d(bad)).isError, JSON.stringify(bad));
  // Every feature kind and command the features tool lists can be described.
  const features = TOOLS_V2.find(t => t.name === 'features')!.description;
  for (const k of /Feature kinds: ([^.]+)\./.exec(features)![1].split(', ')) assert.ok(!(await d({ feature: k })).isError, k);
  for (const c of /Commands: ([^.]+)\./.exec(features)![1].split(', ')) assert.ok(!(await d({ command: c })).isError, c);
});

test('the same gates through v2: L2 refuses an addition on a built part; ops naming v2 tools are kept as v1 calls and replay', async () => {
  const s = await stateOf(starterDoc());
  const add = { action: 'command', command: 'cylinder', values: { r: 2, h: 5, x: 90, y: 0 } };
  const direct = await runTool({ ...s, turnBase: s.doc }, 'features', add, evaluate);
  assert.equal(read(direct.content).code, 'needs_proposal', direct.content);
  const p = await runTool({ ...s, turnBase: s.doc }, 'proposals', { action: 'propose', title: 'a peg', ops: [{ tool: 'features', args: add }] }, evaluate);
  assert.ok(!p.isError, p.content);
  const kept = p.state.doc.proposals!.at(-1)!;
  assert.deepEqual(kept.ops.map(o => o.tool), ['run_command'], 'kept as the v1 call');
  assert.equal((kept.ops[0].args as { action?: string }).action, undefined);
  const accepted = await acceptProposal(p.state, kept.id, evaluate);
  assert.ok('state' in accepted && accepted.state.doc.nodes.length === s.doc.nodes.length + 2);
  // A batch of v2 ops, all or nothing.
  const batch = await dispatchTool(s, 'features', { action: 'batch', ops: [{ tool: 'features', args: { action: 'edit', index: 1, values: { h: 14 } } }, { tool: 'features', args: add }] }, evaluate);
  assert.ok(!batch.isError, batch.content);
});

test('the MCP server with CAD_TOOLSET v2: the v2 contract, 13 tools, v2 and v1 calls, structured results for read actions', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-v2-')), statePath = join(dir, 'state.json');
  writeFileSync(statePath, JSON.stringify({ doc: starterDoc(), changed: false }));
  const input = new PassThrough(), output = new PassThrough(), served = serveMcp(statePath, input, output, 'v2');
  type Rpc = { id?: number; result?: Record<string, any> };
  const waiting = new Map<number, (m: Rpc) => void>(); let buf = '', id = 0;
  output.on('data', d => { buf += d; let nl; while ((nl = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, nl)) as Rpc; buf = buf.slice(nl + 1); waiting.get(m.id!)?.(m); } });
  const request = (method: string, params?: unknown) => new Promise<Rpc>(res => { const n = ++id; waiting.set(n, res); input.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
  assert.equal((await request('initialize', { protocolVersion: '2025-06-18' })).result!.serverInfo.version, TOOL_CONTRACT_V2);
  const list = (await request('tools/list')).result!.tools as { name: string }[];
  assert.deepEqual(list.map(t => t.name), TOOLS_V2.map(t => t.name));
  const mass = (await request('tools/call', { name: 'query', arguments: { action: 'mass' } })).result!;
  assert.equal(mass.isError, false); assert.deepEqual(mass.structuredContent, JSON.parse(mass.content[0].text));
  assert.deepEqual(validate(outputSchemaOf('mass_properties')!, mass.structuredContent), []);
  const old = (await request('tools/call', { name: 'mass_properties', arguments: {} })).result!;
  assert.equal(old.content[0].text, mass.content[0].text, 'the v1 name still answers');
  const edit = (await request('tools/call', { name: 'features', arguments: { action: 'edit', index: 1, values: { h: 12 } } })).result!;
  assert.equal(edit.isError, false, edit.content[0].text); assert.equal(edit.structuredContent, undefined);
  // (query.select is select: the selection is saved for the studio.)
  const sel = (await request('tools/call', { name: 'query', arguments: { action: 'select', faces: ['n1.top'] } })).result!;
  assert.equal(sel.isError, false, sel.content[0].text);
  input.end(); await served;
  const saved = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.ok(saved.changed); assert.ok(saved.selection?.faces?.length === 1, JSON.stringify(saved.selection));
});

test('the chat server lists the tool set it serves, with its prompt, and tells the MCP server which', () => {
  const was = process.env.CAD_TOOLSET;
  try {
    for (const set of ['v1', 'v2'] as const) {
      process.env.CAD_TOOLSET = set;
      const args = claudeArgs({ mcpConfig: '{}', model: 'm' }), allowed = args[args.indexOf('--allowedTools') + 1].split(','), prompt = args[args.indexOf('--system-prompt') + 1];
      assert.deepEqual(allowed, toolsetOf(set).tools.map(t => `mcp__cad__${t.name}`));
      assert.equal(prompt, set === 'v2' ? SYSTEM_PROMPT_V2 : SYSTEM_PROMPT);
    }
  } finally { if (was === undefined) delete process.env.CAD_TOOLSET; else process.env.CAD_TOOLSET = was; }
});

test('the replay hook: CAD_TOOLS_VIA_V2=1 sends every v1 call as its v2 call', () => {
  const was = process.env.CAD_TOOLS_VIA_V2;
  try {
    process.env.CAD_TOOLS_VIA_V2 = '1';
    assert.deepEqual(viaV2('measure', { a: 'n1.top' }), ['query', { a: 'n1.top', action: 'measure' }]);
    assert.deepEqual(viaV2('apply_ops', undefined), ['features', { action: 'batch' }]);
    assert.deepEqual(viaV2('query', { action: 'mass' }), ['query', { action: 'mass' }], 'a v2 call as it is');
    delete process.env.CAD_TOOLS_VIA_V2;
    assert.deepEqual(viaV2('measure', { a: 1 }), ['measure', { a: 1 }]);
  } finally { if (was === undefined) delete process.env.CAD_TOOLS_VIA_V2; else process.env.CAD_TOOLS_VIA_V2 = was; }
});
