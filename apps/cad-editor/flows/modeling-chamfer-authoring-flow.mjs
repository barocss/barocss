// #1984: ten frozen groups, one React root, three controller lifetimes, exactly30 replies.
// Actual React/controller/bounded helper/CPU receiver and Blob bytes execute.
// Worker/provider summaries and authored two/three-node context are explicit doubles.
// EVERY display is the unchanged genuine TWO-bevel1/2 transport,6064mm³/20triangles.
// This includes the blank and bevelDistance2. No new one-bevel geometry is claimed.
// Actual engine/serializer coverage belongs to the complementary package fixture.
// No native, GPU renderer, physical browser, disk-file or manufacturing execution.
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
const fixturePath = 'packages/barocss-cad-editor/scripts/fixtures/modeling-chamfer-chain/baseline-transport.json';
const fixtureBytes = readFileSync(resolve(root, fixturePath));
const fixtureHash = '74e9a472c54aaa5d228a23d79b083c9a7c4c539bf5de6a5f274597e5fbfba4af';
const baseline = JSON.parse(fixtureBytes), retainedHash = hash(JSON.stringify(baseline));
const retainedComponent = baseline.display.components[0];
const groups = [], sessions = [], workers = [], displays = [], observers = [], replyCounts = [], emissions = [];
const ledger = Object.freeze([
  'Selected Extrude menu/defaults and existing capability routes',
  'Necessary finite decimal validation and pre-preview Apply no-op',
  'Enter previews; IME/repeat guards; Cancel and Escape restore accepted',
  'Pending model dimensions retain drafts and expose Review',
  'Same-command repeat resets options and fences replaced callbacks',
  'Field/selection/source/controller ABA and held old-lifetime completion',
  'Native, receiving scene and display refusal preserve accepted authority',
  'Current ready preview alone promotes one chamfer and one history entry',
  'Structural Undo/Redo and selected Chamfer named distance edit',
  'Accepted-only Blob bytes and third-lifetime cold Open',
]);
// Includes all refusal/discard/history acknowledgements. Frozen before execution.
const expectedReplyCounts = Object.freeze([1, 0, 4, 0, 2, 5, 6, 2, 8, 2]);
const stats = { replies: 0, authoredContextMocks: 0, editedStateMocks: 0,
  receiverRefusals: 0, providerRefusals: 0, displayRefusals: 0, nativeCalls: 0 };
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
    console.error(JSON.stringify({ status: 'FAIL', issue: 1984, group: groups.length + 1, name,
      mountedRoots, controllerLifetimes: sessions.length, ...stats, error: String(cause) }));
    throw cause;
  }
  replyCounts.push(stats.replies - before);
  assert.equal(replyCounts.at(-1), expectedReplyCounts[groups.length], 'Frozen per-group reply ledger');
  groups.push(name);
  console.log(JSON.stringify({ status: 'PASS', group: groups.length, name, replies: replyCounts.at(-1) }));
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  return value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
}
const signedJSON = value => JSON.stringify(canonical(value), (_key, value) => Object.is(value, -0) ? '__NEG_ZERO__' : value)
  .replaceAll('"__NEG_ZERO__"', '-0') + '\n';
const blankNodes = [
  { kind: 'sketch', profile: 'rectangle', min: [-0, 0], max: [{ parameter: 'width' }, { parameter: 'height' }] },
  { kind: 'extrude', sketch: 0, height: { parameter: 'thickness' } },
];
const chamferNode = { kind: 'chamfer', parent: { node: 1, side: 'solid' },
  edge: { parallelTo: 'x', at: { y: 0, z: 'max' } }, distance: { parameter: 'bevelDistance' } };
const defaultText = signedJSON({ format: 'barocss-cad-model', schema: 1, units: 'mm',
  parameters: { width: 32, height: 24, thickness: 8 }, nodes: blankNodes, outputs: { part: { node: 1, side: 'solid' } } });
