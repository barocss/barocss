// Current-source clearance decal adapter contracts. Mock Viewer only: no GPU, browser or kernel run.
// node --test --test-concurrency=1 packages/barocss-gpu/tests/cad-clearance-gpu.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../../', import.meta.url)), temp = await mkdtemp(join(tmpdir(), 'cad-clearance-gpu-'));
let GpuRenderer;
try {
  const outfile = join(temp, 'renderer.mjs');
  await build({ entryPoints: [resolve(root, 'apps/cad-studio/src/viewport/gpuRenderer.ts')], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', alias: { '@barocss/gpu/viewer': resolve(root, 'packages/barocss-gpu/src/viewer/index.ts'), '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src'), '@barocss/cad-model': resolve(root, 'packages/barocss-cad-model/src'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src') } });
  ({ GpuRenderer } = await import(pathToFileURL(outfile).href));
} finally { await rm(temp, { recursive: true, force: true }); }

const identity = () => Float64Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const snapshot = value => JSON.stringify(value, (_key, v) => ArrayBuffer.isView(v) ? [...v] : v);
const geometry = input => ({ input, setColors(value) { this.colors = value; }, setUVs() {}, dispose() { this.disposals = (this.disposals ?? 0) + 1; } });
class Mesh {
  constructor(input, options) { this.geometry = geometry(input); this.transform = identity(); this.visible = true; this.pickable = true; this.clipped = true; this.cap = false; this.pickTransparent = null; this._material = { opacity: 1, colorWrite: true }; Object.assign(this, options); }
  get material() { return this._material; }
  set material(value) { Object.assign(this._material, value); }
  remove() { this.removals = (this.removals ?? 0) + 1; }
}
function overlay(changes = {}) {
  const model = identity(); model[12] = 4; model[13] = 3; model[14] = 2;
  return { id: 'band', bodyKey: 'part/body', positions: new Float32Array([-2, -2, 0, 2, -2, 0, 0, 2, 0]), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), indices: new Uint32Array([0, 1, 2]), colors: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), field: new Float32Array([0.1, 0.2, 0.3]), model, state: 'near', hatched: false, opacity: 0.6, ...changes };
}
const display = (overlays, clip) => ({ version: 'clearance-map-v1', request: 7, revision: 'pose-v7', nearMM: 2, stage: 'ready', pairs: [], overlays, ...(clip ? { clip } : {}) });
const state = (displayMode, isolatedInstances) => ({ displayMode, isolatedInstances, hoverFace: null, hoverEdge: null, selectedFaces: [], selectedEdges: [], selectedBodies: [], offsets: new Map(), ghostBodies: new Set(), hiddenBodies: new Set() });
const camera = () => ({ target: [0, 0, 0], fovY: Math.PI / 4, ortho: false, eye: () => [5, 5, 5], basis: () => ({ right: [1, 0, 0], up: [0, 1, 0], forward: [0, 0, -1] }) });
function fixture() {
  const meshes = [], calls = [], viewer = {
    camera: {}, orderIndependent: true, meshList: meshes, clipPlanes: Object.freeze([{ normal: [0, 1, 0], offset: -100 }]), clipCutout: false,
    add(input, options) { const m = new Mesh(input, options); meshes.push(m); return m; }, createGeometry: geometry,
    requestRender: () => calls.push('request'), render: () => calls.push('render'), resize: dpr => calls.push(['resize', dpr]),
  };
  const renderer = Object.create(GpuRenderer.prototype), source = overlay({ model: identity() });
  const native = viewer.add({ positions: source.positions, normals: source.normals, indices: source.indices }, { name: 'native' });
  const edge = viewer.add({ positions: [0, 0, 0, 1, 0, 0], topology: 'lines' }, { material: { lineWidth: 1.2 } });
  const mesh = { ...source, faceOfVertex: new Float32Array([0, 0, 0]), faces: [{ index: 0, id: 'native-plane', kind: 'plane' }], edgeLines: new Float32Array([0, 0, 0, 1, 0, 0]), edgeOfSegment: new Float32Array([7, 7]), bounds: { min: [-2, -2, 0], max: [2, 2, 0] } };
  Object.assign(renderer, {
    viewer, canvas: { clientWidth: 320, clientHeight: 200 }, displayMode: { requested: 'shaded-with-edges', effective: 'shaded-with-edges', supported: true },
    theme: { base: [0.7, 0.7, 0.8], edge: [0.1, 0.1, 0.1], ao: 0.9, shadow: 0.45 }, aoEnabled: true, settings: null, analysis: null, scalarMaps: null, direct: [], proposalMeshes: [], mould: null,
    bodies: [{ result: { key: 'native', mesh }, surface: native, edges: edge, highlight: null, state: '', painted: null, runs: { vertexCount: 3, byFace: new Map([[0, [0, 3]]]) } }],
    instances: [], instanceDisplayMode: 'shaded-with-edges', instanceFaces: [], instanceSelection: [], instanceMeshes: new Map(), instanceTiles: new WeakMap(), instancePainted: new WeakMap(), shapes: new Map(),
    hatchLines: new Map(), maps: new Map(), shaders: new Map(), clip: { planes: [{ normal: [0, 1, 0], offset: -100 }], bodies: true, cutout: false, hatch: 2 },
  });
  renderer.bounds = () => null;
  viewer.raycast = () => native.visible && native.pickable ? { mesh: native, face: 0, triangle: 0 } : null;
  viewer.pickLine = (...args) => { calls.push(['pickLine', ...args]); return edge.pickable ? { mesh: edge, edge: 7 } : null; };
  return { renderer, viewer, native, edge, calls };
}

