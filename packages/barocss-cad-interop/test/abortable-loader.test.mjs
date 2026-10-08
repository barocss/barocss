import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { BaroCADLoader } from '../dist/three.js';
import { BaroCADBabylonLoader } from '../dist/babylon.js';

const source = readFileSync(new URL('../examples/curve-display.barocad', import.meta.url), 'utf8');
const bytes = Buffer.from(source, 'utf8');
const options = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { chordToleranceMM: 0.1, maxSegments: 128, maxDepth: 16 } };
let requests = 0;
const server = createServer((request, response) => {
  requests++;
  if (request.url === '/asset') {
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': bytes.length }).end(bytes);
  } else if (request.url === '/slow') {
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': bytes.length });
    response.write(bytes.subarray(0, 48));
    setTimeout(() => { if (!response.destroyed) response.end(bytes.subarray(48)); }, 100);
  } else if (request.url === '/oversize') {
    response.writeHead(200, { 'content-type': 'text/plain' }).end(Buffer.alloc(262145, 65));
  } else if (request.url === '/invalid') {
    response.writeHead(200, { 'content-type': 'text/plain' }).end('@model invalid { version: 0; }');
  } else if (request.url === '/utf8') {
    response.writeHead(200, { 'content-type': 'text/plain' }).end(Buffer.from([0xff]));
  } else if (request.url === '/empty') {
    response.writeHead(204).end();
  } else {
    response.writeHead(404).end();
  }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const three = new BaroCADLoader(options);
const engine = new NullEngine();
const scene = new Scene(engine);
scene.useRightHandedSystem = true;
const caller = new Mesh('caller', scene);
const babylon = new BaroCADBabylonLoader(scene, options);
const aborted = error => error?.name === 'AbortError' && error?.code === 'ABORT_ERR';

try {
  for (const loader of [three, babylon]) {
    const progress = [];
    const result = await loader.loadAbortable(`${base}/asset`, { onProgress: event => progress.push(event) });
    assert.equal(result.source, source);
    assert.deepEqual(result.model.objects.map(object => object.id), ['weighted_quarter', 'asymmetric_nonunit', 'base_panel']);
    assert.equal(result.curves.length, 2);
    assert.equal(result.surfaces.length, 1);
    assert.ok(progress.length > 0);
    assert.equal(progress.at(-1).url, `${base}/asset`);
    assert.equal(progress.at(-1).loadedBytes, bytes.length);
    assert.equal(progress.at(-1).declaredTotalBytes, bytes.length);
    result.dispose();
  }
  const pre = new AbortController();
  pre.abort();
  const beforePreAbort = requests;
  await assert.rejects(three.loadAbortable(`${base}/asset`, { signal: pre.signal }), aborted);
  assert.equal(requests, beforePreAbort);

  for (const loader of [three, babylon]) {
    const controller = new AbortController();
    const beforeMeshes = scene.meshes.length;
    await assert.rejects(loader.loadAbortable(`${base}/slow`, {
      signal: controller.signal, onProgress: () => controller.abort(),
    }), aborted);
    assert.equal(scene.meshes.length, beforeMeshes);
    await assert.rejects(loader.loadAbortable(`${base}/asset`, { onProgress: () => false }), aborted);
    const callbackError = new Error('host progress failed');
    await assert.rejects(loader.loadAbortable(`${base}/asset`, { onProgress: () => { throw callbackError; } }), error => error === callbackError);
  }

  let createdThree;
  const threeController = new AbortController();
  const originalThreeParse = three.parse;
  three.parse = function (text) { createdThree = originalThreeParse.call(this, text); threeController.abort(); return createdThree; };
  try {
    await assert.rejects(three.loadAbortable(`${base}/asset`, { signal: threeController.signal }), aborted);
    assert.equal(createdThree.group.children.length, 0);
  } finally { three.parse = originalThreeParse; }

  let createdBabylon;
  const babylonController = new AbortController();
  const originalBabylonParse = babylon.parse;
  const beforePostParse = scene.meshes.length;
  babylon.parse = function (text) { createdBabylon = originalBabylonParse.call(this, text); babylonController.abort(); return createdBabylon; };
  try {
    await assert.rejects(babylon.loadAbortable(`${base}/asset`, { signal: babylonController.signal }), aborted);
    assert.equal(scene.meshes.length, beforePostParse);
    assert.ok(createdBabylon.meshes.every(mesh => mesh.isDisposed()));
  } finally { babylon.parse = originalBabylonParse; }

  const stable = await babylon.loadAbortable(`${base}/asset`, {});
  const concurrentAbort = new AbortController();
  const slow = babylon.loadAbortable(`${base}/slow`, { signal: concurrentAbort.signal, onProgress: () => concurrentAbort.abort() });
  const fast = babylon.loadAbortable(`${base}/asset`, {});
  await assert.rejects(slow, aborted);
  const concurrentResult = await fast;
  assert.equal(concurrentResult.source, source);
  assert.ok(stable.meshes.every(mesh => !mesh.isDisposed()));
  assert.ok(concurrentResult.meshes.every(mesh => !mesh.isDisposed()));
  concurrentResult.dispose();
  stable.dispose();

  const meshCount = scene.meshes.length;
  await assert.rejects(babylon.loadAbortable(`${base}/invalid`, {}), /Invalid|CAD|source|model/i);
  await assert.rejects(babylon.loadAbortable(`${base}/oversize`, {}), /262144 bytes/);
  await assert.rejects(babylon.loadAbortable(`${base}/utf8`, {}), /encoded data|UTF-8|valid/i);
  await assert.rejects(babylon.loadAbortable(`${base}/empty`, {}), /readable response body/);
  await assert.rejects(babylon.loadAbortable(`${base}/missing`, {}), /HTTP 404/);
  assert.equal(scene.meshes.length, meshCount);
  assert.ok(!caller.isDisposed());

  await assert.rejects(three.loadAbortable(`${base}/asset`, { unexpected: true }), /signal and onProgress only/);
  await assert.rejects(three.loadAbortable(`${base}/asset`, { signal: {} }), /AbortSignal/);
  await assert.rejects(three.loadAbortable(`${base}/asset`, { onProgress: 3 }), /onProgress/);
  const getter = {};
  Object.defineProperty(getter, 'signal', { enumerable: true, get() { throw new Error('must not call getter'); } });
  await assert.rejects(three.loadAbortable(`${base}/asset`, getter), /must be data/);
  assert.ok(!caller.isDisposed());

  console.log(JSON.stringify({ result: 'abortable-load-ok', bytes: bytes.length, requests, targets: ['three', 'babylon'], preservedCallerMesh: !caller.isDisposed() }));
} finally {
  scene.dispose();
  engine.dispose();
  server.close();
  await once(server, 'close');
}
