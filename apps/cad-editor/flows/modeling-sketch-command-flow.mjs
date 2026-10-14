// #1957: one React root, at most three controller lifetimes; real controller, serializer and CPU receiver.
// Frozen ledger: 16 grouped cases and at most 24 controlled Worker replies.
// New three-driver source is an adaptation, never a measured native authoring receipt.
// Provider, Worker, ResizeObserver and display-port execution are explicit controlled boundaries.
// Geometry is the genuine retained #1835 baseline for EVERY reply, including edited parameters.
// Edited-state geometry, native execution, WebGPU pixels and physical browser I/O are UNRUN.
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
const fixturePath = 'packages/barocss-cad/test/modeling-constraints-evidence/baseline-transfer.json';
const fixtureBytes = readFileSync(resolve(root, fixturePath));
const fixtureHash = '194b855ed3e862e76c2468cbbcb0d2f21f7b2eda0a217325fa95a32fee226721';
const hash = value => createHash('sha256').update(value).digest('hex');
const baseline = JSON.parse(fixtureBytes), authored = JSON.parse(baseline.text);
const groups = [], sessions = [], workers = [], displays = [], observers = [];
const stats = { replies: 0, providerLoads: 0, providerEdits: 0, previewReplays: 0, nativeCalls: 0 };
const globals = new Map();
function setGlobal(name, value) {
  if (!globals.has(name)) globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}
async function group(name, run) {
  assert.ok(groups.length < 16, 'Frozen sixteen-case ledger ceiling');
  try { await run(); } catch (cause) {
    console.error(JSON.stringify({ group: groups.length + 1, name, status: 'FAIL', mountedRoots, controllerLifetimes: sessions.length, ...stats, error: String(cause) }));
    throw cause;
  }
  groups.push(name);
  console.log(JSON.stringify({ group: groups.length, name, status: 'PASS' }));
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  return value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
}
// Only the mocked provider substitutes its codec/native bodies; the real engine projects them.
const signedJSON = value => JSON.stringify(canonical(value), (_key, value) => Object.is(value, -0) ? '__NEG_ZERO__' : value)
  .replaceAll('"__NEG_ZERO__"', '-0') + '\n';
