import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../dist/viewer/camera.js';
import { Viewer } from '../dist/viewer/viewer.js';
import { invert, transformPoint } from '../dist/viewer/math.js';

const box = (min, max) => ({ min, max });
const body = (bounds, extra = {}) => ({ visible: true, bounded: true, bounds, clipped: false, cap: false,
  transparent: false, geometry: { disposed: false, topology: 'triangles' }, ...extra });
const owner = (bounds, state = {}, extra = {}) => Object.assign(Object.create(Viewer.prototype), {
  camera: new Camera({ position: [0, 0, 10], target: [0, 0, 0], up: [0, 1, 0], projection: 'orthographic', ...state }),
  canvas: { width: 800, height: 600 }, meshes: bounds ? [body(bounds)] : [], clip: null, grid: { visible: false }, ...extra,
});
const planes = c => [c.near, c.far];
const legacy = viewer => {
  const c = new Camera(viewer.camera.state());
  c.clip(viewer.depthBounds());
  return planes(c);
};
const corners = b => Array.from({ length: 8 }, (_, i) => [i & 1 ? b.max[0] : b.min[0], i & 2 ? b.max[1] : b.min[1], i & 4 ? b.max[2] : b.min[2]]);
// Independent physical oracle: enumerate the endpoints instead of summing axis support radii.
const depths = (c, b) => {
  const delta = c.target.map((x, i) => x - c.position[i]), length = Math.hypot(...delta);
  return corners(b).map(p => p.reduce((sum, x, i) => sum + (x - c.position[i]) * delta[i] / length, 0));
};
const contains = (c, b) => {
  const p = c.projectionMatrix(4 / 3), packed = Float32Array.from(p), inverse = Float32Array.from(invert(p));
  assert.ok([...packed, ...inverse].every(Number.isFinite), 'packed projection and inverse remain finite');
  assert.notEqual(Math.fround(inverse[14] + inverse[10]), inverse[14], 'near/far remain distinct in the packed inverse');
  for (const d of depths(c, b)) {
    assert.ok(c.near <= d && d <= c.far, `physical depth ${d} in ${planes(c)}`);
    const z = Math.fround(Math.fround(packed[10] * Math.fround(-d)) + packed[14]);
    assert.ok(z >= 0 && z <= 1, `packed reversed depth ${z}`);
  }
};

test('tiny top-view body and bounded ground retain all corners without the lateral sphere radius', () => {
  const sphere = box([-.001, -.001, -.001], [.001, .001, .001]);
  const ground = box([-20.003, -20.003, -.021], [20.003, 20.003, -.021]);
  const v = owner(sphere, { position: [0, 0, .0072] }, { meshes: [body(sphere), body(ground)] });
  const before = legacy(v), snapshot = structuredClone(v.meshes);
  v.clipCamera();
  assert.ok((v.camera.far - v.camera.near) < .024, 'range follows actual depth, not the 40 mm ground width');
  assert.ok((before[1] - before[0]) / (v.camera.far - v.camera.near) > 2000);
  contains(v.camera, sphere); contains(v.camera, ground);
  assert.deepEqual(v.meshes, snapshot, 'geometry, bounds and visibility are unchanged');
});

for (const fixture of [
  { name: 'ordinary front', bounds: box([-1, -2, -3], [1, 2, 3]), position: [0, -20, 0] },
  { name: 'wide thin top', bounds: box([-1e5, -2, -.01], [1e5, 2, .01]), position: [0, 0, 10] },
  { name: 'negative oblique', bounds: box([-4, -5, -6], [7, 8, 9]), position: [10, 20, 30] },
  { name: 'mixed oblique', bounds: box([-4, -5, -6], [7, 8, 9]), position: [-10, 20, -30] },
  { name: 'behind eye', bounds: box([-1, -1, 20], [1, 1, 22]), position: [0, 0, 10] },
  { name: 'straddles eye', bounds: box([-1, -1, 9], [1, 1, 11]), position: [0, 0, 10] },
  { name: 'point', bounds: box([0, 0, 0], [0, 0, 0]), position: [0, 0, 10] },
  { name: 'translated ordinary', bounds: box([999, 1998, 2997], [1001, 2002, 3003]), position: [1010, 2020, 3030], target: [1000, 2000, 3000] },
]) test(`automatic orthographic range contains every ${fixture.name} corner`, () => {
  const v = owner(fixture.bounds, { position: fixture.position, target: fixture.target ?? [0, 0, 0] });
  const ds = depths(v.camera, fixture.bounds), physicalSpan = Math.max(...ds) - Math.min(...ds);
  v.clipCamera();
  contains(v.camera, fixture.bounds);
  assert.ok(Math.abs((v.camera.far - v.camera.near) - Math.max(physicalSpan, 2e-6) * 1.05) <= 1e-11,
    'padding follows the independent eight-corner depth span');
  if (fixture.name === 'behind eye') assert.ok(v.camera.far < 0, 'negative orthographic intervals are retained');
  if (fixture.name === 'straddles eye') assert.ok(v.camera.near < 0 && v.camera.far > 0);
});

test('grid extension retains its existing signed fade interval', () => {
  const b = box([-20, -20, -.021], [20, 20, .001]);
  const v = owner(b, { position: [0, 0, .0072] }, { grid: { visible: true } });
  v.clipCamera();
  assert.deepEqual(planes(v.camera), [-.0072 * 6, .0072 * 6]);
  contains(v.camera, b);
});

