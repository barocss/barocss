import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../dist/viewer/camera.js';
import { identity } from '../dist/viewer/math.js';
import { packFrame } from '../dist/viewer/lights.js';
import { FRAME_BYTES, MAX_DIRECTIONAL, MAX_SHADOWS } from '../dist/viewer/shaders.js';
import { Viewer } from '../dist/viewer/viewer.js';

const camera = new Camera(), view = identity();
const legacyFloats = 1104 / 4, shadowStride = 80 / 4;
const maskIndex = legacyFloats + MAX_SHADOWS * shadowStride;
const light = (castShadow = true) => ({ kind: 'directional', direction: [0, 0, -1], castShadow });
const shadow = seed => {
  const viewProjection = identity(); viewProjection[12] = seed; viewProjection[13] = seed * 2;
  return { viewProjection, normalOffset: seed / 8, texel: 1 / 1024, bias: 1 / 2048, softness: seed / 16 };
};
const pack = (lights, frames, legacy = null, target = null) => packFrame(view, camera, lights, {}, legacy, [640, 480, 2, 7], null, null, target, frames);
const words = frame => new Uint32Array(frame.buffer);
const slot = (frame, index) => frame.slice(legacyFloats + index * shadowStride, legacyFloats + (index + 1) * shadowStride);
const expected = frame => [...frame.viewProjection, frame.normalOffset, frame.texel, frame.bias, frame.softness ?? 0];

test('multi-directional shadow storage follows the unchanged frame prefix and preserves viewport and clip offsets', () => {
  assert.equal(MAX_DIRECTIONAL, 4); assert.equal(MAX_SHADOWS, 14); assert.equal(FRAME_BYTES, 2320);
  const clip = { normal: [0, 1, 0], offset: 3, cap: [1, 0, 0], planes: [{ normal: [0, 1, 0], offset: 3 }], cutout: true };
  const frame = packFrame(view, camera, [], {}, null, [640, 480, 2, 7], null, clip);
  assert.equal(frame.byteLength, 2320);
  assert.deepEqual([...frame.slice(220, 224)], [640, 480, 2, 7]);
  assert.deepEqual([...frame.slice(248, 252)], [1, 0, 0, -1]);
  assert.deepEqual([...frame.slice(252, 256)], [0, 1, 0, 3]);
  assert.deepEqual([...frame.slice(legacyFloats)], new Array(FRAME_BYTES / 4 - legacyFloats).fill(0));
});

test('a legacy single shadow populates its directional slot and keeps the original primary shadow fields', () => {
  const frame = shadow(2), lights = [light(false), { kind: 'point', position: [1, 2, 3] }, light()];
  const packed = pack(lights, undefined, frame);
  assert.deepEqual([...words(packed).slice(36, 40)], [2, 1, 0, 2]);
  assert.equal(words(packed)[maskIndex], 2);
  assert.deepEqual([...packed.slice(200, 220)], expected(frame));
  assert.deepEqual([...slot(packed, 1)], expected(frame));
  for (const i of [0, 2, 3]) assert.deepEqual([...slot(packed, i)], new Array(20).fill(0));
});

test('four directional casters retain independent matrices and parameters while a fifth is excluded', () => {
  const frames = [1, 2, 3, 4, 5].map(shadow);
  const packed = pack([light(), light(), light(), light(), light()], frames);
  assert.equal(words(packed)[36], 4); assert.equal(words(packed)[39], 1);
  assert.equal(words(packed)[maskIndex], 15);
  for (let i = 0; i < 4; i++) assert.deepEqual([...slot(packed, i)], expected(frames[i]));
  assert.deepEqual([...packed.slice(200, 220)], expected(frames[0]));
  assert.deepEqual([...words(packed).slice(maskIndex + 1)], new Array(FRAME_BYTES / 4 - maskIndex - 1).fill(0));
});

test('sparse caster metadata keeps directional indices while texture layers can be compacted', () => {
  const frames = [shadow(1), shadow(2), shadow(3), null];
  const packed = pack([light(), light(false), light(), light()], frames);
  assert.equal(words(packed)[maskIndex], 5); assert.equal(words(packed)[39], 1);
  assert.deepEqual([...slot(packed, 0)], expected(frames[0]));
  assert.deepEqual([...slot(packed, 2)], expected(frames[2]));
  for (const i of [1, 3]) assert.deepEqual([...slot(packed, i)], new Array(20).fill(0));
  const later = pack([light(), light()], [null, shadow(4)]);
  assert.equal(words(later)[39], 2); assert.equal(words(later)[maskIndex], 2);
  assert.deepEqual([...later.slice(200, 220)], expected(shadow(4)));
});