const forbidden = () => { stats.nativeCalls++; throw Error('New native or legacy execution is outside this flow.'); };
function providerSnapshot(data) {
  return {
    parameters: structuredClone(data.parameters), suppression: {}, features: structuredClone(baseline.features),
    bodies: structuredClone(baseline.bodies), save: () => signedJSON(data),
    withParameters(changes) {
      stats.providerEdits++;
      const parameters = { ...data.parameters, ...changes };
      if (parameters.width <= 0) throw Error('Controlled provider refusal: width must be positive.');
      return providerSnapshot({ ...data, parameters });
    },
    withSuppression: forbidden,
  };
}
setGlobal('__modelingSketchFlow', {
  cad: { model: forbidden, load(text) { stats.providerLoads++; return providerSnapshot(JSON.parse(text)); } },
  tessellateConvexPlanarSolid(solid, options) {
    assert.deepEqual(solid, baseline.bodies.part.native);
    assert.deepEqual(options, { maximumFanTriangles: 40 });
    stats.previewReplays++;
    return structuredClone(baseline.preview);
  },
  tessellateSurface: forbidden, tessellateOwnPlateCircularHole: forbidden, tessellateXYCirclePrismShell: forbidden,
  controller(create, ...args) {
    assert.ok(sessions.length < 3, 'Frozen three-mounted-session ceiling');
    const controller = create(...args), calls = [];
    const session = new Proxy(controller, { get(target, name) {
      const value = target[name];
      if (typeof value !== 'function' || name === 'getSnapshot') return value;
      return (...args) => { calls.push({ name, args }); return value(...args); };
    } });
    sessions.push({ controller, session, calls }); return session;
  },
  display(host) {
    const record = { host, prepares: 0, commits: 0, candidateDisposals: 0, resizes: 0, disposals: 0,
      accepted: null, holdNext: false, release: null };
    displays.push(record);
    return {
      async prepare(scene) {
        record.prepares++;
        const candidate = { commit() { record.commits++; record.accepted = scene; },
          dispose() { record.candidateDisposals++; } };
        if (record.holdNext) {
          record.holdNext = false;
          await new Promise(resolve => { record.release = () => { record.release = null; resolve(); }; });
        }
        return candidate;
      },
      aspect() { return 1.5; }, dimensions() { return { width: 900, height: 600 }; },
      resize() { record.resizes++; }, dispose() { record.disposals++; },
    };
  },
});
const source = name => resolve(root, `packages/barocss-cad-editor/src/${name}`);
const boundaryPlugin = { name: 'explicit-sketch-command-boundaries', setup(build) {
  build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\.\/modeling-controller\.js$/ }, () => ({ path: 'controller', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\.\/prism-feature-display\.js$/ }, () => ({ path: 'display', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'workspace-boundary' }));
  build.onLoad({ filter: /.*/, namespace: 'workspace-boundary' }, ({ path }) => ({ resolveDir: root, contents: {
    provider: 'export const {cad,tessellateConvexPlanarSolid,tessellateSurface,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell} = globalThis.__modelingSketchFlow;',
    legacy: 'export function createPrismFeatureEngine() { return () => { throw Error("Legacy native execution is outside this flow."); }; }',
    controller: `import {createCadEditorModelingController as create} from ${JSON.stringify(source('modeling-controller.ts'))}; export const createCadEditorModelingController = (...args) => globalThis.__modelingSketchFlow.controller(create, ...args);`,
    display: 'export const createPrismFeatureDisplay = globalThis.__modelingSketchFlow.display;',
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
  callbacks = new Map(); requests = []; answered = new Set(); terminated = false;
  engine = engine.api.createModelingEngine();
  constructor() { workers.push(this); }
  addEventListener(kind, callback) { this.callbacks.set(kind, callback); }
  postMessage(command) { this.requests.push(structuredClone(command)); }
  terminate() { this.terminated = true; }
  accept(command = this.requests.at(-1)) {
    assert.ok(command && !this.answered.has(command.id));
    assert.ok(++stats.replies <= 24, 'Frozen twenty-four-worker-reply ceiling');
    this.answered.add(command.id);
    const reply = this.engine(command); this.lastReply = structuredClone(reply);
    this.callbacks.get('message')({ data: structuredClone(reply) }); return reply;
  }
});
const React = require('react'), { createRoot } = require('react-dom/client'), { act } = React;
const ui = await bundle('react/modeling-editor.tsx');
const builder = await bundle('modeling-rectangular-part.ts');
const { createRectangularPartSource: createSource } = builder.api;
const projection = await bundle('modeling-sketch-command.ts');
const { projectSketchCommand: project, sketchCommandCurrent: commandCurrent } = projection.api;
const container = document.getElementById('root');
let reactRoot, mountedRoots = 0;
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const current = () => sessions.at(-1).controller.getSnapshot();
const port = () => displays.at(-1);
const observer = () => observers.at(-1);
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
  for (let step = 0; step < 20; step++) {
    await act(async () => {
      const worker = workers.at(-1), command = worker?.requests.at(-1);
      if (worker && !worker.terminated && command && !worker.answered.has(command.id)) worker.accept(command);
      await tick();
    });
    if (!current().busy) return;
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

// #1951's three-driver rectangle is authored-data adaptation only. Every response,
// including non-origin/shared/unsupported controls, replays unchanged #1835 geometry.
const rawDefaults = { width: '32', height: '24', thickness: '8' };
const defaultText = createSource(rawDefaults), defaultData = JSON.parse(defaultText);
const defaultHash = 'a354312ac37f51e58f8d94614e11bca9d73b1f17410c1a36eb08f8d9090c06ef';
const variants = {};
function variant(name, update) {
  const data = structuredClone(defaultData); update(data);
  variants[name] = signedJSON(data); return variants[name];
}
variant('non-origin-shared', data => {
  data.parameters.originX = -5;
  data.nodes[0].min = [{ parameter: 'originX' }, -4];
  data.nodes[0].max = [{ parameter: 'width' }, { parameter: 'width' }];
  data.nodes[1].height = { parameter: 'width' };
});
variant('literal-derived', data => {
  data.nodes[0].min = [-5, { op: 'scale', value: { parameter: 'height' }, factor: -1 }];
  data.nodes[0].max = [{ op: 'add', left: { parameter: 'width' }, right: 3 }, 24];
});
variant('unsupported-profile', data => {
  data.nodes[0] = { kind: 'sketch', profile: 'polygon', points: [[0, 0], [{ parameter: 'width' }, 0],
    [{ parameter: 'width' }, { parameter: 'height' }], [0, { parameter: 'height' }]] };
});
variant('prop-B', data => { data.parameters.width = 35; });
function projectionSnapshot(text = defaultText, patch = {}) {
  const data = JSON.parse(text);
  return { accepted: { documentId: 'cad_model', revision: 0, source: 'model', parameters: data.parameters,
    features: structuredClone(baseline.features), outputs: [{ name: 'part', solidId: baseline.bodies.part.native.id, family: 'convex-planar' }] },
  authoredText: text, drafts: {}, selection: 0, generation: 1, busy: false, disposed: false, error: null,
  display: null, faceSelection: null, workerReady: true, history: { index: 0, count: 1, canUndo: false, canRedo: false }, ...patch };
}
const visible = node => !!node && !node.closest('[hidden]');
const panel = name => testid(`modeling-panel-${name}`);
const assertPanel = name => {
  assert.ok(visible(testid('modeling-options')), 'Options must be visible');
  assert.ok(visible(panel(name)), `${name} panel must be visible`);
};
const assertClosed = () => assert.equal(visible(testid('modeling-options')), false);
const assertOptionsFocus = () => assert.equal(document.activeElement, testid('modeling-options').querySelector(':scope > header h2'));
const assertWorkspaceFocus = () => assert.equal(document.activeElement, testid('modeling-workspace'));
const width = () => input('Max X · width (mm)') ?? input('Max X / Max Y · width (mm)');
const profileHeight = () => input('Max Y · height (mm)');
const originX = () => input('Min X · originX (mm)');
const values = () => [...panel('sketch').querySelectorAll('input')].map(node => ({ id: node.id, value: node.value, disabled: node.disabled }));
const applyButton = () => button('Apply sketch dimensions');
const feature = index => testid('modeling-browser').querySelector(`button[data-feature-index="${index}"]`);
const select = async index => { await click(feature(index)); assert.equal(current().selection, index); };
const edit = async () => {
  await click(button('Edit sketch dimensions')); assertPanel('sketch'); assertOptionsFocus();
  assert.equal(testid('modeling-options').querySelector(':scope > header h2').textContent, 'Edit sketch dimensions');
};
const staged = async (name, raw) => {
  await act(async () => { sessions.at(-1).controller.stage(name, raw); await tick(); });
};
const discard = async () => {
  await act(async () => { sessions.at(-1).controller.discard(); await tick(); });
};
async function openText(text) {
  let operation;
  await act(async () => { operation = sessions.at(-1).controller.open(text); await tick(); });
  await settled(); await operation;
  // The controlled provider save canonicalizes source; no native geometry is generated.
  assert.deepEqual(JSON.parse(current().authoredText), JSON.parse(text));
  assert.equal(current().error, null); baselineGeometry();
}
const countCalls = name => sessions.at(-1).calls.filter(call => call.name === name).length;
// Capture actual mounted React handlers to probe queued events after their source DOM disappears.
// Neither the product callback nor the model/controller validation is replaced.
const reactCallback = (node, name) => {
  assert.ok(node, `Expected React ${name} target`);
  const props = Object.keys(node).find(key => key.startsWith('__reactProps$'));
  assert.ok(props && typeof node[props][name] === 'function', `Actual React ${name} must exist`);
  return node[props][name];
};
const capture = () => ({ change: reactCallback(width(), 'onChange'), apply: reactCallback(applyButton(), 'onClick'),
  cancel: reactCallback(button('Cancel'), 'onClick'), key: reactCallback(width(), 'onKeyDown'),
  close: reactCallback(button('Close options'), 'onClick'),
  review: reactCallback(button('Review model dimensions'), 'onClick') });
const errors = () => [...container.querySelectorAll('[role="alert"]')].map(node => node.textContent);
async function assertStale(callbacks, label) {
  const before = authority(), beforeDrafts = current().drafts, beforeValues = values(), beforeCommands = commands();
  const beforeErrors = errors(), stages = countCalls('stage'), applies = countCalls('apply'), discards = countCalls('discard');
  for (const [name, callback] of Object.entries(callbacks)) {
    if (name === 'key') {
      for (const pressed of ['Enter', 'Escape']) await act(async () => {
        callback({ key: pressed, nativeEvent: {}, preventDefault() {}, stopPropagation() {} }); await tick();
      });
    } else await act(async () => { callback(name === 'change' ? { target: { value: '987' } } : undefined); await tick(); });
    assert.deepEqual(authority(), before, `${label}: stale ${name} retains authority`);
    assert.deepEqual(current().drafts, beforeDrafts, `${label}: stale ${name} retains drafts`);
    assert.deepEqual(values(), beforeValues, `${label}: stale ${name} retains current fields`);
    assert.deepEqual(errors(), beforeErrors, `${label}: stale ${name} is an error-free no-op`);
    assert.equal(commands(), beforeCommands); assert.equal(countCalls('stage'), stages);
    assert.equal(countCalls('apply'), applies); assert.equal(countCalls('discard'), discards);
    assertPanel('sketch');
  }
  console.log(JSON.stringify({ control: label, callbacks: Object.keys(callbacks), controllerLifetimes: sessions.length,
    generation: current().generation, drafts: beforeDrafts }));
}
const baselineGeometry = () => {
  const snapshot = current();
  assert.equal(snapshot.display.packet.profile, 'model-outputs');
  assert.equal(snapshot.display.packet.components.length, 1);
  for (const name of ['mesh', 'boundaries', 'internalDiagonals', 'report']) {
    assert.deepEqual(snapshot.display.packet.components[0][name], baseline.preview[name], `Genuine baseline replay: ${name}`);
  }
  assert.equal(snapshot.display.scene.geometries[0].positions.length, 24 * 3);
  assert.equal(snapshot.display.scene.geometries[0].indices.length, 12 * 3);
};
const proofPaths = ['packages/barocss-cad-editor/src/modeling-sketch-command.ts',
  'packages/barocss-cad-editor/src/react/modeling-editor.tsx',
  'packages/barocss-cad-editor/src/react/modeling-workspace.tsx',
  'packages/barocss-cad-editor/src/modeling-rectangular-part.ts',
  'packages/barocss-cad-editor/src/modeling-controller.ts',
  'packages/barocss-cad-editor/src/modeling-engine.ts',
  'packages/barocss-cad-editor/src/modeling-scene.ts',
  'packages/barocss-cad-editor/src/prism-feature-controller.ts',
  'apps/cad-editor/flows/modeling-sketch-command-flow.mjs'];
const sourceHashes = Object.fromEntries(proofPaths.map(path => [path, hash(readFileSync(resolve(root, path)))]));
console.log(JSON.stringify({ status: 'START', issue: 1957, sourceHashes, fixtureSHA256: hash(fixtureBytes),
  limits: { groups: 16, reactRoots: 1, maximumControllerLifetimes: 3, maximumReplies: 24, nativeCalls: 0 } }));
let viewport, activePort, initialCallbacks, initialAuthority;
try {
  await group('exact retained #1835 baseline, actual imports and adapted #1951 rectangle', () => {
    assert.equal(fixtureBytes.length, 292980); assert.equal(hash(fixtureBytes), fixtureHash);
    assert.equal(signedJSON(authored), baseline.text);
    assert.deepEqual(baseline.parameters, { width: 32, height: 24, lockY: 0 });
    assert.equal(hash(defaultText), defaultHash);
    assert.deepEqual(defaultData.parameters, { width: 32, height: 24, thickness: 8 });
    assert.deepEqual(defaultData.nodes, [
      { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'width' }, { parameter: 'height' }] },
      { kind: 'extrude', sketch: 0, height: { parameter: 'thickness' } },
    ]);
    for (const suffix of ['react/modeling-editor.tsx', 'react/modeling-workspace.tsx', 'modeling-sketch-command.ts',
      'modeling-extrusion-command.ts', 'modeling-rectangular-part.ts', 'modeling-controller.ts', 'modeling-scene.ts',
      'prism-feature-controller.ts', 'react/ui/button.tsx', 'react/ui/input.tsx', 'react/ui/label.tsx']) {
      assert.ok(ui.inputs.some(path => path.endsWith(suffix)), `Actual source bundled: ${suffix}`);
    }
    assert.ok(engine.inputs.some(path => path.endsWith('modeling-engine.ts')));
    assert.equal(stats.nativeCalls, 0); assert.equal(sessions.length, 0); assert.equal(stats.replies, 0);
    console.log(JSON.stringify({ control: 'adapted-public-source', sha256: defaultHash, nativeMeasured: false }));
  });
  await group('coordinate direct/literal/derived/deduplicated projection and unsupported guards', () => {
    assert.deepEqual(project(projectionSnapshot(), 0), { index: 0, label: 'Sketch 01', parameters: ['width', 'height'], fields: [
      { label: 'Min X', kind: 'literal', value: 0 }, { label: 'Min Y', kind: 'literal', value: 0 },
      { label: 'Max X', kind: 'parameter', parameter: 'width' }, { label: 'Max Y', kind: 'parameter', parameter: 'height' },
    ] });
    const shared = project(projectionSnapshot(variants['non-origin-shared']), 0);
    assert.deepEqual(shared.parameters, ['originX', 'width']);
    assert.deepEqual(shared.fields, [{ label: 'Min X', kind: 'parameter', parameter: 'originX' },
      { label: 'Min Y', kind: 'literal', value: -4 }, { label: 'Max X', kind: 'parameter', parameter: 'width' },
      { label: 'Max Y', kind: 'parameter', parameter: 'width' }]);
    const derived = project(projectionSnapshot(variants['literal-derived']), 0);
    assert.deepEqual(derived.parameters, []);
    assert.deepEqual(derived.fields, [{ label: 'Min X', kind: 'literal', value: -5 }, { label: 'Min Y', kind: 'derived' },
      { label: 'Max X', kind: 'derived' }, { label: 'Max Y', kind: 'literal', value: 24 }]);
    const snapshot = projectionSnapshot();
    for (const index of [null, undefined, -1, 1, 2, 0.5, NaN]) assert.equal(project(snapshot, index), null);
    for (const text of [baseline.text, variants['unsupported-profile'], '{', 'null'])
      assert.equal(project({ ...snapshot, authoredText: text }, 0), null);
    assert.equal(project(null, 0), null); assert.equal(project({ ...snapshot, accepted: null }, 0), null);
    assert.equal(project({ ...snapshot, accepted: { ...snapshot.accepted, source: 'legacy' } }, 0), null);
    const wrongKind = structuredClone(snapshot); wrongKind.accepted.features[0].kind = 'extrude';
    assert.equal(project(wrongKind, 0), null);
    for (const update of [data => { data.nodes[0] = { kind: 'sketch', profile: 'circle', center: [0, 0], radius: 8 }; },
      data => { data.nodes[0].min = [0]; }, data => { data.nodes[0].max = [0, 1, 2]; },
      data => { data.nodes[0].min = null; }, data => { data.nodes[0].max[0] = { parameter: 'unknown' }; },
      data => { data.nodes[0].max[0] = { parameter: 'width', extra: true }; },
      data => { data.nodes[0].max[0] = null; }, data => { data.nodes[0].max[0] = '32'; },
      data => { data.nodes[0].max[0] = { op: 'subtract', left: 32, right: 1 }; },
      data => { data.nodes[0].max[0] = { op: 'add', left: 1 }; },
      data => { data.nodes[0].max[0] = { op: 'add', left: 1, right: { parameter: 'unknown' } }; },
      data => { data.nodes[0].max[0] = { op: 'scale', value: { parameter: 'width' }, factor: '2' }; },
      data => { data.nodes[0].max[0] = { op: 'scale', value: { parameter: 'width' }, factor: 2, extra: true }; },
      data => { data.nodes[0].max[0] = { op: 'add', left: [1], right: 2 }; },
      data => { let term = 1; for (let depth = 0; depth < 7; depth++) term = { op: 'scale', value: term, factor: 1 }; data.nodes[0].max[0] = term; },
      data => { let term = 1; for (let depth = 0; depth < 5; depth++) term = { op: 'add', left: term, right: term }; data.nodes[0].max[0] = term; },
      data => { data.format = 'not-a-model'; }, data => { data.schema = 2; }, data => { data.units = 'in'; }]) {
      const data = structuredClone(defaultData); update(data);
      assert.equal(project(projectionSnapshot(signedJSON(data)), 0), null);
    }
    const nonfinite = projectionSnapshot(); nonfinite.accepted.parameters.width = Infinity;
    assert.equal(project(nonfinite, 0), null);
  });
  await group('current-target source, generation and unrelated-draft ownership guards', () => {
    const snapshot = projectionSnapshot(), target = { index: 0, authoredText: snapshot.authoredText, generation: snapshot.generation };
    assert.deepEqual(commandCurrent(snapshot, target), project(snapshot, 0));
    assert.deepEqual(commandCurrent({ ...snapshot, selection: 1, drafts: { width: '40', height: '25' } }, target), project(snapshot, 0));
    assert.equal(commandCurrent({ ...snapshot, drafts: { thickness: '9' } }, target), null);
    assert.equal(commandCurrent({ ...snapshot, drafts: { width: '40', thickness: '9' } }, target), null);
    assert.equal(commandCurrent({ ...snapshot, authoredText: snapshot.authoredText + ' ' }, target), null);
    assert.equal(commandCurrent({ ...snapshot, generation: snapshot.generation + 1 }, target), null);
    assert.equal(commandCurrent(null, target), null); assert.equal(commandCurrent(snapshot, null), null);
    assert.equal(stats.replies, 0); assert.equal(sessions.length, 0);
  });
  await group('selected rectangle opens direct coordinate fields with one persistent viewport', async () => {
    await mount({ workspace: true }); viewport = testid('modeling-viewport'); activePort = port();
    assert.ok(viewport); assert.equal(activePort.host, viewport); assert.deepEqual(observer().observed, [viewport]);
    assertClosed(); assert.deepEqual(JSON.parse(current().authoredText), defaultData); baselineGeometry();
    assert.ok(!button('Edit sketch dimensions') || button('Edit sketch dimensions').disabled);
    await select(1); assert.ok(!button('Edit sketch dimensions') || button('Edit sketch dimensions').disabled);
    await select(0); assert.equal(button('Edit sketch dimensions').disabled, false);
    const menu = button('Edit sketch dimensions').closest('details'); assert.match(menu.querySelector('summary').textContent, /MODIFY/);
    assert.ok(button('Edit model dimensions')); await edit();
    assert.equal(width().value, '32'); assert.equal(profileHeight().value, '24');
    assert.equal(panel('sketch').querySelectorAll('input').length, 2);
    assert.equal(visible(input('thickness (mm)')), false);
    assert.match(panel('sketch').textContent, /Sketch 01/); assert.match(panel('sketch').textContent, /Min X/);
    assert.match(panel('sketch').textContent, /Min Y/); assert.match(panel('sketch').textContent, /read-only/);
    assert.match(panel('sketch').textContent, /shared|other.*uses|other.*features|wherever/i);
    assert.equal(applyButton().disabled, true); assert.equal(sessions.length, 1);
    initialCallbacks = capture(); initialAuthority = authority();
  });
  await group('stage and Apply use the actual controller, engine serializer and receiver', async () => {
    const before = authority(), beforeCommands = commands(), commits = activePort.commits;
    await change(width(), '40'); assert.deepEqual(current().drafts, { width: '40' });
    assert.deepEqual(authority(), before); assert.equal(commands(), beforeCommands); assert.equal(activePort.commits, commits);
    const generation = current().generation; await click(applyButton());
    assert.equal(current().busy, true); assertPanel('sketch'); assert.equal(current().accepted.parameters.width, 32);
    assert.equal(commands(), beforeCommands + 1); assert.equal(activePort.commits, commits);
    await settled(); assertClosed(); assertWorkspaceFocus();
    assert.equal(current().accepted.parameters.width, 40); assert.equal(current().accepted.parameters.thickness, 8);
    assert.equal(JSON.parse(current().authoredText).parameters.width, 40);
    assert.deepEqual(JSON.parse(current().authoredText).nodes, defaultData.nodes);
    assert.equal(current().generation, generation + 1); assert.equal(current().history.count, 2);
    assert.deepEqual(current().drafts, {}); assert.equal(activePort.commits, commits + 1); baselineGeometry();
  });
  await group('Undo and Redo restore accepted authored history through focused workspace keys', async () => {
    assertWorkspaceFocus(); assert.equal((await key(document.activeElement, 'z', { ctrlKey: true })).defaultPrevented, true);
    await settled(); assert.equal(current().accepted.parameters.width, 32); assert.equal(current().history.canRedo, true);
    assert.equal((await key(document.activeElement, 'z', { metaKey: true, shiftKey: true })).defaultPrevented, true);
    await settled(); assert.equal(current().accepted.parameters.width, 40); assert.equal(current().history.canRedo, false);
    assert.equal(current().history.count, 2); assert.equal(current().accepted.parameters.thickness, 8); baselineGeometry();
  });
  await group('Cancel, Escape, canonical no-op and repeat/IME/modifier keyboard guards', async () => {
    await select(0); const before = authority(), beforeCommands = commands();
    await edit(); await change(width(), '41'); await click(button('Cancel'));
    assertClosed(); assertWorkspaceFocus(); assert.deepEqual(current().drafts, {}); assert.deepEqual(authority(), before);
    await edit(); await change(width(), '42');
    for (const fields of [{ repeat: true }, { isComposing: true }, { keyCode: 229 }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
      for (const name of ['Enter', 'Escape']) {
        assert.equal((await key(width(), name, fields)).defaultPrevented, false);
        assertPanel('sketch'); assert.deepEqual(current().drafts, { width: '42' });
      }
    }
    assert.equal((await key(width(), 'z', { ctrlKey: true })).defaultPrevented, false);
    assert.equal((await key(width(), 'Escape')).defaultPrevented, true);
    assertClosed(); assertWorkspaceFocus(); assert.deepEqual(current().drafts, {}); assert.deepEqual(authority(), before);
    await edit(); await change(width(), '4e1'); await click(applyButton());
    assertClosed(); assert.deepEqual(current().drafts, {}); assert.deepEqual(authority(), before); assert.equal(commands(), beforeCommands);
  });
  await group('unrelated drafts before and after opening cannot be silently applied or discarded', async () => {
    const before = authority(), beforeCommands = commands();
    await staged('thickness', '9'); await click(button('Edit sketch dimensions'));
    assertPanel('dimensions'); assert.deepEqual(current().drafts, { thickness: '9' });
    assert.ok(visible(input('thickness (mm)'))); assert.equal(input('thickness (mm)').value, '9');
    assert.equal(testid('modeling-options').querySelector(':scope > header h2').textContent, 'Edit model dimensions');
    // The current global Cancel is allowed to discard this explicitly visible global draft.
    await click(button('Cancel')); assertClosed(); assert.deepEqual(current().drafts, {});
    await edit(); await change(width(), '43'); const callbacks = capture(); await staged('thickness', '10');
    assertPanel('sketch'); assert.equal(width().disabled, true); assert.equal(applyButton().disabled, true);
    const drafts = current().drafts, stages = countCalls('stage'), applies = countCalls('apply');
    await act(async () => { callbacks.change({ target: { value: '44' } }); callbacks.apply(); await tick(); });
    await key(width(), 'Enter'); await click(applyButton());
    assert.deepEqual(current().drafts, drafts); assert.equal(countCalls('stage'), stages); assert.equal(countCalls('apply'), applies);
    await click(button('Cancel')); assertClosed(); assert.deepEqual(current().drafts, drafts);
    assert.deepEqual(authority(), before); assert.equal(commands(), beforeCommands); await discard();
  });
  await group('provider refusal keeps accepted state, editable drafts and command before recovery', async () => {
    await edit(); const before = authority(), commits = activePort.commits;
    await change(width(), '-1'); await click(applyButton()); await settled();
    assertPanel('sketch'); assert.equal(width().value, '-1'); assert.deepEqual(current().drafts, { width: '-1' });
    assert.match(current().error, /Controlled provider refusal/); assert.deepEqual(authority(), before);
    assert.equal(activePort.commits, commits); assert.equal(applyButton().disabled, false);
    assert.ok(errors().some(text => /Controlled provider refusal/.test(text)));
    await change(width(), '44'); await click(applyButton()); await settled();
    assertClosed(); assert.equal(current().accepted.parameters.width, 44); assert.equal(current().error, null);
    assert.deepEqual(current().drafts, {}); baselineGeometry();
  });
  await group('Browser selection and mount-time layout changes preserve the pinned Sketch target', async () => {
    await select(0); await edit(); const before = authority(), beforeCommands = commands(), commits = activePort.commits;
    const originalField = width(), session = sessions.at(-1).controller;
    await change(width(), '45'); await select(1);
    assert.equal(width(), originalField); assert.equal(width().value, '45'); assert.match(panel('sketch').textContent, /Sketch 01/);
    assert.equal(applyButton().disabled, false);
    for (const workspace of [false, true]) {
      await rerender({ workspace });
      assert.equal(testid('modeling-viewport'), viewport); assert.equal(width(), originalField);
      assert.equal(sessions.at(-1).controller, session); assert.equal(port(), activePort);
      assert.deepEqual(authority(), before); assert.deepEqual(current().drafts, { width: '45' });
      assert.equal(commands(), beforeCommands); assert.equal(activePort.commits, commits);
    }
    await click(button('Cancel')); assertClosed(); await select(0);
  });
  await group('same-source generation replacement invalidates old mutation and close callbacks', async () => {
    await edit(); const callbacks = capture(), text = current().authoredText, generation = current().generation;
    await openText(text); assert.equal(current().generation, generation + 1); assertPanel('sketch');
    assert.equal(panel('sketch').querySelectorAll('input').length, 0); assert.match(panel('sketch').textContent, /stale/i);
    assert.equal(applyButton().disabled, true); await staged('width', '46');
    await assertStale(callbacks, 'same-source-new-generation');
    await key(testid('modeling-options').querySelector(':scope > header h2'), 'Escape');
    assertClosed(); assert.deepEqual(current().drafts, { width: '46' });
    await select(0); await edit(); assert.equal(width().value, '46'); await click(button('Cancel'));
    assert.deepEqual(current().drafts, {});
  });
  await group('A-to-B-to-A prop replacement invalidates prior controller callbacks', async () => {
    const callbacks = initialCallbacks;
    const original = sessions.at(-1), originalPort = activePort, originalObserver = observer();
    await rerender({ workspace: true, initialAuthoredText: variants['prop-B'] }); await settled();
    assertClosed(); assert.equal(current().accepted.parameters.width, 35);
    await rerender({ workspace: true, initialAuthoredText: defaultText }); await settled();
    assertClosed(); assert.equal(current().accepted.parameters.width, 32);
    assert.equal(current().generation, initialAuthority.generation);
    assert.equal(current().authoredText, initialAuthority.authoredText, 'ABA must match the original callback source and generation');
    assert.equal(sessions.length, 3); assert.equal(mountedRoots, 1);
    assert.notEqual(sessions.at(-1).controller, original.controller); assert.equal(original.controller.getSnapshot().disposed, true);
    assert.equal(originalPort.disposals, 1); assert.equal(originalObserver.disconnections, 1);
    assert.equal(displays[1].disposals, 1); assert.equal(observers[1].disconnections, 1);
    assert.equal(workers[0].terminated, true); assert.equal(workers[1].terminated, true);
    activePort = port(); assert.equal(testid('modeling-viewport'), viewport); baselineGeometry();
    await select(0); await edit(); await change(width(), '47');
    await assertStale(callbacks, 'prior-controller-ABA');
    await click(button('Cancel')); assertClosed(); assert.deepEqual(current().drafts, {});
  });
  await group('Cancel and reopen reject captured prior-command instance callbacks', async () => {
    await edit(); const callbacks = capture(); await change(width(), '48'); await click(button('Cancel'));
    assertClosed(); await edit(); await change(width(), '49');
    await assertStale(callbacks, 'prior-command-instance');
    await click(button('Cancel')); assertClosed(); assert.deepEqual(current().drafts, {});
  });
  await group('non-origin min/max, shared global driver, read-only terms and generic fallback', async () => {
    await openText(variants['non-origin-shared']); await select(0); await edit();
    assert.equal(originX().value, '-5'); assert.equal(width().value, '32');
    assert.equal(panel('sketch').querySelectorAll('input').length, 2);
    assert.ok(input('Max X / Max Y · width (mm)')); assert.match(panel('sketch').textContent, /Min Y/);
    assert.match(panel('sketch').textContent, /-4 mm/); assert.match(panel('sketch').textContent, /shared|other.*features|wherever/i);
    assert.equal(visible(input('Width (mm)')), false, 'Non-origin coordinate is never relabeled Width');
    const nodes = JSON.parse(current().authoredText).nodes;
    await change(originX(), '-7'); await change(width(), '40'); await click(applyButton()); await settled(); assertClosed();
    assert.equal(current().accepted.parameters.originX, -7); assert.equal(current().accepted.parameters.width, 40);
    assert.deepEqual(JSON.parse(current().authoredText).nodes, nodes);
    await edit(); await change(originX(), '0'); await click(applyButton()); await settled(); assertClosed();
    assert.equal(current().accepted.parameters.originX, 0, 'Signed coordinate editing admits zero without positive-only New part validation');
    assert.deepEqual(nodes[0].max, [{ parameter: 'width' }, { parameter: 'width' }]);
    assert.deepEqual(nodes[1].height, { parameter: 'width' }, 'The same named parameter still drives another feature globally');
    baselineGeometry(); await openText(variants['literal-derived']); await select(0); await edit();
    assert.equal(panel('sketch').querySelectorAll('input').length, 0); assert.equal(applyButton().disabled, true);
    for (const label of ['Min X', 'Min Y', 'Max X', 'Max Y']) assert.match(panel('sketch').textContent, new RegExp(label));
    assert.match(panel('sketch').textContent, /Derived expression/); assert.match(panel('sketch').textContent, /read-only/);
    await click(button('Review model dimensions')); assertPanel('dimensions');
    assert.ok(visible(input('width (mm)'))); assert.ok(visible(input('height (mm)'))); await click(button('Cancel'));
    await openText(baseline.text); await select(0);
    assert.ok(!button('Edit sketch dimensions') || button('Edit sketch dimensions').disabled);
    await click(button('Edit dimensions')); assertPanel('dimensions');
    assert.ok(visible(input('Profile X width (mm)'))); assert.ok(visible(input('Profile Y height (mm)')));
    await click(button('Cancel')); await openText(variants['unsupported-profile']); await select(0);
    assert.ok(!button('Edit sketch dimensions') || button('Edit sketch dimensions').disabled);
    await click(button('Edit model dimensions')); assertPanel('dimensions');
    assert.ok(visible(input('width (mm)'))); assert.ok(visible(input('thickness (mm)'))); await click(button('Cancel'));
    await openText(defaultText); await select(0);
  });
  await group('late and canceled Apply completions cannot close newer options', async () => {
    await edit(); await change(width(), '50'); await click(applyButton());
    await click(button('Save or open a model')); assertPanel('files');
    await settled(); assertPanel('files'); assert.equal(current().accepted.parameters.width, 50);
    await edit(); await change(width(), '51'); activePort.holdNext = true; await click(applyButton());
    await act(async () => { workers.at(-1).accept(); await tick(); });
    assert.equal(typeof activePort.release, 'function'); assert.equal(current().busy, true);
    const before = authority(), commits = activePort.commits;
    await click(button('Cancel computation')); assert.equal(current().busy, false);
    await click(button('Cancel')); await edit(); await change(width(), '52');
    await act(async () => { activePort.release(); await tick(); });
    assertPanel('sketch'); assert.equal(width().value, '52'); assert.deepEqual(current().drafts, { width: '52' });
    assert.deepEqual(authority(), before); assert.equal(activePort.commits, commits);
    await click(applyButton()); await settled(); assertClosed(); assert.equal(current().accepted.parameters.width, 52); baselineGeometry();
  });
  await group('New part, File and STL remain reachable and disposal ignores late completion', async () => {
    await click(button('New rectangular part')); assertPanel('new-part');
    assert.equal(input('Width (mm)').value, '32'); assert.ok(button('Replace current model')); await click(button('Cancel'));
    await click(button('Save or open a model')); assertPanel('files');
    const picker = container.querySelector('input[type="file"]'); assert.ok(picker); assert.match(picker.accept, /\.cad\.json/);
    assert.ok(button('Choose model file')); assert.ok(button('Download model'));
    await click(button('Show saved model')); assert.equal(input('Saved model data').value, current().authoredText);
    assert.equal(button('Open saved model').disabled, true);
    await click(button('Export accepted STL')); assertPanel('outputs');
    const chooser = input('STL output'); assert.ok(chooser); assert.equal(button('Download STL').disabled, true);
    assert.ok([...chooser.options].some(option => option.value === 'part' && !option.disabled));
    await click(button('Edit model dimensions')); assertPanel('dimensions');
    assert.ok(visible(input('width (mm)'))); assert.ok(visible(input('height (mm)'))); assert.ok(visible(input('thickness (mm)')));
    await click(button('Cancel')); await select(1); await click(button('Edit extrusion')); assertPanel('extrusion');
    const extrusionThickness = () => input('Height · thickness (mm)');
    await change(extrusionThickness(), '9'); assert.equal((await key(extrusionThickness(), 'Escape')).defaultPrevented, true);
    assertClosed(); assert.deepEqual(current().drafts, {}); assert.equal(current().accepted.parameters.thickness, 8);
    await click(button('Edit extrusion')); await change(extrusionThickness(), '9');
    assert.equal((await key(extrusionThickness(), 'Enter')).defaultPrevented, true); await settled();
    assertClosed(); assert.equal(current().accepted.parameters.thickness, 9); baselineGeometry();
    await select(0); await edit(); await change(width(), '53');
    const beforeCommands = commands(); activePort.holdNext = true;
    assert.equal((await key(width(), 'Enter')).defaultPrevented, true); assert.equal(current().busy, true);
    assert.equal(commands(), beforeCommands + 1); assert.equal(width().disabled, true);
    assert.equal(applyButton().disabled, true); assert.equal(button('Cancel').disabled, true); assert.equal(button('Close options').disabled, true);
    await click(applyButton()); await key(width(), 'Enter'); await key(width(), 'Escape');
    assert.equal(commands(), beforeCommands + 1); assertPanel('sketch');
    await act(async () => { observer().callback([{ target: viewport }]); workers.at(-1).accept(); await tick(); });
    assert.equal(activePort.resizes, 1); assert.equal(typeof activePort.release, 'function');
    const commits = activePort.commits, pendingWorker = workers.at(-1), acceptedReply = structuredClone(pendingWorker.lastReply);
    assert.equal(testid('modeling-viewport'), viewport); assert.equal(sessions.length, 3); await unmount();
    assert.equal(activePort.disposals, 1); assert.equal(observer().disconnections, 1); assert.equal(countCalls('dispose'), 1);
    await act(async () => { activePort.release(); await tick(); });
    assert.equal(activePort.commits, commits); assert.equal(container.childElementCount, 0);
    assert.equal(sessions.at(-1).controller.getSnapshot().disposed, true); assert.equal(pendingWorker.terminated, true);
    const disposed = current();
    // A duplicate delivered reply after disposal also has no authority. This replays an
    // already computed message rather than running any new engine/native operation.
    assert.ok(++stats.replies <= 24); pendingWorker.callbacks.get('message')({ data: structuredClone(acceptedReply) });
    assert.deepEqual(current(), disposed); assert.equal(activePort.commits, commits);
    assert.equal(activePort.candidateDisposals, activePort.prepares);
  });
} finally {
  if (reactRoot) await unmount();
  for (const record of displays) if (record.release) record.release();
  dom.window.close();
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  }
}
assert.equal(groups.length, 16); assert.equal(mountedRoots, 1); assert.equal(sessions.length, 3);
assert.equal(displays.length, 3); assert.equal(observers.length, 3); assert.ok(stats.replies <= 24); assert.equal(stats.nativeCalls, 0);
console.log(JSON.stringify({ status: 'PASS', issue: 1957, node: process.version,
  runner: { executable: process.execPath, argv: process.argv.slice(1), command: [process.execPath, ...process.argv.slice(1)].map(value => JSON.stringify(value)).join(' ') },
  groups, mountedRoots, controllerLifetimes: sessions.length, ...stats, sourceHashes,
  fixture: { path: fixturePath, sha256: fixtureHash }, adaptedDefaultSourceSHA256: defaultHash,
  syntheticAuthoredVariants: Object.keys(variants),
  boundary: 'Actual mounted React, host controls, modeling controller, engine serializer, receiver and CPU scene. Controlled provider, Worker, ResizeObserver and display port. The #1951 three-driver rectangle and all coordinate variants are authored adaptations; every reply reuses genuine #1835 convex baseline geometry. Zero native calls. Edited-state native geometry, WebGPU pixels, physical browser file/download acceptance UNRUN.' }));
