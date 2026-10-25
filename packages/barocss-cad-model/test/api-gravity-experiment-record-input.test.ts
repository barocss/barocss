// Import validation only: archived results are untrusted JSON, not a new calculation or measured evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BarocssError, Robot } from '../src/api';
import { GravityExperimentRecord } from '../src/api/experimentRecord';
import { canonical, fnv64 } from '../src/util/revision';
import { KEY, options, rodDoc } from './fixtures/static-gravity-rod';

const rejected = (value: unknown, label?: string) => assert.throws(() => new GravityExperimentRecord(value),
  error => error instanceof BarocssError && error.code === 'VALUE', label);
const envelope = () => ({ format: 'barocss-gravity-experiment-record', schema: 1,
  report: new Robot(rodDoc()).gravityExperiment(options()).report });
const object = (value: unknown): Record<string, unknown> => {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
};
function put(root: unknown, path: readonly string[], value: unknown): void {
  let at = root;
  for (const key of path.slice(0, -1)) {
    assert.ok(at !== null && typeof at === 'object'); at = Reflect.get(at, key);
  }
  assert.ok(at !== null && typeof at === 'object');
  assert.equal(Reflect.set(at, path[path.length - 1], value), true);
}

test('gravity record input: malformed JSON and nonstring parse arguments have typed VALUE refusals', () => {
  for (const text of ['', '{', 'null', '[]', '42', '"record"', '{"format":"barocss-gravity-experiment-record","schema":1,"report":1e400}']) {
    assert.throws(() => GravityExperimentRecord.parse(text), error => error instanceof BarocssError && error.code === 'VALUE', text);
  }
  for (const value of [undefined, null, 1, {}, []]) {
    assert.throws(() => Reflect.apply(GravityExperimentRecord.parse, GravityExperimentRecord, [value]),
      error => error instanceof BarocssError && error.code === 'VALUE');
  }
});

test('gravity record input: envelope, schema, profile and each explicit unit cannot contradict the contract', () => {
  const base = envelope();
  for (const value of [null, undefined, [], {}, { ...base, format: 'other' }, { ...base, schema: 0 },
    { ...base, schema: 2 }, { ...base, schema: '1' }, { ...base, extra: true }, { format: base.format, schema: 1 }]) rejected(value);
  const cases: [string[], unknown][] = [
    [['report'], null], [['report'], []], [['report', 'profile'], 'dynamic-gravity-v1'],
    [['report', 'units', 'angle'], 'radian'], [['report', 'units', 'length'], 'm'],
    [['report', 'units', 'mass'], 'kg'], [['report', 'units', 'inertia'], 'kg·m²'],
    [['report', 'units', 'gravity'], 'm/s²'], [['report', 'units', 'torque'], 'N·m'],
    [['report', 'units'], { ...base.report.units, extra: 'unit' }],
  ];
  for (const [path, value] of cases) { const copy = structuredClone(base); put(copy, path, value); rejected(copy, path.join('.')); }
  const missing = structuredClone(base); Reflect.deleteProperty(missing.report.units, 'torque'); rejected(missing, 'missing torque unit');
});

test('gravity record input: full canonical document, explicit inputs and FNV label must agree', () => {
  const base = envelope();
  const badBindings: [string[], unknown][] = [
    [['report', 'binding', 'document'], '{'], [['report', 'binding', 'document'], '[]'],
    [['report', 'binding', 'document'], 'null'], [['report', 'binding', 'document'], '{"x":1e400}'],
    [['report', 'binding', 'document'], JSON.stringify(rodDoc(), null, 2)],
    [['report', 'binding', 'revision'], '0000000000000000'],
    [['report', 'binding', 'inputs'], '{"values":{},"gravity":[0,0,-9806.65]}'],
    [['report', 'inputs', 'values', KEY], 60], [['report', 'inputs', 'gravity'], [9806.65, 0, 0]],
  ];
  for (const [path, value] of badBindings) { const copy = structuredClone(base); put(copy, path, value); rejected(copy, path.join('.')); }
  const newDocument = structuredClone(base), doc = rodDoc(); doc.robot!.base = 'different-base';
  newDocument.report.binding.document = canonical(doc);
  rejected(newDocument, 'changed canonical document with old revision');
  const nonrecord = structuredClone(base); nonrecord.report.binding.document = '[]'; nonrecord.report.binding.revision = fnv64('[]');
  rejected(nonrecord, 'matching FNV does not make an array a document record');
  for (const field of ['document', 'revision', 'inputs']) {
    const copy = structuredClone(base); Reflect.deleteProperty(copy.report.binding, field); rejected(copy, `missing binding ${field}`);
  }
});

