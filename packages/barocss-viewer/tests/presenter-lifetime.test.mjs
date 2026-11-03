import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLifetimeSource, setup, drawing, items, buffer, attachBuffers, growth } from './fixtures/presenter-lifetime-harness.mjs';

// CPU white-box ownership checks use actual production scene methods with recording buffers; real WebGPU is separate.
const api = await loadLifetimeSource();

test('Presenter replacement keeps only active owned geometry, then empty and dispose retain none', () => {
  const result = growth(api);
  assert.deepEqual(result.counts.map(c => c.retained), [1, 1, 0, 0]);
  assert.deepEqual(result.counts.map(c => c.meshes), [1, 1, 0, 0]);
  assert.equal(result.preserved, true); assert.equal(result.explicitDisposals, 33);
});

test('triangles, lines and dots release every owned buffer once, preserve shared UVs and update dot size with the camera', () => {
  const f = setup(api), source = items(), before = structuredClone(source), sharedUV = buffer();
  f.presenter.show(drawing(source)); const old = [...f.core.meshList], dot = [...old[2].instances.matrices[0]], owned = [];
  for (let i = 0; i < old.length; i++) owned.push(...attachBuffers(old[i].geometry, i === 1 ? sharedUV : undefined));
  for (const m of old) {
    const instances = buffer(), params = buffer(), pbr = buffer(), mappedParams = buffer(), mappedTexture = buffer();
    m.instances = { ...(m.instances ?? {}), buffer: instances, device: {} };
    m.materialState = { params, pbrParams: pbr }; m.mapState = { params: mappedParams, texture: mappedTexture };
    owned.push(instances, params, pbr, mappedParams, mappedTexture);
  }
  f.presenter.show(drawing(source, 10));
  assert.equal(f.core.geometries.size, 3); assert.equal(f.core.meshList.length, 3);
  assert.ok(old.every(m => m.geometry.disposed && m.geometry.disposals === 1 && m.slot === -1));
  assert.ok(owned.every(b => b.destroyed === 1)); assert.equal(sharedUV.destroyed, 0);
  assert.equal(f.core.meshList[2].instances.matrices[0][0], dot[0] * 2);
  const active = [...f.core.meshList], finalBuffers = active.flatMap(m => attachBuffers(m.geometry));
  f.presenter.dispose(); f.presenter.dispose();
  assert.equal(f.core.geometries.size, 0); assert.equal(f.core.meshList.length, 0);
  assert.ok(finalBuffers.every(b => b.destroyed === 1)); assert.ok(owned.every(b => b.destroyed === 1)); assert.deepEqual(source, before);
});

test('Core explicit geometry stays reusable across two meshes, removal, Presenter changes and caller disposal', () => {
  const f = setup(api), g = f.core.createGeometry(items()[0]), a = f.core.add(g), b = f.core.add(g), owned = attachBuffers(g);
  a.remove(); assert.equal(g.disposed, false); assert.ok(f.core.meshList.includes(b)); assert.ok(owned.every(x => x.destroyed === 0));
  f.presenter.show(drawing(items())); assert.equal(f.core.geometries.size, 4);
  f.presenter.show(drawing([])); assert.equal(f.core.geometries.size, 1); assert.deepEqual(f.core.meshList, [b]);
  b.remove(); const c = f.core.add(g); assert.equal(c.geometry, g); assert.equal(g.disposed, false);
  c.remove(); g.dispose(); assert.equal(f.core.geometries.size, 0); assert.ok(owned.every(x => x.destroyed === 1));
  f.presenter.dispose(); assert.ok(owned.every(x => x.destroyed === 1));
});

test('source arrays remain unchanged and in-place edits are copied into a new prepared geometry', () => {
  const f = setup(api), source = items()[0]; source.normals = [0, 0, 1, 0, 0, 1, 0, 0, 1]; source.uvs = [0, 0, 1, 0, 0, 1];
  const original = structuredClone(source); f.presenter.show(drawing([source])); const old = f.core.meshList[0].geometry;
  assert.deepEqual(source, original); source.positions[0] = 7; source.normals[0] = 0.5; source.uvs[0] = 0.25; source.indices.reverse();
  const edited = structuredClone(source); f.presenter.show(drawing([source])); const next = f.core.meshList[0].geometry;
  assert.notEqual(next, old); assert.equal(old.disposed, true); assert.equal(next.data.positions[0], 7); assert.equal(next.data.normals[0], 0.5); assert.equal(next.data.uvs[0], 0.25);
  assert.deepEqual([...next.data.indices], source.indices); assert.deepEqual(source, edited); f.presenter.dispose();
});

test('an actual Mesh construction failure frees the new Geometry and retains the existing partial-show policy', () => {
  const f = setup(api), bad = { ...items()[0], color: 'invalid-color' };
  assert.throws(() => f.presenter.show(drawing([items()[0], bad])), e => e.code === 'COLOR_INVALID');
  assert.equal(f.core.meshList.length, 1, 'the earlier successful item remains until the next show');
  assert.equal(f.core.geometries.size, 1, 'the failed item leaves no orphan');
  assert.equal(f.all[1].disposed, true); assert.equal(f.all[1].disposals, 1);
  f.presenter.show(drawing([])); assert.equal(f.core.geometries.size, 0); assert.equal(f.all[0].disposals, 1); f.presenter.dispose();
});

