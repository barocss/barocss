// G19.2: sections of several planes on the CPU (WebGL2's path) and in the kernel (the exact section): clipMesh in a
// plane's own frame, planes in turn, the splits chained plane by plane — against closed forms and the axis path as it was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc, type BodyResult } from '@barocss/cad-model/engine/evaluate';
import { rectanglePart, withNode } from '@barocss/cad-model/engine/doc';
import { bodyKeyFor } from '@barocss/cad-model/engine/ids';
import { refOf } from '@barocss/cad-model/app/bodyRef';
import { clipMesh } from '@barocss/cad-model/engine/clip';
import type { DisplayMesh, Vec3 } from '@barocss/cad-model/engine/mesh';
import { axisPlane, axisSection, boxSection, clipMeshPlane, clipMeshPlanes, cutAway, planeAxis, planeFromFace, sectionSplits, type Section } from '../src/viewport/sectionView';

const bodiesOf = (doc: ReturnType<typeof rectanglePart>): BodyResult[] => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, JSON.stringify(r)); return r.bodies; };
const box = () => bodiesOf(rectanglePart(20, 12, 8))[0];
const SQ = Math.SQRT1_2;
/** The area of a mesh's triangles on the faces `which` picks. */
function facesArea(m: DisplayMesh, which: (face: number) => boolean): number {
  let a = 0;
  for (let t = 0; t < m.indices.length; t += 3) {
    const [i, j, k] = [m.indices[t], m.indices[t + 1], m.indices[t + 2]];
    if (!which(m.faceOfVertex[i])) continue;
    const P = (v: number) => [m.positions[3 * v], m.positions[3 * v + 1], m.positions[3 * v + 2]];
    const p = P(i), q = P(j), r = P(k), u = q.map((x, c) => x - p[c]), v = r.map((x, c) => x - p[c]);
    a += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
  }
  return a;
}

test('G19 clipMeshPlane: along an axis clipMesh itself; an oblique plane through a box at the closed form, its points on the kept side', () => {
  const m = box().mesh;
  for (const [axis, at, keep] of [['x', 7, 'positive'], ['y', 5, 'negative'], ['z', 3, 'positive']] as const)
    assert.deepEqual(clipMeshPlane(m, axisPlane(axis, at, keep), 'cap'), clipMesh(m, 'xyz'.indexOf(axis) as 0 | 1 | 2, at, keep, 'cap'));
  // x + y ≥ 16 (normal (1, 1, 0)/√2): the cap from (4, 12) to (16, 0), 8 high — 12√2 × 8.
  const p = { normal: [SQ, SQ, 0] as Vec3, offset: 16 * SQ }, c = clipMeshPlane(m, p, 'cap')!;
  const cap = c.faces.at(-1)!;
  assert.ok(Math.abs(cap.areaMM2 - 12 * Math.SQRT2 * 8) < 1e-3, `${cap.areaMM2}`);
  assert.ok(Math.abs(facesArea(c, f => f === cap.index) - 12 * Math.SQRT2 * 8) < 1e-3);
  assert.ok(cap.normal.every((v, k) => Math.abs(v + p.normal[k]) < 1e-6), `the cap faces the cut away side: ${cap.normal}`);
  assert.ok(Math.abs(cap.centroid[0] + cap.centroid[1] - 16) < 1e-4, 'its centre on the plane');
  // (The points its triangles use: clipMesh keeps those of the triangles it drops.)
  for (const v of c.indices) assert.ok(SQ * (c.positions[3 * v] + c.positions[3 * v + 1]) >= p.offset - 1e-4);
  // Wholly kept: the mesh itself; wholly cut: none.
  assert.equal(clipMeshPlane(m, { normal: [SQ, SQ, 0], offset: -5 }, 'cap'), m);
  assert.equal(clipMeshPlane(m, { normal: [SQ, SQ, 0], offset: 40 }, 'cap'), null);
  assert.equal(cutAway(m, { mode: 'plane', planes: [{ normal: [SQ, SQ, 0], offset: 40 }] }), true);
  assert.equal(cutAway(m, { mode: 'plane', planes: [p] }), false);
});