test('gravity record input: joint, scope, axis and result maps must describe the same one explicit input', () => {
  const base = envelope();
  const cases: [string[], unknown][] = [
    [['report', 'scope', 'joint'], 'other'], [['report', 'scope', 'occurrence'], ' '],
    [['report', 'scope', 'coordinateFrame'], ''], [['report', 'scope', 'axis', 'point'], [0, 0]],
    [['report', 'scope', 'axis', 'direction'], [0, 0, 0]], [['report', 'scope', 'axis', 'direction'], [0, 1, 0, 0]],
    [['report', 'assumptions'], ['valid', 1]], [['report', 'result', 'torques'], { other: 1 }],
    [['report', 'result', 'torques'], { [KEY]: 1, extra: 2 }], [['report', 'result', 'generalized'], {}],
    [['report', 'result', 'units'], { [KEY]: 'N·m' }], [['report', 'result', 'units'], { [KEY]: 'N·mm', extra: 'N·mm' }],
    [['report', 'result', 'notReady'], { code: 'ROBOT_NOT_READY', links: ['rod'], joints: [], message: 'not ready' }],
  ];
  for (const [path, value] of cases) { const copy = structuredClone(base); put(copy, path, value); rejected(copy, path.join('.')); }
  const noAngle = structuredClone(base); Reflect.deleteProperty(noAngle.report.inputs.values, KEY); rejected(noAngle);
  const noAxis = structuredClone(base); Reflect.deleteProperty(noAxis.report.scope, 'axis'); rejected(noAxis);
});

test('gravity record input: nonfinite values, sparse arrays and undefined array slots are refused throughout the archived report', () => {
  const base = envelope(), sparse = Object.assign(Array(3), { 0: 0, 2: 1 });
  const cases: [string[], unknown][] = [
    [['report', 'inputs', 'values', KEY], NaN], [['report', 'inputs', 'gravity'], sparse],
    [['report', 'scope', 'axis', 'point'], [0, undefined, 0]], [['report', 'scope', 'axis', 'direction'], [Infinity, 1, 0]],
    [['report', 'result', 'torques', KEY], Infinity], [['report', 'result', 'generalized', KEY], -Infinity],
    [['report', 'result', 'gravity'], NaN], [['report', 'assumptions'], Array(1)],
    [['report', 'inertia'], { untrusted: { nonfinite: Infinity } }],
  ];
  for (const [path, value] of cases) { const copy = structuredClone(base); put(copy, path, value); rejected(copy, path.join('.')); }
  // Validation covers retained JSON outside the typed preview as well.
  for (const value of [NaN, Infinity, -Infinity, undefined, Array(1)]) {
    const copy = structuredClone(base); object(copy.report).extra = [value]; rejected(copy, 'invalid retained JSON array');
  }
});

