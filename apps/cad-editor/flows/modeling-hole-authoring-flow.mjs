// #1966: ten frozen groups, one mounted React root, two controller lifetimes,
// at most 36 controlled replies; the exact planned ledger below uses 33.
// Actual React/controller/engine/serializer/CPU receiver and Blob bytes execute.
// Authored sole-part context/provider, Worker delivery and renderer are doubles.
// Retained r5 native body, sources, UV, lineage and mesh arrays remain unchanged.
// Every r2.5 display explicitly replays r5; no native or physical-pixel claim.
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
const hash = value => createHash('sha256').update(value).digest('hex');
const fixturePath = 'packages/barocss-cad-editor/scripts/fixtures/modeling-hole/baseline-native.json';
const fixtureBytes = readFileSync(resolve(root, fixturePath));
const fixtureHash = '3ee3d585448a24ad6d8fcdbc3cddd927eb6e13b399db6a707444940080fc4024';
const baseline = JSON.parse(fixtureBytes), retainedHash = hash(JSON.stringify(baseline));
const groups = [], sessions = [], workers = [], displays = [], observers = [], replyCounts = [], emissions = [];
const ledger = [
  'Selected Extrude exposes contextual command; Sketch/other selection does not',
  'Center/radius labels and decimal entry; Enter/Escape/IME/repeat conventions',
  'Pending model drafts block command work without loss; working Review route',
  'Preview→Apply gives one structural history entry; unavailable volume and disabled STL',
  'Cancel/Escape restores accepted view; drafts and mounted viewport preserved',
  'Same-panel replacement/reopen and captured callbacks obey instance/notification fences',
  'Lifetime/source replacement and held completion cannot mutate newer document/panel/file state',
  'Radius editing retains parameter identity, refusal and candidate invalidation',
  'Undo/Redo visible history/features/output selection follows accepted source',
  'Accepted-only File warning/Blob bytes and cold-open route; physical disk/chooser unclaimed',
];
// Count every reply, including fire-and-forget discard and refused preview replies.
// Freeze before execution: 1+0+0+2+6+4+3+10+6+1 = 33, within the 36 ceiling.
const expectedReplyCounts = [1, 0, 0, 2, 6, 4, 3, 10, 6, 1];
const stats = { replies: 0, providerLoads: 0, providerEdits: 0, blankMeshReplays: 0, holeMeshReplays: 0,
  contextAdaptations: 0, receiverRefusals: 0, providerRefusals: 0, nativeCalls: 0 };
const loadedNodeCounts = [], editedParameters = [];
let providerRefusal = false, mutateNextReply = null;
const globals = new Map();
let reactRoot, mountedRoots = 0;
function setGlobal(name, value) {
  if (!globals.has(name)) globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}
async function group(name, run) {
  assert.ok(groups.length < 10, 'Frozen ten-group ceiling');
  assert.equal(name, ledger[groups.length], 'Frozen ledger order');
  const before = stats.replies;
  try { await run(); } catch (cause) {
    console.error(JSON.stringify({ status: 'FAIL', issue: 1966, group: groups.length + 1, name,
      mountedRoots, controllerLifetimes: sessions.length, ...stats, error: String(cause) }));
    throw cause;
  }
  replyCounts.push(stats.replies - before);
  assert.equal(replyCounts.at(-1), expectedReplyCounts[groups.length], 'Frozen per-group reply ledger'); groups.push(name);
  console.log(JSON.stringify({ status: 'PASS', group: groups.length, name, replies: replyCounts.at(-1) }));
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  return value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
}
const signedJSON = value => JSON.stringify(canonical(value), (_key, value) => Object.is(value, -0) ? '__NEG_ZERO__' : value)
  .replaceAll('"__NEG_ZERO__"', '-0') + '\n';
const forbidden = () => { stats.nativeCalls++; throw Error('New native or legacy execution is outside this flow.'); };
// New authored source/parameter names and sole-part output are explicit doubles.
// No private native source, arrays, UV or lineage is transplanted or rewritten.
const blankNodes = [
  { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'width' }, { parameter: 'height' }] },
  { kind: 'extrude', sketch: 0, height: { parameter: 'thickness' } },
];
const holeNode = { kind: 'hole', parent: { node: 1, side: 'solid' },
  center: [{ parameter: 'holeCenterX' }, { parameter: 'holeCenterY' }], radius: { parameter: 'holeRadius' } };
