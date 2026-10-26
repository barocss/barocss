// CPU contract for world-radius spot PCSS. Native filtering and visible penumbrae need separate GPU proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../dist/viewer/camera.js';
import { identity } from '../dist/viewer/math.js';
import { packFrame } from '../dist/viewer/lights.js';
import { FRAME_BYTES, MAX_SHADOWS } from '../dist/viewer/shaders.js';
import { spotShadowFrame, validateSpotShadowLights } from '../dist/viewer/spot-shadow.js';
import { pointShadowFrames } from '../dist/viewer/point-shadow.js';
import { Viewer, ViewerError } from '../dist/viewer/viewer.js';

const spot = overrides => ({ kind: 'spot', position: [0, 0, 0], direction: [0, 0, -1], range: 10, angle: 30, castShadow: true, ...overrides });
const scene = { min: [-1, -1, -4], max: [1, 1, -2] };
const lightError = error => error instanceof ViewerError && error.code === 'LIGHT_INVALID';
const close = (a, b, epsilon = 1e-11) => assert.ok(Math.abs(a - b) <= epsilon * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function clip(matrix, p) {
  const v = [...p, 1];
  return [0, 1, 2, 3].map(row => v.reduce((sum, value, col) => sum + matrix[col * 4 + row] * value, 0));
}
const slots = frames => [null, null, null, null, ...frames];
const pack = (lights, frames, into = null) => packFrame(identity(), new Camera(), lights, {}, null, undefined, null, null, into, frames);
const paramsStart = 560;

test('omitted or zero spot disk radius preserves PCF matrices, legacy frame bytes and zero PCSS metadata', () => {
  assert.equal(FRAME_BYTES, 2304); assert.equal(MAX_SHADOWS, 14);
  const omitted = spot(), zero = spot({ shadowRadius: 0 });
  const before = spotShadowFrame(omitted, scene, null, 1024), after = spotShadowFrame(zero, scene, null, 1024);
  assert.deepEqual(after.viewProjection, before.viewProjection); assert.equal(after.softness, 0);
  const a = pack([omitted], slots([before])), b = pack([zero], slots([after]));
  assert.deepEqual(b, a); assert.deepEqual([...a.slice(paramsStart)], new Array(16).fill(0));
  assert.equal(a.byteLength - 64, 2240, 'the previous complete frame remains the prefix');
});

test('spot perspective metadata independently recovers actual axial distance and focal length', () => {
  const light = spot({ shadowRadius: 0.25 }), frame = spotShadowFrame(light, scene, null, 1024);
  assert.ok(frame.near > 0 && frame.near < frame.far); close(frame.far, 10); close(frame.focal, Math.sqrt(3));
  for (const depth of [frame.near, 2, 4, 8, frame.far]) {
    const projected = clip(frame.viewProjection, [0.25 * depth, -0.2 * depth, -depth]);
    const d = projected[2] / projected[3], reconstructed = frame.near / (1 - d * (1 - frame.near / frame.far));
    close(reconstructed, depth); close(projected[3], depth);
    close(projected[0] / projected[3], Math.sqrt(3) * 0.25);
  }
  const atNear = clip(frame.viewProjection, [0, 0, -frame.near]), atFar = clip(frame.viewProjection, [0, 0, -frame.far]);
  close(atNear[2] / atNear[3], 0); close(atFar[2] / atFar[3], 1);
});

test('enabled spot disk radius rejects negative, nonfinite, f32-overflow and positive-underflow values before a scene exists', () => {
  for (const shadowRadius of [-1, NaN, Infinity, -Infinity, Number.MAX_VALUE, Number.MIN_VALUE, null, '1']) {
    const light = spot({ shadowRadius });
    assert.throws(() => validateSpotShadowLights([light]), lightError);
    assert.throws(() => spotShadowFrame(light, null, null, 1024), lightError);
  }
  for (const shadowRadius of [0, -0, 0.125, 3.4028234663852886e38]) {
    assert.doesNotThrow(() => validateSpotShadowLights([spot({ shadowRadius })]));
    assert.equal(spotShadowFrame(spot({ shadowRadius }), null, null, 1024), null);
  }
});

test('spot radius admission is limited to enabled shadows among the first four spots and remains separate from cone penumbra', () => {
  const invalid = spot({ shadowRadius: NaN }), disabled = spot({ shadowRadius: NaN, castShadow: false });
  assert.doesNotThrow(() => validateSpotShadowLights([disabled]));
  assert.equal(spotShadowFrame(disabled, scene, null, 1024), null);
  assert.doesNotThrow(() => validateSpotShadowLights([spot(), spot(), spot(), spot(), invalid]));
  assert.throws(() => validateSpotShadowLights([spot(), spot(), spot(), invalid]), lightError);
  const light = spot({ shadowRadius: 0.5, penumbra: 0.8 }), frame = spotShadowFrame(light, scene, null, 1024);
  const packed = pack([light], slots([frame]));
  assert.equal(packed[paramsStart + 3], 0.5);
  close(packed[148], Math.cos(30 * Math.PI / 180 * 0.2), 1e-7);
  close(packed[149], Math.cos(Math.PI / 6), 1e-7);
});

test('PCSS refuses unrepresentable scalar depth bounds without tightening the previous PCF projection range contract', () => {
  const distant = { min: [-1, -1, -2e37], max: [1, 1, -1e37] }, pcf = spot({ range: 1e40 });
  const frame = spotShadowFrame(pcf, distant, null, 1024);
  assert.ok(frame.viewProjection.every(value => Number.isFinite(Math.fround(value))));
  assert.ok(frame.far > 3.4028234663852886e38);
  assert.deepEqual([...pack([pcf], slots([frame])).slice(paramsStart)], new Array(16).fill(0));
  assert.throws(() => spotShadowFrame({ ...pcf, shadowRadius: 0.25 }, distant, null, 1024), lightError);
});

test('spot PCSS parameters use independent spot indices while all existing directional and point bytes stay unchanged', () => {
  const directional = { kind: 'directional', direction: [0, 0, -1], castShadow: true };
  const point = { kind: 'point', position: [0, 0, 0], range: 10, castShadow: true };
  const spots = [spot({ shadowRadius: 0.125 }), spot({ shadowRadius: 0.25, castShadow: false }), spot({ shadowRadius: 0.5, angle: 45 }), spot({ shadowRadius: 0 })];
  const frames = new Array(14).fill(null), directionalMatrix = identity(); directionalMatrix[12] = 7;
  frames[0] = { viewProjection: directionalMatrix, normalOffset: 0.125, texel: 1 / 1024, bias: 1 / 2048, softness: 0.25 };
  spots.forEach((light, i) => { frames[4 + i] = spotShadowFrame(light, scene, null, 1024); });
  pointShadowFrames(point, scene, null, 1024).forEach((frame, face) => { frames[8 + face] = frame; });
  const lights = [spots[0], point, spots[1], directional, spots[2], spots[3]], before = structuredClone({ lights, frames });
  const packed = pack(lights, frames), words = new Uint32Array(packed.buffer);
  const pcfLights = lights.map(light => light.kind === 'spot' ? { ...light, shadowRadius: 0 } : light), pcf = pack(pcfLights, frames);
  assert.deepEqual(packed.slice(0, paramsStart), pcf.slice(0, paramsStart));
  assert.equal(words[39], 1); assert.equal(words[556], 0x3fd1); assert.deepEqual([...words.slice(557, 560)], [1, 0, 0]);
  for (const i of [0, 2]) {
    const frame = frames[4 + i];
    assert.deepEqual([...packed.slice(paramsStart + i * 4, paramsStart + i * 4 + 4)], [...Float32Array.from([frame.near, frame.far, frame.focal, spots[i].shadowRadius])]);
  }
  for (const i of [1, 3]) assert.deepEqual([...packed.slice(paramsStart + i * 4, paramsStart + i * 4 + 4)], [0, 0, 0, 0]);
  assert.deepEqual({ lights, frames }, before);
});

test('reused frame storage clears spot PCSS metadata when radius becomes zero or a shadow becomes inactive', () => {
  const lights = [spot({ shadowRadius: 0.25 })], frame = spotShadowFrame(lights[0], scene, null, 1024), frames = slots([frame]);
  const packed = pack(lights, frames); assert.equal(packed[paramsStart + 3], 0.25);
  lights[0].shadowRadius = 0; assert.equal(pack(lights, frames, packed), packed);
  assert.deepEqual([...packed.slice(paramsStart)], new Array(16).fill(0));
  lights[0].shadowRadius = 0.25; pack(lights, frames, packed); assert.equal(packed[paramsStart + 3], 0.25);
  frames[4] = null; pack(lights, frames, packed);
  assert.deepEqual([...packed.slice(paramsStart)], new Array(16).fill(0));
});

test('spot PCSS preparation preserves caller bounds and light settings while returning independent projection metadata', () => {
  const light = spot({ shadowRadius: 0.25, position: [1, -2, 3] }), bounds = structuredClone(scene), before = structuredClone({ light, bounds });
  const frame = spotShadowFrame(light, bounds, null, 1024), projection = frame.viewProjection.slice(), near = frame.near, far = frame.far, focal = frame.focal;
  pack([light], slots([frame])); assert.deepEqual({ light, bounds }, before);
  light.position[0] = 9; light.angle = 45; light.range = 20; light.shadowRadius = 0.5;
  assert.deepEqual(frame.eye, [1, -2, 3]); assert.deepEqual(frame.viewProjection, projection);
  assert.equal(frame.near, near); assert.equal(frame.far, far); assert.equal(frame.focal, focal);
});

test('Viewer.create refuses an invalid enabled spot disk radius before GPU or canvas context access', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator'); let gpuAccesses = 0, contextAccesses = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { get gpu() { gpuAccesses++; throw new Error('GPU must not be accessed'); } } });
  const canvas = { width: 320, height: 240, getContext() { contextAccesses++; throw new Error('Canvas context must not be accessed'); } };
  try {
    await assert.rejects(Viewer.create(canvas, { lights: [spot({ shadowRadius: -1 })], controls: false, autoResize: false }), lightError);
    assert.equal(gpuAccesses, 0); assert.equal(contextAccesses, 0); assert.deepEqual([canvas.width, canvas.height], [320, 240]);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'navigator', previous); else delete globalThis.navigator;
  }
});
