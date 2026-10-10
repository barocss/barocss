import assert from 'node:assert/strict';
const { packSpriteAtlas: pack, Canvas2DError } = await import(process.env.BAROCSS_PACK_MODULE ?? '../../../dist/index.js');
const NativeU8 = Uint8Array;
function asset(width, height, rgba) {
  const pixels = new NativeU8(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set(rgba, i);
  return { width, height, pixels };
}
const entry = (name, image, durationMS = 40) => ({ name, asset: image, durationMS });
// Group rows first. The independent byte oracle examines each destination pixel.
function oracle(images, maxWidth) {
  const rows = []; let row = [], rowWidth = 0;
  for (const image of images) {
    if (rowWidth + image.asset.width > maxWidth) { rows.push(row); row = []; rowWidth = 0; }
    row.push(image); rowWidth += image.asset.width;
  }
  rows.push(row);
  let y = 0, width = 0; const frames = [];
  for (const items of rows) {
    let x = 0;
    for (const image of items) {
      frames.push({ imageId: 'Atlas', name: image.name, durationMS: image.durationMS,
        sourceRect: { x, y, width: image.asset.width, height: image.asset.height }, input: image.asset });
      x += image.asset.width;
    }
    width = Math.max(width, x); y += Math.max(...items.map(image => image.asset.height));
  }
  const pixels = new NativeU8(width * y * 4);
  for (let py = 0; py < y; py++) for (let px = 0; px < width; px++) {
    const frame = frames.find(({ sourceRect: r }) => px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height);
    if (frame) {
      const rect = frame.sourceRect, from = ((py - rect.y) * rect.width + px - rect.x) * 4, to = (py * width + px) * 4;
      for (let channel = 0; channel < 4; channel++) pixels[to + channel] = frame.input.pixels[from + channel];
    }
  }
  return { width, height: y, pixels, frames };
}
let comparisons = 0;
function verify(images, maxWidth) {
  const before = images.map(image => new NativeU8(image.asset.pixels)), expected = oracle(images, maxWidth), result = pack('Atlas', images, maxWidth);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.atlas));
  assert.deepEqual(Object.keys(result), ['asset', 'atlas']);
  assert.equal(result.asset.width, expected.width); assert.equal(result.asset.height, expected.height);
  assert.deepEqual(result.asset.pixels, expected.pixels);
  for (const [index, frame] of expected.frames.entries()) {
    assert.deepEqual(result.atlas.frame(frame.name), { imageId: 'Atlas', sourceRect: frame.sourceRect, durationMS: frame.durationMS });
    assert.deepEqual(images[index].asset.pixels, before[index]);
  }
  comparisons++; return result;
}
const red = [255, 0, 0, 255], blue = [0, 0, 255, 128], clear = [40, 80, 120, 0], gold = [200, 160, 40, 255], zero = [0, 0, 0, 0];
const fixedInputs = [entry('Red', asset(3, 2, red), 40), entry('Blue', asset(2, 3, blue), 60),
  entry('Clear', asset(1, 2, clear), 20), entry('Gold', asset(4, 1, gold), 80)];
const fixed = verify(fixedInputs, 5);
assert.equal(fixed.asset.width, 5); assert.equal(fixed.asset.height, 5);
const literalGrid = [
  red, red, red, blue, blue,
  red, red, red, blue, blue,
  zero, zero, zero, blue, blue,
  clear, gold, gold, gold, gold,
  clear, zero, zero, zero, zero
];
assert.deepEqual([...fixed.asset.pixels], literalGrid.flat());
assert.deepEqual(fixed.atlas.sequence(['Red', 'Blue', 'Clear', 'Gold']).map(frame => frame.sourceRect), [
  { x: 0, y: 0, width: 3, height: 2 }, { x: 3, y: 0, width: 2, height: 3 },
  { x: 0, y: 3, width: 1, height: 2 }, { x: 1, y: 3, width: 4, height: 1 }
]);
const tiny = verify([entry('Tiny', asset(1, 1, clear))], 1024); assert.equal(tiny.asset.width, 1);
const sixteen = Array.from({ length: 16 }, (_, index) => entry('Frame' + index, asset(1, 1, [index, 255 - index, index * 5, index % 2 ? 0 : 255]), index + 1));
const maxFrames = verify(sixteen, 4); assert.equal(maxFrames.asset.width, 4); assert.equal(maxFrames.asset.height, 4);
const sharedAsset = asset(2, 1, gold); verify([entry('SharedA', sharedAsset), entry('SharedB', sharedAsset)], 3);
let seed = 0x1230;
function next() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; }
for (let test = 0; test < 32; test++) {
  const count = 1 + next() % 16, images = [];
  for (let index = 0; index < count; index++) {
    const width = 1 + next() % 5, height = 1 + next() % 5, pixels = new NativeU8(width * height * 4);
    for (let i = 0; i < pixels.length; i++) pixels[i] = next() >>> 24;
    for (let i = 3; i < pixels.length; i += 12) pixels[i] = 0;
    images.push(entry('Frame' + index, { width, height, pixels }, 1 + next() % 60000));
  }
  verify(images, 5 + next() % 8);
}
const copiedFrame = fixed.atlas.frame('Red'); copiedFrame.sourceRect.x = 99; copiedFrame.durationMS = 99;
assert.deepEqual(fixed.atlas.frame('Red'), { imageId: 'Atlas', sourceRect: { x: 0, y: 0, width: 3, height: 2 }, durationMS: 40 });
const sequence = fixed.atlas.sequence(['Blue', 'Red']); sequence[0].sourceRect.y = 99; sequence.pop();
assert.equal(fixed.atlas.frame('Blue').sourceRect.y, 0);
const priorBytes = new NativeU8(fixed.asset.pixels), repeated = pack('Atlas', fixedInputs, 5);
fixedInputs[0].asset.pixels.fill(0); fixedInputs[0].name = 'Changed'; fixedInputs[0].durationMS = 1;
assert.deepEqual(fixed.asset.pixels, priorBytes); assert.equal(fixed.atlas.frame('Red').durationMS, 40);
fixed.asset.pixels.fill(0); assert.deepEqual(repeated.asset.pixels, priorBytes);
assert.notEqual(repeated.asset.pixels, fixed.asset.pixels);

