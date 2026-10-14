// #1958: one React root, at most three controller lifetimes; real controller, serializer and CPU receiver.
// Frozen ledger: eight grouped cases and at most eight controlled Worker replies.
// New three-driver source is an adaptation, never a measured native authoring receipt.
// Provider, Worker, ResizeObserver and display-port execution are explicit controlled boundaries.
// Geometry is the genuine retained #1835 baseline for EVERY reply, including edited parameters.
// Edited-state geometry, native execution, WebGPU pixels and physical browser I/O are UNRUN.
import assert from 'node:assert/strict';
import { File } from 'node:buffer';
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
  assert.ok(groups.length < 8, 'Frozen eight-case ledger ceiling');
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
setGlobal('__modelingAcceptedSaveFlow', {
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
const boundaryPlugin = { name: 'explicit-accepted-save-boundaries', setup(build) {
  build.onResolve({ filter: /^@barocss\/cad$/ }, () => ({ path: 'provider', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\/prism-feature-engine\.js$/ }, () => ({ path: 'legacy', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\.\/modeling-controller\.js$/ }, () => ({ path: 'controller', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^\.\.\/prism-feature-display\.js$/ }, () => ({ path: 'display', namespace: 'workspace-boundary' }));
  build.onResolve({ filter: /^@barocss\/gpu$/ }, () => ({ path: 'gpu', namespace: 'workspace-boundary' }));
  build.onLoad({ filter: /.*/, namespace: 'workspace-boundary' }, ({ path }) => ({ resolveDir: root, contents: {
    provider: 'export const {cad,tessellateConvexPlanarSolid,tessellateSurface,tessellateOwnPlateCircularHole,tessellateXYCirclePrismShell} = globalThis.__modelingAcceptedSaveFlow;',
    legacy: 'export function createPrismFeatureEngine() { return () => { throw Error("Legacy native execution is outside this flow."); }; }',
    controller: `import {createCadEditorModelingController as create} from ${JSON.stringify(source('modeling-controller.ts'))}; export const createCadEditorModelingController = (...args) => globalThis.__modelingAcceptedSaveFlow.controller(create, ...args);`,
    display: 'export const createPrismFeatureDisplay = globalThis.__modelingAcceptedSaveFlow.display;',
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
    assert.ok(++stats.replies <= 8, 'Frozen eight-worker-reply ceiling');
    this.answered.add(command.id);
    const reply = this.engine(command); this.lastReply = structuredClone(reply);
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
  await act(async () => { reactRoot.render(React.createElement(ui.api.CadEditorModeling, { initialAuthoredText: defaultText, ...props })); await tick(); });
  await settled();
}
async function rerender(props) {
  await act(async () => { reactRoot.render(React.createElement(ui.api.CadEditorModeling, { initialAuthoredText: defaultText, ...props })); await tick(); });
}
async function unmount() {
  await act(async () => { reactRoot.unmount(); await tick(); }); reactRoot = null;
}

// The rectangle and all edited dimensions are authored adaptations; every successful
// engine response reuses unchanged retained #1835 geometry, never new native output.
const defaultText = createSource({ width: '32', height: '24', thickness: '8' });
const defaultData = JSON.parse(defaultText);
const acceptedDefaultText = signedJSON(defaultData);
const defaultHash = 'a354312ac37f51e58f8d94614e11bca9d73b1f17410c1a36eb08f8d9090c06ef';
const otherText = signedJSON({ ...defaultData, parameters: { ...defaultData.parameters, width: 35 } });
const visible = node => !!node && !node.closest('[hidden]');
const panel = name => testid(`modeling-panel-${name}`);
const assertPanel = name => {
  assert.ok(visible(testid('modeling-options')), 'Options must be visible');
  assert.ok(visible(panel(name)), `${name} panel must be visible`);
};
const assertClosed = () => assert.equal(visible(testid('modeling-options')), false);
const assertOptionsFocus = () => assert.equal(document.activeElement, testid('modeling-options').querySelector(':scope > header h2'));
const files = async () => { await click(button('Save or open a model')); assertPanel('files'); };
const downloadButton = () => button(Object.keys(current().drafts).length ? 'Download accepted model' : 'Download model');
const feature = index => testid('modeling-browser').querySelector(`button[data-feature-index="${index}"]`);
const select = async index => { await click(feature(index)); assert.equal(current().selection, index); };
const staged = async (name, raw) => {
  await act(async () => { sessions.at(-1).controller.stage(name, raw); await tick(); });
};
const discard = async () => {
  await act(async () => { sessions.at(-1).controller.discard(); await tick(); });
};
const callCounts = () => Object.fromEntries(['apply', 'discard', 'open', 'stage'].map(name =>
  [name, sessions.reduce((total, item) => total + item.calls.filter(call => call.name === name).length, 0)]));
// Capture real mounted handlers to represent queued callbacks after a rerender.
// No product event handler, controller method or state validation is substituted.
const reactCallback = (node, name) => {
  assert.ok(node, `Expected React ${name} target`);
  const props = Object.keys(node).find(key => key.startsWith('__reactProps$'));
  assert.ok(props && typeof node[props][name] === 'function', `Actual React ${name} must exist`);
  return node[props][name];
};
const capture = () => ({ download: reactCallback(downloadButton(), 'onClick'),
  ...(button('Review dimensions before saving')
    ? { review: reactCallback(button('Review dimensions before saving'), 'onClick') } : {}) });
const errors = () => [...container.querySelectorAll('[role="alert"]')].map(node => node.textContent);
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

// Explicit local mocked browser boundary. Blob is a genuine native JS Blob with
// bytes inspected below; object URLs and anchor dispatch/cleanup are controlled.
// No physical chooser, browser download or disk-persistence assertion is made.
const NativeBlob = globalThis.Blob;
const io = { blobs: [], urls: [], clicks: [], removes: [], revokes: [], anchors: [], failures: {}, serial: 0 };
setGlobal('Blob', class extends NativeBlob {
  constructor(parts, options) { super(parts, options); io.blobs.push(this); }
});
const urlDescriptors = new Map(['createObjectURL', 'revokeObjectURL'].map(name => [name, Object.getOwnPropertyDescriptor(URL, name)]));
Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value(blob) {
  assert.ok(blob instanceof NativeBlob, 'Real Blob crosses the controlled URL boundary');
  const record = { blob, url: null }; io.urls.push(record);
  if (io.failures.createURL) throw Error('Controlled createObjectURL failure');
  record.url = `blob:controlled-model-download/${++io.serial}`; return record.url;
} });
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value(url) {
  io.revokes.push(url);
  assert.ok(io.urls.some(record => record.url === url), 'Only an owned URL can be revoked');
  if (io.failures.revoke) throw Error('Controlled revokeObjectURL failure');
} });
const originalCreateElement = document.createElement;
const nativeRemove = dom.window.Element.prototype.remove;
const unrelated = originalCreateElement.call(document, 'a');
unrelated.href = 'blob:unrelated-control'; unrelated.download = 'unrelated.txt'; document.body.append(unrelated);
document.createElement = function(name, ...args) {
  const element = originalCreateElement.call(this, name, ...args);
  if (String(name).toLowerCase() === 'a') {
    io.anchors.push(element);
    element.click = () => {
      io.clicks.push({ anchor: element, href: element.href, filename: element.download, connected: element.isConnected });
      if (io.failures.click) throw Error('Controlled anchor.click failure');
    };
    element.remove = () => {
      io.removes.push(element);
      if (io.failures.remove) throw Error('Controlled anchor.remove failure');
      nativeRemove.call(element);
    };
  }
  return element;
};
const ioCounts = () => Object.fromEntries(['blobs', 'urls', 'clicks', 'removes', 'revokes', 'anchors'].map(name => [name, io[name].length]));
async function assertBytes(blob, text) {
  assert.equal(blob.type, 'application/json');
  assert.equal(await blob.text(), text);
  assert.deepEqual(Buffer.from(await blob.arrayBuffer()), Buffer.from(text, 'utf8'));
}
function assertUnrelated() {
  assert.equal(unrelated.isConnected, true);
  assert.equal(unrelated.href, 'blob:unrelated-control');
  assert.ok(!io.removes.includes(unrelated));
  assert.ok(!io.revokes.includes(unrelated.href));
}
async function successfulDownload(label) {
  const snapshot = current(), counts = callCounts(), requests = commands(), before = ioCounts();
  await click(downloadButton());
  assert.deepEqual(ioCounts(), Object.fromEntries(Object.entries(before).map(([name, value]) => [name, value + 1])), `${label}: one owned synchronous download`);
  await assertBytes(io.blobs.at(-1), snapshot.authoredText);
  const anchor = io.anchors.at(-1), request = io.clicks.at(-1), url = io.urls.at(-1).url;
  assert.equal(request.anchor, anchor); assert.equal(request.href, url);
  assert.equal(request.filename, 'part.cad.json'); assert.equal(request.connected, true);
  assert.equal(io.removes.at(-1), anchor); assert.equal(anchor.isConnected, false);
  assert.equal(io.revokes.at(-1), url, 'Owned URL cleanup completes immediately without timers');
  assert.deepEqual(current(), snapshot); assert.deepEqual(callCounts(), counts); assert.equal(commands(), requests);
  assertUnrelated(); assertPanel('files');
  assert.ok(!errors().length, `${label}: successful request must not retain an error`);
  assert.doesNotMatch(panel('files').textContent, /saved successfully|download completed|saved to (disk|your computer)/i);
  console.log(JSON.stringify({ control: label, bytes: io.blobs.at(-1).size, sha256: hash(await io.blobs.at(-1).text()), mime: io.blobs.at(-1).type,
    filename: request.filename, ownedAnchorRemoved: !anchor.isConnected, ownedURLRevoked: true, physicalDownload: 'UNRUN' }));
}
function assertTable(expected) {
  const table = panel('files').querySelector('table[aria-label="Accepted and pending dimensions"]');
  assert.ok(table); assert.match(table.tHead.textContent, /Accepted.*Pending/);
  const actual = Object.fromEntries([...table.tBodies[0].rows].map(row =>
    [row.cells[0].textContent, [row.cells[1].textContent, row.cells[2].textContent]]));
  assert.deepEqual(actual, expected, 'Accepted numeric values and verbatim pending raw input are adjacent');
}
async function assertStale(callbacks, label, expectedPanel) {
  const snapshot = current(), beforeIO = ioCounts(), counts = callCounts(), requests = commands();
  const beforeErrors = errors(), beforeFocus = document.activeElement, beforeSource = input('Saved model data')?.value;
  for (const [name, callback] of Object.entries(callbacks)) {
    await act(async () => { callback(); await tick(); });
    assert.deepEqual(current(), snapshot, `${label}: stale ${name} must not alter model state`);
    assert.deepEqual(ioCounts(), beforeIO, `${label}: stale ${name} must not create Blob, URL or anchor`);
    assert.deepEqual(callCounts(), counts); assert.equal(commands(), requests);
    assert.deepEqual(errors(), beforeErrors); assert.equal(document.activeElement, beforeFocus);
    assert.equal(input('Saved model data')?.value, beforeSource);
    if (expectedPanel === null) assertClosed(); else if (expectedPanel) assertPanel(expectedPanel);
  }
  console.log(JSON.stringify({ control: label, callbacks: Object.keys(callbacks), controllerLifetimes: sessions.length,
    generation: current().generation, drafts: snapshot.drafts, noBrowserEffects: true }));
}
const proofPaths = ['packages/barocss-cad-editor/src/react/modeling-editor.tsx',
  'packages/barocss-cad-editor/src/react/modeling-workspace.tsx',
  'packages/barocss-cad-editor/src/modeling-rectangular-part.ts',
  'packages/barocss-cad-editor/src/modeling-controller.ts',
  'packages/barocss-cad-editor/src/modeling-engine.ts',
  'packages/barocss-cad-editor/src/modeling-scene.ts',
  'packages/barocss-cad-editor/src/modeling-file.ts',
  'packages/barocss-cad-editor/src/prism-feature-controller.ts',
  'apps/cad-editor/flows/modeling-accepted-save-flow.mjs'];
const sourceHashes = Object.fromEntries(proofPaths.map(path => [path, hash(readFileSync(resolve(root, path)))]));
console.log(JSON.stringify({ status: 'START', issue: 1958, sourceHashes, fixtureSHA256: hash(fixtureBytes),
  limits: { groups: 8, reactRoots: 1, maximumControllerLifetimes: 3, maximumReplies: 8, nativeCalls: 0 } }));
let viewport, activePort, initialCallbacks, initialAuthority;
const initialDrafts = { width: ' 4e1 ', height: ' 2.5e1 ' };
try {
  await group('hash-pinned retained baseline through actual mounted React/controller/serializer/receiver', async () => {
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
      'prism-feature-controller.ts', 'modeling-file.ts', 'react/ui/button.tsx', 'react/ui/input.tsx', 'react/ui/label.tsx']) {
      assert.ok(ui.inputs.some(path => path.endsWith(suffix)), `Actual source bundled: ${suffix}`);
    }
    assert.ok(engine.inputs.some(path => path.endsWith('modeling-engine.ts')));
    assert.equal(stats.nativeCalls, 0); assert.equal(sessions.length, 0); assert.equal(stats.replies, 0);
    await mount({ workspace: true });
    assert.equal(sessions.length, 1); assert.equal(stats.replies, 1); assert.equal(current().authoredText, acceptedDefaultText);
    viewport = testid('modeling-viewport'); activePort = port(); assert.ok(viewport); assertClosed();
    assert.equal(current().accepted.parameters.width, 32); assert.equal(current().history.count, 1);
    assert.equal(activePort.commits, 1); baselineGeometry(); initialAuthority = authority();
  });
  await group('clean accepted Download model uses exact bytes, MIME, filename and owned immediate cleanup', async () => {
    await files(); await files(); assertOptionsFocus(); assert.ok(button('Download model')); assert.equal(button('Download accepted model'), undefined);
    assert.equal(panel('files').querySelector('table'), null);
    assert.match(testid('modeling-save-state').textContent, /accepted authored model/i);
    assert.match(testid('modeling-save-state').textContent, /Staged file text.*not included/i);
    await successfulDownload('clean-accepted'); assert.deepEqual(authority(), initialAuthority);
  });
  await group('pending accepted-versus-raw values exclude drafts and genuinely staged File bytes', async () => {
    const before = authority();
    for (const [name, raw] of Object.entries(initialDrafts)) await staged(name, raw);
    assertTable({ width: ['32', initialDrafts.width], height: ['24', initialDrafts.height] });
    assert.equal(button('Download model'), undefined); assert.ok(button('Download accepted model'));
    assert.match(testid('modeling-save-state').textContent, /Pending dimensions are excluded/i);
    initialCallbacks = capture(); assert.deepEqual(Object.keys(initialCallbacks), ['download', 'review']);
    const counts = callCounts(), requests = commands();
    const stagedText = signedJSON({ ...defaultData, parameters: { width: 777, height: 888, thickness: 999 } });
    const picker = container.querySelector('input[type="file"]'); assert.ok(picker); assert.match(picker.accept, /\.cad\.json/);
    const file = new File([stagedText], 'different.cad.json', { type: 'application/json' });
    Object.defineProperty(picker, 'files', { configurable: true, value: [file] });
    await act(async () => { picker.dispatchEvent(new Event('change', { bubbles: true })); await tick(); });
    assert.equal(input('Saved model data').value, stagedText); assert.equal(button('Open saved model').disabled, true);
    assert.deepEqual(current().drafts, initialDrafts); assert.deepEqual(authority(), before);
    await successfulDownload('pending-drafts-staged-file-excluded');
    assert.equal(await io.blobs.at(-1).text(), acceptedDefaultText); assert.notEqual(await io.blobs.at(-1).text(), stagedText);
    assert.deepEqual(callCounts(), counts); assert.equal(commands(), requests);
  });
  await group('Review preserves raw drafts and heading focus; only explicit later Apply updates accepted bytes', async () => {
    const before = authority(), drafts = current().drafts, counts = callCounts(), requests = commands();
    await files(); assertOptionsFocus();
    await click(button('Review dimensions before saving')); assertPanel('dimensions'); assertOptionsFocus();
    assert.equal(testid('modeling-options').querySelector(':scope > header h2').textContent, 'Edit model dimensions');
    assert.equal(input('width (mm)').value, initialDrafts.width); assert.equal(input('height (mm)').value, initialDrafts.height);
    assert.deepEqual(current().drafts, drafts); assert.deepEqual(authority(), before);
    assert.deepEqual(callCounts(), counts); assert.equal(commands(), requests);
    await assertStale(initialCallbacks, 'review-leaves-prior-file-epoch', 'dimensions');
    await click(button('Apply dimensions')); assert.equal(current().busy, true); await settled(); assertClosed();
    assert.equal(current().accepted.parameters.width, 40); assert.equal(current().accepted.parameters.height, 25);
    assert.deepEqual(current().drafts, {}); assert.equal(current().generation, before.generation + 1);
    assert.equal(current().history.count, 2); assert.equal(commands(), requests + 1); baselineGeometry();
    await files(); await successfulDownload('explicit-apply-updated-accepted');
    assert.equal(JSON.parse(await io.blobs.at(-1).text()).parameters.width, 40);
    assert.deepEqual(JSON.parse(await io.blobs.at(-1).text()).nodes, defaultData.nodes);
  });
  await group('refused Apply retains accepted download and visible pending raw input', async () => {
    const before = authority(), text = current().authoredText;
    await click(button('Edit model dimensions')); assertPanel('dimensions');
    await change(input('width (mm)'), '-1');
    await click(button('Apply dimensions')); await settled();
    assertPanel('dimensions'); assert.equal(input('width (mm)').value, '-1');
    assert.deepEqual(current().drafts, { width: '-1' }); assert.match(current().error, /Controlled provider refusal/);
    assert.deepEqual(authority(), before); await files(); assertTable({ width: ['40', '-1'] });
    // A successful download must preserve the controller's refused-Apply diagnostic.
    const snapshot = current(), counts = callCounts(), requests = commands(), beforeIO = ioCounts();
    await click(downloadButton()); await assertBytes(io.blobs.at(-1), text);
    assert.equal(io.blobs.length, beforeIO.blobs + 1); assert.equal(io.clicks.length, beforeIO.clicks + 1);
    assert.equal(io.anchors.at(-1).isConnected, false); assert.equal(io.revokes.at(-1), io.urls.at(-1).url);
    assert.deepEqual(current(), snapshot); assert.deepEqual(callCounts(), counts); assert.equal(commands(), requests);
    assert.ok(errors().some(value => /Controlled provider refusal/.test(value))); assertUnrelated();
  });
  await group('captured File callbacks reject draft ABA, busy/generation, panel epoch and controller ABA changes', async () => {
    const draftCallbacks = capture(); await staged('width', '43');
    await assertStale(draftCallbacks, 'changed-draft', 'files');
    await staged('width', '-1'); await assertStale(draftCallbacks, 'draft-A-B-A', 'files');
    const beforeBusy = capture(), text = current().authoredText, generation = current().generation;
    let operation;
    await act(async () => { operation = sessions.at(-1).controller.open(text); await tick(); });
    assert.equal(current().busy, true); assert.equal(downloadButton().disabled, true);
    assert.equal(button('Review dimensions before saving').disabled, true);
    const renderedBusy = capture();
    await assertStale(beforeBusy, 'captured-before-busy', 'files');
    await assertStale(renderedBusy, 'captured-during-busy', 'files');
    await settled(); await operation; assert.equal(current().generation, generation + 1);
    assert.equal(current().authoredText, text);
    await assertStale(beforeBusy, 'same-source-new-generation', 'files');
    await assertStale(renderedBusy, 'finished-busy-callback', 'files');
    await staged('width', '41'); const priorPanel = capture();
    await click(button('New rectangular part')); assertPanel('new-part');
    await assertStale(priorPanel, 'different-active-panel', 'new-part');
    await click(button('Cancel')); assertClosed(); await files();
    await assertStale(priorPanel, 'file-panel-reopened-after-other-panel', 'files');
    const closedFile = capture(); await click(button('Close options')); assertClosed();
    await assertStale(closedFile, 'closed-file-panel', null); await files();
    await assertStale(closedFile, 'same-file-panel-new-epoch', 'files');
    const original = sessions.at(-1), originalPort = activePort, originalObserver = observer();
    await rerender({ workspace: true, initialAuthoredText: otherText }); await settled(); assertClosed();
    assert.equal(current().accepted.parameters.width, 35);
    await rerender({ workspace: true, initialAuthoredText: defaultText }); await settled(); assertClosed();
    assert.equal(current().generation, initialAuthority.generation); assert.equal(current().authoredText, initialAuthority.authoredText);
    assert.equal(sessions.length, 3); assert.equal(mountedRoots, 1); assert.notEqual(sessions.at(-1).controller, original.controller);
    assert.equal(original.controller.getSnapshot().disposed, true); assert.equal(originalPort.disposals, 1); assert.equal(originalObserver.disconnections, 1);
    assert.equal(displays[1].disposals, 1); assert.equal(observers[1].disconnections, 1);
    assert.equal(workers[0].terminated, true); assert.equal(workers[1].terminated, true);
    activePort = port(); assert.equal(testid('modeling-viewport'), viewport); baselineGeometry(); await files();
    for (const [name, raw] of Object.entries(initialDrafts)) await staged(name, raw);
    assert.deepEqual(current().drafts, initialDrafts);
    await assertStale(initialCallbacks, 'controller-A-B-A-identical-source-generation-drafts', 'files');
    await discard(); await staged('width', '33');
  });
  await group('URL creation, anchor click and independent cleanup failures stay honest and own no unrelated resource', async () => {
    const cases = [
      { name: 'create-url-failure', failures: { createURL: true }, requested: false, message: /Could not request.*createObjectURL failure/ },
      { name: 'click-failure', failures: { click: true }, requested: false, message: /Could not request.*anchor\.click failure/ },
      { name: 'remove-failure', failures: { remove: true }, requested: true, message: /Download was requested, but cleanup failed:.*anchor\.remove failure/ },
      { name: 'revoke-failure', failures: { revoke: true }, requested: true, message: /Download was requested, but cleanup failed:.*revokeObjectURL failure/ },
      { name: 'both-cleanup-failures', failures: { remove: true, revoke: true }, requested: true, message: /Download was requested, but cleanup failed:.*anchor\.remove failure.*revokeObjectURL failure/ },
      { name: 'request-and-cleanup-failures', failures: { click: true, remove: true, revoke: true }, requested: false,
        message: /Could not request.*anchor\.click failure.*Download cleanup failed:.*anchor\.remove failure.*revokeObjectURL failure/ },
    ];
    for (const test of cases) {
      const snapshot = current(), counts = callCounts(), requests = commands(), beforeIO = ioCounts();
      io.failures = test.failures;
      await click(downloadButton());
      assert.equal(io.blobs.length, beforeIO.blobs + 1); assert.equal(io.urls.length, beforeIO.urls + 1);
      await assertBytes(io.blobs.at(-1), snapshot.authoredText);
      assert.equal(io.anchors.length, beforeIO.anchors + 1); assert.equal(io.removes.length, beforeIO.removes + 1);
      const anchor = io.anchors.at(-1); assert.equal(io.removes.at(-1), anchor);
      assert.equal(io.clicks.length, beforeIO.clicks + (test.failures.createURL ? 0 : 1));
      assert.equal(io.revokes.length, beforeIO.revokes + (test.failures.createURL ? 0 : 1));
      if (!test.failures.createURL) assert.equal(io.revokes.at(-1), io.urls.at(-1).url, 'URL cleanup is attempted even when remove fails');
      if (!test.failures.remove) assert.equal(anchor.isConnected, false);
      assert.deepEqual(current(), snapshot); assert.deepEqual(callCounts(), counts); assert.equal(commands(), requests);
      const diagnostic = errors().join(' '); assert.match(diagnostic, test.message);
      if (!test.requested) assert.doesNotMatch(diagnostic, /Download was requested/);
      assert.doesNotMatch(diagnostic, /saved successfully|download completed|saved to (disk|your computer)/i); assertUnrelated();
      console.log(JSON.stringify({ control: test.name, browserRequestReturned: test.requested, diagnostic,
        removeAttempted: true, revokeAttempted: !test.failures.createURL, nativeCalls: stats.nativeCalls }));
      // The harness releases a deliberately retained test anchor after observing a
      // reported cleanup failure; this is not counted as successful product cleanup.
      io.failures = {}; nativeRemove.call(anchor);
    }
    await successfulDownload('recovered-download-after-browser-boundary-failures');
  });
  await group('existing New part/Sketch/Extrude/File access and unmount retain accepted authority', async () => {
    await discard(); const before = authority(), requests = commands();
    await click(button('New rectangular part')); assertPanel('new-part'); assertOptionsFocus();
    assert.equal(input('Width (mm)').value, '32'); assert.ok(button('Replace current model'));
    await click(button('Cancel')); assertClosed();
    await select(0); await click(button('Edit sketch dimensions')); assertPanel('sketch'); assertOptionsFocus();
    assert.equal(input('Max X · width (mm)').value, '32'); assert.equal(button('Apply sketch dimensions').disabled, true);
    await key(input('Max X · width (mm)'), 'Escape'); assertClosed();
    await select(1); await click(button('Edit extrusion')); assertPanel('extrusion'); assertOptionsFocus();
    assert.equal(input('Height · thickness (mm)').value, '8'); assert.equal(button('Apply extrusion').disabled, true);
    await click(button('Cancel')); assertClosed();
    await files(); assert.ok(button('Choose model file')); await click(button('Show saved model'));
    assert.equal(input('Saved model data').value, current().authoredText); assert.equal(button('Open saved model').disabled, true);
    await click(button('Export accepted STL')); assertPanel('outputs'); assert.ok(input('STL output'));
    assert.equal(button('Download STL').disabled, true);
    assert.equal(commands(), requests); assert.deepEqual(authority(), before);
    await files(); await staged('width', '34'); const callbacks = capture();
    await click(button('Review dimensions before saving')); assertPanel('dimensions');
    activePort.holdNext = true; await click(button('Apply dimensions'));
    await act(async () => { workers.at(-1).accept(); await tick(); });
    assert.equal(current().busy, true); assert.equal(typeof activePort.release, 'function');
    const acceptedBeforeUnmount = authority(), commits = activePort.commits, pendingWorker = workers.at(-1);
    const acceptedReply = structuredClone(pendingWorker.lastReply);
    assert.equal(testid('modeling-viewport'), viewport); await unmount();
    assert.equal(activePort.disposals, 1); assert.equal(observer().disconnections, 1);
    assert.equal(sessions.at(-1).calls.filter(call => call.name === 'dispose').length, 1);
    assert.equal(current().disposed, true); assert.equal(pendingWorker.terminated, true);
    await act(async () => { activePort.release(); await tick(); });
    assert.deepEqual(authority(), acceptedBeforeUnmount); assert.equal(activePort.commits, commits);
    assert.equal(container.childElementCount, 0); await assertStale(callbacks, 'callbacks-after-unmount');
    const disposed = current();
    // Duplicate delivery of the already computed response adds no native work.
    assert.ok(++stats.replies <= 8, 'Frozen eight-worker-reply ceiling');
    pendingWorker.callbacks.get('message')({ data: structuredClone(acceptedReply) });
    assert.deepEqual(current(), disposed); assert.equal(activePort.commits, commits);
    assert.equal(activePort.candidateDisposals, activePort.prepares); assertUnrelated();
  });
} finally {
  if (reactRoot) await unmount();
  for (const record of displays) if (record.release) record.release();
  document.createElement = originalCreateElement;
  for (const [name, descriptor] of urlDescriptors) {
    if (descriptor) Object.defineProperty(URL, name, descriptor); else delete URL[name];
  }
  dom.window.close();
  for (const [name, descriptor] of globals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
  }
}
assert.equal(groups.length, 8); assert.equal(mountedRoots, 1); assert.equal(sessions.length, 3);
assert.equal(displays.length, 3); assert.equal(observers.length, 3); assert.ok(stats.replies <= 8); assert.equal(stats.nativeCalls, 0);
console.log(JSON.stringify({ status: 'PASS', issue: 1958, node: process.version,
  runner: { executable: process.execPath, argv: process.argv.slice(1), command: [process.execPath, ...process.argv.slice(1)].map(value => JSON.stringify(value)).join(' ') },
  groups, mountedRoots, controllerLifetimes: sessions.length, ...stats, sourceHashes,
  fixture: { path: fixturePath, sha256: fixtureHash }, adaptedDefaultSourceSHA256: defaultHash, browserBoundary: ioCounts(),
  boundary: 'Actual mounted React, host controls, modeling controller, engine serializer, receiver and CPU scene. Controlled provider, Worker, ResizeObserver, display port and browser URL/anchor boundary with genuine Blob/File bytes. The #1951 rectangle and edited dimensions are authored adaptations; all successful replies reuse genuine #1835 convex baseline geometry. Zero native calls. Edited-state native geometry, WebGPU pixels, physical browser file chooser/download and disk persistence UNRUN.' }));
