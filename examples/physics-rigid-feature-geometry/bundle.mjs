import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest,verify} from './archive.mjs';
export const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..');
export async function bundle(graph,out) {
  assert.ok(['source','source-repeat','compiled-dependencies'].includes(graph));
  const frozen=JSON.parse(await readFile(resolve(here,'frozen-inputs.json')));
  for(const row of frozen.originalSourceLedger) verify(await readFile(resolve(root,row.path)),row.sha256,row.path);
  for(const [path,hash] of Object.entries(frozen.reusedConsumerHashes)) verify(await readFile(resolve(root,path)),hash,path);
  for(const [path,hash] of Object.entries(JSON.parse(await readFile(resolve(here,'frozen-source.json'))))) verify(await readFile(resolve(here,path)),hash,path);
  const plugin={name:'genuine-emitted-original-helpers',setup(b){b.onResolve({filter:/^\.\.\/\.\.\/packages\/barocss-physics\/src\//},args=>({path:resolve(root,args.path.replace('../../packages/barocss-physics/src/','packages/barocss-physics/dist/'))}));}};
  await mkdir(out,{recursive:true});const path=resolve(out,`${graph}.mjs`);
  const built=await build({absWorkingDir:root,entryPoints:[resolve(here,'entry.ts')],outfile:path,bundle:true,format:'esm',platform:'node',target:'node22',metafile:true,plugins:graph==='compiled-dependencies'?[plugin]:[]});
  const inputs=Object.keys(built.metafile.inputs),src=inputs.filter(p=>p.startsWith('packages/barocss-physics/src/')),dist=inputs.filter(p=>p.startsWith('packages/barocss-physics/dist/'));
  assert.ok(graph==='compiled-dependencies'?src.length===0&&dist.length>0:src.length>0&&dist.length===0);
  const audit={graph,originalSourceCount:src.length,originalDistCount:dist.length,privateGeometrySource:true,worldStepped:false,inputs:await Promise.all(inputs.map(async path=>({path,sha256:digest(await readFile(resolve(root,path)))})))};
  await writeFile(resolve(out,`${graph}-graph.json`),JSON.stringify(audit,null,2)+'\n');return {path,audit};
}
