import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = new URL('../../../', import.meta.url);
const built = await build({ stdin: { contents: `export { Viewer } from './packages/barocss-viewer/src/index.ts';
export { createViewerController } from './apps/cad-viewer/controller.js';`, resolveDir: root.pathname },
bundle: true, platform: 'node', format: 'esm', write: false, plugins: [{ name: 'source', setup(builder) {
  builder.onResolve({ filter: /^@barocss\// }, async ({ path }) => {
    if (path === '@barocss/viewer') return { path: 'viewer', namespace: 'test-viewer' };
    const parts = path.split('/'), directory = new URL('packages/barocss-' + parts[1] + '/', root);
    const manifest = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
    const entry = manifest.exports[parts.length === 2 ? '.' : './' + parts.slice(2).join('/')];
    return { path: new URL(typeof entry === 'string' ? entry : entry.import, directory).pathname };
  });
  builder.onLoad({ filter: /.*/, namespace: 'test-viewer' }, () => ({
    contents: 'export const createViewer = async () => globalThis.__closeTestViewer;', loader: 'js' }));
} }] });
const temp = await mkdtemp(tmpdir() + '/cad-viewer-close-');
let api;
try { await writeFile(temp + '/test.mjs', built.outputFiles[0].contents); api = await import(pathToFileURL(temp + '/test.mjs').href); }
finally { await rm(temp, { recursive: true }); }
const wire = await readFile(new URL('packages/barocss-cad-interop/examples/document-gpu-v2.cad-document.json', root), 'utf8');
const assembly = await readFile(new URL('examples/gpu-scene/fixtures/assembly-revision0.json', root), 'utf8');
globalThis.HTMLCanvasElement = class extends EventTarget {
  width = 800; height = 480;
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 480 }; }
  focus() {}
};
globalThis.window = new EventTarget();
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const file = text => ({ size: Buffer.byteLength(text), name: 'test.json', text: async () => text });
async function setup(source = wire) {
  const canvas = new HTMLCanvasElement(), presenter = { show() {}, dispose() {}, setLighting() {} };
  const viewer = new api.Viewer(canvas, { mmToSceneUnit: .15, background: [0, 0, 0] }, presenter);
  viewer.attachPointerControls = viewer.attachKeyboardControls = () => ({ dispose() {} });
  globalThis.__closeTestViewer = viewer; let model;
  const controller = api.createViewerController({ canvas, stage: canvas, onChange: value => { model = value; } });
  await controller.start(); await controller.openDocument(file(source)); controller.admit();
  return { controller, viewer, presenter, get model() { return model; } };
}
async function reopen(context, source = wire) {
  await context.controller.openDocument(file(source)); context.controller.admit();
  assert.equal(context.model.ready, true);
}
async function measure(context) {
  const body = context.viewer.getState().documentBodies.find(row => row.ref.kind === 'curve');
  context.controller.select(body.ref); context.controller.inspectDocumentPoint({ kind: 'curve', parameter: 2 });
  context.controller.setInspectedMeasurementPoint('a');
  context.controller.inspectDocumentPoint({ kind: 'curve', parameter: 7 });
  context.controller.setInspectedMeasurementPoint('b');
  assert.ok(context.model.measurement.result);
  assert.equal(await context.controller.saveNamedView('Keep'), true);
}
function snapshot(context) {
  return { state: context.viewer.getState(), review: context.viewer.captureReviewState(),
    source: window.cadViewerEvidence.source(), measurement: structuredClone(context.model.measurement),
    points: structuredClone(context.model.assemblyPoints), names: window.cadViewerEvidence.namedViews(),
    candidate: structuredClone(context.model.candidate) };
}

