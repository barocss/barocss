// #1951: one React root, three controller lifetimes; real controller, serializer and CPU receiver.
// Frozen ledger: 19 grouped cases and at most 24 controlled Worker replies.
// New three-driver source is an adaptation, never a measured native authoring receipt.
// Provider, Worker, ResizeObserver and display-port execution are explicit controlled boundaries.
// Geometry is the genuine retained #1835 baseline for EVERY reply, including edited parameters.
// Edited-state geometry, native execution, WebGPU pixels and physical browser I/O are UNRUN.
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
const fixturePath = 'packages/barocss-cad/test/modeling-constraints-evidence/baseline-transfer.json';
const fixtureBytes = readFileSync(resolve(root, fixturePath));
const fixtureHash = '194b855ed3e862e76c2468cbbcb0d2f21f7b2eda0a217325fa95a32fee226721';
const hash = value => createHash('sha256').update(value).digest('hex');
const baseline = JSON.parse(fixtureBytes), authored = JSON.parse(baseline.text);
const groups = [], sessions = [], workers = [], displays = [], observers = [];
const stats = { replies: 0, providerLoads: 0, providerEdits: 0, previewReplays: 0, nativeCalls: 0 };
const controls = { refuseNextLoad: false };
const globals = new Map();
function setGlobal(name, value) {
  if (!globals.has(name)) globals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}
