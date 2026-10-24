import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, withNode, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { applyFill, assemblyPlacedBodies, bandFor, bandPending, clearanceMap, fillOverlap, pendingPairs, poseOf, type ClearancePair, type PlacedBody } from '../src/team/clearanceMap';

// G22's data side: the assembly's interference and clearance map. Two 20 × 20 × 10 boxes overlapping by a 5 × 20 × 10
// block: pending at once, then filled — 1000 mm³, its mesh's volume the same, in body a's frame. 1 mm apart: near, the
// least gap 1 between the facing faces by name, the closest points in each body's frame. A 2 mm cube 0.8 above the middle
// of the box's top face (two big triangles): the band refines there, its least field the gap within the subdivision's
// bound (near/3). Turned 90°: the fill in a's frame, the closest points mapped back onto their worlds. A fill for a pose
// no longer shown is dropped. Pruning: far apart, no pair.
const box = (x: number, y: number, z: number): StudioDoc => withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [x, y] } as never), { kind: 'extrude', sketch: 0, height: z } as never);
const inst = (id: string, doc: StudioDoc, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]): PartInstance => ({ id, name: id, doc, position, rotation });
const asm = (base: StudioDoc, ...instances: PartInstance[]): StudioDoc => ({ ...base, instances });
const evaluate = async (d: StudioDoc) => evaluateDoc(d, 1);
/** A display mesh's enclosed volume (divergence theorem). */
function meshVolume(p: ArrayLike<number>, idx: ArrayLike<number>): number {
  let v = 0;
  for (let t = 0; t < idx.length; t += 3) { const a = 3 * idx[t], b = 3 * idx[t + 1], c = 3 * idx[t + 2]; v += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]); }
  return v / 6;
}
const only = (pairs: readonly ClearancePair[]) => { assert.equal(pairs.length, 1, JSON.stringify(pairs.map(p => [p.a, p.b, p.state]))); return pairs[0]; };

test('G22: an overlap in contact at once, then filled — 5 × 20 × 10 = 1000 mm³, the mesh\'s volume the same, in body a\'s frame; the bands on both sides', async () => {
  const bodies = await assemblyPlacedBodies(asm(box(20, 20, 10), inst('p', box(20, 20, 10), [15, 0, 0])), evaluate);
  assert.deepEqual(bodies.map(b => b.key).sort(), ['b1', 'p/b1']);
  const map = clearanceMap(bodies, { near: 1.5 }), p = only(map.pairs);
  assert.deepEqual([p.state, p.minGapMM, map.pending], ['contact', 0, 1], 'in contact: touching or a clash, the Boolean to say');
  assert.ok(p.overlap && 'pending' in p.overlap);
  const f = fillOverlap(map, bodies, pendingPairs(map)[0]);
  assert.ok('volume' in f.overlap, JSON.stringify(f.overlap));
  assert.ok(Math.abs(f.overlap.volume - 1000) < 1e-9 * 1000, String(f.overlap.volume));
  assert.ok(Math.abs(meshVolume(f.overlap.mesh.positions, f.overlap.mesh.indices) - f.overlap.volume) < 1e-3, 'its mesh encloses its volume');
  // (In a's frame: the block between x 15 and 20 of the base box.)
  const a = p.a === 'b1';
  assert.ok(a, 'the base body is side a');
  assert.ok(Math.abs(f.overlap.mesh.bounds.min[0] - 15) < 1e-5 && Math.abs(f.overlap.mesh.bounds.max[0] - 20) < 1e-5);
  assert.ok(applyFill(map, f) && map.pending === 0 && 'volume' in p.overlap!);
  assert.equal(p.state, 'overlap', '1000 mm³: a clash');
  // (Bands come after the map, on asking: none in it at first.)
  assert.equal(p.band, undefined); assert.deepEqual(bandPending(map), [p]);
  const band = bandFor(map, bodies, p)!;
  assert.ok(band.a.indices.length > 0 && band.b.indices.length > 0, 'bands on both sides'); assert.deepEqual(bandPending(map), []);
});

test('G22: 1 mm apart — near, the least gap 1 between the facing faces by name, closest points in each body\'s frame; far apart, no pair', async () => {
  const bodies = await assemblyPlacedBodies(asm(box(20, 20, 10), inst('p', box(20, 20, 10), [21, 0, 0])), evaluate);
  const map = clearanceMap(bodies, { near: 1.5 }), p = only(map.pairs);
  assert.equal(p.state, 'near'); assert.ok(Math.abs(p.minGapMM - 1) < 1e-6, String(p.minGapMM));
  assert.ok(Math.abs(p.closest.a[0] - 20) < 1e-6 && Math.abs(p.closest.b[0]) < 1e-6, JSON.stringify(p.closest));
  assert.ok(p.closest.faceA && p.closest.faceB && p.closest.faceA !== '' && p.closest.faceB !== '');
  assert.equal(p.overlap, undefined);
  const facing = Math.min(...bandFor(map, bodies, p)!.a.field);
  assert.ok(Math.abs(facing - 1) < 1e-6, `the facing side's field ${facing}`);
  const far = await assemblyPlacedBodies(asm(box(20, 20, 10), inst('p', box(20, 20, 10), [40, 0, 0])), evaluate);
  assert.deepEqual(clearanceMap(far, { near: 1.5 }).pairs, []);
});

