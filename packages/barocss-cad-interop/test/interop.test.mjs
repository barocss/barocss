import test from 'node:test';
import assert from 'node:assert/strict';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { copyCadPreviewPacket, encodeCadPreviewGlb, prepareCadPreviewMesh } from '../dist/index.js';

function square(surfaceId = 'plate', height = 0) {
  return {
    version: 0, surfaceId, revision: 7, lengthUnit: 'mm',
    coordinateSystem: 'right-handed-y-up', winding: 'ccw',
    positions: [0, 0, height, 1000, 0, height, 0, 1000, height, 1000, 1000, height],
    normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    indices: [0, 1, 2, 1, 3, 2],
    parameters: [2, 3, 7, 3, 2, 9, 7, 9],
    bounds: { min: [0, 0, height], max: [1000, 1000, height] },
  };
}

function parseGlb(bytes) {
  const view = new DataView(bytes);
  assert.equal(view.getUint32(0, true), 0x46546c67);
  assert.equal(view.getUint32(4, true), 2);
  assert.equal(view.getUint32(8, true), bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  assert.equal(jsonLength % 4, 0);
  assert.equal(view.getUint32(16, true), 0x4e4f534a);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength)));
  const binaryStart = 20 + jsonLength;
  assert.equal(view.getUint32(binaryStart + 4, true), 0x004e4942);
  assert.equal(view.getUint32(binaryStart, true), json.buffers[0].byteLength);
  assert.equal(binaryStart + 8 + json.buffers[0].byteLength, bytes.byteLength);
  return { json, binaryStart: binaryStart + 8 };
}

test('owned renderer buffers keep XYZ and CAD parameters with an explicit scale', () => {
  const packet = square();
  const copy = copyCadPreviewPacket(packet);
  packet.positions[0] = 999;
  assert.equal(copy.positions[0], 0);
  const mesh = prepareCadPreviewMesh(copy, 0.001);
  assert.deepEqual(Array.from(mesh.positions), [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0]);
  assert.deepEqual(Array.from(mesh.parameters), [2, 3, 7, 3, 2, 9, 7, 9]);
  assert.deepEqual(Array.from(mesh.indices), [0, 1, 2, 1, 3, 2]);
});

test('GLB stores metres, exact Float32 bounds, CAD provenance, and two surfaces', () => {
  const bytes = encodeCadPreviewGlb([square(), square('upper', 500)]);
  const { json, binaryStart } = parseGlb(bytes);
  assert.equal(json.asset.version, '2.0');
  assert.equal(json.scenes[0].nodes.length, 2);
  assert.equal(json.meshes.length, 2);
  assert.equal(json.materials[0].doubleSided, true);
  assert.deepEqual(json.accessors[0].min, [0, 0, 0]);
  assert.deepEqual(json.accessors[0].max, [1, 1, 0]);
  assert.deepEqual(json.accessors[4].min, [0, 0, 0.5]);
  assert.equal(json.nodes[1].extras.barocss.surfaceId, 'upper');
  assert.equal(json.nodes[1].extras.barocss.sourceLengthUnit, 'mm');
  const primitive = json.meshes[0].primitives[0];
  assert.equal(primitive.mode, 4);
  assert.equal(json.accessors[primitive.attributes._CAD_UV].type, 'VEC2');
  const positionView = json.bufferViews[json.accessors[primitive.attributes.POSITION].bufferView];
  const view = new DataView(bytes, binaryStart + positionView.byteOffset, positionView.byteLength);
  assert.equal(view.getFloat32(3 * 4, true), 1);
  for (const bufferView of json.bufferViews) assert.equal(bufferView.byteOffset % 4, 0);
});

test('Three.js GLTFLoader parses the generated GLB as two renderable meshes', async () => {
  const gltf = await new GLTFLoader().parseAsync(encodeCadPreviewGlb([square(), square('upper', 500)]), '');
  const loaded = [];
  gltf.scene.traverse(object => { if (object.isMesh) loaded.push(object); });
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].geometry.getAttribute('position').getX(1), 1);
  assert.equal(loaded[1].geometry.getAttribute('position').getZ(0), 0.5);
  assert.equal(loaded[0].geometry.index.count, 6);
  assert.equal(loaded[0].material.side, 2); // DoubleSide
});

test('rejects invalid packet data and Float32 collapse', () => {
  const inverted = square();
  inverted.indices = [0, 2, 1, 1, 3, 2];
  assert.throws(() => encodeCadPreviewGlb(inverted), /winding/);
  const wrongBounds = square();
  wrongBounds.bounds.max[0] = 999;
  assert.throws(() => encodeCadPreviewGlb(wrongBounds), /bounds/);
  const accessor = square();
  Object.defineProperty(accessor, 'positions', { get: () => { throw new Error('getter called'); }, enumerable: true });
  assert.throws(() => encodeCadPreviewGlb(accessor), /must be data/);
  const tiny = square();
  tiny.positions = [0, 0, 0, 1e-44, 0, 0, 0, 1e-44, 0, 1e-44, 1e-44, 0];
  tiny.bounds.max = [1e-44, 1e-44, 0];
  assert.throws(() => prepareCadPreviewMesh(tiny, 0.001), /collapses/);
  assert.throws(() => encodeCadPreviewGlb([square(), square()]), /unique/);
});
