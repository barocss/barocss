import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { commandById, type Ctx, type Selection } from '../src/app/commands';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { acceptProposal, CHAT_COMMANDS, COMMAND_DOCS, dispatchTool, resolveNames, runTool, TOOLS, type ChatState } from '../src/chat/tools';
import { checkNode, deleteFeature } from '../src/chat/features';
import { eventParser, type TurnEvent } from '../src/chat/client';
import { serveMcp } from '../server/cadMcp';
import { checkImages, claudeArgs, createChatServer, DEFAULT_ORIGINS, fromStudio, stateNote, summarize, userMessage } from '../server/chatServer';
import { fitSize } from '../src/chat/images';
import { simplify, traceImage, traceLoops } from '../src/chat/trace';
import { defaultRender } from '../src/engine/render';
import { defaultDrawing } from '../src/drawing/types';

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> {
  const r = await evaluate(doc); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return { doc, bodies: r.bodies };
}
const parse = (content: string) => JSON.parse(content) as Record<string, any>;
const volume = (s: ChatState) => s.bodies.reduce((v, b) => v + (b.volumeMM3 ?? 0), 0);
const scratch = () => mkdtempSync(join(tmpdir(), 'cad-chat-test-'));

/** An MCP client over in-memory pipes to the real tool server. */
function mcpClient(statePath: string) {
  const input = new PassThrough(), output = new PassThrough();
  const served = serveMcp(statePath, input, output);
  const waiting = new Map<number, (m: any) => void>(); let buf = '', id = 0;
  output.on('data', d => { buf += d; let nl; while ((nl = buf.indexOf('\n')) >= 0) { const m = JSON.parse(buf.slice(0, nl)); buf = buf.slice(nl + 1); waiting.get(m.id)?.(m); } });
  const request = (method: string, params?: unknown) => new Promise<any>(resolve => { const n = ++id; waiting.set(n, resolve); input.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
  const call = async (name: string, args: unknown) => { const m = await request('tools/call', { name, arguments: args }); return { isError: m.result.isError as boolean, json: parse(m.result.content[0].text) }; };
  return { request, call, close: async () => { input.end(); await served; } };
}

test('tool schemas: every buildable command is exposed and documented with the HUD’s own value keys', async () => {
  for (const tool of TOOLS) {
    assert.match(tool.name, /^[a-z_]+$/); assert.ok(tool.description.length > 40, tool.name);
    assert.equal(tool.input_schema.type, 'object'); assert.equal(tool.input_schema.additionalProperties, false, tool.name);
  }
  assert.deepEqual(new Set(TOOLS.map(t => t.name)), new Set(['get_part_summary', 'run_command', 'add_features', 'edit_feature', 'delete_feature', 'get_image_layers', 'extrude_image_layer', 'inflate_image_layer', 'measure', 'mass_properties', 'interference', 'section', 'wall_thickness', 'draft', 'set_requirements', 'check_spec', 'restore_best', 'apply_ops', 'checkpoint', 'restore', 'diff', 'propose', 'accept_proposal', 'list_proposals', 'render_views', 'inspect', 'select', 'get_assembly', 'add_part', 'place_part', 'delete_part', 'add_mate', 'edit_mate', 'delete_mate', 'list_library', 'insert_part', 'snap_part', 'add_library', 'add_library_part', 'check_printability', 'orient_for_print', 'subd_cage', 'subd_select', 'subd_move', 'subd_extrude', 'subd_insert_loop', 'subd_bridge', 'subd_fill', 'subd_weld', 'subd_crease', 'subd_delete']));
  const run = TOOLS.find(t => t.name === 'run_command')!;
  assert.deepEqual((run.input_schema.properties as any).command.enum, CHAT_COMMANDS);
  assert.deepEqual(new Set(Object.keys(COMMAND_DOCS)), new Set(CHAT_COMMANDS));
  // Fields from a context each command accepts: the documented keys are exactly the HUD's.
  let doc = rectanglePart(64, 32, 8);
  doc = withNode(withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [80, 0], max: [96, 16] }), { kind: 'extrude', sketch: 2, height: 16 });
  const s = await stateOf(doc), top = s.bodies[0].mesh.faces.find(f => f.name === 'n1.top')!;
  const sel = (p: Partial<Selection>): Selection => ({ faces: [], edges: [], bodies: [], ...p });
  const selections: Record<string, Selection> = {
    hole: sel({ faces: [{ body: 0, face: top.index }] }), chamfer: sel({ edges: [{ body: 0, edge: 0 }] }), fillet: sel({ edges: [{ body: 0, edge: 0 }] }),
    union: sel({ bodies: [0, 1] }), difference: sel({ bodies: [0, 1] }), intersect: sel({ bodies: [0, 1] }),
    draft: sel({ faces: [{ body: 0, face: s.bodies[0].mesh.faces.find(f => f.name === 'n1.side0')!.index }] }),
    'offset-face': sel({ faces: [{ body: 0, face: top.index }] }),
  };
  // The profile commands take the newest finished sketch: one drawn on the plate's top.
  const sketched = withNode(s.doc, { kind: 'sketch', profile: 'circle', center: [20, 16], radius: 4, plane: { origin: [0, 0, 8], normal: [0, 0, 1], xAxis: [1, 0, 0] }, on: { node: 1, side: 'solid' } });
  // A meshing gear takes a spur gear selected.
  const geared = await stateOf(withNode(emptyDoc(), { kind: 'gear', module: 2, teeth: 20, faceWidth: 10, center: [0, 0], generator: 'spur-gear@0' }));
  // Simplify mesh takes a mesh body (facet faces): a box of 12 triangles.
  const meshed = await stateOf(withNode(emptyDoc(), { kind: 'mesh', name: 'cube', unit: 'mm', representation: 'facets', positions: [0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 10, 10, 0, 10, 10, 10, 10, 0, 10, 10],
    indices: [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7] }));
  for (const id of CHAT_COMMANDS) {
    const profile = ['extrude', 'revolve', 'pipe'].includes(id);
    const ctx: Ctx = id === 'gear-mesh' ? { doc: geared.doc, bodies: geared.bodies, selection: sel({ bodies: [0] }) } : id === 'decimate' ? { doc: meshed.doc, bodies: meshed.bodies, selection: sel({ bodies: [0] }) } : { doc: profile ? sketched : s.doc, bodies: s.bodies, selection: selections[id] ?? sel({ bodies: [0] }) };
    const cmd = commandById(id)!;
    assert.ok(cmd.available(ctx).ok, id);
    assert.deepEqual(new Set((cmd.fields?.(ctx) ?? []).map(f => f.key)), new Set(Object.keys(COMMAND_DOCS[id].values)), id);
  }
});