// This summary is a controlled authored-context adaptation, not new native
// evidence. Keep6064 visible so no UI screenshot can masquerade as6128/6080.
function mockTransport(text, revision, id) {
  const data = JSON.parse(text);
  assert.ok([2, 3].includes(data.nodes.length));
  assert.deepEqual(data.nodes.slice(0, 2), blankNodes);
  if (data.nodes.length === 3) assert.deepEqual(data.nodes[2], chamferNode);
  assert.deepEqual(data.outputs, { part: { node: data.nodes.length - 1, side: 'solid' } });
  const reply = structuredClone(baseline);
  reply.id = id; reply.text = signedJSON(data);
  reply.summary.parameters = structuredClone(data.parameters);
  reply.summary.features = baseline.summary.features.slice(0, data.nodes.length);
  reply.summary.revision = revision; reply.display.revision = revision;
  stats.authoredContextMocks++;
  if (data.parameters.bevelDistance === 2) stats.editedStateMocks++;
  assert.deepEqual(reply.display.components[0], retainedComponent);
  assert.deepEqual(reply.summary.outputs, baseline.summary.outputs);
  return reply;
}
setGlobal('__modelingChamferAuthoringFlow', {
  controller(create, ...args) {
    assert.ok(sessions.length < 3, 'Frozen three-controller-lifetime ceiling');
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
      visible: null, canvas: null, candidates: [], failNext: false, failNextUpdate: false };
    displays.push(record);
    const prepare = async (display, preview) => {
      record.prepares++; if (preview) record.previewPrepares++;
      if (record.failNext) { record.failNext = false; stats.displayRefusals++; throw Error("Controlled display preparation refusal"); }
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
const boundaryPlugin = { name: 'explicit-chamfer-authoring-boundaries', setup(build) {
  build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\.\/modeling-controller\.js$/ }, () => ({ path: 'controller', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\.\/prism-feature-display\.js$/ }, () => ({ path: 'display', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'view-boundary' }));
  build.onLoad({ filter: /.*/, namespace: 'view-boundary' }, ({ path }) => ({ resolveDir: root, contents: {
    provider: 'throw Error("Provider execution is outside this transport-replay fixture.");',
    legacy: 'export function createPrismFeatureEngine() { return () => { throw Error("Legacy native execution is outside this flow."); }; }',
    controller: `import {createCadEditorModelingController as create} from ${JSON.stringify(source('modeling-controller.ts'))}; export const createCadEditorModelingController = (...args) => globalThis.__modelingChamferAuthoringFlow.controller(create, ...args);`,
    display: 'export const createPrismFeatureDisplay = globalThis.__modelingChamferAuthoringFlow.display;',
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
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://example.invalid/' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'Event', 'MouseEvent', 'KeyboardEvent', 'navigator']) setGlobal(name, dom.window[name]);
setGlobal('IS_REACT_ACT_ENVIRONMENT', true);
setGlobal('ResizeObserver', class {
  constructor(callback) { this.callback = callback; this.observed = []; this.disconnections = 0; observers.push(this); }
  observe(node) { this.observed.push(node); }
  disconnect() { this.disconnections++; }
});
// Controlled transport Worker. It holds a private accepted/candidate source to
// model acknowledgements; the real controller alone owns user-visible acceptance.
setGlobal('Worker', class {
  callbacks = new Map(); requests = []; answered = new Set(); terminated = false;
  accepted = null; candidate = null;
  constructor() { workers.push(this); }
  addEventListener(kind, callback) { this.callbacks.set(kind, callback); }
  postMessage(command) { this.requests.push(structuredClone(command)); }
  terminate() { this.terminated = true; }
  accept(command = this.requests.find(item => !this.answered.has(item.id))) {
    assert.ok(command && !this.answered.has(command.id));
    const { id, kind } = command;
    let reply;
    if (kind === 'discard-preview') {
      this.candidate = null; reply = { id, ok: true, kind: 'preview-discarded' };
    } else if (kind === 'accept-source' || kind === 'accept-preview') {
      assert.ok(this.candidate); assert.deepEqual(command.binding, this.candidate.binding);
      this.accepted = this.candidate;
      reply = { id, ok: true, kind: 'preview-accepted', binding: structuredClone(command.binding), revision: command.binding.expectedRevision + 1 };
      this.candidate = null;
    } else {
      assert.ok(['open', 'apply', 'prepare-preview', 'prepare-source'].includes(kind), `Unplanned command: ${kind}`);
      if (providerRefusal) {
        assert.equal(kind, 'prepare-source'); providerRefusal = false; stats.providerRefusals++;
        const message = 'Controlled native chamfer qualification refusal';
        reply = { id, ok: false, message, diagnostic: { stage: 'native', message, code: 'PARAMETER', operation: 'chamfer' } };
      } else {
        const text = kind === 'open' || kind === 'prepare-source' ? command.text
          : signedJSON({ ...JSON.parse(this.accepted.text), parameters: { ...this.accepted.summary.parameters, ...command.parameters } });
        reply = mockTransport(text, kind === 'open' ? command.revision ?? 0 : command.expectedRevision + 1, id);
        if (kind === 'prepare-source' || kind === 'prepare-preview') {
          reply.kind = kind === 'prepare-source' ? 'source-preview' : 'preview';
          reply.binding = { workerToken: command.workerToken, acceptedTaskToken: command.acceptedTaskToken,
            expectedRevision: command.expectedRevision, candidateToken: command.candidateToken, previewTaskToken: command.taskToken };
          if (kind === 'prepare-source') reply.operation = command.operation;
          this.candidate = structuredClone(reply);
        } else this.accepted = structuredClone(reply);
      }
    }
    if (mutateNextReply) { const mutate = mutateNextReply; mutateNextReply = null; mutate(reply); }
    assert.ok(++stats.replies <= 30, 'Frozen30-controlled-reply ceiling');
    this.answered.add(id); this.lastReply = structuredClone(reply);
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
  assert.ok(blob instanceof NativeBlob); const url = `blob:controlled-chamfer-save/${io.urls.length + 1}`;
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
const structure = await bundle('modeling-structure.ts');
const geometryUnchanged = () => {
  assert.deepEqual(current().display.packet.components, baseline.display.components,
    'Complete retained two-bevel mesh, sources, UVs, boundaries, report and lineage remain unchanged');
  assert.deepEqual(current().accepted.outputs, baseline.summary.outputs);
  assert.equal(current().display.packet.components[0].report.triangleCount, 20);
  assert.equal(hash(JSON.stringify(baseline)), retainedHash); assert.equal(hash(fixtureBytes), fixtureHash);
};
const openChamfer = async () => { await click(button('Chamfer front top edge')); assertPanel('chamfer'); };
const globalEdit = async () => { await click(button('Edit model dimensions')); assertPanel('dimensions'); };
const previewButton = () => button(current().workerReady ? 'Preview operation' : 'Recover accepted model and preview operation');
const preview = async () => {
  await click(previewButton()); await settled(); assert.equal(current().preview?.status, 'ready', errors().join(' '));
};
const cancel = async () => { await click(button('Cancel')); await settled(); assertClosed(); };
const capture = () => ({ preview: reactCallback(previewButton()), apply: reactCallback(button('Apply operation')),
  cancel: reactCallback(button('Cancel')), select: reactCallback(testid('modeling-browser').querySelector('button[data-feature-index="0"]')),
  distance: reactCallback(input('Bevel distance (mm)'), 'onChange') });
const staleCallbacks = async (callbacks, reason) => {
  for (const name of ['preview', 'apply', 'cancel', 'select']) await assertStale(callbacks[name], `${reason}: ${name}`);
  await assertStale(() => callbacks.distance({ target: { value: '2' } }), `${reason}: distance`);
};
const applyChamfer = async () => {
  const before = authority(), shown = port().visible, replays = stats.authoredContextMocks, requests = commands();
  assert.equal(button('Apply operation').disabled, false);
  await click(button('Apply operation')); assert.deepEqual(authority(), before, 'Apply waits for exact acknowledgement');
  assert.equal(commands(), requests + 1); assert.equal(workers.at(-1).requests.at(-1).kind, 'accept-source');
  await settled(); assertClosed(); assert.equal(current().error, null, errors().join(' '));
  assert.equal(current().history.count, before.history.index + 2); assert.equal(current().generation, before.generation + 1);
  assert.equal(port().accepted, shown); assert.equal(port().visible, shown);
  assert.equal(stats.authoredContextMocks, replays, 'Apply promotes without evaluating another candidate');
};
const history = async (label, expectedText, count, index) => {
  const before = current(); await click(button(label)); await settled();
  assert.equal(current().error, null, errors().join(' ')); assert.equal(current().authoredText, expectedText);
  assert.equal(current().generation, before.generation + 1); assert.equal(current().history.count, count); assert.equal(current().history.index, index);
  assert.equal(current().preview, null); assert.equal(port().visible, port().accepted);
  assert.equal(testid('modeling-browser').querySelectorAll('button[data-feature-index]').length, data().nodes.length);
  assert.match(container.querySelector('.modeling-feature-history').textContent, new RegExp(`History ${index + 1} / ${count}`));
  geometryUnchanged();
};
const rerender = async initialAuthoredText => {
  await act(async () => { reactRoot.render(React.createElement(ui.api.CadEditorModeling, { workspace: true, initialAuthoredText })); await tick(); });
  await settled();
};
const proofPaths = [
  'packages/barocss-cad-editor/src/react/modeling-editor.tsx',
  'packages/barocss-cad-editor/src/react/modeling-workspace.tsx',
  'packages/barocss-cad-editor/src/modeling-structure.ts',
  'packages/barocss-cad-editor/src/modeling-controller.ts',
  'packages/barocss-cad-editor/src/modeling-scene.ts',
  'packages/barocss-cad-editor/src/modeling-file.ts',
  'packages/barocss-cad-editor/src/modeling-diagnostic.ts',
  'packages/barocss-cad-editor/src/prism-feature-scene.ts',
  'apps/cad-editor/flows/modeling-chamfer-authoring-flow.mjs',
];
const sourceHashes = Object.fromEntries(proofPaths.map(path => [path, hash(readFileSync(resolve(root, path)))]));
console.log(JSON.stringify({ status: 'START', issue: 1984, ledger, expectedReplyCounts, sourceHashes,
  fixture: { path: fixturePath, sha256: fixtureHash },
  limits: { groups: 10, reactRoots: 1, maximumControllerLifetimes: 3, maximumReplies: 30, plannedReplies: 30, nativeCalls: 0 } }));
let viewport, chamferText, editedText, savedText, firstLifetimeCallbacks;
try {
  await group(ledger[0], async () => {
    assert.equal(hash(fixtureBytes), fixtureHash); assert.equal(fixtureBytes.length, 41471);
    assert.deepEqual(baseline.summary.outputs[0].volumeMM3, { numerator: '6064', denominator: '1' });
    assert.equal(baseline.summary.features.length, 4, 'Retained fixture genuinely has TWO chamfers');
    assert.equal(retainedComponent.report.triangleCount, 20);
    for (const suffix of ['react/modeling-editor.tsx', 'react/modeling-workspace.tsx', 'modeling-controller.ts', 'modeling-structure.ts', 'modeling-scene.ts'])
      assert.ok(ui.inputs.some(path => path.endsWith(suffix)), `Actual bundled source: ${suffix}`);
    assert.ok(!ui.inputs.some(path => path.endsWith('modeling-engine.ts')), 'Engine is explicitly outside this UI transport replay');
    assert.ok(++mountedRoots <= 1); reactRoot = createRoot(container); await rerender(defaultText);
    assert.equal(current().error, null, errors().join(' ')); assertClosed();
    assert.equal(current().history.count, 1); assert.equal(current().authoredText, defaultText);
    viewport = testid('modeling-viewport'); assert.equal(viewport.querySelectorAll('canvas').length, 1);
    assert.equal(button('Chamfer front top edge'), undefined);
    await select(0); assert.equal(button('Chamfer front top edge'), undefined);
    await select(1); assert.ok(button('Chamfer front top edge'));
    assert.match(button('Chamfer front top edge').closest('details').querySelector('summary').textContent, /MODIFY/);
    // Existing routed controls remain visible only for their own capabilities.
    for (const [label, name] of [['New rectangular part', 'new-part'], ['New circular part', 'new-circular-part']]) {
      await click(button(label)); assertPanel(name); await cancel();
    }
    await click(button('Add rectangular arm')); assertPanel('add-arm');
    assert.equal(input('Min X (mm)').value, '0'); assert.equal(input('Profile height (mm)').value, '24'); await cancel();
    await click(button('Add through-hole')); assertPanel('add-hole'); assert.equal(input('Radius (mm)').value, '5'); await cancel();
    await click(button('Cut rectangular pocket')); assertPanel('cut-pocket'); assert.equal(input('Wall thickness (mm)').value, '8'); await cancel();
    assert.equal(button('Union bodies'), undefined); assert.equal(button('Cut rectangular through-slot'), undefined);
    await openChamfer(); assert.equal(input('Bevel distance (mm)').value, '1');
    assert.equal(panel('chamfer').querySelectorAll('input').length, 1);
    assert.match(panel('chamfer').textContent, /X-parallel edge at Y=0, Z=max/);
    assert.equal(previewButton().closest('footer'), button('Apply operation').closest('footer'));
    assert.equal(button('Cancel').closest('footer'), button('Apply operation').closest('footer'));
    assert.equal(previewButton().disabled, false); assert.equal(button('Apply operation').disabled, true);
    firstLifetimeCallbacks = capture(); await cancel(); geometryUnchanged();
  });
  await group(ledger[1], async () => {
    await openChamfer(); const before = authority(), requests = commands();
    await assertStale(reactCallback(button('Apply operation')), 'Captured pre-preview Apply cannot evaluate');
    const initial = JSON.parse(panel('chamfer').querySelector('pre').textContent);
    assert.equal(initial.parameters.bevelDistance, 1); assert.deepEqual(initial.nodes[2], chamferNode);
    for (const value of ['', ' ', '0', '-0', '-1', '8', '24', '10001', '1e309', '1e-9999', 'Infinity', 'NaN', '0x2']) {
      await change(input('Bevel distance (mm)'), value);
      assert.equal(previewButton().disabled, true, `Invalid necessary bound: ${value}`);
      assert.equal(button('Apply operation').disabled, true);
      await click(previewButton()); await click(button('Apply operation'));
      assert.equal(commands(), requests); assert.deepEqual(authority(), before);
    }
    for (const value of ['.5', '1.25', '2e0', '+1']) {
      await change(input('Bevel distance (mm)'), value); assert.equal(previewButton().disabled, false);
      assert.equal(button('Apply operation').disabled, true); assert.deepEqual(current().drafts, {});
    }
    // Separate decimal admission must not relax integer-only older commands.
    const decimal = JSON.parse(defaultText); decimal.parameters.width = 32.5;
    const summary = structuredClone(current().accepted); summary.parameters.width = 32.5;
    const capabilities = structure.api.getModelingStructureCapabilities(signedJSON(decimal), summary);
    assert.ok(capabilities.chamfer);
    for (const name of ['addArm', 'union', 'cutSlot', 'addHole', 'cutPocket']) assert.equal(capabilities[name], null, name);
    await cancel();
  });
  await group(ledger[2], async () => {
    await openChamfer(); const before = authority(), requests = commands(), canvas = port().canvas;
    for (const value of ['Enter', 'Escape']) for (const fields of [{ repeat: true }, { isComposing: true }, { keyCode: 229 }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
      const event = await key(input('Bevel distance (mm)'), value, fields);
      assert.equal(event.defaultPrevented, false); assertPanel('chamfer'); assert.equal(commands(), requests);
    }
    const enter = await key(input('Bevel distance (mm)'), 'Enter'); assert.equal(enter.defaultPrevented, true);
    assert.equal(workers.at(-1).requests.at(-1).kind, 'prepare-source'); await settled();
    assert.equal(current().preview.status, 'ready'); assert.deepEqual(authority(), before);
    const first = port().candidates.at(-1); await cancel();
    assert.equal(first.disposed, true); assert.equal(port().visible, port().accepted); assert.equal(port().canvas, canvas);
    await openChamfer(); await key(input('Bevel distance (mm)'), 'Enter'); await settled();
    const second = port().candidates.at(-1), escape = await key(input('Bevel distance (mm)'), 'Escape');
    assert.equal(escape.defaultPrevented, true); await settled(); assertClosed();
    assert.equal(second.disposed, true); assert.deepEqual(authority(), before); assert.deepEqual(current().drafts, {});
    assert.equal(port().canvas, canvas); assert.equal(canvas.style.visibility, 'visible');
    assert.equal(testid('modeling-viewport'), viewport); assert.equal(viewport.querySelectorAll('canvas').length, 1);
  });
  await group(ledger[3], async () => {
    await globalEdit(); await change(input('width (mm)'), '33'); const before = authority(), requests = commands();
    await openChamfer(); const pending = capture(); assert.deepEqual(current().drafts, { width: '33' });
    assert.equal(previewButton().disabled, true); assert.equal(button('Apply operation').disabled, true);
    assert.match(panel('chamfer').textContent, /dimensions are pending/);
    await click(previewButton()); await click(button('Apply operation')); assert.equal(commands(), requests);
    await click(button('Review pending dimensions')); assertPanel('dimensions'); assert.equal(input('width (mm)').value, '33');
    await staleCallbacks(pending, 'Review replaces the structural command');
    await openChamfer(); await cancel(); assert.deepEqual(current().drafts, { width: '33' });
    await openChamfer(); await key(input('Bevel distance (mm)'), 'Escape'); assertClosed();
    assert.deepEqual(current().drafts, { width: '33' }); assert.deepEqual(authority(), before);
    await globalEdit(); await cancel(); assert.deepEqual(current().drafts, {});
  });
  await group(ledger[4], async () => {
    await openChamfer(); await change(input('Bevel distance (mm)'), '2'); await preview();
    const stale = capture(), candidate = port().candidates.at(-1), before = authority();
    await openChamfer(); await settled(); assert.equal(candidate.disposed, true); assert.equal(current().preview, null);
    assert.equal(input('Bevel distance (mm)').value, '1'); assert.equal(button('Apply operation').disabled, true);
    await staleCallbacks(stale, 'Same-command replacement');
    // A fresh visible command must remain usable, not silently fail behind an epoch fence.
    await change(input('Bevel distance (mm)'), '1.5'); assert.equal(previewButton().disabled, false);
    assert.equal(JSON.parse(panel('chamfer').querySelector('pre').textContent).parameters.bevelDistance, 1.5);
    assert.deepEqual(authority(), before); await cancel();
  });
  await group(ledger[5], async () => {
    await openChamfer(); await preview(); const staleFields = capture(), candidate = port().candidates.at(-1), before = authority();
    await change(input('Bevel distance (mm)'), '2'); await change(input('Bevel distance (mm)'), '1'); await settled();
    assert.equal(candidate.disposed, true); assert.equal(current().preview, null); assert.deepEqual(authority(), before);
    await staleCallbacks(staleFields, 'Temporary field ABA'); assert.equal(button('Apply operation').disabled, true);
    const staleSelection = capture(); await select(0); assertClosed(); await select(1); await openChamfer();
    await staleCallbacks(staleSelection, 'Selected target ABA');
    const staleSource = capture(); await openText(defaultText); await select(1); await openChamfer();
    await staleCallbacks(staleSource, 'Same-source replacement changes accepted generation');
    const heldCallbacks = capture(), oldController = sessions.at(-1).controller, oldPort = port(), oldWorker = workers.at(-1);
    oldPort.holdNext = true; await click(previewButton());
    await act(async () => { oldWorker.accept(); await tick(); }); assert.equal(current().busy, true); assert.ok(oldPort.release);
    const held = oldPort.candidates.at(-1); await rerender(defaultText + '\n');
    assert.equal(sessions.length, 2); assert.equal(oldController.getSnapshot().disposed, true);
    assert.equal(oldWorker.terminated, true); assert.equal(oldPort.disposals, 1);
    assert.equal(current().generation, 1); assert.equal(current().authoredText, defaultText);
    await select(1); await openChamfer(); const fresh = current(), focus = document.activeElement;
    await act(async () => { oldPort.release(); await tick(); });
    assert.equal(held.disposed, true); assert.deepEqual(current(), fresh); assert.equal(document.activeElement, focus);
    await staleCallbacks(heldCallbacks, 'Old held display lifetime');
    await staleCallbacks(firstLifetimeCallbacks, 'Same source and generation on a different controller');
    assert.equal(testid('modeling-viewport'), viewport); await cancel();
  });
  await group(ledger[6], async () => {
    await openChamfer(); const before = authority(), prepares = port().previewPrepares;
    providerRefusal = true; await click(previewButton()); await settled();
    assert.deepEqual(authority(), before); assert.equal(current().preview.status, 'error'); assertPanel('chamfer');
    assert.equal(current().preview.diagnostic.stage, 'native');
    assert.match(testid('modeling-preview-diagnostic').textContent, /Controlled native chamfer qualification refusal/);
    assert.equal(button('Apply operation').disabled, true); assert.equal(port().visible, port().accepted);
    mutateNextReply = reply => {
      assert.equal(reply.kind, 'source-preview'); reply.display.components[0].mesh.indices[0] = 9999; stats.receiverRefusals++;
    };
    await click(previewButton()); await settled();
    assert.deepEqual(authority(), before); assert.equal(current().preview.status, 'error'); assertPanel('chamfer');
    assert.equal(port().previewPrepares, prepares, 'Actual receiving scene refuses before renderer preparation');
    assert.equal(current().preview.diagnostic.stage, 'transport'); assert.equal(current().workerReady, true);
    port().failNext = true; await click(previewButton()); await settled();
    assert.deepEqual(authority(), before); assert.equal(current().preview.status, 'error'); assertPanel('chamfer');
    assert.equal(current().preview.diagnostic.stage, 'display'); assert.equal(input('Bevel distance (mm)').value, '1');
    assert.equal(button('Apply operation').disabled, true); assert.equal(port().visible, port().accepted);
    assert.equal(current().history.count, 1); geometryUnchanged();
  });
  await group(ledger[7], async () => {
    const before = authority(), requests = commands();
    await assertStale(reactCallback(button('Apply operation')), 'Refused-preview Apply cannot evaluate');
    assert.equal(commands(), requests); await preview(); assert.deepEqual(authority(), before);
    assert.notEqual(port().visible, port().accepted); assert.equal(current().preview.operation, 'structure');
    assert.deepEqual(current().preview.outputs[0].volumeMM3, { numerator: '6064', denominator: '1' });
    assert.match(testid('modeling-preview-status').textContent, /6064\/1 mm³/);
    chamferText = workers.at(-1).lastReply.text; await applyChamfer();
    assert.equal(current().authoredText, chamferText); assert.equal(current().history.count, 2);
    assert.deepEqual(data().nodes.slice(0, 2), blankNodes); assert.deepEqual(data().nodes[2], chamferNode);
    assert.ok(Object.is(data().nodes[0].min[0], -0));
    assert.deepEqual(data().outputs, { part: { node: 2, side: 'solid' } });
    assert.deepEqual(Object.keys(data().parameters).sort(), ['bevelDistance', 'height', 'thickness', 'width']);
    for (const index of [1, 2]) {
      await select(index); assert.equal(button('Chamfer front top edge'), undefined, 'Second chamfer is outside this constructor');
      for (const label of ['Add rectangular arm', 'Add through-hole', 'Cut rectangular pocket', 'Union bodies', 'Cut rectangular through-slot'])
        assert.equal(button(label), undefined, `Finished ancestry does not gain ${label}`);
    }
    geometryUnchanged();
  });
  await group(ledger[8], async () => {
    await history('Undo', defaultText, 2, 0); await select(1); assert.ok(button('Chamfer front top edge'));
    await history('Redo', chamferText, 2, 1); await select(2); await globalEdit();
    assert.equal(input('bevelDistance (mm)').value, '1');
    for (const name of ['width', 'height', 'thickness']) assert.ok(input(`${name} (mm)`));
    const requests = commands(); await change(input('bevelDistance (mm)'), '0');
    assert.deepEqual(current().drafts, { bevelDistance: '0' }); assert.equal(commands(), requests, 'Global edits are not silently clamped');
    await change(input('bevelDistance (mm)'), '2'); const before = authority(), nodes = data().nodes;
    await click(button('Preview dimensions')); await settled(); assert.equal(current().preview.status, 'ready');
    assert.deepEqual(authority(), before); const replays = stats.authoredContextMocks;
    await click(button('Apply dimensions')); await settled(); assertClosed();
    assert.equal(stats.authoredContextMocks, replays, 'Current parameter preview promotes without resampling');
    assert.equal(current().accepted.parameters.bevelDistance, 2); assert.deepEqual(data().nodes, nodes);
    assert.equal(current().history.count, 3); editedText = current().authoredText; geometryUnchanged();
    // Independent historical oracle, explicitly not this unchanged6064 replay.
    assert.equal(32 * 24 * 8 - 32 * 1 ** 2 / 2, 6128); assert.equal(32 * 24 * 8 - 32 * 2 ** 2 / 2, 6080);
    await history('Undo', chamferText, 3, 1); assert.equal(current().accepted.parameters.bevelDistance, 1);
    await history('Redo', editedText, 3, 2); assert.equal(current().accepted.parameters.bevelDistance, 2);
  });
  await group(ledger[9], async () => {
    await select(2); await globalEdit(); await change(input('bevelDistance (mm)'), '3');
    await click(button('Save or open a model')); assertPanel('files');
    assert.match(testid('modeling-save-state').textContent, /Pending dimensions are excluded/);
    const row = [...panel('files').querySelectorAll('table[aria-label="Accepted and pending dimensions"] tbody tr')]
      .find(node => node.textContent.includes('bevelDistance'));
    assert.ok(row); assert.deepEqual([...row.querySelectorAll('td')].map(node => node.textContent), ['2', '3']);
    await change(input('Saved model data'), defaultText); const before = authority(), drafts = current().drafts;
    await click(button('Download accepted model')); assert.deepEqual(authority(), before); assert.deepEqual(current().drafts, drafts);
    const blob = io.blobs.at(-1); savedText = await blob.text(); assert.equal(blob.type, 'application/json'); assert.equal(savedText, editedText);
    assert.deepEqual(Buffer.from(await blob.arrayBuffer()), Buffer.from(editedText, 'utf8'));
    assert.equal(JSON.parse(savedText).parameters.bevelDistance, 2); assert.equal(JSON.parse(savedText).nodes.length, 3);
    assert.equal(io.clicks.at(-1).filename, 'part.cad.json'); assert.equal(io.clicks.at(-1).connected, true);
    assert.equal(io.removes.at(-1), io.clicks.at(-1).anchor); assert.equal(io.removes.at(-1).isConnected, false);
    assert.equal(io.revokes.at(-1), io.urls.at(-1).url); assert.ok(!/candidateToken|workerToken|taskToken|history|display/.test(savedText));
    const previous = sessions.at(-1).controller; await rerender(defaultText);
    assert.equal(sessions.length, 3); assert.equal(previous.getSnapshot().disposed, true);
    assert.equal(current().authoredText, defaultText); assert.deepEqual(current().drafts, {});
    await openText(savedText); assert.equal(current().authoredText, savedText);
    assert.deepEqual(current().history, { index: 0, count: 1, canUndo: false, canRedo: false });
    assert.deepEqual(data().nodes.slice(0, 2), blankNodes); assert.deepEqual(data().nodes[2], chamferNode);
    assert.deepEqual(data().outputs, { part: { node: 2, side: 'solid' } });
    await select(2); await globalEdit(); assert.equal(input('bevelDistance (mm)').value, '2');
    assert.equal(input('width (mm)').value, '32'); assert.equal(input('height (mm)').value, '24'); assert.equal(input('thickness (mm)').value, '8');
    assert.equal(button('Chamfer front top edge'), undefined); assert.equal(mountedRoots, 1);
    assert.equal(testid('modeling-viewport'), viewport); assert.equal(viewport.querySelectorAll('canvas').length, 1); geometryUnchanged();
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
assert.equal(mountedRoots, 1); assert.equal(sessions.length, 3); assert.equal(displays.length, 3); assert.equal(observers.length, 3);
assert.equal(stats.replies, 30); assert.equal(stats.nativeCalls, 0);
assert.equal(stats.receiverRefusals, 1); assert.equal(stats.providerRefusals, 1); assert.equal(stats.displayRefusals, 1);
assert.ok(stats.editedStateMocks > 0); assert.ok(workers.every(worker => worker.terminated));
assert.ok(observers.every(observer => observer.disconnections === 1));
console.log(JSON.stringify({ status: 'PASS', issue: 1984, node: process.version,
  runner: { executable: process.execPath, argv: process.argv.slice(1) },
  groups, expectedReplyCounts, replyCounts, mountedRoots, controllerLifetimes: sessions.length, workerInstances: workers.length,
  emittedSnapshots: emissions.length, ...stats, sourceHashes,
  fixture: { path: fixturePath, sha256: fixtureHash, bytes: fixtureBytes.length },
  adaptedBlankSourceSHA256: hash(defaultText), acceptedChamferSourceSHA256: hash(chamferText),
  acceptedEditedSourceSHA256: hash(editedText), savedBlobSHA256: hash(savedText),
  retainedGeometry: { genuineFeatureCount: 4, genuineChamferCount: 2, triangles: 20, volumeMM3: 6064,
    authoredContext: 'two-node blank and three-node chamfer context explicitly mocked',
    editedGeometry: 'UNRUN; unchanged complete two-bevel6064 transport replayed for every state',
    historicalSingleBevelOracleOnly: { distance1: 6128, distance2: 6080 } },
  boundaries: { actual: ['React', 'controller', 'bounded structure helper', 'CPU scene receiver', 'DOM events and captured callbacks', 'Blob bytes', 'fresh-controller Open'],
    controlled: ['Worker/provider transport and authored summary', 'native refusal diagnostic', 'one malformed receiving scene packet',
      'unchanged edited-state geometry replay', 'display-port/renderer', 'ResizeObserver', 'object URL and anchor'],
    unrun: ['engine/provider native evaluation', 'new authored or edited native geometry', 'physical browser', 'GPU pixels', 'physical download or file chooser', 'STL campaign'] } }));
