import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = new URL('../../../', import.meta.url);
const built = await build({ stdin: { contents: `export { createViewerController } from './apps/cad-viewer/controller.js';
export { Viewer } from './packages/barocss-viewer/src/index.ts';`, resolveDir: root.pathname },
  bundle: true, platform: 'node', format: 'esm', write: false, plugins: [{ name: 'source', setup(builder) {
    builder.onResolve({ filter: /^@barocss\// }, async ({ path }) => {
      if (path === '@barocss/viewer') return { path: 'viewer', namespace: 'test-viewer' };
      const parts = path.split('/'), directory = new URL('packages/barocss-' + parts[1] + '/', root);
      const manifest = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
      const entry = manifest.exports[parts.length === 2 ? '.' : './' + parts.slice(2).join('/')];
      return { path: new URL(typeof entry === 'string' ? entry : entry.import, directory).pathname };
    });
    builder.onLoad({ filter: /.*/, namespace: 'test-viewer' }, () => ({
      contents: 'export const createViewer = (...args) => globalThis.__startupFactory(...args);', loader: 'js' }));
  } }] });
const temp = await mkdtemp(tmpdir() + '/cad-viewer-startup-');
let api;
try { await writeFile(temp + '/test.mjs', built.outputFiles[0].contents); api = await import(pathToFileURL(temp + '/test.mjs').href); }
finally { await rm(temp, { recursive: true }); }
class Target extends EventTarget {
  count = 0;
  addEventListener(...args) { this.count++; return super.addEventListener(...args); }
  removeEventListener(...args) { this.count--; return super.removeEventListener(...args); }
}
class Canvas extends Target {
  width = 800; height = 480;
  rect = { left: 0, top: 0, width: 800, height: 480 };
  getBoundingClientRect() { return this.rect; }
  focus() {}
}
globalThis.HTMLCanvasElement = Canvas;
let observers;
globalThis.window = new Target();
globalThis.ResizeObserver = class {
  constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
  observe() { if (globalThis.__failObserve) throw new Error('observe failed'); }
  disconnect() { this.disconnected = true; }
};
globalThis.devicePixelRatio = 1;
function mockViewer() {
  const events = [];
  const state = { surfaceMaterials: [], lighting: null, assemblyInstances: [], documentBodies: [],
    visibleGeometry: [], surfaces: [], curves: [] };
  return { events, getState: () => structuredClone(state), getLightingCapabilities: () => null,
    attachPointerControls() { events.push('pointer'); return { dispose() { events.push('pointer.dispose'); } }; },
    attachKeyboardControls() { events.push('keyboard'); return { dispose() { events.push('keyboard.dispose'); } }; },
    dispose() { events.push('viewer.dispose'); } };
}
function setup() {
  observers = []; globalThis.__failObserve = false;
  const canvas = new Canvas(); let model;
  const controller = api.createViewerController({ canvas, stage: canvas, onChange: value => { model = value; } });
  return { controller, canvas, get model() { return model; } };
}
async function muted(fn) {
  const old = console.error; console.error = () => {};
  try { await fn(); } finally { console.error = old; }
}

test('pending startup stays separate from a ready Viewer without a document', async () => {
  const context = setup(), viewer = mockViewer();
  let resolve;
  globalThis.__startupFactory = () => new Promise(done => { resolve = done; });
  try {
    const pending = context.controller.start();
    assert.equal(context.model.startupState, 'starting');
    assert.equal(context.model.ready, false);
    let fileRead = false;
    await context.controller.openDocument({ size: 1, text: async () => { fileRead = true; return '{}'; } });
    assert.equal(fileRead, false);
    resolve(viewer); await pending;
    assert.equal(context.model.startupState, 'available');
    assert.equal(context.model.startupFailure, '');
    assert.equal(context.model.ready, false);
    assert.ok(context.model.state);
    assert.equal(context.model.status, 'Open a CAD document to begin.');
  } finally { context.controller.dispose(); }
  assert.deepEqual(viewer.events, ['pointer', 'keyboard', 'pointer.dispose', 'keyboard.dispose', 'viewer.dispose']);
  assert.equal(context.canvas.count, 0); assert.equal(window.count, 0);
});

