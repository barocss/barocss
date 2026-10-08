import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { baroCadSourceToGLB, parseBaroCadSource } from '../dist/native.js';

const source = readFileSync(new URL('../examples/two-surfaces.barocad', import.meta.url), 'utf8');
const curveOnly = readFileSync(new URL('../examples/curve-only.barocad', import.meta.url), 'utf8');
const base = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001 };
const options = { ...base, curveDisplay: { chordToleranceMM: 0.1, maxSegments: 128, maxDepth: 16 } };

function inspect(bytes) {
  const view = new DataView(bytes);
  assert.equal(view.getUint32(0, true), 0x46546c67);
  assert.equal(view.getUint32(4, true), 2);
  assert.equal(view.getUint32(8, true), bytes.byteLength);
  const jsonLength = view.getUint32(12, true);
  assert.equal(jsonLength % 4, 0);
  assert.equal(view.getUint32(16, true), 0x4e4f534a);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength)));
  const binaryHeader = 20 + jsonLength;
  assert.equal(view.getUint32(binaryHeader, true), json.buffers[0].byteLength);
  assert.equal(view.getUint32(binaryHeader + 4, true), 0x004e4942);
  assert.equal(binaryHeader + 8 + json.buffers[0].byteLength, bytes.byteLength);
  assert.ok(bytes.byteLength <= 1024 * 1024);
  for (const bufferView of json.bufferViews) {
    assert.equal(bufferView.byteOffset % 4, 0);
    assert.ok(bufferView.byteOffset + bufferView.byteLength <= json.buffers[0].byteLength);
  }
  for (const accessor of json.accessors) {
    assert.ok(accessor.bufferView >= 0 && accessor.bufferView < json.bufferViews.length);
    assert.ok(accessor.count > 0);
  }
  return { json, binaryOffset: binaryHeader + 8 };
}

const native = parseBaroCadSource(source, options);
const glb = baroCadSourceToGLB(source, options, { includeSourceText: false });
const { json, binaryOffset } = inspect(glb);
assert.equal(json.asset.extras.barocss.modelName, 'native_loader_demo');
assert.equal(json.asset.extras.barocss.sourceVersion, 0);
assert.equal(json.asset.extras.barocss.displayLengthUnit, 'm');
assert.equal(json.asset.extras.barocss.source, undefined);
assert.deepEqual(json.asset.extras.barocss.objectOrder.map(object => object.id),
  ['rational_panel', 'flat_panel', 'reference_edge']);
assert.deepEqual(json.asset.extras.barocss.unrenderedCurveIds, []);
assert.deepEqual(json.scenes[0].nodes, [0, 1, 2]);
assert.deepEqual(json.nodes.map(node => node.name), ['rational_panel', 'flat_panel', 'reference_edge']);
assert.deepEqual(json.meshes.map(mesh => mesh.primitives[0].mode), [4, 4, 3]);
for (const [index, surface] of native.surfaces.entries()) {
  const primitive = json.meshes[index].primitives[0];
  assert.equal(json.accessors[primitive.indices].count, surface.mesh.indices.length);
  assert.ok(Object.hasOwn(primitive.attributes, '_CAD_UV'));
  assert.ok(!Object.hasOwn(primitive.attributes, 'TEXCOORD_0'));
  assert.equal(json.nodes[index].extras.barocss.parameterMeaning, 'original-native-u-v-not-texture-uv');
}
const firstPosition = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
assert.deepEqual(firstPosition.min, [0, 0, 0]);
assert.deepEqual(firstPosition.max, [Math.fround(0.1), 0, Math.fround(0.04)]);
const curvePrimitive = json.meshes[2].primitives[0];
const curvePosition = json.accessors[curvePrimitive.attributes.POSITION];
const curveIndex = json.accessors[curvePrimitive.indices];
assert.equal(curvePosition.count, native.curves[0].sample.pointsMM.length);
assert.equal(curveIndex.count, curvePosition.count);
assert.equal(curvePrimitive.attributes.NORMAL, undefined);
assert.equal(curvePrimitive.attributes.TEXCOORD_0, undefined);
assert.deepEqual(json.nodes[2].extras.barocss.parameters, native.curves[0].sample.parameters);
assert.deepEqual(json.nodes[2].extras.barocss.intervals,
  native.curves[0].sample.segments.map(segment => segment.domain));