function allocationRun(fn) {
  const allocations = [];
  globalThis.Uint8Array = new Proxy(NativeU8, { construct(target, args) {
    const result = Reflect.construct(target, args); allocations.push(result.byteLength); return result;
  } });
  try { return { result: fn(), allocations, totalBytes: allocations.reduce((sum, value) => sum + value, 0) }; }
  finally { globalThis.Uint8Array = NativeU8; }
}
let getters = 0; const refusals = [];
const validAsset = asset(1, 1, clear), validEntry = entry('Valid', validAsset), valid = [validEntry];
function reject(name, images, maxWidth, code = 'INVALID_ASSET', imageId) {
  if (arguments.length < 2) images = valid;
  if (arguments.length < 3) maxWidth = 4;
  if (arguments.length < 5) imageId = 'Atlas';
  const run = allocationRun(() => assert.throws(() => pack(imageId, images, maxWidth), error => error instanceof Canvas2DError && error.code === code, name));
  assert.equal(run.allocations.length, 0, name + ' allocated before refusal'); refusals.push({ name, code, allocations: 0 });
}
for (const imageId of [undefined, null, '', '1Atlas', 'A'.repeat(65), 'A B', 1]) reject('image ID ' + String(imageId), valid, 4, 'INVALID_ASSET', imageId);
for (const maxWidth of [undefined, null, -0, 0, -1, 1.5, 1025, NaN, Infinity, '4']) reject('maxWidth ' + String(maxWidth), valid, maxWidth);
for (const images of [null, [], {}, Object.create(valid), new (class extends Array {})(validEntry)]) reject('image array', images);
const sparse = [validEntry, validEntry]; delete sparse[1]; reject('sparse entries', sparse);
const extraArray = [validEntry]; extraArray.extra = 1; reject('extra array field', extraArray);
const symbolicArray = [validEntry]; symbolicArray[Symbol('field')] = 1; reject('symbol array field', symbolicArray);
const accessorArray = [validEntry]; Object.defineProperty(accessorArray, '0', { enumerable: true, get() { getters++; return validEntry; } }); reject('accessor array entry', accessorArray);
const hiddenArray = [validEntry]; Object.defineProperty(hiddenArray, '0', { enumerable: false, value: validEntry }); reject('hidden array entry', hiddenArray);
reject('seventeen entries', Array.from({ length: 17 }, (_, index) => entry('Frame' + index, validAsset)), 4, 'ASSET_LIMIT');
for (const name of [undefined, null, '', '1Frame', 'A'.repeat(65), 'A B', 1]) reject('frame name ' + String(name), [{ ...validEntry, name }]);
for (const durationMS of [undefined, null, -0, 0, -1, 1.5, 60001, NaN, Infinity, '40']) reject('duration ' + String(durationMS), [{ ...validEntry, durationMS }]);
reject('duplicate names', [validEntry, validEntry]);
for (const value of [null, [], Object.create(validEntry), { ...validEntry, extra: true }, { ...validEntry, [Symbol('field')]: 1 }]) reject('entry record', [value]);
for (const key of ['name', 'asset', 'durationMS']) {
  const absent = { ...validEntry }; delete absent[key]; reject('missing entry ' + key, [absent]);
  const accessor = { ...validEntry }; Object.defineProperty(accessor, key, { enumerable: true, get() { getters++; return validEntry[key]; } }); reject('accessor entry ' + key, [accessor]);
  const hidden = { ...validEntry }; Object.defineProperty(hidden, key, { enumerable: false, value: validEntry[key] }); reject('hidden entry ' + key, [hidden]);
}
for (const value of [null, [], Object.create(validAsset), { ...validAsset, extra: true }, { ...validAsset, [Symbol('field')]: 1 }]) reject('asset record', [entry('Valid', value)]);
for (const key of ['width', 'height', 'pixels']) {
  const absent = { ...validAsset }; delete absent[key]; reject('missing asset ' + key, [entry('Valid', absent)]);
  const accessor = { ...validAsset }; Object.defineProperty(accessor, key, { enumerable: true, get() { getters++; return validAsset[key]; } }); reject('accessor asset ' + key, [entry('Valid', accessor)]);
  const hidden = { ...validAsset }; Object.defineProperty(hidden, key, { enumerable: false, value: validAsset[key] }); reject('hidden asset ' + key, [entry('Valid', hidden)]);
}
for (const width of [0, 1.5, 4097, NaN, Infinity, '1']) reject('asset width ' + String(width), [entry('Valid', { ...validAsset, width })]);
for (const height of [0, 1.5, 4097, NaN, Infinity, '1']) reject('asset height ' + String(height), [entry('Valid', { ...validAsset, height })]);
for (const pixels of [[], new Uint8ClampedArray(4), new NativeU8(3), new NativeU8(5), new (class extends NativeU8 {})(4)]) reject('pixel type/extent', [entry('Valid', { ...validAsset, pixels })]);
if (typeof SharedArrayBuffer !== 'undefined') reject('shared pixel buffer', [entry('Valid', { ...validAsset, pixels: new NativeU8(new SharedArrayBuffer(4)) })]);
for (const key of ['buffer', 'byteLength', 'byteOffset', 'length']) {
  const pixels = new NativeU8(4); Object.defineProperty(pixels, key, { get() { getters++; throw Error('metadata getter'); } });
  reject('pixel metadata accessor ' + key, [entry('Valid', { ...validAsset, pixels })]);
  const override = new NativeU8(4); Object.defineProperty(override, key, { value: key === 'buffer' ? new ArrayBuffer(4) : 4 });
  reject('pixel metadata override ' + key, [entry('Valid', { ...validAsset, pixels: override })]);
}
assert.equal(getters, 0);
reject('image wider than shelf', [entry('Wide', asset(5, 1, red))], 4, 'ASSET_LIMIT');
reject('output height above 1024', [entry('TallA', asset(1, 513, red)), entry('TallB', asset(1, 513, blue))], 1, 'ASSET_LIMIT');
reject('output byte cap from padding', [entry('Wide', asset(1024, 1, red)), entry('Tall', asset(1, 256, blue))], 1024, 'ASSET_LIMIT');
const maximumAsset = asset(512, 512, clear);
reject('aggregate input byte cap', [entry('Big', maximumAsset), entry('Extra', validAsset)], 512, 'ASSET_LIMIT');
reject('repeated input counts toward cap', [entry('BigA', maximumAsset), entry('BigB', maximumAsset)], 512, 'ASSET_LIMIT');
const maximum = allocationRun(() => pack('Maximum', [entry('Big', maximumAsset)], 512));
assert.equal(maximum.result.asset.pixels.length, 1048576); assert.deepEqual(maximum.result.asset.pixels, maximumAsset.pixels);
assert.equal(maximum.totalBytes, 2 * 1048576); assert.notEqual(maximum.result.asset.pixels, maximumAsset.pixels);
const paddedExact = pack('Padded', [entry('Wide', asset(1024, 1, red)), entry('Tall', asset(1, 255, blue))], 1024);
assert.equal(paddedExact.asset.pixels.length, 1048576); assert.equal(paddedExact.asset.height, 256);
assert.deepEqual([...paddedExact.asset.pixels.subarray(-4)], zero);
for (const lookup of [() => repeated.atlas.frame('Unknown'), () => repeated.atlas.frame(''), () => repeated.atlas.sequence([])]) {
  assert.throws(lookup, error => error.code === 'INVALID_SCENE');
}
const accessorNames = ['Red'];
Object.defineProperty(accessorNames, '0', { enumerable: true, get() { getters++; return 'Red'; } });
assert.throws(() => repeated.atlas.sequence(accessorNames), error => error.code === 'INVALID_SCENE');
assert.equal(getters, 0);
console.log(JSON.stringify({ runtime: process.version, module: process.env.BAROCSS_PACK_MODULE ? 'source-bundle' : 'compiled-root',
  oracle: 'independent grouped-row placement and destination-pixel lookup', comparisons, randomImages: 32,
  fixedSize: { width: 5, height: 5, byteLength: 100 }, fixedCrops: repeated.atlas.sequence(['Red', 'Blue', 'Clear', 'Gold']).map(frame => frame.sourceRect),
  callerOrder: true, mixedRowHeights: true, exactWidthFits: true, actualOccupiedWidth: true, transparentPadding: true,
  hiddenRGBPreserved: true, maxSixteenFrames: true, repeatedAssetsAdmitted: true, independentCopies: true,
  catalogCopies: true, outerFrozen: true, getters, refusals: refusals.length, refusalAllocations: 0,
  exactOneMiBInputOutputAdmitted: true, maximumAllocations: maximum.allocations, maximumTypedPayload: maximum.totalBytes,
  paddedExactOneMiBOutputAdmitted: true, refusalCases: refusals }, null, 2));
