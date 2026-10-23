// Source-bundled adapter contracts only. Mock meshes/viewer: no GPU, browser or package build.
// Run: node --test --test-concurrency=1 packages/barocss-gpu/tests/cad-gpu-display-contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'cad-gpu-display-contract-'));
let GpuRenderer;
try {
  const outfile = join(temporary, 'gpu-renderer.mjs');
  await build({
    entryPoints: [resolve(root, 'apps/cad-studio/src/viewport/gpuRenderer.ts')], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
    alias: {
      '@barocss/gpu/viewer': resolve(root, 'packages/barocss-gpu/src/viewer/index.ts'), '@barocss/gpu': resolve(root, 'packages/barocss-gpu/src/index.ts'),
      '@barocss/cad-model': resolve(root, 'packages/barocss-cad-model/src'), '@barocss/cad': resolve(root, 'packages/barocss-cad/src'),
    },
  });
  ({ GpuRenderer } = await import(pathToFileURL(outfile).href));
} finally { await rm(temporary, { recursive: true, force: true }); }

const identity = () => new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const camera = () => ({ target: [0, 0, 0], fovY: Math.PI / 4, ortho: false, eye: () => [5, 5, 5], basis: () => ({ right: [1, 0, 0], up: [0, 1, 0], forward: [0, 0, -1] }) });
const view = displayMode => ({ displayMode, hoverFace: null, hoverEdge: null, selectedFaces: [], selectedEdges: [{ body: 0, edge: 7 }], selectedBodies: [0], offsets: new Map([[0, [2, 3, 4]]]), ghostBodies: new Set([1]), hiddenBodies: new Set([2]) });
const geometry = input => ({ input, setColors(colors) { this.colors = Array.from(colors); }, fillColors() {}, setUVs() {}, dispose() { this.disposed = true; } });
class Mesh {
  constructor(g, options = {}) { this.geometry = g; this.transform = identity(); this.visible = true; this.pickable = true; this.clipped = false; this.cap = false; this.capHatch = null; this.pickTransparent = null; this._material = { opacity: 1, colorWrite: true, lineDash: null, lineHidden: 0, lineHiddenDash: null, lineOver: false }; Object.assign(this, options); }
  get material() { return this._material; }
  set material(patch) { Object.assign(this._material, patch); }
  get visible() { return this._visible; }
  set visible(value) { this._visible = !!value; this.visibleWrites = (this.visibleWrites ?? 0) + 1; this.onVisibilityWrite?.(); }
  remove() { this.removed = true; }
}

