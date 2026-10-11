/** Immutable saved-data reader. No candidate, parser, motor, reference or solver imports. */
import assert from 'node:assert/strict';
import {readFile,readdir,lstat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest,rawBodies,rawCommands,zeroWitness,negativeZeroPaths,FRAME_LABELS,RAW_FIELDS} from './raw.mjs';

export const FIRST_PROOF_HEAD='c94dc51abe43225e2c76a9ed13eea9305e4ac400';
export const FIRST_MANIFEST_SHA256='344532b1167fd89fdefa62a63fc50f5bbb2ebf0b5a1a38ef14d932a064acf25d';
const PREFIX='examples/physics-rigid-hinge-motor-reference/';
const EVIDENCE='evidence/first-runtime-cd24a151/';
const FLOW_DECODED_SHA256='68214f0fc5ebf190b876cd2e5f461dc5fd861462e47aafc19368f845373efb20';
const RAW_DECODED_SHA256='bb9b356932b26d44947cc38b82b677db91c7d7a5faa4cee6e847a94196e413bc';
const GENUINE_BEFORE_SHA256='4ba656b4b99e8989dd16ca6d4d7789899f3fd9c86b82f691c2759d1a750f9b10';
const defaultHere=dirname(fileURLToPath(import.meta.url));

function ownValue(object,key){
  assert.ok(object!==null&&typeof object==='object','saved prefix path owner is invalid');
  const descriptor=Object.getOwnPropertyDescriptor(object,key);
  assert.ok(descriptor&&descriptor.enumerable&&Object.hasOwn(descriptor,'value'),'saved prefix requires own data');
  return descriptor.value;
}

function restoreZeroPaths(record){
  assert.ok(Array.isArray(record.negativeZeroPaths),'saved zero paths are missing');
  const scope={input:record.input,attempt:record.attempt,output:record.output},seen=new Set();
  for(const path of record.negativeZeroPaths){
    assert.equal(typeof path,'string');assert.ok(path.startsWith('$.')&&!seen.has(path),'saved zero path differs');seen.add(path);
    const parts=path.slice(2).split('.');assert.ok(['input','attempt','output'].includes(parts[0]));
    assert.ok(parts.every(key=>/^(?:[A-Za-z_$][A-Za-z0-9_$]*|0|[1-9][0-9]*)$/.test(key)&&
      !['__proto__','prototype','constructor'].includes(key)),'saved zero path is unsafe');
    let owner=scope;
    for(const key of parts.slice(0,-1))owner=ownValue(owner,key);
    const key=parts.at(-1),value=ownValue(owner,key);
    assert.equal(typeof value,'number');assert.equal(value,0,'saved zero path must identify numeric zero');
    Object.defineProperty(owner,key,{value:-0,writable:true,enumerable:true,configurable:true});
  }
}

function restoreBodies(bodies,bytes){
  assert.ok(Array.isArray(bodies)&&bodies.length===2&&bytes.length===208,'saved frame dimensions differ');
  let offset=0;
  for(const body of bodies)for(const [field,size] of RAW_FIELDS){
    const supplied=ownValue(body,field);assert.ok(Array.isArray(supplied)&&supplied.length===size,'saved body vector differs');
    const restored=[];
    for(let i=0;i<size;i++){
      const value=ownValue(supplied,String(i)),decoded=bytes.readDoubleLE(offset);offset+=8;
      assert.ok(typeof value==='number'&&Number.isFinite(value)&&Number.isFinite(decoded)&&value===decoded,
        'saved body JSON/raw numeric correspondence differs');restored.push(decoded);
    }
    body[field]=restored;
  }
  assert.ok(rawBodies(bodies).equals(bytes),'saved body raw restoration differs');
}

function evidenceBytes(evidence,expectedLength){
  assert.ok(evidence!==null&&typeof evidence==='object','saved raw evidence is missing');
  assert.equal(evidence.bytes,expectedLength);assert.equal(typeof evidence.hex,'string');
  assert.ok(/^(?:[0-9a-f]{2})*$/.test(evidence.hex)&&evidence.hex.length===expectedLength*2,'saved raw hex differs');
  const bytes=Buffer.from(evidence.hex,'hex');assert.equal(digest(bytes),evidence.sha256,'saved raw digest differs');
  assert.deepEqual(zeroWitness(bytes),evidence.zeroWitness,'saved raw zero witness differs');return bytes;
}

