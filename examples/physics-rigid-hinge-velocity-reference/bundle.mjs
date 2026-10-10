import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {digest} from './archive.mjs';
export const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..');
export const GRAPHS=['source','source-repeat','compiled-dependencies'];
export async function validateSource(expected){const pins=expected??JSON.parse(await readFile(resolve(here,'frozen-source.json')));for(const [path,hash]of Object.entries(pins))assert.equal(digest(await readFile(resolve(here,path))),hash,`source drift: ${path}`);return pins;}
export async function verifyEmitted(out){const bytes=await readFile(resolve(out,'emitted-pre-consumer.json')),ledger=JSON.parse(bytes);assert.equal(ledger.node,'v22.22.0');assert.equal(ledger.preConsumer,true);assert.equal(ledger.buildExit,0);assert.equal(ledger.strictTypesExit,0);assert.equal(ledger.measuredSource,execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim());assert.ok(Array.isArray(ledger.emitted)&&ledger.emitted.length>0);assert.equal(new Set(ledger.emitted.map(row=>row.path)).size,ledger.emitted.length);for(const row of ledger.emitted){assert.ok(typeof row.path==='string'&&!row.path.startsWith('/')&&!row.path.split('/').includes('..'));const artifact=await readFile(resolve(root,row.path));assert.equal(artifact.length,row.bytes,row.path);assert.equal(digest(artifact),row.sha256,row.path);}assert.ok(ledger.emitted.some(row=>row.path.startsWith('packages/barocss-cad/dist/')));assert.ok(ledger.emitted.some(row=>row.path.startsWith('packages/barocss-physics/dist/')));return {sha256:digest(bytes),ledger};}
export async function bundle(graph,out){await validateSource();assert.ok(GRAPHS.includes(graph));await mkdir(out,{recursive:true});
 const compiled={name:'genuine-original-helpers',setup(b){b.onResolve({filter:/packages\/barocss-physics\/src\//},args=>({path:resolve(args.resolveDir,args.path.replace('/src/','/dist/'))}));}};
 const path=resolve(out,`${graph}.mjs`),built=await build({absWorkingDir:root,entryPoints:[resolve(here,'entry.ts')],outfile:path,bundle:true,format:'esm',platform:'node',target:'node22',metafile:true,plugins:graph==='compiled-dependencies'?[compiled]:[]});
 const inputs=Object.keys(built.metafile.inputs),src=inputs.filter(p=>p.startsWith('packages/barocss-physics/src/')),dist=inputs.filter(p=>p.startsWith('packages/barocss-physics/dist/'));assert.ok(graph==='compiled-dependencies'?src.length===0&&dist.length>0:src.length>0&&dist.length===0);
 assert.ok(inputs.includes('examples/physics-rigid-coupled-hinge-reference/candidate.ts'));assert.ok(inputs.includes('examples/physics-rigid-hinge-limit-diagnostic/adapter.ts'));
 assert.ok(!inputs.some(p=>p.includes('/world.')||p.includes('reference-world')||p.includes('joint-motor')||p.includes('global-island')||p.includes('position-relaxation')),'no World/motor/island module');
 const code=await readFile(path,'utf8');assert.ok(!/function projectOnce\(|function projectDynamicHingeJoint\(/.test(code),'old dynamic projection absent');
 const audit={graph,sourcePath:path,bundleBytes:Buffer.byteLength(code),bundleSha256:digest(Buffer.from(code)),originalSourceCount:src.length,originalDistCount:dist.length,worldCreated:false,worldStepped:false,motorDriven:false,oldProjectionCalled:false,adoptedPoseLawPresent:true,inputs:await Promise.all(inputs.map(async path=>({path,sha256:digest(await readFile(resolve(root,path)))})))};await writeFile(resolve(out,`${graph}-graph.json`),JSON.stringify(audit,null,2)+'\n');return {path,audit};}
