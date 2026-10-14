// #1960 frozen Transaction18: actual engine, controller, serializers and CPU scene receiver.
// cad.load/save/withParameters, Worker transport and display ownership are controlled doubles.
// Rectangle/arm/Union/Cut native bodies use the full retained #1695 native
// transfer and all 14 parent + 44 final raw samples. Native sources, signed zeros, UVs,
// lineage and array inventories are NEVER rewritten to match this new authored context.
// Global parameters/+0 and new command graphs are explicitly adapted provider context;
// ALL edited geometry remains unchanged retained geometry, not source-exact native proof.
// The actual convex CPU fan algorithm runs with its native validator explicitly mocked.
// No new native evaluation, package build, GPU, browser, STL or physical verification.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../..');
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-1960-structure-history');
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const source = name => resolve(root, 'packages/barocss-cad-editor/src', name + '.ts');
const scriptSHA256 = sha256(readFileSync(import.meta.filename));
const ledger = Object.freeze([
  '01 baseline/structural prepare accepted unchanged',
  '02 promotion producer/zero repeat',
  '03 Add-to-Union same-map Undo',
  '04 parameter edit before/after graph',
  '05 Cut-to-Undo-to-Redo output identity',
  '06 monotonic revision',
  '07 failed Undo preserves cursor/redo',
  '08 redo truncation success only',
  '09 cross-kind replace',
  '10 stale base cannot clear new slot',
  '11 source/output ABA',
  '12 stale/duplicate discard',
  '13 cancel/late reply',
  '14 native/receiver refusal',
  '15 display prepare/commit refusal',
  '16 lost accept acknowledgement/recovery',
  '17 pre-load source budget/post-success-only history changes',
  '18 accepted save/cold Open reset/legacy unchanged',
]);
const frozen = { ledger, controllerLifetimeLimit: 2, controlledReplyLimit: 60,
  countPolicy: 'Every direct engine return and every Worker response, including failed, recovery, accept, discard and held/late replies, counts. Duplicate deliveries count again.',
  sourceBudgetControl: 'Synthetic 8-MiB arithmetic and production 24 x 64-KiB upper bound; runtime 20-entry eviction is not executed within this finite ledger.' };
writeFileSync(resolve(output, 'frozen-ledger.json'), JSON.stringify(frozen, null, 2) + '\n');

const fixtureSpecs = [
  ['composition', 'packages/barocss-cad/test/modeling-composition-evidence/baseline-transfer.json', '9a8ac520f0d4577b3a7e0ff411182e1c176eaaf8c73ac75073c129ae6380b79f'],
  ['parentSamples', 'packages/barocss-cad-editor/scripts/fixtures/modeling-composition/bracket-preview.json', '419397690a131dd229e1cd03bf112227f529d91a468905c691088b710091544c'],
];
const fixtures = {}, fixtureHashes = {};
for (const [name, path, expected] of fixtureSpecs) {
  const bytes = readFileSync(resolve(root, path)); assert.equal(sha256(bytes), expected);
  fixtures[name] = JSON.parse(bytes); fixtureHashes[path] = { sha256: expected, bytes: bytes.length };
}
assert.equal(fixtures.parentSamples.status, 'PASS');
assert.equal(fixtures.parentSamples.tessellationAttempts, 14);
const rawPackets = [...fixtures.parentSamples.preview, ...fixtures.composition.preview];
assert.equal(rawPackets.length, 58);
const nativeFixturesBefore = sha256(JSON.stringify(fixtures));
const nativeBodies = { 1: { family: 'convex-planar', native: fixtures.composition.evidence[1].native.solid },
  3: { family: 'convex-planar', native: fixtures.composition.evidence[3].native.solid },
  4: fixtures.composition.bodies.bracket, 7: fixtures.composition.bodies.slotted };

const counters = { controlledReplies: 0, workerReplies: 0, directReplies: 0, duplicateDeliveries: 0,
  loads: 0, parameterEdits: 0, convexFans: 0, convexValidationMocks: 0, rawSurfaceReplays: 0,
  displayPrepares: 0, previewPrepares: 0, shows: 0, commits: 0, controllerLifetimes: 0 };
const replyLog = [], workLog = [], sourceHashes = {}, groups = [], revisionEvents = [];
let currentGroup = 'setup', nextLoadFailure = null, nextEditFailure = null;
let mode = null, failPrepare = false, failCommit = false;
const forbidden = () => { throw Error('No native evaluation or unrelated provider family is permitted in this replay.'); };
const nativeFailure = () => Object.assign(new Error('Mock provider refused the structural reconstruction'),
  { name: 'CadModelError', code: 'NATIVE', operation: 'build' });
