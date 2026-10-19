import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { evaluatePart } from '../src/engine/evaluate';
import { starterDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { boxCage } from '../src/app/primitives';
import { dispatchTool, SYSTEM_PROMPT, TOOLS, type ChatState } from '../src/chat/tools';
import { TOOL_CONTRACT_VERSION, annotationsOf, breakingChanges, contractOf, outputSchemaOf, validate, type ContractEntry, type JsonSchema } from '../src/chat/contract';
import { serveMcp, TOOLS_LISTED } from '../server/cadMcp';

// A5.1 (O9): the tool layer's contract. Every tool classified; the names, input and output schemas and annotations
// frozen in src/chat/tools-v1.json (UPDATE_TOOL_CONTRACT=1 rewrites it for a compatible change; a breaking one needs a
// new version); every read tool's result matching its output schema; the MCP server listing and returning them.

const FROZEN = resolve(process.cwd(), 'src/chat/tools-v1.json');
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);

test('every tool is classified, nothing reaches outside the document, read tools change nothing', () => {
  for (const t of TOOLS) {
    const a = annotationsOf(t.name);
    assert.equal(a.openWorldHint, false, t.name);
    if (a.readOnlyHint) assert.ok(!a.destructiveHint && a.idempotentHint, t.name);
  }
  assert.throws(() => annotationsOf('a_new_tool'), /does not classify/);
  // The read tools are exactly those the dispatcher never reports as changing the document (spot-checked by running them below).
  assert.deepEqual(TOOLS.filter(t => annotationsOf(t.name).readOnlyHint && !outputSchemaOf(t.name)).map(t => t.name), ['get_image_layers'], 'a read tool without a fixed result shape');
});

test('the contract is frozen: the current tools match tools-v1.json, and any difference that would break a client needs a new version', () => {
  const now = contractOf(TOOLS);
  if (process.env.UPDATE_TOOL_CONTRACT) {
    const before: ContractEntry[] = JSON.parse(readFileSync(FROZEN, 'utf8')).tools;
    const broken = breakingChanges(before, now);
    assert.deepEqual(broken, [], `breaking changes need ${TOOL_CONTRACT_VERSION.replace(/v\d+$/, 'v2')}, not a rewrite`);
    writeFileSync(FROZEN, JSON.stringify({ contract: TOOL_CONTRACT_VERSION, tools: now }, null, 1) + '\n');
  }
  const frozen = JSON.parse(readFileSync(FROZEN, 'utf8')) as { contract: string; tools: ContractEntry[] };
  assert.equal(frozen.contract, TOOL_CONTRACT_VERSION);
  const broken = breakingChanges(frozen.tools, now);
  assert.deepEqual(broken, [], 'a breaking change to the tools: it needs a new contract version');
  assert.deepEqual(now, frozen.tools, 'a compatible change to the tools: record it (UPDATE_TOOL_CONTRACT=1)');
});

