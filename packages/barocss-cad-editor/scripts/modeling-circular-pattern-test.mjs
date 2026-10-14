// #2011 bounded authoring tests. Synthetic summary IDs only; no native or receiver proof.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-circular-pattern-2011');
const hashes = JSON.parse(process.env.FROZEN_SOURCE_HASHES ?? '{}');
const paths = ['packages/barocss-cad-editor/src/modeling-structure.ts', 'packages/barocss-cad-editor/src/modeling-rectangular-part.ts', 'packages/barocss-cad-editor/scripts/modeling-circular-pattern-test.mjs'];
for (const path of paths) assert.equal(createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex'), hashes[path], path);
mkdirSync(output, { recursive: true });
const built = await require('esbuild').build({ stdin: { contents: paths.slice(0, 2).map(path => `export * from ${JSON.stringify(resolve(root, path))};`).join('\n'), resolveDir: root }, bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'no-native', setup(build) { build.onResolve({ filter: /@barocss\/cad|modeling-engine|\.wasm/ }, args => { throw Error('Native import prohibited: ' + args.path); }); } }] });
writeFileSync(resolve(output, 'pure.mjs'), built.outputFiles[0].text);
const api = await import(pathToFileURL(resolve(output, 'pure.mjs')));
const { canonicalModelingText: text, getModelingStructureCapabilities: caps, buildModelingStructure: build, sameModelingStructure: same } = api;
const clone = value => structuredClone(value);
const summary = d => ({ source: 'model', documentId: 'synthetic_authoring', revision: 0, parameters: clone(d.parameters),
  features: d.nodes.map((n, index) => ({ kind: n.kind, index, dependencies: n.kind === 'sketch' ? [] : [n.kind === 'extrude' ? n.sketch : n.parent.node] })),
  outputs: Object.entries(d.outputs).map(([name, ref]) => ({ name, solidId: 'synthetic_' + ref.node + '_' + ref.side, volumeMM3: null })) });
