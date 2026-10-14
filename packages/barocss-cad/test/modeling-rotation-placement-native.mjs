import assert from 'node:assert/strict';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULTS,EDITED,placedRail,placedRectangle,placedGusset,proveSnapshot,proveRefusal,provePreview,work,
  hold,unchanged,snapshotData,signedData,sha256,dataHash,exactData,accounting,recorder } from './modeling-rotation-placement-fixture.mjs';

// Frozen source campaign: six model calls and two previews, not an open matrix.
// Raw complete outputs/errors precede oracles. Never overwrite or auto-rerun.
assert.ok(process.env.CAD_MODEL_TEST_MODULE);assert.ok(process.env.CAD_MODEL_EVIDENCE_DIR);
const entry=resolve(process.env.CAD_MODEL_TEST_MODULE),directory=resolve(process.env.CAD_MODEL_EVIDENCE_DIR);
const {flow,artifact,stage,fail,finish}=recorder('source',entry,directory);
try{
  const {cad,CadModelError,tessellateConvexPlanarSolid}=await import(pathToFileURL(entry).href);
  const baseline=stage('modelCalls','1 front1/back2 rail rotatex90 translate[40,16,0]',placedRail(cad).build,'01-baseline.snapshot.json');
  artifact('initial.cad-model.json',baseline.save(),'actual authored baseline for cold reconstruction',true);
  const held=[[baseline,hold(baseline)]];work(baseline,[],[0,1,2,3,4,5]);flow.baseline=proveSnapshot(baseline,DEFAULTS);
  flow.baselineSnapshotSHA256=dataHash(snapshotData(baseline));flow.baselineBodiesSHA256=dataHash(baseline.bodies);flow.baselineEvidenceSHA256=dataHash(baseline.evidence);
  artifact('baseline.transforms.json',baseline.evidence.slice(-2).map(e=>e.native),'complete rotation and translation parent,target,eight-class lineages and reports');
  const previews={
    original:stage('tessellations','original genuine20 triangle preview',()=>tessellateConvexPlanarSolid(baseline.bodies.original.native,{maximumFanTriangles:40}),'baseline-original.preview.json'),
    placed:stage('tessellations','placed genuine20 triangle preview',()=>tessellateConvexPlanarSolid(baseline.bodies.placed.native,{maximumFanTriangles:40}),'baseline-placed.preview.json'),
  };
  flow.previews=Object.fromEntries(Object.entries(previews).map(([label,preview])=>[label,provePreview(preview,baseline.bodies[label].native)]));
  const outputIdentities=Object.fromEntries(Object.entries(baseline.bodies).map(([label,body])=>[label,{family:body.family,solidId:body.native.request.options.solidId,sourceIds:body.native.request.assets.map(asset=>asset.sourceId)}]));
  const transfer=artifact('baseline-transfer.json',{...snapshotData(baseline),summary:flow.baseline,previews,outputIdentities,
    lineages:baseline.evidence.slice(-2).map(e=>e.native.lineage),composedLineage:flow.baseline.placement.composedLineage,
    finishingLineage:baseline.evidence.slice(2,4).map(e=>({chamfer:e.native.lineage,split:e.native.split.lineage})),
    bodiesSHA256:flow.baselineBodiesSHA256,basis:'authored XYZ; cardinal rotation then exact translation',
    scope:'actual native three-output packet and original/placed previews; composed lineage is exact identity proof, not persistent naming or Editor/GPU acceptance'},'complete native three-output packet and actual previews');
  if(process.env.CAD_MODEL_TRANSPORT_DIR){const out=resolve(process.env.CAD_MODEL_TRANSPORT_DIR);mkdirSync(out,{recursive:true});const path=resolve(out,'modeling-rotation-placement-baseline-native.json');writeFileSync(path,transfer,{flag:'wx'});assert.equal(sha256(readFileSync(path)),sha256(transfer));flow.transport={path,bytes:Buffer.byteLength(transfer),sha256:sha256(transfer)};}
  const unchangedAll=()=>held.forEach(([snapshot,before])=>unchanged(snapshot,before));
  const edited=stage('modelCalls','2 offsetX56 reuse source and rotation',()=>baseline.withParameters({offsetX:56}),'02-edited.snapshot.json');
  work(edited,[0,1,2,3,4],[5],baseline);flow.edited=proveSnapshot(edited,EDITED);held.push([edited,hold(edited)]);unchangedAll();
  artifact('accepted-edited.cad-model.json',edited.save(),'accepted state before exact representability refusal',true);
  let refusal;
  try{stage('modelCalls','3 offsetX.1 representability refusal after rotated parent validation',()=>edited.withParameters({offsetX:.1}),'03-representability.unexpected.snapshot.json');}catch(error){refusal=error;}
  // The actual error and its full report have already been persisted. This
  // refused helper validated one complete parent before any target Face.
  flow.representability=proveRefusal(refusal,CadModelError,edited);
  flow.returnedLedgers.parents.push({label:'3 refused translation actual parent validation',index:5,report:refusal.cause.report.parentValidation.childNativeWork});
  unchangedAll();
  artifact('after-rejection.accepted.snapshot.json',snapshotData(edited),'accepted save,all three bodies and evidence unchanged after refusal');
  artifact('after-rejection.accepted.cad-model.json',edited.save(),'preserved accepted save',true);
  const recovered=stage('modelCalls','4 offsetX40 recovery from accepted offset56',()=>edited.withParameters({offsetX:40}),'04-recovered.snapshot.json');
  work(recovered,[0,1,2,3,4],[5],edited);flow.recovered=proveSnapshot(recovered,DEFAULTS);unchangedAll();
  exactData(snapshotData(recovered).bodies,snapshotData(baseline).bodies);exactData(recovered.evidence,baseline.evidence);assert.equal(recovered.save(),baseline.save());
  const rectangle=stage('modelCalls','5 rectanglefrom3 rotatey-90 translate signedzeros',placedRectangle(cad).build,'05-rectangle.snapshot.json');
  work(rectangle,[],[0,1,2,3]);flow.rectangle=proveSnapshot(rectangle,{},'rectangle');
  const gusset=stage('modelCalls','6 constrained gusset rotatez90 translate[-48,-16,8]',placedGusset(cad).build,'06-gusset.snapshot.json');
  work(gusset,[],[0,1,2,3]);flow.gusset=proveSnapshot(gusset,{width:40,height:24},'gusset');unchangedAll();
  exactData([flow.modelCalls,flow.tessellations],[6,2]);assert.equal(flow.stages.filter(s=>s.outcome==='threw').length,1);
  flow.accounting=accounting(flow.returnedLedgers,[3,3,1,1,9,8,8,2]);
  exactData(flow.accounting,{returnedLedgerSourceCompilations:240,returnedLedgerBindingObservations:2970,returnedLedgerD1:8910,
    knownSourceCompilations:299,combinedBindingObservations:3690,knownD1:11070,initialFaceConstructionCount:56,fullTransitiveNativeCoverage:'NOT_MEASURED'});
  exactData([flow.baseline,flow.edited,flow.recovered,flow.rectangle,flow.gusset].map(s=>s.volumesMM3),[
    {original:6064,middle:6064,placed:6064},{original:6064,middle:6064,placed:6064},{original:6064,middle:6064,placed:6064},
    {original:6144,middle:6144,placed:6144},{original:6912,middle:6912,placed:6912}]);
  finish();console.log(signedData({status:flow.status,modelCalls:flow.modelCalls,tessellations:flow.tessellations,accounting:flow.accounting}));
}catch(error){fail(error);throw error;}
