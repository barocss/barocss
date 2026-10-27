import test from 'node:test';
import assert from 'node:assert/strict';
import { Geometry, ImageTexture, Mesh, materialOf } from '../dist/viewer/scene.js';
import { prepareGeometry } from '../dist/viewer/geometry.js';

const owner = { requestRender() {}, sceneMoved() {} };
const texture = (srgb = false) => new ImageTexture(
  { width: 1, height: 1, data: new Uint8Array([128, 128, 255, 255]) },
  { srgb, mipmaps: false, wrap: 'repeat', filter: 'nearest' }, owner,
);
const mesh = (material, host = owner) => new Mesh(new Geometry(prepareGeometry({
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], uvs: [0, 0, 1, 0, 0, 1],
}), host), host, 1, { material });

test('material maps default off with an independent unit normal scale', () => {
  const a = materialOf(), b = materialOf();
  assert.equal(a.normalMap, null); assert.equal(a.roughnessMap, null); assert.equal(a.metallicMap, null);
  assert.deepEqual(a.normalScale, [1, 1]); assert.deepEqual(b.normalScale, [1, 1]);
  assert.notEqual(a.normalScale, b.normalScale);
  assert.equal(a.metallic, 0); assert.equal(a.roughness, 0.55);
});

test('material maps retain live data textures and clone the caller normal scale', () => {
  const normalMap = texture(), roughnessMap = texture(), metallicMap = texture(), colourMap = texture(true);
  const normalScale = [-2, 0], source = { map: colourMap, normalMap, roughnessMap, metallicMap, normalScale, roughness: 0.4, metallic: 0.8 };
  const m = mesh(source);
  normalScale[0] = 9; source.normalMap = null;
  assert.equal(m.material.map, colourMap, 'the colour map keeps its existing sRGB contract');
  assert.equal(m.material.normalMap, normalMap); assert.equal(m.material.roughnessMap, roughnessMap); assert.equal(m.material.metallicMap, metallicMap);
  assert.deepEqual(m.material.normalScale, [-2, 0]); assert.notEqual(m.material.normalScale, normalScale);
  assert.equal(m.material.roughness, 0.4); assert.equal(m.material.metallic, 0.8);
});

test('every material data map refuses sRGB, disposed and non-texture inputs', () => {
  const disposed = texture(); disposed.dispose();
  for (const key of ['normalMap', 'roughnessMap', 'metallicMap']) {
    for (const value of [texture(true), disposed, {}, { disposed: false, options: { srgb: false } }, false]) {
      assert.throws(() => materialOf({ [key]: value }), { code: 'TEXTURE_INVALID' }, key);
    }
  }
});

test('normal scale refuses invalid shape and values without clamping valid signed scales', () => {
  for (const normalScale of [null, [], [1], [1, 1, 1], [NaN, 1], [1, Infinity], [-Infinity, 1], [Number.MAX_VALUE, 1], [1, '1'], '11', {}]) {
    assert.throws(() => materialOf({ normalScale }), { code: 'MATERIAL_INVALID' });
  }
  const limit = 3.4028234663852886e38;
  assert.deepEqual(materialOf({ normalScale: [-limit, limit] }).normalScale, [-limit, limit]);
  assert.deepEqual(materialOf({ normalScale: [0, -1] }).normalScale, [0, -1]);
});

test('invalid map or normal scale leaves the accepted mesh material and shader cache unchanged', () => {
  let requests = 0;
  const host = { requestRender() { requests++; }, sceneMoved() {} };
  const acceptedMap = texture(), m = mesh({ color: '#123456', normalMap: acceptedMap, normalScale: [0.5, -1], shader: { expression: 'vec3f(1.0)', params: [7] } }, host);
  const accepted = m.material, params = m.shaderParams();
  m.dirty = false;
  for (const [update, code] of [[{ color: '#00ff00', roughnessMap: texture(true) }, 'TEXTURE_INVALID'], [{ normalMap: null, normalScale: [1, NaN] }, 'MATERIAL_INVALID']]) {
    assert.throws(() => { m.material = update; }, { code });
    assert.equal(m.material, accepted); assert.equal(m.material.normalMap, acceptedMap);
    assert.deepEqual(m.material.normalScale, [0.5, -1]); assert.equal(m.shaderParams(), params);
    assert.equal(m.dirty, false); assert.equal(requests, 0);
  }
});

