import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, placeBody, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { emptyDoc, rectanglePart, withNode } from '@barocss/cad-model/engine/doc';
import { clipMesh } from '@barocss/cad-model/engine/clip';
import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';
import { posedBody } from '@barocss/cad-model/robot/preview';
import { clippedRay, prepareGeometry, rayTriangles } from '../../../packages/barocss-gpu/src/viewer/geometry';
import { axisSection, cutAway, sectionPlane, sectionedBodies, sectionedInstances, type AxisSection } from '../src/viewport/sectionView';
import { motionOf, poseMatrix } from '../src/viewport/instancePose';

// G2: the section view on the GPU and on the CPU. WebGL2 keeps the CPU path as it was (the same meshes clipMesh gave);
// WebGPU shows the bodies whole, less those clipMesh drops; the CPU ray with the clip plane finds what a ray finds on
// clipMesh's meshes — the same parameter, the cap where clipMesh's cap is; clipMesh's caps at the closed forms.

const bodiesOf = (doc: ReturnType<typeof emptyDoc>): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok); return r.bodies; };
const plate = () => bodiesOf(withNode(rectanglePart(32, 32, 16), { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [16, 16], radius: 5 }))[0];
const box = () => bodiesOf(rectanglePart(20, 12, 8))[0];
const cylinder = () => bodiesOf(withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'circle', center: [40, 6], radius: 6 }), { kind: 'extrude', sketch: 0, height: 10 }))[0];
let seed = 5; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const randomSection = (m: DisplayMesh): AxisSection => {
  const axis = (['x', 'y', 'z'] as const)[Math.floor(rand() * 3)], k = 'xyz'.indexOf(axis), lo = m.bounds.min[k], hi = m.bounds.max[k];
  return { axis, at: lo - 2 + rand() * (hi - lo + 4), keep: rand() < 0.5 ? 'negative' : 'positive' };
};

test('G2 the WebGL2 path unchanged: the bodies and instances clipped and capped as the CPU section always made them', () => {
  const bodies = [plate(), box(), cylinder()], cap = 'n9.cut';
  for (let k = 0; k < 12; k++) {
    const s = randomSection(bodies[k % 3].mesh), a = 'xyz'.indexOf(s.axis) as 0 | 1 | 2;
    // (The code the studio ran before G2, inlined.)
    const before = bodies.flatMap(b => { const mesh = clipMesh(b.mesh, a, s.at, s.keep, cap); return mesh ? [{ ...b, mesh }] : []; });
    assert.deepEqual(sectionedBodies(bodies, axisSection(s), false, cap), before);
    const placed: Parameters<typeof sectionedInstances>[0] = [{ id: 'i', bodies: [box()] }], M = poseMatrix({ R: Float64Array.from([0, -1, 0, 1, 0, 0, 0, 0, 1]), t: Float64Array.from([5, 0, 0]) }, [0, 0, 3]);
    const old = placed.map(i => ({ id: i.id, bodies: i.bodies.flatMap(b => { const mesh = clipMesh(posedBody(b, motionOf(M)).mesh, a, s.at, s.keep, 'section'); return mesh ? [{ ...b, mesh }] : []; }) }));
    const shown = sectionedInstances(placed, new Map([['i', M]]), axisSection(s), false);
    // Geometry remains exactly the former posed CPU result; provenance is checked separately.
    assert.deepEqual(shown.map(({ id, bodies }) => ({ id, bodies })), old);
    assert.deepEqual(shown[0].sourceBodies, old[0].bodies.length ? [0] : []);
    assert.equal(shown[0].sourceFaces!.length, old[0].bodies.length);
    assert.equal(shown[0].sourceEdges!.length, old[0].bodies.length);
    for (const [bi, body] of old[0].bodies.entries()) {
      assert.deepEqual(shown[0].sourceFaces![bi], body.mesh.faces.map(face => face.id === 'section-cap' ? -1 : face.index));
      assert.deepEqual(shown[0].sourceEdges![bi], placed[0].bodies[0].mesh.edges.map(edge => edge.index));
    }
  }
});

