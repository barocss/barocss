// Recorded current-source GL calls only. No browser, GPU raster or Model evaluation.
// Run: node --test --test-concurrency=1 packages/barocss-gpu/tests/cad-clearance-overlay-gl.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../../', import.meta.url)), temp = await mkdtemp(join(tmpdir(), 'cad-clearance-gl-'));
let Renderer, ClearanceOverlayGL;
try {
  const outfile = join(temp, 'overlay.mjs');
  await build({
    stdin: { contents: 'export {Renderer} from "./apps/cad-studio/src/viewport/renderer.ts"; export {ClearanceOverlayGL} from "./apps/cad-studio/src/viewport/clearanceOverlayGL.ts";', resolveDir: root },
    outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    alias: { '@barocss/gpu/viewer': resolve(root, 'packages/barocss-gpu/src/viewer/index.ts'), '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src/index.ts'), '@barocss/cad-model': resolve(root, 'packages/barocss-cad-model/src'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src') },
  });
  ({ Renderer, ClearanceOverlayGL } = await import(pathToFileURL(outfile).href));
} finally { await rm(temp, { recursive: true, force: true }); }

const identity = () => Float32Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function mockGl() {
  let serial = 0, program = null, vao = null, framebuffer = null, depth = true, func = 'LESS';
  const enabled = new Set(), uniforms = new Map(), events = [], draws = [];
  const clone = value => ArrayBuffer.isView(value) ? Array.from(value) : value;
  const draw = () => draws.push({ program, vao, framebuffer, depth, func, enabled: new Set(enabled), uniforms: structuredClone(uniforms.get(program) ?? {}) });
  const api = {
    getParameter: () => 4, getShaderParameter: () => true, getProgramParameter: () => true,
    getUniformLocation: (p, name) => ({ p, name }), useProgram: value => { program = value; }, bindVertexArray: value => { vao = value; },
    bindFramebuffer: (target, value) => { if (target === 'FRAMEBUFFER') framebuffer = value; },
    enable: flag => enabled.add(flag), disable: flag => enabled.delete(flag), depthMask: value => { depth = value; }, depthFunc: value => { func = value; },
    drawElements: draw, drawArrays: draw, drawArraysInstanced: draw,
    readPixels: (x, y, w, h, format, type, bytes) => { bytes.fill(0); bytes[0] = 1; },
  };
  const gl = new Proxy(api, { get(target, key) {
    if (key in target) return target[key];
    if (/^[A-Z_0-9]+$/.test(key)) return key;
    if (key.startsWith('create')) return () => { const id = key + '-' + ++serial; events.push({ name: key, args: [id] }); return id; };
    if (key.startsWith('uniform')) return (location, ...values) => { const row = uniforms.get(location.p) ?? {}; row[location.name] = values.map(clone); uniforms.set(location.p, row); };
    return (...args) => events.push({ name: key, args: args.map(clone), vao });
  } });
  return { gl, draws, events, state: () => ({ depth, func, enabled }), clear: () => { events.length = 0; draws.length = 0; } };
}
const overlay = (extra = {}) => ({ id: 'pair:a', bodyKey: 'part-a:b1', positions: Float32Array.of(0, 0, 0, 2, 0, 0, 0, 2, 0), normals: Float32Array.of(0, 0, 1, 0, 0, 1, 0, 0, 1), indices: Uint32Array.of(0, 1, 2), colors: Float32Array.of(0.2, 0.8, 0.3, 0.9, 0.2, 0.1, 0.3, 0.4, 0.9), field: Float32Array.of(0.1, 0.2, 0.3), model: Float64Array.from(identity()), state: 'near', hatched: false, opacity: 0.63, ...extra });
const display = (overlays, clip) => ({ version: 'clearance-map-v1', request: 3, revision: 'pose-3', nearMM: 2, stage: 'ready', pairs: [], overlays, ...(clip ? { clip } : {}) });
const uploaded = f => f.events.filter(event => event.name === 'bufferData').map(event => event.args[1]);

test('local buffers retain the original field/provenance and a rotated translated model is sent once', () => {
  const f = mockGl(), pass = new ClearanceOverlayGL(f.gl), source = overlay({ model: Float64Array.from([0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1]) });
  pass.setDisplay(display([source]));
  assert.deepEqual(uploaded(f), [Array.from(source.positions), Array.from(source.normals), Array.from(source.colors), Array.from(source.indices)]);
  assert.equal(pass.overlays[0].source, source); assert.equal(pass.overlays[0].source.field, source.field);
  pass.render(identity()); const draw = f.draws.at(-1);
  assert.deepEqual(draw.uniforms.uModel, [false, Array.from(source.model)]); assert.deepEqual(draw.uniforms.uOpacity, [source.opacity]);
  assert.equal(draw.depth, false); assert.equal(draw.func, 'LEQUAL'); assert.ok(draw.enabled.has('BLEND')); assert.ok(draw.enabled.has('POLYGON_OFFSET_FILL'));
  assert.equal(f.state().depth, true); assert.equal(f.state().func, 'LESS'); assert.equal(f.state().enabled.has('POLYGON_OFFSET_FILL'), false);
});

test('the actual GL uploads use world-plane clipped local triangles for keep-all and cutout keep-any', () => {
  const f = mockGl(), pass = new ClearanceOverlayGL(f.gl), model = Float64Array.from(identity()); model[12] = 10;
  const source = overlay({ model }), original = Array.from(source.positions), field = source.field;
  const planes = [{ normal: [1, 0, 0], offset: 10.5 }, { normal: [0, 1, 0], offset: 0.5 }];
  for (const cutout of [false, true]) {
    f.clear(); pass.setDisplay(display([source], { planes, cutout }));
    const positions = uploaded(f)[0]; assert.ok(positions.length > 0);
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i] + 10, y = positions[i + 1];
      assert.ok(cutout ? x >= 10.5 || y >= 0.5 : x >= 10.5 && y >= 0.5);
      assert.ok(positions[i] <= 2 && positions[i + 1] <= 2, 'world transform is not baked into drawing vertices');
    }
  }
  assert.deepEqual(Array.from(source.positions), original); assert.equal(source.field, field);
});

