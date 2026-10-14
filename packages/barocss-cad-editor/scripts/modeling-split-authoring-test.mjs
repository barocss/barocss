// #2018: pure split authoring contract only. No engine, native provider, Worker or GPU.
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
const initial = text(rail), initialSummary = summary(rail);
const caps = capabilities(initial, initialSummary);
const target = caps.splitPart, command = { kind: 'split-part', target, at: 16 };
assert.ok(target); assert.equal(caps.splitDefaultAt, 16);
const expectedNode = { kind: 'split', parent: { node: 3, side: 'solid' }, axis: 'x', at: { parameter: 'splitAt' } };
const expectedOutputs = { negative: { node: 4, side: 'negative' }, positive: { node: 4, side: 'positive' } };
const ledger = [];
function group(name, test) { test(); ledger.push(name); console.log(JSON.stringify({ status: 'PASS', name })); }
const built = build(initial, initialSummary, command), split = JSON.parse(built.text);
const refuses = data => {
  const source = text(data), found = capabilities(source, summary(data));
  assert.equal(found.splitPart, null);
  assert.throws(() => build(source, summary(data), command));
};
group('Exact split parent/axis/parameter and two-side replacement preserve original source and signed zeros', () => {
  assert.deepEqual(target, { name: 'part', node: 3, solidId: 'controlled_3_solid' });
  assert.deepEqual(split.nodes.slice(0, 4), rail.nodes); assert.deepEqual(split.nodes[4], expectedNode);
  assert.deepEqual(split.outputs, expectedOutputs); assert.deepEqual(split.parameters, { ...rail.parameters, splitAt: 16 });
  assert.deepEqual({ ...built, text: undefined }, { text: undefined, kind: 'split-part', selectedOutput: 'negative', consumed: ['part'] });
  assert.ok(Object.is(split.nodes[0].min[0], -0)); assert.ok(Object.is(split.nodes[0].max[0].right, -0));
  assert.ok(Object.is(split.parameters.unusedSignedZero, -0)); assert.equal(text(split), built.text);
  assert.equal(text(rail), initial); assert.deepEqual(initialSummary, summary(rail));
});
group('Half-width default evaluates authored expressions and does not recenter existing splitAt', () => {
  const data = clone(rail); data.parameters.width = 31.25;
  assert.equal(capabilities(text(data), summary(data)).splitDefaultAt, 15.625);
  const changed = clone(split); changed.parameters.width = 40; changed.parameters.backBevelDistance = 3;
  const found = capabilities(text(changed), summary(changed)); assert.equal(found.splitAuthored, true);
  assert.equal(changed.parameters.splitAt, 16); assert.equal(found.splitDefaultAt, null);
  assert.equal(same(built.text, text(changed)), true);
  changed.parameters.splitAt = 8.125; assert.equal(same(built.text, text(changed)), true);
});
group('Finite signed decimal coordinate passes unchanged through +/-10000; native feasibility is not invented', () => {
  for (const at of [-10000, -1.23456789, -0, 0, Number.MIN_VALUE, 8.125, 16, 32, 10000]) {
    const data = JSON.parse(build(initial, initialSummary, { ...command, at }).text);
    assert.ok(Object.is(data.parameters.splitAt, at)); assert.deepEqual(data.nodes[4], expectedNode);
    assert.equal(capabilities(text(data), summary(data)).splitAuthored, true);
  }
  for (const at of [-10000.000001, 10000.000001, NaN, Infinity, -Infinity, '16', null, undefined, {}, []])
    assert.throws(() => build(initial, initialSummary, { ...command, at }));
});
group('Reserved parameters/outputs and 16-driver budget refuse before provider work', () => {
  for (const key of ['splitAt', 'negative', 'positive']) {
    const parameterCollision = clone(rail); parameterCollision.parameters[key] = 7; refuses(parameterCollision);
    const outputCollision = clone(rail); outputCollision.outputs[key] = clone(rail.outputs.part); refuses(outputCollision);
  }
  const data = clone(rail);
  while (Object.keys(data.parameters).length < 16) data.parameters['extra' + Object.keys(data.parameters).length] = 0;
  refuses(data);
});
group('Selected current source/summary/native identity, sole output and exact final chamfer are required', () => {
  for (const changed of [{ ...target, name: 'alias' }, { ...target, node: 2 }, { ...target, solidId: 'stale' }, { ...target, extra: true }])
    assert.throws(() => build(initial, initialSummary, { ...command, target: changed }));
  for (const mutate of [
    value => { value.parameters.width = 42; }, value => { value.features[3].dependencies = [1]; },
    value => { value.features[3].kind = 'extrude'; }, value => { value.suppression = { finish: true }; },
    value => { value.outputs.push({ ...value.outputs[0], name: 'alias' }); },
    value => { value.revision = -0; }, value => { value.source = 'legacy'; },
  ]) { const value = clone(initialSummary); mutate(value); assert.equal(capabilities(initial, value).splitPart, null); }
  for (const mutate of [
    data => { data.outputs.alias = clone(data.outputs.part); }, data => { data.outputs.part.node = 2; },
    data => { data.nodes[3].name = 'named'; }, data => { data.nodes[3].parent.node = 1; },
    data => { data.nodes[3].edge.at.y = 24; }, data => { data.nodes[2].edge.parallelTo = 'y'; },
    data => { data.nodes[1].from = 0; }, data => { data.nodes[0].min = [1, 0]; },
    data => { data.nodes[0].max[0] = { parameter: 'bevelDistance' }; },
  ]) { const data = clone(rail); mutate(data); refuses(data); }
});
group('Commands are exact bounded own data; hostile getters and unsupported axis fields refuse', () => {
  for (const extra of [{ axis: 'y' }, { extra: true }, { at: undefined }, { [Symbol('extra')]: true }])
    assert.throws(() => build(initial, initialSummary, { ...command, ...extra }));
  let getters = 0; const hostile = { ...command };
  Object.defineProperty(hostile, 'at', { enumerable: true, get() { getters++; return 16; } });
  assert.throws(() => build(initial, initialSummary, hostile)); assert.equal(getters, 0);
  assert.throws(() => build(initial, initialSummary, Object.assign(Object.create({ at: 8 }), command)));
});
group('Accepted split is terminal and single-parent dependency validation handles both distinct sides', () => {
  const found = capabilities(built.text, summary(split)); assert.equal(found.splitAuthored, true);
  for (const key of ['splitPart', 'circularPattern', 'mirrorPart', 'linearPattern', 'rotatePart', 'movePart', 'chamfer', 'addArm', 'addHole', 'cutPocket', 'union', 'cutSlot']) assert.equal(found[key], null, key);
  refuses(split);
  const duplicate = summary(split); duplicate.outputs[1].solidId = duplicate.outputs[0].solidId;
  assert.equal(capabilities(built.text, duplicate).splitAuthored, false);
  const wrongParent = summary(split); wrongParent.features[4].dependencies = [2];
  assert.equal(capabilities(built.text, wrongParent).splitAuthored, false);
  for (const mutate of [
    data => { data.outputs.negative.side = 'positive'; }, data => { data.outputs.positive.node = 3; },
    data => { delete data.outputs.positive; }, data => { data.outputs.part = { node: 3, side: 'solid' }; },
    data => { data.nodes[4].parent.side = 'negative'; }, data => { data.nodes[4].at = 16; },
    data => { data.nodes[4].axis = 'y'; }, data => { data.nodes[4].name = 'foreign'; },
    data => { data.parameters.negative = 1; }, data => { data.nodes[0].max[0] = { parameter: 'splitAt' }; },
  ]) { const data = clone(split); mutate(data); assert.equal(capabilities(text(data), summary(data)).splitAuthored, false); }
});
group('Pattern counts2/3/4, Mirror, Circular and rotation remain valid and cannot be split', () => {
  for (const count of [2, 3, 4]) {
    const result = build(initial, initialSummary, { kind: 'linear-pattern', target: caps.linearPattern, spacing: 40, count });
    const data = JSON.parse(result.text); assert.equal(capabilities(result.text, summary(data)).patternAuthored, true); refuses(data);
  }
  for (const [kind, key, authored] of [['mirror-part', 'mirrorPart', 'mirrorAuthored'], ['circular-pattern', 'circularPattern', 'circularAuthored']]) {
    const result = build(initial, initialSummary, { kind, target: caps[key] }), data = JSON.parse(result.text);
    assert.equal(capabilities(result.text, summary(data))[authored], true); refuses(data);
  }
  const rotated = JSON.parse(build(initial, initialSummary, { kind: 'rotate-part', target: caps.rotatePart, axis: 'x', angleDegrees: 90 }).text);
  refuses(rotated); const moved = JSON.parse(build(text(rotated), summary(rotated), { kind: 'move-part', target: capabilities(text(rotated), summary(rotated)).movePart, x: 40, y: 16, z: 0 }).text); refuses(moved);
});
group('Retained split preset sources and Y/derived authoring variants keep dimension-history identity', () => {
  const load = family => {
    const path = `packages/barocss-cad-editor/scripts/fixtures/${family}/baseline-transport.json`;
    verify(path); return JSON.parse(JSON.parse(readFileSync(resolve(root, path), 'utf8')).text);
  };
  // Only source text is read. No packet geometry is relabeled or executed.
  const chamfer = load('modeling-chamfer-split'), cardinal = load('modeling-cardinal-split');
  const horizontal = load('modeling-split'), miter = load('modeling-miter');
  const y = clone(cardinal); y.nodes[2].axis = 'y';
  const z = clone(chamfer); z.nodes[4].axis = 'z'; z.parameters.splitAt = 4;
  // Exact centered authoring expression from the existing derived-split recipe.
  const derived = clone(chamfer); delete derived.parameters.splitAt;
  derived.parameters.width = 32; derived.parameters.offset = 0;
  derived.nodes[0].max[0] = { parameter: 'width' };
  derived.nodes[4].at = { op: 'add', left: { op: 'scale', value: { parameter: 'width' }, factor: 0.5 }, right: { parameter: 'offset' } };
  for (const data of [chamfer, cardinal, horizontal, miter, y, z, derived]) {
    const changed = clone(data), key = Object.keys(changed.parameters)[0]; changed.parameters[key] += 1;
    assert.equal(same(text(data), text(changed)), true, 'No global rail-specific split guard');
    const found = capabilities(text(data), summary(data));
    assert.equal(found.splitPart, null); assert.equal(found.splitAuthored, false, 'Foreign presets do not acquire command ownership');
  }
});
Object.keys(checked).forEach(verify);
console.log(JSON.stringify({ status: 'PASS', issue: 2018, node: process.version, groups: ledger, sourceHashes: checked,
  limits: { pureOnly: true, nativeCalls: 0, workerReplies: 0, gpuCalls: 0 } }));
