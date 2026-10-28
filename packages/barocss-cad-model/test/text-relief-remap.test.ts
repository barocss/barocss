import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, type ModelNode, type StudioDoc } from '../src/engine/doc';
import type { Op } from '../src/engine/schema/proposals';
import type { Evaluate } from '../src/chat/toolKit';
import { moveOp, renameIds } from '../src/chat/remap';
import { captureOp, mergeTurn, type TurnPatch } from '../src/chat/merge';
import { treeDiff } from '../src/chat/transactions';
import { modelHash } from '../src/chat/spec';
import { mergeDocs } from '../src/versions/merge';
import { nextSerial } from '../src/engine/ids';
import { revisionOf } from '../src/util/revision';
import { parameterUses, referencesRenamed } from '../src/engine/parameters';

type Relief = Extract<ModelNode, { kind: 'text-relief' }>;
const hash = 'b5' + 'a'.repeat(62), ids = new Map([['n5', 'n7']]);
const evaluate: Evaluate = async () => ({ ok: true, revision: 1, wallTime: 0, bodies: [] });

// Tree/proposal transport evidence only: the evaluator intentionally does not run geometry.
function relief(id = 'n5', text = 'n5 b5 n5.top', parent = 0): Relief {
  return { kind: 'text-relief', id, parent: { node: parent, side: 'solid' }, faces: ['n2.top'], text,
    font: { blob: hash, filename: 'font-n5.ttf', source: 'https://fonts.example/n5', license: 'n5 OFL-1.1' }, size: 10, depth: 2, at: [5, 5], mode: 'emboss', tolerance: 0.01 };
}
function sketch(id: string, x = 0): ModelNode { return { kind: 'sketch', id, profile: 'rectangle', min: [x, 0], max: [x + 1, 1] }; }
function doc(nodes: ModelNode[], nextId = 6, parameters: Record<string, number> = {}): StudioDoc { return { ...emptyDoc(), nodes, nextId, parameters }; }
function values(n: Relief) { return { text: n.text, font: ' \n' + JSON.stringify(n.font) + '\n ', size: n.size, depth: n.depth, tolerance: n.tolerance, tracking: n.tracking ?? 0, x: n.at[0], y: n.at[1], mode: n.mode }; }
function patch(before: StudioDoc, after: StudioDoc): TurnPatch {
  const added = after.nodes.filter(n => !before.nodes.some(was => was.id === n.id));
  return { id: 'text-relief-turn', by: { agent: 'test' }, base: revisionOf(before), nextId: nextSerial(before), ops: [captureOp(before, after, 'add_features', { features: added })] };
}

test('text relief remap: opaque text/font remain exact while real parent, faces, sig keys and siblings move', () => {
  const original = { ...relief('n5'), faces: ['n5.top'] as [string], sigs: { 'n5.top': { k: 'plane', p: [1, 2, 3] as [number, number, number], s: 10 } }, font: { ...relief().font, n5: { b5: ['n5', 'n5.top'] } } };
  // The extra font keys expose opacity; this synthetic descriptor is not document-admission evidence.
  const op: Op = { tool: 'add_features', args: { features: [original, { kind: 'fillet', id: 'n6', parent: { node: 0, side: 'solid' }, edges: ['n5.top'], radius: 1 }] } };
  const moved = moveOp(op, { from: ['n5', 'n6'], to: ['n6', 'n7'], ids }); assert.deepEqual(moved.missing, []);
  const [changed, sibling] = moved.op.args!.features as [Relief, Extract<ModelNode, { kind: 'fillet' }>];
  assert.equal(changed.id, 'n7'); assert.equal(changed.text, original.text); assert.deepEqual(changed.font, original.font); assert.notEqual(changed.font, original.font);
  assert.deepEqual(changed.parent, { node: 1, side: 'solid' }); assert.deepEqual(changed.faces, ['n7.top']); assert.deepEqual(Object.keys(changed.sigs!), ['n7.top']);
  assert.deepEqual(sibling.parent, { node: 1, side: 'solid' }); assert.deepEqual(sibling.edges, ['n7.top']);
  assert.equal(original.id, 'n5'); assert.deepEqual(original.faces, ['n5.top']);
});

test('text relief remap: exact nested prepared command keeps raw font JSON and text; other references still move', () => {
  const original = values(relief()), op: Op = { tool: 'propose', args: { ops: [{ tool: 'apply_ops', args: { ops: [
    { tool: 'run_command', args: { command: 'text-relief', faces: ['n5.top'], bodies: ['b5'], values: original } },
    { tool: 'run_command', args: { command: 'fillet', edges: ['n5.top'], values: { text: 'n5', font: 'b5' } } },
  ] } }] } };
  const moved = moveOp(op, { from: ['n5'], to: ['n7'], ids }); assert.deepEqual(moved.missing, []);
  const batch = (moved.op.args!.ops as Op[])[0], operations = batch.args!.ops as Op[], changed = operations[0].args!.values as typeof original;
  assert.equal(changed.text, original.text); assert.equal(changed.font, original.font, 'prepared JSON is not parsed, rewritten or normalized');
  assert.deepEqual(operations[0].args!.faces, ['n7.top']); assert.deepEqual(operations[0].args!.bodies, ['b7']);
  assert.deepEqual(operations[1].args!.values, { text: 'n7', font: 'b7' });
  assert.deepEqual(renameIds({ command: 'text-relief', values: { text: 'n5', font: 'b5' } }, ids), { command: 'text-relief', values: { text: 'n7', font: 'b7' } });
  const standalone = { ...relief(), kind: 'text', height: 2 };
  assert.equal(renameIds(standalone, ids).text, standalone.text, 'the existing Text literal boundary remains');
});

