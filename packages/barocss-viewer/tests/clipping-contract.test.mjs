// Actual SDK Viewer -> Presenter -> Core Camera, plus public CPU picking. No native pixels or GPU transport proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Match the existing Viewer tests' own-source loader; no stale dist or alternate implementation is imported.
const root = new URL('../../../', import.meta.url);
const built = await build({ stdin: { contents: `export { Viewer } from './packages/barocss-viewer/src/index.ts';
export { Presenter } from './packages/barocss-viewer/src/presenter.ts';
export { Viewer as CoreViewer, Camera } from '@barocss/gpu/viewer';`, resolveDir: root.pathname },
  bundle: true, platform: 'node', format: 'esm', write: false,
  plugins: [{ name: 'own-source', setup(builder) {
    builder.onResolve({ filter: /^@barocss\// }, async ({ path }) => {
      const parts = path.split('/'), directory = new URL('packages/barocss-' + parts[1] + '/', root);
      const manifest = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
      const entry = manifest.exports[parts.length === 2 ? '.' : './' + parts.slice(2).join('/')];
      return { path: new URL(typeof entry === 'string' ? entry : entry.import, directory).pathname };
    });
  } }] });
const temp = await mkdtemp(tmpdir() + '/viewer-clipping-');
let api;
try { await writeFile(temp + '/source.mjs', built.outputFiles[0].contents); api = await import(pathToFileURL(temp + '/source.mjs').href); }
finally { await rm(temp, { recursive: true }); }

class Canvas { width = 320; height = 240; getBoundingClientRect() { return { width: this.width, height: this.height }; } }
const canvasDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'HTMLCanvasElement');
Object.defineProperty(globalThis, 'HTMLCanvasElement', { configurable: true, value: Canvas });
test.after(() => { if (canvasDescriptor) Object.defineProperty(globalThis, 'HTMLCanvasElement', canvasDescriptor); else Reflect.deleteProperty(globalThis, 'HTMLCanvasElement'); });
const camera = (near = 0.01, far = 100) => ({ eye: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0], fovY: 90, near, far });
const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

function fixture(scale = 1) {
  const canvas = new Canvas(), core = Object.create(api.CoreViewer.prototype);
  Object.assign(core, { disposed: false, geometries: new Set(), meshes: [], costRecords: new Map(), freeSlots: [], nextSlot: 0, nextId: 1,
    pickSceneRevision: 0, objectCapacity: 1024, scene: null, canvas, camera: new api.Camera(), grid: { visible: false },
    lights: [], environment: {}, options: {}, scheduled: 0, pathTraces: new Set(), pendingPathTraces: 0, textures: new Set(), shadowFrameBuffers: [], waiters: [] });
  core.requestRender = () => {};
  const presenter = new api.Presenter(core);
  const viewer = new api.Viewer(canvas, { mmToSceneUnit: scale, background: [0, 0, 0] }, presenter);
  // Independent literal geometry: both packets display the same scene-unit square at z=0.
  const edge = scale === 1 ? 4 : 4000;
  const packet = { version: 0, surfaceId: 'literal-square', revision: 0, lengthUnit: 'mm', coordinateSystem: 'right-handed-z-up', winding: 'ccw',
    positions: [-edge, -edge, 0, edge, -edge, 0, edge, edge, 0, -edge, edge, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2, 0, 2, 3], parameters: [0, 0, 1, 0, 1, 1, 0, 1],
    bounds: { min: [-edge, -edge, 0], max: [edge, edge, 0] } };
  viewer.setPackets([{ modelId: 'literal', packet }]);
  return { viewer, core, presenter, packet };
}
function projectedDepth(core, point) {
  const m = core.prepareCamera(); // Real frame preparation must preserve manual near/far.
  const z = m[2] * point[0] + m[6] * point[1] + m[10] * point[2] + m[14];
  const w = m[3] * point[0] + m[7] * point[1] + m[11] * point[2] + m[15];
  return z / w;
}
function checkHit(hit, position, distance) {
  assert.ok(hit); assert.deepEqual(hit.ref, { modelId: 'literal', surfaceId: 'literal-square' });
  for (let i = 0; i < 3; i++) close(hit.positionScene[i], position[i]);
  close(hit.distanceScene, distance);
}

