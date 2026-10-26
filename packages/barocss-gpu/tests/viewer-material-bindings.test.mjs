// Structural CPU tests with fake resources. These do not compile shaders or render GPU pixels.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Viewer } from '../dist/viewer/viewer.js';
import { Geometry, ImageTexture, Mesh } from '../dist/viewer/scene.js';
import { prepareGeometry } from '../dist/viewer/geometry.js';

function gpu() {
  const buffers = [], textures = [], groups = [], writes = [];
  const device = {
    queue: {
      writeTexture() {},
      writeBuffer(buffer, offset, data) {
        const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        buffer.bytes.set(bytes, offset);
        writes.push({ buffer, bytes: Uint8Array.from(bytes) });
      },
    },
    createBuffer(descriptor) {
      const buffer = { descriptor, bytes: new Uint8Array(descriptor.size), destroyed: 0, destroy() { this.destroyed++; } };
      buffers.push(buffer); return buffer;
    },
    createTexture(descriptor) {
      const texture = { descriptor, destroyed: 0, createView() { return { texture: this }; }, destroy() { this.destroyed++; } };
      textures.push(texture); return texture;
    },
    createSampler(descriptor) { return { device, descriptor }; },
    createBindGroup(descriptor) { const group = { ...descriptor }; groups.push(group); return group; },
  };
  return { device, buffers, textures, groups, writes };
}

function installDevice(viewer, fake) {
  viewer.device = fake.device;
  viewer.materialLayout = {};
  viewer.mipSampler = fake.device.createSampler({});
  viewer.zeroParams = fake.device.createBuffer({ size: 64 });
  const texture = fake.device.createTexture({ size: [1, 1], format: 'rgba8unorm' });
  viewer.white = { texture, group: fake.device.createBindGroup({
    layout: viewer.materialLayout,
    entries: viewer.materialEntries(texture, viewer.mipSampler, viewer.zeroParams, undefined, texture),
  }) };
}

function fixture() {
  const viewer = Object.create(Viewer.prototype), fake = gpu();
  Object.assign(viewer, { meshes: [], freeSlots: [], costRecords: new Map(), scene: null, requestRender() {}, sceneMoved() {} });
  installDevice(viewer, fake);
  return { viewer, fake };
}

const image = (viewer, srgb = false, filter = 'nearest') => new ImageTexture(
  { width: 1, height: 1, data: new Uint8Array([128, 128, 255, 255]) },
  { srgb, mipmaps: false, wrap: 'repeat', filter }, viewer,
);
function mesh(viewer, material) {
  const geometry = new Geometry(prepareGeometry({ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], uvs: [0, 0, 1, 0, 0, 1] }), viewer);
  const m = new Mesh(geometry, viewer, viewer.meshes.length + 1, { material });
  m.slot = viewer.meshes.length; viewer.meshes.push(m); return m;
}
const entry = (group, binding) => group.entries.find(e => e.binding === binding).resource;
const flags = buffer => new Uint32Array(buffer.bytes.buffer)[2];
function complete(group) { assert.deepEqual(group.entries.map(e => e.binding).sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]); }
function neutral(viewer, group) {
  complete(group);
  for (const binding of [3, 5, 7]) assert.equal(entry(group, binding).texture, viewer.white.texture);
  for (const binding of [4, 6, 8]) assert.equal(entry(group, binding), viewer.mipSampler);
  assert.equal(flags(entry(group, 9).buffer), 0);
}

test('white, colour-map, custom-shader and scalar-ramp helper groups supply ten bindings with neutral data maps', () => {
  const { viewer, fake } = fixture();
  neutral(viewer, viewer.white.group);
  assert.equal(entry(viewer.white.group, 0).texture, viewer.white.texture);
  assert.equal(entry(viewer.white.group, 2).buffer, viewer.zeroParams);

  const colourMap = image(viewer, true), plain = viewer.materialGroup(mesh(viewer, { map: colourMap }));
  neutral(viewer, plain);
  assert.equal(entry(plain, 0).texture, colourMap.gpu.texture);
  assert.equal(colourMap.gpu.texture.descriptor.format, 'rgba8unorm-srgb');
  assert.equal(entry(plain, 1), colourMap.gpu.sampler);

  const customMesh = mesh(viewer, { shader: { expression: 'vec3f(1.0)', params: [3] } });
  const custom = viewer.materialGroup(customMesh);
  neutral(viewer, custom);
  assert.equal(entry(custom, 2).buffer, customMesh.materialState.params);
  assert.equal(new Float32Array(entry(custom, 2).buffer.bytes.buffer)[0], 3);

  const rampTexture = fake.device.createTexture({ size: [256, 1] }), rampSampler = fake.device.createSampler({}), rampParams = fake.device.createBuffer({ size: 64 });
  const ramp = { entries: viewer.materialEntries(rampTexture, rampSampler, rampParams) };
  neutral(viewer, ramp);
  assert.equal(entry(ramp, 0).texture, rampTexture); assert.equal(entry(ramp, 1), rampSampler); assert.equal(entry(ramp, 2).buffer, rampParams);
});

