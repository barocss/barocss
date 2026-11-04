// Root alone executes under command-run180s. No build, provider mutation or expected-state injection.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {openSync,readSync,closeSync,readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {caseIds,makeCase,budget,gates,pack,numericWordsHex} from './cases.mjs';
const here=import.meta.dirname,root=resolve(here,'../..'),id=process.argv[2];assert.ok(/^[a-z0-9-]+$/.test(id??'')&&process.argv.length===3,'node run.mjs fresh-id');const out=join(here,'evidence',id);mkdirSync(join(here,'evidence'),{recursive:true});mkdirSync(out);const deadline=Date.now()+budget.innerMs;
const python='/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13',source=join(root,'examples/physics-stack-stationary-world-2276/evidence/public-source-01/source-modules'),native=join(root,'packages/barocss-physics/dist'),frozen={},commands=[],counts={},reports={},graphBytes={source:0,native:0};let phase='freeze',firstFailure=null,integrity='NOT_RUN',currentGraph=null;
function hash(path){const fd=openSync(path,'r'),h=createHash('sha256'),b=Buffer.alloc(65536);try{let n;while((n=readSync(fd,b,0,b.length,null)))h.update(b.subarray(0,n));}finally{closeSync(fd);}return h.digest('hex');}
function freeze(path){frozen[relative(root,path)]=hash(path);}
function scan(path){for(const d of readdirSync(path,{withFileTypes:true})){const p=join(path,d.name);if(d.isDirectory())scan(p);else freeze(p);}}
function checkTime(){assert.ok(Date.now()<deadline,'internal170 deadline');}
function put(name,value,graph=currentGraph){const bytes=Buffer.from(typeof value==='string'?value:JSON.stringify(value)+'\n');if(graph){graphBytes[graph]+=bytes.length;assert.ok(graphBytes[graph]<=budget.evidenceBytes,'graph16MiB evidence');}writeFileSync(join(out,name),bytes,{flag:'wx'});}
function child(label,exe,args,input=null){checkTime();phase=label;writeFileSync(join(out,'progress.json'),JSON.stringify({phase,currentGraph,counts,beforeSpawn:true})+'\n');const r=spawnSync(exe,args,{cwd:root,input,encoding:'utf8',timeout:Math.max(1,Math.floor(deadline-Date.now())),maxBuffer:budget.wireBytes});put(label+'.stdout',r.stdout??'');put(label+'.stderr',r.stderr??'');commands.push({label,exe,args,exit:r.status,signal:r.signal,error:r.error?.message??null});assert.ok(r.status===0&&!r.error,label+' child failed');return r.stdout;}
const normalized=x=>Array.isArray(x)?x.map(normalized):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,k==='providerDigest'?'OWN_GRAPH_VALIDATED':normalized(v)])):x;
const sourceParities=new Map();
try{
 assert.ok(process.versions.node.startsWith('22.'));scan(source);scan(native);scan(join(root,'packages/barocss-physics/src'));for(const d of readdirSync(here,{withFileTypes:true}))if(d.isFile())freeze(join(here,d.name));for(const p of [join(root,'packages/barocss-physics/package.json'),join(root,'examples/physics-model-input/model.mjs'),process.execPath,python])freeze(p);
 const pins=JSON.parse(readFileSync(join(root,'examples/physics-stack-stationary-witness-2276/PINS.json'),'utf8'));assert.equal(hash(python),pins.tools[python]);assert.equal(hash(process.execPath),pins.tools[process.execPath],'pinned existingNode tool');put('frozen-inputs.json',{frozen,budget,gates,inputs:caseIds.map(makeCase),authorExecution:false,outerGuardMs:180000},null);
 child('literal-controls',process.execPath,['--test',join(here,'tests.mjs')]);
 for(const graph of ['source','native']){
  currentGraph=graph;phase=graph+'-import';const modules=graph==='source'?source:native,api={...await import(pathToFileURL(join(modules,'index.js'))),...await import(pathToFileURL(join(modules,'replay.js')))};
  const count=counts[graph]={worlds:0,acceptedSteps:0,knownRefusals:0,unknownRefusals:0,restoredWorlds:0,replayedSteps:0,restoreInternalCountsUnknown:false};let provider=null;
  function room(steps=0,worlds=0){checkTime();assert.ok(count.acceptedSteps+steps<=budget.acceptedSteps&&count.worlds+worlds<=budget.worlds,'fixed graph population budget');}
  function open(c){room(0,1);const w=api.createPhysicsWorld(c.model,c.options);count.worlds++;const actual=w.getState().identity.providerDigest;provider??=actual;assert.equal(actual,provider);return w;}
  function step(w,commands=[]){room(1);const state=w.step(commands);count.acceptedSteps++;return state;}
  function parity(name,data){const packet=pack(data);put(graph+'-'+name+'.json',packet);if(graph==='source')sourceParities.set(name,packet);else{const old=sourceParities.get(name);assert.deepEqual(normalized(packet.data),normalized(old.data),'complete Source/Native data '+name);assert.equal(packet.numericWordsF64leHex,old.numericWordsF64leHex,'ALL numeric word parity '+name);}return packet;}
  const caseReports=[];
  for(const caseId of caseIds){
   phase=graph+'-'+caseId;const c=makeCase(caseId),before=structuredClone(c),w=open(c),recorder=caseId==='gravity-fall'||caseId==='delayed-pair'?api.createPhysicsRecorder(w):null,actor=recorder??w,states=[w.getState()];
   try{for(let i=0;i<c.steps;i++){const prior=states.at(-1),copy=structuredClone(prior),commands=[],after=step(actor,commands);assert.deepEqual(prior,copy,'previous public output immutable');assert.deepEqual(commands,[]);assert.equal(after.stepIndex,i+1);assert.equal(after.timeSeconds,(i+1)*c.options.fixedStepSeconds);states.push(after);}assert.deepEqual(c,before);assert.deepEqual(w.getModel(),c.model);const data={caseId,model:c.model,options:c.options,states},packet=parity(caseId,data),wire=JSON.stringify(packet)+'\n';assert.ok(Buffer.byteLength(wire)<=budget.wireBytes,'original2MiB oracle wire');const raw=child(graph+'-'+caseId+'-oracle',python,['-B',join(here,'oracle.py')],wire),lines=raw.trim().split('\n');assert.equal(lines.length,1);const result=JSON.parse(lines[0]);assert.equal(result.executionFailure,false);assert.equal(result.resolved,true);assert.equal(result.ok,true,JSON.stringify(result.violations));caseReports.push({caseId,result});if(recorder)parity(caseId+'-recording',{caseId,model:c.model,options:c.options,recording:recorder.saveRecording()});
   }finally{recorder?.dispose();w.dispose();}
  }
  const convergence={};for(const key of ['continuousPositionErrorM','continuousEnergyErrorJ']){const samples=[60,120,240].map(hz=>caseReports.find(r=>r.caseId==='ballistic-'+hz).result.metrics[key]);assert.ok(samples.every(x=>Number.isFinite(x)&&x>0),'actual oracle convergence samples '+key);const ratios=[samples[0]/samples[1],samples[1]/samples[2]];assert.ok(ratios.every(x=>x>=gates.convergenceRatio[0]&&x<=gates.convergenceRatio[1]),'original firstorder convergence '+key);convergence[key]={samples,ratios};}parity('convergence',{convergence});
  // Every bounded refusal has an actual previously accepted moving/support chain.
  phase=graph+'-retention';{
   const c=makeCase('gravity-fall'),w=open(c),control=open(c),r=api.createPhysicsRecorder(w),cr=api.createPhysicsRecorder(control);
   try{for(let i=0;i<32;i++)assert.deepEqual(step(r),step(cr));const capture=()=>({state:w.getState(),model:w.getModel(),recording:r.saveRecording()});let before=capture();const command=[{kind:'impulse',bodyId:'moving',impulseNs:[100000,0,0]}],copy=structuredClone(command);assert.throws(()=>r.step(command),e=>e instanceof api.PhysicsError&&e.code==='NUMERIC_LIMIT');count.knownRefusals++;assert.deepEqual(command,copy);assert.deepEqual(capture(),before);assert.deepEqual(step(r),step(cr));assert.deepEqual(r.saveRecording(),cr.saveRecording());const known={before,after:capture()};
    before=capture();const original=Math.sqrt,marker=Error('DYNAMIC_NEXT_UNKNOWN_PERSISTENT'),stack={value:null};Math.sqrt=()=>{stack.value=Error().stack;throw marker;};try{assert.throws(()=>r.step([]),error=>error===marker);}finally{Math.sqrt=original;}assert.ok(stack.value?.includes('solvePersistentPoint'),'unknown throw must reach actual persistent solver');count.unknownRefusals++;assert.deepEqual(capture(),before);assert.deepEqual(step(r),step(cr));assert.deepEqual(r.saveRecording(),cr.saveRecording());parity('failure-retention',{caseId:'retention',model:c.model,options:c.options,known,unknown:{before,after:capture()}});put(graph+'-unknown-stack.json',stack);
   }finally{r.dispose();cr.dispose();w.dispose();control.dispose();}
  }
  phase=graph+'-restore';{
   const c=makeCase('delayed-pair'),w=open(c),r=api.createPhysicsRecorder(w);let restored=null;
   try{for(let i=0;i<4;i++)step(r);const saved=r.saveRecording(),before=w.getState();room(saved.frames.length,1);count.restoreInternalCountsUnknown=true;restored=api.restorePhysicsRecording(saved,{model:c.model,options:c.options,providerDigest:provider});count.worlds++;count.restoredWorlds++;count.acceptedSteps+=saved.frames.length;count.replayedSteps+=saved.frames.length;count.restoreInternalCountsUnknown=false;assert.deepEqual(restored.recorder.getState(),before);assert.deepEqual(restored.recorder.saveRecording(),saved);const continued=step(r),resumed=step(restored.recorder);assert.deepEqual(resumed,continued);parity('restore',{caseId:'restore',model:c.model,options:c.options,saved,before,continued,resumed});
   }finally{restored?.recorder.dispose();restored?.world.dispose();r.dispose();w.dispose();}
  }
  phase=graph+'-repeat';{
   const c=makeCase('delayed-pair'),a=open(c),b=open(c),states=[a.getState()];try{for(let i=0;i<4;i++){const actual=step(a),repeat=step(b);assert.deepEqual(actual,repeat);assert.equal(numericWordsHex(actual),numericWordsHex(repeat));states.push(actual);}parity('repeat',{caseId:'repeat',model:c.model,options:c.options,states});}finally{a.dispose();b.dispose();}
  }
  assert.equal(count.worlds,budget.plannedWorlds);assert.equal(count.acceptedSteps,budget.plannedAcceptedSteps);reports[graph]={providerDigest:provider,count,caseReports,convergence,evidenceBytes:graphBytes[graph]};put(graph+'-result.json',{status:'DYNAMIC_NEXT_NUMERICAL_GRAPH_CONFIRMED',...reports[graph]});
 }
}catch(error){firstFailure={phase,graph:currentGraph,name:error?.name??null,code:error?.code??null,message:String(error?.message??error),stack:error?.stack??null};process.exitCode=1;}
finally{try{integrity='PASS';for(const [path,sha]of Object.entries(frozen))if(hash(resolve(root,path))!==sha)throw Error('changed input '+path);}catch(error){integrity='FAIL';firstFailure??={phase:'final-authentication',message:error.message};process.exitCode=1;}put('result.json',{status:firstFailure?'DYNAMIC_NEXT_NUMERICAL_NO_GO':'DYNAMIC_NEXT_NUMERICAL_SOURCE_NATIVE_CONFIRMED',firstFailure,counts,reports,sourceIntegrity:integrity,graphBytes,commands,budget,desktop:'NOT_RUN_SAME_STAGE_STILL_REQUIRED',eightDynamicQualified:false,newSolver:false,newPhysicsProfile:false,publication:false,mobile:false},null);}