test('failure after Geometry creation preserves the original error and does not dispose caller textures', () => {
  const f = setup(api), error = new Error('injected add failure'), texture = new api.ImageTexture({ width: 1, height: 1, data: new Uint8Array(4) }, {}, f.core);
  const externalTexture = buffer(); texture.gpu = { texture: externalTexture }; f.core.textures.add(texture);
  const grow = f.core.growObjects; f.core.growObjects = () => { throw error; };
  assert.throws(() => f.presenter.show(drawing([items()[0]])), e => e === error);
  assert.equal(f.core.geometries.size, 0); assert.equal(f.all[0].disposals, 1); assert.equal(texture.disposed, false); assert.equal(externalTexture.destroyed, 0);
  f.core.growObjects = grow; f.presenter.show(drawing([items()[0]]));
  f.core.meshList[0].material = { ...f.core.meshList[0].material, map: texture };
  f.presenter.show(drawing([])); assert.equal(texture.disposed, false); assert.equal(externalTexture.destroyed, 0);
  f.presenter.dispose(); assert.equal(texture.disposed, true); assert.equal(externalTexture.destroyed, 1, 'the owning Core final disposal retains its existing policy');
});

test('public Viewer.clear removes only the Presenter scene geometry', () => {
  const f = setup(api); globalThis.HTMLCanvasElement = class { width = 320; height = 240; };
  const viewer = new api.PublicViewer(new HTMLCanvasElement(), { mmToSceneUnit: 0.1, background: [0, 0, 0] }, f.presenter);
  const source = items(); f.presenter.show(drawing(source)); assert.equal(f.core.geometries.size, 3);
  viewer.clear(); assert.equal(f.core.geometries.size, 0); assert.equal(f.core.meshList.length, 0); viewer.dispose();
});

