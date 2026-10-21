import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateDoc } from '@barocss/cad-model/engine/evaluate';
import { rectanglePart } from '@barocss/cad-model/engine/doc';
import { bodyMass, combined, inertiaAbout } from '../src/app/mass';

test('mass: a block\'s inertia about its centre and about a corner, in steel; two bodies\' centre of mass', () => {
  const r = evaluateDoc(rectanglePart(40, 20, 10), 1); assert.ok(r.ok);
  const steel = bodyMass(r.bodies[0], 7.85)!, m = 40 * 20 * 10 * 7.85 / 1e6; // kg
  assert.ok(Math.abs(steel.massG - m * 1000) < 1e-6);
  // A box: Izz = m (a² + b²) / 12 (kg·mm²).
  const izz = m * (40 * 40 + 20 * 20) / 12, ixx = m * (20 * 20 + 10 * 10) / 12;
  assert.ok(Math.abs(steel.inertia[2][2] - izz) < 1e-6 * izz, `${steel.inertia[2][2]} vs ${izz}`);
  assert.ok(Math.abs(steel.inertia[0][0] - ixx) < 1e-6 * ixx);
  // About the corner at the origin: + m (20² + 10²) about Z.
  const corner = inertiaAbout(steel.inertia, steel.massG, steel.centroid, [0, 0, 0]);
  assert.ok(Math.abs(corner[2][2] - (izz + m * (20 * 20 + 10 * 10))) < 1e-6 * izz);
  assert.ok(Math.abs(corner[0][1] - (-m * 20 * 10)) < 1e-6 * izz, 'a product of inertia appears');
  assert.deepEqual(combined([{ massG: 1, centroid: [0, 0, 0] }, { massG: 3, centroid: [4, 0, 0] }]), { massG: 4, centroid: [3, 0, 0] });
});
