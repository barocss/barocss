import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ArchiveError,validateFiles,validatePoseFiles,restoreFrame,rawBodies} from './archive.mjs';
import {here,validateSource} from './bundle.mjs';
import {algebraBasis,algebraCases,algebraProblem} from './literal-cases.mjs';
import {runReferenceControls} from './reference-controls.mjs';
export const physicalRefusalEdits=[
 ['dt-first',x=>{x.config=null;x.state=null;x.dt=0;},'INVALID_STEP','dt'],
 ['null-config',x=>{x.config=null;},'INVALID_CONFIG','world must be an object'],
 ['zero-mass',x=>{x.config.bodies[0].massKg=0;},'INVALID_CONFIG','massKg must be finite and in [0.000001, 1000000]'],
 ['sparse-config-body',x=>{delete x.config.bodies[0];},'INVALID_CONFIG','profile'],
 ['sparse-config-joint',x=>{delete x.config.joints[0];},'INVALID_CONFIG','joints must be a dense array of at most 8'],
 ['nonzero-gravity',x=>{x.config.gravityMps2=[0,-9.81,0];},'INVALID_CONFIG','profile'],
 ['different-metadata-dt',x=>{x.config.fixedStepSeconds=.01;},'INVALID_CONFIG','profile'],
 ['explicit-inertia',x=>{x.config.bodies[0].inertiaKgM2=.004;},'INVALID_CONFIG','profile'],
 ['null-state',x=>{x.state=null;},'NUMERIC_LIMIT','pose'],
 ['sparse-state-body',x=>{delete x.state.bodies[0];},'NUMERIC_LIMIT','pose'],
 ['missing-body',x=>{x.state.bodies.pop();},'NUMERIC_LIMIT','pose'],
 ['missing-joint',x=>{x.state.joints=[];},'NUMERIC_LIMIT','pose'],
 ['wrong-ID',x=>{x.state.bodies[0].id='missing';},'NUMERIC_LIMIT','pose'],
 ['null-report',x=>{x.state.joints[0].angleRad=null;},'NUMERIC_LIMIT','pose'],
 ['null-number',x=>{x.state.bodies[0].positionM[0]=null;},'NUMERIC_LIMIT','pose'],
 ['nonfinite-number',x=>{x.state.bodies[0].velocityMps[0]=NaN;},'NUMERIC_LIMIT','pose'],
 ['zero-quaternion',x=>{x.state.bodies[0].orientation=[0,0,0,0];},'NUMERIC_LIMIT','pose'],
 ['sparse-vector',x=>{delete x.state.bodies[0].velocityMps[0];},'NUMERIC_LIMIT','pose'],
 ['cursor',x=>{x.state.stepIndex=-1;},'NUMERIC_LIMIT','pose'],
 ['time',x=>{x.state.timeSeconds=0;},'NUMERIC_LIMIT','pose'],
 ['null-unused-metadata',x=>{x.state.events=[null];},'NUMERIC_LIMIT','pose'],
 ['original-output-bounds',x=>{for(const body of x.state.bodies){body.positionM=[10000,0,0];body.orientation=[0,0,0,1];}x.state.joints[0].angleRad=0;},'NUMERIC_LIMIT','pairB0 position exceeded bounds'],
];
export const linearRefusalEdits=[
 ['compatible-dependent',p=>{p.b[0]=1;p.a[10]=[...p.a[9]];},'system'],
 ['incompatible-dependent',p=>{p.b[0]=1;p.a[10]=[...p.a[9]];p.b[10]=1;},'system'],
 ['near-dependent',p=>{p.b[0]=1;p.a[10]=p.a[9].map((v,i)=>v+(i===10?1e-7:0));},'system'],
 ['zero-H',p=>{p.h[0]=0;},'linear'],
 ['negative-H',p=>{p.h[0]=-1;},'linear'],
 ['null-H',p=>{p.h[0]=null;},'linear'],
 ['NaN-H',p=>{p.h[0]=NaN;},'linear'],
 ['unsafe-reciprocal',p=>{p.b[0]=1;p.h[0]=Number.MIN_VALUE;},'system'],
 ['unsafe-reciprocal-identity',p=>{p.h[0]=Number.MIN_VALUE;},'system'],
 ['null-coefficient',p=>{p.a[0][0]=null;},'linear'],
 ['sparse-coefficient',p=>{delete p.a[0][0];},'linear'],
 ['sparse-row',p=>{delete p.a[0];},'linear'],
 ['short-row',p=>{p.a[0].pop();},'linear'],
 ['null-b',p=>{p.b=null;},'linear'],
 ['boolean-y0',p=>{p.y0[0]=false;},'linear'],
 ['nonfinite-y0',p=>{p.y0[0]=Infinity;},'linear'],
 ['extra-key',p=>{p.extra=0;},'linear'],
 ['extra-array-key',p=>{p.b.extra=0;},'linear'],
 ['none-with-stop-row',p=>{p.stopRow=Array(12).fill(0);},'linear'],
 ['unknown-stop',p=>{p.stopKind='both';},'linear'],
];
export const certificateEdits=[
 ['y',r=>{r.y[0]+=1;}],['null-y',r=>{r.y[0]=null;}],['NaN-y',r=>{r.y[0]=NaN;}],
 ['sparse-y',r=>{delete r.y[0];}],['lambda-sign',r=>{r.lambda[r.lambda.length-1]=1;}],
 ['objective',r=>{r.objectiveDimensionless+=1;}],['negative-objective',r=>{r.objectiveDimensionless=-1;}],
 ['active-branch',r=>{r.activeStop=false;}],['unknown-key',r=>{r.extra=0;}],
 ['inverse',r=>{r.phases[0].inverse[0][0]+=1;}],['null-residual',r=>{r.certificate.primal=null;}],
];
function typedThrows(m,action,code,message,name){assert.throws(action,error=>error instanceof m.PhysicsError&&error.code===code&&error.message===message,name);}
export async function controls(m,oracle,input){
 const base=structuredClone(input.records[0]),typed=[],linear=[],certificates=[],archive=[];
 for(const [name,edit,code,key]of physicalRefusalEdits){const changed={config:structuredClone(base.config),state:structuredClone(base.state),dt:1/120};edit(changed);const saved=structuredClone(changed),message=m.ERRORS[key]??key;typedThrows(m,()=>m.projectHingePoseVelocityReference(changed.config,changed.state,changed.dt),code,message,name);assert.deepEqual(changed,saved,'refusal input retained');typed.push({name,code,message});}
 for(const [name,marker]of [['error',new Error('unknown getter marker')],['object',{unknown:true}],['null',null]]){const config=structuredClone(base.config);Object.defineProperty(config,'fixedStepSeconds',{get(){throw marker;},enumerable:true});let caught=false;try{m.projectHingePoseVelocityReference(config,base.state,1/120);}catch(error){caught=true;assert.equal(error,marker);}assert.equal(caught,true);typed.push({name:`unknown-getter-${name}-identity`,propagated:true});}
 for(const [name,edit,key]of linearRefusalEdits){const problem=algebraBasis();edit(problem);const saved=structuredClone(problem);typedThrows(m,()=>m.solveDimensionlessVelocity(problem),'NUMERIC_LIMIT',m.ERRORS[key],name);assert.deepEqual(problem,saved,'linear refusal input retained');linear.push({name,message:m.ERRORS[key],physicalScene:false});}
 const algebra=[];
 for(const c of algebraCases){const problem=algebraProblem(c.edit),saved=structuredClone(problem),result=m.solveDimensionlessVelocity(problem);assert.deepEqual(problem,saved);for(const [key,value]of Object.entries(c.expected))assert.equal(result[key],value,c.name);const certificate=m.validateVelocityCertificate(problem,result);assert.deepEqual(certificate,result.certificate,c.name);const reply=await oracle.ask({op:'linear',problem:structuredClone(problem),result:structuredClone(result)});assert.equal(reply.resolved,true,c.name);assert.equal(reply.executionFailure,false,c.name);assert.equal(reply.ok,true,c.name);assert.equal(reply.certificate.expected.primalZero,true);assert.equal(reply.certificate.expected.stationarityZero,true);assert.equal(reply.certificate.expected.stopKktPassed,true);algebra.push({name:c.name,problem:saved,result:structuredClone(result),reply,physicalScene:false});result.y[0]=999;result.certificate.primal=999;certificate.primal=998;assert.deepEqual(problem,saved,'linear return cannot mutate input');assert.notEqual(result.certificate.primal,certificate.primal,'validator returns copied certificate');}
 const tamperProblem=algebraProblem('upper-positive'),pristine=m.solveDimensionlessVelocity(tamperProblem);
 for(const [name,edit]of certificateEdits){const result=structuredClone(pristine);edit(result);const saved=structuredClone(result);typedThrows(m,()=>m.validateVelocityCertificate(tamperProblem,result),'NUMERIC_LIMIT',m.ERRORS.certificate,name);assert.deepEqual(result,saved,'certificate refusal input retained');certificates.push({name,message:m.ERRORS.certificate,physicalScene:false});}
 for(const [name,edit,message]of [['manifest',f=>f.set('manifest.json',Buffer.from('{}')),'archive manifest hash mismatch'],['artifact',f=>f.set('source-report.json.gz',Buffer.from('corrupt')),'archive artifact hash mismatch'],['extra-file',f=>f.set('extra.json',Buffer.from('{}')),'archive file set mismatch']]){const files=new Map(input.files);edit(files);assert.throws(()=>validateFiles(files),error=>error instanceof ArchiveError&&error.message===message);archive.push({name,message});}
 for(const [name,edit,message]of [['pose-manifest',f=>f.set('manifest.json',Buffer.from('{}')),'pose archive manifest hash mismatch'],['pose-artifact',f=>f.set('RESULT.md',Buffer.from('corrupt')),'pose archive artifact hash mismatch'],['pose-extra-file',f=>f.set('extra.json',Buffer.from('{}')),'pose archive file set mismatch']]){const files=new Map(input.pose.filesMap);edit(files);assert.throws(()=>validatePoseFiles(files),error=>error instanceof ArchiveError&&error.message===message);archive.push({name,message});}
 const bytes=rawBodies(base.state.bodies),ids=base.state.bodies.map(b=>b.id);
 for(const [name,edit,message]of [['raw-length',()=>bytes.subarray(0,-1),'raw frame length mismatch'],['raw-nonfinite',()=>{const copy=Buffer.from(bytes);copy.writeDoubleLE(NaN,0);return copy;},'archive raw field nonfinite or out of bounds']]){assert.throws(()=>restoreFrame(base.state,edit(),ids,base.step),error=>error instanceof ArchiveError&&error.message===message);archive.push({name,message});}
 const nullState=structuredClone(base.state);nullState.bodies[0].positionM[0]=null;assert.throws(()=>restoreFrame(nullState,bytes,ids,base.step),error=>error instanceof ArchiveError&&error.message==='archive JSON/raw field mismatch');archive.push({name:'raw-null-number',message:'archive JSON/raw field mismatch'});
 const pins=JSON.parse(await readFile(resolve(here,'frozen-source.json')));await assert.rejects(()=>validateSource({...pins,'literal-cases.mjs':'0'.repeat(64)}),error=>error.code==='ERR_ASSERTION'&&error.message.includes('source drift: literal-cases.mjs'));archive.push({name:'current-source-drift'});
 const reference=await runReferenceControls(request=>oracle.ask(request));
 return {typed,linear,algebra,certificates,archive,reference,successfulPhysicalCalls:0,physicalRefusalCalls:physicalRefusalEdits.length-1,originalBoundsRefusalCalls:1,unknownGetterCalls:3,pureSolverCalls:algebraCases.length+linearRefusalEdits.length+1,worldCreated:false,worldStepped:false,motorDriven:false,oldProjectionCalled:false};
}