test('SDK clipping uses closed axial near/far planes and Presenter preserves them through frame preparation', () => {
  const f = fixture(), source = structuredClone(f.packet);
  try {
    // The literal square is exactly six scene units from the camera along its forward axis.
    for (const [near, far, accepted] of [[0.01, 100, true], [6, 100, true], [6.125, 100, false], [0.01, 6, true], [0.01, 5.875, false]]) {
      f.viewer.setView(camera(near, far));
      const depth = projectedDepth(f.core, [0, 0, 0]);
      assert.equal(f.core.camera.autoClip, false);
      assert.equal(f.core.camera.near, near); assert.equal(f.core.camera.far, far);
      const hit = f.viewer.pick(160, 120);
      if (accepted) { checkHit(hit, [0, 0, 0], 6); assert.ok(depth >= -1e-12 && depth <= 1 + 1e-12); }
      else { assert.equal(hit, null); assert.ok(depth < 0 || depth > 1); }
    }
    assert.deepEqual(f.packet, source);
  } finally { f.presenter.dispose(); }
});

test('SDK clipping uses scene depth rather than off-axis ray distance, independently of mm scale and nonunit up', () => {
  for (const scale of [1, 0.001]) {
    const f = fixture(scale);
    try {
      // FOV90, aspect4/3, x220/y120 reaches [3,0,0]: axial depth6, distance sqrt(3^2+6^2).
      f.viewer.setView({ ...camera(5, 6.25), up: [0, 7, 0] });
      checkHit(f.viewer.pick(220, 120), [3, 0, 0], Math.sqrt(45));
      projectedDepth(f.core, [3, 0, 0]);
      assert.equal(f.core.camera.near, 5); assert.equal(f.core.camera.far, 6.25, 'camera clips are scene units, never scaled again');
      f.viewer.setView({ ...camera(6.25, 7), up: [0, 7, 0] });
      assert.equal(f.viewer.pick(220, 120), null, 'ray distance is inside but axial depth is before near');
      assert.ok(projectedDepth(f.core, [3, 0, 0]) > 1);
    } finally { f.presenter.dispose(); }
  }
});

test('SDK rejects invalid camera clips before replacing accepted camera, scene or CPU hit', () => {
  const f = fixture();
  try {
    for (const valid of [camera(0.0001, 100), camera(1, 10000)]) {
      f.viewer.setView(valid);
      checkHit(f.viewer.pick(160, 120), [0, 0, 0], 6);
      projectedDepth(f.core, [0, 0, 0]);
      assert.equal(f.core.camera.near, valid.near); assert.equal(f.core.camera.far, valid.far);
    }
    f.viewer.setView(camera(2, 8));
    const accepted = f.viewer.getState(), meshes = [...f.core.meshList];
    const coreState = { near: f.core.camera.near, far: f.core.camera.far, autoClip: f.core.camera.autoClip };
    for (const invalid of [{ near: Infinity }, { far: Infinity }, { near: NaN }, { far: NaN }, { near: 0 }, { far: 2 }, { far: 10001 }]) {
      assert.throws(() => f.viewer.setView({ ...camera(2, 8), ...invalid }));
      assert.deepEqual(f.viewer.getState(), accepted);
      assert.deepEqual(f.core.meshList, meshes);
      assert.deepEqual({ near: f.core.camera.near, far: f.core.camera.far, autoClip: f.core.camera.autoClip }, coreState);
      checkHit(f.viewer.pick(160, 120), [0, 0, 0], 6);
    }
  } finally { f.presenter.dispose(); }
});

test('SDK camera replacement and Core manual-auto/projection transitions use the current clipping policy', () => {
  const f = fixture();
  try {
    f.viewer.setView(camera(2, 8));
    close(projectedDepth(f.core, [0, 0, 4]), 1); close(projectedDepth(f.core, [0, 0, -2]), 0);
    f.core.camera.projection = 'orthographic';
    close(projectedDepth(f.core, [0, 0, 4]), 1); close(projectedDepth(f.core, [0, 0, -2]), 0);
    f.core.camera.autoClip = true;
    f.core.prepareCamera();
    assert.notEqual(f.core.camera.near, 2, 'default auto fitting remains active when explicitly restored');
    f.core.camera.projection = 'perspective'; f.core.prepareCamera();
    assert.equal(f.core.camera.far, Infinity);
    // A later SDK camera takes ownership again, replacing the previous auto/orthographic policy.
    f.viewer.setView({ ...camera(1, 9), eye: [0, 0, 8], target: [0, 0, 2] });
    assert.equal(f.core.camera.projection, 'perspective'); assert.equal(f.core.camera.autoClip, false);
    close(projectedDepth(f.core, [0, 0, 7]), 1); close(projectedDepth(f.core, [0, 0, -1]), 0);
    checkHit(f.viewer.pick(160, 120), [0, 0, 0], 8);
  } finally { f.presenter.dispose(); }
});

