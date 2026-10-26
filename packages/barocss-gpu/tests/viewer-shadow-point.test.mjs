// CPU admission, six-camera projection and frame-packing evidence; no native GPU or image proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../dist/viewer/camera.js';
import { identity } from '../dist/viewer/math.js';
import { packFrame, pointLights } from '../dist/viewer/lights.js';
import { FRAME_BYTES, MAX_SHADOWS, POINT_SHADOW_START, POINT_SHADOW_FACES } from '../dist/viewer/shaders.js';
import { pointShadowFrames, validatePointShadowLights } from '../dist/viewer/point-shadow.js';
import { Viewer, ViewerError } from '../dist/viewer/viewer.js';

const point = overrides => ({ kind: 'point', position: [0, 0, 0], castShadow: true, ...overrides });
const scene = { min: [-2, -2, -2], max: [2, 2, 2] };
const lightError = error => error instanceof ViewerError && error.code === 'LIGHT_INVALID';
const close = (a, b, epsilon = 1e-11) => assert.ok(Math.abs(a - b) <= epsilon * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const axes = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function project(matrix, p) {
  const point = [...p, 1], clip = [0, 1, 2, 3].map(row => point.reduce((sum, value, col) => sum + matrix[col * 4 + row] * value, 0));
  return { clip, ndc: clip.slice(0, 3).map(value => value / clip[3]) };
}
const interval = frames => ({ near: frames[5].viewProjection[14] / frames[5].viewProjection[10], far: frames[5].viewProjection[14] / (frames[5].viewProjection[10] + 1) });
const pack = (lights, frames, into = null) => packFrame(identity(), new Camera(), lights, {}, null, undefined, null, null, into, frames);
const withFaces = faces => [...new Array(8).fill(null), ...faces];
const maskOffset = 276 + 14 * 20;

test('enabled point shadows validate f32 position and range before a null scene while unshadowed lighting stays unchanged', () => {
  for (const update of [
    { position: null }, { position: [0, 0] }, { position: [NaN, 0, 0] }, { position: [Infinity, 0, 0] }, { position: [Number.MAX_VALUE, 0, 0] },
    { range: null }, { range: -1 }, { range: NaN }, { range: Infinity }, { range: Number.MAX_VALUE }, { range: Number.MIN_VALUE },
  ]) {
    const light = point(update);
    assert.throws(() => validatePointShadowLights([light]), lightError);
    assert.throws(() => pointShadowFrames(light, null, null, 1024), lightError);
  }
  assert.doesNotThrow(() => validatePointShadowLights([point()]));
  assert.equal(pointShadowFrames(point(), null, null, 1024), null);
  assert.doesNotThrow(() => validatePointShadowLights([point({ castShadow: false, position: null, range: NaN })]));
  assert.equal(pointShadowFrames(point({ castShadow: false, position: null, range: NaN }), scene, null, 1024), null);
});

test('only one of the first eight point lights can cast a shadow and the ninth adds no admission or packed shadow', () => {
  const directional = { kind: 'directional', direction: [0, 0, -1] };
  assert.throws(() => validatePointShadowLights([point(), directional, point()]), lightError);
  const lights = [...Array.from({ length: 8 }, () => point({ castShadow: false })), point({ position: null, range: NaN })];
  assert.equal(pointLights(lights).length, 8);
  assert.doesNotThrow(() => validatePointShadowLights(lights));
  const faces = pointShadowFrames(point({ range: 10 }), scene, null, 1024), packed = pack(lights, withFaces(faces));
  const words = new Uint32Array(packed.buffer);
  assert.equal(words[37], 8); assert.equal(words[maskOffset], 0); assert.equal(words[maskOffset + 1], 0);
  lights[7].castShadow = true;
  assert.doesNotThrow(() => validatePointShadowLights(lights));
  const last = new Uint32Array(pack(lights, withFaces(faces)).buffer);
  assert.equal(last[maskOffset], 0x3f00); assert.equal(last[maskOffset + 1], 8);
});

test('all six point cameras centre their axes and map standard near and far depths independently', () => {
  const frames = pointShadowFrames(point({ range: 10 }), scene, null, 1024), { near, far } = interval(frames);
  assert.equal(frames.length, 6); close(far, 10); assert.ok(near > 0 && near <= far * 0.1);
  frames.forEach((frame, face) => {
    assert.equal(frame.perspective, true); assert.equal(frame.softness, 0); assert.deepEqual(frame.direction, axes[face]);
    for (const depth of [near, 2, 4, 8, far]) {
      const projected = project(frame.viewProjection, axes[face].map(value => value * depth));
      close(projected.ndc[0], 0); close(projected.ndc[1], 0); close(projected.clip[3], depth);
      close(projected.ndc[2], (1 / near - 1 / depth) / (1 / near - 1 / far));
    }
    assert.ok(project(frame.viewProjection, axes[face].map(value => -value)).clip[3] < 0);
  });
});

test('point face UV orientation and off-axis depths use six RH cameras rather than radial depth', () => {
  const frames = pointShadowFrames(point({ range: 10 }), scene, null, 1024), { near, far } = interval(frames);
  // Independently specified rays at image UV (0.75, 0.25), in +X/-X/+Y/-Y/+Z/-Z order.
  const rays = [[1, -0.5, -0.5], [-1, -0.5, 0.5], [0.5, 1, 0.5], [0.5, -1, -0.5], [0.5, -0.5, 1], [-0.5, -0.5, -1]];
  frames.forEach((frame, face) => {
    const p = rays[face].map(value => value * 4), projected = project(frame.viewProjection, p);
    close(projected.ndc[0] * 0.5 + 0.5, 0.75); close(0.5 - projected.ndc[1] * 0.5, 0.25);
    close(projected.clip[3], 4); close(projected.ndc[2], (1 / near - 1 / 4) / (1 / near - 1 / far));
    assert.ok(Math.abs(projected.ndc[2] - (1 / near - 1 / Math.hypot(...p)) / (1 / near - 1 / far)) > 1e-6);
  });
});

test('automatic point depth includes raw cap bounds and positive range preserves the spherical lighting range value', () => {
  const depth = { min: [-16, -1, -1], max: [-12, 1, 1] };
  const fitted = pointShadowFrames(point(), scene, depth, 1024), automatic = interval(fitted);
  assert.ok(automatic.far > 16); assert.ok(automatic.near > 0 && automatic.near <= automatic.far * 0.1);
  assert.ok(project(fitted[1].viewProjection, [-16, 0, 0]).ndc[2] < 1);
  const light = point({ range: 6 }), limited = pointShadowFrames(light, scene, depth, 1024);
  close(interval(limited).far, 6); assert.ok(project(limited[1].viewProjection, [-16, 0, 0]).ndc[2] > 1);
  assert.equal(pack([light], withFaces(limited))[75], 6, 'point lighting keeps its original radial range');
  const collapsed = { min: [0, 0, 0], max: [0, 0, 0] };
  assert.equal(pointShadowFrames(point(), collapsed, null, 1024), null);
  assert.equal(pointShadowFrames(light, collapsed, null, 1024).length, 6);
  const outside = pointShadowFrames(point(), { min: [3, 3, 3], max: [4, 4, 4] }, null, 1024);
  assert.ok(interval(outside).near > 0); assert.ok(interval(outside).near <= interval(outside).far * 0.1);
});

test('automatic point far contains outward-biased corner receivers and constant-radius PCF taps across face edges', () => {
  const cube = { min: [-1, -1, -1], max: [1, 1, 1] }, radius = Math.sqrt(3);
  for (const size of [1, 1024]) {
    const frames = pointShadowFrames(point(), cube, null, size), { far } = interval(frames), offset = frames[0].normalOffset;
    close(offset, radius / size * 3);
    const receiver = [1, 1, 1].map(value => value + offset / Math.sqrt(3)), receiverRadius = Math.hypot(...receiver);
    close(receiverRadius, radius + offset); assert.ok(far > receiverRadius);
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
      const ray = [1, 1 + dy * 2 / size, 1 + dx * 2 / size], length = Math.hypot(...ray), tap = ray.map(value => value / length * receiverRadius);
      const magnitude = tap.map(Math.abs), axis = magnitude[0] >= magnitude[1] && magnitude[0] >= magnitude[2] ? 0 : magnitude[1] >= magnitude[2] ? 1 : 2;
      const face = axis * 2 + (tap[axis] < 0 ? 1 : 0), projected = project(frames[face].viewProjection, tap);
      close(Math.hypot(...tap), receiverRadius);
      assert.ok(projected.clip[3] > 0 && projected.clip[3] < far);
      assert.ok(Math.abs(projected.ndc[0]) <= 1 + 1e-11 && Math.abs(projected.ndc[1]) <= 1 + 1e-11);
      assert.ok(projected.ndc[2] >= 0 && projected.ndc[2] < 1);
    }
  }
});