test('each PBR role binds a linear texture and its sampler with its independent flag', () => {
  const { viewer } = fixture();
  for (const [key, textureBinding, samplerBinding, bit] of [['normalMap', 3, 4, 1], ['roughnessMap', 5, 6, 2], ['metallicMap', 7, 8, 4]]) {
    const map = image(viewer), m = mesh(viewer, { [key]: map });
    const group = viewer.materialGroup(m);
    complete(group);
    assert.equal(map.gpu.texture.descriptor.format, 'rgba8unorm');
    assert.equal(entry(group, textureBinding).texture, map.gpu.texture);
    assert.equal(entry(group, samplerBinding), map.gpu.sampler);
    assert.equal(flags(entry(group, 9).buffer), bit);
    for (const binding of [3, 5, 7].filter(b => b !== textureBinding)) assert.equal(entry(group, binding).texture, viewer.white.texture);
  }
  const maps = [image(viewer), image(viewer, false, 'linear'), image(viewer)];
  const group = viewer.materialGroup(mesh(viewer, { normalMap: maps[0], roughnessMap: maps[1], metallicMap: maps[2] }));
  complete(group); assert.equal(flags(entry(group, 9).buffer), 7);
  maps.forEach((map, i) => {
    assert.equal(entry(group, 3 + i * 2).texture, map.gpu.texture);
    assert.equal(entry(group, 4 + i * 2), map.gpu.sampler);
  });
});

test('material cache reuses its group while normal scale and custom parameters update their own buffers', () => {
  const { viewer, fake } = fixture(), parameters = [1];
  const m = mesh(viewer, { normalMap: image(viewer), shader: { expression: 'vec3f(1.0)', params: parameters } });
  const group = viewer.materialGroup(m), state = m.materialState;
  const allocated = fake.buffers.length, writeCount = fake.writes.length;
  assert.equal(viewer.materialGroup(m), group); assert.equal(fake.writes.length, writeCount);
  m.material = { normalScale: [-2, 0] };
  assert.equal(viewer.materialGroup(m), group); assert.equal(m.materialState, state);
  assert.deepEqual([...new Float32Array(state.pbrParams.bytes.buffer).slice(0, 2)], [-2, 0]);
  assert.equal(flags(state.pbrParams), 1); assert.equal(fake.buffers.length, allocated);
  parameters[0] = 5;
  assert.equal(viewer.materialGroup(m), group);
  assert.equal(new Float32Array(state.params.bytes.buffer)[0], 5);
  assert.equal(state.params.destroyed, 0); assert.equal(state.pbrParams.destroyed, 0);
});

test('a disposed accepted data map falls back to neutral and a replacement creates a live binding', () => {
  const { viewer } = fixture(), map = image(viewer), m = mesh(viewer, { normalMap: map });
  viewer.materialGroup(m);
  const state = m.materialState, oldTexture = map.gpu.texture;
  map.dispose();
  const fallback = viewer.materialGroup(m);
  neutral(viewer, fallback); assert.equal(fallback, viewer.white.group);
  assert.equal(oldTexture.destroyed, 1); assert.equal(m.materialState, null);
  assert.equal(state.params.destroyed, 1); assert.equal(state.pbrParams.destroyed, 1);
  const replacement = image(viewer); m.material = { normalMap: replacement };
  const group = viewer.materialGroup(m);
  assert.equal(entry(group, 3).texture, replacement.gpu.texture); assert.equal(flags(entry(group, 9).buffer), 1);
});

test('clearing a material or removing its mesh destroys both owned parameter buffers exactly once', () => {
  const { viewer } = fixture();
  for (const action of ['clear', 'remove']) {
    const m = mesh(viewer, { metallicMap: image(viewer), shader: { expression: 'vec3f(1.0)' } });
    viewer.materialGroup(m); const state = m.materialState;
    if (action === 'clear') { m.material = { metallicMap: null, shader: null }; neutral(viewer, viewer.materialGroup(m)); }
    else viewer.remove(m);
    assert.equal(m.materialState, null); assert.equal(state.params.destroyed, 1); assert.equal(state.pbrParams.destroyed, 1);
    if (action === 'clear') viewer.materialGroup(m); else viewer.remove(m);
    assert.equal(state.params.destroyed, 1); assert.equal(state.pbrParams.destroyed, 1);
  }
});

test('device replacement rebuilds data-map bindings and releases the previous material buffers', () => {
  const { viewer } = fixture(), map = image(viewer), m = mesh(viewer, { roughnessMap: map });
  const oldGroup = viewer.materialGroup(m), state = m.materialState, oldTexture = map.gpu.texture;
  const next = gpu(); installDevice(viewer, next);
  const group = viewer.materialGroup(m);
  assert.notEqual(group, oldGroup); complete(group);
  assert.equal(state.params.destroyed, 1); assert.equal(state.pbrParams.destroyed, 1);
  assert.equal(map.gpu.device, next.device); assert.notEqual(map.gpu.texture, oldTexture);
  assert.equal(map.gpu.texture.descriptor.format, 'rgba8unorm');
  assert.equal(entry(group, 5).texture, map.gpu.texture); assert.equal(entry(group, 6), map.gpu.sampler);
  assert.equal(flags(entry(group, 9).buffer), 2);
  assert.notEqual(m.materialState.params, state.params); assert.notEqual(m.materialState.pbrParams, state.pbrParams);
  assert.equal(m.materialState.params.destroyed, 0); assert.equal(m.materialState.pbrParams.destroyed, 0);
});
