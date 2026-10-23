import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '../src/engine/evaluate';
import { rectanglePart, type ModelNode, type StudioDoc } from '../src/engine/doc';
import { nextSerial, withIds } from '../src/engine/ids';
import { acceptProposal, runTool, type ChatState } from '../src/chat/tools';
import { captureOp, changedDuring, mergeTurn, type TurnPatch } from '../src/chat/merge';
import { revisionOf } from '../src/util/revision';
import { withHistory } from '../src/chat/proposals';

// O133 (item 0, the owner's decision): a chat turn merged onto the part as the person left it — the agent's ops applied
// where they do not collide with the person's edits made during the turn, the rest one proposal with typed reasons.
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return { doc, bodies: r.bodies }; }
/** A turn run on `base` as the tool server runs it, each call that changed the part captured. */
async function turn(base: ChatState, calls: [string, Record<string, unknown>][]): Promise<{ patch: TurnPatch; end: ChatState }> {
  let s = base; const ops = [];
  for (const [tool, args] of calls) {
    const r = await runTool(s, tool, args, evaluate); assert.ok(!r.isError, `${tool}: ${r.content}`);
    if (r.changed) ops.push(captureOp(s.doc, r.state.doc, tool, args));
    s = r.state;
  }
  return { patch: { id: 'T1', by: { agent: 'chat' }, base: revisionOf(base.doc), nextId: nextSerial(base.doc), ops }, end: s };
}
/** The person's edit: a tool call of theirs on the part (as the studio commits one). */
async function edit(s: ChatState, tool: string, args: Record<string, unknown>): Promise<ChatState> { const r = await runTool(s, tool, args, evaluate); assert.ok(!r.isError, r.content); return r.state; }
const node = (doc: StudioDoc, id: string) => doc.nodes.find(n => n.id === id) as unknown as Record<string, unknown> | undefined;
const box = (x: number, h: number) => ({ command: 'box', values: { w: 10, d: 10, h, x, y: 0, z: 0 } });

test('the README repro: a long turn and a box the person added meanwhile — both kept, no id meets another', async () => {
  const base = await stateOf(rectanglePart(40, 20, 8));
  // (The turn: a box, eight edits of its height by index, a hole in the plate.)
  const calls: [string, Record<string, unknown>][] = [['run_command', box(50, 10)]];
  for (let h = 11; h <= 18; h++) calls.push(['edit_feature', { index: 3, values: { h } }]);
  calls.push(['run_command', { command: 'hole', faces: ['n1.top'], values: { d: 6, x: 10, y: 10 } }]);
  const { patch, end } = await turn(base, calls);
  assert.equal(patch.ops.length, 10);
  // (The person, meanwhile: a box of their own, n2 and n3 — the ids the agent's box had.)
  const now = await edit(base, 'run_command', box(-20, 5));
  assert.deepEqual(now.doc.nodes.map(n => n.id), ['n0', 'n1', 'n2', 'n3']);
  assert.ok(changedDuring(base.doc, now.doc));
  const m = await mergeTurn(base.doc, now.doc, patch, evaluate);
  assert.deepEqual([m.applied.length, m.deferred, m.proposal], [10, [], null]);
  // The person's box keeps its 5; the agent's, moved to n4 and n5, is 18; the hole is n6, on the plate's top.
  assert.equal(node(m.doc, 'n3')!.height, 5);
  assert.equal(node(m.doc, 'n5')!.height, 18);
  assert.equal(node(m.doc, 'n5')!.sketch, m.doc.nodes.findIndex(n => n.id === 'n4'));
  assert.ok(JSON.stringify(node(m.doc, 'n6')).includes('n1.top'));
  assert.deepEqual(new Set(m.doc.nodes.map(n => n.id)), new Set(['n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6']));
  // It builds: the plate with a hole and both boxes (the agent's alone left its own n2…n4).
  const r = await evaluate(m.doc); assert.ok(r.ok);
  const vol = r.bodies.reduce((s, b) => s + (b.volumeMM3 ?? 0), 0), plate = 40 * 20 * 8 - Math.PI * 9 * 8;
  assert.ok(Math.abs(vol - (plate + 10 * 10 * 18 + 10 * 10 * 5)) < 1, String(vol));
  assert.equal(end.doc.nodes.length, 5);
});

test('the same feature edited both ways: the person\'s value kept, the agent\'s edit a proposal (TURN_SAME_NODE); the rest applied', async () => {
  const base = await stateOf(rectanglePart(40, 20, 8));
  const { patch } = await turn(base, [['edit_feature', { index: 1, values: { h: 20 } }], ['run_command', box(50, 10)]]);
  const now = await edit(base, 'edit_feature', { index: 1, values: { h: 12 } });
  const m = await mergeTurn(base.doc, now.doc, patch, evaluate);
  assert.equal(node(m.doc, 'n1')!.height, 12);
  assert.deepEqual(m.applied, [1]);
  assert.deepEqual(m.deferred.map(c => [c.op, c.code]), [[0, 'TURN_SAME_NODE']]);
  assert.match(m.deferred[0].reason, /you changed n1 during the turn/);
  const p = m.doc.proposals!.find(q => q.id === m.proposal)!;
  assert.deepEqual([p.status, p.merge!.turn, p.merge!.conflicts.length], ['open', 'T1', 1]);
  assert.match(p.plan!, /edit_feature: not applied — you changed n1/);
  // Accepted on the merged part, it is the agent's 20 (the person's choice).
  const a = await acceptProposal(await stateOf(m.doc), p.id, evaluate); assert.ok(!('error' in a), JSON.stringify(a));
  assert.equal(node(a.state.doc, 'n1')!.height, 20);
  assert.ok(a.state.doc.nodes.some(n => n.kind === 'extrude' && (n as unknown as { height: number }).height === 10), 'the applied box stays');
});

