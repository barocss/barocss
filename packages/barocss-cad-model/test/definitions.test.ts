import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { acceptRevision, dismissRevision, freshPartId, makeIndependent, offerRevision, revisionOf, sharing } from '../src/assembly/definitions';

const pin = rectanglePart(10, 10, 20), taller = rectanglePart(10, 10, 30);
const placed = (id: string, part: string, x: number): PartInstance => ({ id, name: 'pin', doc: pin, position: [x, 0, 0], rotation: [0, 0, 0], part: { id: part, rev: 'A', source: 'pin.bcad' } });
const asm: StudioDoc = { ...rectanglePart(60, 20, 5), instances: [placed('inst1', 'part1', 0), placed('inst2', 'part1', 20), placed('inst3', 'part2', 40)] };

test('shared definitions: a waiting revision changes nothing until it is accepted, then every sharer takes it where it is', () => {
  assert.equal(freshPartId(asm), 'part3');
  assert.deepEqual(sharing(asm, 'part1').map(i => i.id), ['inst1', 'inst2']);
  const offered = offerRevision(asm, 'part1', taller, 'pin-b.bcad');
  assert.ok('doc' in offered);
  const waiting = offered.doc;
  assert.equal(waiting.pendingParts!.part1.rev, 'B', 'the next after A');
  assert.ok(waiting.instances!.every(i => i.doc === pin), 'nothing placed changed yet');
  const done = acceptRevision(waiting, 'part1');
  assert.deepEqual(done.instances!.map(i => [i.id, i.doc.nodes === taller.nodes ? 'B-doc' : 'A-doc', i.part!.rev, i.position[0]]), [['inst1', 'B-doc', 'B', 0], ['inst2', 'B-doc', 'B', 20], ['inst3', 'A-doc', 'A', 40]]);
  assert.equal(done.pendingParts, undefined);
  assert.deepEqual(dismissRevision(waiting, 'part1').instances, asm.instances);
});

test('a copy made independent keeps its revision but no longer follows the shared one; the same file is no update', () => {
  const own = makeIndependent(asm, 'inst2');
  assert.deepEqual(own.instances!.map(i => i.part!.id), ['part1', 'part3', 'part2']);
  const offered = offerRevision(own, 'part1', taller, 'pin-b.bcad');
  assert.ok('doc' in offered);
  assert.deepEqual(acceptRevision(offered.doc, 'part1').instances!.map(i => i.part!.rev), ['B', 'A', 'A']);
  const same = offerRevision(asm, 'part1', pin, 'pin.bcad');
  assert.ok('error' in same && /nothing to update/.test(same.error));
  // A file that names its own newer revision keeps it.
  const revC = { ...taller, drawing: { revision: 'C' } } as unknown as StudioDoc;
  assert.equal(revisionOf(revC), 'C');
  const c = offerRevision(asm, 'part1', revC, 'pin-c.bcad'); assert.ok('doc' in c && c.doc.pendingParts!.part1.rev === 'C');
});
