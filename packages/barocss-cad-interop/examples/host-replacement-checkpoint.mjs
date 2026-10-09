import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Object3D, Scene } from 'three';
import { ARTIFACTS, createReplacementHost, NATIVE_IDS } from './host-replacement-flow.mjs';

const baseURL = process.env.LOADER991_BASE_URL;
assert.ok(baseURL, 'Verifier must supply its real server URL');
const sourcePath = resolve(process.cwd(), 'packages/barocss-cad-interop/examples/linear-geometry-pattern-babylon-data');
const originalA = readFileSync(resolve(sourcePath, 'five_quarter_x_copies.barocad'), 'utf8');
const originalB = readFileSync(resolve(sourcePath, 'spacing_edit_same_roles.barocad'), 'utf8');
const scene = new Scene(), marker = new Object3D();
marker.name = 'caller-marker'; scene.add(marker);
const changes = [];
const host = createReplacementHost({ scene, baseURL, onChange(value) {
  if (value.accepted) {
    assert.equal(value.accepted.result.group.parent, scene);
    for (const record of host.records) if (record !== value.accepted && record.generation < value.accepted.generation) {
      assert.equal(record.result.group.parent, null);
      assert.ok(record.resources.every(resource => resource.geometryDisposals === 1 && resource.materialDisposals === 1));
    }
  }
  changes.push({ type: value.type, generation: value.accepted?.generation ?? null, events: value.events.map(event => event.type) });
} });
const counts = record => record.resources.map(resource => [resource.geometryDisposals, resource.materialDisposals]);
const release = gate => fetch(new URL(`/__loader991/release?gate=${gate}`, baseURL), { method: 'POST' }).then(response => response.json());
const serverEvents = () => fetch(new URL('/__loader991/events', baseURL)).then(response => response.json());
const initial = host.start(ARTIFACTS.A);
assert.equal((await initial.promise).status, 'accepted');
assert.equal(host.accepted.source, originalA);
assert.deepEqual(host.accepted.model.objects.map(object => object.id), NATIVE_IDS);
assert.ok(host.accepted.model.objects.every(object => object.kind === 'curve'));
const stableA = host.accepted;
assert.deepEqual(counts(stableA), Array(5).fill([0, 0]));

const abortB = host.start(ARTIFACTS.B, { gate: 'abort-B', abortOnProgress: true });
const abortProgress = await abortB.firstProgress;
assert.equal(abortProgress.loadedBytes, 128);
assert.equal(abortProgress.declaredTotalBytes, ARTIFACTS.B.bytes);
const aborted = await abortB.promise;
assert.equal(aborted.status, 'aborted');
assert.equal(aborted.error.name, 'AbortError');
assert.equal(aborted.error.code, 'ABORT_ERR');
assert.equal(host.accepted, stableA);
assert.equal(host.records.length, 1, 'Abort occurred before any target allocation');
assert.deepEqual(counts(stableA), Array(5).fill([0, 0]));
await release('abort-B');

const replacement = host.start(ARTIFACTS.B);
assert.equal((await replacement.promise).status, 'accepted');
const stableB = host.accepted;
assert.equal(stableB.source, originalB);
assert.deepEqual(counts(stableA), Array(5).fill([1, 1]));
assert.equal(stableA.result.group.parent, null);
assert.deepEqual(host.events.slice(-3).map(event => event.type), ['mounted', 'old-disposed', 'change']);

const slowA = host.start(ARTIFACTS.A, { gate: 'slow-A' });
assert.equal((await slowA.firstProgress).loadedBytes, 128);
assert.equal(slowA.controller.signal.aborted, false);
const latestB = host.start(ARTIFACTS.B);
assert.equal((await latestB.promise).status, 'accepted');
const latest = host.accepted;
assert.equal(latest.generation, latestB.generation);
assert.deepEqual(counts(stableB), Array(5).fill([1, 1]));
assert.equal((await release('slow-A')).released, true);
const stale = await slowA.promise;
assert.equal(stale.status, 'stale');
assert.equal(slowA.controller.signal.aborted, false, 'Late result was handled by host generation arbitration, not transport abort');
assert.equal(stale.record.source, originalA);
assert.equal(stale.record.result.group.parent, null);
assert.deepEqual(counts(stale.record), Array(5).fill([1, 1]));
assert.equal(host.accepted, latest);
assert.ok(!host.events.some(event => event.type === 'mounted' && event.generation === slowA.generation));
assert.deepEqual(host.events.slice(-2).map(event => event.type), ['detached-ready', 'stale-disposed']);

for (const artifact of [ARTIFACTS.invalid, ARTIFACTS.http503]) {
  const before = [...scene.children];
  const failed = await host.start(artifact).promise;
  assert.equal(failed.status, 'failed');
  assert.ok(failed.error instanceof Error);
  assert.equal(host.accepted, latest);
  assert.equal(host.accepted.source, originalB);
  assert.deepEqual(scene.children, before);
  assert.deepEqual(counts(latest), Array(5).fill([0, 0]));
}
assert.equal(host.records.length, 4);
host.dispose(); host.dispose();
assert.equal(host.accepted, null);
assert.deepEqual(scene.children, [marker]);
assert.equal(marker.parent, scene);
for (const record of host.records) assert.deepEqual(counts(record), Array(5).fill([1, 1]));
assert.deepEqual(changes.map(change => change.type), ['change', 'change', 'change', 'disposed']);
const actualServer = await serverEvents();
const slowRequest = actualServer.find(event => event.type === 'request' && event.gate === 'slow-A');
assert.ok(slowRequest);
assert.deepEqual(actualServer.filter(event => event.type === 'chunk' && event.requestId === slowRequest.requestId).map(event => event.bytes), [128, ARTIFACTS.A.bytes - 128]);
const slowRelease = actualServer.find(event => event.type === 'release' && event.gate === 'slow-A');
const slowEnd = actualServer.find(event => event.type === 'end' && event.requestId === slowRequest.requestId);
assert.ok(slowRelease.sequence < slowEnd.sequence);
const abortRequest = actualServer.find(event => event.type === 'request' && event.gate === 'abort-B');
assert.ok(actualServer.some(event => event.type === 'premature-close' && event.requestId === abortRequest.requestId));
assert.ok(!actualServer.some(event => event.type === 'end' && event.requestId === abortRequest.requestId));
assert.ok(actualServer.some(event => event.type === 'status' && event.status === 503));
console.log(JSON.stringify({ result: 'source-host-replacement-ok', nativeIds: NATIVE_IDS,
  acceptedSources: [ARTIFACTS.A, ARTIFACTS.B], abortBytes: abortProgress.loadedBytes,
  abortName: aborted.error.name, abortCode: aborted.error.code, lateRequestSignalAborted: slowA.controller.signal.aborted,
  preparedResults: host.records.length, geometryDisposals: 20, materialDisposals: 20,
  callerMarkerPreserved: true, changes, hostEvents: host.events, serverEvents: actualServer,
  executedScenarios: ['load-A', 'progress-abort-B', 'replace-B', 'late-success-disposed', 'invalid-and-503-retained', 'double-cleanup'],
  scope: 'actual-source-HTTP-native-Three-CPU-instances; browser-pixels-are-separate' }));
