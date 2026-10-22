import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestDistance2, triangleBvh } from '@barocss/cad';
import { evaluateDoc } from '../src/engine/evaluate';
import { emptyDoc, starterDoc, withNode, type StudioDoc } from '../src/engine/doc';
import { commands, type Ctx } from '../src/app/commands';
import { searchOrientation } from '../src/print/orient';
import { printLayers, type LayerLoop } from '../src/print/layers';

// G23's data side, A: a print's layers. A 20 mm cube at 0.2 mm: 100 layers, each one anticlockwise square of 400 mm². The
// starter plate's Ø8 hole: an outer loop and a clockwise hole between the inscribed polygon's area and π·16. The cube
// printed along (1, 0, 1): its two lower faces lean 45° — no overhang at a 45° limit, all of them at 40°, merged per layer
// into one region. A sphere along AM4's best direction: the columns' volume AM4's support volume. Every contour point
// mapped back through the 4×4 lies on the model's mesh. A layer is worked out once.
const box = (x: number, y: number, z: number): StudioDoc => withNode(withNode(emptyDoc(), { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [x, y] } as never), { kind: 'extrude', sketch: 0, height: z } as never);
const meshOf = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok, r.ok ? '' : r.error.detail); return r; };
const area = (l: LayerLoop) => { let a = 0; const p = l.points, n = p.length / 2; for (let i = 0; i < n; i++) { const j = (i + 1) % n; a += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; } return a / 2; };

test('A: a 20 mm cube at 0.2 mm — 100 layers, each one anticlockwise square of 400 mm²; no overhang, no support; the 4×4 is +Z\'s', () => {
  const L = printLayers([meshOf(box(20, 20, 20)).bodies[0].mesh], { layerMM: 0.2 });
  assert.deepEqual([L.count, L.layerMM, L.directionSource, L.supportColumns.length], [100, { mm: 0.2, basis: 'set' }, 'default', 0]);
  assert.deepEqual(L.modelToBed, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  for (const k of [0, 50, 99]) {
    const l = L.layer(k);
    assert.ok(Math.abs(l.z - (k + 0.5) * 0.2) < 1e-12);
    assert.equal(l.contours.length, 1); assert.ok(!l.contours[0].hole && Math.abs(area(l.contours[0]) - 400) < 1e-6, String(area(l.contours[0])));
    assert.deepEqual([l.overhang, l.support], [[], []]);
  }
  assert.equal(L.layer(7), L.layer(7), 'kept');
  assert.throws(() => L.layer(100), /no layer 100/);
});

test('A: the starter plate\'s Ø8 hole — an outer loop and a clockwise hole, its area between the inscribed polygon\'s and π·16', () => {
  const L = printLayers([meshOf(starterDoc()).bodies[0].mesh]), l = L.layer(10);
  assert.deepEqual(L.layerMM, { mm: 0.2, basis: 'estimate' });
  const outer = l.contours.filter(c => !c.hole), holes = l.contours.filter(c => c.hole);
  assert.equal(outer.length, 1); assert.equal(holes.length, 1);
  assert.ok(area(outer[0]) > 0 && area(holes[0]) < 0, 'outer anticlockwise, hole clockwise');
  // (Its sides: the loop's corners less the points the strips' diagonals put on a chord, in line with their neighbours.)
  const q = holes[0].points, m = q.length / 2;
  let n = 0; for (let i = 0; i < m; i++) { const a = (i + m - 1) % m, c = (i + 1) % m; if (Math.abs((q[2 * i] - q[2 * a]) * (q[2 * c + 1] - q[2 * i + 1]) - (q[2 * i + 1] - q[2 * a + 1]) * (q[2 * c] - q[2 * i])) > 1e-9) n++; }
  const inscribed = n / 2 * 16 * Math.sin(2 * Math.PI / n);
  assert.ok(-area(holes[0]) <= Math.PI * 16 + 1e-9 && -area(holes[0]) >= inscribed - 1e-6, `${-area(holes[0])} of π·16 = ${Math.PI * 16}`);
});

test('A: the cube along (1, 0, 1) — its lower faces lean 45°: no overhang at 45°, all at 40° (one region a layer); every contour point back on the mesh', () => {
  const mesh = meshOf(box(20, 20, 20)).bodies[0].mesh, dir = [Math.SQRT1_2, 0, Math.SQRT1_2];
  assert.equal(printLayers([mesh], { direction: dir, limitDeg: 45 }).supportColumns.length, 0);
  const L = printLayers([mesh], { direction: dir, limitDeg: 40 }), mid = L.layer(Math.floor(L.count / 4));
  assert.ok(L.supportColumns.length > 0 && L.supportVolumeMM3 > 0);
  assert.equal(mid.overhang.filter(r => !r.hole).length, 1, 'the two faces\' strips merged');
  // (Back through the 4×4: bed → model is its inverse — the turn's transpose, then the offset.)
  const M = L.modelToBed, bvh = triangleBvh(Float64Array.from(mesh.positions), mesh.indices);
  for (const k of [3, Math.floor(L.count / 2), L.count - 4]) {
    const l = L.layer(k);
    for (const c of l.contours) for (let i = 0; i < c.points.length; i += 2) {
      const x = c.points[i], y = c.points[i + 1], z = l.z - M[14];
      const p = [M[0] * x + M[1] * y + M[2] * z, M[4] * x + M[5] * y + M[6] * z, M[8] * x + M[9] * y + M[10] * z];
      assert.ok(nearestDistance2(bvh, p[0], p[1], p[2]) < 1e-9, `layer ${k}: ${p} off the mesh`);
    }
  }
});

test('A: a sphere along AM4\'s best direction — the support columns\' volume is AM4\'s support volume; each column footprint × height sums to it', () => {
  const sphere = commands.find(c => c.id === 'sphere')!, blank: Ctx = { doc: emptyDoc(), bodies: [], selection: { faces: [], edges: [], bodies: [] } };
  const r = meshOf(sphere.build!(blank, { ...sphere.defaults!(blank), r: 10 })), mesh = r.bodies[0].mesh;
  const am4 = searchOrientation(mesh, r.faceTable!, 45).best, support = am4.supportMM3 ?? 0;
  assert.ok(support > 0, 'a ball needs support');
  const L = printLayers([mesh], { direction: am4.direction, limitDeg: 45 });
  assert.ok(Math.abs(L.supportVolumeMM3 - support) <= 1e-9 * support, `${L.supportVolumeMM3} vs AM4 ${support}`);
  const sum = L.supportColumns.reduce((t, c) => { const f = c.footprint; return t + Math.abs((f[0] * (f[3] - f[5]) + f[2] * (f[5] - f[1]) + f[4] * (f[1] - f[3])) / 2) * (c.z1 - c.z0); }, 0);
  assert.ok(Math.abs(sum - L.supportVolumeMM3) <= 1e-9 * sum, `${sum}`);
  assert.ok(L.layer(2).support.length > 0, 'a low layer has support under the ball');
});
