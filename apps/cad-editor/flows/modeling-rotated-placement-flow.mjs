// #1999: ten frozen groups, one React root, at most three controller lifetimes, at most30 replies.
// Actual React/controller/bounded helper/CPU receiver execute; no physical Save/Open replay.
// Worker/provider summaries and authored four/five/six-node context are explicit doubles.
// EVERY display is the unchanged genuine TWO-bevel1/2 transport,6064mm³/20triangles.
// Rotated, placed and edited deliveries are explicit mocks; no new geometry is claimed.
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
const submissions = [];
const groups = [], sessions = [], workers = [], displays = [], observers = [], replyCounts = [], emissions = [];
const ledger = Object.freeze([
  'Owned rail selection and accepted authored coordinate feedback',
  'Cardinal rotation options and pre-preview Apply refusal',
  'Escape and guarded Enter preview without accepted mutation',
  'Rotate preview promotion preserves source prefix and history',
  'Move decimal parsing, independent offsets and no silent rounding',
  'Same-command replacement and field ABA invalidate candidates',
  'Unrelated drafts, selected-target and controller lifetime fencing',
  'Native, receiver and display refusal retain accepted state before Move promotion',
  'Placement parameter preview and structural versus parameter Undo/Redo',
  'Terminal placement, CPU source roundtrip and mounted legacy routes',
]);
const expectedReplyCounts = Object.freeze([1, 0, 2, 2, 0, 4, 2, 8, 8, 0]);
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
    console.error(JSON.stringify({ status: 'FAIL', issue: 1999, group: groups.length + 1, name,
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
const rotateNode = { kind: 'rotate', parent: { node: 3, side: 'solid' }, axis: 'x', angleDegrees: 90 };
const moveNode = { kind: 'translate', parent: { node: 4, side: 'solid' }, offset: ['placementX', 'placementY', 'placementZ'].map(parameter => ({ parameter })) };
// This summary is a controlled authored-context adaptation, not new native
// evidence. Keep6064 visible so no UI screenshot can masquerade as6128/6080.
function mockTransport(text, revision, id) {
  const data = JSON.parse(text);
  assert.ok([4, 5, 6].includes(data.nodes.length));
  assert.deepEqual(data.nodes.slice(0, 2), blankNodes);
  if (data.nodes.length >= 3) assert.deepEqual(data.nodes[2], chamferNode);
  assert.deepEqual(data.nodes[3], oppositeNode);
  if (data.nodes.length >= 5) { assert.equal(data.nodes[4].kind, "rotate"); assert.deepEqual(data.nodes[4].parent, rotateNode.parent); }
  if (data.nodes.length === 6) assert.deepEqual(data.nodes[5], moveNode);
  assert.deepEqual(data.outputs, { part: { node: data.nodes.length - 1, side: 'solid' } });
  const reply = structuredClone(baseline);
  reply.id = id; reply.text = signedJSON(data);
  reply.summary.parameters = structuredClone(data.parameters);
  reply.summary.features = data.nodes.map((node, index) => ({ kind: node.kind, index, dependencies: index ? [index - 1] : [] }));
  reply.summary.revision = revision; reply.display.revision = revision;
  stats.authoredContextMocks++;
  if (data.nodes.length > 4) stats.editedStateMocks++;
  assert.deepEqual(reply.display.components[0], retainedComponent);
  assert.deepEqual(reply.summary.outputs, baseline.summary.outputs);
  return reply;
}
setGlobal('__modelingRotatedPlacementFlow', {
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
const boundaryPlugin = { name: 'explicit-rotated-placement-boundaries', setup(build) {
  build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\.\/modeling-controller\.js$/ }, () => ({ path: 'controller', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\.\/prism-feature-display\.js$/ }, () => ({ path: 'display', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'view-boundary' }));
  build.onLoad({ filter: /.*/, namespace: 'view-boundary' }, ({ path }) => ({ resolveDir: root, contents: {
    provider: 'throw Error("Provider execution is outside this transport-replay fixture.");',
    legacy: 'export function createPrismFeatureEngine() { return () => { throw Error("Legacy native execution is outside this flow."); }; }',
    controller: `import {createCadEditorModelingController as create} from ${JSON.stringify(source('modeling-controller.ts'))}; export const createCadEditorModelingController = (...args) => globalThis.__modelingRotatedPlacementFlow.controller(create, ...args);`,
    display: 'export const createPrismFeatureDisplay = globalThis.__modelingRotatedPlacementFlow.display;',
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
      if (command.command.kind === 'rotate-part') {
        assert.equal(prior.nodes.length, 4);
        assert.deepEqual(submitted.nodes[4], { ...rotateNode, axis: command.command.axis, angleDegrees: command.command.angleDegrees });
        assert.deepEqual(submitted.parameters, prior.parameters);
      } else {
        assert.equal(command.command.kind, 'move-part'); assert.equal(prior.nodes.length, 5);
        assert.deepEqual(submitted.nodes[5], moveNode);
        assert.deepEqual(submitted.parameters, { ...prior.parameters, placementX: command.command.x, placementY: command.command.y, placementZ: command.command.z });
      }
      assert.deepEqual(command.command.target, { name: 'part', solidId: current().accepted.outputs[0].solidId, node: prior.nodes.length - 1 });
      assert.ok(Object.is(submitted.nodes[0].min[0], -0));
      assert.deepEqual(submitted.outputs, { part: { node: submitted.nodes.length - 1, side: 'solid' } });
      assert.equal(command.text, signedJSON(submitted));
      submissions.push({ kind: command.kind, operation: command.operation, text: command.text, sourceSHA256: hash(command.text),
        parameters: submitted.parameters, target: command.command.target });
    } else if (command.kind === 'prepare-preview' || command.kind === 'apply') {
      assert.equal(JSON.parse(this.accepted.text).nodes.length, 6);
      assert.deepEqual(JSON.parse(this.accepted.text).nodes, [...blankNodes, chamferNode, oppositeNode, rotateNode, moveNode]);
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
        assert.equal(kind, 'prepare-source'); assert.equal(command.command.x, 0.1); providerRefusal = false; stats.providerRefusals++;
        const message = 'Controlled native exact translation representability refusal';
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
  assert.deepEqual(current().display.packet.components, baseline.display.components,
    'Complete retained two-bevel mesh, sources, UVs, boundaries, report and lineage remain unchanged');
  assert.deepEqual(current().accepted.outputs, baseline.summary.outputs);
  assert.equal(current().display.packet.components[0].report.triangleCount, 20);
  assert.equal(hash(JSON.stringify(baseline)), retainedHash); assert.equal(hash(fixtureBytes), fixtureHash);
};
const openRotate = async () => { await click(button('Rotate part')); assertPanel('rotate-part'); };
const openMove = async () => { await click(button('Move part')); assertPanel('move-part'); };
const globalEdit = async () => { await click(button('Edit model dimensions')); assertPanel('dimensions'); };
const previewButton = () => button(current().workerReady ? 'Preview operation' : 'Recover accepted model and preview operation');
const preview = async () => {
  await click(previewButton()); await settled(); assert.equal(current().preview?.status, 'ready', errors().join(' '));
};
const cancel = async () => { await click(button('Cancel')); await settled(); assertClosed(); };
const capture = () => ({ preview: reactCallback(previewButton()), apply: reactCallback(button('Apply operation')),
  cancel: reactCallback(button('Cancel')), select: reactCallback(testid('modeling-browser').querySelector('button[data-feature-index="0"]')),
  field: reactCallback(input(current().accepted.features.length === 4 ? 'World axis' : 'Native X offset (mm)'), 'onChange') });
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
const productCommit = 'f38fd92ee178555fa55895a05aa0b70f3fc377c0';
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
assert.equal(hash(readFileSync(import.meta.filename)), frozenSourceHashes['apps/cad-editor/flows/modeling-rotated-placement-flow.mjs']);
const fixtureSourceSHA256 = hash(readFileSync(import.meta.filename));
console.log(JSON.stringify({ status: 'START', issue: 1999, ledger, expectedReplyCounts, productCommit, sourceHashes, fixtureSourceSHA256,
  fixture: { path: fixturePath, sha256: fixtureHash },
  limits: { groups: 10, reactRoots: 1, maximumControllerLifetimes: 3, maximumReplies: 30, plannedReplies: 27, nativeCalls: 0 } }));
let viewport, rotatedText, placedText, editedText;
const readout = () => [...container.querySelectorAll('[data-testid="modeling-accepted-placement"]')].find(node => !node.closest('[hidden]'))?.textContent;
const parameterEdit = async (name, value, priorOtherName, priorOtherValue) => {
  await globalEdit();
  const before = authority(), nodes = data().nodes, requestCount = commands();
  await change(input(`${name} (mm)`), String(value));
  assert.equal(commands(), requestCount); assert.deepEqual(current().drafts, { [name]: String(value) });
  await click(button('Preview dimensions'));
  const command = workers.at(-1).requests.at(-1);
  assert.equal(command.kind, 'prepare-preview'); assert.deepEqual(command.parameters, { [name]: value });
  await settled(); assert.equal(current().preview.status, 'ready', errors().join(' '));
  assert.deepEqual(authority(), before);
  const candidateText = workers.at(-1).lastReply.text, candidate = JSON.parse(candidateText);
  assert.deepEqual(candidate.nodes, nodes); assert.equal(candidate.parameters[name], value);
  assert.equal(candidate.parameters[priorOtherName], priorOtherValue, 'Other placement driver remains independent');
  const replays = stats.authoredContextMocks;
  await click(button('Apply dimensions')); await settled(); assertClosed();
  assert.equal(stats.authoredContextMocks, replays, 'Ready parameter preview promotes without evaluation');
  assert.equal(current().authoredText, candidateText); assert.equal(data().parameters[name], value);
  assert.equal(data().parameters[priorOtherName], priorOtherValue); assert.deepEqual(data().nodes, nodes);
  assert.equal(current().history.count, before.history.index + 2); geometryUnchanged();
};
try {
  await group(ledger[0], async () => {
    assert.equal(hash(fixtureBytes), fixtureHash); assert.equal(fixtureBytes.length, 41471);
    for (const suffix of ['react/modeling-editor.tsx', 'react/modeling-workspace.tsx', 'modeling-controller.ts', 'modeling-structure.ts', 'modeling-scene.ts']) assert.ok(ui.inputs.some(path => path.endsWith(suffix)));
    assert.ok(++mountedRoots <= 1); reactRoot = createRoot(container); await rerender(defaultText);
    assert.equal(current().error, null); assert.equal(current().history.count, 1); viewport = testid('modeling-viewport');
    for (const index of [0,1,2]) { await select(index); assert.equal(button('Rotate part'), undefined); }
    await select(3); assert.ok(button('Rotate part')); assert.equal(button('Move part'), undefined);
    await openRotate(); assert.equal(input('World axis').value, 'x'); assert.equal(input('Cardinal angle (degrees)').value, '90');
    assert.match(readout(), /Original rail orientation/); assert.match(readout(), /\[0, 0, 0\] to \[32, 24, 8\]/);
    assert.match(readout(), /not certified native bounds/); geometryUnchanged(); await cancel();
  });
  await group(ledger[1], async () => {
    await openRotate(); const before = authority(), requestCount = commands();
    await assertStale(reactCallback(button('Apply operation')), 'Pre-preview Apply never evaluates');
    assert.deepEqual([...input('World axis').options].map(x=>x.value), ['x','y','z']);
    assert.deepEqual([...input('Cardinal angle (degrees)').options].map(x=>x.value), ['90','-90','180','-180','270','-270']);
    for (const axis of ['x','y','z']) for (const angle of ['90','-90','180','-180','270','-270']) {
      await change(input('World axis'), axis); await change(input('Cardinal angle (degrees)'), angle);
      const proposed=JSON.parse(panel('rotate-part').querySelector('pre').textContent);
      assert.deepEqual(proposed.nodes.slice(0,4), data().nodes); assert.equal(proposed.nodes[4].axis,axis); assert.equal(proposed.nodes[4].angleDegrees,Number(angle));
      assert.deepEqual(proposed.parameters,data().parameters); assert.deepEqual(proposed.outputs,{part:{node:4,side:'solid'}});
    }
    assert.equal(commands(),requestCount); assert.deepEqual(authority(),before); await cancel();
  });
  await group(ledger[2], async () => {
    await openRotate(); const before=authority(), requestCount=commands();
    for (const value of ['Enter','Escape']) for (const fields of [{repeat:true},{isComposing:true},{keyCode:229},{ctrlKey:true},{shiftKey:true}]) {
      assert.equal((await key(input('World axis'),value,fields)).defaultPrevented,false); assert.equal(commands(),requestCount);
    }
    await key(input('World axis'),'Escape'); assertClosed(); assert.deepEqual(authority(),before);
    await openRotate(); await key(input('Cardinal angle (degrees)'),'Enter'); await settled();
    assert.equal(current().preview.status,'ready'); assert.deepEqual(authority(),before); assert.match(readout(),/Original rail orientation/);
    assert.equal(data().nodes.length,4); await cancel(); assert.deepEqual(authority(),before);
  });
  await group(ledger[3], async () => {
    await openRotate(); const before=authority(); await preview(); assert.deepEqual(authority(),before);
    assert.match(readout(),/Original rail orientation/); rotatedText=workers.at(-1).lastReply.text; await applyStructure();
    assert.equal(data().nodes.length,5); assert.equal(current().history.count,2); assert.deepEqual(data().nodes[4],rotateNode);
    await select(4); assert.equal(button('Rotate part'),undefined); assert.ok(button('Move part')); await openMove();
    assert.match(readout(),/X rotation 90/); assert.match(readout(),/\[0, -8, 0\] to \[32, 0, 24\]/); await cancel(); geometryUnchanged();
  });
  await group(ledger[4], async () => {
    await openMove(); const before=authority(), requestCount=commands();
    assert.equal(input('Native X offset (mm)').value,'40'); assert.equal(input('Native Y offset (mm)').value,'16'); assert.equal(input('Native Z offset (mm)').value,'0');
    await assertStale(reactCallback(button('Apply operation')),'Move pre-preview Apply no-op');
    for (const value of ['', ' ', 'NaN','Infinity','0x10','10001','-10001','1e309','1e-9999']) {
      await change(input('Native X offset (mm)'),value); assert.equal(previewButton().disabled,true); await click(previewButton());
    }
    for (const value of ['-0','0.1','+.5','-2.5','4e1']) {
      await change(input('Native X offset (mm)'),value); assert.equal(previewButton().disabled,false);
      const proposed=JSON.parse(panel('move-part').querySelector('pre').textContent); assert.ok(Object.is(proposed.parameters.placementX,Number(value)));
      assert.deepEqual(proposed.nodes.slice(0,5),data().nodes); assert.deepEqual(proposed.nodes[5],moveNode); assert.equal(proposed.parameters.placementY,16);
    }
    assert.equal(commands(),requestCount); assert.deepEqual(authority(),before); assert.deepEqual(current().drafts,{}); await cancel();
  });
  await group(ledger[5], async () => {
    await openMove(); const before=authority(); await preview(); const old=capture(), candidate=port().candidates.at(-1);
    await openMove(); await settled(); assert.equal(candidate.disposed,true); assert.equal(current().preview,null); await staleCallbacks(old,'Same panel replacement');
    await preview(); const aba=capture(); await change(input('Native X offset (mm)'),'56'); await change(input('Native X offset (mm)'),'40'); await settled();
    assert.equal(current().preview,null); await staleCallbacks(aba,'Offset field ABA'); assert.deepEqual(authority(),before); await cancel();
  });
  await group(ledger[6], async () => {
    await globalEdit(); await change(input('width (mm)'),'33'); await openMove(); const pending=capture(), count=commands();
    assert.equal(previewButton().disabled,true); await click(button('Review pending dimensions')); assertPanel('dimensions'); assert.deepEqual(current().drafts,{width:'33'});
    await staleCallbacks(pending,'Review command'); await cancel(); assert.equal(commands(),count);
    await openMove(); const selected=capture(); await select(0); assertClosed(); await select(4); await openMove(); await staleCallbacks(selected,'Selection ABA');
    const heldCallbacks=capture(), oldPort=port(), oldWorker=workers.at(-1), oldController=sessions.at(-1).controller;
    oldPort.holdNext=true; await click(previewButton()); await act(async()=>{oldWorker.accept();await tick();}); assert.ok(oldPort.release);
    const held=oldPort.candidates.at(-1); await rerender(rotatedText+'\n'); assert.equal(oldController.getSnapshot().disposed,true); assert.equal(current().history.count,1);
    await select(4); await openMove(); const before=current(); await act(async()=>{oldPort.release();await tick();}); assert.equal(held.disposed,true); assert.deepEqual(current(),before);
    await staleCallbacks(heldCallbacks,'Controller lifetime ABA'); assert.equal(testid('modeling-viewport'),viewport); await cancel();
  });
  await group(ledger[7], async () => {
    await openMove(); const before=authority(); await change(input('Native X offset (mm)'),'0.1'); providerRefusal=true;
    await click(previewButton()); await settled(); assert.equal(current().preview.status,'error'); assert.equal(current().preview.diagnostic.stage,'native');
    assert.deepEqual(authority(),before); assert.equal(input('Native X offset (mm)').value,'0.1'); assert.match(errors().join(' '),/representability/);
    await change(input('Native X offset (mm)'),'40');
    mutateNextReply=reply=>{reply.display.components[0].mesh.indices[0]=9999;stats.receiverRefusals++;};
    await click(previewButton()); await settled(); assert.equal(current().preview.status,'error'); assert.equal(current().preview.diagnostic.stage,'transport'); assert.deepEqual(authority(),before);
    port().failNext=true; await click(previewButton()); await settled(); assert.equal(current().preview.status,'error'); assert.equal(current().preview.diagnostic.stage,'display'); assert.deepEqual(authority(),before);
    await assertStale(reactCallback(button('Apply operation')),'Refused Move Apply no-op');
    await preview(); assert.deepEqual(authority(),before); assert.match(readout(),/\[0, -8, 0\] to \[32, 0, 24\]/);
    placedText=workers.at(-1).lastReply.text; await applyStructure(); assert.equal(current().history.count,2); assert.equal(data().nodes.length,6);
    assert.deepEqual(data().outputs,{part:{node:5,side:'solid'}}); await click(button('Inspect selection'));
    assert.match(readout(),/\[40, 8, 0\] to \[72, 16, 24\]/); assert.match(readout(),/offsets \[40, 16, 0\]/); geometryUnchanged();
  });
  await group(ledger[8], async () => {
    await parameterEdit('placementX',56,'placementY',16); editedText=current().authoredText;
    assert.equal(current().history.count,3); await click(button('Inspect selection')); assert.match(readout(),/\[56, 8, 0\] to \[88, 16, 24\]/);
    await history('Undo',placedText,3,1); await click(button('Inspect selection')); assert.match(readout(),/\[40, 8, 0\] to \[72, 16, 24\]/); assert.equal(data().nodes.length,6);
    await history('Undo',rotatedText,3,0); await click(button('Inspect selection')); assert.match(readout(),/\[0, -8, 0\] to \[32, 0, 24\]/); assert.equal(data().nodes.length,5);
    await history('Redo',placedText,3,1); assert.equal(data().nodes.length,6);
    await history('Redo',editedText,3,2); assert.equal(data().parameters.placementX,56); await click(button('Inspect selection')); assert.match(readout(),/\[56, 8, 0\] to \[88, 16, 24\]/);
  });
  await group(ledger[9], async () => {
    const before=authority(), requestCount=commands();
    for(const index of [0,1,2,3,4,5]) { await select(index); assert.equal(button('Rotate part'),undefined); assert.equal(button('Move part'),undefined); }
    assert.equal(structure.api.canonicalModelingText(JSON.parse(current().authoredText)),editedText);
    assert.ok(Object.is(data().nodes[0].min[0],-0)); assert.deepEqual(data().nodes,[...blankNodes,chamferNode,oppositeNode,rotateNode,moveNode]);
    for(const [label,name] of [['New rectangular part','new-part'],['New circular part','new-circular-part']]) { await click(button(label)); assertPanel(name); await cancel(); }
    await click(button('Save or open a model')); assertPanel('files'); assert.ok(button('Download model'));
    await click(button('Export accepted STL')); assertPanel('outputs');
    assert.deepEqual(authority(),before); assert.equal(commands(),requestCount); assert.equal(testid('modeling-viewport'),viewport); assert.equal(viewport.querySelectorAll('canvas').length,1); geometryUnchanged();
  });
} finally {
  if(reactRoot) await act(async()=>{reactRoot.unmount();await tick();});
  for(const record of displays) if(record.release)record.release();
  dom.window.close(); for(const [name,descriptor]of globals){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
}
assert.deepEqual(groups,ledger); assert.deepEqual(replyCounts,expectedReplyCounts); assert.equal(stats.replies,expectedReplyCounts.reduce((a,b)=>a+b,0));
assert.equal(mountedRoots,1); assert.equal(sessions.length,2); assert.equal(stats.nativeCalls,0); assert.ok(workers.every(worker=>worker.terminated));
assert.equal(stats.receiverRefusals,1);assert.equal(stats.providerRefusals,1);assert.equal(stats.displayRefusals,1);
for(const path of proofPaths)assert.equal(hash(readFileSync(resolve(root,path))),sourceHashes[path]);
const runtimeSourceHashes=Object.fromEntries(ui.inputs.filter(path=>!path.includes(':')&&path.includes('packages/')).map(path=>[path,hash(readFileSync(resolve(root,path)))]));
console.log(JSON.stringify({status:'PASS',issue:1999,node:process.version,groups,replyCounts,expectedReplyCounts,mountedRoots,controllerLifetimes:sessions.length,...stats,productCommit,sourceHashes,runtimeSourceHashes,fixtureSourceSHA256,submissions,
  fixture:{path:fixturePath,sha256:fixtureHash,bytes:fixtureBytes.length},acceptedRotatedSourceSHA256:hash(rotatedText),acceptedPlacedSourceSHA256:hash(placedText),acceptedEditedSourceSHA256:hash(editedText),
  retainedGeometry:{genuineFeatureCount:4,volumeMM3:6064,triangles:20,scope:'Every rotated/placed/edited display is an explicitly mocked authored context over unchanged genuine untransformed rail geometry'},
  boundaries:{actual:['React','controller','structure helper','CPU receiver','DOM events and captured callbacks','accepted-source CPU roundtrip'],controlled:['Worker/provider summary','native refusal','malformed transport','display port','ResizeObserver'],unrun:['native evaluation','transformed geometry','GPU pixels','physical Save/Open','STL']}}));