test('run_command applies the UI’s rules: availability reasons, value keys and ranges, names, kernel refusals', async () => {
  const s = await stateOf(rectanglePart(64, 32, 8));
  let r = await runTool(s, 'run_command', { command: 'hole', values: { d: 8, x: 6, y: 6 } }, evaluate);
  assert.ok(r.isError); assert.match(parse(r.content).error, /Select the flat face where the hole goes in/);
  r = await runTool(s, 'run_command', { command: 'hole', faces: ['n1.side0'], values: { diameter: 8 } }, evaluate);
  assert.match(parse(r.content).error, /no value "diameter"; its values are type \(Type\), d \(Diameter\)/);
  r = await runTool(s, 'run_command', { command: 'box', values: { w: 0 } }, evaluate);
  assert.match(parse(r.content).error, /"w" \(Width X\) must be at least 1/);
  r = await runTool(s, 'run_command', { command: 'linear-pattern', bodies: ['b1'], values: { count: 40 } }, evaluate);
  assert.match(parse(r.content).error, /at most 24/);
  r = await runTool(s, 'run_command', { command: 'fillet', edges: ['n9.nope'], values: { radius: 2 } }, evaluate);
  assert.match(parse(r.content).error, /No face, edge or body named "n9.nope"/);
  r = await runTool(s, 'run_command', { command: 'emboss' }, evaluate);
  assert.match(parse(r.content).error, /Unknown command "emboss"/);
  // The kernel's refusal comes back in the studio's words, and the part is unchanged.
  r = await runTool(s, 'run_command', { command: 'hole', faces: ['n1.top'], values: { d: 8, x: 200, y: 6 } }, evaluate);
  assert.ok(r.isError); assert.equal(r.changed, false); assert.equal(r.state, s);
  assert.match(parse(r.content).error, /The hole misses the body/);
  // A good hole: defaults fill the rest, the result names faces and edges for the next call.
  r = await runTool(s, 'run_command', { command: 'hole', faces: ['n1.top'], values: { x: 6, y: 6 } }, evaluate);
  assert.ok(!r.isError, r.content);
  const out = parse(r.content);
  assert.deepEqual(out.added, ['2: Hole Ø8']);
  assert.ok(Math.abs(out.bodies[0].volume_mm3 - (64 * 32 * 8 - Math.PI * 16 * 8)) < 1e-3);
  assert.ok(out.bodies[0].edges.some((e: any) => e.name === 'n1.side0|n1.side1' && e.line === 'along z'));
  assert.ok(out.bodies[0].faces.some((f: any) => f.name === 'n1.top' && f.normal[2] === 1));
});

test('a scripted model drives the MCP tool server: the plate with four corner holes and R2 vertical edges, correcting a refused hole', async () => {
  // At the default L2 (D41, option b) the first build on an empty part applies, the whole turn; the next turn's new
  // feature is a proposal. (This model runs at L4.)
  const l2Path = join(scratch(), 'state-l2.json');
  writeFileSync(l2Path, JSON.stringify({ doc: emptyDoc(), changed: false }));
  const first = mcpClient(l2Path), built = await first.call('run_command', { command: 'box', values: { w: 64, d: 32, h: 8, x: 0, y: 0, z: 0 } });
  assert.ok(!built.isError, JSON.stringify(built.json));
  assert.ok(!(await first.call('run_command', { command: 'hole', faces: ['n1.top'], values: { d: 8, x: 6, y: 6 } })).isError, 'still the first turn');
  await first.close();
  const second = mcpClient(l2Path), refused = await second.call('run_command', { command: 'hole', faces: ['n1.top'], values: { d: 8, x: 58, y: 6 } });
  assert.ok(refused.isError); assert.equal(refused.json.code, 'needs_proposal');
  await second.close();
  assert.equal(JSON.parse(readFileSync(l2Path, 'utf8')).doc.nodes.length, 3);
  const statePath = join(scratch(), 'state.json');
  writeFileSync(statePath, JSON.stringify({ doc: emptyDoc(), changed: false }));
  const level = process.env.CAD_AUTONOMY; process.env.CAD_AUTONOMY = '4';
  const mcp = mcpClient(statePath);
  const init = await mcp.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  assert.deepEqual(init.result.capabilities, { tools: {} });
  const listed = (await mcp.request('tools/list')).result.tools;
  assert.deepEqual(listed.map((t: any) => t.name), TOOLS.map(t => t.name));
  assert.equal(listed[1].inputSchema.properties.command.enum.length, CHAT_COMMANDS.length);
  assert.equal((await mcp.request('nope')).error.code, -32601);
  const box = await mcp.call('run_command', { command: 'box', values: { w: 64, d: 32, h: 8, x: 0, y: 0, z: 0 } });
  assert.ok(!box.isError);
  const top = box.json.bodies[0].faces.find((f: any) => f.normal[2] === 1).name;
  // Parallel calls run in order; the last hole is off the part on purpose and is refused.
  const holes = await Promise.all([[6, 6], [58, 6], [6, 26], [158, 26]].map(([x, y]) => mcp.call('run_command', { command: 'hole', faces: [top], values: { d: 8, x, y } })));
  assert.deepEqual(holes.map(h => h.isError), [false, false, false, true]);
  assert.match(holes[3].json.error, /misses the body/);
  const fixed = await mcp.call('run_command', { command: 'hole', faces: ['n1.top'], values: { d: 8, x: 58, y: 26 } });
  const vertical = fixed.json.bodies[0].edges.filter((e: any) => e.line === 'along z').map((e: any) => e.name);
  assert.equal(vertical.length, 4);
  const fillet = await mcp.call('run_command', { command: 'fillet', edges: vertical, values: { radius: 2 } });
  assert.ok(!fillet.isError, JSON.stringify(fillet.json));
  const round = fillet.json.bodies[0].faces.filter((f: any) => f.radius === 2).map((f: any) => f.name);
  assert.ok(!(await mcp.call('select', { faces: round })).isError);
  await mcp.close();
  if (level === undefined) delete process.env.CAD_AUTONOMY; else process.env.CAD_AUTONOMY = level;
  // The state file holds what the turn built, for the chat server to hand back.
  const saved = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.equal(saved.changed, true); assert.equal(saved.selection.faces.length, 4);
  assert.deepEqual(saved.doc.nodes.map((n: any) => n.kind), ['sketch', 'extrude', 'hole', 'hole', 'hole', 'hole', 'fillet']);
  const s = await stateOf(saved.doc);
  const expected = 64 * 32 * 8 - 4 * Math.PI * 16 * 8 - 4 * (4 - Math.PI) * 8;
  assert.ok(Math.abs(volume(s) - expected) / expected < 1e-6, String(volume(s)));
  assert.equal(summarize('run_command', JSON.stringify(fillet.json), false), `Fillet {"radius":2} → 1 body, ${Math.round(expected)} mm³`);
});

