// Lossless transport only. No physics, geometry, solver or expected-state imports.
import assert from 'node:assert/strict';

export const WITNESS_WORD_LIMIT = 16384;
export function numericWordsHex(value) {
  const bytes = Buffer.alloc(WITNESS_WORD_LIMIT * 8);
  let count = 0, nodes = 0;
  function visit(item, depth) {
    assert.ok(depth <= 32 && ++nodes <= 65536, 'witness tree bound');
    if (typeof item === 'number') {
      assert.ok(Number.isFinite(item), 'finite witness number');
      assert.ok(count < WITNESS_WORD_LIMIT, 'witness numeric word bound');
      bytes.writeDoubleLE(item, count++ * 8);
      return;
    }
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    assert.ok(item && typeof item === 'object', 'plain witness data');
    const array = Array.isArray(item);
    assert.equal(Object.getPrototypeOf(item), array ? Array.prototype : Object.prototype);
    const descriptors = Object.getOwnPropertyDescriptors(item);
    const keys = Reflect.ownKeys(item);
    assert.ok(keys.length <= 16385 && keys.every(key => typeof key === 'string'), 'witness keys');
    if (array) {
      assert.equal(keys.length, item.length + 1, 'dense witness array');
      assert.ok(item.length <= 16384, 'witness array bound');
    }
    for (const key of Object.keys(item)) {
      assert.ok('value' in descriptors[key], 'witness accessor refused');
      visit(descriptors[key].value, depth + 1);
    }
  }
  visit(value, 0);
  return bytes.subarray(0, count * 8).toString('hex');
}

export function packWitness(problem, result) {
  return {problem, result, problemWordsF64leHex: numericWordsHex(problem),
    resultWordsF64leHex: numericWordsHex(result)};
}
