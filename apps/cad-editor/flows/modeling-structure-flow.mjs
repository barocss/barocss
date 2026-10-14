// #1960: one React root, at most three controller lifetimes; real React/controller/engine and CPU receiver; provider codec is mocked.
// Frozen ledger: 14 grouped cases and at most 48 controlled Worker replies.
// Authored context and edited geometry are explicitly mocked; no source-exact native proof.
// Retained #1695 solids/Surface packets retain their complete native sources and UVs.
// Pure convex CPU projection stubs its native validator. No native geometry, WebGPU
// pixels or physical browser I/O runs here; volumes are retained fixture observations.
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
const fixturePath = 'packages/barocss-cad/test/modeling-composition-evidence/baseline-transfer.json';
const fixtureBytes = readFileSync(resolve(root, fixturePath));
const fixtureHash = '9a8ac520f0d4577b3a7e0ff411182e1c176eaaf8c73ac75073c129ae6380b79f';
const hash = value => createHash('sha256').update(value).digest('hex');
const baseline = JSON.parse(fixtureBytes);
const nativeFixtureHash = hash(JSON.stringify(baseline));
const groups = [], sessions = [], workers = [], displays = [], observers = [], emissions = [];
const ledger = [
  'Create/Add routing',
  'explicit pair IDs/consumption',
  'atomic Cut/options/limits',
  'Preview accepted unchanged',
  'Apply closes/onehistory',
  'Cancel/Escape',
  'field-edit candidate invalidation/ABA',
  'source/command/lifetime stale callback',
  'unrelated drafts retained',
  'structural Undo/Redo',
  'shared thickness changes disable Cut',
  'native/display refusal retains options/accepted',
  'accepted-only save',
  'cold Open/re-edit',
];
// Every response, including discard, failure, late reply and recovery seed, counts.
// Expected per-group delivered responses: 4,2,0,1,1,6,2,6,0,12,2,7,3,2 = 48.
const expectedReplyCounts = [4, 2, 0, 1, 1, 6, 2, 6, 0, 12, 2, 7, 3, 2];
const stats = { replies: 0, providerLoads: 0, providerEdits: 0, previewReplays: 0, surfaceReplays: 0, convexValidationStubs: 0, nativeCalls: 0 };
let providerRefusal = false;
const loadedNodeCounts = [], replyCounts = [];
const globals = new Map();
function setGlobal(name, value) {
  if (!globals.has(name)) globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}
async function group(name, run) {
  assert.ok(groups.length < 14, 'Frozen 14-group ledger ceiling');
  assert.equal(name, ledger[groups.length], 'Frozen ledger order');
  const beforeReplies = stats.replies;
  try { await run(); } catch (cause) {
    console.error(JSON.stringify({ group: groups.length + 1, name, status: 'FAIL', mountedRoots, controllerLifetimes: sessions.length, ...stats, error: String(cause) }));
    throw cause;
  }
  replyCounts.push(stats.replies - beforeReplies);
  assert.equal(replyCounts.at(-1), expectedReplyCounts[groups.length], 'Frozen per-group reply ledger');
  groups.push(name);
  console.log(JSON.stringify({ group: groups.length, name, status: 'PASS' }));
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  return value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
}
// The provider codec/feature projection is mocked. Native solids, sources, IDs,
// lineage and exact UV/XYZ packets remain unchanged from retained evidence.
const signedJSON = value => JSON.stringify(canonical(value), (_key, value) => Object.is(value, -0) ? '__NEG_ZERO__' : value)
  .replaceAll('"__NEG_ZERO__"', '-0') + '\n';