test('add_features checks nodes before the kernel; revolve and polygon profiles build', async () => {
  const s = await stateOf(rectanglePart(20, 20, 5));
  assert.match(checkNode({ kind: 'extrude', sketch: 1, height: 5 }, s.doc.nodes, {})!, /feature 1 is a extrude, not a sketch/);
  assert.match(checkNode({ kind: 'fillet', parent: { node: 0, side: 'solid' }, edges: ['x'], radius: 1 }, s.doc.nodes, {})!, /\{node 0, side solid\} \(body b0\) is not a visible body \(bodies now: \{node 1, side solid\} \(body b1\)\)/);
  assert.match(checkNode({ kind: 'extrude', sketch: 0, height: 5, depth: 2 }, s.doc.nodes, {})!, /unknown field "depth"/);
  assert.match(checkNode({ kind: 'sketch', profile: 'circle', center: [0, 0], radius: { parameter: 'r' } }, s.doc.nodes, {})!, /defined parameter/);
  assert.equal(checkNode({ kind: 'sketch', profile: 'circle', center: [0, 0], radius: { parameter: 'r' } }, s.doc.nodes, { r: 2 }), null);
  let r = await runTool(s, 'add_features', { features: [{ kind: 'sketch', profile: 'rectangle', min: [30, 0], max: [40, 10] }, { kind: 'extrude', sketch: 9, height: 4 }] }, evaluate);
  assert.ok(r.isError); assert.match(parse(r.content).error, /Feature 2 of 2 \(would be index 3\)/); assert.equal(r.state, s);
  // A ring: a rectangle beside the sketch's Y axis turned a full revolution, then a triangular prism.
  r = await runTool(s, 'add_features', { features: [
    { kind: 'sketch', profile: 'rectangle', min: [30, 0], max: [34, 6] }, { kind: 'revolve', sketch: 2, axis: 'y', angleDegrees: 360 },
    { kind: 'sketch', profile: 'polygon', points: [[0, 40], [10, 40], [0, 50]] }, { kind: 'extrude', sketch: 4, height: 3 },
  ] }, evaluate);
  assert.ok(!r.isError, r.content);
  assert.equal(r.state.bodies.length, 3);
  const ring = r.state.bodies.find(b => b.key === 'b3')!, prism = r.state.bodies.find(b => b.key === 'b5')!;
  assert.ok(Math.abs(ring.volumeMM3! - Math.PI * (34 ** 2 - 30 ** 2) * 6) / ring.volumeMM3! < 1e-3, String(ring.volumeMM3));
  assert.ok(Math.abs(prism.volumeMM3! - 150) < 1e-6);
});

test('edit_feature uses the feature editor’s fields; delete_feature renumbers later features, their names stay (A1)', async () => {
  let s = await stateOf(rectanglePart(64, 32, 8));
  let r = await runTool(s, 'run_command', { command: 'hole', faces: ['n1.top'], values: { d: 8, x: 32, y: 16 } }, evaluate); s = r.state;
  r = await runTool(s, 'edit_feature', { index: 2 }, evaluate);
  assert.match(parse(r.content).error, /dia \(Diameter = 8\), c0 \(Centre X = 32\), c1 \(Centre Y = 16\)/);
  r = await runTool(s, 'edit_feature', { index: 2, values: { dia: 10 } }, evaluate);
  assert.ok(!r.isError, r.content); assert.equal((r.state.doc.nodes[2] as { radius: number }).radius, 5);
  r = await runTool(r.state, 'edit_feature', { index: 1, values: { w: 80, h: 10 } }, evaluate);
  assert.ok(!r.isError, r.content);
  assert.ok(Math.abs(volume(r.state) - (80 * 32 * 10 - Math.PI * 25 * 10)) < 1e-3);
  assert.match(parse((await runTool(r.state, 'edit_feature', { index: 1, values: { width: 1 } }, evaluate)).content).error, /no value "width"/);
  // Delete: refused while used; a box before a filleted box goes, with its sketch: the later features move down,
  // and their names stay (the feature ids are stable, A1).
  assert.match(parse((await runTool(s, 'delete_feature', { index: 1 }, evaluate)).content).error, /used by feature 2/);
  let doc = rectanglePart(10, 10, 5);
  doc = withNode(withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [20, 0], max: [36, 16] }), { kind: 'extrude', sketch: 2, height: 16 });
  doc = withNode(doc, { kind: 'fillet', parent: { node: 3, side: 'solid' }, edges: ['n3.side0|n3.side1'], radius: 2 });
  const del = deleteFeature(doc, 1);
  assert.ok(!('error' in del)); assert.deepEqual(del.removed, [0, 1]);
  assert.deepEqual(del.doc.nodes[2], { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n3.side0|n3.side1'], radius: 2, id: 'n4' });
  assert.deepEqual(del.doc.nodes.map(n => n.id), ['n2', 'n3', 'n4']);
  r = await runTool(await stateOf(doc), 'delete_feature', { index: 1 }, evaluate);
  assert.ok(!r.isError, r.content); assert.deepEqual(r.state.bodies.map(b => b.key), ['b4'], 'the body keeps its key (its feature n4)');
  assert.ok(Math.abs(volume(r.state) - (16 * 16 * 16 - (4 - Math.PI) * 16)) < 1e-3);
});

test('measure, select and the part summary read the evaluated part by name', async () => {
  const s = await stateOf(rectanglePart(64, 32, 8));
  let r = await runTool(s, 'measure', { a: 'n1.top', b: 'n1.bottom' }, evaluate);
  assert.equal(parse(r.content).normal_distance, 8);
  r = await runTool(s, 'measure', { a: 'n1.side0|n1.side1' }, evaluate);
  assert.equal(parse(r.content).length, 8);
  r = await runTool(s, 'select', { faces: ['n1.top'], bodies: ['b1'] }, evaluate);
  assert.deepEqual(r.state.selection, { faces: ['n1.top'], edges: [], bodies: ['b1'] });
  assert.deepEqual(resolveNames(s.bodies, r.state.selection!).selection.bodies, [0]);
  assert.ok((await runTool(s, 'select', { faces: ['nope'] }, evaluate)).isError);
  const sum = parse((await runTool(s, 'get_part_summary', {}, evaluate)).content);
  assert.deepEqual(sum.features.map((f: any) => f.label), ['Sketch · rectangle', 'Extrude 8']);
  assert.equal(sum.bodies[0].faces.length, 6); assert.equal(sum.bodies[0].edges.length, 12);
  assert.match(stateNote(s.doc), /Current part: 2 features/);
});

/** A fake `claude` process: prints scripted stream-json lines and edits the state file as its MCP server would. */
function fakeClaude(script: (args: string[], statePath: string) => (string | (() => void))[]) {
  const spawned: { command: string; args: string[]; cwd: string; killed: boolean; stdin: string }[] = [];
  const spawn = (command: string, args: string[], o: { cwd: string }) => {
    const child = new EventEmitter() as any;
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
    const rec = { command, args, cwd: o.cwd, killed: false, stdin: '' }; spawned.push(rec);
    child.stdin.on('data', (d: Buffer) => { rec.stdin += d; });
    child.kill = () => { rec.killed = true; child.stdout.end(); setImmediate(() => child.emit('close', null)); return true; };
    if (args[0] === '--version') { setImmediate(() => { child.stdout.end('2.1.283 (Claude Code)\n'); child.emit('close', 0); }); return child; }
    const config = JSON.parse(args[args.indexOf('--mcp-config') + 1]);
    const steps = script(args, config.mcpServers.cad.env.CAD_CHAT_STATE);
    fake.lastState = JSON.parse(readFileSync(config.mcpServers.cad.env.CAD_CHAT_STATE, 'utf8'));
    (async () => {
      for (const s of steps) { await new Promise(r => setTimeout(r, 5)); if (rec.killed) return; if (typeof s === 'function') s(); else child.stdout.write(s + '\n'); }
      child.stdout.end(); child.emit('close', 0);
    })();
    return child;
  };
  const fake = { spawn: spawn as any, spawned, lastState: null as any };
  return fake;
}

