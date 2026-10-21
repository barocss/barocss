import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '@barocss/cad-model/engine/evaluate';
import { rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { runTool, type ChatState } from '@barocss/cad-model/chat/tools';

// Transactions (A4.1): batches all or nothing, dry runs, op ids, checkpoints and diffs.
const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
async function stateOf(doc: StudioDoc): Promise<ChatState> { const r = await evaluate(doc); assert.ok(r.ok); return { doc, bodies: r.bodies }; }
const parse = (content: string) => JSON.parse(content) as Record<string, any>;
const OPS = [
  { tool: 'run_command', opId: 'hole-1', args: { command: 'hole', faces: ['n1.top'], values: { d: 6, x: 10, y: 10 } } },
  { tool: 'run_command', opId: 'fillet-1', args: { command: 'fillet', edges: [{ between: [{ feature: 1, role: 'top' }, { normal: [1, 0, 0] }] }], values: { radius: 1 } } },
];

test('apply_ops: all or nothing, a dry run first, a retried batch not applied twice', async () => {
  const s = await stateOf(rectanglePart(40, 20, 8));
  // A dry run: what would change, the part as it was.
  const dry = await runTool(s, 'apply_ops', { ops: OPS, dryRun: true }, evaluate), d = parse(dry.content);
  assert.ok(!dry.isError, dry.content); assert.equal(dry.changed, false); assert.equal(dry.state.doc, s.doc);
  assert.deepEqual(d.diff.added.map((a: { id: string }) => a.id), ['n2', 'n3']);
  assert.ok(d.change.volume_mm3 < 0 && d.broken_references === undefined);
  // Applied.
  const r = await runTool(s, 'apply_ops', { ops: OPS }, evaluate), out = parse(r.content);
  assert.ok(!r.isError, r.content); assert.equal(r.state.doc.nodes.length, 4);
  assert.deepEqual(out.applied.map((a: { opId: string }) => a.opId), ['hole-1', 'fillet-1']);
  // Retried (a lost reply): both skipped, nothing changes.
  const again = await runTool(r.state, 'apply_ops', { ops: OPS }, evaluate);
  assert.deepEqual(parse(again.content).applied.map((a: { skipped?: string }) => a.skipped), ['already applied', 'already applied']);
  assert.equal(again.state.doc.nodes.length, 4); assert.equal(again.changed, false);
  // One refused: none applied, the state the very same.
  const bad = await runTool(s, 'apply_ops', { ops: [OPS[0], { tool: 'run_command', args: { command: 'hole', faces: ['n9.top'], values: { d: 6 } } }] }, evaluate);
  assert.ok(bad.isError); assert.match(parse(bad.content).error, /op 1 \(run_command\) was refused: .*Nothing was applied/);
  assert.equal(bad.state, s);
  assert.ok((await runTool(s, 'apply_ops', { ops: [{ tool: 'apply_ops', args: {} }] }, evaluate)).isError, 'no batch in a batch');
});

test('checkpoint, diff and restore', async () => {
  let s = await stateOf(rectanglePart(40, 20, 8));
  s = (await runTool(s, 'checkpoint', { name: 'start' }, evaluate)).state;
  s = (await runTool(s, 'apply_ops', { ops: OPS }, evaluate)).state;
  s = (await runTool(s, 'edit_feature', { index: 1, values: { h: 10 } }, evaluate)).state;
  const diff = parse((await runTool(s, 'diff', { from: 'start' }, evaluate)).content).diff;
  assert.deepEqual([diff.added.length, diff.changed.map((c: { id: string }) => c.id), diff.deleted], [2, ['n1'], []]);
  assert.match(diff.changed[0].before + ' → ' + diff.changed[0].after, /8.*→.*10/);
  const r = await runTool(s, 'restore', { name: 'start' }, evaluate);
  assert.ok(!r.isError, r.content); assert.equal(r.state.doc.nodes.length, 2);
  assert.deepEqual(parse((await runTool(r.state, 'diff', { from: 'start' }, evaluate)).content).diff, { added: [], changed: [], deleted: [], moved: [] });
  assert.ok((await runTool(s, 'restore', { name: 'nope' }, evaluate)).isError);
});
