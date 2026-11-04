import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {makeModel,dynamicPart,staticPart} from '../physics-model-input/model.mjs';
const home=dirname(fileURLToPath(import.meta.url)),root=resolve(home,'../..'),id=process.argv[2];
assert(/^[a-z0-9-]+$/.test(id??''));mkdirSync(resolve(home,'evidence'),{recursive:true});
const out=resolve(home,'evidence',id);mkdirSync(out,{recursive:false});
const hash=b=>createHash('sha256').update(b).digest('hex');
const pins=JSON.parse(readFileSync(resolve(home,'FREEZE-01.json')));
for(const [p,v] of Object.entries(pins.files)){const b=readFileSync(resolve(root,p));assert.equal(b.length,v.bytes);assert.equal(hash(b),v.sha256,'provider/source drift '+p);}
const bank=JSON.parse(readFileSync(resolve(home,'BANK-01.json')));assert.equal(bank.cases.length,16);
const frac=s=>{const [a,b='1']=s.split('/');return Number(a)/Number(b);};
const raw=x=>typeof x==='number'?{$f64le:(()=>{assert(Number.isFinite(x));const b=Buffer.alloc(8);b.writeDoubleLE(x);return b.toString('hex');})()}:Array.isArray(x)?x.map(raw):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,raw(v)])):x;
const norm=x=>Array.isArray(x)?x.map(norm):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,k==='providerDigest'?'VERIFIED_OWN_GRAPH':norm(v)])):x;
let bytes=0,phase='imports',failure=null;const counts={},maxima={},saved=new Map();
const put=(name,value)=>{const text=JSON.stringify(value,null,2)+'\n';bytes+=Buffer.byteLength(text);assert(bytes<=16*1024*1024);writeFileSync(resolve(out,name),text,{flag:'wx'});};
try{
 for(const graph of ['source','native']){
  const api=await import(pathToFileURL(resolve(root,graph==='source'?'examples/physics-sphere-pair-ccd-2276/build/source.mjs':'packages/barocss-physics/dist/index.js')));
  const count=counts[graph]={worlds:0,acceptedSteps:0},max=maxima[graph]={velocity:0,impulse:0,angularVelocity:0,energy:0,tangentPlane:0};
  const gate=(key,x)=>{assert(Number.isFinite(x));max[key]=Math.max(max[key],Math.abs(x));assert(Math.abs(x)<=(key==='tangentPlane'?1e-12:1e-10),key+': '+x);};
  for(const c of bank.cases){
   phase=graph+'-'+c.id;const mobile=c.kind==='two-spheres',axis=mobile?0:1;
   const aId=c.swap?'z-moving':'a-moving',bId=c.swap?'a-other':'z-other';
   const options={profile:'rigid-discrete-v1',fixedStepSeconds:1/120,broadPhase:'direct'};
   const a=dynamicPart(aId,c.kind==='fixed-cube'?{kind:'box',halfExtentsM:[.5,.5,.5]}:{kind:'sphere',radiusM:.5},{positionM:mobile?[-.49,0,0]:[0,.5,0],velocityMps:mobile?[c.speed/2,0,0]:[0,-c.speed,0]},2,{restitution:c.ea});
   const b=mobile?dynamicPart(bId,{kind:'sphere',radiusM:.5},{positionM:[.49,0,0],velocityMps:[-c.speed/2,0,0]},3,{restitution:c.eb}):staticPart(bId,{kind:'box',halfExtentsM:[2,.5,2]},{positionM:[0,-.5,0]},{restitution:c.eb});
   const model=makeModel({revision:'g2-discrete-'+c.id,gravityMps2:[0,0,0],parts:c.reverse?[b,a]:[a,b]});
   put(graph+'-'+c.id+'-input.json',{case:c,model,options});assert(count.worlds<16);const w=api.createPhysicsWorld(model,options);count.worlds++;
   try{
    const before=w.getState();assert(count.acceptedSteps<16);const after=w.step();count.acceptedSteps++;
    const packet=raw({before,after});put(graph+'-'+c.id+'-output.json',packet);
    if(graph==='source')saved.set(c.id,packet);else assert.deepEqual(norm(packet),norm(saved.get(c.id)));
    assert(after.contacts.length>0);assert.equal(after.ccdHits.length,0);assert.equal(after.stepIndex,1);assert.equal(after.timeSeconds,1/120);
    const aa=after.bodies.find(x=>x.id===aId),bb=after.bodies.find(x=>x.id===bId);
    const impulse=[0,0,0];
    for(const p of after.contacts){
     const sign=p.bodyBId===aId?1:-1;
     gate('tangentPlane',p.tangentImpulseOnBNs.reduce((sum,v,i)=>sum+v*p.normalAtoB[i],0));
     for(let i=0;i<3;i++)impulse[i]+=sign*(p.normalImpulseNs*p.normalAtoB[i]+p.tangentImpulseOnBNs[i]);
    }
    gate('velocity',aa.velocityMps[axis]-frac(c.reference.velocityA));gate('velocity',bb.velocityMps[axis]-frac(c.reference.velocityB));gate('impulse',impulse[axis]-frac(c.reference.impulseA));
    for(let i=0;i<3;i++){gate('angularVelocity',aa.angularVelocityRadps[i]);gate('angularVelocity',bb.angularVelocityRadps[i]);if(i!==axis){gate('velocity',aa.velocityMps[i]);gate('velocity',bb.velocityMps[i]);gate('impulse',impulse[i]);}}
    const energy=aa.velocityMps.reduce((s,v)=>s+v*v,0)+(mobile?1.5*bb.velocityMps.reduce((s,v)=>s+v*v,0):0);
    gate('energy',energy-frac(c.reference.energyAfter));assert(energy<=frac(c.reference.energyBefore)+1e-10);
   }finally{w.dispose();}
  }
 }
}catch(error){failure={phase,name:error.name,message:error.message,stack:error.stack};}
const result={status:failure?'NO_GO_DISCRETE_RESTITUTION':'PASS_FINITE_DISCRETE_RESTITUTION',counts,maxima,firstFailure:failure,evidenceBytes:bytes,providerFreeze:pins,browser:'NOT_RUN',fullDynamics:'NOT_QUALIFIED',originalP4:'UNCHANGED_NO_GO'};
put('result.json',result);console.log(JSON.stringify(result));if(failure)process.exitCode=1;
