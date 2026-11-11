import test from 'node:test';
import assert from 'node:assert/strict';
import { OrbitCamera } from '../src/viewport/camera';
import type { Vec3 } from '@barocss/cad-model/engine/mesh';

const minimumDistance = 1e-3; // Existing RenderCamera admission, engine/render.ts.
const radius = .001, lo: Vec3 = [-radius, -radius, -radius], hi: Vec3 = [radius, radius, radius];
function axes(c: OrbitCamera) {
  const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  return { forward: [-cp * cy, -cp * sy, -sp], right: [-sy, cy, 0], up: [-sp * cy, -sp * sy, cp] };
}
function pointOnTargetPlane(c: OrbitCamera, x: number, y: number): Vec3 {
  const { right, up } = axes(c), h = c.distance * Math.tan(c.fovY / 2);
  return c.target.map((v, k) => v + x * h * c.aspect * right[k] + y * h * up[k]) as Vec3;
}
function numberProjection(c: OrbitCamera, p: Vec3): [number, number] {
  const a = axes(c), eye = c.target.map((v, k) => v - c.distance * a.forward[k]), delta = p.map((v, k) => v - eye[k]);
  const x = delta.reduce((v, q, k) => v + q * a.right[k], 0), y = delta.reduce((v, q, k) => v + q * a.up[k], 0);
  const depth = delta.reduce((v, q, k) => v + q * a.forward[k], 0), h = (c.ortho ? c.distance : depth) * Math.tan(c.fovY / 2);
  return [x / (h * c.aspect), y / h];
}
function clone(c: OrbitCamera): OrbitCamera {
  const copy = new OrbitCamera();
  copy.target = [...c.target]; copy.distance = c.distance; copy.yaw = c.yaw; copy.pitch = c.pitch;
  copy.fovY = c.fovY; copy.ortho = c.ortho; copy.aspect = c.aspect;
  return copy;
}
function close(a: number, b: number, tolerance = 1e-5): void { assert.ok(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`); }

for (const ortho of [false, true]) for (const aspect of [.5, 2]) for (const view of ['iso', 'top'] as const)
  test(`centered tiny box frames real extents and distinct clipped depth: ${ortho ? 'ortho' : 'perspective'}, aspect ${aspect}, ${view}`, () => {
    const c = new OrbitCamera(); c.aspect = aspect; c.ortho = ortho; c.setView(view); c.fit(lo, hi);
    assert.ok(c.distance >= minimumDistance && c.distance < .02, 'genuine tiny bounds produce a close view');
    assert.ok(c.near() > 0 && c.near() < c.distance - Math.sqrt(3) * radius && c.far() > c.distance + Math.sqrt(3) * radius);
    assert.ok([...c.projection(), ...c.viewProjection()].every(Number.isFinite));
    const width = 900 * aspect, height = 900, projected: Vec3[] = [];
    for (const x of [-radius, radius]) for (const y of [-radius, radius]) for (const z of [-radius, radius]) {
      const p: Vec3 = [x, y, z], q = c.project(p, width, height), expected = numberProjection(c, p);
      close(2 * q[0] / width - 1, expected[0]); close(1 - 2 * q[1] / height, expected[1]);
      assert.ok(q[0] > 0 && q[0] < width && q[1] > 0 && q[1] < height && q[2] > -1 && q[2] < 1);
      projected.push(q);
    }
    const spans = [0, 1].map(k => Math.max(...projected.map(p => p[k])) - Math.min(...projected.map(p => p[k])));
    assert.ok(Math.max(spans[0] / width, spans[1] / height) > .3, 'tiny geometry occupies a useful screen span');
    const f = axes(c).forward, front = c.target.map((v, k) => v - radius * f[k]) as Vec3, back = c.target.map((v, k) => v + radius * f[k]) as Vec3;
    const frontDepth = Math.fround(c.project(front, width, height)[2]), backDepth = Math.fround(c.project(back, width, height)[2]);
    assert.ok(frontDepth < backDepth && frontDepth > -1 && backDepth < 1, 'front/back depths remain distinct after Float32 rounding');
  });

test('ordinary fit and distance>=1 clip behavior retain the exact legacy formulas', () => {
  for (const aspect of [.5, 1, 2]) for (const size of [1, 10, 100]) {
    const c = new OrbitCamera(); c.aspect = aspect;
    const min: Vec3 = [-size, -size / 2, 0], max: Vec3 = [size, size / 2, size];
    const expected = (Math.max(1, Math.hypot(...max.map((v, k) => v - min[k])) / 2) / Math.sin(c.fovY / 2)) * 1.15 / Math.min(1, aspect);
    c.fit(min, max); assert.equal(c.distance, expected); assert.deepEqual(c.target, [0, 0, size / 2]);
    assert.equal(c.near(), Math.max(.05, c.distance * .01)); assert.equal(c.far(), c.distance * 40 + 2000);
  }
  for (const distance of [1, 2, 5, 160, 20000]) { const c = new OrbitCamera(); c.distance = distance; assert.equal(c.near(), Math.max(.05, distance * .01)); }
});

test('zero, thin and invalid boxes keep finite camera state without changing input bounds', () => {
  const c = new OrbitCamera(), point: Vec3 = [1, 2, 3]; c.fit(point, point);
  assert.deepEqual(c.target, point); assert.equal(c.distance, 1 / Math.sin(c.fovY / 2) * 1.15);
  c.fit([0, 0, 0], [.002, 0, 0]); assert.ok(c.distance < .01 && c.distance >= minimumDistance);
  for (const [min, max] of [[[1, 0, 0], [0, 1, 1]], [[NaN, 0, 0], [1, 1, 1]], [[0, 0, 0], [Infinity, 1, 1]]] as [Vec3, Vec3][]) {
    const before = structuredClone([min, max]), target = [...c.target]; c.fit(min, max);
    assert.deepEqual([min, max], before); assert.deepEqual(c.target, target);
    assert.equal(c.distance, 1 / Math.sin(c.fovY / 2) * 1.15); assert.ok([...c.viewProjection()].every(Number.isFinite));
  }
});

for (const ortho of [false, true]) test(`tiny frameRect fits the free panel band in ${ortho ? 'ortho' : 'perspective'}`, () => {
  const c = new OrbitCamera(), width = 1440, height = 900, left = 64, right = 272;
  c.aspect = width / height; c.ortho = ortho; c.setView('top'); c.frameRect([-.001, -.0005], [.001, .0005], 0, left / width, right / width);
  assert.ok(c.distance < .02 && c.distance >= minimumDistance);
  for (const x of [-.001, .001]) for (const y of [-.0005, .0005]) {
    const p = c.project([x, y, 0], width, height); assert.ok(p[0] >= left && p[0] <= width - right && p[1] >= 0 && p[1] <= height);
  }
  close(c.project([0, 0, 0], width, height)[0], (left + width - right) / 2, .01);
  c.frameAt([0, 0, 0], [0, .002]); assert.ok(c.distance < .02 && c.distance >= minimumDistance);
});

for (const ortho of [false, true]) test(`tiny zoom retains cursor anchor and positive/legacy upper clamps in ${ortho ? 'ortho' : 'perspective'}`, () => {
  for (const factor of [.5, 0, 1e10]) {
    const c = new OrbitCamera(); c.aspect = 1.4; c.ortho = ortho; c.fit(lo, hi);
    const point = pointOnTargetPlane(c, .35, -.2), expected = Math.max(minimumDistance, Math.min(20000, c.distance * factor));
    c.zoom(factor, .35, -.2); assert.equal(c.distance, expected);
    const q = c.project(point, 1400, 1000); close(q[0], .675 * 1400, .01); close(q[1], .6 * 1000, .01);
    assert.ok([...c.viewProjection(), ...c.target].every(Number.isFinite));
  }
  const c = new OrbitCamera(), before = clone(c), basis = before.basis(), factor = .7, x = .3, y = -.2, h = before.distance * Math.tan(before.fovY / 2);
  const distance = Math.max(1, Math.min(20000, before.distance * factor));
  const target = before.target.map((v, k) => v + (x * h * before.aspect * basis.right[k] + y * h * basis.up[k]) * (1 - distance / before.distance));
  c.zoom(factor, x, y); assert.equal(c.distance, distance); assert.deepEqual(c.target, target);
});

test('tiny pan, ray/project reciprocity and existing-field restoration need no hidden fit state', () => {
  const c = new OrbitCamera(); c.aspect = 1.4; c.fit(lo, hi); c.pan(10, -7, 1000);
  for (const ortho of [false, true]) {
    c.ortho = ortho;
    for (const [x, y] of [[0, 0], [.3, -.2], [-.5, .4]]) {
      const ray = c.ray(x, y), f = axes(c).forward;
      const depth = c.target.reduce((v, q, k) => v + (q - ray.origin[k]) * f[k], 0) / ray.dir.reduce((v, q, k) => v + q * f[k], 0);
      const point = ray.origin.map((v, k) => v + ray.dir[k] * depth) as Vec3, q = c.project(point, 1400, 1000);
      close(q[0], (x + 1) * 700, .001); close(q[1], (1 - y) * 500, .001);
    }
    const saved = clone(c); c.fit([-10, -10, -10], [10, 10, 10]);
    c.target = [...saved.target]; c.distance = saved.distance; c.yaw = saved.yaw; c.pitch = saved.pitch;
    c.fovY = saved.fovY; c.ortho = saved.ortho; c.aspect = saved.aspect;
    const fresh = clone(saved); assert.deepEqual(c.projection(), fresh.projection()); assert.deepEqual(c.viewProjection(), fresh.viewProjection());
    c.zoom(.7, .2, -.1); fresh.zoom(.7, .2, -.1); assert.deepEqual(c.target, fresh.target); assert.equal(c.distance, fresh.distance);
  }
});

test('small near-plane policy is positive and continuous at the legacy distance boundary', () => {
  const c = new OrbitCamera();
  for (const distance of [minimumDistance, .007, .1, .999, 1, 1.001]) {
    c.distance = distance; assert.ok(c.near() > 0 && c.near() < distance && c.far() > distance);
    assert.equal(c.far(), distance * 40 + 2000);
    if (distance < 1) assert.equal(c.near(), .05 * distance);
  }
});

test('model fit keeps each corner inside an asymmetric work area in both projections', () => {
  const area = { left: .49, right: .92, top: .24, bottom: .64 }, width = 640, height = 800;
  const centre: Vec3 = [1200, -700, 400], extents: Vec3 = [50, 33, 22];
  const min = centre.map((value, axis) => value - extents[axis]) as Vec3;
  const max = centre.map((value, axis) => value + extents[axis]) as Vec3;
  for (const ortho of [false, true]) for (const view of ['iso', 'top'] as const) {
    const camera = new OrbitCamera();
    camera.aspect = width / height;
    camera.ortho = ortho;
    camera.setView(view);
    camera.fit(min, max, area);
    const [cx, cy] = camera.project(centre, width, height);
    close(cx / width, (area.left + area.right) / 2);
    close(cy / height, (area.top + area.bottom) / 2);
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) {
      const [px, py, depth] = camera.project([x, y, z], width, height);
      assert.ok(px / width >= area.left - 1e-5 && px / width <= area.right + 1e-5);
      assert.ok(py / height >= area.top - 1e-5 && py / height <= area.bottom + 1e-5);
      assert.ok(Math.abs(depth) < 1);
    }
  }
});

test('an empty model fit area falls back to the ordinary camera fit', () => {
  const camera = new OrbitCamera(), ordinary = clone(camera);
  ordinary.fit(lo, hi);
  camera.fit(lo, hi, { left: .6, right: .5, top: .1, bottom: .9 });
  assert.equal(camera.distance, ordinary.distance);
  assert.deepEqual(camera.target, ordinary.target);
});
