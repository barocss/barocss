import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULTS,EDITED,translatedOverlap,proveSnapshot,proveRefusal,provePreview,work,hold,unchanged,snapshotData,
  signedData,sha256,dataHash,exactData,accounting,recorder } from './modeling-translated-intersection-fixture.mjs';

// One frozen source campaign: five models and one preview, no automatic retry.
assert.ok(process.env.CAD_MODEL_TEST_MODULE);assert.ok(process.env.CAD_MODEL_EVIDENCE_DIR);
const entry=resolve(process.env.CAD_MODEL_TEST_MODULE),directory=resolve(process.env.CAD_MODEL_EVIDENCE_DIR);
const {flow,artifact,stage,fail,finish}=recorder('source',entry,directory);
try{
  const {cad,CadModelError,tessellateConvexPlanarSolid}=await import(pathToFileURL(entry).href);
  const baseline=stage('modelCalls','1 translated nonaxis seed offset8 overlap2944',translatedOverlap(cad).build,'01-baseline.snapshot.json');
  artifact('initial.cad-model.json',baseline.save(),'actual authored baseline for cold rebuild',true);
  const held=[[baseline,hold(baseline)]];work(baseline,[],[0,1,2,3,4,5]);flow.baseline=proveSnapshot(baseline,DEFAULTS);
  flow.baselineSnapshotSHA256=dataHash(snapshotData(baseline));flow.baselineBodiesSHA256=dataHash(baseline.bodies);flow.baselineEvidenceSHA256=dataHash(baseline.evidence);
  artifact('baseline.intersection.json',baseline.evidence[5].native,'complete actual translated/direct operands, positive outcome, exact lineage and reports');
  const preview=stage('tessellations','one genuine overlap16triangle preview',()=>tessellateConvexPlanarSolid(baseline.bodies.overlap.native,{maximumFanTriangles:40}),'baseline-overlap.preview.json');
  flow.preview=provePreview(preview,baseline.bodies.overlap.native);
  const unchangedAll=()=>held.forEach(([snapshot,before])=>unchanged(snapshot,before));
  const edited=stage('modelCalls','2 offset16 overlap2304 inventory7to6',()=>baseline.withParameters({offsetX:16}),'02-edited.snapshot.json');
  work(edited,[0,1,2,3],[4,5],baseline);flow.edited=proveSnapshot(edited,EDITED);held.push([edited,hold(edited)]);unchangedAll();
  artifact('accepted-edited.cad-model.json',edited.save(),'accepted state before contact/disjoint refusals',true);
  for(const [label,offsetX,dimension,filename]of [['3 face contact offset40',40,2,'03-contact.unexpected.snapshot.json'],['4 disjoint offset48',48,-1,'04-disjoint.unexpected.snapshot.json']]){
    let failure;try{stage('modelCalls',label,()=>edited.withParameters({offsetX}),filename);}catch(error){failure=error;}
    flow[dimension===2?'contact':'disjoint']=proveRefusal(failure,CadModelError,dimension);unchangedAll();
    // The public error exposes only contactDimension. Do not manufacture the
    // completed translation/empty intersection reports or a failed snapshot.
  }
  artifact('after-rejection.accepted.snapshot.json',snapshotData(edited),'actual accepted full state retained after both public refusals');
  artifact('after-rejection.accepted.cad-model.json',edited.save(),'retained accepted save',true);
  const recovered=stage('modelCalls','5 recoveroffset8 from acceptedoffset16',()=>edited.withParameters({offsetX:8}),'05-recovered.snapshot.json');
  work(recovered,[0,1,2,3],[4,5],edited);flow.recovered=proveSnapshot(recovered,DEFAULTS);unchangedAll();
  exactData(recovered.bodies,baseline.bodies);exactData(recovered.evidence,baseline.evidence);assert.equal(recovered.save(),baseline.save());
  exactData([flow.modelCalls,flow.tessellations],[5,1]);assert.equal(flow.stages.filter(item=>item.outcome==='threw').length,2);
  flow.accounting=accounting(flow.returnedLedgers,[2,2,3,3,3,3,1]);
  exactData(flow.accounting,{returnedLedgerSourceCompilations:156,returnedLedgerBindingObservations:1944,returnedLedgerD1:5832,
    knownAvailableSourceCompilations:179,knownAvailableBindingObservations:2214,knownAvailableD1:6642,availableTranslationInitialFaces:21,standaloneSketches:2,
    publicRefusalReportScope:'contact dimensions only; no invented failed-frame ledgers',fullTransitiveNativeCoverage:'NOT_MEASURED'});
  flow.refusedSourceDerivedWork={sourceCompilations:68,bindingObservations:864,totalD1:2592,
    formula:'each refused offset spends seven-Face translation21/270/810 plus empty intersection13/162/486; two attempts',
    scope:'source-derived call paths only; not observed reports or runtime instrumentation'};
  flow.wholeSourceDerivedWork={sourceCompilations:247,bindingObservations:3078,totalD1:9234,scope:'available reports plus source-derived refused work; hidden transitive work NOT_MEASURED'};
  finish();console.log(signedData({status:flow.status,modelCalls:flow.modelCalls,tessellations:flow.tessellations,accounting:flow.accounting}));
}catch(error){fail(error);throw error;}
