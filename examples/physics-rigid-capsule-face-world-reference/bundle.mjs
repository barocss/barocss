import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {here,root,verifySource,verifyEmitted,digest} from './freeze.mjs';
export {here,root,verifySource,verifyEmitted,digest};
export async function bundle(graph,out){
 assert.ok(['source','source-repeat','compiled-dependencies'].includes(graph));await verifySource();await verifyEmitted(out);
 const plugin={name:'genuine-original-emitted-helpers',setup(builder){builder.onResolve({filter:/^\.\.\/\.\.\/packages\/barocss-physics\/src\//},args=>({path:resolve(root,args.path.replace('../../packages/barocss-physics/src/','packages/barocss-physics/dist/').replace(/\.ts$/,'.js'))}));}};
 await mkdir(out,{recursive:true});const path=resolve(out,`${graph}.mjs`),result=await build({absWorkingDir:root,entryPoints:[resolve(here,'consumer-entry.mjs')],outfile:path,bundle:true,write:true,format:'esm',platform:'node',target:'node22',metafile:true,plugins:graph==='compiled-dependencies'?[plugin]:[]});
 const inputs=Object.keys(result.metafile.inputs),source=inputs.filter(p=>p.startsWith('packages/barocss-physics/src/')),dist=inputs.filter(p=>p.startsWith('packages/barocss-physics/dist/'));
 assert.ok(graph==='compiled-dependencies'?source.length===0&&dist.length>0:source.length>0&&dist.length===0);assert.ok(inputs.includes('examples/physics-rigid-capsule-face-world-reference/candidate-world.ts'));assert.ok(inputs.includes('examples/physics-rigid-capsule-ccd-reference/face-sweep.ts'));
 const audit={graph,sourceCount:source.length,distCount:dist.length,candidateIsSource:true,adoptedFaceLawIsSource:true,sourceAliases:false,inputs:await Promise.all(inputs.map(async path=>({path,sha256:digest(await readFile(resolve(root,path)))})))};
 await writeFile(resolve(out,`${graph}-graph.json`),JSON.stringify({audit,metafile:result.metafile},null,2)+'\n');return {path,audit};
}