test('explicit inactive frames override the legacy shadow and a reused target clears previous shadow state', () => {
  const lights = [light(), light(), light(), light()];
  const target = pack(lights, [shadow(1), shadow(2), shadow(3), shadow(4)]);
  const packed = pack(lights, [null, null, null, null], shadow(9), target);
  assert.equal(packed, target); assert.equal(words(packed)[39], 0); assert.equal(words(packed)[maskIndex], 0);
  assert.deepEqual([...packed.slice(200, 220)], new Array(20).fill(0));
  assert.deepEqual([...packed.slice(legacyFloats)], new Array(FRAME_BYTES / 4 - legacyFloats).fill(0));
  const absent = pack([light()], undefined);
  assert.equal(words(absent)[39], 0); assert.equal(words(absent)[maskIndex], 0);
  const fifthOnly = pack([light(false), light(false), light(false), light(false), light()], [null, null, null, null, shadow(1)], shadow(1));
  assert.equal(words(fifthOnly)[39], 0); assert.equal(words(fifthOnly)[maskIndex], 0);
});

test('packing multiple shadows does not change caller matrices, light arrays or frame metadata', () => {
  const lights = [light(), light(false), light(), light()], frames = [shadow(1), null, shadow(3), shadow(4)];
  const beforeLights = structuredClone(lights), beforeFrames = structuredClone(frames), beforeView = [...view], beforeCamera = camera.state();
  Object.freeze(lights); Object.freeze(frames);
  for (const frame of frames) if (frame) Object.freeze(frame);
  pack(lights, frames);
  assert.deepEqual(lights, beforeLights); assert.deepEqual(frames, beforeFrames);
  assert.deepEqual([...view], beforeView); assert.deepEqual(camera.state(), beforeCamera);
});

// Structural resource checks only: no shader compilation, native GPU execution or image claim.
test('shadow redraw caches stay independent per layer and caster motion invalidates every affected layer', () => {
  const viewer = Object.create(Viewer.prototype);
  Object.assign(viewer, {
    device: {}, shadowMapSize: 2048, clip: null, ids: new WeakMap(), nextObjectId: 1,
    shadowCache: Array.from({ length: MAX_SHADOWS }, () => ({ drawn: new Float64Array(0), next: new Float64Array(0), length: -1 })),
  });
  const caster = { slot: 2, geometry: { gpu: null }, instances: null, transform: identity() };
  const matrices = [1, 2, 3, 4].map(seed => shadow(seed).viewProjection);
  assert.equal(viewer.shadowChanged(0, matrices[0], [caster]), true);
  assert.equal(viewer.shadowChanged(0, matrices[0], [caster]), false);
  assert.equal(viewer.shadowChanged(1, matrices[1], [caster]), true);
  assert.equal(viewer.shadowChanged(0, matrices[0], [caster]), false, 'another light must not replace layer zero cache');
  for (const layer of [2, 3]) assert.equal(viewer.shadowChanged(layer, matrices[layer], [caster]), true);
  caster.transform[12] = 5;
  for (let layer = 0; layer < 4; layer++) {
    assert.equal(viewer.shadowChanged(layer, matrices[layer], [caster]), true, `caster motion changes layer ${layer}`);
    assert.equal(viewer.shadowChanged(layer, matrices[layer], [caster]), false);
  }
});

test('each shadow render view addresses one fixed two-dimensional array layer', () => {
  const viewer = Object.create(Viewer.prototype), descriptors = [];
  viewer.shadowMap = { createView(descriptor) { descriptors.push(descriptor); return { descriptor }; } };
  const first = viewer.shadowLayer(0), fourth = viewer.shadowLayer(3);
  assert.deepEqual(descriptors, [
    { dimension: '2d', baseArrayLayer: 0, arrayLayerCount: 1 },
    { dimension: '2d', baseArrayLayer: 3, arrayLayerCount: 1 },
  ]);
  assert.notEqual(first, fourth);
});