function restoreRecord(record,rawStream,cursor){
  assert.equal(record.kind,'hinge-case');assert.equal(record.inputRetained,true);
  assert.deepEqual(record.inputAfter,record.input,'saved input-retained JSON differs');
  restoreZeroPaths(record);
  const actualFrames={};
  for(const [label,field] of Object.entries(FRAME_LABELS)){
    const bytes=evidenceBytes(record.rawFrames[label],208);
    assert.ok(rawStream.subarray(cursor.offset,cursor.offset+208).equals(bytes),'saved raw record association differs');
    cursor.offset+=208;actualFrames[label]=bytes;
    restoreBodies(record.attempt.frames[field],bytes);
    if(record.output!==null)restoreBodies(record.output.diagnostics.frames[field],bytes);
  }
  restoreBodies(record.input.carrier.bodies,actualFrames.source);
  // The original native assertions checked retained input/raw. JSON erased its signs only.
  record.inputAfter=structuredClone(record.input);
  restoreBodies(record.attempt.projection.bodies,actualFrames.projected);
  if(record.output!==null){
    restoreBodies(record.output.bodies,actualFrames.projected);
    restoreBodies(record.output.diagnostics.projection.bodies,actualFrames.projected);
  }
  const commands=evidenceBytes(record.commandsRaw,record.input.commands.length*24);
  assert.ok(rawStream.subarray(cursor.offset,cursor.offset+commands.length).equals(commands),'saved command stream differs');
  cursor.offset+=commands.length;assert.ok(rawCommands(record.input.commands).equals(commands),'saved command signs differ');
  assert.deepEqual(negativeZeroPaths({input:record.input,attempt:record.attempt,output:record.output}),record.negativeZeroPaths,
    'saved non-body/raw negative-zero paths disagree');
  assert.deepEqual(record.inputAfter,record.input);
  assert.deepEqual(record.calls,{motorCalls:1,projectionCalls:1});assert.equal(record.callbackCount,1);
  assert.equal(record.attempt.stage,'report-ready');assert.equal(record.attempt.error,null);
  assert.deepEqual(record.attempt.calls,record.calls);
  if(record.output!==null){
    for(const key of ['frames','motor','projection','bodyCorrections','energyByPhase','work','reportCap','calls']){
      assert.deepEqual(record.attempt[key],record.output.diagnostics[key],'saved output/attempt '+key+' differs');
    }
    assert.deepEqual(record.attempt.jointReport,record.output.jointReport);
    assert.deepEqual(record.output.bodies,record.output.diagnostics.frames.projectedBodies);
    assert.deepEqual(record.output.bodies,record.output.diagnostics.projection.bodies);
  }
  for(const key of ['worldCreated','worldStepped','parent93Replayed'])assert.equal(record[key],false);
}

