import {createPhysicsWorld} from '../../packages/barocss-physics/dist/index.js';
import {makeModel,dynamicPart,staticPart} from '../physics-model-input/model.mjs';
import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const id=process.argv[2];if(!/^[a-z0-9-]+$/.test(id??''))throw Error('fresh ID required');
const out=resolve('examples/physics-tangent-response-2276/evidence',id);mkdirSync(out,{recursive:false});
const dt=1/128,mat={friction:{static:1,dynamic:.5}},model=makeModel({revision:'g2-anisotropic-stick-baseline',gravityMps2:[0,0,0],parts:[staticPart('floor',{kind:'box',halfExtentsM:[2,.5,2]},{positionM:[0,-.5,0]},mat),dynamicPart('moving',{kind:'box',halfExtentsM:[1,.5,.5]},{positionM:[-dt,.5+dt,-dt],velocityMps:[1,-1,1]},1,mat)]}),options={profile:'rigid-discrete-v1',fixedStepSeconds:dt,broadPhase:'direct'};
const pins={};for(const path of ['packages/barocss-physics/src/world.ts','packages/barocss-physics/src/collision.ts','packages/barocss-physics/src/math.ts','packages/barocss-physics/src/provider-manifest.generated.ts']){const b=readFileSync(path);pins[path]={bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};cpSync(path,resolve(out,path.split('/').at(-1)));}
cpSync('packages/barocss-physics/dist',resolve(out,'provider-dist'),{recursive:true});
const w=createPhysicsWorld(model,options);let before,after;try{before=w.getState();after=w.step();}finally{w.dispose();}
const b=after.bodies.find(b=>b.id==='moving'),slip=[b.velocityMps[0]+.5*b.angularVelocityRadps[2],b.velocityMps[2]-.5*b.angularVelocityRadps[0]],slipNorm=Math.hypot(...slip);
const result={status:slipNorm>1e-10?'PHYSICAL_NO_GO_ANISOTROPIC_STATIC_SLIP':'UNEXPECTED_BASELINE_PASS',counts:{worlds:1,acceptedSteps:1},model,options,pins,before,after,slip,slipNorm,expected:{velocityMps:[3/8,0,3/5],angularVelocityRadps:[6/5,0,-3/4],tangentOnMovingNs:[-5/8,0,-2/5],energyJ:39/80,slipNorm:0},gate:1e-10};
writeFileSync(resolve(out,'result.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,slip,slipNorm,velocity:b.velocityMps,omega:b.angularVelocityRadps}));if(result.status!=='PHYSICAL_NO_GO_ANISOTROPIC_STATIC_SLIP')process.exitCode=1;
