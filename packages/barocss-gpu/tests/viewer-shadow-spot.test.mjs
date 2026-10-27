// CPU admission, projection and packing oracles; no native GPU or image proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../dist/viewer/camera.js';
import { identity } from '../dist/viewer/math.js';
import { packFrame } from '../dist/viewer/lights.js';
import { FRAME_BYTES, MAX_SHADOWS } from '../dist/viewer/shaders.js';
import { spotShadowFrame, validateSpotShadowLights } from '../dist/viewer/spot-shadow.js';
import { Viewer, ViewerError } from '../dist/viewer/viewer.js';

const maskIndex = 276 + MAX_SHADOWS * 20;
const spot = overrides => ({ kind: 'spot', position: [0, 0, 0], direction: [0, 0, -1], castShadow: true, ...overrides });
const bounds = { min: [-1, -1, -4], max: [1, 1, -2] };
const lightError = error => error instanceof ViewerError && error.code === 'LIGHT_INVALID';
const close = (a, b, epsilon = 1e-11) => assert.ok(Math.abs(a - b) <= epsilon * Math.max(1, Math.abs(b)), `${a} != ${b}`);
function project(matrix, point) {
  const p = [...point, 1], clip = [0, 1, 2, 3].map(row => p.reduce((sum, value, column) => sum + matrix[column * 4 + row] * value, 0));
  return { clip, ndc: clip.slice(0, 3).map(value => value / clip[3]) };
}
const interval = matrix => ({ near: matrix[14] / matrix[10], far: matrix[14] / (matrix[10] + 1) });

test('enabled spot shadow admission checks finite vectors, a nonzero direction, angle and range even without a scene', () => {
  for (const update of [
    { position: [0, 0] }, { position: [NaN, 0, 0] }, { position: [Number.MAX_VALUE, 0, 0] },
    { direction: [0, 0, 0] }, { direction: [0, Infinity, -1] }, { direction: null },
    { angle: 0 }, { angle: 90 }, { angle: NaN }, { angle: -1 }, { angle: null },
    { range: -1 }, { range: Infinity }, { range: NaN },
  ]) {
    const light = spot(update);
    assert.throws(() => validateSpotShadowLights([light]), lightError);
    assert.throws(() => spotShadowFrame(light, null, null, 1024), lightError);
  }
  assert.doesNotThrow(() => validateSpotShadowLights([spot()]));
  assert.equal(spotShadowFrame(spot(), null, null, 1024), null);
  assert.doesNotThrow(() => validateSpotShadowLights([spot({ castShadow: false, direction: [0, 0, 0], angle: NaN })]));
  assert.doesNotThrow(() => validateSpotShadowLights([spot(), spot(), spot(), spot(), spot({ direction: [0, 0, 0] })]));
});

test('spot projection maps the cone boundary and standard near/far rational depths independently', () => {
  const frame = spotShadowFrame(spot({ angle: 30, range: 10 }), bounds, null, 1024);
  assert.equal(frame.perspective, true); assert.equal(frame.softness, 0);
  const { near, far } = interval(frame.viewProjection);
  close(far, 10); assert.ok(near > 0 && near <= 1);
  close(project(frame.viewProjection, [0, 0, -near]).ndc[2], 0);
  close(project(frame.viewProjection, [0, 0, -far]).ndc[2], 1);
  for (const depth of [2, 4, 8]) {
    const point = project(frame.viewProjection, [0, 0, -depth]);
    close(point.ndc[0], 0); close(point.ndc[1], 0);
    close(point.ndc[2], (1 / near - 1 / depth) / (1 / near - 1 / far));
  }
  const halfWidth = Math.tan(Math.PI / 6) * 4;
  close(project(frame.viewProjection, [halfWidth, 0, -4]).ndc[0], 1);
  close(project(frame.viewProjection, [0, halfWidth, -4]).ndc[1], 1);
  assert.ok(project(frame.viewProjection, [halfWidth * 1.1, 0, -4]).ndc[0] > 1);
  assert.ok(project(frame.viewProjection, [0, 0, 1]).clip[3] < 0, 'geometry behind the light has negative clip w');
});

