// Settings validation only: import does not calculate a result or authenticate a saved design.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BarocssError } from '../src/api';
import { GravityExperimentDefinition } from '../src/api/experimentDefinition';
import { canonical, fnv64 } from '../src/util/revision';
import { KEY, options, rodDoc } from './fixtures/static-gravity-rod';

const envelope = () => GravityExperimentDefinition.create(rodDoc(), options()).toJSON();
const valueError = (error: unknown) => error instanceof BarocssError && error.code === 'VALUE';
const rejected = (value: unknown, label?: string) => assert.throws(() => new GravityExperimentDefinition(value), valueError, label);
function put(root: unknown, path: readonly string[], value: unknown): void {
  let target = root;
  for (const key of path.slice(0, -1)) {
    assert.ok(target !== null && typeof target === 'object');
    target = Reflect.get(target, key);
  }
  assert.ok(target !== null && typeof target === 'object');
  assert.equal(Reflect.set(target, path[path.length - 1], value), true);
}

test('gravity definition input: malformed JSON and nonstring parse arguments have typed VALUE refusals', () => {
  for (const text of ['', '{', 'null', '[]', '42', '"definition"', '{"inputs":{"gravity":[0,0,1e400]}}']) {
    assert.throws(() => GravityExperimentDefinition.parse(text), valueError, text);
  }
  for (const value of [undefined, null, 1, {}, []]) {
    assert.throws(() => Reflect.apply(GravityExperimentDefinition.parse, GravityExperimentDefinition, [value]), valueError);
  }
});

test('gravity definition input: exact envelope, profile and input units cannot be confused with a result record', () => {
  const base = envelope();
  for (const value of [undefined, null, [], {}, { ...base, format: 'barocss-gravity-experiment-record' },
    { format: 'barocss-gravity-experiment-record', schema: 1, report: {} },
    { ...base, schema: 0 }, { ...base, schema: 2 }, { ...base, schema: '1' },
    { ...base, profile: 'dynamic-gravity-v1' }, { ...base, result: {} }, { ...base, extra: undefined }]) rejected(value);
  for (const key of ['format', 'schema', 'profile', 'units', 'binding', 'inputs']) {
    const copy = structuredClone(base); Reflect.deleteProperty(copy, key); rejected(copy, `missing ${key}`);
  }
  for (const units of [null, [], {}, { angle: 'radian', gravity: 'mm/s²' },
    { angle: 'degree', gravity: 'm/s²' }, { angle: 'degree', gravity: 'mm/s²', torque: 'N·mm' }]) {
    rejected({ ...base, units }, 'units must describe settings, not result quantities');
  }
});

test('gravity definition input: one explicit angle and dense finite world gravity are required', () => {
  const base = envelope(), sparse = Object.assign(Array(3), { 0: 0, 2: -9806.65 });
  const cases: [string[], unknown][] = [
    [['inputs'], null], [['inputs'], []], [['inputs'], {}],
    [['inputs', 'values'], {}], [['inputs', 'values'], { [KEY]: 0, other: 1 }],
    [['inputs', 'values'], { [KEY]: '0' }],
    [['inputs', 'values', KEY], NaN], [['inputs', 'values', KEY], Infinity], [['inputs', 'values', KEY], -Infinity],
    [['inputs', 'gravity'], null], [['inputs', 'gravity'], [0, 0]], [['inputs', 'gravity'], [0, 0, -1, 0]],
    [['inputs', 'gravity'], sparse], [['inputs', 'gravity'], [0, undefined, -1]],
    [['inputs', 'gravity'], [0, NaN, -1]], [['inputs', 'gravity'], [0, 0, Infinity]],
    [['inputs', 'gravity'], ['0', 0, -1]], [['inputs', 'extra'], undefined],
  ];
  for (const [path, value] of cases) { const copy = structuredClone(base); put(copy, path, value); rejected(copy, path.join('.')); }
  for (const key of ['values', 'gravity']) {
    const copy = structuredClone(base); Reflect.deleteProperty(copy.inputs, key); rejected(copy, `missing inputs.${key}`);
  }
  const extraArrayKey = structuredClone(base); Object.defineProperty(extraArrayKey.inputs.gravity, 'extra', { value: 1, enumerable: true });
  rejected(extraArrayKey, 'gravity must not contain non-index JSON array properties');
});

