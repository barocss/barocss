import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrep, lineCurve, checkBrep, evaluateCadPart } from '../dist/index.js';

// A sheet of one planar face bounded by line edges through `pts` (in order), on the plane z = 0 unless `surface` is given.
function sheet(pts, { surface, tol } = {}) {
  const vertices = pts.map((p, k) => ({ id: `v${k}`, point: p }));
  const edges = pts.map((p, k) => ({ id: `e${k}`, curve: lineCurve(`e${k}`, p, pts[(k + 1) % pts.length]), vertices: [`v${k}`, `v${(k + 1) % pts.length}`] }));
  const plane = surface ?? { kind: 'surface', id: 'p', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[-20, -20, 0], [-20, 20, 0]], [[20, -20, 0], [20, 20, 0]]], weights: [[1, 1], [1, 1]] };
  return buildBrep({ source: { family: 'test', id: 's' }, vertices, edges, ...(tol ? { toleranceMM: tol } : {}),
    bodies: [{ id: 'b', kind: 'sheet', shells: [{ id: 's', closed: false, faces: [{ id: 'f', surface: plane, sense: 'forward', loops: [{ kind: 'outer', uses: edges.map(e => ({ edge: e.id, sense: 'forward' })) }] }] }] }] });
}
const square = [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]];

test('strict L0: a clean sheet and the corpus\'s models pass; the default check stays as it was', () => {
  const r = checkBrep(sheet(square), { strict: true });
  assert.equal(r.valid, true, r.issues[0]); assert.equal(r.maximumEdgeSurfaceGapMM, 0);
  const box = evaluateCadPart({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: 's', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 }, { id: 'c', kind: 'extrude', sketch: 's', height: 10 }] }).outputs[0].brep;
  assert.equal(checkBrep(box, { strict: true }).valid, true);
  assert.equal(checkBrep(box).maximumEdgeSurfaceGapMM, 0, 'not measured unless strict');
});

test('strict L0: an edge off its face\'s surface, a crossing loop, a sliver and a blown-up tolerance are each reported', () => {
  // The face's plane lifted 0.5 mm: every edge is off it.
  const lifted = { kind: 'surface', id: 'p', degreeU: 1, degreeV: 1, knotsU: [0, 0, 1, 1], knotsV: [0, 0, 1, 1], controlPoints: [[[-20, -20, 0.5], [-20, 20, 0.5]], [[20, -20, 0.5], [20, 20, 0.5]]], weights: [[1, 1], [1, 1]] };
  const off = checkBrep(sheet(square, { surface: lifted }), { strict: true });
  assert.ok(off.issues.some(i => /^geometry: edge e\d is 5\.00e-1 mm off the surface of face \S*f$/.test(i)), off.issues[0]);
  assert.ok(Math.abs(off.maximumEdgeSurfaceGapMM - 0.5) < 1e-12);
  // A bow tie: its loop crosses itself.
  const bow = checkBrep(sheet([[0, 0, 0], [10, 10, 0], [10, 0, 0], [0, 10, 0]]), { strict: true });
  assert.ok(bow.issues.some(i => /loops cross or touch/.test(i)), bow.issues.join('; '));
  // 10 mm long, 1e-9 mm wide.
  const sliver = checkBrep(sheet([[0, 0, 0], [10, 0, 0], [10, 1e-9, 0], [0, 1e-9, 0]], { tol: 1e-7 }), { strict: true });
  assert.ok(sliver.issues.some(i => /is a sliver/.test(i)), sliver.issues.join('; '));
  // A tolerance of 1 mm on a 10 mm sheet (the cap: 1e-3 of the size).
  const loose = checkBrep(sheet(square, { tol: 1 }), { strict: true });
  assert.ok(loose.issues.some(i => /^tolerance: edge e0 tolerance 1 mm is past the cap/.test(i)), loose.issues.join('; '));
  for (const r of [off, bow, sliver, loose]) assert.equal(r.valid, false);
});
