// #1989: finite opposite-bevel authoring replay, never a new native geometry measurement.
// Actual engine/serializer/controller/CPU receiver; provider and tessellation are explicit doubles.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..');
const evidence = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-1989-opposite-chamfer');
mkdirSync(evidence, { recursive: true });
const output = resolve(evidence, 'attempt-' + new Date().toISOString().replaceAll(':', '-') + '-' + process.pid);
mkdirSync(output); writeFileSync(resolve(output, 'script.mjs'), readFileSync(import.meta.filename));
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value), parse = value => JSON.parse(value);
const source = name => resolve(root, 'packages/barocss-cad-editor/src', name + '.ts');
const pureLedger = Object.freeze([
  'P01 exact three-to-four append', 'P02 prefix signs expressions and dynamic maxY',
  'P03 decimal disjoint bevel and expression bounds', 'P04 invalid raw distances',
  'P05 accepted target output and summary identity', 'P06 unsupported configured and third-bevel ancestry',
  'P07 reserved driver and parameter budget', 'P08 accessors foreign prototypes and malformed fields',
  'P09 source and retained-history byte limits', 'P10 first bevel and other capability parity',
  'P11 genuine retained two-bevel provenance and context distinction', 'P12 stale expected-source reconstruction',
]);
const controllerLedger = Object.freeze([
  'C01 one-bevel admission through serializer and CPU receiver',
  'C02 structural preview and exact candidate promotion',
  'C03 structural source identity and Undo Redo',
  'C04 independent back front edits and parameter history',
  'C05 native receiver and display refusal retention',
  'C06 changed draft source target and generation',
  'C07 canceled preview and late reply retention',
  'C08 accepted-source roundtrip CPU control',
]);
const frozen = { issue: 1989, base: '44633efff7658a308c0b7da96690665b7a3547cb',
  structuralSourceCommit: '8b19b417bdbbb967299fd3d918feb0d9e40afc63', pureLedger, controllerLedger,
  controllerReplyCaps: Object.fromEntries(controllerLedger.map((name, index) => [name, [1, 4, 4, 8, 6, 0, 1, 1][index]])),
  controlledReplyLimit: 26, plannedReplyTotal: 25, controllerLifetimeLimit: 2, workerLifetimeLimit: 2,
  countPolicy: 'Each engine return including failures, held and discard replies counts once before delivery. Duplicate deliveries count again. Per-group caps and total limit are asserted before execution. No native calls.',
  geometryPolicy: 'Genuine complete unchanged two-bevel6064 transport mesh and lineage from historical frontDistance1/backDistance2/backY24. New bevelDistance/backBevelDistance context is adapted; one-bevel6128 and edited5984/5936 summaries are mocked. Actual engine serializer, controller and CPU receiver run.',
  baselinePath: 'packages/barocss-cad-editor/scripts/fixtures/modeling-chamfer-chain/baseline-transport.json', baselineBytes: 41471,
  baselineSHA256: '74e9a472c54aaa5d228a23d79b083c9a7c4c539bf5de6a5f274597e5fbfba4af',
  sourceBudgetPolicy: 'Synthetic64KiB/8MiB arithmetic and production source-slot accounting; no native RSS or runtime20-entry eviction claim.' };
if (process.env.FROZEN_LEDGER) assert.deepEqual(frozen, parse(readFileSync(process.env.FROZEN_LEDGER)));
writeFileSync(resolve(output, 'frozen-ledger.json'), JSON.stringify(frozen, null, 2) + '\n');
const scriptSHA256 = hash(readFileSync(import.meta.filename)), sourceHashes = {}, groups = [], replyLog = [];
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
assert.equal(hash(readFileSync(source('modeling-structure'))), '5ece27f67cc6961f018625f30225d6e6323f7ac7f371804cd48042168805ffcc', 'Frozen structural source must match before any execution');
const counters = { replies: 0, controllers: 0, loads: 0, parameterEdits: 0, retainedTessellationReplays: 0 };
let currentGroup = 'setup', groupReplyStart = 0;
process.on('uncaughtExceptionMonitor', cause => {
  const error = { group: currentGroup, message: String(cause), stack: cause.stack, counters, replyLog, scriptSHA256, sourceHashes, sourceCommit };
  writeFileSync(resolve(output, 'error.json'), JSON.stringify(error, null, 2) + '\n');
  if (!existsSync(resolve(evidence, 'first-error.json'))) writeFileSync(resolve(evidence, 'first-error.json'), JSON.stringify({ ...error, attempt: output }, null, 2) + '\n');
});
async function group(name, run) {
  currentGroup = name; groupReplyStart = counters.replies;
  await run(); groups.push({ name, result: 'PASS', replies: counters.replies - groupReplyStart });
  console.log(JSON.stringify(groups.at(-1))); writeFileSync(resolve(output, 'groups.json'), JSON.stringify(groups, null, 2) + '\n');
}
const pureNames = ['modeling-structure', 'modeling-rectangular-part', 'modeling-circular-part', 'modeling-file'];
for (const name of pureNames) sourceHashes[source(name)] = hash(readFileSync(source(name)));
const noNative = { name: 'pure-no-native', setup(build) {
  build.onResolve({ filter: /@barocss\/cad|barocss-cad\/|modeling-engine/ }, args => { throw Error('Native/runtime import prohibited: ' + args.path); });
} };
const pureBuilt = await require('esbuild').build({ stdin: { contents: pureNames.map(name => `export * from ${JSON.stringify(source(name))};`).join('\n'), resolveDir: root },
  bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, plugins: [noNative] });
