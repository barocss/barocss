import test from 'node:test';
import assert from 'node:assert/strict';
import { cylinderPart, emptyDoc, rectanglePart, type StudioDoc } from '@barocss/cad-model/engine/doc';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { flattenAssembly } from '@barocss/cad-model/engine/flatten';
import { addPart } from '@barocss/cad-model/assembly/edit';
import { hasNestedParts, hostsOf, isNestedId, nestedCard, nestedInstance, nestedRows, renderKeysOf, singleNested, singleTop, topLevelIds, viewportInstanceSelection } from '../src/assembly/nestedSelection';
import { instanceBodyLit, instanceLit, parseInstanceSelection } from '../src/viewport/instanceSelection';

// Roadmap 10 ②c: select a part inside a sub-assembly and see its path. The pure rules behind the outliner tree, the
// selection's host mapping, the viewport's per-body highlight and the read-only card.
const slab = () => rectanglePart(20, 20, 10);
const pair = (): StudioDoc => addPart(addPart(emptyDoc(), { name: 'Block A', doc: slab() }).doc, { name: 'Block B', doc: slab(), position: [0, 0, 10] }).doc;
/** Base, the sub-assembly Sub (p1: Block A, a deeper Inner p2 of two slabs) and a loose slab (p2). */
function plant(): StudioDoc {
  const inner = addPart(addPart(emptyDoc(), { name: 'Block A', doc: slab() }).doc, { name: 'Inner', doc: pair(), position: [0, 0, 10] }).doc;
  return addPart(addPart(rectanglePart(100, 100, 10), { name: 'Sub', doc: inner, position: [200, 0, 0] }).doc, { name: 'Loose', doc: slab(), position: [0, 300, 0] }).doc;
}
const faceNames = (sub: StudioDoc) => { const r = evaluateDoc(flattenAssembly(sub), 1); if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.bodies; };

test('selection helpers: a nested path counts as its host, placement actions see only plain ids', () => {
  const sel = ['p1', 'p1/p2', 'p1/p2/p2', 'p2'];
  assert.deepEqual(hostsOf(sel), ['p1', 'p2']);
  assert.deepEqual(topLevelIds(sel), ['p1', 'p2']);
  assert.ok(isNestedId('p1/p2') && !isNestedId('p1'));
  assert.equal(singleTop(['p1']), 'p1'); assert.equal(singleTop(['p1/p2']), undefined); assert.equal(singleTop(['p1', 'p2']), undefined); assert.equal(singleTop([]), undefined);
  assert.equal(singleNested(['p1/p2']), 'p1/p2'); assert.equal(singleNested(['p1']), undefined); assert.equal(singleNested(['p1/p2', 'p2']), undefined);
});

test('outliner rows: closed shows nothing, open shows the shown parts depth first, each with its path and label', () => {
  const doc = plant(), sub = doc.instances!.find(i => i.id === 'p1')!, loose = doc.instances!.find(i => i.id === 'p2')!;
  assert.ok(hasNestedParts(sub) && !hasNestedParts(loose));
  assert.deepEqual(nestedRows(sub, new Set()).map(r => r.path), ['p1/p1', 'p1/p2'], 'the first level of an open host (the caller lists none for a closed one)');
  const one = nestedRows(sub, new Set(['p1']));
  assert.deepEqual(one.map(r => [r.path, r.name, r.depth, r.expandable, r.open]), [['p1/p1', 'Block A', 1, false, false], ['p1/p2', 'Inner', 1, true, false]]);
  assert.equal(one[0].label, 'Block A in Sub');
  const two = nestedRows(sub, new Set(['p1', 'p1/p2']));
  assert.deepEqual(two.map(r => [r.path, r.depth]), [['p1/p1', 1], ['p1/p2', 1], ['p1/p2/p1', 2], ['p1/p2/p2', 2]]);
  assert.equal(two[3].label, 'Block B in Sub › Inner');
  assert.equal(two[1].open, true);
  // A hidden part is not listed (and not its parts).
  const hidden: typeof sub = { ...sub, doc: { ...sub.doc, instances: sub.doc.instances!.map(i => i.id === 'p2' ? { ...i, hidden: true } : i) } };
  assert.deepEqual(nestedRows(hidden, new Set(['p1', 'p1/p2'])).map(r => r.path), ['p1/p1']);
});

test('nested instance and card: names down the path, its own placement in the sub-assembly directly above, bodies and volume', () => {
  const doc = plant();
  assert.equal(nestedInstance(doc, 'p1/p2/p2')!.inst.name, 'Block B');
  assert.deepEqual(nestedInstance(doc, 'p1/p2/p2')!.names, ['Sub', 'Inner', 'Block B']);
  for (const bad of ['p1', 'p1/p9', 'p9/p1', 'p2/p1']) assert.equal(nestedInstance(doc, bad), null, bad);
  const bodies = faceNames(doc.instances![0].doc), entry = { inst: doc.instances![0], bodies };
  const card = nestedCard(doc, 'p1/p2/p2', entry)!;
  assert.deepEqual([card.title, card.path, card.bodies, card.placement.in, card.host], ['Sub › Inner › Block B', 'p1/p2/p2', 1, 'Inner', { id: 'p1', name: 'Sub' }]);
  assert.deepEqual(card.placement.position, [0, 0, 10]);
  assert.ok(Math.abs(card.volume! - 20 * 20 * 10) < 1e-6, 'the part\'s own volume');
  const inner = nestedCard(doc, 'p1/p2', entry)!;
  assert.equal(inner.bodies, 2, 'a nested sub-assembly: every body within it');
  assert.ok(Math.abs(inner.volume! - 2 * 20 * 20 * 10) < 1e-6);
  assert.deepEqual([nestedCard(doc, 'p1/p2/p2', undefined)!.pending, nestedCard(doc, 'p1/p9', entry)], [true, null]);
  // A body still being worked out: no partial sum.
  assert.equal(nestedCard(doc, 'p1/p2/p2', { ...entry, bodies: bodies.map(b => ({ ...b, massRef: 1 })) })!.volume, null);
});

