import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
const bundle = await build({ entryPoints: ['packages/barocss-canvas2d/src/index.ts'], bundle: true,
  write: false, format: 'esm', platform: 'node', target: 'es2022' });
const source = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const compiled = await import(pathToFileURL(`${process.cwd()}/packages/barocss-canvas2d/dist/index.js`));
const RawBytes = Uint8Array, ordinaryOwnKeys = Reflect.ownKeys;
const names = ['Uint8Array', 'Uint8ClampedArray', 'Uint16Array', 'Uint32Array', 'Int8Array',
  'Int16Array', 'Int32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array', 'ArrayBuffer'];
const originals = Object.fromEntries(names.map(name => [name, globalThis[name]]));
let assertions = 0, randomSeed = 0x1324c2d;
const records = [];
function check(condition, label) { assertions++; assert.ok(condition, label); }
function equal(actual, expected, label) { assertions++; assert.deepEqual(actual, expected, label); }
const asset = (width, height, pixels) => ({ width, height, pixels: new RawBytes(pixels) });
function uniform(width, height, color) {
  const pixels = new RawBytes(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set(color, i);
  return { width, height, pixels };
}
function randomByte() { randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0; return randomSeed >>> 24; }
// Independent grid operation: reverse the order of tuples within each row, or
// reverse row order. This does not use the provider's destination-offset formula.
function oracle(value, axis) {
  const rows = [];
  for (let y = 0; y < value.height; y++) {
    const row = [];
    for (let x = 0; x < value.width; x++) {
      const start = (y * value.width + x) * 4;
      row.push([value.pixels[start], value.pixels[start + 1], value.pixels[start + 2], value.pixels[start + 3]]);
    }
    rows.push(axis === 'horizontal' ? row.reverse() : row);
  }
  return new RawBytes((axis === 'vertical' ? rows.reverse() : rows).flat(2));
}
function measured(call, pixelTarget) {
  const allocations = []; let indexedKeyScans = 0;
  for (const [name, Original] of Object.entries(originals)) {
    globalThis[name] = new Proxy(Original, { construct(target, args, newTarget) {
      const result = Reflect.construct(target, args, newTarget);
      allocations.push({ name, byteLength: result.byteLength, typedCopy: ArrayBuffer.isView(args[0]) });
      return result;
    } });
  }
  Reflect.ownKeys = value => { if (value === pixelTarget) indexedKeyScans++; return ordinaryOwnKeys(value); };
  let result, error;
  try { result = call(); } catch (caught) { error = caught; }
  finally { Reflect.ownKeys = ordinaryOwnKeys; for (const [name, Original] of Object.entries(originals)) globalThis[name] = Original; }
  return { result, error, allocations, indexedKeyScans };
}
const A = [1, 2, 3, 0], B = [11, 12, 13, 127], C = [21, 22, 23, 255],
  D = [31, 32, 33, 1], E = [41, 42, 43, 128], F = [51, 52, 53, 254];
const abcdef = [A, B, C, D, E, F].flat();
for (const [kind, api] of [['source-bundle', source], ['compiled-root', compiled]]) {
  randomSeed = 0x1324c2d;
  const mirror = api.mirrorImageAsset, comparisons = [], refusals = [];
  check(typeof mirror === 'function', 'public mirror export');
  function accepted(label, value, axis, literal) {
    const before = new RawBytes(value.pixels), expected = literal ? new RawBytes(literal) : oracle(value, axis);
    const test = measured(() => mirror(value, axis), value.pixels);
    check(!test.error, label + ' admitted');
    equal([test.result.width, test.result.height], [value.width, value.height], label + ' same dimensions');
    equal(test.result.pixels, expected, label + ' independent complete RGBA');
    equal(value.pixels, before, label + ' input retained');
    check(test.result.pixels !== value.pixels && test.result.pixels.buffer !== value.pixels.buffer, label + ' independent output');
    check(test.indexedKeyScans === 0, label + ' indexed-key scan zero');
    equal(test.allocations.map(a => [a.name, a.byteLength, a.typedCopy]),
      [['Uint8Array', expected.length, true], ['Uint8Array', expected.length, false]], label + ' one source copy + output/no scratch');
    const saved = new RawBytes(test.result.pixels);test.result.pixels.fill(93);
    equal(value.pixels, before, label + ' returned-byte mutation isolation');
    comparisons.push({ label, axis, width: value.width, height: value.height, comparedBytes: saved.length,
      indexedKeyScans: 0, allocations: test.allocations });
    return saved;
  }
  accepted('literal3x2-horizontal-CBA-FED', asset(3, 2, abcdef), 'horizontal', [C, B, A, F, E, D].flat());
  accepted('literal3x2-vertical-DEF-ABC', asset(3, 2, abcdef), 'vertical', [D, E, F, A, B, C].flat());
  for (const [width, height] of [[1, 1], [1, 9], [9, 1], [2, 3], [3, 2], [7, 4], [1, 4096]]) {
    const value = asset(width, height, Array.from({ length: width * height * 4 }, randomByte));
    for (const axis of ['horizontal', 'vertical']) accepted(`thin-nonsquare-${width}x${height}-${axis}`, value, axis);
  }
  for (let i = 0; i < 24; i++) {
    const width = 1 + i % 7, height = 1 + i % 5;
    const value = asset(width, height, Array.from({ length: width * height * 4 }, randomByte));
    for (const axis of ['horizontal', 'vertical']) accepted(`seeded-${i}-${axis}`, value, axis);
  }
  const sharedValue = asset(3, 2, abcdef), first = mirror(sharedValue, 'horizontal'), second = mirror(sharedValue, 'horizontal');
  check(first.pixels !== second.pixels && first.pixels.buffer !== second.pixels.buffer, 'repeat output ownership');
  equal(first.pixels, second.pixels, 'repeat results exact');sharedValue.pixels.fill(19);
  equal([...first.pixels], [C, B, A, F, E, D].flat(), 'later input mutation isolation');
  const twice = mirror(first, 'horizontal');equal([...twice.pixels], abcdef, 'reflection involution preserves all hidden RGBA');
  accepted('ordinary-null-prototype-record', Object.assign(Object.create(null), asset(3, 2, abcdef)), 'vertical');
  let getterReads = 0;
  const clean = () => asset(1, 1, A);
  function refused(label, value, axis, code = 'INVALID_ASSET') {
    const target = Object.getOwnPropertyDescriptor(value ?? {}, 'pixels')?.value;
    const test = measured(() => mirror(value, axis), target);
    check(test.error?.code === code, label + ' expected ' + code);
    check(test.allocations.length === 0, label + ' typed allocation zero');
    check(test.indexedKeyScans === 0, label + ' indexed scan zero');
    refusals.push({ label, code: test.error.code, typedAllocations: 0, indexedKeyScans: 0 });
  }
  for (const [label, axis] of [['missing', undefined], ['null', null], ['both', 'both'], ['uppercase', 'Horizontal'],
    ['aliasX', 'x'], ['number', 0], ['record', {}], ['boxedString', new String('horizontal')], ['symbol', Symbol('horizontal')]]) refused('invalid-axis-' + label, clean(), axis);
  refused('null-asset', null, 'horizontal');
  refused('foreign-record', Object.create({ width: 1, height: 1, pixels: new RawBytes(4) }), 'horizontal');
  refused('extra-field', { ...clean(), extra: 1 }, 'horizontal');
  refused('symbol-field', { ...clean(), [Symbol('extra')]: 1 }, 'horizontal');
  refused('hidden-field', Object.defineProperty(clean(), 'width', { value: 1, enumerable: false }), 'horizontal');
  const getterAsset = { width: 1, height: 1 };Object.defineProperty(getterAsset, 'pixels', { enumerable: true, get() { getterReads++; throw Error('pixels getter'); } });
  refused('pixels-accessor', getterAsset, 'horizontal');
  refused('width-accessor', Object.defineProperty({ height: 1, pixels: new RawBytes(4) }, 'width', { enumerable: true, get() { getterReads++; return 1; } }), 'vertical');
  for (const field of ['width', 'height']) for (const [label, value] of [['zero', 0], ['negativeZero', -0], ['negative', -1], ['fraction', 1.5], ['Infinity', Infinity], ['NaN', NaN], ['string', '1'], ['4097', 4097]]) refused(`invalid-${field}-${label}`, { ...clean(), [field]: value }, 'horizontal');
  refused('array-pixels', { width: 1, height: 1, pixels: [1, 2, 3, 4] }, 'horizontal');
  refused('clamped-pixels', { width: 1, height: 1, pixels: new Uint8ClampedArray(4) }, 'horizontal');
  class SubBytes extends RawBytes {}
  refused('subclass-pixels', { width: 1, height: 1, pixels: new SubBytes(4) }, 'horizontal');
  const detached = new RawBytes(4);structuredClone(detached.buffer, { transfer: [detached.buffer] });
  refused('detached-pixels', { width: 1, height: 1, pixels: detached }, 'horizontal');
  if (typeof SharedArrayBuffer === 'function') refused('shared-pixels', { width: 1, height: 1, pixels: new RawBytes(new SharedArrayBuffer(4)) }, 'horizontal');
  refused('wrong-byte-extent', { width: 1, height: 1, pixels: new RawBytes(3) }, 'horizontal');
  for (const name of ['buffer', 'byteLength', 'byteOffset', 'length']) {
    const value = clean();Object.defineProperty(value.pixels, name, { get() { getterReads++; throw Error('metadata getter'); } });refused('metadata-' + name, value, 'horizontal');
  }
  const oversized = uniform(1024, 257, [11, 23, 37, 127]);
  for (const axis of ['horizontal', 'vertical']) refused('valid-budget-excess-' + axis, oversized, axis, 'ASSET_LIMIT');
  const extras = asset(3, 2, abcdef);
  Object.defineProperty(extras.pixels, 'unused', { get() { getterReads++; throw Error('unused getter'); } });
  Object.defineProperty(extras.pixels, Symbol('unused'), { get() { getterReads++; throw Error('unused symbol getter'); } });
  Object.defineProperty(extras.pixels, Symbol.iterator, { get() { getterReads++; throw Error('unused iterator getter'); } });
  Object.defineProperty(extras.pixels, 'hidden', { value: 1, enumerable: false });
  for (const axis of ['horizontal', 'vertical']) accepted('irrelevant-fields-ignored-' + axis, extras, axis);
  check(getterReads === 0, 'all accessor reads zero');
  const budget = uniform(4096, 64, [11, 23, 37, 127]);budget.pixels.set(A, 0);budget.pixels.set(F, (4096 * 64 - 1) * 4);
  const expectedBudget = uniform(4096, 64, [11, 23, 37, 127]);expectedBudget.pixels.set(A, (4096 - 1) * 4);expectedBudget.pixels.set(F, (63 * 4096) * 4);
  const cap = measured(() => mirror(budget, 'horizontal'), budget.pixels);
  check(!cap.error, 'exact1MiB/maxwidth4096 accepted');equal(cap.result.pixels, expectedBudget.pixels, 'complete1MiB literal-corner expected mapping');
  equal(cap.allocations.map(a => [a.name, a.byteLength, a.typedCopy]), [['Uint8Array', 1048576, true], ['Uint8Array', 1048576, false]], 'max internal typed payload2MiB');check(cap.indexedKeyScans === 0, 'cap indexed key scan zero');
  records.push({ kind, status: 'PASS', comparisons, wholeByteCases: comparisons.length, refusals,
    refusalCount: refusals.length, getterReads, exactBudget: { dimensions: [4096, 64], inputBytes: 1048576,
      comparedOutputBytes: 1048576, internalTypedPayloadBytes: cap.allocations.reduce((n, a) => n + a.byteLength, 0),
      allocations: cap.allocations, indexedKeyScans: 0 } });
}
const output = { status: 'PASS', actualBrowser: false, oracle: 'Independent row/tuple order plus literal3x2 and exact-budget corner placement',
  sourceBundleInMemoryOnly: true, noDOMGPU: true, records, assertions,
  firstRecords: [{ stage: 'initial read-only helper lookup', message: 'Expected new helper file absent before owner implementation; no probe assertion failure.' }],
  probeAssertionFailures: [], limitations: ['Allocation observation measures internal typed payload, not process memory peak or GC.',
    'Numerical source/emitted API checks do not establish browser pixels, runtime GL lifetime, packaging, device performance or broad composed acceptance.'] };
await writeFile('packages/barocss-canvas2d/consumer/evidence/image-mirror/focused.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ status: output.status, assertions, entries: records.map(r => ({ kind: r.kind,
  wholeByteCases: r.wholeByteCases, refusals: r.refusalCount, getterReads: r.getterReads,
  internalTypedPayloadBytes: r.exactBudget.internalTypedPayloadBytes })) }));
