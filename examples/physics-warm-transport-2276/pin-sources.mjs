// Source/data hashing only; no imports from a physics, helper, build or observer graph.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..');
const pin=p=>{const b=readFileSync(p);return {bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};},files={};
function add(p,expected){const got=pin(p);if(expected)assert.deepEqual(got,expected,'Immutable dependency changed '+p);files[relative(root,p)]=got;}
const own=['CONTRACT.md','OBSERVER-AMENDMENT.md','warm-transport.ts','stage-patch.mjs','reference.py','build.mjs','run.mjs','observer.py','bank-observer.py','freeze.mjs','pin-sources.mjs','IMPLEMENTATION.md'];for(const n of own)add(resolve(home,n));
const producer=resolve(root,'examples/physics-contact-wrench-producer-2276');for(const n of ['SOURCE-PINS-03.json','encoding.mjs','trace_decode.py','observer.py','evidence/build-01/result.json','evidence/build-01/source.mjs'])add(resolve(producer,n));
const source=JSON.parse(readFileSync(resolve(producer,'SOURCE-PINS-03.json')));for(const[p,v]of Object.entries(source.files))add(resolve(root,p),v);
const receipt=JSON.parse(readFileSync(resolve(producer,'evidence/build-01/result.json')));assert.equal(receipt.status,'PASS_PRIVATE_PHASE_BUILD');assert.equal(receipt.WorldCalls,0);add(resolve(producer,'evidence/build-01/source.mjs'),receipt.source);for(const[p,v]of Object.entries(receipt.staged))add(resolve(producer,'evidence/build-01/stage',p),v);
const model=resolve(root,'examples/physics-real-warm-frame-2276');for(const n of ['observer.py','run.mjs','SOURCE-PINS-01.json','evidence/model-01/model.json','evidence/model-01/options.json','evidence/model-01/reference.json','evidence/warm-01/summary.json','EXECUTION-REVIEW-02.json','EVIDENCE-ARCHIVE.json'])add(resolve(model,n));
const reference=JSON.parse(readFileSync(resolve(model,'evidence/model-01/reference.json')));assert.equal(reference.status,'INPUT_REFERENCE_READY');for(const[p,v]of Object.entries(reference.sourcePins))add(resolve(root,p),v);for(const[p,v]of Object.entries(reference.generatedFiles))add(resolve(model,'evidence/model-01',p),v);
for(const n of ['evidence/gram-01/bank.json','evidence/gram-01/result.json'])add(resolve(home,n));
writeFileSync(resolve(home,'SOURCE-PINS-02.json'),JSON.stringify({format:'physics-warm-transport-source-freeze',version:1,status:'AUTHORED_NOT_EXECUTED',baselinePreserved:true,files},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'SOURCE_HASHES_FROZEN_ONLY',files:Object.keys(files).length,WorldCalls:0,candidateCalls:0}));
