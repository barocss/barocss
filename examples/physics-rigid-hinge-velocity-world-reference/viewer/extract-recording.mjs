import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createGunzip,gunzipSync} from 'node:zlib';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {BODY_IDS,JOINT_IDS,RECORDED_DT,MAX_RECORDING_BYTES,restoreZeros,zeroPaths,validateRecordedFrame,validateRecording} from './recording-reader.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const archive=resolve(here,'../evidence/completed-world-a341f222');
const MANIFEST_SHA='60e389dbce2640f7f28378927f54cd6d2d8af203bcf374d54177a957b91d2191';
const receiptPath=resolve(here,'data/extraction-receipt.json');
const dataPath=resolve(here,'data/recording.json');
const hash=b=>createHash('sha256').update(b).digest('hex');
const BODY_KEYS=['id','kind','shape','positionM','velocityMps','orientation','angularVelocityRadps','inertiaKgM2'];
const PAIR_KEYS=['jointId','aId','bId','acceptedReportAngleRad','rawSourceAngleRad','rawFreeAngleRad','rawPostContactAngleRad','rawFinalAngleRad',
  'motor','jointReport','bodyCorrections','energyByPhase','work','reportCap'];
const pick=(object,keys)=>Object.fromEntries(keys.map(key=>{assert.ok(Object.hasOwn(object,key),key+' is absent');return [key,structuredClone(object[key])];}));
const counters={extractionAttempts:1,compressedArtifactsAuthenticated:0,decodedInputsAuthenticated:0,nativeRecords:0,recordedFrames:0,rawBodyCorrespondences:0,physicsCalls:0,worldSteps:0,referenceCalls:0};
const receipt={version:1,status:'RUNNING',nativeWorld:'f40123da0eedb19245688557f865e1beb09d47ef',consumerHead:'a341f2224ac4bd0b1167f4a9059ab32ab331aac2',counters,inputs:[]};
async function streamHash(path){const h=createHash('sha256');let bytes=0;for await(const chunk of createReadStream(path)){h.update(chunk);bytes+=chunk.length;}return{bytes,sha256:h.digest('hex')};}
function bodyFromRaw(body,bytes,index) {
  const out=pick(body,BODY_KEYS);let offset=index*104;
  for(const [key,n] of [['positionM',3],['velocityMps',3],['orientation',4],['angularVelocityRadps',3]]) {
    for(let j=0;j<n;j++) {const v=bytes.readDoubleLE(offset);assert.ok(out[key][j]===v,'recorded body/raw mismatch');out[key][j]=v;offset+=8;}
  }
  return out;
}
function makeFrame(store,output,stepIndex,nativeLocator,rawLocator,rawBytes) {
  const state=output===null?store:output.state;
  const bodies=state.bodies.map((body,i)=>bodyFromRaw(body,rawBytes,i));
  const pairs=output===null?null:output.diagnostics.pairs.map(pair=>pick(pair,PAIR_KEYS));
  const frame={stepIndex,timeSeconds:state.timeSeconds,bodies,joints:structuredClone(state.joints),pairs,
    rawBodiesHex:rawBytes.toString('hex'),negativeZeroPaths:[],source:{
      native:{offset:nativeLocator.offset,bytes:nativeLocator.bytes,sha256:nativeLocator.sha256,acceptedStore:stepIndex===0?'before':'after'},
      raw:{offset:rawLocator.offset,bytes:416,sha256:hash(rawBytes),phase:stepIndex===0?'initial':'projected'}}};
  frame.negativeZeroPaths=zeroPaths(frame);validateRecordedFrame(frame);return frame;
}

