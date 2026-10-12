// Deterministic mocked Worker transport tests. These do not claim native/GPU execution.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../../..');
const output = resolve(process.env.EVIDENCE_DIR ?? '/tmp/cad-editor-prism-controller'); mkdirSync(output, { recursive: true });
const require = createRequire(resolve(process.env.REPO_DEPS_ROOT ?? root, 'package.json'));
const built = await require('esbuild').build({ entryPoints: [resolve(root, 'packages/barocss-cad-editor/src/prism-feature-controller.ts')], bundle: true, platform: 'node', format: 'esm', write: false, alias: { '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src/index.ts') } });
writeFileSync(resolve(output, 'controller.mjs'), built.outputFiles[0].text);
const { createCadEditorPrismFeatureController, prismFeatureFieldText } = await import(pathToFileURL(resolve(output, 'controller.mjs')));
const fixture = JSON.parse(readFileSync(resolve(root, 'apps/cad-editor/src/fixtures/affine-prism.authored.json'), 'utf8'));
const displayFixture = JSON.parse(readFileSync(resolve(root, 'packages/barocss-cad-editor/scripts/fixtures/convex-display.packet.json'), 'utf8'));
const instances = [], timers = new Set();
const originalTimeout = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
globalThis.setTimeout = callback => { const token = { callback }; timers.add(token); return token; };
globalThis.clearTimeout = token => { timers.delete(token); };
class MockWorker {
  callbacks = new Map(); requests = []; terminated = false;
  constructor() { instances.push(this); }
  addEventListener(kind, callback) { this.callbacks.set(kind, callback); }
  postMessage(command) { this.requests.push(command); }
  terminate() { this.terminated = true; }
  send(value) { this.callbacks.get('message')?.({ data: value }); }
  accept(command = this.requests.at(-1), revision = command.kind === 'open' ? JSON.parse(command.text).revision : command.expectedRevision + 1) {
    const document = command.kind === 'open' ? JSON.parse(command.text) : structuredClone(this.document);
    document.revision = revision;
    if (command.kind === 'apply') for (const edit of command.edits) document.parameters.find(p => p.id === edit.parameterId).valueMM = edit.valueMM;
    this.document = document;
    const fraction = { numerator: '1', denominator: '1' };
    this.send({ id: command.id, ok: true, text: JSON.stringify(document), summary: { document,
      dependencies: document.nodes.map(n => ({ nodeId: n.id, dependsOn: [] })), components: displayFixture.outcomes, selectedWalls: [],
      volumes: { parent: fraction, first: fraction, second: fraction, remaining: fraction, removed: fraction } }, display: { ...structuredClone(displayFixture), documentId: document.id, revision } });
  }
}
globalThis.Worker = MockWorker;
const tick = () => Promise.resolve();
let checks = 0;
try {
  for (const id of ['constructor', 'toString', '__proto__']) {
    assert.equal(prismFeatureFieldText({}, { id, valueMM: 16 }), '16');
    assert.equal(prismFeatureFieldText({ [id]: '24' }, { id, valueMM: 16 }), '24');
  }
  assert.equal(prismFeatureFieldText({}, { id: 'signed', valueMM: -0 }), '-0'); checks++;
  const session = createCadEditorPrismFeatureController();
  const open = session.open(JSON.stringify(fixture)); const first = instances.at(-1); first.accept(); await open;
  assert.equal(session.getSnapshot().accepted.document.revision, 0); checks++;
  session.stage('upperX', 'not-a-number'); await assert.rejects(session.apply(), /finite decimal/);
  assert.equal(session.getSnapshot().drafts.upperX, 'not-a-number'); assert.equal(first.requests.length, 1); checks++;
  session.stage('upperX', '24'); const apply = session.apply();
  await assert.rejects(session.apply(), /in progress/); assert.throws(() => session.stage('upperX', '25'), /in progress/);
  first.send({ id: first.requests.at(-1).id - 1, ok: false, message: 'stale' }); assert.equal(session.getSnapshot().busy, true);
  first.accept(); await apply; assert.equal(session.getSnapshot().accepted.document.revision, 1); assert.equal(session.getSnapshot().history.count, 2); checks++;
  const detached = session.getSnapshot(); detached.accepted.document.parameters[1].valueMM = 999;
  assert.equal(session.getSnapshot().accepted.document.parameters[1].valueMM, 24); checks++;
  assert.throws(() => session.select('subtraction_feature', 0), /stale/);
  session.select('aa_prism_node', 1); const undo = session.undo(); first.accept(); await undo;
  assert.equal(session.getSnapshot().accepted.document.parameters[1].valueMM, 16);
  assert.equal(session.getSnapshot().selection.nodeId, 'aa_prism_node'); assert.equal(session.getSnapshot().selection.revision, 2);
  const redo = session.redo(); first.accept(); await redo; assert.equal(session.getSnapshot().accepted.document.parameters[1].valueMM, 24); checks++;
  session.stage('upperX', '28'); const cancelled = session.apply(), late = first.requests.at(-1); session.cancel(); await cancelled;
  first.accept(late); assert.equal(session.getSnapshot().accepted.document.parameters[1].valueMM, 24);
  assert.equal(session.getSnapshot().drafts.upperX, '28'); assert.equal(first.terminated, true); checks++;
  const restart = session.apply(), second = instances.at(-1); assert.equal(second.requests[0].kind, 'open'); second.accept(); await tick();
  second.accept(); await restart; assert.equal(session.getSnapshot().accepted.document.parameters[1].valueMM, 28); checks++;
  session.stage('upperX', '30'); const failed = session.apply(); second.send({ id: second.requests.at(-1).id, ok: false, message: 'native refused' }); await failed;
  assert.equal(session.getSnapshot().accepted.document.parameters[1].valueMM, 28); assert.equal(session.getSnapshot().drafts.upperX, '30');
  assert.equal(session.getSnapshot().error, 'native refused'); checks++;
  const beforeOpenRefusal = session.getSnapshot();
  const refusedOpen = session.open('{broken'); second.send({ id: second.requests.at(-1).id, ok: false, message: 'codec refused' }); await refusedOpen;
  const afterOpenRefusal = session.getSnapshot();
  for (const key of ['accepted', 'authoredText', 'selection', 'history', 'drafts']) assert.deepEqual(afterOpenRefusal[key], beforeOpenRefusal[key]);
  assert.equal(afterOpenRefusal.error, 'codec refused'); assert.equal(afterOpenRefusal.busy, false); checks++;
  const timeout = session.apply(); [...timers][0].callback(); await timeout;
  assert.match(session.getSnapshot().error, /timed out/); assert.equal(session.getSnapshot().accepted.document.parameters[1].valueMM, 28); checks++;
  session.discard(); const oversized = ' '.repeat(262145); await assert.rejects(session.open(oversized), /262144/); checks++;
  const reOpen = session.open(JSON.stringify(fixture)), third = instances.at(-1); third.accept(); await reOpen;
  assert.equal(session.getSnapshot().history.count, 1); assert.equal(session.getSnapshot().history.canUndo, false); checks++;
  session.stage('upperX', '20'); const stale = session.apply(); third.accept(undefined, 77); await stale;
  assert.equal(session.getSnapshot().accepted.document.revision, 0); assert.match(session.getSnapshot().error, /revision/); checks++;
  session.discard();
  for (const raw of ['', '0x10', 'Infinity', '10001']) {
    session.stage('upperX', raw); await assert.rejects(session.apply());
  }
  session.discard(); checks++;
  const reload = session.open(JSON.stringify(fixture)), fourth = instances.at(-1); fourth.accept(); await reload;
  session.stage('upperX', '16'); const beforeNoop = fourth.requests.length; await session.apply();
  assert.equal(fourth.requests.length, beforeNoop); assert.equal(session.getSnapshot().history.count, 1); checks++;
  for (let i = 0; i < 22; i++) { session.stage('upperX', String(20 + i)); const edit = session.apply(); fourth.accept(); await edit; }
  assert.equal(session.getSnapshot().history.count, 20); assert.equal(session.getSnapshot().history.index, 19); checks++;
  const historyBack = session.undo(); fourth.accept(); await historyBack;
  session.stage('upperX', '60'); const branch = session.apply(); fourth.accept(); await branch;
  assert.equal(session.getSnapshot().history.canRedo, false); checks++;
  session.stage('upperX', '70'); const crash = session.apply(); fourth.callbacks.get('error')(); await crash;
  assert.match(session.getSnapshot().error, /worker failed/); assert.equal(session.getSnapshot().accepted.document.parameters[1].valueMM, 60); checks++;
  const dead = session.open(JSON.stringify(fixture)), fifth = instances.at(-1); session.dispose(); fifth.accept(); await dead;
  assert.equal(session.getSnapshot().disposed, true); assert.equal(session.getSnapshot().accepted.document.parameters[1].valueMM, 60); checks++;
  // Asynchronous display gate: no scene, authored state, history or selection may advance early.
  let settle, failPrepare = false, commits = 0, disposals = 0;
  const port = { prepare: () => new Promise((resolve, reject) => {
    settle = () => failPrepare ? reject(new Error('display refused')) : resolve({ commit() { commits++; }, dispose() { disposals++; } });
  }) };
  const gated = createCadEditorPrismFeatureController(port);
  let task = gated.open(JSON.stringify(fixture)), worker = instances.at(-1); worker.accept(); await tick();
  assert.equal(gated.getSnapshot().accepted, null); assert.equal(gated.getSnapshot().history.count, 0);
  settle(); await task; assert.equal(commits, 1); checks++;
  gated.stage('upperX', '24'); const beforeDisplay = gated.getSnapshot();
  task = gated.apply(); worker.accept(); await tick(); failPrepare = true; settle(); await task;
  for (const key of ['accepted', 'display', 'history', 'selection', 'drafts']) assert.deepEqual(gated.getSnapshot()[key], beforeDisplay[key]);
  assert.equal(worker.terminated, true); assert.equal(commits, 1); checks++;
  failPrepare = false;
  task = gated.apply(); worker = instances.at(-1); worker.accept(); await tick(); worker.accept(); await tick();
  gated.cancel(); settle(); await task; assert.equal(commits, 1); assert.ok(disposals >= 2); checks++;
  task = gated.apply(); worker = instances.at(-1); worker.accept(); await tick(); worker.accept(); await tick();
  worker.callbacks.get('error')(); settle(); await task;
  assert.equal(commits, 1); assert.match(gated.getSnapshot().error, /lost before display/); checks++;
  task = gated.setView('source'); await tick(); gated.cancel(); settle(); await task;
  assert.equal(gated.getSnapshot().view, 'result'); assert.equal(commits, 1); checks++;
  task = gated.setView('source'); await tick(); settle(); await task;
  assert.equal(gated.getSnapshot().view, 'source'); assert.equal(gated.getSnapshot().history.count, 1); checks++;
  task = gated.setView('result'); await tick(); gated.dispose(); settle(); await task;
  assert.equal(commits, 2); assert.equal(gated.getSnapshot().disposed, true); checks++;
  const malformed = createCadEditorPrismFeatureController();
  task = malformed.open(JSON.stringify(fixture)); worker = instances.at(-1);
  const send = worker.send.bind(worker); worker.send = value => { value.summary.circular = value.summary; send(value); };
  worker.accept(); await task; assert.match(malformed.getSnapshot().error, /Invalid native worker reply/);
  assert.equal(malformed.getSnapshot().busy, false); assert.equal(worker.terminated, true); malformed.dispose(); checks++;
  console.log(JSON.stringify({ ok: true, checks, evidence: 'mocked worker transport only' }));
} finally { globalThis.setTimeout = originalTimeout; globalThis.clearTimeout = originalClear; delete globalThis.Worker; }
