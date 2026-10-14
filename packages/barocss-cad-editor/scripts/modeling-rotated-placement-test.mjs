// #1999: frozen authoring/transaction replay, NOT transformed-native or browser evidence.
// Real current structure helper, engine, serializer, controller and CPU receiver execute.
// The native provider, Worker transport and display ownership are explicit controlled doubles.
// Every delivery deliberately retains the complete UNTRANSFORMED two-bevel6064 mesh.
// Supply FROZEN_SOURCE_HASHES (JSON repo-relative path -> SHA256) after final source freeze.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../..');
const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value), parse = value => JSON.parse(value);
const source = name => resolve(root, 'packages/barocss-cad-editor/src', name + '.ts');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const pureLedger = Object.freeze([
  'P01 exact owned four-to-five rotate append',
  'P02 exact owned five-to-six move append and signed decimals',
  'P03 preserved prefix signed zeros and nested expressions',
  'P04 cardinal options and world-origin derived envelopes',
  'P05 target summary dependencies and source identity',
  'P06 unsupported foreign configured suppressed and alias graphs',
  'P07 own-data options accessors symbols and prototypes',
  'P08 reserved drivers parameter and expression limits',
  'P09 source and retained-history byte budgets',
  'P10 old command and capability parity',
  'P11 rotation-aware parameter versus structural identity',
  'P12 retained fixture provenance and accepted-source envelope distinction',
]);
const controllerLedger = Object.freeze([
  'C01 accepted rail admission through serializer and CPU receiver',
  'C02 rotate preview then explicit promotion and exact source binding',
  'C03 move preview then explicit promotion',
  'C04 placement parameter edit retains immutable graph',
  'C05 structural versus parameter Undo Redo',
  'C06 normalized parameter no-op sends no worker request',
  'C07 native receiver and display refusal retain accepted authority',
  'C08 lost acceptance acknowledgement and explicit recovery',
  'C09 cancel stale generation and held late reply',
  'C10 accepted-source CPU roundtrip and pre-load history budget',
]);
const frozen = Object.freeze({ issue: 1999, base: 'f4cfed65db7272fa006e8bcd5f84479d83eb39a2', pureLedger, controllerLedger,
  controllerReplyCaps: Object.fromEntries(controllerLedger.map((name, index) => [name, [1, 4, 2, 2, 6, 0, 6, 5, 1, 2][index]])),
  controlledReplyLimit: 32, plannedReplyTotal: 29, controllerLifetimeLimit: 2, workerLifetimeLimit: 3,
  countPolicy: 'Every engine return, including direct, failed, discard, recovery and held replies, counts once before delivery. Duplicate delivery is prohibited. Both total and per-group caps are checked before evaluation.',
  geometryPolicy: 'Every controlled delivery uses the complete unchanged historical untransformed two-bevel6064 mesh/UV/lineage. Authored rotation/offset and summary context are mocked. No transformed-native geometry or actual pixels are proved.',
  raw1997Packet: 'Unavailable; the exact provider artifact request was posted once in issue1994 comment6166203260. This replay does not fabricate that packet.',
  baselinePath: 'packages/barocss-cad-editor/scripts/fixtures/modeling-chamfer-chain/baseline-transport.json', baselineBytes: 41471,
  baselineSHA256: '74e9a472c54aaa5d228a23d79b083c9a7c4c539bf5de6a5f274597e5fbfba4af',
  sourceBudgetPolicy: 'Synthetic64KiB/8MiB arithmetic and production retained-slot accounting only; no runtime20-entry eviction or native RSS claim.',
});
assert.ok(process.env.FROZEN_SOURCE_HASHES, 'Freeze final source hashes before executing this finite ledger.');
const frozenSourceHashes = parse(process.env.FROZEN_SOURCE_HASHES);
assert.equal(Object.getPrototypeOf(frozenSourceHashes), Object.prototype);
for (const path of ['packages/barocss-cad-editor/scripts/modeling-rotated-placement-test.mjs',
  ...['modeling-structure', 'modeling-controller', 'modeling-engine'].map(name => relative(root, source(name)))])
  assert.match(frozenSourceHashes[path] ?? '', /^[a-f0-9]{64}$/, 'Final freeze must include ' + path);
