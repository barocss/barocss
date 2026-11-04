import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,realpathSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),id=process.argv[2],freezeFile=resolve(process.argv[3]??resolve(home,'FREEZE-02.json'));
assert(/^[a-z0-9][a-z0-9-]{0,63}$/.test(id??''),'fresh evidence ID required');mkdirSync(resolve(home,'evidence'),{recursive:true});const out=resolve(home,'evidence',id);mkdirSync(out,{recursive:false});
const hash=b=>createHash('sha256').update(b).digest('hex'),raw=x=>typeof x==='number'?{$f64le:(()=>{assert(Number.isFinite(x));const b=Buffer.alloc(8);b.writeDoubleLE(x);return b.toString('hex');})()}:Array.isArray(x)?x.map(raw):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,raw(v)])):x;
const normalized=x=>Array.isArray(x)?x.map(normalized):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,k==='providerDigest'?'VERIFIED_OWN_GRAPH':normalized(v)])):x;
const frac=s=>{const[a,b='1']=s.split('/');return Number(a)/Number(b);};
const budget={casesPerGraph:20,maxWorlds:24,maxAcceptedSteps:28,expectedWorlds:20,expectedAcceptedSteps:24,expectedCreationRefusals:2,maxEvidenceBytesPerGraph:16*1024*1024};
let phase='verify-freeze',failure=null,bytes=0,pins=null;const counts={},maxima={},source=new Map();
const put=(name,value)=>{const text=JSON.stringify(value,null,2)+'\n';assert(bytes+Buffer.byteLength(text)<=2*budget.maxEvidenceBytesPerGraph,'total evidence limit');writeFileSync(resolve(out,name),text,{flag:'wx'});bytes+=Buffer.byteLength(text);};
try{
 assert(realpathSync(freezeFile).startsWith(root+'/'),'Freeze must belong to owned checkout');const freezeBytes=readFileSync(freezeFile);pins=JSON.parse(freezeBytes);assert.equal(pins.format,'physics-box-slab-freeze');assert.equal(pins.version,1);put('frozen-inputs.json',{freezeFile:freezeFile.slice(root.length+1),freezeSHA256:hash(freezeBytes),pins,budget});
 for(const[path,pin]of Object.entries(pins.files)){const absolute=realpathSync(resolve(root,path));assert(absolute.startsWith(root+'/'),'Input escaped checkout');const data=readFileSync(absolute);assert.equal(data.length,pin.bytes,'size drift: '+path);assert.equal(hash(data),pin.sha256,'hash drift: '+path);}
 for(const key of ['sourceModule','nativeModule','replayModule','caseFile','bankFile'])assert(pins.files[pins[key]],'Entry must be frozen: '+key);
 const bank=JSON.parse(readFileSync(resolve(root,pins.bankFile))),spec=JSON.parse(readFileSync(resolve(root,pins.caseFile)));assert.equal(spec.cases.length,20);assert.deepEqual(bank.cases.map(c=>c.id),spec.cases.map(c=>c.id));assert.deepEqual(bank.physical,spec.physical);assert.equal(bank.WorldCalls,0);assert.equal(bank.candidateCalls,0);
 // Even the inert model builders load only after every frozen hash is checked.
 const {makeModel,dynamicPart,staticPart}=await import(pathToFileURL(resolve(root,'examples/physics-model-input/model.mjs')));
 function input(c){const start=c.start??[0,2,0],velocity=c.velocity??[0,-256,0];
  const moving=dynamicPart('moving',{kind:'box',halfExtentsM:spec.physical.halfExtentsM},{positionM:start,velocityMps:velocity,orientationXYZW:c.mutation==='negative-moving-q'?[0,0,0,-1]:[0,0,0,1]},spec.physical.massKg,{ccd:true});
  const fixture=staticPart('fixture',{kind:'box',halfExtentsM:spec.physical.fixedHalfExtentsM},{positionM:c.fixtureCenter??[0,0,0],orientationXYZW:c.mutation==='negative-fixture-q'?[0,0,0,-1]:[0,0,0,1]},{sensor:c.mutation==='sensor-fixture'});
  return {model:makeModel({revision:'g2-box-slab-'+c.id,gravityMps2:[0,0,0],parts:[moving,fixture]}),options:{profile:c.mutation==='persistent-profile'?'rigid-persistent-box-v1':'rigid-discrete-v1',fixedStepSeconds:spec.physical.dt,broadPhase:'direct'}};
 }
 for(const graph of ['source','native']){
  phase=graph+'-import';const api=graph==='source'?await import(pathToFileURL(resolve(root,pins.sourceModule))):{...await import(pathToFileURL(resolve(root,pins.nativeModule))),...await import(pathToFileURL(resolve(root,pins.replayModule)))};
  const count=counts[graph]={creationAttempts:0,worlds:0,creationRefusals:0,acceptedSteps:0,commandRefusals:0,completedCases:0},max=maxima[graph]={toi:0,geometry:0,normal:0,spin:0,tangent:0,velocity:0,momentum:0,energy:0},startBytes=bytes;
  const gate=(name,residual)=>{assert(Number.isFinite(residual),name);max[name]=Math.max(max[name],Math.abs(residual));const limit=['velocity','momentum','energy'].includes(name)?1e-10:1e-12;assert(Math.abs(residual)<=limit,`${name}: ${residual} exceeds ${limit}`);};
  const open=p=>{assert(count.worlds<budget.maxWorlds);count.creationAttempts++;const w=api.createPhysicsWorld(p.model,p.options);count.worlds++;return w;};
  const step=w=>{assert(count.acceptedSteps<budget.maxAcceptedSteps);const s=w.step();count.acceptedSteps++;return s;};
  let positiveIdentityControl=null;
  function physical(value){
   if(typeof value==='number')return Object.is(value,-0)?0:value;
   if(Array.isArray(value))return value.map(physical);
   if(value&&typeof value==='object'){const result={};for(const[key,v]of Object.entries(value)){if(key==='identity'||key==='revision')continue;if(key==='orientationXYZW'){const[x,y,z,w]=v;gate('normal',x*x+y*y+z*z+w*w-1);result.rotationMatrix=physical([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]);}else result[key]=physical(v);}return result;}return value;
  }
  const capture=(name,value)=>{const packet=raw(value);put(graph+'-'+name+'.json',packet);assert(bytes-startBytes<=budget.maxEvidenceBytesPerGraph,'per-graph evidence limit');if(graph==='source')source.set(name,packet);else assert.deepEqual(normalized(packet),normalized(source.get(name)),'Source/Native parity: '+name);};
  for(let index=0;index<spec.cases.length;index++){
   const c=spec.cases[index],ref=bank.cases[index],p=input(c);phase=graph+'-'+c.id;put(graph+'-'+c.id+'-input.json',raw({case:c,reference:ref,...p}));
   if(c.kind==='admission'){
    let rejected=null;try{const unexpected=open(p);unexpected.dispose();}catch(error){rejected={name:error.name,code:error.code,message:error.message};put(graph+'-'+c.id+'-refusal.json',rejected);assert(error instanceof api.PhysicsError&&error.code===ref.expectedError,'Expected typed creation boundary');count.creationRefusals++;}assert(rejected,'Expected creation refusal');capture(c.id,{input:p,reference:ref,rejected});count.completedCases++;continue;
   }
   const w=open(p);let control,r,cr;
   try{
    if(c.kind==='command'){
     control=open(p);r=api.createPhysicsRecorder(w);cr=api.createPhysicsRecorder(control);assert.deepEqual(step(r),step(cr));const before={state:r.getState(),recording:r.saveRecording()};put(graph+'-'+c.id+'-before.json',raw({input:p,before,command:c.command}));let rejected;
     try{r.step([c.command]);}catch(error){rejected={name:error.name,code:error.code,message:error.message};assert(error instanceof api.PhysicsError&&error.code===ref.expectedError);count.commandRefusals++;}assert(rejected,'Angular command must refuse');const retained={state:r.getState(),recording:r.saveRecording()};put(graph+'-'+c.id+'-retained.json',raw({rejected,retained}));assert.deepEqual(retained,before,'Refusal preserves accepted state, clock and recorder');const retry=step(r),expected=step(cr);assert.deepEqual(retry,expected);assert.deepEqual(r.saveRecording(),cr.saveRecording());capture(c.id,{input:p,before,rejected,retained,retry,expected,recording:r.saveRecording()});
    }else{
     const before=w.getState();put(graph+'-'+c.id+'-before.json',raw({input:p,before}));const after=step(w);capture(c.id,{input:p,reference:ref,before,after});assert.equal(after.stepIndex,1);assert.equal(after.timeSeconds,spec.physical.dt);
     const hit=after.ccdHits[0]??null;assert.equal(after.ccdHits.length,ref.classification==='HIT'?1:0,'Exact swept/discrete ownership');if(hit){gate('toi',hit.toiFraction-frac(ref.toi));ref.normal.forEach((v,i)=>gate('normal',hit.normalFixtureToBody[i]-frac(v)));gate('normal',hit.normalFixtureToBody.reduce((s,v)=>s+v*v,0)-1);}
     assert.equal(after.contacts.length>0,ref.contactExpected,'Actual contact ownership');const body=after.bodies.find(b=>b.id==='moving'),initial=before.bodies.find(b=>b.id==='moving'),fixture=after.bodies.find(b=>b.id==='fixture'),impulse=[0,0,0];
     for(const contact of after.contacts){const sign=contact.bodyBId==='moving'?1:-1;contact.tangentImpulseOnBNs.forEach(v=>gate('tangent',v));for(let i=0;i<3;i++)impulse[i]+=sign*(contact.normalAtoB[i]*contact.normalImpulseNs+contact.tangentImpulseOnBNs[i]);}
     for(let i=0;i<3;i++){gate('geometry',body.positionM[i]-frac(ref.acceptedPositionM[i]));gate('velocity',body.velocityMps[i]-frac(ref.velocityMps[i]));gate('momentum',impulse[i]-frac(ref.impulseOnMovingNs[i]));gate('momentum',spec.physical.massKg*(body.velocityMps[i]-initial.velocityMps[i])-impulse[i]);gate('spin',body.angularVelocityRadps[i]);gate('geometry',fixture.positionM[i]-(c.fixtureCenter??[0,0,0])[i]);gate('velocity',fixture.velocityMps[i]);gate('spin',fixture.angularVelocityRadps[i]);}
     if(c.id==='centered-y-entry')positiveIdentityControl={input:p,before,after};
     if(c.equivalentTo){assert.equal(c.equivalentTo,'centered-y-entry');assert(positiveIdentityControl,'Positive identity control must precede sign cases');const actualPhysical=physical({input:p,before,after}),controlPhysical=physical(positiveIdentityControl);put(graph+'-'+c.id+'-orientation-equivalence.json',raw({proof:ref.orientationProof,actualPhysical,controlPhysical}));assert.deepEqual(actualPhysical,controlPhysical,'Hamilton q/-q model/geometry/dynamics equivalence');}
     const energy=spec.physical.massKg/2*body.velocityMps.reduce((s,v)=>s+v*v,0);gate('energy',energy-frac(ref.energyJ));put(graph+'-'+c.id+'-checks.json',raw({impulseOnMovingNs:impulse,kineticEnergyJ:energy,maxima:max}));
    }
    count.completedCases++;
   }finally{r?.dispose();cr?.dispose();control?.dispose();w.dispose();}
   assert(bytes-startBytes<=budget.maxEvidenceBytesPerGraph);
  }
  assert.equal(count.worlds,20);assert.equal(count.creationAttempts,22);assert.equal(count.creationRefusals,2);assert.equal(count.acceptedSteps,24);assert.equal(count.commandRefusals,2);assert.equal(count.completedCases,20);put(graph+'-counts.json',{counts:count,maxima:max,evidenceBytes:bytes-startBytes});
 }
}catch(error){failure={phase,name:error.name,message:error.message,stack:error.stack};}
const result={status:failure?'NO_GO_BOX_SLAB_BOUNDARIES':'PASS_FINITE_BOX_SLAB_BOUNDARIES',counts,maxima,firstFailure:failure,evidenceBytes:bytes,budget,provider:pins?.provider??null,negativeQuaternion:'q/-q finite HIT physical equivalence by unit Hamilton rotation matrices; original refusal baseline preserved',browser:'NOT_RUN',generalContactGeometry:'NOT_QUALIFIED',originalP4:'UNCHANGED_NO_GO'};put('result.json',result);console.log(JSON.stringify(result));if(failure)process.exitCode=1;
