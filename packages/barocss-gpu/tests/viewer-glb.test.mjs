// Independent fixed GLB inputs. These tests do not exercise a browser or claim product integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeGlb, GLB_MAX_BYTES } from '../dist/viewer/glb-container.js';
import { prepareGlb } from '../dist/viewer/index.js';
import { BIN_CHUNK, JSON_CHUNK, bytesChunk, container, glb, jsonChunk, binChunk, triangleFixture } from './viewer-glb-fixture.mjs';

const invalid = error => error?.code === 'GEOMETRY_INVALID';
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const toSrgb = x => x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055;
const patch = (bytes, offset, value) => { const copy = bytes.slice(); new DataView(copy.buffer).setUint32(offset, value, true); return copy; };
const parsed = change => {
  const { json, bin } = triangleFixture();
  change(json, bin);
  return glb(json, bin);
};

test('GLB container reads an offset view and copies BIN independently, including Node Buffer views', () => {
  const { json, bin } = triangleFixture(), original = glb(json, bin);
  for (const makeView of [bytes => bytes.subarray(5, 5 + original.length), bytes => Buffer.from(bytes.buffer).subarray(5, 5 + original.length)]) {
    const wrapped = new Uint8Array(original.length + 12).fill(0xa5); wrapped.set(original, 5);
    const source = makeView(wrapped), decoded = decodeGlb(source);
    assert.deepEqual(decoded.json, json);
    assert.equal(decoded.bin.length, 80); assert.deepEqual([...decoded.bin.slice(0, bin.length)], [...bin]);
    assert.deepEqual([...decoded.bin.slice(bin.length)], [0, 0]);
    const before = decoded.bin.slice(); source.fill(0); assert.deepEqual(decoded.bin, before);
  }
  const bare = glb({ asset: { version: '2.0' } });
  assert.deepEqual(decodeGlb(bare.buffer).bin, new Uint8Array(0));
});

test('GLB container rejects bad header, unaligned or inconsistent chunk lengths and a size over 64 MiB', () => {
  const { json, bin } = triangleFixture(), valid = glb(json, bin);
  for (const source of [new Uint8Array(19), patch(valid, 0, 0), patch(valid, 4, 1), patch(valid, 8, valid.length - 4), patch(valid, 12, 3), patch(valid, 12, valid.length), new Uint8Array(GLB_MAX_BYTES + 1)]) {
    assert.throws(() => decodeGlb(source), invalid);
  }
  assert.throws(() => decodeGlb(new Float32Array([1,2,3])), invalid);
});

test('GLB container requires valid first JSON and refuses duplicate or unsupported chunks', () => {
  const j = jsonChunk({ asset: { version: '2.0' } }), b = binChunk(new Uint8Array([1,2,3,4]));
  const badUtf8 = bytesChunk(JSON_CHUNK, new Uint8Array([0x7b, 0xff, 0x7d, 0x20]));
  const badJson = bytesChunk(JSON_CHUNK, new TextEncoder().encode('{!}'), 0x20);
  const unknown = bytesChunk(0x41414141, new Uint8Array([0,0,0,0]));
  for (const source of [container([b, j]), container([j, j]), container([j, b, b]), container([j, unknown]), container([badUtf8]), container([badJson]), container([bytesChunk(JSON_CHUNK, new Uint8Array())])]) {
    assert.throws(() => decodeGlb(source), invalid);
  }
});

test('GLB scene prepares an indexed triangle and parent-child TRS with linear material defaults', () => {
  const fixture = triangleFixture(), source = glb(fixture.json, fixture.bin), rows = prepareGlb(source);
  assert.equal(rows.length, 1);
  const { geometry, material, transform } = rows[0];
  assert.deepEqual([...geometry.positions], fixture.positions);
  assert.deepEqual([...geometry.normals], fixture.normals);
  assert.deepEqual([...geometry.indices], [0,1,2]);
  assert.deepEqual([...transform], [2,0,0,0, 0,1,0,0, 0,0,1,0, 2,3,0,1]);
  assert.equal(material.metallic, 1); assert.equal(material.roughness, 1); assert.equal(material.opacity, 1); assert.equal(material.doubleSided, false);
  for (const channel of material.color) close(channel, toSrgb(0.5));
  const before = [...geometry.positions]; source.fill(0); assert.deepEqual([...geometry.positions], before);
});

