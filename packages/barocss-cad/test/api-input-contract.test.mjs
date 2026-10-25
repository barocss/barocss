// Facade input admission only: the recording backend does not evaluate geometry.
// Execution is deferred with the API improvement bundle; these are source regressions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Part, withParameters } from '../dist/api/part.js';
import { holeSpec, param } from '../dist/api/spec.js';
import { BarocssError } from '../dist/api/refusal.js';

const typed = (code, message) => error => {
  assert.ok(error instanceof BarocssError);
  assert.equal(error.code, code);
  assert.equal(error.where, 'facade');
  if (message) assert.equal(error.message, `[${code}] ${message}`);
  return true;
};

const recordedPart = parameters => {
  let applies = 0;
  const backend = {
    copy: doc => ({ parameters: { ...doc.parameters }, specs: [...doc.specs] }),
    parameters: doc => doc.parameters,
    apply: (doc, spec) => { applies++; return { ...doc, specs: [...doc.specs, spec] }; },
  };
  return { part: new Part(backend, 'recorded', { parameters, specs: [] }), applies: () => applies };
};

test('parameter edits reject built-in and custom inherited names without reading inherited accessors', () => {
  let reads = 0;
  const inherited = Object.create(null);
  Object.defineProperty(inherited, 'inheritedSize', { enumerable: true, get: () => { reads++; return 8; } });
  for (const parameters of [{ W: 12 }, Object.assign(Object.create(inherited), { W: 12 })]) {
    const doc = { parameters, marker: 'unchanged' };
    for (const name of ['inheritedSize', 'toString', 'constructor', 'hasOwnProperty']) {
      assert.throws(() => withParameters(doc, { [name]: 20 }), typed('PARAMETER_UNKNOWN'));
    }
    assert.deepEqual(Object.keys(doc.parameters), ['W']);
    assert.equal(doc.parameters.W, 12);
  }
  assert.equal(reads, 0);
});

test('explicit own parameters with built-in names remain valid, including null-prototype dictionaries', () => {
  for (const parameters of [{ toString: 1, constructor: 2, hasOwnProperty: 3 }, Object.assign(Object.create(null), { toString: 1, constructor: 2, hasOwnProperty: 3 })]) {
    const doc = { parameters };
    const result = withParameters(doc, { toString: 4, constructor: 5, hasOwnProperty: 6 });
    assert.deepEqual(result.parameters, { toString: 4, constructor: 5, hasOwnProperty: 6 });
    assert.deepEqual(Object.values(parameters), [1, 2, 3]);
    assert.notEqual(result, doc);
    assert.notEqual(result.parameters, parameters);
  }
});

test('empty parameter edits, own accessors and finite-value validation keep their contracts', () => {
  const parameters = Object.freeze({ W: 12 });
  const doc = Object.freeze({ parameters, name: 'part' });
  assert.deepEqual(withParameters(doc, {}), doc);
  assert.deepEqual(withParameters({ parameters: {} }, {}), { parameters: {} });
  for (const value of [NaN, Infinity, -Infinity, '12', null, undefined]) {
    assert.throws(() => withParameters(doc, { W: value }), typed('VALUE'));
  }
  let reads = 0;
  const accessor = Object.defineProperty({}, 'W', { enumerable: true, get: () => { reads++; return 12; } });
  assert.deepEqual(withParameters({ parameters: accessor }, { W: 15 }).parameters, { W: 15 });
  assert.equal(reads, 1);
  assert.equal(parameters.W, 12);
});

test('parameter binding rejects inherited values before a feature reaches the backend', () => {
  let reads = 0;
  const prototype = Object.create(null);
  Object.defineProperty(prototype, 'W', { enumerable: true, get: () => { reads++; return 12; } });
  for (const parameters of [{}, Object.create(prototype)]) {
    const recording = recordedPart(parameters);
    for (const name of ['W', 'toString', 'constructor', 'hasOwnProperty']) {
      assert.throws(() => recording.part.box({ w: param(name), d: 8, h: 6 }), typed('PARAMETER_UNKNOWN'));
    }
    assert.equal(recording.applies(), 0);
    assert.deepEqual(recording.part.doc.specs, []);
  }
  assert.equal(reads, 0);
});

