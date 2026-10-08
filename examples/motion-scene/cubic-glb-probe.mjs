import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bakeMotionGlbAnimation, importMotionGlbAnimation, MotionGltfError, sampleMotionClip } from '../../packages/barocss-motion/dist/index.js';

const bytes = new Uint8Array(await readFile(new URL('./assets/gltf-interpolation-test/InterpolationTest.glb', import.meta.url)));
const original = Uint8Array.from(bytes);
const options = {
  animationIndex: 4,
  contextId: 'interpolation-test',
  nodeTargets: [{ nodeIndex: 4, targetId: 'rotating-box' }],
  frame: 'gltf-y-up-as-part-xyz',
};
const clip = bakeMotionGlbAnimation(bytes, { ...options, subdivisionsPerInterval: 4 });
assert.equal(clip.durationSeconds, 2);
assert.equal(clip.tracks.length, 1);
assert.equal(clip.tracks[0].interpolation, 'SLERP');
assert.equal(clip.tracks[0].keys.length, 17);
const quarter = sampleMotionClip(clip, 0.125).poses[0].rotation;
assert.ok(Math.abs(quarter[2] + 0.057677131422177695) < 1e-7);
assert.ok(Math.abs(quarter[3] - 0.9983352886234709) < 1e-7);
assert.deepEqual(bytes, original);
assert.throws(() => importMotionGlbAnimation(bytes, options),
  (error) => error instanceof MotionGltfError && error.code === 'UNSUPPORTED');

for (const damage of [
  (copy) => { copy[0] = 0; },
  (copy) => { copy[8] = 0; },
]) {
  const invalid = Uint8Array.from(bytes);
  damage(invalid);
  let importError;
  let bakeError;
  try { importMotionGlbAnimation(invalid, options); } catch (error) { importError = error; }
  try { bakeMotionGlbAnimation(invalid, { ...options, subdivisionsPerInterval: 4 }); } catch (error) { bakeError = error; }
  assert.ok(importError instanceof MotionGltfError);
  assert.ok(bakeError instanceof MotionGltfError);
  assert.equal(bakeError.code, importError.code);
  assert.equal(bakeError.message, importError.message);
}
console.log('GLB cubic bake: real Khronos rotation, source bytes, old API refusal, shared container errors passed');
