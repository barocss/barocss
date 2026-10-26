import test from 'node:test';
import assert from 'node:assert/strict';
import { OrbitCamera } from '../src/viewport/camera';
import { renderFocusDistance } from '../src/viewport/renderFocus';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';

test('G15d.3: an off-axis surface focuses its view-axis plane in perspective and orthographic views', () => {
  const camera = new OrbitCamera(); camera.target = [10, 20, 30]; camera.distance = 200; camera.yaw = 0.8; camera.pitch = 0.4;
  const { eye, forward, right } = camera.basis();
  const point = eye.map((v, i) => v + forward[i] * 75 + right[i] * 40) as Vec3;
  for (const ortho of [false, true]) {
    camera.ortho = ortho;
    assert.ok(Math.abs(renderFocusDistance(camera, point)! - 75) < 1e-9);
    assert.ok(Math.abs(Math.hypot(...point.map((v, i) => v - eye[i])) - 85) < 1e-9, 'the off-axis ray length is not focus distance');
  }
  assert.equal(renderFocusDistance(camera, eye), null);
  assert.equal(renderFocusDistance(camera, eye.map((v, i) => v - forward[i] * 5) as Vec3), null);
  assert.equal(renderFocusDistance(camera, [NaN, 0, 0]), null);
});
