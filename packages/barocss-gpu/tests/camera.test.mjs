import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareCamera, validateMeshCamera, validateMeshOptions } from '../dist/index.js';
const camera = () => ({ eye: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0], fovY: 45, near: 0.01, far: 100 });
const options = () => ({ mmToSceneUnit: 0.1, translate: [0, 0, 0], color: [1, 0.5, 0], background: [0.1, 0.2, 0.3] });
const close = (actual, expected, epsilon = 1e-5) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
const mul = (matrix, point) => [0, 1, 2, 3].map((row) => point.reduce((sum, n, col) => sum + matrix[col * 4 + row] * n, 0));
const projected = (matrices, point) => { const clip = mul(matrices.projection, mul(matrices.view, [...point, 1])); return { clip, ndc: clip.slice(0, 3).map((n) => n / clip[3]) }; };
const dot = (a, b) => a.reduce((sum, n, i) => sum + n * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

test('default matrices match independently derived fixed projection and old shape', () => {
  const value = prepareCamera(undefined, 2), focal = 1 / Math.tan(Math.PI / 8);
  assert.deepEqual([...value.view], [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -0, -0, -6, 1]);
  close(value.projection[0], focal / 2); close(value.projection[5], focal);
  close(value.projection[10], -(100 + 0.01) / (100 - 0.01)); close(value.projection[14], -2 * 100 * 0.01 / (100 - 0.01));
  assert.deepEqual(prepareCamera(camera(), 2), value);
  assert.deepEqual(validateMeshOptions(options()), options());
  assert.equal(Object.hasOwn(validateMeshOptions(options()), 'camera'), false);
});

test('known center, left, right, up and down points detect matrix transpose and Y inversion', () => {
  const m = prepareCamera(camera(), 1), expected = 1 / (6 * Math.tan(Math.PI / 8));
  close(projected(m, [0, 0, 0]).ndc[0], 0); close(projected(m, [0, 0, 0]).ndc[1], 0);
  close(projected(m, [1, 0, 0]).ndc[0], expected); close(projected(m, [-1, 0, 0]).ndc[0], -expected);
  close(projected(m, [0, 1, 0]).ndc[1], expected); close(projected(m, [0, -1, 0]).ndc[1], -expected);
});

test('side and oblique look-at frames remain orthonormal and right-handed', () => {
  for (const eye of [[6, 0, 0], [4, 3, 6], [-5, 2, -3]]) {
    const input = { ...camera(), eye }, m = prepareCamera(input, 1);
    const axes = [0, 1, 2].map((row) => [m.view[row], m.view[row + 4], m.view[row + 8]]);
    for (const axis of axes) close(dot(axis, axis), 1);
    close(dot(axes[0], axes[1]), 0); close(dot(axes[1], axes[2]), 0); close(dot(axes[2], axes[0]), 0);
    close(dot(cross(axes[0], axes[1]), axes[2]), 1);
    const target = mul(m.view, [0, 0, 0, 1]), atEye = mul(m.view, [...eye, 1]);
    close(target[0], 0); close(target[1], 0); close(target[2], -Math.hypot(...eye));
    for (const n of atEye.slice(0, 3)) close(n, 0);
  }
  const side = prepareCamera({ ...camera(), eye: [6, 0, 0] }, 1);
  assert.ok(projected(side, [0, 0, -1]).ndc[0] > 0);
  assert.ok(projected(side, [0, 1, 0]).ndc[1] > 0);
});

test('translated target projects to center without changing world geometry', () => {
  const m = prepareCamera({ ...camera(), eye: [3, -2, 10], target: [3, -2, 4] }, 1);
  const p = projected(m, [3, -2, 4]); close(p.ndc[0], 0); close(p.ndc[1], 0); close(p.clip[3], 6);
});

test('near and far map to OpenGL clip endpoints and behind-camera has negative W', () => {
  const c = { ...camera(), near: 1, far: 10 }, m = prepareCamera(c, 1);
  close(projected(m, [0, 0, 5]).ndc[2], -1); close(projected(m, [0, 0, -4]).ndc[2], 1);
  assert.ok(projected(m, [0, 0, 5.5]).ndc[2] < -1); assert.ok(projected(m, [0, 0, -5]).ndc[2] > 1);
  assert.ok(projected(m, [0, 0, 7]).clip[3] < 0);
  assert.ok(projected(m, [0, 0, 4]).ndc[2] < projected(m, [0, 0, 0]).ndc[2]);
});

test('up rotation, aspect and optics follow analytic projection expectations', () => {
  const rotated = prepareCamera({ ...camera(), up: [1, 0, 0] }, 1);
  assert.ok(projected(rotated, [1, 0, 0]).ndc[1] > 0); assert.ok(projected(rotated, [0, 1, 0]).ndc[0] < 0);
  const narrow = prepareCamera({ ...camera(), fovY: 10 }, 1), wide = prepareCamera({ ...camera(), fovY: 100 }, 1);
  assert.ok(projected(narrow, [1, 0, 0]).ndc[0] > projected(wide, [1, 0, 0]).ndc[0]);
  close(projected(prepareCamera(camera(), 2), [1, 0, 0]).ndc[0] * 2, projected(prepareCamera(camera(), 1), [1, 0, 0]).ndc[0]);
});

test('nested camera data is copied and frozen while original up magnitude is retained', () => {
  const input = { ...camera(), up: [0, 7, 0] }, o = { ...options(), camera: input }, accepted = validateMeshOptions(o);
  assert.deepEqual(accepted.camera.up, [0, 7, 0]);
  for (const item of [accepted.camera, accepted.camera.eye, accepted.camera.target, accepted.camera.up]) assert.ok(Object.isFrozen(item));
  input.eye[0] = 99; input.target[1] = 33; input.up[1] = -9; input.near = 1;
  assert.deepEqual(accepted.camera, { ...camera(), up: [0, 7, 0] });
  const m = prepareCamera(accepted.camera, 1); m.view[0] = 99;
  assert.equal(prepareCamera(accepted.camera, 1).view[0], 1);
  assert.deepEqual(prepareCamera({ ...camera(), up: [0, Number.MAX_VALUE, 0] }, 1), prepareCamera(camera(), 1));
});

test('strict objects and vectors reject missing, foreign, symbol and accessor fields without reads', () => {
  for (const key of Object.keys(camera())) { const c = camera(); delete c[key]; assert.throws(() => validateMeshCamera(c)); }
  for (const bad of [null, undefined, [], Object.assign(Object.create(null), camera()), { ...camera(), matrix: [] }, { ...camera(), [Symbol('foreign')]: 1 }]) assert.throws(() => validateMeshCamera(bad));
  let reads = 0; const c = camera(); Object.defineProperty(c, 'near', { enumerable: true, get() { reads++; return 0.01; } });
  assert.throws(() => validateMeshCamera(c));
  for (const key of ['eye', 'target', 'up']) {
    const value = camera(); Object.defineProperty(value[key], '0', { enumerable: true, get() { reads++; return 0; } }); assert.throws(() => validateMeshCamera(value));
    const sparse = camera(); delete sparse[key][0]; assert.throws(() => validateMeshCamera(sparse));
    const symbol = camera(); symbol[key][Symbol('x')] = 0; assert.throws(() => validateMeshCamera(symbol));
    const typed = camera(); typed[key] = new Float32Array(typed[key]); assert.throws(() => validateMeshCamera(typed));
  }
  const o = options(); Object.defineProperty(o, 'camera', { enumerable: true, get() { reads++; return camera(); } }); assert.throws(() => validateMeshOptions(o));
  assert.equal(reads, 0); assert.throws(() => validateMeshOptions({ ...options(), camera: undefined }));
});

test('camera vectors and optics reject all scalar bound violations', () => {
  for (const key of ['eye', 'target', 'up']) for (const n of [NaN, Infinity, -Infinity, '0']) { const c = camera(); c[key][0] = n; assert.throws(() => validateMeshCamera(c)); }
  for (const key of ['eye', 'target']) for (const n of [-1001, 1001]) { const c = camera(); c[key][0] = n; assert.throws(() => validateMeshCamera(c)); }
  for (const [key, values] of [['fovY', [9.99, 100.01, Infinity, NaN, '45']], ['near', [0, -1, 0.000099, Infinity, NaN]], ['far', [0, 0.01, 10001, Infinity, NaN]]]) {
    for (const n of values) assert.throws(() => validateMeshCamera({ ...camera(), [key]: n }));
  }
});

test('singular and almost singular eye/up axes reject before GPU allocation', () => {
  for (const c of [{ ...camera(), target: [0, 0, 6] }, { ...camera(), target: [0, 0, 5.99999] },
    { ...camera(), up: [0, 0, 0] }, { ...camera(), up: [0, 1e-7, 0] }, { ...camera(), up: [0, 0, 1] },
    { ...camera(), up: [0, 1e-7, 1] }]) assert.throws(() => validateMeshCamera(c));
  assert.doesNotThrow(() => validateMeshCamera({ ...camera(), up: [0, 1e-6, 0] }));
});

test('Float32 clipping collapse, cancellation, overflow and underflow reject without clamping', () => {
  assert.throws(() => validateMeshCamera({ ...camera(), near: 1e-4, far: 10000 }), /Float32 projection/);
  assert.throws(() => validateMeshCamera({ ...camera(), near: 1, far: 1 + Number.EPSILON }), /collapse/);
  assert.throws(() => validateMeshCamera({ ...camera(), near: 1, far: 1.000001 }), /ill-conditioned/);
  assert.throws(() => validateMeshCamera({ ...camera(),
    eye: [998.9652733085677, 993.9146233838983, 990.8487630262971],
    target: [998.9651797168958, 993.9146323628615, 990.8487059300874] }), /collapse/);
  for (const aspect of [0, -1, NaN, Infinity, Number.MIN_VALUE, Number.MAX_VALUE]) assert.throws(() => prepareCamera(camera(), aspect));
  assert.doesNotThrow(() => prepareCamera({ ...camera(), near: 1e-4, far: 100 }, 4096));
});
