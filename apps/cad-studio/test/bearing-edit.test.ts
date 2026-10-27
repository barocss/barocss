import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, rectanglePart, withNode, type ModelNode, type PartInstance, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { commands } from '@barocss/cad-model/app/commands';
import { editFields } from '@barocss/cad-model/app/editFields';
import { faceKey } from '@barocss/cad-model/assembly/faces';
import { bearingContextOf } from '@barocss/cad-model/engine/bearingContext';
import { bearingHousingValue } from '@barocss/cad-model/app/shaftCommands';
import { readStudioDoc } from '@barocss/cad-model/engine/migrate';
import { bearingEditCurrent, bearingFaceInput, captureBearingEditSession, prepareBearingEdit } from '../src/app/bearingEdit';

// A9-7 (ported from Codex 8789e468, G-R2): editing a placed part's bearing from the Outliner. The session keeps the
// explicit immediate occurrence as owner (two instances may share one authored child document), inherited rows reach
// the edit and its validation but never the saved child, and an async check cannot write once the root, the selection
// or the occurrence changed. No renderer, browser or kernel solid evaluation.

const selection = { faces: [], edges: [], bodies: [] };
// A row written into the test document: a fixture for the edit session, not rows an agent loaded (rule (b) governs those).
const row = { id: '6204', bore: 20, outside: 47, width: 14, chamfer: 1, daMin: 25, daMax: 26.5, raMax: 1, source: 'A9-7 test fixture row' };
const fit = { id: 'seat', rows: [{ class: 'H7', over: 30, upTo: 50, lower: 0, upper: 0.025, estimate: true }] };
const instance = (id: string, doc: StudioDoc, position: [number, number, number] = [0, 0, 0]): PartInstance => ({ id, name: id, doc, position, rotation: [0, 0, 0] });
const command = (id: string) => commands.find(c => c.id === id)!;
type Bearing = Extract<ModelNode, { kind: 'bearing' }>;
const bearing = (nodes: readonly ModelNode[], index: number) => nodes[index] as Bearing;

function fixture(): StudioDoc {
  const shaftCommand = command('shaft'), ctx = { doc: emptyDoc(), bodies: [], selection };
  const shaft = shaftCommand.build!(ctx, { ...shaftCommand.defaults!(ctx), ks: 0, gs: 0, r: 0 });
  const child = withNode(shaft, { kind: 'bearing', row: row.id, shaft: 0, step: 1, against: 'end', housingRef: { part: 'housing', body: 'b1' }, housingClass: 'H7' } as ModelNode);
  const a = instance('bearing-a', child), b = instance('bearing-b', child, [1, 0, 0]), housing = instance('housing', rectanglePart(70, 70, 20));
  return { ...emptyDoc(), parameters: { rootOnly: 4 }, bearings: { version: 1, rows: [row] }, fits: { version: 1, tables: [fit] }, instances: [a, b, housing] } as StudioDoc;
}

test('shared authored child documents retain explicit occurrence ownership and only the selected root slot changes', () => {
  const root = fixture(), before = JSON.stringify(root), [a, b, housing] = root.instances!;
  assert.equal(a.doc, b.doc);
  const session = captureBearingEditSession(root, 'bearing-b', 1);
  assert.equal(session.instance, b); assert.equal(session.root, root); assert.equal(session.owner, 'bearing-b');
  assert.equal(bearingContextOf(session.view)!.owner, 'bearing-b'); assert.deepEqual(bearingContextOf(session.view)!.ownerPose.t, [1, 0, 0]);
  assert.deepEqual(session.view.nodes, b.doc.nodes, 'editor nodes remain local; placement transform nodes are not appended');
  const nodes = session.view.nodes.map((n, i) => i === 1 ? { ...n, against: 'start' } as ModelNode : n), prepared = prepareBearingEdit(session, nodes);
  assert.notEqual(prepared.root, root); assert.equal(prepared.root.nodes, root.nodes); assert.equal(prepared.root.parameters, root.parameters);
  const placed = prepared.root.instances!;
  assert.equal(placed[0], a); assert.equal(placed[2], housing); assert.notEqual(placed[1], b);
  assert.equal(placed[1].id, b.id); assert.equal(placed[1].position, b.position); assert.equal(bearing(placed[1].doc.nodes, 1).against, 'start');
  assert.equal(bearing(a.doc.nodes, 1).against, 'end'); assert.equal(JSON.stringify(root), before);
  assert.equal(bearingContextOf(placed[1].doc), undefined); assert.equal(bearingContextOf(prepared.view)!.owner, 'bearing-b');
  const target = bearingContextOf(prepared.view)!.targets.find(t => t.part === 'bearing-b')!;
  assert.equal(bearing(target.doc.nodes, 1).against, 'start', 'validation context uses the edited occurrence');
});