test('partial material updates preserve maps and null explicitly removes one map', () => {
  const normalMap = texture(), roughnessMap = texture(), metallicMap = texture();
  const m = mesh({ normalMap, roughnessMap, metallicMap, normalScale: [2, -2] });
  m.material = { roughness: 0.25 };
  assert.equal(m.material.normalMap, normalMap); assert.equal(m.material.roughnessMap, roughnessMap); assert.equal(m.material.metallicMap, metallicMap);
  const normalScale = [0, 1]; m.material = { normalMap: null, normalScale };
  normalScale[1] = 8;
  assert.equal(m.material.normalMap, null); assert.equal(m.material.roughnessMap, roughnessMap); assert.equal(m.material.metallicMap, metallicMap);
  assert.deepEqual(m.material.normalScale, [0, 1]); assert.equal(m.material.roughness, 0.25);
});

test('data maps refuse non-triangle construction and updates without restricting ordinary materials', () => {
  for (const topology of ['lines', 'points', 'labels']) {
    let requests = 0;
    const host = { requestRender() { requests++; }, sceneMoved() {} };
    const geometry = { topology };
    const m = new Mesh(geometry, host, 1, {});
    m.material = { color: '#123456', unlit: true };
    const accepted = m.material;
    m.dirty = false; requests = 0;
    for (const key of ['normalMap', 'roughnessMap', 'metallicMap']) {
      const map = texture();
      assert.throws(() => new Mesh(geometry, host, 2, { material: { [key]: map } }), { code: 'MATERIAL_INVALID' });
      assert.throws(() => { m.material = { color: '#00ff00', [key]: map }; }, { code: 'MATERIAL_INVALID' });
      assert.equal(m.material, accepted); assert.equal(m.dirty, false); assert.equal(requests, 0);
    }
  }
  assert.doesNotThrow(() => mesh({ normalMap: texture(), unlit: true, shadowOnly: true }));
});

test('scalar-field colour maps and UV data maps reject both assignment orders atomically', () => {
  const ramp = { stops: [[0, '#000000'], [1, '#ffffff']] };
  for (const key of ['normalMap', 'roughnessMap', 'metallicMap']) {
    let requests = 0;
    const host = { requestRender() { requests++; }, sceneMoved() {} };
    const analysis = mesh({ color: '#123456' }, host);
    analysis.colorMap = ramp;
    const acceptedRamp = analysis.colorMap, acceptedMaterial = analysis.material;
    analysis.dirty = false; requests = 0;
    assert.throws(() => { analysis.material = { color: '#00ff00', [key]: texture() }; }, { code: 'MATERIAL_INVALID' });
    assert.equal(analysis.material, acceptedMaterial); assert.equal(analysis.colorMap, acceptedRamp);
    assert.equal(analysis.dirty, false); assert.equal(requests, 0);
    analysis.colorMap = null;
    assert.doesNotThrow(() => { analysis.material = { [key]: texture() }; });

    const surface = mesh({ [key]: texture() }, host), surfaceMaterial = surface.material;
    surface.dirty = false; requests = 0;
    assert.throws(() => { surface.colorMap = ramp; }, { code: 'MATERIAL_INVALID' });
    assert.equal(surface.colorMap, null); assert.equal(surface.material, surfaceMaterial);
    assert.equal(surface.dirty, false); assert.equal(requests, 0);
    surface.material = { [key]: null };
    assert.doesNotThrow(() => { surface.colorMap = ramp; });
    assert.deepEqual(surface.colorMap.stops, ramp.stops);
  }
});