const indexView = json.bufferViews[curveIndex.bufferView];
const indexData = new DataView(glb, binaryOffset + indexView.byteOffset, indexView.byteLength);
for (let index = 0; index < curveIndex.count; index++) assert.equal(indexData.getUint16(index * 2, true), index);

const temp = mkdtempSync(join(tmpdir(), 'barocad-glb-'));
const file = join(temp, 'native.glb');
writeFileSync(file, new Uint8Array(glb));
globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init) { this.type = type; Object.assign(this, init); }
};
const server = createServer((request, response) => {
  if (request.url !== '/native.glb') { response.writeHead(404).end(); return; }
  const fileBytes = readFileSync(file);
  response.writeHead(200, { 'content-type': 'model/gltf-binary', 'content-length': fileBytes.length }).end(fileBytes);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const loaded = await new GLTFLoader().loadAsync(`http://127.0.0.1:${server.address().port}/native.glb`);
  const meshes = [], lines = [];
  loaded.scene.traverse(object => {
    if (object.isMesh) meshes.push(object);
    if (object.isLine) lines.push(object);
  });
  assert.equal(meshes.length, 2);
  assert.equal(lines.length, 1);
  assert.deepEqual(meshes.map(mesh => mesh.name), ['rational_panel', 'flat_panel']);
  assert.equal(lines[0].name, 'reference_edge');
  assert.equal(lines[0].geometry.getAttribute('position').count, curvePosition.count);
  assert.equal(lines[0].geometry.index.count, curveIndex.count);
  assert.equal(lines[0].geometry.getAttribute('normal'), undefined);
  assert.equal(lines[0].geometry.getAttribute('uv'), undefined);
  assert.equal(meshes[0].geometry.getAttribute('position').getX(8), native.surfaces[0].mesh.positions[24]);
  assert.deepEqual(lines[0].userData.barocss.parameters, native.curves[0].sample.parameters);
  assert.equal(loaded.parser.json.asset.extras.barocss.modelName, 'native_loader_demo');

  const stableBytes = Buffer.from(new Uint8Array(glb));
  const stableModel = structuredClone(native.model);
  assert.throws(() => baroCadSourceToGLB(source, { ...options, unitsPerMillimeter: 1 }, { includeSourceText: false }), /0\.001/);
  assert.throws(() => baroCadSourceToGLB(source, options, { includeSourceText: 1 }), /includeSourceText/);
  const getter = {};
  Object.defineProperty(getter, 'includeSourceText', { enumerable: true, get() { throw Error('getter called'); } });
  assert.throws(() => baroCadSourceToGLB(source, options, getter), /includeSourceText/);
  assert.throws(() => baroCadSourceToGLB(source.replace('degree-u: 1', 'degree-u: 9'), options,
    { includeSourceText: false }), /degree|CAD|source/i);
  assert.deepEqual(readFileSync(file), stableBytes);
  assert.deepEqual(native.model, stableModel);
  assert.equal(meshes.length, 2);
} finally {
  server.close();
  await once(server, 'close');
  rmSync(temp, { recursive: true, force: true });
}

const defaultGlb = baroCadSourceToGLB(source, base, { includeSourceText: false });
const defaultJson = inspect(defaultGlb).json;
assert.equal(defaultJson.meshes.length, 2);
assert.deepEqual(defaultJson.asset.extras.barocss.unrenderedCurveIds, ['reference_edge']);
const sourceJson = inspect(baroCadSourceToGLB(source, options, { includeSourceText: true })).json;
assert.deepEqual(sourceJson.asset.extras.barocss.source,
  { format: 'barocad-source0', role: 'untrusted-native-reference', text: source });
assert.ok(sourceJson.asset.extras.barocss.source.text.includes('[-0,0,0]'));
assert.throws(() => baroCadSourceToGLB(curveOnly, base, { includeSourceText: false }), /native surfaces/);
const onlyGlb = baroCadSourceToGLB(curveOnly, options, { includeSourceText: false });
assert.deepEqual(inspect(onlyGlb).json.meshes.map(mesh => mesh.primitives[0].mode), [3]);
const onlyLoaded = await new GLTFLoader().parseAsync(onlyGlb, '');
assert.equal(onlyLoaded.scene.children.length, 1);
assert.equal(onlyLoaded.scene.children[0].isLine, true);
console.log(JSON.stringify({ result: 'native-glb-ok', bytes: glb.byteLength, surfaces: 2,
  curves: 1, curvePoints: curvePosition.count }));
