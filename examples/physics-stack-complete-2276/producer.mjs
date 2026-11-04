// One owned producer Worker. Only explicit host credits start actual preparation.
import assert from 'node:assert/strict';
import {parentPort,workerData} from 'node:worker_threads';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fingerprint} from './fingerprint.mjs';
const {provider,native,providerDigest,steps}=workerData;assert.ok(steps===16||steps===1200);
const {prepareStackStep}=await import(pathToFileURL(join(provider,'dist/stack/prepare-step.js')));
const {parseBody}=await import(pathToFileURL(join(provider,'dist/validation.js')));
const {fixture}=await import(pathToFileURL(join(native,'examples/physics-rigid-contact-reference/fixtures.mjs')));
let scene=null,bodies=null,contacts=[],step=0,stopped=false;
function send(id,type,packet,prepareNs='0'){const proof=fingerprint(packet);parentPort.postMessage({id,type,packet,proof,prepareNs});return packet;}
parentPort.on('message',message=>{
 const {id,type}=message;
 if(type==='stop'){stopped=true;return;}
 if(type==='close'){parentPort.close();return;}
 let before=null;
 try{
  assert.ok(!stopped,'producer stopped');
  if(type==='init'){
   assert.ok(['ALIGNED','OFFSET','YAW'].includes(message.scene));if(scene!==null)assert.equal(step,steps);scene=message.scene;step=0;contacts=[];
   bodies=fixture(scene).bodies.map(body=>parseBody(body));const packet=send(id,'initial',{scene,step,providerDigest,bodies});bodies=packet.bodies;return;
  }
  assert.equal(type,'step');assert.ok(bodies);assert.equal(message.step,step+1);assert.ok(message.step<=steps);
  before=structuredClone(bodies);const priorContacts=structuredClone(contacts),start=process.hrtime.bigint(),result=prepareStackStep(bodies,1/120,[0,-9.81,0]),prepareNs=String(process.hrtime.bigint()-start);assert.deepEqual(bodies,before,'producer input mutation');
  const packet=send(id,'packet',{scene,step:message.step,providerDigest,priorBodies:before,priorContacts,prepared:result},prepareNs);
  // Speculative ownership is private; this is never host physical acceptance.
  bodies=packet.prepared.candidateBodies;contacts=packet.prepared.diagnostics.geometryPatches.map(p=>({aId:p.aId,bId:p.bId}));step=message.step;
 }catch(error){
  const failure={scene,step:message.step??0,errorClass:error.name,code:error.code??null,message:String(error.message).slice(0,1024),inputUnchanged:null};
  if(before)try{assert.deepEqual(bodies,before);failure.inputUnchanged=true;}catch(mutation){failure.inputUnchanged=false;failure.inputMutationError=String(mutation.message).slice(0,1024);}
  try{send(id,'failure',{failure,inputBodies:before,diagnostics:error.diagnostics??null});}catch(bound){parentPort.postMessage({id,type:'failure-metadata',failure,diagnosticsUnavailable:true,evidenceError:bound.message});}stopped=true;
 }
});