async function serve(handler: ReturnType<typeof createChatServer>) {
  const server = createServer((req, res) => { void handler(req, res); });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${(server.address() as { port: number }).port}/api/chat`, close: () => new Promise(r => server.close(r)) };
}
/** What the studio's page sends through the dev server's proxy. */
const STUDIO = { origin: 'http://127.0.0.1:52020' };
const JSON_POST = { ...STUDIO, 'content-type': 'application/json' };
async function turn(url: string, body: unknown, signal?: AbortSignal) {
  const events: TurnEvent[] = [];
  const res = await fetch(`${url}/turn`, { method: 'POST', headers: JSON_POST, body: JSON.stringify(body), signal });
  const feed = eventParser(e => events.push(e));
  feed(await res.text());
  return { status: res.status, events };
}

test('the chat server sends a state only when a tool changed the part since the last one (version, PERF3 A3)', async () => {
  const plate = rectanglePart(64, 32, 8);
  const one = withNode(plate, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [6, 6], radius: 4 });
  const two = withNode(one, { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [20, 6], radius: 4 });
  const sid = '7235de6e-4fc3-4fc4-b479-410846a6528b';
  const use = (id: string, name: string) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', id, name: `mcp__cad__${name}`, input: {} }] }, session_id: sid });
  const result = (id: string) => JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text: '{"ok":true}' }] }] }, session_id: sid });
  const fake = fakeClaude((_args, statePath) => [
    JSON.stringify({ type: 'system', subtype: 'init', session_id: sid, tools: TOOLS.map(t => `mcp__cad__${t.name}`) }),
    use('t1', 'run_command'), () => writeFileSync(statePath, JSON.stringify({ doc: one, changed: true, version: 1 })), result('t1'),
    use('t2', 'describe_part'), result('t2'), use('t3', 'measure'), result('t3'),
    use('t4', 'run_command'), () => writeFileSync(statePath, JSON.stringify({ doc: two, changed: true, version: 2 })), result('t4'),
    JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'Done.', session_id: sid }),
  ]);
  const srv = await serve(createChatServer({ mcpScript: '/x/cadMcp.mjs', spawn: fake.spawn, workDir: scratch() }));
  try {
    const { events } = await turn(srv.url, { text: 'two holes', doc: plate });
    assert.deepEqual(events.map(e => e.type), ['tool', 'state', 'tool', 'tool', 'tool', 'state', 'done']);
    assert.deepEqual((events[5] as { doc: StudioDoc }).doc, two);
  } finally { await srv.close(); }
});

test('the chat server runs the claude CLI with only the studio tools and streams text, tool calls, previews and the result', async () => {
  const plate = rectanglePart(64, 32, 8);
  const built = withNode(plate, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [6, 6], radius: 4 });
  const sid = '7235de6e-4fc3-4fc4-b479-410846a6528a';
  const fake = fakeClaude((args, statePath) => [
    JSON.stringify({ type: 'system', subtype: 'init', session_id: sid, tools: TOOLS.map(t => `mcp__cad__${t.name}`) }),
    JSON.stringify({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Adding ' } }, session_id: sid, parent_tool_use_id: null }),
    JSON.stringify({ type: 'stream_event', event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'a hole.' } }, session_id: sid, parent_tool_use_id: null }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'Adding a hole.' }, { type: 'tool_use', id: 'toolu_1', name: 'mcp__cad__run_command', input: { command: 'hole', faces: ['n1.top'], values: { d: 8, x: 6, y: 6 } } }] }, session_id: sid }),
    () => writeFileSync(statePath, JSON.stringify({ doc: built, changed: true, selection: { faces: ['n1.top'], edges: [], bodies: [] } })),
    JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: [{ type: 'text', text: JSON.stringify({ ok: true, did: 'Hole {"d":8,"x":6,"y":6}', bodies: [{ key: 'b2', volume_mm3: 15981.876 }] }) }] }] }, session_id: sid }),
    JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'Done.', session_id: sid }),
  ]);
  const work = scratch();
  const srv = await serve(createChatServer({ mcpScript: '/x/cadMcp.mjs', spawn: fake.spawn, workDir: work }));
  try {
    assert.deepEqual(await (await fetch(`${srv.url}/status`, { headers: STUDIO })).json(), { enabled: true, model: 'claude-opus-5-5', via: '2.1.283 (Claude Code)' });
    assert.equal((await turn(srv.url, { text: '' })).status, 400);
    const { events } = await turn(srv.url, { text: 'add a Ø8 hole 6 mm from the corner', doc: plate });
    assert.deepEqual(events.map(e => e.type), ['text', 'text', 'tool', 'state', 'done']);
    assert.deepEqual(events[2], { type: 'tool', name: 'run_command', input: { command: 'hole', faces: ['n1.top'], values: { d: 8, x: 6, y: 6 } }, summary: 'Hole {"d":8,"x":6,"y":6} → 1 body, 15982 mm³', isError: false });
    assert.deepEqual((events[3] as { doc: StudioDoc }).doc, built);
    assert.deepEqual(events[4], { type: 'done', doc: built, selection: { faces: ['n1.top'], edges: [], bodies: [] }, session: sid, end: 'done' });
    const run = fake.spawned[1];
    assert.equal(run.command, 'claude'); assert.equal(run.cwd, work);
    const a = run.args, flag = (f: string) => a[a.indexOf(f) + 1];
    assert.equal(a[0], '-p'); assert.equal(flag('--input-format'), 'stream-json');
    // The message goes in on stdin as one stream-json user message.
    const sent = JSON.parse(run.stdin);
    assert.equal(sent.type, 'user'); assert.equal(sent.message.content.length, 1);
    assert.match(sent.message.content[0].text, /Current part: 2 features[\s\S]*add a Ø8 hole/);
    assert.equal(flag('--output-format'), 'stream-json'); assert.equal(flag('--model'), 'claude-opus-5-5'); assert.equal(flag('--tools'), '');
    assert.ok(a.includes('--strict-mcp-config')); assert.ok(!a.includes('--resume'));
    assert.equal(flag('--allowedTools'), TOOLS.map(t => `mcp__cad__${t.name}`).join(','));
    const mcp = JSON.parse(flag('--mcp-config')).mcpServers.cad;
    assert.equal(mcp.command, process.execPath); assert.deepEqual(mcp.args, ['/x/cadMcp.mjs']);
    // The next turn resumes the CLI conversation and carries an image before its text.
    const png = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64');
    await turn(srv.url, { text: 'like this drawing', doc: built, session: sid, images: [{ media_type: 'image/png', data: png }], traces: [{ width: 1, height: 1, background: '#ffffff', layers: [] }] });
    assert.equal(fake.spawned[2].args[fake.spawned[2].args.indexOf('--resume') + 1], sid);
    assert.deepEqual(JSON.parse(fake.spawned[2].stdin).message.content.map((b: any) => b.type), ['image', 'text']);
    assert.deepEqual(JSON.parse(fake.spawned[2].stdin).message.content[0].source, { type: 'base64', media_type: 'image/png', data: png });
    const state = fake.lastState;
    assert.deepEqual(state?.images, [{ width: 1, height: 1, background: '#ffffff', layers: [] }]);
    const refused = await fetch(`${srv.url}/turn`, { method: 'POST', headers: JSON_POST, body: JSON.stringify({ text: 'x', doc: built, images: [{ media_type: 'image/svg+xml', data: 'AAAA' }] }) });
    assert.equal(refused.status, 400); assert.match((await refused.json()).error, /PNG, JPEG, WEBP, GIF/);
    assert.equal(fake.spawned.length, 3);
  } finally { await srv.close(); }
  assert.deepEqual(claudeArgs({ mcpConfig: '{}', model: 'claude-sonnet-5-5', session: 's' }).slice(-2), ['--resume', 's']);
  assert.match(stateNote(emptyDoc()), /0 features/);
});

test('the chat server reports a missing CLI, failed turns, and kills the CLI when the browser stops a turn', async () => {
  const missing = (() => { const c = new EventEmitter() as any; c.stdout = new PassThrough(); c.stderr = new PassThrough(); setImmediate(() => c.emit('error', new Error('spawn claude ENOENT'))); return c; }) as any;
  let srv = await serve(createChatServer({ mcpScript: 'x', spawn: missing, workDir: scratch() }));
  try {
    const st = await (await fetch(`${srv.url}/status`, { headers: STUDIO })).json();
    assert.equal(st.enabled, false); assert.match(st.reason, /claude auth login/);
    const { events } = await turn(srv.url, { text: 'hi', doc: emptyDoc() });
    assert.deepEqual(events, [{ type: 'done', end: 'error', error: 'spawn claude ENOENT' }]);
  } finally { await srv.close(); }
  const capped = fakeClaude(() => [JSON.stringify({ type: 'result', subtype: 'error_max_turns', is_error: true, session_id: 's1' })]);
  srv = await serve(createChatServer({ mcpScript: 'x', spawn: capped.spawn, workDir: scratch() }));
  try {
    const { events } = await turn(srv.url, { text: 'hi', doc: emptyDoc() });
    assert.deepEqual(events, [{ type: 'done', session: 's1', end: 'error', error: 'Stopped after 24 steps.' }]);
  } finally { await srv.close(); }
  const slow = fakeClaude(() => Array.from({ length: 200 }, () => JSON.stringify({ type: 'system', subtype: 'status' })));
  srv = await serve(createChatServer({ mcpScript: 'x', spawn: slow.spawn, workDir: scratch() }));
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 60);
    await assert.rejects(turn(srv.url, { text: 'hi', doc: emptyDoc() }, controller.signal));
    await new Promise(r => setTimeout(r, 50));
    assert.equal(slow.spawned[0].killed, true);
  } finally { await srv.close(); }
});

test('chat images: the server checks type, count, encoding and size; the browser scales to the model’s full-detail size', () => {
  assert.equal(checkImages(undefined), null);
  assert.equal(checkImages([{ media_type: 'image/jpeg', data: 'QUJD' }]), null);
  assert.match(checkImages('x')!, /list/);
  assert.match(checkImages(Array.from({ length: 5 }, () => ({ media_type: 'image/png', data: 'QUJD' })))!, /At most 4/);
  assert.match(checkImages([{ media_type: 'image/png', data: 'data:image/png;base64,QUJD' }])!, /no data: prefix/);
  assert.match(checkImages([{ media_type: 'image/png', data: 'A'.repeat(7 * 1024 * 1024) }])!, /too large/);
  assert.deepEqual(userMessage('hi').message.content, [{ type: 'text', text: 'hi' }]);
  assert.deepEqual(fitSize(4000, 3000), [1568, 1176]);
  assert.deepEqual(fitSize(800, 600), [800, 600]);
  assert.deepEqual(fitSize(1000, 5000), [314, 1568]);
});

/** A smiley character bitmap: a yellow face with two black eyes and a red mouth, on white or transparent. */
function smiley(transparent: boolean) {
  const W = 200, H = 160, px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, inFace = (x - 100) ** 2 + (y - 80) ** 2 < 70 ** 2;
    const eye = (x - 75) ** 2 + (y - 60) ** 2 < 10 ** 2 || (x - 125) ** 2 + (y - 60) ** 2 < 10 ** 2;
    const mouth = x > 70 && x < 130 && y > 100 && y < 115;
    const c = !inFace ? (transparent ? [0, 0, 0, 0] : [255, 255, 255, 255]) : eye ? [20, 20, 20, 255] : mouth ? [220, 30, 40, 255] : [250, 210, 40, 255];
    px.set(c, i);
  }
  return { px, W, H };
}

test('the tracer splits a character bitmap into a silhouette and its colour regions, with holes', () => {
  for (const transparent of [false, true]) {
    const { px, W, H } = smiley(transparent);
    const t = traceImage(px, W, H);
    assert.equal(t.background, transparent ? 'transparent' : '#ffffff');
    const byColour = (c: string) => t.layers.find(l => l.color === c)!;
    const sil = t.layers[0];
    assert.equal(sil.id, 'silhouette'); assert.equal(sil.regions.length, 1); assert.equal(sil.regions[0].holes.length, 0);
    const face = byColour('#fad228'), eyes = byColour('#141414'), mouth = byColour('#dc1e28');
    assert.ok(face && eyes && mouth, JSON.stringify(t.layers.map(l => l.color)));
    assert.equal(face.regions.length, 1); assert.equal(face.regions[0].holes.length, 3);
    assert.equal(eyes.regions.length, 2); assert.equal(mouth.regions.length, 1);
    assert.equal(t.layers.length, 4);
    assert.ok(t.layers.reduce((s, l) => s + l.regions.reduce((a, r) => a + r.outer.length, 0), 0) < 600);
  }
  // A white face drawn with a black outline on white: the enclosed white becomes its own colour layer.
  const W = 120, H = 120, px = new Uint8ClampedArray(W * H * 4).fill(255);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const r = Math.hypot(x - 60, y - 60); if (r > 40 && r < 46) px.set([0, 0, 0, 255], (y * W + x) * 4); }
  const ring = traceImage(px, W, H);
  assert.deepEqual(ring.layers.map(l => [l.id, l.color, l.regions.length, l.regions[0].holes.length]), [['silhouette', '#808080', 1, 0], ['color1', '#ffffff', 1, 0], ['color2', '#000000', 1, 1]]);
  // Loops along pixel edges, simplified without losing the shape.
  const sq = traceLoops(Uint8Array.from([0, 0, 0, 0, 1, 1, 0, 1, 1]), 3, 3);
  assert.equal(sq.length, 1); assert.equal(sq[0].length, 8);
  assert.deepEqual(simplify(sq[0], 0.5).length, 4);
});

test('extrude_image_layer builds a relief: the silhouette base and colour layers stacked at one scale', async () => {
  const { px, W, H } = smiley(false);
  const images = [traceImage(px, W, H)];
  let s: ChatState = { ...(await stateOf(emptyDoc())), images };
  const layers = parse((await runTool(s, 'get_image_layers', {}, evaluate)).content);
  assert.equal(layers.silhouette_aspect, 1);
  const eyes = layers.layers.find((l: any) => l.color === '#141414');
  assert.equal(eyes.regions, 2); assert.ok(eyes.box.y[0] > 0.5, JSON.stringify(eyes.box));
  let r = await runTool(s, 'extrude_image_layer', { layer: 'silhouette', width_mm: 60, height: 4 }, evaluate);
  assert.ok(!r.isError, r.content); s = r.state;
  const base = parse(r.content).bodies[0];
  assert.ok(Math.abs(base.volume_mm3 - Math.PI * 30 ** 2 * 4) / (Math.PI * 30 ** 2 * 4) < 0.03, String(base.volume_mm3));
  assert.deepEqual(base.bounds.min.map(Math.round), [0, 0, 0]); assert.deepEqual(base.bounds.max.map(Math.round), [60, 60, 4]);
  r = await runTool(s, 'extrude_image_layer', { layer: eyes.id, width_mm: 60, height: 1.5, base: 4 }, evaluate);
  assert.ok(!r.isError, r.content); s = r.state;
  const eyeBody = parse(r.content).bodies.find((b: any) => b.key === 'b3');
  // Two eyes Ø6 (10 px of 140 px across 60 mm → r ≈ 4.3 mm), 1.5 thick, in the upper half, on top of the base.
  assert.ok(Math.abs(eyeBody.volume_mm3 - 2 * Math.PI * (10 * 60 / 140) ** 2 * 1.5) / eyeBody.volume_mm3 < 0.15, String(eyeBody.volume_mm3));
  assert.equal(eyeBody.bounds.min[2], 4); assert.ok(eyeBody.bounds.min[1] > 30);
  r = await runTool(s, 'run_command', { command: 'union', bodies: ['b1', 'b3'] }, evaluate);
  assert.ok(!r.isError, r.content); assert.equal(r.state.bodies.length, 1);
  // Standing: upright on XZ, thickness towards −Y.
  r = await runTool({ ...(await stateOf(emptyDoc())), images }, 'extrude_image_layer', { width_mm: 40, height: 3, orientation: 'standing' }, evaluate);
  assert.ok(!r.isError, r.content);
  const up = parse(r.content).bodies[0].bounds;
  assert.deepEqual([up.min[1], up.max[1], Math.round(up.max[2])], [-3, 0, 40]);
  assert.match(parse((await runTool(s, 'extrude_image_layer', { layer: 'nope', width_mm: 60, height: 1 }, evaluate)).content).error, /No layer "nope"/);
  assert.match(parse((await runTool({ ...s, images: [] }, 'get_image_layers', {}, evaluate)).content).error, /No image is attached/);
});

test('inflate_image_layer rounds the silhouette into a 3D body and sets features on its surface', async () => {
  const { px, W, H } = smiley(false);
  const images = [traceImage(px, W, H)];
  let s: ChatState = { ...(await stateOf(emptyDoc())), images };
  const id = (c: string) => images[0].layers.find(l => l.color === c)!.id;
  let r = await runTool(s, 'inflate_image_layer', { layer: 'silhouette', mode: 'body', width_mm: 60, depth: 24 }, evaluate);
  assert.ok(!r.isError, r.content); s = r.state;
  const body = parse(r.content).bodies[0];
  assert.deepEqual([body.bounds.min[2], body.bounds.max[2]], [-12, 12]);
  assert.ok(Math.abs(body.bounds.max[0] - 60) < 0.5 && Math.abs(body.bounds.max[1] - 60) < 0.5, JSON.stringify(body.bounds));
  // Rounder than a slab of the same outline, fuller than a cone.
  const slab = Math.PI * 30 ** 2 * 24;
  assert.ok(body.volume_mm3 > slab * 0.55 && body.volume_mm3 < slab * 0.85, String(body.volume_mm3 / slab));
  assert.match(parse((await runTool(s, 'inflate_image_layer', { layer: id('#141414'), mode: 'bump', width_mm: 60, depth: 2 }, evaluate)).content).error, /body_depth/);
  r = await runTool(s, 'inflate_image_layer', { layer: id('#141414'), mode: 'bump', width_mm: 60, depth: 2, body_depth: 24 }, evaluate);
  assert.ok(!r.isError, r.content); s = r.state;
  const eyes = parse(r.content).bodies.slice(1);
  assert.equal(eyes.length, 2);
  // Each eye sits in the upper half and reaches 2 mm above where it is sunk into the front surface.
  for (const e of eyes) { assert.ok(e.bounds.min[1] > 30); assert.ok(e.bounds.min[2] > 9 && e.bounds.max[2] <= 12.5, JSON.stringify(e.bounds)); assert.ok(Math.abs(e.bounds.max[2] - e.bounds.min[2] - 2) < 1e-6); }
  // The face colour is one region with three holes (eyes and mouth): a filled area, inflated whole.
  r = await runTool(s, 'inflate_image_layer', { layer: id('#fad228'), mode: 'bump', width_mm: 60, depth: 1, body_depth: 24 }, evaluate);
  assert.ok(!r.isError, r.content);
  // A ring stroke is skipped as an outline.
  const ringPx = new Uint8ClampedArray(120 * 120 * 4).fill(255);
  for (let y = 0; y < 120; y++) for (let x = 0; x < 120; x++) { const d = Math.hypot(x - 60, y - 60); if (d > 40 && d < 46) ringPx.set([0, 0, 0, 255], (y * 120 + x) * 4); }
  const ring = traceImage(ringPx, 120, 120);
  const rs: ChatState = { ...(await stateOf(emptyDoc())), images: [ring] };
  // A big part lists faces and edges per body; a new small body is still listed in its result.
  const cyl = await runTool(s, 'run_command', { command: 'cylinder', values: { r: 20, h: 7, x: 30, y: -20, z: -30 } }, evaluate);
  const made = parse(cyl.content).bodies.find((b: any) => b.made_by?.includes('Cylinder'));
  assert.ok(made.edges.some((e: any) => e.line === 'curve'), cyl.content.slice(0, 400));
  const big = parse((await runTool(cyl.state, 'get_part_summary', {}, evaluate)).content);
  assert.match(big.note, /call again with \{"body": key\}/); assert.equal(big.bodies[0].faces, undefined);
  const one = parse((await runTool(cyl.state, 'get_part_summary', { body: made.key }, evaluate)).content);
  assert.equal(one.bodies.find((b: any) => b.key === made.key).faces.length, 3);
  assert.equal(big.features[0].node.points, undefined);
  const stroke = await runTool(rs, 'inflate_image_layer', { layer: 'color2', mode: 'bump', width_mm: 40, depth: 1, body_depth: 10 }, evaluate);
  assert.match(parse(stroke.content).error, /outline stroke/);
});

/** A GET with a chosen Host header (fetch always sends the real one). */
function rawStatus(url: string, host: string) {
  return new Promise<number>((resolve, reject) => {
    const u = new URL(url);
    const req = httpRequest({ hostname: u.hostname, port: u.port, path: u.pathname, headers: { host } }, res => { res.resume(); resolve(res.statusCode ?? 0); });
    req.on('error', reject); req.end();
  });
}

test('the chat server refuses other sites: Origin or Host must be the studio’s, and turns must be JSON', async () => {
  const fake = fakeClaude(() => [JSON.stringify({ type: 'result', subtype: 'success', is_error: false, session_id: 's' })]);
  const srv = await serve(createChatServer({ mcpScript: 'x', spawn: fake.spawn, workDir: scratch() }));
  const post = (headers: Record<string, string>, body = JSON.stringify({ text: 'hi', doc: emptyDoc() })) => fetch(`${srv.url}/turn`, { method: 'POST', headers, body });
  try {
    // Another page in the browser: a "simple" text/plain POST, or JSON, from its own origin.
    assert.equal((await post({ origin: 'https://evil.example', 'content-type': 'text/plain' })).status, 403);
    assert.equal((await post({ origin: 'https://evil.example', 'content-type': 'application/json' })).status, 403);
    assert.equal((await post({ origin: 'null', 'content-type': 'application/json' })).status, 403);
    assert.equal((await fetch(`${srv.url}/status`, { headers: { origin: 'http://localhost:3000' } })).status, 403);
    // No Origin: the Host must be the studio's (the dev proxy keeps it), not this server's own or a rebound name.
    assert.equal((await fetch(`${srv.url}/status`)).status, 403);
    assert.equal(await rawStatus(`${srv.url}/status`, 'attacker.example:52021'), 403);
    assert.equal(await rawStatus(`${srv.url}/status`, '127.0.0.1:52020'), 200);
    // The studio itself, but not JSON: refused before any claude run.
    assert.equal((await post({ ...STUDIO, 'content-type': 'text/plain' })).status, 415);
    assert.equal((await post({ origin: 'http://localhost:4173' })).status, 415);
    assert.equal(fake.spawned.filter(p => p.args[0] !== '--version').length, 0);
    assert.equal((await post({ origin: 'http://localhost:52020', 'content-type': 'application/json; charset=utf-8' })).status, 200);
    assert.equal(fake.spawned.filter(p => p.args[0] !== '--version').length, 1);
  } finally { await srv.close(); }
  // Allowed origins are configurable.
  const other = await serve(createChatServer({ mcpScript: 'x', spawn: fake.spawn, workDir: scratch(), origins: ['http://127.0.0.1:52033'] }));
  try {
    assert.equal((await fetch(`${other.url}/status`, { headers: { origin: 'http://127.0.0.1:52033' } })).status, 200);
    assert.equal((await fetch(`${other.url}/status`, { headers: STUDIO })).status, 403);
  } finally { await other.close(); }
  assert.equal(fromStudio({ headers: { origin: 'http://127.0.0.1:52020' } } as any, DEFAULT_ORIGINS), true);
});

test('assembly tools: an agent proposes assembly changes (refused directly at every level); proposed and accepted they apply', async () => {
  const s0 = await stateOf(rectanglePart(64, 32, 8));
  for (const level of ['2', '4']) {
    process.env.CAD_AUTONOMY = level;
    const direct = await runTool(s0, 'add_part', { name: 'Pin' }, evaluate), why = parse(direct.content);
    assert.ok(direct.isError); assert.deepEqual([why.code, why.approval], ['needs_approval', ['assembly']]); assert.equal(direct.state, s0);
  }
  delete process.env.CAD_AUTONOMY;
  const p = await runTool(s0, 'propose', { title: 'a pin', ops: [{ tool: 'add_part', args: { name: 'Pin' } }, { tool: 'run_command', args: { part: 'p1', command: 'cylinder', values: { r: 4, h: 20, x: 0, y: 0, z: 0 } } }] }, evaluate);
  assert.ok(!p.isError, p.content); assert.deepEqual(parse(p.content).risk.approval, ['assembly']);
  process.env.CAD_AUTONOMY = '4';
  assert.match(parse((await runTool(p.state, 'accept_proposal', { id: 'P1' }, evaluate)).content).error, /always needs the user/);
  delete process.env.CAD_AUTONOMY;
  const a = await acceptProposal(p.state, 'P1', evaluate); assert.ok('state' in a, JSON.stringify(a));
  assert.equal(a.state.doc.instances![0].doc.nodes.length, 2);
});

test('assembly tools: a pin added as its own part, built, mated into a plate’s hole through the real solver', async () => {
  // (The tools themselves, through the dispatcher: an agent reaches them by proposals, above.)
  // The base part: a 64 × 32 × 8 plate with a Ø8 hole at (32, 16).
  let s = await stateOf(rectanglePart(64, 32, 8));
  let r = await dispatchTool(s, 'run_command', { command: 'hole', faces: ['n1.top'], values: { d: 8, x: 32, y: 16 } }, evaluate); s = r.state;
  r = await dispatchTool(s, 'add_part', { name: 'Pin' }, evaluate); s = r.state;
  assert.equal(parse(r.content).part, 'p1');
  r = await dispatchTool(s, 'run_command', { part: 'p1', command: 'cylinder', values: { r: 4, h: 20, x: 0, y: 0, z: 0 } }, evaluate); s = r.state;
  assert.ok(!r.isError, r.content); assert.equal(parse(r.content).part, 'p1');
  assert.equal(s.doc.nodes.length, 3); assert.equal(s.doc.instances![0].doc.nodes.length, 2);
  assert.match(parse((await dispatchTool(s, 'run_command', { part: 'p9', command: 'box' }, evaluate)).content).error, /No part "p9"; parts: base, p1/);
  const asm = parse((await dispatchTool(s, 'get_assembly', { faces_of: 'p1' }, evaluate)).content);
  const pinSide = asm.instances[0].faces.find((f: any) => f.kind.startsWith('round (outer')).name;
  const hole = parse((await dispatchTool(s, 'get_assembly', { faces_of: 'base' }, evaluate)).content).base.faces.find((f: any) => f.kind.startsWith('round (inner')).name;
  // Concentric: the pin on the hole's axis; coincident: its bottom flush on the plate's top.
  r = await dispatchTool(s, 'add_mate', { kind: 'concentric', a: { part: 'base', face: hole }, b: { part: 'p1', face: pinSide } }, evaluate);
  assert.ok(!r.isError, r.content); s = r.state;
  assert.deepEqual(parse(r.content).freedom_left, { turns: 1, slides: 1 });
  r = await dispatchTool(s, 'add_mate', { kind: 'coincident', a: { part: 'p1', face: 'n1.bottom' }, b: { part: 'base', face: 'n1.top' } }, evaluate);
  assert.ok(!r.isError, r.content); s = r.state;
  // (b was the fixed base part: swapped, so the pin moves.)
  assert.deepEqual(s.doc.mates![1].b, { part: 'p1', face: 'n1.bottom' });
  const pin = s.doc.instances![0];
  assert.deepEqual([pin.position[0], pin.position[1], pin.position[2]], [32, 16, 8]);
  // A third mate that contradicts them is refused with the solver's reason; nothing changes.
  r = await dispatchTool(s, 'add_mate', { kind: 'coincident', a: { part: 'base', face: 'n1.top' }, b: { part: 'p1', face: 'n1.top' } }, evaluate);
  assert.ok(r.isError); assert.match(parse(r.content).error, /Conflicts with/); assert.equal(r.state.doc.mates!.length, 2);
  assert.match(parse((await dispatchTool(s, 'add_mate', { kind: 'concentric', a: { part: 'base', face: 'n1.top' }, b: { part: 'p1', face: pinSide } }, evaluate)).content).error, /Concentric needs two round faces/);
  assert.match(parse((await dispatchTool(s, 'add_mate', { kind: 'distance', a: { part: 'base', face: 'nope' }, b: { part: 'p1', face: 'n1.bottom' } }, evaluate)).content).error, /"nope" is not a flat or round face of base/);
  // A distance mate instead: edit it and the pin follows.
  r = await dispatchTool(s, 'delete_mate', { id: 'm2' }, evaluate); s = r.state;
  r = await dispatchTool(s, 'add_mate', { kind: 'distance', distance: 5, a: { part: 'base', face: 'n1.top' }, b: { part: 'p1', face: 'n1.bottom' } }, evaluate); s = r.state;
  assert.equal(s.doc.instances![0].position[2], 13);
  r = await dispatchTool(s, 'edit_mate', { id: s.doc.mates![1].id, distance: 2 }, evaluate); s = r.state;
  assert.equal(s.doc.instances![0].position[2], 10);
  // Editing the base part re-solves: a thicker plate lifts the pin with its top.
  r = await dispatchTool(s, 'edit_feature', { index: 1, values: { h: 12 } }, evaluate); s = r.state;
  assert.ok(!r.isError, r.content); assert.equal(s.doc.instances![0].position[2], 14);
  // A copy, grounded, placed by hand; grounding a mated part is refused.
  r = await dispatchTool(s, 'add_part', { name: 'Spare pin', copy_of: 'p1', position: [80, 0, 0], grounded: true }, evaluate); s = r.state;
  assert.equal(s.doc.instances![1].doc.nodes.length, 2); assert.equal(s.doc.instances![1].grounded, true);
  assert.match(parse((await dispatchTool(s, 'place_part', { part: 'p1', grounded: true }, evaluate)).content).error, /mates move Pin/);
  const summary = parse((await dispatchTool(s, 'get_assembly', {}, evaluate)).content);
  assert.deepEqual(summary.instances.map((i: any) => [i.id, i.name, i.bodies]), [['p1', 'Pin', 1], ['p2', 'Spare pin', 1]]);
  assert.deepEqual(summary.instances[0].world_bounds, { min: [28, 12, 14], max: [36, 20, 34] });
  assert.equal(summary.mates.length, 2);
  r = await dispatchTool(s, 'delete_part', { part: 'p1' }, evaluate);
  assert.equal(r.state.doc.instances!.length, 1); assert.equal(r.state.doc.mates!.length, 0);
  // The transcript's lines for assembly results.
  assert.equal(summarize('add_mate', JSON.stringify({ ok: true, did: 'added Concentric 1 (m1): p1.n1.side0 to base.n2.side0', parts: [] }), false), 'added Concentric 1 (m1): p1.n1.side0 to base.n2.side0');
  assert.equal(summarize('get_assembly', JSON.stringify(summary), false), '3 parts, 2 mates');
  // The schemas: part tools take "part"; select does not.
  assert.ok((TOOLS.find(t => t.name === 'run_command')!.input_schema.properties as any).part);
  assert.equal((TOOLS.find(t => t.name === 'select')!.input_schema.properties as any).part, undefined);
});

test('deleting a feature keeps the names mates and drawing dimensions use and the render keys (A1); refuses a mate on its faces', () => {
  let doc = rectanglePart(10, 10, 5);
  doc = withNode(withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [20, 0], max: [36, 16] }), { kind: 'extrude', sketch: 2, height: 16 });
  const mate = (face: string) => ({ id: 'm1', kind: 'coincident' as const, a: { part: 'base', face }, b: { part: 'p', face: 'origin:xy' } });
  const dim = (edge: string) => ({ id: 'd' + edge, view: 'front' as const, kind: 'radius' as const, edge, near: [0, 0, 0] as [number, number, number], place: [0, 0] as [number, number] });
  const render = { ...defaultRender(), appearances: { b1: { ...defaultRender().defaultAppearance }, b3: { ...defaultRender().defaultAppearance } } };
  const full = { ...doc, mates: [mate('n3.top')], drawing: { ...defaultDrawing(), dimensions: [dim('n1.side0|n1.side1'), dim('n3.side0|n3.side1')] }, render };
  const del = deleteFeature(full, 1);
  assert.ok(!('error' in del), JSON.stringify(del));
  assert.equal(del.doc.mates![0].a.face, 'n3.top');
  assert.deepEqual(del.doc.drawing!.dimensions.map(d => 'edge' in d && d.edge), ['n3.side0|n3.side1']);
  assert.equal(del.droppedDimensions, 1);
  assert.deepEqual(Object.keys(del.doc.render!.appearances), ['b3'], 'the deleted box’s look goes; the other keeps its key');
  const blocked = deleteFeature({ ...full, mates: [mate('n1.top')] }, 1);
  assert.ok('error' in blocked && /Coincident 1 uses the face "n1.top"/.test(blocked.error), JSON.stringify(blocked));
});

test('mesh blobs reach the chat server once a conversation: later turns name them; a server without them answers 409 with their hashes', async () => {
  const { putBlob, blobsAsBase64 } = await import('../src/engine/blobs');
  const P = await putBlob(Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1])), I = await putBlob(Uint32Array.from([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]));
  const doc = withNode(emptyDoc(), { kind: 'mesh', name: 'tet', unit: 'mm', blob: { positions: P, indices: I }, representation: 'facets' });
  const seen: string[] = [];
  const fake = fakeClaude((_, statePath) => { const s = JSON.parse(readFileSync(statePath, 'utf8')); seen.push(JSON.stringify((s.blobFiles ?? []).map((b: { hash: string; dtype: string }) => [b.hash.slice(0, 6), b.dtype]))); return [JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'ok', session_id: 's' })]; });
  const work = scratch(), session = 'abcdef0123456789';
  const srv = await serve(createChatServer({ mcpScript: '/x/cadMcp.mjs', spawn: fake.spawn, workDir: work }));
  try {
    const blobs = blobsAsBase64(doc);
    // The first turn carries them; the next names them only, and is served from what was kept.
    assert.equal((await turn(srv.url, { text: 'hi', doc, blobSession: session, blobRefs: [P, I], blobs })).status, 200);
    assert.equal((await turn(srv.url, { text: 'again', doc, blobSession: session, blobRefs: [P, I] })).status, 200);
    const files = JSON.stringify([[P.slice(0, 6), 'f32'], [I.slice(0, 6), 'u32']]);
    assert.deepEqual(seen.slice(-2), [files, files], 'both turns read the kept files');
    // Another conversation (or a restarted server) has none: 409, saying which.
    const r = await fetch(`${srv.url}/turn`, { method: 'POST', headers: JSON_POST, body: JSON.stringify({ text: 'x', doc, blobSession: 'fedcba9876543210', blobRefs: [P, I] }) });
    assert.equal(r.status, 409); assert.deepEqual((await r.json()).missing, [P, I]);
    // A blob that is not what its hash says: refused.
    const bad = await fetch(`${srv.url}/turn`, { method: 'POST', headers: JSON_POST, body: JSON.stringify({ text: 'x', doc, blobSession: 'fedcba9876543210', blobRefs: [P], blobs: { [P]: blobs[I] } }) });
    assert.equal(bad.status, 400);
  } finally { await srv.close(); }
});
