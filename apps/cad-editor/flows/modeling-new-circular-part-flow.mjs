// #1977: frozen 10 pure + 12 actual React/controller groups, one root, three controller lifetimes.
// Exact per-group reply budget: 0 x 10, then 1,2,1,0,0,0,4,4,1,4,6,1 = 24; hard ceiling 30.
// Real controller, engine serializer and complete CPU receiver; explicit provider/Worker/display doubles.
// Every body/sample is the unmodified genuine center[2,-3], diameter8, height6 native baseline.
// Origin-zero authored intent and all changed geometry/context are MOCKED, never measured geometry.
// Only request-scoped preview meshId/revision are rebound; native source/IDs/arrays/UV remain original.
// Native execution, certified volume/mass/STL, GPU pixels and physical Save/Open are UNRUN.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../..');
const depsRoot = resolve(process.env.REPO_DEPS_ROOT ?? root);
const require = createRequire(resolve(depsRoot, 'package.json'));
const esbuild = require('esbuild');
const fixturePath = 'packages/barocss-cad-editor/scripts/fixtures/modeling-circle/baseline-native.json';
const fixtureBytes = readFileSync(resolve(root, fixturePath));
const fixtureHash = '7338e8c36033d6a324760c9fc101d9509b73e89f223246395250c83cee6cc4e8';
const hash = value => createHash('sha256').update(value).digest('hex');
const baseline = JSON.parse(fixtureBytes), authored = JSON.parse(baseline.text);
const groups = [], sessions = [], workers = [], displays = [], observers = [];
const runtimeHashes = {}, bundleHashes = {};
const stats = { replies: 0, providerLoads: 0, providerEdits: 0, previewReplays: 0, retainedBodyChecks: 0, nativeCalls: 0 };
const controls = { refuseNextLoad: false, refuseNextReceiver: false };
const globals = new Map();
function setGlobal(name, value) {
  if (!globals.has(name)) globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}
