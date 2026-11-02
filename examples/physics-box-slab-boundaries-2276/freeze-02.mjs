// Authenticate the explicit repaired build and independent amendment. No World imports.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),build=resolve(home,'build/sign-02'),hash=b=>createHash('sha256').update(b).digest('hex');
const buildResult=JSON.parse(readFileSync(resolve(build,'result.json')));assert.equal(buildResult.status,'PASS_BUILD');assert.equal(buildResult.WorldCalls,0);
const providerFiles=JSON.parse(readFileSync(resolve(build,'provider-pins.json')));
for(const[path,pin]of Object.entries(providerFiles)){const absolute=realpathSync(resolve(root,path));assert(absolute.startsWith(root+'/'),'Provider escaped owned checkout');const bytes=readFileSync(absolute);assert.equal(bytes.length,pin.bytes);assert.equal(hash(bytes),pin.sha256,'Candidate provider drift: '+path);}
const bank=JSON.parse(readFileSync(resolve(home,'BANK-02.json'))),cases=JSON.parse(readFileSync(resolve(home,'CASES-02.json')));assert.equal(bank.cases.length,20);assert.deepEqual(bank.cases.map(c=>c.id),cases.cases.map(c=>c.id));assert.deepEqual(bank.physical,cases.physical);assert.equal(bank.WorldCalls,0);assert.equal(bank.candidateCalls,0);
assert.deepEqual(['finite','command','admission'].map(kind=>cases.cases.filter(c=>c.kind===kind).length),[16,2,2]);
const files={...providerFiles};for(const path of [resolve(home,'CONTRACT.md'),...['AMENDMENT-02.md','CASES-02.json','reference-02.py','run-02.mjs','freeze-02.mjs','BANK-02.json','build.mjs'].map(name=>resolve(home,name)),resolve(build,'provider-pins.json'),resolve(build,'result.json'),resolve(root,'examples/physics-model-input/model.mjs')]){const bytes=readFileSync(path);files[path.slice(root.length+1)]={bytes:bytes.length,sha256:hash(bytes)};}
const sourceModule='examples/physics-box-slab-boundaries-2276/build/sign-02/source.mjs',nativeModule='packages/barocss-physics/dist/index.js',replayModule='packages/barocss-physics/dist/replay.js';
for(const path of [sourceModule,nativeModule,replayModule])assert(files[path],'Required runtime entry not pinned');
const result={format:'physics-box-slab-freeze',version:1,provider:'sign-02 candidate build; identity quaternion sign invariance with unchanged thresholds',sourceModule,nativeModule,replayModule,caseFile:'examples/physics-box-slab-boundaries-2276/CASES-02.json',bankFile:'examples/physics-box-slab-boundaries-2276/BANK-02.json',files};
writeFileSync(resolve(home,'FREEZE-02.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PASS_AMENDMENT_FROZEN_FILES_ONLY',files:Object.keys(files).length,WorldCalls:0}));
