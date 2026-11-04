// Root-run pure helper qualification: no World or observer execution.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,realpathSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),[buildId,graph,bankFile,id]=process.argv.slice(2);for(const x of [buildId,id])assert(/^[a-z0-9][a-z0-9-]{0,63}$/.test(x??''));assert(['source','native'].includes(graph));const out=resolve(home,'evidence',id);mkdirSync(out);const pin=b=>({bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});let result={status:'NOT_COMPLETED',WorldCalls:0,candidateCalls:0,graph,rows:[],negativeControls:[]};
try{
 const build=JSON.parse(readFileSync(resolve(home,'evidence',buildId,'result.json')));assert.equal(build.status,'PASS_COUPLED_STATIC_STRICT_DUAL_BUILD');result.buildId=buildId;result.buildResultPin=pin(readFileSync(resolve(home,'evidence',buildId,'result.json')));const frozen=JSON.parse(readFileSync(resolve(home,'evidence',buildId,'frozen.json')));for(const[n,v]of Object.entries(frozen.files))assert.deepEqual(pin(readFileSync(resolve(root,n))),v,'Frozen input '+n);
 const file=realpathSync(resolve(root,bankFile));assert(file.startsWith(home+'/evidence/'));const bytes=readFileSync(file),bank=JSON.parse(bytes);assert.equal(bank.status,'READY_INDEPENDENT_VIRTUAL_IMPULSE_GAUSSIAN_BANK');result.bank={path:file,...pin(bytes)};assert.equal(bank.cases.length,3);
 const api=await import(pathToFileURL(resolve(root,graph==='source'?frozen.sourceBundle:frozen.nativeEntry)));assert.equal(api.phaseHistory().counts.worlds,0);
 for(const row of bank.cases){const actual=api.coupledStaticTarget(row.input);result.candidateCalls++;result.rows.push({id:row.id,input:row.input,actual});writeFileSync(resolve(out,row.id+'-actual.json'),JSON.stringify(result.rows.at(-1),null,2)+'\n',{flag:'wx'});assert.equal(actual.status,row.expectedStatus);assert.deepEqual(actual.certificate.physicalK,row.independentK);assert.deepEqual(actual.certificate.exactImpulseNs,row.exactImpulseNs);assert.equal(actual.certificate.exactNormalNs,row.exactNormalNs);assert.deepEqual(actual.certificate.exactTangentNs,row.exactTangentNs);assert.equal(actual.certificate.exactConeMarginSquared,row.exactConeMarginSquared);if(actual.status==='STATIC_TARGET'){assert.deepEqual(actual.worldImpulseNs,row.expectedWorldImpulseNs);assert.equal(actual.normalNs,row.expectedNormalNs);assert.deepEqual(actual.tangentNs,row.expectedTangentNs);}}
 const base=bank.cases[0].input,controls=[
 ['zero_quaternion',x=>{x.orientationXYZW=[0,0,0,0];},'ZERO_QUATERNION'],
 ['wrong_native_normal',x=>{x.nativeNormalDirection=['0/1','1/1','0/1'];},'NATIVE_NORMAL_CORRESPONDENCE'],
 ['nonexact_native_point',x=>{x.nativePointExact[0]='-249999999999999999/1000000000000000000';},'NATIVE_POINT_PRESENTATION_NOT_EXACT'],
 ['mass_profile_mismatch',x=>{x.massKg=2;},'OUTSIDE_STATIC_UNIT_CUBE_PROFILE'],
 ['non_unit_cube_inertia_profile',x=>{x.halfExtentsM[0]=.75;},'OUTSIDE_STATIC_UNIT_CUBE_PROFILE'],
 ['nonzero_free_spin',x=>{x.freeAngularVelocityRadps=[1,0,0];},'OUTSIDE_STATIC_UNIT_CUBE_PROFILE'],
 ['nonfinite_input',x=>{x.freeVelocityMps[0]=NaN;},'INPUT_SHAPE'],
 ['separating_target',x=>{x.freeVelocityMps=x.freeVelocityMps.map(v=>-v);},'SEPARATING_TARGET_NOT_QUALIFIED']
 ];
 const represented=x=>typeof x==='number'&&!Number.isFinite(x)?{$nonfinite:String(x)}:Array.isArray(x)?x.map(represented):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,represented(v)])):x;
 for(const[name,change,reason]of controls){const input=structuredClone(base);change(input);writeFileSync(resolve(out,name+'-input.json'),JSON.stringify({name,input:represented(input),expectedStatus:'UNRESOLVED',expectedReason:reason},null,2)+'\n',{flag:'wx'});const actual=api.coupledStaticTarget(input);result.candidateCalls++;const row={name,input:represented(input),expectedStatus:'UNRESOLVED',expectedReason:reason,actual};result.negativeControls.push(row);writeFileSync(resolve(out,name+'-actual.json'),JSON.stringify(row,null,2)+'\n',{flag:'wx'});assert.equal(actual.status,'UNRESOLVED');assert.equal(actual.reason,reason);}
 result.referenceCases=3;result.negativeControlCount=8;result.proposalControls={axisAligned:'NOT_RUN',matrixOnly:'NOT_RUN',bitBudgetExhaustion:'NOT_RUN',changedOwnerHost:'NOT_RUN'};
 assert.equal(api.phaseHistory().counts.worlds,0);result.status='PASS_COUPLED_PURE_HELPER_INDEPENDENT_BANK';
}catch(e){result.status='FAIL_COUPLED_PURE_HELPER_INDEPENDENT_BANK';result.firstFailure={name:e.name,message:e.message,stack:e.stack};process.exitCode=1;}
writeFileSync(resolve(out,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,candidateCalls:result.candidateCalls,WorldCalls:0,firstFailure:result.firstFailure??null}));
