import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '../src/engine/evaluate';
import { cylinderPart, emptyDoc, placedDoc, rectanglePart, starterDoc, withNode, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { faceTableOf } from '../src/assembly/faces';
import { BASE, eulerOf, rotationMatrix, rotationSteps, solveAssembly, type FaceTable, type Mate } from '../src/assembly/mates';

const near = (a: number, e: number, tol = 1e-9) => Math.abs(a - e) < tol;
const inst = (id: string, doc: StudioDoc, position: [number, number, number] = [0, 0, 0], rotation: [number, number, number] = [0, 0, 0]): PartInstance =>
  ({ id, name: id, doc, position, rotation });
/** Tables for the base part and each instance, read from the kernel as the studio reads them. */
function tablesFor(base: StudioDoc, instances: PartInstance[]) {
  const t = new Map<string, FaceTable>([[BASE, faceTableOf(base)], ...instances.map(i => [i.id, faceTableOf(i.doc)] as [string, FaceTable])]);
  return (part: string) => t.get(part);
}
const boundsOf = (i: PartInstance) => {
  const r = evaluatePart(placedDoc(i), 1);
  assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
  return r.bodies[0].mesh.bounds;
};

test('mates: faces read exactly from the kernel', () => {
  const t = faceTableOf(starterDoc());
  assert.deepEqual(t['n1.top'], { kind: 'plane', point: [0, 0, 8], normal: [0, 0, 1] });
  // The hole's two halves read as one cylinder, its radius and centre clean.
  assert.deepEqual(t['n2.side0'], { kind: 'cylinder', point: [32, 16, 0], axis: [0, 0, 1], radius: 4, outer: false });
  assert.equal(faceTableOf(cylinderPart(4, 20))['n1.side0'].kind, 'cylinder');
});

test('mates: a pin seated in the plate’s hole (coincident + concentric), and flipped', () => {
  const base = starterDoc(), pin = inst('pin', cylinderPart(4, 20), [100, 0, 0]);
  const mates: Mate[] = [
    { id: 'm1', kind: 'coincident', a: { part: BASE, face: 'n1.top' }, b: { part: 'pin', face: 'n1.bottom' } },
    { id: 'm2', kind: 'concentric', a: { part: BASE, face: 'n2.side0' }, b: { part: 'pin', face: 'n1.side0' } },
  ];
  const r = solveAssembly([pin], mates, tablesFor(base, [pin]));
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.instances[0].position, [32, 16, 8]);
  assert.deepEqual(r.instances[0].rotation, [0, 0, 0]);
  const b = boundsOf(r.instances[0]);
  assert.ok(near(b.min[0], 28, 1e-6) && near(b.max[0], 36, 1e-6) && near(b.min[2], 8) && near(b.max[2], 28), JSON.stringify(b));
  // Coincident alone keeps the rest of where it stood: only Z moves.
  const one = solveAssembly([pin], mates.slice(0, 1), tablesFor(base, [pin]));
  assert.deepEqual(one.instances[0].position, [100, 0, 8]);
  // Flipped: the pin's bottom faces up from the top face, so the pin hangs through the plate.
  const flipped = solveAssembly([pin], [{ ...mates[0], flip: true }, mates[1]], tablesFor(base, [pin]));
  assert.deepEqual(flipped.problems, []);
  const fb = boundsOf(flipped.instances[0]);
  assert.ok(near(fb.min[2], -12) && near(fb.max[2], 8) && near((fb.min[0] + fb.max[0]) / 2, 32, 1e-6), JSON.stringify(fb));
});

