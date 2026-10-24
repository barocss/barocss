// PG-6: a running fit swept — the display mesh's chords lie inside the true circle (0.135 mm at r 28, 8 segments a
// quarter turn), so a piston 0.05 mm inside its bore, its facets turned half a segment from the bore's, reads as
// contact on the meshes. The concentric mate's two round faces are the fit's to hold: the stroke sweeps clear; a boss
// past the bore's radius is still contact; without the fit's seat the meshes touch (the gap as P1 met it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyDoc, type ModelNode, type StudioDoc } from '../src/engine/doc';
import type { Mate } from '../src/assembly/mates';
import { evaluatePart } from '../src/engine/evaluate';
import { lockPart } from '../src/assembly/edit';
import { robotViewOf, sweepLinksOf, treeOf } from '../src/robot/verbs';
import { sweepPath } from '../src/robot/sweep';
import { faceTableOf } from '../src/assembly/faces';

const evaluate = async (doc: StudioDoc) => evaluatePart(doc, 1);
const box = (w: number, d: number, h: number, extra: ModelNode[] = []): StudioDoc => ({ ...emptyDoc(), nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [w, d] } as ModelNode, { kind: 'extrude', sketch: 0, height: h } as ModelNode, ...extra] });
const facing = (doc: StudioDoc, n: [number, number, number]) => Object.entries(faceTableOf(doc)).find(([k, f]) => !k.startsWith('origin:') && f.kind === 'plane' && Math.hypot(f.normal[0] - n[0], f.normal[1] - n[1], f.normal[2] - n[2]) < 1e-9)![0];
function engineLike(boss: boolean): StudioDoc {
  const cyl = box(80, 80, 60, [{ kind: 'hole', parent: { node: 1, side: 'solid' }, center: [40, 40], radius: 28 } as ModelNode]), carriage = box(10, 10, 10);
  const piston: StudioDoc = { ...emptyDoc(), nodes: [{ kind: 'sketch', profile: 'circle', center: [0, 0], radius: 27.95 } as ModelNode, { kind: 'extrude', sketch: 0, height: 30 } as ModelNode,
    ...(boss ? [{ kind: 'sketch', profile: 'rectangle', min: [20, -2], max: [31, 2] } as ModelNode, { kind: 'extrude', sketch: 2, height: 10 } as ModelNode] : [])] };
  const mates: Mate[] = [
    { id: 'gx', kind: 'coincident', a: { part: 'cyl', face: facing(cyl, [1, 0, 0]) }, b: { part: 'carriage', face: facing(carriage, [-1, 0, 0]) } },
    { id: 'gy', kind: 'coincident', a: { part: 'cyl', face: facing(cyl, [0, 1, 0]) }, b: { part: 'carriage', face: facing(carriage, [0, -1, 0]) } },
  ];
  const doc: StudioDoc = { ...box(100, 100, 10),
    instances: [
      { id: 'cyl', name: 'cylinder block', doc: cyl, position: [10, 10, 10], rotation: [0, 0, 0], grounded: true },
      { id: 'carriage', name: 'carriage', doc: carriage, position: [90, 90, 20], rotation: [0, 0, 0] },
      { id: 'piston', name: 'piston', doc: piston, position: [50, 50, 20], rotation: [0, 0, 360 / 64] },
    ], mates };
  const locked = lockPart(doc, { part: 'piston', to: 'carriage' }).doc;
  return { ...locked, mates: [...locked.mates!, { id: 'bore', kind: 'concentric', a: { part: 'cyl', face: 'n2.side0' }, b: { part: 'piston', face: 'n1.side0' } }] };
}
async function swept(boss: boolean, withFits = true) {
  const doc = engineLike(boss), r = await evaluate(doc); assert.ok(r.ok);
  const view = await robotViewOf(doc, r.bodies, evaluate), tree = treeOf(view), slide = tree.joints.find(j => j.child === 'carriage')!;
  assert.equal(slide.type, 'prismatic'); assert.deepEqual(tree.loops.map(l => l.mates), [['bore']]);
  const t = withFits ? tree : { ...tree, fits: undefined };
  return sweepPath(t, sweepLinksOf(view, t), {}, { [slide.key]: 20 * Math.sign(slide.axis[2]) });
}

test('PG-6: a piston 0.05 mm inside its bore, facets out of phase, strokes 20 mm clear — the fit\'s round faces its own', async () => {
  const r = await swept(false);
  assert.equal(r.clear, true, JSON.stringify(r).slice(0, 300));
  assert.match(r.designed.find(d => d.links.includes('piston') && d.links.includes('cyl'))!.why, /^a running fit \(bore\)/);
});
test('PG-6: without the fit\'s seat the meshes touch at once (the gap P1 met); a boss past the bore\'s radius is contact with it', async () => {
  const bare = await swept(false, false);
  assert.equal(bare.clear, false); assert.deepEqual([...bare.contact!.links].sort(), ['cyl', 'piston']); assert.equal(bare.contact!.s, 0);
  const boss = await swept(true);
  assert.equal(boss.clear, false); assert.deepEqual([...boss.contact!.links].sort(), ['cyl', 'piston']);
});
