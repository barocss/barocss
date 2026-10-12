import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync,readFileSync,statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { configurableRail,proveFinishes,proveSuppressionPreflight,work,bodyHash } from './modeling-suppression-fixture.mjs';
assert.ok(process.execArgv.includes('--no-opt'));
const entry=resolve(process.env.CAD_MODEL_TEST_MODULE??new URL('../dist/index.js',import.meta.url).pathname);
const {cad,CadModelError,ConvexPlanarSolidChamferError,tessellateConvexPlanarSolid}=await import(pathToFileURL(entry).href);
const directory=resolve(process.env.CAD_MODEL_EVIDENCE_DIR??new URL('./modeling-suppression-evidence',import.meta.url).pathname);mkdirSync(directory,{recursive:true});
const flow={status:'running',modelCalls:0,tessellations:0,stages:[],fullTransitiveNativeCoverage:'NOT_MEASURED',reportScope:'Model feature indices only; disabled finishes retain genuine validated candidates, with no native savings claim',entrySHA256:createHash('sha256').update(readFileSync(entry)).digest('hex')};
const write=()=>writeFileSync(resolve(directory,'source-flow.json'),JSON.stringify(flow,null,2)+'\n');
const disk=()=>{const d=statfsSync(directory);assert.ok(d.bavail*d.bsize>=500*1024*1024);};
const stage=(label,action)=>{disk();assert.ok(++flow.modelCalls<=6);flow.pending=label;write();const start=performance.now(),result=action();flow.stages.push({label,elapsedMS:performance.now()-start,...(result?{recomputation:result.recomputation}:{})});flow.pending=null;write();return result;};
const errorData=error=>error instanceof Error?{name:error.name,code:error.code,operation:error.operation,stage:error.stage,entity:error.entity,message:error.message,stack:error.stack,cause:errorData(error.cause)}:error;
try {
  const initial=stage('both named finishes active',configurableRail(cad).build),initialText=initial.save();
  work(initial,[],[0,1,2,3,4]);flow.baseline=proveFinishes(initial,false,false,3032);flow.initialBodySHA256=bodyHash(initial);
  flow.preNativeControls=proveSuppressionPreflight(initial,CadModelError);
  writeFileSync(resolve(directory,'initial.cad-model.json'),initialText);
  disk();flow.tessellations++;write();const body=initial.bodies.negative,result=tessellateConvexPlanarSolid(body,{maximumFanTriangles:40});
  assert.ok(result.report.triangleCount>0);flow.display={side:'negative',triangles:result.report.triangleCount,nativeAuthority:result.report.nativeAuthority};
  const prior=JSON.parse(readFileSync(new URL('./modeling-chamfer-split-evidence/source-flow.json',import.meta.url),'utf8'));
  flow.literalPredecessorBodyParity=flow.initialBodySHA256===prior.initialBodySHA256;
  if(process.env.CAD_MODEL_TRANSPORT_DIR){
    const output=resolve(process.env.CAD_MODEL_TRANSPORT_DIR);mkdirSync(output,{recursive:true});
    const component={role:'negative',mesh:result.mesh,boundaries:result.boundaries,internalDiagonals:result.internalDiagonals,report:result.report,
      lineage:{kind:'model-output',name:'negative',solidId:body.report.solidId,graph:{vertices:body.graph.vertices,faces:body.graph.faces,edges:body.graph.edges.map(({id,vertexIds,uses})=>({id,vertexIds,uses}))}}};
    const text=JSON.stringify({text:initialText,parameters:initial.parameters,suppression:initial.suppression,features:initial.features,bodySHA256:flow.initialBodySHA256,negativeComponent:component})+'\n';
    assert.ok(Buffer.byteLength(text)<=2*1024*1024);writeFileSync(resolve(output,'baseline-native.json'),text);flow.transfer={bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')};
  }
  const noop=stage('explicit both-false no-op',()=>initial.withSuppression({frontFinish:false,backFinish:false}));
  work(noop,[0,1,2,3,4],[],initial);flow.noop=proveFinishes(noop,false,false,3032);
  for(const side of ['negative','positive'])assert.equal(noop.bodies[side],initial.bodies[side]);
  assert.equal(noop.save(),initialText);assert.equal(bodyHash(noop),flow.initialBodySHA256);flow.noopOwnedIdentityPreserved=true;
  const plain=stage('atomic both finishes disabled',()=>noop.withSuppression({frontFinish:true,backFinish:true}));
  work(plain,[],[0,1,2,3,4],noop);flow.plain=proveFinishes(plain,true,true,3072);
  const front=stage('front restored while back disabled',()=>plain.withSuppression({frontFinish:false})),frontText=front.save(),frontHash=bodyHash(front);
  work(front,[],[0,1,2,3,4],plain);flow.frontOnly=proveFinishes(front,false,true,3064);
  stage('disabled back still refuses non-cardinal selector',()=>{
    assert.throws(()=>front.withParameters({backY:1}),error=>{
      assert.ok(error instanceof CadModelError);assert.equal(error.code,'NATIVE');assert.equal(error.operation,'chamfer');
      assert.ok(error.cause instanceof ConvexPlanarSolidChamferError);assert.equal(error.cause.code,'METRIC');flow.refusal=errorData(error);return true;
    });
    assert.equal(front.save(),frontText);assert.equal(bodyHash(front),frontHash);assert.deepEqual(front.suppression,{frontFinish:false,backFinish:true});
  });
  const restored=stage('restore back from same accepted snapshot after refusal',()=>front.withSuppression({backFinish:false}));
  work(restored,[],[0,1,2,3,4],front);flow.restored=proveFinishes(restored,false,false,3032);
  assert.equal(restored.save(),initialText);assert.equal(bodyHash(restored),flow.initialBodySHA256);
  assert.equal(front.save(),frontText);assert.equal(bodyHash(front),frontHash);assert.equal(initial.save(),initialText);assert.equal(bodyHash(initial),flow.initialBodySHA256);
  flow.futureUseAfterRefusal=true;flow.oldAndNewSnapshotsIndependent=true;flow.editedBodySHA256=bodyHash(restored);
  writeFileSync(resolve(directory,'edited.cad-model.json'),restored.save());
  assert.equal(flow.modelCalls,6);assert.equal(flow.tessellations,1);flow.status='passed';flow.actualGPU='UNRUN';write();
}catch(error){flow.status='failed';flow.failure=errorData(error);write();throw error;}
