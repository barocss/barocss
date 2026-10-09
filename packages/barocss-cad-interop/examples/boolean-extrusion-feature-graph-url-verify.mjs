import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { BooleanExtrusionFeatureGraphError } from '@barocss/cad';
import {
  loadBaroCadBooleanExtrusionFeatureGraph,
  readBaroCadBooleanExtrusionFeatureGraph,
} from '@barocss/cad-interop/boolean-extrusion-feature-graph';

const sourceFlag = process.argv.indexOf('--source');
assert(sourceFlag >= 0 && sourceFlag + 1 < process.argv.length, 'pass --source <saved #903 demo-output directory>');
const directory = resolve(process.argv[sourceFlag + 1]);
const options = { maximumParameterResolutions: 8, maximumFeatureEvaluations: 4 };
const cases = [
  ['cross_union', 'dc1141e3552d1c28c0595282ffcc5efb3751272909fe1373b5e97c0fd170d1b3', 3047, 24, 1],
  ['containment_hole', '24c437a19d98f2e87fc4a69d488b17268c2e1aa93e2c7b0a6c3a18e45f2d72d2', 3065, 32, 1],
  ['strip_two_components', '66ecbd5c78313db03f1af6e5aa797d811fdfe1ae76921f1919d65fbeefc58f30', 3097, 18, 2],
  ['reverse_containment_empty', 'f62f23911362d3cc5a9dbbef5381f16f382894fb155d81407373bcffccdcc87a', 3074, 0, 0],
  ['union_height_edit', 'f85e228241b2d149219c65f81a7dc542692a020b366372c29b879c8a21354ec9', 3047, 24, 1],
  ['operation_intersection_edit', '3685288fe02c4f0ba9d276d15cfa6de83cfc23d6d737db491fadd987abc9fc2b', 3054, 4, 1],
  ['authored_corner_edit', 'a54eed6ec2dc22f9b08ba982491204d47b7d8996ef01c963a87ef894cc8a7eac', 3046, 4.75, 1],
];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const files = new Map(cases.map(([name, hash, size]) => {
  const bytes = readFileSync(resolve(directory, `${name}.authored-graph.json`));
  assert.equal(bytes.length, size, `${name}: original file byte length`);
  assert.equal(sha256(bytes), hash, `${name}: original SHA-256`);
  return [name, bytes];
}));
const initialHashes = new Map([...files].map(([name, bytes]) => [name, sha256(bytes)]));
let requestCount = 0;
const server = createServer(async (request, response) => {
  requestCount++;
  const name = request.url?.slice('/valid/'.length);
  if (request.url?.startsWith('/valid/') && files.has(name)) {
    const bytes = files.get(name);
    response.writeHead(200, { 'content-type': 'application/json', 'content-length': bytes.length });
    for (const [start, end] of [[0, 1000], [1000, 2000], [2000, bytes.length]]) {
      response.write(bytes.subarray(start, end));
      await new Promise(done => setTimeout(done, 15));
    }
    response.end(); return;
  }
  if (request.url === '/slow') {
    const bytes = files.get('cross_union');
    response.writeHead(200, { 'content-type': 'application/json', 'content-length': bytes.length });
    response.write(bytes.subarray(0, 50));
    await new Promise(done => setTimeout(done, 120));
    if (!response.destroyed) response.end(bytes.subarray(50));
    return;
  }
  if (request.url === '/oversize-header') {
    response.writeHead(200, { 'content-length': 1048577 }).end(); return;
  }
  if (request.url === '/oversize-body') {
    response.writeHead(200, { 'content-type': 'application/json', 'transfer-encoding': 'chunked' });
    response.end(Buffer.alloc(1048577, 0x20)); return;
  }
  if (request.url === '/invalid-utf8') { response.writeHead(200).end(Buffer.from([0xff])); return; }
  if (request.url === '/duplicate-key') {
    response.writeHead(200).end('{"format":0,"format":1}'); return;
  }
  if (request.url === '/future-version') {
    const candidate = JSON.parse(files.get('cross_union').toString('utf8'));
    candidate.version = 1;
    response.writeHead(200).end(JSON.stringify(candidate)); return;
  }
  response.writeHead(404).end();
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
let evidence;
try {
  const reads = new Map();
  let progressEvents = 0;
  for (const [name, , size, area, shells] of cases) {
    const url = `${base}/valid/${name}`;
    const progress = [];
    const read = await loadBaroCadBooleanExtrusionFeatureGraph(url, options, {
      onProgress(event) { assert(Object.isFrozen(event)); progress.push(event); },
    });
    const direct = readBaroCadBooleanExtrusionFeatureGraph(files.get(name).toString('utf8'), options);
    assert.deepEqual(read, direct, `${name}: HTTP read matches direct native reader`);
    assert.deepEqual(Buffer.from(read.authoredText, 'utf8'), files.get(name));
    assert(progress.length >= 2, `${name}: streamed progress`);
    assert.equal(progress.at(-1).loadedBytes, size);
    assert(progress.every((event, index) => event.url === url && event.declaredTotalBytes === size &&
      event.loadedBytes > (progress[index - 1]?.loadedBytes ?? 0)));
    assert.equal(read.native.report.nativeBuilderCallCount, 4);
    assert.equal(read.native.report.summary.materialAreaUV, area);
    assert.equal(read.native.report.summary.componentCount, shells);
    assert.equal(read.native.features.length, 4);
    assert.equal(read.native.report.qualifiedBindings.length, 4);
    assert.equal(read.native.features[3].evaluation.shells.length, shells);
    progressEvents += progress.length;
    reads.set(name, read);
  }
  const accepted = reads.get('cross_union');
  const prior = structuredClone(accepted.native);
  const independent = await loadBaroCadBooleanExtrusionFeatureGraph(`${base}/valid/cross_union`, options);
  independent.native.document.parameters.find(parameter => parameter.id === 'base_height').definition.valueMM = 9;
  assert.deepEqual(accepted.native, prior, 'separate HTTP reads have separate native results');
  let refused = 0;
  const refuse = async (name, action, check = () => true) => {
    await assert.rejects(action, check, name);
    refused++;
    assert.deepEqual(accepted.native, prior, `${name}: prior accepted graph`);
    for (const [fixture, bytes] of files) assert.equal(sha256(bytes), initialHashes.get(fixture));
  };
  const pre = new AbortController(); pre.abort();
  const beforePre = requestCount;
  await refuse('pre-abort', () => loadBaroCadBooleanExtrusionFeatureGraph(`${base}/valid/cross_union`, options,
    { signal: pre.signal }), error => error.name === 'AbortError' && error.code === 'ABORT_ERR');
  assert.equal(requestCount, beforePre, 'pre-abort does not fetch');
  const mid = new AbortController();
  await refuse('mid-body signal abort', () => loadBaroCadBooleanExtrusionFeatureGraph(`${base}/slow`, options,
    { signal: mid.signal, onProgress() { mid.abort(); } }),
  error => error.name === 'AbortError' && error.code === 'ABORT_ERR');
  await refuse('progress false', () => loadBaroCadBooleanExtrusionFeatureGraph(`${base}/valid/cross_union`, options,
    { onProgress() { return false; } }), error => error.name === 'AbortError' && error.code === 'ABORT_ERR');
  const callbackError = new Error('callback stopped graph request');
  await refuse('callback throw', () => loadBaroCadBooleanExtrusionFeatureGraph(`${base}/valid/cross_union`, options,
    { onProgress() { throw callbackError; } }), error => error === callbackError);
  await refuse('HTTP 404', () => loadBaroCadBooleanExtrusionFeatureGraph(`${base}/missing`, options));
  await refuse('oversize Content-Length', () => loadBaroCadBooleanExtrusionFeatureGraph(`${base}/oversize-header`, options));
  await refuse('oversize actual body', () => loadBaroCadBooleanExtrusionFeatureGraph(`${base}/oversize-body`, options));
  await refuse('invalid UTF-8', () => loadBaroCadBooleanExtrusionFeatureGraph(`${base}/invalid-utf8`, options));
  await refuse('duplicate JSON key', () => loadBaroCadBooleanExtrusionFeatureGraph(`${base}/duplicate-key`, options),
    error => error instanceof BooleanExtrusionFeatureGraphError && error.code === 'JSON');
  await refuse('future format version', () => loadBaroCadBooleanExtrusionFeatureGraph(`${base}/future-version`, options),
    error => error instanceof BooleanExtrusionFeatureGraphError && error.code === 'INPUT');
  await refuse('file URL', () => loadBaroCadBooleanExtrusionFeatureGraph('file:///tmp/graph.json', options));
  await refuse('relative URL', () => loadBaroCadBooleanExtrusionFeatureGraph('relative.json', options));
  let getterCalls = 0;
  const getter = {};
  Object.defineProperty(getter, 'onProgress', { enumerable: true, get() { getterCalls++; return () => {}; } });
  await refuse('transport getter', () => loadBaroCadBooleanExtrusionFeatureGraph(`${base}/valid/cross_union`, options, getter));
  assert.equal(getterCalls, 0);
  await refuse('native options budget', () => loadBaroCadBooleanExtrusionFeatureGraph(`${base}/valid/cross_union`,
    { maximumParameterResolutions: 2, maximumFeatureEvaluations: 4 }),
  error => error instanceof BooleanExtrusionFeatureGraphError && error.code === 'BUDGET');
  evidence = { cases: cases.length, progressEvents, refusals: refused, oneNativeParsePerAcceptedLoad: true,
    independentReads: true, priorGraphAndFilesRetained: true, postParseAbortCheck: 'present-not-forced',
    scope: 'local HTTP actual saved authored files; no renderer' };
} finally {
  server.closeAllConnections();
  server.close();
  await once(server, 'close');
}
console.log(JSON.stringify(evidence));