test('pending preserves supplied colors without a false red hatch; refused and hatched rows use stripe coverage', () => {
  const f = mockGl(), pass = new ClearanceOverlayGL(f.gl);
  for (const [state, hatched, expected] of [['pending', true, 0], ['refused', false, 1], ['contact', true, 1], ['overlap', false, 0]]) {
    const source = overlay({ state, hatched }); f.clear(); pass.setDisplay(display([source])); pass.render(identity());
    assert.deepEqual(uploaded(f)[2], Array.from(source.colors)); assert.deepEqual(f.draws.at(-1).uniforms.uHatched, [expected]);
    assert.deepEqual(f.draws.at(-1).uniforms.uOpacity, [source.opacity]);
  }
});

test('repeated snapshots reuse resources; clearing and disposal free all new overlay buffers and program', () => {
  const f = mockGl(), pass = new ClearanceOverlayGL(f.gl), snapshot = display([overlay()]);
  pass.setDisplay(snapshot); f.clear(); pass.setDisplay(snapshot); assert.equal(uploaded(f).length, 0);
  pass.setDisplay(null); pass.render(identity());
  assert.equal(f.events.filter(event => event.name === 'deleteBuffer').length, 4); assert.equal(f.events.filter(event => event.name === 'deleteVertexArray').length, 1); assert.equal(f.draws.length, 0);
  pass.dispose(); assert.equal(f.events.filter(event => event.name === 'deleteProgram').length, 1);
});

test('Renderer keeps all five mode states and native pick results while the overlay remains absent from its pick pass', () => {
  const f = mockGl(), canvas = { width: 320, height: 200, clientWidth: 320, clientHeight: 200, getContext: () => f.gl }, r = new Renderer(canvas);
  r.setClearanceDisplay(null); assert.equal(r.clearance, null, 'default mode allocates no clearance program');
  const native = overlay(), body = { mesh: { positions: native.positions, normals: native.normals, indices: native.indices, faceOfVertex: Float32Array.of(0, 0, 0), faces: [{ index: 0, id: 'native-face', kind: 'plane' }], edgeLines: new Float32Array(), edgeOfSegment: new Float32Array(), bounds: { min: [0, 0, 0], max: [2, 2, 0] } } };
  r.setBodies([body]);
  r.setClearanceDisplay(display([overlay()]));
  const camera = { aspect: 1, target: [0, 0, 0], distance: 100, fovY: Math.PI / 4, ortho: false, eye: () => [0, 0, 10], viewProjection: identity, view: identity, near: () => 0.1, far: () => 1000 };
  for (const mode of ['shaded-with-edges', 'hidden-lines-removed', 'hidden-lines-dashed', 'wireframe', 'x-ray']) {
    const view = { displayMode: mode, hoverFace: null, hoverEdge: null, selectedFaces: [], selectedEdges: [], selectedBodies: [], offsets: new Map(), ghostBodies: new Set() };
    const previous = globalThis.window; globalThis.window = { devicePixelRatio: 1 };
    try { r.render(camera, view); } finally { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; }
    assert.equal(r.getDisplayModeStatus().effective, mode); f.clear();
    assert.deepEqual(r.pickFace(10, 10, camera, view), { body: 0, face: 0 });
    assert.ok(f.draws.some(draw => draw.program === r.pick && draw.vao === r.bodies[0].vao), 'the original native geometry is drawn in the ID pass');
    assert.equal(f.draws.some(draw => draw.program === r.clearance.program), false, 'decal has no native ID draw');
    assert.equal(r.bodies[0].result, body);
  }
  r.dispose(); assert.equal(r.clearance, null);
});
