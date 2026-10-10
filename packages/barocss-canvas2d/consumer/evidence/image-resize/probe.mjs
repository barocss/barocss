import assert from 'node:assert/strict';
const { resizeImageAsset: resize, Canvas2DError } = await import(process.env.BAROCSS_RESIZE_MODULE ?? '../../../dist/index.js');
const NativeU8 = Uint8Array, NativeU32 = Uint32Array;
const image = (width, height, bytes) => ({ width, height, pixels: new NativeU8(bytes) });
// BigInt coordinates and rational weights are independent of the numeric helper.
const round = (numerator, denominator) => Number((2n * numerator + denominator) / (2n * denominator));
function axis(position, source, destination) {
  const denominator = 2n * BigInt(destination), last = BigInt(source - 1);
  const raw = (2n * BigInt(position) + 1n) * BigInt(source) - BigInt(destination);
  const numerator = raw < 0n ? 0n : raw > last * denominator ? last * denominator : raw;
  const low = numerator / denominator, fraction = numerator % denominator;
  return { low: Number(low), high: Number(low < last ? low + 1n : last), weights: [denominator - fraction, fraction], denominator };
}
function oracle(asset, width, height, sampling) {
  const output = new NativeU8(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const to = (y * width + x) * 4;
    if (sampling === 'nearest') {
      const sx = Number((2n * BigInt(x) + 1n) * BigInt(asset.width) / (2n * BigInt(width)));
      const sy = Number((2n * BigInt(y) + 1n) * BigInt(asset.height) / (2n * BigInt(height)));
      const from = (sy * asset.width + sx) * 4;
      for (let channel = 0; channel < 4; channel++) output[to + channel] = asset.pixels[from + channel];
      continue;
    }
    const ax = axis(x, asset.width, width), ay = axis(y, asset.height, height), denominators = ax.denominator * ay.denominator;
    let alpha = 0n; const premultiplied = [0n, 0n, 0n];
    for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
      const sx = column === 0 ? ax.low : ax.high, sy = row === 0 ? ay.low : ay.high;
      const from = (sy * asset.width + sx) * 4, weight = ax.weights[column] * ay.weights[row], a = BigInt(asset.pixels[from + 3]);
      alpha += weight * a;
      for (let channel = 0; channel < 3; channel++) premultiplied[channel] += weight * a * BigInt(asset.pixels[from + channel]);
    }
    output[to + 3] = round(alpha, denominators);
    if (output[to + 3] > 0) for (let channel = 0; channel < 3; channel++) output[to + channel] = round(premultiplied[channel], alpha);
  }
  return output;
}
let comparisons = 0;
function verify(asset, width, height, sampling) {
  const before = new NativeU8(asset.pixels), expected = oracle(asset, width, height, sampling), result = resize(asset, width, height, sampling);
  assert.deepEqual(Object.keys(result), ['width', 'height', 'pixels']); assert.equal(result.width, width); assert.equal(result.height, height);
  assert.ok(result.pixels instanceof NativeU8); assert.notEqual(result.pixels, asset.pixels);
  assert.deepEqual(result.pixels, expected, `${asset.width}x${asset.height} -> ${width}x${height} ${sampling}`);
  assert.deepEqual(asset.pixels, before); comparisons++; return result;
}
const literals = [];
function literal(name, asset, width, height, sampling, expected) {
  const result = verify(asset, width, height, sampling); assert.deepEqual([...result.pixels], expected, name);
  literals.push({ name, width, height, sampling, pixels: [...result.pixels] });
}
const mixed = image(2, 1, [255, 0, 0, 255, 0, 255, 0, 128]);
literal('nearest center mapping', mixed, 3, 1, 'nearest', [255, 0, 0, 255, 0, 255, 0, 128, 0, 255, 0, 128]);
literal('linear premultiplied center and clamped edges', mixed, 3, 1, 'linear', [255, 0, 0, 255, 170, 85, 0, 192, 0, 255, 0, 128]);
const hidden = image(2, 1, [200, 40, 90, 0, 0, 0, 255, 255]);
literal('nearest identity retains hidden RGB', hidden, 2, 1, 'nearest', [200, 40, 90, 0, 0, 0, 255, 255]);
literal('linear identity normalizes alpha zero', hidden, 2, 1, 'linear', [0, 0, 0, 0, 0, 0, 255, 255]);
literal('linear hidden colors cannot bleed', hidden, 3, 1, 'linear', [0, 0, 0, 0, 0, 0, 255, 128, 0, 0, 255, 255]);
literal('positive interpolated alpha can round to zero', image(2, 1, [12, 230, 3, 0, 255, 0, 0, 1]), 4, 1, 'linear',
  [0, 0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 1, 255, 0, 0, 1]);