test('point camera translation uses a direct fixed basis and refuses unrepresentable projection data', () => {
  const position = [3, -2, 5], light = point({ position, range: 20 });
  const frames = pointShadowFrames(light, scene, null, 1024);
  frames.forEach((frame, face) => {
    const centre = position.map((value, i) => value + axes[face][i] * 8), p = project(frame.viewProjection, centre);
    close(p.ndc[0], 0); close(p.ndc[1], 0); close(p.clip[3], 8);
  });
  const z = 1e20;
  assert.equal(z + 1, z, 'fixture would collapse an eye-plus-axis target');
  const large = pointShadowFrames(point({ position: [0, 0, z] }), { min: [-1, -1, z - 65536], max: [1, 1, z - 32768] }, null, 1024);
  large.forEach((frame, face) => { assert.deepEqual(frame.direction, axes[face]); assert.ok(frame.viewProjection.every(value => Number.isFinite(Math.fround(value)))); });
  for (const size of [0, -1, 0.5, Infinity]) assert.throws(() => pointShadowFrames(point(), scene, null, size), lightError);
  assert.throws(() => pointShadowFrames(point({ range: 1e-44 }), scene, null, 1024), lightError);
  assert.throws(() => pointShadowFrames(point(), { min: [-Number.MAX_VALUE, 0, 0], max: [Number.MAX_VALUE, 0, 0] }, null, 1024), lightError);
});