test('mates: distance between parallel faces, with the rotation fixed by two directions', () => {
  const base = rectanglePart(64, 32, 8), plate = inst('plate', rectanglePart(20, 10, 4), [100, 50, 0], [0, 0, 30]);
  const mates: Mate[] = [
    { id: 'm1', kind: 'coincident', a: { part: BASE, face: 'n1.top' }, b: { part: 'plate', face: 'n1.bottom' } },
    { id: 'm2', kind: 'distance', distance: 5, a: { part: BASE, face: 'n1.side1' }, b: { part: 'plate', face: 'n1.side3' } },
  ];
  const r = solveAssembly([plate], mates, tablesFor(base, [plate]));
  assert.deepEqual(r.problems, []);
  // side3 (x = 0, facing −X) faces the base's +X side 5 mm off; Y stays where it was.
  assert.deepEqual(r.instances[0].rotation, [0, 0, 0]);
  assert.deepEqual(r.instances[0].position, [69, 50, 8]);
  // Solving a solved assembly again changes nothing (no drift).
  const again = solveAssembly(r.instances, mates, tablesFor(base, r.instances));
  assert.deepEqual(again.instances, r.instances);
  // Flip on the distance: the faces point the same way, so the plate turns half round.
  const f = solveAssembly([plate], [mates[0], { ...mates[1], flip: true }], tablesFor(base, [plate]));
  assert.deepEqual(f.instances[0].rotation.map(Math.abs), [0, 0, 180]);
  assert.deepEqual(f.instances[0].position, [69, 50, 8]);
});

