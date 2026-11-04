import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {brotliCompressSync,brotliDecompressSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {StreamArchive,retainedBudget,verifyArchive,crc32,LIMITS,CODEC_OPTIONS} from './archive.mjs';
import {literalLogical,literalPhysical} from './fixture-wrapper.mjs';
const gunzipSync=bytes=>literalLogical(brotliDecompressSync(bytes)),gzipSync=bytes=>brotliCompressSync(literalPhysical(bytes),CODEC_OPTIONS);
assert.ok(process.env.STREAM_TEST_OUT,'Set STREAM_TEST_OUT to a fresh directory');
const home=resolve(process.env.STREAM_TEST_OUT);mkdirSync(home,{recursive:false});let ordinal=0;
const fresh=()=>{const p=join(home,String(++ordinal));mkdirSync(p);return p;};
const open=(budget=retainedBudget())=>{const path=fresh();return {path,w:new StreamArchive(path,budget),budget};};
const hash=b=>createHash('sha256').update(b).digest('hex');
const word=n=>{const b=Buffer.alloc(8);b.writeDoubleBE(n);return b.toString('hex');};
const words=v=>{const out=[];const walk=x=>{if(typeof x==='number')out.push(word(x));else if(x&&typeof x==='object')for(const k of Object.keys(x))walk(x[k]);};walk(v);return out;};
const collect=async p=>{const entries=[];const result=await verifyArchive(join(p,'events.br'),e=>{entries.push(e);});return {entries,result};};
async function one(bytes=Buffer.from('request\n')){const x=open();await x.w.appendRpc('TEST',1,'control','request',bytes);await x.w.close();return x;}
function changed(path,change){const bytes=gunzipSync(readFileSync(join(path,'events.br')));change(bytes);const p=fresh();writeFileSync(join(p,'events.br'),gzipSync(bytes));return p;}

test('01 CRC literal check vector',()=>{assert.equal(crc32(Buffer.from('123456789')),0xcbf43926);});
test('02 independent binary64 word bank survives JSON loss',async()=>{
 const value=[0,-0,Number.MIN_VALUE,-Number.MIN_VALUE,Number.MAX_VALUE,-Number.MAX_VALUE,1,-1,2**-1022];
 const expected=['0000000000000000','8000000000000000','0000000000000001','8000000000000001','7fefffffffffffff','ffefffffffffffff','3ff0000000000000','bff0000000000000','0010000000000000'];
 const x=open();await x.w.appendRecord('TEST',1,value);await x.w.close();const r=await collect(x.path);assert.equal(r.result.status,'ARCHIVE_VERIFIED');assert.deepEqual(words(r.entries[0].record),expected);assert.equal(r.entries[0].words.toString('hex'),expected.join(''));assert.equal(r.result.decodedRecordSha256,hash(Buffer.from(JSON.stringify(value)+'\n')));assert.equal(r.result.binary64BeWordSha256,hash(Buffer.from(expected.join(''),'hex')));
});
test('03 Unicode strings and Object.keys order',async()=>{
 const record={'2':2,'1':1,z:'한글 😀 \u0000 \ud800',a:[true,null,'±0'],n:-0},x=open();await x.w.appendRecord('TEST',0,record);await x.w.close();const r=await collect(x.path);assert.deepEqual(r.entries[0].record,record);assert.equal(r.entries[0].jsonBytes.toString(),JSON.stringify(record)+'\n');
});
test('04 caller mutation cannot change owned bytes or words',async()=>{
 const x=open(),b=Buffer.from('BEFORE'),r={value:-0,list:[1]},a=x.w.appendRpc('TEST',1,'control','request',b),c=x.w.appendRecord('TEST',1,r);b.fill(0);r.value=9;r.list[0]=7;await Promise.all([a,c]);await x.w.close();const got=await collect(x.path);assert.equal(got.entries[0].payload.toString(),'BEFORE');assert.deepEqual(words(got.entries[1].record),['8000000000000000','3ff0000000000000']);
});
test('05 aliases remain separate fingerprint metadata',async()=>{
 const child={x:-0},record={a:child,b:child},fp='a'.repeat(64),x=open();const pending=x.w.appendRecord('TEST',1,record,Buffer.alloc(0),Buffer.alloc(0),fp);child.x=42;await pending;await x.w.close();const r=await collect(x.path);assert.equal(r.entries[0].header.aliasFingerprint,fp);assert.deepEqual(words(r.entries[0].record),['8000000000000000','8000000000000000']);assert.notEqual(r.entries[0].record.a,r.entries[0].record.b);
});
test('06 exact 2MiB wire allowed; oversized rejected without index gap',async()=>{
 const x=open();assert.throws(()=>x.w.appendRpc('TEST',1,'control','reply',Buffer.alloc(LIMITS.wire+1)),{code:'PAYLOAD_BOUND'});await x.w.appendRpc('TEST',1,'control','reply',Buffer.alloc(LIMITS.wire));await x.w.close();const r=await collect(x.path);assert.equal(r.entries[0].payload.length,LIMITS.wire);assert.equal(r.entries[0].header.index,0);
});
test('07 malformed graph preflight',async()=>{
 const x=open(),cycle={};cycle.self=cycle;let deep=0;for(let i=0;i<66;i++)deep=[deep];
 for(const v of [{n:Infinity},[NaN],Array(2),cycle,Object.create(null),deep,{get value(){throw Error('getter must not run');}}])assert.throws(()=>x.w.appendRecord('TEST',1,v));
 await x.w.close();assert.equal((await collect(x.path)).result.status,'ARCHIVE_VERIFIED');
});
test('08 queue count backpressure; accepted tasks remain bounded',async()=>{
 const x=open(),jobs=[];for(let i=0;i<4;i++)jobs.push(x.w.appendRpc('TEST',i,'control','request',Buffer.from('x')));assert.equal(x.w.pendingCount,4);assert.throws(()=>x.w.appendRpc('TEST',5,'control','request',Buffer.from('x')),{code:'ARCHIVE_BACKPRESSURE'});await Promise.all(jobs);await x.w.appendRpc('TEST',5,'control','request',Buffer.from('x'));await x.w.close();assert.equal((await collect(x.path)).result.entries,5);
});
test('09 pending byte cap before copy',async()=>{
 const x=open(),b=Buffer.alloc(LIMITS.wire),jobs=[];for(let i=0;i<3;i++)jobs.push(x.w.appendPacket('TEST',i,'b'.repeat(64),b));assert.throws(()=>x.w.appendPacket('TEST',3,'b'.repeat(64),b),{code:'ARCHIVE_BACKPRESSURE'});assert.ok(x.w.pendingBytes<=LIMITS.pending);await Promise.all(jobs);await x.w.close();
});
test('10 append acknowledgement has kernel-written a complete prefix',async()=>{
 const x=open();await x.w.appendRpc('TEST',1,'control','request',Buffer.from('durable'));assert.ok(statSync(join(x.path,'events.br')).size>0);const r=await collect(x.path);assert.equal(r.result.status,'ARCHIVE_INCOMPLETE');assert.equal(r.result.entries,1);await x.w.close();
});
test('11 compressed exact cap succeeds; one byte below fails closed',async()=>{
 const baseline=await one(),size=statSync(join(baseline.path,'events.br')).size,reserve=4096;
 const exact=open(retainedBudget({cap:size+reserve,reserve}));await exact.w.appendRpc('TEST',1,'control','request',Buffer.from('request\n'));await exact.w.close();assert.equal(exact.budget.used,size);assert.equal((await collect(exact.path)).result.status,'ARCHIVE_VERIFIED');
 const less=open(retainedBudget({cap:size+reserve-1,reserve}));try{await less.w.appendRpc('TEST',1,'control','request',Buffer.from('request\n'));}catch{}await assert.rejects(less.w.close());assert.equal(JSON.parse(readFileSync(join(less.path,'stop.json'))).status,'ARCHIVE_STOPPED');assert.equal((await collect(less.path)).result.status,'ARCHIVE_INCOMPLETE');assert.ok(less.budget.used<=less.budget.cap);
});
test('12 corrupted frame CRC rejected',async()=>{
 const x=await one(),p=changed(x.path,b=>{b[16+b.readUInt32BE(4)]^=1;});const r=await collect(p);assert.equal(r.result.status,'ARCHIVE_INCOMPLETE');assert.equal(r.result.code,'FRAME_CRC');
});
test('13 lengths rejected before payload allocation',async()=>{
 for(const headerTooLarge of [true,false]){const p=fresh(),h=Buffer.from(JSON.stringify({channel:'rpc',scene:'TEST',step:0,op:'control',kind:'request',index:0,bytes:LIMITS.wire+1,sha256:'0'.repeat(64)})),prefix=Buffer.alloc(16);prefix.write('S227');prefix.writeUInt32BE(headerTooLarge?LIMITS.header+1:h.length,4);prefix.writeUInt32BE(LIMITS.wire+1,8);writeFileSync(join(p,'events.br'),gzipSync(Buffer.concat([prefix,h])));const r=await collect(p);assert.equal(r.result.status,'ARCHIVE_INCOMPLETE');assert.equal(r.result.code,headerTooLarge?'FRAME_LENGTH_BEFORE_ALLOCATION':'FRAME_HEADER');}
});
test('14 truncated Brotli, invalid stream and trailing bytes never pass',async()=>{
 const x=await one(),bytes=readFileSync(join(x.path,'events.br'));for(const damaged of [bytes.subarray(0,bytes.length-1),bytes.subarray(0,1),Buffer.from([255]),Buffer.concat([bytes,Buffer.from([1])]),Buffer.concat([bytes,brotliCompressSync(Buffer.from('suffix'),CODEC_OPTIONS)])]){const p=fresh();writeFileSync(join(p,'events.br'),damaged);assert.equal((await collect(p)).result.status,'ARCHIVE_INCOMPLETE');}
});
test('15 SHA and index checked independently of valid frame CRC',async()=>{
 const x=await one();assert.equal((await verifyArchive(join(x.path,'events.br'),async()=>{},'0'.repeat(64))).code,'COMPRESSED_SHA');for(const field of ['sha256','index']){const p=changed(x.path,b=>{const n=b.readUInt32BE(4),size=b.readUInt32BE(8),h=JSON.parse(b.subarray(16,16+n));h[field]=field==='index'?7:'0'.repeat(64);const next=Buffer.from(JSON.stringify(h));assert.equal(next.length,n);next.copy(b,16);b.writeUInt32BE(crc32(b.subarray(16,16+n+size)),12);});const r=await collect(p);assert.equal(r.result.code,field==='index'?'FRAME_HEADER':'FRAME_SHA');}
 const y=open();await y.w.appendRecord('TEST',1,{n:1});await y.w.close();const p=changed(y.path,b=>{const hlen=b.readUInt32BE(4),plen=b.readUInt32BE(8),payload=b.subarray(16+hlen,16+hlen+plen),jsonLen=payload.readUInt32BE(0);payload.writeDoubleBE(2,16+jsonLen);const h=JSON.parse(b.subarray(16,16+hlen));h.sha256=hash(payload);Buffer.from(JSON.stringify(h)).copy(b,16);b.writeUInt32BE(crc32(b.subarray(16,16+hlen+plen)),12);});assert.equal((await collect(p)).result.code,'WORD_JSON_DISAGREEMENT');
});
test('16 later cap failure retains the earlier kernel-written prefix',async()=>{
 const a=open();await a.w.appendRpc('TEST',1,'control','request',Buffer.from('first'));const prefixBytes=statSync(join(a.path,'events.br')).size;await a.w.close();
 const b=open(retainedBudget({cap:prefixBytes+4096,reserve:4096}));await b.w.appendRpc('TEST',1,'control','request',Buffer.from('first'));await assert.rejects(b.w.appendRpc('TEST',2,'control','reply',Buffer.from('second')));await assert.rejects(b.w.close());const r=await collect(b.path);assert.equal(r.result.status,'ARCHIVE_INCOMPLETE');assert.equal(r.result.entries,1);assert.equal(r.entries[0].payload.toString(),'first');assert.equal(JSON.parse(readFileSync(join(b.path,'stop.json'))).kernelWrittenCompleteFrames,1);
});
test('17 raw body/point words and original RPC whitespace exact',async()=>{
 const body=Buffer.from('00000000000000800100000000000000','hex'),point=Buffer.from('ffffffffffffef7f','hex'),rpc=Buffer.from(' {"x": -0, "u":"한"}\n'),x=open();await x.w.appendRecord('TEST',1,{n:-0},body,point);await x.w.appendRpc('TEST',1,'control','request',rpc);await x.w.close();const r=await collect(x.path);assert.equal(hash(r.entries[0].bodyRaw),hash(body));assert.equal(hash(r.entries[0].pointRaw),hash(point));assert.deepEqual(r.entries[1].payload,rpc);assert.equal(r.result.rawSha256,hash(Buffer.concat([body,point])));
});
test('18 close joins streams; no appends or second close',async()=>{
 const x=open(),pending=x.w.appendRpc('TEST',1,'control','reply',Buffer.from('last'));const closed=x.w.close();await pending;assert.equal((await closed).status,'ARCHIVE_CLOSED');assert.ok(x.w.encoder.destroyed&&x.w.sink.destroyed);assert.throws(()=>x.w.appendRpc('TEST',2,'control','request',Buffer.from('x')),{code:'ARCHIVE_STOPPED'});await assert.rejects(x.w.close(),{code:'ARCHIVE_CLOSED'});
});
