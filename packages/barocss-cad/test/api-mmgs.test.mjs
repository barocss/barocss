// Independent MMGS oracle from the frozen R7 window contract; no core-derived expected values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part } from '../dist/api/index.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-9, `${actual} != ${expected}`);
test('10 mm cube at 2.7 g/cm3: 1000 mm3, 2.7 g and diagonal inertia 45 g*mm2', () => {
  const p = part().box({ w: 10, d: 10, h: 10 }), before = JSON.stringify(p.doc), m = p.mass({ density: 2.7 });
  assert.deepEqual(Object.keys(m), ['volume', 'mass', 'centroid', 'inertia']);
  close(m.volume, 1000); close(m.mass, 2.7);
  m.centroid.forEach(v => close(v, 5));
  m.inertia.forEach((row, i) => row.forEach((v, j) => close(v, i === j ? 45 : 0)));
  assert.equal(JSON.stringify(p.doc), before);
});
