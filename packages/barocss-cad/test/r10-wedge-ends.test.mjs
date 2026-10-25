import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkOutput, massPropertiesOf } from '../dist/index.js';

// D98: the wedge chamfer's ends (a straight edge between two planes). A filling (concave) wedge stopped square at its
// ends, adding material past an oblique end face; a cutting (convex) one ran d past both ends, notching a wall there.
// Now each ends in its end face's plane (its corners carried along the edge onto it), a cutting one run past only where
// the body ends.
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const out = f => evaluateCadPart(D(f)).outputs.at(-1);
const at = (b, y, z) => b.edges.find(e => e.curve.degree === 1 && e.curve.controlPoints.every(p => Math.abs(p[1] - y) < 1e-9 && Math.abs(p[2] - z) < 1e-9)).name;
const chamfer = (target, edge, distance) => ({ id: 'c', kind: 'chamfer', target, edges: [edge], distance });

/** A step 40 long between ends x = y tan θ and 40 + y tan θ: blocks 30 and 15 deep, 10 high each; its riser's top rounded 4 or not. */
const step = (deg, round) => {
  const t = Math.tan(deg * Math.PI / 180), q = d => [[0, 0], [40, 0], [40 + d * t, d], [d * t, d]];
  const body = [{ id: 's', kind: 'sketch', profile: 'polygon', points: q(30) }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 },
    { id: 'q', kind: 'sketch', profile: 'polygon', points: q(15) }, { id: 'f0', kind: 'extrude', sketch: 'q', height: 10, from: 10 }, { id: 'u', kind: 'union', target: 'e', tool: 'f0' }];
  return round ? [...body, { id: 'g', kind: 'fillet', target: 'u', edges: [at(out(body).brep, 15, 20)], radius: 4 }] : body;
};

test('D98 the concave wedge chamfer at oblique ends: a step\'s foot (ends at 0°, 10°, 25°; its riser\'s top rounded or not) chamfered 2 and 5 — d²/2 × 40 to 1e-12 (2.6–17 % over before, and invalid on the rounded step at 5)', () => {
  for (const deg of [0, 10, 25]) for (const round of [false, true]) {
    const body = step(deg, round), o0 = out(body), inner = at(o0.brep, 15, 10);
    for (const d of [2, 5]) {
      const o = out([...body, chamfer(round ? 'g' : 'u', inner, d)]), what = `${deg}°, rounded ${round}, d ${d}`;
      assert.equal(checkOutput(o).valid, true, what);
      const got = massPropertiesOf(o).volume - massPropertiesOf(o0).volume;
      assert.ok(Math.abs(got / (d * d / 2 * 40) - 1) < 1e-12, `${what}: ${got}`);
    }
  }
});

test('D98 a rib running into a wall (square, and the wall\'s face turned 10°): its top edge chamfered 2 stops at the wall (it cut 2 mm into it before, 28–30 % over), its foot fills to it — the prism\'s section × its length at the section\'s centroid, to 1e-12', () => {
  for (const deg of [0, 10]) {
    const t = Math.tan(deg * Math.PI / 180), body = [{ id: 'p', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 30] }, { id: 'pe', kind: 'extrude', sketch: 'p', height: 5 },
      { id: 'r', kind: 'sketch', profile: 'rectangle', min: [0, 10], max: [50, 20] }, { id: 're', kind: 'extrude', sketch: 'r', height: 5, from: 5 },
      { id: 'w', kind: 'sketch', profile: 'polygon', points: [[40, 0], [60, 0], [60, 30], [40 + 30 * t, 30]] }, { id: 'we', kind: 'extrude', sketch: 'w', height: 20, from: 5 },
      { id: 'u1', kind: 'union', target: 'pe', tool: 're' }, { id: 'u', kind: 'union', target: 'u1', tool: 'we' }];
    const o0 = out(body), v0 = massPropertiesOf(o0).volume;
    // (The section's centroid at y = 20 ∓ 2/3: the top's triangle inside the rib, the foot's outside it.)
    for (const [what, z, sign, cy] of [['top', 10, -1, 20 - 2 / 3], ['foot', 5, 1, 20 + 2 / 3]]) {
      const o = out([...body, chamfer('u', at(o0.brep, 20, z), 2)]), exact = 2 * (40 + cy * t), got = sign * (massPropertiesOf(o).volume - v0);
      assert.equal(checkOutput(o).valid, true, `${deg}° ${what}`);
      assert.ok(Math.abs(got / exact - 1) < 1e-12, `${deg}° ${what}: ${got} vs ${exact}`);
    }
  }
});
