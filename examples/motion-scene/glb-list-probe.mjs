import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bakeMotionGlbAnimation, listMotionGlbAnimations, MotionGltfError, sampleMotionClip } from '../../packages/barocss-motion/dist/index.js';

const bytes = new Uint8Array(await readFile(new URL('./assets/gltf-interpolation-test/InterpolationTest.glb', import.meta.url)));
const original = Uint8Array.from(bytes);
const summaries = listMotionGlbAnimations(bytes);
assert.equal(summaries.length, 9);
assert.deepEqual(summaries[4], {
  animationIndex: 4, name: 'CubicSpline Rotation',
  channels: [{ nodeIndex: 4, path: 'rotation', interpolation: 'CUBICSPLINE' }],
});
const selection = summaries.find((summary) => summary.name === 'CubicSpline Rotation');
const clip = bakeMotionGlbAnimation(bytes, {
  animationIndex: selection.animationIndex,
  contextId: 'discovered-cubic',
  nodeTargets: selection.channels.map((channel) => ({ nodeIndex: channel.nodeIndex, targetId: 'rotating-box' })),
  frame: 'gltf-y-up-as-part-xyz', subdivisionsPerInterval: 4,
});
assert.equal(clip.tracks[0].keys.length, 17);
assert.ok(Math.abs(sampleMotionClip(clip, 0.125).poses[0].rotation[2] + 0.057677131422177695) < 1e-7);
summaries[4].channels[0].nodeIndex = 99;
assert.equal(listMotionGlbAnimations(bytes)[4].channels[0].nodeIndex, 4);
assert.deepEqual(bytes, original);

const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const jsonLength = view.getUint32(12, true);
const source = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(20, 20 + jsonLength)));
const binary = bytes.subarray(20 + jsonLength + 8);
function encodeGlb(gltf) {
  const encoded = new TextEncoder().encode(JSON.stringify(gltf));
  const paddedLength = (encoded.length + 3) & ~3;
  const result = new Uint8Array(12 + 8 + paddedLength + 8 + binary.length);
  const header = new DataView(result.buffer);
  header.setUint32(0, 0x46546c67, true);
  header.setUint32(4, 2, true);
  header.setUint32(8, result.length, true);
  header.setUint32(12, paddedLength, true);
  header.setUint32(16, 0x4e4f534a, true);
  result.fill(0x20, 20, 20 + paddedLength);
  result.set(encoded, 20);
  header.setUint32(20 + paddedLength, binary.length, true);
  header.setUint32(24 + paddedLength, 0x004e4942, true);
  result.set(binary, 28 + paddedLength);
  return result;
}
function invalidMetadata(mutate, code) {
  const copy = structuredClone(source);
  mutate(copy);
  assert.throws(() => listMotionGlbAnimations(encodeGlb(copy)),
    (error) => error instanceof MotionGltfError && error.code === code);
}
invalidMetadata((gltf) => { gltf.animations[4].name = 'x'.repeat(129); }, 'INVALID_INPUT');
invalidMetadata((gltf) => { gltf.animations[4].channels[0].sampler = 4; }, 'INVALID_INPUT');
invalidMetadata((gltf) => { gltf.animations[4].channels[0].target.path = 'other'; }, 'UNSUPPORTED');
invalidMetadata((gltf) => { gltf.animations[4].samplers[0].interpolation = 'OTHER'; }, 'UNSUPPORTED');
const noAnimation = structuredClone(source);
delete noAnimation.animations;
assert.deepEqual(listMotionGlbAnimations(encodeGlb(noAnimation)), []);
console.log('GLB list: nine real Khronos animations, selected cubic bake, ownership and metadata refusals passed');
