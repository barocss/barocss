import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { importMotionGltfAnimation, MotionGltfError, sampleMotionClip } from '../../packages/barocss-motion/dist/index.js';

const asset = new URL('./assets/gltf-animated-triangle/', import.meta.url);
const gltf = JSON.parse(await readFile(new URL('AnimatedTriangle.gltf', asset), 'utf8'));
const buffers = await Promise.all(gltf.buffers.map(async ({ uri }) =>
  new Uint8Array(await readFile(new URL(uri, asset)))));
const original = buffers.map((buffer) => Uint8Array.from(buffer));
const options = {
  animationIndex: 0,
  contextId: 'animated-triangle',
  nodeTargets: [{ nodeIndex: 0, targetId: 'triangle' }],
  frame: 'gltf-y-up-as-part-xyz',
};
const clip = importMotionGltfAnimation(gltf, buffers, options);
assert.equal(clip.durationSeconds, 1);
assert.equal(clip.tracks.length, 1);
assert.equal(clip.tracks[0].interpolation, 'SLERP');
assert.deepEqual(sampleMotionClip(clip, 0).poses[0].rotation, [0, 0, 0, 1]);
const quarter = sampleMotionClip(clip, 0.25).poses[0].rotation;
assert.ok(Math.abs(Math.hypot(...quarter) - 1) <= 1e-9);
assert.ok(Math.abs(quarter[2] - Math.SQRT1_2) < 1e-6);
assert.ok(Math.abs(quarter[3] - Math.SQRT1_2) < 1e-6);
assert.deepEqual(sampleMotionClip(clip, 0.5).poses[0].rotation, [0, 0, 1, 0]);
assert.deepEqual(sampleMotionClip(clip, 1).poses[0].rotation, [0, 0, 0, 1]);
for (let index = 0; index < buffers.length; index += 1) assert.deepEqual(buffers[index], original[index]);

const translationBuffer = new Uint8Array(32);
const floats = new DataView(translationBuffer.buffer);
[0, 1, 0, 0, 0, 0.02, 0, -0.03].forEach((number, index) => floats.setFloat32(index * 4, number, true));
const translationGltf = {
  asset: { version: '2.0' }, nodes: [{}], buffers: [{ byteLength: 32 }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 8 }, { buffer: 0, byteOffset: 8, byteLength: 24 }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 2, type: 'SCALAR' },
    { bufferView: 1, componentType: 5126, count: 2, type: 'VEC3' },
  ],
  animations: [{ samplers: [{ input: 0, output: 1, interpolation: 'LINEAR' }],
    channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }] }],
};
const translated = importMotionGltfAnimation(translationGltf, [translationBuffer], options);
const end = sampleMotionClip(translated, 1).poses[0].translation;
assert.ok(Math.abs(end[0] - 20) < 1e-6);
assert.equal(end[1], 0);
assert.ok(Math.abs(end[2] + 30) < 1e-6);

function refuses(code, source, data = buffers, settings = options) {
  assert.throws(() => importMotionGltfAnimation(source, data, settings),
    (error) => error instanceof MotionGltfError && error.code === code);
}
refuses('UNSUPPORTED', { ...gltf, animations: [{ ...gltf.animations[0],
  samplers: [{ ...gltf.animations[0].samplers[0], interpolation: 'CUBICSPLINE' }] }] });
refuses('UNSUPPORTED', gltf, buffers, { ...options, frame: 'z-up' });
refuses('INVALID_ACCESSOR', gltf, [buffers[0], buffers[1].subarray(0, 99)]);
refuses('INVALID_INPUT', gltf, buffers, { ...options, nodeTargets: [] });
console.log('glTF consumer: real AnimatedTriangle rotation, meter conversion, owned buffers and bounded refusal passed');
