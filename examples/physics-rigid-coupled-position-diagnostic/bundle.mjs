import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {digest} from './archive.mjs';
export const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..');
export async function verifyFreeze(override){const frozen=override??JSON.parse(await readFile(resolve(here,'source-freeze.json')));assert.equal(process.version,frozen.node);for(const r of frozen.sources)assert.equal(digest(await readFile(resolve(root,r.path))),r.sha256,'source drift: '+r.path);return frozen;}
export async function bundle(graph,out){
  await verifyFreeze();assert.ok(['source','source-repeat','compiled-dependencies'].includes(graph));await mkdir(out,{recursive:true});
  const compiled={name:'genuine-original-emitted-detector',setup(b){b.onResolve({filter:/^\.\.\/\.\.\/packages\/barocss-physics\/src\//},args=>({path:resolve(root,args.path.replace('../../packages/barocss-physics/src/','packages/barocss-physics/dist/'))}));}};
  const path=resolve(out,graph+'.mjs'),built=await build({absWorkingDir:root,entryPoints:[resolve(here,'entry.ts')],outfile:path,bundle:true,write:true,format:'esm',platform:'node',target:'node22',metafile:true,plugins:graph==='compiled-dependencies'?[compiled]:[]});
  const inputs=Object.keys(built.metafile.inputs),src=inputs.filter(p=>p.startsWith('packages/barocss-physics/src/')),dist=inputs.filter(p=>p.startsWith('packages/barocss-physics/dist/'));
  assert.ok(graph==='compiled-dependencies'?src.length===0&&dist.length>0:src.length>0&&dist.length===0);
  assert.ok(inputs.includes('examples/physics-rigid-feature-penetration-diagnostic/entry.ts'));assert.ok(inputs.includes('examples/physics-rigid-feature-geometry/sat-feature.ts'));
  assert.ok(!inputs.some(p=>/(\/world\.|reference-world|global-island|position-relaxation|linear-solver|candidate-world)/.test(p)),'read-only detector graph must not import a world or solver');
  const audit={graph,originalSourceCount:src.length,originalDistCount:dist.length,privateAdapterSource:true,adoptedSelectorSource:true,worldCreated:false,worldStepped:false,jsSolvePositionCalled:false,inputs:await Promise.all(inputs.map(async path=>({path,sha256:digest(await readFile(resolve(root,path)))})))};
  await writeFile(resolve(out,graph+'-graph.json'),JSON.stringify({audit,metafile:built.metafile},null,2)+'\n');return {path,audit};
}