test('GPU clearance consumes supplied local geometry, colors and model once; pending and refusal stay distinct', () => {
  const f = fixture(), pending = overlay({ id: 'pending', state: 'pending', colors: new Float32Array([0.9, 0.6, 0.2, 0.9, 0.6, 0.2, 0.9, 0.6, 0.2]), opacity: 0.4 });
  const refused = overlay({ id: 'refused', state: 'refused', hatched: true, colors: new Float32Array([0.9, 0.1, 0.1, 0.9, 0.1, 0.1, 0.9, 0.1, 0.1]) });
  const input = display([pending, refused]), before = snapshot(input), planes = f.viewer.clipPlanes;
  f.renderer.setClearanceDisplay(input); const [a, b] = f.renderer.clearance.meshes;
  for (const [m, src] of [[a, pending], [b, refused]]) {
    assert.deepEqual(Array.from(m.geometry.input.positions), Array.from(src.positions)); assert.deepEqual(Array.from(m.geometry.input.normals), Array.from(src.normals)); assert.deepEqual(Array.from(m.geometry.input.colors), Array.from(src.colors));
    assert.deepEqual(Array.from(m.transform), Array.from(src.model)); assert.equal(m.material.opacity, src.opacity);
    assert.equal(m.pickable, false); assert.equal(m.pickTransparent, true); assert.equal(m.castShadow, false); assert.equal(m.receiveShadow, false); assert.equal(m.cap, false); assert.equal(m.clipped, false); assert.equal(m.bounded, false);
    assert.equal(m.material.decal, true); assert.equal(m.material.unlit, true); assert.equal(m.material.doubleSided, true);
  }
  assert.equal(a.material.shader, null); assert.ok(b.material.shader);
  assert.equal(b.material.shader.expression, 'clearanceRefusal(world, normal)');
  assert.ok(b.material.shader.declarations.includes('fract(h)') && b.material.shader.declarations.includes('fwidth(h)'), 'refusal uses an actual repeating antialiased hatch shader, not a solid red material');
  assert.equal(f.renderer.clearance.display.overlays[0].field, pending.field, 'exact Model field stays untouched as provenance');
  assert.equal(f.viewer.clipPlanes, planes); assert.equal(snapshot(input), before);
});

