import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,statSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {StreamArchive,retainedBudget,verifyArchive} from './archive.mjs';
test('25 general encoder retains history across acknowledged frame FLUSH',async()=>{
 assert.ok(process.env.HISTORY_TEST_OUT,'Set HISTORY_TEST_OUT to a fresh directory');const out=resolve(process.env.HISTORY_TEST_OUT);mkdirSync(out);
 const payload=Buffer.alloc(131072),counter=Buffer.alloc(4),domain=Buffer.from('stack-brotli-stateful-history-bank-v1\0','utf8');
 for(let i=0;i<4096;i++){counter.writeUInt32BE(i);createHash('sha256').update(domain).update(counter).digest().copy(payload,i*32);}
 const budget=retainedBudget(),archive=new StreamArchive(out,budget);await archive.appendRpc('TEST',1,'control','request',payload);const first=statSync(join(out,'events.br')).size;
 await archive.appendRpc('TEST',2,'control','request',payload);const second=statSync(join(out,'events.br')).size-first;
 assert.ok(second<payload.length/4,'second acknowledged compressed increment must be below32768 bytes');await archive.close();let recovered=0;
 const result=await verifyArchive(join(out,'events.br'),entry=>{assert.equal(entry.header.channel,'rpc');assert.equal(entry.header.step,++recovered);assert.deepEqual(entry.payload,payload,'exact high-entropy payload recovery');});assert.equal(result.status,'ARCHIVE_VERIFIED');assert.equal(recovered,2);const receipt=Buffer.from(JSON.stringify({status:'HISTORY_BANK_CONFIRMED',payloadBytes:131072,payloadSha256:createHash('sha256').update(payload).digest('hex'),firstAcknowledgedCompressedBytes:first,secondAcknowledgedCompressedIncrement:second,strictSecondIncrementLimit:32768,recoveredPayloads:recovered,quality:2,lgwin:20,chunkSize:65536})+'\n');budget.charge(receipt.length);writeFileSync(join(out,'history-result.json'),receipt,{flag:'wx'});
});
