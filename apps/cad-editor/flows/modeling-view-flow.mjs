// #1965: ten frozen groups, one React root, two controller lifetimes,
// at most 24 controlled Worker replies and zero native executions.
// Actual React/controller/engine/serializer/CPU admission and picking run here.
// Provider codec, edited-state geometry, Worker delivery, display/renderer and
// ResizeObserver are explicit doubles. No native or rendered-pixel claim.
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
const fixturePath = 'packages/barocss-cad/test/modeling-composition-evidence/baseline-transfer.json';
const fixtureBytes = readFileSync(resolve(root, fixturePath));
const fixtureHash = '9a8ac520f0d4577b3a7e0ff411182e1c176eaaf8c73ac75073c129ae6380b79f';
const bracketPath = 'packages/barocss-cad-editor/scripts/fixtures/modeling-composition/bracket-preview.json';
const bracketBytes = readFileSync(resolve(root, bracketPath));
const bracketHash = '419397690a131dd229e1cd03bf112227f529d91a468905c691088b710091544c';
const baseline = JSON.parse(fixtureBytes), bracket = JSON.parse(bracketBytes);
const retainedHash = hash(JSON.stringify(baseline));
const packets = [...bracket.preview, ...baseline.preview];
const groups = [], sessions = [], workers = [], displays = [], observers = [], replyCounts = [], emissions = [];
const ledger = [
  'initial selected label and Top switch',
  'repeated switch has no Worker or authored-state mutation',
  'draft retention and current feature command',
  'computing and ready preview disable both views',
  'Cancel restores accepted Top',
  'Apply Undo Redo keep Top',
  'Isometric output selection and Open persistence',
  'renderer refusal retains prior state',
  'stale source and lifetime callbacks cannot act',
  'resize picking metadata and persistent canvas',
];
const stats = { replies: 0, providerLoads: 0, providerEdits: 0, surfaceReplays: 0, nativeCalls: 0 };
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
    console.error(JSON.stringify({ status: 'FAIL', issue: 1965, group: groups.length + 1, name,
      mountedRoots, controllerLifetimes: sessions.length, ...stats, error: String(cause) }));
    throw cause;
  }
  replyCounts.push(stats.replies - before); groups.push(name);
  console.log(JSON.stringify({ status: 'PASS', group: groups.length, name, replies: replyCounts.at(-1) }));
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  return value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
}
const signedJSON = value => JSON.stringify(canonical(value), (_key, value) => Object.is(value, -0) ? '__NEG_ZERO__' : value)
  .replaceAll('"__NEG_ZERO__"', '-0') + '\n';