/** Only the two immutable selected records are exposed; they never become a model state seed. */
export async function loadSavedPrefix(here=defaultHere){
  const root=resolve(here,'../..'),evidence=resolve(here,EVIDENCE),manifestPath=resolve(evidence,'manifest.json');
  const manifestBytes=await readFile(manifestPath);
  assert.equal(digest(manifestBytes),FIRST_MANIFEST_SHA256,'immutable first manifest hash differs');
  const gitManifest=execFileSync('git',['show',FIRST_PROOF_HEAD+':'+PREFIX+EVIDENCE+'manifest.json'],{cwd:root,maxBuffer:8*1024*1024});
  assert.ok(manifestBytes.equals(gitManifest),'first manifest differs from immutable Git');
  const manifest=JSON.parse(manifestBytes);assert.equal(manifest.issue,1179);
  assert.equal(manifest.consumerHead,'cd24a151b834f3362d78449fa1f667a3d03fd9b3');
  assert.equal(manifest.sourceHead,'ccbda92dce610d31bd7961c0f39edbefc237b7f9');
  assert.equal(manifest.sourceGenuineReferenceCAPSemanticsPassed,true);assert.equal(manifest.restNativeReturned,true);
  assert.equal(manifest.consumerExitCode,1);assert.equal(manifest.restReferenceChildExitCode,1);
  assert.equal(manifest.observedNativeCaseCount,2);assert.equal(manifest.fullFourteenCaseSemanticsGO,false);
  assert.ok(Array.isArray(manifest.artifacts)&&manifest.artifacts.length>0);
  const names=new Set(),files=new Map(),decodedHashes=[];
  for(const item of manifest.artifacts){
    assert.equal(typeof item.path,'string');assert.ok(item.path.startsWith(EVIDENCE)&&
      /^[A-Za-z0-9._/-]+$/.test(item.path)&&!item.path.split('/').includes('..')&&!names.has(item.path),'saved artifact path differs');
    names.add(item.path);assert.ok(Number.isSafeInteger(item.bytes)&&item.bytes>=0&&/^[a-f0-9]{64}$/.test(item.sha256));
    const path=resolve(here,item.path);assert.ok((await lstat(path)).isFile(),'saved artifact must be a regular file');
    const bytes=await readFile(path);assert.equal(bytes.length,item.bytes);assert.equal(digest(bytes),item.sha256);
    const original=execFileSync('git',['show',FIRST_PROOF_HEAD+':'+PREFIX+item.path],{cwd:root,maxBuffer:8*1024*1024});
    assert.ok(bytes.equals(original),'saved artifact differs from immutable Git: '+item.path);files.set(item.path,bytes);
    if(item.path.endsWith('.gz')){
      const decoded=gunzipSync(bytes),gitDecoded=gunzipSync(original);assert.ok(decoded.equals(gitDecoded));
      if(Object.hasOwn(item,'decodedBytes'))assert.equal(decoded.length,item.decodedBytes);
      if(Object.hasOwn(item,'decodedSha256'))assert.equal(digest(decoded),item.decodedSha256);
      decodedHashes.push({path:item.path,bytes:decoded.length,sha256:digest(decoded)});
    }
  }
  const actualNames=(await readdir(evidence,{withFileTypes:true})).map(item=>{assert.ok(item.isFile());return EVIDENCE+item.name;});
  assert.deepEqual(actualNames.sort(),[...names,EVIDENCE+'manifest.json'].sort(),'first-proof file set differs');
  const flow=gunzipSync(files.get(EVIDENCE+'source-flow.jsonl.gz'));
  const raw=gunzipSync(files.get(EVIDENCE+'source-flow.f64le.gz'));
  assert.equal(digest(flow),FLOW_DECODED_SHA256);assert.equal(raw.length,2080);assert.equal(digest(raw),RAW_DECODED_SHA256);
  assert.equal(flow.at(-1),10,'saved flow final LF differs');
  const lines=flow.toString('utf8').split('\n');assert.equal(lines.pop(),'');assert.equal(lines.length,2);
  const records=lines.map(line=>JSON.parse(line)),cursor={offset:0};
  for(let i=0;i<2;i++){
    assert.equal(records[i].index,i);assert.equal(records[i].ordinal,i+1);restoreRecord(records[i],raw,cursor);
    assert.ok(Buffer.from(JSON.stringify(records[i])+'\n').equals(Buffer.from(lines[i]+'\n')),
      'saved canonical record bytes changed during sign restoration');
  }
  assert.equal(cursor.offset,raw.length);
  const [genuineRecord,restRecord]=records;
  assert.equal(genuineRecord.name,'genuine-orbital');assert.equal(genuineRecord.expectedDisposition,'CAP_REFUSAL');
  assert.equal(genuineRecord.output,null);assert.equal(genuineRecord.classification,'PASS');assert.equal(genuineRecord.passed,true);
  assert.deepEqual(genuineRecord.error,{name:'PhysicsError',code:'NUMERIC_LIMIT',message:'hinge0 exceeded motor reaction limit'});
  assert.equal(genuineRecord.reference.ok,true);assert.equal(genuineRecord.reference.resolved,true);
  assert.equal(genuineRecord.reference.executionFailure,false);assert.equal(genuineRecord.reference.referenceStatus,'CAP_REFUSAL');
  assert.deepEqual(genuineRecord.reference.violations,[]);assert.deepEqual(genuineRecord.compared,{passed:true,failures:[]});
  assert.equal(genuineRecord.attempt.reportCap.exceedsCap,true);
  assert.equal(genuineRecord.rawFrames.source.sha256,GENUINE_BEFORE_SHA256);
  assert.equal(restRecord.name,'rest');assert.equal(restRecord.expectedDisposition,'RETURN');
  assert.ok(restRecord.output!==null);assert.equal(restRecord.error,null);assert.equal(restRecord.reference,null);
  assert.equal(restRecord.compared,null);assert.equal(restRecord.classification,'EXECUTION_FAILURE');assert.equal(restRecord.passed,false);
  assert.deepEqual(restRecord.executionFailure,{phase:'validation-or-reference',unknownPayloadStored:false});
  assert.equal(restRecord.attempt.reportCap.exceedsCap,false);
  const recordSha256=digest(Buffer.from(JSON.stringify(restRecord)+'\n'));
  const authenticatedProof=Object.freeze({kind:'authenticated-native-rest-case2',ordinal:2,recordSha256});
  const origin={proofHead:FIRST_PROOF_HEAD,manifestPath:PREFIX+EVIDENCE+'manifest.json',manifestSha256:FIRST_MANIFEST_SHA256,
    sourceHead:manifest.sourceHead,consumerHead:manifest.consumerHead,artifacts:manifest.artifacts.length,
    decodedHashes,flowDecodedSha256:digest(flow),rawDecodedSha256:digest(raw),rawBytes:raw.length,
    genuineRecordSha256:digest(Buffer.from(JSON.stringify(genuineRecord)+'\n')),restOriginalRecordSha256:recordSha256,
    inputAfterSignsRestoredFromAuthenticatedRetainedInput:true,historicalNativeCalls:2,
    historicalCompletedNamedReferenceReplies:1,historicalFailedNamedReferenceRequests:1,
    newNativeCalls:0,newReferenceCalls:0,originalFailureRetained:true};
  return {genuineRecord,restRecord,authenticatedProof,origin};
}