test('gravity definition input: canonical document, FNV label and normalized explicit inputs must agree', () => {
  const base = envelope();
  for (const binding of [null, [], {}, { ...base.binding, extra: 'value' }]) rejected({ ...base, binding });
  const cases: [string[], unknown][] = [
    [['binding', 'document'], '{'], [['binding', 'document'], 'null'], [['binding', 'document'], '[]'],
    [['binding', 'document'], '{"invalid":1e400}'], [['binding', 'document'], JSON.stringify(rodDoc(), null, 2)],
    [['binding', 'revision'], '0000000000000000'], [['binding', 'revision'], 1],
    [['binding', 'inputs'], '{}'], [['binding', 'inputs'], JSON.stringify(options(), null, 2)],
    [['inputs', 'values', KEY], 60], [['inputs', 'gravity'], [9806.65, 0, 0]],
  ];
  for (const [path, value] of cases) { const copy = structuredClone(base); put(copy, path, value); rejected(copy, path.join('.')); }
  const changed = structuredClone(base), doc = rodDoc(); doc.robot!.base = 'changed-base';
  changed.binding.document = canonical(doc); rejected(changed, 'canonical document with an old revision');
  const arrayDocument = structuredClone(base); arrayDocument.binding.document = '[]'; arrayDocument.binding.revision = fnv64('[]');
  rejected(arrayDocument, 'a matching FNV does not make an array a document record');
  for (const key of ['document', 'revision', 'inputs']) {
    const copy = structuredClone(base); Reflect.deleteProperty(copy.binding, key); rejected(copy, `missing binding.${key}`);
  }
});

test('gravity definition input: descriptor validation never invokes getters or toJSON hooks', () => {
  const base = envelope(); let calls = 0;
  const getter = () => { calls++; throw new Error('unsafe getter invoked'); };
  for (const path of [['format'], ['inputs'], ['inputs', 'values', KEY], ['inputs', 'gravity', '0'], ['binding', 'document']]) {
    const copy = structuredClone(base); let target: object = copy;
    for (const key of path.slice(0, -1)) target = Reflect.get(target, key);
    Object.defineProperty(target, path[path.length - 1], { enumerable: true, get: getter }); rejected(copy, path.join('.'));
  }
  const hidden = structuredClone(base); Object.defineProperty(hidden.inputs.values, 'hidden', { enumerable: false, get: getter }); rejected(hidden);
  const jsonMethod = structuredClone(base); put(jsonMethod, ['inputs', 'values', 'toJSON'], () => { calls++; return {}; }); rejected(jsonMethod);
  const jsonGetter = structuredClone(base); Object.defineProperty(jsonGetter.inputs.values, 'toJSON', { enumerable: true, get: getter }); rejected(jsonGetter);
  assert.equal(calls, 0, 'validation must inspect data descriptors without evaluating input code');
});

test('gravity definition input: symbols, instances, cycles and other non-JSON values have typed refusals', () => {
  const base = envelope();
  for (const value of [new Date(0), new Map(), new Set(), Object.create({ inherited: true }), 1n, () => 0, Symbol('angle')]) {
    const copy = structuredClone(base); put(copy, ['inputs', 'values', KEY], value); rejected(copy);
  }
  const inherited = Object.assign(Object.create({ inherited: true }), base); rejected(inherited);
  const symbolKey = structuredClone(base); Object.defineProperty(symbolKey.inputs.values, Symbol('joint'), { value: 0, enumerable: true }); rejected(symbolKey);
  const cycle = structuredClone(base); put(cycle, ['inputs', 'values', KEY], cycle); rejected(cycle);
  const arrayCycle = structuredClone(base), array: unknown[] = []; array.push(array); put(arrayCycle, ['inputs', 'gravity'], array); rejected(arrayCycle);
});
