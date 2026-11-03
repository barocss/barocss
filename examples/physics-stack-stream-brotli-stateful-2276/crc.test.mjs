import test from 'node:test';
import assert from 'node:assert/strict';
import {crc32} from './archive.mjs';
import {crc32 as oldJS} from '../physics-stack-stream-sized-2276/archive.mjs';
test('24 native CRC preserves old literal, full-buffer and chained byte vectors',()=>{
 assert.equal(crc32(Buffer.alloc(0)),0);assert.equal(crc32(Buffer.from('123456789')),0xcbf43926);
 const bank=[Buffer.alloc(0),Buffer.from('123456789'),Buffer.from('한글😀\u0000\n'),Buffer.from('0000000000000000800000000000000000000000000000017fefffffffffffff','hex'),Buffer.from(Array.from({length:131073},(_,i)=>i%256))];
 for(const bytes of bank){assert.equal(crc32(bytes),oldJS(bytes));for(const width of [1,7,64,65536]){let seed=0;for(let at=0;at<bytes.length;at+=width)seed=crc32(bytes.subarray(at,at+width),seed);assert.equal(seed,oldJS(bytes));}}
 const header=Buffer.from('{"channel":"rpc","index":0,"bytes":9}'),payload=Buffer.from('123456789');assert.equal(crc32(payload,crc32(header)),oldJS(Buffer.concat([header,payload])));
});
