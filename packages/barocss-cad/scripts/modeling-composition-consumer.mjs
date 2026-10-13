import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { cad } from '../dist/index.js';
import { EXPECTED_CAMPAIGN, snapshotData, work, proveSnapshot, nativeBodyHash, signedData, sha256, exactData, deepFrozen, errorData } from '../test/modeling-composition-fixture.mjs';
assert.equal(Number(process.versions.node.split('.')[0]), 22); assert.ok(process.execArgv.includes('--no-opt'));
assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
assert.equal(process.argv.length, 3); const directory = resolve(process.argv[2]);
const sourceBytes = readFileSync(resolve(directory, 'source-flow.json')), source = JSON.parse(sourceBytes);
assert.equal(source.status, 'passed'); assert.equal(source.issue, 1695); assert.equal(source.modelCalls, 6); assert.equal(source.tessellations, 44);
exactData(source.expectedWholeCampaign, EXPECTED_CAMPAIGN);
const text = readFileSync(resolve(directory, 'edited.cad-model.json'), 'utf8'), nativeBytes = readFileSync(resolve(directory, 'edited.native.json'));
assert.equal(sha256(text), source.artifacts['edited.cad-model.json'].sha256); assert.equal(sha256(nativeBytes), source.artifacts['edited.native.json'].sha256);
const prior = JSON.parse(nativeBytes), receipt = resolve(directory, 'cold-flow.json');
const flow = { status: 'running', issue: 1695, processId: process.pid, processInstanceId: randomUUID(), nodeVersion: process.version,
  entrySHA256: sha256(readFileSync(new URL('../dist/index.js', import.meta.url))), sourceReceiptSHA256: sha256(sourceBytes), authoredInputSHA256: sha256(text),
  modelCalls: 0, tessellations: 0, nativeElapsedMS: source.nativeElapsedMS, sourceNativeElapsedMS: source.nativeElapsedMS,
  expectedWholeCampaign: EXPECTED_CAMPAIGN, fullTransitiveNativeCoverage: 'NOT_MEASURED', stages: [], artifacts: {} };
writeFileSync(receipt, signedData(flow) + '\n', { flag: 'wx' }); const write = () => writeFileSync(receipt, signedData(flow) + '\n');
function stage(label, action, filename) {
  const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024); assert.ok(flow.modelCalls < 2 && flow.nativeElapsedMS < 600000);
  flow.modelCalls++; flow.pending = label; write(); const begin = performance.now(); let outcome = 'threw', failure;
  try { const result = action(); outcome = 'returned'; const bytes = signedData(snapshotData(result)) + '\n';
    writeFileSync(resolve(directory, filename), bytes, { flag: 'wx' }); flow.artifacts[filename] = { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) }; write(); return result;
  } catch (error) { failure = errorData(error); throw error; }
  finally { const elapsedMS = performance.now() - begin; flow.nativeElapsedMS += elapsedMS; flow.stages.push({ label, outcome, elapsedMS, ...(failure ? { failure } : {}) }); flow.pending = null; write(); }
}
try {
  const reopened = stage('7 direct emitted cold cad.load', () => cad.load(text), '07-cold.snapshot.json');
  work(reopened, [], [0, 1, 2, 3, 4, 5, 6, 7]); flow.cold = proveSnapshot(reopened, 3328, 3584);
  assert.equal(reopened.save(), text); exactData(reopened.bodies.slotted.native, prior); assert.equal(nativeBodyHash(reopened), source.editedBodySHA256);
  const oldHash = nativeBodyHash(reopened), oldBody = reopened.bodies.slotted;
  const edited = stage('8 direct emitted slotWidth12 edit', () => reopened.withParameters({ slotWidth: 12 }), '08-cold-edited.snapshot.json');
  work(edited, [0, 1, 2, 3, 4], [5, 6, 7], reopened); flow.edited = proveSnapshot(edited, 3200, 3584);
  assert.equal(reopened.save(), text); assert.equal(nativeBodyHash(reopened), oldHash); assert.equal(reopened.bodies.slotted, oldBody); deepFrozen(reopened);
  assert.equal(flow.modelCalls, 2); assert.equal(flow.tessellations, 0); flow.status = 'passed'; flow.completedAt = new Date().toISOString(); write();
  console.log(signedData({ status: flow.status, modelCalls: 2, tessellations: 0, nativeElapsedMS: flow.nativeElapsedMS }));
} catch (error) { flow.status = 'failed'; flow.failure = errorData(error); write(); throw error; }
