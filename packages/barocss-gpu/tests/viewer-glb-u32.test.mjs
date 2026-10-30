// New 04.1 parser tests only. These synthetic inputs are not external glTF assets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareGlb, prepareTexturedGlb, materializeGlbTextures } from '../dist/viewer/index.js';
import { u32Sample, packU32Glb } from '../examples/glb-u32-sample.js';
import { triangleFixture } from './viewer-glb-fixture.mjs';

const invalid = error => error?.code === 'GEOMETRY_INVALID';
const textureInvalid = error => error?.code === 'TEXTURE_INVALID';
const imageHeader = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,32,0,0,0,32,8,6,0,0,0,0,0,0,0]);

test('04.1 GLB keeps UNSIGNED_INT indices 65535 and 65536', () => {
  const input = u32Sample(), row = prepareGlb(input.bytes)[0];
  assert.ok(row.geometry.indices instanceof Uint32Array);
  assert.deepEqual([...row.geometry.indices],[0,65535,65536]);
  assert.equal(row.geometry.positions.length,65537*3);
  input.bytes.fill(0); assert.deepEqual([...row.geometry.indices],[0,65535,65536]);
});

test('04.1 mirror reverses winding without narrowing the index width', () => {
  const row = prepareGlb(u32Sample({ mirrored: true }).bytes)[0];
  assert.ok(row.geometry.indices instanceof Uint32Array); assert.deepEqual([...row.geometry.indices],[0,65536,65535]);
  assert.equal(row.transform[0],-1);
});

test('04.1 preserves UINT source width even when all indices fit in 16 bits', async () => {
  const f = triangleFixture(), bin = new Uint8Array(84); bin.set(f.bin.slice(0,72));
  const data = new DataView(bin.buffer); [0,1,2].forEach((n,i) => data.setUint32(72+i*4,n,true));
  f.json.buffers[0].byteLength = bin.length; f.json.bufferViews[2].byteLength = 12; f.json.accessors[2].componentType = 5125;
  const input = packU32Glb(f.json,bin), row = prepareGlb(input)[0];
  assert.ok(row.geometry.indices instanceof Uint32Array); assert.deepEqual([...row.geometry.indices],[0,1,2]);
  const viewer = { ready: true, computeDevice: { limits: { maxTextureDimension2D: 4096 } } };
  const group = await materializeGlbTextures(viewer,prepareTexturedGlb(input));
  assert.ok(group.primitives[0].geometry.indices instanceof Uint32Array); assert.deepEqual([...group.primitives[0].geometry.indices],[0,1,2]); group.dispose();
});

test('04.1 rejects UINT restart, out-of-range, alignment and truncated index data', () => {
  const edits = [
    f => { new DataView(f.bin.buffer).setUint32(f.indexOffset+8,0xffffffff,true); },
    f => { new DataView(f.bin.buffer).setUint32(f.indexOffset+8,65537,true); },
    f => { f.json.bufferViews[2].byteOffset += 2; },
    f => { f.json.accessors[2].byteOffset = 2; },
    f => { f.json.bufferViews[2].byteLength = 11; },
    f => { f.json.accessors[2].count = 4; },
    f => { f.json.accessors[2].componentType = 5121; },
  ];
  for (const edit of edits) { const f = u32Sample(); edit(f); assert.throws(() => prepareGlb(packU32Glb(f.json,f.bin)),invalid); }
});

test('04.1 textured preparation keeps u32 width and its texture association', () => {
  const prepared = prepareTexturedGlb(u32Sample({ imageBytes: imageHeader, mirrored: true }).bytes), row = prepared.primitives[0];
  assert.ok(row.geometry.indices instanceof Uint32Array); assert.deepEqual([...row.geometry.indices],[0,65536,65535]);
  assert.equal(row.baseColorTexture,0); assert.equal(prepared.textures.length,1); assert.equal(row.geometry.uvs.length,65537*2);
});

test('04.1 materialize copies UINT indices and rejects invalid mutated UINT inputs', async () => {
  const viewer = { ready: true, computeDevice: { limits: { maxTextureDimension2D: 4096 } } };
  const prepared = prepareTexturedGlb(u32Sample({ mirrored: true }).bytes);
  const group = await materializeGlbTextures(viewer,prepared), indices = group.primitives[0].geometry.indices;
  assert.ok(indices instanceof Uint32Array); assert.deepEqual([...indices],[0,65536,65535]);
  prepared.primitives[0].geometry.indices.fill(0); assert.deepEqual([...indices],[0,65536,65535]); group.dispose(); group.dispose();
  for (const mutation of [p => { p.geometry.indices[2] = 65537; }, p => { p.geometry.indices[2] = 0xffffffff; }, p => { p.geometry.indices = [0,65535,65536]; }]) {
    const bad = prepareTexturedGlb(u32Sample().bytes); mutation(bad.primitives[0]);
    await assert.rejects(materializeGlbTextures(viewer,bad),textureInvalid);
  }
});
