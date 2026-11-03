import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {StreamArchive,retainedBudget,verifyArchive,LIMITS} from './archive.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),home=resolve(process.env.SIZED_TEST_OUT??process.env.STREAM_TEST_OUT+'-sized');mkdirSync(home);let serial=0;
function fresh(){const path=join(home,String(++serial));mkdirSync(path);return {path,w:new StreamArchive(path,retainedBudget())};}
async function roundtrip(record,body=Buffer.alloc(0),point=Buffer.alloc(0)){
 const x=fresh(),expected=Buffer.from(JSON.stringify(record)+'\n');await x.w.appendRecord('TEST',1,record,body,point);await x.w.close();let seen=0;
 const result=await verifyArchive(join(x.path,'events.gz'),entry=>{assert.deepEqual(entry.jsonBytes,expected,'native JSON byte oracle');assert.deepEqual(entry.bodyRaw,body);assert.deepEqual(entry.pointRaw,point);seen++;});assert.equal(result.status,'ARCHIVE_VERIFIED');assert.equal(seen,1);return result;
}
test('19 exact nativeJSON escape, Unicode, surrogate and scalar bank',async()=>{
 const bank=[null,true,false,0,-0,Number.MIN_VALUE,Number.MAX_VALUE,'','\b\t\n\f\r\u0000\u001f"\\','한글😀','\ud800','\udfff','\ud800A\udc00',{'2':-0,'1':Number.MIN_VALUE,'한😀\n':[false,null,'\u0000']}];
 for(const value of bank)await roundtrip(value);
});
test('20 exact2MiB ASCII and escaped JSON boundary; one byte over refused',async()=>{
 for(const value of ['a'.repeat(LIMITS.wire-3),'\n'.repeat((LIMITS.wire-4)/2)+'a']){
  assert.equal(Buffer.byteLength(JSON.stringify(value)+'\n'),LIMITS.wire);await roundtrip(value);const x=fresh();assert.throws(()=>x.w.appendRecord('TEST',1,value+'a'),{code:'JSON_WORD_CAPACITY'});await x.w.close();
 }
});
test('21 captured actual failedALIGNED2 record fits unchanged limits',async()=>{
 const pins=JSON.parse(readFileSync(join(root,'examples/physics-stack-pipeline-2276/PINS.json'))),entry=pins.records['ALIGNED:2'];
 const original=gunzipSync(readFileSync(join(root,entry.json.path)),{maxOutputLength:LIMITS.wire}),body=gunzipSync(readFileSync(join(root,entry.raw.path)),{maxOutputLength:3744}),record=JSON.parse(original),point=Buffer.from(record.pointOperandF64leHex,'hex');
 assert.equal(original.length,483481);assert.deepEqual(Buffer.from(JSON.stringify(record)+'\n'),original);const result=await roundtrip(record,body,point);assert.equal(result.numericLeaves,8842);assert.equal(result.numericLeaves*8,70736);
});
test('22 old implied512KiB word population remains explicit',async()=>{
 assert.equal(LIMITS.words,512*1024);const x=fresh();await x.w.appendRecord('TEST',1,Array(65536).fill(0));await x.w.close();assert.equal((await verifyArchive(join(x.path,'events.gz'))).numericLeaves,65536);const y=fresh();assert.throws(()=>y.w.appendRecord('TEST',1,Array(65537).fill(0)),{code:'JSON_WORD_CAPACITY'});await y.w.close();
});
test('23 fixed combined scratch boundary and one raw word over',async()=>{
 const value='a'.repeat(LIMITS.wire-3),wire=Buffer.alloc(LIMITS.wire);
 for(const extra of [0,8]){
  const x=fresh(),jobs=[x.w.appendRpc('TEST',0,'control','request',wire),x.w.appendRpc('TEST',0,'control','reply',wire)];assert.equal(x.w.pendingBytes,4198432);
  const raw=Buffer.alloc(1570792+extra);
  if(extra)assert.throws(()=>x.w.appendRecord('TEST',1,value,raw),{code:'ARCHIVE_BACKPRESSURE'});else jobs.push(x.w.appendRecord('TEST',1,value,raw));
  await Promise.all(jobs);if(extra)await x.w.appendRecord('TEST',1,value,raw);await x.w.close();assert.equal((await verifyArchive(join(x.path,'events.gz'))).status,'ARCHIVE_VERIFIED');
 }
});