assert.deepEqual(Object.keys(pureBuilt.metafile.inputs).filter(path => path !== '<stdin>').map(path => resolve(root, path)).sort(), pureNames.map(source).sort());
writeFileSync(resolve(output, 'pure.mjs'), pureBuilt.outputFiles[0].text);
const api = await import(pathToFileURL(resolve(output, 'pure.mjs')));
const { canonicalModelingText: text, buildModelingStructure: build, getModelingStructureCapabilities: capabilities,
  modelingSourceBytes: bytes, modelingSourceBudget: budget, sameModelingStructure: same } = api;
// Compare every preexisting capability field against the immutable pre-change source.
const oldSource = execFileSync('git', ['show', frozen.base + ':packages/barocss-cad-editor/src/modeling-structure.ts'], { cwd: root, encoding: 'utf8' });
sourceHashes['baseline-modeling-structure.ts'] = hash(oldSource);
writeFileSync(resolve(output, 'baseline-modeling-structure.ts'), oldSource);
const oldBuilt = await require('esbuild').build({ stdin: { contents: oldSource, sourcefile: 'baseline-modeling-structure.ts', loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false, plugins: [noNative] });
writeFileSync(resolve(output, 'baseline-pure.mjs'), oldBuilt.outputFiles[0].text);
const oldApi = await import(pathToFileURL(resolve(output, 'baseline-pure.mjs')));
const featureRows = d => d.nodes.map((node, index) => ({ kind: node.kind, index,
  dependencies: node.kind === 'sketch' ? [] : node.kind === 'extrude' ? [node.sketch]
    : ['hole', 'chamfer', 'translate', 'pattern'].includes(node.kind) ? [node.parent.node]
      : node.kind === 'union' ? [node.left.node, node.right.node] : node.tool ? [node.parent.node, node.tool.node] : [node.parent.node] }));
function summary(d, revision = 1) {
  return { source: 'model', documentId: 'cad_model', revision, parameters: clone(d.parameters), features: featureRows(d),
    outputs: Object.entries(d.outputs).map(([name, ref]) => ({ name, solidId: 'controlled_node' + ref.node, volumeMM3: null })) };
}
const altered = (value, change) => { const result = clone(value); change(result); return result; };
const blank = parse(api.createRectangularPartSource({ width: '32', height: '24', thickness: '8' }));
blank.nodes[0].min[0] = -0; blank.parameters.unusedSignedZero = -0;
blank.nodes[1].height = { op: 'add', left: { parameter: 'thickness' }, right: -0 };
blank.nodes[0].max[1] = { op: 'add', left: { parameter: 'height' }, right: { op: 'scale', value: -0, factor: 1 } };
const blankText = text(blank), firstInput = { kind: 'chamfer', target: summary(blank).outputs.map(o => ({ name: o.name, solidId: o.solidId, node: 1 }))[0], distance: 1 };
const first = oldApi.buildModelingStructure(blankText, summary(blank), firstInput), base = parse(first.text);
const initial = first.text, initialSummary = summary(base);
const input = { kind: 'chamfer', target: capabilities(initial, initialSummary).chamfer, distance: 2 };
let added, chamfer;
function refused(d) { const c = capabilities(text(d), summary(d)); assert.equal(c.chamfer, null); assert.ok(c.chamferReason); return c; }
await group(pureLedger[0], () => {
  added = build(initial, initialSummary, input); chamfer = parse(added.text);
  assert.equal(chamfer.nodes.length, 4);
  assert.deepEqual(chamfer.nodes[3], { kind: 'chamfer', parent: { node: 2, side: 'solid' },
    edge: { parallelTo: 'x', at: { y: base.nodes[0].max[1], z: 'max' } }, distance: { parameter: 'backBevelDistance' } });
  assert.deepEqual(chamfer.outputs, { part: { node: 3, side: 'solid' } });
  assert.equal(chamfer.parameters.bevelDistance, 1); assert.equal(chamfer.parameters.backBevelDistance, 2);
  assert.deepEqual({ ...added, text: undefined }, { text: undefined, kind: 'chamfer', selectedOutput: 'part', consumed: ['part'] });
  assert.deepEqual(summary(chamfer).features.map(f => f.dependencies), [[], [0], [1], [2]]);
});
await group(pureLedger[1], () => {
  assert.deepEqual(chamfer.nodes.slice(0, 3), base.nodes);
  for (const key of Object.keys(base.parameters)) assert.ok(Object.is(chamfer.parameters[key], base.parameters[key]));
  assert.ok(Object.is(chamfer.nodes[0].min[0], -0)); assert.ok(Object.is(chamfer.nodes[1].height.right, -0));
  assert.ok(Object.is(chamfer.nodes[3].edge.at.y.right.value, -0));
  assert.equal(text(chamfer), added.text); assert.deepEqual(parse(initial), base); assert.deepEqual(initialSummary, summary(base));
  assert.deepEqual(build(initial, initialSummary, input), added);
  const expression = altered(base, d => { d.parameters.origin = -0; d.nodes[0].min[1] = { parameter: 'origin' };
    d.parameters.height = 30; d.nodes[0].max[1] = { op: 'add', left: { op: 'scale', value: { parameter: 'height' }, factor: 0.5 }, right: -0 }; });
  const appended = parse(build(text(expression), summary(expression), input).text);
  assert.deepEqual(appended.nodes.slice(0, 3), expression.nodes); assert.deepEqual(appended.nodes[3].edge.at.y, expression.nodes[0].max[1]);
  assert.equal(appended.nodes[3].edge.at.y.left.factor * appended.parameters.height, 15, 'Opposite selector is not hardcoded24');
  assert.ok(Object.is(appended.nodes[3].edge.at.y.right, -0));
  const edited = altered(expression, d => { d.parameters.height = 6; });
  assert.throws(() => build(text(edited), summary(edited), input), /front plus back/, 'Dynamic maxY resolves3 and rejects equality');
});
await group(pureLedger[2], () => {
  for (const [width, height, thickness, front, back] of [[32.5, 24.25, 8.5, 0.125, 0.25], [0.5, 0.25, 0.125, 0.0625, 0.03125], [10000, 10000, 10000, 4999.5, 5000]]) {
    const d = altered(base, d => Object.assign(d.parameters, { width, height, thickness, bevelDistance: front }));
    assert.ok(capabilities(text(d), summary(d)).chamfer);
    const built = parse(build(text(d), summary(d), { ...input, distance: back }).text);
    assert.equal(built.parameters.bevelDistance, front); assert.equal(built.parameters.backBevelDistance, back);
  }
  for (const key of ['width', 'height', 'thickness']) for (const value of [0, -0, -1, 10001]) refused(altered(base, d => { d.parameters[key] = value; }));
  for (const front of [0, -0, -1, 8, 9]) refused(altered(base, d => { d.parameters.bevelDistance = front; }));
  for (const distance of [8, 9, 24]) assert.throws(() => build(initial, initialSummary, { ...input, distance }), /strictly below/);
  const short = altered(base, d => { d.parameters.height = 3; });
  for (const distance of [2, 2.5]) assert.throws(() => build(text(short), summary(short), { ...input, distance }), /front plus back/);
  assert.equal(parse(build(text(short), summary(short), { ...input, distance: 1.999 }).text).parameters.backBevelDistance, 1.999);
  for (const field of ['max', 'height']) {
    const put = (d, v) => { if (field === 'max') d.nodes[0].max[1] = v; else d.nodes[1].height = v; };
    let deep = 1; for (let i = 0; i < 6; i++) deep = { op: 'add', left: deep, right: 0 };
    refused(altered(base, d => put(d, deep)));
    const tree = depth => depth === 0 ? 1 : { op: 'add', left: tree(depth - 1), right: tree(depth - 1) };
    refused(altered(base, d => put(d, tree(5))));
    refused(altered(base, d => put(d, { op: 'add', left: { op: 'scale', value: 10000, factor: 2 }, right: -9999 })));
  }
});
await group(pureLedger[3], () => {
  for (const distance of [0, -0, -1, NaN, Infinity, -Infinity, 10001, Number.MAX_SAFE_INTEGER, '2', '', null, undefined, {}, []])
    assert.throws(() => build(initial, initialSummary, { ...input, distance }));
  for (const expression of [{ parameter: 'missing' }, { op: 'scale', value: 8, factor: '1' }, { parameter: 'height', extra: 1 }])
    refused(altered(base, d => { d.nodes[0].max[1] = expression; }));
});
await group(pureLedger[4], () => {
  assert.deepEqual(input.target, { name: 'part', solidId: 'controlled_node2', node: 2 });
  for (const target of [{ ...input.target, name: 'old' }, { ...input.target, solidId: 'old' }, { ...input.target, node: 1 }, { ...input.target, node: -0 }, { ...input.target, node: 3 }])
    assert.throws(() => build(initial, initialSummary, { ...input, target }), /stale/);
  for (const change of [s => { s.features[2].dependencies = [0]; }, s => { s.features[2].index = 1; }, s => { s.features.pop(); },
    s => { s.outputs[0].name = 'wrong'; }, s => { s.outputs[0].solidId = 'bad/id'; }, s => { s.outputs.push(clone(s.outputs[0])); }, s => { s.parameters.width = 33; },
    s => { s.parameters.unusedSignedZero = 0; }, s => { s.source = 'legacy'; }, s => { s.suppression = { finish: false }; }]) {
    const wrong = altered(initialSummary, change); assert.equal(capabilities(initial, wrong).chamfer, null); assert.throws(() => build(initial, wrong, input));
  }
  assert.equal(capabilities(null, null).chamfer, null);
  for (const raw of ['', '{', 'null', '[]']) assert.equal(capabilities(raw, initialSummary).chamfer, null);
});
await group(pureLedger[5], () => {
  for (const change of [d => { d.nodes[0].min[0] = 1; }, d => { d.nodes[0].min[1] = -0.25; },
    d => { d.outputs.blank = d.outputs.part; delete d.outputs.part; }, d => { d.outputs.alias = clone(d.outputs.part); },
    d => { d.outputs.part.side = 'negative'; }, d => { d.outputs.part.node = 1; },
    d => { d.nodes[0] = { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 4 }; },
    d => { d.nodes[2].edge.parallelTo = 'y'; }, d => { d.nodes[2].edge.at.y = -0; }, d => { d.nodes[2].edge.at.y = { parameter: 'unusedSignedZero' }; },
    d => { d.nodes[2].edge.at.z = 8; }, d => { d.nodes[2].parent.node = 0; }, d => { d.nodes[2].parent.side = 'negative'; },
    d => { d.nodes[2].distance = 1; }, d => { d.nodes[2].distance.parameter = 'frontDistance'; d.parameters.frontDistance = 1; },
    d => { delete d.parameters.bevelDistance; }, d => { d.nodes[2].name = 'front'; d.nodes[2].suppressed = false; },
    d => { d.nodes[2].suppressed = true; }, d => { d.configuration = { front: true }; }]) refused(altered(base, change));
  for (const from of [0, -0, 1]) refused(altered(base, d => { d.nodes[1].from = from; }));
  for (const kind of ['translate', 'pattern', 'hole', 'split', 'cut', 'union', 'difference']) refused(altered(base, d => {
    d.nodes[2].kind = kind;
    if (kind === 'union') { d.nodes[2].left = { node: 1, side: 'solid' }; d.nodes[2].right = { node: 1, side: 'solid' }; }
    if (kind === 'difference') d.nodes[2].tool = { node: 1, side: 'solid' };
  }));
  refused(chamfer); assert.throws(() => build(added.text, summary(chamfer), { ...input, target: { ...input.target, node: 3 } }));
  assert.match(capabilities(initial, altered(initialSummary, s => { s.features[2].dependencies = [0]; })).chamferReason, /ownership/);
});
await group(pureLedger[6], () => {
  const collision = altered(base, d => { d.parameters.backBevelDistance = 1; }); assert.match(refused(collision).chamferReason, /collision/);
  const maximum = altered(base, d => { for (let i = 0; i < 10; i++) d.parameters['spare' + i] = i; });
  assert.equal(Object.keys(parse(build(text(maximum), summary(maximum), input).text).parameters).length, 16);
  assert.match(refused(altered(maximum, d => { d.parameters.overflow = 1; })).chamferReason, /16-parameter/);
  for (const key of ['__proto__', 'constructor', 'prototype', 'bad space', 'a'.repeat(49)]) {
    const d = clone(base); Object.defineProperty(d.parameters, key, { value: 1, enumerable: true }); refused(d);
  }
});
await group(pureLedger[7], () => {
  let reads = 0;
  for (const key of ['distance', 'target']) assert.throws(() => build(initial, initialSummary,
    Object.defineProperty({ ...input }, key, { enumerable: true, get() { reads++; return input[key]; } })), /own data/);
  for (const value of [{ ...input, extra: true }, { ...input, edge: { parallelTo: 'y' } }, { ...input, target: { ...input.target, extra: true } },
    { ...input, [Symbol('hidden')]: true }, Object.defineProperty({ ...input }, 'hidden', { value: true }), Object.create(input)])
    assert.throws(() => build(initial, initialSummary, value));
  const getter = Object.defineProperty(clone(initialSummary), 'source', { get() { reads++; return 'model'; } });
  assert.equal(capabilities(initial, getter).chamfer, null); assert.equal(reads, 0);
  const sparse = [0, 1]; delete sparse[0]; assert.throws(() => text(sparse), /dense/);
  const cycle = {}; cycle.self = cycle; assert.throws(() => text(cycle), /acyclic/);
  for (const change of [d => { d.extra = true; }, d => { d.nodes[0].extra = true; }, d => { d.nodes[1].extra = true; },
    d => { d.nodes[2].extra = true; }, d => { d.nodes[2].edge.extra = true; }, d => { d.nodes[2].edge.at.extra = true; },
    d => { d.nodes[2].distance.extra = true; }, d => { d.outputs.part.extra = true; }]) refused(altered(base, change));
});
await group(pureLedger[8], () => {
  assert.equal(bytes('a'.repeat(65536)), 65536); assert.throws(() => bytes('a'.repeat(65537)), /64 KiB/);
  assert.equal(bytes('é'.repeat(32768)), 65536); assert.throws(() => bytes('é'.repeat(32769)), /UTF-8/);
  assert.equal(capabilities(initial + ' '.repeat(65536), initialSummary).chamfer, null);
  assert.equal(budget([8 * 1024 * 1024 - 3], 1, [1, 1]), 8 * 1024 * 1024);
  assert.throws(() => budget([8 * 1024 * 1024 - 3], 1, [1, 2]), /8 MiB/);
  for (const value of [-1, -0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1']) assert.throws(() => budget([], value, []));
  assert.throws(() => budget(Array(21).fill(0), 0, [])); assert.throws(() => budget([], 0, Array(65).fill(0)));
  assert.equal(budget(Array(20).fill(65536), 65536, [65536, 65536, 65536]), 24 * 65536);
  assert.equal(budget([bytes(initial), bytes(added.text)], bytes(added.text), [bytes(initial)]), 2 * bytes(initial) + 2 * bytes(added.text));
});
await group(pureLedger[9], () => {
  for (const d of [blank, altered(blank, d => { d.parameters.width = 32.5; }), altered(blank, d => { d.parameters.height = 0.5; }),
    altered(blank, d => { d.nodes[0].max[1] = 40; })]) {
    const value = text(d), accepted = summary(d), command = { ...firstInput, distance: 0.25 };
    assert.deepEqual(capabilities(value, accepted), oldApi.getModelingStructureCapabilities(value, accepted));
    assert.deepEqual(build(value, accepted, command), oldApi.buildModelingStructure(value, accepted, command), 'First-bevel result stays byte-identical');
  }
  const arm = build(blankText, summary(blank), { kind: 'add-arm', target: capabilities(blankText, summary(blank)).addArm, x: 0, y: 0, width: 8, height: 24 });
  const joined = build(arm.text, summary(parse(arm.text)), { kind: 'union', targets: capabilities(arm.text, summary(parse(arm.text))).union });
  const cut = build(joined.text, summary(parse(joined.text)), { kind: 'cut-slot', target: capabilities(joined.text, summary(parse(joined.text))).cutSlot, x: 16, y: 2, width: 8, height: 4 });
  const hole = build(blankText, summary(blank), { kind: 'add-hole', target: capabilities(blankText, summary(blank)).addHole, x: 16, y: 12, radius: 2.5 });
  const pocket = build(blankText, summary(blank), { kind: 'cut-pocket', target: capabilities(blankText, summary(blank)).cutPocket, wall: 8, floor: 4 });
  const circle = api.createCircularPartSource({ diameter: '8', thickness: '6' });
  for (const value of [blankText, arm.text, joined.text, cut.text, hole.text, pocket.text, circle, initial, added.text,
    text(altered(blank, d => { d.parameters.bevelDistance = 1; })), text(altered(blank, d => { d.nodes[0].min[0] = 1; }))]) {
    const d = parse(value), accepted = summary(d), before = oldApi.getModelingStructureCapabilities(value, accepted), after = capabilities(value, accepted);
    const older = ({ chamfer: _target, chamferReason: _reason, ...rest }) => rest;
    assert.deepEqual(older(after), older(before));
  }
  const decimal = altered(blank, d => { d.parameters.width = 32.5; });
  for (const key of ['addArm', 'addHole', 'union', 'cutSlot', 'cutPocket']) assert.equal(capabilities(text(decimal), summary(decimal))[key], null);
});
const baselinePath = resolve(root, frozen.baselinePath), baselineBytes = readFileSync(baselinePath), baseline = parse(baselineBytes);
const component = baseline.display.components[0], baselineObjectHash = hash(JSON.stringify(baseline));
const oracle = (front, back = 0) => 6144 - 32 * (front * front + back * back) / 2;
await group(pureLedger[10], () => {
  assert.equal(baselineBytes.length, frozen.baselineBytes); assert.equal(hash(baselineBytes), frozen.baselineSHA256);
  assert.equal(baseline.ok, true); assert.deepEqual(baseline.summary.parameters, { frontDistance: 1, backDistance: 2, backY: 24 });
  const historical = parse(baseline.text);
  assert.equal(historical.nodes.length, 4); assert.equal(baseline.summary.outputs[0].volumeMM3.numerator, '6064');
  assert.deepEqual(historical.nodes[3].parent, { node: 2, side: 'solid' }); assert.deepEqual(historical.nodes[3].edge.at.y, { parameter: 'backY' });
  assert.notEqual(baseline.text, added.text, 'Historical authored context is distinct from current command drivers');
  assert.deepEqual([oracle(0), oracle(1), oracle(1, 2), oracle(1, 3), oracle(2, 3)], [6144, 6128, 6064, 5984, 5936]);
  assert.equal(component.report.triangleCount, 20); assert.equal(component.mesh.indices.length, 60);
  assert.notEqual(oracle(1), 6064); refused(historical);
});
await group(pureLedger[11], () => {
  assert.equal(same(initial, added.text), false);
  const edited = text(altered(chamfer, d => { d.parameters.backBevelDistance = 3; })); assert.equal(same(added.text, edited), true);
  assert.equal(same(added.text, text(altered(chamfer, d => { d.nodes[3].edge.at.y = 24; }))), false);
  assert.equal(same(added.text, text(altered(chamfer, d => { d.nodes[0].min[0] = 0; }))), false);
  assert.notEqual(build(initial, initialSummary, { ...input, distance: 3 }).text, added.text);
  const newer = altered(base, d => { d.parameters.height = 30; });
  assert.throws(() => build(text(newer), initialSummary, input), /parameters/);
  const rebuilt = parse(build(text(newer), summary(newer), input).text); assert.equal(rebuilt.parameters.height, 30);
  assert.deepEqual(rebuilt.nodes.slice(0, 3), newer.nodes); assert.deepEqual(rebuilt.nodes[3].edge.at.y, newer.nodes[0].max[1]);
});

const forbidden = () => { throw Error('No native calls, unrelated families, examples or STL in this replay.'); };
const nativeFailure = () => Object.assign(Error('Explicit mock provider chamfer refusal'), { name: 'CadModelError', code: 'NATIVE', operation: 'build' });
let failEdit = false, failDisplay = false, mode = null;
function snapshot(data) {
  assert.ok([3, 4].includes(data.nodes.length)); assert.deepEqual(Object.keys(data.outputs), ['part']);
  const volume = oracle(data.parameters.bevelDistance, data.parameters.backBevelDistance ?? 0);
  // This is a provider double, not a reconstructed or certified native body.
  const body = { family: 'convex-planar', native: { report: { solidId: component.report.solidId },
    certificate: { volumeMM3: { numerator: String(volume), denominator: '1' } }, graph: clone(component.lineage.graph) } };
  return { parameters: clone(data.parameters), suppression: {}, features: featureRows(data), bodies: { part: body }, save: () => text(data),
    withParameters(changes) { counters.parameterEdits++; if (failEdit) { failEdit = false; throw nativeFailure(); }
      return snapshot({ ...clone(data), parameters: { ...data.parameters, ...changes } }); }, withSuppression: forbidden, exportStl: forbidden };
}
globalThis.__oppositeChamferCad = { cad: { model: forbidden, load(sourceText) { counters.loads++; return snapshot(parse(sourceText)); } },
  tessellateConvexPlanarSolid(body, options) {
    assert.deepEqual(options, { maximumFanTriangles: 40 }); assert.equal(body.report.solidId, component.report.solidId);
    assert.deepEqual(body.graph, component.lineage.graph); counters.retainedTessellationReplays++;
    return clone({ mesh: component.mesh, boundaries: component.boundaries, internalDiagonals: component.internalDiagonals, report: component.report });
  }, tessellateSurface: forbidden, tessellateOwnPlateCircularHole: forbidden, tessellateXYCirclePrismShell: forbidden };
const gpu = resolve(output, 'gpu-entry.ts');
writeFileSync(gpu, ['engine-scene', 'engine-camera-ray', 'engine-raycast', 'kernel-face-preview']
  .map(name => `export * from ${JSON.stringify(resolve(root, 'packages/barocss-gpu/src', name + '.ts'))};`).join('\n'));
const built = await require('esbuild').build({ stdin: { contents: ['modeling-controller', 'modeling-engine'].map(name => `export * from ${JSON.stringify(source(name))};`).join('\n'), resolveDir: root },
  bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, alias: { '@barocss/gpu': gpu },
  plugins: [{ name: 'explicit-provider-no-native', setup(build) {
    build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'double' }));
    build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'double' }));
    build.onLoad({ filter: /.*/, namespace: 'double' }, args => ({ contents: args.path === 'provider'
      ? 'export const {cad,tessellateSurface,tessellateConvexPlanarSolid,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell}=globalThis.__oppositeChamferCad;'
      : 'export function createPrismFeatureEngine(){return ()=>{throw Error("No legacy native execution");};}' }));
    build.onResolve({ filter: /\.wasm$|\/native-runtime|opencascade/i }, args => { throw Error('Native module prohibited: ' + args.path); });
  } }] });
