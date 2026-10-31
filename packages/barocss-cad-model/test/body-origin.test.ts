import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, rectanglePart, type StudioDoc } from '../src/engine/doc';
import { flattenAssembly } from '../src/engine/flatten';
import { bodiesWithin, bodyOriginOf, pathWithin } from '../src/engine/occurrences';
import { addPart } from '../src/assembly/edit';
import { addInstancePattern } from '../src/assembly/patterns';

// Row 10 ②c: which nested part a body of a folded sub-assembly comes from, by its face names (the viewport lights only those).
const slab = () => rectanglePart(20, 20, 10);
const pair = (): StudioDoc => addPart(addPart(emptyDoc(), { name: 'One', doc: slab() }).doc, { name: 'Two', doc: slab(), position: [0, 0, 10] }).doc;
/** p1 a slab, p2 a sub-assembly of two slabs (q ids p1, p2). */
const deeper = (): StudioDoc => addPart(addPart(emptyDoc(), { name: 'One', doc: slab() }).doc, { name: 'Inner', doc: pair(), position: [0, 0, 10] }).doc;
/** The folded sub-assembly's bodies, each by its mesh face names. */
const faceNamesOf = (doc: StudioDoc): string[][] => { const r = evaluateDoc(flattenAssembly(doc), 1); if (!r.ok) throw new Error(JSON.stringify(r.error)); return r.bodies.map(b => b.mesh.faces.map(f => f.name)); };
const origins = (doc: StudioDoc) => faceNamesOf(doc).map(n => bodyOriginOf(doc, n)?.join('/'));

test('two levels: each body comes from its own part, a deeper one with the whole path', () => {
  const sub = deeper();
  assert.deepEqual(origins(sub), ['p1', 'p2/p1', 'p2/p2']);
  const names = faceNamesOf(sub);
  // Selecting the inner sub-assembly p2 lights both of its slabs, p2/p2 only its second, p1 only the first slab.
  assert.deepEqual(bodiesWithin(sub, names, ['p2']), [1, 2]);
  assert.deepEqual(bodiesWithin(sub, names, ['p2', 'p2']), [2]);
  assert.deepEqual(bodiesWithin(sub, names, ['p1']), [0]);
  assert.deepEqual(bodiesWithin(sub, names, []), [0, 1, 2], 'the sub-assembly itself: every body');
  assert.deepEqual(bodiesWithin(sub, names, ['p9']), []);
});

test('a hidden sibling leaves the later part its own path (the folded serials moved, the path did not)', () => {
  const sub = pair(), hidden = { ...sub, instances: sub.instances!.map(i => i.id === 'p1' ? { ...i, hidden: true } : i) };
  assert.deepEqual(origins(sub), ['p1', 'p2']);
  assert.deepEqual(origins(hidden), ['p2']);
  assert.deepEqual(bodiesWithin(hidden, faceNamesOf(hidden), ['p1']), [], 'hidden: no body');
});

test('a pattern inside a sub-assembly: every occurrence is its own part with its own body', () => {
  const sub = addInstancePattern(addPart(emptyDoc(), { name: 'Pin', doc: slab() }).doc, { seed: 'p1', kind: 'linear', count: 3, dir: [1, 0, 0], spacing: 30 }).doc;
  assert.deepEqual(sub.instances!.map(i => i.id), ['p1', 'pat1-1', 'pat1-2']);
  assert.deepEqual(origins(sub), ['p1', 'pat1-1', 'pat1-2']);
  assert.deepEqual(bodiesWithin(sub, faceNamesOf(sub), ['pat1-2']), [2]);
});

test('names without a feature say nothing; mixed parts share their common path', () => {
  const sub = deeper(), names = faceNamesOf(sub);
  const [a, b] = [bodyOriginOf(sub, names[1]), bodyOriginOf(sub, names[2])];
  assert.deepEqual([a, b], [['p2', 'p1'], ['p2', 'p2']]);
  assert.deepEqual(bodyOriginOf(sub, [...names[1], ...names[2]]), ['p2'], 'faces of two nested parts: their common sub-assembly');
  assert.equal(bodyOriginOf(sub, []), null);
  assert.equal(bodyOriginOf(sub, ['origin:xy']), null);
  assert.ok(pathWithin(['p2', 'p1'], ['p2']) && !pathWithin(['p2'], ['p2', 'p1']) && pathWithin(['p2'], []));
});
