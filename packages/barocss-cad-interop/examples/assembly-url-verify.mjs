import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCadAssembly, queryCadAssemblyInstancePoint, serializeCadAssembly,
  validateCadAssemblyResult } from '@barocss/cad';
import { loadBaroCadAssembly, parseBaroCadAssembly } from '@barocss/cad-interop/assembly';
import { createBaroCadAssemblyThreeDisplay } from '@barocss/cad-interop/three-assembly';

const bytes = readFileSync(new URL('./assembly-three-data/revision0.cad-assembly.json', import.meta.url));
const sha256 = createHash('sha256').update(bytes).digest('hex');
assert.equal(bytes.length, 4207);
assert.equal(sha256, '4657ece41355db1870447efa0120f30c497ffa1b5b38dbe94de765d53176819b');

const server = createServer(async (request, response) => {
  if (request.url === '/missing') { response.writeHead(404).end(); return; }
  if (request.url === '/oversize-header') {
    response.writeHead(200, { 'content-length': 2097153 }).end(); return;
  }
  if (request.url === '/oversize-body') {
    response.writeHead(200, { 'content-type': 'application/json', 'transfer-encoding': 'chunked' });
    response.end(Buffer.alloc(2097153, 0x20)); return;
  }
  if (request.url === '/invalid-utf8') { response.writeHead(200).end(Buffer.from([0xff])); return; }
  if (request.url === '/duplicate-key') {
    response.writeHead(200).end('{"schema":"barocss-cad-assembly","schema":"barocss-cad-assembly"}'); return;
  }
  if (request.url === '/unsupported') {
    const candidate = JSON.parse(bytes.toString('utf8'));
    candidate.version = 1;
    response.writeHead(200).end(JSON.stringify(candidate)); return;
  }
  if (request.url !== '/valid' && request.url !== '/slow') {
    response.writeHead(404).end(); return;
  }
  response.writeHead(200, { 'content-type': 'application/json', 'content-length': bytes.length });
  if (request.url === '/slow') {
    response.write(bytes.subarray(0, 100));
    await new Promise(resolve => setTimeout(resolve, 120));
    if (!response.destroyed) response.end(bytes.subarray(100));
    return;
  }
  for (const end of [1400, 2800, bytes.length]) {
    const start = end === 1400 ? 0 : end === 2800 ? 1400 : 2800;
    response.write(bytes.subarray(start, end));
    await new Promise(resolve => setTimeout(resolve, 15));
  }
  response.end();
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
let evidence;
try {
  const progress = [];
  const assembly = await loadBaroCadAssembly(`${base}/valid`, {
    onProgress(event) { progress.push(event); },
  });
  assert.ok(progress.length >= 2);
  assert.equal(progress.at(-1).loadedBytes, bytes.length);
  assert.ok(progress.every((event, index) => event.url === `${base}/valid` &&
    event.declaredTotalBytes === bytes.length && event.loadedBytes > (progress[index - 1]?.loadedBytes ?? 0)));
  assert.deepEqual(validateCadAssemblyResult(assembly), assembly.report);
  assert.deepEqual(assembly, parseBaroCadAssembly(bytes.toString('utf8')));
  assert.deepEqual(assembly, parseCadAssembly(bytes.toString('utf8')));
  const outputDirectory = mkdtempSync(join(tmpdir(), 'barocad-assembly-url-'));
  try {
    const savedPath = join(outputDirectory, 'reopened.cad-assembly.json');
    writeFileSync(savedPath, serializeCadAssembly(assembly.assembly));
    assert.deepEqual(parseBaroCadAssembly(readFileSync(savedPath, 'utf8')), assembly);
  } finally { rmSync(outputDirectory, { recursive: true, force: true }); }
  assert.deepEqual(assembly.instances.map(instance => instance.instanceId),
    ['child', 'surface_grandchild', 'parent', 'shared_root', 'asset_b_instance', 'xyz_order_root']);
  assert.equal(assembly.assembly.parts[0].assets[0].source,
    parseCadAssembly(bytes.toString('utf8')).assembly.parts[0].assets[0].source);
  assert.ok(Object.is(assembly.assembly.instances[0].placement.translationMM[1], -0));
  const child = assembly.instances.find(instance => instance.instanceId === 'child');
  const point = queryCadAssemblyInstancePoint(assembly, {
    assemblyId: assembly.assembly.assemblyId, assemblyRevision: assembly.assembly.revision,
    instanceId: child.instanceId, reference: child.reference,
    query: { kind: 'curve', parameter: 2 },
  });
  assert.deepEqual(point.originalLocalPointMM, [1, 0, 0]);
  assert.deepEqual(point.assemblyPointMM, [10, 4, 0]);

  const display = createBaroCadAssemblyThreeDisplay(assembly, {
    native: { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.01,
      curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } },
    basis: 'authored-xyz-matches-rhyup',
  });
  assert.equal(display.bindings.length, 6);
  display.dispose(); display.dispose();

  let refused = 0;
  const refuse = async (action, check = () => true) => {
    await assert.rejects(action, check); refused++;
    assert.deepEqual(validateCadAssemblyResult(assembly), assembly.report);
  };
  const pre = new AbortController(); pre.abort();
  await refuse(() => loadBaroCadAssembly(`${base}/valid`, { signal: pre.signal }),
    error => error.name === 'AbortError' && error.code === 'ABORT_ERR');
  const mid = new AbortController();
  await refuse(() => loadBaroCadAssembly(`${base}/slow`, {
    signal: mid.signal, onProgress() { mid.abort(); },
  }), error => error.name === 'AbortError' && error.code === 'ABORT_ERR');
  await refuse(() => loadBaroCadAssembly(`${base}/valid`, { onProgress() { return false; } }),
    error => error.name === 'AbortError' && error.code === 'ABORT_ERR');
  const callbackError = new Error('callback stopped request');
  await refuse(() => loadBaroCadAssembly(`${base}/valid`, { onProgress() { throw callbackError; } }),
    error => error === callbackError);
  await refuse(() => loadBaroCadAssembly(`${base}/missing`));
  await refuse(() => loadBaroCadAssembly(`${base}/oversize-header`));
  await refuse(() => loadBaroCadAssembly(`${base}/oversize-body`));
  await refuse(() => loadBaroCadAssembly(`${base}/invalid-utf8`));
  await refuse(() => loadBaroCadAssembly(`${base}/duplicate-key`));
  await refuse(() => loadBaroCadAssembly(`${base}/unsupported`));
  await refuse(() => loadBaroCadAssembly('file:///tmp/assembly.json'));
  await refuse(() => loadBaroCadAssembly('relative.json'));
  let getterCalls = 0;
  const getter = {};
  Object.defineProperty(getter, 'onProgress', { enumerable: true, get() { getterCalls++; return () => {}; } });
  await refuse(() => loadBaroCadAssembly(`${base}/valid`, getter));
  assert.equal(getterCalls, 0);
  evidence = { fileBytes: bytes.length, sha256, progress: progress.map(event => event.loadedBytes),
    assemblyId: assembly.assembly.assemblyId, instanceCount: assembly.instances.length,
    nativePointMM: point.assemblyPointMM, threeBindings: 6, refused, getterCalls,
    coldReopened: true, sourceAndSignedPlacementPreserved: true };
} finally {
  server.closeAllConnections();
  server.close();
  await once(server, 'close');
}
console.log(JSON.stringify(evidence));
