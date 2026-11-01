import test from 'node:test';
import assert from 'node:assert/strict';
import { rectanglePart, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { lookKeysOf } from '../src/assembly/looks';
import { addInstancePattern } from '../src/assembly/patterns';
import { acceptRevision, dismissRevision, editDefinition, freshPartId, makeIndependent, offerRevision, revisionOf, sharing } from '../src/assembly/definitions';

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

test('roadmap 10 ⑧: a part edited in place is one commit: every sharer takes it at the next revision, keeping place, joints and looks; held looks are reported', () => {
  const withLooks: StudioDoc = { ...asm, instances: asm.instances!.map(i => i.id === 'inst2' ? { ...i, joints: { 'a~b': 0.5 }, looks: { [[...lookKeysOf(taller)][0]]: { color: '#ff0000' }, b9: { color: '#00ff00' } } } : i) };
  const done = editDefinition(withLooks, 'inst1', taller);
  assert.ok('doc' in done && done.changed);
  assert.deepEqual(done.doc.instances!.map(i => [i.id, i.doc === taller, i.part!.rev, i.position[0]]), [['inst1', true, 'B', 0], ['inst2', true, 'B', 20], ['inst3', false, 'A', 40]]);
  const two = done.doc.instances!.find(i => i.id === 'inst2')!;
  assert.deepEqual(two.joints, { 'a~b': 0.5 }); assert.deepEqual(Object.keys(two.looks!), [[...lookKeysOf(taller)][0], 'b9'], 'the occurrence\'s looks are kept');
  assert.deepEqual(done.held.map(h => [h.part, h.body]), [['inst2', 'b9']], 'the look whose body the part has not is held and listed');
  assert.equal(withLooks.instances![0].doc, pin, 'the source assembly is not touched');
  // The next editing round goes on from the new revision.
  const again = editDefinition(done.doc, 'inst2', rectanglePart(10, 10, 40));
  assert.ok('doc' in again && again.doc.instances![0].part!.rev === 'C');
});

test('roadmap 10 ⑧: an unchanged document commits nothing; an unknown part and a part of its own are told apart', () => {
  const same = editDefinition(asm, 'inst1', pin);
  assert.ok('doc' in same && !same.changed && same.doc === asm && same.held.length === 0);
  const equalCopy = editDefinition(asm, 'inst1', JSON.parse(JSON.stringify(pin)) as StudioDoc);
  assert.ok('doc' in equalCopy && !equalCopy.changed, 'equal by value is no change');
  assert.ok('error' in editDefinition(asm, 'nope', taller));
  const own: StudioDoc = { ...asm, instances: [{ id: 'solo', name: 'solo', doc: pin, position: [0, 0, 0], rotation: [0, 0, 0] }, placed('inst2', 'part1', 20)] };
  const done = editDefinition(own, 'solo', taller);
  assert.ok('doc' in done && done.changed);
  assert.deepEqual(done.doc.instances!.map(i => [i.id, i.doc === taller, i.part?.rev]), [['solo', true, undefined], ['inst2', false, 'A']]);
});

test('roadmap 10 ⑧: editing any occurrence of a pattern edits the seed\'s shared definition: every copy updates', () => {
  const base: StudioDoc = { ...rectanglePart(80, 20, 5), instances: [placed('inst1', 'part1', 0)] };
  const patterned = addInstancePattern(base, { kind: 'linear', seed: 'inst1', count: 3, spacing: 20, dir: [1, 0, 0] } as never).doc;
  const occurrence = patterned.instances!.find(i => i.pattern)!;
  const done = editDefinition(patterned, occurrence.id, taller);
  assert.ok('doc' in done && done.changed);
  assert.ok(done.doc.instances!.length === 3 && done.doc.instances!.every(i => i.doc === taller && i.part!.rev === 'B'));
  assert.deepEqual(done.doc.instances!.map(i => i.position[0]), [0, 20, 40], 'each stays where the pattern puts it');
});

test('roadmap 10 ⑧ audit: revisions never go backwards, a waiting revision is superseded, a project link is dropped, a self-containing part is refused', () => {
  // P2: a part whose document names Rev C: C → D → E.
  const named = { ...pin, drawing: { revision: 'C' } } as unknown as StudioDoc;
  const at = (rev: string): StudioDoc => ({ ...asm, instances: [{ ...placed('inst1', 'part1', 0), doc: named, part: { id: 'part1', rev, source: 'pin.bcad' } }] });
  const e1 = editDefinition(at('C'), 'inst1', { ...named, nodes: taller.nodes }); assert.ok('doc' in e1);
  assert.equal(e1.doc.instances![0].part!.rev, 'D');
  const e2 = editDefinition(e1.doc, 'inst1', { ...named, nodes: rectanglePart(10, 10, 40).nodes }); assert.ok('doc' in e2);
  assert.equal(e2.doc.instances![0].part!.rev, 'E', 'D then E, not back to C');
  // P3: a revision waiting for the definition does not survive an edit of it (Accept could only undo the edit).
  const offered = offerRevision(asm, 'part1', rectanglePart(10, 10, 25), 'pin-v2.bcad'); assert.ok('doc' in offered);
  const edited = editDefinition(offered.doc, 'inst1', rectanglePart(10, 10, 40)); assert.ok('doc' in edited);
  assert.equal(edited.doc.pendingParts, undefined);
  // A project-linked part is no longer linked afterwards (its file would be offered as a newer revision): the name stays, marked.
  const linked: StudioDoc = { ...asm, instances: asm.instances!.map(i => i.id === 'inst1' ? { ...i, part: { ...i.part!, source: './parts/pin.bcad' } } : i) };
  const unlinked = editDefinition(linked, 'inst1', taller); assert.ok('doc' in unlinked);
  assert.equal(unlinked.doc.instances![0].part!.source, 'parts/pin.bcad (edited)'); assert.equal(unlinked.doc.instances![1].part!.source, 'parts/pin.bcad (edited)', 'every sharer'); assert.equal(unlinked.doc.instances![2].part!.source, 'pin.bcad', 'another definition is untouched');
  // P4: the assembly itself, or a document placing this very part, is refused.
  assert.ok('error' in editDefinition(asm, 'inst1', asm));
  const inner: StudioDoc = { ...taller, instances: [{ ...placed('x', 'part9', 0), doc: asm.instances![0].doc }] };
  assert.ok('error' in editDefinition(asm, 'inst1', inner));
});
