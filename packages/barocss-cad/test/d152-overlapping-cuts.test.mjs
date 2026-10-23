import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, curveEvaluator, curveDomain } from '../dist/index.js';
import { intersectSegments } from '../dist/brep/curved-arrangement.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// D152 (queue item 5): a Boolean result's exact edges came out in many stitched pieces — the 6° bevel corner (D150) 258
// edges for 9 faces, `p.toe|w.flankR` in 34 pieces, the toe's section by the crop box in 117 (the shortest 4e-5 mm). The
// cause: two parametric cuts lying along each other in a face's domain (one curve copied twice — a face's boundary on the
// other solid's coincident surface and again as its neighbour's edge on that surface; two faces' sections by one plane)
// "crossed" at every polyline sample pair along their overlap, and each such point split both. Now only the ends of a run
// along each other are shared points. Oracle for the geometry: the old and new results' edges lie on each other to 1e-8 and
// their faces' surfaces are the same (checked once for D152's record; volumes by the integrators moved within their own error).

const SURVEY = !!process.env.GEAR_SURVEY;
const arc = (r, a0, a1, cx = 0) => ({ kind: 'curve', f: t => [cx + r * Math.cos(t), r * Math.sin(t)], t0: a0, t1: a1 });

test('D152: two curve cuts along each other share only their run\'s ends; crossings stay crossings', () => {
  const s = arc(10, 0, Math.PI);
  // A copy the other way round, and a copy over part of it: two points each, not one per sample.
  assert.equal(intersectSegments(s, arc(10, Math.PI, 0), 1e-9).length, 2);
  const part = intersectSegments(s, arc(10, Math.PI / 3, 4 * Math.PI / 3), 1e-9).map(p => Math.atan2(p[1], p[0])).sort((a, b) => a - b);
  assert.equal(part.length, 2); assert.ok(Math.abs(part[0] - Math.PI / 3) < 1e-9 && Math.abs(part[1] - Math.PI) < 1e-9, String(part));
  // Two circles crossing at two points (a lens between them, nothing along each other): both crossings.
  const cross = intersectSegments(arc(10, -Math.PI / 2, Math.PI / 2), arc(10, Math.PI / 2, 3 * Math.PI / 2, 12), 1e-9);
  assert.equal(cross.length, 2);
  for (const p of cross) assert.ok(Math.abs(p[0] - 6) < 1e-9 && Math.abs(Math.abs(p[1]) - 8) < 1e-9, String(p));
});

test('D152: the 6° bevel corner — 23 edges for its 9 faces (was 258), each exact edge one piece, none a sliver', () => {
  const c = JSON.parse(readFileSync(join(import.meta.dirname, '../conformance/bp/bevel-6deg-corner.json'), 'utf8'));
  const o = evaluateCadPart(c.input.partDocument).outputs.at(-1), b = o.brep;
  assert.equal(o.validate().valid, true);
  assert.equal(b.faces.length, 9);
  assert.ok(b.edges.length <= 30, `${b.edges.length} edges`);
  const names = b.edges.map(e => (e.name ?? '').replace(/#\d+$/, ''));
  assert.equal(names.filter(n => n === 'p.toe|w.flankR').length, 1, 'the toe edge of the mate\'s flank in one piece');
  const length = e => { const at = curveEvaluator(e.curve), [t0, t1] = curveDomain(e.curve); let L = 0, p = at(t0); for (let i = 1; i <= 64; i++) { const q = at(t0 + (t1 - t0) * i / 64); L += Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); p = q; } return L; };
  const shortest = Math.min(...b.edges.map(length));
  assert.ok(shortest > 1e-3, `the shortest edge ${shortest} mm`);
});

test('D152 survey (GEAR_SURVEY=1): the whole 16/20 pair at 4° and 6° — 48 and 57 edges (were 766 and 809)', { skip: !SURVEY }, () => {
  const D = features => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features });
  const gears = phase => [{ id: 'p', kind: 'bevel-gear', module: 2, teeth: 16, mateTeeth: 20, faceWidth: 6, thicknessReduction: 0.05, rotation: 0, center: [5, -3], from: 2 }, { id: 'w', kind: 'bevel-gear', module: 2, teeth: 20, mateTeeth: 16, faceWidth: 6, thicknessReduction: 0.05, mesh: { gear: 'p', direction: 0, phase } }];
  for (const [phase, most] of [[4, 60], [6, 70]]) {
    const o = evaluateCadPart(D([...gears(phase), { id: 'i', kind: 'intersect', target: 'p', tool: 'w' }])).output('i');
    assert.equal(o.validate().valid, true); assert.ok(o.brep.edges.length <= most, `${phase}°: ${o.brep.edges.length} edges`);
  }
});