const forbidden = () => { stats.nativeCalls++; throw Error('New native or legacy execution is outside this flow.'); };
function providerSnapshot(data) {
  assert.deepEqual(data.nodes, JSON.parse(baseline.text).nodes, 'Only the frozen eight-node graph reaches this provider double');
  assert.deepEqual(data.outputs, JSON.parse(baseline.text).outputs);
  return {
    parameters: structuredClone(data.parameters), suppression: {}, features: structuredClone(baseline.features),
    bodies: structuredClone(baseline.bodies), save: () => signedJSON(data),
    withParameters(changes) {
      stats.providerEdits++;
      // Edited dimensions deliberately replay unchanged native geometry. This is
      // controller/authoring evidence, never new native geometry evidence.
      return providerSnapshot({ ...data, parameters: { ...data.parameters, ...changes } });
    },
    withSuppression: forbidden,
  };
}
setGlobal('__modelingViewFlow', {
  cad: { model: forbidden, load(text) { stats.providerLoads++; return providerSnapshot(JSON.parse(text)); } },
  tessellateConvexPlanarSolid: forbidden,
  tessellateSurface(surface, options) {
    assert.deepEqual(options, { countU: 2, countV: 2, revision: options.revision });
    assert.ok(Number.isSafeInteger(options.revision));
    const entry = packets.find(value => value.surfaceId === surface.id); assert.ok(entry, 'Exact retained Surface packet');
    const native = entry.panelId.startsWith('m4_') ? baseline.bodies.bracket.native : baseline.bodies.slotted.native;
    const source = native.sources.find(value => value.sourceId === entry.sourceId);
    assert.equal(source.panelId, entry.panelId);
    assert.deepEqual(source.model.objects.find(value => value.kind === 'surface' && value.id === entry.surfaceId), surface);
    assert.deepEqual(entry.options, { countU: 2, countV: 2, revision: 0 });
    stats.surfaceReplays++; return structuredClone(entry.result);
  },
  tessellateOwnPlateCircularHole: forbidden, tessellateXYCirclePrismShell: forbidden,
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
      updates: 0, resizes: 0, disposals: 0, width: 900, height: 600, accepted: null,
      visible: null, canvas: null, candidates: [], failNextUpdate: false };
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
      record.candidates.push(candidate); return candidate;
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
const boundaryPlugin = { name: 'explicit-view-boundaries', setup(build) {
  build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\.\/modeling-controller\.js$/ }, () => ({ path: 'controller', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^\.\.\/prism-feature-display\.js$/ }, () => ({ path: 'display', namespace: 'view-boundary' }));
  build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'view-boundary' }));
  build.onLoad({ filter: /.*/, namespace: 'view-boundary' }, ({ path }) => ({ resolveDir: root, contents: {
    provider: 'export const {cad,tessellateConvexPlanarSolid,tessellateSurface,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell} = globalThis.__modelingViewFlow;',
    legacy: 'export function createPrismFeatureEngine() { return () => { throw Error("Legacy native execution is outside this flow."); }; }',
    controller: `import {createCadEditorModelingController as create} from ${JSON.stringify(source('modeling-controller.ts'))}; export const createCadEditorModelingController = (...args) => globalThis.__modelingViewFlow.controller(create, ...args);`,
    display: 'export const createPrismFeatureDisplay = globalThis.__modelingViewFlow.display;',
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
const engine = await bundle('modeling-engine.ts');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://example.invalid/' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'Event', 'MouseEvent', 'navigator']) setGlobal(name, dom.window[name]);
setGlobal('IS_REACT_ACT_ENVIRONMENT', true);
setGlobal('ResizeObserver', class {
  constructor(callback) { this.callback = callback; this.observed = []; this.disconnections = 0; observers.push(this); }
  observe(node) { this.observed.push(node); }
  disconnect() { this.disconnections++; }
});
setGlobal('Worker', class {
  callbacks = new Map(); requests = []; answered = new Set(); computed = new Map(); terminated = false;
  engine = engine.api.createModelingEngine();
  constructor() { workers.push(this); }
  addEventListener(kind, callback) { this.callbacks.set(kind, callback); }
  postMessage(command) { this.requests.push(structuredClone(command)); }
  terminate() { this.terminated = true; }
  accept(command = this.requests.find(item => !this.answered.has(item.id))) {
    assert.ok(command && !this.answered.has(command.id));
    assert.ok(this.requests.slice(0, this.requests.indexOf(command)).every(item => this.computed.has(item.id)), 'Controlled Worker preserves posted order');
    const reply = this.engine(command); this.computed.set(command.id, structuredClone(reply));
    assert.ok(++stats.replies <= 24, 'Frozen 24-controlled-reply ceiling');
    this.answered.add(reply.id); this.lastReply = structuredClone(reply);
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
const authoredAuthority = () => {
  const { accepted, authoredText, drafts, selection, generation, history, workerReady } = current();
  return { accepted, authoredText, drafts, selection, generation, history, workerReady };
};
const commands = () => workers.reduce((sum, worker) => sum + worker.requests.length, 0);
const calls = () => sessions.flatMap(session => session.calls).map(call => call.name);
const errors = () => [...container.querySelectorAll('[role="alert"]')].map(node => node.textContent);
const reactCallback = (node, name = 'onClick') => {
  assert.ok(node, 'Actual React callback target');
  const key = Object.keys(node).find(key => key.startsWith('__reactProps$'));
  assert.ok(key && typeof node[key][name] === 'function'); return node[key][name];
};
const selectedView = view => {
  assert.equal(current().viewOrientation, view);
  assert.equal(button('Top').getAttribute('aria-pressed'), String(view === 'top'));
  assert.equal(button('Isometric').getAttribute('aria-pressed'), String(view === 'isometric'));
  assert.match(testid('modeling-view-controls').textContent, new RegExp(`View: ${view === 'top' ? 'Top' : 'Isometric'}`));
  const camera = current().display.scene.camera, delta = camera.eye.map((value, i) => value - camera.target[i]);
  if (view === 'top') {
    assert.equal(delta[0], 0); assert.ok(delta[1] > 0); assert.equal(delta[2], 0);
    assert.deepEqual(camera.up, [0, 0, -1]);
  } else {
    assert.ok(delta.every(value => value > 0)); assert.ok(Math.abs(delta[1] / delta[0] - .75) < 1e-12);
    assert.ok(Math.abs(delta[2] / delta[0] - 1) < 1e-12); assert.deepEqual(camera.up, [0, 1, 0]);
  }
};
const topScene = display => {
  assert.ok(display); const { eye, target, up } = display.scene.camera;
  assert.equal(eye[0], target[0]); assert.ok(eye[1] > target[1]); assert.equal(eye[2], target[2]);
  assert.deepEqual(up, [0, 0, -1]);
};
const panel = name => testid(`modeling-panel-${name}`);
const assertClosed = () => assert.ok(!testid('modeling-options') || testid('modeling-options').closest('[hidden]'));
const previewButton = () => button('Preview dimensions');
const geometryUnchanged = () => {
  const inspect = component => {
    assert.equal(component.family, 'orthogonal-cell');
    const native = component.qualification.schema === 'barocss-orthogonal-solid-boolean' ? baseline.bodies.slotted.native : baseline.bodies.bracket.native;
    assert.equal(component.qualification.volumeMM3, native.report.volumeMM3);
    for (const chunk of component.mesh.chunks) {
      const entry = packets.find(value => value.panelId === chunk.faceToken); assert.ok(entry);
      assert.deepEqual(chunk.positionsMM, entry.result.packet.positions); assert.deepEqual(chunk.normals, entry.result.packet.normals);
      assert.deepEqual(chunk.parametersUV, entry.result.packet.parameters); assert.deepEqual(chunk.indices, entry.result.packet.indices);
    }
    if (component.lineage.parent) inspect(component.lineage.parent.component);
  };
  current().display.packet.components.forEach(inspect);
  assert.equal(hash(JSON.stringify(baseline)), retainedHash); assert.equal(hash(fixtureBytes), fixtureHash); assert.equal(hash(bracketBytes), bracketHash);
};
async function switchView(label) {
  const before = authoredAuthority(), packet = current().display.packet, requestCount = commands(), worker = workers.at(-1);
  const canvas = port().canvas, prepares = port().prepares, provider = { ...stats };
  await click(button(label)); selectedView(label === 'Top' ? 'top' : 'isometric');
  assert.deepEqual(authoredAuthority(), before); assert.deepEqual(current().display.packet, packet);
  assert.equal(commands(), requestCount); assert.equal(workers.at(-1), worker); assert.deepEqual(stats, provider);
  assert.equal(port().canvas, canvas); assert.equal(port().prepares, prepares);
  assert.equal(canvas.isConnected, true); assert.equal(testid('modeling-viewport').querySelectorAll('canvas').length, 1);
}
async function assertStale(callback, label) {
  const before = current(), beforeCalls = calls(), requestCount = commands(), shown = port().visible;
  const updates = port().updates, focus = document.activeElement, alerts = errors();
  await act(async () => { callback(); await tick(); });
  assert.deepEqual(current(), before, label); assert.deepEqual(calls(), beforeCalls, label);
  assert.equal(commands(), requestCount, label); assert.equal(port().visible, shown, label); assert.equal(port().updates, updates, label);
  assert.equal(document.activeElement, focus, label); assert.deepEqual(errors(), alerts, label);
}
async function assertPreviewViewRefused(callback, reason) {
  const before = current(), shown = port().visible, attempts = port().updateAttempts, requestCount = commands();
  await act(async () => { callback(); await tick(); });
  assert.deepEqual(current(), before); assert.equal(port().visible, shown);
  assert.equal(port().updateAttempts, attempts); assert.equal(commands(), requestCount);
  assert.match(errors().join(' '), reason, 'Controller refuses a queued idle view handler before display mutation');
}
async function openText(text) {
  await click(button('Save or open a model'));
  await change(input('Saved model data'), text);
  const confirm = panel('files').querySelector('input[type="checkbox"]'); assert.ok(confirm);
  if (!confirm.checked) await click(confirm);
  assert.equal(button('Open saved model').disabled, false); await click(button('Open saved model')); await settled();
  assert.equal(current().error, null, errors().join(' ')); assert.deepEqual(JSON.parse(current().authoredText), JSON.parse(text));
}
// Project known native interior points into the camera used by visible geometry.
// These Number-space pixel centres feed the real mounted event and real CPU pick.
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = vector => vector.map(value => value / Math.hypot(...vector));
function project(nativePoint) {
  const camera = port().visible.scene.camera, backward = unit(camera.eye.map((value, i) => value - camera.target[i]));
  const right = unit(cross(camera.up, backward)), vertical = cross(backward, right);
  const world = [nativePoint[0], nativePoint[2], -nativePoint[1]], delta = world.map((value, i) => value - camera.eye[i]);
  const depth = -dot(delta, backward), tangent = Math.tan(camera.fovYDegrees * Math.PI / 360);
  const x = Math.floor((dot(delta, right) / (depth * tangent * port().width / port().height) + 1) * port().width / 2);
  const y = Math.floor((dot(delta, vertical) / (depth * tangent) + 1) * port().height / 2);
  assert.ok(x >= 0 && x < port().width && y >= 0 && y < port().height); return { x, y };
}
async function pickNative(point) {
  const pixel = project(point), rect = testid('modeling-viewport').getBoundingClientRect(), generation = current().generation;
  const clientX = rect.left + (pixel.x + .5) * rect.width / port().width;
  const clientY = rect.top + (port().height - pixel.y - .5) * rect.height / port().height;
  await act(async () => { testid('modeling-viewport').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX, clientY })); await tick(); });
  assert.deepEqual(sessions.at(-1).calls.at(-1), { name: 'pick', args: [port().width, port().height, pixel.x, pixel.y, generation] });
  return current().faceSelection;
}
const proofPaths = ['packages/barocss-cad-editor/src/react/modeling-editor.tsx', 'packages/barocss-cad-editor/src/react/modeling-workspace.tsx',
  'packages/barocss-cad-editor/src/modeling-controller.ts', 'packages/barocss-cad-editor/src/modeling-engine.ts',
  'packages/barocss-cad-editor/src/modeling-composition.ts', 'packages/barocss-cad-editor/src/modeling-union.ts',
  'packages/barocss-cad-editor/src/modeling-scene.ts', 'packages/barocss-cad-editor/src/prism-feature-scene.ts',
  'packages/barocss-cad-editor/src/prism-feature-display.ts', 'apps/cad-editor/flows/modeling-view-flow.mjs'];
const sourceHashes = Object.fromEntries(proofPaths.map(path => [path, hash(readFileSync(resolve(root, path)))]));
const defaultText = baseline.text, otherText = signedJSON({ ...JSON.parse(defaultText), parameters: { ...JSON.parse(defaultText).parameters, legWidth: 12 } });
console.log(JSON.stringify({ status: 'START', issue: 1965, ledger, sourceHashes, fixtures: { composition: fixtureHash, bracket: bracketHash },
  limits: { groups: 10, reactRoots: 1, maximumControllerLifetimes: 2, maximumReplies: 24, nativeCalls: 0 } }));
let viewport, firstLifetimeCallback, idleViewCallback, previewAccepted;
try {
  await group(ledger[0], async () => {
    assert.equal(hash(fixtureBytes), fixtureHash); assert.equal(hash(bracketBytes), bracketHash);
    assert.equal(packets.length, 58); assert.equal(signedJSON(JSON.parse(defaultText)), defaultText);
    for (const suffix of ['react/modeling-editor.tsx', 'react/modeling-workspace.tsx', 'modeling-controller.ts', 'modeling-scene.ts', 'modeling-sketch-command.ts'])
      assert.ok(ui.inputs.some(path => path.endsWith(suffix)), `Actual bundled source: ${suffix}`);
    assert.ok(engine.inputs.some(path => path.endsWith('modeling-engine.ts')));
    assert.ok(++mountedRoots <= 1); reactRoot = createRoot(container);
    await act(async () => { reactRoot.render(React.createElement(ui.api.CadEditorModeling, { workspace: true, initialAuthoredText: defaultText })); await tick(); });
    assert.equal(button('Top').disabled, true); assert.equal(button('Isometric').disabled, true);
    await settled(); assert.equal(current().error, null, errors().join(' ')); assert.equal(stats.replies, 1);
    viewport = testid('modeling-viewport'); viewport.getBoundingClientRect = () => ({ left: 0, top: 0, width: 900, height: 600, right: 900, bottom: 600 });
    selectedView('isometric'); assert.equal(button('Top').disabled, false); assertClosed();
    firstLifetimeCallback = reactCallback(button('Top')); await switchView('Top'); geometryUnchanged();
  });
  await group(ledger[1], async () => {
    const before = current(), updates = port().updates, attempts = port().updateAttempts, snapshots = emissions.length;
    await switchView('Top'); assert.deepEqual(current(), before); assert.equal(port().updates, updates);
    assert.equal(port().updateAttempts, attempts); assert.equal(emissions.length, snapshots, 'Current view is a true no-op');
    await switchView('Isometric'); await switchView('Top'); assert.equal(sessions.length, 1); assert.equal(workers.length, 1);
  });
  await group(ledger[2], async () => {
    await click(testid('modeling-browser').querySelector('button[data-feature-index="2"]'));
    await click(button('Edit sketch dimensions')); assert.match(panel('sketch').textContent, /Sketch 02/);
    await change(input('Max X · legWidth (mm)'), '10'); const before = current();
    const field = input('Max X · legWidth (mm)'), panelNode = panel('sketch');
    await switchView('Isometric'); await switchView('Top');
    assert.deepEqual(current().drafts, { legWidth: '10' }); assert.equal(current().selection, 2);
    assert.equal(panel('sketch'), panelNode); assert.equal(input('Max X · legWidth (mm)'), field); assert.equal(field.value, '10');
    assert.equal(current().generation, before.generation); assert.doesNotMatch(panel('sketch').textContent, /command is stale/);
    assert.equal(previewButton().disabled, false); idleViewCallback = reactCallback(button('Isometric'));
  });
  await group(ledger[3], async () => {
    previewAccepted = current(); const requestCount = commands(), updates = port().updates;
    await click(previewButton()); assert.equal(current().busy, true); assert.equal(current().preview.status, 'computing');
    assert.equal(button('Top').disabled, true); assert.equal(button('Isometric').disabled, true);
    await assertPreviewViewRefused(idleViewCallback, /native operation is in progress/);
    await click(button('Isometric')); assert.equal(commands(), requestCount + 1); assert.equal(port().updates, updates);
    await settled(); assert.equal(current().preview.status, 'ready', errors().join(' ')); assert.equal(current().busy, false);
    assert.equal(button('Top').disabled, true); assert.equal(button('Isometric').disabled, true);
    assert.match(testid('modeling-view-controls').textContent, /[Cc]hoose.*before.*preview/);
    await assertPreviewViewRefused(idleViewCallback, /Apply or cancel the preview/);
    await click(button('Top')); await click(button('Isometric')); assert.equal(port().updates, updates);
    assert.notEqual(port().visible, port().accepted); topScene(port().visible); topScene(port().accepted);
    assert.deepEqual(current().accepted, previewAccepted.accepted); assert.equal(current().authoredText, previewAccepted.authoredText);
    assert.equal(current().generation, previewAccepted.generation); assert.deepEqual(current().history, previewAccepted.history);
  });
  await group(ledger[4], async () => {
    const canvas = port().canvas, display = port().accepted; await click(button('Cancel')); await settled();
    assertClosed(); assert.equal(current().preview, null); assert.deepEqual(current().drafts, {});
    assert.equal(port().visible, display); assert.equal(port().canvas, canvas); assert.equal(canvas.style.visibility, 'visible');
    assert.deepEqual(current().accepted, previewAccepted.accepted); assert.equal(current().authoredText, previewAccepted.authoredText);
    assert.deepEqual(current().history, previewAccepted.history); assert.equal(current().generation, previewAccepted.generation);
    selectedView('top'); assert.equal(button('Top').disabled, false); assert.equal(button('Isometric').disabled, false);
  });
  await group(ledger[5], async () => {
    await click(button('Edit model dimensions')); await change(input('legWidth · leg X width (mm)'), '10');
    const before = current(); await click(previewButton()); await settled(); assert.equal(current().preview.status, 'ready');
    const candidate = port().visible, replays = stats.surfaceReplays, edits = stats.providerEdits;
    await click(button('Apply dimensions')); assert.equal(current().busy, true); await settled();
    assertClosed(); selectedView('top'); topScene(port().accepted); assert.equal(port().accepted, candidate);
    assert.equal(current().accepted.parameters.legWidth, 10); assert.equal(current().history.count, before.history.count + 1);
    assert.equal(current().generation, before.generation + 1); assert.equal(stats.surfaceReplays, replays); assert.equal(stats.providerEdits, edits);
    const appliedText = current().authoredText;
    await click(button('Undo')); await settled(); selectedView('top'); topScene(port().accepted);
    assert.equal(current().authoredText, before.authoredText); assert.equal(current().accepted.parameters.legWidth, 8);
    await click(button('Redo')); await settled(); selectedView('top'); topScene(port().accepted);
    assert.equal(current().authoredText, appliedText); assert.equal(current().accepted.parameters.legWidth, 10);
    assert.equal(current().history.count, before.history.count + 1); geometryUnchanged();
  });
  await group(ledger[6], async () => {
    await switchView('Isometric'); const before = authoredAuthority(), requestCount = commands();
    await click(button('Output bodies')); await change(input('Choose one output to inspect'), 'bracket'); await settled();
    selectedView('isometric'); assert.equal(current().display.selectedOutput, 'bracket'); assert.equal(commands(), requestCount);
    assert.deepEqual(current().accepted, before.accepted); assert.equal(current().authoredText, before.authoredText);
    assert.deepEqual(current().history, before.history); assert.deepEqual(current().drafts, before.drafts);
    await openText(otherText); selectedView('isometric'); assert.equal(current().display.selectedOutput, 'slotted');
    assert.equal(current().history.count, 1); assert.equal(current().accepted.parameters.legWidth, 12); assert.equal(sessions.length, 1);
    assert.equal(testid('modeling-viewport'), viewport); assert.ok(button('Download model')); assert.ok(button('Choose model file'));
    assert.equal(/viewOrientation|camera|isometric/.test(current().authoredText), false, 'View preference is absent from saved source');
  });
  await group(ledger[7], async () => {
    const picked = await pickNative([4, 4, 8]); assert.ok(picked); assert.equal(picked.role, 'slotted');
    const before = current(), shown = port().visible, canvas = port().canvas, requestCount = commands(), updates = port().updates;
    port().failNextUpdate = true; await click(button('Top'));
    assert.deepEqual(current(), before, 'Renderer refusal does not commit camera, display or picking authority');
    selectedView('isometric'); assert.equal(port().visible, shown); assert.equal(port().accepted, shown); assert.equal(port().canvas, canvas);
    assert.equal(port().updates, updates); assert.equal(commands(), requestCount); assert.match(errors().join(' '), /Controlled renderer update refusal/);
    assert.deepEqual(await pickNative([4, 4, 8]), picked, 'Refused camera keeps prior pick metadata');
    await switchView('Top'); await switchView('Isometric');
  });
  await group(ledger[8], async () => {
    const callback = reactCallback(button('Top')), originalText = current().authoredText;
    await openText(defaultText); await openText(originalText);
    await assertStale(callback, 'Accepted-source ABA cannot revive a captured view callback');
    const oldController = sessions.at(-1).controller, oldPort = port(), oldWorker = workers.at(-1);
    // Whitespace changes the mount-time prop but canonical accepted source and
    // generation deliberately match the first lifetime callback's target.
    await act(async () => { reactRoot.render(React.createElement(ui.api.CadEditorModeling, { workspace: true, initialAuthoredText: defaultText + '\n' })); await tick(); });
    await settled(); assert.equal(sessions.length, 2); assert.equal(oldController.getSnapshot().disposed, true);
    assert.equal(oldPort.disposals, 1); assert.equal(oldWorker.terminated, true); assert.equal(testid('modeling-viewport'), viewport);
    assert.equal(current().authoredText, defaultText); assert.equal(current().generation, 1); selectedView('isometric');
    await assertStale(firstLifetimeCallback, 'Disposed controller callback cannot affect same-generation same-source replacement');
    await switchView('Top');
  });
  await group(ledger[9], async () => {
    const canvas = port().canvas, requestCount = commands(), before = authoredAuthority(), prepares = port().prepares;
    const picked = await pickNative([4, 4, 8]); assert.ok(picked); assert.equal(picked.family, 'orthogonal-cell');
    assert.equal(picked.role, 'slotted'); assert.equal(picked.solidId, current().accepted.outputs.find(output => output.name === 'slotted').solidId);
    assert.equal(picked.documentId, current().accepted.documentId); assert.equal(picked.revision, current().accepted.revision);
    assert.equal(picked.generation, current().generation); assert.equal(picked.approximate, true);
    assert.equal(picked.reference.nativeFaceId, picked.provenance.id); assert.equal(await pickNative([20, 4, 8]), null, 'Retained through-slot is a Top ray miss');
    const camera = current().display.scene.camera;
    port().width = 600; port().height = 900;
    await act(async () => { observers.at(-1).callback([]); await tick(); });
    assert.equal(port().resizes, 1); assert.equal(canvas.width, 600); assert.equal(canvas.height, 900);
    selectedView('top'); assert.deepEqual(current().display.scene.camera, camera); assert.deepEqual(port().visible.scene.camera, camera);
    const resized = await pickNative([4, 4, 8]); assert.ok(resized); assert.deepEqual(resized.reference, picked.reference);
    assert.equal(resized.generation, picked.generation); assert.equal(await pickNative([20, 4, 8]), null);
    await switchView('Isometric'); await switchView('Top'); assert.ok(await pickNative([4, 4, 8]));
    assert.equal(await pickNative([20, 4, 8]), null); assert.equal(port().canvas, canvas); assert.equal(canvas.isConnected, true);
    assert.equal(port().prepares, prepares); assert.equal(commands(), requestCount); assert.deepEqual(authoredAuthority(), before);
    assert.equal(testid('modeling-viewport'), viewport); assert.equal(viewport.querySelectorAll('canvas').length, 1); geometryUnchanged();
  });
} finally {
  if (reactRoot) await act(async () => { reactRoot.unmount(); await tick(); });
  dom.window.close();
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  }
}
assert.deepEqual(groups, ledger); assert.equal(mountedRoots, 1); assert.equal(sessions.length, 2);
assert.equal(displays.length, 2); assert.equal(observers.length, 2); assert.ok(stats.replies <= 24); assert.equal(stats.nativeCalls, 0);
assert.ok(workers.every(worker => worker.terminated)); assert.ok(observers.every(observer => observer.disconnections === 1));
console.log(JSON.stringify({ status: 'PASS', issue: 1965, node: process.version,
  runner: { executable: process.execPath, argv: process.argv.slice(1), command: [process.execPath, ...process.argv.slice(1)].map(value => JSON.stringify(value)).join(' ') },
  groups, replyCounts, mountedRoots, controllerLifetimes: sessions.length, workerInstances: workers.length,
  emittedSnapshots: emissions.length, ...stats, sourceHashes,
  fixtures: [{ path: fixturePath, sha256: fixtureHash }, { path: bracketPath, sha256: bracketHash }],
  retainedGeometry: { unionVolumeMM3: 3072, cutVolumeMM3: 2816, parentRawSamples: 14, finalRawSamples: 44,
    editedLegWidthGeometry: 'UNRUN; complete unchanged retained native geometry replayed explicitly' },
  boundaries: { actual: ['React', 'controller', 'engine', 'serializer projection', 'CPU scene admission', 'CPU native picking', 'DOM view buttons and event callbacks'],
    controlled: ['provider codec and parameter snapshot', 'edited-state geometry', 'Worker delivery', 'display-port and renderer', 'ResizeObserver'],
    unrun: ['new native geometry', 'source-exact edited geometry', 'physical browser', 'WebGPU pixels', 'physical file chooser or disk I/O'] } }));
