import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
export const digest=b=>createHash('sha256').update(b).digest('hex');
export class ArchiveError extends Error {constructor(message){super(message);this.name='ArchiveError';this.code='ARCHIVE_INVALID';}}
function requireArchive(condition,message){if(!condition)throw new ArchiveError(message);}
export function validateFiles(files,freeze){
  const manifestBytes=files.get('manifest.json');requireArchive(Buffer.isBuffer(manifestBytes)&&digest(manifestBytes)===freeze.archiveManifestSha256,'archive manifest hash mismatch');
  const manifest=JSON.parse(manifestBytes);requireArchive(Object.keys(manifest).length===38,'archive manifest entry count mismatch');
  requireArchive(JSON.stringify([...files.keys()].sort())===JSON.stringify([...Object.keys(manifest),'manifest.json'].sort()),'archive file set mismatch');
  for(const [name,hash] of Object.entries(manifest)){requireArchive(/^[A-Za-z0-9.-]+$/.test(name),'archive file name invalid');requireArchive(digest(files.get(name))===hash,'archive file hash mismatch');}
  return manifest;
}
export function decodeReports(files,freeze){
  validateFiles(files,freeze);const provenance=JSON.parse(files.get('provenance.json'));
  requireArchive(provenance.measuredHead===freeze.archiveMeasuredHead&&provenance.consumerExit===0&&provenance.baseNumericalGO===false&&provenance.actualCases===9&&provenance.acceptedInputStates===609,'archive provenance mismatch');
  const rows=[];
  for(const graph of ['source','source-repeat','compiled-dependencies'])for(const scene of ['ALIGNED','OFFSET','YAW']){
    const reportBytes=gunzipSync(files.get(`${graph}-${scene}-report.json.gz`));requireArchive(digest(reportBytes)===provenance.uncompressedArtifactHashes[`${graph}-${scene}-report.json`],'archive report hash mismatch');
    const report=JSON.parse(reportBytes),raw=gunzipSync(files.get(`${graph}-${scene}-fields.f64le.gz`));
    requireArchive(report.rawLayout.type==='Float64'&&report.rawLayout.endian==='little'&&report.rawLayout.componentsPerBody===13&&report.rawLayout.signedZerosPreserved===true,'archive raw layout mismatch');
    requireArchive(report.graph===graph&&report.scene===scene&&report.states.length===freeze.snapshots[scene]&&report.acceptedSnapshots===freeze.snapshots[scene],'archive report identity mismatch');
    requireArchive(report.failure.kind==='independent-quality'&&report.failure.step===freeze.firstFailures[scene]&&!report.numericalGO,'archive failure mismatch');
    requireArchive(report.ids.length===9&&new Set(report.ids).size===9&&report.ids.join(',')==='b0,b1,b2,b3,b4,b5,b6,b7,floor','archive body IDs mismatch');
    requireArchive(raw.length===report.states.length*9*13*8&&raw.length===report.rawBytes,'archive raw length mismatch');
    requireArchive(digest(raw)===report.rawSha256&&digest(raw)===provenance.rawFieldHashes[`${graph}-${scene}`],'archive raw hash mismatch');
    const states=report.states.map((state,index)=>restoreState(state,raw.subarray(index*936,(index+1)*936),report.ids,index));
    requireArchive(report.globalContactStats.length===states.length&&report.warmCacheStats.length===states.length&&report.projectionStats.length===states.length,'archive counter length mismatch');
    rows.push({graph,scene,report,states,raw:Buffer.from(raw)});
  }
  requireArchive(rows.reduce((n,r)=>n+r.states.length,0)===609,'archive accepted state count mismatch');
  for(const scene of ['ALIGNED','OFFSET','YAW']){const rowsByScene=rows.filter(r=>r.scene===scene);for(const r of rowsByScene.slice(1)){assert.deepEqual(r.states,rowsByScene[0].states);assert.deepEqual(r.raw,rowsByScene[0].raw);}}
  return {rows,provenance};
}
export function restoreState(state,raw,ids,index){
  requireArchive(Buffer.isBuffer(raw)&&raw.length===936,'archive raw length mismatch');
  requireArchive(state.stepIndex===index&&state.timeSeconds===index*(1/120),'archive cursor mismatch');
  requireArchive(state.bodies.length===9&&state.bodies.map(b=>b.id).join(',')===ids.join(','),'archive body IDs mismatch');
  const copy=structuredClone(state);let offset=0;
  for(const body of copy.bodies)for(const [field,size] of [['positionM',3],['velocityMps',3],['orientation',4],['angularVelocityRadps',3]]){
    requireArchive(Array.isArray(body[field])&&body[field].length===size,'archive field length mismatch');
    for(let i=0;i<size;i++){const value=raw.readDoubleLE(offset);offset+=8;requireArchive(Number.isFinite(value),'archive raw field nonfinite');requireArchive(value===body[field][i],'archive JSON and raw field mismatch');body[field][i]=value;}
  }
  return copy;
}
export async function loadArchive(directory,freeze,root){
  const names=await readdir(directory),files=new Map();for(const name of names)files.set(name,await readFile(resolve(directory,name)));
  const input=decodeReports(files,freeze);
  for(const [path,hash]of Object.entries(input.provenance.actualOriginalSourceHashes))requireArchive(digest(await readFile(resolve(root,path)))===hash,'archive original source drift');
  for(const [path,hash]of Object.entries(input.provenance.actualEmittedDependencyHashes))requireArchive(digest(await readFile(resolve(root,path)))===hash,'archive emitted dependency drift');
  const parentRoot=resolve(directory,'../..');
  requireArchive(digest(await readFile(resolve(parentRoot,'frozen-hashes.json')))===input.provenance.sourceFreezeSha256,'archive source freeze drift');
  for(const [path,hash]of Object.entries(input.provenance.privateSourceAndReuseHashes))requireArchive(digest(await readFile(resolve(parentRoot,path)))===hash,'archive private source drift');
  return {...input,files};
}
export function rawState(state){const raw=Buffer.alloc(936);let offset=0;for(const b of state.bodies)for(const value of [...b.positionM,...b.velocityMps,...b.orientation,...b.angularVelocityRadps]){raw.writeDoubleLE(value,offset);offset+=8;}return raw;}
