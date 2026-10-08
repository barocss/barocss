import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bakeMotionGltfAnimation, MotionGltfError } from '../../packages/barocss-motion/dist/index.js';

const base = new URL('./assets/gltf-interpolation-test/', import.meta.url);
const dense = JSON.parse(await readFile(new URL('InterpolationTest.gltf', base), 'utf8'));
const denseBytes = new Uint8Array(await readFile(new URL('InterpolationTest_data.bin', base)));
const sparse = JSON.parse(await readFile(new URL('InterpolationTest_sparse.gltf', base), 'utf8'));
const sparseBytes = new Uint8Array(await readFile(new URL('InterpolationTest_sparse_data.bin', base)));
const original = Uint8Array.from(sparseBytes);
const options = {
  animationIndex: 4, contextId: 'interpolation-test',
  nodeTargets: [{ nodeIndex: 4, targetId: 'rotating-box' }],
  frame: 'gltf-y-up-as-part-xyz', subdivisionsPerInterval: 4,
};
const expected = bakeMotionGltfAnimation(dense, [denseBytes], options);
const actual = bakeMotionGltfAnimation(sparse, [sparseBytes], options);
assert.deepEqual(actual, expected);
assert.equal(actual.tracks[0].keys.length, 17);
assert.deepEqual(sparseBytes, original);

const overlay = structuredClone(sparse);
overlay.accessors[11].bufferView = 3;
overlay.accessors[11].byteOffset = 340;
assert.deepEqual(bakeMotionGltfAnimation(overlay, [sparseBytes], options), expected);

for (const [componentType, indexSize] of [[5123, 2], [5125, 4]]) {
  const variant = structuredClone(sparse);
  const extended = new Uint8Array(sparseBytes.length + 15 * indexSize);
  extended.set(sparseBytes);
  const indexView = new DataView(extended.buffer);
  for (let item = 0; item < 15; item += 1) {
    if (indexSize === 2) indexView.setUint16(sparseBytes.length + item * 2, item, true);
    else indexView.setUint32(sparseBytes.length + item * 4, item, true);
  }
  const sparseIndices = variant.accessors[11].sparse.indices;
  variant.bufferViews[sparseIndices.bufferView] = {
    buffer: 0, byteOffset: sparseBytes.length, byteLength: 15 * indexSize,
  };
  sparseIndices.componentType = componentType;
  variant.buffers[0].byteLength = extended.length;
  assert.deepEqual(bakeMotionGltfAnimation(variant, [extended], options), expected);
}

const sparseInput = structuredClone(sparse);
const inputAccessor = sparseInput.accessors[7];
const inputBase = dense.accessors[7];
const inputView = dense.bufferViews[inputBase.bufferView];
const inputStart = inputView.byteOffset + (inputBase.byteOffset ?? 0);
const inputData = sparseBytes.subarray(inputStart, inputStart + inputBase.count * 4);
const inputBytes = new Uint8Array(sparseBytes.length + 8 + inputData.length);
inputBytes.set(sparseBytes);
inputBytes.set([0, 1, 2, 3, 4], sparseBytes.length);
inputBytes.set(inputData, sparseBytes.length + 8);
const inputIndexView = sparseInput.bufferViews.push({ buffer: 0, byteOffset: sparseBytes.length, byteLength: 5 }) - 1;
const inputValueView = sparseInput.bufferViews.push({ buffer: 0, byteOffset: sparseBytes.length + 8, byteLength: inputData.length }) - 1;
delete inputAccessor.bufferView;
delete inputAccessor.byteOffset;
inputAccessor.sparse = { count: 5, indices: { bufferView: inputIndexView, componentType: 5121 },
  values: { bufferView: inputValueView } };
sparseInput.buffers[0].byteLength = inputBytes.length;
assert.deepEqual(bakeMotionGltfAnimation(sparseInput, [inputBytes], options), expected);

const indexOffset = sparse.bufferViews[sparse.accessors[11].sparse.indices.bufferView].byteOffset;
const badOrder = Uint8Array.from(sparseBytes);
badOrder[indexOffset + 1] = 0;
assert.throws(() => bakeMotionGltfAnimation(sparse, [badOrder], options),
  (error) => error instanceof MotionGltfError && error.code === 'INVALID_ACCESSOR');
const badRange = Uint8Array.from(sparseBytes);
badRange[indexOffset + 14] = 15;
assert.throws(() => bakeMotionGltfAnimation(sparse, [badRange], options),
  (error) => error instanceof MotionGltfError && error.code === 'INVALID_ACCESSOR');
const shortRegion = structuredClone(sparse);
shortRegion.bufferViews[sparse.accessors[11].sparse.values.bufferView].byteLength -= 4;
assert.throws(() => bakeMotionGltfAnimation(shortRegion, [sparseBytes], options),
  (error) => error instanceof MotionGltfError && error.code === 'INVALID_ACCESSOR');
const badStride = structuredClone(sparse);
badStride.bufferViews[sparse.accessors[11].sparse.values.bufferView].byteStride = 16;
assert.throws(() => bakeMotionGltfAnimation(badStride, [sparseBytes], options),
  (error) => error instanceof MotionGltfError && error.code === 'UNSUPPORTED');

console.log('sparse glTF: Khronos-derived zero-base, overlay, 8/16/32-bit indices and sparse times equal dense cubic; ownership and refusals passed');
