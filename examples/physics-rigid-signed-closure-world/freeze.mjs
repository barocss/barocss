import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha} from './archive.mjs';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../..');
const tracked=execFileSync('git',['ls-files'],{cwd:root,encoding:'utf8'}).trim().split('\n');const prefixes=['packages/barocss-physics/','packages/barocss-cad/','examples/physics-rigid-'];const paths=tracked.filter(p=>prefixes.some(x=>p.startsWith(x))&&!p.includes('/evidence/')&&!p.endsWith('/source-freeze.json')&&!p.endsWith('/base-tracked-ledger.json'));
const sources=[];for(const path of paths){const b=await readFile(root+'/'+path);sources.push({path,bytes:b.length,sha256:sha(b)});}sources.sort((a,b)=>a.path.localeCompare(b.path));await writeFile(here+'/source-freeze.json',JSON.stringify({issue:1384,base:'527a4407207e32a801365f1b59c071469948aa19',measuredHead:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),node:process.version,beforeFirstBuildAndTrial:true,newModelExecuted:false,sources},null,2)+'\n');
