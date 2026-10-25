import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, statfsSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateStoredCirclePrismSolid } from '../dist/index.js';
import { signedData, sha256, dataHash, exactData, deepFrozen, errorData, proveQualification, EXPECTED_CAMPAIGN } from '../test/stored-circle-prism-solid-fixture.mjs';

// Fresh emitted process: exactly one whole-result validation of actual source A.
// This consumer never calls a constructor, qualifier, tessellator or derivative.
assert.equal(Number(process.versions.node.split('.')[0]), 22);
assert.ok(process.execArgv.includes('--no-opt'));
assert.match([...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' '), /--max[-_]old[-_]space[-_]size(?:=|\s+)1536(?:\s|$)/);
assert.ok(process.argv.length === 3 || process.argv.length === 4, 'pass the evidence directory and optional source-continuation-flow.json receipt');
const receiptName = process.argv[3] ?? 'source-flow.json';
assert.ok(receiptName === 'source-flow.json' || receiptName === 'source-continuation-flow.json', 'select one explicit source receipt');
const directory = resolve(process.argv[2]), sourceReceiptFile = resolve(directory, receiptName), sourceReceiptBytes = readFileSync(sourceReceiptFile);
const source = JSON.parse(sourceReceiptBytes.toString('utf8')), sourceReceiptSHA256 = sha256(sourceReceiptBytes);
assert.equal(source.status, 'passed', 'the selected source receipt must pass before the one cold native call');
// PIDs may repeat across namespaces or later processes. The explicit independent
// script plus this realm marker establishes freshness without assuming PID uniqueness.
assert.equal(globalThis[Symbol.for('barocss.stored-circle-prism-solid.source-process')], undefined, 'cold validation cannot share the source campaign process');
const processInstanceId = randomUUID();
if (source.processInstanceId) assert.notEqual(processInstanceId, source.processInstanceId);
const originalReceiptPin = 'ff32a7388da44b8b90c3dfa4bf5e83b9e1383dd28763492874a9da41ed336dc6';
if (receiptName === 'source-continuation-flow.json') {
  assert.equal(source.mode, 'retained-artifact-continuation');
  assert.deepEqual(source.originalSourceReceipt, { filename: 'source-flow.json', sha256: originalReceiptPin });
  assert.equal(sha256(readFileSync(resolve(directory, 'source-flow.json'))), originalReceiptPin);
  const original = JSON.parse(readFileSync(resolve(directory, 'source-flow.json'), 'utf8'));
  assert.equal(original.status, 'failed'); assert.equal(source.entrySHA256, original.entrySHA256);
  assert.deepEqual(source.spentCallsFromOriginalReceipt, original.calls);
  assert.deepEqual(source.continuationCalls, { wallD1Attempts: 3 });
  assert.equal(source.stages.length, 3); assert.ok(source.stages.every(stage => stage.kind === 'wallD1Attempts' && stage.outcome === 'threw'));
  assert.equal(source.retainedArtifactPreflightPassed, true); assert.equal(source.originalReceiptAndArtifactsUnchanged, true);
  exactData(source.artifacts, original.artifacts);
}
const verifyReceipts = () => {
  assert.equal(sha256(readFileSync(sourceReceiptFile)), sourceReceiptSHA256, 'selected successful receipt remains immutable');
  if (receiptName === 'source-continuation-flow.json') assert.equal(sha256(readFileSync(resolve(directory, 'source-flow.json'))), originalReceiptPin);
  for (const [filename, receipt] of Object.entries(source.artifacts)) {
    assert.match(filename, /^[ABC]\.(?:parent\.json|profile\.source0|world\.source0|qualified\.json|preview\.json)$/);
    const bytes = readFileSync(resolve(directory, filename)); assert.equal(bytes.length, receipt.bytes); assert.equal(sha256(bytes), receipt.sha256);
  }
};
verifyReceipts();
assert.deepEqual(source.calls, { parentBuilds: 3, qualifiers: 4, validators: 1, previews: 1, wallD1Attempts: 3 });
const file = resolve(directory, 'A.qualified.json'), text = readFileSync(file, 'utf8'), artifact = JSON.parse(text);
assert.equal(sha256(text), source.artifacts['A.qualified.json'].sha256);
assert.equal(text, signedData(artifact) + '\n', 'canonical signed data bytes survive a fresh parse');
const originalParent = JSON.parse(readFileSync(resolve(directory, 'A.parent.json'), 'utf8'));
exactData(artifact.parent, originalParent);
assert.equal(artifact.parent.profile.source, readFileSync(resolve(directory, 'A.profile.source0'), 'utf8'));
assert.equal(artifact.world.source, readFileSync(resolve(directory, 'A.world.source0'), 'utf8'));
const flowFile = resolve(directory, 'cold-flow.json'), flow = { status: 'running', issue: 1655, processId: process.pid, processInstanceId,
  sourceProcessId: source.processId, sourceProcessInstanceId: source.processInstanceId ?? null,
  sourceReceipt: { filename: receiptName, sha256: sourceReceiptSHA256 },
  ...(receiptName === 'source-continuation-flow.json' ? { originalSourceReceipt: source.originalSourceReceipt } : {}),
  nodeVersion: process.version, entrySHA256: sha256(readFileSync(new URL('../dist/index.js', import.meta.url))),
  sourceEntrySHA256: source.entrySHA256, artifactSHA256: sha256(text), wholeResultValidationCalls: 0,
  expectedWholeCampaign: EXPECTED_CAMPAIGN, fullTransitiveNativeCoverage: 'NOT_MEASURED',
  sourceNativeElapsedMS: source.nativeElapsedMS, coldNativeElapsedMS: 0, externalSerialProcessGroupTimeoutRequired: true };
