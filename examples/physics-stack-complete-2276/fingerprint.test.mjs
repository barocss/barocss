// Transport controls only. No engine, World or numerical reference imports.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {fingerprint as previous} from '../physics-stack-pipeline-2276/protocol.mjs';
import {fingerprint,verifyFingerprint} from './fingerprint.mjs';
const digest=hex=>createHash('sha256').update(Buffer.from(hex,'hex')).digest('hex');
test('01 literal negative-zero canonical bytes are an independent oracle',()=>{
 assert.equal(fingerprint({x:-0}).sha256,digest('4f00000000000000014b00000001007844800000000000000045'));
 assert.notEqual(fingerprint({x:-0}).sha256,fingerprint({x:0}).sha256);
});
test('02 literal Unicode transcript uses original UTF16 code units',()=>{
 assert.equal(fingerprint({a:'가'}).sha256,digest('4f00000000000000014b0000000100615300000001ac0045'));
 assert.deepEqual(fingerprint({a:'가\ud800😀'}),previous({a:'가\ud800😀'}));
});
test('03 every independent finite binary64 word matches the qualified transcript',()=>{
 const words=['0000000000000000','8000000000000000','0000000000000001','8000000000000001','0010000000000000','7fefffffffffffff','ffefffffffffffff'];
 const packet={values:words.map(hex=>Buffer.from(hex,'hex').readDoubleBE()),yes:true,no:false,nil:null};
 assert.deepEqual(fingerprint(packet),previous(packet));verifyFingerprint(structuredClone(packet),fingerprint(packet));
});
test('04 aliases, property order and mutation retain the existing rules',()=>{
 const shared={value:[-0,1]},packet={left:shared,right:shared};assert.deepEqual(fingerprint(packet),previous(packet));
 assert.deepEqual(fingerprint(structuredClone(packet)),fingerprint(packet));
 assert.notEqual(fingerprint(packet).sha256,fingerprint({left:{value:[-0,1]},right:{value:[-0,1]}}).sha256);
 const expected=fingerprint(packet);packet.left.value[0]=0;assert.throws(()=>verifyFingerprint(packet,expected));
});
test('05 all48 captured prepared graphs match; captured JSON is not live sign authority',()=>{
 const base=new URL('../physics-stack-library-2276/evidence/run-09/native/',import.meta.url);let count=0;
 for(const scene of ['ALIGNED','OFFSET','YAW'])for(let step=1;step<=16;step++){
  const record=JSON.parse(gunzipSync(readFileSync(new URL(`${scene}-16-${step}.jsonl.gz`,base)),{maxOutputLength:2*1024*1024}));
  const packet={scene,step,priorBodies:record.before.bodies,prepared:record.prepared};assert.deepEqual(fingerprint(packet),previous(packet));count++;
 }assert.equal(count,48);
});
test('06 admission refuses before transcript allocation',()=>{
 for(const value of [{n:NaN},{s:'x'.repeat(2*1024*1024)},{a:new Array(1)}])assert.throws(()=>fingerprint(value),error=>error.stage==='admission');
 const cycle={};cycle.self=cycle;assert.throws(()=>fingerprint(cycle),error=>error.code==='CYCLE');
});
