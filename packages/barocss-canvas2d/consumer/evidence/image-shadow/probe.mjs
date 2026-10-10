import assert from 'node:assert/strict';
const { shadowImageAsset: shadow, Canvas2DError } = await import(process.env.BAROCSS_SHADOW_MODULE ?? '../../../dist/index.js');
const NativeU8 = Uint8Array, NativeU32 = Uint32Array;
const image = (width, height, bytes) => ({ width, height, pixels: new NativeU8(bytes) });
const baseOptions = { radius: 2, offsetX: 1, offsetY: -1, color: [0.25, 0.5, 1, 0.75] };
// Direct original-alpha square convolution; no separable pass or quantized input.
function naive(asset, options) {
  const output = new NativeU8(asset.pixels.length), area = (2 * options.radius + 1) ** 2;
  for (let y = 0; y < asset.height; y++) for (let x = 0; x < asset.width; x++) {
    let alpha = 0;
    for (let dy = -options.radius; dy <= options.radius; dy++) for (let dx = -options.radius; dx <= options.radius; dx++) {
      const sx = x - options.offsetX + dx, sy = y - options.offsetY + dy;
      if (sx >= 0 && sy >= 0 && sx < asset.width && sy < asset.height) alpha += asset.pixels[(sy * asset.width + sx) * 4 + 3];
    }
    const at = (y * asset.width + x) * 4;
    output[at + 3] = Math.round(alpha / area * options.color[3]);
    if (output[at + 3] !== 0) for (let channel = 0; channel < 3; channel++) output[at + channel] = Math.round(255 * options.color[channel]);
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
function verify(asset, options) {
  const inputBefore = new NativeU8(asset.pixels), optionsBefore = structuredClone(options), expected = naive(asset, options), result = shadow(asset, options);
  assert.deepEqual(Object.keys(result), ['width', 'height', 'pixels']);
  assert.equal(result.width, asset.width); assert.equal(result.height, asset.height);
  assert.ok(result.pixels instanceof NativeU8); assert.notEqual(result.pixels, asset.pixels);
  assert.deepEqual(result.pixels, expected, `${asset.width}x${asset.height} r${options.radius} offset${options.offsetX},${options.offsetY}`);
  assert.deepEqual(asset.pixels, inputBefore); assert.deepEqual(options, optionsBefore); comparisons++; return result;
}
const literals = [];
function literal(name, asset, options, expected) {
  const result = verify(asset, options); assert.deepEqual([...result.pixels], expected, name);
  literals.push({ name, options, pixels: [...result.pixels] });
}
const unshifted = { ...baseOptions, radius: 0, offsetX: 0, offsetY: 0 };
literal('radius zero is colored silhouette', image(1, 1, [12, 230, 3, 255]), unshifted, [64, 128, 255, 191]);
literal('constant outside divisor', image(1, 1, [255, 12, 8, 255]), { ...unshifted, radius: 1 }, [64, 128, 255, 21]);
literal('tiny maximum kernel', image(1, 1, [255, 12, 8, 255]), { ...unshifted, radius: 8 }, [64, 128, 255, 1]);
literal('color alpha applied before rounding', image(1, 1, [255, 12, 8, 5]), { ...unshifted, radius: 1 }, [0, 0, 0, 0]);
literal('transparent source colors ignored', image(1, 1, [255, 255, 255, 0]), unshifted, [0, 0, 0, 0]);
const silhouette = image(3, 2, [
  9, 8, 7, 0, 10, 20, 30, 255, 1, 2, 3, 0,
  4, 5, 6, 0, 7, 8, 9, 0, 10, 11, 12, 0
]);
literal('positive signed shift', silhouette, { ...unshifted, offsetX: 1, offsetY: 1 }, [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 64, 128, 255, 191
]);
literal('negative signed shift', silhouette, { ...unshifted, offsetX: -1 }, [
  64, 128, 255, 191, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
]);
let seed = 0x1240;
function next() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; }
function randomImage(width, height) {
  const pixels = new NativeU8(width * height * 4);
  for (let i = 0; i < pixels.length; i++) pixels[i] = next() >>> 24;
  for (let i = 3; i < pixels.length; i += 12) pixels[i] = 0;
  return { width, height, pixels };
}
const radii = Array.from({ length: 9 }, (_, radius) => radius), offsets = [[0, 0], [-3, -2], [2, 1], [-64, 64], [64, -64]];
const shapes = [[1, 1], [1, 7], [7, 1], [3, 5], [5, 3], [9, 7], [2, 2]];
for (const [width, height] of shapes) {
  const asset = randomImage(width, height);
  for (const radius of radii) for (const [offsetX, offsetY] of offsets) verify(asset, { ...baseOptions, radius, offsetX, offsetY });
}
for (let i = 0; i < 32; i++) {
  const asset = randomImage(1 + next() % 7, 1 + next() % 7);
  for (const radius of radii) {
    const [offsetX, offsetY] = offsets[radius % offsets.length];
    verify(asset, { radius, offsetX, offsetY, color: [next() / 2 ** 32, next() / 2 ** 32, next() / 2 ** 32, next() / 2 ** 32] });
  }
}
const alphaOnly = randomImage(5, 3), differentRGB = { ...alphaOnly, pixels: new NativeU8(alphaOnly.pixels) };
for (let i = 0; i < differentRGB.pixels.length; i++) if (i % 4 !== 3) differentRGB.pixels[i] = 255 - differentRGB.pixels[i];
for (const radius of radii) assert.deepEqual(shadow(alphaOnly, { ...baseOptions, radius }), shadow(differentRGB, { ...baseOptions, radius }));
const first = shadow(alphaOnly, baseOptions), second = shadow(alphaOnly, baseOptions), secondBefore = new NativeU8(second.pixels);
assert.notEqual(first.pixels, second.pixels); first.pixels.fill(255); alphaOnly.pixels.fill(255);
baseOptions.color[0] = 1; assert.deepEqual(second.pixels, secondBefore); baseOptions.color[0] = 0.25;
verify(silhouette, { ...unshifted, color: [1, 1, 1, 0] });

let getters = 0; const refusals = [];
function reject(name, asset, options, code = 'INVALID_ASSET') {
  const run = allocationRun(() => assert.throws(() => shadow(asset, options), error => error instanceof Canvas2DError && error.code === code, name));
  assert.equal(run.allocations.length, 0, name + ' allocated before refusal'); refusals.push({ name, code, allocations: 0 });
}
const validAsset = image(1, 1, [1, 2, 3, 4]);
for (const options of [undefined, null, [], Object.create(baseOptions), { ...baseOptions, extra: true }, { ...baseOptions, [Symbol('field')]: 1 }]) reject('options record', validAsset, options);
for (const key of ['radius', 'offsetX', 'offsetY', 'color']) {
  const absent = { ...baseOptions }; delete absent[key]; reject('missing option ' + key, validAsset, absent);
  const accessor = { ...baseOptions }; Object.defineProperty(accessor, key, { enumerable: true, get() { getters++; return baseOptions[key]; } }); reject('accessor option ' + key, validAsset, accessor);
  const hidden = { ...baseOptions }; Object.defineProperty(hidden, key, { enumerable: false, value: baseOptions[key] }); reject('hidden option ' + key, validAsset, hidden);
}
for (const radius of [undefined, null, -0, -1, 9, 0.5, NaN, Infinity, '1']) reject('radius ' + String(radius), validAsset, { ...baseOptions, radius });
for (const key of ['offsetX', 'offsetY']) for (const value of [undefined, null, -0, -65, 65, 0.5, NaN, Infinity, '1']) reject(key + ' ' + String(value), validAsset, { ...baseOptions, [key]: value });
for (const color of [undefined, null, [], [0, 0, 0], [0, 0, 0, 1, 1], new Float32Array([0, 0, 0, 1]), new (class extends Array {})(0, 0, 0, 1)]) reject('color record', validAsset, { ...baseOptions, color });
for (let component = 0; component < 4; component++) for (const value of [-0, -0.1, 1.1, NaN, Infinity, null, '1']) {
  const color = [0, 0, 0, 1]; color[component] = value; reject('color component ' + component + ' ' + String(value), validAsset, { ...baseOptions, color });
}
const sparseColor = [0, 0, 0, 1]; delete sparseColor[1]; reject('sparse color', validAsset, { ...baseOptions, color: sparseColor });
const extraColor = [0, 0, 0, 1]; extraColor.extra = 1; reject('extra color field', validAsset, { ...baseOptions, color: extraColor });
const symbolColor = [0, 0, 0, 1]; symbolColor[Symbol('field')] = 1; reject('symbol color field', validAsset, { ...baseOptions, color: symbolColor });
for (const enumerable of [true, false]) {
  const color = [0, 0, 0, 1]; Object.defineProperty(color, '0', { enumerable, get() { getters++; return 0; } });
  reject('color accessor ' + enumerable, validAsset, { ...baseOptions, color });
}
const hiddenColor = [0, 0, 0, 1]; Object.defineProperty(hiddenColor, '0', { enumerable: false, value: 0 }); reject('hidden color element', validAsset, { ...baseOptions, color: hiddenColor });
for (const asset of [null, [], Object.create(validAsset), { ...validAsset, extra: true }, { ...validAsset, [Symbol('field')]: 1 }]) reject('asset record', asset, baseOptions);
for (const key of ['width', 'height', 'pixels']) {
  const absent = { ...validAsset }; delete absent[key]; reject('missing asset ' + key, absent, baseOptions);
  const accessor = { ...validAsset }; Object.defineProperty(accessor, key, { enumerable: true, get() { getters++; return validAsset[key]; } }); reject('accessor asset ' + key, accessor, baseOptions);
  const hidden = { ...validAsset }; Object.defineProperty(hidden, key, { enumerable: false, value: validAsset[key] }); reject('hidden asset ' + key, hidden, baseOptions);
}
for (const key of ['width', 'height']) for (const value of [0, -0, 1.5, 4097, NaN, Infinity, '1']) reject(key + ' ' + String(value), { ...validAsset, [key]: value }, baseOptions);
for (const pixels of [[], new Uint8ClampedArray(4), new NativeU8(3), new NativeU8(5), new (class extends NativeU8 {})(4)]) reject('pixel type or extent', { ...validAsset, pixels }, baseOptions);
if (typeof SharedArrayBuffer !== 'undefined') reject('shared pixels', { ...validAsset, pixels: new NativeU8(new SharedArrayBuffer(4)) }, baseOptions);
for (const key of ['buffer', 'byteLength', 'byteOffset', 'length']) {
  const pixels = new NativeU8(4); Object.defineProperty(pixels, key, { get() { getters++; throw Error('metadata getter'); } }); reject('pixel metadata accessor ' + key, { ...validAsset, pixels }, baseOptions);
  const override = new NativeU8(4); Object.defineProperty(override, key, { value: key === 'buffer' ? new ArrayBuffer(4) : 4 }); reject('pixel metadata override ' + key, { ...validAsset, pixels: override }, baseOptions);
}
assert.equal(getters, 0);
reject('over one MiB input', { width: 1024, height: 257, pixels: new NativeU8(1024 * 257 * 4) }, baseOptions, 'ASSET_LIMIT');
const maximumAsset = { width: 1024, height: 256, pixels: new NativeU8(1048576) }; maximumAsset.pixels.set([23, 42, 99, 0]);
const maximum = allocationRun(() => shadow(maximumAsset, { ...baseOptions, radius: 8, offsetX: 64, offsetY: -64 }));
assert.equal(maximum.result.pixels.length, 1048576); assert.ok(maximum.result.pixels.every(value => value === 0));
assert.notEqual(maximum.result.pixels, maximumAsset.pixels); assert.equal(maximum.totalBytes, 3 * 1048576);
assert.deepEqual(maximumAsset.pixels.subarray(0, 4), new NativeU8([23, 42, 99, 0]));
console.log(JSON.stringify({ runtime: process.version, module: process.env.BAROCSS_SHADOW_MODULE ? 'source-bundle' : 'compiled-root',
  oracle: 'independent original-alpha direct square convolution', comparisons, randomImages: 32, radii, offsets, shapes, literals,
  sameSizeCropped: true, colorAlphaBeforeRounding: true, RGBIndependent: true, zeroAlphaClearsRGB: true,
  independentCopies: true, inputAndOptionsRetained: true, getters, refusalAllocations: 0, refusals: refusals.length,
  exactOneMiBInputAdmitted: true, maximumAllocations: maximum.allocations, maximumTypedPayload: maximum.totalBytes,
  refusalCases: refusals }, null, 2));
