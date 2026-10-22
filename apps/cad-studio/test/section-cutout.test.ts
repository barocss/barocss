// G20.2: cut-outs in the studio — a corner taken out by two planes (a quarter) or three (an octant): on the CPU (WebGL2's
// path) the pieces kept by each plane from what the planes before it cut away, merged; in the kernel (the exact section)
// the same pieces split off, then one body a source body. Against the closed volumes of a box less a box.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { rectanglePart } from '@barocss/cad-model/engine/doc';
import type { DisplayMesh } from '@barocss/cad-model/engine/mesh';
import { axisPlane, clipMeshCutout, cutAway, cutoutCorner, exactBodies, flipPlane, hatchSegments, sectionSplits, type Section } from '../src/viewport/sectionView';

const bodiesOf = (doc: ReturnType<typeof rectanglePart>): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(r)); return r.bodies; };
/** A closed mesh's volume (the divergence theorem over its triangles). */
function volume(m: DisplayMesh): number {
  let v = 0; const P = m.positions, I = m.indices;
  for (let t = 0; t < I.length; t += 3) {
    const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
    v += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
  }
  return v;
}
// (The 20 × 12 × 8 box from the origin; the corner x > 10, y > 6 (and z > 4) taken out.)
const quarter = [axisPlane('x', 10, 'negative'), axisPlane('y', 6, 'negative')], octant = [...quarter, axisPlane('z', 4, 'negative')];

test('G20 a cut-out on the CPU: the box less its corner — a quarter 20·12·8 − 10·6·8, an octant − 10·6·4; wholly kept, wholly cut; the notch hatched', () => {
  const m = bodiesOf(rectanglePart(20, 12, 8))[0].mesh;
  const q = clipMeshCutout(m, quarter, 'cap')!, o = clipMeshCutout(m, octant, 'cap')!;
  assert.ok(Math.abs(volume(q) - (1920 - 480)) < 1e-3, `quarter ${volume(q)}`);
  assert.ok(Math.abs(volume(o) - (1920 - 240)) < 1e-3, `octant ${volume(o)}`);
  // (Every point its triangles use is kept by some plane.)
  for (const v of q.indices) assert.ok(q.positions[3 * v] <= 10 + 1e-4 || q.positions[3 * v + 1] <= 6 + 1e-4);
  // Planes that leave the box whole, and a corner holding all of it.
  assert.equal(clipMeshCutout(m, [axisPlane('x', 30, 'negative'), axisPlane('y', 6, 'negative')], 'cap'), m);
  assert.equal(clipMeshCutout(m, [axisPlane('x', -1, 'negative'), axisPlane('y', -1, 'negative')], 'cap'), null);
  assert.equal(cutAway(m, { mode: 'cutout', planes: [axisPlane('x', -1, 'negative'), axisPlane('y', -1, 'negative')] }), true);
  assert.equal(cutAway(m, { mode: 'cutout', planes: quarter }), false);
  // The hatch on the faces facing the corner: the notch's two (x = 10 across y 6…12 and y = 6 across x 10…20) — and the
  // first piece's cap on x = 10 below y = 6 too, which the second piece hides (inside the solid).
  const segs = hatchSegments(q, quarter, 0, 1);
  assert.ok(segs.length > 0);
  for (let i = 0; i < segs.length; i += 3) { const x = segs[i], y = segs[i + 1]; assert.ok(Math.abs(x - 10) < 1e-4 || Math.abs(y - 6) < 1e-4, `on a notch plane: ${x}, ${y}`); }
  // A flipped plane: the other side.
  assert.deepEqual(flipPlane(quarter[0]), { ...quarter[0], normal: [1, 0, 0], offset: 10 });
});

test('G20 the exact cut-out: the pieces split off in turn, one body a source body at the closed volume; the default corner faces the eye', () => {
  const doc = rectanglePart(20, 12, 8), bodies = bodiesOf(doc);
  const run = (s: Section) => { const r = sectionSplits(doc, bodies, s), e = evaluateDoc(r.doc, 1); assert.ok(e.ok, JSON.stringify(e)); return { r, e, x: exactBodies(e.bodies, r.kept, r.from) }; };
  for (const [planes, want, splits] of [[quarter, 1440, 2], [octant, 1680, 3]] as const) {
    const { r, x } = run({ mode: 'cutout', planes: [...planes] });
    assert.equal(r.doc.nodes.length - doc.nodes.length, splits, 'a split a plane');
    assert.equal(r.kept.length, splits, 'a piece a plane');
    assert.equal(x.bodies.length, 1, 'one body for its source');
    assert.equal(x.from.get(x.bodies[0].key), bodies[0].key);
    assert.ok(Math.abs((x.bodies[0].volumeMM3 ?? 0) - want) < 1e-6, `${x.bodies[0].volumeMM3} against ${want}`);
    assert.ok(Math.abs(volume(x.bodies[0].mesh) - want) < 1e-3, `its mesh ${volume(x.bodies[0].mesh)}`);
  }
  // The corner facing the eye, through the box's middle.
  const box = { min: [0, 0, 0], max: [20, 12, 8] };
  assert.deepEqual(cutoutCorner(box, [50, 40, 30]).map(p => [p.normal.map(v => v || 0), p.offset]), [[[-1, 0, 0], -10], [[0, -1, 0], -6]]);
  assert.deepEqual(cutoutCorner(box, [-50, 40, -30], 3).map(p => [p.normal.map(v => v || 0), p.offset]), [[[1, 0, 0], 10], [[0, -1, 0], -6], [[0, 0, 1], 4]]);
});
