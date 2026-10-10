import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
export const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..');
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function verifyFreeze() {
  const frozen=JSON.parse(await readFile(resolve(here,'source-freeze.json')));assert.equal(process.version,frozen.node);
  for(const row of frozen.sources)assert.equal(sha(await readFile(resolve(root,row.path))),row.sha256,row.path);
  return frozen;
}
export async function bundle(graph,out) {
  await verifyFreeze();assert.ok(['source','source-repeat','compiled-dependencies'].includes(graph));await mkdir(out,{recursive:true});
  const compiled={name:'genuine-original-emitted-helpers',setup(b){b.onResolve({filter:/^\.\.\/\.\.\/packages\/barocss-physics\/src\//},args=>({path:resolve(root,args.path.replace('../../packages/barocss-physics/src/','packages/barocss-physics/dist/'))}));}};
  const modulePath=resolve(out,graph+'.mjs'),built=await build({absWorkingDir:root,entryPoints:[resolve(here,'entry.mjs')],outfile:modulePath,bundle:true,write:true,format:'esm',platform:'node',target:'node22',metafile:true,plugins:graph==='compiled-dependencies'?[compiled]:[]});
  const inputs=Object.keys(built.metafile.inputs),src=inputs.filter(p=>p.startsWith('packages/barocss-physics/src/')),dist=inputs.filter(p=>p.startsWith('packages/barocss-physics/dist/'));
  assert.ok(graph==='compiled-dependencies'?src.length===0&&dist.length>0:src.length>0&&dist.length===0);
  for(const path of ['reference-world.ts','global-island.ts','coupled-phase.ts','rows.ts','linear-adapter.mjs'])assert.ok(inputs.includes('examples/physics-rigid-coupled-position-world/'+path),path);
  assert.ok(inputs.includes('examples/physics-rigid-coupled-position-reference/linear-solver.mjs'));
  assert.ok(inputs.includes('examples/physics-rigid-feature-contact-reference/warm-cache.ts'));assert.ok(inputs.includes('examples/physics-rigid-feature-contact-reference/geometry-adapter.ts'));
  assert.ok(!inputs.some(p=>p.endsWith('/position-relaxation.ts')),'legacy 32-sweep projection absent');
  const audit={graph,originalSourceCount:src.length,originalDistCount:dist.length,privateCandidateIsSource:true,adoptedLinearSolverIsSource:true,adoptedVelocityGeometryAndCacheSource:true,legacySequentialPositionAbsent:true,compiledPublicCandidate:false,inputs:await Promise.all(inputs.map(async path=>({path,sha256:sha(await readFile(resolve(root,path)))})))};
  await writeFile(resolve(out,graph+'-graph.json'),JSON.stringify({audit,metafile:built.metafile},null,2)+'\n');return {modulePath,audit};
}
