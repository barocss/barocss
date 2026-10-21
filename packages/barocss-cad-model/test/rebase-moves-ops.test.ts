import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '../src/engine/evaluate';
import { rectanglePart, type StudioDoc } from '../src/engine/doc';
import { acceptProposal, rebaseProposal, runTool, type ChatState } from '../src/chat/tools';

// O133: a proposal's op naming, by index, a feature an earlier op of it made, rebased onto a part the person added a
// feature to meanwhile. Before O133 the rebase replayed `edit_feature {index: 3}` as written and it edited the
// person's box (found by a probe, the item 0 S0's "to check"); now each op is moved by what its indices named.
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok); return { doc, bodies: r.bodies }; }
const heights = (doc: StudioDoc) => doc.nodes.filter(n => n.kind === 'extrude').map(n => [n.id, (n as unknown as { height: unknown }).height]);

test('a rebased proposal edits its own feature, not the one the person added at that index meanwhile', async () => {
  let s = await stateOf(rectanglePart(40, 20, 8));
  const BOX = { tool: 'run_command', args: { command: 'box', values: { w: 10, d: 10, h: 10, x: 50, y: 0, z: 0 } } };
  const r = await runTool(s, 'propose', { title: 'a box, then its height 30', ops: [BOX, { tool: 'edit_feature', args: { index: 3, values: { h: 30 } } }] }, evaluate);
  assert.ok(!r.isError, r.content); s = r.state;
  assert.deepEqual(s.doc.proposals![0].orders, [['n0', 'n1'], ['n0', 'n1', 'n2', 'n3']]);
  const mine = await runTool(s, 'run_command', { command: 'box', values: { w: 5, d: 5, h: 5, x: -20, y: 0, z: 0 } }, evaluate);
  assert.ok(!mine.isError, mine.content); s = mine.state;
  const rb = await rebaseProposal(s, 'P1', evaluate); assert.ok(!('error' in rb), JSON.stringify(rb)); s = rb.state;
  assert.deepEqual(s.doc.proposals![0].ops[1].args, { index: 5, values: { h: 30 } });
  const a = await acceptProposal(s, 'P1', evaluate); assert.ok(!('error' in a), JSON.stringify(a));
  // The person's box (n2, n3) keeps its 5; the proposal's (n4, n5) is 30.
  assert.deepEqual(heights(a.state.doc), [['n1', 8], ['n3', 5], ['n5', 30]]);
});
