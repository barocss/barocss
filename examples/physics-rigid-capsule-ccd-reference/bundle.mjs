import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
export const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..');
export async function verifyFreeze() {
  const freeze=JSON.parse(await readFile(resolve(here,'source-freeze.json'),'utf8'));
  assert.equal(process.version,freeze.node);
  for(const row of freeze.sources)assert.equal(createHash('sha256').update(await readFile(resolve(root,row.path))).digest('hex'),row.sha256,row.path);
  return freeze;
}
export async function bundle(graph,out) {
  await verifyFreeze();
  const plugin={name:'genuine-original-emitted-helpers',setup(builder) { builder.onResolve({filter:/^\.\.\/\.\.\/packages\/barocss-physics\/src\//},args=>({path:resolve(root,args.path.replace('../../packages/barocss-physics/src/','packages/barocss-physics/dist/').replace(/\.ts$/,'.js'))})); }};
  const result=await build({absWorkingDir:root,entryPoints:[resolve(here,'consumer-entry.mjs')],outfile:resolve(out,graph+'.mjs'),bundle:true,write:true,format:'esm',platform:'node',target:'node22',metafile:true,plugins:graph==='compiled-dependencies'?[plugin]:[]});
  const inputs=Object.keys(result.metafile.inputs),source=inputs.filter(p=>p.startsWith('packages/barocss-physics/src/')),dist=inputs.filter(p=>p.startsWith('packages/barocss-physics/dist/'));
  assert.ok(graph==='compiled-dependencies'?source.length===0&&dist.length>0:source.length>0&&dist.length===0);
  const audit={graph,inputs,sourceCount:source.length,distCount:dist.length,privateAdapterIsSource:true,publicConfigurableCapsule:false,sourceAliases:false};
  await mkdir(out,{recursive:true}); await writeFile(resolve(out,graph+'-graph.json'),JSON.stringify({audit,metafile:result.metafile},null,2)+'\n');
  return {path:resolve(out,graph+'.mjs'),audit};
}
