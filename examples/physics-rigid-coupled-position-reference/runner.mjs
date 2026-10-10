import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {here,root,bundle,validateSource} from './bundle.mjs';
import {loadInputs,rawState,digest} from './input.mjs';
import {solvePosition,PositionReferenceError} from './linear-solver.mjs';
import {compareSolutions,geometryAgreement} from './compare.mjs';
import {compareObservation} from '../physics-rigid-feature-penetration-diagnostic/compare.mjs';
import {controls} from './controls.mjs';
import {observer} from '../physics-rigid-contact-diagnostic/observer.mjs';
import {fixture} from '../physics-rigid-contact-reference/fixtures.mjs';
await validateSource();const input=await loadInputs(root),out=resolve(process.argv[2]??'/tmp/physics-1263-canonical');await mkdir(out,{recursive:true});
const linear=observer(resolve(here,'linear-reference.py')),geometry=observer(resolve(here,'../physics-rigid-feature-penetration-diagnostic/geometry-reference.py')),reports=[],audits=[],controlRows=[];
try{
 for(const graph of ['source','source-repeat','compiled-dependencies']){
  const built=await bundle(graph,out);audits.push(built.audit);const m=await import(pathToFileURL(built.path));const controlRow={graph,...await controls(m,linear,geometry,input)};controlRows.push(controlRow);await writeFile(resolve(out,`${graph}-controls.json`),JSON.stringify(controlRow,null,2)+'\n');
  for(const scene of ['ALIGNED','OFFSET','YAW']){
   const row=input.first.find(r=>r.graph===graph&&r.scene===scene);assert.deepEqual(row.config,fixture(scene));const state=structuredClone(row.state),inputRaw=rawState(state),bodies=state.bodies.map((b,i)=>{const parsed=m.parseBody(row.config.bodies[i],false);for(const f of ['positionM','velocityMps','orientation','angularVelocityRadps'])parsed[f]=[...b[f]];return parsed;});const saved=structuredClone(bodies),rows=[],original=[];
   for(let a=0;a<bodies.length;a++)for(let b=a+1;b<bodies.length;b++){
    const actual=m.inspectPair(bodies[a],bodies[b]),old=row.diagnostic.observations.find(o=>o.aId===bodies[a].id&&o.bId===bodies[b].id);
    assert.deepEqual(JSON.parse(JSON.stringify(actual)),old.actual,'diagnostic JSON retains values with declared signed-zero loss');assert.equal(compareObservation(actual,old.reference).selectorBitsAgree,true,'fresh original detector/selector exact bits');original.push({aId:bodies[a].id,bId:bodies[b].id,...actual});if(actual.hit)rows.push({aId:bodies[a].id,bId:bodies[b].id,normal:[...actual.hit.normal],depthM:actual.hit.penetration});
   }
   const problem={bodies:bodies.map(b=>({id:b.id,inverseMass:b.inverseMass})),rows},problemBefore=structuredClone(problem),candidate=(()=>{try{return solvePosition(problem);}catch(e){if(e instanceof PositionReferenceError&&e.code==='PROFILE_LIMIT')return {ok:false,status:e.code,message:e.message};throw e;}})(),reference=await linear.ask(problem),compared=compareSolutions(candidate,reference);assert.deepEqual(problem,problemBefore);
   let transformed=null,allPairs=[],maxPenetrationM=null,maxCorrectionM=null,floorContained=false,geometryGO=false;
   if(candidate.ok){
    maxCorrectionM=Math.max(...candidate.translations.map(t=>Math.hypot(...t.u)));const correctionBound=Number.isFinite(maxCorrectionM)&&maxCorrectionM<=10;
    if(correctionBound){
     transformed=structuredClone(bodies);for(let i=0;i<transformed.length;i++){transformed[i].positionM=transformed[i].positionM.map((v,d)=>v+candidate.translations[i].u[d]);assert.deepEqual(transformed[i].orientation,bodies[i].orientation);assert.deepEqual(transformed[i].velocityMps,bodies[i].velocityMps);assert.deepEqual(transformed[i].angularVelocityRadps,bodies[i].angularVelocityRadps);if(bodies[i].inverseMass===0)assert.deepEqual(transformed[i],bodies[i]);}
     for(let a=0;a<transformed.length;a++)for(let b=a+1;b<transformed.length;b++){const ref=await geometry.ask({a:transformed[a],b:transformed[b]});allPairs.push({aId:transformed[a].id,bId:transformed[b].id,reference:ref,referenceAgreement:geometryAgreement(ref)});}
     maxPenetrationM=allPairs.every(p=>Number.isFinite(p.reference.raw?.depthM)&&Number.isFinite(p.reference.normalized?.depthM))?Math.max(...allPairs.map(p=>p.reference.raw.depthM),...allPairs.map(p=>p.reference.normalized.depthM)):null;
     floorContained=transformed.slice(0,8).every(b=>Math.abs(b.positionM[0])+.25*Math.sqrt(3)<=2&&Math.abs(b.positionM[2])+.25*Math.sqrt(3)<=2);
     geometryGO=allPairs.length===36&&allPairs.every(p=>p.referenceAgreement)&&maxPenetrationM!==null&&maxPenetrationM<=1e-9&&floorContained;
    }
   }
   assert.deepEqual(bodies,saved,'original body inputs unchanged');assert.deepEqual(rawState(state),inputRaw,'archived 13fields unchanged');
   const transformedRaw=transformed===null?null:rawState({bodies:transformed});
   const report={hypotheticalRawSha256:transformedRaw===null?null:digest(transformedRaw),hypotheticalRawBytes:transformedRaw?.length??0,graph,scene,stepIndex:state.stepIndex,rawInputSha256:digest(inputRaw),original,problem,candidate,reference,compared,maxCorrectionM,maxPenetrationM,floorContained,geometryGO,allPairs,transformed,hypotheticalReferenceGO:candidate.ok&&compared.agree&&geometryGO,worldCreated:false,worldStepped:false,historicalPhaseReplay:false,physicalModelGO:false};reports.push(report);
   await writeFile(resolve(out,`${graph}-${scene}-input.f64le`),inputRaw);if(transformedRaw)await writeFile(resolve(out,`${graph}-${scene}-hypothetical.f64le`),transformedRaw);await writeFile(resolve(out,`${graph}-${scene}-report.json.gz`),gzipSync(JSON.stringify(report)));console.log(JSON.stringify({graph,scene,stepIndex:report.stepIndex,rows:rows.length,status:candidate.status,maxCorrectionM,maxPenetrationM,compared:compared.agree,geometryGO,referenceGO:report.hypotheticalReferenceGO}));
  }
 }
 for(const scene of ['ALIGNED','OFFSET','YAW']){const rs=reports.filter(r=>r.scene===scene);const {graph,...first}=rs[0];for(const r of rs.slice(1)){const {graph,...next}=r;assert.deepEqual(next,first,'source-repeat-compiled parity');}}
 const summary={base:'86d10516858410906482397450a3b265c1a8b096',measuredHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,validatedParentFiles:input.archive.files.size,validatedParentStates:609,validatedDiagnosticFiles:input.diagnosticFiles.size,actualFrames:9,actualOriginalPairObservations:reports.reduce((n,r)=>n+r.original.length,0),actualTransformedPairObservations:reports.reduce((n,r)=>n+r.allPairs.length,0),graphAudits:audits,controlRows,sourceRepeatCompiledParity:true,hypotheticalReferenceGO:reports.every(r=>r.hypotheticalReferenceGO),physicalModelGO:false,worldCreated:false,worldStepped:false,referenceStderr:{linear:linear.stderr(),geometry:geometry.stderr()},results:reports.map(({graph,scene,stepIndex,problem,candidate,maxCorrectionM,maxPenetrationM,compared,geometryGO,hypotheticalReferenceGO})=>({graph,scene,stepIndex,rowCount:problem.rows.length,activeMask:candidate.activeMask,maxCorrectionM,maxPenetrationM,compared,geometryGO,hypotheticalReferenceGO}))};
 await writeFile(resolve(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
}finally{linear.close();geometry.close();}