test('G2 CPU instance provenance keeps original body/face/edge authority after pose, filtering and a real cap', () => {
  const source = box();
  const removed = posedBody(source, motionOf(poseMatrix(undefined, [0, 50, 0])));
  const kept = posedBody(source, motionOf(poseMatrix(undefined, [0, -50, 0])));
  const placed: Parameters<typeof sectionedInstances>[0] = [{ id: 'provenance', bodies: [removed, source, kept] }];
  const M = poseMatrix({ R: Float64Array.from([0, -1, 0, 1, 0, 0, 0, 0, 1]), t: Float64Array.from([5, 0, 0]) }, [0, 0, 3]);
  const section = axisSection({ axis: 'x', at: 0, keep: 'positive' });
  const [shown] = sectionedInstances(placed, new Map([['provenance', M]]), section, false);
  assert.equal(shown.id, 'provenance');
  assert.deepEqual(shown.sourceBodies, [1, 2], 'removed body zero must not renumber the surviving source bodies');
  assert.equal(shown.bodies.length, 2);
  assert.equal(shown.sourceFaces!.length, 2); assert.equal(shown.sourceEdges!.length, 2);
  for (const [bi, sourceBody] of [source, kept].entries()) {
    const world = posedBody(sourceBody, motionOf(M)).mesh;
    const expected = clipMesh(world, 0, 0, 'positive', 'section');
    assert.ok(expected);
    assert.deepEqual(shown.bodies[bi], { ...sourceBody, mesh: expected }, 'pose then clip geometry is unchanged');
    assert.deepEqual(shown.sourceEdges![bi], sourceBody.mesh.edges.map(edge => edge.index), 'native edge ordinals survive the CPU clip');
    for (const face of shown.bodies[bi].mesh.faces) {
      const native = sourceBody.mesh.faces.find(f => f.id === face.id && f.name === face.name);
      assert.equal(shown.sourceFaces![bi][face.index], face.id === 'section-cap' ? -1 : native?.index);
    }
  }
  const mesh = shown.bodies[0].mesh, caps = mesh.faces.filter(face => face.id === 'section-cap');
  assert.equal(caps.length, 1); assert.equal(caps[0].name, 'section');
  assert.ok(Math.abs(caps[0].area - 20 * 8) < 1e-9, 'posed box cut has the independent 20 by 8 mm cap area');
  assert.deepEqual(caps[0].normal, [-1, 0, 0]);
  assert.equal(caps[0].centroid[0], 0);
  const usedFaces = new Set(Array.from(mesh.indices, vertex => mesh.faceOfVertex[vertex]));
  assert.ok(usedFaces.has(caps[0].index), 'the generated cap is used by actual triangles');
  assert.equal(shown.sourceFaces![0][caps[0].index], -1, 'a real cap cannot authorize a native face operation');
  assert.ok([...usedFaces].some(face => shown.sourceFaces![0][face] >= 0), 'retained native triangles keep native authority');
  assert.equal(shown.bodies[1].mesh.faces.some(face => face.id === 'section-cap'), false, 'a wholly kept body gains no cap');
});

test('G2 the WebGPU path: the same bodies (not copies), less exactly those clipMesh drops; the instances as placed; the plane', () => {
  const bodies = [plate(), box(), cylinder()];
  for (let k = 0; k < 60; k++) {
    const s = randomSection(bodies[k % 3].mesh), a = 'xyz'.indexOf(s.axis) as 0 | 1 | 2;
    const shown = sectionedBodies(bodies, axisSection(s), true, 'x');
    assert.deepEqual(shown, bodies.filter(b => clipMesh(b.mesh, a, s.at, s.keep, 'x') !== null), JSON.stringify(s));
    for (const b of shown) assert.ok(bodies.includes(b), 'the body itself');
    for (const b of bodies) assert.equal(cutAway(b.mesh, axisSection(s)), clipMesh(b.mesh, a, s.at, s.keep, 'x') === null);
  }
  const placed = [{ id: 'i', bodies: [box()] }];
  assert.equal(sectionedInstances(placed, new Map(), axisSection({ axis: 'x', at: 3, keep: 'positive' }), true), placed, 'the same list');
  assert.deepEqual(sectionPlane(axisSection({ axis: 'y', at: 16, keep: 'positive' })), { normal: [0, 1, 0], offset: 16 });
  assert.deepEqual(sectionPlane(axisSection({ axis: 'z', at: 4, keep: 'negative' })), { normal: [0, 0, -1], offset: -4 });
});