test('gravity record input: accessors and toJSON are never invoked while rejecting unsafe input', () => {
  const base = envelope(); let reads = 0;
  const accessor = () => { reads++; return 'unexpected evaluation'; };
  const root = structuredClone(base); Object.defineProperty(root, 'report', { enumerable: true, get: accessor }); rejected(root);
  const nested = structuredClone(base); Object.defineProperty(nested.report.scope, 'joint', { enumerable: true, get: accessor }); rejected(nested);
  const array = structuredClone(base); Object.defineProperty(array.report.inputs.gravity, '0', { enumerable: true, get: accessor }); rejected(array);
  const hidden = structuredClone(base); Object.defineProperty(hidden.report, 'hiddenGetter', { enumerable: false, get: accessor }); rejected(hidden);
  const jsonMethod = structuredClone(base); object(jsonMethod.report).toJSON = () => { reads++; return base.report; }; rejected(jsonMethod);
  const jsonGetter = structuredClone(base); Object.defineProperty(jsonGetter.report, 'toJSON', { enumerable: true, get: accessor }); rejected(jsonGetter);
  assert.equal(reads, 0, 'validation must inspect descriptors rather than read getters or call serialization hooks');
});

test('gravity record input: prototypes, symbols, cycles and non-JSON values cannot enter a retained report', () => {
  const base = envelope();
  for (const value of [new Date(0), new Map(), new Set(), Object.create({ inherited: true }), 1n, () => 1, Symbol('input')]) {
    const copy = structuredClone(base); object(copy.report).extra = value; rejected(copy);
  }
  const symbolKey = structuredClone(base); Object.defineProperty(symbolKey.report, Symbol('private'), { value: 1, enumerable: true }); rejected(symbolKey);
  const cycle = structuredClone(base); object(cycle.report).cycle = cycle.report; rejected(cycle);
  const inheritedEnvelope = Object.assign(Object.create({ inherited: true }), base); rejected(inheritedEnvelope);
  const arrayCycle = structuredClone(base), array: unknown[] = []; array.push(array); object(arrayCycle.report).extra = array; rejected(arrayCycle);
});

test('gravity record input: safe own __proto__ data and omitted undefined object fields remain detached JSON data', () => {
  const source = envelope();
  const extra = JSON.parse('{"__proto__":{"polluted":true},"normal":1}') as unknown;
  object(source.report).extra = extra; object(source.report).optionalUndefined = undefined;
  const record = new GravityExperimentRecord(source), stored = object(record.report), storedExtra = object(stored.extra);
  assert.ok(Object.hasOwn(storedExtra, '__proto__')); assert.equal(Object.getPrototypeOf(storedExtra), Object.prototype);
  assert.equal(Object.hasOwn(stored, 'optionalUndefined'), false);
  assert.equal(object({}).polluted, undefined, 'own __proto__ data must not modify Object.prototype');
  object(extra).normal = 2; object(storedExtra.__proto__).polluted = false;
  const preview = record.preview; preview.gravity[2] = 1; preview.axis.point[0] = 99; preview.assumptions.push('changed');
  const json = record.toJSON(); object(json.report).profile = 'changed';
  assert.equal(object(object(record.report).extra).normal, 1);
  assert.deepEqual(object(object(record.report).extra).__proto__, { polluted: true });
  assert.equal(record.preview.gravity[2], -9806.65); assert.equal(record.preview.axis.point[0], 0);
  assert.equal(object(record.report).profile, 'static-gravity-v1');
  assert.equal(record.matches(rodDoc(), options()), true);
});

test('gravity record input: a consistent finite archived torque is not recalculated or authenticated by import', () => {
  const source = envelope(), originalTorque = source.report.result.torques[KEY];
  source.report.result.torques[KEY] = 123456; source.report.result.generalized[KEY] = 123456;
  const record = GravityExperimentRecord.parse(JSON.stringify(source));
  assert.notEqual(originalTorque, 123456); assert.equal(record.preview.torque, 123456);
  assert.equal(record.matches(rodDoc(), options()), true, 'matching document/inputs are not physical correctness or producer authentication');
  assert.equal(Object.hasOwn(record.preview, 'pass'), false); assert.equal(Object.hasOwn(record.preview, 'measuredValidation'), false);
});