function providerSnapshot(data) {
  assert.ok([2, 3].includes(data.nodes.length), 'Only frozen blank/hole source reaches provider double');
  assert.deepEqual(data.nodes.slice(0, 2), blankNodes);
  if (data.nodes.length === 3) assert.deepEqual(data.nodes[2], holeNode);
  assert.deepEqual(data.outputs, { part: { node: data.nodes.length - 1, side: 'solid' } });
  return {
    parameters: structuredClone(data.parameters), suppression: {}, features: structuredClone(baseline.features.slice(0, data.nodes.length)),
    bodies: { part: structuredClone(data.nodes.length === 2 ? baseline.bodies.blank : baseline.bodies.plate) },
    save: () => signedJSON(data),
    withParameters(changes) {
      stats.providerEdits++; editedParameters.push(structuredClone(changes));
      if (providerRefusal) {
        providerRefusal = false; stats.providerRefusals++;
        const error = new Error('Controlled stored-UV qualification refusal');
        error.name = 'CadModelError'; error.code = 'PARAMETER'; error.operation = 'hole';
        error.cause = { privateNativeSentinel: true }; throw error;
      }
      return providerSnapshot({ ...data, parameters: { ...data.parameters, ...changes } });
    },
    withSuppression: forbidden,
  };
}
setGlobal('__modelingHoleAuthoringFlow', {
  cad: { model: forbidden, load(text) {
    stats.providerLoads++; const data = JSON.parse(text); loadedNodeCounts.push(data.nodes.length); return providerSnapshot(data);
  } },
  tessellateConvexPlanarSolid(solid, options) {
    assert.deepEqual(solid, baseline.bodies.blank.native); assert.deepEqual(options, { maximumFanTriangles: 40 });
    stats.blankMeshReplays++; return structuredClone(baseline.blankMesh);
  },
  tessellateOwnPlateCircularHole(bundle, options) {
    assert.deepEqual(bundle, baseline.bodies.plate.native.bundle); assert.equal(options.segmentsPerQuarter, 4);
    assert.deepEqual(Object.keys(options).sort(), ['context', 'segmentsPerQuarter']);
    const preview = structuredClone(baseline.holeMesh);
    // Only the transport context is adapted, as in the retained hole-controller fixture.
    preview.mesh.context = structuredClone(options.context);
    stats.holeMeshReplays++; stats.contextAdaptations++; return preview;
  },
  tessellateSurface: forbidden, tessellateXYCirclePrismShell: forbidden,
  controller(create, ...args) {
    assert.ok(sessions.length < 2, 'Frozen two-controller-lifetime ceiling');
    const controller = create(...args), calls = [];
    controller.subscribe(() => emissions.push(controller.getSnapshot()));
    const session = new Proxy(controller, { get(target, name) {
      const value = target[name];
      if (typeof value !== 'function' || name === 'getSnapshot') return value;
      return (...args) => { calls.push({ name, args }); return value(...args); };
    } });
    sessions.push({ controller, session, calls }); return session;
  },
  // Controlled reversible renderer. A candidate owns its own real DOM canvas;
  // a camera update changes only the existing accepted canvas/scene. The package
  // script separately tests the real display implementation's renderer boundary.
  display(host) {
    const record = { host, prepares: 0, previewPrepares: 0, commits: 0, shows: 0, updateAttempts: 0,
      updates: 0, resizes: 0, disposals: 0, holdNext: false, release: null, width: 900, height: 600, accepted: null,
      visible: null, canvas: null, candidates: [], failNextUpdate: false };
    displays.push(record);
    const prepare = async (display, preview) => {
      record.prepares++; if (preview) record.previewPrepares++;
      const canvas = host.ownerDocument.createElement('canvas');
      canvas.width = record.width; canvas.height = record.height;
      canvas.setAttribute('aria-label', display.canvasLabel ?? 'Controlled accepted model');
      canvas.style.visibility = 'hidden'; host.appendChild(canvas);
      const candidate = { display, canvas, preview, committed: false, disposed: false,
        show() {
          assert.ok(preview && !this.disposed); record.shows++; record.visible = display;
          canvas.style.visibility = 'visible'; if (record.canvas) record.canvas.style.visibility = 'hidden';
        },
        commit() {
          assert.ok(!this.disposed); this.committed = true; record.commits++;
          record.canvas?.remove(); record.canvas = canvas; record.accepted = display; record.visible = display;
          canvas.style.visibility = 'visible';
        },
        dispose() {
          if (this.disposed) return; this.disposed = true;
          if (!this.committed) {
            canvas.remove();
            if (record.visible === display) { record.visible = record.accepted; if (record.canvas) record.canvas.style.visibility = 'visible'; }
          }
        },
      };
      record.candidates.push(candidate);
      if (record.holdNext) {
        record.holdNext = false;
        await new Promise(resolve => { record.release = () => { record.release = null; resolve(); }; });
      }
      return candidate;
    };
    return {
      prepare(display) { return prepare(display, false); }, preparePreview(display) { return prepare(display, true); },
      updateScene(display) {
        record.updateAttempts++;
        assert.ok(record.accepted && record.visible === record.accepted && record.canvas?.isConnected && !record.disposals);
        if (record.failNextUpdate) { record.failNextUpdate = false; throw Error('Controlled renderer update refusal'); }
        record.updates++; record.accepted = display; record.visible = display;
        record.canvas.setAttribute('aria-label', display.canvasLabel ?? 'Controlled accepted model');
      },
      aspect() { return record.width / record.height; },
      dimensions() { return { width: record.width, height: record.height }; },
      resize() { record.resizes++; if (record.canvas) { record.canvas.width = record.width; record.canvas.height = record.height; } },
      dispose() { record.disposals++; record.visible = null; for (const candidate of record.candidates) candidate.canvas.remove(); },
    };
  },
});
const source = name => resolve(root, `packages/barocss-cad-editor/src/${name}`);
const boundaryPlugin = { name: 'explicit-hole-authoring-boundaries', setup(build) {
  build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\.\/modeling-controller\.js$/ }, () => ({ path: 'controller', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\.\/prism-feature-display\.js$/ }, () => ({ path: 'display', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'view-boundary' }));
  build.onLoad({ filter: /.*/, namespace: 'view-boundary' }, ({ path }) => ({ resolveDir: root, contents: {
    provider: 'export const {cad,tessellateConvexPlanarSolid,tessellateSurface,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell} = globalThis.__modelingHoleAuthoringFlow;',
    legacy: 'export function createPrismFeatureEngine() { return () => { throw Error("Legacy native execution is outside this flow."); }; }',
    controller: `import {createCadEditorModelingController as create} from ${JSON.stringify(source('modeling-controller.ts'))}; export const createCadEditorModelingController = (...args) => globalThis.__modelingHoleAuthoringFlow.controller(create, ...args);`,
    display: 'export const createPrismFeatureDisplay = globalThis.__modelingHoleAuthoringFlow.display;',
    gpu: ['engine-scene', 'engine-camera-ray', 'engine-raycast', 'kernel-face-preview'].map(name =>
      `export * from ${JSON.stringify(resolve(root, `packages/barocss-gpu/src/${name}.ts`))};`).join('\n'),
  }[path] }));
} };
async function bundle(entry) {
  const result = await esbuild.build({ entryPoints: [source(entry)], bundle: true, platform: 'node', format: 'cjs',
    jsx: 'automatic', write: false, metafile: true, logLevel: 'silent',
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
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'Event', 'MouseEvent', 'KeyboardEvent', 'navigator']) setGlobal(name, dom.window[name]);
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
  accept(command = this.requests.find(item => !this.answered.has(item.id))) {
    assert.ok(command && !this.answered.has(command.id));
    assert.ok(this.requests.slice(0, this.requests.indexOf(command)).every(item => this.computed.has(item.id)), 'Controlled Worker preserves posted order');
    const reply = this.engine(command); this.computed.set(command.id, structuredClone(reply));
    if (mutateNextReply) { const mutate = mutateNextReply; mutateNextReply = null; mutate(reply); }
    assert.ok(++stats.replies <= 36, 'Frozen 36-controlled-reply ceiling');
    this.answered.add(reply.id); this.lastReply = structuredClone(reply);
    this.callbacks.get('message')({ data: structuredClone(reply) }); return reply;
  }
});
const React = require('react'), { createRoot } = require('react-dom/client'), { act } = React;
const ui = await bundle('react/modeling-editor.tsx');
const container = document.getElementById('root');
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const current = () => sessions.at(-1).controller.getSnapshot();
const port = () => displays.at(-1);
const testid = name => container.querySelector(`[data-testid="${name}"]`);
const button = label => [...container.querySelectorAll('button')].find(node => !node.closest('[hidden]') && (node.getAttribute('aria-label') ?? node.textContent.trim()) === label);
const input = label => {
  const node = [...container.querySelectorAll('label')].find(node => node.textContent.trim() === label);
  return node ? document.getElementById(node.htmlFor) : null;
};
const click = async node => {
  assert.ok(node, 'Expected control must exist');
  await act(async () => {
    const menus = []; for (let parent = node.parentElement; parent; parent = parent.parentElement)
      if (parent.tagName === 'DETAILS' && !parent.open) menus.unshift(parent);
    for (const menu of menus) menu.querySelector(':scope > summary').click();
    if (!node.disabled) node.focus(); node.click(); await tick();
  });
};
const change = async (node, value) => {
  assert.ok(node, 'Expected field must exist');
  await act(async () => {
    node.focus();
    const prototype = node.tagName === 'SELECT' ? HTMLSelectElement.prototype : node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, value);
    node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); await tick();
  });
};
const settled = async () => {
  for (let step = 0; step < 24; step++) {
    await act(async () => {
      const worker = workers.at(-1), command = worker?.requests.find(item => !worker.answered.has(item.id));
      if (worker && !worker.terminated && command) worker.accept(command); await tick();
    });
    const worker = workers.at(-1);
    if (!current().busy && (!worker || worker.terminated || worker.requests.every(item => worker.answered.has(item.id)))) return;
  }
  assert.fail('Bounded Worker delivery did not settle');
};
const commands = () => workers.reduce((sum, worker) => sum + worker.requests.length, 0);
const calls = () => sessions.flatMap(session => session.calls).map(call => call.name);
const errors = () => [...container.querySelectorAll('[role="alert"]')].map(node => node.textContent);
const reactCallback = (node, name = 'onClick') => {
  assert.ok(node, 'Actual React callback target');
  const key = Object.keys(node).find(key => key.startsWith('__reactProps$'));
  assert.ok(key && typeof node[key][name] === 'function'); return node[key][name];
};
const panel = name => testid(`modeling-panel-${name}`);
const assertClosed = () => assert.ok(!testid('modeling-options') || testid('modeling-options').closest('[hidden]'));
const assertPanel = name => assert.equal(panel(name).hidden, false);
const select = async index => click(testid('modeling-browser').querySelector(`button[data-feature-index="${index}"]`));
const data = () => JSON.parse(current().authoredText);
const authority = () => {
  const { accepted, authoredText, display, generation, history } = current();
  return { accepted, authoredText, display, generation, history };
};
const key = async (node, value, fields = {}) => {
  assert.ok(node, 'Expected keyboard target');
  const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...fields });
  await act(async () => { node.dispatchEvent(event); await tick(); }); return event;
};
const geometryUnchanged = () => {
  for (const entry of current().display.packet.components) {
    if (entry.family === 'stored-rational-plate-hole') {
      assert.deepEqual(entry.preview.mesh.chunks, baseline.holeMesh.mesh.chunks);
      assert.deepEqual(entry.preview.provenance, baseline.holeMesh.provenance);
      assert.deepEqual(entry.preview.report, baseline.holeMesh.report);
      assert.equal(entry.preview.report.vertexCount, 256); assert.equal(entry.preview.report.triangleCount, 128);
      assert.equal(entry.qualification.faceCount, 7); assert.equal(entry.role, 'part');
      assert.deepEqual(entry.lineage.faces, baseline.bodies.plate.native.bundle.faces.map(({ id, role, surface, orientation, outerLoopId, innerLoopIds }) =>
        ({ id, role, surfaceId: surface.id, orientation, outerLoopId, innerLoopIds })));
    } else {
      const convex = entry.component ?? entry;
      assert.deepEqual(convex.mesh, baseline.blankMesh.mesh); assert.equal(convex.report.triangleCount, 12);
    }
  }
  assert.equal(hash(JSON.stringify(baseline)), retainedHash); assert.equal(hash(fixtureBytes), fixtureHash);
};
async function assertStale(callback, label) {
  const before = current(), beforeCalls = calls(), requestCount = commands(), shown = port().visible;
  const updates = port().updates, focus = document.activeElement, alerts = errors();
  await act(async () => { callback(); await tick(); });
  assert.deepEqual(current(), before, label); assert.deepEqual(calls(), beforeCalls, label);
  assert.equal(commands(), requestCount, label); assert.equal(port().visible, shown, label); assert.equal(port().updates, updates, label);
  assert.equal(document.activeElement, focus, label); assert.deepEqual(errors(), alerts, label);
}
async function openText(text) {
  await click(button('Save or open a model'));
  await change(input('Saved model data'), text);
  const confirm = panel('files').querySelector('input[type="checkbox"]'); assert.ok(confirm);
  if (!confirm.checked) await click(confirm);
  assert.equal(button('Open saved model').disabled, false); await click(button('Open saved model')); await settled();
  assert.equal(current().error, null, errors().join(' ')); assert.deepEqual(JSON.parse(current().authoredText), JSON.parse(text));
}
// Real Blob bytes, with explicit object-URL/anchor doubles. Physical download,
// chooser acceptance and persisted disk files are outside this CPU fixture.
const NativeBlob = globalThis.Blob;
const io = { blobs: [], urls: [], clicks: [], removes: [], revokes: [] };
setGlobal('Blob', class extends NativeBlob {
  constructor(parts, options) { super(parts, options); io.blobs.push(this); }
});
const urlDescriptors = new Map(['createObjectURL', 'revokeObjectURL'].map(name => [name, Object.getOwnPropertyDescriptor(URL, name)]));
Object.defineProperty(URL, 'createObjectURL', { configurable: true, value(blob) {
  assert.ok(blob instanceof NativeBlob); const url = `blob:controlled-hole-save/${io.urls.length + 1}`;
  io.urls.push({ blob, url }); return url;
} });
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value(url) { io.revokes.push(url); } });
const originalCreateElement = document.createElement, nativeRemove = dom.window.Element.prototype.remove;
document.createElement = function(name, ...args) {
  const element = originalCreateElement.call(this, name, ...args);
  if (String(name).toLowerCase() === 'a') {
    element.click = () => io.clicks.push({ anchor: element, filename: element.download, href: element.href, connected: element.isConnected });
    element.remove = () => { io.removes.push(element); nativeRemove.call(element); };
  }
  return element;
};
const openHole = async () => { await click(button('Add through-hole')); assertPanel('add-hole'); };
const globalEdit = async () => { await click(button('Edit model dimensions')); assertPanel('dimensions'); };
const previewButton = () => button(current().workerReady ? 'Preview operation' : 'Recover accepted model and preview operation');
const preview = async () => {
  await click(previewButton()); await settled(); assert.equal(current().preview?.status, 'ready', errors().join(' '));
};
const cancel = async () => { await click(button('Cancel')); await settled(); assertClosed(); };
const capture = () => ({ preview: reactCallback(previewButton()), apply: reactCallback(button('Apply operation')),
  cancel: reactCallback(button('Cancel')), select: reactCallback(testid('modeling-browser').querySelector('button[data-feature-index="0"]')), field: reactCallback(input('Radius (mm)'), 'onChange') });
