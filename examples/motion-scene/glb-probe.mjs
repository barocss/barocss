import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { importMotionGlbAnimation, MotionGltfError, sampleMotionClip } from '../../packages/barocss-motion/dist/index.js';

const bytes = new Uint8Array(await readFile(new URL('./assets/gltf-box-animated/BoxAnimated.glb', import.meta.url)));
const original = Uint8Array.from(bytes);
const options = {
  animationIndex: 0,
  contextId: 'box-animated',
  nodeTargets: [{ nodeIndex: 2, targetId: 'rotating-box' }, { nodeIndex: 0, targetId: 'moving-box' }],
  frame: 'gltf-y-up-as-part-xyz',
};
const clip = importMotionGlbAnimation(bytes, options);
assert.equal(clip.tracks.length, 2);
assert.equal(clip.tracks[0].property, 'rotation');
assert.equal(clip.tracks[0].keys.at(-1).timeSeconds, 2.5);
assert.equal(clip.tracks[1].property, 'translation');
assert.equal(clip.tracks[1].keys.at(-1).timeSeconds, clip.durationSeconds);
assert.ok(clip.durationSeconds > 3.7 && clip.durationSeconds < 3.71);
const atRotationEnd = sampleMotionClip(clip, 2.5).poses;
const atClipEnd = sampleMotionClip(clip, clip.durationSeconds).poses;
assert.deepEqual(atRotationEnd[0].rotation, atClipEnd[0].rotation);
assert.notDeepEqual(atRotationEnd[1].translation, atClipEnd[1].translation);
assert.deepEqual(bytes, original);

const jsonLength = new DataView(bytes.buffer, bytes.byteOffset).getUint32(12, true);
const declaredOffset = Buffer.from(bytes).indexOf('9308', 20);
assert.ok(declaredOffset >= 20 && declaredOffset < 20 + jsonLength);
const padded = Uint8Array.from(bytes);
padded[declaredOffset + 3] = '7'.charCodeAt(0); // declared BIN length 9307, one zero pad byte
assert.equal(importMotionGlbAnimation(padded, options).durationSeconds, clip.durationSeconds);
const invalidPadding = Uint8Array.from(padded);
invalidPadding[invalidPadding.length - 1] = 1;
assert.throws(() => importMotionGlbAnimation(invalidPadding, options),
  (error) => error instanceof MotionGltfError && error.code === 'INVALID_ACCESSOR');

const extension = new Uint8Array(bytes.length + 8);
extension.set(bytes);
const extensionView = new DataView(extension.buffer);
extensionView.setUint32(8, extension.length, true);
extensionView.setUint32(bytes.length, 0, true);
extensionView.setUint32(bytes.length + 4, 0x12345678, true);
assert.equal(importMotionGlbAnimation(extension, options).durationSeconds, clip.durationSeconds);

const badMagic = Uint8Array.from(bytes);
badMagic[0] = 0;
assert.throws(() => importMotionGlbAnimation(badMagic, options),
  (error) => error instanceof MotionGltfError && error.code === 'INVALID_INPUT');
assert.throws(() => importMotionGlbAnimation(bytes.subarray(0, -1), options),
  (error) => error instanceof MotionGltfError && error.code === 'INVALID_INPUT');
console.log('GLB consumer: BoxAnimated two-channel timing, source bytes, padding, extension and refusals passed');
