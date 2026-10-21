import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { starterDoc, withNode, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { boxCage } from '@barocss/cad-model/app/primitives';
import { dispatchTool, TOOLS, type ChatState } from '@barocss/cad-model/chat/tools';
import { TOOL_CONTRACT_V2, annotationsOf, breakingChanges, outputSchemaOf, validate, type ContractEntry, type JsonSchema } from '@barocss/cad-model/chat/contract';
import { GROUPS } from '@barocss/cad-model/chat/groups';
import { TOOLSET } from '@barocss/cad-model/chat/toolset';
import { serveMcp, TOOLS_LISTED } from '../server/cadMcp';

// A5.1 (O9): the tool layer's contract. Every handler classified; the breaking-change rules (the v2 list is frozen by
// them in tools-v2.json, toolset.test.ts); every read handler's result matching its output schema; the MCP server
// listing the v2 tools and returning them. (O105: the handlers' own list, v1, and its tools-v1.json are gone.)

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);

test('every handler is classified, nothing reaches outside the document, read handlers change nothing', () => {
  for (const t of TOOLS) {
    const a = annotationsOf(t.name);
    assert.equal(a.openWorldHint, false, t.name);
    if (a.readOnlyHint) assert.ok(!a.destructiveHint && a.idempotentHint, t.name);
  }
  assert.throws(() => annotationsOf('a_new_tool'), /does not classify/);
  // The read tools are exactly those the dispatcher never reports as changing the document (spot-checked by running them below).
  assert.deepEqual(TOOLS.filter(t => annotationsOf(t.name).readOnlyHint && !outputSchemaOf(t.name)).map(t => t.name), ['get_image_layers'], 'a read tool without a fixed result shape');
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
  const calls: [string, object][] = [['get_part_summary', {}], ['measure', { a: 'n1.top' }], ['measure', { a: 'n1.top', b: 'n1.bottom' }], ['mass_properties', {}], ['interference', {}], ['section', { axis: 'z', at: 4 }], ['wall_thickness', {}], ['draft', {}], ['check_spec', {}], ['diff', {}], ['list_proposals', {}], ['inspect', { faces: ['n1.top'] }], ['select', { faces: ['n1.top'] }], ['checkpoint', { name: 'a' }], ['drawing_issues', {}], ['tolerance_suggestions', {}], ['get_assembly', {}], ['list_library', {}], ['check_printability', {}], ['render_views', {}], ['get_joints', {}], ['forward_kinematics', {}], ['link_inertia', {}], ['export_urdf', {}], ['export_mjcf', {}], ['sweep_path', { to: {} }], ['gravity_torques', {}], ['motion_torques', { to: {}, profile: 'trapezoid' }], ['size_actuators', { to: {}, profile: 'trapezoid' }], ['get_brief', {}], ['get_references', {}], ['get_drafts', {}], ['standards_lookup', {}], ['standards_lookup', { table: 'fasteners-metric-coarse', row: 'M6', field: 'tap' }]];
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
  // (A frame's cut list, FR4a: on a two-member frame.)
  const fr = withNode(starterDoc(), { kind: 'frame', points: [[0, 0, 0], [300, 0, 0], [300, 200, 0]], segments: [[0, 1], [1, 2]], section: { kind: 'rect-tube', width: 40, height: 40, wall: 3, outerRadius: 0 }, corners: { default: 'mitre' } } as never);
  const r3 = await evaluate(fr); assert.ok(r3.ok);
  const cl = await dispatchTool({ doc: fr, bodies: r3.bodies }, 'cut_list', {}, evaluate);
  assert.ok(!cl.isError && !cl.changed, cl.content); assert.deepEqual(validate(outputSchemaOf('cut_list')!, JSON.parse(cl.content)), [], 'cut_list'); seen.add('cut_list');
  // Every read tool with an output schema was run here.
  // (A keep-out to check, A6.3.)
  const withK = await dispatchTool(s, 'add_keepout', { box: { frame: { origin: [100, 0, 0], normal: [0, 0, 1], xAxis: [1, 0, 0] }, size: [5, 5, 5] } }, evaluate);
  assert.ok(!withK.isError, withK.content);
  const kc = await dispatchTool(withK.state, 'check_keepouts', {}, evaluate);
  assert.ok(!kc.isError && !kc.changed, kc.content); assert.deepEqual(validate(outputSchemaOf('check_keepouts')!, JSON.parse(kc.content)), [], 'check_keepouts'); seen.add('check_keepouts');
  assert.deepEqual(TOOLS.filter(t => outputSchemaOf(t.name) && !seen.has(t.name)).map(t => t.name), []);
});

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
