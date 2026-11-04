import test from 'node:test';
import assert from 'node:assert/strict';
import { OrbitCamera } from '../src/viewport/camera';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';

const centers: Vec3[] = [[999000, -998000, 997000], [0, 0, 0], [-700000, 800000, -900000]];
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const close = (a: number, b: number, budget: number) => assert.ok(Math.abs(a - b) <= budget, `${a} != ${b}; budget ${budget}`);
function pose(c: OrbitCamera) { return { target: [...c.target], distance: c.distance, yaw: c.yaw, pitch: c.pitch, fovY: c.fovY, ortho: c.ortho, aspect: c.aspect }; }
function relativeClip(c: OrbitCamera, point: Vec3) {
  const b = c.basis(), p = c.projection(), delta = point.map((v, i) => v - b.eye[i]);
  const depth = dot(delta, b.forward), w = c.ortho ? 1 : depth;
  return [p[0] * dot(delta, b.right), p[5] * dot(delta, b.up), -p[10] * depth + p[14], w];
}
function physicalBudget(c: OrbitCamera, point: Vec3, width: number, height: number) {
  const b = c.basis(), delta = point.map((v, i) => v - b.eye[i]), X = dot(delta, b.right), Y = dot(delta, b.up), D = dot(delta, b.forward);
  const tangent = Math.tan(c.fovY / 2), n = c.near(), far = c.far(), P = c.projection();
  const kx = c.ortho ? 1 / (c.distance * tangent * c.aspect) : 1 / tangent / c.aspect, ky = c.ortho ? 1 / (c.distance * tangent) : 1 / tangent;
  const kz = c.ortho ? -2 / (far - n) : (far + n) / (n - far), kb = c.ortho ? -(far + n) / (far - n) : 2 * far * n / (n - far);
  const eps = Number.EPSILON, gamma64 = 64 * eps / (1 - 64 * eps), gamma4 = 4 * eps / (1 - 4 * eps);
  const reserve = gamma64 * delta.reduce((s, x) => s + Math.abs(x), 0)
    + delta.reduce((s, x) => s + (x === 0 ? Number.MIN_VALUE : 2 ** (Math.floor(Math.log2(Math.abs(x))) - 52)), 0);
  const W = c.ortho ? 1 : D, absD = Math.abs(D);
  assert.ok(c.ortho || absD > reserve, 'finite fixture stays away from W=0');
  const reference = [(kx * X / W + 1) * width / 2, (1 - ky * Y / W) * height / 2, (-kz * D + kb) / W];
  const css = [X, Y].map((coordinate, axis) => {
    const exact = axis === 0 ? kx : ky, packed = axis === 0 ? P[0] : P[5], pixels = axis === 0 ? width : height;
    const coefficient = Math.abs(packed - exact) * Math.abs(coordinate / W);
    const number = c.ortho ? Math.abs(packed) * reserve + gamma4 * Math.abs(packed * coordinate)
      : Math.abs(packed) * reserve * (1 + Math.abs(coordinate / D)) / (absD - reserve) + gamma4 * Math.abs(packed * coordinate / D);
    return pixels / 2 * (coefficient + number) + gamma4 * pixels / 2 * (Math.abs(exact * coordinate / W) + 1);
  });
  const depth = c.ortho ? Math.abs(P[10] - kz) * absD + Math.abs(P[14] - kb) + Math.abs(P[10]) * reserve + gamma4 * (Math.abs(P[10] * D) + Math.abs(P[14]))
    : Math.abs(P[10] - kz) + Math.abs(P[14] - kb) / absD + Math.abs(P[14]) * reserve / (absD * (absD - reserve)) + gamma4 * (Math.abs(P[10]) + Math.abs(P[14]) / absD);
  assert.ok(css.every(x => x < .001), 'predeclared hard finite-profile CSS envelope');
  assert.ok(depth < 1e-5, 'existing finite-profile NDC envelope');
  return { reference, css, depth };
}

for (const center of centers) for (const ortho of [false, true]) for (const view of ['top', 'iso'] as const)
  test(`relative project preserves a tiny represented frame at ${center}, ${view}, ortho=${ortho}`, () => {
    const c = new OrbitCamera(); c.target = [...center]; c.distance = .0072; c.ortho = ortho; c.aspect = view === 'top' ? 1.14 : .75; c.setView(view);
    const before = { pose: pose(c), view: c.view(), projection: c.projection(), vp: c.viewProjection() };
    const projected = c.project(center, 1140, 1000);
    close(projected[0], 570, .001); close(projected[1], 500, .001);
    const point: Vec3 = [center[0] + .0001, center[1] + .0001, center[2] + .0007];
    const q = c.project(point, 1140, 1000), clip = relativeClip(c, point);
    close(q[0], (clip[0] / clip[3] + 1) * 570, .001);
    close(q[1], (1 - clip[1] / clip[3]) * 500, .001);
    close(q[2], clip[2] / clip[3], 1e-5);
    const physical = physicalBudget(c, point, 1140, 1000);
    close(q[0], physical.reference[0], physical.css[0]); close(q[1], physical.reference[1], physical.css[1]); close(q[2], physical.reference[2], physical.depth);
    assert.ok(q[0] > 0 && q[0] < 1140 && q[1] > 0 && q[1] < 1000 && q[2] > -1 && q[2] < 1);
    const otherSize = c.project(point, 800, 600);
    close(otherSize[0] / 800, q[0] / 1140, 4 * Number.EPSILON); close(otherSize[1] / 600, q[1] / 1000, 4 * Number.EPSILON);
    assert.deepEqual(pose(c), before.pose); assert.deepEqual(c.view(), before.view); assert.deepEqual(c.projection(), before.projection); assert.deepEqual(c.viewProjection(), before.vp);
  });

