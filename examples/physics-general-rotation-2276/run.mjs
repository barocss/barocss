/** Frozen actual-package rotation checks. This runner never builds or integrates a reference. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, statSync, realpathSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const SELF=fileURLToPath(import.meta.url), HERE=dirname(SELF), ROOT=resolve(HERE,'../..');
const sha=x=>createHash('sha256').update(x).digest('hex'), json=x=>JSON.stringify(x)+'\n';
function raw(x){if(typeof x==='number'){assert(Number.isFinite(x));const b=Buffer.alloc(8);b.writeDoubleLE(x);return{$f64le:b.toString('hex')};}return Array.isArray(x)?x.map(raw):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,raw(v)])):x;}
function decode(x){return x&&typeof x==='object'&&Object.hasOwn(x,'$f64le')?Buffer.from(x.$f64le,'hex').readDoubleLE():Array.isArray(x)?x.map(decode):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v)])):x;}
const words=x=>JSON.stringify(raw(x));
const args=process.argv.slice(2);assert.equal(args.length,6);assert.deepEqual([args[0],args[2],args[4]],['--run-id','--freeze','--token']);
const id=args[1];assert(/^[a-z0-9][a-z0-9-]{0,95}$/.test(id));const freezeBytes=readFileSync(resolve(args[3]));assert.equal(sha(freezeBytes),args[5]);
const freeze=JSON.parse(freezeBytes), out=resolve(HERE,'evidence',id);mkdirSync(out,{recursive:false});
const started=performance.now(), graphs={}, sourceCases={}, providerDigests={};let phase='authenticate', failure=null, evidenceBytes=0;
const checkTime=()=>assert(performance.now()-started<180000,'180s runtime deadline');
function put(name,data){checkTime();const text=typeof data==='string'?data:json(data);evidenceBytes+=Buffer.byteLength(text);assert(evidenceBytes<=16*1048576,'16MiB evidence cap');writeFileSync(resolve(out,name),text,{flag:'wx'});return resolve(out,name);}
function pathOf(name){assert(typeof name==='string'&&!isAbsolute(name));const p=resolve(ROOT,name);assert(p.startsWith(ROOT+'/'));assert(Object.hasOwn(freeze.files,name),'missing pin '+name);return p;}
function authenticate(){
  checkTime();assert(Object.keys(freeze.files).length<=2048);
  for(const [name,pin] of Object.entries(freeze.files)){const p=pathOf(name);assert.equal(realpathSync(p),p);const data=readFileSync(p);assert.equal(data.length,pin.bytes);assert.equal(sha(data),pin.sha256,p);}
  for(const name of ['node','python']){const p=freeze.tools[name],pin=freeze.tools[name+'Pin'];assert(isAbsolute(p));const data=readFileSync(p);assert.equal(data.length,pin.bytes);assert.equal(sha(data),pin.sha256);}
  assert.equal(freeze.tools.node,process.execPath);
  for(const name of ['sourceEntry','nativeEntry','nativeReplay','nativeIdentity','nativeManifest'])pathOf(freeze.runtime[name]);
  for(const name of ['study','bank'])pathOf(freeze.inputs[name]);
  const requireTree=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const p=resolve(dir,entry.name);if(entry.isDirectory())requireTree(p);else assert(Object.hasOwn(freeze.files,relative(ROOT,p)),'unfrozen package file '+p);}};
  for(const dir of ['src','dist'])requireTree(resolve(ROOT,'packages/barocss-physics',dir));
  for(const p of [SELF,resolve(HERE,'reference-general.py'),resolve(HERE,'invariants-general.py')])assert(Object.hasOwn(freeze.files,relative(ROOT,p)));
}
function audit(input,label){
  checkTime();const target=resolve(out,label+'-audit.json');
  const child=spawnSync(freeze.tools.python,['-B',resolve(HERE,'reference-general.py'),'--audit','--input',input,'--bank',pathOf(freeze.inputs.bank),'--output',target],{cwd:ROOT,encoding:'utf8',timeout:20000,maxBuffer:65536});
  put(label+'-audit-process.json',{status:child.status,signal:child.signal,error:child.error?.message??null,stdout:child.stdout,stderr:child.stderr});assert.equal(child.status,0,'reference child');
  const result=JSON.parse(readFileSync(target));assert.equal(result.status,'PASS_REFERENCE_AUDIT');assert.equal(result.physicalStatus,'PASS');return result;
}
function stripped(state,graph){assert.equal(state.identity.providerDigest,providerDigests[graph]);const copy=structuredClone(state);copy.identity.providerDigest='VALIDATED_OWN_PROVIDER';return copy;}
function near(a,b,label){assert.equal(a.length,b.length);for(let i=0;i<a.length;i++)assert(Math.abs(a[i]-b[i])<=1e-11+1e-12*Math.max(Math.abs(a[i]),Math.abs(b[i])),label);}
function multiply(a,b){const[x,y,z,w]=a,[u,v,s,t]=b;return[w*u+x*t+y*s-z*v,w*v-x*s+y*t+z*u,w*s+x*v-y*u+z*t,w*t-x*u-y*v-z*s];}
try{
  authenticate();const study=JSON.parse(readFileSync(pathOf(freeze.inputs.study))), base=decode(study.pairRaw), loads=decode(study.commandsRaw);
  const observed=put('observed.jsonl',{study});
  for(const graph of ['source','native']){
    phase=graph+'-import';if(graph==='native')assert.equal(graphs.source.status,'PASS_GRAPH');authenticate();
    let api,replay,digest,manifest;
    if(graph==='source'){api=await import(pathToFileURL(pathOf(freeze.runtime.sourceEntry)));replay=api;digest=api.digest;manifest=api.providerManifest;}
    else{const identity=await import(pathToFileURL(pathOf(freeze.runtime.nativeIdentity))), data=await import(pathToFileURL(pathOf(freeze.runtime.nativeManifest)));digest=identity.digest;manifest=data.providerManifest;api=await import(pathToFileURL(pathOf(freeze.runtime.nativeEntry)));replay=await import(pathToFileURL(pathOf(freeze.runtime.nativeReplay)));}
    assert.equal(typeof digest,'function');assert(manifest&&typeof manifest==='object');providerDigests[graph]=digest(manifest);
    let longPacket;
    const counts={worlds:0,acceptedSteps:0,attempts:0,refusals:0,restores:0}, results={}, live=new Set(), recorders=[];
    graphs[graph]={status:'RUNNING',counts,providerDigest:providerDigests[graph]};
    const open=pair=>{checkTime();assert(++counts.worlds<=32,'32 World bound');const w=api.createPhysicsWorld(pair.model,pair.options);live.add(w);return w;};
    const close=w=>{w.dispose();live.delete(w);};
    const accept=(target,commands=[])=>{checkTime();assert(++counts.attempts<=10016);assert(counts.acceptedSteps<10000);const s=target.step(commands);counts.acceptedSteps++;stripped(s,graph);return s;};
    const capture=(name,value)=>{const encoded=raw(value);results[name]=encoded;if(graph==='source')sourceCases[name]=encoded;else assert.deepEqual(raw(strippedDeep(decode(sourceCases[name]),'source')),raw(strippedDeep(value,'native')),'Source/Native '+name);put(graph+'-'+name+'.json',encoded);};
    function strippedDeep(value,g){if(Array.isArray(value))return value.map(v=>strippedDeep(v,g));if(value&&typeof value==='object'){if(Object.hasOwn(value,'providerDigest')){assert.equal(value.providerDigest,providerDigests[g]);return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='providerDigest'?'VALIDATED_OWN_PROVIDER':strippedDeep(v,g)]));}return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,strippedDeep(v,g)]));}return value;}
    try{
      phase=graph+'-three-grids';const graphObserved=put(graph+'-observed.jsonl',{study});
      for(const grid of [60,120,240]){
        const pair=structuredClone(base);pair.options.fixedStepSeconds=1/grid;const w=open(pair),frameHash=createHash('sha256');let state=w.getState();
        for(let n=0;n<=grid/10;n++){
          if(n)state=accept(w,n===1?loads:loads.filter(c=>c.kind!=='angularImpulse'));
          frameHash.update(words(stripped(state,graph))+'\n');
          const row=json({graph,grid,stepIndex:n,stateRaw:raw(state)});appendFileSync(observed,row);appendFileSync(graphObserved,row);evidenceBytes+=2*Buffer.byteLength(row);
        }capture('grid-'+grid,{pair,lastState:state,publicFramesSHA256:frameHash.digest('hex')});close(w);
      }
      graphs[graph].referenceAudit=audit(graphObserved,graph);
      phase=graph+'-generality';const endpoints=[];
      const configurations=[];
      for(const mass of [2**-19,1,2**19])for(const length of [1/512,1,1024])configurations.push({name:'scaled-'+mass+'-'+length,mass,length,rotated:false});
      for(const length of [1/512,1,1024])configurations.push({name:'rotated-'+length,mass:1,length,rotated:true});
      for(const [axis,h] of [[0,[.23,.11,.11]],[1,[.11,.23,.11]],[2,[.11,.11,.23]]])configurations.push({name:'axisymmetric-'+axis,mass:2.7,length:1,h});
      for(const kind of ['sphere','capsule','cube'])configurations.push({name:kind,mass:3.2,length:1,kind});
      configurations.push({name:'zero-spin',mass:1.9,length:1,zero:true});
      for(const kind of ['sphere','capsule','cube'])configurations.push({name:kind+'-forced',mass:3.2,length:1,kind,torque:[.001,-.0003,.0007]});
      configurations.push({name:'arbitrary-J',mass:1.7,length:1,impulse:[.00031,-.00017,.00009]});
      for(const config of configurations){
        const pair=structuredClone(base),body=pair.model.bodies[0];body.massKg=config.mass;body.initial.angularVelocityRadps=config.zero?[0,0,0]:config.rotated?[1.2,.7,-.3]:[.7,-.3,1.2];body.initial.orientationXYZW=config.rotated?[.5,.5,.5,.5]:[0,0,0,1];pair.options.fixedStepSeconds=1/120;
        pair.model.colliders[0].geometry=config.kind==='sphere'?{kind:'sphere',radiusM:.17}:config.kind==='capsule'?{kind:'capsule',radiusM:.12,halfLengthM:.27}: {kind:'box',halfExtentsM:(config.h??(config.kind==='cube'?[.17,.17,.17]:[.1,.2,.3])).map(x=>x*config.length)};
        const w=open(pair),before=w.getState();let after;for(let n=0;n<12;n++)after=accept(w,[...(n===0&&config.impulse?[{kind:'angularImpulse',bodyId:body.id,angularImpulseNms:config.impulse}]:[]),...(config.torque?[{kind:'torque',bodyId:body.id,torqueNm:config.torque}]:[])]);close(w);
        if(config.zero){assert.equal(words(after.bodies[0].orientationXYZW),words(before.bodies[0].orientationXYZW));assert.equal(words(after.bodies[0].angularVelocityRadps),words(before.bodies[0].angularVelocityRadps));}
        const packet={config,pair,before,after};endpoints.push(packet);capture(config.name,packet);
      }
      const baseline=endpoints.find(p=>p.config.name==='scaled-1-1').after.bodies[0];
      for(const p of endpoints.filter(p=>p.config.name.startsWith('scaled-'))){near(p.after.bodies[0].orientationXYZW,baseline.orientationXYZW,'free scale orientation');near(p.after.bodies[0].angularVelocityRadps,baseline.angularVelocityRadps,'free scale spin');}
      for(const p of endpoints.filter(p=>p.config.rotated)){near(p.after.bodies[0].orientationXYZW,multiply([.5,.5,.5,.5],baseline.orientationXYZW),'rotation transport orientation');const[x,y,z]=baseline.angularVelocityRadps;near(p.after.bodies[0].angularVelocityRadps,[z,x,y],'rotation transport spin');}
      phase=graph+'-long-free';{
        const pair=structuredClone(base),b=pair.model.bodies[0];b.massKg=2.3;b.initial.orientationXYZW=[.5,.5,.5,.5];b.initial.angularVelocityRadps=[.7,-.3,1.2];pair.model.colliders[0].geometry.halfExtentsM=[.13,.21,.31];pair.options.fixedStepSeconds=1/120;
        const w=open(pair),before=w.getState(),hash=createHash('sha256'),samples=[{stepIndex:0,state:before}];hash.update(words(stripped(before,graph))+'\n');let after;
        for(let n=1;n<=3600;n++){after=accept(w);hash.update(words(stripped(after,graph))+'\n');if(n===1||n%120===0)samples.push({stepIndex:n,state:after});}close(w);longPacket={pair,before,after,samples};capture('long-free',{...longPacket,publicFramesSHA256:hash.digest('hex')});
      }
      phase=graph+'-invariants';{
        const input=put(graph+'-invariants-input.json',raw({packets:endpoints,long:longPacket})),target=resolve(out,graph+'-invariants-audit.json');
        const child=spawnSync(freeze.tools.python,['-B',resolve(HERE,'invariants-general.py'),'--input',input,'--output',target],{cwd:ROOT,encoding:'utf8',timeout:20000,maxBuffer:65536});
        put(graph+'-invariants-process.json',{status:child.status,signal:child.signal,error:child.error?.message??null,stdout:child.stdout,stderr:child.stderr});assert.equal(child.status,0,'independent invariants child');
        const result=JSON.parse(readFileSync(target));assert.equal(result.status,'PASS_INVARIANTS');assert.equal(result.physicalStatus,'PASS');graphs[graph].invariantsAudit=result;
      }
      phase=graph+'-transaction';{
        const pair=structuredClone(base),w=open(pair),recorder=replay.createPhysicsRecorder(w);recorders.push(recorder);
        const refuse=(label,operation,marker,target=recorder)=>{const before=words(target.getState()),log=words(target.saveRecording());let caught;counts.attempts++;try{operation();}catch(e){caught=e;}assert(caught,label);if(marker)assert.equal(caught,marker);else{assert(caught instanceof api.PhysicsError);assert.equal(caught.code,'NUMERIC_LIMIT');}counts.refusals++;assert.equal(words(target.getState()),before);assert.equal(words(target.saveRecording()),log);return{label,code:caught.code??null,message:caught.message};};
        const capped=open(pair),capRecorder=replay.createPhysicsRecorder(capped);recorders.push(capRecorder);
        const failures=[refuse('internal-cap',()=>capRecorder.step([{kind:'torque',bodyId:pair.model.bodies[0].id,torqueNm:[1e6,0,0]}]),null,capRecorder)];
        const capRecovery=accept(capRecorder);capture('cap-recovery',{pair,capRecovery});
        const original=Math.hypot,marker=new Error('GENERAL_FORCED_UNKNOWN'),fault={fourArgumentHits:0,rhsCalls:0,stack:null};
        failures.push(refuse('unknown',()=>{Math.hypot=function(...xs){const stack=new Error().stack;if(xs.length===3&&stack.includes('rhs'))fault.rhsCalls++;if(xs.length===4){fault.fourArgumentHits++;fault.stack=stack;throw marker;}return original(...xs);};try{return recorder.step(loads);}finally{Math.hypot=original;}},marker));
        assert.equal(Math.hypot,original);assert.equal(fault.fourArgumentHits,1);assert.equal(fault.rhsCalls,24);assert(fault.stack.includes('prepareForcedRotation'));
        const after=accept(recorder,loads),one=recorder.saveRecording();assert.equal(one.frames.length,1);assert(++counts.worlds<=32);counts.restores++;counts.acceptedSteps++;
        const restored=replay.restorePhysicsRecording(one,{model:pair.model,options:pair.options,providerDigest:providerDigests[graph]});live.add(restored.world);recorders.push(restored.recorder);assert.equal(words(restored.recorder.getState()),words(after));assert.equal(words(restored.recorder.saveRecording()),words(one));
        const continued=accept(recorder),recontinued=accept(restored.recorder);assert.equal(words(continued),words(recontinued));const control=open(pair);assert.equal(words(accept(control,loads)),words(after));assert.equal(words(accept(control)),words(continued));close(control);
        capture('transaction',{pair,failures,fault:{fourArgumentHits:fault.fourArgumentHits,rhsCalls:fault.rhsCalls},after,one,continued,recontinued});
      }
    }finally{for(const recorder of recorders.reverse())recorder.dispose();for(const w of live)close(w);}
    assert(counts.worlds<=32&&counts.acceptedSteps<=10000);graphs[graph].status='PASS_GRAPH';put(graph+'-counts.json',graphs[graph]);
  }
  phase='combined-audit';audit(observed,'combined');authenticate();
}catch(e){failure={phase,name:e.name,message:e.message,stack:e.stack};}
const summary={status:failure?'FAIL_GENERAL_ROTATION':'PASS_GENERAL_ROTATION',graphs,firstFailure:failure,newODEWindows:0,buildChildren:0,elapsedMs:performance.now()-started,evidenceBytes,browser:'NOT_RUN',remote:'NOT_RUN'};
writeFileSync(resolve(out,'summary.json'),json(summary),{flag:'wx'});process.stdout.write(json(summary));if(failure)process.exitCode=1;
