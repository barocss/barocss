import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { BaroCadLoadAbortError, loadBaroCadSource } from '@barocss/cad-interop/native';

const source = readFileSync(new URL('../examples/two-surfaces.barocad', import.meta.url), 'utf8');
const bytes = Buffer.from(source, 'utf8');
const options = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001 };
const curveDisplay = { chordToleranceMM: 0.1, maxSegments: 128, maxDepth: 16 };
let requests = 0;
const server = createServer((request, response) => {
  requests++;
  if (request.url === '/asset') {
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': bytes.length }).end(bytes);
  } else if (request.url === '/slow') {
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': bytes.length });
    response.write(bytes.subarray(0, 48));
    setTimeout(() => { if (!response.destroyed) response.end(bytes.subarray(48)); }, 60);
  } else if (request.url === '/invalid') {
    response.writeHead(200, { 'content-type': 'text/plain' }).end('@model invalid { version: 0; }');
  } else if (request.url === '/oversize') {
    response.writeHead(200, { 'content-type': 'text/plain' }).end(Buffer.alloc(262145, 65));
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
const aborted = error => error instanceof BaroCadLoadAbortError && error.name === 'AbortError' && error.code === 'ABORT_ERR';

try {
  const progress = [];
  const stable = await loadBaroCadSource(`${base}/asset`, options, { onProgress: event => progress.push(event) });
  assert.equal(stable.source, source);
  assert.deepEqual(stable.model.objects.map(object => object.id), ['rational_panel', 'flat_panel', 'reference_edge']);
  assert.deepEqual(stable.surfaces.map(surface => surface.surfaceId), ['rational_panel', 'flat_panel']);
  assert.deepEqual(stable.unrenderedCurveIds, ['reference_edge']);
  assert.equal(stable.curves.length, 0);
  assert.ok(Object.is(stable.model.objects[0].controlPoints[0][0][0], -0));
  assert.equal(stable.model.objects[0].weights[0][1], 0.7071067811865476);
  assert.deepEqual(stable.surfaces[0].report.domain, { u: [2, 5], v: [10, 20] });
  assert.deepEqual(Array.from(stable.surfaces[0].packet.parameters.slice(0, 2)), [2, 10]);
  assert.equal(stable.surfaces[0].mesh.positions[3], Math.fround(stable.surfaces[0].packet.positions[3] * 0.001));
  assert.equal(progress.at(-1).loadedBytes, bytes.length);
  assert.equal(progress.at(-1).declaredTotalBytes, bytes.length);

  const mutable = { ...options, curveDisplay: { ...curveDisplay } };
  const mutableTransport = { onProgress: () => undefined };
  const pending = loadBaroCadSource(`${base}/slow`, mutable, mutableTransport);
  mutable.countU = 17;
  mutable.curveDisplay.maxSegments = 0;
  mutableTransport.onProgress = () => false;
  const snapshotted = await pending;
  assert.deepEqual(snapshotted.surfaces[0].report.grid, { countU: 8, countV: 8 });
  assert.deepEqual(snapshotted.curves.map(curve => curve.curveId), ['reference_edge']);
  assert.deepEqual(snapshotted.unrenderedCurveIds, []);
  assert.deepEqual(snapshotted.curves[0].sample.domain, [0, 1]);

  const [first, second] = await Promise.all([
    loadBaroCadSource(`${base}/asset`, options),
    loadBaroCadSource(`${base}/asset`, { ...options, curveDisplay }),
  ]);
  assert.notStrictEqual(first, second);
  assert.equal(first.curves.length, 0);
  assert.equal(second.curves.length, 1);

  const pre = new AbortController();
  pre.abort();
  const beforePreAbort = requests;
  await assert.rejects(loadBaroCadSource(`${base}/asset`, options, { signal: pre.signal }), aborted);
  assert.equal(requests, beforePreAbort);

  const mid = new AbortController();
  await assert.rejects(loadBaroCadSource(`${base}/slow`, options, {
    signal: mid.signal, onProgress: () => mid.abort(),
  }), aborted);
  await assert.rejects(loadBaroCadSource(`${base}/asset`, options, { onProgress: () => false }), aborted);
  const callbackError = new Error('host progress failed');
  await assert.rejects(loadBaroCadSource(`${base}/asset`, options, {
    onProgress: () => { throw callbackError; },
  }), error => error === callbackError);
  const abortAndThrow = new AbortController();
  await assert.rejects(loadBaroCadSource(`${base}/asset`, options, {
    signal: abortAndThrow.signal,
    onProgress: () => { abortAndThrow.abort(); throw callbackError; },
  }), aborted);

  const beforeInvalidOptions = requests;
  const optionGetter = { ...options };
  Object.defineProperty(optionGetter, 'countU', { enumerable: true, get() { throw new Error('do not read option getter'); } });
  await assert.rejects(loadBaroCadSource(`${base}/asset`, optionGetter), /countU must be data/);
  await assert.rejects(loadBaroCadSource(`${base}/asset`, { ...options, extra: true }), /optional curveDisplay only/);
  await assert.rejects(loadBaroCadSource(`${base}/asset`, options, { extra: true }), /signal and onProgress only/);
  const transportGetter = {};
  Object.defineProperty(transportGetter, 'signal', { enumerable: true, get() { throw new Error('do not read transport getter'); } });
  await assert.rejects(loadBaroCadSource(`${base}/asset`, options, transportGetter), /signal must be data/);
  assert.equal(requests, beforeInvalidOptions);

  await assert.rejects(loadBaroCadSource(`${base}/invalid`, options), /Invalid|CAD|source|model/i);
  await assert.rejects(loadBaroCadSource(`${base}/oversize`, options), /262144 bytes/);
  await assert.rejects(loadBaroCadSource(`${base}/utf8`, options), /encoded data|UTF-8|valid/i);
  await assert.rejects(loadBaroCadSource(`${base}/empty`, options), /readable response body/);
  await assert.rejects(loadBaroCadSource(`${base}/missing`, options), /HTTP 404/);
  assert.equal(stable.source, source);
  assert.deepEqual(stable.model.objects.map(object => object.id), ['rational_panel', 'flat_panel', 'reference_edge']);

  console.log(JSON.stringify({ result: 'neutral-native-url-ok', bytes: bytes.length, requests,
    surfaceIds: stable.surfaces.map(surface => surface.surfaceId),
    curveIds: snapshotted.curves.map(curve => curve.curveId), signedZero: Object.is(stable.model.objects[0].controlPoints[0][0][0], -0) }));
} finally {
  server.close();
  await once(server, 'close');
}
