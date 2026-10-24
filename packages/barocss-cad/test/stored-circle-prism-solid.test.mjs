import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { shapeOnlyResult, clone, signedData, exactData, binary64, capResidual, derivativeNumerators, RESIDUAL } from './stored-circle-prism-solid-fixture.mjs';

// Run against an own-source public bundle or emitted entry. This suite never
// submits an intact parent/result and does not run the finite native campaign.
// Optional isolated source admission audit: its constructor can only throw/count.
const trap = process.env.CAD_CIRCLE_ADMISSION_TRAP === '1';
let api;
const trapKey = Symbol.for('barocss.stored-circle-prism-solid.constructor-trap');
if (trap) {
  assert.equal(process.env.CAD_TEST_ENTRY, undefined, 'trap audit has an explicitly isolated source entry');
  const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? new URL('../../..', import.meta.url).pathname, 'package.json'));
  const { build } = require('esbuild');
  globalThis[trapKey] = 0;
  const output = await build({ entryPoints: [new URL('../src/stored-circle-prism-solid.ts', import.meta.url).pathname], bundle: true,
    platform: 'node', format: 'esm', target: 'node22', write: false, plugins: [{ name: 'reject-native-reconstruction', setup(build) {
      build.onResolve({ filter: /^\.\/xy-circle-prism-shell\.js$/ }, () => ({ path: 'parent-constructor', namespace: 'circle-admission-trap' }));
      build.onLoad({ filter: /.*/, namespace: 'circle-admission-trap' }, () => ({ contents: `export function buildXYCirclePrismShell() { globalThis[Symbol.for('barocss.stored-circle-prism-solid.constructor-trap')]++; throw new Error('UNEXPECTED_NATIVE_RECONSTRUCTION'); }`, loader: 'js' }));
    } }] });
  api = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
  after(() => { assert.equal(globalThis[trapKey], 0, 'every cheap refusal preceded reconstruction'); delete globalThis[trapKey]; });
} else api = await import(process.env.CAD_TEST_ENTRY ? pathToFileURL(resolve(process.env.CAD_TEST_ENTRY)).href : '../dist/index.js');
const { qualifyStoredCirclePrismSolid: qualify, validateStoredCirclePrismSolid: validate, StoredCirclePrismSolidError, StoredCirclePrismSolidDiagnosticCode } = api;
const refuses = (operation, value, code = 'INPUT') => {
  assert.throws(() => operation(value), error => error instanceof StoredCirclePrismSolidError && error.code === code);
  if (trap) assert.equal(globalThis[trapKey], 0, 'malformed data must never call the parent constructor');
};
const at = (value, path) => path.reduce((node, key) => node[key], value);
function records(value, path = [], output = []) {
  if (value && typeof value === 'object') {
    if (!Array.isArray(value)) output.push(path);
    for (const [key, child] of Object.entries(value)) records(child, [...path, key], output);
  }
  return output;
}
function typedLeaves(value, path = [], output = new Map()) {
  if (value === null || typeof value !== 'object') { if (!output.has(typeof value)) output.set(typeof value, path); return output; }
  for (const [key, child] of Object.entries(value)) typedLeaves(child, [...path, key], output);
  return output;
}

test('additive low-level exports and bounded diagnostic contract', () => {
  assert.equal(typeof qualify, 'function'); assert.equal(typeof validate, 'function');
  assert.deepEqual(StoredCirclePrismSolidDiagnosticCode, { INPUT: 'INPUT', OWNED: 'OWNED', GEOMETRY: 'GEOMETRY', BUDGET: 'BUDGET', NATIVE: 'NATIVE' });
  const cause = new Error('original provider exception'), error = new StoredCirclePrismSolidError('NATIVE', 'provider refused', cause);
  assert.equal(error.name, 'StoredCirclePrismSolidError'); assert.equal(error.code, 'NATIVE'); assert.equal(error.cause, cause);
});

test('primitive and incomplete inputs refuse before parent work', () => {
  for (const operation of [qualify, validate]) for (const input of [undefined, null, true, false, 0, -0, '', [], {}, NaN, Infinity, -Infinity, 1n, () => 0]) refuses(operation, input);
  const result = shapeOnlyResult();
  for (const [operation, value] of [[qualify, result.parent], [validate, result]]) {
    for (const key of Object.keys(value)) { const changed = clone(value); delete changed[key]; refuses(operation, changed); }
  }
});

test('complete nested record field inventory refuses extras and omissions without native work', () => {
  const fixture = shapeOnlyResult();
  for (const [operation, template] of [[qualify, fixture.parent], [validate, fixture]]) {
    const original = signedData(template), paths = records(template);
    assert.ok(paths.length > 50, 'exercise the complete profile/base-face/shell/proof inventory');
    for (const path of paths) {
      const extra = clone(template); at(extra, path).unexpected = 0;
      refuses(operation, extra); assert.equal(at(extra, path).unexpected, 0);
      const missing = clone(template), target = at(missing, path), key = Object.keys(target)[0];
      delete target[key]; refuses(operation, missing); assert.equal(Object.hasOwn(target, key), false);
    }
    assert.equal(signedData(template), original);
  }
});