function verifyFrozenSources() {
  for (const [path, expected] of Object.entries(frozenSourceHashes)) {
    assert.equal(relative(root, resolve(root, path)), path, 'Use normalized repository-relative paths');
    assert.ok(!path.startsWith('../')); assert.match(expected, /^[a-f0-9]{64}$/);
    assert.equal(hash(readFileSync(resolve(root, path))), expected, 'Frozen source changed: ' + path);
  }
}
verifyFrozenSources();
if (process.env.FROZEN_LEDGER) assert.deepEqual(frozen, parse(readFileSync(process.env.FROZEN_LEDGER)));
const evidence = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-1999-rotated-placement');
mkdirSync(evidence, { recursive: true });
const output = resolve(evidence, 'attempt-' + new Date().toISOString().replaceAll(':', '-') + '-' + process.pid);
mkdirSync(output); writeFileSync(resolve(output, 'script.mjs'), readFileSync(import.meta.filename));
writeFileSync(resolve(output, 'frozen-ledger.json'), JSON.stringify(frozen, null, 2) + '\n');
writeFileSync(resolve(output, 'frozen-source-hashes.json'), JSON.stringify(frozenSourceHashes, null, 2) + '\n');
const scriptSHA256 = hash(readFileSync(import.meta.filename)), sourceHashes = {}, groups = [], replyLog = [], providerLog = [];
const counters = { replies: 0, controllers: 0, loads: 0, parameterEdits: 0, retainedUntransformedReplays: 0 };
let currentGroup = 'setup', groupReplyStart = 0;
process.on('uncaughtExceptionMonitor', cause => {
  const error = { group: currentGroup, message: String(cause), stack: cause.stack, counters, replyLog, providerLog, scriptSHA256, sourceHashes, frozenSourceHashes };
  writeFileSync(resolve(output, 'error.json'), JSON.stringify(error, null, 2) + '\n');
  if (!existsSync(resolve(evidence, 'first-error.json'))) writeFileSync(resolve(evidence, 'first-error.json'), JSON.stringify({ ...error, attempt: output }, null, 2) + '\n');
});
async function group(name, run) {
  currentGroup = name; groupReplyStart = counters.replies;
  await run(); groups.push({ name, result: 'PASS', replies: counters.replies - groupReplyStart });
  console.log(JSON.stringify(groups.at(-1))); writeFileSync(resolve(output, 'groups.json'), JSON.stringify(groups, null, 2) + '\n');
}
function recordInputs(metafile) {
  for (const input of Object.keys(metafile.inputs)) if (input !== '<stdin>' && !input.startsWith('double:')) {
    const path = relative(root, resolve(root, input));
    assert.ok(!/\.wasm$|native-runtime|opencascade|barocss-cad\/src\//i.test(path), 'No provider/native dependency may load');
    const actual = hash(readFileSync(resolve(root, path))); sourceHashes[path] = actual;
    assert.equal(actual, frozenSourceHashes[path], 'Every actual source input must be in the final source freeze: ' + path);
  }
}
const pureNames = ['modeling-structure', 'modeling-rectangular-part', 'modeling-circular-part', 'modeling-file'];
const noNative = { name: 'pure-no-native', setup(build) {
  build.onResolve({ filter: /@barocss\/cad|barocss-cad\/|modeling-engine/ }, args => { throw Error('Native/runtime import prohibited: ' + args.path); });
} };
const pureBuilt = await require('esbuild').build({ absWorkingDir: root, stdin: { contents: pureNames.map(name => `export * from ${JSON.stringify(source(name))};`).join('\n'), resolveDir: root },
  bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, plugins: [noNative] });
recordInputs(pureBuilt.metafile);
writeFileSync(resolve(output, 'pure.mjs'), pureBuilt.outputFiles[0].text);
const api = await import(pathToFileURL(resolve(output, 'pure.mjs')));
const { canonicalModelingText: text, buildModelingStructure: build, getModelingStructureCapabilities: capabilities,
  modelingSourceBytes: bytes, modelingSourceBudget: budget, sameModelingStructure: same } = api;
// Immutable pre-change helper is compared without requiring a transient local commit.
const oldSource = execFileSync('git', ['show', frozen.base + ':packages/barocss-cad-editor/src/modeling-structure.ts'], { cwd: root, encoding: 'utf8' });
sourceHashes['immutable-base-modeling-structure.ts'] = hash(oldSource);
const oldBuilt = await require('esbuild').build({ absWorkingDir: root, stdin: { contents: oldSource, sourcefile: 'baseline-modeling-structure.ts', loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false, plugins: [noNative] });
writeFileSync(resolve(output, 'baseline-pure.mjs'), oldBuilt.outputFiles[0].text);
const oldApi = await import(pathToFileURL(resolve(output, 'baseline-pure.mjs')));
const featureRows = d => d.nodes.map((node, index) => ({ kind: node.kind, index,
  dependencies: node.kind === 'sketch' ? [] : node.kind === 'extrude' ? [node.sketch]
    : node.kind === 'union' || node.kind === 'intersect' ? [node.left?.node, node.right?.node]
      : node.tool ? [node.parent.node, node.tool.node] : [node.parent.node] }));
function summary(d, revision = 1) {
  return { source: 'model', documentId: 'cad_model', revision, parameters: clone(d.parameters), features: featureRows(d),
    outputs: Object.entries(d.outputs).map(([name, ref]) => ({ name, solidId: 'controlled_node' + ref.node, volumeMM3: null })) };
}
const altered = (value, change) => { const result = clone(value); change(result); return result; };
const blank = parse(api.createRectangularPartSource({ width: '32', height: '24', thickness: '8' }));
blank.nodes[0].min[0] = -0; blank.parameters.unusedSignedZero = -0;
blank.nodes[0].max[1] = { op: 'add', left: { parameter: 'height' }, right: { op: 'scale', value: -0, factor: 1 } };
blank.nodes[1].height = { op: 'add', left: { parameter: 'thickness' }, right: -0 };
const blankText = text(blank);
const first = oldApi.buildModelingStructure(blankText, summary(blank), { kind: 'chamfer', target: oldApi.getModelingStructureCapabilities(blankText, summary(blank)).chamfer, distance: 1 });
const front = parse(first.text);
const second = oldApi.buildModelingStructure(first.text, summary(front), { kind: 'chamfer', target: oldApi.getModelingStructureCapabilities(first.text, summary(front)).chamfer, distance: 2 });
const initial = second.text, rail = parse(initial), initialSummary = summary(rail);
const rotateInput = { kind: 'rotate-part', target: capabilities(initial, initialSummary).rotatePart, axis: 'z', angleDegrees: 90 };
let rotated, moved, rotatedData, movedData;
const translation = { x: -2.5, y: 1.25, z: -0 };
function refused(d) {
  const c = capabilities(text(d), summary(d));
  assert.equal(c.rotatePart, null); assert.equal(c.movePart, null); assert.equal(c.placementAuthored, null); assert.ok(c.placementReason); return c;
}
function expectedEnvelope(dimensions, rotation = null, offset = [0, 0, 0]) {
  const corners = [];
  for (const x of [0, dimensions[0]]) for (const y of [0, dimensions[1]]) for (const z of [0, dimensions[2]]) {
    let p = [x, y, z];
    const turns = rotation ? ((rotation.angleDegrees / 90) % 4 + 4) % 4 : 0;
    for (let i = 0; i < turns; i++) p = rotation.axis === 'x' ? [p[0], -p[2], p[1]]
      : rotation.axis === 'y' ? [p[2], p[1], -p[0]] : [-p[1], p[0], p[2]];
    corners.push(p.map((value, index) => value + offset[index]));
  }
  return { min: [0, 1, 2].map(i => Math.min(...corners.map(p => p[i]))), max: [0, 1, 2].map(i => Math.max(...corners.map(p => p[i]))) };
}
function assertEnvelope(actual, expected) {
  for (const bound of ['min', 'max']) for (let i = 0; i < 3; i++) assert.equal(actual[bound][i] === expected[bound][i], true,
    `${bound}[${i}] must match exact cardinal arithmetic; derived zero sign is not authored intent`);
}
await group(pureLedger[0], () => {
  const before = clone(initialSummary), c = capabilities(initial, initialSummary);
  assert.deepEqual(c.rotatePart, { name: 'part', solidId: 'controlled_node3', node: 3 }); assert.equal(c.movePart, null);
  assert.equal(c.placementAuthored.rotation, null); assert.deepEqual(c.placementAuthored.offset, [0, 0, 0]);
  assertEnvelope(c.placementAuthored.envelope, expectedEnvelope([32, 24, 8]));
  rotated = build(initial, initialSummary, rotateInput); rotatedData = parse(rotated.text);
  assert.equal(rotatedData.nodes.length, 5); assert.deepEqual(rotatedData.nodes.slice(0, 4), rail.nodes);
  assert.deepEqual(rotatedData.nodes[4], { kind: 'rotate', parent: { node: 3, side: 'solid' }, axis: 'z', angleDegrees: 90 });
  assert.deepEqual(rotatedData.parameters, rail.parameters); assert.deepEqual(rotatedData.outputs, { part: { node: 4, side: 'solid' } });
  assert.deepEqual({ ...rotated, text: undefined }, { text: undefined, kind: 'rotate-part', selectedOutput: 'part', consumed: ['part'] });
  assert.deepEqual(summary(rotatedData).features.map(f => f.dependencies), [[], [0], [1], [2], [3]]);
  assert.deepEqual(initialSummary, before); assert.equal(build(initial, initialSummary, rotateInput).text, rotated.text);
});
await group(pureLedger[1], () => {
  const c = capabilities(rotated.text, summary(rotatedData)); assert.equal(c.rotatePart, null); assert.equal(c.movePart.node, 4);
  moved = build(rotated.text, summary(rotatedData), { kind: 'move-part', target: c.movePart, ...translation }); movedData = parse(moved.text);
  assert.equal(movedData.nodes.length, 6); assert.deepEqual(movedData.nodes.slice(0, 5), rotatedData.nodes);
  assert.deepEqual(movedData.nodes[5], { kind: 'translate', parent: { node: 4, side: 'solid' },
    offset: ['placementX', 'placementY', 'placementZ'].map(parameter => ({ parameter })) });
  assert.deepEqual(movedData.outputs, { part: { node: 5, side: 'solid' } });
  for (const [key, value] of Object.entries(rail.parameters)) assert.ok(Object.is(movedData.parameters[key], value));
  assert.equal(movedData.parameters.placementX, -2.5); assert.equal(movedData.parameters.placementY, 1.25); assert.ok(Object.is(movedData.parameters.placementZ, -0));
  assert.deepEqual(summary(movedData).features.map(f => f.dependencies), [[], [0], [1], [2], [3], [4]]);
  assert.deepEqual({ ...moved, text: undefined }, { text: undefined, kind: 'move-part', selectedOutput: 'part', consumed: ['part'] });
  for (const value of [0, -0, 0.1, -0.1, 1.23456789]) {
    const exact = parse(build(rotated.text, summary(rotatedData), { kind: 'move-part', target: c.movePart, x: value, y: value, z: value }).text);
    for (const key of ['placementX', 'placementY', 'placementZ']) assert.ok(Object.is(exact.parameters[key], value), 'No rounding or sign normalization');
  }
  const done = capabilities(moved.text, summary(movedData)); assert.equal(done.rotatePart, null); assert.equal(done.movePart, null);
  assert.deepEqual(done.placementAuthored.offset, [-2.5, 1.25, -0]);
});
await group(pureLedger[2], () => {
  for (const value of [rotatedData, movedData]) {
    assert.deepEqual(value.nodes.slice(0, 4), rail.nodes); assert.ok(Object.is(value.nodes[0].min[0], -0));
    assert.ok(Object.is(value.nodes[1].height.right, -0)); assert.ok(Object.is(value.nodes[3].edge.at.y.right.value, -0));
    assert.equal(text(value), value === rotatedData ? rotated.text : moved.text);
  }
  const nested = altered(rail, d => {
    d.parameters.width = 65; d.parameters.height = 48.5; d.parameters.thickness = 17;
    d.nodes[0].max[0] = { op: 'scale', value: { parameter: 'width' }, factor: 0.5 };
    d.nodes[0].max[1] = { op: 'add', left: { op: 'scale', value: { parameter: 'height' }, factor: 0.5 }, right: -0 };
    d.nodes[1].height = { op: 'scale', value: { parameter: 'thickness' }, factor: 0.5 };
    d.nodes[3].edge.at.y = clone(d.nodes[0].max[1]);
  });
  const result = build(text(nested), summary(nested), { ...rotateInput, target: capabilities(text(nested), summary(nested)).rotatePart });
  const resultData = parse(result.text); assert.deepEqual(resultData.nodes.slice(0, 4), nested.nodes);
  assertEnvelope(capabilities(result.text, summary(resultData)).placementAuthored.envelope, expectedEnvelope([32.5, 24.25, 8.5], rotateInput));
});
await group(pureLedger[3], () => {
  for (const axis of ['x', 'y', 'z']) for (const angleDegrees of [90, 180, 270, -90, -180, -270]) {
    const result = build(initial, initialSummary, { ...rotateInput, axis, angleDegrees }), d = parse(result.text);
    assert.equal(d.nodes[4].angleDegrees, angleDegrees); assert.equal(d.nodes[4].axis, axis);
    const c = capabilities(result.text, summary(d)); assert.deepEqual(c.placementAuthored.rotation, { axis, angleDegrees });
    assertEnvelope(c.placementAuthored.envelope, expectedEnvelope([32, 24, 8], { axis, angleDegrees }));
    const positioned = build(result.text, summary(d), { kind: 'move-part', target: c.movePart, x: -2.5, y: 1.25, z: -0.125 });
    assertEnvelope(capabilities(positioned.text, summary(parse(positioned.text))).placementAuthored.envelope,
      expectedEnvelope([32, 24, 8], { axis, angleDegrees }, [-2.5, 1.25, -0.125]));
  }
  for (const axis of ['X', '', 'xy', null, undefined, 0, [], {}]) assert.throws(() => build(initial, initialSummary, { ...rotateInput, axis }));
  for (const angleDegrees of [0, -0, 45, 360, -360, 90.01, NaN, Infinity, '90', null, undefined])
    assert.throws(() => build(initial, initialSummary, { ...rotateInput, angleDegrees }));
  for (const key of ['x', 'y', 'z']) for (const value of [NaN, Infinity, -Infinity, 10001, -10001, '1', null, undefined, [], {}])
    assert.throws(() => build(rotated.text, summary(rotatedData), { kind: 'move-part', target: capabilities(rotated.text, summary(rotatedData)).movePart, ...translation, [key]: value }));
});
await group(pureLedger[4], () => {
  for (const target of [{ ...rotateInput.target, name: 'old' }, { ...rotateInput.target, solidId: 'foreign' },
    { ...rotateInput.target, node: 2 }, { ...rotateInput.target, node: -0 }, { ...rotateInput.target, node: 4 }])
    assert.throws(() => build(initial, initialSummary, { ...rotateInput, target }));
  for (const change of [s => { s.features[3].dependencies = [1]; }, s => { s.features[3].index = 2; }, s => { s.features.pop(); },
    s => { s.outputs[0].name = 'wrong'; }, s => { s.outputs[0].solidId = 'bad/id'; }, s => { s.outputs.push(clone(s.outputs[0])); },
    s => { s.parameters.width = 33; }, s => { s.parameters.unusedSignedZero = 0; }, s => { s.source = 'legacy'; }, s => { s.suppression = { finish: false }; }]) {
    const wrong = altered(initialSummary, change); assert.equal(capabilities(initial, wrong).rotatePart, null); assert.throws(() => build(initial, wrong, rotateInput));
  }
  for (const raw of [null, '', '{', 'null', '[]']) assert.equal(capabilities(raw, initialSummary).rotatePart, null);
  const changed = altered(rail, d => { d.parameters.width = 33; });
  assert.throws(() => build(text(changed), initialSummary, rotateInput));
  assert.deepEqual(parse(build(text(changed), summary(changed), rotateInput).text).nodes.slice(0, 4), changed.nodes);
});
await group(pureLedger[5], () => {
  for (const d of [blank, front]) refused(d);
  for (const change of [d => { d.nodes[0].min[0] = 1; }, d => { d.nodes[1].from = 0; },
    d => { d.outputs.alias = clone(d.outputs.part); }, d => { d.outputs.rail = d.outputs.part; delete d.outputs.part; },
    d => { d.outputs.part.node = 2; }, d => { d.outputs.part.side = 'negative'; },
    d => { d.nodes[2].distance = 1; }, d => { d.nodes[2].edge.at.y = -0; }, d => { d.nodes[3].edge.at.y = 24; },
    d => { d.nodes[3].parent.node = 1; }, d => { d.nodes[3].edge.parallelTo = 'y'; }, d => { d.nodes[3].edge.at.z = 8; },
    d => { d.parameters.frontDistance = d.parameters.bevelDistance; d.nodes[2].distance = { parameter: 'frontDistance' }; },
    d => { d.nodes[2].name = 'front'; d.nodes[2].suppressed = false; }, d => { d.nodes[3].suppressed = true; },
    d => { d.configuration = { front: true }; }, d => { d.nodes[0].profile = 'circle'; },
    d => { d.nodes[0].max[0] = { op: 'add', left: 31, right: { parameter: 'bevelDistance' } }; }]) refused(altered(rail, change));
  for (const kind of ['mirror', 'scale', 'linear-pattern', 'circular-pattern', 'hole', 'split', 'cut', 'union', 'difference', 'translate'])
    refused(altered(rail, d => { d.nodes[3].kind = kind; }));
  for (const change of [d => { d.nodes[4].parent.node = 2; }, d => { d.nodes[4].axis = 'w'; },
    d => { d.nodes[4].angleDegrees = 45; }, d => { d.nodes[4].name = 'placed'; }, d => { d.outputs.alias = clone(d.outputs.part); }])
    refused(altered(rotatedData, change));
  for (const change of [d => { d.nodes[5].parent.node = 3; }, d => { d.nodes[5].offset[0] = -2.5; },
    d => { d.nodes[5].offset[0] = { parameter: 'width' }; },
    d => { d.nodes[0].max[0] = { op: 'add', left: 34.5, right: { parameter: 'placementX' } }; },
    d => { d.nodes.push(clone(d.nodes[5])); d.outputs.part.node = 6; }])
    refused(altered(movedData, change));
});
await group(pureLedger[6], () => {
  let getters = 0;
  const accessor = { ...rotateInput }; Object.defineProperty(accessor, 'axis', { enumerable: true, get() { getters++; return 'z'; } });
  assert.throws(() => build(initial, initialSummary, accessor)); assert.equal(getters, 0);
  const inherited = Object.assign(Object.create({ foreign: true }), rotateInput); assert.throws(() => build(initial, initialSummary, inherited));
  const symbolic = { ...rotateInput, [Symbol('hidden')]: true }; assert.throws(() => build(initial, initialSummary, symbolic));
  const hidden = { ...rotateInput }; Object.defineProperty(hidden, 'secret', { value: true }); assert.throws(() => build(initial, initialSummary, hidden));
  for (const extra of [{ center: [0, 0, 0] }, { matrix: [] }, { offset: [] }, { extra: true }]) assert.throws(() => build(initial, initialSummary, { ...rotateInput, ...extra }));
  const target = { ...rotateInput.target }; Object.defineProperty(target, 'node', { enumerable: true, get() { getters++; return 3; } });
  assert.throws(() => build(initial, initialSummary, { ...rotateInput, target })); assert.equal(getters, 0);
  const guarded = clone(initialSummary); Object.defineProperty(guarded, 'parameters', { enumerable: true, get() { getters++; return rail.parameters; } });
  assert.equal(capabilities(initial, guarded).rotatePart, null); assert.equal(getters, 0);
  const move = { kind: 'move-part', target: capabilities(rotated.text, summary(rotatedData)).movePart, ...translation };
  Object.defineProperty(move, 'x', { enumerable: true, get() { getters++; return 0; } });
  assert.throws(() => build(rotated.text, summary(rotatedData), move)); assert.equal(getters, 0);
});
await group(pureLedger[7], () => {
  for (const key of ['placementX', 'placementY', 'placementZ']) {
    const d = altered(rotatedData, d => { d.parameters[key] = 0; }); assert.equal(capabilities(text(d), summary(d)).movePart, null);
  }
  const crowded = altered(rotatedData, d => { for (let i = Object.keys(d.parameters).length; i < 14; i++) d.parameters['unused' + i] = 0; });
  assert.equal(capabilities(text(crowded), summary(crowded)).movePart, null);
  const full = altered(rotatedData, d => { for (let i = Object.keys(d.parameters).length; i < 13; i++) d.parameters['unused' + i] = 0; });
  const fullText = text(full), fullMove = build(fullText, summary(full), { kind: 'move-part', target: capabilities(fullText, summary(full)).movePart, ...translation });
  assert.equal(Object.keys(parse(fullMove.text).parameters).length, 16);
  for (const key of ['width', 'height', 'thickness']) for (const value of [0, -0, -1, 10001]) refused(altered(rail, d => { d.parameters[key] = value; }));
  for (const [key, value] of [['bevelDistance', 0], ['bevelDistance', 8], ['backBevelDistance', 0], ['backBevelDistance', 8]])
    refused(altered(rail, d => { d.parameters[key] = value; }));
  const overlap = altered(rail, d => { d.parameters.height = 3; }); refused(overlap);
  let deep = 1; for (let i = 0; i < 6; i++) deep = { op: 'add', left: deep, right: 0 };
  for (const value of [deep, { parameter: 'missing' }, { op: 'scale', value: 10000, factor: 2 }, { parameter: 'height', extra: 1 }])
    refused(altered(rail, d => { d.nodes[0].max[1] = value; d.nodes[3].edge.at.y = clone(value); }));
  const target = capabilities(rotated.text, summary(rotatedData)).movePart;
  const boundary = build(rotated.text, summary(rotatedData), { kind: 'move-part', target, x: -10000, y: 10000, z: 0 });
  assertEnvelope(capabilities(boundary.text, summary(parse(boundary.text))).placementAuthored.envelope,
    { min: [-10024, 10000, 0], max: [-10000, 10032, 8] }); // Offset budget is not an invented world-envelope restriction.
});
await group(pureLedger[8], () => {
  assert.equal(bytes('a'.repeat(65536)), 65536); assert.throws(() => bytes('a'.repeat(65537)), /64 KiB/);
  assert.equal(bytes('é'.repeat(32768)), 65536); assert.throws(() => bytes('é'.repeat(32769)), /UTF-8/);
  assert.equal(capabilities(initial + ' '.repeat(65536), initialSummary).rotatePart, null);
  assert.equal(budget([8 * 1024 * 1024 - 3], 1, [1, 1]), 8 * 1024 * 1024);
  assert.throws(() => budget([8 * 1024 * 1024 - 3], 1, [1, 2]), /8 MiB/);
  for (const value of [-1, -0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1']) assert.throws(() => budget([], value, []));
  assert.throws(() => budget(Array(21).fill(0), 0, [])); assert.throws(() => budget([], 0, Array(65).fill(0)));
  assert.equal(budget(Array(20).fill(65536), 65536, [65536, 65536, 65536]), 24 * 65536);
  assert.equal(budget([bytes(initial), bytes(rotated.text), bytes(moved.text)], bytes(moved.text), [bytes(initial)]),
    2 * bytes(initial) + bytes(rotated.text) + 2 * bytes(moved.text));
});
await group(pureLedger[9], () => {
  const priorFields = ({ rotatePart: _rotate, movePart: _move, placementReason: _reason, placementAuthored: _authored, ...prior }) => prior;
  const values = [blankText, first.text, initial, api.createCircularPartSource({ diameter: '8', thickness: '6' })];
  for (const command of [
    { kind: 'add-arm', field: 'addArm', x: 0, y: 0, width: 8, height: 24 },
    { kind: 'add-hole', field: 'addHole', x: 16, y: 12, radius: 2.5 },
    { kind: 'cut-pocket', field: 'cutPocket', wall: 8, floor: 4 },
    { kind: 'chamfer', field: 'chamfer', distance: 0.25 },
  ]) {
    const { field, ...value } = command, target = oldApi.getModelingStructureCapabilities(blankText, summary(blank))[field];
    const input = { ...value, target }, before = oldApi.buildModelingStructure(blankText, summary(blank), input);
    assert.deepEqual(build(blankText, summary(blank), input), before); values.push(before.text);
  }
  const arm = parse(values[4]), armText = text(arm), unionInput = { kind: 'union', targets: oldApi.getModelingStructureCapabilities(armText, summary(arm)).union };
  const union = oldApi.buildModelingStructure(armText, summary(arm), unionInput); assert.deepEqual(build(armText, summary(arm), unionInput), union); values.push(union.text);
  const united = parse(union.text), cutInput = { kind: 'cut-slot', target: oldApi.getModelingStructureCapabilities(union.text, summary(united)).cutSlot, x: 16, y: 2, width: 8, height: 4 };
  const cut = oldApi.buildModelingStructure(union.text, summary(united), cutInput); assert.deepEqual(build(union.text, summary(united), cutInput), cut); values.push(cut.text);
  values.push(text(altered(blank, d => { d.parameters.width = 32.5; })), text(altered(blank, d => { d.nodes[0].min[0] = 1; })));
  for (const value of values) assert.deepEqual(priorFields(capabilities(value, summary(parse(value)))), oldApi.getModelingStructureCapabilities(value, summary(parse(value))));
});
await group(pureLedger[10], () => {
  assert.equal(same(initial, rotated.text), false); assert.equal(same(rotated.text, moved.text), false);
  for (const [value, d] of [[rotated.text, rotatedData], [moved.text, movedData]]) {
    assert.equal(same(value, text(altered(d, d => { d.parameters.width = 33; }))), true);
    assert.equal(same(value, text(altered(d, d => { d.nodes[4].axis = 'x'; }))), false);
    assert.equal(same(value, text(altered(d, d => { d.nodes[4].angleDegrees = -270; }))), false, 'Equivalent orientation is distinct authored structure');
    assert.equal(same(value, text(altered(d, d => { d.nodes[0].min[0] = 0; }))), false);
  }
  assert.equal(same(moved.text, text(altered(movedData, d => { d.parameters.placementX = 0.1; }))), true);
  assert.equal(same(moved.text, text(altered(movedData, d => { d.nodes[5].offset[0] = { parameter: 'placementY' }; }))), false);
});
const baselinePath = resolve(root, frozen.baselinePath), baselineBytes = readFileSync(baselinePath), baseline = parse(baselineBytes);
const component = baseline.display.components[0], baselineObjectHash = hash(JSON.stringify(baseline));
await group(pureLedger[11], () => {
  assert.equal(baselineBytes.length, frozen.baselineBytes); assert.equal(hash(baselineBytes), frozen.baselineSHA256);
  assert.equal(baseline.ok, true); assert.equal(baseline.summary.outputs[0].volumeMM3.numerator, '6064');
  assert.deepEqual(baseline.summary.parameters, { frontDistance: 1, backDistance: 2, backY: 24 });
  assert.equal(parse(baseline.text).nodes.length, 4); assert.equal(component.report.triangleCount, 20); assert.equal(component.mesh.indices.length, 60);
  assert.notEqual(baseline.text, initial); refused(parse(baseline.text));
  const c = capabilities(moved.text, summary(movedData));
  assert.deepEqual(c.placementAuthored.rotation, { axis: 'z', angleDegrees: 90 });
  assertEnvelope(c.placementAuthored.envelope, { min: [-26.5, 1.25, 0], max: [-2.5, 33.25, 8] });
  const changed = altered(movedData, d => { d.parameters.width = 40; d.parameters.placementX = 2.5; });
  assertEnvelope(capabilities(text(changed), summary(changed)).placementAuthored.envelope, { min: [-21.5, 1.25, 0], max: [2.5, 41.25, 8] });
  assert.equal(capabilities(text(changed), summary(movedData)).placementAuthored, null, 'Derived status requires matching accepted source; no preview or stale summary');
});

const forbidden = () => { throw Error('No native evaluation, unrelated provider family, GPU, browser, STL or physical geometry in this replay.'); };
const nativeFailure = () => Object.assign(Error('Explicit mock provider refuses exact placementX0.1 without rounding'),
  { name: 'CadModelError', code: 'NATIVE', operation: 'build' });
let failEdit = false, failDisplay = false, mode = null;
function snapshot(data) {
  assert.ok([4, 5, 6].includes(data.nodes.length)); assert.deepEqual(Object.keys(data.outputs), ['part']);
  assert.equal(data.parameters.bevelDistance, 1); assert.equal(data.parameters.backBevelDistance, 2);
  // This body is ONLY a provider double. Its shape has not been transformed.
  const body = { family: 'convex-planar', native: { report: { solidId: component.report.solidId },
    certificate: { volumeMM3: { numerator: '6064', denominator: '1' } }, graph: clone(component.lineage.graph) } };
  return { parameters: clone(data.parameters), suppression: {}, features: featureRows(data), bodies: { part: body }, save: () => text(data),
    withParameters(changes) {
      counters.parameterEdits++; providerLog.push({ group: currentGroup, operation: 'withParameters', base: hash(text(data)), changes: clone(changes) });
      if (failEdit) { failEdit = false; assert.equal(changes.placementX, 0.1); throw nativeFailure(); }
      return snapshot({ ...clone(data), parameters: { ...data.parameters, ...changes } });
    }, withSuppression: forbidden, exportStl: forbidden };
}
globalThis.__rotatedPlacementCad = { cad: { model: forbidden, load(sourceText) {
  counters.loads++; providerLog.push({ group: currentGroup, operation: 'load', source: hash(sourceText), text: sourceText });
  return snapshot(parse(sourceText));
} }, tessellateConvexPlanarSolid(body, options) {
  assert.deepEqual(options, { maximumFanTriangles: 40 }); assert.equal(body.report.solidId, component.report.solidId);
  assert.deepEqual(body.graph, component.lineage.graph); counters.retainedUntransformedReplays++;
  return clone({ mesh: component.mesh, boundaries: component.boundaries, internalDiagonals: component.internalDiagonals, report: component.report });
}, tessellateSurface: forbidden, tessellateOwnPlateCircularHole: forbidden, tessellateXYCirclePrismShell: forbidden };
const gpu = resolve(output, 'gpu-entry.ts');
writeFileSync(gpu, ['engine-scene', 'engine-camera-ray', 'engine-raycast', 'kernel-face-preview']
  .map(name => `export * from ${JSON.stringify(resolve(root, 'packages/barocss-gpu/src', name + '.ts'))};`).join('\n'));
const built = await require('esbuild').build({ absWorkingDir: root, stdin: { contents: ['modeling-controller', 'modeling-engine'].map(name => `export * from ${JSON.stringify(source(name))};`).join('\n'), resolveDir: root },
  bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, alias: { '@barocss/gpu': gpu },
  plugins: [{ name: 'explicit-provider-no-native', setup(build) {
    build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'double' }));
    build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'double' }));
    build.onLoad({ filter: /.*/, namespace: 'double' }, args => ({ contents: args.path === 'provider'
      ? 'export const {cad,tessellateSurface,tessellateConvexPlanarSolid,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell}=globalThis.__rotatedPlacementCad;'
      : 'export function createPrismFeatureEngine(){return ()=>{throw Error("No legacy native execution");};}' }));
    build.onResolve({ filter: /\.wasm$|\/native-runtime|opencascade/i }, args => { throw Error('Native module prohibited: ' + args.path); });
  } }] });
