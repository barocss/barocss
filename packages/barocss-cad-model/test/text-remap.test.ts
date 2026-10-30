import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, type ModelNode, type StudioDoc } from '../src/engine/doc';
import type { Op } from '../src/engine/schema/proposals';
import type { Evaluate, PartRun } from '../src/chat/toolKit';
import { moveOpsWith } from '../src/chat/part/history';
import { moveOp, renameIds } from '../src/chat/remap';
import { captureOp, mergeTurn, type TurnPatch } from '../src/chat/merge';
import { modelHash } from '../src/chat/spec';
import { treeDiff } from '../src/chat/transactions';
import { mergeDocs } from '../src/versions/merge';
import { nextSerial } from '../src/engine/ids';
import { revisionOf } from '../src/util/revision';

type TextNode = Extract<ModelNode, { kind: 'text' }>;
const hash = 'b5' + 'a'.repeat(62);
const ids = new Map([['n5', 'n7']]);
const evaluate: Evaluate = async () => ({ ok: true, revision: 1, wallTime: 0, bodies: [] });

// These are tree/proposal transport contracts. The evaluator intentionally does no geometry.
function text(id: string, value = 'n5 b5 n5.top'): TextNode {
  return { kind: 'text', id, text: value, font: { blob: hash, filename: 'font-n5.ttf', source: 'https://fonts.example/n5', license: 'OFL-1.1' }, size: 10, height: 2, tolerance: 0.01 };
}
function sketch(id: string, x = 0): ModelNode { return { kind: 'sketch', id, profile: 'rectangle', min: [x, 0], max: [x + 1, 1] }; }
function document(nodes: ModelNode[], nextId: number, parameters: Record<string, number> = {}): StudioDoc { return { ...emptyDoc(), nodes, nextId, parameters }; }
function commandValues(node: TextNode) { return { text: node.text, font: JSON.stringify(node.font), size: node.size, height: node.height, tolerance: node.tolerance, tracking: node.tracking ?? 0 }; }
function patch(before: StudioDoc, after: StudioDoc): TurnPatch {
  const added = after.nodes.filter(n => !before.nodes.some(was => was.id === n.id));
  return { id: 'text-turn', by: { agent: 'test' }, base: revisionOf(before), nextId: nextSerial(before), ops: [captureOp(before, after, 'add_features', { features: added })] };
}

test('text/font literals survive id remapping while actual names, body keys and expressions move', () => {
  // Extra descriptor keys make the opaque utility boundary explicit; this value is not document admission evidence.
  const literal = { ...text('n5'), font: { ...text('n5').font, n5: { b5: ['n5', 'n5.top'] } }, size: { expr: 'n5 + W' } };
  const input = { node: literal, face: 'n5.top', body: 'b5', references: { n5: 'b5' } };
  const out = renameIds(input, ids);
  assert.equal(out.node.id, 'n7');
  assert.equal(out.node.text, literal.text);
  assert.deepEqual(out.node.font, literal.font);
  assert.notEqual(out.node.font, literal.font, 'remapped output owns its opaque record copy');
  assert.deepEqual(out.node.size, { expr: 'n7 + W' });
  assert.deepEqual([out.face, out.body, out.references], ['n7.top', 'b7', { n7: 'b7' }]);
  assert.equal(input.node.id, 'n5'); assert.equal(input.node.font.blob, hash);
});

test('proposal op remapping preserves text/font payloads and moves sibling references by identity', () => {
  const label = text('n5');
  const op: Op = { tool: 'propose', args: { ops: [
    { tool: 'add_features', args: { features: [label, { kind: 'fillet', id: 'n6', parent: { node: 0, side: 'solid' }, edges: ['n5.top'], radius: 1 }] } },
    { tool: 'edit_feature', args: { index: 0, feature: label } },
  ] } };
  const moved = moveOp(op, { from: ['n5', 'n6'], to: ['n6', 'n7'], ids });
  assert.deepEqual(moved.missing, []);
  const ops = moved.op.args!.ops as Op[], features = ops[0].args!.features as ModelNode[];
  const changed = features[0] as TextNode, sibling = features[1] as Extract<ModelNode, { kind: 'fillet' }>;
  assert.equal(changed.id, 'n7'); assert.equal(changed.text, label.text); assert.deepEqual(changed.font, label.font);
  assert.deepEqual(sibling.parent, { node: 1, side: 'solid' }); assert.deepEqual(sibling.edges, ['n7.top']);
  assert.equal(ops[1].args!.index, 1);
  assert.deepEqual((ops[1].args!.feature as TextNode).font, label.font);
  assert.equal((ops[1].args!.feature as TextNode).text, label.text);
});