test('G2 clipMesh\'s caps at the closed forms: a box, a cylinder, a plate with a hole across and along it', () => {
  const cases: [DisplayMesh, AxisSection, number, number][] = [
    [box().mesh, { axis: 'x', at: 7, keep: 'positive' }, 12 * 8, 1e-9],
    [box().mesh, { axis: 'z', at: 3, keep: 'negative' }, 20 * 12, 1e-9],
    // (A tessellated circle: its polygon's area is under π r² by its chords, 0.64 % at its 32 sides.)
    [cylinder().mesh, { axis: "z", at: 5, keep: "positive" }, Math.PI * 36, 1e-2],
    [cylinder().mesh, { axis: 'y', at: 6, keep: 'negative' }, 12 * 10, 1e-6],
    [plate().mesh, { axis: "z", at: 8, keep: "positive" }, 32 * 32 - Math.PI * 25, 1e-2],
    [plate().mesh, { axis: 'y', at: 16, keep: 'negative' }, 32 * 16 - 10 * 16, 1e-6],
  ];
  for (const [m, s, want, rel] of cases) {
    const c = clipMesh(m, 'xyz'.indexOf(s.axis) as 0 | 1 | 2, s.at, s.keep, 'cap')!;
    assert.ok(Math.abs(c.faces.at(-1)!.area - want) <= rel * want, `${JSON.stringify(s)}: ${c.faces.at(-1)!.area} against ${want}`);
  }
});

test('G2 the CPU ray with the clip plane against a ray on clipMesh\'s mesh: the same parameter, the cap where clipMesh\'s cap is, on a holed plate and a box moved by a matrix', t => {
  const plateBody = plate(), moved = placeBody({ ...box(), mesh: { ...box().mesh, positions: box().mesh.positions.slice(), normals: box().mesh.normals.slice(), edgeLines: box().mesh.edgeLines.slice() } }, [1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, 0]);
  const M = poseMatrix({ R: Float64Array.from([0.8, -0.6, 0, 0.6, 0.8, 0, 0, 0, 1]), t: Float64Array.from([3, -2, 1]) }, undefined);
  let rays = 0, hits = 0, caps = 0, worst = 0, capMismatch = 0;
  for (const [body, T] of [[plateBody, poseMatrix(undefined, undefined)], [moved, M]] as const) {
    // The CPU path's mesh: the body moved by its matrix, then clipped (as sectionedInstances makes it).
    const world = posedBody(body, motionOf(T)).mesh, g = prepareGeometry({ positions: body.mesh.positions, normals: body.mesh.normals, indices: body.mesh.indices });
    for (let k = 0; k < 40; k++) {
      const s = randomSection(world), clip = sectionPlane(axisSection(s)), cpu = clipMesh(world, 'xyz'.indexOf(s.axis) as 0 | 1 | 2, s.at, s.keep, 'cap');
      // (A plane past the body leaves clipMesh's mesh itself, no cap.)
      const cg = cpu && prepareGeometry({ positions: cpu.positions, normals: cpu.normals, indices: cpu.indices }), capFace = cpu && cpu !== world ? cpu.faces.length - 1 : -1;
      const c = [0, 1, 2].map(i => (world.bounds.min[i] + world.bounds.max[i]) / 2), size = Math.max(...[0, 1, 2].map(i => world.bounds.max[i] - world.bounds.min[i]));
      for (let r = 0; r < 50; r++) {
        // From all round, aimed at a point in the box.
        const dir = [rand() - 0.5, rand() - 0.5, rand() - 0.5], l = Math.hypot(...dir), aim = c.map((x, i) => x + (rand() - 0.5) * (world.bounds.max[i] - world.bounds.min[i]));
        const o = aim.map((x, i) => x - dir[i] / l * size * 3) as [number, number, number], d = dir.map(x => x / l) as [number, number, number];
        const want = cg ? rayTriangles(cg, o, d) : null, got = clippedRay(g, T, o, d, clip, true, true);
        rays++;
        // (Rays grazing an edge of the cut can fall either side of it; past a micrometre of it they agree.)
        if (!want || !got) { assert.equal(!!got, !!want, `${JSON.stringify(s)} ray ${r}: ${JSON.stringify({ want, got })}`); continue; }
        hits++; worst = Math.max(worst, Math.abs(got.t - want.t));
        const onCap = cpu!.faceOfVertex[cpu!.indices[3 * want.triangle]] === capFace;
        if (onCap) caps++;
        if (onCap !== got.cap) capMismatch++;
      }
    }
  }
  t.diagnostic(`${rays} rays, ${hits} hits, ${caps} on caps, worst Δt ${worst} mm, ${capMismatch} cap mismatches`);
  assert.ok(hits > 1000 && caps > 200, `${rays} rays, ${hits} hits, ${caps} on caps`);
  assert.ok(worst < 1e-6 * 40, `worst ${worst} mm`);
  assert.equal(capMismatch, 0, `${capMismatch} of ${hits} hits on the cap in one and not the other`);
});
