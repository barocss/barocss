// #1959: one React root, at most three controller lifetimes; real React/controller/engine and CPU receiver; provider codec is mocked.
// Frozen ledger: 14 grouped cases and at most 40 controlled Worker replies.
// New three-driver source is an adaptation, never a measured native authoring receipt.
// Provider, Worker, ResizeObserver and display-port execution are explicit controlled boundaries.
// Geometry is the genuine retained #1835 baseline for EVERY reply, including edited parameters.
// Edited-state geometry, native execution, WebGPU pixels and physical browser I/O are UNRUN.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../..');
const depsRoot = resolve(process.env.REPO_DEPS_ROOT ?? root);
const require = createRequire(resolve(depsRoot, 'package.json'));
const esbuild = require('esbuild');
const fixturePath = 'packages/barocss-cad/test/modeling-constraints-evidence/baseline-transfer.json';
const fixtureBytes = readFileSync(resolve(root, fixturePath));
const fixtureHash = '194b855ed3e862e76c2468cbbcb0d2f21f7b2eda0a217325fa95a32fee226721';
const hash = value => createHash('sha256').update(value).digest('hex');
const baseline = JSON.parse(fixtureBytes), authored = JSON.parse(baseline.text);
const groups = [], sessions = [], workers = [], displays = [], observers = [], emissions = [];
const ledger = [
  'retained baseline and actual mounted modules',
  'global Preview Apply exact candidate and Undo',
  'Sketch pinned target and Cancel restoration',
  'Extrude pinned target and Escape restoration',
  'repeat Preview replaces one candidate and input invalidates',
  'normalized equivalent Preview Apply performs no geometric work',
  'input and native-shaped diagnostic review focus',
  'metadata-only preview and accepted-only File Blob',
  'Cancel computation ignores late reply and explicit recovery',
  'stale rendered callbacks raw ABA and command replacement',
  'new-part command and accepted-source ABA guard',
  'prop replacement and controller lifetime callbacks',
  'ready worker loss and recovery restores accepted authority',
  'unmount during pending display ignores late handle and reply',
];
const stats = { replies: 0, providerLoads: 0, providerEdits: 0, previewReplays: 0, nativeCalls: 0 };
const globals = new Map();
function setGlobal(name, value) {
  if (!globals.has(name)) globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}
async function group(name, run) {
  assert.ok(groups.length < 14, 'Frozen 14-group ledger ceiling');
  assert.equal(name, ledger[groups.length], 'Frozen ledger order');
  try { await run(); } catch (cause) {
    console.error(JSON.stringify({ group: groups.length + 1, name, status: 'FAIL', mountedRoots, controllerLifetimes: sessions.length, ...stats, error: String(cause) }));
    throw cause;
  }
  groups.push(name);
  console.log(JSON.stringify({ group: groups.length, name, status: 'PASS' }));
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  return value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
}
// Only the mocked provider substitutes its codec/native bodies; the real engine projects them.
const signedJSON = value => JSON.stringify(canonical(value), (_key, value) => Object.is(value, -0) ? '__NEG_ZERO__' : value)
  .replaceAll('"__NEG_ZERO__"', '-0') + '\n';