let rail = JSON.parse(api.createRectangularPartSource({ width: '32', height: '24', thickness: '8' }));
rail.nodes[0].min[0] = -0;
rail.nodes[0].max[1] = { op: 'add', left: { parameter: 'height' }, right: { op: 'scale', value: -0, factor: 1 } };
for (const distance of [1, 2]) rail = JSON.parse(build(text(rail), summary(rail), { kind: 'chamfer', target: caps(text(rail), summary(rail)).chamfer, distance }).text);
const before = text(rail), accepted = summary(rail), target = caps(before, accepted).circularPattern;
const command = { kind: 'circular-pattern', target };
const groups = [];
function group(name, fn) { fn(); groups.push(name); console.log('PASS ' + name); }
function refuses(d) { assert.equal(caps(text(d), summary(d)).circularPattern, null); }
let result, pair;
group('01 exact node, outputs, selected copy and preserved source', () => {
  assert.deepEqual(target, { name: 'part', solidId: 'synthetic_3_solid', node: 3 });
  result = build(before, accepted, command); pair = JSON.parse(result.text);
  assert.deepEqual(pair.nodes.slice(0, 4), rail.nodes); assert.deepEqual(pair.parameters, rail.parameters);
  assert.deepEqual(pair.nodes[4], { kind: 'circular-pattern', parent: { node: 3, side: 'solid' }, axis: 'x', angleDegrees: 90, count: 4 });
  assert.deepEqual(pair.outputs, { part: { node: 3, side: 'solid' }, radialCopy1: { node: 4, side: 'instance1' }, radialCopy2: { node: 4, side: 'instance2' }, radialCopy3: { node: 4, side: 'instance3' } });
  assert.equal(result.selectedOutput, 'radialCopy3'); assert.deepEqual(result.consumed, []); assert.ok(Object.is(pair.nodes[0].min[0], -0));
});
group('02 terminal four-body pattern and shared dimension identity', () => {
  const c = caps(result.text, summary(pair)); assert.equal(c.circularAuthored, true);
  for (const key of ['circularPattern', 'mirrorPart', 'linearPattern', 'rotatePart', 'movePart', 'chamfer', 'addArm', 'addHole', 'cutPocket', 'union']) assert.equal(c[key], null, key);
  const changed = clone(pair); changed.parameters.backBevelDistance = 3; assert.ok(same(result.text, text(changed)));
  assert.equal(caps(text(changed), summary(changed)).circularAuthored, true);
  assert.equal(text(rail), before); assert.deepEqual(accepted, summary(rail));
});
group('03 stale target and summary identities refuse', () => {
  for (const t of [{ ...target, node: 2 }, { ...target, name: 'elsewhere' }, { ...target, solidId: 'stale' }]) assert.throws(() => build(before, accepted, { kind: 'circular-pattern', target: t }));
  const s = clone(accepted); s.parameters.width = 99; assert.equal(caps(before, s).circularPattern, null);
  s.parameters = clone(rail.parameters); s.features[3].dependencies = [1]; assert.equal(caps(before, s).circularPattern, null);
});
group('04 output name and parameter collisions refuse', () => {
  for (const mutate of [d => { d.parameters.radialCopy1 = 1; }, d => { d.parameters.radialCopy2 = 1; }, d => { d.parameters.radialCopy3 = 1; }, d => { d.outputs.radialCopy3 = d.outputs.part; }, d => { d.outputs.alias = d.outputs.part; }]) { const d = clone(rail); mutate(d); refuses(d); }
});
group('05 unknown command fields, accessors and prototypes refuse', () => {
  assert.throws(() => build(before, accepted, { ...command, plane: 'xy' }));
  let getterCalls = 0;
  const getter = { ...command }; Object.defineProperty(getter, 'target', { enumerable: true, get() { getterCalls++; throw Error('must not invoke'); } });
  assert.throws(() => build(before, accepted, getter)); assert.equal(getterCalls, 0);
  assert.throws(() => build(before, accepted, Object.assign(Object.create({ extra: true }), command)));
  assert.throws(() => build(before, accepted, { ...command, [Symbol('extra')]: true }));
});
group('06 changed axis, references and output inventory refuse', () => {
  for (const mutate of [d => { d.nodes[4].axis = 'y'; }, d => { d.nodes[4].count = 3; }, d => { d.nodes[4].angleDegrees = -90; }, d => { d.outputs.radialCopy1.side = 'instance3'; }, d => { d.nodes[4].parent.node = 2; }, d => { d.outputs.radialCopy3.node = 3; }, d => { d.outputs.radialCopy3.side = 'instance1'; }, d => { delete d.outputs.part; }]) {
    const d = clone(pair); mutate(d); assert.equal(caps(text(d), summary(d)).circularAuthored, false); assert.equal(same(result.text, text(d)), false);
  }
});
group('07 duplicate native output IDs refuse without geometry fabrication', () => {
  const s = summary(pair); s.outputs[1].solidId = s.outputs[0].solidId;
  assert.equal(caps(result.text, s).circularAuthored, false);
});
group('08 changed ancestry and extra transform refuse', () => {
  const d = clone(rail); d.nodes[3].edge.at.y = 0; refuses(d);
  const extra = clone(pair); extra.nodes.push({ kind: 'translate', parent: { node: 4, side: 'solid' }, offset: [1, 0, 0] }); extra.outputs.radialCopy3.node = 5;
  assert.equal(caps(text(extra), summary(extra)).circularAuthored, false);
});
group('09 existing pattern remains separate and terminal', () => {
  const pattern = build(before, accepted, { kind: 'linear-pattern', target: caps(before, accepted).linearPattern, spacing: 40 });
  const d = JSON.parse(pattern.text), c = caps(pattern.text, summary(d)); assert.equal(c.patternAuthored, true); assert.equal(c.circularPattern, null);
  d.parameters.patternSpacing = 50; assert.ok(same(pattern.text, text(d)));
});
group('10 existing cardinal rotation remains separate', () => {
  const rotated = build(before, accepted, { kind: 'rotate-part', target: caps(before, accepted).rotatePart, axis: 'x', angleDegrees: 90 });
  const d = JSON.parse(rotated.text), c = caps(rotated.text, summary(d)); assert.ok(c.movePart); assert.equal(c.circularPattern, null);
});
group('11 signed nested source and no-op roundtrip', () => {
  assert.ok(Object.is(pair.nodes[0].max[1].right.value, -0)); assert.equal(text(pair), result.text); assert.ok(same(result.text, result.text));
  assert.equal(pair.nodes.length, 5); assert.deepEqual(Object.keys(pair.parameters).sort(), Object.keys(rail.parameters).sort());
});
group('12 summary suppression and malformed circular pattern refuse', () => {
  const s = summary(pair); s.suppression = { hiddenFinish: true }; assert.equal(caps(result.text, s).circularAuthored, false);
  const d = clone(pair); d.nodes[4].offset = [0, 0, 0]; assert.equal(caps(text(d), summary(d)).circularAuthored, false);
});
group('13 existing mirror stays separate', () => { const m = build(before, accepted, {kind:'mirror-part',target:caps(before,accepted).mirrorPart}); const d=JSON.parse(m.text); assert.ok(caps(m.text,summary(d)).mirrorAuthored); assert.equal(caps(m.text,summary(d)).circularPattern,null); });
const receipt = { issue: 2011, groups, sourceHashes: hashes, nativeCalls: 0, rendererCalls: 0, scope: 'Pure authoring helpers and synthetic summary identity only. No native circular packet, controller receiver, React interaction or physical GPU proof.' };
writeFileSync(resolve(output, 'result.json'), JSON.stringify(receipt, null, 2) + '\n');
