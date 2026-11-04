// Hash-only authorship freeze. No candidate imports or execution.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),files={};const pin=p=>{const b=readFileSync(p);return{bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};};function add(p,v){const actual=pin(p);if(v)assert.deepEqual(actual,v,p);files[relative(root,p)]=actual;}
for(const n of ['CONTRACT.md','IMPLEMENTATION.md','run.mjs','freeze.mjs','pin-sources.mjs','fault-observer.py'])add(resolve(home,n));
const old=resolve(root,'examples/physics-warm-transport-2276');for(const n of ['SOURCE-PINS-02.json','EXECUTION-FREEZE-02.json','evidence/freeze-01/frozen.json','evidence/build-01/result.json','evidence/build-01/source.mjs','evidence/warm-01/summary.json','evidence/warm-01/initial-observer.json','evidence/warm-01/step1-observer.json','evidence/warm-01/step2-observer.json','observer.py','RESULTS.json','EVIDENCE-ARCHIVE.json'])add(resolve(old,n));const frozen=JSON.parse(readFileSync(resolve(old,'evidence/freeze-01/frozen.json')));for(const[p,v]of Object.entries(frozen.files))add(resolve(root,p),v);
writeFileSync(resolve(home,'SOURCE-PINS-01.json'),JSON.stringify({format:'physics-warm-replay-source-freeze',version:1,status:'AUTHORED_NOT_EXECUTED',files},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'SOURCE_HASHES_FROZEN_ONLY',files:Object.keys(files).length,WorldCalls:0,candidateCalls:0}));
