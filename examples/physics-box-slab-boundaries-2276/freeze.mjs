// File authentication only. No numerical imports, builds, or World calls.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),hash=b=>createHash('sha256').update(b).digest('hex');
const provider=JSON.parse(readFileSync(resolve(home,'PROVIDER-PINS-01.json')));
for(const[path,pin]of Object.entries(provider.files)){const absolute=realpathSync(resolve(root,path));assert(absolute.startsWith(root+'/'));const bytes=readFileSync(absolute);assert.equal(bytes.length,pin.bytes);assert.equal(hash(bytes),pin.sha256,'Original qualified provider drift: '+path);}
const bank=JSON.parse(readFileSync(resolve(home,'BANK-01.json'))),cases=JSON.parse(readFileSync(resolve(home,'CASES-01.json')));assert.equal(bank.cases.length,20);assert.equal(cases.cases.length,20);assert.deepEqual(bank.cases.map(c=>c.id),cases.cases.map(c=>c.id));assert.equal(bank.WorldCalls,0);assert.equal(bank.candidateCalls,0);
const files={...provider.files};for(const name of ['CONTRACT.md','CASES-01.json','reference.py','run.mjs','freeze.mjs','README.md','PROVIDER-PINS-01.json','BANK-01.json','build.mjs']){const path=resolve(home,name),bytes=readFileSync(path);files[path.slice(root.length+1)]={bytes:bytes.length,sha256:hash(bytes)};}
const result={format:'physics-box-slab-freeze',version:1,provider:provider.provider,sourceModule:provider.sourceModule,nativeModule:provider.nativeModule,replayModule:provider.replayModule,caseFile:'examples/physics-box-slab-boundaries-2276/CASES-01.json',bankFile:'examples/physics-box-slab-boundaries-2276/BANK-01.json',files};
writeFileSync(resolve(home,'FREEZE-01.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PASS_FROZEN_FILES_ONLY',files:Object.keys(files).length,WorldCalls:0}));