/** One bounded data extraction; no Physics/CAD/Viewer/provider import. */
export async function extractRecording() {
  assert.equal(process.version,'v22.22.0');
  assert.ok(!existsSync(dataPath)&&!existsSync(receiptPath),'fresh extraction outputs required');
  try {
    const manifestBytes=readFileSync(resolve(archive,'manifest.json'));assert.equal(hash(manifestBytes),MANIFEST_SHA);
    const manifest=JSON.parse(manifestBytes);assert.equal(manifest.allGraphDisposition,'HINGE2_WORLD_GO');assert.equal(manifest.graphCount,3);
    receipt.manifest={path:'../evidence/completed-world-a341f222/manifest.json',bytes:manifestBytes.length,sha256:MANIFEST_SHA};
    for(const entry of manifest.entries){const observed=await streamHash(resolve(archive,entry.archive));assert.equal(observed.bytes,entry.archiveBytes);assert.equal(observed.sha256,entry.archiveSha256);counters.compressedArtifactsAuthenticated++;}
    const entryFor=name=>{const e=manifest.entries.find(x=>x.original==='run/source-proof/'+name);assert.ok(e,name+' manifest entry missing');return e;};
    const decodeSmall=(name,limit)=>{const entry=entryFor(name);assert.ok(entry.decompressedBytes<=limit);const bytes=gunzipSync(readFileSync(resolve(archive,entry.archive)),{maxOutputLength:limit});assert.equal(bytes.length,entry.decompressedBytes);assert.equal(hash(bytes),entry.decompressedSha256);counters.decodedInputsAuthenticated++;receipt.inputs.push({name,archive:entry.archive,bytes:bytes.length,sha256:hash(bytes)});return bytes;};
    const raw=decodeSmall('main.bodies.raw',3*1024*1024);
    const recordsBytes=decodeSmall('main.records.jsonl',2*1024*1024);assert.equal(recordsBytes.at(-1),10);
    const records=recordsBytes.toString('utf8').slice(0,-1).split('\n').map(line=>JSON.parse(line));assert.equal(records.length,1201);assert.equal(records[0].type,'initial');
    const frames=[],nativeEntry=entryFor('main.native.jsonl'),nativeHash=createHash('sha256');
    assert.ok(nativeEntry.decompressedBytes<=231*1024*1024);
    let pending=Buffer.alloc(0),nativeBytes=0,nativeOffset=0;
    const input=createReadStream(resolve(archive,nativeEntry.archive)).pipe(createGunzip());
    for await(const chunk of input) {
      nativeHash.update(chunk);nativeBytes+=chunk.length;assert.ok(nativeBytes<=231*1024*1024);
      pending=Buffer.concat([pending,chunk]);let lf;
      while((lf=pending.indexOf(10))>=0) {
        const line=pending.subarray(0,lf+1);pending=pending.subarray(lf+1);assert.ok(line.length<=1024*1024);
        const index=++counters.nativeRecords,record=records[index];assert.ok(record);
        assert.equal(record.passed,true);assert.equal(record.outcome,'returned');assert.equal(record.referenceDisposition,'RETURN');assert.equal(record.error,null);
        assert.equal(record.attemptedStepIndex,index);assert.equal(record.acceptedStepIndex,index);
        assert.equal(record.nativeLocator.offset,nativeOffset);assert.equal(record.nativeLocator.bytes,line.length);assert.equal(record.nativeLocator.sha256,hash(line));
        const native=JSON.parse(line.toString('utf8')),req=native.request;assert.equal(req.outcome,'returned');assert.equal(req.error,null);assert.ok(req.output);
        assert.equal(native.acceptedStoreBefore.stepIndex,index-1);assert.equal(native.acceptedStoreAfter.stepIndex,index);assert.equal(req.output.state.stepIndex,index);
        restoreZeros(req.output,req.negativeZeroPaths.output);
        if(index===1){assert.equal(native.acceptedStoreBefore.diagnostics,null);assert.equal(native.acceptedStoreBefore.stepIndex,0);const initial=raw.subarray(0,416);frames.push(makeFrame(native.acceptedStoreBefore,null,0,record.nativeLocator,{offset:0},initial));counters.rawBodyCorrespondences++;}
        const rawLocator=record.raw.find(x=>x.phase==='projected');assert.ok(rawLocator);assert.equal(rawLocator.bytes,416);
        const bytes=raw.subarray(rawLocator.offset,rawLocator.offset+416);assert.equal(bytes.length,416);assert.equal(hash(bytes),rawLocator.sha256);assert.equal(bytes.toString('hex'),req.rawFrames.projected);
        // The saved store JSON has no separate nonbody zero witness; output's original witness is authoritative.
        assert.equal(JSON.stringify(req.output.state.joints),JSON.stringify(native.acceptedStoreAfter.joints));
        for(let b=0;b<4;b++) for(const key of BODY_KEYS) assert.equal(JSON.stringify(req.output.state.bodies[b][key]),JSON.stringify(native.acceptedStoreAfter.bodies[b][key]));
        frames.push(makeFrame(native.acceptedStoreAfter,req.output,index,record.nativeLocator,rawLocator,bytes));counters.rawBodyCorrespondences++;
        nativeOffset+=line.length;
      }
      assert.ok(pending.length<=1024*1024);
    }
    assert.equal(pending.length,0);assert.equal(nativeBytes,nativeEntry.decompressedBytes);assert.equal(nativeHash.digest('hex'),nativeEntry.decompressedSha256);assert.equal(counters.nativeRecords,1200);
    counters.decodedInputsAuthenticated++;receipt.inputs.push({name:'main.native.jsonl',archive:nativeEntry.archive,bytes:nativeBytes,sha256:nativeEntry.decompressedSha256});
    counters.recordedFrames=frames.length;assert.equal(frames.length,1201);
    const recording={version:1,dt:RECORDED_DT,bodyIds:[...BODY_IDS],jointIds:[...JOINT_IDS],provenance:{nativeWorld:receipt.nativeWorld,consumerHead:receipt.consumerHead,sourceManifestSha256:MANIFEST_SHA,
      sourceFreezeSha256:manifest.sourceFreezeSha256,emittedLedgerSha256:manifest.emittedLedgerSha256,sourceFiles:receipt.inputs,initialDiagnosticsRecorded:false,physicsRerun:false},frames};
    validateRecording(recording);
    const bytes=Buffer.from(JSON.stringify(recording)+'\n');assert.ok(bytes.length<=MAX_RECORDING_BYTES,'recording exceeds frozen12MiB');
    writeFileSync(dataPath,bytes,{flag:'wx'});receipt.output={path:'data/recording.json',bytes:bytes.length,sha256:hash(bytes),frames:frames.length};
    receipt.status='PASS';receipt.negativeZeroWitnessFrames=frames.filter(x=>x.negativeZeroPaths.length>0).length;
    writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});return receipt;
  } catch(error) {
    receipt.status='FIRST_EXTRACTION_FAILURE';receipt.failure={name:error?.name??'unknown',message:error?.message??String(error)};
    writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});throw error;
  }
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(await extractRecording()));
