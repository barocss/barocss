// #1283 current-source CPU amendment. Run once for each actual public root.
// BAROCSS_ROTATE_MODULE may be a file URL or a path relative to this file.
// Fixtures, independent expected bytes and assertions stay outside the counters.
import assert from 'node:assert/strict';

const CALL_LIMIT = 96;
const EXPECTED_CALLS = 84;
const MIB = 1024 * 1024;
const moduleSpecifier = process.env.BAROCSS_ROTATE_MODULE ?? '../../../dist/index.js';
const NativeUint8Array = globalThis.Uint8Array;
const nativeOwnKeys = Reflect.ownKeys;
const nativeConstruct = Reflect.construct;
const uint8Descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Uint8Array');
const ownKeysDescriptor = Object.getOwnPropertyDescriptor(Reflect, 'ownKeys');
const typedByteLength = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(NativeUint8Array.prototype), 'byteLength',
).get;
const getterReads = { unrelated: 0, asset: 0, metadata: 0 };
const report = {
  contract: '1283-current-source-cpu-preflight-v1',
  module: moduleSpecifier,
  status: 'running',
  callLimit: CALL_LIMIT,
  expectedCalls: EXPECTED_CALLS,
  calls: 0,
  accepted: 0,
  refused: 0,
  byteComparisons: 0,
  pixelTargetOwnKeys: 0,
  typedConstructions: 0,
  typedPayloadBytes: 0,
  refusalTypedConstructions: 0,
  getterReads,
  globalsRestored: false,
  exactBudget: null,
  results: [],
  diagnostics: [],
};
let activeCase = 'load-public-root';
let rotateImageAsset;
let Canvas2DError;

function assertGlobalsRestored() {
  assert.deepEqual(Object.getOwnPropertyDescriptor(globalThis, 'Uint8Array'), uint8Descriptor);
  assert.deepEqual(Object.getOwnPropertyDescriptor(Reflect, 'ownKeys'), ownKeysDescriptor);
}

function measure(name, asset, turns, pixelTarget) {
  activeCase = name;
  assertGlobalsRestored();
  assert.ok(report.calls < CALL_LIMIT, `rotate call limit ${CALL_LIMIT} exhausted`);
  const counters = { pixelOwnKeys: 0, typedConstructions: 0, typedPayloadBytes: 0 };
  const measuredUint8Array = new Proxy(NativeUint8Array, {
    construct(target, args, newTarget) {
      const value = nativeConstruct(target, args, newTarget);
      counters.typedConstructions++;
      counters.typedPayloadBytes += typedByteLength.call(value);
      return value;
    },
  });
  const measuredOwnKeys = target => {
    if (target === pixelTarget) counters.pixelOwnKeys++;
    return nativeOwnKeys(target);
  };
  let value;
  let error;
  let didThrow = false;
  // The proxy wraps only the global constructor, never the target asset/pixels.
  // Forward newTarget unchanged so native prototypes and instanceof stay intact.
  try {
    Object.defineProperty(globalThis, 'Uint8Array', { ...uint8Descriptor, value: measuredUint8Array });
    Object.defineProperty(Reflect, 'ownKeys', { ...ownKeysDescriptor, value: measuredOwnKeys });
    report.calls++;
    try {
      value = rotateImageAsset(asset, turns);
    } catch (caught) {
      didThrow = true;
      error = caught;
    }
  } finally {
    try {
      Object.defineProperty(globalThis, 'Uint8Array', uint8Descriptor);
    } finally {
      Object.defineProperty(Reflect, 'ownKeys', ownKeysDescriptor);
    }
  }
  // Assertions, summaries and error inspection happen after both restorations.
  assertGlobalsRestored();
  const result = {
    case: name,
    outcome: didThrow ? String(error?.code ?? error?.name ?? 'unknown-throw') : 'accepted',
    passed: false,
    ...counters,
  };
  report.results.push(result);
  report.pixelTargetOwnKeys += counters.pixelOwnKeys;
  report.typedConstructions += counters.typedConstructions;
  report.typedPayloadBytes += counters.typedPayloadBytes;
  if (didThrow) report.refusalTypedConstructions += counters.typedConstructions;
  assert.equal(counters.pixelOwnKeys, 0, `${name}: enumerated the original pixel target`);
  return { value, error, didThrow, result };
}

