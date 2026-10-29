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
