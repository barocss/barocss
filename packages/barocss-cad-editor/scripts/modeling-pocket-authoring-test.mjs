// #1971: finite authoring fixture. New context/provider and edited display are explicit mocks.
// The actual engine, serializer and receiver consume all 46 unchanged retained Surface packets.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../..');
const evidence = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-1971-pocket-authoring');
mkdirSync(evidence, { recursive: true });
const output = resolve(evidence, 'attempt-' + new Date().toISOString().replaceAll(':', '-') + '-' + process.pid);
mkdirSync(output);
writeFileSync(resolve(output, 'script.mjs'), readFileSync(import.meta.filename));
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value), parse = value => JSON.parse(value);
const source = name => resolve(root, 'packages/barocss-cad-editor/src', name + '.ts');
const pureLedger = Object.freeze([
  'P01 exact two-to-five graph', 'P02 signed prefix and expressions',
  'P03 defaults and integer bounds', 'P04 strict containment',
  'P05 own-data and accessor refusal', 'P06 independent driver collisions and parameter16',
  'P07 exact selected output solid and source', 'P08 unsupported parent from and aliases',
  'P09 pocket versus union and old hole branches', 'P10 expression intermediate and source budgets',
  'P11 baseline floor and wall arithmetic oracles', 'P12 dependencies no repeat and global-edit source marker',
]);
const controllerLedger = Object.freeze([
  'C01 real baseline serializer receiver retained46', 'C02 preview preserves accepted display and history authority',
  'C03 exact promotion without repeat provider load', 'C04 structural Undo Redo two-to-five',
  'C05 parameter edit then exact source history', 'C06 Cancel and late reply',
  'C07 native and receiver refusal', 'C08 stale base output worker and draft ABA binding',
  'C09 accepted-only source save and cold Open', 'C10 explicit mocked global zero-floor semantics',
]);
const frozen = { pureLedger, controllerLedger, controllerLifetimeLimit: 2, workerLifetimeLimit: 2, controlledReplyLimit: 36,
  countPolicy: 'Every engine return, including failed/held/discard replies, counts once; repeat deliveries count again. Assert before evaluation. No native calls.',
  geometryPolicy: 'New sole-part authoring context/provider are mocked. Unchanged genuine wall8/floor4 baseline replays every edited display and native summary. Floor2 has retained native volume5376 but no captured meshes; wall4/floor2 arithmetic3840 is unmeasured.',
  sourceBudgetPolicy: 'Synthetic 8-MiB arithmetic and production source-slot accounting only; no runtime 20-entry eviction/RSS qualification.' };
writeFileSync(resolve(output, 'frozen-ledger.json'), JSON.stringify(frozen, null, 2) + '\n');
const scriptSHA256 = hash(readFileSync(import.meta.filename)), sourceHashes = {}, groups = [];
const counters = { replies: 0, directReplies: 0, workerReplies: 0, controllers: 0, loads: 0, parameterEdits: 0, convexReplays: 0, panelReplays: 0 };
let currentGroup = 'setup';
process.on('uncaughtExceptionMonitor', cause => {
  const error = { group: currentGroup, message: String(cause), stack: cause.stack, counters, scriptSHA256, sourceHashes };
  writeFileSync(resolve(output, 'error.json'), JSON.stringify(error, null, 2) + '\n');
  if (!existsSync(resolve(evidence, 'first-error.json'))) writeFileSync(resolve(evidence, 'first-error.json'), JSON.stringify({ ...error, attempt: output }, null, 2) + '\n');
});
async function group(name, run) {
  currentGroup = name; const before = counters.replies;
  await run(); groups.push({ name, result: 'PASS', replies: counters.replies - before });
  const line = JSON.stringify(groups.at(-1)); console.log(line);
  writeFileSync(resolve(output, 'groups.json'), JSON.stringify(groups, null, 2) + '\n');
}
for (const name of ['modeling-structure', 'modeling-rectangular-part']) {
  const file = source(name); sourceHashes[file] = hash(readFileSync(file)); writeFileSync(resolve(output, name + '.ts'), readFileSync(file));
}
const pureBuilt = await require('esbuild').build({ stdin: { contents: ['modeling-structure', 'modeling-rectangular-part']
  .map(name => `export * from ${JSON.stringify(source(name))};`).join('\n'), resolveDir: root },
  bundle: true, platform: 'node', format: 'esm', write: false, metafile: true,
  plugins: [{ name: 'pure-no-native', setup(build) {
    build.onResolve({ filter: /@barocss\/cad|barocss-cad\/|modeling-engine/ }, args => { throw Error('Native/runtime import prohibited: ' + args.path); });
  } }] });
assert.deepEqual(Object.keys(pureBuilt.metafile.inputs).filter(path => path !== '<stdin>').map(path => resolve(root, path)).sort(),
  [source('modeling-structure'), source('modeling-rectangular-part')].sort());
writeFileSync(resolve(output, 'pure.mjs'), pureBuilt.outputFiles[0].text);
const api = await import(pathToFileURL(resolve(output, 'pure.mjs')));
const { canonicalModelingText: text, buildModelingStructure: build, getModelingStructureCapabilities: capabilities,
  modelingSourceBytes: bytes, modelingSourceBudget: budget, sameModelingStructure: same } = api;
