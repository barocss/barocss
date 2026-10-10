import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
const bundle = await build({ entryPoints: ['packages/barocss-canvas2d/src/index.ts'], bundle: true,
  write: false, format: 'esm', platform: 'node', target: 'es2022' });
const source = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const compiled = await import(pathToFileURL(`${process.cwd()}/packages/barocss-canvas2d/dist/index.js`));
const RawBytes = Uint8Array, ordinaryOwnKeys = Reflect.ownKeys;
const trackedNames = ['Uint8Array', 'Uint8ClampedArray', 'Uint16Array', 'Uint32Array', 'Int8Array',
  'Int16Array', 'Int32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array', 'ArrayBuffer'];
const originals = Object.fromEntries(trackedNames.map(name => [name, globalThis[name]]));
const firstFailures = [
  { stage: 'preparation read-only optional lookup', message: 'Unimplemented mirror tsconfig was absent; no source or functional probe failure. The composition freeze and contract were read.' },
];
const records = [];
let assertions = 0;
function check(condition, message) { assertions++; assert.ok(condition, message); }
function equal(actual, expected, message) { assertions++; assert.deepEqual(actual, expected, message); }
function asset(width, height, values) { return { width, height, pixels: new RawBytes(values) }; }
function uniform(width, height, rgba) {
  const pixels = new RawBytes(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) pixels.set(rgba, offset);
  return { width, height, pixels };
}
// Exact rational half-up uses BigInt, independent of the provider's Number arithmetic.
function halfUp(numerator, denominator) { return Number((2n * numerator + denominator) / (2n * denominator)); }
function pixelOracle(background, foreground) {
  const ba = BigInt(background[3]), fa = BigInt(foreground[3]);
  const backgroundWeight = ba * (255n - fa), foregroundWeight = fa * 255n;
  const denominator = backgroundWeight + foregroundWeight;
  if (denominator === 0n) return [0, 0, 0, 0];
  return [0, 1, 2].map(channel => halfUp(BigInt(background[channel]) * backgroundWeight +
    BigInt(foreground[channel]) * foregroundWeight, denominator)).concat(halfUp(denominator, 255n));
}
function oracle(background, foreground) {
  const result = new RawBytes(background.pixels.length);
  for (let offset = 0; offset < result.length; offset += 4) result.set(pixelOracle(
    [...background.pixels.subarray(offset, offset + 4)], [...foreground.pixels.subarray(offset, offset + 4)]), offset);
  return result;
}
function measured(call, pixelTargets = []) {
  const allocations = []; let indexedPixelKeyScans = 0;
  for (const [name, Original] of Object.entries(originals)) {
    globalThis[name] = new Proxy(Original, { construct(target, argumentsList, newTarget) {
      const result = Reflect.construct(target, argumentsList, newTarget);
      allocations.push({ name, byteLength: result.byteLength,
        typedCopy: ArrayBuffer.isView(argumentsList[0]) });
      return result;
    } });
  }
  Reflect.ownKeys = value => { if (pixelTargets.includes(value)) indexedPixelKeyScans++; return ordinaryOwnKeys(value); };
  let result, error;
  try { result = call(); } catch (caught) { error = caught; }
  finally {
    Reflect.ownKeys = ordinaryOwnKeys;
    for (const [name, Original] of Object.entries(originals)) globalThis[name] = Original;
  }
  return { result, error, allocations, indexedPixelKeyScans };
}
let randomSeed = 0x5170c2d;
function randomByte() { randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0; return randomSeed >>> 24; }
function randomAsset(width, height) { return asset(width, height, Array.from({ length: width * height * 4 }, randomByte)); }
for (const [kind, api] of [['source-bundle', source], ['compiled-root', compiled]]) {
  randomSeed = 0x5170c2d;
  const compose = api.compositeImageAssets;
  check(typeof compose === 'function', 'actual public composite export');
  const comparisons = [], refusals = [];
  function accepted(label, background, foreground, literal) {
    const beforeB = new RawBytes(background.pixels), beforeF = new RawBytes(foreground.pixels);
    const expected = literal ? new RawBytes(literal) : oracle(background, foreground);
    const test = measured(() => compose(background, foreground), [background.pixels, foreground.pixels]);
    check(!test.error, label + ' accepted');
    equal([test.result.width, test.result.height], [background.width, background.height], label + ' dimensions');
    equal(test.result.pixels, expected, label + ' independent full bytes');
    equal(background.pixels, beforeB, label + ' background retained');
    equal(foreground.pixels, beforeF, label + ' foreground retained');
    check(test.result.pixels !== background.pixels && test.result.pixels !== foreground.pixels, label + ' owned output');
    check(test.indexedPixelKeyScans === 0, label + ' indexed key scans zero');
    equal(test.allocations.map(v => [v.name, v.byteLength, v.typedCopy]),
      [['Uint8Array', expected.length, true], ['Uint8Array', expected.length, true], ['Uint8Array', expected.length, false]], label + ' two source copies and one output/no scratch');
    const copy = new RawBytes(test.result.pixels);
    test.result.pixels.fill(71);
    equal(background.pixels, beforeB, label + ' output mutation preserves background');
    equal(foreground.pixels, beforeF, label + ' output mutation preserves foreground');
    comparisons.push({ label, comparedBytes: copy.length, indexedPixelKeyScans: 0, typedAllocations: test.allocations });
    return copy;
  }
  const background = asset(2, 2, [255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 255, 255, 0, 255, 0, 255]);
  const foreground = asset(2, 2, [255, 0, 255, 128, 0, 255, 255, 128, 255, 255, 255, 0, 255, 255, 255, 128]);
  const literal = [255, 0, 128, 255, 0, 255, 255, 128, 0, 0, 255, 255, 128, 255, 128, 255];
  equal([...oracle(background, foreground)], literal, 'independent literal16 matches exact rational oracle');
  const initial = accepted('literal16-existing-host-input', background, foreground, literal);
  for (const ba of [0, 1, 2, 127, 128, 129, 254, 255]) for (const fa of [0, 1, 2, 127, 128, 129, 254, 255]) {
    accepted(`alpha-boundary-${ba}-${fa}`, asset(1, 1, [13, 201, 37, ba]), asset(1, 1, [239, 7, 181, fa]));
  }
  accepted('RGB-exact-half-tie', asset(1, 1, [255, 255, 255, 2]), asset(1, 1, [1, 1, 1, 2]), [128, 128, 128, 4]);
  accepted('hidden-alpha0-normalizes-zero', asset(1, 1, [17, 23, 31, 0]), asset(1, 1, [211, 199, 197, 0]), [0, 0, 0, 0]);
  accepted('foreground-alpha0-retains-background', asset(1, 1, [21, 41, 61, 128]), asset(1, 1, [255, 0, 0, 0]), [21, 41, 61, 128]);
  accepted('opaque-foreground-wins', asset(1, 1, [21, 41, 61, 128]), asset(1, 1, [255, 0, 0, 255]), [255, 0, 0, 255]);
  const partialB = asset(1, 1, [201, 9, 31, 127]), partialF = asset(1, 1, [5, 199, 83, 128]);
  const forward = accepted('partial-order-forward', partialB, partialF), reverse = accepted('partial-order-reverse', partialF, partialB);
  check([...forward].some((value, index) => value !== reverse[index]), 'source-over order matters');
  accepted('aliased-input-values', partialB, partialB);
  accepted('ordinary-null-prototype-records', Object.assign(Object.create(null), asset(1, 1, [17, 31, 47, 128])), Object.assign(Object.create(null), asset(1, 1, [201, 179, 157, 129])));
  for (let index = 0; index < 24; index++) {
    const width = 1 + index % 7, height = 1 + index % 5;
    accepted(`seeded-nonsquare-${index}`, randomAsset(width, height), randomAsset(width, height));
  }
  const independent = compose(background, foreground), expectedCopy = new RawBytes(independent.pixels);
  background.pixels.fill(3); foreground.pixels.fill(5);
  equal(independent.pixels, expectedCopy, 'subsequent input mutation preserves result');
  equal(expectedCopy, initial, 'repeat exact literal result');
  let getterReads = 0;
  const clean = () => asset(1, 1, [11, 23, 37, 127]);
  function refused(label, first, second, code = 'INVALID_ASSET') {
    const targets = [Object.getOwnPropertyDescriptor(first ?? {}, 'pixels')?.value,
      Object.getOwnPropertyDescriptor(second ?? {}, 'pixels')?.value];
    const test = measured(() => compose(first, second), targets);
    check(test.error?.code === code, label + ' expected error ' + code);
    check(test.allocations.length === 0, label + ' all typed copies/output zero');
    check(test.indexedPixelKeyScans === 0, label + ' indexed key scans zero');
    refusals.push({ label, code: test.error.code, typedAllocations: 0, indexedPixelKeyScans: 0 });
  }
  refused('missing-second', clean(), undefined);
  refused('null-second', clean(), null);
  refused('foreign-record-second', clean(), Object.create({ width: 1, height: 1, pixels: new RawBytes(4) }));
  const accessor = { width: 1, height: 1 };
  Object.defineProperty(accessor, 'pixels', { enumerable: true, get() { getterReads++; throw Error('getter'); } });
  refused('SECOND-pixels-accessor-before-ANY-copy', clean(), accessor);
  refused('SECOND-width-accessor-before-ANY-copy', clean(), Object.defineProperty({ height: 1, pixels: new RawBytes(4) }, 'width', { enumerable: true, get() { getterReads++; return 1; } }));
  refused('SECOND-extra-field', clean(), { ...clean(), extra: 1 });
  refused('SECOND-symbol-field', clean(), { ...clean(), [Symbol('extra')]: 1 });
  refused('SECOND-hidden-field', clean(), Object.defineProperty(clean(), 'width', { value: 1, enumerable: false }));
  refused('SECOND-array-pixels', clean(), { width: 1, height: 1, pixels: [1, 2, 3, 4] });
  refused('SECOND-clamped-pixels', clean(), { width: 1, height: 1, pixels: new Uint8ClampedArray(4) });
  class SubBytes extends RawBytes {}
  refused('SECOND-subclass-pixels', clean(), { width: 1, height: 1, pixels: new SubBytes(4) });
  const detached = new RawBytes(4); structuredClone(detached.buffer, { transfer: [detached.buffer] });
  refused('SECOND-detached-pixels', clean(), { width: 1, height: 1, pixels: detached });
  if (typeof SharedArrayBuffer === 'function') refused('SECOND-shared-pixels', clean(), { width: 1, height: 1, pixels: new RawBytes(new SharedArrayBuffer(4)) });
  refused('SECOND-byte-extent', clean(), { width: 1, height: 1, pixels: new RawBytes(3) });
  for (const value of [0, -0, -1, 1.5, Infinity, NaN, '1', 4097]) refused('SECOND-invalid-width-' + String(value), clean(), { width: value, height: 1, pixels: new RawBytes(4) });
  for (const value of [0, -0, -1, 1.5, Infinity, NaN, '1', 4097]) refused('SECOND-invalid-height-' + String(value), clean(), { width: 1, height: value, pixels: new RawBytes(4) });
  refused('SECOND-valid-mismatched-dimensions', clean(), uniform(2, 1, [1, 2, 3, 4]));
  for (const key of ['buffer', 'byteLength', 'byteOffset', 'length']) {
    for (const position of ['first', 'second']) {
      const bad = clean(); Object.defineProperty(bad.pixels, key, { get() { getterReads++; throw Error('metadata getter'); } });
      refused(position + '-metadata-' + key, position === 'first' ? bad : clean(), position === 'second' ? bad : clean());
    }
  }
  const excess = uniform(1024, 257, [1, 2, 3, 4]);
  refused('valid-FIRST-budget-excess', excess, excess, 'ASSET_LIMIT');
  refused('SECOND-oversized-mismatching-extent-before-ANY-copy', clean(), excess, 'INVALID_ASSET');
  const extraB = clean(), extraF = clean();
  for (const value of [extraB, extraF]) {
    Object.defineProperty(value.pixels, 'unused', { get() { getterReads++; throw Error('irrelevant getter'); } });
    Object.defineProperty(value.pixels, Symbol('unused'), { get() { getterReads++; throw Error('irrelevant symbol getter'); } });
    Object.defineProperty(value.pixels, Symbol.iterator, { get() { getterReads++; throw Error('unused typed-array iterator getter'); } });
    Object.defineProperty(value.pixels, 'hidden', { value: 41, enumerable: false });
  }
  accepted('irrelevant-pixel-fields-ignored-getter0', extraB, extraF);
  check(getterReads === 0, 'no invalid or irrelevant getter ran');
  const budgetB = uniform(4096, 64, [21, 43, 65, 127]), budgetF = uniform(4096, 64, [199, 177, 155, 128]);
  const budgetPixel = pixelOracle([21, 43, 65, 127], [199, 177, 155, 128]);
  const budget = measured(() => compose(budgetB, budgetF), [budgetB.pixels, budgetF.pixels]);
  check(!budget.error, 'exact1MiB per asset accepted');
  check(budget.result.pixels.every((value, index) => value === budgetPixel[index % 4]), 'exact1MiB result full-byte uniform independent oracle');
  equal(budget.allocations.map(v => [v.name, v.byteLength, v.typedCopy]),
    [['Uint8Array', 1048576, true], ['Uint8Array', 1048576, true], ['Uint8Array', 1048576, false]], 'measured exactly3MiB internal typed payload');
  check(budget.indexedPixelKeyScans === 0, 'exact-budget indexed key scans zero');
  records.push({ kind, status: 'PASS', comparisons, fullByteComparisonCount: comparisons.length,
    refusals, refusalCount: refusals.length, getterReads, exactBudget: { eachInputBytes: 1048576,
      comparedOutputBytes: budget.result.pixels.length, independentPixel: budgetPixel,
      internalTypedPayloadBytes: budget.allocations.reduce((sum, value) => sum + value.byteLength, 0),
      allocations: budget.allocations, indexedPixelKeyScans: 0 } });
}
const output = { status: 'PASS', actualBrowser: false, noDOMGPU: true, oracle: 'BigInt exact rational half-up',
  sourceBundleInMemoryOnly: true, compiledRoot: 'packages/barocss-canvas2d/dist/index.js',
  firstFailures, records, assertions, limitations: ['Allocation observation counts typed payload, not process peak memory or garbage collection.',
    'Source-bundle and emitted-root numerical/admission checks are not browser pixels, GPU lifetime, packaging or composed Root acceptance.',
    'Equal dimensions plus exact RGBA byte lengths imply identical input byte budgets; a second-only valid budget excess cannot exist. Equal oversized pairs test ASSET_LIMIT, mismatched oversized foreground tests dimension-first INVALID_ASSET.'] };
await writeFile('packages/barocss-canvas2d/consumer/evidence/image-composite/focused.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ status: output.status, assertions, entries: records.map(value => ({ kind: value.kind,
  comparisons: value.fullByteComparisonCount, refusals: value.refusalCount,
  getterReads: value.getterReads, exactBudgetBytes: value.exactBudget.internalTypedPayloadBytes })) }));