test('mates: conflicts are refused with the reason, redundant agreeing mates are accepted', () => {
  const base = rectanglePart(64, 32, 8), plate = inst('plate', rectanglePart(20, 10, 4), [100, 0, 0]);
  const m1: Mate = { id: 'm1', kind: 'coincident', a: { part: BASE, face: 'n1.top' }, b: { part: 'plate', face: 'n1.bottom' } };
  // Its top flush on the base's top too: the plate would have to face both ways.
  const turned: Mate = { id: 'm2', kind: 'coincident', a: { part: BASE, face: 'n1.top' }, b: { part: 'plate', face: 'n1.top' } };
  const r1 = solveAssembly([plate], [m1, turned], tablesFor(base, [plate]));
  assert.equal(r1.problems.length, 1);
  assert.equal(r1.problems[0].mate, 'm2');
  assert.match(r1.problems[0].reason, /Conflicts with Coincident 1: it already sets which way a face of plate parallel to this one points, and this mate would turn them 180° from there/);
  assert.deepEqual(r1.instances[0].position, [100, 0, 8], 'the first mate still holds');
  // The same face mated again to a face at right angles.
  const twice: Mate = { id: 'm6', kind: 'coincident', a: { part: BASE, face: 'n1.side1' }, b: { part: 'plate', face: 'n1.bottom' } };
  assert.match(solveAssembly([plate], [m1, twice], tablesFor(base, [plate])).problems[0].reason, /Conflicts with Coincident 1: it already sets which way this face of plate points, and this mate would turn it 90° from there/);
  // A side face flush on the same top face: the plate's faces are square, their partners the same face.
  const square: Mate = { id: 'm7', kind: 'coincident', a: { part: BASE, face: 'n1.top' }, b: { part: 'plate', face: 'n1.side0' } };
  assert.match(solveAssembly([plate], [m1, square], tablesFor(base, [plate])).problems[0].reason, /Conflicts with Coincident 1: on plate its face is 90° from that mate's face, but the faces they mate to are 0° apart/);
  // The same faces 3 mm apart while a mate holds them flush.
  const apart: Mate = { id: 'm3', kind: 'distance', distance: 3, a: { part: BASE, face: 'n1.top' }, b: { part: 'plate', face: 'n1.bottom' } };
  const r2 = solveAssembly([plate], [m1, apart], tablesFor(base, [plate]));
  assert.deepEqual(r2.problems.map(p => p.mate), ['m3']);
  assert.match(r2.problems[0].reason, /Conflicts with Coincident 1: they hold plate 3 mm from where this mate puts it/);
  // 0 mm apart agrees with flush: accepted.
  assert.deepEqual(solveAssembly([plate], [m1, { ...apart, distance: 0 }], tablesFor(base, [plate])).problems, []);
  // A third direction that does not fit the two that fix the rotation.
  const side: Mate = { id: 'm4', kind: 'coincident', a: { part: BASE, face: 'n1.side1' }, b: { part: 'plate', face: 'n1.side3' } };
  const skew: Mate = { id: 'm5', kind: 'coincident', a: { part: BASE, face: 'n1.side1' }, b: { part: 'plate', face: 'n1.side0' } };
  const r3 = solveAssembly([plate], [m1, side, skew], tablesFor(base, [plate]));
  assert.deepEqual(r3.problems.map(p => p.mate), ['m5']);
  assert.match(r3.problems[0].reason, /Conflicts with Coincident 1 and Coincident 2: they turn plate so this face points 90° away/);
  // Mixed faces, fixed parts, missing faces and same-part picks are refused before solving.
  const pin = inst('pin', cylinderPart(4, 20)), fixed = { ...inst('fixed', rectanglePart(10, 10, 2)), grounded: true };
  const r4 = solveAssembly([pin, fixed], [
    { id: 'x1', kind: 'concentric', a: { part: BASE, face: 'n1.top' }, b: { part: 'pin', face: 'n1.side0' } },
    { id: 'x2', kind: 'coincident', a: { part: 'pin', face: 'n1.top' }, b: { part: 'fixed', face: 'n1.bottom' } },
    { id: 'x3', kind: 'coincident', a: { part: BASE, face: 'n9.top' }, b: { part: 'pin', face: 'n1.bottom' } },
    { id: 'x4', kind: 'coincident', a: { part: 'pin', face: 'n1.top' }, b: { part: 'pin', face: 'n1.bottom' } },
  ], tablesFor(base, [pin, fixed]));
  assert.deepEqual(r4.problems.map(p => p.mate), ['x1', 'x2', 'x3', 'x4']);
  assert.match(r4.problems[0].reason, /Concentric needs two round faces/);
  assert.match(r4.problems[1].reason, /fixed, so this mate cannot move it/);
  assert.match(r4.problems[2].reason, /no longer on the part/);
  assert.match(r4.problems[3].reason, /same part/);
});

test('mates: a chain is solved in order, a loop is refused, a changed part re-solves', () => {
  const base = rectanglePart(64, 32, 8);
  const a = inst('a', rectanglePart(20, 10, 4), [100, 0, 0]), b = inst('b', rectanglePart(10, 10, 2), [200, 0, 0]);
  // b on a (listed first), a on the base.
  const chain: Mate[] = [
    { id: 'm1', kind: 'coincident', a: { part: 'a', face: 'n1.top' }, b: { part: 'b', face: 'n1.bottom' } },
    { id: 'm2', kind: 'coincident', a: { part: BASE, face: 'n1.top' }, b: { part: 'a', face: 'n1.bottom' } },
  ];
  const r = solveAssembly([a, b], chain, tablesFor(base, [a, b]));
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.instances.map(i => i.position[2]), [8, 12]);
  // The base part grows 4 mm: everything mated on it follows.
  const taller = rectanglePart(64, 32, 12);
  assert.deepEqual(solveAssembly(r.instances, chain, tablesFor(taller, r.instances)).instances.map(i => i.position[2]), [12, 16]);
  // a placed by b and b by a: neither can be solved, both stay where they were.
  const loop: Mate[] = [chain[0], { id: 'm3', kind: 'coincident', a: { part: 'b', face: 'n1.top' }, b: { part: 'a', face: 'n1.bottom' } }];
  const l = solveAssembly([a, b], loop, tablesFor(base, [a, b]));
  assert.deepEqual(l.problems.map(p => p.mate).sort(), ['m1', 'm3']);
  assert.match(l.problems[0].reason, /closes a loop/);
  assert.deepEqual(l.instances, [a, b]);
});

test('mates: concentric flip reverses the axis; rotations read back as X→Y→Z angles', () => {
  const base = starterDoc(), pin = inst('pin', cylinderPart(4, 20), [0, 0, 0]);
  const m: Mate = { id: 'm', kind: 'concentric', flip: true, a: { part: BASE, face: 'n2.side0' }, b: { part: 'pin', face: 'n1.side0' } };
  const r = solveAssembly([pin], [m], tablesFor(base, [pin]));
  const R = rotationMatrix(r.instances[0].rotation);
  assert.ok(near(R[8], -1), 'the pin’s axis points down');
  assert.deepEqual([r.instances[0].position[0], r.instances[0].position[1]], [32, 16]);
  for (const rot of [[10, 20, 30], [-45, 60, 170], [0, 90, 25], [0, -90, -40], [180, 0, 0], [33.5, -12.25, 99]] as [number, number, number][]) {
    const m1 = rotationMatrix(rot), m2 = rotationMatrix(eulerOf(m1));
    m1.forEach((v, k) => assert.ok(near(v, m2[k], 1e-12), `${rot}: ${eulerOf(m1)}`));
  }
  assert.deepEqual(eulerOf(rotationMatrix([0, 0, 90])), [0, 0, 90]);
});