test('Core default auto clipping preserves the exact infinite reversed projection; manual finite endpoints remain reversed', () => {
  const c = new api.Camera({ position: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0], fovY: 90 });
  assert.equal(c.autoClip, true);
  c.clip({ min: [-1, -1, -1], max: [1, 1, 1] });
  assert.equal(c.far, Infinity);
  assert.equal(c.near, 6 - Math.hypot(1, 1, 1) * 1.05, 'literal box fit keeps the original near value');
  const focal = 1 / Math.tan(Math.PI / 4), expected = new Float64Array(16);
  expected[0] = focal / 2; expected[5] = focal; expected[11] = -1; expected[14] = c.near;
  assert.deepEqual(new Uint8Array(c.projectionMatrix(2).buffer), new Uint8Array(expected.buffer), 'default infinite path retains its numeric bits');
  c.autoClip = false; c.near = 2; c.far = 8;
  const m = c.projectionMatrix(1), depth = distance => (m[10] * -distance + m[14]) / distance;
  close(depth(2), 1); close(depth(8), 0); assert.ok(depth(1.875) > 1); assert.ok(depth(8.125) < 0);
  c.autoClip = true; c.clip({ min: [-1, -1, -1], max: [1, 1, 1] });
  assert.equal(c.far, Infinity);
  assert.deepEqual(new Uint8Array(c.projectionMatrix(2).buffer), new Uint8Array(expected.buffer), 'restored auto mode returns to the original infinite projection bits');
});

test('manual Core clipping validates projection-specific planes without changing automatic or orthographic negative-near contracts', () => {
  const c = new api.Camera();
  c.autoClip = false; c.projection = 'perspective'; c.near = 2; c.far = 8;
  for (const invalid of [{ near: NaN }, { near: Infinity }, { near: -Infinity }, { near: 0 }, { near: -0 }, { near: -1 },
    { far: NaN }, { far: -Infinity }, { far: 0 }, { far: -0 }, { far: 1 }, { far: 2 }]) {
    Object.assign(c, { near: 2, far: 8 }, invalid);
    assert.throws(() => c.projectionMatrix(1), error => error.code === 'CLIP_INVALID');
  }
  c.near = 2; c.far = Infinity;
  const infinite = c.projectionMatrix(1);
  assert.equal(infinite[10], 0); assert.equal(infinite[14], 2, 'manual perspective Infinity remains the infinite reversed path');
  c.projection = 'orthographic'; c.near = -2; c.far = 8;
  const orthographic = c.projectionMatrix(1);
  close(orthographic[10] * 2 + orthographic[14], 1);
  close(orthographic[10] * -8 + orthographic[14], 0);
  assert.equal(c.near, -2, 'projection does not normalize the authored negative near');
  for (const invalid of [{ near: NaN }, { near: Infinity }, { near: -Infinity }, { far: NaN }, { far: Infinity },
    { far: -Infinity }, { far: -2 }, { far: -3 }]) {
    Object.assign(c, { near: -2, far: 8 }, invalid);
    assert.throws(() => c.projectionMatrix(1), error => error.code === 'CLIP_INVALID');
  }
  c.near = -0; c.far = 8;
  assert.doesNotThrow(() => c.projectionMatrix(1)); assert.ok(Object.is(c.near, -0));
  c.autoClip = true; c.projection = 'perspective'; c.near = 2; c.far = NaN;
  const automatic = c.projectionMatrix(1);
  assert.equal(automatic[10], 0); assert.equal(automatic[14], 2, 'automatic mode retains its original infinite projection behavior');
});