test('mixed shadow metadata keeps legacy offsets and dense-mask inputs while point selection uses the point-light index', () => {
  assert.equal(FRAME_BYTES, 2240); assert.equal(MAX_SHADOWS, 14); assert.equal(POINT_SHADOW_START, 8); assert.equal(POINT_SHADOW_FACES, 6);
  const dir = { kind: 'directional', direction: [0, 0, -1], castShadow: true }, spot = { kind: 'spot', position: [0, 0, 0], direction: [0, 0, -1], castShadow: true };
  const chosen = point({ range: 10 }), lights = [point({ castShadow: false }), dir, spot, chosen];
  const shadow = seed => { const viewProjection = identity(); viewProjection[12] = seed; return { viewProjection, normalOffset: 0.125, texel: 1 / 1024, bias: 1 / 2048, softness: 0.25 }; };
  const frames = withFaces(pointShadowFrames(chosen, scene, null, 1024)); frames[0] = shadow(3); frames[4] = shadow(7);
  const camera = new Camera(), clip = { normal: [1, 0, 0], offset: 2, cap: '#ff0000', planes: [{ normal: [1, 0, 0], offset: 2 }] };
  const packed = packFrame(identity(), camera, lights, {}, null, [640, 480, 2, 9], null, clip, null, frames), words = new Uint32Array(packed.buffer);
  assert.deepEqual([...words.slice(36, 40)], [1, 2, 1, 1]);
  assert.deepEqual([...packed.slice(200, 216)], [...frames[0].viewProjection]);
  assert.deepEqual([...packed.slice(220, 224)], [640, 480, 2, 9]); assert.deepEqual([...packed.slice(252, 256)], [1, 0, 0, 2]);
  assert.equal(words[maskOffset], 0x3f11); assert.deepEqual([...words.slice(maskOffset + 1, maskOffset + 4)], [2, 0, 0]);
  for (let face = 0; face < 6; face++) {
    const offset = 276 + (8 + face) * 20;
    assert.deepEqual([...packed.slice(offset, offset + 16)], [...Float32Array.from(frames[8 + face].viewProjection)]);
    assert.equal(packed[offset + 19], 0);
  }
  const pointOnly = pack([chosen], withFaces(pointShadowFrames(chosen, scene, null, 1024)));
  assert.equal(new Uint32Array(pointOnly.buffer)[39], 0); assert.deepEqual([...pointOnly.slice(200, 220)], new Array(20).fill(0));
});

test('partial or sparse point faces disable all six metadata slots and reuse clears the active point index', () => {
  const light = point({ range: 10 }), complete = withFaces(pointShadowFrames(light, scene, null, 1024)), packed = pack([light], complete);
  assert.equal(new Uint32Array(packed.buffer)[maskOffset + 1], 1);
  for (const missing of [8, 10, 13]) {
    const partial = complete.slice(); partial[missing] = null;
    pack([light], partial, packed);
    const words = new Uint32Array(packed.buffer);
    assert.equal(words[maskOffset], 0); assert.equal(words[maskOffset + 1], 0);
    assert.deepEqual([...packed.slice(436, maskOffset)], new Array(120).fill(0));
  }
  const sparse = complete.slice(); delete sparse[12];
  assert.equal(new Uint32Array(pack([light], sparse).buffer)[maskOffset], 0);
  assert.equal(new Uint32Array(pack([light], complete.slice(0, 13)).buffer)[maskOffset + 1], 0);
  pack([point({ castShadow: false })], complete, packed);
  assert.deepEqual([...packed.slice(436)], new Array(124).fill(0));
});

test('point projection and packing preserve caller lights, bounds and frame arrays and own their eye snapshots', () => {
  const light = point({ range: 10 }), bounds = structuredClone(scene), depth = { min: [-4, -1, -1], max: [-3, 1, 1] };
  const before = structuredClone({ light, bounds, depth }), faces = pointShadowFrames(light, bounds, depth, 1024), frames = withFaces(faces), framesBefore = structuredClone(frames);
  pack([light], frames);
  assert.deepEqual({ light, bounds, depth }, before); assert.deepEqual(frames, framesBefore);
  light.position[0] = 7; assert.deepEqual(faces[0].eye, [0, 0, 0]);
  faces[0].eye[1] = 9; assert.deepEqual(faces[1].eye, [0, 0, 0]);
});

test('Viewer.create refuses two enabled point shadows before GPU or canvas context access', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let gpuAccesses = 0, contextAccesses = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { get gpu() { gpuAccesses++; throw new Error('GPU must not be accessed'); } } });
  const canvas = { width: 320, height: 240, getContext() { contextAccesses++; throw new Error('Canvas context must not be accessed'); } };
  try {
    await assert.rejects(Viewer.create(canvas, { lights: [point(), point()], controls: false, autoResize: false }), lightError);
    assert.equal(gpuAccesses, 0); assert.equal(contextAccesses, 0); assert.deepEqual([canvas.width, canvas.height], [320, 240]);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'navigator', previous); else delete globalThis.navigator;
  }
});