test('text relief chat merge: literal feature/parameter names do not invent dependencies for prepared commands', async () => {
  const parameters = { W: 10, 'text-relief': 1, emboss: 1, n5: 1 }, before = doc([sketch('n0'), sketch('n2')], 5, parameters);
  const node = { ...relief('n5', 'n0.top W b0', 1), font: { ...relief().font, filename: 'font-n0.ttf', source: 'https://fonts.example/n0.top/W' } };
  const after = doc([...before.nodes, node], 6, parameters), now = doc([sketch('n2')], 5, { W: 20, 'text-relief': 2, emboss: 2, n5: 2 });
  const turn = { ...patch(before, after), ops: [captureOp(before, after, 'run_command', { command: 'text-relief', faces: node.faces, values: values(node) })] };
  const result = await mergeTurn(before, now, turn, evaluate); assert.deepEqual(result.applied, [0]); assert.deepEqual(result.deferred, []);
  const moved = result.doc.nodes.at(-1) as Relief; assert.equal(moved.text, node.text); assert.deepEqual(moved.font, node.font); assert.equal(moved.parent.node, 0);
});

test('text relief chat merge: size, depth, tracking and both baseline coordinates keep actual parameter dependencies', async () => {
  const before = doc([sketch('n2')], 5, { W: 10 }), base = relief();
  const bound: Relief[] = [{ ...base, size: { parameter: 'W' } }, { ...base, depth: { parameter: 'W' } }, { ...base, tracking: { parameter: 'W' } }, { ...base, at: [{ parameter: 'W' }, 5] }, { ...base, at: [5, { parameter: 'W' }] }];
  for (const node of bound) {
    const after = doc([...before.nodes, node], 6, { W: 10 }), now = doc(before.nodes, 5, { W: 20 });
    const result = await mergeTurn(before, now, patch(before, after), evaluate); assert.equal(result.deferred[0]?.code, 'TURN_PARAMETER_CHANGED');
    assert.equal(parameterUses([node], 'W'), 1); const renamed = referencesRenamed([node], 'W', 'Next')[0]; assert.equal(parameterUses([renamed], 'W'), 0); assert.equal(parameterUses([renamed], 'Next'), 1);
    assert.deepEqual((renamed as Relief).font, node.font); assert.equal((renamed as Relief).text, node.text);
  }
  assert.equal(parameterUses([base], 'n5'), 0); assert.equal(parameterUses([base], 'W'), 0);
});

test('text relief chat merge: deleting the real parent remains a missing-dependency conflict', async () => {
  const before = doc([sketch('n2')], 5), node = relief(), after = doc([...before.nodes, node], 6), now = doc([], 5);
  const result = await mergeTurn(before, now, patch(before, after), evaluate); assert.equal(result.deferred[0]?.code, 'TURN_NODE_GONE');
});

test('text relief version merge: ID clashes move real refs without altering font/text or restoring literal-only dependencies', () => {
  const before = doc([sketch('n0'), sketch('n2')], 5), ours = doc([sketch('n2'), sketch('n5', 20), sketch('n6', 30)], 7);
  const node = { ...relief('n5', 'n0.top n5 b5', 1), faces: ['n2.top'] as [string], font: { ...relief().font, filename: 'n0.ttf' } };
  const theirs = doc([...before.nodes, node, { kind: 'fillet', id: 'n6', parent: { node: 2, side: 'solid' }, edges: ['n5.top'], radius: 1 }], 7);
  const merged = mergeDocs(before, ours, theirs); assert.ok('doc' in merged, JSON.stringify(merged));
  assert.equal(merged.doc.nodes.some(n => n.id === 'n0'), false);
  const moved = merged.doc.nodes.find(n => n.id === 'n7') as Relief, sibling = merged.doc.nodes.find(n => n.id === 'n8') as Extract<ModelNode, { kind: 'fillet' }>;
  assert.equal(moved.text, node.text); assert.deepEqual(moved.font, node.font); assert.deepEqual(moved.faces, ['n2.top']);
  assert.equal(moved.parent.node, merged.doc.nodes.findIndex(n => n.id === 'n2')); assert.deepEqual(sibling.edges, ['n7.top']); assert.equal(sibling.parent.node, merged.doc.nodes.indexOf(moved));
});

test('text relief edits remain visible to revisions, diffs and both merge conflict paths', async () => {
  const before = doc([sketch('n2'), relief()], 6), original = before.nodes[1] as Relief;
  const agent = doc([before.nodes[0], { ...original, text: 'agent' }], 6), person = doc([before.nodes[0], { ...original, text: 'person' }], 6);
  const metadata = doc([before.nodes[0], { ...original, font: { ...original.font, source: 'edited source' } }], 6);
  for (const changed of [agent, metadata]) {
    assert.deepEqual(treeDiff(before, changed).changed.map(n => n.id), ['n5']); assert.notEqual(modelHash(before), modelHash(changed)); assert.notEqual(revisionOf(before), revisionOf(changed));
  }
  const op = captureOp(before, agent, 'edit_feature', { index: 1, feature: agent.nodes[1] });
  const turn: TurnPatch = { id: 'edit-relief', by: { agent: 'test' }, base: revisionOf(before), nextId: 6, ops: [op] };
  const chat = await mergeTurn(before, person, turn, evaluate); assert.equal(chat.deferred[0]?.code, 'TURN_SAME_NODE');
  for (const ours of [agent, metadata]) {
    const other = ours === agent ? person : doc([before.nodes[0], { ...original, font: { ...original.font, source: 'other source' } }], 6);
    const result = mergeDocs(before, ours, other); assert.ok('conflicts' in result); assert.ok(result.conflicts.some(c => c.code === 'FEATURE_EDITED_BOTH' && c.where === 'feature:n5'));
  }
});
