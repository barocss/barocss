import test from 'node:test';
import assert from 'node:assert/strict';
import { OrbitCamera } from '../src/viewport/camera';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';

// R1b's projector: project keeps its view-projection until the camera moves. Each value it depends on, changed in place
// after a projection, must give what a camera made fresh with the same values projects — bit for bit.

const points: Vec3[] = [[0, 0, 0], [32, 16, 4], [-40, 25, 60], [100, -3, -20]];
const same = (a: OrbitCamera, b: OrbitCamera) => {
  for (const p of points) assert.deepEqual(a.project(p, 800, 600), b.project(p, 800, 600));
};
const fresh = (c: OrbitCamera): OrbitCamera => {
  const f = new OrbitCamera();
  f.target = [...c.target]; f.distance = c.distance; f.yaw = c.yaw; f.pitch = c.pitch; f.fovY = c.fovY; f.ortho = c.ortho; f.aspect = c.aspect;
  return f;
};
const changes: [string, (c: OrbitCamera) => void][] = [
  ['target[0] in place', c => { c.target[0] += 5; }],
  ['target[1] in place', c => { c.target[1] -= 7; }],
  ['target[2] in place', c => { c.target[2] += 1.5; }],
  ['target replaced', c => { c.target = [1, 2, 3]; }],
  ['distance', c => { c.distance *= 1.3; }],
  ['yaw', c => { c.yaw += 0.2; }],
  ['pitch', c => { c.pitch -= 0.1; }],
  ['fovY', c => { c.fovY *= 0.8; }],
  ['ortho', c => { c.ortho = !c.ortho; }],
  ['aspect', c => { c.aspect = 1.6; }],
  ['orbit', c => { c.orbit(30, -12); }],
  ['pan', c => { c.pan(40, 25, 600); }],
  ['zoom', c => { c.zoom(0.7, 0.3, -0.2); }],
  ['fit', c => { c.fit([-10, -10, 0], [10, 20, 5]); }],
  ['setView', c => { c.setView('front'); }],
];

for (const [name, change] of changes) test(`camera.project after ${name}: the same as a fresh camera's`, () => {
  const c = new OrbitCamera(); c.aspect = 4 / 3;
  same(c, fresh(c));
  change(c);
  same(c, fresh(c));
  // (And again, from the kept matrix.)
  same(c, fresh(c));
});

test('camera.project: the same matrix as viewProjection', () => {
  const c = new OrbitCamera(); c.aspect = 1.25; c.orbit(10, 5);
  const m = c.viewProjection(), p: Vec3 = [12, -4, 9];
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  assert.equal(c.project(p, 800, 600)[0], (x / w * 0.5 + 0.5) * 800);
});