test('inherited bearing/fit rows are available for editing and validation but never copied into saved authored child state', () => {
  const root = fixture(), session = captureBearingEditSession(root, 'bearing-a', 1);
  assert.equal(session.view.bearings!.rows[0], row); assert.equal(session.view.fits!.tables![0], fit);
  const prepared = prepareBearingEdit(session, session.view.nodes.map((n, i) => i === 1 ? { ...n, step: 2 } as ModelNode : n)), child = prepared.root.instances![0].doc;
  assert.equal(Object.hasOwn(child, 'bearings'), false); assert.equal(Object.hasOwn(child, 'fits'), false); assert.equal(Object.hasOwn(child, 'rowSources'), false);
  assert.equal(Object.getOwnPropertySymbols(child).length, 0, 'evaluation context is absent from authored storage');
  assert.equal(prepared.view.bearings!.rows[0], row); assert.equal(prepared.view.fits!.tables![0], fit);
  const read = readStudioDoc(JSON.stringify(prepared.root));
  assert.ok('doc' in read);
  const readChild = read.doc.instances![0].doc;
  assert.equal(Object.hasOwn(readChild, 'bearings'), false); assert.equal(Object.hasOwn(readChild, 'fits'), false);
  assert.deepEqual(bearing(readChild.nodes, 1).housingRef, { part: 'housing', body: 'b1' });
  const local = { ...row, outside: 48, source: 'explicit local override' }, childOverride = { ...root.instances![0].doc, bearings: { version: 1, rows: [local] } } as StudioDoc;
  const overrideRoot = { ...root, instances: root.instances!.map(i => i.id === 'bearing-a' ? { ...i, doc: childOverride } : i) };
  const override = captureBearingEditSession(overrideRoot, 'bearing-a', 1), stored = prepareBearingEdit(override, override.view.nodes.map(n => ({ ...n }))).root.instances![0].doc;
  assert.equal(stored.bearings!.rows[0], local); assert.equal(Object.hasOwn(stored, 'fits'), false);
});

test('the Model Housing setter keeps opaque stable links, clears old fields and retains missing current values', () => {
  const root = fixture(), session = captureBearingEditSession(root, 'bearing-a', 1), input = { root, owner: session.owner };
  const field = editFields(session.view.nodes, 1, session.view.parameters, input).find(f => f.key === 'housing')!;
  assert.equal(field.kind, 'choice');
  if (field.kind !== 'choice') return;
  const value = bearingHousingValue({ part: 'base', body: 'b99' });
  const linked = field.set(session.view.nodes, value), linkedPrepared = prepareBearingEdit(session, linked);
  const node = bearing(linkedPrepared.root.instances![0].doc.nodes, 1);
  assert.deepEqual(node.housingRef, { part: 'base', body: 'b99' }); assert.equal(Object.hasOwn(node, 'housing'), false);
  const current = editFields(linked, 1, session.view.parameters, input).find(f => f.key === 'housing')!;
  assert.ok(current.kind === 'choice' && current.options.some(o => o.value === value && /Current housing/.test(o.label)), 'a missing linked body is retained for explicit validation, not substituted');
  const local = bearing(field.set(linked, '0'), 1);
  assert.equal(local.housing, 0); assert.equal(Object.hasOwn(local, 'housingRef'), false);
  const cleared = bearing(field.set(linked, 'none'), 1);
  assert.equal(Object.hasOwn(cleared, 'housing'), false); assert.equal(Object.hasOwn(cleared, 'housingRef'), false);
});

