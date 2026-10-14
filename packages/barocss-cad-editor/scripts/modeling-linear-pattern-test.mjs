// #2000: frozen authoring/transaction/CPU-scene replay, NOT native pattern or browser evidence.
// Real current structure helper, engine, serializer, controller and CPU receiver execute.
// The native provider, Worker transport and display ownership are explicit controlled doubles.
// Every delivery retains the complete UNTRANSFORMED two-bevel6064 mesh.
// Pattern output envelopes are explicitly synthetic/coincident; no native ID or geometry is rewritten.
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
const signed = value => JSON.stringify(value, (_key, item) => Object.is(item, -0) ? '__NEGATIVE_ZERO__' : item);
const source = name => resolve(root, 'packages/barocss-cad-editor/src', name + '.ts');
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const pureLedger = Object.freeze([
  'P01 exact five-node append and three output references',
  'P02 signed-zero and nested-expression prefix preservation',
  'P03 spacing boundaries and exact unrounded decimal forwarding',
  'P04 exact owned source summary and selected identity',
  'P05 reserved names and sixteen-parameter budget',
  'P06 hostile descriptors prototypes symbols and extra fields',
  'P07 terminal pattern and unsupported transformed or other-family ancestry',
  'P08 exact output-side and schema restrictions',
  'P09 unary dependency and complete summary inventory',
  'P10 same-structure positive and negative controls',
  'P11 independent spacing front-bevel and back-bevel drivers',
  'P12 source history arithmetic and retained-fixture provenance',
]);
const controllerLedger = Object.freeze([
  'C01 actual engine serializer controller and CPU receiver admission',
  'C02 structural preview cancel retains accepted authority',
  'C03 explicit recovery current-ready promotion and exact source binding',
  'C04 independent spacing preview apply and normalized no-op',
  'C05 source-bevel driver edits retain pattern structure and spacing',
  'C06 parameter versus structural Undo Redo routes',
  'C07 authoritative provider and display refusals retain accepted state',
  'C08 stale generation cancelled held reply and unchanged accepted source',
  'C09 lost acceptance acknowledgement and explicit recovery',
  'C10 accepted-source roundtrip output selection and source budget',
]);
const sceneLedger = Object.freeze([
  'S01 synthetic coincident three-output envelope uses existing three-draw fallback',
  'S02 complete retained positions normals UV indices and native inventories',
  'S03 fifty-four role-scoped native segments and no fan diagonals',
  'S04 actual CPU rays preserve original native face and triangle authority',
  'S05 Top Isometric resize and reprepare preserve matched identities',
  'S06 mixed-output selection and whole-packet refusal preserve native authority',
]);
const frozen = Object.freeze({ issue: 2000, base: '8a1716b35e226c09a2a338a3402d846b88d3b76b', pureLedger, controllerLedger, sceneLedger,
  controllerReplyCaps: Object.fromEntries(controllerLedger.map((name, index) => [name, [1, 1, 4, 2, 2, 8, 4, 1, 6, 3][index]])),
  controlledReplyLimit: 32, plannedReplyTotal: 32, controllerLifetimeLimit: 2, workerLifetimeLimit: 5,
  plannedProviderCounts: { loads: 9, parameterEdits: 11, retainedUntransformedReplays: 51 },
  countPolicy: 'Every engine return, including direct, failed, discard, recovery and held replies, counts once before delivery. No duplicate delivery. Total and per-group caps are checked before evaluation.',
  geometryPolicy: 'Provider/display doubles retain unchanged historical untransformed two-bevel6064 native arrays and IDs. Only role/name envelopes are cloned for coincident outputs. No translated-native geometry or separation is proved.',
  rawPatternPacket: 'Unavailable. Do not fetch, reconstruct or rerun native pattern captures in this ledger.',
  baselinePath: 'packages/barocss-cad-editor/scripts/fixtures/modeling-chamfer-chain/baseline-transport.json', baselineBytes: 41471,
  baselineSHA256: '74e9a472c54aaa5d228a23d79b083c9a7c4c539bf5de6a5f274597e5fbfba4af',
  circlePath: 'packages/barocss-cad-editor/scripts/fixtures/modeling-circle/baseline-native.json',
  circleSHA256: '7338e8c36033d6a324760c9fc101d9509b73e89f223246395250c83cee6cc4e8',
  sourceBudgetPolicy: 'Synthetic64KiB/8MiB arithmetic and actual retained-slot accounting only; no runtime20-entry eviction or native RSS claim.',
});
assert.ok(process.env.FROZEN_SOURCE_HASHES, 'Parent must review and freeze final source hashes before executing this finite ledger.');
const frozenSourceHashes = parse(process.env.FROZEN_SOURCE_HASHES);
assert.equal(Object.getPrototypeOf(frozenSourceHashes), Object.prototype);
for (const path of ['packages/barocss-cad-editor/scripts/modeling-linear-pattern-test.mjs',
  ...['modeling-structure', 'modeling-controller', 'modeling-engine', 'modeling-scene', 'prism-feature-scene'].map(name => relative(root, source(name)))])
  assert.match(frozenSourceHashes[path] ?? '', /^[a-f0-9]{64}$/, 'Final parent freeze must include ' + path);
