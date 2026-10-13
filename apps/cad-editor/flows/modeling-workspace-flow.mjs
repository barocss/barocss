// #1943: mounted React workspace + actual modeling controller, serializer and CPU receiver.
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
const stats = { replies: 0, providerLoads: 0, providerEdits: 0, previewReplays: 0 };
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
const forbidden = () => { throw Error('New native or legacy execution is outside this flow.'); };
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
setGlobal('__modelingWorkspaceFlow', {
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
const boundaryPlugin = { name: 'explicit-workspace-boundaries', setup(build) {
  build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\.\/modeling-controller\.js$/ }, () => ({ path: 'controller', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\.\/prism-feature-display\.js$/ }, () => ({ path: 'display', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'workspace-boundary' }));
  build.onLoad({ filter: /.*/, namespace: 'workspace-boundary' }, ({ path }) => ({ resolveDir: root, contents: {
    provider: 'export const {cad,tessellateConvexPlanarSolid,tessellateSurface,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell} = globalThis.__modelingWorkspaceFlow;',
    legacy: 'export function createPrismFeatureEngine() { return () => { throw Error("Legacy native execution is outside this flow."); }; }',
    controller: `import {createCadEditorModelingController as create} from ${JSON.stringify(source('modeling-controller.ts'))}; export const createCadEditorModelingController = (...args) => globalThis.__modelingWorkspaceFlow.controller(create, ...args);`,
    display: 'export const createPrismFeatureDisplay = globalThis.__modelingWorkspaceFlow.display;',
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
    assert.ok(++stats.replies <= 40, 'Frozen forty-worker-reply ceiling');
    this.answered.add(command.id);
    const reply = this.engine(command);
    this.callbacks.get('message')({ data: structuredClone(reply) }); return reply;
  }
});
const React = require('react'), { createRoot } = require('react-dom/client'), { act } = React;
const ui = await bundle('react/modeling-editor.tsx');
const container = document.getElementById('root');
let reactRoot;
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
const width = () => input('Profile X width (mm)');
const height = () => input('Profile Y height (mm)');
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

// Workspace DOM contract and the bounded fourteen groups follow below.
const visible = node => !!node && !node.closest('[hidden]');
const panel = name => testid(`modeling-panel-${name}`);
const assertPanel = name => {
  assert.ok(visible(testid('modeling-options')), 'Options panel must be visible');
  assert.ok(visible(panel(name)), `${name} panel must be visible`);
};
const assertClosed = () => assert.equal(visible(testid('modeling-options')), false, 'Temporary options must close');
const assertOptionsFocus = () => {
  assert.equal(document.activeElement, testid('modeling-options').querySelector(':scope > header h2'), 'Opening options focuses its visible heading');
  assert.ok(visible(document.activeElement));
};
const assertWorkspaceFocus = () => {
  assert.equal(document.activeElement, testid('modeling-workspace'), 'Dismissal returns focus to the persistent workspace');
  assert.equal(document.activeElement.tabIndex, -1);
};
const edit = async () => { await click(button('Edit dimensions')); assertPanel('dimensions'); assertOptionsFocus(); };
const baselineGeometry = () => {
  const snapshot = current();
  assert.equal(snapshot.display.packet.profile, 'model-outputs');
  assert.equal(snapshot.display.packet.components.length, 1);
  for (const key of ['mesh', 'boundaries', 'internalDiagonals', 'report']) {
    assert.deepEqual(snapshot.display.packet.components[0][key], baseline.preview[key], `Retained genuine baseline ${key}`);
  }
  assert.equal(snapshot.display.scene.geometries[0].positions.length, 24 * 3);
  assert.equal(snapshot.display.scene.geometries[0].indices.length, 12 * 3);
};
try {
  await group('pinned #1835 geometry and actual React/controller/serializer/receiver imports', () => {
    assert.equal(fixtureBytes.length, 292980); assert.equal(hash(fixtureBytes), fixtureHash);
    assert.equal(signedJSON(authored), baseline.text);
    assert.deepEqual(baseline.parameters, { height: 24, lockY: 0, width: 32 });
    assert.equal(baseline.summary.volumeMM3, 6144);
    assert.deepEqual(baseline.summary.boundsMM, { min: [0, 0, 0], max: [32, 24, 8] });
    for (const suffix of ['react/modeling-editor.tsx', 'modeling-controller.ts', 'modeling-scene.ts', 'prism-feature-controller.ts',
      'react/ui/button.tsx', 'react/ui/input.tsx', 'react/ui/label.tsx']) {
      assert.ok(ui.inputs.some(path => path.endsWith(suffix)), `Actual source bundled: ${suffix}`);
    }
    assert.ok(engine.inputs.some(path => path.endsWith('modeling-engine.ts')));
  });
  let viewport, firstPort;
  await group('workspace starts with one persistent viewport and closed dimension options', async () => {
    await mount({ workspace: true });
    assert.ok(testid('modeling-workspace')); assert.ok(testid('modeling-browser'));
    viewport = testid('modeling-viewport'); firstPort = port();
    assert.ok(viewport); assert.equal(firstPort.host, viewport); assert.equal(sessions.length, 1);
    assert.deepEqual(observer().observed, [viewport]); assertClosed();
    assert.equal(visible(width()), false); assert.equal(visible(height()), false);
    assert.equal(current().authoredText, baseline.text); assert.deepEqual(current().accepted.parameters, baseline.parameters);
    assert.equal(current().selection, null); assert.equal(current().error, null); assert.equal(current().history.count, 1);
    assert.equal(firstPort.prepares, 1); assert.equal(firstPort.commits, 1); baselineGeometry();
  });
  await group('Browser feature selection opens actual constrained width and height controls', async () => {
    const features = [...testid('modeling-browser').querySelectorAll('button[data-feature-index]')];
    assert.equal(features.length, baseline.features.length);
    assert.match(features[0].textContent, /Sketch 01/); assert.match(features[1].textContent, /Extrude 01/);
    const before = authority(), beforeCommands = commands();
    await click(features[0]); assert.equal(current().selection, 0); assert.equal(features[0].getAttribute('aria-pressed'), 'true');
    await edit(); assert.ok(visible(width())); assert.ok(visible(height()));
    assert.equal(width().value, '32'); assert.equal(height().value, '24');
    assert.equal(input('lockY (mm)'), null, 'Preset must keep lockY internal');
    assert.deepEqual(authority(), before); assert.equal(commands(), beforeCommands);
    assert.equal(button('Apply dimensions').disabled, true);
  });
  await group('typing a dimension stages only draft state and preserves the accepted display', async () => {
    const before = authority(), beforeCommits = firstPort.commits, beforeCommands = commands();
    await change(width(), '40');
    assert.deepEqual(current().drafts, { width: '40' }); assert.equal(current().accepted.parameters.width, 32);
    assert.deepEqual(authority(), before); assert.equal(firstPort.commits, beforeCommits); assert.equal(commands(), beforeCommands);
    assert.equal(button('Apply dimensions').disabled, false); assert.equal(button('Undo').disabled, true);
    assert.match(container.textContent, /pending/i);
    const session = sessions[0].controller, field = width();
    for (const workspace of [false, true]) {
      await rerender({ workspace });
      assert.ok(testid('modeling-workspace')); assert.equal(testid('modeling-viewport'), viewport);
      assert.equal(width(), field); assert.equal(port(), firstPort); assert.equal(sessions.length, 1);
      assert.equal(sessions[0].controller, session); assert.deepEqual(authority(), before);
      assert.deepEqual(current().drafts, { width: '40' }); assert.equal(commands(), beforeCommands);
      assert.equal(firstPort.commits, beforeCommits); assert.equal(firstPort.disposals, 0);
      assert.deepEqual(observer().observed, [viewport]); assert.equal(observer().disconnections, 0);
    }
  });
  await group('Apply admits a real serialized edit and closes only after accepted display commit', async () => {
    const beforeGeneration = current().generation, beforeCommits = firstPort.commits;
    await click(button('Apply dimensions')); assert.equal(current().busy, true); assertPanel('dimensions');
    assert.equal(current().accepted.parameters.width, 32); assert.equal(firstPort.commits, beforeCommits);
    await settled();
    assert.equal(current().accepted.parameters.width, 40); assert.equal(JSON.parse(current().authoredText).parameters.width, 40);
    assert.deepEqual(current().drafts, {}); assert.equal(current().generation, beforeGeneration + 1);
    assert.equal(current().history.count, 2); assert.equal(firstPort.commits, beforeCommits + 1); assertClosed();
    assertWorkspaceFocus();
    baselineGeometry(); // This is baseline replay, explicitly not width=40 native geometry evidence.
  });
  await group('Undo and Redo retain model history and outside-field keyboard routing', async () => {
    assertWorkspaceFocus();
    const applyUndo = await focusedKey('z', { ctrlKey: true }); assert.equal(applyUndo.defaultPrevented, true);
    await settled(); assert.equal(current().accepted.parameters.width, 32);
    assert.equal(current().history.canRedo, true); assertClosed();
    assertWorkspaceFocus();
    const applyRedo = await focusedKey('z', { metaKey: true, shiftKey: true }); assert.equal(applyRedo.defaultPrevented, true);
    await settled(); assert.equal(current().accepted.parameters.width, 40);
    assert.equal(current().history.canUndo, true); assert.equal(current().history.canRedo, false);
    await edit();
    const beforeCommands = commands();
    width().focus(); assert.equal(document.activeElement, width());
    const event = await focusedKey('z', { ctrlKey: true });
    assert.equal(event.defaultPrevented, false, 'Text-field Undo belongs to text editing');
    assert.equal(commands(), beforeCommands); assert.equal(current().accepted.parameters.width, 40);
    await click(button('Cancel')); assertClosed();
    assertWorkspaceFocus();
    const undo = await focusedKey('z', { ctrlKey: true });
    assert.equal(undo.defaultPrevented, true); await settled(); assert.equal(current().accepted.parameters.width, 32);
    assertWorkspaceFocus();
    const redo = await focusedKey('z', { metaKey: true, shiftKey: true });
    assert.equal(redo.defaultPrevented, true); await settled(); assert.equal(current().accepted.parameters.width, 40);
    await click(button('Inspect selection')); assertPanel('inspect'); assertOptionsFocus();
    const menuUndo = await focusedKey('z', { metaKey: true }); assert.equal(menuUndo.defaultPrevented, true);
    await settled(); assert.equal(current().accepted.parameters.width, 32); assertPanel('inspect'); assertOptionsFocus();
    const menuRedo = await focusedKey('z', { ctrlKey: true, shiftKey: true }); assert.equal(menuRedo.defaultPrevented, true);
    await settled(); assert.equal(current().accepted.parameters.width, 40); assertPanel('inspect'); assertOptionsFocus();
    await click(button('Close options')); assertClosed(); assertWorkspaceFocus();
    await click(button('Undo')); await settled(); assert.equal(current().accepted.parameters.width, 32);
    await click(button('Redo')); await settled(); assert.equal(current().accepted.parameters.width, 40);
    await edit(); await click(button('Cancel')); assertClosed(); assertWorkspaceFocus();
  });
  await group('Cancel and Escape discard drafts while neutral Escape only dismisses options', async () => {
    const before = authority(), beforeCommands = commands();
    await edit(); await change(width(), '44'); await click(button('Cancel'));
    assertClosed(); assertWorkspaceFocus(); assert.deepEqual(current().drafts, {}); assert.deepEqual(authority(), before);
    await edit(); assert.equal(width().value, '40'); await change(height(), '18');
    const escape = await key(height(), 'Escape'); assert.equal(escape.defaultPrevented, true);
    assertClosed(); assertWorkspaceFocus(); assert.deepEqual(current().drafts, {}); assert.deepEqual(authority(), before);
    await edit(); await key(width(), 'Escape'); assertClosed();
    await edit(); await change(width(), '41'); await change(width(), '40');
    await click(button('Apply dimensions')); assertClosed(); assert.deepEqual(current().drafts, {});
    assert.deepEqual(authority(), before, 'No-op Apply closes without a native request or history change');
    await edit(); await change(width(), '45');
    await click(button('Edit dimensions')); assertPanel('dimensions'); assertOptionsFocus();
    assert.deepEqual(current().drafts, { width: '45' }, 'Invoking the same command must preserve its draft');
    assert.deepEqual(authority(), before);
    const menuItem = button('Modeling examples'), menu = menuItem.closest('details'), summary = menu.querySelector('summary');
    await act(async () => { summary.focus(); summary.click(); menuItem.focus(); });
    assert.equal(menu.open, true); assert.equal(document.activeElement, menuItem);
    await focusedKey('Escape'); assert.equal(menu.open, false); assertPanel('dimensions');
    assert.equal(document.activeElement, summary, 'Escape from a menu item restores its still-visible summary');
    assert.ok(visible(summary)); assert.deepEqual(current().drafts, { width: '45' }); assert.deepEqual(authority(), before);
    await focusedKey('Escape'); assertClosed(); assertWorkspaceFocus(); assert.deepEqual(current().drafts, {});
    assert.equal(commands(), beforeCommands);
  });
  await group('provider refusal retains accepted authority, error, editable draft and open options', async () => {
    await edit(); const before = authority(), beforeCommits = firstPort.commits;
    await change(width(), '-1'); await click(button('Apply dimensions')); await settled();
    assertPanel('dimensions'); assert.equal(width().value, '-1'); assert.deepEqual(current().drafts, { width: '-1' });
    assert.match(current().error, /Controlled provider refusal/);
    assert.ok([...container.querySelectorAll('[role="alert"]')].some(node => /Controlled provider refusal/.test(node.textContent)));
    assert.deepEqual(authority(), before); assert.equal(firstPort.commits, beforeCommits);
    assert.equal(button('Apply dimensions').disabled, false); await click(button('Cancel')); assertClosed();
    assert.equal(current().error, null);
  });
  await group('pending dimensions survive Inspect/Files/Limits switching, close and reopen', async () => {
    await edit(); await change(width(), '46'); const before = authority(), beforeCommands = commands();
    for (const [label, name] of [['Inspect selection', 'inspect'], ['Save or open a model', 'files'], ['Capabilities & limits', 'limits']]) {
      await click(button(label)); assertPanel(name); assertOptionsFocus();
      assert.deepEqual(current().drafts, { width: '46' }); assert.deepEqual(authority(), before);
      await click(button('Close options')); assertClosed(); assertWorkspaceFocus();
      await edit(); assert.equal(width().value, '46');
    }
    assert.equal(commands(), beforeCommands); assert.equal(testid('modeling-viewport'), viewport);
    await click(button('Cancel')); assertClosed();
  });
  await group('repeat, IME, modifier and busy keys cannot duplicate Apply or discard work', async () => {
    await edit(); await change(width(), '48'); const beforeCommands = commands();
    for (const fields of [{ repeat: true }, { isComposing: true }, { keyCode: 229 }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
      for (const name of ['Enter', 'Escape']) {
        const event = await key(width(), name, fields); assert.equal(event.defaultPrevented, false);
        assertPanel('dimensions'); assert.deepEqual(current().drafts, { width: '48' });
      }
    }
    assert.equal(commands(), beforeCommands);
    const enter = await key(width(), 'Enter'); assert.equal(enter.defaultPrevented, true);
    assert.equal(current().busy, true); assert.equal(commands(), beforeCommands + 1);
    assert.equal(width().disabled, true); assert.equal(button('Apply dimensions').disabled, true); assert.equal(button('Cancel').disabled, true);
    await click(button('Apply dimensions')); await key(width(), 'Enter'); await key(width(), 'Escape');
    assert.equal(commands(), beforeCommands + 1); assertPanel('dimensions');
    await settled(); assertClosed(); assert.equal(current().accepted.parameters.width, 48);
  });
  await group('stale Apply completion cannot close a different drawer or newer dimension draft', async () => {
    await edit(); await change(width(), '50'); await click(button('Apply dimensions'));
    await click(button('Save or open a model')); assertPanel('files');
    await settled(); assertPanel('files'); assert.equal(current().accepted.parameters.width, 50);
    await edit(); await change(width(), '52'); firstPort.holdNext = true;
    await click(button('Apply dimensions'));
    await act(async () => { workers.at(-1).accept(); await tick(); });
    assert.equal(typeof firstPort.release, 'function'); assert.equal(current().busy, true);
    const before = authority(), beforeCommits = firstPort.commits;
    await click(button('Cancel computation')); assert.equal(current().busy, false);
    await click(button('Cancel')); await edit(); await change(width(), '54');
    await act(async () => { firstPort.release(); await tick(); });
    assertPanel('dimensions'); assert.equal(width().value, '54'); assert.deepEqual(current().drafts, { width: '54' });
    assert.deepEqual(authority(), before); assert.equal(firstPort.commits, beforeCommits);
    await click(button('Apply dimensions')); await settled(); assertClosed(); assert.equal(current().accepted.parameters.width, 54);
  });
  await group('file/STL/examples/limits remain reachable without remounting the viewport or controller', async () => {
    await click(button('Save or open a model')); assertPanel('files');
    const picker = container.querySelector('input[type="file"]'); assert.ok(picker);
    assert.match(picker.accept, /\.cad\.json/); assert.ok(button('Choose model file')); assert.ok(button('Download model'));
    await click(button('Show saved model')); assert.equal(input('Saved model data').value, current().authoredText);
    assert.equal(button('Open saved model').disabled, true, 'Inspecting saved text must not authorize replacement');
    await click(button('Output bodies')); assertPanel('outputs');
    const chooser = input('STL output'); assert.ok(chooser); assert.equal(chooser.value, '');
    assert.equal(button('Download STL').disabled, true);
    assert.ok([...chooser.options].some(option => option.value === 'part' && !option.disabled));
    await click(button('Capabilities & limits')); assertPanel('limits');
    assert.match(panel('limits').textContent, /Extrusion thickness remains 8 mm/);
    assert.match(panel('limits').textContent, /fixed lower corner stays at Y=0/);
    await click(button('Modeling examples')); assertPanel('examples');
    const examples = input('Choose an example'); assert.ok(examples);
    assert.ok([...examples.options].some(option => option.value === 'constrained-plate'));
    assert.equal(button('Load example').disabled, true, 'Drawer access must not authorize replacing the accepted model');
    await click(button('Close options')); assertClosed();
    assert.equal(testid('modeling-viewport'), viewport); assert.equal(sessions.length, 1); assert.equal(displays.length, 1);
    assert.equal(observers.length, 1); assert.equal(firstPort.disposals, 0); assert.equal(observer().disconnections, 0);
    await act(async () => { observer().callback([{ target: viewport }]); await tick(); }); assert.equal(firstPort.resizes, 1);
    await unmount(); assert.equal(firstPort.disposals, 1); assert.equal(observers[0].disconnections, 1);
    assert.equal(sessions[0].calls.filter(call => call.name === 'dispose').length, 1);
    assert.equal(sessions[0].controller.getSnapshot().disposed, true);
  });
  await group('unmount while display acceptance is pending disposes once and ignores late completion', async () => {
    await mount({ workspace: true }); await edit(); await change(width(), '60');
    const pendingPort = port(), mountedSession = sessions.at(-1), mountedObserver = observer();
    pendingPort.holdNext = true; await click(button('Apply dimensions'));
    await act(async () => { workers.at(-1).accept(); await tick(); });
    assert.equal(typeof pendingPort.release, 'function'); const beforeCommits = pendingPort.commits;
    await unmount(); assert.equal(pendingPort.disposals, 1); assert.equal(mountedObserver.disconnections, 1);
    await act(async () => { pendingPort.release(); await tick(); });
    assert.equal(pendingPort.commits, beforeCommits); assert.equal(container.childElementCount, 0);
    assert.equal(mountedSession.controller.getSnapshot().disposed, true);
    assert.equal(mountedSession.calls.filter(call => call.name === 'dispose').length, 1);
    assert.equal(pendingPort.candidateDisposals, pendingPort.prepares);
    assert.equal(workers.at(-1).terminated, true);
  });
  await group('omitted workspace prop preserves the existing embedding and dimension workflow', async () => {
    await mount({});
    assert.equal(testid('modeling-workspace'), null); assert.equal(testid('modeling-options'), null);
    assert.ok(visible(width())); assert.ok(visible(height())); assert.ok(button('Discard draft'));
    assert.equal(button('Edit dimensions'), undefined); assert.equal(button('Edit model dimensions'), undefined);
    assert.ok([...container.querySelectorAll('summary')].some(node => node.textContent === 'Save or open a model'));
    assert.ok([...container.querySelectorAll('h2')].some(node => node.textContent === 'Feature sequence'));
    await change(width(), '36'); await click(button('Apply dimensions')); await settled();
    assert.equal(current().accepted.parameters.width, 36); assert.ok(visible(width()));
    await change(width(), '38');
    const legacyHost = testid('modeling-viewport'), legacyController = sessions.at(-1).controller, legacyAuthority = authority();
    const legacyPort = port(), legacyField = width(), beforeCommands = commands();
    for (const workspace of [true, false]) {
      await rerender({ workspace });
      assert.equal(testid('modeling-workspace'), null); assert.equal(testid('modeling-options'), null);
      assert.equal(testid('modeling-viewport'), legacyHost); assert.equal(width(), legacyField);
      assert.equal(sessions.at(-1).controller, legacyController); assert.equal(port(), legacyPort);
      assert.deepEqual(authority(), legacyAuthority); assert.deepEqual(current().drafts, { width: '38' });
      assert.equal(commands(), beforeCommands); assert.equal(sessions.length, 3); assert.equal(legacyPort.disposals, 0);
      assert.deepEqual(observer().observed, [legacyHost]); assert.equal(observer().disconnections, 0);
    }
    await click(button('Discard draft')); assert.equal(width().value, '36');
    await unmount(); assert.equal(port().disposals, 1); assert.equal(observer().disconnections, 1);
  });
} finally {
  if (reactRoot) await unmount();
  for (const record of displays) if (record.release) record.release();
  dom.window.close();
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  }
}
assert.equal(groups.length, 14); assert.equal(sessions.length, 3);
assert.equal(displays.length, 3); assert.equal(observers.length, 3);
assert.ok(stats.replies <= 40);
console.log(JSON.stringify({ status: 'PASS', groups, mountedSessions: sessions.length, ...stats,
  fixture: { path: fixturePath, sha256: fixtureHash },
  boundary: 'Actual mounted React and host controls, modeling controller, engine serializer, receiver and CPU scene. Controlled provider, Worker, ResizeObserver and display port. All edited replies reuse genuine #1835 baseline geometry; edited native geometry, WebGPU pixels and physical browser file/download acceptance UNRUN.' }));
