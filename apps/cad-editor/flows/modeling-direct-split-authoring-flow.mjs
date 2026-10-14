// #2022: mounted direct-blank and first-chamfer Split part controls.
// The real React UI, controller, source/summary admission and structure helper run.
// Worker/provider replies, scene preparation and renderer are EXPLICIT MOCKS.
// No retained native fixtures, meshes, lineage or m2/m3/m4 geometry are used.
// Mock identities and placeholder volumes do not certify any physical geometry.
// Native exactness, real scene admission/picks and GPU acceptance run separately.
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
    'packages/barocss-cad-editor/src/modeling-file.ts',
  'packages/barocss-cad-editor/src/modeling-diagnostic.ts',
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
assert.equal(hash(readFileSync(import.meta.filename)), frozenSourceHashes['apps/cad-editor/flows/modeling-direct-split-authoring-flow.mjs']);
const fixtureSourceSHA256 = hash(readFileSync(import.meta.filename));
const submissions = [];
const groups = [], sessions = [], workers = [], displays = [];
const stats = { replies: 0, providerMocks: 0, refusalMocks: 0, sceneMocks: 0, nativeCalls: 0 };
const completedCases = [];
let activeCase;
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
const cases = ['blank', 'front-chamfer'].map((name, index) => {
  // Different authored driver names prove the half-width default is resolved.
  const widthName = index === 0 ? 'spanX' : 'width';
  const nodes = [
    { kind: 'sketch', profile: 'rectangle', min: [-0, 0], max: [{ parameter: widthName }, { parameter: 'height' }] },
    { kind: 'extrude', sketch: 0, height: { parameter: 'thickness' } },
    ...(index ? [{ kind: 'chamfer', parent: { node: 1, side: 'solid' },
      edge: { parallelTo: 'x', at: { y: 0, z: 'max' } }, distance: { parameter: 'bevelDistance' } }] : []),
  ];
  const parameters = { [widthName]: 31.25, height: 24, thickness: 8, ...(index ? { bevelDistance: 1 } : {}) };
  return { name, widthName, nodes, parameters, targetIndex: nodes.length - 1, splitIndex: nodes.length,
    text: signedJSON({ format: 'barocss-cad-model', schema: 1, units: 'mm', parameters,
      nodes, outputs: { part: { node: nodes.length - 1, side: 'solid' } } }) };
});
const expectedSplitNode = () => ({ kind: 'split', parent: { node: activeCase.targetIndex, side: 'solid' },
  axis: 'x', at: { parameter: 'splitAt' } });
const expectedSplitOutputs = () => ({ negative: { node: activeCase.splitIndex, side: 'negative' },
  positive: { node: activeCase.splitIndex, side: 'positive' } });
