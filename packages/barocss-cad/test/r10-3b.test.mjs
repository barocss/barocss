import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCadPart, checkOutput, massPropertiesOf } from '../dist/index.js';

// R10.3b (D93): corners of three finished edges. All three concave between planes — a pocket's corner — the ball in the
// air touching all three: its eighth, as the all-convex box corner has had (D22). The two ways round — a boss's upright
// edge and its foot, an L-plate's inner upright edge and its top — in two passes: the odd one out first, then the others,
// which then run tangentially round its round. Checked against the closed forms (Pappus about each round's axis).
const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
const out = f => evaluateCadPart(D(f)).outputs.at(-1);
const fillet = (target, edges, radius, id = 'f') => ({ id, kind: 'fillet', target, edges, radius });
// A straight fillet's section A = (1 − π/4) r², its first moment about the corner's line M = r³ (5/6 − π/4); a quarter
// turn of it about an axis a distance ρ from that line: (π/2)(ρ A ± M); two square straight fillets mitred overlap by
// r³ (5/3 − π/2); a corner ball's eighth leaves (1 − π/6) r³ of its cube.
const A = r => (1 - Math.PI / 4) * r * r, M = r => r ** 3 * (5 / 6 - Math.PI / 4), mitre = r => r ** 3 * (5 / 3 - Math.PI / 2), cube = r => (1 - Math.PI / 6) * r ** 3;

const boss = [{ id: 'ps', kind: 'sketch', profile: 'rectangle', min: [-30, -30], max: [30, 30] }, { id: 'p', kind: 'extrude', sketch: 'ps', height: 10 },
  { id: 'bs', kind: 'sketch', profile: 'rectangle', min: [-10, -6], max: [10, 6] }, { id: 'b', kind: 'extrude', sketch: 'bs', height: 15, from: 10 }, { id: 'u', kind: 'union', target: 'p', tool: 'b' }];

test('R10.3b a pocket\'s floor and upright edges (all concave, between planes): a ball\'s eighth at each of its four corners — the added volume to its closed form to 2e-6 of the fillet (3e-4 before R10.B: the ball\'s pole in its patch)', () => {
  const pocket = [{ id: 'bs', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] }, { id: 'b', kind: 'extrude', sketch: 'bs', height: 20 },
    { id: 'ps', kind: 'sketch', profile: 'rectangle', min: [15, 10], max: [45, 30] }, { id: 'p', kind: 'extrude', sketch: 'ps', height: 15, from: 10 }, { id: 'c', kind: 'difference', target: 'b', tool: 'p' }];
  const o0 = out(pocket), edges = o0.brep.edges.filter(e => e.name.split('|').every(n => /^p\./.test(n))).map(e => e.name), r = 2;
  assert.equal(edges.length, 8);
  const o = out([...pocket, fillet('c', edges, r)]);
  assert.equal(checkOutput(o).valid, true);
  const got = massPropertiesOf(o).volume - massPropertiesOf(o0).volume, exact = A(r) * (2 * (30 - 2 * r) + 2 * (20 - 2 * r) + 4 * (10 - r)) + 4 * cube(r);
  // (The corner patches held their ball's pole, where the quadrature over a trimmed domain was least accurate — 3e-4 of
  // the fillet, D22/D93; turned off it since R10.B, 8e-7, D99.)
  assert.ok(Math.abs(got / exact - 1) < 2e-6, `${got} vs ${exact} (${got / exact - 1})`);
  assert.ok(o.brep.faces.some(f => /^f\.face/.test(f.name) && f.surface.degreeU === 2 && f.surface.degreeV === 2), 'a spherical corner face');
});

test('R10.3b a box boss\'s foot with its upright edges, the two ways round at each corner: the uprights rounded first, then the foot round them — to the closed form (straight foot, a torus quarter round each rounded corner, the uprights\' rounds), and the same as the two fillets one after the other', () => {
  const o0 = out(boss), b = o0.brep, v0 = massPropertiesOf(o0).volume, r = 2;
  const foot = b.edges.filter(e => /p\.top/.test(e.name) && /b\.side/.test(e.name)).map(e => e.name), up = b.edges.filter(e => e.name.split('|').every(n => /^b\.side/.test(n))).map(e => e.name);
  const torus = Math.PI / 2 * (r * A(r) + M(r)), rolled = Math.PI / 2 * M(r);
  for (const [what, edges, exact] of [['four uprights', [...foot, ...up], A(r) * (64 - 8 * r) + 4 * torus - 4 * A(r) * 15], ['one upright', [...foot, up[0]], A(r) * (64 - 2 * r) + torus + 3 * rolled - A(r) * 15]]) {
    const o = out([...boss, fillet('u', edges, r)]);
    assert.equal(checkOutput(o).valid, true, what);
    const got = massPropertiesOf(o).volume - v0;
    assert.ok(Math.abs(got / exact - 1) < 1e-8, `${what}: ${got} vs ${exact} (${got / exact - 1})`);
  }
  // The same as rounding the uprights, then the foot round them, in two features.
  const s1 = [...boss, fillet('u', up, r)], b1 = out(s1).brep, foot2 = b1.edges.filter(e => /p\.top/.test(e.name) && /(b\.side|f\.face)/.test(e.name)).map(e => e.name);
  const two = massPropertiesOf(out([...s1, fillet('f', foot2, r, 'g')])).volume, one = massPropertiesOf(out([...boss, fillet('u', [...foot, ...up], r)])).volume;
  assert.ok(Math.abs(two - one) < 1e-9 * one, `${one} vs ${two}`);
});

test('R10.3b an L-plate\'s top with its inner upright edge (concave among convex): the upright rounded first, then the top round it — to the closed form (a convex torus quarter round the concave round, five mitres)', () => {
  const L = [{ id: 's', kind: 'sketch', profile: 'polygon', points: [[0, 0], [40, 0], [40, 20], [20, 20], [20, 40], [0, 40]] }, { id: 'e', kind: 'extrude', sketch: 's', height: 10 }];
  const o0 = out(L), top = o0.brep.edges.filter(e => /e\.top/.test(e.name)).map(e => e.name), inner = o0.brep.edges.find(e => /e\.side2/.test(e.name) && /e\.side3/.test(e.name)).name, r = 2;
  const o = out([...L, fillet('e', [...top, inner], r)]);
  assert.equal(checkOutput(o).valid, true);
  const removed = massPropertiesOf(o0).volume - massPropertiesOf(o).volume, exact = -A(r) * 10 + A(r) * (160 - 2 * r) - 5 * mitre(r) + Math.PI / 2 * (r * A(r) + M(r));
  assert.ok(Math.abs(removed / exact - 1) < 5e-8, `${removed} vs ${exact} (${removed / exact - 1})`);
});
