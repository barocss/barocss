import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
// Intentionally direct emitted import: this process never imports source code or
// manufactures a wrapper entry. No preview, validator or extra model calls.
import { cad } from '../dist/index.js';
import { EXPECTED_CAMPAIGN, snapshotData, work, provePost, nativeBodyHash, signedData,
  sha256, exactData, deepFrozen, errorData } from '../test/modeling-circle-fixture.mjs';
assert.equal(Number(process.versions.node.split('.')[0]), 22);
assert.ok(process.execArgv.includes('--no-opt'));
assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
assert.equal(process.argv.length, 3);
const directory = resolve(process.argv[2]), sourceFile = resolve(directory, 'source-flow.json');
const sourceBytes = readFileSync(sourceFile), source = JSON.parse(sourceBytes.toString('utf8'));
assert.equal(source.status, 'passed'); assert.equal(source.issue, 1677);
assert.equal(source.modelCalls, 6); assert.equal(source.previews, 1);
exactData(source.expectedWholeCampaign, EXPECTED_CAMPAIGN);
const inputFile = resolve(directory, 'edited.cad-model.json'), text = readFileSync(inputFile, 'utf8');
assert.equal(sha256(text), source.artifacts['edited.cad-model.json'].sha256);
const nativeFile = resolve(directory, 'edited.native.json'), nativeBytes = readFileSync(nativeFile);
assert.equal(sha256(nativeBytes), source.artifacts['edited.native.json'].sha256);
const sourceNative = JSON.parse(nativeBytes.toString('utf8'));
assert.equal(signedData(sourceNative) + '\n', nativeBytes.toString('utf8'));
const receipt = resolve(directory, 'cold-flow.json'), started = performance.now();
const flow = { status: 'running', issue: 1677, processId: process.pid, processInstanceId: randomUUID(), nodeVersion: process.version,
  startedAt: new Date().toISOString(), entrySHA256: sha256(readFileSync(new URL('../dist/index.js', import.meta.url))),
  sourceReceiptSHA256: sha256(sourceBytes), authoredInputSHA256: sha256(text), modelCalls: 0, previews: 0,
  sourceNativeElapsedMS: source.nativeElapsedMS, nativeElapsedMS: source.nativeElapsedMS, stages: [], artifacts: {},
  expectedWholeCampaign: EXPECTED_CAMPAIGN, sourceDerivedExpectedWorkIsNotInstrumented: true,
  fullTransitiveNativeCoverage: 'NOT_MEASURED', externalSerialProcessGroupTimeoutRequired: true };
assert.ok(Number.isFinite(flow.nativeElapsedMS) && flow.nativeElapsedMS >= 0 && flow.nativeElapsedMS < 600000);
writeFileSync(receipt, signedData(flow) + '\n', { flag: 'wx' });
const write = () => writeFileSync(receipt, signedData(flow) + '\n');
function artifact(filename, value) {
  const bytes = signedData(value) + '\n'; assert.ok(Buffer.byteLength(bytes) <= 3 * 1024 * 1024);
  writeFileSync(resolve(directory, filename), bytes, { flag: 'wx' });
  flow.artifacts[filename] = { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) }; write();
}
function unchanged() {
  assert.equal(sha256(readFileSync(sourceFile)), flow.sourceReceiptSHA256);
  assert.equal(readFileSync(inputFile, 'utf8'), text); assert.equal(sha256(readFileSync(nativeFile)), sha256(nativeBytes));
  for (const [filename, original] of Object.entries(source.artifacts)) { const bytes = readFileSync(resolve(directory, filename)); assert.equal(bytes.length, original.bytes); assert.equal(sha256(bytes), original.sha256); }
}
function stage(label, action, filename) {
  unchanged(); const d = statfsSync(directory); assert.ok(d.bavail * d.bsize >= 500 * 1024 * 1024);
  assert.ok(flow.nativeElapsedMS < 600000, 'aggregate source+cold native cap reached; no retry');
  assert.ok(flow.modelCalls < 2, 'frozen cold call budget exhausted'); flow.modelCalls++;
  flow.pending = label; write(); const start = performance.now(); let outcome = 'threw', failure;
  try {
    const result = action(); outcome = 'returned';
    artifact(filename, snapshotData(result)); return result; // Retain actual data before proof assertions.
  } catch (error) { failure = errorData(error); throw error; }
  finally {
    const elapsedMS = performance.now() - start; flow.nativeElapsedMS += elapsedMS;
    flow.stages.push({ label, outcome, elapsedMS, ...(failure ? { failure } : {}) }); flow.pending = null; write();
  }
}
try {
  const reopened = stage('7 fresh emitted cad.load of signed-zero recovery6', () => cad.load(text), '07-cold.snapshot.json');
  work(reopened, [], [0, 1]); flow.reopened = provePost(reopened, 'recovered');
  assert.equal(reopened.save(), text); exactData(reopened.bodies.post.native, sourceNative, 'cold full native coefficient/source/proof parity');
  flow.reopenedBodySHA256 = nativeBodyHash(reopened); assert.equal(flow.reopenedBodySHA256, source.editedBodySHA256);
  assert.equal(sha256(reopened.evidence[0].native.source), source.editedProfileSourceSHA256);
  assert.equal(sha256(reopened.bodies.post.native.world.source), source.editedWorldSourceSHA256);
  assert.notEqual(reopened.bodies.post.native, sourceNative); assert.equal(Object.isFrozen(sourceNative), false);
  deepFrozen(reopened); // Fresh runtime freezing, independently of caller-owned parsed source artifacts.
  const oldBody = reopened.bodies.post;
  const edited = stage('8 emitted height3 edit of cold7', () => reopened.withParameters({ height: 3 }), '08-cold-edited.snapshot.json');
  work(edited, [0], [1], reopened); flow.reedited = provePost(edited, 'coldEdited');
  assert.equal(edited.evidence[0], reopened.evidence[0]); assert.equal(edited.evidence[0].native, reopened.evidence[0].native);
  assert.equal(reopened.bodies.post, oldBody); assert.equal(reopened.save(), text); assert.equal(nativeBodyHash(reopened), source.editedBodySHA256);
  exactData(reopened.bodies.post.native, sourceNative); deepFrozen(reopened); deepFrozen(edited); unchanged();
  flow.reeditedBodySHA256 = nativeBodyHash(edited); flow.independentColdFreezeAndParity = true;
  flow.previousColdBodyAndSaveUnchanged = true; flow.originalSourceReceiptAndArtifactsUnchanged = true;
  assert.equal(flow.modelCalls, 2); assert.equal(source.modelCalls + flow.modelCalls, 8); assert.equal(flow.previews, 0);
  assert.ok(flow.nativeElapsedMS < 600000);
  assert.equal(sha256(readFileSync(new URL('../dist/index.js', import.meta.url))), flow.entrySHA256);
  flow.status = 'passed'; flow.elapsedMS = performance.now() - started; flow.finishedAt = new Date().toISOString(); write();
} catch (error) { flow.status = 'failed'; flow.failure = errorData(error); flow.finishedAt = new Date().toISOString(); write(); throw error; }