function fixture() {
  const calls = [], meshes = [], viewer = {
    camera: {}, environment: {}, meshList: meshes, orderIndependent: true,
    createGeometry: input => geometry(input),
    add(input, options) { const m = new Mesh(input?.setColors ? input : geometry(input), options); m.onVisibilityWrite = () => calls.push(['requestRender']); meshes.push(m); return m; },
    resize: dpr => calls.push(['resize', dpr]), render: () => calls.push(['render']), requestRender: () => calls.push(['requestRender']),
    raycast: () => null,
  };
  const renderer = Object.create(GpuRenderer.prototype);
  Object.assign(renderer, { tally: { tracking: false },
    viewer, canvas: { clientWidth: 320, clientHeight: 200 }, displayMode: { requested: 'shaded-with-edges', effective: 'shaded-with-edges', supported: true },
    theme: { base: [0.74, 0.75, 0.78], edge: [0.05, 0.05, 0.06], ao: 0.9, shadow: 0.45 }, aoEnabled: true, interacting: false,
    settings: null, analysis: null, scalarMaps: null, instances: [], direct: [], proposalMeshes: [], mould: null, controls: [], regions: [], poses: null, instancePreview: null,
    hatchLines: new Map(), maps: new Map(), boundsKey: null, boundsMemo: null, clip: null, shaders: new Map(),
    instanceDisplayMode: 'shaded-with-edges', instanceTiles: new WeakMap(), instancePainted: new WeakMap(), instanceFaces: [], instanceSelection: [], instanceMeshes: new Map(), shapes: new Map(), shareCopies: true,
  });
  renderer.bodies = [0, 1, 2].map(bi => {
    const mesh = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), indices: new Uint32Array([0, 1, 2]), faceOfVertex: new Uint32Array([0, 0, 0]), faces: [{ index: 0, id: 'native-plane', kind: 'plane' }], edgeLines: new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0]), edgeOfSegment: new Uint32Array([7, 7, 9, 9]), bounds: { min: [-1, -1, -1], max: [1, 1, 1] } };
    const surface = viewer.add(geometry({ positions: mesh.positions }), { material: { opacity: 1 } });
    const edges = viewer.add(geometry({ positions: mesh.edgeLines, topology: 'lines' }), { material: { color: renderer.theme.edge, lineWidth: 1.2 } });
    return { result: { key: `body-${bi}`, mesh }, surface, edges, highlight: null, state: '', painted: null, runs: { vertexCount: 3, byFace: new Map([[0, [0, 3]]]) } };
  });
  renderer.ground = viewer.add(geometry({}), { material: { shadowOnly: true, opacity: 0.45 } });
  renderer.setSectionHatch([0, 1, 2].map(body => ({ body, segments: new Float32Array([0, 0, 0, 1, 1, 0]) })));
  const planes = Object.freeze([Object.freeze({ normal: Object.freeze([1, 0, 0]), offset: 0 }), Object.freeze({ normal: Object.freeze([0, 1, 0]), offset: 0 })]);
  const clip = Object.freeze({ planes, bodies: true, cutout: true, hatch: 2 });
  renderer.setClip(clip);
  const clipPlanes = viewer.clipPlanes, clipSnapshot = JSON.stringify(clip);
  const render = (mode, dpr = 1, changes = {}) => {
    const previous = globalThis.devicePixelRatio; globalThis.devicePixelRatio = dpr;
    try { renderer.render(camera(), { ...view(mode), ...changes }); }
    finally { if (previous === undefined) delete globalThis.devicePixelRatio; else globalThis.devicePixelRatio = previous; }
    assert.equal(renderer.clip, clip); assert.equal(viewer.clipPlanes, clipPlanes); assert.equal(viewer.clipCutout, true); assert.equal(JSON.stringify(clip), clipSnapshot);
  };
  return { renderer, viewer, calls, render, clip, clipPlanes };
}

