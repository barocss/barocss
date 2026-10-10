import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {runReferenceControls,restingReferenceInput} from './reference-controls.mjs';
import {ArchiveError,validateFiles,validateSourcePins,restoreFrame,rawBodies,digest} from './archive.mjs';
import {compareMeasurement} from './compare.mjs';
import {here,root,validateSource} from './bundle.mjs';
export async function controls(m,oracle,input,records){
 const referenceControls=await runReferenceControls(data=>oracle.ask(data));
 const base=structuredClone(restingReferenceInput),prepared=m.preparePair(base.config,base.state),before=structuredClone(base);
 assert.deepEqual(prepared.bodies.map(b=>({id:b.id,positionM:b.positionM,orientation:b.orientation,velocityMps:b.velocityMps,angularVelocityRadps:b.angularVelocityRadps})),base.state.bodies.map(b=>({id:b.id,positionM:b.positionM,orientation:b.orientation,velocityMps:b.velocityMps,angularVelocityRadps:b.angularVelocityRadps})));
 prepared.bodies[0].positionM[0]=999;prepared.joint.anchorALocalM[0]=999;assert.deepEqual(base,before,'metadata/caller copies');
 const rawZero=structuredClone(base);rawZero.state.bodies[0].positionM[2]=-0;const zeroPair=m.preparePair(rawZero.config,rawZero.state);assert.ok(Object.is(zeroPair.bodies[0].positionM[2],-0),'parse must preserve restored zero sign');assert.deepEqual(rawZero.state.bodies[0].orientation,zeroPair.bodies[0].orientation);
 const math=m.inspectPair(base.config,base.state),ref=await oracle.ask(base);assert.equal(compareMeasurement(math,ref).agree,true);const detached=structuredClone(math);math.anchorAM[0]=999;assert.deepEqual(m.inspectPair(base.config,base.state),detached,'measurement output copies');
 const badRef=structuredClone(ref);badRef.raw.relativeAngleRad=null;assert.equal(compareMeasurement(detached,badRef).agree,false,'null numeric must not coerce to zero');assert.equal(compareMeasurement(detached,null).agree,false);
 const typed=[];
 for(const [name,edit,message]of [
  ['null-config',x=>{x.config=null;},m.PAIR_MESSAGE],['null-state',x=>{x.state=null;},m.PAIR_MESSAGE],
  ['missing-joint',x=>{x.state.joints=[];},m.PAIR_MESSAGE],['missing-body',x=>{x.state.bodies.pop();},m.PAIR_MESSAGE],
  ['wrong-id',x=>{x.state.bodies[0].id='missing';},m.PAIR_MESSAGE],['null-report',x=>{x.state.joints[0].angleRad=null;},m.PAIR_MESSAGE],
  ['null-pose',x=>{x.state.bodies[0].positionM[0]=null;},m.POSE_MESSAGE],['nonfinite-pose',x=>{x.state.bodies[0].velocityMps[0]=NaN;},m.POSE_MESSAGE],
  ['zero-quaternion',x=>{x.state.bodies[0].orientation=[0,0,0,0];},m.POSE_MESSAGE],
  ['sparse-config-body',x=>{delete x.config.bodies[0];},m.PAIR_MESSAGE],['sparse-config-joint',x=>{delete x.config.joints[0];},m.PAIR_MESSAGE],
  ['sparse-state-body',x=>{delete x.state.bodies[0];},m.PAIR_MESSAGE],['nonzero-gravity',x=>{x.config.gravityMps2=[0,-9.81,0];},m.PAIR_MESSAGE],
  ['different-dt-metadata',x=>{x.config.fixedStepSeconds=.01;},m.PAIR_MESSAGE],['explicit-inertia',x=>{x.config.bodies[0].inertiaKgM2=.004;},m.PAIR_MESSAGE],
  ['zero-mass',x=>{x.config.bodies[0].massKg=0;},'massKg must be finite and in [0.000001, 1000000]']
 ]){const changed=structuredClone(base);edit(changed);const saved=structuredClone(changed);assert.throws(()=>m.preparePair(changed.config,changed.state),e=>e instanceof m.PhysicsError&&e.code==='INVALID_CONFIG'&&e.message===message);assert.deepEqual(changed,saved);typed.push({name,code:'INVALID_CONFIG',message});}
 assert.throws(()=>m.projectOnce(base.config,base.state,0),e=>e instanceof m.PhysicsError&&e.code==='INVALID_STEP'&&e.message===m.DT_MESSAGE);typed.push({name:'invalid-dt-before-projection',code:'INVALID_STEP',message:m.DT_MESSAGE});
 const archiveControls=[];
 for(const [name,edit,message]of [['manifest',f=>f.set('manifest.json',Buffer.from('{}')),'archive manifest hash mismatch'],['artifact',f=>f.set('source-report.json.gz',Buffer.from('corrupt')),'archive artifact hash mismatch'],['extra-file',f=>f.set('extra.json',Buffer.from('{}')),'archive file set mismatch']]){const files=new Map(input.files);edit(files);assert.throws(()=>validateFiles(files),e=>e instanceof ArchiveError&&e.message===message);archiveControls.push({name,message});}
 await assert.rejects(()=>validateSourcePins(input.parentRoot,Buffer.from('{}'),root),e=>e instanceof ArchiveError&&e.message==='parent source freeze hash mismatch');archiveControls.push({name:'parent-source-pin',message:'parent source freeze hash mismatch'});
 const frozen=JSON.parse(await readFile(resolve(here,'frozen-source.json')));await assert.rejects(()=>validateSource({...frozen,'adapter.ts':'0'.repeat(64)}),e=>e.code==='ERR_ASSERTION'&&e.message.includes('source drift: adapter.ts'));archiveControls.push({name:'own-source-drift'});
 const selected=records[0],state=structuredClone(selected.state),ids=state.bodies.map(b=>b.id),bytes=rawBodies(state.bodies);
 const refuse=(name,changed,raw,message)=>{assert.throws(()=>restoreFrame(changed,raw,ids,selected.step),e=>e instanceof ArchiveError&&e.message===message);archiveControls.push({name,message});};
 refuse('raw-length',state,bytes.subarray(0,-1),'raw frame length mismatch');const nonfinite=Buffer.from(bytes);nonfinite.writeDoubleLE(NaN,0);refuse('raw-nonfinite',state,nonfinite,'archive raw field nonfinite or out of bounds');
 const nullValue=structuredClone(state);nullValue.bodies[0].positionM[0]=null;refuse('JSON-null-number',nullValue,bytes,'archive JSON/raw field mismatch');const wrongID=structuredClone(state);wrongID.bodies[0].id='missing';refuse('raw-IDs',wrongID,bytes,'archive body IDs mismatch');refuse('raw-null-state',null,bytes,'archive state object required');
 const copy=restoreFrame(state,bytes,ids,selected.step);copy.bodies[0].positionM[0]=999;assert.deepEqual(restoreFrame(state,bytes,ids,selected.step),state,'raw restoration copied');assert.equal(digest(rawBodies(state.bodies)),selected.rawSha256);
 return {referenceControls,typed,archiveControls,inputOutputCopies:true,restoredSignedZero:true,nullGuard:true,projectionCallsInControls:0,worldCreated:false,worldStepped:false};
}
