import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePart } from '../src/engine/evaluate';
import { cylinderPart, placedDoc, rectanglePart, starterDoc, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { faceTableOf } from '../src/assembly/faces';
import { BASE, eulerOf, rotationMatrix, solveAssembly, type FaceTable, type Mate } from '../src/assembly/mates';

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
  assert.match(r4.problems[0].reason, /flat face and a round face/);
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
