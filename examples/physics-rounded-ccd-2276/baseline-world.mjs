import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {makeModel,dynamicPart,staticPart} from '../physics-model-input/model.mjs';
const root=process.cwd(),out=resolve(root,'examples/physics-rounded-ccd-2276/evidence/baseline-01');mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),files={};
for(const name of readdirSync(resolve(root,'packages/barocss-physics/dist'))){const p=resolve(root,'packages/barocss-physics/dist',name);if(!name.endsWith('.js'))continue;const b=readFileSync(p);files[name]={bytes:b.length,sha256:sha(b)};}
writeFileSync(resolve(out,'provider.json'),JSON.stringify({mode:'actual-existing-canonical-compiled-root-before-repair',files},null,2)+'\n',{flag:'wx'});
const {createPhysicsWorld}=await import('../../packages/barocss-physics/dist/index.js');
const radius=.1,half=[.1,.1,.1],start=[-.3,.15,0],end=[.3,.15,0],dt=1/60;
const model=makeModel({revision:'g2-original-corner-public-baseline',gravityMps2:[0,0,0],parts:[dynamicPart('sphere',{kind:'sphere',radiusM:radius},{positionM:start,velocityMps:end.map((x,i)=>(x-start[i])/dt)},1,{ccd:true}),staticPart('box',{kind:'box',halfExtentsM:half},{positionM:[0,0,0]})]});
const options={profile:'rigid-discrete-v1',fixedStepSeconds:dt,broadPhase:'direct'},world=createPhysicsWorld(model,options),before=world.getState();let after;
try{after=world.step();}finally{world.dispose();}
const hit=after.ccdHits[0],unbiased=start.map((v,i)=>v+(end[i]-v)*hit.toiFraction),closest=unbiased.map((x,i)=>Math.max(-half[i],Math.min(half[i],x))),d2=unbiased.reduce((s,x,i)=>s+(x-closest[i])**2,0),bound=(radius+1e-12)**2;
const result={status:d2>bound?'PHYSICAL_NO_GO_FALSE_EARLY_HIT':'BASELINE_CHANGED',model,options,before,after,originalEndpoints:{start,end,half,radius},unbiasedCenterLocal:unbiased,distanceSquaredM2:d2,contactSquaredBoundM2:bound,contactCount:after.contacts.length,expected:'sphere must touch actual rounded box at reported TOI; biased stop is separate'};
writeFileSync(resolve(out,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,toi:hit.toiFraction,distanceSquaredM2:d2,contactCount:result.contactCount}));if(result.status!=='PHYSICAL_NO_GO_FALSE_EARLY_HIT')process.exitCode=1;