const forbidden = () => { stats.nativeCalls++; throw Error('New native or legacy execution is outside this flow.'); };
function providerSnapshot(data) {
  return {
    parameters: structuredClone(data.parameters), suppression: {}, features: structuredClone(baseline.features),
    bodies: structuredClone(baseline.bodies), save: () => signedJSON(data),
    withParameters(changes) {
      stats.providerEdits++;
      const parameters = { ...data.parameters, ...changes };
      if (parameters.thickness <= 0) {
        // Explicit native-shaped diagnostic double, not genuine native execution.
        const error = new Error('CAD model extrude: Controlled provider refusal: thickness must be positive.');
        error.name = 'CadModelError'; error.code = 'PARAMETER'; error.operation = 'extrude';
        error.cause = { privateNativeSentinel: true }; throw error;
      }
      return providerSnapshot({ ...data, parameters });
    },
    withSuppression: forbidden,
  };
}
setGlobal('__modelingDraftPreviewFlow', {
  cad: { model: forbidden, load(text) { stats.providerLoads++; return providerSnapshot(JSON.parse(text)); } },
  tessellateConvexPlanarSolid(solid, options) {
    assert.deepEqual(solid, baseline.bodies.part.native);
    assert.deepEqual(options, { maximumFanTriangles: 40 });
    stats.previewReplays++;
    return structuredClone(baseline.preview);
  },
  tessellateSurface: forbidden, tessellateOwnPlateCircularHole: forbidden, tessellateXYCirclePrismShell: forbidden,
  controller(create, ...args) {
    assert.ok(sessions.length < 3, 'Frozen three-mounted-session ceiling');
    const controller = create(...args), calls = [];
    controller.subscribe(() => emissions.push(controller.getSnapshot()));
    const session = new Proxy(controller, { get(target, name) {
      const value = target[name];
      if (typeof value !== 'function' || name === 'getSnapshot') return value;
      return (...args) => { calls.push({ name, args }); return value(...args); };
    } });
    sessions.push({ controller, session, calls }); return session;
  },
  // Reversible renderer/display-port double. The dedicated display test owns
  // actual canvas lifecycle evidence; this flow asserts React/controller calls.
  display(host) {
    const record = { host, prepares: 0, previewPrepares: 0, shows: 0, commits: 0,
      candidateDisposals: 0, resizes: 0, disposals: 0, candidates: [],
      accepted: null, visible: null, holdNext: false, release: null };
    displays.push(record);
    const prepare = async (scene, preview) => {
      record.prepares++; if (preview) record.previewPrepares++;
      const candidate = { scene, preview, committed: false, disposed: false,
        show() { assert.ok(preview && !this.disposed); record.shows++; record.visible = scene; },
        commit() { assert.ok(!this.disposed); this.committed = true; record.commits++; record.accepted = scene; record.visible = scene; },
        dispose() { if (this.disposed) return; this.disposed = true; record.candidateDisposals++;
          if (!this.committed && record.visible === scene) record.visible = record.accepted; },
      };
      record.candidates.push(candidate);
      if (record.holdNext) {
        record.holdNext = false;
        await new Promise(resolve => { record.release = () => { record.release = null; resolve(); }; });
      }
      return candidate;
    };
    return {
      prepare(scene) { return prepare(scene, false); }, preparePreview(scene) { return prepare(scene, true); },
      aspect() { return 1.5; }, dimensions() { return { width: 900, height: 600 }; },
      resize() { record.resizes++; },
      dispose() { record.disposals++; record.visible = null; },
    };
  },
});
const source = name => resolve(root, `packages/barocss-cad-editor/src/${name}`);
// Optional diagnostic-only source substitution proves regressions without editing
// current product files. Receipts hash the substituted editor bytes, not HEAD.
const editorOverridePath = process.env.MODELING_PREVIEW_EDITOR_SOURCE;
const editorOverride = editorOverridePath ? readFileSync(resolve(editorOverridePath), 'utf8') : null;
const boundaryPlugin = { name: 'explicit-draft-preview-boundaries', setup(build) {
  if (editorOverride !== null) build.onLoad({ filter: /[\\/]react[\\/]modeling-editor\.tsx$/ }, () => ({
    contents: editorOverride, loader: 'tsx', resolveDir: resolve(root, 'packages/barocss-cad-editor/src/react'),
  }));
  build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\.\/modeling-controller\.js$/ }, () => ({ path: 'controller', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\.\/prism-feature-display\.js$/ }, () => ({ path: 'display', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'workspace-boundary' }));
  build.onLoad({ filter: /.*/, namespace: 'workspace-boundary' }, ({ path }) => ({ resolveDir: root, contents: {
    provider: 'export const {cad,tessellateConvexPlanarSolid,tessellateSurface,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell} = globalThis.__modelingDraftPreviewFlow;',
    legacy: 'export function createPrismFeatureEngine() { return () => { throw Error("Legacy native execution is outside this flow."); }; }',
    controller: `import {createCadEditorModelingController as create} from ${JSON.stringify(source('modeling-controller.ts'))}; export const createCadEditorModelingController = (...args) => globalThis.__modelingDraftPreviewFlow.controller(create, ...args);`,
    display: 'export const createPrismFeatureDisplay = globalThis.__modelingDraftPreviewFlow.display;',
    gpu: ['engine-scene', 'engine-camera-ray', 'engine-raycast', 'kernel-face-preview'].map(name =>
      `export * from ${JSON.stringify(resolve(root, `packages/barocss-gpu/src/${name}.ts`))};`).join('\n'),
  }[path] }));
} };
async function bundle(entry) {
  const result = await esbuild.build({ entryPoints: [source(entry)], bundle: true, platform: 'node',
    format: 'cjs', jsx: 'automatic', write: false, metafile: true, logLevel: 'silent',
    external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/*', 'radix-ui', 'class-variance-authority', 'clsx', 'tailwind-merge'],
    nodePaths: [resolve(depsRoot, 'node_modules')], plugins: [boundaryPlugin],
    define: { 'import.meta.url': JSON.stringify(pathToFileURL(source(entry)).href) } });
  const inputs = Object.keys(result.metafile.inputs);
  assert.ok(!inputs.some(path => /(?:\.wasm|barocss-cad\/src\/|prism-feature-display\.ts$)/.test(path)), 'Native/GPU display implementations must not execute');
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
  return { api: module.exports, inputs };
}
const engine = await bundle('modeling-engine.ts');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://example.invalid/' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Event', 'MouseEvent', 'KeyboardEvent', 'navigator']) setGlobal(name, dom.window[name]);
setGlobal('IS_REACT_ACT_ENVIRONMENT', true);
setGlobal('ResizeObserver', class {
  constructor(callback) { this.callback = callback; this.observed = []; this.disconnections = 0; observers.push(this); }
  observe(node) { this.observed.push(node); }
  disconnect() { this.disconnections++; }
});
setGlobal('Worker', class {
  callbacks = new Map(); requests = []; answered = new Set(); computed = new Map(); terminated = false;
  engine = engine.api.createModelingEngine();
  constructor() { workers.push(this); }
  addEventListener(kind, callback) { this.callbacks.set(kind, callback); }
  postMessage(command) { this.requests.push(structuredClone(command)); }
  terminate() { this.terminated = true; }
  compute(command = this.requests.find(command => !this.computed.has(command.id))) {
    assert.ok(command && !this.computed.has(command.id));
    // Preserve posted order, including fire-and-forget discards before prepares.
    const earlier = this.requests.slice(0, this.requests.indexOf(command));
    assert.ok(earlier.every(item => this.computed.has(item.id)), 'Controlled Worker preserves message order');
    const reply = this.engine(command); this.computed.set(command.id, structuredClone(reply));
    return structuredClone(reply);
  }
  deliver(reply) {
    assert.ok(++stats.replies <= 40, 'Frozen 40-controlled-reply ceiling');
    this.answered.add(reply.id); this.lastReply = structuredClone(reply);
    this.callbacks.get('message')({ data: structuredClone(reply) }); return reply;
  }
  accept(command = this.requests.find(command => !this.answered.has(command.id))) {
    assert.ok(command && !this.answered.has(command.id));
    return this.deliver(this.computed.get(command.id) ?? this.compute(command));
  }
});
const React = require('react'), { createRoot } = require('react-dom/client'), { act } = React;
const ui = await bundle('react/modeling-editor.tsx');
const builder = await bundle('modeling-rectangular-part.ts');
const { createRectangularPartSource: createSource } = builder.api;
const container = document.getElementById('root');
let reactRoot, mountedRoots = 0;
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const current = () => sessions.at(-1).controller.getSnapshot();
const port = () => displays.at(-1);
const observer = () => observers.at(-1);
const buttons = () => [...container.querySelectorAll('button')];
const button = label => buttons().find(node => !node.closest('[hidden]') && (node.getAttribute('aria-label') ?? node.textContent.trim()) === label);
const testid = name => container.querySelector(`[data-testid="${name}"]`);
const input = label => {
  const node = [...container.querySelectorAll('label')].find(node => node.textContent.trim() === label);
  return node ? document.getElementById(node.htmlFor) : null;
};
const click = async node => {
  assert.ok(node, 'Expected control must exist');
  await act(async () => {
    const menus = []; for (let parent = node.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS' && !parent.open) menus.unshift(parent);
    }
    for (const menu of menus) menu.querySelector(':scope > summary').click();
    if (!node.disabled) node.focus();
    node.click(); await tick();
  });
};
const change = async (node, value) => {
  assert.ok(node, 'Expected field must exist');
  await act(async () => {
    node.focus();
    const prototype = node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, value);
    node.dispatchEvent(new Event('input', { bubbles: true })); await tick();
  });
};
const key = async (node, key, fields = {}) => {
  assert.ok(node, 'Expected keyboard target must exist');
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...fields });
  await act(async () => { node.dispatchEvent(event); await tick(); }); return event;
};
const settled = async () => {
  for (let step = 0; step < 40; step++) {
    await act(async () => {
      const worker = workers.at(-1), command = worker?.requests.find(item => !worker.answered.has(item.id));
      if (worker && !worker.terminated && command) worker.accept(command);
      await tick();
    });
    const worker = workers.at(-1);
    if (!current().busy && (!worker || worker.terminated || worker.requests.every(item => worker.answered.has(item.id)))) return;
  }
  assert.fail('Bounded controlled Worker pump did not settle');
};
const authority = () => {
  const { accepted, authoredText, display, faceSelection, generation, history } = current();
  return { accepted, authoredText, display, faceSelection, generation, history };
};
const commands = () => workers.reduce((count, worker) => count + worker.requests.length, 0);
async function mount(props) {
  assert.ok(++mountedRoots <= 1, 'Frozen one-React-root ceiling');
  reactRoot = createRoot(container);
  await act(async () => { reactRoot.render(React.createElement(ui.api.CadEditorModeling, { initialAuthoredText: defaultText, ...props })); await tick(); });
  await settled();
}
async function rerender(props) {
  await act(async () => { reactRoot.render(React.createElement(ui.api.CadEditorModeling, { initialAuthoredText: defaultText, ...props })); await tick(); });
}
async function unmount() {
  await act(async () => { reactRoot.unmount(); await tick(); }); reactRoot = null;
}

// The rectangle and all edited dimensions are authored adaptations; every successful
// engine response reuses unchanged retained #1835 geometry, never new native output.
const defaultText = createSource({ width: '32', height: '24', thickness: '8' });
const defaultData = JSON.parse(defaultText);
const acceptedDefaultText = signedJSON(defaultData);
const defaultHash = 'a354312ac37f51e58f8d94614e11bca9d73b1f17410c1a36eb08f8d9090c06ef';
const otherText = signedJSON({ ...defaultData, parameters: { ...defaultData.parameters, width: 35 } });
const visible = node => !!node && !node.closest('[hidden]');
const panel = name => testid(`modeling-panel-${name}`);
const assertPanel = name => {
  assert.ok(visible(testid('modeling-options')), 'Options must be visible');
  assert.ok(visible(panel(name)), `${name} panel must be visible`);
};
const assertClosed = () => assert.equal(visible(testid('modeling-options')), false);
const assertOptionsFocus = () => assert.equal(document.activeElement, testid('modeling-options').querySelector(':scope > header h2'));
const files = async () => { await click(button('Save or open a model')); assertPanel('files'); };
const downloadButton = () => button(Object.keys(current().drafts).length ? 'Download accepted model' : 'Download model');
const feature = index => testid('modeling-browser').querySelector(`button[data-feature-index="${index}"]`);
const select = async index => { await click(feature(index)); assert.equal(current().selection, index); };
const callCounts = () => Object.fromEntries(['preview', 'clearPreview', 'apply', 'discard', 'open', 'stage', 'pick', 'cancel'].map(name =>
  [name, sessions.reduce((total, item) => total + item.calls.filter(call => call.name === name).length, 0)]));
// Capture real mounted handlers to represent queued callbacks after a rerender.
// No product event handler, controller method or state validation is substituted.
const reactCallback = (node, name) => {
  assert.ok(node, `Expected React ${name} target`);
  const props = Object.keys(node).find(key => key.startsWith('__reactProps$'));
  assert.ok(props && typeof node[props][name] === 'function', `Actual React ${name} must exist`);
  return node[props][name];
};
const errors = () => [...container.querySelectorAll('[role="alert"]')].map(node => node.textContent);
const baselineGeometry = () => {
  const snapshot = current();
  assert.equal(snapshot.display.packet.profile, 'model-outputs');
  assert.equal(snapshot.display.packet.components.length, 1);
  for (const name of ['mesh', 'boundaries', 'internalDiagonals', 'report']) {
    assert.deepEqual(snapshot.display.packet.components[0][name], baseline.preview[name], `Genuine baseline replay: ${name}`);
  }
  assert.equal(snapshot.display.scene.geometries[0].positions.length, 24 * 3);
  assert.equal(snapshot.display.scene.geometries[0].indices.length, 12 * 3);
};

// Real Blob bytes cross mocked browser URL and anchor boundaries. No physical
// chooser, download completion, disk persistence or browser GPU claim is made.
const NativeBlob = globalThis.Blob;
const io = { blobs: [], urls: [], clicks: [], removes: [], revokes: [] };
setGlobal('Blob', class extends NativeBlob {
  constructor(parts, options) { super(parts, options); io.blobs.push(this); }
});
const urlDescriptors = new Map(['createObjectURL', 'revokeObjectURL'].map(name => [name, Object.getOwnPropertyDescriptor(URL, name)]));
Object.defineProperty(URL, 'createObjectURL', { configurable: true, value(blob) {
  assert.ok(blob instanceof NativeBlob); const url = `blob:controlled-preview-save/${io.urls.length + 1}`;
  io.urls.push({ blob, url }); return url;
} });
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value(url) { io.revokes.push(url); } });
const originalCreateElement = document.createElement;
const nativeRemove = dom.window.Element.prototype.remove;
document.createElement = function(name, ...args) {
  const element = originalCreateElement.call(this, name, ...args);
  if (String(name).toLowerCase() === 'a') {
    element.click = () => io.clicks.push({ anchor: element, filename: element.download, href: element.href, connected: element.isConnected });
    element.remove = () => { io.removes.push(element); nativeRemove.call(element); };
  }
  return element;
};
const previewButton = () => button(current().workerReady ? 'Preview dimensions' : 'Recover accepted model and preview');
const globalEdit = async () => { await click(button('Edit model dimensions')); assertPanel('dimensions'); };
const preview = async () => { await click(previewButton()); await settled(); assert.equal(current().preview?.status, 'ready', errors().join(' ')); };
const cancel = async () => { await click(button('Cancel')); await settled(); assertClosed(); };
const capturePreview = () => reactCallback(previewButton(), 'onClick');
const assertReady = before => {
  assert.deepEqual(authority(), before, 'Preview keeps every accepted authority field unchanged');
  assert.equal(current().preview.status, 'ready'); assert.notEqual(port().visible, port().accepted);
  assert.match(testid('modeling-preview-status').textContent, /Unapplied draft preview/);
  assert.match(testid('modeling-preview-status').textContent, /Apply or Cancel before selecting a face/);
};
const assertRestored = before => {
  assert.deepEqual(authority(), before); assert.equal(current().preview, null);
  assert.equal(port().visible, port().accepted); assert.deepEqual(current().drafts, {});
};
const assertMetadata = snapshot => {
  if (!snapshot.preview) return;
  assert.ok(Object.keys(snapshot.preview).every(key => ['status', 'parameters', 'outputs', 'diagnostic'].includes(key)));
  assert.ok(['computing', 'ready', 'unchanged', 'error'].includes(snapshot.preview.status));
  const inspect = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!['packet', 'display', 'scene', 'text', 'authoredText', 'native', 'binding', 'workerToken', 'candidateToken', 'previewTaskToken', 'cause', 'stack'].includes(key), `Preview metadata excludes ${key}`);
      inspect(child);
    }
  };
  inspect(snapshot.preview); assert.ok(JSON.stringify(snapshot.preview).length < 262144);
};
async function assertStale(callback, label) {
  const before = current(), counts = callCounts(), requests = commands(), shown = port().visible;
  const focus = document.activeElement, diagnostic = errors();
  await act(async () => { callback(); await tick(); });
  assert.deepEqual(current(), before, label); assert.deepEqual(callCounts(), counts, label);
  assert.equal(commands(), requests, label); assert.equal(port().visible, shown, label);
  assert.deepEqual(errors(), diagnostic, label); assert.equal(document.activeElement, focus, label);
}
async function openText(text) {
  let operation;
  await act(async () => { operation = sessions.at(-1).controller.open(text); await tick(); });
  await settled(); await operation;
  assert.equal(current().error, null); assert.deepEqual(JSON.parse(current().authoredText), JSON.parse(text));
}
const proofPaths = ['packages/barocss-cad-editor/src/react/modeling-editor.tsx',
  'packages/barocss-cad-editor/src/react/modeling-workspace.tsx',
  'packages/barocss-cad-editor/src/modeling-rectangular-part.ts',
  'packages/barocss-cad-editor/src/modeling-controller.ts',
  'packages/barocss-cad-editor/src/modeling-engine.ts',
  'packages/barocss-cad-editor/src/modeling-diagnostic.ts',
  'packages/barocss-cad-editor/src/modeling-scene.ts',
  'packages/barocss-cad-editor/src/modeling-file.ts',
  'packages/barocss-cad-editor/src/prism-feature-controller.ts',
  'apps/cad-editor/flows/modeling-draft-preview-flow.mjs'];
const sourceHashes = Object.fromEntries(proofPaths.map(path => [path, hash(
  path.endsWith('/react/modeling-editor.tsx') && editorOverride !== null ? editorOverride : readFileSync(resolve(root, path)))]));
console.log(JSON.stringify({ status: 'START', issue: 1959, editorOverridePath: editorOverridePath ?? null, ledger, sourceHashes, fixtureSHA256: hash(fixtureBytes),
  limits: { groups: 14, reactRoots: 1, maximumControllerLifetimes: 3, maximumReplies: 40, nativeCalls: 0 } }));
let viewport, firstSessionCallback;
try {
  await group(ledger[0], async () => {
    assert.equal(fixtureBytes.length, 292980); assert.equal(hash(fixtureBytes), fixtureHash);
    assert.equal(signedJSON(authored), baseline.text); assert.equal(hash(defaultText), defaultHash);
    assert.deepEqual(defaultData.parameters, { width: 32, height: 24, thickness: 8 });
    for (const suffix of ['react/modeling-editor.tsx', 'react/modeling-workspace.tsx', 'modeling-sketch-command.ts',
      'modeling-extrusion-command.ts', 'modeling-rectangular-part.ts', 'modeling-controller.ts', 'modeling-diagnostic.ts',
      'modeling-scene.ts', 'prism-feature-controller.ts', 'modeling-file.ts']) {
      assert.ok(ui.inputs.some(path => path.endsWith(suffix)), `Actual source bundled: ${suffix}`);
    }
    assert.ok(engine.inputs.some(path => path.endsWith('modeling-engine.ts')));
    await mount({ workspace: true }); viewport = testid('modeling-viewport'); assert.ok(viewport);
    viewport.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, width: 900, height: 600, right: 900, bottom: 600 });
    assert.equal(sessions.length, 1); assert.equal(stats.replies, 1); assertClosed(); baselineGeometry();
    assert.equal(current().authoredText, acceptedDefaultText); assert.equal(port().visible, port().accepted);
  });
  await group(ledger[1], async () => {
    await globalEdit(); const before = authority(), acceptedScene = port().accepted, editCount = stats.providerEdits;
    await change(input('thickness (mm)'), '10'); assert.equal(stats.providerEdits, editCount);
    await preview(); assertReady(before); assert.equal(port().accepted, acceptedScene);
    assert.equal(stats.providerEdits, editCount + 1);
    const candidate = port().visible, cached = structuredClone(workers.at(-1).lastReply), replays = stats.previewReplays;
    assert.equal(JSON.parse(cached.text).parameters.thickness, 10);
    const counts = callCounts(); await click(viewport); assert.equal(callCounts().pick, counts.pick, 'Candidate faces cannot be picked');
    await click(button('Apply dimensions')); assert.deepEqual(authority(), before, 'Accepted UI waits for acknowledgement');
    await settled(); assert.equal(current().accepted.parameters.thickness, 10);
    assert.equal(current().authoredText, cached.text); assert.deepEqual(current().accepted, cached.summary);
    assert.equal(port().accepted, candidate); assert.equal(stats.providerEdits, editCount + 1); assert.equal(stats.previewReplays, replays);
    assert.equal(current().generation, before.generation + 1); assert.equal(current().history.count, before.history.count + 1); assertClosed();
    await click(button('Undo')); await settled();
    assert.equal(current().accepted.parameters.thickness, 8); assert.equal(current().authoredText, before.authoredText); baselineGeometry();
  });
  await group(ledger[2], async () => {
    await select(0); await click(button('Edit sketch dimensions')); assertPanel('sketch'); assertOptionsFocus();
    const before = authority(); await change(input('Max X · width (mm)'), '36'); await preview(); assertReady(before);
    const replacedSketch = port().candidates.at(-1);
    await click(button('Edit sketch dimensions')); await settled();
    assert.equal(current().preview, null, 'Reopening the same Sketch panel replaces the command and clears its preview');
    assert.equal(port().visible, port().accepted); assert.equal(replacedSketch.disposed, true);
    assert.equal(current().drafts.width, '36'); assert.deepEqual(authority(), before);
    await preview(); assertReady(before); assert.notEqual(port().candidates.at(-1), replacedSketch);
    await select(1); assertPanel('sketch'); assert.match(panel('sketch').textContent, /Sketch 01/);
    assert.equal(input('Max X · width (mm)').value, '36'); assert.equal(current().preview.status, 'ready');
    await cancel(); assertRestored(before); assert.equal(current().selection, 1);
  });
  await group(ledger[3], async () => {
    await click(button('Edit extrusion')); assertPanel('extrusion'); assertOptionsFocus(); const before = authority();
    await change(input('Height · thickness (mm)'), '11'); await preview(); assertReady(before);
    const replacedExtrusion = port().candidates.at(-1);
    await click(button('Edit extrusion')); await settled();
    assert.equal(current().preview, null, 'Reopening the same Extrude panel replaces the command and clears its preview');
    assert.equal(port().visible, port().accepted); assert.equal(replacedExtrusion.disposed, true);
    assert.equal(current().drafts.thickness, '11'); assert.deepEqual(authority(), before);
    await preview(); assertReady(before); assert.notEqual(port().candidates.at(-1), replacedExtrusion);
    await select(0); assertPanel('extrusion'); assert.match(panel('extrusion').textContent, /Extrude 01/);
    await key(input('Height · thickness (mm)'), 'Escape'); await settled(); assertClosed(); assertRestored(before);
  });
  await group(ledger[4], async () => {
    await globalEdit(); const before = authority(), acceptedScene = port().accepted;
    await change(input('width (mm)'), '36'); await preview(); const first = port().candidates.at(-1);
    const edits = stats.providerEdits; await preview(); const second = port().candidates.at(-1);
    assert.notEqual(first, second); assert.equal(first.disposed, true); assert.equal(second.disposed, false);
    assert.equal(stats.providerEdits, edits + 1); assert.equal(port().accepted, acceptedScene); assertReady(before);
    await change(input('width (mm)'), '37');
    assert.equal(current().preview, null); assert.equal(port().visible, acceptedScene); assert.equal(second.disposed, true);
    assert.equal(stats.providerEdits, edits + 1, 'Typing never evaluates a candidate'); await settled();
    assert.deepEqual(authority(), before); await cancel();
  });
  await group(ledger[5], async () => {
    await globalEdit(); const before = authority(), requests = commands(), edits = stats.providerEdits, replays = stats.previewReplays;
    await change(input('width (mm)'), ' 3.2e1 ');
    // This panel has no replacement target. Reopening must preserve the rendered
    // callback's identity so the actual visible Preview button remains usable.
    await globalEdit(); await click(previewButton()); await settled();
    assert.equal(current().preview.status, 'unchanged'); assert.equal(current().drafts.width, ' 3.2e1 ');
    assert.match(testid('modeling-preview-status').textContent, /No geometric changes/); assert.equal(port().visible, port().accepted);
    await click(button('Apply dimensions')); await settled(); assertClosed(); assertRestored(before);
    assert.equal(commands(), requests); assert.equal(stats.providerEdits, edits); assert.equal(stats.previewReplays, replays);
  });
  await group(ledger[6], async () => {
    await select(1); await click(button('Edit extrusion')); const before = authority(), requests = commands();
    await change(input('Height · thickness (mm)'), 'nope'); await click(previewButton()); await settled();
    assert.equal(current().preview.status, 'error'); assert.equal(current().preview.diagnostic.stage, 'input'); assert.equal(commands(), requests);
    await click(button('Review editing target')); assertOptionsFocus();
    await change(input('Height · thickness (mm)'), '-1'); await click(previewButton()); await settled();
    assert.deepEqual(current().preview.diagnostic, { stage: 'native', code: 'PARAMETER', operation: 'extrude',
      message: 'CAD model extrude: Controlled provider refusal: thickness must be positive.' });
    const diagnostic = testid('modeling-preview-diagnostic').textContent;
    assert.match(diagnostic, /While editing Extrude 01/); assert.match(diagnostic, /native.*PARAMETER.*engine operation extrude/);
    assert.match(diagnostic, /not an identified failing feature/); assert.doesNotMatch(diagnostic, /privateNativeSentinel|stack|cause/);
    await click(button('Review editing target')); assertOptionsFocus(); assert.deepEqual(authority(), before);
    assert.equal(current().drafts.thickness, '-1'); await cancel(); assertRestored(before);
  });
  await group(ledger[7], async () => {
    await globalEdit(); await change(input('thickness (mm)'), '10'); const before = authority(); await preview(); assertReady(before);
    assertMetadata(current()); const copied = current(); copied.preview.parameters.thickness = 999;
    assert.equal(current().preview.parameters.thickness, 10, 'Snapshot copies cannot mutate private candidate metadata');
    await files(); await settled(); assert.equal(current().preview, null); assert.equal(port().visible, port().accepted);
    assert.equal(current().drafts.thickness, '10'); const requests = commands(), edits = stats.providerEdits;
    await click(downloadButton()); assert.equal(io.blobs.length, 1); const blob = io.blobs[0];
    assert.equal(blob.type, 'application/json'); assert.equal(await blob.text(), before.authoredText);
    assert.deepEqual(Buffer.from(await blob.arrayBuffer()), Buffer.from(before.authoredText, 'utf8'));
    assert.equal(JSON.parse(await blob.text()).parameters.thickness, 8);
    assert.equal(io.clicks[0].filename, 'part.cad.json'); assert.equal(io.clicks[0].connected, true);
    assert.equal(io.removes[0], io.clicks[0].anchor); assert.equal(io.removes[0].isConnected, false);
    assert.equal(io.revokes[0], io.urls[0].url); assert.equal(commands(), requests); assert.equal(stats.providerEdits, edits);
    assert.deepEqual(authority(), before); await click(button('Review dimensions before saving')); await cancel();
    for (const snapshot of emissions) assertMetadata(snapshot);
  });
  await group(ledger[8], async () => {
    await globalEdit(); await change(input('thickness (mm)'), '10'); const before = authority();
    await click(previewButton()); assert.equal(current().preview.status, 'computing');
    const oldWorker = workers.at(-1), lateReply = oldWorker.compute();
    await click(button('Cancel computation')); assert.equal(oldWorker.terminated, true);
    assert.deepEqual(authority(), before); assert.equal(current().preview, null); assert.equal(current().drafts.thickness, '10');
    const afterCancel = current(); await act(async () => { oldWorker.deliver(lateReply); await tick(); }); assert.deepEqual(current(), afterCancel);
    assert.ok(button('Recover accepted model and preview'));
    assert.match(testid('modeling-options').textContent, /reconstructs the accepted model, then evaluates pending dimensions/);
    const loads = stats.providerLoads, edits = stats.providerEdits; await preview(); assertReady(before);
    assert.equal(stats.providerLoads, loads + 1); assert.equal(stats.providerEdits, edits + 1);
    await click(button('Apply dimensions')); await settled(); assert.equal(current().accepted.parameters.thickness, 10);
    assert.equal(stats.providerEdits, edits + 1); assertClosed();
  });
  await group(ledger[9], async () => {
    await globalEdit(); await change(input('width (mm)'), '36'); const staleRender = capturePreview(); const before = authority();
    await preview(); const candidate = port().candidates.at(-1); const readyCallback = capturePreview();
    await change(input('width (mm)'), '37'); await change(input('width (mm)'), '36'); await settled();
    assert.equal(candidate.disposed, true); assert.equal(current().preview, null); assert.equal(port().visible, port().accepted);
    await assertStale(staleRender, 'Raw ABA cannot revive a pre-preview callback');
    await assertStale(readyCallback, 'Raw ABA cannot revive a ready-render callback');
    await preview(); assertReady(before); const replacedCallback = capturePreview();
    await click(button('New rectangular part')); await settled(); assertPanel('new-part');
    assert.equal(current().preview, null); assert.equal(port().visible, port().accepted); assert.equal(current().drafts.width, '36');
    await assertStale(replacedCallback, 'Replaced command cannot initiate Preview');
    await click(button('Cancel')); assertClosed(); await globalEdit(); await cancel();
  });
  await group(ledger[10], async () => {
    await globalEdit(); await change(input('width (mm)'), '36'); const oldCallback = capturePreview(), oldSource = current().authoredText;
    await cancel(); await click(button('New rectangular part')); assertPanel('new-part');
    assert.equal(input('Width (mm)').value, '32'); await click(button('Replace current model')); await settled(); assertClosed();
    assert.equal(current().accepted.parameters.thickness, 8); assert.equal(current().history.count, 1);
    await openText(otherText); await openText(oldSource); assert.equal(current().authoredText, oldSource);
    await globalEdit(); await change(input('width (mm)'), '36');
    await assertStale(oldCallback, 'Accepted source ABA still rejects stale generation'); await cancel();
  });
  await group(ledger[11], async () => {
    await globalEdit(); await change(input('width (mm)'), '36'); firstSessionCallback = capturePreview();
    const oldController = sessions.at(-1).controller, oldPort = port(), oldWorker = workers.at(-1);
    await rerender({ workspace: true, initialAuthoredText: otherText }); await settled();
    assert.equal(sessions.length, 2); assert.equal(oldController.getSnapshot().disposed, true);
    assert.equal(oldPort.disposals, 1); assert.equal(oldWorker.terminated, true); assert.equal(testid('modeling-viewport'), viewport);
    await assertStale(firstSessionCallback, 'Old controller Preview callback is inert after prop replacement');
    await globalEdit(); await change(input('width (mm)'), '37'); const secondCallback = capturePreview(), secondPort = port();
    secondPort.holdNext = true; await click(previewButton());
    await act(async () => { workers.at(-1).accept(); await tick(); });
    assert.equal(current().busy, true); assert.equal(typeof secondPort.release, 'function'); const held = secondPort.candidates.at(-1);
    await rerender({ workspace: true }); await settled(); assert.equal(sessions.length, 3);
    const before = current(), commits = port().commits, shown = port().visible;
    await act(async () => { secondPort.release(); await tick(); });
    assert.equal(held.disposed, true); assert.deepEqual(current(), before); assert.equal(port().commits, commits); assert.equal(port().visible, shown);
    await assertStale(secondCallback, 'Old pending controller callback cannot target the replacement'); assertClosed();
  });
  await group(ledger[12], async () => {
    await globalEdit(); await change(input('thickness (mm)'), '10'); const before = authority(); await preview();
    const failedWorker = workers.at(-1); await act(async () => { failedWorker.callbacks.get('error')({}); await tick(); });
    assert.equal(failedWorker.terminated, true); assert.equal(current().workerReady, false); assert.equal(current().preview, null);
    assert.deepEqual(authority(), before); assert.equal(port().visible, port().accepted); assert.equal(current().drafts.thickness, '10');
    assert.ok(button('Recover accepted model and preview')); await preview(); assertReady(before);
    await cancel(); assertRestored(before);
  });
  await group(ledger[13], async () => {
    await globalEdit(); await change(input('thickness (mm)'), '12'); const callback = capturePreview();
    const before = authority(), activePort = port(), activeController = sessions.at(-1).controller;
    activePort.holdNext = true; await click(previewButton());
    const activeWorker = workers.at(-1); await act(async () => { activeWorker.accept(); await tick(); });
    assert.equal(current().busy, true); const held = activePort.candidates.at(-1), lateReply = structuredClone(activeWorker.lastReply), commits = activePort.commits;
    await unmount(); assert.equal(activeController.getSnapshot().disposed, true); assert.equal(activeWorker.terminated, true);
    assert.equal(activePort.disposals, 1); assert.equal(observer().disconnections, 1);
    await act(async () => { activePort.release(); activeWorker.deliver(lateReply); callback(); firstSessionCallback(); await tick(); });
    assert.equal(held.disposed, true); assert.equal(activePort.commits, commits); assert.deepEqual(authority(), before);
    assert.equal(container.childElementCount, 0); assert.equal(current().preview, null);
    for (const snapshot of emissions) assertMetadata(snapshot);
  });
} finally {
  if (reactRoot) await unmount();
  for (const record of displays) if (record.release) record.release();
  document.createElement = originalCreateElement;
  for (const [name, descriptor] of urlDescriptors) {
    if (descriptor) Object.defineProperty(URL, name, descriptor); else delete URL[name];
  }
  dom.window.close();
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  }
}
assert.deepEqual(groups, ledger); assert.equal(mountedRoots, 1); assert.equal(sessions.length, 3);
assert.equal(displays.length, 3); assert.equal(observers.length, 3); assert.ok(stats.replies <= 40); assert.equal(stats.nativeCalls, 0);
console.log(JSON.stringify({ status: 'PASS', issue: 1959, node: process.version,
  runner: { executable: process.execPath, argv: process.argv.slice(1), command: [process.execPath, ...process.argv.slice(1)].map(value => JSON.stringify(value)).join(' ') },
  groups, mountedRoots, controllerLifetimes: sessions.length, emittedSnapshots: emissions.length, ...stats, sourceHashes,
  fixture: { path: fixturePath, sha256: fixtureHash }, adaptedDefaultSourceSHA256: defaultHash,
  boundaries: { actual: ['React', 'controller', 'engine', 'source builder and serializer projection', 'CPU scene receiver', 'Blob bytes'],
    controlled: ['provider codec and snapshot', 'Worker delivery', 'edited-state geometry replays', 'display-port and renderer', 'ResizeObserver', 'object URL and anchor'],
    unrun: ['new native geometry', 'physical browser', 'WebGPU pixels', 'physical download and disk persistence'] } }));
