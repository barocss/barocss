// Fixed Mirror/Circular lifecycle: six frozen groups per command, maximum24 replies, no native or hardware GPU.
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
const productBaseCommit = 'd4040baebdf23ba58e75fa08595ed471b758294d';
const productCommit = productBaseCommit;
const mode=process.env.COMMAND_MODE; assert.ok(['mirror-part','circular-pattern'].includes(mode));
const label=mode==='mirror-part'?'Mirror finished rail':'Circular pattern';
const otherLabel=mode==='mirror-part'?'Circular pattern':'Mirror finished rail';
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
assert.equal(hash(readFileSync(import.meta.filename)), frozenSourceHashes['apps/cad-editor/flows/modeling-fixed-pattern-flow.mjs']);
const fixtureSourceSHA256 = hash(readFileSync(import.meta.filename));
const fixturePath = 'packages/barocss-cad-editor/scripts/fixtures/modeling-chamfer-chain/baseline-transport.json';
const fixtureBytes = readFileSync(resolve(root, fixturePath));
const fixtureHash = '74e9a472c54aaa5d228a23d79b083c9a7c4c539bf5de6a5f274597e5fbfba4af';
const baseline = JSON.parse(fixtureBytes), retainedHash = hash(JSON.stringify(baseline));
const retainedComponent = baseline.display.components[0];
const submissions = [];
const groups = [], sessions = [], workers = [], displays = [], observers = [], replyCounts = [], emissions = [];
const ledger = Object.freeze(['Mount and exact selected target', 'Preview Cancel and stale Apply', 'Panel and selection ABA', 'Provider refusal then exact promotion', 'Shared dimensions promotion', 'Parameter and structural Undo Redo']);
const maximumReplyCounts=Object.freeze([1,4,6,6,2,6]);
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
  assert.ok(groups.length < 6, 'Frozen six-group ceiling');
  assert.equal(name, ledger[groups.length], 'Frozen ledger order');
  const before = stats.replies;
  try { await run(); } catch (cause) {
    console.error(JSON.stringify({ status: 'FAIL', issue: mode === 'mirror-part' ? 2008 : 2011, group: groups.length + 1, name,
      mountedRoots, controllerLifetimes: sessions.length, ...stats, error: String(cause) }));
    throw cause;
  }
  replyCounts.push(stats.replies - before);
  assert.ok(replyCounts.at(-1)<=maximumReplyCounts[groups.length], 'Frozen per-group reply ceiling');
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
const patternNode = mode==='mirror-part'
 ? {kind:'mirror',parent:{node:3,side:'solid'},plane:'xz'}
 : {kind:'circular-pattern',parent:{node:3,side:'solid'},axis:'x',angleDegrees:90,count:4};
