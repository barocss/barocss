// Regression source only; execution is deferred until the API improvement group is complete.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scene, Scene, BarocssError } from '../dist/api/index.js';

const triangle = () => ({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0] });

test('finite camera direction scales cannot overflow or underflow into a zero direction', () => {
  for (const scale of [Number.MAX_VALUE, Number.MIN_VALUE]) {
    const camera = scene().camera({ direction: [scale, -scale, scale] }).data.camera;
    const expected = 1 / Math.sqrt(3);
    camera.direction.forEach((value, index) => assert.ok(Math.abs(value - (index === 1 ? -expected : expected)) <= 1e-15));
    assert.ok(Math.abs(Math.hypot(...camera.direction) - 1) <= 1e-15);
  }
});

test('direct Scene cameras keep the same projection, field-of-view and up-vector contract', () => {
  const valid = { direction: [2, 0, 0], up: [0, 0, 3], projection: 'perspective', fovY: 40 };
  const typed = e => e instanceof BarocssError && e.code === 'CAMERA_INVALID';
  for (const patch of [{ up: [1, 0, 0] }, { up: [-1, 0, 0] }, { projection: 'unknown' }, { fovY: 0 }, { fovY: 180 }, { fovY: NaN }, { fovY: Infinity }, { fovY: Symbol('invalid fov') }]) {
    assert.throws(() => new Scene({ frame: 'z-up', meshes: [], camera: { ...valid, ...patch } }), typed);
  }
  assert.deepEqual(new Scene({ frame: 'z-up', meshes: [], camera: valid }).data.camera, valid, 'snapshot validation does not normalize stored constructor tuples');
});

test('invalid camera names and missing snapshot vectors keep CAMERA_INVALID refusals', () => {
  const typed = e => e instanceof BarocssError && e.code === 'CAMERA_INVALID';
  assert.throws(() => scene().camera('iso', { fovY: Symbol('invalid fov') }), typed);
  for (const name of ['toString', 'constructor', '__proto__']) assert.throws(() => scene().camera(name), typed);
  for (const direction of [undefined, null, [1, 2], [0, NaN, 1]]) {
    assert.throws(() => scene().camera({ direction }), typed);
    assert.throws(() => new Scene({ frame: 'z-up', meshes: [], camera: { direction, up: [0, 0, 1], projection: 'perspective', fovY: 40 } }), typed);
  }
});

test('snapshot copying preserves existing out-of-contract primitive background values', () => {
  for (const background of [null, 42, false, undefined]) assert.equal(scene().background(background).data.background, background);
});

test('light snapshots refuse missing, null and non-finite required vectors with LIGHT_INVALID', () => {
  const invalid = [
    { kind: 'spot' },
    { kind: 'spot', position: [0, 0, 0], direction: null },
    { kind: 'point', position: [0, Infinity, 0] },
    { kind: 'directional', direction: [0, 1] },
  ];
  for (const light of invalid) {
    const typed = e => e instanceof BarocssError && e.code === 'LIGHT_INVALID';
    assert.throws(() => scene().light(light), typed);
    assert.throws(() => new Scene({ frame: 'z-up', meshes: [], lights: [light] }), typed);
  }
});

test('material names resolve only own registrations, including prototype-shaped names', () => {
  const base = scene().material('steel', { roughness: 0.5 });
  for (const name of ['toString', 'constructor', '__proto__']) {
    assert.throws(() => base.add(triangle(), name), e => e instanceof BarocssError && e.code === 'MATERIAL_UNKNOWN');
    assert.equal(base.add({ ...triangle(), material: name }).data.meshes[0].material, undefined);
    const registered = base.material(name, { color: '#123456' }).add(triangle(), name);
    assert.equal(registered.data.meshes[0].material, name);
    assert.deepEqual(registered.data.materials[name], { color: '#123456' });
  }
});

test('Scene snapshots light and background values on input and data output', () => {
  const light = { kind: 'spot', position: [1, 2, 3], direction: [0, 0, -1], color: [0.1, 0.2, 0.3], intensity: 2 };
  const background = { top: [0.2, 0.3, 0.4], bottom: [0.5, 0.6, 0.7] };
  const view = scene().light(light).background(background), expected = view.data;
  light.position[0] = 99; light.direction[2] = 1; light.color[0] = 1; light.intensity = 9;
  background.top[0] = 1; background.bottom[2] = 0;
  assert.deepEqual(view.data, expected);
  const out = view.data;
  out.lights[0].position[0] = 80; out.lights[0].direction[0] = 80; out.lights[0].color[0] = 80;
  out.background.top[0] = 80; out.background.bottom[0] = 80;
  assert.deepEqual(view.data, expected);
});

test('material value settings are isolated while texture and shader resources retain identity', () => {
  const map = { resource: 'texture' }, shader = { expression: 'vec3<f32>(1.0)' };
  const look = { color: [0.1, 0.2, 0.3], lineDash: [2, 3], lineHiddenDash: [4, 5],
    pointBorder: { width: 1, color: [0.3, 0.4, 0.5] },
    finish: { kind: 'turned', axis: [0, 0, 1], origin: [1, 2, 3] }, map, shader };
  const view = scene().material('metal', look).add(triangle(), look), expected = view.data;
  look.color[0] = 9; look.lineDash[0] = 9; look.lineHiddenDash[0] = 9;
  look.pointBorder.color[0] = 9; look.finish.axis[0] = 9; look.finish.origin[0] = 9;
  assert.deepEqual(view.data, expected);
  const out = view.data;
  for (const material of [out.materials.metal, out.meshes[0].material]) {
    assert.equal(material.map, map); assert.equal(material.shader, shader);
    material.color[0] = 7; material.lineDash[0] = 7; material.lineHiddenDash[0] = 7;
    material.pointBorder.color[0] = 7; material.finish.axis[0] = 7; material.finish.origin[0] = 7;
  }
  assert.deepEqual(view.data, expected);
});

test('direct Scene construction copies value containers and camera but preserves geometry arrays', () => {
  const mesh = triangle(), camera = { direction: [1, 0, 0], up: [0, 0, 1], projection: 'perspective', fovY: 40 };
  const input = { frame: 'z-up', meshes: [mesh], camera, lights: [{ kind: 'point', position: [1, 2, 3] }], background: [0.1, 0.2, 0.3] };
  const view = new Scene(input), expected = view.data;
  input.meshes.push(triangle()); mesh.key = 'changed'; camera.direction[0] = 9; camera.up[0] = 9;
  input.lights[0].position[0] = 9; input.background[0] = 9;
  assert.deepEqual(view.data, expected);
  const out = view.data; out.camera.direction[0] = 5; out.camera.up[0] = 5; out.background[0] = 5;
  assert.deepEqual(view.data, expected);
  assert.equal(view.data.meshes[0].positions, mesh.positions);
});
