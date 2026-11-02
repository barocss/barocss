// Unchanged original support/sliding tests, rebuilt against the current source/native provider.
import {build} from 'esbuild';
import {readFileSync,writeFileSync,mkdirSync,realpathSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {ownedPackages} from '../physics-lab/owned-packages.mjs';
const root=process.cwd(),id=process.argv[2];assert(/^[a-z0-9-]+$/.test(id??''));
const out=resolve('examples/physics-tangent-response-2276/evidence',id);mkdirSync(out,{recursive:false});
const summary={status:'RUNNING',graphs:[],firstFailure:null};
try{for(const graph of ['source','native']){
 const outfile=resolve(out,graph+'.mjs'),entry=resolve('examples/physics-motion-foundations-2276/contact.test.ts');
 const meta=await build({entryPoints:[entry],outfile,bundle:true,platform:'node',format:'esm',target:'es2022',metafile:true,...(graph==='source'?{plugins:[ownedPackages(root)]}:{alias:{'@barocss/physics':resolve('packages/barocss-physics/dist/index.js')}})});
 const inputs={};for(const name of Object.keys(meta.metafile.inputs)){const path=realpathSync(resolve(name));assert(path.startsWith(root+'/'));if(graph==='native')assert(!path.startsWith(resolve('packages/barocss-physics/src')+'/'));const b=readFileSync(path);inputs[name]={bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};}
 writeFileSync(resolve(out,graph+'-inputs.json'),JSON.stringify(inputs,null,2)+'\n');
 const r=spawnSync(process.execPath,['--test',outfile],{encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
 writeFileSync(resolve(out,graph+'.stdout'),r.stdout??'');writeFileSync(resolve(out,graph+'.stderr'),r.stderr??'');summary.graphs.push({graph,status:r.status,error:r.error?.message??null,tests:2,definedAcceptedSteps:3240});assert.equal(r.status,0,r.stderr||r.stdout);
}summary.status='PASS_ORIGINAL_CONTACT_REGRESSION';}catch(e){summary.status='FAIL_ORIGINAL_CONTACT_REGRESSION';summary.firstFailure={message:e.message,stack:e.stack};process.exitCode=1;}
writeFileSync(resolve(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