// Append to existing presenter-lifetime.test.mjs only after root reviews the patch.
function displayTriangle() {
  return { version: 0, revision: 1, sourceUnit: 'mm', sourceFrame: 'right-handed-z-up', bodies: [{ bodyId: 'bracket',
    positions: new Float64Array([0, 0, 0, 10, 0, 0, 0, 0, 10]),
    normals: new Float32Array([0, -1, 0, 0, -1, 0, 0, -1, 0]), indices: new Uint32Array([0, 1, 2]) }] };
}
function packetSquare() {
  return [{ modelId: 'literal', packet: { version: 0, surfaceId: 'literal-square', revision: 0, lengthUnit: 'mm',
    coordinateSystem: 'right-handed-z-up', winding: 'ccw', positions: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2, 0, 2, 3],
    parameters: [0, 0, 1, 0, 1, 1, 0, 1], bounds: { min: [-1, -1, 0], max: [1, 1, 0] } } }];
}
function displayViewer() {
  const f = setup(api); globalThis.HTMLCanvasElement = class { width = 320; height = 240; };
  return { ...f, viewer: new api.PublicViewer(new HTMLCanvasElement(), { mmToSceneUnit: .1, background: [0, 0, 0] }, f.presenter) };
}
test('display boundary owns copied render triangles and refuses native UV inspection', () => {
  const f = displayViewer(), source = displayTriangle();
  f.viewer.loadDisplayMeshes(source);
  const accepted = f.viewer.getState();
  assert.equal(accepted.status, 'ready'); assert.equal(accepted.displayMeshes.authority, 'approximate-display-only');
  assert.deepEqual(accepted.surfaces, []); assert.deepEqual(accepted.packets, []);
  assert.equal(accepted.native, null); assert.equal(accepted.document, null);
  assert.throws(() => f.viewer.pick(0, 0), /no native Surface\/UV/);
  source.bodies[0].positions[0] = 99;
  assert.equal(f.viewer.getState().displayMeshes.bodies[0].positions[0], 0);
  const before = f.viewer.getState(), geometry = f.core.meshList[0].geometry;
  assert.throws(() => f.viewer.loadDisplayMeshes({ ...displayTriangle(), revision: -1 }), /revision/);
  assert.deepEqual(f.viewer.getState(), before); assert.equal(f.core.meshList[0].geometry, geometry); assert.equal(geometry.disposed, false);
  let reads = 0; const getter = displayTriangle();
  Object.defineProperty(getter, 'revision', { enumerable: true, get() { reads++; return 2; } });
  assert.throws(() => f.viewer.loadDisplayMeshes(getter), /own data/); assert.equal(reads, 0);
  assert.throws(() => f.viewer.loadDisplayMeshes({ ...displayTriangle(), bodies: new Array(1) }), /dense/);
  assert.deepEqual(f.viewer.getState(), before); assert.equal(f.core.meshList[0].geometry, geometry);
  f.viewer.dispose(); assert.equal(f.core.geometries.size, 0);
});
test('display camera operations retain body data and packet transitions clear incompatible state', () => {
  const f = displayViewer(); f.viewer.setPackets(packetSquare());
  assert.equal(f.viewer.getState().surfaces.length, 1);
  f.viewer.loadDisplayMeshes(displayTriangle()); assert.deepEqual(f.viewer.getState().surfaces, []);
  const before = f.viewer.getState(); f.viewer.orbit(.1, .05);
  assert.notDeepEqual(f.viewer.getState().camera, before.camera);
  assert.deepEqual(f.viewer.getState().displayMeshes, before.displayMeshes);
  f.viewer.fit(); assert.deepEqual(f.viewer.getState().camera, before.camera);
  f.viewer.setPackets(packetSquare()); assert.equal(f.viewer.getState().displayMeshes, null);
  assert.equal(f.viewer.getState().surfaces.length, 1);
  f.viewer.loadDisplayMeshes(displayTriangle()); f.viewer.clear();
  assert.equal(f.viewer.getState().displayMeshes, null); assert.equal(f.viewer.getState().status, 'empty');
  f.viewer.dispose(); assert.equal(f.core.geometries.size, 0);
});
test('presenter failure cannot adopt a display candidate or report its frame ready', () => {
  const f = displayViewer(); f.viewer.loadDisplayMeshes(displayTriangle());
  const failure = new Error('injected actual presenter add failure');
  f.core.growObjects = () => { throw failure; };
  assert.throws(() => f.viewer.loadDisplayMeshes({ ...displayTriangle(), revision: 2 }), error => error === failure);
  assert.equal(f.viewer.getState().status, 'disposed');
  assert.equal(f.viewer.getState().displayMeshes, null); assert.equal(f.core.geometries.size, 0);
  f.viewer.dispose();
});
test('appearance guards preserve display state, and existing qualified replacement clears it', () => {
  const f = displayViewer(), seed = api.directionalSeed();
  const appearance = { version: 1, source: seed.source, display: seed.display,
    appearance: { lighting: { ambientStrength: .3, directionalStrength: .7, direction: [0, .5, 1] }, materials: seed.materials } };
  f.viewer.loadDisplayMeshes(displayTriangle()); const before = f.viewer.getState(), geometry = f.core.meshList[0].geometry;
  assert.throws(() => f.viewer.loadNativeSceneAppearance(appearance), /drawn nothing/);
  assert.throws(() => f.viewer.replaceNativeSceneAppearance(appearance), /qualified scene/);
  assert.deepEqual(f.viewer.getState(), before); assert.equal(f.core.meshList[0].geometry, geometry);
  // clear retains the existing qualified-empty presentation contract. The
  // existing replacement method then admits its actual documented fixture.
  f.viewer.clear(); f.viewer.replaceNativeSceneAppearance(appearance);
  assert.equal(f.viewer.getState().displayMeshes, null); assert.ok(f.viewer.getState().document);
  f.viewer.loadDisplayMeshes(displayTriangle());
  assert.equal(f.viewer.getState().document, null); assert.equal(f.viewer.getState().surfaceMaterials.length, 0);
  assert.equal(f.viewer.getState().displayMeshes.authority, 'approximate-display-only');
  f.viewer.dispose(); assert.equal(f.core.geometries.size, 0);
});
test('display typed-array overrides refuse before user code or presentation', () => {
  const f = displayViewer(); f.viewer.loadDisplayMeshes(displayTriangle());
  const before = f.viewer.getState(), geometry = f.core.meshList[0].geometry; let calls = 0;
  const subclass = Base => class extends Base {
    get length() { calls++; throw new Error('subclass length executed'); }
    get buffer() { calls++; throw new Error('subclass buffer executed'); }
  };
  const variants = [
    { positions: new (subclass(Float32Array))(9) }, { positions: new (subclass(Float64Array))(9) },
    { normals: new (subclass(Float32Array))(9) }, { indices: new (subclass(Uint32Array))(3) },
  ];
  const refused = (input, pattern) => {
    assert.throws(() => f.viewer.loadDisplayMeshes(input), pattern); assert.equal(calls, 0);
    assert.deepEqual(f.viewer.getState(), before); assert.equal(f.core.meshList[0].geometry, geometry);
    assert.equal(f.core.geometries.size, 1); assert.equal(geometry.disposed, false);
  };
  for (const change of variants) {
    const input = displayTriangle(); Object.assign(input.bodies[0], change);
    refused(input, /exact typed-array prototypes/);
  }
  for (const field of ['positions', 'normals', 'indices']) {
    for (const metadata of ['length', 'buffer', Symbol.iterator]) {
      const input = displayTriangle();
      Object.defineProperty(input.bodies[0][field], metadata, { get() { calls++; throw new Error('own metadata executed'); } });
      refused(input, /own typed-array metadata\/iterator/);
    }
  }
  const iterator = displayTriangle();
  Object.defineProperty(iterator.bodies[0].indices, Symbol.iterator, { value() { calls++; throw new Error('own iterator executed'); } });
  refused(iterator, /own typed-array metadata\/iterator/);
  f.viewer.dispose(); assert.equal(f.core.geometries.size, 0);
});
