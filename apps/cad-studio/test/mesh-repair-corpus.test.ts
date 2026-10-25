import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnoseMesh, repairMesh } from '@barocss/cad';
import { brokenVariants, organicTorus } from './bench/mesh-fixtures';

// M3 (R3.4) against the M0 broken set (bench/mesh-fixtures.ts, a 20k-triangle organic torus): each defect diagnosed
// and repaired with the report it should give; the volume where repair restores the mesh exactly.
const volumeOf = (P: ArrayLike<number>, I: ArrayLike<number>) => { let v = 0; for (let t = 0; t < I.length; t += 3) { const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2]; v += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]); } return v / 6; };
const base = organicTorus(100, 100), whole = volumeOf(base.positions, base.indices), set = new Map(brokenVariants(base).map(f => [f.name, f]));

test('M0 broken set: each defect found and repaired as expected', () => {
  const run = (name: string) => { const f = set.get(name)!; return { d: diagnoseMesh(f.positions, f.indices), r: repairMesh(f.positions, f.indices) }; };
  const clean = diagnoseMesh(base.positions, base.indices);
  assert.ok(clean.closed && !clean.selfIntersections, 'the base is clean');
  { // 20 triangles out: one hole, filled; closed; the volume back within the patch's sag.
    const { d, r } = run('broken-hole');
    assert.equal(d.holes.length, 1); assert.equal(d.closed, false);
    assert.deepEqual([r.report.holesFilled, r.report.closed], [1, true]);
    assert.ok(Math.abs(volumeOf(r.positions, r.indices) - whole) < 0.01 * whole);
  }
  { // 50 triangles wound the wrong way: turned back, exactly.
    const { d, r } = run('broken-flipped');
    assert.ok(d.inconsistentEdges > 0);
    assert.deepEqual([r.report.flipped, r.report.closed], [50, true]);
    assert.ok(Math.abs(volumeOf(r.positions, r.indices) - whole) < 1e-9 * whole);
  }
  { // A fin on an edge: dropped (a duplicate pair, so one triangle left, then the fin), exactly.
    const { d, r } = run('broken-nonmanifold');
    assert.equal(d.nonManifoldEdges, 1);
    assert.deepEqual([r.report.finsRemoved, r.report.nonManifoldEdgesLeft, r.report.closed], [1, 0, true]);
    assert.ok(Math.abs(volumeOf(r.positions, r.indices) - whole) < 1e-9 * whole);
  }
  { // Ten zero-area triangles: dropped.
    const { d, r } = run('broken-degenerate');
    assert.equal(d.degenerate, 10);
    assert.deepEqual([r.report.degenerateRemoved, r.report.closed], [10, true]);
  }
  { // Three small boxes beside it: floaters, dropped with their volume.
    const { d, r } = run('broken-shells');
    assert.deepEqual([d.pieces, d.floaters], [4, 3]);
    assert.deepEqual([r.report.floatersRemoved, +r.report.floaterVolume.toFixed(6)], [3, 24]);
  }
  { // A box through the wall: crossings found, not repaired.
    const { d, r } = run('broken-selfintersect');
    assert.ok(d.selfIntersections > 0); assert.ok(r.report.selfIntersections > 0);
  }
});

test('a repair as a recorded step on the mesh node: the import kept, the result its own blobs, fill faces named, the container round trip; removed, the mesh as imported', async () => {
  const { DEFAULT_REPAIR: steps } = await import('@barocss/cad');
  const { meshNodeBlobs, putBlob, positionsArray, blobRefs } = await import('@barocss/cad-model/engine/blobs');
  const { encodeStudioFile, readStudioFile } = await import('@barocss/cad-model/engine/container');
  const { evaluateDoc } = await import('@barocss/cad-model/engine/evaluate');
  const { emptyDoc, withNode } = await import('@barocss/cad-model/engine/doc');
  const f = set.get('broken-hole')!, r = repairMesh(f.positions, f.indices, steps);
  const base = await meshNodeBlobs({ kind: 'mesh' as const, name: 'torus', unit: 'mm', representation: 'facets' as const }, f.positions, f.indices);
  const result = { positions: await putBlob(positionsArray(r.positions)), indices: await putBlob(r.indices), fill: await putBlob(r.fill) };
  const doc = withNode(emptyDoc(), { ...base, repair: { steps, result, report: r.report } });
  assert.equal(blobRefs(doc).size, 5, 'the import and the result side by side');
  const e = evaluateDoc(doc, 1); assert.ok(e.ok, e.ok ? '' : e.error.hint);
  assert.ok(e.bodies[0].mesh.faces.some(x => /\.fill0\.region\d+$/.test(x.name)), 'the fill is a face of its own');
  assert.ok(Math.abs(e.bodies[0].volume! - volumeOf(r.positions, r.indices)) < 1e-6);
  const back = await readStudioFile(encodeStudioFile(doc)); assert.ok('doc' in back, JSON.stringify(back));
  const e2 = evaluateDoc(back.doc, 2); assert.ok(e2.ok);
  assert.ok(Math.abs(e2.bodies[0].volume! - e.bodies[0].volume!) < 1e-9);
  // Without the record: the mesh as imported, which is open — refused, not faked closed.
  const asImported = evaluateDoc(withNode(emptyDoc(), base), 3);
  assert.ok(!asImported.ok);
});
