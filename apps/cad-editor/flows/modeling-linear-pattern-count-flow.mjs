// #2016: dedicated count selector flow, separate from the frozen #2000 ledger.
// Actual React, controller, structure helper and CPU receiver; explicit Worker/provider
// and display doubles. Historical two-bevel geometry stays unchanged and coincident.
// No native, physical browser, GPU, STL or manufacturing execution.
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
assert.equal(hash(readFileSync(import.meta.filename)), frozenSourceHashes['apps/cad-editor/flows/modeling-linear-pattern-count-flow.mjs']);
const fixtureSourceSHA256 = hash(readFileSync(import.meta.filename));
const fixturePath = 'packages/barocss-cad-editor/scripts/fixtures/modeling-chamfer-chain/baseline-transport.json';
const fixtureBytes = readFileSync(resolve(root, fixturePath));
const fixtureHash = '74e9a472c54aaa5d228a23d79b083c9a7c4c539bf5de6a5f274597e5fbfba4af';
const baseline = JSON.parse(fixtureBytes), retainedHash = hash(JSON.stringify(baseline));
const retainedComponent = baseline.display.components[0];
const submissions = [];
const groups = [], sessions = [], workers = [], displays = [];
const stats = { replies: 0, authoredContextMocks: 0, editedStateMocks: 0, coincidentRoleClones: 0,
  nativeCalls: 0 };
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
const patternNode = count => ({ kind: 'linear-pattern', parent: { node: 3, side: 'solid' },
  axis: 'x', spacing: { parameter: 'patternSpacing' }, count });