test('close clears a document, measurement, views and candidate, then another file can be opened', async () => {
  const context = await setup();
  try {
    await measure(context); context.controller.openBodies();
    assert.ok(context.model.candidate);
    assert.equal(context.controller.closeDocument(), true);
    assert.equal(context.model.ready, false); assert.equal(context.model.startupState, 'available');
    assert.equal(context.model.active, null); assert.equal(context.model.candidate, null);
    assert.deepEqual(context.model.admitted, []); assert.deepEqual(context.model.namedViews, []);
    assert.deepEqual(context.model.measurement.points, []); assert.equal(context.model.measurement.result, null);
    assert.equal(context.viewer.getState().nativeMeasurement, null);
    assert.equal(window.cadViewerEvidence.source(), null);
    await reopen(context); assert.equal(context.model.active.kind, 'document');
  } finally { context.controller.dispose(); }
});

test('close clears assembly points and distance before reopening another document', async () => {
  const context = await setup(assembly);
  try {
    for (const [id, endpoint] of [['child', 'a'], ['shared_root', 'b']]) {
      const row = context.viewer.getState().assemblyInstances.find(value => value.instanceId === id);
      context.controller.select(row.ref); context.controller.setAssemblyPoint(endpoint);
    }
    assert.ok(Number.isFinite(context.model.assemblyDistance));
    assert.equal(context.controller.closeDocument(), true);
    assert.deepEqual(context.model.assemblyPoints, [null, null]);
    assert.equal(context.model.assemblyDistance, null);
    assert.equal(context.viewer.getState().assembly, null);
    await reopen(context); assert.equal(context.model.active.kind, 'document');
  } finally { context.controller.dispose(); }
});

test('failed clear redraws and preserves the accepted Viewer, measurement, names and candidate', async () => {
  const context = await setup();
  try {
    await measure(context); context.controller.openBodies();
    const before = snapshot(context); let calls = 0;
    context.presenter.show = () => { calls++; if (calls === 1) throw new Error('clear failed'); };
    assert.equal(context.controller.closeDocument(), false); assert.equal(calls, 2);
    assert.match(context.model.status, /clear failed/); assert.equal(context.model.statusError, true);
    assert.deepEqual(snapshot(context), before);
  } finally { context.controller.dispose(); }
});

test('a failed redraw reports recovery failure and does not clear accepted CPU state', async () => {
  const context = await setup();
  try {
    await measure(context); const before = snapshot(context);
    context.presenter.show = () => { throw new Error('presenter unavailable'); };
    assert.equal(context.controller.closeDocument(), false);
    assert.match(context.model.status, /View recovery failed/);
    assert.deepEqual(snapshot(context), before);
  } finally { context.controller.dispose(); }
});

test('late document and review reads do not reopen state after a successful close', async () => {
  const context = await setup();
  try {
    let release; const pendingText = new Promise(resolve => { release = resolve; });
    const pending = context.controller.openDocument({ name: 'late.json', size: 1, text: () => pendingText });
    assert.equal(context.controller.closeDocument(), true);
    release(wire); await pending;
    assert.equal(context.model.active, null); assert.equal(context.model.candidate, null);
    await reopen(context);
    let releaseReview; const reviewText = new Promise(resolve => { releaseReview = resolve; });
    const pendingReview = context.controller.openReview({ size: 1, text: () => reviewText });
    assert.equal(context.controller.closeDocument(), true);
    releaseReview('{}'); await pendingReview;
    assert.equal(context.model.active, null); assert.equal(context.model.status, 'Document closed.');
  } finally { context.controller.dispose(); }
});

test('a pending image read is cancelled when the file closes', async () => {
  const context = await setup();
  try {
    let release; context.viewer.readPixels = () => new Promise(resolve => { release = resolve; });
    const pending = context.controller.exportImage();
    assert.equal(context.model.exportBusy, true);
    assert.equal(context.controller.closeDocument(), true);
    assert.equal(context.model.exportBusy, false); assert.equal(context.model.exportStatus, '');
    release(new Uint8Array(0)); await pending;
    assert.equal(context.model.active, null); assert.equal(context.model.exportStatus, '');
  } finally { context.controller.dispose(); }
});