test('manual finite unsupported raster combinations refuse before submission while SDK off states and auto remain admitted', () => {
  const f = fixture();
  try {
    f.viewer.setView(camera(2, 8));
    assert.equal(f.core.grid.visible, false);
    assert.equal(f.core.environment.ambientOcclusion, false, 'the actual SDK Presenter disables SSAO');
    const baseEnvironment = f.core.environment;
    let encoders = 0, submissions = 0;
    f.core.device = { destroy() {}, createCommandEncoder() { encoders++; }, queue: { submit() { submissions++; } } };
    const modes = [
      ['grid', { visible: true }, baseEnvironment],
      ['SSAO', { visible: false }, { ...baseEnvironment, ambientOcclusion: {} }],
      ['contact shadows', { visible: false }, { ...baseEnvironment, contactShadows: {} }],
      ['depth of field', { visible: false }, { ...baseEnvironment, depthOfField: { focus: 5, blur: 8 } }],
    ];
    for (const [name, grid, environment] of modes) {
      f.core.grid = grid; f.core.environment = environment;
      assert.throws(() => f.core.render(), error => error.code === 'CLIP_INVALID', name);
      assert.deepEqual([encoders, submissions], [0, 0], 'refusal precedes command encoding/submission');
      f.core.camera.autoClip = true;
      assert.doesNotThrow(() => f.core.prepareCamera(), `${name} remains admitted in default auto mode`);
      f.core.camera.autoClip = false; f.core.camera.near = 2; f.core.camera.far = 8;
    }
    f.core.grid = { visible: false };
    f.core.environment = { ...baseEnvironment, ambientOcclusion: { strength: 0 }, contactShadows: { strength: 0 }, depthOfField: { focus: 5, blur: 0 } };
    assert.doesNotThrow(() => f.core.prepareCamera(), 'zero-strength and disabled depth effects are not active unsupported combinations');
    f.core.camera.far = Infinity; f.core.grid = { visible: true }; f.core.environment = modes[3][2];
    assert.doesNotThrow(() => f.core.prepareCamera(), 'manual Infinity keeps the existing infinite path outside the finite-only guard');
  } finally { f.presenter.dispose(); }
});

function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
/** Structural device only: actual PathTraceSession creation, ownership and disposal run without shader execution. */
function traceDevice({ holdPipelines = false, holdWork = false } = {}) {
  const resources = [], pipelinesEntered = deferred(), pipelineRelease = deferred(), workEntered = deferred(), workRelease = deferred();
  const resource = (kind, descriptor) => {
    const item = { kind, destroyed: 0, data: kind === 'buffer' ? new ArrayBuffer(descriptor.size) : null,
      destroy() { this.destroyed++; }, createView() { return {}; } };
    resources.push(item); return item;
  };
  const device = {
    destroy() {},
    limits: { maxTextureDimension2D: 4096, maxTextureArrayLayers: 256, maxBufferSize: 1 << 24, maxStorageBufferBindingSize: 1 << 24 },
    pushErrorScope() {}, async popErrorScope() { return null; },
    createShaderModule() { return { async getCompilationInfo() { return { messages: [] }; } }; },
    async createComputePipelineAsync() { pipelinesEntered.resolve(); if (holdPipelines) await pipelineRelease.promise; return { getBindGroupLayout() { return {}; } }; },
    createBuffer: descriptor => resource('buffer', descriptor), createTexture: descriptor => resource('texture', descriptor),
    createBindGroup: descriptor => descriptor,
    createCommandEncoder() { return { beginComputePass() { return { setPipeline() {}, setBindGroup() {}, dispatchWorkgroups() {}, end() {} }; }, finish() { return {}; } }; },
    queue: {
      writeBuffer(buffer, offset, data) {
        const bytes = ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
        new Uint8Array(buffer.data).set(bytes, offset);
      },
      writeTexture() {}, submit() {},
      async onSubmittedWorkDone() { workEntered.resolve(); if (holdWork) await workRelease.promise; },
    },
  };
  return { device, resources, pipelinesEntered: pipelinesEntered.promise, workEntered: workEntered.promise,
    releasePipelines() { holdPipelines = false; pipelineRelease.resolve(); }, releaseWork() { holdWork = false; workRelease.resolve(); } };
}
function manual(core) { core.camera.autoClip = false; core.camera.near = 2; core.camera.far = 8; }

