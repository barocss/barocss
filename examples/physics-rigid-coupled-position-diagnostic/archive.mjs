import {readFile,readdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {ArchiveError,digest,restoreState,rawState} from '../physics-rigid-feature-penetration-diagnostic/archive.mjs';
import {restoreWorking} from '../physics-rigid-feature-geometry/archive.mjs';
import {fixture} from '../physics-rigid-contact-reference/fixtures.mjs';
export {ArchiveError,digest,rawState};
export const PARENT={manifestPath:'evidence/native-ecc4dccc/manifest.json',manifestSha256:'327ab9e319b9d7e2e3d63309fef682216751fe8d88cc7208bb730e25606d473f',base:'201681689d398f8b2a9e3472579076c8f4fa43af',measuredSource:'ecc4dccc7a50a5753c236647be3b491a4fafd3fa',native:'d2e6f59aaa30164db4eb8ae971c1d03b5c2c86be',graphs:['source','source-repeat','compiled-dependencies'],scenes:['ALIGNED','OFFSET','YAW'],failures:{ALIGNED:5,OFFSET:3,YAW:4},artifactCount:63,frameBytes:936,ids:['b0','b1','b2','b3','b4','b5','b6','b7','floor']};
export const ARCHIVE_MESSAGES={manifest:'coupled archive manifest is invalid',manifestHash:'coupled archive manifest hash mismatch',fileSet:'coupled archive file set mismatch',path:'coupled archive artifact path is invalid',artifactHash:'coupled archive artifact hash mismatch',decoded:'coupled archive decoded artifact is invalid',decodedHash:'coupled archive decoded artifact hash mismatch',provenance:'coupled archive provenance is invalid',report:'coupled archive report identity is invalid',cursor:'coupled archive cursor or attempt mapping is invalid',raw:'coupled archive raw layout or byte count is invalid',rawHash:'coupled archive raw stream hash mismatch',body:'coupled archive body metadata is invalid',pose:'coupled archive coupled pose correspondence is invalid',rows:'coupled archive row mapping is invalid',result:'coupled archive result or certificate is invalid'};
export function requireArchive(condition,key){if(!condition)throw new ArchiveError(ARCHIVE_MESSAGES[key]);}
export const dense=(a,n)=>Array.isArray(a)&&Object.getPrototypeOf(a)===Array.prototype&&a.length===n&&Reflect.ownKeys(a).length===n+1&&Array.from(a).every(Number.isFinite);
const sameJSON=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function parseJSON(bytes,key){try{return JSON.parse(bytes);}catch(error){if(error instanceof SyntaxError)throw new ArchiveError(ARCHIVE_MESSAGES[key]);throw error;}}
export function validateFiles(files){
  const manifestBytes=files.get(PARENT.manifestPath);requireArchive(Buffer.isBuffer(manifestBytes)&&digest(manifestBytes)===PARENT.manifestSha256,'manifestHash');
  const manifest=parseJSON(manifestBytes,'manifest');requireArchive(manifest&&manifest.base===PARENT.base&&manifest.measuredSource===PARENT.measuredSource&&manifest.verdict==='NUMERICAL_NO_GO'&&manifest.sourceUnchanged===true&&Array.isArray(manifest.artifacts)&&manifest.artifacts.length===PARENT.artifactCount,'manifest');
  const names=[];for(const row of manifest.artifacts){requireArchive(row&&typeof row.path==='string'&&(row.path==='RESULT.md'||/^evidence\/native-ecc4dccc\/[A-Za-z0-9.-]+$/.test(row.path))&&row.path!==PARENT.manifestPath,'path');names.push(row.path);}
  requireArchive(new Set(names).size===names.length,'path');requireArchive(sameJSON([...files.keys()].sort(),[...names,PARENT.manifestPath].sort()),'fileSet');
  const decoded=new Map();
  for(const row of manifest.artifacts)decoded.set(row.path,decodeArtifact(row,files.get(row.path)));
  return {manifest,decoded};
}
export function decodeArtifact(row,bytes){
  requireArchive(Buffer.isBuffer(bytes)&&Number.isInteger(row.bytes)&&bytes.length===row.bytes&&digest(bytes)===row.sha256,'artifactHash');let plain=bytes;
  if(row.path.endsWith('.gz')){try{plain=gunzipSync(bytes);}catch(error){if(error.code==='Z_DATA_ERROR'||error.code==='Z_BUF_ERROR')throw new ArchiveError(ARCHIVE_MESSAGES.decoded);throw error;}requireArchive(Number.isInteger(row.decodedBytes)&&plain.length===row.decodedBytes&&digest(plain)===row.decodedSha256,'decodedHash');}
  return Buffer.from(plain);
}
function reportPath(name){return 'evidence/native-ecc4dccc/'+name;}
export function validateReport(report,graph,scene){
  const failure=PARENT.failures[scene];requireArchive(report&&report.graph===graph&&report.scene===scene&&sameJSON(report.config,fixture(scene))&&sameJSON(report.ids,PARENT.ids)&&report.acceptedSnapshots===failure+1&&report.attemptedSteps===failure&&report.baseNumericalGO===false&&report.failure?.kind==='independent-quality'&&report.failure.step===failure&&report.failure.reference?.ok===true&&report.failure.reference.metrics?.referencePrecisionResolved===true,'report');
  requireArchive(report.rawLayout?.type==='Float64'&&report.rawLayout.endian==='little'&&report.rawLayout.componentsPerBody===13&&report.rawLayout.signedZerosPreserved===true&&sameJSON(report.rawLayout.fields,['positionM:3','velocityMps:3','orientation:4','angularVelocityRadps:3']),'raw');
  requireArchive(Array.isArray(report.states)&&report.states.length===failure+1&&Array.isArray(report.attempts)&&report.attempts.length===failure&&Array.isArray(report.attemptOutcomes)&&report.attemptOutcomes.length===failure&&Array.isArray(report.stats)&&report.stats.length===failure&&Array.isArray(report.observations)&&report.observations.length===failure+1&&Array.isArray(report.linearReferences)&&report.linearReferences.length===failure,'cursor');
  for(let i=0;i<report.attemptOutcomes.length;i++){const o=report.attemptOutcomes[i],a=report.attempts[i];requireArchive(o.attemptedStep===i+1&&o.acceptedStep===i+1&&o.outcome==='accepted'&&o.phaseReached===true&&a.tests===36&&a.error===null&&a.solution?.ok===true&&a.solution.status==='SOLVED'&&a.solution.worldStepped===false,'cursor');}
  return failure;
}
export function restoreWorkingFrame(bodies,raw){
  requireArchive(Buffer.isBuffer(raw)&&raw.length===936&&Array.isArray(bodies)&&bodies.length===9,'raw');let offset=0;
  for(const b of bodies){requireArchive(b!==null&&typeof b==='object','body');for(const [field,n]of [['positionM',3],['velocityMps',3],['orientation',4],['angularVelocityRadps',3]]){requireArchive(dense(b[field],n),'body');for(let i=0;i<n;i++){const v=raw.readDoubleLE(offset);offset+=8;requireArchive(Number.isFinite(v)&&v===b[field][i],'pose');}}}
  return restoreWorking({workingBodies:bodies,workingRawSha256:digest(raw)},raw);
}
export function restoreAcceptedFrame(state,raw,index){
  requireArchive(state!==null&&typeof state==='object'&&state.stepIndex===index&&state.timeSeconds===index*(1/120),'cursor');
  requireArchive(Array.isArray(state.bodies)&&state.bodies.length===9&&Array.from(state.bodies).every((b,i)=>b!==null&&typeof b==='object'&&b.id===PARENT.ids[i]),'body');
  return restoreState(state,raw,PARENT.ids,index);
}
export function decodeArchive(files){
  const {manifest,decoded}=validateFiles(files),provenance=parseJSON(decoded.get(reportPath('provenance.json')),'provenance');requireArchive(provenance?.base===PARENT.base&&provenance.measuredSource===PARENT.measuredSource&&provenance.verdict==='NUMERICAL_NO_GO'&&provenance.sourcePins===356&&provenance.emittedFiles===504&&provenance.execution?.consumerExit===0&&provenance.execution.numericalCampaignCount===1&&provenance.sourceRepeatCompiledParity===true,'provenance');
  const sourceFreeze=decoded.get(reportPath('source-freeze.json'));requireArchive(digest(sourceFreeze)===provenance.sourceFreezeSha256,'provenance');
  const rows=[];
  for(const graph of PARENT.graphs)for(const scene of PARENT.scenes){
    const report=parseJSON(decoded.get(reportPath(graph+'-'+scene+'-report.json.gz')),'report'),failure=validateReport(report,graph,scene);
    const raw=decoded.get(reportPath(graph+'-'+scene+'-accepted.f64le.gz')),workingRaw=decoded.get(reportPath(graph+'-'+scene+'-working.f64le.gz')),attemptedRaw=decoded.get(reportPath(graph+'-'+scene+'-attempted-accepted.f64le.gz'));
    for(const [bytes,count,length,hash]of [[raw,failure+1,report.acceptedRawBytes,report.acceptedRawSha256],[workingRaw,failure,report.workingRawBytes,report.workingRawSha256],[attemptedRaw,failure,report.attemptedAcceptedRawBytes,report.attemptedAcceptedRawSha256]]){requireArchive(Buffer.isBuffer(bytes)&&bytes.length===count*PARENT.frameBytes&&bytes.length===length,'raw');requireArchive(digest(bytes)===hash,'rawHash');}
    const states=report.states.map((state,index)=>restoreAcceptedFrame(state,raw.subarray(index*936,(index+1)*936),index));
    for(let i=0;i<failure;i++){requireArchive(attemptedRaw.subarray(i*936,(i+1)*936).equals(raw.subarray((i+1)*936,(i+2)*936)),'pose');}
    const attempts=report.attempts.map((a,i)=>{const slice=workingRaw.subarray(i*936,(i+1)*936);requireArchive(Array.isArray(a.workingBodies)&&a.workingBodies.length===9&&Array.from(a.workingBodies).every((b,j)=>b!==null&&typeof b==='object'&&b.id===PARENT.ids[j]),'body');const workingBodies=restoreWorkingFrame(a.workingBodies,slice);return {...structuredClone(a),workingBodies};});
    const beforeOffset=(failure-1)*936,finalOffset=failure*936;
    rows.push({graph,scene,report,states,attempts,frames:{previous:{role:'previous-accepted',stepIndex:failure-1,timeSeconds:(failure-1)*(1/120),state:states[failure-1]},preCoupled:{role:'pre-coupled-working',attemptedStep:failure,stepIndex:failure,timeSeconds:failure*(1/120),workingBodies:attempts[failure-1].workingBodies},final:{role:'failed-accepted',stepIndex:failure,timeSeconds:failure*(1/120),state:states[failure]}},problem:structuredClone(attempts[failure-1].problem),archivedSolution:structuredClone(attempts[failure-1].solution),previousProblem:structuredClone(attempts[failure-2].problem),rawSlices:{previous:Buffer.from(raw.subarray(beforeOffset,beforeOffset+936)),preCoupled:Buffer.from(workingRaw.subarray(beforeOffset,beforeOffset+936)),final:Buffer.from(raw.subarray(finalOffset,finalOffset+936))}});
  }
  return {rows,manifest,provenance,files:new Map([...files].map(([k,v])=>[k,Buffer.from(v)]))};
}
export async function loadArchive(scopeRoot){
  const files=new Map();for(const name of await readdir(resolve(scopeRoot,'evidence/native-ecc4dccc')))files.set(reportPath(name),await readFile(resolve(scopeRoot,reportPath(name))));files.set('RESULT.md',await readFile(resolve(scopeRoot,'RESULT.md')));return decodeArchive(files);
}