test('close follows the SDK lighting behavior and retains its accepted override', async () => {
  const context = await setup();
  try {
    const lighting = { ambientStrength: 0.3, directionalStrength: 0.5, direction: [0, 1, 0] };
    context.viewer.setLighting(lighting);
    assert.equal(context.controller.closeDocument(), true);
    assert.deepEqual(context.viewer.getState().lighting, lighting);
    await reopen(context);
    assert.deepEqual(context.viewer.getState().lighting, lighting);
  } finally { context.controller.dispose(); }
});

for (const mode of ['named', 'review']) test(`a stale ${mode} completion cannot release a new operation's busy state`, async () => {
  const context = await setup();
  const oldCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const originalCrypto = globalThis.crypto, originalDoc = globalThis.document;
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL, waiting = [];
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { subtle: { digest(...args) {
    return new Promise(resolve => waiting.push(async () => resolve(await originalCrypto.subtle.digest(...args))));
  } } } });
  globalThis.document = { createElement: () => ({ click() {} }) };
  URL.createObjectURL = () => 'blob:test'; URL.revokeObjectURL = () => {};
  try {
    const start = () => mode === 'named' ? context.controller.saveNamedView('new') : context.controller.downloadReview();
    const first = start(); assert.equal(waiting.length, 1);
    assert.equal(context.controller.closeDocument(), true); await reopen(context);
    const second = start(); assert.equal(waiting.length, 2);
    assert.equal(mode === 'named' ? context.model.namedBusy : context.model.reviewBusy, true);
    await waiting[0](); await first;
    assert.equal(mode === 'named' ? context.model.namedBusy : context.model.reviewBusy, true);
    await waiting[1](); await second;
    assert.equal(mode === 'named' ? context.model.namedBusy : context.model.reviewBusy, false);
  } finally {
    context.controller.dispose(); Object.defineProperty(globalThis, 'crypto', oldCrypto);
    globalThis.document = originalDoc; URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
  }
});

test('an independently cancelled review request still releases its own busy state', async () => {
  const context = await setup(), descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const original = globalThis.crypto; let release;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { subtle: { digest(...args) {
    return new Promise(resolve => { release = async () => resolve(await original.subtle.digest(...args)); });
  } } } });
  try {
    const pending = context.controller.downloadReview();
    assert.equal(context.model.reviewBusy, true);
    context.controller.cancelReviewPick();
    await release(); await pending;
    assert.equal(context.model.reviewBusy, false);
  } finally { context.controller.dispose(); Object.defineProperty(globalThis, 'crypto', descriptor); }
});

test('an old named-view hash failure cannot overwrite a new success after the same source is readmitted', async () => {
  const context = await setup(), descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const original = globalThis.crypto, waiting = [];
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { subtle: { digest(...args) {
    return new Promise((resolve, reject) => waiting.push({
      success: async () => resolve(await original.subtle.digest(...args)), reject,
    }));
  } } } });
  try {
    const first = context.controller.saveNamedView('old');
    assert.equal(waiting.length, 1);
    context.controller.openBodies(); context.controller.admit();
    const second = context.controller.saveNamedView('new');
    assert.equal(waiting.length, 2);
    await waiting[1].success(); assert.equal(await second, true);
    assert.deepEqual(context.model.namedViews, ['new']);
    assert.equal(context.model.namedViewError, '');
    const status = context.model.status;
    waiting[0].reject(new Error('old hash failed'));
    assert.equal(await first, false);
    assert.deepEqual(context.model.namedViews, ['new']);
    assert.equal(context.model.namedViewError, '');
    assert.equal(context.model.status, status); assert.equal(context.model.statusError, false);
    assert.equal(context.model.namedBusy, false);
  } finally { context.controller.dispose(); Object.defineProperty(globalThis, 'crypto', descriptor); }
});
