import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrep } from '@barocss/cad';
import { evaluateDoc, partBreps } from '../src/engine/evaluate';
import { cylinderPart, emptyDoc, rectanglePart, withNode } from '../src/engine/doc';
import { measureBetween, measureItem } from '../src/app/measure';
import { bodyMesh, type DisplayMesh } from '../src/engine/mesh';
import { nativeCylinderAreaReader } from '../src/engine/nativeCylinderArea';

const meshOf = (doc: Parameters<typeof evaluateDoc>[0]): DisplayMesh => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(!r.ok && r.error)); return r.bodies[0].mesh; };
const faceBy = (m: DisplayMesh, pred: (n: [number, number, number]) => boolean) => m.faces.findIndex(f => f.kind === 'plane' && pred(f.normal));
// (Display meshes are float32: about 1e-6 relative.)
const near = (a: number, b: number, eps = 1e-4) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));

test('measure: parallel faces give their gap and normal distance; touching faces 0 at 90°', () => {
  const m = meshOf(rectanglePart(60, 40, 20));
  const top = faceBy(m, n => n[2] > 0.99), bottom = faceBy(m, n => n[2] < -0.99), side = faceBy(m, n => Math.abs(n[0]) > 0.99);
  const gap = measureBetween(m, { body: 0, face: top }, m, { body: 0, face: bottom });
  assert.ok(near(gap.distance, 20) && near(gap.normalDistance!, 20) && near(gap.angle!, 0), JSON.stringify(gap));
  const corner = measureBetween(m, { body: 0, face: top }, m, { body: 0, face: side });
  assert.ok(near(corner.distance, 0) && near(corner.angle!, 90) && corner.normalDistance === undefined, JSON.stringify(corner));
  // An edge alone: its length; a face alone: its area.
  const e = m.edges.findIndex(x => x.axis === 'x');
  const el = measureItem(m, { body: 0, edge: e }); assert.ok(near(el.length!, 60), JSON.stringify(el));
  assert.ok(near(measureItem(m, { body: 0, face: top }).area!, 2400, 1e-3));
});

test('measure: a cylinder face shows its radius, its rim an arc of that radius and length', () => {
  const m = meshOf(cylinderPart(5, 10));
  const wall = m.faces.findIndex(f => f.kind === 'curved');
  assert.ok(near(m.faces[wall].radius!, 5), String(m.faces[wall].radius));
  assert.ok((m.faces[wall].nativeFaces?.length ?? 0) > 1);
  assert.equal(m.faces[wall].nativeArea, undefined);
  assert.deepEqual(measureItem(m, { body: 0, face: wall }), {
    label: 'Curved face', radius: m.faces[wall].radius, area: m.faces[wall].area, areaBasis: 'display mesh',
  });
  const rim = m.edges.findIndex(x => !x.straight), it = measureItem(m, { body: 0, edge: rim });
  assert.equal(it.label, 'Arc', JSON.stringify(it));
  assert.ok(near(it.radius!, 5, 1e-3), String(it.radius));
  // The rim's length is the circle's (r·θ over its samples), not the shorter display polyline.
  assert.ok(near(it.length!, 2 * Math.PI * 5, 1e-5), String(it.length));
});

function pinnedRoundPrism(radius: number) {
  const x = Math.sqrt(24 * (radius - 10));
  const sketch = withNode(emptyDoc(), {
    kind: 'sketch', profile: 'loop', sideTags: { outer: ['e1', 'e5', 'e2', 'e3', 'e4'] },
    segments: [
      { kind: 'line', start: [0, 0] },
      { kind: 'arc', start: [20 + x, 0], center: [20 + x, 4], direction: 'ccw' },
      { kind: 'arc', start: [20 + radius * x / (radius - 4), 20 - radius + radius * (radius - 16) / (radius - 4)],
        center: [20, 20 - radius], direction: 'ccw' },
      { kind: 'line', start: [20, 20] }, { kind: 'line', start: [0, 20] },
    ],
  });
  const [{ brep }] = partBreps(withNode(sketch, { kind: 'extrude', sketch: 0, height: 10 }));
  assert.equal(brep.source.family, 'prismatic-solid');
  assert.ok(checkBrep(brep, { strict: true }).valid);
  return brep;
}

