import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {here,root,bundle,validateSource} from './bundle.mjs';
import {loadArchive,rawState,digest} from './archive.mjs';
import {controls} from './controls.mjs';
import {compareObservation} from './compare.mjs';
import {fixture} from '../physics-rigid-contact-reference/fixtures.mjs';
import {observer} from '../physics-rigid-contact-diagnostic/observer.mjs';
await validateSource();const freeze=JSON.parse(await readFile(resolve(here,'frozen-inputs.json')));
const directory=resolve(process.argv[2]??resolve(here,'../physics-rigid-feature-contact-reference/evidence/native-665aa5ae')),out=resolve(process.argv[3]??'/tmp/physics-1252-canonical');await mkdir(out,{recursive:true});
const input=await loadArchive(directory,freeze,root),oracle=observer(resolve(here,'geometry-reference.py')),reports=[],audits=[],controlRows=[];
try{
 for(const graph of ['source','source-repeat','compiled-dependencies']){
  const built=await bundle(graph,out);audits.push(built.audit);const m=await import(pathToFileURL(built.path));
  const controlRow={graph,...await controls(m,oracle,input,freeze,here)};controlRows.push(controlRow);await writeFile(resolve(out,`${graph}-controls.json`),JSON.stringify(controlRow,null,2)+'\n');
  for(const scene of ['ALIGNED','OFFSET','YAW']){
   const row=input.rows.find(r=>r.graph===graph&&r.scene===scene);assert.deepEqual(row.report.config,fixture(scene));const frames=[];
   for(const index of [row.states.length-2,row.states.length-1]){
    const state=structuredClone(row.states[index]),before=structuredClone(state),raw=rawState(state),bodies=state.bodies.map((b,i)=>{const body=m.parseBody(row.report.config.bodies[i],false);for(const field of ['positionM','velocityMps','orientation','angularVelocityRadps'])body[field]=[...b[field]];return body;}),pairs=[];
    for(let a=0;a<bodies.length;a++)for(let b=a+1;b<bodies.length;b++)pairs.push([a,b]);pairs.sort((x,y)=>bodies[x[0]].id<bodies[y[0]].id?-1:bodies[x[0]].id>bodies[y[0]].id?1:bodies[x[1]].id<bodies[y[1]].id?-1:1);
    const observations=[];
    for(const [a,b]of pairs){const actual=m.inspectPair(bodies[a],bodies[b]),reference=await oracle.ask({a:bodies[a],b:bodies[b]}),compared=compareObservation(actual,reference);observations.push({aId:bodies[a].id,bId:bodies[b].id,group:bodies[b].id==='floor'?'floor':'dynamic',actual,reference,compared,archivedAssemblyContact:state.contacts.find(c=>c.aId===bodies[a].id&&c.bId===bodies[b].id)??null});}
    assert.deepEqual(state,before,'archive input must stay unchanged');assert.equal(observations.length,36);
    const dynamic=observations.filter(o=>o.group==='dynamic'),floor=observations.filter(o=>o.group==='floor'),maxDynamic=dynamic.reduce((a,b)=>a.reference.normalized.depthM>=b.reference.normalized.depthM?a:b),maxFloor=floor.reduce((a,b)=>a.reference.normalized.depthM>=b.reference.normalized.depthM?a:b);
    const parentDynamicDeltaM=Math.abs(maxDynamic.reference.normalized.depthM-row.report.observations[index].metrics.maxPairPenetrationM),parentFloorDeltaM=Math.abs(maxFloor.reference.normalized.depthM-row.report.observations[index].metrics.maxFloorPenetrationM),parentAggregateAgrees=parentDynamicDeltaM<=1e-12&&parentFloorDeltaM<=1e-12;
    const firstThresholdCrossingAgrees=(maxDynamic.reference.normalized.depthM>.002)===(index===row.states.length-1);
    frames.push({parentDynamicDeltaM,parentFloorDeltaM,parentAggregateAgrees,firstThresholdCrossingAgrees,stepIndex:state.stepIndex,timeSeconds:state.timeSeconds,rawSha256:digest(raw),rawBytes:raw.length,state,observations,maximumDynamicPair:[maxDynamic.aId,maxDynamic.bId],maximumDynamicDepthM:maxDynamic.reference.normalized.depthM,maximumFloorDepthM:maxFloor.reference.normalized.depthM,above2mm:dynamic.filter(o=>o.reference.normalized.depthM>.002).map(o=>[o.aId,o.bId]),archivedGlobalStats:row.report.globalContactStats[index],archivedWarmStats:row.report.warmCacheStats[index],archivedProjectionStats:row.report.projectionStats[index]});
   }
   const raw=Buffer.concat(frames.map(f=>rawState(f.state))),agreement=frames.every(f=>f.parentAggregateAgrees&&f.firstThresholdCrossingAgrees&&f.observations.every(o=>o.compared.selectorBitsAgree&&o.compared.depthAgrees&&o.compared.separationAgrees&&o.compared.precisionAgrees&&o.compared.normalizedDepthAgrees));
   const report={graph,scene,frames,rawSha256:digest(raw),rawBytes:raw.length,detectorAgreement:agreement,worldCreated:false,worldStepped:false,phaseHistoryAvailable:false,causalRootClaimed:false,physicalModelGO:false};reports.push(report);
   await writeFile(resolve(out,`${graph}-${scene}-frames.f64le`),raw);await writeFile(resolve(out,`${graph}-${scene}-report.json.gz`),gzipSync(JSON.stringify(report)));console.log(JSON.stringify({graph,scene,lastPassingStep:frames[0].stepIndex,firstFailingStep:frames[1].stepIndex,maximumPair:frames[1].maximumDynamicPair,depthM:frames[1].maximumDynamicDepthM,detectorAgreement:agreement,worldStepped:false}));
  }
 }
 for(const scene of ['ALIGNED','OFFSET','YAW']){const rows=reports.filter(r=>r.scene===scene);const {graph,...first}=rows[0];for(const r of rows.slice(1)){const {graph,...next}=r;assert.deepEqual(next,first,'all raw/reference/pair/failure/counter observations agree');}}
 const summary={base:freeze.base,measuredHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,archiveManifestSha256:freeze.archiveManifestSha256,archiveMeasuredHead:freeze.archiveMeasuredHead,validatedArchiveFiles:input.files.size,validatedAcceptedStates:609,observedRecordedFrames:18,actualPairObservations:reports.reduce((n,r)=>n+r.frames.reduce((s,f)=>s+f.observations.length,0),0),graphAudits:audits,controlRows,sourceRepeatCompiledParity:true,detectorAgreement:reports.every(r=>r.detectorAgreement),worldCreated:false,worldStepped:false,causalRootClaimed:false,physicalModelGO:false,referenceStderr:oracle.stderr(),results:reports.map(r=>({graph:r.graph,scene:r.scene,rawSha256:r.rawSha256,detectorAgreement:r.detectorAgreement,frames:r.frames.map(({stepIndex,timeSeconds,maximumDynamicPair,maximumDynamicDepthM,maximumFloorDepthM,above2mm})=>({stepIndex,timeSeconds,maximumDynamicPair,maximumDynamicDepthM,maximumFloorDepthM,above2mm}))}))};
 assert.equal(summary.actualPairObservations,648);await writeFile(resolve(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
}finally{oracle.close();}
