// #2016: pure authoring contract only. No engine, native provider, Worker or GPU.
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
    { kind: 'sketch', profile: 'rectangle', min: [-0, 0], max: [{ parameter: 'width' }, { parameter: 'height' }] },
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
const initial = text(rail), initialSummary = summary(rail);
const command = { kind: 'linear-pattern', target: capabilities(initial, initialSummary).linearPattern, spacing: 40 };
assert.ok(command.target);
const outputs = count => Object.fromEntries([['part', { node: 3, side: 'solid' }],
  ...Array.from({ length: count - 1 }, (_, index) => [`railCopy${index + 1}`, { node: 4, side: `instance${index + 1}` }])]);
const authored = data => {
  const found = capabilities(text(data), summary(data));
  assert.equal(found.patternAuthored, true); assert.equal(found.linearPattern, null);
};
const refused = data => {
  const source = text(data), found = capabilities(source, summary(data));
  assert.equal(found.patternAuthored, false); assert.equal(found.linearPattern, null);
  assert.equal(same(source, source), false, 'Malformed pattern cannot acquire history identity');
};
const ledger = [];
function group(name, test) { test(); ledger.push(name); console.log(JSON.stringify({ status: 'PASS', name })); }
const patterns = new Map();
group('Omitted count preserves count3; exact count2/count3/count4 graph and outputs', () => {
  const omitted = build(initial, initialSummary, command);
  assert.equal(omitted.text, build(initial, initialSummary, { ...command, count: 3 }).text);
  for (const count of [2, 3, 4]) {
    const built = build(initial, initialSummary, { ...command, count }), data = JSON.parse(built.text);
    assert.deepEqual(data.nodes.slice(0, 4), rail.nodes);
    assert.deepEqual(data.nodes[4], { kind: 'linear-pattern', parent: { node: 3, side: 'solid' }, axis: 'x', spacing: { parameter: 'patternSpacing' }, count });
    assert.deepEqual(data.outputs, outputs(count));
    assert.deepEqual(data.parameters, { ...rail.parameters, patternSpacing: 40 });
    assert.deepEqual({ ...built, text: undefined }, { text: undefined, kind: 'linear-pattern', selectedOutput: 'part', consumed: [] });
    assert.ok(Object.is(data.nodes[0].min[0], -0)); assert.ok(Object.is(data.parameters.unusedSignedZero, -0));
    assert.equal(text(data), built.text); authored(data); patterns.set(count, data);
  }
  assert.equal(text(rail), initial); assert.deepEqual(initialSummary, summary(rail));
});
group('Count-correlated last-offset bounds and unrounded decimal forwarding', () => {
  for (const count of [2, 3, 4]) {
    const maximum = 10000 / (count - 1);
    for (const spacing of [Number.MIN_VALUE, 0.1, 1.23456789, maximum]) {
      const data = JSON.parse(build(initial, initialSummary, { ...command, count, spacing }).text);
      assert.ok(Object.is(data.parameters.patternSpacing, spacing)); authored(data);
    }
    for (const spacing of [0, -0, -1, maximum + 0.000001, 10001, NaN, Infinity, '40'])
      assert.throws(() => build(initial, initialSummary, { ...command, count, spacing }));
  }
});
group('Strict own count refuses unsupported values, extra fields and hostile records', () => {
  for (const count of [undefined, null, 0, -0, 1, 5, 2.5, NaN, Infinity, '2', '3', '4', [], {}, true])
    assert.throws(() => build(initial, initialSummary, { ...command, count }));
  assert.throws(() => build(initial, initialSummary, { ...command, count: 3, extra: true }));
  let getterCalls = 0;
  const accessor = { ...command };
  Object.defineProperty(accessor, 'count', { enumerable: true, get() { getterCalls++; return 3; } });
  assert.throws(() => build(initial, initialSummary, accessor)); assert.equal(getterCalls, 0);
  assert.throws(() => build(initial, initialSummary, Object.assign(Object.create({ count: 3 }), command)));
});
group('Output inventory must exactly match count, role, side and node', () => {
  for (const [count, original] of patterns) {
    for (const change of [
      data => { delete data.outputs.railCopy1; },
      data => { data.outputs.alias = clone(data.outputs.part); },
      data => { data.outputs.railCopy1.side = 'instance2'; },
      data => { data.outputs.railCopy1.node = 3; },
      data => { data.outputs.part.side = 'instance1'; },
      data => { data.nodes[4].count = count === 2 ? 4 : 2; },
      data => { data.nodes[4].count = String(count); },
      data => { data.nodes[4].extra = 1; },
      data => { data.nodes[4].axis = 'y'; },
      data => { data.nodes[4].parent.node = 2; },
    ]) { const data = clone(original); change(data); refused(data); }
    if (count < 4) { const data = clone(original); data.outputs.railCopy3 = { node: 4, side: 'instance3' }; refused(data); }
  }
});
group('Count is structural; parameter-only changes preserve history identity', () => {
  for (const [count, original] of patterns) {
    const data = clone(original); data.parameters.patternSpacing = 41; data.parameters.bevelDistance = 0.5;
    assert.equal(same(text(original), text(data)), true);
    data.parameters.patternSpacing = count === 2 ? 40 : 6000;
    data.parameters.bevelDistance = 20;
    assert.equal(same(text(original), text(data)), true, 'History identity does not assert native feasibility');
    assert.equal(capabilities(text(data), summary(data)).patternAuthored, false);
    for (const [otherCount, other] of patterns)
      assert.equal(same(text(original), text(other)), count === otherCount);
  }
});
group('Count-owned copy names refuse collisions; old count3 unused railCopy3 survives', () => {
  for (const count of [2, 3, 4]) for (const name of ['railCopy1', 'railCopy2', 'railCopy3'].slice(0, Math.max(2, count - 1))) {
    const data = clone(rail); data.parameters[name] = 1;
    assert.throws(() => build(text(data), summary(data), { ...command, count }));
  }
  const compatible = clone(rail); compatible.parameters.railCopy3 = 7;
  const compatibleText = text(compatible), compatibleSummary = summary(compatible);
  assert.ok(capabilities(compatibleText, compatibleSummary).linearPattern);
  for (const count of [undefined, 2, 3]) {
    const input = count === undefined ? command : { ...command, count };
    const result = build(compatibleText, compatibleSummary, input), data = JSON.parse(result.text);
    assert.equal(data.parameters.railCopy3, 7); authored(data);
    const changed = clone(data); changed.parameters.patternSpacing = 41;
    assert.equal(same(result.text, text(changed)), true);
  }
  assert.throws(() => build(compatibleText, compatibleSummary, { ...command, count: 4 }));
  for (const original of patterns.values()) {
    const duplicate = summary(original); duplicate.outputs[1].solidId = duplicate.outputs[0].solidId;
    assert.equal(capabilities(text(original), duplicate).patternAuthored, false);
  }
});
Object.keys(checked).forEach(verify);
console.log(JSON.stringify({ status: 'PASS', issue: 2016, node: process.version, groups: ledger, sourceHashes: checked,
  limits: { pureOnly: true, nativeCalls: 0, workerReplies: 0, gpuCalls: 0 } }));