const forbidden = () => { stats.nativeCalls++; throw Error('New native or legacy execution is outside this flow.'); };
const bracketPath = 'packages/barocss-cad-editor/scripts/fixtures/modeling-composition/bracket-preview.json';
const bracketBytes = readFileSync(resolve(root, bracketPath));
const bracketHash = '419397690a131dd229e1cd03bf112227f529d91a468905c691088b710091544c';
const bracketCapture = JSON.parse(bracketBytes), packets = [...bracketCapture.preview, ...baseline.preview];
const convexSolids = [1, 3].map(index => baseline.evidence[index].native.solid);
function providerSnapshot(data) {
  const count = data.nodes.length;
  assert.ok([2, 4, 5, 8].includes(count), 'No six/seven-node intermediate reaches the provider');
  return {
    parameters: structuredClone(data.parameters), suppression: {}, features: structuredClone(baseline.features.slice(0, count)),
    bodies: Object.fromEntries(Object.entries(data.outputs).map(([name, ref]) => [name, ref.node === 4
      ? structuredClone(baseline.bodies.bracket) : ref.node === 7 ? structuredClone(baseline.bodies.slotted)
        : { family: 'convex-planar', native: structuredClone(convexSolids[ref.node === 1 ? 0 : 1]) }])),
    save: () => signedJSON(data),
    withParameters(changes) { stats.providerEdits++; return providerSnapshot({ ...data, parameters: { ...data.parameters, ...changes } }); },
    withSuppression: forbidden,
  };
}
setGlobal('__modelingStructureFlow', {
  cad: { model: forbidden, load(text) {
    stats.providerLoads++; const data = JSON.parse(text); loadedNodeCounts.push(data.nodes.length);
    if (providerRefusal) {
      providerRefusal = false;
      const error = new Error('CAD model difference: Controlled disconnected-solid refusal.');
      error.name = 'CadModelError'; error.code = 'PARAMETER'; error.operation = 'difference';
      error.cause = { privateNativeSentinel: true }; throw error;
    }
    return providerSnapshot(data);
  } },
  tessellateConvexPlanarSolid(solid, options) {
    assert.ok(convexSolids.some(value => hash(signedJSON(value)) === hash(signedJSON(solid))));
    assert.deepEqual(options, { maximumFanTriangles: 40 }); stats.previewReplays++;
    return projectConvex(solid, options);
  },
  tessellateSurface(surface, options) {
    assert.deepEqual(options, { countU: 2, countV: 2, revision: options.revision });
    assert.ok(Number.isSafeInteger(options.revision));
    const entry = packets.find(value => value.surfaceId === surface.id); assert.ok(entry, 'Exact retained Surface packet');
    const native = entry.panelId.startsWith('m4_') ? baseline.bodies.bracket.native : baseline.bodies.slotted.native;
    const source = native.sources.find(value => value.sourceId === entry.sourceId);
    assert.equal(source.panelId, entry.panelId);
    assert.deepEqual(source.model.objects.find(value => value.kind === 'surface' && value.id === entry.surfaceId), surface);
    assert.deepEqual(entry.options, { countU: 2, countV: 2, revision: 0 });
    stats.surfaceReplays++; return structuredClone(entry.result);
  },
  validateConvex(solid) { stats.convexValidationStubs++; return solid.report; },
  tessellateOwnPlateCircularHole: forbidden, tessellateXYCirclePrismShell: forbidden,
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
      accepted: null, visible: null, holdNext: false, release: null, failNext: false };
    displays.push(record);
    const prepare = async (scene, preview) => {
      record.prepares++; if (preview) record.previewPrepares++;
      if (record.failNext) { record.failNext = false; throw Error('Controlled display preparation refusal'); }
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
const boundaryPlugin = { name: 'explicit-structure-boundaries', setup(build) {
  build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\.\/modeling-controller\.js$/ }, () => ({ path: 'controller', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\.\/prism-feature-display\.js$/ }, () => ({ path: 'display', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'workspace-boundary' }));
  build.onLoad({ filter: /.*/, namespace: 'workspace-boundary' }, ({ path }) => ({ resolveDir: root, contents: {
    provider: 'export const {cad,tessellateConvexPlanarSolid,tessellateSurface,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell} = globalThis.__modelingStructureFlow;',
    legacy: 'export function createPrismFeatureEngine() { return () => { throw Error("Legacy native execution is outside this flow."); }; }',
    controller: `import {createCadEditorModelingController as create} from ${JSON.stringify(source('modeling-controller.ts'))}; export const createCadEditorModelingController = (...args) => globalThis.__modelingStructureFlow.controller(create, ...args);`,
    display: 'export const createPrismFeatureDisplay = globalThis.__modelingStructureFlow.display;',
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
// Pure CPU projector over retained native vertices/pcurves. Its one native
// parent-validator import is an explicit no-native stub, never a native receipt.
const convexPath = resolve(root, 'packages/barocss-cad/src/convex-planar-solid-mesh.ts');
const convexBundle = await esbuild.build({ entryPoints: [convexPath], bundle: true, platform: 'node', format: 'cjs', write: false,
  metafile: true, logLevel: 'silent', plugins: [{ name: 'explicit-retained-convex-validator', setup(build) {
    build.onResolve({ filter: /\/convex-planar-solid\.js$/ }, () => ({ path: 'validator', namespace: 'retained' }));
    build.onLoad({ filter: /.*/, namespace: 'retained' }, () => ({ contents: 'export const validateConvexPlanarSolid = globalThis.__modelingStructureFlow.validateConvex;' }));
  } }] });
assert.ok(!Object.keys(convexBundle.metafile.inputs).some(path => /(?:wasm|convex-planar-solid\.ts$)/.test(path)));
const convexModule = { exports: {} };
new Function('require', 'module', 'exports', convexBundle.outputFiles[0].text)(require, convexModule, convexModule.exports);
const projectConvex = convexModule.exports.tessellateConvexPlanarSolid;
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
    assert.ok(++stats.replies <= 48, 'Frozen 48-controlled-reply ceiling');
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

// Initial/re-edited dimensions are authored adaptations over retained geometry.
const defaultText = createSource({ width: '32', height: '24', thickness: '8' });
const defaultHash = hash(defaultText);

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
const callCounts = () => Object.fromEntries(['preview', 'previewStructure', 'applyStructure', 'clearPreview', 'apply', 'discard', 'open', 'stage', 'pick', 'select', 'cancel'].map(name =>
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
const geometryUnchanged = () => {
  const inspect = component => {
    if (component.family !== 'orthogonal-cell') return;
    const native = component.qualification.schema === 'barocss-orthogonal-solid-boolean' ? baseline.bodies.slotted.native : baseline.bodies.bracket.native;
    assert.equal(component.qualification.volumeMM3, native.report.volumeMM3);
    for (const chunk of component.mesh.chunks) {
      const entry = packets.find(value => value.panelId === chunk.faceToken); assert.ok(entry, 'Complete retained panel capture');
      assert.deepEqual(chunk.positionsMM, entry.result.packet.positions); assert.deepEqual(chunk.normals, entry.result.packet.normals);
      assert.deepEqual(chunk.parametersUV, entry.result.packet.parameters); assert.deepEqual(chunk.indices, entry.result.packet.indices);
    }
    if (component.lineage.parent) inspect(component.lineage.parent.component);
  };
  current().display.packet.components.forEach(inspect);
  assert.equal(hash(JSON.stringify(baseline)), nativeFixtureHash, 'Retained native sources, arrays, UV and lineage stay immutable');
  assert.equal(hash(fixtureBytes), fixtureHash); assert.equal(hash(bracketBytes), bracketHash);
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
const previewButton = () => button(current().workerReady ? 'Preview operation' : 'Recover accepted model and preview operation');
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
  assert.ok(Object.keys(snapshot.preview).every(key => ['status', 'operation', 'parameters', 'outputs', 'diagnostic'].includes(key)));
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
const field = name => container.querySelector(`input[id$="-structure-${name}"]`);
const newField = name => container.querySelector(`input[id$="-new-part-${name}"]`);
const data = () => JSON.parse(current().authoredText);
const authoredCount = count => assert.equal(data().nodes.length, count);
const openStructure = async name => {
  await click(button(name === 'add-arm' ? 'Add rectangular arm' : name === 'union' ? 'Union bodies' : 'Cut rectangular through-slot'));
  assertPanel(name); assertOptionsFocus();
};
const candidateSource = name => JSON.parse(panel(name).querySelector('pre').textContent);
const applyStructure = async () => {
  const before = authority(), loads = stats.providerLoads, samples = stats.surfaceReplays, convex = stats.previewReplays;
  const shown = port().visible;
  await click(button('Apply operation')); assert.deepEqual(authority(), before, 'Apply waits for exact acknowledgement');
  await settled(); assert.equal(current().error, null, errors().join(' ')); assertClosed();
  assert.equal(current().generation, before.generation + 1);
  assert.equal(current().history.index, before.history.index + 1);
  assert.equal(port().accepted, shown); assert.equal(port().visible, shown);
  assert.equal(stats.providerLoads, loads, 'Promotion does not load twice');
  assert.equal(stats.surfaceReplays, samples, 'Promotion does not sample twice');
  assert.equal(stats.previewReplays, convex); assert.equal(current().preview, null);
};
const history = async (label, expectedText) => {
  const before = current(); await click(button(label)); await settled();
  assert.equal(current().error, null, errors().join(' ')); assert.equal(current().authoredText, expectedText);
  assert.equal(current().generation, before.generation + 1); assert.equal(current().accepted.revision, before.accepted.revision + 1);
  assert.equal(current().history.count, before.history.count); assert.equal(current().selection, null); assert.equal(current().faceSelection, null);
  assert.equal(current().preview, null); assert.equal(port().visible, port().accepted);
  if ('selectedOutput' in current().display) assert.ok(current().accepted.outputs.some(value => value.name === current().display.selectedOutput));
};
const proofPaths = ['packages/barocss-cad-editor/src/react/modeling-editor.tsx',
  'packages/barocss-cad-editor/src/react/modeling-workspace.tsx',
  'packages/barocss-cad-editor/src/modeling-structure.ts',
  'packages/barocss-cad-editor/src/modeling-rectangular-part.ts',
  'packages/barocss-cad-editor/src/modeling-controller.ts',
  'packages/barocss-cad-editor/src/modeling-engine.ts',
  'packages/barocss-cad-editor/src/modeling-composition.ts',
  'packages/barocss-cad-editor/src/modeling-union.ts',
  'packages/barocss-cad-editor/src/modeling-diagnostic.ts',
  'packages/barocss-cad-editor/src/modeling-scene.ts',
  'packages/barocss-cad-editor/src/modeling-file.ts',
  'packages/barocss-cad/src/convex-planar-solid-mesh.ts',
  'packages/barocss-cad/src/convex-planar-solid-mass-internal.ts',
  'apps/cad-editor/flows/modeling-structure-flow.mjs'];
const sourceHashes = Object.fromEntries(proofPaths.map(path => [path, hash(readFileSync(resolve(root, path)))]));
console.log(JSON.stringify({ status: 'START', issue: 1960, ledger, expectedReplyCounts, sourceHashes,
  fixtureSHA256: hash(fixtureBytes), bracketSHA256: hash(bracketBytes),
  limits: { groups: 14, reactRoots: 1, maximumControllerLifetimes: 3, maximumReplies: 48, nativeCalls: 0 } }));
let baseText, pairText, unionText, cutText, savedText, oldSessionCallback;
try {
  await group(ledger[0], async () => {
    assert.equal(fixtureBytes.length, 2334314); assert.equal(hash(fixtureBytes), fixtureHash);
    assert.equal(hash(bracketBytes), bracketHash); assert.equal(packets.length, 58);
    assert.equal(bracketCapture.tessellationAttempts, 14); assert.equal(baseline.preview.length, 44);
    for (const suffix of ['react/modeling-editor.tsx', 'react/modeling-workspace.tsx', 'modeling-structure.ts',
      'modeling-rectangular-part.ts', 'modeling-controller.ts', 'modeling-scene.ts', 'modeling-file.ts']) {
      assert.ok(ui.inputs.some(path => path.endsWith(suffix)), `Actual source bundled: ${suffix}`);
    }
    assert.ok(engine.inputs.some(path => path.endsWith('modeling-engine.ts')));
    await mount({ workspace: true }); assertClosed(); assert.equal(sessions.length, 1);
    await click(button('New rectangular part')); assertPanel('new-part');
    assert.equal(newField('width').value, '32'); assert.equal(newField('thickness').value, '8');
    await change(newField('height'), '8'); await click(button('Replace current model')); await settled(); assertClosed();
    assert.deepEqual(current().accepted.parameters, { height: 8, thickness: 8, width: 32 }); authoredCount(2);
    assert.equal(current().history.count, 1); baseText = current().authoredText;
    await openStructure('add-arm'); assert.match(panel('add-arm').textContent, /shares.*thickness.*changes both bodies/);
    assert.deepEqual(['x', 'y', 'width', 'height'].map(name => field(name).value), ['0', '0', '8', '24']);
    const expected = candidateSource('add-arm'); assert.equal(expected.nodes.length, 4);
    assert.deepEqual(expected.nodes.slice(0, 2), data().nodes); assert.deepEqual(expected.nodes[3].height, data().nodes[1].height);
    assert.deepEqual(current().drafts, {}); const before = authority(); await preview(); assertReady(before);
    await applyStructure(); pairText = current().authoredText; authoredCount(4); assert.equal(current().history.count, 2);
    assert.deepEqual(current().accepted.outputs.map(output => output.solidId).sort(), ['m1_solid', 'm3_solid']);
  });
  await group(ledger[1], async () => {
    await openStructure('union'); const before = authority();
    const outputs = current().accepted.outputs;
    assert.equal(new Set(outputs.map(value => value.solidId)).size, 2);
    for (const output of outputs) {
      assert.ok(panel('union').textContent.includes(`${output.name} · ${output.solidId}`), 'Panel binds actual output name and native ID');
    }
    assert.match(panel('union').textContent, /consumes these two output names into part.*recoverable with Undo/);
    assert.equal(panel('union').querySelectorAll('input').length, 0, 'Union binds the owned pair without pretending Browser selection is body selection');
    const expected = candidateSource('union'); assert.equal(expected.nodes.length, 5); assert.deepEqual(expected.nodes.slice(0, 4), data().nodes);
    assert.deepEqual(expected.outputs, { part: { node: 4, side: 'solid' } });
    await preview(); assertReady(before); await applyStructure(); unionText = current().authoredText;
    assert.equal(current().history.count, 3); authoredCount(5);
    assert.deepEqual(current().accepted.parameters, before.accepted.parameters, 'Union changes graph with identical parameters');
    assert.deepEqual(current().accepted.outputs.map(value => value.name), ['part']);
    assert.equal(current().accepted.outputs[0].volumeMM3.numerator, '3072', 'Retained fixture volume, not new native measurement');
    assert.equal(current().display.selectedOutput, 'part'); geometryUnchanged();
  });
  await group(ledger[2], async () => {
    await openStructure('cut-slot'); const before = authority(), requests = commands();
    assert.deepEqual(['x', 'y', 'width', 'height'].map(name => field(name).value), ['16', '2', '8', '4']);
    assert.match(panel('cut-slot').textContent, /one atomic operation/); assert.match(panel('cut-slot').textContent, /Z=0\.\.8 mm/);
    assert.match(panel('cut-slot').textContent, /cannot export STL/); assert.match(panel('cut-slot').textContent, /Integer dimensions may still be refused/);
    const expected = candidateSource('cut-slot'); assert.equal(expected.nodes.length, 8); assert.deepEqual(expected.nodes.slice(0, 5), data().nodes);
    assert.deepEqual(expected.outputs, { part: { node: 7, side: 'solid' } });
    assert.deepEqual(expected.nodes[7], { kind: 'difference', parent: { node: 4, side: 'solid' }, tool: { node: 6, side: 'solid' } });
    assert.equal(Object.hasOwn(expected.nodes[6], 'from'), false); assert.deepEqual(expected.nodes[6].height, expected.nodes[1].height);
    for (const raw of ['0', '1.5', '10001', '1e-1000']) {
      await change(field('width'), raw); assert.equal(previewButton().disabled, true); assert.equal(button('Apply operation').disabled, true);
      await click(previewButton()); assert.deepEqual(authority(), before); assert.equal(commands(), requests);
    }
    await change(field('width'), '8'); assert.equal(previewButton().disabled, false); assert.deepEqual(current().drafts, {});
  });
  await group(ledger[3], async () => {
    const before = authority(), samples = stats.surfaceReplays; await preview(); assertReady(before);
    assert.equal(current().preview.operation, 'structure'); assertMetadata(current());
    assert.equal(stats.surfaceReplays - samples, 58, 'Final-only result retains parent14 plus final44 raw samples');
    const response = workers.at(-1).lastReply;
    assert.equal(response.kind, 'source-preview'); assert.equal(response.operation, 'structure'); assert.equal(JSON.parse(response.text).nodes.length, 8);
    assert.equal(response.display.components.length, 1); assert.equal(response.display.components[0].lineage.parent.nodeIndex, 4);
    assert.deepEqual(response.display.components[0].lineage.parent.originalIndices, [0, 1]);
    assert.equal(response.display.components[0].qualification.volumeMM3, 2816);
    assert.match(testid('modeling-preview-status').textContent, /2816\/1 mm³/);
    const metadata = current(); metadata.preview.outputs[0].name = 'mutated';
    assert.equal(current().preview.outputs[0].name, 'part', 'Public preview metadata is copied');
  });
  await group(ledger[4], async () => {
    const before = current(), expected = workers.at(-1).lastReply.text; await applyStructure();
    assert.equal(current().authoredText, expected); assert.equal(current().history.count, before.history.count + 1);
    assert.equal(current().history.count, 4); assert.equal(current().display.selectedOutput, 'part'); authoredCount(8);
    assert.equal(current().accepted.outputs[0].volumeMM3.numerator, '2816'); cutText = current().authoredText; geometryUnchanged();
  });
  await group(ledger[5], async () => {
    await history('Undo', unionText); const before = authority(); assert.equal(current().history.canRedo, true);
    await openStructure('cut-slot'); await preview(); assertReady(before); await cancel(); assertRestored(before);
    await openStructure('cut-slot'); await preview(); const event = await key(field('width'), 'Escape');
    assert.equal(event.defaultPrevented, true); await settled(); assertClosed(); assertRestored(before);
    assert.equal(current().history.canRedo, true, 'Preview/cancel preserves redo');
  });
  await group(ledger[6], async () => {
    await openStructure('cut-slot'); const before = authority(), stalePreview = capturePreview(); await preview();
    const staleApply = reactCallback(button('Apply operation'), 'onClick'), staleCancel = reactCallback(button('Cancel'), 'onClick');
    const candidate = port().candidates.at(-1); await change(field('width'), '9'); await change(field('width'), '8'); await settled();
    assert.equal(candidate.disposed, true); assertRestored(before); assert.equal(button('Apply operation').disabled, true);
    await assertStale(stalePreview, 'Raw-field ABA cannot revive Preview'); await assertStale(staleApply, 'Raw-field ABA cannot revive Apply');
    await assertStale(staleCancel, 'Raw-field ABA cannot close current options'); assertPanel('cut-slot'); await cancel();
  });
  await group(ledger[7], async () => {
    await openStructure('cut-slot'); const staleInstance = capturePreview();
    await openStructure('cut-slot'); await assertStale(staleInstance, 'Reopening command invalidates its prior instance');
    const staleSource = capturePreview(), sourceBefore = current().authoredText;
    await history('Undo', pairText); await history('Redo', unionText); assert.equal(current().authoredText, sourceBefore);
    await openStructure('cut-slot'); await assertStale(staleSource, 'Source ABA has a newer generation');
    oldSessionCallback = capturePreview(); await cancel();
    // A redirect changes only UI command state; it must invalidate captured Cancel
    // even before another controller notification or parameter-preview response.
    for (const [index, parameter, value, label] of [[1, 'width', '36', 'Edit extrusion'], [0, 'thickness', '9', 'Edit sketch dimensions']]) {
      await openStructure('cut-slot'); await select(index);
      await act(async () => { sessions.at(-1).controller.stage(parameter, value); await tick(); });
      const oldCancel = reactCallback(button('Cancel'), 'onClick');
      await click(button(label)); assertPanel('dimensions');
      await assertStale(oldCancel, 'Unrelated-draft redirect invalidates structural Cancel');
      if (index === 0) {
        await click(button('Preview dimensions')); await settled(); assert.equal(current().preview.status, 'ready');
        await assertStale(oldCancel, 'Old structural Cancel cannot clear the new dimension preview');
      }
      assert.deepEqual(current().drafts, { [parameter]: value }); await cancel();
    }

  });
  await group(ledger[8], async () => {
    await globalEdit(); await change(input('width (mm)'), '36'); const before = authority(), requests = commands();
    await openStructure('cut-slot'); assert.deepEqual(current().drafts, { width: '36' });
    assert.equal(previewButton().disabled, true); assert.equal(button('Apply operation').disabled, true);
    assert.match(panel('cut-slot').textContent, /Model dimensions are pending/);
    await click(previewButton()); await click(button('Apply operation')); assert.equal(commands(), requests); assert.deepEqual(authority(), before);
    await cancel(); assert.deepEqual(current().drafts, { width: '36' }, 'Structural Cancel retains unrelated drafts');
    await globalEdit(); await cancel(); assertRestored(before);
  });
  await group(ledger[9], async () => {
    await history('Redo', cutText); await history('Undo', unionText);
    const parameters = current().accepted.parameters; await history('Undo', pairText);
    assert.deepEqual(current().accepted.parameters, parameters, 'Same-map Union Undo restores its exact four-node graph');
    authoredCount(4); assert.deepEqual(current().accepted.outputs.map(value => value.solidId).sort(), ['m1_solid', 'm3_solid']);
    await history('Undo', baseText); authoredCount(2); await history('Redo', pairText); await history('Redo', unionText);
    assert.equal(current().history.count, 4); assert.equal(current().history.index, 2); assert.equal(current().history.canRedo, true);
  });
  await group(ledger[10], async () => {
    await globalEdit(); await change(input('thickness (mm)'), '10'); await click(button('Apply dimensions')); await settled(); assertClosed();
    assert.equal(current().accepted.parameters.thickness, 10);
    assert.deepEqual(data().nodes[1].height, data().nodes[3].height, 'The shared term continues to drive both extrusions');
    assert.equal(button('Cut rectangular through-slot'), undefined);
    await click(button('Capabilities & limits')); assertPanel('limits'); assert.match(testid('modeling-options').textContent, /8/);
    await history('Undo', unionText); assert.ok(button('Cut rectangular through-slot'));
    assert.equal(current().history.canRedo, true); await click(button('Close options')); assertClosed();
  });
  await group(ledger[11], async () => {
    await openStructure('cut-slot'); const before = authority(); providerRefusal = true;
    await click(previewButton()); await settled(); assertPanel('cut-slot'); assert.deepEqual(authority(), before);
    assert.equal(current().preview.status, 'error'); assert.equal(current().preview.diagnostic.stage, 'native');
    assert.match(testid('modeling-preview-diagnostic').textContent, /Controlled disconnected-solid refusal/);
    assert.doesNotMatch(testid('modeling-preview-diagnostic').textContent, /privateNativeSentinel|stack|cause/);
    assert.equal(field('width').value, '8'); assert.equal(port().visible, port().accepted);
    port().failNext = true; await click(previewButton()); await settled(); assertPanel('cut-slot');
    assert.deepEqual(authority(), before); assert.equal(current().preview.status, 'error');
    assert.equal(current().preview.diagnostic.stage, 'display'); assert.equal(port().visible, port().accepted);
    await click(previewButton()); const priorWorker = workers.at(-1), lateReply = priorWorker.compute();
    assert.equal(current().busy, true); await click(button('Cancel computation')); assert.equal(priorWorker.terminated, true);
    const afterCancel = current(); assert.deepEqual(authority(), before);
    await act(async () => { priorWorker.deliver(lateReply); await tick(); }); assert.deepEqual(current(), afterCancel);
    assert.ok(button('Recover accepted model and preview operation'));
    assert.match(testid('modeling-options').textContent, /reconstructs the accepted source first/);
    const loads = stats.providerLoads; await preview(); assertReady(before); assert.equal(stats.providerLoads, loads + 2);
    assert.equal(sessions.length, 1, 'Worker recovery does not create a second React controller');
  });
  await group(ledger[12], async () => {
    const before = authority(), candidateText = workers.at(-1).lastReply.text; assert.notEqual(candidateText, before.authoredText);
    await files(); await settled(); assert.equal(current().preview, null); assert.equal(port().visible, port().accepted);
    await click(downloadButton()); const blob = io.blobs.at(-1);
    assert.equal(blob.type, 'application/json'); assert.equal(await blob.text(), before.authoredText);
    assert.deepEqual(Buffer.from(await blob.arrayBuffer()), Buffer.from(unionText, 'utf8'));
    assert.equal(JSON.parse(await blob.text()).nodes.length, 5, 'Unapplied Cut is excluded from saved bytes');
    assert.equal(io.clicks.at(-1).filename, 'part.cad.json'); assert.equal(io.clicks.at(-1).connected, true);
    assert.equal(io.removes.at(-1), io.clicks.at(-1).anchor); assert.equal(io.removes.at(-1).isConnected, false);
    assert.equal(io.revokes.at(-1), io.urls.at(-1).url); assert.deepEqual(authority(), before);
    await openStructure('cut-slot'); await preview(); await applyStructure(); assert.equal(current().authoredText, cutText);
    await files(); await click(downloadButton()); savedText = await io.blobs.at(-1).text(); assert.equal(savedText, cutText);
    assert.ok(!/candidateToken|workerToken|taskToken|history|display/.test(savedText));
  });
  await group(ledger[13], async () => {
    const priorController = sessions.at(-1).controller, priorPort = port();
    await rerender({ workspace: true, initialAuthoredText: savedText }); await settled();
    assert.equal(sessions.length, 2); assert.equal(mountedRoots, 1); assert.equal(priorController.getSnapshot().disposed, true);
    assert.equal(priorPort.disposals, 1); assert.equal(current().authoredText, savedText); assertClosed();
    assert.deepEqual(current().history, { index: 0, count: 1, canUndo: false, canRedo: false });
    assert.equal(current().display.selectedOutput, 'part'); assert.equal(current().accepted.parameters.slotWidth, 8);
    await assertStale(oldSessionCallback, 'A disposed controller callback cannot affect the cold-open controller');
    await globalEdit(); await change(input('slotWidth (mm)'), '12'); await click(button('Apply dimensions')); await settled(); assertClosed();
    assert.equal(current().accepted.parameters.slotWidth, 12); assert.equal(data().parameters.slotWidth, 12);
    assert.deepEqual(data().nodes, JSON.parse(savedText).nodes); assert.equal(current().history.count, 2);
    assert.equal(current().accepted.outputs[0].volumeMM3.numerator, '2816', 'Edited native geometry is deliberately UNRUN; retained volume is not fabricated as 2688');
    for (const snapshot of emissions) assertMetadata(snapshot);
    assert.ok(loadedNodeCounts.every(count => [2, 4, 5, 8].includes(count))); geometryUnchanged();
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
assert.deepEqual(groups, ledger); assert.equal(mountedRoots, 1); assert.equal(sessions.length, 2);
assert.equal(displays.length, 2); assert.equal(observers.length, 2); assert.ok(stats.replies <= 48); assert.equal(stats.nativeCalls, 0);
assert.deepEqual(replyCounts, expectedReplyCounts);
console.log(JSON.stringify({ status: 'PASS', issue: 1960, node: process.version,
  runner: { executable: process.execPath, argv: process.argv.slice(1), command: [process.execPath, ...process.argv.slice(1)].map(value => JSON.stringify(value)).join(' ') },
  groups, replyCounts, mountedRoots, controllerLifetimes: sessions.length, workerInstances: workers.length, emittedSnapshots: emissions.length,
  ...stats, sourceHashes, loadedNodeCounts,
  fixtures: [{ path: fixturePath, sha256: fixtureHash }, { path: bracketPath, sha256: bracketHash }],
  adaptedDefaultSourceSHA256: defaultHash, acceptedCutSourceSHA256: hash(savedText),
  retainedGeometry: { unionVolumeMM3: 3072, cutVolumeMM3: 2816, parentRawSamples: 14, finalRawSamples: 44,
    editedSlotWidth12VolumeMM3: 'UNRUN; unchanged retained geometry remains 2816', convex: 'CPU projection from retained solids with explicit native validator stub' },
  boundaries: { actual: ['React', 'controller', 'engine', 'bounded structure helper', 'serializer projection', 'CPU scene receiver', 'Blob bytes'],
    controlled: ['provider codec, authored context and feature/parameter snapshot', 'Worker delivery', 'edited-state geometry replays',
      'convex native parent validator', 'display-port and renderer', 'ResizeObserver', 'object URL and anchor'],
    unrun: ['new native geometry', 'source-exact native command proof', 'physical browser', 'WebGPU pixels', 'physical download and disk persistence'] } }));
