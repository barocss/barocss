import test from 'node:test';
import assert from 'node:assert/strict';
import {numericWordsHex, packWitness, WITNESS_WORD_LIMIT} from './witness-wire.mjs';

test('literal IEEE words retain both zeros, subnormals and finite extremes', () => {
  assert.equal(numericWordsHex([0, -0, 1, -2, Number.MIN_VALUE, Number.MAX_VALUE]),
    '00000000000000000000000000000080000000000000f03f00000000000000c0' +
    '0100000000000000ffffffffffffef7f');
});

test('JSON traversal order and nonnumeric leaves do not alter the word stream', () => {
  const value = {b: [-0, '한글', null, false], a: {x: 1}};
  const before = structuredClone(value);
  assert.equal(numericWordsHex(value), '0000000000000080000000000000f03f');
  assert.deepEqual(value, before);
  assert.equal(numericWordsHex({'2': 1, '1': -2}),
    '00000000000000c0000000000000f03f');
});

test('finite source data is required and getters are not called', () => {
  for (const value of [NaN, Infinity, undefined, 1n, new Date(), [, 1]]) {
    assert.throws(() => numericWordsHex(value));
  }
  let calls = 0;
  assert.throws(() => numericWordsHex({get x() { calls++; return 1; }}));
  assert.equal(calls, 0);
});

test('fixed word limit has an exact boundary', () => {
  assert.equal(numericWordsHex(Array(WITNESS_WORD_LIMIT).fill(0)).length,
    WITNESS_WORD_LIMIT * 16);
  assert.throws(() => numericWordsHex([Array(WITNESS_WORD_LIMIT).fill(0), 0]));
});

test('packet retains actual references and has four explicit fields', () => {
  const problem = {v: -0}, result = {v: 1};
  const packet = packWitness(problem, result);
  assert.equal(packet.problem, problem);
  assert.equal(packet.result, result);
  assert.deepEqual(Object.keys(packet),
    ['problem', 'result', 'problemWordsF64leHex', 'resultWordsF64leHex']);
  assert.equal(packet.problemWordsF64leHex, '0000000000000080');
  assert.equal(JSON.stringify(packet).includes('0000000000000080'), true);
});