const patternOutputs = mode==='mirror-part'
 ? {part:{node:3,side:'solid'},mirroredRail:{node:4,side:'solid'}}
 : {part:{node:3,side:'solid'},radialCopy1:{node:4,side:'instance1'},radialCopy2:{node:4,side:'instance2'},radialCopy3:{node:4,side:'instance3'}};
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
  if (patterned) { stats.editedStateMocks++; stats.coincidentRoleClones += names.length - 1; }
  assert.deepEqual(reply.display.components.find(c => c.role === 'part'), retainedComponent);
  for (const component of reply.display.components) {
    assert.equal(component.report.solidId, retainedComponent.report.solidId);
    assert.deepEqual(component.mesh, retainedComponent.mesh);
    assert.deepEqual(component.lineage.graph, retainedComponent.lineage.graph);
  }
  return reply;
}
setGlobal('__modelingFixedPatternFlow', {
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
    controller: `import {createCadEditorModelingController as create} from ${JSON.stringify(source('modeling-controller.ts'))}; export const createCadEditorModelingController = (...args) => globalThis.__modelingFixedPatternFlow.controller(create, ...args);`,
    display: 'export const createPrismFeatureDisplay = globalThis.__modelingFixedPatternFlow.display;',
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
      assert.equal(command.command.kind, mode); assert.equal(prior.nodes.length, 4);
      assert.deepEqual(submitted.nodes[4], patternNode);
      assert.deepEqual(submitted.parameters, prior.parameters);
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
        assert.equal(kind, 'prepare-source'); providerRefusal = false; stats.providerRefusals++;
        const message = 'Controlled provider refusal; no native evaluation';
        reply = { id, ok: false, message, diagnostic: { stage: 'native', message, code: 'PARAMETER', operation: mode } };
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
    assert.ok(++stats.replies <= 24, 'Frozen24-controlled-reply ceiling');
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
  const patterned = data().nodes.length === 5, names = patterned ? Object.keys(patternOutputs).sort() : ['part'];
  assert.deepEqual(current().display.packet.components, names.map(coincidentRole),
    'Unchanged genuine arrays/native IDs; extra coincident roles are explicit synthetic envelopes');
  assert.deepEqual(current().accepted.outputs, names.map(name => ({ ...baseline.summary.outputs[0], name })));
  assert.equal(current().display.packet.components[0].report.triangleCount, 20);
  assert.equal(current().display.scene.geometries.length, patterned ? (mode==='mirror-part'?16:4) : 8,
    'CPU receiver uses sixteen mirror face draws or four circular whole-body fallback draws');
  assert.equal(hash(JSON.stringify(baseline)), retainedHash); assert.equal(hash(fixtureBytes), fixtureHash);
};
const openPattern = async () => { await click(button(label)); assertPanel(mode); };
const globalEdit = async () => { await click(button('Edit model dimensions')); assertPanel('dimensions'); };
const previewButton = () => button(current().workerReady ? 'Preview operation' : 'Recover accepted model and preview operation');
const preview = async () => {
  await click(previewButton()); await settled(); assert.equal(current().preview?.status, 'ready', errors().join(' '));
};
const capture = () => ({preview:reactCallback(previewButton()),apply:reactCallback(button('Apply operation')),cancel:reactCallback(button('Cancel'))});
const staleCallbacks=async (callbacks,reason)=>{for(const name of ['preview','apply','cancel'])await assertStale(callbacks[name],reason+':'+name);};
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
console.log(JSON.stringify({status:'START',mode,ledger,maximumReplyCounts,productCommit,sourceHashes,fixtureSourceSHA256,limits:{maximumReplies:24,nativeCalls:0}}));
let patternText,editedText;
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
  assert.deepEqual(current().preview.outputs.map(output => output.name), Object.keys(patternOutputs).sort());
  const replays = stats.authoredContextMocks;
  await click(button('Apply dimensions')); await settled(); assertClosed();
  assert.equal(stats.authoredContextMocks, replays, 'Ready parameter preview promotes without evaluation');
  assert.equal(current().authoredText, candidateText); assert.deepEqual(data().nodes, prior.nodes);
  assert.equal(current().history.count, before.history.index + 2); geometryUnchanged();
};
try {
 await group(ledger[0],async()=>{
  assert.equal(hash(fixtureBytes),fixtureHash);assert.equal(fixtureBytes.length,41471);
  assert.ok(++mountedRoots<=1);reactRoot=createRoot(container);await rerender(defaultText);
  assert.equal(current().error,null);for(const i of [0,1,2]){await select(i);assert.equal(button(label),undefined);}
  await select(3);await openPattern();assert.ok(button('Apply operation').disabled);
  assert.deepEqual(JSON.parse(panel(mode).querySelector('pre').textContent).nodes[4],patternNode);
  assert.equal(panel(mode).querySelectorAll('input').length,0);
 });
 await group(ledger[1],async()=>{
  const before=authority();await preview();const old=capture();assert.deepEqual(authority(),before);
  await key(testid('modeling-workspace'),'Escape');await settled();assertClosed();assert.deepEqual(authority(),before);
  await staleCallbacks(old,'Cancelled command');
 });
 await group(ledger[2],async()=>{
  await openPattern();await preview();const old=capture();
  await click(button(otherLabel));await click(button(label));await settled();await staleCallbacks(old,'Panel ABA');
  const selected=capture();await select(0);assertClosed();await select(3);await openPattern();
  await staleCallbacks(selected,'Selected target ABA');
 });
 await group(ledger[3],async()=>{
  const before=authority();providerRefusal=true;await click(previewButton());await settled();
  assert.deepEqual(authority(),before);assert.ok(current().error);assert.ok(button('Apply operation').disabled);
  await preview();patternText=workers.at(-1).lastReply.text;await applyStructure();
  assert.equal(current().authoredText,patternText);assert.deepEqual(data().outputs,patternOutputs);geometryUnchanged();
  assert.equal(structure.api.getModelingStructureCapabilities(current().authoredText,current().accepted)[mode==='mirror-part'?'mirrorAuthored':'circularAuthored'],false,'Synthetic duplicate IDs never qualify native output ownership');
 });
 await group(ledger[4],async()=>{
  await parameterEdit({backBevelDistance:3});editedText=current().authoredText;
  assert.deepEqual(data().nodes[4],patternNode);assert.deepEqual(data().outputs,patternOutputs);
 });
 await group(ledger[5],async()=>{
  await history('Undo',patternText,3,1);await history('Undo',defaultText,3,0);
  await select(3);assert.ok(button(label));await history('Redo',patternText,3,1);await history('Redo',editedText,3,2);
 });
} finally {
 if(reactRoot)await act(async()=>{reactRoot.unmount();await tick();});
 for(const record of displays)if(record.release)record.release();
 dom.window.close();for(const [name,descriptor] of globals){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
}
assert.deepEqual(groups,ledger);assert.equal(mountedRoots,1);assert.ok(sessions.length<=2);assert.equal(stats.nativeCalls,0);assert.ok(workers.every(w=>w.terminated));
for(const path of proofPaths)assert.equal(hash(readFileSync(resolve(root,path))),sourceHashes[path]);
console.log(JSON.stringify({status:'PASS',mode,groups,replyCounts,maximumReplyCounts,productCommit,sourceHashes,fixtureSourceSHA256,...stats,
 acceptedSourceSHA256:hash(editedText),scope:'Actual ModelingEditor/Workspace/controller/helper/CPU receiver with controlled Worker and display. Geometry remains synthetic coincident envelopes with genuine historical arrays and duplicate native IDs. No fresh native geometry, engine evaluation, hardware GPU, browser, or physical Save/Open acceptance.'}));