test('parameter binding resolves explicit colliding names with exact values and binding metadata', () => {
  const parameters = Object.assign(Object.create(null), { toString: 12, constructor: 8, hasOwnProperty: 6 });
  const recording = recordedPart(parameters);
  const options = Object.freeze({ w: param('toString'), d: param('constructor'), h: param('hasOwnProperty') });
  const result = recording.part.box(options);
  assert.deepEqual(result.doc.specs, [{ command: 'box', values: { w: 12, d: 8, h: 6, x: 0, y: 0, z: 0 }, bound: [
    { option: 'w', parameter: 'toString' }, { option: 'd', parameter: 'constructor' }, { option: 'h', parameter: 'hasOwnProperty' },
  ] }]);
  assert.deepEqual(recording.part.doc.specs, []);
  assert.equal(options.w.parameter, 'toString');
  assert.equal(recording.applies(), 1);
});

test('hole defaults preserve through, inferred blind and explicit modes in mm', () => {
  const values = { d: 4, x: -2, y: 3 };
  assert.deepEqual(holeSpec('top', values), { command: 'hole', face: 'top', values: { type: 'through', ...values } });
  assert.deepEqual(holeSpec('top', { ...values, type: undefined }).values, { type: 'through', ...values });
  assert.deepEqual(holeSpec('top', { ...values, depth: 5 }).values, { type: 'blind', ...values, depth: 5 });
  assert.deepEqual(holeSpec('top', { ...values, type: 'blind', depth: 5 }).values, { type: 'blind', ...values, depth: 5 });
  assert.deepEqual(holeSpec('top', { ...values, type: 'through', depth: 5 }).values, { type: 'through', ...values });
});

test('unknown or malformed hole modes are typed VALUE refusals instead of through holes', () => {
  for (const type of ['counterbore', 'countersink', '', 'THROUGH', null, false, 0, {}, [], Symbol('blind')]) {
    for (const depth of [undefined, 5]) {
      assert.throws(() => holeSpec('top', { d: 4, x: 2, y: 3, depth, type }),
        typed('VALUE', `a hole's type is through or blind, not ${String(type)}`));
    }
  }
});

test('blind depth and numeric hole admission remain strict', () => {
  assert.throws(() => holeSpec('top', { d: 4, x: 2, y: 3, type: 'blind' }), typed('VALUE', 'a blind hole needs depth'));
  for (const depth of [0, -1, NaN, Infinity]) {
    assert.throws(() => holeSpec('top', { d: 4, x: 2, y: 3, type: 'blind', depth }), typed('VALUE'));
  }
  for (const edits of [{ d: 0 }, { d: Infinity }, { x: NaN }, { y: Infinity }]) {
    assert.throws(() => holeSpec('top', { d: 4, x: 2, y: 3, ...edits }), typed('VALUE'));
  }
});

test('hole options are immutable and accessor exceptions are not swallowed', () => {
  const options = Object.freeze({ type: 'blind', d: 4, x: 2, y: 3, depth: 5 });
  const result = holeSpec('top', options);
  result.values.depth = 7;
  assert.equal(options.depth, 5);
  let reads = 0;
  const accessor = { d: 4, x: 2, y: 3, get type() { reads++; return 'through'; } };
  assert.equal(holeSpec('top', accessor).values.type, 'through');
  assert.equal(reads, 1);
  const sentinel = new Error('caller accessor');
  const bad = { d: 4, x: 2, y: 3, get type() { throw sentinel; } };
  assert.throws(() => holeSpec('top', bad), error => error === sentinel);
});