test('caps keep the whole source box, including faces cut away from sceneBounds', () => {
  const b = box([-1, -1, -8], [1, 1, 8]), mesh = body(b, { clipped: true, cap: true });
  const v = owner(null, {}, { meshes: [mesh], clip: { normal: [0, 0, 1], offset: 7 } });
  assert.deepEqual(v.sceneBounds().min, [-1, -1, 7]);
  v.clipCamera();
  contains(v.camera, b);
  assert.ok(v.camera.far - v.camera.near > 16, 'full cap probe depth remains inside the range');
});

for (const bounded of [true, false]) test(`visible ${bounded ? 'bounded' : 'unbounded'} labels retain the exact legacy range`, () => {
  const b = box([-100, -100, -.01], [100, 100, .01]);
  const label = body(box([0, 0, 0], [0, 0, 0]), { bounded, geometry: { disposed: false, topology: 'labels' } });
  const v = owner(b, {}, { meshes: [body(b), label] }), expected = legacy(v);
  v.clipCamera();
  assert.deepEqual(planes(v.camera), expected);
});

for (const state of ['hidden', 'disposed']) test(`${state} labels do not prevent depth refinement`, () => {
  const b = box([-100, -100, -.01], [100, 100, .01]);
  const label = body(null, { visible: state !== 'hidden', geometry: { disposed: state === 'disposed', topology: 'labels' } });
  const v = owner(b, {}, { meshes: [body(b), label] });
  v.clipCamera();
  assert.ok(v.camera.far - v.camera.near < .022);
});

test('label visibility changes select and restore the range without cached scene state', () => {
  const b = box([-100, -100, -.01], [100, 100, .01]);
  const label = body(null, { bounded: false, visible: false, geometry: { disposed: false, topology: 'labels' } });
  const v = owner(b, {}, { meshes: [body(b), label] }), expected = legacy(v);
  v.clipCamera();
  const refined = planes(v.camera);
  assert.ok(refined[1] - refined[0] < .022);
  label.visible = true; v.clipCamera();
  assert.deepEqual(planes(v.camera), expected);
  label.visible = false; v.clipCamera();
  assert.deepEqual(planes(v.camera), refined);
});

for (const fixture of [
  { name: 'double interval collapse', b: box([-1e5, -1e5, 0], [1e5, 1e5, 0]), eye: [0, 0, 1e20] },
  { name: 'packed inverse endpoint collapse', b: box([-1e5, -1e5, -.01], [1e5, 1e5, .01]), eye: [0, 0, 1e10] },
  { name: 'packed projection overflow', b: box([-1, -1, -.01], [1, 1, .01]), eye: [0, 0, 10], fovY: 1e-50 },
  { name: 'packed inverse overflow', b: box([-1, -1, -1e39], [1, 1, 1e39]), eye: [0, 0, 1e39] },
  { name: 'invalid box', b: box([1, 1, 1], [-1, -1, -1]), eye: [0, 0, 10] },
  { name: 'nonfinite box', b: box([-Infinity, -1, -1], [Infinity, 1, 1]), eye: [0, 0, 10] },
  { name: 'zero view direction', b: box([-1, -1, -1], [1, 1, 1]), eye: [0, 0, 0] },
]) test(`${fixture.name} retains the exact legacy result`, () => {
  const v = owner(fixture.b, { position: fixture.eye, ...(fixture.fovY === undefined ? {} : { fovY: fixture.fovY }) });
  const expected = legacy(v);
  v.clipCamera();
  assert.deepEqual(planes(v.camera), expected);
});

test('perspective and empty-scene automatic ranges remain exactly legacy', () => {
  for (const v of [owner(box([-100, -100, -.01], [100, 100, .01]), { projection: 'perspective' }), owner(null)]) {
    const expected = legacy(v);
    v.clipCamera();
    assert.deepEqual(planes(v.camera), expected);
  }
});

test('manual clipping returns without reading scene bounds or altering authored planes', () => {
  const v = owner(null);
  Object.assign(v.camera, { autoClip: false, near: -2, far: 5 });
  v.depthBounds = () => assert.fail('manual clipping must not inspect bounds');
  v.clipCamera();
  assert.deepEqual(planes(v.camera), [-2, 5]);
});

test('render-target aspect is used by the candidate matrix guard', () => {
  const b = box([-100, -100, -.01], [100, 100, .01]), v = owner(b), expected = legacy(v);
  v.prepareCamera(1e-50);
  assert.deepEqual(planes(v.camera), expected, 'target projection overflow falls back even though the canvas aspect is valid');
  v.prepareCamera(1);
  assert.ok(v.camera.far - v.camera.near < .022);
});

test('orthographic ray/project reciprocity survives a tightened signed range', () => {
  const b = box([-1, -2, -3], [1, 2, 3]), v = owner(b, { position: [10, 20, 30] });
  v.clipCamera();
  const point = [.2, -.3, .4], projected = transformPoint(v.camera.viewProjection(v.aspect), point);
  const ray = v.camera.ray(projected[0], projected[1], v.aspect);
  const along = point.map((x, i) => x - ray.origin[i]), length = Math.hypot(...along);
  assert.ok(along.every((x, i) => Math.abs(x / length - ray.direction[i]) < 1e-12));
  const restored = v.camera.unproject(projected[0], projected[1], projected[2], v.aspect);
  assert.ok(restored.every((x, i) => Math.abs(x - point[i]) < 1e-12));
});