test('mates: a part mated to a fixed part moves with it as one piece', () => {
  const base = rectanglePart(64, 32, 8);
  const a = { ...inst('a', rectanglePart(20, 10, 4), [100, 0, 0]), grounded: true }, b = inst('b', rectanglePart(10, 10, 2), [105, 3, 0]);
  const mates: Mate[] = [{ id: 'm1', kind: 'coincident', a: { part: 'a', face: 'n1.top' }, b: { part: 'b', face: 'n1.bottom' } }];
  const r = solveAssembly([a, b], mates, tablesFor(base, [a, b]));
  assert.deepEqual(r.instances[1].position, [105, 3, 4]);
  // a moves and turns a quarter about Z: b keeps its place on a (5, 3 from a's corner), turned with it.
  const moved = [{ ...r.instances[0], position: [130, 10, 0] as [number, number, number], rotation: [0, 0, 90] as [number, number, number] }, r.instances[1]];
  const f = solveAssembly(moved, mates, tablesFor(base, moved), r.instances);
  assert.deepEqual(f.problems, []);
  assert.deepEqual(f.instances[1].rotation, [0, 0, 90]);
  f.instances[1].position.forEach((v, k) => assert.ok(near(v, [127, 15, 4][k]), String(f.instances[1].position)));
  // Undo-like: both changed since `before`, so nothing is carried (the placements are taken as they are).
  const back = solveAssembly(r.instances, mates, tablesFor(base, r.instances), f.instances);
  assert.deepEqual(back.instances, r.instances);
});

test('mates: an angle turns a part about the axis the other mates leave free', () => {
  const base = rectanglePart(64, 32, 8), plate = inst('plate', rectanglePart(20, 10, 4), [100, 0, 0]);
  const flat: Mate = { id: 'm1', kind: 'coincident', a: { part: BASE, face: 'n1.top' }, b: { part: 'plate', face: 'n1.bottom' } };
  // side3 (−X) at 30° from facing the base's +X side: a 30° turn about Z, the smaller way.
  const angle: Mate = { id: 'm2', kind: 'angle', angle: 30, a: { part: BASE, face: 'n1.side1' }, b: { part: 'plate', face: 'n1.side3' } };
  const r = solveAssembly([plate], [flat, angle], tablesFor(base, [plate]));
  assert.deepEqual(r.problems, []);
  assert.deepEqual([r.instances[0].rotation[0], r.instances[0].rotation[1], Math.abs(r.instances[0].rotation[2])], [0, 0, 30]);
  assert.equal(r.instances[0].position[2], 8);
  // Solved again: unchanged.
  assert.deepEqual(solveAssembly(r.instances, [flat, angle], tablesFor(base, r.instances)).instances, r.instances);
  // On its own: the smallest turn of the bottom to 90° from the top face's partner direction.
  const alone = solveAssembly([plate], [{ ...angle, a: { part: BASE, face: 'n1.top' }, b: { part: 'plate', face: 'n1.bottom' }, angle: 90 }], tablesFor(base, [plate]));
  const R = rotationMatrix(alone.instances[0].rotation);
  assert.ok(near(R[8], 0, 1e-12), 'the bottom normal lies flat');
  // The faces the coincident mate holds flush cannot also be 45° apart.
  const no = solveAssembly([plate], [flat, { ...angle, a: flat.a, b: flat.b, angle: 45 }], tablesFor(base, [plate]));
  assert.match(no.problems[0].reason, /Conflicts with Coincident 1: turning plate about the axis they leave free, this face can only be 0° to 0° from its partner/);
  // With the rotation fixed by two mates, an angle is only checked.
  const side: Mate = { id: 'm3', kind: 'coincident', a: { part: BASE, face: 'n1.side1' }, b: { part: 'plate', face: 'n1.side3' } };
  assert.deepEqual(solveAssembly([plate], [flat, side, { ...angle, angle: 0 }], tablesFor(base, [plate])).problems, []);
  assert.match(solveAssembly([plate], [flat, side, angle], tablesFor(base, [plate])).problems[0].reason, /Conflicts with Coincident 1 and Coincident 2: they hold this face of plate at 0° to its partner/);
  // Out of range is refused before solving.
  assert.match(solveAssembly([plate], [flat, { ...angle, angle: 200 }], tablesFor(base, [plate])).problems[0].reason, /0° to 180°/);
});

