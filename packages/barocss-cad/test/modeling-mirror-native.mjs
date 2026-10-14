import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULTS, EDITED, mirroredRail, mirroredRectangle, mirroredGusset, proveSnapshot, proveRefusal, provePreview, work,
  hold, unchanged, snapshotData, signedData, sha256, dataHash, exactData, accounting, recorder } from './modeling-mirror-fixture.mjs';

// Frozen source campaign: six model calls and two previews. No automatic rerun.
// Existing receipts refuse overwrite. A reviewed continuation must use retained
// outputs and a separate fixture-only driver for genuinely unspent stages.
assert.ok(process.env.CAD_MODEL_TEST_MODULE); assert.ok(process.env.CAD_MODEL_EVIDENCE_DIR);
const entry=resolve(process.env.CAD_MODEL_TEST_MODULE),directory=resolve(process.env.CAD_MODEL_EVIDENCE_DIR);
const {flow,artifact,stage,fail,finish}=recorder('source',entry,directory);
try {
  const {cad,CadModelError,tessellateConvexPlanarSolid}=await import(pathToFileURL(entry).href);
  const baseline=stage('modelCalls','1 front1/back2 rail XZ reflection',mirroredRail(cad).build,'01-baseline.snapshot.json');
  artifact('initial.cad-model.json',baseline.save(),'actual authored baseline for cold reconstruction',true);
  const held=[[baseline,hold(baseline)]];work(baseline,[],[0,1,2,3,4]);flow.baseline=proveSnapshot(baseline,DEFAULTS);
  flow.baselineSnapshotSHA256=dataHash(snapshotData(baseline));flow.baselineBodiesSHA256=dataHash(baseline.bodies);flow.baselineEvidenceSHA256=dataHash(baseline.evidence);
  artifact('baseline.mirror.json',baseline.evidence[4].native,'complete parent,target,lineage and reports');
  const previews={
    original:stage('tessellations','original genuine20 triangle preview',()=>tessellateConvexPlanarSolid(baseline.bodies.original.native,{maximumFanTriangles:40}),'baseline-original.preview.json'),
    mirrored:stage('tessellations','mirrored genuine20 triangle preview',()=>tessellateConvexPlanarSolid(baseline.bodies.mirrored.native,{maximumFanTriangles:40}),'baseline-mirrored.preview.json'),
  };
  // Both raw packets exist before either oracle. No helper calls a provider.
  flow.previews=Object.fromEntries(Object.entries(previews).map(([name,p])=>[name,provePreview(p,baseline.bodies[name].native)]));
  const outputIdentities=Object.fromEntries(Object.entries(baseline.bodies).map(([name,body])=>[name,{family:body.family,solidId:body.native.request.options.solidId,sourceIds:body.native.request.assets.map(a=>a.sourceId)}]));
  const transfer=artifact('baseline-transfer.json',{...snapshotData(baseline),summary:flow.baseline,previews,outputIdentities,
    lineage:baseline.evidence[4].native.lineage,finishingLineage:baseline.evidence.slice(2,4).map(e=>({chamfer:e.native.lineage,split:e.native.split.lineage})),
    bodiesSHA256:flow.baselineBodiesSHA256,basis:'authored XYZ; world-origin plane reflection',scope:'actual native outputs and two previews; later zero-native receiver replay; no editor/GPU acceptance'},'complete native two-output packet and actual previews');
  if(process.env.CAD_MODEL_TRANSPORT_DIR){const out=resolve(process.env.CAD_MODEL_TRANSPORT_DIR);mkdirSync(out,{recursive:true});const path=resolve(out,'modeling-mirror-baseline-native.json');writeFileSync(path,transfer,{flag:'wx'});assert.equal(sha256(readFileSync(path)),sha256(transfer));flow.transport={path,bytes:Buffer.byteLength(transfer),sha256:sha256(transfer)};}
  const unchangedAll=()=>held.forEach(([snapshot,before])=>unchanged(snapshot,before));
  const edited=stage('modelCalls','2 backDistance3 from accepted baseline',()=>baseline.withParameters({backDistance:3}),'02-edited.snapshot.json');
  work(edited,[0,1,2],[3,4],baseline);flow.edited=proveSnapshot(edited,EDITED);held.push([edited,hold(edited)]);unchangedAll();
  artifact('accepted-edited.cad-model.json',edited.save(),'accepted state before refused selection edit',true);
  let refusal;
  try{stage('modelCalls','3 backY0 selection refusal before second chamfer provider',()=>edited.withParameters({backY:0}),'03-selection.unexpected.snapshot.json');}catch(error){refusal=error;}
  flow.selection=proveRefusal(refusal,CadModelError);unchangedAll();
  artifact('after-rejection.accepted.snapshot.json',snapshotData(edited),'accepted save,body and evidence unchanged after refusal');
  artifact('after-rejection.accepted.cad-model.json',edited.save(),'preserved accepted save',true);
  const recovered=stage('modelCalls','4 backDistance2 from accepted edit',()=>edited.withParameters({backDistance:2}),'04-recovered.snapshot.json');
  work(recovered,[0,1,2],[3,4],edited);flow.recovered=proveSnapshot(recovered,DEFAULTS);unchangedAll();
  exactData(snapshotData(recovered).bodies,snapshotData(baseline).bodies);exactData(recovered.evidence,baseline.evidence);assert.equal(recovered.save(),baseline.save());
  const rectangle=stage('modelCalls','5 independent placedfrom3 rectangle XY reflection',mirroredRectangle(cad).build,'05-rectangle.snapshot.json');
  work(rectangle,[],[0,1,2]);flow.rectangle=proveSnapshot(rectangle,{},'rectangle');
  const gusset=stage('modelCalls','6 independent constrained gusset YZ reflection',mirroredGusset(cad).build,'06-gusset.snapshot.json');
  work(gusset,[],[0,1,2]);flow.gusset=proveSnapshot(gusset,{width:40,height:24},'gusset');unchangedAll();
  exactData([flow.modelCalls,flow.tessellations],[6,2]);assert.equal(flow.stages.filter(s=>s.outcome==='threw').length,1);
  flow.accounting=accounting(flow.returnedLedgers,[3,3,1,3,5,5,5,2]);
  exactData(flow.accounting,{returnedLedgerSourceCompilations:260,returnedLedgerBindingObservations:3186,returnedLedgerD1:9558,knownSourceCompilations:299,combinedBindingObservations:3654,knownD1:10962,initialFaceConstructionCount:36,fullTransitiveNativeCoverage:'NOT_MEASURED'});
  exactData([flow.baseline,flow.edited,flow.recovered,flow.rectangle,flow.gusset].map(s=>s.volumesMM3),[{original:6064,mirrored:6064},{original:5984,mirrored:5984},{original:6064,mirrored:6064},{original:6144,mirrored:6144},{original:6912,mirrored:6912}]);
  finish();console.log(signedData({status:flow.status,modelCalls:flow.modelCalls,tessellations:flow.tessellations,accounting:flow.accounting}));
}catch(error){fail(error);throw error;}
