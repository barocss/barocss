import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { authenticateValidation, publicMaps, bundleStatic, strictConsumers, generatedPrograms, sha } from './validation-provider.mjs';
const HERE=dirname(fileURLToPath(import.meta.url)),ROOT=resolve(HERE,'../..');
const json=x=>JSON.stringify(x,null,2)+'\n';
async function command(executable,args,out,env=process.env){
  const cp=spawn(executable,args,{cwd:ROOT,env,stdio:['ignore','pipe','pipe']});let data=Buffer.alloc(0),overflow=false;
  for(const stream of [cp.stdout,cp.stderr])stream.on('data',b=>{const kept=b.subarray(0,Math.max(0,1048576-data.length));data=Buffer.concat([data,kept]);if(kept.length<b.length){overflow=true;cp.kill('SIGTERM');}});
  const result=await new Promise((yes,no)=>{cp.once('error',no);cp.once('close',(code,signal)=>yes({code,signal}));});
  await writeFile(out,data,{flag:'wx'});return {...result,overflow,bytes:data.length,sha256:sha(data)};
}
function docsObserver(path,text){
  let s=text;const once=(pattern,replacement)=>{assert.equal([...s.matchAll(new RegExp(pattern.source,'gm'))].length,1,path);s=s.replace(pattern,replacement);};
  if(path.endsWith('/src/world.ts')){
    once(/^export function createPhysicsWorld\([^\{]+\{/m,m=>m+"\nglobalThis.__p5Docs.hit('factoryAttempts');\n");
    once(/^\s*step\(commands = \[\]\) \{/m,m=>m+"\nglobalThis.__p5Docs.hit('stepEntries');\n");
    assert.equal(s.split('stepIndex++;').length,3);s=s.replaceAll('stepIndex++;',"stepIndex++; globalThis.__p5Docs.accepted();");
    once(/return world;/,m=>"globalThis.__p5Docs.hit('WorldReturns');\n"+m);
    once(/dispose\(\) \{ disposed = true;/,m=>"dispose() { globalThis.__p5Docs.hit('WorldDisposals'); disposed = true;");
  }
  if(path.endsWith('/src/replay.ts')){
    once(/(export function createPhysicsRecorder\([^\{]+\{)\s*return ([^;]+);\s*\}/m,(_all,head,expression)=>head+`\nglobalThis.__p5Docs.hit('recorderAttachAttempts');\ntry { const recorder=${expression}; globalThis.__p5Docs.hit('recorderAttachReturns'); return recorder; }\ncatch(error){ globalThis.__p5Docs.refused(error); throw error; }\n}`);
  }
  return s;
}
function docsBanner(){return `import {writeFileSync as __p5DocWrite} from 'node:fs';
const __p5DocCounts={factoryAttempts:0,WorldReturns:0,stepEntries:0,acceptedSteps:0,recorderAttachAttempts:0,recorderAttachReturns:0,failedRecorderAttaches:0,WorldDisposals:0};
const __p5DocErrors=[];
const __p5DocProgress=()=>__p5DocWrite(process.env.P5B_DOC_TRACE+'.progress.json',JSON.stringify({counts:__p5DocCounts,errors:__p5DocErrors}));
globalThis.__p5Docs={hit(name){__p5DocCounts[name]++;__p5DocProgress();},accepted(){__p5DocCounts.acceptedSteps++;},refused(error){__p5DocCounts.failedRecorderAttaches++;__p5DocErrors.push({name:error.name,code:error.code,details:error.details});__p5DocProgress();}};
process.once('exit',code=>{const expected={factoryAttempts:1,WorldReturns:1,stepEntries:1,acceptedSteps:1,recorderAttachAttempts:1,recorderAttachReturns:0,failedRecorderAttaches:1,WorldDisposals:1};
const wanted=process.env.P5B_DOC_PROFILE.startsWith('cloth')?'WORLD_LIMIT':'INVALID_SNAPSHOT';
const pass=code===0&&Object.entries(expected).every(([k,v])=>__p5DocCounts[k]===v)&&__p5DocErrors.length===1&&__p5DocErrors[0].code===wanted&&__p5DocErrors[0].details.accepted.stepIndex===0;
__p5DocWrite(process.env.P5B_DOC_TRACE,JSON.stringify({status:pass?'PASS_SELECTED_DOC_TEST':'FAIL',profile:process.env.P5B_DOC_PROFILE,counts:__p5DocCounts,errors:__p5DocErrors}),{flag:'wx'});if(!pass)process.exitCode=1;});`;}
async function main(){
  const [phase,out,freezePath,freezeSha,token]=process.argv.slice(2);assert.equal(token,'--authorized-validation-child');assert(['static','docs'].includes(phase));
  let bytes=0,firstFailure=null;const completed=[],counts={WorldCalls:0,factoryAttempts:0,WorldReturns:0,stepEntries:0,acceptedSteps:0,recorderAttachAttempts:0,failedRecorderAttaches:0,WorldDisposals:0};
  const progress=()=>writeFileSync(resolve(out,'progress.json'),json({phase,completed,counts}));
  const write=async(name,value)=>{const b=typeof value==='string'||Buffer.isBuffer(value)||value instanceof Uint8Array?value:json(value);bytes+=Buffer.byteLength(b);assert(bytes<=40*1024*1024,'normal evidence output bound');await writeFile(resolve(out,name),b,{flag:'wx'});};
  try{
    const freeze=await authenticateValidation(ROOT,resolve(freezePath),freezeSha),pins={...freeze.files};
    const recipe=JSON.parse(await readFile(resolve(HERE,'VALIDATION-RECIPES.json'),'utf8'));
    for(const name of ['source','native']){const p=`examples/physics-world-p5-2276/evidence/public-${name}-01/summary.json`;assert(pins[p]);const d=JSON.parse(await readFile(resolve(ROOT,p),'utf8'));assert.equal(d.status,'PASS_PUBLIC_P5B_BOUNDED_QUALIFICATION');}
    const manifest=JSON.parse(await readFile(resolve(ROOT,'packages/barocss-physics/package.json'),'utf8'));assert.deepEqual(Object.keys(manifest.exports).sort(),recipe.packageMaps.slice().sort());assert.deepEqual(Object.keys(manifest.publishConfig.exports).sort(),recipe.packageMaps.slice().sort());
    for(const [key,value]of Object.entries(manifest.publishConfig.exports))for(const field of ['import','types'])assert((await stat(resolve(ROOT,'packages/barocss-physics',value[field]))).isFile(),key+field);
    const retired=JSON.parse(await readFile(resolve(HERE,recipe.obsoleteFilesPlan),'utf8'));
    for(const item of retired.exactFiles){let exists=true;try{await stat(resolve(ROOT,item.path));}catch(e){if(e.code==='ENOENT')exists=false;else throw e;}assert(!exists,'obsolete runtime output still exists '+item.path);}
    await write('map-and-retirement.json',{status:'PASS',maps:recipe.packageMaps,obsoleteAbsent:retired.exactFiles.map(x=>x.path)});
    if(phase==='static'){
      for(const mode of ['source','native']){await strictConsumers({root:ROOT,out,mode,write});completed.push('strict-'+mode);progress();
        // Numerical root closure is checked independently of optional CAD adapter entries.
        const rootResult=await bundleStatic({root:ROOT,mode,contents:"export {createPhysicsWorld,PhysicsError} from '@barocss/physics';",platform:'node',pins,write,name:'numeric-root-'+mode});
        assert(Object.keys(rootResult.report.inputs).every(p=>!p.startsWith('packages/barocss-cad')&&!p.includes('cad-fluid-data')&&!p.includes('/cad-proxy')),'numeric root must be CAD-free');
        for(let i=0;i<recipe.static.entries.length;i++){
          const entry=recipe.static.entries[i];let path=resolve(ROOT,entry.path);
          if(entry.path==='examples/physics-scene/release-consumer.mjs'){
            const dir=resolve(out,'packed-consumer-'+mode);await mkdir(dir,{recursive:false});
            for(const [src,dest]of [[entry.path,'release-consumer.mjs'],['examples/physics-model-data-2276/model-data.mjs','physics-model-data.mjs']]){
              const b=await readFile(resolve(ROOT,src));await writeFile(resolve(dir,dest),b,{flag:'wx'});pins[relative(ROOT,resolve(dir,dest))]={bytes:b.length,sha256:sha(b)};
            }
            path=resolve(dir,'release-consumer.mjs');
          }
          await bundleStatic({root:ROOT,mode,entry:path,platform:entry.platform,pins,write,name:`bundle-${mode}-${String(i).padStart(2,'0')}`});
          completed.push(`${mode}:${entry.path}`);progress();
        }
      }
      const generated=await generatedPrograms(ROOT);let index=0;
      for(const program of generated)for(const mode of program.modes){await bundleStatic({root:ROOT,mode,contents:program.contents,platform:'node',pins,write,name:'generated-'+index++});completed.push(`${mode}:generated:${program.file}:${program.variable}`);progress();}
      await write('generated-consumers.json',generated.map(x=>({...x,contentsSha256:sha(x.contents)})));
      const lint=await command(process.execPath,[resolve(ROOT,'node_modules/eslint/bin/eslint.js'),...recipe.static.lintFiles],resolve(out,'lint.log'));
      await write('lint-result.json',lint);assert.equal(lint.code,0,'affected production lint failed');assert(!lint.overflow);
      completed.push('lint');progress();
    }else{
      const result=await bundleStatic({root:ROOT,mode:'source',entry:resolve(ROOT,recipe.docExample.entry),platform:'node',pins,write,name:'docs-source-graph',banner:docsBanner(),observe:docsObserver});
      assert(Object.keys(result.report.inputs).every(p=>!p.startsWith('packages/barocss-cad')&&!p.includes('cad-proxy')),'docs numerical graph must be CAD-free');
      await write('docs-source.mjs',result.code);
      // Separate single-test processes give a real first-failure stop; never run all175samples.
      for(const profile of ['cloth-pinned-sphere-visual-v1','fluid-basin-visual-v1','fluid-basin-xsph-visual-v1','fluid-static-box-visual-v1']){
        const trace=resolve(out,'docs-'+profile+'.json');const args=['--test','--test-concurrency=1','--test-name-pattern=^explicit model '+profile+':',resolve(out,'docs-source.mjs')];
        await write('command-'+profile+'.json',{command:[process.execPath,...args],selectedProfile:profile,otherCallbacksSkipped:3});
        const exit=await command(process.execPath,args,resolve(out,'test-'+profile+'.log'),{...process.env,P5B_DOC_TRACE:trace,P5B_DOC_PROFILE:profile});
        let observed=null;try{observed=JSON.parse(await readFile(trace,'utf8'));}catch{}
        if(observed)for(const key of Object.keys(counts))if(key!=='WorldCalls')counts[key]+=observed.counts[key]??0;
        counts.WorldCalls=counts.factoryAttempts+counts.stepEntries;progress();
        await write('exit-'+profile+'.json',{...exit,tracePresent:!!observed});
        assert.equal(exit.code,0,'selected doc test child failed');assert(!exit.overflow);assert.equal(observed?.status,'PASS_SELECTED_DOC_TEST');completed.push(profile);progress();
      }
      for(const key of ['factoryAttempts','WorldReturns','stepEntries','acceptedSteps','recorderAttachAttempts','failedRecorderAttaches','WorldDisposals'])assert.equal(counts[key],4,key);
    }
    await authenticateValidation(ROOT,resolve(freezePath),freezeSha);
  }catch(error){firstFailure={name:error?.name,message:error?.message,stack:error?.stack};}
  progress();await writeFile(resolve(out,'summary.json'),json({status:firstFailure?'FAIL':phase==='static'?'PASS_P5B_STATIC_VALIDATION':'PASS_P5B_SELECTED_DOC_EXAMPLES',phase,completed,counts,firstFailure,packageBuild:false,providerGeneration:false,moduleEvaluation:phase==='docs'?'exact four selected source doc tests only':false,browser:'NOT_RUN'}),{flag:'wx'});if(firstFailure)process.exitCode=1;
}
await main();