function bytesEqual(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label}: byte extent`);
  for (let index = 0; index < expected.length; index++) {
    assert.equal(actual[index], expected[index], `${label}: byte ${index}`);
  }
  report.byteComparisons += expected.length;
}

function accept(name, asset, turns, expected) {
  // Compare byte-only snapshots; unrelated own fields are deliberately ignored.
  const before = new NativeUint8Array(asset.pixels);
  const measured = measure(name, asset, turns, asset.pixels);
  assert.equal(measured.didThrow, false, `${name}: unexpected ${measured.error?.code ?? measured.error}`);
  const output = measured.value;
  assert.notEqual(output, asset, `${name}: returned source asset`);
  assert.equal(output.width, expected.width, `${name}: width`);
  assert.equal(output.height, expected.height, `${name}: height`);
  assert.equal(Object.getPrototypeOf(output.pixels), NativeUint8Array.prototype);
  assert.notEqual(output.pixels, asset.pixels, `${name}: reused source view`);
  assert.notEqual(output.pixels.buffer, asset.pixels.buffer, `${name}: reused source buffer`);
  bytesEqual(output.pixels, expected.pixels, `${name}: output`);
  bytesEqual(asset.pixels, before, `${name}: source retention`);
  assert.deepEqual(getterReads, { unrelated: 0, asset: 0, metadata: 0 }, `${name}: getter read`);
  measured.result.passed = true;
  report.accepted++;
  return measured;
}

function refuse(name, asset, turns, pixelTarget, code = 'INVALID_ASSET') {
  const measured = measure(name, asset, turns, pixelTarget);
  assert.equal(measured.didThrow, true, `${name}: unexpectedly accepted`);
  assert.ok(measured.error instanceof Canvas2DError, `${name}: wrong error class`);
  assert.equal(measured.error.code, code, `${name}: error code`);
  assert.equal(measured.result.typedConstructions, 0, `${name}: copied before refusing`);
  assert.equal(measured.result.typedPayloadBytes, 0, `${name}: allocated typed payload before refusing`);
  assert.deepEqual(getterReads, { unrelated: 0, asset: 0, metadata: 0 }, `${name}: getter read`);
  measured.result.passed = true;
  report.refused++;
}

// Literal tuples have different R/G/B/A values, including hidden RGB at alpha 0.
const A = [11, 23, 37, 255];
const B = [41, 53, 67, 128];
const C = [71, 83, 97, 0];
const D = [101, 113, 127, 1];
const E = [131, 149, 157, 64];
const F = [163, 179, 191, 254];
const literalBytes = [A, B, C, D, E, F].flat();
// Independent row-major literal order, not the product's coordinate formula.
const literalExpected = [
  { width: 3, height: 2, pixels: [A, B, C, D, E, F].flat() },
  { width: 2, height: 3, pixels: [D, A, E, B, F, C].flat() },
  { width: 3, height: 2, pixels: [F, E, D, C, B, A].flat() },
  { width: 2, height: 3, pixels: [C, F, B, E, A, D].flat() },
];
const literalAsset = () => ({ width: 3, height: 2, pixels: new NativeUint8Array(literalBytes) });
const getter = category => () => {
  getterReads[category]++;
  throw new Error(`unexpected ${category} getter`);
};

try {
  ({ rotateImageAsset, Canvas2DError } = await import(new URL(moduleSpecifier, import.meta.url).href));
  assert.equal(typeof rotateImageAsset, 'function', 'missing public rotateImageAsset');
  assert.equal(typeof Canvas2DError, 'function', 'missing public Canvas2DError');

  for (let turn = 0; turn < 4; turn++) {
    accept(`literal-3x2-turn-${turn}`, literalAsset(), turn, literalExpected[turn]);
  }
  for (let turn = 0; turn < 4; turn++) {
    accept(`single-hidden-rgb-turn-${turn}`, { width: 1, height: 1, pixels: new NativeUint8Array(C) },
      turn, { width: 1, height: 1, pixels: C });
  }
  const horizontal = [
    { width: 3, height: 1, pixels: [A, C, F].flat() },
    { width: 1, height: 3, pixels: [A, C, F].flat() },
    { width: 3, height: 1, pixels: [F, C, A].flat() },
    { width: 1, height: 3, pixels: [F, C, A].flat() },
  ];
  const vertical = [
    { width: 1, height: 3, pixels: [A, C, F].flat() },
    { width: 3, height: 1, pixels: [F, C, A].flat() },
    { width: 1, height: 3, pixels: [F, C, A].flat() },
    { width: 3, height: 1, pixels: [A, C, F].flat() },
  ];
  for (let turn = 0; turn < 4; turn++) {
    accept(`thin-horizontal-turn-${turn}`, { width: 3, height: 1, pixels: new NativeUint8Array([A, C, F].flat()) },
      turn, horizontal[turn]);
    accept(`thin-vertical-turn-${turn}`, { width: 1, height: 3, pixels: new NativeUint8Array([A, C, F].flat()) },
      turn, vertical[turn]);
  }
  const backing = new NativeUint8Array(40).fill(213);
  const offsetPixels = new NativeUint8Array(backing.buffer, 8, 24);
  offsetPixels.set(literalBytes);
  const backingBefore = new NativeUint8Array(backing);
  for (let turn = 0; turn < 4; turn++) {
    accept(`nonzero-offset-turn-${turn}`, { width: 3, height: 2, pixels: offsetPixels }, turn, literalExpected[turn]);
    bytesEqual(backing, backingBefore, `nonzero-offset-turn-${turn}: whole backing retention`);
  }
  accept('null-prototype-asset', Object.assign(Object.create(null), literalAsset()), 1, literalExpected[1]);
  accept('frozen-asset-data-descriptors', Object.freeze(literalAsset()), 2, literalExpected[2]);

  const extras = [
    ['string', pixels => { pixels.note = 'ignored'; }],
    ['symbol', pixels => { pixels[Symbol('note')] = 'ignored'; }],
    ['hidden', pixels => { Object.defineProperty(pixels, 'hidden', { value: 42 }); }],
    ['accessor', pixels => {
      Object.defineProperty(pixels, 'annotation', { enumerable: true, get: getter('unrelated') });
    }],
  ];
  for (const [turn, [kind, add]] of extras.entries()) {
    const asset = literalAsset();
    add(asset.pixels);
    accept(`unrelated-${kind}-turn-${turn}`, asset, turn, literalExpected[turn]);
  }
  const combined = literalAsset();
  for (const [, add] of extras) add(combined.pixels);
  Object.defineProperty(combined.pixels, Symbol('hidden-accessor'), { get: getter('unrelated') });
  for (let turn = 0; turn < 4; turn++) {
    accept(`unrelated-combined-turn-${turn}`, combined, turn, literalExpected[turn]);
  }

  const isolated = literalAsset();
  const first = accept('copy-isolation-first', isolated, 1, literalExpected[1]).value;
  const second = accept('copy-isolation-repeat', isolated, 1, literalExpected[1]).value;
  assert.notEqual(first, second);
  assert.notEqual(first.pixels, second.pixels);
  assert.notEqual(first.pixels.buffer, second.pixels.buffer);
  first.pixels[0] ^= 255;
  bytesEqual(second.pixels, literalExpected[1].pixels, 'result mutation: repeat retained');
  bytesEqual(isolated.pixels, literalBytes, 'result mutation: source retained');
  const firstMutated = new NativeUint8Array(first.pixels);
  isolated.pixels.fill(0);
  bytesEqual(first.pixels, firstMutated, 'source mutation: first result retained');
  bytesEqual(second.pixels, literalExpected[1].pixels, 'source mutation: repeat retained');

  // One exactly 1 MiB call. A uniform hidden-RGB field plus four distinct literal
  // corners gives an independent full-byte oracle without reusing rotation code.
  const budgetPixels = new NativeUint8Array(MIB);
  const budgetExpected = new NativeUint8Array(MIB);
  for (let index = 0; index < MIB; index += 4) {
    budgetPixels.set([7, 19, 37, 0], index);
    budgetExpected.set([7, 19, 37, 0], index);
  }
  budgetPixels.set(A, 0);
  budgetPixels.set(B, (1024 - 1) * 4);
  budgetPixels.set(C, (256 - 1) * 1024 * 4);
  budgetPixels.set(D, MIB - 4);
  budgetExpected.set(C, 0);
  budgetExpected.set(A, (256 - 1) * 4);
  budgetExpected.set(D, (1024 - 1) * 256 * 4);
  budgetExpected.set(B, MIB - 4);
  const budget = accept('exact-1MiB-nonidentity', { width: 1024, height: 256, pixels: budgetPixels }, 1,
    { width: 256, height: 1024, pixels: budgetExpected });
  assert.ok(budget.result.typedPayloadBytes <= 2 * MIB, 'exact budget: typed payload exceeds 2 MiB');
  report.exactBudget = { inputBytes: MIB, outputBytes: budget.value.pixels.byteLength,
    typedConstructions: budget.result.typedConstructions, typedPayloadBytes: budget.result.typedPayloadBytes };

  const customPrototypeAsset = Object.assign(Object.create({ inherited: true }), literalAsset());
  const invalidAssets = [
    ['null', null, undefined],
    ['array', [], undefined],
    ['custom-prototype', customPrototypeAsset, customPrototypeAsset.pixels],
    ['missing-field', { width: 3, height: 2 }, undefined],
  ];
  for (const [name, asset, pixels] of invalidAssets) refuse(`asset-${name}`, asset, 1, pixels);
  for (const key of ['width', 'height', 'pixels']) {
    const hidden = literalAsset();
    const pixelTarget = hidden.pixels;
    Object.defineProperty(hidden, key, { enumerable: false });
    refuse(`asset-hidden-${key}`, hidden, 1, pixelTarget);
    const accessor = literalAsset();
    const accessorPixels = accessor.pixels;
    Object.defineProperty(accessor, key, { enumerable: true, get: getter('asset') });
    refuse(`asset-accessor-${key}`, accessor, 1, accessorPixels);
  }
  const extraAssetFields = [
    ['string', asset => { asset.extra = true; }],
    ['symbol', asset => { asset[Symbol('extra')] = true; }],
    ['hidden', asset => { Object.defineProperty(asset, 'extra', { value: true }); }],
    ['accessor', asset => { Object.defineProperty(asset, 'extra', { get: getter('asset') }); }],
  ];
  for (const [kind, add] of extraAssetFields) {
    const asset = literalAsset();
    add(asset);
    refuse(`asset-extra-${kind}`, asset, 1, asset.pixels);
  }
  for (const key of ['buffer', 'byteLength', 'byteOffset', 'length']) {
    const asset = literalAsset();
    const intrinsicValue = asset.pixels[key];
    Object.defineProperty(asset.pixels, key, { value: intrinsicValue });
    refuse(`pixels-own-${key}-value`, asset, 1, asset.pixels);
    const accessor = literalAsset();
    Object.defineProperty(accessor.pixels, key, { get: getter('metadata') });
    refuse(`pixels-own-${key}-getter`, accessor, 1, accessor.pixels);
  }
  class PixelSubclass extends NativeUint8Array {}
  const wrongPixels = [
    ['array', [...literalBytes]],
    ['clamped', new Uint8ClampedArray(literalBytes)],
    ['uint16', new Uint16Array(12)],
    ['data-view', new DataView(new ArrayBuffer(24))],
    ['array-buffer', new ArrayBuffer(24)],
    ['subclass', new PixelSubclass(literalBytes)],
    ['null', null],
  ];
  for (const [kind, pixels] of wrongPixels) {
    refuse(`pixels-wrong-type-${kind}`, { width: 3, height: 2, pixels }, 1, pixels);
  }
  for (const [kind, length] of [['empty', 0], ['short', 23], ['long', 25]]) {
    const pixels = new NativeUint8Array(length);
    refuse(`pixels-extent-${kind}`, { width: 3, height: 2, pixels }, 1, pixels);
  }
  assert.equal(typeof SharedArrayBuffer, 'function', 'shared-buffer fixture unavailable');
  const shared = new NativeUint8Array(new SharedArrayBuffer(24));
  refuse('pixels-shared-buffer', { width: 3, height: 2, pixels: shared }, 1, shared);
  assert.equal(typeof structuredClone, 'function', 'detachment fixture unavailable');
  const detached = new NativeUint8Array(24);
  structuredClone(detached.buffer, { transfer: [detached.buffer] });
  assert.equal(typedByteLength.call(detached), 0, 'fixture was not detached');
  refuse('pixels-detached-buffer', { width: 3, height: 2, pixels: detached }, 1, detached);

  for (const [key, name, value] of [
    ['width', 'zero', 0], ['width', 'too-large', 4097], ['width', 'fraction', 1.5], ['width', 'nan', NaN],
    ['height', 'zero', 0], ['height', 'too-large', 4097], ['height', 'fraction', 1.5], ['height', 'string', '2'],
  ]) {
    const asset = literalAsset();
    asset[key] = value;
    refuse(`dimension-${key}-${name}`, asset, 1, asset.pixels);
  }
  for (const [name, turn] of [
    ['negative-zero', -0], ['negative', -1], ['four', 4], ['fraction', 0.5],
    ['nan', NaN], ['string', '1'], ['undefined', undefined], ['null', null],
  ]) {
    const asset = literalAsset();
    refuse(`turn-${name}`, asset, turn, asset.pixels);
  }
  // One oversized call, with legal dimensions and the exact corresponding extent.
  const oversized = new NativeUint8Array(1024 * 257 * 4);
  Object.defineProperty(oversized, 'unrelated', { get: getter('unrelated') });
  refuse('oversized-valid-dimensions', { width: 1024, height: 257, pixels: oversized }, 1, oversized, 'ASSET_LIMIT');

  assert.equal(report.calls, EXPECTED_CALLS, 'finite case matrix changed');
  assert.equal(report.accepted, 33, 'accepted case count');
  assert.equal(report.refused, 51, 'refused case count');
  assert.equal(report.pixelTargetOwnKeys, 0);
  assert.equal(report.refusalTypedConstructions, 0);
  assert.deepEqual(getterReads, { unrelated: 0, asset: 0, metadata: 0 });
  assertGlobalsRestored();
  report.status = 'pass';
} catch (error) {
  report.status = 'fail';
  report.diagnostics.push({ case: activeCase, name: String(error?.name ?? 'Error').slice(0, 80),
    message: String(error?.message ?? error).slice(0, 400) });
  process.exitCode = 1;
} finally {
  report.globalsRestored = globalThis.Uint8Array === NativeUint8Array && Reflect.ownKeys === nativeOwnKeys;
  console.log(JSON.stringify(report));
}