const featureRows = d => d.nodes.map((node, index) => ({ kind: node.kind, index,
  dependencies: node.kind === 'sketch' ? [] : node.kind === 'extrude' ? [node.sketch]
    : node.kind === 'hole' || node.kind === 'translate' || node.kind === 'chamfer' ? [node.parent.node]
      : node.kind === 'union' ? [node.left.node, node.right.node] : [node.parent.node, node.tool.node] }));
function summary(d, revision = 1) {
  return { source: 'model', documentId: 'cad_model', revision, parameters: clone(d.parameters), features: featureRows(d),
    outputs: Object.entries(d.outputs).map(([name, ref]) => ({ name, solidId: 'controlled_node' + ref.node, volumeMM3: null })) };
}
const altered = (value, change) => { const result = clone(value); change(result); return result; };
const base = parse(api.createRectangularPartSource({ width: '32', height: '24', thickness: '8' }));
base.nodes[0].min[0] = -0;
base.nodes[1].height = { op: 'add', left: { parameter: 'thickness' }, right: -0 };
const initial = text(base), initialSummary = summary(base);
const input = { kind: 'cut-pocket', target: capabilities(initial, initialSummary).cutPocket, wall: 8, floor: 4 };
let added, pocket;
function refused(d) { const c = capabilities(text(d), summary(d)); assert.equal(c.cutPocket, null); assert.ok(c.pocketReason); return c; }
await group(pureLedger[0], () => {
  added = build(initial, initialSummary, input); pocket = parse(added.text);
  const wall = { parameter: 'pocketWall' }, floor = { parameter: 'pocketFloor' };
  const subtract = (left, value) => ({ op: 'add', left, right: { op: 'scale', value, factor: -1 } });
  assert.equal(pocket.nodes.length, 5);
  assert.deepEqual(pocket.nodes.slice(2), [
    { kind: 'sketch', profile: 'rectangle', min: [wall, wall], max: base.nodes[0].max.map(v => subtract(v, wall)) },
    { kind: 'extrude', sketch: 2, from: floor, height: subtract(base.nodes[1].height, floor) },
    { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } },
  ]);
  assert.deepEqual(pocket.outputs, { part: { node: 4, side: 'solid' } });
  assert.equal(added.selectedOutput, 'part'); assert.deepEqual(added.consumed, ['part']);
});
await group(pureLedger[1], () => {
  assert.deepEqual(pocket.nodes.slice(0, 2), base.nodes);
  for (const key of Object.keys(base.parameters)) assert.ok(Object.is(pocket.parameters[key], base.parameters[key]));
  assert.ok(Object.is(pocket.nodes[0].min[0], -0)); assert.ok(Object.is(pocket.nodes[1].height.right, -0));
  assert.equal(text(parse(added.text)), added.text); assert.deepEqual(parse(initial), base); assert.deepEqual(initialSummary, summary(base));
  assert.deepEqual(build(initial, initialSummary, input), added);
});
await group(pureLedger[2], () => {
  assert.deepEqual(capabilities(initial, initialSummary).pocketDefaults, { wall: 8, floor: 4 });
  for (const [width, height, thickness, defaults] of [[3, 3, 2, { wall: 1, floor: 1 }], [8, 6, 3, { wall: 2, floor: 2 }], [10000, 10000, 10000, { wall: 8, floor: 4 }]]) {
    const d = altered(base, d => Object.assign(d.parameters, { width, height, thickness }));
    const c = capabilities(text(d), summary(d)); assert.deepEqual(c.pocketDefaults, defaults); assert.ok(c.cutPocket);
  }
  for (const key of ['width', 'height', 'thickness']) for (const value of [0, -0, -1, 0.5, 10001]) refused(altered(base, d => { d.parameters[key] = value; }));
  for (const [key, value] of [['width', 2], ['height', 1], ['thickness', 1]]) assert.equal(refused(altered(base, d => { d.parameters[key] = value; })).pocketDefaults, null);
  for (const key of ['wall', 'floor']) for (const value of [0, -0, -1, 0.5, NaN, Infinity, -Infinity, 10001, Number.MAX_SAFE_INTEGER + 1, '1'])
    assert.throws(() => build(initial, initialSummary, { ...input, [key]: value }));
});
await group(pureLedger[3], () => {
  for (const [wall, floor] of [[12, 4], [13, 4], [16, 4], [8, 8], [8, 9]])
    assert.throws(() => build(initial, initialSummary, { ...input, wall, floor }), /strictly contained/);
  assert.equal(parse(build(initial, initialSummary, { ...input, wall: 11, floor: 7 }).text).parameters.pocketWall, 11);
  const invalidated = altered(base, d => { d.parameters.height = 16; });
  assert.throws(() => build(text(invalidated), summary(invalidated), input), /strictly contained/);
});
await group(pureLedger[4], () => {
  let reads = 0;
  for (const key of ['wall', 'floor', 'target']) {
    const getter = Object.defineProperty({ ...input }, key, { enumerable: true, get() { reads++; return input[key]; } });
    assert.throws(() => build(initial, initialSummary, getter), /own data/);
  }
  for (const value of [{ ...input, extra: true }, { ...input, width: 1 }, { ...input, target: { ...input.target, extra: true } },
    { ...input, [Symbol('hidden')]: true }, Object.defineProperty({ ...input }, 'hidden', { value: true }), Object.create(input)])
    assert.throws(() => build(initial, initialSummary, value));
  assert.equal(capabilities(initial, Object.defineProperty(clone(initialSummary), 'source', { get() { reads++; return 'model'; } })).cutPocket, null);
  const sparse = [0, 1]; delete sparse[0]; assert.throws(() => text(sparse), /dense/); assert.equal(reads, 0);
});
await group(pureLedger[5], () => {
  for (const key of ['pocketWall', 'pocketFloor']) {
    const d = altered(base, d => { d.parameters[key] = 1; }); assert.match(refused(d).pocketReason, /collision/);
    assert.ok(capabilities(text(d), summary(d)).addArm); assert.ok(capabilities(text(d), summary(d)).addHole);
  }
  const independent = altered(base, d => { for (const key of ['armX', 'armY', 'armWidth', 'armHeight', 'holeCenterX', 'holeCenterY', 'holeRadius']) d.parameters[key] = 1; });
  assert.ok(capabilities(text(independent), summary(independent)).cutPocket);
  const maximum = altered(base, d => { for (let i = 0; i < 11; i++) d.parameters['spare' + i] = i; });
  assert.equal(Object.keys(parse(build(text(maximum), summary(maximum), input).text).parameters).length, 16);
  assert.match(refused(altered(maximum, d => { d.parameters.overflow = 1; })).pocketReason, /16-parameter/);
});
await group(pureLedger[6], () => {
  assert.deepEqual(input.target, { name: 'part', solidId: 'controlled_node1', node: 1 });
  for (const target of [{ ...input.target, name: 'old_part' }, { ...input.target, solidId: 'old_id' },
    { ...input.target, node: 0 }, { ...input.target, node: 2 }, { ...input.target, node: -0 }])
    assert.throws(() => build(initial, initialSummary, { ...input, target }), /stale/);
  for (const change of [s => { s.features[1].dependencies = []; }, s => { s.features[1].index = 0; }, s => { s.features.pop(); },
    s => { s.outputs[0].name = 'wrong'; }, s => { s.outputs.push(clone(s.outputs[0])); }, s => { s.parameters.width = 33; },
    s => { s.source = 'legacy'; }, s => { s.suppression = { finish: false }; }]) {
    const wrong = altered(initialSummary, change); assert.equal(capabilities(initial, wrong).cutPocket, null); assert.throws(() => build(initial, wrong, input));
  }
  assert.equal(capabilities(null, null).cutPocket, null);
});
await group(pureLedger[7], () => {
  for (const change of [d => { d.nodes[0].min[0] = 1; }, d => { d.nodes[0].min[1] = -1; },
    d => { d.outputs.blank = d.outputs.part; delete d.outputs.part; }, d => { d.outputs.alias = clone(d.outputs.part); },
    d => { d.nodes[0] = { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 }; },
    d => { d.nodes.push({ kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [1, 0, 0] }); d.outputs.part.node = 2; },
    d => { d.nodes.push({ kind: 'chamfer', parent: { node: 1, side: 'solid' }, edge: {}, distance: 1 }); d.outputs.part.node = 2; }]) {
    const d = altered(base, change), before = text(d); refused(d); assert.equal(text(d), before);
  }
  for (const from of [0, -0, 1]) refused(altered(base, d => { d.nodes[1].from = from; }));
});
await group(pureLedger[8], () => {
  const arm = build(initial, initialSummary, { kind: 'add-arm', target: capabilities(initial, initialSummary).addArm, x: 0, y: 0, width: 8, height: 24 });
  const joined = build(arm.text, summary(parse(arm.text)), { kind: 'union', targets: capabilities(arm.text, summary(parse(arm.text))).union });
  const cut = build(joined.text, summary(parse(joined.text)), { kind: 'cut-slot', target: capabilities(joined.text, summary(parse(joined.text))).cutSlot, x: 16, y: 2, width: 8, height: 4 });
  const hole = build(initial, initialSummary, { kind: 'add-hole', target: capabilities(initial, initialSummary).addHole, x: 16, y: 12, radius: 2.5 });
  assert.deepEqual([arm, joined, cut, hole].map(value => parse(value.text).nodes.length), [4, 5, 8, 3]);
  for (const value of [arm, joined, cut, hole]) { const c = capabilities(value.text, summary(parse(value.text))); assert.equal(c.cutPocket, null); assert.equal(c.pocketAuthored, false); }
  assert.ok(capabilities(arm.text, summary(parse(arm.text))).union);
  assert.ok(capabilities(joined.text, summary(parse(joined.text))).cutSlot);
  for (const kind of ['addArm', 'addHole']) assert.deepEqual(capabilities(initial, initialSummary)[kind], input.target);
  for (const value of [cut, hole]) { const c = capabilities(value.text, summary(parse(value.text))); for (const key of ['addArm', 'addHole', 'union', 'cutSlot']) assert.equal(c[key], null); }
  for (const change of [d => { d.nodes[4].parent.node = 3; }, d => { d.nodes[3].from = 4; }, d => { d.nodes[2].max[0].right.factor = -2; },
    d => { d.outputs.alias = clone(d.outputs.part); }, d => { d.nodes[0].min[0] = { parameter: 'missingOrigin' }; }]) {
    const d = altered(pocket, change); assert.equal(refused(d).pocketAuthored, false);
  }
});
await group(pureLedger[9], () => {
  for (const field of ['max', 'height']) {
    for (const shape of ['depth', 'count']) {
      const driver = { parameter: field === 'max' ? 'width' : 'thickness' };
      const tree = (depth, first) => depth === 0 ? (first ? driver : 0) : { op: 'add', left: tree(depth - 1, first), right: tree(depth - 1, false) };
      let v = driver; if (shape === 'count') v = tree(4, true); else for (let i = 0; i < 5; i++) v = { op: 'add', left: v, right: 0 };
      const wrapping = altered(base, d => { if (field === 'max') d.nodes[0].max[0] = v; else d.nodes[1].height = v; });
      assert.throws(() => build(text(wrapping), summary(wrapping), input), /32 nodes or depth 6/);
    }
  }
  const intermediate = altered(base, d => { d.nodes[0].max[0] = { op: 'add', left: { op: 'scale', value: 10000, factor: 2 }, right: -19968 }; });
  refused(intermediate);
  assert.equal(bytes('a'.repeat(65536)), 65536); assert.throws(() => bytes('a'.repeat(65537)), /64 KiB/);
  assert.equal(bytes('é'.repeat(32768)), 65536); assert.throws(() => bytes('é'.repeat(32769)), /UTF-8/);
  assert.equal(budget([8 * 1024 * 1024 - 3], 1, [1, 1]), 8 * 1024 * 1024);
  assert.throws(() => budget([8 * 1024 * 1024 - 3], 1, [1, 2]), /8 MiB/);
  for (const value of [-1, -0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1']) assert.throws(() => budget([], value, []));
  assert.throws(() => budget(Array(21).fill(0), 0, [])); assert.throws(() => budget([], 0, Array(65).fill(0)));
});
const volume = (x, y, z, w, f) => x * y * z - (x - 2 * w) * (y - 2 * w) * (z - f);
await group(pureLedger[10], () => {
  assert.equal(volume(32, 24, 8, 8, 4), 5632); assert.equal(volume(32, 24, 8, 8, 2), 5376); assert.equal(volume(32, 24, 8, 4, 2), 3840);
  assert.equal(same(initial, added.text), false);
  assert.equal(same(added.text, text(altered(pocket, d => { d.parameters.pocketFloor = 2; }))), true);
  assert.equal(same(added.text, text(altered(pocket, d => { d.nodes[3].from = 2; }))), false);
  assert.equal(same(added.text, text(altered(pocket, d => { d.nodes[0].min[0] = 0; }))), false);
});
await group(pureLedger[11], () => {
  assert.deepEqual(summary(pocket).features.map(f => f.dependencies), [[], [0], [], [2], [1, 3]]);
  const c = refused(pocket); assert.equal(c.pocketAuthored, true); assert.match(c.pocketReason, /second pocket/);
  for (const key of ['addArm', 'addHole', 'union', 'cutSlot', 'cutPocket']) assert.equal(c[key], null);
  assert.throws(() => build(added.text, summary(pocket), input), /second pocket/);
  for (const [key, value] of [['pocketFloor', 0], ['pocketWall', 0], ['pocketFloor', -1], ['pocketWall', 12], ['width', 10001], ['thickness', 0.5]]) {
    const d = altered(pocket, d => { d.parameters[key] = value; }); const c = refused(d); assert.equal(c.pocketAuthored, true, key + value); for (const command of ['addArm', 'addHole', 'union', 'cutSlot', 'cutPocket']) assert.equal(c[command], null);
  }
  assert.equal(capabilities(added.text, altered(summary(pocket), s => { s.features[4].dependencies = [1]; })).pocketAuthored, false);
  // Warning-only ancestry survives a native-accepted edit of an origin driver.
  // This is source/capability evidence; no native acceptance or moved geometry is claimed.
  const originBlank = altered(base, d => { d.parameters.originX = 0; d.nodes[0].min[0] = { parameter: 'originX' }; });
  const originPocket = parse(build(text(originBlank), summary(originBlank), input).text);
  const shifted = altered(originPocket, d => { d.parameters.originX = 1; });
  const shiftedCapabilities = capabilities(text(shifted), summary(shifted));
  assert.equal(shiftedCapabilities.pocketAuthored, true);
  for (const key of ['addArm', 'addHole', 'union', 'cutSlot', 'cutPocket']) assert.equal(shiftedCapabilities[key], null);
  assert.match(shiftedCapabilities.reason, /origin-zero/);
  assert.throws(() => build(text(altered(originBlank, d => { d.parameters.originX = 1; })),
    summary(altered(originBlank, d => { d.parameters.originX = 1; })), input), /origin-zero/);

});

// Retained native authority stays byte-identical. The new expression/source context
// and all edited displays are provider doubles, never new native evidence.
const transferPath = resolve(root, 'packages/barocss-cad/test/modeling-offset-evidence/baseline-transfer.json');
const transferBytes = readFileSync(transferPath), baseline = parse(transferBytes);
const transferSHA256 = 'c0a29404b5ffb8dc66eb9e6f8073b9e1545e94f3fe4c055d65ca95a9ca8fd536';
assert.equal(transferBytes.length, 1514483); assert.equal(hash(transferBytes), transferSHA256);
const native = baseline.bodies.part.native, retainedPacketHash = hash(JSON.stringify(baseline.preview)), nativeBefore = hash(JSON.stringify(baseline));
assert.equal(native.report.volumeMM3, 5632); assert.equal(native.panels.length, 46); assert.equal(baseline.preview.length, 46);
const deeperBytes = readFileSync(resolve(root, 'packages/barocss-cad/test/modeling-offset-evidence/edited.native.json'));
const deeperSHA256 = '6b55d5593d6e5159917e0c1f5b1acba870fcdc12ff96bf786fba71af5a698b89';
assert.equal(hash(deeperBytes), deeperSHA256); assert.equal(parse(deeperBytes).report.volumeMM3, 5376);
const forbidden = () => { throw Error('No native evaluation, unrelated family or STL is permitted in this replay.'); };
let failLoad = false, failEdit = false, mode = null, convexValidationStubs = 0;
const nativeFailure = () => Object.assign(new Error('Explicit mock provider pocket refusal'), { name: 'CadModelError', code: 'NATIVE', operation: 'build' });
function snapshot(data) {
  assert.ok([2, 5].includes(data.nodes.length)); assert.deepEqual(Object.keys(data.outputs), ['part']);
  return { parameters: clone(data.parameters), suppression: {}, features: featureRows(data),
    bodies: { part: clone(data.nodes.length === 2 ? baseline.bodies.plate : baseline.bodies.part) }, save: () => text(data),
    withParameters(changes) { counters.parameterEdits++; if (failEdit) { failEdit = false; throw nativeFailure(); }
      return snapshot({ ...clone(data), parameters: { ...data.parameters, ...changes } }); }, withSuppression: forbidden, exportStl: forbidden };
}
function replayPanel(surface, options) {
  const index = native.panels.findIndex(panel => panel.bundle.topology.face.surfaceId === surface.id);
  const retained = baseline.preview[index], panel = native.panels[index]; assert.ok(retained && panel);
  assert.equal(retained.panelId, panel.id); assert.equal(retained.sourceId, panel.sourceId); assert.equal(retained.surfaceId, surface.id);
  assert.deepEqual(surface, panel.bundle.geometry.objects[0]);
  assert.deepEqual(retained.options, { countU: 2, countV: 2, revision: 0 });
  assert.deepEqual(options, { countU: 2, countV: 2, revision: options.revision });
  assert.ok(Number.isSafeInteger(options.revision) && options.revision >= 0);
  counters.panelReplays++; return clone(retained.result);
}
const gpu = resolve(output, 'gpu-entry.ts');
writeFileSync(gpu, ['engine-scene', 'engine-camera-ray', 'engine-raycast', 'kernel-face-preview']
  .map(name => `export * from ${JSON.stringify(resolve(root, 'packages/barocss-gpu/src', name + '.ts'))};`).join('\n'));
globalThis.__pocketConvexValidationStub = solid => { convexValidationStubs++; return solid.report; };
async function transpile(name, entries, extra = '') {
  const built = await require('esbuild').build({ stdin: { contents: entries.map(value => `export * from ${JSON.stringify(source(value))};`).join('\n') + extra, resolveDir: root },
    bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, alias: { '@barocss/gpu': gpu },
    plugins: [{ name: 'mock-provider-no-native', setup(build) {
      build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'cad', namespace: 'double' }));
      build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'double' }));
      build.onResolve({ filter: /^\.\/convex-planar-solid\.js$/ }, () => ({ path: 'convex', namespace: 'double' }));
      build.onLoad({ filter: /.*/, namespace: 'double' }, args => ({ contents: args.path === 'cad'
        ? 'export const {cad,tessellateSurface,tessellateConvexPlanarSolid,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell}=globalThis.__pocketAuthoringCad;'
        : args.path === 'convex' ? 'export const validateConvexPlanarSolid=globalThis.__pocketConvexValidationStub;'
          : 'export function createPrismFeatureEngine(){return ()=>{throw Error("No legacy native execution");};}' }));
      build.onResolve({ filter: /\.wasm$|\/native-runtime|opencascade/i }, args => { throw Error('Native module is prohibited: ' + args.path); });
    } }] });
  for (const input of Object.keys(built.metafile.inputs)) if (input !== '<stdin>' && !input.startsWith('double:')) {
    assert.ok(!/(?:wasm|convex-planar-solid\.ts$|cad\/src\/index\.ts$)/.test(input), 'No native provider dependency');
    sourceHashes[input] = hash(readFileSync(resolve(root, input)));
  }
  const path = resolve(output, name + '.mjs'); writeFileSync(path, built.outputFiles[0].text);
  writeFileSync(resolve(output, name + '.metafile.json'), JSON.stringify(built.metafile, null, 2) + '\n');
  return import(pathToFileURL(path));
}
const receiving = await transpile('controller', ['modeling-controller'],
  `\nexport { tessellateConvexPlanarSolid } from ${JSON.stringify(resolve(root, 'packages/barocss-cad/src/convex-planar-solid-mesh.ts'))};`);
