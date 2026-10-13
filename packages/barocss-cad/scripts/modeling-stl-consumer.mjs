import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, statfsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { cad } from '../dist/index.js';
import { EXPECTED_CAMPAIGN, COLD_ACCOUNTING, WHOLE_ACCOUNTING, provePair, proveExport, decodeBinaryStl,
  hold, unchanged, signedData, sha256, dataHash, exactData, snapshotData,
  checkProcess, recorder, accounting } from '../test/modeling-stl-fixture.mjs';

// Fresh emitted process. Exactly one cold authored load and one named right
// export. Retained source native/mesh/encoding data is compared, never replayed.
checkProcess(); assert.ok(process.argv.length === 3 || (process.argv.length === 4 && process.argv[3] === '--continued')); const directory = resolve(process.argv[2]);
const sourceBytes = readFileSync(resolve(directory, process.argv[3] ? 'source-completed.json' : 'source-flow.json')), source = JSON.parse(sourceBytes);
if (process.argv[3]) {
  assert.equal(sha256(readFileSync(resolve(directory, 'source-flow.json'))), source.originalFailedReceiptSHA256);
  assert.equal(sha256(readFileSync(resolve(directory, 'continuation-flow.json'))), source.continuationReceiptSHA256);
}
assert.equal(source.status, 'passed'); assert.equal(source.issue, 1890);
assert.equal(source.modelCalls, 2); assert.equal(source.exportCalls, 3); assert.equal(source.tessellations, 3);
for (const name of ['massQueries', 'cpuBufferPreparations', 'standaloneValidators', 'samplingQueries']) assert.equal(source[name], 0);
exactData(source.expectedWholeCampaign, EXPECTED_CAMPAIGN);
function input(filename) {
  const bytes = readFileSync(resolve(directory, filename)); assert.equal(sha256(bytes), source.artifacts[filename].sha256);
  assert.equal(bytes.length, source.artifacts[filename].bytes); return bytes;
}
const text = input('initial.cad-model.json').toString('utf8'), prior = JSON.parse(input('01-baseline.snapshot.json'));
const priorRight = JSON.parse(input('baseline-right.export.json')), rightBytes = input('baseline-right.stl');
const transfer = JSON.parse(input('baseline-transfer.json'));
exactData(transfer.bodies, prior.bodies); exactData(transfer.evidence, prior.evidence); assert.equal(transfer.text, text);
exactData(transfer.translationLineage, prior.evidence[2].native.lineage); exactData(transfer.exports.right, priorRight);
exactData(priorRight.bytes, [...rightBytes]);
const { flow, stage, artifact, write, finish, fail } = recorder(directory, 'cold', {
  entrySHA256: sha256(readFileSync(new URL('../dist/index.js', import.meta.url))), sourceReceiptSHA256: sha256(sourceBytes),
  sourceProcessInstanceId: source.processInstanceId, groupStartedAtMS: source.groupStartedAtMS,
  authoredInputSHA256: sha256(text), nativeElapsedMS: source.nativeElapsedMS, sourceNativeElapsedMS: source.nativeElapsedMS,
  physicalFileWrites: 0, physicalFileReads: 0 });
assert.notEqual(flow.processInstanceId, source.processInstanceId);
try {
  const reopened = stage('modelCalls', '3 emitted cold load of actual source authored baseline', () => cad.load(text), '03-cold.snapshot.json');
  artifact('cold.cad-model.json', reopened.save(), 'actual cold authored save before parity oracle', true); const before = hold(reopened);
  const result = stage('exportCalls', '4 emitted named right STL export with one inherent tessellation', () => reopened.exportStl('right'), 'cold-right.export.json');
  // Complete cold native data and export bytes are persisted before comparisons.
  flow.cold = provePair(reopened); assert.equal(reopened.save(), text); exactData(snapshotData(reopened), prior);
  assert.equal(dataHash(snapshotData(reopened)), source.baselineSnapshotSHA256);
  assert.equal(dataHash(reopened.bodies), source.baselineBodiesSHA256); assert.equal(dataHash(reopened.evidence), source.baselineEvidenceSHA256);
  flow.export = proveExport(result, reopened, 'right'); exactData(result, priorRight, 'full cold bytes/body/mesh/encoding/report parity');
  exactData(result.bytes, [...rightBytes]); unchanged(reopened, before);

  // This one actual temporary STL file is written and read back once. This
  // proves local byte preservation only, not browser download, slicing or CAD
  // topology roundtrip. The API's own file counters stay zero throughout.
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'barocss-cad-stl-1890-'));
  const temporaryPath = resolve(temporaryDirectory, 'cold-right.stl'), disk = statfsSync(temporaryDirectory);
  assert.ok(disk.bavail * disk.bsize >= 500 * 1024 * 1024);
  flow.fileRoundtrip = { path: temporaryPath, scope: 'one explicit temporary local binary STL write/read; retained for inspection', status: 'pending' }; write();
  writeFileSync(temporaryPath, Buffer.from(result.bytes), { flag: 'wx' }); flow.physicalFileWrites++; write();
  const fileBytes = readFileSync(temporaryPath); flow.physicalFileReads++;
  flow.fileRoundtrip.status = 'read'; flow.fileRoundtrip.byteLength = fileBytes.length; flow.fileRoundtrip.sha256 = sha256(fileBytes); write();
  // Decode this fresh physical read, rather than decoding the in-memory source.
  const decoded = decodeBinaryStl(fileBytes); artifact('cold-right.file-decoded.json', decoded, 'independent every-byte decoder of the actual fresh temporary-file read');
  exactData([...fileBytes], result.bytes); exactData([...fileBytes], [...rightBytes]);
  exactData(decoded, decodeBinaryStl(rightBytes)); assert.equal(fileBytes.length, 684);
  assert.equal(flow.physicalFileWrites, 1); assert.equal(flow.physicalFileReads, 1); flow.fileRoundtrip.status = 'passed';
  assert.equal(flow.modelCalls, 1); assert.equal(flow.exportCalls, 1); assert.equal(flow.tessellations, 1);
  flow.coldAccounting = accounting(flow.returnedLedgers, [1, 1, 1, 1, 1, 1]); exactData(flow.coldAccounting, COLD_ACCOUNTING);
  const combined = Object.fromEntries(Object.keys(flow.returnedLedgers).map(name => [name, [...source.returnedLedgers[name], ...flow.returnedLedgers[name]]]));
  const measured = accounting(combined, [3, 3, 2, 2, 2, 4]); exactData(measured, WHOLE_ACCOUNTING);
  flow.accounting = { ...measured, publicModelCalls: source.modelCalls + flow.modelCalls,
    publicExportCalls: source.exportCalls + flow.exportCalls, actualTessellations: source.tessellations + flow.tessellations,
    successfulPrisms: combined.prisms.length, successfulTranslatedCopies: combined.targets.length, actualEncodingCollapseRefusals: 1,
    sourceDerivedTotalSolverAttempts: 6, massQueries: 0, cpuBufferPreparations: 0, standaloneValidators: 0, samplingQueries: 0 };
  exactData([flow.accounting.publicModelCalls, flow.accounting.publicExportCalls, flow.accounting.actualTessellations], [3, 4, 4]);
  flow.fullAuthoredBodySaveMeshEncodingReportByteParity = true; finish();
  console.log(signedData({ status: flow.status, modelCalls: flow.modelCalls, exportCalls: flow.exportCalls,
    accounting: flow.accounting, fileRoundtrip: flow.fileRoundtrip, nativeElapsedMS: flow.nativeElapsedMS }));
} catch (error) { fail(error); throw error; }
