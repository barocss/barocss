/** AST/text only. Never imports a Physics provider, model, data helper, or caller. */
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {instrumentPublic} from './public-instrument.mjs';
const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(HERE,'../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const [id]=process.argv.slice(2);assert(/^PUBLIC-AUTHOR-CHECK-[0-9]{2}$/.test(id));
const report={status:'FAIL',id,scope:'syntax/AST/TEXT_ONLY',providerImports:0,WorldCalls:0,helperCalls:0,builds:0,files:{},overlays:{},firstFailure:null};
try{
 const ts=(await import(pathToFileURL(resolve(ROOT,'node_modules/typescript/lib/typescript.js')).href)).default;
 const source=resolve(ROOT,'packages/barocss-physics/src');
 async function all(dir){const a=[];for(const e of await readdir(dir,{withFileTypes:true})){assert(!e.isSymbolicLink());const p=resolve(dir,e.name);if(e.isDirectory())a.push(...await all(p));else if(e.isFile())a.push(p);}return a;}
 const authored=(await readdir(HERE)).filter(n=>n.startsWith('public-')&&n.endsWith('.mjs')).map(n=>resolve(HERE,n));
 for(const p of [...authored,...(await all(source)).filter(p=>p.endsWith('.ts'))]){
  const b=await readFile(p),sf=ts.createSourceFile(p,b.toString(),ts.ScriptTarget.Latest,true,p.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS);assert.equal(sf.parseDiagnostics.length,0,p+' original syntax');report.files[relative(ROOT,p)]={bytes:b.length,sha256:sha(b)};
  if(p.startsWith(source+'/')){const t=instrumentPublic(ts,p,b.toString());const modified=ts.createSourceFile(p,t.source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);assert.equal(modified.parseDiagnostics.length,0,p+' overlay syntax');if(Object.keys(t.sites).length)report.overlays[relative(ROOT,p)]={sites:t.sites,effectiveSha256:sha(t.source)};}
 }
 const site=(p,k)=>report.overlays['packages/barocss-physics/src/'+p].sites[k];
 for(const[k,n]of Object.entries({factory:1,'return-world':1,step:1,commit:2,dispose:1}))assert.equal(site('world.ts',k),n,'source world '+k);
 for(const file of ['domain/cloth.ts','domain/fluid.ts'])for(const k of ['numeric','diagnostic'])assert.equal(site(file,k),1,file+' '+k);
 assert.equal(site('replay.ts','log-prepare'),1);assert.equal(site('cloth/solver.ts','mid-kernel'),1);assert.equal(site('fluid/pbf.ts','mid-kernel'),1);
 const recipe=JSON.parse(await readFile(resolve(HERE,'P5B-CONTROL-RECIPES.json'),'utf8'));assert.equal(recipe.negativeModels.length,64);assert.equal(recipe.commands.length,8);assert.equal(recipe.queryArguments.length,2);
 const plan=JSON.parse(await readFile(resolve(HERE,'P5B-PLAN.json'),'utf8'));const sum={worlds:0,creationRefusals:0,stepEntries:0,accepted:0,syntheticFailures:0,refusedSteps:0};for(const c of plan.cohortsPerGraph)for(const k of Object.keys(sum))sum[k]+=c[k];for(const[k,n]of Object.entries(sum))assert.equal(n,plan.perGraphTotals[k],k);report.symbolicTotals={...sum,factoryAttempts:sum.worlds+sum.creationRefusals};
 report.status='PASS_AST_TEXT_ONLY_NOT_RUNTIME';
}catch(e){report.firstFailure={name:e.name,message:e.message,stack:e.stack};process.exitCode=1;}
await writeFile(resolve(HERE,id+'.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({status:report.status,id,files:Object.keys(report.files).length,overlays:Object.keys(report.overlays).length,firstFailure:report.firstFailure})+'\n');
