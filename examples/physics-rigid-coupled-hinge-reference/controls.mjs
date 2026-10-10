import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ArchiveError,validateFiles,restoreFrame,rawBodies,digest} from './archive.mjs';
import {here,validateSource} from './bundle.mjs';
import {runReferenceControls} from './reference-controls.mjs';
export async function controls(m,oracle,input){
 const base=structuredClone(input.records[0]),typed=[];
 const cases=[
 ['dt-first',x=>{x.config=null;x.state=null;x.dt=0;},'INVALID_STEP',m.ERRORS.dt],
 ['null-config',x=>{x.config=null;},'INVALID_CONFIG','world must be an object'],
 ['zero-mass',x=>{x.config.bodies[0].massKg=0;},'INVALID_CONFIG','massKg must be finite and in [0.000001, 1000000]'],
 ['sparse-config-body',x=>{delete x.config.bodies[0];},'INVALID_CONFIG',m.ERRORS.profile],
 ['sparse-config-joint',x=>{delete x.config.joints[0];},'INVALID_CONFIG','joints must be a dense array of at most 8'],
 ['nonzero-gravity',x=>{x.config.gravityMps2=[0,-9.81,0];},'INVALID_CONFIG',m.ERRORS.profile],
 ['different-metadata-dt',x=>{x.config.fixedStepSeconds=.01;},'INVALID_CONFIG',m.ERRORS.profile],
 ['explicit-inertia',x=>{x.config.bodies[0].inertiaKgM2=.004;},'INVALID_CONFIG',m.ERRORS.profile],
 ['null-state',x=>{x.state=null;},'NUMERIC_LIMIT',m.ERRORS.pose],
 ['sparse-state-body',x=>{delete x.state.bodies[0];},'NUMERIC_LIMIT',m.ERRORS.pose],
 ['missing-body',x=>{x.state.bodies.pop();},'NUMERIC_LIMIT',m.ERRORS.pose],
 ['missing-joint',x=>{x.state.joints=[];},'NUMERIC_LIMIT',m.ERRORS.pose],
 ['wrong-ID',x=>{x.state.bodies[0].id='missing';},'NUMERIC_LIMIT',m.ERRORS.pose],
 ['null-report',x=>{x.state.joints[0].angleRad=null;},'NUMERIC_LIMIT',m.ERRORS.pose],
 ['null-number',x=>{x.state.bodies[0].positionM[0]=null;},'NUMERIC_LIMIT',m.ERRORS.pose],
 ['nonfinite-number',x=>{x.state.bodies[0].velocityMps[0]=NaN;},'NUMERIC_LIMIT',m.ERRORS.pose],
 ['zero-quaternion',x=>{x.state.bodies[0].orientation=[0,0,0,0];},'NUMERIC_LIMIT',m.ERRORS.pose],
 ['sparse-vector',x=>{delete x.state.bodies[0].velocityMps[0];},'NUMERIC_LIMIT',m.ERRORS.pose],
 ['cursor',x=>{x.state.stepIndex=-1;},'NUMERIC_LIMIT',m.ERRORS.pose],
 ['time',x=>{x.state.timeSeconds=0;},'NUMERIC_LIMIT',m.ERRORS.pose],
 ['null-unused-metadata',x=>{x.state.events=[null];},'NUMERIC_LIMIT',m.ERRORS.pose],
 ['original-output-bounds',x=>{for(const body of x.state.bodies){body.positionM=[10000,0,0];body.orientation=[0,0,0,1];}x.state.joints[0].angleRad=0;},'NUMERIC_LIMIT','pairB0 position exceeded bounds'],
 ];
 for(const [name,edit,code,message]of cases){const changed={config:structuredClone(base.config),state:structuredClone(base.state),dt:1/120};edit(changed);const saved=structuredClone(changed);assert.throws(()=>m.projectCoupledHingeCandidate(changed.config,changed.state,changed.dt),error=>error instanceof m.PhysicsError&&error.code===code&&error.message===message,name);assert.deepEqual(changed,saved,'refusal input retained');typed.push({name,code,message});}
 const thrown={unknown:true},config=structuredClone(base.config);Object.defineProperty(config,'fixedStepSeconds',{get(){throw thrown;},enumerable:true});assert.throws(()=>m.projectCoupledHingeCandidate(config,base.state,1/120),error=>error===thrown);typed.push({name:'unknown-getter-identity',propagated:true});
 const archive=[];
 for(const [name,edit,message]of [['manifest',f=>f.set('manifest.json',Buffer.from('{}')),'archive manifest hash mismatch'],['artifact',f=>f.set('source-report.json.gz',Buffer.from('corrupt')),'archive artifact hash mismatch'],['extra-file',f=>f.set('extra.json',Buffer.from('{}')),'archive file set mismatch']]){const files=new Map(input.files);edit(files);assert.throws(()=>validateFiles(files),error=>error instanceof ArchiveError&&error.message===message);archive.push({name,message});}
 const bytes=rawBodies(base.state.bodies),ids=base.state.bodies.map(body=>body.id);
 for(const [name,edit,message]of [['raw-length',()=>bytes.subarray(0,-1),'raw frame length mismatch'],['raw-nonfinite',()=>{const copy=Buffer.from(bytes);copy.writeDoubleLE(NaN,0);return copy;},'archive raw field nonfinite or out of bounds']]){assert.throws(()=>restoreFrame(base.state,edit(),ids,base.step),error=>error instanceof ArchiveError&&error.message===message);archive.push({name,message});}
 const nullState=structuredClone(base.state);nullState.bodies[0].positionM[0]=null;assert.throws(()=>restoreFrame(nullState,bytes,ids,base.step),error=>error instanceof ArchiveError&&error.message==='archive JSON/raw field mismatch');archive.push({name:'raw-null-number',message:'archive JSON/raw field mismatch'});
 const pins=JSON.parse(await readFile(resolve(here,'frozen-source.json')));await assert.rejects(()=>validateSource({...pins,'candidate.ts':'0'.repeat(64)}),error=>error.code==='ERR_ASSERTION'&&error.message.includes('source drift: candidate.ts'));archive.push({name:'current-source-drift'});
 const reference=await runReferenceControls(data=>oracle.ask(data));
 return {typed,archive,reference,successfulCandidateCalls:0,expectedOriginalBoundsRefusalCalls:1,worldCreated:false,worldStepped:false,oldProjectionCalled:false};
}