for (const dpr of [1, 2]) {
  test(`GPU adapter DPR ${dpr}: all line-only modes retain surfaces/caps and native-edge selection without intercepting picks`, () => {
    const f = fixture();
    for (const mode of ['hidden-lines-removed', 'hidden-lines-dashed', 'wireframe']) {
      f.render(mode, dpr);
      const [solid, ghost, hidden] = f.renderer.bodies;
      for (const b of [solid, ghost, hidden]) {
        assert.equal(b.surface.material.colorWrite, false); assert.equal(b.surface.cap, true); assert.equal(b.surface.clipped, true); assert.ok(b.surface.capHatch, 'section geometry/hatch parameters remain available to the depth cap');
        assert.equal(b.edges.material.lineOver, mode === 'wireframe'); assert.equal(b.edges.material.lineDash, null);
        assert.equal(b.edges.material.lineHidden, mode === 'hidden-lines-dashed' ? 0.55 : 0);
        assert.deepEqual(b.edges.material.lineHiddenDash, mode === 'hidden-lines-dashed' ? [6, 4] : null);
        assert.equal(b.surface.outline, null); assert.equal(f.renderer.hatchLines.get(f.renderer.bodies.indexOf(b)).visible, false);
      }
      assert.equal(solid.surface.visible, true); assert.equal(solid.surface.pickable, true); assert.equal(solid.surface.pickTransparent, false);
      assert.equal(ghost.surface.visible, true); assert.equal(ghost.surface.pickable, false); assert.equal(ghost.surface.material.opacity, 0.35); assert.equal(ghost.surface.pickTransparent, true);
      assert.equal(hidden.surface.visible, false); assert.equal(hidden.surface.pickable, false); assert.equal(hidden.edges.visible, false);
      assert.equal(solid.edges.geometry.input.positions.length, 12, 'retains two native CAD segments, not tessellation edges');
      assert.equal(solid.highlight.geometry.input.positions.length, 6, 'only the selected native edge gets a highlight');
      assert.equal(solid.highlight.pickable, false); assert.equal(solid.highlight.clipped, true); assert.deepEqual(solid.highlight.material.lineHiddenDash, solid.edges.material.lineHiddenDash);
      assert.deepEqual(Array.from(solid.edges.transform), Array.from(solid.surface.transform)); assert.deepEqual(Array.from(solid.highlight.transform), Array.from(solid.surface.transform));
      assert.equal(f.renderer.ground.visible, false); assert.equal(f.viewer.environment.ambientOcclusion, false);
      assert.deepEqual(f.renderer.getDisplayModeStatus(), { requested: mode, effective: mode, supported: true });
      assert.deepEqual(f.calls.at(-2), ['resize', dpr]); assert.deepEqual(f.calls.at(-1), ['render']);
      f.viewer.raycast = () => ({ mesh: solid.surface, face: 12 });
      assert.deepEqual(f.renderer.pickFace(10, 20, camera(), view(mode)), { body: 0, face: 12 });
      f.viewer.pickLine = (...args) => { assert.deepEqual(args, [10, 20, 6, { throughSurfaces: false, respectSurfaceDepth: true }]); return { mesh: solid.edges, edge: 7 }; };
      assert.deepEqual(f.renderer.pickEdge(10, 20, camera(), view(mode)), { body: 0, edge: 7 });
    }
    f.render(undefined, dpr);
    const solid = f.renderer.bodies[0];
    assert.equal(solid.surface.material.colorWrite, true); assert.ok(solid.surface.outline);
    assert.equal(solid.edges.material.lineOver, false); assert.equal(solid.edges.material.lineHidden, 0); assert.equal(solid.edges.material.lineHiddenDash, null);
    assert.equal(f.renderer.hatchLines.get(0).visible, true); assert.equal(f.renderer.ground.visible, true); assert.ok(f.viewer.environment.ambientOcclusion);
    assert.deepEqual(f.renderer.pickFace(10, 20, camera(), view(undefined)), { body: 0, face: 12 });
    const writes = f.renderer.ground.visibleWrites; f.calls.length = 0;
    f.render(undefined, dpr); f.render(undefined, dpr);
    assert.equal(f.renderer.ground.visibleWrites, writes, 'unchanged default ground visibility does not call its requesting setter again');
    assert.equal(f.calls.some(c => c[0] === 'requestRender'), false, 'camera-only default frames do not schedule a ground visibility loop');
  });

  test(`GPU adapter DPR ${dpr}: x-ray changes appearance opacity while preserving original pick transparency and default restoration`, () => {
    const f = fixture(); f.render('x-ray', dpr);
    const [solid, ghost, hidden] = f.renderer.bodies;
    assert.equal(solid.surface.material.opacity, 0.25); assert.equal(solid.surface.pickTransparent, false);
    assert.equal(ghost.surface.material.opacity, 0.25 * 0.35); assert.equal(ghost.surface.pickTransparent, true); assert.equal(ghost.surface.pickable, false);
    assert.equal(hidden.surface.visible, false); assert.equal(hidden.surface.pickable, false);
    assert.equal(solid.surface.cap, true); assert.equal(solid.surface.material.colorWrite, true);
    assert.equal(solid.highlight.pickable, false);
    f.viewer.raycast = () => ({ mesh: solid.surface, face: 12, triangle: 2, scalar: 7, instance: 0 });
    assert.deepEqual(f.renderer.pickFace(10, 20, camera(), view('x-ray')), { body: 0, face: 12 });
    f.render(undefined, dpr);
    assert.equal(solid.surface.material.opacity, 1); assert.equal(ghost.surface.material.opacity, 0.35);
    assert.equal(solid.surface.pickTransparent, false); assert.equal(ghost.surface.pickTransparent, true);
    assert.ok(solid.surface.outline); assert.equal(solid.edges.material.lineOver, false); assert.equal(solid.edges.material.lineHidden, 0); assert.equal(solid.edges.material.lineHiddenDash, null);
    assert.equal(f.renderer.hatchLines.get(0).visible, true); assert.equal(f.renderer.hatchLines.get(1).visible, true); assert.equal(f.renderer.hatchLines.get(2).visible, false);
    assert.equal(f.renderer.ground.visible, true); assert.ok(f.viewer.environment.ambientOcclusion); assert.equal(f.renderer.aoEnabled, true);
    assert.deepEqual(f.renderer.getDisplayModeStatus(), { requested: 'shaded-with-edges', effective: 'shaded-with-edges', supported: true });
    assert.deepEqual(f.renderer.pickFace(10, 20, camera(), view(undefined)), { body: 0, face: 12 });
    f.viewer.raycast = () => null;
    assert.equal(f.renderer.pickFace(10, 20, camera(), view(undefined)), null);
  });
}