test('mates: tangent puts a round face against a flat one, from either side', () => {
  const base = starterDoc(), pin = inst('pin', cylinderPart(4, 20), [100, 0, 0]);
  // A pin lying on the plate: its axis turns flat, 4 mm above the top face.
  const lie: Mate = { id: 'm1', kind: 'tangent', a: { part: BASE, face: 'n1.top' }, b: { part: 'pin', face: 'n1.side0' } };
  const r = solveAssembly([pin], [lie], tablesFor(base, [pin]));
  assert.deepEqual(r.problems, []);
  assert.ok(near(rotationMatrix(r.instances[0].rotation)[8], 0, 1e-12), 'the axis lies flat');
  assert.equal(r.instances[0].position[2], 12);
  const b = boundsOf(r.instances[0]);
  assert.ok(near(b.min[2], 8, 1e-6) && near(b.max[2], 16, 1e-6), JSON.stringify(b));
  // A plate's side against a standing (fixed) pin: the face 4 mm from the axis, or behind it with flip.
  const post = { ...inst('post', cylinderPart(4, 20)), grounded: true }, plate = inst('plate', rectanglePart(20, 10, 4), [30, 0, 0]);
  const touch: Mate = { id: 'm2', kind: 'tangent', a: { part: 'post', face: 'n1.side0' }, b: { part: 'plate', face: 'n1.side3' } };
  const t = solveAssembly([post, plate], [touch], tablesFor(base, [post, plate]));
  assert.deepEqual(t.problems, []);
  assert.deepEqual(t.instances[1].position, [4, 0, 0]);
  assert.deepEqual(solveAssembly([post, plate], [{ ...touch, flip: true }], tablesFor(base, [post, plate])).instances[1].position, [-4, 0, 0]);
  // Two flat faces cannot be tangent.
  assert.match(solveAssembly([pin], [{ ...lie, b: { part: 'pin', face: 'n1.bottom' } }], tablesFor(base, [pin])).problems[0].reason, /Tangent needs a round face, and a flat or another round face/);
});

test('mates: two round faces tangent — side by side, inside a hole, and with a direction held', () => {
  const base = starterDoc(), post = { ...inst('post', cylinderPart(4, 20)), grounded: true }, pin = inst('pin', cylinderPart(3, 10), [20, 0, 5]);
  const touch: Mate = { id: 'm1', kind: 'tangent', a: { part: 'post', face: 'n1.side0' }, b: { part: 'pin', face: 'n1.side0' } };
  const r = solveAssembly([post, pin], [touch], tablesFor(base, [post, pin]));
  assert.deepEqual(r.problems, []);
  // Straight in towards the post until the axes are 4 + 3 apart; its height stays.
  assert.deepEqual(r.instances[1].position, [7, 0, 5]);
  assert.deepEqual(solveAssembly(r.instances, [touch], tablesFor(base, r.instances)).instances, r.instances, 'solved again: unchanged');
  // Flipped: inside each other, 4 − 3 apart.
  assert.deepEqual(solveAssembly([post, pin], [{ ...touch, flip: true }], tablesFor(base, [post, pin])).instances[1].position, [1, 0, 5]);
  // A pin against the wall of the plate's Ø8 hole: inside it by default.
  const loose = inst('pin', cylinderPart(3, 10), [40, 16, 0]);
  const wall = solveAssembly([loose], [{ ...touch, a: { part: BASE, face: 'n2.side0' } }], tablesFor(base, [loose]));
  assert.deepEqual(wall.instances[0].position, [33, 16, 0]);
  // Also tangent to the plate's front face (y = 0): only X is left to reach the post.
  const front: Mate = { id: 'm2', kind: 'tangent', a: { part: BASE, face: 'n1.side0' }, b: { part: 'pin', face: 'n1.side0' } };
  const far = { ...post, position: [10, -10, 0] as [number, number, number] }, start = inst('pin', cylinderPart(3, 10), [30, -3, 0]);
  const both = solveAssembly([far, start], [front, { ...touch }], tablesFor(base, [far, start]));
  assert.deepEqual(both.problems, []);
  both.instances[1].position.forEach((v, k) => assert.ok(near(v, [10, -3, 0][k], 1e-6), String(both.instances[1].position)));
  const tooFar = { ...post, position: [10, -12, 0] as [number, number, number] };
  const no = solveAssembly([tooFar, start], [front, touch], tablesFor(base, [tooFar, start]));
  assert.match(no.problems[0].reason, /Conflicts with Tangent 1: they hold pin so the axes can only be at least 9 mm apart, not 7 mm/);
});

