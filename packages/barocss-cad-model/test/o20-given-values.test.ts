// O20: a value the agent gives a command is never replaced by one its derive works out. run_command patches every
// given value at once; a command's derive recomputes the values that follow a changed one (a split's `at` from its
// axis, a mirror's from its plane, a move's Δ from where it lands, a tapped hole's Ø from its thread, a fastener's
// length from its size) — given together, the given ones stand. Each command with a derive, through the agent's path.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc } from '../src/engine/evaluate';
import { runTool, type ChatState } from '../src/chat/tools';
import { commands } from '../src/app/commands';
import { SAMPLE_SIZES, withSampleRows } from './person-file';

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> {
  const r = await evaluate(doc); assert.ok(r.ok);
  return { doc, bodies: r.bodies };
}
/** The command run through the agent's tool, and the node it added. */
async function added(doc: StudioDoc, args: Record<string, unknown>): Promise<ModelNode> {
  const s = await stateOf(doc), r = await runTool(s, 'run_command', args, evaluate);
  assert.ok(!r.isError, r.content);
  return r.state.doc.nodes[r.state.doc.nodes.length - 1];
}
const cube = () => rectanglePart(10, 10, 10);
const body = async (doc: StudioDoc) => (await stateOf(doc)).bodies[0].key;

test('O20: split keeps a given at with its axis (the repro: x at 2, not the middle at 5)', async () => {
  const doc = cube(), node = await added(doc, { command: 'split', bodies: [await body(doc)], values: { axis: 'x', at: 2 } });
  assert.equal(node.kind, 'split');
  assert.equal((node as { at?: number }).at, 2);
  // (No at given: the middle, as before.)
  const middle = await added(doc, { command: 'split', bodies: [await body(doc)], values: { axis: 'y' } });
  assert.equal((middle as { at?: number }).at, 5);
});

test('O20: mirror keeps a given at with its plane', async () => {
  const doc = cube(), s = await stateOf(doc), r = await runTool(s, 'run_command', { command: 'mirror', bodies: [await body(doc)], values: { plane: 'xy', at: 3 } }, evaluate);
  assert.ok(!r.isError, r.content);
  // (A plane off the origin: moved there, mirrored, moved back — the given 3, not the body's top at 10.)
  const added = r.state.doc.nodes.slice(doc.nodes.length).map(n => n.kind === 'translate' ? (n as { offset: number[] }).offset : n.kind);
  assert.deepEqual(added, [[0, 0, -3], 'mirror', [0, 0, 3]]);
});

test('O20: move keeps a given Δ and a given landing point (each as given; the other follows)', async () => {
  const doc = cube(), b = await body(doc);
  const byDelta = await added(doc, { command: 'move', bodies: [b], values: { x: 4 } }) as { offset?: number[] };
  assert.deepEqual(byDelta.offset, [4, 0, 0]);
  const byPoint = await added(doc, { command: 'move', bodies: [b], values: { ax: 7 } }) as { offset?: number[] };
  assert.equal(byPoint.offset?.[0], 7 - (await stateOf(doc)).bodies[0].mesh.bounds.min[0]);
});

test('O20: a tapped hole keeps a given Ø; without one, its thread\'s tap drill', async () => {
  const doc = withSampleRows(cube()), faces = ['n1.top'], tap = SAMPLE_SIZES.M6.tap;
  const given = await added(doc, { command: 'hole', faces, values: { type: 'tapped', thread: 'M6', d: tap + 0.3, x: 5, y: 5, tend: 'through' } }) as { radius?: number };
  assert.equal(given.radius, (tap + 0.3) / 2);
  const drilled = await added(doc, { command: 'hole', faces, values: { type: 'tapped', thread: 'M6', x: 5, y: 5, tend: 'through' } }) as { radius?: number };
  assert.equal(drilled.radius, tap / 2);
});

test('O20: a fastener keeps a given length; one its size does not come in is refused, never swapped', async () => {
  const doc = withSampleRows(cube());
  const s = await stateOf(doc);
  const r = await runTool(s, 'run_command', { command: 'fastener', values: { kind: 'hex-bolt', size: 'M6', length: '21', x: 0, y: 0, z: 10 } }, evaluate);
  assert.ok(r.isError, 'a 21 mm M6 bolt is not offered: refused');
  assert.match(r.content, /"length\\" is one of 12, 16, 20/);
  const ok = await runTool(s, 'run_command', { command: 'fastener', values: { kind: 'hex-bolt', size: 'M6', length: '20', x: 0, y: 0, z: 10 } }, evaluate);
  assert.ok(!ok.isError, ok.content);
  assert.match(JSON.stringify(ok.state.doc), /20/);
});

test('O20: the audit — every command with a derive is one of those tested here', () => {
  assert.deepEqual(commands.filter(c => c.derive).map(c => c.id).sort(), ['fastener', 'hole', 'mirror', 'move', 'split']);
});