const staleCallbacks = async (callbacks, reason) => {
  await assertStale(callbacks.preview, `${reason}: Preview`); await assertStale(callbacks.apply, `${reason}: Apply`);
  await assertStale(callbacks.cancel, `${reason}: Cancel`); await assertStale(callbacks.select, `${reason}: Browser selection`);
  await assertStale(() => callbacks.field({ target: { value: '7' } }), `${reason}: field`);
};
const applyHole = async () => {
  const before = authority(), shown = port().visible, samples = { ...stats };
  await click(button('Apply operation')); assert.deepEqual(authority(), before, 'Apply waits for the exact acceptance reply');
  await settled(); assertClosed(); assert.equal(current().error, null, errors().join(' '));
  assert.equal(current().history.count, before.history.index + 2); assert.equal(current().generation, before.generation + 1);
  assert.equal(port().accepted, shown); assert.equal(port().visible, shown);
  assert.equal(stats.providerLoads, samples.providerLoads); assert.equal(stats.providerEdits, samples.providerEdits);
  assert.equal(stats.blankMeshReplays, samples.blankMeshReplays); assert.equal(stats.holeMeshReplays, samples.holeMeshReplays);
};
const history = async (label, expectedText, count, index) => {
  const before = current(); await click(button(label)); await settled();
  assert.equal(current().error, null, errors().join(' ')); assert.equal(current().authoredText, expectedText);
  assert.equal(current().generation, before.generation + 1); assert.equal(current().history.count, count); assert.equal(current().history.index, index);
  assert.equal(current().preview, null); assert.equal(port().visible, port().accepted);
  assert.equal(testid('modeling-browser').querySelectorAll('button[data-feature-index]').length, data().nodes.length);
  assert.match(container.querySelector('.modeling-feature-history').textContent, new RegExp(`History ${index + 1} / ${count}`));
  if ('selectedOutput' in current().display) assert.equal(current().display.selectedOutput, 'part');
  assert.ok(current().selection === null || current().accepted.features.some(feature => feature.index === current().selection));
  geometryUnchanged();
};
const proofPaths = [
  'packages/barocss-cad-editor/src/react/modeling-editor.tsx',
  'packages/barocss-cad-editor/src/react/modeling-workspace.tsx',
  'packages/barocss-cad-editor/src/modeling-structure.ts',
  'packages/barocss-cad-editor/src/modeling-controller.ts',
  'packages/barocss-cad-editor/src/modeling-engine.ts',
  'packages/barocss-cad-editor/src/modeling-scene.ts',
  'packages/barocss-cad-editor/src/modeling-file.ts',
  'packages/barocss-cad-editor/src/modeling-diagnostic.ts',
  'packages/barocss-cad-editor/src/prism-feature-scene.ts',
  'packages/barocss-cad-editor/src/prism-feature-display.ts',
  'apps/cad-editor/flows/modeling-hole-authoring-flow.mjs',
];
const sourceHashes = Object.fromEntries(proofPaths.map(path => [path, hash(readFileSync(resolve(root, path)))]));
const defaultText = signedJSON({ format: 'barocss-cad-model', schema: 1, units: 'mm',
  parameters: { width: 80, height: 40, thickness: 8 }, nodes: blankNodes, outputs: { part: { node: 1, side: 'solid' } } });
