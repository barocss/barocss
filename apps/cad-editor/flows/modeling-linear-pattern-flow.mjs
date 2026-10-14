// #2000: ten frozen groups, one React root, two controller lifetimes, at most 30 replies.
// Actual React/controller/bounded helper/CPU receiver execute; the Worker/display are doubles.
// All numeric geometry, graph IDs, mesh provenance and native reports retain the genuine
// historical TWO-bevel 1/2 packet, 6064 mm³ / 20 triangles, unchanged and untranslated.
// Three-output replies ONLY clone role/name envelopes over that coincident historical body.
// Duplicate native IDs intentionally keep post-pattern structural capabilities unqualified;
// they are not newly measured copies. The package fixture covers engine/serializer and
// distinct-output source projections. This flow does not assert their product warning.
// No native, physical browser, GPU, physical Save/Open, STL or manufacturing execution.
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
// Refuse a mismatched source freeze before bundling or executing any product code.
const productBaseCommit = '8a1716b35e226c09a2a338a3402d846b88d3b76b';
const productCommit = '76f405a0b6f86761259391f315b7de8dff73864e';
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
const frozenSourceHashes = JSON.parse(process.env.FROZEN_SOURCE_HASHES ?? '{}');
for (const path of proofPaths) assert.equal(sourceHashes[path], frozenSourceHashes[path], `Immutable product source: ${path}`);
assert.equal(hash(readFileSync(import.meta.filename)), frozenSourceHashes['apps/cad-editor/flows/modeling-linear-pattern-flow.mjs']);
const fixtureSourceSHA256 = hash(readFileSync(import.meta.filename));
const fixturePath = 'packages/barocss-cad-editor/scripts/fixtures/modeling-chamfer-chain/baseline-transport.json';
const fixtureBytes = readFileSync(resolve(root, fixturePath));
const fixtureHash = '74e9a472c54aaa5d228a23d79b083c9a7c4c539bf5de6a5f274597e5fbfba4af';
const baseline = JSON.parse(fixtureBytes), retainedHash = hash(JSON.stringify(baseline));
const retainedComponent = baseline.display.components[0];
const submissions = [];
const groups = [], sessions = [], workers = [], displays = [], observers = [], replyCounts = [], emissions = [];
const ledger = Object.freeze([
  'Exact selected rail command, temporary spacing and wrong-target refusal',
  'Guarded Enter preview, ready-only Apply and Escape cancellation',
  'Same-command replacement and spacing field ABA invalidate candidates',
  'Unrelated drafts and selected-target ABA preserve accepted authority',
  'Late display preparation and controller lifetime ABA are inert',
  'Native, receiver and display refusal before exact pattern promotion',
  'Accepted output chooser and normalized no-op preserve source history',
  'Independent spacing and shared front/back dimension preview promotion',
  'Parameter and structural Undo/Redo restore exact source and output inventory',
  'Accepted-only Blob bytes, CPU source roundtrip and mounted legacy routes',
]);
const expectedReplyCounts = Object.freeze([1, 2, 4, 0, 2, 8, 0, 4, 8, 0]);
const stats = { replies: 0, authoredContextMocks: 0, editedStateMocks: 0, coincidentRoleClones: 0,
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
    console.error(JSON.stringify({ status: 'FAIL', issue: 2000, group: groups.length + 1, name,
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
const blankText = signedJSON({ format: 'barocss-cad-model', schema: 1, units: 'mm',
  parameters: { width: 32, height: 24, thickness: 8 }, nodes: blankNodes, outputs: { part: { node: 1, side: 'solid' } } });
const oppositeNode = { kind: 'chamfer', parent: { node: 2, side: 'solid' },
  edge: { parallelTo: 'x', at: { y: { parameter: 'height' }, z: 'max' } }, distance: { parameter: 'backBevelDistance' } };
const defaultText = signedJSON({ ...JSON.parse(blankText), parameters: { ...JSON.parse(blankText).parameters, bevelDistance: 1, backBevelDistance: 2 },
  nodes: [...blankNodes, chamferNode, oppositeNode], outputs: { part: { node: 3, side: 'solid' } } });
const patternNode = { kind: 'linear-pattern', parent: { node: 3, side: 'solid' },
  axis: 'x', spacing: { parameter: 'patternSpacing' }, count: 3 };
const patternOutputs = { part: { node: 3, side: 'solid' },
  railCopy1: { node: 4, side: 'instance1' }, railCopy2: { node: 4, side: 'instance2' } };
// These role/name-only adaptations retain ALL genuine native identities and arrays.
// The identical native IDs deliberately refuse structural qualification after Apply.
function coincidentRole(name) {
  const component = structuredClone(retainedComponent);
  component.role = name; component.lineage.name = name;
  return component;
}
function mockTransport(text, revision, id) {
  const data = JSON.parse(text), patterned = data.nodes.length === 5;
  assert.ok([4, 5].includes(data.nodes.length));
  assert.deepEqual(data.nodes.slice(0, 4), [...blankNodes, chamferNode, oppositeNode]);
  if (patterned) assert.deepEqual(data.nodes[4], patternNode);
  assert.deepEqual(data.outputs, patterned ? patternOutputs : { part: { node: 3, side: 'solid' } });
  const reply = structuredClone(baseline), names = Object.keys(data.outputs);
  reply.id = id; reply.text = signedJSON(data);
  reply.summary.parameters = structuredClone(data.parameters);
  reply.summary.features = data.nodes.map((node, index) => ({ kind: node.kind, index, dependencies: index ? [index - 1] : [] }));
  reply.summary.outputs = names.map(name => ({ ...structuredClone(baseline.summary.outputs[0]), name }));
  reply.display.components = names.map(coincidentRole);
  reply.display.outcomes = names.map(role => ({ ...structuredClone(baseline.display.outcomes[0]), role }));
  reply.summary.revision = revision; reply.display.revision = revision;
  stats.authoredContextMocks++;
  if (patterned) { stats.editedStateMocks++; stats.coincidentRoleClones += 2; }
  assert.deepEqual(reply.display.components[0], retainedComponent);
  for (const component of reply.display.components) {
    assert.equal(component.report.solidId, retainedComponent.report.solidId);
    assert.deepEqual(component.mesh, retainedComponent.mesh);
    assert.deepEqual(component.lineage.graph, retainedComponent.lineage.graph);
  }
  return reply;
}
setGlobal('__modelingLinearPatternFlow', {
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
const boundaryPlugin = { name: 'explicit-linear-pattern-boundaries', setup(build) {
  build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\.\/modeling-controller\.js$/ }, () => ({ path: 'controller', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\.\/prism-feature-display\.js$/ }, () => ({ path: 'display', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'view-boundary' }));
  build.onLoad({ filter: /.*/, namespace: 'view-boundary' }, ({ path }) => ({ resolveDir: root, contents: {
    provider: 'throw Error("Provider execution is outside this transport-replay fixture.");',
    legacy: 'export function createPrismFeatureEngine() { return () => { throw Error("Legacy native execution is outside this flow."); }; }',
    controller: `import {createCadEditorModelingController as create} from ${JSON.stringify(source('modeling-controller.ts'))}; export const createCadEditorModelingController = (...args) => globalThis.__modelingLinearPatternFlow.controller(create, ...args);`,
    display: 'export const createPrismFeatureDisplay = globalThis.__modelingLinearPatternFlow.display;',
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
  postMessage(command) {
    this.requests.push(structuredClone(command));
    if (command.kind === 'prepare-source' && command.operation === 'structure') {
      assert.equal(command.baseText, current().authoredText);
      const submitted = JSON.parse(command.text), prior = JSON.parse(command.baseText);
      assert.deepEqual(submitted.nodes.slice(0, prior.nodes.length), prior.nodes);
      assert.equal(command.command.kind, 'linear-pattern'); assert.equal(prior.nodes.length, 4);
      assert.deepEqual(submitted.nodes[4], patternNode);
      assert.deepEqual(submitted.parameters, { ...prior.parameters, patternSpacing: command.command.spacing });
      assert.deepEqual(command.command.target, { name: 'part', solidId: current().accepted.outputs[0].solidId, node: 3 });
      assert.ok(Object.is(submitted.nodes[0].min[0], -0));
      assert.deepEqual(submitted.outputs, patternOutputs);
      assert.equal(command.text, signedJSON(submitted));
      submissions.push({ kind: command.kind, operation: command.operation, text: command.text, sourceSHA256: hash(command.text),
        parameters: submitted.parameters, target: command.command.target });
    } else if (command.kind === 'prepare-preview' || command.kind === 'apply') {
      assert.equal(JSON.parse(this.accepted.text).nodes.length, 5);
      assert.deepEqual(JSON.parse(this.accepted.text).nodes, [...blankNodes, chamferNode, oppositeNode, patternNode]);
      submissions.push({ kind: command.kind, parameters: command.parameters, baseSourceSHA256: hash(this.accepted.text) });
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
      assert.ok(['open', 'apply', 'prepare-preview', 'prepare-source'].includes(kind), `Unplanned command: ${kind}`);
      if (providerRefusal) {
        assert.equal(kind, 'prepare-source'); assert.equal(command.command.spacing, 0.1); providerRefusal = false; stats.providerRefusals++;
        const message = 'Controlled native exact pattern translation representability refusal';
        reply = { id, ok: false, message, diagnostic: { stage: 'native', message, code: 'PARAMETER', operation: 'translate' } };
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
const structure = await bundle('modeling-structure.ts');
const geometryUnchanged = () => {
  const patterned = data().nodes.length === 5, names = patterned ? ['part', 'railCopy1', 'railCopy2'] : ['part'];
  assert.deepEqual(current().display.packet.components, names.map(coincidentRole),
    'Unchanged genuine arrays/native IDs; extra coincident roles are explicit synthetic envelopes');
  assert.deepEqual(current().accepted.outputs, names.map(name => ({ ...baseline.summary.outputs[0], name })));
  assert.equal(current().display.packet.components[0].report.triangleCount, 20);
  assert.equal(current().display.scene.geometries.length, patterned ? 3 : 8,
    'Actual CPU receiver uses three whole-body fallback draws for the coincident role fixture');
  assert.equal(hash(JSON.stringify(baseline)), retainedHash); assert.equal(hash(fixtureBytes), fixtureHash);
};
const openPattern = async () => { await click(button('Linear pattern')); assertPanel('linear-pattern'); };
const globalEdit = async () => { await click(button('Edit model dimensions')); assertPanel('dimensions'); };
const previewButton = () => button(current().workerReady ? 'Preview operation' : 'Recover accepted model and preview operation');
const preview = async () => {
  await click(previewButton()); await settled(); assert.equal(current().preview?.status, 'ready', errors().join(' '));
};
const cancel = async () => { await click(button('Cancel')); await settled(); assertClosed(); };
const capture = () => ({ preview: reactCallback(previewButton()), apply: reactCallback(button('Apply operation')),
  cancel: reactCallback(button('Cancel')), select: reactCallback(testid('modeling-browser').querySelector('button[data-feature-index="0"]')),
  field: reactCallback(input('Pattern spacing (mm)'), 'onChange') });
const staleCallbacks = async (callbacks, reason) => {
  for (const name of ['preview', 'apply', 'cancel', 'select']) await assertStale(callbacks[name], `${reason}: ${name}`);
  await assertStale(() => callbacks.field({ target: { value: '2' } }), `${reason}: field`);
};
const applyStructure = async () => {
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
console.log(JSON.stringify({ status: 'START', issue: 2000, ledger, expectedReplyCounts, productBaseCommit, productCommit, sourceHashes, fixtureSourceSHA256,
  fixture: { path: fixturePath, sha256: fixtureHash },
  limits: { groups: 10, reactRoots: 1, maximumControllerLifetimes: 3, maximumReplies: 30, plannedReplies: 29, nativeCalls: 0 } }));
let viewport, patternText, spacingText, editedText;
const selectOutput = async name => {
  await click(button('Output bodies')); assertPanel('outputs');
  const chooser = input('STL output');
  assert.deepEqual([...chooser.options].map(option => option.value), ['', ...current().accepted.outputs.map(output => output.name)]);
  await change(chooser, name); assert.equal(chooser.value, name);
  assert.equal(button('Download STL').disabled, false);
  // Choosing is real React state; no native STL encoding or browser download is invoked.
};
const parameterEdit = async changes => {
  await globalEdit();
  const before = authority(), prior = data(), requestCount = commands();
  for (const [name, value] of Object.entries(changes)) await change(input(`${name} (mm)`), String(value));
  assert.equal(commands(), requestCount);
  assert.deepEqual(current().drafts, Object.fromEntries(Object.entries(changes).map(([name, value]) => [name, String(value)])));
  await click(button('Preview dimensions'));
  const command = workers.at(-1).requests.at(-1);
  assert.equal(command.kind, 'prepare-preview'); assert.deepEqual(command.parameters, changes);
  await settled(); assert.equal(current().preview.status, 'ready', errors().join(' ')); assert.deepEqual(authority(), before);
  const candidateText = workers.at(-1).lastReply.text, candidate = JSON.parse(candidateText);
  assert.deepEqual(candidate.nodes, prior.nodes); assert.deepEqual(candidate.outputs, patternOutputs);
  assert.deepEqual(candidate.parameters, { ...prior.parameters, ...changes }, 'Unedited shared/spacing drivers stay independent');
  assert.deepEqual(current().preview.outputs.map(output => output.name), ['part', 'railCopy1', 'railCopy2']);
  const replays = stats.authoredContextMocks;
  await click(button('Apply dimensions')); await settled(); assertClosed();
  assert.equal(stats.authoredContextMocks, replays, 'Ready parameter preview promotes without evaluation');
  assert.equal(current().authoredText, candidateText); assert.deepEqual(data().nodes, prior.nodes);
  assert.equal(current().history.count, before.history.index + 2); geometryUnchanged();
};
// Real Blob bytes and real mounted download handler, with only URL/anchor effects doubled.
// This is accepted-source CPU download semantics, not physical Save/Open or persistence.
const downloads = [], downloadRequests = [], revoked = [];
const originalCreateURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const originalRevokeURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
const originalAnchorClick = dom.window.HTMLAnchorElement.prototype.click;
Object.defineProperty(URL, 'createObjectURL', { configurable: true, value(blob) {
  assert.ok(blob instanceof Blob); downloads.push(blob); return `blob:controlled-linear-pattern/${downloads.length}`;
} });
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value(url) { revoked.push(url); } });
dom.window.HTMLAnchorElement.prototype.click = function () {
  assert.equal(this.download, 'part.cad.json'); assert.ok(this.isConnected);
  downloadRequests.push({ href: this.href, filename: this.download });
};
try {
  await group(ledger[0], async () => {
    assert.equal(hash(fixtureBytes), fixtureHash); assert.equal(fixtureBytes.length, 41471);
    for (const suffix of ['react/modeling-editor.tsx', 'react/modeling-workspace.tsx', 'modeling-controller.ts', 'modeling-structure.ts', 'modeling-scene.ts']) assert.ok(ui.inputs.some(path => path.endsWith(suffix)));
    assert.ok(++mountedRoots <= 1); reactRoot = createRoot(container); await rerender(defaultText);
    assert.equal(current().error, null); assert.equal(current().history.count, 1); viewport = testid('modeling-viewport');
    for (const index of [0, 1, 2]) { await select(index); assert.equal(button('Linear pattern'), undefined); }
    await select(3); assert.equal(button('Linear pattern').closest('details').querySelector('summary').textContent.trim(), 'CREATE');
    assert.match(testid('modeling-browser').querySelector('button[data-feature-index="3"]').textContent, /Chamfer 02/);
    await openPattern(); const before = authority(), requestCount = commands();
    assert.equal(input('Pattern spacing (mm)').value, '40'); assert.equal(input('Pattern spacing (mm)').getAttribute('inputmode'), 'decimal');
    assert.match(panel('linear-pattern').textContent, /Create 2, 3 or 4 total separate rails along model \+X/);
    assert.ok(panel('linear-pattern').textContent.includes(`part · ${current().accepted.outputs[0].solidId} · feature 4`));
    await assertStale(reactCallback(button('Apply operation')), 'Pre-preview Apply does not evaluate');
    for (const value of ['', ' ', 'NaN', 'Infinity', '0x10', '0', '-0', '-1', '5000.01', '10001', '1e309', '1e-9999']) {
      await change(input('Pattern spacing (mm)'), value); assert.equal(previewButton().disabled, true); await click(previewButton());
    }
    for (const value of ['0.1', '+.5', '40.25', '4e1', '5000']) {
      await change(input('Pattern spacing (mm)'), value); assert.equal(previewButton().disabled, false);
      const proposed = JSON.parse(panel('linear-pattern').querySelector('pre').textContent);
      assert.deepEqual(proposed.nodes.slice(0, 4), data().nodes); assert.deepEqual(proposed.nodes[4], patternNode);
      assert.equal(proposed.parameters.patternSpacing, Number(value)); assert.deepEqual(proposed.outputs, patternOutputs);
      assert.deepEqual(Object.fromEntries(Object.entries(proposed.parameters).filter(([name]) => name !== 'patternSpacing')), data().parameters);
    }
    assert.equal(commands(), requestCount); assert.deepEqual(authority(), before); assert.deepEqual(current().drafts, {});
    geometryUnchanged(); await cancel();
  });
  await group(ledger[1], async () => {
    await openPattern(); const before = authority(), requestCount = commands(), oldApply = reactCallback(button('Apply operation'));
    for (const value of ['Enter', 'Escape']) for (const fields of [{ repeat: true }, { isComposing: true }, { keyCode: 229 }, { ctrlKey: true }, { shiftKey: true }]) {
      assert.equal((await key(input('Pattern spacing (mm)'), value, fields)).defaultPrevented, false); assert.equal(commands(), requestCount);
    }
    await key(input('Pattern spacing (mm)'), 'Escape'); assertClosed(); assert.deepEqual(authority(), before);
    await openPattern(); const prePreviewApply = reactCallback(button('Apply operation'));
    await key(input('Pattern spacing (mm)'), 'Enter'); await settled();
    assert.equal(current().preview.status, 'ready'); assert.deepEqual(authority(), before); assert.equal(data().nodes.length, 4);
    assert.equal(button('Apply operation').disabled, false);
    await assertStale(oldApply, 'Dismissed command Apply stays inert');
    await assertStale(prePreviewApply, 'Captured pre-preview Apply cannot promote the later candidate');
    await key(input('Pattern spacing (mm)'), 'Escape'); await settled(); assertClosed(); assert.deepEqual(authority(), before);
  });
  await group(ledger[2], async () => {
    await openPattern(); const before = authority(); await preview(); const old = capture(), candidate = port().candidates.at(-1);
    await openPattern(); await settled(); assert.equal(candidate.disposed, true); assert.equal(current().preview, null);
    await staleCallbacks(old, 'Same panel replacement');
    await preview(); const aba = capture(); await change(input('Pattern spacing (mm)'), '56'); await change(input('Pattern spacing (mm)'), '40'); await settled();
    assert.equal(current().preview, null); await staleCallbacks(aba, 'Spacing field ABA'); assert.deepEqual(authority(), before); await cancel();
  });
  await group(ledger[3], async () => {
    await globalEdit(); await change(input('width (mm)'), '33'); await openPattern();
    const pending = capture(), count = commands(), before = authority();
    assert.equal(previewButton().disabled, true); await click(button('Cancel')); await settled(); assertClosed();
    assert.deepEqual(current().drafts, { width: '33' }); assert.deepEqual(authority(), before);
    await openPattern(); await click(button('Review pending dimensions')); assertPanel('dimensions');
    assert.deepEqual(current().drafts, { width: '33' }); await staleCallbacks(pending, 'Unrelated-draft review command'); await cancel();
    assert.equal(commands(), count); assert.deepEqual(current().drafts, {});
    await openPattern(); const selected = capture(); await select(0); assertClosed();
    assert.equal(button('Linear pattern'), undefined); await select(3); await openPattern();
    await staleCallbacks(selected, 'Selected target ABA'); assert.deepEqual(authority(), before); await cancel();
  });
  await group(ledger[4], async () => {
    await openPattern(); const old = capture(), oldPort = port(), oldWorker = workers.at(-1), oldController = sessions.at(-1).controller;
    oldPort.holdNext = true; await click(previewButton()); await act(async () => { oldWorker.accept(); await tick(); }); assert.ok(oldPort.release);
    const held = oldPort.candidates.at(-1); await rerender(defaultText + '\n');
    assert.equal(oldController.getSnapshot().disposed, true); assert.equal(current().history.count, 1);
    await select(3); await openPattern(); const before = current();
    await act(async () => { oldPort.release(); await tick(); }); assert.equal(held.disposed, true); assert.deepEqual(current(), before);
    await staleCallbacks(old, 'Controller lifetime ABA'); assert.equal(testid('modeling-viewport'), viewport); await cancel();
  });
  await group(ledger[5], async () => {
    await openPattern(); const before = authority(); await change(input('Pattern spacing (mm)'), '0.1'); providerRefusal = true;
    await click(previewButton()); await settled(); assert.equal(current().preview.status, 'error'); assert.equal(current().preview.diagnostic.stage, 'native');
    assert.deepEqual(authority(), before); assert.equal(input('Pattern spacing (mm)').value, '0.1'); assert.match(errors().join(' '), /representability/);
    await change(input('Pattern spacing (mm)'), '40');
    mutateNextReply = reply => { reply.display.components[1].mesh.indices[0] = 9999; stats.receiverRefusals++; };
    await click(previewButton()); await settled(); assert.equal(current().preview.status, 'error'); assert.equal(current().preview.diagnostic.stage, 'transport'); assert.deepEqual(authority(), before);
    port().failNext = true; await click(previewButton()); await settled();
    assert.equal(current().preview.status, 'error'); assert.equal(current().preview.diagnostic.stage, 'display'); assert.deepEqual(authority(), before);
    await assertStale(reactCallback(button('Apply operation')), 'Refused pattern Apply does no work');
    await preview(); assert.deepEqual(authority(), before); const acceptedCallbacks = capture(); patternText = workers.at(-1).lastReply.text;
    assert.deepEqual(current().preview.outputs.map(output => output.name), ['part', 'railCopy1', 'railCopy2']);
    await applyStructure(); await staleCallbacks(acceptedCallbacks, 'Accepted source/generation supersedes command');
    assert.equal(current().history.count, 2); assert.deepEqual(data().nodes, [...blankNodes, chamferNode, oppositeNode, patternNode]);
    assert.deepEqual(data().outputs, patternOutputs); assert.equal(data().parameters.patternSpacing, 40); geometryUnchanged();
    assert.equal(structure.api.getModelingStructureCapabilities(current().authoredText, current().accepted).patternAuthored, false,
      'Coincident same-native-ID role replay cannot qualify a genuine distinct-body pattern');
  });
  await group(ledger[6], async () => {
    const before = authority(), count = commands(); await selectOutput('railCopy2');
    assert.deepEqual(authority(), before); assert.equal(commands(), count);
    await globalEdit(); await change(input('patternSpacing (mm)'), '4e1'); await click(button('Preview dimensions')); await settled();
    assert.equal(current().preview.status, 'unchanged'); assert.deepEqual(authority(), before); assert.equal(commands(), count);
    await click(button('Apply dimensions')); await settled(); assertClosed(); assert.deepEqual(current().drafts, {});
    assert.deepEqual(authority(), before); assert.equal(commands(), count); geometryUnchanged();
  });
  await group(ledger[7], async () => {
    await parameterEdit({ patternSpacing: 56 }); spacingText = current().authoredText;
    assert.equal(current().history.count, 3); await click(button('Output bodies')); assert.equal(input('STL output').value, '', 'Accepted generation clears the older selected output');
    await selectOutput('railCopy1');
    await parameterEdit({ bevelDistance: 1.5, backBevelDistance: 2.5 }); editedText = current().authoredText;
    assert.equal(current().history.count, 4); assert.equal(data().parameters.patternSpacing, 56);
    assert.deepEqual(data().nodes[4], patternNode); assert.deepEqual(data().outputs, patternOutputs);
    await click(button('Output bodies')); assert.equal(input('STL output').value, '', 'No same-name output remains selected across replacement');
  });
  await group(ledger[8], async () => {
    const start = workers.at(-1).requests.length;
    await history('Undo', spacingText, 4, 2); assert.equal(workers.at(-1).requests.at(-1).kind, 'apply');
    assert.equal(data().parameters.bevelDistance, 1); assert.equal(data().parameters.backBevelDistance, 2);
    await history('Undo', patternText, 4, 1); assert.equal(workers.at(-1).requests.at(-1).kind, 'apply'); assert.equal(data().parameters.patternSpacing, 40);
    await history('Undo', defaultText, 4, 0); assert.equal(data().nodes.length, 4);
    assert.equal(workers.at(-1).requests.at(-2).operation, 'history'); assert.equal(workers.at(-1).requests.at(-1).kind, 'accept-source');
    await select(3); assert.ok(button('Linear pattern'), 'Structural Undo restores the original qualified target');
    await history('Redo', patternText, 4, 1); assert.equal(data().nodes.length, 5);
    assert.equal(workers.at(-1).requests.at(-2).operation, 'history'); assert.equal(workers.at(-1).requests.at(-1).kind, 'accept-source');
    await history('Redo', spacingText, 4, 2); assert.equal(workers.at(-1).requests.at(-1).kind, 'apply');
    await history('Redo', editedText, 4, 3); assert.equal(workers.at(-1).requests.at(-1).kind, 'apply');
    assert.equal(workers.at(-1).requests.length - start, 8); assert.equal(data().parameters.patternSpacing, 56);
  });
  await group(ledger[9], async () => {
    const before = authority(), requestCount = commands();
    for (const index of [0, 1, 2, 3, 4]) { await select(index); assert.equal(button('Linear pattern'), undefined); assert.equal(button('Rotate part'), undefined); assert.equal(button('Move part'), undefined); }
    assert.equal(structure.api.canonicalModelingText(data()), editedText); assert.ok(Object.is(data().nodes[0].min[0], -0));
    assert.deepEqual(data().nodes, [...blankNodes, chamferNode, oppositeNode, patternNode]);
    for (const [label, name] of [['New rectangular part', 'new-part'], ['New circular part', 'new-circular-part']]) { await click(button(label)); assertPanel(name); await cancel(); }
    await globalEdit(); await change(input('patternSpacing (mm)'), '72');
    await click(button('Save or open a model')); assertPanel('files');
    await click(button('Show saved model')); assert.equal(input('Saved model data').value, editedText);
    await click(button('Download accepted model')); assert.equal(downloads.length, 1); assert.equal(downloadRequests.length, 1); assert.equal(revoked.length, 1);
    assert.equal(downloads[0].type, 'application/json'); assert.equal(await downloads[0].text(), editedText);
    assert.equal(structure.api.canonicalModelingText(JSON.parse(await downloads[0].text())), editedText);
    assert.equal(JSON.parse(await downloads[0].text()).parameters.patternSpacing, 56, 'Unapplied spacing never enters accepted download');
    assert.equal(current().drafts.patternSpacing, '72'); assert.equal(document.querySelectorAll('a[download]').length, 0);
    await globalEdit(); await cancel(); await selectOutput('part');
    assert.deepEqual(authority(), before); assert.equal(commands(), requestCount); assert.equal(testid('modeling-viewport'), viewport);
    assert.equal(viewport.querySelectorAll('canvas').length, 1); geometryUnchanged();
  });
} finally {
  if (reactRoot) await act(async () => { reactRoot.unmount(); await tick(); });
  for (const record of displays) if (record.release) record.release();
  if (originalCreateURL) Object.defineProperty(URL, 'createObjectURL', originalCreateURL); else delete URL.createObjectURL;
  if (originalRevokeURL) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeURL); else delete URL.revokeObjectURL;
  dom.window.HTMLAnchorElement.prototype.click = originalAnchorClick;
  dom.window.close(); for (const [name, descriptor] of globals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
}
assert.deepEqual(groups, ledger); assert.deepEqual(replyCounts, expectedReplyCounts); assert.equal(stats.replies, expectedReplyCounts.reduce((a, b) => a + b, 0));
assert.equal(mountedRoots, 1); assert.equal(sessions.length, 2); assert.equal(stats.nativeCalls, 0); assert.ok(workers.every(worker => worker.terminated));
assert.equal(stats.receiverRefusals, 1); assert.equal(stats.providerRefusals, 1); assert.equal(stats.displayRefusals, 1);
for (const path of proofPaths) assert.equal(hash(readFileSync(resolve(root, path))), sourceHashes[path]);
const runtimeSourceHashes = Object.fromEntries(ui.inputs.filter(path => !path.includes(':') && path.includes('packages/')).map(path => [path, hash(readFileSync(resolve(root, path)))]));
console.log(JSON.stringify({ status: 'PASS', issue: 2000, node: process.version, groups, replyCounts, expectedReplyCounts, mountedRoots, controllerLifetimes: sessions.length,
  ...stats, productBaseCommit, productCommit, sourceHashes, runtimeSourceHashes, fixtureSourceSHA256, submissions,
  fixture: { path: fixturePath, sha256: fixtureHash, bytes: fixtureBytes.length }, acceptedPatternSourceSHA256: hash(patternText), acceptedSpacingSourceSHA256: hash(spacingText), acceptedEditedSourceSHA256: hash(editedText),
  acceptedBlobSHA256: hash(await downloads[0].text()),
  retainedGeometry: { genuineFeatureCount: 4, volumeMM3: 6064, triangles: 20,
    scope: 'Every pattern/edited display uses unchanged historical untransformed geometry; railCopy1/railCopy2 are explicitly synthetic coincident role/name envelopes retaining duplicate original native IDs' },
  boundaries: { actual: ['React', 'controller', 'structure helper', 'CPU receiver', 'three-draw fallback admission', 'DOM events and captured callbacks', 'accepted Blob/source CPU roundtrip'],
    controlled: ['Worker/provider summary', 'coincident duplicate-ID role envelopes', 'native refusal', 'malformed transport', 'display port', 'ResizeObserver', 'URL and anchor download effects'],
    unrun: ['native evaluation', 'translated copy geometry', 'distinct-body post-pattern capability/warning', 'GPU pixels', 'physical Save/Open', 'STL'] } }));
