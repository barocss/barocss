// #1966: frozen Pure12 + Controller10. No new native evaluations or full build.
// Sole-part/source/provider context is explicitly mocked. Retained native bodies,
// arrays, UVs, sources and lineage remain unchanged; radius2.5 is baseline-r5 replay.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../..');
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-1966-hole-authoring');
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value), parse = value => JSON.parse(value);
const source = name => resolve(root, 'packages/barocss-cad-editor/src', name + '.ts');
const pureLedger = Object.freeze([
  '01 exact two-to-three nodes and signed prefix', '02 exact target/name/native/node identity',
  '03 exact summary dependencies/output inventory', '04 integer origin-zero plate and omitted from',
  '05 decimal centers and radius5/radius2.5', '06 finite radius/center and strict endpoint bounds',
  '07 independent three-name reservation and parameter16', '08 descriptor/unknown-field refusal',
  '09 owned hole dependency/consumption/no second hole', '10 unsupported ancestry/source unchanged',
  '11 full-source versus parameter identity', '12 unchanged source/body budgets and no-op bounds',
]);
const controllerLedger = Object.freeze([
  '01 genuine baseline packet with mocked authored context', '02 preview authority and one promotion',
  '03 discard restores accepted display', '04 wrong target/base/source/producer and stale generation',
  '05 stale/duplicate discard, changed command and draft ABA', '06 provider exact-UV and receiver refusal',
  '07 structural Undo/Redo exact source and output', '08 failed Undo, lost accept and late Cancel recovery',
  '09 accepted source bytes and cold reload', '10 radius2.5 existing parameter path and unavailable volume/STL',
]);
const frozen = { pureLedger, controllerLedger, controllerLifetimeLimit: 2, workerLifetimeLimit: 4, controlledReplyLimit: 36,
  countPolicy: 'Every engine return, including failed/held/discard/recovery replies, counts once; repeat deliveries count again. Assert before evaluation. No native calls.',
  geometryPolicy: 'New sole-part authoring context/provider are mocked. Unchanged genuine radius5 baseline replays all edited geometry, including radius2.5.',
  sourceBudgetPolicy: 'Synthetic 8-MiB arithmetic and production source-slot accounting only; no runtime 20-entry eviction/RSS qualification.' };
