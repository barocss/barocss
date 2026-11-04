// Internal package phase qualification. This does not create a public World.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {prepareStackStep} from '../../packages/barocss-physics/src/stack/prepare-step.js';
import {solveStationaryNormal} from '../../packages/barocss-physics/src/stack/stationary-normal.js';
import {diagnoseStationaryNormal} from '../../packages/barocss-physics/src/stack/normal-bridge.js';
import {parseBody} from '../../packages/barocss-physics/src/validation.js';
import {verifyNormalKkt,verifyNormalSolution} from '../physics-stack-solver-2276/verification.js';
// Original immutable fixture, used only by this test DTO adapter.
// @ts-expect-error Original fixture has no TypeScript declaration.
import {fixture} from '../physics-rigid-contact-reference/fixtures.mjs';
// @ts-expect-error Pure finite-word transport has no TypeScript declaration.
import {packWitness,numericWordsHex} from './witness-wire.mjs';
// @ts-expect-error Harness IO has no TypeScript declaration.
import {archive,evidenceBudget,json,observer,raw,remain,sha,wordsDigest} from './io.mjs';

const [out,root,deadlineText,budgetPath,fixturePath,python]=process.argv.slice(2);
const deadline=Number(deadlineText),budget=evidenceBudget(budgetPath);
const geometry=observer(resolve(root,'examples/physics-stack-solver-2276/trajectory-reference.py'),out,'geometry',deadline,budget,python);
const position=observer(resolve(root,'examples/physics-stack-stationary-complete-2276/reference-wrapper.py'),out,'position',deadline,budget,python);
const reports: unknown[]=[],receipt:Record<string,unknown>={status:'RUNNING',scope:'CURRENT_PACKAGE_INTERNAL_PHASE_NOT_PUBLIC_WORLD',worldCalls:0,full1200:'BLOCKED_NOT_RUN',resourceQualification:'NOT_QUALIFIED',resourceBoundary:'Wire/scratch/output bounds only. Combined64MiB live ownership and complete-path cost are not qualified.'};
let stage='first32',firstFailure:unknown=null;
function requireResolved(value:any,label:string){assert.equal(value.resolved,true,label+' unresolved');assert.notEqual(value.executionFailure,true,label+' execution failure');assert.deepEqual(value.violations,[],label+' physical violations');}
function state(bodies:any[],step:number,contacts:{aId:string;bId:string}[]=[]){return {bodies,contacts,stepIndex:step,timeSeconds:step*(1/120)};}
try{
 // The first32-point fixture/oracle is immutable saved independent authority.
 // A separate entry exports the actual package normal solver to this harness.
 const saved=JSON.parse(readFileSync(fixturePath,'utf8'));
 assert.equal(saved.status,'AUTHENTICATED_SAVED_FIRST_PATCH_FIXTURE');assert.equal(saved.problem.points.length,32);
 const frozen=structuredClone(saved.problem),stationaryNormalWitness=solveStationaryNormal(saved.problem);
 const normal=diagnoseStationaryNormal(saved.problem,stationaryNormalWitness);
 assert.deepEqual(saved.problem,frozen,'first32 input mutation');
 const independent=verifyNormalSolution(saved.problem,normal,saved.oracle);
 json(join(out,'first32.json'),{normal,stationaryNormalWitness,independent,words:wordsDigest({normal,stationaryNormalWitness,independent}),fixtureSha256:sha(readFileSync(fixturePath))});
 assert.ok(normal.ok&&independent.passed,'first32 independent Fraction equilibrium gate');
 assert.equal(stationaryNormalWitness.status,'SOLVED_STATIONARY_WITNESS');assert.ok(stationaryNormalWitness.stats.triangleTrials<=32);assert.ok(stationaryNormalWitness.stats.integerOperations<=2000000);
 stage='predeclared-refusal-controls';
 const controls=[];
 for(const name of ['unsupported-dt','unsupported-material','nonfinite-input','nonzero-before-motion','unsupported-gravity']){
  const bodies=fixture('ALIGNED').bodies.map((body:unknown)=>parseBody(body));
  if(name==='unsupported-material')bodies[0].frictionStatic=.5;
  if(name==='nonfinite-input')bodies[0].positionM[0]=NaN;
  if(name==='nonzero-before-motion')bodies.find((body:any)=>body.kind==='dynamic')!.velocityMps[1]=.001;
  const before=structuredClone(bodies);let refusal:any=null;
  try{prepareStackStep(bodies,name==='unsupported-dt'?1/60:1/120,name==='unsupported-gravity'?[.01,-9.81,0]:[0,-9.81,0]);}catch(error){refusal=error;}
  assert.ok(refusal instanceof Error,name+' must refuse');const code=(refusal as Error&{code?:string}).code;assert.equal(code,'NUMERIC_LIMIT',name+' fixed refusal');
  assert.deepEqual(bodies,before,name+' input retained');controls.push({name,code,inputRetained:true});
 }
 json(join(out,'controls.json'),{controls,expectedCode:'NUMERIC_LIMIT',noToleranceChange:true});
 // One-step gates must all pass before fresh16 trajectories start.
 for(const steps of [1,16])for(const scene of ['ALIGNED','OFFSET','YAW']){
  stage=`${scene}-${steps}`;remain(deadline);
  const config=fixture(scene),initialBodies=config.bodies.map((body:unknown)=>parseBody(body));
  let bodies=initialBodies,accepted=0,contactPairs:{aId:string;bId:string}[]=[];
  const initial=state(bodies,0),writer=archive(out,stage,budget),initialQuality=await geometry.ask({op:'quality',request:{state:initial,initial,timeSeconds:0,referenceAt8s:null}});
  requireResolved(initialQuality,'initial quality');writer.write({kind:'initial',scene,state:initial,quality:initialQuality},[bodies]);
  let failure:unknown=null,currentAttempt:any=null;
  try{for(let step=1;step<=steps;step++){
   remain(deadline);stage=`${scene}-${steps}-step${step}`;
   const before=structuredClone(bodies);let prepared:any;
   try{prepared=prepareStackStep(bodies,1/120,[0,-9.81,0]);}
   catch(error){assert.deepEqual(bodies,before,'phase refusal mutated accepted input');currentAttempt={kind:'failed-step',scene,step,before,errorClass:(error as Error).name,code:(error as {code?:string}).code,phaseDiagnostics:(error as {diagnostics?:unknown}).diagnostics??null};throw error;}
   assert.deepEqual(bodies,before,'phase preparation mutated input');
   currentAttempt={kind:'failed-step',scene,step,before,prepared};
   if(steps===1&&scene==='ALIGNED'){
    const repeat=prepareStackStep(bodies,1/120,[0,-9.81,0]);assert.deepEqual(repeat,prepared,'deterministic first-step diagnostics');assert.deepEqual(bodies,before,'repeat input retained');
    json(join(out,'first-step-repeat.json'),{passed:true,actualPrepareCalls:2,words:wordsDigest(prepared),repeatedWords:wordsDigest(repeat)});
   }
   const d=prepared.diagnostics,p=d.positionAttempt,stats=d.positionStats;
   const witness=d.stationaryNormalWitness;
   assert.equal(witness.ok,true);assert.equal(witness.status,'SOLVED_STATIONARY_WITNESS');
   assert.deepEqual(witness.bodies.map((body:any)=>body.id),d.velocityBodies.map((body:any)=>body.id));
   assert.deepEqual(witness.bodies.map((body:any)=>body.id),d.normalResult.bodies.map((body:any)=>body.id));
   const shared=(bodies:any[])=>bodies.map(body=>[body.positionM,body.velocityMps,body.angularVelocityRadps,body.inverseMass]);
   assert.equal(numericWordsHex(shared(witness.bodies)),numericWordsHex(shared(d.velocityBodies)),'exact applied body linkage');
   assert.equal(numericWordsHex(shared(witness.bodies)),numericWordsHex(shared(d.normalResult.bodies)),'Float diagnostic body linkage');
   assert.equal(numericWordsHex(witness.normalImpulsesNs),numericWordsHex(d.normalResult.normalImpulsesNs),'rounded impulse linkage');
   assert.equal(numericWordsHex(witness.normalImpulsesNs),numericWordsHex(d.pointLedger.map((row:any)=>row.final.normalNs)),'phase ledger impulse linkage');
   const pointIds=d.normalProblem.points.map((row:any)=>row.id);
   assert.deepEqual(witness.exactApplied.points.map((row:any)=>row.id),pointIds);
   assert.deepEqual(d.pointLedger.map((row:any)=>JSON.stringify([row.pairKey,row.pointId])),pointIds);
   const velocityCheck=verifyNormalKkt(d.normalProblem,d.normalResult);
   assert.ok(velocityCheck.passed,'independent normal KKT');
   assert.equal(d.pointLedger.length,d.normalProblem.points.length);assert.ok(d.pointLedger.length<=32);
   if(step===1)assert.equal(d.pointLedger.length,32,'original first force population');
   assert.equal(p.problem.rows.length,36);assert.equal(p.rowSources.length,36);
   assert.equal(stats.tests,36);assert.equal(stats.rows,36);assert.equal(stats.postPairTests,36);
   assert.equal(stats.solverCalls,1);assert.equal(stats.workingApplicationCount,1);
   for(const point of d.pointLedger){assert.equal(point.warm.normalNs,0);assert.deepEqual(point.warm.tangentNs,[0,0,0]);assert.deepEqual(point.final.tangentNs,[0,0,0]);}
   const contactGeometry=await geometry.ask({op:'contacts',freeBodies:d.freeBodies,pointLedger:d.pointLedger});requireResolved(contactGeometry,'strict contacts');assert.equal(contactGeometry.ok,true);
   const positionCheck=await position.ask({op:'world',scene,stepIndex:step,config,stationaryNormalWitnessCheck:packWitness(d.normalProblem,d.stationaryNormalWitness),preBodies:p.preBodies,preRawHex:raw(p.preBodies).toString('hex'),problem:p.problem,rowSelections:p.rowSources,result:p.result,hypBodies:p.hypotheticalBodies,hypRawHex:raw(p.hypotheticalBodies).toString('hex')});
   requireResolved(positionCheck,'position');requireResolved(positionCheck.stationaryNormalWitnessCheck,'independent exact stationary witness');assert.equal(positionCheck.stationaryNormalWitnessCheck.ok,true);assert.ok(positionCheck.metrics.maxHypDepthRawM<=1e-12&&positionCheck.metrics.maxHypDepthNormalizedM<=1e-12,'HYP closure');
   const ledger={beforeBodies:d.beforeBodies,freeBodies:d.freeBodies,velocityBodies:d.velocityBodies,finalBodies:prepared.candidateBodies,points:d.pointLedger,fixedStepSeconds:1/120,gravityMps2:[0,-9.81,0],actions:[]};
   const ledgerCheck=await position.ask({op:'step-ledger',scene,stepIndex:step,outcome:'accepted',ledger,raw:{before:raw(d.beforeBodies).toString('hex'),free:raw(d.freeBodies).toString('hex'),velocity:raw(d.velocityBodies).toString('hex'),final:raw(prepared.candidateBodies).toString('hex')}});requireResolved(ledgerCheck,'phase ledger');
   const contacts=d.geometryPatches.map((patch:{aId:string;bId:string})=>({aId:patch.aId,bId:patch.bId}));
   const after=state(prepared.candidateBodies,step,contacts),quality=await geometry.ask({op:'quality',request:{state:after,initial,timeSeconds:after.timeSeconds,referenceAt8s:null}});requireResolved(quality,'quality');
   const pointBytes=Buffer.alloc(d.normalProblem.points.length*48);let offset=0;
   for(const point of d.normalProblem.points)for(const value of [...point.pointM,...point.normalAtoB]){pointBytes.writeDoubleLE(value,offset);offset+=8;}
   writer.write({kind:'step',scene,step,before:state(before,step-1,contactPairs),prepared,pointOperandF64leHex:pointBytes.toString('hex'),velocityCheck,contactGeometry,positionCheck,ledgerCheck,quality,after},[before,d.freeBodies,d.velocityBodies,prepared.candidateBodies]);
   // Harness-owned acceptance occurs only after every independent gate passes.
   bodies=prepared.candidateBodies;contactPairs=contacts;accepted++;
   currentAttempt=null;
  }}catch(error){failure={stage,errorClass:(error as Error).name,code:(error as {code?:string}).code,message:(error as Error).message};if(currentAttempt)try{writer.write({...currentAttempt,failure},currentAttempt.prepared?[currentAttempt.before,currentAttempt.prepared.candidateBodies]:[currentAttempt.before]);}catch(storageError){json(join(out,`${scene}-${steps}-failure-storage.json`),{failure,storageError:(storageError as Error).message});}throw error;}
  finally{reports.push({scene,selectedSteps:steps,phaseAccepted:accepted,publicWorldAccepted:'NOT_RUN',failure,evidence:writer.finish()});}
 }
 receipt.status='PASS_INTERNAL_PHASE_FIRST32_ONE_STEP_AND_FRESH16';
}catch(error){firstFailure={stage,errorClass:(error as Error).name,code:(error as {code?:string}).code,message:(error as Error).message,stack:(error as Error).stack};receipt.status='FIRST_FAILURE';}
finally{
 const cleanup=[];for(const ref of [geometry,position])try{cleanup.push(await ref.close(firstFailure!==null));}catch(error){cleanup.push({error:(error as Error).message});firstFailure??={stage:'cleanup',message:(error as Error).message};receipt.status='FIRST_FAILURE';}
 budget.finish();json(join(out,'result.json'),{...receipt,firstFailure,reports,cleanup,proofBoundary:'Internal phase only; no public admission, World transaction, full1200, browser or performance claim'});
}
assert.equal(firstFailure,null,'preserved first failure; stop campaign');