test('GPU clearance clips independently in world space while retaining local attributes and uncapped output', () => {
  for (const [cutout, expectedArea] of [[false, 1], [true, 5]]) {
    const f = fixture(), src = overlay(), input = display([src], { planes: [{ normal: [1, 0, 0], offset: 4 }, { normal: [0, 1, 0], offset: 3 }], cutout }), before = snapshot(input), nativeClip = f.viewer.clipPlanes;
    f.renderer.setClearanceDisplay(input); const m = f.renderer.clearance.meshes[0], g = m.geometry.input;
    let area = 0;
    for (let t = 0; t < g.indices.length; t += 3) {
      const ids = Array.from(g.indices.slice(t, t + 3)), p = ids.map(v => [g.positions[v * 3], g.positions[v * 3 + 1]]);
      area += Math.abs((p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0])) / 2;
    }
    assert.ok(Math.abs(area - expectedArea) < 1e-6);
    for (let v = 0; v < g.positions.length / 3; v++) {
      const x = g.positions[v * 3], y = g.positions[v * 3 + 1], c = (y + 2) / 4, b = (x + 2 - 2 * c) / 4;
      assert.ok(cutout ? x >= -1e-6 || y >= -1e-6 : x >= -1e-6 && y >= -1e-6);
      assert.ok(Math.abs(g.colors[v * 3] - (1 - b - c)) < 1e-6 && Math.abs(g.colors[v * 3 + 1] - b) < 1e-6 && Math.abs(g.colors[v * 3 + 2] - c) < 1e-6);
      assert.equal(g.positions[v * 3 + 2], 0); assert.equal(g.normals[v * 3 + 2], 1);
    }
    f.renderer.applyClip(); assert.equal(m.clipped, false); assert.equal(m.cap, false); assert.equal(f.native.clipped, true);
    assert.equal(f.viewer.clipPlanes, nativeClip); assert.deepEqual(Array.from(m.transform), Array.from(src.model)); assert.equal(snapshot(input), before);
  }
});

test('clearance preserves supplied opacity independently of the five base modes and isolation; native picks restore', () => {
  const f = fixture(), input = display([overlay({ opacity: 0.8 })]), planes = f.viewer.clipPlanes;
  f.renderer.setClearanceDisplay(input); const m = f.renderer.clearance.meshes[0], sourceGeometry = m.geometry;
  for (const mode of ['shaded-with-edges', 'hidden-lines-removed', 'hidden-lines-dashed', 'wireframe', 'x-ray']) {
    for (const isolate of [undefined, ['focus'], []]) {
      const view = state(mode, isolate); f.renderer.setState(view); f.renderer.render(camera(), view);
      assert.deepEqual(f.renderer.getDisplayModeStatus(), { requested: mode, effective: mode, supported: true });
      assert.equal(m.geometry, sourceGeometry); assert.equal(m.material.opacity, 0.8); assert.equal(m.material.colorWrite ?? true, true); assert.equal(m.visible, true); assert.equal(m.pickable, false); assert.equal(m.pickTransparent, true); assert.equal(m.cap, false); assert.equal(m.clipped, false);
      assert.equal(f.viewer.clipPlanes, planes);
      assert.deepEqual(f.renderer.pickFace(5, 6, camera(), view), isolate?.length ? null : { body: 0, face: 0 });
      assert.deepEqual(f.renderer.pickEdge(5, 6, camera(), view), isolate?.length ? null : { body: 0, edge: 7 });
      assert.deepEqual(f.calls.filter(c => Array.isArray(c) && c[0] === 'pickLine').at(-1), ['pickLine', 5, 6, 6, { throughSurfaces: false, respectSurfaceDepth: true }]);
    }
  }
});

test('replacement/null clear and dispose owned decals; stable display does not upload again; partial failures leave no stale output', () => {
  const f = fixture(), first = display([overlay()]);
  f.renderer.setClearanceDisplay(first); const old = f.renderer.clearance.meshes[0], count = f.viewer.meshList.length;
  f.renderer.setClearanceDisplay(first); assert.equal(f.viewer.meshList.length, count); assert.equal(old.removals, undefined);
  f.renderer.setClearanceDisplay(display([overlay({ id: 'new', opacity: 1 })])); const next = f.renderer.clearance.meshes[0];
  assert.equal(old.removals, 1); assert.equal(old.geometry.disposals, 1); assert.equal(next.pickTransparent, true);
  f.renderer.setClearanceDisplay(null); assert.equal(next.removals, 1); assert.equal(next.geometry.disposals, 1); assert.equal(f.renderer.clearance, undefined);
  const add = f.viewer.add.bind(f.viewer); let partial;
  f.viewer.add = (input, options) => { if (options.name === 'clearance:failure') throw new Error('mock upload failure'); return partial = add(input, options); };
  assert.throws(() => f.renderer.setClearanceDisplay(display([overlay({ id: 'partial' }), overlay({ id: 'failure' })])), /mock upload failure/);
  assert.equal(partial.removals, 1); assert.equal(partial.geometry.disposals, 1); assert.equal(f.renderer.clearance, undefined);
  assert.equal(f.native.removals, undefined); assert.equal(f.native.geometry.disposals, undefined);
});
