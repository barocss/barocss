// Test-only fixed-channel archive. No physics imports or external byte decoder.
import {createGzip,createGunzip,constants} from 'node:zlib';
import {createReadStream,statSync,openSync,writeSync,closeSync,fsyncSync,writeFileSync} from 'node:fs';
import {Writable} from 'node:stream';
import {finished} from 'node:stream/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
export const LIMITS=Object.freeze({wire:2**21,words:512*1024,header:2048,record:3*2**21+16,pending:8*2**20,queue:4,scratch:16*2**20,retained:280*2**20,reserve:2**20,depth:64,entries:40000});
const sha=b=>createHash('sha256').update(b).digest('hex');
export class ArchiveStop extends Error{constructor(code,message=code){super(message);this.name='ArchiveStop';this.code=code;}}
const need=(v,code)=>{if(!v)throw new ArchiveStop(code);};
const crcTable=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);return c>>>0;});
function crcUpdate(crc,bytes){for(const b of bytes)crc=(crc>>>8)^crcTable[(crc^b)&255];return crc;}
export const crc32=bytes=>(crcUpdate(0xffffffff,bytes)^0xffffffff)>>>0;
export function retainedBudget({cap=LIMITS.retained,used=0,reserve=LIMITS.reserve}={}){
 need(Number.isSafeInteger(cap)&&cap<=LIMITS.retained&&cap>0&&Number.isSafeInteger(used)&&used>=0&&Number.isSafeInteger(reserve)&&reserve>=4096&&used+reserve<=cap,'BUDGET_INPUT');
 return {cap,reserve,used,charge(n,emergency=false){need(Number.isSafeInteger(n)&&n>=0&&this.used+n<=this.cap-(emergency?0:this.reserve),'RETAINED_CAP');this.used+=n;}};
}
// Exact encoded JSON bytes, including the existing one-byte line terminator.
function stringBytes(value){
 need(value.length+2<=LIMITS.wire,'JSON_WORD_CAPACITY');let n=2;for(let i=0;i<value.length;i++){
  const c=value.charCodeAt(i);
  if(c===34||c===92||c===8||c===9||c===10||c===12||c===13)n+=2;
  else if(c<=31)n+=6;
  else if(c>=0xd800&&c<=0xdbff&&i+1<value.length&&value.charCodeAt(i+1)>=0xdc00&&value.charCodeAt(i+1)<=0xdfff){n+=4;i++;}
  else if(c>=0xd800&&c<=0xdfff)n+=6;
  else n+=c<128?1:c<2048?2:3;need(n<=LIMITS.wire,'JSON_WORD_CAPACITY');
 }return n;
}
function inspect(value,visit=()=>{}){
 let capacity=1,numbers=0,nodes=0;const ancestors=new Set();
 const walk=(v,depth)=>{
  need(depth<=LIMITS.depth&&++nodes<=262144,'GRAPH_BOUND');
  if(typeof v==='number'){need(Number.isFinite(v),'NONFINITE');capacity+=Buffer.byteLength(JSON.stringify(v));numbers++;visit(v);}
  else if(typeof v==='string')capacity+=stringBytes(v);
  else if(v===null)capacity+=4;
  else if(typeof v==='boolean')capacity+=v?4:5;
  else{
   need(typeof v==='object'&&!ancestors.has(v),'CYCLE_OR_UNSUPPORTED');
   need(Array.isArray(v)?Object.getPrototypeOf(v)===Array.prototype:Object.getPrototypeOf(v)===Object.prototype,'PROTOTYPE');
   const keys=Object.keys(v);need(Reflect.ownKeys(v).length===keys.length+(Array.isArray(v)?1:0),'OWN_KEYS');
   if(Array.isArray(v))need(keys.length===v.length&&keys.every((k,i)=>k===String(i)),'SPARSE_ARRAY');
   ancestors.add(v);capacity+=2+Math.max(0,keys.length-1);
   for(const key of keys){const d=Object.getOwnPropertyDescriptor(v,key);need(d&&'value'in d&&d.enumerable,'ACCESSOR');if(!Array.isArray(v))capacity+=stringBytes(key)+1;walk(d.value,depth+1);}
   ancestors.delete(v);
  }
  need(capacity<=LIMITS.wire&&numbers*8<=LIMITS.words,'JSON_WORD_CAPACITY');
 };walk(value,0);return {capacity,numbers};
}
function recordPayload(record,body,points){
 const info=inspect(record);need(Buffer.isBuffer(body)&&Buffer.isBuffer(points)&&body.length+points.length<=LIMITS.wire&&body.length%8===0&&points.length%8===0,'RAW_BOUND');
 const json=Buffer.from(JSON.stringify(record)+'\n'),words=Buffer.alloc(info.numbers*8);let at=0;inspect(record,n=>{words.writeDoubleBE(n,at);at+=8;});
 need(json.length===info.capacity&&json.length<=LIMITS.wire,'JSON_BOUND');const out=Buffer.alloc(16+json.length+words.length+body.length+points.length);
 [json.length,words.length,body.length,points.length].forEach((n,i)=>out.writeUInt32BE(n,i*4));let offset=16;for(const b of [json,words,body,points]){b.copy(out,offset);offset+=b.length;}return out;
}
function decodeRecord(payload){
 need(payload.length>=16,'RECORD_LENGTH');const lengths=[0,4,8,12].map(i=>payload.readUInt32BE(i));
 need(lengths[0]<=LIMITS.wire&&lengths[1]<=LIMITS.words&&lengths[2]+lengths[3]<=LIMITS.wire&&lengths.slice(1).every(n=>n%8===0)&&16+lengths.reduce((a,b)=>a+b,0)===payload.length,'RECORD_LENGTH');
 let at=16;const [jsonBytes,words,bodyRaw,pointRaw]=lengths.map(n=>{const b=payload.subarray(at,at+n);at+=n;return b;});
 const record=JSON.parse(jsonBytes.toString('utf8'));let word=0;
 const restore=v=>{if(typeof v==='number'){need(word+8<=words.length,'WORD_COUNT');const n=words.readDoubleBE(word);word+=8;need(Number.isFinite(n),'NONFINITE_WORD');need(Object.is(v,n)||(v===0&&n===0),'WORD_JSON_DISAGREEMENT');return n;}if(v&&typeof v==='object')for(const key of Object.keys(v))v[key]=restore(v[key]);return v;};
 inspect(record);const restored=restore(record);need(word===words.length,'WORD_COUNT');return {record:restored,jsonBytes,words,bodyRaw,pointRaw};
}
const channelLimit=c=>c==='record'?LIMITS.record:['rpc','packet'].includes(c)?LIMITS.wire:c==='end'?0:-1;
function validateHeader(h,index,length){
 need(h&&Object.getPrototypeOf(h)===Object.prototype&&h.index===index&&channelLimit(h.channel)>=length&&channelLimit(h.channel)>=0&&h.bytes===length&&/^[a-f0-9]{64}$/.test(h.sha256),'FRAME_HEADER');
 if(h.channel!=='end')need(['ALIGNED','OFFSET','YAW','TEST'].includes(h.scene)&&Number.isInteger(h.step)&&h.step>=0&&h.step<=1200,'SCENE_STEP');
 if(h.channel==='rpc')need(['request','reply'].includes(h.kind)&&['contacts','world','step-ledger','quality','control'].includes(h.op),'RPC_HEADER');
 if(h.channel==='packet')need(/^[a-f0-9]{64}$/.test(h.fingerprint),'PACKET_FINGERPRINT');
 if(h.channel==='record')need(h.aliasFingerprint===null||/^[a-f0-9]{64}$/.test(h.aliasFingerprint),'ALIAS_FINGERPRINT');
 const allowed=['channel','index','bytes','sha256',...(h.channel==='end'?[]:['scene','step']),...(h.channel==='rpc'?['op','kind']:h.channel==='packet'?['fingerprint']:h.channel==='record'?['aliasFingerprint']:[])];
 need(Object.keys(h).length===allowed.length&&Object.keys(h).every(k=>allowed.includes(k)),'HEADER_KEYS');
}
function frame(header,payload,index){
 need(header.channel==='end'?index<=LIMITS.entries:index<LIMITS.entries,'ENTRY_BOUND');
 const h={...header,index,bytes:payload.length,sha256:sha(payload)};validateHeader(h,index,payload.length);const json=Buffer.from(JSON.stringify(h));need(json.length<=LIMITS.header,'HEADER_BOUND');
 const prefix=Buffer.alloc(16);prefix.write('S227');prefix.writeUInt32BE(json.length,4);prefix.writeUInt32BE(payload.length,8);prefix.writeUInt32BE((crcUpdate(crcUpdate(0xffffffff,json),payload)^0xffffffff)>>>0,12);
 return [prefix,json,payload];
}
export class StreamArchive{
 constructor(directory,budget){
  this.directory=directory;this.budget=budget;this.fd=openSync(join(directory,'events.gz'),'wx');this.index=0;this.completeEntries=0;this.pendingBytes=0;this.pendingCount=0;this.tail=Promise.resolve();this.failure=null;this.closed=false;this.closing=false;this.compressedBytes=0;this.compressedHash=createHash('sha256');
  this.sink=new Writable({highWaterMark:65536,write:(chunk,encoding,done)=>{try{budget.charge(chunk.length);let n=0;while(n<chunk.length){const written=writeSync(this.fd,chunk,n,chunk.length-n);need(written>0,'WRITE_PROGRESS');this.compressedHash.update(chunk.subarray(n,n+written));this.compressedBytes+=written;n+=written;}done();}catch(e){done(e);}}});
  this.gzip=createGzip({chunkSize:65536});this.gzip.on('error',e=>{this.failure??=e;this.sink.destroy(e);});this.sink.on('error',e=>{this.failure??=e;this.gzip.destroy(e);});this.gzip.pipe(this.sink);
 }
 appendRpc(scene,step,op,kind,bytes){return this.enqueue({channel:'rpc',scene,step,op,kind},bytes);}
 appendPacket(scene,step,fingerprint,bytes){return this.enqueue({channel:'packet',scene,step,fingerprint},bytes);}
 appendRecord(scene,step,record,bodyRaw=Buffer.alloc(0),pointRaw=Buffer.alloc(0),aliasFingerprint=null){
  const info=inspect(record);need(Buffer.isBuffer(bodyRaw)&&Buffer.isBuffer(pointRaw),'RAW_BOUND');
  need(aliasFingerprint===null||/^[a-f0-9]{64}$/.test(aliasFingerprint),'ALIAS_FINGERPRINT');
  this.admit(info.capacity+info.numbers*8+bodyRaw.length+pointRaw.length+32+LIMITS.header);
  need(this.pendingBytes+4*info.capacity+16*info.numbers+2*(bodyRaw.length+pointRaw.length)+16+2**20<=LIMITS.scratch,'ARCHIVE_BACKPRESSURE');
  return this.enqueue({channel:'record',scene,step,aliasFingerprint},recordPayload(record,bodyRaw,pointRaw),true);
 }
 admit(size,closing=false){need(!this.closed&&!this.failure&&(!this.closing||closing),'ARCHIVE_STOPPED');need(this.pendingCount<LIMITS.queue&&this.pendingBytes+size<=LIMITS.pending,'ARCHIVE_BACKPRESSURE');}
 enqueue(header,bytes,owned=false){
  need(!this.closed&&!this.failure,'ARCHIVE_STOPPED');need(Buffer.isBuffer(bytes)&&bytes.length<=channelLimit(header.channel),'PAYLOAD_BOUND');
  const size=bytes.length+LIMITS.header+16;this.admit(size,header.channel==='end');
  const payload=owned?bytes:Buffer.from(bytes),index=this.index;const parts=frame(header,payload,index);this.index++;
  this.pendingCount++;this.pendingBytes+=size;
  const task=this.tail.then(async()=>{
   need(!this.failure,'ARCHIVE_STOPPED');
   for(const part of parts)await new Promise((resolve,reject)=>this.gzip.write(part,e=>e?reject(e):resolve()));
   await new Promise((resolve,reject)=>this.gzip.flush(constants.Z_SYNC_FLUSH,e=>e?reject(e):resolve()));
   await new Promise((resolve,reject)=>this.sink.write(Buffer.alloc(0),e=>e?reject(e):resolve()));
   need(!this.failure,'ARCHIVE_STOPPED');this.completeEntries++;return {index,sha256:sha(payload)};
  }).catch(e=>{this.failure??=e;throw e;}).finally(()=>{this.pendingCount--;this.pendingBytes-=size;});
  this.tail=task.catch(()=>{});return task;
 }
 stopReceipt(error){const b=Buffer.from(JSON.stringify({status:'ARCHIVE_STOPPED',code:error.code??'ARCHIVE_IO',message:String(error.message).slice(0,256),kernelWrittenCompleteFrames:this.completeEntries,compressedBytes:this.compressedBytes})+'\n');this.budget.charge(b.length,true);writeFileSync(join(this.directory,'stop.json'),b,{flag:'wx'});}
 async close(){
  need(!this.closed&&!this.closing,'ARCHIVE_CLOSED');this.closing=true;let error=this.failure;
  try{await this.tail;if(this.failure)throw this.failure;await this.enqueue({channel:'end'},Buffer.alloc(0));this.closed=true;const done=finished(this.sink);this.gzip.end();await Promise.all([done,finished(this.gzip)]);fsyncSync(this.fd);}
  catch(e){error=e;this.failure??=e;this.closed=true;this.gzip.destroy();this.sink.destroy();await Promise.allSettled([finished(this.gzip),finished(this.sink)]);try{this.stopReceipt(e);}catch(receiptError){e.receiptError={code:receiptError.code??'STOP_RECEIPT_IO',message:String(receiptError.message).slice(0,256)};}}
  finally{try{closeSync(this.fd);}catch(e){error??=e;this.failure??=e;}}
  if(error)throw error;return {status:'ARCHIVE_CLOSED',entries:this.completeEntries-1,compressedBytes:this.compressedBytes,compressedSha256:this.compressedHash.digest('hex'),storageFormat:'CONTINUOUS_GZIP_NOT_OLD_PER_RECORD_GZIP'};
 }
}
// Reader allocates payload ONLY after the <=2KiB header admits its channel length.
export async function verifyArchive(path,onEntry=async()=>{},expectedCompressedSha256=null){
 need(statSync(path).size<=LIMITS.retained,'COMPRESSED_INPUT_BOUND');const compressedHash=createHash('sha256'),recordHash=createHash('sha256'),wordHash=createHash('sha256'),rawHash=createHash('sha256');let records=0,numericLeaves=0,rawBytes=0;
 const input=createReadStream(path,{highWaterMark:65536}),gunzip=createGunzip({chunkSize:65536});input.on('error',e=>gunzip.destroy(e));input.on('data',b=>compressedHash.update(b));input.pipe(gunzip);
 let prefix=Buffer.alloc(16),head=null,payload=null,at=0,stage='prefix',header=null,expected=null,index=0,ended=false,entries=0;
 try{
  for await(const chunk of gunzip){let offset=0;while(offset<chunk.length){
   const target=stage==='prefix'?prefix:stage==='header'?head:payload,n=Math.min(target.length-at,chunk.length-offset);
   chunk.copy(target,at,offset,offset+n);at+=n;offset+=n;if(at!==target.length)continue;at=0;
   if(stage==='prefix'){
    need(!ended,'AFTER_END');need(index<=LIMITS.entries,'ENTRY_BOUND');need(prefix.subarray(0,4).toString()==='S227','FRAME_MAGIC');
    expected={h:prefix.readUInt32BE(4),p:prefix.readUInt32BE(8),crc:prefix.readUInt32BE(12)};
    need(expected.h>0&&expected.h<=LIMITS.header&&expected.p<=LIMITS.record,'FRAME_LENGTH_BEFORE_ALLOCATION');head=Buffer.alloc(expected.h);stage='header';
   }else if(stage==='header'){
    header=JSON.parse(head.toString('utf8'));validateHeader(header,index,expected.p);need(header.channel==='end'||index<LIMITS.entries,'ENTRY_BOUND');payload=Buffer.alloc(expected.p);stage='payload';
    if(expected.p)continue;
   }
   if(stage==='payload'&&(payload.length===0||target===payload)){
    need(((crcUpdate(crcUpdate(0xffffffff,head),payload)^0xffffffff)>>>0)===expected.crc,'FRAME_CRC');need(sha(payload)===header.sha256,'FRAME_SHA');index++;
    if(header.channel==='end')ended=true;else{const decoded=header.channel==='record'?decodeRecord(payload):{payload};if(header.channel==='record'){recordHash.update(decoded.jsonBytes);wordHash.update(decoded.words);rawHash.update(decoded.bodyRaw);rawHash.update(decoded.pointRaw);records++;numericLeaves+=decoded.words.length/8;rawBytes+=decoded.bodyRaw.length+decoded.pointRaw.length;}await onEntry({header,...decoded});entries++;}
    head=payload=header=expected=null;stage='prefix';
   }
  }}
  need(ended&&stage==='prefix'&&at===0,'TRUNCATED_OR_MISSING_END');const compressedSha256=compressedHash.digest('hex');need(expectedCompressedSha256===null||compressedSha256===expectedCompressedSha256,'COMPRESSED_SHA');return {status:'ARCHIVE_VERIFIED',entries,compressedSha256,records,numericLeaves,rawBytes,decodedRecordSha256:recordHash.digest('hex'),binary64BeWordSha256:wordHash.digest('hex'),rawSha256:rawHash.digest('hex')};
 }catch(e){return {status:'ARCHIVE_INCOMPLETE',entries,code:e.code??'ARCHIVE_DECODE',message:String(e.message).slice(0,256)};}
 finally{input.destroy();gunzip.destroy();await Promise.allSettled([finished(input),finished(gunzip)]);}
}
