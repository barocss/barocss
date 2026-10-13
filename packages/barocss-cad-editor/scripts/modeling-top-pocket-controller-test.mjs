// #1826: actual serializer/receiver/controller, mocked Worker and provider only.
// Genuine #1724 part packets are unchanged. Operand fans and every edited-state
// display are explicitly baseline mocks; this script never loads native CAD.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../..');
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-1826-top-pocket-controller');
mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const hash = value => createHash('sha256').update(value).digest('hex');
const transferPath = 'packages/barocss-cad/test/modeling-offset-evidence/baseline-transfer.json';
const transferBytes = readFileSync(resolve(root, transferPath));
const transferSHA256 = 'c0a29404b5ffb8dc66eb9e6f8073b9e1545e94f3fe4c055d65ca95a9ca8fd536';
assert.equal(transferBytes.length, 1514483);
assert.equal(hash(transferBytes), transferSHA256);
const baseline = JSON.parse(transferBytes), authored = JSON.parse(baseline.text);
const native = baseline.bodies.part.native;
assert.deepEqual(baseline.parameters, { depth: 4, toolSpanY: 8, toolY: 8 });
assert.equal(native.b.shell.origin[2], 4);
assert.equal(native.report.operation, 'difference');
assert.equal(native.report.volumeMM3, 5632);
assert.equal(native.panels.length, 46);
assert.equal(baseline.preview.length, 46);
const retainedPacketHash = hash(JSON.stringify(baseline.preview));

const gpu = resolve(output, 'gpu-entry.ts');
writeFileSync(gpu, ['engine-scene', 'engine-camera-ray', 'engine-raycast', 'kernel-face-preview']
  .map(name => `export * from ${JSON.stringify(resolve(root, `packages/barocss-gpu/src/${name}.ts`))};`).join('\n'));
const source = name => resolve(root, `packages/barocss-cad-editor/src/${name}.ts`);
const entry = ['modeling-controller', 'modeling-scene', 'modeling-union']
  .map(name => `export * from ${JSON.stringify(source(name))};`).join('\n')
  + `\nexport { raycastEngineScene } from ${JSON.stringify(gpu)};`
  + `\nexport { tessellateConvexPlanarSolid } from ${JSON.stringify(resolve(root, 'packages/barocss-cad/src/convex-planar-solid-mesh.ts'))};`;