test('GLB scene converts linear vertex colors to viewer sRGB without retaining opaque alpha', () => {
  const fixture = triangleFixture({ vertexColors: true }), rows = prepareGlb(glb(fixture.json, fixture.bin));
  assert.equal(rows.length, 1); assert.equal(rows[0].geometry.colors.length, 9);
  for (const channel of rows[0].geometry.colors) close(channel, toSrgb(0.5));
});

test('GLB rejects normalized integer vertex colors outside the bounded FLOAT-only subset', () => {
  const fixture = triangleFixture({ vertexColors: true });
  for (const [componentType, byteLength] of [[5121, 12], [5123, 24]]) {
    const bytes = new Uint8Array(80 + byteLength); bytes.set(fixture.bin.slice(0, 78));
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < 12; i++) {
      if (componentType === 5121) view.setUint8(80 + i, 128); else view.setUint16(80 + i * 2, 32768, true);
    }
    fixture.json.buffers[0].byteLength = bytes.length; fixture.json.bufferViews[3].byteLength = byteLength;
    Object.assign(fixture.json.accessors[3], { componentType, normalized: true, type: 'VEC4' });
    assert.throws(() => prepareGlb(glb(fixture.json, bytes)), invalid);
  }
});

test('GLB opaque VEC4 colors validate alpha but output RGB and retain opacity one', () => {
  const fixture = triangleFixture({ vertexColors: true }), bytes = new Uint8Array(128);
  bytes.set(fixture.bin.slice(0, 78));
  const view = new DataView(bytes.buffer);
  for (let vertex = 0; vertex < 3; vertex++) for (let channel = 0; channel < 4; channel++) {
    view.setFloat32(80 + (vertex * 4 + channel) * 4, channel === 3 ? 0.25 : 0.5, true);
  }
  fixture.json.buffers[0].byteLength = bytes.length; fixture.json.bufferViews[3].byteLength = 48;
  fixture.json.accessors[3].type = 'VEC4'; fixture.json.materials[0].pbrMetallicRoughness.baseColorFactor[3] = 0.25;
  const row = prepareGlb(glb(fixture.json, bytes))[0];
  assert.equal(row.material.opacity, 1); assert.equal(row.geometry.colors.length, 9);
  for (const channel of row.geometry.colors) close(channel, toSrgb(0.5));
  view.setFloat32(92, 1.25, true);
  assert.throws(() => prepareGlb(glb(fixture.json, bytes)), invalid);
});

test('GLB omitted material uses glTF defaults, not the viewer defaults', () => {
  const fixture = triangleFixture(); delete fixture.json.meshes[0].primitives[0].material; delete fixture.json.materials;
  assert.deepEqual(prepareGlb(glb(fixture.json, fixture.bin))[0].material, { color: [1,1,1], opacity: 1, metallic: 1, roughness: 1, doubleSided: false });
});

test('GLB matrices compose parent times child and reflected transforms retain front-face winding', () => {
  const fixture = triangleFixture();
  fixture.json.nodes = [
    { matrix: [1,0,0,0, 0,1,0,0, 0,0,1,0, 2,0,0,1], children: [1] },
    { matrix: [-2,0,0,0, 0,1,0,0, 0,0,1,0, 0,3,0,1], mesh: 0 },
  ];
  const row = prepareGlb(glb(fixture.json, fixture.bin))[0];
  assert.deepEqual([...row.transform].map(value => value === 0 ? 0 : value), [-2,0,0,0, 0,1,0,0, 0,0,1,0, 2,3,0,1]);
  assert.deepEqual([...row.geometry.indices], [0,2,1]);
});

