import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { baroCadSourceToGLB, parseBaroCadSource } from '../dist/native.js';

const source = readFileSync(new URL('./curve-wide-v1.barocad', import.meta.url), 'utf8');
const base = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001 };
const options = {
  ...base, curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 },
};
const neutral = parseBaroCadSource(source, options);
const jsonNumbers = value => Array.isArray(value) ? value.map(jsonNumbers) : Object.is(value, -0) ? 0 : value;
const glb = baroCadSourceToGLB(source, options, { includeSourceText: true });
const view = new DataView(glb);
assert.equal(view.getUint32(0, true), 0x46546c67);
assert.equal(view.getUint32(4, true), 2);
assert.equal(view.getUint32(8, true), glb.byteLength);
assert.ok(glb.byteLength <= 1024 * 1024);
const jsonLength = view.getUint32(12, true);
const json = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength)));
const binaryOffset = 20 + jsonLength + 8;
assert.equal(view.getUint32(binaryOffset - 4, true), 0x004e4942);
assert.equal(json.asset.extras.barocss.sourceVersion, 0);
assert.equal(json.asset.extras.barocss.curveSampleVersion, 1);
assert.equal(json.asset.extras.barocss.source.text, source);
assert.equal(json.nodes[0].name, 'wide_64');
assert.equal(json.nodes[0].extras.barocss.curveId, 'wide_64');
assert.equal(json.nodes[0].extras.barocss.sampleVersion, 1);
assert.deepEqual(json.nodes[0].extras.barocss.parameters, jsonNumbers(neutral.curves[0].sample.parameters));
assert.deepEqual(json.nodes[0].extras.barocss.intervals,
  jsonNumbers(neutral.curves[0].sample.segments.map(segment => segment.domain)));
const primitive = json.meshes[0].primitives[0];
assert.equal(primitive.mode, 3);
assert.equal(primitive.attributes.NORMAL, undefined);
assert.equal(primitive.attributes.TEXCOORD_0, undefined);
const position = json.accessors[primitive.attributes.POSITION];
const indices = json.accessors[primitive.indices];
assert.equal(position.count, 40);
assert.equal(indices.count, 40);
assert.equal(indices.componentType, 5123);
const positionView = json.bufferViews[position.bufferView];
const indexView = json.bufferViews[indices.bufferView];
for (let index = 0; index < neutral.curves[0].positions.length; index++) {
  assert.ok(Object.is(view.getFloat32(binaryOffset + positionView.byteOffset + index * 4, true),
    neutral.curves[0].positions[index]));
}
for (let index = 0; index < indices.count; index++) {
  assert.equal(view.getUint16(binaryOffset + indexView.byteOffset + index * 2, true), index);
}

const oldSource = readFileSync(new URL('./two-surfaces.barocad', import.meta.url), 'utf8');
const oldGlb = baroCadSourceToGLB(oldSource, {
  ...base, curveDisplay: { chordToleranceMM: 0.1, maxSegments: 128, maxDepth: 16 },
}, { includeSourceText: false });
const oldHash = createHash('sha256').update(Buffer.from(oldGlb)).digest('hex');
assert.equal(oldHash, '61a4cd623dc6080a81c110835356d7b6841d7feac4383d0beb0b17ecbbe90604');

globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init) { this.type = type; Object.assign(this, init); }
};
const server = createServer((request, response) => {
  if (request.url !== '/wide.glb') { response.writeHead(404).end(); return; }
  response.writeHead(200, {
    'content-type': 'model/gltf-binary', 'content-length': glb.byteLength,
  }).end(Buffer.from(glb));
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const loaded = await new GLTFLoader().loadAsync(`http://127.0.0.1:${server.address().port}/wide.glb`);
  const lines = [];
  loaded.scene.traverse(object => { if (object.isLine) lines.push(object); });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].name, 'wide_64');
  assert.equal(lines[0].geometry.getAttribute('position').count, 40);
  assert.equal(lines[0].geometry.index.count, 40);
  assert.equal(lines[0].userData.barocss.sampleVersion, 1);
  assert.deepEqual(lines[0].userData.barocss.parameters, jsonNumbers(neutral.curves[0].sample.parameters));
  assert.equal(loaded.parser.json.asset.extras.barocss.source.text, source);
  const before = Buffer.from(glb);
  assert.throws(() => baroCadSourceToGLB('@model invalid {}', options, { includeSourceText: true }));
  assert.deepEqual(Buffer.from(glb), before);
  assert.equal(lines.length, 1);
} finally {
  server.close();
  await once(server, 'close');
}

console.log(JSON.stringify({
  sourceBytes: Buffer.byteLength(source), glbBytes: glb.byteLength,
  originalCurveId: neutral.model.objects[0].id,
  originalSignedZero: Object.is(neutral.model.objects[0].controlPoints[0][0], -0),
  sampleVersion: 1, linePoints: position.count, lineSegments: position.count - 1,
  importedLines: 1, v0GlbSha256: oldHash, invalidSourceRetainedPriorGlb: true,
}));
