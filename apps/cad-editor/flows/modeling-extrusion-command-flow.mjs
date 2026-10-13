// #1948: one React root, three controller lifetimes + actual controller, serializer and CPU receiver.
// Provider, Worker, ResizeObserver and display-port execution are explicit controlled boundaries.
// Geometry is the genuine retained round-post baseline for EVERY reply, including edited parameters.
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
const fixturePath = 'packages/barocss-cad/test/modeling-circle-evidence/baseline-transfer.json';
const fixtureBytes = readFileSync(resolve(root, fixturePath));
const fixtureHash = '7338e8c36033d6a324760c9fc101d9509b73e89f223246395250c83cee6cc4e8';
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
  await run(); groups.push(name);
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
    // Synthetic authored variants below still reuse the original native body, never edited geometry.
    bodies: Object.fromEntries(Object.keys(data.outputs).map(name => [name, structuredClone(baseline.bodies.post)])),
    save: () => signedJSON(data),
    withParameters(changes) {
      stats.providerEdits++;
      const parameters = { ...data.parameters, ...changes };
      if (parameters.height <= 0) throw Error('Controlled provider refusal: height must be positive.');
      return providerSnapshot({ ...data, parameters });
    },
    withSuppression: forbidden,
  };
}
setGlobal('__modelingExtrusionFlow', {
  cad: { model: forbidden, load(text) { stats.providerLoads++; return providerSnapshot(JSON.parse(text)); } },
  tessellateXYCirclePrismShell(bundle, options) {
    assert.deepEqual(bundle, baseline.bodies.post.native.parent.bundle);
    assert.equal(options.segmentsPerQuarter, 4);
    stats.previewReplays++;
    const preview = structuredClone(baseline.preview);
    // Only request identity/revision metadata changes; all geometry and native proofs are baseline.
    preview.packet.surfaceId = options.meshId; preview.packet.revision = options.revision;
    preview.report.meshId = options.meshId; preview.report.revision = options.revision;
    return preview;
  },
  tessellateConvexPlanarSolid: forbidden, tessellateSurface: forbidden, tessellateOwnPlateCircularHole: forbidden,
  controller(create, ...args) {
    assert.ok(sessions.length < 3, 'Frozen three-controller-lifetime ceiling');
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
const boundaryPlugin = { name: 'explicit-extrusion-command-boundaries', setup(build) {
  build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\.\/modeling-controller\.js$/ }, () => ({ path: 'controller', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\.\/prism-feature-display\.js$/ }, () => ({ path: 'display', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'workspace-boundary' }));
  build.onLoad({ filter: /.*/, namespace: 'workspace-boundary' }, ({ path }) => ({ resolveDir: root, contents: {
    provider: 'export const {cad,tessellateConvexPlanarSolid,tessellateSurface,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell} = globalThis.__modelingExtrusionFlow;',
    legacy: 'export function createPrismFeatureEngine() { return () => { throw Error("Legacy native execution is outside this flow."); }; }',
    controller: `import {createCadEditorModelingController as create} from ${JSON.stringify(source('modeling-controller.ts'))}; export const createCadEditorModelingController = (...args) => globalThis.__modelingExtrusionFlow.controller(create, ...args);`,
    display: 'export const createPrismFeatureDisplay = globalThis.__modelingExtrusionFlow.display;',
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
    assert.ok(++stats.replies <= 20, 'Frozen twenty-worker-reply ceiling');
    this.answered.add(command.id);
    const reply = this.engine(command);
    this.callbacks.get('message')({ data: structuredClone(reply) }); return reply;
  }
});
const React = require('react'), { createRoot } = require('react-dom/client'), { act } = React;
const ui = await bundle('react/modeling-editor.tsx');
const projection = await bundle('modeling-extrusion-command.ts');
const { projectExtrusionCommand: project, extrusionCommandCurrent: commandCurrent } = projection.api;
const container = document.getElementById('root');
let reactRoot, mountedRoots = 0;
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const current = () => sessions.at(-1).controller.getSnapshot();
const port = () => displays.at(-1);
const observer = () => observers.at(-1);
const buttons = () => [...container.querySelectorAll('button')];
const button = label => buttons().find(node => (node.getAttribute('aria-label') ?? node.textContent.trim()) === label);
const testid = name => container.querySelector(`[data-testid="${name}"]`);
const input = label => {
  const node = [...container.querySelectorAll('label')].find(node => node.textContent.trim() === label);
  return node ? document.getElementById(node.htmlFor) : null;
};
const height = () => input('Height · height (mm)') ?? input('Height / Start Z · height (mm)');
const startZ = () => input('Start Z · centerX (mm)');
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
  assert.ok(++mountedRoots <= 1, 'Frozen one-React-root-mount ceiling');
  reactRoot = createRoot(container);
  await act(async () => { reactRoot.render(React.createElement(ui.api.CadEditorModeling, { initialAuthoredText: baseline.text, ...props })); await tick(); });
  await settled();
}
async function rerender(props) {
  await act(async () => { reactRoot.render(React.createElement(ui.api.CadEditorModeling, { initialAuthoredText: baseline.text, ...props })); await tick(); });
}
const focusedKey = (name, fields = {}) => {
  assert.ok(container.contains(document.activeElement), 'Keyboard target must be the actual focused editor element');
  return key(document.activeElement, name, fields);
};
async function unmount() {
  await act(async () => { reactRoot.unmount(); await tick(); }); reactRoot = null;
}

// Projection-only controls and recipe replacements are synthetic authored data.
// They qualify command routing only, never native validity or edited geometry.
const variants = {};
function variant(name, update) {
  const data = structuredClone(authored); update(data);
  variants[name] = signedJSON(data); return variants[name];
}
variant('direct-start', data => { data.nodes[1].from = { parameter: 'centerX' }; });
variant('deduplicated-driver', data => { data.nodes[1].from = { parameter: 'height' }; });
variant('literal-only', data => { data.nodes[1].height = 6; data.nodes[1].from = -2; });
variant('derived-only', data => {
  data.nodes[1].height = { op: 'scale', value: { parameter: 'height' }, factor: 2 };
  data.nodes[1].from = { op: 'add', left: { parameter: 'centerX' }, right: 1 };
});
function projectionSnapshot(text = baseline.text, patch = {}) {
  const data = JSON.parse(text);
  return { accepted: { documentId: 'cad_model', revision: 0, source: 'model', parameters: data.parameters,
    features: structuredClone(baseline.features), outputs: [{ name: 'post', solidId: 'm1_shell', family: 'stored-rational-circle-prism', volumeMM3: null }] },
  authoredText: text, drafts: {}, selection: 1, generation: 1, busy: false, disposed: false, error: null,
  display: null, faceSelection: null, workerReady: true, history: { index: 0, count: 1, canUndo: false, canRedo: false }, ...patch };
}
const visible = node => !!node && !node.closest('[hidden]');
const panel = name => testid(`modeling-panel-${name}`);
const assertPanel = name => {
  assert.ok(visible(testid('modeling-options')), 'Options panel must be visible');
  assert.ok(visible(panel(name)), `${name} panel must be visible`);
};
const assertClosed = () => assert.equal(visible(testid('modeling-options')), false, 'Temporary options must close');
const assertOptionsFocus = () => {
  assert.equal(document.activeElement, testid('modeling-options').querySelector(':scope > header h2'));
  assert.ok(visible(document.activeElement));
};
const assertWorkspaceFocus = () => assert.equal(document.activeElement, testid('modeling-workspace'));
const feature = index => testid('modeling-browser').querySelector(`button[data-feature-index="${index}"]`);
const select = async index => { await click(feature(index)); assert.equal(current().selection, index); };
const edit = async () => {
  await click(button('Edit extrusion')); assertPanel('extrusion'); assertOptionsFocus();
  assert.equal(testid('modeling-options').querySelector(':scope > header h2').textContent, 'Edit extrusion');
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
  assert.equal(current().authoredText, text); assert.equal(current().error, null);
  baselineGeometry();
}
function baselineGeometry() {
  const snapshot = current(), packet = snapshot.display.packet;
  assert.equal(packet.profile, 'model-body-faces'); assert.equal(packet.components.length, 1);
  const component = packet.components[0];
  assert.equal(component.family, 'stored-rational-circle-prism');
  const expected = structuredClone(baseline.preview);
  expected.packet.surfaceId = 'modeling_circle_post'; expected.packet.revision = snapshot.accepted.revision;
  expected.report.meshId = 'modeling_circle_post'; expected.report.revision = snapshot.accepted.revision;
  assert.deepEqual(component.preview, expected, 'Every response reuses the genuine baseline geometry and proofs');
  assert.deepEqual(component.qualification, baseline.bodies.post.native.certificate);
  assert.equal(component.mesh.chunks.reduce((count, chunk) => count + chunk.positionsMM.length / 3, 0), 98);
  assert.equal(component.mesh.chunks.reduce((count, chunk) => count + chunk.indices.length / 3, 0), 64);
}
const countCalls = name => sessions.at(-1).calls.filter(call => call.name === name).length;
// Keep the actual React callback to model an already queued event after its field disappears.
// This is a controlled event-boundary probe; no product callback or controller is substituted.
const reactCallback = (node, name) => {
  const key = Object.keys(node).find(key => key.startsWith('__reactProps$'));
  assert.ok(key && typeof node[key][name] === 'function', `Actual React ${name} callback must exist`);
  return node[key][name];
};
let viewport, firstPort;
try {
  await group('pinned genuine circle baseline and actual React/controller/serializer/receiver imports', () => {
    assert.equal(fixtureBytes.length, 81412); assert.equal(hash(fixtureBytes), fixtureHash);
    assert.equal(signedJSON(authored), baseline.text);
    assert.deepEqual(baseline.parameters, { centerX: 2, centerY: -3, diameter: 8, height: 6 });
    for (const suffix of ['react/modeling-editor.tsx', 'react/modeling-workspace.tsx', 'modeling-extrusion-command.ts',
      'modeling-controller.ts', 'modeling-scene.ts', 'modeling-circle.ts', 'prism-feature-controller.ts',
      'react/ui/button.tsx', 'react/ui/input.tsx', 'react/ui/label.tsx']) {
      assert.ok(ui.inputs.some(path => path.endsWith(suffix)), `Actual source bundled: ${suffix}`);
    }
    assert.ok(engine.inputs.some(path => path.endsWith('modeling-engine.ts')));
    assert.ok(engine.inputs.some(path => path.endsWith('modeling-circle.ts')));
  });
  await group('pure direct/default/start-Z/deduplicated/literal/derived projection controls', () => {
    const direct = project(projectionSnapshot(), 1);
    assert.deepEqual(direct, { index: 1, label: 'Extrude 01', parameters: ['height'], fields: [
      { label: 'Height', kind: 'parameter', parameter: 'height' }, { label: 'Start Z', kind: 'literal', value: 0 },
    ] });
    const from = project(projectionSnapshot(variants['direct-start']), 1);
    assert.deepEqual(from.parameters, ['height', 'centerX']);
    assert.deepEqual(from.fields, [{ label: 'Height', kind: 'parameter', parameter: 'height' },
      { label: 'Start Z', kind: 'parameter', parameter: 'centerX' }]);
    const shared = project(projectionSnapshot(variants['deduplicated-driver']), 1);
    assert.deepEqual(shared.parameters, ['height']);
    assert.deepEqual(shared.fields, [{ label: 'Height', kind: 'parameter', parameter: 'height' },
      { label: 'Start Z', kind: 'parameter', parameter: 'height' }]);
    const literal = project(projectionSnapshot(variants['literal-only']), 1);
    assert.deepEqual(literal.parameters, []);
    assert.deepEqual(literal.fields, [{ label: 'Height', kind: 'literal', value: 6 }, { label: 'Start Z', kind: 'literal', value: -2 }]);
    const derived = project(projectionSnapshot(variants['derived-only']), 1);
    assert.deepEqual(derived.parameters, []);
    assert.deepEqual(derived.fields, [{ label: 'Height', kind: 'derived' }, { label: 'Start Z', kind: 'derived' }]);
  });
  await group('pure invalid/legacy/unknown-driver guards and source-generation-draft ownership', () => {
    const snapshot = projectionSnapshot(), target = { index: 1, authoredText: snapshot.authoredText, generation: snapshot.generation };
    for (const index of [null, undefined, -1, 0, 2, 1.5, NaN]) assert.equal(project(snapshot, index), null);
    assert.equal(project(null, 1), null);
    assert.equal(project({ ...snapshot, accepted: null }, 1), null);
    assert.equal(project({ ...snapshot, accepted: { ...snapshot.accepted, source: 'legacy' } }, 1), null);
    const wrongKind = structuredClone(snapshot); wrongKind.accepted.features[1].kind = 'split';
    assert.equal(project(wrongKind, 1), null);
    const missing = structuredClone(authored); missing.nodes[1].height = { parameter: 'unknownHeight' };
    assert.equal(project(projectionSnapshot(signedJSON(missing)), 1), null);
    missing.nodes[1].height = { parameter: 'height' }; missing.nodes[1].from = { parameter: 'unknownStart' };
    assert.equal(project(projectionSnapshot(signedJSON(missing)), 1), null);
    assert.deepEqual(commandCurrent(snapshot, target), project(snapshot, 1));
    assert.deepEqual(commandCurrent({ ...snapshot, selection: 0, faceSelection: null, drafts: { height: '9' } }, target), project(snapshot, 1));
    assert.equal(commandCurrent({ ...snapshot, drafts: { diameter: '9' } }, target), null);
    assert.equal(commandCurrent({ ...snapshot, drafts: { height: '9', diameter: '9' } }, target), null);
    assert.equal(commandCurrent({ ...snapshot, authoredText: snapshot.authoredText + ' ' }, target), null);
    assert.equal(commandCurrent({ ...snapshot, generation: snapshot.generation + 1 }, target), null,
      'Conservative generation pin also rejects exact-source replacement, view-generation changes and ABA');
    assert.equal(stats.replies, 0); assert.equal(sessions.length, 0);
  });
  await group('one mounted workspace exposes the selected extrusion and unchanged global dimensions', async () => {
    await mount({ workspace: true });
    viewport = testid('modeling-viewport'); firstPort = port();
    assert.ok(viewport); assert.equal(firstPort.host, viewport); assert.equal(sessions.length, 1);
    assert.deepEqual(observer().observed, [viewport]); assertClosed();
    assert.equal(current().authoredText, baseline.text); assert.equal(current().history.count, 1);
    assert.ok(!button('Edit extrusion') || button('Edit extrusion').disabled);
    await select(0); assert.ok(!button('Edit extrusion') || button('Edit extrusion').disabled);
    await select(1); assert.equal(button('Edit extrusion').disabled, false);
    assert.ok(button('Edit model dimensions')); await edit();
    assert.equal(height().value, '6'); assert.equal(visible(input('Diameter (mm)')), false);
    assert.match(panel('extrusion').textContent, /Extrude 01/);
    assert.match(panel('extrusion').textContent, /Start Z/);
    assert.match(panel('extrusion').textContent, /shared|other.*uses|all.*uses|wherever/i);
    assert.equal(button('Apply extrusion').disabled, true); baselineGeometry();
  });
  await group('Cancel and reopen rejects callbacks from the prior command instance', async () => {
    const lateStage = reactCallback(height(), 'onChange');
    const lateApply = reactCallback(button('Apply extrusion'), 'onClick');
    const lateCancel = reactCallback(button('Cancel'), 'onClick');
    await click(button('Cancel')); assertClosed(); await edit(); await change(height(), '18');
    const before = authority(), drafts = current().drafts, beforeCommands = commands();
    const stages = countCalls('stage'), applies = countCalls('apply'), discards = countCalls('discard');
    const errorText = () => [...container.querySelectorAll('[role="alert"]')].map(node => node.textContent);
    const errors = errorText();
    await act(async () => { lateCancel(); await tick(); });
    console.log(JSON.stringify({ control: 'command-instance-reopen', draftBefore: drafts,
      draftAfterOldCancel: current().drafts, panelStillOpen: visible(panel('extrusion')) }));
    assert.deepEqual(current().drafts, drafts, 'An old Cancel must not discard a reopened command draft');
    assert.equal(countCalls('discard'), discards); assertPanel('extrusion'); assert.deepEqual(authority(), before);
    assert.deepEqual(errorText(), errors, 'A stale command callback must be an error-free no-op');
    await act(async () => { lateStage({ target: { value: '19' } }); await tick(); });
    assert.deepEqual(current().drafts, drafts); assert.equal(countCalls('stage'), stages); assertPanel('extrusion');
    assert.deepEqual(errorText(), errors); assert.deepEqual(authority(), before);
    await act(async () => { lateApply(); await tick(); });
    assert.equal(current().busy, false); assert.deepEqual(current().drafts, drafts); assert.equal(countCalls('apply'), applies);
    assert.equal(commands(), beforeCommands); assertPanel('extrusion'); assert.deepEqual(authority(), before);
    assert.deepEqual(errorText(), errors);
    await click(button('Cancel')); assertClosed(); assert.deepEqual(current().drafts, {}); await edit();
  });
  await group('A-to-B-to-A prop replacement clears commands and rejects prior-controller callbacks', async () => {
    // A genuine initial source, a synthetic recipe B, then the exact original A.
    // Both replacements use the existing React root and actual initialAuthoredText effect.
    const original = sessions.at(-1), originalPort = firstPort, originalObserver = observer();
    const lateStage = reactCallback(height(), 'onChange');
    const lateApply = reactCallback(button('Apply extrusion'), 'onClick');
    const lateCancel = reactCallback(button('Cancel'), 'onClick');
    assert.equal(current().generation, 1); assert.equal(current().authoredText, baseline.text);
    await rerender({ workspace: true, initialAuthoredText: variants['direct-start'] }); await settled();
    const clearedForB = !visible(testid('modeling-options'));
    assert.equal(current().authoredText, variants['direct-start']); assert.equal(current().generation, 1);
    await rerender({ workspace: true, initialAuthoredText: baseline.text }); await settled();
    const clearedForA = !visible(testid('modeling-options'));
    assert.equal(current().authoredText, baseline.text); assert.equal(current().generation, 1);
    assert.notEqual(sessions.at(-1).controller, original.controller);
    assert.equal(sessions.length, 3); assert.equal(mountedRoots, 1); assert.equal(testid('modeling-viewport'), viewport);
    assert.equal(original.controller.getSnapshot().disposed, true); assert.equal(originalPort.disposals, 1);
    assert.equal(originalObserver.disconnections, 1); assert.equal(displays[1].disposals, 1);
    assert.equal(observers[1].disconnections, 1); assert.equal(workers[0].terminated, true); assert.equal(workers[1].terminated, true);
    firstPort = port(); baselineGeometry();
    await select(1); await edit(); await change(height(), '18');
    const before = authority(), drafts = current().drafts, beforeCommands = commands();
    const stages = countCalls('stage'), applies = countCalls('apply'), discards = countCalls('discard');
    const errorText = () => [...container.querySelectorAll('[role="alert"]')].map(node => node.textContent);
    const errors = errorText();
    await act(async () => { lateStage({ target: { value: '19' } }); await tick(); });
    console.log(JSON.stringify({ control: 'controller-lifetime-ABA', clearedForB, clearedForA,
      mountedRoots, controllerLifetimes: sessions.length, stageBefore: drafts, stageAfter: current().drafts }));
    assert.deepEqual(current().drafts, drafts, 'A queued old-controller stage must not mutate the replacement controller');
    assert.equal(countCalls('stage'), stages); assert.deepEqual(authority(), before); assertPanel('extrusion');
    assert.deepEqual(errorText(), errors, 'A prior-controller callback must be an error-free no-op');
    await act(async () => { lateApply(); await tick(); });
    assert.equal(current().busy, false); assert.deepEqual(current().drafts, drafts);
    assert.equal(countCalls('apply'), applies); assert.equal(commands(), beforeCommands); assert.deepEqual(authority(), before);
    assertPanel('extrusion'); assert.deepEqual(errorText(), errors);
    await act(async () => { lateCancel(); await tick(); });
    assert.deepEqual(current().drafts, drafts); assert.equal(countCalls('discard'), discards); assert.deepEqual(authority(), before);
    assertPanel('extrusion'); assert.deepEqual(errorText(), errors); assert.ok(clearedForB, 'Replacement B must clear the old command');
    assert.ok(clearedForA, 'Returning to source A must not resurrect the old command');
    await click(button('Cancel')); assertClosed(); assert.deepEqual(current().drafts, {}); await edit();
  });
  await group('local stage pins the extrusion despite Browser selection and mount-prop changes', async () => {
    const before = authority(), beforeCommands = commands(), beforeCommits = firstPort.commits;
    const originalField = height(), session = sessions.at(-1).controller;
    await change(height(), '9'); assert.deepEqual(current().drafts, { height: '9' });
    assert.deepEqual(authority(), before); assert.equal(commands(), beforeCommands);
    await select(0); assert.equal(height(), originalField); assert.equal(height().value, '9');
    assert.match(panel('extrusion').textContent, /Extrude 01/); assert.equal(button('Apply extrusion').disabled, false);
    for (const workspace of [false, true]) {
      await rerender({ workspace });
      assert.equal(testid('modeling-viewport'), viewport); assert.equal(height(), originalField);
      assert.equal(sessions.at(-1).controller, session); assert.equal(port(), firstPort);
      assert.equal(sessions.length, 3); assert.equal(firstPort.commits, beforeCommits);
      assert.deepEqual(authority(), before); assert.deepEqual(current().drafts, { height: '9' });
    }
  });
  await group('Apply uses the real controller path and Undo/Redo retain accepted authored history', async () => {
    const generation = current().generation, commits = firstPort.commits;
    await click(button('Apply extrusion')); assert.equal(current().busy, true); assertPanel('extrusion');
    assert.equal(current().accepted.parameters.height, 6); assert.equal(firstPort.commits, commits);
    await settled(); assertClosed(); assertWorkspaceFocus();
    assert.equal(current().accepted.parameters.height, 9); assert.equal(JSON.parse(current().authoredText).parameters.height, 9);
    assert.equal(current().generation, generation + 1); assert.equal(current().history.count, 2);
    assert.deepEqual(current().drafts, {}); assert.equal(firstPort.commits, commits + 1); baselineGeometry();
    assert.equal((await focusedKey('z', { ctrlKey: true })).defaultPrevented, true);
    await settled(); assert.equal(current().accepted.parameters.height, 6); assert.equal(current().history.canRedo, true);
    assert.equal((await focusedKey('z', { metaKey: true, shiftKey: true })).defaultPrevented, true);
    await settled(); assert.equal(current().accepted.parameters.height, 9); assert.equal(current().history.canRedo, false);
    assert.equal(current().history.count, 2); baselineGeometry();
  });
  await group('Cancel, Escape, no-op Apply and guarded text keys preserve accepted authority', async () => {
    await select(1); const before = authority(), beforeCommands = commands();
    await edit(); await change(height(), '10'); await click(button('Cancel'));
    assertClosed(); assertWorkspaceFocus(); assert.deepEqual(current().drafts, {}); assert.deepEqual(authority(), before);
    await edit(); await change(height(), '11');
    for (const fields of [{ repeat: true }, { isComposing: true }, { keyCode: 229 }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
      for (const name of ['Enter', 'Escape']) {
        assert.equal((await key(height(), name, fields)).defaultPrevented, false);
        assertPanel('extrusion'); assert.deepEqual(current().drafts, { height: '11' });
      }
    }
    assert.equal((await key(height(), 'z', { ctrlKey: true })).defaultPrevented, false);
    assert.equal((await key(height(), 'Escape')).defaultPrevented, true);
    assertClosed(); assertWorkspaceFocus(); assert.deepEqual(current().drafts, {}); assert.deepEqual(authority(), before);
    await edit(); await change(height(), '10'); await change(height(), '9'); await click(button('Apply extrusion'));
    assertClosed(); assert.deepEqual(current().drafts, {}); assert.deepEqual(authority(), before);
    assert.equal(commands(), beforeCommands);
  });
  await group('unrelated global drafts route opening globally and block later local staging or Apply', async () => {
    const before = authority(), beforeCommands = commands();
    await staged('diameter', '10'); await click(button('Edit extrusion'));
    assertPanel('dimensions'); assert.deepEqual(current().drafts, { diameter: '10' });
    assert.ok(visible(input('Diameter (mm)'))); assert.equal(input('Diameter (mm)').value, '10');
    assert.equal(testid('modeling-options').querySelector(':scope > header h2').textContent, 'Edit model dimensions');
    await click(button('Cancel')); assertClosed(); assert.deepEqual(current().drafts, {});
    await edit(); await change(height(), '12'); await staged('diameter', '11');
    assertPanel('extrusion'); assert.equal(height().disabled, true); assert.equal(button('Apply extrusion').disabled, true);
    const drafts = current().drafts, stages = countCalls('stage'), applies = countCalls('apply');
    await change(height(), '13'); await key(height(), 'Enter'); await click(button('Apply extrusion'));
    assert.deepEqual(current().drafts, drafts); assert.equal(countCalls('stage'), stages); assert.equal(countCalls('apply'), applies);
    await click(button('Cancel')); assertClosed(); assert.deepEqual(current().drafts, drafts);
    assert.deepEqual(authority(), before); assert.equal(commands(), beforeCommands);
    await discard();
  });
  await group('controlled refusal retains command and draft then recovers through the same Apply path', async () => {
    await edit(); const before = authority(), commits = firstPort.commits;
    await change(height(), '-1'); await click(button('Apply extrusion')); await settled();
    assertPanel('extrusion'); assert.equal(height().value, '-1'); assert.deepEqual(current().drafts, { height: '-1' });
    assert.match(current().error, /Controlled provider refusal/); assert.deepEqual(authority(), before);
    assert.equal(firstPort.commits, commits); assert.equal(button('Apply extrusion').disabled, false);
    assert.ok([...container.querySelectorAll('[role="alert"]')].some(node => /Controlled provider refusal/.test(node.textContent)));
    await change(height(), '12'); await click(button('Apply extrusion')); await settled();
    assertClosed(); assert.equal(current().accepted.parameters.height, 12); assert.equal(current().error, null);
    assert.deepEqual(current().drafts, {}); baselineGeometry();
  });
  await group('source replacement stales pinned handlers and synthetic literal/derived commands stay read-only', async () => {
    await edit(); await change(height(), '13');
    const lateStage = reactCallback(height(), 'onChange'), lateApply = reactCallback(button('Apply extrusion'), 'onClick');
    await openText(variants['literal-only']); assertPanel('extrusion');
    assert.equal(panel('extrusion').querySelectorAll('input').length, 0);
    assert.match(panel('extrusion').textContent, /stale/i); assert.equal(button('Apply extrusion').disabled, true);
    const before = authority(), beforeCommands = commands(), stages = countCalls('stage'), applies = countCalls('apply');
    await act(async () => { lateStage({ target: { value: '14' } }); lateApply(); await tick(); });
    await click(button('Apply extrusion'));
    assert.deepEqual(authority(), before); assert.deepEqual(current().drafts, {});
    assert.equal(countCalls('stage'), stages); assert.equal(countCalls('apply'), applies); assert.equal(commands(), beforeCommands);
    await click(button('Cancel')); assertClosed();
    await select(1); await edit(); assert.equal(button('Apply extrusion').disabled, true);
    assert.equal(panel('extrusion').querySelectorAll('input').length, 0);
    assert.match(panel('extrusion').textContent, /Height/); assert.match(panel('extrusion').textContent, /6/);
    assert.match(panel('extrusion').textContent, /Start Z/); assert.match(panel('extrusion').textContent, /-2/);
    await click(button('Cancel')); await openText(variants['derived-only']); await select(1); await edit();
    assert.equal(panel('extrusion').querySelectorAll('input').length, 0);
    assert.match(panel('extrusion').textContent, /derived/i); assert.equal(button('Apply extrusion').disabled, true);
    await click(button('Cancel'));
  });
  await group('synthetic direct Start Z and shared driver variants expose only their deduplicated parameters', async () => {
    await openText(variants['direct-start']); await select(1); await edit();
    assert.equal(height().value, '6'); assert.equal(startZ().value, '2');
    assert.equal(panel('extrusion').querySelectorAll('input').length, 2);
    const before = authority(); await change(startZ(), '3'); assert.deepEqual(current().drafts, { centerX: '3' });
    assert.deepEqual(authority(), before); await click(button('Cancel')); assert.deepEqual(current().drafts, {});
    await openText(variants['deduplicated-driver']); await select(1); await edit();
    assert.equal(panel('extrusion').querySelectorAll('input').length, 1);
    assert.match(panel('extrusion').textContent, /Height/); assert.match(panel('extrusion').textContent, /Start Z/);
    assert.match(panel('extrusion').textContent, /shared|other.*uses|all.*uses|wherever/i);
    await change(height(), '7'); assert.deepEqual(current().drafts, { height: '7' }); await click(button('Cancel'));
    await openText(baseline.text); await select(1);
  });
  await group('identical-source replacement cannot revive an old command or discard newer drafts', async () => {
    await edit(); const priorGeneration = current().generation;
    await openText(baseline.text); assert.equal(current().generation, priorGeneration + 1);
    assertPanel('extrusion'); assert.equal(panel('extrusion').querySelectorAll('input').length, 0);
    assert.match(panel('extrusion').textContent, /stale/i); assert.equal(button('Apply extrusion').disabled, true);
    await staged('height', '15'); const beforeCommands = commands();
    await key(testid('modeling-options').querySelector(':scope > header h2'), 'Escape');
    assertClosed(); assert.deepEqual(current().drafts, { height: '15' });
    assert.equal(commands(), beforeCommands);
    await select(1); await edit(); assert.equal(height().disabled, false); assert.equal(height().value, '15');
    await click(button('Cancel')); assert.deepEqual(current().drafts, {});
  });
  await group('late Apply cannot close another drawer or a newer command epoch', async () => {
    await edit(); await change(height(), '8'); await click(button('Apply extrusion'));
    await click(button('Save or open a model')); assertPanel('files');
    await settled(); assertPanel('files'); assert.equal(current().accepted.parameters.height, 8);
    await edit(); await change(height(), '10'); firstPort.holdNext = true;
    await click(button('Apply extrusion'));
    await act(async () => { workers.at(-1).accept(); await tick(); });
    assert.equal(typeof firstPort.release, 'function'); assert.equal(current().busy, true);
    const before = authority(), commits = firstPort.commits;
    await click(button('Cancel computation')); assert.equal(current().busy, false);
    await click(button('Cancel')); await edit(); await change(height(), '11');
    await act(async () => { firstPort.release(); await tick(); });
    assertPanel('extrusion'); assert.equal(height().value, '11'); assert.deepEqual(current().drafts, { height: '11' });
    assert.deepEqual(authority(), before); assert.equal(firstPort.commits, commits);
    await click(button('Apply extrusion')); await settled(); assertClosed();
    assert.equal(current().accepted.parameters.height, 11); baselineGeometry();
  });
  await group('file/STL/examples/global controls stay reachable with one viewport after replacement', async () => {
    await click(button('Save or open a model')); assertPanel('files');
    const picker = container.querySelector('input[type="file"]'); assert.ok(picker); assert.match(picker.accept, /\.cad\.json/);
    assert.ok(button('Choose model file')); assert.ok(button('Download model'));
    await click(button('Show saved model')); assert.equal(input('Saved model data').value, current().authoredText);
    assert.equal(button('Open saved model').disabled, true);
    await click(button('Export accepted STL')); assertPanel('outputs');
    const chooser = input('STL output'); assert.ok(chooser); assert.equal(button('Download STL').disabled, true);
    assert.ok([...chooser.options].some(option => option.value === 'post' && option.disabled), 'Existing circle STL refusal remains explicit');
    await click(button('Capabilities & limits')); assertPanel('limits');
    await click(button('Modeling examples')); assertPanel('examples');
    assert.ok([...input('Choose an example').options].some(option => option.value === 'round-post'));
    assert.equal(button('Load example').disabled, true);
    await click(button('Edit model dimensions')); assertPanel('dimensions');
    assert.ok(visible(input('Diameter (mm)'))); assert.ok(visible(input('Center X (mm)')));
    assert.ok(visible(input('Center Y (mm)'))); assert.ok(visible(input('Extrusion height (mm)')));
    await click(button('Cancel')); assertClosed();
    assert.equal(testid('modeling-viewport'), viewport); assert.equal(sessions.length, 3); assert.equal(displays.length, 3);
    assert.equal(observers.length, 3); assert.equal(firstPort.disposals, 0); assert.equal(observer().disconnections, 0);
    await act(async () => { observer().callback([{ target: viewport }]); await tick(); }); assert.equal(firstPort.resizes, 1);
  });
  await group('busy command keys are inert and unmount disposes once before late display completion', async () => {
    await edit(); await change(height(), '14'); firstPort.holdNext = true;
    const beforeCommands = commands();
    assert.equal((await key(height(), 'Enter')).defaultPrevented, true);
    assert.equal(current().busy, true); assert.equal(commands(), beforeCommands + 1);
    assert.equal(height().disabled, true); assert.equal(button('Apply extrusion').disabled, true); assert.equal(button('Cancel').disabled, true);
    await click(button('Apply extrusion')); await key(height(), 'Enter'); await key(height(), 'Escape');
    assert.equal(commands(), beforeCommands + 1); assertPanel('extrusion');
    await act(async () => { workers.at(-1).accept(); await tick(); });
    assert.equal(typeof firstPort.release, 'function'); const commits = firstPort.commits;
    await unmount(); assert.equal(firstPort.disposals, 1); assert.equal(observers.at(-1).disconnections, 1);
    await act(async () => { firstPort.release(); await tick(); });
    assert.equal(firstPort.commits, commits); assert.equal(container.childElementCount, 0);
    assert.equal(sessions.at(-1).controller.getSnapshot().disposed, true); assert.equal(countCalls('dispose'), 1);
    assert.equal(firstPort.candidateDisposals, firstPort.prepares); assert.equal(workers.at(-1).terminated, true);
  });
} finally {
  if (reactRoot) await unmount();
  for (const record of displays) if (record.release) record.release();
  dom.window.close();
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  }
}
assert.equal(groups.length, 17); assert.equal(mountedRoots, 1); assert.equal(sessions.length, 3);
assert.equal(displays.length, 3); assert.equal(observers.length, 3);
assert.ok(stats.replies <= 20); assert.equal(stats.nativeCalls, 0);
console.log(JSON.stringify({ status: 'PASS', node: process.version,
  runner: { executable: process.execPath, argv: process.argv.slice(1), command: [process.execPath, ...process.argv.slice(1)].map(value => JSON.stringify(value)).join(' ') },
  groups, mountedSessions: mountedRoots, controllerLifetimes: sessions.length, ...stats,
  fixture: { path: fixturePath, sha256: fixtureHash }, syntheticAuthoredVariants: Object.keys(variants),
  boundary: 'Actual mounted React, host controls, modeling controller, engine serializer, receiver and CPU scene. Controlled provider, Worker, ResizeObserver and display port. Every edited and synthetic-variant reply reuses genuine round-post baseline geometry. Zero native calls. Edited-state native geometry, WebGPU pixels and physical browser file/download acceptance UNRUN.' }));
