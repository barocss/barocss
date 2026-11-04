// Root-owned driver. Reuse the original finite checks against actual Native Physics.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const id=process.argv[2],root=resolve(import.meta.dirname,'../..');
assert.ok(/^[a-z0-9-]{1,64}$/.test(id??''));
const cli='/Users/user/.npm/_npx/31e32ef8478fbf80/node_modules/@playwright/cli/playwright-cli.js';
const original=join(root,'examples/physics-persistent-impact-2276/browser-checks.js');
const out=join(root,'output/playwright/persistent-impact',id),session='motion-native-'+id;
mkdirSync(resolve(out,'..'),{recursive:true});mkdirSync(out);
const sha=b=>createHash('sha256').update(b).digest('hex');
const inputs=Object.fromEntries([cli,original,import.meta.filename].map(p=>[p,sha(readFileSync(p))]));
writeFileSync(join(out,'inputs.json'),JSON.stringify({inputs,url:'http://127.0.0.1:53044',session,mobile:false},null,2)+'\n');
const commands=[],deadline=Date.now()+170000;
function run(label,args,cleanup=false){
 const r=spawnSync(process.execPath,[cli,'--session',session,...args],{cwd:root,encoding:'utf8',timeout:cleanup?5000:Math.max(1,deadline-Date.now()),maxBuffer:4*1024*1024});
 for(const field of ['stdout','stderr'])writeFileSync(join(out,label+'.'+field),r[field]??'');
 commands.push({label,args,exit:r.status,signal:r.signal,error:r.error?.message??null});
 assert.ok(r.status===0&&!r.error,label+' CLI command failed');return r.stdout;
}
let report=null,failure=null;
try{
 run('open',['open','http://127.0.0.1:53044/?proof='+id,'--browser=chrome','--headed']);
 run('fresh-snapshot',['snapshot']);
 const raw=run('checks',['run-code','--filename='+original]);
 const match=raw.match(/### Result\r?\n([\s\S]*?)(?=\r?\n### |$)/);assert.ok(match,'structured CLI result');
 report=JSON.parse(match[1].trim());assert.equal(report.status,'PASS_BROWSER_PERSISTENT_IMPACT');
 run('final-snapshot',['snapshot']);
}catch(error){failure={name:error.name,message:error.message};process.exitCode=1;}
finally{
 try{run('close',['close'],true);}catch(error){failure??={message:error.message};process.exitCode=1;}
 const integrity=Object.entries(inputs).every(([p,hash])=>sha(readFileSync(p))===hash);
 if(!integrity){failure??={message:'input source changed'};process.exitCode=1;}
 writeFileSync(join(out,'report.json'),JSON.stringify({status:failure?'CURRENT_NATIVE_MOTION_NOT_QUALIFIED':'CURRENT_NATIVE_MOTION_DESKTOP_CONFIRMED',firstFailure:failure,sourceIntegrity:integrity,commands,observed:report,mobile:false,publication:false},null,2)+'\n');
}
