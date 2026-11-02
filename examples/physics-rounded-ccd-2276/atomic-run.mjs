import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {makeModel,dynamicPart,staticPart} from '../physics-model-input/model.mjs';
const out=new URL('./evidence/atomic-01/',import.meta.url);mkdirSync(out,{recursive:false});const results=[];
for(const graph of ['source','native']){
 const api=graph==='source'?await import('./build/source.mjs'):{...await import('../../packages/barocss-physics/dist/index.js'),...await import('../../packages/barocss-physics/dist/replay.js')};
 const model=makeModel({gravityMps2:[0,0,0],parts:[dynamicPart('sphere',{kind:'sphere',radiusM:.1},{positionM:[-.3,.15,0],velocityMps:[36,0,0]},1,{ccd:true}),staticPart('box',{kind:'box',halfExtentsM:[.1,.1,.1]},{positionM:[0,0,0]})]}),options={profile:'rigid-discrete-v1',fixedStepSeconds:1/60,broadPhase:'direct'},world=api.createPhysicsWorld(model,options),r=api.createPhysicsRecorder(world);
 try{const before={state:r.getState(),log:r.saveRecording()},original=Math.sqrt,marker=new Error('ROUNDED_CCD_INTERNAL_FAILURE');let stack;
   Math.sqrt=()=>{stack=new Error().stack;throw marker;};try{assert.throws(()=>r.step(),error=>error===marker);}finally{Math.sqrt=original;}
   const refused={state:r.getState(),log:r.saveRecording()};assert.deepEqual(refused,before);assert(stack.includes('sweepRoundedBox'));
   const recovery=r.step();assert(Math.abs(recovery.ccdHits[0].toiFraction-.1889957660359269)<1e-12);
   const result={graph,status:'PASS',sameErrorObject:true,stack,before,refused,recovery};writeFileSync(new URL(graph+'.json',out),JSON.stringify(result,null,2)+'\n',{flag:'wx'});results.push({graph,status:'PASS',worlds:1,acceptedSteps:1,unknownRefusals:1});
 }finally{r.dispose();world.dispose();}
}
writeFileSync(new URL('summary.json',out),JSON.stringify({status:'PASS_CCD_UNKNOWN_ATOMICITY',results},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PASS_CCD_UNKNOWN_ATOMICITY',results}));
