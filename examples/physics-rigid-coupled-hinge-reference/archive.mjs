import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {loadArchive as historicalLoad,selectRecords,digest,ArchiveError,rawBodies,restoreFrame,validateFiles} from '../physics-rigid-hinge-limit-diagnostic/archive.mjs';
export {selectRecords,digest,ArchiveError,rawBodies,restoreFrame,validateFiles};
export const DIAGNOSTIC_NATIVE='4e4f307097eb54b9173552edad68a704457a7f76';
export const DIAGNOSTIC_MANIFEST_SHA='4053c025ac041b468f6b68fafd676b4fce382ede58f11b9d9f82edf2c8075fe0';
export const DIAGNOSTIC_SOURCE_SHA='eb679d523ad0815bd36425191d94b429262c8f364d235bd16e5b9e65f3b3a333';
const old='examples/physics-rigid-hinge-limit-diagnostic';
export async function validateDiagnostic(root){
 const dir=resolve(root,old,'evidence/native-3245bf5a'),bytes=await readFile(resolve(dir,'manifest.json'));assert.equal(digest(bytes),DIAGNOSTIC_MANIFEST_SHA,'diagnostic manifest identity');const manifest=JSON.parse(bytes);assert.equal(Object.keys(manifest).length,27);
 assert.deepEqual((await readdir(dir)).sort(),[...Object.keys(manifest),'manifest.json'].sort());for(const [name,hash]of Object.entries(manifest))assert.equal(digest(await readFile(resolve(dir,name))),hash,`diagnostic artifact: ${name}`);
 const frozen=await readFile(resolve(root,old,'frozen-source.json'));assert.equal(digest(frozen),DIAGNOSTIC_SOURCE_SHA);const pins=JSON.parse(frozen);assert.equal(Object.keys(pins).length,286);
 for(const [path,hash]of Object.entries(pins)){
  const absolute=resolve(root,old,path),relative=absolute.slice(resolve(root).length+1);const original=execFileSync('git',['show',`${DIAGNOSTIC_NATIVE}:${relative}`],{cwd:root});assert.equal(digest(original),hash,`historical diagnostic source: ${relative}`);
  if(relative.startsWith(old+'/'))assert.equal(digest(await readFile(absolute)),hash,`adopted diagnostic source: ${relative}`);
 }
 const summary=JSON.parse(await readFile(resolve(dir,'summary.json')));assert.equal(summary.diagnosticAgreement,true);assert.equal(summary.projectionCalls,24);assert.equal(summary.worldStepped,false);
 return {native:DIAGNOSTIC_NATIVE,manifestSha256:DIAGNOSTIC_MANIFEST_SHA,sourceSha256:DIAGNOSTIC_SOURCE_SHA,sourcePins:286,artifacts:27,files:28};
}
export async function loadInputs(parentRoot,root){
 const diagnostic=await validateDiagnostic(root);
 // Historical whole-graph pins are checked against the immutable historical checkout.
 // Current whole CAD/Physics source is pinned separately by this candidate's freeze.
 const parent=await historicalLoad(parentRoot,parentRoot);
 for(const [path,hash]of Object.entries(parent.provenance.actualOriginalSourceHashes))assert.equal(digest(await readFile(resolve(root,path))),hash,`current original helper source: ${path}`);
 for(const [path,hash]of Object.entries(parent.provenance.actualEmittedDependencyHashes))assert.equal(digest(await readFile(resolve(root,path))),hash,`current original helper emitted: ${path}`);
 return {...parent,diagnostic,records:selectRecords(parent)};
}
