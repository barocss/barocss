import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as cad from '../dist/index.js';
import { forAll, properties, random } from '../scripts/rb/property.mjs';

test('property harness: a seed repeats its cases; a failing property shrinks to its smallest counterexample', () => {
  const a = random(7), b = random(7); for (let k = 0; k < 5; k++) assert.equal(a(), b());
  // "Every integer below 100 is below 50", false from 50 on: shrinking by one and by halves ends at 50 exactly.
  const r = forAll({ name: 'below 50', runs: 200, seed: 3, gen: rnd => Math.floor(rnd() * 100), shrink: x => [x - 1, Math.floor(x / 2)].filter(y => y >= 0), prop: x => x < 50 });
  assert.ok(r.failed, 'found'); assert.equal(r.failed.smallest, 50);
  // A crash is a failure too, with its message.
  const c = forAll({ name: 'crash', runs: 3, seed: 1, gen: () => 1, shrink: () => [], prop: () => { throw new TypeError('boom'); } });
  assert.deepEqual(c.failed.why, { crash: 'boom' });
});

test('kernel properties: a quick slice (5 runs each, fixed seed); failures only where robustness/properties-todo.json says', () => {
  const todo = JSON.parse(readFileSync(new URL('../robustness/properties-todo.json', import.meta.url), 'utf8'));
  for (const p of properties(cad)) {
    const r = forAll({ ...p, runs: 5, seed: 20261018 });
    if (r.failed) assert.ok(todo.some(t => p.name.startsWith(t.property)), `${p.name}: ${JSON.stringify(r.failed.smallest)} ${JSON.stringify(r.failed.why)}`);
  }
});

test('exact oracles (D25): closed forms reproduced; a fixed slice of the families against the kernel', async () => {
  const { cylinderBoxIntersection } = await import('../scripts/rb/oracle-cylinder-box.mjs');
  const { crossedCylinders } = await import('../scripts/rb/oracle-cylinder-pair.mjs');
  const { crossedCase, cylinderBoxCase, grazing, RB4_BOX, RB4_CYLINDER, VOLUME_TOL } = await import('../scripts/rb/oracle-cases.mjs');
  // A box holding the whole cylinder (any turn about Z): π r² h. Half the cylinder (a box cut through its axis): half that.
  const cyl = { cx: 1, cy: 2, r: 3, z0: -1, z1: 4 }, whole = Math.PI * 9 * 5;
  assert.ok(Math.abs(cylinderBoxIntersection(cyl, { min: [-10, -10, -5], max: [10, 10, 10] }, { axis: 'z', angle: 33 }).volume - whole) <= 1e-12 * whole);
  const half = cylinderBoxIntersection(cyl, { min: [1, -10, -5], max: [10, 10, 10] });
  assert.ok(Math.abs(half.volume - whole / 2) <= 1e-12 * whole && Math.abs(half.centroid[0] - (1 + 4 * 3 / (3 * Math.PI))) <= 1e-12);
  // Equal cylinders crossing at α: 16 r³ / (3 sin α).
  for (const a of [90, 40]) assert.ok(Math.abs(crossedCylinders(2, 2, a) - 128 / (3 * Math.sin(a * Math.PI / 180))) <= 1e-12 * 100);
  // The kernel against them: each axis at a generic and a near-right angle, a graze, crossed cylinders at 45°.
  const D = f => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: f });
  const cases = [...['x', 'y', 'z'].flatMap(axis => [80.79, 89.99].map(angle => cylinderBoxCase(RB4_CYLINDER, RB4_BOX, axis, angle, 'intersect'))),
    cylinderBoxCase(RB4_CYLINDER, RB4_BOX, 'x', 80.79, 'difference'), cylinderBoxCase(grazing(RB4_CYLINDER, RB4_BOX, 'x', 30, 1e-2), RB4_BOX, 'x', 30, 'intersect'), crossedCase(2.371, 1.583, 45)];
  for (const c of cases) {
    const [o] = cad.evaluateCadPart(D(c.features)).outputs, m = cad.massPropertiesOf(o);
    assert.ok(Math.abs(m.volume - c.volume) <= Math.max(VOLUME_TOL.relTol * c.volume, VOLUME_TOL.absTol), `${JSON.stringify(c.features.at(-2))}: ${m.volume} vs ${c.volume}`);
    assert.ok(Math.hypot(...m.centroid.map((x, k) => x - c.centroid[k])) <= Math.max(1e-6, 1e-11 / c.volume), `centroid ${m.centroid} vs ${c.centroid}`);
  }
});