test('GPU adapter guards Render, analysis, direct/proposal/mould and external unsupported combinations without changing clip or previous mode', () => {
  for (const [key, value] of [['settings', {}], ['analysis', {}], ['scalarMaps', [{}]], ['direct', [{}]], ['proposalMeshes', [{}]], ['mould', { halves: [] }]]) {
    const f = fixture(); f.renderer.setState(view('wireframe'));
    f.renderer[key] = value;
    if (key === 'settings') f.renderer.settings = { appearances: {}, defaultAppearance: { color: '#ffffff', opacity: 1 }, environment: { edges: true }, materials: {} };
    f.renderer.setState(view('x-ray'));
    const status = f.renderer.getDisplayModeStatus();
    assert.equal(status.requested, 'x-ray', key); assert.equal(status.effective, 'wireframe', key); assert.equal(status.supported, false, key); assert.match(status.reason, /ordinary modelling solids and placed instances/, key);
    assert.equal(f.renderer.clip, f.clip); assert.equal(f.viewer.clipPlanes, f.clipPlanes);
  }
  const f = fixture(); f.renderer.setState(view('hidden-lines-removed'));
  f.renderer.setState({ ...view('x-ray'), displayModeUnsupported: 'Temporary preview requires ordinary solid qualification.' });
  assert.deepEqual(f.renderer.getDisplayModeStatus(), { requested: 'x-ray', effective: 'hidden-lines-removed', supported: false, reason: 'Temporary preview requires ordinary solid qualification.' });
});

function addInstances(f) {
  const source = f.renderer.bodies[0].result.mesh;
  const moved = (values, x) => Float32Array.from(values, (n, i) => i % 3 === 0 ? n + x : n);
  const item = (id, x) => {
    const placement = identity(); placement[12] = x;
    return { id, placement, threads: new Float32Array([x, 0, 0, x, 1, 0]), bodies: [{ key: id, mesh: { ...source, positions: moved(source.positions, x), edgeLines: moved(source.edgeLines, x), bounds: { min: [x - 1, -1, -1], max: [x + 1, 1, 1] } } }] };
  };
  const items = [item('a', 10), item('b', 20), item('hidden', 30)];
  // Bounds/rasterization are outside this mock adapter contract; use a fixed scene box for render's AO sizing.
  f.renderer.bounds = () => ({ min: [0, -1, -1], max: [31, 1, 1] });
  f.renderer.setInstances(items, ['b']);
  const hidden = f.renderer.instances[2];
  f.renderer.setInstances(items.slice(0, 2), ['b']);
  assert.ok([...hidden.surfaces, ...hidden.edges, hidden.threads].every(m => m.removed), 'hidden authority remains omission at the instance input');
  const pose = identity(), drag = identity(); pose[13] = 3; drag[14] = 4;
  f.renderer.setInstanceTransforms(new Map([['b', pose]])); f.renderer.setInstancePreview({ id: 'b', matrix: drag });
  return { items: items.slice(0, 2), one: f.renderer.instances[0], two: f.renderer.instances[1] };
}

