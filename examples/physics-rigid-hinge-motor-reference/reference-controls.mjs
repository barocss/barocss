import assert from 'node:assert/strict';
import {restInput} from './fixtures.mjs';
import {rawBodies,rawCommands} from './raw.mjs';

// Bounded reference/protocol data only. No native candidate/provider/motor,
// World, old93 cases or fabricated actual output is called by these controls.
export const referenceErrors=Object.freeze({input:'hinge motor reference input is invalid',json:'hinge motor reference line must be valid JSON'});
const ENVELOPE=['ok','resolved','executionFailure','referenceStatus','metrics','reference','violations','error'];
const clone=structuredClone;
function exact(value,names){assert.ok(value!==null&&typeof value==='object'&&!Array.isArray(value));assert.deepEqual(Object.keys(value).sort(),[...names].sort());}
function prediction(){const input=restInput();return {op:'evaluate',...input,commandsRawHex:rawCommands(input.commands).toString('hex'),outcome:'prediction',attempt:null,output:null,error:null,
  rawFrames:{source:rawBodies(input.carrier.bodies).toString('hex'),angular:null,motor:null,free:null,projected:null}};}
async function call(ask,input){const saved=clone(input),reply=await ask(input);assert.deepEqual(input,saved,'reference input copy');exact(reply,ENVELOPE);return reply;}
function qualified(reply){assert.equal(reply.ok,true);assert.equal(reply.resolved,true);assert.equal(reply.executionFailure,false);assert.equal(reply.error,null);assert.deepEqual(reply.violations,[]);}
export const protocolControlIds=Object.freeze(['unknown-op','extra-request-key','missing-outcome','unknown-outcome','null-config','null-carrier','boolean-dt','null-dt',
  'null-memory','boolean-memory','boolean-cursor','cursor-outside','wrong-carrier-ID','null-body-vector','boolean-body-component','null-source-raw','truncated-source-raw','invalid-source-hex',
  'raw-JSON-mismatch','extra-raw-label','null-commands','null-command-raw','command-raw-length','unknown-command-kind','boolean-command-component',
  'null-attempt-return','prediction-output-forgery','prediction-extra-stage-raw']);