test('active shadow layers zero and three keep different uniform buffers after both queue writes', () => {
  const viewer = Object.create(Viewer.prototype), writes = [];
  const buffer = () => ({ bytes: new Uint8Array(FRAME_BYTES) });
  Object.assign(viewer, {
    canvas: { width: 640, height: 480 }, pixelRatio: 1, camera: new Camera(),
    lights: [light(), light(false), light(false), light()], environment: {}, clip: null, grid: { visible: false },
    meshes: [], frameBuffer: buffer(), shadowFrameBuffers: Array.from({ length: MAX_SHADOWS }, buffer),
    sceneBounds() { return null; },
    device: { queue: { writeBuffer(target, offset, data) {
      const bytes = Uint8Array.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      target.bytes.set(bytes, offset); writes.push({ target, bytes });
    } } },
  });
  const first = { ...shadow(1), eye: [1, 2, 3], direction: [0, 0, -1] };
  const fourth = { ...shadow(9), eye: [9, 8, 7], direction: [1, 0, 0] };
  viewer.writeUniforms(identity(), [first, null, null, fourth]);
  assert.equal(writes.length, 3);
  assert.equal(writes[0].target, viewer.frameBuffer);
  assert.equal(writes[1].target, viewer.shadowFrameBuffers[0]);
  assert.equal(writes[2].target, viewer.shadowFrameBuffers[3]);
  assert.notEqual(writes[1].target, writes[2].target, 'queue writes preceding submission must not share the same light buffer');
  for (const [layer, frame] of [[0, first], [3, fourth]]) {
    const stored = new Float32Array(viewer.shadowFrameBuffers[layer].bytes.buffer);
    assert.deepEqual([...stored.slice(0, 16)], [...frame.viewProjection]);
    assert.deepEqual([...stored.slice(16, 20)], [...frame.eye, 0]);
    assert.deepEqual([...stored.slice(20, 23)], frame.direction);
  }
  assert.deepEqual([...new Float32Array(writes[1].bytes.buffer).slice(0, 16)], [...first.viewProjection], 'later scratch-buffer reuse must not change the first queued bytes');
  for (const layer of [1, 2]) assert.ok(viewer.shadowFrameBuffers[layer].bytes.every(byte => byte === 0), 'inactive holes must receive no shadow-pass writes');
  assert.equal(new Uint32Array(viewer.frameBuffer.bytes.buffer)[maskIndex], 9);
});

test('spot-only shadow passes keep perspective cap rays and separate uniforms without a legacy directional caster', () => {
  const viewer = Object.create(Viewer.prototype), writes = [];
  const buffer = () => ({ bytes: new Uint8Array(FRAME_BYTES) });
  const spot = castShadow => ({ kind: 'spot', position: [10, 0, 8], direction: [-10, 0, -8], castShadow });
  Object.assign(viewer, {
    canvas: { width: 640, height: 480 }, pixelRatio: 1, camera: new Camera({ projection: 'orthographic' }),
    lights: [spot(true), spot(false), spot(false), spot(true)], environment: {}, clip: null, grid: { visible: false },
    meshes: [], frameBuffer: buffer(), shadowFrameBuffers: Array.from({ length: MAX_SHADOWS }, buffer),
    sceneBounds() { return null; },
    device: { queue: { writeBuffer(target, offset, data) {
      const bytes = Uint8Array.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      target.bytes.set(bytes, offset); writes.push({ target, bytes });
    } } },
  });
  const first = { ...shadow(2), eye: [10, 0, 8], direction: [-1, 0, -1], perspective: true };
  const last = { ...shadow(7), eye: [-10, 0, 8], direction: [1, 0, -1], perspective: true };
  viewer.writeUniforms(identity(), [null, null, null, null, first, null, null, last]);
  assert.deepEqual(writes.map(write => write.target), [viewer.frameBuffer, viewer.shadowFrameBuffers[4], viewer.shadowFrameBuffers[7]]);
  const frame = new Float32Array(viewer.frameBuffer.bytes.buffer), words = new Uint32Array(frame.buffer);
  assert.equal(words[39], 0, 'spot-only frames do not set the legacy directional index');
  assert.deepEqual([...frame.slice(200, 220)], new Array(20).fill(0));
  assert.equal(words[maskIndex], 0x90);
  for (const [slot, source] of [[4, first], [7, last]]) {
    const stored = new Float32Array(viewer.shadowFrameBuffers[slot].bytes.buffer);
    assert.deepEqual([...stored.slice(16, 20)], [...source.eye, 1], 'spot cap rays must be perspective even for an orthographic camera');
    assert.deepEqual([...stored.slice(0, 16)], [...source.viewProjection]);
  }
  assert.deepEqual([...new Float32Array(writes[1].bytes.buffer).slice(0, 16)], [...first.viewProjection]);
});
