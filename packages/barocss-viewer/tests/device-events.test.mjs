import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Deterministic fake GPU core. These tests do not establish real device recovery.
const root = new URL('../../../', import.meta.url);
const built = await build({ stdin: { contents: `export { createViewer } from './packages/barocss-viewer/src/index.ts';`,
  resolveDir: root.pathname }, bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'sources', setup(builder) {
    builder.onResolve({ filter: /^@barocss\// }, async ({ path }) => {
      if (path === '@barocss/gpu/viewer') return { path: 'core', namespace: 'fake-core' };
      const parts = path.split('/'), directory = new URL('packages/barocss-' + parts[1] + '/', root);
      const manifest = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
      const entry = manifest.exports[parts.length === 2 ? '.' : './' + parts.slice(2).join('/')];
      return { path: new URL(typeof entry === 'string' ? entry : entry.import, directory).pathname };
    });
    builder.onLoad({ filter: /.*/, namespace: 'fake-core' }, () => ({
      contents: 'export const createViewer = (...args) => globalThis.__deviceEventCoreCreate(...args);', loader: 'js' }));
  } }] });
const temp = await mkdtemp(tmpdir() + '/viewer-device-events-');
let api;
try {
  await writeFile(temp + '/viewer.mjs', built.outputFiles[0].contents);
  api = await import(pathToFileURL(temp + '/viewer.mjs').href);
} finally { await rm(temp, { recursive: true }); }
globalThis.HTMLCanvasElement = class { width = 800; height = 480; };
const config = () => ({ mmToSceneUnit: .15, background: [0, 0, 0] });
const tick = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
function fakeCore(initialLosses = 0) {
  const core = { stats: { deviceLosses: initialLosses }, onRecover: null,
    computeDevice: null, disposed: false, setSize() {}, dispose() { this.disposed = true; } };
  const makeDevice = () => {
    let lose;
    const device = { lost: new Promise(resolve => { lose = resolve; }), lose };
    // The GPU core registers its listener before it returns the device.
    device.lost.then(() => { core.stats.deviceLosses++; });
    return device;
  };
  core.computeDevice = makeDevice();
  core.recreate = () => { core.computeDevice = makeDevice(); core.onRecover?.(); };
  return core;
}

test('lost and recreated events follow each device and ignore repeated recovery notifications', async () => {
  const core = fakeCore(), events = [];
  globalThis.__deviceEventCoreCreate = async () => core;
  const viewer = await api.createViewer(new HTMLCanvasElement(), { ...config(), onDeviceEvent: event => events.push(event.type) });
  const first = core.computeDevice; first.lose(); await tick();
  assert.deepEqual(events, ['lost']);
  core.recreate(); assert.deepEqual(events, ['lost', 'recreated']);
  core.onRecover(); assert.deepEqual(events, ['lost', 'recreated']);
  const second = core.computeDevice; second.lose(); await tick();
  assert.deepEqual(events, ['lost', 'recreated', 'lost']);
  core.recreate(); assert.deepEqual(events, ['lost', 'recreated', 'lost', 'recreated']);
  viewer.dispose();
});

test('an observed loss before SDK creation is reported without inventing a completed recovery', async () => {
  const core = fakeCore(1), events = [];
  globalThis.__deviceEventCoreCreate = async () => core;
  const pending = api.createViewer(new HTMLCanvasElement(), { ...config(), onDeviceEvent: event => events.push(event.type) });
  const viewer = await pending;
  assert.deepEqual(events, ['lost']);
  core.recreate();
  assert.deepEqual(events, ['lost', 'recreated']);
  viewer.dispose();
});

test('dispose suppresses pending loss and recreation notifications', async () => {
  const core = fakeCore(), events = [];
  globalThis.__deviceEventCoreCreate = async () => core;
  const viewer = await api.createViewer(new HTMLCanvasElement(), { ...config(), onDeviceEvent: event => events.push(event.type) });
  const oldRecover = core.onRecover, device = core.computeDevice;
  viewer.dispose(); device.lose(); oldRecover(); await tick();
  assert.deepEqual(events, []); assert.equal(core.onRecover, null);
});

