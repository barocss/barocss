// Hash-only authorship freeze. No build, observer, reference, browser or World calls.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),files={};const pin=p=>{const b=readFileSync(p);return{bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};};function add(p,v){const actual=pin(p);if(v)assert.deepEqual(actual,v,'Frozen provider/scene drift '+p);files[relative(root,p)]=actual;}
for(const n of ['CAPTURE-FAILURE-01.json','review/executed-02/index.json','RENDERER-FINDING-01.json','CONTRACT.md','IMPLEMENTATION.md','browser-run.mjs','browser-checks.js','audit-browser.py','browser-node-parity.py','pin-sources.mjs'])add(resolve(home,n));for(const n of readdirSync(resolve(home,'scene')))add(resolve(home,'scene',n));
const provider=resolve(root,'examples/physics-warm-native-2276/evidence/build-01'),receipt=JSON.parse(readFileSync(resolve(provider,'result.json')));assert.equal(receipt.status,'PASS_PRIVATE_TYPED_WARM_DUAL_BUILD');assert.equal(receipt.WorldCalls,0);add(resolve(provider,'result.json'));for(const[p,v]of Object.entries(receipt.emittedFiles))add(resolve(provider,p),v);for(const[p,v]of Object.entries(receipt.staged))add(resolve(provider,'stage',p),v);
const original=resolve(root,'examples/physics-real-warm-frame-2276/evidence/model-01');for(const n of ['model.json','options.json','reference.json'])add(resolve(original,n));for(const n of ['encoding.mjs','trace_decode.py'])add(resolve(root,'examples/physics-contact-wrench-producer-2276',n));add(resolve(root,'examples/physics-warm-transport-2276/observer.py'));add(resolve(root,'examples/physics-lab/owned-packages.mjs'));add(resolve(root,'packages/barocss-viewer/src/index.ts'));
const native=resolve(root,'examples/physics-warm-native-2276/evidence/native-01');for(const n of ['summary.json','A-initial-trace.json','A-step1-trace.json','A-retry2-trace.json','A-step1-full-snapshot.json','A-retry2-full-snapshot.json'])add(resolve(native,n));add(resolve(root,'examples/physics-warm-native-2276/evidence/parity-01/result.json'));
// Conservatively prefreeze every source byte and export manifest in the actual
// Viewer/GPU/CAD/Interop family before any scene build, not after discovery.
function tree(folder){for(const e of readdirSync(folder,{withFileTypes:true})){const path=resolve(folder,e.name);assert(!e.isSymbolicLink(),'No source symlinks');if(e.isDirectory())tree(path);else add(path);}}
for(const name of ['viewer','gpu','cad','cad-interop']){const directory=resolve(root,'packages/barocss-'+name);add(resolve(directory,'package.json'));tree(resolve(directory,'src'));}
writeFileSync(resolve(home,'SOURCE-PINS-03.json'),JSON.stringify({format:'physics-warm-viewer-source-freeze',version:1,status:'AUTHORED_NOT_EXECUTED',files},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'SOURCE_HASHES_FROZEN_ONLY',files:Object.keys(files).length,WorldCalls:0,candidateCalls:0}));