test('GLB rejects node scales whose inverse normal matrix exceeds finite f32', () => {
  const smallButFinite = parsed(j => { j.nodes[1].scale = [1e-30,1,1]; });
  assert.doesNotThrow(() => prepareGlb(smallButFinite));
  for (const rotation of [undefined, [0,0,Math.sin(Math.PI / 8),Math.cos(Math.PI / 8)]]) {
    const source = parsed(j => {
      j.nodes[1].scale = [1e-40,1,1];
      if (rotation) j.nodes[1].rotation = rotation;
    });
    assert.throws(() => prepareGlb(source), invalid, 'inverse normal matrix must be finite as f32');
  }
});

test('GLB rejects normal products whose finite matrix components sum beyond f32', () => {
  const transformedNormal = scale => parsed((j, bin) => {
    const view = new DataView(bin.buffer), n = Math.SQRT1_2;
    view.setFloat32(36, n, true); view.setFloat32(40, n, true); view.setFloat32(44, 0, true);
    j.nodes[1] = { mesh: 0, matrix: [scale,-1,0,0, 0,1,0,0, 0,0,1,0, 0,3,0,1] };
  });
  // Both inverse-normal matrix components fit f32 in each case. Only their products' sum overflows in the second.
  assert.doesNotThrow(() => prepareGlb(transformedNormal(5e-39)));
  assert.throws(() => prepareGlb(transformedNormal(3.4e-39)), invalid);
});

test('GLB rejects finite inputs whose world-space vertex positions overflow f32', () => {
  const withPosition = (position, scale, translation) => parsed((j, bin) => {
    new DataView(bin.buffer).setFloat32(12, position, true);
    j.accessors[0].max = [Math.fround(position),1,0];
    j.nodes[1].scale = [scale,1,1]; j.nodes[0].translation = [translation,0,0];
  });
  assert.doesNotThrow(() => prepareGlb(withPosition(1e30, 1e5, 0)));
  assert.throws(() => prepareGlb(withPosition(1e30, 1e20, 0)), invalid, 'position times scale must be finite as f32');
  assert.throws(() => prepareGlb(withPosition(1e38, 1, 3e38)), invalid, 'position plus translation must be finite as f32');
});

test('GLB rejects overflowing GPU matrix products even when double precision terms cancel', () => {
  const cancelling = (value, coefficient) => parsed((j, bin) => {
    const view = new DataView(bin.buffer); view.setFloat32(12, value, true); view.setFloat32(16, value, true);
    j.accessors[0].max = [Math.fround(value),Math.fround(value),0];
    j.nodes[1] = { mesh: 0, matrix: [coefficient,0,0,0, -coefficient,1,0,0, 0,0,1,0, 0,3,0,1] };
  });
  assert.doesNotThrow(() => prepareGlb(cancelling(1e18, 1e18)));
  assert.throws(() => prepareGlb(cancelling(1e20, 1e20)), invalid, 'each GPU f32 product must stay finite before cancellation');
});

test('GLB rejects a zero vertex normal', () => {
  const fixture = triangleFixture(); assert.doesNotThrow(() => prepareGlb(glb(fixture.json, fixture.bin)));
  const invalidNormal = parsed((j, bin) => { new DataView(bin.buffer).setFloat32(44, 0, true); });
  assert.throws(() => prepareGlb(invalidNormal), invalid);
});

test('GLB refuses VEC4 color count even when its total components match a VEC3 position array', () => {
  const fixture = triangleFixture(), bin = new Uint8Array(152), view = new DataView(bin.buffer);
  const positions = [0,0,0, 1,0,0, 0,1,0, 1,1,0], normals = [0,0,1, 0,0,1, 0,0,1, 0,0,1];
  positions.forEach((value, i) => view.setFloat32(i * 4, value, true));
  normals.forEach((value, i) => view.setFloat32(48 + i * 4, value, true));
  [0,1,2].forEach((value, i) => view.setUint16(96 + i * 2, value, true));
  for (let i = 0; i < 12; i++) view.setFloat32(104 + i * 4, 0.5, true);
  fixture.json.buffers[0].byteLength = bin.length;
  fixture.json.bufferViews = [{ buffer: 0, byteOffset: 0, byteLength: 48 }, { buffer: 0, byteOffset: 48, byteLength: 48 }, { buffer: 0, byteOffset: 96, byteLength: 6 }, { buffer: 0, byteOffset: 104, byteLength: 48 }];
  fixture.json.accessors[0].count = 4; fixture.json.accessors[1].count = 4;
  fixture.json.accessors.push({ bufferView: 3, componentType: 5126, count: 3, type: 'VEC4' });
  fixture.json.meshes[0].primitives[0].attributes.COLOR_0 = 3;
  assert.throws(() => prepareGlb(glb(fixture.json, bin)), invalid);
});

