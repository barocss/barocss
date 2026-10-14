import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULTS,EXPECTED_TOTALS,proveSnapshot,work,snapshotData,signedData,sha256,dataHash,exactData,emptyLedgers,accounting,recorder } from './modeling-translated-intersection-fixture.mjs';

// Exactly one fresh emitted cold rebuild. Parsed records prove data equality,
// while only the genuine newly returned object graph proves recursive freeze.
assert.ok(process.env.CAD_MODEL_TEST_MODULE);assert.ok(process.env.CAD_MODEL_EVIDENCE_DIR);
const entry=resolve(process.env.CAD_MODEL_TEST_MODULE),directory=resolve(process.env.CAD_MODEL_EVIDENCE_DIR);assert.ok(entry.endsWith('/dist/index.js'));
const sourceBytes=readFileSync(resolve(directory,'source-flow.json')),source=JSON.parse(sourceBytes);assert.equal(source.status,'passed');assert.equal(source.issue,2002);exactData([source.modelCalls,source.tessellations],[5,1]);
const {flow,artifact,stage,fail,finish}=recorder('cold',entry,directory,source);
try{
  assert.notEqual(flow.processId,source.processId);assert.notEqual(flow.processInstanceId,source.processInstanceId);flow.sourceFlowSHA256=sha256(sourceBytes);
  const text=readFileSync(resolve(directory,'initial.cad-model.json'),'utf8'),bytes=readFileSync(resolve(directory,'01-baseline.snapshot.json'));
  assert.equal(sha256(text),source.artifacts['initial.cad-model.json'].sha256);assert.equal(sha256(bytes),source.artifacts['01-baseline.snapshot.json'].sha256);
  const baseline=JSON.parse(bytes);assert.equal(text,baseline.text);const {cad}=await import(pathToFileURL(entry).href);
  const cold=stage('modelCalls','6 fresh emitted baselinecold overlap2944',()=>cad.load(text),'06-cold.snapshot.json');
  work(cold,[],[0,1,2,3,4,5]);flow.baseline=proveSnapshot(cold,DEFAULTS);exactData(snapshotData(cold),baseline);assert.equal(cold.save(),text);
  assert.equal(dataHash(snapshotData(cold)),source.baselineSnapshotSHA256);assert.equal(dataHash(cold.bodies),source.baselineBodiesSHA256);assert.equal(dataHash(cold.evidence),source.baselineEvidenceSHA256);
  artifact('cold.cad-model.json',cold.save(),'actual fresh emitted save',true);
  flow.parity={canonicalSave:true,parameters:true,bodies:true,evidence:true,fullBaselineSnapshot:true,freshProcessFullRebuild:true,parsedReplayScope:'data only; no parsed-object identity/cache/freeze claim'};
  flow.accounting=accounting(flow.returnedLedgers,[2,2,1,1,1,1,0]);
  exactData(flow.accounting,{returnedLedgerSourceCompilations:69,returnedLedgerBindingObservations:846,returnedLedgerD1:2538,
    knownAvailableSourceCompilations:78,knownAvailableBindingObservations:936,knownAvailableD1:2808,availableTranslationInitialFaces:7,standaloneSketches:2,
    publicRefusalReportScope:'contact dimensions only; no invented failed-frame ledgers',fullTransitiveNativeCoverage:'NOT_MEASURED'});
  const combined=emptyLedgers();for(const key of Object.keys(combined))combined[key]=[...source.returnedLedgers[key],...flow.returnedLedgers[key]];
  const actual=accounting(combined,[4,4,4,4,4,4,1]);flow.campaignAccounting={...actual,
    wholeDerivedSourceCompilations:actual.knownAvailableSourceCompilations+source.refusedSourceDerivedWork.sourceCompilations,
    wholeDerivedBindingObservations:actual.knownAvailableBindingObservations+source.refusedSourceDerivedWork.bindingObservations,
    wholeDerivedD1:actual.knownAvailableD1+source.refusedSourceDerivedWork.totalD1,
    refusedDerivedSourceCompilations:source.refusedSourceDerivedWork.sourceCompilations,refusedDerivedBindingObservations:source.refusedSourceDerivedWork.bindingObservations,refusedDerivedD1:source.refusedSourceDerivedWork.totalD1,
    refusedWorkScope:'source-derived call paths only; failed public frames expose no complete Native reports'};
  exactData(Object.fromEntries(Object.keys(EXPECTED_TOTALS).map(key=>[key,flow.campaignAccounting[key]])),EXPECTED_TOTALS);
  flow.campaignModelCalls=source.modelCalls+flow.modelCalls;flow.campaignTessellations=source.tessellations+flow.tessellations;exactData([flow.campaignModelCalls,flow.campaignTessellations],[6,1]);exactData([flow.modelCalls,flow.tessellations],[1,0]);
  assert.equal(flow.stages.length,1);assert.equal(flow.stages[0].outcome,'returned');finish();console.log(signedData({status:flow.status,campaignModelCalls:6,campaignTessellations:1,accounting:flow.campaignAccounting}));
}catch(error){fail(error);throw error;}
