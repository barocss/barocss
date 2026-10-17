import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emptyDoc, rectanglePart, withNode, type ModelNode, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { evaluateDoc, evaluatePart } from '../src/engine/evaluate';
import { deleteFeature, duplicateBody, moveFeature, replaceRange } from '../src/chat/features';
import { flattenAssembly } from '../src/assembly/flatten';
import { featureIdsOf, nextSerial, nodeIndexOf, renameFeatureIds, withIds } from '../src/engine/ids';
import { toPartDocument } from '../src/engine/part';
import { readStudioDoc } from '../src/engine/migrate';
import { defaultRender } from '../src/engine/render';
import { lookOf, withLook } from '../src/app/bodies';

// Stable feature ids (A1): a face's name keeps its feature's id however the history around it changes.
const volumes = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies.map(b => Math.round(b.volumeMM3! * 1000) / 1000); };
const box = (doc: StudioDoc, x: number, w: number, h: number) => withNode(withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [x, 0], max: [x + w, w] }), { kind: 'extrude', sketch: doc.nodes.length, height: h });

test('ids: appended features are n0, n1, …; a deleted id is never handed out again', () => {
  let doc = box(box(emptyDoc(), 0, 10, 5), 20, 16, 16);
  assert.deepEqual(doc.nodes.map(n => n.id), ['n0', 'n1', 'n2', 'n3']); assert.equal(doc.nextId, 4);
  const del = deleteFeature(doc, 1); assert.ok('doc' in del);
  doc = withNode(del.doc, { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n3.side0|n3.side1'], radius: 2 });
  assert.deepEqual(doc.nodes.map(n => n.id), ['n2', 'n3', 'n4'], 'the new fillet takes n4, not a freed n0 or n1');
  // The fillet names its edge by the box's id: it still resolves, and the kernel sees the same names.
  assert.deepEqual(volumes(doc), [Math.round((16 * 16 * 16 - (4 - Math.PI) * 16) * 1000) / 1000]);
  assert.deepEqual(toPartDocument(doc).features.map(f => f.id), ['n2', 'n3', 'n4']);
});

test('ids: a fillet before which a feature is inserted, deleted or moved keeps its edges', () => {
  // A box filleted by name, then a separate block added and moved before it, then deleted.
  let doc = box(emptyDoc(), 0, 20, 10);
  doc = withNode(doc, { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], radius: 2 });
  const base = volumes(doc)[0];
  doc = box(doc, 40, 5, 5);
  const moved = moveFeature(doc, 4, -1); assert.ok('doc' in moved, JSON.stringify(moved));
  const fillet = moved.doc.nodes.find(n => n.kind === 'fillet') as Extract<ModelNode, { kind: 'fillet' }>;
  assert.deepEqual(fillet.edges, ['n1.side0|n1.top']);
  assert.ok(volumes(moved.doc).includes(base));
  const k = moved.doc.nodes.findIndex(n => n.id === 'n4'), del = deleteFeature(moved.doc, k); assert.ok('doc' in del, JSON.stringify(del));
  assert.deepEqual(volumes(del.doc), [base]);
});

test('ids: a duplicate is new features (fresh ids, its own names); a rebuilt range keeps its ids', () => {
  let doc = box(emptyDoc(), 0, 10, 4);
  doc = withNode(doc, { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], radius: 1 });
  const { doc: two } = duplicateBody(doc, { node: 2, side: 'solid' }, [30, 0, 0]);
  const ids = two.nodes.map(n => n.id);
  assert.equal(new Set(ids).size, ids.length, `unique: ${ids}`);
  const copy = two.nodes[5] as Extract<ModelNode, { kind: 'fillet' }>;
  assert.deepEqual([copy.id, copy.edges], ['n5', ['n4.side0|n4.top']], 'the copy fillets the copied box');
  const [v1, v2] = volumes(two); assert.equal(v1, v2);
  const rebuilt = replaceRange(doc, 0, 2, [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [12, 10] }, { kind: 'extrude', sketch: 0, height: 4 }]);
  assert.deepEqual(rebuilt.nodes.map(n => n.id), ['n0', 'n1', 'n2']);
});

test('ids: parts folded into an assembly get ids past the assembly’s own; a hand-built document gets n<i>', () => {
  const part = withNode(box(emptyDoc(), 0, 10, 4), { kind: 'fillet', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], radius: 1 });
  const inst = (id: string, x: number): PartInstance => ({ id, name: id, doc: part, position: [x, 0, 0], rotation: [0, 0, 0] });
  const asm: StudioDoc = { ...box(emptyDoc(), 0, 50, 2), instances: [inst('a', 0), inst('b', 20)] };
  const flat = flattenAssembly(asm), ids = flat.nodes.map(n => n.id);
  assert.equal(new Set(ids).size, ids.length, `unique: ${ids}`);
  assert.deepEqual((flat.nodes[7] as Extract<ModelNode, { kind: 'fillet' }>).edges, ['n6.side0|n6.top'], 'the second copy fillets its own box');
  const r = evaluatePart(flat, 1); assert.ok(r.ok); assert.equal(r.bodies.length, 3);
  // Hand-built (no ids, no nextId): positions.
  const hand = withIds({ ...emptyDoc(), nextId: undefined, nodes: part.nodes.map(({ id: _, ...n }) => n as ModelNode) });
  assert.deepEqual(hand.nodes.map(n => n.id), ['n0', 'n1', 'n2']); assert.equal(nextSerial(hand), 3);
});