test('nested field types, numeric tuples and enum fields are admitted structurally before reconstruction', () => {
  const edits = [
    ['parent', 'profile', 'source'], ['parent', 'profile', 'sourceVersion'], ['parent', 'profile', 'model', 'objects', '0', 'degree'],
    ['parent', 'profile', 'curve', 'knots', '0'], ['parent', 'profile', 'curve', 'controlPoints', '0', '0'],
    ['parent', 'baseFace', 'bundle', 'geometry', 'objects', '1', 'weights', '0', '0'],
    ['parent', 'baseFace', 'bundle', 'topology', 'loop', 'uses', '0', 'sense'],
    ['parent', 'bundle', 'construction', 'height'], ['parent', 'bundle', 'topology', 'loops', '2', 'uses', '1', 'pcurve', 'coordinateSystem'],
    ['parent', 'report', 'normalObservations', '0', 'uv', '0'], ['parent', 'report', 'baseFaceReport', 'limits', 'evaluationComparisonMM'],
    ['world', 'source'], ['world', 'model', 'lengthUnit'], ['certificate', 'arithmetic', 'operations'],
    ['certificate', 'directCounts', 'parentReconstructionCalls'], ['certificate', 'ringProof', 'quadrants', '0', 'derivativeNumeratorsX', '0', 'numerator'],
    ['certificate', 'vertexLinks', '0', 'corners', '0', 'from', 'endpointIndex'], ['certificate', 'faceAdjacency', '0', 'adjacentFaceIds', '0'],
  ];
  for (const path of edits) {
    const changed = shapeOnlyResult(), target = at(changed, path.slice(0, -1)), key = path.at(-1);
    target[key] = typeof target[key] === 'number' ? 'wrong-type' : 123;
    const before = signedData(changed); refuses(validate, changed); assert.equal(signedData(changed), before);
    if (path[0] === 'parent') refuses(qualify, changed.parent);
  }
  for (const path of [['parent', 'report', 'center'], ['parent', 'bundle', 'topology', 'vertices', '0', 'point'], ['parent', 'report', 'domains', 'wallSurface', 'u']]) {
    const changed = shapeOnlyResult(); at(changed, path).pop(); refuses(validate, changed); refuses(qualify, changed.parent);
  }
  for (const [type, path] of typedLeaves(shapeOnlyResult())) {
    const changed = shapeOnlyResult(); at(changed, path.slice(0, -1))[path.at(-1)] = type === 'boolean' ? 'false' : null;
    refuses(validate, changed);
  }
});

test('descriptor snapshots never invoke getters and refuse hidden/symbol/foreign/cyclic/sparse data', () => {
  for (const path of [[], ['parent', 'profile'], ['parent', 'bundle', 'topology', 'loops', '2', 'uses', '1'], ['certificate', 'arithmetic']]) {
    const changed = shapeOnlyResult(), target = at(changed, path), key = Object.keys(target)[0]; let getterCalls = 0;
    Object.defineProperty(target, key, { enumerable: true, get() { getterCalls++; throw Error('getter must never run'); } });
    refuses(validate, changed); assert.equal(getterCalls, 0);
  }
  for (const alter of [
    value => Object.defineProperty(value.parent.report, 'hidden', { value: 0 }),
    value => { value.parent.report[Symbol('hidden')] = 0; },
    value => Object.setPrototypeOf(value.parent.profile, { inherited: true }),
    value => { value.parent.report.bounds.min = new Float64Array([0, 0, 0]); },
    value => { value.parent.report.bounds.min[0] = NaN; },
    value => { value.parent.report.bounds.min[0] = Infinity; },
    value => { value.parent.report.bounds.min[0] = -Infinity; },
    value => { value.parent.profile.curve.controlPoints[0][0] = value; },
  ]) { const changed = shapeOnlyResult(); alter(changed); refuses(validate, changed); }
  const sparse = shapeOnlyResult(); delete sparse.parent.report.center[0]; refuses(validate, sparse, 'BUDGET');
  const extraArray = shapeOnlyResult(); extraArray.parent.report.center.extra = 0; refuses(validate, extraArray, 'BUDGET');
});

test('own-data budgets count depth, arrays, fields, strings and repeated occurrences before any native admission', () => {
  const tooDeep = {}; let tail = tooDeep; for (let i = 0; i < 33; i++) tail = tail.next = {};
  const repeated = Array(1024).fill(Array(128).fill(0));
  const tooManyFields = Object.fromEntries(Array.from({ length: 65 }, (_, i) => ['field' + i, 0]));
  for (const operation of [qualify, validate]) {
    for (const input of [tooDeep, Array(1025).fill(0), tooManyFields, 'x'.repeat(262145), Array(5).fill('x'.repeat(262144)), repeated]) refuses(operation, input, 'BUDGET');
  }
  assert.equal(repeated[0], repeated[1], 'aliases must count separately, not disappear in a global seen-set');
});

test('independent signed-data and binary64 arithmetic controls preserve signed zero without idealizing coefficients', () => {
  const value = { zero: -0, list: [0, -0, Number.MIN_VALUE, Math.SQRT1_2] }, text = signedData(value), parsed = JSON.parse(text);
  exactData(parsed, value); assert.ok(Object.is(parsed.zero, -0)); assert.ok(Object.is(parsed.list[0], 0));
  assert.notEqual(signedData({ zero: 0 }), signedData({ zero: -0 }));
  assert.deepEqual(binary64(-0), { n: 0n, d: 1n });
  assert.deepEqual(capResidual(.1, .30000000000000004, .49999999999999994, .2), RESIDUAL);
  assert.deepEqual(capResidual(-2, 6, .5, 2), { numerator: '0', denominator: '1' });
  const dx = derivativeNumerators([[6, -3, 0], [6, 1, 0], [2, 1, 0]], Math.SQRT1_2, 0);
  const dy = derivativeNumerators([[6, -3, 0], [6, 1, 0], [2, 1, 0]], Math.SQRT1_2, 1);
  assert.equal(BigInt(dx[0].numerator), 0n); assert.ok(BigInt(dx[1].numerator) < 0n && BigInt(dx[2].numerator) < 0n);
  assert.equal(BigInt(dy[2].numerator), 0n); assert.ok(BigInt(dy[0].numerator) > 0n && BigInt(dy[1].numerator) > 0n);
});