test('a feature the agent used, deleted by the person meanwhile: not applied (TURN_NODE_GONE), never a silent overwrite', async () => {
  const start = await edit(await stateOf(rectanglePart(40, 20, 8)), 'run_command', box(50, 10));
  const { patch } = await turn(start, [['run_command', { command: 'hole', faces: ['n3.top'], values: { d: 4, x: 55, y: 5 } }], ['run_command', box(-20, 6)]]);
  const now = await edit(start, 'delete_feature', { index: 3 });
  assert.ok(!now.doc.nodes.some(n => n.id === 'n3'));
  const m = await mergeTurn(start.doc, now.doc, patch, evaluate);
  assert.deepEqual(m.deferred.map(c => [c.op, c.code]), [[0, 'TURN_NODE_GONE']]);
  assert.match(m.deferred[0].reason, /uses n3, which you deleted/);
  assert.ok(!m.doc.nodes.some(n => n.id === 'n3'), 'the person\'s delete stands');
  assert.deepEqual(m.applied, [1]);
});

test('a parameter the person changed, which an op of the agent\'s names: not applied (TURN_PARAMETER_CHANGED)', async () => {
  const doc = rectanglePart(40, 20, 8); doc.parameters = { H: 8 };
  const base = await stateOf(doc);
  const { patch } = await turn(base, [['add_features', { features: [{ kind: 'sketch', profile: 'rectangle', min: [50, 0], max: [60, 10] }, { kind: 'extrude', sketch: 2, height: { parameter: 'H' } }] }]]);
  const now = await stateOf({ ...base.doc, parameters: { H: 12 } });
  const m = await mergeTurn(base.doc, now.doc, patch, evaluate);
  assert.deepEqual(m.deferred.map(c => c.code), ['TURN_PARAMETER_CHANGED']);
  assert.match(m.deferred[0].reason, /parameter H/);
  assert.deepEqual([m.doc.parameters.H, m.doc.nodes.length], [12, 2]);
});

test('implicit context: an op that picked what a deferred op made (the newest sketch) is deferred too, not run on the person\'s sketch', async () => {
  const base = await stateOf(rectanglePart(40, 20, 8));
  // Op 0 adds a sketch and edits the plate (which the person edits too): deferred. Op 1 extrudes "the newest finished
  // sketch no feature uses yet" — op 0's, in the turn. On the person's part the newest unused sketch is theirs.
  const { patch } = await turn(base, [
    ['apply_ops', { ops: [{ tool: 'add_features', args: { features: [{ kind: 'sketch', profile: 'rectangle', min: [50, 0], max: [60, 10] }] } }, { tool: 'edit_feature', args: { index: 1, values: { h: 20 } } }] }],
    ['run_command', { command: 'extrude', values: { h: 7 } }],
  ]);
  let now = await edit(base, 'edit_feature', { index: 1, values: { h: 12 } });
  const mine: ModelNode = { kind: 'sketch', profile: 'rectangle', min: [-30, 0], max: [-20, 10] } as ModelNode;
  now = await stateOf(withIds({ ...now.doc, nodes: [...now.doc.nodes, mine] }));
  const m = await mergeTurn(base.doc, now.doc, patch, evaluate);
  assert.deepEqual(m.deferred.map(c => [c.op, c.code]), [[0, 'TURN_SAME_NODE'], [1, 'TURN_BUILDS_ON_DEFERRED']]);
  assert.match(m.deferred[1].reason, /builds on n\d+, which an earlier change of the turn made/);
  assert.deepEqual(m.applied, []);
  // Nothing extrudes the person's sketch; the plate keeps their 12.
  assert.ok(!m.doc.nodes.some(n => n.kind === 'extrude' && (n as unknown as { height: number }).height === 7));
  assert.equal(node(m.doc, 'n1')!.height, 12);
  assert.equal(m.doc.proposals!.find(q => q.id === m.proposal)!.merge!.conflicts.length, 2);
});

test('no edit during the turn: the base is not stale (the design history alone does not count)', async () => {
  const base = rectanglePart(40, 20, 8);
  assert.equal(changedDuring(base, withHistory(base, { kind: 'prompt', by: { agent: 'chat' }, prompt: 'x' })), false);
  assert.equal(changedDuring(base, { ...base, parameters: { A: 1 } }), true);
});
