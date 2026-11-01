import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const pkg=resolve(root,'packages/barocss-physics');
const published=JSON.parse(readFileSync(resolve(pkg,'package.json'),'utf8')).publishConfig.exports;
const contents="import {createPhysicsWorld,PhysicsError} from '@barocss/physics'; console.log(createPhysicsWorld,PhysicsError);";
async function inputs(native){const result=await build({stdin:{contents,resolveDir:pkg,sourcefile:'cloth-model-consumer.ts'},bundle:true,write:false,format:'esm',platform:'node',metafile:true,conditions:native?[]:['barocss-source'],plugins:native?[{name:'actual-published-root',setup(api){api.onResolve({filter:/^@barocss\/physics$/},()=>({path:resolve(pkg,published['.'].import)}));}}]:[]});return Object.keys(result.metafile.inputs);}
const source=await inputs(false),compiled=await inputs(true);
assert(source.some(p=>p.endsWith('/src/index.ts')));assert(source.every(p=>!p.includes('/dist/')));
assert(compiled.some(p=>p.endsWith('/dist/index.js')));assert(compiled.every(p=>!p.includes('/src/')));
const program=`
import assert from 'node:assert/strict';
import {createPhysicsWorld,PhysicsError} from ${JSON.stringify(pathToFileURL(resolve(pkg,published['.'].import)).href)};
import {copyPhysicsModelPreset} from ${JSON.stringify(pathToFileURL(resolve(root,'examples/physics-model-data-2276/model-data.mjs')).href)};
const input=copyPhysicsModelPreset('cloth-pinned-sphere-visual-v1');
const world=createPhysicsWorld(input.model,input.options);
const state=world.step([]);assert.equal(state.stepIndex,1);assert.equal(state.cloths[0].positionsM.length/3,289);
world.dispose();assert.throws(()=>world.getState(),e=>e instanceof PhysicsError&&e.code==='DISPOSED');
console.log(JSON.stringify({result:'ok',stepIndex:state.stepIndex,vertexCount:state.cloths[0].positionsM.length/3,physicsErrorIdentity:true}));`;
const nodeConsumer=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',program],{cwd:root,encoding:'utf8'}));
console.log(JSON.stringify({result:'ok',sourceInputs:source,compiledInputs:compiled,nodeConsumer}));