test('mates: any rotation is placed exactly (Z turns between quarter turns about X)', () => {
  const turn = (axis: 'x' | 'y' | 'z', deg: number) => rotationMatrix(axis === 'x' ? [deg, 0, 0] : axis === 'y' ? [0, deg, 0] : [0, 0, deg]);
  const mul = (a: number[], b: number[]) => [0, 1, 2].flatMap(i => [0, 1, 2].map(j => a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]));
  for (const rot of [[45, 0, 0], [30, 20, 10], [0, 33, 0], [-120, 75, 200], [90, 0, 45], [180, 0, 30]] as [number, number, number][]) {
    const steps = rotationSteps(rot);
    // The kernel turns about X and Y by quarter turns only.
    for (const s of steps) if (s.axis !== 'z') assert.ok(s.angleDegrees % 90 === 0, `${rot}: ${JSON.stringify(steps)}`);
    const m = steps.reduce<number[]>((acc, s) => mul(turn(s.axis, s.angleDegrees), acc), rotationMatrix([0, 0, 0]));
    rotationMatrix(rot).forEach((v, k) => assert.ok(near(v, m[k], 1e-12), `${rot}: ${JSON.stringify(steps)}`));
  }
  // Quarter turns keep the plain X → Y → Z steps (documents built before stay the same).
  assert.deepEqual(rotationSteps([90, 0, 45]), [{ axis: 'x', angleDegrees: 90 }, { axis: 'z', angleDegrees: 45 }]);
  // A 10 × 10 × 4 block turned 30°, 20°, 10° builds, its box where its corners go.
  const rot: [number, number, number] = [30, 20, 10], block = inst('b', rectanglePart(10, 10, 4), [5, 6, 7], rot), R = rotationMatrix(rot);
  const b = boundsOf(block);
  for (const k of [0, 1, 2]) {
    const xs = [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const p = [i & 1 ? 10 : 0, i & 2 ? 10 : 0, i & 4 ? 4 : 0]; return R[k * 3] * p[0] + R[k * 3 + 1] * p[1] + R[k * 3 + 2] * p[2] + block.position[k]; });
    assert.ok(near(b.min[k], Math.min(...xs), 1e-5) && near(b.max[k], Math.max(...xs), 1e-5), `${k}: ${JSON.stringify(b)} ${Math.min(...xs)} ${Math.max(...xs)}`);
  }
});