function mockSnapshot(data) {
  const snapshot = {
    parameters: clone(data.parameters), suppression: {},
    features: data.nodes.map((node, index) => ({ kind: node.kind, index, dependencies: node.kind === 'sketch' ? []
      : node.kind === 'extrude' ? [node.sketch] : node.kind === 'union' ? [node.left.node, node.right.node] : [node.parent.node, node.tool.node] })),
    bodies: Object.fromEntries(Object.entries(data.outputs).map(([name, ref]) => {
      assert.ok(nativeBodies[ref.node], 'Retained geometry must be available without fabricating IDs or provenance');
      return [name, clone(nativeBodies[ref.node])];
    })),
    save: () => canonical(data),
    withParameters(changes) {
      counters.parameterEdits++; workLog.push({ operation: 'withParameters', source: sha256(snapshot.save()), changes: clone(changes) });
      if (nextEditFailure) { const failure = nextEditFailure; nextEditFailure = null; throw failure; }
      const edited = clone(data); Object.assign(edited.parameters, changes); return mockSnapshot(edited);
    },
    withSuppression: forbidden, exportStl: forbidden,
  };
  return snapshot;
}
function replaySurface(surface, options) {
  assert.deepEqual(options, { countU: 2, countV: 2, revision: options.revision });
  assert.ok(Number.isSafeInteger(options.revision));
  const entry = rawPackets.find(packet => packet.surfaceId === surface.id);
  assert.ok(entry, 'Every Surface sample must come from an actual full retained raw capture');
  const body = entry.panelId.startsWith('m4_') ? fixtures.composition.bodies.bracket.native : fixtures.composition.bodies.slotted.native;
  const retainedSource = body.sources.find(value => value.sourceId === entry.sourceId);
  assert.ok(retainedSource); assert.equal(retainedSource.panelId, entry.panelId);
  assert.deepEqual(retainedSource.model.objects.find(value => value.kind === 'surface' && value.id === entry.surfaceId), surface);
  assert.deepEqual(entry.options, { countU: 2, countV: 2, revision: 0 });
  counters.rawSurfaceReplays++; return clone(entry.result);
}
globalThis.__structureHistoryCad = {
  cad: { model: forbidden, load(text) {
    counters.loads++; workLog.push({ operation: 'load', source: sha256(text), nodeCount: JSON.parse(text).nodes.length });
    if (nextLoadFailure && (!nextLoadFailure.nodes || nextLoadFailure.nodes === JSON.parse(text).nodes.length)) {
      const failure = nextLoadFailure.error; nextLoadFailure = null; throw failure;
    }
    return mockSnapshot(JSON.parse(text));
  } },
  tessellateSurface: replaySurface,
  tessellateConvexPlanarSolid(native, options) {
    assert.ok([nativeBodies[1].native.report.solidId, nativeBodies[3].native.report.solidId].includes(native.report.solidId));
    const retained = native.report.solidId === nativeBodies[1].native.report.solidId ? nativeBodies[1].native : nativeBodies[3].native;
    assert.deepEqual(native, retained); counters.convexFans++; return fan(native, options);
  }, tessellateOwnPlateCircularHole: forbidden, tessellateXYCirclePrismShell: forbidden,
};
globalThis.__structureHistoryValidateConvex = native => { counters.convexValidationMocks++; return native.report; };
let legacyReply;
globalThis.__structureHistoryLegacy = () => () => { assert.ok(legacyReply); return clone(legacyReply); };
const gpu = resolve(output, 'gpu-entry.ts');
writeFileSync(gpu, ['engine-scene', 'engine-camera-ray', 'engine-raycast', 'kernel-face-preview']
  .map(name => `export * from ${JSON.stringify(resolve(root, 'packages/barocss-gpu/src', name + '.ts'))};`).join('\n'));
