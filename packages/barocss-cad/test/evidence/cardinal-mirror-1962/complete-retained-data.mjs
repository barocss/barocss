import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {exactData,signedData,sha256,dataHash,accounting,EXPECTED_TOTALS,emptyLedgers} from '../../modeling-mirror-fixture.mjs';
const directory=resolve(process.env.CAD_MODEL_EVIDENCE_DIR ?? (()=>{throw new Error('Retained CAD_MODEL_EVIDENCE_DIR required; no geometry is executed');})()), started=performance.now();
const sourceBytes=readFileSync(resolve(directory,'source-flow.json')),coldBytes=readFileSync(resolve(directory,'cold-flow.json')),groupBytes=readFileSync(resolve(directory,'root-process-group.json'));
const source=JSON.parse(sourceBytes),cold=JSON.parse(coldBytes),group=JSON.parse(groupBytes);
assert.equal(source.status,'passed');assert.equal(cold.status,'failed');assert.equal(group.status,'failed');
exactData([source.issue,cold.issue,group.issue],[1962,1962,1962]);
exactData([source.modelCalls,source.tessellations,cold.modelCalls,cold.tessellations],[6,2,1,0]);
assert.equal(cold.failure.name,'AssertionError');exactData(cold.failure.actual,['mirrored','original']);exactData(cold.failure.expected,['original','mirrored']);
assert.equal(cold.stages.length,1);assert.equal(cold.stages[0].outcome,'returned');assert.equal(cold.pending,null);
assert.ok(group.wallSeconds<600 && source.nativeElapsedMS+cold.nativeElapsedMS<600000);
function artifact(flow,name) { const bytes=readFileSync(resolve(directory,name));assert.equal(sha256(bytes),flow.artifacts[name].sha256);assert.equal(bytes.length,flow.artifacts[name].bytes);return bytes; }
const baselineBytes=artifact(source,'01-baseline.snapshot.json'),retainedColdBytes=artifact(cold,'07-cold.snapshot.json');
const baseline=JSON.parse(baselineBytes),retainedCold=JSON.parse(retainedColdBytes),saved=artifact(source,'initial.cad-model.json').toString('utf8');
// Complete byte-semantic data equality transfers every passed baseline data oracle.
// Parsed objects supply no original identity, ownership or freeze observation.
exactData(retainedCold,baseline);assert.equal(retainedCold.text,saved);assert.equal(dataHash(retainedCold),source.baselineSnapshotSHA256);
assert.equal(dataHash(retainedCold.bodies),source.baselineBodiesSHA256);assert.equal(dataHash(retainedCold.evidence),source.baselineEvidenceSHA256);
exactData(Object.keys(retainedCold.bodies).sort(),['mirrored','original']);
const retainedLedgers=Object.fromEntries(Object.keys(emptyLedgers()).map(key=>[key,cold.returnedLedgers[key]]));
const coldAccounting=accounting(retainedLedgers,[1,1,1,1,1,1,1,0]);
exactData(coldAccounting,{returnedLedgerSourceCompilations:94,returnedLedgerBindingObservations:1134,returnedLedgerD1:3402,knownSourceCompilations:103,combinedBindingObservations:1242,knownD1:3726,initialFaceConstructionCount:8,fullTransitiveNativeCoverage:'NOT_MEASURED'});
const combined=Object.fromEntries(Object.keys(emptyLedgers()).map(key=>[key,[...source.returnedLedgers[key],...cold.returnedLedgers[key]]]));
const totals=accounting(combined,[4,4,2,4,6,6,6,2]);exactData(totals,EXPECTED_TOTALS);
const completed={status:'passed',issue:1962,continuation:'fixture-only retained data completion',processId:process.pid,newModelEvaluations:0,newTessellations:0,newNativeProviderCalls:0,nativeReruns:0,
originalSourceFlowStatus:source.status,originalColdFlowStatus:cold.status,originalProcessGroupStatus:group.status,originalFixtureFailurePreserved:true,
inputSHA256:{sourceFlow:sha256(sourceBytes),coldFlow:sha256(coldBytes),processGroup:sha256(groupBytes),sourceBaseline:sha256(baselineBytes),retainedCold:sha256(retainedColdBytes)},
completeColdDataAndAuthoredByteParity:true,proofBoundary:'Full retained cold snapshot equals full original source baseline whose data oracles passed. Parsed replay establishes data equality only; no fresh identity/freeze claim. Original genuine cold work() completed the recursive freeze check before body-label-order fixture failure.',
campaignModelEvaluations:7,campaignTessellations:2,campaignAccounting:totals,coldAccounting,actualNativeProcessGroupSeconds:group.wallSeconds,completionWallMS:performance.now()-started};
writeFileSync(process.env.CAD_MODEL_REPLAY_RECEIPT ?? resolve(directory,'retained-data-completion.json'),signedData(completed)+'\n',{flag:'wx'});
console.log(signedData(completed));