test('the breaking-change rules: removals and narrowing break, additions do not', () => {
  const base: ContractEntry[] = [{ name: 't', annotations: { title: 'T', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, input: { type: 'object', properties: { a: { type: 'string', enum: ['x', 'y'] } }, required: [] }, output: { type: 'object', properties: { r: { type: 'number' } }, required: ['r'] } }];
  const edit = (f: (e: ContractEntry) => void) => { const c = JSON.parse(JSON.stringify(base)); f(c[0]); return breakingChanges(base, c); };
  assert.deepEqual(breakingChanges(base, []), ['t: removed']);
  assert.match(edit(e => { (e.input as JsonSchema).properties!.a.enum = ['x']; }).join(), /enum narrowed/);
  assert.match(edit(e => { (e.input as JsonSchema).required = ['a']; }).join(), /newly required/);
  assert.match(edit(e => { delete (e.input as JsonSchema).properties!.a; }).join(), /a: removed/);
  assert.match(edit(e => { (e.output as JsonSchema).required = []; }).join(), /no longer required/);
  assert.match(edit(e => { e.annotations.readOnlyHint = false; }).join(), /no longer read only/);
  assert.deepEqual(edit(e => { (e.input as JsonSchema).properties!.b = { type: 'number' }; (e.input as JsonSchema).properties!.a.enum!.push('z'); (e.output as JsonSchema).properties!.q = { type: 'string' }; }), [], 'additions are compatible');
});

test('every read tool’s result matches its output schema and changes nothing', async () => {
  let doc: StudioDoc = { ...starterDoc(), requirements: [{ id: 'R1', source: '64 long', hard: true, check: { op: '==', query: { fn: 'bbox', axis: 'x' }, value: 64, tol: 0.1 } }] } as StudioDoc;
  const r = await evaluate(doc); assert.ok(r.ok);
  let s: ChatState = { doc, bodies: r.bodies };
  const calls: [string, object][] = [['get_part_summary', {}], ['measure', { a: 'n1.top' }], ['measure', { a: 'n1.top', b: 'n1.bottom' }], ['mass_properties', {}], ['interference', {}], ['section', { axis: 'z', at: 4 }], ['wall_thickness', {}], ['draft', {}], ['check_spec', {}], ['diff', {}], ['list_proposals', {}], ['inspect', { faces: ['n1.top'] }], ['select', { faces: ['n1.top'] }], ['checkpoint', { name: 'a' }], ['drawing_issues', {}], ['tolerance_suggestions', {}], ['get_assembly', {}], ['list_library', {}], ['check_printability', {}], ['render_views', {}], ['get_joints', {}], ['forward_kinematics', {}], ['link_inertia', {}], ['export_urdf', {}], ['export_mjcf', {}], ['sweep_path', { to: {} }]];
  const seen = new Set<string>();
  for (const [name, args] of calls) {
    const out = await dispatchTool(s, name, args, evaluate);
    assert.ok(!out.isError, `${name}: ${out.content.slice(0, 200)}`);
    assert.equal(out.changed, false, `${name} changes nothing`); assert.equal(out.state.doc, s.doc, `${name}: the document as it was`);
    assert.deepEqual(validate(outputSchemaOf(name)!, JSON.parse(out.content)), [], name);
    if (name === 'checkpoint') s = out.state;
    seen.add(name);
  }
  doc = withNode(starterDoc(), { kind: 'subd', cage: boxCage(20, 20, 20, 1, [0, 0, 0]) } as never);
  const r2 = await evaluate(doc); assert.ok(r2.ok);
  for (const [name, args] of [['subd_cage', { index: 3 }], ['subd_select', { index: 3, what: 'faces', normal: [0, 0, 1] }]] as const) {
    const out = await dispatchTool({ doc, bodies: r2.bodies }, name, args, evaluate);
    assert.ok(!out.isError, out.content); assert.deepEqual(validate(outputSchemaOf(name)!, JSON.parse(out.content)), [], name); seen.add(name);
  }
  // Every read tool with an output schema was run here.
  assert.deepEqual(TOOLS.filter(t => outputSchemaOf(t.name) && !seen.has(t.name)).map(t => t.name), []);
});

test('the MCP server: its contract version, tools with titles, annotations and output schemas, structured results', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-contract-')), statePath = join(dir, 'state.json');
  writeFileSync(statePath, JSON.stringify({ doc: starterDoc(), changed: false }));
  const input = new PassThrough(), output = new PassThrough(), served = serveMcp(statePath, input, output);
  type Rpc = { id?: number; result?: Record<string, any>; error?: { code: number } };
  const waiting = new Map<number | null, (m: Rpc) => void>(); let buf = '', id = 0;
  output.on('data', d => { buf += d; let nl; while ((nl = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, nl)) as Rpc; buf = buf.slice(nl + 1); waiting.get(m.id ?? null)?.(m); } });
  const request = (method: string, params?: unknown) => new Promise<Rpc>(res => { const n = ++id; waiting.set(n, res); input.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
  const init = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  assert.deepEqual([init.result!.protocolVersion, init.result!.serverInfo.version, init.result!.capabilities.tools], ['2025-06-18', TOOL_CONTRACT_VERSION, {}]);
  const list = (await request('tools/list')).result!.tools as { name: string; title: string; annotations: { readOnlyHint: unknown }; inputSchema: { type: string }; outputSchema?: unknown }[];
  assert.equal(list.length, TOOLS.length);
  for (const t of list) {
    assert.ok(t.title && t.annotations && typeof t.annotations.readOnlyHint === 'boolean' && t.inputSchema.type === 'object', t.name);
    assert.equal(!!t.outputSchema, !!outputSchemaOf(t.name), t.name);
  }
  // A read tool: its result as text and as structured content, the same, matching its schema.
  const read = (await request('tools/call', { name: 'mass_properties', arguments: {} })).result!;
  assert.equal(read.isError, false);
  assert.deepEqual(read.structuredContent, JSON.parse(read.content[0].text));
  assert.deepEqual(validate(outputSchemaOf('mass_properties')!, read.structuredContent), []);
  // A change: no structured content (no output schema); a refused call: isError, none either.
  const change = (await request('tools/call', { name: 'set_requirements', arguments: { requirements: [{ id: 'R1', source: '64 long', hard: true, check: { op: '==', query: { fn: 'bbox', axis: 'x' }, value: 64, tol: 0.1 } }] } })).result!;
  assert.equal(change.isError, false, change.content[0].text); assert.equal(change.structuredContent, undefined);
  const refused = (await request('tools/call', { name: 'section', arguments: { axis: 'q', at: 1 } })).result!;
  assert.equal(refused.isError, true); assert.equal(refused.structuredContent, undefined);
  // JSON-RPC errors: an unknown method, a line that is not JSON.
  assert.equal((await request('resources/list')).error!.code, -32601);
  const bad = new Promise<Rpc>(res => waiting.set(null, res)); input.write('not json\n');
  assert.equal((await bad).error!.code, -32700);
  input.end(); await served;
  // The change was saved to the state file.
  assert.ok(JSON.parse(readFileSync(statePath, 'utf8')).changed);
  assert.deepEqual(TOOLS_LISTED.map(t => t.name), TOOLS.map(t => t.name));
});

test('what a model reads every turn (A5.3 measures against it): the tool list and the system prompt', () => {
  const listed = JSON.stringify(TOOLS_LISTED).length, plain = JSON.stringify(TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: t.input_schema }))).length;
  console.log(`tools ${TOOLS.length}; tools/list ${listed} characters (${plain} without annotations and output schemas); system prompt ${SYSTEM_PROMPT.length} characters`);
  assert.ok(listed > plain && listed - plain < 15000, 'the contract adds at most 15k characters');
});