async function transpile(name, entries, extra = '') {
  const built = await require('esbuild').build({ stdin: { contents: entries.map(value => `export * from ${JSON.stringify(source(value))};`).join('\n') + extra, resolveDir: root },
    bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, alias: { '@barocss/gpu': gpu },
    plugins: [{ name: 'explicit-retained-provider-no-native', setup(build) {
      build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'cad', namespace: 'double' }));
      build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'double' }));
      build.onResolve({ filter: /\/convex-planar-solid\.js$/ }, () => ({ path: 'validator', namespace: 'double' }));
      build.onLoad({ filter: /.*/, namespace: 'double' }, args => ({ contents: args.path === 'cad'
        ? 'export const {cad,tessellateSurface,tessellateConvexPlanarSolid,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell}=globalThis.__structureHistoryCad;'
        : args.path === 'legacy' ? 'export const createPrismFeatureEngine=globalThis.__structureHistoryLegacy;'
          : 'export const validateConvexPlanarSolid=globalThis.__structureHistoryValidateConvex;' }));
      build.onResolve({ filter: /\.wasm$|\/native-runtime|opencascade/i }, args => { throw Error('Native module is prohibited: ' + args.path); });
    } }] });
  for (const input of Object.keys(built.metafile.inputs)) if (input !== '<stdin>' && !input.startsWith('double:')) {
    const path = resolve(root, input); sourceHashes[input] = sha256(readFileSync(path));
    assert.ok(!/\.wasm$|native-runtime|opencascade/i.test(input));
  }
  const path = resolve(output, name + '.mjs'); writeFileSync(path, built.outputFiles[0].text);
  return import(pathToFileURL(path));
}
const api = await transpile('controller', ['modeling-controller', 'modeling-structure', 'modeling-rectangular-part', 'modeling-scene'],
  `\nexport {tessellateConvexPlanarSolid} from ${JSON.stringify(resolve(root, 'packages/barocss-cad/src/convex-planar-solid-mesh.ts'))};`);