for (const ortho of [false, true]) test(`project retains OpenGL near=-1/far=+1 and behind-eye division; ortho=${ortho}`, () => {
  const c = new OrbitCamera(); c.target = [0, 0, 0]; c.distance = 10; c.yaw = 0; c.pitch = 0; c.ortho = ortho;
  const { eye, forward } = c.basis();
  for (const [depth, expected] of [[c.near(), -1], [c.far(), 1]]) {
    const p = eye.map((v, i) => v + forward[i] * depth) as Vec3;
    close(c.project(p, 800, 600)[2], expected, 1e-5);
  }
  const behind = eye.map((v, i) => v - forward[i]) as Vec3;
  const q = c.project(behind, 800, 600);
  assert.ok(q.every(Number.isFinite)); close(q[0], 400, 1e-12); close(q[1], 300, 1e-12);
  assert.ok(ortho ? q[2] < -1 : q[2] > 1);
  if (!ortho) {
    const singular = c.project([eye[0], eye[1] + 1, eye[2]], 800, 600);
    assert.ok(!Number.isFinite(singular[0]) && !Number.isFinite(singular[1]), 'eye-plane division remains an unbounded numeric query');
  }
});

test('invalid projector bases retain their legacy matrix outputs', () => {
  for (const change of [
    (c: OrbitCamera) => { c.distance = 0; }, (c: OrbitCamera) => { c.aspect = 0; },
    (c: OrbitCamera) => { c.fovY = 0; }, (c: OrbitCamera) => { c.target[0] = Infinity; },
  ]) {
    const c = new OrbitCamera(); change(c);
    const p: Vec3 = [12, -4, 9], m = c.viewProjection(), h = [...p, 1];
    const q = [0, 1, 2, 3].map(r => h.reduce((sum, value, k) => sum + m[k * 4 + r] * value, 0));
    assert.deepEqual(c.project(p, 800, 600), [(q[0] / q[3] * .5 + .5) * 800, (1 - (q[1] / q[3] * .5 + .5)) * 600, q[2] / q[3]]);
  }
});

test('ordinary packed-matrix differences stay within a pointwise coefficient envelope', t => {
  let maxPixels = 0, maxDepth = 0, maxPixelEnvelope = 0;
  for (const ortho of [false, true]) for (const aspect of [.75, 1.6]) {
    const c = new OrbitCamera(); c.ortho = ortho; c.aspect = aspect;
    const b = c.basis(), P = c.projection(), old = c.viewProjection();
    const view = [b.right[0], b.up[0], -b.forward[0], 0, b.right[1], b.up[1], -b.forward[1], 0,
      b.right[2], b.up[2], -b.forward[2], 0, -dot(b.right, b.eye), -dot(b.up, b.eye), dot(b.forward, b.eye), 1];
    const exact = new Float64Array(16);
    for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) for (let k = 0; k < 4; k++) exact[col * 4 + row] += P[k * 4 + row] * view[col * 4 + k];
    for (const point of [[32, 16, 4], [12, -4, 9], [-40, 25, 60]] as Vec3[]) {
      const h = [...point, 1], clip = relativeClip(c, point), oldClip = [0, 1, 2, 3].map(row => h.reduce((s, x, k) => s + old[k * 4 + row] * x, 0));
      const errors = [0, 1, 2, 3].map(row => h.reduce((s, x, k) => s + Math.abs(x) * Math.abs(old[k * 4 + row] - exact[k * 4 + row]), 0)
        + 128 * Number.EPSILON * h.reduce((s, x, k) => s + Math.abs(x) * (Math.abs(old[k * 4 + row]) + Math.abs(exact[k * 4 + row])), 0));
      assert.ok(Math.abs(clip[3]) > errors[3], 'ordinary points stay away from W=0');
      const q = c.project(point, 800, 600), actualNdc = [q[0] / 400 - 1, 1 - q[1] / 300, q[2]];
      for (let row = 0; row < 3; row++) {
        const ndc = clip[row] / clip[3], envelope = (errors[row] + Math.abs(ndc) * errors[3]) / (Math.abs(clip[3]) - errors[3]);
        const difference = Math.abs(actualNdc[row] - oldClip[row] / oldClip[3]);
        assert.ok(difference <= envelope, `row${row}: ${difference} > ${envelope}`);
        if (row < 2) { const pixels = difference * (row === 0 ? 400 : 300); maxPixels = Math.max(maxPixels, pixels); maxPixelEnvelope = Math.max(maxPixelEnvelope, envelope * (row === 0 ? 400 : 300)); }
        else maxDepth = Math.max(maxDepth, difference);
      }
    }
  }
  assert.ok(maxPixels < .001, 'existing finite ordinary pixel budget');
  assert.ok(maxPixelEnvelope < .001, 'predeclared ordinary coefficient envelope');
  assert.ok(maxDepth < 1e-5, 'existing ordinary NDC budget');
  t.diagnostic(JSON.stringify({ maxPixels, maxDepth, maxPixelEnvelope, scope: 'ordinary bounded points; retained Float32 projection optics' }));
});
