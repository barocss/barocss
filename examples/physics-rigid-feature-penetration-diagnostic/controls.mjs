import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {ArchiveError,validateFiles,decodeReports,restoreState,rawState} from './archive.mjs';
import {compareObservation} from './compare.mjs';
import {validateSource} from './bundle.mjs';
export async function controls(m,oracle,input,freeze,here){
 const cases=JSON.parse(await readFile(resolve(here,'reference-controls.json')));const rows=[];
 for(const item of cases){
  const reference=await oracle.ask({a:item.a,b:item.b});
  if(item.invalid){assert.equal(reference.ok,false);assert.equal(reference.code,item.expectedErrorCode);assert.equal(reference.message,item.expectedErrorMessage);rows.push({id:item.id,reference});continue;}
  const body=value=>{const parsed=m.parseBody({...structuredClone(value),kind:'dynamic',massKg:1,restitution:0},false);if(value.orientation)parsed.orientation=[...value.orientation];return parsed;};
  const a=body(item.a),b=body(item.b),saved=structuredClone([a,b]),actual=m.inspectPair(a,b);assert.deepEqual([a,b],saved,'read-only detector inputs');
  const compared=compareObservation(actual,reference,{requireNormalizedDepthAgreement:item.expectedNormalizationDifference!==true});assert.equal(compared.selectorBitsAgree,true);assert.equal(compared.depthAgrees,true);assert.equal(compared.separationAgrees,true);assert.equal(compared.precisionAgrees,true);assert.equal(compared.normalizedDepthAgrees,true);
  if(item.expectedNormalizationDifference===true)assert.ok(reference.rawNormalizedDepthDifferenceM>1e-12,'raw quaternion reference distinction');
  if(item.expectedDepthM!==undefined)assert.ok(Math.abs(reference.raw.depthM-item.expectedDepthM)<=1e-12,`analytic ${item.id}`);
  if(item.expectedMarginM!==undefined)assert.ok(Math.abs(reference.raw.marginM-item.expectedMarginM)<=1e-12,`analytic margin ${item.id}`);
  if(item.expectedSeparated===true)assert.equal(reference.raw.separated,true);
  if(item.expectedTouching===true)assert.equal(reference.raw.touching,true);
  if(item.expectedNearParallel===true)assert.ok(reference.raw.nearParallelAxisCount>0);
  const held=structuredClone(actual);if(actual.hit){actual.hit.normal[0]=999;actual.selection.hit.pointM[0]=999;}
  assert.deepEqual(m.inspectPair(a,b),held,'detector detached output');
  rows.push({id:item.id,reference,actual:held,compared});
 }
 const touch=rows.find(r=>r.id==='aligned-exact-touch');const nullMutation=compareObservation({hit:null,selection:null},touch.reference);assert.equal(nullMutation.separationAgrees,false,'null must not agree with exact touching');
 const precisionMutation=structuredClone(touch.reference);precisionMutation.ok=false;precisionMutation.code='REFERENCE_PRECISION';precisionMutation.precisionMaxDifferenceM=1e-20;assert.equal(compareObservation(touch.actual,precisionMutation).precisionAgrees,false,'reference precision disagreement is retained');
 const normalMutation=structuredClone(touch.reference);normalMutation.rawNormalizedDepthDifferenceM=1e-6;assert.equal(compareObservation(touch.actual,normalMutation).normalizedDepthAgrees,false,'convention disagreement is retained');
 const bitMutation=structuredClone(touch.actual);bitMutation.selection.hit.normal[0]=123;assert.equal(compareObservation(bitMutation,touch.reference).selectorBitsAgree,false,'bit disagreement is retained');
 const frozenSource=JSON.parse(await readFile(resolve(here,'frozen-source.json')));await assert.rejects(()=>validateSource({...frozenSource,'entry.ts':'0'.repeat(64)}),e=>e.code==='ERR_ASSERTION'&&e.message.includes('source drift: entry.ts'));
 const rejected=['source-drift'];const badFile=new Map(input.files);badFile.set('source-ALIGNED-report.json.gz',Buffer.from('corrupt'));
 assert.throws(()=>validateFiles(badFile,freeze),e=>e instanceof ArchiveError&&e.message==='archive file hash mismatch');rejected.push('artifact-hash');
 const badManifest=new Map(input.files);badManifest.set('manifest.json',Buffer.from('{}'));assert.throws(()=>validateFiles(badManifest,freeze),e=>e instanceof ArchiveError&&e.message==='archive manifest hash mismatch');rejected.push('manifest-hash');
 const extraFile=new Map(input.files);extraFile.set('extra.json',Buffer.from('{}'));assert.throws(()=>validateFiles(extraFile,freeze),e=>e instanceof ArchiveError&&e.message==='archive file set mismatch');rejected.push('file-set');
 const row=input.rows[0],index=row.states.length-1,raw=Buffer.from(rawState(row.states[index])),original=structuredClone(row.states[index]);
 const refuse=(name,state,bytes,expected)=>{assert.throws(()=>restoreState(state,bytes,row.report.ids,index),e=>e instanceof ArchiveError&&e.message===expected);rejected.push(name);};
 refuse('raw-length',original,raw.subarray(0,-1),'archive raw length mismatch');
 const nonfinite=Buffer.from(raw);nonfinite.writeDoubleLE(NaN,0);refuse('raw-nonfinite',original,nonfinite,'archive raw field nonfinite');
 const ids=structuredClone(original);ids.bodies[0].id='missing';refuse('stable-id',ids,raw,'archive body IDs mismatch');
 const cursor=structuredClone(original);cursor.stepIndex++;refuse('cursor',cursor,raw,'archive cursor mismatch');
 const json=structuredClone(original);json.bodies[0].positionM[0]+=1;refuse('json-raw-disagreement',json,raw,'archive JSON and raw field mismatch');
 const first=decodeReports(input.files,freeze);first.rows[0].states[index].bodies[0].positionM[0]=999;
 assert.deepEqual(decodeReports(input.files,freeze).rows[0].states[index],original,'archive restoration copies');
 const typedBad=structuredClone(cases.find(c=>!c.invalid).a);typedBad.shape.kind='missing';assert.throws(()=>m.parseBody({...typedBad,kind:'dynamic',massKg:1},false),e=>e instanceof m.PhysicsError&&e.code==='INVALID_CONFIG');
 return {referenceAndOriginalControls:rows,negativeComparisonControls:4,archiveRejected:rejected,archiveCopy:true,originalInputAndOutputCopy:true,originalTypedAdmissionErrorIdentity:true,worldCreated:false,worldStepped:false};
}
