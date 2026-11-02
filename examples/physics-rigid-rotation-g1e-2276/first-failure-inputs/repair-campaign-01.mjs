/** G1e repaired micro only. Parent-frozen copied provider; no module evaluation before authentication. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile, mkdir, stat, realpath, readdir, copyFile } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SELF=fileURLToPath(import.meta.url), HERE=dirname(SELF), ROOT=resolve(HERE,'../..'), MIB=1048576;
const OLD=resolve(ROOT,'examples/physics-rigid-rotation-g1b-2276/evidence');
const MICRO=resolve(OLD,'g1b-micro-02'), PACKAGE=resolve(MICRO,'build/package');
const META=resolve(MICRO,'staged-providers.json'), BASE=resolve(OLD,'g1b-native-completion-02/input-1.json');
const REFERENCE=resolve(HERE,'reference-force.py');
const TOOLCHAIN=resolve(ROOT,'examples/physics-rigid-rotation-g1-2276/TOOLCHAIN-PINS-02.json');
const CANDIDATE=resolve(HERE,'rigid-forced-rotation.ts');
const REQUIRED=[SELF,CANDIDATE,REFERENCE,resolve(HERE,'CONTRACT.md'),resolve(HERE,'FORCE-DESIGN.md'),META,BASE,TOOLCHAIN,
  resolve(HERE,'force-campaign.mjs'),resolve(MICRO,'summary.json'),resolve(ROOT,'examples/physics-rigid-rotation-g1b-2276/reference-micro.py'),
  resolve(ROOT,'examples/physics-rigid-rotation-g1c-2276/reference-frame.py'),resolve(ROOT,'examples/physics-rigid-rotation-g1-2276/baseline-classify.py'),
  ...['CONTRACT.md','CASES.json','REFERENCES-CLARIFICATION-01.md'].map(n=>resolve(ROOT,'examples/physics-rigid-rotation-g1b-2276',n))];
const J=[1/1024,-1/2048,1/4096], TAU=[1/128,-1/256,1/512];
const hash=x=>createHash('sha256').update(x).digest('hex'), json=x=>JSON.stringify(x)+'\n';
const inside=(base,path)=>path===base||path.startsWith(base+'/');
async function bounded(path,limit=65536){const s=await stat(path);assert(s.isFile()&&s.size<=limit,'file bound '+path);return readFile(path);}
async function pin(path){const s=await stat(path);assert(s.isFile());const h=createHash('sha256');for await(const b of createReadStream(path,{highWaterMark:65536}))h.update(b);return{bytes:s.size,sha256:h.digest('hex')};}
async function auth(path,wanted){assert(wanted&&Number.isSafeInteger(wanted.bytes)&&wanted.bytes>=0&&/^[a-f0-9]{64}$/.test(wanted.sha256));assert.equal(await realpath(path),path);assert.deepEqual(await pin(path),{bytes:wanted.bytes,sha256:wanted.sha256},path);}
function raw(v,ctx={nodes:0},depth=0){
  assert(++ctx.nodes<=16384&&depth<=32,'raw object bound');
  if(typeof v==='number'){assert(Number.isFinite(v));const b=Buffer.alloc(8);b.writeDoubleLE(v);return{$f64le:b.toString('hex')};}
  if(v===null||typeof v==='string'||typeof v==='boolean')return v;
  assert(v&&typeof v==='object');const array=Array.isArray(v);assert.equal(Object.getPrototypeOf(v),array?Array.prototype:Object.prototype);
  const keys=Reflect.ownKeys(v);if(array){assert.equal(keys.length,v.length+1);for(let i=0;i<v.length;i++)assert(Object.hasOwn(v,i));}
  const entries=keys.filter(k=>!array||k!=='length').map(k=>{assert(typeof k==='string');const d=Object.getOwnPropertyDescriptor(v,k);assert(d&&'value'in d&&d.enumerable);return[k,raw(d.value,ctx,depth+1)];});
  return array?entries.map(([,x])=>x):Object.fromEntries(entries);
}
function decode(v){if(v&&typeof v==='object'&&Object.hasOwn(v,'$f64le')){assert.deepEqual(Object.keys(v),['$f64le']);assert(/^[a-f0-9]{16}$/.test(v.$f64le));return Buffer.from(v.$f64le,'hex').readDoubleLE();}return Array.isArray(v)?v.map(decode):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,decode(x)])):v;}
const words=v=>JSON.stringify(raw(v));
function containers(v,set=new Set()){if(v&&typeof v==='object'){assert(!set.has(v),'public shared container/cycle');set.add(v);for(const x of Object.values(v))containers(x,set);}return set;}
function detached(v,others){const set=containers(v);for(const other of others)for(const x of containers(other))assert(!set.has(x),'public alias');}
function parity(a,b,providers,path=''){
  if(path.endsWith('/providerDigest')){assert.equal(a,providers.source);assert.equal(b,providers.native);return;}
  if(a&&typeof a==='object'){assert(b&&typeof b==='object');assert.equal(Array.isArray(a),Array.isArray(b));assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());for(const k of Object.keys(a))parity(a[k],b[k],providers,path+'/'+k);}else assert.equal(a,b,'raw parity '+path);
}
function stateGuard(s,index,pair,provider){
  raw(s);assert(Object.is(s.stepIndex,index));assert(Object.is(s.timeSeconds,index===0?0:pair.options.fixedStepSeconds));
  assert.equal(s.identity.providerDigest,provider);assert.equal(s.identity.modelRevision,pair.model.revision);assert.equal(s.identity.profile,pair.options.profile);assert.equal(s.identity.frameId,pair.model.frame.id);assert(Object.is(s.identity.fixedStepSeconds,pair.options.fixedStepSeconds));
  for(const k of ['modelDigest','configurationDigest','providerDigest'])assert(/^sha256:[a-f0-9]{64}$/.test(s.identity[k]));
  assert.equal(s.bodies.length,1);const b=s.bodies[0];assert.equal(b.id,'rotor');assert.equal(b.kind,'dynamic');assert.equal(b.sleeping,false);
  for(const k of ['positionM','velocityMps'])assert.equal(words(b[k]),words(pair.model.bodies[0].initial[k]));
  for(const k of ['contacts','events','joints','ccdHits','cloths','fluids'])assert.deepEqual(s[k],[]);
  assert.deepEqual(s.pairStats,{eligiblePairs:0,candidatePairs:0,aabbTests:0});
}

async function filesUnder(root){const result=[];for(const d of await readdir(root,{withFileTypes:true})){assert(!d.isSymbolicLink(),'staged symlink');const p=resolve(root,d.name);if(d.isDirectory())result.push(...await filesUnder(p));else{assert(d.isFile());result.push(p);}}return result.sort();}
function replaceOnce(text,old,next){assert.equal(text.split(old).length,2,'unique overlay anchor '+old);return text.replace(old,next);}
function overlayWorld(world){
  let result="import { prepareForcedBoxRotation } from './rigid-forced-rotation.js';\n"+world;
  result=replaceOnce(result,'scale(action?.torqueNm ?? [0, 0, 0], dt)',
    "scale(body.shape.kind === 'box' && (action?.torqueNm ?? [0, 0, 0]).some(value => value !== 0) ? [0, 0, 0] : action?.torqueNm ?? [0, 0, 0], dt)");
  result=replaceOnce(result,'const preparedRotation = prepareAxisymmetricFreeRotation(body, dt) ?? prepareTriaxialFreeRotation(body, dt);',
    'const preparedRotation = prepareForcedBoxRotation(body, dt, action?.torqueNm ?? [0, 0, 0]) ?? prepareAxisymmetricFreeRotation(body, dt) ?? prepareTriaxialFreeRotation(body, dt);');
  return result;
}
function manifest(text,emitted){const prefix='export const providerManifest = ';assert.equal(text.split(prefix).length,2);const tail=text.split(prefix)[1].trim();return JSON.parse(tail.slice(0,-(emitted?1:' as const;'.length)));}
async function identityClosure(path,root,seen=new Set()){
  if(seen.has(path))return seen;seen.add(path);assert(inside(root,path));assert(['identity.js','types.js'].includes(relative(root,path)),'identity must remain DATA-only');
  const text=(await bounded(path,MIB)).toString();for(const m of text.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){assert(m[1].startsWith('.'),'foreign identity import');await identityClosure(resolve(dirname(path),m[1]),root,seen);}return seen;
}

async function main(){
  const argv=process.argv.slice(2);assert.equal(argv.length,6);assert.deepEqual([argv[0],argv[2],argv[4]],['--run-id','--freeze','--token']);
  const id=argv[1],freezePath=resolve(argv[3]),token=argv[5];assert(/^[a-z0-9][a-z0-9-]{0,95}$/.test(id));assert(/^[a-f0-9]{64}$/.test(token));
  const started=performance.now(),freezeBytes=await bounded(freezePath,2*MIB);assert.equal(hash(freezeBytes),token);const freeze=JSON.parse(freezeBytes);
  const out=resolve(HERE,'evidence',id);await mkdir(out,{recursive:false});
  const counts={buildChildren:0,referenceChildren:0,entryEvaluations:0,identityDigestCalls:0,worlds:0,reads:0,steps:0,acceptedSteps:0,stateAudits:0,disposals:0,releases:0,privateInertiaReads:0};
  const commands=[],records=[],graphs={},cleanupErrors=[],audits=[],sourcePrivate={},sourceTrace={},buildPins=[];
  let phase='authenticate',meta=null,bankInput=null,firstFailure=null,evidenceBytes=0,buildBytes=0,peakLogicalBytes=0,expected=null;
  const time=()=>assert(performance.now()-started<170000,'170s inner deadline');
  const charge=(...extra)=>{let bytes=4*MIB,nodes=0;const seen=new Set();const walk=v=>{assert(++nodes<=180000);if(v===null||v===undefined||typeof v==='number'||typeof v==='boolean'){bytes+=16;return;}if(typeof v==='string'){bytes+=48+4*v.length;return;}assert(typeof v==='object');if(seen.has(v))return;seen.add(v);bytes+=128;if(Buffer.isBuffer(v)){bytes+=2*v.length;return;}for(const[k,x]of Object.entries(v)){bytes+=64+4*k.length;walk(x);}};walk({freeze,freezeBytes,meta,bankInput,counts,commands,records,graphs,cleanupErrors,audits,sourcePrivate,sourceTrace,buildPins,firstFailure,expected,extra});peakLogicalBytes=Math.max(peakLogicalBytes,bytes);assert(bytes<=16*MIB,'16MiB harness logical charge');};
  async function put(name,value,limit=65536){time();const text=typeof value==='string'?value:json(value),data=Buffer.from(text);assert(data.length<=limit,'packet bound '+name);charge(value,text,data);assert(evidenceBytes+data.length+MIB<=16*MIB,'16MiB evidence reserve');await writeFile(resolve(out,name),data,{flag:'wx'});evidenceBytes+=data.length;return resolve(out,name);}
  function frozenPath(name){assert(typeof name==='string'&&!isAbsolute(name));const p=resolve(ROOT,name);assert(inside(ROOT,p));assert(Object.hasOwn(freeze.files,name),'baseline input not frozen '+name);return p;}
  async function authenticate(){
    time();assert(freeze.files&&Object.keys(freeze.files).length<=1024);for(const[name,p]of Object.entries(freeze.files)){assert(!isAbsolute(name));const path=resolve(ROOT,name);assert(inside(ROOT,path));await auth(path,p);}
    for(const path of REQUIRED)assert(Object.hasOwn(freeze.files,relative(ROOT,path)),'missing mandatory frozen file '+path);
    assert.equal(freeze.tools.node,process.execPath);assert(process.versions.node.startsWith('22.'));
    const installed=JSON.parse(await bounded(TOOLCHAIN,MIB));assert.equal(Object.keys(installed.toolFiles).length,354);assert.equal(Object.keys(freeze.toolFiles).length,354);assert.deepEqual(freeze.tools,installed.tools);
    for(const[path,p]of Object.entries(installed.toolFiles)){assert.deepEqual(freeze.toolFiles[path],p);await auth(path,p);}
    assert.equal(await realpath(freeze.tools.nodeTypeRoot),freeze.tools.nodeTypeRoot);assert(freeze.toolFiles[resolve(freeze.tools.nodeTypeRoot,'node/package.json')]);
    for(const n of ['bank','bankInput','summary'])frozenPath(freeze.baseline[n]);
    if(meta){assert.equal(meta.stagedPins.length,262);for(const p of meta.stagedPins){assert(inside(resolve(MICRO,'build'),p.path));await auth(p.path,p);}assert.equal(meta.transfer.length,88);for(const t of meta.transfer){const path=resolve(ROOT,'packages/barocss-physics/src',t.name);assert(inside(resolve(ROOT,'packages/barocss-physics/src'),path));await auth(path,t.original);}}
    for(const p of buildPins)await auth(p.path,p);
  }
  async function child(label,args,cwd=ROOT){
    time();const remaining=170000-(performance.now()-started);assert(remaining>1000);const row={label,args,pid:null,exit:null,signal:null,closed:false,deadlineMs:Math.min(20000,remaining-500)};commands.push(row);
    const proc=spawn(args[0],args.slice(1),{cwd,stdio:['ignore','pipe','pipe']});row.pid=proc.pid??null;let stdout=Buffer.alloc(0),stderr=Buffer.alloc(0),primary=null;
    const fail=e=>{primary??=e;proc.kill('SIGKILL');},timer=setTimeout(()=>fail(new Error(label+' child deadline')),row.deadlineMs);
    try{await new Promise(done=>{proc.once('error',e=>{primary??=e;});for(const[stream,isOut]of[[proc.stdout,true],[proc.stderr,false]]){stream.on('error',fail);stream.on('data',block=>{if(stdout.length+stderr.length+block.length>65536){fail(new Error(label+' output bound'));return;}if(isOut)stdout=Buffer.concat([stdout,block]);else stderr=Buffer.concat([stderr,block]);});}proc.once('close',(exit,signal)=>{Object.assign(row,{exit,signal,closed:true});done();});});
      await put(label+'.stdout.raw',stdout.toString());await put(label+'.stderr.raw',stderr.toString());if(primary)throw primary;assert.equal(row.exit,0,label+' failed');return stdout.toString();
    }finally{clearTimeout(timer);if(!row.closed)proc.kill('SIGKILL');}
  }
  async function audit(record){
    phase='audit-'+record.graph+'-'+record.id;const prefix=record.graph+'-'+record.id,input=await put(prefix+'-record.json',record),output=resolve(out,prefix+'-audit.json');counts.referenceChildren++;
    await child(prefix+'-audit',[freeze.tools.python,'-B',REFERENCE,'--audit','--input',input,'--bank',frozenPath(freeze.baseline.bank),'--output',output]);
    const bytes=await bounded(output),report=JSON.parse(bytes);charge(bytes,report);evidenceBytes+=bytes.length;assert(evidenceBytes+MIB<=16*MIB);assert.equal(report.status,'PASS_REFERENCE_AUDIT');assert(['PASS','PHYSICAL_NO_GO'].includes(report.physicalStatus));audits.push({graph:record.graph,id:record.id,physicalStatus:report.physicalStatus,path:output,...await pin(output)});
    if(report.physicalStatus!=='PASS'){const e=new Error('repaired micro physical gate failed');e.name='PhysicalFailure';e.report=report;throw e;}
  }
  try{
    await authenticate();meta=JSON.parse(await bounded(META,MIB));await authenticate();
    assert.equal(JSON.parse(await bounded(resolve(MICRO,'summary.json'))).status,'PASS_STAGED_G1B_MICRO_ONLY');
    const baselineSummary=JSON.parse(await bounded(frozenPath(freeze.baseline.summary)));assert.equal(baselineSummary.status,'CHARACTERIZED_PHYSICAL_NO_GO');assert.equal(baselineSummary.counts.acceptedSteps,4);assert.equal(baselineSummary.counts.disposals,4);assert.equal(baselineSummary.counts.releases,4);assert.equal(baselineSummary.firstFailure,null);assert.deepEqual(baselineSummary.cleanupErrors,[]);
    {const bank=JSON.parse(await bounded(frozenPath(freeze.baseline.bank),MIB));assert.equal(bank.status,'PASS_REFERENCE_BANK');}
    bankInput=JSON.parse(await bounded(frozenPath(freeze.baseline.bankInput)));assert.deepEqual(Object.keys(bankInput),['cases']);assert.equal(bankInput.cases.length,2);
    const baseRaw=JSON.parse(await bounded(BASE));for(const[idCase,index]of[['J',0],['JT',1]]){const row=bankInput.cases[index];assert.deepEqual(Object.keys(row).sort(),['commandsRaw','id','pairRaw']);assert.equal(row.id,idCase);assert.deepEqual(row.pairRaw,baseRaw);const loads=[{kind:'angularImpulse',bodyId:'rotor',angularImpulseNms:[...J]}];if(idCase==='JT')loads.push({kind:'torque',bodyId:'rotor',torqueNm:[...TAU]});assert.deepEqual(row.commandsRaw,raw(loads));}
    phase='build';const build=resolve(out,'build'),stage=resolve(build,'package'),src=resolve(stage,'src'),dist=resolve(stage,'dist');await mkdir(src,{recursive:true});
    const oldFiles=await filesUnder(resolve(PACKAGE,'src')),transfers=[];
    for(const p of oldFiles){const name=relative(resolve(PACKAGE,'src'),p),wanted=meta.stagedPins.find(x=>x.path===p);assert(wanted,'unfrozen old staged source '+p);await auth(p,wanted);const target=resolve(src,name);await mkdir(dirname(target),{recursive:true});await copyFile(p,target);transfers.push({name,pin:{bytes:wanted.bytes,sha256:wanted.sha256}});}
    const oldPackage=resolve(PACKAGE,'package.json'),oldPackagePin=meta.stagedPins.find(x=>x.path===oldPackage);assert(oldPackagePin);await auth(oldPackage,oldPackagePin);await copyFile(oldPackage,resolve(stage,'package.json'));const pkg=JSON.parse(await bounded(oldPackage));assert.equal(pkg.type,'module');assert.equal(pkg.publishConfig.exports['.'].import,'./dist/index.js');
    await writeFile(resolve(src,'world.ts'),overlayWorld((await bounded(resolve(src,'world.ts'),MIB)).toString()));await copyFile(CANDIDATE,resolve(src,'rigid-forced-rotation.ts'));
    const sourceEntry=resolve(build,'source-entry.ts'),sourceBundle=resolve(build,'source.mjs'),sourceMeta=resolve(build,'source-meta.json');
    await writeFile(sourceEntry,[`export * from './package/src/index.ts';`,`export * from './package/src/replay.ts';`,`export { g1Control, g1bControl } from './package/src/g1-test-control.ts';`].join('\n')+'\n',{flag:'wx'});
    const config=resolve(stage,'tsconfig.micro.json');await writeFile(config,json({compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',lib:['ES2022'],strict:true,declaration:true,outDir:'dist',rootDir:'src',skipLibCheck:true,types:['node'],typeRoots:[freeze.tools.nodeTypeRoot],noEmitOnError:true},files:['src/index.ts','src/replay.ts']}),{flag:'wx'});
    counts.buildChildren++;await child('generate-source',[freeze.tools.node,resolve(src,'generate-provider.mjs')],stage);const sourceManifest=manifest((await bounded(resolve(src,'provider-manifest.generated.ts'),MIB)).toString(),false);
    counts.buildChildren++;const tscLog=await child('tsc-emit',[freeze.tools.node,freeze.tools.typescriptCLI,'-p',config,'--listFiles','--listEmittedFiles'],stage);
    for(const line of tscLog.trim().split('\n')){if(!line)continue;if(line.startsWith('TSFILE: ')){assert(inside(dist,resolve(line.slice(8))),'foreign emitted output');continue;}const p=resolve(line);if(inside(src,p)){assert(p.endsWith('.ts'));assert(!/\/(?:cad-proxy|cad-fluid-data)\.ts$/.test(p));}else{assert(freeze.toolFiles[p],'foreign tsc input '+p);await auth(p,freeze.toolFiles[p]);}}
    counts.buildChildren++;await child('generate-emitted',[freeze.tools.node,resolve(src,'generate-provider.mjs'),'--emitted'],stage);const nativeManifest=manifest((await bounded(resolve(dist,'provider-manifest.generated.js'),MIB)).toString(),true);
    counts.buildChildren++;await child('source-bundle',[freeze.tools.esbuildBinary,sourceEntry,'--bundle','--format=esm','--platform=node','--target=node22','--log-level=error','--outfile='+sourceBundle,'--metafile='+sourceMeta]);
    const bundleMeta=JSON.parse(await bounded(sourceMeta,MIB));for(const v of Object.values(bundleMeta.outputs))assert.equal(v.imports.length,0);for(const name of Object.keys(bundleMeta.inputs)){const p=resolve(ROOT,name);assert(p===sourceEntry||inside(src,p),'foreign source input '+p);assert(!/\/(?:cad-proxy|cad-fluid-data)\.ts$/.test(p));}for(const name of Object.keys(bundleMeta.outputs))assert(inside(build,resolve(ROOT,name)));
    for(const row of transfers)if(!['world.ts','provider-manifest.generated.ts'].includes(row.name))await auth(resolve(src,row.name),row.pin);
    for(const p of await filesUnder(build)){const value=await pin(p);buildBytes+=value.bytes;assert(buildBytes<=16*MIB);buildPins.push({path:p,...value});}
    await put('staged-providers.json',{labels:{source:'STAGED_COMMON_WORLD_SOURCE',native:'STAGED_EMITTED_PUBLIC_ENTRY'},transfers,buildPins,sourceManifest,nativeManifest},MIB);await authenticate();
    await identityClosure(resolve(dist,'identity.js'),dist);const identity=await import(pathToFileURL(resolve(dist,'identity.js')).href);counts.entryEvaluations++;expected={source:identity.digest(sourceManifest),native:identity.digest(nativeManifest)};counts.identityDigestCalls+=2;assert.notEqual(expected.source,expected.native);await put('expected-provider-digests.json',expected);
    for(const graph of ['source','native']){
      if(graph==='native')assert.equal(graphs.source?.status,'PASS_REPAIRED_MICRO_GRAPH','Source physical PASS and cleanup required before Native');
      phase='load-'+graph;await authenticate();const api=await import(pathToFileURL(graph==='source'?sourceBundle:resolve(dist,'index.js')).href);counts.entryEvaluations++;const control=graph==='source'?api:await import(pathToFileURL(resolve(dist,'g1-test-control.js')).href);if(graph==='native')counts.entryEvaluations++;
      const c=control.g1Control,t=control.g1bControl;c.assertReleased();assert.deepEqual(t.take(),[]);const startCommon=c.stats(),startTri=t.stats();
      for(const row of bankInput.cases){
        phase='capture-'+graph+'-'+row.id;const pair=decode(row.pairRaw),loads=decode(row.commandsRaw),pairWords=words(pair),commandWords=words(loads),prefix=graph+'-'+row.id;
        let world=null,primary=null,before=null,after=null,beforeWords=null,afterWords=null,privateInitial=null,traceReceipt=null;
        try{
          time();counts.worlds++;world=api.createPhysicsWorld(pair.model,pair.options);counts.reads++;before=world.getState();counts.stateAudits++;stateGuard(before,0,pair,expected[graph]);detached(before,[pair,loads]);beforeWords=words(before);
          counts.privateInertiaReads++;const cache=c.cache(world),body=cache.bodies.find(b=>b.id==='rotor');assert(body);privateInitial={bodyId:body.id,inertiaDiagonalKgM2:raw(body.inertiaDiagonalKgM2),orientationXYZW:raw(body.orientation)};assert.deepEqual(privateInitial.orientationXYZW,raw(before.bodies[0].orientationXYZW));await put(prefix+'-private-initial.json',privateInitial);
          counts.steps++;after=world.step(loads);counts.acceptedSteps++;counts.stateAudits++;stateGuard(after,1,pair,expected[graph]);detached(after,[pair,loads,before]);assert.equal(words(before),beforeWords);afterWords=words(after);assert.equal(words(pair),pairWords);assert.equal(words(loads),commandWords);
          const observations=t.take(),n=row.id==='J'?595:0;assert.equal(observations.length,n);const kinds={};for(const x of observations)kinds[x.kind]=(kinds[x.kind]??0)+1;if(n)assert.deepEqual(kinds,{initialMomentum:1,newtonCondition:108,pivot:324,newtonUpdate:108,midpointResidual:27,stageComplete:27});else assert.deepEqual(kinds,{});
          const trace=observations.map(x=>JSON.stringify(raw(x))).join('\n')+(observations.length?'\n':'');charge(observations,trace);await put(prefix+'-trace.jsonl',trace,MIB);traceReceipt={count:n,kinds,bytes:Buffer.byteLength(trace),sha256:hash(trace)};await put(prefix+'-trace-receipt.json',traceReceipt);
          if(graph==='source'){sourcePrivate[row.id]=privateInitial;sourceTrace[row.id]=traceReceipt;}else{assert.deepEqual(privateInitial,sourcePrivate[row.id]);assert.deepEqual(traceReceipt,sourceTrace[row.id]);}
        }catch(e){primary=e;throw e;}
        finally{
          if(world)for(const[action,fn]of[['dispose',()=>{counts.disposals++;world.dispose();}],['cancel',()=>c.cancel()],['release',()=>{counts.releases++;c.release(world);}]])try{fn();}catch(e){cleanupErrors.push({graph,id:row.id,action,message:e.message});primary??=e;}
          try{assert.deepEqual(t.take(),[],'undrained trace');t.assertEmpty();c.assertReleased();}catch(e){cleanupErrors.push({graph,id:row.id,action:'controls',message:e.message});primary??=e;}
          if(primary&&!firstFailure)firstFailure={phase,name:primary.name,message:primary.message,stack:primary.stack};
        }
        assert.equal(cleanupErrors.length,0);assert.equal(words(before),beforeWords);assert.equal(words(after),afterWords);assert.equal(words(pair),pairWords);assert.equal(words(loads),commandWords);
        const record={graph,id:row.id,pairRaw:raw(pair),commandsRaw:raw(loads),beforeRaw:raw(before),afterRaw:raw(after)};records.push(record);if(graph==='native'){const source=records.find(x=>x.graph==='source'&&x.id===row.id);parity({...source,graph:'paired'},{...record,graph:'paired'},expected);}await audit(record);
      }
      const gs=c.stats(),ts=t.stats();assert.equal(gs.attachments-startCommon.attachments,2);assert.equal(gs.releases-startCommon.releases,2);assert.equal(gs.dispatch-startCommon.dispatch,2);assert.equal(gs.faultThrows-startCommon.faultThrows,0);assert.equal(ts.general-startTri.general,1);assert.equal(ts.stageComplete-startTri.stageComplete,27);assert.equal(ts.pivot-startTri.pivot,324);graphs[graph]={status:'PASS_REPAIRED_MICRO_GRAPH',commonStats:gs,triaxialStats:ts};await put(graph+'-helper-stats.json',graphs[graph]);
    }
    assert.equal(records.length,4);assert.equal(counts.worlds,4);assert.equal(counts.reads,4);assert.equal(counts.steps,4);assert.equal(counts.acceptedSteps,4);assert.equal(counts.stateAudits,8);assert.equal(counts.disposals,4);assert.equal(counts.releases,4);assert.equal(counts.referenceChildren,4);assert.equal(counts.buildChildren,4);
  }catch(e){firstFailure??={phase,name:e.name,message:e.message,stack:e.stack,...(e.report?{report:e.report}:{})};}
  finally{
    try{await authenticate();}catch(e){if(firstFailure)cleanupErrors.push({action:'post-auth',message:e.message});else firstFailure={phase:'post-auth',name:e.name,message:e.message,stack:e.stack};}
    const status=cleanupErrors.length?'FAIL':firstFailure?.name==='PhysicalFailure'?'PHYSICAL_NO_GO':firstFailure?'FAIL':'PASS_STAGED_G1E_FORCED_MICRO_ONLY';
    const summary={status,runId:id,phase,counts,graphs,audits,firstFailure,cleanupErrors,commands,expectedProviderDigests:expected,resources:{evidenceBytes,buildBytes,peakLogicalBytes,wholeLogicalBytes:64*MIB,referenceLogicalBytes:8*MIB,rssClaim:false},innerMs:performance.now()-started,newReferenceWindows:0,productionAdoption:'NOT_RUN',trajectory:'NOT_RUN',physicalToleranceChanged:false};
    const text=json(summary);assert(Buffer.byteLength(text)<=65536);assert(evidenceBytes+Buffer.byteLength(text)<=16*MIB);await writeFile(resolve(out,'summary.json'),text,{flag:'wx'});process.stdout.write(json({status,summary:resolve(out,'summary.json')}));if(firstFailure||cleanupErrors.length)process.exitCode=1;
  }
}
main().catch(e=>{process.stderr.write(String(e.stack??e)+'\n');process.exitCode=1;});