writeFileSync(flowFile, JSON.stringify(flow, null, 2) + '\n', { flag: 'wx' });
const write = () => writeFileSync(flowFile, JSON.stringify(flow, null, 2) + '\n');
try {
  const disk = statfsSync(directory); assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
  assert.ok(Number.isFinite(source.nativeElapsedMS) && source.nativeElapsedMS >= 0 && source.nativeElapsedMS < 600000, 'root must apply the remaining aggregate native timeout');
  assert.equal(existsSync(resolve(directory, 'F.certificate.json')), false, 'an existing cold certificate forbids another validation');
  verifyReceipts(); flow.parity = proveQualification(artifact, originalParent, 'A', false);
  const before = signedData(artifact), beforeHash = dataHash(artifact);
  flow.wholeResultValidationCalls++; flow.pending = 'F fresh emitted whole-result reconstruction'; write();
  const start = performance.now(); let certificate;
  try { certificate = validateStoredCirclePrismSolid(artifact); }
  finally { flow.coldNativeElapsedMS = performance.now() - start; flow.aggregateNativeElapsedMS = source.nativeElapsedMS + flow.coldNativeElapsedMS; write(); }
  flow.pending = null;
  const certificateArtifact = signedData(certificate) + '\n';
  writeFileSync(resolve(directory, 'F.certificate.json'), certificateArtifact, { flag: 'wx' });
  flow.returnedCertificateArtifact = { filename: 'F.certificate.json', sha256: sha256(certificateArtifact), bytes: Buffer.byteLength(certificateArtifact) }; write();
  assert.ok(flow.aggregateNativeElapsedMS < 600000); assert.equal(flow.wholeResultValidationCalls, 1);
  exactData(certificate, artifact.certificate); assert.notEqual(certificate, artifact.certificate); deepFrozen(certificate);
  assert.equal(signedData(artifact), before); assert.equal(dataHash(artifact), beforeHash);
  assert.equal(dataHash(artifact), source.A.qualifiedDataSHA256);
  // The preflight inspected actual parsed input without labeling it frozen.
  // Only the recomputed certificate is returned by validation and frozen above.
  const certificateBytes = signedData(certificate);
  artifact.certificate.arithmetic.operations++; artifact.parent.report.center[0] = 99; artifact.world.source = 'caller-owned mutation after validation';
  assert.equal(signedData(certificate), certificateBytes); deepFrozen(certificate);
  assert.throws(() => { certificate.vertexLinks[0].germs[0].endpointIndex = 1; }, TypeError);
  assert.equal(readFileSync(file, 'utf8'), text);
  verifyReceipts();
  flow.returnedCertificateDeepFrozen = true; flow.parsedInputUnchangedByValidation = true; flow.returnedCertificateIndependentOfCallerMutation = true;
  flow.signedArtifactBytesUnchanged = true; flow.wholeCampaignQualificationOrValidationCalls = source.calls.qualifiers + source.calls.validators + flow.wholeResultValidationCalls;
  assert.equal(flow.wholeCampaignQualificationOrValidationCalls, 6);
  flow.status = 'passed'; write();
} catch (error) {
  flow.status = 'failed'; flow.failure = errorData(error); flow.additionalGeometryRequiresScopeAmendment = true; write(); throw error;
}