test('body keys (A1.1b): a coloured, materialised, animated body keeps its look, appearance and track as a feature above it is moved and deleted', () => {
  let doc = box(box(emptyDoc(), 0, 10, 5), 20, 16, 16);
  doc = withNode(doc, { kind: 'hole', parent: { node: 3, side: 'solid' }, center: [28, 8], radius: 2 });
  const body = () => { const r = evaluateDoc(doc, 1); assert.ok(r.ok); return r.bodies.find(b => b.key === 'b4')!; };
  doc = withLook(doc, body(), { color: '#00aa00', material: 'brass', name: 'Bushing' });
  const look = { color: '#00aa00', material: 'brass', name: 'Bushing' };
  doc = { ...doc, render: { ...defaultRender(), appearances: { b4: { ...defaultRender().defaultAppearance, roughness: 0.2 } }, animation: { ...defaultRender().animation, tracks: { b4: [{ t: 0, offset: [0, 0, 0] }, { t: 1, offset: [0, 0, 10] }] } } } };
  const check = (what: string) => {
    const b = body(); assert.ok(b, `${what}: the body is b4`);
    assert.deepEqual(lookOf(doc, b), look, `${what}: its look`);
    assert.equal(doc.render!.appearances[b.key]?.roughness, 0.2, `${what}: its appearance`);
    assert.equal(doc.render!.animation.tracks[b.key]?.length, 2, `${what}: its track`);
  };
  check('before');
  const moved = moveFeature(doc, 1, 1); assert.ok('doc' in moved, JSON.stringify(moved)); doc = moved.doc;
  assert.deepEqual(doc.nodes.map(n => n.id), ['n2', 'n3', 'n0', 'n1', 'n4']); check('moved');
  const del = deleteFeature(doc, 3); assert.ok('doc' in del, JSON.stringify(del)); doc = del.doc;
  assert.deepEqual(doc.nodes.map(n => n.id), ['n2', 'n3', 'n4']); check('deleted');
});

test('ids: names parse into feature ids, rename by id, and find their nodes (a pattern copy is its node’s)', () => {
  assert.deepEqual(featureIdsOf('n2.side0|n1.top#2'), ['n2', 'n1']);
  assert.deepEqual(featureIdsOf('n1.top+n3.cap'), ['n1', 'n3']);
  assert.deepEqual(featureIdsOf('origin:xy'), []);
  assert.equal(renameFeatureIds('n2.side0|n1.top', id => id === 'n1' ? 'n9' : id), 'n2.side0|n9.top');
  const nodes = [{ kind: 'sketch', id: 'n7' }, { kind: 'hole', id: 'n3' }] as unknown as ModelNode[];
  assert.equal(nodeIndexOf(nodes, 'n3'), 1); assert.equal(nodeIndexOf(nodes, 'n3_p2'), 1); assert.equal(nodeIndexOf(nodes, 'n0'), -1);
});

// The A1 conformance cases (conformance/a1): a studio document, operations on its history, and the ids, names
// and volumes that must come out.

const a1 = join(process.cwd(), 'conformance', 'a1');
for (const file of readdirSync(a1).filter(f => f.endsWith('.json'))) {
  const c = JSON.parse(readFileSync(join(a1, file), 'utf8'));
  if (c.input.selectors || c.input.edit || c.input.verify) continue; // (selectors, rematch, references tests)
  test(`conformance ${c.id}: ${c.about}`, () => {
    const read = readStudioDoc(JSON.stringify(c.input.file)); assert.ok('doc' in read, JSON.stringify(read));
    let doc = read.doc;
    for (const op of c.input.operations) {
      if (op.op === 'add') doc = withNode(doc, op.node);
      else { const r = op.op === 'delete' ? deleteFeature(doc, op.index) : moveFeature(doc, op.index, op.dir); assert.ok('doc' in r, JSON.stringify(r)); doc = r.doc; }
    }
    assert.deepEqual(doc.nodes.map(n => n.id), c.expect.ids);
    assert.equal(nextSerial(doc), c.expect.nextId);
    for (const [i, names] of Object.entries(c.expect.names)) { const n = doc.nodes[Number(i)] as { edges?: string[] }; assert.deepEqual(n.edges, names); }
    if (c.expect.bodyKeys) { const r = evaluateDoc(doc, 1); assert.ok(r.ok); assert.deepEqual(r.bodies.map(b => b.key).sort(), c.expect.bodyKeys); }
    if (c.expect.looks) assert.deepEqual(doc.bodies, c.expect.looks);
    if (c.expect.appearanceKeys) assert.deepEqual(Object.keys(doc.render!.appearances).sort(), c.expect.appearanceKeys);
    if (c.expect.trackKeys) assert.deepEqual(Object.keys(doc.render!.animation.tracks).sort(), c.expect.trackKeys);
    const got = volumes(doc).sort((a, b) => a - b), want = [...c.expect.volumesMM3].sort((a: number, b: number) => a - b);
    assert.equal(got.length, want.length); got.forEach((v, k) => assert.ok(Math.abs(v - want[k]) <= 1e-6 * want[k] + 1e-3, `${v} vs ${want[k]}`));
  });
}