for (const dpr of [1, 2]) test(`GPU instance adapter DPR ${dpr}: five modes preserve shared geometry, placement, cap depth and picks`, () => {
  const f = fixture(), { items, one, two } = addInstances(f);
  assert.equal(one.surfaces[0].geometry, two.surfaces[0].geometry);
  assert.equal(one.edges[0].geometry, two.edges[0].geometry);
  const surface = two.surfaces[0], edge = two.edges[0], shape = surface.geometry, edgeShape = edge.geometry;
  const transform = Array.from(surface.transform), nativeSegments = Array.from(edge.geometry.input.positions);
  assert.deepEqual(transform.slice(12, 15), [10, 3, 4], 'reference geometry to world placement, then pose and drag, once each');
  const modes = ['shaded-with-edges', 'hidden-lines-removed', 'hidden-lines-dashed', 'wireframe', 'x-ray', 'shaded-with-edges'];
  for (const mode of modes) {
    f.render(mode, dpr);
    const lineOnly = ['hidden-lines-removed', 'hidden-lines-dashed', 'wireframe'].includes(mode);
    assert.deepEqual(f.renderer.getDisplayModeStatus(), { requested: mode, effective: mode, supported: true });
    assert.equal(two.surfaces[0], surface); assert.equal(surface.geometry, shape); assert.equal(edge.geometry, edgeShape);
    assert.deepEqual(Array.from(surface.transform), transform); assert.deepEqual(Array.from(edge.transform), transform);
    assert.deepEqual(Array.from(edge.geometry.input.positions), nativeSegments, 'mode changes retain native CAD segments');
    assert.equal(surface.material.colorWrite, !lineOnly); assert.equal(surface.material.opacity, mode === 'x-ray' ? 0.25 : 1);
    assert.equal(surface.pickTransparent, false); assert.equal(surface.pickable, true); assert.equal(surface.visible, true);
    assert.equal(surface.cap, true); assert.equal(surface.clipped, true); assert.ok(surface.capHatch);
    assert.equal(!!surface.outline, !lineOnly); assert.equal(two.threads.visible, !lineOnly); assert.equal(two.threads.pickable, false);
    assert.equal(edge.material.lineOver, mode === 'wireframe'); assert.equal(edge.material.lineDash, null);
    assert.equal(edge.material.lineHidden, mode === 'hidden-lines-dashed' ? 0.55 : 0);
    assert.deepEqual(edge.material.lineHiddenDash, mode === 'hidden-lines-dashed' ? [6, 4] : null, 'CSS dash contract is independent of DPR');
    assert.equal(f.renderer.ground.visible, !lineOnly); assert.equal(!!f.viewer.environment.ambientOcclusion, !lineOnly);
    f.viewer.raycast = () => ({ mesh: surface, triangle: 0, face: 0 });
    assert.deepEqual(f.renderer.pickInstanceFace(10, 20, camera()), { id: 'b', body: 0, face: 0 });
    f.viewer.raycast = () => ({ mesh: surface, triangle: null, face: null, cap: true });
    assert.deepEqual(f.renderer.pickInstanceFace(10, 20, camera()), { id: 'b', body: 0, face: -1, cap: true });
    f.renderer.setInstances(items, ['b']); assert.equal(two.surfaces[0], surface, 'selection-only input retains the actual mesh');
  }
  const writes = shape.colors; f.calls.length = 0;
  f.render('shaded-with-edges', dpr); f.render('shaded-with-edges', dpr);
  assert.equal(shape.colors, writes); assert.equal(f.calls.some(c => c[0] === 'requestRender'), false, 'camera-only frames do not repaint instances');
  f.renderer.setInstanceFaces([{ id: 'b', body: 0, face: 0 }]);
  const privateSurface = two.surfaces[0]; assert.notEqual(privateSurface.geometry, shape);
  f.render('wireframe', dpr); f.render('x-ray', dpr); f.render('shaded-with-edges', dpr);
  assert.equal(two.surfaces[0], privateSurface); assert.equal(one.surfaces[0].geometry, shape, 'face-selection copies remain private across modes');
});