const canonical = api.canonicalModelingText, fan = api.tessellateConvexPlanarSolid;
const { createModelingEngine } = await transpile('engine', ['modeling-engine']);
const initial = canonical(JSON.parse(api.createRectangularPartSource({ width: '32', height: '8', thickness: '8' })));
const work = () => [counters.loads, counters.parameterEdits, counters.rawSurfaceReplays, counters.convexFans];
function recordedReply(route, command, reply) {
  assert.ok(counters.controlledReplies < 60, 'Frozen 60 total controlled response ceiling; do not raise it');
  counters.controlledReplies++; counters[route === 'worker' ? 'workerReplies' : 'directReplies']++;
  replyLog.push({ number: counters.controlledReplies, group: currentGroup, route, request: command.kind,
    id: command.id, requestToken: command.taskToken, result: reply.ok, reply: reply.kind ?? 'display',
    ...(reply.summary ? { revision: reply.summary.revision, source: sha256(reply.text), outputs: reply.summary.outputs.map(value => [value.name, value.solidId]) } : {}),
    ...(reply.binding ? { producerToken: reply.binding.previewTaskToken } : {}), ...(reply.ok ? {} : { message: reply.message }) });
}
const previous = { Worker: globalThis.Worker, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
const timers = new Set(), workers = [], commands = [], held = [], sessions = [];
globalThis.setTimeout = callback => { const timer = { callback }; timers.add(timer); return timer; };
globalThis.clearTimeout = timer => timers.delete(timer);
globalThis.Worker = class {
  callbacks = {}; engine = createModelingEngine(); terminated = false;
  constructor() { workers.push(this); }
  addEventListener(kind, callback) { this.callbacks[kind] = callback; }
  terminate() { this.terminated = true; }
  postMessage(command) {
    const copied = clone(command); commands.push({ worker: workers.indexOf(this) + 1, ...copied });
    assert.ok(counters.controlledReplies < 60, 'Refuse evaluation before frozen reply budget is exceeded');
    const reply = this.engine(copied), active = mode?.kind === command.kind ? mode : null;
    if (active) mode = null;
    if (typeof active?.action === 'function') active.action(reply);
    recordedReply('worker', copied, reply);
    let deliveries = 0;
    const deliver = () => {
      if (deliveries++) { counters.duplicateDeliveries++; recordedReply('worker', copied, reply); }
      this.callbacks.message({ data: clone(reply) });
    };
    if (active?.action === 'hold') held.push({ command: copied, reply, deliver, worker: this }); else queueMicrotask(deliver);
  }
};
let acceptedHandle = null, visibleHandle = null, handleId = 0;
function displayHandle(preview) {
  const handle = { id: ++handleId, disposed: false, committed: false,
    show() { assert.ok(preview); assert.equal(handle.disposed, false); visibleHandle = handle; counters.shows++; },
    commit() {
      if (failCommit) { failCommit = false; throw Error('Mock display commit refusal before ownership swap'); }
      assert.equal(handle.disposed, false); acceptedHandle = visibleHandle = handle; handle.committed = true; counters.commits++;
    },
    dispose() { if (handle.disposed || handle.committed) return; handle.disposed = true; if (visibleHandle === handle) visibleHandle = acceptedHandle; },
  }; return handle;
}
const port = {
  async prepare() { counters.displayPrepares++; return displayHandle(false); },
  async preparePreview() {
    counters.previewPrepares++; if (failPrepare) { failPrepare = false; throw Error('Mock display prepare refusal'); }
    return displayHandle(true);
  },
};
function controller(displayPort) {
  assert.ok(counters.controllerLifetimes++ < 2, 'Frozen two-controller-lifetime ceiling');
  const value = api.createCadEditorModelingController(displayPort); sessions.push(value); return value;
}
const session = controller(port);
const state = () => session.getSnapshot();
const authority = () => {
  const value = state(); return { accepted: value.accepted, authoredText: value.authoredText, display: value.display,
    generation: value.generation, history: value.history, selection: value.selection, faceSelection: value.faceSelection };
};
session.subscribe(() => {
  const value = state(), prior = revisionEvents.at(-1);
  if (value.accepted?.source === 'model' && (!prior || prior.generation !== value.generation))
    revisionEvents.push({ generation: value.generation, revision: value.accepted.revision, source: value.authoredText,
      outputs: value.accepted.outputs.map(output => [output.name, output.solidId]) });
});
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
const command = kind => {
  const capabilities = api.getModelingStructureCapabilities(state().authoredText, state().accepted);
  if (kind === 'union') { assert.ok(capabilities.union, capabilities.reason); return { kind, targets: capabilities.union }; }
  const target = kind === 'add-arm' ? capabilities.addArm : capabilities.cutSlot;
  assert.ok(target, capabilities.reason);
  return { kind, target, x: kind === 'add-arm' ? 0 : 16, y: kind === 'add-arm' ? 0 : 2,
    width: 8, height: kind === 'add-arm' ? 24 : 4 };
};
const preview = async (value, recover = false) => {
  await session.previewStructure(value, state().generation, recover); await flush();
  assert.equal(state().preview?.status, 'ready', state().error);
};
const promote = async value => { await session.applyStructure(value, state().generation); await flush(); assert.equal(state().error, null); };
const structure = async kind => { const value = command(kind); await preview(value); await promote(value); return value; };
let sequence = 10000;
const direct = (engine, kind, fields = {}) => {
  const request = { id: ++sequence, taskToken: 'direct_' + sequence, kind, ...fields };
  assert.ok(counters.controlledReplies < 60, 'Frozen reply budget before direct engine evaluation');
  const reply = engine(request); recordedReply('direct', request, reply); return reply;
};
function assertRetained(before, handle = acceptedHandle) {
  assert.deepEqual(authority(), before); assert.equal(acceptedHandle, handle); assert.equal(visibleHandle, handle);
}
async function group(index, run) {
  currentGroup = ledger[index]; const start = counters.controlledReplies;
  try {
    await run(); await flush(); groups.push({ name: currentGroup, result: 'PASS', replies: counters.controlledReplies - start });
    console.log(JSON.stringify(groups.at(-1)));
  } catch (cause) {
    const failure = { group: currentGroup, message: cause.message, stack: cause.stack, counters, replyLog, sourceHashes, scriptSHA256 };
    if (!existsSync(resolve(output, 'first-error.json'))) writeFileSync(resolve(output, 'first-error.json'), JSON.stringify(failure, null, 2) + '\n');
    writeFileSync(resolve(output, 'latest-error.json'), JSON.stringify(failure, null, 2) + '\n'); throw cause;
  }
}
let arm, addSource, addGeneration, oldUnion, unionSource, unionGeneration, cutSource, cutCommand;
let engine, engineBase, engineArm, engineParameter, sourceCandidate, historyCandidate, engineAccepted;
const baseRequest = accepted => ({ workerToken: 'direct_worker', acceptedTaskToken: accepted.token,
  expectedRevision: accepted.reply.summary.revision, candidateToken: 'candidate_' + (sequence + 1) });
try {
  await group(0, async () => {
    await session.open(initial); assert.equal(state().error, null); assert.equal(state().history.count, 1);
    // A real controller parameter transition before adding a graph, with explicitly mocked geometry.
    session.stage('width', '40'); await session.apply(); assert.equal(state().accepted.parameters.width, 40);
    const before = authority(), handle = acceptedHandle, previousWork = work(); arm = command('add-arm');
    await preview(arm); assert.deepEqual(authority(), before); assert.equal(acceptedHandle, handle); assert.notEqual(visibleHandle, handle);
    assert.equal(state().preview.operation, 'structure'); assert.equal(counters.loads, previousWork[0] + 1);
    assert.deepEqual(JSON.parse(state().authoredText).nodes, JSON.parse(initial).nodes);
    assert.equal(state().history.count, 2); assert.equal(JSON.parse(state().authoredText).nodes.length, 2);
  });
  await group(1, async () => {
    const beforeWork = work(), preparedBy = commands.findLast(value => value.kind === 'prepare-source').taskToken;
    const acceptedBeforePlainApply = authority(), requestsBeforePlainApply = commands.length;
    await assert.rejects(session.apply(), /current structural command/);
    assert.deepEqual(authority(), acceptedBeforePlainApply); assert.equal(commands.length, requestsBeforePlainApply);
    await promote(arm); assert.deepEqual(work(), beforeWork); assert.equal(state().history.count, 3);
    assert.equal(state().accepted.features.length, 4); assert.deepEqual(state().accepted.outputs.map(value => value.name), ['arm', 'part']);
    addSource = state().authoredText; addGeneration = state().generation;
    const count = commands.length; await assert.rejects(session.applyStructure(arm, addGeneration - 1), /stale/); assert.equal(commands.length, count);
    oldUnion = command('union'); await preview(oldUnion);
    assert.equal(commands.findLast(value => value.kind === 'prepare-source').acceptedTaskToken, preparedBy,
      'Next request binds to the original preview producer, never the accept message token');
  });
  await group(2, async () => {
    await promote(oldUnion); unionSource = state().authoredText; unionGeneration = state().generation;
    assert.deepEqual(JSON.parse(unionSource).parameters, JSON.parse(addSource).parameters);
    const before = work(), cursor = state().history.index; await session.undo(); await flush();
    assert.equal(state().error, null); assert.equal(state().authoredText, addSource); assert.equal(state().history.index, cursor - 1);
    assert.equal(state().history.canRedo, true); assert.equal(counters.loads, before[0] + 1); assert.equal(counters.parameterEdits, before[1]);
    assert.deepEqual(commands.slice(-2).map(value => value.kind), ['prepare-source', 'accept-source']);
    assert.equal(commands.at(-2).operation, 'history'); assert.equal(state().selection, null); assert.equal(state().faceSelection, null);
  });
  await group(3, async () => {
    const before = work(); session.stage('width', '48'); await session.apply();
    assert.equal(state().accepted.parameters.width, 48); assert.equal(state().history.canRedo, false);
    await session.undo(); assert.equal(state().authoredText, addSource); assert.equal(counters.loads, before[0]);
    assert.equal(counters.parameterEdits, before[1] + 2); assert.deepEqual(commands.slice(-2).map(value => value.kind), ['apply', 'apply']);
    assert.ok(state().generation > addGeneration); assert.equal(state().accepted.features.length, 4);
  });
  await group(4, async () => {
    await structure('union'); unionSource = state().authoredText; unionGeneration = state().generation;
    const unionOutput = clone(state().accepted.outputs[0]), beforePanels = counters.rawSurfaceReplays;
    cutCommand = await structure('cut-slot'); cutSource = state().authoredText;
    assert.equal(counters.rawSurfaceReplays - beforePanels, 58, 'Final-only Cut replays parent14 plus final44');
    assert.equal(state().accepted.features.length, 8); assert.deepEqual(state().accepted.outputs.map(value => value.name), ['part']);
    assert.equal(state().display.selectedOutput, 'part'); assert.equal(state().accepted.outputs[0].volumeMM3.numerator, '2816');
    const finalOutput = clone(state().accepted.outputs[0]); assert.notEqual(finalOutput.solidId, unionOutput.solidId);
    await session.undo(); assert.equal(state().authoredText, unionSource); assert.deepEqual(state().accepted.outputs[0], unionOutput);
    assert.equal(state().display.selectedOutput, 'part'); await session.redo(); assert.equal(state().authoredText, cutSource);
    assert.deepEqual(state().accepted.outputs[0], finalOutput); assert.equal(state().display.selectedOutput, 'part');
    assert.equal(state().selection, null); assert.equal(state().faceSelection, null);
  });
  await group(5, () => {
    assert.ok(revisionEvents.length >= 10);
    for (let index = 1; index < revisionEvents.length; index++) {
      assert.equal(revisionEvents[index].revision, revisionEvents[index - 1].revision + 1);
      assert.ok(revisionEvents[index].generation > revisionEvents[index - 1].generation);
    }
    const transitions = commands.filter(value => value.kind === 'prepare-source' && value.operation === 'history');
    assert.ok(transitions.length >= 3); assert.ok(transitions.every(value => value.expectedRevision >= 0));
  });
  await group(6, async () => {
    const before = authority(), handle = acceptedHandle; nextLoadFailure = { nodes: 5, error: nativeFailure() };
    await session.undo(); await flush(); assertRetained(before, handle); assert.equal(state().preview.diagnostic.stage, 'native');
    assert.match(state().error, /Mock provider/); assert.equal(state().history.canRedo, before.history.canRedo);
  });
  await group(7, async () => {
    await session.undo(); assert.equal(state().authoredText, unionSource); assert.equal(state().history.canRedo, true);
    session.stage('width', '48'); const before = authority(); nextEditFailure = nativeFailure(); await session.apply();
    assertRetained(before); assert.equal(state().history.canRedo, true); assert.equal(state().drafts.width, '48');
    await session.apply(); assert.equal(state().error, null); assert.equal(state().accepted.parameters.width, 48);
    assert.equal(state().history.canRedo, false); assert.equal(state().history.count, before.history.index + 2);
  });
  await group(8, () => {
    engine = createModelingEngine(); const opened = direct(engine, 'open', { text: initial, taskToken: 'direct_accepted' });
    assert.equal(opened.ok, true, opened.message); engineBase = { reply: opened, token: 'direct_accepted' };
    const capabilities = api.getModelingStructureCapabilities(opened.text, opened.summary);
    engineArm = { kind: 'add-arm', target: capabilities.addArm, x: 0, y: 0, width: 8, height: 24 };
    engineParameter = direct(engine, 'prepare-preview', { ...baseRequest(engineBase), parameters: { width: 40 } });
    assert.equal(engineParameter.ok, true, engineParameter.message);
    const expected = api.buildModelingStructure(opened.text, opened.summary, engineArm);
    sourceCandidate = direct(engine, 'prepare-source', { ...baseRequest(engineBase), baseText: opened.text,
      operation: 'structure', text: expected.text, command: engineArm });
    assert.equal(sourceCandidate.ok, true, sourceCandidate.message);
    assert.equal(direct(engine, 'accept-preview', { binding: engineParameter.binding, parameters: { width: 40 } }).ok, false);
  });
  await group(9, () => {
    const before = work(); const stale = direct(engine, 'prepare-source', { ...baseRequest(engineBase), baseText: engineBase.reply.text + ' ',
      operation: 'structure', text: sourceCandidate.text, command: engineArm });
    assert.equal(stale.ok, false); assert.match(stale.message, /source changed/); assert.deepEqual(work(), before);
    assert.equal(direct(engine, 'accept-source', { binding: sourceCandidate.binding, operation: 'history', text: sourceCandidate.text }).ok, false);
    assert.equal(direct(engine, 'accept-source', { binding: sourceCandidate.binding, operation: 'structure', text: sourceCandidate.text + ' ' }).ok, false);
    assert.deepEqual(work(), before, 'Wrong operation/text cannot evaluate or consume the current candidate');
  });
  await group(10, async () => {
    const repeats = revisionEvents.filter(value => value.source === addSource);
    assert.ok(repeats.length >= 2); assert.ok(repeats.at(-1).generation > repeats[0].generation);
    const returnedUnion = revisionEvents.filter(value => value.source === unionSource);
    assert.ok(returnedUnion.length >= 2); assert.deepEqual(returnedUnion.at(-1).outputs, returnedUnion[0].outputs);
    const count = commands.length; await assert.rejects(session.previewStructure(cutCommand, unionGeneration), /stale/);
    assert.equal(commands.length, count);
    assert.equal(direct(engine, 'accept-source', { binding: { ...sourceCandidate.binding, previewTaskToken: engineParameter.binding.previewTaskToken },
      operation: 'structure', text: sourceCandidate.text }).ok, false);
  });
  await group(11, () => {
    for (let i = 0; i < 2; i++) assert.equal(direct(engine, 'discard-preview', { binding: engineParameter.binding }).kind, 'preview-discarded');
    const before = work(), ack = direct(engine, 'accept-source', { binding: sourceCandidate.binding, operation: 'structure', text: sourceCandidate.text });
    assert.equal(ack.kind, 'preview-accepted'); assert.deepEqual(work(), before);
    assert.equal(direct(engine, 'accept-source', { binding: sourceCandidate.binding, operation: 'structure', text: sourceCandidate.text }).ok, false);
    engineAccepted = { reply: sourceCandidate, token: sourceCandidate.binding.previewTaskToken };
    // Reverse replacement: source-history then parameters share the same slot too.
    historyCandidate = direct(engine, 'prepare-source', { ...baseRequest(engineAccepted), baseText: sourceCandidate.text, operation: 'history', text: initial });
    assert.equal(historyCandidate.ok, true, historyCandidate.message);
    const parameters = direct(engine, 'prepare-preview', { ...baseRequest(engineAccepted), parameters: { width: 48 } });
    assert.equal(parameters.ok, true, parameters.message);
    assert.equal(direct(engine, 'accept-source', { binding: historyCandidate.binding, operation: 'history', text: initial }).ok, false);
    assert.equal(direct(engine, 'accept-preview', { binding: parameters.binding, parameters: { width: 48 } }).kind, 'preview-accepted');
    engineAccepted = { reply: parameters, token: parameters.binding.previewTaskToken };
  });
  await group(12, async () => {
    const before = authority(), handle = acceptedHandle, value = command('cut-slot');
    mode = { kind: 'prepare-source', action: 'hold' }; const pending = session.previewStructure(value, state().generation);
    assert.equal(held.length, 1); const late = held.shift(); session.cancel(); await pending;
    assert.equal(late.worker.terminated, true); assert.equal(state().workerReady, false); assertRetained(before, handle);
    late.deliver(); await flush(); assertRetained(before, handle); assert.equal(state().preview, null);
  });
  await group(13, async () => {
    const before = authority(), value = command('cut-slot'); nextLoadFailure = { nodes: 8, error: nativeFailure() };
    await session.previewStructure(value, state().generation, true); await flush(); assertRetained(before);
    assert.equal(state().preview.diagnostic.stage, 'native'); assert.equal(state().workerReady, true);
    mode = { kind: 'prepare-source', action: reply => {
      assert.equal(reply.ok, true, reply.message);
      // Deliberate transport tamper, never a change to the retained native fixture.
      reply.display.components[0].mesh.chunks[0].positionsMM[0] += 1;
    } };
    const shown = counters.shows; await session.previewStructure(value, state().generation); await flush();
    assertRetained(before); assert.equal(counters.shows, shown); assert.ok(state().error); assert.equal(state().preview.diagnostic.stage, 'transport');
  });
  await group(14, async () => {
    const before = authority(), value = command('cut-slot'); failPrepare = true;
    await session.previewStructure(value, state().generation); await flush(); assertRetained(before);
    assert.equal(state().preview.diagnostic.stage, 'display'); assert.match(state().error, /prepare refusal/);
    await preview(value); const doomed = workers.at(-1); failCommit = true; await session.applyStructure(value, state().generation); await flush();
    assertRetained(before); assert.match(state().error, /commit refusal/); assert.equal(doomed.terminated, true); assert.equal(state().workerReady, false);
  });
  await group(15, async () => {
    const before = authority(), value = command('cut-slot'); await preview(value, true);
    mode = { kind: 'accept-source', action: 'hold' }; const pending = session.applyStructure(value, state().generation);
    assert.equal(held.length, 1); const lost = held.shift(); assert.equal(timers.size, 1);
    [...timers][0].callback(); await pending; assertRetained(before); assert.equal(lost.worker.terminated, true); assert.equal(state().workerReady, false);
    lost.deliver(); await flush(); assertRetained(before);
    const count = commands.length; await assert.rejects(session.previewStructure(value, state().generation), /explicitly/); assert.equal(commands.length, count);
    await preview(value, true); assert.deepEqual(authority(), before); await promote(value);
    assert.equal(state().accepted.features.length, 8); assert.equal(state().accepted.revision, before.accepted.revision + 1);
    assert.equal(state().history.count, before.history.count + 1); assert.equal(state().history.canRedo, false);
  });
  await group(16, () => {
    const before = work(), oversized = ' '.repeat(65537);
    const reply = direct(engine, 'prepare-source', { ...baseRequest(engineAccepted), baseText: engineAccepted.reply.text,
      operation: 'history', text: oversized });
    assert.equal(reply.ok, false); assert.match(reply.message, /64 KiB/); assert.deepEqual(work(), before);
    assert.equal(api.modelingSourceBudget([8 * 1024 * 1024 - 3], 1, [1, 1]), 8 * 1024 * 1024);
    assert.throws(() => api.modelingSourceBudget([8 * 1024 * 1024 - 3], 1, [1, 2]), /8 MiB/);
    const maximumSourceSlots = api.modelingSourceBudget(Array(20).fill(65536), 65536, [65536, 65536, 65536]);
    assert.equal(maximumSourceSlots, 24 * 65536); assert.ok(maximumSourceSlots < 8 * 1024 * 1024);
    assert.equal(state().history.count, 6); assert.equal(state().history.index, 5);
    // Failure/Preview retention and successful redo truncation were exercised in groups 1, 7, 8 and 13-16.
    // This arithmetic is synthetic; it is neither near-limit real model evidence nor an RSS guarantee.
    // Runtime eviction at exactly 20 entries is intentionally not claimed or executed.
  });
  await group(17, async () => {
    const saved = state().authoredText, savedHistory = clone(state().history), savedRevision = state().accepted.revision;
    const reopened = controller(); await reopened.open(saved); assert.equal(reopened.getSnapshot().error, null);
    assert.equal(reopened.getSnapshot().authoredText, saved); assert.equal(reopened.getSnapshot().history.count, 1);
    assert.equal(reopened.getSnapshot().history.canUndo, false); assert.equal(reopened.getSnapshot().accepted.revision, 0);
    assert.ok(savedRevision > 0); assert.deepEqual(state().history, savedHistory);
    reopened.stage('slotWidth', '12'); await reopened.apply(); assert.equal(reopened.getSnapshot().accepted.parameters.slotWidth, 12);
    const noOp = commands.length; reopened.stage('slotWidth', '12.0'); await reopened.apply(); assert.equal(commands.length, noOp);
    assert.equal(reopened.getSnapshot().history.count, 2);
    const document = JSON.parse(readFileSync(resolve(root, 'apps/cad-editor/src/fixtures/affine-prism.authored.json')));
    const display = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixtures/convex-display.packet.json')));
    const fraction = { numerator: '1', denominator: '1' };
    legacyReply = { ok: true, text: JSON.stringify(document), summary: { document,
      dependencies: document.nodes.map(node => ({ nodeId: node.id, dependsOn: [] })), components: display.outcomes, selectedWalls: [],
      volumes: { parent: fraction, first: fraction, second: fraction, remaining: fraction, removed: fraction } },
      display: { ...display, documentId: document.id, revision: document.revision } };
    await session.open(legacyReply.text); assert.equal(state().error, null); assert.equal(state().accepted.source, 'legacy');
    assert.equal(state().history.count, 1); session.stage('upperX', '24'); const before = authority(), count = commands.length;
    await assert.rejects(session.preview(), /legacy/); assert.deepEqual(authority(), before);
    assert.equal(commands.length, count); assert.equal(state().drafts.upperX, '24');
  });
  assert.equal(groups.length, 18); assert.ok(counters.controlledReplies <= 60); assert.equal(counters.controllerLifetimes, 2);
  assert.equal(held.length, 0); assert.equal(timers.size, 0); assert.equal(sha256(JSON.stringify(fixtures)), nativeFixturesBefore);
  for (const [path, receipt] of Object.entries(fixtureHashes)) assert.equal(sha256(readFileSync(resolve(root, path))), receipt.sha256);
  const result = { result: 'PASS', ledger: frozen, groups, counters, workerLifetimes: workers.length,
    workerTerminations: workers.filter(value => value.terminated).length, newNativeCalls: 0, runtime20EntryEvictionExecuted: false,
    runtime: { node: process.version, platform: process.platform, architecture: process.arch }, scriptSHA256, sourceHashes, fixtureHashes,
    controlledReplyLog: replyLog, providerWorkLog: workLog,
    limitations: [
      'Provider source context is adapted, not source-exact native evidence; all changed-state geometry is mocked with unchanged retained bodies.',
      'Actual engine serializers, controller transactions and strict CPU receiver execute; native validator, provider, Worker and display ownership are doubles.',
      'All 58 retained raw samples are replayed for final-only Cut. No truncation or native provenance/UV/source rewrite is used.',
      '8-MiB arithmetic is synthetic. Production source upper-bound proof is 24 x 64 KiB; runtime 20-entry eviction and native RSS are unverified.',
      'No package build, native reconstruction, GPU/browser pixels, physical geometry, STL or user file dialog is exercised.',
    ] };
  writeFileSync(resolve(output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ result: result.result, groups: groups.length, counters, workerLifetimes: workers.length, scriptSHA256, runtime: result.runtime }));
} finally {
  for (const value of sessions) value.dispose();
  globalThis.Worker = previous.Worker; globalThis.setTimeout = previous.setTimeout; globalThis.clearTimeout = previous.clearTimeout;
  delete globalThis.__structureHistoryCad; delete globalThis.__structureHistoryValidateConvex; delete globalThis.__structureHistoryLegacy;
}