export async function runReferenceControls(ask,{askRaw}={}){
  assert.equal(typeof ask,'function');const receipts=[];let requests=0;
  const base=prediction(),reply=await call(ask,base);requests++;qualified(reply);assert.equal(reply.referenceStatus,'RETURN','selected REST prediction');
  assert.equal(reply.metrics.actualCompared,false);assert.equal(reply.metrics.checks.parentActualQualified,null);
  assert.equal(reply.reference.parent.mode,'prediction');assert.equal(reply.reference.expectedRefusal,null);
  assert.equal(reply.reference.stage,'report-ready');assert.deepEqual(reply.reference.calls,{motorCalls:1,projectionCalls:1});
  for(const label of ['source','angular','motor','free','projected'])assert.equal(reply.metrics.frameErrors[label],null,'no actual frame seeded from prediction');
  receipts.push({id:'rest-input-only-prediction',kind:'REFERENCE_PREDICTION',reply,nativeCandidateCalls:0,nativeMotorCalls:0,nativeProjectionCalls:0,worldCalls:0});
  const original=clone(reply);reply.reference.frames.sourceBodies[0].positionM[0]=123;reply.reference.work.motorMidpointJ=999;
  const repeated=await call(ask,base);requests++;assert.deepEqual(repeated,original,'fresh cold reference reply is isolated from caller output mutation');
  receipts[0].reply=original;receipts.push({id:'reference-output-copy-and-input-repeat',kind:'REFERENCE_COPY',reply:repeated,nativeCandidateCalls:0});
  const badCommand=()=>{const x=clone(base);x.commands=[{kind:'angularImpulse',bodyId:'pairB0',angularImpulseNms:[0,0,.001]}];x.commandsRawHex=rawCommands(x.commands).toString('hex');return x;};
  const controls=[
    ['unknown-op',()=>({...clone(base),op:'unknown'})],['extra-request-key',()=>({...clone(base),extra:0})],['missing-outcome',()=>{const x=clone(base);delete x.outcome;return x;}],
    ['unknown-outcome',()=>({...clone(base),outcome:'accepted'})],['null-config',()=>({...clone(base),config:null})],['null-carrier',()=>({...clone(base),carrier:null})],
    ['boolean-dt',()=>({...clone(base),dt:false})],['null-dt',()=>({...clone(base),dt:null})],
    ['null-memory',()=>{const x=clone(base);x.carrier.joints[0].angleRad=null;return x;}],['boolean-memory',()=>{const x=clone(base);x.carrier.joints[0].angleRad=false;return x;}],
    ['boolean-cursor',()=>{const x=clone(base);x.carrier.stepIndex=false;return x;}],['cursor-outside',()=>{const x=clone(base);x.carrier.stepIndex=3601;return x;}],
    ['wrong-carrier-ID',()=>{const x=clone(base);x.carrier.bodies[0].id='absent';return x;}],['null-body-vector',()=>{const x=clone(base);x.carrier.bodies[0].velocityMps=null;return x;}],
    ['boolean-body-component',()=>{const x=clone(base);x.carrier.bodies[0].positionM[0]=false;return x;}],
    ['null-source-raw',()=>{const x=clone(base);x.rawFrames.source=null;return x;}],['truncated-source-raw',()=>{const x=clone(base);x.rawFrames.source='00';return x;}],
    ['invalid-source-hex',()=>{const x=clone(base);x.rawFrames.source='g'.repeat(416);return x;}],['raw-JSON-mismatch',()=>{const x=clone(base);x.carrier.bodies[0].positionM[0]=1;return x;}],
    ['extra-raw-label',()=>{const x=clone(base);x.rawFrames.final=null;return x;}],['null-commands',()=>({...clone(base),commands:null})],['null-command-raw',()=>({...clone(base),commandsRawHex:null})],
    ['command-raw-length',()=>{const x=badCommand();x.commandsRawHex='00';return x;}],['unknown-command-kind',()=>{const x=badCommand();x.commands[0].kind='unknown';return x;}],
    ['boolean-command-component',()=>{const x=badCommand();x.commands[0].angularImpulseNms[0]=false;return x;}],
    ['null-attempt-return',()=>({...clone(base),outcome:'returned'})],['prediction-output-forgery',()=>({...clone(base),output:{}})],
    ['prediction-extra-stage-raw',()=>{const x=clone(base);x.rawFrames.angular=x.rawFrames.source;return x;}],
  ];
  assert.deepEqual(controls.map(x=>x[0]),protocolControlIds);
  for(const [id,make] of controls){const result=await call(ask,make());requests++;assert.equal(result.ok,false,id);assert.equal(result.resolved,false,id);assert.equal(result.executionFailure,true,id);
    assert.equal(result.referenceStatus,'UNRESOLVED',id);assert.equal(result.metrics,null,id);assert.equal(result.reference,null,id);assert.deepEqual(result.violations,[],id);
    assert.deepEqual(result.error,{code:'REFERENCE_INPUT',message:referenceErrors.input},id);receipts.push({id,kind:'REFERENCE_PROTOCOL',reply:result,nativeCandidateCalls:0});}
  let rawJsonRequests=0;
  if(askRaw!==undefined){assert.equal(typeof askRaw,'function');const result=await askRaw('{');requests++;rawJsonRequests++;
    exact(result,ENVELOPE);assert.equal(result.ok,false);assert.equal(result.resolved,false);assert.equal(result.executionFailure,true);assert.equal(result.referenceStatus,'UNRESOLVED');
    assert.equal(result.metrics,null);assert.equal(result.reference,null);assert.deepEqual(result.violations,[]);assert.deepEqual(result.error,{code:'REFERENCE_JSON',message:referenceErrors.json});
    receipts.push({id:'actual-invalid-json-line',kind:'REFERENCE_JSON_PROTOCOL',reply:result,nativeCandidateCalls:0});}
  return {receipts,referenceRequests:requests,predictionRequests:2,protocolRequests:controls.length+rawJsonRequests,rawJsonRequests,nativeCandidateCalls:0,nativeMotorCalls:0,nativeProjectionCalls:0,
    worldCalls:0,parent93Replayed:false,inputCopyIsolation:true,outputCopyIsolation:true,actualProducerOutputsFabricated:false};
}
export const referenceControls=runReferenceControls;