// This generated re-export shim is harness source, not a mutable repository input.
const runtimeInputs = { ...built.metafile, inputs: Object.fromEntries(Object.entries(built.metafile.inputs)
  .filter(([path]) => resolve(root, path) !== gpu)) };
recordInputs(runtimeInputs);
sourceHashes['harness-gpu-entry.ts'] = hash(readFileSync(gpu));
writeFileSync(resolve(output, 'runtime.mjs'), built.outputFiles[0].text);
writeFileSync(resolve(output, 'runtime.metafile.json'), JSON.stringify(built.metafile, null, 2) + '\n');
const { createModelingEngine, createCadEditorModelingController } = await import(pathToFileURL(resolve(output, 'runtime.mjs')));
const previous = { Worker: globalThis.Worker, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
const workers = [], sessions = [], commands = [], held = [], timers = new Set();
function evaluate(engine, request, route = 'worker') {
  assert.ok(counters.replies < frozen.controlledReplyLimit, 'Stop before frozen32 total response ceiling');
  assert.ok(counters.replies - groupReplyStart < frozen.controllerReplyCaps[currentGroup], 'Stop before the frozen current-group response cap');
  const reply = engine(request); counters.replies++;
  replyLog.push({ number: counters.replies, group: currentGroup, route, request: request.kind, ok: reply.ok, kind: reply.kind,
    ...(request.text ? { requestSourceSHA256: hash(request.text) } : {}), ...(reply.ok ? {} : { message: reply.message }) });
  writeFileSync(resolve(output, 'replies.json'), JSON.stringify(replyLog, null, 2) + '\n');
  if (reply.ok && reply.display) assert.deepEqual(reply.display.components[0], component, 'Actual serializer retains the complete UNTRANSFORMED6064 mesh and lineage without relabeling');
  return reply;
}
globalThis.setTimeout = callback => { const timer = { callback }; timers.add(timer); return timer; };
globalThis.clearTimeout = timer => timers.delete(timer);
globalThis.Worker = class {
  callbacks = {}; engine = createModelingEngine(); terminated = false;
  constructor() { assert.ok(workers.length < frozen.workerLifetimeLimit); workers.push(this); }
  addEventListener(kind, callback) { this.callbacks[kind] = callback; }
  terminate() { this.terminated = true; }
  postMessage(request) {
    const copied = clone(request); commands.push(copied); const reply = evaluate(this.engine, copied);
    const active = mode?.kind === copied.kind ? mode : null; if (active) mode = null;
    if (typeof active?.action === 'function') active.action(reply);
    let delivered = false;
    const deliver = () => { assert.equal(delivered, false, 'No unbudgeted duplicate deliveries'); delivered = true; this.callbacks.message({ data: clone(reply) }); };
    if (active?.action === 'hold') held.push({ deliver, worker: this, request: copied }); else queueMicrotask(deliver);
  }
};
let acceptedHandle = null, visibleHandle = null, handleId = 0;
function displayHandle() {
  const handle = { id: ++handleId, disposed: false, committed: false,
    show() { assert.equal(handle.disposed, false); visibleHandle = handle; },
    commit() { assert.equal(handle.disposed, false); handle.committed = true; acceptedHandle = visibleHandle = handle; },
    dispose() { if (handle.disposed || handle.committed) return; handle.disposed = true; if (visibleHandle === handle) visibleHandle = acceptedHandle; } };
  return handle;
}
const port = { async prepare() { return displayHandle(); }, async preparePreview() {
  if (failDisplay) { failDisplay = false; throw Error('Explicit mock display prepare refusal'); } return displayHandle();
} };
const controller = display => { assert.ok(counters.controllers++ < frozen.controllerLifetimeLimit); const s = createCadEditorModelingController(display); sessions.push(s); return s; };
const session = controller(port), state = () => session.getSnapshot();
const authority = () => { const s = state(); return { accepted: s.accepted, authoredText: s.authoredText, display: s.display,
  generation: s.generation, history: s.history, selection: s.selection, faceSelection: s.faceSelection }; };
const retained = (before, handle = acceptedHandle) => { assert.deepEqual(authority(), before); assert.equal(acceptedHandle, handle); assert.equal(visibleHandle, handle); };
const work = () => [counters.loads, counters.parameterEdits, counters.retainedUntransformedReplays];
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
let rotateCommand, moveCommand, initialGeneration, rotatedSource, movedSource, editedSource, recoveredSource, prepareRequest, directId = 10000;
try {
  await group(controllerLedger[0], async () => {
    await session.open(initial); assert.equal(state().error, null); assert.equal(state().history.count, 1);
    assert.equal(state().accepted.features.length, 4); assert.equal(state().accepted.outputs[0].volumeMM3.numerator, '6064');
    assert.deepEqual(state().display.packet.components[0], component);
    assert.equal(state().display.scene.geometries.length, component.mesh.faces.length);
    assert.equal(commands.at(-1).text, initial); assert.equal(providerLog.at(-1).text, initial);
    session.select(3, state().generation); initialGeneration = state().generation;
    rotateCommand = { ...rotateInput, target: capabilities(state().authoredText, state().accepted).rotatePart };
    assert.equal(rotateCommand.target.node, 3); assert.equal(rotateCommand.target.solidId, state().accepted.outputs[0].solidId);
  });
  await group(controllerLedger[1], async () => {
    const before = authority(), handle = acceptedHandle, count = counters.replies;
    await assert.rejects(session.applyStructure(rotateCommand, state().generation), /Preview the current/); assert.equal(counters.replies, count);
    await session.previewStructure(rotateCommand, state().generation); await flush(); assert.equal(state().preview.status, 'ready', state().error);
    assert.deepEqual(authority(), before); assert.equal(acceptedHandle, handle); assert.notEqual(visibleHandle, handle);
    assert.equal(capabilities(state().authoredText, state().accepted).placementAuthored.rotation, null, 'Accepted status cannot report candidate rotation');
    prepareRequest = clone(commands.at(-1)); assert.equal(prepareRequest.kind, 'prepare-source');
    assert.equal(prepareRequest.baseText, initial); assert.equal(prepareRequest.text, rotated.text); assert.deepEqual(prepareRequest.command, rotateCommand);
    assert.equal(providerLog.at(-1).text, rotated.text, 'Exact requested rotate source reaches the provider double');
    const beforeStale = work();
    for (const changes of [{ baseText: initial + ' ' }, { command: { ...rotateCommand, target: { ...rotateCommand.target, solidId: 'foreign_result' } } }]) {
      const reply = evaluate(workers[0].engine, { ...prepareRequest, ...changes, id: ++directId, taskToken: 'direct_' + directId }, 'direct'); assert.equal(reply.ok, false);
    }
    assert.deepEqual(work(), beforeStale, 'Stale source/target does not reach the provider or destroy the prepared slot');
    await assert.rejects(session.applyStructure({ ...rotateCommand, angleDegrees: 180 }, state().generation), /Preview the current/);
    await assert.rejects(session.apply(), /structural command/);
    await session.applyStructure(rotateCommand, state().generation); assert.equal(state().error, null); assert.deepEqual(work(), beforeStale, 'Promotion does no second reconstruction');
    rotatedSource = state().authoredText; assert.equal(rotatedSource, rotated.text); assert.equal(state().history.count, 2);
    assert.equal(state().accepted.features.length, 5); assert.equal(state().selection, null);
    assert.deepEqual(state().accepted.features.map(f => f.dependencies), [[], [0], [1], [2], [3]]);
    assert.deepEqual(capabilities(rotatedSource, state().accepted).placementAuthored.rotation, { axis: 'z', angleDegrees: 90 });
    assert.equal(commands.at(-1).kind, 'accept-source'); assert.equal(commands.at(-1).text, rotated.text);
    await assert.rejects(session.applyStructure(rotateCommand, initialGeneration), /stale/);
  });
  await group(controllerLedger[2], async () => {
    moveCommand = { kind: 'move-part', target: capabilities(state().authoredText, state().accepted).movePart, ...translation };
    session.select(4, state().generation); const before = authority(), handle = acceptedHandle;
    await session.previewStructure(moveCommand, state().generation); assert.equal(state().preview.status, 'ready', state().error);
    assert.deepEqual(authority(), before); assert.equal(acceptedHandle, handle); assert.notEqual(visibleHandle, handle);
    assert.deepEqual(capabilities(state().authoredText, state().accepted).placementAuthored.offset, [0, 0, 0]);
    assert.equal(commands.at(-1).baseText, rotatedSource); assert.equal(commands.at(-1).text, moved.text);
    assert.deepEqual(commands.at(-1).command, moveCommand); assert.equal(providerLog.at(-1).text, moved.text);
    const beforePromotion = work(); await session.applyStructure(moveCommand, state().generation);
    assert.equal(state().error, null); assert.deepEqual(work(), beforePromotion); movedSource = state().authoredText;
    assert.equal(movedSource, moved.text); assert.equal(state().history.count, 3); assert.equal(state().accepted.features.length, 6);
    assert.deepEqual(parse(movedSource).nodes.slice(0, 5), rotatedData.nodes); assert.equal(state().selection, null);
    assert.deepEqual(state().accepted.features.map(f => f.dependencies), [[], [0], [1], [2], [3], [4]]);
    assert.deepEqual(capabilities(movedSource, state().accepted).placementAuthored.offset, [-2.5, 1.25, -0]);
    assert.deepEqual(state().display.packet.components[0], component, 'Placement context uses explicitly mocked unchanged geometry');
  });
  await group(controllerLedger[3], async () => {
    session.select(5, state().generation); session.stage('placementX', '1.25'); const before = authority(), loads = counters.loads;
    await session.preview(); assert.equal(state().preview.status, 'ready', state().error); assert.deepEqual(authority(), before);
    assert.deepEqual(commands.at(-1).parameters, { placementX: 1.25 });
    assert.deepEqual(providerLog.at(-1).changes, { placementX: 1.25 });
    assert.equal(capabilities(state().authoredText, state().accepted).placementAuthored.offset[0], -2.5);
    await session.apply(); assert.equal(state().error, null); editedSource = state().authoredText;
    assert.equal(state().accepted.parameters.placementX, 1.25); assert.equal(counters.loads, loads);
    assert.deepEqual(parse(editedSource).nodes, movedData.nodes); assert.equal(state().selection, 5); assert.equal(state().history.count, 4);
    assert.ok(Object.is(state().accepted.parameters.placementZ, -0));
    assertEnvelope(capabilities(editedSource, state().accepted).placementAuthored.envelope, { min: [-22.75, 1.25, 0], max: [1.25, 33.25, 8] });
  });
  await group(controllerLedger[4], async () => {
    const count = state().history.count, start = commands.length, loads = counters.loads, edits = counters.parameterEdits, revision = state().accepted.revision;
    await session.undo(); assert.equal(state().authoredText, movedSource); assert.equal(state().history.index, 2); assert.equal(state().accepted.features.length, 6);
    await session.undo(); assert.equal(state().authoredText, rotatedSource); assert.equal(state().history.index, 1); assert.equal(state().accepted.features.length, 5);
    assert.equal(capabilities(state().authoredText, state().accepted).movePart.node, 4);
    await session.redo(); assert.equal(state().authoredText, movedSource); assert.equal(state().accepted.features.length, 6);
    await session.redo(); assert.equal(state().authoredText, editedSource); assert.equal(state().history.index, 3);
    assert.equal(state().history.count, count); assert.equal(state().selection, null); assert.equal(state().faceSelection, null);
    assert.equal(state().accepted.revision, revision + 4);
    assert.deepEqual(commands.slice(start).map(r => r.kind), ['apply', 'prepare-source', 'accept-source', 'prepare-source', 'accept-source', 'apply']);
    assert.equal(commands[start + 1].text, rotatedSource); assert.equal(commands[start + 3].text, movedSource);
    assert.equal(counters.loads, loads + 2); assert.equal(counters.parameterEdits, edits + 2);
  });
  await group(controllerLedger[5], async () => {
    const before = authority(), count = counters.replies, providerWork = work();
    session.stage('placementX', '1.2500'); await session.preview(); assert.equal(state().preview.status, 'unchanged');
    await session.apply(); assert.deepEqual(state().drafts, {}); retained(before);
    assert.equal(counters.replies, count); assert.deepEqual(work(), providerWork);
  });
  await group(controllerLedger[6], async () => {
    session.stage('placementX', '0.1'); const before = authority(), handle = acceptedHandle; failEdit = true;
    await session.preview(); await flush(); retained(before, handle); assert.equal(state().preview.diagnostic.stage, 'native');
    assert.match(state().error, /without rounding/); assert.equal(state().drafts.placementX, '0.1');
    assert.equal(providerLog.at(-1).changes.placementX, 0.1); assert.equal(commands.findLast(r => r.kind === 'prepare-preview').parameters.placementX, 0.1);
    session.stage('placementX', '1.75');
    mode = { kind: 'prepare-preview', action(reply) { assert.equal(reply.ok, true); reply.display.components[0].mesh.positionsMM[0] += 1; } };
    await session.preview(); await flush(); retained(before, handle); assert.equal(state().preview.diagnostic.stage, 'transport');
    failDisplay = true; await session.preview(); await flush(); retained(before, handle);
    assert.equal(state().preview.diagnostic.stage, 'display'); assert.match(state().error, /display prepare refusal/);
  });
  await group(controllerLedger[7], async () => {
    const before = authority(), handle = acceptedHandle; session.stage('placementX', '2.5');
    await session.preview(); assert.equal(state().preview.status, 'ready', state().error); assert.deepEqual(authority(), before);
    mode = { kind: 'accept-preview', action: 'hold' }; const pending = session.apply();
    assert.equal(held.length, 1); const lost = held.shift(); assert.equal(timers.size, 1);
    [...timers][0].callback(); await pending; retained(before, handle); assert.equal(lost.worker.terminated, true); assert.equal(state().workerReady, false);
    lost.deliver(); await flush(); retained(before, handle);
    const count = counters.replies; await assert.rejects(session.preview(), /explicitly/); assert.equal(counters.replies, count);
    await session.preview(true); assert.equal(state().preview.status, 'ready', state().error); assert.deepEqual(authority(), before);
    assert.deepEqual(commands.slice(-2).map(r => r.kind), ['open', 'prepare-preview']); assert.equal(commands.at(-2).text, before.authoredText);
    await session.apply(); assert.equal(state().error, null); recoveredSource = state().authoredText;
    assert.equal(state().accepted.parameters.placementX, 2.5); assert.equal(state().accepted.revision, before.accepted.revision + 1);
    assert.equal(state().history.count, before.history.count + 1); assert.deepEqual(parse(recoveredSource).nodes, movedData.nodes);
  });
  await group(controllerLedger[8], async () => {
    const before = authority(), count = counters.replies;
    await assert.rejects(session.previewStructure(rotateCommand, initialGeneration), /stale/);
    assert.throws(() => session.select(3, initialGeneration), /stale/);
    session.stage('placementX', '3.5'); await assert.rejects(session.previewStructure(moveCommand, state().generation), /pending model dimensions/);
    assert.equal(counters.replies, count); mode = { kind: 'prepare-preview', action: 'hold' };
    const pending = session.preview(); await flush(); assert.equal(held.length, 1); const late = held.shift();
    session.cancel(); await pending; assert.equal(late.worker.terminated, true); retained(before); assert.equal(state().workerReady, false);
    late.deliver(); await flush(); retained(before); assert.equal(state().preview, null); assert.equal(state().drafts.placementX, '3.5');
    const stopped = counters.replies; await assert.rejects(session.preview(), /explicitly/); assert.equal(counters.replies, stopped);
  });
  await group(controllerLedger[9], async () => {
    const accepted = authority(), saved = state().authoredText; assert.equal(saved, recoveredSource);
    const data = new TextEncoder().encode(saved), staged = await api.readModelingFileText({ size: data.byteLength, arrayBuffer: async () => data.buffer });
    const reopened = controller(); await reopened.open(staged); const s = reopened.getSnapshot();
    assert.equal(s.error, null); assert.equal(s.authoredText, saved); assert.equal(s.accepted.parameters.placementX, 2.5);
    assert.ok(Object.is(s.accepted.parameters.placementZ, -0)); assert.equal(s.accepted.features.length, 6); assert.equal(s.accepted.revision, 0);
    assert.deepEqual(s.history, { index: 0, count: 1, canUndo: false, canRedo: false }); assert.deepEqual(s.drafts, {});
    assert.equal(commands.at(-1).text, saved); assert.deepEqual(parse(saved).nodes, movedData.nodes);
    assert.deepEqual(s.display.packet.components[0], component); assert.equal(s.display.scene.geometries.length, component.mesh.faces.length);
    assertEnvelope(capabilities(s.authoredText, s.accepted).placementAuthored.envelope, { min: [-21.5, 1.25, 0], max: [2.5, 33.25, 8] });
    const before = work(), open = commands.at(-1);
    const reply = evaluate(workers.at(-1).engine, { id: ++directId, taskToken: 'direct_' + directId, kind: 'prepare-source',
      workerToken: 'budget_worker', acceptedTaskToken: open.taskToken, expectedRevision: 0, candidateToken: 'budget_candidate',
      baseText: saved, operation: 'history', text: ' '.repeat(65537) }, 'direct');
    assert.equal(reply.ok, false); assert.match(reply.message, /64 KiB/); assert.deepEqual(work(), before, 'Source budget failure precedes provider reconstruction');
    assert.equal(budget(Array(20).fill(65536), 65536, [65536, 65536, 65536]), 24 * 65536);
    const retainedSources = [initial, rotatedSource, movedSource, editedSource, recoveredSource];
    assert.equal(state().history.count, retainedSources.length);
    assert.equal(budget(retainedSources.map(bytes), bytes(saved), [bytes(saved), bytes(saved), bytes(saved)]),
      retainedSources.map(bytes).reduce((sum, count) => sum + count, 0) + 4 * bytes(saved));
    assert.deepEqual(authority(), accepted); assert.equal(state().drafts.placementX, '3.5'); session.discard();
  });
  assert.equal(groups.length, 22); assert.equal(counters.controllers, 2); assert.equal(workers.length, 3);
  assert.equal(counters.replies, frozen.plannedReplyTotal); assert.ok(counters.replies <= frozen.controlledReplyLimit);
  assert.equal(held.length, 0); assert.equal(timers.size, 0); assert.equal(mode, null);
  assert.equal(hash(JSON.stringify(baseline)), baselineObjectHash); assert.equal(hash(readFileSync(baselinePath)), frozen.baselineSHA256);
  verifyFrozenSources();
  const result = { result: 'PASS', frozen, groups, counters, workerLifetimes: workers.length, replyLog, providerLog, scriptSHA256, sourceHashes, frozenSourceHashes,
    baselineSHA256: frozen.baselineSHA256, baselineBytes: baselineBytes.length, newNativeCalls: 0, transformedNativePacketAvailable: false,
    runtime20EntryEvictionExecuted: false, runtime: { node: process.version, platform: process.platform, architecture: process.arch },
    limitations: [
      'Actual current engine, serializer, controller and CPU scene receiver execute; provider, Worker and display ownership are explicit doubles.',
      'Every delivered mesh, UV, use, report and lineage field remains the unchanged historical UNTRANSFORMED two-bevel6064 packet.',
      'Rotation/placement summaries and provider authoring context are mocked. Derived envelopes come from accepted source, not transformed-native measurement.',
      'The raw1997 transformed packet is unavailable; its exact provider request was posted once. No transformed-native or actual browser/GPU pixel qualification follows.',
      'Exact decimal0.1 is forwarded unchanged and explicitly refused by a native-provider double; native exact representability is not generalized.',
      'No native evaluation, package build, browser, physical file chooser, STL, collision, assembly or manufacturing qualification.',
      'Source/history arithmetic is synthetic; no runtime20-entry eviction or native RSS claim.',
    ] };
  writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  const logHashes = Object.fromEntries(['frozen-ledger.json', 'frozen-source-hashes.json', 'groups.json', 'replies.json', 'result.json', 'runtime.metafile.json']
    .map(name => [name, hash(readFileSync(resolve(output, name)))]));
  writeFileSync(resolve(output, 'log-hashes.json'), JSON.stringify(logHashes, null, 2) + '\n');
  console.log(JSON.stringify({ result: result.result, groups: groups.length, counters, output, scriptSHA256, logHashes }));
} finally {
  sessions.forEach(s => s.dispose()); globalThis.Worker = previous.Worker;
  globalThis.setTimeout = previous.setTimeout; globalThis.clearTimeout = previous.clearTimeout;
  delete globalThis.__rotatedPlacementCad;
}
