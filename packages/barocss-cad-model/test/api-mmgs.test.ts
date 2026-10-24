// Independent aggregate gate: this must run against Outer's converted evaluation/bodyMass contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part } from '../src/api';

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 1e-9, `${actual} != ${expected}`);
test('model facade cube keeps the MMGS mass and inertia without another conversion', () => {
  const p = part().box({ w: 10, d: 10, h: 10 }).material('al6061'), before = JSON.stringify(p.doc), m = p.mass();
  assert.deepEqual(Object.keys(m), ['volume', 'mass', 'centroid', 'inertia']);
  close(m.volume, 1000); close(m.mass, 2.7);
  m.centroid.forEach(v => close(v, 5));
  m.inertia.forEach((row, i) => row.forEach((v, j) => close(v, i === j ? 45 : 0)));
  assert.equal(JSON.stringify(p.doc), before);
});
