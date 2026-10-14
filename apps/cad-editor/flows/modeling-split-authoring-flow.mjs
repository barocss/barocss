// #2018: actual split-authoring React/controller/CPU-receiver flow.
// Explicit Worker/provider and display doubles replay genuine unsplit/split packets.
// Authored context is adapted; changed-coordinate/dimension replies are mocks.
// Original native meshes, IDs and lineage are never synthesized or transformed.
// The constructor selects negative as command intent. The retained model-outputs
// scene displays both convex bodies and has no per-body selectedOutput property.
// No native evaluation, physical browser, GPU, STL or manufacturing execution.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import Module, { createRequire } from 'node:module';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../..');
const depsRoot = resolve(process.env.REPO_DEPS_ROOT ?? root);
const require = createRequire(resolve(depsRoot, 'package.json'));
const hash = value => createHash('sha256').update(value).digest('hex');
// Refuse a mismatched source freeze before bundling or executing any product code.
const proofPaths = [
  'packages/barocss-cad-editor/src/react/modeling-editor.tsx',
  'packages/barocss-cad-editor/src/react/modeling-workspace.tsx',
  'packages/barocss-cad-editor/src/modeling-structure.ts',
  'packages/barocss-cad-editor/src/modeling-controller.ts',
  'packages/barocss-cad-editor/src/modeling-scene.ts',
  'packages/barocss-cad-editor/src/modeling-file.ts',
  'packages/barocss-cad-editor/src/modeling-diagnostic.ts',
  'packages/barocss-cad-editor/src/prism-feature-scene.ts',
];
const sourceHashes = Object.fromEntries(proofPaths.map(path => [path, hash(readFileSync(resolve(root, path)))]));
const frozenSourceText = process.env.FROZEN_SOURCE_HASHES_FILE
  ? readFileSync(process.env.FROZEN_SOURCE_HASHES_FILE, 'utf8') : process.env.FROZEN_SOURCE_HASHES ?? '{}';