const frozenLedger = Object.freeze(["Exact origin-zero circle and extrusion source with diameter/thickness and sole part", "Owned radius scale(diameter,0.5), omitted from and preserved numeric intent", "Finite decimal positive radius/height necessary bounds including endpoints", "Reject malformed, oversized, nonfinite and underflow text without evaluation", "Deterministic source and two-node source-budget admission", "Default17.5x5 only creates authored intent, not a native claim", "Existing rectangle builder bytes remain exact for fixed probes", "Circle family retains no certified volume/mass or STL export", "Circle Sketch uses Model dimensions and Extrude targets thickness", "Unsupported arm/union/slot/hole/pocket capabilities remain absent", "One actual mount, ordinary CREATE route, labels and initial accepted state", "Explicit replacement action and successful source/history1 admission", "Cancel/Escape/Enter/IME/repeat and invalid fields preserve accepted state", "Pending model drafts block creation and Review preserves values", "Repeated active command keeps live handlers and temporary inputs", "Cross-kind captured callbacks cannot overwrite current creation settings", "Controller/source lifetime ABA rejects obsolete Create/Cancel callbacks", "Native and complete receiver/display refusals retain accepted state", "Genuine creation completion cleans old File text/consent after panel navigation", "Canceled held completion plus Undo cannot clear newer File state or options", "Named thickness/diameter edits, preview promotion and Undo/Redo use real controller", "Accepted-only Blob and one fresh controller Open preserve source with history1"]);
const replyLedger = Object.freeze([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 4, 4, 1, 4, 6, 1]);
let groupReplyStart = 0;
async function group(run) {
  const index = groups.length, name = frozenLedger[index];
  assert.ok(index < 22, 'Frozen ten-pure and twelve-React-group ceiling');
  groupReplyStart = stats.replies;
  try {
    await run();
    assert.equal(stats.replies - groupReplyStart, replyLedger[index], 'Exact frozen per-group controlled reply ledger');
  } catch (cause) {
    console.error(JSON.stringify({ group: index + 1, name, status: 'FAIL', ...stats,
      groupReplies: stats.replies - groupReplyStart, plannedReplies: replyLedger[index], error: String(cause) }));
    throw cause;
  }
  groups.push(name);
  console.log(JSON.stringify({ group: groups.length, name, status: 'PASS', replies: stats.replies - groupReplyStart }));
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
  const bodies = Object.fromEntries(Object.keys(data.outputs).map(name => {
    const body = structuredClone(baseline.bodies.post);
    assert.deepEqual(body, baseline.bodies.post, 'Complete retained body before mocked output-envelope adaptation');
    assert.equal(body.native.world.source, baseline.bodies.post.native.world.source);
    assert.equal(body.native.parent.profile.source, baseline.bodies.post.native.parent.profile.source);
    stats.retainedBodyChecks++;
    return [name, body];
  }));
  return {
    parameters: structuredClone(data.parameters), suppression: {}, features: structuredClone(baseline.features),
    bodies, save: () => signedJSON(data),
    withParameters(changes) {
      stats.providerEdits++;
      const parameters = { ...data.parameters, ...changes };
      if (parameters.diameter <= 0) throw Error('Controlled provider refusal: diameter must be positive.');
      return providerSnapshot({ ...data, parameters });
    },
    withSuppression: forbidden,
  };
}
setGlobal('__modelingNewCircularPartFlow', {
  cad: { model: forbidden, load(text) { stats.providerLoads++;
    if (controls.refuseNextLoad) { controls.refuseNextLoad = false; throw Error('Controlled provider load refusal.'); }
    return providerSnapshot(JSON.parse(text)); } },
  tessellateXYCirclePrismShell(bundle, options) {
    assert.deepEqual(bundle, baseline.bodies.post.native.parent.bundle);
    assert.equal(options.segmentsPerQuarter, 4);
    stats.previewReplays++;
    const preview = structuredClone(baseline.preview);
    assert.deepEqual(preview, baseline.preview, 'Whole genuine sampled result before mocked envelope binding');
    // Only the explicit request/display envelope changes. Native IDs, arrays, UV and source stay exact.
    preview.packet.surfaceId = preview.report.meshId = options.meshId;
    preview.packet.revision = preview.report.revision = options.revision;
    return preview;
  },
  tessellateSurface: forbidden, tessellateOwnPlateCircularHole: forbidden, tessellateConvexPlanarSolid: forbidden,
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
      accepted: null, shown: null, previewPrepares: 0, previewShows: 0, previewCommits: 0, previewDisposals: 0, previewRestores: 0, holdNext: false, release: null, refuseNext: false, refusedPrepares: 0 };
    displays.push(record);
    return {
      async prepare(scene) {
        record.prepares++;
        if (record.refuseNext) { record.refuseNext = false; record.refusedPrepares++; throw Error('Controlled display refusal.'); }
        const candidate = { commit() { record.commits++; record.accepted = scene; },
          dispose() { record.candidateDisposals++; } };
        if (record.holdNext) {
          record.holdNext = false;
          await new Promise(resolve => { record.release = () => { record.release = null; resolve(); }; });
        }
        return candidate;
      },
      async preparePreview(scene) {
        record.previewPrepares++;
        let shown = false, committed = false, disposed = false;
        return {
          show() { assert.equal(disposed, false); shown = true; record.shown = scene; record.previewShows++; },
          commit() { assert.ok(shown && !disposed); committed = true; record.accepted = scene; record.shown = null; record.previewCommits++; },
          dispose() { if (disposed) return; disposed = true; record.previewDisposals++;
            if (shown && !committed) { record.shown = null; record.previewRestores++; } },
        };
      },
      aspect() { return 1.5; }, dimensions() { return { width: 900, height: 600 }; },
      resize() { record.resizes++; }, dispose() { record.disposals++; },
    };
  },
});
const source = name => resolve(root, `packages/barocss-cad-editor/src/${name}`);
const boundaryPlugin = { name: 'explicit-new-circular-part-boundaries', setup(build) {
  build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\.\/modeling-controller\.js$/ }, () => ({ path: 'controller', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\.\/prism-feature-display\.js$/ }, () => ({ path: 'display', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'workspace-boundary' }));
  build.onLoad({ filter: /.*/, namespace: 'workspace-boundary' }, ({ path }) => { const contents = {
    provider: 'export const {cad,tessellateConvexPlanarSolid,tessellateSurface,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell} = globalThis.__modelingNewCircularPartFlow;',
    legacy: 'export function createPrismFeatureEngine() { return () => { throw Error("Legacy native execution is outside this flow."); }; }',
    controller: `import {createCadEditorModelingController as create} from ${JSON.stringify(source('modeling-controller.ts'))}; export const createCadEditorModelingController = (...args) => globalThis.__modelingNewCircularPartFlow.controller(create, ...args);`,
    display: 'export const createPrismFeatureDisplay = globalThis.__modelingNewCircularPartFlow.display;',
    gpu: ['engine-scene', 'engine-camera-ray', 'engine-raycast', 'kernel-face-preview'].map(name =>
      `export * from ${JSON.stringify(resolve(root, `packages/barocss-gpu/src/${name}.ts`))};`).join('\n'),
  }[path]; runtimeHashes[`workspace-boundary:${path}`] = hash(contents); return { resolveDir: root, contents }; });
} };
async function bundle(entry) {
  const result = await esbuild.build({ entryPoints: [source(entry)], bundle: true, platform: 'node',
    format: 'cjs', jsx: 'automatic', write: false, metafile: true, logLevel: 'silent',
    external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/*', 'radix-ui', 'class-variance-authority', 'clsx', 'tailwind-merge'],
    nodePaths: [resolve(depsRoot, 'node_modules')], plugins: [boundaryPlugin],
    define: { 'import.meta.url': JSON.stringify(pathToFileURL(source(entry)).href) } });
  const inputs = Object.keys(result.metafile.inputs);
  for (const path of inputs) if (!path.startsWith('workspace-boundary:')) runtimeHashes[path] = hash(readFileSync(resolve(root, path)));
  bundleHashes[entry] = hash(result.outputFiles[0].text);
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
    assert.ok(++stats.replies <= 30, 'Frozen thirty-worker-reply ceiling');
    assert.ok(stats.replies - groupReplyStart <= replyLedger[groups.length], 'Frozen per-group reply ceiling');
    this.answered.add(command.id);
    const reply = this.engine(command);
    if (controls.refuseNextReceiver) { controls.refuseNextReceiver = false; assert.equal(reply.ok, true);
      reply.summary.outputs[0].volumeMM3 = { numerator: '1', denominator: '1' }; }
    this.callbacks.get('message')({ data: structuredClone(reply) }); return reply;
  }
});
const React = require('react'), { createRoot } = require('react-dom/client'), { act } = React;
const ui = await bundle('react/modeling-editor.tsx');
const { api: { createCircularPartSource: createSource } } = await bundle('modeling-circular-part.ts');
const { api: { createRectangularPartSource } } = await bundle('modeling-rectangular-part.ts');
const { api: structure } = await bundle('modeling-structure.ts');
const { api: extrusion } = await bundle('modeling-extrusion-command.ts');
const { api: sketch } = await bundle('modeling-sketch-command.ts');
const { api: circle } = await bundle('modeling-circle.ts');
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
  await act(async () => { reactRoot.render(React.createElement(ui.api.CadEditorModeling, { initialAuthoredText: initialText, ...props })); await tick(); });
  await settled();
}
async function rerender(props) {
  await act(async () => { reactRoot.render(React.createElement(ui.api.CadEditorModeling, { initialAuthoredText: initialText, ...props })); await tick(); });
}
async function unmount() {
  await act(async () => { reactRoot.unmount(); await tick(); }); reactRoot = null;
}


const rawDefaults = { diameter: '17.5', thickness: '5' };
const expectedSource = (diameter = 17.5, thickness = 5) => ({
  format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { diameter, thickness },
  nodes: [
    { kind: 'sketch', profile: 'circle', center: [0, 0], radius: { op: 'scale', value: { parameter: 'diameter' }, factor: 0.5 } },
    { kind: 'extrude', sketch: 0, height: { parameter: 'thickness' } },
  ], outputs: { part: { node: 1, side: 'solid' } },
});
const initialText = createSource(rawDefaults), sourceB = createSource({ diameter: '18', thickness: '5' });
const mockSummary = {
  documentId: 'cad_model', revision: 0, source: 'model', parameters: expectedSource().parameters,
  features: structuredClone(baseline.features),
  outputs: [{ name: 'part', solidId: baseline.bodies.post.native.parent.bundle.topology.id,
    family: 'stored-rational-circle-prism', volumeMM3: null }],
};
const mockSnapshot = { accepted: mockSummary, authoredText: initialText, generation: 1, drafts: {} };
const visible = node => !!node && !node.closest('[hidden]');
const panel = name => testid(`modeling-panel-${name}`);
const assertPanel = name => {
  assert.ok(visible(testid('modeling-options')), 'Options must be visible');
  assert.ok(visible(panel(name)), `${name} panel must be visible`);
};
const assertClosed = () => assert.equal(visible(testid('modeling-options')), false);
const diameter = () => input('Diameter (mm)');
const thickness = () => input('Thickness (mm)');
const createButton = () => button(current().accepted ? 'Replace current model' : 'Create part');
const creationPanel = () => visible(panel('new-circular-part')) ? 'new-circular-part' : 'new-part';
const creationField = () => creationPanel() === 'new-circular-part' ? diameter() : input('Width (mm)');
const values = () => Object.fromEntries([...panel(creationPanel()).querySelectorAll('input')].map(node => [node.id.split('-').at(-1), node.value]));
const feature = index => testid('modeling-browser').querySelector(`button[data-feature-index="${index}"]`);
const select = async index => { await click(feature(index)); assert.equal(current().selection, index); };
const newPart = async (kind = 'circle') => {
  await click(button(kind === 'circle' ? 'New circular part' : 'New rectangular part'));
  assertPanel(kind === 'circle' ? 'new-circular-part' : 'new-part');
  assert.equal(document.activeElement, testid('modeling-options').querySelector(':scope > header h2'));
};
const staged = async (name, raw) => {
  await act(async () => { sessions.at(-1).controller.stage(name, raw); await tick(); });
};
const discard = async () => {
  await act(async () => { sessions.at(-1).controller.discard(); await tick(); });
};
const openText = async text => {
  let operation;
  await act(async () => { operation = sessions.at(-1).controller.open(text); await tick(); });
  await settled(); await operation;
  assert.deepEqual(JSON.parse(current().authoredText), JSON.parse(text));
  assert.equal(current().error, null); baselineGeometry();
};
const applyStaged = async () => {
  let operation;
  await act(async () => { operation = sessions.at(-1).controller.apply(); await tick(); });
  await settled(); await operation; assert.equal(current().error, null);
};
const countCalls = name => sessions.at(-1).calls.filter(call => call.name === name).length;
const reactCallback = (node, name) => {
  assert.ok(node, `Control for actual React ${name} must exist`);
  const props = Object.keys(node).find(key => key.startsWith('__reactProps$'));
  assert.ok(props && typeof node[props][name] === 'function', `Actual React ${name} must exist`);
  return node[props][name];
};
const capture = () => ({ change: reactCallback(creationField(), 'onChange'), apply: reactCallback(createButton(), 'onClick'),
  cancel: reactCallback(button('Cancel'), 'onClick'), key: reactCallback(creationField(), 'onKeyDown'),
  close: reactCallback(button('Close options'), 'onClick'),
  review: button('Review pending dimensions') ? reactCallback(button('Review pending dimensions'), 'onClick') : null });
const errors = () => [...container.querySelectorAll('[role="alert"]')].map(node => node.textContent);
const assertStale = async callbacks => {
  const before = authority(), beforeDrafts = current().drafts, beforeValues = values(), beforeCommands = commands();
  const beforeErrors = errors(), opens = countCalls('open'), stages = countCalls('stage'), discards = countCalls('discard');
  const beforePanel = creationPanel();
  await act(async () => { callbacks.change({ target: { value: '987' } }); await tick(); });
  for (const callback of [callbacks.apply, callbacks.cancel, callbacks.close, callbacks.review].filter(Boolean)) {
    await act(async () => { callback(); await tick(); });
  }
  for (const key of ['Enter', 'Escape']) {
    await act(async () => { callbacks.key({ key, nativeEvent: {}, preventDefault() {}, stopPropagation() {} }); await tick(); });
  }
  assert.deepEqual(authority(), before); assert.deepEqual(current().drafts, beforeDrafts);
  assert.deepEqual(values(), beforeValues); assert.deepEqual(errors(), beforeErrors);
  assert.equal(commands(), beforeCommands); assert.equal(countCalls('open'), opens);
  assert.equal(countCalls('stage'), stages); assert.equal(countCalls('discard'), discards);
  assertPanel(beforePanel);
};
const baselineGeometry = () => {
  const snapshot = current(), component = snapshot.display.packet.components[0];
  assert.equal(snapshot.display.packet.profile, 'model-body-faces');
  assert.equal(snapshot.display.packet.components.length, 1);
  assert.equal(component.family, 'stored-rational-circle-prism');
  assert.deepEqual(component.qualification, baseline.bodies.post.native.certificate);
  assert.deepEqual(component.lineage.topology, baseline.bodies.post.native.parent.bundle.topology);
  assert.deepEqual(component.lineage.geometry, baseline.bodies.post.native.world.model);
  for (const name of ['positions', 'normals', 'parameters', 'indices', 'bounds', 'coordinateSystem']) {
    assert.deepEqual(component.preview.packet[name], baseline.preview.packet[name], `Original native preview ${name}`);
  }
  for (const name of ['edgePaths', 'edgeProvenance', 'faceRanges']) {
    assert.deepEqual(component.preview[name], baseline.preview[name], `Original native lineage ${name}`);
  }
  assert.deepEqual(component.preview.report.native, baseline.preview.report.native);
  assert.equal(snapshot.display.scene.geometries[0].positions.length, 98 * 3);
  assert.equal(snapshot.display.scene.geometries[0].indices.length, 64 * 3);
  assert.deepEqual(snapshot.display.scene.geometries[0].uvs, baseline.preview.packet.parameters);
  assert.equal(snapshot.accepted.outputs[0].volumeMM3, null);
  assert.equal(hash(readFileSync(resolve(root, fixturePath))), fixtureHash);
};
const consent = () => panel('files').querySelector('input[type="checkbox"]');
const openFiles = async () => { await click(button('Save or open a model')); assertPanel('files'); };
const unsupported = () => {
  for (const label of ['Add rectangular arm', 'Union bodies', 'Cut rectangular through-slot', 'Add through-hole', 'Cut rectangular pocket']) {
    assert.equal(button(label), undefined, `${label} must remain absent for the circle family`);
  }
};
let viewport, activePort, initialCallbacks, initialSession;
const downloads = [], revoked = [], anchors = [];
const originalCreateURL = URL.createObjectURL, originalRevokeURL = URL.revokeObjectURL;
const originalAnchorClick = dom.window.HTMLAnchorElement.prototype.click;
try {
  await group(() => {
    assert.equal(fixtureBytes.length, 81412); assert.equal(hash(fixtureBytes), fixtureHash);
    assert.deepEqual(JSON.parse(createSource(rawDefaults)), expectedSource());
    assert.equal(JSON.parse(initialText).nodes.length, 2);
    assert.deepEqual(Object.keys(JSON.parse(initialText).parameters), ['diameter', 'thickness']);
    assert.deepEqual(JSON.parse(initialText).outputs, { part: { node: 1, side: 'solid' } });
    assert.equal(signedJSON(authored), baseline.text);
    assert.equal(stats.providerLoads, 0); assert.equal(stats.nativeCalls, 0);
  });
  await group(() => {
    const data = JSON.parse(createSource({ diameter: ' +1.75e1 ', thickness: '5.' }));
    assert.deepEqual(data, expectedSource());
    assert.deepEqual(data.nodes[0].radius, { op: 'scale', value: { parameter: 'diameter' }, factor: 0.5 });
    assert.deepEqual(data.nodes[0].center, [0, 0]); assert.equal(Object.hasOwn(data.nodes[1], 'from'), false);
    assert.deepEqual(JSON.parse(createSource({ diameter: '.002', thickness: '1e-3' })), expectedSource(.002, .001));
    assert.equal(Object.is(data.nodes[0].center[0], -0), false);
  });
  await group(() => {
    for (const [diameter, thickness] of [['0.002', '0.001'], ['10000', '10000'], ['1E4', '+.001'], ['1' + ' '.repeat(63), '2']]) {
      assert.deepEqual(JSON.parse(createSource({ diameter, thickness })), expectedSource(Number(diameter), Number(thickness)));
    }
    for (const [name, raw] of [['diameter', '.0019999'], ['thickness', '.0009999'], ['diameter', '10000.0001'], ['thickness', '10000.0001']]) {
      assert.throws(() => createSource({ ...rawDefaults, [name]: raw }), undefined, `${name}=${raw}`);
    }
  });
  await group(() => {
    for (const name of ['diameter', 'thickness']) {
      for (const raw of ['', ' ', 'NaN', 'Infinity', '-Infinity', '1e309', '1e-999', '0', '-0', '-1', '0x10', '0b10', '1_000', '1mm', '1 2', '1/2', '1;throw Error()', '1e', '.', '++1', '1' + ' '.repeat(64), 2, null, undefined]) {
        assert.throws(() => createSource({ ...rawDefaults, [name]: raw }), undefined, `${name}=${JSON.stringify(raw)}`);
      }
    }
    assert.equal(stats.providerLoads, 0); assert.equal(stats.nativeCalls, 0);
  });
  await group(() => {
    const before = structuredClone(rawDefaults), text = createSource(rawDefaults);
    assert.equal(text, createSource(rawDefaults)); assert.deepEqual(rawDefaults, before);
    assert.equal(engine.api.modelingSourceKind(text), 'model');
    const bytes = structure.modelingSourceBytes(text);
    assert.ok(bytes < 1024); assert.equal(structure.modelingSourceBudget([bytes], bytes, [bytes, bytes]), bytes * 4);
    assert.equal(structure.canonicalModelingText(JSON.parse(text)), signedJSON(expectedSource()));
    assert.throws(() => structure.modelingSourceBytes(' '.repeat(65537)), /64 KiB/);
    assert.throws(() => structure.modelingSourceBudget([], 8 * 1024 * 1024, [1]), /8 MiB/);
    assert.equal(stats.providerLoads, 0);
  });
  await group(() => {
    assert.deepEqual(JSON.parse(initialText).parameters, { diameter: 17.5, thickness: 5 });
    assert.deepEqual(baseline.parameters, { centerX: 2, centerY: -3, diameter: 8, height: 6 });
    assert.deepEqual(baseline.bodies.post.native.parent.report.centerMM, [2, -3]);
    assert.equal(baseline.bodies.post.native.parent.report.radiusMM, 4);
    assert.equal(baseline.bodies.post.native.parent.report.heightMM, 6);
    assert.equal(baseline.preview.report.boundsMM.max[2], 6.000000000000001);
    assert.equal(stats.providerLoads, 0); assert.equal(sessions.length, 0);
    console.log(JSON.stringify({ control: 'authored-intent-only', sha256: hash(initialText), parsed: JSON.parse(initialText), nativeMeasured: false }));
  });
  await group(() => {
    assert.equal(hash(readFileSync(source('modeling-rectangular-part.ts'))), 'cc377c51a9373878a3e1426107a54dfa95247f0e2bb39014289af820283189ea');
    assert.equal(hash(readFileSync(resolve(root, 'apps/cad-editor/flows/modeling-new-part-flow.mjs'))), '60068e9f5e2ed98c2c5e317eb20d4f94df2e0e21103de0ec8cd67b21e9448a69');
    for (const raw of [{ width: '32', height: '24', thickness: '8' }, { width: ' 4e1 ', height: '12.5', thickness: '.25' },
      { width: '10000', height: '10000', thickness: '10000' }, { width: '.0001', height: '+1', thickness: '1e-2' }]) {
      const data = { format: 'barocss-cad-model', schema: 1, units: 'mm',
        parameters: { width: Number(raw.width), height: Number(raw.height), thickness: Number(raw.thickness) },
        nodes: [{ kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'width' }, { parameter: 'height' }] },
          { kind: 'extrude', sketch: 0, height: { parameter: 'thickness' } }], outputs: { part: { node: 1, side: 'solid' } } };
      assert.equal(createRectangularPartSource(raw), JSON.stringify(data, null, 2) + '\n');
    }
  });
  await group(() => {
    circle.preflightModelingCircle(baseline.bodies.post.native);
    const certificate = baseline.bodies.post.native.certificate;
    assert.equal(Object.hasOwn(certificate, 'volumeMM3'), false); assert.equal(Object.hasOwn(certificate, 'mass'), false);
    assert.equal(baseline.summary.referenceValuesAreNotCertifiedMass, true);
    assert.equal(mockSummary.outputs[0].volumeMM3, null);
    // This inert source has neither manufactured certificate nor export payload.
    assert.doesNotMatch(initialText, /volume|mass|stl|mesh|certificate/i);
    assert.equal(stats.providerLoads, 0);
  });
  await group(() => {
    assert.equal(sketch.projectSketchCommand(mockSnapshot, 0), null);
    const projection = extrusion.projectExtrusionCommand(mockSnapshot, 1);
    assert.deepEqual(projection.parameters, ['thickness']);
    assert.deepEqual(projection.fields, [{ label: 'Height', kind: 'parameter', parameter: 'thickness' }, { label: 'Start Z', kind: 'literal', value: 0 }]);
    assert.equal(extrusion.projectExtrusionCommand(mockSnapshot, 0), null);
  });
  await group(() => {
    const capabilities = structure.getModelingStructureCapabilities(initialText, mockSummary);
    for (const name of ['addArm', 'addHole', 'union', 'cutSlot', 'cutPocket']) assert.equal(capabilities[name], null);
    assert.deepEqual(JSON.parse(initialText).nodes.map(node => node.kind), ['sketch', 'extrude']);
    assert.equal(JSON.stringify(mockSummary).length < 262144, true);
    for (const suffix of ['react/modeling-editor.tsx', 'react/modeling-workspace.tsx', 'modeling-circular-part.ts', 'modeling-rectangular-part.ts',
      'modeling-controller.ts', 'modeling-scene.ts', 'modeling-circle.ts', 'modeling-extrusion-command.ts', 'react/ui/button.tsx', 'react/ui/input.tsx']) {
      assert.ok(ui.inputs.some(path => path.endsWith(suffix)), `Actual source bundled: ${suffix}`);
    }
    assert.ok(engine.inputs.some(path => path.endsWith('modeling-engine.ts')));
    assert.equal(stats.providerLoads, 0); assert.equal(sessions.length, 0);
  });
  await group(async () => {
    await mount({ workspace: true }); viewport = testid('modeling-viewport'); activePort = port();
    assert.ok(viewport); assert.equal(activePort.host, viewport); assert.deepEqual(observer().observed, [viewport]);
    assertClosed(); baselineGeometry(); unsupported();
    assert.deepEqual(JSON.parse(current().authoredText), expectedSource());
    assert.deepEqual(current().history, { index: 0, count: 1, canUndo: false, canRedo: false });
    for (const label of ['New rectangular part', 'New circular part']) {
      assert.match(button(label).closest('details').querySelector('summary').textContent, /CREATE/);
    }
    await newPart('rectangle'); assert.deepEqual(values(), { width: '32', height: '24', thickness: '8' });
    await newPart(); assert.deepEqual(values(), rawDefaults); assert.equal(input('Width (mm)'), null);
    assert.equal(diameter().maxLength, 64); assert.equal(thickness().maxLength, 64);
    assert.equal(createButton().textContent.trim(), 'Replace current model');
    await click(button('Cancel')); assertClosed();
    await click(button('Export accepted STL')); assertPanel('outputs');
    assert.equal([...input('STL output').options].find(option => option.value === 'part').disabled, true);
    assert.equal(button('Download STL').disabled, true);
    await assert.rejects(sessions.at(-1).controller.exportStl('part', current().generation), /convex output/);
    await click(button('Close options')); assertClosed();
    await select(0); assert.equal(button('Edit sketch dimensions'), undefined); assert.ok(button('Edit model dimensions'));
    await select(1); assert.equal(button('Edit extrusion').disabled, false);
  });
  await group(async () => {
    await staged('thickness', '7'); await applyStaged(); assert.equal(current().history.count, 2);
    await newPart();
    assert.match(testid('modeling-options').textContent, /replace/i); assert.match(testid('modeling-options').textContent, /history/i);
    assert.equal(panel('new-circular-part').querySelectorAll('input[type="checkbox"]').length, 0);
    const before = authority(), opens = countCalls('open'), commits = activePort.commits;
    await click(createButton()); assert.equal(current().busy, true); assertPanel('new-circular-part');
    assert.deepEqual(authority(), before); assert.equal(activePort.commits, commits); assert.equal(countCalls('open'), opens + 1);
    assert.equal(workers.at(-1).requests.at(-1).kind, 'open');
    assert.deepEqual(JSON.parse(workers.at(-1).requests.at(-1).text), expectedSource());
    await settled(); assertClosed(); assert.equal(document.activeElement, testid('modeling-workspace'));
    assert.deepEqual(JSON.parse(current().authoredText), expectedSource());
    assert.deepEqual(current().history, { index: 0, count: 1, canUndo: false, canRedo: false });
    assert.equal(activePort.commits, commits + 1); assert.equal(testid('modeling-viewport'), viewport); baselineGeometry();
  });
  await group(async () => {
    const before = authority(), beforeCommands = commands(), stages = countCalls('stage');
    await newPart(); await change(diameter(), '19'); await click(button('Cancel')); assertClosed(); assert.deepEqual(authority(), before);
    await newPart();
    for (const [field, raw] of [[diameter, ''], [diameter, '.0019'], [thickness, '.0009'], [diameter, '10001'], [thickness, 'Infinity'], [diameter, '1e-999'], [thickness, '5mm']]) {
      await change(field(), raw); assert.equal(createButton().disabled, true);
      await click(createButton()); await key(field(), 'Enter');
      assert.deepEqual(authority(), before); assert.deepEqual(current().drafts, {}); assert.equal(commands(), beforeCommands);
      await change(diameter(), '17.5'); await change(thickness(), '5');
    }
    for (const fields of [{ repeat: true }, { isComposing: true }, { keyCode: 229 }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
      assert.equal((await key(diameter(), 'Enter', fields)).defaultPrevented, false);
      assert.equal((await key(diameter(), 'Escape', fields)).defaultPrevented, false); assertPanel('new-circular-part');
    }
    await key(diameter(), 'Escape'); assertClosed(); assert.deepEqual(authority(), before); assert.equal(commands(), beforeCommands);
    assert.equal(countCalls('stage'), stages);
    await newPart(); await change(diameter(), '18'); await key(diameter(), 'Enter');
    assert.equal(current().busy, true); assert.equal(createButton().disabled, true); assert.equal(button('Cancel').disabled, true);
    assert.equal(button('Close options').disabled, true); assert.equal(diameter().disabled, true);
    await key(testid('modeling-options').querySelector(':scope > header h2'), 'Escape'); assertPanel('new-circular-part');
    await settled(); assertClosed(); assert.deepEqual(JSON.parse(current().authoredText), expectedSource(18)); baselineGeometry();
  });
  await group(async () => {
    await staged('diameter', '19'); const before = authority(), beforeCommands = commands(), drafts = current().drafts;
    await newPart(); assert.equal(createButton().disabled, true); assert.ok(button('Review pending dimensions'));
    await click(createButton()); assert.equal(commands(), beforeCommands); assert.deepEqual(current().drafts, drafts);
    await click(button('Review pending dimensions')); assertPanel('dimensions'); assert.equal(input('diameter (mm)').value, '19');
    await newPart(); await click(button('Cancel')); assertClosed(); assert.deepEqual(current().drafts, drafts);
    await newPart(); await key(testid('modeling-options').querySelector(':scope > header h2'), 'Escape');
    assertClosed(); assert.deepEqual(current().drafts, drafts); assert.deepEqual(authority(), before);
    assert.equal(commands(), beforeCommands); await discard();
  });
  await group(async () => {
    await newPart(); await change(diameter(), '21'); await change(thickness(), '8');
    const callbacks = capture(), field = diameter(), before = authority(), beforeCommands = commands(), session = sessions.at(-1).controller;
    await newPart(); assert.equal(diameter(), field); assert.deepEqual(values(), { diameter: '21', thickness: '8' });
    for (const [name, callback] of Object.entries(capture())) assert.equal(callback, callbacks[name], `Same-command ${name} handler identity`);
    await act(async () => { callbacks.change({ target: { value: '22' } }); await tick(); });
    assert.equal(diameter().value, '22');
    await select(0); await select(1); assert.equal(diameter(), field);
    for (const workspace of [false, true]) {
      await rerender({ workspace }); assert.equal(sessions.at(-1).controller, session); assert.equal(testid('modeling-viewport'), viewport);
    }
    assertPanel('new-circular-part'); assert.deepEqual(values(), { diameter: '22', thickness: '8' });
    assert.deepEqual(authority(), before); assert.equal(commands(), beforeCommands);
    await click(button('Cancel')); assertClosed();
  });
  await group(async () => {
    await newPart(); await change(diameter(), '23'); const circleCallbacks = capture();
    await newPart('rectangle'); await change(input('Width (mm)'), '44'); const rectangleCallbacks = capture();
    await assertStale(circleCallbacks); assert.equal(input('Width (mm)').value, '44');
    await newPart(); await change(diameter(), '24'); await assertStale(rectangleCallbacks); assert.equal(diameter().value, '24');
    const closedCallbacks = capture(); await click(button('Close options')); assertClosed();
    await newPart(); await change(diameter(), '25'); await assertStale(closedCallbacks);
    initialCallbacks = capture(); initialSession = sessions.at(-1);
  });
  await group(async () => {
    controls.refuseNextLoad = true; await rerender({ workspace: true, initialAuthoredText: sourceB }); await settled();
    assertClosed(); assert.equal(current().accepted, null); assert.equal(current().authoredText, null); assert.equal(current().display, null);
    assert.equal(current().history.count, 0); assert.match(current().error, /Controlled provider load refusal/);
    assert.equal(initialSession.controller.getSnapshot().disposed, true); assert.equal(displays[0].disposals, 1);
    assert.equal(observers[0].disconnections, 1); assert.equal(testid('modeling-viewport'), viewport);
    activePort = port(); await newPart(); assert.equal(createButton().textContent.trim(), 'Create part');
    await assertStale(initialCallbacks); assert.deepEqual(values(), rawDefaults);
    await click(createButton()); await settled(); assertClosed(); assert.deepEqual(JSON.parse(current().authoredText), expectedSource());
    await newPart(); const sourceA = current().authoredText, fromA = capture(), generation = current().generation;
    await openText(sourceB); assert.equal(current().generation, generation + 1); assert.equal(createButton().disabled, true);
    await assertStale(fromA); await click(button('Cancel')); await newPart(); const fromB = capture();
    await openText(sourceA); assert.equal(current().generation, generation + 2); assert.equal(current().authoredText, sourceA);
    await assertStale(fromA); await assertStale(fromB); await click(button('Cancel')); assertClosed();
    assert.equal(sessions.length, 2); assert.equal(mountedRoots, 1); baselineGeometry();
  });
  await group(async () => {
    await newPart(); await change(diameter(), '19'); await change(thickness(), '5.5');
    const before = authority(), raw = values(), commits = activePort.commits;
    for (const mode of ['provider', 'receiver', 'display']) {
      const prepares = activePort.prepares;
      if (mode === 'provider') controls.refuseNextLoad = true;
      if (mode === 'receiver') controls.refuseNextReceiver = true;
      if (mode === 'display') activePort.refuseNext = true;
      await click(createButton()); await settled();
      assertPanel('new-circular-part'); assert.deepEqual(values(), raw); assert.deepEqual(authority(), before);
      assert.deepEqual(current().drafts, {}); assert.equal(activePort.commits, commits); assert.ok(current().error);
      if (mode === 'provider') assert.match(current().error, /Controlled provider load refusal/);
      if (mode === 'receiver') assert.match(current().error, /volume|family|authored native/i);
      if (mode === 'display') assert.match(current().error, /Controlled display refusal/);
      assert.equal(activePort.prepares, prepares + (mode === 'display' ? 1 : 0)); assert.equal(createButton().disabled, false);
    }
    await click(createButton()); await settled(); assertClosed(); assert.equal(current().error, null);
    assert.deepEqual(JSON.parse(current().authoredText), expectedSource(19, 5.5)); baselineGeometry();
  });
  await group(async () => {
    await openFiles(); await change(input('Saved model data'), baseline.text); await click(consent());
    assert.equal(consent().checked, true); assert.equal(button('Open saved model').disabled, false);
    const before = authority(), commits = activePort.commits;
    await newPart(); await change(diameter(), '20'); activePort.holdNext = true;
    await click(createButton()); await act(async () => { workers.at(-1).accept(); await tick(); });
    assert.equal(current().busy, true); assert.equal(typeof activePort.release, 'function');
    await openFiles(); assert.equal(input('Saved model data').value, baseline.text); assert.equal(consent().checked, true);
    assert.deepEqual(authority(), before); assert.equal(activePort.commits, commits);
    await act(async () => { activePort.release(); await tick(); });
    assert.equal(current().busy, false); assert.equal(current().error, null); assertPanel('files');
    assert.deepEqual(JSON.parse(current().authoredText), expectedSource(20));
    assert.deepEqual(current().history, { index: 0, count: 1, canUndo: false, canRedo: false });
    assert.equal(activePort.commits, commits + 1); assert.equal(input('Saved model data').value, '');
    assert.equal(consent().checked, false); assert.equal(button('Open saved model').disabled, true); baselineGeometry();
  });
  await group(async () => {
    await staged('thickness', '6'); await applyStaged(); assert.equal(current().history.count, 2);
    await newPart(); await change(diameter(), '22'); activePort.holdNext = true;
    await click(createButton()); await act(async () => { workers.at(-1).accept(); await tick(); });
    assert.equal(current().busy, true); assert.equal(typeof activePort.release, 'function');
    await click(button('Cancel computation')); assert.equal(current().busy, false); assertPanel('new-circular-part');
    await click(button('Undo')); await settled(); assert.deepEqual(JSON.parse(current().authoredText), expectedSource(20));
    assert.equal(current().history.canRedo, true); assert.equal(current().history.count, 2);
    await openFiles(); await change(input('Saved model data'), sourceB); await click(consent());
    const before = authority(), commits = activePort.commits;
    await act(async () => { activePort.release(); await tick(); });
    assertPanel('files'); assert.deepEqual(authority(), before); assert.equal(activePort.commits, commits);
    assert.equal(input('Saved model data').value, sourceB); assert.equal(consent().checked, true);
    assert.equal(button('Open saved model').disabled, false); baselineGeometry();
  });
  await group(async () => {
    await select(1); await click(button('Edit extrusion')); assertPanel('extrusion');
    assert.equal(input('Height · thickness (mm)').value, '5');
    await change(input('Height · thickness (mm)'), '6'); assert.deepEqual(current().drafts, { thickness: '6' });
    const beforeThickness = authority(), shows = activePort.previewShows, edits = stats.providerEdits;
    await click(button('Preview dimensions')); await settled(); assert.equal(current().preview.status, 'ready');
    assert.deepEqual(authority(), beforeThickness); assert.equal(activePort.previewShows, shows + 1); assert.ok(activePort.shown);
    assert.match(testid('modeling-options').textContent, /Unapplied draft preview/);
    await click(button('Apply extrusion')); await settled(); assertClosed(); assert.equal(activePort.shown, null);
    assert.deepEqual(JSON.parse(current().authoredText), expectedSource(20, 6)); assert.equal(current().history.count, 2);
    assert.equal(stats.providerEdits, edits + 1, 'Promotion reuses the prepared candidate without a second provider edit');
    await select(0); assert.equal(button('Edit sketch dimensions'), undefined);
    await click(button('Edit model dimensions')); assertPanel('dimensions');
    assert.equal(input('diameter (mm)').value, '20'); assert.equal(input('thickness (mm)').value, '6');
    await change(input('diameter (mm)'), '16'); const beforeDiameter = authority();
    await click(button('Preview dimensions')); await settled(); assert.equal(current().preview.status, 'ready');
    assert.deepEqual(authority(), beforeDiameter); assert.equal(current().preview.parameters.diameter, 16);
    await click(button('Apply dimensions')); await settled(); assertClosed();
    const finalSource = current().authoredText;
    assert.deepEqual(JSON.parse(finalSource), expectedSource(16, 6)); assert.equal(current().history.count, 3);
    await click(button('Undo')); await settled(); assert.deepEqual(JSON.parse(current().authoredText), expectedSource(20, 6));
    await click(button('Redo')); await settled(); assert.equal(current().authoredText, finalSource);
    assert.equal(activePort.previewShows, shows + 2); assert.equal(activePort.previewCommits, 2);
    assert.equal(activePort.previewDisposals, 2); assert.equal(activePort.shown, null);
    unsupported(); baselineGeometry();
  });
  await group(async () => {
    const saved = current().authoredText, secondSession = sessions.at(-1), secondPort = activePort;
    await staged('diameter', '15'); await openFiles(); await change(input('Saved model data'), sourceB);
    assert.match(testid('modeling-save-state').textContent, /Pending dimensions are excluded/);
    assert.match(testid('modeling-save-state').textContent, /16/); assert.match(testid('modeling-save-state').textContent, /15/);
    URL.createObjectURL = blob => { const url = `blob:controlled-circular-${downloads.length}`; downloads.push({ blob, url }); return url; };
    URL.revokeObjectURL = url => revoked.push(url);
    dom.window.HTMLAnchorElement.prototype.click = function () { anchors.push({ href: this.href, download: this.download, connected: this.isConnected }); };
    const before = authority(), beforeCommands = commands();
    await click(button('Download accepted model')); assert.equal(downloads.length, 1);
    const blobText = await downloads[0].blob.text(); assert.equal(blobText, saved); assert.equal(downloads[0].blob.type, 'application/json');
    assert.deepEqual(anchors, [{ href: downloads[0].url, download: 'part.cad.json', connected: true }]);
    assert.deepEqual(revoked, [downloads[0].url]); assert.equal(document.querySelectorAll('a[download]').length, 0);
    assert.deepEqual(authority(), before); assert.deepEqual(current().drafts, { diameter: '15' }); assert.equal(commands(), beforeCommands);
    // The third lifetime actually opens the accepted Blob bytes through the mounted UI's real initializer.
    await rerender({ workspace: true, initialAuthoredText: blobText }); await settled();
    assertClosed(); assert.equal(sessions.length, 3); assert.equal(mountedRoots, 1); assert.equal(current().authoredText, saved);
    assert.equal(secondSession.controller.getSnapshot().disposed, true); assert.equal(secondPort.disposals, 1);
    assert.deepEqual(current().history, { index: 0, count: 1, canUndo: false, canRedo: false });
    assert.deepEqual(current().drafts, {}); activePort = port(); baselineGeometry();
    await newPart(); await change(diameter(), '30'); await assertStale(initialCallbacks); await click(button('Cancel')); assertClosed();
    assert.equal(testid('modeling-viewport'), viewport); assert.equal(displays.length, 3); unsupported();
    await act(async () => { observer().callback([{ target: viewport }]); await tick(); }); assert.equal(activePort.resizes, 1);
    await unmount(); assert.equal(activePort.disposals, 1); assert.equal(observer().disconnections, 1);
    assert.equal(sessions.at(-1).controller.getSnapshot().disposed, true); assert.equal(countCalls('dispose'), 1);
    assert.equal(container.childElementCount, 0); assert.equal(workers.at(-1).terminated, true);
    for (const display of displays) assert.equal(display.candidateDisposals, display.prepares - display.refusedPrepares);
  });
} finally {
  if (reactRoot) await unmount();
  for (const record of displays) if (record.release) record.release();
  URL.createObjectURL = originalCreateURL; URL.revokeObjectURL = originalRevokeURL;
  dom.window.HTMLAnchorElement.prototype.click = originalAnchorClick;
  dom.window.close();
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  }
}
assert.equal(groups.length, 22); assert.equal(mountedRoots, 1); assert.equal(sessions.length, 3);
assert.equal(displays.length, 3); assert.equal(observers.length, 3); assert.equal(stats.replies, 24); assert.equal(stats.nativeCalls, 0);
assert.equal(hash(readFileSync(resolve(root, fixturePath))), fixtureHash);
const sourcePaths = ['packages/barocss-cad-editor/src/modeling-circular-part.ts', 'packages/barocss-cad-editor/src/react/modeling-editor.tsx',
  'packages/barocss-cad-editor/src/react/modeling-workspace.tsx', 'packages/barocss-cad-editor/src/modeling-controller.ts',
  'packages/barocss-cad-editor/src/modeling-engine.ts', 'packages/barocss-cad-editor/src/modeling-scene.ts', 'packages/barocss-cad-editor/src/modeling-circle.ts'];
console.log(JSON.stringify({ status: 'PASS', node: process.version,
  runner: { executable: process.execPath, argv: process.argv.slice(1), command: [process.execPath, ...process.argv.slice(1)].map(value => JSON.stringify(value)).join(' ') },
  groups, replyLedger, mountedRoots, controllerLifetimes: sessions.length, ...stats, runtimeHashes, bundleHashes,
  retainedAssertions: ['whole native body including world/profile source before output binding', 'whole preview before meshId/revision envelope binding', 'accepted positions/normals/UV/indices/bounds/native IDs/source geometry/topology/face ranges/edge lineage unchanged'],
  flowSourceSHA256: hash(readFileSync(fileURLToPath(import.meta.url))),
  sourceHashes: Object.fromEntries(sourcePaths.map(path => [path, hash(readFileSync(resolve(root, path)))])),
  fixture: { path: fixturePath, bytes: fixtureBytes.length, sha256: fixtureHash }, adaptedDefaultSourceSHA256: hash(initialText),
  boundary: 'Actual mounted React, host controls, modeling controller, engine serializer, complete receiver and CPU scene. Controlled provider, Worker, ResizeObserver, display port and download boundary. Every reply reuses the complete genuine center2,-3/diameter8/height6 circle native body and sampled geometry. Origin-zero/edited source and display contexts are explicit mocks. Zero native calls. No geometry recentering, native ID rewriting or new measured dimensions. Certified volume/mass/STL unavailable. WebGPU pixels, native edited-state geometry and physical download/fresh file Open UNRUN.' }));