let convexValidationStubs = 0;
globalThis.__topPocketConvexValidationStub = solid => { convexValidationStubs++; return solid.report; };
const receiverBundle = await require('esbuild').build({
  stdin: { contents: entry, resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false,
  metafile: true, alias: { '@barocss/gpu': gpu },
  plugins: [{ name: 'explicit-topology-derived-fan-mocks', setup(build) {
    build.onResolve({ filter: /^@barocss\/cad$/ }, () => { throw Error('No runtime native CAD import is permitted.'); });
    build.onResolve({ filter: /^\.\/convex-planar-solid\.js$/ }, () => ({ path: 'validator', namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({
      contents: 'export const validateConvexPlanarSolid = globalThis.__topPocketConvexValidationStub;',
    }));
  } }],
});
writeFileSync(resolve(output, 'receiver.mjs'), receiverBundle.outputFiles[0].text);
const api = await import(pathToFileURL(resolve(output, 'receiver.mjs')));

// Canonical codec substitute belongs only to the mocked provider. The real
// engine serializer and controller receiving validation are bundled unchanged.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  return value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
}
const signedJSON = data => JSON.stringify(canonical(data), (_key, value) => Object.is(value, -0) ? '__NEG_ZERO__' : value)
  .replaceAll('"__NEG_ZERO__"', '-0') + '\n';
assert.equal(signedJSON(authored), baseline.text);

let forgeHiddenOrigin = false, panelReplays = 0, convexCalls = 0;
const edits = [], loads = [];
function snapshot(data) {
  const snapshot = {
    parameters: structuredClone(data.parameters), suppression: {}, features: structuredClone(baseline.features),
    bodies: Object.fromEntries(Object.entries(data.outputs).map(([name, ref]) => [name,
      structuredClone(baseline.bodies[ref.node === 1 ? 'plate' : ref.node === 3 ? 'tool' : 'part'])])),
    save: () => signedJSON(data),
    withParameters(changes) {
      edits.push({ snapshot, changes: structuredClone(changes) });
      const parameters = { ...data.parameters, ...changes };
      if (parameters.depth === 8 && parameters.toolY === 0 && parameters.toolSpanY === 24)
        throw Error('Mocked recorded disconnected two-body refusal');
      return createSnapshot({ ...data, parameters });
    },
    withSuppression() { throw Error('This fixture has no finishing channel.'); },
  };
  // Deliberately forge only a hidden part's copied native operand origin BEFORE
  // the actual serializer. The immutable transfer and its samples stay intact.
  if (forgeHiddenOrigin) snapshot.bodies.part.native.b.shell.origin[2] = 0;
  return snapshot;
}
const createSnapshot = snapshot;
function modelMock() {
  const parameters = {}, nodes = [];
  const shape = node => ({ node, side: 'solid', cut(tool) {
    const index = nodes.push({ kind: 'difference', parent: { node, side: 'solid' }, tool: { node: tool.node, side: tool.side } }) - 1;
    return shape(index);
  } });
  return {
    parameter(name, value) { parameters[name] = value; return { parameter: name }; },
    dimension: {
      add(left, right) { return { op: 'add', left, right }; },
      scale(value, factor) { return { op: 'scale', value, factor }; },
    },
    sketch: { rectangle(bounds) {
      const sketch = nodes.push({ kind: 'sketch', profile: 'rectangle', ...bounds }) - 1;
      return { extrude(height, options) {
        return shape(nodes.push({ kind: 'extrude', sketch, height, ...(options ?? {}) }) - 1);
      } };
    } },
    build(outputs) {
      return createSnapshot(canonical({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters, nodes,
        outputs: Object.fromEntries(Object.entries(outputs).map(([name, value]) => [name, { node: value.node, side: value.side }])) }));
    },
  };
}
function replayPanel(surface, options) {
  const index = native.panels.findIndex(panel => panel.bundle.topology.face.surfaceId === surface.id);
  const retained = baseline.preview[index], panel = native.panels[index];
  assert.ok(retained && panel);
  assert.equal(retained.panelId, panel.id);
  assert.equal(retained.sourceId, panel.sourceId);
  assert.equal(retained.surfaceId, surface.id);
  assert.deepEqual(surface, panel.bundle.geometry.objects[0]);
  assert.deepEqual(retained.options, { countU: 2, countV: 2, revision: 0 });
  assert.deepEqual(options, { countU: 2, countV: 2, revision: options.revision });
  assert.ok(Number.isSafeInteger(options.revision) && options.revision >= 0);
  panelReplays++;
  // Request revision/context changes; the retained result, including UV, XYZ,
  // normals, winding and native packet metadata, is returned wholly unchanged.
  return structuredClone(retained.result);
}
const forbidden = () => { throw Error('Out-of-scope native/legacy operation is forbidden.'); };
globalThis.__topPocketCad = {
  cad: { model: modelMock, load(text) { const value = createSnapshot(JSON.parse(text)); loads.push(value); return value; } },
  tessellateSurface: replayPanel,
  tessellateConvexPlanarSolid(body, options) { convexCalls++; return api.tessellateConvexPlanarSolid(body, options); },
  tessellateOwnPlateCircularHole: forbidden, tessellateXYCirclePrismShell: forbidden,
};
const engineBundle = await require('esbuild').build({
  entryPoints: [source('modeling-engine')], bundle: true, platform: 'node', format: 'esm', write: false, metafile: true,
  plugins: [{ name: 'retained-top-pocket-provider', setup(build) {
    build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'cad', namespace: 'mock' }));
    build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === 'cad'
      ? 'export const { cad, tessellateSurface, tessellateConvexPlanarSolid, tessellateOwnPlateCircularHole, tessellateXYCirclePrismShell } = globalThis.__topPocketCad;'
      : 'export function createPrismFeatureEngine() { return () => { throw Error("No legacy native execution"); }; }' }));
  } }],
});
for (const bundle of [receiverBundle, engineBundle])
  assert.ok(!Object.keys(bundle.metafile.inputs).some(path => /(?:wasm|convex-planar-solid\.ts$|cad\/src\/index\.ts$)/.test(path)), 'No native provider dependency');