for (const [code, expected] of [['WEBGPU_UNAVAILABLE', 'WebGPU unavailable'], ['NO_ADAPTER', 'WebGPU unavailable'],
  ['NO_CONTEXT', 'Viewer could not start'], ['UNKNOWN', 'Viewer could not start']]) {
  test(`${code} produces the correct startup failure and blocks file access`, async () => muted(async () => {
    const context = setup();
    globalThis.__startupFactory = async () => { throw Object.assign(new Error('private detail'), { code }); };
    try {
      await context.controller.start();
      assert.equal(context.model.startupState, 'failed');
      assert.equal(context.model.startupFailure, expected);
      assert.equal(context.model.status, expected);
      assert.equal(context.model.statusError, true);
      assert.equal(context.model.state, null);
      let fileRead = false;
      await context.controller.openDocument({ size: 1, text: async () => { fileRead = true; return '{}'; } });
      assert.equal(fileRead, false);
      assert.equal(context.model.candidate, null);
    } finally { context.controller.dispose(); }
    assert.equal(context.canvas.count, 0); assert.equal(window.count, 0);
  }));
}

test('partial setup failure releases the Viewer, controls, listeners and observer', async () => muted(async () => {
  const context = setup(), viewer = mockViewer(); globalThis.__startupFactory = async () => viewer;
  globalThis.__failObserve = true;
  try {
    await context.controller.start();
    assert.equal(context.model.startupState, 'failed');
    assert.equal(context.model.startupFailure, 'Viewer could not start');
    assert.equal(context.model.state, null);
    assert.equal(context.canvas.count, 0);
    assert.equal(window.count, 1); // The pagehide listener remains until controller disposal.
    assert.equal(observers[0].disconnected, true);
    assert.deepEqual(viewer.events, ['pointer', 'keyboard', 'pointer.dispose', 'keyboard.dispose', 'viewer.dispose']);
  } finally { context.controller.dispose(); }
  assert.equal(window.count, 0);
}));

test('disposing while creation is pending releases a Viewer that arrives later', async () => {
  const context = setup(), viewer = mockViewer(); let resolve;
  globalThis.__startupFactory = () => new Promise(done => { resolve = done; });
  const pending = context.controller.start();
  context.controller.dispose(); resolve(viewer); await pending;
  assert.deepEqual(viewer.events, ['viewer.dispose']);
  assert.equal(context.canvas.count, 0); assert.equal(window.count, 0);
});

test('device events received before startup completes remain visible and stop after disposal', async () => {
  const context = setup(), viewer = mockViewer(); let resolve, notify;
  globalThis.__startupFactory = (_canvas, options) => {
    notify = options.onDeviceEvent; notify({ type: 'lost' });
    return new Promise(done => { resolve = done; });
  };
  const pending = context.controller.start();
  assert.equal(context.model.startupState, 'starting');
  assert.equal(context.model.deviceStatus, 'WebGPU device lost');
  resolve(viewer); await pending;
  assert.equal(context.model.startupState, 'available');
  assert.equal(context.model.deviceStatus, 'WebGPU device lost');
  notify({ type: 'recreated' });
  assert.equal(context.model.deviceStatus, 'WebGPU device recreated');
  context.controller.setSearch('sample');
  assert.equal(context.model.deviceStatus, 'WebGPU device recreated');
  context.controller.dispose();
  notify({ type: 'lost' });
  assert.equal(context.model.deviceStatus, 'WebGPU device recreated');
});

test('a startup failure supersedes an earlier device event', async () => muted(async () => {
  const context = setup(); let notify;
  globalThis.__startupFactory = async (_canvas, options) => {
    notify = options.onDeviceEvent; notify({ type: 'lost' }); throw new Error('startup failed');
  };
  try {
    await context.controller.start();
    assert.equal(context.model.startupState, 'failed');
    assert.equal(context.model.startupFailure, 'Viewer could not start');
    assert.equal(context.model.deviceStatus, '');
    notify({ type: 'recreated' });
    assert.equal(context.model.deviceStatus, '');
  } finally { context.controller.dispose(); }
}));

