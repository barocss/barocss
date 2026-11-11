import test from 'node:test';
import assert from 'node:assert/strict';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';
import { bodyEntirelyBehindEye } from '../src/viewport/boxSelectionDepth';
import { OrbitCamera } from '../src/viewport/camera';

function mesh(points: readonly Vec3[]) {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of points) for (let i = 0; i < 3; i++) {
    min[i] = Math.min(min[i], p[i]);
    max[i] = Math.max(max[i], p[i]);
  }
  return { bounds: { min, max }, positions: new Float64Array(points.flat()) };
}

test('box selection excludes a whole body only while the current perspective eye is in front of it', () => {
  const camera = new OrbitCamera();
  camera.target = [0, 0, 0];
  camera.distance = 10;
  camera.setView('right');
  const behind = mesh([[19, -0.5, -0.5], [21, 0.5, 0.5]]);
  const front = mesh([[-1, -0.5, -0.5], [1, 0.5, 0.5]]);
  const check = (body: typeof behind) => {
    const { eye, forward } = camera.basis();
    return bodyEntirelyBehindEye(body, eye, forward);
  };
  assert.equal(check(front), false);
  assert.equal(check(behind), true);
  assert.ok(camera.project([20, 0, 0], 1000, 1000).every(Number.isFinite));
  camera.distance = 30;
  assert.equal(check(behind), false);
  camera.distance = 20;
  assert.equal(check(behind), false, 'the same body now crosses the eye plane');
  camera.distance = 10;
  camera.setView('left');
  assert.equal(check(behind), false);
});

test('a loose bounds box cannot hide a front vertex or admit a body that is entirely behind', () => {
  const check = (points: Vec3[]) => bodyEntirelyBehindEye(mesh(points), [7000, 9000, 0], [Math.SQRT1_2, Math.SQRT1_2, 0]);
  const behind: Vec3[] = [[7003, 8996, -1], [6996, 9003, 1], [7001, 8998, 0]];
  assert.equal(check(behind), true, 'the bounding box crosses the eye plane but the triangle does not');
  assert.equal(check([...behind, [7001, 8999, 2]]), false, 'a vertex on the eye plane retains the prior test');
  assert.equal(check([...behind, [7001.001, 8999, 2]]), false, 'one positive-depth vertex is enough to retain the body');
  assert.equal(check([]), false);
});