test('GLB rejects UNSIGNED_SHORT primitive restart even when vertex 65535 exists', () => {
  const fixture = triangleFixture(), vertices = 65536, vectorBytes = vertices * 3 * 4;
  const indexOffset = vectorBytes * 2, bin = new Uint8Array(indexOffset + 6), view = new DataView(bin.buffer);
  view.setFloat32(12, 1, true); view.setFloat32(65534 * 12 + 4, 1, true); view.setFloat32(65535 * 12 + 4, -1, true);
  for (let vertex = 0; vertex < vertices; vertex++) view.setFloat32(vectorBytes + vertex * 12 + 8, 1, true);
  view.setUint16(indexOffset, 0, true); view.setUint16(indexOffset + 2, 1, true); view.setUint16(indexOffset + 4, 65534, true);
  fixture.json.buffers[0].byteLength = bin.length;
  fixture.json.bufferViews = [{ buffer: 0, byteOffset: 0, byteLength: vectorBytes }, { buffer: 0, byteOffset: vectorBytes, byteLength: vectorBytes }, { buffer: 0, byteOffset: indexOffset, byteLength: 6 }];
  fixture.json.accessors[0].count = vertices; fixture.json.accessors[0].min = [0,-1,0]; fixture.json.accessors[0].max = [1,1,0]; fixture.json.accessors[1].count = vertices;
  const accepted = prepareGlb(glb(fixture.json, bin));
  assert.equal(accepted[0].geometry.positions.length, vertices * 3);
  assert.deepEqual([...accepted[0].geometry.indices], [0,1,65534]);
  // Change only the third index. It is in range but forbidden as a primitive-restart value.
  view.setUint16(indexOffset + 4, 65535, true);
  assert.throws(() => prepareGlb(glb(fixture.json, bin)), invalid);
});

test('GLB refuses unsupported source semantics instead of silently discarding them', () => {
  const changes = [
    j => { j.buffers[0].uri = 'external.bin'; },
    j => { j.extensionsUsed = ['KHR_texture_transform']; },
    j => { j.meshes[0].primitives[0].mode = 1; },
    j => { delete j.meshes[0].primitives[0].attributes.NORMAL; },
    j => { delete j.meshes[0].primitives[0].indices; },
    j => { j.meshes[0].primitives[0].attributes.TEXCOORD_0 = 0; },
    j => { j.meshes[0].primitives[0].targets = [{ POSITION: 0 }]; },
    j => { j.nodes[1].skin = 0; },
    j => { j.bufferViews[0].byteStride = 12; },
    j => { j.accessors[0].sparse = { count: 1 }; },
    j => { j.materials[0].alphaMode = 'BLEND'; },
    j => { j.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 }; },
  ];
  for (const change of changes) assert.throws(() => prepareGlb(parsed(change)), invalid, String(change));
});

test('GLB refuses invalid buffer ranges, references and vertex indices', () => {
  const changes = [
    j => { j.buffers[0].byteLength = 1000; },
    j => { j.bufferViews[0].byteOffset = 1000; },
    j => { j.accessors[0].count = 100; },
    j => { j.meshes[0].primitives[0].attributes.POSITION = 99; },
    (j, bin) => { new DataView(bin.buffer).setUint16(76, 9, true); },
    j => { j.nodes[0].children = [0]; },
  ];
  for (const change of changes) assert.throws(() => prepareGlb(parsed(change)), invalid, String(change));
});