for (const input of Object.keys(built.metafile.inputs)) if (input !== '<stdin>' && !input.startsWith('double:')) {
  assert.ok(!/barocss-cad\/src\//.test(input), 'No provider/native dependency may be loaded'); sourceHashes[input] = hash(readFileSync(resolve(root, input)));
}
writeFileSync(resolve(output, 'runtime.mjs'), built.outputFiles[0].text);
writeFileSync(resolve(output, 'runtime.metafile.json'), JSON.stringify(built.metafile, null, 2) + '\n');
const { createModelingEngine, createCadEditorModelingController } = await import(pathToFileURL(resolve(output, 'runtime.mjs')));
const previousWorker = globalThis.Worker, workers = [], sessions = [], commands = [], held = [];
function evaluate(engine, request, route = 'worker') {
  assert.ok(counters.replies < frozen.controlledReplyLimit, 'Stop before frozen reply26 ceiling');
  assert.ok(counters.replies - groupReplyStart < frozen.controllerReplyCaps[currentGroup], 'Stop before current group reply cap');
  const reply = engine(request); counters.replies++;
  replyLog.push({ number: counters.replies, group: currentGroup, route, request: request.kind, ok: reply.ok, kind: reply.kind, ...(reply.ok ? {} : { message: reply.message }) });
  writeFileSync(resolve(output, 'replies.json'), JSON.stringify(replyLog, null, 2) + '\n');
  if (reply.ok && reply.display) assert.deepEqual(reply.display.components[0], component, 'Actual serializer retains every complete two-bevel mesh and lineage field');
  return reply;
}
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
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
let value, firstSource, backSource, frontSource, initialGeneration, prepareRequest, directId = 10000;
try {
  await group(controllerLedger[0], async () => {
    await session.open(initial); assert.equal(state().error, null); assert.equal(state().history.count, 1);
    assert.equal(state().accepted.outputs[0].volumeMM3.numerator, '6128', 'Mocked one-bevel summary, unchanged6064 two-bevel geometry');
    assert.equal(state().accepted.features.length, 3); assert.equal(state().display.scene.geometries.length, 1);
    assert.equal(commands.at(-1).text, initial); assert.deepEqual(parse(state().authoredText).nodes, base.nodes);
    session.select(2, state().generation); initialGeneration = state().generation;
    value = { kind: 'chamfer', target: capabilities(state().authoredText, state().accepted).chamfer, distance: 2 };
    assert.equal(value.target.node, 2); assert.equal(value.target.solidId, state().accepted.outputs[0].solidId);
  });
  await group(controllerLedger[1], async () => {
    const before = authority(), handle = acceptedHandle, count = counters.replies;
    await assert.rejects(session.applyStructure(value, state().generation), /Preview the current/); assert.equal(counters.replies, count);
    await session.previewStructure(value, state().generation); await flush(); assert.equal(state().preview.status, 'ready', state().error);
    assert.deepEqual(authority(), before); assert.equal(acceptedHandle, handle); assert.notEqual(visibleHandle, handle);
    assert.equal(state().preview.outputs[0].volumeMM3.numerator, '6064', 'Genuine two-bevel baseline geometry under adapted authored context');
    prepareRequest = clone(commands.at(-1)); assert.equal(prepareRequest.kind, 'prepare-source'); assert.equal(prepareRequest.baseText, initial);
    assert.equal(prepareRequest.text, added.text); assert.deepEqual(prepareRequest.command, value);
    const loads = counters.loads;
    for (const changes of [{ baseText: initial + ' ' }, { command: { ...value, target: { ...value.target, solidId: 'foreign_result' } } }]) {
      const reply = evaluate(workers[0].engine, { ...prepareRequest, ...changes, id: ++directId, taskToken: 'direct_' + directId }, 'direct');
      assert.equal(reply.ok, false);
    }
    assert.equal(counters.loads, loads, 'Stale source and foreign target never reach the provider');
    const work = [counters.loads, counters.parameterEdits, counters.retainedTessellationReplays];
    await assert.rejects(session.applyStructure({ ...value, distance: 3 }, state().generation), /Preview the current/);
    await assert.rejects(session.apply(), /structural command/); assert.equal(counters.replies, count + 3);
    await session.applyStructure(value, state().generation); assert.equal(state().error, null);
    assert.deepEqual([counters.loads, counters.parameterEdits, counters.retainedTessellationReplays], work);
    assert.equal(state().history.count, 2); assert.equal(state().accepted.features.length, 4); firstSource = state().authoredText;
    assert.equal(firstSource, added.text); assert.deepEqual(parse(firstSource).nodes.slice(0, 3), base.nodes);
    assert.equal(state().selection, null); assert.deepEqual(state().accepted.features.map(f => f.dependencies), [[], [0], [1], [2]]);
    assert.deepEqual(state().display.packet.components[0], component); assert.equal(capabilities(firstSource, state().accepted).chamfer, null);
    assert.equal(commands.at(-1).text, added.text); assert.equal(commands.at(-1).kind, 'accept-source');
    await assert.rejects(session.applyStructure(value, initialGeneration), /stale/);
  });
  await group(controllerLedger[2], async () => {
    const count = state().history.count;
    await session.undo(); assert.equal(state().authoredText, initial); assert.equal(state().history.index, 0); assert.equal(state().accepted.features.length, 3);
    assert.equal(capabilities(state().authoredText, state().accepted).chamfer.node, 2);
    await session.redo(); assert.equal(state().authoredText, firstSource); assert.equal(state().accepted.features.length, 4);
    assert.equal(state().history.count, count); assert.equal(state().selection, null); assert.equal(state().faceSelection, null);
    assert.deepEqual(commands.slice(-4).map(r => r.kind), ['prepare-source', 'accept-source', 'prepare-source', 'accept-source']);
    assert.equal(commands.at(-4).text, initial); assert.equal(commands.at(-2).text, firstSource);
  });
  await group(controllerLedger[3], async () => {
    session.select(3, state().generation); session.stage('backBevelDistance', '3'); const before = authority(), loads = counters.loads;
    await session.preview(); assert.equal(state().preview.status, 'ready', state().error); assert.deepEqual(authority(), before);
    assert.deepEqual(commands.at(-1).parameters, { backBevelDistance: 3 });
    await session.apply(); assert.equal(state().error, null); backSource = state().authoredText;
    assert.equal(state().accepted.parameters.backBevelDistance, 3); assert.equal(state().accepted.parameters.bevelDistance, 1);
    assert.equal(state().accepted.outputs[0].volumeMM3.numerator, '5984', 'Mocked edited summary');
    assert.deepEqual(parse(backSource).nodes, chamfer.nodes); assert.equal(state().selection, 3); assert.equal(state().history.count, 3);
    await session.undo(); assert.equal(state().authoredText, firstSource); assert.equal(state().accepted.features.length, 4);
    await session.redo(); assert.equal(state().authoredText, backSource); assert.equal(state().accepted.features.length, 4);
    session.stage('bevelDistance', '2'); await session.preview(); assert.equal(state().preview.status, 'ready', state().error);
    assert.deepEqual(commands.at(-1).parameters, { bevelDistance: 2 });
    await session.apply(); assert.equal(state().error, null); frontSource = state().authoredText;
    assert.equal(state().accepted.parameters.bevelDistance, 2); assert.equal(state().accepted.parameters.backBevelDistance, 3);
    assert.equal(state().accepted.outputs[0].volumeMM3.numerator, '5936', 'Mocked independently edited summary');
    assert.deepEqual(parse(frontSource).nodes, chamfer.nodes); assert.equal(state().history.count, 4);
    await session.undo(); assert.equal(state().authoredText, backSource); assert.equal(state().accepted.features.length, 4);
    await session.redo(); assert.equal(state().authoredText, frontSource); assert.equal(state().accepted.features.length, 4);
    assert.equal(counters.loads, loads); assert.deepEqual(state().display.packet.components[0], component);
  });
  await group(controllerLedger[4], async () => {
    // Global Model dimensions remain native-authoritative after structural preflight.
    session.stage('backBevelDistance', '8'); const before = authority(), handle = acceptedHandle; failEdit = true;
    await session.preview(); await flush(); retained(before, handle); assert.equal(state().preview.diagnostic.stage, 'native');
    assert.match(state().error, /mock provider/); assert.equal(state().drafts.backBevelDistance, '8');
    assert.deepEqual(commands.findLast(r => r.kind === 'prepare-preview').parameters, { backBevelDistance: 8 });
    session.stage('backBevelDistance', '4');
    mode = { kind: 'prepare-preview', action(reply) { assert.equal(reply.ok, true); reply.display.components[0].mesh.positionsMM[0] += 1; } };
    await session.preview(); await flush(); retained(before, handle); assert.equal(state().preview.diagnostic.stage, 'transport');
    failDisplay = true; await session.preview(); await flush(); retained(before, handle);
    assert.equal(state().preview.diagnostic.stage, 'display'); assert.match(state().error, /display prepare refusal/);
  });
  await group(controllerLedger[5], async () => {
    const before = authority(), count = counters.replies;
    await assert.rejects(session.previewStructure(value, initialGeneration), /stale/);
    await assert.rejects(session.previewStructure(value, state().generation), /pending model dimensions/);
    await assert.rejects(session.applyStructure(value, state().generation), /stale or dimensions/);
    assert.equal(counters.replies, count); session.discard();
    await assert.rejects(session.previewStructure(value, state().generation), /second chamfer|third bevel|unmodified/);
    assert.throws(() => session.select(2, initialGeneration), /stale/);
    retained(before);
    session.stage('backBevelDistance', '4');
  });
  await group(controllerLedger[6], async () => {
    const before = authority(); mode = { kind: 'prepare-preview', action: 'hold' };
    const pending = session.preview(); await flush(); assert.equal(held.length, 1); const late = held.shift();
    session.cancel(); await pending; assert.equal(late.worker.terminated, true); retained(before); assert.equal(state().workerReady, false);
    late.deliver(); await flush(); retained(before); assert.equal(state().preview, null); assert.equal(state().drafts.backBevelDistance, '4');
    const count = counters.replies; await assert.rejects(session.preview(), /explicitly/); assert.equal(counters.replies, count); retained(before);
  });
  await group(controllerLedger[7], async () => {
    const accepted = authority(), saved = state().authoredText;
    assert.equal(saved, frontSource); assert.equal(parse(saved).parameters.backBevelDistance, 3);
    const data = new TextEncoder().encode(saved), staged = await api.readModelingFileText({ size: data.byteLength, arrayBuffer: async () => data.buffer });
    const reopened = controller(); await reopened.open(staged); const s = reopened.getSnapshot();
    assert.equal(s.error, null); assert.equal(s.authoredText, saved); assert.equal(s.accepted.parameters.backBevelDistance, 3);
    assert.equal(s.accepted.parameters.bevelDistance, 2); assert.equal(s.accepted.features.length, 4); assert.equal(s.accepted.revision, 0);
    assert.deepEqual(s.history, { index: 0, count: 1, canUndo: false, canRedo: false }); assert.deepEqual(s.drafts, {});
    assert.equal(commands.at(-1).text, saved); assert.deepEqual(parse(saved).nodes, chamfer.nodes);
    assert.deepEqual(s.display.packet.components[0], component); assert.equal(s.display.scene.geometries.length, 1);
    assert.deepEqual(authority(), accepted); assert.equal(state().drafts.backBevelDistance, '4'); session.discard();
  });
  assert.equal(groups.length, 20); assert.equal(counters.controllers, 2); assert.equal(workers.length, 2);
  assert.equal(counters.replies, frozen.plannedReplyTotal); assert.ok(counters.replies <= frozen.controlledReplyLimit); assert.equal(held.length, 0);
  assert.equal(hash(JSON.stringify(baseline)), baselineObjectHash); assert.equal(hash(readFileSync(baselinePath)), frozen.baselineSHA256);
  const result = { result: 'PASS', frozen, groups, counters, workerLifetimes: workers.length, replyLog, scriptSHA256, sourceHashes, sourceCommit,
    baselineSHA256: frozen.baselineSHA256, baselineBytes: baselineBytes.length, newNativeCalls: 0,
    historicalOracle: { blank: oracle(0), front1: oracle(1), retainedFront1Back2: oracle(1, 2), mockedFront1Back3: oracle(1, 3), mockedFront2Back3: oracle(2, 3) },
    runtime: { node: process.version, platform: process.platform, architecture: process.arch },
    limitations: ['Actual engine serializer, controller and CPU scene receiver execute; native provider/tessellator and display ownership are explicit doubles.',
      'Complete historical mesh/UV/use/lineage remains the genuine two-bevel6064 packet in every replay. Historical frontDistance/backDistance/backY differs from new bevelDistance/backBevelDistance authoring context.',
      'One-bevel6128 and edited5984/5936 volumes are mocked summaries; no new geometry measurement or face-lineage visibility qualification.',
      'Global Model dimensions after authoring remain native-authoritative; one explicit provider refusal preserves accepted source/history.',
      'No native calls, full package build, GPU/browser pixels, physical file chooser, STL or manufacturing qualification.',
      'Source/history arithmetic is synthetic; no runtime20-entry eviction or native RSS claim.'] };
  writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  const logHashes = Object.fromEntries(['frozen-ledger.json', 'groups.json', 'replies.json', 'result.json', 'runtime.metafile.json']
    .map(name => [name, hash(readFileSync(resolve(output, name)))]));
  writeFileSync(resolve(output, 'log-hashes.json'), JSON.stringify(logHashes, null, 2) + '\n');
  console.log(JSON.stringify({ result: result.result, groups: groups.length, counters, output, scriptSHA256, sourceCommit, logHashes }));
} finally { sessions.forEach(s => s.dispose()); globalThis.Worker = previousWorker; delete globalThis.__oppositeChamferCad; }