test('resize limits backing pixels and retries after an error on the next observation', async () => {
  const context = setup(), viewer = mockViewer(), calls = [];
  let fail = false;
  viewer.resize = (width, height) => {
    calls.push([width, height]);
    context.canvas.width = width; context.canvas.height = height;
    if (fail) throw new Error('resize failed');
  };
  globalThis.__startupFactory = async () => viewer;
  try {
    await context.controller.start();
    const notify = () => observers[0].callback();
    context.canvas.rect = { left: 0, top: 0, width: 5000, height: 1000 };
    globalThis.devicePixelRatio = 3; notify();
    assert.deepEqual(calls.at(-1), [4096, 819]);
    context.canvas.rect = { left: 0, top: 0, width: 3000, height: 3000 }; notify();
    assert.deepEqual(calls.at(-1), [2048, 2048]);
    const count = calls.length; notify();
    context.canvas.rect.width = 0; notify();
    assert.equal(calls.length, count);
    context.canvas.rect = { left: 0, top: 0, width: 300, height: 200 };
    const state = structuredClone(context.model.state);
    fail = true; notify();
    assert.equal(context.model.status, 'resize failed');
    assert.equal(context.model.statusError, true);
    assert.deepEqual(context.model.state, state);
    fail = false; notify();
    assert.deepEqual(calls.at(-1), [600, 400]);
    assert.equal(context.model.statusError, false);
    assert.deepEqual(context.model.state, state);
    context.canvas.rect.width = 400;
    fail = true; notify();
    await context.controller.openDocument({ size: 1, name: 'bad.json', text: async () => '{' });
    const otherError = context.model.status;
    assert.match(otherError, /Document not opened/);
    fail = false; notify();
    assert.equal(context.model.status, otherError);
    assert.equal(context.model.statusError, true);
  } finally { globalThis.devicePixelRatio = 1; context.controller.dispose(); }
});

test('candidate recovery failure event preserves an accepted document, selection, measurement and views', async () => {
  const source = await readFile(new URL('packages/barocss-cad-interop/examples/document-gpu-v2.cad-document.json', root), 'utf8');
  const context = setup(), presenter = { show() {}, dispose() {}, setLighting() {} };
  const viewer = new api.Viewer(context.canvas, { mmToSceneUnit: .15, background: [0, 0, 0] }, presenter);
  viewer.attachPointerControls = viewer.attachKeyboardControls = () => ({ dispose() {} });
  let notify;
  globalThis.__startupFactory = async (_canvas, options) => { notify = options.onDeviceEvent; return viewer; };
  try {
    await context.controller.start();
    await context.controller.openDocument({ size: Buffer.byteLength(source), name: 'test.json', text: async () => source });
    context.controller.admit();
    const curve = viewer.getState().documentBodies.find(row => row.ref.kind === 'curve');
    context.controller.select(curve.ref);
    context.controller.inspectDocumentPoint({ kind: 'curve', parameter: 2 });
    context.controller.setInspectedMeasurementPoint('a');
    context.controller.inspectDocumentPoint({ kind: 'curve', parameter: 7 });
    context.controller.setInspectedMeasurementPoint('b');
    assert.ok(context.model.measurement.result);
    assert.equal(await context.controller.saveNamedView('Keep'), true);
    const snapshot = () => ({ state: viewer.getState(), source: window.cadViewerEvidence.source(),
      review: viewer.captureReviewState(), measurement: structuredClone(context.model.measurement),
      named: window.cadViewerEvidence.namedViews() });
    const before = snapshot();
    viewer.resize = () => { throw new Error('injected resize error'); };
    context.canvas.rect.width = 700;
    observers[0].callback();
    assert.equal(context.model.status, 'injected resize error');
    assert.deepEqual(snapshot(), before);
    notify({ type: 'lost' });
    notify({ type: 'recovery-failed' });
    assert.equal(context.model.deviceStatus, 'WebGPU recovery failed');
    assert.deepEqual(snapshot(), before);
    notify({ type: 'lost' });
    assert.equal(context.model.deviceStatus, 'WebGPU recovery failed');
    assert.deepEqual(snapshot(), before);
    notify({ type: 'recreated' });
    assert.equal(context.model.deviceStatus, 'WebGPU device recreated');
    assert.deepEqual(snapshot(), before);
    context.controller.dispose();
    notify({ type: 'recovery-failed' });
    assert.equal(context.model.deviceStatus, 'WebGPU device recreated');
  } finally { context.controller.dispose(); }
});