test('automatic depth includes raw cap bounds, straddling bounds keep positive near, and fully rear bounds allocate no frame', () => {
  const depth = { min: [-2, -2, -12], max: [2, 2, -10] };
  const frame = spotShadowFrame(spot(), bounds, depth, 1024), fitted = interval(frame.viewProjection);
  assert.ok(fitted.far > 12); assert.ok(fitted.near > 0 && fitted.near <= fitted.far * 0.1);
  assert.ok(project(frame.viewProjection, [0, 0, -12]).ndc[2] < 1);
  const straddling = spotShadowFrame(spot(), { min: [-1, -1, -4], max: [1, 1, 2] }, null, 1024);
  const split = interval(straddling.viewProjection);
  assert.ok(split.near > 0 && split.near <= split.far * 0.1);
  const behind = { min: [-1, -1, 1], max: [1, 1, 4] };
  assert.equal(spotShadowFrame(spot(), behind, null, 1024), null);
  assert.equal(spotShadowFrame(spot({ range: 5 }), behind, null, 1024).perspective, true);
});

test('an arbitrary light axis projects centrally and large positions do not cancel the view basis', () => {
  const position = [2, -3, 4], direction = [2, 1, -2], length = Math.hypot(...direction), axis = direction.map(value => value / length);
  const frame = spotShadowFrame(spot({ position, direction, angle: 25, range: 20 }), { min: [-20, -20, -20], max: [20, 20, 20] }, null, 1024);
  const centre = position.map((value, i) => value + axis[i] * 8);
  close(project(frame.viewProjection, centre).ndc[0], 0); close(project(frame.viewProjection, centre).ndc[1], 0);
  const tangent = [1 / Math.sqrt(5), -2 / Math.sqrt(5), 0];
  const edge = centre.map((value, i) => value + tangent[i] * Math.tan(25 * Math.PI / 180) * 8);
  const projected = project(frame.viewProjection, edge).ndc;
  close(Math.hypot(projected[0], projected[1]), 1);
  const z = 1e20;
  assert.equal(z - 1, z, 'fixture would collapse an eye-plus-direction lookAt target');
  const large = spotShadowFrame(spot({ position: [0, 0, z] }), { min: [-1, -1, z - 65536], max: [1, 1, z - 32768] }, null, 1024);
  assert.deepEqual(large.direction, [0, 0, -1]); assert.equal(large.viewProjection[11], -1);
  assert.ok(large.viewProjection.every(value => Number.isFinite(Math.fround(value))));
});

test('unrepresentable cone or matrix values refuse and projection preparation leaves caller input unchanged', () => {
  assert.throws(() => spotShadowFrame(spot({ angle: 1e-300 }), bounds, null, 1024), lightError);
  assert.throws(() => spotShadowFrame(spot({ position: [3e38, 3e38, 3e38], direction: [-1, -1, -1] }), bounds, null, 1024), lightError);
  const light = spot(), scene = structuredClone(bounds), before = structuredClone({ light, scene });
  const frame = spotShadowFrame(light, scene, null, 1024);
  assert.deepEqual({ light, scene }, before);
  light.position[0] = 7;
  assert.deepEqual(frame.eye, [0, 0, 0], 'shadow metadata owns its light position snapshot');
});

test('subnormal and maximum f32 spot directions pack finite unit axes aligned with the shadow projection', () => {
  const maximum = 3.4028234663852886e38, axis = [Math.SQRT1_2, 0, -Math.SQRT1_2];
  for (const magnitude of [Number.MIN_VALUE, maximum]) {
    const light = spot({ direction: [magnitude, 0, -magnitude], range: 10 });
    const frame = spotShadowFrame(light, { min: [2, -1, -4], max: [4, 1, -2] }, null, 1024);
    const packed = packFrame(identity(), new Camera(), [light], {}, null, undefined, null, null, null, [null, null, null, null, frame]);
    const direction = [...packed.slice(140, 143)];
    assert.ok(direction.every(Number.isFinite)); close(Math.hypot(...direction), 1, 1e-7);
    direction.forEach((value, i) => close(value, axis[i], 1e-7));
    frame.direction.forEach((value, i) => close(value, axis[i]));
    assert.ok(frame.viewProjection.every(value => Number.isFinite(Math.fround(value))));
    const centre = project(frame.viewProjection, axis.map(value => value * 4));
    close(centre.ndc[0], 0); close(centre.ndc[1], 0);
    assert.ok(centre.clip[3] > 0);
  }
});

