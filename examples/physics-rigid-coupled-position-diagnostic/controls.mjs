import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ArchiveError,ARCHIVE_MESSAGES,PARENT,validateFiles,decodeArtifact,validateReport,restoreWorkingFrame,rawState} from './archive.mjs';
import {prepareFrames} from './frames.mjs';
import {joinRows} from './coverage.mjs';
import {comparePair,pairAgrees,compareCoverage} from './compare.mjs';
import {verifyFreeze} from './bundle.mjs';
export async function controls(m,pairOracle,input,here){
  const receipt=[],cases=JSON.parse(await readFile(resolve(here,'../physics-rigid-feature-penetration-diagnostic/reference-controls.json')));
  for(const c of cases){const ref=await pairOracle.ask({a:c.a,b:c.b});if(c.invalid){assert.equal(ref.ok,false);assert.equal(ref.code,c.expectedErrorCode);assert.equal(ref.message,c.expectedErrorMessage);receipt.push({id:c.id,reference:ref});continue;}
    const body=v=>{const p=m.parseBody({...structuredClone(v),kind:'dynamic',massKg:1,restitution:0});if(v.orientation)p.orientation=[...v.orientation];return p;};const a=body(c.a),b=body(c.b),before=structuredClone([a,b]),actual=m.inspectPair(a,b),compared=comparePair(actual,ref,{legacyNormalizationControl:c.expectedNormalizationDifference===true});assert.equal(pairAgrees(compared),true,c.id);assert.deepEqual([a,b],before);const held=structuredClone(actual);if(actual.hit){actual.hit.normal[0]=999;actual.selection.hit.pointM[0]=999;}assert.deepEqual(m.inspectPair(a,b),held,'detector output is detached');receipt.push({id:c.id,actual:held,reference:ref,compared});
  }
  function refusal(id,invoke,message){assert.throws(invoke,e=>e instanceof ArchiveError&&e.code==='ARCHIVE_INVALID'&&e.message===message,id);receipt.push({id,code:'ARCHIVE_INVALID',message});}
  const cloneFiles=()=>new Map([...input.files].map(([k,v])=>[k,Buffer.from(v)]));
  for(const [id,edit,key]of [['manifest',f=>f.set(PARENT.manifestPath,Buffer.from('{}')),'manifestHash'],['missing',f=>f.delete('RESULT.md'),'fileSet'],['extra',f=>f.set('extra',Buffer.from('extra')),'fileSet'],['artifact',f=>f.set('RESULT.md',Buffer.from('bad')),'artifactHash']]){const files=cloneFiles();edit(files);refusal(id,()=>validateFiles(files),ARCHIVE_MESSAGES[key]);}
  const artifact=input.manifest.artifacts.find(r=>r.path.endsWith('source-ALIGNED-report.json.gz'));refusal('decoded-hash',()=>decodeArtifact({...artifact,decodedSha256:'0'.repeat(64)},input.files.get(artifact.path)),ARCHIVE_MESSAGES.decodedHash);
  const row=input.rows.find(r=>r.graph==='source'&&r.scene==='ALIGNED'),prepared=prepareFrames(m,row),report=structuredClone(row.report);report.attemptOutcomes[0].attemptedStep=99;refusal('cursor-attempt',()=>validateReport(report,row.graph,row.scene),ARCHIVE_MESSAGES.cursor);
  const nonfinite=Buffer.from(row.rawSlices.preCoupled);nonfinite.writeDoubleLE(NaN,0);refusal('raw-nonfinite',()=>restoreWorkingFrame(row.frames.preCoupled.workingBodies,nonfinite),ARCHIVE_MESSAGES.pose);refusal('raw-truncated',()=>restoreWorkingFrame(row.frames.preCoupled.workingBodies,row.rawSlices.preCoupled.subarray(0,-1)),ARCHIVE_MESSAGES.raw);
  const changedBodies=structuredClone(row.frames.preCoupled.workingBodies);changedBodies[0].positionM[0]+=1;refusal('json-raw',()=>restoreWorkingFrame(changedBodies,row.rawSlices.preCoupled),ARCHIVE_MESSAGES.pose);
  const badMetadata=structuredClone(row);badMetadata.frames.preCoupled.workingBodies[0].inverseMass=2;refusal('metadata',()=>prepareFrames(m,badMetadata),ARCHIVE_MESSAGES.body);
  const badStatic=structuredClone(row);badStatic.frames.final.state.bodies.at(-1).positionM[0]=1;refusal('static-pose',()=>prepareFrames(m,badStatic),ARCHIVE_MESSAGES.pose);
  const badVelocity=structuredClone(row);badVelocity.frames.final.state.bodies[0].velocityMps[0]+=1;refusal('phase-velocity',()=>prepareFrames(m,badVelocity),ARCHIVE_MESSAGES.pose);
  const pre=prepared.frames[1].bodies,preObs=prepared.pairs.map(([a,b])=>({aId:pre[a].id,bId:pre[b].id,actual:m.inspectPair(pre[a],pre[b])}));joinRows(row.problem,preObs);
  for(const [id,edit]of [['row-id',p=>p.rows[0].bId='missing'],['row-depth',p=>p.rows[0].depthM+=1e-6],['row-normal',p=>p.rows[0].normal=[1,0,0]],['row-missing',p=>p.rows.pop()],['row-duplicate',p=>p.rows.push(structuredClone(p.rows[0]))]]){const p=structuredClone(row.problem);edit(p);refusal(id,()=>joinRows(p,preObs),ARCHIVE_MESSAGES.rows);}
  const before=Buffer.from(row.rawSlices.final),state=structuredClone(row.frames.final.state),expected=rawState(state);state.bodies[0].positionM[0]=99;assert.ok(before.equals(expected));assert.ok(rawState(row.frames.final.state).equals(before));
  const touch=receipt.find(r=>r.id==='aligned-exact-touch');const precision=structuredClone(touch.reference);precision.ok=false;precision.code='REFERENCE_PRECISION';precision.precisionMaxDifferenceM=1e-20;assert.equal(comparePair(touch.actual,precision).precisionAgrees,false);const nullDepth=structuredClone(touch.reference);nullDepth.raw.depthM=null;refusal('reference-null-depth',()=>comparePair(touch.actual,nullDepth),ARCHIVE_MESSAGES.result);
  const frozen=JSON.parse(await readFile(resolve(here,'source-freeze.json'))),changed=structuredClone(frozen);changed.sources.find(r=>r.path.endsWith('/entry.ts')&&r.path.includes('coupled-position-diagnostic')).sha256='0'.repeat(64);await assert.rejects(()=>verifyFreeze(changed),e=>e.code==='ERR_ASSERTION'&&e.message.includes('source drift:'));
  return {receipt,sourceDriftRefused:true,archiveInputCopies:true,originalInputCopies:true,exactFrameRawPreserved:true,legacyNormalizationExceptionOnlyControl:true,worldCreated:false,worldStepped:false};
}
