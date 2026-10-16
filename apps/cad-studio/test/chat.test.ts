import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { commandById, type Ctx, type Selection } from '../src/app/commands';
import { evaluatePart } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, withNode, type StudioDoc } from '../src/engine/doc';
import { echoContent, toolUses, type AssistantMessage, type ChatRequest, type ContentBlock, type MessageParam, type Transport } from '../src/chat/api';
import { runTurn, stateNote } from '../src/chat/loop';
import { createAccumulator } from '../src/chat/sse';
import { CHAT_COMMANDS, COMMAND_DOCS, resolveNames, runTool, TOOLS, type ChatState } from '../src/chat/tools';
import { checkNode, deleteFeature } from '../src/chat/features';
import { createChatHandler, upstreamBody } from '../server/chatProxy';

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> {
  const r = await evaluate(doc); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return { doc, bodies: r.bodies };
}
const parse = (content: string) => JSON.parse(content) as Record<string, any>;
const volume = (s: ChatState) => s.bodies.reduce((v, b) => v + (b.volumeMM3 ?? 0), 0);

/** A scripted model: each step sees the conversation so far and returns the next assistant message. */
function scripted(steps: ((messages: MessageParam[]) => ContentBlock[] | AssistantMessage)[]) {
  const requests: ChatRequest[] = [];
  let n = 0;
  const transport: Transport = {
    async send(request, { onText }) {
      requests.push(structuredClone(request));
      const step = steps[n++]; if (!step) throw new Error('The script ran out of steps.');
      const out = step(request.messages);
      const message: AssistantMessage = Array.isArray(out) ? { content: out, stop_reason: out.some(b => b.type === 'tool_use') ? 'tool_use' : 'end_turn' } : out;
      for (const b of message.content) if (b.type === 'text') onText?.(b.text as string);
      return message;
    },
  };
  return { transport, requests };
}
let ids = 0;
const call = (name: string, input: unknown): ContentBlock => ({ type: 'tool_use', id: `toolu_${++ids}`, name, input });
/** The tool results of the last user message. */
const lastResults = (messages: MessageParam[]) => {
  const m = messages[messages.length - 1];
  assert.equal(m.role, 'user');
  return m.content.filter(b => b.type === 'tool_result').map(b => ({ ...(b as { content: string; is_error?: boolean }), json: parse((b as { content: string }).content) }));
};