writeFileSync(resolve(output, 'engine.mjs'), engineBundle.outputFiles[0].text);
const { createModelingEngine } = await import(pathToFileURL(resolve(output, 'engine.mjs')));

const workers = [], sessions = [], cases = [];
let replies = 0;
const previousWorker = globalThis.Worker;
globalThis.Worker = class {
  callbacks = new Map(); requests = []; answered = new Set(); engine = createModelingEngine(); terminated = false;
  constructor() { workers.push(this); }
  addEventListener(kind, callback) { this.callbacks.set(kind, callback); }
  postMessage(command) { this.requests.push(structuredClone(command)); }
  terminate() { this.terminated = true; }
  send(reply, id) { this.callbacks.get('message')({ data: { ...structuredClone(reply), id } }); }
  accept(mutate, command = this.requests.at(-1)) {
    assert.ok(command && !this.answered.has(command.id));
    assert.ok(++replies <= 32, 'Frozen worker reply ceiling');
    this.answered.add(command.id);
    const reply = this.engine(command);
    if (mutate) mutate(reply);
    this.send(reply, command.id);
    return reply;
  }
};
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const stable = session => { const value = session.getSnapshot(); delete value.busy; delete value.error; return value; };
async function pump(promise) {
  let done = false;
  promise.then(() => { done = true; }, () => { done = true; });
  for (let i = 0; i < 12 && !done; i++) {
    const worker = workers.at(-1), command = worker?.requests.at(-1);
    if (command && !worker.answered.has(command.id)) worker.accept();
    await tick();
  }
  assert.ok(done, 'Frozen bounded mocked-worker flow');
  await promise;
}
function session(port) {
  assert.ok(sessions.length < 3, 'Frozen controller session ceiling');
  const value = api.createCadEditorModelingController(port); sessions.push(value); return value;
}
async function open(port) {
  const value = session(port); await pump(value.example('top-entry-pocket'));
  assert.equal(value.getSnapshot().error, null); return value;
}
function retained(session, before, message) {
  assert.deepEqual(stable(session), before, message);
  assert.ok(session.getSnapshot().error, message);
}
const parameters = session => session.getSnapshot().accepted.parameters;
const stage = (session, changes) => { for (const [name, value] of Object.entries(changes)) session.stage(name, String(value)); };