const mockSolidId = name => `mock_${activeCase.name.replaceAll('-', '_')}_n${name === 'part' ? activeCase.targetIndex : activeCase.splitIndex}_${name}`;
function mockTransport(text, revision, id) {
  const data = JSON.parse(text), split = data.nodes.at(-1).kind === 'split';
  assert.equal(data.nodes.length, activeCase.nodes.length + Number(split));
  assert.deepEqual(data.nodes.slice(0, activeCase.nodes.length), activeCase.nodes);
  if (split) assert.deepEqual(data.nodes.at(-1), expectedSplitNode());
  assert.deepEqual(data.outputs, split ? expectedSplitOutputs() : { part: { node: activeCase.targetIndex, side: 'solid' } });
  // Deliberately synthetic transport: there are NO meshes or native lineage.
  // Placeholder volume 1/1 is never used as measured/expected CAD evidence.
  const outputs = Object.keys(data.outputs).map(name => ({ name, solidId: mockSolidId(name),
    volumeMM3: { numerator: '1', denominator: '1' } }));
  const documentId = `MOCK_controls_${activeCase.name}`;
  stats.providerMocks++;
  return { id, ok: true, text: signedJSON(data), summary: { source: 'model', documentId, revision,
    parameters: structuredClone(data.parameters),
    features: data.nodes.map((node, index) => ({ kind: node.kind, index, dependencies: index ? [index - 1] : [] })), outputs },
    display: { profile: 'model-outputs', documentId, revision, components: [],
      outcomes: outputs.map(({ name, solidId }) => ({ role: name, solidId, status: 'solid' })) } };
}
setGlobal('__modelingSplitAuthoringFlow', {
  controller(create, ...args) {
    assert.ok(sessions.length < cases.length, 'One controller lifetime per isolated case');
    const controller = create(...args), calls = [];
    const session = new Proxy(controller, { get(target, name) {
      const value = target[name];
      if (typeof value !== 'function' || name === 'getSnapshot') return value;
      return (...args) => { calls.push({ name, args }); return value(...args); };
    } });
    sessions.push({ controller, session, calls }); return session;
  },
  scene(packet) {
    assert.equal(packet.documentId, `MOCK_controls_${activeCase.name}`);
    assert.deepEqual(packet.components, [], 'Scene boundary explicitly receives no native geometry');
    stats.sceneMocks++;
    return { packet: structuredClone(packet), scene: {}, canvasLabel: 'MOCK controls only; no geometry' };
  },
  // Controlled reversible renderer. A candidate owns its own real DOM canvas;
  // a camera update changes only the existing accepted canvas/scene. Separate
  // native acceptance tests real scene/renderer behavior.
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
  build.onResolve({ filter: /^\.\/modeling-scene\.js$/ }, () => ({ path: 'scene', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\.\/prism-feature-display\.js$/ }, () => ({ path: 'display', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'view-boundary' }));
  build.onLoad({ filter: /.*/, namespace: 'view-boundary' }, ({ path }) => ({ resolveDir: root, contents: {
    provider: 'throw Error("Native provider execution is outside this explicit MOCK controls test.");',
    scene: 'export const prepareModelingScene = globalThis.__modelingSplitAuthoringFlow.scene; export function pickModelingScene() { throw Error("Physical picks are outside this MOCK controls test."); }',
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
  assert.ok(!inputs.some(path => /(?:\.wasm|barocss-cad\/src\/|(?:prism-feature-display|modeling-scene)\.ts$)/.test(path)), 'Native/GPU display implementations must not execute');
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
      assert.equal(command.command.kind, 'split-part'); assert.equal(prior.nodes.length, activeCase.nodes.length);
      assert.deepEqual(submitted.nodes[activeCase.splitIndex], expectedSplitNode());
      assert.deepEqual(submitted.parameters, { ...prior.parameters, splitAt: command.command.at });
      assert.deepEqual(command.command.target, { name: 'part', solidId: mockSolidId('part'), node: activeCase.targetIndex });
      assert.ok(Object.is(submitted.nodes[0].min[0], -0));
      assert.deepEqual(submitted.outputs, expectedSplitOutputs());
      assert.equal(command.text, signedJSON(submitted));
      const built = structure.api.buildModelingStructure(command.baseText, current().accepted, command.command);
      assert.equal(built.text, command.text); assert.equal(built.selectedOutput, 'negative');
      submissions.push({ case: activeCase.name, kind: command.kind, operation: command.operation, text: command.text, sourceSHA256: hash(command.text),
        parameters: submitted.parameters, at: command.command.at, target: command.command.target });

    }
  }
  terminate() { this.terminated = true; }
  accept(command = this.requests.find(item => !this.answered.has(item.id))) {
    assert.ok(command && !this.answered.has(command.id));
    const { id, kind } = command;
    let reply;
    if (kind === 'prepare-source' && command.operation === 'structure' && command.command.at === 40) {
      stats.refusalMocks++; this.candidate = null;
      const message = 'MOCK native refusal: split coordinate 40 is outside this controls-test part.';
      reply = { id, ok: false, message, diagnostic: { stage: 'native', code: 'NATIVE', operation: 'split', message } };
    } else if (kind === 'discard-preview') {
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
    assert.ok(++stats.replies <= 40, 'Frozen40-controlled-reply ceiling');
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
  assert.equal(data.nodes.length, activeCase.nodes.length + 1);
  assert.deepEqual(data.nodes.slice(0, activeCase.nodes.length), activeCase.nodes);
  assert.deepEqual(data.nodes.at(-1), expectedSplitNode()); assert.deepEqual(data.outputs, expectedSplitOutputs());
  assert.equal(data.parameters.splitAt, at);
  assert.ok(Object.is(data.nodes[0].min[0], -0), 'Signed zero survives serialization');
  assert.deepEqual(Object.keys(data.parameters).sort(), [...Object.keys(activeCase.parameters), 'splitAt'].sort(),
    'Direct split introduces no artificial bevel parameters');
  if (activeCase.name === 'front-chamfer') assert.equal(data.parameters.bevelDistance, 1);
};
const assertMockSplit = packet => {
  assert.equal(packet.documentId, `MOCK_controls_${activeCase.name}`);
  assert.deepEqual(packet.components, [], 'This controls test cannot claim geometry');
  assert.deepEqual(packet.outcomes, ['negative', 'positive'].map(role => ({ role, solidId: mockSolidId(role), status: 'solid' })));
};
const openSplit = async () => {
  const requestCount = commands();
  const command = button('Split part');
  assert.match(command.closest('details').querySelector('summary').textContent, /MODIFY/);
  await click(command); assertPanel('split-part');
  assert.equal(splitField().value, '15.625', '31.25 authored X width defaults to exact half, independent of parameter name');
  assert.equal(commands(), requestCount, 'Opening the command does not evaluate provider geometry');
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
  assertMockSplit(port().visible.packet);
  assert.equal(port().visible.packet.profile, 'model-outputs', 'Synthetic transport lists both output identities');
  assert.equal(port().visible.selectedOutput, undefined, 'Convex packet does not invent body-face selection metadata');
};
const cancel = async (keyboard = false) => {
  if (keyboard) assert.equal((await key(splitField(), 'Escape')).defaultPrevented, true); else await click(button('Cancel'));
  await settled(); assertClosed();
};
async function apply(at) {
  const before = authority(), shown = port().visible, replays = stats.providerMocks;
  const expectedText = signedJSON(proposal());
  assert.equal(button('Apply operation').disabled, false);
  await click(button('Apply operation')); acceptedUnchanged(before);
  assert.equal(workers.at(-1).requests.at(-1).kind, 'accept-source');
  await settled(); assertClosed(); assert.equal(current().error, null, errors().join(' '));
  assertSplit(data(), at); assert.equal(current().authoredText, expectedText);
  assert.equal(current().history.count, before.history.index + 2);
  assert.equal(current().generation, before.generation + 1);
  assert.equal(port().accepted, shown); assert.equal(port().visible, shown);
  assert.equal(stats.providerMocks, replays, 'Apply promotes the prepared candidate without another provider evaluation');
  assert.deepEqual(current().accepted.outputs.map(output => [output.name, output.solidId]), [['negative', mockSolidId('negative')], ['positive', mockSolidId('positive')]]);
  assert.equal(current().display.packet.profile, 'model-outputs');
}
async function editDimension(label, value) {
  await click(button('Edit model dimensions')); assertPanel('dimensions');
  const before = authority();
  await change(input(label), String(value)); acceptedUnchanged(before);
  await click(button('Preview dimensions')); await settled();
  assert.equal(current().preview?.status, 'ready', errors().join(' ')); acceptedUnchanged(before);
  const shown = port().visible, evaluations = stats.providerMocks;
  await click(button('Apply dimensions')); acceptedUnchanged(before);
  assert.equal(workers.at(-1).requests.at(-1).kind, 'accept-preview');
  await settled(); assertClosed(); assert.equal(current().error, null, errors().join(' '));
  assert.equal(current().history.count, before.history.count + 1);
  assert.equal(stats.providerMocks, evaluations); assert.equal(port().accepted, shown);
  assertMockSplit(current().display.packet);
}
function report(name) { groups.push(`${activeCase.name}: ${name}`); console.log(JSON.stringify({ status: 'PASS', case: activeCase.name, name, replies: stats.replies })); }
const callbacks = () => ({ apply: reactCallback(button('Apply operation')), preview: reactCallback(previewButton()),
  field: reactCallback(splitField(), 'onChange'), key: reactCallback(splitField(), 'onKeyDown'), cancel: reactCallback(button('Cancel')) });
async function staleCallbacks(saved, label) {
  for (const name of ['apply', 'preview', 'cancel']) await assertStale(saved[name], `${label}: ${name}`);
  await assertStale(() => saved.field({ target: { value: '12' } }), `${label}: field`);
  for (const value of ['Enter', 'Escape']) await assertStale(capturedKey(saved.key, value), `${label}: ${value}`);
}
console.log(JSON.stringify({ status: 'START', issue: 2022, sourceHashes, fixtureSourceSHA256, freezeSHA256,
  limits: { reactRoots: 2, controllerLifetimes: 2, maximumReplies: 40, plannedReplies: 38, nativeCalls: 0 },
  evidence: 'Explicit provider/scene/display MOCKS; no geometry, lineage or retained native fixture' }));
let priorSessionCallbacks;
try {
  for (activeCase of cases) {
    const beforeReplies = stats.replies, beforeSubmissions = submissions.length;
    assert.ok(++mountedRoots <= cases.length); reactRoot = createRoot(container);
    await act(async () => {
      reactRoot.render(React.createElement(ui.api.CadEditorModeling, { workspace: true, initialAuthoredText: activeCase.text })); await tick();
    });
    await settled(); assert.equal(current().error, null, errors().join(' ')); assert.equal(current().history.count, 1);
    if (priorSessionCallbacks) await staleCallbacks(priorSessionCallbacks, 'Unmounted prior session cannot mutate current session');
    assert.equal(button('Split part'), undefined, 'No feature selection cannot expose Split part');
    for (let index = 0; index < activeCase.targetIndex; index++) {
      await select(index); assert.equal(button('Split part'), undefined, 'Only selected current Extrude/first Chamfer is eligible');
    }
    await select(activeCase.targetIndex); await openSplit();
    const initial = authority(); assertSplit(proposal(), 15.625); assert.equal(button('Apply operation').disabled, true);
    assert.match(panel('split-part').textContent, /absolute model X/);
    const beforeKeys = commands();
    for (const value of ['Enter', 'Escape']) for (const fields of [{ repeat: true }, { isComposing: true }, { keyCode: 229 },
      { shiftKey: true }, { altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
      assert.equal((await key(splitField(), value, fields)).defaultPrevented, false);
      assert.equal(commands(), beforeKeys); assertPanel('split-part');
    }
    await preview(15.625, true);
    const staleHalf = callbacks();
    await change(splitField(), '8.125'); await settled();
    assert.equal(current().preview, null); assert.equal(button('Apply operation').disabled, true);
    assertSplit(proposal(), 8.125); acceptedUnchanged(initial);
    assert.equal(port().visible, port().accepted, 'Coordinate change removes previous ready preview');
    await staleCallbacks(staleHalf, 'Coordinate change invalidates captured ready callbacks');
    assert.equal(splitField().value, '8.125');
    await change(splitField(), '15.625');
    await staleCallbacks(staleHalf, 'Coordinate ABA cannot revive captured ready callbacks');
    await change(splitField(), '8.125'); await preview(8.125);
    report('Selected current stage, decimal half-width, guarded keys and coordinate-ready/ABA invalidation');

    const canceled = callbacks();
    await cancel(true); acceptedUnchanged(initial); assert.equal(current().preview, null);
    assert.equal(port().visible, port().accepted); await assertStale(canceled.apply, 'Escape-canceled Apply remains inert');
    await openSplit(); assertSplit(proposal(), 15.625);
    await staleCallbacks(canceled, 'Reopened command cannot revive escaped command');
    await change(splitField(), '8.125'); await preview(8.125); await cancel(); acceptedUnchanged(initial);
    report('Escape and button Cancel preserve accepted source/history and reset reopened defaults');

    await openSplit(); await change(splitField(), '40');
    const beforeRefusal = authority(), previewsBeforeRefusal = port().previewPrepares;
    await click(previewButton()); await settled();
    assert.equal(current().preview?.status, 'error');
    assert.equal(current().preview.diagnostic.stage, 'native');
    assert.match(testid('modeling-preview-diagnostic').textContent, /MOCK native refusal/);
    assert.ok(errors().some(message => message.includes('MOCK native refusal')));
    assert.equal(button('Apply operation').disabled, true);
    assert.equal(button('Cancel').disabled, false, 'Cancel stays enabled in DOM after refusal');
    assert.equal(port().previewPrepares, previewsBeforeRefusal, 'Refused candidate never prepares a display');
    assert.equal(port().visible, port().accepted); acceptedUnchanged(beforeRefusal);
    await cancel(activeCase.name === 'front-chamfer'); acceptedUnchanged(beforeRefusal);
    report('Synthetic native refusal retains accepted model; DOM Cancel/Escape works (CSS occlusion untested)');

    await openSplit(); await preview(15.625);
    const deselected = callbacks();
    await select(0); await settled(); assertClosed(); acceptedUnchanged(initial);
    assert.equal(current().preview, null); assert.equal(port().visible, port().accepted);
    assert.equal(button('Split part'), undefined);
    await staleCallbacks(deselected, 'Selection change invalidates prepared command');
    await select(activeCase.targetIndex); await openSplit();
    await staleCallbacks(deselected, 'Selection ABA cannot revive prepared command');
    report('Selection change cancels ready preview; selection ABA preserves source and invalidates old callbacks');

    await change(splitField(), '8.125'); await preview(8.125);
    const preApply = callbacks(), originalGeneration = current().generation;
    const originalCommand = { kind: 'split-part', target: { name: 'part', solidId: mockSolidId('part'), node: activeCase.targetIndex }, at: 8.125 };
    await apply(8.125);
    const appliedText = current().authoredText;
    assert.equal(current().history.count, 2); assert.equal(current().history.index, 1);
    await staleCallbacks(preApply, 'Accepted source change invalidates old command');
    await select(activeCase.splitIndex); assert.equal(button('Split part'), undefined, 'Split is terminal');
    const terminalRequests = commands();
    await assert.rejects(sessions.at(-1).controller.previewStructure(originalCommand, current().generation), /split|part|rail|current/i);
    assert.equal(commands(), terminalRequests, 'Repeated split refuses before provider work');
    assert.match(testid('modeling-split-warning').textContent, /width edits do not recenter/);
    report('Current ready Apply promotes exact serialized candidate once; terminal split refuses before provider');

    await click(button('Undo')); await settled();
    assert.equal(current().authoredText, activeCase.text); assert.equal(current().history.index, 0);
    assert.deepEqual(current().accepted.outputs.map(output => output.name), ['part']);
    assert.ok(current().generation > originalGeneration);
    await select(activeCase.targetIndex); await openSplit();
    await staleCallbacks(preApply, 'Source ABA with newer generation cannot revive original ready command');
    await cancel();
    await click(button('Redo')); await settled();
    assert.equal(current().authoredText, appliedText); assert.equal(current().history.index, 1);
    assert.equal(current().history.count, 2); assertMockSplit(current().display.packet);
    await click(button('Save or open a model')); await click(button('Show saved model'));
    assert.equal(input('Saved model data').value, appliedText, 'Save panel shows exact accepted serialization');
    assertSplit(JSON.parse(input('Saved model data').value), 8.125);
    await click(button('Close options'));
    report('Undo/Redo restore exact source, source ABA rejects old handlers, Save exposes only accepted serialization');

    await editDimension(`${activeCase.widthName} (mm)`, 40);
    assertSplit(data(), 8.125); assert.equal(data().parameters[activeCase.widthName], 40);
    assert.equal(current().history.count, 3);
    report('Width edits retain absolute splitAt and original independent authored drivers');

    assert.equal(stats.replies - beforeReplies, 19);
    assert.deepEqual(submissions.slice(beforeSubmissions).map(submission => submission.at), [15.625, 8.125, 8.125, 40, 15.625, 8.125]);
    completedCases.push({ name: activeCase.name, sourceSHA256: hash(activeCase.text), acceptedSHA256: hash(current().authoredText),
      selectedNode: activeCase.targetIndex, splitNode: activeCase.splitIndex, replies: stats.replies - beforeReplies,
      history: current().history, acceptedText: current().authoredText });
    priorSessionCallbacks = preApply;
    await act(async () => { reactRoot.unmount(); await tick(); }); reactRoot = null;
  }
} finally {
  if (reactRoot) await act(async () => { reactRoot.unmount(); await tick(); });
  dom.window.close();
  for (const [extension, loader] of extensionLoaders) Module._extensions[extension] = loader;
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  }
}
assert.ok(workers.every(worker => worker.terminated)); assert.equal(stats.nativeCalls, 0);
assert.equal(stats.replies, 38); assert.equal(sessions.length, 2); assert.equal(groups.length, 14);
for (const [path, expected] of Object.entries(sourceHashes)) assert.equal(hash(readFileSync(resolve(root, path))), expected);
assert.equal(hash(readFileSync(import.meta.filename)), fixtureSourceSHA256);
if (process.env.FROZEN_SOURCE_HASHES_FILE) assert.equal(hash(readFileSync(process.env.FROZEN_SOURCE_HASHES_FILE)), freezeSHA256);
console.log(JSON.stringify({ status: 'PASS', issue: 2022, node: process.version, testGroups: groups.length, groups,
  mountedRoots, controllerLifetimes: sessions.length, ...stats, sourceHashes, fixtureSourceSHA256, freezeSHA256, submissions, completedCases,
  workerCommands: workers.flatMap(worker => worker.requests.map(({ kind, operation }) => ({ kind, ...(operation ? { operation } : {}) }))),
  boundaries: { actual: ['React', 'controller', 'source/summary transport validation', 'structure helper', 'DOM events and captured callbacks'],
    controlled: ['Worker/provider with unmistakable mock identities and placeholder volume', 'scene preparation with empty components', 'display port', 'ResizeObserver'],
    retainedNativeFixtures: [],
    unrun: ['native evaluation', 'native identity/lineage', 'physical volume', 'scene geometry admission/picks', 'GPU pixels', 'CSS layout/occlusion of error notice and Cancel', 'physical Save/Open', 'STL', 'manufacturing'] } }));