const frozenSourceHashes = JSON.parse(frozenSourceText), freezeSHA256 = hash(frozenSourceText);
// Physical runtime inputs include dependency JS/JSON, not just package source.
// The manifest must be captured before this process starts. No missing entry can
// silently become a fresh baseline, and every entry is rechecked after the flow.
const physicalKey = path => {
  const absolute = realpathSync(path), local = relative(root, absolute);
  return local.startsWith(`..${sep}`) || isAbsolute(local) ? absolute : local;
};
function bindPhysical(path) {
  const key = physicalKey(path), actual = hash(readFileSync(path));
  assert.equal(actual, frozenSourceHashes[key], `Frozen runtime input: ${key}`);
  sourceHashes[key] = actual;
}
const extensionLoaders = new Map();
for (const extension of ['.js', '.json', '.node']) {
  const original = Module._extensions[extension];
  if (!original) continue;
  extensionLoaders.set(extension, original);
  Module._extensions[extension] = (module, filename) => { bindPhysical(filename); return original(module, filename); };
}
const esbuild = require('esbuild');
for (const path of proofPaths) assert.equal(sourceHashes[path], frozenSourceHashes[path], `Immutable product source: ${path}`);
assert.equal(hash(readFileSync(import.meta.filename)), frozenSourceHashes['apps/cad-editor/flows/modeling-split-authoring-flow.mjs']);
const fixtureSourceSHA256 = hash(readFileSync(import.meta.filename));
const fixturePath = 'packages/barocss-cad-editor/scripts/fixtures/modeling-chamfer-split/baseline-transport.json';
const fixtureBytes = readFileSync(resolve(root, fixturePath));
const fixtureHash = '6ccb5bbbcde6fd531e1700906fbef717132770ae1043498db4c170ab2c7ce4ca';
const baseline = JSON.parse(fixtureBytes), retainedHash = hash(JSON.stringify(baseline));
const unsplitFixturePath = 'packages/barocss-cad-editor/scripts/fixtures/modeling-chamfer-chain/baseline-transport.json';
const unsplitBytes = readFileSync(resolve(root, unsplitFixturePath));
const unsplitHash = '74e9a472c54aaa5d228a23d79b083c9a7c4c539bf5de6a5f274597e5fbfba4af';
const unsplitBaseline = JSON.parse(unsplitBytes), retainedUnsplitHash = hash(JSON.stringify(unsplitBaseline));
bindPhysical(resolve(root, fixturePath)); bindPhysical(resolve(root, unsplitFixturePath));
const retainedComponents = baseline.display.components;
const submissions = [];
const groups = [], sessions = [], workers = [], displays = [];
const stats = { replies: 0, authoredContextMocks: 0, coordinateChangedMocks: 0, dimensionChangedMocks: 0, nativeCalls: 0 };
const globals = new Map();
let reactRoot, mountedRoots = 0;
function setGlobal(name, value) {
  if (!globals.has(name)) globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
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
const blankText = signedJSON({ format: 'barocss-cad-model', schema: 1, units: 'mm',
  parameters: { width: 32, height: 24, thickness: 8 }, nodes: blankNodes, outputs: { part: { node: 1, side: 'solid' } } });
const oppositeNode = { kind: 'chamfer', parent: { node: 2, side: 'solid' },
  edge: { parallelTo: 'x', at: { y: { parameter: 'height' }, z: 'max' } }, distance: { parameter: 'backBevelDistance' } };
const defaultText = signedJSON({ ...JSON.parse(blankText), parameters: { ...JSON.parse(blankText).parameters, bevelDistance: 1, backBevelDistance: 2 },
  nodes: [...blankNodes, chamferNode, oppositeNode], outputs: { part: { node: 3, side: 'solid' } } });
const splitNode = { kind: 'split', parent: { node: 3, side: 'solid' }, axis: 'x', at: { parameter: 'splitAt' } };
const splitOutputs = { negative: { node: 4, side: 'negative' }, positive: { node: 4, side: 'positive' } };
function mockTransport(text, revision, id) {
  const data = JSON.parse(text), split = data.nodes.length === 5;
  assert.ok([4, 5].includes(data.nodes.length));
  assert.deepEqual(data.nodes.slice(0, 4), [...blankNodes, chamferNode, oppositeNode]);
  if (split) assert.deepEqual(data.nodes[4], splitNode);
  assert.deepEqual(data.outputs, split ? splitOutputs : { part: { node: 3, side: 'solid' } });
  const retained = split ? baseline : unsplitBaseline;
  const reply = structuredClone(retained);
  reply.id = id; reply.text = signedJSON(data);
  // Only the authoring/summary envelope changes. Native body identity, source
  // lineage, positions and display outcomes remain the exact retained packet.
  reply.summary.parameters = structuredClone(data.parameters);
  reply.summary.features = data.nodes.map((node, index) => ({ kind: node.kind, index, dependencies: index ? [index - 1] : [] }));
  reply.summary.revision = revision; reply.display.revision = revision;
  stats.authoredContextMocks++;
  if (split && data.parameters.splitAt !== 16) stats.coordinateChangedMocks++;
  if (data.parameters.width !== 32 || data.parameters.height !== 24 || data.parameters.thickness !== 8
    || data.parameters.bevelDistance !== 1 || data.parameters.backBevelDistance !== 2) stats.dimensionChangedMocks++;
  assert.deepEqual(reply.display.components, retained.display.components);
  assert.deepEqual(reply.display.outcomes, retained.display.outcomes);
  assert.deepEqual(reply.summary.outputs, retained.summary.outputs);
  return reply;
}
setGlobal('__modelingSplitAuthoringFlow', {
  controller(create, ...args) {
    assert.equal(sessions.length, 0, 'One controller lifetime only');
    const controller = create(...args), calls = [];
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
      updates: 0, resizes: 0, disposals: 0, width: 900, height: 600, accepted: null,
      visible: null, canvas: null, candidates: [] };
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
      return candidate;
    };
    return {
      prepare(display) { return prepare(display, false); }, preparePreview(display) { return prepare(display, true); },
      updateScene(display) {
        record.updateAttempts++;
        assert.ok(record.accepted && record.visible === record.accepted && record.canvas?.isConnected && !record.disposals);
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
const boundaryPlugin = { name: 'explicit-split-authoring-boundaries', setup(build) {
  build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\.\/modeling-controller\.js$/ }, () => ({ path: 'controller', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\.\/prism-feature-display\.js$/ }, () => ({ path: 'display', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'view-boundary' }));
  build.onLoad({ filter: /.*/, namespace: 'view-boundary' }, ({ path }) => ({ resolveDir: root, contents: {
    provider: 'throw Error("Provider execution is outside this transport-replay fixture.");',
    legacy: 'export function createPrismFeatureEngine() { return () => { throw Error("Legacy native execution is outside this flow."); }; }',
    controller: `import {createCadEditorModelingController as create} from ${JSON.stringify(source('modeling-controller.ts'))}; export const createCadEditorModelingController = (...args) => globalThis.__modelingSplitAuthoringFlow.controller(create, ...args);`,
    display: 'export const createPrismFeatureDisplay = globalThis.__modelingSplitAuthoringFlow.display;',
    gpu: ['engine-scene', 'engine-camera-ray', 'engine-raycast', 'kernel-face-preview'].map(name =>
      `export * from ${JSON.stringify(resolve(root, `packages/barocss-gpu/src/${name}.ts`))};`).join('\n'),
  }[path] }));
} };
async function bundle(entry) {
  const result = await esbuild.build({ absWorkingDir: root, entryPoints: [source(entry)], bundle: true, platform: 'node', format: 'cjs',
    jsx: 'automatic', write: false, metafile: true, logLevel: 'silent',
    external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/*', 'radix-ui', 'class-variance-authority', 'clsx', 'tailwind-merge'],
    nodePaths: [resolve(depsRoot, 'node_modules')], plugins: [boundaryPlugin],
    define: { 'import.meta.url': JSON.stringify(pathToFileURL(source(entry)).href) } });
  const inputs = Object.keys(result.metafile.inputs);
  assert.ok(!inputs.some(path => /(?:\.wasm|barocss-cad\/src\/|prism-feature-display\.ts$)/.test(path)), 'Native/GPU display implementations must not execute');
  for (const path of inputs) {
    if (path.startsWith('view-boundary:')) continue;
    const absolute = resolve(root, path);
    // Local package references must never silently resolve another worktree.
    if (/barocss-[^/]+\/src\//.test(absolute)) assert.ok(realpathSync(absolute).startsWith(`${root}/packages/`), `Own-worktree package: ${path}`);
    bindPhysical(absolute);
  }
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
  return { api: module.exports, inputs };
}
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://example.invalid/' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'Event', 'MouseEvent', 'KeyboardEvent', 'navigator']) setGlobal(name, dom.window[name]);
setGlobal('IS_REACT_ACT_ENVIRONMENT', true);
setGlobal('ResizeObserver', class {
  constructor(callback) { this.callback = callback; this.observed = []; this.disconnections = 0; }
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
  postMessage(command) {
    this.requests.push(structuredClone(command));
    if (command.kind === 'prepare-source' && command.operation === 'structure') {
      assert.equal(command.baseText, current().authoredText);
      const submitted = JSON.parse(command.text), prior = JSON.parse(command.baseText);
      assert.deepEqual(submitted.nodes.slice(0, prior.nodes.length), prior.nodes);
      assert.equal(command.command.kind, 'split-part'); assert.equal(prior.nodes.length, 4);
      assert.deepEqual(submitted.nodes[4], splitNode);
      assert.deepEqual(submitted.parameters, { ...prior.parameters, splitAt: command.command.at });
      assert.deepEqual(command.command.target, { name: 'part', solidId: current().accepted.outputs[0].solidId, node: 3 });
      assert.ok(Object.is(submitted.nodes[0].min[0], -0));
      assert.deepEqual(submitted.outputs, splitOutputs);
      assert.equal(command.text, signedJSON(submitted));
      const built = structure.api.buildModelingStructure(command.baseText, current().accepted, command.command);
      assert.equal(built.text, command.text); assert.equal(built.selectedOutput, 'negative');
      submissions.push({ kind: command.kind, operation: command.operation, text: command.text, sourceSHA256: hash(command.text),
        parameters: submitted.parameters, at: command.command.at, target: command.command.target });

    }
  }
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
      assert.ok(['open', 'prepare-source', 'prepare-preview'].includes(kind), `Unplanned command: ${kind}`);
      const text = kind === 'prepare-preview'
        ? signedJSON({ ...JSON.parse(this.accepted.text), parameters: { ...this.accepted.summary.parameters, ...command.parameters } }) : command.text;
      reply = mockTransport(text, kind === 'open' ? command.revision ?? 0 : command.expectedRevision + 1, id);
      if (kind === 'prepare-source' || kind === 'prepare-preview') {
        reply.kind = kind === 'prepare-source' ? 'source-preview' : 'preview';
        if (kind === 'prepare-source') reply.operation = command.operation;
        reply.binding = { workerToken: command.workerToken, acceptedTaskToken: command.acceptedTaskToken,
          expectedRevision: command.expectedRevision, candidateToken: command.candidateToken, previewTaskToken: command.taskToken };
        this.candidate = structuredClone(reply);
      } else this.accepted = structuredClone(reply);
    }
    assert.ok(++stats.replies <= 18, 'Frozen18-controlled-reply ceiling');
    this.answered.add(id); this.lastReply = structuredClone(reply);
    this.callbacks.get('message')({ data: structuredClone(reply) }); return reply;
  }
});
const React = require('react'), { createRoot } = require('react-dom/client'), { act } = React;
const structure = await bundle('modeling-structure.ts');
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
const capturedKey = (callback, value) => () => callback({ key: value, nativeEvent: { isComposing: false },
  preventDefault() { assert.fail('Stale key callback must not prevent default'); },
  stopPropagation() { assert.fail('Stale key callback must not stop propagation'); } });
async function assertStale(callback, label) {
  const before = current(), beforeCalls = calls(), requestCount = commands(), shown = port().visible;
  const updates = port().updates, focus = document.activeElement, alerts = errors();
  await act(async () => { callback(); await tick(); });
  assert.deepEqual(current(), before, label); assert.deepEqual(calls(), beforeCalls, label);
  assert.equal(commands(), requestCount, label); assert.equal(port().visible, shown, label); assert.equal(port().updates, updates, label);
  assert.equal(document.activeElement, focus, label); assert.deepEqual(errors(), alerts, label);
}
const splitField = () => input('Model X split coordinate (mm)');
const previewButton = () => button(current().workerReady ? 'Preview operation' : 'Recover accepted model and preview operation');
const proposal = () => JSON.parse(panel('split-part').querySelector('pre').textContent);
const acceptedUnchanged = before => assert.deepEqual(authority(), before, 'Temporary split settings/preview cannot change accepted authority');
const assertSplit = (data, at) => {
  assert.deepEqual(data.nodes.slice(0, 4), [...blankNodes, chamferNode, oppositeNode]);
  assert.deepEqual(data.nodes[4], splitNode); assert.deepEqual(data.outputs, splitOutputs);
  assert.equal(data.parameters.splitAt, at);
  assert.ok(Object.is(data.nodes[0].min[0], -0), 'Signed zero survives serialization');
};
const assertRetainedSplit = packet => {
  assert.deepEqual(packet.components, retainedComponents, 'Exact genuine split body meshes, IDs and lineage');
  assert.deepEqual(packet.outcomes, baseline.display.outcomes);
  assert.deepEqual(packet.components.map(component => component.report.solidId), ['m4_neg', 'm4_pos']);
  assert.notDeepEqual(packet.components[0].mesh.positionsMM, packet.components[1].mesh.positionsMM);
};
const openSplit = async () => {
  const command = button('Split part');
  assert.match(command.closest('details').querySelector('summary').textContent, /MODIFY/);
  await click(command); assertPanel('split-part');
  assert.equal(splitField().value, '16', 'Each newly opened command defaults to half authored width');
};
const preview = async (at, keyboard = false) => {
  const before = authority();
  if (keyboard) assert.equal((await key(splitField(), 'Enter')).defaultPrevented, true); else await click(previewButton());
  assert.equal(splitField().disabled, true, 'Coordinate cannot edit an in-flight preview');
  assert.equal(workers.at(-1).requests.at(-1).command.at, at);
  const pendingRequests = commands();
  await key(splitField(), 'Enter'); await key(splitField(), 'Escape');
  assert.equal(commands(), pendingRequests, 'In-flight keyboard input is inert');
  await settled(); assert.equal(current().preview?.status, 'ready', errors().join(' '));
  assert.equal(splitField().disabled, false); assertSplit(proposal(), at); acceptedUnchanged(before);
  assert.deepEqual(current().preview.outputs.map(output => output.name), ['negative', 'positive']);
  assertRetainedSplit(port().visible.packet);
  assert.equal(port().visible.packet.profile, 'model-outputs', 'Retained convex packet displays both sides');
  assert.equal(port().visible.selectedOutput, undefined, 'Convex packet does not invent body-face selection metadata');
};
const cancel = async (keyboard = false) => {
  if (keyboard) assert.equal((await key(splitField(), 'Escape')).defaultPrevented, true); else await click(button('Cancel'));
  await settled(); assertClosed();
};
async function apply(at) {
  const before = authority(), shown = port().visible, replays = stats.authoredContextMocks;
  const expectedText = signedJSON(proposal());
  assert.equal(button('Apply operation').disabled, false);
  await click(button('Apply operation')); acceptedUnchanged(before);
  assert.equal(workers.at(-1).requests.at(-1).kind, 'accept-source');
  await settled(); assertClosed(); assert.equal(current().error, null, errors().join(' '));
  assertSplit(data(), at); assert.equal(current().authoredText, expectedText);
  assert.equal(current().history.count, before.history.index + 2);
  assert.equal(current().generation, before.generation + 1);
  assert.equal(port().accepted, shown); assert.equal(port().visible, shown);
  assert.equal(stats.authoredContextMocks, replays, 'Apply promotes the prepared candidate without another provider evaluation');
  assert.deepEqual(current().accepted.outputs.map(output => [output.name, output.solidId]), [['negative', 'm4_neg'], ['positive', 'm4_pos']]);
  assert.equal(current().display.packet.profile, 'model-outputs');
}
async function editDimension(label, value) {
  await click(button('Edit model dimensions')); assertPanel('dimensions');
  const before = authority();
  await change(input(label), String(value)); acceptedUnchanged(before);
  await click(button('Preview dimensions')); await settled();
  assert.equal(current().preview?.status, 'ready', errors().join(' ')); acceptedUnchanged(before);
  const shown = port().visible, evaluations = stats.authoredContextMocks;
  await click(button('Apply dimensions')); acceptedUnchanged(before);
  assert.equal(workers.at(-1).requests.at(-1).kind, 'accept-preview');
  await settled(); assertClosed(); assert.equal(current().error, null, errors().join(' '));
  assert.equal(current().history.count, before.history.count + 1);
  assert.equal(stats.authoredContextMocks, evaluations); assert.equal(port().accepted, shown);
  assertRetainedSplit(current().display.packet);
}
function report(name) { groups.push(name); console.log(JSON.stringify({ status: 'PASS', name, replies: stats.replies })); }
console.log(JSON.stringify({ status: 'START', issue: 2018, sourceHashes, fixtureSourceSHA256, freezeSHA256,
  limits: { reactRoots: 1, controllerLifetimes: 1, maximumReplies: 18, plannedReplies: 17, nativeCalls: 0 } }));
try {
  assert.equal(hash(fixtureBytes), fixtureHash); assert.equal(fixtureBytes.length, 82509);
  assert.equal(hash(unsplitBytes), unsplitHash); assert.equal(unsplitBytes.length, 41471);
  assertRetainedSplit(baseline.display);
  assert.ok(++mountedRoots <= 1); reactRoot = createRoot(container);
  await act(async () => {
    reactRoot.render(React.createElement(ui.api.CadEditorModeling, { workspace: true, initialAuthoredText: defaultText })); await tick();
  });
  await settled(); assert.equal(current().error, null); assert.equal(current().history.count, 1);
  assert.equal(button('Split part'), undefined, 'No feature selection cannot expose Split part');
  for (const index of [0, 1, 2]) { await select(index); assert.equal(button('Split part'), undefined); }
  await select(3); await openSplit();
  const initial = authority(); assertSplit(proposal(), 16); assert.equal(button('Apply operation').disabled, true);
  assert.match(panel('split-part').textContent, /absolute model X/);
  const beforeKeys = commands();
  for (const value of ['Enter', 'Escape']) for (const fields of [{ repeat: true }, { isComposing: true }, { keyCode: 229 },
    { shiftKey: true }, { altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
    assert.equal((await key(splitField(), value, fields)).defaultPrevented, false);
    assert.equal(commands(), beforeKeys); assertPanel('split-part');
  }
  await preview(16, true);
  const staleSixteen = { apply: reactCallback(button('Apply operation')),
    preview: reactCallback(previewButton()), field: reactCallback(splitField(), 'onChange'), key: reactCallback(splitField(), 'onKeyDown'), cancel: reactCallback(button('Cancel')) };
  await change(splitField(), '8'); await settled();
  assert.equal(current().preview, null); assert.equal(button('Apply operation').disabled, true);
  assertSplit(proposal(), 8); acceptedUnchanged(initial);
  assert.equal(port().visible, port().accepted, 'Coordinate change removes the previous ready preview');
  for (const name of ['apply', 'preview']) await assertStale(staleSixteen[name], `Coordinate change invalidates captured ${name}`);
  await assertStale(() => staleSixteen.field({ target: { value: '12' } }), 'Old coordinate callback cannot replace current coordinate');
  assert.equal(splitField().value, '8');
  await change(splitField(), '16');
  await assertStale(staleSixteen.apply, 'Coordinate ABA cannot revive captured ready Apply');
  for (const value of ['Enter', 'Escape']) await assertStale(capturedKey(staleSixteen.key, value), `Coordinate ABA cannot revive ${value}`);
  await change(splitField(), '8'); await preview(8);
  report('Selected-only MODIFY command, default16 preview, guarded Enter/Escape, change8 invalidation and coordinate ABA');

  const canceled = { apply: reactCallback(button('Apply operation')), preview: reactCallback(previewButton()),
    field: reactCallback(splitField(), 'onChange'), key: reactCallback(splitField(), 'onKeyDown'), cancel: reactCallback(button('Cancel')) };
  await cancel(true); acceptedUnchanged(initial); assert.equal(current().preview, null);
  assert.equal(port().visible, port().accepted);
  await assertStale(canceled.apply, 'Escape-canceled Apply remains inert');
  await openSplit(); assertSplit(proposal(), 16);
  for (const name of ['apply', 'preview', 'cancel']) await assertStale(canceled[name], `Reopened command cannot revive old ${name}`);
  await assertStale(() => canceled.field({ target: { value: '12' } }), 'Reopened command cannot revive old field callback');
  for (const value of ['Enter', 'Escape']) await assertStale(capturedKey(canceled.key, value), `Reopened command cannot revive ${value}`);
  await change(splitField(), '8'); await preview(8); await cancel(); acceptedUnchanged(initial);
  report('Escape and button Cancel preserve source/history; reopened command resets default16 and rejects stale callbacks');

  await openSplit(); await change(splitField(), '8'); await preview(8); await apply(8);
  const appliedText = current().authoredText;
  assert.equal(current().history.count, 2); assert.equal(current().history.index, 1);
  await select(4); assert.equal(button('Split part'), undefined, 'Split is terminal');
  assert.match(testid('modeling-split-warning').textContent, /width edits do not recenter/);
  await click(button('Undo')); await settled();
  assert.equal(current().authoredText, defaultText); assert.equal(current().history.index, 0);
  assert.deepEqual(current().accepted.outputs.map(output => output.name), ['part']);
  await click(button('Redo')); await settled();
  assert.equal(current().authoredText, appliedText); assert.equal(current().history.index, 1);
  assert.equal(current().history.count, 2); assert.equal(current().display.packet.profile, 'model-outputs');
  assertRetainedSplit(current().display.packet);
  report('Exact acknowledged Apply adds one history step, consumes part, retains distinct sides, and Undo/Redo restore exact source');

  await editDimension('width (mm)', 40);
  assertSplit(data(), 8); assert.equal(data().parameters.width, 40);
  assert.equal(data().parameters.bevelDistance, 1); assert.equal(data().parameters.backBevelDistance, 2);
  await editDimension('splitAt · absolute model X split coordinate (mm)', 10);
  assertSplit(data(), 10); assert.equal(data().parameters.width, 40);
  assert.equal(current().history.count, 4);
  report('Subsequent dimensions keep splitAt absolute and independent from width; coordinate edits retain authored rail drivers');

  assert.equal(stats.replies, 17); assert.equal(sessions.length, 1);
  assert.deepEqual(submissions.map(submission => submission.at), [16, 8, 8, 8]);
  assertRetainedSplit(current().display.packet);
  assert.equal(hash(JSON.stringify(baseline)), retainedHash);
  assert.equal(hash(JSON.stringify(unsplitBaseline)), retainedUnsplitHash);
  assert.equal(hash(fixtureBytes), fixtureHash); assert.equal(hash(unsplitBytes), unsplitHash);
} finally {
  if (reactRoot) await act(async () => { reactRoot.unmount(); await tick(); });
  dom.window.close();
  for (const [extension, loader] of extensionLoaders) Module._extensions[extension] = loader;
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  }
}
assert.ok(workers.every(worker => worker.terminated)); assert.equal(stats.nativeCalls, 0);
for (const [path, expected] of Object.entries(sourceHashes)) assert.equal(hash(readFileSync(resolve(root, path))), expected);
assert.equal(hash(readFileSync(import.meta.filename)), fixtureSourceSHA256);
if (process.env.FROZEN_SOURCE_HASHES_FILE) assert.equal(hash(readFileSync(process.env.FROZEN_SOURCE_HASHES_FILE)), freezeSHA256);
console.log(JSON.stringify({ status: 'PASS', issue: 2018, node: process.version, groups,
  mountedRoots, controllerLifetimes: sessions.length, ...stats, sourceHashes, fixtureSourceSHA256, freezeSHA256, submissions,
  workerCommands: workers.flatMap(worker => worker.requests.map(({ kind, operation }) => ({ kind, ...(operation ? { operation } : {}) }))),
  fixtures: [{ path: fixturePath, sha256: fixtureHash, bytes: fixtureBytes.length },
    { path: unsplitFixturePath, sha256: unsplitHash, bytes: unsplitBytes.length }],
  boundaries: { actual: ['React', 'controller', 'structure helper', 'CPU receiver', 'DOM events and captured callbacks'],
    controlled: ['Worker/provider authoring-summary context', 'coordinate/dimension-changed responses reuse original native geometry', 'display port', 'ResizeObserver'],
    retained: ['genuine negative/positive native meshes', 'm4_neg/m4_pos solid IDs', 'native lineage and outcomes'],
    unrun: ['native evaluation', 'changed-coordinate geometry', 'GPU pixels', 'physical Save/Open', 'STL', 'manufacturing'] } }));
