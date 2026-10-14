// #1971: ten frozen React groups, one mounted root, two controller lifetimes,
// at most 36 controlled replies; the exact planned ledger below uses 33.
// Actual React/controller/engine/serializer/CPU receiver and Blob bytes execute.
// New authored context/provider, Worker delivery and renderer are explicit doubles.
// All 46 retained depth4 Surface packets, native body, UV and lineage stay intact.
// Floor2 has retained native evidence but no Surface capture; every edited display
// here replays depth4. No new native, physical browser, GPU or disk-file claim.
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
const fixturePath = 'packages/barocss-cad/test/modeling-offset-evidence/baseline-transfer.json';
const fixtureBytes = readFileSync(resolve(root, fixturePath));
const fixtureHash = 'c0a29404b5ffb8dc66eb9e6f8073b9e1545e94f3fe4c055d65ca95a9ca8fd536';
const baseline = JSON.parse(fixtureBytes), retainedHash = hash(JSON.stringify(baseline));
const native = baseline.bodies.part.native, retainedPacketsHash = hash(JSON.stringify(baseline.preview));
const editedNativePath = 'packages/barocss-cad/test/modeling-offset-evidence/edited.native.json';
const editedNativeBytes = readFileSync(resolve(root, editedNativePath));
const editedNative = JSON.parse(editedNativeBytes);
const groups = [], sessions = [], workers = [], displays = [], observers = [], replyCounts = [], emissions = [];
const ledger = Object.freeze([
  'Selected Extrude routing/defaults; prior arm/hole panels and menus retained',
  'Temporary wall/floor validation and Enter/IME/repeat conventions',
  'Preview and one-step Apply preserve prefix, sole part, native report and disabled STL',
  'Cancel/Escape restore accepted view and preserve the mounted viewport',
  'Temporary field and selected-target ABA invalidate candidates and captured callbacks',
  'Unrelated drafts, same-panel replacement and source replacement keep command fences',
  'Controlled native and actual CPU receiver refusal retain accepted source and options',
  'Named floor editing and structural Undo/Redo retain intent and explicit geometry-mock boundary',
  'Accepted-only Blob bytes; held old-lifetime completion cannot mutate a fresh controller',
  'Fresh-controller Open of saved Blob restores sole part and named dimensions',
]);
// Every response counts, including discard and refused-preview cleanup replies.
// Frozen before execution: 1+0+2+6+4+3+6+8+2+1 = 33, below the 36 ceiling.
const expectedReplyCounts = Object.freeze([1, 0, 2, 6, 4, 3, 6, 8, 2, 1]);
const stats = { replies: 0, providerLoads: 0, providerEdits: 0, blankMeshReplays: 0, pocketMeshReplays: 0,
  surfaceReplays: 0, convexValidationStubs: 0, authoredContextMocks: 0, editedStateMocks: 0,
  receiverRefusals: 0, providerRefusals: 0, nativeCalls: 0 };
