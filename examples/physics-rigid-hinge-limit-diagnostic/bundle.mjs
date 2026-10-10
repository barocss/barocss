import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest} from './archive.mjs';
export const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..');
export async function validateSource(expected){const frozen=expected??JSON.parse(await readFile(resolve(here,'frozen-source.json')));for(const [path,hash]of Object.entries(frozen))assert.equal(digest(await readFile(resolve(here,path))),hash,`source drift: ${path}`);return frozen;}
export async function bundle(graph,out){
 await validateSource();assert.ok(['source','source-repeat','compiled-dependencies'].includes(graph));
 const compiled={name:'genuine-original-hinge-helpers',setup(b){b.onResolve({filter:/^\.\.\/\.\.\/packages\/barocss-physics\/src\//},args=>({path:resolve(root,args.path.replace('../../packages/barocss-physics/src/','packages/barocss-physics/dist/'))}));}};
 await mkdir(out,{recursive:true});const path=resolve(out,`${graph}.mjs`),result=await build({absWorkingDir:root,entryPoints:[resolve(here,'entry.ts')],outfile:path,bundle:true,format:'esm',platform:'node',target:'node22',metafile:true,plugins:graph==='compiled-dependencies'?[compiled]:[]});
 const inputs=Object.keys(result.metafile.inputs),src=inputs.filter(p=>p.startsWith('packages/barocss-physics/src/')),dist=inputs.filter(p=>p.startsWith('packages/barocss-physics/dist/'));
 assert.ok(graph==='compiled-dependencies'?src.length===0&&dist.length>0:src.length>0&&dist.length===0);
 assert.ok(inputs.includes('examples/physics-rigid-hinge-limit-diagnostic/adapter.ts')&&inputs.includes('examples/physics-rigid-hinge-limit-diagnostic/entry.ts'));
 assert.ok(!inputs.some(p=>p.includes('/world.')||p.includes('reference-world')||p.includes('joint-motor')||p.includes('global-island')||p.includes('position-relaxation')),'no world/motor/island/projection-loop module');
 const audit={graph,originalSourceCount:src.length,originalDistCount:dist.length,privateAdapterSource:true,worldCreated:false,worldStepped:false,motorDriven:false,inputs:await Promise.all(inputs.map(async path=>({path,sha256:digest(await readFile(resolve(root,path)))})))};
 await writeFile(resolve(out,`${graph}-graph.json`),JSON.stringify(audit,null,2)+'\n');return {path,audit};
}