test('mixed directional and spot metadata keeps slots zero, three, four and seven with mask 0x99', () => {
  assert.equal(MAX_SHADOWS, 14); assert.equal(FRAME_BYTES, 2320);
  const dir = castShadow => ({ kind: 'directional', direction: [0, 0, -1], castShadow });
  const lights = [dir(true), spot(), dir(false), spot({ castShadow: false }), dir(false), dir(true), spot({ castShadow: false }), spot()];
  const shadow = value => { const viewProjection = identity(); viewProjection[12] = value; return { viewProjection, normalOffset: value / 8, texel: 1 / 1024, bias: 1 / 2048, softness: value / 16 }; };
  const frames = [shadow(1), null, null, shadow(4), shadow(5), null, null, shadow(8)], before = structuredClone(frames);
  const packed = packFrame(identity(), new Camera(), lights, {}, null, undefined, null, null, null, frames), words = new Uint32Array(packed.buffer);
  assert.deepEqual([...words.slice(36, 40)], [4, 0, 4, 1]); assert.equal(words[maskIndex], 0x99);
  for (const slot of [0, 3, 4, 7]) {
    const at = 276 + slot * 20;
    assert.deepEqual([...packed.slice(at, at + 16)], [...frames[slot].viewProjection]);
    assert.deepEqual([...packed.slice(at + 16, at + 20)], [frames[slot].normalOffset, frames[slot].texel, frames[slot].bias, slot < 4 ? frames[slot].softness : 0]);
  }
  for (const slot of [1, 2, 5, 6]) assert.deepEqual([...packed.slice(276 + slot * 20, 296 + slot * 20)], new Array(20).fill(0));
  assert.deepEqual([...packed.slice(200, 216)], [...frames[0].viewProjection]); assert.deepEqual(frames, before);
  packFrame(identity(), new Camera(), lights, {}, null, undefined, null, null, packed, new Array(8).fill(null));
  assert.equal(words[maskIndex], 0); assert.deepEqual([...packed.slice(276)], new Array(FRAME_BYTES / 4 - 276).fill(0));
});

test('spot-only shadows leave legacy directional fields empty and exclude the fifth or disabled spot', () => {
  const frame = spotShadowFrame(spot({ range: 10 }), bounds, null, 1024);
  const packed = packFrame(identity(), new Camera(), [spot()], {}, null, undefined, null, null, null, [null, null, null, null, frame]);
  assert.equal(new Uint32Array(packed.buffer)[39], 0); assert.equal(new Uint32Array(packed.buffer)[maskIndex], 16);
  assert.deepEqual([...packed.slice(200, 220)], new Array(20).fill(0));
  const lights = [spot({ castShadow: false }), spot({ castShadow: false }), spot({ castShadow: false }), spot({ castShadow: false }), spot()];
  const excluded = packFrame(identity(), new Camera(), lights, {}, null, undefined, null, null, null, new Array(9).fill(frame));
  assert.equal(new Uint32Array(excluded.buffer)[38], 4); assert.equal(new Uint32Array(excluded.buffer)[maskIndex], 0);
});

test('Viewer.create refuses invalid enabled spot shadows before GPU or canvas context access', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let gpuAccesses = 0, contextAccesses = 0;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { get gpu() { gpuAccesses++; throw new Error('GPU must not be accessed'); } } });
  const canvas = { width: 320, height: 240, getContext() { contextAccesses++; throw new Error('Canvas context must not be accessed'); } };
  try {
    await assert.rejects(Viewer.create(canvas, { lights: [spot({ direction: [0, 0, 0] })], controls: false, autoResize: false }), lightError);
    assert.equal(gpuAccesses, 0); assert.equal(contextAccesses, 0);
    assert.deepEqual([canvas.width, canvas.height], [320, 240]);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'navigator', previous); else delete globalThis.navigator;
  }
});