test('tool schemas: every buildable command is exposed and documented with the HUD’s own value keys', async () => {
  for (const tool of TOOLS) {
    assert.match(tool.name, /^[a-z_]+$/); assert.ok(tool.description.length > 40, tool.name);
    assert.equal(tool.input_schema.type, 'object'); assert.equal(tool.input_schema.additionalProperties, false, tool.name);
  }
  assert.deepEqual(new Set(TOOLS.map(t => t.name)), new Set(['get_part_summary', 'run_command', 'add_features', 'edit_feature', 'delete_feature', 'measure', 'select']));
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
  };
  for (const id of CHAT_COMMANDS) {
    const ctx: Ctx = { doc: s.doc, bodies: s.bodies, selection: selections[id] ?? sel({ bodies: [0] }) };
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
  assert.match(parse(r.content).error, /no value "diameter"; its values are d \(Diameter\)/);
  r = await runTool(s, 'run_command', { command: 'box', values: { w: 0 } }, evaluate);
  assert.match(parse(r.content).error, /"w" \(Width X\) must be at least 1/);
  r = await runTool(s, 'run_command', { command: 'linear-pattern', bodies: ['b1'], values: { count: 40 } }, evaluate);
  assert.match(parse(r.content).error, /at most 24/);
  r = await runTool(s, 'run_command', { command: 'fillet', edges: ['n9.nope'], values: { radius: 2 } }, evaluate);
  assert.match(parse(r.content).error, /No face, edge or body named "n9.nope"/);
  r = await runTool(s, 'run_command', { command: 'draft' }, evaluate);
  assert.match(parse(r.content).error, /Unknown command "draft"/);
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

test('a scripted model builds the plate with four corner holes and R2 vertical edges, correcting a refused hole', async () => {
  const start = await stateOf(emptyDoc());
  const { transport, requests } = scripted([
    () => [{ type: 'thinking', thinking: '', signature: 'sig-1' }, { type: 'text', text: 'Plate first.' }, call('run_command', { command: 'box', values: { w: 64, d: 32, h: 8, x: 0, y: 0, z: 0 } })],
    messages => {
      const [res] = lastResults(messages);
      const top = res.json.bodies[0].faces.find((f: any) => f.normal[2] === 1).name;
      // The last hole is placed off the part on purpose.
      return [[6, 6], [58, 6], [6, 26], [158, 26]].map(([x, y]) => call('run_command', { command: 'hole', faces: [top], values: { d: 8, x, y } }));
    },
    messages => {
      const results = lastResults(messages);
      assert.deepEqual(results.map(r => !!r.is_error), [false, false, false, true]);
      assert.match(results[3].json.error, /misses the body/);
      return [call('run_command', { command: 'hole', faces: ['n1.top'], values: { d: 8, x: 58, y: 26 } })];
    },
    messages => {
      const [res] = lastResults(messages);
      const vertical = res.json.bodies[0].edges.filter((e: any) => e.line === 'along z').map((e: any) => e.name);
      assert.equal(vertical.length, 4);
      return [call('run_command', { command: 'fillet', edges: vertical, values: { radius: 2 } })];
    },
    messages => {
      // Show the rounded corners: the fillet's faces of radius 2.
      const [res] = lastResults(messages);
      return [call('select', { faces: res.json.bodies[0].faces.filter((f: any) => f.radius === 2).map((f: any) => f.name) })];
    },
    () => [{ type: 'text', text: 'Done: 64 × 32 × 8 plate, four Ø8 holes, R2 vertical edges.' }],
  ]);
  const events: string[] = [];
  const turn = await runTurn({ transport, evaluate, state: start, history: [], text: 'a 64×32×8 plate with four Ø8 holes 6 mm from the corners and R2 vertical edges', onEvent: e => { if (e.type === 'tool') events.push(`${e.name}${e.isError ? '!' : ''}`); } });
  assert.equal(turn.end, 'done'); assert.ok(turn.changed);
  assert.deepEqual(events, ['run_command', 'run_command', 'run_command', 'run_command', 'run_command!', 'run_command', 'run_command', 'select']);
  assert.deepEqual(turn.state.doc.nodes.map(n => n.kind), ['sketch', 'extrude', 'hole', 'hole', 'hole', 'hole', 'fillet']);
  assert.equal(turn.state.bodies.length, 1);
  const expected = 64 * 32 * 8 - 4 * Math.PI * 16 * 8 - 4 * (4 - Math.PI) * 8;
  assert.ok(Math.abs(volume(turn.state) - expected) / expected < 1e-6, String(volume(turn.state)));
  assert.equal(turn.state.selection?.faces.length, 4);
  // The conversation: alternating roles, every tool call answered by id, thinking echoed unchanged.
  assert.deepEqual(turn.history.map(m => m.role), ['user', 'assistant', 'user', 'assistant', 'user', 'assistant', 'user', 'assistant', 'user', 'assistant', 'user', 'assistant']);
  assert.match((turn.history[0].content[0] as { text: string }).text, /Current part: 0 features; no bodies/);
  assert.deepEqual(turn.history[1].content[0], { type: 'thinking', thinking: '', signature: 'sig-1' });
  for (let i = 1; i < turn.history.length - 1; i += 2) {
    const asked = toolUses(turn.history[i].content as ContentBlock[]).map(c => c.id);
    assert.deepEqual(turn.history[i + 1].content.map(b => (b as { tool_use_id: string }).tool_use_id), asked);
  }
  assert.equal(requests.length, 6);
  assert.deepEqual(requests[0].tools.map(t => t.name), TOOLS.map(t => t.name));
});

test('add_features checks nodes before the kernel; revolve and polygon profiles build', async () => {
  const s = await stateOf(rectanglePart(20, 20, 5));
  assert.match(checkNode({ kind: 'extrude', sketch: 1, height: 5 }, s.doc.nodes, {})!, /feature 1 is a extrude, not a sketch/);
  assert.match(checkNode({ kind: 'fillet', parent: { node: 0, side: 'solid' }, edges: ['x'], radius: 1 }, s.doc.nodes, {})!, /b0 is not a visible body \(bodies now: b1\)/);
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

test('edit_feature uses the feature editor’s fields; delete_feature renumbers later features and names', async () => {
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
  // Delete: refused while used; a box before a filleted box goes, with its sketch, and the names follow.
  assert.match(parse((await runTool(s, 'delete_feature', { index: 1 }, evaluate)).content).error, /used by feature 2/);
  let doc = rectanglePart(10, 10, 5);
  doc = withNode(withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [20, 0], max: [36, 16] }), { kind: 'extrude', sketch: 2, height: 16 });
  doc = withNode(doc, { kind: 'fillet', parent: { node: 3, side: 'solid' }, edges: ['n3.side0|n3.side1'], radius: 2 });
  const del = deleteFeature(doc, 1);
  assert.ok(!('error' in del)); assert.deepEqual(del.removed, [0, 1]);
  assert.deepEqual(del.doc.nodes[2], { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.side1'], radius: 2 });
  r = await runTool(await stateOf(doc), 'delete_feature', { index: 1 }, evaluate);
  assert.ok(!r.isError, r.content); assert.deepEqual(r.state.bodies.map(b => b.key), ['b2']);
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
  assert.match(stateNote(s), /2 features; bodies b1 16384 mm³/);
});

test('the turn loop stops at the step cap, on refusals, cut-off output and aborts, and keeps the history valid', async () => {
  const s = await stateOf(rectanglePart(64, 32, 8));
  // Step cap: a model that never stops asking.
  const loop = scripted(Array.from({ length: 3 }, () => () => [call('get_part_summary', {})]));
  let t = await runTurn({ transport: loop.transport, evaluate, state: s, history: [], text: 'loop', maxSteps: 3 });
  assert.equal(t.end, 'step-cap'); assert.equal(t.history.length, 7); assert.equal(t.changed, false);
  // Refusal: not echoed back.
  t = await runTurn({ transport: scripted([() => ({ content: [], stop_reason: 'refusal', stop_details: { category: null, explanation: 'no' } })]).transport, evaluate, state: s, history: [], text: 'x' });
  assert.equal(t.end, 'refusal'); assert.deepEqual(t.history.map(m => m.role), ['user']);
  // Cut off mid tool call: answered, not run.
  t = await runTurn({ transport: scripted([() => ({ content: [call('run_command', { command: 'box' })], stop_reason: 'max_tokens' })]).transport, evaluate, state: s, history: [], text: 'x' });
  assert.equal(t.end, 'max-tokens'); assert.equal(t.changed, false); assert.equal((t.history[2].content[0] as { is_error: boolean }).is_error, true);
  // Abort after the first change: the change is kept (the caller commits it), the rest not run.
  const controller = new AbortController();
  const ab = scripted([() => [call('run_command', { command: 'box', values: { x: 100 } }), call('run_command', { command: 'box', values: { x: 200 } })]]);
  t = await runTurn({ transport: ab.transport, evaluate, state: s, history: [], text: 'x', signal: controller.signal, onEvent: e => { if (e.type === 'tool') controller.abort(); } });
  assert.equal(t.end, 'aborted'); assert.ok(t.changed); assert.equal(t.state.bodies.length, 2);
  assert.match((t.history[2].content[1] as { content: string }).content, /stopped/);
  // Transport errors end the turn with the message.
  const failing: Transport = { send: async () => { throw new Error('Chat request failed (503): ANTHROPIC_API_KEY is not set'); } };
  t = await runTurn({ transport: failing, evaluate, state: s, history: [], text: 'x' });
  assert.equal(t.end, 'error'); assert.match(t.error!, /ANTHROPIC_API_KEY/);
});

test('after a mid-output fallback only the blocks after the boundary are echoed or run', () => {
  const content: ContentBlock[] = [
    { type: 'thinking', thinking: '', signature: 'a' }, { type: 'text', text: 'partial' }, call('select', {}),
    { type: 'fallback', from: { model: 'x' }, to: { model: 'y' } }, { type: 'thinking', thinking: '', signature: 'b' }, call('get_part_summary', {}),
  ];
  assert.deepEqual(echoContent(content).map(b => b.type), ['text', 'fallback', 'thinking', 'tool_use']);
  assert.deepEqual(toolUses(content).map(c => c.name), ['get_part_summary']);
  assert.equal(echoContent(content.slice(0, 3)).length, 3);
});

test('the stream accumulator assembles text, thinking signatures and streamed tool input from any chunking', () => {
  const events = [
    ['message_start', { type: 'message_start', message: { model: 'claude-opus-5-5', content: [] } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'EqQB' } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['content_block_start', { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'Building ' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'the plate.' } }],
    ['content_block_stop', { type: 'content_block_stop', index: 1 }],
    ['content_block_start', { type: 'content_block_start', index: 2, content_block: { type: 'tool_use', id: 'toolu_1', name: 'run_command', input: {} } }],
    ['content_block_delta', { type: 'content_block_delta', index: 2, delta: { type: 'input_json_delta', partial_json: '{"command":"bo' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 2, delta: { type: 'input_json_delta', partial_json: 'x","values":{"w":64}}' } }],
    ['content_block_stop', { type: 'content_block_stop', index: 2 }],
    ['content_block_start', { type: 'content_block_start', index: 3, content_block: { type: 'tool_use', id: 'toolu_2', name: 'get_part_summary', input: {} } }],
    ['content_block_stop', { type: 'content_block_stop', index: 3 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 40 } }],
    ['message_stop', { type: 'message_stop' }],
  ] as const;
  const wire = events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('') + ': ping\n\n';
  for (const size of [1, 7, wire.length]) {
    let text = '';
    const acc = createAccumulator(d => { text += d; });
    for (let i = 0; i < wire.length; i += size) acc.push(wire.slice(i, i + size));
    const m = acc.finish();
    assert.equal(text, 'Building the plate.'); assert.equal(m.stop_reason, 'tool_use'); assert.equal(m.model, 'claude-opus-5-5');
    assert.deepEqual(m.content, [
      { type: 'thinking', thinking: '', signature: 'EqQB' }, { type: 'text', text: 'Building the plate.' },
      { type: 'tool_use', id: 'toolu_1', name: 'run_command', input: { command: 'box', values: { w: 64 } } },
      { type: 'tool_use', id: 'toolu_2', name: 'get_part_summary', input: {} },
    ]);
  }
  const bad = createAccumulator();
  assert.throws(() => bad.push('event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n'), /Overloaded/);
});

async function serve(handler: ReturnType<typeof createChatHandler>) {
  const server = createServer((req, res) => {
    // (Mounted at /api/chat, as the Vite middleware strips it.)
    req.url = req.url!.replace(/^\/api\/chat/, '') || '/';
    void handler(req, res, () => { res.statusCode = 404; res.end(); });
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as { port: number };
  return { url: `http://127.0.0.1:${port}/api/chat`, close: () => new Promise(r => server.close(r)) };
}

test('the dev proxy keeps the key server-side, adds the model and options, and streams the events back', async () => {
  const off = await serve(createChatHandler({ env: {}, fetchImpl: async () => { throw new Error('no call expected'); } }));
  try {
    const st = await (await fetch(`${off.url}/status`)).json();
    assert.equal(st.enabled, false); assert.equal(st.model, 'claude-opus-5-5'); assert.match(st.reason, /ANTHROPIC_API_KEY/);
    const res = await fetch(off.url, { method: 'POST', body: '{}' });
    assert.equal(res.status, 503);
  } finally { await off.close(); }

  const seen: { url: string; init: RequestInit }[] = [];
  const sse = 'event: message_stop\ndata: {"type":"message_stop"}\n\n';
  const fake = (async (url: string, init: RequestInit) => {
    seen.push({ url, init });
    return new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(sse)); c.close(); } }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }) as unknown as typeof fetch;
  const on = await serve(createChatHandler({ env: { ANTHROPIC_API_KEY: 'sk-test' }, fetchImpl: fake }));
  try {
    assert.deepEqual(await (await fetch(`${on.url}/status`)).json(), { enabled: true, model: 'claude-opus-5-5' });
    assert.equal((await fetch(on.url, { method: 'POST', body: '{"messages":[]}' })).status, 400);
    const request = { system: 'sys', tools: [TOOLS[0]], messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] };
    const res = await fetch(on.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) });
    assert.equal(res.status, 200); assert.equal(res.headers.get('content-type'), 'text/event-stream');
    assert.equal(await res.text(), sse);
    assert.equal(seen.length, 1); assert.equal(seen[0].url, 'https://api.anthropic.com/v1/messages');
    const headers = seen[0].init.headers as Record<string, string>;
    assert.equal(headers['x-api-key'], 'sk-test'); assert.equal(headers['anthropic-version'], '2023-06-01'); assert.equal(headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
    const body = JSON.parse(String(seen[0].init.body));
    assert.deepEqual(body, { ...upstreamBody(request, {}), system: 'sys' });
    assert.equal(body.model, 'claude-opus-5-5'); assert.equal(body.stream, true); assert.equal(body.fallbacks, 'default');
    assert.deepEqual(body.output_config, { effort: 'medium' }); assert.equal('thinking' in body, false);
  } finally { await on.close(); }
  // Another model is configurable; one without server-side fallback gets none.
  assert.equal(upstreamBody({ system: '', tools: [], messages: [] }, { CAD_STUDIO_CHAT_MODEL: 'claude-haiku-5-5' }).model, 'claude-haiku-5-5');
  assert.equal('fallbacks' in upstreamBody({ system: '', tools: [], messages: [] }, { CAD_STUDIO_CHAT_MODEL: 'claude-haiku-5-5' }), false);
});
