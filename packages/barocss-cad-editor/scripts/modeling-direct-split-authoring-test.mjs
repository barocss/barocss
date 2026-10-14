// #2022: pure direct/one-bevel split authoring contract only. No engine, native provider, Worker or GPU.
// FROZEN_SOURCE_HASHES must bind this fixture and every actual bundled source.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const hash = value => createHash('sha256').update(value).digest('hex');
assert.ok(process.env.FROZEN_SOURCE_HASHES, 'Freeze source hashes before running this fixture');
const frozen = JSON.parse(process.env.FROZEN_SOURCE_HASHES), checked = {};
function verify(path) {
  assert.equal(relative(root, resolve(root, path)), path);
  assert.ok(!path.startsWith('../'));
  assert.match(frozen[path] ?? '', /^[a-f0-9]{64}$/, `Missing source freeze: ${path}`);
  checked[path] = hash(readFileSync(resolve(root, path)));
  assert.equal(checked[path], frozen[path], `Frozen source changed: ${path}`);
}
verify(relative(root, import.meta.filename));
verify('packages/barocss-cad-editor/src/modeling-structure.ts');
const bundled = await require('esbuild').build({ absWorkingDir: root,
  entryPoints: ['packages/barocss-cad-editor/src/modeling-structure.ts'],
  bundle: true, platform: 'node', format: 'cjs', write: false, metafile: true,
  plugins: [{ name: 'no-engine-or-native', setup(build) {
    build.onResolve({ filter: /@barocss\/cad|modeling-engine|\.wasm|native-runtime/ }, args => {
      throw Error(`Native/runtime import prohibited: ${args.path}`);
    });
  } }],
});
Object.keys(bundled.metafile.inputs).forEach(verify);
const module = { exports: {} };
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(require, module, module.exports);
const { canonicalModelingText: text, buildModelingStructure: build,
  getModelingStructureCapabilities: capabilities, sameModelingStructure: same } = module.exports;