test('viewport selection: a top-level id lights the part, a nested path only its host\'s bodies from that part', () => {
  const doc = plant(), bodies = faceNames(doc.instances![0].doc);
  assert.equal(bodies.length, 3);
  const of = (host: string) => host === 'p1' ? { inst: doc.instances![0], bodies } : undefined;
  assert.deepEqual(viewportInstanceSelection(['p1'], of), ['p1']);
  assert.deepEqual(viewportInstanceSelection(['p1/p2/p2'], of), ['p1#2']);
  assert.deepEqual(viewportInstanceSelection(['p1/p2'], of), ['p1#1', 'p1#2']);
  assert.deepEqual(viewportInstanceSelection(['p1/p1', 'p2'], of), ['p1#0', 'p2']);
  assert.deepEqual(viewportInstanceSelection(['p1/p2'], () => undefined), [], 'bodies not placed yet: nothing to light');
});

test('viewport selection keeps the input array when nothing is nested (no re-set of the viewport)', () => {
  const none: string[] = [], tops = ['p1', 'p2'];
  assert.equal(viewportInstanceSelection(none, () => undefined), none);
  assert.equal(viewportInstanceSelection(tops, () => undefined), tops);
  assert.notEqual(viewportInstanceSelection(['p1/p1'], () => undefined), tops);
});

test('render keys: a nested entry has no appearance key and is flagged for the hint', () => {
  assert.deepEqual(renderKeysOf(['p1', 'p2']), { keys: ['inst:p1', 'inst:p2'], nested: false, mode: 'keys' });
  assert.deepEqual(renderKeysOf(['p1/p2']), { keys: [], nested: true, mode: 'disabled' });
  assert.deepEqual(renderKeysOf(['p3', 'p1/p2']), { keys: ['inst:p3'], nested: true, mode: 'keys' });
  assert.deepEqual(renderKeysOf([]), { keys: [], nested: false, mode: 'default' });
});

test('names are read through the evaluated instance, never a newer document; a refusing fold gives no highlight and an unavailable card', () => {
  const sub = addPart(addPart(emptyDoc(), { name: 'A', doc: slab() }).doc, { name: 'B', doc: cylinderPart(5, 30), position: [0, 0, 10] }).doc;
  const doc = addPart(emptyDoc(), { name: 'Sub', doc: sub }).doc, bodies = faceNames(sub), entry = { inst: doc.instances![0], bodies };
  assert.deepEqual(viewportInstanceSelection(['p1/p2'], () => entry), ['p1#1']);
  // The document moved on (a new first part) while the old bodies are held: the evaluated instance still decides.
  const newer = addPart({ ...sub, instances: [] }, { name: 'Extra', doc: rectanglePart(5, 5, 5) }).doc;
  const ahead = { ...doc, instances: doc.instances!.map(i => ({ ...i, doc: newer })) };
  assert.deepEqual(viewportInstanceSelection(['p1/p2'], () => entry), ['p1#1']);
  assert.equal(nestedCard(doc, 'p1/p2', entry)!.bodies, 1);
  assert.equal(nestedCard(ahead, 'p1/p2', entry), null, 'the path no longer leads to a part of the current document');
  // A document that refuses to flatten: nothing thrown, nothing lit.
  const refusing = { inst: { ...doc.instances![0], doc: { ...sub, routeBundles: [] } as StudioDoc }, bodies };
  assert.deepEqual(viewportInstanceSelection(['p1/p2'], () => refusing), []);
  const card = nestedCard(doc, 'p1/p2', refusing)!;
  assert.deepEqual([card.unavailable, card.volume, card.bodies], [true, null, 0]);
});

test('a part with no attributed bodies shows an unknown volume, not 0', () => {
  const doc = plant();
  const card = nestedCard(doc, 'p1/p2/p2', { inst: doc.instances![0], bodies: [] })!;
  assert.deepEqual([card.bodies, card.volume, card.pending], [0, null, false]);
});

test('renderer selection: whole ids and body entries, a section\'s cut bodies by their source', () => {
  const sel = parseInstanceSelection(['p2', 'p1#2', 'p1#0']);
  assert.ok(instanceLit(sel, 'p2') && instanceLit(sel, 'p1') && !instanceLit(sel, 'p3'));
  assert.ok(instanceBodyLit(sel, 'p2', 5));
  assert.deepEqual([0, 1, 2].map(b => instanceBodyLit(sel, 'p1', b)), [true, false, true]);
  // The cut bodies: [body 1 survives alone as 0, then 2 as 1]: lights what came from 2.
  assert.deepEqual([0, 1].map(b => instanceBodyLit(sel, 'p1', b, [1, 2])), [false, true]);
  assert.ok(!instanceLit(parseInstanceSelection([]), 'p1'));
  // An id that is not a body entry stays whole ('#' without a number).
  assert.ok(parseInstanceSelection(['a#b']).whole.has('a#b'));
});
