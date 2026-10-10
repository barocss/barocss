import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {bundle,here,root} from './bundle.mjs';
import {digest,loadArchive} from './archive.mjs';
import {reconstruct,sortedPairs,rawBodies} from './reconstruct.mjs';
import {controls} from './controls.mjs';
import {fixture} from '../physics-rigid-contact-reference/fixtures.mjs';
import {observer} from '../physics-rigid-contact-diagnostic/observer.mjs';
const archive=resolve(process.argv[2]??'/Users/user/.codex/worktrees/physics-rigid-cache-1204/barocss/examples/physics-rigid-global-contact-reference/evidence/native-580395fc');
const out=resolve(process.argv[3]??'/tmp/physics-1226-canonical');await mkdir(out,{recursive:true});
const freeze=JSON.parse(await readFile(resolve(here,'frozen-inputs.json')));const input=await loadArchive(archive,freeze);
const reference=observer(resolve(here,'geometry-reference.py'));const reports=[],audits=[],controlRows=[];
try {
 for(const graph of ['source','source-repeat','compiled-dependencies']) {
  const built=await bundle(graph==='source-repeat'?'source':graph,out);audits.push(built.audit);const module=await import(pathToFileURL(built.path));controlRows.push({graph,controls:controls(module)});
  for(const scene of ['ALIGNED','OFFSET','YAW']) {
   const row=input.reports.find(r=>r.report.graph===graph&&r.report.scene===scene);assert.deepEqual(row.report.config,fixture(scene));
   const working=reconstruct(module,row.report.config,row.states.at(-1));const bytes=rawBodies(working);await writeFile(resolve(out,`${graph}-${scene}-working.f64le`),bytes);
   const encounters=[];let refused=null;
   for(const [a,b] of sortedPairs(working)) {
    const hit=module.detect(working[a],working[b]);
    if(!hit){encounters.push({aId:working[a].id,bId:working[b].id,hit:null});continue;}
    assert.ok(hit.penetration<=module.MAX_STEP_DISPLACEMENT_M,'prior original penetration guard must not preempt null refusal');
    const manifold=module.boxFaceManifold(working[a],working[b],hit);const copied=module.inspectFaceManifold(working[a],working[b],hit);assert.deepEqual(copied.points,manifold,'copied observer actual point/null parity');
    const decimal=await reference.ask({a:working[a],b:working[b],hit});assert.equal(decimal.ok,true,JSON.stringify(decimal));
    for(const key of ['a','b']) for(let i=0;i<3;i++) assert.ok(Math.abs(copied.alignments[key][i]-decimal.faceAlignments[key][i])<=1e-12,'actual/independent face alignment');
    const encounter={aId:working[a].id,bId:working[b].id,hit,manifold,inspection:copied,independent:decimal};encounters.push(encounter);
    if(manifold===null){refused=encounter;break;}
   }
   assert.ok(refused,'original first refused assembly reproduced');
   const report={graph,scene,archiveAcceptedStep:row.report.failure.acceptedStep,attemptedStep:row.report.failure.attemptedStep,workingPose:'reconstructed command-free unaccepted geometry, not a committed world state',workingBodies:working,workingRawSha256:digest(bytes),encounters,firstRefusal:refused,worldStepped:false,modelGO:false};reports.push(report);
   await writeFile(resolve(out,`${graph}-${scene}-report.json`),JSON.stringify(report,null,2)+'\n');
   console.log(JSON.stringify({graph,scene,attemptedStep:report.attemptedStep,firstPair:[refused.aId,refused.bId],nullBranch:refused.inspection.reason,depth:refused.hit.penetration,workingRawSha256:report.workingRawSha256}));
  }
 }
 for(const scene of ['ALIGNED','OFFSET','YAW']) {const rows=reports.filter(r=>r.scene===scene);const {graph,...first}=rows[0];for(const row of rows.slice(1)){const {graph,...current}=row;assert.deepEqual(current,first,'all reconstructed geometry and references agree');}}
 const summary={base:'673ac26f95fe9f36088f741eaf365d3c400893ac',measuredHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,archiveManifestSha256:freeze.archiveManifestSha256,archiveMeasuredHead:freeze.archiveMeasuredHead,validatedArchiveFiles:Object.keys(input.manifest).length,validatedAcceptedSnapshots:input.reports.reduce((sum,r)=>sum+r.states.length,0),graphAudits:audits,controlRows,sourceRepeatCompiledParity:true,worldStepped:false,physicalModelGO:false,referenceStderr:reference.stderr(),results:reports.map(({graph,scene,attemptedStep,workingRawSha256,firstRefusal})=>({graph,scene,attemptedStep,workingRawSha256,firstPair:[firstRefusal.aId,firstRefusal.bId],nullBranch:firstRefusal.inspection.reason,hit:firstRefusal.hit,independent:firstRefusal.independent}))};
 await writeFile(resolve(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
} finally {reference.close();}