test('G22 band oracle: a 2 mm cube 0.8 above the middle of a box\'s top face (two big triangles) — the band refines there; its least field equals the gap within the subdivision\'s bound (near/3)', async () => {
  const near = 1.5, bodies = await assemblyPlacedBodies(asm(box(60, 40, 10), inst('c', box(2, 2, 2), [29, 19, 10.8])), evaluate);
  const top = bodies.find(b => b.key === 'b1')!;
  const map = clearanceMap(bodies, { near: near }), p = only(map.pairs), both = bandFor(map, bodies, p)!, band = p.a === 'b1' ? both.a : both.b;
  assert.ok(Math.abs(p.minGapMM - 0.8) < 1e-6, String(p.minGapMM));
  const least = Math.min(...band.field);
  assert.ok(least >= p.minGapMM - 1e-6 && least - p.minGapMM <= near / 3 + 1e-9, `least ${least}, gap ${p.minGapMM}`);
  // (Refined: the band's triangles are small, around the spot — none is the face's own big triangle.)
  let longest = 0;
  for (let t = 0; t < band.indices.length; t += 3) for (const [u, v] of [[0, 1], [1, 2], [2, 0]]) { const i = 3 * band.indices[t + u], j = 3 * band.indices[t + v]; longest = Math.max(longest, Math.hypot(band.positions[i] - band.positions[j], band.positions[i + 1] - band.positions[j + 1], band.positions[i + 2] - band.positions[j + 2])); }
  // (Split where the field bends, kept whole where it is affine — under the cube's flat bottom: never the face's own big triangles.)
  assert.ok(longest < 2, `longest edge ${longest}`);
  // (Only around the spot: within the cube's footprint grown by the band and the last split's edge.)
  for (let k = 0; k < band.positions.length; k += 3) assert.ok(band.positions[k] >= 29 - near - 2 && band.positions[k] <= 31 + near + 2 && band.positions[k + 1] >= 19 - near - 2 && band.positions[k + 1] <= 21 + near + 2, `band vertex at ${band.positions[k]}, ${band.positions[k + 1]}`);
  assert.ok(band.positions.length > 0 && top.mesh.indices.length / 3 < 20, 'the box\'s faces are few big triangles');
});

test('G22: turned 90° about Z — the fill in a\'s frame (still 1000 mm³), the closest points mapped back onto their worlds; a fill for a pose no longer shown is dropped', async () => {
  const doc = asm(box(20, 20, 10), inst('p', box(20, 20, 10), [20 + 15, 0, 0], [0, 0, 90]));
  const bodies = await assemblyPlacedBodies(doc, evaluate), map = clearanceMap(bodies, { near: 1 }), p = only(map.pairs);
  assert.equal(p.state, 'contact');
  const f = fillOverlap(map, bodies, p);
  assert.ok('volume' in f.overlap && Math.abs(f.overlap.volume - 1000) < 1e-9 * 1000, JSON.stringify('volume' in f.overlap ? f.overlap.volume : f.overlap));
  // (The instance moved: a new map, its pair's pose key changed — the old fill no longer applies.)
  const moved = asm(box(20, 20, 10), inst('p', box(20, 20, 10), [20 + 14, 0, 0], [0, 0, 90]));
  const map2 = clearanceMap(await assemblyPlacedBodies(moved, evaluate), { near: 1 });
  assert.notEqual(only(map2.pairs).pose, p.pose);
  assert.equal(applyFill(map2, f), false);
  assert.equal(map2.pending, 1);
  // (The closest points: B's in its own frame, mapped by its pose, lands where A's does — they touch.)
  const pose = poseOf(doc.instances![0]), b = p.closest.b, w = [pose.m[0] * b[0] + pose.m[1] * b[1] + pose.m[2] * b[2] + pose.t[0], pose.m[3] * b[0] + pose.m[4] * b[1] + pose.m[5] * b[2] + pose.t[1], pose.m[6] * b[0] + pose.m[7] * b[1] + pose.m[8] * b[2] + pose.t[2]];
  assert.ok(Math.hypot(w[0] - p.closest.a[0], w[1] - p.closest.a[1], w[2] - p.closest.a[2]) < 1e-6, JSON.stringify([w, p.closest.a]));
});

test('G22 at scale: 120 boxes, 12 × 10, x-neighbours overlapping 2 mm and y-neighbours 1 mm apart — 110 overlaps pending, the near ones (rows and diagonals), the timing given', async () => {
  const one = await assemblyPlacedBodies(box(30, 20, 8), evaluate), m = one[0].mesh;
  const bodies: PlacedBody[] = Array.from({ length: 120 }, (_, n) => ({ key: `c${n}/b1`, mesh: m, brep: one[0].brep, pose: { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [(n % 12) * 28, Math.floor(n / 12) * 21, 0] } }));
  const map = clearanceMap(bodies, { near: 1.5 });
  const count = (s: string) => map.pairs.filter(p => p.state === s).length;
  assert.deepEqual([count('contact'), map.pending], [110, 110]);
  assert.ok(count('near') > 0 && map.pairs.length < 7140 / 10, `${map.pairs.length} candidate pairs`);
  assert.ok(map.timing.pruneMS >= 0 && map.timing.clearanceMS >= 0 && map.timing.bandMS >= 0);
});