test('measure: native quarter and non-quarter Round wall areas are independent of mesh quality', () => {
  for (const radius of [16, 18, 20]) {
    const brep = pinnedRoundPrism(radius), tilt = Math.atan2(radius - 16, Math.sqrt(24 * (radius - 10)));
    const coarse = bodyMesh(brep, 1, 4), fine = bodyMesh(brep, 1, 16);
    for (const [id, expected] of [['e5', 40 * (Math.PI / 2 + tilt)], ['e2', 10 * radius * (Math.PI / 2 - tilt)]] as const) {
      const name = `n1.side[${id}]`;
      const a = coarse.faces.find(f => f.name === name), b = fine.faces.find(f => f.name === name);
      assert.ok(a && b);
      assert.notEqual(a.area, b.area, name);
      assert.equal(a.nativeArea, b.nativeArea, name);
      for (const [mesh, face] of [[coarse, a], [fine, b]] as const) {
        const item = measureItem(mesh, { body: 0, face: face.index });
        assert.equal(item.areaBasis, 'native', name);
        assert.ok(item.area !== undefined && near(item.area, expected, 1e-11), JSON.stringify(item));
      }
    }
  }
});

test('measure: native cylinder area rejects incomplete and mismatched trims', () => {
  const brep = pinnedRoundPrism(16);
  const face = brep.faces.find(f => f.name === 'n1.side[e5]');
  assert.ok(face);
  assert.ok(nativeCylinderAreaReader(brep)(face));
  const loop = brep.loops.find(l => l.id === face.loops[0]);
  assert.ok(loop);
  const id = loop.coedges[0];
  const changed = { ...brep, coedges: brep.coedges.map(use => use.id === id ? { ...use, pcurve: null } : use) };
  assert.equal(nativeCylinderAreaReader(changed)(face), undefined);
  assert.equal(nativeCylinderAreaReader(brep)({ ...face, loops: [...face.loops, 'inner'] }), undefined);
  const rim = brep.coedges.find(use => use.id === id);
  assert.ok(rim);
  const wrongRim = { ...brep, edges: brep.edges.map(edge => edge.id === rim.edge
    ? { ...edge, curve: { ...edge.curve, weights: edge.curve.weights.map(w => w * 2) } } : edge) };
  assert.equal(nativeCylinderAreaReader(wrongRim)(face), undefined);
});

test('errors: a too-steep draft and a zero angle name their cause', async () => {
  const { friendly } = await import('../src/engine/errors');
  assert.equal(friendly('n1: the draft closes a straight wall before the top (steeper than the profile allows)').title, 'The draft is too steep for this height');
  assert.equal(friendly('n1: angleDegrees must be in (0, 360]').title, 'The angle must be between 1° and 360°');
  // A suspected touch from the curved-face Boolean says it may be an unsupported overlap; the exact
  // upright check stays certain.
  assert.equal(friendly('n5: B-rep: analytic Boolean: the result is not a manifold solid (edge 2 has 3 uses; the inputs touch along an edge or at a vertex)').title, 'These bodies could not be joined into one solid');
  assert.equal(friendly('n4: the bodies touch along an edge or at a vertex only; the result is not a manifold solid').title, 'The bodies only touch along an edge or a point');
});

test('Shell refusals report the sharp boundary or failed wall, with raw diagnostics intact', async () => {
  const { friendly } = await import('../src/engine/errors');
  const sharp = '[SHELL_REGIONS_SHARP] shell: faces a and b of two smooth regions meet at a sharp edge (at 45, 0, 11.5): shelling there is not supported yet';
  assert.deepEqual(friendly(sharp), { code: 'SHELL_REGIONS_SHARP', title: 'Shell cannot cross this sharp edge',
    hint: 'Two smooth regions meet at a sharp edge near 45, 0, 11.5 mm. Shell does not support this junction.', detail: sharp });
  assert.match(friendly('[SHELL_REGIONS_SHARP] shell: no location').hint, /Two smooth regions meet at a sharp edge/);
  assert.equal(friendly('[SHELL_WALL_UNION] shell: analytic Boolean: the result is not a manifold solid').title,
    'Shell could not form a closed wall');
});

