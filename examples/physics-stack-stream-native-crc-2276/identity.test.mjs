import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {StreamArchive,retainedBudget,verifyArchive} from './archive.mjs';
import {StreamArchive as OldArchive,retainedBudget as oldBudget,verifyArchive as oldVerify} from '../physics-stack-stream-sized-2276/archive.mjs';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..');
test('25 only CRC primitive differs; gzip bytes and complete recovered entries are exact',async()=>{
 const original=readFileSync(join(root,'examples/physics-stack-stream-sized-2276/archive.mjs'),'utf8');
 const transformed=original.replace("import {createGzip,createGunzip,constants} from 'node:zlib';","import {createGzip,createGunzip,constants,crc32 as nativeCRC32} from 'node:zlib';").replace(/const crcTable=[\s\S]*?export const crc32=[^\n]*;/,'export const crc32=(bytes,seed=0)=>nativeCRC32(bytes,seed);').replace('(crcUpdate(crcUpdate(0xffffffff,json),payload)^0xffffffff)>>>0','crc32(payload,crc32(json))').replace('((crcUpdate(crcUpdate(0xffffffff,head),payload)^0xffffffff)>>>0)','crc32(payload,crc32(head))');
 assert.equal(readFileSync(join(home,'archive.mjs'),'utf8'),transformed,'entire source equality outside exact CRC replacements');
 const pins=JSON.parse(readFileSync(join(root,'examples/physics-stack-evidence-refs-2276/PINS.json')));
 assert.ok(process.env.NATIVE_CRC_TEST_OUT,'Set NATIVE_CRC_TEST_OUT to a fresh directory');const dir=resolve(process.env.NATIVE_CRC_TEST_OUT);mkdirSync(dir);const left=join(dir,'old'),right=join(dir,'native');mkdirSync(left);mkdirSync(right);
 const writers=[new OldArchive(left,oldBudget()),new StreamArchive(right,retainedBudget())];
 const values={bank:[0,-0,Number.MIN_VALUE,-Number.MIN_VALUE,Number.MAX_VALUE,-Number.MAX_VALUE],text:'한😀\n\u0000\ud800'};
 const rpc=Object.entries(pins.rpc).map(([key,p])=>{const [op,kind]=key.split(':');return {op,kind,bytes:readFileSync(join(root,p.path))};});
 const record=JSON.parse(gunzipSync(readFileSync(join(root,pins.record.json.path)),{maxOutputLength:2**21}));
 const body=gunzipSync(readFileSync(join(root,pins.record.raw.path)),{maxOutputLength:3744}),point=Buffer.from(record.pointOperandF64leHex,'hex');
 for(const w of writers){await w.appendRecord('TEST',0,values);for(const r of rpc)await w.appendRpc('ALIGNED',2,r.op,r.kind,r.bytes);await w.appendRecord('ALIGNED',2,record,body,point);await w.close();}
 assert.deepEqual(readFileSync(join(left,'events.gz')),readFileSync(join(right,'events.gz')),'complete compressed GZIP identity');
 const a=[],b=[];const old=await oldVerify(join(left,'events.gz'),e=>a.push(e)),actual=await verifyArchive(join(right,'events.gz'),e=>b.push(e));assert.deepEqual(b,a);assert.deepEqual(actual,old);assert.ok(Object.is(b[0].record.bank[1],-0));
});