console.log(JSON.stringify({ status: 'START', issue: 1966, ledger, expectedReplyCounts, sourceHashes,
  fixture: { path: fixturePath, sha256: fixtureHash },
  limits: { groups: 10, reactRoots: 1, maximumControllerLifetimes: 2, maximumReplies: 36, plannedReplies: 33, nativeCalls: 0 } }));
let viewport, holeText, editedText, firstLifetimeCallbacks;
try {
  await group(ledger[0], async () => {
    assert.equal(hash(fixtureBytes), fixtureHash); assert.equal(fixtureBytes.length, 277591);
    for (const suffix of ['react/modeling-editor.tsx', 'react/modeling-workspace.tsx', 'modeling-controller.ts', 'modeling-structure.ts', 'modeling-scene.ts'])
      assert.ok(ui.inputs.some(path => path.endsWith(suffix)), `Actual bundled source: ${suffix}`);
    assert.ok(engine.inputs.some(path => path.endsWith('modeling-engine.ts')));
    assert.ok(++mountedRoots <= 1); reactRoot = createRoot(container);
    await act(async () => { reactRoot.render(React.createElement(ui.api.CadEditorModeling, { workspace: true, initialAuthoredText: defaultText })); await tick(); });
    await settled(); assert.equal(current().error, null, errors().join(' ')); assertClosed();
    assert.equal(current().history.count, 1); assert.equal(current().authoredText, defaultText);
    viewport = testid('modeling-viewport'); assert.equal(viewport.querySelectorAll('canvas').length, 1);
    assert.equal(button('Add through-hole'), undefined, 'No selected feature has no contextual hole command');
    await select(0); assert.equal(button('Add through-hole'), undefined);
    await select(1); assert.ok(button('Add through-hole')); assert.equal(current().selection, 1);
    assert.match(button('Add through-hole').closest('details').querySelector('summary').textContent, /MODIFY/);
    geometryUnchanged();
  });
  await group(ledger[1], async () => {
    await openHole(); assert.equal(input('Center X (mm)').value, '40'); assert.equal(input('Center Y (mm)').value, '20');
    assert.equal(input('Radius (mm)').value, '5'); const before = authority(), requests = commands();
    await change(input('Center X (mm)'), '40.25'); await change(input('Center Y (mm)'), '19.75'); await change(input('Radius (mm)'), '2.5');
    const candidate = JSON.parse(panel('add-hole').querySelector('pre').textContent);
    assert.equal(candidate.parameters.holeCenterX, 40.25); assert.equal(candidate.parameters.holeCenterY, 19.75); assert.equal(candidate.parameters.holeRadius, 2.5);
    assert.deepEqual(current().drafts, {}); assert.deepEqual(authority(), before);
    for (const value of ['Enter', 'Escape']) {
      for (const fields of [{ repeat: true }, { isComposing: true }, { keyCode: 229 }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
        const event = await key(input('Radius (mm)'), value, fields); assert.equal(event.defaultPrevented, false); assertPanel('add-hole');
      }
    }
    await key(input('Radius (mm)'), 'Enter'); assert.equal(commands(), requests); assert.equal(current().preview, null);
    assert.deepEqual(authority(), before); assertPanel('add-hole'); assert.equal(button('Apply operation').disabled, true);
    await change(input('Center X (mm)'), '40'); await change(input('Center Y (mm)'), '20'); await change(input('Radius (mm)'), '5');
    await cancel();
  });
  await group(ledger[2], async () => {
    await globalEdit(); await change(input('width (mm)'), '81'); const before = authority(), requests = commands();
    await openHole(); const stale = capture(); assert.deepEqual(current().drafts, { width: '81' });
    assert.equal(previewButton().disabled, true); assert.equal(button('Apply operation').disabled, true);
    assert.match(panel('add-hole').textContent, /dimensions are pending/);
    await click(previewButton()); await click(button('Apply operation')); assert.equal(commands(), requests);
    await click(button('Review pending dimensions')); assertPanel('dimensions');
    assert.equal(input('width (mm)').value, '81'); await staleCallbacks(stale, 'Review redirect replaces old structural notifications');
    await openHole(); await cancel(); assert.deepEqual(current().drafts, { width: '81' }, 'Structural Cancel cannot discard unrelated drafts');
    await openHole(); await key(input('Radius (mm)'), 'Escape'); assertClosed();
    assert.deepEqual(current().drafts, { width: '81' }, 'Structural Escape cannot discard unrelated drafts');
    assert.deepEqual(authority(), before); assert.equal(testid('modeling-viewport'), viewport);
    await globalEdit(); await cancel(); assert.deepEqual(current().drafts, {});
  });
  await group(ledger[3], async () => {
    await openHole(); const before = authority(), originalCanvas = port().canvas;
    assert.match(panel('add-hole').textContent, /consum|replac|becomes/i);
    await preview(); assert.deepEqual(authority(), before); assert.notEqual(port().visible, port().accepted);
    assert.equal(port().canvas, originalCanvas); assert.equal(current().preview.outputs[0].volumeMM3, null);
    assert.match(testid('modeling-preview-status').textContent, /not certified/);
    holeText = workers.at(-1).lastReply.text; assert.equal(JSON.parse(holeText).nodes.length, 3);
    await applyHole(); assert.equal(current().authoredText, holeText); assert.equal(current().history.count, 2);
    assert.deepEqual(data().nodes.slice(0, 2), JSON.parse(defaultText).nodes); assert.deepEqual(data().nodes[2], holeNode);
    assert.deepEqual(data().outputs, { part: { node: 2, side: 'solid' } });
    assert.deepEqual(Object.keys(data().parameters).sort(), ['height', 'holeCenterX', 'holeCenterY', 'holeRadius', 'thickness', 'width']);
    assert.equal(current().accepted.outputs[0].family, 'stored-rational-plate-hole'); assert.equal(current().accepted.outputs[0].volumeMM3, null);
    await click(button('Inspect selection')); assert.match(panel('inspect').textContent, /Certified volume unavailable/);
    await click(button('Output bodies')); assert.equal(button('Download STL').disabled, true);
    assert.equal(input('STL output').querySelector('option[value="part"]').disabled, true);
    await click(button('Close options')); await select(2); assert.equal(button('Add through-hole'), undefined, 'Already-holed feature cannot add a second hole');
    geometryUnchanged();
  });
  await group(ledger[4], async () => {
    await history('Undo', defaultText, 2, 0); await select(1); const before = authority(), canvas = port().canvas;
    await openHole(); await preview(); const first = port().candidates.at(-1); await cancel();
    assert.deepEqual(authority(), before); assert.equal(first.disposed, true); assert.equal(port().visible, port().accepted);
    assert.equal(port().canvas, canvas); assert.equal(canvas.style.visibility, 'visible'); assert.equal(current().history.canRedo, true);
    await openHole(); await preview(); const second = port().candidates.at(-1), event = await key(input('Radius (mm)'), 'Escape');
    assert.equal(event.defaultPrevented, true); await settled(); assertClosed(); assert.equal(second.disposed, true);
    assert.deepEqual(authority(), before); assert.deepEqual(current().drafts, {}); assert.equal(port().canvas, canvas);
    assert.equal(testid('modeling-viewport'), viewport); assert.equal(viewport.querySelectorAll('canvas').length, 1);
  });
  await group(ledger[5], async () => {
    await openHole(); await preview(); const stale = capture(), candidate = port().candidates.at(-1);
    await openHole(); await settled(); assert.equal(candidate.disposed, true); assert.equal(current().preview, null);
    await staleCallbacks(stale, 'Same-panel new instance'); assertPanel('add-hole'); assert.equal(input('Radius (mm)').value, '5');
    const oldFields = capture(); await change(input('Radius (mm)'), '2.5'); await change(input('Radius (mm)'), '5');
    await staleCallbacks(oldFields, 'Temporary field ABA'); assert.equal(button('Apply operation').disabled, true);
    await preview(); const oldSelection = capture(); await select(0); await settled();
    assert.equal(current().preview, null); assert.equal(button('Add through-hole'), undefined);
    await staleCallbacks(oldSelection, 'Accepted feature selection changed');
    await select(1); await openHole(); await staleCallbacks(oldSelection, 'Selection ABA cannot revive old command');
    firstLifetimeCallbacks = capture(); await cancel();
  });
  await group(ledger[6], async () => {
    await openHole(); const staleSource = capture(); await openText(defaultText); await staleCallbacks(staleSource, 'Source replacement');
    await select(1); await openHole(); const staleLifetime = capture();
    const oldController = sessions.at(-1).controller, oldPort = port(), oldWorker = workers.at(-1);
    oldPort.holdNext = true; await click(previewButton());
    await act(async () => { oldWorker.accept(); await tick(); });
    assert.equal(current().busy, true); assert.ok(oldPort.release); const held = oldPort.candidates.at(-1);
    await act(async () => { reactRoot.render(React.createElement(ui.api.CadEditorModeling, { workspace: true, initialAuthoredText: defaultText + '\n' })); await tick(); });
    await settled(); assert.equal(sessions.length, 2); assert.equal(oldController.getSnapshot().disposed, true);
    assert.equal(oldWorker.terminated, true); assert.equal(oldPort.disposals, 1); assert.equal(testid('modeling-viewport'), viewport);
    await click(button('Save or open a model')); await change(input('Saved model data'), holeText);
    const checkbox = panel('files').querySelector('input[type="checkbox"]'); await click(checkbox);
    const before = current(), staged = input('Saved model data').value, focus = document.activeElement, blobCount = io.blobs.length;
    await act(async () => { oldPort.release(); await tick(); });
    assert.equal(held.disposed, true); assert.deepEqual(current(), before); assertPanel('files');
    assert.equal(input('Saved model data').value, staged); assert.equal(checkbox.checked, true); assert.equal(document.activeElement, focus);
    assert.equal(io.blobs.length, blobCount); await staleCallbacks(staleLifetime, 'Disposed lifetime');
    await staleCallbacks(firstLifetimeCallbacks, 'Same-source and same-generation replacement');
    await click(button('Close options')); assertClosed();
  });
  await group(ledger[7], async () => {
    await select(1); await openHole(); await preview(); await applyHole(); assert.equal(current().authoredText, holeText);
    await globalEdit(); assert.equal(input('holeRadius (mm)').value, '5'); await change(input('holeRadius (mm)'), '2.5');
    const before = authority(), graph = data().nodes;
    providerRefusal = true; await click(button('Preview dimensions')); await settled();
    assert.deepEqual(authority(), before); assert.equal(current().preview.status, 'error');
    assert.equal(current().preview.diagnostic.stage, 'native'); assert.match(testid('modeling-preview-diagnostic').textContent, /Controlled stored-UV qualification refusal/);
    assert.doesNotMatch(testid('modeling-preview-diagnostic').textContent, /privateNativeSentinel|stack|cause/);
    assert.equal(input('holeRadius (mm)').value, '2.5'); assert.equal(port().visible, port().accepted);
    const prepares = port().previewPrepares;
    mutateNextReply = reply => {
      assert.equal(reply.kind, 'preview'); const component = reply.display.components.find(item => item.family === 'stored-rational-plate-hole');
      assert.ok(component); component.preview.provenance[4].nativeLoopIds.pop(); stats.receiverRefusals++;
    };
    await click(button('Preview dimensions')); await settled();
    assert.deepEqual(authority(), before); assert.equal(current().preview.status, 'error'); assert.ok(current().error);
    assert.equal(port().previewPrepares, prepares, 'Actual CPU receiver refuses before renderer preparation');
    assert.equal(input('holeRadius (mm)').value, '2.5');
    await click(button('Preview dimensions')); await settled(); assert.equal(current().preview.status, 'ready');
    const rejectedCandidate = port().candidates.at(-1), beforeInvalidation = commands();
    await change(input('holeRadius (mm)'), '2.75'); await change(input('holeRadius (mm)'), '2.5'); await settled();
    assert.equal(rejectedCandidate.disposed, true); assert.equal(current().preview, null); assert.deepEqual(authority(), before);
    assert.equal(commands(), beforeInvalidation + 1, 'Input ABA only discards the candidate; it never silently applies or re-evaluates');
    await click(button('Preview dimensions')); await settled(); assert.equal(current().preview.status, 'ready');
    const samples = stats.holeMeshReplays; await click(button('Apply dimensions')); await settled(); assertClosed();
    assert.equal(stats.holeMeshReplays, samples, 'Preview promotion does not tessellate again');
    assert.equal(current().accepted.parameters.holeRadius, 2.5); assert.deepEqual(data().nodes, graph);
    assert.equal(current().history.count, 3); assert.equal(current().accepted.outputs[0].volumeMM3, null); editedText = current().authoredText;
    geometryUnchanged(); // r2.5 authoring only: complete retained r5 mesh explicitly replayed.
  });
  await group(ledger[8], async () => {
    await history('Undo', holeText, 3, 1); assert.equal(current().accepted.parameters.holeRadius, 5);
    await history('Undo', defaultText, 3, 0); assert.equal(current().accepted.features.length, 2);
    assert.deepEqual(current().accepted.outputs[0].volumeMM3, { numerator: '25600', denominator: '1' });
    await select(1); assert.ok(button('Add through-hole'));
    await history('Redo', holeText, 3, 1); assert.equal(current().accepted.features.length, 3);
    assert.equal(current().accepted.outputs[0].volumeMM3, null); assert.equal(button('Add through-hole'), undefined);
    await history('Redo', editedText, 3, 2); assert.equal(current().accepted.parameters.holeRadius, 2.5);
    assert.equal(current().history.canRedo, false);
  });
  await group(ledger[9], async () => {
    await globalEdit(); await change(input('holeRadius (mm)'), '3');
    await click(button('Save or open a model')); assertPanel('files');
    assert.match(testid('modeling-save-state').textContent, /Pending dimensions are excluded/);
    const row = panel('files').querySelector('table[aria-label="Accepted and pending dimensions"] tbody tr');
    assert.match(row.textContent, /holeRadius/); assert.deepEqual([...row.querySelectorAll('td')].map(node => node.textContent), ['2.5', '3']);
    await change(input('Saved model data'), defaultText); const before = authority(), drafts = current().drafts;
    await click(button('Download accepted model')); assert.deepEqual(authority(), before); assert.deepEqual(current().drafts, drafts);
    const blob = io.blobs.at(-1), savedText = await blob.text(); assert.equal(blob.type, 'application/json'); assert.equal(savedText, editedText);
    assert.deepEqual(Buffer.from(await blob.arrayBuffer()), Buffer.from(editedText, 'utf8'));
    assert.equal(JSON.parse(savedText).parameters.holeRadius, 2.5); assert.equal(JSON.parse(savedText).nodes.length, 3);
    assert.equal(io.clicks.at(-1).filename, 'part.cad.json'); assert.equal(io.clicks.at(-1).connected, true);
    assert.equal(io.removes.at(-1), io.clicks.at(-1).anchor); assert.equal(io.removes.at(-1).isConnected, false);
    assert.equal(io.revokes.at(-1), io.urls.at(-1).url); assert.ok(!/candidateToken|workerToken|taskToken|history|display/.test(savedText));
    // A new Worker engine proves source cold-load without mounting a third lifetime.
    const priorWorker = workers.at(-1);
    await act(async () => { sessions.at(-1).controller.cancel(); await tick(); }); assert.equal(priorWorker.terminated, true);
    const loads = stats.providerLoads; await openText(savedText); assert.equal(stats.providerLoads, loads + 1);
    assert.notEqual(workers.at(-1), priorWorker); assert.equal(workers.at(-1).requests[0].kind, 'open');
    assert.equal(current().authoredText, savedText); assert.deepEqual(current().drafts, {});
    assert.deepEqual(current().history, { index: 0, count: 1, canUndo: false, canRedo: false });
    assert.deepEqual(data().nodes[2], holeNode); assert.equal(current().display.selectedOutput, 'part');
    await globalEdit(); assert.equal(input('holeRadius (mm)').value, '2.5'); assert.equal(current().accepted.parameters.holeCenterX, 40);
    assert.equal(current().accepted.parameters.holeCenterY, 20); assert.equal(current().accepted.outputs[0].volumeMM3, null);
    assert.equal(mountedRoots, 1); assert.equal(sessions.length, 2); assert.equal(testid('modeling-viewport'), viewport); geometryUnchanged();
  });
} finally {
  if (reactRoot) await act(async () => { reactRoot.unmount(); await tick(); });
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
assert.deepEqual(groups, ledger); assert.deepEqual(replyCounts, expectedReplyCounts);
assert.equal(mountedRoots, 1); assert.equal(sessions.length, 2); assert.equal(displays.length, 2); assert.equal(observers.length, 2);
assert.equal(stats.replies, 33); assert.ok(stats.replies <= 36); assert.equal(stats.nativeCalls, 0);
assert.equal(stats.receiverRefusals, 1); assert.equal(stats.providerRefusals, 1);
assert.equal(stats.contextAdaptations, stats.holeMeshReplays); assert.ok(workers.every(worker => worker.terminated));
assert.ok(observers.every(observer => observer.disconnections === 1)); assert.ok(loadedNodeCounts.every(count => [2, 3].includes(count)));
console.log(JSON.stringify({ status: 'PASS', issue: 1966, node: process.version,
  runner: { executable: process.execPath, argv: process.argv.slice(1), command: [process.execPath, ...process.argv.slice(1)].map(value => JSON.stringify(value)).join(' ') },
  groups, expectedReplyCounts, replyCounts, mountedRoots, controllerLifetimes: sessions.length, workerInstances: workers.length,
  emittedSnapshots: emissions.length, ...stats, meshReplays: stats.blankMeshReplays + stats.holeMeshReplays, loadedNodeCounts, editedParameters,
  sourceHashes, fixtures: [{ path: fixturePath, sha256: fixtureHash, bytes: fixtureBytes.length }],
  adaptedDefaultSourceSHA256: hash(defaultText), acceptedHoleSourceSHA256: hash(holeText), acceptedEditedSourceSHA256: hash(editedText),
  retainedGeometry: { blankTriangles: 12, holeVertices: 256, holeTriangles: 128, holeFaces: 7, holeVolumeMM3: null,
    authoredSolePart: 'explicitly adapted/mocked provider envelope; native bodies/sources/UV/lineage unchanged',
    editedRadius2_5Geometry: 'UNRUN; complete unchanged retained r5 body and mesh replayed explicitly' },
  boundaries: { actual: ['React', 'controller', 'engine', 'bounded structure helper', 'serializer projection', 'CPU scene receiver', 'DOM events and captured callbacks', 'Blob bytes'],
    controlled: ['provider codec, authored sole-part context and feature/parameter snapshots', 'native refusal diagnostic injection', 'one malformed receiver packet',
      'Worker delivery', 'unchanged edited-state geometry replay', 'display-port/renderer', 'ResizeObserver', 'object URL and anchor'],
    unrun: ['new native calls', 'source-exact new authored geometry', 'retessellated radius2.5 geometry', 'physical browser', 'WebGPU pixels', 'physical chooser/download/disk persistence'] } }));