const patternOutputs = count => Object.fromEntries([['part', { node: 3, side: 'solid' }],
  ...Array.from({ length: count - 1 }, (_, index) => [`railCopy${index + 1}`, { node: 4, side: `instance${index + 1}` }])]);
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
  if (patterned) assert.deepEqual(data.nodes[4], patternNode(data.nodes[4].count));
  assert.deepEqual(data.outputs, patterned ? patternOutputs(data.nodes[4].count) : { part: { node: 3, side: 'solid' } });
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
  assert.deepEqual(reply.display.components[0], retainedComponent);
  for (const component of reply.display.components) {
    assert.equal(component.report.solidId, retainedComponent.report.solidId);
    assert.deepEqual(component.mesh, retainedComponent.mesh);
    assert.deepEqual(component.lineage.graph, retainedComponent.lineage.graph);
  }
  return reply;
}
setGlobal('__modelingLinearPatternCountFlow', {
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
const boundaryPlugin = { name: 'explicit-linear-pattern-boundaries', setup(build) {
  build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\.\/modeling-controller\.js$/ }, () => ({ path: 'controller', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\.\/prism-feature-display\.js$/ }, () => ({ path: 'display', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'view-boundary' }));
  build.onLoad({ filter: /.*/, namespace: 'view-boundary' }, ({ path }) => ({ resolveDir: root, contents: {
    provider: 'throw Error("Provider execution is outside this transport-replay fixture.");',
    legacy: 'export function createPrismFeatureEngine() { return () => { throw Error("Legacy native execution is outside this flow."); }; }',
    controller: `import {createCadEditorModelingController as create} from ${JSON.stringify(source('modeling-controller.ts'))}; export const createCadEditorModelingController = (...args) => globalThis.__modelingLinearPatternCountFlow.controller(create, ...args);`,
    display: 'export const createPrismFeatureDisplay = globalThis.__modelingLinearPatternCountFlow.display;',
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
  for (const path of inputs.filter(path => path.startsWith('packages/'))) {
    assert.equal(hash(readFileSync(resolve(root, path))), frozenSourceHashes[path], `Frozen runtime source: ${path}`);
    sourceHashes[path] = frozenSourceHashes[path];
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
      assert.equal(command.command.kind, 'linear-pattern'); assert.equal(prior.nodes.length, 4);
      assert.deepEqual(submitted.nodes[4], patternNode(command.command.count));
      assert.deepEqual(submitted.parameters, { ...prior.parameters, patternSpacing: command.command.spacing });
      assert.deepEqual(command.command.target, { name: 'part', solidId: current().accepted.outputs[0].solidId, node: 3 });
      assert.ok(Object.is(submitted.nodes[0].min[0], -0));
      assert.deepEqual(submitted.outputs, patternOutputs(command.command.count));
      assert.equal(command.text, signedJSON(submitted));
      submissions.push({ kind: command.kind, operation: command.operation, text: command.text, sourceSHA256: hash(command.text),
        parameters: submitted.parameters, count: command.command.count, target: command.command.target });

    }
  }
  terminate() { this.terminated = true; }
  accept(command = this.requests.find(item => !this.answered.has(item.id))) {
    assert.ok(command && !this.answered.has(command.id));
    const { id, kind } = command;
    let reply;
    if (kind === 'discard-preview') {
      this.candidate = null; reply = { id, ok: true, kind: 'preview-discarded' };
    } else if (kind === 'accept-source') {
      assert.ok(this.candidate); assert.deepEqual(command.binding, this.candidate.binding);
      this.accepted = this.candidate;
      reply = { id, ok: true, kind: 'preview-accepted', binding: structuredClone(command.binding), revision: command.binding.expectedRevision + 1 };
      this.candidate = null;
    } else {
      assert.ok(['open', 'prepare-source'].includes(kind), `Unplanned command: ${kind}`);
      reply = mockTransport(command.text, kind === 'open' ? command.revision ?? 0 : command.expectedRevision + 1, id);
      if (kind === 'prepare-source') {
        reply.kind = 'source-preview'; reply.operation = command.operation;
        reply.binding = { workerToken: command.workerToken, acceptedTaskToken: command.acceptedTaskToken,
          expectedRevision: command.expectedRevision, candidateToken: command.candidateToken, previewTaskToken: command.taskToken };
        this.candidate = structuredClone(reply);
      } else this.accepted = structuredClone(reply);
    }
    assert.ok(++stats.replies <= 14, 'Frozen14-controlled-reply ceiling');
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
const countField = () => input('Total bodies (including original)');
const previewButton = () => button(current().workerReady ? 'Preview operation' : 'Recover accepted model and preview operation');
const proposal = () => JSON.parse(panel('linear-pattern').querySelector('pre').textContent);
const acceptedUnchanged = before => assert.deepEqual(authority(), before, 'Temporary count/preview cannot change accepted authority');
const assertCount = (data, count) => {
  assert.deepEqual(data.nodes.slice(0, 4), [...blankNodes, chamferNode, oppositeNode]);
  assert.deepEqual(data.nodes[4], patternNode(count)); assert.deepEqual(data.outputs, patternOutputs(count));
};
const openPattern = async () => {
  await click(button('Linear pattern')); assertPanel('linear-pattern');
  assert.equal(countField().value, '3', 'Each newly opened command defaults to three total bodies');
  assert.deepEqual([...countField().options].map(option => option.value), ['2', '3', '4']);
};
const preview = async (count, keyboard = false) => {
  const before = authority();
  if (keyboard) await key(countField(), 'Enter'); else await click(previewButton());
  assert.equal(countField().disabled, true, 'Count cannot edit an in-flight preview');
  assert.equal(workers.at(-1).requests.at(-1).command.count, count);
  await settled(); assert.equal(current().preview?.status, 'ready', errors().join(' '));
  assert.equal(countField().disabled, false); assertCount(proposal(), count); acceptedUnchanged(before);
  assert.deepEqual(current().preview.outputs.map(output => output.name), Object.keys(patternOutputs(count)));
};
const cancel = async (keyboard = false) => {
  if (keyboard) await key(countField(), 'Escape'); else await click(button('Cancel'));
  await settled(); assertClosed();
};
async function apply(count) {
  const before = authority(), shown = port().visible, replays = stats.authoredContextMocks;
  assert.equal(button('Apply operation').disabled, false);
  await click(button('Apply operation')); acceptedUnchanged(before);
  assert.equal(workers.at(-1).requests.at(-1).kind, 'accept-source');
  await settled(); assertClosed(); assert.equal(current().error, null, errors().join(' '));
  assertCount(data(), count);
  assert.equal(current().history.count, before.history.index + 2);
  assert.equal(current().generation, before.generation + 1);
  assert.equal(port().accepted, shown); assert.equal(port().visible, shown);
  assert.equal(stats.authoredContextMocks, replays, 'Apply promotes the prepared candidate without another provider evaluation');
  assert.deepEqual(current().accepted.outputs.map(output => output.name), Object.keys(patternOutputs(count)));
}
function report(name) { groups.push(name); console.log(JSON.stringify({ status: 'PASS', name, replies: stats.replies })); }
console.log(JSON.stringify({ status: 'START', issue: 2016, sourceHashes, fixtureSourceSHA256,
  limits: { reactRoots: 1, controllerLifetimes: 1, maximumReplies: 14, plannedReplies: 13, nativeCalls: 0 } }));
try {
  assert.equal(hash(fixtureBytes), fixtureHash); assert.equal(fixtureBytes.length, 41471);
  assert.ok(++mountedRoots <= 1); reactRoot = createRoot(container);
  await act(async () => {
    reactRoot.render(React.createElement(ui.api.CadEditorModeling, { workspace: true, initialAuthoredText: defaultText })); await tick();
  });
  await settled(); assert.equal(current().error, null); assert.equal(current().history.count, 1);
  await select(3); await openPattern();
  const initial = authority(); assertCount(proposal(), 3); assert.equal(button('Apply operation').disabled, true);
  assert.match(panel('linear-pattern').textContent, /including the original/);
  const beforeKeys = commands();
  for (const value of ['Enter', 'Escape']) for (const fields of [{ repeat: true }, { isComposing: true }, { shiftKey: true }]) {
    assert.equal((await key(countField(), value, fields)).defaultPrevented, false);
    assert.equal(commands(), beforeKeys); assertPanel('linear-pattern');
  }
  await preview(3, true);
  const staleThree = { apply: reactCallback(button('Apply operation')),
    preview: reactCallback(previewButton()), count: reactCallback(countField(), 'onChange') };
  await change(countField(), '2'); await settled();
  assert.equal(current().preview, null); assert.equal(button('Apply operation').disabled, true);
  assertCount(proposal(), 2); acceptedUnchanged(initial);
  assert.equal(port().visible, port().accepted, 'Count change removes the previous ready preview');
  for (const name of ['apply', 'preview']) await assertStale(staleThree[name], `Count change invalidates captured ${name}`);
  await assertStale(() => staleThree.count({ target: { value: '4' } }), 'Old count callback cannot replace current count');
  assert.equal(countField().value, '2');
  // Count ABA must not restore a callback captured for the earlier count3 render.
  await change(countField(), '3');
  await assertStale(staleThree.apply, 'Count ABA cannot revive captured ready Apply');
  await change(countField(), '2'); await preview(2);
  report('Default count3, selector keyboard guards/Enter, count invalidation and count ABA stale callbacks');

  const staleTwoApply = reactCallback(button('Apply operation'));
  await change(countField(), '4'); await settled();
  assert.equal(current().preview, null); assertCount(proposal(), 4);
  await assertStale(staleTwoApply, 'Count2 Apply cannot promote count4');
  await preview(4); const canceledApply = reactCallback(button('Apply operation'));
  await cancel(true); acceptedUnchanged(initial); assert.equal(current().preview, null);
  assert.equal(port().visible, port().accepted);
  await assertStale(canceledApply, 'Canceled count4 Apply remains inert');
  await openPattern(); assertCount(proposal(), 3);
  report('Count4 preview, Escape Cancel preserves source/history, reopening restores default count3');

  await change(countField(), '2'); await preview(2); await apply(2);
  assert.equal(current().history.count, 2);
  await click(button('Undo')); await settled();
  assert.equal(current().authoredText, defaultText); assert.equal(current().history.index, 0);
  assert.deepEqual(current().accepted.outputs.map(output => output.name), ['part']);
  await select(3); await openPattern(); await change(countField(), '4'); await preview(4); await apply(4);
  assert.equal(current().history.count, 2); assert.equal(current().history.index, 1);
  assert.equal(data().parameters.patternSpacing, 40);
  report('Count2 and count4 exact acknowledged Apply; Undo restores original source and output inventory');

  assert.equal(stats.replies, 13); assert.equal(sessions.length, 1);
  assert.deepEqual(submissions.map(submission => submission.count), [3, 2, 4, 2, 4]);
  // Geometry is never synthesized: each output only clones the original role/name envelope.
  for (const component of current().display.packet.components) {
    assert.deepEqual(component.mesh, retainedComponent.mesh);
    assert.deepEqual(component.lineage.graph, retainedComponent.lineage.graph);
    assert.equal(component.report.solidId, retainedComponent.report.solidId);
  }
  assert.equal(hash(JSON.stringify(baseline)), retainedHash);
  assert.equal(hash(fixtureBytes), fixtureHash);
} finally {
  if (reactRoot) await act(async () => { reactRoot.unmount(); await tick(); });
  dom.window.close();
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  }
}
assert.ok(workers.every(worker => worker.terminated)); assert.equal(stats.nativeCalls, 0);
for (const [path, expected] of Object.entries(sourceHashes)) assert.equal(hash(readFileSync(resolve(root, path))), expected);
assert.equal(hash(readFileSync(import.meta.filename)), fixtureSourceSHA256);
console.log(JSON.stringify({ status: 'PASS', issue: 2016, node: process.version, groups,
  mountedRoots, controllerLifetimes: sessions.length, ...stats, sourceHashes, fixtureSourceSHA256, submissions,
  fixture: { path: fixturePath, sha256: fixtureHash, bytes: fixtureBytes.length },
  boundaries: { actual: ['React', 'controller', 'structure helper', 'CPU receiver', 'DOM events and captured callbacks'],
    controlled: ['Worker/provider summary', 'unchanged coincident role/name envelopes with original duplicate native IDs', 'display port', 'ResizeObserver'],
    unrun: ['native evaluation', 'translated copy geometry', 'distinct-body post-pattern warning', 'GPU pixels', 'physical Save/Open', 'STL'] } }));
