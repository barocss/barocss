import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function verifyHash(bytes,expected,label) {assert.equal(digest(bytes),expected,`${label}: hash mismatch`);}
export function restoreRaw(report,bytes) {
  const states=structuredClone(report.states);
  assert.equal(bytes.length,states.length*report.ids.length*13*8,'raw byte length');
  assert.equal(bytes.length,report.rawBytes);verifyHash(bytes,report.rawSha256,'raw fields');
  let offset=0;
  for(const [step,state] of states.entries()) {
    assert.equal(state.stepIndex,step);assert.equal(state.timeSeconds,step*report.config.fixedStepSeconds);
    assert.deepEqual(state.bodies.map(b=>b.id),report.ids);
    for(const body of state.bodies) for(const [field,size] of [['positionM',3],['velocityMps',3],['orientation',4],['angularVelocityRadps',3]]) {
      assert.equal(body[field].length,size);
      for(let i=0;i<size;i++) {const value=bytes.readDoubleLE(offset);offset+=8;assert.ok(Number.isFinite(value),'finite raw value');assert.ok(value===body[field][i],'raw/JSON numeric mismatch');body[field][i]=value;}
    }
  }
  return states;
}
export async function loadArchive(directory,freeze) {
  const manifestBytes=await readFile(resolve(directory,'manifest.json'));verifyHash(manifestBytes,freeze.archiveManifestSha256,'frozen archive manifest');
  const manifest=JSON.parse(manifestBytes);assert.equal(Object.keys(manifest).length,27);
  assert.deepEqual((await readdir(directory)).sort(),[...Object.keys(manifest),'manifest.json'].sort());
  for(const [name,hash] of Object.entries(manifest)) {assert.match(name,/^[a-zA-Z0-9.-]+$/);verifyHash(await readFile(resolve(directory,name)),hash,name);}
  const provenance=JSON.parse(await readFile(resolve(directory,'provenance.json')));assert.equal(provenance.measuredHead,freeze.archiveMeasuredHead);assert.equal(provenance.producerExit,0);assert.equal(provenance.modelNO_GO,true);
  const reports=[];
  for(const graph of ['source','source-repeat','compiled-dependencies']) for(const scene of ['ALIGNED','OFFSET','YAW']) {
    const report=JSON.parse(gunzipSync(await readFile(resolve(directory,`${graph}-${scene}-report.json.gz`))));
    assert.equal(report.graph,graph);assert.equal(report.scene,scene);assert.equal(report.numericalGO,false);
    assert.deepEqual(report.rawLayout,{type:'Float64',endian:'little',componentsPerBody:13,fields:['positionM:3','velocityMps:3','orientation:4','angularVelocityRadps:3'],signedZerosPreserved:true});
    assert.equal(report.failure.kind,'producer-refusal');assert.equal(report.failure.attemptedStep,freeze.expectedFailures[scene]);assert.equal(report.failure.acceptedStep,report.failure.attemptedStep-1);assert.equal(report.failure.retained,true);assert.equal(report.failure.code,'NUMERIC_LIMIT');assert.equal(report.failure.message,'private global contact island requires face manifolds');assert.equal(report.acceptedSnapshots,report.states.length);assert.equal(report.states.length,report.failure.attemptedStep);
    const raw=gunzipSync(await readFile(resolve(directory,`${graph}-${scene}-fields.f64le.gz`)));const states=restoreRaw(report,raw);
    reports.push({report,raw,states});
  }
  for(const scene of ['ALIGNED','OFFSET','YAW']) {
    const rows=reports.filter(r=>r.report.scene===scene);
    const {graph,...first}=rows[0].report;
    for(const other of rows.slice(1)) {const {graph,...current}=other.report;assert.deepEqual(current,first,'archive graph metadata parity');assert.deepEqual(other.raw,rows[0].raw,'archive graph raw parity');assert.deepEqual(other.states,rows[0].states,'restored raw parity');}
  }
  return {manifest,provenance,reports};
}
