import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {bundle,here,root} from './bundle.mjs';
import {loadArchive,digest} from './archive.mjs';
import {controls} from './controls.mjs';
import {observer} from '../physics-rigid-contact-diagnostic/observer.mjs';
assert.ok(process.version.startsWith('v22.'));
assert.equal(process.argv.slice(2).length,4,'1226 archive, parent source root, 1219 archive and outputdirectory are required');
const [archive,parentRoot,previousArchive,out]=process.argv.slice(2).map(p=>resolve(p));
await mkdir(out,{recursive:true});const frozen=JSON.parse(await readFile(resolve(here,'frozen-inputs.json')));
const input=await loadArchive(archive,parentRoot,previousArchive,frozen),reference=observer(resolve(here,'witness-reference.py'));
const reports=[],audits=[],controlRows=[];
try {
  for(const graph of ['source','source-repeat','compiled-dependencies']) {
    const built=await bundle(graph,out);audits.push(built.audit);const m=await import(pathToFileURL(built.path));const controlRow={graph,controls:await controls(m,reference)};controlRows.push(controlRow);await writeFile(resolve(out,`${graph}-controls.json`),JSON.stringify(controlRow,null,2)+'\n');
    for(const row of input.reports.filter(r=>r.report.graph===graph)) {
      const reconstructed=row.reconstruct(m,row.previousConfig,row.previousLast);assert.deepEqual(reconstructed,row.workingBodies,'reconstruct/raw exact parity');
      const saved=structuredClone(row.workingBodies),results=[];
      for(const encounter of row.report.encounters) {
        const a=row.workingBodies.find(b=>b.id===encounter.aId),b=row.workingBodies.find(b=>b.id===encounter.bId);
        const hit=m.detect(a,b);assert.deepEqual(JSON.parse(JSON.stringify(hit)),encounter.hit,'archive JSON numeric hit parity (JSON does not preserve -0)');const selected=m.selectBoxSATFeature(a,b);assert.deepEqual(selected?.hit??null,hit,'selected original hit bits');
        if(!hit){assert.equal(m.featureContact(a,b),null);results.push({aId:a.id,bId:b.id,hit:null});continue;}
        let geometry=null,refusal=null,independent=null;
        try {geometry=m.featureContact(a,b);} catch(error){assert.equal(error.code,'NUMERIC_LIMIT');assert.equal(error.message,'private feature contact requires valid box witnesses');refusal={code:error.code,message:error.message};}
        if(geometry){assert.ok(geometry.points.length>0&&geometry.points.length<=(geometry.family==='face'?4:1));assert.deepEqual(geometry,m.featureContact(a,b),'same input determinism');independent=await reference.ask({a,b,geometry});}
        if(geometry){const pristine=structuredClone(geometry);geometry.points[0].witnessAM[0]=999;geometry.selection.hit.normal[0]=999;assert.deepEqual(row.workingBodies,saved,'output changed caller');assert.deepEqual(m.featureContact(a,b),pristine,'output caller-copy isolation');geometry=pristine;}
        const result={aId:a.id,bId:b.id,originalNull:encounter.manifold===null,selection:selected,geometry,refusal,independent};results.push(result);
        assert.deepEqual(row.workingBodies,saved,'caller mutated');
        if(refusal){assert.throws(()=>m.featureContact(a,b),e=>e.code===refusal.code&&e.message===refusal.message);}
      }
      const floats=results.flatMap(r=>!r.selection?[]:[...r.selection.hit.normal,r.selection.hit.penetration,...r.selection.hit.pointM,...(r.geometry?[...r.geometry.planeNormalAtoB,...r.geometry.points.flatMap(p=>[...p.witnessAM,...p.witnessBM,...p.midpointM,p.normalGapM,p.pointPenetrationM])]:[])]);const outputRaw=Buffer.alloc(floats.length*8);floats.forEach((v,i)=>{assert.ok(Number.isFinite(v));outputRaw.writeDoubleLE(v,i*8);});await writeFile(resolve(out,`${graph}-${row.report.scene}-geometry.f64le`),outputRaw);
      const report={graph,scene:row.report.scene,attemptedStep:row.report.attemptedStep,workingPose:row.report.workingPose,workingRawSha256:digest(row.raw),geometryRaw:{endian:'little',signedZerosPreserved:true,layout:'each non-null encounter: originalHit normal3,penetration1,point3; if geometry: planeNormal3, each witness A3,B3,midpoint3,gap1,depth1',components:floats.length,sha256:digest(outputRaw)},results,worldStepped:false,
        geometryGO:results.every(r=>!r.selection||r.geometry&&r.independent?.ok===true),physicalModelGO:false};reports.push(report);
      await writeFile(resolve(out,`${graph}-${report.scene}-report.json`),JSON.stringify(report,null,2)+'\n');
      const first=results.find(r=>r.originalNull);console.log(JSON.stringify({graph,scene:report.scene,geometryGO:report.geometryGO,originalFirstNullFeature:first.selection.feature,newPoints:first.geometry?.points.length??0,refusal:first.refusal,independent:first.independent?.ok??null}));
    }
  }
  for(const scene of ['ALIGNED','OFFSET','YAW']) {const rows=reports.filter(r=>r.scene===scene),{graph,...first}=rows[0];for(const row of rows.slice(1)){const {graph,...next}=row;assert.deepEqual(next,first,'source-repeat-compiled geometry/reference parity');}}
  const hits=reports.flatMap(r=>r.results.filter(x=>x.selection)),witnesses=hits.filter(r=>r.geometry).flatMap(r=>r.geometry.points);
  assert.equal(hits.length,frozen.satHitInstances);assert.equal(hits.filter(r=>!r.originalNull).length,frozen.successfulManifoldInstances);assert.equal(hits.filter(r=>r.originalNull).length,frozen.firstRefusalInstances);
  const failed=hits.filter(r=>!r.geometry||!r.independent?.ok),summary={base:'5a4d02f6fe0062473cbf1dccd1dc7f54420b66d0',measuredHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,
    archiveManifestSha256:frozen.archiveManifestSha256,validatedInputFiles:Object.keys(input.manifest).length,previousValidatedFiles:input.previousFiles,previousAcceptedStates:input.previousAcceptedStates,
    graphAudits:audits,controlRows,originalHits: hits.length,retainedSuccessfulManifoldInstances:frozen.successfulManifoldInstances,retainedFirstRefusalInstances:frozen.firstRefusalInstances,totalWitnesses:witnesses.length,
    sourceRepeatCompiledParity:true,worldStepped:false,geometryGO:failed.length===0,physicalModelGO:false,failures:failed,referenceStderr:reference.stderr()};
  await writeFile(resolve(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({geometryGO:summary.geometryGO,hits:hits.length,witnesses:witnesses.length,failed:failed.length,worldStepped:false}));
}finally{reference.close();}
