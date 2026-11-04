// Root executes this runner after review. Authoring never executes a provider.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,realpathSync,openSync,readSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {dirname,resolve,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {campaign,compareWords} from './fixtures.mjs';

const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),pkg=resolve(root,'packages/barocss-physics');
const out=resolve(home,process.argv[2]??'evidence/run-01');
assert(!existsSync(out),'Use a NEW receipt directory; do not overwrite failures');mkdirSync(out,{recursive:true});
const node='/Users/user/.volta/tools/image/node/22.19.0/bin/node';
assert.equal(realpathSync(process.execPath),realpathSync(node),'Explicit Node22 required');
const require=createRequire(resolve(root,'package.json')),tsc=require.resolve('typescript/lib/tsc.js');
const hash=p=>{
 const digest=createHash('sha256'),buffer=Buffer.alloc(64*1024),fd=openSync(p,'r');
 try{let count;while((count=readSync(fd,buffer,0,buffer.length,null))!==0)digest.update(buffer.subarray(0,count));}
 finally{closeSync(fd);}
 return digest.digest('hex');
};
const put=(name,value)=>writeFileSync(resolve(out,name),JSON.stringify(value,null,2)+'\n');
const putWords=(name,value)=>writeFileSync(resolve(out,name),JSON.stringify(value,(_key,item)=>{
 if(typeof item!=='number')return item;
 const bytes=Buffer.alloc(8);bytes.writeDoubleBE(item);return {$f64be:bytes.toString('hex')};
},2)+'\n');
const deadline=Date.now()+170000;
let stage='inputs',frozenInputs;
const receipt={status:'RUNNING',node,stages:[],scope:'INTERNAL_CANONICAL_CONTRIBUTION_NOT_STATE2',numericalCallsBeforeRun:0};
function setStage(name){stage=name;receipt.currentStage=name;put('result.json',receipt);remaining();}
function remaining(){const ms=Math.floor(deadline-Date.now());assert.ok(ms>0,'Internal170s deadline exceeded');return ms;}
function frozenSnapshot(){
 const names=['run.mjs','fixtures.mjs','contribution.test.ts','world.test.ts','CONTRACT.md'];
 const sources=['contact-contribution.ts','collision.ts','persistent-box-contact.ts','world.ts'];
 return Object.fromEntries([...names.map(name=>resolve(home,name)),...sources.map(name=>resolve(pkg,'src',name))].map(path=>[path,hash(path)]));
}
function verifyFrozen(){
 const after=frozenSnapshot();put('frozen-inputs-after.json',after);
 for(const [path,expected]of Object.entries(frozenInputs))assert.equal(after[path],expected,'Frozen input changed '+path);
}
function generatedManifestSnapshot(){
 const path=resolve(pkg,'src/provider-manifest.generated.ts');return {path,sha256:existsSync(path)?hash(path):null};
}
const deadlineTimer=setTimeout(()=>{
 receipt.status='FIRST_FAILURE';receipt.firstFailure??={stage,message:'Internal170s deadline exceeded'};
 if(frozenInputs)try{verifyFrozen();}catch(error){receipt.frozenInputFailure=error.message;}
 put('generated-provider-manifest-after.json',generatedManifestSnapshot());
 put('result.json',receipt);process.exit(1);
},remaining());
function command(name,args,cwd=root){
 setStage(name);const timeout=remaining();const result=spawnSync(node,args,{cwd,encoding:'utf8',timeout,maxBuffer:16*1024*1024});
 writeFileSync(resolve(out,name+'.stdout'),result.stdout??'');writeFileSync(resolve(out,name+'.stderr'),result.stderr??'');
 receipt.stages.push({name,executable:node,args,cwd,timeoutMs:timeout,status:result.status,signal:result.signal,error:result.error?.message});
 put('result.json',receipt);assert.equal(result.status,0,name+' failed; preserve first failure');
}
try{
 frozenInputs=frozenSnapshot();put('frozen-inputs-before.json',frozenInputs);
 put('generated-provider-manifest-before.json',generatedManifestSnapshot());
 const esbuild=await import(pathToFileURL(require.resolve('esbuild')));
 const baseline=resolve(home,'baseline-205890b0e'),pins=JSON.parse(readFileSync(resolve(baseline,'PINS.json'),'utf8'));
 for(const [name,expected]of Object.entries(pins.files))assert.equal(hash(resolve(baseline,name)),expected,'Baseline '+name);
 const oldProviderText=readFileSync(resolve(baseline,'provider-manifest.generated.ts'),'utf8');
 const oldManifest=JSON.parse(oldProviderText.slice(oldProviderText.indexOf('= ')+2).replace(/ as const;\s*$/,''));
 // Baseline overlay replaces exactly the three numerical files and identity.
 // Every remaining original provider module must still be the exact old input.
 for(const [name,expected]of Object.entries(oldManifest.files))if(!Object.hasOwn(pins.files,name))assert.equal(hash(resolve(pkg,'src',name)),expected,'Unchanged baseline closure '+name);
 const sourceNames=['contact-contribution.ts','collision.ts','persistent-box-contact.ts','world.ts'];
 put('source-before.json',Object.fromEntries(sourceNames.map(name=>[name,hash(resolve(pkg,'src',name))])));
 put('tools.json',{node:{path:node,sha256:hash(node)},typescript:{path:tsc,sha256:hash(tsc)},esbuild:{path:require.resolve('esbuild'),sha256:hash(require.resolve('esbuild'))},baseline:pins});
 // Required canonical generation/build order, including emitted identity after bundling.
 command('generate-source',[resolve(pkg,'src/generate-provider.mjs')]);
 const common={target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',strict:true,declaration:true,skipLibCheck:true,noEmitOnError:true,types:['node'],typeRoots:[resolve(root,'node_modules/@types')]};
 const native=resolve(out,'native');
 mkdirSync(native,{recursive:true});writeFileSync(resolve(native,'package.json'),'{"type":"module"}\n');
 const config={compilerOptions:{...common,rootDir:root,outDir:native},files:[resolve(pkg,'src/index.ts'),resolve(pkg,'src/replay.ts'),resolve(home,'contribution.test.ts'),resolve(home,'world.test.ts')]};
 put('native.tsconfig.json',config);
 command('strict-native',[tsc,'-p',resolve(out,'native.tsconfig.json'),'--pretty','false','--listFiles']);
 setStage('source-build');
 const shared={bundle:true,format:'esm',platform:'node',target:'es2022',absWorkingDir:root,metafile:true};
 // One aggregate Source API guarantees shared types and recorder ownership.
 const aggregate=resolve(out,'source-entry.ts');
 writeFileSync(aggregate,`export * as api from ${JSON.stringify(resolve(pkg,'src/index.ts'))};\nexport * as replay from ${JSON.stringify(resolve(pkg,'src/replay.ts'))};\n`);
 const sourceBuild=await esbuild.build({...shared,entryPoints:[aggregate],outfile:resolve(out,'source.mjs')});put('source-metafile.json',sourceBuild.metafile);
 const baselineBuild=await esbuild.build({...shared,entryPoints:[aggregate],outfile:resolve(out,'baseline.mjs'),plugins:[{name:'exact-three-file-baseline',setup(api){
  api.onLoad({filter:/\.ts$/},args=>{
   const name=relative(resolve(pkg,'src'),args.path);
   if(!Object.hasOwn(pins.files,name))return;
   return {contents:readFileSync(resolve(baseline,name),'utf8'),loader:'ts',resolveDir:resolve(pkg,'src')};
  });
 }}]});put('baseline-metafile.json',baselineBuild.metafile);
 const testsEntry=resolve(out,'tests-entry.ts');writeFileSync(testsEntry,`import ${JSON.stringify(resolve(home,'contribution.test.ts'))};\nimport ${JSON.stringify(resolve(home,'world.test.ts'))};\n`);
 const testBuild=await esbuild.build({...shared,entryPoints:[testsEntry],outfile:resolve(out,'tests.mjs')});put('tests-metafile.json',testBuild.metafile);
 command('source-nine-tests',['--test',resolve(out,'tests.mjs')]);
 command('native-nine-tests',['--test',resolve(native,relative(root,resolve(home,'contribution.test.js'))),resolve(native,relative(root,resolve(home,'world.test.js')))]);
 receipt.equationDeltaMetrics={};
 for(const name of ['source-nine-tests','native-nine-tests']){
  const matches=readFileSync(resolve(out,name+'.stdout'),'utf8').match(/EQUATION_DELTA_METRICS (\{[^\n]+\})/g);
  assert.equal(matches?.length,1,'Exactly one bounded metric record '+name);
  const metrics=JSON.parse(matches[0].slice('EQUATION_DELTA_METRICS '.length));
  assert.equal(metrics.gate,1e-12);assert.equal(metrics.linearComponents,18);assert.equal(metrics.momentComponents,18);
  assert.ok(metrics.linearImpulseDeltaMaxNs<=metrics.gate&&metrics.worldOriginMomentDeltaMaxNms<=metrics.gate);
  receipt.equationDeltaMetrics[name]=metrics;
 }
 put('equation-delta-metrics.json',receipt.equationDeltaMetrics);
 command('canonical-tsc',[tsc,'-p',resolve(pkg,'tsconfig.json'),'--pretty','false']);
 command('canonical-root-build',[resolve(pkg,'build-root.mjs')]);
 command('generate-emitted',[resolve(pkg,'src/generate-provider.mjs'),'--emitted']);
 const consumer=resolve(out,'consumer.mts');
 writeFileSync(consumer,`import {createPhysicsWorld} from ${JSON.stringify(resolve(pkg,'dist/index.js'))};\nimport {createPhysicsRecorder} from ${JSON.stringify(resolve(pkg,'dist/replay.js'))};\n// @ts-expect-error Internal contribution is not a public export.\nimport {ContactPairAccumulator} from ${JSON.stringify(resolve(pkg,'dist/index.js'))};\nconst a: typeof createPhysicsWorld=createPhysicsWorld; const b: typeof createPhysicsRecorder=createPhysicsRecorder; void a; void b;\n`);
 put('consumer.tsconfig.json',{compilerOptions:{...common,noEmit:true},files:[consumer]});
 command('canonical-declaration-consumer',[tsc,'-p',resolve(out,'consumer.tsconfig.json'),'--pretty','false']);
 setStage('actual-module-imports');
 const baselineApi=await import(pathToFileURL(resolve(out,'baseline.mjs'))),sourceApi=await import(pathToFileURL(resolve(out,'source.mjs')));
 const nativePkg=resolve(native,relative(root,pkg),'src');
 const nativeApi={api:await import(pathToFileURL(resolve(nativePkg,'index.js'))),replay:await import(pathToFileURL(resolve(nativePkg,'replay.js')))};
 const canonicalApi={api:await import(pathToFileURL(resolve(pkg,'dist/index.js'))),replay:await import(pathToFileURL(resolve(pkg,'dist/replay.js')))};
 setStage('bounded-word-campaigns');
 const outputs={};for(const [name,modules]of Object.entries({baseline:baselineApi,source:sourceApi,native:nativeApi,canonical:canonicalApi})){
  setStage('bounded-word-campaign-'+name);
  outputs[name]=campaign(modules.api,modules.replay);putWords(name+'-campaign-words.json',outputs[name]);
 }
 // Per fixture: initial + serialize hidden + deserialize hidden + live restore
 // =4 Worlds. Accepted steps:3 initial +3 serialize +3 deserialize +3 restore
 // +1 original continuation +1 restored continuation =14. Per cohort:12/42.
 receipt.campaignCensus={status:'sourceDerivedPlannedNotObserved',perCohort:{fixtures:3,worlds:12,acceptedSteps:42},cohorts:4,
  derivation:'Source-derived planned counts from replay factory/loops; World creations and accepted steps are not instrumented or observed' };
 const parity={source:compareWords(outputs.baseline,outputs.source),native:compareWords(outputs.source,outputs.native),canonical:compareWords(outputs.source,outputs.canonical)};
 put('word-parity.json',parity);
 for(const [name,expected]of Object.entries(JSON.parse(readFileSync(resolve(out,'source-before.json'),'utf8'))))assert.equal(hash(resolve(pkg,'src',name)),expected,'Runtime source changed '+name);
 verifyFrozen();remaining();put('generated-provider-manifest-after.json',generatedManifestSnapshot());
 receipt.status='PASS_BOUNDED_CANONICAL_CONTRIBUTION';receipt.parity=parity;
 receipt.proofBoundary='Source and genuine emitted module tests; canonical bundled root API/record/restore trajectory cohort. No bundled-root prototype injection claim. No geometry/STATE2/P4/performance/browser promotion.';
 put('result.json',receipt);
}catch(error){
 receipt.status='FIRST_FAILURE';receipt.firstFailure??={stage,message:error.message,stack:error.stack};
 if(frozenInputs)try{verifyFrozen();}catch(integrityError){receipt.frozenInputFailure=integrityError.message;}
 put('generated-provider-manifest-after.json',generatedManifestSnapshot());
 put('result.json',receipt);throw error;
}finally{clearTimeout(deadlineTimer);}

