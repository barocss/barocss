import {readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..'),pins={};
async function collect(path,own=false){for(const entry of (await readdir(path,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const full=resolve(path,entry.name);if(own&&(entry.name==='evidence'||entry.name==='frozen-source.json'))continue;if(entry.isDirectory())await collect(full,own);else if(entry.isFile())pins[relative(here,full)]=createHash('sha256').update(await readFile(full)).digest('hex');}}
await collect(here,true);
for(const folder of [resolve(root,'packages/barocss-physics/src'),resolve(root,'packages/barocss-cad/src'),resolve(root,'examples/physics-rigid-coupled-hinge-reference'),resolve(root,'examples/physics-rigid-hinge-limit-diagnostic'),resolve(root,'examples/physics-rigid-contact-diagnostic'),resolve('/Users/user/.codex/worktrees/physics-multi-hinge/barocss/examples/physics-rigid-multi-hinge-reference')])await collect(folder);
for(const file of ['package.json','pnpm-lock.yaml','packages/barocss-physics/package.json','packages/barocss-cad/package.json','examples/physics-rigid-engine-reference/build-local.mjs','packages/barocss-physics/tsconfig.json','packages/barocss-cad/tsconfig.json','pnpm-workspace.yaml']){const full=resolve(root,file);pins[relative(here,full)]=createHash('sha256').update(await readFile(full)).digest('hex');}
const output=resolve(process.argv[2]??resolve(here,'frozen-source.json'));await writeFile(output,JSON.stringify(Object.fromEntries(Object.entries(pins).sort(([a],[b])=>a.localeCompare(b))),null,2)+'\n');console.log(JSON.stringify({output,count:Object.keys(pins).length,candidateCalled:false,solverCalled:false,oracleCalled:false}));