let seed = 0x1245;
function next() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; }
function randomImage(width, height) {
  const pixels = new NativeU8(width * height * 4);
  for (let i = 0; i < pixels.length; i++) pixels[i] = next() >>> 24;
  for (let i = 3; i < pixels.length; i += 12) pixels[i] = 0;
  return { width, height, pixels };
}
const shapes = [[1, 1], [1, 7], [7, 1], [2, 2], [3, 5], [5, 3], [9, 7]];
for (const [width, height] of shapes) {
  const asset = randomImage(width, height);
  const destinations = [[width, height], [1, 1], [width * 2 + 1, height * 2 + 1], [Math.max(1, width - 1), Math.max(1, height - 1)]];
  for (const [dw, dh] of destinations) for (const sampling of ['nearest', 'linear']) verify(asset, dw, dh, sampling);
}
for (let test = 0; test < 64; test++) {
  const asset = randomImage(1 + next() % 9, 1 + next() % 9), width = 1 + next() % 13, height = 1 + next() % 13;
  for (const sampling of ['nearest', 'linear']) verify(asset, width, height, sampling);
}
const copySource = randomImage(5, 3);
for (const sampling of ['nearest', 'linear']) {
  const first = resize(copySource, 7, 4, sampling), second = resize(copySource, 7, 4, sampling), before = new NativeU8(second.pixels);
  assert.notEqual(first.pixels, second.pixels); first.pixels.fill(255); assert.deepEqual(second.pixels, before);
}
const isolated = resize(copySource, 7, 4, 'linear'), before = new NativeU8(isolated.pixels);
copySource.pixels.fill(255); assert.deepEqual(isolated.pixels, before);
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
let getters = 0; const refusals = [];
const valid = image(1, 1, [1, 2, 3, 4]);
function reject(name, asset, width, height, sampling, code = 'INVALID_ASSET') {
  const run = allocationRun(() => assert.throws(() => resize(asset, width, height, sampling), error => error instanceof Canvas2DError && error.code === code, name));
  assert.equal(run.allocations.length, 0, name + ' allocated before refusal'); refusals.push({ name, code, allocations: 0 });
}
for (const sampling of [undefined, null, '', 'cubic', 'Nearest', 0, {}, []]) reject('sampling ' + String(sampling), valid, 1, 1, sampling);
for (const width of [undefined, null, -0, 0, -1, 1.5, 4097, NaN, Infinity, '1']) reject('destination width ' + String(width), valid, width, 1, 'nearest');
for (const height of [undefined, null, -0, 0, -1, 1.5, 4097, NaN, Infinity, '1']) reject('destination height ' + String(height), valid, 1, height, 'linear');
for (const asset of [null, [], Object.create(valid), { ...valid, extra: true }, { ...valid, [Symbol('field')]: 1 }]) reject('asset record', asset, 1, 1, 'nearest');
for (const key of ['width', 'height', 'pixels']) {
  const absent = { ...valid }; delete absent[key]; reject('missing asset ' + key, absent, 1, 1, 'linear');
  const accessor = { ...valid }; Object.defineProperty(accessor, key, { enumerable: true, get() { getters++; return valid[key]; } }); reject('asset accessor ' + key, accessor, 1, 1, 'nearest');
  const hiddenField = { ...valid }; Object.defineProperty(hiddenField, key, { enumerable: false, value: valid[key] }); reject('hidden asset ' + key, hiddenField, 1, 1, 'linear');
}
for (const key of ['width', 'height']) for (const value of [0, -0, 1.5, 4097, NaN, Infinity, '1']) reject('source ' + key + ' ' + String(value), { ...valid, [key]: value }, 1, 1, 'nearest');
for (const pixels of [[], new Uint8ClampedArray(4), new NativeU8(3), new NativeU8(5), new (class extends NativeU8 {})(4)]) reject('pixel type or extent', { ...valid, pixels }, 1, 1, 'linear');
if (typeof SharedArrayBuffer !== 'undefined') reject('shared pixel buffer', { ...valid, pixels: new NativeU8(new SharedArrayBuffer(4)) }, 1, 1, 'nearest');
for (const key of ['buffer', 'byteLength', 'byteOffset', 'length']) {
  const pixels = new NativeU8(4); Object.defineProperty(pixels, key, { get() { getters++; throw Error('metadata getter'); } }); reject('pixel metadata accessor ' + key, { ...valid, pixels }, 1, 1, 'linear');
  const override = new NativeU8(4); Object.defineProperty(override, key, { value: key === 'buffer' ? new ArrayBuffer(4) : 4 }); reject('pixel metadata override ' + key, { ...valid, pixels: override }, 1, 1, 'nearest');
}
assert.equal(getters, 0);
reject('input byte budget', { width: 1024, height: 257, pixels: new NativeU8(1024 * 257 * 4) }, 1, 1, 'nearest', 'ASSET_LIMIT');
reject('output byte budget', valid, 1024, 257, 'linear', 'ASSET_LIMIT');
const maximumAsset = { width: 512, height: 512, pixels: new NativeU8(1048576) }; maximumAsset.pixels.set([23, 42, 99, 0]);
const maximum = allocationRun(() => resize(maximumAsset, 512, 512, 'linear'));
assert.equal(maximum.result.pixels.length, 1048576); assert.ok(maximum.result.pixels.every(value => value === 0));
assert.notEqual(maximum.result.pixels, maximumAsset.pixels);
assert.ok(maximum.totalBytes <= 2 * 1048576); assert.ok(maximum.allocations.every(a => a.type === 'Uint8Array'));
assert.deepEqual(maximumAsset.pixels.subarray(0, 4), new NativeU8([23, 42, 99, 0]));
const maxDimension = resize(valid, 4096, 1, 'nearest'); assert.equal(maxDimension.width, 4096); assert.equal(maxDimension.pixels.length, 16384);
assert.deepEqual([...maxDimension.pixels.subarray(-4)], [1, 2, 3, 4]);
console.log(JSON.stringify({ runtime: process.version, module: process.env.BAROCSS_RESIZE_MODULE ? 'source-bundle' : 'compiled-root',
  oracle: 'independent BigInt center coordinates and rational premultiplied weights', comparisons, randomImages: 64,
  modes: ['nearest', 'linear'], shapes, literals, clampedEdges: true, halfUpRounding: true,
  nearestHiddenRGBCopy: true, linearZeroAlphaNormalization: true, noIntermediateQuantization: true,
  independentCopies: true, inputRetained: true, getters, refusalAllocations: 0, refusals: refusals.length,
  exactOneMiBInputOutputAdmitted: true, maximumAllocations: maximum.allocations, maximumTypedPayload: maximum.totalBytes,
  maxDimension4096Admitted: true, refusalCases: refusals }, null, 2));