const loadedNodeCounts = [], editedParameters = [];
let providerRefusal = false, mutateNextReply = null, blankMesh = null;
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
    console.error(JSON.stringify({ status: 'FAIL', issue: 1971, group: groups.length + 1, name,
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
// Only source/parameter names, features and output context are adapted. The
// native solid, its report/certificate, native IDs, arrays and sources are never
// rewritten to imply that the new authored source or edited geometry was run.
const blankNodes = [
  { kind: 'sketch', profile: 'rectangle', min: [-0, 0], max: [{ parameter: 'width' }, { parameter: 'height' }] },
  { kind: 'extrude', sketch: 0, height: { parameter: 'thickness' } },
];
const pocketNodes = [
  { kind: 'sketch', profile: 'rectangle', min: [{ parameter: 'pocketWall' }, { parameter: 'pocketWall' }],
    max: [{ op: 'add', left: { parameter: 'width' }, right: { op: 'scale', value: { parameter: 'pocketWall' }, factor: -1 } },
      { op: 'add', left: { parameter: 'height' }, right: { op: 'scale', value: { parameter: 'pocketWall' }, factor: -1 } }] },
  { kind: 'extrude', sketch: 2, from: { parameter: 'pocketFloor' },
    height: { op: 'add', left: { parameter: 'thickness' }, right: { op: 'scale', value: { parameter: 'pocketFloor' }, factor: -1 } } },
  { kind: 'difference', parent: { node: 1, side: 'solid' }, tool: { node: 3, side: 'solid' } },
];
function providerSnapshot(data) {
  assert.ok([2, 5].includes(data.nodes.length), 'Only atomic blank/pocket source reaches the provider double');
  assert.deepEqual(data.nodes.slice(0, 2), blankNodes);
  if (data.nodes.length === 5) {
    assert.deepEqual(data.nodes.slice(2), pocketNodes); stats.authoredContextMocks++;
    if (data.parameters.pocketFloor !== 4 || data.parameters.pocketWall !== 8) stats.editedStateMocks++;
  }
  assert.deepEqual(data.outputs, { part: { node: data.nodes.length - 1, side: 'solid' } });
  return {
    parameters: structuredClone(data.parameters), suppression: {}, features: structuredClone(baseline.features.slice(0, data.nodes.length)),
    bodies: { part: structuredClone(data.nodes.length === 2 ? baseline.bodies.plate : baseline.bodies.part) },
    save: () => signedJSON(data),
    withParameters(changes) {
      stats.providerEdits++; editedParameters.push(structuredClone(changes));
      return providerSnapshot({ ...data, parameters: { ...data.parameters, ...changes } });
    },
    withSuppression: forbidden,
  };
}
setGlobal('__modelingPocketAuthoringFlow', {
  cad: { model: forbidden, load(text) {
    stats.providerLoads++; const data = JSON.parse(text); loadedNodeCounts.push(data.nodes.length);
    if (providerRefusal) {
      providerRefusal = false; stats.providerRefusals++;
      const error = new Error('Controlled rectangular-pocket native qualification refusal');
      error.name = 'CadModelError'; error.code = 'PARAMETER'; error.operation = 'difference';
      error.cause = { privateNativeSentinel: true }; throw error;
    }
    return providerSnapshot(data);
  } },
  tessellateConvexPlanarSolid(solid, options) {
    assert.deepEqual(solid, baseline.bodies.plate.native); assert.deepEqual(options, { maximumFanTriangles: 40 });
    stats.blankMeshReplays++;
    const preview = projectConvex(solid, options);
    if (blankMesh === null) blankMesh = structuredClone(preview); else assert.deepEqual(preview, blankMesh);
    return preview;
  },
  validateConvex(solid) { stats.convexValidationStubs++; return solid.report; },
  tessellateSurface(surface, options) {
    const index = native.panels.findIndex(panel => panel.bundle.topology.face.surfaceId === surface.id);
    const retained = baseline.preview[index], panel = native.panels[index];
    assert.ok(retained && panel); assert.equal(retained.panelId, panel.id);
    assert.equal(retained.sourceId, panel.sourceId); assert.equal(retained.surfaceId, surface.id);
    assert.deepEqual(surface, panel.bundle.geometry.objects[0]);
    assert.deepEqual(retained.options, { countU: 2, countV: 2, revision: 0 });
    assert.deepEqual(options, { countU: 2, countV: 2, revision: options.revision });
    assert.ok(Number.isSafeInteger(options.revision) && options.revision >= 0);
    stats.surfaceReplays++; if (index === 0) stats.pocketMeshReplays++;
    return structuredClone(retained.result); // Whole raw packet remains unchanged, including its revision.
  },
  tessellateOwnPlateCircularHole: forbidden, tessellateXYCirclePrismShell: forbidden,
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
const boundaryPlugin = { name: 'explicit-pocket-authoring-boundaries', setup(build) {
  build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\.\/modeling-controller\.js$/ }, () => ({ path: 'controller', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\.\/prism-feature-display\.js$/ }, () => ({ path: 'display', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'view-boundary' }));
  build.onLoad({ filter: /.*/, namespace: 'view-boundary' }, ({ path }) => ({ resolveDir: root, contents: {
    provider: 'export const {cad,tessellateConvexPlanarSolid,tessellateSurface,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell} = globalThis.__modelingPocketAuthoringFlow;',
    legacy: 'export function createPrismFeatureEngine() { return () => { throw Error("Legacy native execution is outside this flow."); }; }',
    controller: `import {createCadEditorModelingController as create} from ${JSON.stringify(source('modeling-controller.ts'))}; export const createCadEditorModelingController = (...args) => globalThis.__modelingPocketAuthoringFlow.controller(create, ...args);`,
    display: 'export const createPrismFeatureDisplay = globalThis.__modelingPocketAuthoringFlow.display;',
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
// Pure CPU projector over retained native vertices/pcurves. Its one native
// parent-validator import is an explicit no-native stub, never a native receipt.
const convexPath = resolve(root, 'packages/barocss-cad/src/convex-planar-solid-mesh.ts');
const convexBundle = await esbuild.build({ entryPoints: [convexPath], bundle: true, platform: 'node', format: 'cjs', write: false,
  metafile: true, logLevel: 'silent', plugins: [{ name: 'explicit-retained-convex-validator', setup(build) {
    build.onResolve({ filter: /\/convex-planar-solid\.js$/ }, () => ({ path: 'validator', namespace: 'retained' }));
    build.onLoad({ filter: /.*/, namespace: 'retained' }, () => ({ contents: 'export const validateConvexPlanarSolid = globalThis.__modelingPocketAuthoringFlow.validateConvex;' }));
  } }] });
assert.ok(!Object.keys(convexBundle.metafile.inputs).some(path => /(?:wasm|convex-planar-solid\.ts$)/.test(path)));
const convexModule = { exports: {} };
new Function('require', 'module', 'exports', convexBundle.outputFiles[0].text)(require, convexModule, convexModule.exports);
const projectConvex = convexModule.exports.tessellateConvexPlanarSolid;
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
    if (entry.family === 'orthogonal-cell') {
      assert.equal(entry.mesh.chunks.length, 46); assert.equal(entry.qualification.volumeMM3, 5632);
      assert.deepEqual(entry.lineage.body, native.bodies[0]); assert.deepEqual(entry.lineage.grid, native.grid);
      assert.deepEqual(entry.lineage.cells, native.cells); assert.deepEqual(entry.lineage.edges, native.edges);
      assert.deepEqual(entry.lineage.shells, native.shells);
      assert.deepEqual(entry.lineage.vertices, native.vertices.map(({ id, pointMM }) => ({ id, pointMM })));
      for (const [index, captured] of baseline.preview.entries()) {
        const chunk = entry.mesh.chunks[index], panel = entry.lineage.panels[index];
        assert.deepEqual(chunk.positionsMM, captured.result.packet.positions);
        assert.deepEqual(chunk.normals, captured.result.packet.normals);
        assert.deepEqual(chunk.parametersUV, captured.result.packet.parameters);
        assert.deepEqual(chunk.indices, captured.result.packet.indices);
        assert.deepEqual(panel.topology, native.panels[index].bundle.topology);
        assert.deepEqual(panel.lineage, native.panels[index].lineage);
        assert.equal(panel.query.sourceId, captured.sourceId); assert.equal(panel.query.surfaceId, captured.surfaceId);
      }
      assert.equal(entry.role, 'part');
    } else {
      const convex = entry.component ?? entry;
      assert.deepEqual(convex.mesh, blankMesh.mesh); assert.equal(convex.report.triangleCount, 12);
    }
  }
  assert.equal(hash(JSON.stringify(baseline)), retainedHash); assert.equal(hash(fixtureBytes), fixtureHash);
  assert.equal(hash(JSON.stringify(baseline.preview)), retainedPacketsHash);
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
  assert.ok(blob instanceof NativeBlob); const url = `blob:controlled-pocket-save/${io.urls.length + 1}`;
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
const openPocket = async () => { await click(button('Cut rectangular pocket')); assertPanel('cut-pocket'); };
const globalEdit = async () => { await click(button('Edit model dimensions')); assertPanel('dimensions'); };
const previewButton = () => button(current().workerReady ? 'Preview operation' : 'Recover accepted model and preview operation');
const preview = async () => {
  await click(previewButton()); await settled(); assert.equal(current().preview?.status, 'ready', errors().join(' '));
};
const cancel = async () => { await click(button('Cancel')); await settled(); assertClosed(); };
const capture = () => ({ preview: reactCallback(previewButton()), apply: reactCallback(button('Apply operation')),
  cancel: reactCallback(button('Cancel')), select: reactCallback(testid('modeling-browser').querySelector('button[data-feature-index="0"]')), floor: reactCallback(input('Floor thickness (mm)'), 'onChange'), wall: reactCallback(input('Wall thickness (mm)'), 'onChange') });
const staleCallbacks = async (callbacks, reason) => {
  await assertStale(callbacks.preview, `${reason}: Preview`); await assertStale(callbacks.apply, `${reason}: Apply`);
  await assertStale(callbacks.cancel, `${reason}: Cancel`); await assertStale(callbacks.select, `${reason}: Browser selection`);
  await assertStale(() => callbacks.floor({ target: { value: '2' } }), `${reason}: floor`);
  await assertStale(() => callbacks.wall({ target: { value: '4' } }), `${reason}: wall`);
};
const applyPocket = async () => {
  const before = authority(), shown = port().visible, samples = { ...stats };
  await click(button('Apply operation')); assert.deepEqual(authority(), before, 'Apply waits for the exact acceptance reply');
  await settled(); assertClosed(); assert.equal(current().error, null, errors().join(' '));
  assert.equal(current().history.count, before.history.index + 2); assert.equal(current().generation, before.generation + 1);
  assert.equal(port().accepted, shown); assert.equal(port().visible, shown);
  assert.equal(stats.providerLoads, samples.providerLoads); assert.equal(stats.providerEdits, samples.providerEdits);
  assert.equal(stats.blankMeshReplays, samples.blankMeshReplays); assert.equal(stats.pocketMeshReplays, samples.pocketMeshReplays);
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
  'packages/barocss-cad-editor/src/modeling-union.ts',
  'packages/barocss-cad/src/convex-planar-solid-mesh.ts',
  'packages/barocss-cad-editor/src/modeling-file.ts',
  'packages/barocss-cad-editor/src/modeling-diagnostic.ts',
  'packages/barocss-cad-editor/src/prism-feature-scene.ts',
  'packages/barocss-cad-editor/src/prism-feature-display.ts',
  'apps/cad-editor/flows/modeling-pocket-authoring-flow.mjs',
];
const sourceHashes = Object.fromEntries(proofPaths.map(path => [path, hash(readFileSync(resolve(root, path)))]));
const defaultText = signedJSON({ format: 'barocss-cad-model', schema: 1, units: 'mm',
  parameters: { width: 32, height: 24, thickness: 8 }, nodes: blankNodes, outputs: { part: { node: 1, side: 'solid' } } });
console.log(JSON.stringify({ status: 'START', issue: 1971, ledger, expectedReplyCounts, sourceHashes,
  fixture: { path: fixturePath, sha256: fixtureHash },
  limits: { groups: 10, reactRoots: 1, maximumControllerLifetimes: 2, maximumReplies: 36, plannedReplies: 33, nativeCalls: 0 } }));
let viewport, pocketText, editedText, savedText, firstLifetimeCallbacks, sameSourceCallbacks;
try {
  await group(ledger[0], async () => {
    assert.equal(hash(fixtureBytes), fixtureHash); assert.equal(fixtureBytes.length, 1514483);
    assert.equal(native.report.volumeMM3, 5632); assert.equal(native.panels.length, 46); assert.equal(baseline.preview.length, 46);
    assert.equal(editedNative.report.volumeMM3, 5376, 'Retained deeper native result, never used as an edited mesh');
    assert.equal(signedJSON(JSON.parse(baseline.text)), baseline.text, 'Provider-double signed codec matches retained save');
    for (const suffix of ['react/modeling-editor.tsx', 'react/modeling-workspace.tsx', 'modeling-controller.ts', 'modeling-structure.ts', 'modeling-scene.ts'])
      assert.ok(ui.inputs.some(path => path.endsWith(suffix)), `Actual bundled source: ${suffix}`);
    assert.ok(engine.inputs.some(path => path.endsWith('modeling-engine.ts')));
    assert.ok(++mountedRoots <= 1); reactRoot = createRoot(container);
    await act(async () => { reactRoot.render(React.createElement(ui.api.CadEditorModeling, { workspace: true, initialAuthoredText: defaultText })); await tick(); });
    await settled(); assert.equal(current().error, null, errors().join(' ')); assertClosed();
    assert.equal(current().history.count, 1); assert.equal(current().authoredText, defaultText);
    viewport = testid('modeling-viewport'); assert.equal(viewport.querySelectorAll('canvas').length, 1);
    assert.equal(button('Cut rectangular pocket'), undefined); assert.equal(button('Add through-hole'), undefined);
    await select(0); assert.equal(button('Cut rectangular pocket'), undefined); assert.equal(button('Add through-hole'), undefined);
    await select(1); assert.ok(button('Cut rectangular pocket')); assert.ok(button('Add through-hole'));
    assert.match(button('Cut rectangular pocket').closest('details').querySelector('summary').textContent, /MODIFY/);
    assert.equal(button('Union bodies'), undefined); assert.equal(button('Cut rectangular through-slot'), undefined);
    // Targeted prior routes share the touched structural panel/footer branches.
    await click(button('Add rectangular arm')); assertPanel('add-arm');
    assert.equal(input('Min X (mm)').value, '0'); assert.equal(input('Profile height (mm)').value, '24');
    assert.ok(button('Preview operation')); await cancel();
    await click(button('Add through-hole')); assertPanel('add-hole');
    assert.equal(input('Center X (mm)').value, '40'); assert.equal(input('Radius (mm)').value, '5');
    const oldHoleCancel = reactCallback(button('Cancel'));
    await select(0); assertClosed(); await assertStale(oldHoleCancel, 'Prior hole route still closes on target change');
    await select(1); await openPocket();
    assert.equal(input('Wall thickness (mm)').value, '8'); assert.equal(input('Floor thickness (mm)').value, '4');
    assert.equal(panel('cut-pocket').querySelectorAll('input').length, 2);
    assert.equal(button('Preview operation').closest('footer'), button('Apply operation').closest('footer'));
    assert.equal(button('Cancel').closest('footer'), button('Apply operation').closest('footer'));
    assert.equal(previewButton().disabled, false); assert.equal(button('Apply operation').disabled, true);
    await cancel(); geometryUnchanged();
  });
  await group(ledger[1], async () => {
    await openPocket(); const before = authority(), requests = commands();
    const initial = JSON.parse(panel('cut-pocket').querySelector('pre').textContent);
    assert.equal(initial.parameters.pocketWall, 8); assert.equal(initial.parameters.pocketFloor, 4);
    assert.deepEqual(initial.nodes.slice(2), pocketNodes);
    for (const [label, values, restore] of [
      ['Wall thickness (mm)', ['', '0', '-0', '-1', '1.5', '12', '16', '10001', '1e309'], '8'],
      ['Floor thickness (mm)', ['', '0', '-0', '-1', '0.5', '8', '9', '10001'], '4'],
    ]) {
      for (const value of values) {
        await change(input(label), value);
        assert.equal(previewButton().disabled, true, `${label}: ${value}`);
        assert.equal(button('Apply operation').disabled, true);
        assert.equal(panel('cut-pocket').querySelector('pre').textContent, 'Enter a supported structural command.');
        await click(previewButton()); await click(button('Apply operation'));
        assert.deepEqual(current().drafts, {}); assert.deepEqual(authority(), before); assert.equal(commands(), requests);
      }
      await change(input(label), restore); assert.equal(previewButton().disabled, false);
    }
    await change(input('Wall thickness (mm)'), '4'); await change(input('Floor thickness (mm)'), '2');
    const temporary = JSON.parse(panel('cut-pocket').querySelector('pre').textContent);
    assert.equal(temporary.parameters.pocketWall, 4); assert.equal(temporary.parameters.pocketFloor, 2);
    assert.deepEqual(current().drafts, {}); assert.deepEqual(authority(), before);
    for (const label of ['Wall thickness (mm)', 'Floor thickness (mm)']) for (const value of ['Enter', 'Escape']) {
      for (const fields of [{ repeat: true }, { isComposing: true }, { keyCode: 229 }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
        const event = await key(input(label), value, fields); assert.equal(event.defaultPrevented, false); assertPanel('cut-pocket');
      }
    }
    const enter = await key(input('Floor thickness (mm)'), 'Enter');
    assert.equal(enter.defaultPrevented, false); assert.equal(commands(), requests); assert.equal(current().preview, null);
    assert.deepEqual(authority(), before); assertPanel('cut-pocket'); assert.equal(button('Apply operation').disabled, true);
    await cancel();
  });
  await group(ledger[2], async () => {
    await openPocket(); const before = authority(), originalCanvas = port().canvas;
    assert.match(panel('cut-pocket').textContent, /original extrusion stays in the source/);
    assert.match(panel('cut-pocket').textContent, /global edits can remove the floor or walls/);
    await preview(); assert.deepEqual(authority(), before); assert.notEqual(port().visible, port().accepted);
    assert.equal(port().canvas, originalCanvas);
    assert.deepEqual(current().preview.outputs[0].volumeMM3, { numerator: '5632', denominator: '1' });
    assert.match(testid('modeling-preview-status').textContent, /5632\/1 mm³/);
    pocketText = workers.at(-1).lastReply.text; assert.equal(JSON.parse(pocketText).nodes.length, 5);
    await applyPocket(); assert.equal(current().authoredText, pocketText); assert.equal(current().history.count, 2);
    assert.deepEqual(data().nodes.slice(0, 2), JSON.parse(defaultText).nodes); assert.deepEqual(data().nodes.slice(2), pocketNodes);
    assert.ok(Object.is(data().nodes[0].min[0], -0));
    assert.deepEqual(data().outputs, { part: { node: 4, side: 'solid' } });
    assert.deepEqual(Object.keys(data().parameters).sort(), ['height', 'pocketFloor', 'pocketWall', 'thickness', 'width']);
    assert.equal(current().accepted.outputs[0].family, 'orthogonal-cell');
    assert.deepEqual(current().accepted.outputs[0].volumeMM3, { numerator: '5632', denominator: '1' });
    assert.match(testid('modeling-model-notice').textContent, /remove walls or floor/i);
    assert.match(container.querySelector('.modeling-feature-history').textContent, /History 2 \/ 2/);
    await click(button('Inspect selection')); assert.match(panel('inspect').textContent, /5632 \/ 1 mm³/);
    assert.match(panel('inspect').textContent, /native geometry remains authoritative/i);
    await click(button('Output bodies')); assert.equal(button('Download STL').disabled, true);
    assert.equal(input('STL output').querySelector('option[value="part"]').disabled, true);
    await click(button('Close options'));
    for (const index of [1, 3, 4]) {
      await select(index);
      for (const label of ['Cut rectangular pocket', 'Add rectangular arm', 'Add through-hole', 'Union bodies', 'Cut rectangular through-slot'])
        assert.equal(button(label), undefined, `Completed pocket cannot gain ${label}`);
    }
    geometryUnchanged();
  });
  await group(ledger[3], async () => {
    await history('Undo', defaultText, 2, 0); await select(1); const before = authority(), canvas = port().canvas;
    await openPocket(); await preview(); const first = port().candidates.at(-1); await cancel();
    assert.deepEqual(authority(), before); assert.equal(first.disposed, true); assert.equal(port().visible, port().accepted);
    assert.equal(port().canvas, canvas); assert.equal(canvas.style.visibility, 'visible'); assert.equal(current().history.canRedo, true);
    await openPocket(); await preview(); const second = port().candidates.at(-1), requests = commands();
    const enter = await key(input('Wall thickness (mm)'), 'Enter'); assert.equal(enter.defaultPrevented, false);
    assert.equal(commands(), requests); assert.equal(current().preview.status, 'ready'); assert.deepEqual(authority(), before);
    const event = await key(input('Floor thickness (mm)'), 'Escape');
    assert.equal(event.defaultPrevented, true); await settled(); assertClosed(); assert.equal(second.disposed, true);
    assert.deepEqual(authority(), before); assert.deepEqual(current().drafts, {}); assert.equal(port().canvas, canvas);
    assert.equal(testid('modeling-viewport'), viewport); assert.equal(viewport.querySelectorAll('canvas').length, 1);
  });
  await group(ledger[4], async () => {
    await openPocket(); await preview(); const oldFields = capture(), candidate = port().candidates.at(-1), before = authority();
    await change(input('Floor thickness (mm)'), '2'); await change(input('Floor thickness (mm)'), '4');
    await change(input('Wall thickness (mm)'), '4'); await change(input('Wall thickness (mm)'), '8'); await settled();
    assert.equal(candidate.disposed, true); assert.equal(current().preview, null); assert.deepEqual(authority(), before);
    await staleCallbacks(oldFields, 'Temporary field ABA'); assert.equal(button('Apply operation').disabled, true);
    await preview(); const oldSelection = capture(), selectedCandidate = port().candidates.at(-1);
    await select(0); await settled(); assertClosed();
    assert.equal(selectedCandidate.disposed, true); assert.equal(current().preview, null); assert.equal(button('Cut rectangular pocket'), undefined);
    assert.equal(port().visible, port().accepted); await staleCallbacks(oldSelection, 'Accepted feature selection changed');
    await select(1); await openPocket(); await staleCallbacks(oldSelection, 'Selection ABA cannot revive the prior command');
    firstLifetimeCallbacks = capture(); await cancel();
  });
  await group(ledger[5], async () => {
    await globalEdit(); await change(input('width (mm)'), '33'); const before = authority(), requests = commands();
    await openPocket(); const pending = capture(); assert.deepEqual(current().drafts, { width: '33' });
    assert.equal(previewButton().disabled, true); assert.equal(button('Apply operation').disabled, true);
    assert.match(panel('cut-pocket').textContent, /dimensions are pending/);
    await click(previewButton()); await click(button('Apply operation')); assert.equal(commands(), requests);
    await click(button('Review pending dimensions')); assertPanel('dimensions'); assert.equal(input('width (mm)').value, '33');
    await staleCallbacks(pending, 'Review redirect replaces structural notifications');
    await openPocket(); await cancel(); assert.deepEqual(current().drafts, { width: '33' });
    await openPocket(); await key(input('Wall thickness (mm)'), 'Escape'); assertClosed();
    assert.deepEqual(current().drafts, { width: '33' }, 'Structural Escape cannot discard unrelated drafts');
    assert.deepEqual(authority(), before); assert.equal(testid('modeling-viewport'), viewport);
    await globalEdit(); await cancel(); assert.deepEqual(current().drafts, {});
    await openPocket(); await preview(); const stale = capture(), candidate = port().candidates.at(-1);
    await openPocket(); await settled(); assert.equal(candidate.disposed, true); assert.equal(current().preview, null);
    await staleCallbacks(stale, 'Same-panel replacement'); assert.equal(input('Wall thickness (mm)').value, '8');
    assert.equal(input('Floor thickness (mm)').value, '4'); const oldSource = capture();
    await openText(defaultText); await staleCallbacks(oldSource, 'Source replacement');
    assert.deepEqual(current().history, { index: 0, count: 1, canUndo: false, canRedo: false });
    await select(1); await openPocket(); sameSourceCallbacks = capture(); await cancel();
  });
  await group(ledger[6], async () => {
    await openPocket(); const before = authority(), prepares = port().previewPrepares;
    providerRefusal = true; await click(previewButton()); await settled();
    assert.deepEqual(authority(), before); assert.equal(current().preview.status, 'error'); assertPanel('cut-pocket');
    assert.equal(current().preview.diagnostic.stage, 'native');
    assert.match(testid('modeling-preview-diagnostic').textContent, /Controlled rectangular-pocket native qualification refusal/);
    assert.doesNotMatch(testid('modeling-preview-diagnostic').textContent, /privateNativeSentinel|stack|cause/);
    assert.equal(input('Wall thickness (mm)').value, '8'); assert.equal(input('Floor thickness (mm)').value, '4');
    assert.equal(button('Apply operation').disabled, true); assert.equal(port().visible, port().accepted);
    mutateNextReply = reply => {
      assert.equal(reply.kind, 'source-preview'); const component = reply.display.components.find(item => item.family === 'orthogonal-cell');
      assert.ok(component); component.mesh.chunks[0].parametersUV[0] = 0.5; stats.receiverRefusals++;
    };
    await click(previewButton()); await settled();
    assert.deepEqual(authority(), before); assert.equal(current().preview.status, 'error'); assert.ok(current().error); assertPanel('cut-pocket');
    assert.equal(port().previewPrepares, prepares, 'Actual CPU receiver refuses before renderer preparation');
    assert.equal(input('Floor thickness (mm)').value, '4'); assert.equal(port().visible, port().accepted);
    await preview(); await applyPocket(); assert.equal(current().authoredText, pocketText); assert.equal(current().history.count, 2);
    geometryUnchanged();
  });
  await group(ledger[7], async () => {
    await globalEdit(); assert.equal(input('pocketFloor (mm)').value, '4'); assert.equal(input('pocketWall (mm)').value, '8');
    for (const name of ['width', 'height', 'thickness']) assert.ok(input(`${name} (mm)`));
    assert.match(testid('modeling-pocket-warning').textContent, /global parameter edits can remove the tray floor or walls/i);
    assert.match(testid('modeling-pocket-warning').textContent, /native geometry remains authoritative/i);
    const requests = commands();
    // Zero remains a global draft rather than being silently clamped by this command.
    // Whether it is natively admitted is owned by the separate controller/provider case.
    await change(input('pocketFloor (mm)'), '0'); assert.deepEqual(current().drafts, { pocketFloor: '0' });
    assert.match(testid('modeling-pocket-warning').textContent, /remove the tray floor or walls/i);
    assert.equal(button('Preview dimensions').disabled, false); assert.equal(commands(), requests);
    await change(input('pocketFloor (mm)'), '2'); const before = authority(), graph = data().nodes;
    await click(button('Preview dimensions')); await settled(); assert.equal(current().preview.status, 'ready');
    assert.deepEqual(authority(), before);
    const samples = stats.surfaceReplays;
    await click(button('Apply dimensions')); await settled(); assertClosed();
    assert.equal(stats.surfaceReplays, samples, 'Exact preview promotion does not sample again');
    assert.equal(current().accepted.parameters.pocketFloor, 2); assert.equal(current().accepted.parameters.pocketWall, 8);
    assert.deepEqual(data().nodes, graph); assert.equal(current().history.count, 3); editedText = current().authoredText;
    // This is explicitly the baseline geometry double. The genuine depth6 report
    // is 5376; using it without new Surface samples would forge display evidence.
    assert.deepEqual(current().accepted.outputs[0].volumeMM3, { numerator: '5632', denominator: '1' });
    assert.equal(32 * 24 * 8 - (32 - 2 * 8) * (24 - 2 * 8) * (8 - 2), 5376);
    assert.equal(32 * 24 * 8 - (32 - 2 * 4) * (24 - 2 * 4) * (8 - 2), 3840);
    geometryUnchanged();
    await history('Undo', pocketText, 3, 1); assert.equal(current().accepted.parameters.pocketFloor, 4);
    await history('Undo', defaultText, 3, 0); assert.equal(current().accepted.features.length, 2);
    assert.deepEqual(current().accepted.outputs[0].volumeMM3, { numerator: '6144', denominator: '1' });
    await select(1); assert.ok(button('Cut rectangular pocket')); assert.ok(button('Add through-hole'));
    await history('Redo', pocketText, 3, 1); assert.equal(current().accepted.features.length, 5);
    assert.equal(button('Cut rectangular pocket'), undefined);
    await history('Redo', editedText, 3, 2); assert.equal(current().accepted.parameters.pocketFloor, 2);
    assert.equal(current().history.canRedo, false);
  });
  await group(ledger[8], async () => {
    await globalEdit(); await change(input('pocketFloor (mm)'), '3');
    await click(button('Save or open a model')); assertPanel('files');
    assert.match(testid('modeling-save-state').textContent, /Pending dimensions are excluded/);
    const row = [...panel('files').querySelectorAll('table[aria-label="Accepted and pending dimensions"] tbody tr')]
      .find(node => node.textContent.includes('pocketFloor'));
    assert.ok(row); assert.deepEqual([...row.querySelectorAll('td')].map(node => node.textContent), ['2', '3']);
    await change(input('Saved model data'), defaultText); const before = authority(), drafts = current().drafts;
    await click(button('Download accepted model')); assert.deepEqual(authority(), before); assert.deepEqual(current().drafts, drafts);
    const blob = io.blobs.at(-1); savedText = await blob.text(); assert.equal(blob.type, 'application/json'); assert.equal(savedText, editedText);
    assert.deepEqual(Buffer.from(await blob.arrayBuffer()), Buffer.from(editedText, 'utf8'));
    assert.equal(JSON.parse(savedText).parameters.pocketFloor, 2); assert.equal(JSON.parse(savedText).nodes.length, 5);
    assert.deepEqual(JSON.parse(savedText).outputs, { part: { node: 4, side: 'solid' } });
    assert.equal(io.clicks.at(-1).filename, 'part.cad.json'); assert.equal(io.clicks.at(-1).connected, true);
    assert.equal(io.removes.at(-1), io.clicks.at(-1).anchor); assert.equal(io.removes.at(-1).isConnected, false);
    assert.equal(io.revokes.at(-1), io.urls.at(-1).url); assert.ok(!/candidateToken|workerToken|taskToken|history|display/.test(savedText));
    await globalEdit(); const oldController = sessions.at(-1).controller, oldPort = port(), oldWorker = workers.at(-1);
    oldPort.holdNext = true; await click(button('Preview dimensions'));
    await act(async () => { oldWorker.accept(); await tick(); });
    assert.equal(current().busy, true); assert.ok(oldPort.release); const held = oldPort.candidates.at(-1);
    await act(async () => { reactRoot.render(React.createElement(ui.api.CadEditorModeling, { workspace: true, initialAuthoredText: defaultText + '\n' })); await tick(); });
    await settled(); assert.equal(sessions.length, 2); assert.equal(oldController.getSnapshot().disposed, true);
    assert.equal(oldWorker.terminated, true); assert.equal(oldPort.disposals, 1); assert.equal(testid('modeling-viewport'), viewport);
    await click(button('Save or open a model')); await change(input('Saved model data'), savedText);
    const checkbox = panel('files').querySelector('input[type="checkbox"]'); await click(checkbox);
    const fresh = current(), staged = input('Saved model data').value, focus = document.activeElement, blobCount = io.blobs.length;
    await act(async () => { oldPort.release(); await tick(); });
    assert.equal(held.disposed, true); assert.deepEqual(current(), fresh); assertPanel('files');
    assert.equal(input('Saved model data').value, staged); assert.equal(checkbox.checked, true); assert.equal(document.activeElement, focus);
    assert.equal(io.blobs.length, blobCount); await staleCallbacks(firstLifetimeCallbacks, 'Disposed lifetime');
    await staleCallbacks(sameSourceCallbacks, 'Same-source and same-generation new controller');
    assert.equal(current().authoredText, defaultText, 'Staging saved Blob bytes has not replaced fresh accepted geometry');
  });
  await group(ledger[9], async () => {
    assert.equal(sessions.length, 2); const freshController = sessions.at(-1).controller, freshWorker = workers.at(-1), loads = stats.providerLoads;
    assert.equal(freshController.getSnapshot().authoredText, defaultText);
    assert.equal(input('Saved model data').value, savedText); assert.equal(button('Open saved model').disabled, false);
    await click(button('Open saved model')); await settled();
    assert.equal(stats.providerLoads, loads + 1); assert.equal(sessions.at(-1).controller, freshController);
    assert.equal(workers.at(-1), freshWorker); assert.equal(freshWorker.requests.at(-1).kind, 'open');
    assert.equal(current().error, null, errors().join(' ')); assert.equal(current().authoredText, savedText); assert.deepEqual(current().drafts, {});
    assert.deepEqual(current().history, { index: 0, count: 1, canUndo: false, canRedo: false });
    assert.deepEqual(data().nodes.slice(0, 2), blankNodes); assert.deepEqual(data().nodes.slice(2), pocketNodes);
    assert.deepEqual(data().outputs, { part: { node: 4, side: 'solid' } }); assert.equal(current().display.selectedOutput, 'part');
    await globalEdit(); assert.equal(input('pocketFloor (mm)').value, '2'); assert.equal(input('pocketWall (mm)').value, '8');
    assert.equal(input('width (mm)').value, '32'); assert.equal(input('height (mm)').value, '24'); assert.equal(input('thickness (mm)').value, '8');
    assert.match(testid('modeling-pocket-warning').textContent, /native geometry remains authoritative/i);
    await click(button('Output bodies')); assert.equal(button('Download STL').disabled, true);
    assert.equal(input('STL output').querySelector('option[value="part"]').disabled, true);
    assert.equal(mountedRoots, 1); assert.equal(testid('modeling-viewport'), viewport);
    assert.equal(viewport.querySelectorAll('canvas').length, 1); geometryUnchanged();
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
assert.equal(stats.surfaceReplays, 46 * stats.pocketMeshReplays); assert.ok(stats.editedStateMocks > 0);
assert.ok(workers.every(worker => worker.terminated)); assert.ok(observers.every(observer => observer.disconnections === 1));
assert.ok(loadedNodeCounts.every(count => [2, 5].includes(count)));
console.log(JSON.stringify({ status: 'PASS', issue: 1971, node: process.version,
  runner: { executable: process.execPath, argv: process.argv.slice(1), command: [process.execPath, ...process.argv.slice(1)].map(value => JSON.stringify(value)).join(' ') },
  groups, expectedReplyCounts, replyCounts, mountedRoots, controllerLifetimes: sessions.length, workerInstances: workers.length,
  emittedSnapshots: emissions.length, ...stats, loadedNodeCounts, editedParameters, sourceHashes,
  fixtures: [{ path: fixturePath, sha256: fixtureHash, bytes: fixtureBytes.length },
    { path: editedNativePath, sha256: hash(editedNativeBytes), bytes: editedNativeBytes.length, use: 'native report inspection only; no Surface capture' }],
  adaptedDefaultSourceSHA256: hash(defaultText), acceptedPocketSourceSHA256: hash(pocketText), acceptedEditedSourceSHA256: hash(editedText), savedBlobSHA256: hash(savedText),
  retainedGeometry: { blankTriangles: 12, pocketSurfacePackets: 46, pocketTriangles: 92, baselineVolumeMM3: 5632,
    floor2RetainedNativeVolumeMM3: 5376, wall4Floor2ArithmeticMM3: 3840,
    authoredSolePart: 'explicitly adapted/mocked provider context; native bodies, reports, sources, UV and lineage unchanged',
    editedFloor2Geometry: 'UNRUN; complete unchanged floor4 body and 46 Surface packets replayed explicitly',
    editedWall4Floor2Geometry: 'UNRUN; independent arithmetic only, not natively measured or tessellated' },
  boundaries: { actual: ['React', 'controller', 'engine', 'bounded structure helper', 'serializer projection', 'CPU scene receiver', 'DOM events and captured callbacks', 'Blob bytes', 'fresh-controller Open'],
    controlled: ['provider codec, authored sole-part context and feature/parameter snapshots', 'native refusal diagnostic injection', 'one malformed receiver packet',
      'Worker delivery', 'unchanged edited-state geometry replay', 'convex native validator', 'display-port/renderer', 'ResizeObserver', 'object URL and anchor'],
    unrun: ['new native calls', 'source-exact new authored geometry', 'retessellated floor2 geometry', 'wall4/floor2 native geometry', 'physical browser',
      'WebGPU pixels', 'visible cavity depth', 'physical chooser/download/disk persistence'] } }));
