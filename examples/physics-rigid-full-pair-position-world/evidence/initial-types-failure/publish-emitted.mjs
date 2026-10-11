/** Root metadata-only publisher after actual build/types, before ONE consumer. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha} from './archive.mjs';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..'),out=resolve(process.argv[2]);
const bytes=await readFile(out+'/emitted-pre-consumer.json'),ledger=JSON.parse(bytes);assert.equal(ledger.beforeNumericalConsumer,true);assert.equal(ledger.node,process.version);assert.equal(ledger.sourceFreezeSha256,sha(await readFile(here+'/source-freeze.json')));assert.ok(ledger.files.length>0);
for(const row of ledger.files){assert.equal(row.actualPath,root+'/'+row.path);const data=await readFile(row.actualPath);assert.equal(data.length,row.bytes);assert.equal(sha(data),row.sha256);}
console.log(JSON.stringify({issue:1399,actualEmittedFiles:ledger.files.length,emittedLedgerSha256:sha(bytes),measuredSource:ledger.measuredSource,actualBuildHead:ledger.actualBuildHead,currentConsumerHead:ledger.currentConsumerHead,sourceFreezeSha256:ledger.sourceFreezeSha256,numericalConsumerExecuted:false}));
