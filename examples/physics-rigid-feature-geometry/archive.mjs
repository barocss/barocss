import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export const digest=b=>createHash('sha256').update(b).digest('hex');
export const verify=(b,h,n)=>assert.equal(digest(b),h,`${n}: hash mismatch`);
export function restoreWorking(report,raw) {
  const bodies=structuredClone(report.workingBodies);assert.equal(raw.length,bodies.length*13*8);verify(raw,report.workingRawSha256,'working fields');let offset=0;
  for(const b of bodies) for(const [field,size] of [['positionM',3],['velocityMps',3],['orientation',4],['angularVelocityRadps',3]]) {
    assert.equal(b[field].length,size);for(let i=0;i<size;i++){const v=raw.readDoubleLE(offset);offset+=8;assert.ok(Number.isFinite(v)&&v===b[field][i]);b[field][i]=v;}
  }
  return bodies;
}
export async function loadArchive(directory,parentRoot,previousDirectory,frozen) {
  for(const [path,hash] of Object.entries(frozen.parentSourceHashes)) verify(await readFile(resolve(parentRoot,path)),hash,path);
  const previousModule=await import(pathToFileURL(resolve(parentRoot,'examples/physics-rigid-manifold-refusal/archive.mjs')));
  const previousFreeze=JSON.parse(await readFile(resolve(parentRoot,'examples/physics-rigid-manifold-refusal/frozen-inputs.json')));
  const previous=await previousModule.loadArchive(previousDirectory,previousFreeze);
  assert.equal(previous.reports.reduce((s,r)=>s+r.states.length,0),frozen.acceptedInputStates);
  const bytes=await readFile(resolve(directory,'manifest.json'));verify(bytes,frozen.archiveManifestSha256,'1226 manifest');const manifest=JSON.parse(bytes);
  assert.equal(Object.keys(manifest).length,26);assert.deepEqual((await readdir(directory)).sort(),[...Object.keys(manifest),'manifest.json'].sort());
  for(const [name,hash] of Object.entries(manifest)){assert.match(name,/^[A-Za-z0-9.-]+$/);verify(await readFile(resolve(directory,name)),hash,name);}
  const provenance=JSON.parse(await readFile(resolve(directory,'provenance.json')));assert.equal(provenance.measuredHead,frozen.archiveMeasuredHead);assert.equal(provenance.consumerExit,0);
  assert.equal(provenance.actualEncounterReferences,frozen.satHitInstances);assert.equal(provenance.worldStepped,false);
  const reports=[];
  for(const graph of ['source','source-repeat','compiled-dependencies']) for(const scene of ['ALIGNED','OFFSET','YAW']) {
    const name=`${graph}-${scene}-report.json`,plain=gunzipSync(await readFile(resolve(directory,name+'.gz')));verify(plain,provenance.uncompressedArtifactHashes[name],name);
    const report=JSON.parse(plain),raw=await readFile(resolve(directory,`${graph}-${scene}-working.f64le`));assert.equal(report.graph,graph);assert.equal(report.scene,scene);
    assert.equal(report.attemptedStep,frozen.expectedFailures[scene]);assert.equal(report.worldStepped,false);assert.equal(report.modelGO,false);
    const workingBodies=restoreWorking(report,raw);const prior=previous.reports.find(r=>r.report.graph===graph&&r.report.scene===scene);
    const {reconstruct}=await import(pathToFileURL(resolve(parentRoot,'examples/physics-rigid-manifold-refusal/reconstruct.mjs')));
    reports.push({report,raw,workingBodies,previousConfig:prior.report.config,previousLast:prior.states.at(-1),reconstruct});
  }
  for(const scene of ['ALIGNED','OFFSET','YAW']) {
    const rows=reports.filter(r=>r.report.scene===scene),{graph,...first}=rows[0].report;
    for(const row of rows.slice(1)){const {graph,...next}=row.report;assert.deepEqual(next,first);assert.deepEqual(row.raw,rows[0].raw);assert.deepEqual(row.workingBodies,rows[0].workingBodies);}
  }
  return {manifest,provenance,reports,previousFiles:Object.keys(previous.manifest).length,previousAcceptedStates:frozen.acceptedInputStates};
}
