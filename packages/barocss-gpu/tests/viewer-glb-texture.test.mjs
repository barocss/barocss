// Focused CPU tests for the 03.2 textured-GLB parser; no browser or GPU resources.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareGlb, prepareTexturedGlb } from '../dist/viewer/index.js';
import { glb, triangleFixture } from './viewer-glb-fixture.mjs';

const invalid = error => error?.code === 'GEOMETRY_INVALID';
const pngHeader = Uint8Array.from([137,80,78,71,13,10,26,10, 0,0,0,13,73,72,68,82, 0,0,0,32,0,0,0,32, 8,6,0,0,0, 0,0,0,0]);
function fixture() {
  const { json, bin: base } = triangleFixture(), imageOffset = 104, bin = new Uint8Array(imageOffset + pngHeader.length);
  bin.set(base); const view = new DataView(bin.buffer);
  [0,1, 1,1, 0,0].forEach((v,i) => view.setFloat32(80+i*4,v,true)); bin.set(pngHeader,imageOffset);
  json.buffers[0].byteLength = bin.length;
  json.bufferViews.push({ buffer: 0, byteOffset: 80, byteLength: 24 }, { buffer: 0, byteOffset: imageOffset, byteLength: pngHeader.length });
  json.accessors.push({ bufferView: 3, componentType: 5126, count: 3, type: 'VEC2' });
  json.meshes[0].primitives[0].attributes.TEXCOORD_0 = 3;
  json.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 };
  json.images = [{ bufferView: 4, mimeType: 'image/png' }]; json.textures = [{ source: 0, sampler: 0 }];
  json.samplers = [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }];
  return { json, bin };
}
const make = f => glb(f.json,f.bin);

test('03.2 prepares embedded PNG metadata and top-left FLOAT UVs without retaining input bytes', () => {
  const f = fixture(), bytes = make(f), prepared = prepareTexturedGlb(bytes);
  assert.equal(prepared.primitives.length,1); assert.equal(prepared.textures.length,1);
  assert.equal(prepared.primitives[0].baseColorTexture,0);
  assert.deepEqual([...prepared.primitives[0].geometry.uvs],[0,1,1,1,0,0]);
  assert.equal(prepared.textures[0].mimeType,'image/png');
  assert.deepEqual([...prepared.textures[0].bytes],[...pngHeader]);
  assert.deepEqual(prepared.textures[0].options,{ srgb: true, mipmaps: false, wrap: 'clamp', filter: 'nearest' });
  assert.throws(() => prepareGlb(bytes),invalid);
  bytes.fill(0); assert.deepEqual([...prepared.textures[0].bytes],[...pngHeader]);
});

test('03.2 accepts represented nearest and linear sampling with matching U/V wraps', () => {
  for (const [min,mag,mipmaps,filter,wrapCode,wrap] of [[9728,9728,false,'nearest',33071,'clamp'],[9729,9729,false,'linear',10497,'repeat'],[9984,9728,true,'nearest',10497,'repeat'],[9987,9729,true,'linear',33071,'clamp']]) {
    const f = fixture(); Object.assign(f.json.samplers[0],{ minFilter: min, magFilter: mag, wrapS: wrapCode, wrapT: wrapCode });
    assert.deepEqual(prepareTexturedGlb(make(f)).textures[0].options,{ srgb: true, mipmaps, wrap, filter });
  }
});

test('03.2 rejects sampler combinations the viewer cannot represent', () => {
  const edits = [s => { s.wrapS = 10497; }, s => { s.wrapS = s.wrapT = 33648; }, s => { s.magFilter = 9729; }, s => { s.minFilter = 9985; }, s => { s.minFilter = 9986; }];
  for (const edit of edits) { const f = fixture(); edit(f.json.samplers[0]); assert.throws(() => prepareTexturedGlb(make(f)),invalid); }
});

test('03.2 rejects unsupported UV, texture references and invalid image bounds', () => {
  const edits = [
    f => { delete f.json.meshes[0].primitives[0].attributes.TEXCOORD_0; },
    f => { f.json.accessors[3].type = 'VEC3'; }, f => { f.json.accessors[3].componentType = 5123; },
    f => { f.json.accessors[3].count = 2; }, f => { f.json.materials[0].pbrMetallicRoughness.baseColorTexture.texCoord = 1; },
    f => { f.json.materials[0].pbrMetallicRoughness.baseColorTexture.index = 1; },
    f => { f.json.images[0].uri = 'external.png'; delete f.json.images[0].bufferView; },
    f => { f.json.images[0].mimeType = 'image/webp'; }, f => { f.json.bufferViews[4].byteLength += 1; },
    f => { f.bin[104] = 0; }, f => { new DataView(f.bin.buffer).setUint32(104+16,4097); }
  ];
  for (const edit of edits) { const f = fixture(); edit(f); assert.throws(() => prepareTexturedGlb(make(f)),invalid); }
});

test('03.2 shares one texture index across primitives and keeps OPAQUE material alpha', () => {
  const f = fixture(); f.json.materials[0].pbrMetallicRoughness.baseColorFactor[3] = 0.25;
  f.json.meshes[0].primitives.push(structuredClone(f.json.meshes[0].primitives[0]));
  const prepared = prepareTexturedGlb(make(f));
  assert.equal(prepared.textures.length,1); assert.equal(prepared.primitives.length,2);
  assert.deepEqual(prepared.primitives.map(p => p.baseColorTexture),[0,0]);
  assert.deepEqual(prepared.primitives.map(p => p.material.opacity),[1,1]);
});