test('GPU instance x-ray retains smaller appearance opacity and rejects sorted section caps without changing planes', () => {
  const f = fixture(); addInstances(f); f.render('x-ray');
  f.renderer.settings = { appearances: { 'inst:a': { color: '#ffffff', opacity: 0.1 }, 'inst:b': { color: '#ffffff', opacity: 0.05 } }, defaultAppearance: { color: '#ffffff', opacity: 1 }, environment: { edges: true }, materials: {} };
  f.renderer.paintInstances();
  assert.deepEqual(f.renderer.instances.map(it => it.surfaces[0].material.opacity), [0.1, 0.05]);
  assert.ok(f.renderer.instances.every(it => it.surfaces[0].pickTransparent));
  f.renderer.settings = null; f.renderer.paintInstances(); f.render('hidden-lines-removed');
  f.viewer.orderIndependent = false; f.render('x-ray');
  assert.equal(f.renderer.getDisplayModeStatus().supported, false); assert.equal(f.renderer.getDisplayModeStatus().effective, 'hidden-lines-removed');
  assert.ok(f.renderer.instances.every(it => !it.surfaces[0].material.colorWrite && it.surfaces[0].cap));
  assert.equal(f.viewer.clipPlanes, f.clipPlanes); assert.equal(f.renderer.clip, f.clip);
});