test('mates: a block flush on a 45° chamfer and on a 30° tilted top is placed and builds (QA A1)', () => {
  const blk = inst('blk', rectanglePart(10, 10, 4), [60, 0, 0]);
  const chamfered = withNode(rectanglePart(40, 40, 20), { kind: 'chamfer', parent: { node: 1, side: 'solid' }, edges: ['n1.side0|n1.top'], distance: 10 });
  const onChamfer = solveAssembly([blk], [{ id: 'm1', kind: 'coincident', a: { part: BASE, face: 'n2.face' }, b: { part: 'blk', face: 'n1.bottom' } }], tablesFor(chamfered, [blk]));
  assert.deepEqual(onChamfer.problems, []);
  assert.deepEqual(onChamfer.instances[0].rotation, [45, 0, 0], 'a clean 45°');
  boundsOf(onChamfer.instances[0]);
  const tilted = withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [30, 20], plane: { origin: [0, 0, 0], normal: [0, 0.5, Math.sqrt(3) / 2], xAxis: [1, 0, 0] } }), { kind: 'extrude', sketch: 0, height: 8 });
  const onTilt = solveAssembly([blk], [{ id: 'm1', kind: 'coincident', a: { part: BASE, face: 'n1.top' }, b: { part: 'blk', face: 'n1.bottom' } }], tablesFor(tilted, [blk]));
  assert.deepEqual(onTilt.problems, []);
  assert.deepEqual(onTilt.instances[0].rotation, [-30, 0, 0]);
  const b = boundsOf(onTilt.instances[0]);
  assert.ok(b.max[2] > b.min[2] + 4, JSON.stringify(b));
});

test('mates: wedged against two round faces — the circles’ nearer crossing, refused when they do not meet', () => {
  const base = rectanglePart(64, 32, 8);
  const p1 = { ...inst('p1', cylinderPart(4, 20)), grounded: true }, p2 = { ...inst('p2', cylinderPart(4, 20), [20, 0, 0]), grounded: true };
  const roller = inst('roller', cylinderPart(8, 10), [10, 20, 0]);
  const on = (post: string, id: string): Mate => ({ id, kind: 'tangent', a: { part: post, face: 'n1.side0' }, b: { part: 'roller', face: 'n1.side0' } });
  const r = solveAssembly([p1, p2, roller], [on('p1', 'm1'), on('p2', 'm2')], tablesFor(base, [p1, p2, roller]));
  assert.deepEqual(r.problems, []);
  // 12 mm from both axes (4 + 8), on the side it came from: (10, √(144 − 100)).
  const at = r.instances[2].position;
  assert.ok(near(at[0], 10, 1e-9) && near(at[1], Math.sqrt(44), 1e-9) && at[2] === 0, String(at));
  assert.deepEqual(solveAssembly(r.instances, [on('p1', 'm1'), on('p2', 'm2')], tablesFor(base, r.instances)).instances, r.instances, 'solved again: unchanged');
  // A Ø6 roller cannot touch both posts 20 mm apart: the second is refused, the first still holds.
  const small = inst('roller', cylinderPart(3, 10), [10, 20, 0]);
  const no = solveAssembly([p1, p2, small], [on('p1', 'm1'), on('p2', 'm2')], tablesFor(base, [p1, p2, small]));
  assert.deepEqual(no.problems.map(p => p.mate), ['m2']);
  assert.match(no.problems[0].reason, /Conflicts with Tangent 1: the two axes it touches are 20 mm apart, so it cannot be 7 mm from one and 7 mm from the other/);
  assert.ok(near(Math.hypot(no.instances[2].position[0], no.instances[2].position[1]), 7, 1e-9));
  // A plate with two Ø8 holes 20 apart, dropped onto both posts (inside each hole: axes together).
  const plate = withNode(withNode(rectanglePart(40, 10, 4), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 5], radius: 4 }), { kind: 'hole', parent: { node: 2, side: 'solid' }, center: [30, 5], radius: 4 });
  const pl = inst('pl', plate, [3, 40, 30]);
  const holes: Mate[] = [
    { id: 'h1', kind: 'tangent', a: { part: 'p1', face: 'n1.side0' }, b: { part: 'pl', face: 'n2.side0' } },
    { id: 'h2', kind: 'tangent', a: { part: 'p2', face: 'n1.side0' }, b: { part: 'pl', face: 'n3.side0' } },
  ];
  const d = solveAssembly([p1, p2, pl], holes, tablesFor(base, [p1, p2, pl]));
  assert.deepEqual(d.problems, []);
  assert.deepEqual(d.instances[2].position, [-10, -5, 30]);
});
