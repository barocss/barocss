/** Lossless storage only. No simulation, query or independent math imports. */
import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {appendFile,link,mkdir,writeFile,stat,lstat,open} from 'node:fs/promises';
import {createGunzip,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve,basename} from 'node:path';
import {recorder,sha} from './archive.mjs';
const MAIN_LIMIT=280*1024*1024,EMERGENCY_LIMIT=2*1024*1024;
function gzipStream(path){const source=createReadStream(path),decoded=createGunzip();source.on('error',error=>decoded.destroy(error));source.pipe(decoded);return {source,decoded,close(){source.destroy();decoded.destroy();}};}
function lines(path){
 const stream=gzipStream(path),iterator=stream.decoded[Symbol.asyncIterator]();let pending=Buffer.alloc(0),ended=false;
 return {async next(){while(true){const lf=pending.indexOf(10);if(lf>=0){const value=pending.subarray(0,lf+1);pending=pending.subarray(lf+1);return {done:false,value};}if(ended){assert.equal(pending.length,0,'canonical JSON final record has no LF');return {done:true};}const next=await iterator.next();if(next.done)ended=true;else pending=Buffer.concat([pending,next.value]);}},close(){stream.close();}};
}
async function requireAbsent(path){try{await lstat(path);}catch(error){if(error.code==='ENOENT')return;throw error;}throw new Error('continuation destination already exists: '+path);}
async function reserve(path){const file=await open(path,'wx');await file.close();}
function rawReader(path){
 const stream=gzipStream(path),iterator=stream.decoded[Symbol.asyncIterator]();let pending=Buffer.alloc(0),ended=false;
 async function chunk(){if(ended)return false;const next=await iterator.next();if(next.done){ended=true;return false;}pending=Buffer.from(next.value);return true;}
 return {async take(n){const out=Buffer.alloc(n);let offset=0;while(offset<n){if(!pending.length&&!await chunk())throw new Error('canonical raw stream ended early');const count=Math.min(pending.length,n-offset);pending.copy(out,offset,0,count);pending=pending.subarray(count);offset+=count;}return out;},async end(){if(pending.length)throw new Error('canonical raw stream has extra bytes');while(await chunk()){if(pending.length)throw new Error('canonical raw stream has extra bytes');}},close(){stream.close();}};
}
function comparisons(jsonPath,rawPath){const json=lines(jsonPath),raw=rawReader(rawPath);return {async compare(recordBytes,rawBytes){const expected=await json.next();if(expected.done)throw new Error('canonical JSON stream ended early');assert.ok(recordBytes.equals(expected.value),'actual decoded record differs from canonical bytes');assert.ok(rawBytes.equals(await raw.take(rawBytes.length)),'actual raw frame bytes differ from canonical');},async end(){assert.equal((await json.next()).done,true,'canonical JSON contains extra records');await raw.end();},close(){json.close();raw.close();}};}
async function emergency(out,name,record){const data=Buffer.from(JSON.stringify(record)+'\n');if(data.length>EMERGENCY_LIMIT)throw new Error('full-pair world emergency evidence budget exceeded');await writeFile(resolve(out,name+'-emergency.json.gz'),gzipSync(data));}
export async function createContinuationRecorder(out,name,budget,options){
 assert.ok(options&&['source','parity'].includes(options.mode));await mkdir(out,{recursive:true});
 for(const suffix of ['.jsonl.gz','.f64le.gz','-aliases.jsonl.gz','-emergency.json.gz'])await requireAbsent(resolve(out,name+suffix));
 if(options.mode==='source'){
  await reserve(resolve(out,name+'.jsonl.gz'));await reserve(resolve(out,name+'.f64le.gz'));
  const writer=await recorder(out,name,budget),prefix=options.originalPrefix,check=prefix?comparisons(prefix.jsonPath,prefix.rawPath):null;let checked=0,closed=false;
  const close=()=>{if(!closed){closed=true;check?.close();}};
  return {async write(record,raw=[]){try{if(check&&checked<prefix.records){await check.compare(Buffer.from(JSON.stringify(record)+'\n'),Buffer.concat(raw));checked++;if(checked===prefix.records){await check.end();close();}}await writer.write(record,raw);}catch(error){close();throw error;}},async emergency(record){close();await writer.emergency(record);},async finish(){try{if(check)assert.equal(checked,prefix.records,'original completed prefix was not fully reproduced');const result=writer.finish();return {...result,storageMode:'full-source',originalPrefixRecordsVerified:checked,newStoredBytes:result.compressedBytes,logicalAliasBytes:0};}finally{close();}}};
 }
 assert.equal(basename(options.canonicalName),options.canonicalName);assert.notEqual(name,options.canonicalName);
 const canonicalJson=resolve(out,options.canonicalName+'.jsonl.gz'),canonicalRaw=resolve(out,options.canonicalName+'.f64le.gz'),check=comparisons(canonicalJson,canonicalRaw),recordHash=createHash('sha256'),rawHash=createHash('sha256');
 assert.ok(options.canonicalEvidence,'canonical whole evidence is required');
 const aliasPath=resolve(out,name+'-aliases.jsonl.gz');await reserve(aliasPath);let records=0,rawBytes=0,storedBytes=0,finished=false,closed=false;
 const close=()=>{if(!closed){closed=true;check.close();}};
 return {async write(record,raw=[]){
  if(finished)throw new Error('parity recorder is already finished');
  try{const line=Buffer.from(JSON.stringify(record)+'\n'),binary=Buffer.concat(raw);await check.compare(line,binary);
   const receipt={recordIndex:records,canonicalRecordIndex:records,canonicalJsonPath:options.canonicalName+'.jsonl.gz',canonicalRawPath:options.canonicalName+'.f64le.gz',decodedRecordSha256:sha(line),rawSha256:sha(binary),rawBytes:binary.length,exactRecordBytesEqual:true,exactRawBytesEqual:true},data=gzipSync(Buffer.from(JSON.stringify(receipt)+'\n'));
   if(budget.bytes+data.length>MAIN_LIMIT)throw new Error('full-pair world evidence budget exceeded');await appendFile(aliasPath,data);budget.bytes+=data.length;storedBytes+=data.length;recordHash.update(line);rawHash.update(binary);rawBytes+=binary.length;records++;
  }catch(error){close();throw error;}
 },async emergency(record){close();await emergency(out,name,record);},async finish(){
  try{assert.equal(finished,false,'parity recorder is already finished');await check.end();const metrics={records,rawBytes,decodedRecordSha256:recordHash.digest('hex'),rawSha256:rawHash.digest('hex')};for(const key of Object.keys(metrics))assert.equal(metrics[key],options.canonicalEvidence[key],'canonical whole evidence '+key);const json=await stat(canonicalJson),raw=await stat(canonicalRaw);await link(canonicalJson,resolve(out,name+'.jsonl.gz'));await link(canonicalRaw,resolve(out,name+'.f64le.gz'));finished=true;
   return {...metrics,compressedBytes:storedBytes,storageMode:'exact-source-alias',canonicalJsonPath:options.canonicalName+'.jsonl.gz',canonicalRawPath:options.canonicalName+'.f64le.gz',aliasReceiptPath:name+'-aliases.jsonl.gz',newStoredBytes:storedBytes,logicalAliasBytes:json.size+raw.size,exactRecordAndRawBytesCompared:true};
  }finally{close();}
 }};
}