try {
  const current = await open(), first = current.getSnapshot(), firstWorker = workers.at(-1);
  assert.equal(first.authoredText, baseline.text);
  assert.deepEqual(first.accepted.parameters, { depth: 4, toolSpanY: 8, toolY: 8 });
  assert.deepEqual(first.accepted.outputs.map(value => value.name), ['part', 'plate', 'tool']);
  assert.equal(first.accepted.outputs[0].volumeMM3.numerator, '5632');
  assert.equal(first.display.selectedOutput, 'part');
  assert.equal(panelReplays, 46); assert.equal(convexCalls, 2); assert.equal(convexValidationStubs, 2);
  const part = first.display.packet.components.find(component => component.role === 'part');
  assert.equal(part.mesh.chunks.length, 46);
  for (const [index, captured] of baseline.preview.entries()) {
    const chunk = part.mesh.chunks[index];
    assert.deepEqual(chunk.positionsMM, captured.result.packet.positions);
    assert.deepEqual(chunk.normals, captured.result.packet.normals);
    assert.deepEqual(chunk.parametersUV, captured.result.packet.parameters);
    assert.deepEqual(chunk.indices, captured.result.packet.indices);
  }
  const geometry = first.display.scene.geometries[0];
  assert.equal(geometry.positions.length, 184 * 3); assert.equal(geometry.indices.length, 92 * 3);
  const originalPositions = part.mesh.chunks.flatMap(chunk => chunk.positionsMM);
  for (let i = 0; i < 184; i++) assert.deepEqual(geometry.positions.slice(i * 3, i * 3 + 3),
    [originalPositions[i * 3], originalPositions[i * 3 + 2], -originalPositions[i * 3 + 1]]);
  const ray = (y, dy) => ({ format: 'barocss-gpu-engine-ray', version: 0, coordinateSystem: 'right-handed-y-up',
    positionUnit: 'scene', origin: [16, y, -12], direction: [0, dy, 0], near: 0, far: 200 });
  const top = api.raycastEngineScene(first.display.scene, ray(100, -1));
  const bottom = api.raycastEngineScene(first.display.scene, ray(-10, 1));
  assert.equal(top.point[1], 4); assert.deepEqual(top.normal, [0, 1, 0]);
  assert.equal(bottom.point[1], 0); assert.deepEqual(bottom.normal, [0, -1, 0]);
  cases.push('baseline');

  current.stage('depth', '6');
  const staged = current.getSnapshot(), beforeChooserRequests = firstWorker.requests.length;
  for (const name of ['plate', 'tool', 'part']) {
    await current.viewOutput(name, current.getSnapshot().generation);
    const state = current.getSnapshot();
    assert.equal(state.display.selectedOutput, name);
    assert.deepEqual(state.drafts, staged.drafts); assert.deepEqual(state.history, staged.history);
    assert.equal(state.authoredText, staged.authoredText); assert.deepEqual(state.accepted, staged.accepted);
    assert.deepEqual(state.display.packet, first.display.packet);
    assert.equal(state.display.packet.components.length, 3);
  }
  assert.equal(firstWorker.requests.length, beforeChooserRequests);
  current.discard(); cases.push('all-outputs');

  const beforeNoop = stable(current), beforeNoopRequests = firstWorker.requests.length;
  current.stage('depth', '4'); await current.apply();
  await current.viewOutput('part', current.getSnapshot().generation);
  assert.deepEqual(stable(current), beforeNoop); assert.equal(firstWorker.requests.length, beforeNoopRequests);
  cases.push('no-op');

  for (const [name, value, id] of [['depth', 6, 'independent-depth'], ['toolY', 9, 'independent-tool-y'],
    ['toolSpanY', 10, 'independent-tool-span-y']]) {
    const prior = parameters(current), priorRevision = current.getSnapshot().accepted.revision;
    current.stage(name, String(value)); await pump(current.apply());
    assert.equal(current.getSnapshot().error, null);
    assert.deepEqual(parameters(current), { ...prior, [name]: value });
    assert.deepEqual(edits.at(-1).changes, { [name]: value });
    assert.equal(current.getSnapshot().accepted.revision, priorRevision + 1);
    assert.deepEqual(current.getSnapshot().display.packet.components[0].mesh.chunks, part.mesh.chunks,
      'Changed-state geometry is explicitly the retained baseline mock');
    cases.push(id);
  }
  stage(current, { depth: 5, toolY: 7, toolSpanY: 9 });
  const beforeBatchRequests = firstWorker.requests.length;
  await pump(current.apply());
  assert.equal(firstWorker.requests.length, beforeBatchRequests + 1);
  assert.deepEqual(edits.at(-1).changes, { depth: 5, toolY: 7, toolSpanY: 9 });
  assert.deepEqual(parameters(current), { depth: 5, toolSpanY: 9, toolY: 7 });
  const batch = current.getSnapshot(); cases.push('batch');
  for (const [method, expected] of [
    ['undo', { depth: 6, toolSpanY: 10, toolY: 9 }], ['undo', { depth: 6, toolSpanY: 8, toolY: 9 }],
    ['redo', { depth: 6, toolSpanY: 10, toolY: 9 }], ['redo', batch.accepted.parameters],
  ]) {
    await pump(current[method]()); assert.deepEqual(parameters(current), expected);
    assert.equal(current.getSnapshot().display.selectedOutput, 'part');
  }
  assert.deepEqual(current.getSnapshot().history, batch.history); cases.push('mixed-undo-redo');

  stage(current, { depth: 8, toolY: 0, toolSpanY: 24 });
  const beforeRefusal = stable(current); await pump(current.apply());
  retained(current, beforeRefusal, 'Disconnected mock refusal must retain complete accepted state and drafts');
  assert.match(current.getSnapshot().error, /disconnected two-body/);
  const refusedSnapshot = edits.at(-1).snapshot;
  current.discard(); stage(current, { depth: 8, toolY: 8, toolSpanY: 8 }); await pump(current.apply());
  assert.equal(edits.at(-1).snapshot, refusedSnapshot);
  assert.deepEqual(parameters(current), { depth: 8, toolSpanY: 8, toolY: 8 });
  assert.deepEqual(current.getSnapshot().display.packet.components[0].mesh.chunks, part.mesh.chunks,
    'Recovery is wiring evidence only; no through-window packet was captured');
  cases.push('refusal-recovery');

  current.stage('depth', '6');
  const beforeCancel = stable(current), canceled = current.apply(), oldWorker = workers.at(-1);
  const oldCommand = oldWorker.requests.at(-1);
  current.cancel(); oldWorker.accept(undefined, oldCommand); await canceled;
  assert.ok(oldWorker.terminated); assert.deepEqual(stable(current), beforeCancel);
  const beforeLoads = loads.length;
  await pump(current.apply());
  assert.equal(loads.length, beforeLoads + 1);
  assert.deepEqual(workers.at(-1).requests.map(command => command.kind), ['open', 'apply']);
  assert.deepEqual(parameters(current), { depth: 6, toolSpanY: 8, toolY: 8 });
  assert.equal(current.getSnapshot().display.selectedOutput, 'part'); cases.push('cancel-cold-reconstruction');

  const reopened = session(), saved = current.getSnapshot().authoredText;
  await pump(reopened.open(saved));
  assert.equal(reopened.getSnapshot().error, null);
  assert.equal(reopened.getSnapshot().authoredText, saved);
  assert.equal(reopened.getSnapshot().display.selectedOutput, 'tool');
  assert.deepEqual(reopened.getSnapshot().accepted.outputs.map(value => value.name), ['part', 'plate', 'tool']);
  assert.deepEqual(reopened.getSnapshot().history, { index: 0, count: 1, canUndo: false, canRedo: false });
  await reopened.viewOutput('part', reopened.getSnapshot().generation);
  assert.equal(reopened.getSnapshot().display.selectedOutput, 'part');
  assert.equal(reopened.getSnapshot().authoredText, saved); cases.push('generic-open-chooser');

  // Keep part present but hidden; a worker-only preflight is insufficient here.
  await reopened.viewOutput('plate', reopened.getSnapshot().generation);
  reopened.stage('depth', '5');
  const beforeForged = stable(reopened);
  forgeHiddenOrigin = true;
  const forged = reopened.apply();
  const forgedReply = workers.at(-1).accept(reply => {
    assert.equal(reply.ok, true, 'Forged native origin must pass the actual worker serializer');
    assert.equal(reply.display.components[0].lineage.operands[1].origin[2], 0);
    assert.deepEqual(reply.display.components[0].mesh.chunks, part.mesh.chunks);
  });
  forgeHiddenOrigin = false; await forged;
  assert.equal(forgedReply.ok, true);
  retained(reopened, beforeForged, 'Receiving validation must reject a forged hidden part before acceptance');
  assert.match(reopened.getSnapshot().error, /Orthogonal display: original box support corner/);
  assert.equal(reopened.getSnapshot().display.selectedOutput, 'plate'); cases.push('forged-hidden-origin');

  // Address this session's Worker explicitly: the reopened session has its own.
  current.stage('depth', '5');
  const beforeStale = stable(current), stale = current.apply();
  const currentWorker = workers.findLast(worker => !worker.terminated);
  currentWorker.accept(reply => { assert.equal(reply.ok, true); reply.display.taskToken = 'stale'; });
  await stale; retained(current, beforeStale, 'Stale task token must retain complete prior state');
  assert.match(current.getSnapshot().error, /current request/); cases.push('stale');

  let displayMode = '', finish;
  const commits = [], disposals = [];
  const port = { async prepare(display) {
    if (displayMode === 'prepare') throw Error('Mock display prepare refusal');
    const candidate = {
      commit() { if (displayMode === 'commit') throw Error('Mock display commit refusal'); commits.push(display.selectedOutput); },
      dispose() { disposals.push(display.selectedOutput); },
    };
    if (displayMode === 'defer') return new Promise(resolve => { finish = () => resolve(candidate); });
    return candidate;
  } };
  const displayed = await open(port); displayed.stage('depth', '6');
  for (const mode of ['prepare', 'commit']) {
    const before = stable(displayed); displayMode = mode; await pump(displayed.apply()); displayMode = '';
    retained(displayed, before, `Display ${mode} refusal must retain authored/accepted/display/drafts/history/generation`);
    assert.match(displayed.getSnapshot().error, new RegExp(`display ${mode} refusal`));
  }
  const beforeDeferred = stable(displayed); displayMode = 'defer';
  const deferred = displayed.viewOutput('tool', displayed.getSnapshot().generation);
  await tick(); assert.equal(typeof finish, 'function'); displayed.cancel(); finish(); await deferred; displayMode = '';
  assert.deepEqual(stable(displayed), beforeDeferred);
  assert.deepEqual(commits, ['part']); assert.ok(disposals.includes('tool')); cases.push('display-retention');

  assert.equal(cases.length, 14); assert.equal(new Set(cases).size, 14);
  assert.equal(hash(JSON.stringify(baseline.preview)), retainedPacketHash);
  assert.equal(hash(readFileSync(resolve(root, transferPath))), transferSHA256);
  assert.equal(native.b.shell.origin[2], 4);
  const result = {
    ok: true, cases, controllerSessions: sessions.length, workerReplies: replies,
    panelReplayCalls: panelReplays, convexMockCalls: convexCalls, convexValidationStubs, nativeCalls: 0,
    transferPath, transferBytes: transferBytes.length, transferSHA256,
    baseline: { genuinePartPackets: 46, vertices: 184, triangles: 92, axisConversions: 1, floorZ: 4, bottomZ: 0 },
    forgedHiddenOrigin: { serializerAccepted: true, receivingRejected: true, selectedOutputRetained: 'plate' },
    sourceSHA256: Object.fromEntries(['modeling-engine', 'modeling-controller', 'modeling-scene', 'modeling-union']
      .map(name => [name, hash(readFileSync(source(name)))])),
    harnessSHA256: hash(readFileSync(new URL(import.meta.url))),
    bundlesSHA256: { receiver: hash(receiverBundle.outputFiles[0].text), engine: hash(engineBundle.outputFiles[0].text) },
    scope: 'Actual worker serializer and receiving controller/scene with mocked Worker/provider; unchanged genuine baseline part packets',
    adaptations: [
      'Plate/tool fans use actual CPU fan algorithm over exact #1724 native topology, with native validation explicitly stubbed; not retained native mesh captures',
      'All edited-state geometry remains the baseline mock; no newly measured depth6 or through-window display',
      'Fresh request revision/context; retained raw packet results, XYZ/UV/normals/order are unchanged',
      'One in-memory reconstruction/Open/chooser flow; no native, React/device/browser/GPU or physical Save/Open acceptance',
    ],
  };
  writeFileSync(resolve(output, 'controller-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  for (const value of sessions) value.dispose();
  globalThis.Worker = previousWorker;
  delete globalThis.__topPocketCad;
  delete globalThis.__topPocketConvexValidationStub;
}
