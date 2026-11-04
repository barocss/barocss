import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../dist/viewer/camera.js';
import { invert, normalize, sub, transformPoint } from '../dist/viewer/math.js';

const CENTER = [999000, -998000, 997000];
const norm = a => { const n = Math.hypot(...a); return a.map(x => x / n); };
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function basis(c) {
  const forward = norm(c.target.map((v, i) => v - c.position[i]));
  let right = cross(forward, c.up);
  if (Math.hypot(...right) === 0) right = cross(forward, Math.abs(forward[0]) < .9 ? [1, 0, 0] : [0, 1, 0]);
  right = norm(right);
  return { forward, right, up: cross(right, forward) };
}
function legacy(c, x, y, aspect) {
  const inverse = invert(c.viewProjection(aspect)), near = transformPoint(inverse, [x, y, 1]);
  if (c.projection === 'orthographic') return { origin: near, direction: normalize(sub(transformPoint(inverse, [x, y, 0]), near)) };
  return { origin: c.position, direction: normalize(sub(near, c.position)) };
}
const outcome = run => { try { return { value: run() }; } catch (e) { return { code: e.code, message: e.message }; } };
const pointBudget = point => 8 * Math.max(...point.map(x => x === 0 ? 0 : 2 ** (Math.floor(Math.log2(Math.abs(x))) - 52))) + 128 * Number.EPSILON * .02;
const close = (a, b, budget) => assert.ok(a.every((x, i) => Math.abs(x - b[i]) <= budget), `${a} != ${b}; budget ${budget}`);

for (const projection of ['perspective', 'orthographic']) test(`far ${projection} ray reaches a represented world point in the intended camera plane`, () => {
  const c = new Camera({ projection, position: [999000, -998000.0000022618, 997000.0071993513], target: [999000, -998000.0000000001, 997000], up: [0, 0, 1], fovY: 32 });
  c.near = projection === 'perspective' ? 7.19935168182802e-6 : -.04324117422846461;
  c.far = projection === 'perspective' ? Infinity : .04324117422846461;
  const aspect = 1.14, point = [CENTER[0] + .0001, CENTER[1] + .0001, CENTER[2] + .0009899494936611666];
  const b = basis(c), delta = point.map((v, i) => v - c.position[i]), depth = dot(delta, b.forward), p = c.projectionMatrix(aspect);
  const x = p[0] * dot(delta, b.right) / (projection === 'perspective' ? depth : 1);
  const y = p[5] * dot(delta, b.up) / (projection === 'perspective' ? depth : 1);
  const viewBefore = c.view(), projectionBefore = p.slice(), vpBefore = c.viewProjection(aspect), stateBefore = structuredClone(c.state());
  const ray = c.ray(x, y, aspect), t = (point[2] - ray.origin[2]) / ray.direction[2];
  assert.ok(t > 0 && Math.abs(ray.direction[2]) > .9);
  const hit = ray.origin.map((v, i) => v + t * ray.direction[i]);
  close(hit, point, pointBudget(point));
  assert.deepEqual(c.view(), viewBefore); assert.deepEqual(c.projectionMatrix(aspect), projectionBefore); assert.deepEqual(c.viewProjection(aspect), vpBefore);
  assert.deepEqual(c.state(), stateBefore);
  if (projection === 'perspective') assert.equal(ray.origin, c.position, 'perspective origin keeps its existing position alias');
});

for (const near of [-5, 0, .25]) test(`orthographic ray starts on its signed near plane ${near}`, () => {
  const c = new Camera({ projection: 'orthographic', position: [0, 0, 10], target: [0, 0, 0], up: [0, 1, 0] });
  c.autoClip = false; c.near = near; c.far = 20;
  const p = c.projectionMatrix(1.5), ray = c.ray(.3, -.2, 1.5);
  close(ray.origin, [.3 / p[0], -.2 / p[5], 10 - near], 1e-14);
  assert.deepEqual(ray.direction, [0, 0, -1]);
  assert.notEqual(ray.origin, c.position);
  const q = transformPoint(c.viewProjection(1.5), ray.origin);
  assert.ok(Math.abs(q[2] - 1) < 1e-14, 'near maps to reversed depth1');
});

