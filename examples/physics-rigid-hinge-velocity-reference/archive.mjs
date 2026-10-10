import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {loadInputs as adoptedLoadInputs} from '../physics-rigid-coupled-hinge-reference/archive.mjs';
import {digest,ArchiveError,rawBodies,restoreFrame,validateFiles} from '../physics-rigid-hinge-limit-diagnostic/archive.mjs';
export {digest,ArchiveError,rawBodies,restoreFrame,validateFiles};
export const POSE_NATIVE='1381164c5752671c7f1197f27d8a8894537b01d9';
export const POSE_SOURCE='830a911d333ab5f3a8a82c790068170a181b19dc';
export const POSE_MANIFEST_SHA='b7f8ed96b71c2a14e976ff37423e01dee18027b94485e2fabeee74a3d977cbe0';
export const POSE_DIRECTORY='examples/physics-rigid-coupled-hinge-reference';
function requireArchive(ok,message){if(!ok)throw new ArchiveError(message);}
function parse(bytes,label){try{return JSON.parse(bytes);}catch(error){if(error instanceof SyntaxError)throw new ArchiveError(`${label} invalid JSON`);throw error;}}
export function validatePoseFiles(files){
 const bytes=files.get('manifest.json');requireArchive(Buffer.isBuffer(bytes)&&digest(bytes)===POSE_MANIFEST_SHA,'pose archive manifest hash mismatch');
 const manifest=parse(bytes,'pose archive manifest');requireArchive(manifest.issue===1309&&manifest.measuredSource===POSE_SOURCE&&manifest.verdict==='NUMERICAL_NO_GO'&&manifest.sourceUnchanged===true&&Array.isArray(manifest.artifacts)&&manifest.artifacts.length===40,'pose archive manifest identity mismatch');
 const names=manifest.artifacts.map(row=>row.path);requireArchive(new Set(names).size===40&&JSON.stringify([...files.keys()].sort())===JSON.stringify([...names,'manifest.json'].sort()),'pose archive file set mismatch');
 for(const row of manifest.artifacts){
  requireArchive(typeof row.path==='string'&&/^[A-Za-z0-9._/-]+$/.test(row.path)&&!row.path.split('/').includes('..')&&!row.path.startsWith('/'),'pose archive filename invalid');
  const artifact=files.get(row.path);requireArchive(Buffer.isBuffer(artifact)&&artifact.length===row.bytes&&digest(artifact)===row.sha256,'pose archive artifact hash mismatch');
  if(Object.hasOwn(row,'decodedBytes')||Object.hasOwn(row,'decodedSha256')){let decoded;try{decoded=gunzipSync(artifact);}catch(error){if(error?.code?.startsWith('Z_'))throw new ArchiveError('pose archive gzip invalid');throw error;}requireArchive(decoded.length===row.decodedBytes&&digest(decoded)===row.decodedSha256,'pose archive decoded hash mismatch');}
 }
 return manifest;
}
export async function validatePoseNative(root,parentRoot){
 const directory=resolve(root,POSE_DIRECTORY),evidence=resolve(directory,'evidence/native-830a911d'),bytes=await readFile(resolve(evidence,'manifest.json'));requireArchive(digest(bytes)===POSE_MANIFEST_SHA,'pose archive manifest hash mismatch');const manifest=parse(bytes,'pose archive manifest');
 requireArchive(Array.isArray(manifest.artifacts)&&manifest.artifacts.length===40,'pose archive manifest identity mismatch');
 const files=new Map([['manifest.json',bytes]]);for(const row of manifest.artifacts){requireArchive(typeof row.path==='string'&&/^[A-Za-z0-9._/-]+$/.test(row.path)&&!row.path.split('/').includes('..')&&!row.path.startsWith('/'),'pose archive filename invalid');files.set(row.path,await readFile(resolve(directory,row.path)));}
 validatePoseFiles(files);
 const evidenceNames=manifest.artifacts.filter(row=>row.path.startsWith('evidence/native-830a911d/')).map(row=>row.path.slice('evidence/native-830a911d/'.length));
 async function actualNames(path,prefix=''){const names=[];for(const entry of await readdir(path,{withFileTypes:true})){if(entry.isDirectory())names.push(...await actualNames(resolve(path,entry.name),prefix+entry.name+'/'));else names.push(prefix+entry.name);}return names;}
 assert.deepEqual((await actualNames(evidence)).sort(),[...evidenceNames,'manifest.json'].sort(),'exact pose evidence file set');
 const frozenBytes=await readFile(resolve(directory,'frozen-source.json')),pins=parse(frozenBytes,'pose source freeze');assert.equal(Object.keys(pins).length,417);
 for(const [path,sha256]of Object.entries(pins)){
  const absolute=resolve(directory,path);let original;
  if(absolute.startsWith(resolve(root)+'/')){const repositoryPath=relative(root,absolute);original=execFileSync('git',['show',`${POSE_NATIVE}:${repositoryPath}`],{cwd:root});if(repositoryPath.startsWith(POSE_DIRECTORY+'/'))assert.equal(digest(await readFile(absolute)),sha256,`adopted pose source: ${repositoryPath}`);}
  else {assert.ok(absolute.startsWith(resolve(parentRoot)+'/'),'explicit external archive path');original=execFileSync('git',['show',`0de27c51574e2da6b09966c7ef0c28435d9c9592:${relative(parentRoot,absolute)}`],{cwd:parentRoot});assert.equal(digest(await readFile(absolute)),sha256,`external pose pin: ${path}`);}
  assert.equal(digest(original),sha256,`historical pose source: ${path}`);
 }
 const summary=parse(gunzipSync(files.get('evidence/native-830a911d/summary.json.gz')),'pose summary');assert.equal(summary.detachedPoseOnlyGO,false);assert.equal(summary.completedArchivedRecords,24);assert.equal(summary.sourceRepeatCompiledEqual,true);assert.equal(summary.worldStepped,false);assert.equal(summary.firstFailure.refusal,null);assert.ok(summary.firstFailure.output);
 for(const graph of ['source','source-repeat','compiled-dependencies']){
  const report=parse(gunzipSync(files.get(`evidence/native-830a911d/${graph}-report.json.gz`)),'pose report');assert.equal(report.observations.length,24);assert.equal(report.failure.name,'admitted-incoherent-anchors-orbital-loss');assert.equal(report.failure.refusal,null);assert.equal(report.failure.reference.resolved,true);assert.equal(report.failure.reference.ok,false);
  for(const side of ['before','after'])assert.equal(files.get(`evidence/native-830a911d/${graph}-${side}.f64le`).length,24*208);
 }
 return {native:POSE_NATIVE,measuredSource:POSE_SOURCE,manifestSha256:digest(bytes),sourceFreezeSha256:digest(frozenBytes),sourcePins:417,artifacts:40,files:41,filesMap:files};
}
export async function loadInputs(parentRoot,root){
 const pose=await validatePoseNative(root,parentRoot),old=await adoptedLoadInputs(parentRoot,root);
 assert.equal(old.records.length,24);for(const graph of ['source','source-repeat','compiled-dependencies'])assert.equal(old.records.filter(row=>row.archiveGraph===graph).length,8);
 return {...old,pose};
}
