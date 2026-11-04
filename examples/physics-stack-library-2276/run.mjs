// Root alone executes. Outer group180s; one inner170s budget includes builds.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync,openSync,readSync,closeSync,copyFileSync,realpathSync,statSync} from 'node:fs';
import {dirname,resolve,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..');
const inner=process.argv[2]==='--inner',runId=process.argv[inner?3:2];
assert.match(runId??'',/^[a-z0-9][a-z0-9-]{0,63}$/);
const out=resolve(home,'evidence',runId),node='/Users/user/.volta/tools/image/node/22.19.0/bin/node';
assert.equal(realpathSync(process.execPath),realpathSync(node),'explicit Node22.19 required');
const hash=path=>{
 const fd=openSync(path,'r'),buffer=Buffer.alloc(64*1024),h=createHash('sha256');
 try{let n;while((n=readSync(fd,buffer,0,buffer.length,null)))h.update(buffer.subarray(0,n));}finally{closeSync(fd);}return h.digest('hex');
};
const put=(name,value)=>writeFileSync(join(out,name),JSON.stringify(value,null,2)+'\n');
if(!inner){
 assert.ok(!existsSync(out),'new output ID required');mkdirSync(out,{recursive:true});
 const child=spawn(node,[fileURLToPath(import.meta.url),'--inner',runId],{cwd:root,detached:true,stdio:['ignore','pipe','pipe']});
 const logs={stdout:[],stderr:[]};let bytes=0,reason=null;
 const kill=signal=>{try{process.kill(-child.pid,signal);}catch(error){if(error.code!=='ESRCH')throw error;}};
 const stop=why=>{reason??=why;kill('SIGTERM');setTimeout(()=>kill('SIGKILL'),500);};
 const timer=setTimeout(()=>stop('OUTER180S_DEADLINE'),180000);
 for(const kind of ['stdout','stderr'])child[kind].on('data',b=>{bytes+=b.length;if(bytes<=2*1024*1024)logs[kind].push(b);else stop('OUTER_OUTPUT_BOUND');});
 const result=await new Promise(resolve=>{child.on('error',error=>resolve({error:error.message}));child.on('close',(exit,signal)=>resolve({exit,signal}));});
 clearTimeout(timer);kill('SIGKILL');
 for(const kind of ['stdout','stderr'])writeFileSync(join(out,'outer-'+kind+'.raw'),Buffer.concat(logs[kind]));
 put('outer-result.json',{...result,reason,executable:node,timeoutMs:180000,publicActivation:false,full1200:'NOT_RUN'});
 process.exitCode=result.exit===0&&!reason?0:1;
}else{
 const deadline=Date.now()+170000,require=createRequire(join(root,'package.json')),python=realpathSync('/opt/homebrew/bin/python3.13');
 const tsc=require.resolve('typescript/lib/tsc.js'),tscCore=resolve(dirname(tsc),'_tsc.js'),esbuild=require.resolve('esbuild'),esbuildNative=createRequire(esbuild).resolve('@esbuild/'+process.platform+'-'+process.arch+'/bin/esbuild');
 const receipt={status:'RUNNING',currentStage:'freeze',commands:[],firstFailure:null,full1200:'BLOCKED_NOT_RUN',publicWorld:'NOT_RUN',resourceQualification:'NOT_QUALIFIED',resourceBoundary:'Physics-only prefix. Wire/output bounds do not prove combined64MiB live ownership or complete-path cost.'};
 let frozen;
 const remaining=()=>{const n=Math.floor(deadline-Date.now());assert.ok(n>0,'internal170s deadline');return n;};
 const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);
 const verify=()=>{if(!frozen)return;const after=Object.fromEntries(Object.keys(frozen).map(p=>[p,hash(p)]));put('frozen-after.json',after);assert.deepEqual(after,frozen,'input bytes changed');};
 const timer=setTimeout(()=>{
  receipt.status='FIRST_FAILURE';receipt.firstFailure??={stage:receipt.currentStage,message:'internal170s deadline'};
  try{verify();}catch(error){receipt.integrityFailure=error.message;}
  put('result.json',receipt);process.exit(1);
 },remaining());
 async function command(stage,args){
  receipt.currentStage=stage;put('progress.json',receipt);const timeoutMs=remaining();
  const result=await new Promise((resolveResult,reject)=>{
   const child=spawn(node,args,{cwd:root,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_DISABLE_COMPILE_CACHE:'1'}}),stdout=[],stderr=[];let n=0,error=null;
   const timer=setTimeout(()=>{error='remaining deadline';child.kill('SIGKILL');},timeoutMs);
   for(const [kind,list]of [['stdout',stdout],['stderr',stderr]])child[kind].on('data',b=>{n+=b.length;if(n<=2*1024*1024)list.push(b);else{error='combined2MiB command output';child.kill('SIGKILL');}});
   child.on('error',e=>{error??=e.message;clearTimeout(timer);});child.on('close',(exit,signal)=>{clearTimeout(timer);writeFileSync(join(out,stage+'.stdout'),Buffer.concat(stdout));writeFileSync(join(out,stage+'.stderr'),Buffer.concat(stderr));resolveResult({exit,signal,error});});
  });
  receipt.commands.push({stage,executable:node,args,timeoutMs,...result});put('progress.json',receipt);
  assert.equal(result.error,null,stage);assert.equal(result.exit,0,stage+' first failure');assert.equal(result.signal,null,stage);
 }
 try{
  const pins=JSON.parse(readFileSync(join(home,'PINS.json'),'utf8'));
  for(const [name,pin]of Object.entries(pins.files)){assert.equal(statSync(resolve(root,name)).size,pin.bytes,'immutable size '+name);assert.equal(hash(resolve(root,name)),pin.sha256,'immutable authority '+name);}
  const owned=files(home).filter(p=>!p.includes('/evidence/'));
  const inputs=[...owned,...files(resolve(root,'packages/barocss-physics/src')),...Object.keys(pins.files).map(p=>resolve(root,p)),resolve(root,'package.json'),resolve(root,'packages/barocss-physics/package.json'),node,python,tsc,tscCore,esbuild,esbuildNative];
  frozen=Object.fromEntries([...new Set(inputs)].map(p=>[p,hash(p)]));put('frozen-before.json',frozen);
  put('tools.json',{node:{path:node,sha256:hash(node)},python:{path:python,sha256:hash(python)},typescript:{path:tsc,sha256:hash(tsc),implementation:tscCore,implementationSha256:hash(tscCore)},esbuild:{path:esbuild,sha256:hash(esbuild),binary:esbuildNative,binarySha256:hash(esbuildNative)},scope:'MJS internals are authenticated JS source; strict tsc validates their explicit declaration boundary only'});
  // Reserve32MiB INSIDE the shared280MiB cap for build artifacts, receipts and
  // bounded command logs. Main request/reply/archive writes consume the rest.
  const budgetPath=join(out,'budget.json');writeFileSync(budgetPath,JSON.stringify({bytes:32*1024*1024,cap:280*1024*1024,reserveBytes:32*1024*1024})+'\n');
  const native=join(out,'native-modules');mkdirSync(native);
  // Preserve the package boundaries used by NodeNext while emitting: the
  // independent example verifier is CJS; the library is ESM.
  for(const name of ['package.json','packages/barocss-physics/package.json']){
   const source=resolve(root,name),target=join(native,name);
   mkdirSync(dirname(target),{recursive:true});copyFileSync(source,target);assert.equal(hash(source),hash(target));
  }
  const config={compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',strict:true,skipLibCheck:true,noEmitOnError:true,declaration:true,rootDir:root,outDir:native,types:['node'],typeRoots:[resolve(root,'node_modules/@types')]},files:[join(home,'campaign.mts')]};
  put('native.tsconfig.json',config);
  await command('io-controls',['--test',join(home,'io.test.mjs')]);
  await command('strict-native',[tsc,'-p',join(out,'native.tsconfig.json'),'--pretty','false','--listFiles']);
  const nativeStack=join(native,'packages/barocss-physics/src/stack'),copies=[];
  for(const name of ['full-pair-input.mjs','full-pair-linear.mjs','full-pair-exact.mjs','full-pair-core.mjs','full-pair-solver.mjs','full-pair-solver.d.mts']){
   const source=resolve(root,'packages/barocss-physics/src/stack',name),target=join(nativeStack,name);
   copyFileSync(source,target);assert.equal(hash(source),hash(target));copies.push({name,sourceSha256:hash(source),emittedSha256:hash(target),method:'EXACT_COPY_NOT_TSC_INTERNAL_TYPECHECK'});
  }
  // Harness-only IO and original test fixture are copied unchanged. They contain
  // no candidate formula. All TS runtime dependencies are genuine tsc output.
  for(const source of [join(home,'io.mjs'),resolve(root,'examples/physics-rigid-contact-reference/fixtures.mjs')]){
   const target=join(native,relative(root,source));mkdirSync(dirname(target),{recursive:true});copyFileSync(source,target);assert.equal(hash(source),hash(target));
  }
  put('native-copy-provenance.json',copies);
  await command('bundle-source',[join(home,'bundle.mjs'),root,join(home,'campaign.mts'),out]);
  const graph=JSON.parse(readFileSync(join(out,'source-metafile.json'),'utf8'));
  for(const p of Object.keys(graph.inputs)){
   assert.ok(Object.hasOwn(frozen,resolve(root,p)),'unfrozen source input '+p);
   if(p.startsWith('examples/'))assert.ok(resolve(root,p).startsWith(home+'/')||p==='examples/physics-stack-solver-2276/verification.ts'||p==='examples/physics-rigid-contact-reference/fixtures.mjs','example runtime leaked into candidate '+p);
  }
  const saved=resolve(root,'examples/physics-stack-solver-2276/evidence/fixture-01/fixture.json'),results=[];
  assert.ok(files(out).reduce((n,p)=>n+statSync(p).size,0)<24*1024*1024,'build artifacts leave8MiB receipt reserve');
  for(const [name,entry]of [['source',join(out,'source.mjs')],['native',join(native,relative(root,join(home,'campaign.mjs')))]]){
   const directory=join(out,name);mkdirSync(directory);
   await command(name+'-campaign',[entry,directory,root,String(deadline),budgetPath,saved,python]);
   const result=JSON.parse(readFileSync(join(directory,'result.json'),'utf8'));assert.equal(result.status,'PASS_INTERNAL_PHASE_FIRST32_ONE_STEP_AND_FRESH16');results.push(result);
  }
  // Process paths, PID and cleanup are sidecars. Compare actual physical words
  // via decoded/raw hashes and exact original reply bytes from both graphs.
  assert.deepEqual(results[0].reports,results[1].reports,'Source/genuine Native physical evidence parity');
  assert.equal(hash(join(out,'source/first32.json')),hash(join(out,'native/first32.json')),'first32 exact parity');
  for(const name of ['controls.json','first-step-repeat.json'])assert.equal(hash(join(out,'source',name)),hash(join(out,'native',name)),name+' parity');
  const left=files(join(out,'source')).filter(p=>/-(request|reply)\.json$/.test(p));
  for(const p of left)assert.equal(hash(p),hash(join(out,'native',relative(join(out,'source'),p))),'audit request/reply parity');
  assert.ok(files(out).reduce((n,p)=>n+statSync(p).size,0)<=280*1024*1024,'actual whole campaign byte cap');
  verify();remaining();receipt.status='PASS_BOUNDED_CURRENT_PACKAGE_INTERNAL_STACK_PHASE';receipt.parity=true;
 }catch(error){receipt.status='FIRST_FAILURE';receipt.firstFailure??={stage:receipt.currentStage,message:error.message,stack:error.stack};try{verify();}catch(e){receipt.integrityFailure=e.message;}process.exitCode=1;}
 finally{clearTimeout(timer);put('result.json',receipt);}
}