for (const finite of [false, true]) test(`perspective ray optics remain independent of ${finite ? 'finite manual' : 'infinite automatic'} depth range`, () => {
  const c = new Camera({ position: [2, -3, 5], target: [0, 0, 0], up: [0, 0, 1], fovY: 47 });
  c.autoClip = !finite; c.near = .2; c.far = finite ? 20 : Infinity;
  const b = basis(c), p = c.projectionMatrix(1.3), ray = c.ray(.2, -.35, 1.3);
  const expected = norm(b.forward.map((v, i) => v + b.right[i] * .2 / p[0] - b.up[i] * .35 / p[5]));
  close(ray.direction, expected, 16 * Number.EPSILON);
  assert.equal(ray.origin, c.position);
});

for (const up of [[0, 0, 0], [0, 0, -1]]) test(`parallel/zero up retains a valid basis fallback: ${up}`, () => {
  const c = new Camera({ position: [0, 0, 10], target: [0, 0, 0], up });
  const ray = c.ray(.25, -.2, 1.2), p = c.projectionMatrix(1.2), b = basis(c);
  close(ray.direction, norm(b.forward.map((v, i) => v + b.right[i] * .25 / p[0] - b.up[i] * .2 / p[5])), 16 * Number.EPSILON);
});

test('finite nonzero negative optics remain valid queries', () => {
  const c = new Camera({ position: [0, 0, 10], target: [0, 0, 0], up: [0, 1, 0] });
  const ray = c.ray(.25, -.2, -1.5);
  assert.ok(ray.direction[0] < 0 && ray.direction[1] < 0 && ray.direction[2] < 0);
  close(ray.direction, legacy(c, .25, -.2, -1.5).direction, 1e-12);
});

for (const fixture of [
  { name: 'zero view', state: { position: [0, 0, 0], target: [0, 0, 0] } },
  { name: 'zero perspective near', near: 0 },
  { name: 'negative perspective near', near: -.2 },
  { name: 'zero aspect', aspect: 0 },
  { name: 'infinite aspect', aspect: Infinity },
  { name: 'zero FOV', state: { fovY: 0 } },
  { name: 'reversed automatic orthographic range', state: { projection: 'orthographic' }, near: 20, far: -5 },
  { name: 'orthographic infinite-far fallback', state: { projection: 'orthographic' }, near: -2, far: Infinity },
  { name: 'nonfinite pointer', x: Infinity },
]) test(`legacy invalid/fallback ray behavior is retained: ${fixture.name}`, () => {
  const c = new Camera({ position: [0, 0, 10], target: [0, 0, 0], up: [0, 1, 0], ...fixture.state });
  if ('near' in fixture) c.near = fixture.near;
  if ('far' in fixture) c.far = fixture.far;
  const x = fixture.x ?? .2, aspect = fixture.aspect ?? 1.3;
  const actual = outcome(() => c.ray(x, -.1, aspect)), expected = outcome(() => legacy(c, x, -.1, aspect));
  if (fixture.name === 'orthographic infinite-far fallback') {
    assert.ok(actual.value && actual.value.direction.every(Number.isFinite));
    close(actual.value.origin, expected.value.origin, 1e-12); close(actual.value.direction, expected.value.direction, 1e-12);
  } else assert.deepEqual(actual, expected);
});

for (const projection of ['perspective', 'orthographic']) test(`manual ${projection} invalid planes retain CLIP_INVALID`, () => {
  const c = new Camera({ projection }); c.autoClip = false;
  for (const [near, far] of [[2, 1], [NaN, 10], [1, NaN]]) {
    c.near = near; c.far = far;
    assert.throws(() => c.ray(.1, .2, 1), e => e.code === 'CLIP_INVALID');
  }
});

test('public unproject remains the existing inverse-world-matrix path', () => {
  const c = new Camera();
  for (const projection of ['perspective', 'orthographic']) {
    c.projection = projection; c.near = -.2; c.far = 20;
    for (const depth of [0, .5, 1]) assert.deepEqual(c.unproject(.1, -.2, depth, 1.3), transformPoint(invert(c.viewProjection(1.3)), [.1, -.2, depth]));
  }
});