test('Sew keeps unmatched-edge count and ordered source indices visible', async () => {
  const { friendly } = await import('../src/engine/errors');
  const one = 'the surfaces do not close: 1 edge meet no other surface (surface 2)';
  assert.deepEqual(friendly('n0: ' + one, 'GEOMETRY'), {
    code: 'GEOMETRY', title: 'Sew leaves unmatched edges',
    hint: '1 edge could not be matched on surface 2 in the listed source order. Check the gap and the tolerance.',
    detail: one,
  });
  const many = 'the surfaces do not close: 8 edges meet no other surface (surfaces 1, 3, 4, 5, 6)';
  assert.match(friendly(many).hint, /8 edges.*surfaces 1, 3, 4, 5, 6/);
  assert.notEqual(friendly('the surfaces cannot all face one way').title, 'Sew leaves unmatched edges');
});

test('measure: between two bodies, the closest points span the gap', () => {
  let doc = withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] });
  doc = withNode(doc, { kind: 'extrude', sketch: 0, height: 10 });
  doc = withNode(doc, { kind: 'sketch', profile: 'rectangle', min: [25, 3], max: [35, 13] });
  doc = withNode(doc, { kind: 'extrude', sketch: 2, height: 10 });
  const r = evaluateDoc(doc, 1); assert.ok(r.ok);
  const [a, b] = r.bodies.map(x => x.mesh);
  const right = faceBy(a, n => n[0] > 0.99), left = faceBy(b, n => n[0] < -0.99);
  const d = measureBetween(a, { body: 0, face: right }, b, { body: 1, face: left });
  assert.ok(near(d.distance, 15) && near(d.normalDistance!, 15) && near(d.b[0] - d.a[0], 15), JSON.stringify(d));
});

test('measure: two round faces on one axis are coaxial; off it, by how much', async () => {
  const { evaluateDoc } = await import('../src/engine/evaluate');
  const { rectanglePart, withNode } = await import('../src/engine/doc');
  const { measureBetween, roundFaceAxis } = await import('../src/app/measure');
  let doc = rectanglePart(40, 20, 10);
  doc = withNode(doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [10, 10], radius: 3 });
  doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [10, 10], radius: 2 });
  doc = withNode(doc, { kind: 'extrude', sketch: 3, height: 30, from: -10 });
  doc = withNode(doc, { kind: 'sketch', profile: 'circle', center: [13, 10], radius: 1 });
  doc = withNode(doc, { kind: 'extrude', sketch: 5, height: 30, from: -10 });
  const r = evaluateDoc(doc, 1); assert.ok(r.ok);
  const round = (b: number) => r.bodies[b].mesh.faces.findIndex(f => f.kind === 'curved');
  const [plate, pin, other] = [0, 1, 2];
  const ax = roundFaceAxis(r.bodies[plate].mesh, round(plate))!;
  assert.ok(Math.abs(Math.abs(ax.dir[2]) - 1) < 1e-6 && Math.abs(ax.point[0] - 10) < 1e-6 && Math.abs(ax.point[1] - 10) < 1e-6, JSON.stringify(ax));
  const same = measureBetween(r.bodies[plate].mesh, { body: plate, face: round(plate) }, r.bodies[pin].mesh, { body: pin, face: round(pin) });
  assert.equal(same.axes?.coaxial, true);
  const off = measureBetween(r.bodies[plate].mesh, { body: plate, face: round(plate) }, r.bodies[other].mesh, { body: other, face: round(other) });
  assert.ok(off.axes && !off.axes.coaxial && Math.abs(off.axes.offset - 3) < 1e-6 && off.axes.angle < 1e-6);
});
