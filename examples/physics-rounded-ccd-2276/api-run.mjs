import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {makeModel,dynamicPart,staticPart} from '../physics-model-input/model.mjs';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),id=process.argv[2];assert(/^[a-z0-9-]+$/.test(id??''));
const out=resolve(home,'evidence',id);mkdirSync(out,{recursive:false});
const put=(name,x)=>writeFileSync(resolve(out,name),JSON.stringify(x,null,2)+'\n',{flag:'wx'});
const raw=x=>typeof x==='number'?{$f64le:(()=>{assert(Number.isFinite(x));const b=Buffer.alloc(8);b.writeDoubleLE(x);return b.toString('hex');})()}:Array.isArray(x)?x.map(raw):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,raw(v)])):x;
const decode=x=>x&&typeof x==='object'&&Object.hasOwn(x,'$f64le')?Buffer.from(x.$f64le,'hex').readDoubleLE():Array.isArray(x)?x.map(decode):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,decode(v)])):x;
const cases=JSON.parse(readFileSync(resolve(home,'cases.json'))).cases,bank=JSON.parse(readFileSync(resolve(home,'evidence/geometry-01/bank.json'))),sourceResults=new Map();
assert.equal(JSON.parse(readFileSync(resolve(home,'evidence/geometry-01/summary.json'))).status,'PASS_ROUNDED_GEOMETRY');
const normalized=x=>Array.isArray(x)?x.map(normalized):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,k==='providerDigest'?'VALIDATED_OWN_GRAPH':normalized(v)])):x;
const makePair=c=>({model:makeModel({revision:'g2-rounded-api',gravityMps2:[0,0,0],parts:[dynamicPart('sphere',{kind:'sphere',radiusM:c.radius},{positionM:c.start,velocityMps:c.end.map((v,i)=>(v-c.start[i])*60)},1,{ccd:true}),staticPart('box',{kind:'box',halfExtentsM:c.half},{positionM:c.boxCenter??[0,0,0],orientationXYZW:c.orientation??[0,0,0,1]})]}),options:{profile:'rigid-discrete-v1',fixedStepSeconds:1/60,broadPhase:'direct'}});
function target(hit,ref,normalTransform=x=>x){assert(hit);for(const x of ref.selected.t120)assert(Math.abs(hit.toiFraction-Number(x))<=1e-12);const expected=normalTransform(ref.normal['120'].map(pair=>(Number(pair[0])+Number(pair[1]))/2));for(let i=0;i<3;i++)assert(Math.abs(hit.normalFixtureToBody[i]-expected[i])<=1e-12);}
const counts={},measurements={};let phase='start',failure=null;
try{
for(const graph of ['source','native']){
 phase=graph+'-import';const api=graph==='source'?await import(pathToFileURL(resolve(home,'build/source.mjs'))):{...await import(pathToFileURL(resolve(root,'packages/barocss-physics/dist/index.js'))),...await import(pathToFileURL(resolve(root,'packages/barocss-physics/dist/replay.js')))};
 const count=counts[graph]={worlds:0,acceptedSteps:0,refusals:0,restores:0};let provider;
 const open=pair=>{assert(count.worlds<32);const w=api.createPhysicsWorld(pair.model,pair.options);count.worlds++;const own=w.getState().identity.providerDigest;provider??=own;assert.equal(own,provider);return w;};
 const step=(owner,commands=[])=>{assert(count.acceptedSteps<1024);const result=owner.step(commands);count.acceptedSteps++;return result;};
 const capture=(name,value)=>{const packet=raw(value);put(graph+'-'+name+'.json',packet);if(graph==='source')sourceResults.set(name,packet);else assert.deepEqual(normalized(packet),normalized(sourceResults.get(name)),'actual Source/Native '+name);};
 const observed=[];
 for(let i=0;i<cases.length;i++){
   const encoded=cases[i],c=decode(encoded),pair=makePair(c),w=open(pair);phase=graph+'-'+c.id;
   let before,after;try{before=w.getState();after=step(w);}finally{w.dispose();}
   const hit=after.ccdHits[0]??null;if(c.expectedClass==='HIT')target(hit,bank.cases[i]);else assert.equal(hit,null);
   const record={id:c.id,start:encoded.start,end:encoded.end,half:encoded.half,radius:encoded.radius,hit:hit?raw({fraction:hit.toiFraction,normalLocal:hit.normalFixtureToBody}):null};observed.push(record);
   if(c.id==='C03-original-corner-witness'){assert.equal(after.contacts.length,1);const body=after.bodies.find(b=>b.id==='sphere');assert(Math.abs(body.velocityMps.reduce((s,x,j)=>s+x*hit.normalFixtureToBody[j],0))<1e-8);measurements[graph]={originalCornerTOI:hit.toiFraction,normal:hit.normalFixtureToBody,contacts:after.contacts.length,afterVelocity:body.velocityMps};}
   capture(c.id,{pair,before,after});
 }
 phase=graph+'-independent-world-audit';const input=resolve(out,graph+'-observed.json');put(graph+'-observed.json',{cases:observed});
 const audit=spawnSync('/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13',['-B',resolve(home,'reference.py'),'--audit','--input',input,'--bank',resolve(home,'evidence/geometry-01/bank.json'),'--output',resolve(out,graph+'-audit.json')],{encoding:'utf8',timeout:20000,maxBuffer:32768});
 put(graph+'-audit-process.json',{status:audit.status,stdout:audit.stdout,stderr:audit.stderr,error:audit.error?.message??null});assert.equal(audit.status,0,audit.stderr);assert.equal(JSON.parse(readFileSync(resolve(out,graph+'-audit.json'))).status,'PASS');
 phase=graph+'-derived-frames-scales';
 const base=decode(cases[0]),ref=bank.cases[0],cyclic=v=>[v[2],v[0],v[1]];
 for(const mode of ['rectangular','cyclic','translated','scale-small','scale-large']){
   const c=structuredClone(base);let normal=x=>x;
   if(mode.startsWith('scale')){const f=mode==='scale-small'?1/8:8;for(const key of ['start','end','half'])c[key]=c[key].map(v=>v*f);c.radius*=f;}
   else{c.half=[.1,.2,.3];c.start=[-.3,.25,0];c.end=[.3,.25,0];}
   if(mode==='cyclic'||mode==='translated'){c.start=cyclic(c.start);c.end=cyclic(c.end);c.orientation=[.5,.5,.5,.5];normal=cyclic;}
   if(mode==='translated'){const shift=[1.25,-.75,.5];c.start=c.start.map((v,i)=>v+shift[i]);c.end=c.end.map((v,i)=>v+shift[i]);c.boxCenter=shift;}
   const pair=makePair(c),w=open(pair);let after;try{after=step(w);target(after.ccdHits[0],ref,normal);}finally{w.dispose();}capture(mode,{pair,after});
 }
 phase=graph+'-fixture-selection';
 for(const mode of ['earliest','tie','tie-reversed']){
   const pair=makePair(decode(cases[1]));const a=staticPart(mode==='earliest'?'z-early':'a-tie',{kind:'box',halfExtentsM:[.25,.25,.25]},{positionM:[0,0,0]}),b=staticPart(mode==='earliest'?'a-late':'z-tie',{kind:'box',halfExtentsM:[.25,.25,.25]},{positionM:mode==='earliest'?[.5,0,0]:[0,0,0]});
   const sphere={body:pair.model.bodies[0],collider:pair.model.colliders[0]};pair.model=makeModel({revision:'g2-fixtures',gravityMps2:[0,0,0],parts:[sphere,...(mode==='tie-reversed'?[b,a]:[a,b])]});
   const w=open(pair);let after;try{after=step(w);}finally{w.dispose();}assert.equal(after.ccdHits[0].colliderId,mode==='earliest'?'z-early.shape':'a-tie.shape');target(after.ccdHits[0],bank.cases[1]);capture(mode,{pair,after});
 }
 phase=graph+'-record-refusal';{
   const pair=makePair(base),w=open(pair),r=api.createPhysicsRecorder(w);let restored;
   try{
     const first=step(r),saved=r.saveRecording(),continued=step(r);assert(count.worlds<32);
     restored=api.restorePhysicsRecording(saved,{model:pair.model,options:pair.options,providerDigest:provider});count.worlds++;count.acceptedSteps++;count.restores++;assert.deepEqual(restored.recorder.getState(),first);assert.deepEqual(restored.recorder.saveRecording(),saved);assert.deepEqual(step(restored.recorder),continued);
     const before={state:restored.recorder.getState(),log:restored.recorder.saveRecording()};assert.throws(()=>restored.recorder.step([{kind:'impulse',bodyId:'sphere',impulseNs:[100000,0,0]}]),e=>e instanceof api.PhysicsError&&e.code==='NUMERIC_LIMIT');count.refusals++;assert.deepEqual({state:restored.recorder.getState(),log:restored.recorder.saveRecording()},before);
     const recovered=step(restored.recorder);capture('recorder',{pair,first,saved,continued,before,recovered});
   }finally{restored?.recorder.dispose();restored?.world.dispose();r.dispose();w.dispose();}
 }
 put(graph+'-counts.json',count);
}
}catch(error){failure={phase,name:error.name,message:error.message,stack:error.stack};}
const summary={status:failure?'FAIL_ROUNDED_PUBLIC_API':'PASS_ROUNDED_PUBLIC_API',counts,measurements,firstFailure:failure,strictCompiledRootReplay:'BUILT',browser:'NOT_RUN'};put('summary.json',summary);console.log(JSON.stringify(summary));if(failure)process.exitCode=1;