globalThis.__pocketAuthoringCad = { cad: { model: forbidden, load(sourceText) {
  counters.loads++; if (failLoad) { failLoad = false; throw nativeFailure(); } return snapshot(parse(sourceText));
} }, tessellateSurface: replayPanel,
  tessellateConvexPlanarSolid(body, options) { assert.deepEqual(body, baseline.bodies.plate.native); counters.convexReplays++; return receiving.tessellateConvexPlanarSolid(body, options); },
  tessellateOwnPlateCircularHole: forbidden, tessellateXYCirclePrismShell: forbidden };
const { createModelingEngine } = await transpile('engine', ['modeling-engine']);
const { createCadEditorModelingController } = receiving;
const previousWorker = globalThis.Worker, workers = [], sessions = [], commands = [], replies = [], held = [];
let serial = 10000;
function evaluate(engine, request, route) {
  assert.ok(counters.replies < frozen.controlledReplyLimit, 'Frozen 36 replies: stop before additional evaluation');
  const reply = engine(request); counters.replies++; counters[route === 'direct' ? 'directReplies' : 'workerReplies']++;
  replies.push({ number: counters.replies, group: currentGroup, route, request: request.kind, ok: reply.ok, kind: reply.kind,
    ...(reply.ok ? {} : { message: reply.message }) });
  writeFileSync(resolve(output, 'replies.json'), JSON.stringify(replies, null, 2) + '\n'); return reply;
}
const direct = (worker, request) => evaluate(worker.engine, { ...clone(request), id: ++serial, taskToken: 'direct_' + serial }, 'direct');
globalThis.Worker = class {
  callbacks = {}; engine = createModelingEngine(); terminated = false;
  constructor() { assert.ok(workers.length < frozen.workerLifetimeLimit); workers.push(this); }
  addEventListener(kind, callback) { this.callbacks[kind] = callback; }
  terminate() { this.terminated = true; }
  postMessage(request) {
    const copied = clone(request); commands.push({ worker: workers.length, ...copied });
    const reply = evaluate(this.engine, copied, 'worker'), active = mode?.kind === copied.kind ? mode : null;
    if (active) mode = null; if (typeof active?.action === 'function') active.action(reply);
    let deliveries = 0;
    const deliver = () => { if (deliveries++) { assert.ok(counters.replies < frozen.controlledReplyLimit); counters.replies++; counters.workerReplies++;
      replies.push({ number: counters.replies, group: currentGroup, route: 'duplicate', request: copied.kind, ok: reply.ok }); }
      this.callbacks.message({ data: clone(reply) }); };
    if (active?.action === 'hold') held.push({ request: copied, reply, deliver, worker: this }); else queueMicrotask(deliver);
  }
};
let acceptedHandle = null, visibleHandle = null, handleId = 0;
const port = { async prepare() { return displayHandle(); }, async preparePreview() { return displayHandle(); } };
function displayHandle() {
  const handle = { id: ++handleId, disposed: false, committed: false,
    show() { assert.equal(handle.disposed, false); visibleHandle = handle; },
    commit() { assert.equal(handle.disposed, false); handle.committed = true; acceptedHandle = visibleHandle = handle; },
    dispose() { if (handle.disposed || handle.committed) return; handle.disposed = true; if (visibleHandle === handle) visibleHandle = acceptedHandle; } };
  return handle;
}
const controller = display => { assert.ok(counters.controllers++ < frozen.controllerLifetimeLimit); const value = createCadEditorModelingController(display); sessions.push(value); return value; };
const session = controller(port), state = () => session.getSnapshot();
const authority = () => { const s = state(); return { accepted: s.accepted, authoredText: s.authoredText, display: s.display,
  generation: s.generation, history: s.history, selection: s.selection, faceSelection: s.faceSelection }; };
