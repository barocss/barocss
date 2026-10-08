import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bakeMotionGltfAnimation, importMotionGltfAnimation, MotionGltfError, sampleMotionClip } from '../../packages/barocss-motion/dist/index.js';

const base = new URL('./assets/gltf-interpolation-test/', import.meta.url);
const gltf = JSON.parse(await readFile(new URL('InterpolationTest.gltf', base), 'utf8'));
const binary = new Uint8Array(await readFile(new URL('InterpolationTest_data.bin', base)));
const original = Uint8Array.from(binary);
const options = {
  animationIndex: 4,
  contextId: 'interpolation-test',
  nodeTargets: [{ nodeIndex: 4, targetId: 'rotating-box' }],
  frame: 'gltf-y-up-as-part-xyz',
};
assert.throws(() => importMotionGltfAnimation(gltf, [binary], options),
  (error) => error instanceof MotionGltfError && error.code === 'UNSUPPORTED');
const clip = bakeMotionGltfAnimation(gltf, [binary], { ...options, subdivisionsPerInterval: 4 });
assert.equal(clip.durationSeconds, 2);
assert.equal(clip.tracks.length, 1);
assert.equal(clip.tracks[0].interpolation, 'SLERP');
assert.equal(clip.tracks[0].keys.length, 17);
assert.deepEqual(sampleMotionClip(clip, 0).poses[0].rotation, [0, 0, 0, 1]);
const quarterOfFirstInterval = sampleMotionClip(clip, 0.125).poses[0].rotation;
assert.ok(Math.abs(quarterOfFirstInterval[2] + 0.057677131422177695) < 1e-7);
assert.ok(Math.abs(quarterOfFirstInterval[3] - 0.9983352886234709) < 1e-7);
assert.deepEqual(sampleMotionClip(clip, 2).poses[0].rotation, [0, 0, -1, 0]);
assert.deepEqual(binary, original);

const syntheticBytes = new Uint8Array(152);
const floats = new DataView(syntheticBytes.buffer);
const times = [0, 1];
const translation = [
  [0, 0, 0], [0, 0, 0], [2, 0, 0],
  [0, 0, 0], [1, 0, 0], [0, 0, 0],
];
const scale = [
  [0, 0, 0], [1, 1, 1], [1, 1, 1],
  [0, 0, 0], [2, 2, 2], [0, 0, 0],
];
times.forEach((value, index) => floats.setFloat32(index * 4, value, true));
translation.flat().forEach((value, index) => floats.setFloat32(8 + index * 4, value, true));
scale.flat().forEach((value, index) => floats.setFloat32(80 + index * 4, value, true));
const synthetic = {
  asset: { version: '2.0' }, nodes: [{}, {}], buffers: [{ byteLength: 152 }],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: 8 },
    { buffer: 0, byteOffset: 8, byteLength: 72 },
    { buffer: 0, byteOffset: 80, byteLength: 72 },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 2, type: 'SCALAR' },
    { bufferView: 1, componentType: 5126, count: 6, type: 'VEC3' },
    { bufferView: 2, componentType: 5126, count: 6, type: 'VEC3' },
  ],
  animations: [{
    samplers: [{ input: 0, output: 1, interpolation: 'CUBICSPLINE' },
      { input: 0, output: 2, interpolation: 'CUBICSPLINE' }],
    channels: [{ sampler: 0, target: { node: 0, path: 'translation' } },
      { sampler: 1, target: { node: 1, path: 'scale' } }],
  }],
};
const syntheticOptions = {
  animationIndex: 0, contextId: 'synthetic-cubic',
  nodeTargets: [{ nodeIndex: 0, targetId: 'moving' }, { nodeIndex: 1, targetId: 'scaling' }],
  frame: 'gltf-y-up-as-part-xyz', subdivisionsPerInterval: 4,
};
const syntheticClip = bakeMotionGltfAnimation(synthetic, [syntheticBytes], syntheticOptions);
const midpoint = sampleMotionClip(syntheticClip, 0.5).poses;
assert.deepEqual(midpoint[0].translation, [750, 0, 0]);
assert.deepEqual(midpoint[1].scale, [1.625, 1.625, 1.625]);
assert.throws(() => bakeMotionGltfAnimation(synthetic, [syntheticBytes], { ...syntheticOptions, subdivisionsPerInterval: 17 }),
  (error) => error instanceof MotionGltfError && error.code === 'INVALID_INPUT');
assert.throws(() => bakeMotionGltfAnimation({ ...synthetic, accessors: [synthetic.accessors[0],
  { ...synthetic.accessors[1], count: 5 }, synthetic.accessors[2]] }, [syntheticBytes], syntheticOptions),
  (error) => error instanceof MotionGltfError && error.code === 'INVALID_ACCESSOR');
console.log('cubic bake: real Khronos rotation, tangent-scaled translation/scale, source ownership and refusals passed');