test('manual finite path trace refuses both initially and after lazy import without allocating or retaining pending ownership', async () => {
  const f = fixture(), fake = traceDevice(); f.core.device = fake.device;
  try {
    f.viewer.setView(camera(2, 8));
    await assert.rejects(f.core.createPathTrace({ width: 2, height: 2 }), error => error.code === 'PATH_TRACE_UNSUPPORTED');
    assert.equal(fake.resources.length, 0); assert.equal(f.core.pendingPathTraces, 0);
    f.core.camera.autoClip = true;
    const pending = f.core.createPathTrace({ width: 2, height: 2 });
    manual(f.core); // Synchronous switch while the real lazy import has yielded.
    assert.throws(() => f.core.prepareCamera(), error => error.code === 'PATH_TRACE_UNSUPPORTED');
    await assert.rejects(pending, error => error.code === 'PATH_TRACE_UNSUPPORTED');
    assert.equal(fake.resources.length, 0); assert.equal(f.core.pendingPathTraces, 0); assert.equal(f.core.pathTraces.size, 0);
    assert.doesNotThrow(() => f.core.prepareCamera(), 'settled rejection leaves no pending latch');
  } finally { f.presenter.dispose(); }
});

test('manual finite switch during actual async session creation disposes the unpublished owner and permits later auto creation', async () => {
  const f = fixture(), fake = traceDevice({ holdPipelines: true }); f.core.device = fake.device;
  try {
    f.core.camera.autoClip = true;
    const pending = f.core.createPathTrace({ width: 2, height: 2 });
    await Promise.race([fake.pipelinesEntered, pending.then(() => assert.fail('session completed before the held pipeline stage'))]);
    manual(f.core);
    assert.throws(() => f.core.prepareCamera(), error => error.code === 'PATH_TRACE_UNSUPPORTED');
    fake.releasePipelines();
    await assert.rejects(pending, error => error.code === 'PATH_TRACE_UNSUPPORTED');
    assert.ok(fake.resources.length > 0, 'actual session creation allocated resources before the publication guard');
    assert.ok(fake.resources.every(resource => resource.destroyed === 1), 'unpublished session releases each resource once');
    assert.equal(f.core.pathTraces.size, 0); assert.equal(f.core.pendingPathTraces, 0);
    f.core.camera.autoClip = true;
    const session = await f.core.createPathTrace({ width: 2, height: 2 });
    assert.equal(f.core.pathTraces.has(session), true); assert.equal(f.core.pendingPathTraces, 0);
    session.dispose(); assert.equal(f.core.pathTraces.size, 0);
    assert.ok(fake.resources.every(resource => resource.destroyed === 1));
  } finally { fake.releasePipelines(); f.presenter.dispose(); }
});

test('active actual path trace refuses manual finite frame preparation until stopped, retaining its owner until disposal', async () => {
  const f = fixture(), fake = traceDevice({ holdWork: true }); f.core.device = fake.device;
  let session;
  try {
    f.core.camera.autoClip = true;
    session = await f.core.createPathTrace({ width: 2, height: 2 });
    const running = session.start();
    await Promise.race([fake.workEntered, running.then(() => assert.fail('progressive session ended before the held device work'))]);
    manual(f.core);
    assert.throws(() => f.core.prepareCamera(), error => error.code === 'PATH_TRACE_UNSUPPORTED');
    assert.equal(f.core.pathTraces.has(session), true);
    session.stop(); fake.releaseWork(); await running;
    assert.doesNotThrow(() => f.core.prepareCamera(), 'stopped still is not an active progressive renderer');
    assert.equal(f.core.pathTraces.has(session), true);
    session.dispose(); assert.equal(f.core.pathTraces.size, 0);
    assert.ok(fake.resources.every(resource => resource.destroyed === 1));
  } finally { session?.stop(); fake.releaseWork(); session?.dispose(); f.presenter.dispose(); }
});

test('SDK skips an out-of-range nearest surface and still selects the later in-range surface while Core raycast stays raw', () => {
  const f = fixture();
  try {
    const front = { ...structuredClone(f.packet), surfaceId: 'before-near', positions: [-4, -4, 3, 4, -4, 3, 4, 4, 3, -4, 4, 3], bounds: { min: [-4, -4, 3], max: [4, 4, 3] } };
    f.viewer.setPackets([{ modelId: 'front', packet: front }, { modelId: 'literal', packet: f.packet }]);
    f.viewer.setView(camera(4, 8));
    // Independent literal depths: first plane is3 (<near4), second plane is6 (inside4..8).
    checkHit(f.viewer.pick(160, 120), [0, 0, 0], 6);
    const raw = f.core.raycast(160, 120);
    assert.ok(raw); close(raw.point[2], 3, 1e-9);
    assert.ok(projectedDepth(f.core, [0, 0, 3]) > 1);
  } finally { f.presenter.dispose(); }
});