const retained = (before, handle = acceptedHandle) => { assert.deepEqual(authority(), before); assert.equal(acceptedHandle, handle); assert.equal(visibleHandle, handle); };
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
const command = () => ({ kind: 'cut-pocket', target: capabilities(state().authoredText, state().accepted).cutPocket, wall: 8, floor: 4 });
const preview = async value => { await session.previewStructure(value, state().generation); await flush(); assert.equal(state().preview?.status, 'ready', state().error); };
const promote = async value => { await session.applyStructure(value, state().generation); await flush(); assert.equal(state().error, null); };
let value, beforePreview, initialGeneration, saved, reopened, originalChunks;
try {
  await group(controllerLedger[0], async () => {
    await session.open(initial); assert.equal(state().error, null); assert.equal(state().history.count, 1);
    assert.equal(state().accepted.outputs[0].volumeMM3.numerator, '6144'); assert.equal(counters.convexReplays, 1);
    assert.equal(convexValidationStubs, 1); session.select(1, state().generation); value = command();
  });
  await group(controllerLedger[1], async () => {
    beforePreview = authority(); initialGeneration = state().generation; const handle = acceptedHandle;
    await preview(value); assert.deepEqual(authority(), beforePreview); assert.equal(acceptedHandle, handle); assert.notEqual(visibleHandle, handle);
    assert.equal(state().preview.operation, 'structure'); assert.equal(state().preview.outputs[0].volumeMM3.numerator, '5632');
    assert.equal(counters.panelReplays, 46); assert.equal(state().authoredText, initial);
    assert.equal(commands.at(-1).kind, 'prepare-source');
  });
  await group(controllerLedger[2], async () => {
    const work = [counters.loads, counters.parameterEdits, counters.panelReplays], count = counters.replies;
    await assert.rejects(session.apply(), /structural command/); assert.equal(counters.replies, count);
    await promote(value); assert.deepEqual([counters.loads, counters.parameterEdits, counters.panelReplays], work);
    assert.equal(state().history.count, 2); assert.equal(state().selection, null); assert.equal(state().accepted.features.length, 5);
    const component = state().display.packet.components[0]; assert.equal(component.family, 'orthogonal-cell');
    assert.equal(component.mesh.chunks.length, 46); originalChunks = clone(component.mesh.chunks);
    for (const [index, captured] of baseline.preview.entries()) {
      const chunk = component.mesh.chunks[index]; assert.deepEqual(chunk.positionsMM, captured.result.packet.positions);
      assert.deepEqual(chunk.normals, captured.result.packet.normals); assert.deepEqual(chunk.parametersUV, captured.result.packet.parameters);
      assert.deepEqual(chunk.indices, captured.result.packet.indices);
    }
    assert.equal(state().accepted.outputs[0].volumeMM3.numerator, '5632'); saved = state().authoredText;
    assert.deepEqual(state().accepted.features.map(f => f.dependencies), [[], [0], [], [2], [1, 3]]);
    await assert.rejects(session.applyStructure(value, initialGeneration), /stale/);
  });
  await group(controllerLedger[3], async () => {
    const count = state().history.count, accepted = clone(state().accepted.outputs);
    await session.undo(); assert.equal(state().authoredText, initial); assert.equal(state().history.count, count); assert.equal(state().history.index, 0);
    assert.equal(state().accepted.features.length, 2);
    await session.redo(); assert.equal(state().authoredText, saved); assert.deepEqual(state().accepted.outputs, accepted);
    assert.equal(state().history.index, 1); assert.equal(state().display.selectedOutput, 'part');
    assert.deepEqual(commands.slice(-4).map(r => r.kind), ['prepare-source', 'accept-source', 'prepare-source', 'accept-source']);
  });
  await group(controllerLedger[4], async () => {
    const sourceBefore = state().authoredText, loads = counters.loads, edits = counters.parameterEdits;
    session.stage('pocketFloor', '2'); await session.preview(); assert.equal(state().preview.status, 'ready', state().error);
    assert.equal(state().authoredText, sourceBefore); await session.apply(); assert.equal(state().error, null);
    assert.equal(counters.loads, loads); assert.equal(counters.parameterEdits, edits + 1); assert.equal(state().history.count, 3);
    saved = state().authoredText; assert.equal(parse(saved).parameters.pocketFloor, 2); assert.equal(same(sourceBefore, saved), true);
    assert.deepEqual(state().display.packet.components[0].mesh.chunks, originalChunks, 'Floor2 display is explicitly baseline mock, not retained deeper packets');
    assert.equal(state().accepted.outputs[0].volumeMM3.numerator, '5632', 'Mock provider still reports its unchanged baseline body; native deeper5376 is separate evidence');
    await session.undo(); assert.equal(state().authoredText, sourceBefore);
    await session.redo(); assert.equal(state().authoredText, saved);
    await session.undo(); await session.undo(); assert.equal(state().authoredText, initial); assert.equal(state().history.index, 0);
    value = command();
  });
  await group(controllerLedger[7], async () => {
    const before = authority(), count = counters.replies;
    for (const target of [{ ...value.target, name: 'wrong' }, { ...value.target, solidId: 'stale_native' }, { ...value.target, node: 0 }])
      await assert.rejects(session.previewStructure({ ...value, target }, state().generation), /stale/);
    await assert.rejects(session.previewStructure(value, initialGeneration), /stale/); assert.equal(counters.replies, count);
    await preview(value); const binding = clone(commands.findLast(r => r.kind === 'prepare-source'));
    session.clearPreview(); await flush(); retained(before);
    const loads = counters.loads;
    for (const changes of [{ baseText: initial + ' ' }, { acceptedTaskToken: 'wrong_producer' }, { workerToken: 'wrong_worker' }])
      assert.equal(direct(workers.at(-1), { ...binding, ...changes }).ok, false);
    assert.equal(counters.loads, loads);
    await preview(value); await assert.rejects(session.applyStructure({ ...value, floor: 2 }, state().generation), /Preview the current/);
    session.stage('width', '33'); session.stage('width', '32'); session.discard(); await flush();
    await assert.rejects(session.applyStructure(value, state().generation), /Preview the current/); retained(before); assert.equal(state().preview, null);
  });
  await group(controllerLedger[6], async () => {
    const before = authority(), handle = acceptedHandle; failLoad = true;
    await session.previewStructure(value, state().generation); await flush(); retained(before, handle);
    assert.equal(state().preview.diagnostic.stage, 'native'); assert.match(state().error, /mock provider pocket refusal/);
    mode = { kind: 'prepare-source', action(reply) { assert.equal(reply.ok, true, reply.message);
      // Mutate only copied transport, never the native transfer or retained arrays.
      reply.display.components[0].lineage.operands[1].origin[2] = 0; } };
    await session.previewStructure(value, state().generation); await flush(); retained(before, handle);
    assert.equal(state().preview.diagnostic.stage, 'transport'); assert.match(state().error, /Orthogonal display/);
  });
  await group(controllerLedger[5], async () => {
    const before = authority(); mode = { kind: 'prepare-source', action: 'hold' };
    const pending = session.previewStructure(value, state().generation); await flush(); assert.equal(held.length, 1);
    const late = held.shift(); session.cancel(); await pending; assert.ok(late.worker.terminated);
    late.deliver(); await flush(); retained(before); assert.equal(state().workerReady, false); assert.equal(state().authoredText, initial);
  });
  await group(controllerLedger[8], async () => {
    const before = authority(); assert.equal(text(parse(saved)), saved); assert.equal(bytes(saved), Buffer.byteLength(saved));
    reopened = controller(); await reopened.open(saved); const s = reopened.getSnapshot();
    assert.equal(s.error, null); assert.equal(s.authoredText, saved); assert.equal(s.accepted.features.length, 5);
    assert.equal(s.accepted.parameters.pocketFloor, 2); assert.equal(s.accepted.parameters.pocketWall, 8);
    assert.deepEqual(s.accepted.features.map(f => f.dependencies), [[], [0], [], [2], [1, 3]]);
    assert.deepEqual(s.history, { index: 0, count: 1, canUndo: false, canRedo: false });
    assert.equal(s.accepted.revision, 0); assert.deepEqual(authority(), before);
    assert.deepEqual(s.display.packet.components[0].mesh.chunks, originalChunks);
  });
  await group(controllerLedger[9], async () => {
    const loads = counters.loads; reopened.stage('pocketFloor', '0'); await reopened.preview();
    assert.equal(reopened.getSnapshot().preview.status, 'ready', reopened.getSnapshot().error);
    assert.equal(parse(reopened.getSnapshot().authoredText).parameters.pocketFloor, 2);
    await reopened.apply(); let s = reopened.getSnapshot(); assert.equal(s.error, null);
    assert.equal(parse(s.authoredText).parameters.pocketFloor, 0); assert.equal(s.accepted.parameters.pocketFloor, 0);
    assert.equal(capabilities(s.authoredText, s.accepted).pocketAuthored, true); assert.equal(counters.loads, loads);
    assert.deepEqual(s.display.packet.components[0].mesh.chunks, originalChunks, 'Zero-floor semantics accepted by explicit provider double; display is unchanged baseline, no through-window mesh claim');
    reopened.stage('pocketWall', '0'); await reopened.apply(); s = reopened.getSnapshot(); assert.equal(s.error, null);
    assert.equal(s.accepted.parameters.pocketWall, 0); assert.equal(capabilities(s.authoredText, s.accepted).pocketAuthored, true);
    const count = counters.replies; await assert.rejects(reopened.exportStl('part', s.generation), /convex/); assert.equal(counters.replies, count);
  });
  assert.equal(groups.length, 22); assert.equal(counters.controllers, 2); assert.equal(workers.length, 2); assert.ok(counters.replies <= 36);
  assert.equal(held.length, 0); assert.equal(hash(JSON.stringify(baseline)), nativeBefore); assert.equal(hash(JSON.stringify(baseline.preview)), retainedPacketHash);
  assert.equal(hash(readFileSync(transferPath)), transferSHA256); assert.equal(native.b.shell.origin[2], 4);
  const result = { result: 'PASS', frozen, groups, counters, workerLifetimes: workers.length, newNativeCalls: 0,
    transferSHA256, transferBytes: transferBytes.length, retainedPacketHash, deeperSHA256, scriptSHA256, sourceHashes, replyLog: replies,
    arithmetic: { baseline: 5632, floor2: 5376, wall4floor2: 3840 },
    runtime: { node: process.version, platform: process.platform, architecture: process.arch },
    limitations: ['New sole-part authoring source context, provider and display ownership are mocked; no source-exact native evaluation.',
      'All edited display and summary geometry is unchanged baseline. Separate retained floor2 native volume5376 has no raw display packets; wall4/floor2 arithmetic3840 is unmeasured.',
      'Actual engine serializer/controller/strict CPU receiver run. Blank fans use CPU fan generation with native convex validation explicitly stubbed.',
      'No package build, native campaign, browser/GPU pixels, physical Save/Open chooser or STL execution.',
      'Source budget arithmetic is synthetic; runtime 20-entry eviction and RSS are unverified.'] };
  writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ result: result.result, groups: groups.length, counters, workerLifetimes: workers.length, scriptSHA256, output }));
} finally {
  sessions.forEach(value => value.dispose()); globalThis.Worker = previousWorker;
  delete globalThis.__pocketAuthoringCad; delete globalThis.__pocketConvexValidationStub;
}