async function group(name, run) {
  assert.ok(groups.length < 19, 'Frozen nineteen-case ledger ceiling');
  try { await run(); } catch (cause) {
    console.error(JSON.stringify({ group: groups.length + 1, name, status: 'FAIL', ...stats, error: String(cause) }));
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
setGlobal('__modelingNewPartFlow', {
  cad: { model: forbidden, load(text) { stats.providerLoads++;
    if (controls.refuseNextLoad) { controls.refuseNextLoad = false; throw Error('Controlled provider load refusal.'); }
    return providerSnapshot(JSON.parse(text)); } },
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
      accepted: null, holdNext: false, release: null, refuseNext: false, refusedPrepares: 0 };
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
      aspect() { return 1.5; }, dimensions() { return { width: 900, height: 600 }; },
      resize() { record.resizes++; }, dispose() { record.disposals++; },
    };
  },
});
const source = name => resolve(root, `packages/barocss-cad-editor/src/${name}`);
const boundaryPlugin = { name: 'explicit-new-part-boundaries', setup(build) {
  build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\.\/modeling-controller\.js$/ }, () => ({ path: 'controller', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\.\/prism-feature-display\.js$/ }, () => ({ path: 'display', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'workspace-boundary' }));
  build.onLoad({ filter: /.*/, namespace: 'workspace-boundary' }, ({ path }) => ({ resolveDir: root, contents: {
    provider: 'export const {cad,tessellateConvexPlanarSolid,tessellateSurface,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell} = globalThis.__modelingNewPartFlow;',
    legacy: 'export function createPrismFeatureEngine() { return () => { throw Error("Legacy native execution is outside this flow."); }; }',
    controller: `import {createCadEditorModelingController as create} from ${JSON.stringify(source('modeling-controller.ts'))}; export const createCadEditorModelingController = (...args) => globalThis.__modelingNewPartFlow.controller(create, ...args);`,
    display: 'export const createPrismFeatureDisplay = globalThis.__modelingNewPartFlow.display;',
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
    const reply = this.engine(command);
    this.callbacks.get('message')({ data: structuredClone(reply) }); return reply;
  }
});
const React = require('react'), { createRoot } = require('react-dom/client'), { act } = React;
const ui = await bundle('react/modeling-editor.tsx');
const builder = await bundle('modeling-rectangular-part.ts');
const { createRectangularPartSource: createSource } = builder.api;
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
  await act(async () => { reactRoot.render(React.createElement(ui.api.CadEditorModeling, { initialAuthoredText: baseline.text, ...props })); await tick(); });
  await settled();
}
async function rerender(props) {
  await act(async () => { reactRoot.render(React.createElement(ui.api.CadEditorModeling, { initialAuthoredText: baseline.text, ...props })); await tick(); });
}
async function unmount() {
  await act(async () => { reactRoot.unmount(); await tick(); }); reactRoot = null;
}

// The provider replays the same exact retained body for the original and every adapted source.
// No assertion below is evidence that edited dimensions produced new native geometry.
const rawDefaults = { width: '32', height: '24', thickness: '8' };
const expectedSource = (width = 32, height = 24, thickness = 8) => ({
  format: 'barocss-cad-model', schema: 1, units: 'mm', parameters: { width, height, thickness },
  nodes: [
    { kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [{ parameter: 'width' }, { parameter: 'height' }] },
    { kind: 'extrude', sketch: 0, height: { parameter: 'thickness' } },
  ], outputs: { part: { node: 1, side: 'solid' } },
});
const sourceB = signedJSON({ ...authored, parameters: { ...authored.parameters, width: 35 } });
const visible = node => !!node && !node.closest('[hidden]');
const panel = name => testid(`modeling-panel-${name}`);
const assertPanel = name => {
  assert.ok(visible(testid('modeling-options')), 'Options must be visible');
  assert.ok(visible(panel(name)), `${name} panel must be visible`);
};
const assertClosed = () => assert.equal(visible(testid('modeling-options')), false);
const assertOptionsFocus = () => assert.equal(document.activeElement, testid('modeling-options').querySelector(':scope > header h2'));
const width = () => input('Width (mm)');
const profileHeight = () => input('Profile height (mm)');
const thickness = () => input('Thickness (mm)');
const values = () => ({ width: width()?.value, height: profileHeight()?.value, thickness: thickness()?.value });
const createButton = () => button(current().accepted ? 'Replace current model' : 'Create part');
const feature = index => testid('modeling-browser').querySelector(`button[data-feature-index="${index}"]`);
const select = async index => { await click(feature(index)); assert.equal(current().selection, index); };
const newPart = async () => {
  await click(button('New rectangular part')); assertPanel('new-part'); assertOptionsFocus();
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
const countCalls = name => sessions.at(-1).calls.filter(call => call.name === name).length;
const reactCallback = (node, name) => {
  const props = Object.keys(node).find(key => key.startsWith('__reactProps$'));
  assert.ok(props && typeof node[props][name] === 'function', `Actual React ${name} must exist`);
  return node[props][name];
};
const capture = () => ({ change: reactCallback(width(), 'onChange'), apply: reactCallback(createButton(), 'onClick'),
  cancel: reactCallback(button('Cancel'), 'onClick'), key: reactCallback(width(), 'onKeyDown'),
  close: reactCallback(button('Close options'), 'onClick'),
  review: button('Review pending dimensions') ? reactCallback(button('Review pending dimensions'), 'onClick') : null });
const errors = () => [...container.querySelectorAll('[role="alert"]')].map(node => node.textContent);
const assertStale = async callbacks => {
  const before = authority(), beforeDrafts = current().drafts, beforeValues = values(), beforeCommands = commands();
  const beforeErrors = errors(), opens = countCalls('open'), stages = countCalls('stage'), discards = countCalls('discard');
  await act(async () => { callbacks.change({ target: { value: '987' } }); await tick(); });
  await act(async () => { callbacks.apply(); await tick(); });
  await act(async () => { callbacks.cancel(); await tick(); });
  await act(async () => { callbacks.close(); await tick(); });
  if (callbacks.review) await act(async () => { callbacks.review(); await tick(); });
  for (const key of ['Enter', 'Escape']) {
    await act(async () => { callbacks.key({ key, nativeEvent: {}, preventDefault() {}, stopPropagation() {} }); await tick(); });
  }
  assert.deepEqual(authority(), before); assert.deepEqual(current().drafts, beforeDrafts);
  assert.deepEqual(values(), beforeValues); assert.deepEqual(errors(), beforeErrors);
  assert.equal(commands(), beforeCommands); assert.equal(countCalls('open'), opens);
  assert.equal(countCalls('stage'), stages); assert.equal(countCalls('discard'), discards);
  assertPanel('new-part');
};
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
let viewport, activePort, initialCallbacks, initialSession;
try {
  await group('pinned #1835 convex baseline and real React/controller/serializer/CPU receiver imports', () => {
    assert.equal(fixtureBytes.length, 292980); assert.equal(hash(fixtureBytes), fixtureHash);
    assert.equal(signedJSON(authored), baseline.text);
    assert.deepEqual(baseline.parameters, { width: 32, height: 24, lockY: 0 });
    for (const suffix of ['react/modeling-editor.tsx', 'react/modeling-workspace.tsx', 'modeling-rectangular-part.ts',
      'modeling-extrusion-command.ts', 'modeling-controller.ts', 'modeling-scene.ts', 'prism-feature-controller.ts',
      'react/ui/button.tsx', 'react/ui/input.tsx', 'react/ui/label.tsx']) {
      assert.ok(ui.inputs.some(path => path.endsWith(suffix)), `Actual source bundled: ${suffix}`);
    }
    assert.ok(engine.inputs.some(path => path.endsWith('modeling-engine.ts')));
    assert.equal(stats.nativeCalls, 0); assert.equal(sessions.length, 0);
  });
  await group('pure three-driver public source and empty/nonfinite/nonpositive/upper-bound rejection', () => {
    const text = createSource(rawDefaults);
    assert.equal(typeof text, 'string'); assert.deepEqual(JSON.parse(text), expectedSource());
    assert.deepEqual(JSON.parse(createSource({ width: ' 4e1 ', height: '12.5', thickness: '.25' })), expectedSource(40, 12.5, 0.25));
    assert.deepEqual(JSON.parse(createSource({ width: '10000', height: '10000', thickness: '10000' })), expectedSource(10000, 10000, 10000));
    for (const name of ['width', 'height', 'thickness']) {
      for (const raw of ['', ' ', 'NaN', 'Infinity', '-Infinity', '1e309', '0', '-0', '-1', '10000.01', '1e-999']) {
        assert.throws(() => createSource({ ...rawDefaults, [name]: raw }), undefined, `${name}=${JSON.stringify(raw)} must reject`);
      }
    }
    assert.equal(stats.providerLoads, 0); assert.equal(stats.replies, 0);
    console.log(JSON.stringify({ control: 'adapted-public-source', sha256: hash(text), parsed: JSON.parse(text), nativeMeasured: false }));
  });
  await group('CREATE opens local defaults; typing and Cancel preserve accepted source/display/history', async () => {
    await mount({ workspace: true }); viewport = testid('modeling-viewport'); activePort = port();
    assert.ok(viewport); assert.equal(activePort.host, viewport); assert.deepEqual(observer().observed, [viewport]);
    assertClosed(); baselineGeometry();
    const before = authority(), beforeCommands = commands(), stages = countCalls('stage');
    const menu = button('New rectangular part').closest('details'); assert.match(menu.querySelector('summary').textContent, /CREATE/);
    await newPart(); assert.deepEqual(values(), rawDefaults);
    assert.equal(createButton().textContent.trim(), 'Replace current model');
    assert.match(testid('modeling-options').textContent, /replace/i); assert.match(testid('modeling-options').textContent, /history/i);
    assert.equal(panel('new-part').querySelectorAll('input[type="checkbox"]').length, 0);
    await change(width(), '40'); await change(profileHeight(), '30'); await change(thickness(), '10');
    assert.deepEqual(current().drafts, {}); assert.equal(countCalls('stage'), stages);
    assert.deepEqual(authority(), before); assert.equal(commands(), beforeCommands);
    await click(button('Cancel')); assertClosed(); assert.deepEqual(authority(), before);
    assert.equal(document.activeElement, testid('modeling-workspace'));
    assert.equal(testid('modeling-viewport'), viewport); assert.equal(port(), activePort);
  });
  await group('closing and reopening rejects actual callbacks captured from the prior command', async () => {
    await newPart(); await change(width(), '36'); const stale = capture();
    await click(button('Close options')); assertClosed(); await newPart(); await change(width(), '42');
    await assertStale(stale); assert.equal(width().value, '42');
    await click(button('Cancel')); assertClosed(); await newPart();
    initialCallbacks = capture(); initialSession = sessions.at(-1);
  });
  await group('controller B initial refusal exposes Create part without an accepted model', async () => {
    controls.refuseNextLoad = true;
    await rerender({ workspace: true, initialAuthoredText: sourceB }); await settled();
    assertClosed(); assert.equal(current().accepted, null); assert.equal(current().authoredText, null);
    assert.equal(current().display, null); assert.equal(current().history.count, 0);
    assert.match(current().error, /Controlled provider load refusal/);
    assert.equal(initialSession.controller.getSnapshot().disposed, true); assert.equal(displays[0].disposals, 1);
    assert.equal(observers[0].disconnections, 1); assert.equal(testid('modeling-viewport'), viewport);
    await newPart(); assert.equal(createButton().textContent.trim(), 'Create part');
    assert.equal(createButton().disabled, false); assert.deepEqual(values(), rawDefaults);
    await change(width(), '45'); assert.deepEqual(current().drafts, {});
    await click(createButton()); await settled(); assertClosed();
    assert.deepEqual(JSON.parse(current().authoredText), expectedSource(45));
    assert.deepEqual(current().history, { index: 0, count: 1, canUndo: false, canRedo: false }); baselineGeometry();
    await newPart();
  });
  await group('A-to-B-to-A creates three lifetimes and old-controller callbacks cannot mutate reopened A', async () => {
    await rerender({ workspace: true, initialAuthoredText: baseline.text }); await settled(); assertClosed();
    assert.equal(current().authoredText, baseline.text); assert.equal(current().generation, 1);
    assert.equal(sessions.length, 3); assert.equal(mountedRoots, 1); assert.equal(testid('modeling-viewport'), viewport);
    assert.notEqual(sessions.at(-1).controller, initialSession.controller);
    assert.equal(displays[1].disposals, 1); assert.equal(observers[1].disconnections, 1);
    assert.equal(workers[0].terminated, true); assert.equal(workers[1].terminated, true);
    activePort = port(); await newPart(); await change(width(), '46');
    await assertStale(initialCallbacks); assert.equal(width().value, '46'); baselineGeometry();
    await click(button('Cancel')); assertClosed();
  });
  await group('selection and mount-time layout changes preserve creation inputs and controller/display identity', async () => {
    await newPart(); await change(width(), '40'); await change(profileHeight(), '30'); await change(thickness(), '10');
    const before = authority(), field = width(), session = sessions.at(-1).controller, beforeCommands = commands();
    await select(0); await select(1); assert.equal(width(), field); assert.deepEqual(values(), { width: '40', height: '30', thickness: '10' });
    for (const workspace of [false, true]) {
      await rerender({ workspace }); assertPanel('new-part'); assert.equal(width(), field);
      assert.equal(testid('modeling-viewport'), viewport); assert.equal(sessions.at(-1).controller, session); assert.equal(port(), activePort);
    }
    assert.deepEqual(authority(), before); assert.equal(commands(), beforeCommands); assert.deepEqual(current().drafts, {});
    await click(button('Cancel'));
  });
  await group('explicit replacement invokes open once, commits atomically and resets an existing two-entry history', async () => {
    await staged('width', '34');
    let operation; await act(async () => { operation = sessions.at(-1).controller.apply(); await tick(); });
    await settled(); await operation; assert.equal(current().history.count, 2);
    await newPart(); await change(width(), '40'); await change(profileHeight(), '30'); await change(thickness(), '10');
    const before = authority(), opens = countCalls('open'), commits = activePort.commits, edits = stats.providerEdits;
    await click(createButton()); assert.equal(current().busy, true); assertPanel('new-part');
    assert.deepEqual(authority(), before); assert.equal(activePort.commits, commits); assert.equal(countCalls('open'), opens + 1);
    assert.equal(workers.at(-1).requests.at(-1).kind, 'open');
    assert.deepEqual(JSON.parse(workers.at(-1).requests.at(-1).text), expectedSource(40, 30, 10));
    await settled(); assertClosed(); assert.equal(document.activeElement, testid('modeling-workspace'));
    assert.deepEqual(JSON.parse(current().authoredText), expectedSource(40, 30, 10));
    assert.deepEqual(current().history, { index: 0, count: 1, canUndo: false, canRedo: false });
    assert.deepEqual(current().drafts, {}); assert.equal(activePort.commits, commits + 1); assert.equal(stats.providerEdits, edits);
    assert.equal(testid('modeling-viewport'), viewport); assert.equal(sessions.length, 3); baselineGeometry();
  });
  await group('created part remains editable through existing Extrude and Undo with unchanged authored nodes', async () => {
    await select(1); await click(button('Edit extrusion')); assertPanel('extrusion');
    const field = input('Height · thickness (mm)'); assert.ok(field); assert.equal(field.value, '10');
    await change(field, '12'); assert.deepEqual(current().drafts, { thickness: '12' });
    await click(button('Apply extrusion')); await settled(); assertClosed();
    assert.deepEqual(JSON.parse(current().authoredText), expectedSource(40, 30, 12)); assert.equal(current().history.count, 2);
    await click(button('Undo')); await settled(); assert.deepEqual(JSON.parse(current().authoredText), expectedSource(40, 30, 10));
    assert.equal(current().history.canRedo, true); assert.equal(current().history.count, 2); baselineGeometry();
  });
  await group('pending global dimensions block creation; review, Cancel and Escape preserve those drafts', async () => {
    await staged('width', '41'); const before = authority(), beforeCommands = commands(), drafts = current().drafts;
    await newPart(); assert.equal(createButton().disabled, true); assert.ok(button('Review pending dimensions'));
    await click(createButton()); assert.equal(commands(), beforeCommands); assert.deepEqual(current().drafts, drafts);
    await click(button('Review pending dimensions')); assertPanel('dimensions'); assert.deepEqual(current().drafts, drafts);
    await newPart(); await click(button('Cancel')); assertClosed(); assert.deepEqual(current().drafts, drafts);
    await newPart();
    await key(testid('modeling-options').querySelector(':scope > header h2'), 'Escape');
    assertClosed(); assert.deepEqual(current().drafts, drafts); assert.deepEqual(authority(), before);
    assert.equal(commands(), beforeCommands); await discard();
  });
  await group('invalid local raw values never stage model fields or dispatch a Worker request', async () => {
    await newPart(); const before = authority(), beforeCommands = commands(), stages = countCalls('stage');
    for (const [field, raw] of [[width, ''], [profileHeight, '0'], [thickness, '-1'], [width, '10001'], [thickness, 'Infinity']]) {
      await change(field(), raw); assert.equal(createButton().disabled, true);
      await click(createButton()); await key(field(), 'Enter');
      assert.deepEqual(authority(), before); assert.deepEqual(current().drafts, {}); assert.equal(commands(), beforeCommands);
      await change(width(), '32'); await change(profileHeight(), '24'); await change(thickness(), '8');
    }
    assert.equal(createButton().disabled, false); assert.equal(countCalls('stage'), stages);
    await change(width(), '37');
    for (const fields of [{ repeat: true }, { isComposing: true }, { keyCode: 229 }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
      assert.equal((await key(width(), 'Enter', fields)).defaultPrevented, false);
      assert.equal((await key(width(), 'Escape', fields)).defaultPrevented, false); assertPanel('new-part');
    }
    await key(width(), 'Escape'); assertClosed(); assert.deepEqual(authority(), before); assert.equal(commands(), beforeCommands);
  });
  await group('controlled backend refusal preserves authority and creation values before successful retry', async () => {
    await newPart(); await change(width(), '44'); await change(profileHeight(), '28'); await change(thickness(), '9');
    const before = authority(), raw = values(), commits = activePort.commits;
    controls.refuseNextLoad = true; await click(createButton()); await settled();
    assertPanel('new-part'); assert.deepEqual(values(), raw); assert.deepEqual(authority(), before);
    assert.deepEqual(current().drafts, {}); assert.equal(activePort.commits, commits);
    assert.match(current().error, /Controlled provider load refusal/); assert.equal(createButton().disabled, false);
    await click(createButton()); await settled(); assertClosed(); assert.equal(current().error, null);
    assert.deepEqual(JSON.parse(current().authoredText), expectedSource(44, 28, 9)); baselineGeometry();
  });
  await group('controlled display refusal keeps accepted source/display/history and retained inputs recover', async () => {
    await newPart(); await change(width(), '48'); const before = authority(), raw = values(), commits = activePort.commits;
    activePort.refuseNext = true; await click(createButton()); await settled();
    assertPanel('new-part'); assert.deepEqual(values(), raw); assert.deepEqual(authority(), before);
    assert.equal(activePort.commits, commits); assert.match(current().error, /Controlled display refusal/);
    assert.equal(createButton().disabled, false); await click(createButton()); await settled(); assertClosed();
    assert.deepEqual(JSON.parse(current().authoredText), expectedSource(48)); assert.equal(current().error, null); baselineGeometry();
  });
  await group('busy creation protects close; toolbar cancellation fences a late Worker reply and permits retry', async () => {
    await newPart(); await change(width(), '50'); const before = authority(), raw = values(), beforeCommands = commands(), prepares = activePort.prepares;
    await key(width(), 'Enter'); assert.equal(current().busy, true); assert.equal(commands(), beforeCommands + 1);
    const worker = workers.at(-1), request = worker.requests.at(-1);
    assert.equal(createButton().disabled, true); assert.equal(button('Cancel').disabled, true); assert.equal(button('Close options').disabled, true);
    assert.equal(width().disabled, true); await click(button('Close options'));
    await key(testid('modeling-options').querySelector(':scope > header h2'), 'Escape'); assertPanel('new-part');
    await click(button('Cancel computation')); assert.equal(current().busy, false); assertPanel('new-part');
    assert.deepEqual(values(), raw); assert.deepEqual(authority(), before); assert.equal(worker.terminated, true);
    await act(async () => { worker.accept(request); await tick(); });
    assert.deepEqual(authority(), before); assert.equal(activePort.prepares, prepares); assert.deepEqual(values(), raw);
    assert.equal(createButton().disabled, false); await click(createButton()); await settled(); assertClosed();
    assert.deepEqual(JSON.parse(current().authoredText), expectedSource(50)); baselineGeometry();
  });
  await group('identical-source generation replacement invalidates captured creation callbacks without discarding drafts', async () => {
    await newPart(); await change(width(), '53'); await staged('width', '52');
    const stale = capture(), text = current().authoredText, generation = current().generation;
    await openText(text); assert.equal(current().generation, generation + 1); assertPanel('new-part');
    assert.equal(createButton().disabled, true); await staged('width', '51');
    await assertStale(stale); await click(button('Cancel')); assertClosed(); assert.deepEqual(current().drafts, { width: '51' });
    await discard();
  });
  await group('changed-source replacement stales old creation; old async completion cannot close a newer command', async () => {
    await newPart(); await change(width(), '54'); const stale = capture();
    await openText(createSource({ width: '56', height: '24', thickness: '8' })); assertPanel('new-part');
    assert.equal(createButton().disabled, true); await assertStale(stale);
    await click(button('Cancel')); await newPart(); await change(width(), '57'); activePort.holdNext = true;
    await click(createButton()); await act(async () => { workers.at(-1).accept(); await tick(); });
    assert.equal(current().busy, true); assert.equal(typeof activePort.release, 'function');
    const before = authority(), commits = activePort.commits;
    await click(button('Cancel computation')); await click(button('Cancel')); await newPart(); await change(width(), '58');
    await act(async () => { activePort.release(); await tick(); });
    assertPanel('new-part'); assert.equal(width().value, '58'); assert.deepEqual(authority(), before); assert.equal(activePort.commits, commits);
    await click(button('Cancel')); assertClosed();
  });
  await group('successful creation clears old staged file bytes and consent while preserving a newly opened File panel', async () => {
    await click(button('Save or open a model')); assertPanel('files');
    await change(input('Saved model data'), baseline.text);
    const consent = () => panel('files').querySelector('input[type="checkbox"]');
    await click(consent()); assert.equal(consent().checked, true); assert.equal(button('Open saved model').disabled, false);
    const before = authority(), commits = activePort.commits;
    await newPart(); await change(width(), '60'); activePort.holdNext = true;
    await click(createButton()); await act(async () => { workers.at(-1).accept(); await tick(); });
    assert.equal(current().busy, true); assert.equal(typeof activePort.release, 'function');
    await click(button('Save or open a model')); assertPanel('files');
    assert.equal(input('Saved model data').value, baseline.text); assert.equal(consent().checked, true);
    assert.deepEqual(authority(), before); assert.equal(activePort.commits, commits);
    await act(async () => { activePort.release(); await tick(); });
    assert.equal(current().busy, false); assert.equal(current().error, null); assertPanel('files');
    assert.deepEqual(JSON.parse(current().authoredText), expectedSource(60));
    assert.deepEqual(current().history, { index: 0, count: 1, canUndo: false, canRedo: false });
    assert.equal(activePort.commits, commits + 1); baselineGeometry();
    console.log(JSON.stringify({ control: 'file-panel-after-creation', visible: visible(panel('files')),
      stagedTextLength: input('Saved model data').value.length, confirmed: consent().checked }));
    assert.equal(input('Saved model data').value, '', 'Successful creation must clear the prior document staged file bytes');
    assert.equal(consent().checked, false, 'Prior document file replacement consent must not survive successful creation');
    assert.equal(button('Open saved model').disabled, true);
  });
  await group('canceled creation completion cannot clear staged file consent after a newer global Apply', async () => {
    await click(button('Save or open a model')); assertPanel('files');
    await change(input('Saved model data'), baseline.text);
    const consent = () => panel('files').querySelector('input[type="checkbox"]');
    await click(consent()); assert.equal(consent().checked, true);
    const generation = current().generation;
    await newPart(); await change(width(), '62'); activePort.holdNext = true;
    await click(createButton()); await act(async () => { workers.at(-1).accept(); await tick(); });
    assert.equal(current().busy, true); assert.equal(typeof activePort.release, 'function');
    await click(button('Cancel computation')); assert.equal(current().busy, false); assertPanel('new-part');
    await click(button('Edit model dimensions')); assertPanel('dimensions');
    await change(input('width (mm)'), '61'); assert.deepEqual(current().drafts, { width: '61' });
    await click(button('Apply dimensions')); await settled(); assertClosed();
    assert.deepEqual(JSON.parse(current().authoredText), expectedSource(61));
    assert.equal(current().generation, generation + 1); assert.equal(current().history.count, 2);
    await click(button('Save or open a model')); assertPanel('files');
    assert.equal(input('Saved model data').value, baseline.text); assert.equal(consent().checked, true);
    const before = authority(), commits = activePort.commits;
    await act(async () => { activePort.release(); await tick(); });
    assertPanel('files'); assert.deepEqual(authority(), before); assert.equal(activePort.commits, commits);
    console.log(JSON.stringify({ control: 'canceled-creation-after-global-apply', visible: visible(panel('files')),
      stagedTextLength: input('Saved model data').value.length, confirmed: consent().checked }));
    assert.equal(input('Saved model data').value, baseline.text, 'Canceled creation must not clear staged file bytes after another operation admits');
    assert.equal(consent().checked, true, 'Canceled creation must not clear staged file consent after another operation admits');
    assert.equal(button('Open saved model').disabled, false); baselineGeometry();
  });
  await group('existing file/STL/global/Extrude controls remain reachable and one viewport disposes once', async () => {
    await click(button('Save or open a model')); assertPanel('files');
    assert.ok(button('Choose model file')); assert.ok(button('Download model'));
    assert.match(container.querySelector('input[type="file"]').accept, /\.cad\.json/);
    await click(button('Show saved model')); assert.equal(input('Saved model data').value, current().authoredText);
    await click(button('Export accepted STL')); assertPanel('outputs');
    assert.ok(input('STL output')); assert.ok([...input('STL output').options].some(option => option.value === 'part' && !option.disabled));
    await click(button('Edit model dimensions')); assertPanel('dimensions');
    for (const name of ['width', 'height', 'thickness']) assert.ok(visible(input(`${name} (mm)`)), `Global ${name} remains accessible`);
    await click(button('Cancel')); assertClosed(); await select(1); assert.equal(button('Edit extrusion').disabled, false);
    await click(button('Modeling examples')); assertPanel('examples');
    await click(button('Capabilities & limits')); assertPanel('limits');
    assert.equal(testid('modeling-viewport'), viewport); assert.equal(sessions.length, 3); assert.equal(displays.length, 3);
    assert.equal(activePort.disposals, 0); assert.equal(observer().disconnections, 0);
    await act(async () => { observer().callback([{ target: viewport }]); await tick(); }); assert.equal(activePort.resizes, 1);
    await unmount(); assert.equal(activePort.disposals, 1); assert.equal(observer().disconnections, 1);
    assert.equal(sessions.at(-1).controller.getSnapshot().disposed, true); assert.equal(countCalls('dispose'), 1);
    assert.equal(activePort.candidateDisposals, activePort.prepares - activePort.refusedPrepares);
    assert.equal(container.childElementCount, 0); assert.equal(workers.at(-1).terminated, true);
  });
} finally {
  if (reactRoot) await unmount();
  for (const record of displays) if (record.release) record.release();
  dom.window.close();
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  }
}
assert.equal(groups.length, 19); assert.equal(mountedRoots, 1); assert.equal(sessions.length, 3);
assert.equal(displays.length, 3); assert.equal(observers.length, 3); assert.ok(stats.replies <= 24); assert.equal(stats.nativeCalls, 0);
console.log(JSON.stringify({ status: 'PASS', node: process.version,
  runner: { executable: process.execPath, argv: process.argv.slice(1), command: [process.execPath, ...process.argv.slice(1)].map(value => JSON.stringify(value)).join(' ') },
  groups, mountedRoots, controllerLifetimes: sessions.length, ...stats,
  flowSourceSHA256: hash(readFileSync(fileURLToPath(import.meta.url))),
  fixture: { path: fixturePath, sha256: fixtureHash }, adaptedDefaultSourceSHA256: hash(createSource(rawDefaults)),
  boundary: 'Actual mounted React, host controls, modeling controller, engine serializer, receiver and CPU scene. Controlled provider, Worker, ResizeObserver and display port. New three-driver authoring is an adaptation. Every reply reuses genuine #1835 baseline convex geometry. Zero native calls. Edited-state native geometry, WebGPU pixels, physical browser I/O and download acceptance UNRUN.' }));
