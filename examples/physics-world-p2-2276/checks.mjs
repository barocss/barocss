// Bounded one-command receipt. Caller owns the repository heavy-lane gate.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname,resolve,join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)), root=resolve(here,'../..');
const [id,cwd,...args]=process.argv.slice(2);
if(!/^[a-z0-9-]+$/.test(id??'')||!cwd||!args.length)throw Error('checks.mjs fresh-id cwd node-args...');
const dir=join(here,'evidence',id);if(existsSync(dir))throw Error('receipt already exists');mkdirSync(dir,{recursive:true});
const start=new Date().toISOString(), r=spawnSync(process.execPath,args,{cwd:resolve(root,cwd),encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
writeFileSync(join(dir,'stdout.txt'),r.stdout??'');writeFileSync(join(dir,'stderr.txt'),r.stderr??'');
writeFileSync(join(dir,'result.json'),JSON.stringify({start,end:new Date().toISOString(),command:[process.execPath,...args],cwd:resolve(root,cwd),exit:r.status,signal:r.signal,error:r.error?.message??null},null,2)+'\n');
console.log(JSON.stringify({id,exit:r.status,signal:r.signal}));process.exitCode=r.status===0?0:1;
