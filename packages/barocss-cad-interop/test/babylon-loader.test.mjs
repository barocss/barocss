import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { Scene } from '@babylonjs/core/scene.js';
import { parseBaroCadSource } from '../dist/native.js';
import { BaroCADBabylonLoader } from '../dist/babylon.js';

const source = readFileSync(new URL('../examples/two-surfaces.barocad', import.meta.url), 'utf8');
const options = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001 };
const native = parseBaroCadSource(source, options);
const engine = new NullEngine();
const scene = new Scene(engine);
scene.useRightHandedSystem = true;
const callerMesh = new Mesh('caller-owned', scene);
const loader = new BaroCADBabylonLoader(scene, options);

const parsed = loader.parse(source);
assert.equal(parsed.source, source);
assert.deepEqual(parsed.model, native.model);
assert.deepEqual(parsed.unrenderedCurveIds, ['reference_edge']);
assert.equal(parsed.meshes.length, 2);
assert.ok(Object.is(parsed.model.objects[0].controlPoints[0][0][0], -0));
assert.equal(parsed.model.objects[0].weights[0][1], 0.7071067811865476);
assert.equal(scene.useRightHandedSystem, true);
assert.equal(scene.meshes.length, 3);
assert.equal(scene.materials.length, 1);
for (const [index, mesh] of parsed.meshes.entries()) {
  const preview = native.surfaces[index];
  assert.ok(mesh instanceof Mesh);
  assert.equal(mesh.metadata.barocss.modelName, 'native_loader_demo');
  assert.equal(mesh.metadata.barocss.surfaceId, preview.surfaceId);
  assert.equal(mesh.metadata.barocss.coordinateSystem, 'right-handed-z-up');
  assert.equal(mesh.metadata.barocss.lengthUnit, 'mm');
  assert.notEqual(mesh.metadata.barocss.nativeParameters, preview.mesh.parameters);
  assert.deepEqual(Array.from(mesh.metadata.barocss.nativeParameters), Array.from(preview.mesh.parameters));
  assert.deepEqual(Array.from(mesh.getVerticesData(VertexBuffer.PositionKind)), Array.from(preview.mesh.positions));
  assert.deepEqual(Array.from(mesh.getVerticesData(VertexBuffer.NormalKind)), Array.from(preview.mesh.normals));
  assert.deepEqual(Array.from(mesh.getIndices()), Array.from(preview.mesh.indices));
  assert.equal(mesh.getTotalVertices(), 64);
  assert.equal(mesh.material.backFaceCulling, false);
}
assert.deepEqual(Array.from(parsed.meshes[0].metadata.barocss.nativeParameters.slice(0, 2)), [2, 10]);
assert.ok(Math.abs(parsed.meshes[0].getBoundingInfo().boundingBox.maximum.x - 0.1) < 1e-6);

const server = createServer((request, response) => {
  if (request.url === '/two-surfaces.barocad') {
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end(source);
  } else response.writeHead(404).end();
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  const loaded = await loader.loadAsync(`${base}/two-surfaces.barocad`);
  assert.equal(loaded.source, source);
  assert.deepEqual(loaded.model, native.model);
  assert.deepEqual(loaded.meshes.map(mesh => mesh.metadata.barocss.surfaceId), ['rational_panel', 'flat_panel']);
  loaded.dispose();
  loaded.dispose();
  assert.equal(scene.meshes.length, 3);
  await assert.rejects(loader.loadAsync(`${base}/missing.barocad`), /HTTP 404/);
  assert.equal(scene.meshes.length, 3);
} finally {
  server.close();
  await once(server, 'close');
}

assert.throws(() => loader.parse(source.replace('degree-u: 1;', 'degree-u: 9;')), /degree|DIMENSION|KNOT|CONTROL/i);
assert.throws(() => new BaroCADBabylonLoader(scene, { ...options, sourceVersion: 1 }).parse(source), /sourceVersion 0/);
assert.throws(() => new BaroCADBabylonLoader(scene, { ...options, countU: 18 }).parse(source), /2\.\.17/);
assert.throws(() => new BaroCADBabylonLoader(scene, { ...options, unitsPerMillimeter: 1e-50 }).parse(source), /Float32|collapses/);
assert.equal(scene.meshes.length, 3);

scene.useRightHandedSystem = false;
assert.throws(() => loader.parse(source), /useRightHandedSystem/);
assert.equal(scene.meshes.length, 3);
scene.useRightHandedSystem = true;
parsed.dispose();
parsed.dispose();
assert.equal(scene.meshes.length, 1);
assert.equal(scene.meshes[0], callerMesh);
assert.equal(scene.materials.length, 0);
assert.equal(scene.isDisposed, false);
scene.dispose();
engine.dispose();
console.log('BaroCAD source → native model → Babylon NullEngine meshes and local URL load: OK');