test('capture refuses base/missing/duplicate occurrence IDs and invalid or non-bearing local indices', () => {
  const root = fixture();
  for (const owner of ['base', '', 'missing']) assert.throws(() => captureBearingEditSession(root, owner, 1), /BEARING_EDIT_SCOPE/);
  const duplicate = { ...root, instances: [...root.instances!, { ...root.instances![0] }] };
  assert.throws(() => captureBearingEditSession(duplicate, 'bearing-a', 1), /found 2/);
  for (const index of [-1, 0, 2, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => captureBearingEditSession(root, 'bearing-a', index), /existing bearing/);
  const session = captureBearingEditSession(root, 'bearing-a', 1);
  assert.throws(() => prepareBearingEdit(session, session.view.nodes.slice(0, 1)), /existing bearing/);
});

test('preparation drops a stale command receipt (dropStaleMade) without changing the authored source', () => {
  const root = fixture(), original = root.instances![0].doc, box = command('box');
  const ctx = { doc: { ...original, nodes: original.nodes.slice(0, 1) }, bodies: [], selection };
  const shape = box.build!(ctx, box.defaults!(ctx));
  const shapeIndex = shape.nodes.findIndex(n => n.kind === 'extrude' && !!n.made && n.made.command === 'box');
  assert.ok(shapeIndex >= 0);
  const child = withNode(shape, { ...original.nodes[1], id: undefined } as ModelNode), bearingIndex = child.nodes.length - 1;
  const current = { ...root, instances: root.instances!.map(i => i.id === 'bearing-a' ? { ...i, doc: child } : i) };
  const session = captureBearingEditSession(current, 'bearing-a', bearingIndex);
  const next = session.view.nodes.map((n, i) => i === shapeIndex && n.kind === 'extrude' ? { ...n, height: Number(n.height) + 1 } as ModelNode : n);
  const prepared = prepareBearingEdit(session, next);
  assert.equal(Object.hasOwn(prepared.root.instances![0].doc.nodes[shapeIndex], 'made'), false);
  assert.equal((child.nodes[shapeIndex] as { made?: { command: string } }).made?.command, 'box', 'the original authored shape receipt stays unchanged');
});

test('freshness requires the captured root, the exact selected owner and address, and the same unique immediate occurrence', () => {
  const root = fixture(), session = captureBearingEditSession(root, 'bearing-a', 1), address = { owner: 'bearing-a', index: 1 };
  assert.equal(bearingEditCurrent(session, root, ['bearing-a'], address), true);
  for (const selected of [[], ['bearing-b'], ['bearing-a', 'bearing-b'], ['bearing-a', 'bearing-a']]) assert.equal(bearingEditCurrent(session, root, selected, address), false);
  for (const edit of [null, { owner: 'bearing-b', index: 1 }, { owner: 'bearing-a', index: 0 }]) assert.equal(bearingEditCurrent(session, root, ['bearing-a'], edit), false);
  const changed: StudioDoc[] = [
    { ...root },
    { ...root, instances: root.instances!.filter(i => i.id !== 'bearing-a') },
    { ...root, instances: root.instances!.map(i => i.id === 'bearing-a' ? { ...i } : i) },
    { ...root, fits: undefined },
    { ...root, instances: root.instances!.map(i => i.id === 'housing' ? { ...i, hidden: true } : i) },
  ];
  for (const doc of changed) assert.equal(bearingEditCurrent(session, doc, ['bearing-a'], address), false);
  // An occurrence replaced or deleted in place, under the same root object, is refused too.
  const original = root.instances!;
  root.instances = original.map(i => i.id === 'bearing-a' ? { ...i } : i);
  assert.equal(bearingEditCurrent(session, root, ['bearing-a'], address), false); assert.throws(() => prepareBearingEdit(session, session.view.nodes), /replaced/);
  root.instances = original.filter(i => i.id !== 'bearing-a'); assert.equal(bearingEditCurrent(session, root, ['bearing-a'], address), false);
  root.instances = [...original, original[0]]; assert.equal(bearingEditCurrent(session, root, ['bearing-a'], address), false);
  root.instances = original; assert.equal(bearingEditCurrent(session, root, ['bearing-a'], address), true);
});

test('mate-face inputs bind the current explicit occurrence and base targets before faceKey reads them', () => {
  const root = fixture(), child = root.instances![0].doc;
  assert.throws(() => faceKey(child), /current assembly and owner occurrence/, 'the bare-child read that blanked the screen is refused');
  const view = bearingFaceInput(root, 'bearing-a', child);
  assert.equal(bearingContextOf(view)!.owner, 'bearing-a'); assert.doesNotThrow(() => faceKey(view));
  const key = faceKey(view), moved = { ...root, instances: root.instances!.map(i => i.id === 'housing' ? { ...i, position: [1, 0, 0] as [number, number, number] } : i) };
  assert.notEqual(faceKey(bearingFaceInput(moved, 'bearing-a', child)), key, 'current target placement enters face identity');
  const base = bearingFaceInput(moved, 'base', { ...root, instances: [] });
  assert.deepEqual(bearingContextOf(base)!.targets.find(t => t.part === 'housing')!.pose.t, [1, 0, 0]);
  assert.throws(() => bearingFaceInput(root, 'missing', child), /BEARING_EDIT_SCOPE/);
  assert.throws(() => bearingFaceInput(root, 'bearing-a', { ...child }), /not the current authored occurrence/);
  const hidden = { ...root, instances: root.instances!.map(i => i.id === 'housing' ? { ...i, hidden: true } : i) };
  assert.throws(() => faceKey(bearingFaceInput(hidden, 'bearing-a', child)), /is hidden/);
});