for (const dpr of [1, 2]) test(`GPU isolation DPR ${dpr}: focus/fade/restore scales original opacity and pick authority in all five modes`, () => {
  const f = fixture(), { items, one, two } = addInstances(f);
  const surfaces = [one.surfaces[0], two.surfaces[0]], shapes = surfaces.map(m => m.geometry), transforms = surfaces.map(m => Array.from(m.transform));
  const source = JSON.stringify(items, (_key, value) => ArrayBuffer.isView(value) ? [...value] : value);
  const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} expected ${expected}`);
  const apply = (mode, isolatedInstances) => {
    const state = { ...view(mode), isolatedInstances };
    f.renderer.setState(state); f.render(mode, dpr, { isolatedInstances });
  };
  for (const mode of ['shaded-with-edges', 'hidden-lines-removed', 'hidden-lines-dashed', 'wireframe', 'x-ray']) {
    const modeAlpha = mode === 'x-ray' ? 0.25 : 1, lineOnly = ['hidden-lines-removed', 'hidden-lines-dashed', 'wireframe'].includes(mode);
    apply(mode, undefined);
    const originalBase = f.renderer.bodies.map(b => b.surface.material.opacity), originalEdges = f.renderer.bodies.map(b => b.edges.material.opacity), originalHatch = f.renderer.bodies.map((_b, bi) => f.renderer.hatchLines.get(bi).material.opacity);
    apply(mode, ['b']);
    for (let bi = 0; bi < f.renderer.bodies.length; bi++) {
      const b = f.renderer.bodies[bi]; near(b.surface.material.opacity, originalBase[bi] * 0.15);
      near(b.edges.material.opacity, originalEdges[bi] * 0.15); near(f.renderer.hatchLines.get(bi).material.opacity, originalHatch[bi] * 0.15);
      assert.equal(b.surface.pickable, false); assert.equal(b.surface.pickTransparent, true); assert.equal(b.edges.pickable, false);
      assert.equal(b.surface.visible, bi !== 2 && !lineOnly); assert.equal(b.edges.visible, bi !== 2); assert.equal(b.surface.outline, null);
    }
    near(surfaces[0].material.opacity, modeAlpha * 0.15); near(surfaces[1].material.opacity, modeAlpha);
    assert.equal(surfaces[0].pickable, false); assert.equal(surfaces[0].pickTransparent, true); assert.equal(surfaces[0].outline, null);
    assert.equal(surfaces[1].pickable, true); assert.equal(surfaces[1].pickTransparent, false); assert.equal(!!surfaces[1].outline, !lineOnly);
    assert.equal(surfaces[0].visible, !lineOnly, 'faded line-only surfaces do not occlude focus edges'); assert.equal(surfaces[1].visible, true);
    near(one.edges[0].material.opacity, 0.15); near(two.edges[0].material.opacity, 1);
    near(one.threads.material.opacity, 0.55 * 0.15); near(two.threads.material.opacity, 0.55);
    assert.equal(one.edges[0].pickable, false); assert.equal(two.edges[0].pickable, false, 'instance cosmetic line meshes keep their existing non-pickable policy');
    for (const surface of surfaces) { assert.equal(surface.material.colorWrite, !lineOnly); assert.ok(surface.cap && surface.clipped && surface.capHatch); }
    // The real Viewer filters pickable/visible meshes before reporting native or cap hits.
    f.viewer.raycast = () => {
      const m = surfaces.find(m => m.visible && m.pickable); return m ? { mesh: m, face: null, triangle: null, cap: true } : null;
    };
    assert.deepEqual(f.renderer.pickInstanceFace(10, 20, camera()), { id: 'b', body: 0, face: -1, cap: true });
    apply(mode, ['a']);
    near(surfaces[0].material.opacity, modeAlpha); near(surfaces[1].material.opacity, modeAlpha * 0.15);
    assert.equal(surfaces[0].pickable, true); assert.equal(surfaces[1].pickable, false);
    assert.deepEqual(f.renderer.pickInstanceFace(10, 20, camera()), { id: 'a', body: 0, face: -1, cap: true });
    apply(mode, []);
    assert.deepEqual(f.renderer.bodies.map(b => b.surface.material.opacity), originalBase);
    assert.deepEqual(f.renderer.bodies.map(b => b.surface.pickable), [true, false, false]);
    assert.deepEqual(f.renderer.bodies.map(b => b.surface.pickTransparent), [false, true, false]);
    for (let i = 0; i < surfaces.length; i++) {
      near(surfaces[i].material.opacity, modeAlpha); assert.equal(surfaces[i].pickable, true); assert.equal(surfaces[i].pickTransparent, false); assert.equal(surfaces[i].visible, true);
      assert.equal(surfaces[i].geometry, shapes[i]); assert.deepEqual(Array.from(surfaces[i].transform), transforms[i]);
    }
    f.viewer.raycast = () => ({ mesh: surfaces[1], face: 0, triangle: 0 });
    assert.deepEqual(f.renderer.pickInstanceFace(10, 20, camera()), { id: 'b', body: 0, face: 0 });
    assert.deepEqual(f.renderer.instances.map(it => it.id), ['a', 'b'], 'isolate does not restore omitted hidden input');
    assert.equal(JSON.stringify(items, (_key, value) => ArrayBuffer.isView(value) ? [...value] : value), source);
  }
});

test('GPU cached curved silhouettes retain section clipping and no native pick authority through isolation', () => {
  const f = fixture(), b = f.renderer.bodies[0], source = b.result.mesh;
  source.faces[0].kind = 'curved'; source.normals = new Float32Array([1, 0, 0, -1, 0, 0, 0, 1, 0]);
  const native = Array.from(source.edgeLines); f.render('shaded-with-edges');
  const line = f.renderer.silhouettes.get(b.surface)?.line;
  assert.ok(line); assert.equal(line.pickable, false); assert.equal(line.clipped, true);
  const geometry = line.geometry;
  f.renderer.setState(view('shaded-with-edges')); f.render('shaded-with-edges');
  assert.equal(f.renderer.silhouettes.get(b.surface).line, line); assert.equal(line.geometry, geometry);
  assert.equal(line.clipped, true, 'applyClip must not invalidate a style-cached silhouette clip flag');
  f.renderer.setState({ ...view('hidden-lines-dashed'), isolatedInstances: ['focus'] }); f.render('hidden-lines-dashed', 1, { isolatedInstances: ['focus'] });
  assert.equal(b.surface.visible, false); assert.equal(line.visible, true, 'faded line-only context keeps its silhouette while omitting its depth surface');
  assert.equal(line.pickable, false); assert.equal(line.clipped, true); assert.deepEqual(line.material.lineHiddenDash, [6, 4]);
  assert.ok(Math.abs(line.material.opacity - 0.9 * 0.15) < 1e-12);
  f.renderer.setState({ ...view('shaded-with-edges'), isolatedInstances: [] }); f.render('shaded-with-edges', 1, { isolatedInstances: [] });
  assert.equal(b.surface.visible, true); assert.equal(line.clipped, true); assert.equal(line.material.opacity, 0.9);
  assert.deepEqual(Array.from(source.edgeLines), native); assert.equal(line.pickable, false);
});

test('GPU adapter rejects sorted-transparency x-ray sections and retains the prior mode and G20 planes', () => {
  const f = fixture(); f.render('hidden-lines-removed');
  f.viewer.orderIndependent = false; f.render('x-ray');
  const status = f.renderer.getDisplayModeStatus();
  assert.equal(status.requested, 'x-ray'); assert.equal(status.effective, 'hidden-lines-removed'); assert.equal(status.supported, false);
  assert.match(status.reason, /order-independent transparency.*sorted transparency/);
  assert.equal(f.renderer.clip, f.clip); assert.equal(f.viewer.clipPlanes, f.clipPlanes); assert.equal(f.viewer.clipCutout, true);
  f.render(undefined); assert.deepEqual(f.renderer.getDisplayModeStatus(), { requested: 'shaded-with-edges', effective: 'shaded-with-edges', supported: true });
});

test('GPU adapter preserves pre-existing opacity below the x-ray ceiling when an unsupported Render request keeps the prior x-ray mode', () => {
  const f = fixture(); f.renderer.setState(view('x-ray'));
  f.renderer.settings = {
    appearances: { 'body-0': { color: '#ffffff', opacity: 0.1 }, 'body-1': { color: '#ffffff', opacity: 0.05 } }, defaultAppearance: { color: '#ffffff', opacity: 0.12 }, environment: { edges: true }, materials: {},
  };
  for (const b of f.renderer.bodies) b.state = '';
  f.renderer.setState(view('x-ray'));
  assert.equal(f.renderer.getDisplayModeStatus().supported, false); assert.equal(f.renderer.getDisplayModeStatus().effective, 'x-ray');
  assert.deepEqual(f.renderer.bodies.map(b => b.surface.material.opacity), [0.1, 0.05, 0.12]);
  assert.ok(f.renderer.bodies.every(b => b.surface.pickTransparent));
  f.renderer.settings = null; for (const b of f.renderer.bodies) b.state = '';
  f.renderer.setState(view(undefined));
  assert.deepEqual(f.renderer.bodies.map(b => b.surface.material.opacity), [1, 0.35, 1]);
  assert.deepEqual(f.renderer.bodies.map(b => b.surface.pickTransparent), [false, true, false]);
});