writeFileSync(resolve(output, 'frozen-ledger.json'), JSON.stringify(frozen, null, 2) + '\n');
const scriptSHA256 = hash(readFileSync(import.meta.filename)), sourceHashes = {}, groups = [];
const counters = { replies: 0, directReplies: 0, workerReplies: 0, controllers: 0, loads: 0, parameterEdits: 0, blankReplays: 0, holeReplays: 0 };
let currentGroup = 'setup';
async function group(name, run) {
  currentGroup = name; const before = counters.replies;
  try { await run(); groups.push({ name, result: 'PASS', replies: counters.replies - before }); console.log(JSON.stringify(groups.at(-1))); }
  catch (cause) {
    const error = { group: name, message: String(cause), stack: cause.stack, counters, scriptSHA256, sourceHashes };
    if (!existsSync(resolve(output, 'first-error.json'))) writeFileSync(resolve(output, 'first-error.json'), JSON.stringify(error, null, 2) + '\n');
    writeFileSync(resolve(output, 'latest-error.json'), JSON.stringify(error, null, 2) + '\n'); throw cause;
  }
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
const base = parse(api.createRectangularPartSource({ width: '80', height: '40', thickness: '8' }));
base.nodes[0].min[0] = -0;
base.nodes[1].height = { op: 'add', left: { parameter: 'thickness' }, right: -0 };
const initial = text(base), initialSummary = summary(base);
const input = { kind: 'add-hole', target: capabilities(initial, initialSummary).addHole, x: 40, y: 20, radius: 5 };
let added, hole;
function refused(d) { const result = capabilities(text(d), summary(d)); assert.equal(result.addHole, null); assert.ok(result.holeReason); return result; }
await group(pureLedger[0], () => {
  added = build(initial, initialSummary, input); hole = parse(added.text);
  assert.equal(hole.nodes.length, 3); assert.deepEqual(hole.nodes.slice(0, 2), base.nodes);
  assert.deepEqual(hole.nodes[2], { kind: 'hole', parent: { node: 1, side: 'solid' },
    center: [{ parameter: 'holeCenterX' }, { parameter: 'holeCenterY' }], radius: { parameter: 'holeRadius' } });
  assert.deepEqual(hole.outputs, { part: { node: 2, side: 'solid' } });
  for (const key of Object.keys(base.parameters)) assert.ok(Object.is(hole.parameters[key], base.parameters[key]));
  assert.ok(Object.is(hole.nodes[0].min[0], -0)); assert.ok(Object.is(hole.nodes[1].height.right, -0));
  assert.equal(text(parse(added.text)), added.text); assert.deepEqual(parse(initial), base); assert.deepEqual(initialSummary, summary(base));
});
await group(pureLedger[1], () => {
  assert.deepEqual(input.target, { name: 'part', solidId: 'controlled_node1', node: 1 });
  for (const target of [{ ...input.target, name: 'old_part' }, { ...input.target, solidId: 'old_id' },
    { ...input.target, node: 0 }, { ...input.target, node: 2 }, { ...input.target, node: -0 }])
    assert.throws(() => build(initial, initialSummary, { ...input, target }), /stale/);
  refused(altered(base, d => { d.outputs.blank = d.outputs.part; delete d.outputs.part; }));
  refused(altered(base, d => { d.outputs.alias = clone(d.outputs.part); }));
});
await group(pureLedger[2], () => {
  const variants = [s => { s.features[1].dependencies = []; }, s => { s.features[1].index = 0; },
    s => { s.features.pop(); }, s => { s.outputs[0].name = 'wrong'; }, s => { s.outputs.push(clone(s.outputs[0])); },
    s => { s.parameters.width = 81; }, s => { s.source = 'legacy'; }, s => { s.suppression = { finish: false }; }];
  for (const change of variants) {
    const s = altered(initialSummary, change); assert.equal(capabilities(initial, s).addHole, null);
    assert.throws(() => build(initial, s, input));
  }
  assert.equal(capabilities(null, null).addHole, null);
});
await group(pureLedger[3], () => {
  for (const name of ['width', 'height', 'thickness']) for (const value of [0, -0, -1, 0.5, 10001])
    refused(altered(base, d => { d.parameters[name] = value; }));
  refused(altered(base, d => { d.nodes[0].min[0] = 1; }));
  refused(altered(base, d => { d.nodes[0].min[1] = -1; }));
  for (const from of [0, -0, 1]) refused(altered(base, d => { d.nodes[1].from = from; }));
  const large = altered(base, d => { d.parameters = { width: 10000, height: 10000, thickness: 10000 }; });
  assert.ok(capabilities(text(large), summary(large)).addHole);
  assert.ok(capabilities(text(altered(base, d => { d.parameters.thickness = 9; })), summary(altered(base, d => { d.parameters.thickness = 9; }))).addHole);
});
await group(pureLedger[4], () => {
  for (const radius of [5, 2.5, 0.001]) {
    const result = parse(build(initial, initialSummary, { ...input, x: 40.25, y: 19.75, radius }).text);
    assert.deepEqual([result.parameters.holeCenterX, result.parameters.holeCenterY, result.parameters.holeRadius], [40.25, 19.75, radius]);
  }
  // Necessary input checks are not native tessellation or exact-UV qualification.
  assert.equal(parse(build(initial, initialSummary, { ...input, radius: 19.999 }).text).parameters.holeRadius, 19.999);
});
await group(pureLedger[5], () => {
  for (const radius of [0, -0, -1, 0.000999, Number.MIN_VALUE, NaN, Infinity, -Infinity, 10001, 20, 10000])
    assert.throws(() => build(initial, initialSummary, { ...input, radius }));
  for (const key of ['x', 'y']) for (const value of [NaN, Infinity, -Infinity, 10001, -10001, -0, 0, -1])
    assert.throws(() => build(initial, initialSummary, { ...input, [key]: value }));
  for (const [x, y] of [[5, 20], [75, 20], [40, 5], [40, 35]])
    assert.throws(() => build(initial, initialSummary, { ...input, x, y }), /strictly contained/);
  // With centers <=10000 and radius >=.001, representable endpoints cannot collapse.
  // Sub-ULP radii are refused at the radius floor; the implementation still checks endpoints explicitly.
  assert.throws(() => build(initial, initialSummary, { ...input, x: 9999, radius: Number.EPSILON }), /radius/);
});
await group(pureLedger[6], () => {
  for (const key of ['holeCenterX', 'holeCenterY', 'holeRadius']) {
    const d = altered(base, d => { d.parameters[key] = 1; }); assert.match(refused(d).holeReason, /collision/);
    assert.ok(capabilities(text(d), summary(d)).addArm);
  }
  const armCollision = altered(base, d => { for (const key of ['armX', 'armY', 'armWidth', 'armHeight']) d.parameters[key] = 1; });
  assert.equal(capabilities(text(armCollision), summary(armCollision)).addArm, null);
  assert.ok(capabilities(text(armCollision), summary(armCollision)).addHole);
  const maximum = altered(base, d => { for (let i = 0; i < 10; i++) d.parameters['spare' + i] = i; });
  assert.equal(Object.keys(parse(build(text(maximum), summary(maximum), input).text).parameters).length, 16);
  assert.match(refused(altered(maximum, d => { d.parameters.overflow = 1; })).holeReason, /16-parameter/);
});
await group(pureLedger[7], () => {
  let reads = 0;
  const getter = Object.defineProperty({ ...input }, 'x', { enumerable: true, get() { reads++; return 40; } });
  assert.throws(() => build(initial, initialSummary, getter), /own data/);
  for (const value of [{ ...input, extra: true }, { ...input, width: 1 }, { ...input, radius: '5' },
    { ...input, target: { ...input.target, extra: true } }, { ...input, [Symbol('hidden')]: true },
    Object.defineProperty({ ...input }, 'hidden', { value: true })]) assert.throws(() => build(initial, initialSummary, value));
  const sparse = [0, 1]; delete sparse[0]; assert.throws(() => text(sparse), /dense/);
  assert.equal(capabilities(initial, Object.defineProperty(clone(initialSummary), 'source', { get() { reads++; return 'model'; } })).addHole, null);
  assert.equal(reads, 0); assert.deepEqual(input, { kind: 'add-hole', target: input.target, x: 40, y: 20, radius: 5 });
});
await group(pureLedger[8], () => {
  assert.deepEqual(summary(hole).features.map(f => f.dependencies), [[], [0], [1]]);
  const c = capabilities(added.text, summary(hole)); assert.equal(c.addHole, null); assert.equal(c.sharedThickness, 8);
  assert.match(c.holeReason, /second hole/); assert.equal(c.addArm, null); assert.equal(c.union, null); assert.equal(c.cutSlot, null);
  assert.equal(added.selectedOutput, 'part'); assert.deepEqual(added.consumed, ['part']);
  assert.throws(() => build(added.text, summary(hole), input), /second hole/);
  for (const dependencies of [[], [0], [1, 2]]) assert.match(capabilities(added.text,
    altered(summary(hole), s => { s.features[2].dependencies = dependencies; })).holeReason, /ownership/);
});
await group(pureLedger[9], () => {
  const variants = [d => { d.nodes[0] = { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 }; },
    d => { d.nodes.push({ kind: 'translate', parent: { node: 1, side: 'solid' }, offset: [1, 0, 0] }); d.outputs.part.node = 2; },
    d => { d.nodes.push({ kind: 'union', left: { node: 1, side: 'solid' }, right: { node: 1, side: 'solid' } }); d.outputs.part.node = 2; },
    d => { d.nodes.push({ kind: 'chamfer', parent: { node: 1, side: 'solid' }, edge: {}, distance: 1 }); d.outputs.part.node = 2; }];
  for (const change of variants) { const d = altered(base, change), before = text(d); refused(d); assert.equal(text(d), before); }
  refused(altered(hole, d => { d.nodes[2].parent.node = 0; }));
  refused(altered(hole, d => { d.nodes[2].radius = 5; }));
  refused(altered(hole, d => { d.outputs.alias = clone(d.outputs.part); }));
  assert.deepEqual(parse(initial), base);
});
await group(pureLedger[10], () => {
  assert.equal(same(initial, added.text), false);
  assert.equal(same(added.text, text(altered(hole, d => { d.parameters.holeRadius = 2.5; }))), true);
  assert.equal(same(added.text, text(altered(hole, d => { d.nodes[2].radius = 2.5; }))), false);
  assert.equal(same(added.text, text(altered(hole, d => { d.outputs.part.node = 1; }))), false);
  assert.equal(same(added.text, text(altered(hole, d => { d.nodes[0].min[0] = 0; }))), false);
  assert.equal(same(added.text, text(altered(hole, d => { d.parameters.extra = 0; }))), false);
});
await group(pureLedger[11], () => {
  assert.equal(bytes('a'.repeat(65536)), 65536); assert.throws(() => bytes('a'.repeat(65537)), /64 KiB/);
  assert.equal(bytes('é'.repeat(32768)), 65536); assert.throws(() => bytes('é'.repeat(32769)), /UTF-8/);
  assert.equal(budget([8 * 1024 * 1024 - 3], 1, [1, 1]), 8 * 1024 * 1024);
  assert.throws(() => budget([8 * 1024 * 1024 - 3], 1, [1, 2]), /8 MiB/);
  assert.equal(budget([100, 100], 100, [100, 100]), 500);
  assert.equal(budget(Array(20).fill(65536), 65536, [65536, 65536, 65536]), 24 * 65536);
  for (const invalid of [-1, -0, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1']) assert.throws(() => budget([], invalid, []));
  assert.throws(() => budget(Array(21).fill(0), 0, [])); assert.throws(() => budget([], 0, Array(65).fill(0)));
  assert.deepEqual(build(initial, initialSummary, input), added, 'pure repeat is deterministic and has no side effect');
  const many = altered(hole, d => { while (d.nodes.length < 9) d.nodes.push(clone(d.nodes[2])); });
  assert.equal(capabilities(text(many), summary(many)).addHole, null);
  // Preserve old structural paths within this group, without a broad old-feature campaign.
  const arm = build(initial, initialSummary, { kind: 'add-arm', target: capabilities(initial, initialSummary).addArm, x: 0, y: 0, width: 8, height: 24 });
  const joined = build(arm.text, summary(parse(arm.text)), { kind: 'union', targets: capabilities(arm.text, summary(parse(arm.text))).union });
  const cut = build(joined.text, summary(parse(joined.text)), { kind: 'cut-slot', target: capabilities(joined.text, summary(parse(joined.text))).cutSlot, x: 16, y: 2, width: 8, height: 4 });
  assert.deepEqual([arm, joined, cut].map(result => parse(result.text).nodes.length), [4, 5, 8]);
});

// Actual serializer + strict CPU receiver, controlled Worker/provider/display boundaries.
const fixturePath = resolve(import.meta.dirname, 'fixtures/modeling-hole/baseline-native.json');
const fixtureBytes = readFileSync(fixturePath), native = parse(fixtureBytes);
const fixtureSHA256 = '3ee3d585448a24ad6d8fcdbc3cddd927eb6e13b399db6a707444940080fc4024';
assert.equal(hash(fixtureBytes), fixtureSHA256); const nativeBefore = hash(JSON.stringify(native));
const forbidden = () => { throw Error('No native evaluation, unrelated family or STL is permitted in this replay.'); };
let failLoad = false, failEdit = false, mode = null;
const nativeFailure = () => Object.assign(new Error('Mock provider exact stored UV composition refusal'), { name: 'CadModelError', code: 'NATIVE', operation: 'build' });
function snapshot(data) {
  assert.ok([2, 3].includes(data.nodes.length)); assert.deepEqual(Object.keys(data.outputs), ['part']);
  return { parameters: clone(data.parameters), suppression: {}, features: featureRows(data),
    bodies: { part: clone(data.nodes.length === 2 ? native.bodies.blank : native.bodies.plate) }, save: () => text(data),
    withParameters(changes) { counters.parameterEdits++; if (failEdit) { failEdit = false; throw nativeFailure(); }
      return snapshot({ ...clone(data), parameters: { ...data.parameters, ...changes } }); }, withSuppression: forbidden, exportStl: forbidden };
}
globalThis.__holeAuthoringCad = { cad: { model: forbidden, load(sourceText) {
  counters.loads++; if (failLoad) { failLoad = false; throw nativeFailure(); } return snapshot(parse(sourceText));
} }, tessellateConvexPlanarSolid(bundle) { assert.deepEqual(bundle, native.bodies.blank.native); counters.blankReplays++; return clone(native.blankMesh); },
  tessellateOwnPlateCircularHole(bundle, { context }) { assert.deepEqual(bundle, native.bodies.plate.native.bundle); counters.holeReplays++;
    const value = clone(native.holeMesh); value.mesh.context = clone(context); return value; },
  tessellateSurface: forbidden, tessellateXYCirclePrismShell: forbidden };
const gpu = resolve(output, 'gpu-entry.ts');
writeFileSync(gpu, ['engine-scene', 'engine-camera-ray', 'engine-raycast', 'kernel-face-preview']
  .map(name => `export * from ${JSON.stringify(resolve(root, 'packages/barocss-gpu/src', name + '.ts'))};`).join('\n'));
async function transpile(name, entries) {
  const built = await require('esbuild').build({ stdin: { contents: entries.map(value => `export * from ${JSON.stringify(source(value))};`).join('\n'), resolveDir: root },
    bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, alias: { '@barocss/gpu': gpu },
    plugins: [{ name: 'mock-provider-no-native', setup(build) {
      build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'cad', namespace: 'double' }));
      build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'double' }));
      build.onLoad({ filter: /.*/, namespace: 'double' }, args => ({ contents: args.path === 'cad'
        ? 'export const {cad,tessellateSurface,tessellateConvexPlanarSolid,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell}=globalThis.__holeAuthoringCad;'
        : 'export function createPrismFeatureEngine(){return ()=>{throw Error("No legacy native execution");};}' }));
      build.onResolve({ filter: /\.wasm$|\/native-runtime|opencascade/i }, args => { throw Error('Native module is prohibited: ' + args.path); });
    } }] });
  for (const input of Object.keys(built.metafile.inputs)) if (input !== '<stdin>' && !input.startsWith('double:')) sourceHashes[input] = hash(readFileSync(resolve(root, input)));
  const path = resolve(output, name + '.mjs'); writeFileSync(path, built.outputFiles[0].text); return import(pathToFileURL(path));
}
const { createModelingEngine } = await transpile('engine', ['modeling-engine']);
const { createCadEditorModelingController } = await transpile('controller', ['modeling-controller']);
const previous = { Worker: globalThis.Worker, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
const workers = [], sessions = [], commands = [], replies = [], held = [], timers = new Set();
let serial = 10000;
function evaluate(engine, request, route) {
  assert.ok(counters.replies < frozen.controlledReplyLimit, 'Frozen 36 replies: stop before additional evaluation');
  const reply = engine(request); counters.replies++; counters[route === 'direct' ? 'directReplies' : 'workerReplies']++;
  replies.push({ number: counters.replies, group: currentGroup, route, request: request.kind, ok: reply.ok, kind: reply.kind,
    ...(reply.ok ? {} : { message: reply.message }) }); return reply;
}
const direct = (worker, request) => evaluate(worker.engine, { ...clone(request), id: ++serial, taskToken: 'direct_' + serial }, 'direct');
globalThis.setTimeout = callback => { const timer = { callback }; timers.add(timer); return timer; };
globalThis.clearTimeout = timer => timers.delete(timer);
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
const command = () => ({ kind: 'add-hole', target: capabilities(state().authoredText, state().accepted).addHole, x: 40, y: 20, radius: 5 });
const preview = async (value, recover = false) => { await session.previewStructure(value, state().generation, recover); await flush(); assert.equal(state().preview?.status, 'ready', state().error); };
const promote = async value => { await session.applyStructure(value, state().generation); await flush(); assert.equal(state().error, null); };
let value, beforePreview, initialGeneration, staleBinding, saved, reopened;
try {
  await group(controllerLedger[0], async () => {
    await session.open(initial); assert.equal(state().error, null); assert.equal(state().history.count, 1);
    assert.equal(state().accepted.outputs[0].volumeMM3.numerator, '25600');
    session.select(1, state().generation); beforePreview = authority(); initialGeneration = state().generation; value = command();
    await preview(value); assert.deepEqual(authority(), beforePreview); assert.equal(state().preview.outputs[0].volumeMM3, null);
    const packet = commands.at(-1); assert.equal(packet.kind, 'prepare-source');
    assert.equal(state().preview.operation, 'structure'); assert.notEqual(visibleHandle, acceptedHandle);
    // Promotion in group2 exposes the exact genuine packet to the strict CPU receiver.
  });
  await group(controllerLedger[1], async () => {
    const work = [counters.loads, counters.parameterEdits, counters.holeReplays], count = counters.replies;
    await assert.rejects(session.apply(), /structural command/); assert.equal(counters.replies, count);
    await promote(value); assert.deepEqual([counters.loads, counters.parameterEdits, counters.holeReplays], work);
    assert.equal(state().history.count, 2); assert.equal(state().selection, null); assert.equal(state().accepted.features.length, 3);
    const component = state().display.packet.components[0]; assert.equal(component.family, 'stored-rational-plate-hole');
    assert.deepEqual(component.preview.mesh.chunks, native.holeMesh.mesh.chunks); assert.deepEqual(component.preview.provenance, native.holeMesh.provenance);
    assert.deepEqual(component.preview.report, native.holeMesh.report); assert.equal(component.preview.report.faceCount, 7);
    assert.equal(state().accepted.outputs[0].volumeMM3, null); saved = state().authoredText;
    await assert.rejects(session.applyStructure(value, initialGeneration), /stale/); assert.equal(state().history.count, 2);
  });
  await group(controllerLedger[2], async () => {
    await session.undo(); assert.equal(state().authoredText, initial); const before = authority(), handle = acceptedHandle;
    value = command(); await preview(value); staleBinding = clone(commands.findLast(r => r.kind === 'prepare-source'));
    session.clearPreview(); await flush(); retained(before, handle); assert.equal(state().preview, null);
  });
  await group(controllerLedger[3], async () => {
    const before = authority(), count = counters.replies, work = counters.loads;
    for (const target of [{ ...value.target, name: 'wrong' }, { ...value.target, solidId: 'stale_native' }, { ...value.target, node: 0 }])
      await assert.rejects(session.previewStructure({ ...value, target }, state().generation), /stale/);
    await assert.rejects(session.previewStructure(value, initialGeneration), /stale/); assert.equal(counters.replies, count);
    for (const changes of [{ baseText: initial + ' ' }, { acceptedTaskToken: 'wrong_producer' }, { text: initial }]) {
      const reply = direct(workers.at(-1), { ...staleBinding, ...changes }); assert.equal(reply.ok, false);
    }
    assert.equal(counters.loads, work); retained(before);
  });
  await group(controllerLedger[4], async () => {
    const before = authority(); await preview(value);
    const stale = { workerToken: staleBinding.workerToken, acceptedTaskToken: staleBinding.acceptedTaskToken,
      expectedRevision: staleBinding.expectedRevision, candidateToken: staleBinding.candidateToken, previewTaskToken: staleBinding.taskToken };
    for (let i = 0; i < 2; i++) assert.equal(direct(workers.at(-1), { kind: 'discard-preview', binding: stale }).kind, 'preview-discarded');
    assert.equal(state().preview.status, 'ready'); await assert.rejects(session.applyStructure({ ...value, radius: 2.5 }, state().generation), /Preview the current/);
    session.stage('width', '81'); session.stage('width', '80'); session.discard(); await flush();
    await assert.rejects(session.applyStructure(value, state().generation), /Preview the current/); retained(before); assert.equal(state().preview, null);
  });
  await group(controllerLedger[5], async () => {
    const before = authority(), handle = acceptedHandle; failLoad = true;
    await session.previewStructure(value, state().generation); await flush(); retained(before, handle);
    assert.equal(state().preview.diagnostic.stage, 'native'); assert.match(state().error, /exact stored UV/);
    mode = { kind: 'prepare-source', action(reply) { assert.equal(reply.ok, true, reply.message);
      // Deliberate copied transport tamper, never a retained native source/array mutation.
      reply.display.components[0].preview.provenance[4].nativeLoopIds.pop(); } };
    await session.previewStructure(value, state().generation); await flush(); retained(before, handle);
    assert.equal(state().preview.diagnostic.stage, 'transport'); assert.ok(state().error);
  });
  await group(controllerLedger[6], async () => {
    await preview(value); await promote(value); saved = state().authoredText; const output = clone(state().accepted.outputs), count = state().history.count;
    await session.undo(); assert.equal(state().authoredText, initial); assert.equal(state().history.count, count); assert.equal(state().history.index, 0);
    assert.equal(state().display.packet.components[0].role, 'part'); assert.equal(state().accepted.features.length, 2);
    await session.redo(); assert.equal(state().authoredText, saved); assert.deepEqual(state().accepted.outputs, output);
    assert.equal(state().history.index, 1); assert.equal(state().display.selectedOutput, 'part'); assert.equal(state().selection, null);
    assert.deepEqual(commands.slice(-4).map(r => r.kind), ['prepare-source', 'accept-source', 'prepare-source', 'accept-source']);
  });
  await group(controllerLedger[7], async () => {
    let before = authority(); failLoad = true; await session.undo(); await flush(); retained(before);
    assert.equal(state().preview.diagnostic.stage, 'native'); await session.undo(); assert.equal(state().authoredText, initial);
    value = command(); before = authority(); await preview(value); mode = { kind: 'accept-source', action: 'hold' };
    const pending = session.applyStructure(value, state().generation); assert.equal(held.length, 1); const lost = held.shift();
    assert.equal(timers.size, 1); [...timers][0].callback(); await pending; retained(before);
    assert.equal(lost.worker.terminated, true); assert.equal(state().workerReady, false); lost.deliver(); await flush(); retained(before);
    const count = counters.replies; await assert.rejects(session.previewStructure(value, state().generation), /explicitly/); assert.equal(counters.replies, count);
    mode = { kind: 'prepare-source', action: 'hold' }; const cancelled = session.previewStructure(value, state().generation, true);
    await flush(); assert.equal(held.length, 1); const late = held.shift(); session.cancel(); await cancelled;
    assert.equal(late.worker.terminated, true); late.deliver(); await flush(); retained(before); assert.equal(state().workerReady, false);
  });
  await group(controllerLedger[8], async () => {
    const before = authority(); assert.equal(text(parse(saved)), saved); assert.equal(bytes(saved), Buffer.byteLength(saved));
    reopened = controller(); await reopened.open(saved); const s = reopened.getSnapshot();
    assert.equal(s.error, null); assert.equal(s.authoredText, saved); assert.equal(s.accepted.features.length, 3);
    assert.deepEqual(Object.keys(s.accepted.parameters).sort(), ['height', 'holeCenterX', 'holeCenterY', 'holeRadius', 'thickness', 'width']);
    assert.deepEqual(s.accepted.features.map(f => f.dependencies), [[], [0], [1]]); assert.equal(s.history.count, 1); assert.equal(s.history.canUndo, false);
    assert.equal(s.accepted.revision, 0); assert.deepEqual(authority(), before);
  });
  await group(controllerLedger[9], async () => {
    const loads = counters.loads, edits = counters.parameterEdits; reopened.stage('holeRadius', '2.5'); await reopened.apply();
    const s = reopened.getSnapshot(); assert.equal(s.error, null); assert.equal(s.accepted.parameters.holeRadius, 2.5);
    assert.equal(counters.loads, loads); assert.equal(counters.parameterEdits, edits + 1); assert.equal(s.history.count, 2);
    assert.equal(parse(s.authoredText).nodes[2].radius.parameter, 'holeRadius'); assert.equal(s.accepted.outputs[0].volumeMM3, null);
    assert.deepEqual(s.display.packet.components[0].preview.mesh.chunks, native.holeMesh.mesh.chunks, 'Explicit unchanged r5 replay, not retessellated r2.5');
    const count = counters.replies; await assert.rejects(reopened.exportStl('part', s.generation), /convex/);
    reopened.stage('holeRadius', '2.50'); await reopened.apply(); assert.equal(counters.replies, count); assert.equal(reopened.getSnapshot().history.count, 2);
    reopened.stage('width', '81'); const before = reopened.getSnapshot(); failEdit = true; await reopened.apply();
    const refused = reopened.getSnapshot(); assert.match(refused.error, /exact stored UV/); assert.equal(refused.authoredText, before.authoredText);
    assert.deepEqual(refused.history, before.history); assert.deepEqual(refused.display, before.display); assert.equal(refused.drafts.width, '81');
  });
  assert.equal(groups.length, 22); assert.equal(counters.controllers, 2); assert.ok(workers.length <= 4); assert.ok(counters.replies <= 36);
  assert.equal(held.length, 0); assert.equal(timers.size, 0); assert.equal(hash(JSON.stringify(native)), nativeBefore); assert.equal(hash(readFileSync(fixturePath)), fixtureSHA256);
  const result = { result: 'PASS', frozen, groups, counters, workerLifetimes: workers.length, newNativeCalls: 0,
    fixtureSHA256, fixtureBytes: fixtureBytes.length, scriptSHA256, sourceHashes, replyLog: replies,
    runtime: { node: process.version, platform: process.platform, architecture: process.arch },
    limitations: ['New sole-part source context and provider are mocked; no source-exact native evaluation.',
      'All changed geometry, including radius2.5, is unchanged genuine radius5 baseline replay.',
      'Actual serializer/controller/strict CPU receiver run; native provider, Worker and display ownership are doubles.',
      'No package build, native campaign, browser/GPU pixels, physical Save/Open chooser or STL execution.',
      'Source budget arithmetic is synthetic; runtime 20-entry eviction and RSS are unverified.'] };
  writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify({ result: result.result, groups: groups.length, counters, workerLifetimes: workers.length, scriptSHA256 }));
} finally {
  sessions.forEach(value => value.dispose()); globalThis.Worker = previous.Worker;
  globalThis.setTimeout = previous.setTimeout; globalThis.clearTimeout = previous.clearTimeout; delete globalThis.__holeAuthoringCad;
}
