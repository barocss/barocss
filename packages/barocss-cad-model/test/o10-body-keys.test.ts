import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, evaluatePlaced, type BodyResult } from '../src/engine/evaluate';
import { emptyDoc, placedBase, placedDoc, rectanglePart, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { placementOf } from '../src/engine/placement';
import { assemblyPlacedBodies } from '../src/team/clearanceMap';
import { placedBodies } from '../src/team/parts';
import { withLook, lookOf } from '../src/app/bodies';

// O10 step A: a placed copy's body has one key whatever produces it — the studio's placed evaluation, the clearance map
// (worker and chat), interference — and whatever its placement: `<instance>/<the key in its own document, unplaced>`
// (placedBase). Before, the studio keyed it by the transform nodes placedDoc appends (i1/b2 where the others said
// i1/b1), so a move renamed it and a copy's colour and material were looked up at the wrong node.

const evaluate = async (doc: StudioDoc) => evaluateDoc(doc, 1);
const bodiesOf = (doc: StudioDoc): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok); return r.bodies; };
const plate = rectanglePart(20, 10, 4), steel = withLook(plate, bodiesOf(plate)[0], { material: 'steel' });
const inst = (id: string, doc: StudioDoc, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]): PartInstance => ({ id, name: id, doc, position, rotation });
const studioKeys = (i: PartInstance, root: StudioDoc) => {
  const r = evaluatePlaced(placedDoc(i, root), placedBase(i, root), placementOf(i), 1); assert.ok(r.ok);
  return r.bodies.map(b => ({ key: `${i.id}/${b.key}`, body: b }));
};

test('O10: the same copy at the origin, moved, and moved and turned — one key, the same from the studio, the clearance map and interference', async () => {
  const root: StudioDoc = { ...emptyDoc(), instances: [inst('i1', steel, [0, 0, 0]), inst('i2', steel, [50, 0, 0]), inst('i3', steel, [0, 40, 0], [0, 0, 90])] };
  const clearance = new Set((await assemblyPlacedBodies(root, evaluate)).map(b => b.key));
  for (const i of root.instances!) {
    const studio = studioKeys(i, root).map(x => x.key), inter = (await placedBodies(i, evaluate, root)).map(b => `${i.id}/${b.key}`);
    assert.deepEqual(studio, [`${i.id}/b1`], `${i.id}: the studio's key is the part's own, not a transform's`);
    assert.deepEqual(inter, studio, `${i.id}: interference`);
    assert.ok(studio.every(k => clearance.has(k)), `${i.id}: the clearance map has ${studio.join(', ')}`);
  }
});

test('O10: a copy\'s colour and material are its own document\'s, read at its own node (3MF, the robot\'s inertia)', () => {
  const root: StudioDoc = { ...emptyDoc(), instances: [inst('i1', steel, [30, 0, 0], [0, 90, 0])] };
  const [{ body }] = studioKeys(root.instances![0], root);
  assert.equal(lookOf(steel, body).material, 'steel');
});

test('O10: a sub-assembly placed as a part, moved and turned — its nested part\'s body keyed the same by the studio, the clearance map and interference', async () => {
  const sub: StudioDoc = { ...plate, instances: [inst('n1', plate, [0, 0, 10])] };
  const root: StudioDoc = { ...emptyDoc(), instances: [inst('s1', sub, [5, 7, 0], [0, 0, 90])] };
  const s1 = root.instances![0], studio = studioKeys(s1, root).map(x => x.key).sort();
  const clearance = (await assemblyPlacedBodies(root, evaluate)).map(b => b.key).filter(k => k.startsWith('s1/')).sort();
  const inter = (await placedBodies(s1, evaluate, root)).map(b => `s1/${b.key}`).sort();
  assert.equal(studio.length, 2, `the sub-assembly's own body and its nested part's: ${studio.join(', ')}`);
  assert.deepEqual(clearance, studio); assert.deepEqual(inter, studio);
});
