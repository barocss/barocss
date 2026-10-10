import assert from 'node:assert/strict';
const { blurImageAsset: blur, Canvas2DError } = await import(process.env.BAROCSS_BLUR_MODULE ?? '../../../dist/index.js');
const NativeU8 = Uint8Array, NativeU32 = Uint32Array;
const image = (width, height, bytes) => ({ width, height, pixels: new NativeU8(bytes) });
// Independent direct square convolution. It has no horizontal or vertical pass.
function naive(asset, radius) {
  if (radius === 0) return new NativeU8(asset.pixels);
  const output = new NativeU8(asset.pixels.length), area = (2 * radius + 1) ** 2;
  for (let y = 0; y < asset.height; y++) for (let x = 0; x < asset.width; x++) {
    let alpha = 0, red = 0, green = 0, blue = 0;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const sx = x + dx, sy = y + dy;
      if (sx < 0 || sy < 0 || sx >= asset.width || sy >= asset.height) continue;
      const at = (sy * asset.width + sx) * 4, a = asset.pixels[at + 3];
      alpha += a; red += asset.pixels[at] * a; green += asset.pixels[at + 1] * a; blue += asset.pixels[at + 2] * a;
    }
    const at = (y * asset.width + x) * 4;
    output[at + 3] = Math.round(alpha / area);
    if (output[at + 3] !== 0) {
      output[at] = Math.min(255, Math.round(red / alpha));
      output[at + 1] = Math.min(255, Math.round(green / alpha));
      output[at + 2] = Math.min(255, Math.round(blue / alpha));
    }
  }
  return output;
}
function allocationRun(fn) {
  const allocations = [];
  globalThis.Uint8Array = new Proxy(NativeU8, { construct(target, args) {
    const result = Reflect.construct(target, args); allocations.push({ type: 'Uint8Array', bytes: result.byteLength }); return result;
  } });
  globalThis.Uint32Array = new Proxy(NativeU32, { construct(target, args) {
    const result = Reflect.construct(target, args); allocations.push({ type: 'Uint32Array', bytes: result.byteLength }); return result;
  } });
  try { return { result: fn(), allocations, totalBytes: allocations.reduce((sum, a) => sum + a.bytes, 0) }; }
  finally { globalThis.Uint8Array = NativeU8; globalThis.Uint32Array = NativeU32; }
}
let comparisons = 0;
function verify(asset, radius) {
  const before = new NativeU8(asset.pixels), expected = naive(asset, radius), result = blur(asset, radius);
  assert.deepEqual(Object.keys(result), ['width', 'height', 'pixels']);
  assert.equal(result.width, asset.width); assert.equal(result.height, asset.height);
  assert.ok(result.pixels instanceof NativeU8); assert.notEqual(result.pixels, asset.pixels);
  assert.deepEqual(result.pixels, expected, `${asset.width}x${asset.height} radius ${radius}`);
  assert.deepEqual(asset.pixels, before); comparisons++; return result;
}
const literals = [];
function literal(name, asset, radius, expected) {
  const result = verify(asset, radius); assert.deepEqual([...result.pixels], expected, name);
  literals.push({ name, radius, pixels: [...result.pixels] });
}
literal('radius zero retains hidden colors', image(1, 1, [7, 23, 201, 0]), 0, [7, 23, 201, 0]);
literal('tiny constant outside divisor', image(1, 1, [255, 120, 60, 255]), 1, [255, 120, 60, 28]);
literal('large kernel tiny opaque input', image(1, 1, [255, 120, 60, 255]), 8, [255, 120, 60, 1]);
literal('rounded alpha zero clears RGB', image(1, 1, [255, 120, 60, 128]), 8, [0, 0, 0, 0]);
literal('hidden RGB cannot bleed', image(2, 1, [255, 0, 0, 0, 0, 120, 240, 128]), 1,
  [0, 120, 240, 14, 0, 120, 240, 14]);
literal('partial alpha uses unrounded sums', image(2, 1, [255, 0, 0, 1, 0, 0, 255, 8]), 1,
  [28, 0, 227, 1, 28, 0, 227, 1]);
let seed = 0x1225;
function next() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; }
function randomImage(width, height) {
  const pixels = new NativeU8(width * height * 4);
  for (let i = 0; i < pixels.length; i++) pixels[i] = next() >>> 24;
  for (let i = 3; i < pixels.length; i += 12) pixels[i] = 0;
  return { width, height, pixels };
}
const radii = [0, 1, 2, 8], shapes = [[1, 1], [1, 7], [7, 1], [3, 5], [5, 3], [9, 7], [2, 2]];
for (const [width, height] of shapes) { const asset = randomImage(width, height); for (const radius of radii) verify(asset, radius); }
for (let i = 0; i < 32; i++) {
  const asset = randomImage(1 + next() % 7, 1 + next() % 7);
  for (const radius of radii) verify(asset, radius);
}
const copiedInput = randomImage(5, 3), first = blur(copiedInput, 2), second = blur(copiedInput, 2);
assert.notEqual(first.pixels, second.pixels); const retainedSecond = new NativeU8(second.pixels);
first.pixels.fill(0); assert.deepEqual(second.pixels, retainedSecond);
copiedInput.pixels.fill(255); assert.deepEqual(second.pixels, retainedSecond);
const zeroSource = image(1, 1, [17, 42, 99, 0]), zeroCopy = blur(zeroSource, 0);
zeroCopy.pixels[0] = 100; assert.equal(zeroSource.pixels[0], 17);

