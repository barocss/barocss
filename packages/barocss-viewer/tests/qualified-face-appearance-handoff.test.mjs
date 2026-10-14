/** #1913 software handoff: real Viewer/GPU/CAD admission over structural GL, not a device receipt. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';

const entry = new URL(process.env.VIEWER_TEST_MODE === 'dist' ? '../dist/index.js' : '../src/index.ts', import.meta.url).pathname;
const built = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm',
  platform: 'node', target: 'node22' });
const viewer = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
const cad = await build({ entryPoints: [new URL('../../barocss-cad-interop/src/document.ts', import.meta.url).pathname],
  bundle: true, write: false, format: 'esm', platform: 'node', target: 'node22' });
const interop = await import('data:text/javascript;base64,' + Buffer.from(cad.outputFiles[0].text).toString('base64'));
const documentText = await readFile(new URL('../../barocss-cad-interop/examples/document-gpu-v2.cad-document.json', import.meta.url), 'utf8');
const source = await readFile(new URL('../../../examples/gpu-scene/qualified-face-scene-flow.mjs', import.meta.url), 'utf8');
const faceAssets = JSON.parse(Buffer.from(source.match(/warped:'([^']+)'/)[1], 'base64').toString()).assets.slice(0, 2)
  .map((asset, index) => ({ ...asset, color: index ? [0, 1, 0] : [1, 0, 0] }));
const camera = { eye: [3, 2, 4], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 60, near: 0.1, far: 100 };

function appearance() {
  const result = interop.parseBaroCadDocument(documentText);
  const options = { native: { sourceVersion: 0, countU: 5, countV: 5, unitsPerMillimeter: 1,
    curveDisplay: { version: 1, chordToleranceMM: .02, maxSegments: 512, maxDepth: 16 } },
  basis: 'authored-xyz-matches-rhyup', bodyIds: ['body_0_surface', 'body_1_surface', 'body_0_curve'] };
  const projected = interop.prepareBaroCadDocumentPrimitiveNativeRefsV2(result, options);
  const visibleGeometry = projected.map(entry => entry.kind === 'surface'
    ? { kind: 'surface', modelId: entry.ref.modelId, surfaceId: entry.ref.geometryId }
    : { kind: 'curve', modelId: entry.ref.modelId, curveId: entry.ref.geometryId });
  return { version: 1, source: { kind: 'document', result, options, bindings: projected.map(entry => entry.binding) },
    display: { motion: null, visibleGeometry, camera },
    appearance: { lighting: { ambientStrength: .3, directionalStrength: .7, direction: [-.6, .8, 1] }, materials: [] } };
}

function transport() {
  const log = [], live = new Set(), bindings = new Map(), listeners = new Set();
  const faults = {}; let id = 0, presentations = 0;
  const step = (name, value) => { log.push({ name, value }); if (Object.hasOwn(faults, name)) throw faults[name]; };
  const gl = { NO_ERROR: 0, COMPILE_STATUS: 'compile', LINK_STATUS: 'link', FRAMEBUFFER_COMPLETE: 'complete',
    get drawingBufferWidth() { return canvas.width; }, get drawingBufferHeight() { return canvas.height; },
    isContextLost() { step('isContextLost'); return false; }, getError() { step('getError'); return 0; },
    getShaderParameter() { return true; }, getProgramParameter() { return true; }, getShaderInfoLog() { return ''; },
    getProgramInfoLog() { return ''; }, getUniformLocation() { return {}; },
    getParameter(key) { if (key === 'MAX_TEXTURE_SIZE' || key === 'MAX_RENDERBUFFER_SIZE') return 4096;
      if (key === 'MAX_VIEWPORT_DIMS') return [4096, 4096]; return bindings.get(key) ?? null; },
    checkFramebufferStatus() { return 'complete'; },
    useProgram(value) { step('useProgram', value); bindings.set('CURRENT_PROGRAM', value); },
    bindVertexArray(value) { step('bindVertexArray', value); bindings.set('VERTEX_ARRAY_BINDING', value); },
    bindFramebuffer(kind, value) { step('bindFramebuffer', value);
      if (kind !== 'DRAW_FRAMEBUFFER') bindings.set('READ_FRAMEBUFFER_BINDING', value);
      if (kind !== 'READ_FRAMEBUFFER') bindings.set('DRAW_FRAMEBUFFER_BINDING', value); },
    blitFramebuffer() { step('blitFramebuffer'); presentations++; }, readPixels() { step('readPixels'); } };
  for (const kind of ['Program', 'Shader', 'VertexArray', 'Buffer', 'Framebuffer', 'Texture', 'Renderbuffer']) {
    gl['create' + kind] = () => { step('create' + kind); const value = { kind, id: ++id }; live.add(value); return value; };
    gl['delete' + kind] = value => { step('delete' + kind, value); assert(live.delete(value), 'no foreign/double delete'); };
  }
  for (const name of ['shaderSource', 'compileShader', 'attachShader', 'detachShader', 'linkProgram', 'bindBuffer', 'bufferData',
    'enableVertexAttribArray', 'vertexAttribPointer', 'bindTexture', 'texParameteri', 'texStorage2D', 'bindRenderbuffer',
    'renderbufferStorage', 'framebufferTexture2D', 'framebufferRenderbuffer', 'viewport', 'disable', 'enable', 'depthFunc',
    'lineWidth', 'depthMask', 'colorMask', 'clearColor', 'clearDepth', 'clear', 'uniform1f', 'uniform1i', 'uniform3fv',
    'uniformMatrix4fv', 'drawElements', 'drawArrays', 'pixelStorei']) gl[name] = (...values) => step(name, values);
  const proxy = new Proxy(gl, { get(target, key) { if (key in target) return Reflect.get(target, key);
    if (typeof key === 'string' && /^[A-Z_0-9]+$/.test(key)) return key;
    throw Error('Unimplemented structural GL operation: ' + String(key)); } });
  class Canvas {
    width = 256; height = 256;
    getContext(kind) { assert.equal(kind, 'webgl2'); step('getContext'); return proxy; }
    addEventListener(kind, fn) { step('addEventListener'); listeners.add(fn); }
    removeEventListener(kind, fn) { step('removeEventListener'); listeners.delete(fn); }
  }
  const canvas = new Canvas();
  return { canvas, Canvas, log, live, listeners, faults, get presentations() { return presentations; } };
}

function owner() {
  const t = transport(); globalThis.HTMLCanvasElement = t.Canvas;
  t.viewer = viewer.createViewer(t.canvas, { mmToSceneUnit: .001, background: [.05, .07, .1] });
  t.viewer.loadQualifiedFaceScene({ version: 0, basis: 'authored-xyz-matches-rhyup',
    assets: faceAssets, countU: 17, countV: 17, camera, translateScene: [-.6, -.6, -.6] });
  t.old = t.viewer.getState(); t.oldHandles = new Set(t.live); t.log.length = 0;
  return t;
}

test('qualified Face handoff preserves refusal and makes terminal failure explicit', async () => {
  const previousCanvas = globalThis.HTMLCanvasElement, previousFetch = globalThis.fetch;
  try {
    const t = owner(), input = appearance(), before = t.presentations;
    assert.throws(() => t.viewer.replaceNativeSceneAppearance(input), /qualified V2 or Viewport/);
    const atomic = t.viewer.handoffQualifiedFaceToNativeSceneAppearance(new Proxy({}, {
      get() { throw Error('atomic request inspected'); } }), 'atomic');
    assert.equal(atomic.stage, 'preflight'); assert.equal(t.log.length, 0);
    const invalid = structuredClone(input); invalid.source.bindings[0].documentRevision++;
    assert.throws(() => t.viewer.handoffQualifiedFaceToNativeSceneAppearance(invalid, 'dispose-remount'));
    assert.deepEqual(t.viewer.getState(), t.old); assert.equal(t.presentations, before); assert.equal(t.log.length, 0);
    t.viewer.dispose(); assert.equal(t.live.size, 0); assert.equal(t.listeners.size, 0);

    const success = owner(), candidate = appearance(), oldScene = success.viewer.getState().qualifiedFaceScene;
    let releaseFetch;
    globalThis.fetch = () => new Promise(resolve => { releaseFetch = resolve; });
    const stale = success.viewer.loadNativeUrl('https://example.test/old.cad',
      { sourceVersion: 0, countU: 5, countV: 5 });
    const accepted = success.viewer.handoffQualifiedFaceToNativeSceneAppearance(candidate, 'dispose-remount');
    assert.equal(accepted.ok, true, accepted.ok ? '' : accepted.stage + ': ' + accepted.error.message);
    assert.equal(accepted.stage, 'ready'); assert.deepEqual(accepted.previousScene, oldScene);
    const state = success.viewer.getState(); assert.equal(state.status, 'ready');
    assert.deepEqual(state.document, candidate.source.result); assert.deepEqual(state.camera, candidate.display.camera);
    assert.equal(state.documentBodies.length, candidate.source.bindings.length);
    assert.deepEqual(state.documentBodies.map(body => body.binding), candidate.source.bindings);
    assert.equal(state.qualifiedFaceScene, null); assert.equal(state.selected, null); assert.equal(state.selectedGeometry, null);
    assert.equal(state.fluidFrame, null); assert.equal(state.clothFrame, null);
    for (const handle of success.oldHandles) assert(!success.live.has(handle), 'old GPU handle retired');
    const firstNew = success.log.findIndex(entry => entry.name === 'getContext');
    const lastOld = Math.max(...success.log.map((entry, index) => entry.name.startsWith('delete')
      && success.oldHandles.has(entry.value) ? index : -1));
    assert(firstNew > lastOld, 'successor starts after old retirement');
    releaseFetch(new Response(faceAssets[0].source));
    await assert.rejects(stale, error => error.code === 'ABORT_ERR');
    assert.deepEqual(success.viewer.getState().document, candidate.source.result);
    globalThis.fetch = previousFetch;
    success.viewer.clear(); assert.equal(success.viewer.getState().status, 'empty');
    success.viewer.dispose(); assert.equal(success.live.size, 0); assert.equal(success.listeners.size, 0);

    const failure = owner(), old = failure.viewer.getState(), marker = Error('new buffer refused');
    failure.faults.createBuffer = marker;
    const stopped = failure.viewer.handoffQualifiedFaceToNativeSceneAppearance(appearance(), 'dispose-remount');
    assert.equal(stopped.ok, false); assert.equal(stopped.stage, 'mount'); assert.strictEqual(stopped.error, marker);
    assert.deepEqual(stopped.previousScene, old.qualifiedFaceScene);
    const unavailable = failure.viewer.getState(); assert.equal(unavailable.status, 'unavailable');
    assert.deepEqual(unavailable.qualifiedFaceScene, old.qualifiedFaceScene);
    assert.throws(() => failure.viewer.clear(), /unavailable/);
    assert.throws(() => failure.viewer.readPixels(), /unavailable/);
    delete failure.faults.createBuffer;
    failure.viewer.dispose(); assert.equal(failure.live.size, 0); assert.equal(failure.listeners.size, 0);

    const retirement = owner(), cleanupCause = Error('old program delete refused');
    retirement.faults.deleteProgram = cleanupCause;
    const retired = retirement.viewer.handoffQualifiedFaceToNativeSceneAppearance(appearance(), 'dispose-remount');
    assert.equal(retired.ok, false); assert.equal(retired.stage, 'retirement');
    assert(retired.error.cause.errors.includes(cleanupCause));
    assert.equal(retirement.viewer.getState().status, 'unavailable');
    assert(!retirement.log.some(entry => entry.name === 'getContext' || entry.name.startsWith('create')));
    assert.equal(retirement.live.size, 1, 'one injected refusal remains; other resources were attempted');
    delete retirement.faults.deleteProgram;
    retirement.viewer.dispose(); assert.equal(retirement.listeners.size, 0);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousCanvas === undefined) delete globalThis.HTMLCanvasElement;
    else globalThis.HTMLCanvasElement = previousCanvas;
  }
});