test('throwing host callbacks cannot interrupt recovery or future loss notification', async () => {
  const core = fakeCore(), events = [];
  globalThis.__deviceEventCoreCreate = async () => core;
  const viewer = await api.createViewer(new HTMLCanvasElement(), { ...config(), onDeviceEvent: event => {
    events.push(event.type); throw new Error('host callback');
  } });
  core.computeDevice.lose(); await tick();
  core.recreate(); core.computeDevice.lose(); await tick();
  assert.deepEqual(events, ['lost', 'recreated', 'lost']);
  viewer.dispose();
});

test('existing options remain valid and optional callback keeps strict data validation', async () => {
  let creates = 0;
  globalThis.__deviceEventCoreCreate = async () => { creates++; return fakeCore(); };
  const viewer = await api.createViewer(new HTMLCanvasElement(), config()); viewer.dispose();
  let getterCalls = 0;
  const accessor = config(); Object.defineProperty(accessor, 'onDeviceEvent', { enumerable: true,
    get() { getterCalls++; throw new Error('getter'); } });
  for (const input of [{ ...config(), onDeviceEvent: null }, { ...config(), onDeviceEvent: 1 },
    { ...config(), onDeviceEvent: undefined }, { ...config(), unknown: true }, accessor])
    await assert.rejects(api.createViewer(new HTMLCanvasElement(), input));
  assert.equal(getterCalls, 0); assert.equal(creates, 1);
});

test('post-creation size and observer setup failures dispose the created core', async () => {
  for (const stage of ['size', 'observer']) {
    const core = fakeCore();
    if (stage === 'size') core.setSize = () => { throw new Error('size failure'); };
    else Object.defineProperty(core, 'stats', { get() { throw new Error('observer failure'); } });
    globalThis.__deviceEventCoreCreate = async () => core;
    await assert.rejects(api.createViewer(new HTMLCanvasElement(), { ...config(), onDeviceEvent() {} }),
      new RegExp(`${stage} failure`));
    assert.equal(core.disposed, true);
    assert.equal(core.onRecover, null);
  }
});

test('creation reports both the original error and a cleanup failure', async () => {
  const core = fakeCore();
  core.setSize = () => { throw new Error('size failure'); };
  core.dispose = () => { throw new Error('dispose failure'); };
  globalThis.__deviceEventCoreCreate = async () => core;
  await assert.rejects(api.createViewer(new HTMLCanvasElement(), config()), error => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors.map(value => value.message), ['size failure', 'dispose failure']);
    return true;
  });
});

test('a Viewer constructor failure disposes the created presenter and suppresses later events', async () => {
  const core = fakeCore(), events = [], canvas = new HTMLCanvasElement();
  canvas.width = 3000; canvas.height = 3000;
  globalThis.__deviceEventCoreCreate = async () => core;
  await assert.rejects(api.createViewer(canvas, { ...config(), onDeviceEvent: event => events.push(event.type) }),
    /Canvas dimensions exceed limits/);
  assert.equal(core.disposed, true); assert.equal(core.onRecover, null);
  core.computeDevice.lose(); await tick();
  assert.deepEqual(events, []);
});

test('Viewer constructor and presenter disposal errors are both retained', async () => {
  const core = fakeCore(), canvas = new HTMLCanvasElement();
  canvas.width = 3000; canvas.height = 3000;
  core.dispose = () => { throw new Error('dispose failure'); };
  globalThis.__deviceEventCoreCreate = async () => core;
  await assert.rejects(api.createViewer(canvas, config()), error => {
    assert.ok(error instanceof AggregateError);
    assert.match(error.errors[0].message, /Canvas dimensions exceed limits/);
    assert.equal(error.errors[1].message, 'dispose failure');
    return true;
  });
});