test('G19 a box section on the CPU: every face of what is kept a cap, the inner box\'s surface', () => {
  const m = box().mesh, s = boxSection([0, 0, 0], [20, 12, 8]), c = clipMeshPlanes(m, s.planes, 'cut')!;
  assert.equal(s.planes.length, 6);
  // (Inset a tenth: 16 × 9.6 × 6.4 inside.)
  const want = 2 * (16 * 9.6 + 16 * 6.4 + 9.6 * 6.4), caps = new Set(c.faces.filter(f => f.name === 'cut').map(f => f.index));
  assert.ok(Math.abs(facesArea(c, f => caps.has(f)) - want) < 1e-2, `${facesArea(c, f => caps.has(f))} against ${want}`);
  assert.ok(facesArea(c, f => !caps.has(f)) < 1e-6, 'nothing of the outer faces left');
  assert.deepEqual(s.planes.map(p => planeAxis(p)), [{ k: 0, at: 2, keep: 'positive' }, { k: 0, at: 18, keep: 'negative' }, { k: 1, at: 1.2000000000000002, keep: 'positive' }, { k: 1, at: 10.8, keep: 'negative' }, { k: 2, at: 0.8, keep: 'positive' }, { k: 2, at: 7.2, keep: 'negative' }]);
});

test('G19 the exact section: one axis plane as before; planes chained — each kept piece split by the next — at the closed volumes', () => {
  const doc = rectanglePart(20, 12, 8), bodies = bodiesOf(doc);
  // One axis plane: the document and keys the studio made before (inlined).
  for (const [axis, at, keep] of [['x', 7, 'positive'], ['z', 3, 'negative'], ['y', 30, 'positive'], ['y', -3, 'positive']] as const) {
    const k = 'xyz'.indexOf(axis);
    let old = { ...doc, nodes: [...doc.nodes] }; const oldKept: string[] = [];
    for (const b of bodies) {
      const { min, max } = b.mesh.bounds;
      if (min[k] < at - 1e-6 && max[k] > at + 1e-6) { old = withNode(old, { kind: 'split', parent: refOf(b), axis, at }); oldKept.push(bodyKeyFor(old.nodes, old.nodes.length - 1, keep)); }
      else if (keep === 'negative' ? max[k] <= at + 1e-6 : min[k] >= at - 1e-6) oldKept.push(b.key);
    }
    assert.deepEqual(sectionSplits(doc, bodies, axisSection({ axis, at, keep })), { doc: old, kept: oldKept });
  }
  const volume = (s: Section) => {
    const r = sectionSplits(doc, bodies, s), e = evaluateDoc(r.doc, 1);
    assert.ok(e.ok, JSON.stringify(e));
    return { kept: e.bodies.filter(b => r.kept.includes(b.key)).map(b => b.volumeMM3 ?? 0), splits: r.doc.nodes.length - doc.nodes.length };
  };
  // An oblique plane (x + y ≥ 16): a trapezoid of 120 mm² × 8.
  const oblique = volume({ mode: 'plane', planes: [{ normal: [SQ, SQ, 0], offset: 16 * SQ }] });
  assert.equal(oblique.splits, 1); assert.equal(oblique.kept.length, 1);
  assert.ok(Math.abs(oblique.kept[0] - 960) < 1e-3, `${oblique.kept}`);
  // A box section: six splits, the inner box kept.
  const inner = volume(boxSection([0, 0, 0], [20, 12, 8]));
  assert.equal(inner.splits, 6); assert.equal(inner.kept.length, 1);
  assert.ok(Math.abs(inner.kept[0] - 16 * 9.6 * 6.4) < 1e-3, `${inner.kept}`);
  // Two planes, the second past what the first left: one split, the piece kept.
  const two = volume({ mode: 'planes', planes: [axisPlane('x', 10, 'positive'), { normal: [SQ, SQ, 0], offset: 2 * SQ }] });
  assert.equal(two.splits, 1); assert.ok(Math.abs(two.kept[0] - 10 * 12 * 8) < 1e-6);
  // Wholly cut away by a plane: nothing kept.
  assert.deepEqual(volume({ mode: 'planes', planes: [axisPlane('x', 10, 'positive'), axisPlane('x', 5, 'negative')] }).kept, []);
});

test('G19 a plane from a face: the face\'s plane, the material behind it kept, moved in to the middle along it', () => {
  const p = planeFromFace({ normal: [0, 0, 1], centroid: [10, 6, 8], name: 'n1.top' }, { min: [0, 0, 0], max: [20, 12, 8] });
  assert.deepEqual(p.normal, [-0, -0, -1]); assert.equal(p.offset, -4); assert.equal(p.face, 'n1.top'); assert.equal(p.axis, 'z');
  const q = planeFromFace({ normal: [SQ, SQ, 0], centroid: [10, 6, 4], name: 'f' }, { min: [0, 0, 0], max: [20, 12, 8] });
  assert.ok(Math.abs(q.offset - (-16 * SQ + -0 * SQ) / 2) < 1e-9, `${q.offset}`); assert.equal(q.axis, undefined);
});
