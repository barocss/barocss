import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {here,root} from './bundle.mjs';
const out=resolve(process.argv[2]);await mkdir(out,{recursive:true});const rows=[];for(const name of ['cad','gpu','physics','viewer']){const args=['--filter','@barocss/'+name,'build:library'],start=performance.now(),r=spawnSync('pnpm',args,{cwd:root,encoding:'utf8'});await writeFile(resolve(out,name+'.log'),r.stdout+r.stderr);rows.push({command:['pnpm',...args],exit:r.status,elapsedSeconds:(performance.now()-start)/1000});if(r.status!==0)break;}await writeFile(resolve(out,'receipt.json'),JSON.stringify({node:process.version,rows,passed:rows.length===4&&rows.every(r=>r.exit===0)},null,2));if(rows.length!==4||rows.some(r=>r.exit!==0))process.exitCode=1;
