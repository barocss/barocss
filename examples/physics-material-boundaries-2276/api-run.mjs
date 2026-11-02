import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { makeModel, dynamicPart, staticPart } from '../physics-model-input/model.mjs';
import { cases, physical, gates, budget, reusedBuildPins } from './cases.mjs';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..');
const providerPinFile=resolve(process.argv[3]??resolve(home,'PROVIDER-PINS-01.json'));
const id=process.argv[2];assert(/^[a-z0-9][a-z0-9-]{0,63}$/.test(id??''),'fresh evidence ID required');
mkdirSync(resolve(home,'evidence'),{recursive:true});const out=resolve(home,'evidence',id);mkdirSync(out,{recursive:false});
let providerPins=null,providerPinSHA256=null;
let bytes=0,phase='freeze',failure=null;const counts={},maxima={},source=new Map();
const hash=b=>createHash('sha256').update(b).digest('hex');
const pins=Object.fromEntries(['CONTRACT.md','cases.mjs','api-run.mjs','README.md'].map(name=>[name,hash(readFileSync(resolve(home,name)))]));
const raw=x=>typeof x==='number'?{$f64le:(()=>{assert(Number.isFinite(x));const b=Buffer.alloc(8);b.writeDoubleLE(x);return b.toString('hex');})()}:Array.isArray(x)?x.map(raw):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,raw(v)])):x;
const normalized=x=>Array.isArray(x)?x.map(normalized):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,k==='providerDigest'?'VALIDATED_OWN_GRAPH':normalized(v)])):x;
function put(name,value){const text=JSON.stringify(value,null,2)+'\n',size=Buffer.byteLength(text);assert(bytes+size<=2*budget.maxEvidenceBytes,'total evidence bound');writeFileSync(resolve(out,name),text,{flag:'wx'});bytes+=size;}
function input(c){
 const fixed=c.lexicalSwap?'z-floor':'a-floor',moving=c.lexicalSwap?'a-sphere':'z-sphere';
 const sphereFriction={static:c.materialSwap?c.floorStatic:c.sphereStatic,dynamic:c.materialSwap?c.floorDynamic:c.sphereDynamic};
 const floorFriction={static:c.materialSwap?c.sphereStatic:c.floorStatic,dynamic:c.materialSwap?c.sphereDynamic:c.floorDynamic};
 const floor=staticPart(fixed,{kind:'box',halfExtentsM:[2,.5,2]},{positionM:[0,-.5,0]},{friction:floorFriction,restitution:c.restitution,ccd:false});
 const sphere=dynamicPart(moving,{kind:'sphere',radiusM:physical.radiusM},{positionM:[0,.5,0],velocityMps:[c.vt,-c.closingSpeed,0]},physical.massKg,{friction:sphereFriction,restitution:c.restitution,ccd:false});
 return {fixed,moving,model:makeModel({revision:'g2-material-'+c.id,gravityMps2:[0,0,0],parts:c.reverse?[sphere,floor]:[floor,sphere]}),options:{profile:'rigid-discrete-v1',fixedStepSeconds:physical.dt,broadPhase:'direct'}};
}
function reference(c){
 // Newton normal law and independently pinned friction branch magnitudes.
 const bounce=c.closingSpeed>.5?c.restitution:0;
 const normalImpulseNs=physical.massKg*Math.max(0,c.closingSpeed)*(1+bounce);
 const tangentXNs=-Math.sign(c.vt)*c.expectedMagnitude;
 return {branch:c.branch,bounce,normalImpulseNs,tangentXNs,velocityMps:[c.vt+tangentXNs/physical.massKg,-c.closingSpeed+normalImpulseNs/physical.massKg,0],angularVelocityRadps:[0,0,physical.radiusM*tangentXNs/physical.inertiaKgM2],geometricArmM:[0,-physical.radiusM,0],mixedStatic:Math.sqrt(c.sphereStatic*c.floorStatic),mixedDynamic:Math.sqrt(c.sphereDynamic*c.floorDynamic)};
}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const energy=b=>physical.massKg/2*dot(b.velocityMps,b.velocityMps)+physical.inertiaKgM2/2*dot(b.angularVelocityRadps,b.angularVelocityRadps);
try{
 phase='provider-pin-manifest';
 assert(realpathSync(providerPinFile).startsWith(root+'/'),'Provider pin file must belong to own checkout');
 const providerPinBytes=readFileSync(providerPinFile);providerPinSHA256=hash(providerPinBytes);providerPins=JSON.parse(providerPinBytes);
 assert.equal(providerPins.format,'barocss-physics-provider-pins');assert.equal(providerPins.version,1);
 for(const key of ['sourceModule','nativeModule','buildReceipt']){assert.equal(typeof providerPins[key],'string');assert(providerPins.files[providerPins[key]],'Provider entry must be hashed: '+key);}
 if(process.argv[3]===undefined)assert.deepEqual(providerPins.files,reusedBuildPins,'Default original provider pins stay frozen');
 put('frozen-inputs.json',{pins,cases,physical,gates,budget,providerPinFile:providerPinFile.slice(root.length+1),providerPinSHA256,providerPins,represented:raw({cases,physical,gates})});
 phase='verify-reused-build';
 for(const[path,pin]of Object.entries(providerPins.files)){const absolute=realpathSync(resolve(root,path));assert(absolute.startsWith(root+'/'),'Pinned input escaped own checkout');const data=readFileSync(absolute);assert.equal(data.length,pin.bytes,'Build size drift: '+path);assert.equal(hash(data),pin.sha256,'Build hash drift: '+path);}
 const buildResult=JSON.parse(readFileSync(resolve(root,providerPins.buildReceipt)));assert.equal(buildResult.status,'PASS_BUILD','Prior build receipt');
 put('verified-build-reuse.json',{status:'PASS_REUSE_HASHES',checkedFiles:Object.keys(providerPins.files).length,providerPinFile:providerPinFile.slice(root.length+1),providerPinSHA256,providerPins});
 assert.equal(cases.length,budget.worlds);assert.equal(cases.length,budget.acceptedSteps);
 for(const graph of ['source','native']){
  phase=graph+'-import';const api=await import(pathToFileURL(resolve(root,graph==='source'?providerPins.sourceModule:providerPins.nativeModule)));
  const count=counts[graph]={worlds:0,acceptedSteps:0},max=maxima[graph]=Object.fromEntries(Object.keys(gates).map(k=>[k,0]));const graphStartBytes=bytes;
  function gate(name,residual){assert(Number.isFinite(residual),name+' finite');max[name]=Math.max(max[name],Math.abs(residual));assert(Math.abs(residual)<=gates[name],`${name}: ${residual} exceeds ${gates[name]}`);}
  for(const c of cases){
   phase=graph+'-'+c.id;const p=input(c),ref=reference(c);assert(count.worlds<budget.maxWorlds);const w=api.createPhysicsWorld(p.model,p.options);count.worlds++;
   try{
    const before=w.getState();put(graph+'-'+c.id+'-before.json',raw({case:c,input:p,reference:ref,before}));assert(bytes-graphStartBytes<=budget.maxEvidenceBytes,'per-graph evidence bound');assert(count.acceptedSteps<budget.maxAcceptedSteps);const after=w.step();count.acceptedSteps++;
    const packet=raw({case:c,input:p,reference:ref,before,after});put(graph+'-'+c.id+'.json',packet);assert(bytes-graphStartBytes<=budget.maxEvidenceBytes,'per-graph evidence bound');
    if(graph==='source')source.set(c.id,packet);else assert.deepEqual(normalized(packet),normalized(source.get(c.id)),'Source/Native public parity: '+c.id);
    const initial=before.bodies.find(b=>b.id===p.moving),body=after.bodies.find(b=>b.id===p.moving),floor=after.bodies.find(b=>b.id===p.fixed);
    assert(body&&initial&&floor,'Expected both public bodies');assert.equal(after.stepIndex,1);assert.equal(after.timeSeconds,physical.dt);assert.equal(after.ccdHits.length,0,'No CCD fallback');
    if(c.closingSpeed>0||c.requireContact)assert(after.contacts.length>0,'Actual contact required');
    const impulse=[0,0,0];let normal=0;
    for(const contact of after.contacts){
     assert([contact.bodyAId,contact.bodyBId].includes(p.moving),'Contact belongs to sphere');const sign=contact.bodyBId===p.moving?1:-1;
     normal+=contact.normalImpulseNs;gate('tangentPlane',dot(contact.tangentImpulseOnBNs,contact.normalAtoB));
     for(let i=0;i<3;i++){impulse[i]+=sign*(contact.normalAtoB[i]*contact.normalImpulseNs+contact.tangentImpulseOnBNs[i]);gate('geometry',contact.pointM[i]-(body.positionM[i]+ref.geometricArmM[i]));}
     gate('geometry',sign*contact.normalAtoB[0]);gate('geometry',sign*contact.normalAtoB[1]-1);gate('geometry',sign*contact.normalAtoB[2]);
    }
    gate('impulse',normal-ref.normalImpulseNs);gate('impulse',impulse[0]-ref.tangentXNs);gate('impulse',impulse[1]-ref.normalImpulseNs);gate('tangentPlane',impulse[2]);
    const torque=cross(ref.geometricArmM,impulse);
    for(let i=0;i<3;i++){
     gate('velocity',body.velocityMps[i]-ref.velocityMps[i]);gate('omega',body.angularVelocityRadps[i]-ref.angularVelocityRadps[i]);
     gate('momentum',physical.massKg*(body.velocityMps[i]-initial.velocityMps[i])-impulse[i]);gate('angularMomentum',physical.inertiaKgM2*(body.angularVelocityRadps[i]-initial.angularVelocityRadps[i])-torque[i]);
     gate('velocity',floor.velocityMps[i]);gate('omega',floor.angularVelocityRadps[i]);
    }
    gate('geometry',body.positionM[1]-.5-Math.max(0,-c.closingSpeed*physical.dt));
    const slip=body.velocityMps[0]+physical.radiusM*body.angularVelocityRadps[2],magnitude=Math.abs(impulse[0]);
    if(c.branch==='stick'){gate('slip',slip);assert(magnitude<=ref.mixedStatic*normal,'Exact static Coulomb cap');}
    if(c.branch==='slide'){gate('impulse',magnitude-ref.mixedDynamic*normal);assert(Math.sign(slip)===Math.sign(c.vt),'Sliding retains initial slip direction');}
    if(c.branch==='zero'||c.branch==='no-normal')gate('impulse',magnitude);
    if(c.branch==='no-normal')assert.equal(normal,0,'No normal impulse means no friction');
    if(c.id==='dynamic-next-up'||c.id==='reverse-next-up')assert(magnitude<.5,'Above boundary takes dynamic branch');
    if(c.id==='static-exact'||c.id==='static-next-down')assert(magnitude>.5,'At or below boundary takes static branch');
    if(c.restitution===1){if(c.closingSpeed>.5)assert(body.velocityMps[1]>0,'Strict positive restitution branch');else assert.equal(body.velocityMps[1],0,'Threshold equality has no bounce');}
    const beforeEnergy=energy(initial),afterEnergy=energy(body),meanV=body.velocityMps.map((v,i)=>(v+initial.velocityMps[i])/2),meanW=body.angularVelocityRadps.map((v,i)=>(v+initial.angularVelocityRadps[i])/2);
    const impulseWork=dot(impulse,meanV)+dot(torque,meanW);gate('energy',afterEnergy-beforeEnergy-impulseWork);gate('energy',Math.max(0,afterEnergy-beforeEnergy));
    const expectedEnergy=physical.massKg/2*dot(ref.velocityMps,ref.velocityMps)+physical.inertiaKgM2/2*dot(ref.angularVelocityRadps,ref.angularVelocityRadps);gate('energy',afterEnergy-expectedEnergy);
    put(graph+'-'+c.id+'-checks.json',raw({reference:ref,impulseOnSphereNs:impulse,torqueImpulseOnSphereNms:torque,contactSlipXMps:slip,beforeEnergyJ:beforeEnergy,afterEnergyJ:afterEnergy,impulseWorkJ:impulseWork,maxima:max}));assert(bytes-graphStartBytes<=budget.maxEvidenceBytes,'per-graph evidence bound');
   }finally{w.dispose();}
  }
  assert.equal(count.worlds,budget.worlds);assert.equal(count.acceptedSteps,budget.acceptedSteps);put(graph+'-counts.json',{count,maxima:max,evidenceBytes:bytes-graphStartBytes});
 }
}catch(error){failure={phase,name:error.name,message:error.message,stack:error.stack};}
const summary={status:failure?'FAIL_MATERIAL_BOUNDARIES_PUBLIC_API':'PASS_MATERIAL_BOUNDARIES_PUBLIC_API',pins,counts,maxima,firstFailure:failure,evidenceBytes:bytes,providerPinFile:providerPinFile.slice(root.length+1),providerPinSHA256,reusedBuild:'Explicit frozen provider manifest checked before graph imports',browser:'NOT_RUN',scope:'one-step uniform sphere/finite floor discrete material boundaries'};
put('summary.json',summary);console.log(JSON.stringify(summary));if(failure)process.exitCode=1;
