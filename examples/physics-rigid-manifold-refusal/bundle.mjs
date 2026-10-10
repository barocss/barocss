import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest,verifyHash} from './archive.mjs';
export const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..');
export async function bundle(graph,out) {
  assert.ok(['source','compiled-dependencies'].includes(graph));
  const frozen=JSON.parse(await readFile(resolve(here,'frozen-inputs.json')));
  for(const row of frozen.dependencyLedger.imports) verifyHash(await readFile(resolve(root,row.path)),row.sha256,row.path);
  for(const [file,hash] of Object.entries(frozen.reusedConsumerHashes)) verifyHash(await readFile(resolve(root,file)),hash,file);
  const sourceHashes=JSON.parse(await readFile(resolve(here,'frozen-source.json')));
  for(const [file,hash] of Object.entries(sourceHashes)) verifyHash(await readFile(resolve(here,file)),hash,file);
  const compiled={name:'original-emitted-helpers',setup(builder) {builder.onResolve({filter:/^\.\.\/\.\.\/packages\/barocss-physics\/src\//},args=>({path:resolve(root,args.path.replace('../../packages/barocss-physics/src/','packages/barocss-physics/dist/'))}));}};
  await mkdir(out,{recursive:true});
  const path=resolve(out,`${graph}.mjs`);
  const result=await build({absWorkingDir:root,entryPoints:[resolve(here,'entry.ts')],outfile:path,bundle:true,format:'esm',platform:'node',target:'node22',metafile:true,plugins:graph==='compiled-dependencies'?[compiled]:[]});
  const inputs=Object.keys(result.metafile.inputs);const src=inputs.filter(p=>p.startsWith('packages/barocss-physics/src/'));const dist=inputs.filter(p=>p.startsWith('packages/barocss-physics/dist/'));
  assert.ok(graph==='source'?src.length>0&&dist.length===0:src.length===0&&dist.length>0);
  const audit={graph,originalSourceCount:src.length,originalDistCount:dist.length,observerSource:true,worldStepped:false,inputs:await Promise.all(inputs.map(async path=>({path,sha256:digest(await readFile(resolve(root,path)))})))};
  await writeFile(resolve(out,`${graph}-graph.json`),JSON.stringify(audit,null,2)+'\n');return {path,audit};
}
