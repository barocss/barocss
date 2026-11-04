// Harness IO only. No solver or oracle arithmetic.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {join} from 'node:path';
export const LINE=2*1024*1024, SCRATCH=16*1024*1024, CAP=280*1024*1024;
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function visitWords(value,consume){
 if(typeof value==='number'){const b=Buffer.alloc(8);b.writeDoubleBE(value);consume(b);}
 else if(Array.isArray(value))for(const item of value)visitWords(item,consume);
 else if(value&&typeof value==='object')for(const item of Object.values(value))visitWords(item,consume);
}
export function wordsDigest(value){const h=createHash('sha256');let count=0;visitWords(value,b=>{h.update(b);count++;});return {format:'BINARY64_BE_ALL_NUMERIC_LEAVES_IN_STRUCTURAL_ORDER',count,sha256:h.digest('hex')};}
export function remain(deadline){const n=Math.floor(deadline-Date.now());assert.ok(n>0,'internal170s deadline');return n;}
// Count JSON bytes before allocating the whole wire buffer; strings are visited
// in bounded slices. Numeric conversion follows JSON.stringify exactly.
function size(value,depth=0){
 assert.ok(depth<96,'JSON nesting bound');
 if(value===null)return 4;
 if(typeof value==='number'){assert.ok(Number.isFinite(value),'nonfinite JSON');return Buffer.byteLength(JSON.stringify(value));}
 if(typeof value==='boolean')return value?4:5;
 if(typeof value==='string'){
  let n=2;for(let i=0;i<value.length;i++){
   const c=value.charCodeAt(i);
   if(c===34||c===92||c===8||c===9||c===10||c===12||c===13)n+=2;else if(c<=31)n+=6;
   else if(c>=0xd800&&c<=0xdbff&&i+1<value.length&&value.charCodeAt(i+1)>=0xdc00&&value.charCodeAt(i+1)<=0xdfff){n+=4;i++;}
   else if(c>=0xd800&&c<=0xdfff)n+=6;else n+=c<128?1:c<2048?2:3;
  }return n;
 }
 assert.ok(value&&typeof value==='object'&&!ArrayBuffer.isView(value),'plain JSON only');
 if(Array.isArray(value))return 2+Math.max(0,value.length-1)+value.reduce((n,x)=>n+size(x,depth+1),0);
 const entries=Object.entries(value).filter(([,v])=>v!==undefined);
 return 2+Math.max(0,entries.length-1)+entries.reduce((n,[k,v])=>n+size(k,depth+1)+1+size(v,depth+1),0);
}
export function wire(value,limit=LINE){const bytes=size(value)+1;assert.ok(bytes<=limit&&4*bytes<=SCRATCH,'JSON string/buffer scratch preallocation bound');const b=Buffer.from(JSON.stringify(value)+'\n');assert.equal(b.length,bytes);return b;}
export function json(path,value,limit=SCRATCH){writeFileSync(path,wire(value,limit),{flag:'wx'});}
export function observer(path,out,label,deadline,budget,python){
 assert.ok(typeof python==='string'&&python.startsWith('/'),'pinned absolute Python executable required');
 const child=spawn(python,['-B',path],{stdio:['pipe','pipe','pipe']}), stderr=[];
 let pending=null,partial=Buffer.alloc(0),error=null,stderrBytes=0,closed=false,exit=null,signal=null;
 let resolveClose;const closePromise=new Promise(r=>resolveClose=r);
 const reject=e=>{error??=e;if(pending){const p=pending;pending=null;clearTimeout(p.timer);p.reject(error);}};
 child.stderr.on('data',b=>{stderrBytes+=b.length;if(stderrBytes>128*1024)reject(Error(label+' stderr bound'));else stderr.push(b);});
 child.stdout.on('data',b=>{
  if(partial.length+b.length>LINE){partial=Buffer.concat([partial,b.subarray(0,Math.max(0,LINE-partial.length))]);reject(Error(label+' reply2MiB bound'));return;}
  partial=Buffer.concat([partial,b]);const end=partial.indexOf(10);if(end<0)return;
  if(!pending){reject(Error(label+' unsolicited output'));return;}
  const p=pending;pending=null;clearTimeout(p.timer);
  const reply=partial.subarray(0,end+1);partial=partial.subarray(end+1);
  try{
   assert.equal(partial.length,0,label+' trailing output');
   budget.save(join(out,`${label}-${p.index}-reply.json`),reply);
   const value=JSON.parse(reply.toString('utf8'));p.resolve(value);
  }catch(e){reject(e);p.reject(e);}
 });
 child.on('error',reject);child.on('close',(code,sig)=>{closed=true;exit=code;signal=sig;if(pending)reject(Error(label+' closed during request'));resolveClose();});
 let requests=0,replies=0;
 return {
  async ask(value){
   if(error)throw error;assert.ok(!closed,'reference already closed');assert.equal(pending,null,'one outstanding request');
   const b=wire(value),index=++requests;budget.save(join(out,`${label}-${index}-request.json`),b);
   const result=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{const e=Error(label+' remaining deadline');pending=null;error??=e;reject(e);},remain(deadline));
    pending={resolve,reject,timer,index};child.stdin.write(b,e=>{if(e)reject(e);});
   });replies++;return result;
  },
  async close(failed){
   if(!closed){if(failed||error)child.kill('SIGTERM');else child.stdin.end();
    const kill=setTimeout(()=>child.kill('SIGKILL'),500);
    let reap;try{await Promise.race([closePromise,new Promise((_,r)=>{reap=setTimeout(()=>r(Error(label+' reap deadline')),1500);})]);}finally{clearTimeout(kill);clearTimeout(reap);}
   }
   budget.save(join(out,label+'-stderr.raw'),Buffer.concat(stderr));
   if(partial.length)budget.save(join(out,label+'-partial-reply.raw'),partial);
   const receipt={path,executable:python,pid:child.pid,requests,replies,exit,signal,closed,stderrBytes,trailingBytes:partial.length,error:error?.message??null};
   json(join(out,label+'-process.json'),receipt);
   if(!failed){assert.equal(error,null);assert.equal(exit,0);assert.equal(signal,null);assert.equal(stderrBytes,0);assert.equal(partial.length,0);assert.equal(requests,replies);}
   return receipt;
  }
 };
}
export function evidenceBudget(path){
 const baseline=JSON.parse(requireRead(path));let bytes=baseline.bytes;
 return {save(name,b){assert.ok(bytes+b.length<=CAP,'shared280MiB evidence cap');writeFileSync(name,b,{flag:'wx'});bytes+=b.length;},
  finish(){writeFileSync(path,JSON.stringify({bytes,cap:CAP,scratch:SCRATCH})+'\n');return bytes;}};
}
// Imported lazily only as filesystem access; never a provider load.
import {readFileSync} from 'node:fs';
const requireRead=path=>readFileSync(path,'utf8');
export function raw(bodies){assert.equal(bodies.length,9);const b=Buffer.alloc(936);let i=0;for(const body of bodies)for(const [key,count]of [['positionM',3],['velocityMps',3],['orientation',4],['angularVelocityRadps',3]])for(let k=0;k<count;k++){assert.ok(Number.isFinite(body[key][k]));b.writeDoubleLE(body[key][k],i);i+=8;}return b;}
export function archive(out,name,budget){
 const hash=createHash('sha256'),rawHash=createHash('sha256'),words=createHash('sha256');let records=0,rawBytes=0,compressedBytes=0,numericLeaves=0;
 return {write(record,frames){
  const line=wire(record,SCRATCH),rawBytesNeeded=frames.length*936;
  assert.ok(line.length+rawBytesNeeded<=SCRATCH,'combined scratch bound');
  // zlib's conservative deflate bound is lower than input+input/8+1024.
  assert.ok(2*(line.length+rawBytesNeeded)+4096<=SCRATCH,'compression scratch bound');
  const rb=Buffer.concat(frames.map(raw),rawBytesNeeded),z=gzipSync(line),rz=gzipSync(rb);
  // Each append is exclusive by scene/graph ownership; charge before append.
  const part=join(out,`${name}-${records}`);budget.save(part+'.jsonl.gz',z);budget.save(part+'.f64le.gz',rz);
  hash.update(line);rawHash.update(rb);visitWords(record,b=>{words.update(b);numericLeaves++;});rawBytes+=rb.length;compressedBytes+=z.length+rz.length;records++;
 },finish(){return {records,rawBytes,compressedBytes,decodedRecordSha256:hash.digest('hex'),rawSha256:rawHash.digest('hex'),numericLeaves,binary64BeWordSha256:words.digest('hex')};}};
}
