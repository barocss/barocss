import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, booleanAnalytic, brepFromPrismatic, prismaticFromProfile, brepMassProperties, tessellateBrep, voxelInsideFlags, checkBrep, outputOf, massPropertiesOf, checkOutput } from '../dist/index.js';

// D150 (queue item 3, D134): the 16/20 straight bevel pair turned 6° off — its exact intersection refused "not a manifold
// solid … the inputs touch along an edge". The cause: a general face's map of a curve into its domain (a Hermite table)
// took one tangent at a sample on a C0 knot of the edge — and the flank's own surface is two spans joined C0 along the
// same line — so the intervals either side were up to 1.75e-3 mm off. Where the two flanks' cut met that edge, the edge
// was split 1e-3 mm from the cut's end: a sliver edge used once. Oracle: the volume against a voxel count of the two
// tessellated bodies (K6, ray parity), which never touches the analytic Boolean.

const SURVEY = !!process.env.GEAR_SURVEY;
const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
const gears = phase => [{ id: 'p', kind: 'bevel-gear', module: 2, teeth: 16, mateTeeth: 20, faceWidth: 6, thicknessReduction: 0.05, rotation: 0, center: [5, -3], from: 2 }, { id: 'w', kind: 'bevel-gear', module: 2, teeth: 20, mateTeeth: 16, faceWidth: 6, thicknessReduction: 0.05, mesh: { gear: 'p', direction: 0, phase } }];
const rect = (x0, y0, x1, y1) => [{ kind: 'line', start: [x0, y0] }, { kind: 'line', start: [x1, y0] }, { kind: 'line', start: [x1, y1] }, { kind: 'line', start: [x0, y1] }];
/** The volume inside both bodies by a voxel count over [lo, hi] at spacing h (the grid offset irrationally off the bodies' features). */
function voxelVolume(A, B, lo, hi, h) {
  const n = [0, 1, 2].map(k => Math.ceil((hi[k] - lo[k]) / h)), o = lo.map((x, k) => x + h * [0.3183, 0.2718, 0.1414][k]);
  const flags = br => { const t = tessellateBrep(br, { segmentsPerQuarter: 32 }); return voxelInsideFlags(t.positions, t.indices, o, h, n); };
  const fa = flags(A), fb = flags(B); let c = 0; for (let i = 0; i < fa.length; i++) if (fa[i] && fb[i]) c++;
  return c * h ** 3;
}

test('D150: the 6° bevel pair\'s failing corner, cropped to a 1.6 mm box (7 and 11 faces) — its intersection valid, its volume the voxel count\'s', () => {
  const s = evaluateCadPart(D(gears(6))), c = [18.172, -3.6773, 16.515], h = 0.8;
  const box = brepFromPrismatic(prismaticFromProfile({ outer: rect(c[0] - h, c[1] - h, c[0] + h, c[1] + h), height: 2 * h, from: c[2] - h, tag: 'x' }), { id: 'x' });
  const a = booleanAnalytic(outputOf(s, 'p').brep, box, 'intersection'), b = booleanAnalytic(outputOf(s, 'w').brep, box, 'intersection');
  assert.deepEqual([a.faces.length, b.faces.length], [7, 11]);
  // Where the two flanks and their common toe sphere meet: the corner at (18.172013, −3.677343, 16.515141).
  const r = booleanAnalytic(a, b, 'intersection'), report = checkBrep(r);
  assert.equal(report.valid, true, report.issues[0]);
  const v = brepMassProperties(r, 1).volume, voxel = voxelVolume(a, b, c.map(x => x - h), c.map(x => x + h), 0.005);
  // (The voxel count converges from below at about 0.33 h mm³ per mm: 0.7003, 0.7037, 0.7053 at h 0.01, 0.005, 0.0025.)
  assert.ok(Math.abs(v - voxel) <= 5e-3 * v, `${v} vs the voxel count's ${voxel}`);
});

test('D150 survey (GEAR_SURVEY=1): the whole 16/20 pair at 3°, 4°, 5°, 6° and 9° off — each intersection valid, growing with the phase', { skip: !SURVEY }, () => {
  let last = 0;
  for (const phase of [3, 4, 5, 6, 9]) {
    const o = outputOf(evaluateCadPart(D([...gears(phase), { id: 'i', kind: 'intersect', target: 'p', tool: 'w' }])), 'i'), v = massPropertiesOf(o).volume;
    assert.equal(checkOutput(o).valid, true, `${phase}°`);
    assert.ok(v > last, `${phase}°: ${v} after ${last}`); last = v;
  }
});
