// CPU contract for bounded receiver-disk point PCSS; GPU filtering and visible penumbrae are separate proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../dist/viewer/camera.js';
import { identity } from '../dist/viewer/math.js';
import { packFrame } from '../dist/viewer/lights.js';
import { FRAME_BYTES, MAX_SHADOWS } from '../dist/viewer/shaders.js';
import { pointShadowFrames, validatePointShadowLights } from '../dist/viewer/point-shadow.js';
import { spotShadowFrame } from '../dist/viewer/spot-shadow.js';
import { Viewer, ViewerError } from '../dist/viewer/viewer.js';

const point = overrides => ({ kind: 'point', position: [0, 0, 0], range: 10, castShadow: true, ...overrides });
const scene = { min: [-2, -2, -2], max: [2, 2, 2] };
const lightError = error => error instanceof ViewerError && error.code === 'LIGHT_INVALID';
const close = (a, b, epsilon = 1e-11) => assert.ok(Math.abs(a - b) <= epsilon * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const slots = faces => [...new Array(8).fill(null), ...faces];
const pack = (lights, frames, into = null) => packFrame(identity(), new Camera(), lights, {}, null, undefined, null, null, into, frames);
const paramsStart = 576;
function project(matrix, p) {
  const v = [...p, 1], clip = [0, 1, 2, 3].map(row => v.reduce((sum, value, col) => sum + matrix[col * 4 + row] * value, 0));
  return { depth: clip[2] / clip[3], axial: clip[3], uv: [clip[0] / clip[3] * 0.5 + 0.5, 0.5 - clip[1] / clip[3] * 0.5] };
}
// The public six-camera image convention, specified independently of the matrix builder.
function faceRay(face, u, v) {
  return [[1, 2 * v - 1, 1 - 2 * u], [-1, 2 * v - 1, 2 * u - 1], [2 * u - 1, 1, 1 - 2 * v],
    [2 * u - 1, -1, 2 * v - 1], [2 * u - 1, 2 * v - 1, 1], [1 - 2 * u, 2 * v - 1, -1]][face];
}
function unit(ray) {
  const largest = Math.max(...ray.map(Math.abs)), scaled = ray.map(value => value / largest), length = Math.hypot(...scaled);
  return scaled.map(value => value / length);
}
function faceOf(ray) {
  const a = ray.map(Math.abs), axis = a[0] >= a[1] && a[0] >= a[2] ? 0 : a[1] >= a[2] ? 1 : 2;
  return axis * 2 + (ray[axis] < 0 ? 1 : 0);
}

test('zero or omitted point emitter radius preserves the complete prior PCF prefix and zero new metadata', () => {
  assert.equal(FRAME_BYTES, 2320); assert.equal(MAX_SHADOWS, 14);
  const omitted = point(), zero = point({ shadowRadius: 0 }), a = pointShadowFrames(omitted, scene, null, 1024), b = pointShadowFrames(zero, scene, null, 1024);
  a.forEach((frame, i) => assert.deepEqual(frame.viewProjection, b[i].viewProjection));
  const pa = pack([omitted], slots(a)), pb = pack([zero], slots(b));
  assert.deepEqual(pa, pb); assert.equal(pa.byteLength - 16, 2304);
  assert.deepEqual([...pa.slice(paramsStart)], [0, 0, 0, 0]);
  const soft = point({ shadowRadius: 0.25 }), ps = pack([soft], slots(pointShadowFrames(soft, scene, null, 1024)));
  assert.deepEqual(ps.slice(0, paramsStart), pa.slice(0, paramsStart));
});

test('each point face recovers axial depth and independent blocker-ray radial distance from perspective depth', () => {
  const light = point({ position: [2, -3, 5], range: 20, shadowRadius: 0.25 }), frames = pointShadowFrames(light, scene, null, 1024);
  frames.forEach((frame, face) => {
    assert.ok(frame.near > 0 && frame.near < frame.far); assert.equal(frame.far, 20);
    assert.equal(frame.near, frames[0].near); assert.equal(frame.far, frames[0].far);
    for (const uv of [[0.5, 0.5], [0.25, 0.75], [0.9, 0.1]]) {
      const ray = faceRay(face, ...uv), direction = unit(ray), radial = 8, p = direction.map((value, i) => light.position[i] + value * radial);
      const sample = project(frame.viewProjection, p), axis = Math.floor(face / 2), major = Math.abs(ray[axis]);
      const axial = frame.near / (1 - sample.depth * (1 - frame.near / frame.far));
      close(axial, radial * major / Math.hypot(...ray)); close(axial, sample.axial);
      close(axial * Math.hypot(...ray) / major, radial);
      close(sample.uv[0], uv[0]); close(sample.uv[1], uv[1]);
    }
  });
});

test('cross-face point rays round-trip through their selected camera with deterministic X then Y then Z ties', () => {
  const frames = pointShadowFrames(point({ shadowRadius: 0.25 }), scene, null, 1024);
  const cases = [
    [faceRay(0, -0.02, 0.5), 4], [faceRay(0, 1.02, 0.5), 5],
    [faceRay(0, 0.5, 1.02), 2], [faceRay(0, 0.5, -0.02), 3],
    [[1, 1, 1], 0], [[-1, 1, 1], 1], [[0.25, 1, 1], 2], [[0.25, -1, 1], 3],
  ];
  for (const [ray, face] of cases) {
    assert.equal(faceOf(ray), face);
    const direction = unit(ray), sample = project(frames[face].viewProjection, direction.map(value => value * 4));
    assert.ok(sample.uv.every(value => value >= 0 && value <= 1));
    const reconstructed = unit(faceRay(face, ...sample.uv));
    reconstructed.forEach((value, axis) => close(value, direction[axis]));
  }
});

test('blocker reconstruction uses the sampled texel centre ray and remains direction-scale invariant', () => {
  const frames = pointShadowFrames(point({ shadowRadius: 0.25 }), scene, null, 1024), u = 123.5 / 1024, v = 800.5 / 1024;
  const ray = faceRay(4, u, v), direction = unit(ray), radial = 6;
  const sample = project(frames[4].viewProjection, direction.map(value => value * radial));
  close(sample.uv[0], u); close(sample.uv[1], v);
  const axial = frames[4].near / (1 - sample.depth * (1 - frames[4].near / frames[4].far));
  close(axial * Math.hypot(...ray) / Math.abs(ray[2]), radial);
  assert.ok(Math.abs(axial - radial) > 0.1, 'face axial distance is not the radial blocker distance');
  for (const scale of [Number.MIN_VALUE, 3.4028234663852886e38]) {
    const scaled = [scale, -scale, scale], normalized = unit(scaled), selected = faceOf(scaled);
    assert.equal(selected, 0); close(Math.hypot(...normalized), 1);
    normalized.forEach((value, axis) => close(value, [1, -1, 1][axis] / Math.sqrt(3)));
    const projected = project(frames[selected].viewProjection, normalized.map(value => value * 4));
    assert.ok(Number.isFinite(projected.depth) && projected.depth > 0 && projected.depth < 1);
  }
});

test('enabled point radius admission rejects invalid f32 values before a scene exists', () => {
  for (const shadowRadius of [-1, NaN, Infinity, -Infinity, Number.MAX_VALUE, Number.MIN_VALUE, null, '1']) {
    const light = point({ shadowRadius });
    assert.throws(() => validatePointShadowLights([light]), lightError);
    assert.throws(() => pointShadowFrames(light, null, null, 1024), lightError);
  }
  for (const shadowRadius of [0, -0, 0.25, 3.4028234663852886e38]) {
    const light = point({ shadowRadius }); assert.doesNotThrow(() => validatePointShadowLights([light]));
    assert.equal(pointShadowFrames(light, null, null, 1024), null);
    assert.ok(pointShadowFrames(light, scene, null, 1024).every(frame => Number.isFinite(Math.fround(frame.near)) && Number.isFinite(Math.fround(frame.far)) && frame.near < frame.far));
  }
});

test('new point radius rules apply only to enabled first-eight shadows and retain the one-caster limit', () => {
  const disabled = point({ castShadow: false, shadowRadius: NaN });
  assert.doesNotThrow(() => validatePointShadowLights([disabled])); assert.equal(pointShadowFrames(disabled, scene, null, 1024), null);
  const lights = [...Array.from({ length: 8 }, () => point({ castShadow: false })), point({ shadowRadius: NaN })];
  assert.doesNotThrow(() => validatePointShadowLights(lights));
  lights[7] = point({ shadowRadius: 0.5 }); assert.doesNotThrow(() => validatePointShadowLights(lights));
  const packed = pack(lights, slots(pointShadowFrames(lights[7], scene, null, 1024)));
  assert.equal(new Uint32Array(packed.buffer)[557], 8); assert.equal(packed[paramsStart + 2], 0.5);
  assert.throws(() => validatePointShadowLights([point({ shadowRadius: 0.25 }), point({ shadowRadius: 0.5 })]), lightError);
});

test('point PCSS parameters append after spot PCSS while all previous frame and shadow metadata bytes remain unchanged', () => {
  const selected = point({ shadowRadius: 0.5 }), directional = { kind: 'directional', direction: [0, 0, -1], castShadow: true };
  const spot = { kind: 'spot', position: [0, 0, 0], direction: [0, 0, -1], range: 10, castShadow: true, shadowRadius: 0.25 };
  const lights = [point({ castShadow: false }), spot, directional, selected], faces = pointShadowFrames(selected, scene, null, 1024), frames = slots(faces);
  frames[0] = { viewProjection: identity(), normalOffset: 0.125, texel: 1 / 1024, bias: 1 / 2048, softness: 0.25 };
  frames[4] = spotShadowFrame(spot, scene, null, 1024);
  const packed = pack(lights, frames), previous = pack(lights.map(light => light === selected ? { ...light, shadowRadius: 0 } : light), frames);
  assert.deepEqual(packed.slice(0, paramsStart), previous.slice(0, paramsStart));
  assert.deepEqual([...packed.slice(paramsStart)], [...Float32Array.from([faces[0].near, faces[0].far, 0.5, 0])]);
  assert.equal(new Uint32Array(packed.buffer)[557], 2); assert.equal(packed[563], 0.25);
  assert.equal(packed[219], 0.25, 'legacy directional softness keeps its original field');
});

test('point PCSS metadata clears on incomplete six-face input, zero radius, disabled casting and reused storage', () => {
  const light = point({ shadowRadius: 0.25 }), frames = slots(pointShadowFrames(light, scene, null, 1024)), packed = pack([light], frames);
  assert.equal(packed[paramsStart + 2], 0.25);
  for (const missing of [8, 10, 13]) {
    const partial = frames.slice(); partial[missing] = null; pack([light], partial, packed);
    assert.deepEqual([...packed.slice(paramsStart)], [0, 0, 0, 0]); assert.equal(new Uint32Array(packed.buffer)[557], 0);
  }
  const sparse = frames.slice(); delete sparse[12]; pack([light], sparse, packed);
  assert.deepEqual([...packed.slice(paramsStart)], [0, 0, 0, 0]);
  pack([light], frames, packed); assert.equal(packed[paramsStart + 2], 0.25);
  light.shadowRadius = 0; pack([light], frames, packed); assert.deepEqual([...packed.slice(paramsStart)], [0, 0, 0, 0]);
  light.shadowRadius = 0.25; pack([light], frames, packed); light.castShadow = false;
  assert.equal(pack([light], frames, packed), packed); assert.deepEqual([...packed.slice(paramsStart)], [0, 0, 0, 0]);
});

test('point PCSS preparation leaves caller data untouched and six faces own their near-far and eye snapshots', () => {
  const light = point({ shadowRadius: 0.5, position: [1, -2, 3] }), bounds = structuredClone(scene), before = structuredClone({ light, bounds });
  const frames = pointShadowFrames(light, bounds, null, 1024), snapshots = structuredClone(frames);
  pack([light], slots(frames)); assert.deepEqual({ light, bounds }, before); assert.deepEqual(frames, snapshots);
  light.position[0] = 9; light.range = 20; light.shadowRadius = 1;
  frames.forEach((frame, i) => { assert.equal(frame.near, snapshots[i].near); assert.equal(frame.far, snapshots[i].far); assert.deepEqual(frame.eye, [1, -2, 3]); });
  frames[0].eye[1] = 9; assert.deepEqual(frames[1].eye, [1, -2, 3]);
});

test('point blocker eligibility compares receiver and stored depth on the same selected texel ray', () => {
  const frames = pointShadowFrames(point({ shadowRadius: 0.25 }), { min: [3, -1, 3], max: [8, 1, 8] }, null, 16), frame = frames[0];
  close(frame.near, 1); close(frame.far, 10);
  const queryRay = [1, 0, 0.95], queryDirection = unit(queryRay), queryUV = project(frame.viewProjection, queryDirection).uv;
  const pixel = queryUV.map(value => Math.min(15, Math.max(0, Math.floor(value * 16))));
  assert.deepEqual(pixel, [0, 8]);
  const texelRay = faceRay(0, (pixel[0] + 0.5) / 16, (pixel[1] + 0.5) / 16), texelDirection = unit(texelRay);
  assert.deepEqual(texelRay, [1, 0.0625, 0.9375]);
  for (const [receiver, blocker, bias] of [[10, 9.99, 0], [9.8, 9.76, frame.bias]]) {
    const query = project(frame.viewProjection, queryDirection.map(value => value * receiver));
    const stored = project(frame.viewProjection, texelDirection.map(value => value * blocker)).depth;
    assert.equal(stored < query.depth - bias, false, 'query-ray reference rejects this real radial blocker');
    const factor = Math.hypot(...texelRay) / Math.max(...texelRay.map(Math.abs)), receiverAxial = receiver / factor;
    const reference = (1 - frame.near / receiverAxial) / (1 - frame.near / frame.far);
    const sameRayReceiver = project(frame.viewProjection, texelDirection.map(value => value * receiver));
    close(reference, sameRayReceiver.depth); assert.ok(stored < reference - bias);
    const restored = frame.near / (1 - stored * (1 - frame.near / frame.far)) * factor;
    close(restored, blocker); assert.ok(restored < receiver);
  }
});

test('Viewer.create rejects an invalid enabled point emitter radius before GPU or canvas allocation', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator'); let gpuAccesses = 0, contextAccesses = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { get gpu() { gpuAccesses++; throw new Error('GPU must not be accessed'); } } });
  const canvas = { width: 320, height: 240, getContext() { contextAccesses++; throw new Error('Canvas context must not be accessed'); } };
  try {
    await assert.rejects(Viewer.create(canvas, { lights: [point({ shadowRadius: -1 })], controls: false, autoResize: false }), lightError);
    assert.equal(gpuAccesses, 0); assert.equal(contextAccesses, 0); assert.deepEqual([canvas.width, canvas.height], [320, 240]);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'navigator', previous); else delete globalThis.navigator;
  }
});