test('nested text commands preserve literal values while their real references and sibling operations move', () => {
  const label = text('n5'), values = commandValues(label);
  values.font = ' ' + values.font + '\n';
  const op: Op = { tool: 'propose', args: { ops: [{ tool: 'apply_ops', args: { ops: [
    { tool: 'run_command', args: { command: 'text', faces: ['n5.top'], bodies: ['b5'], values } },
    { tool: 'run_command', args: { command: 'fillet', edges: ['n5.top'], bodies: ['b5'], values: { radius: 1, text: 'n5', font: 'b5' } } },
  ] } }] } };
  const moved = moveOp(op, { from: ['n5', 'n6'], to: ['n6', 'n7'], ids });
  assert.deepEqual(moved.missing, []);
  const batch = (moved.op.args!.ops as Op[])[0], ops = batch.args!.ops as Op[];
  const labelArgs = ops[0].args!, labelValues = labelArgs.values as typeof values;
  assert.equal(labelValues.text, values.text); assert.equal(labelValues.font, values.font, 'prepared font JSON retains exact whitespace and source bytes');
  assert.deepEqual(labelArgs.faces, ['n7.top']); assert.deepEqual(labelArgs.bodies, ['b7']);
  assert.deepEqual(ops[1].args!.edges, ['n7.top']); assert.deepEqual(ops[1].args!.bodies, ['b7']);
  assert.deepEqual(ops[1].args!.values, { radius: 1, text: 'n7', font: 'b7' }, 'the opaque rule is limited to the exact text command');
  assert.deepEqual(renameIds({ command: 'text', values: { text: 'n5', font: 'b5' } }, ids), { command: 'text', values: { text: 'n7', font: 'b7' } }, 'a bare object is not a run_command operation');
});

test('chat merge does not invent deleted-feature or parameter dependencies from a captured text command', async () => {
  const parameters = { W: 10, text: 1, n1: 1 }, before = document([sketch('n0')], 1, parameters);
  const label = { ...text('n1', 'n0.top W b0'), font: { ...text('n1').font, filename: 'font-n0.ttf', source: 'https://fonts.example/n0.top/W' } };
  const after = document([...before.nodes, label], 2, parameters), now = document([], 1, { W: 20, text: 2, n1: 2 });
  const turn = { ...patch(before, after), ops: [captureOp(before, after, 'run_command', { command: 'text', values: commandValues(label) })] };
  const merged = await mergeTurn(before, now, turn, evaluate);
  assert.deepEqual(merged.applied, [0]); assert.deepEqual(merged.deferred, []);
  assert.deepEqual(merged.doc.nodes, [label]);
});

test('the proposal rebase consumer dispatches the moved index while preserving the opaque feature payload', async () => {
  const label = text('n5'), values = commandValues(label), seen: { tool: string; args: Record<string, unknown> }[] = [];
  const state = { doc: document([sketch('n6'), text('n7')], 8), bodies: [] };
  const dispatch: PartRun = async (current, tool, input) => {
    seen.push({ tool, args: input as Record<string, unknown> });
    return { state: current, changed: true, content: '{}', isError: false, summary: 'transport stub' };
  };
  const moved = await moveOpsWith(dispatch, state, [
    { tool: 'edit_feature', args: { index: 0, feature: label } },
    { tool: 'run_command', args: { command: 'text', faces: ['n5.top'], values } },
  ], [['n5', 'n6'], ['n5', 'n6']], evaluate, new Map(ids));
  assert.ok(!('error' in moved), JSON.stringify(moved));
  assert.deepEqual(seen.map(call => call.tool), ['edit_feature', 'run_command']);
  assert.equal(seen[0].args.index, 1);
  const feature = seen[0].args.feature as TextNode;
  assert.equal(feature.id, 'n7'); assert.equal(feature.text, label.text); assert.deepEqual(feature.font, label.font);
  assert.deepEqual(seen[1].args.faces, ['n7.top']); assert.deepEqual(seen[1].args.values, values);
});