function verifyFrozenSources() {
  for (const [path, expected] of Object.entries(frozenSourceHashes)) {
    assert.equal(relative(root, resolve(root, path)), path, 'Use normalized repository-relative paths');
    assert.ok(!path.startsWith('../')); assert.match(expected, /^[a-f0-9]{64}$/);
    assert.equal(hash(readFileSync(resolve(root, path))), expected, 'Frozen source changed: ' + path);
  }
}
verifyFrozenSources();
if (process.env.FROZEN_LEDGER) assert.deepEqual(frozen, parse(readFileSync(process.env.FROZEN_LEDGER)));
const evidence = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-2000-linear-pattern');
mkdirSync(evidence, { recursive: true });
const output = resolve(evidence, 'attempt-' + new Date().toISOString().replaceAll(':', '-') + '-' + process.pid);
mkdirSync(output); writeFileSync(resolve(output, 'script.mjs'), readFileSync(import.meta.filename));
writeFileSync(resolve(output, 'frozen-ledger.json'), JSON.stringify(frozen, null, 2) + '\n');
writeFileSync(resolve(output, 'frozen-source-hashes.json'), JSON.stringify(frozenSourceHashes, null, 2) + '\n');
const scriptSHA256 = hash(readFileSync(import.meta.filename)), sourceHashes = {}, groups = [], replyLog = [], providerLog = [], sceneObservations = [];
const counters = { replies: 0, controllers: 0, loads: 0, parameterEdits: 0, retainedUntransformedReplays: 0 };
let currentGroup = 'setup', groupReplyStart = 0;
process.on('uncaughtExceptionMonitor', cause => {
  const error = { group: currentGroup, message: String(cause), stack: cause.stack, counters, replyLog, providerLog, scriptSHA256, sourceHashes, frozenSourceHashes };
  writeFileSync(resolve(output, 'error.json'), JSON.stringify(error, null, 2) + '\n');
  if (!existsSync(resolve(evidence, 'first-error.json'))) writeFileSync(resolve(evidence, 'first-error.json'), JSON.stringify({ ...error, attempt: output }, null, 2) + '\n');
});
async function group(name, run) {
  currentGroup = name; groupReplyStart = counters.replies;
  await run();
  const replies = counters.replies - groupReplyStart;
  assert.equal(replies, frozen.controllerReplyCaps[name] ?? 0, 'Exact frozen group response count');
  groups.push({ name, result: 'PASS', replies });
  console.log(JSON.stringify(groups.at(-1))); writeFileSync(resolve(output, 'groups.json'), JSON.stringify(groups, null, 2) + '\n');
}
function recordInputs(metafile) {
  for (const input of Object.keys(metafile.inputs)) if (input !== '<stdin>' && !input.startsWith('double:')) {
    const path = relative(root, resolve(root, input));
    assert.ok(!/\.wasm$|native-runtime|opencascade|barocss-cad\/src\//i.test(path), 'No provider/native dependency may load');
    const actual = hash(readFileSync(resolve(root, path))); sourceHashes[path] = actual;
    assert.equal(actual, frozenSourceHashes[path], 'Every actual source input requires final parent freeze: ' + path);
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
// Immutable pre-change helper constructs the already-owned rail. No native load.
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
// These IDs are synthetic pure-summary tokens, never inserted into a native packet.
function summary(d, revision = 1) {
  return { source: 'model', documentId: 'cad_model', revision, parameters: clone(d.parameters), features: featureRows(d),
    outputs: Object.entries(d.outputs).map(([name, ref]) => ({ name, solidId: 'controlled_node' + ref.node + '_' + ref.side, volumeMM3: null })) };
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
const patternInput = { kind: 'linear-pattern', target: capabilities(initial, initialSummary).linearPattern, spacing: 40 };
const expectedOutputs = { part: { node: 3, side: 'solid' }, railCopy1: { node: 4, side: 'instance1' }, railCopy2: { node: 4, side: 'instance2' } };
let patterned, patternData;
function refused(d) {
  const c = capabilities(text(d), summary(d));
  assert.equal(c.linearPattern, null); assert.equal(c.patternAuthored, false); assert.ok(c.patternReason); return c;
}
function authored(d) {
  const c = capabilities(text(d), summary(d)); assert.equal(c.patternAuthored, true); assert.equal(c.linearPattern, null); return c;
}
await group(pureLedger[0], () => {
  const before = clone(initialSummary), c = capabilities(initial, initialSummary);
  assert.deepEqual(c.linearPattern, { name: 'part', solidId: 'controlled_node3_solid', node: 3 }); assert.equal(c.patternAuthored, false);
  patterned = build(initial, initialSummary, patternInput); patternData = parse(patterned.text);
  assert.equal(patternData.nodes.length, 5); assert.deepEqual(patternData.nodes.slice(0, 4), rail.nodes);
  assert.deepEqual(patternData.nodes[4], { kind: 'linear-pattern', parent: { node: 3, side: 'solid' }, axis: 'x', spacing: { parameter: 'patternSpacing' }, count: 3 });
  assert.deepEqual(patternData.outputs, expectedOutputs); assert.deepEqual(patternData.parameters, { ...rail.parameters, patternSpacing: 40 });
  assert.deepEqual({ ...patterned, text: undefined }, { text: undefined, kind: 'linear-pattern', selectedOutput: 'part', consumed: [] });
  assert.deepEqual(initialSummary, before); assert.equal(build(initial, initialSummary, patternInput).text, patterned.text);
  const done = authored(patternData);
  for (const field of ['linearPattern', 'rotatePart', 'movePart', 'chamfer', 'addArm', 'addHole', 'cutPocket', 'union', 'cutSlot']) assert.equal(done[field], null);
});
await group(pureLedger[1], () => {
  assert.deepEqual(patternData.nodes.slice(0, 4), rail.nodes); assert.ok(Object.is(patternData.nodes[0].min[0], -0));
  assert.ok(Object.is(patternData.nodes[1].height.right, -0)); assert.ok(Object.is(patternData.nodes[3].edge.at.y.right.value, -0));
  assert.ok(Object.is(patternData.parameters.unusedSignedZero, -0)); assert.equal(text(patternData), patterned.text);
  const nested = altered(rail, d => {
    d.parameters.width = 65; d.parameters.height = 48.5; d.parameters.thickness = 17;
    d.nodes[0].max[0] = { op: 'scale', value: { parameter: 'width' }, factor: 0.5 };
    d.nodes[0].max[1] = { op: 'add', left: { op: 'scale', value: { parameter: 'height' }, factor: 0.5 }, right: -0 };
    d.nodes[1].height = { op: 'scale', value: { parameter: 'thickness' }, factor: 0.5 };
    d.nodes[3].edge.at.y = clone(d.nodes[0].max[1]);
  });
  const result = build(text(nested), summary(nested), { ...patternInput, target: capabilities(text(nested), summary(nested)).linearPattern });
  const d = parse(result.text); assert.deepEqual(d.nodes.slice(0, 4), nested.nodes); assert.deepEqual(d.parameters, { ...nested.parameters, patternSpacing: 40 }); authored(d);
});
await group(pureLedger[2], () => {
  for (const spacing of [Number.MIN_VALUE, 0.1, 1.23456789, 40, 4999.999999, 5000]) {
    const d = parse(build(initial, initialSummary, { ...patternInput, spacing }).text);
    assert.ok(Object.is(d.parameters.patternSpacing, spacing), 'Never clamp, round or guarantee native representability'); authored(d);
  }
  for (const spacing of [0, -0, -1, 5000.000000001, 10000, NaN, Infinity, -Infinity, '40', null, undefined, [], {}])
    assert.throws(() => build(initial, initialSummary, { ...patternInput, spacing }));
  // Form admission does not invent a width/non-overlap/final-coordinate condition.
  const wide = altered(rail, d => { d.parameters.width = 10000; });
  const d = parse(build(text(wide), summary(wide), { ...patternInput, target: capabilities(text(wide), summary(wide)).linearPattern, spacing: 5000 }).text);
  assert.equal(d.parameters.width, 10000); assert.equal(d.parameters.patternSpacing, 5000);
});
await group(pureLedger[3], () => {
  for (const target of [{ ...patternInput.target, name: 'railCopy1' }, { ...patternInput.target, solidId: 'stale_same_name' },
    { ...patternInput.target, node: 2 }, { ...patternInput.target, node: -0 }, { ...patternInput.target, node: 4 }])
    assert.throws(() => build(initial, initialSummary, { ...patternInput, target }));
  for (const change of [s => { s.outputs[0].name = 'wrong'; }, s => { s.outputs[0].solidId = 'bad/id'; },
    s => { s.outputs.push(clone(s.outputs[0])); }, s => { s.parameters.width = 33; }, s => { s.parameters.unusedSignedZero = 0; },
    s => { s.source = 'legacy'; }, s => { s.suppression = { finish: false }; }]) {
    const wrong = altered(initialSummary, change); assert.equal(capabilities(initial, wrong).linearPattern, null); assert.throws(() => build(initial, wrong, patternInput));
  }
  for (const raw of [null, '', '{', 'null', '[]']) assert.equal(capabilities(raw, initialSummary).linearPattern, null);
  const changed = altered(rail, d => { d.parameters.width = 33; }); assert.throws(() => build(text(changed), initialSummary, patternInput));
  assert.deepEqual(parse(build(text(changed), summary(changed), patternInput).text).nodes.slice(0, 4), changed.nodes);
  const duplicateIds = summary(patternData); duplicateIds.outputs[2].solidId = duplicateIds.outputs[1].solidId;
  assert.equal(capabilities(patterned.text, duplicateIds).patternAuthored, false, 'Coincident replay native IDs cannot masquerade as distinct real pattern outputs');
});
await group(pureLedger[4], () => {
  for (const key of ['patternSpacing', 'railCopy1', 'railCopy2']) {
    refused(altered(rail, d => { d.parameters[key] = 40; }));
    refused(altered(rail, d => { d.outputs[key] = clone(d.outputs.part); }));
  }
  const full = altered(rail, d => { for (let i = Object.keys(d.parameters).length; i < 15; i++) d.parameters['unused' + i] = 0; });
  const fullText = text(full), result = build(fullText, summary(full), { ...patternInput, target: capabilities(fullText, summary(full)).linearPattern });
  assert.equal(Object.keys(parse(result.text).parameters).length, 16);
  refused(altered(full, d => { d.parameters.last = 0; }));
  for (const key of ['width', 'height', 'thickness']) for (const value of [0, -0, -1, 10001]) refused(altered(rail, d => { d.parameters[key] = value; }));
  for (const [key, value] of [['bevelDistance', 0], ['bevelDistance', 8], ['backBevelDistance', 0], ['backBevelDistance', 8]]) refused(altered(rail, d => { d.parameters[key] = value; }));
  refused(altered(rail, d => { d.parameters.height = 3; }));
});
await group(pureLedger[5], () => {
  let getters = 0;
  const accessor = { ...patternInput }; Object.defineProperty(accessor, 'spacing', { enumerable: true, get() { getters++; return 40; } });
  assert.throws(() => build(initial, initialSummary, accessor)); assert.equal(getters, 0);
  assert.throws(() => build(initial, initialSummary, Object.assign(Object.create({ inherited: true }), patternInput)));
  assert.throws(() => build(initial, initialSummary, { ...patternInput, [Symbol('hidden')]: true }));
  const hidden = { ...patternInput }; Object.defineProperty(hidden, 'secret', { value: true }); assert.throws(() => build(initial, initialSummary, hidden));
  for (const extra of [{ axis: 'x' }, { count: 3 }, { copies: 2 }, { offset: [] }, { spacingParameter: 'width' }, { extra: true }])
    assert.throws(() => build(initial, initialSummary, { ...patternInput, ...extra }));
  const target = { ...patternInput.target }; Object.defineProperty(target, 'node', { enumerable: true, get() { getters++; return 3; } });
  assert.throws(() => build(initial, initialSummary, { ...patternInput, target }));
  const guarded = clone(initialSummary); Object.defineProperty(guarded, 'parameters', { enumerable: true, get() { getters++; return rail.parameters; } });
  assert.equal(capabilities(initial, guarded).linearPattern, null); assert.equal(getters, 0);
  for (const mutate of [d => { d.nodes[4].extra = true; }, d => { d.nodes[4].parent.extra = true; }, d => { d.nodes[4].spacing.extra = true; },
    d => { d.outputs.railCopy1.extra = true; }, d => { d.schema = 2; }, d => { d.units = 'cm'; }]) refused(altered(patternData, mutate));
});
await group(pureLedger[6], () => {
  for (const d of [blank, front, parse(api.createCircularPartSource({ diameter: '8', thickness: '6' }))]) refused(d);
  const rotation = oldApi.buildModelingStructure(initial, initialSummary, { kind: 'rotate-part', target: oldApi.getModelingStructureCapabilities(initial, initialSummary).rotatePart, axis: 'z', angleDegrees: 90 });
  const rotated = parse(rotation.text); refused(rotated);
  const move = oldApi.buildModelingStructure(rotation.text, summary(rotated), { kind: 'move-part', target: oldApi.getModelingStructureCapabilities(rotation.text, summary(rotated)).movePart, x: 1, y: 2, z: 3 });
  refused(parse(move.text));
  for (const change of [d => { d.nodes[0].min[0] = 1; }, d => { d.nodes[1].from = 0; }, d => { d.nodes[2].edge.at.y = -0; },
    d => { d.nodes[3].edge.at.y = 24; }, d => { d.nodes[3].parent.node = 1; }, d => { d.nodes[3].edge.parallelTo = 'y'; },
    d => { d.nodes[3].edge.at.z = 8; }, d => { d.nodes[2].name = 'front'; d.nodes[2].suppressed = false; },
    d => { d.nodes[3].suppressed = true; }, d => { d.configuration = { front: true }; }, d => { d.nodes[0].profile = 'circle'; }]) refused(altered(rail, change));
  for (const kind of ['mirror', 'scale', 'linear-pattern', 'circular-pattern', 'hole', 'split', 'cut', 'union', 'difference', 'translate'])
    refused(altered(rail, d => { d.nodes[3].kind = kind; }));
  for (const command of [{ ...patternInput, target: summary(patternData).outputs[0] },
    { kind: 'rotate-part', target: patternInput.target, axis: 'z', angleDegrees: 90 }, { kind: 'move-part', target: patternInput.target, x: 1, y: 2, z: 3 },
    { kind: 'chamfer', target: patternInput.target, distance: 0.5 }]) assert.throws(() => build(patterned.text, summary(patternData), command));
  refused(altered(patternData, d => { d.nodes.push(clone(d.nodes[4])); d.outputs.railCopy2.node = 5; }));
  // #2008 adds a separate mirror capability; retain parity for every older field.
  const priorFields = ({ linearPattern: _target, patternReason: _reason, patternAuthored: _authored,
    mirrorPart: _mirror, mirrorReason: _mirrorReason, mirrorAuthored: _mirrorAuthored, ...prior }) => prior;
  for (const value of [blankText, first.text, initial, rotation.text, move.text]) {
    const current = capabilities(value, summary(parse(value)));
    assert.deepEqual(priorFields(current), oldApi.getModelingStructureCapabilities(value, summary(parse(value))));
    assert.equal(current.mirrorAuthored, false);
    if (value === initial) assert.deepEqual(current.mirrorPart, patternInput.target);
    else assert.equal(current.mirrorPart, null);
  }
});
await group(pureLedger[7], () => {
  for (const [name, ref] of Object.entries(expectedOutputs)) {
    for (const side of ['solid', 'negative', 'positive', 'instance0', 'instance1', 'instance2', 'instance3', 'Instance1', '', null]) {
      if (side === ref.side) continue;
      const changed = altered(patternData, d => { d.outputs[name].side = side; }); refused(changed);
      assert.equal(same(patterned.text, text(changed)), false);
    }
    for (const node of [-0, 0, 2, 3, 4, 5]) if (!Object.is(node, ref.node)) refused(altered(patternData, d => { d.outputs[name].node = node; }));
  }
  for (const change of [d => { delete d.outputs.railCopy2; }, d => { d.outputs.alias = clone(d.outputs.railCopy1); },
    d => { d.outputs.railCopy1 = clone(d.outputs.railCopy2); }, d => { d.nodes[4].parent.side = 'instance1'; },
    d => { d.nodes[4].parent.node = 2; }, d => { d.nodes[4].axis = 'y'; }, d => { d.nodes[4].count = 2; },
    d => { d.nodes[4].count = 4; }, d => { d.nodes[4].spacing = 40; }, d => { d.nodes[4].spacing = { parameter: 'width' }; }]) refused(altered(patternData, change));
  for (const side of ['instance1', 'instance2']) refused(altered(rail, d => { d.outputs.part.side = side; }));
});
await group(pureLedger[8], () => {
  const expected = [[], [0], [1], [2], [3]], s = summary(patternData);
  assert.deepEqual(s.features.map(f => f.dependencies), expected); authored(patternData);
  for (const change of [s => { s.features[4].dependencies = [2]; }, s => { s.features[4].dependencies = [3, 3]; },
    s => { s.features[4].dependencies = []; }, s => { s.features[4].index = 3; }, s => { s.features[4].kind = 'translate'; },
    s => { s.features.pop(); }, s => { s.outputs.pop(); }, s => { s.outputs[2].name = 'alias'; }]) {
    const wrong = altered(s, change); assert.equal(capabilities(patterned.text, wrong).patternAuthored, false);
  }
  const badBase = altered(initialSummary, s => { s.features[3].dependencies = [1]; });
  assert.equal(capabilities(initial, badBase).linearPattern, null); assert.throws(() => build(initial, badBase, patternInput));
});
await group(pureLedger[9], () => {
  assert.equal(same(initial, patterned.text), false); assert.equal(same(patterned.text, patterned.text), true);
  for (const [key, value] of [['patternSpacing', 48], ['bevelDistance', 1.25], ['backBevelDistance', 2.5], ['width', 33], ['unusedSignedZero', 0]])
    assert.equal(same(patterned.text, text(altered(patternData, d => { d.parameters[key] = value; }))), true);
  // Fast-path identity is not native admission; valid bounded zero data still compare structurally.
  const zero = altered(patternData, d => { for (const key of Object.keys(d.parameters)) d.parameters[key] = 0; });
  assert.equal(same(patterned.text, text(zero)), true); assert.equal(capabilities(text(zero), summary(zero)).patternAuthored, false);
  for (const change of [d => { d.nodes[4].axis = 'z'; }, d => { d.nodes[4].count = 4; }, d => { d.nodes[4].parent.node = 2; },
    d => { d.nodes[4].spacing = { parameter: 'width' }; }, d => { d.nodes[0].min[0] = 0; },
    d => { d.parameters.extra = 1; }, d => { d.outputs.railCopy1.side = 'instance2'; }, d => { d.nodes[4].kind = 'unknown'; }])
    assert.equal(same(patterned.text, text(altered(patternData, change))), false);
});
await group(pureLedger[10], () => {
  for (const [key, value] of [['patternSpacing', 48], ['bevelDistance', 1.25], ['backBevelDistance', 2.5]]) {
    const d = altered(patternData, d => { d.parameters[key] = value; }); authored(d);
    assert.deepEqual(d.nodes, patternData.nodes); assert.deepEqual(d.outputs, expectedOutputs);
    for (const other of Object.keys(patternData.parameters)) assert.ok(Object.is(d.parameters[other], other === key ? value : patternData.parameters[other]));
    assert.equal(same(patterned.text, text(d)), true);
  }
  for (const change of [d => { d.nodes[0].max[0] = { parameter: 'patternSpacing' }; },
    d => { d.nodes[0].max[1] = { parameter: 'patternSpacing' }; d.nodes[3].edge.at.y = clone(d.nodes[0].max[1]); },
    d => { d.nodes[1].height = { parameter: 'patternSpacing' }; }, d => { d.nodes[2].distance = { parameter: 'patternSpacing' }; },
    d => { d.nodes[3].distance = { parameter: 'bevelDistance' }; }]) refused(altered(patternData, change));
  let deep = 1; for (let i = 0; i < 6; i++) deep = { op: 'add', left: deep, right: 0 };
  for (const value of [deep, { parameter: 'missing' }, { op: 'scale', value: 10000, factor: 2 }, { parameter: 'height', extra: 1 }])
    refused(altered(rail, d => { d.nodes[0].max[1] = value; d.nodes[3].edge.at.y = clone(value); }));
});
const baselinePath = resolve(root, frozen.baselinePath), baselineBytes = readFileSync(baselinePath), baseline = parse(baselineBytes);
const component = baseline.display.components[0], baselineObjectHash = hash(JSON.stringify(baseline));
function roleComponent(role) { const result = clone(component); result.role = result.lineage.name = role; return result; }
function assertRetainedComponent(value) {
  assert.deepEqual(value, roleComponent(value.role), 'Only role/name envelope may vary; every native array, topology ID and report stays original');
}
await group(pureLedger[11], () => {
  assert.equal(bytes('a'.repeat(65536)), 65536); assert.throws(() => bytes('a'.repeat(65537)), /64 KiB/);
  assert.equal(bytes('é'.repeat(32768)), 65536); assert.throws(() => bytes('é'.repeat(32769)), /UTF-8/);
  assert.equal(capabilities(initial + ' '.repeat(65536), initialSummary).linearPattern, null);
  assert.equal(budget([8 * 1024 * 1024 - 3], 1, [1, 1]), 8 * 1024 * 1024); assert.throws(() => budget([8 * 1024 * 1024 - 3], 1, [1, 2]), /8 MiB/);
  for (const value of [-1, -0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1']) assert.throws(() => budget([], value, []));
  assert.throws(() => budget(Array(21).fill(0), 0, [])); assert.throws(() => budget([], 0, Array(65).fill(0)));
  assert.equal(budget(Array(20).fill(65536), 65536, [65536, 65536, 65536]), 24 * 65536);
  assert.equal(budget([bytes(initial), bytes(patterned.text)], bytes(patterned.text), [bytes(initial)]), 2 * bytes(initial) + 2 * bytes(patterned.text));
  assert.equal(baselineBytes.length, frozen.baselineBytes); assert.equal(hash(baselineBytes), frozen.baselineSHA256);
  assert.equal(baseline.ok, true); assert.equal(baseline.summary.outputs[0].volumeMM3.numerator, '6064');
  assert.deepEqual(baseline.summary.parameters, { frontDistance: 1, backDistance: 2, backY: 24 });
  assert.equal(parse(baseline.text).nodes.length, 4); assert.equal(component.report.triangleCount, 20); assert.equal(component.mesh.indices.length, 60);
  assert.notEqual(baseline.text, initial); refused(parse(baseline.text));
  assert.equal(component.lineage.graph.edges.length, 18); assert.equal(component.boundaries.length, 36); assert.equal(component.internalDiagonals.length, 12);
});
const forbidden = () => { throw Error('No native evaluation, provider geometry, GPU, browser or STL execution in this replay.'); };
const nativeFailure = () => Object.assign(Error('Explicit mock provider refuses exact patternSpacing0.1 without rounding'),
  { name: 'CadModelError', code: 'NATIVE', operation: 'build' });
let failEdit = false, failDisplay = false, mode = null;
function snapshot(data) {
  assert.ok([4, 5].includes(data.nodes.length));
  assert.deepEqual(data.outputs, data.nodes.length === 4 ? { part: { node: 3, side: 'solid' } } : expectedOutputs);
  // This body is ONLY a provider double. Its shape and original native IDs have not been transformed or renamed.
  const body = { family: 'convex-planar', native: { report: { solidId: component.report.solidId },
    certificate: { volumeMM3: { numerator: '6064', denominator: '1' } }, graph: clone(component.lineage.graph) } };
  return { parameters: clone(data.parameters), suppression: {}, features: featureRows(data), bodies: Object.fromEntries(Object.keys(data.outputs).map(name => [name, clone(body)])), save: () => text(data),
    withParameters(changes) {
      counters.parameterEdits++; providerLog.push({ group: currentGroup, operation: 'withParameters', base: hash(text(data)), changes: clone(changes) });
      if (failEdit) { failEdit = false; assert.equal(changes.patternSpacing, 0.1); throw nativeFailure(); }
      return snapshot({ ...clone(data), parameters: { ...data.parameters, ...changes } });
    }, withSuppression: forbidden, exportStl: forbidden };
}
globalThis.__linearPatternCad = { cad: { model: forbidden, load(sourceText) {
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
const built = await require('esbuild').build({ absWorkingDir: root, stdin: { contents: ['modeling-controller', 'modeling-engine', 'modeling-scene', 'modeling-circle', 'prism-feature-scene'].map(name => `export * from ${JSON.stringify(source(name))};`).join('\n') + '\nexport * from "@barocss/gpu";', resolveDir: root },
  bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, alias: { '@barocss/gpu': gpu },
  plugins: [{ name: 'explicit-provider-no-native', setup(build) {
    build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'double' }));
    build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'double' }));
    build.onLoad({ filter: /.*/, namespace: 'double' }, args => ({ contents: args.path === 'provider'
      ? 'export const {cad,tessellateSurface,tessellateConvexPlanarSolid,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell}=globalThis.__linearPatternCad;'
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
const runtime = await import(pathToFileURL(resolve(output, 'runtime.mjs')));
const { createModelingEngine, createCadEditorModelingController } = runtime;
const previous = { Worker: globalThis.Worker, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
const workers = [], sessions = [], commands = [], held = [], timers = new Set();
function evaluate(engine, request, route = 'worker') {
  assert.ok(counters.replies < frozen.controlledReplyLimit, 'Stop before frozen32 total response ceiling');
  assert.ok(counters.replies - groupReplyStart < frozen.controllerReplyCaps[currentGroup], 'Stop before the frozen current-group response cap');
  const reply = engine(request); counters.replies++;
  replyLog.push({ number: counters.replies, group: currentGroup, route, request: request.kind, ok: reply.ok, kind: reply.kind,
    ...(request.text ? { requestSourceSHA256: hash(request.text) } : {}), ...(reply.ok ? {} : { message: reply.message }) });
  writeFileSync(resolve(output, 'replies.json'), JSON.stringify(replyLog, null, 2) + '\n');
  if (reply.ok && reply.display) {
    assert.equal(reply.display.profile, 'model-outputs');
    assert.deepEqual(reply.display.components.map(value => value.role), reply.summary.outputs.map(value => value.name));
    reply.display.components.forEach(assertRetainedComponent);
  }
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
let patternCommand, initialGeneration, patternSource, spacingSource, bevelSource, recoveredSource, prepareRequest, directId = 10000;
const exactOutputRefs = () => assert.deepEqual(parse(state().authoredText).outputs, expectedOutputs);
function assertReplayOutputs(s) {
  assert.deepEqual(s.accepted.outputs.map(value => value.name), ['part', 'railCopy1', 'railCopy2']);
  assert.deepEqual(parse(s.authoredText).outputs, expectedOutputs);
  assert.equal(s.display.scene.geometries.length, 3); s.display.packet.components.forEach(assertRetainedComponent);
  assert.deepEqual(s.accepted.outputs.map(value => value.solidId), Array(3).fill(component.report.solidId),
    'Explicit coincident provider double preserves original IDs and cannot prove distinct native copies');
  assert.equal(capabilities(s.authoredText, s.accepted).patternAuthored, false,
    'Distinct-native-ID authoring projection must refuse this synthetic replay summary');
}
try {
  await group(controllerLedger[0], async () => {
    await session.open(initial); assert.equal(state().error, null); assert.equal(state().history.count, 1);
    assert.equal(state().accepted.features.length, 4); assert.equal(state().accepted.outputs[0].volumeMM3.numerator, '6064');
    assert.deepEqual(state().display.packet.components[0], component); assert.equal(state().display.scene.geometries.length, 8);
    assert.equal(commands.at(-1).text, initial); assert.equal(providerLog.at(-1).text, initial);
    session.select(3, state().generation); initialGeneration = state().generation;
    patternCommand = { ...patternInput, target: capabilities(state().authoredText, state().accepted).linearPattern };
    assert.equal(patternCommand.target.node, 3); assert.equal(patternCommand.target.solidId, state().accepted.outputs[0].solidId);
  });
  await group(controllerLedger[1], async () => {
    const before = authority(), handle = acceptedHandle, count = counters.replies;
    await assert.rejects(session.applyStructure(patternCommand, state().generation), /Preview the current/); assert.equal(counters.replies, count);
    await session.previewStructure(patternCommand, state().generation); await flush(); assert.equal(state().preview.status, 'ready', state().error);
    assert.deepEqual(authority(), before); assert.equal(acceptedHandle, handle); assert.notEqual(visibleHandle, handle);
    assert.deepEqual(state().preview.outputs.map(value => value.name), ['part', 'railCopy1', 'railCopy2']);
    assert.equal(state().authoredText, initial); assert.equal(state().accepted.outputs.length, 1);
    assert.equal(commands.at(-1).text, patterned.text); assert.equal(commands.at(-1).baseText, initial); assert.deepEqual(commands.at(-1).command, patternCommand);
    session.cancel(); await flush(); retained(before, handle); assert.equal(state().preview, null); assert.equal(state().workerReady, false);
    assert.equal(workers.at(-1).terminated, true);
  });
  await group(controllerLedger[2], async () => {
    const before = authority(), count = counters.replies;
    await assert.rejects(session.previewStructure(patternCommand, state().generation), /explicitly/); assert.equal(counters.replies, count);
    await session.previewStructure(patternCommand, state().generation, true); assert.equal(state().preview.status, 'ready', state().error);
    assert.deepEqual(authority(), before); assert.deepEqual(commands.slice(-2).map(value => value.kind), ['open', 'prepare-source']);
    assert.equal(commands.at(-2).text, initial); prepareRequest = clone(commands.at(-1));
    assert.equal(prepareRequest.baseText, initial); assert.equal(prepareRequest.text, patterned.text); assert.deepEqual(prepareRequest.command, patternCommand);
    assert.equal(providerLog.at(-1).text, patterned.text, 'Exact candidate source reaches explicit provider double');
    const beforeStale = work();
    const reply = evaluate(workers.at(-1).engine, { ...prepareRequest, baseText: initial + ' ', id: ++directId, taskToken: 'direct_' + directId }, 'direct');
    assert.equal(reply.ok, false); assert.deepEqual(work(), beforeStale, 'Stale exact source must not reconstruct or clear current candidate');
    await assert.rejects(session.applyStructure({ ...patternCommand, spacing: 48 }, state().generation), /Preview the current/);
    await assert.rejects(session.apply(), /structural command/);
    await session.applyStructure(patternCommand, state().generation); assert.equal(state().error, null); assert.deepEqual(work(), beforeStale, 'Promotion does not reconstruct');
    patternSource = state().authoredText; assert.equal(patternSource, patterned.text); assert.equal(state().history.count, 2); assert.equal(state().selection, null);
    assert.deepEqual(state().accepted.features.map(f => f.dependencies), [[], [0], [1], [2], [3]]); assertReplayOutputs(state());
    assert.equal(commands.at(-1).kind, 'accept-source'); assert.equal(commands.at(-1).text, patternSource);
    await assert.rejects(session.applyStructure(patternCommand, initialGeneration), /stale/);
  });
  await group(controllerLedger[3], async () => {
    session.select(4, state().generation); session.stage('patternSpacing', '48'); const before = authority(), loads = counters.loads;
    await session.preview(); assert.equal(state().preview.status, 'ready', state().error); assert.deepEqual(authority(), before);
    assert.deepEqual(commands.at(-1).parameters, { patternSpacing: 48 }); assert.deepEqual(providerLog.at(-1).changes, { patternSpacing: 48 });
    assert.equal(state().accepted.parameters.patternSpacing, 40);
    await session.apply(); assert.equal(state().error, null); spacingSource = state().authoredText;
    assert.equal(state().accepted.parameters.patternSpacing, 48); assert.equal(state().accepted.parameters.bevelDistance, 1); assert.equal(state().accepted.parameters.backBevelDistance, 2);
    assert.equal(counters.loads, loads); assert.deepEqual(parse(spacingSource).nodes, patternData.nodes); assert.equal(state().selection, 4); assert.equal(state().history.count, 3); assertReplayOutputs(state());
    const stable = authority(), count = counters.replies, providerWork = work();
    session.stage('patternSpacing', '48.000'); await session.preview(); assert.equal(state().preview.status, 'unchanged');
    await session.apply(); assert.deepEqual(state().drafts, {}); retained(stable); assert.equal(counters.replies, count); assert.deepEqual(work(), providerWork);
  });
  await group(controllerLedger[4], async () => {
    // Both shared rail drivers travel independently in one bounded transaction;
    // P11 separately checks each single-driver edit against every other parameter.
    session.stage('bevelDistance', '1.25'); session.stage('backBevelDistance', '2.5'); const before = authority(), loads = counters.loads;
    await session.preview(); assert.equal(state().preview.status, 'ready', state().error); assert.deepEqual(authority(), before);
    assert.deepEqual(commands.at(-1).parameters, { bevelDistance: 1.25, backBevelDistance: 2.5 });
    assert.deepEqual(providerLog.at(-1).changes, { bevelDistance: 1.25, backBevelDistance: 2.5 });
    await session.apply(); assert.equal(state().error, null); bevelSource = state().authoredText;
    assert.deepEqual(parse(bevelSource).nodes, patternData.nodes); assert.equal(state().accepted.parameters.patternSpacing, 48);
    assert.equal(state().accepted.parameters.bevelDistance, 1.25); assert.equal(state().accepted.parameters.backBevelDistance, 2.5);
    assert.equal(counters.loads, loads); assert.equal(state().history.count, 4); assertReplayOutputs(state());
  });
  await group(controllerLedger[5], async () => {
    const count = state().history.count, start = commands.length, loads = counters.loads, edits = counters.parameterEdits, revision = state().accepted.revision;
    await session.undo(); assert.equal(state().authoredText, spacingSource); assert.equal(state().history.index, 2); exactOutputRefs();
    await session.undo(); assert.equal(state().authoredText, patternSource); assert.equal(state().history.index, 1); exactOutputRefs();
    await session.undo(); assert.equal(state().authoredText, initial); assert.equal(state().history.index, 0);
    assert.equal(state().accepted.features.length, 4); assert.equal(state().accepted.outputs.length, 1);
    assert.equal(capabilities(state().authoredText, state().accepted).linearPattern.node, 3);
    await session.redo(); assert.equal(state().authoredText, patternSource); assert.equal(state().accepted.features.length, 5); exactOutputRefs();
    await session.redo(); assert.equal(state().authoredText, spacingSource); exactOutputRefs();
    await session.redo(); assert.equal(state().authoredText, bevelSource); assert.equal(state().history.index, 3); assertReplayOutputs(state());
    assert.equal(state().history.count, count); assert.equal(state().selection, null); assert.equal(state().faceSelection, null);
    assert.equal(state().accepted.revision, revision + 6);
    assert.deepEqual(commands.slice(start).map(value => value.kind), ['apply', 'apply', 'prepare-source', 'accept-source', 'prepare-source', 'accept-source', 'apply', 'apply']);
    assert.equal(commands[start + 2].text, initial); assert.equal(commands[start + 4].text, patternSource);
    assert.equal(counters.loads, loads + 2); assert.equal(counters.parameterEdits, edits + 4);
  });
  await group(controllerLedger[6], async () => {
    session.stage('patternSpacing', '0.1'); const before = authority(), handle = acceptedHandle; failEdit = true;
    await session.preview(); await flush(); retained(before, handle); assert.equal(state().preview.diagnostic.stage, 'native');
    assert.match(state().error, /without rounding/); assert.equal(state().drafts.patternSpacing, '0.1');
    assert.equal(providerLog.at(-1).changes.patternSpacing, 0.1); assert.equal(commands.findLast(value => value.kind === 'prepare-preview').parameters.patternSpacing, 0.1);
    session.stage('patternSpacing', '49'); failDisplay = true;
    await session.preview(); await flush(); retained(before, handle); assert.equal(state().preview.diagnostic.stage, 'display');
    assert.match(state().error, /display prepare refusal/); assert.equal(state().drafts.patternSpacing, '49'); assertReplayOutputs(state());
  });
  await group(controllerLedger[7], async () => {
    const before = authority(), count = counters.replies;
    await assert.rejects(session.previewStructure(patternCommand, initialGeneration), /stale/); assert.throws(() => session.select(3, initialGeneration), /stale/);
    await assert.rejects(session.previewStructure(patternCommand, state().generation), /pending model dimensions/); assert.equal(counters.replies, count);
    session.stage('patternSpacing', '50'); mode = { kind: 'prepare-preview', action: 'hold' };
    const pending = session.preview(); await flush(); assert.equal(held.length, 1); const late = held.shift();
    session.cancel(); await pending; retained(before); assert.equal(late.worker.terminated, true); assert.equal(state().workerReady, false);
    late.deliver(); await flush(); retained(before); assert.equal(state().preview, null); assert.equal(state().drafts.patternSpacing, '50');
    const stopped = counters.replies; await assert.rejects(session.preview(), /explicitly/); assert.equal(counters.replies, stopped);
  });
  await group(controllerLedger[8], async () => {
    const before = authority(), handle = acceptedHandle; session.stage('patternSpacing', '52');
    await session.preview(true); assert.equal(state().preview.status, 'ready', state().error); assert.deepEqual(authority(), before);
    assert.deepEqual(commands.slice(-2).map(value => value.kind), ['open', 'prepare-preview']); assert.equal(commands.at(-2).text, before.authoredText);
    mode = { kind: 'accept-preview', action: 'hold' }; const pending = session.apply();
    assert.equal(held.length, 1); const lost = held.shift(); assert.equal(timers.size, 1);
    [...timers][0].callback(); await pending; retained(before, handle); assert.equal(lost.worker.terminated, true); assert.equal(state().workerReady, false);
    lost.deliver(); await flush(); retained(before, handle);
    const count = counters.replies; await assert.rejects(session.preview(), /explicitly/); assert.equal(counters.replies, count);
    await session.preview(true); assert.equal(state().preview.status, 'ready', state().error); assert.deepEqual(authority(), before);
    assert.deepEqual(commands.slice(-2).map(value => value.kind), ['open', 'prepare-preview']); assert.equal(commands.at(-2).text, before.authoredText);
    await session.apply(); assert.equal(state().error, null); recoveredSource = state().authoredText;
    assert.equal(state().accepted.parameters.patternSpacing, 52); assert.equal(state().accepted.revision, before.accepted.revision + 1);
    assert.equal(state().history.count, before.history.count + 1); assert.deepEqual(parse(recoveredSource).nodes, patternData.nodes); assertReplayOutputs(state());
  });
  await group(controllerLedger[9], async () => {
    const accepted = authority(), saved = state().authoredText; assert.equal(saved, recoveredSource);
    const data = new TextEncoder().encode(saved), staged = await api.readModelingFileText({ size: data.byteLength, arrayBuffer: async () => data.buffer });
    const reopened = controller(); await reopened.open(staged); const s = reopened.getSnapshot();
    assert.equal(s.error, null); assert.equal(s.authoredText, saved); assert.equal(s.accepted.parameters.patternSpacing, 52);
    assert.ok(Object.is(s.accepted.parameters.unusedSignedZero, -0)); assert.equal(s.accepted.features.length, 5); assert.equal(s.accepted.revision, 0);
    assert.deepEqual(s.history, { index: 0, count: 1, canUndo: false, canRedo: false }); assert.deepEqual(s.drafts, {}); assertReplayOutputs(s);
    assert.equal(commands.at(-1).text, saved); assert.deepEqual(parse(saved).nodes, patternData.nodes);
    reopened.select(4, s.generation); assert.equal(reopened.getSnapshot().selection, 4);
    assert.throws(() => reopened.select(4, s.generation - 1), /stale/);
    // All-convex three-body display remains one complete scene, not a fake selected-body profile.
    await assert.rejects(reopened.viewOutput('railCopy1', s.generation), /current named output/);
    const before = work(), open = commands.at(-1);
    const reply = evaluate(workers.at(-1).engine, { id: ++directId, taskToken: 'direct_' + directId, kind: 'prepare-source',
      workerToken: 'budget_worker', acceptedTaskToken: open.taskToken, expectedRevision: 0, candidateToken: 'budget_candidate',
      baseText: saved, operation: 'history', text: ' '.repeat(65537) }, 'direct');
    assert.equal(reply.ok, false); assert.match(reply.message, /64 KiB/); assert.deepEqual(work(), before);
    const staleOutput = evaluate(workers.at(-1).engine, { id: ++directId, taskToken: 'direct_' + directId, kind: 'export-stl',
      expectedRevision: 0, acceptedTaskToken: open.taskToken, outputName: 'railCopy1', solidId: 'stale_same_name_body' }, 'direct');
    assert.equal(staleOutput.ok, false); assert.match(staleOutput.message, /identity is stale/); assert.deepEqual(work(), before, 'Stale output refuses before any export/provider action');
    const sources = [initial, patternSource, spacingSource, bevelSource, recoveredSource]; assert.equal(state().history.count, sources.length);
    assert.equal(budget(sources.map(bytes), bytes(saved), [bytes(saved), bytes(saved), bytes(saved)]), sources.map(bytes).reduce((sum, count) => sum + count, 0) + 4 * bytes(saved));
    assert.deepEqual(authority(), accepted);
  });

function overlayInventory(display, components, expectedRows, expectedEdges) {
  const overlay = display.edges;
  assert.ok(overlay); assert.equal(overlay.format, 'barocss-gpu-engine-scene-edges');
  assert.equal(overlay.version, 0); assert.equal(overlay.sceneId, display.scene.id);
  assert.equal(overlay.owners.length, expectedRows); assert.equal(display.scene.nodes.length, expectedRows);
  assert.ok(expectedRows <= 16); assert.ok(expectedEdges <= 256);
  const seen = new Set(), perComponent = components.map(() => 0), empty = [];
  for (const owner of overlay.owners) {
    const node = display.scene.nodes.find(value => value.id === owner.nodeId);
    assert.ok(node); assert.equal(node.geometryId, owner.geometryId);
    const match = /^prism_geometry_(\d+)_(all|\d+)$/.exec(owner.geometryId); assert.ok(match);
    const componentIndex = Number(match[1]), faceIndex = match[2] === 'all' ? -1 : Number(match[2]);
    const component = components[componentIndex], geometry = display.scene.geometries.find(value => value.id === owner.geometryId);
    assert.ok(geometry); assert.equal(geometry.positions.length, component.mesh.positionsMM.length);
    assert.equal(owner.indices.length % 2, 0); assert.ok(owner.indices.length <= 64);
    if (!owner.indices.length) empty.push(owner.nodeId);
    const expected = component.lineage.graph.edges.map(edge => component.boundaries.find(use => use.solidEdgeId === edge.id))
      .filter(boundary => faceIndex === -1 || boundary.faceIndex === faceIndex).flatMap(boundary => boundary.vertexIndices);
    assert.deepEqual(owner.indices, expected, 'first incident use owns each segment in graph order');
    for (let offset = 0; offset < owner.indices.length; offset += 2) {
      const pair = owner.indices.slice(offset, offset + 2), nativeIds = pair.map(index => component.mesh.vertices[index].solidVertexId);
      const edges = component.lineage.graph.edges.filter(edge => edge.vertexIds.every(id => nativeIds.includes(id)));
      assert.equal(edges.length, 1, 'each emitted segment names one real native edge');
      const key = [component.role, component.report.solidId, edges[0].id].join('/');
      assert.ok(!seen.has(key), 'scoped native edge appears exactly once'); seen.add(key); perComponent[componentIndex]++;
      for (const diagonal of component.internalDiagonals) assert.notDeepEqual([...pair].sort((a, b) => a - b), [...diagonal.vertexIndices].sort((a, b) => a - b));
      const uses = component.boundaries.filter(use => use.solidEdgeId === edges[0].id);
      assert.equal(uses.length, 2); assert.deepEqual(uses[0].solidVertexIds, [...uses[1].solidVertexIds].reverse());
    }
  }
  assert.equal(new Set(overlay.owners.map(row => row.nodeId)).size, expectedRows);
  assert.equal(seen.size, expectedEdges);
  perComponent.forEach((count, i) => assert.equal(count, components[i].lineage.graph.edges.length));
  return { rows: expectedRows, edges: seen.size, emptyRows: empty.length, perComponent };
}
const subtract = (a, b) => a.map((value, i) => value - b[i]);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = values => values.map(value => value / Math.hypot(...values));
const xyz = values => values.flatMap((value, i) => i % 3 ? [] : [value, values[i + 2], -values[i + 1]]);
function pixelAt(scene, point, width, height) {
  const camera = scene.camera, backward = unit(subtract(camera.eye, camera.target));
  const right = unit(cross(camera.up, backward)), vertical = cross(backward, right), relativePoint = subtract(point, camera.eye);
  const depth = -dot(relativePoint, backward); if (depth <= camera.near || depth >= camera.far) return null;
  const tangent = Math.tan(camera.fovYDegrees * Math.PI / 360);
  const pixel = [Math.round((dot(relativePoint, right) / (depth * tangent * width / height) + 1) * width / 2 - .5),
    Math.round((dot(relativePoint, vertical) / (depth * tangent) + 1) * height / 2 - .5)];
  return pixel[0] >= 0 && pixel[0] < width && pixel[1] >= 0 && pixel[1] < height ? pixel : null;
}
function rayAt(api, scene, width, height, x, y) {
  return api.prepareEngineCameraRay(scene.camera, { format: 'barocss-gpu-engine-camera-ray-request', version: 0,
    pixelOrigin: 'bottom-left', sampling: 'pixel-center', viewportWidth: width, viewportHeight: height, pixelX: x, pixelY: y }).ray;
}
function assertNativePick(pick, packet) {
  assert.ok(pick); const component = packet.components.find(value => value.role === pick.role); assert.ok(component);
  assert.equal(pick.documentId, packet.documentId); assert.equal(pick.revision, packet.revision); assert.equal(pick.approximate, true);
  assert.equal(pick.solidId, component.report.solidId); assert.deepEqual(pick.lineage, component.lineage);
  const face = component.mesh.faces.find(value => value.sourceId === pick.face.sourceId && value.faceId === pick.face.faceId);
  assert.deepEqual(pick.face, face); assert.ok(pick.triangleIndex * 3 >= face.indexOffset && pick.triangleIndex * 3 < face.indexOffset + face.indexCount);
  assert.deepEqual(pick.vertices, component.mesh.indices.slice(pick.triangleIndex * 3, pick.triangleIndex * 3 + 3).map(index => component.mesh.vertices[index]));
  assert.deepEqual(pick.boundaries, component.boundaries.filter(value => value.sourceId === face.sourceId && value.faceId === face.faceId));
}

  // Three roles intentionally occupy the same original retained body. This is
  // receiver inventory proof only, never native pattern separation or new volume.
  const syntheticPacket = clone(baseline.display);
  syntheticPacket.components = ['part', 'railCopy1', 'railCopy2'].map(roleComponent);
  syntheticPacket.outcomes = syntheticPacket.components.map(value => ({ role: value.role, solidId: value.report.solidId, status: 'solid' }));
  let three, single;
  await group(sceneLedger[0], () => {
    single = runtime.prepareModelingScene(baseline.display);
    three = runtime.prepareModelingScene(syntheticPacket);
    assert.equal(single.scene.nodes.length, 8); assert.equal(three.scene.nodes.length, 3); assert.equal(three.scene.geometries.length, 3);
    assert.deepEqual(three.packet, syntheticPacket); assert.deepEqual(three.packet.components.map(value => value.role), ['part', 'railCopy1', 'railCopy2']);
    for (const geometry of three.scene.geometries) assert.match(geometry.id, /^prism_geometry_[0-2]_all$/);
    sceneObservations.push({ group: currentGroup, beforeFaceDraws: 8, threeBodyDraws: 3, expandedFaceDrawsNotUsed: 24,
      geometry: 'synthetic coincident role envelopes over one unchanged genuine original body' });
  });
  await group(sceneLedger[1], () => {
    for (const [i, value] of three.packet.components.entries()) {
      assertRetainedComponent(value); const geometry = three.scene.geometries[i];
      assert.deepEqual(geometry.positions, xyz(component.mesh.positionsMM)); assert.deepEqual(geometry.normals, xyz(component.mesh.normals));
      assert.deepEqual(geometry.uvs, component.mesh.parametersUV); assert.deepEqual(geometry.indices, component.mesh.indices); assert.equal(geometry.winding, 'ccw');
      assert.deepEqual(value.mesh, component.mesh); assert.deepEqual(value.boundaries, component.boundaries);
      assert.deepEqual(value.internalDiagonals, component.internalDiagonals); assert.deepEqual(value.lineage.graph, component.lineage.graph);
      assert.equal(value.report.solidId, component.report.solidId); assert.deepEqual(value.report, component.report);
    }
    sceneObservations.push({ group: currentGroup, preserved: ['positionsMM', 'normals', 'parametersUV', 'indices', 'vertices', 'faces', 'boundaries', 'fanDiagonals', 'nativeGraph', 'nativeIDs', 'report'],
      axisConversion: 'existing scene XYZ to display XZ-negativeY only; no native-array rewrite' });
  });
  await group(sceneLedger[2], () => {
    assert.deepEqual(overlayInventory(three, syntheticPacket.components, 3, 54), { rows: 3, edges: 54, emptyRows: 0, perComponent: [18, 18, 18] });
    assert.equal(three.edges.owners.reduce((count, owner) => count + owner.indices.length / 2, 0), 54);
    assert.equal(new Set(three.packet.components.map(value => value.report.solidId)).size, 1,
      'Shared original native IDs are deliberately retained; only roles scope the synthetic inventory');
    sceneObservations.push({ group: currentGroup, nativeSegments: 54, perRole: [18, 18, 18], originalFanDiagonalsExcludedPerRole: 12, coincident: true });
  });
  await group(sceneLedger[3], () => {
    const display = runtime.prepareModelingScene(syntheticPacket, 4 / 3), original = runtime.prepareModelingScene(baseline.display, 4 / 3);
    assert.throws(() => runtime.pickModelingScene(clone(display), 640, 480, 320, 240), /original convex draw authority/);
    const width = 640, height = 480, pixels = new Map();
    for (const geometry of display.scene.geometries.slice(0, 1)) for (let offset = 0; offset < geometry.indices.length; offset += 3) {
      const point = [0, 1, 2].map(axis => geometry.indices.slice(offset, offset + 3).reduce((sum, index) => sum + geometry.positions[index * 3 + axis], 0) / 3);
      const pixel = pixelAt(display.scene, point, width, height); if (pixel) pixels.set(pixel.join(','), pixel);
    }
    let interior = 0, bevelInterior = 0, nearBoundary = 0;
    const inspect = pixel => {
      const ray = rayAt(runtime, display.scene, width, height, ...pixel), hit = runtime.raycastEngineScene(display.scene, ray);
      const pick = runtime.pickModelingScene(display, width, height, ...pixel), prior = runtime.pickModelingScene(original, width, height, ...pixel);
      if (pick) { assertNativePick(pick, syntheticPacket); assertNativePick(prior, baseline.display); assert.deepEqual(pick, prior); }
      else assert.equal(prior, null);
      return { hit, pick };
    };
    for (const pixel of pixels.values()) {
      const { hit, pick } = inspect(pixel); if (!hit || Math.min(...hit.barycentric) <= .05) continue;
      assert.ok(pick); interior++;
      const normal = component.mesh.normals.slice(pick.face.vertexOffset * 3, pick.face.vertexOffset * 3 + 3);
      if (normal.every(value => Math.abs(value) < 1 - 1e-6)) bevelInterior++;
    }
    for (const edge of component.lineage.graph.edges) {
      const uses = component.boundaries.filter(value => value.solidEdgeId === edge.id), use = uses[0];
      const point = xyz([0, 1, 2].map(axis => use.vertexIndices.reduce((sum, index) => sum + component.mesh.positionsMM[index * 3 + axis], 0) / 2));
      const pixel = pixelAt(display.scene, point, width, height); if (!pixel) continue;
      const { pick } = inspect(pixel);
      if (pick && uses.some(value => value.sourceId === pick.face.sourceId && value.faceId === pick.face.faceId)) nearBoundary++;
    }
    assert.ok(interior > 0); assert.ok(bevelInterior > 0); assert.ok(nearBoundary > 0);
    sceneObservations.push({ group: currentGroup, interior, bevelInterior, nearBoundary,
      limits: 'CPU rays resolve original native faces/triangles. Coincident roles do not prove separately pickable translated rails or device edge readability.' });
  });
  await group(sceneLedger[4], () => {
    const cases = [];
    for (const orientation of ['top', 'isometric']) for (const aspect of [.75, 1, 1.5]) {
      const display = runtime.prepareModelingScene(syntheticPacket, aspect, undefined, orientation);
      assert.notStrictEqual(display.scene, three.scene); assert.notStrictEqual(display.edges, three.edges);
      assert.deepEqual(display.edges, three.edges); overlayInventory(display, syntheticPacket.components, 3, 54);
      assert.deepEqual(display.scene.camera.up, orientation === 'top' ? [0, 0, -1] : [0, 1, 0]);
      assert.deepEqual(display.scene.nodes.map(value => [value.id, value.geometryId]), three.scene.nodes.map(value => [value.id, value.geometryId]));
      assert.deepEqual(display.scene.geometries, three.scene.geometries); display.packet.components.forEach(assertRetainedComponent);
      cases.push({ orientation, aspect, sceneSHA256: hash(signed(display.scene)), edgesSHA256: hash(signed(display.edges)) });
    }
    sceneObservations.push({ group: currentGroup, cases, limits: 'Current CPU scene reprepare only; no browser canvas, DPR or GPU resize execution.' });
  });
  await group(sceneLedger[5], () => {
    const circleBytes = readFileSync(resolve(root, frozen.circlePath)); assert.equal(hash(circleBytes), frozen.circleSHA256);
    const capture = parse(circleBytes), native = capture.bodies.post.native, preview = clone(capture.preview);
    const documentId = 'cad_model', revision = 0, taskToken = 'linear_pattern_scene_control';
    preview.packet.surfaceId = preview.report.meshId = 'modeling_circle_post'; preview.packet.revision = preview.report.revision = revision;
    const circle = runtime.projectModelingCircle(native, preview, 'post', { documentId, bodyId: native.parent.bundle.topology.id,
      documentRevision: '0', kernelResultRevision: '0', topologyRevision: '0', taskToken });
    const mixed = { profile: 'model-body-faces', documentId, revision, taskToken,
      components: [...syntheticPacket.components.map(value => ({ family: 'convex-planar', component: clone(value) })), circle],
      outcomes: [...syntheticPacket.outcomes.map(value => ({ ...value, family: 'convex-planar' })),
        { role: 'post', solidId: circle.solidId, family: circle.family, status: 'solid' }] };
    let selectedCopy;
    for (const role of ['part', 'railCopy1', 'railCopy2']) {
      const display = runtime.prepareModelingScene(mixed, 1, role); assert.equal(display.selectedOutput, role);
      overlayInventory(display, [syntheticPacket.components.find(value => value.role === role)], 8, 18);
      let pick = null;
      for (let y = 16; y < 240 && !pick; y += 16) for (let x = 16; x < 240 && !pick; x += 16) pick = runtime.pickModelingScene(display, 256, 256, x, y);
      assertNativePick(pick, { ...syntheticPacket, documentId, revision }); assert.equal(pick.role, role);
      if (role === 'railCopy1') selectedCopy = display;
    }
    const post = runtime.prepareModelingScene(mixed, 1, 'post'); assert.equal(post.selectedOutput, 'post'); assert.equal(post.edges, undefined);
    assert.deepEqual(circle.mesh.chunks.flatMap(value => value.positionsMM), capture.preview.packet.positions);
    assert.throws(() => runtime.prepareModelingScene(mixed, 1, 'missing'), /selected output missing/);
    assert.throws(() => runtime.pickModelingScene(clone(selectedCopy), 256, 256, 128, 128), /original accepted/);
    for (const change of [d => { d.components[2].component.role = 'stale_copy'; },
      d => { d.outcomes[2].solidId = 'stale_same_name_body'; }, d => { d.outcomes[2].family = 'unknown'; },
      d => { d.outcomes[2].role = d.outcomes[1].role; }])
      assert.throws(() => runtime.prepareModelingScene(altered(mixed, change), 1, 'post'), 'Hidden output refusal cannot be bypassed by selecting another family');
    assert.deepEqual(selectedCopy.packet, mixed); assert.equal(selectedCopy.selectedOutput, 'railCopy1');
    sceneObservations.push({ group: currentGroup, retainedCircleSHA256: frozen.circleSHA256,
      selectedRoles: ['part', 'railCopy1', 'railCopy2', 'post'], hiddenOutputRefusals: 4,
      limits: 'Mixed-family envelope is synthetic; unchanged retained circle and two-bevel geometry retain their own native IDs.' });
  });
  assert.deepEqual(groups.map(value => value.name), [...pureLedger, ...controllerLedger, ...sceneLedger]);
  assert.equal(groups.length, 28); assert.equal(counters.controllers, 2); assert.equal(workers.length, 5);
  assert.equal(counters.replies, frozen.plannedReplyTotal); assert.ok(counters.replies <= frozen.controlledReplyLimit);
  for (const [key, count] of Object.entries(frozen.plannedProviderCounts)) assert.equal(counters[key], count, 'Exact frozen provider-double work count: ' + key);
  assert.equal(held.length, 0); assert.equal(timers.size, 0); assert.equal(mode, null); assert.equal(failEdit, false); assert.equal(failDisplay, false);
  assert.equal(hash(JSON.stringify(baseline)), baselineObjectHash); assert.equal(hash(readFileSync(baselinePath)), frozen.baselineSHA256);
  verifyFrozenSources();
  const result = { result: 'PASS', frozen, groups, counters, workerLifetimes: workers.length, replyLog, providerLog, sceneObservations,
    scriptSHA256, sourceHashes, frozenSourceHashes, baselineSHA256: frozen.baselineSHA256, baselineBytes: baselineBytes.length,
    newNativeCalls: 0, rawPatternPacketAvailable: false, runtime20EntryEvictionExecuted: false,
    runtime: { node: process.version, platform: process.platform, architecture: process.arch }, limitations: [
      'Actual current structure helper, engine, serializer, controller and CPU scene/edge preparation and picking execute. Provider, Worker and display ownership are explicit doubles.',
      'Pure helper summaries use synthetic distinct native-ID tokens that are never inserted into any native packet.',
      'Every replay mesh, UV, native graph, boundary, diagonal, report and original native ID remains the unchanged historical UNTRANSFORMED two-bevel6064 packet.',
      'Three-role envelopes are explicitly synthetic and coincident. Duplicate retained native IDs intentionally fail patternAuthored projection; no native uniqueness, spacing, translated bounds or per-copy volume is measured.',
      'Shared rail dimension edits change mocked authoring state while retained geometry stays unchanged; they do not measure edited native geometry.',
      'Decimal0.1 is forwarded unchanged and explicitly refused by a provider double. Native exact coefficient, final-coordinate and receiver limits remain authoritative.',
      'Mixed-family CPU selection uses a synthetic envelope containing unchanged retained circle and rail packets. No new native family evaluation runs.',
      'No local native evaluation/tessellation, browser/GPU execution, physical Save/Open, STL export, full build, collision, assembly, manufacturing or global memory qualification.',
      'Existing three-draw fallback and54 native segments are CPU inventory evidence only. Face color, edge readability and DPR2 physical acceptance remain separate.',
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
  delete globalThis.__linearPatternCad;
}