const clone = value => structuredClone(value);
const rail = { format: 'barocss-cad-model', schema: 1, units: 'mm',
  parameters: { width: 32, height: 24, thickness: 8, bevelDistance: 1, backBevelDistance: 2, unusedSignedZero: -0 },
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [-0, 0], max: [{ op: 'add', left: { parameter: 'width' }, right: -0 }, { parameter: 'height' }] },
    { kind: 'extrude', sketch: 0, height: { parameter: 'thickness' } },
    { kind: 'chamfer', parent: { node: 1, side: 'solid' }, edge: { parallelTo: 'x', at: { y: 0, z: 'max' } }, distance: { parameter: 'bevelDistance' } },
    { kind: 'chamfer', parent: { node: 2, side: 'solid' }, edge: { parallelTo: 'x', at: { y: { parameter: 'height' }, z: 'max' } }, distance: { parameter: 'backBevelDistance' } },
  ], outputs: { part: { node: 3, side: 'solid' } },
};
// These are pure summary tokens, never native IDs or inserted into a display packet.
const summary = data => ({ source: 'model', documentId: 'cad_model', revision: 1,
  parameters: clone(data.parameters),
  features: data.nodes.map((node, index) => ({ kind: node.kind, index, dependencies: index ? [index - 1] : [] })),
  outputs: Object.entries(data.outputs).map(([name, ref]) => ({ name, solidId: `controlled_${ref.node}_${ref.side}`, volumeMM3: null })),
});
const ledger = [];
function group(name, test) { test(); ledger.push(name); console.log(JSON.stringify({ status: 'PASS', name })); }
function prefix(size) {
  const data = clone(rail);
  data.nodes = data.nodes.slice(0, size); data.outputs.part.node = size - 1;
  if (size < 4) delete data.parameters.backBevelDistance;
  if (size < 3) delete data.parameters.bevelDistance;
  return data;
}
function command(data, at = 16) {
  return { kind: 'split-part', target: capabilities(text(data), summary(data)).splitPart, at };
}
function refuses(data, message) {
  const source = text(data), found = capabilities(source, summary(data));
  assert.equal(found.splitPart, null, message);
  assert.throws(() => build(source, summary(data), command(data)), undefined, message);
}
for (const size of [2, 3, 4]) {
  const data = prefix(size), source = text(data), current = summary(data);
  const found = capabilities(source, current), intended = command(data);
  group(`${size}-node prefix preserves expressions/signs with dynamic parent and output refs`, () => {
    assert.deepEqual(found.splitPart, { name: 'part', node: size - 1, solidId: `controlled_${size - 1}_solid` });
    assert.equal(found.splitDefaultAt, 16);
    const result = build(source, current, intended), actual = JSON.parse(result.text);
    assert.deepEqual(actual.nodes.slice(0, size), data.nodes);
    assert.deepEqual(actual.nodes[size], { kind: 'split', parent: { node: size - 1, side: 'solid' }, axis: 'x', at: { parameter: 'splitAt' } });
    assert.deepEqual(actual.outputs, { negative: { node: size, side: 'negative' }, positive: { node: size, side: 'positive' } });
    assert.deepEqual(actual.parameters, { ...data.parameters, splitAt: 16 }, 'No invented bevel driver');
    assert.equal(result.selectedOutput, 'negative'); assert.deepEqual(result.consumed, ['part']);
    assert.equal(result.kind, 'split-part'); assert.equal(text(actual), result.text);
    assert.ok(Object.is(actual.nodes[0].min[0], -0)); assert.ok(Object.is(actual.nodes[0].max[0].right, -0));
    assert.ok(Object.is(actual.parameters.unusedSignedZero, -0));
    assert.equal(text(data), source); assert.deepEqual(current, summary(data));
  });
  group(`${size}-node decimal default resolves X independently of parameter naming and retains splitAt`, () => {
    const decimal = clone(data);
    delete decimal.parameters.width; decimal.parameters.authoredSpan = 62.5;
    decimal.parameters.height = 23.5; decimal.parameters.thickness = 7.75;
    decimal.nodes[0].max[0] = { op: 'scale', value: { parameter: 'authoredSpan' }, factor: 0.5 };
    const caps = capabilities(text(decimal), summary(decimal)); assert.ok(caps.splitPart);
    assert.equal(caps.splitDefaultAt, 15.625);
    const result = build(text(decimal), summary(decimal), command(decimal, caps.splitDefaultAt));
    const changed = JSON.parse(result.text); changed.parameters.authoredSpan = 80;
    assert.equal(changed.parameters.splitAt, 15.625); assert.equal(same(result.text, text(changed)), true);
    assert.equal(capabilities(text(changed), summary(changed)).splitAuthored, true);
    assert.equal(capabilities(text(changed), summary(changed)).splitDefaultAt, null);
    changed.parameters.splitAt = 8.125; assert.equal(same(result.text, text(changed)), true);
  });
  group(`${size}-node signed/decimal coordinates remain unchanged with no feasibility invention`, () => {
    for (const at of [-10000, -1.23456789, -0, 0, Number.MIN_VALUE, 8.125, 32, 10000]) {
      const actual = JSON.parse(build(source, current, { ...intended, at }).text);
      assert.ok(Object.is(actual.parameters.splitAt, at));
      assert.equal(capabilities(text(actual), summary(actual)).splitAuthored, true);
    }
    for (const at of [10000.1, -10000.1, NaN, Infinity, -Infinity, '16', null, undefined])
      assert.throws(() => build(source, current, { ...intended, at }));
  });
  group(`${size}-node source, native identity, driver/output collisions and budgets refuse`, () => {
    for (const target of [{ ...found.splitPart, node: size }, { ...found.splitPart, solidId: 'stale' }, { ...found.splitPart, name: 'alias' }])
      assert.throws(() => build(source, current, { ...intended, target }));
    for (const mutate of [
      value => { value.parameters.width = 42; }, value => { value.features[size - 1].dependencies = []; },
      value => { value.features[size - 1].kind = 'cut'; }, value => { value.suppression = { finish: true }; },
      value => { value.revision = -0; }, value => { value.source = 'legacy'; },
    ]) { const changed = clone(current); mutate(changed); assert.equal(capabilities(source, changed).splitPart, null); }
    for (const key of ['splitAt', 'negative', 'positive']) {
      const collision = clone(data); collision.parameters[key] = 0; refuses(collision);
      const alias = clone(data); alias.outputs[key] = clone(alias.outputs.part); refuses(alias);
    }
    const full = clone(data);
    while (Object.keys(full.parameters).length < 16) full.parameters[`extra${Object.keys(full.parameters).length}`] = 0;
    refuses(full);
    assert.throws(() => build(' '.repeat(65537), current, intended));
    assert.throws(() => module.exports.modelingSourceBudget(Array(20).fill(500000), 1, [1]));
    for (const mutate of [
      value => { value.outputs.alias = clone(value.outputs.part); }, value => { value.outputs.part.node = 0; },
      value => { value.nodes[1].from = 0; }, value => { value.nodes[0].min = [0.5, 0]; },
      value => { value.nodes[0].profile = 'circle'; }, value => { value.parameters.thickness = 0; },
      value => { value.parameters.height = -1; },
    ]) { const changed = clone(data); mutate(changed); refuses(changed); }
  });
  group(`${size}-node accepted split stays terminal and retains generic dimension-history identity`, () => {
    const result = build(source, current, intended), split = JSON.parse(result.text), splitSummary = summary(split);
    const caps = capabilities(result.text, splitSummary); assert.equal(caps.splitAuthored, true);
    for (const key of ['splitPart', 'chamfer', 'addArm', 'addHole', 'cutPocket', 'union', 'cutSlot', 'rotatePart', 'movePart', 'linearPattern', 'mirrorPart', 'circularPattern']) assert.equal(caps[key], null, key);
    assert.throws(() => build(result.text, splitSummary, intended));
    const duplicate = clone(splitSummary); duplicate.outputs[1].solidId = duplicate.outputs[0].solidId;
    assert.equal(capabilities(result.text, duplicate).splitAuthored, false);
    for (const mutate of [
      value => { value.nodes[size].parent.node = size; }, value => { value.nodes[size].axis = 'y'; },
      value => { value.nodes[size].at = 16; }, value => { value.nodes[size].name = 'foreign'; },
      value => { value.outputs.positive.node = size - 1; }, value => { delete value.outputs.negative; },
      value => { value.parameters.positive = 1; }, value => { value.nodes[0].max[0] = { parameter: 'splitAt' }; },
    ]) { const changed = clone(split); mutate(changed); assert.equal(capabilities(text(changed), summary(changed)).splitAuthored, false); }
    const y = clone(split); y.nodes[size].axis = 'y';
    const edited = clone(y); edited.parameters.splitAt = 5;
    assert.equal(same(text(y), text(edited)), true, 'Command ownership must not become a generic Y split guard');
  });
}
group('One-front-bevel ownership rejects named, suppressed, foreign, altered and coupled prefixes', () => {
  for (const size of [3, 4]) for (const mutate of [
    value => { value.nodes[2].name = 'finish'; }, value => { value.nodes[2].suppressed = true; },
    value => { value.nodes[2].edge.parallelTo = 'y'; }, value => { value.nodes[2].edge.at.y = 1; },
    value => { value.nodes[2].parent.node = 0; }, value => { value.nodes[2].distance = 1; },
    value => { value.nodes[0].max[0] = { parameter: 'bevelDistance' }; },
    value => { value.nodes[1].height = { op: 'add', left: { parameter: 'bevelDistance' }, right: 7 }; },
  ]) { const changed = prefix(size); mutate(changed); refuses(changed); }
});
Object.keys(checked).forEach(verify);
console.log(JSON.stringify({ status: 'PASS', issue: 2022, node: process.version, groups: ledger, sourceHashes: checked,
  limits: { pureOnly: true, mockedSummaryTokens: true, nativeCalls: 0, workerReplies: 0, gpuCalls: 0 } }));