test('chat merge still sees actual text dimension parameter dependencies', async () => {
  const before = document([sketch('n0')], 1, { W: 10 });
  const label = { ...text('n1'), size: { parameter: 'W' } };
  const after = document([...before.nodes, label], 2, { W: 10 }), now = document([...before.nodes], 1, { W: 20 });
  const merged = await mergeTurn(before, now, patch(before, after), evaluate);
  assert.equal(merged.deferred[0]?.code, 'TURN_PARAMETER_CHANGED');
});

test('chat merge preserves the same-node conflict for actual text edits', async () => {
  const before = document([text('n5', 'before')], 6), after = document([text('n5', 'agent')], 6), now = document([text('n5', 'person')], 6);
  const op = captureOp(before, after, 'edit_feature', { index: 0, feature: after.nodes[0] });
  const turn: TurnPatch = { id: 'edit-text', by: { agent: 'test' }, base: revisionOf(before), nextId: 6, ops: [op] };
  const merged = await mergeTurn(before, now, turn, evaluate);
  assert.equal(merged.deferred[0]?.code, 'TURN_SAME_NODE');
  assert.equal((merged.doc.nodes[0] as TextNode).text, 'person');
});

test('version merge resolves real id clashes without changing opaque text/font strings', () => {
  const before = document([sketch('n0')], 5);
  const ours = document([...before.nodes, sketch('n5', 20), sketch('n6', 30)], 7);
  const label = text('n5');
  const theirs = document([...before.nodes, label, { kind: 'fillet', id: 'n6', parent: { node: 1, side: 'solid' }, edges: ['n5.top'], radius: 1 }], 7);
  const result = mergeDocs(before, ours, theirs);
  assert.ok('doc' in result, JSON.stringify(result));
  const moved = result.doc.nodes.find(n => n.id === 'n7') as TextNode;
  const sibling = result.doc.nodes.find(n => n.id === 'n8') as Extract<ModelNode, { kind: 'fillet' }>;
  assert.equal(moved.kind, 'text'); assert.equal(moved.text, label.text); assert.deepEqual(moved.font, label.font);
  assert.deepEqual(sibling.edges, ['n7.top']);
  assert.equal(sibling.parent.node, result.doc.nodes.indexOf(moved));
});

test('version merge does not make opaque literals depend on a feature deleted by the other branch', () => {
  const before = document([sketch('n0')], 1), ours = document([], 1);
  const label = { ...text('n1', 'n0.top'), font: { ...text('n1').font, filename: 'n0.ttf', source: 'https://fonts.example/n0.top' } };
  const theirs = document([...before.nodes, label], 2), result = mergeDocs(before, ours, theirs);
  assert.ok('doc' in result, JSON.stringify(result));
  assert.deepEqual(result.doc.nodes, [label]);
});

test('text and font metadata edits remain visible to diffs, revisions and version conflicts', () => {
  const before = document([text('n5', 'before')], 6);
  const textChanged = document([text('n5', 'after')], 6);
  const fontChanged = document([{ ...text('n5', 'before'), font: { ...text('n5').font, filename: 'different.ttf' } }], 6);
  for (const changed of [textChanged, fontChanged]) {
    assert.deepEqual(treeDiff(before, changed).changed.map(n => n.id), ['n5']);
    assert.notEqual(modelHash(before), modelHash(changed));
    assert.notEqual(revisionOf(before), revisionOf(changed));
  }
  for (const [ours, theirs] of [[textChanged, document([text('n5', 'third')], 6)], [fontChanged, document([{ ...text('n5', 'before'), font: { ...text('n5').font, filename: 'third.ttf' } }], 6)]]) {
    const result = mergeDocs(before, ours, theirs);
    assert.ok('conflicts' in result);
    assert.ok(result.conflicts.some(c => c.code === 'FEATURE_EDITED_BOTH' && c.where === 'feature:n5'));
  }
});