let getters = 0;
const refusals = [];
function reject(name, asset, radius, code = 'INVALID_ASSET', noAlloc = false) {
  let allocationCount;
  const fail = () => assert.throws(() => blur(asset, radius), error => error instanceof Canvas2DError && error.code === code, name);
  if (noAlloc) { const run = allocationRun(fail); allocationCount = run.allocations.length; assert.equal(allocationCount, 0, name + ' allocated'); }
  else fail();
  refusals.push({ name, code, ...(noAlloc ? { allocations: allocationCount } : {}) });
}
const valid = image(1, 1, [1, 2, 3, 4]);
for (const radius of [undefined, null, -0, -1, 9, 0.5, NaN, Infinity, '1', {}, []]) reject('radius ' + String(radius), valid, radius, 'INVALID_ASSET', true);
for (const asset of [null, [], Object.create(valid), { ...valid, extra: true }, { ...valid, [Symbol('field')]: 1 }]) reject('record', asset, 1, 'INVALID_ASSET', true);
for (const key of ['width', 'height', 'pixels']) {
  const absent = { ...valid }; delete absent[key]; reject('missing ' + key, absent, 1, 'INVALID_ASSET', true);
  const accessor = { ...valid }; Object.defineProperty(accessor, key, { enumerable: true, get() { getters++; return valid[key]; } }); reject('accessor ' + key, accessor, 1, 'INVALID_ASSET', true);
  const hidden = { ...valid }; Object.defineProperty(hidden, key, { enumerable: false, value: valid[key] }); reject('hidden ' + key, hidden, 1, 'INVALID_ASSET', true);
}
for (const width of [0, -0, 1.5, 4097, NaN, Infinity, '1']) reject('width ' + String(width), { ...valid, width }, 1, 'INVALID_ASSET', true);
for (const height of [0, -0, 1.5, 4097, NaN, Infinity, '1']) reject('height ' + String(height), { ...valid, height }, 1, 'INVALID_ASSET', true);
for (const pixels of [[], new Uint8ClampedArray(4), new NativeU8(3), new NativeU8(5), new (class extends NativeU8 {})(4)]) reject('pixel type or extent', { ...valid, pixels }, 1, 'INVALID_ASSET', true);
if (typeof SharedArrayBuffer !== 'undefined') reject('shared bytes', { ...valid, pixels: new NativeU8(new SharedArrayBuffer(4)) }, 1, 'INVALID_ASSET', true);
for (const key of ['buffer', 'byteLength', 'byteOffset', 'length']) {
  const pixels = new NativeU8(4);
  Object.defineProperty(pixels, key, { configurable: true, get() { getters++; throw Error('metadata getter'); } });
  reject('metadata accessor ' + key, { ...valid, pixels }, 1, 'INVALID_ASSET', true);
  const overridden = new NativeU8(4); Object.defineProperty(overridden, key, { value: key === 'buffer' ? new ArrayBuffer(4) : 4 });
  reject('metadata override ' + key, { ...valid, pixels: overridden }, 1, 'INVALID_ASSET', true);
}
assert.equal(getters, 0);
const oversized = { width: 1024, height: 257, pixels: new NativeU8(1024 * 257 * 4) };
reject('over one MiB', oversized, 1, 'ASSET_LIMIT', true);
const maximum = { width: 1024, height: 256, pixels: new NativeU8(1048576) };
maximum.pixels.set([23, 42, 99, 0]);
const maximumCopy = allocationRun(() => blur(maximum, 0));
assert.equal(maximumCopy.result.pixels.length, 1048576); assert.notEqual(maximumCopy.result.pixels, maximum.pixels);
assert.deepEqual(maximumCopy.result.pixels.subarray(0, 4), new NativeU8([23, 42, 99, 0]));
const maximumBlur = allocationRun(() => blur(maximum, 8));
assert.equal(maximumBlur.result.pixels.length, 1048576); assert.ok(maximumBlur.result.pixels.every(value => value === 0));
assert.ok(maximumBlur.totalBytes <= 6 * 1048576, 'transient typed-array payload exceeds 6MiB');
assert.deepEqual(maximum.pixels.subarray(0, 4), new NativeU8([23, 42, 99, 0]));
console.log(JSON.stringify({ runtime: process.version, module: process.env.BAROCSS_BLUR_MODULE ? 'source-bundle' : 'compiled-root',
  oracle: 'independent direct square convolution', comparisons, randomImages: 32, radii, shapes, literals,
  transparentOutsideConstantArea: true, encodedBytePremultipliedSums: true, noIntermediateRounding: true,
  independentCopies: true, inputRetained: true, getters, earlyOversizeAllocations: 0,
  exactOneMiBAdmitted: true, maximumCopyAllocations: maximumCopy.allocations,
  maximumBlurAllocations: maximumBlur.allocations, maximumBlurTypedPayload: maximumBlur.totalBytes,
  refusals: refusals.length, refusalCases: refusals }, null, 2));
